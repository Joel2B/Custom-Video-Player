#!/usr/bin/env pwsh
param()

$ErrorActionPreference = "Stop"

# ==== 1. Project root & .env ====

$projectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $projectRoot

$envFile = Join-Path $projectRoot ".env"

if (Test-Path $envFile) {
  Write-Host ">>> Loading variables from $envFile"
  Get-Content $envFile | ForEach-Object {
    $line = $_.Trim()
    if ($line -eq "" -or $line.StartsWith("#")) { return }

    $parts = $line -split "=", 2
    if ($parts.Count -ne 2) { return }

    $key = $parts[0].Trim()
    $value = $parts[1].Trim()

    if (
      ($value.StartsWith('"') -and $value.EndsWith('"')) -or
      ($value.StartsWith("'") -and $value.EndsWith("'"))
    ) {
      $value = $value.Substring(1, $value.Length - 2)
    }

    Set-Item -Path "Env:$key" -Value $value
  }
}
else {
  Write-Warning ">>> .env not found at $envFile, using current env vars."
}

# ==== 2. Read DEPLOY_* values from env ====

$remoteHost = $env:DEPLOY_HOST
$remoteUser = $env:DEPLOY_USER
$remoteDir = $env:DEPLOY_DIR
$localKey = $env:DEPLOY_KEY
$archiveName = $env:DEPLOY_ARCHIVE_NAME
$distName = $env:DEPLOY_DIST_NAME

if (-not $archiveName -or $archiveName -eq "") {
  $archiveName = "cdn-dist.zip"
}

if (-not $distName -or $distName -eq "") {
  $distName = "dist.zip"
}

if (-not $remoteHost -or -not $remoteUser -or -not $remoteDir) {
  Write-Error "Missing DEPLOY_HOST, DEPLOY_USER or DEPLOY_DIR in .env"
  exit 1
}

if (-not $localKey -or $localKey -eq "") {
  $localKey = Join-Path $env:USERPROFILE ".ssh\id_ed25519"
}

if (-not (Test-Path $localKey)) {
  Write-Error "SSH key file not found: $localKey"
  exit 1
}

$sshTarget = "$remoteUser@$remoteHost"
$archivePath = Join-Path $projectRoot $archiveName
$remoteArchivePath = "/tmp/$archiveName"
$remoteScriptRemote = "/tmp/deploy-cdn-remote.sh"

$distPath = Join-Path $projectRoot $distName
$remoteDistPath = "/tmp/$distName"

Write-Host ">>> Deploying CDN to $sshTarget in $remoteDir"
Write-Host ">>> Using archive: $archivePath"
Write-Host ">>> Using archive: $distPath"
Write-Host ">>> Using SSH key: $localKey"

# ==== 3. Build CDN (npm run build-cdn) ====

Write-Host ">>> Running npm run build-cdn..."
npm run build-cdn

Write-Host ">>> Running npm run build..."
npm run build-dev

if ($LASTEXITCODE -ne 0) {
  Write-Error "npm run build-cdn failed with exit code $LASTEXITCODE"
  exit 1
}

$cdnDist = Join-Path $projectRoot "dist-cdn"

if (-not (Test-Path $cdnDist)) {
  Write-Error "dist-cdn directory not found at $cdnDist (build-cdn should generate it)"
  exit 1
}

$dist = Join-Path $projectRoot "dist"

if (-not (Test-Path $dist)) {
  Write-Error "dist-cdn directory not found at $dist (build should generate it)"
  exit 1
}

# ==== 4. Create ZIP from dist-cdn contents ====

Write-Host ">>> Creating ZIP from dist-cdn contents..."

if (Test-Path $archivePath) {
  Remove-Item $archivePath -Force
}

if (Test-Path $distPath) {
  Remove-Item $distPath -Force
}

Compress-Archive -Path (Join-Path $cdnDist '*') -DestinationPath $archivePath -Force
Compress-Archive -Path (Join-Path $dist '*') -DestinationPath $distPath -Force

if (-not (Test-Path $archivePath)) {
  Write-Error "ZIP file was not created: $archivePath"
  exit 1
}

if (-not (Test-Path $distPath)) {
  Write-Error "ZIP file was not created: $distPath"
  exit 1
}

Write-Host ">>> ZIP created at $archivePath"
Write-Host ">>> ZIP created at $distPath"

# ==== 5. Upload ZIP via SCP ====

Write-Host ">>> Uploading ZIP to VPS via scp..."
$scpTargetZip = "{0}@{1}:{2}" -f $remoteUser, $remoteHost, $remoteArchivePath
Write-Host ">>> Running: scp -i `"$localKey`" `"$archivePath`" `"$scpTargetZip`""

scp -i "$localKey" "$archivePath" "$scpTargetZip"

$scpTargetZip = "{0}@{1}:{2}" -f $remoteUser, $remoteHost, $remoteDistPath
Write-Host ">>> Running: scp -i `"$localKey`" `"$distPath`" `"$scpTargetZip`""

scp -i "$localKey" "$distPath" "$scpTargetZip"

if ($LASTEXITCODE -ne 0) {
  Write-Error "There was an error uploading the ZIP via scp. Exit code: $LASTEXITCODE"
  exit 1
}

# ==== 6. Build remote bash script (clean & unzip) ====

$remoteScriptTemplate = @'
#!/usr/bin/env bash
set -e

APP_DIR="{{REMOTE_DIR}}"
ARCHIVE="{{REMOTE_ARCHIVE}}"
DIST="{{REMOTE_DIST}}"

echo ">>> Starting CDN remote deploy in $APP_DIR"
mkdir -p "$APP_DIR"

echo ">>> Cleaning CDN directory..."
if [ -d "$APP_DIR" ]; then
  find "$APP_DIR" -mindepth 1 -maxdepth 1 -exec rm -rf {} \;
fi

echo ">>> Extracting archive $ARCHIVE into $APP_DIR..."
unzip -oq "$ARCHIVE" -d "$APP_DIR"
unzip -oq "$DIST" -d "$APP_DIR"

echo ">>> Removing temporary archive $ARCHIVE..."
rm -f "$ARCHIVE"
rm -f "$DIST"

echo ">>> CDN remote deploy completed successfully."
'@

$remoteScript = $remoteScriptTemplate.
Replace("{{REMOTE_DIR}}", $remoteDir).
Replace("{{REMOTE_ARCHIVE}}", $remoteArchivePath).
Replace("{{REMOTE_DIST}}", $remoteDistPath)

$remoteScript = $remoteScript -replace "`r`n", "`n"

$localScriptPath = Join-Path $env:TEMP "deploy-cdn-remote.sh"
Set-Content -Path $localScriptPath -Value $remoteScript -NoNewline -Encoding UTF8NoBOM

Write-Host ">>> Local remote script created at $localScriptPath"

# ==== 7. Upload remote script via SCP ====

$scpTargetScript = "{0}@{1}:{2}" -f $remoteUser, $remoteHost, $remoteScriptRemote

Write-Host ">>> Uploading remote script via scp..."
scp -i "$localKey" "$localScriptPath" "$scpTargetScript"

if ($LASTEXITCODE -ne 0) {
  Write-Error "There was an error uploading the remote script via scp. Exit code: $LASTEXITCODE"
  exit 1
}

Write-Host ">>> Remote script uploaded to $remoteScriptRemote"

# ==== 8. Run remote script via SSH ====

Write-Host ">>> Running remote script via SSH..."
ssh -i "$localKey" "$sshTarget" "bash $remoteScriptRemote"

if ($LASTEXITCODE -ne 0) {
  Write-Error "There was an error running the remote deploy. Exit code: $LASTEXITCODE"
  exit 1
}

if (Test-Path $archivePath) {
  Remove-Item $archivePath -Force
}

if (Test-Path $distPath) {
  Remove-Item $distPath -Force
}

Write-Host "CDN deploy finished successfully."
