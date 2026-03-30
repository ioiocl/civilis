import type { Obra } from "../../domain/entities/obra.js";
import type { ObraRepository } from "../../ports/obra-repository.js";

export class ObtenerObra {
  constructor(private readonly obraRepository: ObraRepository) {}

  async execute(id: string): Promise<Obra> {
    const obra = await this.obraRepository.obtenerPorId(id);
    if (!obra) {
      throw new Error("obra no encontrada");
    }
    return obra;
  }
}
