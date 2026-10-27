import type { LogLevel } from "./config";

const LEVELS: Record<LogLevel, number> = { debug: 10, info: 20, warn: 30, error: 40 };

const SECRET_PATTERNS = [
  /\bsk-[A-Za-z0-9_-]{12,}\b/g,
  /\bBearer\s+[A-Za-z0-9._-]{12,}\b/gi,
  /\b[A-Za-z0-9_-]{32,}\b/g,
];

export function redactSecrets(value: string): string {
  let output = value;
  for (const pattern of SECRET_PATTERNS) {
    output = output.replace(pattern, "[REDACTED]");
  }
  return output;
}

function serialize(value: unknown): string {
  if (value instanceof Error) return `${value.name}: ${value.message}`;
  if (typeof value === "string") return value;
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

export class Logger {
  constructor(
    private readonly level: LogLevel = "info",
    private readonly scope = "videur",
  ) {}

  child(scope: string): Logger {
    return new Logger(this.level, `${this.scope}:${scope}`);
  }

  private write(level: LogLevel, message: string, extra?: unknown): void {
    if (LEVELS[level] < LEVELS[this.level]) return;
    const timestamp = new Date().toISOString();
    const suffix = extra === undefined ? "" : ` ${serialize(extra)}`;
    const line = redactSecrets(`[${timestamp}] ${level.toUpperCase()} ${this.scope} ${message}${suffix}`);
    if (level === "error") console.error(line);
    else if (level === "warn") console.warn(line);
    else console.log(line);
  }

  debug(message: string, extra?: unknown): void {
    this.write("debug", message, extra);
  }
  info(message: string, extra?: unknown): void {
    this.write("info", message, extra);
  }
  warn(message: string, extra?: unknown): void {
    this.write("warn", message, extra);
  }
  error(message: string, extra?: unknown): void {
    this.write("error", message, extra);
  }
}
