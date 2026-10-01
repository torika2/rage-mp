# Tattoo salons

Six GTA tattoo parlours (blip sprite 75 + marker): Vinewood/Hawick, Vespucci Beach, El Burro Heights, Chumash,
Sandy Shores, Paleto Bay. Stand on the marker, press **E**.

- **Data:** every GTA Online `TYPE_TATTOO` overlay (967 male, 870 female; unisex ones count for both) from
  DurtyFree's `pedOverlayCollections.json`. Regenerate with `python3 tools/gen-tattoo-data.py` -> writes
  `packages/tattoo/data.json` (server) and `client_packages/ui/tattoo/data.js` (page). An item's id is its index in
  the gender's list, and saved tattoos store ids, so regenerating after a game update can shift them.
- **UI:** `client_packages/ui/tattoo/index.html` — six body zones, filter by collection, try on, cart (buy + remove).
  The preview strips clothing to the bare body and puts it back on close.
- **Server:** `packages/tattoo/index.js` re-prices every purchase (client prices are never trusted), charges money +
  government sales tax, saves to `packages/tattoo/tattoo.json` (per player, per model) and applies the set with
  `player.setDecoration` so everyone sees it. Re-applied on `playerReady` / `playerSpawn`.
- **Prices:** per zone — head $250, torso $350, arms/legs $200 each; removal $75. Max 120 owned, 40 per purchase.
  Edit `ZONE_PRICE` / `REMOVE_PRICE` in `packages/tattoo/index.js`.
- Crew badges (`TYPE_BADGE`) are not tattoos and are not included.
