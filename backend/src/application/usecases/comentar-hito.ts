import { createHash } from "node:crypto";
import type { ComentarioConEvidencia } from "../../ports/comentario-repository.js";
import type { BlockchainService } from "../../ports/blockchain-service.js";
import type { ComentarioRepository } from "../../ports/comentario-repository.js";
import type { FileStorage } from "../../ports/file-storage.js";
import type { ObraRepository } from "../../ports/obra-repository.js";
import { prisma } from "../../adapters/postgres/prisma-client.js";

interface IncomingFile {
  filename: string;
  mimetype: string;
  buffer: Buffer;
}

export class ComentarHito {
  constructor(
    private readonly comentarioRepository: ComentarioRepository,
    private readonly obraRepository: ObraRepository,
    private readonly fileStorage: FileStorage,
    private readonly blockchainService: BlockchainService,
  ) {}

  async execute(input: {
    actividadId: string;
    usuarioId: string;
    texto: string;
    tipo: "INFO" | "ALERTA" | "AVANCE" | "INCIDENTE";
    files: IncomingFile[];
  }): Promise<ComentarioConEvidencia> {
    const actividad = await prisma.actividad.findUnique({
      where: { id: input.actividadId },
      include: { hito: true },
    });
    if (!actividad) {
      throw new Error("actividad no encontrada");
    }

    const hito = actividad.hito;

    const obra = await this.obraRepository.obtenerPorId(hito.obraId);
    if (!obra) {
      throw new Error("obra no encontrada");
    }

    const planVersion = await prisma.obraPlanVersion.findFirst({
      where: { obraId: obra.id, vigente: true },
      orderBy: { version: "desc" },
    });

    if (!planVersion) {
      throw new Error("no existe una version de plan vigente para esta obra");
    }

    const comentarioHash = createHash("sha256").update(input.texto).digest("hex");

    const uploaded = await Promise.all(
      input.files.map(async (file) => {
        const fileHash = createHash("sha256").update(file.buffer).digest("hex");
        const key = `obras/${obra.id}/hitos/${hito.id}/evidencias/${Date.now()}-${file.filename}`;
        const result = await this.fileStorage.upload({
          key,
          body: file.buffer,
          contentType: file.mimetype,
        });

        return {
          tipo: file.mimetype.startsWith("video/") ? "VIDEO" : "IMAGEN",
          url: result.url,
          hashArchivo: fileHash,
        };
      }),
    );

    const evidenciasConcat = uploaded.map((u) => u.hashArchivo).join("|");
    const evidenciasHash = createHash("sha256").update(evidenciasConcat).digest("hex");

    const receipt = await this.blockchainService.registrarComentario({
      obraId: obra.id,
      hitoId: hito.id,
      actividadId: actividad.id,
      usuarioId: input.usuarioId,
      comentarioHash,
      evidenciasHash,
      timestamp: Date.now(),
    });

    const comentario = await this.comentarioRepository.crear({
      hitoId: hito.id,
      actividadId: actividad.id,
      usuarioId: input.usuarioId,
      planVersionId: planVersion.id,
      planSnapshotHash: planVersion.snapshotHash,
      texto: input.texto,
      tipo: input.tipo,
      hashBlockchain: receipt.chainHash,
      txSignature: receipt.txSignature,
    });

    await this.comentarioRepository.crearEvidencias(
      uploaded.map((u) => ({
        comentarioId: comentario.id,
        tipo: u.tipo,
        url: u.url,
        hashArchivo: u.hashArchivo,
      })),
    );

    const list = await this.comentarioRepository.listarPorActividad(actividad.id);
    const finalComentario = list.find((c) => c.id === comentario.id);
    if (!finalComentario) {
      throw new Error("comentario no encontrado luego de crearse");
    }

    return finalComentario;
  }
}
