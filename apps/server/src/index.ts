import { createVideur } from "@videur/core";
import { createApp } from "./app";

const videur = createVideur();
const app = createApp(videur);

const server = Bun.serve({
  hostname: videur.config.host,
  port: videur.config.port,
  fetch: app.fetch,
  idleTimeout: 120,
  maxRequestBodySize: 110 * 1024 * 1024,
});

videur.logger.info(`Videur ${videur.version} escuchando en http://${videur.config.host}:${videur.config.port}`);
videur.logger.info(`Datos: ${videur.config.dataDir}`);
videur.logger.info(`Sandbox: ${videur.config.sandboxMode}`);

async function shutdown(signal: string): Promise<void> {
  videur.logger.info(`Recibido ${signal}; cerrando…`);
  try {
    server.stop(true);
    await videur.close();
  } finally {
    process.exit(0);
  }
}

process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));
