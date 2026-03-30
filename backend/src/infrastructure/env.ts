function required(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback;
  if (!value) {
    throw new Error(`Missing env var: ${name}`);
  }
  return value;
}

export const env = {
  port: Number(process.env.PORT ?? 3000),
  jwtSecret: required("JWT_SECRET", "change_me"),
  minioEndpoint: required("MINIO_ENDPOINT", "localhost"),
  minioPort: Number(process.env.MINIO_PORT ?? 9000),
  minioAccessKey: required("MINIO_ACCESS_KEY", "minioadmin"),
  minioSecretKey: required("MINIO_SECRET_KEY", "minioadmin"),
  minioBucket: required("MINIO_BUCKET", "obratrack-evidence"),
  minioUseSSL: String(process.env.MINIO_USE_SSL ?? "false") === "true",
  solanaMode: (process.env.SOLANA_NETWORK === "disabled" ? "disabled" : "enabled") as
    | "disabled"
    | "enabled",
  solanaRpcUrl: required("SOLANA_RPC_URL", "https://api.devnet.solana.com"),
  solanaPrivateKey: process.env.SOLANA_PRIVATE_KEY ?? "[]",
  solanaPrivateKeyBase58: process.env.SOLANA_PRIVATE_KEY_BASE58 ?? "",
  solanaCommitment: (process.env.SOLANA_COMMITMENT ?? "confirmed") as
    | "processed"
    | "confirmed"
    | "finalized",
};
