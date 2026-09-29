// =====================================================================
//  Freeroam client: radio-off, engine toggle, CEF speedometer HUD,
//  fuel system (octanes/prices) + CEF gas-station UI, money, pump markers
// =====================================================================

const CFG = {
    engineCooldownMs: 1000,   // anti-spam between engine toggles
    stopSpeed: 0.5,           // m/s below which the car counts as "stopped"

    fuelMax: 100,             // full tank = 100%
    tankLiters: 65,           // 100% == this many litres
    fuelIdleDrain: 0.03,      // %/sec while engine on and (near) stationary
    fuelDriveDrain: 0.15,     // %/sec extra, scaled by rpm (0..1)
    refuelRange: 12.0,        // metres from a pump to use the menu
    lowFuelWarn: 15,          // % at which the fuel bar turns red

    hudHz: 20                 // HUD refresh rate (updates/sec)
};

// Tiered fuel. eff = fuel-burn (higher burns faster / less range).
// power = engine power multiplier (>=1 only; SET_VEHICLE_ENGINE_POWER_MULTIPLIER
// ignores values <1, so Regular is the 1.0 baseline and higher grades add power/speed).
const OCTANES = [
    { name: 'რეგულარი 87', price: 2.3, eff: 1.15, power: 1.00, speedRate: 1.00, rating: 87 },  // cheapest, stock power, shortest range
    { name: 'პლუსი 91',    price: 3.0, eff: 1.00, power: 1.08, speedRate: 1.08, rating: 91 },  // mid cost, +8% power/speed
    { name: 'პრემიუმი 98', price: 4.2, eff: 0.85, power: 1.18, speedRate: 1.18, rating: 98 },  // +18% power/speed, long range
    { name: 'სუპერი 100',  price: 5.5, eff: 0.75, power: 1.48, speedRate: 1.48, rating: 100 }  // top tier: +48% power/speed, longest range
];
// A fresh full tank behaves like Plus 91.
const DEFAULT_OCTANE = { power: 1.08, eff: 1.00, speedRate: 1.08, rating: 91 };

const GAS_STATIONS = [
    [49.42, 2778.79, 58.04], [263.89, 2606.46, 46.02], [1039.96, 2671.13, 39.55],
    [1207.26, 2660.18, 37.90], [2539.69, 2594.19, 37.95], [2679.86, 3263.95, 55.24],
    [2005.06, 3773.89, 32.40], [1687.16, 4929.39, 42.08], [1701.31, 6416.03, 32.76],
    [179.86, 6602.84, 31.87], [-94.46, 6419.59, 31.49], [-2554.99, 2334.40, 33.08],
    [-1800.38, 803.66, 138.65], [-1437.62, -276.75, 46.21], [-2096.24, -320.29, 13.17],
    [-724.62, -935.10, 19.21], [-526.02, -1211.00, 18.18], [-70.21, -1761.79, 29.53],
    [265.65, -1261.31, 29.29], [819.65, -1028.85, 26.40], [1208.95, -1402.57, 35.22],
    [1181.38, -330.85, 69.32], [620.84, 268.10, 103.09], [2581.32, 362.04, 108.47],
    [176.63, -1562.03, 29.26], [-319.29, -1471.72, 30.55], [1785.18, -1024.28, 138.56]
];
GAS_STATIONS.forEach(p => {
    mp.blips.new(361, new mp.Vector3(p[0], p[1], p[2]),
        { name: 'საწვავის სადგური', scale: 0.7, color: 46, shortRange: true });
    // amber ground ring so it's obvious where to stop
    mp.markers.new(27, new mp.Vector3(p[0], p[1], p[2] - 0.95), 1.8,
        { color: [255, 180, 46, 150], visible: true });
});

// Ammu-Nation gun shops — blips only (visual). The server (packages/shops) is the
// authority on where you can actually buy; keep these coords in sync with AMMU_LOCATIONS there.
const AMMU_SHOPS = [
    [22.09, -1107.28, 29.80], [810.25, -2157.60, 29.62], [1693.44, 3759.63, 34.70],
    [-330.24, 6083.88, 31.45], [252.63, -50.00, 69.94], [-662.10, -935.30, 21.83],
    [-1305.18, -393.55, 36.70], [-3172.55, 1085.79, 20.84], [2567.69, 294.38, 108.73],
    [-1117.58, 2698.61, 18.55], [842.44, -1033.42, 28.19]
];
AMMU_SHOPS.forEach(p => {
    mp.blips.new(110, new mp.Vector3(p[0], p[1], p[2]),
        { name: 'იარაღის მაღაზია', scale: 0.8, color: 1, shortRange: true });
    mp.markers.new(27, new mp.Vector3(p[0], p[1], p[2] - 0.95), 1.6,
        { color: [230, 120, 60, 140], visible: true });
});

// 24/7 mini-markets — blips only (visual). Server (packages/market) enforces where you can buy;
// keep coords in sync with STORE_LOCATIONS there.
const MARKET_STORES = [
    [25.70, -1347.30, 29.50], [-47.50, -1757.50, 29.42], [373.50, 325.60, 103.57],
    [1135.80, -982.30, 46.20], [-707.50, -914.30, 19.22], [-1223.00, -908.00, 12.33],
    [-1487.60, -379.10, 40.16], [1728.70, 6414.10, 35.04], [1698.40, 4924.40, 42.06],
    [1961.50, 3740.70, 32.34], [547.40, 2671.70, 42.16], [2678.50, 3280.70, 55.24],
    [-3038.70, 585.90, 7.91]
];
MARKET_STORES.forEach(p => {
    mp.blips.new(59, new mp.Vector3(p[0], p[1], p[2]),
        { name: '24/7 მაღაზია', scale: 0.7, color: 2, shortRange: true });
    mp.markers.new(27, new mp.Vector3(p[0], p[1], p[2] - 0.95), 1.6,
        { color: [90, 200, 130, 140], visible: true });
});

// On-foot interaction range for shops. Must be <= the server's SHOP_RANGE so anyone
// close enough to see the "Press E" prompt is also accepted by the server buy check.
const SHOP_INTERACT_RANGE = 3.5;
function nearestShopMode(pos) {
    for (const p of AMMU_SHOPS) {
        const dx = pos.x - p[0], dy = pos.y - p[1], dz = pos.z - p[2];
        if (dx * dx + dy * dy + dz * dz <= SHOP_INTERACT_RANGE * SHOP_INTERACT_RANGE) return 'weapons';
    }
    for (const p of MARKET_STORES) {
        const dx = pos.x - p[0], dy = pos.y - p[1], dz = pos.z - p[2];
        if (dx * dx + dy * dy + dz * dz <= SHOP_INTERACT_RANGE * SHOP_INTERACT_RANGE) return 'market';
    }
    return null;
}

function isNearPosition(position, target, range) {
    const dx = position.x - target.x;
    const dy = position.y - target.y;
    const dz = position.z - target.z;
    return dx * dx + dy * dy + dz * dz <= range * range;
}

// ---------- Persistent HUD browser (speedometer + money) ----------
const hudBrowser = mp.browsers.new('package://ui/hud/index.html');
let hudAccum = 0;

// ---------- Radio off + apply octane power on enter ----------
mp.events.add('playerEnterVehicle', (vehicle) => {
    if (!vehicle) return;
    mp.game.audio.setVehicleRadioEnabled(vehicle.handle, false);
    mp.game.audio.setRadioToStationName('OFF');
    applyOctanePower(vehicle);
});

// Blended octane profile currently in the tank (power/eff/rating).
function octaneProfile(veh) {
    return octaneByVeh[veh.remoteId] || DEFAULT_OCTANE;
}
// Higher octane in the tank = more engine power / top speed.
function applyOctanePower(veh) {
    if (!veh) return;
    const profile = octaneProfile(veh);
    veh.setEnginePowerMultiplier(profile.power);

    let baseMaxSpeed = baseMaxSpeedByVeh[veh.remoteId];
    if (baseMaxSpeed === undefined) {
        baseMaxSpeed = mp.game.vehicle.getEstimatedMaxSpeed(veh.handle);
        if (baseMaxSpeed > 0) baseMaxSpeedByVeh[veh.remoteId] = baseMaxSpeed;
    }
    if (baseMaxSpeed > 0)
        mp.game.vehicle.setMaxSpeed(veh.handle, baseMaxSpeed * profile.speedRate);
}

// ---------- State ----------
const fuelByVeh = {};
const octaneByVeh = {};
const baseMaxSpeedByVeh = {};
let lastEngineToggle = 0;
let fuelBrowser = null;
let fuelUIOpen = false;
let inventoryBrowser = null;
let vehicleMenuBrowser = null;
let vehicleMenuVehicle = null;
let pendingVehicleMenuVehicle = null;
let vehicleMenuOutside = false;
let chatting = false;     // native chat input is open (typing)
let suppressPauseUntil = 0;
let pendingDrain = false; // "empty tank first" chosen for the in-flight purchase

function getFuel(veh) {
    if (fuelByVeh[veh.remoteId] === undefined) fuelByVeh[veh.remoteId] = CFG.fuelMax;
    return fuelByVeh[veh.remoteId];
}
function addFuel(veh, delta) {
    fuelByVeh[veh.remoteId] = Math.max(0, Math.min(CFG.fuelMax, getFuel(veh) + delta));
    return fuelByVeh[veh.remoteId];
}
function getMoney() {
    const m = mp.players.local.getVariable('money');
    return (typeof m === 'number') ? m : 0;
}
function speedOf(veh) {
    const v = veh.getVelocity();
    return Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z);
}
function nearPump(pos) {
    for (const p of GAS_STATIONS) {
        const dx = pos.x - p[0], dy = pos.y - p[1], dz = pos.z - p[2];
        if (dx * dx + dy * dy + dz * dz <= CFG.refuelRange * CFG.refuelRange) return true;
    }
    return false;
}
function eligibleToRefuel(veh) {
    return veh && speedOf(veh) <= CFG.stopSpeed &&
           veh.getIsEngineRunning() !== true && nearPump(veh.position);
}

// ---------- CEF gas-station UI ----------
function currentFuelData(veh) {
    return {
        money: getMoney(),
        fuelPct: Math.round(getFuel(veh)),
        tankLiters: CFG.tankLiters,
        octanes: OCTANES.map(o => ({ name: o.name, price: o.price }))
    };
}
function sendFuelData() {
    const veh = mp.players.local.vehicle;
    if (fuelBrowser && veh)
        fuelBrowser.execute(`window.setFuelData(${JSON.stringify(currentFuelData(veh))})`);
}
function openFuelUI() {
    if (fuelUIOpen) return;
    fuelUIOpen = true;
    fuelBrowser = mp.browsers.new('package://ui/fuel/index.html');
    mp.gui.cursor.show(true, true);
}
function closeFuelUI() {
    if (!fuelUIOpen && !fuelBrowser) return;
    suppressPauseUntil = Date.now() + 1500;
    blockPauseControls();
    if (fuelBrowser) { fuelBrowser.destroy(); fuelBrowser = null; }
    fuelUIOpen = false;
    mp.gui.cursor.show(false, false);
}

function openInventoryUI() {
    if (inventoryBrowser || chatting || fuelUIOpen || adminBrowser) return;
    inventoryBrowser = mp.browsers.new('package://ui/inventory/index.html');
    mp.gui.cursor.show(true, true);
}

function closeInventoryUI() {
    if (!inventoryBrowser) return;
    suppressPauseUntil = Date.now() + 1500;
    blockPauseControls();
    inventoryBrowser.destroy();
    inventoryBrowser = null;
    mp.gui.cursor.show(false, false);
}

// ---------- CEF shop menu (Ammu-Nation / 24-7 market) ----------
let shopBrowser = null;
let shopMode = null; // 'weapons' | 'market'
function openShopUI(mode) {
    if (shopBrowser || chatting || adminBrowser || fuelUIOpen || vehicleMenuBrowser) return;
    shopMode = mode;
    if (!inventoryBrowser) openInventoryUI();                        // show inventory beside the shop
    shopBrowser = mp.browsers.new('package://ui/shop/index.html');   // created last -> renders on top
    mp.gui.cursor.show(true, true);
}
function closeShopUI() {
    if (!shopBrowser) return;
    suppressPauseUntil = Date.now() + 1500;
    blockPauseControls();
    shopBrowser.destroy();
    shopBrowser = null;
    shopMode = null;
    if (inventoryBrowser) closeInventoryUI();                        // close the paired inventory too
    mp.gui.cursor.show(false, false);
}
function requestShopData() {
    if (!shopBrowser || !shopMode) return;
    mp.events.callRemote(shopMode === 'weapons' ? 'shop:requestData' : 'market:requestData');
}
mp.events.add('shop:uiReady', requestShopData);                       // UI loaded -> pull catalog
mp.events.add('shop:setData', (json) => { if (shopBrowser) shopBrowser.execute(`window.setShopData(${json})`); });
mp.events.add('shop:purchase', (key, qty) => {                        // Buy clicked in the UI
    if (!shopMode) return;
    const amount = Math.max(1, Math.min(99, parseInt(qty) || 1));
    if (shopMode === 'weapons') mp.events.callRemote(String(key) === 'armor' ? 'shop:buyArmor' : 'shop:buyWeapon', String(key));
    else mp.events.callRemote('market:buy', String(key), amount);
    setTimeout(requestShopData, 200);                                // refresh balance after purchase
});
mp.events.add('shop:close', closeShopUI);

function sendVehicleMenuState() {
    const vehicle = vehicleMenuVehicle;
    if (!vehicleMenuBrowser || !vehicle) return;
    if (!mp.vehicles.exists(vehicle)) {
        closeVehicleMenu();
        return;
    }
    vehicleMenuBrowser.execute(`window.setVehicleMenuState(${JSON.stringify({
        engine: vehicle.getIsEngineRunning() === true,
        lights: vehicleLightsMode[vehicle.remoteId] || 0,
        belt: seatbeltOn,
        outside: vehicleMenuOutside
    })})`);
}

function vehicleMenuTargetInRange(vehicle, range = 5) {
    if (!vehicle || !mp.vehicles.exists(vehicle) ||
        Number(vehicle.dimension) !== Number(mp.players.local.dimension)) return false;
    const playerPosition = mp.players.local.position;
    const vehiclePosition = vehicle.position;
    const dx = playerPosition.x - vehiclePosition.x;
    const dy = playerPosition.y - vehiclePosition.y;
    const dz = playerPosition.z - vehiclePosition.z;
    return dx * dx + dy * dy + dz * dz <= range * range;
}

function aimedVehicle() {
    const cameraPosition = mp.game.cam.getGameplayCamCoord();
    const cameraRotation = mp.game.cam.getGameplayCamRot(2);
    const pitch = cameraRotation.x * Math.PI / 180;
    const yaw = cameraRotation.z * Math.PI / 180;
    const distance = 8;
    const directionX = -Math.sin(yaw) * Math.cos(pitch);
    const directionY = Math.cos(yaw) * Math.cos(pitch);
    const directionZ = Math.sin(pitch);
    const rayEnd = new mp.Vector3(
        cameraPosition.x + directionX * distance,
        cameraPosition.y + directionY * distance,
        cameraPosition.z + directionZ * distance
    );
    const hit = mp.raycasting.testPointToPoint(cameraPosition, rayEnd, mp.players.local, 3);
    const vehicle = hit && hit.entity && hit.entity.type === 'vehicle' ? hit.entity : null;
    return vehicle && vehicleMenuTargetInRange(vehicle) ? vehicle : null;
}

function openVehicleMenu(vehicle, outside = false) {
    if (vehicleMenuBrowser || chatting || adminBrowser || fuelUIOpen || inventoryBrowser) return;
    if (!vehicle) return;
    vehicleMenuVehicle = vehicle;
    vehicleMenuOutside = outside;
    vehicleMenuBrowser = mp.browsers.new('package://ui/vehicle/index.html');
    mp.gui.cursor.show(true, true);
}

function requestOutsideVehicleMenu() {
    if (pendingVehicleMenuVehicle || chatting || adminBrowser || fuelUIOpen || inventoryBrowser) return;
    const vehicle = aimedVehicle();
    if (!vehicle) return;
    pendingVehicleMenuVehicle = vehicle;
    mp.events.callRemote('vehicle:menu:request', Number(vehicle.remoteId));
}

function closeVehicleMenu() {
    pendingVehicleMenuVehicle = null;
    if (!vehicleMenuBrowser) return;
    suppressPauseUntil = Date.now() + 1500;
    blockPauseControls();
    vehicleMenuBrowser.destroy();
    vehicleMenuBrowser = null;
    vehicleMenuVehicle = null;
    vehicleMenuOutside = false;
    mp.gui.cursor.show(false, false);
}

function applyVehicleMenuAction(action, vehicle, outside) {
    if (action === 'engine') engineToggle(true, vehicle);
    else if (action === 'lights') toggleVehicleLights(true, vehicle);
    else if (action === 'belt' && !outside) toggleSeatbelt(true);
    else if (action === 'doors') closeVehicleDoors(true, vehicle);
}

mp.events.add('fuel:uiReady', () => sendFuelData());
mp.events.add('vehicle:menu:ready', sendVehicleMenuState);
mp.events.add('vehicle:menu:close', closeVehicleMenu);
mp.events.add('vehicle:menu:open', vehicleId => {
    const vehicle = pendingVehicleMenuVehicle;
    pendingVehicleMenuVehicle = null;
    if (!vehicle || Number(vehicle.remoteId) !== Number(vehicleId) ||
        mp.players.local.vehicle || !vehicleMenuTargetInRange(vehicle)) return;
    const currentTarget = aimedVehicle();
    if (!currentTarget || Number(currentTarget.remoteId) !== Number(vehicleId)) return;
    openVehicleMenu(vehicle, true);
});
mp.events.add('vehicle:menu:denied', () => {
    if (pendingVehicleMenuVehicle) {
        pendingVehicleMenuVehicle = null;
        notify('მანქანის მენიუ ხელმისაწვდომია მხოლოდ შენს ახლომდებარე ავტომობილზე.');
    } else if (vehicleMenuOutside) {
        closeVehicleMenu();
        notify('მანქანის მართვა ვერ შესრულდა.');
    }
});
mp.events.add('vehicle:menu:action', action => {
    if (!vehicleMenuBrowser || !vehicleMenuVehicle ||
        !['engine', 'lights', 'belt', 'doors'].includes(action)) return;
    if (vehicleMenuOutside) {
        if (action === 'belt') return;
        if (!vehicleMenuTargetInRange(vehicleMenuVehicle) || mp.players.local.vehicle) {
            closeVehicleMenu();
            return;
        }
        mp.events.callRemote('vehicle:menu:action', Number(vehicleMenuVehicle.remoteId), action);
        return;
    }
    const vehicle = mp.players.local.vehicle;
    if (!vehicle || Number(vehicle.remoteId) !== Number(vehicleMenuVehicle.remoteId)) {
        closeVehicleMenu();
        return;
    }
    applyVehicleMenuAction(action, vehicle, false);
    sendVehicleMenuState();
});
mp.events.add('vehicle:menu:apply', (vehicleId, action) => {
    if (!vehicleMenuBrowser || !vehicleMenuOutside || !vehicleMenuVehicle ||
        Number(vehicleMenuVehicle.remoteId) !== Number(vehicleId) ||
        !['engine', 'lights', 'doors'].includes(action) ||
        mp.players.local.vehicle || !vehicleMenuTargetInRange(vehicleMenuVehicle)) {
        return;
    }
    applyVehicleMenuAction(action, vehicleMenuVehicle, true);
    sendVehicleMenuState();
});
mp.events.add('fuel:purchase', (octane, liters, drain) => {
    pendingDrain = (drain === true || drain === 'true' || drain === 1 || drain === '1');
    mp.events.callRemote('fuel:buy', parseInt(octane), parseInt(liters));
});
mp.events.add('fuel:close', () => closeFuelUI());

mp.events.add('fuel:confirm', (octaneIndex, liters, cost) => {
    const veh = mp.players.local.vehicle;
    if (veh) {
        // if the player chose to dump first, empty the tank before filling (old fuel is lost)
        if (pendingDrain) { fuelByVeh[veh.remoteId] = 0; octaneByVeh[veh.remoteId] = null; }

        // blend the new grade into whatever is already in the tank (by volume)
        const grade = OCTANES[octaneIndex];
        const haveL = getFuel(veh) / CFG.fuelMax * CFG.tankLiters; // litres already in tank (0 if just drained)
        const addL = liters;
        const totalL = haveL + addL;
        const prof = octaneProfile(veh);
        octaneByVeh[veh.remoteId] = totalL > 0 ? {
            power:  (prof.power  * haveL + grade.power  * addL) / totalL,
            eff:    (prof.eff    * haveL + grade.eff    * addL) / totalL,
            speedRate: (prof.speedRate * haveL + grade.speedRate * addL) / totalL,
            rating: (prof.rating * haveL + grade.rating * addL) / totalL
        } : { power: grade.power, eff: grade.eff, speedRate: grade.speedRate, rating: grade.rating };

        addFuel(veh, liters / CFG.tankLiters * CFG.fuelMax);
        applyOctanePower(veh); // blended grade takes effect immediately
    }
    if (fuelUIOpen && fuelBrowser) {
        sendFuelData();
        fuelBrowser.execute(`window.fuelToast(${JSON.stringify('შეივსო ' + liters + 'ლ · $' + cost)}, true)`);
    } else {
        notify(`შეივსო ${liters}ლ · $${cost}`);
    }
    pendingDrain = false;
});
mp.events.add('fuel:deny', (msg) => {
    pendingDrain = false;
    if (fuelUIOpen && fuelBrowser) fuelBrowser.execute(`window.fuelToast(${JSON.stringify(msg)}, false)`);
    else notify('შევსება ვერ მოხერხდა: ' + msg);
});

// ---------- Engine toggle ("2") ----------
function engineToggle(fromVehicleMenu = false, targetVehicle = null) {
    if (chatting || adminBrowser || fuelUIOpen || inventoryBrowser || (vehicleMenuBrowser && !fromVehicleMenu)) return;
    const veh = targetVehicle || mp.players.local.vehicle;
    if (!veh) return;
    const now = Date.now();
    if (now - lastEngineToggle < CFG.engineCooldownMs) return;
    lastEngineToggle = now;

    if (veh.getIsEngineRunning() === true) {
        if (speedOf(veh) > CFG.stopSpeed) {
            notify('მოძრაობისას ძრავის გამორთვა არ შეიძლება. ჯერ გააჩერე.');
            return;
        }
        veh.setEngineOn(false, true, true);
        notify('ძრავი: გამორთული');
    } else {
        if (getFuel(veh) <= 0) { notify('საწვავი ამოიწურა — შეავსე საწვავის სადგურზე.'); return; }
        veh.setEngineOn(true, true, false);
        notify('ძრავი: ჩართული');
    }
    if (vehicleMenuBrowser) sendVehicleMenuState();
}

// ---------- Keybinds ----------
function blockPauseControls() {
    for (let group = 0; group <= 2; group += 1) {
        mp.game.controls.disableControlAction(group, 199, true); // FRONTEND_PAUSE
        mp.game.controls.disableControlAction(group, 200, true); // FRONTEND_PAUSE_ALTERNATE
        mp.game.controls.disableControlAction(group, 322, true); // ESC (pause/map)
    }
}

mp.keys.bind(0x45, false, () => { // E — refuel (in vehicle) or open shop (on foot near a store)
    if (chatting || adminBrowser || inventoryBrowser || vehicleMenuBrowser || shopBrowser) return;
    if (fuelUIOpen) return;
    if (eligibleToRefuel(mp.players.local.vehicle)) { openFuelUI(); return; }
    if (!mp.players.local.vehicle) {
        const mode = nearestShopMode(mp.players.local.position);
        if (mode) openShopUI(mode);
    }
});
mp.keys.bind(0x1B, true, () => { // Esc closes chat input or an open modal
    if (chatting) { closeChat(); return; }
    if (adminBrowser) closeAdminPanel(true);
    else if (fuelUIOpen) closeFuelUI();
    else if (shopBrowser) closeShopUI();               // closes shop + its paired inventory
    else if (inventoryBrowser) closeInventoryUI();
    else if (vehicleMenuBrowser) closeVehicleMenu();
});

// "Press E to shop" prompt when on foot at an Ammu-Nation / 24-7 marker.
mp.events.add('render', () => {
    if (shopBrowser || fuelUIOpen || chatting || adminBrowser || inventoryBrowser || vehicleMenuBrowser) return;
    if (mp.players.local.vehicle) return;
    const mode = nearestShopMode(mp.players.local.position);
    if (!mode) return;
    const label = mode === 'weapons' ? 'Ammu-Nation' : '24/7 Market';
    mp.game.graphics.drawText('Press E to shop  (' + label + ')', [0.5, 0.86], {
        font: 4, color: [255, 255, 255, 220], outline: true, centre: true, scale: [0.45, 0.45]
    });
});
mp.keys.bind(0x49, false, () => { // I - inventory
    if (chatting || vehicleMenuBrowser) return;
    if (inventoryBrowser) closeInventoryUI();
    else if (!adminBrowser && !fuelUIOpen) openInventoryUI();
});
mp.keys.bind(0x47, false, () => { // G - vehicle interaction menu
    if (chatting) return;
    if (vehicleMenuBrowser) closeVehicleMenu();
    else if (pendingVehicleMenuVehicle) closeVehicleMenu();
    else if (mp.players.local.vehicle) openVehicleMenu(mp.players.local.vehicle);
    else requestOutsideVehicleMenu();
});
mp.keys.bind(0x32, false, () => engineToggle());                    // 2 - engine on/off

// ---------- Custom chat (CEF) ----------
mp.gui.chat.show(false); // hide native chat (also removes the "Multiplayer started" line)
const chatBrowser = mp.browsers.new('package://ui/chat/index.html');
let chatReady = false;
const chatBuffer = [];
let chatChannel = 'local';
let hasTeam = false;

function chatChannels() { return hasTeam ? ['local', 'team', 'global'] : ['local', 'global']; }
function chatIn(payload) { // payload = JSON string (from server) or object (local notify)
    if (chatBrowser) chatBrowser.execute(`window.addMsg(${JSON.stringify(payload)})`);
}
function notify(text) {
    const obj = { ch: 'system', text: String(text), ts: Date.now() };
    if (!chatReady) chatBuffer.push(obj); else chatIn(obj);
}
mp.events.add('chat:in', (json) => {
    if (!chatReady) { chatBuffer.push(json); if (chatBuffer.length > 300) chatBuffer.shift(); return; }
    chatIn(json);
});
setTimeout(() => { chatReady = true; while (chatBuffer.length) chatIn(chatBuffer.shift()); }, 1500);

mp.events.add('chat:hasTeam', (value) => {
    hasTeam = value === true || value === 'true';
    if (!hasTeam && chatChannel === 'team') chatChannel = 'local';
});

function openChat() {
    if (chatting || adminBrowser || fuelUIOpen || inventoryBrowser || vehicleMenuBrowser) return;
    chatting = true;
    mp.gui.cursor.show(true, true);
    if (chatBrowser) chatBrowser.execute(
        `window.openInput(${JSON.stringify(JSON.stringify(chatChannels()))}, ${JSON.stringify(chatChannel)})`);
}
function closeChat() {
    chatting = false;
    mp.gui.cursor.show(false, false);
    if (chatBrowser) chatBrowser.execute('window.closeInput()');
    suppressPauseUntil = Date.now() + 800; // keep the pause/map from opening as Esc is released
    blockPauseControls();
}
mp.keys.bind(0x54, false, openChat); // T - open custom chat input

mp.events.add('chat:send', (text, channel) => {
    chatChannel = (channel === 'local' || channel === 'team' || channel === 'global') ? channel : 'local';
    text = String(text || '').trim();
    if (!text) return; // keep the input open; Esc closes it
    if (text[0] === '/') mp.events.callRemote('chat:command', text);
    else mp.events.callRemote('chat:submit', text, chatChannel);
});
mp.events.add('chat:cancel', () => closeChat());

// ---------- Voice chat: push-to-talk on B (held), blocked while comms-banned ----------
let voiceBanned = false;
let voiceTalking = false;
if (mp.voiceChat) mp.voiceChat.muted = true; // start muted; B unmutes while held

// admin comms-mute (voice side)
mp.events.add('voice:setMuted', (value) => {
    voiceBanned = (value === true || value === 'true');
    voiceTalking = false;
    if (mp.voiceChat) mp.voiceChat.muted = true; // stay muted; PTT can't unmute while banned
});

mp.keys.bind(0x42, true, () => {  // B held -> talk
    if (voiceBanned || chatting || adminBrowser || fuelUIOpen || inventoryBrowser || vehicleMenuBrowser) return;
    voiceTalking = true;
    if (mp.voiceChat) mp.voiceChat.muted = false;
});
mp.keys.bind(0x42, false, () => { // B released -> stop talking
    voiceTalking = false;
    if (mp.voiceChat) mp.voiceChat.muted = true;
});

// ---------- Vehicle keybinds: seatbelt (J), close doors (L), lights (H) ----------
let seatbeltOn = false;
const vehicleLightsMode = Object.create(null);

function toggleSeatbelt(fromVehicleMenu = false) {
    if (chatting || adminBrowser || fuelUIOpen || inventoryBrowser || (vehicleMenuBrowser && !fromVehicleMenu) || !mp.players.local.vehicle) return;
    seatbeltOn = !seatbeltOn;
    mp.players.local.setConfigFlag(32, !seatbeltOn); // 32 = can fly through windscreen; off while belted
    notify(seatbeltOn ? 'ღვედი: შეკრული' : 'ღვედი: შეხსნილი');
    if (vehicleMenuBrowser) sendVehicleMenuState();
}

mp.keys.bind(0x4A, false, toggleSeatbelt); // J - seatbelt

function closeVehicleDoors(fromVehicleMenu = false, targetVehicle = null) {
    const veh = targetVehicle || mp.players.local.vehicle;
    if (chatting || adminBrowser || fuelUIOpen || inventoryBrowser || (vehicleMenuBrowser && !fromVehicleMenu) || !veh) return;
    for (let i = 0; i < 6; i++) veh.setDoorShut(i, false);
    notify('კარები დაიკეტა');
}

function toggleVehicleLights(fromVehicleMenu = false, targetVehicle = null) {
    const veh = targetVehicle || mp.players.local.vehicle;
    if (chatting || adminBrowser || fuelUIOpen || inventoryBrowser || (vehicleMenuBrowser && !fromVehicleMenu) || !veh) return;
    const forceOn = vehicleLightsMode[veh.remoteId] !== 1;
    vehicleLightsMode[veh.remoteId] = forceOn ? 1 : -1;
    veh.setLights(forceOn ? 2 : 1);
    notify(forceOn ? 'შუქები: ჩართული' : 'შუქები: გამორთული');
    if (vehicleMenuBrowser) sendVehicleMenuState();
}

mp.keys.bind(0x4C, false, closeVehicleDoors); // L - close all doors
mp.keys.bind(0x48, false, toggleVehicleLights); // H - toggle lights

mp.events.add('playerLeaveVehicle', vehicle => { // reset per-car states on exit
    closeVehicleMenu();
    if (vehicle) {
        vehicle.setLights(0);
        delete vehicleLightsMode[vehicle.remoteId];
    }
    seatbeltOn = false;
    mp.players.local.setConfigFlag(32, true);
});

// ---------- Main loop ----------
let lastTime = Date.now();
// Native chat stays hidden — the custom CEF chat handles everything.
mp.events.add('playerReady', () => {
    mp.gui.chat.show(false);
});

mp.events.add('render', () => {
    if (vehicleMenuBrowser && vehicleMenuOutside &&
        (mp.players.local.vehicle || !vehicleMenuTargetInRange(vehicleMenuVehicle))) {
        closeVehicleMenu();
    }
    // Only real CEF panels count as modal. (Including cursor.visible here caused a
    // self-reinforcing loop that stuck the cursor and killed the native chat.)
    const modalOpen = Boolean(adminBrowser || fuelUIOpen || inventoryBrowser || vehicleMenuBrowser || shopBrowser);
    if (modalOpen) {
        // block game input + show cursor so the panel has focus (also blocks the pause menu)
        mp.game.controls.disableAllControlActions(0);
        mp.game.controls.disableAllControlActions(1);
        mp.game.controls.disableAllControlActions(2);
        mp.gui.cursor.show(true, true);
    } else if (chatting) {
        // typing in chat: block movement/attack + the pause menu, and detect Esc to close cleanly
        mp.game.controls.disableAllControlActions(0);
        blockPauseControls();
        if (mp.game.controls.isDisabledControlJustPressed(0, 200) ||
            mp.game.controls.isDisabledControlJustPressed(0, 322)) {
            closeChat();
        }
    } else if (mp.gui.cursor.visible) {
        mp.gui.cursor.show(false, false); // recover any stuck cursor so chat/controls work again
    }
    if (Date.now() < suppressPauseUntil) blockPauseControls();

    const now = Date.now();
    const dt = Math.min((now - lastTime) / 1000, 0.5);
    lastTime = now;

    const veh = mp.players.local.vehicle;
    let payload;

    if (!veh) {
        if (fuelUIOpen) closeFuelUI();
        payload = { money: getMoney(), inVehicle: false };
    } else {
        const speed = speedOf(veh);
        const rpm = (typeof veh.rpm === 'number') ? Math.max(0, veh.rpm) : 0;
        const gear = (typeof veh.gear === 'number') ? veh.gear : 0;
        let engineOn = veh.getIsEngineRunning() === true;
        let fuel = getFuel(veh);

        if (engineOn && fuel > 0) {
            const eff = octaneProfile(veh).eff;
            fuel = addFuel(veh, -(CFG.fuelIdleDrain + CFG.fuelDriveDrain * rpm) * eff * dt);
            if (fuel <= 0) { veh.setEngineOn(false, true, true); engineOn = false; }
        }

        const octane = Math.round(octaneProfile(veh).rating); // blended octane rating

        if (fuelUIOpen) {
            if (speed > CFG.stopSpeed || engineOn || !nearPump(veh.position)) {
                closeFuelUI();
            } else {
                mp.game.controls.disableAllControlActions(0); // also blocks ESC opening the pause menu
                // detect the (disabled) ESC / Backspace press and close the UI
                if (mp.game.controls.isDisabledControlJustPressed(0, 200) || // FRONTEND_PAUSE_ALTERNATE (Esc)
                    mp.game.controls.isDisabledControlJustPressed(0, 177)) { // FRONTEND_CANCEL (Backspace)
                    closeFuelUI();
                }
            }
        }

        // "press E to refuel" prompt is rendered in the HUD (native text can't show Georgian)
        const refuel = !fuelUIOpen && eligibleToRefuel(veh);
        payload = { money: getMoney(), inVehicle: true, kmh: Math.round(speed * 3.6), gear, engineOn, rpm, fuel, octane, refuel };
    }

    // voice state (shown regardless of vehicle)
    payload.voiceTalking = voiceTalking;
    payload.voiceBanned = voiceBanned;

    // push HUD at CFG.hudHz (not every frame)
    hudAccum += dt;
    if (hudBrowser && hudAccum >= 1 / CFG.hudHz) {
        hudAccum = 0;
        hudBrowser.execute(`window.hud(${JSON.stringify(payload)})`);
    }
});

let flyEnabled = false;
let adminModeEnabled = false;
let lastFlyUpdate = Date.now();

function setFlyEnabled(enabled) {
    flyEnabled = enabled === true;
    lastFlyUpdate = Date.now();
    const player = mp.players.local;
    player.setVisible(!flyEnabled, false);
    player.setAlpha(flyEnabled ? 0 : 255);
    player.setInvincible(flyEnabled || adminModeEnabled);
    player.freezePosition(flyEnabled);
    player.setCollision(!flyEnabled, !flyEnabled);
}

function setAdminModeEnabled(enabled) {
    adminModeEnabled = enabled === true;
    mp.players.local.setInvincible(flyEnabled || adminModeEnabled);
}

const flyingPlayerIds = new Set();

function setRemoteFlyVisibility(remoteId, enabled) {
    const id = Number(remoteId);
    if (!Number.isSafeInteger(id) || id < 0) return;
    if (enabled) flyingPlayerIds.add(id);
    else flyingPlayerIds.delete(id);

    const player = mp.players.atRemoteId(id);
    if (player && player !== mp.players.local) {
        player.setVisible(!enabled, false);
        player.setAlpha(enabled ? 0 : 255);
    }
}

mp.events.add('admin:fly:set', enabled => setFlyEnabled(enabled));
mp.events.add('admin:mode:set', enabled => setAdminModeEnabled(enabled));
mp.events.add('admin:fly:sync', (remoteId, enabled) => setRemoteFlyVisibility(remoteId, enabled));
mp.events.add('entityStreamIn', entity => {
    if (entity && entity.type === 'player' && flyingPlayerIds.has(Number(entity.remoteId))) {
        entity.setVisible(false, false);
        entity.setAlpha(0);
    }
});
mp.events.add('playerDeath', () => setFlyEnabled(false));

// (fly is toggled via the /fly command now — B is push-to-talk voice)

mp.keys.bind(0x77, false, () => {
    if (chatting) return;
    mp.events.callRemote('admin:panel:toggle');
});

mp.events.add('render', () => {
    if (adminBrowser) {
        mp.game.controls.disableAllControlActions(0);
        mp.game.controls.disableAllControlActions(1);
        mp.game.controls.disableAllControlActions(2);
        mp.gui.cursor.show(true, true);
        return;
    }
    if (fuelUIOpen || inventoryBrowser || vehicleMenuBrowser || !flyEnabled) return;

    const player = mp.players.local;
    if (player.health <= 0) {
        setFlyEnabled(false);
        return;
    }

    const now = Date.now();
    const dt = Math.min((now - lastFlyUpdate) / 1000, 0.05);
    lastFlyUpdate = now;

    const camera = mp.game.cam.getGameplayCamRot(2);
    const yaw = camera.z * Math.PI / 180;
    const pitch = camera.x * Math.PI / 180;
    let forward = 0;
    let strafe = 0;
    let vertical = 0;

    if (mp.game.controls.isControlPressed(0, 32)) forward += 1;
    if (mp.game.controls.isControlPressed(0, 33)) forward -= 1;
    if (mp.game.controls.isControlPressed(0, 35)) strafe += 1;
    if (mp.game.controls.isControlPressed(0, 34)) strafe -= 1;
    if (mp.game.controls.isControlPressed(0, 22)) vertical += 1;
    if (mp.game.controls.isControlPressed(0, 36)) vertical -= 1;

    const length = Math.hypot(forward, strafe, vertical);
    if (length === 0) return;

    const speed = mp.game.controls.isControlPressed(0, 21) ? 80 : 20;
    const forwardX = -Math.sin(yaw) * Math.cos(pitch);
    const forwardY = Math.cos(yaw) * Math.cos(pitch);
    const forwardZ = Math.sin(pitch);
    const rightX = Math.cos(yaw);
    const rightY = Math.sin(yaw);
    const scale = speed * dt / length;

    player.position = new mp.Vector3(
        player.position.x + (forwardX * forward + rightX * strafe) * scale,
        player.position.y + (forwardY * forward + rightY * strafe) * scale,
        player.position.z + (forwardZ * forward + vertical) * scale
    );
});

let adminBrowser = null;

function closeAdminPanel(notifyServer) {
    if (!adminBrowser) return;
    suppressPauseUntil = Date.now() + 1500;
    blockPauseControls();
    adminBrowser.destroy();
    adminBrowser = null;
    mp.gui.cursor.show(false, false);
    if (notifyServer) mp.events.callRemote('admin:panel:closed');
}

function requestAdminAction(action, id, duration, amount) {
    if (!adminBrowser) return;
    const playerId = Number(id);
    const durationSeconds = Number(duration);
    const moneyAmount = Number(amount);
    if (!Number.isSafeInteger(playerId) || playerId < 0) return;
    mp.events.callRemote('admin:panel:action', JSON.stringify({
        action: String(action),
        id: playerId,
        duration: Number.isSafeInteger(durationSeconds) ? durationSeconds : null,
        amount: Number.isSafeInteger(moneyAmount) ? moneyAmount : null
    }));
}

mp.events.add('admin:panel:open', () => {
    if (adminBrowser) return;
    if (vehicleMenuBrowser) closeVehicleMenu();
    if (inventoryBrowser) closeInventoryUI();
    if (fuelUIOpen) closeFuelUI();
    adminBrowser = mp.browsers.new('package://ui/admin/index.html');
    mp.gui.cursor.show(true, true);
});

mp.events.add('admin:panel:hide', () => closeAdminPanel(false));
mp.events.add('inventory:close', closeInventoryUI);
// Inventory data flow: UI ready -> pull items; server pushes -> render; use/drop -> server.
mp.events.add('inventory:uiReady', () => mp.events.callRemote('inventory:request'));
mp.events.add('inventory:data', (json) => { if (inventoryBrowser) inventoryBrowser.execute(`window.setInventory(${json})`); });
mp.events.add('inventory:use', (id) => mp.events.callRemote('inventory:use', String(id)));
mp.events.add('inventory:drop', (id) => mp.events.callRemote('inventory:drop', String(id)));

mp.events.add('admin:panel:data', json => {
    if (!adminBrowser) return;
    let players;
    try {
        players = JSON.parse(String(json));
    } catch (error) {
        notify('Admin panel: could not read player list.');
        return;
    }
    if (!Array.isArray(players)) {
        notify('Admin panel: invalid player list.');
        return;
    }
    adminBrowser.execute(`window.setPlayers(${JSON.stringify(players)})`);
});

mp.events.add('admin:panel:result', message => {
    if (adminBrowser) {
        adminBrowser.execute(`window.showNotice(${JSON.stringify(String(message))})`);
    } else {
        notify(String(message));
    }
});

mp.events.add('admin:panel:ready', () => {
    if (adminBrowser) mp.events.callRemote('admin:panel:refresh');
});
mp.events.add('admin:panel:refresh', () => {
    if (adminBrowser) mp.events.callRemote('admin:panel:refresh');
});
mp.events.add('admin:panel:close', () => closeAdminPanel(true));
mp.events.add('admin:panel:toggle', () => mp.events.callRemote('admin:panel:toggle'));
mp.events.add('admin:panel:mode', () => {
    if (adminBrowser) mp.events.callRemote('admin:panel:mode');
});
mp.events.add('admin:panel:action', requestAdminAction);
mp.events.add('admin:panel:fly', () => {
    if (adminBrowser) mp.events.callRemote('admin:panel:fly');
});
mp.events.add('admin:panel:unban', socialClub => {
    if (adminBrowser) mp.events.callRemote('admin:panel:unban', String(socialClub));
});
mp.events.add('admin:panel:announce', message => {
    if (adminBrowser) mp.events.callRemote('admin:panel:announce', String(message));
});
