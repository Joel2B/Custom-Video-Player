# 1. Requirements

## VPS

Required:

```text
Ubuntu Server 24.04 LTS
Public IPv4 address
At least 1 vCPU, 1 GB RAM, and 10 GB disk
Administrative user with sudo
Provider firewall allowing TCP 80 and 443
Temporary administrative SSH access during initial setup
```

Do not install Docker, Portainer, Nginx Proxy Manager, Node.js, npm, or a database.

## Accounts

Required access:

```text
Cloudflare account controlling tinyapps.download
Tailscale account used by Windows workstation and VPS
VPS provider account or console access
```

Keep VPS web console available until bootstrap and reboot verification finish. It is recovery path if firewall or Tailscale configuration is wrong.

## Windows workstation

Required commands:

```powershell
pwsh --version
git --version
node --version
npm.cmd --version
ssh -V
tailscale version
```

Expected project location in examples:

```text
C:\dev\Custom-Video-Player
```

Project must have dedicated deploy private key:

```text
C:\Users\YOUR_USER\.ssh\cvp_deploy
```

If missing, create one in Windows PowerShell:

```powershell
ssh-keygen -t ed25519 -a 100 -f "$HOME\.ssh\cvp_deploy" -C "cvp-deploy"
```

Use a passphrase if deployment remains interactive. Never copy private key to VPS or repository.

Generate public key if needed:

```powershell
ssh-keygen -y -f "$HOME\.ssh\cvp_deploy" |
  Set-Content -Encoding ascii "$HOME\.ssh\cvp_deploy.pub"
ssh-keygen -lf "$HOME\.ssh\cvp_deploy.pub"
```

Continue only when all requirements pass.
