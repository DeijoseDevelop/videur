import type { Database } from "bun:sqlite";
import {
  VIDEUR_VERSION,
  createConfig,
  ensureDataDirs,
  type ConfigOverrides,
  type VideurConfig,
} from "./config";
import { openDatabase } from "./db/database";
import { EventBus } from "./events/bus";
import { Logger } from "./logger";
import { createSecretStore } from "./secrets/crypto";
import { EngineRegistry } from "./engines/registry";
import { TemplateService } from "./storage/templates";
import { SettingsService } from "./services/settings";
import { ProjectService } from "./services/projects";
import { WorkspaceService } from "./services/workspace";
import { AssetService } from "./services/assets";
import { RenderService } from "./services/renders";
import { MediaService } from "./services/media";
import { ProviderService } from "./services/providers";
import { DoctorService } from "./services/doctor";
import { StatsService } from "./services/stats";
import { AgentService } from "./agent/agent-service";

export interface CreateVideurOptions {
  config?: ConfigOverrides;
  env?: NodeJS.ProcessEnv;
}

export class Videur {
  readonly version = VIDEUR_VERSION;
  readonly startedAt = Date.now();
  readonly config: VideurConfig;
  readonly db: Database;
  readonly bus: EventBus;
  readonly logger: Logger;
  readonly settings: SettingsService;
  readonly engines: EngineRegistry;
  readonly templates: TemplateService;
  readonly projects: ProjectService;
  readonly workspace: WorkspaceService;
  readonly assets: AssetService;
  readonly renders: RenderService;
  readonly media: MediaService;
  readonly providers: ProviderService;
  readonly doctor: DoctorService;
  readonly stats: StatsService;
  readonly agent: AgentService;

  constructor(options: CreateVideurOptions = {}) {
    this.config = createConfig(options.config ?? {}, options.env ?? process.env);
    ensureDataDirs(this.config);
    this.logger = new Logger(this.config.logLevel, "videur");
    this.db = openDatabase(this.config.paths.db);
    this.bus = new EventBus(this.db);
    const secrets = createSecretStore(this.config, options.env ?? process.env);

    this.settings = new SettingsService(this.db, this.config);
    this.engines = new EngineRegistry(this.config);
    this.templates = new TemplateService(this.config);
    this.projects = new ProjectService(this.db, this.config, this.templates, this.bus);
    this.workspace = new WorkspaceService(this.db, this.config, this.bus);
    this.assets = new AssetService(this.workspace);
    this.media = new MediaService(this.config);
    this.providers = new ProviderService(this.db, this.config, secrets);
    this.renders = new RenderService({
      db: this.db,
      config: this.config,
      settings: this.settings,
      engines: this.engines,
      bus: this.bus,
      logger: this.logger,
    });
    this.doctor = new DoctorService(this.config, this.db, this.engines);
    this.stats = new StatsService(this.db, this.engines);
    this.agent = new AgentService({
      db: this.db,
      config: this.config,
      settings: this.settings,
      workspace: this.workspace,
      projects: this.projects,
      renders: this.renders,
      media: this.media,
      providers: this.providers,
      bus: this.bus,
      logger: this.logger,
    });
  }

  health(): { ok: boolean; version: string; uptime: number; dataDir: string } {
    return {
      ok: true,
      version: this.version,
      uptime: Math.round((Date.now() - this.startedAt) / 100) / 10,
      dataDir: this.config.dataDir,
    };
  }

  async close(): Promise<void> {
    await this.renders.queue.stop();
    this.bus.clear();
    try {
      this.db.close();
    } catch {
      // Cierre idempotente.
    }
  }
}

export function createVideur(options: CreateVideurOptions = {}): Videur {
  return new Videur(options);
}
