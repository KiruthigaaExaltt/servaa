import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";

await writeFile(
  resolve(import.meta.dirname, "..", "lib", "api-zod", "src", "index.ts"),
  'export * from "./generated/api";\n',
);
