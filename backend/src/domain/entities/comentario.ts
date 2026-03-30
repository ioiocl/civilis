export type TipoComentario = "INFO" | "ALERTA" | "AVANCE" | "INCIDENTE";

export interface Comentario {
  id: string;
  hitoId: string;
  actividadId: string | null;
  usuarioId: string;
  planVersionId: string | null;
  planSnapshotHash: string | null;
  texto: string;
  tipo: TipoComentario;
  hashBlockchain: string | null;
  txSignature: string | null;
  createdAt: Date;
}

export interface Evidencia {
  id: string;
  comentarioId: string;
  tipo: string;
  url: string;
  hashArchivo: string;
}
