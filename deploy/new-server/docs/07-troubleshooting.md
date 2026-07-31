# 7. Troubleshooting

Do not paste private keys, tokens, `.env`, full `authorized_keys`, or TLS private key into logs or support messages.

## Tailscale unavailable

On VPS console:

```bash
sudo systemctl status tailscaled --no-pager
sudo tailscale status
sudo tailscale up
```

Bootstrap requires active `100.x.y.z` address and current SSH connection from Tailscale.

## SSH stopped after bootstrap

Use VPS provider console:

```bash
sudo systemctl status ssh --no-pager
sudo ufw status verbose
ip address show tailscale0
sudo journalctl -u ssh -n 100 --no-pager
```

Do not add public SSH rule unless recovering through trusted provider console. Correct target rule:

```bash
sudo ufw allow in on tailscale0 to any port 22 proto tcp
```

## Host fingerprint mismatch

Stop. Obtain trusted fingerprint from provider console:

```bash
sudo ssh-keygen -lf /etc/ssh/ssh_host_ed25519_key.pub
```

Recreate dedicated known-hosts file only after confirming fingerprint. Never bypass with `StrictHostKeyChecking=no`.

## Nginx validation fails

```bash
sudo nginx -t
sudo journalctl -u nginx -n 100 --no-pager
sudo sed -n '1,240p' /etc/nginx/sites-enabled/player.conf
```

Do not delete active configuration. Publisher restores previous configuration if reload fails.

## Cloudflare errors

```text
521: Nginx stopped, firewall blocked, or wrong public IP
522: Origin unreachable or provider firewall blocked 80/443
525: TLS handshake failed at origin
526: Origin certificate invalid, expired, wrong hostname, or SSL mode mismatch
```

Checks on VPS:

```bash
sudo systemctl is-active nginx
sudo nginx -t
sudo ufw status verbose
sudo openssl x509 -in /etc/cvp-deploy/tls/origin.pem -noout -subject -issuer -dates
curl --insecure --head --resolve player.tinyapps.download:443:127.0.0.1 https://player.tinyapps.download/
```

`--insecure` is used only for local origin diagnosis because Cloudflare Origin CA is not a public browser CA.

## Deploy says `Command not permitted`

Check `.env` user is exactly:

```dotenv
DEPLOY_USER=cvp-deploy
```

Deploy script sends allowed command automatically. Manual shell and arbitrary commands are intentionally rejected.

## Permission failure

Run verifier:

```bash
sudo bash /root/cvp-setup/new-server/verify.sh --domain player.tinyapps.download
```

Do not fix with recursive `chmod 777` or `chown cvp-deploy /srv/cvp`. Published content and helpers must remain root-owned.

## Stable promotion fails because tag exists

Use existing-tag command only when tag points to current `HEAD`:

```powershell
pwsh ./deploy/new-server/promote-existing.ps1 2.0.0
```

If it reports tag mismatch, do not move published tag. Deploy matching tagged commit or publish a new version.

## Safe diagnostics

```bash
sudo systemctl status nginx ssh tailscaled --no-pager
sudo nginx -t
sudo ufw status verbose
sudo journalctl -u nginx -n 100 --no-pager
sudo journalctl -u ssh -n 100 --no-pager
tailscale status
```
