#!/usr/bin/env bash
# Copy the latest Nimbus OS frontend into os/ so the app runs fully offline.
# Run this before building a new dmg when the OS code changes.
set -euo pipefail
SRC="$HOME/Documents/Claude Projects/browser-os"
HERE="$(cd "$(dirname "$0")" && pwd)"
rsync -a --delete --exclude='.claude' --exclude='.git' --exclude='.DS_Store' "$SRC/" "$HERE/os/"
echo "✓ Bundled Nimbus OS → os/"
ls "$HERE/os" | sed 's/^/    /'
