import { Hono } from "hono";
import { existsSync, statSync } from "node:fs";
import { resolveInside } from "@videur/core";
import { videurOf, type AppEnv } from "../http";

const ARTIFACTS: Record<string, { path: (renderId: string) => string | null; mime: string }> = {
  video: {
    path: (id) => {
      return `renders/${id}/output.mp4`;
    },
    mime: "video/mp4",
  },
  "contact-sheet": {
    path: (id) => `renders/${id}/contact-sheet.png`,
    mime: "image/png",
  },
  cover: { path: (id) => `renders/${id}/cover.png`, mime: "image/png" },
  metadata: { path: (id) => `renders/${id}/metadata.json`, mime: "application/json" },
  qa: { path: (id) => `renders/${id}/qa.json`, mime: "application/json" },
  log: { path: (id) => `renders/${id}/render.log`, mime: "text/plain; charset=utf-8" },
};

export const mediaRoutes = new Hono<AppEnv>();

mediaRoutes.get("/media/:renderId/:artifact", (c) => {
  const videur = videurOf(c);
  const renderId = c.req.param("renderId");
  const artifact = c.req.param("artifact");
  const definition = ARTIFACTS[artifact];
  if (!definition) return c.notFound();

  let relativePath = definition.path(renderId);
  if (artifact === "video" || artifact === "contact-sheet") {
    const render = videur.renders.get(renderId);
    relativePath = artifact === "video" ? render.outputPath : render.contactSheetPath;
  }
  if (!relativePath) return c.notFound();

  let absolute: string;
  try {
    absolute = resolveInside(videur.config.dataDir, relativePath);
  } catch {
    return c.notFound();
  }
  if (!existsSync(absolute)) return c.notFound();
  const stat = statSync(absolute);
  if (!stat.isFile()) return c.notFound();

  const file = Bun.file(absolute);
  const headers = new Headers({
    "content-type": definition.mime,
    "cache-control": artifact === "log" ? "no-store" : "private, max-age=3600",
    "accept-ranges": "bytes",
    "x-content-type-options": "nosniff",
  });

  if (artifact === "video") {
    headers.set("content-disposition", `inline; filename="videur-${renderId}.mp4"`);
    const range = c.req.header("range");
    if (range) {
      const match = /^bytes=(\d*)-(\d*)$/.exec(range.trim());
      if (match) {
        const start = match[1] ? Number(match[1]) : 0;
        const end = match[2] ? Number(match[2]) : stat.size - 1;
        if (Number.isFinite(start) && Number.isFinite(end) && start <= end && start < stat.size) {
          const safeEnd = Math.min(end, stat.size - 1);
          headers.set("content-range", `bytes ${start}-${safeEnd}/${stat.size}`);
          headers.set("content-length", String(safeEnd - start + 1));
          return new Response(file.slice(start, safeEnd + 1), { status: 206, headers });
        }
        return new Response(null, {
          status: 416,
          headers: { "content-range": `bytes */${stat.size}` },
        });
      }
    }
  }

  headers.set("content-length", String(stat.size));
  return new Response(file, { headers });
});
