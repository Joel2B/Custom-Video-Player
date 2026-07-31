# Dedicated deployment server

Greenfield setup for a server dedicated to Custom Video Player. Target architecture:

```text
Cloudflare proxied HTTPS -> Ubuntu 24.04 Nginx -> /srv/cvp
Windows Tailscale -> OpenSSH -> restricted cvp-deploy account
```

No Docker, Docker Compose, Portainer, Nginx Proxy Manager, Node.js, npm, application process, database, migration, or restore is used on the server. Builds run on Windows; server receives verified release archives.

## Order

Complete documents in order. Do not skip fingerprint or Tailscale checks.

1. [Requirements](docs/01-requirements.md)
2. [Cloudflare](docs/02-cloudflare.md)
3. [Tailscale](docs/03-tailscale.md)
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
openssl
util-linux
cvp-deploy restricted account
```

Tailscale must be installed and connected first. Bootstrap refuses to run unless current administrative SSH session arrives over Tailscale.

## Files changed on server

```text
/etc/cvp-deploy
/etc/nginx/sites-enabled/player.conf
/etc/sudoers.d/cvp-deploy
/home/cvp-deploy/.ssh/authorized_keys
/srv/cvp
/usr/local/libexec/cvp-*
/usr/local/sbin/cvp-nginx-activate
/var/lib/cvp-deploy
UFW rules
```

Bootstrap resets UFW. Final inbound rules permit public TCP `80` and `443`, plus TCP `22` only on `tailscale0`.

## Final checklist

```text
[ ] Ubuntu 24.04 LTS VPS created
[ ] Windows and VPS connected to same Tailscale network
[ ] Administrative SSH works through server Tailscale IP
[ ] Cloudflare Origin Certificate and key created
[ ] Dedicated Ed25519 deploy public key prepared
[ ] Setup copied into root-owned staging directory
[ ] bootstrap.sh completed
[ ] verify.sh completed
[ ] SSH host fingerprint matched through trusted VPS console
[ ] .env points DEPLOY_HOST to Tailscale IP
[ ] Cloudflare A record points to public VPS IP and is proxied
[ ] Cloudflare SSL mode is Full (strict)
[ ] npm run deploy completed
[ ] stable release promoted
[ ] public endpoint verification completed
[ ] reboot verification completed
```
