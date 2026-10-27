import type { Database } from "bun:sqlite";
import type { EngineId, Stats } from "@videur/contracts";
import { countProjects } from "../repositories/projects";
import { countProviders } from "../repositories/providers";
import { renderStats } from "../repositories/renders";
import type { EngineRegistry } from "../engines/registry";

export class StatsService {
  constructor(
    private readonly db: Database,
    private readonly engines: EngineRegistry,
  ) {}

  async get(): Promise<Stats> {
    const renders = renderStats(this.db);
    const providers = countProviders(this.db);
    const engineInfos = await this.engines.detectAll();
    const engines = Object.fromEntries(
      engineInfos.map((engine) => [engine.id, engine.available]),
    ) as Record<EngineId, boolean>;

    return {
      projects: countProjects(this.db),
      renders: renders.total,
      succeeded: renders.succeeded,
      failed: renders.failed,
      cancelled: renders.cancelled,
      successRate: renders.total > 0 ? renders.succeeded / renders.total : 0,
      totalRenderMs: renders.totalRenderMs,
      providers: providers.enabled,
      engines,
    };
  }
}
