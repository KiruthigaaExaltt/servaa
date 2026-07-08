import { writeFileSync, rmSync } from "node:fs";
import { fileURLToPath } from "node:url";
import type { Server } from "node:http";
import app from "./app";
import { logger } from "./lib/logger";
import { connectDatabase, disconnectDatabase } from "@workspace/db";

const runtimePortPath = fileURLToPath(new URL("../.runtime-port", import.meta.url));

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const preferredPort = Number(rawPort);

if (Number.isNaN(preferredPort) || preferredPort <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

function listenOnPort(port: number): Promise<Server> {
  return new Promise((resolve, reject) => {
    const server = app.listen(port);

    server.once("listening", () => resolve(server));
    server.once("error", (error) => reject(error));
  });
}

async function listenWithFallback(startPort: number): Promise<{ server: Server; port: number }> {
  const maxAttempts = Number(process.env.PORT_FALLBACK_ATTEMPTS ?? "20");

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const candidatePort = startPort + attempt;

    try {
      const server = await listenOnPort(candidatePort);
      return { server, port: candidatePort };
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;

      if (code !== "EADDRINUSE") {
        throw error;
      }

      logger.warn(
        { port: candidatePort },
        "Configured port is already in use, trying the next port",
      );
    }
  }

  throw new Error(
    `No free API server port found from ${startPort} to ${startPort + maxAttempts - 1}`,
  );
}

await connectDatabase();
const { server, port } = await listenWithFallback(preferredPort);
writeFileSync(runtimePortPath, `${port}\n`, "utf8");

logger.info(
  { port, preferredPort, runtimePortPath },
  port === preferredPort
    ? "Server listening"
    : "Server listening on fallback port",
);

async function shutdown(signal: string) {
  logger.info({ signal }, "Shutting down");
  server.close(async () => {
    rmSync(runtimePortPath, { force: true });
    await disconnectDatabase();
    process.exit(0);
  });
}
process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("SIGINT", () => void shutdown("SIGINT"));
