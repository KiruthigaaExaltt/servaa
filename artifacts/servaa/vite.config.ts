import fs from "node:fs";
import net from "node:net";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";

const rawPort = process.env.PORT ?? "20279";

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

const basePath = process.env.BASE_PATH ?? "/";

const apiServerEnvPath = path.resolve(
  import.meta.dirname,
  "..",
  "api-server",
  ".env",
);
const apiServerRuntimePortPath = path.resolve(
  import.meta.dirname,
  "..",
  "api-server",
  ".runtime-port",
);

function readEnvFile(filePath: string): Record<string, string> {
  if (!fs.existsSync(filePath)) {
    throw new Error(
      `API server .env was not found at ${filePath}. Create it from .env.example and set PORT.`,
    );
  }

  return Object.fromEntries(
    fs
      .readFileSync(filePath, "utf8")
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith("#"))
      .map((line) => {
        const separatorIndex = line.indexOf("=");
        if (separatorIndex === -1) return ["", ""];
        const key = line.slice(0, separatorIndex).trim();
        const value = line
          .slice(separatorIndex + 1)
          .trim()
          .replace(/^['"]|['"]$/g, "");
        return [key, value];
      })
      .filter(([key]) => key),
  );
}

function readPortFile(filePath: string): number | undefined {
  if (!fs.existsSync(filePath)) return undefined;

  const port = Number(fs.readFileSync(filePath, "utf8").trim());
  return Number.isNaN(port) || port <= 0 ? undefined : port;
}

async function resolveApiProxyTarget(): Promise<{ host: string; port: number; target: string; source: string }> {
  const apiEnv = readEnvFile(apiServerEnvPath);
  const rawBackendPort = apiEnv.PORT;
  const backendPort = Number(rawBackendPort);

  if (!rawBackendPort || Number.isNaN(backendPort) || backendPort <= 0) {
    throw new Error(
      `Invalid API server PORT in ${apiServerEnvPath}: "${rawBackendPort ?? ""}"`,
    );
  }

  const host = "127.0.0.1";
  const runtimePort = readPortFile(apiServerRuntimePortPath);

  if (runtimePort && (await isReachable(host, runtimePort))) {
    return {
      host,
      port: runtimePort,
      target: `http://${host}:${runtimePort}`,
      source: apiServerRuntimePortPath,
    };
  }

  return {
    host,
    port: backendPort,
    target: `http://${host}:${backendPort}`,
    source: apiServerEnvPath,
  };
}

function isReachable(host: string, port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = net.connect({ host, port, timeout: 500 });
    socket.once("connect", () => {
      socket.destroy();
      resolve(true);
    });
    socket.once("timeout", () => {
      socket.destroy();
      resolve(false);
    });
    socket.once("error", () => {
      socket.destroy();
      resolve(false);
    });
  });
}

export default defineConfig(async ({ command }) => {
  let apiProxy = await resolveApiProxyTarget();

  if (command === "serve" && !(await isReachable(apiProxy.host, apiProxy.port))) {
    console.warn(
      `[servaa] API backend is not reachable at ${apiProxy.target} resolved from ${apiProxy.source}. ` +
        `Start the backend with "pnpm --filter @workspace/api-server run dev" ` +
        `or update PORT in ${apiServerEnvPath}.`,
    );
  }

  return {
    base: basePath,
    plugins: [
      react(),
      tailwindcss(),
    ],
    resolve: {
      alias: {
        "@": path.resolve(import.meta.dirname, "src"),
        "@assets": path.resolve(import.meta.dirname, "..", "..", "attached_assets"),
      },
      dedupe: ["react", "react-dom"],
    },
    root: path.resolve(import.meta.dirname),
    build: {
      outDir: path.resolve(import.meta.dirname, "dist/public"),
      emptyOutDir: true,
    },
    server: {
      port,
      strictPort: true,
      host: "0.0.0.0",
      allowedHosts: true,
      proxy: {
        "/api": {
          target: apiProxy.target,
          changeOrigin: true,
          async bypass(_req, _res, options) {
            apiProxy = await resolveApiProxyTarget();
            options.target = apiProxy.target;
          },
          configure(proxy) {
            proxy.on("error", (error, _req, res) => {
              console.error(
                `[servaa] API proxy failed for ${apiProxy.target}: ${error.message}`,
              );

              if (res && "writeHead" in res && !res.headersSent) {
                res.writeHead(503, { "content-type": "application/json" });
                res.end(
                  JSON.stringify({
                    error: {
                      code: "API_BACKEND_UNAVAILABLE",
                      message: `API backend is not reachable at ${apiProxy.target}. Check artifacts/api-server/.env PORT and .runtime-port, then restart the backend if needed.`,
                    },
                  }),
                );
              }
            });
          },
        },
      },
      fs: {
        strict: true,
      },
    },
    preview: {
      port,
      host: "0.0.0.0",
      allowedHosts: true,
    },
  };
});
