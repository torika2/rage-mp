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
    { name: 'რეგულარი 87', price: 2.3, eff: 1.15, power: 1.00, rating: 87 },  // cheapest, stock power, shortest range
    { name: 'პლუსი 91',    price: 3.0, eff: 1.00, power: 1.08, rating: 91 },  // mid cost, +8% power
    { name: 'პრემიუმი 98', price: 4.2, eff: 0.85, power: 1.18, rating: 98 },  // +18% power, long range
    { name: 'სუპერი 100',  price: 5.5, eff: 0.75, power: 1.28, rating: 100 }  // top tier: +28% power, longest range
];
// A fresh full tank behaves like Plus 91.
const DEFAULT_OCTANE = { power: 1.08, eff: 1.00, rating: 91 };

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
    veh.setEnginePowerMultiplier(octaneProfile(veh).power);
}

// ---------- State ----------
const fuelByVeh = {};
const octaneByVeh = {};
let lastEngineToggle = 0;
let fuelBrowser = null;
let fuelUIOpen = false;
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
    if (fuelBrowser) { fuelBrowser.destroy(); fuelBrowser = null; }
    fuelUIOpen = false;
    mp.gui.cursor.show(false, false);
}

mp.events.add('fuel:uiReady', () => sendFuelData());
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
            rating: (prof.rating * haveL + grade.rating * addL) / totalL
        } : { power: grade.power, eff: grade.eff, rating: grade.rating };

        addFuel(veh, liters / CFG.tankLiters * CFG.fuelMax);
        applyOctanePower(veh); // blended grade takes effect immediately
    }
    if (fuelUIOpen && fuelBrowser) {
        sendFuelData();
        fuelBrowser.execute(`window.fuelToast(${JSON.stringify('შეივსო ' + liters + 'ლ · $' + cost)}, true)`);
    } else {
        mp.gui.chat.push(`შეივსო ${liters}ლ · $${cost}`);
    }
    pendingDrain = false;
});
mp.events.add('fuel:deny', (msg) => {
    pendingDrain = false;
    if (fuelUIOpen && fuelBrowser) fuelBrowser.execute(`window.fuelToast(${JSON.stringify(msg)}, false)`);
    else mp.gui.chat.push('შევსება ვერ მოხერხდა: ' + msg);
});

// ---------- Engine toggle ("2") ----------
function engineToggle() {
    if (fuelUIOpen) return;
    const veh = mp.players.local.vehicle;
    if (!veh) return;
    const now = Date.now();
    if (now - lastEngineToggle < CFG.engineCooldownMs) return;
    lastEngineToggle = now;

    if (veh.getIsEngineRunning() === true) {
        if (speedOf(veh) > CFG.stopSpeed) {
            mp.gui.chat.push('მოძრაობისას ძრავის გამორთვა არ შეიძლება. ჯერ გააჩერე.');
            return;
        }
        veh.setEngineOn(false, true, true);
        mp.gui.chat.push('ძრავი: გამორთული');
    } else {
        if (getFuel(veh) <= 0) { mp.gui.chat.push('საწვავი ამოიწურა — შეავსე საწვავის სადგურზე.'); return; }
        veh.setEngineOn(true, true, false);
        mp.gui.chat.push('ძრავი: ჩართული');
    }
}

// ---------- Keybinds ----------
mp.keys.bind(0x45, false, () => {
    if (!fuelUIOpen && eligibleToRefuel(mp.players.local.vehicle)) openFuelUI();
});
mp.keys.bind(0x1B, false, () => { if (fuelUIOpen) closeFuelUI(); }); // Esc
mp.keys.bind(0x32, false, engineToggle);                            // 2

// ---------- Main loop ----------
let lastTime = Date.now();
mp.events.add('render', () => {
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

    // push HUD at CFG.hudHz (not every frame)
    hudAccum += dt;
    if (hudBrowser && hudAccum >= 1 / CFG.hudHz) {
        hudAccum = 0;
        hudBrowser.execute(`window.hud(${JSON.stringify(payload)})`);
    }
});

