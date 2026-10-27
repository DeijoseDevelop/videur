import type { Database } from "bun:sqlite";
import type { AppSettings, UpdateSettingsInput } from "@videur/contracts";
import type { VideurConfig } from "../config";
import { getAppSettings, saveAppSettings } from "../repositories/settings";

export class SettingsService {
  constructor(
    private readonly db: Database,
    private readonly config: VideurConfig,
  ) {}

  get(): AppSettings {
    return getAppSettings(this.db);
  }

  update(patch: UpdateSettingsInput): AppSettings {
    return saveAppSettings(this.db, patch);
  }

  renderOptions(): { maxConcurrent: number; timeoutMs: number } {
    const settings = this.get();
    return {
      maxConcurrent: Math.max(1, settings.render.maxConcurrent || this.config.maxConcurrentRenders),
      timeoutMs: Math.max(10_000, settings.render.timeoutMs || this.config.renderTimeoutMs),
    };
  }

  agentOptions(): {
    maxIterations: number;
    maxTokens: number;
    maxTokensPerRun: number;
    visionReview: boolean;
  } {
    const settings = this.get();
    return {
      maxIterations: settings.agent.maxIterations || this.config.agent.maxIterations,
      maxTokens: settings.agent.maxTokens || this.config.agent.maxTokens,
      maxTokensPerRun: settings.agent.maxTokensPerRun || this.config.agent.maxTokensPerRun,
      visionReview: settings.agent.visionReview,
    };
  }
}
