import type { Comentario, Evidencia } from "../domain/entities/comentario.js";
import type { SeveridadComentario, TipoComentario } from "../domain/entities/comentario.js";

export interface CrearComentarioInput {
  hitoId: string;
  actividadId?: string;
  usuarioId: string;
  planVersionId?: string;
  planSnapshotHash?: string;
  texto: string;
  tipo: TipoComentario;
  severidad?: SeveridadComentario;
  hashBlockchain?: string;
  txSignature?: string;
  fechaInspeccion?: Date;
}

export interface CrearEvidenciaInput {
  comentarioId: string;
  tipo: string;
  url: string;
  hashArchivo: string;
}

export interface ComentarioConEvidencia extends Comentario {
  evidencias: Evidencia[];
}

export interface ComentarioRepository {
  crear(data: CrearComentarioInput): Promise<Comentario>;
  crearEvidencias(data: CrearEvidenciaInput[]): Promise<void>;
  listarPorHito(hitoId: string): Promise<ComentarioConEvidencia[]>;
  listarPorActividad(actividadId: string): Promise<ComentarioConEvidencia[]>;
}
