import type { Database } from "bun:sqlite";
import type { Provider, ProviderInput, ProviderKind, ProviderPreset } from "@videur/contracts";
import { newId } from "../utils/id";
import { parseJson, stringifyJson } from "../utils/json";
import { nowIso } from "../utils/time";

export interface ProviderRow {
  id: string;
  label: string;
  preset: ProviderPreset;
  kind: ProviderKind;
  base_url: string;
  model: string;
  api_key_enc: string | null;
  api_key_hint: string | null;
  headers_json: string | null;
  enabled: number;
  supports_vision: number;
  supports_tools: number;
  created_at: string;
  updated_at: string;
}

export interface ProviderRecord extends Provider {
  apiKeyEnc: string | null;
}

export function mapProvider(row: ProviderRow): Provider {
  return {
    id: row.id,
    label: row.label,
    preset: row.preset,
    kind: row.kind,
    baseUrl: row.base_url,
    model: row.model,
    hasApiKey: Boolean(row.api_key_enc),
    apiKeyHint: row.api_key_hint,
    headers: parseJson<Record<string, string>>(row.headers_json, {}),
    enabled: Boolean(row.enabled),
    supportsVision: Boolean(row.supports_vision),
    supportsTools: Boolean(row.supports_tools),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function toProviderRecord(row: ProviderRow): ProviderRecord {
  return { ...mapProvider(row), apiKeyEnc: row.api_key_enc };
}

export interface CreateProviderRecord {
  label: string;
  preset: ProviderPreset;
  kind: ProviderKind;
  baseUrl: string;
  model: string;
  apiKeyEnc: string | null;
  apiKeyHint: string | null;
  headers: Record<string, string>;
  enabled: boolean;
  supportsVision: boolean;
  supportsTools: boolean;
}

export function createProvider(db: Database, record: CreateProviderRecord): ProviderRecord {
  const id = newId("prv");
  const timestamp = nowIso();
  db.prepare(
    `INSERT INTO providers (
      id, label, preset, kind, base_url, model, api_key_enc, api_key_hint,
      headers_json, enabled, supports_vision, supports_tools, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    id,
    record.label,
    record.preset,
    record.kind,
    record.baseUrl.replace(/\/+$/, ""),
    record.model,
    record.apiKeyEnc,
    record.apiKeyHint,
    stringifyJson(record.headers),
    record.enabled ? 1 : 0,
    record.supportsVision ? 1 : 0,
    record.supportsTools ? 1 : 0,
    timestamp,
    timestamp,
  );
  return getProvider(db, id)!;
}

export function getProvider(db: Database, id: string): ProviderRecord | null {
  const row = db.query("SELECT * FROM providers WHERE id = ?").get(id) as ProviderRow | null;
  return row ? toProviderRecord(row) : null;
}

export function listProviders(db: Database): ProviderRecord[] {
  const rows = db.query("SELECT * FROM providers ORDER BY created_at ASC").all() as ProviderRow[];
  return rows.map(toProviderRecord);
}

export function listEnabledProviders(db: Database): ProviderRecord[] {
  const rows = db
    .query("SELECT * FROM providers WHERE enabled = 1 ORDER BY created_at ASC")
    .all() as ProviderRow[];
  return rows.map(toProviderRecord);
}

export interface UpdateProviderRecord {
  label?: string;
  preset?: ProviderPreset;
  kind?: ProviderKind;
  baseUrl?: string;
  model?: string;
  apiKeyEnc?: string | null;
  apiKeyHint?: string | null;
  headers?: Record<string, string>;
  enabled?: boolean;
  supportsVision?: boolean;
  supportsTools?: boolean;
}

export function updateProvider(db: Database, id: string, patch: UpdateProviderRecord): ProviderRecord | null {
  const sets: string[] = [];
  const params: Array<string | number | null> = [];
  const map: Array<[keyof UpdateProviderRecord, string]> = [
    ["label", "label"],
    ["preset", "preset"],
    ["kind", "kind"],
    ["baseUrl", "base_url"],
    ["model", "model"],
    ["apiKeyEnc", "api_key_enc"],
    ["apiKeyHint", "api_key_hint"],
    ["headers", "headers_json"],
    ["enabled", "enabled"],
    ["supportsVision", "supports_vision"],
    ["supportsTools", "supports_tools"],
  ];

  for (const [key, column] of map) {
    const value = patch[key];
    if (value === undefined) continue;
    sets.push(`${column} = ?`);
    if (key === "headers") params.push(stringifyJson(value));
    else if (key === "enabled" || key === "supportsVision" || key === "supportsTools") params.push(value ? 1 : 0);
    else if (key === "baseUrl") params.push(String(value).replace(/\/+$/, ""));
    else params.push(value as string | null);
  }

  if (sets.length === 0) return getProvider(db, id);
  sets.push("updated_at = ?");
  params.push(nowIso());
  params.push(id);
  db.prepare(`UPDATE providers SET ${sets.join(", ")} WHERE id = ?`).run(...params);
  return getProvider(db, id);
}

export function deleteProvider(db: Database, id: string): boolean {
  const result = db.prepare("DELETE FROM providers WHERE id = ?").run(id);
  return result.changes > 0;
}

export function countProviders(db: Database): { configured: number; enabled: number } {
  const row = db
    .query(
      `SELECT COUNT(*) AS configured, SUM(CASE WHEN enabled = 1 THEN 1 ELSE 0 END) AS enabled FROM providers`,
    )
    .get() as { configured: number; enabled: number | null };
  return { configured: row.configured, enabled: row.enabled ?? 0 };
}

export function providerToInput(provider: Provider): ProviderInput {
  return {
    label: provider.label,
    preset: provider.preset,
    kind: provider.kind,
    baseUrl: provider.baseUrl,
    model: provider.model,
    headers: provider.headers,
    enabled: provider.enabled,
    supportsVision: provider.supportsVision,
    supportsTools: provider.supportsTools,
  };
}
