// ===================== Parking: rentable personal spots =====================
// Players rent a specific numbered parking spot (upfront, for N days). While the rental is active the
// spot is their private garage point: they can spawn any car they own there for FREE, and if a car is
// already out in the world they can RECALL it (teleport it to the spot) for a fee. Nothing is stored
// on the spot — the canonical fleet is the MySQL vehicles table (what /mycars lists). Rentals persist
// to parking.json across restarts.
//
// Money API: global.getMoney/setMoney (economy). Owned-car spawn: global.carshopSpawnOwnedCar
// (carshop). Car persistence: global.vehPersist (vehicles). Nearby RP lines: global.chatLocalAction.

const fs = require('fs');
const path = require('path');

const DATA_FILE = path.join(__dirname, 'parking.json');
const DAY_MS = 24 * 60 * 60 * 1000;
const SPOT_RANGE = 4.5;          // metres you must be within to rent / spawn / recall
const MAX_RENT_DAYS = 30;
const RECALL_FEE = 1000;         // bring a car that is already out in the world to your spot

// ---- Config: parking lots and their spots. Add your own here — grab coords in-game with /pos. ----
// Each spot: id, x/y/z (ground level), h (heading a spawned car faces), price (per day).
// No fixed lots — parking spots are now admin-placed (stored in parking.json customSpots).
const LOTS = [];

// ---- Persistence ----
// spots: spotId -> rental { owner, ownerName, expiresAt }; customSpots: admin-placed spot definitions.
let store = { spots: {}, customSpots: [] };
try {
    const loaded = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    if (loaded && typeof loaded === 'object') store = { spots: loaded.spots || {}, customSpots: loaded.customSpots || [] };
} catch (e) { store = { spots: {}, customSpots: [] }; }
// Storage was removed: drop any legacy stored-car blobs / slot capacities left on rentals. The cars
// still exist as DB rows (parking only ever despawned them), so they stay respawnable for free.
Object.keys(store.spots).forEach(id => {
    const r = store.spots[id];
    delete r.cars; delete r.car; delete r.slots;
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

// Phone "parking finder" data: the player's OWN rented spot (if any) plus every FREE spot, each with
// its daily price and straight-line distance, sorted nearest-first. Spots taken by others are hidden.
// The UI pins the player's own spot, or the nearest free one if they don't rent any.
global.parkingPhoneData = function (player) {
    if (!player || !mp.players.exists(player)) return [];
    const key = keyOf(player), pos = player.position;
    const list = [];
    for (const { spot } of allSpots()) {
        const rental = activeRental(spot.id);
        const mine = !!(rental && rental.owner === key);
        if (rental && !mine) continue; // taken by someone else — hide
        const dx = spot.x - pos.x, dy = spot.y - pos.y;
        list.push({
            id: spot.id, price: spot.price, x: round3(spot.x), y: round3(spot.y),
            dist: Math.round(Math.sqrt(dx * dx + dy * dy)), mine
        });
    }
    list.sort((a, b) => a.dist - b.dist);
    return list;
};

// ---- Map blips: one garage icon per big parking lot (visible to everyone) ----
// Individual spots intentionally have NO map symbol — their car-footprint areas are drawn client-side.
// Only these labelled garage markers show on the map. Add a lot here to give it a map marker.
const GARAGE_BLIPS = [
    { x: 233.936, y: -781.141, z: 30.681, sprite: 50, color: 3, name: 'დიდი პარკინგი' },
    { x: 419.115, y: -1332.447, z: 31.053, sprite: 50, color: 3, name: 'დიდი პარკინგი' },
];
GARAGE_BLIPS.forEach(b => {
    try {
        mp.blips.new(b.sprite, new mp.Vector3(b.x, b.y, b.z),
            { name: b.name, color: b.color, scale: 0.9, shortRange: false });
    } catch (e) {}
});
// Per-spot blips were removed; these stay as no-ops so the add/edit/remove spot paths stay simple.
function createSpotVisuals() {}
function removeSpotVisuals() {}

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
async function ownedVehiclesFor(player) {
    if (!player.character || !player.character.id || !global.api || typeof global.api.loadVehicles !== 'function') {
        throw new Error('character vehicle API is unavailable');
    }
    const rows = await global.api.loadVehicles(player.character.id);
    if (!Array.isArray(rows)) throw new Error('character vehicle API returned an invalid list');
    return rows;
}
// How many cars the player owns (min 1) — the rent/renew price multiplier. Falls back to 1 if the API
// is unavailable so renting never hard-fails.
async function ownedCarCount(player) {
    try { return Math.max(1, (await ownedVehiclesFor(player)).length); }
    catch (e) { return 1; }
}
// Is this owned row currently sitting in a house garage? (Those can't be spawned from parking.)
function isInGarage(player, row) {
    const garageCar = typeof global.vehGarageCar === 'function' ? global.vehGarageCar(player) : null;
    if (!garageCar) return false;
    const id = String(row.id), model = Number(row.model);
    return (garageCar.dbId !== null && garageCar.dbId !== undefined && String(garageCar.dbId) === id)
        || ((garageCar.dbId === null || garageCar.dbId === undefined) && Number(garageCar.model) === model);
}
async function uiDataFor(player, spotId) {
    const found = findSpot(spotId);
    if (!found) return null;
    const spot = found.spot;
    const rental = activeRental(spot.id);
    const isMine = !!(rental && rental.owner === keyOf(player));
    const hasActiveCar = !!(player.myCar && mp.vehicles.exists(player.myCar));
    // Is the active car physically on this spot? (If so it can be SAVED here for free instead of recalled.)
    const activeOnSpot = hasActiveCar && dist2(player.myCar.position, spot) <= SPOT_RANGE * SPOT_RANGE;

    let ownedRows = [], ownedCarsError = false;
    try { ownedRows = await ownedVehiclesFor(player); }
    catch (e) {
        ownedCarsError = true;
        console.log(`[parking] could not load vehicles for ${player.name}: ${e && e.message}`);
    }
    const carCount = Math.max(1, ownedRows.length); // rent/renew price scales with fleet size
    return {
        id: spot.id,
        price: spot.price,
        carCount,
        maxDays: MAX_RENT_DAYS,
        status: !rental ? 'free' : (isMine ? 'mine' : 'taken'),
        ownerName: rental ? rental.ownerName : null,
        timeLeft: isMine ? timeLeftLabel(rental.expiresAt) : null,
        recallFee: RECALL_FEE,
        activeOnSpot,
        money: global.getMoney ? global.getMoney(player) : 0,
        isAdmin: !!(global.isProtectedAdmin && global.isProtectedAdmin(player)),
        editable: found.lot === CUSTOM_LOT, // only admin-placed spots can be geometry-edited
        ownedCarsError,
        ownedCars: ownedRows.map(row => {
            const label = typeof global.carshopLabelOf === 'function'
                ? global.carshopLabelOf(row.modelName)
                : (row.modelName || 'მანქანა');
            const isActive = hasActiveCar && String(player.activeVehId) === String(row.id);
            const status = isActive ? 'active' : (isInGarage(player, row) ? 'garage' : 'available');
            return {
                id: String(row.id),
                label: String(label),
                plate: row.plate ? String(row.plate) : '',
                fuel: Math.round(Number(row.fuel) || 0),
                status
            };
        }),
    };
}
async function sendUiData(player, spotId, message, ok) {
    const data = await uiDataFor(player, spotId);
    if (!data) return;
    if (message) { data.message = message; data.ok = !!ok; }
    try { player.call('parking:ui:data', [JSON.stringify(data)]); } catch (e) {}
}

// ---- Shared actions (used by both /commands and the CEF UI). Each returns { ok, msg }. ----
// One rental per player: renting a new spot auto-releases the player's previous one.
// Price scales with the player's fleet size: price × car_quantity × days.
async function doRent(player, found, days) {
    if (!found) return { ok: false, msg: 'დადექი პარკინგის ადგილზე.' };
    if (dist2(player.position, found.spot) > SPOT_RANGE * SPOT_RANGE) return { ok: false, msg: 'დადექი პარკინგის ადგილზე.' };
    const existing = activeRental(found.spot.id);
    if (existing) return { ok: false, msg: existing.owner === keyOf(player) ? 'ეს ადგილი უკვე შენია (გამოიყენე გაგრძელება).' : 'ეს ადგილი დაკავებულია.' };
    days = parseInt(days, 10); if (!Number.isInteger(days) || days < 1) days = 1; if (days > MAX_RENT_DAYS) days = MAX_RENT_DAYS;
    const qty = await ownedCarCount(player);
    if (!mp.players.exists(player)) return { ok: false, msg: 'მოთამაშე აღარ არის დაკავშირებული.' };
    const cost = found.spot.price * qty * days;
    if (global.getMoney(player) < cost) return { ok: false, msg: `არასაკმარისი თანხა — საჭიროა $${cost}.` };
    // Re-check the spot wasn't taken while we awaited the car count.
    const occupiedAfterLoad = activeRental(found.spot.id);
    if (occupiedAfterLoad) return { ok: false, msg: occupiedAfterLoad.owner === keyOf(player) ? 'ეს ადგილი უკვე შენია (გამოიყენე გაგრძელება).' : 'ეს ადგილი დაკავებულია.' };
    const previous = playerActiveSpot(player); // the one-and-only spot we'll auto-free on success
    global.setMoney(player, global.getMoney(player) - cost);
    let freedNote = '';
    if (previous && previous.spotId !== found.spot.id) {
        delete store.spots[previous.spotId];
        freedNote = ` წინა ადგილი ${previous.spotId} გათავისუფლდა.`;
    }
    store.spots[found.spot.id] = { owner: keyOf(player), ownerName: player.name, expiresAt: Date.now() + days * DAY_MS };
    save(); broadcastSpots();
    return { ok: true, msg: `იქირავე ${found.spot.id} — ${qty} მანქ. × ${days} დღით — $${cost}.${freedNote}` };
}
async function doRenew(player, days) {
    const mine = playerActiveSpot(player);
    if (!mine) return { ok: false, msg: 'ნაქირავები ადგილი არ გაქვს.' };
    const spotDef = findSpot(mine.spotId);
    if (!spotDef || dist2(player.position, spotDef.spot) > SPOT_RANGE * SPOT_RANGE) return { ok: false, msg: 'მიდი შენს პარკინგის ადგილთან.' };
    days = parseInt(days, 10); if (!Number.isInteger(days) || days < 1) days = 1; if (days > MAX_RENT_DAYS) days = MAX_RENT_DAYS;
    const qty = await ownedCarCount(player);
    if (!mp.players.exists(player)) return { ok: false, msg: 'მოთამაშე აღარ არის დაკავშირებული.' };
    const cost = spotDef.spot.price * qty * days;
    if (global.getMoney(player) < cost) return { ok: false, msg: `არასაკმარისი თანხა — საჭიროა $${cost}.` };
    global.setMoney(player, global.getMoney(player) - cost);
    mine.rental.expiresAt += days * DAY_MS; save(); broadcastSpots();
    return { ok: true, msg: `გააგრძელე ${mine.spotId} +${days} დღით (${qty} მანქ.) — $${cost}. დარჩა ${timeLeftLabel(mine.rental.expiresAt)}.` };
}
// Is a (non-display) vehicle already sitting on the spot? Keeps us from spawning cars on top of each other.
function spotIsOccupied(spot) {
    let occupied = false;
    mp.vehicles.forEach(vehicle => {
        if (occupied || !vehicle || !mp.vehicles.exists(vehicle) || Number(vehicle.dimension) !== 0) return;
        if (dist2(vehicle.position, spot) < 2.3 * 2.3) occupied = true;
    });
    return occupied;
}
// Spawn one of the player's owned cars at their rented spot — FREE. Spawning while another car is out
// just swaps it (carshopSpawnOwnedCar saves the old one to its DB row first).
async function doSpawnOwned(player, spotId, vehicleId) {
    if (player.ownedVehicleSpawnInProgress) return { ok: false, msg: 'მანქანის გამოყვანა უკვე მიმდინარეობს.' };
    player.ownedVehicleSpawnInProgress = true;
    try {
        const found = findSpot(spotId);
        if (!found) return { ok: false, msg: 'უცნობი ადგილი.' };
        const rental = activeRental(found.spot.id);
        if (!rental || rental.owner !== keyOf(player)) return { ok: false, msg: 'ჯერ იქირავე ეს ადგილი.' };
        if (dist2(player.position, found.spot) > SPOT_RANGE * SPOT_RANGE) return { ok: false, msg: 'მიდი შენს პარკინგის ადგილთან.' };
        if (!/^\d+$/.test(String(vehicleId || ''))) return { ok: false, msg: 'მანქანის ID არასწორია.' };
        if (typeof global.carshopSpawnOwnedCar !== 'function') return { ok: false, msg: 'მანქანის გამოყვანის სისტემა მიუწვდომელია.' };

        const rows = await ownedVehiclesFor(player);
        if (!mp.players.exists(player)) return { ok: false, msg: 'მოთამაშე აღარ არის დაკავშირებული.' };
        const row = rows.find(vehicle => String(vehicle.id) === String(vehicleId));
        if (!row) return { ok: false, msg: 'ეს მანქანა შენს ანგარიშზე ვერ მოიძებნა.' };
        if (hasActiveId(player, row.id)) return { ok: false, msg: 'ეს მანქანა უკვე გამოყვანილია (გამოიყენე დაბრუნება).' };
        if (isInGarage(player, row)) return { ok: false, msg: 'ეს მანქანა სახლის ავტოფარეხშია.' };
        if (dist2(player.position, found.spot) > SPOT_RANGE * SPOT_RANGE) return { ok: false, msg: 'მიდი შენს პარკინგის ადგილთან.' };
        if (spotIsOccupied(found.spot)) return { ok: false, msg: 'პარკინგის ადგილი დაკავებულია.' };

        const vehicle = global.carshopSpawnOwnedCar(player, row, found.spot);
        if (!vehicle || !mp.vehicles.exists(vehicle)) return { ok: false, msg: 'მანქანის გამოყვანა ვერ მოხერხდა.' };
        if (global.chatLocalAction) global.chatLocalAction(player, 'იღებს მანქანას პარკინგიდან');
        return { ok: true, msg: `${typeof global.carshopLabelOf === 'function' ? global.carshopLabelOf(row.modelName) : 'მანქანა'} გამოყვანილია.` };
    } catch (e) {
        console.log(`[parking] could not spawn owned vehicle for ${player.name}: ${e && e.message}`);
        return { ok: false, msg: 'მანქანის სიის ჩატვირთვა ან გამოყვანა ვერ მოხერხდა.' };
    } finally {
        player.ownedVehicleSpawnInProgress = false;
    }
}
function hasActiveId(player, id) {
    return !!(player.myCar && mp.vehicles.exists(player.myCar) && String(player.activeVehId) === String(id));
}
// Recall your currently-spawned car to your rented spot for a fee.
function doRecall(player, spotId) {
    const found = findSpot(spotId);
    if (!found) return { ok: false, msg: 'უცნობი ადგილი.' };
    const rental = activeRental(found.spot.id);
    if (!rental || rental.owner !== keyOf(player)) return { ok: false, msg: 'ჯერ იქირავე ეს ადგილი.' };
    if (dist2(player.position, found.spot) > SPOT_RANGE * SPOT_RANGE) return { ok: false, msg: 'მიდი შენს პარკინგის ადგილთან.' };
    if (!player.myCar || !mp.vehicles.exists(player.myCar)) return { ok: false, msg: 'გამოყვანილი მანქანა არ გაქვს.' };
    if (global.getMoney(player) < RECALL_FEE) return { ok: false, msg: `საჭიროა $${RECALL_FEE}.` };
    global.setMoney(player, global.getMoney(player) - RECALL_FEE);
    try {
        player.myCar.position = new mp.Vector3(found.spot.x, found.spot.y, found.spot.z);
        player.myCar.rotation = new mp.Vector3(0, 0, found.spot.h || 0);
        if (global.vehPersist) global.vehPersist(player);
    } catch (e) { return { ok: false, msg: 'დაბრუნება ვერ მოხერხდა.' }; }
    if (global.chatLocalAction) global.chatLocalAction(player, 'იბრუნებს მანქანას პარკინგზე');
    return { ok: true, msg: `მანქანა დაბრუნდა აქ — $${RECALL_FEE}.` };
}
// Save (put away) the car you brought onto your spot: persist its live state to its DB row, then
// despawn it. Free. It stays in your fleet and can be respawned here (or anywhere) later.
function doStoreCar(player, spotId) {
    const found = findSpot(spotId);
    if (!found) return { ok: false, msg: 'უცნობი ადგილი.' };
    const rental = activeRental(found.spot.id);
    if (!rental || rental.owner !== keyOf(player)) return { ok: false, msg: 'ჯერ იქირავე ეს ადგილი.' };
    if (!player.myCar || !mp.vehicles.exists(player.myCar)) return { ok: false, msg: 'გამოყვანილი მანქანა არ გაქვს.' };
    if (dist2(player.myCar.position, found.spot) > SPOT_RANGE * SPOT_RANGE) return { ok: false, msg: 'მანქანა პარკინგის ადგილზე უნდა იდგეს.' };
    if (player.activeVehId && typeof global.vehSaveActiveToDb === 'function') global.vehSaveActiveToDb(player); // persist fuel/km/pos to DB
    if (global.vehForget) global.vehForget(player); // stop local persistence
    try { player.myCar.destroy(); } catch (e) {}
    player.myCar = null;
    player.activeVehId = null;
    if (global.chatLocalAction) global.chatLocalAction(player, 'აყენებს მანქანას პარკინგზე');
    return { ok: true, msg: 'მანქანა შენახულია.' };
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
// /parkings — overview of lots and your rental.
mp.events.addCommand('parkings', (player) => {
    player.outputChatBox('!{#7ec8ff}[პარკინგი] !{#ffffff}ხელმისაწვდომი პარკინგები:');
    LOTS.forEach(lot => {
        const free = lot.spots.filter(s => !activeRental(s.id)).length;
        player.outputChatBox(`!{#9aa4ad}• ${lot.name}: ${free}/${lot.spots.length} თავისუფალი · $${lot.spots[0].price}/დღე`);
    });
    const mine = playerActiveSpot(player);
    if (mine) {
        player.outputChatBox(`!{#8ed17a}შენი ადგილი: ${mine.spotId} (დარჩა ${timeLeftLabel(mine.rental.expiresAt)})`);
    } else {
        player.outputChatBox('!{#9aa4ad}დადექი თავისუფალ ადგილზე და დააჭირე E-ს.');
    }
});

// Chat commands remain as a fallback; the CEF UI (press E on a spot) is the main path.
mp.events.addCommand('rentspot', async (player, _, daysArg) => say(player, await doRent(player, nearestSpot(player), daysArg)));
mp.events.addCommand('renewspot', async (player, _, daysArg) => say(player, await doRenew(player, daysArg)));
mp.events.addCommand('recallcar', (player) => {
    const mine = playerActiveSpot(player);
    say(player, mine ? doRecall(player, mine.spotId) : { ok: false, msg: 'ნაქირავები ადგილი არ გაქვს.' });
});
mp.events.addCommand('storecar', (player) => {
    const mine = playerActiveSpot(player);
    say(player, mine ? doStoreCar(player, mine.spotId) : { ok: false, msg: 'ნაქირავები ადგილი არ გაქვს.' });
});

// ---- CEF UI wiring: press E on a spot opens ui/parking; these drive its buttons ----
mp.events.add('parking:uiData', (player, spotId) => sendUiData(player, String(spotId)));
mp.events.add('parking:rent', async (player, spotId, days) => { const r = await doRent(player, findSpot(String(spotId)), days); sendUiData(player, String(spotId), r.msg, r.ok); });
mp.events.add('parking:renew', async (player, spotId, days) => { const r = await doRenew(player, days); sendUiData(player, String(spotId), r.msg, r.ok); });
mp.events.add('parking:summonOwned', async (player, spotId, vehicleId) => {
    const r = await doSpawnOwned(player, String(spotId), vehicleId);
    sendUiData(player, String(spotId), r.msg, r.ok);
});
mp.events.add('parking:recall', (player, spotId) => { const r = doRecall(player, String(spotId)); sendUiData(player, String(spotId), r.msg, r.ok); });
mp.events.add('parking:store', (player, spotId) => { const r = doStoreCar(player, String(spotId)); sendUiData(player, String(spotId), r.msg, r.ok); });
mp.events.add('parking:duplicate', (player, json, side, count) => { let d; try { d = JSON.parse(json); } catch (e) { return; } say(player, doDuplicate(player, d, String(side), count)); });

// Arrow "copy by gap": create ONE spot at the client-computed position (full geometry carried over).
// No chat spam — arrows are pressed rapidly while laying out a lot; the copy just appears as a blip.
mp.events.add('parking:stamp', (player, json) => {
    if (!(global.isProtectedAdmin && global.isProtectedAdmin(player))) return;
    let d; try { d = JSON.parse(json); } catch (e) { return; }
    if (typeof d.x !== 'number' || typeof d.y !== 'number') return;
    const existing = store.customSpots.find(s => s.id === d.id);
    const price = existing ? existing.price : (typeof d.price === 'number' ? d.price : 50);
    const spot = {
        id: nextSpotId(),
        x: round3(d.x), y: round3(d.y), z: round3(d.z || 0),
        h: Math.round(d.h || 0), rx: Math.round(d.rx || 0), ry: Math.round(d.ry || 0),
        price, w: round3(d.w || DEFAULT_W), l: round3(d.l || DEFAULT_L)
    };
    store.customSpots.push(spot);
    createSpotVisuals(CUSTOM_LOT, spot);
    save(); broadcastSpots();
});

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

// ---- Expiry sweeper: free lapsed spots ----
setInterval(() => {
    const now = Date.now();
    let changed = false;
    for (const spotId of Object.keys(store.spots)) {
        const r = store.spots[spotId];
        if (r.expiresAt > now) continue;
        delete store.spots[spotId];
        let owner = null;
        mp.players.forEach(p => { if (!owner && keyOf(p) === r.owner) owner = p; });
        if (owner) owner.outputChatBox(`!{#ffb42e}[პარკინგი] ${spotId}-ის ქირა ამოიწურა.`);
        changed = true;
    }
    if (changed) { save(); broadcastSpots(); }
}, 60 * 1000);
