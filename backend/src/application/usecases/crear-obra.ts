import type { Obra } from "../../domain/entities/obra.js";
import type { ObraRepository } from "../../ports/obra-repository.js";

export class CrearObra {
  constructor(private readonly obraRepository: ObraRepository) {}

  async execute(input: {
    nombre: string;
    descripcion: string;
    ubicacion: string;
    encargado: string;
    valor: number;
    fechaInicio: Date;
    fechaFin: Date;
    creadoPor: string;
  }): Promise<Obra> {
    if (input.fechaFin < input.fechaInicio) {
      throw new Error("fecha_fin debe ser mayor o igual a fecha_inicio");
    }

    return this.obraRepository.crear(input);
  }
}
