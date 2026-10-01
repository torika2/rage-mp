// ===================== Parking: rentable assigned spots =====================
// Players rent a specific numbered parking spot (upfront, for N days). While the rental is active
// they can /park their own car there (stored & despawned) and /unpark to get it back. When the rent
// lapses the spot is freed for others and any stored car is impounded (retrieve with /impound for a
// fee). Rentals + stored/impounded cars persist to parking.json across restarts.
//
// Money API: global.getMoney/setMoney (economy). Car handoff: global.vehForget / global.vehAdopt
// (vehicles). Nearby RP lines: global.chatLocalAction (chat).

const fs = require('fs');
const path = require('path');

const DATA_FILE = path.join(__dirname, 'parking.json');
const DAY_MS = 24 * 60 * 60 * 1000;
const SPOT_RANGE = 4.5;          // metres you must be within to rent / park / unpark
const MAX_RENT_DAYS = 30;
const MAX_SLOTS = 5;       // most car-slots a single spot can be rented with
const IMPOUND_FEE = 250;
const SUMMON_FEE = 100;    // bring your personal car to a spot without having parked it

// ---- Config: parking lots and their spots. Add your own here — grab coords in-game with /pos. ----
// Each spot: id, x/y/z (ground level), h (heading a parked car faces), price (per day).
// No fixed lots — the C1–C5 legion lot was removed. Parking spots are now admin-placed
// (stored in parking.json customSpots). Add a fixed lot back here if ever needed.
const LOTS = [];
// Impounded cars are released at the old legion location.
const IMPOUND_POINT = { x: 266.0, y: -1261.0, z: 29.3, h: 0 };

// ---- Persistence ----
// spots: spotId -> rental; impound: key -> [carData...]; customSpots: admin-placed spot definitions.
let store = { spots: {}, impound: {}, customSpots: [] };
try {
    const loaded = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    if (loaded && typeof loaded === 'object') store = { spots: loaded.spots || {}, impound: loaded.impound || {}, customSpots: loaded.customSpots || [] };
} catch (e) { store = { spots: {}, impound: {}, customSpots: [] }; }
// Migrate old single-car rentals (r.car) to the multi-car model (r.cars[] + r.slots capacity).
Object.keys(store.spots).forEach(id => {
    const r = store.spots[id];
    if (!Array.isArray(r.cars)) r.cars = r.car ? [r.car] : [];
    delete r.car;
    if (!r.slots) r.slots = Math.max(1, r.cars.length);
});
function save() {
    const temporaryFile = DATA_FILE + '.tmp';
    try { fs.writeFileSync(temporaryFile, JSON.stringify(store)); fs.renameSync(temporaryFile, DATA_FILE); } catch (e) {}
}

// ---- Helpers ----
function keyOf(player) { return String(player.socialClub || player.name || ('id' + player.id)); }
// Synthetic "lot" wrapper for admin-placed standalone spots.
const CUSTOM_LOT = { id: 'custom', name: 'პარკინგის ადგილი', blip: { sprite: 50, color: 3, scale: 0.7 } };
function allSpots() {
    const out = [];
    LOTS.forEach(lot => lot.spots.forEach(s => out.push({ lot, spot: s })));
    store.customSpots.forEach(s => out.push({ lot: CUSTOM_LOT, spot: s }));
    return out;
}
// Next free spot id like Parking#1, Parking#2, ... unique across config + custom spots.
function nextSpotId() {
    const used = new Set(allSpots().map(s => s.spot.id));
    let n = 1;
    while (used.has('Parking#' + n)) n++;
    return 'Parking#' + n;
}
function findSpot(spotId) { for (const s of allSpots()) if (s.spot.id === spotId) return s; return null; }
function dist2(a, b) { const dx = a.x - b.x, dy = a.y - b.y, dz = (a.z || 0) - (b.z || 0); return dx * dx + dy * dy + dz * dz; }
function round3(n) { return Math.round(Number(n) * 1000) / 1000; }
function nearestSpot(player) {
    const pos = player.position;
    let best = null, bestD = SPOT_RANGE * SPOT_RANGE;
    for (const s of allSpots()) {
        const d = dist2(pos, s.spot);
        if (d <= bestD) { bestD = d; best = s; }
    }
    return best; // { lot, spot } or null
}
function activeRental(spotId) {
    const r = store.spots[spotId];
    if (!r) return null;
    if (r.expiresAt <= Date.now()) return null; // lapsed (the sweeper will free it shortly)
    return r;
}
function playerActiveSpot(player) {
    const key = keyOf(player);
    for (const spotId of Object.keys(store.spots)) {
        const r = store.spots[spotId];
        if (r.owner === key && r.expiresAt > Date.now()) return { spotId, rental: r };
    }
    return null;
}
function timeLeftLabel(expiresAt) {
    const ms = expiresAt - Date.now();
    if (ms <= 0) return 'ვადაგასული';
    const h = Math.floor(ms / (60 * 60 * 1000));
    if (h >= 24) return Math.floor(h / 24) + ' დღე ' + (h % 24) + ' სთ';
    if (h >= 1) return h + ' სთ';
    return Math.max(1, Math.floor(ms / 60000)) + ' წთ';
}

// ---- Blips + ground markers (server-side, visible to everyone) ----
// Map blip per spot (the car-footprint area itself is drawn client-side — see client_packages).
const spotVisuals = new Map(); // spotId -> { blip }
function createSpotVisuals(lot, spot) {
    let blip = null;
    try {
        blip = mp.blips.new((lot.blip && lot.blip.sprite) || 50, new mp.Vector3(spot.x, spot.y, spot.z),
            { name: spot.id, color: (lot.blip && lot.blip.color) || 3, scale: 0.7, shortRange: true });
    } catch (e) {}
    spotVisuals.set(spot.id, { blip });
}
function removeSpotVisuals(spotId) {
    const v = spotVisuals.get(spotId);
    if (!v) return;
    try { if (v.blip && v.blip.destroy) v.blip.destroy(); } catch (e) {}
    spotVisuals.delete(spotId);
}
allSpots().forEach(({ lot, spot }) => createSpotVisuals(lot, spot));

// ---- Push spot geometry + live free/rented status to clients so they can draw the footprints ----
const DEFAULT_W = 2.6, DEFAULT_L = 5.2; // car-sized footprint in metres
function spotsPayload() {
    return allSpots().map(({ spot }) => ({
        id: spot.id, x: spot.x, y: spot.y, z: spot.z, h: spot.h || 0,
        rx: spot.rx || 0, ry: spot.ry || 0,
        w: spot.w || DEFAULT_W, l: spot.l || DEFAULT_L,
        rented: !!activeRental(spot.id)
    }));
}
function broadcastSpots() {
    const json = JSON.stringify(spotsPayload());
    mp.players.forEach(p => { try { p.call('parking:spots', [json]); } catch (e) {} });
}
global.parkingBroadcast = broadcastSpots;
mp.events.add('playerReady', (player) => {
    setTimeout(() => {
        if (!mp.players.exists(player)) return;
        try { player.call('parking:spots', [JSON.stringify(spotsPayload())]); } catch (e) {}
        try { player.call('parking:admin', [!!(global.isProtectedAdmin && global.isProtectedAdmin(player))]); } catch (e) {}
    }, 3000);
});

// ---- Detail for the CEF UI: the requesting player's context for one spot ----
function carLabel(car, i) { return car.plate ? String(car.plate).trim() : ('მანქანა ' + (i + 1)); }
function uiDataFor(player, spotId) {
    const found = findSpot(spotId);
    if (!found) return null;
    const spot = found.spot;
    const rental = activeRental(spot.id);
    const mine = playerActiveSpot(player);
    const isMine = rental && rental.owner === keyOf(player);
    const impCount = (store.impound[keyOf(player)] || []).length;
    return {
        id: spot.id,
        price: spot.price,
        maxDays: MAX_RENT_DAYS,
        maxSlots: MAX_SLOTS,
        status: !rental ? 'free' : (isMine ? 'mine' : 'taken'),
        ownerName: rental ? rental.ownerName : null,
        timeLeft: isMine ? timeLeftLabel(rental.expiresAt) : null,
        slots: isMine ? rental.slots : 0,
        cars: isMine ? rental.cars.map((c, i) => ({ i, label: carLabel(c, i), fuel: Math.round(c.fuel) })) : [],
        inVehicle: !!(player.vehicle && mp.vehicles.exists(player.vehicle)),
        hasAnotherSpot: !!(mine && mine.spotId !== spot.id),
        hasPersonalCar: !!(player.myCar && mp.vehicles.exists(player.myCar)),
        impoundCount: impCount,
        summonFee: SUMMON_FEE,
        impoundFee: IMPOUND_FEE,
        money: global.getMoney ? global.getMoney(player) : 0,
        isAdmin: !!(global.isProtectedAdmin && global.isProtectedAdmin(player)),
        editable: found.lot === CUSTOM_LOT // only admin-placed spots can be geometry-edited
    };
}
function sendUiData(player, spotId, message, ok) {
    const data = uiDataFor(player, spotId);
    if (!data) return;
    if (message) { data.message = message; data.ok = !!ok; }
    try { player.call('parking:ui:data', [JSON.stringify(data)]); } catch (e) {}
}

// ---- Shared actions (used by both /commands and the CEF UI). Each returns { ok, msg }. ----
function doRent(player, found, days, slots) {
    if (!found) return { ok: false, msg: 'დადექი პარკინგის ადგილზე.' };
    if (playerActiveSpot(player)) return { ok: false, msg: 'უკვე გაქვს ნაქირავები ადგილი (გამოიყენე გაგრძელება).' };
    if (activeRental(found.spot.id)) return { ok: false, msg: 'ეს ადგილი დაკავებულია.' };
    days = parseInt(days, 10); if (!Number.isInteger(days) || days < 1) days = 1; if (days > MAX_RENT_DAYS) days = MAX_RENT_DAYS;
    slots = parseInt(slots, 10); if (!Number.isInteger(slots) || slots < 1) slots = 1; if (slots > MAX_SLOTS) slots = MAX_SLOTS;
    const cost = found.spot.price * slots * days;
    if (global.getMoney(player) < cost) return { ok: false, msg: `არასაკმარისი თანხა — საჭიროა $${cost}.` };
    global.setMoney(player, global.getMoney(player) - cost);
    store.spots[found.spot.id] = { owner: keyOf(player), ownerName: player.name, expiresAt: Date.now() + days * DAY_MS, slots, cars: [] };
    save(); broadcastSpots();
    return { ok: true, msg: `იქირავე ${found.spot.id} — ${slots} ადგილი, ${days} დღით — $${cost}.` };
}
function doRenew(player, days) {
    const mine = playerActiveSpot(player);
    if (!mine) return { ok: false, msg: 'ნაქირავები ადგილი არ გაქვს.' };
    const spotDef = findSpot(mine.spotId);
    days = parseInt(days, 10); if (!Number.isInteger(days) || days < 1) days = 1; if (days > MAX_RENT_DAYS) days = MAX_RENT_DAYS;
    const cost = spotDef.spot.price * mine.rental.slots * days;
    if (global.getMoney(player) < cost) return { ok: false, msg: `არასაკმარისი თანხა — საჭიროა $${cost}.` };
    global.setMoney(player, global.getMoney(player) - cost);
    mine.rental.expiresAt += days * DAY_MS; save(); broadcastSpots();
    return { ok: true, msg: `გააგრძელე ${mine.spotId} +${days} დღით — $${cost}. დარჩა ${timeLeftLabel(mine.rental.expiresAt)}.` };
}
function doPark(player) {
    const mine = playerActiveSpot(player);
    if (!mine) return { ok: false, msg: 'ჯერ იქირავე ადგილი.' };
    if (mine.rental.cars.length >= mine.rental.slots) return { ok: false, msg: `ადგილი სავსეა (${mine.rental.cars.length}/${mine.rental.slots}).` };
    const vehicle = player.vehicle;
    if (!vehicle || !mp.vehicles.exists(vehicle)) return { ok: false, msg: 'უნდა იჯდე მანქანაში.' };
    if (!player.myCar || Number(player.myCar.id) !== Number(vehicle.id)) return { ok: false, msg: 'მხოლოდ საკუთარ მანქანას აჩერებ.' };
    const spotDef = findSpot(mine.spotId);
    if (dist2(vehicle.position, spotDef.spot) > SPOT_RANGE * SPOT_RANGE) return { ok: false, msg: `მიიყვანე მანქანა ${mine.spotId}-ზე.` };
    const fuelVar = vehicle.getVariable('veh:fuel');
    mine.rental.cars.push({ model: vehicle.model, plate: vehicle.numberPlate || null, fuel: (typeof fuelVar === 'number') ? fuelVar : 100 });
    save();
    if (global.vehForget) global.vehForget(player);
    try { vehicle.destroy(); } catch (e) {}
    player.myCar = null;
    if (global.chatLocalAction) global.chatLocalAction(player, 'აყენებს მანქანას პარკინგზე');
    return { ok: true, msg: `მანქანა დააყენე — ${mine.rental.cars.length}/${mine.rental.slots} ადგილზე ${mine.spotId}.` };
}
function spawnCarAt(player, car, spot) {
    let vehicle;
    try {
        vehicle = mp.vehicles.new(car.model, new mp.Vector3(spot.x, spot.y, spot.z), { heading: spot.h || 0, dimension: 0, numberPlate: car.plate || undefined });
    } catch (e) { return null; }
    if (!vehicle) return null;
    if (global.vehAdopt) global.vehAdopt(player, vehicle, null, car.fuel); else player.myCar = vehicle;
    return vehicle;
}
function doUnpark(player, index) {
    const mine = playerActiveSpot(player);
    if (!mine) return { ok: false, msg: 'ნაქირავები ადგილი არ გაქვს.' };
    const cars = mine.rental.cars;
    index = parseInt(index, 10); if (!Number.isInteger(index) || index < 0) index = 0;
    if (!cars.length) return { ok: false, msg: 'ამ ადგილზე მანქანა არ დგას.' };
    if (index >= cars.length) index = 0;
    const spotDef = findSpot(mine.spotId);
    if (dist2(player.position, spotDef.spot) > SPOT_RANGE * SPOT_RANGE) return { ok: false, msg: 'მიდი შენს ადგილთან.' };
    if (player.myCar && mp.vehicles.exists(player.myCar)) return { ok: false, msg: 'ჯერ მოიშორე მიმდინარე მანქანა.' };
    const car = cars[index];
    if (!spawnCarAt(player, car, spotDef.spot)) return { ok: false, msg: 'მანქანის აღდგენა ვერ მოხერხდა.' };
    cars.splice(index, 1); save(); broadcastSpots();
    if (global.chatLocalAction) global.chatLocalAction(player, 'იღებს მანქანას პარკინგიდან');
    return { ok: true, msg: `გამოიყვანე მანქანა (საწვავი: ${Math.round(car.fuel)}%).` };
}
// Pay to bring your personal car to this spot even if you never parked it here.
function doSummon(player, spotId) {
    const found = findSpot(spotId);
    if (!found) return { ok: false, msg: 'უცნობი ადგილი.' };
    if (dist2(player.position, found.spot) > SPOT_RANGE * SPOT_RANGE) return { ok: false, msg: 'მიდი პარკინგის ადგილთან.' };
    if (!player.myCar || !mp.vehicles.exists(player.myCar)) return { ok: false, msg: 'შენი მანქანა ვერ მოიძებნა (გამოიძახე /car-ით).' };
    if (global.getMoney(player) < SUMMON_FEE) return { ok: false, msg: `საჭიროა $${SUMMON_FEE}.` };
    global.setMoney(player, global.getMoney(player) - SUMMON_FEE);
    try {
        player.myCar.position = new mp.Vector3(found.spot.x, found.spot.y, found.spot.z);
        player.myCar.rotation = new mp.Vector3(0, 0, found.spot.h || 0);
        if (global.vehPersist) global.vehPersist(player);
    } catch (e) { return { ok: false, msg: 'გადმოტანა ვერ მოხერხდა.' }; }
    return { ok: true, msg: `მანქანა გადმოტანილია აქ — $${SUMMON_FEE}.` };
}
// Pay to pull an impounded car; spawn it at `spot` (or IMPOUND_POINT for the /impound command).
function doImpound(player, spot) {
    const key = keyOf(player);
    const list = store.impound[key] || [];
    if (!list.length) return { ok: false, msg: 'დაყადაღებული მანქანა არ გაქვს.' };
    if (player.myCar && mp.vehicles.exists(player.myCar)) return { ok: false, msg: 'ჯერ მოიშორე მიმდინარე მანქანა.' };
    if (global.getMoney(player) < IMPOUND_FEE) return { ok: false, msg: `საჭიროა $${IMPOUND_FEE}.` };
    if (!spawnCarAt(player, list[0], spot)) return { ok: false, msg: 'გამოტანა ვერ მოხერხდა.' };
    global.setMoney(player, global.getMoney(player) - IMPOUND_FEE);
    list.shift();
    if (!list.length) delete store.impound[key]; else store.impound[key] = list;
    save();
    return { ok: true, msg: `მანქანა გამოტანილია — $${IMPOUND_FEE}.` };
}
function say(player, r) { player.outputChatBox((r.ok ? '!{#8ed17a}' : '!{#ff6b6b}') + '[პარკინგი] ' + r.msg); }

// Duplicate a spot N times sideways (along its width axis) with a gap, to the left or right.
function doDuplicate(player, base, side, count) {
    if (!(global.isProtectedAdmin && global.isProtectedAdmin(player))) return { ok: false, msg: 'მხოლოდ ადმინი.' };
    if (!base || typeof base.x !== 'number') return { ok: false, msg: 'ბაზური ადგილი ვერ მოიძებნა.' };
    count = parseInt(count, 10); if (!Number.isInteger(count) || count < 1) count = 5; if (count > 20) count = 20;
    const existing = store.customSpots.find(s => s.id === base.id);
    const price = existing ? existing.price : 50;
    const w = base.w || DEFAULT_W, gap = 0.7, step = w + gap;
    const dir = side === 'left' ? -1 : 1;
    const hr = (base.h || 0) * Math.PI / 180, ux = Math.cos(hr), uy = Math.sin(hr); // width axis
    for (let i = 1; i <= count; i++) {
        const spot = {
            id: nextSpotId(),
            x: round3(base.x + dir * i * step * ux), y: round3(base.y + dir * i * step * uy), z: round3(base.z),
            h: Math.round(base.h || 0), rx: Math.round(base.rx || 0), ry: Math.round(base.ry || 0),
            price, w: round3(w), l: round3(base.l || DEFAULT_L)
        };
        store.customSpots.push(spot);
        createSpotVisuals(CUSTOM_LOT, spot);
    }
    save(); broadcastSpots();
    return { ok: true, msg: `დაემატა ${count} ასლი (${side === 'left' ? 'მარცხნივ' : 'მარჯვნივ'}).` };
}

// ---- Commands ----
// /parkings — overview of lots, your rental and any impounded cars.
mp.events.addCommand('parkings', (player) => {
    player.outputChatBox('!{#7ec8ff}[პარკინგი] !{#ffffff}ხელმისაწვდომი პარკინგები:');
    LOTS.forEach(lot => {
        const free = lot.spots.filter(s => !activeRental(s.id)).length;
        player.outputChatBox(`!{#9aa4ad}• ${lot.name}: ${free}/${lot.spots.length} თავისუფალი · $${lot.spots[0].price}/დღე`);
    });
    const mine = playerActiveSpot(player);
    if (mine) {
        player.outputChatBox(`!{#8ed17a}შენი ადგილი: ${mine.spotId} · მანქანები ${mine.rental.cars.length}/${mine.rental.slots} (დარჩა ${timeLeftLabel(mine.rental.expiresAt)})`);
    } else {
        player.outputChatBox('!{#9aa4ad}დადექი თავისუფალ ადგილზე და დააჭირე E-ს.');
    }
    const imp = store.impound[keyOf(player)] || [];
    if (imp.length) player.outputChatBox(`!{#ffb42e}დაყადაღებული მანქანები: ${imp.length} — /impound (მოსაკრებელი $${IMPOUND_FEE}).`);
});

// Chat commands remain as a fallback; the CEF UI (press E on a spot) is the main path.
mp.events.addCommand('rentspot', (player, _, daysArg, slotsArg) => say(player, doRent(player, nearestSpot(player), daysArg, slotsArg)));
mp.events.addCommand('renewspot', (player, _, daysArg) => say(player, doRenew(player, daysArg)));
mp.events.addCommand('park', (player) => say(player, doPark(player)));
mp.events.addCommand('unpark', (player, _, idxArg) => say(player, doUnpark(player, (parseInt(idxArg, 10) || 1) - 1)));
mp.events.addCommand('impound', (player) => say(player, doImpound(player, IMPOUND_POINT)));

// ---- CEF UI wiring: press E on a spot opens ui/parking; these drive its buttons ----
mp.events.add('parking:uiData', (player, spotId) => sendUiData(player, String(spotId)));
mp.events.add('parking:rent', (player, spotId, days, slots) => { const r = doRent(player, findSpot(String(spotId)), days, slots); sendUiData(player, String(spotId), r.msg, r.ok); });
mp.events.add('parking:renew', (player, spotId, days) => { const r = doRenew(player, days); sendUiData(player, String(spotId), r.msg, r.ok); });
mp.events.add('parking:park', (player, spotId) => { const r = doPark(player); sendUiData(player, String(spotId), r.msg, r.ok); });
mp.events.add('parking:unpark', (player, spotId, index) => { const r = doUnpark(player, index); sendUiData(player, String(spotId), r.msg, r.ok); });
mp.events.add('parking:summon', (player, spotId) => { const r = doSummon(player, String(spotId)); sendUiData(player, String(spotId), r.msg, r.ok); });
mp.events.add('parking:impound', (player, spotId) => { const f = findSpot(String(spotId)); const r = doImpound(player, f ? f.spot : IMPOUND_POINT); sendUiData(player, String(spotId), r.msg, r.ok); });
mp.events.add('parking:duplicate', (player, json, side, count) => { let d; try { d = JSON.parse(json); } catch (e) { return; } say(player, doDuplicate(player, d, String(side), count)); });

// ---- Admin geometry edit (move / rotate / resize), applied from the client editor ----
mp.events.add('parking:edit', (player, json) => {
    if (!(global.isProtectedAdmin && global.isProtectedAdmin(player))) return;
    let d; try { d = JSON.parse(json); } catch (e) { return; }
    const spot = store.customSpots.find(s => s.id === d.id);
    if (!spot) { player.outputChatBox('!{#ff6b6b}[პარკინგი] მხოლოდ ხელით დამატებული ადგილი რედაქტირდება.'); return; }
    if (typeof d.x === 'number') spot.x = round3(d.x);
    if (typeof d.y === 'number') spot.y = round3(d.y);
    if (typeof d.z === 'number') spot.z = round3(d.z);
    if (typeof d.h === 'number') spot.h = Math.round(d.h);
    if (typeof d.rx === 'number') spot.rx = Math.max(-45, Math.min(45, Math.round(d.rx)));
    if (typeof d.ry === 'number') spot.ry = Math.max(-45, Math.min(45, Math.round(d.ry)));
    if (typeof d.w === 'number') spot.w = Math.max(1.6, Math.min(6, round3(d.w)));
    if (typeof d.l === 'number') spot.l = Math.max(3, Math.min(12, round3(d.l)));
    save();
    removeSpotVisuals(spot.id); createSpotVisuals(CUSTOM_LOT, spot);
    broadcastSpots();
    player.outputChatBox(`!{#8ed17a}[პარკინგი] ${spot.id} განახლდა.`);
});

// Remove a spot (from the editor Del key or the UI delete button). Admin-only, custom spots only.
mp.events.add('parking:removeSpot', (player, spotId) => {
    if (!(global.isProtectedAdmin && global.isProtectedAdmin(player))) return;
    const id = String(spotId);
    const idx = store.customSpots.findIndex(s => s.id === id);
    if (idx < 0) { player.outputChatBox('!{#ff6b6b}[პარკინგი] მხოლოდ ხელით დამატებული ადგილი იშლება.'); return; }
    if (store.spots[id]) delete store.spots[id]; // free any active rental on it
    store.customSpots.splice(idx, 1); save();
    removeSpotVisuals(id);
    broadcastSpots();
    player.outputChatBox(`!{#8ed17a}[პარკინგი] წაიშალა ${id}.`);
});

// ---- Admin: place / remove parking spots in-game ----
function ensureAdmin(player) {
    // Protected admins (FLY_ADMINS in packages/admin) can place spots directly — no Admin Mode toggle needed.
    if (global.isProtectedAdmin && global.isProtectedAdmin(player)) return true;
    player.outputChatBox('!{#ff6b6b}[პარკინგი] ეს ბრძანება მხოლოდ ადმინისთვისაა.');
    return false;
}

// /addparkspot [price] — create a spot where you stand, facing your heading. Prints the new ID.
mp.events.addCommand('addparkspot', (player, _, priceArg) => {
    if (!ensureAdmin(player)) return;
    let price = parseInt(priceArg, 10);
    if (!Number.isInteger(price) || price < 0) price = 50;
    const pos = player.position;
    const spot = { id: nextSpotId(), x: round3(pos.x), y: round3(pos.y), z: round3(pos.z), h: Math.round(Number(player.heading) || 0), rx: 0, ry: 0, price, w: DEFAULT_W, l: DEFAULT_L };
    store.customSpots.push(spot); save();
    createSpotVisuals(CUSTOM_LOT, spot);
    broadcastSpots();
    console.log(`[parking] ${player.name} (${keyOf(player)}) added spot ${spot.id} at (${spot.x}, ${spot.y}, ${spot.z}) h:${spot.h} $${price}`);
    player.outputChatBox(`!{#8ed17a}[პარკინგი] ✔ ადგილი შექმნილია — ID: !{#ffd24b}${spot.id} !{#8ed17a}· $${price}/დღე`);
    player.outputChatBox(`!{#9aa4ad}(${spot.x}, ${spot.y}, ${spot.z}) h:${spot.h} · წასაშლელად: /delparkspot ${spot.id}`);
});

// /delparkspot <id> — remove an admin-placed spot (frees any rental on it).
mp.events.addCommand('delparkspot', (player, _, idArg) => {
    if (!ensureAdmin(player)) return;
    const id = String(idArg || '').trim();
    const idx = store.customSpots.findIndex(s => s.id === id);
    if (idx < 0) return player.outputChatBox('!{#ff6b6b}[პარკინგი] ასეთი ID ვერ მოიძებნა (მხოლოდ ხელით დამატებული ადგილები იშლება).');
    if (store.spots[id]) delete store.spots[id];
    store.customSpots.splice(idx, 1); save();
    removeSpotVisuals(id);
    broadcastSpots();
    player.outputChatBox(`!{#8ed17a}[პარკინგი] წაიშალა ადგილი ${id}.`);
});

// /parkspots — list every spot id + coords (admin helper for tuning/following).
mp.events.addCommand('parkspots', (player) => {
    if (!ensureAdmin(player)) return;
    player.outputChatBox('!{#7ec8ff}[პარკინგი] ყველა ადგილი:');
    allSpots().forEach(({ spot }) => {
        const r = activeRental(spot.id);
        player.outputChatBox(`!{#9aa4ad}${spot.id}: (${round3(spot.x)}, ${round3(spot.y)}, ${round3(spot.z)}) $${spot.price}/დღე ${r ? '· დაკავებული' : '· თავისუფალი'}`);
    });
});

// ---- Expiry sweeper: free lapsed spots, impound any car left on them ----
setInterval(() => {
    const now = Date.now();
    let changed = false;
    for (const spotId of Object.keys(store.spots)) {
        const r = store.spots[spotId];
        if (r.expiresAt > now) continue;
        if (r.car) { // impound the stored car for the owner
            if (!store.impound[r.owner]) store.impound[r.owner] = [];
            store.impound[r.owner].push(Object.assign({}, r.car, { from: spotId, at: now }));
            let owner = null;
            mp.players.forEach(p => { if (!owner && keyOf(p) === r.owner) owner = p; });
            if (owner) owner.outputChatBox(`!{#ffb42e}[პარკინგი] ${spotId}-ის ქირა ამოიწურა — მანქანა დაყადაღდა. /impound რომ დაიბრუნო.`);
        }
        delete store.spots[spotId];
        changed = true;
    }
    if (changed) { save(); broadcastSpots(); }
}, 60 * 1000);
