#!/usr/bin/env bash
set -euo pipefail

if [ "$#" -ne 1 ]; then
  echo 'Usage: install.sh PUBLIC_KEY_FILE' >&2
  exit 2
fi

SOURCE_DIR="$(dirname "$(realpath "$0")")"
PUBLIC_KEY_FILE="$(realpath -e "$1")"
[ "$EUID" -eq 0 ] || { echo 'Must run as root' >&2; exit 1; }
for command in docker grep install realpath stat useradd visudo; do
  command -v "$command" >/dev/null || { echo "Required command not found: $command" >&2; exit 1; }
done
for file in cvp-deploy-entrypoint cvp-nginx-activate cvp-deploy.sudoers; do
  [ -f "$SOURCE_DIR/$file" ] && [ ! -L "$SOURCE_DIR/$file" ] || { echo "Unsafe source file: $file" >&2; exit 1; }
done
for file in ../remote-deploy.sh ../safe_extract.py ../player.conf; do
  [ -f "$SOURCE_DIR/$file" ] && [ ! -L "$SOURCE_DIR/$file" ] || { echo "Unsafe source file: $file" >&2; exit 1; }
done
[ "$(wc -l < "$PUBLIC_KEY_FILE")" -eq 1 ] || { echo 'Public key must contain exactly one line' >&2; exit 1; }
PUBLIC_KEY="$(cat "$PUBLIC_KEY_FILE")"
printf '%s\n' "$PUBLIC_KEY" | grep -Eq '^ssh-ed25519 [A-Za-z0-9+/]+={0,3}( .*)?$' || { echo 'Invalid Ed25519 public key' >&2; exit 1; }
[ "$(realpath -e /home/j/player)" = '/home/j/player' ] && [ ! -L /home/j/player ] || { echo 'Unsafe player path' >&2; exit 1; }
[ "$(realpath -e /home/j/nginx)" = '/home/j/nginx' ] && [ ! -L /home/j/nginx ] || { echo 'Unsafe Nginx path' >&2; exit 1; }
[ "$(realpath -e /home/j/nginx/player.conf)" = '/home/j/nginx/player.conf' ] && [ ! -L /home/j/nginx/player.conf ] || { echo 'Unsafe Nginx config' >&2; exit 1; }

sudoers_temp="$(mktemp)"
trap 'rm -f -- "$sudoers_temp"' EXIT
cp "$SOURCE_DIR/cvp-deploy.sudoers" "$sudoers_temp"
chmod 440 "$sudoers_temp"
visudo -cf "$sudoers_temp"

id cvp-deploy >/dev/null 2>&1 || useradd --create-home --shell /bin/bash cvp-deploy
passwd -l cvp-deploy >/dev/null

install -d -o root -g root -m 755 /usr/local/libexec /usr/local/sbin /etc/cvp-deploy
install -d -o cvp-deploy -g cvp-deploy -m 700 /var/lib/cvp-deploy
install -o root -g root -m 755 "$SOURCE_DIR/cvp-deploy-entrypoint" /usr/local/libexec/cvp-deploy-entrypoint
install -o root -g root -m 755 "$SOURCE_DIR/../remote-deploy.sh" /usr/local/libexec/cvp-remote-deploy
install -o root -g root -m 755 "$SOURCE_DIR/../safe_extract.py" /usr/local/libexec/cvp-safe-extract.py
install -o root -g root -m 755 "$SOURCE_DIR/cvp-nginx-activate" /usr/local/sbin/cvp-nginx-activate
install -o root -g root -m 644 "$SOURCE_DIR/../player.conf" /etc/cvp-deploy/player.conf.template
install -o root -g root -m 440 "$sudoers_temp" /etc/sudoers.d/cvp-deploy
visudo -cf /etc/sudoers.d/cvp-deploy

chown root:root /home/cvp-deploy
chmod 755 /home/cvp-deploy
install -d -o root -g root -m 755 /home/cvp-deploy/.ssh
{
  printf 'restrict,command="/usr/local/libexec/cvp-deploy-entrypoint" '
  printf '%s\n' "$PUBLIC_KEY"
} > /home/cvp-deploy/.ssh/authorized_keys
chown cvp-deploy:cvp-deploy /home/cvp-deploy/.ssh/authorized_keys
chmod 400 /home/cvp-deploy/.ssh/authorized_keys

chown root:root /home/j/nginx/player.conf
chmod 644 /home/j/nginx/player.conf
chown j:j /home/j/nginx
chmod 775 /home/j/nginx
chown -R cvp-deploy:cvp-deploy /home/j/player
chmod 751 /home/j
chmod 755 /home/j/player
echo 'Restricted deploy user installed.'
