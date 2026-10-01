# Installed Mods

Folder = `client_packages/game_resources/dlcpacks/<folder>/dlc.rpf`.

## Vehicles — spawn with `/car <name>`

| Car | Spawn name | Folder | Liveries | Status |
|-----|-----------|--------|----------|--------|
| BMW M4 (G82 Adro Kit) | `g82adro` | `bmwm5` | none | ✅ installed (works despite folder≠name) |
| Audi RS7 (2023) | `23rs7` | `abtrsr_rs7c8` | none | ✅ installed |
| Audi RS7 ABT (2023) | `23rs7abt` | `abtrsr_rs7c8` (same pack) | none | ✅ installed |
| Audi RS7 Sportback (RmodCustoms) | `rmodrs7` | `rmodrs7` | ✅ yes | ✅ installed |
| BMW M235i Gran Coupe (F44) | `M235iXD` (alias `f44`) | `M235iXD` | none | ✅ installed |
| Dodge Challenger SRT Demon | `dcd` (alias `demon`) | `demon` | none | ✅ installed (folder≠name) |
| BMW M8 Competition (Mansory) | `mansm8c` (alias `m8`) | `mansm8c` | ✅ 7 | ✅ installed |
| BMW M5 E39 | `bmwm5e39` (alias `m5e39`) | `bmwm5e39` | none | ✅ installed |
| Mercedes-Benz E55 AMG | `benze55` | `benze55` | — | ❌ removed — crashed the client on spawn (incompatible/malformed model) |
| Mercedes-Benz CLS 6.3 AMG 2015 | `cls2015` (alias `cls`) | `cls2015` | — | ✅ installed (stock sound SCHAFTER5) |
| Audi R8 2020 (RsMods) | `r820` (alias `r8`) | `r820` | — | ✅ installed (stock sound XA21) |
| BMW M5 F90 Competition 2019 | `2019M5` (alias `f90`) | `2019M5` | — | ✅ installed (audio → `s63b44` S63 V8, experimental custom sound; was COMET2) |
| Mercedes-Benz S-Class 2027 (DAVKU) | `mercedessclass27` (alias `sclass`) | `mercedessclass27` | — | ✅ installed (audio → `mbnzc63eng`, experimental; was ZENTORNO) |
| 1969 Dodge Charger | `69charger` (alias `charger69`) | `69charger` | — | ✅ installed |
| Chevrolet Camaro Z/28 2015 | `15z28` (alias `z28`) | `15z28` | — | ✅ installed |
| Lexus LX570 2019 Black Edition | `lx57019mc` (alias `lx570`) | `lx57019mc` | — | ✅ installed |
| SWAT van | `swatvanr2` (alias `swatvan`) | `swatvanr2` | — | ✅ installed |
| LHP pack (4 vehicles) | `alamolhp`, `alamolhpslick`, `bufsxlhp`, `dnscoutlhp` | `lhp` | — | ✅ installed (spawn by exact name) |
| Lamborghini Fenomeno 2026 (DAVKU) | `fenomeno` | `fenomeno` | — | ✅ installed |
| Invetero Coquette D5 (SMC) | `coquette6c` (alias `d5`) | `coquette6c` | — | ✅ installed |
| yumi | `yumi` | `yumi` | — | ✅ installed |
| BMW M4 F82 (HAMMER, Legacy) | `m4f82` | `m4f82` | — | ✅ installed |
| Toyota Land Cruiser 300 VX.R (HAMMER, Legacy) | `300vxr` (alias `lc300`) | `300vxr` | — | ✅ installed |
| Audi RS6 Avant (HAMMER) | `avant` (alias `rs6`) | `avant` | — | ✅ installed |
| Chevy Colorado ZR2 ADD (HAMMER) | `ccadd` (alias `colorado`) | `ccadd` | — | ✅ installed |

**Custom engine-sound DLCs** (installed as their own packs, pointed to via `audioNameHash`; all experimental — RAGE:MP may not load custom audio): `s63b44` (BMW S63 V8 → M8, F90), `mbnzc63eng` (Merc C63 → CLS, S-Class), `npolchar` (Dodge Charger V8 → Demon). CLS was `SCHAFTER5`, S-Class `ZENTORNO`, Demon `btype2` before. If custom audio doesn't load, revert each car's `audioNameHash` to those stock names.

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
| None | — | No map/interior DLC mods are currently installed. | — |

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

_Last updated: 2026-09-28._
