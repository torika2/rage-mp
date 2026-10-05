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
