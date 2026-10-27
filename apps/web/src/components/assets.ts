import { html, raw, signal } from "@elurjs/core";
import type { ProjectAsset } from "@videur/contracts";
import { appStore } from "../lib/store";
import { formatBytes } from "../lib/format";
import { icon } from "../lib/icons";
import { button, emptyState } from "./ui";

const ACCEPT = [
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
  "image/avif",
  "audio/mpeg",
  "audio/wav",
  "audio/ogg",
  "audio/mp4",
  "audio/aac",
  "audio/flac",
  ".ttf",
  ".otf",
  ".woff",
  ".woff2",
].join(",");

function assetCard(projectId: string, asset: ProjectAsset) {
  const copy = (): void => {
    void navigator.clipboard
      .writeText(asset.path)
      .then(() => appStore.toast("Ruta copiada", "success"))
      .catch(() => appStore.toast("No se pudo copiar la ruta", "error"));
  };
  const remove = (): void => {
    if (confirm(`¿Eliminar ${asset.name}?`)) void appStore.deleteAsset(projectId, asset.path);
  };

  return html`
    <article class="asset-card">
      <div class="asset-card__preview">
        ${asset.kind === "image"
          ? html`<img src=${asset.url} alt=${asset.name} loading="lazy" />`
          : asset.kind === "audio"
            ? html`<div class="asset-card__audio">
                <span class="asset-card__audio-icon">${raw(icon("activity", 24))}</span>
                <audio controls preload="metadata" src=${asset.url}></audio>
              </div>`
            : html`<div class="asset-card__font">
                <span>Aa</span>
                <small>${asset.kind}</small>
              </div>`}
      </div>
      <div class="asset-card__body">
        <div class="asset-card__title">
          <strong title=${asset.name}>${asset.name}</strong>
          <span class="asset-card__kind">${asset.kind}</span>
        </div>
        <div class="asset-card__meta">${formatBytes(asset.size)} · ${asset.mime}</div>
        <button class="asset-card__path" type="button" title="Copiar ruta" @click=${copy}>
          ${raw(icon("code", 12))} ${asset.path}
        </button>
        <div class="asset-card__actions">
          <button class="link-btn" type="button" @click=${copy}>Copiar ruta</button>
          <button class="link-btn link-btn--danger" type="button" @click=${remove}>Eliminar</button>
        </div>
      </div>
    </article>
  `;
}

export function AssetsPanel(projectId: string) {
  const uploading = signal(false);
  const inputId = `asset-upload-${projectId}`;

  const upload = async (files: FileList | null): Promise<void> => {
    if (!files || files.length === 0) return;
    uploading.value = true;
    try {
      await appStore.uploadAssets(projectId, Array.from(files));
    } finally {
      uploading.value = false;
    }
  };

  return html`
    <div class="assets-panel">
      <div class="assets-panel__head">
        <div>
          <h2>Assets</h2>
          <p>Imágenes, audio y fuentes del proyecto. Se guardan en <code>assets/</code>.</p>
        </div>
        <div class="assets-panel__actions">
          <label class="btn btn--primary btn--md" for=${inputId}>
            ${raw(icon("plus", 16))}
            <span>${() => (uploading.value ? "Subiendo…" : "Subir asset")}</span>
          </label>
          <input
            id=${inputId}
            class="sr-only"
            type="file"
            accept=${ACCEPT}
            multiple
            @change=${(event: Event) => {
              const input = event.target as HTMLInputElement;
              void upload(input.files);
              input.value = "";
            }}
          />
        </div>
      </div>

      <div
        class="assets-drop"
        @dragover=${(event: Event) => {
          event.preventDefault();
        }}
        @drop=${(event: Event) => {
          event.preventDefault();
          const data = (event as DragEvent).dataTransfer;
          void upload(data?.files ?? null);
        }}
      >
        ${() =>
          appStore.assets.value.length === 0
            ? emptyState(
                "image",
                "Sin assets todavía",
                "Sube una imagen, un audio o una fuente para usarla desde el código del proyecto.",
              )
            : html`<div class="assets-grid">
                ${appStore.assets.value.map((asset) => assetCard(projectId, asset))}
              </div>`}
      </div>

      <div class="assets-panel__hint muted">
        También puedes arrastrar archivos aquí. Máximo 25 MB por asset. Formatos: PNG, JPG, WebP, GIF, AVIF, MP3, WAV, OGG, M4A, FLAC, TTF, OTF, WOFF, WOFF2.
      </div>
    </div>
  `;
}
