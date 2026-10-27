import type { EngineId, QaStatus, RenderStatus } from "@videur/contracts";

export function formatDate(value: string | null | undefined): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("es", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export function formatRelative(value: string | null | undefined): string {
  if (!value) return "—";
  const date = new Date(value).getTime();
  if (!Number.isFinite(date)) return "—";
  const diff = Date.now() - date;
  const minutes = Math.round(diff / 60000);
  if (minutes < 1) return "ahora";
  if (minutes < 60) return `hace ${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `hace ${hours} h`;
  const days = Math.round(hours / 24);
  if (days < 30) return `hace ${days} d`;
  return formatDate(value);
}

export function formatDurationMs(ms: number | null | undefined): string {
  if (ms === null || ms === undefined) return "—";
  if (ms < 1000) return `${Math.round(ms)} ms`;
  const seconds = ms / 1000;
  if (seconds < 60) return `${seconds.toFixed(1)} s`;
  return `${Math.floor(seconds / 60)}m ${Math.round(seconds % 60)}s`;
}

export function formatSeconds(seconds: number | null | undefined): string {
  if (seconds === null || seconds === undefined || !Number.isFinite(seconds)) return "—";
  return `${seconds.toFixed(seconds < 10 ? 1 : 0)} s`;
}

export function formatBytes(bytes: number | null | undefined): string {
  if (!bytes) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  let value = bytes;
  let index = 0;
  while (value >= 1024 && index < units.length - 1) {
    value /= 1024;
    index++;
  }
  return `${value.toFixed(value >= 10 || index === 0 ? 0 : 1)} ${units[index]}`;
}

export function formatPercent(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "0%";
  return `${Math.round(value * 100)}%`;
}

export const ENGINE_LABELS: Record<EngineId, string> = {
  ffmpeg: "FFmpeg",
  pillow: "Pillow",
  manim: "Manim",
  remotion: "Remotion",
};

export const ENGINE_DESCRIPTIONS: Record<EngineId, string> = {
  ffmpeg: "Sintético, rápido, filtros y audio",
  pillow: "Datos, gráficas y arte generativo",
  manim: "Matemáticas y explicaciones técnicas",
  remotion: "UI, tipografía y motion graphics",
};

export const ENGINE_ACCENTS: Record<EngineId, string> = {
  ffmpeg: "cyan",
  pillow: "amber",
  manim: "violet",
  remotion: "green",
};

export function engineLabel(engine: EngineId): string {
  return ENGINE_LABELS[engine] ?? engine;
}

export function statusLabel(status: RenderStatus | string): string {
  const labels: Record<string, string> = {
    queued: "En cola",
    preparing: "Preparando",
    running: "Renderizando",
    inspecting: "Inspeccionando",
    succeeded: "Completado",
    failed: "Fallido",
    cancelled: "Cancelado",
    draft: "Borrador",
    ready: "Listo",
    rendering: "Renderizando",
    error: "Error",
    archived: "Archivado",
  };
  return labels[status] ?? status;
}

export function statusTone(status: RenderStatus | string): "neutral" | "info" | "success" | "warn" | "danger" {
  if (status === "succeeded" || status === "ready") return "success";
  if (status === "failed" || status === "error") return "danger";
  if (status === "cancelled" || status === "queued") return "warn";
  if (status === "running" || status === "preparing" || status === "inspecting" || status === "rendering") return "info";
  return "neutral";
}

export function qaTone(status: QaStatus | string): "success" | "warn" | "danger" | "neutral" {
  if (status === "pass") return "success";
  if (status === "warn") return "warn";
  if (status === "fail") return "danger";
  return "neutral";
}

export function shortId(id: string): string {
  return id.length > 14 ? `${id.slice(0, 8)}…${id.slice(-4)}` : id;
}

export function aspectOptions(): Array<{ value: string; label: string; hint: string }> {
  return [
    { value: "16:9", label: "16:9", hint: "YouTube / desktop" },
    { value: "9:16", label: "9:16", hint: "Reels / TikTok" },
    { value: "1:1", label: "1:1", hint: "Feed cuadrado" },
    { value: "4:5", label: "4:5", hint: "Instagram" },
    { value: "4:3", label: "4:3", hint: "Clásico" },
    { value: "21:9", label: "21:9", hint: "Cine" },
  ];
}

export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
