#!/bin/bash
# Capture the Chrome window (page area only, tab strip excluded) into a widget's
# screenshots folder.
#
#   ./_capture.sh Calculator 01-app-surface
#
# Writes: widget-research/<Widget>/screenshots/<name>.png
#
# Excludes the tab strip so other open tabs' titles are not committed.
# Keeps the URL bar, which is evidence.

set -euo pipefail

WIDGET="${1:?usage: _capture.sh <Widget> <name>}"
NAME="${2:?usage: _capture.sh <Widget> <name>}"

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/${WIDGET}/screenshots"
mkdir -p "$DIR"
OUT="${DIR}/${NAME}.png"

# NOTE: the leading "" & is required. Without it AppleScript concatenates the
# integers into a list rather than a string and the parsed bounds are garbage.
BOUNDS=$(osascript -e 'tell application "Google Chrome"
activate
set b to bounds of front window
return ("" & (item 1 of b) & "," & (item 2 of b) & "," & (item 3 of b) & "," & (item 4 of b))
end tell' | tr -d ' ')

L=$(echo "$BOUNDS" | cut -d, -f1)
T=$(echo "$BOUNDS" | cut -d, -f2)
R=$(echo "$BOUNDS" | cut -d, -f3)
B=$(echo "$BOUNDS" | cut -d, -f4)

TAB_STRIP=58                 # px of Chrome tab strip to skip
Y=$((T + TAB_STRIP))
W=$((R - L))
H=$((B - Y))

sleep 1.2
screencapture -x -R"${L},${Y},${W},${H}" "$OUT"

echo "$(basename "$OUT")  $(sips -g pixelWidth -g pixelHeight "$OUT" | awk '/pixel/{printf "%s ", $2}')  $(du -h "$OUT" | cut -f1)"
