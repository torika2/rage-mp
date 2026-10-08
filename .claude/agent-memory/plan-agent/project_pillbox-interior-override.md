---
name: pillbox-interior-override
description: Ongoing effort to render a custom Pillbox hospital MLO interior edit as a map DLC on this RAGE:MP server; override of stock v_int_40/rc12b_default has had zero in-game effect.
metadata:
  type: project
---

Goal: render a CodeWalker-edited Pillbox Hill Medical Center **MLO interior** (`v_int_40.ytyp` + override of stock `rc12b_default.ymap`) in-game, shipped as map DLC `pillbox_rescue`. As of 2026-10-07 the pack has ZERO visible effect — hospital still renders stock after many deploy/cache cycles.

**Why:** owner wants a custom hospital interior; server-side `mp.objects.new` is a proven dead end (interior furniture are MLO-baked archetypes, render as trash bags). Map DLC is the only route.

**How to apply:** The one map pack that renders on this server is `gcom_ballas_gang`, and it is an ADD (brand-new `ballas1756` ymap). The pillbox attempt is an OVERRIDE of an already-loaded base MLO — a harder case. Key structural divergence found 2026-10-07: Ballas puts its inner RPF at a FLAT `x64/replacement.rpf` (uncompressed, size field 0) with `_manifest.ymf`+ymap+ytyp+models all at the inner root; our `tools/rpf/build_map_dlc.py` instead nests at `x64/levels/gta5/_citye/maps/custom_maps.rpf` (deflated). Mirroring Ballas's exact layout is the top-value fix. See [[ballas-is-reference-map-pack]].

Confirmed facts: pack identity correct (folder=nameHash=pillbox_rescue, type EXTRACONTENT_LEVEL_PACK, order 2, isLevelPack true, content.xml declares inner rpf twice: RPF_FILE + CONTENTS_DLC_MAP_DATA, STREAMING_MAP changeset, `$level=MO_JIM_L11`). `interiors.js` currently has NO hospital/RC12B/v_int_40 IPLs in REQUEST_IPLS or REMOVE_IPLS (stripped per docs/17). CodeWalker output lives at CodeWalker-Tryings/Hospital/ (`_manifest.ymf` 772B, `rc12b_default.ymap`, `v_int_40.ytyp`). Client cache encrypted (can't md5-verify build); match by byte size at /mnt/c/RAGEMP/client_resources/<serverhash>/.
