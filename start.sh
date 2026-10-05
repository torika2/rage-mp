#!/usr/bin/env bash
# Start the RAGE:MP backend API and the game server together, then follow logs.
#   Usage:  sudo ./start.sh            # clear client cache, build API, restart both, tail logs
#           sudo ./start.sh --no-build # skip the API build step
#           sudo ./start.sh --no-logs  # start both and exit (don't follow logs)
#           sudo ./start.sh --no-cache # skip clearing the client resource cache
set -euo pipefail

cd /opt/ragemp-srv

# This server's client-side resource cache on the Windows host (localhost testing via WSL). Clearing it
# before start makes the client re-pull fresh client_packages + DLCs on next connect (a local disk copy,
# so it's fast), which avoids stale/removed packs lingering. The hash is derived from the server address
# and is stable unless the bind/port changes. Override the dir/hash with env vars if your setup differs.
CLIENT_CACHE_DIR="${CLIENT_CACHE_DIR:-/mnt/c/RAGEMP/client_resources}"
SERVER_CACHE_HASH="${SERVER_CACHE_HASH:-a6bb1b6b330415190b17fc01b4134262}"

BUILD=1
FOLLOW=1
CLEAR_CACHE=1
for arg in "$@"; do
  case "$arg" in
    --no-build) BUILD=0 ;;
    --no-logs)  FOLLOW=0 ;;
    --no-cache) CLEAR_CACHE=0 ;;
    *) echo "unknown option: $arg" >&2; exit 2 ;;
  esac
done

if [[ $CLEAR_CACHE -eq 1 ]]; then
  if [[ -d "$CLIENT_CACHE_DIR/$SERVER_CACHE_HASH" ]]; then
    echo ">> Clearing client cache ($SERVER_CACHE_HASH)..."
    rm -rf "${CLIENT_CACHE_DIR:?}/${SERVER_CACHE_HASH:?}" || true
  else
    echo ">> Client cache not found (skipping) — $CLIENT_CACHE_DIR/$SERVER_CACHE_HASH"
  fi
fi

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
