import type { EngineId, EngineInfo, Project, Render } from "@videur/contracts";
import type { VideurConfig } from "../config";
import type { RunOptions, RunResult } from "../process/runner";

export interface EngineContext {
  project: Project;
  render: Render;
  workspaceDir: string;
  renderDir: string;
  outputPath: string;
  config: VideurConfig;
  signal: AbortSignal;
  log(stream: "stdout" | "stderr" | "system", line: string): void;
  progress(value: number, stage?: string): void;
  run(command: string[], options?: RunOptions): Promise<RunResult>;
}

export interface EngineArtifact {
  kind: "video" | "contact_sheet" | "metadata" | "qa" | "log";
  path: string;
  mime: string;
}

export interface EngineRunResult {
  command: string[];
  outputPath: string;
  artifacts?: EngineArtifact[];
}

export interface EngineValidation {
  ok: boolean;
  errors: string[];
}

export interface VideoEngine {
  readonly id: EngineId;
  readonly name: string;
  detect(): Promise<EngineInfo>;
  validate(workspaceDir: string): Promise<EngineValidation>;
  run(context: EngineContext): Promise<EngineRunResult>;
}
