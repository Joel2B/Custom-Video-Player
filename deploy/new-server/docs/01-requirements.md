# 1. Requirements

## Ubuntu VM

Required:

```text
Ubuntu Server 26.04 LTS
Fixed LAN IP 192.168.2.197
At least 1 vCPU, 1 GB RAM, and 10 GB disk
Administrative user with sudo
Hypervisor console for recovery
UFW denying incoming traffic by default
```

Do not forward ports `22`, `80`, `443`, or `8080` through the router. Do not install Docker, Portainer, Nginx Proxy Manager, Node.js, npm, or a database on the VM.

## Cloudflare

Required access:

```text
Cloudflare account controlling tinyapps.download
Cloudflare Tunnel registered on the VM by token
Public hostname player.tinyapps.download
Tunnel service http://127.0.0.1:8080
```

Keep Tunnel credentials outside the repository, shell history, and support logs. `cloudflared` must run as a system service before bootstrap.

## Windows workstation

Required commands:

```powershell
pwsh --version
git --version
node --version
npm.cmd --version
ssh -V
```

Expected project location:

```text
C:\dev\Custom-Video-Player
```

Create a dedicated Ed25519 deploy key if missing:

```powershell
ssh-keygen -t ed25519 -a 100 -f "$HOME\.ssh\cvp_deploy" -C "cvp-deploy"
ssh-keygen -y -f "$HOME\.ssh\cvp_deploy" |
  Set-Content -Encoding ascii "$HOME\.ssh\cvp_deploy.pub"
ssh-keygen -lf "$HOME\.ssh\cvp_deploy.pub"
```

Use a passphrase if deployment remains interactive. Never copy the private key to the VM or repository.
