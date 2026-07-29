#!/usr/bin/env pwsh
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$deployment = '20260729T000321Z-a1b2c3d4a1b2c3d4a1b2c3d4a1b2c3d4'
$hash = '1e6ed65d77d6364eeaed5a745ba5c4985ae2b700dd85d7cf7f027bdf294a33fc'
$location = "/v1/deployments/$deployment/sha256/$hash/player.min.js"
$tempConfig = Join-Path ([IO.Path]::GetTempPath()) "cvp-nginx-$([Guid]::NewGuid().ToString('N')).conf"

try {
  & (Join-Path $projectRoot 'deploy.ps1') -SelfTest
  if ($LASTEXITCODE -ne 0) { throw 'PowerShell deploy self-test failed' }

  docker run --rm -v "${projectRoot}/deploy:/deploy:ro" python:3.13-alpine python /deploy/test_safe_extract.py
  if ($LASTEXITCODE -ne 0) { throw 'Safe extractor tests failed' }

  docker run --rm -v "${projectRoot}/deploy/remote-deploy.sh:/deploy.sh:ro" bash:latest bash -n /deploy.sh
  if ($LASTEXITCODE -ne 0) { throw 'Remote deploy syntax check failed' }

  docker run --rm -v "${projectRoot}/deploy/server:/server:ro" bash:latest bash -n /server/cvp-deploy-entrypoint /server/cvp-nginx-activate /server/install.sh
  if ($LASTEXITCODE -ne 0) { throw 'Restricted SSH helper syntax check failed' }

  docker run --rm -v "${projectRoot}/deploy/server/cvp-deploy.sudoers:/etc/sudoers.d/cvp-deploy:ro" ubuntu:24.04 sh -c 'apt-get update -qq && apt-get install -y -qq sudo >/dev/null && visudo -cf /etc/sudoers.d/cvp-deploy'
  if ($LASTEXITCODE -ne 0) { throw 'Restricted sudoers validation failed' }

  [IO.File]::WriteAllText(
    $tempConfig,
    [IO.File]::ReadAllText((Join-Path $projectRoot 'deploy/player.conf')).Replace('__CURRENT_LOCATION__', $location),
    [Text.UTF8Encoding]::new($false)
  )
  docker run --rm -v "${tempConfig}:/etc/nginx/conf.d/default.conf:ro" nginx:alpine nginx -t
  if ($LASTEXITCODE -ne 0) { throw 'Nginx config validation failed' }
}
finally {
  Remove-Item -LiteralPath $tempConfig -Force -ErrorAction SilentlyContinue
}

'Deploy tests passed.'
