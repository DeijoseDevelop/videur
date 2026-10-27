import { createRouter, mount, type ComponentInvocation, type ElurTemplate } from "@elurjs/core";
import { App } from "./app";
import { DashboardPage } from "./pages/dashboard";
import { ProjectsPage } from "./pages/projects";
import { NewProjectPage } from "./pages/new-project";
import { WorkspacePage } from "./pages/workspace";
import { RenderDetailPage } from "./pages/render-detail";
import { TemplatesPage } from "./pages/templates";
import { SettingsPage } from "./pages/settings";
import { NotFoundPage } from "./pages/not-found";
import "./styles/tokens.css";
import "./styles/base.css";
import "./styles/components.css";
import "./styles/pages.css";

function page(invocation: ComponentInvocation<Record<string, never>>): ElurTemplate {
  // El runtime de RouterView monta invocaciones de defineComponent; el tipo
  // público del router aún no las incluye.
  return invocation as unknown as ElurTemplate;
}

const router = createRouter(
  [
    { path: "/", component: () => page(DashboardPage({})) },
    { path: "/projects", component: () => page(ProjectsPage({})) },
    { path: "/projects/new", component: () => page(NewProjectPage({})) },
    { path: "/projects/:id", component: () => page(WorkspacePage({})) },
    { path: "/projects/:id/renders/:renderId", component: () => page(RenderDetailPage({})) },
    { path: "/templates", component: () => page(TemplatesPage({})) },
    { path: "/settings", component: () => page(SettingsPage({})) },
    { path: "*", component: () => page(NotFoundPage({})) },
  ],
  {
    mode: "history",
    scrollBehavior: () => ({ top: 0, left: 0 }),
  },
);

mount(new App(), "#app", { router });
