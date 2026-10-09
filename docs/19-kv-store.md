# 19 - SQL kv_store (world/shared state in the database)

One document per namespace, stored in MySQL through the API. Replaces the per-package `*.json` files
(`houses.json`, `police.json`, ...) as the source of truth, while keeping the JSON file as a mirror/fallback.

## Where things live

- **API (NestJS):** `api/src/kv/`
  - `kv-entry.entity.ts` - entity `kv_store`: `namespace` varchar(64) PK, `value` json, `updated_at`.
  - `kv.controller.ts` - `GET /kv/:namespace`, `PUT /kv/:namespace` (body `{ value }`, `dto/kv.dto.ts`, `@IsDefined`).
  - `kv.service.ts` - `get` returns `{exists, value}`; `put` is an upsert (`save` on the PK).
  - `kv.module.ts`, registered in `api/src/app.module.ts`. Table is created by TypeORM
    (`autoLoadEntities` + `DB_SYNCHRONIZE=true` in `api/.env`).
  - `api/src/main.ts:10` - JSON body limit raised to **25mb** (express default 100kb is too small for whole documents).
- **Game server helper:** `packages/_core/index.js` ~lines 218-283 - `global.kv.load` / `global.kv.save`.
- **Persistence:** MySQL table `kv_store` + JSON mirror next to each package (path passed as `file`).
- **Auth/URL:** same `apiConfig` (`_core/api.config.json`, `baseUrl` + Bearer `apiKey`) as the rest of `global.api`.

## Big picture

Each package keeps its state as one in-memory object and persists it as a single JSON document under a
namespace. It is **not queryable per row** - the DB just holds the blob. Typed tables (`houses`,
`parking_spots`, ...) still exist in the API for a possible future migration, but these packages do not use them.

### `global.kv.load(name, file, fallback)`
- **Synchronous**, meant for package startup only. Runs `curl -s -m 5 -f` against `GET /kv/<name>` via
  `execFileSync` (so it blocks startup up to 5s per namespace if the API hangs).
- API row exists -> returns `remote.value`.
- API reachable but **no row** -> imports `file` (or `fallback` if the file is missing/invalid) by PUTting it
  once, logs `[kv] imported <name> into SQL`, returns the imported value.
- API **unreachable** -> logs `[kv] API unreachable for <name> - using <file>` and returns the JSON file
  (or `fallback`). Nothing is imported in that case.

### `global.kv.save(name, value, file)`
- Call after every change. Pass the **same live object** you loaded; it is re-read on each push.
- Writes the JSON mirror immediately and atomically (`file.tmp` then rename), best-effort.
- Pushes to the API in the background, **coalesced**: one PUT in flight per namespace; changes during a PUT
  set a dirty flag and trigger one more PUT afterwards. Failures log `[kv] save failed for <name>` and never
  throw/block the tick.
- Because the mirror is always written, a down API never loses data; next restart with the API up, however,
  reads the (older) SQL row if one exists - see gotchas.

## Namespaces

| Namespace | Package (file) |
|-----------|----------------|
| `houses` | `packages/houses/index.js` |
| `parking` | `packages/parking/index.js` (loads with `null` fallback) |
| `teleports` | `packages/teleports/index.js` |
| `cityhall`, `cityhall_ids` | `packages/cityhall/index.js` (chosen from the file basename, `index.js:49,52`) |
| `demorgan` | `packages/demorgan/index.js` |
| `government` | `packages/government/index.js` |
| `police` | `packages/police/index.js` |
| `medics` | `packages/medic/index.js` |
| `phone` | `packages/phone/index.js` |
| `vehicles` | `packages/vehicles/index.js` |
| `barber` | `packages/barber/index.js` |
| `character` | `packages/character/index.js` |
| `admin_admins`, `admin_moderation` | `packages/admin/index.js` |
| `clothing_torso_overrides` | `packages/clothing/index.js` |

Namespace names are max 64 chars (PK varchar(64)).

## What is NOT in kv_store

- Already DB-backed via `global.dbSync` / typed tables: bank, economy, needs, tattoo, inventory, characters.
- Static data intentionally left on JSON: citymap, carspeed, `dlc_registry`, clothing/tattoo reference data, carhandling.

## Operations

- `ragemp-api.service` is **not installed yet**. Install steps are in the header of `api/ragemp-api.service`
  (copy to `/etc/systemd/system/`, `daemon-reload`, `enable --now ragemp-api`). Run `npm run build` in `api/`
  first - the unit runs `dist/main.js`.
- **Start the API before `rageserv`**: `load()` only runs at package startup. If the API is down then, JSON files
  are used and `[kv] API unreachable ...` is logged per namespace (check `journalctl -u rageserv`).
- API listens on `127.0.0.1:3000` (`PORT` env overrides).

## Adding persistence to a new package

```js
const path = require('path');
const FILE = path.join(__dirname, 'mything.json');
const data = global.kv.load('mything', FILE, {});      // startup only
function save() { global.kv.save('mything', data, FILE); }  // after each change
```
Use `kv.load`/`kv.save` instead of `fs.readFileSync`/`writeFileSync`. Packages load in order, and `_core`
defines `global.kv`, so it is available at top level. If you reassign the object instead of mutating it, pass
the new reference to `save` (it replaces the stored getter).

## Gotchas

- **SQL wins over JSON once a row exists.** Hand-editing a package JSON file has no effect after the first
  import; edit via the game, or `PUT /kv/<name>`, or delete the row to re-import from the file.
- Writes made while the API is down update only the JSON mirror; on the next start the stale SQL row is
  loaded and overrides them. Restart the API and let the server run before relying on this.
- Whole-document writes: every change re-uploads the full document (bounded by the 25mb limit and 256MB curl buffer).
- Last-writer-wins; there is a single game server so no locking.
- `load()` blocks the main thread at startup; do not call it at runtime.

## Common changes - where to touch

| Change | Where |
|--------|-------|
| Persist a new package | `kv.load`/`kv.save` in the package (snippet above); no API change needed |
| Raise/lower max document size | `api/src/main.ts:10` (`limit`), curl `maxBuffer` in `_core/index.js` `kv.load` |
| Change load timeout | `-m 5` in `kv.load` (`_core/index.js`) |
| Change API URL / key | `packages/_core/api.config.json` |
| Force re-import from JSON | delete the row: `DELETE FROM kv_store WHERE namespace='x';` then restart rageserv |
| Inspect a document | `curl -H "Authorization: Bearer <key>" http://127.0.0.1:3000/kv/<name>` |
| Migrate a namespace to typed tables | replace its `kv.load/save` with `global.api.*` calls (see parking/houses modules in the API) |
