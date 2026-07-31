# 4. Bootstrap

## Copy public key and setup

Execute in Windows PowerShell from project root:

```powershell
Set-Location C:\dev\Custom-Video-Player
scp "$HOME\.ssh\cvp_deploy.pub" ADMIN_USER@VPS_TAILSCALE_IP:/tmp/cvp_deploy.pub
scp -r deploy ADMIN_USER@VPS_TAILSCALE_IP:/tmp/cvp-setup
scp "C:\SECURE_PATH\player.tinyapps.download.pem" ADMIN_USER@VPS_TAILSCALE_IP:/tmp/player-origin.pem
scp "C:\SECURE_PATH\player.tinyapps.download.key" ADMIN_USER@VPS_TAILSCALE_IP:/tmp/player-origin.key
```

Replace placeholders. Never copy deploy private key.

## Prepare trusted staging

Execute on VPS through Tailscale SSH:

```bash
sudo install -d -o root -g root -m 700 /root/cvp-setup
sudo cp -R /tmp/cvp-setup/. /root/cvp-setup/
sudo cp /tmp/cvp_deploy.pub /root/cvp-setup/cvp_deploy.pub
sudo cp /tmp/player-origin.pem /root/cvp-setup/player-origin.pem
sudo cp /tmp/player-origin.key /root/cvp-setup/player-origin.key
sudo chown -R root:root /root/cvp-setup
sudo chmod -R go-w /root/cvp-setup
sudo chmod 600 /root/cvp-setup/player-origin.key
rm -rf /tmp/cvp-setup /tmp/cvp_deploy.pub /tmp/player-origin.pem /tmp/player-origin.key
```

## Run bootstrap

Stay in SSH session connected to `VPS_TAILSCALE_IP`:

```bash
sudo env "SSH_CONNECTION=$SSH_CONNECTION" bash /root/cvp-setup/new-server/bootstrap.sh \
  --domain player.tinyapps.download \
  --public-key /root/cvp-setup/cvp_deploy.pub \
  --tls-cert /root/cvp-setup/player-origin.pem \
  --tls-key /root/cvp-setup/player-origin.key
```

Review firewall summary. Type exactly:

```text
INSTALL
```

Do not use `--yes` during first real installation.

Passing `SSH_CONNECTION` explicitly is required because Ubuntu `sudo` removes it by default. Bootstrap uses destination IP plus `tailscale whois` to prove current session runs through Tailscale before replacing firewall rules.

Expected final output:

```text
Server verification passed.
Server ready. Continue with docs/05-first-deploy.md.
```

## Confirm access before closing session

Open second Windows PowerShell window:

```powershell
ssh ADMIN_USER@VPS_TAILSCALE_IP
```

On VPS, inspect firewall:

```bash
sudo ufw status verbose
```

Expected inbound rules:

```text
22/tcp on tailscale0 ALLOW IN
80/tcp                ALLOW IN
443/tcp               ALLOW IN
```

There must be no generic public `22/tcp ALLOW IN` rule.

## Verify restricted account

From Windows:

```powershell
ssh -i "$HOME\.ssh\cvp_deploy" -o IdentitiesOnly=yes cvp-deploy@VPS_TAILSCALE_IP
```

Expected:

```text
Command not permitted
```

Shell must not open.

Bootstrap is idempotent for setup files and directories. It does reset UFW each run; rerun only from Tailscale SSH with console access available.
