import type { Database } from "bun:sqlite";
import type { DoctorReport, DoctorTool } from "@videur/contracts";
import type { VideurConfig } from "../config";
import { commandVersion, detectPython, whichBinary } from "../process/binaries";
import { countProviders } from "../repositories/providers";
import type { EngineRegistry } from "../engines/registry";

export class DoctorService {
  constructor(
    private readonly config: VideurConfig,
    private readonly db: Database,
    private readonly engines: EngineRegistry,
  ) {}

  async run(): Promise<DoctorReport> {
    const [ffmpegPath, ffprobePath, nodePath, bunPath, python, engineInfos] = await Promise.all([
      Promise.resolve(whichBinary(this.config.binaries.ffmpeg)),
      Promise.resolve(whichBinary(this.config.binaries.ffprobe)),
      Promise.resolve(whichBinary(this.config.binaries.node)),
      Promise.resolve(whichBinary(this.config.binaries.bun)),
      detectPython(this.config.binaries.python),
      this.engines.detectAll(),
    ]);

    const [ffmpegVersion, ffprobeVersion, nodeVersion, bunVersion] = await Promise.all([
      ffmpegPath ? commandVersion(ffmpegPath, ["-version"]) : null,
      ffprobePath ? commandVersion(ffprobePath, ["-version"]) : null,
      nodePath ? commandVersion(nodePath, ["--version"]) : null,
      bunPath ? commandVersion(bunPath, ["--version"]) : null,
    ]);

    const manim = engineInfos.find((engine) => engine.id === "manim");
    const remotion = engineInfos.find((engine) => engine.id === "remotion");

    const tools: DoctorTool[] = [
      {
        id: "ffmpeg",
        name: "FFmpeg",
        available: Boolean(ffmpegPath),
        version: ffmpegVersion,
        path: ffmpegPath,
        installHint: ffmpegPath ? null : "sudo apt-get install ffmpeg",
      },
      {
        id: "ffprobe",
        name: "ffprobe",
        available: Boolean(ffprobePath),
        version: ffprobeVersion,
        path: ffprobePath,
        installHint: ffprobePath ? null : "sudo apt-get install ffmpeg",
      },
      {
        id: "python3",
        name: "Python 3",
        available: python.available,
        version: python.version,
        path: whichBinary(this.config.binaries.python),
        installHint: python.available ? null : "sudo apt-get install python3 python3-pip",
      },
      {
        id: "pillow",
        name: "Pillow",
        available: python.pillow,
        version: python.pillowVersion,
        path: null,
        installHint: python.pillow ? null : "python3 -m pip install pillow",
      },
      {
        id: "pycairo",
        name: "pycairo",
        available: python.pycairo,
        version: null,
        path: null,
        installHint: python.pycairo ? null : "python3 -m pip install pycairo",
      },
      {
        id: "manim",
        name: "Manim",
        available: Boolean(manim?.available),
        version: manim?.version ?? python.manimVersion,
        path: manim?.path ?? null,
        installHint: manim?.installHint ?? null,
      },
      {
        id: "node",
        name: "Node.js",
        available: Boolean(nodePath),
        version: nodeVersion,
        path: nodePath,
        installHint: nodePath ? null : "Instala Node.js 22+ para Remotion",
      },
      {
        id: "bun",
        name: "Bun",
        available: Boolean(bunPath),
        version: bunVersion,
        path: bunPath,
        installHint: bunPath ? null : "curl -fsSL https://bun.sh/install | bash",
      },
    ];

    const providers = countProviders(this.db);
    const warnings: string[] = [];
    if (!ffmpegPath || !ffprobePath) warnings.push("FFmpeg/ffprobe son obligatorios para renderizar.");
    if (!python.pillow) warnings.push("Pillow no está instalado; el motor Python no funcionará.");
    if (!manim?.available) warnings.push("Manim no está instalado; el motor Manim no funcionará.");
    if (!nodePath) warnings.push("Node.js no está instalado; Remotion no funcionará.");
    if (providers.enabled === 0) warnings.push("No hay proveedores de IA habilitados.");

    return {
      ok: Boolean(ffmpegPath && ffprobePath),
      tools,
      python: {
        available: python.available,
        pillow: python.pillow,
        pycairo: python.pycairo,
        manim: python.manim,
      },
      remotion: {
        available: Boolean(nodePath),
        node: Boolean(nodePath),
        hint: remotion?.installHint ?? null,
      },
      providers,
      warnings,
    };
  }
}
