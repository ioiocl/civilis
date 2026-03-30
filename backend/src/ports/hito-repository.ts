import type { Hito } from "../domain/entities/hito.js";

export interface CrearHitoInput {
  obraId: string;
  nombre: string;
  descripcion: string;
  fechaInicio: Date;
  fechaFin: Date;
  orden: number;
}

export interface HitoRepository {
  crear(data: CrearHitoInput): Promise<Hito>;
  listarPorObra(obraId: string): Promise<Hito[]>;
  obtenerPorId(id: string): Promise<Hito | null>;
}
