import type { RolUsuario, Usuario } from "../domain/entities/usuario.js";

export interface CrearUsuarioInput {
  nombre: string;
  email: string;
  passwordHash: string;
  rol: RolUsuario;
}

export interface UsuarioRepository {
  crear(data: CrearUsuarioInput): Promise<Usuario>;
  obtenerPorEmail(email: string): Promise<Usuario | null>;
  obtenerPorId(id: string): Promise<Usuario | null>;
}
