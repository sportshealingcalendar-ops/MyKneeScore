#!/usr/bin/env bash
# Run the scoring parity test against a local checkout of kneescore-research.
# Usage: tools/advanced/run-parity.sh /path/to/kneescore-research
# The research checkout needs `npm ci --legacy-peer-deps` and the test-only packages:
#   npm i --no-save --legacy-peer-deps jsdom @testing-library/react @testing-library/dom
set -euo pipefail
RESEARCH="${1:?path to kneescore-research checkout}"
HERE="$(cd "$(dirname "$0")" && pwd)"
SITE="$(cd "$HERE/../.." && pwd)"
DEST="$RESEARCH/src/__mks_parity__"
mkdir -p "$DEST"
cp "$HERE/parity.test.tsx" "$DEST/parity.test.tsx"
trap 'rm -rf "$DEST"' EXIT
cd "$RESEARCH"
MKS_ENGINE="$SITE/advanced/assets/engine.js" npx vitest run src/__mks_parity__
