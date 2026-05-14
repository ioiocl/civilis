import Fastify from "fastify";
import { createHash } from "node:crypto";
import cors from "@fastify/cors";
import jwt from "@fastify/jwt";
import multipart from "@fastify/multipart";
import sensible from "@fastify/sensible";
import { z } from "zod";
import { AuthUseCase } from "../application/usecases/auth.js";
import { ComentarHito } from "../application/usecases/comentar-hito.js";
import { CrearHito } from "../application/usecases/crear-hito.js";
import { CrearObra } from "../application/usecases/crear-obra.js";
import { ListarComentariosHito } from "../application/usecases/listar-comentarios-hito.js";
import { ListarHitosObra } from "../application/usecases/listar-hitos-obra.js";
import { ListarObras } from "../application/usecases/listar-obras.js";
import { ObtenerObra } from "../application/usecases/obtener-obra.js";
import { ComentarioRepositoryPrisma } from "../adapters/postgres/comentario-repository-prisma.js";
import { HitoRepositoryPrisma } from "../adapters/postgres/hito-repository-prisma.js";
import { ObraRepositoryPrisma } from "../adapters/postgres/obra-repository-prisma.js";
import { UsuarioRepositoryPrisma } from "../adapters/postgres/usuario-repository-prisma.js";
import { SolanaBlockchainService } from "../adapters/solana/solana-blockchain-service.js";
import { MinioStorage } from "../adapters/storage/minio-storage.js";
import { prisma } from "../adapters/postgres/prisma-client.js";
import { env } from "./env.js";
import "./types.js";

const obraRepository = new ObraRepositoryPrisma();
const hitoRepository = new HitoRepositoryPrisma();
const comentarioRepository = new ComentarioRepositoryPrisma();
const usuarioRepository = new UsuarioRepositoryPrisma();

const fileStorage = new MinioStorage({
  endpoint: env.minioEndpoint,
  port: env.minioPort,
  accessKeyId: env.minioAccessKey,
  secretAccessKey: env.minioSecretKey,
  bucket: env.minioBucket,
  useSSL: env.minioUseSSL,
});

const blockchainService = new SolanaBlockchainService({
  mode: env.solanaMode,
  rpcUrl: env.solanaRpcUrl,
  secretKey: JSON.parse(env.solanaPrivateKey),
  secretKeyBase58: env.solanaPrivateKeyBase58 || undefined,
  commitment: env.solanaCommitment,
});

const crearObra = new CrearObra(obraRepository);
const listarObras = new ListarObras(obraRepository);
const obtenerObra = new ObtenerObra(obraRepository);
const crearHito = new CrearHito(hitoRepository, obraRepository);
const listarHitosObra = new ListarHitosObra(hitoRepository);
const comentarHito = new ComentarHito(
  comentarioRepository,
  obraRepository,
  fileStorage,
  blockchainService,
);
const listarComentariosHito = new ListarComentariosHito(comentarioRepository);
const authUseCase = new AuthUseCase(usuarioRepository);

const registerSchema = z.object({
  nombre: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(6),
  rol: z.enum(["ADMIN", "FISCALIZADOR", "CIUDADANO"]),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

function can(userRole: string, allowed: string[]): boolean {
  return allowed.includes(userRole);
}

async function authGuard(request: any, allowedRoles: string[]): Promise<void> {
  await request.jwtVerify();
  if (!can(request.user.role, allowedRoles)) {
    throw new Error("forbidden");
  }
}

export function buildServer() {
  const app = Fastify({ logger: true });

  app.register(cors, { origin: true });
  app.register(multipart, { limits: { files: 5, fileSize: 20 * 1024 * 1024 } });
  app.register(sensible);
  app.register(jwt, { secret: env.jwtSecret });

  app.get("/health", async () => ({ ok: true }));

  app.post("/auth/register", async (request, reply) => {
    const input = registerSchema.parse(request.body);
    const user = await authUseCase.register(input);
    return reply.code(201).send({ id: user.id, email: user.email, rol: user.rol, nombre: user.nombre });
  });

  app.post("/auth/login", async (request) => {
    const input = loginSchema.parse(request.body);
    const user = await authUseCase.login(input);
    const token = app.jwt.sign({ sub: user.id, role: user.rol });
    return { token, user: { id: user.id, nombre: user.nombre, rol: user.rol, email: user.email } };
  });

  app.post("/obras", async (request, reply) => {
    await authGuard(request, ["ADMIN"]);

    const body = z
      .object({
        nombre: z.string().min(2),
        descripcion: z.string().min(3),
        ubicacion: z.string().min(3),
        encargado: z.string().min(3),
        valor: z.number().positive(),
        fechaInicio: z.string().datetime(),
        fechaFin: z.string().datetime(),
        latitud: z.number().min(-90).max(90).nullable().optional(),
        longitud: z.number().min(-180).max(180).nullable().optional(),
      })
      .parse(request.body);

    const obra = await crearObra.execute({
      ...body,
      fechaInicio: new Date(body.fechaInicio),
      fechaFin: new Date(body.fechaFin),
      latitud: body.latitud ?? null,
      longitud: body.longitud ?? null,
      creadoPor: request.user.sub,
    });

    return reply.code(201).send(obra);
  });

  app.get("/obras", async (request) => {
    await authGuard(request, ["ADMIN", "FISCALIZADOR", "CIUDADANO"]);
    return listarObras.execute();
  });

  app.get("/obras/:id", async (request) => {
    await authGuard(request, ["ADMIN", "FISCALIZADOR", "CIUDADANO"]);
    const params = z.object({ id: z.string() }).parse(request.params);
    return obtenerObra.execute(params.id);
  });

  app.get("/obras/:id/general", async (request) => {
    await authGuard(request, ["ADMIN", "FISCALIZADOR", "CIUDADANO"]);
    const params = z.object({ id: z.string() }).parse(request.params);

    const obra = await prisma.obra.findUnique({
      where: { id: params.id },
      include: {
        obraActores: {
          include: { actor: true },
        },
      },
    });

    if (!obra) {
      throw new Error("obra no encontrada");
    }

    return {
      id: obra.id,
      nombre: obra.nombre,
      descripcion: obra.descripcion,
      ubicacion: obra.ubicacion,
      encargado: obra.encargado,
      valor: obra.valor,
      fechaInicio: obra.fechaInicio,
      fechaFin: obra.fechaFin,
      estado: obra.estado,
      actores: obra.obraActores.map((oa) => ({
        id: oa.actor.id,
        nombre: oa.actor.nombre,
        rol: oa.actor.rol,
        organizacion: oa.actor.organizacion,
        tipoActor: oa.tipoActor,
      })),
    };
  });

  app.post("/obras/:id/plan/versiones", async (request, reply) => {
    await authGuard(request, ["ADMIN"]);
    const params = z.object({ id: z.string() }).parse(request.params);

    const obra = await prisma.obra.findUnique({
      where: { id: params.id },
      include: {
        hitos: {
          orderBy: { orden: "asc" },
          include: { actividades: { orderBy: { orden: "asc" } } },
        },
      },
    });

    if (!obra) {
      throw new Error("obra no encontrada");
    }

    const lastVersion = await prisma.obraPlanVersion.findFirst({
      where: { obraId: obra.id },
      orderBy: { version: "desc" },
    });
    const nextVersion = (lastVersion?.version ?? 0) + 1;

    const snapshot = {
      obra: {
        id: obra.id,
        nombre: obra.nombre,
        descripcion: obra.descripcion,
        ubicacion: obra.ubicacion,
        encargado: obra.encargado,
        valor: obra.valor,
        fechaInicio: obra.fechaInicio.toISOString(),
        fechaFin: obra.fechaFin.toISOString(),
        estado: obra.estado,
      },
      hitos: obra.hitos.map((hito) => ({
        id: hito.id,
        nombre: hito.nombre,
        descripcion: hito.descripcion,
        fechaInicio: hito.fechaInicio.toISOString(),
        fechaFin: hito.fechaFin.toISOString(),
        orden: hito.orden,
        estado: hito.estado,
        actividades: hito.actividades.map((actividad) => ({
          id: actividad.id,
          nombre: actividad.nombre,
          descripcion: actividad.descripcion,
          fechaInicio: actividad.fechaInicio.toISOString(),
          fechaFin: actividad.fechaFin.toISOString(),
          orden: actividad.orden,
          estado: actividad.estado,
        })),
      })),
    };

    const snapshotHash = createHash("sha256").update(JSON.stringify(snapshot)).digest("hex");
    const receipt = await blockchainService.registrarPlanObra({
      obraId: obra.id,
      version: nextVersion,
      snapshotHash,
      timestamp: Date.now(),
    });

    const version = await prisma.$transaction(async (tx) => {
      await tx.obraPlanVersion.updateMany({
        where: { obraId: obra.id, vigente: true },
        data: { vigente: false },
      });

      return tx.obraPlanVersion.create({
        data: {
          obraId: obra.id,
          version: nextVersion,
          snapshotJson: snapshot,
          snapshotHash,
          txSignature: receipt.txSignature,
          vigente: true,
          createdBy: request.user.sub,
        },
      });
    });

    return reply.code(201).send(version);
  });

  app.post("/hitos", async (request, reply) => {
    await authGuard(request, ["ADMIN"]);

    const body = z
      .object({
        obraId: z.string(),
        nombre: z.string().min(2),
        descripcion: z.string().min(3),
        fechaInicio: z.string().datetime(),
        fechaFin: z.string().datetime(),
        orden: z.number().int().positive(),
      })
      .parse(request.body);

    const hito = await crearHito.execute({
      ...body,
      fechaInicio: new Date(body.fechaInicio),
      fechaFin: new Date(body.fechaFin),
    });

    return reply.code(201).send(hito);
  });

  app.get("/obras/:id/hitos", async (request) => {
    await authGuard(request, ["ADMIN", "FISCALIZADOR", "CIUDADANO"]);
    const params = z.object({ id: z.string() }).parse(request.params);
    return listarHitosObra.execute(params.id);
  });

  app.post("/hitos/:id/actividades", async (request, reply) => {
    await authGuard(request, ["ADMIN"]);
    const params = z.object({ id: z.string() }).parse(request.params);

    const body = z
      .object({
        nombre: z.string().min(2),
        descripcion: z.string().min(3),
        fechaInicio: z.string().datetime(),
        fechaFin: z.string().datetime(),
        orden: z.number().int().positive(),
      })
      .parse(request.body);

    const hito = await hitoRepository.obtenerPorId(params.id);
    if (!hito) {
      throw new Error("hito no encontrado");
    }

    const actividad = await prisma.actividad.create({
      data: {
        hitoId: hito.id,
        nombre: body.nombre,
        descripcion: body.descripcion,
        fechaInicio: new Date(body.fechaInicio),
        fechaFin: new Date(body.fechaFin),
        orden: body.orden,
      },
    });

    return reply.code(201).send(actividad);
  });

  app.get("/hitos/:id/actividades", async (request) => {
    await authGuard(request, ["ADMIN", "FISCALIZADOR", "CIUDADANO"]);
    const params = z.object({ id: z.string() }).parse(request.params);
    return prisma.actividad.findMany({
      where: { hitoId: params.id },
      orderBy: { orden: "asc" },
    });
  });

  app.post("/actividades/:id/comentarios", async (request, reply) => {
    await authGuard(request, ["FISCALIZADOR", "ADMIN"]);

    const params = z.object({ id: z.string() }).parse(request.params);
    const parts = request.parts();

    let texto = "";
    let tipo: "INFO" | "ALERTA" | "AVANCE" | "INCIDENTE" = "INFO";
    let severidad: "LEVE" | "MODERADO" | "GRAVE" | undefined;
    let fechaInspeccion: Date | undefined;
    const files: Array<{ filename: string; mimetype: string; buffer: Buffer }> = [];

    for await (const part of parts) {
      if (part.type === "file") {
        const buffer = await part.toBuffer();
        files.push({ filename: part.filename, mimetype: part.mimetype, buffer });
      } else {
        if (part.fieldname === "texto") texto = String(part.value);
        if (part.fieldname === "tipo") {
          const parsed = z.enum(["INFO", "ALERTA", "AVANCE", "INCIDENTE"]).safeParse(String(part.value));
          if (parsed.success) tipo = parsed.data;
        }
        if (part.fieldname === "severidad") {
          const parsed = z.enum(["LEVE", "MODERADO", "GRAVE"]).safeParse(String(part.value));
          if (parsed.success) severidad = parsed.data;
        }
        if (part.fieldname === "fechaInspeccion") {
          const d = new Date(String(part.value));
          if (!isNaN(d.getTime())) fechaInspeccion = d;
        }
      }
    }

    const comentario = await comentarHito.execute({
      actividadId: params.id,
      usuarioId: request.user.sub,
      texto,
      tipo,
      severidad,
      files,
      fechaInspeccion,
    });

    return reply.code(201).send(comentario);
  });

  app.get("/hitos/:id/comentarios", async (request) => {
    await authGuard(request, ["ADMIN", "FISCALIZADOR", "CIUDADANO"]);
    const params = z.object({ id: z.string() }).parse(request.params);
    return listarComentariosHito.execute(params.id);
  });

  app.get("/actividades/:id/comentarios", async (request) => {
    await authGuard(request, ["ADMIN", "FISCALIZADOR", "CIUDADANO"]);
    const params = z.object({ id: z.string() }).parse(request.params);
    return comentarioRepository.listarPorActividad(params.id);
  });

  app.get("/obras/cercanas", async (request) => {
    await authGuard(request, ["ADMIN", "FISCALIZADOR", "CIUDADANO"]);
    const query = z.object({
      lat: z.string().transform(Number),
      lng: z.string().transform(Number),
    }).parse(request.query);
    const { lat, lng } = query;
    const rows = await prisma.$queryRaw<Array<{
      id: string; nombre: string; descripcion: string; ubicacion: string;
      estado: string; latitud: number; longitud: number; distancia_m: number;
    }>>`
      SELECT * FROM (
        SELECT id, nombre, descripcion, ubicacion, estado, latitud, longitud,
          (6371000 * acos(
            LEAST(1.0,
              cos(radians(${lat})) * cos(radians(latitud)) *
              cos(radians(longitud) - radians(${lng})) +
              sin(radians(${lat})) * sin(radians(latitud))
            )
          )) AS distancia_m
        FROM "Obra"
        WHERE latitud IS NOT NULL AND longitud IS NOT NULL
      ) sub
      WHERE distancia_m <= 100
      ORDER BY distancia_m ASC
    `;
    return rows;
  });

  app.get("/obras/:id/actividades/fiscalizables", async (request) => {
    await authGuard(request, ["ADMIN", "FISCALIZADOR", "CIUDADANO"]);
    const params = z.object({ id: z.string() }).parse(request.params);
    const rows = await prisma.$queryRaw<Array<{
      id: string; nombre: string; descripcion: string;
      fechaInicio: Date; fechaFin: Date; orden: number; estado: string;
      hitoId: string; hitoNombre: string;
    }>>`
      SELECT a.id, a.nombre, a.descripcion, a."fechaInicio", a."fechaFin", a.orden, a.estado,
             h.id AS "hitoId", h.nombre AS "hitoNombre"
      FROM "Actividad" a
      JOIN "Hito" h ON a."hitoId" = h.id
      WHERE h."obraId" = ${params.id}
        AND a."fechaInicio"::date <= CURRENT_DATE
        AND a."fechaFin"::date >= CURRENT_DATE
      ORDER BY h.orden ASC, a.orden ASC
    `;
    return rows;
  });

  app.setErrorHandler((error, _request, reply) => {
    if (error.message === "forbidden") {
      return reply.status(403).send({ message: "forbidden" });
    }

    if (error instanceof z.ZodError) {
      return reply.status(400).send({ message: "validation_error", issues: error.issues });
    }

    return reply.status(400).send({ message: error.message });
  });

  return app;
}
