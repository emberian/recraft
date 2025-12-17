#!/bin/bash
set -e

MC_DIR="$HOME/Library/Application Support/minecraft"
RECRAFT_DIR="$(cd "$(dirname "$0")" && pwd)"
VERSION="26.1-snapshot-1"
NATIVES_DIR="$MC_DIR/versions/$VERSION/natives"
VERSION_JSON="$MC_DIR/versions/$VERSION/$VERSION.json"

# Build classpath from version JSON (only libraries allowed on macOS)
CP="$RECRAFT_DIR/mc-26.1/mc-26.1-modded.jar"

# Parse libraries from version JSON, filtering by platform rules
while IFS= read -r path; do
  [ -n "$path" ] && CP="$CP:$MC_DIR/libraries/$path"
done < <(jq -r '.libraries[] |
  # Check if library is allowed on macOS
  select(
    (.rules == null) or
    ((.rules | map(select(.action == "allow" and (.os == null or .os.name == "osx"))) | length > 0) and
     (.rules | map(select(.action == "disallow" and .os.name == "osx")) | length == 0))
  ) |
  .downloads.artifact.path // empty' "$VERSION_JSON")

# Extract natives if needed
if [ ! -d "$NATIVES_DIR" ]; then
  mkdir -p "$NATIVES_DIR"
  echo "Extracting natives..."
  for native_jar in "$MC_DIR"/libraries/org/lwjgl/*-natives-macos*.jar "$MC_DIR"/libraries/ca/weblite/*.jar; do
    [ -f "$native_jar" ] && unzip -qo "$native_jar" -d "$NATIVES_DIR" 2>/dev/null || true
  done
fi

cd "$MC_DIR"

java \
  -XstartOnFirstThread \
  --enable-preview \
  --sun-misc-unsafe-memory-access=allow \
  --enable-native-access=ALL-UNNAMED \
  -Djava.library.path="$NATIVES_DIR" \
  -Djna.tmpdir="$NATIVES_DIR" \
  -Dorg.lwjgl.system.SharedLibraryExtractPath="$NATIVES_DIR" \
  -Dio.netty.native.workdir="$NATIVES_DIR" \
  -Dminecraft.launcher.brand=mcmod \
  -Dminecraft.launcher.version=0.1.0 \
  -cp "$CP" \
  net.minecraft.client.main.Main \
  --username Dev \
  --version "$VERSION" \
  --gameDir "$MC_DIR" \
  --assetsDir "$MC_DIR/assets" \
  --assetIndex 29 \
  --accessToken 0 \
  --versionType snapshot
