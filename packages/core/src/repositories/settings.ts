import type { Database } from "bun:sqlite";
import { DEFAULT_SETTINGS, mergeSettings, type AppSettings, type UpdateSettingsInput } from "@videur/contracts";
import { parseJson, stringifyJson } from "../utils/json";
import { nowIso } from "../utils/time";

interface SettingRow {
  key: string;
  value_json: string;
  updated_at: string;
}

export function getSetting<T>(db: Database, key: string, fallback: T): T {
  const row = db.query("SELECT * FROM settings WHERE key = ?").get(key) as SettingRow | null;
  return row ? parseJson<T>(row.value_json, fallback) : fallback;
}

export function setSetting<T>(db: Database, key: string, value: T): void {
  db.prepare(
    `INSERT INTO settings (key, value_json, updated_at) VALUES (?, ?, ?)
     ON CONFLICT(key) DO UPDATE SET value_json = excluded.value_json, updated_at = excluded.updated_at`,
  ).run(key, stringifyJson(value), nowIso());
}

export function getAppSettings(db: Database): AppSettings {
  const stored = getSetting<Partial<AppSettings>>(db, "app", {});
  return mergeSettings(DEFAULT_SETTINGS, stored as UpdateSettingsInput);
}

export function saveAppSettings(db: Database, patch: UpdateSettingsInput): AppSettings {
  const next = mergeSettings(getAppSettings(db), patch);
  setSetting(db, "app", next);
  return next;
}

export function resetAppSettings(db: Database): AppSettings {
  setSetting(db, "app", DEFAULT_SETTINGS);
  return DEFAULT_SETTINGS;
}
