# Adding custom maps (`.ymap`)

How to add a custom map (world objects placed with CodeWalker/Menyoo) to this server.

> ⚠️ **The "lightweight overlay" builder below does NOT make the ymap render.** Verified
> 2026-10-07 on the Pillbox-hospital edit: a `EXTRACONTENT_COMPAT_PACK` that mounts
> `custom_maps.rpf` only as a plain `RPF_FILE` with an empty `<mapChangeSetData/>` mounts the
> archive but **never registers the ymap into the streaming map-data store**, so nothing appears
> in-game. A ymap only streams when the pack is wired as **map data** (`CONTENTS_DLC_MAP_DATA`) and,
> in practice, ships a **`_manifest.ymf`**. See **[Why a ymap actually streams](#why-a-ymap-actually-streams-the-2026-10-07-fix)**
> below — that is the correct, verified-structure route. Treat the overlay builder as deprecated.

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

---

## Why a ymap actually streams (the 2026-10-07 fix)

The overlay route above mounts the RPF but **does not tell the engine the ymap exists**. Mounting a
file device ≠ registering map data. For the engine (`fwMapDataStore`) to stream a CMapData, the pack
has to declare the RPF as map data *and* register the ymap. Mirror the one map DLC on this server that
actually renders, `gcom_ballas_gang`.

### The structural recipe (what makes it stream)

1. **`setup2.xml` = a level pack, not a compat pack:**
   ```xml
   <type>EXTRACONTENT_LEVEL_PACK</type>
   <isLevelPack value="true" />
   <order value="2" />
   ```
   Changeset groups `GROUP_EARLY_ON` / `GROUP_UPDATE_STREAMING` / `GROUP_UPDATE_TEXT`, with a
   `..._STREAMING_MAP` changeset listed under `GROUP_UPDATE_STREAMING`.

2. **`content.xml` declares `custom_maps.rpf` TWICE** — once as a plain `RPF_FILE`, once again with
   `CONTENTS_DLC_MAP_DATA` (the second declaration is the registration that routes the ymap into the
   streaming store), and the `..._STREAMING_MAP` changeset enables it:
   ```xml
   <Item>
     <filename>dlc_<name>:/%PLATFORM%/levels/gta5/_citye/maps/custom_maps.rpf</filename>
     <fileType>RPF_FILE</fileType>
     <overlay value="false" /><disabled value="true" /><persistent value="false" />
     <contents>CONTENTS_DLC_MAP_DATA</contents>
   </Item>
   ...
   <changeSetName>CCS_<name>_SP_NG_STREAMING_MAP</changeSetName>
   <genericConditions>$level=MO_JIM_L11</genericConditions>   <!-- the active level on this server -->
   ```

3. **A `_manifest.ymf` is (almost certainly) required.** Every map pack that renders here ships one.
   It is the `fwMapDataStore` registration table: each ymap listed by its name hash + content flags +
   bounds (decoded from Ballas: `ballas1756` = `0xea674b0b`, flags `0x4001`/`0x84001`). Without it the
   HD ymap may not be pulled into streaming even with `CONTENTS_DLC_MAP_DATA` set.

### ADD vs OVERRIDE a stock ymap

If your edit is a modified copy of a stock level ymap (e.g. `rc12b_default`, the Pillbox hospital):

- **ADD (preferred for additive edits):** give the ymap a **unique name** (e.g. `pillbox_rescue`,
  hash `0x8d9117eb`) so it streams *alongside* the stock ymap by its own extents. Your extra entities
  overlay on top; the stock interior is untouched. Lower risk — no collision with the base game's
  reserved map-data name.
- **OVERRIDE:** keep the stock name (`rc12b_default`). Only needed if the edit *removes or moves*
  stock entities. Fights the base map-data store over a reserved name; more fragile.

A CMapData's name hash lives at **file offset `0x18b8`** in the inflated resource (after the 16-byte
RSC7 header is stripped and the body is raw-inflated); `parent`, `flags`, `contentFlags` follow, then
the streaming/entity extents as vec4 floats. For the Pillbox edit: `contentFlags=0x41`, `parent=0`
(a root HD map that streams by its own valid extents ≈ (294,-609,42)→(367,-580,47)).

### `interiors.js` and additive overlays

An **additive** overlay does **not** replace the stock interior — leave the stock IPLs enabled
(`v_hospital`, `RC12B_HospitalInterior` in `REQUEST_IPLS`; `RC12B_Default`, `RC12B_Fixed` in
`REMOVE_IPLS`). Removing them is only for a full override that supplies its own interior shell.

### Building it on Linux

`tools/rpf/pack_dlc.py` and the (now-removed) `_map_build/build_map_dlc.py` build only the overlay
style — they do **not** emit the level-pack wiring or a manifest. A scratch builder that emits the
correct level-pack `setup2.xml`/`content.xml` + nested `custom_maps.rpf` was used for the fix
(adapted from `pack_dlc.py`; takes an optional 4th arg to pack a `_manifest.ymf`). The XML half is
reliably hand-buildable and round-trip-verifiable with `tools/rpf/rpf.py cat … setup2.xml|content.xml`.

### The manifest is the CodeWalker-only step

`_manifest.ymf` is a big-endian PSO resource (PSIN/PSCH/PMAP sections, schema-driven offsets, virtual
pointer fixups). It cannot be reliably hand-authored on Linux and a malformed one can crash map load.
Generate it in CodeWalker:

1. Open the pack's `dlc.rpf` in CodeWalker (Tools → RPF Explorer).
2. Create/open a CodeWalker **Project**, add your `.ymap`, then **generate the `_manifest.ymf`**
   (Project / Manifest Generator) — it registers your ymap with the right content flags.
3. **Import Raw** the `_manifest.ymf` into `custom_maps.rpf` next to the `.ymap`.
4. Save; copy `dlc.rpf` back to `client_packages/game_resources/dlcpacks/<name>/dlc.rpf`.

### Verify + deploy

```bash
python3 tools/rpf/rpf.py cat <pack>/dlc.rpf setup2.xml   | grep -iE "type|isLevelPack|order|nameHash"
python3 tools/rpf/rpf.py cat <pack>/dlc.rpf content.xml  | grep -i CONTENTS_DLC_MAP_DATA
python3 tools/rpf/rpf.py ls  <pack>/dlc.rpf              # confirm custom_maps.rpf present
```
Then `sudo systemctl restart rageserv` (real terminal) → **fully relaunch** GTA → reconnect. Confirm
the client pulled it by byte size: `find /mnt/c/RAGEMP/client_resources -type f -size <BYTES>c`. If the
stock interior loads but the custom entities don't appear, the missing piece is the `_manifest.ymf`
(CodeWalker step above).
