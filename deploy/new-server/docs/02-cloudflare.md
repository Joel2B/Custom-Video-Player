# 2. Cloudflare Tunnel

## Install service

Install `cloudflared` on the Ubuntu VM using Cloudflare's supported package. In Cloudflare Dashboard, create a Tunnel and copy its token without pasting the displayed command into shell history. On the trusted VM console, read the token silently:

```bash
read -rsp 'Tunnel token: ' TUNNEL_TOKEN; echo
sudo cloudflared service install "$TUNNEL_TOKEN"
unset TUNNEL_TOKEN
```

The token is briefly visible to local privileged process inspection while `service install` runs. Never commit, log, or share it.

Verify:

```bash
cloudflared --version
sudo systemctl is-enabled cloudflared
sudo systemctl is-active cloudflared
```

## Configure public hostname

In Cloudflare Zero Trust Dashboard, add this public hostname to the Tunnel:

```text
Hostname: player.tinyapps.download
Type: HTTP
URL: 127.0.0.1:8080
```

Dashboard manages the DNS route to the Tunnel. Do not create an `A` record for the VM and do not expose its LAN address.

HTTPS terminates at Cloudflare. `cloudflared` and Nginx communicate over HTTP loopback on the same VM, so no Cloudflare Origin Certificate or `noTLSVerify` setting is needed.

Nginx may initially return an error until bootstrap installs its loopback configuration. Continue with [LAN SSH](03-lan-ssh.md) and [Bootstrap](04-bootstrap.md).
