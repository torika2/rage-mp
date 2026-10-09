# 20 — LSPD armoury, uniform locker & armour skin

Two Mission Row stations for police roster members, plus the "armour skin" hook into the inventory's vest look.
Ranks, `/pduty`, roster commands are in [07-police-system.md](07-police-system.md). Gang wardrobe (which the locker reuses) is in [13-gangs.md](13-gangs.md).

## Where things live

| What | Where |
|------|-------|
| Server: armoury | `packages/police/index.js` — section "LSPD armoury (craft station)" (~L347) |
| Server: locker + uniforms | `packages/police/index.js` — section "LSPD uniform locker" (~L424) |
| Server: armour skin consumer | `packages/inventory/index.js` `setVestLook` (~L172) |
| Client: markers, prompts, "E" routing | `client_packages/index.js` ~L976-1002 (`POLICE_ARMOURY`, `POLICE_LOCKER`, `POLICE_LOCKER_SPOT`), "E" handler ~L3500 |
| Client: shop UI mode | `client_packages/index.js` `shopMode` (~L942), `openShopUI`, `requestShopData`, `shop:purchase` |
| Client: wardrobe routing | `client_packages/index.js` `wardrobeOwner`, `wardrobeRemote`, `openWardrobeFrom` (~L1272) |
| UI | `client_packages/ui/shop/index.html` (reused for armoury), `client_packages/ui/gangwardrobe/index.html` (reused for locker) |
| Persistence | None. Uniforms are in-memory (`policeUniform` Map); crafted gear goes to the normal inventory persistence |
| Cars | LSPD Pack 3.1 vehicles: see [inventory.md](inventory.md) |

## Big picture

- Both stations are a ground marker (type 27) + an `E` prompt (`setInteract`) drawn in the client `render` loop. The client only decides *presentation*; the server re-checks everything.
- `police:roster` (player variable, set in `packages/police/index.js` on join ~L170, on roster add ~L293, remove ~L342) drives the client prompt. It is true for roster officers **and** allowlisted admins (`rosterOf` = `rankOf !== null`, and admins resolve to `chief`).
- Armoury = a **shop UI in "craft" mode** (fee-based, items go into inventory). Locker = the **gang wardrobe UI** re-pointed at `police:*` events (free, visual only).

## Armoury

| Item | Value |
|------|-------|
| Position | `ARMOURY` = 452.471, -980.151, 30.689, h -88.0, range 2.5 (server `packages/police/index.js:350`); client `POLICE_ARMOURY` same coords, prompt radius 2.2 m (`4.84` squared) |
| Who sees prompt | roster members, on foot, dimension 0 (`policeArmouryNear`) |
| Server gate (`armouryGuard`) | `requireDuty` (needs `duty` capability **and** `/pduty` on) + `nearArmoury` (dim 0, within 2.5) |
| Rank gate | `data.ranks[rank].level >= recipe.minLevel` (cadet 0 ... chief 6) |

Flow: `E` -> client notify + `police:armoury:open` -> server guard -> `police:armoury:ui` -> client `openShopUI('armoury')` -> UI loads, `shop:uiReady` -> `police:armoury:data` -> server replies `shop:setData` with `{title:'LSPD Armoury', buyLabel:'Craft', money, items}` filtered by rank -> Craft click -> `shop:purchase` -> `police:armoury:craft(key, qty)`.

Craft (server): finds recipe, re-checks rank, `boxes` = 1 or (for `qty` recipes) clamped 1-20, `cost = price*boxes`, needs `global.invHasSpace`, `global.canAfford`, then `setMoney` and `global.invAddItem(key, (give||1)*boxes)`. Fee is a plain money sink; no materials.

### `ARMOURY_RECIPES` (key, minLevel, price)

| Level | Items |
|-------|-------|
| 0 | nightstick $100, flashlight $50, stungun $400, combatpistol $600, armor $400, medkit $150, ammo_stungun $50 (x5/box), ammo_combatpistol $40 (x24/box) |
| 1 | pumpshotgun $1500, ammo_pumpshotgun $60 (x16) |
| 2 | smg $2500, ammo_smg $90 (x60) |
| 3 | carbinerifle $5000, ammo_carbinerifle $140 (x60) |

Police-only item defs (`nightstick`, `flashlight`, `stungun`, `ammo_stungun`) are registered into `global.invItemDefs` at the top of the section; the other keys (pistols, SMGs, `ammo_*`, `armor`, `medkit`) come from `packages/shops` / inventory. A recipe `key` must be a valid inventory item id.

UI changes: shop UI uses `data.buyLabel` for the button (default Georgian "buy"), and `nightstick` maps to the `bat` icon.

## Uniform locker

| Item | Value |
|------|-------|
| Position | `LOCKER` = 456.519, -989.062, 30.689, h -7.5, range 2.5 (server); client `POLICE_LOCKER` same coords, 2.2 m prompt |
| Preview spot | `POLICE_LOCKER_SPOT` = 451.769, -991.502, 30.689, h -93.6 (client only) |
| Private dimension | `LOCKER_DIM_BASE + player.id` (2200000+) while open; old dim saved in `player.lockerReturnDim` |
| Who | any `rankOf` non-null (roster or admin). **No duty or rank-level requirement, free** |

Flow: `E` (locker checked before armoury at the `E` handler) -> `police:wardrobe` -> server checks roster + `nearLocker` (dim 0), moves player to private dim, sets `player.inPoliceLocker`, sends `police:wardrobe:open` with `{gang:'LSPD', color:'#2f6fb5', catalog, current}` -> client `openWardrobeFrom('police', json)` teleports the local ped to the preview spot and starts the ped preview camera.

Client routing: `wardrobeOwner` ('gangs' | 'police') is set only if no wardrobe is open; `wardrobeRemote(name)` prefixes remote events, so the UI's `gangs:wardrobe:pick/clear/off/leave` become `police:duty:pick`, `police:duty:clear`, `police:duty:off`, `police:wardrobe:leave`.

Server events (all pick/clear/off require `inPoliceLocker`; pick also requires roster):

| Event | Effect |
|-------|--------|
| `police:duty:pick(cat, index)` | Server looks the piece up by index in the player's gendered catalog (client sends only the index), stores `{d,t}` in `policeUniform[accountKey].look[cat]`, applies, resends catalog |
| `police:duty:clear(cat)` | Removes one category; if look is empty, restores civilian via `global.invRestoreLook` and clears vest skin |
| `police:duty:off` | Deletes whole uniform, restores civilian look, notifies |
| `police:wardrobe:leave` | Returns to `lockerReturnDim` |
| `playerSpawn` | After 800 ms re-applies the stored look (death resets ped) |
| `playerQuit` | Drops the uniform (in-memory only: lost on quit/restart) |

Application goes through `global.invApplyClothingLook` (inventory package). `UNIFORMS` has per-gender (`m`/`f`, via `global.characterGender`) catalogs for: top, undershirt, pants, shoes, neck, hat, glasses, vest. `pieces(label, [[drawable, texture], ...])` builds entries labelled "Label N".

**Gotcha: clothing ids are best guesses.** GTA clothing has no colour metadata; the drawable/texture pairs are tuned to approximate the vanilla LSPD look and must be verified in-game (each UI card shows its index). Edit the lists in `UNIFORMS`.

## Armour skin (`player.vestSkin`)

The `vest` locker slot is not a clothing item; it is the visible look of body armour (clothing component 9).
- Locker side: `setVestSkin(player, piece)` sets `player.vestSkin = {d,t}` (or null) and, if `player.armour > 0`, repaints component 9 immediately.
- Inventory side: `setVestLook(player, on)` in `packages/inventory/index.js` uses `player.vestSkin` if set, else the default `VEST_LOOK` (drawable 1, texture 0); when armour is off it sets component 9 to 0.
- So the skin only shows while armour is worn, and it applies whenever armour is put on afterwards. `vestSkin` is a plain server property (not synced, lost on quit).
- UI: `gangwardrobe` `CAT_LABELS` gained `vest` (Georgian "vest"); `GANG_WARDROBE_ZONE` in the client maps `vest` to the `upper` camera zone.

## Known leftovers

- Debug `console.log('[police] armoury open ...')` in `police:armoury:open` and the client `notify('LSPD Armoury...')` in the `E` handler are still present; remove when done debugging.
- Uniforms are not persisted (see above).

## Common changes — where to touch

| Change | Where |
|--------|-------|
| Move armoury / locker | server `ARMOURY` / `LOCKER` **and** client `POLICE_ARMOURY` / `POLICE_LOCKER` (keep in sync; markers use client consts) |
| Move preview spot | client `POLICE_LOCKER_SPOT` (pick a prop-free spot; private dimension hides other players) |
| Add / reprice a craftable | `ARMOURY_RECIPES` (`key` must exist in `global.invItemDefs`; `give`+`qty:true` for ammo boxes); new police-only item -> `Object.assign(global.invItemDefs, ...)` above it |
| Change rank needed | `minLevel` in the recipe (levels come from ranks in the police data JSON) |
| Make locker require duty / rank | `police:wardrobe` handler (currently roster only) |
| Fix a uniform piece look | `UNIFORMS.m` / `UNIFORMS.f` pairs `[drawable, texture]` |
| Add a locker category | add to `UNIFORMS` both genders; add label in `gangwardrobe` `CAT_LABELS` and zone in client `GANG_WARDROBE_ZONE`; ensure `invApplyClothingLook` handles it |
| Default armour look | `VEST_LOOK` in `packages/inventory/index.js` |
| Prompt distance | client `4.84` (2.2 m squared) vs server `range` 2.5 — keep client smaller |
| Persist uniforms | `policeUniform` Map (see `global.kv` in [19-kv-store.md](19-kv-store.md)) |
| Button text on craft UI | `buyLabel` in `police:armoury:data` payload |
