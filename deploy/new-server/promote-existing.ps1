#!/usr/bin/env pwsh
param(
  [Parameter(Mandatory, Position = 0)]
  [ValidatePattern('^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$')]
  [string]$Version
)

$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
. (Join-Path $projectRoot 'deploy/functions.ps1')
Set-Location $projectRoot
Import-DeployEnvironment (Join-Path $projectRoot '.env')
Assert-CleanGitWorktree $projectRoot

$package = Get-Content -LiteralPath (Join-Path $projectRoot 'package.json') -Raw | ConvertFrom-Json
if ($package.version -ne $Version) { throw "package.json version $($package.version) does not match promotion $Version" }
$commit = (& git -C $projectRoot rev-parse --verify HEAD).Trim()
if ($LASTEXITCODE -ne 0 -or $commit -notmatch '^[a-f0-9]{40}$') { throw 'Cannot determine Git commit' }
$tag = "v$Version"
$tagCommit = (& git -C $projectRoot rev-list -n 1 $tag 2>$null).Trim()
if ($LASTEXITCODE -ne 0 -or $tagCommit -ne $commit) { throw "Git tag $tag must exist and point to HEAD" }

$remoteHost = $env:DEPLOY_HOST
$remoteUser = $env:DEPLOY_USER
$localKey = $env:DEPLOY_KEY
$knownHosts = $env:DEPLOY_KNOWN_HOSTS
if (-not $remoteHost -or -not $remoteUser -or -not $localKey -or -not $knownHosts) { throw 'Missing deployment SSH configuration in .env' }
Assert-DeployConfiguration $remoteHost $remoteUser 'cdn-dist.zip' 'dist.zip'
foreach ($path in @($localKey, $knownHosts)) {
  if (-not (Test-Path -LiteralPath $path -PathType Leaf)) { throw "Deployment SSH file not found: $path" }
}

$arguments = @(
  '-i', $localKey,
  '-o', 'BatchMode=yes',
  '-o', 'IdentitiesOnly=yes',
  '-o', 'StrictHostKeyChecking=yes',
  '-o', "UserKnownHostsFile=$knownHosts",
  '-o', 'GlobalKnownHostsFile=none',
  '-o', 'ConnectTimeout=15',
  '-o', 'ConnectionAttempts=1',
  "$remoteUser@$remoteHost",
  'promote', $Version, $commit
)
Invoke-NativeCommand 'ssh' $arguments 'stable release promotion'
Write-Host "Stable release $Version promoted from existing tag $tag."
