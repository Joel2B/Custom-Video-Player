function Invoke-NativeCommand {
  param(
    [Parameter(Mandatory)] [string]$Command,
    [Parameter(Mandatory)] [string[]]$Arguments,
    [Parameter(Mandatory)] [string]$Description,
    [switch]$IgnoreError
  )

  & $Command @Arguments
  $exitCode = $LASTEXITCODE
  if ($exitCode -ne 0) {
    if ($IgnoreError) { return }
    throw "$Description failed with exit code $exitCode"
  }
}

function Invoke-NativeCommandWithInput {
  param(
    [Parameter(Mandatory)] [string]$Command,
    [Parameter(Mandatory)] [string[]]$Arguments,
    [Parameter(Mandatory)] [string]$InputPath,
    [Parameter(Mandatory)] [string]$Description
  )

  $startInfo = [Diagnostics.ProcessStartInfo]::new()
  $startInfo.FileName = $Command
  $startInfo.UseShellExecute = $false
  $startInfo.RedirectStandardInput = $true
  foreach ($argument in $Arguments) { [void]$startInfo.ArgumentList.Add($argument) }

  $process = [Diagnostics.Process]::Start($startInfo)
  $streamError = $null
  try {
    $input = [IO.File]::OpenRead($InputPath)
    try {
      $input.CopyToAsync($process.StandardInput.BaseStream).WaitAsync([TimeSpan]::FromMinutes(10)).GetAwaiter().GetResult()
    }
    catch {
      $streamError = $_
    }
    finally {
      $input.Dispose()
      $process.StandardInput.Close()
    }
    $process.WaitForExitAsync().WaitAsync([TimeSpan]::FromMinutes(10)).GetAwaiter().GetResult()
    if ($streamError) { throw $streamError }
    if ($process.ExitCode -ne 0) {
      throw "$Description failed with exit code $($process.ExitCode)"
    }
  }
  finally {
    if (-not $process.HasExited) {
      $process.Kill($true)
      $process.WaitForExit()
    }
    $process.Dispose()
  }
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
  $Lock.Dispose()
}

function Import-DeployEnvironment {
  param([Parameter(Mandatory)] [string]$Path)

  $allowed = @(
    'DEPLOY_ARCHIVE_NAME',
    'DEPLOY_CDN',
    'DEPLOY_DIST_NAME',
    'DEPLOY_HOST',
    'DEPLOY_KEY',
    'DEPLOY_KNOWN_HOSTS',
    'DEPLOY_USER'
  )

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
    if ($key -notin $allowed) { throw "Unsupported .env variable: $key" }
    if (($value.StartsWith('"') -and $value.EndsWith('"')) -or
        ($value.StartsWith("'") -and $value.EndsWith("'"))) {
      $value = $value.Substring(1, $value.Length - 2)
    }
    Set-Item -Path "Env:$key" -Value $value
  }
}

function Assert-CleanGitWorktree {
  param([Parameter(Mandatory)] [string]$ProjectRoot)

  Invoke-NativeCommand 'git' @('-C', $ProjectRoot, 'diff', '--quiet') 'Git worktree check'
  Invoke-NativeCommand 'git' @('-C', $ProjectRoot, 'diff', '--cached', '--quiet') 'Git index check'
  $untracked = & git -C $ProjectRoot ls-files --others --exclude-standard
  if ($LASTEXITCODE -ne 0) { throw 'Git untracked file check failed' }
  if ($untracked) { throw 'Untracked files present; commit or remove them before deploy' }
}

function Assert-DeployConfiguration {
  param(
    [Parameter(Mandatory)] [string]$RemoteHost,
    [Parameter(Mandatory)] [string]$RemoteUser,
    [Parameter(Mandatory)] [string]$ArchiveName,
    [Parameter(Mandatory)] [string]$DistName
  )

  if ($RemoteHost -notmatch '^[A-Za-z0-9][A-Za-z0-9.-]*$') {
    throw "DEPLOY_HOST contains unsupported characters"
  }
  if ($RemoteUser -notmatch '^[A-Za-z0-9][A-Za-z0-9._-]*$') {
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

function Assert-DeployCdn {
  param([Parameter(Mandatory)] [string]$Value)

  $uri = $null
  if (-not [Uri]::TryCreate($Value, [UriKind]::Absolute, [ref]$uri) -or
      $uri.Scheme -ne 'https' -or
      -not $uri.Host -or
      $uri.UserInfo -or
      $uri.Query -or
      $uri.Fragment -or
      $uri.AbsolutePath -ne '/') {
    throw 'DEPLOY_CDN must be an HTTPS origin without credentials, path, query, or fragment'
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

function New-ReleasePackage {
  param(
    [Parameter(Mandatory)] [string]$ProjectRoot,
    [Parameter(Mandatory)] [string]$ReleaseDir,
    [Parameter(Mandatory)] [string]$DeploymentId,
    [Parameter(Mandatory)] [string]$Commit,
    [Parameter(Mandatory)] [string]$Cdn
  )

  [void](New-Item -ItemType Directory -Path $ReleaseDir)
  Copy-Item -Path (Join-Path $ProjectRoot 'dist/*') -Destination $ReleaseDir -Recurse
  Copy-Item -Path (Join-Path $ProjectRoot 'dist-cdn/*') -Destination $ReleaseDir -Recurse -Force

  $package = Get-Content -LiteralPath (Join-Path $ProjectRoot 'package.json') -Raw | ConvertFrom-Json
  if ($package.version -notmatch '^\d+\.\d+\.\d+$') {
    throw "Package version must be strict SemVer: $($package.version)"
  }
  $bundleRoot = Join-Path $ReleaseDir "v1/deployments/$DeploymentId/sha256"
  $bundles = @(Get-ChildItem -LiteralPath $bundleRoot -Filter 'player.min.js' -File -Recurse)
  if ($bundles.Count -ne 1) {
    throw "Release must contain exactly one CDN bundle: $bundleRoot"
  }
  $sha384 = (Get-FileHash -LiteralPath $bundles[0].FullName -Algorithm SHA384).Hash
  $sri = 'sha384-' + [Convert]::ToBase64String([Convert]::FromHexString($sha384))
  $metadata = [ordered]@{
    version = $package.version
    deployment = $DeploymentId
    commit = $Commit
    cdn = $Cdn
    sri = $sri
  } | ConvertTo-Json
  [IO.File]::WriteAllText(
    (Join-Path $ReleaseDir 'release.json'),
    "$metadata`n",
    [Text.UTF8Encoding]::new($false)
  )

  $manifest = Get-ChildItem -LiteralPath $ReleaseDir -File -Recurse |
    Sort-Object FullName |
    ForEach-Object {
      $relative = [IO.Path]::GetRelativePath($ReleaseDir, $_.FullName).Replace('\', '/')
      if ($relative -notmatch '^[A-Za-z0-9._/-]+$') {
        throw "Release path contains unsupported characters: $relative"
      }
      $hash = (Get-FileHash -LiteralPath $_.FullName -Algorithm SHA256).Hash.ToLowerInvariant()
      "$hash  $relative"
    }
  [IO.File]::WriteAllLines(
    (Join-Path $ReleaseDir 'manifest.sha256'),
    $manifest,
    [Text.UTF8Encoding]::new($false)
  )
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
  Assert-DeployCdn 'https://example.com'

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

    $distDir = Join-Path $testRoot 'dist'
    [void](New-Item -ItemType Directory -Path $distDir)
    [IO.File]::WriteAllText((Join-Path $distDir 'index.html'), 'demo')
    [IO.File]::WriteAllText((Join-Path $testRoot 'package.json'), '{"version":"2.0.0"}')
    $releaseDir = Join-Path $testRoot 'release'
    New-ReleasePackage $testRoot $releaseDir $deploymentId ('a' * 40) 'https://example.com'
    if (-not (Test-Path -LiteralPath (Join-Path $releaseDir 'manifest.sha256')) -or
        -not (Test-Path -LiteralPath (Join-Path $releaseDir 'index.html'))) {
      throw "Release package self-test failed"
    }
    $releaseMetadata = Get-Content -LiteralPath (Join-Path $releaseDir 'release.json') -Raw | ConvertFrom-Json
    if ($releaseMetadata.version -ne '2.0.0' -or $releaseMetadata.sri -notmatch '^sha384-[A-Za-z0-9+/]{64}$') {
      throw "Release version metadata self-test failed"
    }

  }
  finally {
    Remove-Item -LiteralPath $testRoot -Recurse -Force -ErrorAction SilentlyContinue
  }

  Write-Host "Deploy self-test passed."
}
