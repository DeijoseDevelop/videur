import type { EngineId } from "./common";

export interface Stats {
  projects: number;
  renders: number;
  succeeded: number;
  failed: number;
  cancelled: number;
  successRate: number;
  totalRenderMs: number;
  providers: number;
  engines: Record<EngineId, boolean>;
}

export interface HealthReport {
  ok: boolean;
  version: string;
  uptime: number;
  dataDir: string;
}
