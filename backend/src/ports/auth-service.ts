import type { RolUsuario } from "../domain/entities/usuario.js";

export interface JwtPayload {
  sub: string;
  role: RolUsuario;
}

export interface AuthService {
  hashPassword(password: string): Promise<string>;
  verifyPassword(password: string, hash: string): Promise<boolean>;
}
