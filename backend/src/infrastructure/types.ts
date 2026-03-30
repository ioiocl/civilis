import type { RolUsuario } from "../domain/entities/usuario.js";

declare module "fastify" {
  interface FastifyRequest {
    user: {
      sub: string;
      role: RolUsuario;
    };
  }
}
