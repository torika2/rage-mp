# St. Fiacre Hospital Interior — installed map mod + `/hospital`

A specific installed interior and its teleport. For the general "how to add a map DLC" theory see
[10-adding-maps.md](10-adding-maps.md); for the teleport system see [15-teleports.md](15-teleports.md);
the pack is also listed in [inventory.md](inventory.md).

Where things live:

- **Pack:** `client_packages/game_resources/dlcpacks/stfiacre/dlc.rpf` (16384 bytes, OPEN RPF7).
- **Source ymap:** `/mnt/c/Users/torik/Downloads/stfiacre.ymap` (16733 bytes, RSC7 v2).
- **Teleport command:** `packages/teleports/index.js` (`/hospital`, `/hospitalin`).
- **Teleport point:** `packages/teleports/points.json` → `"hospital"`.
- **Registry:** `packages/clothing/data/dlc_registry.json` → `packs.stfiacre`.
- **Build tool:** `tools/rpf/build_map_dlc.py`.

---

## 1. What the mod is

"St. Fiacre Hospital Interior." The download archive (`7214f4-stfiacre.rar`) contained **only** the
single `stfiacre.ymap` — no `.ytyp`, no `.ydr` models. So this is a **props-placement interior**: the
ymap just places base-game archetypes (props the game already ships) into a hospital layout.

**It needs no `_manifest.ymf`, and therefore no CodeWalker.** A manifest exists to register *custom*
archetypes; this pack has none — every archetype it references is already registered by the base game.

> This corrects the blanket "a manifest is almost certainly required" caveat in
> [10-adding-maps.md](10-adding-maps.md). The manifest is required for **custom-archetype** packs, not
> for **base-game props-only** maps. Contrast: `gcom_ballas_gang` ships a `_manifest.ymf` precisely
> because it has custom archetypes (`ballas1756.ytyp` / `.ydr` / `.ybn`). St. Fiacre has none.

---

## 2. How it was built (Linux, no CodeWalker)

```bash
python3 tools/rpf/build_map_dlc.py stfiacre \
  /mnt/c/Users/torik/Downloads/stfiacre.ymap \
  client_packages/game_resources/dlcpacks/stfiacre/dlc.rpf
```

The resulting `dlc.rpf` is a **level pack** wired for map streaming:

- `setup2.xml`: `<type>EXTRACONTENT_LEVEL_PACK</type>`, `isLevelPack value="true"`,
  `<deviceName>dlc_stfiacre</deviceName>`, `<nameHash>stfiacre</nameHash>`.
- `content.xml`: the inner `custom_maps.rpf` is declared **twice** — once as a plain `RPF_FILE` and
  once as `CONTENTS_DLC_MAP_DATA` — enabled by the `CCS_stfiacre_SP_NG_STREAMING_MAP` changeset at
  `<genericConditions>$level=MO_JIM_L11</genericConditions>`.
- Layout inside the pack:
  `x64/levels/gta5/_citye/maps/custom_maps.rpf/stfiacre.ymap`.

Folder name `stfiacre` matches the `nameHash` — per [16-dlcpack-folder-naming.md](16-dlcpack-folder-naming.md),
keep it that way.

**Fallback (noted, not used):** `build_map_dlc.py` has a `--flat` flag that byte-mirrors the
known-working `gcom_ballas_gang` layout (a flat `x64/replacement.rpf` stored uncompressed, instead of
the nested `custom_maps.rpf`). Reach for it only if the nested layout fails to render in-game.

---

## 3. Location / coords

Extracted from the ymap entities:

| | X | Y | Z |
|--|--|--|--|
| Props cluster | 1112 – 1214 | -1620 – -1456 | 1.7 – 38.7 (multi-floor) |
| Ground-floor props | | | ≈ 3.55 |
| Centroid | 1138.4 | -1570.4 | 5.9 |

---

## 4. The `/hospital` teleport

`packages/teleports/index.js` already defines `/hospital` (and a ready-but-unpinned `/hospitalin` for a
separate "inside" point). We **repointed** the `"hospital"` entry in `points.json` away from the stock
central hospital `(325.6, -579.0, 45.4)` to the St. Fiacre ground floor:

```json
"hospital": { "x": 1138.4, "y": -1578.5, "z": 4.5, "h": 0, "dim": 0 }
```

Notes:

- `points.json` is read **at startup**, so editing the file needs a server restart — **but** an admin
  can re-pin it live with `/settp hospital`: walk to the exact entrance in-game and run it. `/settp`
  writes `points.json` immediately, no restart.
- `z = 4.5` is a best-guess just above the ground-floor props (≈ 3.55) and may need `/settp`
  fine-tuning in-game.
- `/hospitalin` is wired but its point isn't set; pin it with `/settp hospitalin` when you have a good
  interior spot.

---

## 5. Deploy

1. `sudo systemctl restart rageserv` in a **real terminal** — this loads **both** the new `dlc.rpf`
   and the updated `points.json`.
2. **Fully relaunch** the GTA client (exit to desktop, not just reconnect — DLCs mount at game load),
   then reconnect.
3. Test: `/hospital` should drop you at the St. Fiacre building and the interior props should render.

---

## Common changes — where to touch

| You want to… | Do this |
|--------------|---------|
| Move where `/hospital` lands | In-game: stand at the spot, `/settp hospital` (instant). Or edit `points.json` `"hospital"` + restart. |
| Pin the inside spot | In-game: `/settp hospitalin` (command already registered). |
| Rebuild the pack from the ymap | `python3 tools/rpf/build_map_dlc.py stfiacre <ymap> client_packages/game_resources/dlcpacks/stfiacre/dlc.rpf` |
| Props don't render after deploy | Confirm a FULL client relaunch; then try rebuilding with `--flat` (see §2). |
| Verify the pack's internal identity | `python3 tools/rpf/rpf.py cat .../stfiacre/dlc.rpf setup2.xml \| grep -iE "deviceName\|nameHash"` |
| Add a custom-archetype interior later | *Then* you need a `_manifest.ymf` (CodeWalker) — see [17-pillbox-hospital-interior.md](17-pillbox-hospital-interior.md). |
