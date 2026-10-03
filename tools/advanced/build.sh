#!/usr/bin/env bash
# Regenerate the Advanced section from a kneescore-research checkout.
# Usage: tools/advanced/build.sh /path/to/kneescore-research
set -euo pipefail
RESEARCH="${1:?path to kneescore-research checkout}"
HERE="$(cd "$(dirname "$0")" && pwd)"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
cp "$HERE/export-data.ts" "$RESEARCH/.mks-export.ts"
( cd "$RESEARCH" && npx esbuild .mks-export.ts --bundle --platform=node --format=cjs --outfile="$TMP/export.cjs" --log-level=warning ); rm -f "$RESEARCH/.mks-export.ts"
node "$TMP/export.cjs" > "$TMP/scores.json"
SOURCE_COMMIT="$(git -C "$RESEARCH" rev-parse --short HEAD)" node "$HERE/build.mjs" "$TMP/scores.json"
