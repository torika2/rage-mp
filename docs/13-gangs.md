# Gangs

Player-run gangs with a leader, a rank ladder with per-rank permissions, a physical **base**, a shared
**treasury**, a shared item **stash**, and **crafting** (guns, armour/shields, ammo).

Server: `packages/gangs/index.js`. Client: gang block + `client_packages/ui/gang/index.html`.
Persistence: NestJS `gangs` module + MySQL table `gangs` (JSON columns), via `global.api.*Gang*`.

## Static (server-seeded) gangs

The server ships a roster of **static turf gangs** defined in `STATIC_GANGS` at the top of
`packages/gangs/index.js`. Each entry is `{ key, name, tag, color, base:{x,y,z,dim} }`. Code is the
source of truth for a static gang's **name, tag, colour and base** — on every boot the server:

1. **creates a DB row** for any static gang that doesn't have one yet (so *every gang is registered in
   the DB*, with a stable `static_key`), and
2. **reconciles** existing rows' name/tag/colour/base from the config (move a base here and it moves
   in-game on restart).

A static gang starts **leaderless**. An admin appoints the first leader with
`/gsetleader <playerId> <key|tag>` (e.g. `/gsetleader 3 greens`); from then on that leader runs it
normally (invite, promote, craft, …). Static gangs **can't be disbanded** and their **base can't be
changed in-game**; everything else (ranks, treasury, stash, crafting) is identical to a player gang.

Current roster:

| key | name | tag | base |
|-----|------|-----|------|
| `greens` | Greens | GRN | 101.643, -1937.120, 20.108 |

Add another by appending a line to `STATIC_GANGS` (unique, stable `key`) and restarting.

Players can still found their own gangs with `/gangcreate` (those have `static_key = null`).

## Identity & membership

- Membership is keyed by DB `characterId` (survives name/Social-Club changes). The in-memory cache is
  authoritative; every mutation is written through to the DB (debounced).
- Synced vars on each member: `gang:id`, `gang:tag`, `gang:name`, `gang:rank`. Other packages can read
  `global.gangOf(player)` / `global.gangTagOf(player)`.

## Ranks & permissions

Default ladder (level → key): `recruit(0) → soldier(1) → enforcer(2) → officer(3) → leader(4)`.
Each rank holds a capability list; the leader has `*` (all). Capabilities:
`stash_use, craft, invite, kick, treasury, buy_materials` (+ leader-only: promote/demote, setbase, disband).

- You can only manage (kick/promote/demote) members **below** your own rank level, and cannot grant a
  rank equal to or above your own.
- Leaving as leader auto-transfers leadership to the highest remaining member; if none remain, the gang
  disbands.

## Commands

| Command | What it does |
|---------|--------------|
| `/gang` | Your gang summary + command help |
| `/gangcreate <tag> <name>` | Found a gang (costs $50,000); you become leader |
| `/ginvite <id>` | Invite a nearby player (perm: invite) |
| `/gaccept` | Accept a pending invite (60s window) |
| `/gkick <id>` | Remove a lower-ranked member (perm: kick) |
| `/gpromote <id>` / `/gdemote <id>` | Change a member's rank (leader) |
| `/gleave` | Leave the gang |
| `/gmembers` | List members, ranks, online status + IDs |
| `/gsetbase` | Set the base at your position (leader) |
| `/gbank` | Show treasury balance |
| `/gdisband` | Disband the gang (leader; not allowed for static gangs) |
| `/gc <msg>` | Gang-only chat |
| `/gsetleader <id> <key\|tag>` | **Admin:** appoint/replace a gang's leader (bootstraps a static gang) |

## Base & panel

The leader sets the base with `/gsetbase`. It gets a red blip + ground marker. Members standing on the
base (on foot, within ~4 m) see **“Press E — ბანდის ბაზა”** → opens the CEF panel with tabs:

- **Overview** — members/treasury/stash summary; treasury **deposit/withdraw** (perm: treasury).
- **Members** — roster with ranks/online.
- **Stash** — withdraw stashed items into your personal inventory (perm: stash_use).
- **Crafting** — buy raw materials and craft.

All panel actions are re-validated server-side (member + at base + permission).

## Crafting chain

Treasury `$` → **buy raw materials** into the stash → **craft** at the base (timed, one job at a time,
rank-gated) → output lands in the **stash** → members withdraw into their inventory. Crafted item ids
reuse the real weapon/armour/ammo ids from `packages/shops`, so a crafted gun behaves like a bought one.

Materials (treasury cost / unit): `metal_scrap $50`, `gunpowder $80`, `weapon_parts $200`, `kevlar $150`.

| Recipe | Output | Needs | Time | Min rank |
|--------|--------|-------|------|----------|
| Armour vest (shield) | `armor` ×1 | kevlar 3, metal 2 | 30s | soldier |
| Pistol ammo | `ammo_pistol` ×24 | gunpowder 2, metal 1 | 15s | soldier |
| Pistol | `pistol` ×1 | parts 3, metal 4 | 45s | soldier |
| SMG | `smg` ×1 | parts 6, metal 8, gunpowder 2 | 60s | enforcer |
| Assault rifle | `assaultrifle` ×1 | parts 10, metal 12, gunpowder 4 | 90s | officer |

A craft in progress survives a server restart (rescheduled from `finishAt` on boot).

## Data model (`gangs` table)

`id, name (unique), tag (unique), static_key (unique, null for player gangs), color,
leader_character_id, members[] JSON, ranks[] JSON, base JSON, treasury bigint, stash{} JSON, crafting
JSON, created_at`. Auto-created (`DB_SYNCHRONIZE=true`). Every gang — static or player-founded — is a
row here; static gangs are seeded/reconciled from `STATIC_GANGS` on boot.
API: `GET/POST /gangs`, `GET/PUT/DELETE /gangs/:id`. Helpers: `global.api.loadGangs/createGang/updateGang/deleteGang`.

## Deploy

1. Rebuild the API (dist is root-owned): `sudo npm --prefix /opt/ragemp-srv/api run build`
2. Restart the API: `sudo systemctl restart ragemp-api`
3. Restart the game server: `sudo systemctl restart rageserv`
4. Fully relaunch / reconnect the client (new CEF page).
