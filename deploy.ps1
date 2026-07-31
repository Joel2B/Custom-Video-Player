#!/usr/bin/env pwsh
param(
  [switch]$SelfTest
)

$ErrorActionPreference = "Stop"
$projectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
. (Join-Path $projectRoot 'deploy/functions.ps1')

if ($SelfTest) {
  Invoke-DeploySelfTest
  return
}

Set-Location $projectRoot
Import-DeployEnvironment (Join-Path $projectRoot '.env')

$remoteHost = $env:DEPLOY_HOST
$remoteUser = $env:DEPLOY_USER
$localKey = $env:DEPLOY_KEY
$knownHosts = $env:DEPLOY_KNOWN_HOSTS
$archiveName = if ($env:DEPLOY_ARCHIVE_NAME) { $env:DEPLOY_ARCHIVE_NAME } else { 'cdn-dist.zip' }
$distName = if ($env:DEPLOY_DIST_NAME) { $env:DEPLOY_DIST_NAME } else { 'dist.zip' }

if (-not $remoteHost -or -not $remoteUser) {
  throw "Missing DEPLOY_HOST or DEPLOY_USER in .env"
}
Assert-DeployConfiguration $remoteHost $remoteUser $archiveName $distName
Assert-DeployCdn $env:DEPLOY_CDN
if (-not $localKey) {
  throw "Missing DEPLOY_KEY in .env"
}
if (-not $knownHosts) {
  throw "Missing DEPLOY_KNOWN_HOSTS in .env"
}
if (-not (Test-Path -LiteralPath $localKey -PathType Leaf)) {
  throw "SSH key file not found: $localKey"
}
if (-not (Test-Path -LiteralPath $knownHosts -PathType Leaf)) {
  throw "SSH known hosts file not found: $knownHosts"
}
foreach ($command in @('git', 'npm.cmd', 'ssh')) {
  if (-not (Get-Command $command -ErrorAction SilentlyContinue)) {
    throw "Required command not found: $command"
  }
}

$deploymentId = "$(Get-Date -AsUTC -Format 'yyyyMMddTHHmmssZ')-$([Guid]::NewGuid().ToString('N'))"
$sshTarget = "$remoteUser@$remoteHost"
$localTempDir = Join-Path ([IO.Path]::GetTempPath()) "cvp-deploy-$([Guid]::NewGuid().ToString('N'))"
$releaseDir = Join-Path $localTempDir 'release'
$packagePath = Join-Path $localTempDir 'release.zip'
$sshOptions = @(
  '-i', $localKey,
  '-o', 'BatchMode=yes',
  '-o', 'IdentitiesOnly=yes',
  '-o', 'StrictHostKeyChecking=yes',
  '-o', "UserKnownHostsFile=$knownHosts",
  '-o', 'GlobalKnownHostsFile=none',
  '-o', 'ConnectTimeout=15',
  '-o', 'ConnectionAttempts=1',
  '-o', 'ServerAliveInterval=15',
  '-o', 'ServerAliveCountMax=3'
)
$deployLock = $null

Write-Host ">>> Deploying CDN to $sshTarget"
Write-Host ">>> Using dedicated SSH deployment identity"

try {
  $deployLock = Enter-DeployLock $projectRoot
  Assert-CleanGitWorktree $projectRoot
  $commit = (& git -C $projectRoot rev-parse --verify HEAD).Trim()
  if ($LASTEXITCODE -ne 0 -or $commit -notmatch '^[a-f0-9]{40}$') { throw 'Cannot determine Git commit' }
  [void](New-Item -ItemType Directory -Path $localTempDir)

  Write-Host ">>> Installing locked dependencies..."
  Invoke-NativeCommand 'npm.cmd' @('ci', '--ignore-scripts') 'npm ci --ignore-scripts'

  Write-Host ">>> Running npm run build-cdn..."
  Remove-Item -LiteralPath (Join-Path $projectRoot 'dist-cdn') -Recurse -Force -ErrorAction SilentlyContinue
  $env:DEPLOY_ID = $deploymentId
  $env:DEPLOY_COMMIT = $commit
  try {
    Invoke-NativeCommand 'npm.cmd' @('run', 'build-cdn') 'npm run build-cdn'
  }
  finally {
    Remove-Item Env:DEPLOY_ID -ErrorAction SilentlyContinue
    Remove-Item Env:DEPLOY_COMMIT -ErrorAction SilentlyContinue
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
    if (Get-ChildItem -LiteralPath $buildDir -Filter '*.svg' -File -Recurse) {
      throw "Build emitted external SVG assets: $buildDir"
    }
  }

  New-ReleasePackage $projectRoot $releaseDir $deploymentId $commit $env:DEPLOY_CDN
  Compress-Archive -Path (Join-Path $releaseDir '*') -DestinationPath $packagePath -Force
  Assert-ZipArchive $packagePath

  Write-Host ">>> Sending deployment package..."
  $remoteArguments = $sshOptions + @($sshTarget, 'deploy', $deploymentId, $cdnHash)
  Invoke-NativeCommandWithInput 'ssh' $remoteArguments $packagePath 'remote deploy'
  Write-Host "CDN deploy finished successfully."
}
finally {
  Remove-Item -LiteralPath $localTempDir -Recurse -Force -ErrorAction SilentlyContinue
  Exit-DeployLock $deployLock
}
