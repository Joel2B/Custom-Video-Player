#!/usr/bin/env bash
set -euo pipefail
trap 'status=$?; printf "line=%s exit=%s\n" "$LINENO" "$status" > /tmp/cvp-last-error.log' ERR

APP_DIR='/home/j/player'
NGINX_CONFIG='/home/j/nginx/player.conf'
STATE_DIR='/var/lib/cvp-deploy'
LOCK_FILE="$STATE_DIR/deploy.lock"
TRANSACTION_DIR="$STATE_DIR/transaction"
EXTRACTOR='/usr/local/libexec/cvp-safe-extract.py'
ACTIVATE='/usr/local/sbin/cvp-nginx-activate'

if [ "$#" -ne 2 ]; then
  echo 'Usage: remote-deploy.sh DEPLOY_ID SHA256' >&2
  exit 2
fi

DEPLOY_ID="$1"
EXPECTED_SHA="$2"
WORK_DIR="$(mktemp -d /tmp/cvp-deploy.XXXXXXXXXX)"
PACKAGE="$WORK_DIR/package.zip"
INCOMING="$WORK_DIR/incoming"
ARCHIVE="$INCOMING/cdn.zip"
DIST="$INCOMING/dist.zip"
STAGING="$WORK_DIR/staging"
BACKUP="$TRANSACTION_DIR/player"
PREVIOUS_FILE="$TRANSACTION_DIR/previous"
TRANSACTION_MARKER="$TRANSACTION_DIR/prepared"
APP_MUTATED=0
ACTIVATED=0
PUBLISHED=0
PREVIOUS_DEPLOYMENT=''
PREVIOUS_SHA=''

fail() {
  echo "$1" >&2
  return 1
}

activate() {
  sudo -n "$ACTIVATE" "$1" "$2"
}

rollback() {
  local failed=0
  if [ "$APP_MUTATED" -eq 1 ]; then
    rsync -a --delete "$BACKUP/" "$APP_DIR/" || failed=1
    chmod 755 "$APP_DIR" || failed=1
  fi
  if [ "$ACTIVATED" -eq 1 ]; then
    activate "$PREVIOUS_DEPLOYMENT" "$PREVIOUS_SHA" || failed=1
  fi
  if [ "$failed" -ne 0 ]; then
    echo 'ROLLBACK FAILED: manual recovery required' >&2
    return 1
  else
    rm -rf -- "$TRANSACTION_DIR"
  fi
}

cleanup() {
  local status=$?
  trap - EXIT
  if [ "$status" -ne 0 ] && [ "$PUBLISHED" -eq 0 ]; then rollback || true; fi
  rm -rf -- "$WORK_DIR"
  exit "$status"
}
trap cleanup EXIT

umask 077
exec 9>"$LOCK_FILE"
flock -n 9 || fail 'Another remote deploy is already running'

if [ -e "$TRANSACTION_DIR" ]; then
  [ -d "$TRANSACTION_DIR" ] && [ ! -L "$TRANSACTION_DIR" ] || fail 'Unsafe transaction path'
  if [ -f "$TRANSACTION_MARKER" ]; then
    [ -d "$BACKUP" ] && [ -f "$PREVIOUS_FILE" ] || fail 'Incomplete prior transaction backup'
    read -r PREVIOUS_DEPLOYMENT PREVIOUS_SHA < "$PREVIOUS_FILE"
    APP_MUTATED=1
    ACTIVATED=1
    rollback || fail 'Previous transaction rollback failed'
    APP_MUTATED=0
    ACTIVATED=0
  else
    rm -rf -- "$TRANSACTION_DIR"
  fi
fi

printf '%s' "$DEPLOY_ID" | grep -Eq '^[0-9]{8}T[0-9]{6}Z-[a-f0-9]{32}$' || fail 'Invalid deployment ID'
printf '%s' "$EXPECTED_SHA" | grep -Eq '^[a-f0-9]{64}$' || fail 'Invalid SHA-256'
for command in flock head python3 realpath rsync sha256sum stat sudo timeout; do
  command -v "$command" >/dev/null || fail "Required command not found: $command"
done
[ -f "$EXTRACTOR" ] && [ ! -L "$EXTRACTOR" ] || fail 'Safe extractor missing'
[ -x "$ACTIVATE" ] && [ ! -L "$ACTIVATE" ] || fail 'Nginx activation helper missing'
[ "$(realpath -e "$APP_DIR")" = "$APP_DIR" ] || fail 'Unexpected application path'
[ -d "$APP_DIR" ] && [ ! -L "$APP_DIR" ] || fail 'Application path must be a real directory'
[ -f "$NGINX_CONFIG" ] && [ ! -L "$NGINX_CONFIG" ] || fail 'Nginx config must be a regular file'

timeout 120 head -c 134217729 > "$PACKAGE"
[ "$(stat -c %s "$PACKAGE")" -le 134217728 ] || fail 'Deployment package too large'
mkdir -m 700 "$INCOMING" "$STAGING"
python3 "$EXTRACTOR" "$PACKAGE" "$INCOMING"
[ -f "$ARCHIVE" ] && [ -f "$DIST" ] || fail 'Deployment package is incomplete'
python3 "$EXTRACTOR" "$ARCHIVE" "$STAGING"
python3 "$EXTRACTOR" "$DIST" "$STAGING"

BUNDLE_RELATIVE="v1/deployments/$DEPLOY_ID/sha256/$EXPECTED_SHA/player.min.js"
[ -s "$STAGING/$BUNDLE_RELATIVE" ] || fail 'CDN bundle missing from archive'
printf '%s  %s\n' "$EXPECTED_SHA" "$STAGING/$BUNDLE_RELATIVE" | sha256sum -c -

if [ -d "$APP_DIR/v1/deployments" ]; then
  if find "$APP_DIR/v1/deployments" ! -type d ! -type f -print -quit | grep -q .; then
    fail 'Historical deployments contain special files'
  fi
  while IFS= read -r directory; do
    name="$(basename "$directory")"
    printf '%s' "$name" | grep -Eq '^[0-9]{8}T[0-9]{6}Z-([a-f0-9]{8}|[a-f0-9]{32})$' || fail "Unexpected deployment directory: $name"
  done < <(find "$APP_DIR/v1/deployments" -mindepth 1 -maxdepth 1 -type d -print)
  mkdir -p "$STAGING/v1/deployments"
  rsync -a --safe-links "$APP_DIR/v1/deployments/" "$STAGING/v1/deployments/"
fi

read -r PREVIOUS_DEPLOYMENT PREVIOUS_SHA < <(
  sed -nE 's#.*return 302 /v1/deployments/([0-9]{8}T[0-9]{6}Z-([a-f0-9]{8}|[a-f0-9]{32}))/sha256/([a-f0-9]{64})/.*#\1 \3#p' "$NGINX_CONFIG"
)
printf '%s' "$PREVIOUS_DEPLOYMENT" | grep -Eq '^[0-9]{8}T[0-9]{6}Z-([a-f0-9]{8}|[a-f0-9]{32})$' || fail 'Current deployment is invalid'
printf '%s' "$PREVIOUS_SHA" | grep -Eq '^[a-f0-9]{64}$' || fail 'Current SHA-256 is invalid'
[ -d "$STAGING/v1/deployments/$PREVIOUS_DEPLOYMENT" ] || fail 'Current deployment is missing from history'

declare -A KEEP=(["$DEPLOY_ID"]=1 ["$PREVIOUS_DEPLOYMENT"]=1)
while IFS= read -r deployment; do
  [ "${#KEEP[@]}" -ge 10 ] && break
  KEEP["$deployment"]=1
done < <(find "$STAGING/v1/deployments" -mindepth 1 -maxdepth 1 -type d -printf '%f\n' | sort -r)
while IFS= read -r deployment; do
  if [ -z "${KEEP[$deployment]+x}" ]; then rm -rf -- "$STAGING/v1/deployments/$deployment"; fi
done < <(find "$STAGING/v1/deployments" -mindepth 1 -maxdepth 1 -type d -printf '%f\n')
[ "$(find "$STAGING/v1/deployments" -mindepth 1 -maxdepth 1 -type d | wc -l)" -le 10 ]

mkdir -m 700 "$TRANSACTION_DIR" "$BACKUP"
rsync -a "$APP_DIR/" "$BACKUP/"
printf '%s %s\n' "$PREVIOUS_DEPLOYMENT" "$PREVIOUS_SHA" > "$PREVIOUS_FILE"
printf '%s\n' "$DEPLOY_ID" > "$TRANSACTION_MARKER"
APP_MUTATED=1
rsync -a --delete --delay-updates "$STAGING/" "$APP_DIR/"
chmod 755 "$APP_DIR"
find "$APP_DIR" -type d -exec chmod 755 {} +
find "$APP_DIR" -type f -exec chmod 644 {} +
printf '%s  %s\n' "$EXPECTED_SHA" "$APP_DIR/$BUNDLE_RELATIVE" | sha256sum -c -

ACTIVATED=1
activate "$DEPLOY_ID" "$EXPECTED_SHA"
grep -Fq "return 302 /$BUNDLE_RELATIVE;" "$NGINX_CONFIG"

rm -f -- "$TRANSACTION_MARKER"
PUBLISHED=1
rm -rf -- "$TRANSACTION_DIR"
rm -f /tmp/cvp-last-error.log
echo '>>> CDN remote deploy completed successfully.'
