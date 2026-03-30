import type { Comentario, Evidencia, TipoComentario } from "../../domain/entities/comentario.js";
import type {
  ComentarioConEvidencia,
  ComentarioRepository,
  CrearComentarioInput,
  CrearEvidenciaInput,
} from "../../ports/comentario-repository.js";
import { prisma } from "./prisma-client.js";

function mapTipo(value: string): TipoComentario {
  return value as TipoComentario;
}

function mapComentario(row: any): Comentario {
  return {
    id: row.id,
    hitoId: row.hitoId,
    actividadId: row.actividadId,
    usuarioId: row.usuarioId,
    planVersionId: row.planVersionId,
    planSnapshotHash: row.planSnapshotHash,
    texto: row.texto,
    tipo: mapTipo(row.tipo),
    hashBlockchain: row.hashBlockchain,
    txSignature: row.txSignature,
    createdAt: row.createdAt,
  };
}

function mapEvidencia(row: any): Evidencia {
  return {
    id: row.id,
    comentarioId: row.comentarioId,
    tipo: row.tipo,
    url: row.url,
    hashArchivo: row.hashArchivo,
  };
}

export class ComentarioRepositoryPrisma implements ComentarioRepository {
  async crear(data: CrearComentarioInput): Promise<Comentario> {
    const row = await prisma.comentario.create({
      data: {
        hitoId: data.hitoId,
        actividadId: data.actividadId,
        usuarioId: data.usuarioId,
        planVersionId: data.planVersionId,
        planSnapshotHash: data.planSnapshotHash,
        texto: data.texto,
        tipo: data.tipo,
        hashBlockchain: data.hashBlockchain,
        txSignature: data.txSignature,
      },
    });

    return mapComentario(row);
  }

  async crearEvidencias(data: CrearEvidenciaInput[]): Promise<void> {
    if (data.length === 0) return;

    await prisma.evidencia.createMany({ data });
  }

  async listarPorHito(hitoId: string): Promise<ComentarioConEvidencia[]> {
    const rows = await prisma.comentario.findMany({
      where: { hitoId },
      include: { evidencias: true },
      orderBy: { createdAt: "desc" },
    });

    return rows.map((row) => ({
      ...mapComentario(row),
      evidencias: row.evidencias.map(mapEvidencia),
    }));
  }

  async listarPorActividad(actividadId: string): Promise<ComentarioConEvidencia[]> {
    const rows = await prisma.comentario.findMany({
      where: { actividadId },
      include: { evidencias: true },
      orderBy: { createdAt: "desc" },
    });

    return rows.map((row) => ({
      ...mapComentario(row),
      evidencias: row.evidencias.map(mapEvidencia),
    }));
  }
}
