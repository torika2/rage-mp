# Pillbox Hospital custom interior — what we tried (2026-10-07)

Goal: get a **custom Pillbox Hill Medical Center interior edit** to render in-game. The edit was
made in CodeWalker as `pillbox_rescue.ymap` (derived from editing the stock `rc12b_default.ymap` —
232 objects, ~12 added vs stock). This doc records every approach tried, the in-game result the
owner reported, and the conclusion — so we don't re-run dead ends.

> **TL;DR — the one conclusion that matters:** The visible Pillbox interior is an **MLO interior**.
> Its furniture are **interior archetypes baked into the MLO/ytyp**, not standalone props. That means:
> 1. **Server-side `mp.objects.new` cannot rebuild it** — those models aren't spawnable; they render
>    as GTA's "trash bag" placeholder. (Confirmed in-game.)
> 2. **A map-DLC is the only route**, and it needs a **`_manifest.ymf` generated in CodeWalker**. The
>    correct level-pack build is fully reproducible on Linux via `tools/rpf/build_map_dlc.py` (see the
>    recipe below); the manifest is the one **CodeWalker-only** piece. The pack was removed during
>    cleanup, so rebuild it with the recipe when you resume.

---

## The asset / files involved

| Path | Role |
|------|------|
| `CodeWalker-Tryings/pillbox_rescue.ymap` | The owner's edited ymap (RSC7; 232 entities; CMapData name hash `0x8d9117eb` = joaat `pillbox_rescue`). **Kept** — the source to rebuild from (recipe below). |
| `CodeWalker-Tryings/rc12b_default_old.ymap` | The baseline it was derived from (222 entities; name hash `0xd4961afe` = joaat `rc12b_default`). **Kept.** |
| `CodeWalker-Tryings/downtown_01_metadata_008_strm.ytyp` | A **stock vanilla ambient-effects ytyp**, dragged in by accident. Not needed. **Kept** (harmless). |
| `CodeWalker-Tryings/savings.cwproj` | CodeWalker project ("Pillbox Rescue"); lists the ymap, empty `<YtypFilenames/>`. **Kept.** |
| `tools/rpf/build_map_dlc.py` | **Builder** — packs a ymap (+ optional `_manifest.ymf`) into a correct level-pack `dlc.rpf`. The recipe below uses it. |
| `client_packages/game_resources/dlcpacks/pillbox_rescue/` | **Removed.** The map DLC pack was deleted during cleanup — rebuild it with the recipe below. |
| `packages/hospital/` | **Map code removed.** `index.js` now only loads `death.js` (death/revive + respawn). The old server-side spawner, `pillbox_nr.js`, `model_names.js`, and `pillbox_rescue_adds.js` were deleted. |
| `client_packages/interiors.js` | Native hospital IPLs (`v_hospital`, `RC12B_*`) **removed from the loader** so the hospital renders GTA-default. Re-add them if an ADD-style overlay needs the native interior present. |

Related docs: [`10-adding-maps.md`](10-adding-maps.md) (map-DLC streaming wiring),
[`05-inspecting-rpf.md`](05-inspecting-rpf.md), [`16-dlcpack-folder-naming.md`](16-dlcpack-folder-naming.md).

---

## How to include a custom ymap — end-to-end recipe

This is the complete pipeline to take a CodeWalker-edited `.ymap` and get it into the server as a
rendering map DLC. Worked example: `CodeWalker-Tryings/pillbox_rescue.ymap` → the Pillbox interior.
Everything except **step 2** is reproducible on Linux; step 2 is the one CodeWalker-only piece.

### Step 0 — Start with the ymap
You have a compiled RSC7 ymap from CodeWalker: `CodeWalker-Tryings/pillbox_rescue.ymap`. Confirm it:
```bash
head -c4 CodeWalker-Tryings/pillbox_rescue.ymap   # must be: RSC7
python3 - <<'PY'
import zlib,struct
raw=zlib.decompress(open('CodeWalker-Tryings/pillbox_rescue.ymap','rb').read()[16:],-15)
print("name hash @0x18b8:", hex(struct.unpack_from('<I',raw,0x18b8)[0]))  # the ymap asset name
PY
```

### Step 1 — Decide ADD vs OVERRIDE
- **ADD** (recommended for *extra* objects): keep a unique ymap name (`pillbox_rescue`). The engine
  streams it alongside stock by its own extents. It can only **add** entities, not move/delete stock
  ones. Leave the native interior IPLs in `client_packages/interiors.js` as-is.
- **OVERRIDE** (to *replace / move / delete* stock interior objects): the ymap must carry the **same
  asset name as the stock map it replaces** (`rc12b_default`). Rename the file to `rc12b_default.ymap`
  **and** patch the CMapData name hash in place (file offset `0x18b8`:
  `joaat("pillbox_rescue")=0x8d9117eb` → `joaat("rc12b_default")=0xd4961afe`). You may also need to
  **remove the native `RC12B_*`/`v_hospital` IPLs** from `interiors.js` so they don't fight the override.

> Reality check from this project: overriding `rc12b_default` is for an **MLO interior**, whose
> furniture are archetypes baked into the interior model. A ymap overlay can reposition/add map
> *entities*, but reshaping the actual MLO needs editing the interior itself in CodeWalker.

### Step 2 — Generate `_manifest.ymf` (CodeWalker only — mandatory)
A map DLC does **not** stream without a `_manifest.ymf` (the `fwMapDataStore` registration table:
ymap name hashes + content flags + bounds). It's a big-endian PSO resource (`PSIN`/`PMAP`/`PSCH`
sections) and **must be generated for THIS pack's exact ymap set**.
1. CodeWalker → **Tools → Project → New Project**, add `pillbox_rescue.ymap`.
2. Generate the manifest (**Project → Generate manifest**, or the Manifest Generator) →
   save `_manifest.ymf` into `CodeWalker-Tryings/`.

> **Do NOT copy/hash-patch another pack's manifest** (we tried patching Ballas's). A manifest holds
> an **array of all the ymap name-hashes in its pack** — Ballas's lists ~12 ymaps. Swapping just the
> `ballas1756` hash → `pillbox_rescue` leaves ~11 hashes pointing at Ballas ymaps that don't exist in
> your pack, so the manifest is internally inconsistent (claims 12 maps, rpf has 1) and the map
> subsystem rejects it → nothing streams. Rebuilding the arrays/counts/`PMAP` offsets for a single
> ymap by hand is the schema-driven PSO work CodeWalker exists to do. Use CodeWalker.

### Step 3 — Build the DLC (Linux)
Use the builder (recovered from this work):
```bash
python3 tools/rpf/build_map_dlc.py \
  pillbox_rescue \
  CodeWalker-Tryings/pillbox_rescue.ymap \
  client_packages/game_resources/dlcpacks/pillbox_rescue/dlc.rpf \
  CodeWalker-Tryings/_manifest.ymf        # omit this 4th arg only to test WITHOUT a manifest
```
This writes a correct **level pack** (`EXTRACONTENT_LEVEL_PACK`, `isLevelPack=true`, order 2), with
`custom_maps.rpf` declared twice (`RPF_FILE` + `CONTENTS_DLC_MAP_DATA`) and enabled via a
`CCS_pillbox_rescue_SP_NG_STREAMING_MAP` changeset — i.e. the wiring that actually streams the ymap.
Folder name **must equal the pack `nameHash`** (`pillbox_rescue`) — see [`16-dlcpack-folder-naming.md`](16-dlcpack-folder-naming.md).

### Step 4 — Verify the pack on disk
```bash
python3 tools/rpf/rpf.py ls client_packages/game_resources/dlcpacks/pillbox_rescue/dlc.rpf
python3 tools/rpf/rpf.py cat client_packages/game_resources/dlcpacks/pillbox_rescue/dlc.rpf setup2.xml | grep -E 'nameHash|LEVEL_PACK|isLevelPack'
```
Then extract the inner `custom_maps.rpf` and confirm it holds **both** `pillbox_rescue.ymap` **and**
`_manifest.ymf` (see [`05-inspecting-rpf.md`](05-inspecting-rpf.md)).

### Step 5 — Deploy
```bash
sudo systemctl restart rageserv          # re-indexes client_packages → regenerates .listcache
journalctl -u rageserv -f                # confirm clean boot, no content.xml parse errors
```
Then **fully close GTA to desktop** (not just reconnect) and relaunch — the client re-downloads the
pack and mounts DLCs at game load; an already-streamed interior won't refresh on a mere reconnect.

### Step 6 — Verify in-game
Go to the hospital (`/hospital`) and look for your edit. If stock still shows and the custom edit
doesn't, re-check that `_manifest.ymf` is actually inside `custom_maps.rpf` (step 2 is the usual
culprit). **Do not** fall back to spawning the objects server-side — proven dead end (see below).

---

## What we tried, in order

### 1. Removed a stray ytyp + rebuilt the inner rpf
The pack's `custom_maps.rpf` contained the ymap **plus** a stray vanilla ytyp
(`downtown_01_metadata_008_strm`, only ambient-effect archetypes) and **no `_manifest.ymf`**. A ytyp
with no manifest can make the whole rpf fail to load. Rebuilt `custom_maps.rpf` with **only** the ymap.
- **Owner response:** *"default Pillbox Hill Medical Center loads"* — stock interior, not the custom one.

### 2. Renamed the ymap to override stock (`rc12b_default`)
GTA overrides map assets by the **ymap asset name** (a joaat hash), not the dlcpack/folder name. The
edit was named `pillbox_rescue`, which nothing in the game loads, so stock `rc12b_default` kept
loading. Renamed the inner file → `rc12b_default.ymap` and **patched the CMapData name hash in place**
(file offset `0x18b8`: `0x8d9117eb` → `0xd4961afe`), leaving all map edits intact.
- **Owner response:** *"nothing changed"* — stock interior still shown.

### 3. Rebuilt as a proper level pack (streaming changeset)
Root cause of #2: the pack was an `EXTRACONTENT_COMPAT_PACK` that only **mounted** `custom_maps.rpf`
as a plain `RPF_FILE` with an empty `<mapChangeSetData/>` — it never registered the ymap into the
engine's `fwMapDataStore`, so nothing streamed. Rebuilt it to match the **only map DLC that renders
on this server**, `gcom_ballas_gang`:
- `type=EXTRACONTENT_LEVEL_PACK`, `isLevelPack=true`, `order=2`
- groups `GROUP_EARLY_ON` / `GROUP_UPDATE_STREAMING` / `GROUP_UPDATE_TEXT`
- `custom_maps.rpf` declared **twice** (plain `RPF_FILE` + once with `<contents>CONTENTS_DLC_MAP_DATA</contents>`)
- enabled via `CCS_pillbox_rescue_SP_NG_STREAMING_MAP` (`$level=MO_JIM_L11`)
- kept the **ADD** approach (unique name `pillbox_rescue`, hash `0x8d9117eb`) rather than overriding stock
- reverted `client_packages/interiors.js` to stock (native `v_hospital`/`RC12B_*` IPLs restored)
- **Owner response:** *"still the same visuals without changes."*

### 4. Concluded the DLC needs a `_manifest.ymf`
Every rendering map pack on this server ships a `_manifest.ymf` — the `fwMapDataStore` table (name
hash + flags + bounds) that actually pulls a ymap into streaming. It's a big-endian PSO resource
(PSIN/PSCH/PMAP) and **cannot be reliably hand-authored on Linux**. This is the real remaining blocker
for the DLC route and is **CodeWalker-only**.

### 5. Pivoted to server-side objects (`mp.objects.new`)
Since the DLC was stuck on the manifest, tried recreating the objects server-side (the pattern
`packages/citymap` and the legacy `packages/hospital` use). Extracted entities from the ymap binary
(see "ymap extraction" below), diffed vs `rc12b_default_old` → **12 added objects**, spawned them.
- First attempt spawned at **module-load time** → too early, `mp.objects.new` silently failed, nothing
  appeared. Fixed timing to **`packagesLoaded` + 1s** (same as `citymap`).
- **Owner response:** *"nothing appeared in chat"* for `/hnear`. **Server logs showed it working** —
  `12 active total`, `/hnear` listing R1–R12. The chat silence is a separate gotcha (below).
- **Owner response (visual):** *"a little bit inside the hospital… doesn't do anything"* — no
  meaningful change.

### 6. Spawned the full 232-object set
Hypothesis: `rc12b_default_old` might be the owner's own earlier save rather than true stock, making
the 12-object diff too small. Switched to spawning **all 232** objects from the ymap.
- **Owner response:** *"it's trashbags. but interior is the same and nothing was changed."*

### 7. Final diagnosis + disabled the spawn
The 232 objects render as **trash-bag placeholders** = GTA cannot load those models as standalone
props, because they're the **hospital MLO interior's own archetypes**, not independent `prop_*`
models. `mp.objects.new` can only place real standalone props (a few, like `prop_vend_soda_01`, are
real and would show; the interior-specific ones can't). Set `SPAWN_RESCUE_ADDS = false` in
`packages/hospital/index.js` to clear the trash bags.

---

## Gotchas worth remembering

- **`/hnear` output never shows in chat on this server.** The command works (it logs to the server
  console via `console.log`), but its `player.outputChatBox` calls don't render — this server uses a
  custom CEF chat that the default `outputChatBox` doesn't reach. **Use `journalctl -u rageserv` as
  the source of truth**, not in-game chat, for `/hnear`.
- **Spawn objects on `packagesLoaded` + a short delay**, never at module-load. Creating objects during
  `require()` (server boot) silently fails. `packages/citymap` is the reference pattern.
- **`mp.objects.new` only works for standalone props**, not MLO/interior-embedded archetypes. If a
  spawned object shows as a trash bag, its model isn't an independent prop.
- **Map-asset override is by ymap name hash, not folder/pack name.** To replace stock `rc12b_default`
  the ymap asset itself must be named `rc12b_default`.

## ymap extraction reference (for future binary work)

Decompress an RSC7 ymap with `zlib.decompress(data[16:], -15)` (strip the 16-byte RSC7 header).
In the decompressed system segment (virtual base `0x50000000` → file offset 0):
- **CMapData** starts at file `0x1898`; `name` hash at `+0x20` (= file `0x18b8`), `parent` `+0x24`,
  `flags` `+0x28`, `contentFlags` `+0x2C`.
- **Entities** are `0x80` bytes each (this map starts them at file `0x4000`): `archetypeName` at
  `+0x08`, `position` (vec3) at `+0x20`, `rotation` (quaternion x,y,z,w) at `+0x30`.
- ymap rotation quaternion → GTA entity euler: negate x,y,z then convert (ZYX). Yaw-only objects
  convert cleanly; tilted items may need a manual tweak.

## The only path that can work

Finish the **map DLC** — the structure is already correct in `dlcpacks/pillbox_rescue/dlc.rpf`; it
just needs the `_manifest.ymf`:

1. CodeWalker → **Tools → Project → New Project**, add `pillbox_rescue.ymap`.
2. Generate the manifest (**Tools → Manifest Generator** / Project → *Generate manifest*) →
   `_manifest.ymf` registering `pillbox_rescue` with its bounds/flags.
3. Open `dlc.rpf` → `x64/levels/gta5/_citye/maps/custom_maps.rpf` → **Import Raw** both the ymap and
   `_manifest.ymf`.
4. `sudo systemctl restart rageserv` → fully relaunch GTA → reconnect.

Use `tools/rpf/build_map_dlc.py` (the recipe above) — it packs the ymap and an existing
`_manifest.ymf` into a correct level-pack rpf, but **cannot create** the manifest (CodeWalker only).
If the goal is to **move/delete** stock interior objects (not just add), that requires editing the
**MLO interior** itself in CodeWalker — more advanced than a ymap overlay.
