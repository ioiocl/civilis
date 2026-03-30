import type { ComentarioConEvidencia } from "../../ports/comentario-repository.js";
import type { ComentarioRepository } from "../../ports/comentario-repository.js";

export class ListarComentariosHito {
  constructor(private readonly comentarioRepository: ComentarioRepository) {}

  execute(hitoId: string): Promise<ComentarioConEvidencia[]> {
    return this.comentarioRepository.listarPorHito(hitoId);
  }
}
