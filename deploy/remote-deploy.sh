#!/usr/bin/env bash
set -euo pipefail

EXTRACTOR='/usr/local/libexec/cvp-safe-extract.py'
VERIFY='/usr/local/libexec/cvp-verify-release.py'
PUBLISH='/usr/local/sbin/cvp-nginx-activate'

if [ "$#" -ne 2 ]; then
  echo 'Usage: remote-deploy.sh DEPLOY_ID SHA256' >&2
  exit 2
fi

DEPLOY_ID="$1"
EXPECTED_SHA="$2"
WORK_DIR="$(mktemp -d /tmp/cvp-deploy.XXXXXXXXXX)"
PACKAGE="$WORK_DIR/release.zip"
STAGING="$WORK_DIR/release"

cleanup() {
  local status=$?
  trap - EXIT
  rm -rf -- "$WORK_DIR"
  exit "$status"
}
trap cleanup EXIT

fail() {
  echo "$1" >&2
  return 1
}

umask 077
printf '%s' "$DEPLOY_ID" | grep -Eq '^[0-9]{8}T[0-9]{6}Z-[a-f0-9]{32}$' || fail 'Invalid deployment ID'
printf '%s' "$EXPECTED_SHA" | grep -Eq '^[a-f0-9]{64}$' || fail 'Invalid SHA-256'
for command in flock head python3 sudo timeout; do
  command -v "$command" >/dev/null || fail "Required command not found: $command"
done
[ -f "$EXTRACTOR" ] && [ ! -L "$EXTRACTOR" ] || fail 'Safe extractor missing'
[ -f "$VERIFY" ] && [ ! -L "$VERIFY" ] || fail 'Release verifier missing'
[ -x "$PUBLISH" ] && [ ! -L "$PUBLISH" ] || fail 'Release publisher missing'

timeout --kill-after=5s 120s head -c 134217729 > "$PACKAGE"
[ "$(stat -c %s "$PACKAGE")" -le 134217728 ] || fail 'Deployment package too large'
mkdir -m 700 "$STAGING"
timeout --kill-after=5s 180s python3 "$EXTRACTOR" "$PACKAGE" "$STAGING"
timeout --kill-after=5s 180s python3 "$VERIFY" "$STAGING" "$DEPLOY_ID" "$EXPECTED_SHA"

BUNDLE="v1/deployments/$DEPLOY_ID/sha256/$EXPECTED_SHA/player.min.js"
[ -s "$STAGING/$BUNDLE" ] || fail 'CDN bundle missing from release'
printf '%s  %s\n' "$EXPECTED_SHA" "$STAGING/$BUNDLE" | sha256sum -c -

timeout --kill-after=10s 300s sudo -n "$PUBLISH" publish "$DEPLOY_ID" "$EXPECTED_SHA" "$STAGING"
echo '>>> CDN remote deploy completed successfully.'
