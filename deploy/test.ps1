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

  & docker @('run', '--rm', '-v', "${projectRoot}/deploy/server:/server:ro", 'bash@sha256:ae4668c2560999e65e89532cd2ad1b6688bb23298189f0bd229ef80fa4bd0831', 'bash', '-n', '/server/cvp-deploy-entrypoint', '/server/cvp-nginx-activate', '/server/install.sh')
  if ($LASTEXITCODE -ne 0) { throw 'Restricted SSH helper syntax check failed' }

  $activate = [IO.File]::ReadAllText((Join-Path $projectRoot 'deploy/server/cvp-nginx-activate'))
  $installer = [IO.File]::ReadAllText((Join-Path $projectRoot 'deploy/server/install.sh'))
  $workflow = [IO.File]::ReadAllText((Join-Path $projectRoot '.github/workflows/check.yml'))
  if ($activate -notmatch "root:root:755" -or $activate -notmatch "RUN_DIR='/run/cvp-deploy'" -or $activate -match 'mktemp /home/j/nginx') { throw 'Nginx activation permissions are unsafe' }
  if ($installer -notmatch 'chown root:root /home/cvp-deploy/.ssh/authorized_keys' -or $installer -notmatch 'Install source must be root-owned') { throw 'Restricted SSH installer permissions are unsafe' }
  if ($workflow -match 'actions/(checkout|setup-node)@v' -or $workflow -match '(?m)^\s*- run: npm ci\s*$' -or $workflow -notmatch 'permissions:\s*\r?\n\s+contents: read') { throw 'CI supply-chain controls are missing' }

  $serverTest = @'
apt-get update -qq && apt-get install -y -qq sudo >/dev/null
visudo -cf /source/server/cvp-deploy.sudoers
printf '#!/bin/sh\nexit 0\n' > /usr/bin/docker
chmod 755 /usr/bin/docker
cp -R /source /root/deploy
chown -R root:root /root/deploy
chmod -R go-w /root/deploy
printf 'ssh-ed25519 AAAA test\n' > /root/cvp-deploy.pub
mkdir -p /home/j/player /home/j/nginx
touch /home/j/nginx/player.conf
/root/deploy/server/install.sh /root/cvp-deploy.pub
cp -R /source /tmp/deploy
if /tmp/deploy/server/install.sh /root/cvp-deploy.pub > /tmp/unsafe-source.log 2>&1; then exit 1; fi
grep -q 'Install source must be root-owned' /tmp/unsafe-source.log
'@
  & docker @('run', '--rm', '-v', "${projectRoot}/deploy:/source:ro", 'ubuntu@sha256:4fbb8e6a8395de5a7550b33509421a2bafbc0aab6c06ba2cef9ebffbc7092d90', 'bash', '-c', $serverTest)
  if ($LASTEXITCODE -ne 0) { throw 'Restricted server installation validation failed' }

  [IO.File]::WriteAllText(
    $tempConfig,
    [IO.File]::ReadAllText((Join-Path $projectRoot 'deploy/player.conf')).Replace('__CURRENT_LOCATION__', $location),
    [Text.UTF8Encoding]::new($false)
  )
  & docker @('run', '--rm', '-v', "${tempConfig}:/etc/nginx/conf.d/default.conf:ro", 'nginx@sha256:4a73073bd557c65b759505da037898b61f1be6cbcc3c2c3aeac22d2a470c1752', 'nginx', '-t')
  if ($LASTEXITCODE -ne 0) { throw 'Nginx config validation failed' }
}
finally {
  Remove-Item -LiteralPath $tempConfig -Force -ErrorAction SilentlyContinue
}

'Deploy tests passed.'
