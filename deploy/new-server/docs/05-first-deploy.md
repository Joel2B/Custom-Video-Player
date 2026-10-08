# 5. First deploy

## Register SSH host key

Get trusted fingerprint from the VM console or an already trusted administrative session:

```bash
sudo ssh-keygen -lf /etc/ssh/ssh_host_ed25519_key.pub
```

Record SHA-256 fingerprint.

From Windows PowerShell:

```powershell
ssh-keyscan -t ed25519 192.168.2.197 |
  Set-Content -Encoding ascii "$HOME\.ssh\cvp_new_known_hosts"
ssh-keygen -lf "$HOME\.ssh\cvp_new_known_hosts"
```

Fingerprints must match exactly. Stop if different.

## Configure project

Set project `.env`:

```dotenv
DEPLOY_CDN=https://player.tinyapps.download
DEPLOY_HOST=192.168.2.197
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

## Confirm Tunnel hostname

Follow [Cloudflare Tunnel](02-cloudflare.md). Confirm `player.tinyapps.download` belongs to the Tunnel and targets `http://127.0.0.1:8080`. Do not create an `A` record for the VM.

Continue with public verification.
