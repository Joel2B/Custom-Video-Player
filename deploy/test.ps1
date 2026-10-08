#!/usr/bin/env pwsh
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$deployment = '20260729T000321Z-a1b2c3d4a1b2c3d4a1b2c3d4a1b2c3d4'
$hash = '1e6ed65d77d6364eeaed5a745ba5c4985ae2b700dd85d7cf7f027bdf294a33fc'
$location = "/v1/deployments/$deployment/sha256/$hash/player.min.js"
$tempConfig = Join-Path ([IO.Path]::GetTempPath()) "cvp-nginx-$([Guid]::NewGuid().ToString('N')).conf"

try {
  & (Join-Path $projectRoot 'deploy.ps1') -SelfTest

  & docker @('run', '--rm', '-e', 'PYTHONWARNINGS=ignore', '-v', "${projectRoot}/deploy:/deploy:ro", 'python@sha256:399babc8b49529dabfd9c922f2b5eea81d611e4512e3ed250d75bd2e7683f4b0', 'python', '/deploy/test_safe_extract.py')
  if ($LASTEXITCODE -ne 0) { throw 'Safe extractor tests failed' }

  $manifestTest = @'
set -eu
deployment=20260729T000321Z-a1b2c3d4a1b2c3d4a1b2c3d4a1b2c3d4
hash=9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08
mkdir -p "/release/v1/deployments/$deployment/sha256/$hash"
printf test > "/release/v1/deployments/$deployment/sha256/$hash/player.min.js"
printf '{"version":"2.0.0","deployment":"%s","commit":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa","cdn":"https://example.com","sri":"sha384-AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA"}\n' "$deployment" > /release/release.json
python /deploy/verify_release.py --write /release
python /deploy/verify_release.py /release "$deployment" "$hash"
python - "$deployment" "$hash" <<'PY'
import json, subprocess, sys
path = "/release/release.json"
data = json.load(open(path, encoding="utf-8"))
data.update(channel="testing", dirty=False)
with open(path, "w", encoding="utf-8") as output: json.dump(data, output)
subprocess.run(["python", "/deploy/verify_release.py", "--write", "/release"], check=True)
assert subprocess.run(["python", "/deploy/verify_release.py", "/release", *sys.argv[1:]]).returncode != 0
PY
printf changed > "/release/v1/deployments/$deployment/sha256/$hash/player.min.js"
! python /deploy/verify_release.py /release
'@
  & docker @('run', '--rm', '-v', "${projectRoot}/deploy:/deploy:ro", 'python@sha256:399babc8b49529dabfd9c922f2b5eea81d611e4512e3ed250d75bd2e7683f4b0', 'sh', '-c', $manifestTest)
  if ($LASTEXITCODE -ne 0) { throw 'Release manifest tests failed' }

  & docker @('run', '--rm', '-v', "${projectRoot}/deploy/remote-deploy.sh:/deploy.sh:ro", 'bash@sha256:ae4668c2560999e65e89532cd2ad1b6688bb23298189f0bd229ef80fa4bd0831', 'bash', '-n', '/deploy.sh')
  if ($LASTEXITCODE -ne 0) { throw 'Remote deploy syntax check failed' }

  & docker @('run', '--rm', '-v', "${projectRoot}/deploy:/deploy:ro", 'bash@sha256:ae4668c2560999e65e89532cd2ad1b6688bb23298189f0bd229ef80fa4bd0831', 'bash', '-n', '/deploy/cvp-deploy-entrypoint', '/deploy/new-server/bootstrap.sh', '/deploy/new-server/cvp-nginx-activate', '/deploy/new-server/verify.sh')
  if ($LASTEXITCODE -ne 0) { throw 'Restricted SSH helper syntax check failed' }

  $activate = [IO.File]::ReadAllText((Join-Path $projectRoot 'deploy/new-server/cvp-nginx-activate'))
  $entrypoint = [IO.File]::ReadAllText((Join-Path $projectRoot 'deploy/cvp-deploy-entrypoint'))
  $nginxTemplate = [IO.File]::ReadAllText((Join-Path $projectRoot 'deploy/new-server/player.conf.template'))
  $newServerBootstrap = [IO.File]::ReadAllText((Join-Path $projectRoot 'deploy/new-server/bootstrap.sh'))
  $newServerVerify = [IO.File]::ReadAllText((Join-Path $projectRoot 'deploy/new-server/verify.sh'))
  $workflow = [IO.File]::ReadAllText((Join-Path $projectRoot '.github/workflows/check.yml'))
  if ($activate -notmatch "CONFIG_DIR='/etc/cvp-deploy/nginx'" -or $activate -notmatch 'mv -fT' -or $activate -match '/home/j') { throw 'Nginx activation permissions are unsafe' }
  if ($activate -notmatch 'MODE.*promote' -or $activate -notmatch 'sha384-' -or $activate -notmatch 'VERSIONS=') { throw 'Stable promotion controls are missing' }
  if ($nginxTemplate -notmatch 'location @version_not_found' -or $nginxTemplate -notmatch 'Cache-Control "no-store"') { throw 'Versioned 404 cache protection is missing' }
  if ($nginxTemplate -notmatch 'location = /\s*\{[^}]*return 200' -or $nginxTemplate -notmatch 'Stable release' -or $nginxTemplate -notmatch 'location /v1/\s*\{[^}]*return 404;' -or $nginxTemplate -notmatch 'location /\s*\{[^}]*return 302 /;') { throw 'Test index and fallback routing are missing' }
  if ($nginxTemplate -notmatch '/tests/current/' -or $nginxTemplate -notmatch '/tests/testing/' -or $nginxTemplate -notmatch '/tests/stable/' -or $nginxTemplate -notmatch '/tests/deployments/') { throw 'Deployment test suite routes are missing' }
  if ($entrypoint -notmatch 'promote' -or $entrypoint -notmatch '\[a-f0-9\]\{40\}') { throw 'Stable promotion forced command is missing' }
  if ($entrypoint -notmatch 'deploy-testing' -or $nginxTemplate -notmatch '/v1/testing/player\.min\.js' -or $nginxTemplate -notmatch '__TESTING_LOCATION__') { throw 'Testing channel controls are missing' }
  if ($nginxTemplate -notmatch 'listen 127\.0\.0\.1:8080' -or $nginxTemplate -match 'listen (80|443)|ssl_certificate|__TLS_') { throw 'Tunnel origin must listen only on loopback HTTP' }
  if ($newServerBootstrap -match 'tailscale|ufw --force|(?m)^\s*ufw allow|--tls-' -or $newServerBootstrap -notmatch 'systemctl is-active --quiet cloudflared' -or $newServerBootstrap -notmatch 'systemctl is-enabled --quiet cloudflared' -or $newServerBootstrap -notmatch '--ssh-source' -or $newServerBootstrap -notmatch 'cvp-nginx-activate activate') { throw 'New server bootstrap does not enforce the tunnel and external firewall model' }
  if ($newServerVerify -match 'tailscale|--insecure|https://127\.0\.0\.1' -or $newServerVerify -notmatch '127\.0\.0\.1:8080' -or $newServerVerify -notmatch 'Unexpected runtime Nginx listener detected') { throw 'New server verification does not enforce loopback-only HTTP' }
  if ($newServerBootstrap -notmatch '\(allow\|limit\)' -or $newServerVerify -notmatch '\(allow\|limit\)' -or $newServerBootstrap -notmatch '\(allow\|limit\) out') { throw 'New server firewall validation does not reject extra inbound rules' }
  if ($activate -match 'rm -rf -- "\$RELEASES/\$old"' -or $activate -match 'kept=') { throw 'New server activation may prune existing releases' }
  if ($newServerBootstrap -notmatch "CONFIG='/etc/cvp-deploy/nginx/default\.conf'" -or $newServerBootstrap -notmatch "SITE_LINK='/etc/nginx/sites-enabled/player'" -or $activate -notmatch "CONFIG_DIR='/etc/cvp-deploy/nginx'" -or $newServerVerify -notmatch 'ssh\.socket') { throw 'New server scripts do not match the production VM layout' }
  if ($newServerBootstrap -notmatch 'VERSION_ID:-.*26\.04' -or $newServerVerify -notmatch 'VERSION_ID:-.*26\.04') { throw 'New server scripts do not target Ubuntu 26.04' }
  if ($workflow -match 'actions/(checkout|setup-node)@v' -or $workflow -match '(?m)^\s*- run: npm ci\s*$' -or $workflow -notmatch 'permissions:\s*\r?\n\s+contents: read') { throw 'CI supply-chain controls are missing' }

  $serverTest = @'
set -eu
apt-get update -qq && apt-get install -y -qq openssh-client python3 sudo >/dev/null
visudo -cf /source/new-server/cvp-deploy.sudoers
cat > /usr/sbin/nginx <<'NGINX'
#!/bin/sh
exit 0
NGINX
cat > /usr/bin/systemctl <<'SYSTEMCTL'
#!/bin/sh
if [ -f /tmp/systemctl-fail-reload ] && [ "$1 $2" = 'reload nginx' ]; then
  mode=$(cat /tmp/systemctl-fail-reload)
  if [ "$mode" = once ]; then
    rm -f /tmp/systemctl-fail-reload
  fi
  exit 1
fi
exit 0
SYSTEMCTL
chmod 755 /usr/sbin/nginx /usr/bin/systemctl
cp -R /source /root/deploy
chown -R root:root /root/deploy
chmod -R go-w /root/deploy
ssh-keygen -q -t ed25519 -N '' -f /root/cvp-deploy
mkdir -p /usr/local/libexec /usr/local/sbin /etc/cvp-deploy/nginx
mkdir -p /etc/nginx/sites-enabled /var/lib/cvp-deploy/run /var/lib/cvp-deploy/state /srv/cvp/releases /srv/cvp/v1/versions /home/cvp-deploy/.ssh
printf 'events {}\nhttp {\n    include /etc/nginx/sites-enabled/*;\n}\n' > /etc/nginx/nginx.conf
cp /root/deploy/new-server/player.conf.template /etc/cvp-deploy/player.conf.template
cp /root/deploy/new-server/cvp-nginx-activate /usr/local/sbin/cvp-nginx-activate
cp /root/deploy/cvp-deploy-entrypoint /usr/local/libexec/cvp-deploy-entrypoint
cp /root/deploy/remote-deploy.sh /usr/local/libexec/cvp-remote-deploy
cp /root/deploy/safe_extract.py /usr/local/libexec/cvp-safe-extract.py
cp /root/deploy/verify_release.py /usr/local/libexec/cvp-verify-release.py
cp /root/deploy/new-server/cvp-deploy.sudoers /etc/sudoers.d/cvp-deploy
chmod 755 /usr/local/sbin/cvp-nginx-activate /usr/local/libexec/cvp-*
chmod 440 /etc/sudoers.d/cvp-deploy
id cvp-deploy >/dev/null 2>&1 || useradd --create-home --shell /bin/bash cvp-deploy
passwd -l cvp-deploy >/dev/null
printf 'restrict,command="/usr/local/libexec/cvp-deploy-entrypoint" %s\n' "$(cat /root/cvp-deploy.pub)" > /home/cvp-deploy/.ssh/authorized_keys
chown root:root /home/cvp-deploy /home/cvp-deploy/.ssh /home/cvp-deploy/.ssh/authorized_keys
chmod 755 /home/cvp-deploy /home/cvp-deploy/.ssh
chmod 444 /home/cvp-deploy/.ssh/authorized_keys
chown root:root /etc/cvp-deploy /etc/cvp-deploy/nginx /srv /srv/cvp /srv/cvp/releases /srv/cvp/v1 /srv/cvp/v1/versions /var/lib/cvp-deploy /var/lib/cvp-deploy/run
chmod 755 /etc/cvp-deploy /etc/cvp-deploy/nginx /srv /srv/cvp /srv/cvp/releases /srv/cvp/v1 /srv/cvp/v1/versions /var/lib/cvp-deploy
chmod 700 /var/lib/cvp-deploy/run
chown cvp-deploy:cvp-deploy /var/lib/cvp-deploy/state
chmod 700 /var/lib/cvp-deploy/state
install -o root -g cvp-deploy -m 660 /dev/null /var/lib/cvp-deploy/deploy.lock
visudo -cf /etc/sudoers.d/cvp-deploy
test "$(stat -c '%U:%G:%a' /home/cvp-deploy/.ssh/authorized_keys)" = 'root:root:444'
runuser -u cvp-deploy -- test -r /home/cvp-deploy/.ssh/authorized_keys
test "$(stat -c '%U:%G:%a' /srv/cvp/releases)" = 'root:root:755'
test "$(stat -c '%U:%G:%a' /srv/cvp/v1/versions)" = 'root:root:755'
test "$(stat -c '%U:%G:%a' /etc/cvp-deploy/nginx)" = 'root:root:755'
test "$(stat -c '%U:%G:%a' /var/lib/cvp-deploy/deploy.lock)" = 'root:cvp-deploy:660'
if runuser -u cvp-deploy -- touch /srv/cvp/releases/forbidden; then exit 1; fi
flock /var/lib/cvp-deploy/deploy.lock sleep 2 &
lock_pid=$!
sleep 1
if sudo -u cvp-deploy sudo -n /usr/local/sbin/cvp-nginx-activate activate 20260729T000321Z-a1b2c3d4a1b2c3d4a1b2c3d4a1b2c3d4 1e6ed65d77d6364eeaed5a745ba5c4985ae2b700dd85d7cf7f027bdf294a33fc; then exit 1; fi
wait "$lock_pid"
deployment=20260729T000321Z-a1b2c3d4a1b2c3d4a1b2c3d4a1b2c3d4
commit=aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa
hash=9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08
bundle=/srv/cvp/releases/$deployment/v1/deployments/$deployment/sha256/$hash/player.min.js
mkdir -p "$(dirname "$bundle")"
printf test > "$bundle"
sri=$(python3 - "$bundle" <<'PY'
import base64, hashlib, sys
print("sha384-" + base64.b64encode(hashlib.sha384(open(sys.argv[1], "rb").read()).digest()).decode("ascii"))
PY
)
printf '{"version":"2.0.0","deployment":"%s","commit":"%s","cdn":"https://example.com","sri":"%s","channel":"current","dirty":false}\n' "$deployment" "$commit" "$sri" > "/srv/cvp/releases/$deployment/release.json"
python3 /root/deploy/verify_release.py --write "/srv/cvp/releases/$deployment"
sed -e "s|__ACTIVE_ROOT__|/srv/cvp/releases/$deployment|" -e "s|__CURRENT_LOCATION__|/v1/deployments/$deployment/sha256/$hash/player.min.js|" -e "s|__TESTING_LOCATION__|/v1/deployments/$deployment/sha256/$hash/player.min.js|" -e 's|__STABLE_LOCATION__|/v1/versions/0.0.0/player.min.js|' -e "s|__CURRENT_TESTS_LOCATION__|/tests/deployments/$deployment/|" -e "s|__TESTING_TESTS_LOCATION__|/tests/deployments/$deployment/|" -e "s|__STABLE_TESTS_LOCATION__|/tests/deployments/$deployment/|" /root/deploy/new-server/player.conf.template > /etc/cvp-deploy/nginx/default.conf
ln -s /etc/cvp-deploy/nginx/default.conf /etc/nginx/sites-enabled/player

# Testing publication changes only its mutable pointer.
testing_deployment=20260729T000322Z-b1b2c3d4b1b2c3d4b1b2c3d4b1b2c3d4
testing_source=/tmp/cvp-deploy.ABCDEFGHIJ/release
testing_bundle="$testing_source/v1/deployments/$testing_deployment/sha256/$hash/player.min.js"
mkdir -p "$(dirname "$testing_bundle")"
printf test > "$testing_bundle"
printf '{"version":"2.0.0","deployment":"%s","commit":"%s","cdn":"https://example.com","sri":"%s","channel":"testing","dirty":true}\n' "$testing_deployment" "$commit" "$sri" > "$testing_source/release.json"
python3 /root/deploy/verify_release.py --write "$testing_source"
sudo -u cvp-deploy sudo -n /usr/local/sbin/cvp-nginx-activate publish-testing "$testing_deployment" "$hash" "$testing_source"
grep -Fq "root /srv/cvp/releases/$deployment;" /etc/cvp-deploy/nginx/default.conf
test "$(grep -Fc "return 302 /v1/deployments/$deployment/sha256/$hash/player.min.js;" /etc/cvp-deploy/nginx/default.conf)" -eq 1
grep -Fq "return 302 /v1/deployments/$testing_deployment/sha256/$hash/player.min.js;" /etc/cvp-deploy/nginx/default.conf
grep -Fq "return 302 /tests/deployments/$testing_deployment/;" /etc/cvp-deploy/nginx/default.conf
test "$(grep -Fc "return 302 /tests/deployments/$deployment/;" /etc/cvp-deploy/nginx/default.conf)" -eq 2

sudo -u cvp-deploy sudo -n /usr/local/sbin/cvp-nginx-activate promote 2.0.0 "$commit" > /tmp/promote.log
test -f /srv/cvp/v1/versions/2.0.0/player.min.js
test "$(stat -c '%U:%G:%a' /srv/cvp/v1/versions/2.0.0)" = 'root:root:755'
test "$(cat /srv/cvp/v1/versions/2.0.0/player.min.js)" = test
grep -Fq '"version": "2.0.0"' /srv/cvp/v1/versions/2.0.0/release.json
grep -Fq 'return 302 /v1/versions/2.0.0/player.min.js;' /etc/cvp-deploy/nginx/default.conf
grep -Fq "return 302 /tests/deployments/$deployment/;" /etc/cvp-deploy/nginx/default.conf
test "$(grep -Fc "return 302 /tests/deployments/$deployment/;" /etc/cvp-deploy/nginx/default.conf)" -eq 2
grep -Fq "return 302 /tests/deployments/$testing_deployment/;" /etc/cvp-deploy/nginx/default.conf
sed -i 's#/v1/versions/2.0.0/player.min.js#/v1/versions/0.0.0/player.min.js#' /etc/cvp-deploy/nginx/default.conf
sed -i "/cvp-stable-tests/s#$deployment#$testing_deployment#" /etc/cvp-deploy/nginx/default.conf
sudo -u cvp-deploy sudo -n /usr/local/sbin/cvp-nginx-activate promote 2.0.0 "$commit" > /tmp/promote-retry.log
grep -Fq 'already published' /tmp/promote-retry.log
grep -Fq 'return 302 /v1/versions/2.0.0/player.min.js;' /etc/cvp-deploy/nginx/default.conf
test "$(grep -Fc "return 302 /tests/deployments/$deployment/;" /etc/cvp-deploy/nginx/default.conf)" -eq 2
grep -Fq "return 302 /tests/deployments/$testing_deployment/; # cvp-testing-tests" /etc/cvp-deploy/nginx/default.conf
if sudo -u cvp-deploy sudo -n /usr/local/sbin/cvp-nginx-activate promote 2.0.0 bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb; then exit 1; fi

# A failed new reload with a successful rollback must remove the unpublished version.
python3 - "/srv/cvp/releases/$deployment/release.json" <<'PY'
import json, sys
path = sys.argv[1]
data = json.load(open(path, encoding="utf-8"))
data["version"] = "2.0.1"
with open(path, "w", encoding="utf-8", newline="\n") as output:
    json.dump(data, output)
    output.write("\n")
PY
python3 /root/deploy/verify_release.py --write "/srv/cvp/releases/$deployment"
printf once > /tmp/systemctl-fail-reload
if sudo -u cvp-deploy sudo -n /usr/local/sbin/cvp-nginx-activate promote 2.0.1 "$commit"; then exit 1; fi
test ! -e /srv/cvp/v1/versions/2.0.1
grep -Fq 'return 302 /v1/versions/2.0.0/player.min.js;' /etc/cvp-deploy/nginx/default.conf

# If both the new reload and rollback reload fail, retain bytes for manual recovery.
python3 - "/srv/cvp/releases/$deployment/release.json" <<'PY'
import json, sys
path = sys.argv[1]
data = json.load(open(path, encoding="utf-8"))
data["version"] = "2.0.2"
with open(path, "w", encoding="utf-8", newline="\n") as output:
    json.dump(data, output)
    output.write("\n")
PY
python3 /root/deploy/verify_release.py --write "/srv/cvp/releases/$deployment"
printf always > /tmp/systemctl-fail-reload
if sudo -u cvp-deploy sudo -n /usr/local/sbin/cvp-nginx-activate promote 2.0.2 "$commit"; then exit 1; fi
test -f /srv/cvp/v1/versions/2.0.2/player.min.js
grep -Fq 'return 302 /v1/versions/2.0.0/player.min.js;' /etc/cvp-deploy/nginx/default.conf
rm -f /tmp/systemctl-fail-reload
'@
  & docker @('run', '--rm', '-v', "${projectRoot}/deploy:/source:ro", 'ubuntu@sha256:4fbb8e6a8395de5a7550b33509421a2bafbc0aab6c06ba2cef9ebffbc7092d90', 'bash', '-c', $serverTest)
  if ($LASTEXITCODE -ne 0) { throw 'Restricted server installation validation failed' }

  [IO.File]::WriteAllText(
    $tempConfig,
    $nginxTemplate.Replace('__DOMAIN__', 'player.example.com').Replace('__ACTIVE_ROOT__', '/usr/share/nginx/html').Replace('__CURRENT_LOCATION__', $location).Replace('__TESTING_LOCATION__', $location).Replace('__STABLE_LOCATION__', $location).Replace('__CURRENT_TESTS_LOCATION__', "/tests/deployments/$deployment/").Replace('__TESTING_TESTS_LOCATION__', "/tests/deployments/$deployment/").Replace('__STABLE_TESTS_LOCATION__', "/tests/deployments/$deployment/"),
    [Text.UTF8Encoding]::new($false)
  )
  & docker @('run', '--rm', '-v', "${tempConfig}:/etc/nginx/conf.d/default.conf:ro", 'nginx@sha256:b3c656d55d7ad751196f21b7fd2e8d4da9cb430e32f646adcf92441b72f82b14', 'nginx', '-t')
  if ($LASTEXITCODE -ne 0) { throw 'Tunnel Nginx config validation failed' }
}
finally {
  Remove-Item -LiteralPath $tempConfig -Force -ErrorAction SilentlyContinue
}

'Deploy tests passed.'
