import { createHash, timingSafeEqual } from "node:crypto";
import type { RolUsuario, Usuario } from "../../domain/entities/usuario.js";
import type { UsuarioRepository } from "../../ports/usuario-repository.js";

export class AuthUseCase {
  constructor(private readonly usuarioRepository: UsuarioRepository) {}

  async register(input: {
    nombre: string;
    email: string;
    password: string;
    rol: RolUsuario;
  }): Promise<Usuario> {
    const existing = await this.usuarioRepository.obtenerPorEmail(input.email);
    if (existing) {
      throw new Error("email ya registrado");
    }

    const passwordHash = createHash("sha256").update(input.password).digest("hex");

    return this.usuarioRepository.crear({
      nombre: input.nombre,
      email: input.email,
      passwordHash,
      rol: input.rol,
    });
  }

  async login(input: { email: string; password: string }): Promise<Usuario> {
    const user = await this.usuarioRepository.obtenerPorEmail(input.email);
    if (!user) {
      throw new Error("credenciales inválidas");
    }

    const incoming = createHash("sha256").update(input.password).digest("hex");
    const equals = timingSafeEqual(Buffer.from(incoming), Buffer.from(user.passwordHash));

    if (!equals) {
      throw new Error("credenciales inválidas");
    }

    return user;
  }
}
