/**
 * Smoke test real: crea un proyecto temporal, renderiza FFmpeg y verifica
 * output.mp4 + contact-sheet.png + qa.json.
 *
 * Uso: bun run smoke [--keep]
 */
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { createVideur, toErrorMessage } from "../packages/core/src/index";

const keep = process.argv.includes("--keep");
const dataDir = mkdtempSync(join(tmpdir(), "videur-smoke-"));
const root = resolve(import.meta.dir, "..");

console.log(`▸ data: ${dataDir}`);

const app = createVideur({
  config: {
    dataDir,
    templatesDir: join(root, "templates"),
    webDist: join(root, "apps/web/dist"),
  },
});

let exitCode = 0;
try {
  const doctor = await app.doctor.run();
  const ffmpeg = doctor.tools.find((tool) => tool.id === "ffmpeg");
  const ffprobe = doctor.tools.find((tool) => tool.id === "ffprobe");
  if (!ffmpeg?.available || !ffprobe?.available) {
    console.error("✖ FFmpeg/ffprobe no están disponibles. Instálalos o define FFMPEG_PATH/FFPROBE_PATH.");
    process.exitCode = 2;
  } else {
    console.log(`▸ ffmpeg: ${ffmpeg.path} ${ffmpeg.version ?? ""}`.trim());
    const project = app.projects.create({
      name: "Smoke FFmpeg",
      description: "Smoke test de Videur",
      brief: "Barras animadas con audio sintético para validar el pipeline.",
      engine: "ffmpeg",
      aspectRatio: "16:9",
      durationTarget: 6,
      templateId: "ffmpeg-data-bars",
    });
    console.log(`▸ proyecto: ${project.id}`);

    const render = app.renders.start(project.id, { engine: "ffmpeg" });
    console.log(`▸ render: ${render.id}`);
    const final = await app.renders.waitFor(render.id, 180_000);

    if (!final) throw new Error("El render desapareció");
    if (final.status !== "succeeded") throw new Error(final.error ?? `Render ${final.status}`);

    const output = final.outputPath ? resolve(dataDir, final.outputPath) : null;
    const contact = final.contactSheetPath ? resolve(dataDir, final.contactSheetPath) : null;
    if (!output || !(await Bun.file(output).exists())) throw new Error("Falta output.mp4");
    if (!contact || !(await Bun.file(contact).exists())) throw new Error("Falta contact-sheet.png");
    if (!final.qa?.ok) throw new Error("QA no está OK");

    console.log(`✔ ${final.outputPath}`);
    console.log(`✔ ${final.contactSheetPath}`);
    console.log(`✔ ${final.metadata?.video?.width}×${final.metadata?.video?.height} · ${final.metadata?.duration}s · ${final.metadata?.video?.codec}`);
    console.log(`✔ QA: ${final.qa.checks.filter((check) => check.status === "pass").length} checks OK`);
  }
} catch (error) {
  console.error(`✖ ${toErrorMessage(error)}`);
  exitCode = 1;
} finally {
  await app.close();
  if (!keep) rmSync(dataDir, { recursive: true, force: true });
  else console.log(`▸ conservado: ${dataDir}`);
}

process.exitCode = exitCode;
