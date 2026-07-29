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
OLD_COMPOSE='/home/j/docker-compose.yml'
NEW_COMPOSE='/etc/cvp-deploy/compose.yml'
ENV_FILE='/etc/cvp-deploy/compose.env'
BACKUP_DIR="/root/cvp-migration-$(date -u +%Y%m%dT%H%M%SZ)"
ROLLBACK=1

for command in cp date docker flock grep install realpath rsync tar; do
  command -v "$command" >/dev/null || { echo "Required command not found: $command" >&2; exit 1; }
done
for image in "$NPM_IMAGE" "$PLAYER_IMAGE" "$PORTAINER_IMAGE"; do
  printf '%s' "$image" | grep -Eq '^[a-z0-9][a-z0-9._/-]*@sha256:[a-f0-9]{64}$' || {
    echo "Image must use repository@sha256 digest: $image" >&2
    exit 1
  }
done
[ -f "$OLD_COMPOSE" ] && [ ! -L "$OLD_COMPOSE" ] || { echo 'Original Compose file missing or unsafe' >&2; exit 1; }
[ -d /home/j/player ] && [ ! -L /home/j/player ] || { echo 'Original player directory missing or unsafe' >&2; exit 1; }
[ -f /home/j/nginx/player.conf ] && [ ! -L /home/j/nginx/player.conf ] || { echo 'Original Nginx config missing or unsafe' >&2; exit 1; }
docker compose version >/dev/null
docker image inspect "$NPM_IMAGE" "$PLAYER_IMAGE" "$PORTAINER_IMAGE" >/dev/null
docker exec player nginx -t

exec 9>/var/lib/cvp-deploy/deploy.lock
flock -n 9 || { echo 'Another deploy is running' >&2; exit 1; }
[ ! -e /var/lib/cvp-deploy/transaction ] || { echo 'Old deploy transaction pending' >&2; exit 1; }
[ ! -e /var/lib/cvp-deploy/state/transaction ] || { echo 'New deploy transaction pending' >&2; exit 1; }

install -d -o root -g root -m 700 "$BACKUP_DIR"
cp -a "$OLD_COMPOSE" /home/j/nginx/player.conf "$BACKUP_DIR/"
tar -C / -cpf "$BACKUP_DIR/deploy-system.tar" \
  home/cvp-deploy/.ssh/authorized_keys \
  usr/local/libexec/cvp-deploy-entrypoint \
  usr/local/libexec/cvp-remote-deploy \
  usr/local/libexec/cvp-safe-extract.py \
  usr/local/sbin/cvp-nginx-activate \
  etc/cvp-deploy \
  etc/sudoers.d/cvp-deploy \
  var/lib/cvp-deploy

rollback() {
  local status=$?
  trap - EXIT
  if [ "$ROLLBACK" -eq 1 ]; then
    tar -C / -xpf "$BACKUP_DIR/deploy-system.tar" || true
    docker compose -p j -f "$OLD_COMPOSE" up -d --no-build --pull never app player || true
    docker exec player nginx -t || true
    echo "Migration failed; previous Compose and deploy helpers restored from $BACKUP_DIR" >&2
  fi
  exit "$status"
}
trap rollback EXIT

install -d -o root -g root -m 755 /srv /srv/cvp /etc/cvp-deploy /etc/cvp-deploy/nginx
install -d -o cvp-deploy -g cvp-deploy -m 755 /srv/cvp/player
rsync -a --delete /home/j/player/ /srv/cvp/player/
install -o root -g root -m 644 /home/j/nginx/player.conf /etc/cvp-deploy/nginx/default.conf
install -o root -g root -m 644 "$SOURCE_DIR/compose.yml" "$NEW_COMPOSE"
{
  printf 'NPM_IMAGE=%s\n' "$NPM_IMAGE"
  printf 'PLAYER_IMAGE=%s\n' "$PLAYER_IMAGE"
  printf 'PORTAINER_IMAGE=%s\n' "$PORTAINER_IMAGE"
} > "$ENV_FILE"
chown root:root "$ENV_FILE"
chmod 600 "$ENV_FILE"

docker compose -p j --env-file "$ENV_FILE" -f "$NEW_COMPOSE" config -q
docker compose -p j --env-file "$ENV_FILE" -f "$NEW_COMPOSE" up -d --no-build --pull never app player
docker exec player nginx -t
bash "$SOURCE_DIR/install.sh" "$PUBLIC_KEY_FILE"

ROLLBACK=0
printf 'Migration completed. Backup: %s\n' "$BACKUP_DIR"
printf 'Compose: %s\n' "$NEW_COMPOSE"
