export type EstadoObra = "PLANIFICADA" | "EN_EJECUCION" | "PAUSADA" | "FINALIZADA";

export interface Obra {
  id: string;
  nombre: string;
  descripcion: string;
  ubicacion: string;
  encargado: string;
  valor: number;
  fechaInicio: Date;
  fechaFin: Date;
  estado: EstadoObra;
  creadoPor: string;
  createdAt: Date;
}
