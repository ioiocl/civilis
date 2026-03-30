import { buildServer } from "./infrastructure/server.js";
import { env } from "./infrastructure/env.js";
import { bootstrapDefaults } from "./infrastructure/bootstrap.js";

async function main() {
  await bootstrapDefaults();
  const app = buildServer();
  await app.listen({ host: "0.0.0.0", port: env.port });
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
