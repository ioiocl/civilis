import { createHash } from "node:crypto";
import {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
  TransactionInstruction,
  sendAndConfirmTransaction,
} from "@solana/web3.js";
import bs58 from "bs58";
import type {
  BlockchainPlanPayload,
  BlockchainPayload,
  BlockchainReceipt,
  BlockchainService,
} from "../../ports/blockchain-service.js";

const MEMO_PROGRAM_ID = new PublicKey("MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr");

export class SolanaBlockchainService implements BlockchainService {
  private readonly mode: "disabled" | "enabled";
  private readonly connection: Connection | null;
  private readonly signer: Keypair | null;

  constructor(params: {
    mode: "disabled" | "enabled";
    rpcUrl: string;
    secretKey: number[];
    secretKeyBase58?: string;
    commitment?: "processed" | "confirmed" | "finalized";
  }) {
    this.mode = params.mode;

    if (params.mode === "disabled") {
      this.connection = null;
      this.signer = null;
      return;
    }

    this.connection = new Connection(params.rpcUrl, params.commitment ?? "confirmed");
    const decodedSecretKey = params.secretKeyBase58
      ? bs58.decode(params.secretKeyBase58)
      : Uint8Array.from(params.secretKey);
    this.signer = Keypair.fromSecretKey(decodedSecretKey);
  }

  async registrarComentario(payload: BlockchainPayload): Promise<BlockchainReceipt> {
    const chainHash = createHash("sha256").update(JSON.stringify(payload)).digest("hex");

    if (this.mode === "disabled" || !this.connection || !this.signer) {
      return {
        chainHash,
        txSignature: `mock-${chainHash.slice(0, 20)}`,
      };
    }

    const memo = JSON.stringify({
      type: "comentario_evidencia",
      ...payload,
      chainHash,
    });

    const memoIx = new TransactionInstruction({
      keys: [],
      programId: MEMO_PROGRAM_ID,
      data: Buffer.from(memo, "utf-8"),
    });

    const noopIx = SystemProgram.transfer({
      fromPubkey: this.signer.publicKey,
      toPubkey: this.signer.publicKey,
      lamports: 0,
    });

    const tx = new Transaction().add(noopIx, memoIx);

    const txSignature = await sendAndConfirmTransaction(this.connection, tx, [this.signer]);

    return {
      chainHash,
      txSignature,
    };
  }

  async registrarPlanObra(payload: BlockchainPlanPayload): Promise<BlockchainReceipt> {
    const chainHash = createHash("sha256").update(JSON.stringify(payload)).digest("hex");

    if (this.mode === "disabled" || !this.connection || !this.signer) {
      return {
        chainHash,
        txSignature: `mock-${chainHash.slice(0, 20)}`,
      };
    }

    const memo = JSON.stringify({
      type: "obra_plan_version",
      ...payload,
      chainHash,
    });

    const memoIx = new TransactionInstruction({
      keys: [],
      programId: MEMO_PROGRAM_ID,
      data: Buffer.from(memo, "utf-8"),
    });

    const noopIx = SystemProgram.transfer({
      fromPubkey: this.signer.publicKey,
      toPubkey: this.signer.publicKey,
      lamports: 0,
    });

    const tx = new Transaction().add(noopIx, memoIx);

    const txSignature = await sendAndConfirmTransaction(this.connection, tx, [this.signer]);

    return {
      chainHash,
      txSignature,
    };
  }
}
