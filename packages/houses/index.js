// ===================== Houses: houses for sale with base-game interiors =====================
// Admins put houses on the market at any front door (/house add <price> <interior> [name]). Two kinds:
//  - interior houses (almost all): E at the door teleports you into a built-in GTA interior (INTERIORS
//    below, like GTA Online). Every house gets its own private copy (dimension DIM_BASE + id), so many
//    houses can share one interior. E at the entry point inside takes you back out.
//  - walk-in houses ("walkin"): the real map door is locked/unlocked on every client; only works where
//    the interior actually exists on the map (base safehouses or a map mod/MLO).
// Players buy at the door (E); the price goes to the government treasury. Owners lock/unlock (locked =
// only the owner enters), store items in the chest, park their car in the garage, spawn at home, or
// sell back to the state for SELL_BACK_RATE of the price (paid from the treasury).
const fs = require('fs');
const path = require('path');

const DATA_FILE = path.join(__dirname, 'houses.json');
const DOOR_RANGE = 2.5;      // metres from the door point to use it (client prompt uses 2.0)
const POINT_RANGE = 2.5;     // chest / garage (on foot)
const GARAGE_RANGE = 5.0;    // garage when driving in
const SELL_BACK_RATE = 0.6;  // owner gets 60% of the price back
const MAX_PER_PLAYER = 1;    // houses one player may own
const CHEST_SLOTS = 40;      // distinct item types in a chest
const PICK_TIMEOUT_MS = 15000;
const DIM_BASE = 100000;     // house #N's interior copy lives in dimension DIM_BASE + N

// Built-in GTA interiors. x/y/z/h = where you appear (and the exit point); ipl = interior that must be
// loaded on the client first (Eclipse Towers styles share one location — the client swaps styles).
// Coordinates are from widely used community data and aren't all verified in-game: check with
// /house itp <key>, and fix one by standing at the right spot with /house addinterior <key>.
const ECLIPSE_A = { x: -781.81, y: 315.87, z: 217.64, h: 0 };
const INTERIORS = {
    low:            { label: 'იაფი ბინა (Low-end apartment)', x: 265.31, y: -1002.80, z: -100.01, h: 0 },
    mid:            { label: 'საშუალო ბინა (Mid-end apartment)', x: 346.49, y: -1012.53, z: -99.20, h: 0 },
    richards:       { label: 'Richards Majestic, Apt 2', x: -915.81, y: -379.43, z: 114.67, h: 0 },
    tinsel:         { label: 'Tinsel Towers, Apt 12', x: -614.86, y: 40.68, z: 98.60, h: 0 },
    wild_oats:      { label: '3655 Wild Oats Drive', x: -174.73, y: 493.10, z: 130.04, h: 0 },
    conker_2044:    { label: '2044 North Conker Avenue', x: 346.96, y: 440.26, z: 148.70, h: 0 },
    conker_2045:    { label: '2045 North Conker Avenue', x: 373.02, y: 416.11, z: 146.70, h: 0 },
    hillcrest_2862: { label: '2862 Hillcrest Avenue', x: -676.13, y: 588.61, z: 146.17, h: 0 },
    hillcrest_2868: { label: '2868 Hillcrest Avenue', x: -758.52, y: 615.31, z: 144.14, h: 0 },
    hillcrest_2874: { label: '2874 Hillcrest Avenue', x: -853.35, y: 696.68, z: 148.78, h: 0 },
    whispymound:    { label: '3677 Whispymound Drive', x: 117.22, y: 559.51, z: 185.30, h: 0 },
    mad_wayne:      { label: '2113 Mad Wayne Thunder Drive', x: -1289.02, y: 449.84, z: 97.90, h: 0 },
    eclipse_modern:     Object.assign({ label: 'Eclipse Towers — Modern', ipl: 'apa_v_mp_h_01_a' }, ECLIPSE_A),
    eclipse_moody:      Object.assign({ label: 'Eclipse Towers — Moody', ipl: 'apa_v_mp_h_02_a' }, ECLIPSE_A),
    eclipse_vibrant:    Object.assign({ label: 'Eclipse Towers — Vibrant', ipl: 'apa_v_mp_h_03_a' }, ECLIPSE_A),
    eclipse_sharp:      Object.assign({ label: 'Eclipse Towers — Sharp', ipl: 'apa_v_mp_h_04_a' }, ECLIPSE_A),
    eclipse_monochrome: Object.assign({ label: 'Eclipse Towers — Monochrome', ipl: 'apa_v_mp_h_05_a' }, ECLIPSE_A),
    eclipse_seductive:  Object.assign({ label: 'Eclipse Towers — Seductive', ipl: 'apa_v_mp_h_06_a' }, ECLIPSE_A),
    eclipse_regal:      Object.assign({ label: 'Eclipse Towers — Regal', ipl: 'apa_v_mp_h_07_a' }, ECLIPSE_A),
    eclipse_aqua:       Object.assign({ label: 'Eclipse Towers — Aqua', ipl: 'apa_v_mp_h_08_a' }, ECLIPSE_A)
};
const IPL_GROUP = Object.values(INTERIORS).filter(i => i.ipl).map(i => i.ipl); // styles that share a location

// Apartment buildings: one entrance, several units (each a normal house sharing the door point).
// Seeded once on first start at real GTA Online apartment-building entrances (community coordinates,
// z raised 1 m to ped height). If an entrance is slightly off: stand at the right spot, /house movedoor.
const SEED_BUILDINGS = [
    { key: 'integrity',  name: '4 Integrity Way',    door: { x: -47.80,   y: -585.87, z: 37.96 }, units: 6, price: 150000, interior: 'mid' },
    { key: 'delperro',   name: 'Del Perro Heights',  door: { x: -1447.06, y: -538.28, z: 34.74 }, units: 6, price: 140000, interior: 'mid' },
    { key: 'tinsel',     name: 'Tinsel Towers',      door: { x: -618.30,  y: 37.06,   z: 43.59 }, units: 4, price: 170000, interior: 'mid' },
    { key: 'richards',   name: 'Richards Majestic',  door: { x: -936.36,  y: -378.24, z: 38.96 }, units: 4, price: 130000, interior: 'mid' },
    { key: 'eclipse',    name: 'Eclipse Towers',     door: { x: -773.41,  y: 312.12,  z: 85.70 }, units: 4, price: 90000,  interior: 'low' }
];

let data = { next: 1, houses: {}, interiors: {}, buildings: {} };
data = Object.assign(data, global.kv.load('houses', DATA_FILE, {}));
// Houses from before interiors existed were all real-door (walk-in) houses.
Object.values(data.houses).forEach(house => { if (house.interior === undefined) house.interior = 'walkin'; });
if (!data.buildings) data.buildings = {};

function newHouse(fields) {
    const id = data.next++;
    data.houses[id] = Object.assign({
        id, name: 'სახლი #' + id, price: 1, interior: 'low', building: null,
        door: null, doorModel: null, chestPoint: null, garage: null, spawn: null,
        owner: null, ownerName: null, locked: false, chest: {}, spawnHome: true, createdAt: Date.now()
    }, fields, { id });
    return data.houses[id];
}
function createBuilding(key, name, door, units, price, interior) {
    data.buildings[key] = { name };
    const made = [];
    for (let n = 1; n <= units; n++) made.push(newHouse({ name: name + ', ბინა ' + n, price, interior, building: key, door: Object.assign({}, door) }));
    return made;
}
if (!data.seeded) {
    SEED_BUILDINGS.forEach(b => { if (!data.buildings[b.key]) createBuilding(b.key, b.name, b.door, b.units, b.price, b.interior); });
    data.seeded = true;
    save();
}
// Every house on the map: one for sale at each residential mailbox (data/world_houses.json, generated by
// tools/gen-house-data.py with a random interior + price per area). Imported once (worldImport = 2).
// Skipped: a spot within 20 m of a hand-made house/building entrance, or within 8 m of an already
// imported map house (mailboxes are 8 m-deduplicated; real neighbours can be 10-20 m apart).
// Version 2 also tops up servers that ran the first import, which wrongly skipped neighbouring houses.
if (data.worldImport !== 2) {
    let world = [];
    try { world = JSON.parse(fs.readFileSync(path.join(__dirname, 'data', 'world_houses.json'), 'utf8')); } catch (e) { world = []; }
    const all = Object.values(data.houses).filter(h => h.door);
    const handMade = all.filter(h => !h.tier).map(h => h.door);
    const mapHouses = all.filter(h => h.tier).map(h => h.door);
    let added = 0;
    world.forEach(spot => {
        if (!INTERIORS[spot.interior]) return;
        if (handMade.some(d => Math.hypot(d.x - spot.x, d.y - spot.y) < 20)) return;
        if (mapHouses.some(d => Math.hypot(d.x - spot.x, d.y - spot.y) < 8)) return;
        const house = newHouse({ price: spot.price, interior: spot.interior, door: { x: spot.x, y: spot.y, z: spot.z }, tier: spot.tier });
        house.name = 'სახლი #' + house.id;
        mapHouses.push(house.door);
        added++;
    });
    if (world.length) { data.seededWorld = true; data.worldImport = 2; save(); console.log(`[houses] imported ${added} map houses`); }
}
function unitsOf(key) { return Object.values(data.houses).filter(h => h.building === key).sort((a, b) => a.id - b.id); }
function buildingName(house) { return house.building && data.buildings[house.building] ? data.buildings[house.building].name : null; }
function save() {
    global.kv.save('houses', data, DATA_FILE);
}

function keyOf(player) { return String(player.socialClub || '').trim().toLowerCase(); }
function tell(player, message) { player.outputChatBox('!{#6fcf97}[სახლი] !{#ffffff}' + message); }
function isAdmin(player) { return typeof global.isProtectedAdmin === 'function' && global.isProtectedAdmin(player); }
function money(player) { return typeof global.getMoney === 'function' ? global.getMoney(player) : 0; }
// Points can carry a dimension (e.g. a chest inside a house's interior copy); default is the world (0).
function near(player, point, range) {
    if (!point || Number(player.dimension) !== Number(point.dim || 0)) return false;
    const p = player.position;
    const dx = p.x - point.x, dy = p.y - point.y, dz = p.z - point.z;
    return dx * dx + dy * dy + dz * dz <= range * range;
}
function vec(p) { return { x: +Number(p.x).toFixed(2), y: +Number(p.y).toFixed(2), z: +Number(p.z).toFixed(2) }; }
function houseById(id) { return data.houses[String(Math.floor(Number(id)))] || null; }
function ownedBy(player) { const key = keyOf(player); return Object.values(data.houses).filter(h => key && h.owner === key); }
function sellBackPrice(house) { return Math.floor(house.price * SELL_BACK_RATE); }
function interiors() { return Object.assign({}, INTERIORS, data.interiors || {}); }
function interiorOf(house) { return house.interior && house.interior !== 'walkin' ? interiors()[house.interior] || null : null; }
function houseDim(house) { return DIM_BASE + house.id; }
function chestCount(house) { return Object.values(house.chest || {}).reduce((n, q) => n + q, 0); }

// ---- What clients see: blips/markers/prompts, and the real door lock state ----
function publicView(house, player) {
    const mine = !!(player && house.owner && house.owner === keyOf(player));
    return {
        id: house.id, name: house.name, price: house.price, forSale: !house.owner, mine,
        ownerName: house.owner ? house.ownerName : null,
        locked: house.owner ? !!house.locked : false, // for-sale houses are open for viewing
        door: house.door, doorModel: house.interior === 'walkin' ? house.doorModel || null : null,
        interior: interiorOf(house) ? interiorOf(house).label : null,
        building: house.building || null, buildingName: buildingName(house),
        chest: mine ? house.chestPoint || null : null,
        garage: mine ? house.garage || null : null
    };
}
function sendHouses(player) {
    player.call('houses:list', [JSON.stringify(Object.values(data.houses).map(h => publicView(h, player)))]);
}
function broadcast() { mp.players.forEach(p => { if (mp.players.exists(p)) sendHouses(p); }); }
// One house changed (bought / locked / sold): send just that house instead of the whole map list.
function broadcastHouse(house) {
    mp.players.forEach(p => { if (mp.players.exists(p)) p.call('houses:update', [JSON.stringify(publicView(house, p))]); });
}
mp.events.add('playerReady', (player) => sendHouses(player));

// ---- Door panel ----
function doorState(player, house) {
    const mine = house.owner && house.owner === keyOf(player);
    return {
        mode: 'door', money: money(player),
        building: house.building ? { key: house.building, name: buildingName(house) } : null,
        house: {
            id: house.id, name: house.name, price: house.price, forSale: !house.owner, mine: !!mine,
            ownerName: house.owner ? house.ownerName : null, locked: !!house.locked,
            spawnHome: house.spawnHome !== false, sellBack: sellBackPrice(house),
            hasChest: !!house.chestPoint, hasGarage: !!house.garage,
            interior: interiorOf(house) ? interiorOf(house).label : null,
            canEnter: !!interiorOf(house) && (!house.owner || !house.locked || !!mine),
            chestItems: mine ? chestCount(house) : 0,
            carParked: mine && typeof global.vehGaragedAt === 'function' ? global.vehGaragedAt(player) === house.id : false
        },
        ownsOther: !mine && ownedBy(player).length >= MAX_PER_PLAYER
    };
}
function reply(player, house) { player.call('houses:ui', [JSON.stringify(doorState(player, house))]); }

function buildingState(player, key) {
    const me = keyOf(player);
    const units = unitsOf(key);
    return {
        mode: 'building', money: money(player), key, name: data.buildings[key] ? data.buildings[key].name : key,
        ownsMax: ownedBy(player).length >= MAX_PER_PLAYER,
        units: units.map(h => ({
            id: h.id, name: h.name, price: h.price, forSale: !h.owner, mine: !!(h.owner && h.owner === me),
            ownerName: h.owner ? h.ownerName : null, locked: !!(h.owner && h.locked),
            interior: interiorOf(h) ? interiorOf(h).label : null
        }))
    };
}
mp.events.add('houses:door', (player, id) => {
    const house = houseById(id);
    if (!house || !near(player, house.door, DOOR_RANGE)) return;
    if (house.building) return player.call('houses:ui', [JSON.stringify(buildingState(player, house.building))]);
    reply(player, house);
});
// Picking a unit from a building's list opens that unit's normal door panel.
mp.events.add('houses:unit', (player, id) => {
    const house = houseById(id);
    if (!house || !near(player, house.door, DOOR_RANGE)) return;
    reply(player, house);
});

// ---- Entering / leaving an interior house ----
function enterHouse(player, house) {
    const interior = interiorOf(house);
    if (!interior) return false;
    player.houseInside = house.id;
    player.dimension = houseDim(house);
    player.position = new mp.Vector3(interior.x, interior.y, interior.z);
    player.heading = interior.h || 0;
    player.call('houses:entered', [JSON.stringify({ id: house.id, exit: { x: interior.x, y: interior.y, z: interior.z }, ipl: interior.ipl || null, iplGroup: IPL_GROUP })]);
    return true;
}
function leaveHouse(player) {
    const house = houseById(player.houseInside);
    player.houseInside = null;
    player.dimension = 0;
    if (house) {
        player.position = new mp.Vector3(house.door.x, house.door.y, house.door.z);
        if (typeof house.door.h === 'number') player.heading = house.door.h;
    }
    player.call('houses:left');
}
mp.events.add('houses:enter', (player, id) => {
    const house = houseById(id);
    if (!house || !near(player, house.door, DOOR_RANGE) || player.vehicle) return;
    if (!interiorOf(house)) return tell(player, 'ამ სახლს შიდა ინტერიერი არ აქვს მითითებული.');
    if (house.owner && house.locked && house.owner !== keyOf(player)) return tell(player, 'კარი ჩაკეტილია.');
    player.call('houses:ui:hide');
    enterHouse(player, house);
});
mp.events.add('houses:exit', (player) => {
    const house = houseById(player.houseInside);
    const interior = house && interiorOf(house);
    if (!house || !interior) return;
    if (!near(player, Object.assign({ dim: houseDim(house) }, interior), DOOR_RANGE)) return;
    leaveHouse(player);
});

mp.events.add('houses:buy', (player, id) => {
    const house = houseById(id);
    if (!house || !near(player, house.door, DOOR_RANGE)) return;
    const key = keyOf(player);
    if (!key) return tell(player, 'Social Club იდენტიფიკატორი ვერ მოიძებნა.');
    if (house.owner) { tell(player, 'ეს სახლი უკვე გაყიდულია.'); return reply(player, house); }
    if (ownedBy(player).length >= MAX_PER_PLAYER) { tell(player, `შეგიძლიათ ფლობდეთ მაქსიმუმ ${MAX_PER_PLAYER} სახლს.`); return reply(player, house); }
    if (typeof global.setMoney !== 'function' || money(player) < house.price) { tell(player, `არასაკმარისი თანხა — საჭიროა $${house.price}.`); return reply(player, house); }
    global.setMoney(player, money(player) - house.price);
    if (typeof global.govAddToTreasury === 'function') global.govAddToTreasury(house.price);
    house.owner = key;
    house.ownerName = player.name;
    house.locked = true;
    house.spawnHome = true;
    house.chest = {};
    house.boughtAt = Date.now();
    save();
    tell(player, `გილოცავთ! შეიძინეთ „${house.name}“ $${house.price}-ად. კარი ჩაკეტილია — გასაღებად E კართან.`);
    broadcastHouse(house);
    reply(player, house);
});

mp.events.add('houses:lock', (player, id) => {
    const house = houseById(id);
    if (!house || !near(player, house.door, DOOR_RANGE) || house.owner !== keyOf(player)) return;
    house.locked = !house.locked;
    save();
    tell(player, house.locked ? 'კარი ჩაიკეტა.' : 'კარი გაიღო.');
    broadcastHouse(house);
    reply(player, house);
});

mp.events.add('houses:spawnToggle', (player, id) => {
    const house = houseById(id);
    if (!house || !near(player, house.door, DOOR_RANGE) || house.owner !== keyOf(player)) return;
    house.spawnHome = house.spawnHome === false;
    save();
    reply(player, house);
});

function releaseHouse(house) {
    if (typeof global.vehGarageRelease === 'function' && house.owner && house.garage) {
        global.vehGarageRelease(house.owner, house.garage, house.garage.h); // parked car goes back into the world
    }
    house.owner = null; house.ownerName = null; house.locked = false; house.chest = {}; house.spawnHome = true;
}

mp.events.add('houses:sell', (player, id) => {
    const house = houseById(id);
    if (!house || !near(player, house.door, DOOR_RANGE) || house.owner !== keyOf(player)) return;
    if (chestCount(house) > 0) { tell(player, 'ჯერ დაცალეთ სეიფი.'); return reply(player, house); }
    if (typeof global.vehGaragedAt === 'function' && global.vehGaragedAt(player) === house.id) { tell(player, 'ჯერ გაიყვანეთ მანქანა ავტოფარეხიდან.'); return reply(player, house); }
    const payout = sellBackPrice(house);
    if (typeof global.govTakeFromTreasury !== 'function' || !global.govTakeFromTreasury(payout)) {
        tell(player, 'სახელმწიფო ხაზინას ახლა არ აქვს საკმარისი თანხა სახლის გამოსასყიდად.');
        return reply(player, house);
    }
    global.setMoney(player, money(player) + payout);
    releaseHouse(house);
    save();
    tell(player, `სახლი მიყიდეთ სახელმწიფოს $${payout}-ად. ის კვლავ იყიდება.`);
    broadcastHouse(house);
    reply(player, house);
});

// ---- Chest (storage) ----
function chestState(player, house) {
    const chest = house.chest || {};
    return {
        mode: 'chest', houseId: house.id, name: house.name, slots: CHEST_SLOTS,
        inventory: typeof global.invList === 'function' ? global.invList(player) : [],
        chest: Object.keys(chest).map(id => ({ id, qty: chest[id], label: typeof global.invItemLabel === 'function' ? global.invItemLabel(id) : id }))
    };
}
function atChest(player, house) { return house && house.chestPoint && house.owner === keyOf(player) && near(player, house.chestPoint, POINT_RANGE); }
mp.events.add('houses:chest', (player, id) => {
    const house = houseById(id);
    if (!atChest(player, house)) return;
    player.call('houses:ui', [JSON.stringify(chestState(player, house))]);
});
function moveQty(value) { const n = Math.floor(Number(value)); return Number.isInteger(n) && n > 0 && n <= 9999 ? n : 0; }
mp.events.add('houses:chestPut', (player, id, itemId, qtyArg) => {
    const house = houseById(id);
    if (!atChest(player, house) || typeof global.invCountItem !== 'function') return;
    itemId = String(itemId);
    const item = (global.invList(player) || []).find(entry => entry.id === itemId);
    const qty = Math.min(moveQty(qtyArg), item ? item.qty : 0);
    if (!item || !qty) return;
    if (item.inHand) { tell(player, 'ჯერ ჩადეთ იარაღი (ხელიდან).'); return player.call('houses:ui', [JSON.stringify(chestState(player, house))]); }
    house.chest = house.chest || {};
    if (!house.chest[itemId] && Object.keys(house.chest).length >= CHEST_SLOTS) { tell(player, 'სეიფი სავსეა.'); return; }
    global.invRemoveItem(player, itemId, qty);
    house.chest[itemId] = (house.chest[itemId] || 0) + qty;
    save();
    player.call('houses:ui', [JSON.stringify(chestState(player, house))]);
});
mp.events.add('houses:chestTake', (player, id, itemId, qtyArg) => {
    const house = houseById(id);
    if (!atChest(player, house) || typeof global.invAddItem !== 'function') return;
    itemId = String(itemId);
    const have = (house.chest || {})[itemId] || 0;
    const qty = Math.min(moveQty(qtyArg), have);
    if (!qty) return;
    // Rebuilds on-demand item defs (e.g. clothing) that aren't loaded yet after a restart.
    if (typeof global.invItemExists === 'function') global.invItemExists(itemId);
    // Non-stackable items (armour, clothing, ID cards) go in one at a time.
    let moved = 0;
    for (let i = 0; i < qty; i++) {
        if (!global.invAddItem(player, itemId, 1)) break;
        moved++;
    }
    if (!moved) tell(player, 'ინვენტარში ადგილი არ არის.');
    house.chest[itemId] = have - moved;
    if (house.chest[itemId] <= 0) delete house.chest[itemId];
    save();
    player.call('houses:ui', [JSON.stringify(chestState(player, house))]);
});

// ---- Garage: drive the personal car in to park it, press E on foot to take it out ----
mp.events.add('houses:garage', (player, id) => {
    const house = houseById(id);
    if (!house || !house.garage || house.owner !== keyOf(player)) return;
    const vehicle = player.vehicle;
    if (vehicle) {
        if (!near(player, house.garage, GARAGE_RANGE)) return;
        if (!player.myCar || Number(player.myCar.id) !== Number(vehicle.id)) return tell(player, 'ავტოფარეხში მხოლოდ საკუთარ მანქანას დააყენებთ.');
        if (typeof global.vehGarageStore === 'function' && global.vehGarageStore(player, house.id)) tell(player, 'მანქანა დადგა ავტოფარეხში.');
        return;
    }
    if (!near(player, house.garage, POINT_RANGE)) return;
    if (typeof global.vehGaragedAt !== 'function' || global.vehGaragedAt(player) !== house.id) return tell(player, 'ავტოფარეხი ცარიელია.');
    const car = global.vehGarageTake(player, house.garage, house.garage.h);
    if (!car) return tell(player, 'მანქანის გამოყვანა ვერ მოხერხდა.');
    tell(player, 'მანქანა გამოყვანილია.');
    setTimeout(() => { try { if (mp.players.exists(player) && mp.vehicles.exists(car)) player.putIntoVehicle(car, 0); } catch (e) {} }, 300);
});

// ---- Spawn at home: owners appear at their house on join and after respawn ----
function sendHome(player) {
    if (!mp.players.exists(player)) return;
    // The auth spawn selector owns the login spawn; it sets a one-shot flag so this auto-send
    // doesn't override the player's chosen spawn (home/faction/last location).
    if (player.suppressAutoSpawn) { player.suppressAutoSpawn = false; return; }
    if (typeof global.govOnDuty === 'function' && global.govOnDuty(player)) return; // on-duty officials spawn at City Hall
    if (typeof global.demorganIsJailed === 'function' && global.demorganIsJailed(player)) return; // prisoners stay in Demorgan
    const house = ownedBy(player).find(h => h.spawnHome !== false);
    if (!house) return;
    if (interiorOf(house) && !house.spawn) return enterHouse(player, house); // wake up inside
    const spot = house.spawn || house.door;
    player.position = new mp.Vector3(spot.x, spot.y, spot.z);
    if (typeof spot.h === 'number') player.heading = spot.h;
}

// The player's home spawn point { x, y, z, h } (first spawn-enabled owned house), or null.
// Exposed for the auth rejoin spawn selector.
global.houseSpawnPoint = function (player) {
    const house = ownedBy(player).find(h => h.spawnHome !== false);
    if (!house) return null;
    const spot = house.spawn || house.door;
    if (!spot) return null;
    return { x: spot.x, y: spot.y, z: spot.z, h: typeof spot.h === 'number' ? spot.h : 0 };
};
// Dying inside a house copy must not respawn you in that private dimension.
function resetFromInterior(player) {
    if (!mp.players.exists(player) || !player.houseInside) return;
    player.houseInside = null;
    if (Number(player.dimension) >= DIM_BASE) player.dimension = 0;
    player.call('houses:left');
}
// When the account system is active, auth owns the initial login spawn (via its selector), so the
// automatic send-home on join defers to it. Death respawns (playerSpawn below) still go home.
mp.events.add('playerReady', (player) => { if (global.AUTH_ACTIVE) return; setTimeout(() => sendHome(player), 3000); });
mp.events.add('playerSpawn', (player) => { resetFromInterior(player); setTimeout(() => sendHome(player), 600); });

// ---- Admin: /house ... ----
// add <price> <interior|walkin> [name] — stand at the front door (walkin: look at the real door)
// interiors · itp <interior> (visit it) · addinterior <key> [label] (your spot) · delinterior <key>
// setinterior <id> <interior|walkin> · setdoor <id> (walkin) · setchest|setgarage|setspawn <id> — your position
// price <id> <price> · name <id> <text> · remove <id> (for sale only) · evict <id> · tp <id> · info <id> · list
// The house whose door circle the player is standing in (closest one), or null.
function houseAtDoor(player) {
    let best = null, bestDist = Infinity;
    Object.values(data.houses).forEach(h => {
        if (!near(player, h.door, DOOR_RANGE)) return;
        const p = player.position, dist = Math.hypot(p.x - h.door.x, p.y - h.door.y, p.z - h.door.z);
        if (dist < bestDist) { best = h; bestDist = dist; }
    });
    return best;
}
function describe(house) {
    const kind = house.interior === 'walkin' ? ('walk-in' + (house.doorModel ? '' : ' ⚠კარი არ არის')) : (interiorOf(house) ? house.interior : '⚠ინტერიერი არ არის');
    return `#${house.id} „${house.name}“ $${house.price} [${kind}] — ${house.owner ? 'მფლობელი: ' + house.ownerName + (house.locked ? ' (ჩაკეტილი)' : '') : 'იყიდება'}` +
        `${house.chestPoint ? '' : ' ·სეიფი არა'}${house.garage ? '' : ' ·ავტოფარეხი არა'}`;
}
function createHouse(player, price, interior, name, doorModel) {
    const door = Object.assign(vec(player.position), { h: Math.round((Number(player.heading) + 180) % 360) }); // exit facing away from the door
    const house = newHouse({ price, interior, door, doorModel: doorModel || null });
    if (name) house.name = name;
    save();
    broadcast();
    return house;
}
function requestDoorPick(player, action) {
    player.housePick = Object.assign({ at: Date.now() }, action);
    player.call('houses:pickDoor');
}
mp.events.add('houses:doorPicked', (player, json) => {
    const pick = player.housePick;
    player.housePick = null;
    if (!pick || Date.now() - pick.at > PICK_TIMEOUT_MS || !isAdmin(player)) return;
    let door = null;
    try { door = JSON.parse(json); } catch (e) {}
    const valid = door && Number.isFinite(Number(door.model)) && ['x', 'y', 'z'].every(k => Number.isFinite(Number(door[k])));
    // The door must be the one the admin is standing at.
    const doorModel = valid && near(player, door, 8) ? { model: Number(door.model) >>> 0, x: +Number(door.x).toFixed(3), y: +Number(door.y).toFixed(3), z: +Number(door.z).toFixed(3) } : null;
    if (pick.type === 'add') {
        const house = createHouse(player, pick.price, 'walkin', pick.name, doorModel);
        const id = house.id;
        tell(player, `დაემატა ${describe(house)}.`);
        if (!doorModel) tell(player, '⚠ კარი ვერ ვიპოვე — ჩაკეტვა არ იმუშავებს. შეხედეთ კარს და /house setdoor ' + id + ', ან მიეცით ინტერიერი: /house setinterior ' + id + ' low');
        else tell(player, `შემდეგ: /house setchest ${id} (შიგნით), /house setgarage ${id}, /house setspawn ${id}.`);
    } else if (pick.type === 'setdoor') {
        const house = houseById(pick.id);
        if (!house) return;
        if (!doorModel) return tell(player, 'კარი ვერ ვიპოვე — შეხედეთ კარს 6 მეტრში.');
        house.doorModel = doorModel;
        house.door = vec(player.position);
        save();
        broadcast();
        tell(player, `#${house.id}: კარი განახლდა.`);
    }
});

mp.events.addCommand('house', (player, full, action) => {
    if (!isAdmin(player)) return tell(player, 'მხოლოდ ადმინისთვის.');
    const args = String(full || '').trim().split(/\s+/).slice(1);
    action = String(action || '').toLowerCase();
    // remove / evict / info work without an id while you stand in a house's door circle.
    const AT_DOOR = ['remove', 'evict', 'info'];
    const house = houseById(args[0]) || (AT_DOOR.includes(action) && args[0] === undefined ? houseAtDoor(player) : null);
    const needHouse = () => {
        if (!house) tell(player, AT_DOOR.includes(action) && args[0] === undefined ? `დადექით სახლის კართან (წრეში) ან: /house ${action} <id>` : 'სახლი ვერ მოიძებნა — /house list');
        return !!house;
    };
    switch (action) {
        case 'add': {
            const price = Math.floor(Number(args[0]));
            const interior = String(args[1] || '').toLowerCase();
            const name = args.slice(2).join(' ').slice(0, 40);
            if (!Number.isSafeInteger(price) || price <= 0 || !interior) {
                return tell(player, 'გამოყენება: /house add <ფასი> <ინტერიერი|walkin> [სახელი] — სია: /house interiors');
            }
            if (player.vehicle || Number(player.dimension) !== 0) return tell(player, 'ფეხით, ძირითად სამყაროში.');
            if (interior === 'walkin') return requestDoorPick(player, { type: 'add', price, name });
            if (!interiors()[interior]) return tell(player, `ინტერიერი „${interior}“ არ არსებობს — /house interiors`);
            const created = createHouse(player, price, interior, name, null);
            tell(player, `დაემატა ${describe(created)}.`);
            return tell(player, `სეიფი: შედით და /house setchest ${created.id} · ავტოფარეხი: /house setgarage ${created.id}`);
        }
        case 'building': {
            // /house building <key> <units> <price> <interior> [name]
            const key = String(args[0] || '').toLowerCase().replace(/[^a-z0-9_]/g, '');
            const units = Math.floor(Number(args[1])), price = Math.floor(Number(args[2]));
            const interior = String(args[3] || '').toLowerCase();
            if (!key || !Number.isInteger(units) || units < 1 || units > 30 || !Number.isSafeInteger(price) || price <= 0 || !interiors()[interior]) {
                return tell(player, 'გამოყენება: /house building <key> <ბინები 1-30> <ფასი> <ინტერიერი> [სახელი] — დადექით შესასვლელთან.');
            }
            if (data.buildings[key]) return tell(player, `კორპუსი „${key}“ უკვე არსებობს — ბინის დასამატებლად: /house addunit ${key} <ფასი>`);
            if (player.vehicle || Number(player.dimension) !== 0) return tell(player, 'ფეხით, ძირითად სამყაროში.');
            const door = Object.assign(vec(player.position), { h: Math.round((Number(player.heading) + 180) % 360) });
            const made = createBuilding(key, args.slice(4).join(' ').slice(0, 40) || key, door, units, price, interior);
            save(); broadcast();
            return tell(player, `კორპუსი „${data.buildings[key].name}“: ${made.length} ბინა (#${made[0].id}–#${made[made.length - 1].id}), $${price}, ${interior}.`);
        }
        case 'addunit': {
            const key = String(args[0] || '').toLowerCase();
            const price = Math.floor(Number(args[1]));
            const units = unitsOf(key);
            if (!data.buildings[key] || !units.length || !Number.isSafeInteger(price) || price <= 0) return tell(player, 'გამოყენება: /house addunit <კორპუსი> <ფასი> [ინტერიერი]');
            const interior = interiors()[String(args[2] || '').toLowerCase()] ? String(args[2]).toLowerCase() : units[0].interior;
            const unit = newHouse({ name: data.buildings[key].name + ', ბინა ' + (units.length + 1), price, interior, building: key, door: Object.assign({}, units[0].door) });
            save(); broadcast();
            return tell(player, `დაემატა ${describe(unit)}.`);
        }
        case 'movedoor': {
            // Moves a house's door (or the whole building's entrance) to where you stand.
            const target = house || houseAtDoor(player);
            if (!target) return tell(player, 'გამოყენება: /house movedoor <id> — ან დადექით კართან.');
            const door = Object.assign(vec(player.position), { h: Math.round((Number(player.heading) + 180) % 360) });
            const moved = target.building ? unitsOf(target.building) : [target];
            moved.forEach(h => { h.door = Object.assign({}, door); });
            save(); broadcast();
            return tell(player, `კარი გადატანილია (${moved.length} ${target.building ? 'ბინა' : 'სახლი'}).`);
        }
        case 'interiors': {
            const all = interiors();
            Object.keys(all).forEach(key => player.outputChatBox(`!{#9aa4ad}${key}: !{#ffffff}${all[key].label}${data.interiors && data.interiors[key] ? ' (custom)' : ''}`));
            return tell(player, 'walkin = ნამდვილი კარი (მხოლოდ თუ შიგნით რუკაზე არსებობს). შემოწმება: /house itp <key>');
        }
        case 'itp': {
            const key = String(args[0] || '').toLowerCase();
            const interior = interiors()[key];
            if (!interior) return tell(player, 'გამოყენება: /house itp <ინტერიერი> — /house interiors');
            player.houseInside = null;
            player.dimension = 0;
            player.position = new mp.Vector3(interior.x, interior.y, interior.z);
            player.heading = interior.h || 0;
            player.call('houses:entered', [JSON.stringify({ id: 0, exit: null, ipl: interior.ipl || null, iplGroup: IPL_GROUP })]);
            return tell(player, `${interior.label} — თუ ადგილი არასწორია, დადექით სწორად და /house addinterior ${key}`);
        }
        case 'addinterior': {
            const key = String(args[0] || '').toLowerCase().replace(/[^a-z0-9_]/g, '');
            if (!key || key === 'walkin') return tell(player, 'გამოყენება: /house addinterior <key> [სახელი] — დადექით ინტერიერის შესასვლელთან.');
            const base = interiors()[key];
            data.interiors = data.interiors || {};
            data.interiors[key] = Object.assign(vec(player.position), {
                h: Math.round(Number(player.heading) || 0),
                label: args.slice(1).join(' ').slice(0, 40) || (base ? base.label : key),
                ipl: base && base.ipl ? base.ipl : undefined
            });
            save();
            return tell(player, `ინტერიერი „${key}“ შენახულია აქ.`);
        }
        case 'delinterior': {
            const key = String(args[0] || '').toLowerCase();
            if (!data.interiors || !data.interiors[key]) return tell(player, 'მხოლოდ custom ინტერიერი იშლება.');
            delete data.interiors[key]; save();
            return tell(player, `„${key}“ წაიშალა${INTERIORS[key] ? ' (დაბრუნდა ნაგულისხმევი)' : ''}.`);
        }
        case 'setinterior': {
            if (!needHouse()) return;
            const key = String(args[1] || '').toLowerCase();
            if (key !== 'walkin' && !interiors()[key]) return tell(player, 'გამოყენება: /house setinterior <id> <ინტერიერი|walkin>');
            house.interior = key;
            if (house.chestPoint && house.chestPoint.dim) house.chestPoint = null; // old interior's chest spot no longer applies
            save(); broadcast();
            return tell(player, describe(house));
        }
        case 'setdoor': if (!needHouse()) return; return requestDoorPick(player, { type: 'setdoor', id: house.id });
        case 'setchest':
            if (!needHouse()) return;
            house.chestPoint = Object.assign(vec(player.position), { dim: Number(player.dimension) || 0 }); save(); broadcast();
            return tell(player, `#${house.id}: სეიფი აქ.`);
        case 'setgarage': {
            if (!needHouse()) return;
            const source = player.vehicle || player;
            const heading = Number(player.vehicle ? (player.vehicle.heading !== undefined ? player.vehicle.heading : player.vehicle.rotation.z) : player.heading) || 0;
            house.garage = Object.assign(vec(source.position), { h: Math.round(heading) }); save(); broadcast();
            return tell(player, `#${house.id}: ავტოფარეხი აქ (მანქანა აქ გამოჩნდება).`);
        }
        case 'setspawn':
            if (!needHouse()) return;
            house.spawn = Object.assign(vec(player.position), { h: Math.round(Number(player.heading) || 0) }); save();
            return tell(player, `#${house.id}: სპაუნი აქ.`);
        case 'price': {
            if (!needHouse()) return;
            const price = Math.floor(Number(args[1]));
            if (!Number.isSafeInteger(price) || price <= 0) return tell(player, 'გამოყენება: /house price <id> <ფასი>');
            house.price = price; save(); broadcast();
            return tell(player, describe(house));
        }
        case 'name':
            if (!needHouse()) return;
            house.name = args.slice(1).join(' ').slice(0, 40) || house.name; save(); broadcast();
            return tell(player, describe(house));
        case 'remove':
            // At a building's entrance with no id: remove the whole building (only if nothing is owned).
            if (args[0] === undefined && house && house.building) {
                const units = unitsOf(house.building);
                const owned = units.filter(h => h.owner);
                if (owned.length) return tell(player, `კორპუსში გაყიდულია ${owned.length} ბინა (${owned.map(h => '#' + h.id).join(', ')}) — ჯერ /house evict <id>, ან წაშალეთ ცალკე: /house remove <id>.`);
                units.forEach(h => { delete data.houses[h.id]; });
                const name = data.buildings[house.building] ? data.buildings[house.building].name : house.building;
                delete data.buildings[house.building];
                save(); broadcast();
                return tell(player, `კორპუსი „${name}“ წაიშალა (${units.length} ბინა).`);
            }
            if (!needHouse()) return;
            if (house.owner) return tell(player, 'სახლს მფლობელი ჰყავს — ჯერ /house evict ' + house.id);
            delete data.houses[house.id]; save(); broadcast();
            return tell(player, `#${house.id} წაიშალა.`);
        case 'evict':
            if (!needHouse()) return;
            if (args[0] === undefined && house.building) return tell(player, 'კორპუსში მიუთითეთ ბინის ნომერი: /house evict <id> (სია: /house info)');
            if (!house.owner) return tell(player, 'სახლი ისედაც იყიდება.');
            tell(player, `#${house.id}: ${house.ownerName} გამოსახლდა (სეიფი დაცარიელდა, მანქანა დარჩა ავტოფარეხთან).`);
            releaseHouse(house); save(); broadcast();
            return;
        case 'tp':
            if (!needHouse()) return;
            player.position = new mp.Vector3(house.door.x, house.door.y, house.door.z);
            return;
        case 'info':
            if (!needHouse()) return;
            if (args[0] === undefined && house.building) return unitsOf(house.building).forEach(h => player.outputChatBox('!{#9aa4ad}' + describe(h)));
            return tell(player, describe(house));
        case 'list': {
            const all = Object.values(data.houses);
            if (!all.length) return tell(player, 'სახლები ჯერ არ არის. /house add <ფასი> [სახელი]');
            return all.forEach(h => player.outputChatBox('!{#9aa4ad}' + describe(h)));
        }
        default:
            tell(player, 'გამოყენება: /house add|setdoor|setchest|setgarage|setspawn|price|name|remove|evict|tp|info|list');
    }
});

// /houses — anyone: list every house for sale (nearest first) with a GPS button, and highlight them on the map.
mp.events.addCommand('houses', (player) => player.call('houses:market'));

global.housesOwnedBy = ownedBy;
