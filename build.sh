#!/usr/bin/env bash
# QDVC Research Pipeline — build script
# Assembles the modular sources in src/ into a single, self-contained
# dist/index.html with no external dependencies. Works on Linux and macOS.

set -euo pipefail

# Resolve the directory this script lives in (portable across Linux & macOS).
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

SRC="src"
DIST="dist"
OUT="$DIST/index.html"

CSS_FILES=(
  "$SRC/css/01-base.css"
  "$SRC/css/02-components.css"
  "$SRC/css/03-views.css"
)
JS_FILES=(
  "$SRC/js/01-store.js"
  "$SRC/js/02-util.js"
  "$SRC/js/03-table.js"
  "$SRC/js/04-modal.js"
  "$SRC/js/05-board.js"
  "$SRC/js/06-timeline.js"
  "$SRC/js/07-calendar.js"
  "$SRC/js/08-app.js"
)
BODY="$SRC/html/body.html"

# Verify every input exists before writing anything.
for f in "${CSS_FILES[@]}" "${JS_FILES[@]}" "$BODY"; do
  if [ ! -f "$f" ]; then
    echo "ERROR: missing source file: $f" >&2
    exit 1
  fi
done

mkdir -p "$DIST"

# Write the assembled file.
{
  cat <<'HTML_HEAD'
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>QDVC Research Pipeline</title>
<style>
HTML_HEAD

  for f in "${CSS_FILES[@]}"; do
    echo "/* ===== $(basename "$f") ===== */"
    cat "$f"
    echo ""
  done

  cat <<'HTML_MID'
</style>
</head>
<body>
HTML_MID

  cat "$BODY"

  echo "<script>"
  for f in "${JS_FILES[@]}"; do
    echo "/* ===== $(basename "$f") ===== */"
    cat "$f"
    echo ""
  done
  echo "</script>"

  cat <<'HTML_FOOT'
</body>
</html>
HTML_FOOT
} > "$OUT"

# Report result.
BYTES=$(wc -c < "$OUT" | tr -d ' ')
echo "Built $OUT ($BYTES bytes) from ${#CSS_FILES[@]} CSS + ${#JS_FILES[@]} JS modules."
