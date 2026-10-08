#!/usr/bin/env bash
set -euo pipefail
PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
readonly PATH

DOMAIN=''
SSH_SOURCE=''
while [ "$#" -gt 0 ]; do
  case "$1" in
    --domain) [ "$#" -ge 2 ] || exit 2; DOMAIN="$2"; shift 2 ;;
    --ssh-source) [ "$#" -ge 2 ] || exit 2; SSH_SOURCE="$2"; shift 2 ;;
    *) echo 'Usage: verify.sh --domain DOMAIN --ssh-source CIDR' >&2; exit 2 ;;
  esac
done
[ -n "$DOMAIN" ] && [ -n "$SSH_SOURCE" ] || { echo 'Usage: verify.sh --domain DOMAIN --ssh-source CIDR' >&2; exit 2; }
printf '%s' "$SSH_SOURCE" | grep -Eq '^([0-9]{1,3}\.){3}[0-9]{1,3}/(3[0-2]|[12]?[0-9])$' || { echo 'Invalid SSH source CIDR' >&2; exit 2; }
IFS='./' read -r cidr_a cidr_b cidr_c cidr_d cidr_prefix <<< "$SSH_SOURCE"
for octet in "$cidr_a" "$cidr_b" "$cidr_c" "$cidr_d"; do
  [ "$octet" -le 255 ] || { echo 'Invalid SSH source CIDR' >&2; exit 2; }
done
[ "$EUID" -eq 0 ] || { echo 'Must run as root' >&2; exit 1; }
. /etc/os-release
[ "${ID:-}" = ubuntu ] && [ "${VERSION_ID:-}" = 26.04 ] || { echo 'Only Ubuntu 26.04 is supported' >&2; exit 1; }
for service in cloudflared nginx ssh; do systemctl is-active --quiet "$service" || { echo "Inactive service: $service" >&2; exit 1; }; done
for service in cloudflared nginx ssh.socket; do systemctl is-enabled --quiet "$service" || { echo "Disabled service: $service" >&2; exit 1; }; done
systemctl is-active --quiet ssh.socket || { echo 'Inactive service: ssh.socket' >&2; exit 1; }
nginx -t
visudo -cf /etc/sudoers.d/cvp-deploy
passwd -S cvp-deploy | grep -Eq '^cvp-deploy L '
grep -Fq 'restrict,command="/usr/local/libexec/cvp-deploy-entrypoint" ssh-ed25519 ' /home/cvp-deploy/.ssh/authorized_keys
for file in /usr/local/libexec/cvp-deploy-entrypoint /usr/local/libexec/cvp-remote-deploy /usr/local/libexec/cvp-safe-extract.py /usr/local/libexec/cvp-verify-release.py /usr/local/sbin/cvp-nginx-activate; do
  [ -f "$file" ] && [ ! -L "$file" ] && [ "$(stat -c '%U:%G:%a' "$file")" = root:root:755 ] || { echo "Unsafe helper: $file" >&2; exit 1; }
done
[ "$(stat -c '%U:%G:%a' /etc/cvp-deploy/player.conf.template)" = root:root:644 ]
[ "$(stat -c '%U:%G:%a' /etc/cvp-deploy/nginx)" = root:root:755 ]
[ "$(stat -c '%U:%G:%a' /etc/cvp-deploy/nginx/default.conf)" = root:root:644 ]
[ -L /etc/nginx/sites-enabled/player ] && [ "$(readlink /etc/nginx/sites-enabled/player)" = /etc/cvp-deploy/nginx/default.conf ] || { echo 'Unexpected Nginx site link' >&2; exit 1; }
for path in /srv/cvp /srv/cvp/releases /srv/cvp/v1/versions; do
  [ -d "$path" ] && [ ! -L "$path" ] && [ "$(stat -c '%U:%G:%a' "$path")" = root:root:755 ] || { echo "Unsafe release path: $path" >&2; exit 1; }
done
ufw status | grep -Fq 'Status: active'
ufw status verbose | grep -Eq '^Default:[[:space:]]+deny \(incoming\), allow \(outgoing\)'
firewall_rules="$(ufw show added)"
inbound_rules="$(printf '%s\n' "$firewall_rules" | grep -E '^ufw (route )?(allow|limit) ' | grep -Ev '^ufw (route )?(allow|limit) out ' || true)"
[ "$(printf '%s\n' "$inbound_rules" | grep -Ec "^ufw allow from ${SSH_SOURCE//./\\.} to any port 22 proto tcp( comment .*)?$" || true)" -eq 1 ] && [ "$(printf '%s\n' "$inbound_rules" | grep -c . || true)" -eq 1 ] || { echo "UFW must allow only SSH from $SSH_SOURCE" >&2; exit 1; }
nginx_listeners="$(nginx -T 2>&1 | grep -E '^[[:space:]]*listen[[:space:]]+' || true)"
[ -n "$nginx_listeners" ] && [ "$(printf '%s\n' "$nginx_listeners" | grep -Evc '^[[:space:]]*listen[[:space:]]+127\.0\.0\.1:8080([[:space:]]+default_server)?;[[:space:]]*$' || true)" -eq 0 ] || { echo 'Unexpected Nginx listener detected' >&2; exit 1; }
listeners="$(ss -H -ltnp)"
nginx_runtime="$(printf '%s\n' "$listeners" | grep 'users:(("nginx"' || true)"
[ -n "$nginx_runtime" ] && [ "$(printf '%s\n' "$nginx_runtime" | grep -Evc '[[:space:]]127\.0\.0\.1:8080[[:space:]]' || true)" -eq 0 ] || { echo 'Unexpected runtime Nginx listener detected' >&2; exit 1; }
root_status="$(curl --silent --output /dev/null --write-out '%{http_code}' --header "Host: $DOMAIN" http://127.0.0.1:8080/)"
fallback_status="$(curl --silent --output /dev/null --write-out '%{http_code}' --header "Host: $DOMAIN" http://127.0.0.1:8080/this-must-not-exist)"
api_status="$(curl --silent --output /dev/null --write-out '%{http_code}' --header "Host: $DOMAIN" http://127.0.0.1:8080/v1/this-must-not-exist)"
[ "$root_status" = 200 ] && [ "$fallback_status" = 302 ] && [ "$api_status" = 404 ]
public_root_status="$(curl --connect-timeout 10 --max-time 30 --silent --output /dev/null --write-out '%{http_code}' "https://$DOMAIN/")"
public_fallback_status="$(curl --connect-timeout 10 --max-time 30 --silent --output /dev/null --write-out '%{http_code}' "https://$DOMAIN/this-must-not-exist")"
public_api_status="$(curl --connect-timeout 10 --max-time 30 --silent --output /dev/null --write-out '%{http_code}' "https://$DOMAIN/v1/this-must-not-exist")"
[ "$public_root_status" = 200 ] && [ "$public_fallback_status" = 302 ] && [ "$public_api_status" = 404 ] || { echo 'Public Tunnel verification failed' >&2; exit 1; }
[ ! -e /etc/nginx/sites-available/player ] || echo 'Warning: unused /etc/nginx/sites-available/player remains; remove it manually after backup and verification.' >&2
echo 'Server verification passed.'
