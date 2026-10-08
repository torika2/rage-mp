# tools/rpf — pack/read GTA V `dlc.rpf` on Linux (no CodeWalker)

This server's dlcpacks use **OPEN (unencrypted) RPF7** archives (verified: `demon`,
`npolchar`, `gcom_ballas_gang` all start with `7FPR … OPEN`). OPEN archives have a
plaintext table-of-contents, so they can be built and read with plain Python — no
CodeWalker/OpenIV/Windows required.

## Pack a texture/model replace or add-on pack

```bash
python3 tools/rpf/pack_dlc.py <packname> <srcdir> client_packages/game_resources/dlcpacks/<packname>/dlc.rpf
```

- `<srcdir>` — a folder of GTA V **resource** files (`.ytd .ydd .ydr .yft .ybn …`,
  i.e. files that start with the `RSC7` magic). Non-resource files are skipped.
- Generates a minimal valid `setup2.xml` + `content.xml` (device `dlc_<packname>`,
  `order 50`, `GROUP_STARTUP`) and packs the resources flat.
- After building, add a `dlc_registry.json` entry (see any existing pack) and deploy:
  `sudo systemctl restart rageserv`, then reconnect the client.

## Pack a custom MAP (`.ymap`) into a streaming level pack

```bash
python3 tools/rpf/build_map_dlc.py <packname> <ymap_rsc7> \
  client_packages/game_resources/dlcpacks/<packname>/dlc.rpf [_manifest.ymf]
```

- Builds a **level pack** (`EXTRACONTENT_LEVEL_PACK`, map-streaming changeset,
  `custom_maps.rpf` with `CONTENTS_DLC_MAP_DATA`) — the wiring a `.ymap` needs to actually
  stream, unlike `pack_dlc.py`'s plain mount.
- The optional 4th arg packs a `_manifest.ymf` beside the ymap. **A map DLC will not render
  without that manifest, and it can only be generated in CodeWalker** (big-endian PSO resource).
- Full worked example and the start-to-finish recipe: [`docs/17-pillbox-hospital-interior.md`](../../docs/17-pillbox-hospital-interior.md).

## Inspect any archive

```bash
python3 tools/rpf/rpf.py ls  <dlc.rpf>          # list entries + encryption
python3 tools/rpf/rpf.py cat <dlc.rpf> <name>   # dump a file (xml inflates; resource prints flags)
```

## Limits

- Builds **OPEN** archives only (fine for this server). It does not do AES/NG encryption.
- Audio packs (`.rel/.dat/.awc`) need extra `content.xml` dataFile wiring — not handled.
- **Structural correctness is verified by round-trip, but whether the game actually
  mounts the DLC and overrides the target can only be confirmed in-game.** Always test.
