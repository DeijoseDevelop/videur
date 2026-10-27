#!/usr/bin/env bun
import { Database } from "bun:sqlite";
import { existsSync, readdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { createConfig } from "@videur/core";

const config = createConfig();
if (!existsSync(config.paths.db)) {
  console.error(`No existe la base de datos: ${config.paths.db}`);
  process.exit(1);
}

const db = new Database(config.paths.db, { readonly: true });
const renders = new Set(
  (db.query("SELECT id FROM renders").all() as Array<{ id: string }>).map((row) => row.id),
);
const projects = new Set(
  (db.query("SELECT id FROM projects").all() as Array<{ id: string }>).map((row) => row.id),
);
db.close();

function orphanDirs(root: string, known: Set<string>): string[] {
  if (!existsSync(root)) return [];
  return readdirSync(root, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && !known.has(entry.name))
    .map((entry) => join(root, entry.name));
}

const orphanRenders = orphanDirs(config.paths.renders, renders);
const orphanWorkspaces = orphanDirs(config.paths.workspaces, projects);
const all = [...orphanRenders, ...orphanWorkspaces];
const apply = process.argv.includes("--yes");

if (all.length === 0) {
  console.log("No hay huérfanos.");
  process.exit(0);
}

console.log(`${all.length} huérfano(s):`);
for (const path of all) console.log(`  ${path}`);

if (!apply) {
  console.log("Dry-run. Ejecuta `bun run gc -- --yes` para borrar.");
  process.exit(0);
}

for (const path of all) rmSync(path, { recursive: true, force: true });
console.log(`Borrados ${all.length} huérfanos.`);
