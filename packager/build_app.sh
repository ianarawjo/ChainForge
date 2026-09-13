#!/usr/bin/env bash
# Builds ChainForge.app: a menu-bar launcher that starts ChainForge on demand
# and stops it when you quit, or when no ChainForge tab has been open for a
# while. See README.md.
set -euo pipefail

usage() {
  cat <<USAGE
Usage: $0 [options]

  --dest DIR            Where to put ChainForge.app (default: ~/Applications)
  --desktop-shortcut    Also put a ChainForge shortcut on the Desktop
  --port N              Port for ChainForge (default: 8000)
  --idle-minutes N      Stop after N minutes with no ChainForge tab open (default: 20)
  --dir PATH            Folder for saved flows (default: ChainForge's usual one)
  --chainforge PATH     The chainforge command (default: found on PATH)
  --uv PATH             The uv command (default: found on PATH)
USAGE
}

DEST="$HOME/Applications"
DESKTOP=0
PORT=8000
IDLE=20
FLOWS_DIR=""
CHAINFORGE=""
UV=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --dest) DEST="$2"; shift 2 ;;
    --desktop-shortcut) DESKTOP=1; shift ;;
    --port) PORT="$2"; shift 2 ;;
    --idle-minutes) IDLE="$2"; shift 2 ;;
    --dir) FLOWS_DIR="$2"; shift 2 ;;
    --chainforge) CHAINFORGE="$2"; shift 2 ;;
    --uv) UV="$2"; shift 2 ;;
    -h|--help) usage; exit 0 ;;
    *) echo "Unknown option: $1" >&2; usage >&2; exit 2 ;;
  esac
done

fail() { echo "Error: $*" >&2; exit 1; }

# A double-clicked app does not get your shell's PATH, so both commands are
# resolved now and written into the app as absolute paths.
UV="${UV:-$(command -v uv || true)}"
[[ -z "$UV" && -x "$HOME/.local/bin/uv" ]] && UV="$HOME/.local/bin/uv"
[[ -x "$UV" ]] || fail "uv not found. Install it: https://docs.astral.sh/uv/getting-started/installation/"

CHAINFORGE="${CHAINFORGE:-$(command -v chainforge || true)}"
[[ -z "$CHAINFORGE" && -x "$HOME/.local/bin/chainforge" ]] && CHAINFORGE="$HOME/.local/bin/chainforge"
[[ -x "$CHAINFORGE" ]] || fail "chainforge not found. Install it first, e.g.: uv tool install \"chainforge[rag]\""

"$CHAINFORGE" serve --help 2>/dev/null | grep -q -- "--idle-shutdown" \
  || fail "$CHAINFORGE does not support --idle-shutdown. Install a ChainForge version that does (see README.md)."

[[ "$PORT" =~ ^[0-9]+$ ]] || fail "--port must be a number"
[[ "$IDLE" =~ ^[0-9]+([.][0-9]+)?$ ]] || fail "--idle-minutes must be a number"
for value in "$UV" "$CHAINFORGE" "$FLOWS_DIR" "$DEST"; do
  [[ "$value" != *\"* && "$value" != *\\* ]] || fail "paths cannot contain quotes or backslashes: $value"
done

HERE="$(cd "$(dirname "$0")" && pwd)"
REPO="$(cd "$HERE/.." && pwd)"
APP="$DEST/ChainForge.app"
RES="$APP/Contents/Resources"

mkdir -p "$DEST"
rm -rf "$APP"
mkdir -p "$APP/Contents/MacOS" "$RES"
cp "$HERE/chainforge_menubar.py" "$HERE/launcher_core.py" "$RES/"

FLOWS_JSON="null"
[[ -n "$FLOWS_DIR" ]] && FLOWS_JSON="\"$FLOWS_DIR\""
cat > "$RES/launcher.json" <<JSON
{
  "chainforge": "$CHAINFORGE",
  "host": "127.0.0.1",
  "port": $PORT,
  "idle_shutdown_minutes": $IDLE,
  "flows_dir": $FLOWS_JSON
}
JSON

cat > "$APP/Contents/MacOS/ChainForge" <<LAUNCH
#!/bin/bash
# Runs the menu-bar launcher with uv, which provides its one dependency (rumps).
LOGS="\$HOME/Library/Logs/ChainForge Launcher"
mkdir -p "\$LOGS"
RES="\$(cd "\$(dirname "\$0")/../Resources" && pwd)"
# Keep Python from writing cache files into the app bundle.
export PYTHONDONTWRITEBYTECODE=1
exec "$UV" run --quiet --script "\$RES/chainforge_menubar.py" >>"\$LOGS/launcher.log" 2>&1
LAUNCH
chmod +x "$APP/Contents/MacOS/ChainForge"

cat > "$APP/Contents/Info.plist" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>CFBundleName</key><string>ChainForge</string>
  <key>CFBundleDisplayName</key><string>ChainForge</string>
  <key>CFBundleIdentifier</key><string>org.chainforge.launcher</string>
  <key>CFBundleExecutable</key><string>ChainForge</string>
  <key>CFBundlePackageType</key><string>APPL</string>
  <key>CFBundleVersion</key><string>1</string>
  <key>CFBundleShortVersionString</key><string>1.0</string>
  <key>CFBundleIconFile</key><string>AppIcon</string>
  <key>LSUIElement</key><true/>
  <key>LSMinimumSystemVersion</key><string>11.0</string>
</dict>
</plist>
PLIST

# Icons from the ChainForge logo: the app icon, and a small menu-bar icon.
LOGO="$REPO/chainforge/react-server/public/logo512.png"
if [[ -f "$LOGO" ]]; then
  ICONSET="$(mktemp -d)/AppIcon.iconset"
  mkdir -p "$ICONSET"
  for size in 16 32 128 256; do
    sips -z $size $size "$LOGO" --out "$ICONSET/icon_${size}x${size}.png" >/dev/null
    sips -z $((size * 2)) $((size * 2)) "$LOGO" --out "$ICONSET/icon_${size}x${size}@2x.png" >/dev/null
  done
  cp "$LOGO" "$ICONSET/icon_512x512.png"
  iconutil -c icns "$ICONSET" -o "$RES/AppIcon.icns"
  sips -z 36 36 "$LOGO" --out "$RES/menubar-icon.png" >/dev/null
fi

echo "Checking the launcher's dependencies (the first run downloads rumps)..."
PYTHONDONTWRITEBYTECODE=1 "$UV" run --quiet --script "$RES/chainforge_menubar.py" --check

if [[ "$DESKTOP" == 1 ]]; then
  rm -f "$HOME/Desktop/ChainForge"
  osascript -e "tell application \"Finder\" to make alias file to (POSIX file \"$APP\") at desktop with properties {name:\"ChainForge\"}" >/dev/null
  echo "Added a ChainForge shortcut to the Desktop."
fi

echo "Built $APP"
echo "Double-click it to start ChainForge. Quit from the ChainForge menu-bar icon."
