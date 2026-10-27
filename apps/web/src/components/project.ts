import { html, raw, ref } from "@elurjs/core";
import type { ElurTemplate } from "@elurjs/core";
import type { FileNode, ProjectWithLastRender } from "@videur/contracts";
import {
  formatDate,
  formatDurationMs,
  formatSeconds,
  statusLabel,
  statusTone,
} from "../lib/format";
import { icon } from "../lib/icons";
import type { OpenFile } from "../lib/store";
import { badge, button, emptyState, engineBadge, iconButton, statusBadge } from "./ui";

export function ProjectCard(
  project: ProjectWithLastRender,
  onOpen: () => void,
  onDelete: () => void,
): ElurTemplate {
  const last = project.lastRender;
  return html`
    <article class="project-card project-card--${project.engine}" @click=${onOpen}>
      <div class="project-card__top">
        <div class="project-card__badges">
          ${engineBadge(project.engine)}
          ${statusBadge(project.status)}
        </div>
        <button
          class="icon-btn icon-btn--ghost project-card__delete"
          type="button"
          title="Eliminar proyecto"
          aria-label="Eliminar proyecto"
          @click=${(event: Event) => {
            event.stopPropagation();
            onDelete();
          }}
        >
          ${raw(icon("trash", 15))}
        </button>
      </div>
      <h3 class="project-card__title">${project.name}</h3>
      <p class="project-card__description">${project.description || project.brief || "Sin descripción"}</p>
      <div class="project-card__meta">
        <span>${project.width}×${project.height}</span>
        <span>${project.fps} fps</span>
        <span>${formatSeconds(project.durationTarget)}</span>
      </div>
      <div class="project-card__footer">
        <span class="project-card__render">
          ${last
            ? html`<span class="dot dot--${statusTone(last.status)}"></span> ${statusLabel(last.status)} · ${formatDate(last.createdAt)}`
            : html`<span class="dot dot--neutral"></span> Sin renders`}
        </span>
        <span class="project-card__arrow">${raw(icon("arrow-right", 16))}</span>
      </div>
    </article>
  `;
}

export function ProjectGrid(
  projects: ProjectWithLastRender[],
  onOpen: (project: ProjectWithLastRender) => void,
  onDelete: (project: ProjectWithLastRender) => void,
): ElurTemplate {
  return html`
    <div class="project-grid">
      ${projects.map((project) =>
        ProjectCard(project, () => onOpen(project), () => onDelete(project)),
      )}
    </div>
  `;
}

export function FileTree(
  files: FileNode[],
  activePath: () => string | null,
  onOpen: (path: string) => void,
): ElurTemplate {
  if (files.length === 0) {
    return html`<div class="file-tree__empty">Workspace vacío</div>`;
  }
  return html`
    <div class="file-tree" role="tree" aria-label="Archivos del proyecto">
      ${files.map((file) => {
        const isFolder = file.type === "directory";
        return html`
          <button
            class=${() => `file-tree__row ${activePath() === file.path ? "file-tree__row--active" : ""} ${isFolder ? "file-tree__row--folder" : ""}`}
            type="button"
            style="padding-left: ${10 + file.depth * 14}px"
            title=${file.path}
            @click=${() => {
              if (!isFolder) onOpen(file.path);
            }}
          >
            <span class="file-tree__icon">${raw(icon(isFolder ? "folder" : fileIcon(file.path), 14))}</span>
            <span class="file-tree__name">${file.path.split("/").pop()}</span>
          </button>
        `;
      })}
    </div>
  `;
}

function fileIcon(path: string): "file" | "code" | "image" | "terminal" {
  if (/\.(png|jpe?g|gif|webp|svg)$/i.test(path)) return "image";
  if (/\.(ts|tsx|js|jsx|py|json|css|html)$/i.test(path)) return "code";
  if (/\.sh$/i.test(path)) return "terminal";
  return "file";
}

export function CodeEditor(
  file: () => OpenFile | null,
  onDraft: (value: string) => void,
  onSave: () => void,
): ElurTemplate {
  const gutter = (): string => {
    const current = file();
    if (!current) return "";
    const count = current.draft.split("\n").length;
    return Array.from({ length: count }, (_, index) => String(index + 1)).join("\n");
  };
  const currentPath = (): string => file()?.path ?? "";
  const language = (): string => currentPath().split(".").pop()?.toUpperCase() ?? "TEXT";
  const gutterRef = ref<HTMLPreElement>();
  const editorRef = ref<HTMLTextAreaElement>();

  return html`
    <div class="editor" show=${() => Boolean(file()) && !file()?.binary}>
      <div class="editor__bar">
        <div class="editor__file">
          <span class="editor__file-icon">${raw(icon("code", 14))}</span>
          <span>${() => currentPath()}</span>
          ${() => (file()?.dirty ? html`<span class="editor__dirty" title="Cambios sin guardar"></span>` : null)}
        </div>
        <div class="editor__actions">
          <span class="editor__lang">${() => language()}</span>
          <button
            class="btn btn--primary btn--sm"
            type="button"
            @click=${onSave}
            disabled=${() => !file()?.dirty}
          >
            ${raw(icon("save", 14))}
            <span>Guardar</span>
          </button>
        </div>
      </div>
      <div class="editor__body">
        <pre class="editor__gutter" ref=${gutterRef}>${() => gutter()}</pre>
        <textarea
          class="editor__textarea"
          ref=${editorRef}
          spellcheck="false"
          aria-label=${() => `Editor de ${currentPath()}`}
          value=${() => file()?.draft ?? ""}
          @input=${(event: Event) => onDraft((event.target as HTMLTextAreaElement).value)}
          @scroll=${() => {
            const textarea = editorRef.el;
            const gutterEl = gutterRef.el;
            if (textarea && gutterEl) gutterEl.style.transform = `translateY(-${textarea.scrollTop}px)`;
          }}
          @keydown=${(event: KeyboardEvent) => {
            if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") {
              event.preventDefault();
              onSave();
            }
          }}
        ></textarea>
      </div>
      <div class="editor__status">
        <span>${() => (file() ? `${file()!.draft.split("\n").length} líneas` : "")}</span>
        <span>${() => (file() ? `${new TextEncoder().encode(file()!.draft).length} bytes` : "")}</span>
        <span>${() => (file()?.dirty ? "Sin guardar" : "Guardado")}</span>
      </div>
    </div>
    <div show=${() => !file()}>
      ${emptyState("code", "Ningún archivo abierto", "Selecciona un archivo del árbol para editarlo.")}
    </div>
    <div show=${() => Boolean(file()?.binary)}>
      ${emptyState("image", "Archivo binario", "Este archivo no se puede editar como texto.")}
    </div>
  `;
}
