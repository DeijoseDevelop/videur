import type { MiddlewareHandler } from "hono";
import type { AppEnv } from "../http";

export function authMiddleware(): MiddlewareHandler<AppEnv> {
  return async (c, next) => {
    const videur = c.get("videur");
    const token = videur.config.apiToken;
    if (!token) return next();
    if (c.req.path === "/api/health") return next();

    const url = new URL(c.req.url);
    const queryToken = url.searchParams.get("token");
    const header = c.req.header("authorization") ?? "";
    const bearer = header.startsWith("Bearer ") ? header.slice(7) : null;

    if (bearer === token || queryToken === token) return next();

    return c.json(
      {
        error: {
          code: "UNAUTHORIZED",
          message: "Token de API requerido o inválido",
        },
      },
      401,
    );
  };
}
