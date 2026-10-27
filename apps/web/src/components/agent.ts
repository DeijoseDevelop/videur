import { html, raw, repeat } from "@elurjs/core";
import type { ElurTemplate } from "@elurjs/core";
import type { Message, Provider } from "@videur/contracts";
import { formatDate } from "../lib/format";
import { icon } from "../lib/icons";
import type { ToolActivity } from "../lib/store";
import { badge, button, emptyState, iconButton } from "./ui";

function messageText(message: Message): string {
  if (message.content) return message.content;
  if (message.toolCalls?.length) return `Ejecutando ${message.toolCalls.map((call) => call.name).join(", ")}…`;
  return "";
}

export function MessageBubble(message: Message): ElurTemplate {
  if (message.role === "tool") return html``;
  const isUser = message.role === "user";
  return html`
    <div class="message message--${isUser ? "user" : "assistant"}">
      <div class="message__avatar">${raw(icon(isUser ? "circle" : "sparkles", 16))}</div>
      <div class="message__body">
        <div class="message__meta">
          <span>${isUser ? "Tú" : "Videur"}</span>
          <span>${formatDate(message.createdAt)}</span>
        </div>
        <div class="message__content">${messageText(message)}</div>
        ${message.toolCalls?.length
          ? html`
              <div class="message__tools">
                ${message.toolCalls.map((call) => badge(call.name, "violet"))}
              </div>
            `
          : null}
      </div>
    </div>
  `;
}

export function ToolActivityCard(activity: ToolActivity): ElurTemplate {
  const running = activity.status === "started";
  const tone = running ? "running" : activity.ok === false ? "error" : "ok";
  const args = activity.args ? JSON.stringify(activity.args, null, 2) : "";
  const result = activity.result ? activity.result.slice(0, 4000) : "";
  return html`
    <details class="tool-card tool-card--${tone}">
      <summary class="tool-card__summary">
        <span class="tool-card__icon">${raw(icon(running ? "activity" : activity.ok === false ? "alert" : "check", 14))}</span>
        <span class="tool-card__name">${activity.tool}</span>
        <span class="tool-card__status">${running ? "ejecutando…" : activity.ok === false ? "error" : "ok"}</span>
        ${activity.durationMs !== undefined ? html`<span class="tool-card__duration">${activity.durationMs} ms</span>` : null}
      </summary>
      ${args ? html`<pre class="tool-card__pre">${args}</pre>` : null}
      ${result ? html`<pre class="tool-card__pre tool-card__pre--result">${result}</pre>` : null}
    </details>
  `;
}

export function AgentChat(options: {
  messages: () => Message[];
  activity: () => ToolActivity[];
  draft: () => string;
  running: () => boolean;
  providers: () => Provider[];
  selectedProvider: () => string;
  onProvider: (providerId: string) => void;
  onDraft: (value: string) => void;
  onSend: (prompt: string) => void;
  onCancel: () => void;
  onClear: () => void;
  onOpenSettings: () => void;
}): ElurTemplate {
  const visibleMessages = (): Message[] => options.messages().filter((message) => message.role !== "tool");
  const suggestions = [
    "Haz un video de 8 segundos sobre energía solar, estilo oscuro, con barras animadas.",
    "Crea un título cinético para el lanzamiento de una app de finanzas.",
    "Explica el teorema de Pitágoras en 10 segundos con Manim.",
  ];

  return html`
    <section class="agent">
      <div class="agent__header">
        <div class="agent__identity">
          <span class="agent__avatar">${raw(icon("bot", 18))}</span>
          <div>
            <strong>Agente Videur</strong>
            <span class="muted">${() => (options.running() ? "trabajando…" : "listo para crear")}</span>
          </div>
        </div>
        <div class="agent__controls">
          ${() =>
            options.providers().length > 0
              ? html`
                  <select
                    class="select select--sm"
                    aria-label="Proveedor de IA"
                    value=${() => options.selectedProvider()}
                    @change=${(event: Event) => options.onProvider((event.target as HTMLSelectElement).value)}
                  >
                    ${options.providers().map(
                      (provider) => html`<option value=${provider.id}>${provider.label} · ${provider.model}</option>`,
                    )}
                  </select>
                `
              : null}
          ${() => (options.running() ? button("Cancelar", { variant: "danger", size: "sm", icon: "stop", onClick: options.onCancel }) : null)}
          ${() => (options.messages().length > 0 && !options.running() ? iconButton("trash", { label: "Borrar historial", onClick: options.onClear }) : null)}
        </div>
      </div>

      <div class="agent__messages" aria-live="polite">
        ${() =>
          visibleMessages().length === 0
            ? html`
                <div class="agent__intro">
                  <div class="agent__intro-icon">${raw(icon("sparkles", 24))}</div>
                  <h3>Describe el video. Videur escribe el código, renderiza y verifica.</h3>
                  <p>
                    Puedes pedir cambios, corregir texto cortado o cambiar el estilo.
                    El agente usa el motor seleccionado y te muestra cada tool.
                  </p>
                  <div class="agent__suggestions">
                    ${suggestions.map(
                      (suggestion) => html`
                        <button class="suggestion" type="button" @click=${() => options.onSend(suggestion)}>
                          ${suggestion}
                        </button>
                      `,
                    )}
                  </div>
                </div>
              `
            : repeat(visibleMessages(), (message) => message.id, (message) => MessageBubble(message))}
        ${() => options.activity().length > 0
          ? html`<div class="agent__activity">${repeat(options.activity(), (item) => item.id, (item) => ToolActivityCard(item))}</div>`
          : null}
      </div>

      <div class="agent__composer">
        ${() =>
          options.providers().length === 0
            ? html`
                <div class="agent__no-provider">
                  <span>${raw(icon("key", 16))} Configura un proveedor para usar el agente.</span>
                  ${button("Abrir ajustes", { variant: "secondary", size: "sm", icon: "settings", onClick: options.onOpenSettings })}
                </div>
              `
            : null}
        <textarea
          class="agent__input"
          rows="3"
          placeholder="Ej. Haz un video de 10 segundos sobre energía solar, con barras animadas y título centrado…"
          aria-label="Mensaje para el agente"
          value=${() => options.draft()}
          disabled=${() => options.running()}
          @input=${(event: Event) => options.onDraft((event.target as HTMLTextAreaElement).value)}
          @keydown=${(event: KeyboardEvent) => {
            if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
              event.preventDefault();
              if (!options.running() && options.draft().trim()) options.onSend(options.draft());
            }
          }}
        ></textarea>
        <div class="agent__composer-bar">
          <span class="muted">Ctrl/⌘ + Enter para enviar</span>
          ${button("Enviar al agente", {
            variant: "primary",
            size: "sm",
            icon: "send",
            disabled: () => options.running() || !options.draft().trim() || options.providers().length === 0,
            onClick: () => options.onSend(options.draft()),
          })}
        </div>
      </div>
    </section>
  `;
}
