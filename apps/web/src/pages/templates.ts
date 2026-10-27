import { computed, defineComponent, elurRouter, html, repeat, signal } from "@elurjs/core";
import type { EngineId } from "@videur/contracts";
import { raw } from "@elurjs/core";
import { appStore } from "../lib/store";
import { engineLabel, formatSeconds } from "../lib/format";
import { icon } from "../lib/icons";
import { button, emptyState, engineBadge, pageHeader } from "../components/ui";

export const TemplatesPage = defineComponent((_props, ctx) => {
  const router = elurRouter();
  const engine = signal<EngineId | "">("");

  ctx.onMount(() => {
    void appStore.refreshTemplates();
  });

  const filtered = computed(() =>
    appStore.templates.value.filter((template) => !engine.value || template.engine === engine.value),
  );

  const useTemplate = (templateId: string): void => {
    router.navigate(`/projects/new?template=${encodeURIComponent(templateId)}`);
  };

  return html`
    <div class="page">
      ${pageHeader(
        "Plantillas",
        "Puntos de partida probados para cada motor. Edita el código o pide cambios al agente.",
        button("Proyecto en blanco", {
          variant: "secondary",
          icon: "plus",
          onClick: () => router.navigate("/projects/new"),
        }),
        "Biblioteca",
      )}

      <div class="filter-chips" role="tablist" aria-label="Filtrar plantillas por motor">
        <button class=${() => `chip ${engine.value === "" ? "chip--active" : ""}`} type="button" @click=${() => (engine.value = "")}>
          Todas
        </button>
        ${(["ffmpeg", "pillow", "manim", "remotion"] as EngineId[]).map(
          (id) => html`
            <button
              class=${() => `chip ${engine.value === id ? "chip--active" : ""}`}
              type="button"
              @click=${() => (engine.value = id)}
            >
              ${engineLabel(id)}
            </button>
          `,
        )}
      </div>

      ${() =>
        appStore.templates.value.length === 0
          ? emptyState("templates", "Cargando plantillas…", "Si no aparecen, revisa la carpeta templates del proyecto.")
          : filtered.value.length === 0
            ? emptyState("templates", "Sin plantillas para este motor", "Prueba otro filtro o crea un proyecto en blanco.")
            : html`
                <div class="template-grid">
                  ${repeat(
                    filtered.value,
                    (template) => template.id,
                    (template) => html`
                      <article class="template-card template-card--${template.engine}">
                        <div class="template-card__preview">
                          <div class="template-card__pattern"></div>
                          <div class="template-card__preview-content">
                            <span class="template-card__engine">${raw(icon(template.engine === "manim" ? "layers" : template.engine === "remotion" ? "code" : "film", 26))}</span>
                            <span>${template.name}</span>
                          </div>
                          <div class="template-card__duration">${formatSeconds(template.duration)}</div>
                        </div>
                        <div class="template-card__body">
                          <div class="template-card__top">
                            ${engineBadge(template.engine)}
                            <span class="template-card__id">${template.id}</span>
                          </div>
                          <h3>${template.name}</h3>
                          <p>${template.description}</p>
                          <div class="template-card__tags">
                            ${template.tags.map((tag) => html`<span class="tag">${tag}</span>`)}
                          </div>
                          <div class="template-card__files">
                            ${template.files.slice(0, 4).map((file) => html`<span>${raw(icon("file", 12))} ${file}</span>`)}
                          </div>
                          <div class="template-card__footer">
                            ${button("Usar plantilla", {
                              variant: "primary",
                              size: "sm",
                              icon: "arrow-right",
                              onClick: () => useTemplate(template.id),
                            })}
                            <span class="muted">${template.aspectRatio}</span>
                          </div>
                        </div>
                      </article>
                    `,
                  )}
                </div>
              `}
    </div>
  `;
});
