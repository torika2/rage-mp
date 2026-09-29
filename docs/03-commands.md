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
| `E` | Refuel at a pump |
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

`/fly` toggles flight for the allowlisted Social Club account `SEPHIGR`.
WASD moves, Space rises, Ctrl descends, and Shift increases speed. While
flying, the admin is invisible to other clients and invincible. These effects
are restored when flight ends or the admin dies. Only the authorized account
can toggle flight; use **B**, `/fly`, or the `/admin` panel. Flight ends on death
or when toggled off.

## Admin panel

F8 or `/admin` toggles the server admin panel for `SEPHIGR`. The panel captures
game input while open. Turn **Admin Mode** on in the panel to enable privileged
actions; turning it off disables them and stops flight. See
[09-admin-panel.md](09-admin-panel.md) for actions and safety behavior.
