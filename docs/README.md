# RAGE:MP Server Documentation

Operational docs for this RAGE:MP (GTA V multiplayer) server.

## Index

| Doc | What's in it |
|-----|--------------|
| [01-server-overview.md](01-server-overview.md) | Paths, service, networking, GTA/client layout |
| [02-adding-vehicle-mods.md](02-adding-vehicle-mods.md) | **How to add add-on car DLCs (the full, correct process)** |
| [03-commands.md](03-commands.md) | Freeroam commands & client keybinds |
| [04-troubleshooting.md](04-troubleshooting.md) | Common problems & fixes (esp. "spawns default car") |
| [05-inspecting-rpf.md](05-inspecting-rpf.md) | How to read a `dlc.rpf` (spawn names, liveries, encryption) |
| [10-adding-maps.md](10-adding-maps.md) | **How to add custom maps (`.ymap`) via a map DLC** |
| [06-testing.md](06-testing.md) | Test plan for the money/fuel/engine flow |
| [07-police-system.md](07-police-system.md) | Police ranks, commands, jail, and configuration |
| [13-gangs.md](13-gangs.md) | **Gangs: leader/ranks/permissions, base, treasury, stash, crafting** |
| [14-parking.md](14-parking.md) | **Parking: rentable spots, spawn/recall cars, admin editor, finder** |
| [15-teleports.md](15-teleports.md) | **Teleports: named destinations (`/cityhall`, `/hospital`, `/settp`)** |
| [09-admin-panel.md](09-admin-panel.md) | Admin panel access, actions, security checks, and usage |
| [11-tattoo-salons.md](11-tattoo-salons.md) | Tattoo salons: locations, data, pricing, saving |
| [12-salons.md](12-salons.md) | Barber/clothing/tattoo: private instances, barber buy flow, hair-colour gotcha |
| [16-dlcpack-folder-naming.md](16-dlcpack-folder-naming.md) | **dlcpack folder naming: prefix rename broke all mods; keep folder = internal `nameHash`** |
| [17-pillbox-hospital-interior.md](17-pillbox-hospital-interior.md) | **Pillbox custom interior: what we tried (MLO can't be spawned server-side; DLC needs a CodeWalker `_manifest.ymf`)** |
| [18-stfiacre-hospital.md](18-stfiacre-hospital.md) | **St. Fiacre Hospital Interior: props-only map DLC (no manifest), built on Linux, + `/hospital` teleport** |
| [19-kv-store.md](19-kv-store.md) | **SQL kv_store: `global.kv.load/save`, namespaces per package, API/JSON fallback, ops** |
| [20-lspd-armoury-locker.md](20-lspd-armoury-locker.md) | **LSPD armoury (craft gear for a fee), uniform locker (free visual uniforms), armour skin (`player.vestSkin`)** |
| [inventory.md](inventory.md) | What mods are installed and their spawn names |

## Golden rules (read these first)

1. **Add-on DLCs go in `client_packages/game_resources/dlcpacks/<name>/dlc.rpf`** — not `client_packages/dlcpacks/`. This was the fix that got them to download at all.
2. After changing DLCs: **restart the server** *and* **fully relaunch the GTA client** (not just reconnect) — DLCs mount at game load. **This was the actual fix** for "spawns default car" (verified: the BMW works even with a mismatched folder name once the client is fully relaunched).
3. **Use the Legacy build** of any mod (this server runs Legacy GTA V, not Enhanced/gen9).
4. The **spawn name** is the `<modelName>` inside the pack's `vehicles.meta` (see doc 05) — not always what the readme says.
5. The `<name>` folder name is *not* required to match the internal DLC name (BMW spawns fine as `bmwm5`). Matching it is tidy but not necessary.

### Deploying without sudo
`client_packages/` is now owned by the `torik` user, so files can be edited/added directly (no sudo).
Only **`sudo systemctl restart rageserv`** needs sudo, and it must be run in a **real terminal**
(the Claude `!` prompt can't answer the sudo password). Original root-owned copy backed up as
`client_packages.rootbak.*`.
