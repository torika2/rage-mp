// ===================== Car shop (dealership) =====================
// Buy a car at the dealership. Ownership is recorded in MySQL (vehicles table, via global.api) so a
// character can own many cars; the bought car is spawned as the player's active car and reuses the
// existing fuel/parking/persistence (global.vehAdopt). /mycars lists owned cars, /getcar retrieves
// one. Free /car is admins-only (see packages/freeroam).
//
// Money: global.getMoney/setMoney/canAfford (economy). Ownership API: global.api.* (packages/_core).

const DEALER = { x: -56.6, y: -1096.6, z: 25.42 };          // Premium Deluxe Motorsport showroom
const EXIT = { x: -19.6, y: -1084.9, z: 26.6, h: 160 };     // where bought/retrieved cars appear
const HINT_RANGE = 6.0;                                     // walk-in hint radius
const AREA_RANGE = 55.0;                                    // whole lot counts as "at the dealership" for buying

// Display layout: cars parked in a grid you can walk up to and "enter" to get the buy card.
// Two groups (inside the showroom + outside in the lot). Adjust these in-game if the ground differs.
// Fixed display spots (x, y, z, heading) — catalog cars fill them in order.
const SPOTS = [
    [-45.002, -1116.682, 26.433, -1.0],
    [-47.763, -1117.031, 26.433, 1.3],
    [-50.498, -1117.149, 26.433, 9.4],
    [-53.543, -1117.125, 26.433, 2.1],
    [-56.153, -1117.352, 26.433, 3.5],
    [-59.049, -1117.272, 26.433, -0.3],
    [-61.756, -1117.557, 26.433, 3.2],
    [-58.606, -1105.861, 26.436, 72.0],
    [-45.134, -1099.756, 26.422, 127.2],
    [-53.363, -1095.922, 26.422, 111.4],
    [-34.725, -1097.058, 26.422, 156.3],
    [-41.183, -1097.590, 26.422, 159.1],
    [-47.077, -1093.870, 26.422, 162.5],
    [-51.080, -1092.238, 26.422, 157.7],
    [-54.335, -1090.769, 26.422, 156.3],
    [-46.251, -1108.720, 26.422, 68.4],
    [-51.458, -1080.361, 26.888, 68.8],
    [-48.862, -1073.806, 26.783, 69.3],
    [-15.705, -1108.313, 26.672, -82.5],
    [-14.736, -1105.060, 26.672, -81.5],
    [-13.827, -1101.992, 26.672, -83.5],
    [-12.698, -1098.376, 26.672, -83.3],
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
};

function tell(player, message, ok) {
    player.outputChatBox((ok === false ? '!{#ff6b6b}' : '!{#8ed17a}') + '[ავტოსალონი] !{#ffffff}' + message);
}
function labelOf(modelName) { return (CATALOG[modelName] && CATALOG[modelName].label) || modelName || 'მანქანა'; }

function atDealer(player) {
    if (Number(player.dimension) !== 0) return false;
    const p = player.position, dx = p.x - DEALER.x, dy = p.y - DEALER.y;
    return dx * dx + dy * dy <= AREA_RANGE * AREA_RANGE; // flat distance over the whole lot
}

// ---- blip + marker + walk-in hint ----
try {
    mp.blips.new(326, new mp.Vector3(DEALER.x, DEALER.y, DEALER.z), { name: 'ავტოსალონი', color: 3, scale: 0.9, shortRange: true });
    mp.markers.new(1, new mp.Vector3(DEALER.x, DEALER.y, DEALER.z - 1.0), 1.6, { color: [90, 200, 250, 120] });
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
function spawnDisplays() {
    const keys = Object.keys(CATALOG);
    const overflow = gridSpots(OVERFLOW, Math.max(0, keys.length - SPOTS.length));
    keys.forEach((key, i) => {
        const s = i < SPOTS.length
            ? { x: SPOTS[i][0], y: SPOTS[i][1], z: SPOTS[i][2], h: SPOTS[i][3] }
            : overflow[i - SPOTS.length];
        let v;
        try { v = mp.vehicles.new(mp.joaat(CATALOG[key].model) >>> 0, new mp.Vector3(s.x, s.y, s.z), { heading: s.h, dimension: 0, engine: false }); }
        catch (e) { return; }
        if (!v) return;
        v.setVariable('carshop:display', key); // tag so entering pops the buy card instead of driving
        displayVehicles.push(v);
    });
    console.log(`[carshop] ${displayVehicles.length} display cars spawned`);
}
spawnDisplays();

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
    global.api.updateVehicle(player.activeVehId, {
        x: p.x, y: p.y, z: p.z, heading: v.rotation ? v.rotation.z : 0, dim: Number(v.dimension) || 0,
        fuel: typeof fuel === 'number' ? fuel : 100, km: Number(km) || 0,
    }).catch(() => {});
}

// Spawn an owned DB row as the player's active car (preserving its fuel), via the existing system.
function spawnOwnedCar(player, row) {
    if (player.myCar && mp.vehicles.exists(player.myCar)) { saveActiveToDb(player); try { player.myCar.destroy(); } catch (e) {} }
    let veh;
    try {
        veh = mp.vehicles.new(Number(row.model) >>> 0, new mp.Vector3(EXIT.x, EXIT.y, EXIT.z), {
            heading: EXIT.h, dimension: 0, numberPlate: row.plate || undefined,
        });
    } catch (e) { return null; }
    if (!veh) return null;
    const fuel = typeof row.fuel === 'number' ? row.fuel : 100;
    if (global.vehAdopt) global.vehAdopt(player, veh, row.modelName, fuel); else player.myCar = veh;
    try { veh.setVariable('veh:km', Math.round(Number(row.km) || 0)); } catch (e) {}
    player.activeVehId = row.id;
    setTimeout(() => { if (mp.players.exists(player) && mp.vehicles.exists(veh) && !player.vehicle) player.putIntoVehicle(veh, 0); }, 600);
    try { player.putIntoVehicle(veh, 0); } catch (e) {}
    return veh;
}

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
    if (!atDealer(player)) return reply(false, 'მიდით ავტოსალონში.');
    const car = CATALOG[String(key)];
    if (!car) return reply(false, 'ასეთი მანქანა არ არსებობს.');
    if (!player.character) return reply(false, 'ანგარიში ვერ მოიძებნა.');
    if (typeof global.getMoney !== 'function' || !global.canAfford(player, car.price)) {
        return reply(false, `არასაკმარისი თანხა — საჭიროა $${car.price}.`);
    }
    try {
        const row = await global.api.createVehicle(player.character.id, {
            model: mp.joaat(car.model) >>> 0, modelName: String(key),
            x: EXIT.x, y: EXIT.y, z: EXIT.z, heading: EXIT.h, dim: 0, fuel: 100, km: 0,
        });
        global.setMoney(player, global.getMoney(player) - car.price); // charge only after ownership is recorded
        spawnOwnedCar(player, row);
        console.log(`[carshop] ${player.name} bought ${key} ($${car.price}) -> vehicle #${row.id}`);
        reply(true, `შეიძინეთ ${car.label} — $${car.price}.`);
    } catch (e) {
        console.log('[carshop] buy failed: ' + (e && e.message));
        reply(false, 'შეძენა ვერ მოხერხდა, სცადეთ თავიდან.');
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
    const n = parseInt(numberArg, 10);
    try {
        const list = await global.api.loadVehicles(player.character.id);
        if (!Number.isInteger(n) || n < 1 || n > list.length) return tell(player, 'გამოყენება: /getcar <ნომერი> (იხ. /mycars)', false);
        const row = list[n - 1];
        if (!spawnOwnedCar(player, row)) return tell(player, 'მანქანის გამოყვანა ვერ მოხერხდა.', false);
        tell(player, 'გამოყვანილია: ' + labelOf(row.modelName));
    } catch (e) { tell(player, 'ვერ მოხერხდა.', false); }
});

// Persist the active bought car's live state to its DB row periodically and on quit.
setInterval(() => { mp.players.forEach(p => { if (mp.players.exists(p)) saveActiveToDb(p); }); }, 30 * 1000);
mp.events.add('playerQuit', (player) => saveActiveToDb(player));

global.carshopCatalog = () => CATALOG;
