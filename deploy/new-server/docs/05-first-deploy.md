# 5. First deploy

## Register SSH host key

Get trusted fingerprint from VPS provider console or already trusted administrative session:

```bash
sudo ssh-keygen -lf /etc/ssh/ssh_host_ed25519_key.pub
```

Record SHA-256 fingerprint.

From Windows PowerShell:

```powershell
ssh-keyscan -t ed25519 VPS_TAILSCALE_IP |
  Set-Content -Encoding ascii "$HOME\.ssh\cvp_new_known_hosts"
ssh-keygen -lf "$HOME\.ssh\cvp_new_known_hosts"
```

Fingerprints must match exactly. Stop if different.

## Configure project

Set project `.env`:

```dotenv
DEPLOY_CDN=https://player.tinyapps.download
DEPLOY_HOST=VPS_TAILSCALE_IP
DEPLOY_USER=cvp-deploy
DEPLOY_KEY=C:\Users\YOUR_USER\.ssh\cvp_deploy
DEPLOY_KNOWN_HOSTS=C:\Users\YOUR_USER\.ssh\cvp_new_known_hosts
```

`.env` is ignored by Git. Replace every placeholder.

## Check repository

Execute from Windows PowerShell:

```powershell
Set-Location C:\dev\Custom-Video-Player
git status --short --branch
npm run check
```

Deploy requires clean worktree.

## Publish current

```powershell
npm run deploy
```

Expected final line:

```text
CDN deploy finished successfully.
```

## Promote stable

Read current package version:

```powershell
$version = (Get-Content package.json -Raw | ConvertFrom-Json).version
$version
```

If tag `v$version` does not exist, use normal flow:

```powershell
npm run promote -- $version
```

If tag already exists and points to current `HEAD`, use:

```powershell
pwsh ./deploy/new-server/promote-existing.ps1 $version
```

`promote-existing.ps1` does not create or change Git tags. It verifies existing tag points to `HEAD`, then promotes exact bytes from `current`.

## Configure DNS

Follow [Cloudflare](02-cloudflare.md). Point proxied A record to VPS public IP. Wait for Cloudflare to serve new origin.

Continue with public verification.
