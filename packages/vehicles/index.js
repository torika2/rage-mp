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
        fuel: FUEL_MAX
    };
    try { vehicle.setVariable('veh:fuel', FUEL_MAX); } catch (e) {}
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

// Re-spawn the saved car into the world when the owner joins.
function restore(player) {
    if (player.vehRestored) return;
    player.vehRestored = true;
    const record = store[keyOf(player)];
    if (!record || !record.model) return;
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

// Save on quit (freeroam also calls vehPersist before it destroys the car, so this is a backstop).
mp.events.add('playerQuit', (player) => persist(player));
