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
  $workflow = [IO.File]::ReadAllText((Join-Path $projectRoot '.github/workflows/check.yml'))
  if ($activate -notmatch "CONFIG_DIR='/etc/cvp-deploy/nginx'" -or $activate -notmatch 'mv -fT' -or $activate -match '/home/j') { throw 'Nginx activation permissions are unsafe' }
  if ($installer -notmatch 'chown root:root /home/cvp-deploy/.ssh/authorized_keys' -or $installer -notmatch 'Install source must be root-owned' -or $installer -notmatch '/srv/cvp/player') { throw 'Restricted SSH installer permissions are unsafe' }
  if ($workflow -match 'actions/(checkout|setup-node)@v' -or $workflow -match '(?m)^\s*- run: npm ci\s*$' -or $workflow -notmatch 'permissions:\s*\r?\n\s+contents: read') { throw 'CI supply-chain controls are missing' }

  $serverTest = @'
apt-get update -qq && apt-get install -y -qq openssh-client sudo >/dev/null
visudo -cf /source/server/cvp-deploy.sudoers
printf '#!/bin/sh\nexit 0\n' > /usr/bin/docker
chmod 755 /usr/bin/docker
cp -R /source /root/deploy
chown -R root:root /root/deploy
chmod -R go-w /root/deploy
ssh-keygen -q -t ed25519 -N '' -f /root/cvp-deploy
bash /root/deploy/server/install.sh /root/cvp-deploy.pub
test "$(stat -c '%U:%G:%a' /home/cvp-deploy/.ssh/authorized_keys)" = 'root:root:444'
runuser -u cvp-deploy -- test -r /home/cvp-deploy/.ssh/authorized_keys
test "$(stat -c '%U:%G:%a' /srv/cvp/player)" = 'cvp-deploy:cvp-deploy:755'
test "$(stat -c '%U:%G:%a' /etc/cvp-deploy/nginx)" = 'root:root:755'
test "$(stat -c '%U:%G:%a' /var/lib/cvp-deploy/deploy.lock)" = 'root:cvp-deploy:660'
cp -R /source /tmp/deploy
if bash /tmp/deploy/server/install.sh /root/cvp-deploy.pub > /tmp/unsafe-source.log 2>&1; then exit 1; fi
grep -q 'Install source must be root-owned' /tmp/unsafe-source.log
'@
  & docker @('run', '--rm', '-v', "${projectRoot}/deploy:/source:ro", 'ubuntu@sha256:4fbb8e6a8395de5a7550b33509421a2bafbc0aab6c06ba2cef9ebffbc7092d90', 'bash', '-c', $serverTest)
  if ($LASTEXITCODE -ne 0) { throw 'Restricted server installation validation failed' }

  [IO.File]::WriteAllText(
    $tempConfig,
    [IO.File]::ReadAllText((Join-Path $projectRoot 'deploy/player.conf')).Replace('__CURRENT_LOCATION__', $location),
    [Text.UTF8Encoding]::new($false)
  )
  & docker @('run', '--rm', '-v', "${tempConfig}:/etc/nginx/conf.d/default.conf:ro", 'nginx@sha256:b3c656d55d7ad751196f21b7fd2e8d4da9cb430e32f646adcf92441b72f82b14', 'nginx', '-t')
  if ($LASTEXITCODE -ne 0) { throw 'Nginx config validation failed' }
}
finally {
  Remove-Item -LiteralPath $tempConfig -Force -ErrorAction SilentlyContinue
}

'Deploy tests passed.'
