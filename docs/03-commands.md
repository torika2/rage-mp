# Commands & Keybinds

## Server-side chat commands

Defined in `packages/freeroam/index.js`.

| Command | Effect |
|---------|--------|
| `/veh <model>` | Spawn a car by model name and get in (destroys your previous car first) |
| `/fix` | Repair the car you're in |
| `/dv` | Delete your car |
| `/livery <n>` | Set livery `n` (classic livery + mod-kit slot 48). No effect on cars without liveries |

Example: `/veh 23rs7`, `/veh rmodrs7`, `/veh g82adro`, `/veh adder`.

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
    Premium ×1.18, Super 100 ×1.28. The native ignores values <1, so Regular is the floor; higher grades add speed.
  - **eff** (burn rate): Regular 1.15 (shortest range) → Super 100 0.75 (longest range).
  - **price** rises with grade so cost-per-distance climbs (2.65 → 4.13): cheap = budget, Super = performance.
  - **blending:** refuelling mixes the new grade into what's already in the tank by volume (power/eff/rating
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
