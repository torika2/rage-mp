// ===================== Vehicles: persistent personal cars =====================
// Saves each player's car (model, location, heading, plate and fuel) to vehicles.json keyed by
// Social Club, and re-spawns it where it was left — with the same fuel — when the owner rejoins or
// after a server restart. Fuel itself is driven client-side (packages/economy + client render loop);
// the driver reports it here, we mirror it onto a synced 'veh:fuel' variable and persist it.
const fs = require('fs');
const path = require('path');

const DATA_FILE = path.join(__dirname, 'vehicles.json');
const SAVE_INTERVAL_MS = 20 * 1000; // autosave live position/fuel
const FUEL_MAX = 100;

let store = {};
try { store = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8')); } catch (e) { store = {}; }
function save() {
    const temporaryFile = DATA_FILE + '.tmp';
    try { fs.writeFileSync(temporaryFile, JSON.stringify(store)); fs.renameSync(temporaryFile, DATA_FILE); } catch (e) {}
}
function keyOf(player) { return String(player.socialClub || player.name || ('id' + player.id)); }
// Mirror a record's odometer (km) onto the car's synced variable so the owner's HUD can show it.
function setKmVar(vehicle, record) {
    try { vehicle.setVariable('veh:km', Math.round(Number(record && record.km) || 0)); } catch (e) {}
}
function headingOf(vehicle) {
    if (typeof vehicle.heading === 'number') return vehicle.heading;
    return vehicle.rotation ? vehicle.rotation.z : 0;
}

// Called by /car when a new car is spawned: start (or replace) this player's saved record.
global.vehOnSpawn = function (player, vehicle, modelName) {
    if (!vehicle || !mp.vehicles.exists(vehicle)) return;
    store[keyOf(player)] = {
        model: vehicle.model,
        modelName: modelName || null,
        x: vehicle.position.x, y: vehicle.position.y, z: vehicle.position.z,
        heading: headingOf(vehicle),
        dim: Number(vehicle.dimension) || 0,
        plate: vehicle.numberPlate || null,
        fuel: FUEL_MAX,
        km: 0
    };
    try { vehicle.setVariable('veh:fuel', FUEL_MAX); } catch (e) {}
    setKmVar(vehicle, store[keyOf(player)]);
    save();
};

// Update the saved record from the car's current live state.
function persist(player) {
    const vehicle = player.myCar;
    if (!vehicle || !mp.vehicles.exists(vehicle)) return;
    const record = store[keyOf(player)];
    if (!record) return;
    record.x = vehicle.position.x; record.y = vehicle.position.y; record.z = vehicle.position.z;
    record.heading = headingOf(vehicle);
    record.dim = Number(vehicle.dimension) || 0;
    record.plate = vehicle.numberPlate || record.plate;
    const fuelVar = vehicle.getVariable('veh:fuel');
    if (fuelVar !== undefined && fuelVar !== null) record.fuel = fuelVar;
    save();
}
global.vehPersist = persist;
global.vehForget = function (player) { const k = keyOf(player); if (store[k]) { delete store[k]; save(); } };

// Adopt an existing world vehicle as this player's persistent car, preserving its fuel.
// Used by the parking package when a stored car is retrieved (unpark / impound).
global.vehAdopt = function (player, vehicle, modelName, fuel) {
    if (!vehicle || !mp.vehicles.exists(vehicle)) return;
    const keptFuel = (typeof fuel === 'number' && Number.isFinite(fuel)) ? Math.max(0, Math.min(FUEL_MAX, fuel)) : FUEL_MAX;
    store[keyOf(player)] = {
        model: vehicle.model,
        modelName: modelName || null,
        x: vehicle.position.x, y: vehicle.position.y, z: vehicle.position.z,
        heading: headingOf(vehicle),
        dim: Number(vehicle.dimension) || 0,
        plate: vehicle.numberPlate || null,
        fuel: keptFuel,
        km: (store[keyOf(player)] && Number(store[keyOf(player)].km)) || 0
    };
    try { vehicle.setVariable('veh:fuel', keptFuel); } catch (e) {}
    setKmVar(vehicle, store[keyOf(player)]);
    player.myCar = vehicle;
    save();
};

// ---- House garages (packages/houses): the personal car can be parked away instead of left in the world ----
// Stores the owner's live car: saves its state, flags the record as garaged and removes it from the world.
global.vehGarageStore = function (player, garageId) {
    const vehicle = player.myCar;
    const record = store[keyOf(player)];
    if (!vehicle || !mp.vehicles.exists(vehicle) || !record) return false;
    persist(player);
    record.garage = garageId;
    save();
    try { vehicle.destroy(); } catch (e) {}
    player.myCar = null;
    return true;
};
// Brings the garaged car out at a position (the house's garage spot).
global.vehGarageTake = function (player, position, heading) {
    const record = store[keyOf(player)];
    if (!record || record.garage === undefined || record.garage === null || !record.model) return null;
    if (player.myCar && mp.vehicles.exists(player.myCar)) return null;
    let vehicle;
    try {
        vehicle = mp.vehicles.new(record.model, new mp.Vector3(position.x, position.y, position.z), {
            heading: heading || 0, dimension: 0, numberPlate: record.plate || undefined
        });
    } catch (e) { return null; }
    if (!vehicle) return null;
    delete record.garage;
    record.x = position.x; record.y = position.y; record.z = position.z; record.heading = heading || 0; record.dim = 0;
    const fuel = (typeof record.fuel === 'number') ? record.fuel : FUEL_MAX;
    try { vehicle.setVariable('veh:fuel', fuel); } catch (e) {}
    setKmVar(vehicle, record);
    player.myCar = vehicle;
    save();
    return vehicle;
};
// Which garage (house id) the player's car is parked in, or null.
global.vehGaragedAt = function (player) {
    const record = store[keyOf(player)];
    return record && record.garage !== undefined && record.garage !== null ? record.garage : null;
};
// A garage was taken away (house sold/evicted): put the car back into the world at `position`.
global.vehGarageRelease = function (key, position, heading) {
    const record = store[key];
    if (!record || record.garage === undefined || record.garage === null) return;
    delete record.garage;
    record.x = position.x; record.y = position.y; record.z = position.z; record.heading = heading || 0; record.dim = 0;
    save();
};

// Re-spawn the saved car into the world when the owner joins (unless it's parked in a garage).
function restore(player) {
    if (player.vehRestored) return;
    player.vehRestored = true;
    const record = store[keyOf(player)];
    if (!record || !record.model) return;
    if (record.garage !== undefined && record.garage !== null) {
        player.outputChatBox('!{#8ed17a}[მანქანა] !{#ffffff}თქვენი მანქანა სახლის ავტოფარეხშია.');
        return;
    }
    if (player.myCar && mp.vehicles.exists(player.myCar)) return; // already has one
    let vehicle;
    try {
        vehicle = mp.vehicles.new(record.model, new mp.Vector3(record.x, record.y, record.z), {
            heading: record.heading || 0,
            dimension: record.dim || 0,
            numberPlate: record.plate || undefined
        });
    } catch (e) { return; }
    if (!vehicle) return;
    const fuel = (typeof record.fuel === 'number') ? record.fuel : FUEL_MAX;
    try { vehicle.setVariable('veh:fuel', fuel); } catch (e) {}
    setKmVar(vehicle, record);
    player.myCar = vehicle;
    player.outputChatBox('!{#8ed17a}[მანქანა] !{#ffffff}აღდგა თქვენი ბოლო მანქანა (საწვავი: ' + Math.round(fuel) + '%).');
}
mp.events.add('playerReady', (player) => setTimeout(() => restore(player), 2500));

// Autosave everyone's live car state.
setInterval(() => {
    mp.players.forEach(player => { if (mp.players.exists(player)) persist(player); });
}, SAVE_INTERVAL_MS);

// The driver reports the fuel of the car it's in; mirror onto the synced variable + the record.
mp.events.add('vehicle:fuelReport', (player, fuel) => {
    fuel = Math.round(Number(fuel));
    if (!Number.isFinite(fuel)) return;
    fuel = Math.max(0, Math.min(FUEL_MAX, fuel));
    const vehicle = player.vehicle;
    if (!vehicle || !mp.vehicles.exists(vehicle)) return;
    try { vehicle.setVariable('veh:fuel', fuel); } catch (e) {}
    if (player.myCar && mp.vehicles.exists(player.myCar) && Number(player.myCar.id) === Number(vehicle.id)) {
        const record = store[keyOf(player)];
        if (record) record.fuel = fuel;
    }
});

// The driver of their own car reports metres driven since the last report; we add it to the odometer.
mp.events.add('vehicle:kmReport', (player, meters) => {
    meters = Number(meters);
    if (!Number.isFinite(meters) || meters <= 0 || meters > 200000) return; // sanity: ignore junk / huge jumps
    const vehicle = player.vehicle;
    if (!vehicle || !mp.vehicles.exists(vehicle)) return;
    if (!(player.myCar && mp.vehicles.exists(player.myCar) && Number(player.myCar.id) === Number(vehicle.id))) return; // own car only
    const record = store[keyOf(player)];
    if (!record) return;
    record.km = (Number(record.km) || 0) + meters / 1000;
    setKmVar(vehicle, record); // next time they enter, base reflects the new total
});

// Save on quit (freeroam also calls vehPersist before it destroys the car, so this is a backstop).
mp.events.add('playerQuit', (player) => persist(player));
