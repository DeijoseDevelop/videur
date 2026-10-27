import type { Database } from "bun:sqlite";
import type { Artifact, ArtifactKind } from "@videur/contracts";
import { nowIso } from "../utils/time";
import { newId } from "../utils/id";

interface ArtifactRow {
  id: string;
  render_id: string;
  kind: ArtifactKind;
  path: string;
  mime: string;
  size: number;
  created_at: string;
}

function mapArtifact(row: ArtifactRow): Artifact {
  return {
    id: row.id,
    renderId: row.render_id,
    kind: row.kind,
    path: row.path,
    mime: row.mime,
    size: row.size,
    createdAt: row.created_at,
  };
}

export interface CreateArtifactRecord {
  renderId: string;
  kind: ArtifactKind;
  path: string;
  mime: string;
  size: number;
}

export function createArtifact(db: Database, record: CreateArtifactRecord): Artifact {
  const id = newId("art");
  db.prepare(
    "INSERT INTO artifacts (id, render_id, kind, path, mime, size, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
  ).run(id, record.renderId, record.kind, record.path, record.mime, record.size, nowIso());
  return getArtifact(db, id)!;
}

export function getArtifact(db: Database, id: string): Artifact | null {
  const row = db.query("SELECT * FROM artifacts WHERE id = ?").get(id) as ArtifactRow | null;
  return row ? mapArtifact(row) : null;
}

export function listArtifacts(db: Database, renderId: string): Artifact[] {
  const rows = db
    .query("SELECT * FROM artifacts WHERE render_id = ? ORDER BY created_at ASC")
    .all(renderId) as ArtifactRow[];
  return rows.map(mapArtifact);
}

export function deleteArtifacts(db: Database, renderId: string): void {
  db.prepare("DELETE FROM artifacts WHERE render_id = ?").run(renderId);
}
