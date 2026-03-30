import type { Hito, EstadoHito } from "../../domain/entities/hito.js";
import type { CrearHitoInput, HitoRepository } from "../../ports/hito-repository.js";
import { prisma } from "./prisma-client.js";

function mapEstado(value: string): EstadoHito {
  return value as EstadoHito;
}

function mapHito(row: any): Hito {
  return {
    id: row.id,
    obraId: row.obraId,
    nombre: row.nombre,
    descripcion: row.descripcion,
    fechaInicio: row.fechaInicio,
    fechaFin: row.fechaFin,
    orden: row.orden,
    estado: mapEstado(row.estado),
  };
}

export class HitoRepositoryPrisma implements HitoRepository {
  async crear(data: CrearHitoInput): Promise<Hito> {
    const row = await prisma.hito.create({
      data: {
        obraId: data.obraId,
        nombre: data.nombre,
        descripcion: data.descripcion,
        fechaInicio: data.fechaInicio,
        fechaFin: data.fechaFin,
        orden: data.orden,
      },
    });

    return mapHito(row);
  }

  async listarPorObra(obraId: string): Promise<Hito[]> {
    const rows = await prisma.hito.findMany({
      where: { obraId },
      orderBy: { orden: "asc" },
    });

    return rows.map(mapHito);
  }

  async obtenerPorId(id: string): Promise<Hito | null> {
    const row = await prisma.hito.findUnique({ where: { id } });
    return row ? mapHito(row) : null;
  }
}
