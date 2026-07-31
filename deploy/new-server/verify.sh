#!/usr/bin/env bash
set -euo pipefail
PATH=/usr/sbin:/usr/bin:/sbin:/bin
readonly PATH

[ "${1:-}" = --domain ] && [ "$#" -eq 2 ] || { echo 'Usage: verify.sh --domain DOMAIN' >&2; exit 2; }
DOMAIN="$2"
[ "$EUID" -eq 0 ] || { echo 'Must run as root' >&2; exit 1; }
. /etc/os-release
[ "${ID:-}" = ubuntu ] && [ "${VERSION_ID:-}" = 24.04 ]
for service in nginx ssh tailscaled; do systemctl is-active --quiet "$service" || { echo "Inactive service: $service" >&2; exit 1; }; done
tailscale ip -4 | grep -Eq '^100\.'
ip link show tailscale0 >/dev/null
nginx -t
visudo -cf /etc/sudoers.d/cvp-deploy
passwd -S cvp-deploy | grep -Eq '^cvp-deploy L '
grep -Fq 'restrict,command="/usr/local/libexec/cvp-deploy-entrypoint" ssh-ed25519 ' /home/cvp-deploy/.ssh/authorized_keys
for file in /usr/local/libexec/cvp-deploy-entrypoint /usr/local/libexec/cvp-remote-deploy /usr/local/libexec/cvp-safe-extract.py /usr/local/libexec/cvp-verify-release.py /usr/local/sbin/cvp-nginx-activate; do
  [ -f "$file" ] && [ ! -L "$file" ] && [ "$(stat -c '%U:%G:%a' "$file")" = root:root:755 ] || { echo "Unsafe helper: $file" >&2; exit 1; }
done
[ "$(stat -c '%U:%G:%a' /etc/cvp-deploy/tls/origin.key)" = root:root:600 ]
[ "$(stat -c '%U:%G:%a' /etc/nginx/sites-enabled/player.conf)" = root:root:644 ]
for path in /srv/cvp /srv/cvp/releases /srv/cvp/v1/versions; do
  [ -d "$path" ] && [ ! -L "$path" ] && [ "$(stat -c '%U:%G:%a' "$path")" = root:root:755 ] || { echo "Unsafe release path: $path" >&2; exit 1; }
done
ufw status | grep -Fq 'Status: active'
ufw status verbose | grep -Eq '^Default:[[:space:]]+deny \(incoming\), allow \(outgoing\)'
ufw status | grep -Eq '^22/tcp on tailscale0[[:space:]]+ALLOW IN'
ufw status | grep -Eq '80/tcp[[:space:]]+ALLOW IN'
ufw status | grep -Eq '443/tcp[[:space:]]+ALLOW IN'
ssh_rules="$(ufw show added | grep -E 'port 22([[:space:]]|$)|(^|[[:space:]])22/tcp([[:space:]]|$)' || true)"
[ -n "$ssh_rules" ] && [ "$(printf '%s\n' "$ssh_rules" | grep -vc -- 'on tailscale0' || true)" -eq 0 ] || { echo 'Public SSH rule detected' >&2; exit 1; }
unexpected_rules="$(ufw status | grep 'ALLOW IN' | grep -Ev '^(22/tcp( \(v6\))? on tailscale0|80/tcp( \(v6\))?|443/tcp( \(v6\))?)[[:space:]]+ALLOW IN' || true)"
[ -z "$unexpected_rules" ] || { echo "Unexpected inbound UFW rules:\n$unexpected_rules" >&2; exit 1; }
openssl x509 -in /etc/cvp-deploy/tls/origin.pem -noout -checkend 86400 >/dev/null
status="$(curl --insecure --silent --output /dev/null --write-out '%{http_code}' --resolve "$DOMAIN:443:127.0.0.1" "https://$DOMAIN/this-must-not-exist")"
[ "$status" = 404 ]
echo 'Server verification passed.'
