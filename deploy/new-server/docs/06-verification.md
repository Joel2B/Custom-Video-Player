# 6. Verification

## Server verification

Execute on the VM:

```bash
sudo bash /root/cvp-setup/new-server/verify.sh \
  --domain player.tinyapps.download \
  --ssh-source 192.168.2.0/24
```

Expected:

```text
Server verification passed.
```

## Public endpoints

Execute in Windows PowerShell after the Tunnel hostname is active:

```powershell
curl.exe -fsSI https://player.tinyapps.download/v1/current/player.min.js
curl.exe -fsSI https://player.tinyapps.download/v1/stable/player.min.js
curl.exe -fsSI https://player.tinyapps.download/v1/versions/2.2.0/player.min.js
curl.exe -sSI https://player.tinyapps.download/v1/versions/999.0.0/player.min.js
```

Expected `current`:

```text
HTTP 302
Cache-Control: no-store
Location: /v1/deployments/...
```

Expected `stable`:

```text
HTTP 302
Cache-Control: no-store
Location: /v1/versions/2.2.0/player.min.js
```

Expected immutable version:

```text
HTTP 200
Cache-Control: public, max-age=31536000, immutable
Access-Control-Allow-Origin: *
X-Content-Type-Options: nosniff
```

Expected missing version:

```text
HTTP 404
Cache-Control: no-store
```

Replace `2.2.0` with package version when different.

## Verify metadata and bytes

```powershell
$version = (Get-Content package.json -Raw | ConvertFrom-Json).version
$metadata = Invoke-RestMethod "https://player.tinyapps.download/v1/versions/$version/release.json"
$bundle = Join-Path $env:TEMP "cvp-$version-player.min.js"
Invoke-WebRequest $metadata.url -OutFile $bundle
$actualSha = (Get-FileHash $bundle -Algorithm SHA256).Hash.ToLowerInvariant()
if ($actualSha -ne $metadata.sha256) { throw "SHA-256 mismatch" }
$metadata | ConvertTo-Json
Remove-Item $bundle
```

## Reboot test

Execute on the VM:

```bash
sudo reboot
```

After the VM reconnects, from Windows:

```powershell
ssh ADMIN_USER@192.168.2.197 "systemctl is-active nginx cloudflared ssh ssh.socket"
if ($LASTEXITCODE -ne 0) { throw 'Required VM service is inactive' }
if (-not (Test-NetConnection 192.168.2.197 -Port 22 -InformationLevel Quiet)) { throw 'SSH is unavailable' }
foreach ($port in 80, 443, 8080) {
  if (Test-NetConnection 192.168.2.197 -Port $port -InformationLevel Quiet) { throw "Unexpected LAN listener: $port" }
}
curl.exe -fsSI https://player.tinyapps.download/v1/current/player.min.js
if ($LASTEXITCODE -ne 0) { throw 'Current CDN endpoint failed' }
curl.exe -fsSI https://player.tinyapps.download/v1/stable/player.min.js
if ($LASTEXITCODE -ne 0) { throw 'Stable CDN endpoint failed' }
```

All services and `ssh.socket` must report `active`; only LAN port `22` may respond, and both CDN requests must return redirects.
