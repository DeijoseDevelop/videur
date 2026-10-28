import { html, raw, signal } from "@elurjs/core";
import type { ModelInspection, ProjectAsset } from "@videur/contracts";
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
  "video/mp4",
  "video/webm",
  "video/quicktime",
  ".ttf",
  ".otf",
  ".woff",
  ".woff2",
  "model/gltf-binary",
  "model/gltf+json",
  ".glb",
  ".gltf",
  ".bin",
  ".hdr",
  ".exr",
].join(",");

function modelSummary(model: ModelInspection) {
  const dims = model.dimensions
    ? `${model.dimensions.x} × ${model.dimensions.y} × ${model.dimensions.z}`
    : "sin bounding box";
  const issues = [...model.errors, ...model.warnings];
  return html`
    <div class="asset-card__meta">
      ${model.ok ? "GLB válido" : "GLB inválido"} · ${model.triangles.toLocaleString("es")} tris ·
      ${model.textures} tex · ${dims}
    </div>
    ${issues.length > 0
      ? html`<div class=${model.ok ? "asset-card__meta" : "asset-card__meta asset-card__meta--error"}>
          ${issues.join(" · ")}
        </div>`
      : ""}
  `;
}

function transformEditor(projectId: string, asset: ProjectAsset) {
  const save = (event: Event): void => {
    event.preventDefault();
    const data = new FormData(event.target as HTMLFormElement);
    const num = (key: string): number | undefined => {
      const rawValue = data.get(key);
      if (rawValue === null || String(rawValue).trim() === "") return undefined;
      const parsed = Number(rawValue);
      return Number.isFinite(parsed) ? parsed : undefined;
    };
    void appStore.saveAssetTransform(projectId, asset.path, {
      rotX: num("rotX"),
      rotY: num("rotY"),
      rotZ: num("rotZ"),
    });
  };
  const field = (name: string, label: string, value: number | undefined) => html`
    <label class="asset-transform__field">
      <span>${label}</span>
      <input name=${name} type="number" step="1" value=${value ?? 0} />
    </label>
  `;
  return html`
    <form class="asset-transform" @submit=${save}>
      <span class="asset-transform__label">Rotación°</span>
      ${field("rotX", "X", asset.transform?.rotX)}
      ${field("rotY", "Y", asset.transform?.rotY)}
      ${field("rotZ", "Z", asset.transform?.rotZ)}
      <button class="link-btn" type="submit">Guardar</button>
    </form>
  `;
}

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
            : asset.kind === "video"
              ? html`<video class="asset-card__video" controls preload="metadata" src=${asset.url}></video>`
              : asset.kind === "model"
                ? html`<div class="asset-card__font">
                    <span>${raw(icon("layers", 28))}</span>
                    <small>3D</small>
                    ${asset.thumbnailUrl
                      ? html`<img
                          class="asset-card__thumb"
                          src=${asset.thumbnailUrl}
                          alt=${asset.name}
                          loading="lazy"
                          @error=${(event: Event) => {
                            (event.target as HTMLImageElement).style.display = "none";
                          }}
                        />`
                      : ""}
                  </div>`
                : asset.kind === "hdri"
                  ? html`<div class="asset-card__font">
                      <span>${raw(icon("sun", 28))}</span>
                      <small>HDRI</small>
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
        ${asset.model ? modelSummary(asset.model) : ""}
        ${asset.kind === "model" ? transformEditor(projectId, asset) : ""}
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

function brandCard(projectId: string) {
  const save = (event: Event): void => {
    event.preventDefault();
    const data = new FormData(event.target as HTMLFormElement);
    const text = (key: string): string | undefined => {
      const rawValue = data.get(key);
      const trimmed = rawValue === null ? "" : String(rawValue).trim();
      return trimmed === "" ? undefined : trimmed;
    };
    const marginRaw = Number(data.get("safeMargin"));
    void appStore.saveBrand(projectId, {
      accentColor: text("accentColor"),
      textColor: text("textColor"),
      fontFamily: text("fontFamily"),
      safeMargin: Number.isFinite(marginRaw) && marginRaw > 0 ? marginRaw / 100 : undefined,
    });
  };
  const brand = () => appStore.brand.value;
  const field = (name: string, label: string, value: string | undefined, type = "text") => html`
    <label class="asset-transform__field">
      <span>${label}</span>
      <input name=${name} type=${type} value=${value ?? ""} />
    </label>
  `;
  return html`
    <form class="asset-transform brand-card" @submit=${save}>
      <span class="asset-transform__label">Marca</span>
      ${() => field("accentColor", "Acento", brand()?.accentColor, "color")}
      ${() => field("textColor", "Texto", brand()?.textColor, "color")}
      ${() => field("fontFamily", "Fuente", brand()?.fontFamily)}
      ${() => html`
        <label class="asset-transform__field">
          <span>Margen %</span>
          <input
            name="safeMargin"
            type="number"
            min="0"
            max="30"
            step="1"
            value=${Math.round((brand()?.safeMargin ?? 0.1) * 100)}
          />
        </label>
      `}
      <button class="link-btn" type="submit">Guardar</button>
    </form>
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
          <p>Imágenes, audio, fuentes, video y modelos 3D. Se guardan en <code>assets/</code>.</p>
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

      ${brandCard(projectId)}

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
        También puedes arrastrar archivos aquí. Máximo 100 MB por asset. Formatos: PNG, JPG, WebP, GIF, AVIF, MP4, WebM, MOV, MP3, WAV, OGG, M4A, FLAC, TTF, OTF, WOFF, WOFF2, GLB, GLTF, BIN.
      </div>
    </div>
  `;
}
