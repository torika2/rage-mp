# Build the "Gerald" (purple Ballas ped) DLC for RAGE:MP

**Mod:** "Gerald" by Troublesome96 — a texture re-skin of the GTA V ped **Gerald**
(model `ig_g`, cutscene variant `csb_g`) in Ballas purple.

**Why this step is manual:** these are loose `.ytd` texture dictionaries. RAGE:MP only
streams assets packed inside a `dlc.rpf`. Building an RPF7 archive requires
**CodeWalker on Windows** — it can't be done on the Linux server box.

The 4 source files are staged next to this file:

- `ig_g.ytd`    — Gerald body/clothes textures
- `ig_g_p.ytd`  — Gerald prop textures
- `csb_g.ytd`   — cutscene Gerald textures
- `csb_g_p.ytd` — cutscene Gerald prop textures

(`assembly.xml.reference` is the original OpenIV manifest, kept only for reference —
it shows the base-game archives these replace. We do NOT use OpenIV here.)

---

## Step 1 — Build `dlc.rpf` in CodeWalker (Windows)

1. Open **CodeWalker** → **Tools → RPF Explorer**.
2. **File → New → RPF7 Archive**. Name it `dlc.rpf`.
3. When asked about encryption, choose **OPEN** (unencrypted). RAGE:MP serves it as-is;
   OPEN is simplest and loads fine.
4. Drag the 4 `.ytd` files from `_mod_staging/gerald_ballas/` straight into the root of
   the new `dlc.rpf` (flat — no subfolders). RAGE:MP overrides base-game assets **by
   filename**, so `ig_g.ytd` / `csb_g.ytd` at the archive root is all that's needed to
   re-skin Gerald.
5. Save/close the archive so CodeWalker writes `dlc.rpf` to disk.

## Step 2 — Drop it into the server

Copy the finished `dlc.rpf` to:

```
client_packages/game_resources/dlcpacks/gcom_ballas_gerald/dlc.rpf
```

(Create the `gcom_ballas_gerald/` folder; the file must be named exactly `dlc.rpf`.)

## Step 3 — Register it

Add this entry to `packages/clothing/data/dlc_registry.json` inside `"packs": { ... }`
(put the real built file size in bytes — right-click the `dlc.rpf` → Properties):

```json
"gcom_ballas_gerald": {
 "addedAt": 1791216795359,
 "uploadedAt": 1791216795359,
 "size": <DLC_RPF_SIZE_IN_BYTES>,
 "clothing": false,
 "gender": null,
 "history": []
}
```

## Step 4 — Deploy

In a **real terminal** on the server:

```
sudo systemctl restart rageserv
```

Then fully relaunch/reconnect the client (RAGE:MP caches dlcpacks on connect).

## Step 5 — Verify in-game

Spawn/set a ped to model **`ig_g`** (Gerald). It should now appear in the purple
Ballas skin instead of the vanilla character.

---

## After it's built

Ping me and I'll do the server-side wiring: confirm the `dlc_registry.json` entry,
and hook model `ig_g` into the gang system (`packages/gangs/index.js`) so Ballas members
/ gang NPCs use the purple Gerald ped. See the gang config at
`packages/gangs/index.js` (`staticKey: 'greens'` = Ballas).
