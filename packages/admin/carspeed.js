// ===================== Admin: live per-car tuning =====================
// Each car can be given (1) a tuning STAGE and/or (2) a custom SPEED multiplier, both live (no restart):
//   STAGE  — a preset ladder (Stage 1 → Stage 3) that bumps power/top-speed/launch relative to stock.
//   SPEED  — a per-car top-speed multiplier the admin types in: 1.00 = stock, <1 slower, >1 faster.
//            It multiplies on top of the stage's top speed, so you can dial any car up or down freely.
// Resolved to { power, topMult, kick } and pushed to every client (see client_packages/index.js).
// Persisted in MySQL via global.api (table car_tuning). An in-memory cache is the runtime source of
// truth: loaded from the DB on boot, written through to the DB on every change. The legacy
// carspeed.json is migrated into the DB once on first boot, then renamed to carspeed.json.migrated.
// Panel: Cars tab.
const fs = require('fs');
const path = require('path');

const FILE = path.join(__dirname, 'carspeed.json');

// The stage ladder. Edit these numbers to retune every car at that stage at once.
const STAGES = [
    { name: 'Stage 1',  power: 1.15, topMult: 1.12, kick: 1.3 },
    { name: 'Stage 2',  power: 1.30, topMult: 1.25, kick: 1.6 },
    { name: 'Stage 2+', power: 1.45, topMult: 1.35, kick: 1.8 },
    { name: 'Stage 3',  power: 1.60, topMult: 1.50, kick: 2.0 }
];
const STAGE_BY_NAME = Object.fromEntries(STAGES.map(s => [s.name, s]));

// Custom per-car speed multiplier bounds (1 = stock). Keeps a typo from making a car undrivable.
const SPEED_MIN = 0.3, SPEED_MAX = 3.0, SPEED_DEFAULT = 1;
function clampSpeed(value) {
    const n = Number(value);
    if (!Number.isFinite(n)) return SPEED_DEFAULT;
    const clamped = Math.max(SPEED_MIN, Math.min(SPEED_MAX, n));
    return Math.round(clamped * 100) / 100; // 2dp — strips float32 noise from the client→server bridge
}

// Normalize any stored value (new {stage,speed} object, or legacy stage-name string) to a clean
// { stage, speed } — or null if it's effectively stock / unrecognized.
function normalize(value) {
    let stage = '', speed = SPEED_DEFAULT;
    if (typeof value === 'string') stage = STAGE_BY_NAME[value] ? value : '';
    else if (value && typeof value === 'object') {
        stage = STAGE_BY_NAME[value.stage] ? value.stage : '';
        speed = clampSpeed(value.speed);
    }
    return (stage || speed !== SPEED_DEFAULT) ? { stage, speed } : null;
}

// model name (lowercase) -> { stage: stageName|'', speed: number }. Only meaningful entries are kept.
// Empty until the DB load below populates it (brief window on boot → cars behave stock).
let cars = {};

// Load every tuned car from the DB into the cache (retries until the API answers), then migrate any
// legacy carspeed.json and push the current tuning to online clients.
function loadAll(attempt = 0) {
    if (!global.api || typeof global.api.loadCarTuning !== 'function') {
        if (attempt < 10) setTimeout(() => loadAll(attempt + 1), 3000);
        return;
    }
    global.api.loadCarTuning().then(rows => {
        const next = {};
        (Array.isArray(rows) ? rows : []).forEach(row => {
            if (!row || !row.model) return;
            const norm = normalize(row);
            if (norm) next[String(row.model).toLowerCase()] = norm;
        });
        cars = next;
        console.log(`[carspeed] loaded ${Object.keys(cars).length} tuned car(s) from DB`);
        migrateLegacyFile();
        if (typeof global.carSpeedBroadcast === 'function') global.carSpeedBroadcast();
    }).catch(() => { if (attempt < 10) setTimeout(() => loadAll(attempt + 1), 3000); });
}
setTimeout(() => loadAll(), 4000);

// One-time migration: seed the DB from the legacy carspeed.json (models not already in the DB), then
// rename the file so it never runs again. No-op once the file is gone.
function migrateLegacyFile() {
    let legacy;
    try { legacy = JSON.parse(fs.readFileSync(FILE, 'utf8')); } catch (e) { return; } // missing/unreadable → nothing to do
    let seeded = 0;
    if (legacy && typeof legacy === 'object') {
        for (const name in legacy) {
            const key = String(name).toLowerCase();
            if (cars[key]) continue;                 // DB already has it — don't clobber
            const norm = normalize(legacy[name]);
            if (!norm) continue;
            cars[key] = norm;
            persist(key, norm);
            seeded++;
        }
    }
    if (seeded) console.log(`[carspeed] migrated ${seeded} car(s) from carspeed.json to DB`);
    try { fs.renameSync(FILE, FILE + '.migrated'); } catch (e) {}
}

// Write one car's tuning through to the DB (fire-and-forget; the cache already holds the truth).
function persist(model, entry) {
    if (!global.api) return;
    if (entry) { if (global.api.saveCarTuning) global.api.saveCarTuning(model, entry).catch(() => {}); }
    else if (global.api.clearCarTuning) global.api.clearCarTuning(model).catch(() => {});
}

function stageNames() { return STAGES.map(s => s.name); }
function all() { return JSON.parse(JSON.stringify(cars)); }    // { model: { stage, speed } }

// Current tuning for a model, always a full { stage, speed } object (stock defaults if untuned).
function get(model) {
    const entry = cars[String(model).toLowerCase()];
    return { stage: (entry && entry.stage) || '', speed: (entry && entry.speed) || SPEED_DEFAULT };
}

// Resolved per-car effect for the clients: { model: { power, topMult, kick } }.
// The custom speed× is folded into BOTH engine power and top speed so a faster setting pulls harder
// across the WHOLE rev range (every gear), not just near the top — setEnginePowerMultiplier boosts
// acceleration throughout, while topMult raises the terminal-speed ceiling. Both default to 1 with no
// stage, so the speed box works stage or not. A plain stock car (no stage, speed 1) is omitted —
// the client treats "absent" as untuned (octane governs).
// Note: GTA ignores an engine-power multiplier below 1, so slowing a car (speed<1) comes from the
// lower top-speed cap on the client, not from reduced power.
function resolved() {
    const out = {};
    for (const model in cars) {
        const { stage, speed } = cars[model];
        const s = STAGE_BY_NAME[stage];
        const sp = speed || 1;
        const basePower = s ? s.power : 1;
        const baseTop = s ? s.topMult : 1;
        out[model] = {
            power: Math.round(basePower * sp * 10000) / 10000,  // more power the whole time
            topMult: Math.round(sp * baseTop * 10000) / 10000,  // higher terminal speed (float-noise safe)
            kick: s ? s.kick : 1
        };
    }
    return out;
}

// Assign a stage and/or custom speed to a model. A stage of ''/"Stock"/unknown clears the stage; a
// speed of 1 (stock) clears the custom speed. If nothing is left, the model drops back to pure stock.
// Returns { ok, message, stage, speed }.
function set(model, stageName, speedValue) {
    const name = String(model || '').trim().toLowerCase();
    if (!/^[a-z0-9_]+$/.test(name)) return { ok: false, message: 'Invalid model name.' };

    const rawStage = String(stageName || '').trim();
    const stage = (rawStage && rawStage !== 'Stock' && STAGE_BY_NAME[rawStage]) ? rawStage : '';
    const speed = clampSpeed(speedValue);

    if (!stage && speed === SPEED_DEFAULT) {
        delete cars[name]; persist(name, null);
        return { ok: true, message: `${name} reset to stock.`, stage: '', speed: SPEED_DEFAULT };
    }
    cars[name] = { stage, speed }; persist(name, cars[name]);
    const parts = [];
    if (stage) parts.push(stage);
    if (speed !== SPEED_DEFAULT) parts.push(`speed ×${speed}`);
    return { ok: true, message: `${name} tuned to ${parts.join(' + ')} (live).`, stage, speed };
}

module.exports = { all, get, set, resolved, stageNames, STAGES, SPEED_MIN, SPEED_MAX, SPEED_DEFAULT };
