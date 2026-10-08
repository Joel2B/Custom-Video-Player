# 3. LAN SSH

The VM uses fixed LAN IP `192.168.2.197`. Do not forward SSH through the router and do not use the public Cloudflare hostname as `DEPLOY_HOST`.

## Configure firewall

Keep the hypervisor console available. On the VM, configure UFW before bootstrap:

```bash
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow from 192.168.2.0/24 to any port 22 proto tcp comment 'SSH from LAN'
sudo ufw enable
sudo ufw status verbose
```

Do not add inbound rules for ports `80`, `443`, or `8080`. Cloudflare Tunnel connects to Nginx over loopback and needs no firewall rule.

## Verify from Windows

```powershell
Test-NetConnection 192.168.2.197 -Port 22
ssh ADMIN_USER@192.168.2.197
```

Keep the current session open until a second administrative SSH connection succeeds. Reserve both VM and deployment workstation addresses in DHCP if fixed addresses are not configured locally.
