#!/usr/bin/env bash
# Start the RAGE:MP backend API and the game server together, then follow logs.
#   Usage:  sudo ./start.sh            # build API, restart both, tail logs
#           sudo ./start.sh --no-build # skip the API build step
#           sudo ./start.sh --no-logs  # start both and exit (don't follow logs)
set -euo pipefail

cd /opt/ragemp-srv

BUILD=1
FOLLOW=1
for arg in "$@"; do
  case "$arg" in
    --no-build) BUILD=0 ;;
    --no-logs)  FOLLOW=0 ;;
    *) echo "unknown option: $arg" >&2; exit 2 ;;
  esac
done

if [[ $EUID -ne 0 ]]; then
  echo "This script controls systemd services and must run as root. Try: sudo $0 $*" >&2
  exit 1
fi

if [[ $BUILD -eq 1 ]]; then
  echo ">> Building API..."
  ( cd api && npm run build )
fi

echo ">> Restarting ragemp-api..."
systemctl restart ragemp-api

echo ">> Restarting rageserv..."
systemctl restart rageserv

sleep 1
echo ">> Status:"
systemctl --no-pager --lines=0 status ragemp-api rageserv || true

if [[ $FOLLOW -eq 1 ]]; then
  echo ">> Following logs (Ctrl-C to stop; services keep running)..."
  journalctl -u ragemp-api -u rageserv -f
fi
