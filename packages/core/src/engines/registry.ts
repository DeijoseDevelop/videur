import type { EngineId, EngineInfo } from "@videur/contracts";
import type { VideurConfig } from "../config";
import { EngineUnavailableError } from "../errors";
import { FFmpegEngine } from "./ffmpeg";
import { ManimEngine } from "./manim";
import { PillowEngine } from "./pillow";
import { RemotionEngine } from "./remotion";
import type { VideoEngine } from "./types";

export class EngineRegistry {
  private readonly engines = new Map<EngineId, VideoEngine>();

  constructor(config: VideurConfig) {
    for (const engine of [
      new FFmpegEngine(config),
      new PillowEngine(config),
      new ManimEngine(config),
      new RemotionEngine(config),
    ]) {
      this.engines.set(engine.id, engine);
    }
  }

  get(id: EngineId): VideoEngine {
    const engine = this.engines.get(id);
    if (!engine) throw new EngineUnavailableError(`Motor desconocido: ${id}`);
    return engine;
  }

  list(): VideoEngine[] {
    return [...this.engines.values()];
  }

  async detectAll(): Promise<EngineInfo[]> {
    return Promise.all(this.list().map((engine) => engine.detect()));
  }

  async info(id: EngineId): Promise<EngineInfo> {
    return this.get(id).detect();
  }

  async ensureAvailable(id: EngineId): Promise<EngineInfo> {
    const info = await this.info(id);
    if (!info.available) {
      throw new EngineUnavailableError(info.installHint ?? `El motor ${id} no está disponible`, info);
    }
    return info;
  }
}
