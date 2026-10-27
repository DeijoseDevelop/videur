import { computed, defineComponent, elurRouter, html, signal } from "@elurjs/core";
import { raw } from "@elurjs/core";
import type { Render } from "@videur/contracts";
import { api } from "../lib/api";
import { appStore } from "../lib/store";
import { formatDate, formatDurationMs, formatPercent, formatSeconds } from "../lib/format";
import { icon } from "../lib/icons";
import {
  ContactSheet,
  LogViewer,
  MetadataTable,
  QaPanel,
  VideoPreview,
} from "../components/render";
import { badge, button, emptyState, engineBadge, iconButton, spinner, statusBadge } from "../components/ui";

export const RenderDetailPage = defineComponent((_props, ctx) => {
  const router = elurRouter();
  const projectId = router.params.value.id;
  const renderId = router.params.value.renderId;
  const loaded = signal<Render | null>(null);
  const loading = signal(true);

  ctx.onMount(() => {
    void appStore.loadProject(projectId);
    void api.renders
      .get(renderId)
      .then((render) => {
        loaded.value = render;
        appStore.selectRender(renderId);
      })
      .catch(() => {
        loaded.value = null;
      })
      .finally(() => {
        loading.value = false;
      });
    void appStore.loadLogs(renderId);
  });

  const render = computed(
    () => appStore.renders.value.find((item) => item.id === renderId) ?? loaded.value,
  );

  const back = (): void => router.navigate(`/projects/${projectId}`);
  const isActive = (): boolean =>
    Boolean(render.value && ["queued", "preparing", "running", "inspecting"].includes(render.value.status));

  return html`
    <div class="page page--render-detail">
      <div show=${() => loading.value && !render.value}>${spinner("Cargando render…")}</div>
      <div show=${() => !loading.value && !render.value}>
        ${emptyState(
          "film",
          "Render no encontrado",
          "Puede que se haya eliminado o que el enlace esté mal.",
          button("Volver al proyecto", { variant: "primary", icon: "arrow-left", onClick: back }),
        )}
      </div>

      <div show=${() => Boolean(render.value)}>
        <header class="render-detail-header">
          <div class="render-detail-header__left">
            ${iconButton("arrow-left", { label: "Volver al proyecto", onClick: back })}
            <div>
              <div class="eyebrow">${() => appStore.currentProject.value?.name ?? "Proyecto"}</div>
              <h1>Render <span class="mono">${renderId}</span></h1>
              <div class="render-detail-header__meta">
                ${() => (render.value ? statusBadge(render.value.status) : null)}
                ${() => (render.value ? engineBadge(render.value.engine) : null)}
                <span>${() => (render.value ? formatDate(render.value.createdAt) : "")}</span>
                <span>${() => (render.value?.durationMs != null ? formatDurationMs(render.value.durationMs) : "")}</span>
              </div>
            </div>
          </div>
          <div class="render-detail-header__actions">
            ${() =>
              render.value?.videoUrl
                ? html`<a class="btn btn--primary btn--sm" href=${render.value.videoUrl} download>${raw(icon("download", 14))}<span>Descargar MP4</span></a>`
                : null}
            ${() =>
              isActive()
                ? button("Cancelar", { variant: "danger", size: "sm", icon: "stop", onClick: () => void appStore.cancelRender(renderId) })
                : button("Reintentar", { variant: "secondary", size: "sm", icon: "refresh", onClick: () => void appStore.retryRender(renderId) })}
          </div>
        </header>

        ${() =>
          render.value?.error
            ? html`
                <div class="alert alert--error">
                  ${raw(icon("alert", 18))}
                  <div><strong>El render falló</strong><p>${render.value.error}</p></div>
                </div>
              `
            : null}

        <div class="render-detail-grid">
          <div class="render-detail-main">
            ${() => VideoPreview(render.value)}
            ${() => ContactSheet(render.value)}
            <section class="panel">
              <div class="panel__head"><span>${raw(icon("database", 15))} Metadata</span></div>
              ${() => MetadataTable(render.value?.metadata ?? null)}
            </section>
          </div>
          <aside class="render-detail-side">
            <section class="panel">
              <div class="panel__head"><span>${raw(icon("shield", 15))} QA</span></div>
              ${() => QaPanel(render.value?.qa ?? null)}
            </section>
            <section class="panel panel--logs">
              <div class="panel__head">
                <span>${raw(icon("terminal", 15))} Logs</span>
                ${button("Refrescar", { variant: "ghost", size: "sm", icon: "refresh", onClick: () => void appStore.loadLogs(renderId) })}
              </div>
              ${() => LogViewer(appStore.logs.value)}
            </section>
            <section class="panel">
              <div class="panel__head"><span>${raw(icon("clock", 15))} Timeline</span></div>
              <div class="timeline">
                <div class="timeline__item"><span></span><div><strong>Creado</strong><p>${() => (render.value ? formatDate(render.value.createdAt) : "—")}</p></div></div>
                <div class="timeline__item"><span></span><div><strong>Iniciado</strong><p>${() => (render.value?.startedAt ? formatDate(render.value.startedAt) : "—")}</p></div></div>
                <div class="timeline__item"><span></span><div><strong>Finalizado</strong><p>${() => (render.value?.finishedAt ? formatDate(render.value.finishedAt) : "—")}</p></div></div>
              </div>
            </section>
          </aside>
        </div>
      </div>
    </div>
  `;
});
