export type RolUsuario = "ADMIN" | "FISCALIZADOR" | "CIUDADANO";

export interface Usuario {
  id: string;
  nombre: string;
  email: string;
  passwordHash: string;
  rol: RolUsuario;
  createdAt: Date;
}
