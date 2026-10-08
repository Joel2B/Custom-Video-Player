#!/usr/bin/env bash
set -euo pipefail
PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
readonly PATH

usage() {
  cat >&2 <<'EOF'
Usage: bootstrap.sh --domain DOMAIN --public-key FILE --ssh-source CIDR [--yes]

Run from a root-owned copy of deploy/new-server on Ubuntu 26.04.
Cloudflare Tunnel and restrictive UFW rules must already be configured.
EOF
  exit 2
}

DOMAIN=''
PUBLIC_KEY_FILE=''
SSH_SOURCE=''
ASSUME_YES=0
while [ "$#" -gt 0 ]; do
  case "$1" in
    --domain) [ "$#" -ge 2 ] || usage; DOMAIN="$2"; shift 2 ;;
    --public-key) [ "$#" -ge 2 ] || usage; PUBLIC_KEY_FILE="$2"; shift 2 ;;
    --ssh-source) [ "$#" -ge 2 ] || usage; SSH_SOURCE="$2"; shift 2 ;;
    --yes) ASSUME_YES=1; shift ;;
    *) usage ;;
  esac
done

[ "$EUID" -eq 0 ] || { echo 'Must run as root' >&2; exit 1; }
for command in cloudflared curl grep realpath ss ssh-keygen stat systemctl ufw; do
  command -v "$command" >/dev/null || { echo "Required command missing before bootstrap: $command" >&2; exit 1; }
done
[ -r /etc/os-release ] || { echo '/etc/os-release missing' >&2; exit 1; }
. /etc/os-release
[ "${ID:-}" = ubuntu ] && [ "${VERSION_ID:-}" = 26.04 ] || { echo 'Only Ubuntu 26.04 is supported' >&2; exit 1; }
[ "${#DOMAIN}" -le 253 ] && printf '%s' "$DOMAIN" | grep -Eq '^([A-Za-z0-9]([A-Za-z0-9-]{0,61}[A-Za-z0-9])?\.)+[A-Za-z]{2,63}$' || { echo 'Invalid domain' >&2; exit 1; }
printf '%s' "$SSH_SOURCE" | grep -Eq '^([0-9]{1,3}\.){3}[0-9]{1,3}/(3[0-2]|[12]?[0-9])$' || { echo 'Invalid SSH source CIDR' >&2; exit 1; }
IFS='./' read -r cidr_a cidr_b cidr_c cidr_d cidr_prefix <<< "$SSH_SOURCE"
for octet in "$cidr_a" "$cidr_b" "$cidr_c" "$cidr_d"; do
  [ "$octet" -le 255 ] || { echo 'Invalid SSH source CIDR' >&2; exit 1; }
done

SOURCE_DIR="$(dirname "$(realpath "$0")")"
DEPLOY_DIR="$(realpath "$SOURCE_DIR/..")"
PUBLIC_KEY_FILE="$(realpath -e "$PUBLIC_KEY_FILE")"

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
for path in "$SOURCE_DIR" "$DEPLOY_DIR" "$PUBLIC_KEY_FILE"; do assert_trusted_path "$path"; done
for file in bootstrap.conf.template player.conf.template cvp-nginx-activate cvp-deploy.sudoers verify.sh; do
  [ -f "$SOURCE_DIR/$file" ] && [ ! -L "$SOURCE_DIR/$file" ] || { echo "Missing setup file: $file" >&2; exit 1; }
done
for file in cvp-deploy-entrypoint remote-deploy.sh safe_extract.py verify_release.py; do
  [ -f "$DEPLOY_DIR/$file" ] && [ ! -L "$DEPLOY_DIR/$file" ] || { echo "Missing deploy file: $file" >&2; exit 1; }
  assert_trusted_path "$DEPLOY_DIR/$file"
done
for file in bootstrap.conf.template player.conf.template cvp-nginx-activate cvp-deploy.sudoers verify.sh; do assert_trusted_path "$SOURCE_DIR/$file"; done

for path in /srv /srv/cvp /srv/cvp/releases /srv/cvp/v1 /srv/cvp/v1/versions /etc/cvp-deploy /etc/cvp-deploy/nginx /var/lib/cvp-deploy; do
  if [ -e "$path" ]; then
    [ -d "$path" ] && [ ! -L "$path" ] && [ "$(realpath -e "$path")" = "$path" ] || { echo "Unsafe existing path: $path" >&2; exit 1; }
  fi
done

CONFIG='/etc/cvp-deploy/nginx/default.conf'
SITE_LINK='/etc/nginx/sites-enabled/player'
if [ -e "$SITE_LINK" ] || [ -L "$SITE_LINK" ]; then
  [ -L "$SITE_LINK" ] && [ "$(readlink "$SITE_LINK")" = "$CONFIG" ] || { echo "Unexpected Nginx site target: $SITE_LINK" >&2; exit 1; }
fi
if [ -e "$CONFIG" ]; then
  [ -f "$CONFIG" ] && [ ! -L "$CONFIG" ] && [ "$(stat -c '%U:%G:%a' "$CONFIG")" = root:root:644 ] || { echo "Unsafe active Nginx config: $CONFIG" >&2; exit 1; }
  bootstrap_candidate="$(mktemp)"
  active_candidate="$(mktemp)"
  sed -e "s|__DOMAIN__|$DOMAIN|g" "$SOURCE_DIR/bootstrap.conf.template" > "$bootstrap_candidate"
  if ! cmp -s "$CONFIG" "$bootstrap_candidate"; then
    read_pointer() { grep -F "# $1" "$CONFIG" | sed -nE 's#.*return 302 ([^;]+);.*#\1#p'; }
    active_root="$(sed -nE 's#^[[:space:]]*root (/srv/cvp/releases/[0-9]{8}T[0-9]{6}Z-([a-f0-9]{8}|[a-f0-9]{32}));#\1#p' "$CONFIG")"
    current_location="$(read_pointer cvp-current-player)"
    testing_location="$(read_pointer cvp-testing-player)"
    stable_location="$(read_pointer cvp-stable-player)"
    current_tests="$(read_pointer cvp-current-tests)"
    testing_tests="$(read_pointer cvp-testing-tests)"
    stable_tests="$(read_pointer cvp-stable-tests)"
    [ -n "$active_root" ] && [ -n "$current_location" ] && [ -n "$testing_location" ] && [ -n "$stable_location" ] && [ -n "$current_tests" ] && [ -n "$testing_tests" ] && [ -n "$stable_tests" ] || { rm -f "$bootstrap_candidate" "$active_candidate"; echo 'Existing Nginx config is not recognized' >&2; exit 1; }
    sed -e "s|__DOMAIN__|$DOMAIN|g" \
        -e "s|__ACTIVE_ROOT__|$active_root|" \
        -e "s|__CURRENT_LOCATION__|$current_location|" \
        -e "s|__TESTING_LOCATION__|$testing_location|" \
        -e "s|__STABLE_LOCATION__|$stable_location|" \
        -e "s|__CURRENT_TESTS_LOCATION__|$current_tests|" \
        -e "s|__TESTING_TESTS_LOCATION__|$testing_tests|" \
        -e "s|__STABLE_TESTS_LOCATION__|$stable_tests|" \
        "$SOURCE_DIR/player.conf.template" > "$active_candidate"
    cmp -s "$CONFIG" "$active_candidate" || { rm -f "$bootstrap_candidate" "$active_candidate"; echo 'Existing Nginx config differs from the canonical template' >&2; exit 1; }
  fi
  rm -f "$bootstrap_candidate" "$active_candidate"
fi
for path in /var/lib/cvp-deploy/deploy.lock /etc/cvp-deploy/player.conf.template; do
  [ ! -e "$path" ] || { [ -f "$path" ] && [ ! -L "$path" ]; } || { echo "Unsafe existing file: $path" >&2; exit 1; }
done

[ "$(wc -l < "$PUBLIC_KEY_FILE")" -eq 1 ] || { echo 'Public key must contain exactly one line' >&2; exit 1; }
PUBLIC_KEY="$(cat "$PUBLIC_KEY_FILE")"
printf '%s\n' "$PUBLIC_KEY" | grep -Eq '^ssh-ed25519 [A-Za-z0-9+/]+={0,3}( .*)?$' || { echo 'Invalid Ed25519 public key' >&2; exit 1; }
ssh-keygen -l -f "$PUBLIC_KEY_FILE" | grep -Fq ED25519 || { echo 'Invalid Ed25519 public key' >&2; exit 1; }
systemctl is-active --quiet cloudflared || { echo 'cloudflared is not active' >&2; exit 1; }
systemctl is-enabled --quiet cloudflared || { echo 'cloudflared is not enabled' >&2; exit 1; }
ufw status | grep -Fq 'Status: active' || { echo 'UFW must be configured and active before bootstrap' >&2; exit 1; }
ufw status verbose | grep -Eq '^Default:[[:space:]]+deny \(incoming\), allow \(outgoing\)' || { echo 'UFW must deny incoming traffic by default' >&2; exit 1; }
firewall_rules="$(ufw show added)"
inbound_rules="$(printf '%s\n' "$firewall_rules" | grep -E '^ufw (route )?(allow|limit) ' | grep -Ev '^ufw (route )?(allow|limit) out ' || true)"
[ "$(printf '%s\n' "$inbound_rules" | grep -Ec "^ufw allow from ${SSH_SOURCE//./\\.} to any port 22 proto tcp( comment .*)?$" || true)" -eq 1 ] && [ "$(printf '%s\n' "$inbound_rules" | grep -c . || true)" -eq 1 ] || { echo "UFW must allow only SSH from $SSH_SOURCE" >&2; exit 1; }

cat <<EOF
This installs Nginx and reconciles the restricted deploy account.
It does not change UFW rules or existing releases.
  SSH source: $SSH_SOURCE
  Tunnel origin: http://127.0.0.1:8080
Domain: $DOMAIN
EOF
if [ "$ASSUME_YES" -ne 1 ]; then
  read -r -p 'Type INSTALL to continue: ' answer
  [ "$answer" = INSTALL ] || { echo 'Cancelled'; exit 1; }
fi

export DEBIAN_FRONTEND=noninteractive
apt-get update
apt-get install -y --no-install-recommends nginx openssh-server python3 sudo ufw ca-certificates curl util-linux

sudoers_temp="$(mktemp)"
default_backup=''
bootstrap_temp=''
config_backup=''
template_temp=''
template_backup=''
created_template=0
created_config=0
created_site_link=0
bootstrap_success=0
cleanup_bootstrap() {
  status=$?
  trap - EXIT
  rm -f -- "$sudoers_temp"
  [ -z "$bootstrap_temp" ] || rm -f -- "$bootstrap_temp"
  [ -z "$template_temp" ] || rm -f -- "$template_temp"
  if [ "$bootstrap_success" -eq 0 ]; then
    if [ -n "$template_backup" ]; then
      install -o root -g root -m 644 "$template_backup" /etc/cvp-deploy/player.conf.template
    elif [ "$created_template" -eq 1 ]; then
      rm -f -- /etc/cvp-deploy/player.conf.template
    fi
    if [ -n "$config_backup" ]; then
      install -o root -g root -m 644 "$config_backup" "$CONFIG"
    fi
    [ -z "$default_backup" ] || mv "$default_backup" /etc/nginx/sites-enabled/default
    [ "$created_site_link" -eq 0 ] || rm -f -- "$SITE_LINK"
    [ "$created_config" -eq 0 ] || rm -f -- "$CONFIG"
    nginx -t >/dev/null 2>&1 && systemctl reload nginx >/dev/null 2>&1 || true
  fi
  rm -f -- "$config_backup" "$template_backup"
  [ "$bootstrap_success" -eq 0 ] || { [ -z "$default_backup" ] || rm -f -- "$default_backup"; }
  [ -z "$default_backup" ] || rmdir "$(dirname "$default_backup")" 2>/dev/null || true
  exit "$status"
}
trap cleanup_bootstrap EXIT
cp "$SOURCE_DIR/cvp-deploy.sudoers" "$sudoers_temp"
chmod 440 "$sudoers_temp"
visudo -cf "$sudoers_temp"

id cvp-deploy >/dev/null 2>&1 || useradd --create-home --shell /bin/bash cvp-deploy
passwd -l cvp-deploy >/dev/null
install -d -o root -g root -m 755 /usr/local/libexec /usr/local/sbin /etc/cvp-deploy /etc/cvp-deploy/nginx /srv /srv/cvp /srv/cvp/releases /srv/cvp/v1 /srv/cvp/v1/versions /var/lib/cvp-deploy
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

template_temp="$(mktemp /etc/cvp-deploy/.player.conf.template.XXXXXXXXXX)"
sed -e "s|__DOMAIN__|$DOMAIN|g" "$SOURCE_DIR/player.conf.template" > "$template_temp"
chmod 644 "$template_temp"
chown root:root "$template_temp"
if [ -f /etc/cvp-deploy/player.conf.template ]; then
  template_backup="$(mktemp /var/lib/cvp-deploy/run/player.conf.template.bootstrap.XXXXXXXXXX)"
  cp /etc/cvp-deploy/player.conf.template "$template_backup"
else
  created_template=1
fi
mv -fT "$template_temp" /etc/cvp-deploy/player.conf.template
template_temp=''

chown root:root /home/cvp-deploy
chmod 755 /home/cvp-deploy
install -d -o root -g root -m 755 /home/cvp-deploy/.ssh
authorized_keys_temp="$(mktemp /home/cvp-deploy/.ssh/.authorized_keys.XXXXXXXXXX)"
printf 'restrict,command="/usr/local/libexec/cvp-deploy-entrypoint" %s\n' "$PUBLIC_KEY" > "$authorized_keys_temp"
chown root:root "$authorized_keys_temp"
chmod 444 "$authorized_keys_temp"
mv -fT "$authorized_keys_temp" /home/cvp-deploy/.ssh/authorized_keys

bootstrap_temp="$(mktemp /etc/cvp-deploy/nginx/.default.conf.XXXXXXXXXX)"
sed -e "s|__DOMAIN__|$DOMAIN|g" "$SOURCE_DIR/bootstrap.conf.template" > "$bootstrap_temp"
chmod 644 "$bootstrap_temp"
had_config=0
if [ -f "$CONFIG" ]; then
  had_config=1
  config_backup="$(mktemp /var/lib/cvp-deploy/run/default.conf.bootstrap.XXXXXXXXXX)"
  cp "$CONFIG" "$config_backup"
else
  install -o root -g root -m 644 "$bootstrap_temp" "$CONFIG"
  created_config=1
fi
[ -L "$SITE_LINK" ] || { ln -s "$CONFIG" "$SITE_LINK"; created_site_link=1; }
if [ -e /etc/nginx/sites-enabled/default ] || [ -L /etc/nginx/sites-enabled/default ]; then
  default_backup="$(mktemp -d /etc/nginx/sites-available/.default-site.XXXXXXXXXX)/default"
  mv /etc/nginx/sites-enabled/default "$default_backup"
fi
current_location="$(grep -F '# cvp-current-player' "$CONFIG" | sed -nE 's#.*return 302 (/v1/deployments/([^/]+)/sha256/([a-f0-9]{64})/player\.min\.js);.*#\1 \2 \3#p' | head -n 1 || true)"
systemctl enable nginx
if [ -n "$current_location" ]; then
  rm -f "$bootstrap_temp"
  read -r _ current_deployment current_sha <<< "$current_location"
  /usr/local/sbin/cvp-nginx-activate activate "$current_deployment" "$current_sha"
elif [ "$had_config" -eq 1 ]; then
  install -o root -g root -m 644 "$bootstrap_temp" "$CONFIG"
  if ! nginx -t || ! systemctl reload nginx; then
    install -o root -g root -m 644 "$config_backup" "$CONFIG"
    if [ -n "$default_backup" ]; then
      mv "$default_backup" /etc/nginx/sites-enabled/default
      default_backup=''
    fi
    nginx -t && systemctl reload nginx || echo 'Nginx rollback failed' >&2
    rm -f "$bootstrap_temp"
    exit 1
  fi
  rm -f "$bootstrap_temp"
else
  rm -f "$bootstrap_temp"
  nginx -t
  systemctl start nginx
fi
systemctl enable --now ssh.socket
systemctl start ssh.service

bash "$SOURCE_DIR/verify.sh" --domain "$DOMAIN" --ssh-source "$SSH_SOURCE"
bootstrap_success=1
echo 'Server ready. Continue with docs/05-first-deploy.md.'
