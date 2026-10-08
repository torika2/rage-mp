# Installed Mods

Folder = `client_packages/game_resources/dlcpacks/<folder>/dlc.rpf`.

## Folder naming convention (category prefixes)

> ⚠️ **UNVERIFIED — this convention broke every add-on on the server (2026-10-07).** Mass-renaming all
> folders with the prefixes below stopped all mods loading (cars default, Ballas map gone, clothing
> gone) even after a full client relaunch. The known-good state is **unprefixed folder names matching
> each pack's internal `nameHash`** — that is what is on disk now, so the `car_`/`cloth_`/`map_`/`sound_`
> folder names in the tables below are **stale** (strip the prefix to get the real folder). See
> **[16-dlcpack-folder-naming.md](16-dlcpack-folder-naming.md)** before touching any folder name.

Every pack folder *was intended to* carry a **category prefix** so the `dlcpacks/` listing groups by
kind (this was never proven in-game — see the warning above):

| Prefix | Meaning | Count |
|--------|---------|-------|
| `car_` | A vehicle (bikes included) | 40 |
| `sound_` | Engine-sound-only pack, no vehicle of its own | 6 |
| `cloth_` | Clothing | 2 |
| `map_` | Map / interior | 3 |

The new name is always `<prefix>` + the original folder name (e.g. `bmwm5` → `car_bmwm5`,
`mpclothes` → `cloth_mpclothes`, `gcom_ballas_gang` → `map_gcom_ballas_gang`).

**Why a prefix instead of subfolders:** RAGE:MP has no real subfolder support — the client mounts
DLCs with a flat, one-level scan of `dlcpacks/`, and each immediate subfolder must contain `dlc.rpf`
directly. A nested `dlcpacks/cars/<name>/dlc.rpf` does **not** mount. So the prefix is the only way to
group them.

**The folder name is cosmetic.** Spawning and all game logic key off the **model/spawn name baked
inside the rpf's `vehicles.meta`**, never the folder (golden rule #5). `/car`,
`packages/carshop/index.js`, `packages/freeroam/index.js` aliases, `packages/gangs/index.js`
(`model: '404lencatv4'`) and client drift-grip all reference the model name. `packages/admin/carhandling.js`
and `packages/clothing/dlc.js` discover packs dynamically via `readdirSync(DLC_DIR)`, so they adapt to
any folder names automatically.

**Two files ARE folder-keyed** (the exception): `packages/clothing/data/dlc_registry.json` (keys =
folder names) and `packages/clothing/data/clothing_new.json` (`pack` fields). When renaming a clothing
pack folder, migrate/rekey these two — otherwise the registry rebuilds from the new folder names on
next start, which re-triggers the "new" (ახალი) clothing badges for 7 days.

**Deploy cost of a rename:** changing a folder name changes the client download identity, so after a
rename a restart + FULL client relaunch makes every player **re-download all packs**.

## Vehicles — spawn with `/car <name>`

| Car | Spawn name | Folder | Liveries | Status |
|-----|-----------|--------|----------|--------|
| BMW M4 (G82 Adro Kit) | `g82adro` | `car_bmwm5` | none | ✅ installed (works despite folder≠name) |
| Audi RS7 (2023) | `23rs7` | `car_abtrsr_rs7c8` | none | ✅ installed |
| Audi RS7 ABT (2023) | `23rs7abt` | `car_abtrsr_rs7c8` (same pack) | none | ✅ installed |
| Audi RS7 Sportback (RmodCustoms) | `rmodrs7` | `car_rmodrs7` | ✅ yes | ✅ installed |
| BMW M235i Gran Coupe (F44) | `M235iXD` (alias `f44`) | `car_M235iXD` | none | ✅ installed |
| Mercedes-Benz G-Class 2019 | `XG632019` (alias `gclass`) | `car_gclass` (internal DLC: `XG632019`) | none | ✅ installed; client cache size matched, in-game spawn not yet verified |
| Dodge Challenger SRT Demon | `dcd` (alias `demon`) | `car_demon` | none | ✅ installed (folder≠name) |
| BMW M8 Competition (Mansory) | `mansm8c` (alias `m8`) | `car_mansm8c` | ✅ 7 | ✅ installed |
| BMW M5 E39 | `bmwm5e39` (alias `m5e39`) | `car_bmwm5e39` | none | ✅ installed |
| Mercedes-Benz E55 AMG | `benze55` | — | — | ❌ removed — crashed the client on spawn (incompatible/malformed model) |
| Mercedes-Benz CLS 6.3 AMG 2015 | `cls2015` (alias `cls`) | `car_cls2015` | — | ✅ installed (stock sound SCHAFTER5) |
| Audi R8 2020 (RsMods) | `r820` (alias `r8`) | `car_r820` | — | ✅ installed (stock sound XA21) |
| BMW M5 F90 Competition 2019 | `2019M5` (alias `f90`) | `car_2019M5` | — | ✅ installed (audio → `sound_s63b44` S63 V8, experimental custom sound; was COMET2) |
| Mercedes-Benz S-Class 2027 (DAVKU) | `mercedessclass27` (alias `sclass`) | `car_mercedessclass27` | — | ✅ installed (audio → `sound_mbnzc63eng`, experimental; was ZENTORNO) |
| 1969 Dodge Charger | `69charger` (alias `charger69`) | `car_69charger` | — | ✅ installed |
| Chevrolet Camaro Z/28 2015 | `15z28` (alias `z28`) | `car_15z28` | — | ✅ installed |
| Lexus LX570 2019 Black Edition | `lx57019mc` (alias `lx570`) | `car_lx57019mc` | — | ✅ installed |
| SWAT van | `swatvanr2` (alias `swatvan`) | `car_swatvanr2` | — | ✅ installed |
| LHP pack (4 vehicles) | `alamolhp`, `alamolhpslick`, `bufsxlhp`, `dnscoutlhp` | `car_lhp` | — | ✅ installed (spawn by exact name) |
| Lamborghini Fenomeno 2026 (DAVKU) | `fenomeno` | `car_fenomeno` | — | ✅ installed |
| Invetero Coquette D5 (SMC) | `coquette6c` (alias `d5`) | `car_coquette6c` | — | ✅ installed |
| yumi | `yumi` | `car_yumi` | — | ✅ installed |
| BMW M4 F82 (HAMMER, Legacy) | `m4f82` | `car_m4f82` | — | ✅ installed |
| Toyota Land Cruiser 300 VX.R (HAMMER, Legacy) | `300vxr` (alias `lc300`) | `car_300vxr` | — | ✅ installed |
| Audi RS6 Avant (HAMMER) | `avant` (alias `rs6`) | `car_avant` | — | ✅ installed |
| Chevy Colorado ZR2 ADD (HAMMER) | `ccadd` (alias `colorado`) | `car_ccadd` | — | ✅ installed |
| Lamborghini Reventon SCPD (Game68240) | `polrevent` (alias `reventon`) | `car_polrevent` | — | ✅ installed (police) |
| Mercedes-AMG GT R Police (SCRAT) | `polamggtr` (alias `amggtr`) | `car_polamggtr` | — | ✅ installed (police) |

**Custom engine-sound DLCs** (installed as their own `sound_` packs, pointed to via `audioNameHash`; all experimental — RAGE:MP may not load custom audio): `sound_s63b44` (BMW S63 V8 → M8, F90, M4 F82; M4 was `turismor`), `sound_mbnzc63eng` (Merc C63 → CLS, S-Class), `sound_npolchar` (Dodge Charger V8 → Demon), `sound_ars7` (Audi RS7 2021 sound → `23rs7` / `23rs7abt`, pack `car_abtrsr_rs7c8`), `sound_ars6c8avant` (Audi RS6 C8 Avant sound → `avant`/`rs6`, pack `car_avant`). The sixth sound pack is `sound_2015mustsound` (2015 Mustang). CLS was `SCHAFTER5`, S-Class `ZENTORNO`, Demon `btype2` before. The `audioNameHash` is the sound pack's **internal** name, not its folder name — renaming the folder to `sound_*` does not change the hash cars point at. If custom audio doesn't load, revert each car's `audioNameHash` to its stock name (for `sound_ars7`/`sound_ars6c8avant`, note the original hash in CodeWalker before changing it). The `sound_ars7`/`sound_ars6c8avant` pack still needs the car's `vehicles.meta` `<audioNameHash>` set in CodeWalker — the pack install only ships the audio.

### Editing car handling (admin panel → Cars tab)

The admin panel has a **Cars** tab (`/admin`) that lists every add-on car and edits its handling
(mass, drive force, brake, traction curves, traction/drive bias, low-speed loss, steering lock,
gears, top speed). Saving writes straight into the car's `dlc.rpf` (in-place, via
`packages/admin/carhandling.js`, OPEN packs only) — so **changes apply after a server restart +
client relaunch**, not live. Editing requires Admin Mode on. Values are clamped to sane ranges.

### Drift mode (NumLock toggle, all cars)

All cars (M8 included) use **stock handling**. Press **NumLock** while driving to toggle a runtime
slide via `SET_VEHICLE_REDUCE_GRIP` + `SET_VEHICLE_REDUCE_GRIP_LEVEL` (`DRIFT_GRIP_LEVEL`, lower =
grippier); press again for normal grip. Resets on exit. Note: this is a uniform grip cut, so it
can't improve corner turn-in — proper turn-in would need baked `handling.meta` (steering lock +
front bias), which can't be a runtime toggle in RAGE:MP. A manual gearbox isn't possible either
(no set-gear native; `SET_VEHICLE_HIGH_GEAR` is rejected as "Invalid native").

### Brand logos removed from the cars

The badge textures inside each car's `.ytd` were blanked (fully transparent) in place, so the brand emblems no longer
draw: BMW `badgea_diffuseaoso` (roundel / M4 / M Performance); RS7 (RmodCustoms) `audi-rs-7-210058`, `rs7png`, `rmod`;
RS7 + ABT `rs7_logo`, `abt`, `AUD_RS7_21_symbols_embossed_White` / `_OPAC`. Not removable this way: logos that are 3D
geometry in the model (e.g. chrome Audi rings), wheel centre caps, tyre sidewalls. The original packs are in git
(`git checkout -- client_packages/game_resources/dlcpacks/<pack>/dlc.rpf` restores one). The `dlc.rpf` files are
patched in place, so re-downloading a pack from its source brings the logos back.

## Map / interiors (no spawn — go to the location)

| Mod | Folder | Notes | Status |
|-----|--------|-------|--------|
| Ballas gang area | `map_gcom_ballas_gang` | Heavier **level pack** (own `replacement.rpf` + `EXTRACONTENT_LEVEL_PACK`, `isLevelPack=true`) — see `docs/10-adding-maps.md`. | ✅ installed |
| Mission Row PD interior | `map_mrpd` | Interior pack. | ✅ installed |
| St. Fiacre Hospital interior | `stfiacre` | Props-placement interior (base-game assets only, no custom models/`.ytyp`). Built as a level pack (`CONTENTS_DLC_MAP_DATA`) with `tools/rpf/build_map_dlc.py` — no manifest (only custom-archetype packs like `gcom_ballas_gang` need one). | ✅ installed |

## Source downloads (Windows)

- BMW: `C:\Users\torik\Downloads\de0382-BMW G82 M4 with Adro Kit HAMMER.rar` (use `Legacy/g82adro/dlc.rpf`)
- Audi RS7 + ABT: `C:\Users\torik\Downloads\312534-ABTRSR-2023 Audi RS7&ABT RS7-4【ADD-ON】.zip` (folder `abtrsr_rs7c8/dlc.rpf`)
- Audi RS7 Sportback: `C:\Users\torik\Downloads\dcdde3-RmodCustoms Audi RS7 Sportback 1.3.rar` (use `Manual Installation/dlc.rpf`)
- BMW M235i Gran Coupe: `C:\Users\torik\Downloads\2021-bmw-m235i-gran-coupe-v1-1_1719744062_308569.zip` (use `addon/M235iXD/dlc.rpf`)
- Dodge Demon: `C:\Users\torik\Downloads\47bb6d-demon.rar` (use `demon/dlc.rpf`; spawn `dcd`)
- BMW M8 Competition: `C:\Users\torik\Downloads\bmw-m8-competition-nike-off-white_1789572593_980757.rar` (use `mansm8c/dlc.rpf`)
- BMW M5 E39: `C:\Users\torik\Downloads\bmw-m5-e39-v1-1_1706609821_858151.rar` (use `bmwm5e39/dlc.rpf`)

## To finish install (once folders are owned by `torik`)

```bash
DLC=/opt/ragemp-srv/client_packages/game_resources/dlcpacks

# BMW: fix folder name
mv "$DLC/bmwm5" "$DLC/g82adro"

# Audi packs (extract dlc.rpf from the archives first, see 02-adding-vehicle-mods.md)
mkdir -p "$DLC/abtrsr_rs7c8" "$DLC/rmodrs7"
cp /tmp/audi/abt/abtrsr_rs7c8/dlc.rpf                                  "$DLC/abtrsr_rs7c8/dlc.rpf"
cp "/tmp/audi/rmod/RmodCustoms Audi RS7 Sportback 1.3/Manual Installation/dlc.rpf" "$DLC/rmodrs7/dlc.rpf"

sudo systemctl restart rageserv
# then FULLY relaunch the GTA client and reconnect
```

## Clothing packs (added 2026-10-01)

| Folder | Source | Contents |
|--------|--------|----------|
| `cloth_mpclothes` | `clothes.7z` → `mpclothes/dlc.rpf` | `mpclothes_male.rpf` (mp_m_freemode_01) |
| `cloth_mpclothes_f` | `clothes.7z` → `mpclothes/dlc1.rpf` (renamed) | `mpclothes_female.rpf` (mp_f_freemode_01) |

RAGE:MP loads one `dlc.rpf` per folder, so the archive's `dlc1.rpf` lives in its own folder.
The archive's `optional/*.ymt` files are not installed (they replace files inside the rpf).

### Upload times & "new" labels
`packages/clothing/dlc.js` records every pack in `dlcpacks/` with its upload time (`packages/clothing/data/dlc_registry.json`;
a size change counts as a re-upload). When a shop opens, the client reports each slot's drawable count; growth past the
last known count is stamped with the newest clothing pack for that gender (`data/clothing_new.json`). Drawables stamped
within 7 days (`NEW_DAYS`) show a "ახალი" badge in the shop, plus a per-category count. Admin command `/dlcs` lists packs,
dates and ranges. The base count comes from `ui/clothing/names.js` (slots without names, e.g. bags, start from the first report).

> **Both these data files are keyed by folder name** — `dlc_registry.json` keys and `clothing_new.json`
> `pack` fields. Renaming a clothing pack folder (e.g. `mpclothes` → `cloth_mpclothes`) requires
> rekeying both files, or the registry rebuilds from the new folder names on next start and re-triggers
> the 7-day "new" badges. (`packages/` is root-owned, so the migrated copies are applied via sudo.)

### Received but NOT installed — needs CodeWalker (pending)

A batch of ~20 MP **female** clothing mods was dropped in `C:\Users\torik\Downloads\Allmods`
(2026-10-06) but **not uploaded**. Reason: adding drawables to MP freemode requires rebuilding the
clothing variation **`.ymt`** (`mp_f_freemode_01_mp_f_clothes_01.ymt` inside `cloth_mpclothes_f`) to
register each new drawable per component, plus renumbering the heavy per-component collisions. The
Linux packer (`tools/rpf/pack_dlc.py`) packs `.ydd/.ytd` but cannot author that `.ymt`, so this needs
CodeWalker's clothing tool — which the owner opted to skip. Without the ymt the items never appear in
the shop, so none were added.

Pending mods (slot in parentheses — 3 torso / 4 legs / 6 shoes / 7 neck / 8 bodysuit / 9 back / 11 top):
Amenoma Kaguchi (7, has male too), B SKIRT (8), Bubbles outfit (8+11), Criss Cross Skirt (8+4+3),
Don't Care Bears Shirt (11), Dress with cut-outs (11), FairyWingsbyPinkRx (9), JuniaSet (8+11),
Nike sport set (11+4), Ribbed Romper (8), SP (8×2), TrueyFinal (4), ValentineDress (11),
VanillaBody (8+11), Vans Old Skool (6), [HMZ] Sporty Tennis Dress (11+4+3), cheerleader outfit (8+11),
mp_f_minidress (11), rinyata_mods (8+3).

Also in the batch: **Bones Sweater** (empty — no `.ydd/.ytd`, files missing) and **Moony Textures**
(texture-only alt skins for an `accs_000`, no model — needs pairing). Both skipped.

_Last updated: 2026-10-06._
