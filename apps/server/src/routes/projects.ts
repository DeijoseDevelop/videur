import { Hono } from "hono";
import { existsSync, readFileSync, statSync } from "node:fs";
import { basename } from "node:path";
import {
  CreateProjectSchema,
  ListProjectsQuerySchema,
  ListRendersQuerySchema,
  StartAgentSchema,
  StartRenderSchema,
  UpdateProjectSchema,
} from "@videur/contracts";
import { z } from "zod";
import { assetMime, toErrorMessage } from "@videur/core";
import { parseBody, parseQuery, serializeRender, videurOf, type AppEnv } from "../http";

const FileWriteSchema = z.object({ path: z.string().min(1), content: z.string() });

export const projectRoutes = new Hono<AppEnv>();

projectRoutes.get("/projects", (c) => {
  const videur = videurOf(c);
  const query = parseQuery(c, ListProjectsQuerySchema);
  const result = videur.projects.list(query);
  return c.json(result);
});

projectRoutes.post("/projects", async (c) => {
  const videur = videurOf(c);
  const body = await parseBody(c, CreateProjectSchema);
  const project = videur.projects.create(body);
  return c.json(project, 201);
});

projectRoutes.get("/projects/:id", (c) => {
  const videur = videurOf(c);
  return c.json(videur.projects.get(c.req.param("id")));
});

projectRoutes.patch("/projects/:id", async (c) => {
  const videur = videurOf(c);
  const body = await parseBody(c, UpdateProjectSchema);
  return c.json(videur.projects.update(c.req.param("id"), body));
});

projectRoutes.delete("/projects/:id", (c) => {
  const videur = videurOf(c);
  const keepFiles = new URL(c.req.url).searchParams.get("keepFiles") === "true";
  const deleted = videur.projects.delete(c.req.param("id"), keepFiles);
  return c.json({ deleted, id: c.req.param("id") });
});

projectRoutes.get("/projects/:id/files", (c) => {
  const videur = videurOf(c);
  return c.json({ root: c.req.param("id"), files: videur.workspace.list(c.req.param("id")) });
});

projectRoutes.get("/projects/:id/file", (c) => {
  const videur = videurOf(c);
  const path = new URL(c.req.url).searchParams.get("path");
  if (!path) return c.json({ error: { code: "VALIDATION_ERROR", message: "Falta el parámetro path" } }, 400);
  const file = videur.workspace.read(c.req.param("id"), path);
  if (file.binary) return c.json({ path: file.path, binary: true, size: file.size, modifiedAt: file.modifiedAt });
  return c.text(file.content);
});

projectRoutes.put("/projects/:id/file", async (c) => {
  const videur = videurOf(c);
  const body = await parseBody(c, FileWriteSchema);
  return c.json(videur.workspace.write(c.req.param("id"), body.path, body.content));
});

projectRoutes.get("/projects/:id/assets", (c) => {
  const videur = videurOf(c);
  const items = videur.assets.list(c.req.param("id"));
  return c.json({ items, total: items.length });
});

projectRoutes.post("/projects/:id/assets", async (c) => {
  const videur = videurOf(c);
  const body = await c.req.parseBody();
  const file = body.file;
  if (!file || typeof file === "string") {
    return c.json(
      { error: { code: "VALIDATION_ERROR", message: "Adjunta un archivo en el campo file" } },
      400,
    );
  }
  const data = new Uint8Array(await file.arrayBuffer());
  const asset = videur.assets.upload(c.req.param("id"), file.name, file.type, data);
  return c.json(asset, 201);
});

projectRoutes.patch("/projects/:id/asset-transform", async (c) => {
  const videur = videurOf(c);
  const body = (await c.req.json().catch(() => null)) as {
    path?: string;
    transform?: { rotX?: number; rotY?: number; rotZ?: number };
  } | null;
  if (!body?.path || !body.transform || typeof body.transform !== "object") {
    return c.json(
      { error: { code: "VALIDATION_ERROR", message: "Se espera { path, transform: { rotX?, rotY?, rotZ? } }" } },
      400,
    );
  }
  const asset = videur.assets.setTransform(c.req.param("id"), body.path, body.transform);
  return c.json(asset);
});

projectRoutes.delete("/projects/:id/assets", (c) => {
  const videur = videurOf(c);
  const path = new URL(c.req.url).searchParams.get("path");
  if (!path) return c.json({ error: { code: "VALIDATION_ERROR", message: "Falta el parámetro path" } }, 400);
  const deleted = videur.assets.remove(c.req.param("id"), path);
  return c.json({ deleted, path });
});

projectRoutes.get("/projects/:id/asset", (c) => {
  const videur = videurOf(c);
  const path = new URL(c.req.url).searchParams.get("path");
  if (!path) return c.json({ error: { code: "VALIDATION_ERROR", message: "Falta el parámetro path" } }, 400);
  let absolute: string;
  try {
    absolute = videur.assets.absolute(c.req.param("id"), path);
  } catch (error) {
    return c.json({ error: { code: "ASSET_INVALID", message: toErrorMessage(error) } }, 400);
  }
  if (!existsSync(absolute)) return c.notFound();
  const stat = statSync(absolute);
  const mime = assetMime(path) ?? "application/octet-stream";
  const headers = new Headers({
    "content-type": mime,
    "content-disposition": `inline; filename="${basename(path)}"`,
    "cache-control": "private, max-age=3600",
    "accept-ranges": "bytes",
    "x-content-type-options": "nosniff",
  });
  const range = c.req.header("range");
  if (range) {
    const match = /^bytes=(\d*)-(\d*)$/.exec(range.trim());
    if (match) {
      const start = match[1] ? Number(match[1]) : 0;
      const end = match[2] ? Number(match[2]) : stat.size - 1;
      if (Number.isFinite(start) && Number.isFinite(end) && start <= end && start < stat.size) {
        const buffer = new Uint8Array(
          readFileSync(absolute).subarray(start, Math.min(end + 1, stat.size)),
        );
        headers.set("content-range", `bytes ${start}-${start + buffer.length - 1}/${stat.size}`);
        headers.set("content-length", String(buffer.length));
        return c.newResponse(buffer, 206, Object.fromEntries(headers.entries()));
      }
    }
  }
  const buffer = new Uint8Array(readFileSync(absolute));
  headers.set("content-length", String(buffer.length));
  return c.newResponse(buffer, 200, Object.fromEntries(headers.entries()));
});

projectRoutes.get("/projects/:id/asset-thumbnail", async (c) => {
  const videur = videurOf(c);
  const path = new URL(c.req.url).searchParams.get("path");
  if (!path) return c.json({ error: { code: "VALIDATION_ERROR", message: "Falta el parámetro path" } }, 400);
  const thumb = await videur.assets.modelThumbnail(c.req.param("id"), path);
  const buffer = new Uint8Array(readFileSync(thumb));
  return c.newResponse(buffer, 200, {
    "content-type": "image/png",
    "cache-control": "private, max-age=86400",
    "x-content-type-options": "nosniff",
  });
});

projectRoutes.delete("/projects/:id/file", (c) => {
  const videur = videurOf(c);
  const path = new URL(c.req.url).searchParams.get("path");
  if (!path) return c.json({ error: { code: "VALIDATION_ERROR", message: "Falta el parámetro path" } }, 400);
  const deleted = videur.workspace.remove(c.req.param("id"), path);
  return c.json({ deleted, path });
});

projectRoutes.get("/projects/:id/renders", (c) => {
  const videur = videurOf(c);
  const query = parseQuery(c, ListRendersQuerySchema);
  const result = videur.renders.list(c.req.param("id"), query);
  return c.json({ items: result.items.map(serializeRender), total: result.total });
});

projectRoutes.post("/projects/:id/renders", async (c) => {
  const videur = videurOf(c);
  let body: { engine?: "ffmpeg" | "pillow" | "manim" | "remotion" } = {};
  try {
    body = await parseBody(c, StartRenderSchema);
  } catch {
    body = {};
  }
  const render = videur.renders.start(c.req.param("id"), body);
  return c.json({ renderId: render.id, status: render.status }, 202);
});

projectRoutes.get("/projects/:id/messages", (c) => {
  const videur = videurOf(c);
  const items = videur.agent.messages(c.req.param("id"));
  return c.json({ items, total: items.length });
});

projectRoutes.delete("/projects/:id/messages", (c) => {
  const videur = videurOf(c);
  const deleted = videur.agent.clear(c.req.param("id"));
  return c.json({ deleted });
});

projectRoutes.post("/projects/:id/agent", async (c) => {
  const videur = videurOf(c);
  const body = await parseBody(c, StartAgentSchema);
  const result = videur.agent.start(c.req.param("id"), body);
  return c.json(result, 202);
});
