import { defineComponent, elurRouter, html, signal } from "@elurjs/core";
import type { AspectRatio, EngineId, Provider, ProviderPreset, ProviderPresetInfo } from "@videur/contracts";
import { raw } from "@elurjs/core";
import { appStore, type AccentId, type ThemeId } from "../lib/store";
import { aspectOptions, engineLabel } from "../lib/format";
import { icon } from "../lib/icons";
import { badge, button, emptyState, field, pageHeader, spinner } from "../components/ui";

type SettingsTab = "general" | "providers" | "engines" | "about";

const THEMES: Array<{ id: ThemeId; label: string; hint: string; colors: [string, string, string] }> = [
  { id: "midnight", label: "Midnight", hint: "Azul profundo · el original", colors: ["#060a10", "#22d3ee", "#8b5cf6"] },
  { id: "aurora", label: "Aurora", hint: "Verde glacial · fresco", colors: ["#04100d", "#5eead4", "#60a5fa"] },
  { id: "ember", label: "Ember", hint: "Cálido · estudio nocturno", colors: ["#0d0806", "#fb923c", "#f43f5e"] },
  { id: "mono", label: "Mono", hint: "Grafito · alto contraste", colors: ["#08080a", "#e4e4e7", "#a1a1aa"] },
];

const ACCENTS: Array<{ id: AccentId; label: string; color: string }> = [
  { id: "cyan", label: "Cian", color: "#22d3ee" },
  { id: "violet", label: "Violeta", color: "#a78bfa" },
  { id: "emerald", label: "Esmeralda", color: "#34d399" },
  { id: "rose", label: "Rosa", color: "#fb7185" },
  { id: "amber", label: "Ámbar", color: "#fbbf24" },
];

export const SettingsPage = defineComponent((_props, ctx) => {
  const router = elurRouter();
  const tab = signal<SettingsTab>("general");

  const defaultEngine = signal<EngineId>("ffmpeg");
  const aspect = signal<AspectRatio>("16:9");
  const fps = signal(30);
  const duration = signal(6);
  const maxConcurrent = signal(1);
  const timeoutMs = signal(600000);
  const visionReview = signal(true);
  const savingGeneral = signal(false);

  const formOpen = signal(false);
  const editingId = signal<string | null>(null);
  const label = signal("");
  const preset = signal<ProviderPreset>("openai");
  const kind = signal("openai-compatible");
  const baseUrl = signal("");
  const model = signal("");
  const apiKey = signal("");
  const enabled = signal(true);
  const supportsVision = signal(true);
  const supportsTools = signal(true);
  const formError = signal("");
  const testMessage = signal("");
  const testing = signal(false);

  ctx.onMount(() => {
    void (async () => {
      await Promise.all([
        appStore.refreshSettings(),
        appStore.refreshProviders(),
        appStore.refreshEngines(),
        appStore.refreshDoctor(),
      ]);
      const settings = appStore.settings.value;
      if (settings) {
        defaultEngine.value = settings.defaults.engine;
        aspect.value = settings.defaults.aspectRatio;
        fps.value = settings.defaults.fps;
        duration.value = settings.defaults.duration;
        maxConcurrent.value = settings.render.maxConcurrent;
        timeoutMs.value = settings.render.timeoutMs;
        visionReview.value = settings.agent.visionReview;
      }
      if (appStore.presets.value.length === 0) {
        try {
          const presets = await fetch("/api/provider-presets").then((response) => response.json());
          appStore.presets.value = (presets as { items: ProviderPresetInfo[] }).items;
        } catch {
          // El bootstrap ya los carga normalmente.
        }
      }
    })();
  });

  const currentPreset = (): ProviderPresetInfo | undefined =>
    appStore.presets.value.find((item) => item.preset === preset.value);

  const applyPreset = (presetId: ProviderPreset): void => {
    const info = appStore.presets.value.find((item) => item.preset === presetId);
    preset.value = presetId;
    if (!info) return;
    kind.value = info.kind;
    baseUrl.value = info.baseUrl;
    model.value = info.defaultModel;
    supportsVision.value = info.supportsVision;
    supportsTools.value = info.supportsTools;
    if (!editingId.value) label.value = info.label;
  };

  const resetForm = (presetId: ProviderPreset = "openai"): void => {
    editingId.value = null;
    label.value = "";
    preset.value = presetId;
    kind.value = "openai-compatible";
    baseUrl.value = "";
    model.value = "";
    apiKey.value = "";
    enabled.value = true;
    supportsVision.value = true;
    supportsTools.value = true;
    formError.value = "";
    testMessage.value = "";
    applyPreset(presetId);
  };

  const openNew = (): void => {
    tab.value = "providers";
    resetForm(appStore.presets.value[0]?.preset ?? "openai");
    formOpen.value = true;
  };

  const openEdit = (provider: Provider): void => {
    tab.value = "providers";
    editingId.value = provider.id;
    label.value = provider.label;
    preset.value = provider.preset;
    kind.value = provider.kind;
    baseUrl.value = provider.baseUrl;
    model.value = provider.model;
    apiKey.value = "";
    enabled.value = provider.enabled;
    supportsVision.value = provider.supportsVision;
    supportsTools.value = provider.supportsTools;
    formError.value = "";
    testMessage.value = "";
    formOpen.value = true;
  };

  const saveProvider = async (): Promise<void> => {
    formError.value = "";
    if (!label.value.trim() || !baseUrl.value.trim() || !model.value.trim()) {
      formError.value = "Etiqueta, base URL y modelo son obligatorios.";
      return;
    }
    const ok = await appStore.saveProvider(
      {
        label: label.value.trim(),
        preset: preset.value,
        kind: kind.value as "openai-compatible" | "anthropic" | "gemini",
        baseUrl: baseUrl.value.trim(),
        model: model.value.trim(),
        ...(apiKey.value.trim() ? { apiKey: apiKey.value.trim() } : {}),
        enabled: enabled.value,
        supportsVision: supportsVision.value,
        supportsTools: supportsTools.value,
      },
      editingId.value ?? undefined,
    );
    if (ok) {
      formOpen.value = false;
      resetForm();
    }
  };

  const testProvider = async (): Promise<void> => {
    if (!editingId.value) {
      formError.value = "Guarda el proveedor antes de probar la conexión.";
      return;
    }
    testing.value = true;
    testMessage.value = "";
    const result = await appStore.testProvider(editingId.value);
    testing.value = false;
    if (result) {
      testMessage.value = result.ok
        ? `Conexión OK · ${result.latencyMs} ms${result.models.length ? ` · ${result.models.slice(0, 5).join(", ")}` : ""}`
        : `Error: ${result.error ?? "sin detalle"}`;
    }
  };

  const saveGeneral = async (): Promise<void> => {
    savingGeneral.value = true;
    await appStore.saveSettings({
      defaults: {
        engine: defaultEngine.value,
        aspectRatio: aspect.value,
        fps: fps.value,
        duration: duration.value,
        width: undefined as never,
        height: undefined as never,
      },
      agent: { visionReview: visionReview.value },
      render: { maxConcurrent: maxConcurrent.value, timeoutMs: timeoutMs.value },
    });
    savingGeneral.value = false;
  };

  return html`
    <div class="page">
      ${pageHeader(
        "Ajustes",
        "Proveedores, motores y preferencias del estudio.",
        button("Nuevo proveedor", { variant: "primary", icon: "plus", onClick: openNew }),
        "Configuración",
      )}

      <div class="settings-tabs" role="tablist">
        ${[
          ["general", "General", "settings"],
          ["providers", "Proveedores", "key"],
          ["engines", "Motores", "server"],
          ["about", "Acerca de", "shield"],
        ].map(
          ([id, text, iconName]) => html`
            <button
              class=${() => `settings-tab ${tab.value === id ? "settings-tab--active" : ""}`}
              type="button"
              role="tab"
              @click=${() => (tab.value = id as SettingsTab)}
            >
              ${raw(icon(iconName as never, 15))}
              <span>${text}</span>
            </button>
          `,
        )}
      </div>

      <section class="settings-panel" show=${() => tab.value === "general"}>
        <div class="settings-panel__head">
          <h2>Preferencias del estudio</h2>
          <p>Se aplican a los nuevos proyectos. Puedes cambiarlas por proyecto.</p>
        </div>
        <div class="appearance-block">
          <div class="appearance-block__head">
            <div>
              <h3>Apariencia</h3>
              <p>Tokens semánticos en <code>styles/tokens.css</code>. El tema y el acento se guardan en este navegador.</p>
            </div>
            ${button("Restablecer", {
              variant: "ghost",
              icon: "refresh",
              onClick: () => appStore.resetAppearance(),
            })}
          </div>

          <div class="theme-grid" role="radiogroup" aria-label="Tema de la interfaz">
            ${THEMES.map(
              (theme) => html`
                <button
                  type="button"
                  role="radio"
                  aria-checked=${() => appStore.theme.value === theme.id}
                  class=${() => `theme-card ${appStore.theme.value === theme.id ? "theme-card--active" : ""}`}
                  @click=${() => appStore.setTheme(theme.id)}
                >
                  <span class="theme-card__preview" style=${`background: linear-gradient(135deg, ${theme.colors[0]}, ${theme.colors[0]} 45%, ${theme.colors[1]} 46%, ${theme.colors[1]} 68%, ${theme.colors[2]} 69%);`}>
                    <span class="theme-card__swatch" style=${`background:${theme.colors[1]}`}></span>
                    <span class="theme-card__swatch" style=${`background:${theme.colors[2]}`}></span>
                  </span>
                  <strong>${theme.label}</strong>
                  <small>${theme.hint}</small>
                </button>
              `,
            )}
          </div>

          <div class="accent-row">
            <span class="accent-row__label">Acento</span>
            ${ACCENTS.map(
              (accent) => html`
                <button
                  type="button"
                  class=${() => `accent-swatch ${appStore.accent.value === accent.id ? "accent-swatch--active" : ""}`}
                  style=${`--swatch:${accent.color}`}
                  title=${accent.label}
                  aria-label=${`Acento ${accent.label}`}
                  aria-pressed=${() => appStore.accent.value === accent.id}
                  @click=${() => appStore.setAccent(accent.id)}
                ></button>
              `,
            )}
          </div>
        </div>

        <div class="form-grid">
          ${field(
            "Motor por defecto",
            html`<select
              class="select"
              value=${() => defaultEngine.value}
              @change=${(event: Event) => {
                defaultEngine.value = (event.target as HTMLSelectElement).value as EngineId;
              }}
            >
              <option value="ffmpeg">FFmpeg</option>
              <option value="pillow">Pillow</option>
              <option value="manim">Manim</option>
              <option value="remotion">Remotion</option>
            </select>`,
          )}
          ${field(
            "Aspecto por defecto",
            html`<select
              class="select"
              value=${() => aspect.value}
              @change=${(event: Event) => {
                aspect.value = (event.target as HTMLSelectElement).value as AspectRatio;
              }}
            >
              ${aspectOptions().map((option) => html`<option value=${option.value}>${option.label} · ${option.hint}</option>`)}
            </select>`,
          )}
          ${field(
            "FPS por defecto",
            html`<select
              class="select"
              value=${() => String(fps.value)}
              @change=${(event: Event) => {
                fps.value = Number((event.target as HTMLSelectElement).value);
              }}
            >
              <option value="24">24 fps</option>
              <option value="30">30 fps</option>
              <option value="60">60 fps</option>
            </select>`,
          )}
          ${field(
            "Duración por defecto",
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
          ${field(
            "Renders concurrentes",
            html`<input
              class="input"
              type="number"
              min="1"
              max="8"
              value=${() => String(maxConcurrent.value)}
              @input=${(event: Event) => {
                maxConcurrent.value = Number((event.target as HTMLInputElement).value);
              }}
            />`,
            "Recomendado: 1 en equipos modestos.",
          )}
          ${field(
            "Timeout por render",
            html`<div class="input-with-suffix">
              <input
                class="input"
                type="number"
                min="10000"
                max="3600000"
                step="10000"
                value=${() => String(timeoutMs.value)}
                @input=${(event: Event) => {
                  timeoutMs.value = Number((event.target as HTMLInputElement).value);
                }}
              />
              <span>ms</span>
            </div>`,
            "10 minutos por defecto.",
          )}
        </div>
        <label class="check-row">
          <input
            type="checkbox"
            checked=${() => visionReview.value}
            @change=${(event: Event) => {
              visionReview.value = (event.target as HTMLInputElement).checked;
            }}
          />
          <span>
            <strong>Revisión visual automática</strong>
            <small>Si el proveedor soporta visión, revisar la hoja de contactos al terminar.</small>
          </span>
        </label>
        <div class="settings-actions">
          ${button(savingGeneral.value ? "Guardando…" : "Guardar ajustes", {
            variant: "primary",
            icon: "save",
            disabled: () => savingGeneral.value,
            onClick: () => void saveGeneral(),
          })}
        </div>
      </section>

      <section class="settings-panel" show=${() => tab.value === "providers"}>
        <div class="settings-panel__head settings-panel__head--row">
          <div>
            <h2>Proveedores de IA</h2>
            <p>OpenAI, Anthropic, Gemini, DeepSeek, Kimi, GLM, OpenRouter, Ollama o cualquier endpoint compatible.</p>
          </div>
          ${button("Añadir proveedor", { variant: "secondary", icon: "plus", onClick: openNew })}
        </div>

        ${() =>
          formOpen.value
            ? html`
                <div class="provider-form">
                  <div class="provider-form__head">
                    <h3>${() => (editingId.value ? "Editar proveedor" : "Nuevo proveedor")}</h3>
                    ${button("Cancelar", { variant: "ghost", size: "sm", onClick: () => (formOpen.value = false) })}
                  </div>
                  <div class="preset-grid">
                    ${appStore.presets.value.map(
                      (item) => html`
                        <button
                          class=${() => `preset-card ${preset.value === item.preset ? "preset-card--active" : ""}`}
                          type="button"
                          @click=${() => applyPreset(item.preset)}
                        >
                          <strong>${item.label}</strong>
                          <span>${item.description}</span>
                        </button>
                      `,
                    )}
                  </div>
                  <div class="form-grid">
                    ${field(
                      "Etiqueta",
                      html`<input class="input" value=${() => label.value} @input=${(event: Event) => { label.value = (event.target as HTMLInputElement).value; }} />`,
                    )}
                    ${field(
                      "Tipo de API",
                      html`<select class="select" value=${() => kind.value} @change=${(event: Event) => { kind.value = (event.target as HTMLSelectElement).value; }}>
                        <option value="openai-compatible">OpenAI-compatible</option>
                        <option value="anthropic">Anthropic</option>
                        <option value="gemini">Gemini</option>
                      </select>`,
                    )}
                    ${field(
                      "Base URL",
                      html`<input class="input" value=${() => baseUrl.value} @input=${(event: Event) => { baseUrl.value = (event.target as HTMLInputElement).value; }} />`,
                    )}
                    ${field(
                      "Modelo",
                      html`<input class="input" value=${() => model.value} @input=${(event: Event) => { model.value = (event.target as HTMLInputElement).value; }} />`,
                    )}
                    ${field(
                      "API key",
                      html`<input
                        class="input"
                        type="password"
                        autocomplete="off"
                        placeholder=${() => (editingId.value ? "Dejar vacío para conservar la actual" : "sk-…")}
                        value=${() => apiKey.value}
                        @input=${(event: Event) => { apiKey.value = (event.target as HTMLInputElement).value; }}
                      />`,
                      "Se guarda cifrada con AES-256-GCM.",
                    )}
                  </div>
                  <div class="check-row-group">
                    <label class="check-row">
                      <input type="checkbox" checked=${() => enabled.value} @change=${(event: Event) => { enabled.value = (event.target as HTMLInputElement).checked; }} />
                      <span><strong>Habilitado</strong></span>
                    </label>
                    <label class="check-row">
                      <input type="checkbox" checked=${() => supportsVision.value} @change=${(event: Event) => { supportsVision.value = (event.target as HTMLInputElement).checked; }} />
                      <span><strong>Visión</strong><small>Puede analizar la hoja de contactos.</small></span>
                    </label>
                    <label class="check-row">
                      <input type="checkbox" checked=${() => supportsTools.value} @change=${(event: Event) => { supportsTools.value = (event.target as HTMLInputElement).checked; }} />
                      <span><strong>Tool calling</strong><small>Necesario para el agente.</small></span>
                    </label>
                  </div>
                  ${() => (formError.value ? html`<div class="alert alert--error">${raw(icon("alert", 16))}<span>${formError.value}</span></div>` : null)}
                  ${() => (testMessage.value ? html`<div class="alert alert--info">${raw(icon("activity", 16))}<span>${testMessage.value}</span></div>` : null)}
                  <div class="settings-actions">
                    ${button(testing.value ? "Probando…" : "Probar conexión", {
                      variant: "secondary",
                      icon: "activity",
                      disabled: () => testing.value,
                      onClick: () => void testProvider(),
                    })}
                    ${button(editingId.value ? "Guardar cambios" : "Crear proveedor", {
                      variant: "primary",
                      icon: "save",
                      onClick: () => void saveProvider(),
                    })}
                  </div>
                </div>
              `
            : null}

        ${() =>
          !formOpen.value && appStore.providers.value.length === 0
            ? emptyState(
                "key",
                "Sin proveedores",
                "Añade OpenAI, DeepSeek, Ollama o cualquier endpoint compatible para usar el agente.",
                button("Añadir proveedor", { variant: "primary", icon: "plus", onClick: openNew }),
              )
            : html`
                <div class="provider-list">
                  ${appStore.providers.value.map(
                    (provider) => html`
                      <article class="provider-card">
                        <div class="provider-card__main">
                          <div class="provider-card__top">
                            <div>
                              <h3>${provider.label}</h3>
                              <span class="muted">${provider.baseUrl}</span>
                            </div>
                            <div class="provider-card__badges">
                              ${provider.enabled ? badge("habilitado", "success", true) : badge("deshabilitado", "neutral")}
                              ${provider.supportsVision ? badge("visión", "violet") : null}
                              ${provider.supportsTools ? badge("tools", "cyan") : null}
                            </div>
                          </div>
                          <div class="provider-card__meta">
                            <span>${provider.kind}</span>
                            <span>${provider.model}</span>
                            <span>${provider.hasApiKey ? `key ${provider.apiKeyHint ?? "••••"}` : "sin key"}</span>
                          </div>
                        </div>
                        <div class="provider-card__actions">
                          ${button("Probar", { variant: "ghost", size: "sm", icon: "activity", onClick: () => void appStore.testProvider(provider.id) })}
                          ${button("Editar", { variant: "secondary", size: "sm", icon: "settings", onClick: () => openEdit(provider) })}
                          ${button("Eliminar", {
                            variant: "ghost",
                            size: "sm",
                            icon: "trash",
                            onClick: () => {
                              if (confirm(`¿Eliminar el proveedor ${provider.label}?`)) void appStore.deleteProvider(provider.id);
                            },
                          })}
                        </div>
                      </article>
                    `,
                  )}
                </div>
              `}
      </section>

      <section class="settings-panel" show=${() => tab.value === "engines"}>
        <div class="settings-panel__head settings-panel__head--row">
          <div>
            <h2>Motores y herramientas</h2>
            <p>Estado detectado en esta máquina. Revisa los hints para instalar lo que falte.</p>
          </div>
          ${button("Re-detectar", { variant: "secondary", icon: "refresh", onClick: () => void Promise.all([appStore.refreshEngines(), appStore.refreshDoctor()]) })}
        </div>
        ${() =>
          !appStore.doctor.value
            ? spinner("Detectando herramientas…")
            : html`
                <div class="engine-status-list">
                  ${appStore.doctor.value.tools.map(
                    (tool) => html`
                      <div class="engine-status">
                        <span class="dot ${tool.available ? "dot--success" : "dot--danger"}"></span>
                        <div cle}</strong>
                          <span>${tool.version ? `v${tool.version}` : "no detectado"}${tool.path ? ` · ${tool.path}` : ""}</span>
                          ${!tool.available && tool.installHint ? html`<code>${tool.installHint}</code>` : null}
                        </div>
                        ${tool.available ? badge("disponible", "success") : badge("falta", "danger")}
                      </div>
                    `,
                  )}
                </div>
                ${appStore.doctor.value.warnings.length
                  ? html`<div class="alert alert--warn">${raw(icon("alert", 16))}<div><strong>Advertencias</strong><ul>${appStore.doctor.value.warnings.map((warning) => html`<li>${warning}</li>`)}</ul></div></div>`
                  : null}
              `}
      </section>

      <section class="settings-panel" show=${() => tab.value === "about"}>
        <div class="settings-panel__head">
          <h2>Acerca de Videur</h2>
          <p>Estudio local-first de video programático. Construido con Bun, Hono, SQLite y Elur.</p>
        </div>
        <div class="about-grid">
          <div class="about-card"><span>Versión</span><strong>${appStore.health.value?.version ?? "0.1.0"}</strong></div>
          <div class="about-card"><span>Datos</span><strong class="mono">${appStore.health.value?.dataDir ?? "—"}</strong></div>
          <div class="about-card"><span>UI</span><strong>Elur 4 · Vite 8</strong></div>
          <div class="about-card"><span>API</span><strong>Hono 4 · Bun</strong></div>
        </div>
        <div class="about-links">
          <a class="btn btn--secondary btn--sm" href="https://elur.dev" target="_blank" rel="noreferrer">${raw(icon("external", 14))} Elur</a>
          <a class="btn btn--secondary btn--sm" href="https://ffmpeg.org" target="_blank" rel="noreferrer">${raw(icon("external", 14))} FFmpeg</a>
          <a class="btn btn--secondary btn--sm" href="https://www.remotion.dev" target="_blank" rel="noreferrer">${raw(icon("external", 14))} Remotion</a>
        </div>
        <div class="alert alert--info">
          ${raw(icon("shield", 18))}
          <div>
            <strong>Modo nativo = confianza local</strong>
            <p>El código generado por IA se ejecuta con los permisos de tu usuario. Para código no confiable usa Docker.</p>
          </div>
        </div>
      </section>
    </div>
  `;
});
