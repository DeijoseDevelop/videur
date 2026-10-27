#!/usr/bin/env bash
# Enlaza skills/videur en los directorios de skills de los agentes.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
for dir in .claude/skills .opencode/skills .cursor/skills .codex/skills; do
  mkdir -p "$ROOT/$dir"
  ln -sfn "$ROOT/skills/videur" "$ROOT/$dir/videur"
  echo "✔ $dir/videur"
done
