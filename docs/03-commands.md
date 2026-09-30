# Commands & Keybinds

> **Localization:** all player-facing text (fuel UI, HUD, chat messages, command replies) is in **Georgian**.
> CEF UIs and RAGE:MP chat render Unicode fine. GTA's **native `drawText` does NOT support Georgian glyphs**,
> so any on-screen prompt must go through CEF (the "press E to refuel" prompt lives in the HUD browser for this
> reason). The map **blip name** uses the game font, which may not render Georgian — verify in-game.

## Server-side chat commands

Core freeroam commands are defined in `packages/freeroam/index.js`; police commands are in `packages/police/index.js`.

| Command | Effect |
|---------|--------|
| `/pos` | Show your current X/Y/Z coordinates and heading |
| `/car <name>` | Spawn a car and get in (destroys your previous car first). Clear names: `bmwm4`, `audirs7`, `audirs7abt`, `audirs7sport`; or any GTA model (`/car adder`) |
| `/cars` | List the clear add-on car names |
| `/fix` | Repair the car you're in |
| `/dv` | Delete your car |
| `/livery <n>` | Set livery `n` (classic livery + mod-kit slot 48). No effect on cars without liveries |
| `/arms <n>` | Try arms (component 3) `n` on the top you're wearing, to find the one that fits |
| `/cityhall [set\|tp\|reset <point>]` | **Admin.** List or move the City Hall points (`entrance`, `duty`, `desk`, `clerk`, `spawn`). `set` uses your current position and heading |
| `/houses` | **Anyone.** List every house for sale, nearest first (filter by price or name), with a **📍 GPS** waypoint button and a toggle that highlights all for-sale houses on the minimap |
| `/house <action>` | **Admin.** Manage houses for sale: `add <price> <interior\|walkin> [name]`, `interiors`, `itp`, … See [Houses](#houses-packageshouses-client_packagesuihouses) |
| `/armsfit <n> [texture]` | **Admin.** Save arms `n` for the top you're wearing (per male/female model, applies to everyone). `/armsfit reset` removes the override |

Example: `/car bmwm4`, `/car audirs7`, `/car audirs7sport`, `/car adder`.

### Adding a new command (pattern)

```js
mp.events.addCommand('name', (player, _, arg) => {
    if (!player.vehicle) return player.outputChatBox('You are not in a car.');
    // ... do something with player / player.vehicle ...
    player.outputChatBox('done');
});
```

The 2nd callback arg (`_`) is the full raw text; the 3rd+ are the split arguments.

## Client-side features (`client_packages/index.js`)

All native/client behaviour lives here. Tunable constants are in the `CFG` object at the top.

### Keybinds

| Key | Effect |
|-----|--------|
| `2` | Toggle engine. Anti-spam 1s cooldown. **Off only allowed while stopped**; blocked when out of fuel |
| `J` | Seatbelt on/off (ped flag 32) |
| `L` | Close all vehicle doors |
| `H` | Vehicle lights on/off |
| `E` | Refuel at a pump; on foot, open the shop / clothing store / barber shop / ATM you're standing at |
| `G` | Open the vehicle controls menu inside a car, or while aiming at your nearby spawned car |
| `I` | Open or close the Georgian inventory panel |
| `T` | Open chat. While typing, movement/keybinds are frozen |
| `TAB` | While typing, cycle chat channel (Local → Team → Global) |

The inventory panel closes with **Escape** or its close button. Its equipment,
personal, backpack, and vehicle slots are currently an empty UI shell; item
transfer, vehicle access rules, and persistence are not connected yet.

The vehicle controls menu also closes with **Escape** or its close button. It
exposes the existing engine, light, seatbelt, and door-close controls. On foot,
it only opens for your own empty spawned car within five metres; seatbelt is
available only while seated.

> Keybinds and movement are disabled while the chat input is open, so typing letters no longer
> triggers actions or walking. Handled by a `chatting` flag + `disableAllControlActions` in the render loop.

### Chat channels (`packages/chat`)

Native chat is used for input; the server routes each message by the sender's current channel
(switch with **TAB** while typing; the HUD shows the active channel):

| Channel | Who sees it |
|---------|-------------|
| **Local** (`ლოკ.`) | players within **25 m**, same dimension |
| **Team** (`გუნდი`) | on-duty police — only available while on duty |
| **Global** (`გლობ.`) | everyone |

Commands (`/veh`, `/money`, …) are unaffected — they never go through chat routing.

### Radio
- On entering any car the radio is forced **OFF** (`setVehicleRadioEnabled(false)` + station `OFF`).

### Speedometer HUD (CEF, `client_packages/ui/hud/index.html`)
- Amber-themed browser overlay: money chip (top-right) + speedo (bottom-right) with **km/h**, **gear**
  (`N` when neutral), **RPM** bar, **engine** ●ON/○OFF, **fuel** bar+%.
- Always loaded; the client pushes data at `CFG.hudHz` (default 20/sec). Speedo fades in only while in a vehicle.
- Gas-station pumps also get an **amber 3D ground ring** marker (not just a map blip).

### Fuel system (client-side)
- Each vehicle starts with a full tank (`CFG.fuelMax`, default 100).
- Drains while the engine is on: `fuelIdleDrain` + `fuelDriveDrain × rpm` per second.
- At **0%** the engine stalls and won't restart until refuelled.
- **Refuel:** gas-station pumps are blipped on the map. Drive to one, **stop, turn the engine off (`2`)**,
  then **press `E`** to open the **CEF fuel-station UI** (`client_packages/ui/fuel/index.html`): pick an
  octane, drag the slider or use 25%/50%/Fill, and click **Buy** (or Enter). `Esc`/Cancel closes it.
  The purchase is charged **server-side** (`fuel:buy` → `fuel:confirm`/`fuel:deny`).
- **Octane tiers** (`OCTANES` in `index.js`) — 4 grades, good→track-spec:
  - **power** via `setEnginePowerMultiplier` (applied on enter/refuel): Regular ×1.00 baseline, Plus ×1.08,
    Premium ×1.18, Super 100 ×1.48. The native ignores values <1, so Regular is the floor.
  - **speedRate** sets the estimated maximum-speed cap: Regular ×1.00, Plus ×1.08, Premium ×1.18,
    Super 100 ×1.48. The cap is scaled from each vehicle's base speed.
  - **eff** (burn rate): Regular 1.15 (shortest range) → Super 100 0.75 (longest range).
  - **price** rises with grade so cost-per-distance climbs (2.65 → 4.13): cheap = budget, Super = performance.
  - **blending:** refuelling mixes the new grade into what's already in the tank by volume (power/eff/speedRate/rating
    become the weighted average) — adding a splash of a lower grade to a full tank barely changes it. The HUD
    shows the blended rating (e.g. `46% · 94`).
  - **"Empty tank first" toggle** in the pump UI: dumps the current fuel (lost, no refund) and fills the pure
    new grade — an instant clean grade-switch at the cost of the discarded fuel. Off = blend (default).
  - The tank remembers its grade; the HUD fuel line shows it (e.g. `46% · 91`).
- Tune in `CFG`: `fuelIdleDrain`, `fuelDriveDrain`, `refuelRange`, `lowFuelWarn`.
- ⚠️ Fuel is tracked **client-side per session** (resets on relog). Fine for freeroam; if you later
  want it persistent/synced across players, we move fuel state to the server.

### Engine toggle implementation

```js
// client_packages/index.js
mp.keys.bind(0x32, false, () => {          // 0x32 = "2"; false = fire on key release
    const veh = mp.players.local.vehicle;
    if (!veh) return;
    const running = veh.getIsEngineRunning() === true;   // null while entering/exiting
    if (running) veh.setEngineOn(false, true, true);      // off, instant, disableAutoStart
    else         veh.setEngineOn(true,  true, false);     // on, instant, normal
});
```

Why client-side: `SET_VEHICLE_ENGINE_ON`'s 3rd arg (`disableAutoStart`) is required to keep the
engine off while driving, and engine state is a client native — the server can't do it reliably.

> After editing `client_packages/index.js`: restart the server, then **reconnect**
> (a client *script* reloads on reconnect; unlike a `dlc.rpf`, it doesn't need a full GTA relaunch).

### Virtual key codes (common ones)

`1`–`0` = `0x31`–`0x30`, `F1`–`F12` = `0x70`–`0x7B`, `E` = `0x45`, `G` = `0x47`,
`X` = `0x58`, `LCTRL` = `0xA2`, `LSHIFT` = `0xA0`.


### Houses (`packages/houses`, `client_packages/ui/houses/`)

Only **admins** can add houses. A house is a door point on the map plus an **interior**:

- **Base-game interiors (almost every house):** press **E** at the door and **Enter**, and you're
  teleported into a built-in GTA interior, like GTA Online. Each house gets its own private copy
  (dimension `100000 + id`), so any number of houses can use the same interior. **E** at the entry
  point inside takes you back out to the door.
- **`walkin`:** the real map door is locked/unlocked on every client. It only works where the
  interior really exists on the map (a few base-game houses, or a map mod/MLO).

**Interiors** (`/house interiors` lists them):

| Key | Interior |
|-----|----------|
| `low`, `mid` | Low-end / mid-end apartment |
| `richards`, `tinsel` | Richards Majestic Apt 2, Tinsel Towers Apt 12 |
| `wild_oats`, `conker_2044`, `conker_2045`, `hillcrest_2862`, `hillcrest_2868`, `hillcrest_2874`, `whispymound`, `mad_wayne` | GTA Online hillside houses |
| `eclipse_modern`, `_moody`, `_vibrant`, `_sharp`, `_monochrome`, `_seductive`, `_regal`, `_aqua` | Eclipse Towers penthouse styles. The client loads the chosen style's IPL and unloads the others |

The coordinates come from community data and haven't all been checked in-game. **Verify** each
with `/house itp <key>`. If you land in the wrong spot, walk to the right entry point and run
`/house addinterior <key>` to save your position over it (`/house delinterior <key>` restores the
default). The same command adds brand-new interiors: `/house addinterior myflat My Flat`.

**Adding a house (admin):**
1. Stand at the front door, facing it, and run `/house add <price> <interior> [name]`, e.g.
   `/house add 250000 hillcrest_2874 Vinewood Villa`. For `walkin`, look straight at the real door.
2. Optional extras (use the id from step 1):
   - **Chest:** go inside and run `/house setchest <id>`.
   - **Garage:** park your car where the garage should be, then `/house setgarage <id>`.
   - **Custom spawn:** `/house setspawn <id>`. By default, owners wake up inside their interior.

Other commands: `/house list`, `info <id>`, `tp <id>`, `price <id> <n>`, `name <id> <text>`,
`setinterior <id> <interior|walkin>`, `setdoor <id>` (walk-in), `evict <id>` (back on the market:
chest emptied, a parked car is put back outside), and `remove <id>` (for-sale houses only).
`remove`, `evict` and `info` also work **without an id** while you stand in the house's door circle.

**Every house on the map (344):** on first start, the server puts a house up for sale at every
residential **mailbox** in GTA (almost every house has one out front). Walk to a house's mailbox
and press **E** to view or buy it. Each house gets a **random interior and price from its area**:

| Area | Houses | Interiors | Price |
|------|--------|-----------|-------|
| Vinewood Hills, Rockford/Richman, Pacific Bluffs | 152 | hillside villas + Eclipse Towers penthouse styles | $250k–$650k |
| Mirror Park, Vespucci, Little Seoul, Chumash … | 104 | mostly mid-end, some Richards/Tinsel/low | $90k–$180k |
| South LS, Sandy Shores, Grapeseed, Paleto | 88 | mostly low-end, some mid | $40k–$80k |

The list is generated by `tools/gen-house-data.py` from DurtyFree/gta-v-data-dumps
(`worldLetterBoxes.json`) with a fixed random seed, and written to
`packages/houses/data/world_houses.json`. It's imported **once** (`worldImport: 2` in `houses.json`). Version 2 also topped up servers where
the first import had wrongly skipped neighbouring houses: it adds only the missing ones.
Houses within 20 m of an existing house or building entrance are skipped. After import, each is a
normal house: `/house setinterior`, `price`, `movedoor` or `remove` it like any other. Map
blips: green = for sale, blue = yours, small grey = sold. Buy, lock and sell send only that one
house to players (`houses:update`), not the whole list.

**Apartment buildings:** one entrance with several units, each a normal house sharing that door
point (same features, own private interior copy). **E** at the entrance lists the units with price
and status, and picking one opens its panel (View / Buy / Enter …, with ← back). The map shows one
apartment blip per building: green if units are for sale, blue if you own one.

Seeded automatically on first start (coordinates from community data; fix an entrance by standing
at the right spot and running `/house movedoor <any unit id>`):

| Building | Units | Price | Interior |
|----------|-------|-------|----------|
| 4 Integrity Way | 6 | $150,000 | `mid` |
| Del Perro Heights | 6 | $140,000 | `mid` |
| Tinsel Towers | 4 | $170,000 | `mid` |
| Richards Majestic | 4 | $130,000 | `mid` |
| Eclipse Towers | 4 | $90,000 | `low` |

Admin: `/house building <key> <units> <price> <interior> [name]` at an entrance (e.g.
`/house building dream 4 60000 low Dream Tower`), `/house addunit <key> <price> [interior]`, and
`/house movedoor [id]` (moves a whole building's entrance). Change one unit's price or interior
with `/house price <id>` or `/house setinterior <id>`. At a building entrance, `/house info` lists
the units, and `/house remove` (no id) deletes the whole building, but only if no unit is owned
(use `/house evict <id>` first). Removed seed buildings don't come back.

**Players** (press **E**; green house blip = for sale, blue = yours):
- **Door:** for sale, it shows the price, the interior name, **View** (go inside to look) and
  **Buy**. The price goes to the government treasury, and each player can own **1** house.
- **Owner at the door:** Enter, lock/unlock (locked = only the owner can enter, enforced by the
  server), toggle spawn at home, and sell back for **60%** of the price (paid from the treasury;
  refused if the treasury can't cover it). Selling requires an empty chest and no car in the garage.
- **Chest** (yellow marker): move items between inventory and chest, up to 40 item types. A weapon
  in hand must be put away first.
- **Garage** (blue circle): drive your personal car in and press **E** to park it. On foot, **E**
  takes it out. It uses the one persistent personal car (`packages/vehicles`), so spawning a new
  car with `/car` replaces the parked one.
- **Spawn at home:** owners wake up inside their house on join and after respawn, unless they're
  an on-duty official (City Hall wins). Anyone who dies inside a house respawns in the normal world.

Data: `packages/houses/houses.json`, including custom interiors. For `walkin` houses the door lock
is client-side, so a modified client could open it. Interior houses, chests and garages are
server-checked.

### In-world text and Georgian

GTA's own fonts (on-screen `drawText` prompts, 3D name labels) have **no Georgian glyphs**, so
Georgian drawn with them shows as □□□. In-world prompts and labels are therefore in English.
Names that come from data (house/building names, Demorgan reasons) go through `worldText()` in
`client_packages/index.js`, which transliterates Georgian to Latin (e.g. "სახლი #12" →
"sakhli #12"). CEF pages (panels, chat, HUD) render Georgian normally.

### City Hall (`packages/cityhall`, `client_packages/ui/cityhall/`)

Rockford Hills City Hall is the government building: blip (sprite 419) and a marker at the front
doors. The base game has **no interior**, so the points start in the front courtyard. Once a City
Hall MLO is installed (see [10-adding-maps.md](10-adding-maps.md)), walk to each spot inside and
run `/cityhall set <point>`. Points are saved to `packages/cityhall/cityhall.json` and sent live
to everyone.

| Point | What it does (press **E**) |
|-------|----------------------------|
| `duty` | Government officials go on/off duty. `/gduty` also only works here (admins: anywhere) |
| `desk` | Cashier NPC (`a_f_y_business_01`): the sales-tax rate and your **unpaid fines**, with pay-one / pay-all |
| `clerk` | ID-card clerk NPC (`a_f_y_business_02`): issue or renew a **პირადობის მოწმობა** for $200 (to the treasury) |
| `licenses` | License office NPC (`a_m_y_business_02`): driving B $500, motorcycle A $400, truck C $1,200, boat $800, pilot $5,000, hunting $300, business $10,000 |
| `weapons` | Weapon-permit NPC (`s_m_y_cop_01`): **weapon permit** $2,500. Refused with unpaid fines, in jail or in Demorgan |
| `spawn` | Where **on-duty** officials respawn after death |
| `entrance` | Blip + marker only |

- **NPCs:** every counter has an NPC with its name floating above it (in English, because GTA's
  in-world font has no Georgian letters). NPCs are snapped to the ground on each client.
  - **Placing them:** stand where the middle of the counter row should be, **facing the way the
    NPCs should face** (towards where players arrive), and run **`/cityhall arrange`**. The ID
    clerk, license office, weapon permit, cashier and the duty point line up across you, 3.8 m
    apart (the interaction range is 3 m, so keep them at least 3.5 m apart when moving one).
  - **Fine-tuning:** `/cityhall set <clerk|licenses|weapons|desk|duty>` moves a single one.
  - **Defaults:** the built-in spots are estimates and may fall inside the building. Run
    `/cityhall arrange` once on the open plaza in front of the doors.
- **Licenses:** every license needs an **ID card** first, and all fees go to the treasury.
  Licenses are listed on the ID card whenever it's shown. `/licenses` shows your own. On-duty
  police, on-duty officials and admins can use `/licenses <id>` to check another player, and
  on-duty police and admins can use `/revokelicense <id> <type>` to take one away. They're stored
  in `packages/cityhall/ids.json` → `licenses`.
- **Weapon permit at Ammu-Nation:** firearms and their ammo need the permit (law #4); melee
  weapons and armour don't. Turn this off with `REQUIRE_WEAPON_PERMIT` in
  `packages/shops/index.js`.
- **Fines:** `/fine` still takes what the player has on the spot. The remainder is now recorded in
  `government.json` → `unpaidFines`, instead of being forgiven, and is paid at the desk.
- **ID card:** first name, last name (2–20 Georgian/Latin letters) and date of birth (age
  16–100). Sex comes from the character model. You get the inventory item `idcard_<number>`
  (🪪). Using it shows the card to you and everyone within 3 m for 8 seconds, and it isn't used
  up. Renewing keeps the number `GE-000001…` and replaces the old card. Cards are stored in
  `packages/cityhall/ids.json`.

### Clothing store (`packages/clothing`, `client_packages/ui/clothing/index.html`)

- **Every item in the game:** each category lists every drawable the ped model has, counted at
  runtime, so all GTA Online/DLC clothing installed on the client is included. Drawables and
  textures that `IS_PED_COMPONENT_VARIATION_VALID` rejects (empty placeholder slots that render
  invisible or checkerboard) are skipped, and only real textures appear as swatches. Props have no
  validity native, so every counted prop texture is offered.
- **Categories:** tops, undershirts, pants, shoes, bags, masks, accessories (neck), decals/badges
  (component 10), hats, glasses, earrings (prop 2), watches and bracelets. Body armour
  (component 9) belongs to the inventory vest, and arms (component 3) are set automatically.
- **GTA Online names:** `client_packages/ui/clothing/names.js` has the shop names for each drawable
  and texture (e.g. "Tan Leather Fur Jacket"), shown in the picker, swatch tooltips and cart.
  Items without a GTA Online label (bags, decals, some base-game items) show as "მოდელი #N".
- **Matching arms (no clipping):** when a top is previewed or worn, arms (component 3) come from
  `packages/clothing/data/besttorso.json`, which is GTA's shop data per model, top and texture.
  About 85% of tops are covered. The rest are mostly base-game tops 0–15, whose arms the game
  hardcodes in scripts; they fall back to arms 0 until an admin fixes them in-game: wear the top,
  find the right arms with `/arms <n>`, then save them with `/armsfit <n>`. Overrides are stored in
  `packages/clothing/data/torso_overrides.json`.
- **Regenerating the data** after a GTA/DLC update: `python3 tools/gen-clothing-data.py`. It
  downloads root-cause/v-clothingnames and root-cause/v-besttorso from GitHub and rewrites both
  files.

### Barber shops (`packages/barber`, `client_packages/ui/barber/index.html`)

All 7 GTA barber shops have a blip (scissors, sprite 71) and a cyan ground marker: Bob Mulét
(Rockford Hills), Herr Kutz (Davis, Mirror Park, Paleto Bay), Beach Combover (Vespucci),
O'Sheas (Sandy Shores), Hair on Hawick. Press **E** at the marker to open the salon menu.

- **Menu:** same layout as the clothing store. Categories are on the left: Hairstyle, Hair colour,
  Highlight, Beard, Beard colour (both male only), Eyebrows, Eyebrow colour and Eye colour, each
  with its price. The picker is on the right, with ‹ › and the arrow keys plus the named list or
  colour palette. **＋ Add to cart** queues the change, **თავდაპირველი** puts that part back to
  what you have now, and the cart has × per line and a checkout button. Checkout buys only what is
  in the cart.
- **Lists** (`client_packages/index.js`), all in GTA Online names and order:
  - `GTAO_HAIR`: 38 male and 40 female hairstyles, filtered to the drawables the ped has. Newer DLC
    drawables are added as "სტილი #N". The placeholders (male 23 / female 24) and the fade
    duplicates aren't offered.
  - `GTAO_BEARDS`: 29 styles (head overlay 1), plus "არცერთი".
  - `GTAO_EYEBROWS`: 34 styles (overlay 2), plus "არცერთი".
  - `GTAO_EYES`: 32 eye colours.
  - Hair, beard and eyebrow colours use the 64 GTA hair tints.
- **Head blend (important):** GTA only draws hair tint and head overlays (beard, eyebrows) on a
  ped that has head blend data. With no character creator on the server, `packages/barber` gives
  **every** freemode player `DEFAULT_BLEND` on spawn: Benjamin (0) for male, Hannah (21) for
  female. It also applies their saved look, or the defaults: no beard, "Balanced" eyebrows and
  green eyes. A future character creator should replace `DEFAULT_BLEND` with a per-player blend.
- **Preview:** local only. The player is moved to the same dressing spot as the clothing store,
  the camera frames the head, and dragging spins the ped. Closing without paying restores the old
  look and teleports the player back.
- **Price** (server-side, only what changed): style $80, hair colour $40, highlight $30, beard $60,
  beard colour $25, eyebrows $40, eyebrow colour $20, eye colour $50. Government sales tax is
  added and goes to the treasury. Change `PRICES` in `packages/barber/index.js`.
- **Authority:** the server range-checks on E and then opens a 15-minute checkout session,
  because the preview happens away from the salon. Checkout sends the full look as JSON. The
  server validates every field (and allows no beard on female peds), re-prices it, charges, and
  applies it with `setHeadBlend`, `setClothes(2)`, `setHairColor`, `setHeadOverlay` and
  `eyeColor`, which sync to everyone.
- **Persistence:** `packages/barber/barber.json`, keyed by Social Club, with one look per freemode
  model (`m`/`f`). Older hair-only saves are upgraded with defaults. The look is re-applied on
  spawn/rejoin and after a Director model change. Custom (non-freemode) models can't use the salon.

### Escape behavior

Escape closes the active gas-station, vehicle, inventory, or admin interface,
or exits the built-in chat input, before allowing gameplay controls through. A left mouse click also
closes the built-in chat input. Pause/map controls are suppressed in all control groups while chat or a CEF
interface is active and for 1.5 seconds after an interaction closes. This
suppression is armed before the client destroys the UI, so Escape cannot fall
through and open the map. Native chat activation and the in-game chat control
are also disabled while a CEF menu is open, so pressing T cannot open chat over
the admin, fuel, inventory, or vehicle interface.

## Police job

Police ranks, authority, duty, cuffs/arrests, timed jail, and management commands are documented in [07-police-system.md](07-police-system.md). Police commands are defined in `packages/police/index.js`; roster and jail configuration persist in `packages/police/police.json`.

## Admin flight

`/fly` or the **N** key toggles flight for the allowlisted Social Club account `SEPHIGR`
while **Admin Mode** is on. The server re-checks admin mode, so N does nothing
otherwise. WASD moves, Space rises and Ctrl descends. Speed is 60 m/s normally,
250 m/s with **Shift**, and 10 m/s with **Alt** for precise positioning (see
`speed` in the fly render loop in `client_packages/index.js`). While flying, the
admin is invisible to other clients and invincible. These effects are restored
when flight ends or the admin dies. Toggle with **N**, `/fly`, or the `/admin`
panel. Flight ends on death or when toggled off.

## Admin panel

F8 or `/admin` toggles the server admin panel for `SEPHIGR`. The panel captures
game input while open. Turn **Admin Mode** on in the panel to enable privileged
actions; turning it off disables them and stops flight. See
[09-admin-panel.md](09-admin-panel.md) for actions and safety behavior.
