# ObraTrack (MVP)

Aplicación tipo “Waze de obras públicas” para visualizar avance de obras, hitos y comentarios de fiscalización con evidencia.

## Stack

- Frontend: Next.js + React + TypeScript + Tailwind
- Backend: Node.js 22 + Fastify + Prisma + Hexagonal Architecture
- Datos: PostgreSQL
- Evidencias: MinIO (S3 compatible)
- Integridad: Solana (`@solana/web3.js`, modo `disabled` por defecto)
- Infra: Docker Compose

## Levantar en local

```bash
docker compose up --build
```

Servicios:

- Frontend: `http://localhost:5173`
- Backend: `http://localhost:3000`
- MinIO Console: `http://localhost:9001` (`minioadmin` / `minioadmin`)
- Postgres: `localhost:5432`

## Usuarios demo (autocreados)

- Admin: `admin@obratrack.local` / `123456`
- Fiscalizador: `fiscal@obratrack.local` / `123456`
- Ciudadano: `ciudadano@obratrack.local` / `123456`

## Endpoints base

- `POST /auth/register`
- `POST /auth/login`
- `POST /obras`
- `GET /obras`
- `GET /obras/:id`
- `POST /hitos`
- `GET /obras/:id/hitos`
- `POST /hitos/:id/comentarios` (multipart)
- `GET /hitos/:id/comentarios`

## Notas Solana

- `SOLANA_NETWORK=disabled` usa receipt mock.
- Para habilitar envío real, configurar:
  - `SOLANA_NETWORK=enabled`
  - `SOLANA_PRIVATE_KEY` (array JSON de bytes)
  - `SOLANA_RPC_URL` (ej: devnet)
