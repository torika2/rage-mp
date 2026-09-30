# Installed Mods

Folder = `client_packages/game_resources/dlcpacks/<folder>/dlc.rpf`.

## Vehicles — spawn with `/car <name>`

| Car | Spawn name | Folder | Liveries | Status |
|-----|-----------|--------|----------|--------|
| BMW M4 (G82 Adro Kit) | `g82adro` | `bmwm5` | none | ✅ installed (works despite folder≠name) |
| Audi RS7 (2023) | `23rs7` | `abtrsr_rs7c8` | none | ✅ installed |
| Audi RS7 ABT (2023) | `23rs7abt` | `abtrsr_rs7c8` (same pack) | none | ✅ installed |
| Audi RS7 Sportback (RmodCustoms) | `rmodrs7` | `rmodrs7` | ✅ yes | ✅ installed |

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
