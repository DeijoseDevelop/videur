import { Hono } from "hono";
import {
  PROVIDER_PRESETS,
  ProviderInputSchema,
  UpdateProviderSchema,
  UpdateSettingsSchema,
  ApplyTemplateSchema,
} from "@videur/contracts";
import { parseBody, videurOf, type AppEnv } from "../http";

export const systemRoutes = new Hono<AppEnv>();

systemRoutes.get("/health", (c) => c.json(videurOf(c).health()));

systemRoutes.get("/doctor", async (c) => c.json(await videurOf(c).doctor.run()));

systemRoutes.get("/engines", async (c) => {
  const items = await videurOf(c).engines.detectAll();
  return c.json({ items });
});

systemRoutes.get("/stats", async (c) => c.json(await videurOf(c).stats.get()));

systemRoutes.get("/settings", (c) => c.json(videurOf(c).settings.get()));

systemRoutes.put("/settings", async (c) => {
  const videur = videurOf(c);
  const body = await parseBody(c, UpdateSettingsSchema);
  const settings = videur.settings.update(body);
  videur.renders.syncConcurrency();
  return c.json(settings);
});

systemRoutes.get("/provider-presets", (c) => c.json({ items: PROVIDER_PRESETS }));

systemRoutes.get("/providers", (c) => {
  const items = videurOf(c).providers.list();
  return c.json({ items, total: items.length });
});

systemRoutes.post("/providers", async (c) => {
  const videur = videurOf(c);
  const body = await parseBody(c, ProviderInputSchema);
  return c.json(videur.providers.create(body), 201);
});

systemRoutes.patch("/providers/:id", async (c) => {
  const videur = videurOf(c);
  const body = await parseBody(c, UpdateProviderSchema);
  return c.json(videur.providers.update(c.req.param("id"), body));
});

systemRoutes.delete("/providers/:id", (c) => {
  const videur = videurOf(c);
  return c.json({ deleted: videur.providers.remove(c.req.param("id")) });
});

systemRoutes.post("/providers/:id/test", async (c) => {
  const videur = videurOf(c);
  return c.json(await videur.providers.test(c.req.param("id")));
});

systemRoutes.get("/providers/:id/models", async (c) => {
  const videur = videurOf(c);
  return c.json({ items: await videur.providers.models(c.req.param("id")) });
});

systemRoutes.get("/templates", (c) => {
  const videur = videurOf(c);
  const items = videur.templates.list();
  return c.json({ items, total: items.length });
});

systemRoutes.get("/templates/:id", (c) => c.json(videurOf(c).templates.get(c.req.param("id"))));

systemRoutes.post("/templates/:id/apply", async (c) => {
  const videur = videurOf(c);
  const body = await parseBody(c, ApplyTemplateSchema);
  const result = videur.templates.apply(body.projectId, c.req.param("id"), body.overwrite);
  videur.projects.refreshStatus(body.projectId);
  return c.json(result);
});
