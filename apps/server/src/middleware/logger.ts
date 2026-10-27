import type { MiddlewareHandler } from "hono";
import type { AppEnv } from "../http";

export function requestLogger(): MiddlewareHandler<AppEnv> {
  return async (c, next) => {
    const started = Date.now();
    await next();
    const duration = Date.now() - started;
    const videur = c.get("videur");
    if (c.req.path.startsWith("/api") || c.req.path.startsWith("/media")) {
      videur.logger.debug(`${c.req.method} ${c.req.path} ${c.res.status} ${duration}ms`);
    }
  };
}
