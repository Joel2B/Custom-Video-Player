# Legacy Docker server

Files in this directory support current Docker-based deployment server. They remain necessary while that server is active or may need helper reinstallation.

Do not use this stack for dedicated Ubuntu server. New greenfield setup lives in [`../new-server/README.md`](../new-server/README.md).

Runtime installation paths remain unchanged:

```text
/usr/local/libexec/cvp-deploy-entrypoint
/usr/local/libexec/cvp-remote-deploy
/usr/local/libexec/cvp-safe-extract.py
/usr/local/libexec/cvp-verify-release.py
/usr/local/sbin/cvp-nginx-activate
/etc/cvp-deploy/player.conf.template
```

Repository layout does not affect already-installed production files. Reinstall Docker server helpers with instructions in project root `README.md`.
