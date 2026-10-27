import type { MediaMetadata, Project, QaCheck, QaReport, QaStatus } from "@videur/contracts";
import type { BlackInterval } from "./blackdetect";
import type { FreezeInterval } from "./freezedetect";

export interface QaInput {
  metadata: MediaMetadata | null;
  project: Pick<Project, "width" | "height" | "fps" | "durationTarget">;
  fileExists: boolean;
  contactSheetExists: boolean;
  blackIntervals?: BlackInterval[];
  blackChecked?: boolean;
  freezeIntervals?: FreezeInterval[];
  freezeChecked?: boolean;
}

function check(id: string, status: QaStatus, message: string, details?: Record<string, unknown>): QaCheck {
  return { id, status, message, ...(details ? { details } : {}) };
}

export function createQaReport(input: QaInput): QaReport {
  const checks: QaCheck[] = [];
  const { metadata, project } = input;

  checks.push(
    input.fileExists
      ? check("file_exists", "pass", "El archivo de video existe")
      : check("file_exists", "fail", "No se encontró el archivo de video"),
  );

  if (!metadata) {
    checks.push(check("metadata", "fail", "No se pudo leer la metadata del video"));
    return finalize(checks, metadata);
  }

  if (metadata.video) {
    checks.push(
      check(
        "has_video",
        "pass",
        `${metadata.video.codec.toUpperCase()} ${metadata.video.width}x${metadata.video.height}`,
      ),
    );
  } else {
    checks.push(check("has_video", "fail", "El archivo no tiene stream de video"));
  }

  if (metadata.duration > 0.1) {
    checks.push(check("duration", "pass", `Duración ${metadata.duration.toFixed(2)} s`));
  } else {
    checks.push(check("duration", "fail", "La duración es cero o inválida"));
  }

  if (metadata.video) {
    const widthDiff = Math.abs(metadata.video.width - project.width);
    const heightDiff = Math.abs(metadata.video.height - project.height);
    if (widthDiff > 2 || heightDiff > 2) {
      checks.push(
        check(
          "resolution",
          "warn",
          `Resolución ${metadata.video.width}x${metadata.video.height} distinta del objetivo ${project.width}x${project.height}`,
        ),
      );
    } else {
      checks.push(check("resolution", "pass", "Resolución coincide con el proyecto"));
    }

    if (Math.abs(metadata.video.fps - project.fps) > 0.6) {
      checks.push(
        check("fps", "warn", `FPS ${metadata.video.fps} distinto del objetivo ${project.fps}`),
      );
    } else {
      checks.push(check("fps", "pass", `FPS ${metadata.video.fps}`));
    }

    if (metadata.video.pixFmt !== "yuv420p") {
      checks.push(
        check(
          "pixel_format",
          "warn",
          `pix_fmt ${metadata.video.pixFmt}; usa yuv420p para compatibilidad universal`,
        ),
      );
    } else {
      checks.push(check("pixel_format", "pass", "pix_fmt yuv420p"));
    }
  }

  const target = project.durationTarget;
  if (target > 0 && metadata.duration > 0) {
    const tolerance = Math.max(1, target * 0.2);
    if (Math.abs(metadata.duration - target) > tolerance) {
      checks.push(
        check(
          "duration_target",
          "warn",
          `Duración ${metadata.duration.toFixed(2)} s difiere del objetivo ${target.toFixed(2)} s`,
        ),
      );
    } else {
      checks.push(check("duration_target", "pass", "Duración dentro del objetivo"));
    }
  }

  checks.push(
    metadata.audio
      ? check("audio", "info", `Audio ${metadata.audio.codec} ${metadata.audio.sampleRate} Hz`)
      : check("audio", "info", "Sin stream de audio"),
  );

  if (input.blackChecked && input.blackIntervals) {
    const totalBlack = input.blackIntervals.reduce((sum, interval) => sum + interval.duration, 0);
    if (metadata.duration > 0 && totalBlack / metadata.duration > 0.8) {
      checks.push(
        check("black_frames", "warn", `El ${Math.round((totalBlack / metadata.duration) * 100)}% del video es negro`),
      );
    } else if (input.blackIntervals.length > 0) {
      checks.push(
        check("black_frames", "info", `${input.blackIntervals.length} intervalo(s) negro(s) detectado(s)`),
      );
    } else {
      checks.push(check("black_frames", "pass", "No se detectaron frames negros"));
    }
  }

  if (input.freezeChecked && input.freezeIntervals) {
    const totalFreeze = input.freezeIntervals.reduce((sum, interval) => sum + interval.duration, 0);
    const ratio = metadata.duration > 0 ? totalFreeze / metadata.duration : 0;
    if (ratio >= 0.5) {
      checks.push(
        check(
          "motion",
          "warn",
          `El video está congelado el ${Math.round(ratio * 100)}% del tiempo; agrega movimiento continuo (oscilación/pulso/loop).`,
          { freezeIntervals: input.freezeIntervals },
        ),
      );
    } else if (input.freezeIntervals.length > 0) {
      checks.push(
        check(
          "motion",
          "info",
          `${input.freezeIntervals.length} tramo(s) congelado(s), ${Math.round(ratio * 100)}% del video`,
        ),
      );
    } else {
      checks.push(check("motion", "pass", "Movimiento continuo detectado"));
    }
  }

  checks.push(
    input.contactSheetExists
      ? check("contact_sheet", "pass", "Hoja de contactos generada")
      : check("contact_sheet", "warn", "No se pudo generar la hoja de contactos"),
  );

  return finalize(checks, metadata);
}

function finalize(checks: QaCheck[], metadata: MediaMetadata | null): QaReport {
  const errors = checks.filter((item) => item.status === "fail");
  const warnings = checks.filter((item) => item.status === "warn");
  return {
    ok: errors.length === 0,
    checks,
    warnings,
    errors,
    metadata,
    reviewedAt: new Date().toISOString(),
  };
}
