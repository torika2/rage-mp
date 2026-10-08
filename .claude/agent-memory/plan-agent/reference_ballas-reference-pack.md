---
name: ballas-is-reference-map-pack
description: gcom_ballas_gang is the only map DLC confirmed to render in-game on this RAGE:MP server; use its exact RPF layout as the template for any new map pack.
metadata:
  type: reference
---

`client_packages/game_resources/dlcpacks/gcom_ballas_gang/dlc.rpf` is the ONLY map DLC the owner has confirmed renders in-game on this server. Treat it as the authoritative layout template for new map packs.

Its verified structure (read via `tools/rpf/rpf.py`, 2026-10-07):
- Outer dlc.rpf (OPEN): content.xml, setup2.xml, `x64/` dir, and a single FLAT `replacement.rpf` at the x64 root (stored UNCOMPRESSED — outer size field 0, uncompressed length ~10MB).
- content.xml declares `dlc_ballas_free:/%PLATFORM%/replacement.rpf` TWICE (plain RPF_FILE + CONTENTS_DLC_MAP_DATA), enabled by `CCS_ballas_free_SP_NG_STREAMING_MAP` with `$level=MO_JIM_L11`.
- Inner replacement.rpf (OPEN, 15 entries, flat root): `_manifest.ymf` (bin), `ballas1756.ymap`/.ytyp/.ydr/_col.ybn, plus support models and `lr_sc1_occl_00.ymap`. No `levels/gta5/_citye/maps/custom_maps.rpf` nesting.
- Identity: folder `gcom_ballas_gang`, deviceName `dlc_ballas_free`, nameHash `ballas_free` (folder != nameHash and still works).
- Ballas is an ADD (new ymap `ballas1756`), not an override of a stock map.

Related: [[pillbox-interior-override]].
