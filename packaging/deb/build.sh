#!/bin/sh
# Build the Mavri .deb for Debian and Ubuntu (architecture: all).
# The package installs a systemd service that runs the published Mavri image
# with Docker Compose; it does not bundle the app itself.
# Usage: packaging/deb/build.sh [version]   (default: version in package.json)
set -eu
umask 022
here=$(cd "$(dirname "$0")" && pwd)
root=$(cd "$here/../.." && pwd)
ver=${1:-$(sed -n 's/.*"version": *"\([^"]*\)".*/\1/p' "$root/package.json" | head -1)}
out=${OUT_DIR:-$root/dist}
stage=$(mktemp -d)
trap 'rm -rf "$stage"' EXIT

pkg="$stage/mavri_${ver}_all"
mkdir -p "$pkg/DEBIAN" "$pkg/usr/lib/mavri" "$pkg/etc/mavri" \
  "$pkg/lib/systemd/system" "$pkg/usr/share/doc/mavri" "$pkg/usr/bin"

sed "s/@VERSION@/$ver/g" "$here/docker-compose.yml" > "$pkg/usr/lib/mavri/docker-compose.yml"
install -m 0644 "$here/mavri.env" "$pkg/etc/mavri/mavri.env"
install -m 0644 "$here/mavri.service" "$pkg/lib/systemd/system/mavri.service"
install -m 0755 "$here/mavri-update" "$pkg/usr/bin/mavri-update"
install -m 0644 "$root/LICENSE" "$pkg/usr/share/doc/mavri/copyright"
printf 'mavri (%s) stable; urgency=medium\n\n  * Mavri %s. See https://github.com/Raktim94/mavri/blob/main/CHANGELOG.md\n\n -- Raktim Ranjit <ranjitraktim5@gmail.com>  %s\n' \
  "$ver" "$ver" "$(date -R)" | gzip -9n > "$pkg/usr/share/doc/mavri/changelog.Debian.gz"
echo /etc/mavri/mavri.env > "$pkg/DEBIAN/conffiles"
for s in postinst prerm postrm; do install -m 0755 "$here/$s" "$pkg/DEBIAN/$s"; done

size=$(du -sk "$pkg" | cut -f1)
cat > "$pkg/DEBIAN/control" <<EOF
Package: mavri
Version: $ver
Section: web
Priority: optional
Architecture: all
Installed-Size: $size
Depends: docker.io | docker-ce, docker-compose-v2 | docker-compose-plugin, systemd
Maintainer: Raktim Ranjit <ranjitraktim5@gmail.com>
Homepage: https://mavri.nodedr.com/
Description: Self-hosted invoicing and quotes (runs in Docker)
 Mavri is free, open-source invoice and quote software. This package installs a
 systemd service that runs the published Mavri container with Docker Compose,
 keeping all records in a Docker volume on this machine. Open
 http://localhost:3001 after installing.
 .
 Settings are in /etc/mavri/mavri.env. Run "sudo mavri-update" to move to the
 version this package pins, and back up your data before upgrading.
EOF

mkdir -p "$out"
fakeroot dpkg-deb --root-owner-group -Zxz --build "$pkg" "$out/mavri_${ver}_all.deb" >/dev/null
echo "$out/mavri_${ver}_all.deb"
