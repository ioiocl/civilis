import type { Obra } from "../domain/entities/obra.js";

export interface CrearObraInput {
  nombre: string;
  descripcion: string;
  ubicacion: string;
  encargado: string;
  valor: number;
  fechaInicio: Date;
  fechaFin: Date;
  creadoPor: string;
}

export interface ObraRepository {
  crear(data: CrearObraInput): Promise<Obra>;
  listar(): Promise<Obra[]>;
  obtenerPorId(id: string): Promise<Obra | null>;
}
