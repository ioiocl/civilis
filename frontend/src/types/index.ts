export type RolUsuario = "ADMIN" | "FISCALIZADOR" | "CIUDADANO";

export interface UserSession {
  token: string;
  user: {
    id: string;
    nombre: string;
    email: string;
    rol: RolUsuario;
  };
}

export interface Obra {
  id: string;
  nombre: string;
  descripcion: string;
  ubicacion: string;
  encargado: string;
  valor: number;
  fechaInicio: string;
  fechaFin: string;
  estado: string;
}

export interface Actividad {
  id: string;
  hitoId: string;
  nombre: string;
  descripcion: string;
  fechaInicio: string;
  fechaFin: string;
  orden: number;
  estado: string;
}

export interface ObraActorGeneral {
  id: string;
  nombre: string;
  rol: string;
  organizacion: string;
  tipoActor: string;
}

export interface ObraGeneral {
  id: string;
  nombre: string;
  descripcion: string;
  ubicacion: string;
  encargado: string;
  valor: number;
  fechaInicio: string;
  fechaFin: string;
  estado: string;
  actores: ObraActorGeneral[];
}

export interface Hito {
  id: string;
  obraId: string;
  nombre: string;
  descripcion: string;
  fechaInicio: string;
  fechaFin: string;
  orden: number;
  estado: string;
}

export interface Evidencia {
  id: string;
  comentarioId: string;
  tipo: string;
  url: string;
  hashArchivo: string;
}

export interface Comentario {
  id: string;
  hitoId: string;
  actividadId: string | null;
  usuarioId: string;
  texto: string;
  tipo: string;
  severidad: "LEVE" | "MODERADO" | "GRAVE";
  hashBlockchain: string | null;
  txSignature: string | null;
  fechaInspeccion: string | null;
  createdAt: string;
  evidencias: Evidencia[];
  respuestas?: RespuestaComentario[];
}

export interface RespuestaComentario {
  id: string;
  comentarioId: string;
  usuarioId: string;
  usuarioNombre: string;
  texto: string;
  createdAt: string;
}

export interface Notificacion {
  id: string;
  usuarioId: string;
  tipo: "NUEVO_COMENTARIO" | "NUEVA_RESPUESTA";
  mensaje: string;
  obraId: string;
  obraNombre: string;
  comentarioId?: string;
  leida: boolean;
  createdAt: string;
}
