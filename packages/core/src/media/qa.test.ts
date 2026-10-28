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

describe("QA encuadre de producto", () => {
  const region = { regionW: 756, regionH: 960 };
  const inside = { x1: 120, x2: 634, y1: 88, y2: 451, edgeLeft: 0.02, edgeRight: 0.03 };

  it("pasa si el producto queda dentro de la zona útil", () => {
    const qa = createQaReport({
      ...base,
      productBounds: { checked: true, ...region, samples: [inside, inside, inside] },
    });
    const c = qa.checks.find((x) => x.id === "product_framing");
    expect(c?.status).toBe("pass");
  });

  it("avisa si el producto llena un borde en la mayoría de muestras", () => {
    const clipped = { ...inside, edgeLeft: 0.6 };
    const qa = createQaReport({
      ...base,
      productBounds: { checked: true, ...region, samples: [clipped, clipped, inside] },
    });
    const c = qa.checks.find((x) => x.id === "product_framing");
    expect(c?.status).toBe("warn");
    expect(c?.message).toContain("izquierdo");
  });

  it("no avisa por un borde lleno en una sola muestra", () => {
    const qa = createQaReport({
      ...base,
      productBounds: {
        checked: true,
        ...region,
        samples: [{ ...inside, edgeRight: 0.9 }, inside, inside],
      },
    });
    const c = qa.checks.find((x) => x.id === "product_framing");
    expect(c?.status).toBe("pass");
  });

  it("omite el check si la zona está vacía (lo cubre center_luma)", () => {
    const qa = createQaReport({
      ...base,
      productBounds: { checked: true, ...region, samples: [] },
    });
    expect(qa.checks.find((x) => x.id === "product_framing")).toBeUndefined();
  });
});
