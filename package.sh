#!/usr/bin/env bash
set -euo pipefail

# ── Package Dollar Bill extension for distribution ──
#
# Usage:
#   ./package.sh              # creates ZIP (for Chrome Web Store)
#   ./package.sh --crx        # creates both ZIP and CRX (for private distribution)
#   ./package.sh --crx-only   # creates CRX only
#
# For CRX signing you need a private key (.pem).
# If --key is omitted, a new key is generated in build/ on first CRX build.

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
VERSION=$(node -e "console.log(require('$SCRIPT_DIR/manifest.json').version)")
BASENAME="dollar-bill"
BUILD_DIR="$SCRIPT_DIR/build"
OUT_ZIP="$BUILD_DIR/${BASENAME}-v${VERSION}.zip"
OUT_CRX="$BUILD_DIR/${BASENAME}-v${VERSION}.crx"

# Files/dirs to exclude from the package
EXCLUDE=(
  "CLAUDE.md"
  "STORE-LISTING.md"
  "docs"
  "build"
  "package.sh"
  ".git"
  ".gitignore"
  "*.md"
)

MODE="zip"
KEY_FILE=""

# ── Parse args ──
while [[ $# -gt 0 ]]; do
  case "$1" in
    --crx)       MODE="both" ;;
    --crx-only)  MODE="crx" ;;
    --key)       KEY_FILE="$2"; shift ;;
    -h|--help)
      echo "Usage: $0 [--crx] [--crx-only] [--key <path.pem>]"
      echo ""
      echo "  (default)       Create ZIP for Chrome Web Store upload"
      echo "  --crx           Create ZIP + CRX"
      echo "  --crx-only      Create CRX only"
      echo "  --key <path>    Use existing PEM key for CRX signing"
      exit 0
      ;;
    *) echo "Unknown option: $1"; exit 1 ;;
  esac
  shift
done

mkdir -p "$BUILD_DIR"

# ── Build ZIP ──
build_zip() {
  echo "Building ZIP v${VERSION}..."

  # Build exclude flags
  local exclude_flags=()
  for pattern in "${EXCLUDE[@]}"; do
    exclude_flags+=(--exclude="$pattern")
  done

  (cd "$SCRIPT_DIR" && zip -r "$OUT_ZIP" . \
    -x "CLAUDE.md" \
    -x "STORE-LISTING.md" \
    -x "README.md" \
    -x "package.sh" \
    -x "build/*" \
    -x "docs/*" \
    -x ".git/*" \
    -x ".gitignore" \
    -x ".gitattributes" \
    -x ".idea/*" \
    --quiet
  )

  local size
  size=$(du -h "$OUT_ZIP" | cut -f1)
  echo "  -> $OUT_ZIP ($size)"
}

# ── Build CRX using Chrome ──
build_crx() {
  echo "Building CRX v${VERSION}..."

  # Try to find Chrome/Chromium
  local CHROME=""
  for candidate in \
    "/c/Program Files/Google/Chrome/Application/chrome.exe" \
    "/mnt/c/Program Files/Google/Chrome/Application/chrome.exe" \
    "$(which google-chrome 2>/dev/null)" \
    "$(which chromium-browser 2>/dev/null)" \
    "$(which chromium 2>/dev/null)"; do
    if [[ -x "$candidate" ]]; then
      CHROME="$candidate"
      break
    fi
  done

  if [[ -z "$CHROME" ]]; then
    echo "ERROR: Chrome/Chromium not found. Install it or set PATH."
    echo "       On WSL, Chrome for Windows is usually at:"
    echo '       /mnt/c/Program Files/Google/Chrome/Application/chrome.exe'
    exit 1
  fi

  local key_args=()
  if [[ -n "$KEY_FILE" ]]; then
    key_args=(--pack-extension-key="$KEY_FILE")
  else
    # Auto-generate key if none provided
    local auto_key="$BUILD_DIR/${BASENAME}.pem"
    if [[ -f "$auto_key" ]]; then
      key_args=(--pack-extension-key="$auto_key")
    fi
    # If no key exists, Chrome will create one next to the CRX
  fi

  # Use a temp dir for the CRX output to avoid polluting project root
  local tmp_out
  tmp_out=$(mktemp -d)

  "$CHROME" --pack-extension="$SCRIPT_DIR" "${key_args[@]}" --pack-extension-output-dir="$tmp_out" 2>/dev/null || true

  # Chrome puts the CRX next to the extension dir or in output dir
  local crx_source="$tmp_out/${BASENAME}.crx"
  if [[ ! -f "$crx_source" ]]; then
    crx_source="${SCRIPT_DIR}.crx"
  fi

  if [[ -f "$crx_source" ]]; then
    mv "$crx_source" "$OUT_CRX"
  else
    echo "ERROR: Chrome did not produce a CRX file."
    echo "       Try running Chrome manually:"
    echo '       chrome --pack-extension=/path/to/dollar-bill-ext'
    rm -rf "$tmp_out"
    exit 1
  fi

  # Move generated key to build/ if we didn't have one
  if [[ -z "$KEY_FILE" && -f "${SCRIPT_DIR}.pem" ]]; then
    mv "${SCRIPT_DIR}.pem" "$BUILD_DIR/${BASENAME}.pem"
    echo "  (private key saved to build/${BASENAME}.pem — keep it safe!)"
  fi

  rm -rf "$tmp_out"

  local size
  size=$(du -h "$OUT_CRX" | cut -f1)
  echo "  -> $OUT_CRX ($size)"
}

# ── Run ──
echo ""
case "$MODE" in
  zip)      build_zip ;;
  crx)      build_crx ;;
  both)     build_zip; build_crx ;;
esac

echo ""
echo "Done!"
