import type { Context } from "hono";
import type { Render } from "@videur/contracts";
import { AppError, ValidationError } from "@videur/core";
import type { Videur } from "@videur/core";
import type { ZodType } from "zod";

export interface AppEnv {
  Variables: {
    videur: Videur;
  };
}

export type AppContext = Context<AppEnv>;

export function videurOf(c: AppContext): Videur {
  return c.get("videur");
}

export async function parseBody<T>(c: AppContext, schema: ZodType<T>): Promise<T> {
  let raw: unknown;
  try {
    raw = await c.req.json();
  } catch {
    throw new ValidationError("El body debe ser JSON válido");
  }
  return schema.parse(raw);
}

export function parseQuery<T>(c: AppContext, schema: ZodType<T>): T {
  const url = new URL(c.req.url);
  return schema.parse(Object.fromEntries(url.searchParams.entries()));
}

export function serializeRender(render: Render): Render {
  return {
    ...render,
    ...(render.outputPath ? { videoUrl: `/media/${render.id}/video` } : {}),
    ...(render.contactSheetPath ? { contactSheetUrl: `/media/${render.id}/contact-sheet` } : {}),
    logsUrl: `/media/${render.id}/log`,
  };
}

export function errorPayload(error: unknown): {
  status: number;
  body: { error: { code: string; message: string; details?: unknown } };
} {
  if (error instanceof AppError) {
    return {
      status: error.status,
      body: {
        error: {
          code: error.code,
          message: error.message,
          ...(error.details !== undefined ? { details: error.details } : {}),
        },
      },
    };
  }
  if (error && typeof error === "object" && "issues" in error) {
    return {
      status: 400,
      body: {
        error: {
          code: "VALIDATION_ERROR",
          message: "Datos inválidos",
          details: (error as { issues: unknown }).issues,
        },
      },
    };
  }
  return {
    status: 500,
    body: {
      error: {
        code: "INTERNAL_ERROR",
        message: error instanceof Error ? error.message : String(error),
      },
    },
  };
}
