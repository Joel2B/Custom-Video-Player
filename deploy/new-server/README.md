# Dedicated deployment server

Setup and recovery guide for the production Ubuntu VM. Target architecture:

```text
Cloudflare HTTPS -> Cloudflare Tunnel -> http://127.0.0.1:8080 -> Nginx -> /srv/cvp
Windows -> LAN OpenSSH -> restricted cvp-deploy account
```

No Docker, Docker Compose, Portainer, Nginx Proxy Manager, Node.js, npm, application process, database, migration, or restore is used on the server. Builds run on Windows; server receives verified release archives.

## Order

Complete documents in order. Do not skip host fingerprint, firewall, or backup checks.

1. [Requirements](docs/01-requirements.md)
2. [Cloudflare](docs/02-cloudflare.md)
3. [LAN SSH](docs/03-lan-ssh.md)
4. [Bootstrap](docs/04-bootstrap.md)
5. [First deploy](docs/05-first-deploy.md)
6. [Verification](docs/06-verification.md)
7. [Troubleshooting](docs/07-troubleshooting.md)

## Installed components

`bootstrap.sh` installs and configures:

```text
nginx
openssh-server
python3
sudo
ufw
curl
util-linux
cvp-deploy restricted account
```

Cloudflare Tunnel must already be installed, registered by token, and active. UFW must already deny incoming traffic by default and allow SSH only from `192.168.2.0/24`. Bootstrap verifies these controls but never changes firewall rules or Tunnel credentials.

## Files changed on server

```text
/etc/cvp-deploy
/etc/cvp-deploy/nginx/default.conf
/etc/nginx/sites-enabled/player
/etc/sudoers.d/cvp-deploy
/home/cvp-deploy/.ssh/authorized_keys
/srv/cvp
/usr/local/libexec/cvp-*
/usr/local/sbin/cvp-nginx-activate
/var/lib/cvp-deploy
```

Bootstrap is idempotent and preserves `/srv/cvp` releases. Nginx listens only on `127.0.0.1:8080`; LAN ports `80`, `443`, and `8080` remain closed.

## Final checklist

```text
[ ] Ubuntu 26.04 LTS VM uses fixed LAN IP 192.168.2.197
[ ] Administrative SSH works over LAN
[ ] UFW allows SSH from 192.168.2.0/24 only
[ ] Cloudflare Tunnel service is active
[ ] Tunnel hostname targets http://127.0.0.1:8080
[ ] Dedicated Ed25519 deploy public key prepared
[ ] Setup copied into root-owned staging directory
[ ] bootstrap.sh completed
[ ] verify.sh completed
[ ] SSH host fingerprint matched through trusted VM console
[ ] .env points DEPLOY_HOST to 192.168.2.197
[ ] Nginx has no LAN or public web listener
[ ] /etc/nginx/sites-enabled/player points to /etc/cvp-deploy/nginx/default.conf
[ ] npm run deploy completed
[ ] stable release promoted
[ ] public endpoint verification completed
[ ] reboot verification completed
```
