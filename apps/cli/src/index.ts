#!/usr/bin/env bun
import {
  CreateProjectSchema,
  type EngineId,
  type Render,
} from "@videur/contracts";
import { createVideur, toErrorMessage, type Videur } from "@videur/core";
import { createApp } from "@videur/server/app";
import { startMcpServer } from "@videur/mcp";

const C = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  dim: "\x1b[2m",
  green: "\x1b[32m",
  red: "\x1b[31m",
  yellow: "\x1b[33m",
  cyan: "\x1b[36m",
  magenta: "\x1b[35m",
};

interface Parsed {
  command: string;
  positionals: string[];
  flags: Record<string, string | boolean>;
}

function parse(argv: string[]): Parsed {
  const [command = "help", ...rest] = argv;
  const positionals: string[] = [];
  const flags: Record<string, string | boolean> = {};
  for (let i = 0; i < rest.length; i++) {
    const item = rest[i]!;
    if (item.startsWith("--")) {
      const body = item.slice(2);
      const eq = body.indexOf("=");
      if (eq >= 0) {
        flags[body.slice(0, eq)] = body.slice(eq + 1);
      } else {
        const next = rest[i + 1];
        if (next && !next.startsWith("--")) {
          flags[body] = next;
          i++;
        } else {
          flags[body] = true;
        }
      }
    } else {
      positionals.push(item);
    }
  }
  return { command, positionals, flags };
}

function jsonFlag(flags: Parsed["flags"]): boolean {
  return flags.json === true || flags.json === "true";
}

function output(value: unknown, flags: Parsed["flags"]): void {
  if (jsonFlag(flags)) {
    console.log(JSON.stringify(value, null, 2));
    return;
  }
  if (typeof value === "string") {
    console.log(value);
    return;
  }
  console.log(JSON.stringify(value, null, 2));
}

function printHelp(): void {
  console.log(`${C.bold}Videur CLI${C.reset} · video programático con IA

${C.bold}Uso${C.reset}
  videur <comando> [opciones]

${C.bold}Comandos${C.reset}
  doctor                         Diagnóstico de herramientas
  project:create <nombre>        Crea un proyecto
  project:list                   Lista proyectos
  project:show <id>              Muestra un proyecto y sus archivos
  render <project-id>            Renderiza y espera el resultado
  renders <project-id>           Lista renders
  probe <archivo>                ffprobe
  contact-sheet <archivo>        Genera hoja de contactos
  agent <project-id> <prompt>    Ejecuta el agente
  templates                      Lista plantillas
  serve                          Arranca la UI + API
  mcp                            Servidor MCP por stdio
  db:migrate                     Aplica migraciones

${C.bold}Opciones${C.reset}
  --json                         Salida JSON
  --engine <id>                  ffmpeg | pillow | manim | remotion
  --ratio <ratio>                16:9 | 9:16 | 1:1 | 4:5 | 4:3 | 21:9
  --duration <segundos>
  --fps <fps>
  --template <id>
  --provider <id>
  --model <modelo>
  --port <puerto>
  --format png|jpg               contact-sheet

${C.bold}Ejemplos${C.reset}
  videur doctor
  videur project:create "Demo" --engine ffmpeg --template ffmpeg-data-bars
  videur render prj_123
  videur agent prj_123 "Haz un video de 8s sobre energía solar"
`);
}

function table(rows: string[][]): string {
  const widths = rows[0]?.map((_, col) => Math.max(...rows.map((row) => (row[col] ?? "").length))) ?? [];
  return rows
    .map((row) => row.map((cell, col) => (cell ?? "").padEnd(widths[col] ?? 0)).join("  "))
    .join("\n");
}

function engineOf(value: string | boolean | undefined): EngineId | undefined {
  if (value === "ffmpeg" || value === "pillow" || value === "manim" || value === "remotion") return value;
  return undefined;
}

function numberFlag(value: string | boolean | undefined): number | undefined {
  if (typeof value !== "string") return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

async function waitForRender(videur: Videur, render: Render, json: boolean): Promise<Render | null> {
  let lastBucket = -1;
  const unsubscribe = videur.bus.subscribe((event) => {
    if (event.type !== "render.progress" || event.renderId !== render.id) return;
    const bucket = Math.floor(event.progress * 10);
    if (bucket === lastBucket) return;
    lastBucket = bucket;
    process.stderr.write(`\r${C.dim}render ${C.reset}${String(bucket * 10).padStart(3)}% ${C.dim}${event.stage}${C.reset}   `);
  });
  try {
    return await videur.renders.waitFor(render.id, videur.settings.renderOptions().timeoutMs + 30_000);
  } finally {
    unsubscribe();
    process.stderr.write("\n");
  }
}

async function commandDoctor(videur: Videur, flags: Parsed["flags"]): Promise<number> {
  const report = await videur.doctor.run();
  if (jsonFlag(flags)) {
    output(report, flags);
  } else {
    console.log(`${C.bold}Videur doctor${C.reset}\n`);
    for (const tool of report.tools) {
      const icon = tool.available ? `${C.green}●${C.reset}` : `${C.red}○${C.reset}`;
      const version = tool.version ? ` ${C.dim}${tool.version}${C.reset}` : "";
      console.log(`  ${icon} ${tool.name}${version}`);
      if (!tool.available && tool.installHint) console.log(`      ${C.dim}${tool.installHint}${C.reset}`);
    }
    if (report.warnings.length) {
      console.log(`\n${C.yellow}Advertencias${C.reset}`);
      for (const warning of report.warnings) console.log(`  • ${warning}`);
    }
    console.log(`\n${report.ok ? C.green : C.red}${report.ok ? "Listo para renderizar" : "Faltan dependencias obligatorias"}${C.reset}`);
  }
  return report.ok ? 0 : 2;
}

async function commandProjectCreate(videur: Videur, parsed: Parsed): Promise<void> {
  const name = parsed.positionals.join(" ").trim();
  if (!name) throw new Error("Falta el nombre del proyecto");
  const project = videur.projects.create(
    CreateProjectSchema.parse({
      name,
      engine: engineOf(parsed.flags.engine) ?? "ffmpeg",
      aspectRatio: (parsed.flags.ratio as string) ?? "16:9",
      durationTarget: numberFlag(parsed.flags.duration) ?? 6,
      fps: numberFlag(parsed.flags.fps) ?? 30,
      templateId: typeof parsed.flags.template === "string" ? parsed.flags.template : undefined,
    }),
  );
  if (jsonFlag(parsed.flags)) {
    output(project, parsed.flags);
  } else {
    console.log(`${C.green}✔${C.reset} Proyecto ${C.bold}${project.name}${C.reset} creado: ${C.cyan}${project.id}${C.reset}`);
    console.log(`  ${project.engine} · ${project.width}x${project.height} · ${project.fps}fps · ${project.durationTarget}s`);
  }
}

async function commandProjectList(videur: Videur, flags: Parsed["flags"]): Promise<void> {
  const { items, total } = videur.projects.list({ limit: 100 });
  if (jsonFlag(flags)) {
    output({ items, total }, flags);
    return;
  }
  if (!items.length) {
    console.log("No hay proyectos. Crea uno con: videur project:create \"Mi video\"");
    return;
  }
  console.log(table([
    ["ID", "NOMBRE", "MOTOR", "ESTADO", "RENDERS"],
    ...items.map((project) => [
      project.id,
      project.name,
      project.engine,
      project.status,
      String(project.rendersCount ?? 0),
    ]),
  ]));
}

async function commandProjectShow(videur: Videur, parsed: Parsed): Promise<void> {
  const id = parsed.positionals[0];
  if (!id) throw new Error("Falta el project-id");
  const project = videur.projects.get(id);
  const files = videur.workspace.list(id);
  if (jsonFlag(parsed.flags)) {
    output({ ...project, files }, parsed.flags);
    return;
  }
  console.log(`${C.bold}${project.name}${C.reset} ${C.dim}${project.id}${C.reset}`);
  console.log(`  ${project.engine} · ${project.width}x${project.height} · ${project.fps}fps · ${project.durationTarget}s · ${project.status}`);
  if (project.brief) console.log(`  ${C.dim}${project.brief}${C.reset}`);
  console.log(`\n${C.bold}Archivos${C.reset}`);
  for (const file of files) {
    console.log(`  ${file.type === "directory" ? "▸" : "·"} ${"  ".repeat(file.depth)}${file.path}`);
  }
  if (project.lastRender) {
    console.log(`\n${C.bold}Último render${C.reset}: ${project.lastRender.status} ${project.lastRender.id}`);
    if (project.lastRender.videoUrl) console.log(`  ${C.cyan}${project.lastRender.videoUrl}${C.reset}`);
  }
}

async function commandRender(videur: Videur, parsed: Parsed): Promise<void> {
  const projectId = parsed.positionals[0];
  if (!projectId) throw new Error("Falta el project-id");
  const engine = engineOf(parsed.flags.engine);
  const render = videur.renders.start(projectId, engine ? { engine } : {});
  if (!jsonFlag(parsed.flags)) {
    console.log(`${C.cyan}▶${C.reset} Render ${render.id} encolado (${render.engine})`);
  }
  const final = await waitForRender(videur, render, jsonFlag(parsed.flags));
  if (!final) throw new Error("El render desapareció");
  if (jsonFlag(parsed.flags)) {
    output(final, parsed.flags);
  } else if (final.status === "succeeded") {
    console.log(`${C.green}✔${C.reset} Render completado en ${final.durationMs ?? 0} ms`);
    if (final.outputPath) console.log(`  ${C.cyan}${final.outputPath}${C.reset}`);
    if (final.contactSheetPath) console.log(`  ${C.dim}${final.contactSheetPath}${C.reset}`);
  } else {
    console.log(`${C.red}✖${C.reset} Render ${final.status}: ${final.error ?? ""}`);
    process.exitCode = 2;
  }
}

async function commandRenders(videur: Videur, parsed: Parsed): Promise<void> {
  const projectId = parsed.positionals[0];
  if (!projectId) throw new Error("Falta el project-id");
  const { items } = videur.renders.list(projectId, { limit: 50 });
  if (jsonFlag(parsed.flags)) {
    output({ items }, parsed.flags);
    return;
  }
  if (!items.length) {
    console.log("Sin renders.");
    return;
  }
  console.log(table([
    ["ID", "ESTADO", "MOTOR", "DURACIÓN", "FECHA"],
    ...items.map((render) => [
      render.id,
      render.status,
      render.engine,
      render.durationMs ? `${(render.durationMs / 1000).toFixed(1)}s` : "—",
      render.createdAt,
    ]),
  ]));
}

async function commandProbe(videur: Videur, parsed: Parsed): Promise<void> {
  const path = parsed.positionals[0];
  if (!path) throw new Error("Falta el archivo");
  const metadata = await videur.media.probe(path);
  if (jsonFlag(parsed.flags)) {
    output(metadata, parsed.flags);
    return;
  }
  console.log(`${C.bold}${path}${C.reset}`);
  console.log(`  Duración: ${metadata.duration.toFixed(2)}s`);
  if (metadata.video) {
    console.log(`  Video: ${metadata.video.codec} ${metadata.video.width}x${metadata.video.height} ${metadata.video.fps}fps ${metadata.video.pixFmt}`);
  }
  if (metadata.audio) {
    console.log(`  Audio: ${metadata.audio.codec} ${metadata.audio.sampleRate}Hz ${metadata.audio.channels}ch`);
  }
}

async function commandContactSheet(videur: Videur, parsed: Parsed): Promise<void> {
  const path = parsed.positionals[0];
  if (!path) throw new Error("Falta el archivo");
  const metadata = await videur.media.probe(path);
  const outputPath = typeof parsed.flags.output === "string"
    ? parsed.flags.output
    : path.replace(/\.[^.]+$/, "") + "-contact-sheet.png";
  const result = await videur.media.contactSheet(path, outputPath, metadata.duration);
  if (jsonFlag(parsed.flags)) output({ path: result }, parsed.flags);
  else console.log(`${C.green}✔${C.reset} Hoja de contactos: ${result}`);
}

async function commandAgent(videur: Videur, parsed: Parsed): Promise<void> {
  const projectId = parsed.positionals[0];
  const prompt = parsed.positionals.slice(1).join(" ").trim();
  if (!projectId || !prompt) throw new Error("Uso: videur agent <project-id> \"<prompt>\"");
  const providerId = typeof parsed.flags.provider === "string" ? parsed.flags.provider : undefined;
  const model = typeof parsed.flags.model === "string" ? parsed.flags.model : undefined;
  const start = videur.agent.start(projectId, { prompt, ...(providerId ? { providerId } : {}), ...(model ? { model } : {}) });
  const json = jsonFlag(parsed.flags);
  if (!json) {
    console.log(`${C.magenta}◆${C.reset} Agente ${start.runId} · ${start.provider} · ${start.model}`);
  }
  const unsubscribe = videur.bus.subscribe((event) => {
    if (event.type === "agent.tool" && event.runId === start.runId && event.status === "started") {
      if (!json) console.log(`  ${C.dim}tool${C.reset} ${event.tool} ${C.dim}${JSON.stringify(event.args ?? {})}${C.reset}`);
    }
    if (event.type === "agent.completed" && event.runId === start.runId) {
      if (!json) {
        const color = event.status === "succeeded" ? C.green : event.status === "cancelled" ? C.yellow : C.red;
        console.log(`${color}■${C.reset} ${event.status}${event.summary ? ` · ${event.summary}` : ""}${event.error ? ` · ${event.error}` : ""}`);
      }
    }
  });
  try {
    await new Promise<void>((resolve) => {
      const done = videur.bus.subscribe((event) => {
        if (event.type === "agent.completed" && event.runId === start.runId) {
          done();
          resolve();
        }
      });
      setTimeout(() => {
        done();
        resolve();
      }, videur.config.agent.timeoutMs + 30_000);
    });
    const run = videur.agent.get(start.runId);
    if (json) output({ run, messages: videur.agent.messages(projectId).slice(-30) }, parsed.flags);
    else if (run.status === "failed") process.exitCode = 2;
  } finally {
    unsubscribe();
  }
}

async function commandTemplates(videur: Videur, flags: Parsed["flags"]): Promise<void> {
  const items = videur.templates.list();
  if (jsonFlag(flags)) {
    output({ items }, flags);
    return;
  }
  console.log(table([
    ["ID", "NOMBRE", "MOTOR", "DURACIÓN", "TAGS"],
    ...items.map((template) => [
      template.id,
      template.name,
      template.engine,
      `${template.duration}s`,
      template.tags.join(", "),
    ]),
  ]));
}

async function commandServe(videur: Videur, parsed: Parsed): Promise<void> {
  const port = numberFlag(parsed.flags.port) ?? videur.config.port;
  const app = createApp(videur);
  const server = Bun.serve({
    hostname: videur.config.host,
    port,
    fetch: app.fetch,
    idleTimeout: 120,
    maxRequestBodySize: 10 * 1024 * 1024,
  });
  console.log(`${C.green}●${C.reset} Videur en http://${videur.config.host}:${port}`);
  console.log(`  ${C.dim}${videur.config.dataDir}${C.reset}`);
  await new Promise<void>((resolve) => {
    const close = async (): Promise<void> => {
      server.stop(true);
      await videur.close();
      resolve();
    };
    process.once("SIGINT", () => void close());
    process.once("SIGTERM", () => void close());
  });
}

async function commandMcp(videur: Videur): Promise<void> {
  startMcpServer(videur);
  process.stdin.resume();
  await new Promise<void>((resolve) => {
    const close = async (): Promise<void> => {
      await videur.close();
      resolve();
    };
    process.once("SIGINT", () => void close());
    process.once("SIGTERM", () => void close());
    process.stdin.once("end", () => void close());
  });
}

async function main(): Promise<void> {
  const parsed = parse(process.argv.slice(2));
  if (parsed.command === "help" || parsed.flags.help) {
    printHelp();
    return;
  }

  if (parsed.command === "serve") {
    const videur = createVideur();
    try {
      await commandServe(videur, parsed);
    } finally {
      await videur.close();
    }
    return;
  }

  if (parsed.command === "mcp") {
    const videur = createVideur({ config: { logLevel: "error" } });
    try {
      await commandMcp(videur);
    } finally {
      await videur.close();
    }
    return;
  }

  const videur = createVideur();
  try {
    switch (parsed.command) {
      case "doctor": {
        const code = await commandDoctor(videur, parsed.flags);
        if (code !== 0) process.exitCode = code;
        break;
      }
      case "project:create":
        await commandProjectCreate(videur, parsed);
        break;
      case "project:list":
        await commandProjectList(videur, parsed.flags);
        break;
      case "project:show":
        await commandProjectShow(videur, parsed);
        break;
      case "render":
        await commandRender(videur, parsed);
        break;
      case "renders":
        await commandRenders(videur, parsed);
        break;
      case "probe":
        await commandProbe(videur, parsed);
        break;
      case "contact-sheet":
        await commandContactSheet(videur, parsed);
        break;
      case "agent":
        await commandAgent(videur, parsed);
        break;
      case "templates":
        await commandTemplates(videur, parsed.flags);
        break;
      case "db:migrate":
        console.log(`${C.green}✔${C.reset} Migraciones aplicadas (${videur.config.paths.db})`);
        break;
      default:
        console.error(`Comando desconocido: ${parsed.command}\n`);
        printHelp();
        process.exitCode = 1;
    }
  } finally {
    await videur.close();
  }
}

main().catch((error) => {
  console.error(`${C.red}✖${C.reset} ${toErrorMessage(error)}`);
  process.exitCode = 1;
});
