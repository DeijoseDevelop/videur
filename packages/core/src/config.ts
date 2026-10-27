import { existsSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";

export const VIDEUR_VERSION = "0.1.0";

export type SandboxMode = "trusted" | "docker";
export type LogLevel = "debug" | "info" | "warn" | "error";

export interface AgentConfig {
  maxIterations: number;
  timeoutMs: number;
  maxTokens: number;
}

export interface VideurPaths {
  db: string;
  workspaces: string;
  renders: string;
  secrets: string;
  masterKey: string;
  logs: string;
}

export interface VideurConfig {
  host: string;
  port: number;
  dataDir: string;
  templatesDir: string;
  webDist: string;
  apiToken: string | null;
  logLevel: LogLevel;
  maxConcurrentRenders: number;
  renderTimeoutMs: number;
  maxLogBytes: number;
  sandboxMode: SandboxMode;
  allowShellScripts: boolean;
  agent: AgentConfig;
  paths: VideurPaths;
  binaries: {
    ffmpeg: string;
    ffprobe: string;
    python: string;
    manim: string;
    node: string;
    bun: string;
  };
}

export interface ConfigOverrides {
  host?: string;
  port?: number;
  dataDir?: string;
  templatesDir?: string;
  webDist?: string;
  apiToken?: string | null;
  logLevel?: LogLevel;
  maxConcurrentRenders?: number;
  renderTimeoutMs?: number;
  maxLogBytes?: number;
  sandboxMode?: SandboxMode;
  allowShellScripts?: boolean;
  agent?: Partial<AgentConfig>;
  binaries?: Partial<VideurConfig["binaries"]>;
}

function intEnv(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.trunc(parsed) : fallback;
}

function boolEnv(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined) return fallback;
  return ["1", "true", "yes", "on"].includes(value.toLowerCase());
}

function stringEnv(value: string | undefined, fallback: string): string {
  const trimmed = value?.trim();
  return trimmed ? trimmed : fallback;
}

export function createConfig(overrides: ConfigOverrides = {}, env: NodeJS.ProcessEnv = process.env): VideurConfig {
  const cwd = process.cwd();
  const dataDir = resolve(overrides.dataDir ?? stringEnv(env.VIDEUR_DATA_DIR, resolve(cwd, "data")));
  const templatesDir = resolve(overrides.templatesDir ?? stringEnv(env.VIDEUR_TEMPLATES_DIR, resolve(cwd, "templates")));
  const webDist = resolve(overrides.webDist ?? stringEnv(env.VIDEUR_WEB_DIST, resolve(cwd, "apps/web/dist")));

  const maxConcurrentRenders =
    overrides.maxConcurrentRenders ?? intEnv(env.VIDEUR_MAX_CONCURRENT_RENDERS, 1);
  const renderTimeoutMs = overrides.renderTimeoutMs ?? intEnv(env.VIDEUR_RENDER_TIMEOUT_MS, 600_000);
  const maxLogBytes = overrides.maxLogBytes ?? intEnv(env.VIDEUR_MAX_LOG_BYTES, 2_000_000);

  const agent: AgentConfig = {
    maxIterations:
      overrides.agent?.maxIterations ?? intEnv(env.VIDEUR_AGENT_MAX_ITERATIONS, 30),
    timeoutMs: overrides.agent?.timeoutMs ?? intEnv(env.VIDEUR_AGENT_TIMEOUT_MS, 900_000),
    maxTokens: overrides.agent?.maxTokens ?? intEnv(env.VIDEUR_AGENT_MAX_TOKENS, 8192),
  };

  const sandbox = (overrides.sandboxMode ?? env.VIDEUR_SANDBOX_MODE ?? "trusted").toLowerCase();
  const sandboxMode: SandboxMode = sandbox === "docker" ? "docker" : "trusted";

  const paths: VideurPaths = {
    db: resolve(dataDir, "videur.sqlite"),
    workspaces: resolve(dataDir, "workspaces"),
    renders: resolve(dataDir, "renders"),
    secrets: resolve(dataDir, "secrets"),
    masterKey: resolve(dataDir, "secrets", "master.key"),
    logs: resolve(dataDir, "logs"),
  };

  return {
    host: overrides.host ?? stringEnv(env.VIDEUR_HOST, "127.0.0.1"),
    port: overrides.port ?? intEnv(env.VIDEUR_PORT, 8787),
    dataDir,
    templatesDir,
    webDist,
    apiToken: overrides.apiToken ?? (stringEnv(env.VIDEUR_API_TOKEN, "") || null),
    logLevel: overrides.logLevel ?? ((env.VIDEUR_LOG_LEVEL as LogLevel | undefined) ?? "info"),
    maxConcurrentRenders,
    renderTimeoutMs,
    maxLogBytes,
    sandboxMode,
    allowShellScripts: overrides.allowShellScripts ?? boolEnv(env.VIDEUR_ALLOW_SHELL_SCRIPTS, false),
    agent,
    paths,
    binaries: {
      ffmpeg: overrides.binaries?.ffmpeg ?? stringEnv(env.FFMPEG_PATH, "ffmpeg"),
      ffprobe: overrides.binaries?.ffprobe ?? stringEnv(env.FFPROBE_PATH, "ffprobe"),
      python: overrides.binaries?.python ?? stringEnv(env.PYTHON_PATH, "python3"),
      manim: overrides.binaries?.manim ?? stringEnv(env.MANIM_PATH, "manim"),
      node: overrides.binaries?.node ?? "node",
      bun: overrides.binaries?.bun ?? "bun",
    },
  };
}

export function ensureDataDirs(config: VideurConfig): void {
  for (const dir of [
    config.dataDir,
    config.paths.workspaces,
    config.paths.renders,
    config.paths.secrets,
    config.paths.logs,
  ]) {
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true, mode: 0o700 });
  }
}
