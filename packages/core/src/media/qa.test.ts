import { describe, expect, it } from "bun:test";
import { createQaReport, type QaInput } from "./qa";

const base: QaInput = {
  metadata: {
    duration: 10,
    size: 1000,
    bitrate: 1000,
    format: "mov,mp4",
    video: { codec: "h264", profile: "High", width: 1080, height: 1920, fps: 60, pixFmt: "yuv420p", frames: 600 },
    audio: null,
  },
  project: { width: 1080, height: 1920, fps: 60, durationTarget: 10 },
  fileExists: true,
  contactSheetExists: true,
};

describe("QA luminancia central (canvas vacío)", () => {
  it("avisa si el centro está negro en todas las muestras", () => {
    const qa = createQaReport({ ...base, centerLuma: [3.1, 5.8, 2.4] });
    const c = qa.checks.find((x) => x.id === "center_luma");
    expect(c?.status).toBe("warn");
    expect(c?.message).toContain("canvas WebGL vacío");
  });

  it("pasa si hay contenido visible en el centro", () => {
    const qa = createQaReport({ ...base, centerLuma: [41.4, 33.1, 29.7] });
    const c = qa.checks.find((x) => x.id === "center_luma");
    expect(c?.status).toBe("pass");
  });

  it("no emite el check si no hay muestras", () => {
    const qa = createQaReport({ ...base });
    expect(qa.checks.find((x) => x.id === "center_luma")).toBeUndefined();
  });
});
