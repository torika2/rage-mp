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

mp.blips.new(61, new mp.Vector3(1151.3, -1529.6, 35.0),
    { name: 'St Fiacre Hospital', scale: 0.9, color: 2, shortRange: false });

const HOSPITAL_EXTERIOR = new mp.Vector3(1151.3, -1529.6, 35.37);
mp.markers.new(1, HOSPITAL_EXTERIOR, 1.2, {
    color: [55, 190, 145, 180],
    visible: true
});

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
    veh.setEnginePowerMultiplier(octaneProfile(veh).power);
}

// ---------- State ----------
const fuelByVeh = {};
const octaneByVeh = {};
let lastEngineToggle = 0;
let fuelBrowser = null;
let fuelUIOpen = false;
let chatInputOpen = false;
let chatActivationSuppressed = false;
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
    suppressNativeChatForModal();
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
function closeChatInput() {
    if (!chatInputOpen && !mp.gui.chat.enabled) return false;
    chatInputOpen = false;
    mp.gui.chat.activate(false);
    suppressPauseUntil = Date.now() + 1500;
    blockPauseControls();
    setTimeout(() => {
        if (!adminBrowser && !fuelUIOpen && !mp.gui.cursor.visible && !chatInputOpen) {
            mp.gui.chat.activate(true);
        }
    }, 300);
    return true;
}

function blockPauseControls() {
    for (let group = 0; group <= 2; group += 1) {
        mp.game.controls.disableControlAction(group, 199, true);
        mp.game.controls.disableControlAction(group, 200, true);
    }
}

function suppressNativeChatForModal() {
    if (!chatActivationSuppressed || mp.gui.chat.enabled) {
        mp.gui.chat.activate(false);
    }
    chatActivationSuppressed = true;
}

mp.keys.bind(0x45, false, () => {
    const player = mp.players.local;
    if (isNearPosition(player.position, HOSPITAL_EXTERIOR, 3)) {
        mp.events.callRemote('hospital:enter');
        return;
    }
    if (!fuelUIOpen && eligibleToRefuel(mp.players.local.vehicle)) openFuelUI();
});
mp.keys.bind(0x0D, false, () => { chatInputOpen = false; });
mp.keys.bind(0x01, true, () => {
    if (!closeChatInput()) return;
    suppressPauseUntil = Date.now() + 300;
});
mp.keys.bind(0x1B, true, () => {
    const chatWasOpen = closeChatInput();
    const interactionOpen = Boolean(adminBrowser || fuelUIOpen || chatWasOpen || mp.gui.cursor.visible);
    if (!interactionOpen) return;

    suppressPauseUntil = Date.now() + 1000;
    blockPauseControls();
    if (adminBrowser) closeAdminPanel(true);
    else if (fuelUIOpen) closeFuelUI();
});
mp.keys.bind(0x32, false, engineToggle);                            // 2

// ---------- Main loop ----------
let lastTime = Date.now();
mp.events.add('playerReady', () => {
    if (adminBrowser || fuelUIOpen || mp.gui.cursor.visible) return;
    mp.gui.chat.show(true);
    mp.gui.chat.activate(true);
    chatActivationSuppressed = false;
});

mp.events.add('render', () => {
    const modalOpen = Boolean(adminBrowser || fuelUIOpen || mp.gui.cursor.visible);
    if (modalOpen) {
        mp.game.controls.disableAllControlActions(0);
        mp.game.controls.disableAllControlActions(1);
        mp.game.controls.disableAllControlActions(2);
        suppressNativeChatForModal();
        for (let group = 0; group <= 2; group += 1) {
            mp.game.controls.disableControlAction(group, 245, true);
        }
        mp.gui.cursor.show(true, true);
    } else if (chatActivationSuppressed) {
        mp.gui.chat.show(true);
        mp.gui.chat.activate(true);
        chatActivationSuppressed = false;
    }
    chatInputOpen = !modalOpen && mp.gui.chat.enabled;
    if (chatInputOpen || modalOpen || Date.now() < suppressPauseUntil) {
        blockPauseControls();
    }

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

mp.keys.bind(0x42, false, () => {
    if (adminBrowser) return;
    mp.events.callRemote('admin:fly:toggle');
});

mp.keys.bind(0x77, false, () => {
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
    if (!flyEnabled) return;

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

function requestAdminAction(action, id, duration) {
    if (!adminBrowser) return;
    const playerId = Number(id);
    const durationSeconds = Number(duration);
    if (!Number.isSafeInteger(playerId) || playerId < 0) return;
    mp.events.callRemote('admin:panel:action', JSON.stringify({
        action: String(action),
        id: playerId,
        duration: Number.isSafeInteger(durationSeconds) ? durationSeconds : null
    }));
}

mp.events.add('admin:panel:open', () => {
    if (adminBrowser) return;
    if (fuelUIOpen) closeFuelUI();
    adminBrowser = mp.browsers.new('package://ui/admin/index.html');
    suppressNativeChatForModal();
    mp.gui.cursor.show(true, true);
});

mp.events.add('admin:panel:hide', () => closeAdminPanel(false));

mp.events.add('admin:panel:data', json => {
    if (!adminBrowser) return;
    let players;
    try {
        players = JSON.parse(String(json));
    } catch (error) {
        mp.gui.chat.push('Admin panel: could not read player list.');
        return;
    }
    if (!Array.isArray(players)) {
        mp.gui.chat.push('Admin panel: invalid player list.');
        return;
    }
    adminBrowser.execute(`window.setPlayers(${JSON.stringify(players)})`);
});

mp.events.add('admin:panel:result', message => {
    if (adminBrowser) {
        adminBrowser.execute(`window.showNotice(${JSON.stringify(String(message))})`);
    } else {
        mp.gui.chat.push(String(message));
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
