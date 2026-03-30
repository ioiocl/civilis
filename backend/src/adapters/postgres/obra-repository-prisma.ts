import type { Obra, EstadoObra } from "../../domain/entities/obra.js";
import type { CrearObraInput, ObraRepository } from "../../ports/obra-repository.js";
import { prisma } from "./prisma-client.js";

function mapEstado(value: string): EstadoObra {
  return value as EstadoObra;
}

function mapObra(row: any): Obra {
  return {
    id: row.id,
    nombre: row.nombre,
    descripcion: row.descripcion,
    ubicacion: row.ubicacion,
    encargado: row.encargado,
    valor: row.valor,
    fechaInicio: row.fechaInicio,
    fechaFin: row.fechaFin,
    estado: mapEstado(row.estado),
    creadoPor: row.creadoPor,
    createdAt: row.createdAt,
  };
}

export class ObraRepositoryPrisma implements ObraRepository {
  async crear(data: CrearObraInput): Promise<Obra> {
    const row = await prisma.obra.create({
      data: {
        nombre: data.nombre,
        descripcion: data.descripcion,
        ubicacion: data.ubicacion,
        encargado: data.encargado,
        valor: data.valor,
        fechaInicio: data.fechaInicio,
        fechaFin: data.fechaFin,
        creadoPor: data.creadoPor,
      },
    });

    return mapObra(row);
  }

  async listar(): Promise<Obra[]> {
    const rows = await prisma.obra.findMany({ orderBy: { createdAt: "desc" } });
    return rows.map(mapObra);
  }

  async obtenerPorId(id: string): Promise<Obra | null> {
    const row = await prisma.obra.findUnique({ where: { id } });
    return row ? mapObra(row) : null;
  }
}
