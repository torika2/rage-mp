# Testing — Money + Fuel Flow

Test script for the economy/fuel/engine features. Run after every deploy
(`sudo systemctl restart rageserv` in a real terminal → fully relaunch GTA → reconnect).

## Server-side pre-checks (run from WSL before playing)

```bash
# 1. JS is valid
node --check /opt/ragemp-srv/client_packages/index.js
node --check /opt/ragemp-srv/packages/economy/index.js

# 2. economy package is loaded on disk
ls /opt/ragemp-srv/packages/economy/index.js

# 3. server restarted AFTER your last edit
systemctl show rageserv -p ActiveEnterTimestamp --value

# 4. prices are in sync (client OCTANES vs server OCTANE_PRICES)
grep -n "price:" /opt/ragemp-srv/client_packages/index.js
grep -n "OCTANE_PRICES" /opt/ragemp-srv/packages/economy/index.js

# 5. after buying fuel in-game, money persisted:
cat /opt/ragemp-srv/packages/economy/money.json
```

## In-game test script

| # | Action | Expected |
|---|--------|----------|
| 1 | `/money` | Shows `Balance: $5000` (first join) |
| 2 | `/veh 23rs7` | Audi RS7 spawns; HUD bottom-right shows speed/gear/rpm/fuel; money top-right |
| 3 | Get in | Radio is OFF |
| 4 | Press `2` while stopped | `Engine: ON` (then OFF on next press) |
| 5 | Drive, press `2` while moving | Refused: "Can't turn the engine off while moving" |
| 6 | Spam `2` | Ignored faster than ~1s apart (cooldown) |
| 7 | Drive a few min | Fuel % drops; drops faster at high RPM |
| 8 | Let fuel hit 0% | Engine stalls; `2` won't restart ("Out of fuel") |
| 9 | Go to a gas-station blip, stop, engine off | Prompt "Press E to refuel" |
| 10 | Press `E` | CEF fuel UI opens; mouse cursor appears; controls locked |
| 11 | Click an octane card | Card highlights; price/tag update |
| 12 | Drag slider / click 25%/50%/Fill | Litres + cost update live; slider max capped by tank space AND money |
| 13 | Click **Buy** (or Enter) | Money drops by cost; fuel rises; success toast; UI balances refresh |
| 14 | Try to buy more than you can afford | Slider max prevents it; if forced, server denies with an error toast |
| 15 | Click **Cancel** / press `Esc` | UI closes, no charge |
| 16 | `/money` again | Reflects spend |
| 17 | Relog | Money persists (server); **fuel resets to full** (client-side, expected) |

## Edge cases to hit

- Enter/exit vehicle repeatedly (engine state is `null` mid-transition — HUD shouldn't glitch).
- Two different cars — each tracks its own fuel.
- Passenger vs driver (fuel is per-client; only relevant solo today).
- Octane **blending**: fill Super to ~full, then buy a splash of Premium → HUD rating stays ~100 (not 98).
  Burn down to near-empty, fill Premium → rating moves to ~98. From 0% → exactly the grade bought.
- **"Empty tank first" toggle**: with a partial tank, enable it → slider max jumps to full capacity; buy →
  old fuel is discarded (HUD rating becomes exactly the bought grade, e.g. `· 98`), only the pumped litres charged.

## Balance sanity (see economy-balancer notes)

- Full tank cost (65 L): Regular ~$150, Plus ~$195, Premium ~$273, Super 100 ~$358.
- Octane is a real trade: cost-per-distance rises with grade (2.65 → 4.13), and higher grades give more
  engine power (×1.00 / ×1.08 / ×1.18 / ×1.28) and range. Cheap = budget, Super 100 = performance.
- ⚠️ **No income source yet** — money only drains. Add jobs/races/payouts before going live,
  or players will end up stranded at $0. Use `/addmoney <n>` for testing until then.

## Known limitations

- Fuel is **client-side per session** → resets on relog and can differ between players. Fine for freeroam.
  Move to server StateBags/persistence if you want it authoritative.
- `/addmoney` is unrestricted — lock it to admins before production.
