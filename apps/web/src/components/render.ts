import { html, raw } from "@elurjs/core";
import type { ElurTemplate } from "@elurjs/core";
import type { MediaMetadata, QaReport, Render } from "@videur/contracts";
import {
  formatBytes,
  formatDate,
  formatDurationMs,
  formatSeconds,
  qaTone,
  statusLabel,
  statusTone,
} from "../lib/format";
import { icon } from "../lib/icons";
import type { LogLine } from "../lib/store";
import { badge, button, emptyState, progressBar, statusBadge } from "./ui";

export function RenderList(
  renders: Render[],
  selectedId: string | null,
  onSelect: (render: Render) => void,
  onCancel: (render: Render) => void,
): ElurTemplate {
  if (renders.length === 0) {
    return emptyState("film", "Sin renders", "Renderiza el proyecto para ver el resultado aquí.");
  }
  return html`
    <div class="render-list">
      ${renders.map((render) => {
        const active = ["queued", "preparing", "running", "inspecting"].includes(render.status);
        return html`
          <div class="render-item ${selectedId === render.id ? "render-item--active" : ""}" @click=${() => onSelect(render)}>
            <div class="render-item__top">
              <span class="dot dot--${statusTone(render.status)}"></span>
              <span class="render-item__status">${statusLabel(render.status)}</span>
              <span class="render-item__engine">${render.engine}</span>
            </div>
            <div class="render-item__meta">
              <span>${formatDate(render.createdAt)}</span>
              <span>${render.durationMs !== null ? formatDurationMs(render.durationMs) : active ? "en curso" : "—"}</span>
            </div>
            ${active
              ? html`
                  <div class="render-item__progress">
                    ${progressBar(render.progress, render.stage)}
                    <button
                      class="btn btn--ghost btn--sm"
                      type="button"
                      @click=${(event: Event) => {
                        event.stopPropagation();
                        onCancel(render);
                      }}
                    >
                      ${raw(icon("stop", 13))}
                      <span>Cancelar</span>
                    </button>
                  </div>
                `
              : null}
            ${render.error ? html`<div class="render-item__error">${render.error}</div>` : null}
          </div>
        `;
      })}
    </div>
  `;
}

export function VideoPreview(render: Render | null): ElurTemplate {
  if (!render || !render.videoUrl) {
    return emptyState(
      "film",
      "Aún no hay video",
      "Cuando un render termine correctamente, podrás reproducirlo aquí.",
    );
  }
  return html`
    <div class="video-preview">
      <div class="video-preview__frame">
        <video controls preload="metadata" playsinline src=${render.videoUrl}></video>
      </div>
      <div class="video-preview__bar">
        <div class="video-preview__meta">
          ${statusBadge(render.status)}
          <span>${render.metadata?.video ? `${render.metadata.video.width}×${render.metadata.video.height}` : "—"}</span>
          <span>${render.metadata ? formatSeconds(render.metadata.duration) : "—"}</span>
          <span>${render.metadata ? formatBytes(render.metadata.size) : "—"}</span>
        </div>
        <a class="btn btn--secondary btn--sm" href=${render.videoUrl} download>
          ${raw(icon("download", 14))}
          <span>Descargar</span>
        </a>
      </div>
    </div>
  `;
}

export function ContactSheet(render: Render | null): ElurTemplate {
  if (!render || !render.contactSheetUrl) {
    return emptyState("image", "Sin hoja de contactos", "La hoja 4×4 se genera al terminar el render.");
  }
  return html`
    <div class="contact-sheet">
      <img src=${render.contactSheetUrl} alt="Hoja de contactos del render" loading="lazy" />
      <div class="contact-sheet__bar">
        <span>${raw(icon("image", 15))} 16 frames · 4×4</span>
        <a class="btn btn--ghost btn--sm" href=${render.contactSheetUrl} download>
          ${raw(icon("download", 14))}
          <span>Descargar</span>
        </a>
      </div>
    </div>
  `;
}

export function MetadataTable(metadata: MediaMetadata | null): ElurTemplate {
  if (!metadata) return html`<p class="muted">Sin metadata.</p>`;
  const rows: Array<[string, string]> = [
    ["Duración", formatSeconds(metadata.duration)],
    ["Tamaño", formatBytes(metadata.size)],
    ["Formato", metadata.format],
    ["Bitrate", metadata.bitrate ? `${Math.round(metadata.bitrate / 1000)} kbps` : "—"],
    ["Video", metadata.video ? `${metadata.video.codec} · ${metadata.video.profile ?? ""}` : "—"],
    ["Resolución", metadata.video ? `${metadata.video.width}×${metadata.video.height}` : "—"],
    ["FPS", metadata.video ? String(metadata.video.fps) : "—"],
    ["Pixel format", metadata.video?.pixFmt ?? "—"],
    ["Audio", metadata.audio ? `${metadata.audio.codec} · ${metadata.audio.sampleRate} Hz · ${metadata.audio.channels}ch` : "Sin audio"],
  ];
  return html`
    <dl class="metadata-table">
      ${rows.map(
        ([label, value]) => html`
          <div class="metadata-table__row">
            <dt>${label}</dt>
            <dd>${value}</dd>
          </div>
        `,
      )}
    </dl>
  `;
}

export function QaPanel(qa: QaReport | null): ElurTemplate {
  if (!qa) {
    return emptyState("shield", "Sin QA", "El reporte de calidad aparece después del render.");
  }
  const errors = qa.checks.filter((check) => check.status === "fail").length;
  const warnings = qa.checks.filter((check) => check.status === "warn").length;
  return html`
    <div class="qa-panel">
      <div class="qa-panel__summary">
        <div class="qa-panel__score ${qa.ok ? "qa-panel__score--ok" : "qa-panel__score--bad"}">
          ${raw(icon(qa.ok ? "check" : "alert", 20))}
          <span>${qa.ok ? "QA OK" : "QA con errores"}</span>
        </div>
        <div class="qa-panel__counts">
          ${badge(`${errors} errores`, errors ? "danger" : "neutral")}
          ${badge(`${warnings} warnings`, warnings ? "warn" : "neutral")}
        </div>
      </div>
      <div class="qa-panel__checks">
        ${qa.checks.map(
          (check) => html`
            <div class="qa-check qa-check--${qaTone(check.status)}">
              <span class="qa-check__icon">${raw(icon(check.status === "pass" ? "check" : check.status === "fail" ? "x" : check.status === "warn" ? "alert" : "circle", 14))}</span>
              <span class="qa-check__id">${check.id}</span>
              <span class="qa-check__message">${check.message}</span>
            </div>
          `,
        )}
      </div>
      ${qa.vision
        ? html`
            <div class="qa-panel__vision">
              <h4>Revisión visual</h4>
              <p>${qa.vision.summary ?? "Sin resumen"}</p>
              ${qa.vision.issues.length
                ? html`<ul>${qa.vision.issues.map((issue) => html`<li>${issue.frame ? `[${issue.frame}] ` : ""}${issue.problem}</li>`)}</ul>`
                : null}
            </div>
          `
        : null}
    </div>
  `;
}

export function LogViewer(logs: LogLine[], onRefresh?: () => void): ElurTemplate {
  const visible = logs.slice(-500);
  return html`
    <div class="log-viewer">
      <div class="log-viewer__bar">
        <span>${raw(icon("terminal", 14))} Consola</span>
        <div class="log-viewer__actions">
          <span class="muted">${visible.length} líneas</span>
          ${onRefresh ? button("Refrescar", { variant: "ghost", size: "sm", icon: "refresh", onClick: onRefresh }) : null}
        </div>
      </div>
      <div class="log-viewer__body">
        ${visible.length === 0
          ? html`<div class="log-viewer__empty">Sin logs todavía.</div>`
          : visible.map(
              (log) => html`<div class="log-line log-line--${log.stream}">${log.line}</div>`,
            )}
      </div>
    </div>
  `;
}
