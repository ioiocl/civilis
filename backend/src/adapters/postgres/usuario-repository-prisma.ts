import type { RolUsuario, Usuario } from "../../domain/entities/usuario.js";
import type { CrearUsuarioInput, UsuarioRepository } from "../../ports/usuario-repository.js";
import { prisma } from "./prisma-client.js";

function mapRol(value: string): RolUsuario {
  return value as RolUsuario;
}

function mapUsuario(row: any): Usuario {
  return {
    id: row.id,
    nombre: row.nombre,
    email: row.email,
    passwordHash: row.passwordHash,
    rol: mapRol(row.rol),
    createdAt: row.createdAt,
  };
}

export class UsuarioRepositoryPrisma implements UsuarioRepository {
  async crear(data: CrearUsuarioInput): Promise<Usuario> {
    const row = await prisma.usuario.create({
      data: {
        nombre: data.nombre,
        email: data.email,
        passwordHash: data.passwordHash,
        rol: data.rol,
      },
    });

    return mapUsuario(row);
  }

  async obtenerPorEmail(email: string): Promise<Usuario | null> {
    const row = await prisma.usuario.findUnique({ where: { email } });
    return row ? mapUsuario(row) : null;
  }

  async obtenerPorId(id: string): Promise<Usuario | null> {
    const row = await prisma.usuario.findUnique({ where: { id } });
    return row ? mapUsuario(row) : null;
  }
}
