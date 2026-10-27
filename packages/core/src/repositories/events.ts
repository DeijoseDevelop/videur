import type { Database } from "bun:sqlite";
import type { VideurEvent } from "@videur/contracts";
import { newId } from "../utils/id";
import { stringifyJson } from "../utils/json";
import { nowIso } from "../utils/time";

interface EventRow {
  id: string;
  project_id: string | null;
  render_id: string | null;
  run_id: string | null;
  type: string;
  payload_json: string;
  created_at: string;
}

export interface StoredEvent extends EventRow {
  payload: unknown;
}

export function createEvent(db: Database, event: VideurEvent): void {
  const projectId = "projectId" in event ? event.projectId : null;
  const renderId = "renderId" in event ? event.renderId : null;
  const runId = "runId" in event ? event.runId : null;
  db.prepare(
    `INSERT INTO events (id, project_id, render_id, run_id, type, payload_json, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  ).run(newId("evt"), projectId, renderId, runId, event.type, stringifyJson(event), nowIso());
}

export function listEvents(db: Database, projectId: string | null, limit = 200): StoredEvent[] {
  const rows = projectId
    ? (db
        .query("SELECT * FROM events WHERE project_id = ? ORDER BY created_at DESC LIMIT ?")
        .all(projectId, limit) as EventRow[])
    : (db.query("SELECT * FROM events ORDER BY created_at DESC LIMIT ?").all(limit) as EventRow[]);
  return rows.map((row) => ({ ...row, payload: JSON.parse(row.payload_json) }));
}
