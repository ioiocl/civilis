import type { Hito } from "../../domain/entities/hito.js";
import type { HitoRepository } from "../../ports/hito-repository.js";
import type { ObraRepository } from "../../ports/obra-repository.js";

export class CrearHito {
  constructor(
    private readonly hitoRepository: HitoRepository,
    private readonly obraRepository: ObraRepository,
  ) {}

  async execute(input: {
    obraId: string;
    nombre: string;
    descripcion: string;
    fechaInicio: Date;
    fechaFin: Date;
    orden: number;
  }): Promise<Hito> {
    const obra = await this.obraRepository.obtenerPorId(input.obraId);
    if (!obra) {
      throw new Error("obra no encontrada");
    }

    if (input.fechaFin < input.fechaInicio) {
      throw new Error("fecha_fin debe ser mayor o igual a fecha_inicio");
    }

    return this.hitoRepository.crear(input);
  }
}
