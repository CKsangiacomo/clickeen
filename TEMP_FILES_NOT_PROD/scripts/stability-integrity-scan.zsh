#!/usr/bin/env zsh
set -u
echo "== INTEGRITY SCAN =="
# List code files that contain literal '...' (possible truncations)
grep -RIn --include='*.{ts,tsx,js,mjs,cjs}' --exclude-dir='node_modules' --exclude-dir='.next' --exclude-dir='.turbo' --exclude-dir='.vercel' '^\s*\.\.\.$|\.\.\.[^a-zA-Z]' apps services packages dieter 2>/dev/null | sed 's/^/SUSPECT: /' || true
echo "== END SCAN =="
