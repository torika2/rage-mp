// ===================== Car shop (dealership) =====================
// Buy a car at the dealership. Ownership is recorded in MySQL (vehicles table, via global.api) so a
// character can own many cars; the bought car is spawned as the player's active car and reuses the
// existing fuel/parking/persistence (global.vehAdopt). /mycars lists owned cars, /getcar retrieves
// one. Free /car is admins-only (see packages/freeroam).
//
// Money: global.getMoney/setMoney/canAfford (economy). Ownership API: global.api.* (packages/_core).

const DEALER = { x: -56.6, y: -1096.6, z: 25.42 };          // Premium Deluxe Motorsport showroom
const EXIT = { x: -67.250, y: -1094.693, z: 25.577, h: 89.2 };     // where bought/retrieved cars appear
const HINT_RANGE = 6.0;                                     // walk-in hint radius
const AREA_RANGE = 55.0;                                    // whole lot counts as "at the dealership" for buying

// Display layout: cars parked in a grid you can walk up to and "enter" to get the buy card.
// Two groups (inside the showroom + outside in the lot). Adjust these in-game if the ground differs.
// Fixed display spots (x, y, z, heading) — catalog cars fill them in order.
const SPOTS = [
    [-64.996, -1110.326, 26.269, 67.5],
    [-61.756, -1117.557, 26.433, 3.2],
    [-59.049, -1117.272, 26.433, -0.3],
    [-56.153, -1117.352, 26.433, 3.5],
    [-53.543, -1117.125, 26.433, 2.1],
    [-50.498, -1117.149, 26.433, 9.4],
    [-47.763, -1117.031, 26.433, 1.3],
    [-45.002, -1116.682, 26.433, -1.0],
    [-41.404, -1116.741, 26.435, 7.3],
    [-58.706, -1104.208, 26.436, 67.5],
    [-52.394, -1106.582, 26.438, 69.8],
    [-46.251, -1108.720, 26.422, 68.4],
    [-37.016, -1102.935, 26.422, 154.6],
    [-43.120, -1101.566, 26.422, 66.5],
    [-49.176, -1099.234, 26.422, 68.6],
    [-34.725, -1097.058, 26.422, 156.3],
    [-40.183, -1095.200, 26.422, 159.1],
    [-43.881, -1094.918, 26.422, 159.4],
    [-47.077, -1093.870, 26.422, 162.5],
    [-51.080, -1092.238, 26.422, 157.7],
    [-31.754, -1089.543, 26.422, 152.7],
    [-27.397, -1083.509, 26.591, 137.3],
    [-18.675, -1080.403, 26.672, -55.9],
    [-15.163, -1081.105, 26.672, -56.3],
    [-11.519, -1082.378, 26.672, -60.2],
    [-8.519, -1084.646, 26.676, -63.1],
    [-10.773, -1090.039, 26.672, -10.9],
    // [-13.470, -1094.987, 26.672, -82.5],
    [-12.698, -1098.376, 26.672, -83.3],
    [-13.827, -1101.992, 26.672, -83.5],
    [-14.736, -1105.060, 26.672, -81.5],
    [-15.705, -1108.313, 26.672, -82.5],
    [-16.904, -1111.545, 26.672, -81.8],
    [-17.599, -1115.496, 26.672, -84.4],
    [-51.458, -1080.361, 26.888, 68.8],
    [-48.862, -1073.806, 26.783, 69.3], //35
];
// Catalog cars beyond the fixed spots go in this overflow grid in the outside lot.
const OVERFLOW = { base: { x: -34.0, y: -1078.0, z: 26.70 }, heading: 340, cols: 6, stepRight: 4.2, stepBack: 6.0 };

// Buyable civilian add-ons. key = stored modelName/alias, model = spawn name.
// label = short list name · fullName/hp/speed(km/h)/tuning = shown in the display buy card.
const CATALOG = {
    yumi:         { model: 'yumi',            label: 'Yumi',                 fullName: 'Yumi',                                hp: 400,  speed: 280, tuning: 'Stage 1', price: 50000 },
    m5e39:        { model: 'bmwm5e39',        label: 'BMW M5 E39',           fullName: 'BMW M5 E39',                          hp: 400,  speed: 290, tuning: 'Stock',   price: 60000 },
    f44:          { model: 'M235iXD',         label: 'BMW M235i (F44)',      fullName: 'BMW M235i Gran Coupé (F44)',          hp: 306,  speed: 250, tuning: 'Stock',   price: 70000 },
    charger69:    { model: '69charger',       label: '1969 Charger',         fullName: '1969 Dodge Charger',                  hp: 425,  speed: 240, tuning: 'Stage 1', price: 75000 },
    z28:          { model: '15z28',           label: 'Camaro Z/28',          fullName: 'Chevrolet Camaro Z/28 2015',          hp: 505,  speed: 280, tuning: 'Stock',   price: 80000 },
    bmwm4:        { model: 'g82adro',         label: 'BMW M4 (Adro)',        fullName: 'BMW M4 G82 (Adro Kit)',               hp: 503,  speed: 290, tuning: 'Stage 2', price: 85000 },
    m4f82:        { model: 'm4f82',           label: 'BMW M4 F82',           fullName: 'BMW M4 F82 Competition',              hp: 431,  speed: 280, tuning: 'Stock',   price: 85000 },
    colorado:     { model: 'ccadd',           label: 'Colorado ZR2',         fullName: 'Chevrolet Colorado ZR2',              hp: 308,  speed: 180, tuning: 'Stock',   price: 85000 },
    cls:          { model: 'cls2015',         label: 'Mercedes CLS',         fullName: 'Mercedes-Benz CLS 6.3 AMG',           hp: 507,  speed: 300, tuning: 'Stage 1', price: 95000 },
    lc300:        { model: '300vxr',          label: 'LC300 VX.R',           fullName: 'Toyota Land Cruiser 300 VX.R',        hp: 415,  speed: 210, tuning: 'Stock',   price: 95000 },
    lx570:        { model: 'lx57019mc',       label: 'Lexus LX570',          fullName: 'Lexus LX570 2019 Black Edition',      hp: 383,  speed: 220, tuning: 'Stock',   price: 100000 },
    demon:        { model: 'dcd',             label: 'Demon SRT',            fullName: 'Dodge Challenger SRT Demon',          hp: 808,  speed: 340, tuning: 'Stage 2', price: 110000 },
    audirs7:      { model: '23rs7',           label: 'Audi RS7',             fullName: 'Audi RS7 2023',                       hp: 600,  speed: 305, tuning: 'Stage 1', price: 120000 },
    audirs7sport: { model: 'rmodrs7',         label: 'RS7 Sportback',        fullName: 'Audi RS7 Sportback',                  hp: 600,  speed: 305, tuning: 'Stage 1', price: 125000 },
    rs6:          { model: 'avant',           label: 'Audi RS6',             fullName: 'Audi RS6 Avant',                      hp: 591,  speed: 305, tuning: 'Stage 1', price: 125000 },
    d5:           { model: 'coquette6c',      label: 'Coquette D5',          fullName: 'Invetero Coquette D5 (Corvette)',     hp: 495,  speed: 312, tuning: 'Stock',   price: 130000 },
    audirs7abt:   { model: '23rs7abt',        label: 'Audi RS7 ABT',         fullName: 'Audi RS7 ABT',                        hp: 730,  speed: 330, tuning: 'Stage 2', price: 135000 },
    f90:          { model: '2019M5',          label: 'BMW M5 F90',           fullName: 'BMW M5 F90 Competition',              hp: 625,  speed: 305, tuning: 'Stage 1', price: 140000 },
    m8:           { model: 'mansm8c',         label: 'BMW M8',               fullName: 'BMW M8 Competition (Mansory)',        hp: 823,  speed: 330, tuning: 'Stage 2', price: 150000 },
    sclass:       { model: 'mercedessclass27', label: 'S-Class 2027',        fullName: 'Mercedes-Benz S-Class 2027',          hp: 496,  speed: 250, tuning: 'Stock',   price: 160000 },
    r8:           { model: 'r820',            label: 'Audi R8',              fullName: 'Audi R8 2020',                        hp: 620,  speed: 331, tuning: 'Stage 1', price: 180000 },
    fenomeno:     { model: 'fenomeno',        label: 'Lamborghini',          fullName: 'Lamborghini Fenomeno 2026',           hp: 1065, speed: 350, tuning: 'Stage 3', price: 300000 },
    // --- Allmods pack (added Oct 2026) · stats/prices are estimates — adjust as needed ---
    rx7:          { model: 'fd',              label: 'Mazda RX-7 FD',        fullName: 'Mazda RX-7 FD3S',                     hp: 276,  speed: 250, tuning: 'Stage 1', price: 90000 },
    golfr:        { model: 'golf75r',         label: 'Golf R',               fullName: 'Volkswagen Golf R',                   hp: 316,  speed: 250, tuning: 'Stock',   price: 85000 },
    supra4:       { model: 'a80',             label: 'Supra MK4',            fullName: 'Toyota Supra MK4 (JZA80)',            hp: 326,  speed: 285, tuning: 'Stage 1', price: 110000 },
    rrst:         { model: 'rrst',            label: 'RR ST',                fullName: 'RR ST',                               hp: 400,  speed: 260, tuning: 'Stock',   price: 120000 },
    skyline:      { model: 'skyline',         label: 'Nissan Skyline',       fullName: 'Nissan Skyline',                      hp: 330,  speed: 280, tuning: 'Stage 1', price: 120000 },
    wrx:          { model: 'subwrx',          label: 'Subaru WRX STI',       fullName: 'Subaru WRX STI',                      hp: 310,  speed: 255, tuning: 'Stock',   price: 80000 },
    supra90:      { model: 'supra19',         label: 'Supra A90',            fullName: 'Toyota Supra A90 (2019)',             hp: 340,  speed: 285, tuning: 'Stage 1', price: 115000 },
    g63:          { model: 'xg632019',        label: 'Mercedes G63',         fullName: 'Mercedes-AMG G63 2019',               hp: 577,  speed: 220, tuning: 'Stock',   price: 180000 },
    contgt:       { model: 'contgt13',        label: 'Bentley Continental',  fullName: 'Bentley Continental GT 2013',         hp: 575,  speed: 290, tuning: 'Stock',   price: 175000 },
    evo10:        { model: 'evo10',           label: 'Lancer Evo X',         fullName: 'Mitsubishi Lancer Evo X',             hp: 291,  speed: 250, tuning: 'Stage 1', price: 70000 },
};

function tell(player, message, ok) {
    player.outputChatBox((ok === false ? '!{#ff6b6b}' : '!{#8ed17a}') + '[ავტოსალონი] !{#ffffff}' + message);
}
function labelOf(modelName) { return (CATALOG[modelName] && CATALOG[modelName].label) || modelName || 'მანქანა'; }
global.carshopLabelOf = labelOf;

// Catalog of buyable cars as { model: spawnName, label }. The admin Cars tab uses this as the
// authoritative car list for the live speed-multiplier editor (keyed by spawn model name).
global.carCatalog = () => Object.values(CATALOG).map(car => ({ model: car.model, label: car.label }));

function atDealer(player) {
    if (Number(player.dimension) !== 0) return false;
    const p = player.position, dx = p.x - DEALER.x, dy = p.y - DEALER.y;
    return dx * dx + dy * dy <= AREA_RANGE * AREA_RANGE; // flat distance over the whole lot
}

// ---- walk-in hint (no map blip, no ground marker — the showroom cars are the visual cue) ----
try {
    const zone = mp.colshapes.newSphere(DEALER.x, DEALER.y, DEALER.z, HINT_RANGE);
    zone.onEnter = (player) => { if (mp.players.exists(player)) tell(player, 'მანქანაში შესვლით ნახავთ მის დეტალებს, ან აკრიფეთ /buycar'); };
} catch (e) { console.log('[carshop] setup failed: ' + e); }

// ---- display cars: park the whole catalog so players can walk up and "enter" to buy ----
function gridSpots(group, count) {
    const rad = group.heading * Math.PI / 180;
    const fx = -Math.sin(rad), fy = Math.cos(rad); // forward
    const rx = Math.cos(rad), ry = Math.sin(rad);  // right
    const out = [];
    for (let i = 0; i < count; i++) {
        const col = i % group.cols, row = Math.floor(i / group.cols);
        out.push({
            x: group.base.x + rx * col * group.stepRight - fx * row * group.stepBack,
            y: group.base.y + ry * col * group.stepRight - fy * row * group.stepBack,
            z: group.base.z, h: group.heading,
        });
    }
    return out;
}
const displayVehicles = [];
const DISPLAY_SPAWN_DELAY_MS = 800; // stagger display-car spawns: streaming ~30 add-on models in one tick
                                    // froze players near the showroom. One car per ~0.8s is well-spaced
                                    // enough to avoid the hitch while filling the lot ~2x faster than 1.5s.
function spawnDisplays() {
    const keys = Object.keys(CATALOG);
    const overflow = gridSpots(OVERFLOW, Math.max(0, keys.length - SPOTS.length));
    // Fill spots in key order 0,1,2… with no gaps: `spot` only advances when a car actually spawns,
    // so a model that fails to spawn doesn't leave an empty slot — the next car takes that spot.
    let ki = 0;   // next catalog key
    let spot = 0; // next free display spot (advances only on a successful spawn)
    function spawnNext() {
        if (ki >= keys.length) { console.log(`[carshop] ${displayVehicles.length} display cars spawned`); return; }
        const key = keys[ki++];
        const s = spot < SPOTS.length
            ? { x: SPOTS[spot][0], y: SPOTS[spot][1], z: SPOTS[spot][2], h: SPOTS[spot][3] }
            : overflow[spot - SPOTS.length];
        if (!s) { console.log(`[carshop] ${displayVehicles.length} display cars spawned (out of spots)`); return; } // ran out of spots
        let v;
        try { v = mp.vehicles.new(mp.joaat(CATALOG[key].model) >>> 0, new mp.Vector3(s.x, s.y, s.z), { heading: s.h, dimension: 0, engine: false }); }
        catch (e) { v = null; } // model failed — leave the spot free for the next car
        if (v) {
            v.setVariable('carshop:display', key); // tag so entering pops the buy card instead of driving
            if (CATALOG[key].visual) { try { v.setVariable('veh:visual', CATALOG[key].visual); } catch (e) {} } // show the preset look
            v.displaySpot = { x: s.x, y: s.y, z: s.z, h: s.h }; // server-authoritative anchor (see keepDisplaysParked)
            displayVehicles.push(v);
            spot++; // this spot is now taken
        }
        setTimeout(spawnNext, DISPLAY_SPAWN_DELAY_MS);
    }
    spawnNext();
}
spawnDisplays();

// Keep showroom cars on their spot and pristine. Home is the fixed spawn spot. We compare HORIZONTAL
// position only (X/Y) — a parked car never drifts in X/Y, but it does settle vertically onto the
// ground, and checking Z was wrongly flagging idle cars as "moved" and respawning them every tick.
// So: only a car actually shoved off its spot (X/Y) gets put back, and only a damaged one is repaired.
const RESET_COUNTDOWN = 5; // seconds a moved showroom car shows a warning before it snaps back
// Show a floating countdown above a shoved car, then put it back on its spot + repair.
function scheduleDisplayReset(v) {
    if (!v || v.resetting || !v.displaySpot) return;
    v.resetting = true;
    const sp = v.displaySpot;
    const above = () => new mp.Vector3(v.position.x, v.position.y, v.position.z + 1.6);
    let secs = RESET_COUNTDOWN, label = null;
    try { label = mp.labels.new('Resetting in ' + secs + 's', above(), { los: false, font: 4, drawDistance: 60, color: [242, 193, 92, 255] }); } catch (e) {}
    const tick = setInterval(() => {
        if (!v || !mp.vehicles.exists(v)) { clearInterval(tick); if (label) { try { label.destroy(); } catch (e) {} } return; }
        secs -= 1;
        if (secs > 0) {
            try { if (label) { label.text = 'Resetting in ' + secs + 's'; label.position = above(); } } catch (e) {}
            return;
        }
        clearInterval(tick);
        if (label) { try { label.destroy(); } catch (e) {} }
        try { v.position = new mp.Vector3(sp.x, sp.y, v.position.z); } catch (e) {} // back to spot X/Y, keep grounded Z
        try { v.rotation = new mp.Vector3(0, 0, sp.h); } catch (e) {}
        try { v.repair(); } catch (e) {}
        v.resetting = false;
    }, 1000);
}
setInterval(() => {
    for (const v of displayVehicles) {
        if (!v || !mp.vehicles.exists(v) || !v.displaySpot) continue;
        const sp = v.displaySpot, p = v.position;
        const dx = p.x - sp.x, dy = p.y - sp.y;
        const movedXY = (dx * dx + dy * dy) > 0.04; // shoved > ~0.2m horizontally (vertical settling ignored)
        const bh = (typeof v.bodyHealth === 'number') ? v.bodyHealth : 1000;
        const eh = (typeof v.engineHealth === 'number') ? v.engineHealth : 1000;
        const damaged = bh < 950 || eh < 950;
        if (movedXY) scheduleDisplayReset(v);      // countdown label, then snap back + repair
        else if (damaged && !v.resetting) { try { v.repair(); } catch (e) {} } // quiet repair for dents in place
    }
}, 60 * 1000);

// Dev aid: float each spot's key index above it so the SPOTS array can be tuned in-game.
// Labels cover every spot (even empty ones), so you can see and reposition unused slots too.
// Turn off for production.
const SHOW_SPOT_NUMBERS = true;
function labelSpots() {
    SPOTS.forEach((s, i) => {
        try {
            mp.labels.new('#' + i, new mp.Vector3(s[0], s[1], s[2] + 1.4),
                { los: false, font: 4, drawDistance: 40, color: [242, 193, 92, 255], dimension: 0 });
        } catch (e) {}
    });
}
if (SHOW_SPOT_NUMBERS) labelSpots();

// Trying to get into a display car ejects you and opens its buy card.
mp.events.add('playerEnterVehicle', (player, vehicle, seat) => {
    const key = vehicle && vehicle.getVariable && vehicle.getVariable('carshop:display');
    if (!key) return;
    try { player.removeFromVehicle(); } catch (e) {}
    sendDetails(player, key);
});

function sendDetails(player, key) {
    const c = CATALOG[key];
    if (!c) return;
    player.call('carshop:details', [JSON.stringify({
        key, fullName: c.fullName, label: c.label, hp: c.hp, speed: c.speed, tuning: c.tuning, price: c.price,
        money: global.getMoney ? global.getMoney(player) : 0,
        canAfford: global.canAfford ? global.canAfford(player, c.price) : false,
    })]);
}

// ---- live car state -> its DB row ----
function saveActiveToDb(player) {
    if (!player.activeVehId || !player.myCar || !mp.vehicles.exists(player.myCar) || !global.api) return;
    const v = player.myCar, p = v.position;
    const fuel = v.getVariable('veh:fuel'), km = v.getVariable('veh:km');
    let octane = null;
    try { octane = v.getVariable('veh:octane') || null; } catch (e) {}
    global.api.updateVehicle(player.activeVehId, {
        x: p.x, y: p.y, z: p.z, heading: v.rotation ? v.rotation.z : 0, dim: Number(v.dimension) || 0,
        fuel: typeof fuel === 'number' ? fuel : 100, km: Number(km) || 0, octane,
    }).catch(() => {});
}
global.vehSaveActiveToDb = saveActiveToDb;

// Spawn an owned DB row as the player's active car (preserving its fuel), via the existing system.
function spawnOwnedCar(player, row, spawnPoint) {
    const destination = spawnPoint || EXIT;
    if (player.myCar && mp.vehicles.exists(player.myCar)) { saveActiveToDb(player); try { player.myCar.destroy(); } catch (e) {} }
    let veh;
    try {
        veh = mp.vehicles.new(Number(row.model) >>> 0, new mp.Vector3(destination.x, destination.y, destination.z), {
            heading: destination.h || 0, dimension: 0, numberPlate: row.plate || undefined,
        });
    } catch (e) { return null; }
    if (!veh) return null;
    const fuel = typeof row.fuel === 'number' ? row.fuel : 100;
    if (global.vehAdopt) global.vehAdopt(player, veh, row.modelName, fuel, row.id); else player.myCar = veh;
    try { veh.setVariable('veh:km', Math.round(Number(row.km) || 0)); } catch (e) {}
    try { veh.setVariable('veh:octane', row.octane || null); } catch (e) {} // restore the fuel grade they paid for
    player.activeVehId = row.id;
    if (global.vehApplyTuning) global.vehApplyTuning(veh, row.id, row.tuning); // restore garage upgrades
    if (global.vehApplyVisual) global.vehApplyVisual(veh, row.id, row.visual); // restore colors/wheels/body
    setTimeout(() => { if (mp.players.exists(player) && mp.vehicles.exists(veh) && !player.vehicle) player.putIntoVehicle(veh, 0); }, 600);
    try { player.putIntoVehicle(veh, 0); } catch (e) {}
    return veh;
}
global.carshopSpawnOwnedCar = spawnOwnedCar;

// ---- shop data + buy ----
function sendData(player) {
    const cars = Object.keys(CATALOG).map(key => ({ key, label: CATALOG[key].label, price: CATALOG[key].price }));
    player.call('carshop:data', [JSON.stringify({
        money: global.getMoney ? global.getMoney(player) : 0,
        atShop: atDealer(player),
        cars,
    })]);
}

mp.events.add('carshop:requestData', (player) => sendData(player));

mp.events.add('carshop:buy', async (player, key) => {
    const reply = (ok, msg) => player.call('carshop:result', [JSON.stringify({ ok, msg, money: global.getMoney ? global.getMoney(player) : 0 })]);
    if (player.ownedVehicleSpawnInProgress) return reply(false, 'მანქანის გამოყვანა უკვე მიმდინარეობს.');
    if (!atDealer(player)) return reply(false, 'მიდით ავტოსალონში.');
    const car = CATALOG[String(key)];
    if (!car) return reply(false, 'ასეთი მანქანა არ არსებობს.');
    if (!player.character) return reply(false, 'ანგარიში ვერ მოიძებნა.');
    if (typeof global.getMoney !== 'function' || !global.canAfford(player, car.price)) {
        return reply(false, `არასაკმარისი თანხა — საჭიროა $${car.price}.`);
    }
    player.ownedVehicleSpawnInProgress = true;
    try {
        const row = await global.api.createVehicle(player.character.id, {
            model: mp.joaat(car.model) >>> 0, modelName: String(key),
            visual: car.visual || null, // preset look (e.g. M8 ducktail) persists with the car
            x: EXIT.x, y: EXIT.y, z: EXIT.z, heading: EXIT.h, dim: 0, fuel: 100, km: 0,
        });
        global.setMoney(player, global.getMoney(player) - car.price); // charge only after ownership is recorded
        spawnOwnedCar(player, row);
        console.log(`[carshop] ${player.name} bought ${key} ($${car.price}) -> vehicle #${row.id}`);
        reply(true, `შეიძინეთ ${car.label} — $${car.price}.`);
    } catch (e) {
        console.log('[carshop] buy failed: ' + (e && e.message));
        reply(false, 'შეძენა ვერ მოხერხდა, სცადეთ თავიდან.');
    } finally {
        player.ownedVehicleSpawnInProgress = false;
    }
});

// ---- commands ----
mp.events.addCommand('buycar', (player) => {
    if (!atDealer(player)) return tell(player, 'მიდით ავტოსალონში (რუკაზე მანქანის ნიშანი).', false);
    sendData(player);
    player.call('carshop:open');
});

mp.events.addCommand('mycars', async (player) => {
    if (!player.character || !global.api) return tell(player, 'ანგარიში ვერ მოიძებნა.', false);
    try {
        const list = await global.api.loadVehicles(player.character.id);
        if (!list.length) return tell(player, 'საკუთარი მანქანა არ გაქვთ — შეიძინეთ ავტოსალონში.', false);
        tell(player, 'თქვენი მანქანები:');
        list.forEach((v, i) => player.outputChatBox(`!{#9aa4ad}${i + 1}. ${labelOf(v.modelName)} — საწვავი ${Math.round(Number(v.fuel) || 0)}% — /getcar ${i + 1}`));
    } catch (e) { tell(player, 'სია ვერ ჩაიტვირთა.', false); }
});

mp.events.addCommand('getcar', async (player, _, numberArg) => {
    if (!player.character || !global.api) return tell(player, 'ანგარიში ვერ მოიძებნა.', false);
    if (player.ownedVehicleSpawnInProgress) return tell(player, 'მანქანის გამოყვანა უკვე მიმდინარეობს.', false);
    player.ownedVehicleSpawnInProgress = true;
    const n = parseInt(numberArg, 10);
    try {
        const list = await global.api.loadVehicles(player.character.id);
        if (!Number.isInteger(n) || n < 1 || n > list.length) return tell(player, 'გამოყენება: /getcar <ნომერი> (იხ. /mycars)', false);
        const row = list[n - 1];
        if (!spawnOwnedCar(player, row)) return tell(player, 'მანქანის გამოყვანა ვერ მოხერხდა.', false);
        tell(player, 'გამოყვანილია: ' + labelOf(row.modelName));
    } catch (e) { tell(player, 'ვერ მოხერხდა.', false); }
    finally { player.ownedVehicleSpawnInProgress = false; }
});

// Persist the active bought car's live state to its DB row periodically and on quit.
setInterval(() => { mp.players.forEach(p => { if (mp.players.exists(p)) saveActiveToDb(p); }); }, 30 * 1000);
mp.events.add('playerQuit', (player) => saveActiveToDb(player));

global.carshopCatalog = () => CATALOG;
