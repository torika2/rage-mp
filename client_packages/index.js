// =====================================================================
//  Freeroam client: radio-off, engine toggle, CEF speedometer HUD,
//  fuel system (octanes/prices) + CEF gas-station UI, money, pump markers
// =====================================================================

require('./interiors'); // Open All Interiors — client-side IPL loader

// While the onboarding gate (login/register/gender/creator/spawn) is open, suppress every custom
// keybind so in-game hotkeys (inventory, phone, engine, menus, chat…) can't fire behind the UI.
// Every keybind in this file is registered through bindKey() instead of mp.keys.bind directly,
// so this one flag gates them all. Defaults to locked so the window between connect and the
// server's 'auth:show' is already blocked.
let uiLocked = true;
const _realKeyBind = mp.keys.bind.bind(mp.keys);
function bindKey(key, keyUp, handler) {
    return _realKeyBind(key, keyUp, function (...args) {
        if (uiLocked) return;
        // While the phone is out, only the Down arrow (0x28, close phone) may fire — every other
        // in-game hotkey (chat/T, engine, menus…) is suppressed so nothing acts behind the phone UI.
        if (phoneOut && key !== 0x28) return;
        return handler(...args);
    });
}

// Hide/show the local player ped (visibility only; freeze is managed by the auth/creator handlers).
function setLocalPedVisible(visible) {
    const me = mp.players.local;
    if (!me) return;
    try { me.setAlpha(visible ? 255 : 0); } catch (e) {}
    try { me.setVisible(visible, false); } catch (e) {}
}
// On first spawn (before auth:show arrives) freeze + hide the ped so no character is shown and the
// player can't act until they authenticate.
mp.events.add('playerReady', () => {
    try { mp.players.local.freezePosition(true); } catch (e) {}
    setLocalPedVisible(false);
});

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

// GTA's in-world fonts (drawText, 3D labels) have no Georgian glyphs — Georgian shows as □□□.
// Anything drawn with the game font goes through worldText(): Georgian letters -> Latin
// (national transliteration). CEF pages (panels, chat) render Georgian fine and don't need this.
const GEO_LATIN = {
    'ა': 'a', 'ბ': 'b', 'გ': 'g', 'დ': 'd', 'ე': 'e', 'ვ': 'v', 'ზ': 'z', 'თ': 't', 'ი': 'i', 'კ': 'k',
    'ლ': 'l', 'მ': 'm', 'ნ': 'n', 'ო': 'o', 'პ': 'p', 'ჟ': 'zh', 'რ': 'r', 'ს': 's', 'ტ': 't', 'უ': 'u',
    'ფ': 'p', 'ქ': 'k', 'ღ': 'gh', 'ყ': 'q', 'შ': 'sh', 'ჩ': 'ch', 'ც': 'ts', 'ძ': 'dz', 'წ': 'ts', 'ჭ': 'ch',
    'ხ': 'kh', 'ჯ': 'j', 'ჰ': 'h'
};
function worldText(text) {
    return String(text == null ? '' : text).replace(/[\u10D0-\u10FF]/g, ch => GEO_LATIN[ch] || '').replace(/[—…]/g, ch => (ch === '—' ? '-' : '...'));
}

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
        { name: worldText('საწვავის სადგური'), scale: 0.7, color: 46, shortRange: true });
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
        { name: worldText('იარაღის მაღაზია'), scale: 0.8, color: 1, shortRange: true });
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
    mp.blips.new(52, new mp.Vector3(p[0], p[1], p[2]),
        { name: worldText('24/7 მაღაზია'), scale: 0.7, color: 2, shortRange: true });
    mp.markers.new(27, new mp.Vector3(p[0], p[1], p[2] - 0.95), 1.6,
        { color: [90, 200, 130, 140], visible: true });
});

// Clothing stores — blips only (visual). Server (packages/clothing) enforces where you can buy;
// keep coords in sync with STORE_LOCATIONS there.
const CLOTH_STORES = [
    [72.30, -1399.10, 29.38], [-703.80, -152.20, 37.42], [-165.00, -302.00, 39.73],
    [-1193.40, -772.30, 17.32], [-1447.80, -242.50, 49.82], [425.20, -806.50, 29.49],
    [123.60, -219.50, 54.56], [613.10, 2762.60, 42.09], [1696.50, 4829.30, 42.06],
    [-3172.50, 1048.10, 20.86], [11.60, 6514.20, 31.88]
];
CLOTH_STORES.forEach(p => {
    mp.blips.new(73, new mp.Vector3(p[0], p[1], p[2]),
        { name: worldText('ტანსაცმლის მაღაზია'), scale: 0.8, color: 47, shortRange: true });
    mp.markers.new(27, new mp.Vector3(p[0], p[1], p[2] - 0.95), 1.6,
        { color: [180, 120, 210, 140], visible: true });
});

// Barber shops (Herr Kutz, Bob Mulét, O'Sheas, ...) — blips only (visual). Server (packages/barber)
// enforces where you can get a haircut; keep coords in sync with SHOP_LOCATIONS there.
const BARBER_SHOPS = [
    [-814.31, -183.82, 37.57], [136.83, -1708.37, 29.29], [-1282.60, -1116.76, 6.99],
    [1931.51, 3729.67, 32.84], [1212.84, -472.92, 66.21], [-32.89, -152.32, 57.08],
    [-278.08, 6228.46, 31.70]
];
BARBER_SHOPS.forEach(p => {
    mp.blips.new(71, new mp.Vector3(p[0], p[1], p[2]),
        { name: worldText('სალონი (ვარცხნილობა)'), scale: 0.8, color: 4, shortRange: true });
    mp.markers.new(27, new mp.Vector3(p[0], p[1], p[2] - 0.95), 1.6,
        { color: [120, 200, 210, 140], visible: true });
});

// Tattoo salons — blips + markers (visual). Server (packages/tattoo) enforces where you can get inked;
// keep coords in sync with SHOP_LOCATIONS there.
const TATTOO_SHOPS = [
    [322.14, 180.47, 103.59], [-1153.68, -1425.68, 4.95], [1322.65, -1651.98, 51.28],
    [-3170.07, 1075.06, 20.83], [1864.63, 3747.74, 33.03], [-293.71, 6200.04, 31.49]
];
let tattooBrowser = null;
TATTOO_SHOPS.forEach(p => {
    mp.blips.new(75, new mp.Vector3(p[0], p[1], p[2]),
        { name: worldText('ტატუს სალონი'), scale: 0.8, color: 1, shortRange: true });
    mp.markers.new(27, new mp.Vector3(p[0], p[1], p[2] - 0.95), 1.6,
        { color: [210, 110, 100, 140], visible: true });
});

// ATMs — blips only (visual). Server (packages/bank) enforces the ATM range; keep coords in sync
// with ATM_LOCATIONS there.
const ATM_LOCATIONS = [
    [-56.82, -92.09, 57.78], [-2072.42, -317.50, 13.33], [-1414.52, -212.93, 46.52],
    [-1205.00, -324.90, 37.94], [-821.61, -1081.90, 11.13], [-537.91, -854.60, 29.24],
    [-357.42, -49.61, 49.04], [-284.90, 6224.28, 31.49], [-260.92, -14.30, 49.28],
    [-201.92, -860.70, 30.22], [24.24, -946.30, 29.36], [89.12, 2.50, 68.31],
    [112.53, -776.90, 31.42], [129.40, -1292.40, 29.28], [158.683, 234.183, 106.626],
    [155.00, 6642.30, 31.90], [240.80, 223.30, 106.35], [285.50, 143.50, 104.57],
    [288.90, -1282.50, 29.66], [295.90, -895.60, 29.22], [1077.70, -776.90, 58.22],
    [1167.00, 2708.90, 38.01], [1822.60, 3683.10, 34.28], [3011.80, 5940.00, 34.79]
];
ATM_LOCATIONS.forEach(p => {
    mp.blips.new(277, new mp.Vector3(p[0], p[1], p[2]),
        { name: worldText('ბანკომატი (ATM)'), scale: 0.6, color: 2, shortRange: true });
});

// ---------- Parking spots: car-sized footprint + E-to-open UI + admin editor ----------
// Server (packages/parking) pushes spots + live status. Blue = free, red = rented, yellow = editing.
let parkingSpots = [];
let parkingAdmin = false;         // am I a protected admin (may edit spot geometry)?
let parkingBrowser = null;        // the CEF rent/park UI
let currentParkSpotId = null;     // spot the UI is open for
let parkNearby = null;            // spot whose footprint I'm standing in (or null)
let parkEditing = null;           // working copy { id, x, y, z, h, rx, ry, w, l } while editing, else null
let parkEditConfirm = false;      // Escape during edit → show the save/discard confirm bar
let parkHudPrompt = null;         // spot id for the HUD "press E" prompt (Georgian, rendered in CEF)
let parkHudEdit = null;           // HTML edit-help string for the HUD (Georgian)
// Rotate local corner (u=width, v=length, 0) by pitch(rx), roll(ry), yaw(rz) — all degrees.
function parkRot(u, v, rx, ry, rz) {
    const dr = Math.PI / 180, cx = Math.cos(rx * dr), sx = Math.sin(rx * dr),
        cy = Math.cos(ry * dr), sy = Math.sin(ry * dr), cz = Math.cos(rz * dr), sz = Math.sin(rz * dr);
    let x = u, y = v, z = 0;
    let y1 = y * cx - z * sx, z1 = y * sx + z * cx;            // pitch about X
    let x2 = x * cy + z1 * sy, z2 = -x * sy + z1 * cy;         // roll about Y
    let x3 = x2 * cz - y1 * sz, y3 = x2 * sz + y1 * cz;        // yaw about Z
    return [x3, y3, z2];
}
const PARK_DRAW_DIST = 60;        // only draw/scan spots within this many metres (perf)
const PARK_DEF_W = 2.6, PARK_DEF_L = 5.2;
const halfW = (s) => (s.w || PARK_DEF_W) / 2;
const halfL = (s) => (s.l || PARK_DEF_L) / 2;

mp.events.add('parking:spots', (json) => { try { parkingSpots = JSON.parse(json) || []; } catch (e) { parkingSpots = []; } });
mp.events.add('parking:admin', (flag) => { parkingAdmin = !!flag; });

// Snap the slot to the real ground so it lies flat at foot level, whatever z was captured at placement.
function parkGroundZ(spot) {
    try {
        const gz = mp.game.gameplay.getGroundZFor3dCoord(spot.x, spot.y, spot.z + 1.0, false, false);
        if (typeof gz === 'number' && gz !== 0 && Math.abs(gz - spot.z) < 5) return gz;
    } catch (e) {}
    return spot.z;
}
// Is a world position inside this spot's rectangle (with a small entry margin)?
function pointInSpot(pos, spot, margin) {
    const hr = (spot.h || 0) * Math.PI / 180;
    const dx = pos.x - spot.x, dy = pos.y - spot.y;
    const u = dx * Math.cos(hr) + dy * Math.sin(hr);   // width axis
    const v = -dx * Math.sin(hr) + dy * Math.cos(hr);  // length axis
    return Math.abs(u) <= halfW(spot) + (margin || 0) && Math.abs(v) <= halfL(spot) + (margin || 0);
}
function drawParkQuad(spot, groundZ, color) {
    const hw = halfW(spot), hl = halfL(spot), baseZ = groundZ + 0.03;
    const rx = spot.rx || 0, ry = spot.ry || 0, rz = spot.h || 0;
    const corner = (u, v) => { const r = parkRot(u, v, rx, ry, rz); return [spot.x + r[0], spot.y + r[1], baseZ + r[2]]; };
    const A = corner(-hw, -hl), B = corner(hw, -hl), C = corner(hw, hl), D = corner(-hw, hl);
    const c = color || (spot.rented ? [220, 40, 40, 110] : [30, 130, 255, 100]);
    const tri = (p, q, r) => { try { mp.game.invoke('0xAC26716048436851', p[0], p[1], p[2], q[0], q[1], q[2], r[0], r[1], r[2], c[0], c[1], c[2], c[3]); } catch (e) {} };
    tri(A, B, C); tri(A, C, B); tri(A, C, D); tri(A, D, C); // both windings so it's visible from above
}
function drawParkLabel(spot, groundZ, text, color) {
    let screen = null;
    try { screen = mp.game.graphics.world3dToScreen2d(spot.x, spot.y, groundZ + 1.0); } catch (e) {}
    if (!screen) return;
    mp.game.graphics.drawText(String(text), [screen.x, screen.y], {
        font: 4, color: color || (spot.rented ? [255, 120, 120, 230] : [140, 200, 255, 235]),
        outline: true, centre: true, scale: [0.5, 0.5]
    });
}
mp.events.add('render', () => {
    const me = mp.players.local; if (!me) return;
    const pos = me.position;
    let nearest = null;
    for (const spot of parkingSpots) {
        const dx = spot.x - pos.x, dy = spot.y - pos.y;
        if (dx * dx + dy * dy > PARK_DRAW_DIST * PARK_DRAW_DIST) continue;
        const editingThis = parkEditing && parkEditing.id === spot.id;
        const drawSpot = editingThis ? parkEditing : spot;
        const groundZ = parkGroundZ(drawSpot);
        drawParkQuad(drawSpot, groundZ, editingThis ? [245, 205, 60, 130] : null);
        drawParkLabel(drawSpot, groundZ, spot.id, editingThis ? [255, 225, 120, 240] : null);
        if (!parkEditing && pointInSpot(pos, spot, 0.4)) nearest = spot;
    }
    parkNearby = nearest;

    // Georgian text can't render via native drawText, so the prompt + edit help go through the CEF HUD.
    if (parkEditing) {
        // Block movement is done by freezing the ped; also stop Esc from opening the pause menu.
        try { mp.game.controls.disableControlAction(0, 199, true); mp.game.controls.disableControlAction(0, 200, true); mp.game.controls.disableControlAction(0, 322, true); } catch (e) {}
        parkHudPrompt = null;
        if (parkEditConfirm) {
            parkHudEdit = '<b>' + parkEditing.id + '</b> — ცვლილების შენახვა? · <span class="dim">Enter = კი · Backspace = არა · Esc = გაგრძელება</span>';
        } else {
            parkHudEdit = 'რედაქტირება <b>' + parkEditing.id + '</b> · <span class="dim">ისრები: მოძრაობა · Q/E: Z · ,/.: X · [ ]: Y · −/+: სიგანე · PgUp/PgDn: სიგრძე · Home/End: 5 ასლი · Del: წაშლა · Esc: დასრულება</span> · W ' + parkEditing.w.toFixed(1) + ' L ' + parkEditing.l.toFixed(1) + ' · Z' + Math.round(parkEditing.h) + '° X' + Math.round(parkEditing.rx) + '° Y' + Math.round(parkEditing.ry) + '°';
        }
    } else if (parkNearby && !parkingBrowser && !chatting && !adminBrowser && !inventoryBrowser && !vehicleMenuBrowser && !shopBrowser && !clothingBrowser && !bankBrowser && !fuelUIOpen) {
        parkHudPrompt = parkNearby.id;
        parkHudEdit = null;
    } else {
        parkHudPrompt = null;
        parkHudEdit = null;
    }
});

// --- CEF parking UI ---
function openParkingUI() {
    if (parkingBrowser || !parkNearby) return;
    currentParkSpotId = parkNearby.id;
    parkingBrowser = mp.browsers.new('package://ui/parking/index.html');
    mp.gui.cursor.show(true, true);
}
function closeParkingUI() {
    if (!parkingBrowser) return;
    parkingBrowser.destroy(); parkingBrowser = null;
    mp.gui.cursor.show(false, false);
}
mp.events.add('parking:ui:ready', () => { if (currentParkSpotId) mp.events.callRemote('parking:uiData', currentParkSpotId); });
mp.events.add('parking:ui:data', (json) => { if (parkingBrowser) parkingBrowser.execute('window.setParkingData(' + json + ')'); });
mp.events.add('parking:ui:rent', (days, slots) => { if (currentParkSpotId) mp.events.callRemote('parking:rent', currentParkSpotId, Number(days), Number(slots)); });
mp.events.add('parking:ui:renew', (days) => { if (currentParkSpotId) mp.events.callRemote('parking:renew', currentParkSpotId, Number(days)); });
mp.events.add('parking:ui:park', () => { if (currentParkSpotId) mp.events.callRemote('parking:park', currentParkSpotId); });
mp.events.add('parking:ui:unpark', (index) => { if (currentParkSpotId) mp.events.callRemote('parking:unpark', currentParkSpotId, Number(index)); });
mp.events.add('parking:ui:summon', () => { if (currentParkSpotId) mp.events.callRemote('parking:summon', currentParkSpotId); });
mp.events.add('parking:ui:summonOwned', (vehicleId) => { if (currentParkSpotId) mp.events.callRemote('parking:summonOwned', currentParkSpotId, String(vehicleId)); });
mp.events.add('parking:ui:impound', () => { if (currentParkSpotId) mp.events.callRemote('parking:impound', currentParkSpotId); });
mp.events.add('parking:ui:delete', () => { if (currentParkSpotId) { mp.events.callRemote('parking:removeSpot', currentParkSpotId); closeParkingUI(); } });
mp.events.add('parking:ui:close', () => closeParkingUI());
mp.events.add('parking:ui:edit', () => {
    const s = parkingSpots.find(sp => sp.id === currentParkSpotId);
    closeParkingUI();
    if (s && parkingAdmin) enterParkEdit(s);
});
function enterParkEdit(s) {
    parkEditing = { id: s.id, x: s.x, y: s.y, z: s.z, h: s.h || 0, rx: s.rx || 0, ry: s.ry || 0, w: s.w || PARK_DEF_W, l: s.l || PARK_DEF_L };
    parkEditConfirm = false;
    try { mp.game.invoke('0x428CA6DBD1094446', mp.players.local.handle, true); } catch (e) {} // FREEZE_ENTITY_POSITION — no walking while editing
}
function exitParkEdit(saveIt) {
    if (!parkEditing) return;
    if (saveIt) mp.events.callRemote('parking:edit', JSON.stringify(parkEditing));
    parkEditing = null; parkEditConfirm = false;
    try { mp.game.invoke('0x428CA6DBD1094446', mp.players.local.handle, false); } catch (e) {} // unfreeze
}

// --- Admin editor keybinds. Nudges only apply while editing and not in the confirm dialog. ---
const MOVE_STEP = 0.15, ROT_STEP = 5, SIZE_STEP = 0.2;
function nudge(fn) { if (parkEditing && !parkEditConfirm) fn(); }
bindKey(0x25, true, () => nudge(() => parkEditing.x -= MOVE_STEP)); // Left  -X
bindKey(0x27, true, () => nudge(() => parkEditing.x += MOVE_STEP)); // Right +X
bindKey(0x26, false, () => nudge(() => parkEditing.y += MOVE_STEP)); // Up    +Y (keyup so it never opens the phone)
bindKey(0x28, false, () => nudge(() => parkEditing.y -= MOVE_STEP)); // Down  -Y
bindKey(0x51, true, () => nudge(() => parkEditing.h = (parkEditing.h - ROT_STEP + 360) % 360)); // Q  yaw (Z) -
bindKey(0x45, true, () => nudge(() => parkEditing.h = (parkEditing.h + ROT_STEP) % 360));       // E  yaw (Z) + (E-interact is disabled while editing)
bindKey(0xBC, true, () => nudge(() => parkEditing.rx = Math.max(-45, parkEditing.rx - ROT_STEP))); // ,  pitch (X) -
bindKey(0xBE, true, () => nudge(() => parkEditing.rx = Math.min(45, parkEditing.rx + ROT_STEP)));  // .  pitch (X) +
bindKey(0xDB, true, () => nudge(() => parkEditing.ry = Math.max(-45, parkEditing.ry - ROT_STEP))); // [  roll (Y) -
bindKey(0xDD, true, () => nudge(() => parkEditing.ry = Math.min(45, parkEditing.ry + ROT_STEP)));  // ]  roll (Y) +
bindKey(0xBB, true, () => nudge(() => parkEditing.w = Math.min(6, parkEditing.w + SIZE_STEP)));    // +  width
bindKey(0xBD, true, () => nudge(() => parkEditing.w = Math.max(1.6, parkEditing.w - SIZE_STEP)));  // -  width
bindKey(0x21, true, () => nudge(() => parkEditing.l = Math.min(12, parkEditing.l + SIZE_STEP)));   // PageUp   length
bindKey(0x22, true, () => nudge(() => parkEditing.l = Math.max(3, parkEditing.l - SIZE_STEP)));    // PageDown length
bindKey(0x0D, true, () => { if (parkEditing) exitParkEdit(true); });  // Enter — save (also confirms the dialog)
bindKey(0x08, true, () => { if (parkEditing) exitParkEdit(false); }); // Backspace — discard
// Home / End — duplicate this slot 5 times to the left / right (gapped). Uses the live edited geometry.
bindKey(0x24, true, () => nudge(() => mp.events.callRemote('parking:duplicate', JSON.stringify(parkEditing), 'left', 5)));  // Home
bindKey(0x23, true, () => nudge(() => mp.events.callRemote('parking:duplicate', JSON.stringify(parkEditing), 'right', 5))); // End
// Delete — remove this slot and exit edit mode.
bindKey(0x2E, true, () => nudge(() => { const id = parkEditing.id; exitParkEdit(false); mp.events.callRemote('parking:removeSpot', id); })); // Del

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
    for (const p of CLOTH_STORES) {
        const dx = pos.x - p[0], dy = pos.y - p[1], dz = pos.z - p[2];
        if (dx * dx + dy * dy + dz * dz <= SHOP_INTERACT_RANGE * SHOP_INTERACT_RANGE) return 'clothing';
    }
    for (const p of BARBER_SHOPS) {
        const dx = pos.x - p[0], dy = pos.y - p[1], dz = pos.z - p[2];
        if (dx * dx + dy * dy + dz * dz <= SHOP_INTERACT_RANGE * SHOP_INTERACT_RANGE) return 'barber';
    }
    for (const p of TATTOO_SHOPS) {
        const dx = pos.x - p[0], dy = pos.y - p[1], dz = pos.z - p[2];
        if (dx * dx + dy * dy + dz * dz <= SHOP_INTERACT_RANGE * SHOP_INTERACT_RANGE) return 'tattoo';
    }
    for (const p of ATM_LOCATIONS) {
        const dx = pos.x - p[0], dy = pos.y - p[1], dz = pos.z - p[2];
        if (dx * dx + dy * dy + dz * dz <= SHOP_INTERACT_RANGE * SHOP_INTERACT_RANGE) return 'atm';
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

// ---------- Radio fully off + apply octane power on enter ----------
// Radio is disabled server-wide: the player's radio wheel/control and the phone radio are turned off
// so it can never start, and any vehicle's station is forced to OFF.
function disableRadioGlobally() {
    try { mp.game.invoke('0x19F21E63AE6EAE4E', false); } catch (e) {} // SET_USER_RADIO_CONTROL_ENABLED(false) — no radio wheel
    try { mp.game.invoke('0x1098355A16064BB3', false); } catch (e) {} // SET_MOBILE_RADIO_ENABLED_DURING_GAMEPLAY(false)
    try { mp.game.invoke('0xF7F26C6E9CC9EBB8', false); } catch (e) {}  // SET_FRONTEND_RADIO_ACTIVE(false)
    try { mp.game.audio.setRadioToStationName('OFF'); } catch (e) {}
}
disableRadioGlobally();

function killRadio(vehicle) {
    disableRadioGlobally();
    if (!vehicle || !mp.vehicles.exists(vehicle)) return;
    try {
        mp.game.audio.setVehicleRadioEnabled(vehicle.handle, false);
        mp.game.audio.setRadioToStationName('OFF');
    } catch (e) {}
}
let radioKillTimer = null;
mp.events.add('playerEnterVehicle', (vehicle) => {
    if (!vehicle) return;
    applyOctanePower(vehicle);
    launchKickUntil = 0; launchArmed = true; // fresh launch kick available in the new car
    // GTA keeps re-enabling the radio for ~1–2s after entry — hammer it OFF for ~3s so it never plays.
    if (radioKillTimer) clearInterval(radioKillTimer);
    let ticks = 0;
    killRadio(vehicle);
    radioKillTimer = setInterval(() => {
        if (mp.players.local.vehicle !== vehicle || ++ticks > 12) { clearInterval(radioKillTimer); radioKillTimer = null; return; }
        killRadio(vehicle);
    }, 250);
});

// Blended octane profile currently in the tank (power/eff/rating). Seeds once from the server's synced
// var veh:octane (a persisted owned car restores the grade it was last filled with) before falling back
// to the default. Only seeds when never set locally, so an in-session drain (null) isn't overwritten.
function octaneProfile(veh) {
    if (octaneByVeh[veh.remoteId] === undefined) {
        let synced;
        try { synced = veh.getVariable('veh:octane'); } catch (e) {}
        if (synced && typeof synced === 'object') octaneByVeh[veh.remoteId] = synced;
    }
    return octaneByVeh[veh.remoteId] || DEFAULT_OCTANE;
}

// Per-model live tuning stage, pushed by the server (admin Cars tab), resolved to effect values.
// Keyed by model hash; the admin assigns a stage to plain model names (e.g. "23rs7abt"), hashed here.
//   power   — engine-power multiplier (acceleration) · topMult — top-speed multiplier (× stock top,
//   0 = untuned) · kick — launch burst off the line (1 = none).
const NO_TUNE = { power: 1, topMult: 0, kick: 1 };
let speedTuneByHash = {};
function modelTune(veh) {
    // Per-vehicle garage tuning (synced var veh:tune, set server-side by packages/cartuning) wins over
    // the admin per-model tuning — so one owner's upgraded car is fast without touching other same-model cars.
    try {
        const own = veh.getVariable('veh:tune');
        if (own && typeof own === 'object') {
            return { power: Number(own.power) || 1, topMult: Number(own.topMult) || 0, kick: Number(own.kick) || 1 };
        }
    } catch (e) {}
    return speedTuneByHash[(veh.model >>> 0)] || NO_TUNE;
}
mp.events.add('speed:mods', (json) => {
    const next = {};
    try {
        const map = JSON.parse(json) || {};
        for (const name in map) {
            const value = map[name] || {};
            next[mp.game.joaat(name) >>> 0] = {
                power: Number(value.power) || 1,
                topMult: Number(value.topMult) || 0,
                kick: Number(value.kick) || 1
            };
        }
    } catch (e) {}
    speedTuneByHash = next;
    // Re-apply to the car we're currently sitting in so edits take effect without re-entering.
    const veh = mp.players.local.vehicle;
    if (veh && mp.vehicles.exists(veh)) applyOctanePower(veh);
});

// Higher octane in the tank = more engine power / top speed. If the car has a max-speed cap, the
// game's speed limiter is set to the cap (a pure ceiling — the car drives normally and just can't
// exceed it); the render loop clamps any overshoot as a backstop.
function applyOctanePower(veh) {
    if (!veh) return;
    const profile = octaneProfile(veh);
    const tune = modelTune(veh);
    veh.setEnginePowerMultiplier(profile.power * (tune.power || 1));

    let baseMaxSpeed = baseMaxSpeedByVeh[veh.remoteId];
    if (baseMaxSpeed === undefined) {
        baseMaxSpeed = mp.game.vehicle.getEstimatedMaxSpeed(veh.handle);
        if (baseMaxSpeed > 0) baseMaxSpeedByVeh[veh.remoteId] = baseMaxSpeed;
    }
    if (baseMaxSpeed > 0) {
        const limiter = tune.topMult > 0 ? baseMaxSpeed * tune.topMult : baseMaxSpeed * profile.speedRate;
        mp.game.vehicle.setMaxSpeed(veh.handle, limiter);
    }
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
    if (fuelByVeh[veh.remoteId] === undefined) {
        // Seed from the server's persisted/synced value if there is one (e.g. a restored car).
        let synced;
        try { synced = veh.getVariable('veh:fuel'); } catch (e) {}
        fuelByVeh[veh.remoteId] = (typeof synced === 'number') ? synced : CFG.fuelMax;
    }
    return fuelByVeh[veh.remoteId];
}
let lastFuelReport = 0;
function reportFuelWhileDriving(veh, now) {
    if (now - lastFuelReport < 10000) return; // throttle to every 10s
    let driver = true;
    try { driver = veh.getPedInSeat(-1) === mp.players.local.handle; } catch (e) {}
    if (!driver) return;
    lastFuelReport = now;
    mp.events.callRemote('vehicle:fuelReport', Math.round(getFuel(veh)));
}

// ---- Odometer: accrue metres driven; the owner's car (synced 'veh:km') persists server-side ----
let odoVehId = null;      // remoteId of the vehicle currently being tracked
let odoBaseKm = 0;        // stored total km read from the car on entry (0 for cars that aren't yours)
let odoOwned = false;     // does this car carry a persistent odometer (= your car)?
let odoSessionM = 0;      // metres driven since entering this car
let odoReportedM = 0;     // metres already reported to the server
let odoLastReport = 0;
function odoTrack(veh, speed, dt, now) {
    const id = veh.remoteId;
    if (id !== odoVehId) {               // entered a different car → reset tracking
        odoFlush();
        odoVehId = id;
        const base = veh.getVariable('veh:km');
        odoOwned = typeof base === 'number';
        odoBaseKm = odoOwned ? base : 0;
        odoSessionM = 0; odoReportedM = 0; odoLastReport = now;
        try { veh.setModKit(0); } catch (e) {} // enable reading tuning mods
    }
    if (speed > 0.5) odoSessionM += speed * dt; // speed is m/s → metres
    if (odoOwned && now - odoLastReport > 10000) {
        odoLastReport = now;
        let driver = true;
        try { driver = veh.getPedInSeat(-1) === mp.players.local.handle; } catch (e) {}
        if (driver) {
            const delta = odoSessionM - odoReportedM;
            if (delta > 1) { mp.events.callRemote('vehicle:kmReport', Math.round(delta)); odoReportedM = odoSessionM; }
        }
    }
    return odoBaseKm + odoSessionM / 1000; // total km to display
}
function odoFlush() { // send the last unreported stretch (called on leaving a car)
    if (odoOwned && odoVehId !== null) {
        const delta = odoSessionM - odoReportedM;
        if (delta > 1) { try { mp.events.callRemote('vehicle:kmReport', Math.round(delta)); } catch (e) {} odoReportedM = odoSessionM; }
    }
    odoVehId = null;
}

// ---- Launch control ----
// Hold throttle + brake (or handbrake) while stopped to ARM, then release the brake to fire a short
// engine-power boost off the line. RAGE:MP can't touch the real clutch/RPM, so this is a power-burst
// launch assist. Returns 0 = off, 1 = armed/ready, 2 = launching (for the HUD).
const LC_BOOST = 1.7;        // engine power multiplier during launch
const LC_BOOST_MS = 3000;    // how long the boost lasts
const LC_ARM_MS = 500;       // hold throttle+brake this long to arm
let lcArmStart = 0, lcArmed = false, lcBoostUntil = 0, lcBoosting = false;

// ---- Auto launch kick (for cars tuned in the Cars tab) ----
// A short automatic burst of extra engine power when pulling away from a stop — a peppy launch off
// the line, then normal driving. The boost multiplier is per-car (tune.kick); re-arms once moving.
const LAUNCH_KICK_MS = 1000;     // how long the kick lasts
let launchKickUntil = 0, launchArmed = true;
// Peak acceleration (m/s²) of the tuned-speed model at a standstill, per unit of the car's power
// multiplier (tune.power). The pull tapers to zero at the tuned top speed, so a stronger car both
// launches harder AND reaches a higher top — felt across the whole range, like a real car.
// e.g. a Stage 3 + ×2.5 car (power ≈ 4.0) peaks around 3.2 × 4.0 ≈ 13 m/s² (~1.3 g) off the line.
const ACCEL_PEAK = 3.2;
function launchControl(veh, speed, now) {
    let driver = true;
    try { driver = veh.getPedInSeat(-1) === mp.players.local.handle; } catch (e) {}
    if (!driver) return 0;
    const accel = mp.game.controls.isControlPressed(0, 71);                                   // throttle
    const braking = mp.game.controls.isControlPressed(0, 72) || mp.game.controls.isControlPressed(0, 76); // brake or handbrake

    if (lcBoosting && now >= lcBoostUntil) { lcBoosting = false; applyOctanePower(veh); } // boost ended → restore power
    if (lcBoosting) return 2;

    if (speed < 2.0 && accel && braking) {                 // staging: revving against the brake
        if (!lcArmStart) lcArmStart = now;
        if (now - lcArmStart >= LC_ARM_MS) lcArmed = true;
        return lcArmed ? 1 : 0;
    }
    if (lcArmed && accel && !braking && speed < 6) {        // brake released while armed → launch!
        lcArmed = false; lcArmStart = 0;
        lcBoosting = true; lcBoostUntil = now + LC_BOOST_MS;
        try { veh.setEnginePowerMultiplier(octaneProfile(veh).power * LC_BOOST); } catch (e) {}
        return 2;
    }
    lcArmStart = 0; lcArmed = false;
    return 0;
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
    startPedPreview();
}

function closeInventoryUI() {
    if (!inventoryBrowser) return;
    stopPedPreview();
    suppressPauseUntil = Date.now() + 1500;
    blockPauseControls();
    inventoryBrowser.destroy();
    inventoryBrowser = null;
    mp.gui.cursor.show(false, false);
}

// ---- Live character preview inside the inventory paperdoll ----
// A script camera points at the player's real ped while the centre of the inventory
// UI is transparent, so the ped shows through and reflects whatever is worn — armour,
// clothing, everything the game already draws on the character. Nudge these four
// constants in-game if the framing is off (see docs/03-commands.md).
let pedCam = null;
let pedFrozen = false;
let pedAnchor = null; // { x, y, z, heading } captured when the preview opens (ped is frozen)
// Framing presets so you can actually see the part you are editing. dist = metres in front of the
// ped; aimZ/camZ = vertical offsets from the ped root (head ≈ +0.6, chest ≈ +0.4, feet ≈ -0.8).
const PED_CAM_ZONES = {
    full:  { dist: 3.2, aimZ: 0.10, camZ: 0.35, fov: 42 },
    head:  { dist: 1.4, aimZ: 0.62, camZ: 0.62, fov: 34 },
    upper: { dist: 2.2, aimZ: 0.38, camZ: 0.45, fov: 38 },
    lower: { dist: 2.0, aimZ: -0.35, camZ: -0.05, fov: 40 },
    shoes: { dist: 1.7, aimZ: -0.75, camZ: -0.40, fov: 40 }
};
// Side offset as a FRACTION of the camera distance, so the ped keeps the same screen position at
// every zoom (a fixed metre offset threw the ped off-screen when zoomed in on the head/feet).
const PED_CAM = { sideFactor: -0.25 }; // negative = ped sits in the left area, beside the panel
let pedRotation = 0; // extra heading applied by drag-to-rotate (0 = facing the camera)
function startPedPreview() {
    if (pedCam) return;
    const me = mp.players.local;
    if (!me) return;
    try {
        const pos = me.position;
        let heading = 0;
        try { heading = me.getHeading(); } catch (e) {}
        pedAnchor = { x: pos.x, y: pos.y, z: pos.z, heading };
        pedRotation = 0;
        pedCam = mp.cameras.new('default', new mp.Vector3(pos.x, pos.y, pos.z + 0.5), new mp.Vector3(0, 0, 0), PED_CAM_ZONES.full.fov);
        pedCam.setActive(true);
        mp.game.cam.renderScriptCams(true, false, 0, true, false);
        applyPedCamZone('full');
        if (!me.vehicle) { me.freezePosition(true); pedFrozen = true; }
    } catch (e) {
        stopPedPreview();
    }
}
// Re-aim the (frozen) ped camera at a body zone: 'full' | 'head' | 'upper' | 'lower' | 'shoes'.
function applyPedCamZone(zone) {
    const z = PED_CAM_ZONES[zone] || PED_CAM_ZONES.full;
    if (!pedCam || !pedAnchor) return;
    const rad = pedAnchor.heading * Math.PI / 180;
    const forwardX = -Math.sin(rad), forwardY = Math.cos(rad); // direction the ped faces
    const rightX = Math.cos(rad), rightY = Math.sin(rad);      // ped's right-hand side
    const side = z.dist * PED_CAM.sideFactor; // scales with zoom -> ped stays in the same screen spot
    try {
        pedCam.setCoord(pedAnchor.x + forwardX * z.dist, pedAnchor.y + forwardY * z.dist, pedAnchor.z + z.camZ);
        // Aim past the ped's shoulder so the ped renders in the left-hand window, beside the panel.
        pedCam.pointAtCoord(pedAnchor.x + rightX * side, pedAnchor.y + rightY * side, pedAnchor.z + z.aimZ);
        pedCam.setFov(z.fov);
    } catch (e) {}
}
// Spin the (frozen) ped in place; the camera stays put, so you can inspect the back of items.
function rotatePedPreview(deltaDegrees) {
    if (!pedAnchor) return;
    pedRotation = (pedRotation + deltaDegrees) % 360;
    try { mp.players.local.setHeading(pedAnchor.heading + pedRotation); } catch (e) {}
}
function stopPedPreview() {
    try { mp.game.cam.renderScriptCams(false, false, 0, true, false); } catch (e) {}
    if (pedCam) { try { pedCam.destroy(); } catch (e) {} pedCam = null; }
    if (pedAnchor) { try { mp.players.local.setHeading(pedAnchor.heading); } catch (e) {} } // undo drag-rotation
    if (pedFrozen) { try { mp.players.local.freezePosition(false); } catch (e) {} pedFrozen = false; }
    pedAnchor = null; pedRotation = 0;
}

function getCameraCoord() {
    if (mp.game && mp.game.cam) {
        if (typeof mp.game.cam.getGameplayCoord === 'function') {
            return mp.game.cam.getGameplayCoord();
        }
        if (typeof mp.game.cam.getGameplayCamCoord === 'function') {
            return mp.game.cam.getGameplayCamCoord();
        }
    }
    try {
        const cam = mp.cameras.new('gameplay');
        if (cam && typeof cam.getCoord === 'function') {
            return cam.getCoord();
        }
    } catch (e) {}
    return mp.players.local.position;
}

function getCameraRot() {
    if (mp.game && mp.game.cam) {
        if (typeof mp.game.cam.getGameplayCamRot === 'function') {
            return mp.game.cam.getGameplayCamRot(2);
        }
        if (typeof mp.game.cam.getGameplayRot === 'function') {
            return mp.game.cam.getGameplayRot(2);
        }
    }
    return new mp.Vector3(0, 0, mp.players.local.getHeading ? mp.players.local.getHeading() : 0);
}

function getVehiclePassengers(vehicle) {
    const list = [];
    if (!vehicle || !mp.vehicles.exists(vehicle)) return list;
    mp.players.forEachInStreamRange(p => {
        if (p.vehicle && Number(p.vehicle.remoteId) === Number(vehicle.remoteId)) {
            let role = 'მგზავრი';
            try {
                if (p.seat === -1 || (typeof vehicle.getPedInSeat === 'function' && vehicle.getPedInSeat(-1) === p.handle)) {
                    role = 'მძღოლი';
                }
            } catch (e) {}
            list.push({
                name: p.name || 'უცნობი',
                role: role
            });
        }
    });
    return list;
}

function toggleVehicleDoors(fromVehicleMenu = false, targetVehicle = null) {
    const veh = targetVehicle || mp.players.local.vehicle;
    if (!veh || !mp.vehicles.exists(veh)) return;
    let anyOpen = false;
    if (typeof veh.getDoorAngleRatio === 'function') {
        anyOpen = veh.getDoorAngleRatio(0) > 0.1 || veh.getDoorAngleRatio(1) > 0.1 ||
                  veh.getDoorAngleRatio(2) > 0.1 || veh.getDoorAngleRatio(3) > 0.1;
    }
    if (anyOpen) {
        for (let i = 0; i < 4; i++) veh.setDoorShut(i, false);
        notify('კარები დაიკეტა');
    } else {
        veh.setDoorOpen(0, false, false);
        veh.setDoorOpen(1, false, false);
        notify('კარები გაიღო');
    }
    if (vehicleMenuBrowser) sendVehicleMenuState();
}

function toggleVehicleTrunk(fromVehicleMenu = false, targetVehicle = null) {
    const veh = targetVehicle || mp.players.local.vehicle;
    if (!veh || !mp.vehicles.exists(veh)) return;
    const trunkOpen = (typeof veh.getDoorAngleRatio === 'function') && (veh.getDoorAngleRatio(5) > 0.1);
    if (trunkOpen) {
        veh.setDoorShut(5, false);
        notify('საბარგული დაიკეტა');
    } else {
        veh.setDoorOpen(5, false, false);
        notify('საბარგული გაიღო');
    }
    if (vehicleMenuBrowser) sendVehicleMenuState();
}

function toggleVehicleHood(fromVehicleMenu = false, targetVehicle = null) {
    const veh = targetVehicle || mp.players.local.vehicle;
    if (!veh || !mp.vehicles.exists(veh)) return;
    const hoodOpen = (typeof veh.getDoorAngleRatio === 'function') && (veh.getDoorAngleRatio(4) > 0.1);
    if (hoodOpen) {
        veh.setDoorShut(4, false);
        notify('კაპოტი დაიკეტა');
    } else {
        veh.setDoorOpen(4, false, false);
        notify('კაპოტი გაიღო');
    }
    if (vehicleMenuBrowser) sendVehicleMenuState();
}

function toggleVehicleLock(fromVehicleMenu = false, targetVehicle = null) {
    const veh = targetVehicle || mp.players.local.vehicle;
    if (!veh || !mp.vehicles.exists(veh)) return;
    const isLocked = (typeof veh.getDoorLockStatus === 'function') ? (veh.getDoorLockStatus() > 1) : false;
    const newStatus = isLocked ? 1 : 2;
    if (typeof veh.setDoorsLocked === 'function') {
        veh.setDoorsLocked(newStatus);
    }
    notify(isLocked ? 'მანქანა გაიღო' : 'მანქანა ჩაიკეტა');
    if (vehicleMenuBrowser) sendVehicleMenuState();
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
    if (shopMode === 'weapons') mp.events.callRemote(String(key) === 'armor' ? 'shop:buyArmor' : 'shop:buyWeapon', String(key), amount); // amount = ammo boxes
    else mp.events.callRemote('market:buy', String(key), amount);
    setTimeout(requestShopData, 200);                                // refresh balance after purchase
});
mp.events.add('shop:close', closeShopUI);

// ---------- Car shop (dealership) ----------
// Server opens it with 'carshop:open' (after /buycar near the dealership). The CEF pulls the
// catalog on load and relays buys; the server records ownership in the DB and spawns the car.
let carshopBrowser = null;
mp.events.add('carshop:open', () => {
    if (carshopBrowser || chatting) return;
    carshopBrowser = mp.browsers.new('package://ui/carshop/index.html');
    mp.gui.cursor.show(true, true);
});
function closeCarshop() {
    if (!carshopBrowser) return;
    carshopBrowser.destroy(); carshopBrowser = null;
    mp.gui.cursor.show(false, false);
}
mp.events.add('carshop:data', (json) => { if (carshopBrowser) carshopBrowser.execute(`window.setCarshop(${json})`); });
mp.events.add('carshop:result', (json) => { if (carshopBrowser) carshopBrowser.execute(`window.carshopResult(${json})`); });
mp.events.add('carshop:uiReady', () => mp.events.callRemote('carshop:requestData')); // from CEF -> server
mp.events.add('carshop:close', closeCarshop); // from CEF

// Buy-card popup shown when you "enter" a display car at the dealership.
let cardetailBrowser = null;
function closeCardetail() {
    if (!cardetailBrowser) return;
    cardetailBrowser.destroy(); cardetailBrowser = null;
    if (!carshopBrowser) mp.gui.cursor.show(false, false);
}
mp.events.add('carshop:details', (json) => {
    if (!cardetailBrowser) cardetailBrowser = mp.browsers.new('package://ui/cardetail/index.html');
    mp.gui.cursor.show(true, true);
    setTimeout(() => { if (cardetailBrowser) cardetailBrowser.execute(`window.setCarDetail(${json})`); }, 250);
});
mp.events.add('cardetail:close', closeCardetail); // from CEF
// Buy (from either the list or the buy-card) -> server; then close the buy-card.
mp.events.add('carshop:buy', (key) => { mp.events.callRemote('carshop:buy', String(key)); closeCardetail(); });
// Keep cursor up / block game controls while the dealership UI or buy-card is open.
mp.events.add('render', () => {
    if (!carshopBrowser && !cardetailBrowser) return;
    mp.gui.cursor.show(true, true);
    mp.game.controls.disableAllControlActions(0);
});

// ---------- Car tuning garage (per-car upgrades) ----------
// Server opens it with 'cartuning:open' (after /tune in your owned car at the garage). The CEF pulls
// its data on load and relays buys; the server charges money, saves levels on the car's DB row, and
// pushes the new effect via the synced var veh:tune (applied live below).
let cartuningBrowser = null;
mp.events.add('cartuning:open', () => {
    if (cartuningBrowser || chatting) return;
    cartuningBrowser = mp.browsers.new('package://ui/cartuning/index.html');
    mp.gui.cursor.show(true, true);
});
function closeCartuning() {
    if (!cartuningBrowser) return;
    cartuningBrowser.destroy(); cartuningBrowser = null;
    mp.gui.cursor.show(false, false);
}
mp.events.add('cartuning:data', (json) => {
    if (!cartuningBrowser) return;
    let data; try { data = JSON.parse(json); } catch (e) { return; }
    // Enrich with the option counts available for THIS car (only the client can enumerate mods).
    data.options = enumerateVehicleOptions(mp.players.local.vehicle);
    cartuningBrowser.execute(`window.setTuning(${JSON.stringify(data)})`);
});
mp.events.add('cartuning:result', (json) => {
    if (cartuningBrowser) cartuningBrowser.execute(`window.tuningResult(${json})`);
    // Re-apply power/top-speed live so the just-bought upgrade takes effect without re-entering the car.
    try {
        const r = JSON.parse(json);
        if (r && r.applied) { const veh = mp.players.local.vehicle; if (veh && mp.vehicles.exists(veh)) applyOctanePower(veh); }
    } catch (e) {}
});
mp.events.add('cartuning:denied', () => { closeCartuning(); notify('ტუნინგი ხელმისაწვდომია მხოლოდ შენს მანქანაში, ავტოსახელოსნოში.'); });
mp.events.add('cartuning:uiReady', () => mp.events.callRemote('cartuning:request')); // CEF -> server
mp.events.add('cartuning:buy', (partKey) => mp.events.callRemote('cartuning:buy', String(partKey))); // CEF -> server
mp.events.add('cartuning:buyVisual', (category, value) => mp.events.callRemote('cartuning:buyVisual', String(category), Number(value))); // CEF -> server
mp.events.add('cartuning:close', closeCartuning); // CEF
mp.events.add('render', () => {
    if (!cartuningBrowser) return;
    mp.gui.cursor.show(true, true);
    mp.game.controls.disableAllControlActions(0);
});

// "Press E to tune" prompt. The server sends the garage spots on join; while the driver of their own
// car sits on one, show the prompt (the E keybind opens it — wired into the shared E handler below).
let cartuningZones = [];
mp.events.add('cartuning:zones', (json) => { try { cartuningZones = JSON.parse(json) || []; } catch (e) { cartuningZones = []; } });
// Fetch the garage coords, retrying until they arrive (playerReady can fire before the server package
// is ready to answer, and a mid-session reconnect may miss the first request).
function requestTuningZones(attempt) {
    if (cartuningZones.length || attempt > 12) return;
    try { mp.events.callRemote('cartuning:zonesRequest'); } catch (e) {}
    setTimeout(() => requestTuningZones(attempt + 1), 3000);
}
mp.events.add('playerReady', () => requestTuningZones(0));
setTimeout(() => requestTuningZones(0), 2000);
function atTuningGarage() {
    const veh = mp.players.local.vehicle;
    if (!veh || !cartuningZones.length) return false;
    const p = veh.position;
    for (const g of cartuningZones) {
        const dx = p.x - g.x, dy = p.y - g.y, dz = p.z - g.z;
        if (dx * dx + dy * dy + dz * dz <= 49) return true; // ~7m (server is 6; a touch wider so the prompt shows just before)
    }
    return false;
}
// Prompt for any DRIVER parked at a garage — the server does the authoritative ownership / DB-car
// check when E is pressed (and replies with a clear message if it's not their own car).
function canTuneHere() {
    const veh = mp.players.local.vehicle;
    if (!veh || !atTuningGarage()) return false;
    let driver = true;
    try { driver = veh.getPedInSeat(-1) === mp.players.local.handle; } catch (e) {}
    return driver;
}
mp.events.add('render', () => {
    if (cartuningBrowser || chatting || adminBrowser || inventoryBrowser || vehicleMenuBrowser || fuelUIOpen) return;
    if (!canTuneHere()) return;
    mp.game.graphics.drawText('Press E to tune', [0.5, 0.86], {
        font: 4, color: [255, 255, 255, 220], outline: true, centre: true, scale: [0.45, 0.45]
    });
});

// /vehmods diagnostic: dump mod variations (type: current/count) + extras of the car you're in, so we
// can identify which mod index / extra controls a model's "two versions" (e.g. M8 spoiler vs ducktail).
const VEH_MOD_NAMES = { 0: 'Spoiler', 1: 'FrontBumper', 2: 'RearBumper', 3: 'Skirts', 4: 'Exhaust', 5: 'Chassis', 6: 'Grille', 7: 'Hood', 8: 'FenderL', 9: 'FenderR', 10: 'Roof', 23: 'Wheels', 24: 'RearWheels' };
mp.events.add('vehmods:dump', () => {
    const v = mp.players.local.vehicle;
    if (!v) { notify('ჩაჯექი მანქანაში.'); return; }
    const h = v.handle;
    try { mp.game.vehicle.setVehicleModKit(h, 0); } catch (e) {}
    notify('--- ' + '/vehmods' + ' (type: current / count) ---');
    for (let t = 0; t <= 49; t++) {
        let count = 0;
        try { count = mp.game.vehicle.getNumVehicleMods(h, t); } catch (e) {}
        if (count > 0) {
            let cur = -1;
            try { cur = mp.game.vehicle.getVehicleMod(h, t); } catch (e) {}
            notify((VEH_MOD_NAMES[t] || ('mod' + t)) + ':  ' + cur + ' / ' + count);
        }
    }
    const extras = [];
    for (let e = 0; e <= 20; e++) {
        try { if (mp.game.vehicle.doesExtraExist(h, e)) extras.push(e + '=' + (mp.game.vehicle.isVehicleExtraTurnedOn(h, e) ? 'ON' : 'off')); } catch (err) {}
    }
    notify('extras:  ' + (extras.join(', ') || 'none'));
});

// ===================== Vehicle visual customization (LS Customs) =====================
// Applies a stored veh:visual config (colors / wheels / body mods) to a vehicle via natives, for ALL
// players, so a customized car looks the same to everyone. Driven by the synced var (stream-in) and a
// server broadcast (live change). The garage UI reads option counts via enumerateVehicleOptions().
const VISUAL_MOD_TYPES = [0, 1, 2, 3, 4, 7, 10, 23]; // spoiler, bumpers, skirts, exhaust, hood, roof, wheels
function applyVehicleVisual(veh, cfg) {
    if (!veh || !mp.vehicles.exists(veh) || !cfg || typeof cfg !== 'object') return;
    const h = veh.handle;
    try { mp.game.vehicle.setVehicleModKit(h, 0); } catch (e) {}
    const c = cfg.colors || {};
    if (typeof c.primary === 'number' && typeof c.secondary === 'number') {
        try { mp.game.vehicle.setVehicleColours(h, c.primary, c.secondary); } catch (e) {}
    }
    if (typeof c.pearl === 'number' || typeof c.wheel === 'number') {
        try { mp.game.vehicle.setVehicleExtraColours(h, c.pearl || 0, c.wheel || 0); } catch (e) {}
    }
    if (typeof cfg.windowTint === 'number') try { mp.game.vehicle.setVehicleWindowTint(h, cfg.windowTint); } catch (e) {}
    if (typeof cfg.wheelType === 'number') try { mp.game.vehicle.setVehicleWheelType(h, cfg.wheelType); } catch (e) {}
    if (cfg.mods && typeof cfg.mods === 'object') {
        for (const type in cfg.mods) {
            const idx = Number(cfg.mods[type]);
            try { mp.game.vehicle.setVehicleMod(h, parseInt(type, 10), idx, false); } catch (e) {}
        }
    }
    // Toggleable body parts (some add-ons use an "extra" for a ducktail/wing instead of a mod).
    // SET_VEHICLE_EXTRA(veh, id, toggle): toggle=false turns the extra ON, true turns it OFF.
    if (cfg.extras && typeof cfg.extras === 'object') {
        for (const id in cfg.extras) {
            try { mp.game.vehicle.setVehicleExtra(h, parseInt(id, 10), cfg.extras[id] ? false : true); } catch (e) {}
        }
    }
}
// How many options each mod type offers for this specific car (indices 0..count-1, plus -1 = stock).
function enumerateVehicleOptions(veh) {
    const opts = { mods: {}, wheelTypes: 13, windowTints: 7 };
    if (!veh || !mp.vehicles.exists(veh)) return opts;
    const h = veh.handle;
    try { mp.game.vehicle.setVehicleModKit(h, 0); } catch (e) {}
    VISUAL_MOD_TYPES.forEach((t) => {
        let count = 0;
        try { count = mp.game.vehicle.getNumVehicleMods(h, t); } catch (e) {}
        opts.mods[t] = count;
    });
    return opts;
}
// Apply a car's saved look when it streams in (covers other players' cars + late joiners).
mp.events.add('entityStreamIn', (entity) => {
    if (!entity || entity.type !== 'vehicle') return;
    const applySyncedVisual = () => {
        if (!mp.vehicles.exists(entity)) return;
        let cfg; try { cfg = entity.getVariable('veh:visual'); } catch (e) {}
        if (cfg) applyVehicleVisual(entity, cfg);
    };
    applySyncedVisual();
    setTimeout(applySyncedVisual, 500);
    setTimeout(applySyncedVisual, 1500);
});
// Live change broadcast from the server (e.g. just bought at the garage) — re-apply for everyone nearby.
mp.events.add('vehicle:visualApply', (vehId, json) => {
    const veh = mp.vehicles.atRemoteId(Number(vehId));
    if (!veh || !mp.vehicles.exists(veh)) return;
    let cfg; try { cfg = JSON.parse(json); } catch (e) { return; }
    applyVehicleVisual(veh, cfg);
});

// ---------- CEF clothing store (Binco / Ponsonbys) ----------
// Browsing + live try-on happen on the client (only the client can read the ped's real drawable
// counts and preview them). Money, pricing and persistence are server-authoritative. Previews are
// local-only, so other players never see un-bought clothes; on close we revert to the synced look.
let clothingBrowser = null;
let clothingCats = null;   // { key: { key, kind, id, label, base, step } } from the server
let clothingOrder = [];    // category keys in display order
let clothingTaxRate = 0;
let clothingMoney = 0;
let clothingPreview = {};   // { key: { drawable, texture } } — current on-ped selection
let clothingOriginal = {};  // { key: { drawable, texture } } — synced look when the UI opened
let clothingWorn = {};      // { key: { id, label } } — pieces the player currently wears (from inventory)
let clothingNude = {};      // { key: drawable } — the bare/none value per category (-1 for props)
let clothingTopArms = { def: 0, nude: 15, map: {} }; // arms (comp 3) matching for tops, from the server
let clothingSelected = null;
let clothingCart = [];      // [{ cat, d, t, label, price }] — items queued for checkout
let clothingReturn = null;  // where to teleport the player back to on close
let clothingValid = {};     // { key: [drawable, ...] } — drawables that exist and render for this ped
let clothingTexCache = {};  // { 'key:drawable': [texture, ...] } — valid textures per drawable
let clothingNewInfo = null; // { now, newDays, ranges:{key:[{from,to,pack,at}]} } — recently uploaded drawables
let clothingGender = 'm';   // 'm' | 'f' — picks the GTA Online name table in the shop page
// A clean, prop-free spot to stand in while dressing, so store objects never hide the character.
const DRESSING_SPOT = { x: -1447.805, y: -242.122, z: 49.80, heading: -15.6 };
// Which body zone to frame the camera on for each category, so the change is clearly visible.
const CLOTH_ZONE = {
    hat: 'head', glasses: 'head', mask: 'head', ears: 'head',
    top: 'upper', undershirt: 'upper', torso: 'upper', neck: 'upper', decal: 'upper', watch: 'upper', bracelet: 'upper', bag: 'upper',
    pants: 'lower', shoes: 'shoes'
};

function openClothingUI() {
    if (clothingBrowser || barberBrowser || tattooBrowser || cityhallBrowser || housesBrowser || chatting || adminBrowser || fuelUIOpen || vehicleMenuBrowser || inventoryBrowser || shopBrowser) return;
    const me = mp.players.local;
    let heading = 0; try { heading = me.getHeading(); } catch (e) {}
    clothingReturn = { x: me.position.x, y: me.position.y, z: me.position.z, heading };
    try { me.position = new mp.Vector3(DRESSING_SPOT.x, DRESSING_SPOT.y, DRESSING_SPOT.z); } catch (e) {}
    try { me.setHeading(DRESSING_SPOT.heading); } catch (e) {}
    clothingCart = [];
    startPedPreview(); // anchors the camera at the dressing spot
    clothingBrowser = mp.browsers.new('package://ui/clothing/index.html');
    mp.gui.cursor.show(true, true);
}
function closeClothingUI() {
    if (!clothingBrowser) return;
    revertClothingPreview();
    suppressPauseUntil = Date.now() + 1500;
    blockPauseControls();
    clothingBrowser.destroy();
    clothingBrowser = null;
    stopPedPreview();
    if (clothingReturn) { // teleport back to where the player pressed E
        const me = mp.players.local;
        try { me.position = new mp.Vector3(clothingReturn.x, clothingReturn.y, clothingReturn.z); } catch (e) {}
        try { me.setHeading(clothingReturn.heading); } catch (e) {}
        clothingReturn = null;
    }
    clothingCats = null; clothingSelected = null; clothingCart = [];
    mp.events.callRemote('clothing:leave'); // restore dimension 0 (leave the private shop instance)
    mp.gui.cursor.show(false, false);
}

// ---- Native helpers for the local ped's clothing variations ----
function drawableCount(cat) {
    const me = mp.players.local;
    try {
        return cat.kind === 'comp'
            ? Math.max(1, me.getNumberOfDrawableVariations(cat.id))
            : Math.max(0, me.getNumberOfPropDrawableVariations(cat.id));
    } catch (e) { return 1; }
}
function textureCount(cat, drawable) {
    const me = mp.players.local;
    if (drawable < 0) return 1;
    try {
        return cat.kind === 'comp'
            ? Math.max(1, me.getNumberOfTextureVariations(cat.id, drawable))
            : Math.max(1, me.getNumberOfPropTextureVariations(cat.id, drawable));
    } catch (e) { return 1; }
}
// IS_PED_COMPONENT_VARIATION_VALID: skips empty/placeholder slots so nothing renders invisible or
// with a missing (checkerboard) texture. Props have no such native; every counted texture is used.
function componentValid(compId, drawable, texture) {
    const me = mp.players.local;
    try {
        if (typeof me.isComponentVariationValid === 'function') return !!me.isComponentVariationValid(compId, drawable, texture);
        return !!mp.game.invoke('0xE825F6B6CEA7671D', me.handle, compId, drawable, texture);
    } catch (e) { return true; }
}
function validTextures(cat, drawable) {
    if (drawable < 0) return [0];
    const cacheKey = cat.key + ':' + drawable;
    if (clothingTexCache[cacheKey]) return clothingTexCache[cacheKey];
    const count = textureCount(cat, drawable);
    let list = [];
    for (let t = 0; t < count; t++) if (cat.kind !== 'comp' || componentValid(cat.id, drawable, t)) list.push(t);
    if (!list.length) list = [0];
    clothingTexCache[cacheKey] = list;
    return list;
}
// Every drawable the game has for this category (all GTA Online/DLC items installed), minus invalid ones.
function buildValidDrawables(cat, current) {
    const count = drawableCount(cat);
    const none = cat.kind === 'prop' ? [-1] : [];
    let list = none.slice();
    for (let d = 0; d < count; d++) if (cat.kind !== 'comp' || componentValid(cat.id, d, 0)) list.push(d);
    // Validity native missing/misbehaving -> don't lock the shop; offer every counted drawable.
    if (list.length === none.length) { list = none.slice(); for (let d = 0; d < count; d++) list.push(d); }
    if (list.indexOf(current) < 0) { list.push(current); list.sort((a, b) => a - b); }
    return list;
}
// Arms (comp 3) for a top: bare arms for the "none" top, else GTA's matching torso from the server
// table (per texture when it differs), else the default. Mirrors packages/inventory armsForTop().
function topArmsFor(drawable, texture) {
    if (drawable === clothingNude.top) return [clothingTopArms.nude != null ? clothingTopArms.nude : 15, 0];
    const entry = clothingTopArms.map ? clothingTopArms.map[drawable] : null;
    if (Array.isArray(entry)) {
        if (typeof entry[0] === 'number') return entry;
        const byTexture = entry[texture] || entry.find(item => Array.isArray(item));
        if (byTexture) return byTexture;
    }
    return [clothingTopArms.def != null ? clothingTopArms.def : 0, 0];
}
function readCurrent(cat) {
    const me = mp.players.local;
    try {
        if (cat.kind === 'comp') return { drawable: me.getDrawableVariation(cat.id), texture: me.getTextureVariation(cat.id) };
        return { drawable: me.getPropIndex(cat.id), texture: me.getPropTextureIndex(cat.id) };
    } catch (e) { return { drawable: cat.kind === 'comp' ? 0 : -1, texture: 0 }; }
}
function applyPreview(cat, sel) {
    const me = mp.players.local;
    try {
        if (cat.kind === 'comp') {
            me.setComponentVariation(cat.id, Math.max(0, sel.drawable), Math.max(0, sel.texture), 0);
            if (cat.key === 'top') { // match the arms (comp 3) so sleeves don't clip while previewing
                const arms = topArmsFor(sel.drawable, sel.texture);
                me.setComponentVariation(3, Math.max(0, arms[0]), Math.max(0, arms[1]), 0);
            }
        } else if (sel.drawable < 0) me.clearProp(cat.id);
        else me.setPropIndex(cat.id, sel.drawable, Math.max(0, sel.texture), true);
    } catch (e) {}
}
function revertClothingPreview() {
    if (!clothingCats) return;
    clothingOrder.forEach(key => applyPreview(clothingCats[key], clothingOriginal[key] || readCurrent(clothingCats[key])));
}

// Price mirrors packages/clothing priced(): base+drawable*step, then + government tax.
function catPrice(cat, drawable) {
    if (drawable < 0) return { base: 0, tax: 0, total: 0 };
    const base = Math.round(cat.base + Math.max(0, drawable) * cat.step);
    const tax = Math.round(base * Math.max(0, clothingTaxRate));
    return { base, tax, total: base + tax };
}
// The newest recently-uploaded range containing this drawable, or null.
function newRangeOf(key, drawable) {
    if (!clothingNewInfo || drawable < 0) return null;
    const cutoff = clothingNewInfo.now - clothingNewInfo.newDays * 86400000;
    const ranges = clothingNewInfo.ranges[key] || [];
    for (let i = 0; i < ranges.length; i++) {
        if (ranges[i].at >= cutoff && drawable >= ranges[i].from && drawable < ranges[i].to) return ranges[i];
    }
    return null;
}
function buildCat(key) {
    const cat = clothingCats[key];
    const sel = clothingPreview[key];
    const price = catPrice(cat, sel.drawable);
    const valid = clothingValid[key] || [];
    return {
        key, label: cat.label, kind: cat.kind,
        drawable: sel.drawable, position: valid.indexOf(sel.drawable), count: valid.length,
        texture: sel.texture, textures: validTextures(cat, sel.drawable),
        price: price.total, tax: price.tax,
        worn: !!clothingWorn[key],
        isNew: !!newRangeOf(key, sel.drawable), newAt: (newRangeOf(key, sel.drawable) || {}).at || 0,
        newCount: valid.filter(d => newRangeOf(key, d)).length
    };
}
function pushCart() {
    if (!clothingBrowser) return;
    const total = clothingCart.reduce((sum, item) => sum + item.price, 0);
    const view = clothingCart.map(item => ({ label: item.label, price: item.price, cat: item.cat, d: item.d, t: item.t }));
    clothingBrowser.execute('window.setCart(' + JSON.stringify(view) + ', ' + total + ')');
}
function pushClothingData() {
    if (!clothingBrowser) return;
    const categories = clothingOrder.map(buildCat);
    clothingBrowser.execute('window.setClothingData(' + JSON.stringify({
        money: clothingMoney, taxRate: clothingTaxRate, selected: clothingSelected, order: clothingOrder, categories,
        gender: clothingGender
    }) + ')');
}
function pushCategory(key) {
    if (clothingBrowser) clothingBrowser.execute('window.updateCategory(' + JSON.stringify(buildCat(key)) + ')');
}

mp.events.add('clothing:ui:ready', () => mp.events.callRemote('clothing:requestState'));
mp.events.add('clothing:state', (json) => {
    const data = JSON.parse(json);
    clothingMoney = data.money || 0;
    clothingTaxRate = data.taxRate || 0;
    clothingWorn = data.worn || {};
    clothingNude = data.nude || {};
    clothingTopArms = data.topArms || { def: 0, nude: 15, map: {} };
    clothingGender = data.gender === 'f' ? 'f' : 'm';
    clothingTexCache = {}; clothingValid = {};
    clothingCats = {}; clothingOrder = [];
    (data.categories || []).forEach(cat => { clothingCats[cat.key] = cat; clothingOrder.push(cat.key); });
    // Snapshot the current (synced) look, then start previewing from there.
    clothingOriginal = {}; clothingPreview = {};
    clothingOrder.forEach(key => {
        const current = readCurrent(clothingCats[key]);
        clothingOriginal[key] = { drawable: current.drawable, texture: current.texture };
        clothingPreview[key] = { drawable: current.drawable, texture: current.texture };
        clothingValid[key] = buildValidDrawables(clothingCats[key], current.drawable);
    });
    clothingSelected = clothingOrder[0] || null;
    if (clothingSelected) applyPedCamZone(CLOTH_ZONE[clothingSelected] || 'full');
    pushClothingData();
    pushCart();
    // Report slot sizes so the server can stamp newly uploaded drawables (it replies with clothing:newInfo).
    const counts = {};
    clothingOrder.forEach(key => { counts[key] = drawableCount(clothingCats[key]); });
    mp.events.callRemote('clothing:reportCounts', JSON.stringify(counts));
});
mp.events.add('clothing:newInfo', (json) => {
    try { clothingNewInfo = JSON.parse(json); } catch (e) { return; }
    pushClothingData();
});
mp.events.add('clothing:ui:select', (key) => {
    if (!clothingCats || !clothingCats[key]) return;
    clothingSelected = key;
    applyPedCamZone(CLOTH_ZONE[key] || 'full');
    if (clothingBrowser) clothingBrowser.execute('window.setSelected(' + JSON.stringify(key) + ')');
});
mp.events.add('clothing:ui:nav', (key, deltaDrawable) => {
    if (!clothingCats || !clothingCats[key]) return;
    const cat = clothingCats[key];
    const valid = clothingValid[key] || [];   // props start with "none" (-1)
    const n = valid.length;
    if (!n) return;
    const position = Math.max(0, valid.indexOf(clothingPreview[key].drawable));
    const next = valid[((position + Number(deltaDrawable)) % n + n) % n]; // wrap around
    clothingPreview[key] = { drawable: next, texture: validTextures(cat, next)[0] };
    applyPreview(cat, clothingPreview[key]);
    pushCategory(key);
});
mp.events.add('clothing:ui:tex', (key, texIndex) => {
    if (!clothingCats || !clothingCats[key]) return;
    const cat = clothingCats[key];
    const texture = Number(texIndex);
    if (validTextures(cat, clothingPreview[key].drawable).indexOf(texture) < 0) return; // only real textures
    clothingPreview[key].texture = texture;
    applyPreview(cat, clothingPreview[key]);
    pushCategory(key);
});
mp.events.add('clothing:ui:add', (key) => {
    if (!clothingCats || !clothingCats[key]) return;
    const cat = clothingCats[key];
    const sel = clothingPreview[key];
    if (sel.drawable < 0) return; // "none" isn't a buyable item
    const price = catPrice(cat, sel.drawable).total;
    const label = cat.label + ' #' + (sel.drawable + 1) + (sel.texture ? '/' + (sel.texture + 1) : '');
    clothingCart.push({ cat: key, d: sel.drawable, t: sel.texture, label, price });
    pushCart();
});
mp.events.add('clothing:ui:cartRemove', (index) => {
    index = Number(index);
    if (index >= 0 && index < clothingCart.length) { clothingCart.splice(index, 1); pushCart(); }
});
mp.events.add('clothing:ui:checkout', () => {
    if (!clothingCart.length) return;
    mp.events.callRemote('clothing:buyCart', JSON.stringify(clothingCart.map(item => ({ cat: item.cat, d: item.d, t: item.t }))));
});
mp.events.add('clothing:ui:none', (key) => {
    if (!clothingCats || !clothingCats[key]) return;
    if (clothingWorn[key]) { mp.events.callRemote('clothing:unequip', key); return; } // worn -> take it off into inventory
    // Nothing worn: just set this slot bare in the preview (and keep it bare on close).
    const cat = clothingCats[key];
    const bare = cat.kind === 'prop' ? -1 : (clothingNude[key] != null ? clothingNude[key] : 0);
    clothingPreview[key] = { drawable: bare, texture: 0 };
    clothingOriginal[key] = { drawable: bare, texture: 0 };
    applyPreview(cat, clothingPreview[key]);
    pushCategory(key);
});
mp.events.add('clothing:unequipResult', (json) => {
    const result = JSON.parse(json);
    clothingWorn = result.worn || {};
    const key = result.cat;
    if (result.full) { notify('ინვენტარი სავსეა — ვერ მოხსნით.'); }
    if (result.ok && clothingCats && clothingCats[key]) {
        // Reflect the removal on the preview ped and make it the look kept on close.
        const cat = clothingCats[key];
        // Same bare value the server strips the slot to (e.g. top 15), not drawable 0 (a T-shirt).
        clothingPreview[key] = { drawable: cat.kind === 'prop' ? -1 : (clothingNude[key] != null ? clothingNude[key] : 0), texture: 0 };
        clothingOriginal[key] = { drawable: clothingPreview[key].drawable, texture: clothingPreview[key].texture };
        applyPreview(cat, clothingPreview[key]);
    }
    if (key) pushCategory(key);
});
mp.events.add('clothing:cartResult', (json) => {
    const result = JSON.parse(json);
    clothingMoney = result.money != null ? result.money : clothingMoney;
    if (result.ok) {
        closeClothingUI(); // purchase done -> close the shop (reverts the try-on & teleports back)
        return;
    }
    // Failed (can't afford / no room): keep the shop open, just refresh the balance.
    if (clothingBrowser) clothingBrowser.execute('window.setMoney(' + clothingMoney + ')');
});
mp.events.add('clothing:ui:close', closeClothingUI);
mp.events.add('clothing:ui:rotate', (deltaPixels) => rotatePedPreview(Number(deltaPixels) * 0.5)); // drag on the ped to spin it
// Server (inventory) echo so the wearer always sees their own props (some builds don't sync server-side props).
mp.events.add('inventory:selfProp', (propId, drawable, texture) => {
    const me = mp.players.local;
    try { if (Number(drawable) < 0) me.clearProp(Number(propId)); else me.setPropIndex(Number(propId), Number(drawable), Number(texture) || 0, true); } catch (e) {}
});

// ---------- CEF barber shop (hair salon) ----------
// Same layout as the clothing store: categories on the left (hair, beard, eyebrows, their colours,
// eye colour), the picker on the right, a cart + checkout at the bottom. Style lists are the GTA
// Online barber/creator lists (named, in the game's order). Try-on is local; the server prices the
// change, charges, syncs and saves it. E asks the server first (range check + checkout session),
// because the preview happens at DRESSING_SPOT, away from the salon.
// Hair tint and head overlays only render on a ped with head blend data — the server sends the
// blend it applies, and the preview sets the same one locally.
let barberBrowser = null;
let barberPending = false;  // E pressed, waiting for the server to confirm we're at a salon
let barberState = null;     // { money, taxRate, prices, limits, blend }
let barberOriginal = null;  // look when the UI opened: { d, c, h, b, bc, e, ec, eye } (see packages/barber)
let barberSel = null;       // current try-on (same shape)
let barberCart = {};        // { catKey: value } — changes queued for checkout
let barberCats = [];        // BARBER_CATS available to this ped (no beard for female)
let barberLists = {};       // { hair|beard|eyebrows|eyes: [{ v, name }] }
let barberSelected = 'hair';
let barberReturn = null;    // where to teleport the player back to on close
const HAIR_COMPONENT = 2;
const OVERLAY_BEARD = 1, OVERLAY_EYEBROWS = 2, OVERLAY_NONE = 255;
// field = key in the look; kind 'list' = named picker (list = barberLists key), 'color' = hair palette.
const BARBER_CATS = [
    { key: 'hair',         label: 'ვარცხნილობა',    field: 'd',   kind: 'list', list: 'hair' },
    { key: 'hairColor',    label: 'თმის ფერი',      field: 'c',   kind: 'color' },
    { key: 'highlight',    label: 'ელფერი',         field: 'h',   kind: 'color' },
    { key: 'beard',        label: 'წვერი',          field: 'b',   kind: 'list', list: 'beard', male: true },
    { key: 'beardColor',   label: 'წვერის ფერი',    field: 'bc',  kind: 'color', male: true },
    { key: 'eyebrows',     label: 'წარბები',        field: 'e',   kind: 'list', list: 'eyebrows' },
    { key: 'eyebrowColor', label: 'წარბების ფერი',  field: 'ec',  kind: 'color' },
    { key: 'eyes',         label: 'თვალის ფერი',    field: 'eye', kind: 'list', list: 'eyes' }
];
// GTA Online barber hairstyles, by freemode hair drawable. Gaps (male 23 / female 24 = night-vision
// placeholder, and the fade/overlay duplicates in between) are deliberately not offered. Drawables
// above the last named one (newer DLC) are appended as "სტილი #N" if the game has them.
const GTAO_HAIR = {
    male: {
        0: 'Close Shave', 1: 'Buzzcut', 2: 'Faux Hawk', 3: 'Hipster', 4: 'Side Parting', 5: 'Shorter Cut',
        6: 'Biker', 7: 'Ponytail', 8: 'Cornrows', 9: 'Slicked', 10: 'Short Brushed', 11: 'Spikey',
        12: 'Caesar', 13: 'Chopped', 14: 'Dreads', 15: 'Long Hair', 16: 'Shaggy Curls', 17: 'Surfer Dude',
        18: 'Short Side Part', 19: 'High Slicked Sides', 20: 'Long Slicked', 21: 'Hipster Youth', 22: 'Mullet',
        24: 'Classic Cornrows', 25: 'Palm Cornrows', 26: 'Lightning Cornrows', 27: 'Whipped Cornrows',
        28: 'Zig Zag Cornrows', 29: 'Snail Cornrows', 30: 'Hightop', 31: 'Loose Swept Back',
        32: 'Undercut Swept Back', 33: 'Undercut Swept Side', 34: 'Spiked Mohawk', 35: 'Mod', 36: 'Layered Mod',
        72: 'Flattop', 73: 'Military Buzzcut'
    },
    female: {
        0: 'Close Shave', 1: 'Short', 2: 'Layered Bob', 3: 'Pigtails', 4: 'Ponytail', 5: 'Braided Mohawk',
        6: 'Braids', 7: 'Bob', 8: 'Faux Hawk', 9: 'French Twist', 10: 'Long Bob', 11: 'Loose Tied',
        12: 'Pixie', 13: 'Shaved Bangs', 14: 'Top Knot', 15: 'Wavy Bob', 16: 'Messy Bun', 17: 'Pin Up Girl',
        18: 'Tight Bun', 19: 'Twisted Bob', 20: 'Flapper Bob', 21: 'Big Bangs', 22: 'Braided Top Knot', 23: 'Mullet',
        25: 'Pinched Cornrows', 26: 'Leaf Cornrows', 27: 'Zig Zag Cornrows', 28: 'Pigtail Bangs', 29: 'Wave Braids',
        30: 'Coil Braids', 31: 'Rolled Quiff', 32: 'Loose Swept Back', 33: 'Undercut Swept Back',
        34: 'Undercut Swept Side', 35: 'Spiked Mohawk', 36: 'Bandana and Braid', 37: 'Layered Mod', 38: 'Skinbyrd',
        76: 'Neat Bun', 77: 'Short Bob'
    }
};
// GTA Online facial hair (head overlay 1), eyebrows (overlay 2) and eye colours, by index.
const GTAO_BEARDS = [
    'Light Stubble', 'Balbo', 'Circle Beard', 'Goatee', 'Chin', 'Chin Fuzz', 'Pencil Chin Strap', 'Scruffy',
    'Musketeer', 'Mustache', 'Trimmed Beard', 'Stubble', 'Thin Circle Beard', 'Horseshoe', "Pencil and 'Chops",
    'Chin Strap Beard', 'Balbo and Sideburns', 'Mutton Chops', 'Scruffy Beard', 'Curly', 'Curly & Deep Stranger',
    'Handlebar', 'Faustic', 'Otto & Patch', 'Otto & Full Stranger', 'Light Franz', 'The Hampstead', 'The Ambrose',
    'Lincoln Curtain'
];
const GTAO_EYEBROWS = [
    'Balanced', 'Fashion', 'Cleopatra', 'Quizzical', 'Femme', 'Seductive', 'Pinched', 'Chola', 'Triomphe',
    'Carefree', 'Curvaceous', 'Rodent', 'Double Tram', 'Thin', 'Penciled', 'Mother Plucker', 'Straight and Narrow',
    'Natural', 'Fuzzy', 'Unkempt', 'Caterpillar', 'Regular', 'Mediterranean', 'Groomed', 'Bushels', 'Feathered',
    'Prickly', 'Monobrow', 'Winged', 'Triple Tram', 'Arched Tram', 'Cutouts', 'Fade Away', 'Solo Tram'
];
const GTAO_EYES = [
    'Green', 'Emerald', 'Light Blue', 'Ocean Blue', 'Light Brown', 'Dark Brown', 'Hazel', 'Dark Gray',
    'Light Gray', 'Pink', 'Yellow', 'Purple', 'Blackout', 'Shades of Gray', 'Tequila Sunrise', 'Atomic',
    'Warp', 'ECola', 'Space Ranger', 'Ying Yang', 'Bullseye', 'Lizard', 'Dragon', 'Extra Terrestrial',
    'Goat', 'Smiley', 'Possessed', 'Demon', 'Infected', 'Alien', 'Undead', 'Zombie'
];

function isFemalePed() {
    return (mp.players.local.model >>> 0) === (mp.game.joaat('mp_f_freemode_01') >>> 0);
}
function hairStyleList(currentDrawable) {
    const me = mp.players.local;
    let count = 1;
    try { count = Math.max(1, me.getNumberOfDrawableVariations(HAIR_COMPONENT)); } catch (e) {}
    const names = isFemalePed() ? GTAO_HAIR.female : GTAO_HAIR.male;
    const ids = Object.keys(names).map(Number);
    const lastNamed = Math.max.apply(null, ids);
    const list = ids.filter(d => d < count).map(d => ({ v: d, name: names[d] }));
    for (let d = lastNamed + 1; d < count; d++) list.push({ v: d, name: 'სტილი #' + (d + 1) });
    if (!list.some(s => s.v === currentDrawable)) list.unshift({ v: currentDrawable, name: 'მიმდინარე' });
    return list;
}
// Named list for an overlay/eye picker; `none` adds "არცერთი" (-1) first.
function namedList(names, limit, none) {
    const list = none ? [{ v: -1, name: 'არცერთი' }] : [];
    for (let i = 0; i < limit; i++) list.push({ v: i, name: names[i] || ('#' + (i + 1)) });
    return list;
}
// RGB for a hair tint, so the palette shows real colours. The native's return shape differs between
// client builds; returns null (numbered chip) if it can't be read.
function hairRgb(index) {
    try {
        const res = mp.game.ped.getHairRgbColor(index, 0, 0, 0);
        let r, g, b;
        if (Array.isArray(res)) { [r, g, b] = res.length > 3 ? res.slice(1) : res; }
        else if (res && typeof res === 'object') {
            r = res.r != null ? res.r : res.outR; g = res.g != null ? res.g : res.outG; b = res.b != null ? res.b : res.outB;
        }
        if ([r, g, b].every(v => typeof v === 'number' && v >= 0 && v <= 255)) {
            return '#' + [r, g, b].map(v => ('0' + Math.round(v).toString(16)).slice(-2)).join('');
        }
    } catch (e) {}
    return null;
}
function applyHeadBlend() {
    const blend = barberState && barberState.blend;
    if (!blend) return;
    try { mp.players.local.setHeadBlendData(blend[0], blend[1], blend[2], blend[3], blend[4], blend[5], blend[6], blend[7], blend[8], false); } catch (e) {}
}
function applyOverlay(overlayId, index, color) {
    const me = mp.players.local;
    const value = index < 0 ? OVERLAY_NONE : index;
    try { me.setHeadOverlay(overlayId, value, 1.0, color, color); } catch (e) {}
    try { me.setHeadOverlayColor(overlayId, 1, color, color); } catch (e) {} // colour type 1 = hair palette
}
function applyLookPreview(look) {
    const me = mp.players.local;
    try { me.setComponentVariation(HAIR_COMPONENT, look.d, 0, 0); } catch (e) {}
    try { me.setHairColor(look.c, look.h); } catch (e) {}
    applyOverlay(OVERLAY_BEARD, look.b, look.bc);
    applyOverlay(OVERLAY_EYEBROWS, look.e, look.ec);
    try { me.setEyeColor(look.eye); } catch (e) {}
}
function barberCat(key) { return barberCats.find(c => c.key === key) || null; }
function barberLinePrice(cat) {
    const base = barberState.prices[cat.field] || 0;
    return { base, total: base + Math.round(base * Math.max(0, barberState.taxRate)) };
}
// The look checkout would buy: cart entries over the original (un-carted try-ons aren't bought).
function barberCartLook() {
    const look = Object.assign({}, barberOriginal);
    barberCats.forEach(cat => { if (barberCart[cat.key] != null) look[cat.field] = barberCart[cat.key]; });
    return look;
}
function barberValueLabel(cat, value) {
    if (cat.kind === 'color') return '#' + (value + 1);
    const entry = (barberLists[cat.list] || []).find(item => item.v === value);
    return entry ? entry.name : ('#' + (value + 1));
}
// Everything the page renders. Mirrors packages/barber quote(): tax is taken on the summed base.
function barberView() {
    const cats = barberCats.map(cat => {
        const value = barberSel[cat.field];
        const list = cat.kind === 'list' ? barberLists[cat.list] : null;
        return {
            key: cat.key, label: cat.label, kind: cat.kind, list: cat.list || null, price: barberLinePrice(cat).total,
            value, valueLabel: barberValueLabel(cat, value),
            index: list ? list.findIndex(item => item.v === value) : value, count: list ? list.length : barberState.limits.colors,
            changed: value !== barberOriginal[cat.field], inCart: barberCart[cat.key] != null
        };
    });
    const inCart = barberCats.filter(cat => barberCart[cat.key] != null);
    const cart = inCart.map(cat => ({
        key: cat.key, label: cat.label + ': ' + barberValueLabel(cat, barberCart[cat.key]), price: barberLinePrice(cat).total
    }));
    const base = inCart.reduce((sum, cat) => sum + barberLinePrice(cat).base, 0);
    const tax = Math.round(base * Math.max(0, barberState.taxRate));
    return { money: barberState.money, selected: barberSelected, cats, cart, total: base + tax, tax };
}
function pushBarber() {
    if (barberBrowser) barberBrowser.execute('window.updateBarber(' + JSON.stringify(barberView()) + ')');
}

function requestBarberUI() {
    if (barberBrowser || tattooBrowser || barberPending || anyModalOpen()) return;
    barberPending = true;
    setTimeout(() => { barberPending = false; }, 3000); // server never answered -> allow retry
    mp.events.callRemote('barber:requestState');
}
mp.events.add('barber:state', (json) => {
    if (!barberPending) return; // only answer our own E press
    barberPending = false;
    const data = JSON.parse(json);
    if (!data.open || barberBrowser || tattooBrowser || anyModalOpen()) return;
    const limits = Object.assign({ colors: 64, beards: 29, eyebrows: 34, eyes: 32 }, data.limits || {});
    try { const native = mp.game.ped.getNumHairColors(); if (native > 0) limits.colors = Math.min(limits.colors, native); } catch (e) {}
    barberState = { money: data.money || 0, taxRate: data.taxRate || 0, prices: data.prices || {}, limits, blend: data.blend || null };
    barberOriginal = Object.assign({ d: 0, c: 0, h: 0, b: -1, bc: 0, e: 0, ec: 0, eye: 0 }, data.current || {});
    barberSel = Object.assign({}, barberOriginal);
    barberCart = {};
    barberSelected = 'hair';
    const female = isFemalePed();
    barberCats = BARBER_CATS.filter(cat => !(cat.male && female));
    barberLists = {
        hair: hairStyleList(barberOriginal.d),
        beard: namedList(GTAO_BEARDS, limits.beards, true),
        eyebrows: namedList(GTAO_EYEBROWS, limits.eyebrows, true),
        eyes: namedList(GTAO_EYES, limits.eyes, false)
    };

    const me = mp.players.local;
    let heading = 0; try { heading = me.getHeading(); } catch (e) {}
    barberReturn = { x: me.position.x, y: me.position.y, z: me.position.z, heading };
    try { me.position = new mp.Vector3(DRESSING_SPOT.x, DRESSING_SPOT.y, DRESSING_SPOT.z); } catch (e) {}
    try { me.setHeading(DRESSING_SPOT.heading); } catch (e) {}
    applyHeadBlend();
    applyLookPreview(barberSel);
    // setHeadBlendData needs a frame to settle before hair tint renders (esp. the female ped),
    // so re-assert the look shortly after opening — otherwise the first colour change looks dead.
    setTimeout(() => { if (barberBrowser && barberSel) { applyHeadBlend(); applyLookPreview(barberSel); } }, 300);
    startPedPreview();
    applyPedCamZone('head');
    barberBrowser = mp.browsers.new('package://ui/barber/index.html');
    mp.gui.cursor.show(true, true);
});
function closeBarberUI() {
    if (!barberBrowser) return;
    if (barberOriginal) applyLookPreview(barberOriginal); // drop an un-bought try-on
    suppressPauseUntil = Date.now() + 1500;
    blockPauseControls();
    barberBrowser.destroy();
    barberBrowser = null;
    stopPedPreview();
    if (barberReturn) { // teleport back to the salon
        const me = mp.players.local;
        try { me.position = new mp.Vector3(barberReturn.x, barberReturn.y, barberReturn.z); } catch (e) {}
        try { me.setHeading(barberReturn.heading); } catch (e) {}
        barberReturn = null;
    }
    barberState = null; barberOriginal = null; barberSel = null; barberCart = {};
    mp.events.callRemote('barber:leave'); // restore dimension 0 (leave the private shop instance)
    mp.gui.cursor.show(false, false);
}
mp.events.add('barber:ui:ready', () => {
    if (!barberBrowser || tattooBrowser || !barberState) return;
    const palette = [];
    for (let i = 0; i < barberState.limits.colors; i++) palette.push(hairRgb(i));
    barberBrowser.execute('window.setBarberData(' + JSON.stringify({
        palette, lists: barberLists, view: barberView()
    }) + ')');
});
mp.events.add('barber:ui:select', (key) => {
    if (!barberSel || !barberCat(key)) return;
    barberSelected = key;
    pushBarber();
});
// Step through a category (wraps), like ‹ › in the clothing store.
mp.events.add('barber:ui:nav', (key, delta) => {
    const cat = barberCat(key);
    if (!barberSel || !cat) return;
    if (cat.kind === 'list') {
        const list = barberLists[cat.list];
        const n = list.length;
        const position = Math.max(0, list.findIndex(item => item.v === barberSel[cat.field]));
        barberSel[cat.field] = list[((position + Number(delta)) % n + n) % n].v;
    } else {
        const n = barberState.limits.colors;
        barberSel[cat.field] = ((barberSel[cat.field] + Number(delta)) % n + n) % n;
    }
    // Auto-stage the change so checkout buys it (no separate "add to cart" click).
    if (barberSel[cat.field] === barberOriginal[cat.field]) delete barberCart[cat.key];
    else barberCart[cat.key] = barberSel[cat.field];
    applyLookPreview(barberSel);
    pushBarber();
});
// Pick a value directly: an entry from a named list, or a palette colour.
mp.events.add('barber:ui:pick', (key, value) => {
    const cat = barberCat(key);
    if (!barberSel || !cat) return;
    value = Math.floor(Number(value));
    if (cat.kind === 'list') { if (!barberLists[cat.list].some(item => item.v === value)) return; }
    else value = Math.max(0, Math.min(barberState.limits.colors - 1, value || 0));
    barberSel[cat.field] = value;
    // Auto-stage this change so it's bought on checkout — no separate "add to cart" click needed.
    if (value === barberOriginal[cat.field]) delete barberCart[cat.key];
    else barberCart[cat.key] = value;
    applyLookPreview(barberSel);
    pushBarber();
});
mp.events.add('barber:ui:add', (key) => {
    const cat = barberCat(key);
    if (!barberSel || !cat) return;
    const value = barberSel[cat.field];
    if (value === barberOriginal[cat.field]) delete barberCart[cat.key]; // back to what you have = nothing to buy
    else barberCart[cat.key] = value; // one line per category; re-adding replaces it
    pushBarber();
});
// Put this category's try-on back to the current (bought) look.
mp.events.add('barber:ui:revert', (key) => {
    const cat = barberCat(key);
    if (!barberSel || !cat) return;
    barberSel[cat.field] = barberOriginal[cat.field];
    applyLookPreview(barberSel);
    pushBarber();
});
mp.events.add('barber:ui:cartRemove', (key) => {
    if (!barberSel || !barberCat(key)) return;
    delete barberCart[key];
    pushBarber();
});
mp.events.add('barber:ui:checkout', () => {
    if (!barberSel || !Object.keys(barberCart).length) return;
    const look = barberCartLook();
    barberSel = Object.assign({}, look); // show exactly what's being paid for
    applyLookPreview(barberSel);
    mp.events.callRemote('barber:buy', JSON.stringify(look));
});
mp.events.add('barber:result', (json) => {
    const result = JSON.parse(json);
    if (!barberState) return;
    barberState.money = result.money != null ? result.money : barberState.money;
    if (result.ok) {
        if (result.current) barberOriginal = result.current; // bought look is the one kept on close
        closeBarberUI();
        return;
    }
    pushBarber(); // failed (can't afford): keep the salon open, refresh the balance
});
mp.events.add('barber:ui:close', closeBarberUI);
mp.events.add('barber:ui:rotate', (deltaPixels) => rotatePedPreview(Number(deltaPixels) * 0.5));

// ---------- CEF tattoo salon — packages/tattoo ----------
// The page (ui/tattoo) holds the full tattoo lists and the cart; this side only moves the player to the
// clean dressing spot, strips clothes that would hide ink, frames the camera on the chosen body zone and
// previews the decorations the page asks for. The server re-prices and applies the purchase.
let tattooPending = false;  // E pressed, waiting for the server to confirm we're at a salon
let tattooState = null;     // { gender, money, taxRate, zonePrice, removePrice, maxOwned, owned, nude, nudeArms }
let tattooSavedLook = null; // { comp: [drawable, texture] } — clothes to put back on close
let tattooReturn = null;    // where to teleport the player back to on close
const TATTOO_CAM = ['head', 'upper', 'upper', 'upper', 'lower', 'lower']; // by zone index (head, torso, arms, legs)
const TATTOO_STRIP = { 11: 'top', 8: 'undershirt', 4: 'pants', 6: 'shoes' }; // clothing component -> nude look key

function tattooDraw(pairs) { // replace the local ped's decorations with [[collectionHash, overlayHash], ...]
    const me = mp.players.local;
    try { me.clearDecorations(); } catch (e) { try { mp.game.invoke('0x0E5173C163976E38', me.handle); } catch (e2) {} }
    (pairs || []).forEach(pair => {
        try { me.setDecoration(pair[0], pair[1]); } catch (e) { try { mp.game.invoke('0x5F5D1665E352A839', me.handle, pair[0], pair[1]); } catch (e2) {} }
    });
}
function requestTattooUI() {
    if (tattooBrowser || tattooPending || anyModalOpen()) return;
    tattooPending = true;
    setTimeout(() => { tattooPending = false; }, 3000); // server never answered -> allow retry
    mp.events.callRemote('tattoo:requestState');
}
mp.events.add('tattoo:state', (json) => {
    if (!tattooPending) return; // only answer our own E press
    tattooPending = false;
    const data = JSON.parse(json);
    if (!data.open || tattooBrowser || anyModalOpen()) return;
    tattooState = data;
    const me = mp.players.local;
    let heading = 0; try { heading = me.getHeading(); } catch (e) {}
    tattooReturn = { x: me.position.x, y: me.position.y, z: me.position.z, heading };
    try { me.position = new mp.Vector3(DRESSING_SPOT.x, DRESSING_SPOT.y, DRESSING_SPOT.z); } catch (e) {}
    try { me.setHeading(DRESSING_SPOT.heading); } catch (e) {}
    tattooSavedLook = {};
    [3, 4, 6, 8, 11].forEach(comp => {
        try { tattooSavedLook[comp] = [me.getDrawableVariation(comp), me.getTextureVariation(comp)]; } catch (e) {}
    });
    const nude = data.nude || {};
    Object.keys(TATTOO_STRIP).forEach(comp => {
        if (nude[TATTOO_STRIP[comp]] != null) { try { me.setComponentVariation(Number(comp), nude[TATTOO_STRIP[comp]], 0, 0); } catch (e) {} }
    });
    try { me.setComponentVariation(3, data.nudeArms != null ? data.nudeArms : 15, 0, 0); } catch (e) {}
    startPedPreview();
    applyPedCamZone('upper');
    tattooBrowser = mp.browsers.new('package://ui/tattoo/index.html');
    mp.gui.cursor.show(true, true);
});
function closeTattooUI() {
    if (!tattooBrowser) return;
    const me = mp.players.local;
    if (tattooSavedLook) Object.keys(tattooSavedLook).forEach(comp => {
        try { me.setComponentVariation(Number(comp), tattooSavedLook[comp][0], tattooSavedLook[comp][1], 0); } catch (e) {}
    });
    tattooSavedLook = null;
    suppressPauseUntil = Date.now() + 1500;
    blockPauseControls();
    tattooBrowser.destroy();
    tattooBrowser = null;
    stopPedPreview();
    if (tattooReturn) { // teleport back to the salon
        try { me.position = new mp.Vector3(tattooReturn.x, tattooReturn.y, tattooReturn.z); } catch (e) {}
        try { me.setHeading(tattooReturn.heading); } catch (e) {}
        tattooReturn = null;
    }
    tattooState = null;
    mp.events.callRemote('tattoo:refresh'); // drop the un-bought try-on: the server redraws what the player owns
    mp.events.callRemote('tattoo:leave');   // restore dimension 0 (leave the private shop instance)
    mp.gui.cursor.show(false, false);
}
mp.events.add('tattoo:ui:ready', () => {
    if (!tattooBrowser || !tattooState) return;
    tattooBrowser.execute('window.setTattooData(' + JSON.stringify({
        gender: tattooState.gender, money: tattooState.money, taxRate: tattooState.taxRate, zonePrice: tattooState.zonePrice,
        removePrice: tattooState.removePrice, maxOwned: tattooState.maxOwned, owned: tattooState.owned
    }) + ')');
});
mp.events.add('tattoo:ui:preview', (json) => { // [[collectionHash, overlayHash], ...] to show on the ped
    if (!tattooBrowser) return;
    try { tattooDraw(JSON.parse(json)); } catch (e) {}
});
mp.events.add('tattoo:ui:zone', (zone) => { if (tattooBrowser) applyPedCamZone(TATTOO_CAM[Number(zone)] || 'full'); });
mp.events.add('tattoo:ui:checkout', (json) => {
    if (!tattooBrowser) return;
    mp.events.callRemote('tattoo:buy', String(json));
});
mp.events.add('tattoo:result', (json) => {
    const result = JSON.parse(json);
    if (!tattooBrowser) return;
    if (result.ok) {
        if (tattooState) tattooState.owned = result.owned || [];
        closeTattooUI(); // the server has applied + synced the new set
        return;
    }
    tattooBrowser.execute('window.setMoney(' + Number(result.money || 0) + ')'); // failed: stay open, refresh balance
});
mp.events.add('tattoo:ui:facing', (degrees) => { // turn the ped to show its front (0) or back (180)
    if (!tattooBrowser || !pedAnchor) return;
    pedRotation = Number(degrees) || 0;
    try { mp.players.local.setHeading(pedAnchor.heading + pedRotation); } catch (e) {}
});
mp.events.add('tattoo:ui:close', closeTattooUI);
mp.events.add('tattoo:ui:rotate', (deltaPixels) => rotatePedPreview(Number(deltaPixels) * 0.5));

// ---------- City Hall (Rockford Hills) — packages/cityhall ----------
// The server sends the points (entrance/duty/desk/clerk/spawn), which admins move in-game with
// /cityhall set. Here: blip, ground markers, the ID clerk NPC, the E prompts, the desk/ID panel
// and the ID card shown to nearby players.
let cityhallPoints = null;
let cityhallBlip = null;
let cityhallMarkers = [];
let cityhallNpcs = [];      // [{ key, ped, label }]
let cityhallBrowser = null;
let cityhallCardBrowser = null;
let cityhallCardTimer = null;
const CITYHALL_RANGE = 2.0; // prompt radius (server accepts 3.0)
// NPC counters: point key -> ped model + the name floating above them.
const CITYHALL_NPCS = {
    clerk:    { model: 'a_f_y_business_02', title: 'ID Cards' },
    licenses: { model: 'a_m_y_business_02', title: 'Licenses' },
    weapons:  { model: 's_m_y_cop_01',      title: 'Weapon Permit' },
    desk:     { model: 'a_f_y_business_01', title: 'Cashier - Fines & Taxes' }
};
// E interactions: which point, the prompt text, the server event (+ args) it calls.
const CITYHALL_MODES = {
    duty:     { prompt: 'Government duty', event: 'cityhall:duty' },
    desk:     { prompt: 'Fines & taxes', event: 'cityhall:desk:open' },
    clerk:    { prompt: 'ID card', event: 'cityhall:id:open' },
    licenses: { prompt: 'Licenses (driving, boat, pilot...)', event: 'cityhall:lic:open', args: ['licenses'] },
    weapons:  { prompt: 'Weapon permit', event: 'cityhall:lic:open', args: ['weapons'] }
};

function nearestCityhallMode(pos) {
    if (!cityhallPoints) return null;
    for (const key of Object.keys(CITYHALL_MODES)) {
        const pt = cityhallPoints[key];
        // NPCs stand behind their counter; players talk to them from ~1m in front.
        if (pt && isNearPosition(pos, pt, CITYHALL_NPCS[key] ? CITYHALL_RANGE + 0.8 : CITYHALL_RANGE)) return key;
    }
    return null;
}
function buildCityhall() {
    try { if (cityhallBlip) cityhallBlip.destroy(); } catch (e) {}
    cityhallMarkers.forEach(marker => { try { marker.destroy(); } catch (e) {} });
    cityhallMarkers = [];
    cityhallNpcs.forEach(npc => { try { npc.ped.destroy(); } catch (e) {} try { if (npc.label) npc.label.destroy(); } catch (e) {} });
    cityhallNpcs = [];
    const pts = cityhallPoints;
    if (!pts) return;
    const at = (pt, dz) => new mp.Vector3(pt.x, pt.y, pt.z + (dz || 0));
    cityhallBlip = mp.blips.new(419, at(pts.entrance), { name: worldText('მერია (City Hall)'), scale: 0.9, color: 3, shortRange: false });
    cityhallMarkers.push(mp.markers.new(1, at(pts.entrance, -1.0), 1.4, { color: [75, 156, 224, 110], visible: true }));
    cityhallMarkers.push(mp.markers.new(27, at(pts.duty, -0.95), 1.2, { color: [75, 156, 224, 150], visible: true }));
    // Counter NPCs: frozen, invincible, ignore everything. Client-side, so every player spawns their own.
    Object.keys(CITYHALL_NPCS).forEach(key => {
        const pt = pts[key];
        if (!pt) return;
        const info = CITYHALL_NPCS[key];
        let ped = null, label = null;
        const ground = groundZAt(pt.x, pt.y, pt.z);
        const spot = new mp.Vector3(pt.x, pt.y, ground !== null ? ground + 1.0 : pt.z);
        try { ped = mp.peds.new(mp.game.joaat(info.model), spot, pt.h || 0, 0); } catch (e) {}
        try {
            label = mp.labels.new(worldText(info.title) + '\n~b~[E]', new mp.Vector3(spot.x, spot.y, spot.z + 1.15),
                { los: false, font: 4, drawDistance: 12, color: [255, 255, 255, 230], dimension: 0 });
        } catch (e) {}
        if (ped) cityhallNpcs.push({ key, ped, label });
        cityhallMarkers.push(mp.markers.new(27, at(pt, -0.95), 0.9, { color: [75, 156, 224, 120], visible: true }));
    });
}
// Ground height under a point (searching from a bit above it), or null if the area isn't loaded yet.
function groundZAt(x, y, z) {
    try {
        const res = mp.game.gameplay.getGroundZFor3dCoord(x, y, z + 3.0, 0.0, false);
        if (Array.isArray(res)) return res[0] ? res[1] : null;
        if (typeof res === 'number' && res !== 0) return res;
    } catch (e) {}
    return null;
}
// Peds created before they stream in can't take natives yet; keep them still once they exist.
setInterval(() => {
    cityhallNpcs.forEach(npc => {
        const ped = npc.ped;
        if (!ped || !ped.handle) return;
        try {
            ped.freezePosition(true);
            ped.setInvincible(true);
            ped.setBlockingOfNonTemporaryEvents(true);
            ped.setCanRagdoll(false);
        } catch (e) {}
    });
}, 2000);
mp.events.add('cityhall:points', (json) => {
    try { cityhallPoints = JSON.parse(json); } catch (e) { return; }
    buildCityhall();
});

// ---- Desk / ID panel ----
let cityhallState = null;
function openCityhallUI(state) {
    cityhallState = state;
    if (cityhallBrowser) { cityhallBrowser.execute('window.setCityhall(' + JSON.stringify(state) + ')'); return; }
    if (anyModalOpen()) return;
    cityhallBrowser = mp.browsers.new('package://ui/cityhall/index.html');
    mp.gui.cursor.show(true, true);
}
function closeCityhallUI() {
    if (!cityhallBrowser) return;
    suppressPauseUntil = Date.now() + 1500;
    blockPauseControls();
    cityhallBrowser.destroy();
    cityhallBrowser = null;
    cityhallState = null;
    mp.gui.cursor.show(false, false);
}
mp.events.add('cityhall:ui', (json) => { try { openCityhallUI(JSON.parse(json)); } catch (e) {} });
mp.events.add('cityhall:ui:ready', () => {
    if (cityhallBrowser && cityhallState) cityhallBrowser.execute('window.setCityhall(' + JSON.stringify(cityhallState) + ')');
});
mp.events.add('cityhall:ui:close', closeCityhallUI);
mp.events.add('cityhall:ui:pay', (index) => mp.events.callRemote('cityhall:desk:pay', Number(index)));
mp.events.add('cityhall:ui:license', (type) => mp.events.callRemote('cityhall:lic:buy', String(type)));
mp.events.add('cityhall:ui:issue', (first, last, dob) => mp.events.callRemote('cityhall:id:issue', String(first), String(last), String(dob)));

// ---- ID card shown to you (yours or someone else's): small card, no cursor, hides after 8s ----
function hideIdCard() {
    if (cityhallCardTimer) { clearTimeout(cityhallCardTimer); cityhallCardTimer = null; }
    if (cityhallCardBrowser) { try { cityhallCardBrowser.destroy(); } catch (e) {} cityhallCardBrowser = null; }
}
mp.events.add('cityhall:showId', (json) => {
    hideIdCard();
    cityhallCardBrowser = mp.browsers.new('package://ui/cityhall/idcard.html#' + encodeURIComponent(json));
    cityhallCardTimer = setTimeout(hideIdCard, 8000);
});

// ---------- Houses — packages/houses ----------
// Real map doors: every client locks/unlocks each house's front door object to match the server,
// re-applied while nearby (door state resets when the door streams out and back in).
let housesList = [];        // public views from the server (per player: `mine` flags)
let housesBlips = [];
let housesMarkers = [];
let housesBrowser = null;
let housesState = null;
let houseInside = null;     // { id, exit } while inside an interior house copy
let houseExitMarker = null;
let housesHighlight = false; // /houses toggle: for-sale houses big + visible on the minimap from anywhere
const HOUSE_DOOR_RANGE = 2.0;    // prompt radius (server accepts 2.5)
const HOUSE_POINT_RANGE = 2.0;
const HOUSE_GARAGE_RANGE = 4.5;  // driving in (server accepts 5.0)
const HOUSE_DOOR_SYNC_RANGE = 80;

function setDoorLocked(door, locked) {
    try {
        if (mp.game.object && typeof mp.game.object.doorControl === 'function') {
            mp.game.object.doorControl(door.model, door.x, door.y, door.z, locked, 0.0, 0.0, 0.0);
        } else {
            mp.game.invoke('0x9B12F9A24FABEDB0', door.model, door.x, door.y, door.z, locked, 0.0, false); // SET_STATE_OF_CLOSEST_DOOR_OF_TYPE
        }
    } catch (e) {}
}
function syncHouseDoors(onlyNear) {
    const me = mp.players.local.position;
    housesList.forEach(house => {
        if (!house.doorModel) return;
        if (onlyNear && !isNearPosition(me, house.doorModel, HOUSE_DOOR_SYNC_RANGE)) return;
        setDoorLocked(house.doorModel, !!house.locked);
    });
}
setInterval(() => syncHouseDoors(true), 1500);

function buildHouses() {
    housesBlips.forEach(blip => { try { blip.destroy(); } catch (e) {} });
    housesMarkers.forEach(marker => { try { marker.destroy(); } catch (e) {} });
    housesBlips = []; housesMarkers = [];
    const at = (pt, dz) => new mp.Vector3(pt.x, pt.y, pt.z + (dz || 0));
    // Apartment buildings: one blip + marker per entrance (blue if you own a unit, green if any is for sale).
    const buildings = {};
    housesList.forEach(house => {
        if (!house.building) return;
        const b = buildings[house.building] || (buildings[house.building] = { name: house.buildingName, door: house.door, free: 0, mine: false });
        if (house.forSale) b.free++;
        if (house.mine) b.mine = true;
    });
    Object.values(buildings).forEach(b => {
        housesBlips.push(mp.blips.new(475, at(b.door), {
            name: worldText(b.mine ? 'ჩემი ბინა — ' + b.name : b.name + (b.free ? ' — იყიდება ' + b.free + ' ბინა' : ' — ყველა ბინა გაყიდულია')),
            scale: b.mine ? 0.9 : 0.75, color: b.mine ? 3 : (b.free ? 2 : 4), shortRange: !b.mine && !(housesHighlight && b.free)
        }));
        housesMarkers.push(mp.markers.new(27, at(b.door, -0.95), 1.2, { color: b.mine ? [90, 169, 255, 140] : [111, 207, 151, 140], visible: true }));
    });
    housesList.forEach(house => {
        if (house.building) {
            // Units share the entrance (handled above); only their own chest/garage markers below.
        } else if (house.forSale) {
            housesBlips.push(mp.blips.new(40, at(house.door), {
                name: worldText('იყიდება: ' + house.name + ' ($' + house.price + ')'),
                scale: housesHighlight ? 0.9 : 0.7, color: 2, shortRange: !housesHighlight
            }));
        } else if (house.mine) {
            housesBlips.push(mp.blips.new(40, at(house.door), { name: worldText('ჩემი სახლი'), scale: 0.9, color: 3, shortRange: false }));
        } else {
            // Sold to someone else: still on the map, small and grey.
            housesBlips.push(mp.blips.new(40, at(house.door), { name: worldText('გაყიდულია: ' + house.name), scale: 0.55, color: 40, shortRange: true }));
        }
        if (!house.building && (house.forSale || house.mine)) {
            housesMarkers.push(mp.markers.new(27, at(house.door, -0.95), 1.0, { color: house.mine ? [90, 169, 255, 140] : [111, 207, 151, 140], visible: true }));
        }
        if (house.mine && house.chest) housesMarkers.push(mp.markers.new(27, at(house.chest, -0.95), 0.9, { color: [242, 193, 92, 140], visible: true, dimension: house.chest.dim || 0 }));
        if (house.mine && house.garage) housesMarkers.push(mp.markers.new(1, at(house.garage, -1.0), 3.0, { color: [90, 169, 255, 70], visible: true }));
    });
}
mp.events.add('houses:list', (json) => {
    try { housesList = JSON.parse(json) || []; } catch (e) { return; }
    buildHouses();
    syncHouseDoors(false);
});
// One house changed (bought / locked / sold): merge it in and redraw.
mp.events.add('houses:update', (json) => {
    let house;
    try { house = JSON.parse(json); } catch (e) { return; }
    if (!house || house.id === undefined) return;
    const index = housesList.findIndex(h => h.id === house.id);
    if (index >= 0) housesList[index] = house; else housesList.push(house);
    buildHouses();
    if (house.doorModel) setDoorLocked(house.doorModel, !!house.locked);
});

// Entered an interior house (or an admin /house itp): load its interior style, mark the exit.
mp.events.add('houses:entered', (json) => {
    let info;
    try { info = JSON.parse(json); } catch (e) { return; }
    if (info.ipl) {
        // Styles at one location are mutually exclusive: unload the others, then load this one.
        (info.iplGroup || []).forEach(name => { if (name !== info.ipl) { try { mp.game.streaming.removeIpl(name); } catch (e) {} } });
        try { mp.game.streaming.requestIpl(info.ipl); } catch (e) {}
    }
    try { if (houseExitMarker) houseExitMarker.destroy(); } catch (e) {}
    houseExitMarker = null;
    houseInside = info.exit ? { id: info.id, exit: info.exit } : null;
    if (houseInside) {
        houseExitMarker = mp.markers.new(27, new mp.Vector3(info.exit.x, info.exit.y, info.exit.z - 0.95), 1.0,
            { color: [111, 207, 151, 140], visible: true, dimension: mp.players.local.dimension });
    }
});
mp.events.add('houses:left', () => {
    houseInside = null;
    try { if (houseExitMarker) houseExitMarker.destroy(); } catch (e) {}
    houseExitMarker = null;
});
mp.events.add('houses:ui:hide', () => closeHousesUI());

// What E would do right now: { id, event, prompt } or null.
function nearestHouseAction(me) {
    const pos = me.position;
    const vehicle = me.vehicle;
    const dim = Number(me.dimension) || 0;
    if (houseInside && !vehicle && isNearPosition(pos, houseInside.exit, HOUSE_DOOR_RANGE)) {
        return { id: houseInside.id, event: 'houses:exit', prompt: 'Exit' };
    }
    for (const house of housesList) {
        if (vehicle) {
            if (house.mine && house.garage && isNearPosition(pos, house.garage, HOUSE_GARAGE_RANGE)) {
                let driver = false;
                try { driver = vehicle.getPedInSeat(-1) === me.handle; } catch (e) {}
                if (driver) return { id: house.id, event: 'houses:garage', prompt: 'Park in garage' };
            }
            continue;
        }
        if (dim === 0 && house.building && isNearPosition(pos, house.door, HOUSE_DOOR_RANGE)) {
            const units = housesList.filter(h => h.building === house.building);
            const free = units.filter(h => h.forSale).length;
            const mine = units.some(h => h.mine);
            return { id: house.id, event: 'houses:door', prompt: house.buildingName + (mine ? ' - my apartment' : '') + (free ? ' - ' + free + ' for sale' : '') };
        }
        if (dim === 0 && isNearPosition(pos, house.door, HOUSE_DOOR_RANGE)) {
            const prompt = house.forSale ? house.name + ' - for sale $' + house.price
                : house.mine ? 'My house' + (house.locked ? ' (locked)' : '') : house.name + ' - ' + house.ownerName;
            return { id: house.id, event: 'houses:door', prompt };
        }
        if (house.mine && house.chest && dim === (house.chest.dim || 0) && isNearPosition(pos, house.chest, HOUSE_POINT_RANGE)) return { id: house.id, event: 'houses:chest', prompt: 'Storage' };
        if (house.mine && house.garage && dim === 0 && isNearPosition(pos, house.garage, HOUSE_POINT_RANGE)) return { id: house.id, event: 'houses:garage', prompt: 'Garage - take car out' };
    }
    return null;
}

// Admin /house add|setdoor: find the door object the camera is looking at (within 6 m).
mp.events.add('houses:pickDoor', () => {
    let result = null;
    try {
        const from = mp.game.cam.getGameplayCamCoord();
        const rot = mp.game.cam.getGameplayCamRot(2);
        const yaw = rot.z * Math.PI / 180, pitch = rot.x * Math.PI / 180;
        const dir = { x: -Math.sin(yaw) * Math.cos(pitch), y: Math.cos(yaw) * Math.cos(pitch), z: Math.sin(pitch) };
        const reach = 6 + 3; // camera sits ~3 m behind the player
        const to = new mp.Vector3(from.x + dir.x * reach, from.y + dir.y * reach, from.z + dir.z * reach);
        const hit = mp.raycasting.testPointToPoint(from, to, mp.players.local, 1 | 16);
        const handle = hit && (typeof hit.entity === 'number' ? hit.entity : (hit.entity && hit.entity.handle));
        if (handle) {
            const model = mp.game.invoke('0x9F47B058362C84B5', handle) >>> 0; // GET_ENTITY_MODEL
            let coords = hit.position;
            try { const c = mp.game.invokeVector('0x3FEF770D40960D5A', handle, false); if (c && (c.x || c.y)) coords = c; } catch (e) {} // GET_ENTITY_COORDS
            if (model) result = { model, x: coords.x, y: coords.y, z: coords.z };
        }
    } catch (e) {}
    notify(result ? 'კარი ნაპოვნია (model ' + result.model + ').' : 'კარი ვერ ვიპოვე — შეხედეთ კარს ახლოდან.');
    mp.events.callRemote('houses:doorPicked', JSON.stringify(result));
});

// ---- Door / chest panel ----
function openHousesUI(state) {
    housesState = state;
    if (housesBrowser) { housesBrowser.execute('window.setHouse(' + JSON.stringify(state) + ')'); return; }
    if (anyModalOpen()) return;
    housesBrowser = mp.browsers.new('package://ui/houses/index.html');
    mp.gui.cursor.show(true, true);
}
function closeHousesUI() {
    if (!housesBrowser) return;
    suppressPauseUntil = Date.now() + 1500;
    blockPauseControls();
    housesBrowser.destroy();
    housesBrowser = null;
    housesState = null;
    mp.gui.cursor.show(false, false);
}
mp.events.add('houses:ui', (json) => { try { openHousesUI(JSON.parse(json)); } catch (e) {} });
mp.events.add('houses:ui:ready', () => { if (housesBrowser && housesState) housesBrowser.execute('window.setHouse(' + JSON.stringify(housesState) + ')'); });
mp.events.add('houses:ui:close', closeHousesUI);
mp.events.add('houses:ui:action', (action, id) => {
    const allowed = { buy: 'houses:buy', lock: 'houses:lock', sell: 'houses:sell', spawn: 'houses:spawnToggle', enter: 'houses:enter', unit: 'houses:unit', back: 'houses:door' };
    if (allowed[action]) mp.events.callRemote(allowed[action], Number(id));
});
// ---- /houses: real-estate listing (built here from housesList — nothing extra from the server) ----
function marketState() {
    const me = mp.players.local.position;
    const rows = housesList.filter(h => h.forSale).map(h => ({
        id: h.id, name: h.building ? h.name : h.name, building: h.buildingName || null, price: h.price,
        interior: h.interior, x: h.door.x, y: h.door.y,
        distance: Math.round(Math.hypot(me.x - h.door.x, me.y - h.door.y))
    })).sort((a, b) => a.distance - b.distance);
    return { mode: 'market', highlight: housesHighlight, rows, money: getMoney() };
}
mp.events.add('houses:market', () => openHousesUI(marketState()));
mp.events.add('houses:ui:gps', (x, y) => {
    try { mp.game.ui.setNewWaypoint(Number(x), Number(y)); } catch (e) {}
    notify('GPS: მარშრუტი დაყენდა სახლამდე.');
});
mp.events.add('houses:ui:highlight', () => {
    housesHighlight = !housesHighlight;
    buildHouses();
    notify(housesHighlight ? 'იყიდება სახლები მონიშნულია რუკაზე.' : 'მონიშვნა გამორთულია.');
    if (housesBrowser && housesState && housesState.mode === 'market') openHousesUI(marketState());
});

mp.events.add('houses:ui:chest', (direction, id, itemId, qty) => {
    mp.events.callRemote(direction === 'put' ? 'houses:chestPut' : 'houses:chestTake', Number(id), String(itemId), Number(qty));
});

// ---------- Demorgan (packages/demorgan): admin jail HUD + restrictions ----------
// The server syncs 'demorgan:left' (seconds) every 2 s; between syncs we count down locally.
let demorganLeft = 0, demorganSyncedAt = 0;
// Demorgan (dimension 1) is an enclosed underground interior (the bunker), so the outside map isn't
// visible from it. Here: the interior's furniture is switched on, the minimap is hidden, ambient
// NPCs / traffic are off and the player is invincible while in Demorgan. Everything is restored on leaving.
const DEMORGAN_DIMENSION = 1;
// Entity sets (furniture / wall style) per interior; the bunker is a bare shell without them.
const DEMORGAN_INTERIOR_SETS = {
    bunker: ['Bunker_Style_A', 'standard_bunker_set', 'standard_security_set', 'Office_Upgrade_set', 'gun_wall_blocker', 'gun_range_blocker_set']
};
// The bunker interior only exists once its Gunrunning IPLs are loaded; without them the walls/props/textures
// are missing (an empty or see-through shell). Requested at startup so it's ready before anyone is sent there.
const DEMORGAN_INTERIOR_IPLS = {
    bunker: ['gr_grdlc_interior_placement', 'gr_grdlc_interior_placement_interior_0_grdlc_int_01_milo_']
};
function requestDemorganIpls(kind) {
    (DEMORGAN_INTERIOR_IPLS[kind] || []).forEach(name => { try { mp.game.streaming.requestIpl(name); } catch (e) {} });
}
Object.keys(DEMORGAN_INTERIOR_IPLS).forEach(requestDemorganIpls);
let demorganIsolated = false, demorganLoadTimer = null;
// Loads the interior's furniture. The interior can take a while to stream in (and is 0 until its IPLs are
// up), so retry every 500 ms (up to ~30 s) until it exists and is ready; then pin it in memory and switch the sets on.
function loadDemorganInterior(area) {
    const sets = DEMORGAN_INTERIOR_SETS[area.interior];
    if (!sets) return;
    requestDemorganIpls(area.interior);
    if (demorganLoadTimer) clearInterval(demorganLoadTimer);
    let tries = 0;
    demorganLoadTimer = setInterval(() => {
        tries++;
        if (!demorganIsolated || tries > 60) { clearInterval(demorganLoadTimer); demorganLoadTimer = null; return; }
        try {
            const interior = mp.game.interior.getInteriorAtCoords(area.x, area.y, area.z);
            if (!interior) return;
            try { mp.game.invoke('0x2CA429C029CCF247', interior); } catch (e) {} // PIN_INTERIOR_IN_MEMORY
            let ready = true;
            try { ready = !!mp.game.invoke('0x6726BDCCC1932F0E', interior); } catch (e) {} // IS_INTERIOR_READY
            if (!ready) return;
            sets.forEach(name => {
                try {
                    if (typeof mp.game.interior.activateInteriorEntitySet === 'function') mp.game.interior.activateInteriorEntitySet(interior, name);
                    else mp.game.interior.enableInteriorProp(interior, name);
                } catch (e) {}
            });
            mp.game.interior.refreshInterior(interior);
            clearInterval(demorganLoadTimer); demorganLoadTimer = null;
        } catch (e) {}
    }, 500);
}
// Admin tool (/dmset): switch one bunker entity set on/off live to find which one fixes missing textures.
mp.events.add('demorgan:interior:set', (name, on) => {
    const area = mp.players.local.getVariable('demorgan:area');
    if (!area) return;
    try {
        const interior = mp.game.interior.getInteriorAtCoords(area.x, area.y, area.z);
        if (!interior) { notify('Interior not loaded (id 0).'); return; }
        const i = mp.game.interior;
        if (on) { if (i.activateInteriorEntitySet) i.activateInteriorEntitySet(interior, name); else i.enableInteriorProp(interior, name); }
        else { if (i.deactivateInteriorEntitySet) i.deactivateInteriorEntitySet(interior, name); else i.disableInteriorProp(interior, name); }
        i.refreshInterior(interior);
        let active = '?';
        try { active = i.isInteriorEntitySetActive(interior, name); } catch (e) {}
        notify('Interior set ' + name + ' → ' + (on ? 'ON' : 'OFF') + ' (active=' + active + ', interior ' + interior + ')');
    } catch (e) { notify('dmset failed: ' + e); }
});
function setDemorganIsolation(on, area) {
    demorganIsolated = on;
    try { mp.game.ui.displayRadar(!on); } catch (e) {}
    // Leaving: hand invincibility back to whatever admin mode / fly / noclip want.
    if (!on) { try { mp.players.local.setInvincible(flyEnabled || adminModeEnabled || noclip); } catch (e) {} }
    if (on && area) {
        loadDemorganInterior(area);
        try { mp.game.gameplay.clearArea(area.x, area.y, area.z, 300, true, false, false, false); } catch (e) {}
    }
}
function suppressAmbientThisFrame() {
    try { mp.game.ped.setPedDensityMultiplierThisFrame(0); } catch (e) {}
    try { mp.game.ped.setScenarioPedDensityMultiplierThisFrame(0, 0); } catch (e) {}
    try { mp.game.vehicle.setVehicleDensityMultiplierThisFrame(0); } catch (e) {}
    try { mp.game.vehicle.setRandomVehicleDensityMultiplierThisFrame(0); } catch (e) {}
    try { mp.game.vehicle.setParkedVehicleDensityMultiplierThisFrame(0); } catch (e) {}
}
mp.events.add('render', () => {
    const me = mp.players.local;
    const area = me.getVariable('demorgan:area');
    const inDemorgan = !!area && Number(me.dimension) === DEMORGAN_DIMENSION;
    if (inDemorgan !== demorganIsolated) setDemorganIsolation(inDemorgan, area);
    if (inDemorgan) {
        drawDemorganDigSpotsForAdmin(me);
        suppressAmbientThisFrame();
        me.setInvincible(true); // nobody can be hurt in Demorgan (re-applied every frame: respawn resets it)
    }
    // Prison work: prisoners get their own marked spot (orange); admins in Demorgan can dig at any spot.
    const dig = inDemorgan ? me.getVariable('demorgan:dig') : null;
    if (dig) mp.game.graphics.drawMarker(1, dig.x, dig.y, dig.z - 1.0, 0, 0, 0, 0, 0, 0, 1.2, 1.2, 0.6, 255, 180, 46, 150, false, false, 2, false, null, null, false);
    updateDemorganDigTags(me, inDemorgan);
    const synced = Number(me.getVariable('demorgan:left')) || 0;
    if (synced !== demorganLeft) { demorganLeft = synced; demorganSyncedAt = Date.now(); }
    if (demorganLeft <= 0) return;
    const left = Math.max(0, Math.ceil(demorganLeft - (Date.now() - demorganSyncedAt) / 1000));
    // No weapons, no melee, no vehicles, no weapon wheel while serving the sentence.
    [23, 24, 25, 37, 44, 140, 141, 142, 143, 257, 263, 264].forEach(control => mp.game.controls.disableControlAction(0, control, true));
    try { mp.game.invoke('0xADF692B254977C0C', me.handle, WEAPON_UNARMED, true); } catch (e) {} // SET_CURRENT_PED_WEAPON
    const reason = String(me.getVariable('demorgan:reason') || '');
    mp.game.graphics.drawText('DEMORGAN  ' + Math.floor(left / 60) + ':' + String(left % 60).padStart(2, '0'), [0.5, 0.05], {
        font: 4, color: [255, 105, 120, 235], outline: true, centre: true, scale: [0.7, 0.7]
    });
    if (reason) mp.game.graphics.drawText(worldText(reason), [0.5, 0.095], { font: 4, color: [255, 255, 255, 200], outline: true, centre: true, scale: [0.4, 0.4] });
});
// Seconds of digging break left for this prisoner (server syncs 'cd' every 2 s; we count down between syncs).
let digCdSynced = -1, digCdAt = 0;
function demorganDigCooldown(dig) {
    if (!dig || !(dig.cd > 0)) { digCdSynced = -1; return 0; }
    if (dig.cd !== digCdSynced) { digCdSynced = dig.cd; digCdAt = Date.now(); }
    return Math.max(0, Math.ceil(dig.cd - (Date.now() - digCdAt) / 1000));
}
// Push notification when a dig pays: the HUD's earnings chip, styled like the ammo chip (ui/hud).
mp.events.add('demorgan:dig:reward', (money) => {
    if (hudBrowser) hudBrowser.execute('window.hudEarn(' + (Number(money) || 0) + ', "Digging")');
});
// Admins: every digging spot, numbered like /dmdig, always shown while in Demorgan.
function drawDemorganDigSpotsForAdmin(me) {
    const spots = me.getVariable('demorgan:digAll');
    if (!Array.isArray(spots)) return;
    spots.forEach(s => mp.game.graphics.drawMarker(1, s.x, s.y, s.z - 1.0, 0, 0, 0, 0, 0, 0, 1.2, 1.2, 0.6, 255, 180, 46, 120, false, false, 2, false, null, null, false));
}
// "E Dig" interaction labels on the dig spots (ammo chip style): projected to the screen here, drawn by ui/hud.
// Prisoners see one on their own spot (with n/10, or the break countdown); admins on every spot. Throttled.
let lastDigTags = '[]', lastDigTagsAt = 0;
const DIG_LABEL_RANGE = 15;
function updateDemorganDigTags(me, inDemorgan) {
    const now = Date.now();
    if (now - lastDigTagsAt < 50) return;
    lastDigTagsAt = now;
    const tags = [];
    if (inDemorgan && !me.vehicle) {
        const own = me.getVariable('demorgan:dig');
        const spots = own ? [own] : (me.getVariable('demorgan:digAll') || []);
        const cd = own ? demorganDigCooldown(own) : 0;
        const label = cd > 0
            ? { text: 'Digging break', extra: Math.floor(cd / 60) + ':' + String(cd % 60).padStart(2, '0'), warn: true }
            : { key: 'E', text: 'Dig', extra: own ? (10 - own.left + 1) + '/10' : '' };
        const p = me.position;
        if (Array.isArray(spots)) spots.forEach(s => {
            if (Math.hypot(p.x - s.x, p.y - s.y, p.z - s.z) > DIG_LABEL_RANGE) return;
            let screen = null;
            try { screen = mp.game.graphics.world3dToScreen2d(s.x, s.y, s.z + 0.8); } catch (e) {}
            if (screen) tags.push(Object.assign({ x: screen.x * 100, y: screen.y * 100 }, label));
        });
    }
    const json = JSON.stringify(tags);
    if (json === lastDigTags && !tags.length) return;
    lastDigTags = json;
    if (hudBrowser) hudBrowser.execute('window.hudTags(' + json + ')');
}
// Standing on this prisoner's marked digging spot, or (admins) on any digging spot. The server re-checks.
function demorganDigNear() {
    const me = mp.players.local;
    if (me.vehicle || Number(me.dimension) !== DEMORGAN_DIMENSION) return false;
    const dig = me.getVariable('demorgan:dig');
    const spots = dig ? [dig] : (me.getVariable('demorgan:digAll') || []);
    if (!Array.isArray(spots)) return false;
    const p = me.position;
    return spots.some(s => Math.hypot(p.x - s.x, p.y - s.y, p.z - s.z) <= 2.0);
}
// Pickaxe in the digging prisoner's hands (every prisoner gets one automatically) while the server-synced animation plays.
mp.events.add('demorgan:digProp', (remoteId, ms) => {
    const ped = mp.players.atRemoteId(remoteId);
    if (!ped || !mp.players.exists(ped) || !ped.handle) return;
    const obj = mp.objects.new(mp.game.joaat('prop_tool_pickaxe'), ped.position, { dimension: ped.dimension });
    const tryAttach = (tries) => {
        if (!mp.objects.exists(obj)) return;
        if (!obj.handle) { if (tries > 0) setTimeout(() => tryAttach(tries - 1), 50); return; }
        obj.attachTo(ped.handle, ped.getBoneIndex(57005), 0.09, 0.0, -0.02, -78.0, 13.0, 28.0, true, true, false, true, 1, true); // SKEL_R_Hand — tune offsets in-game
    };
    tryAttach(20);
    setTimeout(() => { if (mp.objects.exists(obj)) obj.destroy(); }, Number(ms) || 10000);
});

// ---------- Director Mode (super admin) ----------
let directorBrowser = null;
let noclip = false;
function isSuperAdmin() { return mp.players.local.getVariable('director:super') === true; }
function openDirector() {
    // Authorization is enforced server-side (both /director and the F6 path go through the server),
    // so we don't re-check the super-admin flag here — that caused Director to silently not open.
    if (directorBrowser || adminBrowser) return;
    directorBrowser = mp.browsers.new('package://ui/director/index.html');
    mp.gui.cursor.show(true, true);
}
function closeDirector() {
    if (!directorBrowser) return;
    suppressPauseUntil = Date.now() + 1500;
    blockPauseControls();
    directorBrowser.destroy();
    directorBrowser = null;
    mp.gui.cursor.show(false, false);
}
mp.events.add('director:ui:toggle', () => (directorBrowser ? closeDirector() : openDirector()));
mp.events.add('director:ui:ready', () => { if (directorBrowser) directorBrowser.execute('window.setNoclip(' + noclip + ')'); });
mp.events.add('director:ui:close', closeDirector);
mp.events.add('director:ui:time', (h, m) => mp.events.callRemote('director:setTime', Number(h), Number(m)));
mp.events.add('director:ui:weather', (w) => mp.events.callRemote('director:setWeather', String(w)));
mp.events.add('director:ui:model', (name) => mp.events.callRemote('director:setModel', String(name)));
mp.events.add('director:ui:coords', (x, y, z) => mp.events.callRemote('director:teleport', Number(x), Number(y), Number(z)));
mp.events.add('director:ui:waypoint', () => teleportToWaypoint());
mp.events.add('director:ui:noclip', () => { toggleNoclip(); if (directorBrowser) directorBrowser.execute('window.setNoclip(' + noclip + ')'); });

function teleportToWaypoint() {
    const me = mp.players.local;
    let blip = 0;
    try { blip = mp.game.ui.getFirstBlipInfoId(8); } catch (e) {}
    if (!blip || !mp.game.ui.doesBlipExist(blip)) { notify('არ არის მონიშნული waypoint.'); return; }
    const coord = mp.game.ui.getBlipInfoIdCoord(blip);
    me.position = new mp.Vector3(coord.x, coord.y, 100.0);
    setTimeout(() => {
        let gz = 0, ok = false;
        try {
            const res = mp.game.gameplay.getGroundZFor3dCoord(coord.x, coord.y, 1000.0, 0.0, false);
            if (Array.isArray(res)) { ok = res[0]; gz = res[1]; } else if (typeof res === 'number') { ok = true; gz = res; }
        } catch (e) {}
        if (ok && gz) me.position = new mp.Vector3(coord.x, coord.y, gz + 1.0);
    }, 400);
}
function toggleNoclip() {
    noclip = !noclip;
    const me = mp.players.local;
    try { me.freezePosition(noclip); } catch (e) {}
    try { me.setInvincible(noclip); } catch (e) {}
    if (!noclip) { try { me.setCollision(true, true); } catch (e) {} }
    notify(noclip ? 'Noclip ჩართულია (WASD, Space/Ctrl, Shift სწრაფად).' : 'Noclip გამორთულია.');
}
mp.events.add('render', () => {
    if (!noclip) return;
    const me = mp.players.local;
    try { me.setCollision(false, false); } catch (e) {}
    if (directorBrowser) return; // panel open: hold position, don't fly
    const c = mp.game.controls;
    const rot = mp.game.cam.getGameplayCamRot(2);
    const yaw = rot.z * Math.PI / 180, pitch = rot.x * Math.PI / 180;
    const cosP = Math.cos(pitch);
    const fx = -Math.sin(yaw) * cosP, fy = Math.cos(yaw) * cosP, fz = Math.sin(pitch);
    const rx = Math.cos(yaw), ry = Math.sin(yaw);
    let dx = 0, dy = 0, dz = 0;
    if (c.isControlPressed(0, 32)) { dx += fx; dy += fy; dz += fz; } // W
    if (c.isControlPressed(0, 33)) { dx -= fx; dy -= fy; dz -= fz; } // S
    if (c.isControlPressed(0, 34)) { dx -= rx; dy -= ry; }           // A
    if (c.isControlPressed(0, 35)) { dx += rx; dy += ry; }           // D
    if (c.isControlPressed(0, 22)) { dz += 1; }                      // Space up
    if (c.isControlPressed(0, 36)) { dz -= 1; }                      // Ctrl down
    const speed = c.isControlPressed(0, 21) ? 2.4 : 0.8;            // Shift = faster
    if (dx || dy || dz) {
        const pos = me.position;
        me.position = new mp.Vector3(pos.x + dx * speed, pos.y + dy * speed, pos.z + dz * speed);
    }
});
bindKey(0x75, false, () => { // F6 — open/close Director Mode (super admins only)
    if (chatting || adminBrowser) return;
    if (directorBrowser) { closeDirector(); return; }
    mp.events.callRemote('director:open'); // server verifies super-admin, then opens the panel
});

// ---------- Phone: Up arrow opens the smartphone, Down arrow closes it ----------
let phoneOut = false;
let phoneBrowser = null;
let phoneProp = null;      // the phone object attached to the hand
let phoneHoldTimer = null; // waits for the anim/model to stream in, then applies once
// Attach the phone into the right hand and play the "hold & look at phone" idle. Offsets are tunable.
const PHONE_ANIM = { dict: 'cellphone@', name: 'cellphone_text_read_base' };
// Offsets are in METRES relative to the right-hand bone (28422). Keep them tiny — the phone sits in
// the palm, so values are within a few cm. px pushes forward along the fingers, py across the palm,
// pz up/down. Tune these in-game if the phone isn't seated perfectly.
const PHONE_ATTACH = { model: 'prop_npc_phone_02', bone: 28422, px: 0.0, py: 0.0, pz: 0.0, rx: 0, ry: 0, rz: 0 };
function startPhoneHold() {
    const me = mp.players.local;
    if (phoneProp) stopPhoneHold(); // never stack a second phone
    const modelHash = mp.game.joaat(PHONE_ATTACH.model);
    try { mp.game.streaming.requestAnimDict(PHONE_ANIM.dict); } catch (e) {}
    try { mp.game.streaming.requestModel(modelHash); } catch (e) {}
    let animPlayed = false, attached = false, tries = 0;
    if (phoneHoldTimer) clearInterval(phoneHoldTimer);
    phoneHoldTimer = setInterval(() => {
        tries++;
        if (!animPlayed && mp.game.streaming.hasAnimDictLoaded(PHONE_ANIM.dict)) {
            // flag 49 = looping + upper-body + secondary, so it's a steady hold and you can still move.
            try { me.taskPlayAnim(PHONE_ANIM.dict, PHONE_ANIM.name, 4.0, -4.0, -1, 49, 0, false, false, false); animPlayed = true; } catch (e) {}
        }
        if (!phoneProp && mp.game.streaming.hasModelLoaded(modelHash)) {
            const c = me.position;
            let obj = 0;
            try { obj = mp.game.object.createObject(modelHash, c.x, c.y, c.z, false, false, false); } catch (e) {}
            phoneProp = obj || null; // claim it immediately so a failed attach can't spawn more phones
            // Kill physics so the free object can't fall/roll before we attach it next tick.
            // These entity helpers aren't exposed in this build, so call the natives via invoke.
            if (obj) {
                try { mp.game.invoke('0x1A9205C1B9EE827F', obj, false, false); } catch (e) {} // SET_ENTITY_COLLISION
                try { mp.game.invoke('0x428CA6DBD1094446', obj, true); } catch (e) {}         // FREEZE_ENTITY_POSITION
            }
        }
        // Attach on a LATER tick than creation: a just-created object isn't registered in the
        // world the same frame, so a same-frame attach silently no-ops and the phone falls.
        // `else if` guarantees this branch can't run on the same iteration that created the prop.
        else if (phoneProp && !attached) {
            try {
                // mp.game.ped.getPedBoneIndex doesn't exist in this RAGE:MP build — call the native
                // GET_PED_BONE_INDEX (0x3F428D08BE5AAE31) directly, which converts a bone TAG to its INDEX.
                const bone = mp.game.invoke('0x3F428D08BE5AAE31', me.handle, PHONE_ATTACH.bone);
                // freeze must be off for an entity to be attached, otherwise the attach is ignored.
                try { mp.game.invoke('0x428CA6DBD1094446', phoneProp, false); } catch (e) {} // FREEZE_ENTITY_POSITION off
                // ATTACH_ENTITY_TO_ENTITY. args after rotation: p9, useSoftPinning, collision, isPed, vertexIndex, fixedRot.
                mp.game.invoke('0x6B9BBD38AB0796DF', phoneProp, me.handle, bone,
                    PHONE_ATTACH.px, PHONE_ATTACH.py, PHONE_ATTACH.pz, PHONE_ATTACH.rx, PHONE_ATTACH.ry, PHONE_ATTACH.rz,
                    true, false, false, false, 2, true);
                attached = true;
            } catch (e) {}
        }
        if ((animPlayed && attached) || tries > 60) {
            clearInterval(phoneHoldTimer); phoneHoldTimer = null;
            try { mp.game.streaming.setModelAsNoLongerNeeded(modelHash); } catch (e) {}
        }
    }, 50);
}
function stopPhoneHold() {
    const me = mp.players.local;
    if (phoneHoldTimer) { clearInterval(phoneHoldTimer); phoneHoldTimer = null; }
    try { me.stopAnimTask(PHONE_ANIM.dict, PHONE_ANIM.name, 3.0); } catch (e) {}
    if (phoneProp) {
        // Detach first, then let the RAGE:MP wrapper delete it. Do NOT call the raw DELETE_OBJECT
        // native via invoke: it takes an Object* pointer, and passing a bare handle crashes the game.
        try { mp.game.invoke('0x961AC54BF0613F5D', phoneProp, true, true); } catch (e) {} // DETACH_ENTITY
        try { mp.game.invoke('0xAD738C3085FE7E11', phoneProp, true, true); } catch (e) {}  // SET_ENTITY_AS_MISSION_ENTITY
        try { mp.game.object.deleteObject(phoneProp); } catch (e) {}
        phoneProp = null;
    }
}
function setPhone(out) {
    if (out === phoneOut) return;
    phoneOut = out;
    if (out) {
        startPhoneHold();
        try { mp.events.callRemote('phone:taken'); } catch (e) {} // local RP action for nearby players
        if (!phoneBrowser) { phoneBrowser = mp.browsers.new('package://ui/phone/index.html'); mp.gui.cursor.show(true, true); }
    } else {
        stopPhoneHold();
        try { mp.events.callRemote('phone:stowed'); } catch (e) {} // local RP action for nearby players
        if (phoneBrowser) { phoneBrowser.destroy(); phoneBrowser = null; suppressPauseUntil = Date.now() + 1500; blockPauseControls(); mp.gui.cursor.show(false, false); }
    }
}
function anyModalOpen() {
    return Boolean(chatting || adminBrowser || inventoryBrowser || vehicleMenuBrowser || shopBrowser || clothingBrowser || barberBrowser || tattooBrowser || cityhallBrowser || housesBrowser || directorBrowser || bankBrowser || fuelUIOpen || parkingBrowser || carshopBrowser || cardetailBrowser || cartuningBrowser || parkEditing);
}
bindKey(0x26, true, () => { if (!anyModalOpen() && !parkEditing) setPhone(true); });  // Up arrow — open phone
bindKey(0x28, true, () => { if (!chatting && !parkEditing) setPhone(false); });        // Down arrow — close phone

mp.events.add('phone:ui:ready', () => {
    mp.events.callRemote('phone:request');
    if (currentCall && phoneBrowser) phoneBrowser.execute('window.setPhoneCall(' + JSON.stringify(currentCall) + ')');
});
mp.events.add('phone:state', (json) => { if (phoneBrowser) phoneBrowser.execute('window.setPhoneState(' + json + ')'); });
mp.events.add('phone:ui:bankTransfer', (number, amount) => mp.events.callRemote('phone:bankTransfer', String(number), Number(amount)));
mp.events.add('phone:ui:contactAdd', (name, number) => mp.events.callRemote('phone:contactAdd', String(name), String(number)));
mp.events.add('phone:ui:contactDelete', (index) => mp.events.callRemote('phone:contactDelete', Number(index)));
mp.events.add('phone:ui:call', (number) => mp.events.callRemote('phone:call', String(number)));
mp.events.add('phone:ui:car', (action) => mp.events.callRemote('phone:car', String(action)));
mp.events.add('phone:ui:locate', (x, y) => { try { mp.game.ui.setNewWaypoint(Number(x), Number(y)); notify('მანქანა მონიშნულია რუკაზე.'); } catch (e) {} });
mp.events.add('phone:ui:close', () => setPhone(false));

// ---- Voice calls ----
let currentCall = null; // { state, name, number, reason }
function pushCall(data) {
    currentCall = (data && data.state && data.state !== 'ended') ? data : null;
    if (phoneBrowser) phoneBrowser.execute('window.setPhoneCall(' + JSON.stringify(data) + ')');
}
mp.events.add('call:incoming', (name, number) => { pushCall({ state: 'incoming', name, number }); if (!phoneBrowser) setPhone(true); });
mp.events.add('call:ringing', (name, number) => { pushCall({ state: 'ringing', name, number }); });
mp.events.add('call:connected', (name) => { pushCall({ state: 'connected', name }); });
mp.events.add('call:ended', (reason) => { pushCall({ state: 'ended', reason }); });
mp.events.add('call:failed', (reason) => { pushCall({ state: 'ended', reason }); });
// Make the call partner audible at full volume regardless of distance (non-spatial) during the call.
mp.events.add('call:voice', (remoteId, on) => {
    const peer = mp.players.atRemoteId(Number(remoteId));
    if (!peer) return;
    try { peer.voiceAutoVolume = !on; if (on) peer.voiceVolume = 1.0; } catch (e) {}
});
mp.events.add('phone:ui:callAccept', () => mp.events.callRemote('call:accept'));
mp.events.add('phone:ui:callDecline', () => mp.events.callRemote('call:decline'));
mp.events.add('phone:ui:callHangup', () => mp.events.callRemote('call:hangup'));

// ---------- Kill GTA's ambient life (empty server: no traffic, no ambient peds/gunfights, no sirens) ----------
// The density "this frame" natives must be re-applied every frame; the toggles are refreshed on a timer.
mp.events.add('render', () => {
    const veh = mp.game.vehicle, ped = mp.game.ped;
    try { ped.setPedDensityMultiplierThisFrame(0.0); } catch (e) {}
    try { ped.setScenarioPedDensityMultiplierThisFrame(0.0, 0.0); } catch (e) {}
    try { veh.setVehicleDensityMultiplierThisFrame(0.0); } catch (e) {}
    try { veh.setRandomVehicleDensityMultiplierThisFrame(0.0); } catch (e) {}
    try { veh.setParkedVehicleDensityMultiplierThisFrame(0.0); } catch (e) {}
});
function suppressAmbient() {
    const veh = mp.game.vehicle, ped = mp.game.ped, gp = mp.game.gameplay, player = mp.game.player;
    try { ped.setCreateRandomCops(false); } catch (e) {}
    try { ped.setCreateRandomCopsNotOnScenarios(false); } catch (e) {}
    try { ped.setCreateRandomCopsOnScenarios(false); } catch (e) {}
    try { ped.setPedPopulationBudget(0); } catch (e) {}
    try { veh.setVehiclePopulationBudget(0); } catch (e) {}
    try { veh.setRandomTrains(false); } catch (e) {}
    try { veh.setRandomBoats(false); } catch (e) {}
    try { veh.setGarbageTrucks(false); } catch (e) {}
    try { veh.setDistantCarsEnabled(false); } catch (e) {}
    // No police at all: zero wanted level + disable every dispatch service (ambient cop cars/sirens).
    try { player.setMaxWantedLevel(0); } catch (e) {}
    try { player.setPoliceIgnorePlayer(mp.players.local.handle, true); } catch (e) {}
    try { for (let type = 1; type <= 15; type++) gp.enableDispatchService(type, false); } catch (e) {}
    try { mp.game.audio.setAudioFlag('PoliceScannerDisabled', true); } catch (e) {}
}
mp.events.add('playerReady', suppressAmbient);
setInterval(suppressAmbient, 5000);
suppressAmbient();

// ---------- CEF bank / ATM ----------
let bankBrowser = null;
function openBankUI() {
    if (bankBrowser || chatting || adminBrowser || fuelUIOpen || vehicleMenuBrowser || inventoryBrowser || shopBrowser || clothingBrowser || barberBrowser || tattooBrowser || cityhallBrowser || housesBrowser || directorBrowser) return;
    bankBrowser = mp.browsers.new('package://ui/bank/index.html');
    mp.gui.cursor.show(true, true);
}
function closeBankUI() {
    if (!bankBrowser) return;
    suppressPauseUntil = Date.now() + 1500;
    blockPauseControls();
    bankBrowser.destroy();
    bankBrowser = null;
    mp.gui.cursor.show(false, false);
}
mp.events.add('bank:ui:ready', () => mp.events.callRemote('bank:request'));
mp.events.add('bank:data', (json) => { if (bankBrowser) bankBrowser.execute('window.setBankData(' + json + ')'); });
mp.events.add('bank:ui:deposit', (amount) => mp.events.callRemote('bank:deposit', Number(amount)));
mp.events.add('bank:ui:withdraw', (amount) => mp.events.callRemote('bank:withdraw', Number(amount)));
mp.events.add('bank:ui:transfer', (target, amount) => mp.events.callRemote('bank:transfer', String(target), Number(amount)));
mp.events.add('bank:ui:close', closeBankUI);

function sendVehicleMenuState() {
    const vehicle = vehicleMenuVehicle;
    if (!vehicleMenuBrowser || !vehicle) return;
    if (!mp.vehicles.exists(vehicle)) {
        closeVehicleMenu();
        return;
    }
    const bodyHealth = typeof vehicle.getBodyHealth === 'function' ? vehicle.getBodyHealth() : 1000;
    const healthPct = Math.max(0, Math.min(100, Math.round(bodyHealth / 10)));
    const fuelLiters = Math.round((getFuel(vehicle) / CFG.fuelMax) * CFG.tankLiters);
    const maxFuelLiters = CFG.tankLiters;
    const isLocked = (typeof vehicle.getDoorLockStatus === 'function') ? (vehicle.getDoorLockStatus() > 1) : false;
    const isEngineRunning = vehicle.getIsEngineRunning() === true;
    const doorsOpen = (typeof vehicle.getDoorAngleRatio === 'function')
        ? (vehicle.getDoorAngleRatio(0) > 0.1 || vehicle.getDoorAngleRatio(1) > 0.1 || vehicle.getDoorAngleRatio(2) > 0.1 || vehicle.getDoorAngleRatio(3) > 0.1)
        : false;
    const trunkOpen = (typeof vehicle.getDoorAngleRatio === 'function')
        ? (vehicle.getDoorAngleRatio(5) > 0.1)
        : false;
    const hoodOpen = (typeof vehicle.getDoorAngleRatio === 'function')
        ? (vehicle.getDoorAngleRatio(4) > 0.1)
        : false;

    vehicleMenuBrowser.execute(`window.setVehicleMenuState(${JSON.stringify({
        engine: isEngineRunning,
        lights: vehicleLightsMode[vehicle.remoteId] || 0,
        belt: seatbeltOn,
        outside: vehicleMenuOutside,
        locked: isLocked,
        doorsOpen: doorsOpen,
        trunkOpen: trunkOpen,
        hoodOpen: hoodOpen,
        fuel: fuelLiters,
        maxFuel: maxFuelLiters,
        health: healthPct,
        passengers: getVehiclePassengers(vehicle),
        owned: localOwnsVehicle(vehicle)
    })})`);
}

// Does the local player own this car? Mirrors server keyOf(): prefers Social Club, then name.
// The in-world ownership tag veh:ownerSc is set server-side by packages/vehicles.
function localOwnsVehicle(vehicle) {
    try {
        const owner = vehicle.getVariable('veh:ownerSc');
        if (!owner) return false;
        const local = String(mp.players.local.socialClub || mp.players.local.name || '');
        return owner === local;
    } catch (e) { return false; }
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

function isLookingAtVehicle(vehicle, cameraPosition, dirX, dirY, dirZ) {
    if (!vehicle || !mp.vehicles.exists(vehicle)) return false;
    const vPos = vehicle.position;
    const toVehX = vPos.x - cameraPosition.x;
    const toVehY = vPos.y - cameraPosition.y;
    const toVehZ = vPos.z - cameraPosition.z;
    const distSq = toVehX * toVehX + toVehY * toVehY + toVehZ * toVehZ;
    if (distSq > 5.5 * 5.5) return false;
    const dist = Math.sqrt(distSq);
    if (dist < 0.1) return true;
    const dot = (toVehX * dirX + toVehY * dirY + toVehZ * dirZ) / dist;
    return dot > 0.92;
}

function aimedVehicle() {
    let cameraPosition, dirX, dirY, dirZ;
    try {
        cameraPosition = getCameraCoord();
        const cameraRotation = getCameraRot();
        const pitch = cameraRotation.x * Math.PI / 180;
        const yaw = cameraRotation.z * Math.PI / 180;
        const distance = 8;
        dirX = -Math.sin(yaw) * Math.cos(pitch);
        dirY = Math.cos(yaw) * Math.cos(pitch);
        dirZ = Math.sin(pitch);
        const rayEnd = new mp.Vector3(
            cameraPosition.x + dirX * distance,
            cameraPosition.y + dirY * distance,
            cameraPosition.z + dirZ * distance
        );
        let hit = mp.raycasting.testPointToPoint(cameraPosition, rayEnd, mp.players.local, 2);
        if (!hit || !hit.entity || hit.entity.type !== 'vehicle') {
            hit = mp.raycasting.testPointToPoint(cameraPosition, rayEnd, mp.players.local, -1);
        }
        const vehicle = hit && hit.entity && hit.entity.type === 'vehicle' ? hit.entity : null;
        if (vehicle && vehicleMenuTargetInRange(vehicle, 5.0)) return vehicle;
    } catch (e) {}

    // Fallback: only if camera is pointing directly towards the car (dot > 0.92, ~23°)
    if (!cameraPosition || dirX === undefined) return null;

    const playerPosition = mp.players.local.position;
    let closestVeh = null;
    let bestDot = 0.92;

    mp.vehicles.forEachInStreamRange(veh => {
        if (!veh || !mp.vehicles.exists(veh) || Number(veh.dimension) !== Number(mp.players.local.dimension)) return;
        const vPos = veh.position;
        const dx = playerPosition.x - vPos.x;
        const dy = playerPosition.y - vPos.y;
        const dz = playerPosition.z - vPos.z;
        const distSq = dx * dx + dy * dy + dz * dz;
        if (distSq > 4.5 * 4.5) return;

        const toVehX = vPos.x - cameraPosition.x;
        const toVehY = vPos.y - cameraPosition.y;
        const toVehZ = vPos.z - cameraPosition.z;
        const camDist = Math.sqrt(toVehX * toVehX + toVehY * toVehY + toVehZ * toVehZ);
        if (camDist < 0.1) return;

        const dot = (toVehX * dirX + toVehY * dirY + toVehZ * dirZ) / camDist;
        if (dot > bestDot) {
            bestDot = dot;
            closestVeh = veh;
        }
    });

    return closestVeh;
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
    else if (action === 'doors') toggleVehicleDoors(true, vehicle);
    else if (action === 'trunk') toggleVehicleTrunk(true, vehicle);
    else if (action === 'hood') toggleVehicleHood(true, vehicle);
    else if (action === 'lock') toggleVehicleLock(true, vehicle);
}

const VALID_VEHICLE_ACTIONS = ['engine', 'lights', 'belt', 'doors', 'trunk', 'hood', 'lock'];

mp.events.add('fuel:uiReady', () => sendFuelData());
mp.events.add('vehicle:menu:ready', sendVehicleMenuState);
mp.events.add('vehicle:menu:close', closeVehicleMenu);
mp.events.add('vehicle:menu:inventory', () => {
    closeVehicleMenu();
    openInventoryUI();
});

// ---- Drive-key management (owner grants/revokes keys from the car menu) ----
mp.events.add('vehicle:menu:keys:request', () => {
    if (vehicleMenuBrowser) mp.events.callRemote('carkeys:request');
});
mp.events.add('vehicle:menu:keys:grant', (targetId) => {
    if (vehicleMenuBrowser) mp.events.callRemote('carkeys:grant', Number(targetId));
});
mp.events.add('vehicle:menu:keys:revoke', (granteeKey) => {
    if (vehicleMenuBrowser) mp.events.callRemote('carkeys:revoke', String(granteeKey));
});
// Server -> UI: the owner's current key holders + nearby grantable players.
mp.events.add('carkeys:data', (json) => {
    if (vehicleMenuBrowser) vehicleMenuBrowser.execute(`window.setKeysData(${json})`);
});
mp.events.add('vehicle:menu:open', vehicleId => {
    const vehicle = pendingVehicleMenuVehicle;
    pendingVehicleMenuVehicle = null;
    if (!vehicle || Number(vehicle.remoteId) !== Number(vehicleId) ||
        mp.players.local.vehicle || !vehicleMenuTargetInRange(vehicle)) return;
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
    if (!vehicleMenuBrowser || !vehicleMenuVehicle || !VALID_VEHICLE_ACTIONS.includes(action)) return;
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
        !VALID_VEHICLE_ACTIONS.includes(action) ||
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
        // Persist the new level + grade right away so a quick reconnect doesn't lose the fill (the
        // periodic report only fires every 10s while driving — easy to miss after filling up).
        lastFuelReport = 0; // bypass the throttle for this immediate report
        try { mp.events.callRemote('vehicle:fuelReport', Math.round(getFuel(veh))); } catch (e) {}
        try { mp.events.callRemote('vehicle:octaneReport', JSON.stringify(octaneByVeh[veh.remoteId] || null)); } catch (e) {}
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
        veh.setEngineOn(true, false, false); // instantly=false → plays the real startup sound (not resume-from-off)
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

// Nearest ground drop (item dropped from an inventory) within pickup range, or null.
const DROP_PICKUP_RANGE = 2.0;
let nearDrop = null; // { id, label }
function findNearDrop() {
    const me = mp.players.local;
    if (me.vehicle) return null;
    const p = me.position;
    let best = null, bestDist = DROP_PICKUP_RANGE;
    mp.objects.forEachInStreamRange(o => {
        const id = o.getVariable('drop:id');
        if (typeof id !== 'number') return;
        const q = o.position;
        const d = Math.hypot(p.x - q.x, p.y - q.y, p.z - q.z);
        if (d <= bestDist) { bestDist = d; best = { id, label: String(o.getVariable('drop:label') || '') }; }
    });
    return best;
}

// Nearest revivable (downed, still inside the 30s window) player on foot — for the "press E to
// revive" prompt. The server re-checks range, the medkit and the window when we actually press E.
const REVIVE_RANGE = 2.5;
function findNearDowned() {
    const me = mp.players.local;
    if (me.vehicle || Number(me.getHealth()) <= 0) return null; // can't revive from a car or while downed yourself
    if (me.getVariable('medic:duty') !== true) return null;      // only on-duty medics can revive
    const p = me.position;
    let best = null, bestDist = REVIVE_RANGE;
    mp.players.forEachInStreamRange(o => {
        if (o === me || o.getVariable('reviveOpen') !== true) return;
        const q = o.position;
        const d = Math.hypot(p.x - q.x, p.y - q.y, p.z - q.z);
        if (d <= bestDist) { bestDist = d; best = o; }
    });
    return best;
}

bindKey(0x45, false, () => { // E — refuel (in vehicle), pick up a dropped item, or open shop (on foot)
    if (chatting || adminBrowser || inventoryBrowser || vehicleMenuBrowser || shopBrowser || clothingBrowser || barberBrowser || tattooBrowser || cityhallBrowser || housesBrowser || parkingBrowser || parkEditing) return;
    if (fuelUIOpen) return;
    const downedTarget = findNearDowned();
    if (downedTarget) { mp.events.callRemote('hospital:revive:attempt', downedTarget.remoteId); return; } // needs a medkit (server checks)
    if (demorganDigNear()) { if (demorganDigCooldown(mp.players.local.getVariable('demorgan:dig')) <= 0) mp.events.callRemote('demorgan:dig:start'); return; }
    const house = nearestHouseAction(mp.players.local);
    if (house) { mp.events.callRemote(house.event, house.id); return; }
    if (canTuneHere()) { mp.events.callRemote('cartuning:tryOpen'); return; } // E opens the tuning panel at a garage
    if (eligibleToRefuel(mp.players.local.vehicle)) { openFuelUI(); return; }
    const drop = findNearDrop();
    if (drop) { mp.events.callRemote('inventory:pickup', drop.id); return; }
    if (parkNearby) { openParkingUI(); return; } // stand in a parking slot, press E to rent/park
    if (!mp.players.local.vehicle) {
        const cityhall = nearestCityhallMode(mp.players.local.position);
        if (cityhall) { mp.events.callRemote(CITYHALL_MODES[cityhall].event, ...(CITYHALL_MODES[cityhall].args || [])); return; }
        const mode = nearestShopMode(mp.players.local.position);
        if (mode === 'clothing') openClothingUI();
        else if (mode === 'barber') requestBarberUI();
        else if (mode === 'tattoo') requestTattooUI();
        else if (mode === 'atm') openBankUI();
        else if (mode) openShopUI(mode);
    }
});
bindKey(0x1B, true, () => { // Esc closes chat input or an open modal
    if (chatting) { closeChat(); return; }
    if (adminBrowser) closeAdminPanel(true);
    else if (fuelUIOpen) closeFuelUI();
    else if (shopBrowser) closeShopUI();               // closes shop + its paired inventory
    else if (clothingBrowser) closeClothingUI();
    else if (barberBrowser) closeBarberUI();
    else if (tattooBrowser) closeTattooUI();
    else if (cityhallBrowser) closeCityhallUI();
    else if (housesBrowser) closeHousesUI();
    else if (directorBrowser) closeDirector();
    else if (bankBrowser) closeBankUI();
    else if (parkingBrowser) closeParkingUI();
    else if (parkEditing) parkEditConfirm = !parkEditConfirm; // Esc toggles the save/discard prompt
    else if (phoneBrowser) setPhone(false);
    else if (inventoryBrowser) closeInventoryUI();
    else if (vehicleMenuBrowser) closeVehicleMenu();
});

// "Press E to shop" prompt when on foot at an Ammu-Nation / 24-7 marker.
mp.events.add('render', () => {
    if (shopBrowser || clothingBrowser || barberBrowser || tattooBrowser || cityhallBrowser || housesBrowser || bankBrowser || fuelUIOpen || chatting || adminBrowser || inventoryBrowser || vehicleMenuBrowser) return;
    const house = nearestHouseAction(mp.players.local);
    if (house) {
        mp.game.graphics.drawText(worldText('Press E  (' + house.prompt + ')'), [0.5, 0.86], {
            font: 4, color: [255, 255, 255, 220], outline: true, centre: true, scale: [0.45, 0.45]
        });
        return;
    }
    if (mp.players.local.vehicle) return;
    const cityhall = nearestCityhallMode(mp.players.local.position);
    if (cityhall) {
        mp.game.graphics.drawText(worldText('Press E  (' + CITYHALL_MODES[cityhall].prompt + ')'), [0.5, 0.86], {
            font: 4, color: [255, 255, 255, 220], outline: true, centre: true, scale: [0.45, 0.45]
        });
        return;
    }
    const mode = nearestShopMode(mp.players.local.position);
    if (!mode) return;
    const label = mode === 'weapons' ? 'Ammu-Nation' : mode === 'clothing' ? 'Clothing Store' : mode === 'barber' ? 'Barber Shop' : mode === 'tattoo' ? 'Tattoo Salon' : mode === 'atm' ? 'ATM' : '24/7 Market';
    const prompt = mode === 'atm' ? 'Press E for ATM' : 'Press E to shop  (' + label + ')';
    mp.game.graphics.drawText(prompt, [0.5, 0.86], {
        font: 4, color: [255, 255, 255, 220], outline: true, centre: true, scale: [0.45, 0.45]
    });
});
// Weapons are equipped from the inventory (I), so GTA's own weapon wheel (TAB) and mouse-wheel
// weapon cycling are disabled — on foot and in vehicles.
const WEAPON_SWITCH_CONTROLS = [
    12, 13, 14, 15, 16, 17, // WEAPON_WHEEL_UD/LR/NEXT/PREV, SELECT_NEXT/PREV_WEAPON
    37,                     // SELECT_WEAPON (TAB wheel)
    99, 100, 115, 116,      // VEH_SELECT_NEXT/PREV_WEAPON, VEH_FLY_SELECT_NEXT/PREV_WEAPON
    261, 262                // PREV/NEXT_WEAPON (mouse scroll)
];
const WEAPON_UNARMED = mp.game.joaat('weapon_unarmed');
const WEAPON_GROUP_MELEE = 0xD49321D4;
const WEAPON_GROUP_UNARMED = 0xA00FC1E4;
const GUN_MELEE_CONTROLS = [140, 141, 142, 263, 264]; // MELEE_ATTACK_LIGHT/HEAVY/ALTERNATE, MELEE_ATTACK1/2

// Hide GTA's health/armour bars under the minimap (the bottom-right stats panel replaces them).
// The minimap scaleform must be told every frame; SETUP_HEALTH_ARMOUR type 3 = hidden.
const minimapScaleform = mp.game.graphics.requestScaleformMovie('minimap');
function hideMinimapHealthArmour() {
    const g = mp.game.graphics;
    if (typeof g.beginScaleformMovieMethod === 'function') {
        g.beginScaleformMovieMethod(minimapScaleform, 'SETUP_HEALTH_ARMOUR');
        g.scaleformMovieMethodAddParamInt(3);
        g.endScaleformMovieMethod();
    } else {
        g.pushScaleformMovieFunction(minimapScaleform, 'SETUP_HEALTH_ARMOUR');
        g.pushScaleformMovieFunctionParameterInt(3);
        g.popScaleformMovieFunctionVoid();
    }
}
let lastAmmoText = '';
let heldSwitchLocked = false; // weapon switching locked while the equipped gun is in hand
let lastHeldRegive = 0;
let lastAmmoReport = { model: null, rounds: -1 }; // last equipped-gun ammo sent to the server
let lastClip = { hash: 0, clip: -1 }; // for the low-ammo warning beep
// Z toggles GTA's big minimap (SET_BIGMAP_ACTIVE) — press again to shrink back.
let bigMinimap = false;
bindKey(0x5A, false, () => { // Z
    if (anyModalOpen()) return;
    bigMinimap = !bigMinimap;
    try { mp.game.ui.setBigmapActive(bigMinimap, false); } catch (e) {}
});

mp.events.add('render', () => {
    for (const control of WEAPON_SWITCH_CONTROLS) mp.game.controls.disableControlAction(0, control, true);
    mp.game.ui.hideHudComponentThisFrame(19); // HUD_WEAPON_WHEEL
    mp.game.ui.hideHudComponentThisFrame(20); // HUD_WEAPON_WHEEL_STATS
    mp.game.ui.hideHudComponentThisFrame(2);  // HUD_WEAPON_ICON (top-right ammo counter)
    try { hideMinimapHealthArmour(); } catch (e) {}

    // While aiming a gun on foot: "magazine / reserve" ammo chip under the crosshair (HUD page).
    // Only pushed to the browser when the value changes.
    let ammoText = '';
    const me = mp.players.local;

    // The gun equipped from the quick bar stays in hand when its ammo runs out (GTA would auto-switch
    // to fists). Server sets 'inv:held' = weapon model while equipped, null when holstered.
    // Pistols can be re-selected when empty, but GTA auto-holsters an empty rifle and refuses to
    // re-select it — so while the gun is in hand we also forbid weapon switching, and if it still got
    // put away we give it back locally with 0 ammo (no free rounds) and equip it.
    const heldModel = me.getVariable('inv:held');
    try {
        if (heldModel && !me.vehicle && me.getHealth() > 0) {
            const want = mp.game.joaat(heldModel);
            // Report the equipped gun's ammo to the server on every change (read by weapon hash, so it
            // works even in the frame GTA holsters the empty gun). Server only accepts decreases.
            const rounds = Number(me.getAmmoInWeapon(want)) || 0;
            if (heldModel !== lastAmmoReport.model || rounds !== lastAmmoReport.rounds) {
                if (heldModel === lastAmmoReport.model) mp.events.callRemote('inventory:ammoReport', rounds);
                lastAmmoReport = { model: heldModel, rounds };
            }
            if ((me.getSelectedWeapon() >>> 0) === (want >>> 0)) {
                if (!heldSwitchLocked) { mp.game.invoke('0xED7F7EFE9FABF340', me.handle, false); heldSwitchLocked = true; } // SET_PED_CAN_SWITCH_WEAPON
            } else {
                if (heldSwitchLocked) { mp.game.invoke('0xED7F7EFE9FABF340', me.handle, true); heldSwitchLocked = false; }
                mp.game.invoke('0xADF692B254977C0C', me.handle, want, true); // SET_CURRENT_PED_WEAPON
                if (Date.now() - lastHeldRegive > 500 && (me.getSelectedWeapon() >>> 0) !== (want >>> 0)) {
                    lastHeldRegive = Date.now();
                    mp.game.invoke('0xBF0FD6E56C964FCB', me.handle, want, 0, false, true); // GIVE_WEAPON_TO_PED, 0 ammo, equip now
                }
            }
        } else if (heldSwitchLocked) {
            mp.game.invoke('0xED7F7EFE9FABF340', me.handle, true);
            heldSwitchLocked = false;
        }
    } catch (e) {}

    // Holding a gun on foot: block pistol-whip melee (R near a ped; R still reloads — control 45),
    // beep on low magazine (aiming or not), and show the ammo chip while aiming.
    if (!me.vehicle) {
        try {
            const hash = me.getSelectedWeapon() >>> 0;
            const group = hash ? mp.game.weapon.getWeapontypeGroup(hash) >>> 0 : 0;
            if (hash && hash !== (WEAPON_UNARMED >>> 0) && group !== WEAPON_GROUP_MELEE && group !== WEAPON_GROUP_UNARMED) {
                for (const control of GUN_MELEE_CONTROLS) mp.game.controls.disableControlAction(0, control, true);
                const total = Number(me.getAmmoInWeapon(hash)) || 0;
                const clip = Math.min(total, Number(me.getAmmoInClip(hash)) || 0);
                // Warning beep on each shot that leaves fewer than 5 rounds in the magazine
                // (not on reload, weapon switch, or first drawing an already-low gun).
                if (lastClip.hash === hash && clip < lastClip.clip && clip < 5) {
                    mp.game.audio.playSoundFrontend(-1, 'Beep_Red', 'DLC_HEIST_HACKING_SNAKE_SOUNDS', true);
                }
                lastClip = { hash, clip };
                if (mp.game.player.isFreeAiming()) ammoText = JSON.stringify({ clip, reserve: total - clip });
            } else lastClip = { hash: 0, clip: -1 };
        } catch (e) {}
    }
    if (ammoText !== lastAmmoText) {
        lastAmmoText = ammoText;
        if (hudBrowser) hudBrowser.execute(`window.hudAmmo(${ammoText || 'null'})`);
    }
});

// 1-4: use/equip the item in that inventory quick slot (on foot only — 2 is the engine key in a vehicle).
[0x31, 0x32, 0x33, 0x34].forEach((key, index) => bindKey(key, false, () => {
    if (chatting || adminBrowser || fuelUIOpen || inventoryBrowser || vehicleMenuBrowser || shopBrowser) return;
    if (mp.players.local.vehicle) return;
    mp.events.callRemote('inventory:useQuick', index);
}));

bindKey(0x49, false, () => { // I - inventory
    if (chatting || vehicleMenuBrowser || cityhallBrowser || housesBrowser) return; // City Hall form has text inputs
    if (inventoryBrowser) closeInventoryUI();
    else if (!adminBrowser && !fuelUIOpen) openInventoryUI();
});
bindKey(0x47, false, () => { // G - vehicle interaction menu
    if (chatting || cityhallBrowser || housesBrowser) return;
    if (vehicleMenuBrowser) closeVehicleMenu();
    else if (pendingVehicleMenuVehicle) closeVehicleMenu();
    else if (mp.players.local.vehicle) openVehicleMenu(mp.players.local.vehicle);
    else requestOutsideVehicleMenu();
});
bindKey(0x32, false, () => engineToggle());                    // 2 - engine on/off

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
    if (anyModalOpen()) return; // don't open chat while the phone or any menu is up
    if (Number(mp.players.local.getHealth()) <= 0) return; // downed: can't write
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
bindKey(0x54, false, openChat); // T - open custom chat input

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

bindKey(0x42, true, () => {  // B held -> talk
    if (voiceBanned || chatting || adminBrowser || fuelUIOpen || inventoryBrowser || vehicleMenuBrowser || cityhallBrowser || housesBrowser) return;
    if (Number(mp.players.local.getHealth()) <= 0) return; // downed: can't speak
    voiceTalking = true;
    if (mp.voiceChat) mp.voiceChat.muted = false;
});
bindKey(0x42, false, () => { // B released -> stop talking
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

bindKey(0x4A, false, toggleSeatbelt); // J - seatbelt

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

bindKey(0x4C, false, closeVehicleDoors); // L - close all doors
bindKey(0x48, false, toggleVehicleLights); // H - toggle lights

// ---------- Drift mode (NumLock) ----------
// RAGE:MP has no runtime handling native, so "drift mode" uses SET_VEHICLE_REDUCE_GRIP plus
// SET_VEHICLE_REDUCE_GRIP_LEVEL to dial HOW loose it is (lower level = grippier, less slippery).
// NumLock toggles it on the car you're driving, and it resets when you get out. (A manual gearbox
// isn't possible here: RAGE:MP exposes no set-gear native and rejects SET_VEHICLE_HIGH_GEAR.)
const REDUCE_GRIP = '0x222FF6A823D122E2';        // SET_VEHICLE_REDUCE_GRIP(vehicle, toggle)
const REDUCE_GRIP_LEVEL = '0x7D6F9A3EF26136A0';  // SET_VEHICLE_REDUCE_GRIP_LEVEL(vehicle, float)
const DRIFT_GRIP_LEVEL = 0.4;                    // default: lower = more grip; 0.5 = barely loose … 2.5 = ice
// Per-car drift grip overrides (model hash -> level). Lower = more grip; 0.0 is the documented floor.
// M8 is pushed slightly NEGATIVE to attempt extra over-grip (if the native clamps, it behaves as 0.0).
const DRIFT_GRIP_BY_MODEL = { [mp.game.joaat('mansm8c') >>> 0]: -0.5 };

let driftMode = false;

function localDriving() {
    const veh = mp.players.local.vehicle;
    if (!veh) return null;
    try { if (veh.getPedInSeat(-1) !== mp.players.local.handle) return null; } catch (e) { return null; }
    return veh;
}
function driftLevelFor(veh) {
    const override = DRIFT_GRIP_BY_MODEL[veh.model >>> 0];
    return override !== undefined ? override : DRIFT_GRIP_LEVEL;
}
function applyDrift(veh) {
    try {
        mp.game.invoke(REDUCE_GRIP, veh.handle, driftMode);
        if (driftMode) mp.game.invoke(REDUCE_GRIP_LEVEL, veh.handle, driftLevelFor(veh));
    } catch (e) {}
}

function toggleDrift() { // driver only; shared by the NumLock key and the /drift command
    const veh = localDriving();
    if (!veh) { notify('ჯერ ჩაჯექი მანქანაში (მძღოლად).'); return; }
    driftMode = !driftMode;
    applyDrift(veh);
    notify(driftMode ? 'დრიფტ რეჟიმი: ჩართული' : 'დრიფტ რეჟიმი: გამორთული');
}
bindKey(0x90, true, () => { // NumLock — toggle drift mode
    if (chatting || anyModalOpen()) return;
    toggleDrift();
});
mp.events.add('drift:toggle', toggleDrift); // /drift command (no keybind needed)

// Every car starts in normal grip — drift is opt-in per drive.
mp.events.add('playerEnterVehicle', () => {
    const veh = localDriving();
    if (!veh) return;
    driftMode = false;
    applyDrift(veh); // SET_VEHICLE_REDUCE_GRIP(veh, false) — force grip back on
});

mp.events.add('playerLeaveVehicle', vehicle => { // reset per-car states on exit
    closeVehicleMenu();
    if (vehicle) {
        vehicle.setLights(0);
        delete vehicleLightsMode[vehicle.remoteId];
        try { mp.game.invoke(REDUCE_GRIP, vehicle.handle, false); } catch (e) {}
    }
    odoFlush(); // persist the last stretch of mileage
    driftMode = false;
    lcArmStart = 0; lcArmed = false; lcBoosting = false; // reset launch control
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
    const modalOpen = Boolean(adminBrowser || fuelUIOpen || inventoryBrowser || vehicleMenuBrowser || shopBrowser || clothingBrowser || barberBrowser || tattooBrowser || cityhallBrowser || housesBrowser || directorBrowser || bankBrowser || phoneBrowser || parkingBrowser || carshopBrowser || cardetailBrowser || cartuningBrowser);
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
        let targetVehData = null;
        if (!chatting && !adminBrowser && !inventoryBrowser) {
            const target = aimedVehicle();
            if (target && mp.vehicles.exists(target)) {
                const bodyHealth = typeof target.getBodyHealth === 'function' ? target.getBodyHealth() : 1000;
                const healthPct = Math.max(0, Math.min(100, Math.round(bodyHealth / 10)));
                const fuelLiters = Math.round((getFuel(target) / CFG.fuelMax) * CFG.tankLiters);
                const maxFuelLiters = CFG.tankLiters;
                const isLocked = (typeof target.getDoorLockStatus === 'function') ? (target.getDoorLockStatus() > 1) : false;
                const isEngineRunning = target.getIsEngineRunning() === true;
                targetVehData = {
                    fuel: fuelLiters,
                    maxFuel: maxFuelLiters,
                    health: healthPct,
                    locked: isLocked,
                    engine: isEngineRunning
                };
            }
        }
        payload = {
            money: getMoney(),
            inVehicle: false,
            targetVehicle: targetVehData,
            vehicleMenuOpen: Boolean(vehicleMenuBrowser)
        };
    } else {
        const speed = speedOf(veh);

        // --- Live Cars-tab tuning: launch kick + hard max-speed ceiling ---
        // A tuned car gets (a) a short burst of extra acceleration when pulling away from a stop (a peppy
        // launch, then normal driving) and/or (b) a hard top-speed ceiling. The cap is a pure ceiling: the
        // car accelerates normally and horizontal velocity is only clamped if it ever exceeds the cap (e.g.
        // downhill). Vertical velocity is left alone. Stock (untuned) cars are untouched.
        const tune = modelTune(veh);
        if (tune.topMult > 0 || tune.kick > 1) {
            let isDriver = true;
            try { isDriver = veh.getPedInSeat(-1) === mp.players.local.handle; } catch (e) {}
            if (isDriver) {
                // (a) launch kick — fire a brief power burst when flooring it away from a near-stop.
                if (tune.kick > 1) {
                    if (speed > 8) launchArmed = true; // moving well (~29 km/h) → re-arm for the next launch
                    if (launchArmed && !lcBoosting && speed < 3 && now >= launchKickUntil &&
                        mp.game.controls.isControlPressed(0, 71)) {
                        launchKickUntil = now + LAUNCH_KICK_MS;
                        launchArmed = false;
                    }
                    if (launchKickUntil) {
                        if (now < launchKickUntil) {
                            try { veh.setEnginePowerMultiplier(octaneProfile(veh).power * tune.power * tune.kick); } catch (e) {}
                        } else { launchKickUntil = 0; applyOctanePower(veh); } // burst over → restore stage power
                    }
                }
                // (b) Realistic acceleration toward the tuned top speed (stock × topMult). We model the
                // car's longitudinal pull like tractive force minus aero drag: STRONG low down, tapering
                // to zero at the top — accel = peak · (1 − (v/vmax)²). This makes the car's extra
                // capability felt across the WHOLE range (every gear), not just near the top. Applied
                // only while the throttle is held, and we only ever speed the car UP toward the model —
                // braking, coasting, steering and collisions stay native. The only reduction is the hard
                // ceiling clamp at vmax (e.g. overshoot downhill).
                if (tune.topMult > 0) {
                    let base = baseMaxSpeedByVeh[veh.remoteId];
                    if (base === undefined) {
                        base = mp.game.vehicle.getEstimatedMaxSpeed(veh.handle);
                        if (base > 0) baseMaxSpeedByVeh[veh.remoteId] = base;
                    }
                    const capMs = base * tune.topMult;                    // tuned top speed (m/s)
                    const velocity = veh.getVelocity();
                    const horizontal = Math.sqrt(velocity.x * velocity.x + velocity.y * velocity.y);
                    if (horizontal > 0.01) {
                        let desired = horizontal;
                        if (horizontal > capMs) {
                            desired = capMs;                              // hard ceiling: never exceed
                        } else if (mp.game.controls.isControlPressed(0, 71)) { // flooring it
                            const frac = horizontal / capMs;             // 0 at rest → 1 at top speed
                            const accel = ACCEL_PEAK * tune.power * (1 - frac * frac); // real-car taper
                            desired = Math.min(capMs, horizontal + accel * dt);
                        }
                        if (desired !== horizontal) {
                            const scale = desired / horizontal;
                            const vx = velocity.x * scale, vy = velocity.y * scale;
                            try { mp.game.entity.setEntityVelocity(veh.handle, vx, vy, velocity.z); }
                            catch (e) { try { mp.game.invoke('0x1C99BB7B6E96D16F', veh.handle, vx, vy, velocity.z); } catch (e2) {} } // SET_ENTITY_VELOCITY
                        }
                    }
                }
            }
        }

        const rpm = (typeof veh.rpm === 'number') ? Math.max(0, veh.rpm) : 0;
        const gear = (typeof veh.gear === 'number') ? veh.gear : 0;
        let engineOn = veh.getIsEngineRunning() === true;
        let fuel = getFuel(veh);

        if (engineOn && fuel > 0) {
            const eff = octaneProfile(veh).eff;
            fuel = addFuel(veh, -(CFG.fuelIdleDrain + CFG.fuelDriveDrain * rpm) * eff * dt);
            if (fuel <= 0) { veh.setEngineOn(false, true, true); engineOn = false; }
        }
        reportFuelWhileDriving(veh, now); // persist fuel server-side so it survives relogs/restarts

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
        const km = odoTrack(veh, speed, dt, now);
        const launch = launchControl(veh, speed, now); // 0 off · 1 armed · 2 launching
        // GTA's real rpm stays low while holding the brake at a standstill, so the tachometer would top out
        // around 5. While launch control is armed/launching, show the revs it would really be at: near
        // the limiter when armed (slight flutter), easing down from there during the launch boost.
        let shownRpm = rpm;
        if (launch === 1) shownRpm = Math.max(rpm, 0.93 + Math.random() * 0.05);
        else if (launch === 2) shownRpm = Math.max(rpm, 0.85 + 0.1 * Math.max(0, Math.min(1, (lcBoostUntil - now) / LC_BOOST_MS)));
        let engineLevel = -1; try { engineLevel = veh.getMod(11); } catch (e) {} // engine upgrade → tuning stage
        payload = { money: getMoney(), inVehicle: true, kmh: Math.round(speed * 3.6), gear, engineOn, rpm: shownRpm, fuel, octane, refuel,
            drift: driftMode,
            lights: vehicleLightsMode[veh.remoteId] === 1,
            belt: seatbeltOn,
            launch,
            tuning: engineLevel < 0 ? 0 : engineLevel + 1, // 0 = stock, 1..4 = stage
            km: Math.round(km) };
    }

    // character stats (bottom-right panel). RAGE returns 0..100 for the local player; guard against the
    // raw GTA ped scale (100 dead .. 200 full) just in case.
    const me = mp.players.local;
    const rawHealth = Number(me.getHealth()) || 0;
    payload.health = Math.max(0, Math.min(100, rawHealth > 100 ? rawHealth - 100 : rawHealth));
    payload.armour = Math.max(0, Math.min(100, me.getArmour()));
    const hunger = me.getVariable('needs:hunger'), thirst = me.getVariable('needs:thirst');
    payload.hunger = typeof hunger === 'number' ? hunger : 100;
    payload.thirst = typeof thirst === 'number' ? thirst : 100;

    // "press E to pick up" for the nearest ground drop
    nearDrop = (chatting || adminBrowser || inventoryBrowser || shopBrowser) ? null : findNearDrop();
    payload.pickup = nearDrop ? nearDrop.label : null;

    // "press E to revive" when standing over a revivable downed player
    payload.revive = (chatting || adminBrowser || inventoryBrowser || shopBrowser) ? false : !!findNearDowned();

    // voice state (shown regardless of vehicle)
    payload.voiceTalking = voiceTalking;
    payload.voiceBanned = voiceBanned;

    // parking prompt / admin edit help (Georgian → rendered by the CEF HUD, set by the parking render loop)
    payload.parkPrompt = parkHudPrompt;
    payload.parkEdit = parkHudEdit;

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

// (B is push-to-talk voice.) N toggles flight while in admin mode; the server re-checks admin mode.
bindKey(0x4E, false, () => { // N — admin fly on/off
    if (!adminModeEnabled || chatting || anyModalOpen()) return;
    mp.events.callRemote('admin:fly:toggle');
});

bindKey(0x77, false, () => {
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

    // m/s: normal 60, Shift = fast 250, Alt = slow 10 for precise positioning.
    const speed = mp.game.controls.isControlPressed(0, 21) ? 250 : (mp.game.controls.isControlPressed(0, 19) ? 10 : 60);
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

function requestAdminAction(action, id, duration, amount, reason) {
    if (!adminBrowser) return;
    const playerId = Number(id);
    const durationSeconds = Number(duration);
    const moneyAmount = Number(amount);
    if (!Number.isSafeInteger(playerId) || playerId < 0) return;
    mp.events.callRemote('admin:panel:action', JSON.stringify({
        action: String(action),
        id: playerId,
        duration: Number.isSafeInteger(durationSeconds) ? durationSeconds : null,
        amount: Number.isSafeInteger(moneyAmount) ? moneyAmount : null,
        reason: String(reason || '').slice(0, 100)
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
mp.events.add('inventory:uiReady', () => {
    mp.events.callRemote('inventory:request');
    if (inventoryBrowser && pedCam) inventoryBrowser.execute('window.setPedLive && window.setPedLive(true)');
});
mp.events.add('inventory:data', (json) => { if (inventoryBrowser) inventoryBrowser.execute(`window.setInventory(${json})`); });
mp.events.add('inventory:use', (id, index) => mp.events.callRemote('inventory:use', String(id), Number(index)));
mp.events.add('inventory:drop', (id, index, amount) => mp.events.callRemote('inventory:drop', String(id), Number(index), Number(amount) || 0));
mp.events.add('inventory:move', (from, to) => mp.events.callRemote('inventory:move', Number(from), Number(to)));
mp.events.add('inventory:split', (from, to, amount) => mp.events.callRemote('inventory:split', Number(from), Number(to), Number(amount)));
mp.events.add('inventory:unequip', (slot, to) => mp.events.callRemote('inventory:unequip', String(slot), Number(to)));
// Guns carried in the quick bar (not in hand) shown on the character, for every streamed player.
// Server sets 'inv:back' = [{ m: model, k: 'back' | 'hip' | 'hipL' }]. Tune placements here.
const BACK_PLACES = {
    back: [ // SKEL_Spine3 — up to two long guns, slightly apart
        { bone: 24818, pos: [0.075, -0.15, -0.02], rot: [0.0, 165.0, 0.0] },
        { bone: 24818, pos: [0.075, -0.17, 0.10],  rot: [0.0, 195.0, 0.0] }
    ],
    // Thigh bones: z is sideways and mirrored — on BOTH thighs, z toward the body centre is the inside
    // (R thigh: -z = inside, L thigh: +z = inside). Outer hip = L thigh -z / R thigh +z.
    // x along the thigh bone: more negative = higher, toward the waist.
    // Pistol on SKEL_Pelvis (moves with the body, not the leg): x up, y front, +z = left -> right hip is -z.
    hip:  [{ bone: 11816, pos: [0.0, 0.0, -0.24], rot: [90.0, 180.0, 0.0] }], // SKEL_Pelvis, outer right hip, barrel down (pistol)
    hipL: [{ bone: 51826, pos: [-0.04, 0.03, 0.13],  rot: [-90.0, 0.0, 0.0] }], // SKEL_R_Thigh, outer right waist (unused)
    // SKEL_Pelvis: x = up the spine, y = front(+)/back(-), z = sideways. The knife model's length runs
    // along its own Z, so no rotation keeps it horizontal across the lower back (rot y=90 stood it upright).
    belt: [{ bone: 11816, pos: [-0.05, -0.16, 0.11], rot: [180.0, 0.0, 0.0] }] // on the waistband, against the back (+z = left) // x up the back, z sideways (+z = character's left, if not: flip)
};
const backProps = new Map(); // player remoteId -> [objects]
function clearBackWeapons(ped) {
    (backProps.get(ped.remoteId) || []).forEach(o => { if (mp.objects.exists(o)) o.destroy(); });
    backProps.delete(ped.remoteId);
}
function buildBackWeapons(ped) {
    if (!ped || !mp.players.exists(ped)) return;
    clearBackWeapons(ped);
    let list = [];
    try { list = JSON.parse(ped.getVariable('inv:back') || '[]'); } catch (e) {}
    if (!list.length || !ped.handle) return;
    const used = { back: 0, hip: 0, hipL: 0, belt: 0 };
    const objs = [];
    list.forEach(w => {
        const places = BACK_PLACES[w.k] || BACK_PLACES.back;
        const place = places[used[w.k] || 0];
        if (!place) return; // no room left on that spot
        used[w.k] = (used[w.k] || 0) + 1;
        const obj = mp.objects.new(mp.game.joaat(w.m), ped.position, { dimension: ped.dimension });
        objs.push(obj);
        const attach = (tries) => {
            if (!mp.objects.exists(obj) || !mp.players.exists(ped)) return;
            if (!obj.handle || !ped.handle) { if (tries > 0) setTimeout(() => attach(tries - 1), 100); return; }
            obj.attachTo(ped.handle, ped.getBoneIndex(place.bone), ...place.pos, ...place.rot, false, false, false, true, 1, true); // rigid (no soft pinning = no wobble)
        };
        attach(30);
    });
    backProps.set(ped.remoteId, objs);
}
mp.events.addDataHandler('inv:back', (entity) => { if (entity.type === 'player') buildBackWeapons(entity); });
mp.events.add('entityStreamIn', (entity) => { if (entity.type === 'player') buildBackWeapons(entity); });
mp.events.add('entityStreamOut', (entity) => { if (entity.type === 'player') clearBackWeapons(entity); });
mp.events.add('playerQuit', (player) => clearBackWeapons(player));
mp.events.add('playerSpawn', () => setTimeout(() => buildBackWeapons(mp.players.local), 1500)); // respawn resets attachments
mp.events.add('playerSpawn', disableRadioGlobally); // respawn can reset radio control — keep it off

// Ctrl held/released while the inventory is open -> tell the UI (Ctrl+drag = split / drop some).
bindKey(0x11, true, () => { if (inventoryBrowser) inventoryBrowser.execute('window.setCtrl && window.setCtrl(true)'); });
bindKey(0x11, false, () => { if (inventoryBrowser) inventoryBrowser.execute('window.setCtrl && window.setCtrl(false)'); });

// Eat/drink prop in the player's hand while the server-synced animation plays (runs for every nearby client).
// Per-model hand placement (bone id, offset, rotation) matched to the animation each item uses.
const CONSUME_PROPS = {
    prop_ld_flow_bottle: { bone: 18905, pos: [0.12, 0.008, 0.03], rot: [240.0, -60.0, 0.0] }, // SKEL_L_Hand, loop_bottle
    prop_ecola_can:      { bone: 28422, pos: [0.0, 0.0, 0.0],     rot: [0.0, 0.0, 130.0] },   // PH_R_Hand, coffee/can drink
    prop_energy_drink:   { bone: 28422, pos: [0.0, 0.0, 0.0],     rot: [0.0, 0.0, 130.0] },
    prop_cs_burger_01:   { bone: 18905, pos: [0.13, 0.05, 0.02],  rot: [-50.0, 16.0, 60.0] }, // SKEL_L_Hand, eat_burger
    prop_sandwich_01:    { bone: 18905, pos: [0.13, 0.05, 0.02],  rot: [-50.0, 16.0, 60.0] },
    prop_ld_snack_01:    { bone: 60309, pos: [0.0, 0.0, 0.0],     rot: [0.0, 0.0, 0.0] }      // PH_L_Hand, snack bar
};
mp.events.add('inventory:consumeProp', (remoteId, model, kind, ms) => {
    const ped = mp.players.atRemoteId(remoteId);
    const place = CONSUME_PROPS[model];
    if (!ped || !mp.players.exists(ped) || !ped.handle || !place) return;
    const obj = mp.objects.new(mp.game.joaat(model), ped.position, { dimension: ped.dimension });
    const tryAttach = (tries) => {
        if (!mp.objects.exists(obj)) return;
        if (!obj.handle) { if (tries > 0) setTimeout(() => tryAttach(tries - 1), 50); return; } // wait for model stream-in
        // p9, softPinning, collision=false, isPed=true (ped rotation order), vertexIndex=1, fixedRot
        obj.attachTo(ped.handle, ped.getBoneIndex(place.bone), ...place.pos, ...place.rot, true, true, false, true, 1, true);
    };
    tryAttach(20);
    setTimeout(() => { if (mp.objects.exists(obj)) obj.destroy(); }, Number(ms) || 3500);
});

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
// Commands tab: the page asks for the list, the server answers with it; Run sends the typed command.
mp.events.add('admin:panel:commandsRequest', () => {
    if (adminBrowser) mp.events.callRemote('admin:panel:commands');
});
mp.events.add('admin:panel:commands', json => {
    if (adminBrowser) adminBrowser.execute('window.setCommands(' + JSON.stringify(String(json)) + ')');
});
mp.events.add('admin:panel:run', text => {
    if (adminBrowser) mp.events.callRemote('admin:panel:run', String(text));
});
mp.events.add('admin:panel:announce', message => {
    if (adminBrowser) mp.events.callRemote('admin:panel:announce', String(message));
});
// Cars tab: request the car/handling list, save edits, show the result.
mp.events.add('admin:panel:carsRequest', () => {
    if (adminBrowser) mp.events.callRemote('admin:panel:cars');
});
mp.events.add('admin:panel:cars', json => {
    if (adminBrowser) adminBrowser.execute('window.setCars(' + JSON.stringify(String(json)) + ')');
});
mp.events.add('admin:panel:carSave', (pack, handlingName, valuesJson) => {
    if (adminBrowser) mp.events.callRemote('admin:panel:carSave', String(pack), String(handlingName), String(valuesJson));
});
mp.events.add('admin:panel:carResult', msg => {
    if (adminBrowser) adminBrowser.execute('window.setCarResult(' + JSON.stringify(String(msg)) + ')');
});
// Cars tab: live speed multiplier — request the car list, save a multiplier, show the result.
mp.events.add('admin:panel:speedRequest', () => {
    if (adminBrowser) mp.events.callRemote('admin:panel:speed');
});
mp.events.add('admin:panel:speed', json => {
    if (adminBrowser) adminBrowser.execute('window.setSpeedCars(' + JSON.stringify(String(json)) + ')');
});
mp.events.add('admin:panel:speedSave', (model, stage, speed) => {
    if (adminBrowser) mp.events.callRemote('admin:panel:speedSave', String(model), String(stage), Number(speed));
});
mp.events.add('admin:panel:speedResult', msg => {
    if (adminBrowser) adminBrowser.execute('window.setSpeedResult(' + JSON.stringify(String(msg)) + ')');
});

// ===================== Death / timeout screen =====================
// The server (packages/hospital/death.js) puts us into a downed state on death: blur the screen
// over 5s and show a Georgian "timeout" overlay counting down to respawn. A medic/admin can
// revive within the first 30s; otherwise the server respawns us at the hospital when it ends.
// We also pause GTA's own death/arrest restart so the server fully controls respawn timing.
let deathBrowser = null;
let deathCountdownTimer = null;

const DEATH_PAUSE_RESTART = '0x2C2B3493FBF51C71'; // PAUSE_DEATH_ARREST_RESTART(bool)
const DEATH_IGNORE_RESTART = '0x21FFB63D8C615361'; // IGNORE_NEXT_RESTART(bool)
const DEATH_FADE_OUT = '0x4A18E01DF2C87B86';       // SET_FADE_OUT_AFTER_DEATH(bool)
const SCREEN_BLUR_IN = '0xA328A24AAA6B7FDC';       // TRANSITION_TO_BLURRED(float ms)
const SCREEN_BLUR_OUT = '0xEFACC8AEF94430D5';      // TRANSITION_FROM_BLURRED(float ms)

function stopDeathCountdown() {
    if (deathCountdownTimer) { clearInterval(deathCountdownTimer); deathCountdownTimer = null; }
}

mp.events.add('death:begin', (totalMs, blurMs, reviveMs) => {
    if (uiLocked) return; // never blur / show the death screen during onboarding (model-change deaths)
    // Stop GTA's instant auto-respawn/fade so the server owns the timing.
    try { mp.game.invoke(DEATH_FADE_OUT, false); } catch (e) {}
    try { mp.game.invoke(DEATH_PAUSE_RESTART, true); } catch (e) {}
    try { mp.game.invoke(DEATH_IGNORE_RESTART, true); } catch (e) {}
    // Blur the screen over ~5s.
    try { mp.game.invoke(SCREEN_BLUR_IN, Number(blurMs) || 5000); } catch (e) {}

    if (!deathBrowser) deathBrowser = mp.browsers.new('package://ui/death/index.html');

    const endAt = Date.now() + (Number(totalMs) || 0);
    const reviveEndAt = Date.now() + (Number(reviveMs) || 0);
    const push = () => {
        const secondsLeft = Math.max(0, Math.round((endAt - Date.now()) / 1000));
        const canRevive = Date.now() < reviveEndAt;
        if (deathBrowser) deathBrowser.execute('window.setDeath(' + secondsLeft + ',' + canRevive + ')');
    };
    stopDeathCountdown();
    push();
    deathCountdownTimer = setInterval(push, 500);
});

mp.events.add('death:end', () => {
    stopDeathCountdown();
    try { mp.game.invoke(SCREEN_BLUR_OUT, 800); } catch (e) {}
    try { mp.game.invoke(DEATH_PAUSE_RESTART, false); } catch (e) {}
    if (deathBrowser) { deathBrowser.destroy(); deathBrowser = null; }
});

// ===================== Character: gender selection on first join =====================
// Server asks ('character:choose') when the account has no saved body; we freeze the player and
// show the male/female chooser, relay the pick, and clean up on 'character:done'.
let characterBrowser = null;
mp.events.add('character:choose', () => {
    if (characterBrowser) return;
    uiLocked = true;
    characterBrowser = mp.browsers.new('package://ui/character/index.html');
    mp.gui.cursor.show(true, true);
    try { mp.players.local.freezePosition(true); } catch (e) {}
});
mp.events.add('character:pick', (gender) => {
    mp.events.callRemote('character:setGender', String(gender));
});
mp.events.add('character:done', () => {
    if (characterBrowser) { characterBrowser.destroy(); characterBrowser = null; }
    mp.gui.cursor.show(false, false);
    try { mp.players.local.freezePosition(false); } catch (e) {}
    uiLocked = false;
});
// While the chooser is open, keep the cursor on and block game controls so the mouse moves the
// cursor (to click a card) instead of swinging the camera.
mp.events.add('render', () => {
    if (!characterBrowser) return;
    mp.gui.cursor.show(true, true);
    mp.game.controls.disableAllControlActions(0);
    mp.game.controls.disableAllControlActions(1);
    mp.game.controls.disableAllControlActions(2);
});

// ===================== Auth: login / registration gate =====================
// Server sends 'auth:show' (mode, dataJson) right after connect; the player is frozen with the
// cursor up until they authenticate. We relay form submissions to the server and show errors.
let authBrowser = null;
function openAuth(mode, dataJson) {
    uiLocked = true;
    setLocalPedVisible(false); // no character shown during login/register
    if (!authBrowser) authBrowser = mp.browsers.new('package://ui/auth/index.html');
    mp.gui.cursor.show(true, true);
    try { mp.players.local.freezePosition(true); } catch (e) {}
    // Give the page a tick to load before pushing state.
    const push = () => { if (authBrowser) authBrowser.execute(`window.authShow(${JSON.stringify(mode)}, ${JSON.stringify(dataJson)})`); };
    setTimeout(push, 300);
}
mp.events.add('auth:show', (mode, dataJson) => openAuth(mode, dataJson));
mp.events.add('auth:error', (text) => { if (authBrowser) authBrowser.execute(`window.authError(${JSON.stringify(String(text))})`); });

// Rejoin spawn selector: close auth/creator UI, keep the player frozen, and offer where to spawn.
let spawnBrowser = null;
mp.events.add('auth:spawnSelect', (payloadJson) => {
    uiLocked = true;
    if (authBrowser) { authBrowser.destroy(); authBrowser = null; }
    if (creatorBrowser) { creatorBrowser.destroy(); creatorBrowser = null; }
    stopPedPreview();
    try { mp.players.local.freezePosition(true); } catch (e) {}
    if (!spawnBrowser) spawnBrowser = mp.browsers.new('package://ui/spawn/index.html');
    mp.gui.cursor.show(true, true);
    setTimeout(() => { if (spawnBrowser) spawnBrowser.execute(`window.spawnInit(${JSON.stringify(String(payloadJson))})`); }, 300);
});
mp.events.add('auth:spawnChoose', (choice) => mp.events.callRemote('auth:spawnChoose', String(choice)));
mp.events.add('render', () => {
    if (!spawnBrowser) return;
    mp.gui.cursor.show(true, true);
    mp.game.controls.disableAllControlActions(0);
    mp.game.controls.disableAllControlActions(1);
    mp.game.controls.disableAllControlActions(2);
});

// Fully authenticated and placed in the world: tear down every onboarding UI and release the player.
mp.events.add('auth:enter', () => {
    if (authBrowser) { authBrowser.destroy(); authBrowser = null; }
    if (characterBrowser) { characterBrowser.destroy(); characterBrowser = null; }
    if (creatorBrowser) { creatorBrowser.destroy(); creatorBrowser = null; }
    if (spawnBrowser) { spawnBrowser.destroy(); spawnBrowser = null; }
    stopPedPreview();
    setLocalPedVisible(true); // character enters the world
    // Clear any blur / death post-fx left over from model changes during onboarding.
    try { mp.game.invoke(SCREEN_BLUR_OUT, 0); } catch (e) {}
    try { mp.game.invoke('0xB4EDDC19532BFB85'); } catch (e) {} // ANIMPOSTFX_STOP_ALL
    try { mp.game.graphics.transitionFromBlurred(0); } catch (e) {}
    mp.gui.cursor.show(false, false);
    try { mp.players.local.freezePosition(false); } catch (e) {}
    uiLocked = false; // onboarding done — re-enable hotkeys
});

// Relay CEF form submits to the server.
mp.events.add('auth:submitLogin', (email, password) => mp.events.callRemote('auth:submitLogin', String(email), String(password)));
mp.events.add('auth:submitRegister', (payloadJson) => mp.events.callRemote('auth:submitRegister', String(payloadJson)));

// Keep cursor up / controls locked while the auth gate is open.
mp.events.add('render', () => {
    if (!authBrowser) return;
    mp.gui.cursor.show(true, true);
    mp.game.controls.disableAllControlActions(0);
    mp.game.controls.disableAllControlActions(1);
    mp.game.controls.disableAllControlActions(2);
});

// ===================== Character creator (heritage + face + overlays) =====================
// Onboarding step after gender. Server 'creator:start' puts us in a private room; we frame the face
// with the shared ped-preview camera, open the creator UI, and apply the whole appearance blob to
// the local ped on every change for a live preview. Confirm relays the blob to the server.
let creatorBrowser = null;
let creatorActive = false;
const CREATOR_OVERLAY_IDS = {
    blemishes: 0, beard: 1, eyebrows: 2, ageing: 3, makeup: 4, blush: 5,
    complexion: 6, sundamage: 7, lipstick: 8, moles: 9, chesthair: 10, bodyblemishes: 11
};

function applyCreatorLocal(blobJson) {
    let look;
    try { look = JSON.parse(blobJson); } catch (e) { return; }
    const me = mp.players.local;
    const h = look.heritage || {};
    // first = father, second = mother; last arg (isParent) = false for player peds.
    try { me.setHeadBlendData(h.dad | 0, h.mom | 0, 0, h.dad | 0, h.mom | 0, 0, Number(h.shapeMix) || 0, Number(h.skinMix) || 0, 0, false); } catch (e) {}
    if (Array.isArray(look.features)) look.features.forEach((v, i) => { try { me.setFaceFeature(i, Number(v) || 0); } catch (e) {} });
    const hair = look.hair || {};
    try { me.setComponentVariation(2, hair.style | 0, 0, 0); } catch (e) {}
    try { me.setHairColor(hair.color | 0, hair.highlight | 0); } catch (e) {}
    const overlays = look.overlays || {};
    Object.keys(CREATOR_OVERLAY_IDS).forEach((key) => {
        const entry = overlays[key] || {};
        const id = CREATOR_OVERLAY_IDS[key];
        const value = (entry.style == null || entry.style < 0) ? 255 : (entry.style | 0);
        const opacity = entry.opacity == null ? 1.0 : Number(entry.opacity);
        const color = entry.color | 0;
        try { me.setHeadOverlay(id, value, opacity, color, color); } catch (e) {}
        try { me.setHeadOverlayColor(id, 1, color, color); } catch (e) {} // colour type 1 = hair palette
    });
    try { me.setEyeColor((look.eyeColor | 0) || 0); } catch (e) {}
}

mp.events.add('creator:start', (dataJson) => {
    let data;
    try { data = JSON.parse(dataJson); } catch (e) { data = {}; }
    creatorActive = true;
    uiLocked = true;
    // Close the login/register (and any gender) UI — the creator replaces them.
    if (authBrowser) { authBrowser.destroy(); authBrowser = null; }
    if (characterBrowser) { characterBrowser.destroy(); characterBrowser = null; }
    setLocalPedVisible(true); // reveal the ped so the player can customise it
    const me = mp.players.local;
    if (data.pos) { try { me.position = new mp.Vector3(data.pos.x, data.pos.y, data.pos.z); } catch (e) {} }
    try { me.setHeading(180); } catch (e) {}
    startPedPreview();          // shared frozen-ped camera (see top of file)
    applyPedCamZone('head');    // frame the face by default
    if (!creatorBrowser) creatorBrowser = mp.browsers.new('package://ui/creator/index.html');
    mp.gui.cursor.show(true, true);
    setTimeout(() => { if (creatorBrowser) creatorBrowser.execute(`window.creatorInit(${JSON.stringify(dataJson)})`); }, 400);
});

// Live preview + camera controls driven by the CEF UI.
mp.events.add('creator:apply', (blobJson) => { if (creatorActive) applyCreatorLocal(String(blobJson)); });
mp.events.add('creator:zone', (zone) => { if (creatorActive) applyPedCamZone(String(zone)); });
mp.events.add('creator:rotate', (delta) => { if (creatorActive) rotatePedPreview(Number(delta) || 0); });
mp.events.add('creator:confirm', (blobJson) => { if (creatorActive) mp.events.callRemote('creator:save', String(blobJson)); });
// Gender toggle from the creator UI → ask the server to swap the ped model.
mp.events.add('creator:gender', (g) => { if (creatorActive) mp.events.callRemote('creator:gender', String(g)); });
// Server swapped the model (gender change): clear any death fx, re-frame the face, re-apply the look.
mp.events.add('creator:refresh', () => {
    if (!creatorActive) return;
    try { mp.game.invoke(SCREEN_BLUR_OUT, 0); } catch (e) {}
    try { mp.game.invoke('0xB4EDDC19532BFB85'); } catch (e) {} // ANIMPOSTFX_STOP_ALL
    setLocalPedVisible(true);
    applyPedCamZone('head');
    if (creatorBrowser) creatorBrowser.execute('window.creatorReapply && window.creatorReapply()');
});

mp.events.add('creator:error', (text) => { if (creatorBrowser) creatorBrowser.execute(`window.creatorError(${JSON.stringify(String(text))})`); });
mp.events.add('creator:done', () => {
    creatorActive = false;
    if (creatorBrowser) { creatorBrowser.destroy(); creatorBrowser = null; }
    stopPedPreview();
    mp.gui.cursor.show(false, false);
    uiLocked = false;
});

// Keep cursor up / controls locked while the creator is open.
mp.events.add('render', () => {
    if (!creatorBrowser) return;
    mp.gui.cursor.show(true, true);
    mp.game.controls.disableAllControlActions(0);
    mp.game.controls.disableAllControlActions(1);
    mp.game.controls.disableAllControlActions(2);
});

// ===================== Admin ESP =====================
// Admins (server sets the synced 'admin:esp' flag) automatically see every nearby player's name,
// ID, health and distance through walls — drawn in world space each frame.
mp.events.add('render', () => {
    const me = mp.players.local;
    if (!me || me.getVariable('admin:esp') !== true) return;
    if (chatting || anyModalOpen()) return;
    const self = me.position;
    mp.players.forEachInStreamRange(p => {
        if (!p || p === me) return;
        let pos; try { pos = p.position; } catch (e) { return; }
        const dx = pos.x - self.x, dy = pos.y - self.y, dz = pos.z - self.z;
        const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
        let screen = null;
        try { screen = mp.game.graphics.world3dToScreen2d(pos.x, pos.y, pos.z + 1.15); } catch (e) {}
        if (!screen) return;
        let hp = 0; try { hp = Math.max(0, Math.min(100, Math.round(Number(p.getHealth()) || 0))); } catch (e) {}
        const scale = dist > 80 ? 0.3 : 0.42;
        mp.game.graphics.drawText(worldText(String(p.name || ('ID ' + p.id))), [screen.x, screen.y], {
            font: 4, color: [120, 230, 150, 235], outline: true, centre: true, scale: [scale, scale]
        });
        mp.game.graphics.drawText('ID ' + p.id + ' · ' + hp + ' HP · ' + Math.round(dist) + 'm', [screen.x, screen.y + 0.019], {
            font: 4, color: [200, 220, 255, 215], outline: true, centre: true, scale: [scale * 0.78, scale * 0.78]
        });
    });
});
