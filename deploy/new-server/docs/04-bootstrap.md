# 4. Bootstrap

Bootstrap reconciles deployment helpers and Nginx configuration. It preserves `/srv/cvp`, existing releases, and UFW rules.

## Back up existing state

If an installation already exists, back it up on the VM:

```bash
paths=()
for path in etc/cvp-deploy etc/nginx/sites-enabled/player \
  etc/nginx/sites-available/player \
  etc/sudoers.d/cvp-deploy home/cvp-deploy/.ssh srv/cvp var/lib/cvp-deploy; do
  [ -e "/$path" ] && paths+=("$path")
done
[ "${#paths[@]}" -eq 0 ] || sudo tar -C / -czf /root/cvp-before-bootstrap.tgz "${paths[@]}"
```

## Copy setup

From Windows PowerShell:

```powershell
Set-Location C:\dev\Custom-Video-Player
scp "$HOME\.ssh\cvp_deploy.pub" ADMIN_USER@192.168.2.197:/tmp/cvp_deploy.pub
scp -r deploy ADMIN_USER@192.168.2.197:/tmp/cvp-setup
```

Never copy the deploy private key or Cloudflare Tunnel token.

On the VM:

```bash
sudo install -d -o root -g root -m 700 /root/cvp-setup
sudo cp -R /tmp/cvp-setup/. /root/cvp-setup/
sudo cp /tmp/cvp_deploy.pub /root/cvp-setup/cvp_deploy.pub
sudo chown -R root:root /root/cvp-setup
sudo chmod -R go-w /root/cvp-setup
rm -rf /tmp/cvp-setup /tmp/cvp_deploy.pub
```

## Run bootstrap

Confirm `cloudflared` and UFW first:

```bash
systemctl is-active cloudflared
sudo ufw status verbose
```

Then run:

```bash
sudo bash /root/cvp-setup/new-server/bootstrap.sh \
  --domain player.tinyapps.download \
  --public-key /root/cvp-setup/cvp_deploy.pub \
  --ssh-source 192.168.2.0/24
```

Review summary and type `INSTALL`. Bootstrap refuses open SSH/web firewall rules, never resets UFW, and never changes Tunnel credentials. Existing `current`, `testing`, and `stable` pointers are rendered through the new loopback-only template without changing published bytes.

Production configuration remains at `/etc/cvp-deploy/nginx/default.conf`, exposed to Nginx through `/etc/nginx/sites-enabled/player`. Bootstrap rejects any different symlink target. It does not delete the unused `/etc/nginx/sites-available/player`; remove that file only in a separate maintenance window after confirming no include or symlink references it.

Expected final output:

```text
Server verification passed.
Server ready. Continue with docs/05-first-deploy.md.
```

## Confirm isolation

On the VM:

```bash
sudo ss -ltnp
sudo ufw status verbose
```

Nginx must listen on `127.0.0.1:8080` only. No inbound UFW rule may allow ports `80`, `443`, or `8080`.

From Windows:

```powershell
ssh -i "$HOME\.ssh\cvp_deploy" -o IdentitiesOnly=yes cvp-deploy@192.168.2.197
```

Expected: `Command not permitted`. Shell must not open.
