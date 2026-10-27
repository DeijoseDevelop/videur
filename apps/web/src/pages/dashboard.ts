import { computed, defineComponent, elurRouter, html, raw, repeat } from "@elurjs/core";
import { appStore } from "../lib/store";
import { formatPercent } from "../lib/format";
import { icon } from "../lib/icons";
import { ProjectCard } from "../components/project";
import {
  button,
  emptyState,
  engineBadge,
  sectionHeader,
  statCard,
} from "../components/ui";

export const DashboardPage = defineComponent((_props, ctx) => {
  const router = elurRouter();
  ctx.onMount(() => {
    void appStore.refreshProjects();
    void appStore.refreshStats();
    void appStore.refreshEngines();
    void appStore.refreshProviders();
  });

  const recentProjects = computed(() => appStore.projects.value.slice(0, 6));

  return html`
    <div class="page page--dashboard">
      <section class="hero">
        <div class="hero__glow hero__glow--cyan"></div>
        <div class="hero__glow hero__glow--violet"></div>
        <div class="hero__content">
          <div class="eyebrow"><span class="eyebrow__dot"></span> Estudio local-first · v0.1</div>
          <h1>Convierte una idea en<br /><span class="gradient-text">video determinista.</span></h1>
          <p class="hero__subtitle">
            La IA escribe código para FFmpeg, Pillow, Manim o Remotion. Videur lo ejecuta,
            genera una hoja de contactos y se autocorrige hasta que el MP4 está listo.
          </p>
          <div class="hero__actions">
            ${button("Nuevo proyecto", {
              variant: "primary",
              size: "lg",
              icon: "plus",
              onClick: () => router.navigate("/projects/new"),
            })}
            ${button("Explorar plantillas", {
              variant: "secondary",
              size: "lg",
              icon: "templates",
              onClick: () => router.navigate("/templates"),
            })}
          </div>
          <div class="hero__points">
            <span>${raw(icon("check", 14))} Sin VDOM</span>
            <span>${raw(icon("check", 14))} Multi-motor</span>
            <span>${raw(icon("check", 14))} CLI + MCP</span>
            <span>${raw(icon("check", 14))} Datos locales</span>
          </div>
        </div>
        <div class="hero__visual" aria-hidden="true">
          <div class="hero-terminal">
            <div class="hero-terminal__bar"><span></span><span></span><span></span><em>render.log</em></div>
            <pre><code><span class="c-muted">$</span> videur render prj_4a1b
<span class="c-cyan">▶</span> preparing  · ffmpeg
<span class="c-cyan">▶</span> executing  · 30 fps
<span class="c-green">✔</span> output.mp4  · 1280×720
<span class="c-violet">◆</span> contact-sheet.png · 4×4
<span class="c-green">✔</span> qa ok  ·  6.0 s</code></pre>
            <div class="hero-terminal__footer">
              <span class="live-dot"></span> deterministic render
            </div>
          </div>
        </div>
      </section>

      <section class="stats-grid">
        ${() => statCard("Proyectos", String(appStore.projectCount.value), "en el estudio", "projects", "cyan")}
        ${() => statCard("Renders", String(appStore.stats.value?.renders ?? 0), `${appStore.stats.value?.succeeded ?? 0} completados`, "film", "violet")}
        ${() => statCard("Tasa de éxito", formatPercent(appStore.successRate.value), "histórico local", "activity", "success")}
        ${() => statCard("Motores", `${appStore.enginesOnline.value}/4`, "disponibles", "server", "warn")}
      </section>

      <div class="dashboard-grid">
        <section class="dashboard-main">
          ${sectionHeader(
            "Proyectos recientes",
            "Tu mesa de trabajo",
            button("Ver todos", { variant: "ghost", size: "sm", iconRight: "arrow-right", onClick: () => router.navigate("/projects") }),
          )}
          ${() =>
            recentProjects.value.length === 0
              ? emptyState(
                  "projects",
                  "Todavía no hay proyectos",
                  "Crea el primero y renderiza en menos de un minuto.",
                  button("Crear proyecto", { variant: "primary", icon: "plus", onClick: () => router.navigate("/projects/new") }),
                )
              : html`
                  <div class="project-grid project-grid--dashboard">
                    ${repeat(
                      recentProjects.value,
                      (project) => project.id,
                      (project) =>
                        ProjectCard(
                          project,
                          () => router.navigate(`/projects/${project.id}`),
                          () => {
                            if (confirm(`¿Eliminar “${project.name}”?`)) void appStore.deleteProject(project.id);
                          },
                        ),
                    )}
                  </div>
                `}
        </section>

        <aside class="dashboard-side">
          <section class="panel">
            ${sectionHeader("Estado del estudio", "Herramientas y proveedores")}
            <div class="engine-list">
              ${() =>
                appStore.engines.value.map(
                  (engine) => html`
                    <div class="engine-row">
                      <span class="engine-row__dot ${engine.available ? "is-on" : "is-off"}"></span>
                      <div class="engine-row__text">
                        <strong>${engine.name}</strong>
                        <span>${engine.available ? `v${engine.version ?? "—"}` : engine.installHint ?? "No instalado"}</span>
                      </div>
                      ${engine.available ? engineBadge(engine.id) : html`<span class="badge badge--neutral">off</span>`}
                    </div>
                  `,
                )}
            </div>
            <div class="panel__divider"></div>
            <div class="provider-summary">
              <span class="provider-summary__icon">${raw(icon("key", 16))}</span>
              <div>
                <strong>${() => appStore.providers.value.length} proveedor(es)</strong>
                <span>${() => appStore.providers.value.filter((provider) => provider.enabled).length} habilitados</span>
              </div>
              ${button("Configurar", {
                variant: "ghost",
                size: "sm",
                onClick: () => router.navigate("/settings"),
              })}
            </div>
          </section>

          <section class="panel panel--steps">
            ${sectionHeader("Cómo funciona", "Un loop de 4 pasos")}
            <div class="steps">
              <div class="step"><span>1</span><div><strong>Idea</strong><p>Describe el video y elige motor.</p></div></div>
              <div class="step"><span>2</span><div><strong>Código</strong><p>El agente escribe FFmpeg/Python/Manim/Remotion.</p></div></div>
              <div class="step"><span>3</span><div><strong>Render</strong><p>Se ejecuta y se captura stderr + progreso.</p></div></div>
              <div class="step"><span>4</span><div><strong>QA</strong><p>Hoja de contactos, ffprobe y corrección visual.</p></div></div>
            </div>
          </section>
        </aside>
      </div>
    </div>
  `;
});
