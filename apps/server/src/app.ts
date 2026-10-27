import { Hono, type Context } from "hono";
import { cors } from "hono/cors";
import { existsSync, statSync } from "node:fs";
import { resolveInside } from "@videur/core";
import type { Videur } from "@videur/core";
import { authMiddleware } from "./middleware/auth";
import { requestLogger } from "./middleware/logger";
import { errorPayload, type AppEnv } from "./http";
import { projectRoutes } from "./routes/projects";
import { systemRoutes } from "./routes/system";
import { renderRoutes } from "./routes/renders";
import { mediaRoutes } from "./routes/media";
import { eventRoutes } from "./routes/events";

function isLocalOrigin(origin: string): boolean {
  return /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/.test(origin);
}

export function createApp(videur: Videur): Hono<AppEnv> {
  const app = new Hono<AppEnv>();

  app.use("*", async (c, next) => {
    c.set("videur", videur);
    await next();
  });

  app.use(
    "*",
    cors({
      origin: (origin) => (origin && isLocalOrigin(origin) ? origin : undefined),
      allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
      allowHeaders: ["Content-Type", "Authorization", "Range"],
      exposeHeaders: ["Content-Range", "Accept-Ranges", "Content-Length"],
      maxAge: 86400,
    }),
  );

  app.use("*", requestLogger());

  app.use("*", async (c, next) => {
    await next();
    c.header("X-Content-Type-Options", "nosniff");
    c.header("X-Frame-Options", "DENY");
    c.header("Referrer-Policy", "no-referrer");
  });

  app.use("/api/*", authMiddleware());
  app.use("/media/*", authMiddleware());

  app.route("/api", systemRoutes);
  app.route("/api", projectRoutes);
  app.route("/api", renderRoutes);
  app.route("/api", eventRoutes);
  app.route("/", mediaRoutes);

  app.onError((error, c) => {
    const { status, body } = errorPayload(error);
    if (status >= 500) {
      videur.logger.error(`${c.req.method} ${c.req.path}`, error);
    }
    return c.json(body, status as 400);
  });

  app.notFound((c) => {
    if (c.req.path.startsWith("/api") || c.req.path.startsWith("/media")) {
      return c.json({ error: { code: "NOT_FOUND", message: "Ruta no encontrada" } }, 404);
    }
    return serveSpa(c, videur);
  });

  return app;
}

function serveSpa(c: Context<AppEnv>, videur: Videur): Response {
  const dist = videur.config.webDist;
  const indexPath = `${dist}/index.html`;
  if (!existsSync(indexPath)) {
    return new Response(
      `<!doctype html><html><body style="font-family:system-ui;background:#070b12;color:#e6edf7;padding:40px">
        <h1>Videur API</h1>
        <p>La UI no está compilada. Ejecuta <code>bun run build</code> o usa <code>bun run dev</code> y abre
        <a style="color:#22d3ee" href="http://localhost:5173">http://localhost:5173</a>.</p>
      </body></html>`,
      { headers: { "content-type": "text/html; charset=utf-8" } },
    );
  }

  const pathname = decodeURIComponent(new URL(c.req.url).pathname);
  const relative = pathname === "/" ? "index.html" : pathname.replace(/^\/+/, "");
  let absolute = indexPath;
  try {
    if (relative !== "index.html") {
      const candidate = resolveInside(dist, relative);
      if (existsSync(candidate) && statSync(candidate).isFile()) absolute = candidate;
    }
  } catch {
    absolute = indexPath;
  }

  const file = Bun.file(absolute);
  const headers = new Headers();
  headers.set("content-type", file.type || "application/octet-stream");
  headers.set("cache-control", absolute.endsWith("index.html") ? "no-store" : "public, max-age=3600");
  return new Response(file, { headers });
}
