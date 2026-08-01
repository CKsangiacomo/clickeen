#!/bin/bash
# usage: ./_capture.sh <Widget> <name>
W="$1"; N="$2"
DIR="$(cd "$(dirname "$0")" && pwd)/${W}/screenshots"
mkdir -p "$DIR"
# front the Elfsight tab in Chrome so screencapture grabs the right thing
osascript >/dev/null 2>&1 <<'AS'
tell application "Google Chrome"
  activate
  repeat with w in windows
    set i to 0
    repeat with t in tabs of w
      set i to i + 1
      if URL of t contains "elfsight" then
        set active tab index of w to i
        set index of w to 1
        return
      end if
    end repeat
  end repeat
end tell
AS
sleep 1.2
screencapture -x -o "$DIR/${N}.png"
sips -g pixelWidth -g pixelHeight "$DIR/${N}.png" 2>/dev/null | awk 'NR>1{printf "%s ", $2}'
echo "$(du -h "$DIR/${N}.png" | cut -f1)  ${N}.png"
