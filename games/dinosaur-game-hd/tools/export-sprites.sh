#!/bin/sh
# Exports every art/aseprite/*.aseprite to assets/sprites/<name>.png + .json
# (one horizontal strip, no trim, with tags; runners also have slices).
# The game's loader (src/sprites.js) and tools/art-test.mjs read these.
#   tools/export-sprites.sh            export all
#   tools/export-sprites.sh trex       export one
#   BUILD=1 tools/export-sprites.sh    rebuild from the Lua scripts first (overwrites hand edits)
set -e
cd "$(dirname "$0")/.."
ASEPRITE="${ASEPRITE:-$(command -v aseprite || true)}"
[ -n "$ASEPRITE" ] || ASEPRITE="$HOME/Library/Application Support/Steam/steamapps/common/Aseprite/Aseprite.app/Contents/MacOS/aseprite"
[ -n "$ASEPRITE" ] || ASEPRITE=/Applications/Aseprite.app/Contents/MacOS/aseprite
[ -x "$ASEPRITE" ] || { echo "Aseprite not found; set ASEPRITE=/path/to/aseprite" >&2; exit 1; }

mkdir -p assets/sprites
names="$*"
[ -n "$names" ] || names=$(ls art/aseprite/runners/*.lua art/aseprite/world/*.lua art/aseprite/bg/*.lua art/aseprite/ui/*.lua art/aseprite/*.aseprite 2>/dev/null | xargs -n1 basename | sed 's/\.[a-z]*$//' | grep -vx base | sort -u)
for n in $names; do
  if [ -n "$BUILD" ] || [ ! -f "art/aseprite/$n.aseprite" ]; then
    "$ASEPRITE" -b --script-param root="$PWD" --script-param name="$n" --script art/aseprite/build.lua
  fi
  "$ASEPRITE" -b "art/aseprite/$n.aseprite" --sheet-type horizontal \
    --sheet "assets/sprites/$n.png" --data "assets/sprites/$n.json" \
    --format json-array --list-tags --list-slices >/dev/null
  echo "exported assets/sprites/$n.png"
done
