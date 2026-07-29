function Invoke-NativeCommand {
  param(
    [Parameter(Mandatory)] [string]$Command,
    [Parameter(Mandatory)] [string[]]$Arguments,
    [Parameter(Mandatory)] [string]$Description,
    [switch]$IgnoreError
  )

  if ($Command.EndsWith('.cmd', [StringComparison]::OrdinalIgnoreCase)) {
    $process = Start-Process -FilePath $Command -ArgumentList $Arguments -NoNewWindow -Wait -PassThru
    $exitCode = $process.ExitCode
  } else {
    & $Command @Arguments
    $exitCode = $LASTEXITCODE
  }
  if ($exitCode -ne 0) {
    if ($IgnoreError) { return }
    throw "$Description failed with exit code $exitCode"
  }
}

function Invoke-NativeCommandOutput {
  param(
    [Parameter(Mandatory)] [string]$Command,
    [Parameter(Mandatory)] [string[]]$Arguments,
    [Parameter(Mandatory)] [string]$Description
  )

  $output = & $Command @Arguments
  if ($LASTEXITCODE -ne 0) {
    throw "$Description failed with exit code $LASTEXITCODE"
  }
  return ($output -join "`n")
}

function Enter-DeployLock {
  param([Parameter(Mandatory)] [string]$ProjectRoot)
  $lockPath = Join-Path ([IO.Path]::GetFullPath($ProjectRoot)) '.deploy.lock'
  try {
    return [IO.File]::Open($lockPath, [IO.FileMode]::OpenOrCreate, [IO.FileAccess]::ReadWrite, [IO.FileShare]::None)
  }
  catch [IO.IOException] {
    throw 'Another local deploy is already running'
  }
}

function Exit-DeployLock {
  param([IO.FileStream]$Lock)
  if (-not $Lock) { return }
  $path = $Lock.Name
  $Lock.Dispose()
  Remove-Item -LiteralPath $path -Force -ErrorAction SilentlyContinue
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
    [Parameter(Mandatory)] [string]$ArchiveName,
    [Parameter(Mandatory)] [string]$DistName
  )

  if ($RemoteHost -notmatch '^[A-Za-z0-9._:-]+$') {
    throw "DEPLOY_HOST contains unsupported characters"
  }
  if ($RemoteUser -notmatch '^[A-Za-z0-9._-]+$') {
    throw "DEPLOY_USER contains unsupported characters"
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

function New-CdnDeploymentLayout {
  param(
    [Parameter(Mandatory)] [string]$ProjectRoot,
    [Parameter(Mandatory)] [string]$DeploymentId
  )

  if ($DeploymentId -notmatch '^\d{8}T\d{6}Z-[a-f0-9]{32}$') {
    throw "Invalid deployment ID: $DeploymentId"
  }

  $deploymentDir = Join-Path $ProjectRoot "dist-cdn/v1/deployments/$DeploymentId"
  $bundle = Join-Path $deploymentDir 'player.min.js'
  if (-not (Test-Path -LiteralPath $bundle -PathType Leaf)) {
    throw "CDN bundle was not created: $bundle"
  }

  $hash = (Get-FileHash -LiteralPath $bundle -Algorithm SHA256).Hash.ToLowerInvariant()
  $hashDir = Join-Path $deploymentDir "sha256/$hash"
  [void](New-Item -ItemType Directory -Path $hashDir -Force)
  Move-Item -LiteralPath $bundle -Destination (Join-Path $hashDir 'player.min.js')

  $license = Join-Path $deploymentDir 'player.min.js.LICENSE.txt'
  if (Test-Path -LiteralPath $license -PathType Leaf) {
    Move-Item -LiteralPath $license -Destination (Join-Path $hashDir 'player.min.js.LICENSE.txt')
  }

  return $hash
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

function Invoke-DeploySelfTest {
  Assert-DeployConfiguration 'example.com' 'deploy_user' 'cdn-dist.zip' 'dist.zip'

  try {
    Assert-DeployConfiguration 'example.com;reboot' 'deploy' 'cdn-dist.zip' 'dist.zip'
    throw "Expected invalid DEPLOY_HOST to fail"
  }
  catch {
    if ($_.Exception.Message -eq 'Expected invalid DEPLOY_HOST to fail') { throw }
  }

  $testRoot = Join-Path ([IO.Path]::GetTempPath()) "cvp-deploy-test-$([Guid]::NewGuid().ToString('N'))"
  try {
    $contentPath = Join-Path $testRoot 'content'
    $zipPath = Join-Path $testRoot 'safe.zip'
    [void](New-Item -ItemType Directory -Path $contentPath)
    [IO.File]::WriteAllText((Join-Path $contentPath 'player.min.js'), 'test')
    [IO.Compression.ZipFile]::CreateFromDirectory($contentPath, $zipPath)
    Assert-ZipArchive $zipPath

    $deploymentId = '20260729T000321Z-a1b2c3d4a1b2c3d4a1b2c3d4a1b2c3d4'
    $bundleDir = Join-Path $testRoot "dist-cdn/v1/deployments/$deploymentId"
    [void](New-Item -ItemType Directory -Path $bundleDir -Force)
    [IO.File]::WriteAllText((Join-Path $bundleDir 'player.min.js'), 'bundle')
    $hash = New-CdnDeploymentLayout $testRoot $deploymentId
    $publishedBundle = Join-Path $bundleDir "sha256/$hash/player.min.js"
    if ($hash -ne '1e6ed65d77d6364eeaed5a745ba5c4985ae2b700dd85d7cf7f027bdf294a33fc' -or
        -not (Test-Path -LiteralPath $publishedBundle -PathType Leaf)) {
      throw "CDN deployment layout self-test failed"
    }

  }
  finally {
    Remove-Item -LiteralPath $testRoot -Recurse -Force -ErrorAction SilentlyContinue
  }

  Write-Host "Deploy self-test passed."
}
