# Security policy

## Supported versions

Only the latest release receives security fixes. Update with **Settings → Updates** or by pulling the newest image.

## Reporting a vulnerability

Please do not open a public issue for a security problem. Email [mail@raktimranjit.com](mailto:mail@raktimranjit.com) with what you found, the steps to reproduce it and the version (shown in Settings → Updates). You will get a first reply within a few days. Once a fix is released we are happy to credit you if you wish.

## Good practice for operators

- Serve Mavri over HTTPS and set `COOKIE_SECURE=true` and `TRUST_PROXY=1` behind a reverse proxy.
- Back up the data folder; it holds the database and the keys that protect store secrets.
- The updater container needs the Docker socket. It only changes the version tag of the Mavri image and has no published port; remove it if you do not want one-click updates.
