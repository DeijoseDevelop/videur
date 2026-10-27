import { computed, defineComponent, elurRouter, html, signal } from "@elurjs/core";
import { raw } from "@elurjs/core";
import { appStore } from "../lib/store";
import { formatDurationMs, formatPercent, formatSeconds, statusLabel } from "../lib/format";
import { icon } from "../lib/icons";
import { AgentChat } from "../components/agent";
import { CodeEditor, FileTree } from "../components/project";
import {
  ContactSheet,
  LogViewer,
  MetadataTable,
  QaPanel,
  RenderList,
  VideoPreview,
} from "../components/render";
import {
  button,
  emptyState,
  engineBadge,
  iconButton,
  spinner,
  statusBadge,
} from "../components/ui";
import type { Render } from "@videur/contracts";

export const WorkspacePage = defineComponent((_props, ctx) => {
  const router = elurRouter();
  const projectId = router.params.value.id;
  const draft = signal("");
  const providerId = signal("");
  const previewMode = signal<"video" | "contact">("video");

  ctx.onMount(() => {
    void appStore.loadProject(projectId);
    providerId.value =
      appStore.settings.value?.defaults.providerId ??
      appStore.providers.value.find((provider) => provider.enabled)?.id ??
      "";
  });

  const activeRender = (): Render | null => appStore.activeRenders.value[0] ?? null;
  const selectedProvider = (): string =>
    providerId.value ||
    appStore.settings.value?.defaults.providerId ||
    appStore.providers.value.find((provider) => provider.enabled)?.id ||
    "";

  const sendPrompt = (prompt: string): void => {
    const value = prompt.trim();
    if (!value) return;
    void appStore.sendPrompt(value, providerId.value || undefined).then((ok) => {
      if (ok) draft.value = "";
    });
  };

  const togglePreview = (mode: "video" | "contact"): void => {
    previewMode.value = mode;
  };

  const openRenderDetail = (): void => {
    const render = appStore.selectedRender.value;
    if (render) router.navigate(`/projects/${projectId}/renders/${render.id}`);
  };

  return html`
    <div class="page page--workspace">
      <div show=${() => !appStore.currentProject.value && appStore.loading.value}>
        ${spinner("Cargando proyecto…")}
      </div>
      <div show=${() => !appStore.currentProject.value && !appStore.loading.value}>
        ${emptyState(
          "projects",
          "Proyecto no encontrado",
          "El proyecto no existe o fue eliminado.",
          button("Volver a proyectos", { variant: "primary", icon: "arrow-left", onClick: () => router.navigate("/projects") }),
        )}
      </div>

      <div class="workspace" show=${() => Boolean(appStore.currentProject.value)}>
        <header class="workspace-header">
          <div class="workspace-header__left">
            ${iconButton("arrow-left", { label: "Volver a proyectos", onClick: () => router.navigate("/projects") })}
            <div class="workspace-header__title">
              <div class="workspace-header__eyebrow">
                ${() => (appStore.currentProject.value ? engineBadge(appStore.currentProject.value.engine) : null)}
                ${() => (appStore.currentProject.value ? statusBadge(appStore.currentProject.value.status) : null)}
              </div>
              <h1>${() => appStore.currentProject.value?.name ?? "Proyecto"}</h1>
              <div class="workspace-header__meta">
                ${() => {
                  const project = appStore.currentProject.value;
                  if (!project) return "";
                  return `${project.width}×${project.height} · ${project.fps} fps · ${formatSeconds(project.durationTarget)} · ${project.engine}`;
                }}
              </div>
            </div>
          </div>
          <div class="workspace-header__actions">
            ${() =>
              activeRender()
                ? button("Cancelar render", {
                    variant: "danger",
                    size: "sm",
                    icon: "stop",
                    onClick: () => void appStore.cancelRender(activeRender()!.id),
                  })
                : button("Renderizar", {
                    variant: "primary",
                    size: "sm",
                    icon: "play",
                    onClick: () => void appStore.renderCurrent(appStore.currentProject.value?.engine),
                  })}
            ${iconButton("refresh", {
              label: "Refrescar proyecto",
              onClick: () => void appStore.loadProject(projectId),
            })}
          </div>
        </header>

        <div class="workspace-grid">
          <aside class="workspace-panel workspace-files">
            <div class="workspace-panel__head">
              <span>${raw(icon("folder-open", 15))} Archivos</span>
              ${iconButton("refresh", { label: "Refrescar archivos", size: 15, onClick: () => void appStore.loadProject(projectId) })}
            </div>
            <div class="workspace-files__body">
              ${() =>
                FileTree(
                  appStore.files.value,
                  () => appStore.openFile.value?.path ?? null,
                  (path) => void appStore.openFileByPath(path),
                )}
            </div>
            <div class="workspace-files__footer muted">
              ${() => appStore.files.value.filter((file) => file.type === "file").length} archivos
            </div>
          </aside>

          <section class="workspace-panel workspace-main">
            <div class="workspace-tabs" role="tablist" aria-label="Vistas del proyecto">
              ${[
                ["agent", "Agente", "bot"],
                ["code", "Código", "code"],
                ["preview", "Preview", "film"],
                ["qa", "QA", "shield"],
              ].map(
                ([id, label, iconName]) => html`
                  <button
                    class=${() => `workspace-tab ${appStore.workspaceTab.value === id ? "workspace-tab--active" : ""}`}
                    type="button"
                    role="tab"
                    aria-selected=${() => String(appStore.workspaceTab.value === id)}
                    @click=${() => appStore.setWorkspaceTab(id as never)}
                  >
                    ${raw(icon(iconName as never, 15))}
                    <span>${label}</span>
                    ${id === "agent" && appStore.messages.value.length > 0
                      ? html`<span class="workspace-tab__count">${() => appStore.messages.value.length}</span>`
                      : null}
                    ${id === "preview" && appStore.renders.value.length > 0
                      ? html`<span class="workspace-tab__count">${() => appStore.renders.value.length}</span>`
                      : null}
                  </button>
                `,
              )}
            </div>

            <div class="workspace-tab-content">
              <div class="workspace-tab-pane" show=${() => appStore.workspaceTab.value === "agent"}>
                ${AgentChat({
                  messages: () => appStore.messages.value,
                  activity: () => appStore.toolActivity.value,
                  draft: () => draft.value,
                  running: () => appStore.agentRunning.value,
                  providers: () => appStore.providers.value.filter((provider) => provider.enabled),
                  selectedProvider,
                  onProvider: (id) => {
                    providerId.value = id;
                  },
                  onDraft: (value) => {
                    draft.value = value;
                  },
                  onSend: sendPrompt,
                  onCancel: () => void appStore.cancelAgent(),
                  onClear: () => {
                    if (confirm("¿Borrar el historial del agente?")) void appStore.clearMessages();
                  },
                  onOpenSettings: () => router.navigate("/settings"),
                })}
              </div>

              <div class="workspace-tab-pane workspace-tab-pane--editor" show=${() => appStore.workspaceTab.value === "code"}>
                ${CodeEditor(
                  () => appStore.openFile.value,
                  (value) => appStore.setDraft(value),
                  () => void appStore.saveFile(),
                )}
              </div>

              <div class="workspace-tab-pane" show=${() => appStore.workspaceTab.value === "preview"}>
                <div class="preview-toolbar">
                  <div class="segmented">
                    <button class=${() => `segmented__item ${previewMode.value === "video" ? "segmented__item--active" : ""}`} type="button" @click=${() => togglePreview("video")}>
                      ${raw(icon("film", 14))} Video
                    </button>
                    <button class=${() => `segmented__item ${previewMode.value === "contact" ? "segmented__item--active" : ""}`} type="button" @click=${() => togglePreview("contact")}>
                      ${raw(icon("image", 14))} Contact sheet
                    </button>
                  </div>
                  ${() =>
                    appStore.selectedRender.value
                      ? button("Ver detalle", { variant: "secondary", size: "sm", icon: "external", onClick: openRenderDetail })
                      : null}
                </div>
                ${() =>
                  previewMode.value === "video"
                    ? VideoPreview(appStore.selectedRender.value)
                    : ContactSheet(appStore.selectedRender.value)}
                ${() => (appStore.selectedRender.value ? MetadataTable(appStore.selectedRender.value.metadata) : null)}
              </div>

              <div class="workspace-tab-pane" show=${() => appStore.workspaceTab.value === "qa"}>
                ${() => QaPanel(appStore.selectedRender.value?.qa ?? null)}
                ${() => (appStore.selectedRender.value ? MetadataTable(appStore.selectedRender.value.metadata) : null)}
              </div>
            </div>
          </section>

          <aside class="workspace-panel workspace-inspector">
            <div class="workspace-panel__head">
              <span>${raw(icon("film", 15))} Renders</span>
              ${() =>
                activeRender()
                  ? html`<span class="live-badge"><span class="live-dot"></span>${formatPercent(activeRender()!.progress)}</span>`
                  : html`<span class="muted">${() => appStore.renders.value.length}</span>`}
            </div>
            <div class="workspace-inspector__body">
              ${() =>
                RenderList(
                  appStore.renders.value,
                  appStore.selectedRenderId.value,
                  (render) => void appStore.selectRender(render.id),
                  (render) => void appStore.cancelRender(render.id),
                )}
              ${() => {
                const selected = appStore.selectedRender.value;
                if (!selected) return null;
                return html`
                  <div class="inspector-section">
                    <div class="inspector-section__head">
                      <span>Detalle</span>
                      <button class="link-btn" type="button" @click=${openRenderDetail}>
                        abrir ${raw(icon("arrow-right", 12))}
                      </button>
                    </div>
                    <div class="inspector-meta">
                      <div><span>Estado</span><strong>${statusLabel(selected.status)}</strong></div>
                      <div><span>Motor</span><strong>${selected.engine}</strong></div>
                      <div><span>Duración</span><strong>${selected.durationMs !== null ? formatDurationMs(selected.durationMs) : "—"}</strong></div>
                      <div><span>Progreso</span><strong>${formatPercent(selected.progress)}</strong></div>
                    </div>
                  </div>
                `;
              }}
              <div class="inspector-section inspector-section--logs">
                <div class="inspector-section__head">
                  <span>Logs</span>
                  <button
                    class="link-btn"
                    type="button"
                    @click=${() => {
                      const id = appStore.selectedRenderId.value;
                      if (id) void appStore.loadLogs(id);
                    }}
                  >
                    refrescar
                  </button>
                </div>
                ${() => LogViewer(appStore.logs.value)}
              </div>
            </div>
          </aside>
        </div>
      </div>
    </div>
  `;
});
