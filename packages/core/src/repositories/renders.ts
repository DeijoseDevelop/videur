import type { Database } from "bun:sqlite";
import type { MediaMetadata, QaReport, Render, RenderStage, RenderStatus } from "@videur/contracts";
import { parseJson, stringifyJson } from "../utils/json";
import { nowIso } from "../utils/time";

interface RenderRow {
  id: string;
  project_id: string;
  engine: Render["engine"];
  status: RenderStatus;
  stage: RenderStage;
  progress: number;
  output_path: string | null;
  contact_sheet_path: string | null;
  metadata_json: string | null;
  qa_json: string | null;
  error: string | null;
  command_json: string | null;
  source_hash: string | null;
  interrupted: number;
  created_at: string;
  started_at: string | null;
  finished_at: string | null;
  duration_ms: number | null;
}

export function mapRender(row: RenderRow): Render {
  return {
    id: row.id,
    projectId: row.project_id,
    engine: row.engine,
    status: row.status,
    stage: row.stage,
    progress: row.progress,
    outputPath: row.output_path,
    contactSheetPath: row.contact_sheet_path,
    metadata: parseJson<MediaMetadata | null>(row.metadata_json, null),
    qa: parseJson<QaReport | null>(row.qa_json, null),
    error: row.error,
    command: parseJson<string[] | null>(row.command_json, null),
    sourceHash: row.source_hash,
    interrupted: Boolean(row.interrupted),
    createdAt: row.created_at,
    startedAt: row.started_at,
    finishedAt: row.finished_at,
    durationMs: row.duration_ms,
  };
}

export interface CreateRenderRecord {
  id: string;
  projectId: string;
  engine: Render["engine"];
  status?: RenderStatus;
  stage?: RenderStage;
}

export function createRender(db: Database, record: CreateRenderRecord): Render {
  const timestamp = nowIso();
  db.prepare(
    `INSERT INTO renders (id, project_id, engine, status, stage, progress, created_at)
     VALUES (?, ?, ?, ?, ?, 0, ?)`,
  ).run(
    record.id,
    record.projectId,
    record.engine,
    record.status ?? "queued",
    record.stage ?? "queued",
    timestamp,
  );
  return getRender(db, record.id)!;
}

export function getRender(db: Database, id: string): Render | null {
  const row = db.query("SELECT * FROM renders WHERE id = ?").get(id) as RenderRow | null;
  return row ? mapRender(row) : null;
}

export function listRenders(
  db: Database,
  projectId: string,
  options: { status?: RenderStatus; limit?: number; offset?: number } = {},
): Render[] {
  const where = ["project_id = ?"];
  const params: Array<string | number> = [projectId];
  if (options.status) {
    where.push("status = ?");
    params.push(options.status);
  }
  params.push(options.limit ?? 50, options.offset ?? 0);
  const rows = db
    .query(`SELECT * FROM renders WHERE ${where.join(" AND ")} ORDER BY created_at DESC LIMIT ? OFFSET ?`)
    .all(...params) as RenderRow[];
  return rows.map(mapRender);
}

export function countRenders(db: Database, projectId?: string): number {
  if (projectId) {
    const row = db.query("SELECT COUNT(*) AS count FROM renders WHERE project_id = ?").get(projectId) as {
      count: number;
    };
    return row.count;
  }
  const row = db.query("SELECT COUNT(*) AS count FROM renders").get() as { count: number };
  return row.count;
}

export function getLastRender(db: Database, projectId: string): Render | null {
  const row = db
    .query("SELECT * FROM renders WHERE project_id = ? ORDER BY created_at DESC LIMIT 1")
    .get(projectId) as RenderRow | null;
  return row ? mapRender(row) : null;
}

export function getActiveRender(db: Database, projectId: string): Render | null {
  const row = db
    .query(
      `SELECT * FROM renders
       WHERE project_id = ? AND status IN ('queued','preparing','running','inspecting')
       ORDER BY created_at DESC LIMIT 1`,
    )
    .get(projectId) as RenderRow | null;
  return row ? mapRender(row) : null;
}

const UPDATE_COLUMNS = {
  status: "status",
  stage: "stage",
  progress: "progress",
  outputPath: "output_path",
  contactSheetPath: "contact_sheet_path",
  metadata: "metadata_json",
  qa: "qa_json",
  error: "error",
  command: "command_json",
  sourceHash: "source_hash",
  interrupted: "interrupted",
  startedAt: "started_at",
  finishedAt: "finished_at",
  durationMs: "duration_ms",
} as const;

export type RenderPatch = Partial<
  Pick<
    Render,
    | "status"
    | "stage"
    | "progress"
    | "outputPath"
    | "contactSheetPath"
    | "metadata"
    | "qa"
    | "error"
    | "command"
    | "sourceHash"
    | "interrupted"
    | "startedAt"
    | "finishedAt"
    | "durationMs"
  >
>;

export function updateRender(db: Database, id: string, patch: RenderPatch): Render | null {
  const sets: string[] = [];
  const params: Array<string | number | null> = [];

  for (const [key, column] of Object.entries(UPDATE_COLUMNS) as Array<[keyof RenderPatch, string]>) {
    const value = patch[key];
    if (value === undefined) continue;
    sets.push(`${column} = ?`);
    if (key === "metadata" || key === "qa" || key === "command") {
      params.push(value === null ? null : stringifyJson(value));
    } else if (key === "interrupted") {
      params.push(value ? 1 : 0);
    } else {
      params.push(value as string | number | null);
    }
  }

  if (sets.length === 0) return getRender(db, id);
  params.push(id);
  db.prepare(`UPDATE renders SET ${sets.join(", ")} WHERE id = ?`).run(...params);
  return getRender(db, id);
}

export function markInterruptedRenders(db: Database): number {
  const timestamp = nowIso();
  const result = db
    .prepare(
      `UPDATE renders
       SET status = 'failed',
           stage = 'done',
           interrupted = 1,
           error = COALESCE(error, 'Render interrumpido por un reinicio del servidor'),
           finished_at = ?,
           duration_ms = CASE
             WHEN started_at IS NOT NULL THEN CAST((julianday(?) - julianday(started_at)) * 86400000 AS INTEGER)
             ELSE NULL
           END
       WHERE status IN ('queued','preparing','running','inspecting')`,
    )
    .run(timestamp, timestamp);
  return result.changes;
}

export function countActiveRenders(db: Database): number {
  const row = db
    .query(
      "SELECT COUNT(*) AS count FROM renders WHERE status IN ('queued','preparing','running','inspecting')",
    )
    .get() as { count: number };
  return row.count;
}

export function renderStats(db: Database): {
  total: number;
  succeeded: number;
  failed: number;
  cancelled: number;
  totalRenderMs: number;
} {
  const row = db
    .query(
      `SELECT
        COUNT(*) AS total,
        SUM(CASE WHEN status = 'succeeded' THEN 1 ELSE 0 END) AS succeeded,
        SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) AS failed,
        SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END) AS cancelled,
        COALESCE(SUM(duration_ms), 0) AS totalRenderMs
       FROM renders`,
    )
    .get() as {
    total: number;
    succeeded: number | null;
    failed: number | null;
    cancelled: number | null;
    totalRenderMs: number | null;
  };
  return {
    total: row.total,
    succeeded: row.succeeded ?? 0,
    failed: row.failed ?? 0,
    cancelled: row.cancelled ?? 0,
    totalRenderMs: row.totalRenderMs ?? 0,
  };
}
