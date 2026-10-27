import { defineComponent, elurRouter, html, signal } from "@elurjs/core";
import type { AspectRatio, EngineId, TemplateInfo } from "@videur/contracts";
import { raw } from "@elurjs/core";
import { appStore } from "../lib/store";
import { ENGINE_DESCRIPTIONS, aspectOptions, engineLabel, formatSeconds } from "../lib/format";
import { icon } from "../lib/icons";
import { badge, button, engineBadge, field, pageHeader, spinner } from "../components/ui";

export const NewProjectPage = defineComponent((_props, ctx) => {
  const router = elurRouter();
  const step = signal(1);
  const name = signal("");
  const brief = signal("");
  const engine = signal<EngineId>("ffmpeg");
  const aspect = signal<AspectRatio>("16:9");
  const duration = signal(8);
  const fps = signal(30);
  const style = signal("dark-cinematic");
  const templateId = signal<string | null>(null);
  const error = signal("");
  const creating = signal(false);

  ctx.onMount(() => {
    void (async () => {
      await Promise.all([
        appStore.refreshTemplates(),
        appStore.refreshEngines(),
        appStore.refreshSettings(),
      ]);
      const settings = appStore.settings.value;
      if (settings) {
        engine.value = settings.defaults.engine;
        aspect.value = settings.defaults.aspectRatio;
        duration.value = settings.defaults.duration;
        fps.value = settings.defaults.fps;
      }
      const queryTemplate = router.query.value.template;
      if (queryTemplate) {
        const template = appStore.templates.value.find((item) => item.id === queryTemplate);
        if (template) applyTemplate(template);
      }
    })();
  });

  function applyTemplate(template: TemplateInfo): void {
    templateId.value = template.id;
    engine.value = template.engine;
    aspect.value = template.aspectRatio as AspectRatio;
    duration.value = template.duration;
    if (!name.value) name.value = template.name;
    if (!brief.value) brief.value = template.description;
  }

  function engineAvailable(id: EngineId): boolean {
    return appStore.engines.value.find((item) => item.id === id)?.available ?? false;
  }

  function next(): void {
    error.value = "";
    if (step.value === 1) {
      if (!name.value.trim()) {
        error.value = "Ponle un nombre al proyecto.";
        return;
      }
      if (brief.value.trim().length < 10) {
        error.value = "Describe el video en al menos 10 caracteres.";
        return;
      }
    }
    step.value = Math.min(3, step.value + 1);
  }

  function back(): void {
    if (step.value > 1) step.value -= 1;
    else router.navigate("/projects");
  }

  async function create(): Promise<void> {
    if (creating.value) return;
    error.value = "";
    if (!name.value.trim()) {
      error.value = "El nombre es obligatorio.";
      step.value = 1;
      return;
    }
    if (!engineAvailable(engine.value)) {
      error.value = `${engineLabel(engine.value)} no está disponible. Instálalo o elige otro motor.`;
      step.value = 2;
      return;
    }
    creating.value = true;
    const project = await appStore.createProject({
      name: name.value.trim(),
      brief: brief.value.trim(),
      engine: engine.value,
      aspectRatio: aspect.value,
      durationTarget: duration.value,
      fps: fps.value,
      style: style.value,
      ...(templateId.value ? { templateId: templateId.value } : {}),
    });
    creating.value = false;
    if (project) {
      router.navigate(`/projects/${project.id}`);
    }
  }

  const selectedTemplate = (): TemplateInfo | null =>
    appStore.templates.value.find((template) => template.id === templateId.value) ?? null;

  return html`
    <div class="page page--wizard">
      ${pageHeader(
        "Nuevo proyecto",
        "Define la idea, el formato y el motor. Podrás cambiarlo después.",
        button("Volver", { variant: "ghost", size: "sm", icon: "arrow-left", onClick: () => router.navigate("/projects") }),
        "Crear",
      )}

      <div class="wizard-steps" aria-label="Pasos">
        ${[
          ["1", "Idea"],
          ["2", "Formato"],
          ["3", "Revisión"],
        ].map(
          ([number, label], index) => html`
            <div class=${() => `wizard-step ${step.value === index + 1 ? "wizard-step--active" : ""} ${step.value > index + 1 ? "wizard-step--done" : ""}`}>
              <span class="wizard-step__number">${step.value > index + 1 ? "✓" : number}</span>
              <span>${label}</span>
            </div>
          `,
        )}
      </div>

      <div class="wizard-shell">
        <section class="wizard-panel" show=${() => step.value === 1}>
          <div class="wizard-panel__head">
            <h2>La idea</h2>
            <p>Cuanto más concreto el brief, mejor el código que escribe el agente.</p>
          </div>
          <div class="form-stack">
            ${field(
              "Nombre del proyecto",
              html`<input
                class="input input--lg"
                type="text"
                maxlength="120"
                placeholder="Ej. Energía solar · explainer"
                value=${() => name.value}
                @input=${(event: Event) => {
                  name.value = (event.target as HTMLInputElement).value;
                }}
              />`,
            )}
            ${field(
              "Brief",
              html`<textarea
                class="textarea"
                rows="6"
                maxlength="8000"
                placeholder="Describe el video: duración, tono, colores, qué debe aparecer, qué evitar…"
                value=${() => brief.value}
                @input=${(event: Event) => {
                  brief.value = (event.target as HTMLTextAreaElement).value;
                }}
              ></textarea>`,
              "Mínimo 10 caracteres. Incluye estilo y objetivo.",
            )}
            <div class="field">
              <span class="field__label">Plantilla (opcional)</span>
              <div class="mini-template-grid">
                <button
                  class=${() => `mini-template ${templateId.value === null ? "mini-template--active" : ""}`}
                  type="button"
                  @click=${() => {
                    templateId.value = null;
                  }}
                >
                  <span class="mini-template__icon">${raw(icon("plus", 18))}</span>
                  <strong>En blanco</strong>
                  <span>Sin archivos base</span>
                </button>
                ${() =>
                  appStore.templates.value.map(
                    (template) => html`
                      <button
                        class=${() => `mini-template ${templateId.value === template.id ? "mini-template--active" : ""}`}
                        type="button"
                        @click=${() => applyTemplate(template)}
                      >
                        <span class="mini-template__icon">${raw(icon(template.engine === "manim" ? "layers" : "film", 18))}</span>
                        <strong>${template.name}</strong>
                        <span>${engineLabel(template.engine)} · ${formatSeconds(template.duration)}</span>
                      </button>
                    `,
                  )}
              </div>
            </div>
            <div class="two-col">
              ${field(
                "Estilo",
                html`<select
                  class="select"
                  value=${() => style.value}
                  @change=${(event: Event) => {
                    style.value = (event.target as HTMLSelectElement).value;
                  }}
                >
                  <option value="dark-cinematic">Dark cinematic</option>
                  <option value="tech">Tech / terminal</option>
                  <option value="editorial">Editorial</option>
                  <option value="minimal">Minimal</option>
                  <option value="vibrant">Vibrant</option>
                </select>`,
              )}
              ${field(
                "Duración objetivo",
                html`<div class="input-with-suffix">
                  <input
                    class="input"
                    type="number"
                    min="1"
                    max="120"
                    step="1"
                    value=${() => String(duration.value)}
                    @input=${(event: Event) => {
                      duration.value = Number((event.target as HTMLInputElement).value);
                    }}
                  />
                  <span>segundos</span>
                </div>`,
              )}
            </div>
          </div>
        </section>

        <section class="wizard-panel" show=${() => step.value === 2}>
          <div class="wizard-panel__head">
            <h2>El formato</h2>
            <p>El motor determina qué código escribirá el agente y qué calidad esperar.</p>
          </div>
          <div class="form-stack">
            <div class="field">
              <span class="field__label">Aspecto</span>
              <div class="aspect-grid">
                ${aspectOptions().map(
                  (option) => html`
                    <button
                      class=${() => `aspect-card ${aspect.value === option.value ? "aspect-card--active" : ""}`}
                      type="button"
                      @click=${() => {
                        aspect.value = option.value as AspectRatio;
                      }}
                    >
                      <span class="aspect-card__shape aspect-card__shape--${option.value.replace(":", "-")}"></span>
                      <strong>${option.label}</strong>
                      <span>${option.hint}</span>
                    </button>
                  `,
                )}
              </div>
            </div>
            <div class="two-col">
              ${field(
                "FPS",
                html`<select
                  class="select"
                  value=${() => String(fps.value)}
                  @change=${(event: Event) => {
                    fps.value = Number((event.target as HTMLSelectElement).value);
                  }}
                >
                  <option value="24">24 fps · cine</option>
                  <option value="30">30 fps · estándar</option>
                  <option value="60">60 fps · suave</option>
                </select>`,
              )}
              ${field(
                "Duración",
                html`<div class="input-with-suffix">
                  <input
                    class="input"
                    type="number"
                    min="1"
                    max="120"
                    value=${() => String(duration.value)}
                    @input=${(event: Event) => {
                      duration.value = Number((event.target as HTMLInputElement).value);
                    }}
                  />
                  <span>segundos</span>
                </div>`,
              )}
            </div>
            <div class="field">
              <span class="field__label">Motor de render</span>
              <div class="engine-grid">
                ${() =>
                  (["ffmpeg", "pillow", "manim", "remotion"] as EngineId[]).map((id) => {
                    const available = engineAvailable(id);
                    return html`
                      <button
                        class=${() => `engine-card ${engine.value === id ? "engine-card--active" : ""} ${!available ? "engine-card--disabled" : ""}`}
                        type="button"
                        disabled=${!available}
                        @click=${() => {
                          if (available) engine.value = id;
                        }}
                      >
                        <div class="engine-card__top">
                          ${engineBadge(id)}
                          <span class=${available ? "dot dot--success" : "dot dot--neutral"}></span>
                        </div>
                        <strong>${engineLabel(id)}</strong>
                        <p>${ENGINE_DESCRIPTIONS[id]}</p>
                        <span class="engine-card__state">${available ? "Disponible" : "No instalado"}</span>
                      </button>
                    `;
                  })}
              </div>
            </div>
          </div>
        </section>

        <section class="wizard-panel" show=${() => step.value === 3}>
          <div class="wizard-panel__head">
            <h2>Revisión</h2>
            <p>Esto es lo que Videur va a crear. Podrás editar los archivos después.</p>
          </div>
          <div class="review-grid">
            <div class="review-card">
              <span class="review-card__label">Proyecto</span>
              <strong>${() => name.value || "Sin nombre"}</strong>
              <p>${() => brief.value || "Sin brief"}</p>
            </div>
            <div class="review-card">
              <span class="review-card__label">Formato</span>
              <strong>${() => `${aspect.value} · ${fps.value} fps · ${duration.value}s`}</strong>
              <p>${() => `${engineLabel(engine.value)} · estilo ${style.value}`}</p>
            </div>
            <div class="review-card">
              <span class="review-card__label">Plantilla</span>
              <strong>${() => selectedTemplate()?.name ?? "En blanco"}</strong>
              <p>${() => (selectedTemplate() ? selectedTemplate()!.files.join(", ") : "El agente escribirá los archivos desde cero")}</p>
            </div>
            <div class="review-card">
              <span class="review-card__label">Salida esperada</span>
              <strong>MP4 + hoja de contactos + QA</strong>
              <p>${() => `${engineLabel(engine.value)} · ${appStore.engines.value.find((e) => e.id === engine.value)?.version ?? "—"}`}</p>
            </div>
          </div>
          ${() =>
            !engineAvailable(engine.value)
              ? html`
                  <div class="alert alert--warn">
                    ${raw(icon("alert", 18))}
                    <div>
                      <strong>${engineLabel(engine.value)} no está disponible</strong>
                      <p>Instálalo o elige otro motor antes de crear el proyecto.</p>
                    </div>
                  </div>
                `
              : null}
        </section>

        ${() => (error.value ? html`<div class="alert alert--error">${raw(icon("alert", 18))}<span>${error.value}</span></div>` : null)}

        <footer class="wizard-footer">
          <button class="btn btn--ghost" type="button" @click=${back}>
            ${raw(icon("arrow-left", 16))}
            <span>${() => (step.value === 1 ? "Cancelar" : "Atrás")}</span>
          </button>
          <div class="wizard-footer__right">
            <span class="muted">Paso ${() => step.value} de 3</span>
            ${() =>
              step.value < 3
                ? button("Continuar", { variant: "primary", icon: "arrow-right", onClick: next })
                : button(creating.value ? "Creando…" : "Crear proyecto", {
                    variant: "primary",
                    icon: "sparkles",
                    disabled: () => creating.value || !engineAvailable(engine.value),
                    onClick: () => void create(),
                  })}
          </div>
        </footer>
      </div>
    </div>
  `;
});
