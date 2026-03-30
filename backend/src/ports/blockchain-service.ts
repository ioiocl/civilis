export interface BlockchainPayload {
  obraId: string;
  hitoId: string;
  actividadId?: string;
  usuarioId: string;
  comentarioHash: string;
  evidenciasHash: string;
  timestamp: number;
}

export interface BlockchainPlanPayload {
  obraId: string;
  version: number;
  snapshotHash: string;
  timestamp: number;
}

export interface BlockchainReceipt {
  chainHash: string;
  txSignature: string;
}

export interface BlockchainService {
  registrarComentario(payload: BlockchainPayload): Promise<BlockchainReceipt>;
  registrarPlanObra(payload: BlockchainPlanPayload): Promise<BlockchainReceipt>;
}
