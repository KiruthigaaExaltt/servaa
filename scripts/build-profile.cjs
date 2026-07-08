const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const profiles = {
  local: { viteMode: "development", nodeEnv: "development", label: "local", buildNamePart: "local", envFileName: ".env" },
  staging: { viteMode: "staging", nodeEnv: "staging", label: "staging", buildNamePart: "staging", envFileName: ".env.staging" },
  production: { viteMode: "production", nodeEnv: "production", label: "production", buildNamePart: "", envFileName: ".env.production" },
  prod: { viteMode: "production", nodeEnv: "production", label: "production", buildNamePart: "", envFileName: ".env.production" },
  demo: { viteMode: "demo", nodeEnv: "demo", label: "demo", buildNamePart: "demo", envFileName: ".env.demo" },
};

const requestedProfile = process.argv[2] ?? "local";
const profile = profiles[requestedProfile];

if (!profile) {
  console.error(
    `Unknown build profile "${requestedProfile}". Use local, staging, production/prod, or demo.`,
  );
  process.exit(1);
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd ?? process.cwd(),
    env: {
      ...process.env,
      NODE_ENV: profile.nodeEnv,
      SERVAA_BUILD_PROFILE: profile.label,
      VITE_SERVAA_BUILD_PROFILE: profile.label,
      ...options.env,
    },
    shell: process.platform === "win32",
    stdio: "inherit",
  });

  if (result.error) {
    console.error(result.error);
    process.exit(1);
  }

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

function readEnvFile(filePath) {
  const env = {};
  if (!fs.existsSync(filePath)) {
    console.error(`[servaa-build] Missing required env file: ${filePath}`);
    process.exit(1);
  }

  for (const rawLine of fs.readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const separatorIndex = line.indexOf("=");
    if (separatorIndex === -1) continue;
    const key = line.slice(0, separatorIndex).trim();
    const value = line.slice(separatorIndex + 1).trim().replace(/^['"]|['"]$/g, "");
    if (key) env[key] = value;
  }

  return env;
}

function logEnvSelection(frontendEnvPath, backendEnvPath, backendEnv) {
  const backendPort = backendEnv.PORT || "(not set)";
  const backendOutlet = backendEnv.DEFAULT_OUTLET_SLUG || "(not set)";

  console.log(`[servaa-build] Environment profile: ${profile.label}`);
  console.log(`[servaa-build] Frontend env file: ${frontendEnvPath}`);
  console.log(`[servaa-build] Backend env file: ${backendEnvPath}`);
  console.log(`[servaa-build] Backend env loaded: PORT=${backendPort}, DEFAULT_OUTLET_SLUG=${backendOutlet}`);
}

function assertDirectory(dir, description) {
  if (!fs.existsSync(dir) || !fs.statSync(dir).isDirectory()) {
    console.error(`[servaa-build] Missing ${description}: ${dir}`);
    process.exit(1);
  }
}

function buildPrefix(component) {
  const middle = profile.buildNamePart ? `-${profile.buildNamePart}` : "";
  return `servaa-${component}${middle}-build`;
}

function getNextBuildNumber(buildFilesDir, prefixes) {
  if (!fs.existsSync(buildFilesDir)) return 1;

  let max = 0;
  for (const entry of fs.readdirSync(buildFilesDir)) {
    for (const prefix of prefixes) {
      const match = entry.match(new RegExp(`^${prefix}-(\\d+)(?:\\.zip)?$`));
      if (match) max = Math.max(max, Number(match[1]));
    }
  }
  return max + 1;
}

function copyDirectoryContents(sourceDir, targetDir) {
  fs.mkdirSync(targetDir, { recursive: true });
  for (const entry of fs.readdirSync(sourceDir)) {
    fs.cpSync(path.join(sourceDir, entry), path.join(targetDir, entry), {
      recursive: true,
      force: true,
    });
  }
}

function zipDirectory(sourceDir, zipPath) {
  if (fs.existsSync(zipPath)) {
    console.error(`[servaa-build] Refusing to overwrite existing ZIP: ${zipPath}`);
    process.exit(1);
  }

  if (process.platform === "win32") {
    const source = sourceDir.replace(/'/g, "''");
    const destination = zipPath.replace(/'/g, "''");
    run("powershell.exe", [
      "-NoProfile",
      "-Command",
      `Compress-Archive -LiteralPath '${source}' -DestinationPath '${destination}'`,
    ]);
  } else {
    run("zip", ["-rq", zipPath, path.basename(sourceDir)], {
      cwd: path.dirname(sourceDir),
    });
  }
}

function packageBuildArtifacts() {
  const rootDir = process.cwd();
  const frontendDistDir = path.join(rootDir, "artifacts", "servaa", "dist", "public");
  const backendDistDir = path.join(rootDir, "artifacts", "api-server", "dist");
  const buildFilesDir = path.join(rootDir, "build files");
  const frontendPrefix = buildPrefix("frontend");
  const backendPrefix = buildPrefix("backend");
  const buildNumber = getNextBuildNumber(buildFilesDir, [frontendPrefix, backendPrefix]);
  const frontendPackageName = `${frontendPrefix}-${buildNumber}`;
  const backendPackageName = `${backendPrefix}-${buildNumber}`;
  const frontendPackageDir = path.join(buildFilesDir, frontendPackageName);
  const backendPackageDir = path.join(buildFilesDir, backendPackageName);

  assertDirectory(frontendDistDir, "frontend build output");
  assertDirectory(backendDistDir, "backend build output");
  fs.mkdirSync(buildFilesDir, { recursive: true });

  copyDirectoryContents(frontendDistDir, frontendPackageDir);
  copyDirectoryContents(backendDistDir, path.join(backendPackageDir, "dist"));

  zipDirectory(frontendPackageDir, path.join(buildFilesDir, `${frontendPackageName}.zip`));
  zipDirectory(backendPackageDir, path.join(buildFilesDir, `${backendPackageName}.zip`));

  console.log(`[servaa-build] Packaged frontend: ${path.relative(rootDir, frontendPackageDir)}`);
  console.log(`[servaa-build] Packaged backend: ${path.relative(rootDir, backendPackageDir)}`);
}

console.log(`[servaa-build] Starting ${profile.label} build`);

const rootDir = process.cwd();
const frontendEnvPath = path.join(rootDir, "artifacts", "servaa", profile.envFileName);
const backendEnvPath = path.join(rootDir, "artifacts", "api-server", profile.envFileName);
const backendEnv = readEnvFile(backendEnvPath);

if (!fs.existsSync(frontendEnvPath)) {
  console.error(`[servaa-build] Missing required env file: ${frontendEnvPath}`);
  process.exit(1);
}

logEnvSelection(frontendEnvPath, backendEnvPath, backendEnv);

run("pnpm", ["run", "typecheck"]);
run("pnpm", ["--filter", "@workspace/api-server", "run", "build"], {
  env: {
    ...backendEnv,
    SERVAA_BACKEND_ENV_FILE: backendEnvPath,
    SERVAA_FRONTEND_ENV_FILE: frontendEnvPath,
  },
});
run("pnpm", [
  "--filter",
  "@workspace/servaa",
  "exec",
  "vite",
  "build",
  "--config",
  "vite.config.ts",
  "--mode",
  profile.viteMode,
], {
  env: {
    SERVAA_BACKEND_ENV_FILE: backendEnvPath,
    SERVAA_FRONTEND_ENV_FILE: frontendEnvPath,
  },
});
packageBuildArtifacts();

console.log(`[servaa-build] ${profile.label} build completed`);
