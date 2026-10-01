# Salons (barber, clothing, tattoo)

The three appearance shops share the same shape: the player presses **E** at the shop, the client
asks the server for state, the ped is moved to a clean preview spot, the CEF shows the options, and
the server re-prices + applies + saves the purchase. Packages: `barber`, `clothing`, `tattoo`.

## Private instance per player (so customers don't overlap)

All three teleport the player to the **same** shared dressing spot
(`client_packages/index.js` → `DRESSING_SPOT`) for a clean, prop-free preview. To stop players
stacking on each other there, each shop puts the player in a **private dimension** for the duration:

- On open (`*:requestState`, when the shop is in range) the server sets
  `player.dimension = 2000000 + player.id` and starts a session timestamp
  (`barberSession` / `tattooSession` / `clothingSession`).
- On close the client calls `*:leave` (`barber:leave` / `clothing:leave` / `tattoo:leave`) and the
  server restores `player.dimension = 0`.

Because the player is no longer in dimension 0 while shopping, the **buy handlers validate by the
session, not by `atShop`/`atStore`** (which require dim 0). Barber and tattoo already did this;
clothing got a `clothingInSession()` fallback in `clothing:buyCart`. If you add a new shop with a
private dimension, its buy check must accept the session or purchases will be rejected.

## Barber buy flow — pick → Pay (no cart step)

Picking a style/colour (click) or cycling it (‹ › arrows) **auto-stages** the change and previews
it live; the category tab shows a dot for changed parts. There is **no "add to cart" button** — a
single **გადახდა (Pay)** buys everything staged at once (`barberCartLook()` → `barber:buy`). Prices
are per changed field (`PRICES` in `packages/barber`), so browsing colours with the arrows is free;
only Pay charges. `barber:buy` keeps the session alive so a visit can include several purchases.

## Gotchas

### Hair colour buy was rejected / "not saving" (fixed)
The barber validates the submitted look with `parseLook`, which requires every colour in **0–63**.
A freshly-created ped can report junk values from the live model (e.g. `hairColor` / highlight =
**255**). `withDefaults()` used to pass any integer through, so those 255s reached `parseLook`, which
rejected the **whole** purchase (style *and* colour) with no obvious error. Fix: `withDefaults()`
now **clamps every field to its valid range** (`packages/barber/index.js`), so junk becomes a valid
default instead of poisoning the buy. `restoreLook` on spawn then also gives such peds a valid
colour automatically.

### Female hair tint not rendering in the preview
GTA only draws hair tint on a ped that has **head-blend data**, and the female freemode ped is
sensitive to timing — `setHeadBlendData` needs a frame to settle. The salon re-asserts the blend
~300 ms after opening (`client_packages/index.js`, barber open) so the first colour change renders.

### Clothing buy requires being "at the store" OR in a session
`atStore()` returns false in a private dimension, so `clothing:buyCart` also accepts
`clothingInSession()`. Keep both checks if you touch that handler.
