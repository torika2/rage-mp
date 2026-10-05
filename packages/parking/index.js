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
// How many cars the player owns: the canonical fleet is the MySQL vehicles table (what /mycars lists,
// via global.api). Parking capacity is auto-set to this so the player's whole fleet fits. Falls back
// to a local estimate (active car + stored + impounded) if the API/character isn't available.
async function ownedCarCount(player) {
    try {
        if (global.api && player.character && player.character.id) {
            const list = await global.api.loadVehicles(player.character.id);
            if (Array.isArray(list)) return list.length;
        }
    } catch (e) {}
    let count = 0;
    if (player.myCar && mp.vehicles.exists(player.myCar)) count++;
    const mine = playerActiveSpot(player);
    if (mine) count += mine.rental.cars.length;
    count += (store.impound[keyOf(player)] || []).length;
    return count;
}
// Capacity the player would get on a fresh rental: their owned-car count, at least 1, capped at MAX_SLOTS.
async function autoSlotsFor(player, knownCount) {
    const count = Number.isInteger(knownCount) ? knownCount : await ownedCarCount(player);
    return Math.max(1, Math.min(MAX_SLOTS, count));
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
mp.events.add('playerEnterVehicle', (player, vehicle, seat) => { player.parkingVehicleSeat = seat; });
mp.events.add('playerExitVehicle', (player) => { player.parkingVehicleSeat = null; });

// ---- Detail for the CEF UI: the requesting player's context for one spot ----
function carLabel(car, i) { return car.plate ? String(car.plate).trim() : ('მანქანა ' + (i + 1)); }
async function ownedVehiclesFor(player) {
    if (!player.character || !player.character.id || !global.api || typeof global.api.loadVehicles !== 'function') {
        throw new Error('character vehicle API is unavailable');
    }
    const rows = await global.api.loadVehicles(player.character.id);
    if (!Array.isArray(rows)) throw new Error('character vehicle API returned an invalid list');
    return rows;
}
function storedOwnedCarStatus(player, row) {
    const owner = keyOf(player), id = String(row.id), model = Number(row.model);
    const garageCar = typeof global.vehGarageCar === 'function' ? global.vehGarageCar(player) : null;
    if (garageCar && ((garageCar.dbId !== null && String(garageCar.dbId) === id) || (!garageCar.dbId && Number(garageCar.model) === model))) {
        return 'garage';
    }
    let status = null;
    const inspect = (car, storedStatus) => {
        if (car && car.dbId !== undefined && car.dbId !== null && String(car.dbId) === id) status = storedStatus;
        else if (car && (car.dbId === undefined || car.dbId === null) && Number(car.model) === model && !status) status = 'stored';
    };
    Object.keys(store.spots).forEach(spotId => {
        const rental = store.spots[spotId];
        if (rental && rental.owner === owner && Array.isArray(rental.cars)) rental.cars.forEach(car => inspect(car, 'parked'));
    });
    (store.impound[owner] || []).forEach(car => inspect(car, 'impound'));
    return status;
}
async function uiDataFor(player, spotId) {
    const found = findSpot(spotId);
    if (!found) return null;
    const spot = found.spot;
    const rental = activeRental(spot.id);
    const mine = playerActiveSpot(player);
    const isMine = rental && rental.owner === keyOf(player);
    const impCount = (store.impound[keyOf(player)] || []).length;
    let ownedRows = [], ownedCarsError = false;
    try { ownedRows = await ownedVehiclesFor(player); }
    catch (e) {
        ownedCarsError = true;
        console.log(`[parking] could not load vehicles for ${player.name}: ${e && e.message}`);
    }
    const hasCurrentCar = !!(player.myCar && mp.vehicles.exists(player.myCar));
    return {
        id: spot.id,
        price: spot.price,
        maxDays: MAX_RENT_DAYS,
        maxSlots: MAX_SLOTS,
        status: !rental ? 'free' : (isMine ? 'mine' : 'taken'),
        ownerName: rental ? rental.ownerName : null,
        timeLeft: isMine ? timeLeftLabel(rental.expiresAt) : null,
        slots: isMine ? rental.slots : 0,
        autoSlots: await autoSlotsFor(player, ownedCarsError ? undefined : ownedRows.length), // capacity a fresh rental here would get (= cars owned)
        cars: isMine ? rental.cars.map((c, i) => ({ i, label: carLabel(c, i), fuel: Math.round(c.fuel) })) : [],
        inVehicle: !!(player.vehicle && mp.vehicles.exists(player.vehicle)),
        hasAnotherSpot: !!(mine && mine.spotId !== spot.id),
        hasPersonalCar: hasCurrentCar,
        hasCurrentCar,
        ownedCarsError,
        ownedCars: ownedRows.map(row => {
            const label = typeof global.carshopLabelOf === 'function'
                ? global.carshopLabelOf(row.modelName)
                : (row.modelName || 'მანქანა');
            const storedStatus = storedOwnedCarStatus(player, row);
            const isActive = hasCurrentCar && String(player.activeVehId) === String(row.id);
            return {
                id: String(row.id),
                label: String(label),
                plate: row.plate ? String(row.plate) : '',
                fuel: Math.round(Number(row.fuel) || 0),
                status: storedStatus || (isActive ? 'active' : (hasCurrentCar ? 'current' : 'available'))
            };
        }),
        impoundCount: impCount,
        summonFee: SUMMON_FEE,
        impoundFee: IMPOUND_FEE,
        money: global.getMoney ? global.getMoney(player) : 0,
        isAdmin: !!(global.isProtectedAdmin && global.isProtectedAdmin(player)),
        editable: found.lot === CUSTOM_LOT // only admin-placed spots can be geometry-edited
    };
}
async function sendUiData(player, spotId, message, ok) {
    const data = await uiDataFor(player, spotId);
    if (!data) return;
    if (message) { data.message = message; data.ok = !!ok; }
    try { player.call('parking:ui:data', [JSON.stringify(data)]); } catch (e) {}
}

// Free a rental: impound any cars still stored on it (so they're never lost), then release the spot.
// Returns how many cars were impounded. Used by the auto-swap on re-rent and the expiry sweeper.
function releaseRental(spotId) {
    const rental = store.spots[spotId];
    if (!rental) return 0;
    const cars = Array.isArray(rental.cars) ? rental.cars : (rental.car ? [rental.car] : []);
    if (cars.length) {
        if (!store.impound[rental.owner]) store.impound[rental.owner] = [];
        cars.forEach(car => store.impound[rental.owner].push(Object.assign({}, car, { from: spotId, at: Date.now() })));
    }
    delete store.spots[spotId];
    return cars.length;
}

// ---- Shared actions (used by both /commands and the CEF UI). Each returns { ok, msg }. ----
// One rental per player: renting a new spot auto-releases the player's previous one. Cars stored on
// the old spot are carried over into the new rental (up to its capacity; any overflow is impounded
// so nothing is lost). This replaces the old "you already have a spot" rejection.
async function doRent(player, found, days, slots) {
    if (!found) return { ok: false, msg: 'დადექი პარკინგის ადგილზე.' };
    if (dist2(player.position, found.spot) > SPOT_RANGE * SPOT_RANGE) return { ok: false, msg: 'დადექი პარკინგის ადგილზე.' };
    const existing = activeRental(found.spot.id);
    if (existing) return { ok: false, msg: existing.owner === keyOf(player) ? 'ეს ადგილი უკვე შენია (გამოიყენე გაგრძელება).' : 'ეს ადგილი დაკავებულია.' };
    days = parseInt(days, 10); if (!Number.isInteger(days) || days < 1) days = 1; if (days > MAX_RENT_DAYS) days = MAX_RENT_DAYS;
    // Capacity is automatic: it equals how many cars the player owns (min 1), so all of them fit.
    // The `slots` argument from the UI/command is intentionally ignored.
    slots = await autoSlotsFor(player);
    if (!mp.players.exists(player)) return { ok: false, msg: 'მოთამაშე აღარ არის დაკავშირებული.' };
    if (dist2(player.position, found.spot) > SPOT_RANGE * SPOT_RANGE) return { ok: false, msg: 'დადექი პარკინგის ადგილზე.' };
    const occupiedAfterLoad = activeRental(found.spot.id);
    if (occupiedAfterLoad) return { ok: false, msg: occupiedAfterLoad.owner === keyOf(player) ? 'ეს ადგილი უკვე შენია (გამოიყენე გაგრძელება).' : 'ეს ადგილი დაკავებულია.' };
    const cost = found.spot.price * slots * days;
    if (global.getMoney(player) < cost) return { ok: false, msg: `არასაკმარისი თანხა — საჭიროა $${cost}.` };
    const previous = playerActiveSpot(player); // the one-and-only spot we'll auto-free on success
    global.setMoney(player, global.getMoney(player) - cost);
    let carriedCars = [], freedNote = '';
    if (previous && previous.spotId !== found.spot.id) {
        const oldCars = Array.isArray(previous.rental.cars) ? previous.rental.cars.slice() : [];
        carriedCars = oldCars.slice(0, slots);             // move what fits into the new spot
        const overflow = oldCars.slice(slots);             // the rest can't fit — impound it
        if (overflow.length) {
            const key = keyOf(player);
            if (!store.impound[key]) store.impound[key] = [];
            overflow.forEach(car => store.impound[key].push(Object.assign({}, car, { from: previous.spotId, at: Date.now() })));
        }
        delete store.spots[previous.spotId];
        freedNote = ` წინა ადგილი ${previous.spotId} გათავისუფლდა`;
        if (carriedCars.length) freedNote += `, ${carriedCars.length} მანქანა გადმოვიდა`;
        if (overflow.length) freedNote += ` (${overflow.length} ვერ დაეტია — დაყადაღდა, /impound)`;
        freedNote += '.';
    }
    store.spots[found.spot.id] = { owner: keyOf(player), ownerName: player.name, expiresAt: Date.now() + days * DAY_MS, slots, cars: carriedCars };
    save(); broadcastSpots();
    return { ok: true, msg: `იქირავე ${found.spot.id} — ${slots} ადგილი, ${days} დღით — $${cost}.${freedNote}` };
}
function doRenew(player, days) {
    const mine = playerActiveSpot(player);
    if (!mine) return { ok: false, msg: 'ნაქირავები ადგილი არ გაქვს.' };
    const spotDef = findSpot(mine.spotId);
    if (!spotDef || dist2(player.position, spotDef.spot) > SPOT_RANGE * SPOT_RANGE) return { ok: false, msg: 'მიდი შენს პარკინგის ადგილთან.' };
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
    if (player.parkingVehicleSeat !== 0) return { ok: false, msg: 'მანქანა მხოლოდ მძღოლის ადგილიდან შეგიძლია დააყენო.' };
    const spotDef = findSpot(mine.spotId);
    if (dist2(vehicle.position, spotDef.spot) > SPOT_RANGE * SPOT_RANGE) return { ok: false, msg: `მიიყვანე მანქანა ${mine.spotId}-ზე.` };
    const fuelVar = vehicle.getVariable('veh:fuel');
    mine.rental.cars.push({
        model: vehicle.model, plate: vehicle.numberPlate || null,
        fuel: (typeof fuelVar === 'number') ? fuelVar : 100,
        dbId: player.activeVehId || null
    });
    save();
    if (global.vehForget) global.vehForget(player);
    try { vehicle.destroy(); } catch (e) {}
    player.myCar = null;
    player.activeVehId = null;
    if (global.chatLocalAction) global.chatLocalAction(player, 'აყენებს მანქანას პარკინგზე');
    return { ok: true, msg: `მანქანა დააყენე — ${mine.rental.cars.length}/${mine.rental.slots} ადგილზე ${mine.spotId}.` };
}
function spawnCarAt(player, car, spot) {
    if (spotIsOccupied(spot)) return null;
    let vehicle;
    try {
        vehicle = mp.vehicles.new(car.model, new mp.Vector3(spot.x, spot.y, spot.z), { heading: spot.h || 0, dimension: 0, numberPlate: car.plate || undefined });
    } catch (e) { return null; }
    if (!vehicle) return null;
    if (global.vehAdopt) global.vehAdopt(player, vehicle, car.modelName || null, car.fuel, car.dbId); else player.myCar = vehicle;
    player.activeVehId = car.dbId || null;
    if (player.activeVehId && global.vehApplyTuning) global.vehApplyTuning(vehicle, player.activeVehId, car.tuning);
    if (player.activeVehId && global.vehApplyVisual) global.vehApplyVisual(vehicle, player.activeVehId, car.visual);
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
function spotIsOccupied(spot) {
    let occupied = false;
    mp.vehicles.forEach(vehicle => {
        if (occupied || !vehicle || !mp.vehicles.exists(vehicle) || Number(vehicle.dimension) !== 0) return;
        if (dist2(vehicle.position, spot) < 2.3 * 2.3) occupied = true;
    });
    return occupied;
}
async function doSummonOwned(player, spotId, vehicleId) {
    if (player.ownedVehicleSpawnInProgress) return { ok: false, msg: 'მანქანის გამოყვანა უკვე მიმდინარეობს.' };
    player.ownedVehicleSpawnInProgress = true;
    try {
        const found = findSpot(spotId);
        if (!found) return { ok: false, msg: 'უცნობი ადგილი.' };
        if (dist2(player.position, found.spot) > SPOT_RANGE * SPOT_RANGE) return { ok: false, msg: 'მიდი პარკინგის ადგილთან.' };
        if (player.myCar && mp.vehicles.exists(player.myCar)) return { ok: false, msg: 'ჯერ გააჩერე მიმდინარე მანქანა.' };
        if (!/^\d+$/.test(String(vehicleId || ''))) return { ok: false, msg: 'მანქანის ID არასწორია.' };
        if (typeof global.getMoney !== 'function' || typeof global.setMoney !== 'function') return { ok: false, msg: 'გადახდის სისტემა მიუწვდომელია.' };
        if (global.getMoney(player) < SUMMON_FEE) return { ok: false, msg: `საჭიროა $${SUMMON_FEE}.` };
        if (typeof global.carshopSpawnOwnedCar !== 'function') return { ok: false, msg: 'მანქანის გამოყვანის სისტემა მიუწვდომელია.' };

        const rows = await ownedVehiclesFor(player);
        if (!mp.players.exists(player)) return { ok: false, msg: 'მოთამაშე აღარ არის დაკავშირებული.' };
        const row = rows.find(vehicle => String(vehicle.id) === String(vehicleId));
        if (!row) return { ok: false, msg: 'ეს მანქანა შენს ანგარიშზე ვერ მოიძებნა.' };
        if (storedOwnedCarStatus(player, row)) return { ok: false, msg: 'ეს მანქანა უკვე პარკინგზე ან დაყადაღებულ მანქანებშია.' };
        if (player.myCar && mp.vehicles.exists(player.myCar)) return { ok: false, msg: 'ჯერ გააჩერე მიმდინარე მანქანა.' };
        if (dist2(player.position, found.spot) > SPOT_RANGE * SPOT_RANGE) return { ok: false, msg: 'მიდი პარკინგის ადგილთან.' };
        if (global.getMoney(player) < SUMMON_FEE) return { ok: false, msg: `საჭიროა $${SUMMON_FEE}.` };
        if (spotIsOccupied(found.spot)) return { ok: false, msg: 'პარკინგის ადგილი დაკავებულია.' };

        const vehicle = global.carshopSpawnOwnedCar(player, row, found.spot);
        if (!vehicle || !mp.vehicles.exists(vehicle)) return { ok: false, msg: 'მანქანის გამოყვანა ვერ მოხერხდა.' };
        global.setMoney(player, global.getMoney(player) - SUMMON_FEE);
        return { ok: true, msg: `${typeof global.carshopLabelOf === 'function' ? global.carshopLabelOf(row.modelName) : 'მანქანა'} გამოყვანილია — $${SUMMON_FEE}.` };
    } catch (e) {
        console.log(`[parking] could not summon owned vehicle for ${player.name}: ${e && e.message}`);
        return { ok: false, msg: 'მანქანის სიის ჩატვირთვა ან გამოყვანა ვერ მოხერხდა.' };
    } finally {
        player.ownedVehicleSpawnInProgress = false;
    }
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
mp.events.addCommand('rentspot', async (player, _, daysArg, slotsArg) => say(player, await doRent(player, nearestSpot(player), daysArg, slotsArg)));
mp.events.addCommand('renewspot', (player, _, daysArg) => say(player, doRenew(player, daysArg)));
mp.events.addCommand('park', (player) => say(player, doPark(player)));
mp.events.addCommand('unpark', (player, _, idxArg) => say(player, doUnpark(player, (parseInt(idxArg, 10) || 1) - 1)));
mp.events.addCommand('impound', (player) => say(player, doImpound(player, IMPOUND_POINT)));

// ---- CEF UI wiring: press E on a spot opens ui/parking; these drive its buttons ----
mp.events.add('parking:uiData', (player, spotId) => sendUiData(player, String(spotId)));
mp.events.add('parking:rent', async (player, spotId, days, slots) => { const r = await doRent(player, findSpot(String(spotId)), days, slots); sendUiData(player, String(spotId), r.msg, r.ok); });
mp.events.add('parking:renew', (player, spotId, days) => { const r = doRenew(player, days); sendUiData(player, String(spotId), r.msg, r.ok); });
mp.events.add('parking:park', (player, spotId) => { const r = doPark(player); sendUiData(player, String(spotId), r.msg, r.ok); });
mp.events.add('parking:unpark', (player, spotId, index) => { const r = doUnpark(player, index); sendUiData(player, String(spotId), r.msg, r.ok); });
mp.events.add('parking:summon', (player, spotId) => { const r = doSummon(player, String(spotId)); sendUiData(player, String(spotId), r.msg, r.ok); });
mp.events.add('parking:summonOwned', async (player, spotId, vehicleId) => {
    const r = await doSummonOwned(player, String(spotId), vehicleId);
    sendUiData(player, String(spotId), r.msg, r.ok);
});
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
        const impounded = releaseRental(spotId); // frees the spot and impounds any stored cars
        if (impounded) {
            let owner = null;
            mp.players.forEach(p => { if (!owner && keyOf(p) === r.owner) owner = p; });
            if (owner) owner.outputChatBox(`!{#ffb42e}[პარკინგი] ${spotId}-ის ქირა ამოიწურა — მანქანა დაყადაღდა. /impound რომ დაიბრუნო.`);
        }
        changed = true;
    }
    if (changed) { save(); broadcastSpots(); }
}, 60 * 1000);
