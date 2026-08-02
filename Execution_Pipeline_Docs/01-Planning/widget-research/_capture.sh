#!/bin/bash
# usage: ./_capture.sh <Widget> <name>   — no window activation, no resize
W="$1"; N="$2"
DIR="$(cd "$(dirname "$0")" && pwd)/${W}/screenshots"
mkdir -p "$DIR"
screencapture -x -o "$DIR/${N}.png"
sips -g pixelWidth -g pixelHeight "$DIR/${N}.png" 2>/dev/null | awk 'NR>1{printf "%s ", $2}'
echo "$(du -h "$DIR/${N}.png" | cut -f1)  ${N}.png"
