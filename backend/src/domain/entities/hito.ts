export type EstadoHito = "PENDIENTE" | "EN_PROGRESO" | "COMPLETADO";

export interface Hito {
  id: string;
  obraId: string;
  nombre: string;
  descripcion: string;
  fechaInicio: Date;
  fechaFin: Date;
  orden: number;
  estado: EstadoHito;
}
