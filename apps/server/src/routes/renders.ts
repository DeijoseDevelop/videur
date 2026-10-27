import { Hono } from "hono";
import { videurOf, serializeRender, type AppEnv } from "../http";

export const renderRoutes = new Hono<AppEnv>();

renderRoutes.get("/renders/:id", (c) => {
  const videur = videurOf(c);
  return c.json(serializeRender(videur.renders.get(c.req.param("id"))));
});

renderRoutes.post("/renders/:id/cancel", async (c) => {
  const videur = videurOf(c);
  const render = await videur.renders.cancel(c.req.param("id"));
  return c.json({ cancelled: render.status === "cancelled", render: serializeRender(render) });
});

renderRoutes.post("/renders/:id/retry", (c) => {
  const videur = videurOf(c);
  const render = videur.renders.retry(c.req.param("id"));
  return c.json({ renderId: render.id, status: render.status }, 202);
});

renderRoutes.get("/renders/:id/logs", (c) => {
  const videur = videurOf(c);
  const render = videur.renders.get(c.req.param("id"));
  const url = new URL(c.req.url);
  const offset = Math.max(0, Number(url.searchParams.get("offset") ?? 0));
  const limit = Math.min(500_000, Math.max(1, Number(url.searchParams.get("limit") ?? 200_000)));
  const logPath = `${videur.config.dataDir}/renders/${render.id}/render.log`;
  try {
    const file = Bun.file(logPath);
    if (!file.size) return c.text("");
    const start = Math.min(offset, file.size);
    const end = Math.min(file.size, start + limit);
    return new Response(file.slice(start, end), {
      headers: { "content-type": "text/plain; charset=utf-8" },
    });
  } catch {
    return c.text("");
  }
});

renderRoutes.get("/agent/runs/:id", (c) => {
  const videur = videurOf(c);
  return c.json(videur.agent.get(c.req.param("id")));
});

renderRoutes.post("/agent/runs/:id/cancel", (c) => {
  const videur = videurOf(c);
  return c.json({ cancelled: videur.agent.cancel(c.req.param("id")) });
});
