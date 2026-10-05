// ===================== Car tuning garage (player-facing, per-car) =====================
// Players drive their OWNED car into the garage and buy performance upgrades with money. Unlike the
// admin Cars-tab tuning (per-MODEL, packages/admin/carspeed.js), this is per-VEHICLE: the levels are
// stored on that car's DB row (vehicles.tuning) and applied only to that car via the synced variable
// `veh:tune`, which the client reads before the per-model tuning (client modelTune()).
//
// Three upgradeable parts, each 0→5. A level maps to the same { power, topMult, kick } the client
// already applies, so maxing all parts ≈ an admin "Stage 3":
//   engine   → power   (acceleration across the whole range)
//   topSpeed → topMult (terminal-speed ceiling)
//   launch   → kick    (burst off the line)
// Money: global.getMoney/setMoney/canAfford (economy). Ownership: global.vehIsOwner (vehicles).

// Every tuning garage — the game's Los Santos Customs + Beeker's mod shops. /tune works at any of them.
const GARAGES = [
    { x: -337.3,  y: -136.3,  z: 39.0 },   // Burton (La Mesa Blvd) Los Santos Customs
    { x: 731.5,   y: -1088.8, z: 22.17 },  // La Mesa Los Santos Customs
    { x: -1155.5, y: -2007.3, z: 13.18 },  // LSIA / airport Los Santos Customs
    { x: 1175.0,  y: 2640.3,  z: 37.78 },  // Route 68 (Harmony) Beeker's Garage
    { x: 110.5,   y: 6626.5,  z: 31.79 },  // Paleto Bay Beeker's Garage
];
const RANGE = 6.0;                                   // the car must be parked this close to a garage to tune
const RANGE_SQ = RANGE * RANGE;

// Is the position parked at any garage?
function atAnyGarage(pos) {
    for (const g of GARAGES) {
        const dx = pos.x - g.x, dy = pos.y - g.y, dz = pos.z - g.z;
        if (dx * dx + dy * dy + dz * dz <= RANGE_SQ) return true;
    }
    return false;
}
const MAX_LEVEL = 5;

// Per-part config. prices[i] = cost to go from level i to level i+1 (so length === MAX_LEVEL).
// step = how much each level adds to the resolved multiplier. effect() builds the UI blurb.
const PARTS = {
    engine:   { label: 'ძრავა',         field: 'power',   step: 0.12, prices: [10000, 20000, 35000, 55000, 80000],
                effect: (lvl) => lvl ? `+${lvl * 12}% სიმძლავრე` : 'სტოკი' },
    topSpeed: { label: 'მაქს. სიჩქარე', field: 'topMult', step: 0.10, prices: [12000, 24000, 42000, 65000, 95000],
                effect: (lvl) => lvl ? `+${lvl * 10}% მაქს. სიჩქარე` : 'სტოკი' },
    launch:   { label: 'სტარტი',        field: 'kick',    step: 0.20, prices: [8000, 15000, 25000, 38000, 55000],
                effect: (lvl) => lvl ? `+${lvl * 20}% აჩქარება სტარტზე` : 'სტოკი' },
};
const PART_ORDER = ['engine', 'topSpeed', 'launch'];

function tell(player, message, ok) {
    player.outputChatBox((ok === false ? '!{#ff6b6b}' : '!{#8ed17a}') + '[ტუნინგი] !{#ffffff}' + message);
}

function zeroLevels() { return { engine: 0, topSpeed: 0, launch: 0 }; }
function clampLevel(v) { const n = Math.round(Number(v) || 0); return Math.max(0, Math.min(MAX_LEVEL, n)); }
function normalizeLevels(levels) {
    const L = levels || {};
    return { engine: clampLevel(L.engine), topSpeed: clampLevel(L.topSpeed), launch: clampLevel(L.launch) };
}

// levels -> the { power, topMult, kick } the client applies (1 = stock). power/topMult default to 1 so
// an engine-only upgrade keeps stock top speed; kick 1 = no launch burst.
function resolveTuning(levels) {
    const L = normalizeLevels(levels);
    const r4 = (n) => Math.round(n * 10000) / 10000;
    return {
        power:   r4(1 + L.engine   * PARTS.engine.step),
        topMult: r4(1 + L.topSpeed * PARTS.topSpeed.step),
        kick:    r4(1 + L.launch   * PARTS.launch.step),
    };
}

// DB vehicle id -> current levels. Populated at spawn (global.vehApplyTuning) and on each purchase; the
// car's DB row (vehicles.tuning) is the durable source of truth.
const levelsByDbId = new Map();

// Push a car's tuning to the client via the synced var (null when fully stock, so stock cars stay stock).
function applyToVehicle(veh, levels) {
    if (!veh || !mp.vehicles.exists(veh)) return;
    const L = normalizeLevels(levels);
    const any = L.engine > 0 || L.topSpeed > 0 || L.launch > 0;
    try { veh.setVariable('veh:tune', any ? resolveTuning(L) : null); } catch (e) {}
}

// Called when an owned car is spawned (carshop/vehicles) so it comes back with its saved upgrades.
global.vehApplyTuning = function (veh, dbId, levels) {
    const L = normalizeLevels(levels);
    if (dbId !== undefined && dbId !== null) levelsByDbId.set(Number(dbId), L);
    applyToVehicle(veh, L);
};

// ===================== Visual customization (LS Customs) =====================
// Per-car colors / wheels / body mods. Applied client-side for ALL players via the synced var
// veh:visual (stream-in applier) + a live broadcast; the chosen config persists on vehicles.visual.
// Each change is paid. Config shape: { colors:{primary,secondary,pearl,wheel}, windowTint, wheelType,
// mods:{ "<modType>": index } } — index -1 = stock.
const VISUAL_PRICES = {
    primary: 2000, secondary: 2000, pearl: 2500, wheel: 1500,
    windowTint: 1500, wheelType: 4000,
    'mod:0': 3000,  // spoiler
    'mod:1': 3500,  // front bumper
    'mod:2': 3500,  // rear bumper
    'mod:3': 2500,  // side skirts
    'mod:4': 2500,  // exhaust
    'mod:7': 3000,  // hood
    'mod:10': 3000, // roof
    'mod:23': 5000, // wheels (design)
};
const COLOR_CHANNELS = ['primary', 'secondary', 'pearl', 'wheel'];
const MOD_CATEGORIES = { '0': 1, '1': 1, '2': 1, '3': 1, '4': 1, '7': 1, '10': 1, '23': 1 };

const visualByDbId = new Map(); // dbId -> visual config
function clampInt(v, lo, hi) { const n = Math.round(Number(v)); return Number.isFinite(n) ? Math.max(lo, Math.min(hi, n)) : lo; }

// Push a car's visual to every client — synced var for stream-ins, broadcast for an instant re-apply.
function pushVisual(veh, cfg) {
    if (!veh || !mp.vehicles.exists(veh)) return;
    try { veh.setVariable('veh:visual', cfg || null); } catch (e) {}
    try { mp.players.call('vehicle:visualApply', [Number(veh.id), JSON.stringify(cfg || null)]); } catch (e) {}
}

// Called when an owned car spawns (carshop) so it returns with its saved look.
global.vehApplyVisual = function (veh, dbId, visual) {
    const cfg = (visual && typeof visual === 'object') ? visual : null;
    if (dbId !== undefined && dbId !== null) visualByDbId.set(Number(dbId), cfg || {});
    pushVisual(veh, cfg);
};

mp.events.add('cartuning:buyVisual', (player, category, rawValue) => {
    const reply = (ok, msg) => player.call('cartuning:result', [JSON.stringify({ ok, msg, applied: !!ok })]);
    const reason = tuningBlockReason(player);
    if (reason) return reply(false, reason);
    category = String(category);
    const price = VISUAL_PRICES[category];
    if (price === undefined) return reply(false, 'უცნობი კატეგორია.');
    if (typeof global.getMoney !== 'function' || !global.canAfford(player, price)) {
        return reply(false, `არასაკმარისი თანხა — საჭიროა $${price}.`);
    }
    const value = Math.round(Number(rawValue));
    if (!Number.isFinite(value)) return reply(false, 'არასწორი მნიშვნელობა.');

    const dbId = Number(player.activeVehId);
    const cfg = Object.assign({}, visualByDbId.get(dbId) || {});
    cfg.colors = Object.assign({}, cfg.colors || {});
    cfg.mods = Object.assign({}, cfg.mods || {});

    if (COLOR_CHANNELS.includes(category)) {
        cfg.colors[category] = clampInt(value, 0, 159);
        // Pair primary/secondary so the client applier always has both to pass to setVehicleColours.
        if (category === 'primary' && cfg.colors.secondary === undefined) cfg.colors.secondary = cfg.colors.primary;
        if (category === 'secondary' && cfg.colors.primary === undefined) cfg.colors.primary = cfg.colors.secondary;
    } else if (category === 'windowTint') {
        cfg.windowTint = clampInt(value, 0, 6);
    } else if (category === 'wheelType') {
        cfg.wheelType = clampInt(value, 0, 25);
    } else if (category.indexOf('mod:') === 0) {
        const type = category.slice(4);
        if (!MOD_CATEGORIES[type]) return reply(false, 'უცნობი დეტალი.');
        cfg.mods[type] = clampInt(value, -1, 200); // -1 = stock; client bounds it by the real option count
    } else {
        return reply(false, 'უცნობი კატეგორია.');
    }

    visualByDbId.set(dbId, cfg);
    global.setMoney(player, global.getMoney(player) - price);
    pushVisual(player.vehicle, cfg);
    if (global.api && global.api.updateVehicle) global.api.updateVehicle(dbId, { visual: cfg }).catch(() => {});
    player.call('cartuning:data', [JSON.stringify(buildData(player))]);
    reply(true, `განახლდა ($${price}).`);
    console.log(`[cartuning] ${player.name} visual ${category}=${value} ($${price}) on vehicle #${dbId}`);
});

// The car the player may tune right now: their own DB-persisted car, that they're sitting in, parked in
// the garage. Returns the vehicle or null.
// null = may tune; otherwise a specific, actionable Georgian reason shown to the player.
function tuningBlockReason(player) {
    const veh = player.vehicle;
    if (!veh || !mp.vehicles.exists(veh)) return 'ჯერ ჩაჯექი მანქანაში.';
    if (Number(player.dimension) !== 0) return 'აქ ტუნინგი მიუწვდომელია.';
    if (!atAnyGarage(veh.position)) return 'დააყენე მანქანა ავტოტუნინგის სახელოსნოში (რუკაზე ნიშანი).';
    if (global.vehIsOwner && !global.vehIsOwner(player, veh)) return 'ეს არ არის შენი მანქანა.';
    if (!player.activeVehId) return 'ჯერ გამოიძახე შენი ნაყიდი მანქანა — აკრიფე /getcar.'; // no DB row linked
    return null;
}
function tunableCar(player) {
    return tuningBlockReason(player) === null ? player.vehicle : null;
}

// Best-effort display name for the car the player is in, matched to the carshop catalog by model hash.
function carLabel(player) {
    const veh = player.vehicle;
    const catalog = (typeof global.carshopCatalog === 'function') ? global.carshopCatalog() : {};
    if (veh && mp.vehicles.exists(veh)) {
        const hash = veh.model >>> 0;
        for (const key in catalog) {
            try { if ((mp.joaat(catalog[key].model) >>> 0) === hash) return catalog[key].label; } catch (e) {}
        }
    }
    return 'თქვენი მანქანა';
}

function buildData(player) {
    const levels = Object.assign(zeroLevels(), levelsByDbId.get(Number(player.activeVehId)) || {});
    const money = global.getMoney ? global.getMoney(player) : 0;
    const parts = PART_ORDER.map(key => {
        const part = PARTS[key];
        const level = levels[key];
        const atMax = level >= MAX_LEVEL;
        const nextPrice = atMax ? 0 : part.prices[level];
        return {
            key, label: part.label, level, max: MAX_LEVEL, atMax, nextPrice,
            effect: part.effect(level),
            nextEffect: atMax ? '' : part.effect(level + 1),
            canAfford: !atMax && money >= nextPrice,
        };
    });
    const visual = visualByDbId.get(Number(player.activeVehId)) || {};
    return { parts, money, car: carLabel(player), visual, visualPrices: VISUAL_PRICES };
}

// ---- blip + marker + walk-in hint at every garage ----
// Sprite 72 = the Los Santos Customs (spray/mod-shop) icon; shortRange:false keeps each on the full
// map at all times so players can always find where to tune.
try {
    GARAGES.forEach((g) => {
        mp.blips.new(72, new mp.Vector3(g.x, g.y, g.z), { name: global.worldText('ავტოტუნინგი'), color: 5, scale: 0.9, shortRange: false });
        mp.markers.new(1, new mp.Vector3(g.x, g.y, g.z - 1.0), 2.0, { color: [242, 193, 92, 120] });
        const zone = mp.colshapes.newSphere(g.x, g.y, g.z, RANGE);
        zone.onEnter = (player) => { if (mp.players.exists(player) && player.vehicle) tell(player, 'შენი მანქანის გასაუმჯობესებლად აკრიფე /tune'); };
    });
} catch (e) { console.log('[cartuning] setup failed: ' + e); }

// ---- events ----
// CEF asks for data once it's open; also used to refresh after a purchase.
mp.events.add('cartuning:request', (player) => {
    const veh = tunableCar(player);
    if (!veh) { player.call('cartuning:denied'); return; }
    player.call('cartuning:data', [JSON.stringify(buildData(player))]);
});

mp.events.add('cartuning:buy', (player, partKey) => {
    const reply = (ok, msg, applied) => player.call('cartuning:result', [JSON.stringify({ ok, msg, applied: !!applied })]);
    const veh = tunableCar(player);
    if (!veh) return reply(false, 'მანქანა ავტოსახელოსნოში უნდა იდგეს.');
    const part = PARTS[String(partKey)];
    if (!part) return reply(false, 'ასეთი დეტალი არ არსებობს.');

    const levels = Object.assign(zeroLevels(), levelsByDbId.get(Number(player.activeVehId)) || {});
    const level = levels[String(partKey)];
    if (level >= MAX_LEVEL) return reply(false, 'უკვე მაქსიმალური დონეა.');

    const price = part.prices[level];
    if (typeof global.getMoney !== 'function' || !global.canAfford(player, price)) {
        return reply(false, `არასაკმარისი თანხა — საჭიროა $${price}.`);
    }

    global.setMoney(player, global.getMoney(player) - price); // charge
    levels[String(partKey)] = level + 1;
    levelsByDbId.set(Number(player.activeVehId), levels);
    applyToVehicle(veh, levels);                              // live effect
    if (global.api && global.api.updateVehicle) global.api.updateVehicle(player.activeVehId, { tuning: levels }).catch(() => {});

    player.call('cartuning:data', [JSON.stringify(buildData(player))]);
    reply(true, `${part.label} → დონე ${levels[String(partKey)]} ($${price}).`, true);
    console.log(`[cartuning] ${player.name} upgraded ${partKey} to L${levels[String(partKey)]} ($${price}) on vehicle #${player.activeVehId}`);
});

function openTuningFor(player) {
    const reason = tuningBlockReason(player);
    if (reason) { tell(player, reason, false); return; }
    player.call('cartuning:open');
}
// /tune, or the in-car "press E" prompt (cartuning:tryOpen) — both open the panel after validation.
mp.events.addCommand('tune', (player) => openTuningFor(player));
mp.events.add('cartuning:tryOpen', (player) => openTuningFor(player));

// Tell the client where the garages are so it can show the "press E to tune" prompt near them.
mp.events.add('cartuning:zonesRequest', (player) => {
    player.call('cartuning:zones', [JSON.stringify(GARAGES.map((g) => ({ x: g.x, y: g.y, z: g.z })))]);
});

global.vehTuningLevels = (dbId) => Object.assign(zeroLevels(), levelsByDbId.get(Number(dbId)) || {});
