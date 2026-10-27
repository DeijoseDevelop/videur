#!/usr/bin/env bun
import { Database } from "bun:sqlite";
import { existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { createConfig } from "@videur/core";

const config = createConfig();
if (!existsSync(config.paths.db)) {
  console.error(`No existe la base de datos: ${config.paths.db}`);
  process.exit(1);
}

const outDir = join(config.dataDir, "backups");
mkdirSync(outDir, { recursive: true });
const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const out = join(outDir, `videur-${stamp}.sqlite`);

const db = new Database(config.paths.db);
try {
  db.run("VACUUM INTO ?", [out]);
  console.log(out);
} finally {
  db.close();
}
