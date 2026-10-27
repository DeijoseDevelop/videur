export class AppError extends Error {
  readonly code: string;
  readonly status: number;
  readonly details?: unknown;

  constructor(code: string, message: string, status = 500, details?: unknown) {
    super(message);
    this.name = "AppError";
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

export class ValidationError extends AppError {
  constructor(message: string, details?: unknown) {
    super("VALIDATION_ERROR", message, 400, details);
  }
}

export class NotFoundError extends AppError {
  constructor(message: string, details?: unknown) {
    super("NOT_FOUND", message, 404, details);
  }
}

export class ConflictError extends AppError {
  constructor(message: string, details?: unknown) {
    super("CONFLICT", message, 409, details);
  }
}

export class PathError extends AppError {
  constructor(message: string, details?: unknown) {
    super("PATH_ERROR", message, 400, details);
  }
}

export class EngineUnavailableError extends AppError {
  constructor(message: string, details?: unknown) {
    super("ENGINE_UNAVAILABLE", message, 422, details);
  }
}

export class CommandNotAllowedError extends AppError {
  constructor(message: string, details?: unknown) {
    super("COMMAND_NOT_ALLOWED", message, 403, details);
  }
}

export class ProviderError extends AppError {
  constructor(message: string, status = 502, details?: unknown) {
    super("PROVIDER_ERROR", message, status, details);
  }
}

export class CancelledError extends AppError {
  constructor(message = "Operación cancelada") {
    super("CANCELLED", message, 499);
  }
}

export function toErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
}

export function isAbortError(error: unknown): boolean {
  return error instanceof Error && (error.name === "AbortError" || error.message.includes("aborted"));
}
