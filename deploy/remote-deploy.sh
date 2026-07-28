#!/usr/bin/env bash
set -euo pipefail

if [ "$#" -ne 4 ]; then
  echo "Usage: remote-deploy.sh APP_DIR_BASE64 ARCHIVE DIST DEPLOY_ID" >&2
  exit 2
fi

APP_DIR="$(printf '%s' "$1" | base64 --decode)"
ARCHIVE="$2"
DIST="$3"
DEPLOY_ID="$4"
STAGING="${APP_DIR}.staging-${DEPLOY_ID}"
BACKUP="${APP_DIR}.backup-${DEPLOY_ID}"
PUBLISHED=0

cleanup() {
  set +e
  rm -f "$ARCHIVE" "$DIST" "$0"
  rm -rf "$STAGING"
  if [ "$PUBLISHED" -eq 1 ]; then
    rm -rf "$BACKUP"
  elif [ -d "$BACKUP" ] && [ -d "$APP_DIR" ]; then
    rsync -a --delete "$BACKUP/" "$APP_DIR/"
    rm -rf "$BACKUP"
  fi
}
trap cleanup EXIT

validate_zip() {
  unzip -tq "$1" >/dev/null
  while IFS= read -r entry; do
    case "$entry" in
      /*|../*|*/../*|*/..|*\\* ) echo "Unsafe ZIP entry: $entry" >&2; return 1 ;;
    esac
  done < <(unzip -Z1 "$1")
}

validate_zip "$ARCHIVE"
validate_zip "$DIST"
command -v rsync >/dev/null
rm -rf "$STAGING" "$BACKUP"
mkdir -p "$(dirname "$APP_DIR")"
mkdir -p "$STAGING" "$BACKUP"
unzip -oq "$ARCHIVE" -d "$STAGING"
unzip -oq "$DIST" -d "$STAGING"
test -s "$STAGING/player.min.js"

if [ -d "$APP_DIR" ]; then
  rsync -a "$APP_DIR/" "$BACKUP/"
elif [ -e "$APP_DIR" ]; then
  echo "Deploy path exists but is not a directory: $APP_DIR" >&2
  exit 1
else
  mkdir -p "$APP_DIR"
fi
rsync -a --delete --delay-updates "$STAGING/" "$APP_DIR/"
PUBLISHED=1
echo ">>> CDN remote deploy completed successfully."
