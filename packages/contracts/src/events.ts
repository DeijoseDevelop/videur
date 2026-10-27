import type { AgentRunStatus, EngineId, RenderStage, RenderStatus } from "./common";
import type { Message, ToolResult } from "./agent";
import type { Project, ProjectWithLastRender } from "./projects";
import type { Render } from "./media";

export type VideurEvent =
  | { type: "hello"; now: string }
  | { type: "ping"; now: string }
  | { type: "project.updated"; projectId: string; project: ProjectWithLastRender }
  | { type: "render.queued"; projectId: string; renderId: string; render: Render }
  | {
      type: "render.progress";
      projectId: string;
      renderId: string;
      progress: number;
      stage: RenderStage;
      status: RenderStatus;
    }
  | { type: "render.log"; projectId: string; renderId: string; stream: "stdout" | "stderr" | "system"; line: string }
  | { type: "render.completed"; projectId: string; renderId: string; status: RenderStatus; render: Render }
  | { type: "agent.started"; projectId: string; runId: string; provider: string; model: string }
  | { type: "agent.message"; projectId: string; runId: string; message: Message }
  | {
      type: "agent.tool";
      projectId: string;
      runId: string;
      tool: string;
      status: "started" | "finished";
      args?: Record<string, unknown>;
      result?: ToolResult;
      durationMs?: number;
    }
  | { type: "agent.usage"; projectId: string; runId: string; inputTokens: number; outputTokens: number }
  | {
      type: "agent.completed";
      projectId: string;
      runId: string;
      status: AgentRunStatus;
      summary?: string;
      error?: string;
    }
  | { type: "agent.error"; projectId: string; runId: string; error: string }
  | { type: "engine.changed"; engine: EngineId; available: boolean };

export interface EventLogLine {
  id: string;
  renderId: string;
  stream: "stdout" | "stderr" | "system";
  line: string;
  createdAt: string;
}
