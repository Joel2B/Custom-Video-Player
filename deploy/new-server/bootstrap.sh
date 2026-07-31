#!/usr/bin/env bash
set -euo pipefail
PATH=/usr/sbin:/usr/bin:/sbin:/bin
readonly PATH

usage() {
  cat >&2 <<'EOF'
Usage: bootstrap.sh --domain DOMAIN --public-key FILE --tls-cert FILE --tls-key FILE [--yes]

Run from a root-owned copy of deploy/new-server on Ubuntu 24.04.
Tailscale must already be installed, connected, and used by the current SSH session.
EOF
  exit 2
}

DOMAIN=''
PUBLIC_KEY_FILE=''
TLS_CERT_FILE=''
TLS_KEY_FILE=''
ASSUME_YES=0
while [ "$#" -gt 0 ]; do
  case "$1" in
    --domain) [ "$#" -ge 2 ] || usage; DOMAIN="$2"; shift 2 ;;
    --public-key) [ "$#" -ge 2 ] || usage; PUBLIC_KEY_FILE="$2"; shift 2 ;;
    --tls-cert) [ "$#" -ge 2 ] || usage; TLS_CERT_FILE="$2"; shift 2 ;;
    --tls-key) [ "$#" -ge 2 ] || usage; TLS_KEY_FILE="$2"; shift 2 ;;
    --yes) ASSUME_YES=1; shift ;;
    *) usage ;;
  esac
done

[ "$EUID" -eq 0 ] || { echo 'Must run as root' >&2; exit 1; }
for command in grep openssl realpath sha256sum ssh-keygen stat systemctl tailscale; do
  command -v "$command" >/dev/null || { echo "Required command missing before bootstrap: $command" >&2; exit 1; }
done
[ -r /etc/os-release ] || { echo '/etc/os-release missing' >&2; exit 1; }
. /etc/os-release
[ "${ID:-}" = ubuntu ] && [ "${VERSION_ID:-}" = 24.04 ] || { echo 'Only Ubuntu 24.04 is supported' >&2; exit 1; }
[ "${#DOMAIN}" -le 253 ] && printf '%s' "$DOMAIN" | grep -Eq '^([A-Za-z0-9]([A-Za-z0-9-]{0,61}[A-Za-z0-9])?\.)+[A-Za-z]{2,63}$' || { echo 'Invalid domain' >&2; exit 1; }

SOURCE_DIR="$(dirname "$(realpath "$0")")"
DEPLOY_DIR="$(realpath "$SOURCE_DIR/..")"
PUBLIC_KEY_FILE="$(realpath -e "$PUBLIC_KEY_FILE")"
TLS_CERT_FILE="$(realpath -e "$TLS_CERT_FILE")"
TLS_KEY_FILE="$(realpath -e "$TLS_KEY_FILE")"

assert_trusted_path() {
  local path
  path="$(realpath -e "$1")"
  while [ "$path" != / ]; do
    [ ! -L "$path" ] && [ "$(stat -c '%U' "$path")" = root ] && [ $((8#$(stat -c '%a' "$path") & 022)) -eq 0 ] || {
      echo "Source must be root-owned and not writable by group or others: $path" >&2
      exit 1
    }
    path="$(dirname "$path")"
  done
}
for path in "$SOURCE_DIR" "$DEPLOY_DIR" "$DEPLOY_DIR/server" "$PUBLIC_KEY_FILE" "$TLS_CERT_FILE" "$TLS_KEY_FILE"; do assert_trusted_path "$path"; done
for file in bootstrap.conf.template player.conf.template cvp-nginx-activate cvp-deploy.sudoers verify.sh; do
  [ -f "$SOURCE_DIR/$file" ] && [ ! -L "$SOURCE_DIR/$file" ] || { echo "Missing setup file: $file" >&2; exit 1; }
done
for file in cvp-deploy-entrypoint remote-deploy.sh safe_extract.py verify_release.py; do
  [ -f "$DEPLOY_DIR/$file" ] && [ ! -L "$DEPLOY_DIR/$file" ] || { echo "Missing deploy file: $file" >&2; exit 1; }
  assert_trusted_path "$DEPLOY_DIR/$file"
done
for file in bootstrap.conf.template player.conf.template cvp-nginx-activate cvp-deploy.sudoers verify.sh; do assert_trusted_path "$SOURCE_DIR/$file"; done

[ "$(wc -l < "$PUBLIC_KEY_FILE")" -eq 1 ] || { echo 'Public key must contain exactly one line' >&2; exit 1; }
PUBLIC_KEY="$(cat "$PUBLIC_KEY_FILE")"
printf '%s\n' "$PUBLIC_KEY" | grep -Eq '^ssh-ed25519 [A-Za-z0-9+/]+={0,3}( .*)?$' || { echo 'Invalid Ed25519 public key' >&2; exit 1; }
ssh-keygen -l -f "$PUBLIC_KEY_FILE" | grep -Fq ED25519 || { echo 'Invalid Ed25519 public key' >&2; exit 1; }
openssl x509 -in "$TLS_CERT_FILE" -noout -checkend 86400 >/dev/null || { echo 'TLS certificate is invalid or expires within 24 hours' >&2; exit 1; }
openssl x509 -in "$TLS_CERT_FILE" -noout -checkhost "$DOMAIN" | grep -Fq 'does match certificate' || { echo 'TLS certificate does not cover domain' >&2; exit 1; }
cert_public="$(openssl x509 -in "$TLS_CERT_FILE" -pubkey -noout | openssl pkey -pubin -outform DER | sha256sum | cut -d' ' -f1)"
key_public="$(openssl pkey -in "$TLS_KEY_FILE" -pubout -outform DER | sha256sum | cut -d' ' -f1)"
[ "$cert_public" = "$key_public" ] || { echo 'TLS certificate and private key do not match' >&2; exit 1; }

systemctl is-active --quiet tailscaled || { echo 'tailscaled is not active' >&2; exit 1; }
TAILSCALE_IP="$(tailscale ip -4 | head -n 1)"
printf '%s' "$TAILSCALE_IP" | grep -Eq '^100\.' || { echo 'Tailscale is not connected' >&2; exit 1; }
read -r CLIENT_IP _ SERVER_IP _ <<< "${SSH_CONNECTION:-}"
[ "$SERVER_IP" = "$TAILSCALE_IP" ] || { echo 'Run bootstrap through the server Tailscale IP' >&2; exit 1; }
tailscale whois "$CLIENT_IP" >/dev/null 2>&1 || { echo 'SSH client is not a verified Tailscale peer' >&2; exit 1; }

cat <<EOF
This installs Nginx and restricted deploy account, replaces UFW rules, and permits:
  TCP 22 only through tailscale0
  TCP 80 and 443 publicly
Domain: $DOMAIN
Tailscale IP: $TAILSCALE_IP
EOF
if [ "$ASSUME_YES" -ne 1 ]; then
  read -r -p 'Type INSTALL to continue: ' answer
  [ "$answer" = INSTALL ] || { echo 'Cancelled'; exit 1; }
fi

export DEBIAN_FRONTEND=noninteractive
apt-get update
apt-get install -y --no-install-recommends nginx openssh-server python3 sudo ufw ca-certificates curl openssl util-linux

sudoers_temp="$(mktemp)"
trap 'rm -f -- "$sudoers_temp"' EXIT
cp "$SOURCE_DIR/cvp-deploy.sudoers" "$sudoers_temp"
chmod 440 "$sudoers_temp"
visudo -cf "$sudoers_temp"

id cvp-deploy >/dev/null 2>&1 || useradd --create-home --shell /bin/bash cvp-deploy
passwd -l cvp-deploy >/dev/null
install -d -o root -g root -m 755 /usr/local/libexec /usr/local/sbin /etc/cvp-deploy /etc/cvp-deploy/tls /srv /srv/cvp /srv/cvp/releases /srv/cvp/v1 /srv/cvp/v1/versions /var/lib/cvp-deploy
install -d -o root -g root -m 700 /var/lib/cvp-deploy/run
install -d -o cvp-deploy -g cvp-deploy -m 700 /var/lib/cvp-deploy/state
[ -e /var/lib/cvp-deploy/deploy.lock ] || install -o root -g cvp-deploy -m 660 /dev/null /var/lib/cvp-deploy/deploy.lock
chown root:cvp-deploy /var/lib/cvp-deploy/deploy.lock
chmod 660 /var/lib/cvp-deploy/deploy.lock

install -o root -g root -m 755 "$DEPLOY_DIR/cvp-deploy-entrypoint" /usr/local/libexec/cvp-deploy-entrypoint
install -o root -g root -m 755 "$DEPLOY_DIR/remote-deploy.sh" /usr/local/libexec/cvp-remote-deploy
install -o root -g root -m 755 "$DEPLOY_DIR/safe_extract.py" /usr/local/libexec/cvp-safe-extract.py
install -o root -g root -m 755 "$DEPLOY_DIR/verify_release.py" /usr/local/libexec/cvp-verify-release.py
install -o root -g root -m 755 "$SOURCE_DIR/cvp-nginx-activate" /usr/local/sbin/cvp-nginx-activate
install -o root -g root -m 440 "$sudoers_temp" /etc/sudoers.d/cvp-deploy
visudo -cf /etc/sudoers.d/cvp-deploy

TLS_CERT='/etc/cvp-deploy/tls/origin.pem'
TLS_KEY='/etc/cvp-deploy/tls/origin.key'
install -o root -g root -m 644 "$TLS_CERT_FILE" "$TLS_CERT"
install -o root -g root -m 600 "$TLS_KEY_FILE" "$TLS_KEY"
sed -e "s|__DOMAIN__|$DOMAIN|g" -e "s|__TLS_CERT__|$TLS_CERT|g" -e "s|__TLS_KEY__|$TLS_KEY|g" "$SOURCE_DIR/player.conf.template" > /etc/cvp-deploy/player.conf.template
chmod 644 /etc/cvp-deploy/player.conf.template

chown root:root /home/cvp-deploy
chmod 755 /home/cvp-deploy
install -d -o root -g root -m 755 /home/cvp-deploy/.ssh
authorized_keys_temp="$(mktemp /home/cvp-deploy/.ssh/.authorized_keys.XXXXXXXXXX)"
printf 'restrict,command="/usr/local/libexec/cvp-deploy-entrypoint" %s\n' "$PUBLIC_KEY" > "$authorized_keys_temp"
chown root:root "$authorized_keys_temp"
chmod 444 "$authorized_keys_temp"
mv -fT "$authorized_keys_temp" /home/cvp-deploy/.ssh/authorized_keys

bootstrap_temp="$(mktemp /etc/nginx/sites-available/.player.conf.XXXXXXXXXX)"
sed -e "s|__DOMAIN__|$DOMAIN|g" -e "s|__TLS_CERT__|$TLS_CERT|g" -e "s|__TLS_KEY__|$TLS_KEY|g" "$SOURCE_DIR/bootstrap.conf.template" > "$bootstrap_temp"
chmod 644 "$bootstrap_temp"
rm -f /etc/nginx/sites-enabled/default
if [ ! -f /etc/nginx/sites-enabled/player.conf ]; then
  install -o root -g root -m 644 "$bootstrap_temp" /etc/nginx/sites-enabled/player.conf
fi
rm -f "$bootstrap_temp"
nginx -t
systemctl enable --now nginx ssh tailscaled
systemctl reload nginx

ufw --force reset
ufw default deny incoming
ufw default allow outgoing
ufw allow in on tailscale0 to any port 22 proto tcp comment 'SSH over Tailscale'
ufw allow 80/tcp comment 'HTTP for Cloudflare'
ufw allow 443/tcp comment 'HTTPS for Cloudflare'
ufw --force enable

"$SOURCE_DIR/verify.sh" --domain "$DOMAIN"
echo 'Server ready. Continue with docs/05-first-deploy.md.'
