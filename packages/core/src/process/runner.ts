import { AppError } from "../errors";
import { redactSecrets } from "../logger";

export interface RunOptions {
  cwd?: string;
  env?: Record<string, string | undefined>;
  timeoutMs?: number;
  signal?: AbortSignal;
  onStdout?: (line: string) => void;
  onStderr?: (line: string) => void;
  maxLogBytes?: number;
}

export interface RunResult {
  command: string[];
  exitCode: number | null;
  signal: string | null;
  stdout: string;
  stderr: string;
  timedOut: boolean;
  aborted: boolean;
  durationMs: number;
  truncated: boolean;
}

const SECRET_ENV = /(API_KEY|SECRET|TOKEN|PASSWORD|CREDENTIAL)/i;

export function filteredEnv(extra: Record<string, string | undefined> = {}): Record<string, string> {
  const env: Record<string, string> = {};
  const passthrough = new Set([
    "PATH",
    "HOME",
    "LANG",
    "LC_ALL",
    "LC_CTYPE",
    "TMPDIR",
    "TMP",
    "TEMP",
    "TZ",
    "USER",
    "LOGNAME",
    "SHELL",
    "SYSTEMROOT",
    "WINDIR",
    "COMSPEC",
    "NUMBER_OF_PROCESSORS",
    "OS",
  ]);

  for (const [key, value] of Object.entries(process.env)) {
    if (value === undefined) continue;
    if (passthrough.has(key) || key.startsWith("VIDEUR_")) {
      if (SECRET_ENV.test(key) && !key.startsWith("VIDEUR_")) continue;
      env[key] = value;
    }
  }

  for (const [key, value] of Object.entries(extra)) {
    if (value === undefined) continue;
    env[key] = value;
  }
  return env;
}

function killProcess(proc: ReturnType<typeof Bun.spawn>, signal: NodeJS.Signals = "SIGTERM"): void {
  try {
    if (process.platform !== "win32" && proc.pid) {
      process.kill(-proc.pid, signal);
      return;
    }
  } catch {
    // Fallback al kill directo.
  }
  try {
    proc.kill(signal);
  } catch {
    // Proceso ya terminado.
  }
}

function splitLines(
  stream: ReadableStream<Uint8Array>,
  onLine: ((line: string) => void) | undefined,
  onChunk: (text: string) => void,
): Promise<void> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  const consume = async (): Promise<void> => {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const text = decoder.decode(value, { stream: true });
      onChunk(text);
      buffer += text;
      const lines = buffer.split(/\r?\n/);
      buffer = lines.pop() ?? "";
      for (const line of lines) onLine?.(line);
    }
    const tail = decoder.decode();
    if (tail) {
      buffer += tail;
      onChunk(tail);
    }
    if (buffer.length > 0) onLine?.(buffer);
  };
  return consume();
}

export async function runCommand(command: string[], options: RunOptions = {}): Promise<RunResult> {
  if (!Array.isArray(command) || command.length === 0) {
    throw new AppError("COMMAND_INVALID", "El comando está vacío");
  }
  if (command.some((part) => typeof part !== "string" || part.includes("\0"))) {
    throw new AppError("COMMAND_INVALID", "Argumento de comando inválido");
  }

  const started = Date.now();
  const maxLogBytes = options.maxLogBytes ?? 2_000_000;
  let stdout = "";
  let stderr = "";
  let truncated = false;
  let timedOut = false;
  let aborted = false;
  let timeout: ReturnType<typeof setTimeout> | null = null;

  const append = (target: "stdout" | "stderr", text: string): void => {
    if ((target === "stdout" ? stdout.length : stderr.length) + text.length > maxLogBytes) {
      truncated = true;
      const remaining = Math.max(0, maxLogBytes - (target === "stdout" ? stdout.length : stderr.length));
      if (remaining > 0) {
        const slice = text.slice(-remaining);
        if (target === "stdout") stdout += slice;
        else stderr += slice;
      }
      return;
    }
    if (target === "stdout") stdout += text;
    else stderr += text;
  };

  let proc: ReturnType<typeof Bun.spawn>;
  try {
    proc = Bun.spawn(command, {
      cwd: options.cwd,
      env: filteredEnv(options.env),
      stdin: "ignore",
      stdout: "pipe",
      stderr: "pipe",
      detached: process.platform !== "win32",
    });
  } catch (error) {
    throw new AppError(
      "COMMAND_FAILED",
      `No se pudo ejecutar ${command[0]}: ${error instanceof Error ? error.message : String(error)}`,
      500,
    );
  }

  const abortHandler = (): void => {
    aborted = true;
    killProcess(proc, "SIGTERM");
    setTimeout(() => killProcess(proc, "SIGKILL"), 2000).unref?.();
  };

  if (options.signal) {
    if (options.signal.aborted) abortHandler();
    else options.signal.addEventListener("abort", abortHandler, { once: true });
  }

  if (options.timeoutMs && options.timeoutMs > 0) {
    timeout = setTimeout(() => {
      timedOut = true;
      killProcess(proc, "SIGTERM");
      setTimeout(() => killProcess(proc, "SIGKILL"), 3000).unref?.();
    }, options.timeoutMs);
  }

  const stdoutPromise = splitLines(
    proc.stdout as ReadableStream<Uint8Array>,
    (line) => {
      try {
        options.onStdout?.(redactSecrets(line));
      } catch {
        // Un callback no debe romper el proceso.
      }
    },
    (text) => append("stdout", text),
  );
  const stderrPromise = splitLines(
    proc.stderr as ReadableStream<Uint8Array>,
    (line) => {
      try {
        options.onStderr?.(redactSecrets(line));
      } catch {
        // idem
      }
    },
    (text) => append("stderr", text),
  );

  const exitCode = await proc.exited;
  await Promise.allSettled([stdoutPromise, stderrPromise]);

  if (timeout) clearTimeout(timeout);
  if (options.signal) options.signal.removeEventListener("abort", abortHandler);

  return {
    command,
    exitCode,
    signal: proc.signalCode ? String(proc.signalCode) : null,
    stdout,
    stderr,
    timedOut,
    aborted,
    durationMs: Date.now() - started,
    truncated,
  };
}
