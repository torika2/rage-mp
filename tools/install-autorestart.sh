#!/usr/bin/env bash
# One-time setup (run with sudo): auto-restart rageserv when code/assets change.
#   sudo bash tools/install-autorestart.sh
# Undo:
#   sudo systemctl disable --now rageserv-autorestart
#   sudo rm /etc/systemd/system/rageserv-autorestart.service /etc/sudoers.d/rageserv-restart
set -euo pipefail

REPO="$(cd "$(dirname "$0")/.." && pwd)"
RUN_USER="${SUDO_USER:-user}"

# Let the watcher (running as $RUN_USER) restart the game server — and nothing else — without a password.
SUDOERS=/etc/sudoers.d/rageserv-restart
echo "$RUN_USER ALL=(root) NOPASSWD: /usr/bin/systemctl restart rageserv" > "$SUDOERS.tmp"
chmod 440 "$SUDOERS.tmp"
visudo -cf "$SUDOERS.tmp" >/dev/null
mv "$SUDOERS.tmp" "$SUDOERS"

cat > /etc/systemd/system/rageserv-autorestart.service <<EOF
[Unit]
Description=Auto-restart rageserv when server/client code changes
After=rageserv.service

[Service]
Type=simple
User=$RUN_USER
WorkingDirectory=$REPO
ExecStart=/usr/bin/python3 $REPO/tools/autorestart.py
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable --now rageserv-autorestart
systemctl --no-pager status rageserv-autorestart | head -5
echo "Done. Watch it with: journalctl -u rageserv-autorestart -f"
