# Parking

How the parking system works, end to end, so changes don't require re-reading the code every time.

- **Server:** `packages/parking/index.js` (rentals, spots, money, car spawn/recall),
  `packages/phone/index.js` (parking-finder bridge).
- **Client:** `client_packages/index.js` — the parking block starts at the comment
  `---------- Parking spots ...` (≈ line 196) and the admin editor keybinds right after it.
- **UI:** `client_packages/ui/parking/index.html` (the rent/park panel), and the **Parking** app
  inside `client_packages/ui/phone/index.html` (the finder).
- **Persistence:** `packages/parking/parking.json` (spots + rentals), written atomically
  (`.tmp` + rename).

---

## 1. The big picture

A parking spot is a **rentable personal garage point**. A player stands on a numbered spot, presses
**E**, and a panel opens where they can:

- **Rent** the spot for N days (price scales with how many cars they own).
- **Spawn** any car they own onto the spot, for **free**.
- **Recall** a car that is already out in the world to the spot, for a **fee** ($1000).
- **Store** (put away) a car sitting on the spot, for free.
- **Renew** their rental for more days.

**Nothing about the car is stored on the spot.** The canonical fleet is the MySQL `vehicles` table
(what `/mycars` lists). Parking only ever spawns/despawns those DB-backed cars. So even if a rental
lapses, the cars still exist and stay respawnable.

**One rental per player.** Renting a new spot auto-releases the player's previous one.

---

## 2. Spots: where they come from

There are **no hardcoded lots** anymore (`LOTS = []`). Every spot is **admin-placed** and stored in
`parking.json` under `customSpots`. Each spot definition is:

```json
{ "id": "Parking#7", "x": 425.96, "y": -1297, "z": 29.266,
  "h": 143, "rx": 0, "ry": 0, "price": 50, "w": 2.6, "l": 5.2 }
```

| Field | Meaning |
|-------|---------|
| `id` | Unique label, auto-generated as `Parking#1`, `Parking#2`, … (legacy ids like `P1` also exist). |
| `x,y,z` | Ground-level position. `z` is drawn WYSIWYG so height edits persist. |
| `h` | Heading (yaw) — the direction a spawned/recalled car faces. |
| `rx,ry` | Pitch / roll of the footprint rectangle (for sloped ground), clamped ±45°. |
| `w,l` | Width / length of the car-sized footprint in metres. Default 2.6 × 5.2. |
| `price` | Cost **per day** (before multipliers). |

**Rentals** live separately under `spots` in the same file, keyed by spot id:

```json
"P1": { "owner": "SephiGR", "ownerName": "KenSephi", "expiresAt": 1792509042160 }
```

`owner` is the player's stable key (`socialClub`, else name, else `id<n>`). `expiresAt` is an epoch-ms
timestamp. A rental is "active" only while `expiresAt > Date.now()`.

---

## 3. Visuals (client render loop)

The server pushes the full spot list to each client via `parking:spots` (a JSON array), on
`playerReady` (3 s delay) and whenever anything changes (`broadcastSpots()` → `global.parkingBroadcast`).
Each client then, every frame (within `PARK_DRAW_DIST` = 60 m):

- Draws the footprint rectangle as two triangles:
  **blue = free**, **red = rented**, **yellow = currently being edited**.
- Shows the spot's id text only when close (`PARK_LABEL_DIST` = 6 m).
- Tracks `parkNearby` = the spot the player is standing inside (with a 0.4 m margin).

Georgian text can't render through GTA's native `drawText`, so the **"press E"** prompt and the editor
help line are pushed to the CEF HUD instead (`parkHudPrompt` / `parkHudEdit`, flushed in the HUD payload
at the bottom of the file).

**Per-spot map blips were removed.** Only a couple of fixed **garage markers** show on the map
(`GARAGE_BLIPS` in the server file) — labelled "დიდი პარკინგი". Individual spots are only visible as the
drawn footprints.

---

## 4. The rent/park panel (E on a spot)

Pressing **E** while `parkNearby` is set and no other modal is open calls `openParkingUI()`
(`client_packages/index.js:3406`), which opens `ui/parking/index.html` and shows the cursor.

Data flow:

1. UI loads → fires `parking:ui:ready` → client calls remote `parking:uiData`.
2. Server builds a context object in `uiDataFor()` and calls back `parking:ui:data`.
3. UI buttons fire `parking:ui:rent` / `renew` / `summonOwned` / `recall` / `store` / `delete` / `edit`,
   which the client relays to the matching server remote with `currentParkSpotId`.
4. After every action the server re-sends fresh `parking:ui:data` with a `message` + `ok` flag.

The context object (`uiDataFor`) includes: `status` (`free` / `mine` / `taken`), `price`, `carCount`,
`maxDays` (30), `recallFee`, `activeOnSpot` (is the player's live car physically on this spot → can be
stored for free), the player's `money`, `isAdmin`, `editable` (true only for admin-placed spots), and
`ownedCars[]` — each car's `id`, `label`, `plate`, `fuel`, and `status` (`active` / `garage` / `available`).

---

## 5. The actions (server-authoritative)

All live in `packages/parking/index.js` and each returns `{ ok, msg }`. They're shared between the CEF
UI and the fallback chat commands, and every one re-checks range and ownership server-side.

| Action | Fn | Rules |
|--------|-----|-------|
| **Rent** | `doRent` | Must stand within `SPOT_RANGE` (4.5 m). Spot must be free. `cost = price × carCount × days`. Auto-frees the player's previous spot. Re-checks occupancy after the async car-count load (race guard). |
| **Renew** | `doRenew` | Must own a spot and be standing at it. Adds `days × DAY_MS` to `expiresAt`. Same price formula. |
| **Spawn owned** | `doSpawnOwned` | Free. Spawns a DB car at the spot via `global.carshopSpawnOwnedCar`. Guards: already spawned, car in a house garage, spot physically occupied (`spotIsOccupied`, 2.3 m), `ownedVehicleSpawnInProgress` re-entry lock. |
| **Recall** | `doRecall` | Fee `RECALL_FEE` ($1000). Teleports `player.myCar` to the spot + heading, then `global.vehPersist`. |
| **Store** | `doStoreCar` | Free. Car must be on the spot. Persists live fuel/km/pos to DB (`global.vehSaveActiveToDb`), stops local persistence (`global.vehForget`), despawns, clears `myCar`/`activeVehId`. |

**Price formula is the key tuning knob:** `spot.price × car_quantity × days`. `car_quantity` is the
player's whole fleet size (min 1), loaded from the vehicles API. This means the more cars you own, the
more every spot costs you per day.

**External dependencies** (all via `global.*`, so parking degrades gracefully if a system is missing):
`getMoney`/`setMoney` (economy), `carshopSpawnOwnedCar` + `carshopLabelOf` (carshop), `vehPersist` /
`vehForget` / `vehSaveActiveToDb` / `vehGarageCar` (vehicles), `api.loadVehicles` (backend), and
`chatLocalAction` (nearby RP lines).

---

## 6. Chat commands (fallback)

The CEF panel is the main path; these still work:

| Command | Does |
|---------|------|
| `/parkings` | Overview of lots (none now) + your current rental & time left. |
| `/rentspot [days]` | Rent the nearest spot. |
| `/renewspot [days]` | Renew your spot (must be standing on it). |
| `/recallcar` | Recall your active car to your spot (fee). |
| `/storecar` | Store the car on your spot. |

---

## 7. Admin: placing & editing spots

Gated on `global.isProtectedAdmin` (the FLY_ADMINS list in `packages/admin`) — **no Admin Mode toggle
needed**.

**Commands:**

| Command | Does |
|---------|------|
| `/addparkspot [price]` | Create a spot where you stand, facing your heading (default $50/day). Prints the new id + coords. |
| `/delparkspot <id>` | Remove an admin-placed spot (frees any rental on it). |
| `/parkspots` | List every spot id + coords + free/taken status. |

**In-world editor** (opened from the panel's Edit button → `enterParkEdit`). While editing, the ped is
frozen (`FREEZE_ENTITY_POSITION`) and all control actions are disabled each frame, so WASD etc. move the
*spot* instead of the player. Keybinds (client, `MOVE_STEP` 0.15 / `ROT_STEP` 1° / `SIZE_STEP` 0.2 /
`Z_STEP` 0.1):

| Key | Action |
|-----|--------|
| **WASD** | Move spot on X/Y |
| **Q / E** | Yaw (heading) − / + |
| **, / .** | Pitch (rx) − / + |
| **[ / ]** | Roll (ry) − / + |
| **− / +** | Width − / + |
| **PgDn / PgUp** | Length − / + |
| **R / F** | Raise / lower (Z height) |
| **↑ ↓ → ←** | Stamp a *new* copy one gapped slot away in that direction (0.7 m gap). Repeated presses walk a row via an accumulator. |
| **Home / End** | Duplicate this slot 5× to the left / right (gapped). |
| **Delete** | Remove this slot and exit. |
| **Enter** | Save changes (and confirm the save dialog). |
| **Backspace** | Discard changes. |
| **Esc** | Toggle the save/discard confirm bar. |

Edits are sent as `parking:edit` (JSON) and re-validated/clamped server-side (rx/ry ±45°, w 1.6–6,
l 3–12) — only `customSpots` are editable. Stamps go via `parking:stamp`, bulk duplicates via
`parking:duplicate`.

---

## 8. Expiry sweeper

A `setInterval` (every 60 s) deletes any rental whose `expiresAt` has passed, DMs the owner if they're
online ("ქირა ამოიწურა"), and re-broadcasts spots so they flip back to blue.

---

## 9. Parking finder (phone)

The phone's **Parking** app helps players find a free/own spot and pin it on the map. It does **not**
teleport — it only drops a GPS waypoint.

Flow: phone opens the app → `phone:ui:parkingRequest` → server `phone:parkingRequest` →
`global.parkingPhoneData(player)` → `phone:parking` back to the UI (`window.setParkingList`).

`parkingPhoneData` returns the player's **own** rented spot (if any) plus **every free** spot — spots
rented by *others* are hidden — each with `id`, `price`, `x`, `y`, straight-line `dist`, and `mine`,
sorted nearest-first. It's recomputed on every open because distances change as the player moves.

Tapping a spot → `phone:ui:parkingPin` → client `mp.game.ui.setNewWaypoint(x, y)`.

---

## 10. Common changes — where to touch

| You want to… | Edit |
|---------------|------|
| Change the recall fee | `RECALL_FEE` in `packages/parking/index.js`. |
| Change max rental length | `MAX_RENT_DAYS`. |
| Change how far you must stand to interact | `SPOT_RANGE` (server) — keep client footprint logic in mind. |
| Change the price formula (e.g. stop scaling by fleet size) | `doRent` / `doRenew` — the `price × qty × days` line. |
| Change default spot size | `DEFAULT_W` / `DEFAULT_L` (server) and `PARK_DEF_W` / `PARK_DEF_L` (client) — keep them in sync. |
| Add a map garage marker | `GARAGE_BLIPS` array (server). |
| Change the free/rented colours | `drawParkQuad` in `client_packages/index.js`. |
