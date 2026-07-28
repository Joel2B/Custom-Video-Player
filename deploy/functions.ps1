function Invoke-NativeCommand {
  param(
    [Parameter(Mandatory)] [string]$Command,
    [Parameter(Mandatory)] [string[]]$Arguments,
    [Parameter(Mandatory)] [string]$Description
  )

  & $Command @Arguments
  if ($LASTEXITCODE -ne 0) {
    throw "$Description failed with exit code $LASTEXITCODE"
  }
}

function Import-DeployEnvironment {
  param([Parameter(Mandatory)] [string]$Path)

  if (-not (Test-Path -LiteralPath $Path)) {
    Write-Warning ">>> .env not found at $Path, using current env vars."
    return
  }

  Write-Host ">>> Loading variables from $Path"
  Get-Content -LiteralPath $Path | ForEach-Object {
    $line = $_.Trim()
    if (-not $line -or $line.StartsWith('#')) { return }

    $parts = $line -split '=', 2
    if ($parts.Count -ne 2) { throw "Invalid .env line: $line" }

    $key = $parts[0].Trim()
    $value = $parts[1].Trim()
    if ($key -notmatch '^[A-Za-z_][A-Za-z0-9_]*$') { throw "Invalid .env variable name: $key" }
    if (($value.StartsWith('"') -and $value.EndsWith('"')) -or
        ($value.StartsWith("'") -and $value.EndsWith("'"))) {
      $value = $value.Substring(1, $value.Length - 2)
    }
    Set-Item -Path "Env:$key" -Value $value
  }
}

function Assert-DeployConfiguration {
  param(
    [Parameter(Mandatory)] [string]$RemoteHost,
    [Parameter(Mandatory)] [string]$RemoteUser,
    [Parameter(Mandatory)] [string]$RemoteDir,
    [Parameter(Mandatory)] [string]$ArchiveName,
    [Parameter(Mandatory)] [string]$DistName
  )

  if ($RemoteHost -notmatch '^[A-Za-z0-9._:-]+$') {
    throw "DEPLOY_HOST contains unsupported characters"
  }
  if ($RemoteUser -notmatch '^[A-Za-z0-9._-]+$') {
    throw "DEPLOY_USER contains unsupported characters"
  }
  if (-not $RemoteDir.StartsWith('/') -or $RemoteDir -eq '/' -or
      $RemoteDir.EndsWith('/') -or $RemoteDir -match '[\r\n\x00]') {
    throw "DEPLOY_DIR must be a non-root absolute Linux path without a trailing slash or control characters"
  }

  foreach ($name in @($ArchiveName, $DistName)) {
    if ($name -notmatch '^[A-Za-z0-9._-]+\.zip$' -or [IO.Path]::GetFileName($name) -ne $name) {
      throw "Archive names must be safe .zip file names"
    }
  }
  if ($ArchiveName -eq $DistName) {
    throw "DEPLOY_ARCHIVE_NAME and DEPLOY_DIST_NAME must differ"
  }
}

function Assert-ZipArchive {
  param([Parameter(Mandatory)] [string]$Path)

  if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) {
    throw "ZIP file was not created: $Path"
  }
  if ((Get-Item -LiteralPath $Path).Length -eq 0) {
    throw "ZIP file is empty: $Path"
  }

  $archive = [IO.Compression.ZipFile]::OpenRead($Path)
  try {
    if ($archive.Entries.Count -eq 0) {
      throw "ZIP file contains no entries: $Path"
    }
    foreach ($entry in $archive.Entries) {
      $entryPath = $entry.FullName.Replace('\', '/')
      if ($entryPath.StartsWith('/') -or $entryPath -match '(^|/)\.\.(/|$)') {
        throw "ZIP file contains an unsafe entry: $entryPath"
      }
    }
  }
  finally {
    $archive.Dispose()
  }
}

function ConvertTo-Base64Utf8 {
  param([Parameter(Mandatory)] [string]$Value)
  [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($Value))
}

function Invoke-DeploySelfTest {
  Assert-DeployConfiguration 'example.com' 'deploy_user' '/srv/player path' 'cdn-dist.zip' 'dist.zip'

  foreach ($invalidDir in @('relative/path', "/srv/player`nrm -rf /")) {
    try {
      Assert-DeployConfiguration 'example.com' 'deploy' $invalidDir 'cdn-dist.zip' 'dist.zip'
      throw "Expected invalid DEPLOY_DIR to fail"
    }
    catch {
      if ($_.Exception.Message -eq 'Expected invalid DEPLOY_DIR to fail') { throw }
    }
  }

  try {
    Assert-DeployConfiguration 'example.com;reboot' 'deploy' '/srv/player' 'cdn-dist.zip' 'dist.zip'
    throw "Expected invalid DEPLOY_HOST to fail"
  }
  catch {
    if ($_.Exception.Message -eq 'Expected invalid DEPLOY_HOST to fail') { throw }
  }

  $value = "/srv/player 'quoted'"
  $roundTrip = [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String((ConvertTo-Base64Utf8 $value)))
  if ($roundTrip -ne $value) { throw "Base64 path round trip failed" }

  $testRoot = Join-Path ([IO.Path]::GetTempPath()) "cvp-deploy-test-$([Guid]::NewGuid().ToString('N'))"
  try {
    $contentPath = Join-Path $testRoot 'content'
    $zipPath = Join-Path $testRoot 'safe.zip'
    [void](New-Item -ItemType Directory -Path $contentPath)
    [IO.File]::WriteAllText((Join-Path $contentPath 'player.min.js'), 'test')
    [IO.Compression.ZipFile]::CreateFromDirectory($contentPath, $zipPath)
    Assert-ZipArchive $zipPath
  }
  finally {
    Remove-Item -LiteralPath $testRoot -Recurse -Force -ErrorAction SilentlyContinue
  }

  Write-Host "Deploy self-test passed."
}
