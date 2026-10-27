import type { Database } from "bun:sqlite";
import type { AgentRun, AgentRunStatus } from "@videur/contracts";
import { nowIso } from "../utils/time";

interface AgentRunRow {
  id: string;
  project_id: string;
  provider_id: string | null;
  model: string;
  status: AgentRunStatus;
  prompt: string;
  iterations: number;
  input_tokens: number;
  output_tokens: number;
  error: string | null;
  created_at: string;
  finished_at: string | null;
}

function mapRun(row: AgentRunRow): AgentRun {
  return {
    id: row.id,
    projectId: row.project_id,
    providerId: row.provider_id,
    model: row.model,
    status: row.status,
    prompt: row.prompt,
    iterations: row.iterations,
    inputTokens: row.input_tokens,
    outputTokens: row.output_tokens,
    error: row.error,
    createdAt: row.created_at,
    finishedAt: row.finished_at,
  };
}

export interface CreateAgentRunRecord {
  id: string;
  projectId: string;
  providerId: string | null;
  model: string;
  prompt: string;
}

export function createAgentRun(db: Database, record: CreateAgentRunRecord): AgentRun {
  db.prepare(
    `INSERT INTO agent_runs (id, project_id, provider_id, model, status, prompt, iterations, input_tokens, output_tokens, created_at)
     VALUES (?, ?, ?, ?, 'running', ?, 0, 0, 0, ?)`,
  ).run(record.id, record.projectId, record.providerId, record.model, record.prompt, nowIso());
  return getAgentRun(db, record.id)!;
}

export function getAgentRun(db: Database, id: string): AgentRun | null {
  const row = db.query("SELECT * FROM agent_runs WHERE id = ?").get(id) as AgentRunRow | null;
  return row ? mapRun(row) : null;
}

export interface AgentRunPatch {
  status?: AgentRunStatus;
  iterations?: number;
  inputTokens?: number;
  outputTokens?: number;
  error?: string | null;
  finishedAt?: string | null;
}

export function updateAgentRun(db: Database, id: string, patch: AgentRunPatch): AgentRun | null {
  const sets: string[] = [];
  const params: Array<string | number | null> = [];
  const map: Record<keyof AgentRunPatch, string> = {
    status: "status",
    iterations: "iterations",
    inputTokens: "input_tokens",
    outputTokens: "output_tokens",
    error: "error",
    finishedAt: "finished_at",
  };
  for (const [key, column] of Object.entries(map) as Array<[keyof AgentRunPatch, string]>) {
    const value = patch[key];
    if (value === undefined) continue;
    sets.push(`${column} = ?`);
    params.push(value as string | number | null);
  }
  if (sets.length === 0) return getAgentRun(db, id);
  params.push(id);
  db.prepare(`UPDATE agent_runs SET ${sets.join(", ")} WHERE id = ?`).run(...params);
  return getAgentRun(db, id);
}

export function listAgentRuns(db: Database, projectId: string, limit = 50): AgentRun[] {
  const rows = db
    .query("SELECT * FROM agent_runs WHERE project_id = ? ORDER BY created_at DESC LIMIT ?")
    .all(projectId, limit) as AgentRunRow[];
  return rows.map(mapRun);
}
