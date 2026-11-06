#!/usr/bin/env bash
# Baut die signierte Android-App (APK) aus diesem Projekt.
#
# Läuft unter Linux (auch WSL unter Windows und in Claudes Cloud-Umgebung).
# Beim ersten Lauf lädt das Skript das Android SDK herunter (etwa 1 GB) und braucht
# dafür 15 bis 25 Minuten. Danach liegt alles im Zwischenspeicher und ein Bau dauert
# nur noch wenige Minuten.
#
# Aufruf im Projektordner:   bash scripts/build-apk.sh
# Alles neu erzeugen:        bash scripts/build-apk.sh --clean
#
# Voraussetzungen: Node.js ab 20, Java 17 bis 21, curl, unzip.
# Ergebnis: apk/MyNotes-<Version>.apk

set -euo pipefail
cd "$(dirname "$0")/.."
ROOT="$PWD"
CLEAN=0
[[ "${1:-}" == "--clean" ]] && CLEAN=1

step() { printf '\n==> %s\n' "$*"; }
fail() { printf '\nFehler: %s\n' "$*" >&2; exit 1; }

# ---------- Werkzeuge prüfen ----------
command -v node >/dev/null || fail "Node.js fehlt."
command -v java >/dev/null || fail "Java fehlt (Version 17 bis 21)."
NODE_MAJOR=$(node -p 'process.versions.node.split(".")[0]')
(( NODE_MAJOR >= 20 )) || fail "Node.js ab Version 20 nötig, gefunden: $(node -v)"
[[ -f signing/keystore.properties ]] || fail "signing/keystore.properties fehlt. Ohne Schlüssel lässt sich die App nicht aktualisieren."

VERSION=$(node -p 'require("./app.json").expo.version')
CODE=$(node -p 'require("./app.json").expo.android.versionCode')

# ---------- Android SDK ----------
export ANDROID_HOME="${ANDROID_HOME:-$HOME/android-sdk}"
export ANDROID_SDK_ROOT="$ANDROID_HOME"
SDKMANAGER="$ANDROID_HOME/cmdline-tools/latest/bin/sdkmanager"
if [[ ! -x "$SDKMANAGER" ]]; then
  step "Android SDK wird eingerichtet in $ANDROID_HOME"
  mkdir -p "$ANDROID_HOME/cmdline-tools"
  TMP=$(mktemp -d)
  curl -fsSL -o "$TMP/tools.zip" https://dl.google.com/android/repository/commandlinetools-linux-13114758_latest.zip
  unzip -q "$TMP/tools.zip" -d "$TMP"
  mv "$TMP/cmdline-tools" "$ANDROID_HOME/cmdline-tools/latest"
  rm -rf "$TMP"
fi
yes | "$SDKMANAGER" --licenses >/dev/null 2>&1 || true
# Weitere Bausteine (NDK, CMake, passende Plattform) lädt Gradle bei Bedarf selbst.
"$SDKMANAGER" --install "platform-tools" >/dev/null

# ---------- Pakete ----------
if [[ ! -d node_modules ]] || [[ package-lock.json -nt node_modules/.package-lock.json ]]; then
  step "Pakete installieren"
  npm ci --no-audit --no-fund
fi

step "Prüfen: Typen und Tests"
npx tsc --noEmit
npx vitest run --reporter=dot

# ---------- Android-Projekt erzeugen ----------
step "Android-Projekt erzeugen"
if (( CLEAN )) || [[ ! -d android ]]; then
  npx expo prebuild --platform android --clean --no-install
else
  npx expo prebuild --platform android --no-install
fi

# Signierung eintragen und nur für 64-Bit-Handys (arm64) bauen, das spart viel Zeit.
node - <<'JS'
const fs = require('fs')
const gradle = 'android/app/build.gradle'
let s = fs.readFileSync(gradle, 'utf8')
if (!s.includes('mynotesRelease')) {
  s = s.replace(
    /signingConfigs \{/,
    `signingConfigs {
        mynotesRelease {
            def props = new Properties()
            file("../../signing/keystore.properties").withInputStream { props.load(it) }
            storeFile file("../../signing/" + props.storeFile)
            storePassword props.storePassword
            keyAlias props.keyAlias
            keyPassword props.keyPassword
        }`,
  )
  s = s.replace(
    /(release \{[^}]*?)signingConfig signingConfigs\.debug/,
    '$1signingConfig signingConfigs.mynotesRelease',
  )
  if (!s.includes('signingConfig signingConfigs.mynotesRelease')) throw new Error('Signierung konnte nicht eingetragen werden')
  fs.writeFileSync(gradle, s)
}
const propsFile = 'android/gradle.properties'
let p = fs.readFileSync(propsFile, 'utf8')
const set = (k, v) => { const re = new RegExp(`^${k}=.*$`, 'm'); p = re.test(p) ? p.replace(re, `${k}=${v}`) : p + `\n${k}=${v}` }
set('reactNativeArchitectures', 'arm64-v8a')
// Sparsam mit Arbeitsspeicher, damit der Bau auch auf Rechnern mit 8 GB nicht abbricht.
set('org.gradle.jvmargs', '-Xmx3g -XX:MaxMetaspaceSize=768m')
set('kotlin.compiler.execution.strategy', 'in-process')
set('org.gradle.workers.max', '2')
set('org.gradle.parallel', 'false')
set('org.gradle.caching', 'true')
fs.writeFileSync(propsFile, p)
JS

# ---------- Bauen ----------
step "APK bauen (Version $VERSION, Build $CODE)"
(cd android && ./gradlew assembleRelease --console=plain -q --init-script "$ROOT/scripts/maven-mirror.gradle")

OUT="apk/MyNotes-$VERSION.apk"
mkdir -p apk
cp android/app/build/outputs/apk/release/app-release.apk "$OUT"

# ---------- Kontrolle ----------
step "Fertig: $OUT"
AAPT=$(ls -d "$ANDROID_HOME"/build-tools/*/ 2>/dev/null | sort -V | tail -1)
if [[ -n "$AAPT" && -x "$AAPT/aapt" ]]; then
  echo "Berechtigungen der App:"
  "$AAPT/aapt" dump permissions "$OUT" | grep -E "uses-permission" | sed 's/^/  /' || echo "  keine"
  "$AAPT/apksigner" verify --print-certs "$OUT" | grep -m1 "SHA-256" | sed 's/^/  Signatur /' || true
fi
ls -lh "$OUT" | awk '{print "  Größe " $5}'
