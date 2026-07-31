# 6. Verification

## Server verification

Execute on VPS:

```bash
sudo bash /root/cvp-setup/new-server/verify.sh --domain player.tinyapps.download
```

Expected:

```text
Server verification passed.
```

## Public endpoints

Execute in Windows PowerShell after Cloudflare DNS resolves:

```powershell
curl.exe -fsSI https://player.tinyapps.download/v1/current/player.min.js
curl.exe -fsSI https://player.tinyapps.download/v1/stable/player.min.js
curl.exe -fsSI https://player.tinyapps.download/v1/versions/2.0.0/player.min.js
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
Location: /v1/versions/2.0.0/player.min.js
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

Replace `2.0.0` with package version when different.

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

Execute on VPS:

```bash
sudo reboot
```

After VPS reconnects, from Windows:

```powershell
tailscale ping VPS_TAILSCALE_IP
ssh ADMIN_USER@VPS_TAILSCALE_IP "systemctl is-active nginx tailscaled ssh"
curl.exe -fsSI https://player.tinyapps.download/v1/current/player.min.js
curl.exe -fsSI https://player.tinyapps.download/v1/stable/player.min.js
```

All services must report `active`; both CDN requests must return redirects.
