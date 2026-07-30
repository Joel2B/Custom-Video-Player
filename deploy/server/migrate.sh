#!/usr/bin/env bash
set -euo pipefail
PATH=/usr/sbin:/usr/bin:/sbin:/bin
readonly PATH

if [ "$#" -ne 4 ]; then
  echo 'Usage: migrate.sh PUBLIC_KEY_FILE NPM_IMAGE PLAYER_IMAGE PORTAINER_IMAGE' >&2
  exit 2
fi

[ "$EUID" -eq 0 ] || { echo 'Must run as root' >&2; exit 1; }
SOURCE_DIR="$(dirname "$(realpath "$0")")"
PUBLIC_KEY_FILE="$(realpath -e "$1")"
NPM_IMAGE="$2"
PLAYER_IMAGE="$3"
PORTAINER_IMAGE="$4"
OLD_ROOT='/srv/cvp/player'
OLD_COMPOSE='/home/j/docker-compose.yml'
NEW_COMPOSE='/etc/cvp-deploy/compose.yml'
ENV_FILE='/etc/cvp-deploy/compose.env'
CONFIG='/etc/cvp-deploy/nginx/default.conf'
BACKUP_DIR="$(mktemp -d /root/cvp-release-migration.XXXXXXXXXX)"
ROLLBACK=1

for command in cp docker flock grep install mktemp python3 realpath rsync sed stat tar; do
  command -v "$command" >/dev/null || { echo "Required command not found: $command" >&2; exit 1; }
done
for image in "$NPM_IMAGE" "$PLAYER_IMAGE" "$PORTAINER_IMAGE"; do
  printf '%s' "$image" | grep -Eq '^[a-z0-9][a-z0-9._/-]*@sha256:[a-f0-9]{64}$' || { echo "Invalid image digest: $image" >&2; exit 1; }
done
[ -d "$OLD_ROOT" ] && [ ! -L "$OLD_ROOT" ] && [ "$(realpath -e "$OLD_ROOT")" = "$OLD_ROOT" ] || { echo 'Old player root missing or unsafe' >&2; exit 1; }
[ -f "$OLD_COMPOSE" ] && [ ! -L "$OLD_COMPOSE" ] || { echo 'Old Compose config missing or unsafe' >&2; exit 1; }
[ -f "$CONFIG" ] && [ ! -L "$CONFIG" ] || { echo 'Active Nginx config missing or unsafe' >&2; exit 1; }
docker image inspect "$NPM_IMAGE" "$PLAYER_IMAGE" "$PORTAINER_IMAGE" >/dev/null
docker exec player nginx -t

exec 9<>/var/lib/cvp-deploy/deploy.lock
flock -n 9 || { echo 'Another deploy is running' >&2; exit 1; }
[ ! -e /var/lib/cvp-deploy/state/transaction ] || { echo 'Deploy transaction pending' >&2; exit 1; }

tar -C / -cpf "$BACKUP_DIR/system.tar" etc/cvp-deploy etc/sudoers.d/cvp-deploy home/cvp-deploy/.ssh/authorized_keys var/lib/cvp-deploy usr/local/libexec usr/local/sbin/cvp-nginx-activate
cp -a "$OLD_ROOT" "$BACKUP_DIR/player"
docker inspect player --format '{{json .Config.Labels}}' > "$BACKUP_DIR/player-labels.json"

rollback() {
  local status=$?
  trap - EXIT
  if [ "$ROLLBACK" -eq 1 ]; then
    tar -C / -xpf "$BACKUP_DIR/system.tar" || true
    docker compose -p j -f "$OLD_COMPOSE" up -d --no-build --pull never player || true
    docker exec player nginx -t || true
    echo "Release migration failed. Backup: $BACKUP_DIR" >&2
  fi
  exit "$status"
}
trap rollback EXIT

for path in /srv /srv/cvp; do
  [ -d "$path" ] && [ ! -L "$path" ] && [ "$(realpath -e "$path")" = "$path" ] || { echo "Unsafe release path: $path" >&2; exit 1; }
done
install -d -o root -g root -m 755 /srv/cvp/releases

read -r current current_sha < <(sed -nE 's#.*return 302 /v1/deployments/([0-9]{8}T[0-9]{6}Z-([a-f0-9]{8}|[a-f0-9]{32}))/sha256/([a-f0-9]{64})/.*#\1 \3#p' "$CONFIG")
printf '%s' "$current" | grep -Eq '^[0-9]{8}T[0-9]{6}Z-([a-f0-9]{8}|[a-f0-9]{32})$'

while IFS= read -r deployment; do
  printf '%s' "$deployment" | grep -Eq '^[0-9]{8}T[0-9]{6}Z-([a-f0-9]{8}|[a-f0-9]{32})$' || { echo "Invalid historical deployment: $deployment" >&2; exit 1; }
  release="/srv/cvp/releases/$deployment"
  if [ -e "$release" ]; then
    [ -d "$release" ] && [ ! -L "$release" ] || { echo "Unsafe existing release: $release" >&2; exit 1; }
    python3 "$SOURCE_DIR/../verify_release.py" "$release"
    continue
  fi
  incoming="$(mktemp -d "/srv/cvp/releases/.incoming-$deployment.XXXXXXXXXX")"
  install -d -o root -g root -m 755 "$incoming/v1/deployments"
  cp -a "$OLD_ROOT/v1/deployments/$deployment" "$incoming/v1/deployments/"
  if [ "$deployment" = "$current" ]; then
    rsync -a --exclude 'v1/deployments' "$OLD_ROOT/" "$incoming/"
  fi
  while IFS= read -r bundle; do
    expected="$(basename "$(dirname "$bundle")")"
    printf '%s' "$expected" | grep -Eq '^[a-f0-9]{64}$'
    printf '%s  %s\n' "$expected" "$bundle" | sha256sum -c -
  done < <(find "$incoming" -type f -path '*/sha256/*/player.min.js')
  chown -R root:root "$incoming"
  find "$incoming" -type d -exec chmod 755 {} +
  find "$incoming" -type f -exec chmod 644 {} +
  python3 "$SOURCE_DIR/../verify_release.py" --write "$incoming"
  mv -T "$incoming" "$release"
done < <(find "$OLD_ROOT/v1/deployments" -mindepth 1 -maxdepth 1 -type d -printf '%f\n')

printf '%s  %s\n' "$current_sha" "/srv/cvp/releases/$current/v1/deployments/$current/sha256/$current_sha/player.min.js" | sha256sum -c -
python3 "$SOURCE_DIR/../verify_release.py" "/srv/cvp/releases/$current"

install -o root -g root -m 644 "$SOURCE_DIR/compose.yml" "$NEW_COMPOSE"
{
  printf 'NPM_IMAGE=%s\n' "$NPM_IMAGE"
  printf 'PLAYER_IMAGE=%s\n' "$PLAYER_IMAGE"
  printf 'PORTAINER_IMAGE=%s\n' "$PORTAINER_IMAGE"
} > "$ENV_FILE"
chmod 600 "$ENV_FILE"

docker compose -p j --env-file "$ENV_FILE" -f "$NEW_COMPOSE" config -q
docker compose -p j --env-file "$ENV_FILE" -f "$NEW_COMPOSE" up -d --no-build --pull never player
docker exec player nginx -t

location="$(sed -nE 's#.*return 302 (/v1/deployments/[^;]+);#\1#p' "$CONFIG")"
sed -e "s|__ACTIVE_ROOT__|/srv/cvp/releases/$current|" -e "s|__CURRENT_LOCATION__|$location|" -e "s|__STABLE_LOCATION__|/v1/versions/0.0.0/player.min.js|" "$SOURCE_DIR/../player.conf" > "$CONFIG.tmp"
chown root:root "$CONFIG.tmp"
chmod 644 "$CONFIG.tmp"
mv -fT "$CONFIG.tmp" "$CONFIG"
docker exec player nginx -t
docker exec player nginx -s reload
bash "$SOURCE_DIR/install.sh" "$PUBLIC_KEY_FILE"

ROLLBACK=0
echo "Release migration completed. Backup: $BACKUP_DIR"
