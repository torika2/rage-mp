# dlcpack Folder Naming — the gotcha that broke every add-on

**One rule:** on this server, keep each dlcpack folder name equal to the pack's **internal
`nameHash`** (the unprefixed original name). Renaming existing dlcpack folders broke **all** add-on
mods here — see the incident below.

Where things live:

- Packs: `client_packages/game_resources/dlcpacks/<name>/dlc.rpf`
- Only code that reads folder names: `packages/clothing/data/dlc_registry.json` (rebuilt on boot by
  `packages/clothing/dlc.js` via `readdirSync` — self-healing; metadata for the "new item" badge, not
  mod loading).
- RPF inspection tool: `tools/rpf/rpf.py`
- Client download cache: `/mnt/c/RAGEMP/client_resources/<serverhash>/`

---

## The incident (verified this session, 2026-10-07)

All 52 add-on folders under `dlcpacks/` had been renamed with category prefixes —
`car_`, `cloth_`, `map_`, `sound_` (e.g. `15z28` → `car_15z28`,
`gcom_ballas_gang` → `map_gcom_ballas_gang`, `mpclothes` → `cloth_mpclothes`). This was an
uncommitted working-tree change.

**Result: NONE of the add-on mods loaded.** Cars spawned as default, the Ballas map area was gone,
clothing packs vanished. This stayed broken **even after a FULL client relaunch** (close GTA to
desktop + reconnect) — so it was *not* the usual "I only reconnected, didn't remount" problem.

The fix: revert all 51 prefixed folders back to their unprefixed names (the RPFs were byte-identical,
only folder names changed), restore `dlc_registry.json` to HEAD, leave `DISABLED_map_rc12b` alone,
then `sudo systemctl restart rageserv` → **fully relaunch** the client → reconnect. Known-good.

---

## Why — folder name vs. the RPF's internal identity

A `dlc.rpf` carries its own identity, independent of the folder it sits in. In `setup2.xml`:

- `<deviceName>` — e.g. `dlc_15z28`, `dlc_ballas_free`
- `<nameHash>` — e.g. `15z28`, `ballas_free`

`content.xml` references files internally as `dlc_<nameHash>:/...`. The folder name is what RAGE:MP
scans and ships to the client; the `nameHash` is the identity the game mounts under.

Verified examples (folder → internal):

| Folder (known-good) | `deviceName` | `nameHash` |
|---------------------|--------------|------------|
| `15z28` | `dlc_15z28` | `15z28` |
| `gcom_ballas_gang` | `dlc_ballas_free` | `ballas_free` |

Note the Ballas folder name does **not** equal its `nameHash` and still works — so folder-name ≠
nameHash is not automatically fatal. What empirically broke things here was *mass-renaming
already-working folders at once*. Until the prefix convention is proven to load in-game, **do not
rename existing folders**; name new packs to match their `nameHash`.

### Contradiction with doc 02 / golden rule #5

`docs/02-adding-vehicle-mods.md` and `docs/inventory.md` describe the folder name as "free-form" and
recommend prefixing (`car_`, `sound_`, …). **That guidance was written as part of the same unverified
rename and was never tested in-game.** On this server the prefix rename broke all mod loading. Treat
the "free-form / prefix convention" claim as **UNVERIFIED**. (Golden rule #5 in `docs/README.md`
remains as written; this doc is the standing caveat.)

---

## Diagnostic recipe (what was used)

1. **Read the RPF's internal identity** — does not depend on folder name:
   ```bash
   python3 tools/rpf/rpf.py cat \
     client_packages/game_resources/dlcpacks/<folder>/dlc.rpf setup2.xml \
     | grep -iE "deviceName|nameHash"
   ```

2. **Confirm a rename was "pure"** (RPF bytes unchanged, only the folder moved):
   ```bash
   git hash-object client_packages/game_resources/dlcpacks/<folder>/dlc.rpf
   git rev-parse HEAD:client_packages/game_resources/dlcpacks/<origfolder>/dlc.rpf
   ```
   Equal hashes → the content is identical; the only variable is the folder name.

3. **Client cache is hash-named, not md5.** Files in
   `/mnt/c/RAGEMP/client_resources/<serverhash>/` are stored under RAGE:MP's own content-hash
   filenames — you **cannot** verify a pack by md5-matching the cache. Match by **byte size**
   instead (`find ... -size <BYTES>c`, see doc 04).

4. **DLCs mount at game load.** A mid-session reconnect downloads but won't remount. Always do a
   FULL client relaunch (exit GTA to desktop) when testing a naming change — and note that in this
   incident even a full relaunch did not rescue the prefixed names.

5. **Server side is rarely the culprit.** Here the server restarted fine, `.listcache` regenerated
   after the rename, and all 52 packs were present and served — yet nothing loaded client-side.

---

## Common changes — where to touch

| You want to… | Do this |
|--------------|---------|
| Add a new pack | Name its folder to match the RPF's `nameHash` (inspect via the recipe above). Don't prefix. |
| Rename an existing pack folder | Don't, unless you can test a FULL relaunch in-game. It broke everything here. If you must, revert is: restore the original folder name (byte-identical RPF). |
| Find a pack's internal name | `rpf.py cat <dlc.rpf> setup2.xml \| grep -iE "deviceName\|nameHash"` |
| Verify a rename didn't alter content | Compare `git hash-object` of the file vs `git rev-parse HEAD:<path>` |
| Clothing badge metadata after a rename | `packages/clothing/data/dlc_registry.json` self-heals on boot (`readdirSync`); just restart. |
