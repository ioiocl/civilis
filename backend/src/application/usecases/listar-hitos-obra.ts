import type { Hito } from "../../domain/entities/hito.js";
import type { HitoRepository } from "../../ports/hito-repository.js";

export class ListarHitosObra {
  constructor(private readonly hitoRepository: HitoRepository) {}

  execute(obraId: string): Promise<Hito[]> {
    return this.hitoRepository.listarPorObra(obraId);
  }
}
