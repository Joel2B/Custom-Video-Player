#!/usr/bin/env pwsh
param(
  [switch]$SelfTest
)

$ErrorActionPreference = "Stop"
$projectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
. (Join-Path $projectRoot 'deploy/functions.ps1')

if ($SelfTest) {
  Invoke-DeploySelfTest
  exit 0
}

Set-Location $projectRoot
Import-DeployEnvironment (Join-Path $projectRoot '.env')

$remoteHost = $env:DEPLOY_HOST
$remoteUser = $env:DEPLOY_USER
$localKey = $env:DEPLOY_KEY
$archiveName = if ($env:DEPLOY_ARCHIVE_NAME) { $env:DEPLOY_ARCHIVE_NAME } else { 'cdn-dist.zip' }
$distName = if ($env:DEPLOY_DIST_NAME) { $env:DEPLOY_DIST_NAME } else { 'dist.zip' }

if (-not $remoteHost -or -not $remoteUser) {
  throw "Missing DEPLOY_HOST or DEPLOY_USER in .env"
}
if (-not $localKey) {
  $localKey = Join-Path $env:USERPROFILE '.ssh\id_ed25519'
}

Assert-DeployConfiguration $remoteHost $remoteUser $archiveName $distName
if (-not (Test-Path -LiteralPath $localKey -PathType Leaf)) {
  throw "SSH key file not found: $localKey"
}
foreach ($command in @('npm.cmd', 'ssh')) {
  if (-not (Get-Command $command -ErrorAction SilentlyContinue)) {
    throw "Required command not found: $command"
  }
}

$deploymentId = "$(Get-Date -AsUTC -Format 'yyyyMMddTHHmmssZ')-$([Guid]::NewGuid().ToString('N'))"
$sshTarget = "$remoteUser@$remoteHost"
$archivePath = Join-Path $projectRoot $archiveName
$distPath = Join-Path $projectRoot $distName
$localTempDir = Join-Path ([IO.Path]::GetTempPath()) "cvp-deploy-$([Guid]::NewGuid().ToString('N'))"
$packagePath = Join-Path $localTempDir 'package.zip'
$sshOptions = @('-i', $localKey, '-o', 'BatchMode=yes', '-o', 'IdentitiesOnly=yes', '-o', 'StrictHostKeyChecking=yes')
$deployLock = $null

Write-Host ">>> Deploying CDN to $sshTarget"
Write-Host ">>> Using SSH key: $localKey"

try {
  $deployLock = Enter-DeployLock $projectRoot
  [void](New-Item -ItemType Directory -Path $localTempDir)

  Write-Host ">>> Installing locked dependencies..."
  Invoke-NativeCommand 'npm.cmd' @('ci', '--ignore-scripts') 'npm ci --ignore-scripts'

  Write-Host ">>> Running npm run build-cdn..."
  Remove-Item -LiteralPath (Join-Path $projectRoot 'dist-cdn') -Recurse -Force -ErrorAction SilentlyContinue
  $env:DEPLOY_ID = $deploymentId
  try {
    Invoke-NativeCommand 'npm.cmd' @('run', 'build-cdn') 'npm run build-cdn'
  }
  finally {
    Remove-Item Env:DEPLOY_ID -ErrorAction SilentlyContinue
  }
  $cdnHash = New-CdnDeploymentLayout $projectRoot $deploymentId
  Write-Host ">>> Running npm run build-e2e..."
  Invoke-NativeCommand 'npm.cmd' @('run', 'build-e2e') 'npm run build-e2e'

  $cdnDist = Join-Path $projectRoot 'dist-cdn'
  $dist = Join-Path $projectRoot 'dist'
  foreach ($buildDir in @($cdnDist, $dist)) {
    if (-not (Test-Path -LiteralPath $buildDir -PathType Container) -or
        -not (Get-ChildItem -LiteralPath $buildDir -File -Recurse)) {
      throw "Build output directory is missing or empty: $buildDir"
    }
  }

  Remove-Item -LiteralPath $archivePath, $distPath -Force -ErrorAction SilentlyContinue
  Compress-Archive -Path (Join-Path $cdnDist '*') -DestinationPath $archivePath -Force
  Compress-Archive -Path (Join-Path $dist '*') -DestinationPath $distPath -Force
  Assert-ZipArchive $archivePath
  Assert-ZipArchive $distPath

  Copy-Item -LiteralPath $archivePath -Destination (Join-Path $localTempDir 'cdn.zip')
  Copy-Item -LiteralPath $distPath -Destination (Join-Path $localTempDir 'dist.zip')
  Compress-Archive -Path (Join-Path $localTempDir 'cdn.zip'), (Join-Path $localTempDir 'dist.zip') -DestinationPath $packagePath -Force
  Assert-ZipArchive $packagePath

  Write-Host ">>> Sending deployment package..."
  $remoteArguments = $sshOptions + @($sshTarget, 'deploy', $deploymentId, $cdnHash)
  Invoke-NativeCommandWithInput 'ssh' $remoteArguments $packagePath 'remote deploy'
  Write-Host "CDN deploy finished successfully."
}
finally {
  Remove-Item -LiteralPath $archivePath, $distPath -Force -ErrorAction SilentlyContinue
  Remove-Item -LiteralPath $localTempDir -Recurse -Force -ErrorAction SilentlyContinue
  Exit-DeployLock $deployLock
}
