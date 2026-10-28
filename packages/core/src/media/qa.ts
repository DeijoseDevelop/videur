import type { MediaMetadata, Project, QaCheck, QaReport, QaStatus } from "@videur/contracts";
import type { BlackInterval } from "./blackdetect";
import type { ProductBoundsResult } from "./framing";
import type { FreezeInterval } from "./freezedetect";

export interface QaInput {
  metadata: MediaMetadata | null;
  project: Pick<Project, "width" | "height" | "fps" | "durationTarget">;
  fileExists: boolean;
  contactSheetExists: boolean;
  coverExists?: boolean;
  blackIntervals?: BlackInterval[];
  blackChecked?: boolean;
  freezeIntervals?: FreezeInterval[];
  freezeChecked?: boolean;
  integratedLufs?: number | null;
  truePeakDb?: number | null;
  loudnessChecked?: boolean;
  /** Luma media del centro del frame en varios instantes (canvas/escena vacía). */
  centerLuma?: number[];
  /** Caja del contenido en la zona útil del producto (encuadre 3D). */
  productBounds?: ProductBoundsResult;
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

  if (input.centerLuma && input.centerLuma.length > 0) {
    const max = Math.max(...input.centerLuma);
    if (max < 14) {
      checks.push(
        check(
          "center_luma",
          "warn",
          `El centro del frame está casi negro en todas las muestras (máx YAVG ${max.toFixed(1)}/255): posible canvas WebGL vacío o escena sin contenido. Revisa que el producto/fondo se vean.`,
          { samples: input.centerLuma },
        ),
      );
    } else {
      checks.push(
        check("center_luma", "pass", `Contenido visible en el centro (YAVG ${max.toFixed(1)}/255)`),
      );
    }
  }

  if (input.productBounds && input.productBounds.samples.length > 0) {
    const { regionW, regionH, samples } = input.productBounds;
    const valid = samples.filter((s) => s.x2 - s.x1 > 4 && s.y2 - s.y1 > 4);
    // Sin señal destacada (producto oscuro sobre fondo oscuro) no hay base
    // para juzgar y se omite el check.
    if (valid.length >= 2) {
      const majority = Math.ceil(valid.length / 2);
      const clipped = (
        [
          ["edgeLeft", "izquierdo"],
          ["edgeRight", "derecho"],
        ] as const
      ).filter(([side]) => valid.filter((s) => s[side] > 0.25).length >= majority);
      const maxW = Math.max(...valid.map((s) => s.x2 - s.x1));
      const maxH = Math.max(...valid.map((s) => s.y2 - s.y1));
      if (clipped.length > 0) {
        const names = clipped.map(([, label]) => label).join("/");
        checks.push(
          check(
            "product_framing",
            "warn",
            `El producto llena el borde ${names} de la zona útil en la mayoría de muestras: reduce la escala o recentra el modelo.`,
            { samples },
          ),
        );
      } else if (maxW < regionW * 0.15 && maxH < regionH * 0.15) {
        checks.push(
          check(
            "product_framing",
            "warn",
            `El producto ocupa muy poco de la zona útil (~${Math.round((maxW / regionW) * 100)}% x ${Math.round((maxH / regionH) * 100)}%): sube la escala o acerca la cámara.`,
            { samples },
          ),
        );
      } else {
        checks.push(
          check(
            "product_framing",
            "pass",
            `Producto dentro de encuadre (~${Math.round((maxW / regionW) * 100)}% x ${Math.round((maxH / regionH) * 100)}% de la zona útil)`,
          ),
        );
      }
    }
  }

  if (input.loudnessChecked) {
    const lufs = input.integratedLufs ?? null;
    if (lufs === null) {
      checks.push(check("loudness", "info", "No se pudo medir la sonoridad integrada"));
    } else if (lufs >= -16 && lufs <= -12) {
      checks.push(check("loudness", "pass", `${lufs.toFixed(1)} LUFS · objetivo -14 LUFS`));
    } else {
      checks.push(
        check(
          "loudness",
          "warn",
          `${lufs.toFixed(1)} LUFS; objetivo -14 LUFS ±2 (ajusta la mezcla)`,
        ),
      );
    }

    const peak = input.truePeakDb ?? null;
    if (peak === null) {
      checks.push(check("true_peak", "info", "No se pudo medir el true peak"));
    } else if (peak <= -1) {
      checks.push(check("true_peak", "pass", `${peak.toFixed(1)} dBTP`));
    } else {
      checks.push(
        check("true_peak", "warn", `${peak.toFixed(1)} dBTP; baja el master por debajo de -1 dBTP`),
      );
    }
  }

  checks.push(
    input.contactSheetExists
      ? check("contact_sheet", "pass", "Hoja de contactos generada")
      : check("contact_sheet", "warn", "No se pudo generar la hoja de contactos"),
  );

  checks.push(
    input.coverExists
      ? check("cover", "pass", "Portada PNG generada")
      : check("cover", "warn", "No se pudo generar la portada PNG"),
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
