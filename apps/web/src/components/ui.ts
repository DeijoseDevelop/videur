import { html, raw } from "@elurjs/core";
import type { ElurTemplate } from "@elurjs/core";
import type { EngineId } from "@videur/contracts";
import { engineLabel, formatPercent, statusLabel, statusTone } from "../lib/format";
import { icon, type IconName } from "../lib/icons";
import type { Toast } from "../lib/store";

export type Tone = "neutral" | "info" | "success" | "warn" | "danger" | "violet" | "cyan";

export function iconMarkup(name: IconName, size = 18): ElurTemplate {
  return html`${raw(icon(name, size))}`;
}

export function button(
  label: string,
  options: {
    variant?: "primary" | "secondary" | "ghost" | "danger" | "subtle";
    size?: "sm" | "md" | "lg";
    icon?: IconName;
    iconRight?: IconName;
    onClick?: (event: Event) => void;
    disabled?: boolean | (() => boolean);
    type?: "button" | "submit";
    title?: string;
    class?: string;
  } = {},
): ElurTemplate {
  const variant = options.variant ?? "secondary";
  const size = options.size ?? "md";
  const type = options.type ?? "button";
  const className = `btn btn--${variant} btn--${size}${options.class ? ` ${options.class}` : ""}`;
  return html`
    <button
      class=${className}
      type=${type}
      title=${options.title ?? label}
      disabled=${options.disabled ?? false}
      @click=${options.onClick ?? (() => undefined)}
    >
      ${options.icon ? html`<span class="btn__icon">${raw(icon(options.icon, size === "sm" ? 14 : 16))}</span>` : null}
      <span>${label}</span>
      ${options.iconRight ? html`<span class="btn__icon">${raw(icon(options.iconRight, 14))}</span>` : null}
    </button>
  `;
}

export function iconButton(
  name: IconName,
  options: {
    label: string;
    onClick?: (event: Event) => void;
    variant?: "ghost" | "secondary" | "danger";
    size?: number;
    disabled?: boolean | (() => boolean);
  },
): ElurTemplate {
  const className = `icon-btn icon-btn--${options.variant ?? "ghost"}`;
  return html`
    <button
      class=${className}
      type="button"
      title=${options.label}
      aria-label=${options.label}
      disabled=${options.disabled ?? false}
      @click=${options.onClick ?? (() => undefined)}
    >
      ${raw(icon(name, options.size ?? 18))}
    </button>
  `;
}

export function badge(label: string, tone: Tone = "neutral", dot = false): ElurTemplate {
  return html`<span class="badge badge--${tone}">${dot ? html`<span class="badge__dot"></span>` : null}${label}</span>`;
}

export function engineBadge(engine: EngineId): ElurTemplate {
  const tone: Tone =
    engine === "ffmpeg" ? "cyan" : engine === "pillow" ? "warn" : engine === "manim" ? "violet" : "success";
  return badge(engineLabel(engine), tone, true);
}

export function statusBadge(status: string): ElurTemplate {
  return badge(statusLabel(status), statusTone(status), true);
}

export function statCard(
  label: string,
  value: string,
  detail: string,
  iconName: IconName,
  tone: Tone = "cyan",
): ElurTemplate {
  return html`
    <article class="stat-card stat-card--${tone}">
      <div class="stat-card__top">
        <span class="stat-card__label">${label}</span>
        <span class="stat-card__icon">${raw(icon(iconName, 18))}</span>
      </div>
      <div class="stat-card__value">${value}</div>
      <div class="stat-card__detail">${detail}</div>
    </article>
  `;
}

export function pageHeader(
  title: string,
  subtitle: string,
  actions?: ElurTemplate,
  eyebrow?: string,
): ElurTemplate {
  return html`
    <header class="page-header">
      <div class="page-header__text">
        ${eyebrow ? html`<div class="eyebrow">${eyebrow}</div>` : null}
        <h1 class="page-title">${title}</h1>
        <p class="page-subtitle">${subtitle}</p>
      </div>
      ${actions ? html`<div class="page-header__actions">${actions}</div>` : null}
    </header>
  `;
}

export function sectionHeader(title: string, subtitle?: string, actions?: ElurTemplate): ElurTemplate {
  return html`
    <div class="section-header">
      <div>
        <h2 class="section-title">${title}</h2>
        ${subtitle ? html`<p class="section-subtitle">${subtitle}</p>` : null}
      </div>
      ${actions ? html`<div class="section-actions">${actions}</div>` : null}
    </div>
  `;
}

export function emptyState(
  iconName: IconName,
  title: string,
  description: string,
  action?: ElurTemplate,
): ElurTemplate {
  return html`
    <div class="empty-state">
      <div class="empty-state__icon">${raw(icon(iconName, 26))}</div>
      <h3>${title}</h3>
      <p>${description}</p>
      ${action ? html`<div class="empty-state__action">${action}</div>` : null}
    </div>
  `;
}

export function spinner(label = "Cargando…"): ElurTemplate {
  return html`
    <div class="spinner-row" role="status">
      <span class="spinner"></span>
      <span>${label}</span>
    </div>
  `;
}

export function progressBar(value: number, stage?: string): ElurTemplate {
  const pct = Math.round(Math.max(0, Math.min(1, value)) * 100);
  return html`
    <div class="progress">
      <div class="progress__track">
        <div class="progress__fill" style="width: ${pct}%"></div>
      </div>
      <div class="progress__meta">
        <span>${formatPercent(value)}</span>
        ${stage ? html`<span>${stage}</span>` : null}
      </div>
    </div>
  `;
}

export function field(label: string, input: ElurTemplate, hint?: string): ElurTemplate {
  return html`
    <label class="field">
      <span class="field__label">${label}</span>
      ${input}
      ${hint ? html`<span class="field__hint">${hint}</span>` : null}
    </label>
  `;
}

export function toastHost(toasts: Toast[], onDismiss: (id: string) => void): ElurTemplate {
  return html`
    <div class="toast-host" aria-live="polite" aria-atomic="false">
      ${toasts.map((toast) =>
        html`
          <div class="toast toast--${toast.kind}">
            <span class="toast__icon">${raw(icon(toast.kind === "error" ? "alert" : toast.kind === "success" ? "check" : "sparkles", 16))}</span>
            <span class="toast__message">${toast.message}</span>
            <button class="toast__close" type="button" aria-label="Cerrar" @click=${() => onDismiss(toast.id)}>
              ${raw(icon("x", 14))}
            </button>
          </div>
        `,
      )}
    </div>
  `;
}

export function divider(): ElurTemplate {
  return html`<div class="divider"></div>`;
}

export function skeleton(lines = 3): ElurTemplate {
  return html`
    <div class="skeleton-stack">
      ${Array.from({ length: lines }, (_, index) =>
        html`<div class="skeleton" style="width: ${index === lines - 1 ? "60%" : "100%"}"></div>`,
      )}
    </div>
  `;
}
