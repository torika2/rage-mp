# Server Overview

## Server (Linux / WSL2)

- **Server path:** `/opt/ragemp-srv`
- **Runs as systemd service:** `rageserv`
  - Restart: `sudo systemctl restart rageserv`
  - Live logs: `journalctl -u rageserv -f`
  - Started/uptime: `systemctl show rageserv -p ActiveEnterTimestamp --value`
  - **Auto-restart on code changes** (optional, one-time `sudo bash tools/install-autorestart.sh`):
    the `rageserv-autorestart` service (`tools/autorestart.py`) restarts `rageserv` ~2 s after
    files in `packages/`, `client_packages/` or `conf.json` change. Server-written data
    (`packages/*/*.json`, `.listcache`) is ignored. Logs: `journalctl -u rageserv-autorestart -f`.
- **Config:** `/opt/ragemp-srv/conf.json` — gamemode `freeroam`, port `22005`, maxplayers `100`
- **Host OS:** Ubuntu on WSL2 (mirrored networking)

### Directory layout

```
/opt/ragemp-srv/
├── conf.json                     # server config
├── packages/freeroam/index.js    # server-side gamemode (commands live here)
├── client_packages/
│   ├── index.js                  # client-side entry script (keybinds etc.)
│   ├── .listcache                # RAGE:MP's internal served-file index (binary, auto-managed)
│   └── game_resources/           # files overlaid onto GTA's file system on the client
│       ├── common/data/gameconfig.xml   # MapTypesStore raised to 50000 (Redux fix)
│       └── dlcpacks/<name>/dlc.rpf      # add-on vehicle DLCs  <-- mods go here
└── docs/                         # this documentation
```

> **Permissions note:** `client_packages/` and `packages/` are often `root`-owned, while
> `/opt/ragemp-srv` itself is writable by the `torik` user. If you can't edit script/mod files,
> run once: `sudo chown -R torik:torik /opt/ragemp-srv/client_packages /opt/ragemp-srv/packages`
> (the server runs as root and can still read files owned by you).

## Networking

- **Public IP:** `62.168.180.105`
- **Ports:** `22005/UDP` + `22006/TCP`, forwarded on the **Cudy router** to `192.168.10.148`
- (`22006/TCP` is the HTTP file server clients use to download `client_packages`.)

## Client machine (Windows)

- **GTA V install:** `F:\GTAV` — **Legacy** edition (`GTA5.exe`, `x64a–x64w.rpf`, BattlEye).
  There is **no** `GTA5_Enhanced.exe`, so this is *not* the gen9/Enhanced edition.
- **RAGE:MP client:** `C:\RAGEMP` (release channel in `config.xml` is `prerelease`)
  - Downloaded server assets cache: `C:\RAGEMP\client_resources\<server-hash>\`
    - Files are stored under **hashless hash-names** (no extension) and are **obfuscated**
      (same byte length as the source, scrambled content — so md5 won't match the source).
  - Client input log (not very useful): `C:\RAGEMP\clientdata\console.txt`

### Legacy vs Enhanced — important

Add-on `dlc.rpf` files are **not cross-compatible** between Legacy and Enhanced GTA V.
This server + client run **Legacy**, so always install the **Legacy** build of any mod
(many mods ship both `Legacy/` and `Enhanced/` folders).
