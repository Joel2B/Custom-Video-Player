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
$remoteDir = $env:DEPLOY_DIR
$localKey = $env:DEPLOY_KEY
$archiveName = if ($env:DEPLOY_ARCHIVE_NAME) { $env:DEPLOY_ARCHIVE_NAME } else { 'cdn-dist.zip' }
$distName = if ($env:DEPLOY_DIST_NAME) { $env:DEPLOY_DIST_NAME } else { 'dist.zip' }

if (-not $remoteHost -or -not $remoteUser -or -not $remoteDir) {
  throw "Missing DEPLOY_HOST, DEPLOY_USER or DEPLOY_DIR in .env"
}
if (-not $localKey) {
  $localKey = Join-Path $env:USERPROFILE '.ssh\id_ed25519'
}

Assert-DeployConfiguration $remoteHost $remoteUser $remoteDir $archiveName $distName
if (-not (Test-Path -LiteralPath $localKey -PathType Leaf)) {
  throw "SSH key file not found: $localKey"
}
foreach ($command in @('npm', 'scp', 'ssh')) {
  if (-not (Get-Command $command -ErrorAction SilentlyContinue)) {
    throw "Required command not found: $command"
  }
}

$deploymentId = [Guid]::NewGuid().ToString('N')
$sshTarget = "$remoteUser@$remoteHost"
$scpHost = if ($remoteHost.Contains(':')) { "[$remoteHost]" } else { $remoteHost }
$scpTarget = "$remoteUser@$scpHost"
$archivePath = Join-Path $projectRoot $archiveName
$distPath = Join-Path $projectRoot $distName
$remoteArchivePath = "/tmp/cvp-cdn-$deploymentId.zip"
$remoteDistPath = "/tmp/cvp-dist-$deploymentId.zip"
$remoteScriptPath = "/tmp/cvp-deploy-$deploymentId.sh"
$localScriptPath = Join-Path ([IO.Path]::GetTempPath()) "cvp-deploy-$deploymentId.sh"

Write-Host ">>> Deploying CDN to $sshTarget in $remoteDir"
Write-Host ">>> Using SSH key: $localKey"

try {
  Write-Host ">>> Installing locked dependencies..."
  Invoke-NativeCommand 'npm' @('ci') 'npm ci'

  Write-Host ">>> Running npm run build-cdn..."
  Invoke-NativeCommand 'npm' @('run', 'build-cdn') 'npm run build-cdn'
  Write-Host ">>> Running npm run build-dev..."
  Invoke-NativeCommand 'npm' @('run', 'build-dev') 'npm run build-dev'

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

  Write-Host ">>> Uploading verified archives..."
  Invoke-NativeCommand 'scp' @('-i', $localKey, $archivePath, "${scpTarget}:$remoteArchivePath") 'CDN archive upload'
  Invoke-NativeCommand 'scp' @('-i', $localKey, $distPath, "${scpTarget}:$remoteDistPath") 'dist archive upload'

  $remoteScriptSource = Join-Path $projectRoot 'deploy/remote-deploy.sh'
  $remoteScript = [IO.File]::ReadAllText($remoteScriptSource).Replace("`r`n", "`n")
  [IO.File]::WriteAllText($localScriptPath, $remoteScript, [Text.UTF8Encoding]::new($false))
  Invoke-NativeCommand 'scp' @('-i', $localKey, $localScriptPath, "${scpTarget}:$remoteScriptPath") 'remote script upload'

  $remoteArguments = @(
    '-i', $localKey, '-l', $remoteUser, $remoteHost,
    'bash', $remoteScriptPath, (ConvertTo-Base64Utf8 $remoteDir),
    $remoteArchivePath, $remoteDistPath, $deploymentId
  )
  Invoke-NativeCommand 'ssh' $remoteArguments 'remote deploy'
  Write-Host "CDN deploy finished successfully."
}
finally {
  Remove-Item -LiteralPath $archivePath, $distPath, $localScriptPath -Force -ErrorAction SilentlyContinue
}
