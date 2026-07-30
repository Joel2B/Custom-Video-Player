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
printf changed > "/release/v1/deployments/$deployment/sha256/$hash/player.min.js"
! python /deploy/verify_release.py /release
'@
  & docker @('run', '--rm', '-v', "${projectRoot}/deploy:/deploy:ro", 'python@sha256:399babc8b49529dabfd9c922f2b5eea81d611e4512e3ed250d75bd2e7683f4b0', 'sh', '-c', $manifestTest)
  if ($LASTEXITCODE -ne 0) { throw 'Release manifest tests failed' }

  & docker @('run', '--rm', '-v', "${projectRoot}/deploy/remote-deploy.sh:/deploy.sh:ro", 'bash@sha256:ae4668c2560999e65e89532cd2ad1b6688bb23298189f0bd229ef80fa4bd0831', 'bash', '-n', '/deploy.sh')
  if ($LASTEXITCODE -ne 0) { throw 'Remote deploy syntax check failed' }

  & docker @('run', '--rm', '-v', "${projectRoot}/deploy/server:/server:ro", 'bash@sha256:ae4668c2560999e65e89532cd2ad1b6688bb23298189f0bd229ef80fa4bd0831', 'bash', '-n', '/server/cvp-deploy-entrypoint', '/server/cvp-nginx-activate', '/server/install.sh', '/server/migrate.sh')
  if ($LASTEXITCODE -ne 0) { throw 'Restricted SSH helper syntax check failed' }

  $env:NPM_IMAGE = 'jc21/nginx-proxy-manager@sha256:cd9eba29ca132cb006729f2cb2660126453f84818c2f7d75963ad7b61ef696bd'
  $env:PLAYER_IMAGE = 'nginx@sha256:b3c656d55d7ad751196f21b7fd2e8d4da9cb430e32f646adcf92441b72f82b14'
  $env:PORTAINER_IMAGE = 'portainer/portainer-ce@sha256:3267f1869e0fa87b843c55f7fd848f9e3001367d053505f4cb8c664e4a997996'
  try {
    & docker compose -f (Join-Path $projectRoot 'deploy/server/compose.yml') config -q
    if ($LASTEXITCODE -ne 0) { throw 'Server Compose validation failed' }
  }
  finally {
    Remove-Item Env:NPM_IMAGE, Env:PLAYER_IMAGE, Env:PORTAINER_IMAGE -ErrorAction SilentlyContinue
  }

  $activate = [IO.File]::ReadAllText((Join-Path $projectRoot 'deploy/server/cvp-nginx-activate'))
  $installer = [IO.File]::ReadAllText((Join-Path $projectRoot 'deploy/server/install.sh'))
  $entrypoint = [IO.File]::ReadAllText((Join-Path $projectRoot 'deploy/server/cvp-deploy-entrypoint'))
  $workflow = [IO.File]::ReadAllText((Join-Path $projectRoot '.github/workflows/check.yml'))
  if ($activate -notmatch "CONFIG_DIR='/etc/cvp-deploy/nginx'" -or $activate -notmatch 'mv -fT' -or $activate -match '/home/j') { throw 'Nginx activation permissions are unsafe' }
  if ($activate -notmatch 'MODE.*promote' -or $activate -notmatch 'sha384-' -or $activate -notmatch 'VERSIONS=') { throw 'Stable promotion controls are missing' }
  if ($entrypoint -notmatch 'promote' -or $entrypoint -notmatch '\[a-f0-9\]\{40\}') { throw 'Stable promotion forced command is missing' }
  if ($installer -notmatch 'authorized_keys_temp' -or $installer -notmatch 'Install source must be root-owned' -or $installer -notmatch '/srv/cvp/releases' -or $installer -notmatch '/srv/cvp/v1/versions') { throw 'Restricted SSH installer permissions are unsafe' }
  if ($workflow -match 'actions/(checkout|setup-node)@v' -or $workflow -match '(?m)^\s*- run: npm ci\s*$' -or $workflow -notmatch 'permissions:\s*\r?\n\s+contents: read') { throw 'CI supply-chain controls are missing' }

  $serverTest = @'
set -eu
apt-get update -qq && apt-get install -y -qq openssh-client python3 sudo >/dev/null
visudo -cf /source/server/cvp-deploy.sudoers
cat > /usr/bin/docker <<'DOCKER'
#!/bin/sh
if [ -f /tmp/docker-fail-reload ] && printf '%s\n' "$*" | grep -Fq 'nginx -s reload'; then
  mode=$(cat /tmp/docker-fail-reload)
  if [ "$mode" = once ]; then
    rm -f /tmp/docker-fail-reload
  fi
  exit 1
fi
exit 0
DOCKER
chmod 755 /usr/bin/docker
cp -R /source /root/deploy
chown -R root:root /root/deploy
chmod -R go-w /root/deploy
ssh-keygen -q -t ed25519 -N '' -f /root/cvp-deploy
mkdir -p /etc/cvp-deploy/nginx
printf 'server { listen 80; }\n' > /etc/cvp-deploy/nginx/default.conf
bash /root/deploy/server/install.sh /root/cvp-deploy.pub
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
printf '{"version":"2.0.0","deployment":"%s","commit":"%s","cdn":"https://example.com","sri":"%s"}\n' "$deployment" "$commit" "$sri" > "/srv/cvp/releases/$deployment/release.json"
python3 /root/deploy/verify_release.py --write "/srv/cvp/releases/$deployment"
sed -e "s|__ACTIVE_ROOT__|/srv/cvp/releases/$deployment|" -e "s|__CURRENT_LOCATION__|/v1/deployments/$deployment/sha256/$hash/player.min.js|" -e 's|__STABLE_LOCATION__|/v1/versions/0.0.0/player.min.js|' /root/deploy/player.conf > /etc/cvp-deploy/nginx/default.conf
sudo -u cvp-deploy sudo -n /usr/local/sbin/cvp-nginx-activate promote 2.0.0 "$commit" > /tmp/promote.log
test -f /srv/cvp/v1/versions/2.0.0/player.min.js
test "$(cat /srv/cvp/v1/versions/2.0.0/player.min.js)" = test
grep -Fq '"version": "2.0.0"' /srv/cvp/v1/versions/2.0.0/release.json
grep -Fq 'return 302 /v1/versions/2.0.0/player.min.js;' /etc/cvp-deploy/nginx/default.conf
sed -i 's#/v1/versions/2.0.0/player.min.js#/v1/versions/0.0.0/player.min.js#' /etc/cvp-deploy/nginx/default.conf
sudo -u cvp-deploy sudo -n /usr/local/sbin/cvp-nginx-activate promote 2.0.0 "$commit" > /tmp/promote-retry.log
grep -Fq 'already published' /tmp/promote-retry.log
grep -Fq 'return 302 /v1/versions/2.0.0/player.min.js;' /etc/cvp-deploy/nginx/default.conf
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
printf once > /tmp/docker-fail-reload
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
printf always > /tmp/docker-fail-reload
if sudo -u cvp-deploy sudo -n /usr/local/sbin/cvp-nginx-activate promote 2.0.2 "$commit"; then exit 1; fi
test -f /srv/cvp/v1/versions/2.0.2/player.min.js
grep -Fq 'return 302 /v1/versions/2.0.0/player.min.js;' /etc/cvp-deploy/nginx/default.conf
rm -f /tmp/docker-fail-reload
cp -R /source /tmp/deploy
if bash /tmp/deploy/server/install.sh /root/cvp-deploy.pub > /tmp/unsafe-source.log 2>&1; then exit 1; fi
grep -q 'Install source must be root-owned' /tmp/unsafe-source.log
'@
  & docker @('run', '--rm', '-v', "${projectRoot}/deploy:/source:ro", 'ubuntu@sha256:4fbb8e6a8395de5a7550b33509421a2bafbc0aab6c06ba2cef9ebffbc7092d90', 'bash', '-c', $serverTest)
  if ($LASTEXITCODE -ne 0) { throw 'Restricted server installation validation failed' }

  [IO.File]::WriteAllText(
    $tempConfig,
    [IO.File]::ReadAllText((Join-Path $projectRoot 'deploy/player.conf')).Replace('__ACTIVE_ROOT__', '/usr/share/nginx/html').Replace('__CURRENT_LOCATION__', $location).Replace('__STABLE_LOCATION__', $location),
    [Text.UTF8Encoding]::new($false)
  )
  & docker @('run', '--rm', '-v', "${tempConfig}:/etc/nginx/conf.d/default.conf:ro", 'nginx@sha256:b3c656d55d7ad751196f21b7fd2e8d4da9cb430e32f646adcf92441b72f82b14', 'nginx', '-t')
  if ($LASTEXITCODE -ne 0) { throw 'Nginx config validation failed' }
}
finally {
  Remove-Item -LiteralPath $tempConfig -Force -ErrorAction SilentlyContinue
}

'Deploy tests passed.'
