import type { Obra } from "../../domain/entities/obra.js";
import type { ObraRepository } from "../../ports/obra-repository.js";

export class ListarObras {
  constructor(private readonly obraRepository: ObraRepository) {}

  execute(): Promise<Obra[]> {
    return this.obraRepository.listar();
  }
}
