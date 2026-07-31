# 2. Cloudflare

## Create Origin Certificate

Execute in Cloudflare Dashboard:

1. Select `tinyapps.download`.
2. Open `SSL/TLS` then `Origin Server`.
3. Select `Create Certificate`.
4. Select `Generate private key and CSR with Cloudflare`.
5. Select ECC private key.
6. Set hostname to `player.tinyapps.download`.
7. Select desired validity, up to 15 years.
8. Create certificate.

Save certificate as:

```text
player.tinyapps.download.pem
```

Save private key as:

```text
player.tinyapps.download.key
```

Cloudflare displays private key once. Do not commit, email, or paste it into shell history. Store both files securely until bootstrap.

## Configure SSL

In Cloudflare Dashboard:

```text
SSL/TLS encryption mode: Full (strict)
Edge Certificates > Always Use HTTPS: On
Edge Certificates > Minimum TLS Version: TLS 1.2
```

Do not select `Flexible` or plain `Full`.

## DNS timing

Create or change DNS only after bootstrap and first deploy are ready.

Final record:

```text
Type: A
Name: player
IPv4 address: VPS_PUBLIC_IP
Proxy status: Proxied
TTL: Auto
```

Use public VPS IP, never Tailscale `100.x.y.z` address.

Cloudflare Origin Certificate is trusted between Cloudflare and origin. Browsers connecting directly to VPS will not trust it; that is expected.
