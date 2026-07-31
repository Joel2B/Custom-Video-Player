# 3. Tailscale

Tailscale carries normal OpenSSH traffic. Do not enable Tailscale SSH; deploy scripts require server OpenSSH host keys and restricted `authorized_keys` forced commands.

## Install on VPS

Execute from VPS provider console or initial administrative SSH session:

```bash
curl -fsSL https://tailscale.com/install.sh | sh
sudo tailscale up
```

Open authorization URL printed by `tailscale up`. Authorize VPS in same tailnet used by Windows.

Verify on VPS:

```bash
systemctl is-active tailscaled
tailscale status
tailscale ip -4
```

Expected:

```text
active
100.x.y.z
```

Record server Tailscale IP as `VPS_TAILSCALE_IP`.

## Verify from Windows

Connect Windows to Tailscale, then execute:

```powershell
tailscale status
tailscale ping VPS_TAILSCALE_IP
ssh ADMIN_USER@VPS_TAILSCALE_IP
```

Continue only if administrative SSH succeeds using Tailscale IP.

## Important lockout protection

Run bootstrap from this Tailscale SSH session:

```powershell
ssh ADMIN_USER@VPS_TAILSCALE_IP
```

Bootstrap checks source address starts with `100.` before resetting UFW. Keep current session open and provider console available until a second Tailscale SSH connection succeeds.
