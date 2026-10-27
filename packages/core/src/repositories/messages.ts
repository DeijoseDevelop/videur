import type { Database } from "bun:sqlite";
import type { Message, MessageRole, ToolCall, ToolResult, ToolUsage } from "@videur/contracts";
import { newId } from "../utils/id";
import { parseJson, stringifyJson } from "../utils/json";
import { nowIso } from "../utils/time";

interface MessageRow {
  id: string;
  project_id: string;
  run_id: string | null;
  role: MessageRole;
  content: string;
  tool_calls_json: string | null;
  tool_results_json: string | null;
  usage_json: string | null;
  created_at: string;
}

function mapMessage(row: MessageRow): Message {
  return {
    id: row.id,
    projectId: row.project_id,
    runId: row.run_id,
    role: row.role,
    content: row.content,
    toolCalls: parseJson<ToolCall[] | null>(row.tool_calls_json, null),
    toolResults: parseJson<ToolResult[] | null>(row.tool_results_json, null),
    usage: parseJson<ToolUsage | null>(row.usage_json, null),
    createdAt: row.created_at,
  };
}

export interface CreateMessageRecord {
  projectId: string;
  runId?: string | null;
  role: MessageRole;
  content: string;
  toolCalls?: ToolCall[] | null;
  toolResults?: ToolResult[] | null;
  usage?: ToolUsage | null;
}

export function createMessage(db: Database, record: CreateMessageRecord): Message {
  const id = newId("msg");
  db.prepare(
    `INSERT INTO messages (id, project_id, run_id, role, content, tool_calls_json, tool_results_json, usage_json, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    id,
    record.projectId,
    record.runId ?? null,
    record.role,
    record.content,
    record.toolCalls ? stringifyJson(record.toolCalls) : null,
    record.toolResults ? stringifyJson(record.toolResults) : null,
    record.usage ? stringifyJson(record.usage) : null,
    nowIso(),
  );
  return getMessage(db, id)!;
}

export function getMessage(db: Database, id: string): Message | null {
  const row = db.query("SELECT * FROM messages WHERE id = ?").get(id) as MessageRow | null;
  return row ? mapMessage(row) : null;
}

export function listMessages(db: Database, projectId: string, limit = 200): Message[] {
  const rows = db
    .query("SELECT * FROM messages WHERE project_id = ? ORDER BY created_at ASC LIMIT ?")
    .all(projectId, limit) as MessageRow[];
  return rows.map(mapMessage);
}

export function clearMessages(db: Database, projectId: string): number {
  const result = db.prepare("DELETE FROM messages WHERE project_id = ?").run(projectId);
  return result.changes;
}
