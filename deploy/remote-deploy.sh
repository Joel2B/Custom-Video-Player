#!/usr/bin/env bash
set -euo pipefail
trap 'status=$?; printf "line=%s exit=%s\n" "$LINENO" "$status" > /tmp/cvp-last-error.log' ERR

APP_DIR='/home/j/player'
NGINX_CONFIG='/home/j/nginx/player.conf'
CONTAINER='player'
LOCK_FILE='/home/j/.player-deploy.lock'
TRANSACTION_DIR='/home/j/.player-deploy-transaction'
NGINX_IMAGE='nginx@sha256:b3c656d55d7ad751196f21b7fd2e8d4da9cb430e32f646adcf92441b72f82b14'

if [ "$#" -ne 2 ]; then
  echo 'Usage: remote-deploy.sh DEPLOY_ID SHA256' >&2
  exit 2
fi

DEPLOY_ID="$1"
EXPECTED_SHA="$2"
WORK_DIR="$(dirname "$(realpath "$0")")"
ARCHIVE="$WORK_DIR/cdn.zip"
DIST="$WORK_DIR/dist.zip"
NGINX_SOURCE="$WORK_DIR/player.conf"
EXTRACTOR="$WORK_DIR/safe_extract.py"
STAGING="$WORK_DIR/staging"
BACKUP="$TRANSACTION_DIR/player"
CONFIG_BACKUP="$TRANSACTION_DIR/player.conf"
TRANSACTION_MARKER="$TRANSACTION_DIR/prepared"
CONFIG_SOURCE="$WORK_DIR/player.conf.final"
APP_MUTATED=0
CONFIG_MUTATED=0
PUBLISHED=0

fail() {
  echo "$1" >&2
  return 1
}

write_nginx_config() {
  local source="$1"
  docker run --rm \
    -v '/home/j/nginx:/config' \
    -v "$source:/source:ro" \
    "$NGINX_IMAGE" sh -c 'cat /source > /config/player.conf'
}

rollback() {
  local failed=0

  if [ "$APP_MUTATED" -eq 1 ]; then
    rsync -a --delete "$BACKUP/" "$APP_DIR/" || failed=1
    chmod 755 "$APP_DIR" || failed=1
  fi
  if [ "$CONFIG_MUTATED" -eq 1 ]; then
    write_nginx_config "$CONFIG_BACKUP" || failed=1
  fi
  if [ "$APP_MUTATED" -eq 1 ] || [ "$CONFIG_MUTATED" -eq 1 ]; then
    docker exec "$CONTAINER" nginx -t >/dev/null 2>&1 || failed=1
    docker exec "$CONTAINER" nginx -s reload >/dev/null 2>&1 || failed=1
  fi

  if [ "$failed" -ne 0 ]; then
    echo 'ROLLBACK FAILED: manual recovery required' >&2
  else
    rm -rf -- "$TRANSACTION_DIR"
  fi
}

cleanup() {
  local status=$?
  trap - EXIT
  if [ "$status" -ne 0 ] && [ "$PUBLISHED" -eq 0 ]; then
    rollback
  fi
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
    [ -d "$BACKUP" ] && [ -f "$CONFIG_BACKUP" ] || fail 'Incomplete prior transaction backup'
    APP_MUTATED=1
    CONFIG_MUTATED=1
    rollback
    APP_MUTATED=0
    CONFIG_MUTATED=0
  else
    rm -rf -- "$TRANSACTION_DIR"
  fi
fi

printf '%s' "$DEPLOY_ID" | grep -Eq '^[0-9]{8}T[0-9]{6}Z-[a-f0-9]{32}$' || fail 'Invalid deployment ID'
printf '%s' "$EXPECTED_SHA" | grep -Eq '^[a-f0-9]{64}$' || fail 'Invalid SHA-256'
printf '%s' "$WORK_DIR" | grep -Eq '^/tmp/cvp-deploy\.[A-Za-z0-9]{10}$' || fail 'Unsafe work directory'

for command in docker flock python3 realpath rsync sha256sum; do
  command -v "$command" >/dev/null || fail "Required command not found: $command"
done
for file in "$ARCHIVE" "$DIST" "$NGINX_SOURCE" "$EXTRACTOR"; do
  [ -f "$file" ] && [ ! -L "$file" ] || fail "Unsafe or missing artifact: $file"
done

[ "$(realpath -e "$APP_DIR")" = "$APP_DIR" ] || fail 'Unexpected application path'
[ -d "$APP_DIR" ] && [ ! -L "$APP_DIR" ] || fail 'Application path must be a real directory'
[ "$(realpath -e "$(dirname "$NGINX_CONFIG")")" = '/home/j/nginx' ] || fail 'Unexpected Nginx config directory'
[ -f "$NGINX_CONFIG" ] && [ ! -L "$NGINX_CONFIG" ] || fail 'Nginx config must be a regular file'

mkdir -m 700 "$STAGING"
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

CURRENT_DEPLOYMENT="$(sed -nE 's#.*return 302 /v1/deployments/([0-9]{8}T[0-9]{6}Z-([a-f0-9]{8}|[a-f0-9]{32}))/.*#\1#p' "$NGINX_CONFIG")"
if [ -n "$CURRENT_DEPLOYMENT" ] && [ ! -d "$STAGING/v1/deployments/$CURRENT_DEPLOYMENT" ]; then
  fail 'Current deployment is missing from history'
fi

declare -A KEEP=(["$DEPLOY_ID"]=1)
if [ -n "$CURRENT_DEPLOYMENT" ]; then KEEP["$CURRENT_DEPLOYMENT"]=1; fi
while IFS= read -r deployment; do
  [ "${#KEEP[@]}" -ge 10 ] && break
  KEEP["$deployment"]=1
done < <(find "$STAGING/v1/deployments" -mindepth 1 -maxdepth 1 -type d -printf '%f\n' | sort -r)
while IFS= read -r deployment; do
  if [ -z "${KEEP[$deployment]+x}" ]; then
    rm -rf -- "$STAGING/v1/deployments/$deployment"
  fi
done < <(find "$STAGING/v1/deployments" -mindepth 1 -maxdepth 1 -type d -printf '%f\n')
[ "$(find "$STAGING/v1/deployments" -mindepth 1 -maxdepth 1 -type d | wc -l)" -le 10 ]

sed "s|__CURRENT_LOCATION__|/$BUNDLE_RELATIVE|" "$NGINX_SOURCE" > "$CONFIG_SOURCE"
grep -Fq "return 302 /$BUNDLE_RELATIVE;" "$CONFIG_SOURCE"

mkdir -m 700 "$TRANSACTION_DIR" "$BACKUP"
rsync -a "$APP_DIR/" "$BACKUP/"
cp -f "$NGINX_CONFIG" "$CONFIG_BACKUP"
printf '%s\n' "$DEPLOY_ID" > "$TRANSACTION_MARKER"
APP_MUTATED=1
rsync -a --delete --delay-updates "$STAGING/" "$APP_DIR/"
chmod 755 "$APP_DIR"
find "$APP_DIR" -type d -exec chmod 755 {} +
find "$APP_DIR" -type f -exec chmod 644 {} +
REMOTE_SHA="$(docker exec "$CONTAINER" sha256sum "/usr/share/nginx/html/$BUNDLE_RELATIVE" | awk '{print $1}')"
[ "$REMOTE_SHA" = "$EXPECTED_SHA" ]
CONFIG_MUTATED=1
write_nginx_config "$CONFIG_SOURCE"

docker exec "$CONTAINER" nginx -t
docker exec "$CONTAINER" nginx -s reload
docker exec "$CONTAINER" nginx -T 2>&1 | grep -Fq "return 302 /$BUNDLE_RELATIVE;"

rm -f -- "$TRANSACTION_MARKER"
PUBLISHED=1
rm -rf -- "$TRANSACTION_DIR"
rm -f /tmp/cvp-last-error.log
echo '>>> CDN remote deploy completed successfully.'
