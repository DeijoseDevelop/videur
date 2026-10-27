import { Hono } from "hono";
import {
  CreateProjectSchema,
  ListProjectsQuerySchema,
  ListRendersQuerySchema,
  StartAgentSchema,
  StartRenderSchema,
  UpdateProjectSchema,
} from "@videur/contracts";
import { z } from "zod";
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
