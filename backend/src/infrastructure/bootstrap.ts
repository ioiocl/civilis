import { createHash } from "node:crypto";
import { prisma } from "../adapters/postgres/prisma-client.js";

function hash(password: string): string {
  return createHash("sha256").update(password).digest("hex");
}

function hashInt(value: string): number {
  const hex = createHash("sha256").update(value).digest("hex").slice(0, 8);
  return Number.parseInt(hex, 16);
}

function randomBetweenDates(start: Date, end: Date, seed: string): Date {
  const startMs = start.getTime();
  const endMs = end.getTime();
  const safeEndMs = endMs <= startMs ? startMs + 1 : endMs;
  const ratio = (hashInt(seed) % 10000) / 10000;
  const valueMs = startMs + Math.floor((safeEndMs - startMs) * ratio);
  return new Date(valueMs);
}

function pickBySeed<T>(items: T[], seed: string): T {
  return items[hashInt(seed) % items.length];
}

function splitRange(start: Date, end: Date, index: number, total: number): { start: Date; end: Date } {
  const startMs = start.getTime();
  const endMs = end.getTime();
  const span = Math.max(1, endMs - startMs);
  const segmentStart = startMs + Math.floor((span * index) / total);
  const segmentEnd = startMs + Math.floor((span * (index + 1)) / total);
  return {
    start: new Date(segmentStart),
    end: new Date(Math.max(segmentStart + 1, segmentEnd)),
  };
}

export async function bootstrapDefaults(): Promise<void> {
  const users = [
    { nombre: "Admin Demo", email: "admin@obratrack.local", password: "123456", rol: "ADMIN" as const },
    {
      nombre: "Fiscalizador Demo",
      email: "fiscal@obratrack.local",
      password: "123456",
      rol: "FISCALIZADOR" as const,
    },
    {
      nombre: "Ciudadano Demo",
      email: "ciudadano@obratrack.local",
      password: "123456",
      rol: "CIUDADANO" as const,
    },
  ];

  for (const user of users) {
    await prisma.usuario.upsert({
      where: { email: user.email },
      update: {
        nombre: user.nombre,
        passwordHash: hash(user.password),
        rol: user.rol,
      },
      create: {
        nombre: user.nombre,
        email: user.email,
        passwordHash: hash(user.password),
        rol: user.rol,
      },
    });
  }

  const admin = await prisma.usuario.findUnique({ where: { email: "admin@obratrack.local" } });
  const fiscalizador = await prisma.usuario.findUnique({ where: { email: "fiscal@obratrack.local" } });
  if (!admin) return;

  const actoresSeed = [
    {
      nombre: "Consorcio Vías Urbanas",
      rol: "Contratista Principal",
      organizacion: "Consorcio Vías Urbanas S.A.",
      email: "vias@contratistas.local",
      tipoActor: "CONTRATISTA" as const,
    },
    {
      nombre: "Unidad Técnica Municipal",
      rol: "Entidad Ejecutora",
      organizacion: "Municipalidad Metropolitana",
      email: "utm@municipio.local",
      tipoActor: "ENTIDAD_PUBLICA" as const,
    },
    {
      nombre: "Intervención Norte Ingeniería",
      rol: "Interventoría",
      organizacion: "Intervención Norte Ltda.",
      email: "interventoria@obras.local",
      tipoActor: "INTERVENTOR" as const,
    },
    {
      nombre: "Equipo Fiscalizador Territorial",
      rol: "Fiscalización",
      organizacion: "Veeduría Técnica Ciudadana",
      email: "fiscalizacion@obras.local",
      tipoActor: "FISCALIZADOR" as const,
    },
  ];

  const actores = [] as Array<{ id: string; tipoActor: "CONTRATISTA" | "ENTIDAD_PUBLICA" | "INTERVENTOR" | "FISCALIZADOR" }>;

  for (const actorSeed of actoresSeed) {
    const actor = await prisma.actor.upsert({
      where: { email: actorSeed.email },
      update: {
        nombre: actorSeed.nombre,
        rol: actorSeed.rol,
        organizacion: actorSeed.organizacion,
      },
      create: {
        nombre: actorSeed.nombre,
        rol: actorSeed.rol,
        organizacion: actorSeed.organizacion,
        email: actorSeed.email,
      },
    });

    actores.push({ id: actor.id, tipoActor: actorSeed.tipoActor });
  }

  const obrasSeed = [
    {
      nombre: "Mejoramiento Vial Centro Norte",
      descripcion: "Repavimentación, drenaje pluvial y señalización integral del corredor principal urbano.",
      ubicacion: "Distrito Centro Norte",
      encargado: "Ing. Laura Méndez",
      valor: 2650000,
      fechaInicio: new Date("2026-01-15T00:00:00.000Z"),
      fechaFin: new Date("2026-10-30T00:00:00.000Z"),
      estado: "EN_EJECUCION" as const,
      hitos: [
        {
          nombre: "Topografía y diagnóstico",
          descripcion: "Levantamiento inicial y estado de carpeta asfáltica.",
          fechaInicio: new Date("2026-01-15T00:00:00.000Z"),
          fechaFin: new Date("2026-02-10T00:00:00.000Z"),
          orden: 1,
          estado: "COMPLETADO" as const,
        },
        {
          nombre: "Intervención por tramos",
          descripcion: "Fresado, compactación y nueva mezcla asfáltica.",
          fechaInicio: new Date("2026-02-11T00:00:00.000Z"),
          fechaFin: new Date("2026-08-20T00:00:00.000Z"),
          orden: 2,
          estado: "EN_PROGRESO" as const,
        },
        {
          nombre: "Reposición de drenajes",
          descripcion: "Cámaras, rejillas y cunetas para mitigación de anegamientos.",
          fechaInicio: new Date("2026-05-10T00:00:00.000Z"),
          fechaFin: new Date("2026-08-15T00:00:00.000Z"),
          orden: 3,
          estado: "EN_PROGRESO" as const,
        },
        {
          nombre: "Semaforización inteligente",
          descripcion: "Implementación de controladores y sensores de flujo.",
          fechaInicio: new Date("2026-08-01T00:00:00.000Z"),
          fechaFin: new Date("2026-09-20T00:00:00.000Z"),
          orden: 4,
          estado: "PENDIENTE" as const,
        },
        {
          nombre: "Demarcación final",
          descripcion: "Pintura vial, señalética y entrega técnica.",
          fechaInicio: new Date("2026-09-21T00:00:00.000Z"),
          fechaFin: new Date("2026-10-30T00:00:00.000Z"),
          orden: 5,
          estado: "PENDIENTE" as const,
        },
      ],
    },
    {
      nombre: "Parque Lineal Río Verde",
      descripcion: "Construcción de parque lineal con ciclovía, mobiliario e iluminación.",
      ubicacion: "Sector Río Verde",
      encargado: "Arq. Mateo Rivas",
      valor: 1890000,
      fechaInicio: new Date("2026-03-01T00:00:00.000Z"),
      fechaFin: new Date("2026-12-15T00:00:00.000Z"),
      estado: "EN_EJECUCION" as const,
      hitos: [
        {
          nombre: "Movimiento de suelos",
          descripcion: "Adecuación de terreno, drenajes y contenciones.",
          fechaInicio: new Date("2026-03-01T00:00:00.000Z"),
          fechaFin: new Date("2026-04-25T00:00:00.000Z"),
          orden: 1,
          estado: "COMPLETADO" as const,
        },
        {
          nombre: "Infraestructura principal",
          descripcion: "Senderos, ciclovía e instalación de luminarias.",
          fechaInicio: new Date("2026-04-26T00:00:00.000Z"),
          fechaFin: new Date("2026-10-10T00:00:00.000Z"),
          orden: 2,
          estado: "EN_PROGRESO" as const,
        },
        {
          nombre: "Módulos deportivos",
          descripcion: "Cancha multiuso, estación calistenia y graderías menores.",
          fechaInicio: new Date("2026-08-01T00:00:00.000Z"),
          fechaFin: new Date("2026-10-20T00:00:00.000Z"),
          orden: 3,
          estado: "EN_PROGRESO" as const,
        },
        {
          nombre: "Conectividad y seguridad",
          descripcion: "Cámaras, wifi público y postes de emergencia.",
          fechaInicio: new Date("2026-10-01T00:00:00.000Z"),
          fechaFin: new Date("2026-11-25T00:00:00.000Z"),
          orden: 4,
          estado: "PENDIENTE" as const,
        },
        {
          nombre: "Paisajismo y equipamiento",
          descripcion: "Siembra, juegos infantiles y mobiliario urbano.",
          fechaInicio: new Date("2026-11-01T00:00:00.000Z"),
          fechaFin: new Date("2026-12-15T00:00:00.000Z"),
          orden: 5,
          estado: "PENDIENTE" as const,
        },
      ],
    },
    {
      nombre: "Centro Comunitario San Gabriel",
      descripcion: "Rehabilitación estructural, accesibilidad universal y modernización de espacios comunitarios.",
      ubicacion: "Barrio San Gabriel",
      encargado: "Ing. Camila Ortiz",
      valor: 975000,
      fechaInicio: new Date("2025-02-10T00:00:00.000Z"),
      fechaFin: new Date("2025-11-28T00:00:00.000Z"),
      estado: "FINALIZADA" as const,
      hitos: [
        {
          nombre: "Refuerzo estructural",
          descripcion: "Intervención de vigas, columnas y cubierta principal.",
          fechaInicio: new Date("2025-02-10T00:00:00.000Z"),
          fechaFin: new Date("2025-04-30T00:00:00.000Z"),
          orden: 1,
          estado: "COMPLETADO" as const,
        },
        {
          nombre: "Adecuaciones interiores",
          descripcion: "Aulas, salón multipropósito y baterías sanitarias.",
          fechaInicio: new Date("2025-05-01T00:00:00.000Z"),
          fechaFin: new Date("2025-08-12T00:00:00.000Z"),
          orden: 2,
          estado: "COMPLETADO" as const,
        },
        {
          nombre: "Accesibilidad y urbanismo",
          descripcion: "Rampas, senderos podotáctiles y acceso exterior.",
          fechaInicio: new Date("2025-08-13T00:00:00.000Z"),
          fechaFin: new Date("2025-10-20T00:00:00.000Z"),
          orden: 3,
          estado: "COMPLETADO" as const,
        },
        {
          nombre: "Puesta en marcha",
          descripcion: "Pruebas, recepción y acta de cierre de obra.",
          fechaInicio: new Date("2025-10-21T00:00:00.000Z"),
          fechaFin: new Date("2025-11-28T00:00:00.000Z"),
          orden: 4,
          estado: "COMPLETADO" as const,
        },
      ],
    },
  ];

  for (const obraSeed of obrasSeed) {
    let obra = await prisma.obra.findFirst({
      where: {
        nombre: obraSeed.nombre,
        ubicacion: obraSeed.ubicacion,
      },
    });

    if (!obra) {
      obra = await prisma.obra.create({
        data: {
          nombre: obraSeed.nombre,
          descripcion: obraSeed.descripcion,
          ubicacion: obraSeed.ubicacion,
          encargado: obraSeed.encargado,
          valor: obraSeed.valor,
          fechaInicio: obraSeed.fechaInicio,
          fechaFin: obraSeed.fechaFin,
          estado: obraSeed.estado,
          creadoPor: admin.id,
        },
      });
    } else {
      obra = await prisma.obra.update({
        where: { id: obra.id },
        data: {
          descripcion: obraSeed.descripcion,
          encargado: obraSeed.encargado,
          valor: obraSeed.valor,
          fechaInicio: obraSeed.fechaInicio,
          fechaFin: obraSeed.fechaFin,
          estado: obraSeed.estado,
        },
      });
    }

    for (const actor of actores) {
      await prisma.obraActor.upsert({
        where: {
          obraId_actorId_tipoActor: {
            obraId: obra.id,
            actorId: actor.id,
            tipoActor: actor.tipoActor,
          },
        },
        update: {},
        create: {
          obraId: obra.id,
          actorId: actor.id,
          tipoActor: actor.tipoActor,
        },
      });
    }

    const existingHitos = await prisma.hito.findMany({
      where: { obraId: obra.id },
      select: { id: true },
    });

    if (existingHitos.length > 0) {
      const hitoIds = existingHitos.map((h) => h.id);
      await prisma.evidencia.deleteMany({
        where: {
          comentario: {
            hitoId: { in: hitoIds },
          },
        },
      });
      await prisma.comentario.deleteMany({
        where: { hitoId: { in: hitoIds } },
      });
      await prisma.hito.deleteMany({
        where: { id: { in: hitoIds } },
      });
    }

    for (const hitoSeed of obraSeed.hitos) {
      const hito = await prisma.hito.create({
        data: {
          obraId: obra.id,
          nombre: hitoSeed.nombre,
          descripcion: hitoSeed.descripcion,
          fechaInicio: hitoSeed.fechaInicio,
          fechaFin: hitoSeed.fechaFin,
          orden: hitoSeed.orden,
          estado: hitoSeed.estado,
        },
      });

      const activityNames = ["Preparación", "Ejecución", "Cierre técnico"];
      for (let i = 0; i < activityNames.length; i++) {
        const range = splitRange(hitoSeed.fechaInicio, hitoSeed.fechaFin, i, activityNames.length);
        await prisma.actividad.create({
          data: {
            hitoId: hito.id,
            nombre: `${activityNames[i]} - ${hitoSeed.nombre}`,
            descripcion: `${activityNames[i]} de la fase ${hitoSeed.nombre.toLowerCase()}.`,
            fechaInicio: range.start,
            fechaFin: range.end,
            orden: i + 1,
            estado: hitoSeed.estado,
          },
        });
      }
    }

    const hitosObra = await prisma.hito.findMany({
      where: { obraId: obra.id },
      include: { actividades: { orderBy: { orden: "asc" } } },
      orderBy: { orden: "asc" },
    });

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
      hitos: hitosObra.map((hito) => ({
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

    await prisma.obraPlanVersion.deleteMany({ where: { obraId: obra.id } });

    const seededPlanVersion = await prisma.obraPlanVersion.create({
      data: {
        obraId: obra.id,
        version: 1,
        snapshotJson: snapshot,
        snapshotHash,
        txSignature: `seed-plan-${obra.id}-1`,
        vigente: true,
        createdBy: admin.id,
      },
    });

    if (fiscalizador) {
      const commentTemplates = [
        "Se valida avance de %{actividad}; cuadrilla operando con dotación completa.",
        "Fiscalización de %{actividad}: cumplimiento técnico dentro de parámetros esperados.",
        "Se revisa frente de %{actividad}; no se identifican desvíos críticos al corte.",
        "Visita de control en %{actividad}; progreso consistente con cronograma contractual.",
        "Registro fotográfico de %{actividad}; se recomienda mantener ritmo actual de ejecución.",
      ];
      const photos = [
        "https://images.unsplash.com/photo-1599707367072-cd6ada2bc375?auto=format&fit=crop&w=1200&q=80",
        "https://images.unsplash.com/photo-1489515217757-5fd1be406fef?auto=format&fit=crop&w=1200&q=80",
        "https://images.unsplash.com/photo-1504307651254-35680f356dfd?auto=format&fit=crop&w=1200&q=80",
        "https://images.unsplash.com/photo-1581093806997-124204d9fa9d?auto=format&fit=crop&w=1200&q=80",
      ];
      const tipos = ["INFO", "AVANCE", "INFO", "AVANCE", "ALERTA"] as const;

      for (const hitoTarget of hitosObra) {
        for (const actividadTarget of hitoTarget.actividades) {
          const minByActividad = 2;
          const maxByActividad = 3;
          const commentsByActividad =
            minByActividad +
            (hashInt(`count-${obra.id}-${hitoTarget.id}-${actividadTarget.id}`) % (maxByActividad - minByActividad + 1));

          for (let i = 0; i < commentsByActividad; i++) {
            const template = pickBySeed(commentTemplates, `${obra.id}-${actividadTarget.id}-tpl-${i}`);
            const texto = template.replace("%{actividad}", actividadTarget.nombre.toLowerCase());
            const fotoUrl = pickBySeed(photos, `${obra.id}-${actividadTarget.id}-photo-${i}`);
            const tipo = pickBySeed([...tipos], `${obra.id}-${actividadTarget.id}-tipo-${i}`);
            const createdAt = randomBetweenDates(
              actividadTarget.fechaInicio,
              actividadTarget.fechaFin,
              `${obra.id}-date-${actividadTarget.id}-${i}`,
            );
            const txSignature = `seed-auto-${obra.id}-${hitoTarget.orden}-${actividadTarget.orden}-${i}`;

            const comentario = await prisma.comentario.create({
              data: {
                hitoId: hitoTarget.id,
                actividadId: actividadTarget.id,
                usuarioId: fiscalizador.id,
                planVersionId: seededPlanVersion.id,
                planSnapshotHash: seededPlanVersion.snapshotHash,
                texto,
                tipo,
                hashBlockchain: createHash("sha256").update(texto).digest("hex"),
                txSignature,
                createdAt,
              },
            });

            await prisma.evidencia.create({
              data: {
                comentarioId: comentario.id,
                tipo: "IMAGEN",
                url: fotoUrl,
                hashArchivo: createHash("sha256").update(fotoUrl).digest("hex"),
              },
            });
          }
        }
      }
    }
  }
}
