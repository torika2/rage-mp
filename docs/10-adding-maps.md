# Adding custom maps (`.ymap`)

How to add a custom map (world objects placed with CodeWalker/Menyoo) to this server.

## The key fact

RAGE:MP **cannot load a loose `.ymap`**. A ymap only loads when it lives inside a
`dlc.rpf` DLC pack. This server auto-mounts every
`client_packages/game_resources/dlcpacks/<name>/dlc.rpf` (same as add-on cars — no
manifest, no code), so adding a map = wrapping the ymap(s) in a minimal map DLC.

You can build the map DLC **two ways**:

- **From Linux (recommended, no Windows):** `_map_build/build_map_dlc.py` packs a
  CodeWalker-exported `.ymap` straight into a valid `dlc.rpf`. One command, no GUI.
  ```bash
  python3 _map_build/build_map_dlc.py <name> /path/to/exported.ymap
  # writes client_packages/game_resources/dlcpacks/<name>/dlc.rpf
  ```
  It emits the RPF7 format verified against this server's existing packs (OPEN encryption,
  standard `x64/levels/gta5/_citye/maps/custom_maps.rpf` layout) and auto-generates
  `setup2.xml`/`content.xml`.
- **In CodeWalker on Windows** (`CodeWalker30_dev46`): manual GUI route, steps below.

## Target layout

The finished pack:

```
client_packages/game_resources/dlcpacks/<name>/dlc.rpf
```

…where `dlc.rpf` contains:

```
dlc.rpf/
  setup2.xml
  content.xml
  x64/levels/gta5/_citye/maps/custom_maps.rpf/
    <your>.ymap        (one or more)
```

## Build source template

`client_packages/game_resources/_build_rc12b/` holds a ready source tree with
correct `setup2.xml` and `content.xml`. Copy that folder for a new map, swap the ymap,
and change three tokens (`rc12b` device name, `nameHash`, and the `*_AUTOGEN` changeset
name) to your new pack name in both XML files.

- `setup2.xml` — declares the DLC (`deviceName`, `nameHash`, startup changeset group).
- `content.xml` — mounts `custom_maps.rpf` and enables it via the `*_AUTOGEN` changeset.
- The `dlc_<name>:` prefix in `content.xml` **must match** `deviceName` in `setup2.xml`.

## CodeWalker build steps

1. CodeWalker → **Tools → RPF Explorer** → **File → New RPF Archive** → `dlc.rpf`,
   encryption **OPEN** (unencrypted).
2. Import `setup2.xml` and `content.xml` at the root.
3. Recreate folders: `x64` → `levels` → `gta5` → `_citye` → `maps`.
4. Inside `maps`: **New RPF Archive** → `custom_maps.rpf`, **OPEN**.
5. Open `custom_maps.rpf` → **Import Raw** your `.ymap` file(s).
6. Save (CodeWalker fixes offsets automatically).
7. Copy the finished `dlc.rpf` → `client_packages/game_resources/dlcpacks/<name>/dlc.rpf`.

## Deploy

```bash
sudo systemctl restart rageserv     # real terminal (sudo)
```

Then **fully relaunch the GTA client** and reconnect — DLCs (incl. maps) mount at game
load, so a plain reconnect isn't enough (same rule as cars, golden rule #2).

## Notes

- Map objects appear at the ymap's baked coordinates — nothing is added to `/veh`.
- If the ymap references **custom** models (its own `.ydr`/`.ytyp`), those must be packed
  into the DLC too. A ymap that only uses base-game props (like `rc12b_default`) needs
  nothing extra.
- Not showing up? Check `journalctl -u rageserv -f` at connect time, and re-verify the
  `dlc_<name>:` / `deviceName` match.
