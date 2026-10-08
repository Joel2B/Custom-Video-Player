# 7. Troubleshooting

Do not paste private keys, Tunnel tokens, `.env`, or full `authorized_keys` into logs or support messages.

## SSH unavailable

Use the VM console:

```bash
sudo systemctl status ssh --no-pager
sudo ufw status verbose
ip address
sudo journalctl -u ssh -n 100 --no-pager
```

Expected UFW rule:

```bash
sudo ufw allow from 192.168.2.0/24 to any port 22 proto tcp comment 'SSH from LAN'
```

Do not add a generic SSH rule or router port forwarding.

## Host fingerprint mismatch

Stop. Obtain trusted fingerprint from the VM console:

```bash
sudo ssh-keygen -lf /etc/ssh/ssh_host_ed25519_key.pub
```

Recreate the dedicated known-hosts file only after confirming the fingerprint. Never use `StrictHostKeyChecking=no`.

## Tunnel returns 502

Cloudflare reaches the VM, but `cloudflared` cannot reach Nginx. Check:

```bash
sudo systemctl status cloudflared nginx --no-pager
sudo nginx -t
sudo ss -ltnp
curl -I -H 'Host: player.tinyapps.download' http://127.0.0.1:8080/
sudo journalctl -u cloudflared -n 100 --no-pager
sudo journalctl -u nginx -n 100 --no-pager
```

Nginx must listen on `127.0.0.1:8080`; Dashboard Tunnel service must be `http://127.0.0.1:8080`.

## Tunnel disconnected

```bash
sudo systemctl is-enabled cloudflared
sudo systemctl is-active cloudflared
sudo journalctl -u cloudflared -n 100 --no-pager
```

Reinstalling the service requires a fresh token from Cloudflare Dashboard. Never store that token in this repository.

## Nginx validation fails

```bash
sudo nginx -t
sudo sed -n '1,240p' /etc/cvp-deploy/nginx/default.conf
readlink -e /etc/nginx/sites-enabled/player
```

Do not delete active configuration. Publisher restores previous configuration if reload fails.

## Deploy says `Command not permitted`

`.env` user must be `cvp-deploy`. Deploy scripts send allowed commands automatically; manual shells and arbitrary commands are intentionally rejected.

## Permission failure

```bash
sudo bash /root/cvp-setup/new-server/verify.sh \
  --domain player.tinyapps.download \
  --ssh-source 192.168.2.0/24
```

Do not use recursive `chmod 777` or `chown cvp-deploy /srv/cvp`. Published content and helpers must remain root-owned.

## Stable promotion tag exists

Use the existing-tag command only when the tag points to current `HEAD`:

```powershell
pwsh ./deploy/new-server/promote-existing.ps1 2.2.0
```

If it reports a mismatch, do not move a published tag. Deploy the matching tagged commit or publish a new version.

## Safe diagnostics

```bash
sudo systemctl status nginx cloudflared ssh --no-pager
sudo nginx -t
sudo ufw status verbose
sudo ss -ltnp
sudo journalctl -u nginx -n 100 --no-pager
sudo journalctl -u cloudflared -n 100 --no-pager
```
