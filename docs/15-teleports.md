# Teleports — named destinations

A simple named-teleport system: pinned world points that players can jump to with a command, and that
admins re-pin in-game.

- **Server:** `packages/teleports/index.js`.
- **Persistence:** `packages/teleports/points.json` — one entry per point, `{ x, y, z, h, dim }`,
  written atomically (`.tmp` + rename), so points survive restarts.

---

## 1. How it works

Each named point lives in `points.json`:

```json
{
  "cityhall": { "x": 273.5, "y": -281.8, "z": 54.1, "h": 160, "dim": 0 },
  "hospital": { "x": 325.6, "y": -579.0, "z": 45.4, "h": 0, "dim": 0 }
}
```

`teleport(player, name)` sets the player's `dimension`, `position`, and `heading` from the stored point.
If the point isn't defined yet, it tells the player to ask an admin to `/settp` it first.

---

## 2. Commands

| Command | Who | Does |
|---------|-----|------|
| `/cityhall`, `/hospital` | anyone | Teleport to that named point. |
| `/settp <name>` | admin | Pin `<name>` to where you're standing (position + heading + dimension). |
| `/tps` | admin | List configured point names. |

Admin = `global.isProtectedAdmin` (the FLY_ADMINS list in `packages/admin`).

---

## 3. Why `/settp` exists

A map or interior mod loads wherever its author placed it — you can't always guess the coords. So the
workflow is: walk inside the interior, run `/settp <name>`, and from then on the open `/<name>` command
lands players exactly there.

---

## 4. Adding a new teleport destination

1. Register the open command in `packages/teleports/index.js` (copy the `/cityhall` line):
   ```js
   mp.events.addCommand('garage', (player) => teleport(player, 'garage'));
   ```
2. Restart the server, go in-game, stand where you want the destination, and run `/settp garage`.
3. `/garage` now teleports anyone there. The point is saved to `points.json`.

---

## 5. Notes / gotchas

- `/hospital` is owned **here** (teleports), not `packages/freeroam` — it resets dimension, which the
  freeroam package has a comment pointing to.
- `/tp <x> <y> <z>` (raw coordinates, for testing map/ymap edits) is a **different** command and lives
  in `packages/freeroam`, not here.
- Points are global and shared by all players; there's no per-player access gating beyond `/settp`
  being admin-only.
