import type { Database } from "bun:sqlite";
import type { CreateProjectData, Project, UpdateProjectInput } from "@videur/contracts";
import { nowIso } from "../utils/time";
import { uniqueSlug } from "../utils/slug";

interface ProjectRow {
  id: string;
  name: string;
  slug: string;
  description: string;
  brief: string;
  engine: Project["engine"];
  width: number;
  height: number;
  fps: number;
  duration_target: number;
  aspect_ratio: Project["aspectRatio"];
  status: Project["status"];
  style: string;
  template_id: string | null;
  created_at: string;
  updated_at: string;
}

function mapProject(row: ProjectRow): Project {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    description: row.description,
    brief: row.brief,
    engine: row.engine,
    width: row.width,
    height: row.height,
    fps: row.fps,
    durationTarget: row.duration_target,
    aspectRatio: row.aspect_ratio,
    status: row.status,
    style: row.style,
    templateId: row.template_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export interface CreateProjectRecord {
  id: string;
  data: CreateProjectData;
}

export function createProject(db: Database, record: CreateProjectRecord): Project {
  const { id, data } = record;
  const slug = uniqueSlug(data.name, (candidate) => slugExists(db, candidate));
  const timestamp = nowIso();

  db.prepare(
    `INSERT INTO projects (
      id, name, slug, description, brief, engine, width, height, fps,
      duration_target, aspect_ratio, status, style, template_id, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    id,
    data.name,
    slug,
    data.description,
    data.brief,
    data.engine,
    data.width,
    data.height,
    data.fps,
    data.durationTarget,
    data.aspectRatio,
    "draft",
    data.style,
    data.templateId,
    timestamp,
    timestamp,
  );

  return getProject(db, id)!;
}

export function getProject(db: Database, id: string): Project | null {
  const row = db.query("SELECT * FROM projects WHERE id = ?").get(id) as ProjectRow | null;
  return row ? mapProject(row) : null;
}

export function getProjectBySlug(db: Database, slug: string): Project | null {
  const row = db.query("SELECT * FROM projects WHERE slug = ?").get(slug) as ProjectRow | null;
  return row ? mapProject(row) : null;
}

export function slugExists(db: Database, slug: string): boolean {
  const row = db.query("SELECT 1 AS found FROM projects WHERE slug = ? LIMIT 1").get(slug) as
    | { found: number }
    | null;
  return Boolean(row);
}

export interface ListProjectsOptions {
  q?: string;
  engine?: Project["engine"];
  status?: Project["status"];
  limit?: number;
  offset?: number;
}

export function listProjects(db: Database, options: ListProjectsOptions = {}): Project[] {
  const where: string[] = [];
  const params: Array<string | number> = [];

  if (options.q) {
    where.push("(name LIKE ? OR description LIKE ? OR brief LIKE ?)");
    const like = `%${options.q}%`;
    params.push(like, like, like);
  }
  if (options.engine) {
    where.push("engine = ?");
    params.push(options.engine);
  }
  if (options.status) {
    where.push("status = ?");
    params.push(options.status);
  }

  const clause = where.length ? `WHERE ${where.join(" AND ")}` : "";
  const limit = options.limit ?? 50;
  const offset = options.offset ?? 0;
  params.push(limit, offset);

  const rows = db
    .query(`SELECT * FROM projects ${clause} ORDER BY updated_at DESC LIMIT ? OFFSET ?`)
    .all(...params) as ProjectRow[];
  return rows.map(mapProject);
}

export function countProjects(db: Database, options: Pick<ListProjectsOptions, "q" | "engine" | "status"> = {}): number {
  const where: string[] = [];
  const params: string[] = [];
  if (options.q) {
    where.push("(name LIKE ? OR description LIKE ? OR brief LIKE ?)");
    const like = `%${options.q}%`;
    params.push(like, like, like);
  }
  if (options.engine) {
    where.push("engine = ?");
    params.push(options.engine);
  }
  if (options.status) {
    where.push("status = ?");
    params.push(options.status);
  }
  const clause = where.length ? `WHERE ${where.join(" AND ")}` : "";
  const row = db.query(`SELECT COUNT(*) AS count FROM projects ${clause}`).get(...params) as { count: number };
  return row.count;
}

const UPDATE_COLUMNS: Record<keyof UpdateProjectInput, string> = {
  name: "name",
  description: "description",
  brief: "brief",
  engine: "engine",
  aspectRatio: "aspect_ratio",
  width: "width",
  height: "height",
  fps: "fps",
  durationTarget: "duration_target",
  style: "style",
  status: "status",
};

export function updateProject(db: Database, id: string, patch: UpdateProjectInput): Project | null {
  const sets: string[] = [];
  const params: Array<string | number | null> = [];

  for (const [key, column] of Object.entries(UPDATE_COLUMNS) as Array<[keyof UpdateProjectInput, string]>) {
    const value = patch[key];
    if (value === undefined) continue;
    sets.push(`${column} = ?`);
    params.push(value);
  }

  if (sets.length === 0) return getProject(db, id);
  sets.push("updated_at = ?");
  params.push(nowIso());
  params.push(id);

  db.prepare(`UPDATE projects SET ${sets.join(", ")} WHERE id = ?`).run(...params);
  return getProject(db, id);
}

export function deleteProject(db: Database, id: string): boolean {
  const result = db.prepare("DELETE FROM projects WHERE id = ?").run(id);
  return result.changes > 0;
}

export function setProjectStatus(db: Database, id: string, status: Project["status"]): void {
  db.prepare("UPDATE projects SET status = ?, updated_at = ? WHERE id = ?").run(status, nowIso(), id);
}

export function listAllProjects(db: Database): Project[] {
  const rows = db.query("SELECT * FROM projects ORDER BY updated_at DESC").all() as ProjectRow[];
  return rows.map(mapProject);
}
