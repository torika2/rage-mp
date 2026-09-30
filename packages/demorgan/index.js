// ===================== Demorgan: admin jail in its own dimension =====================
// Admins send rule-breakers to Demorgan for N minutes: an isolated copy of the Bolingbroke prison yard
// in dimension DIMENSION, so nobody in the normal world sees them. The server keeps them inside (pulled
// back if they leave the radius or the dimension), blocks most commands, and the client blocks weapons
// and shows the remaining time. Time only counts down while online; the sentence survives reconnects
// and restarts (demorgan.json). Admins can visit with /sjail (and back out with /sjail again).
const fs = require('fs');
const path = require('path');

const DATA_FILE = path.join(__dirname, 'demorgan.json');
// Dimensions: 0 = main world, 1 = Demorgan (houses use 100000 + id). /dim and /setdim move admins/players.
const MAIN_DIMENSION = 0;
const DIMENSION = 1;
const MAX_DIMENSION = 2147483647;
// Demorgan lives inside an enclosed underground interior (the Gunrunning bunker below the docks), so
// nothing of the outside map is visible from it and its walls keep prisoners in. /sjail set moves it.
const DEFAULT_SPOT = { x: 892.64, y: -3245.87, z: -98.27, h: 90, interior: 'bunker' };
const SAFETY_RADIUS = 250;    // invisible failsafe: only a prisoner who glitched out of the interior gets put back
const BOUNDARY_MS = 1000;
const RELEASE_SPOT = { x: 1846.0, y: 2585.8, z: 45.67, h: 270 }; // outside the prison gate, normal world
const MAX_MINUTES = 1440;
const TICK_MS = 2000;
// Commands a prisoner may still use (everything else is blocked while in Demorgan).
const ALLOWED_COMMANDS = ['pos', 'money', 'bank', 'needs', 'laws', 'inv'];

let data = { spot: DEFAULT_SPOT, jailed: {} };
try { data = Object.assign(data, JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'))); } catch (e) {}
if (!data.jailed) data.jailed = {};
// One-time move (spotVersion 2): Demorgan used to be the open prison yard (default or a /sjail set spot
// out there), where the rest of the map is visible — move it into the enclosed interior.
if (!data.spot || data.spotVersion !== 2) {
    data.spot = Object.assign({}, DEFAULT_SPOT);
    data.spotVersion = 2;
    save();
}
function save() {
    const temporaryFile = DATA_FILE + '.tmp';
    try { fs.writeFileSync(temporaryFile, JSON.stringify(data, null, 2)); fs.renameSync(temporaryFile, DATA_FILE); } catch (e) {}
}

function keyOf(player) { return String(player.socialClub || '').trim().toLowerCase(); }
function tell(player, message) { player.outputChatBox('!{#ff6978}[Demorgan] !{#ffffff}' + message); }
function isAdmin(player) { return typeof global.isProtectedAdmin === 'function' && global.isProtectedAdmin(player); }
function adminMode(player) { return player.getVariable('admin:mode') === true; }
function recordOf(player) { const key = keyOf(player); return key ? data.jailed[key] || null : null; }
function formatTime(seconds) {
    const s = Math.max(0, Math.ceil(seconds));
    return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
}
function onlineById(value) {
    const text = String(value === undefined || value === null ? '' : value);
    if (!/^\d+$/.test(text)) return null;
    let found = null;
    mp.players.forEach(p => { if (Number(p.id) === Number(text)) found = p; });
    return found;
}

// ---- Placing / releasing ----
function placeInside(player) {
    const spot = data.spot;
    try { if (player.vehicle) player.removeFromVehicle(); } catch (e) {}
    player.dimension = DIMENSION;
    player.position = new mp.Vector3(spot.x + (Math.random() * 4 - 2), spot.y + (Math.random() * 4 - 2), spot.z);
    player.heading = spot.h || 0;
}
// Back to the spawn point only — the prisoner stays in whatever dimension they're in (Demorgan's).
function toSpawnPoint(player) {
    const spot = data.spot;
    try { if (player.vehicle) player.removeFromVehicle(); } catch (e) {}
    player.position = new mp.Vector3(spot.x, spot.y, spot.z);
    player.heading = spot.h || 0;
}
function syncTimer(player) {
    const record = recordOf(player);
    player.setVariable('demorgan:left', record ? Math.ceil(record.remaining) : 0);
    player.setVariable('demorgan:reason', record ? record.reason : '');
    // Tells the client it's in Demorgan (hide minimap, no ambient NPCs, load the interior's furniture).
    const inside = record || player.sjailReturn || Number(player.dimension) === DIMENSION;
    player.setVariable('demorgan:area', inside ? { x: data.spot.x, y: data.spot.y, z: data.spot.z, interior: data.spot.interior || null } : null);
}
function sendTo(target, minutes, reason, byName) {
    const key = keyOf(target);
    if (!key) return false;
    data.jailed[key] = { name: target.name, remaining: minutes * 60, reason: reason || 'წესების დარღვევა', by: byName, at: Date.now() };
    save();
    placeInside(target);
    syncTimer(target);
    tell(target, `თქვენ გადაგიყვანეს დემორგანში ${minutes} წუთით. მიზეზი: ${data.jailed[key].reason}. (ადმინი: ${byName})`);
    return true;
}
function release(target, message) {
    const key = keyOf(target);
    if (key && data.jailed[key]) { delete data.jailed[key]; save(); }
    target.dimension = 0;
    target.position = new mp.Vector3(RELEASE_SPOT.x, RELEASE_SPOT.y, RELEASE_SPOT.z);
    target.heading = RELEASE_SPOT.h;
    syncTimer(target);
    tell(target, message || 'თქვენ გათავისუფლდით დემორგანიდან.');
}

// ---- Enforcement + countdown (online time only) ----
setInterval(() => {
    let changed = false;
    mp.players.forEach(player => {
        if (!mp.players.exists(player)) return;
        const record = recordOf(player);
        if (!record) return;
        record.remaining -= TICK_MS / 1000;
        changed = true;
        if (record.remaining <= 0) { release(player, 'სასჯელი დასრულდა — თქვენ გათავისუფლდით დემორგანიდან.'); return; }
        syncTimer(player);
    });
    if (changed) save();
}, TICK_MS);

// Failsafe (invisible): a prisoner who fell through / glitched out of the interior (more than
// SAFETY_RADIUS m away) goes back to the spawn point without a dimension change; one who left
// Demorgan's dimension is put back into it.
setInterval(() => {
    mp.players.forEach(player => {
        if (!mp.players.exists(player) || !recordOf(player)) return;
        if (Number(player.dimension) !== DIMENSION) { placeInside(player); return; }
        const spot = data.spot, p = player.position;
        if (Math.hypot(p.x - spot.x, p.y - spot.y, p.z - spot.z) > SAFETY_RADIUS || player.vehicle) toSpawnPoint(player);
    });
}, BOUNDARY_MS);

// Rejoin / respawn: prisoners go straight back (after houses / City Hall spawn logic, so Demorgan wins).
function restore(player) {
    if (!mp.players.exists(player) || !recordOf(player)) return;
    placeInside(player);
    syncTimer(player);
    tell(player, `დემორგანი: დარჩენილია ${formatTime(recordOf(player).remaining)}. მიზეზი: ${recordOf(player).reason}.`);
}
mp.events.add('playerReady', (player) => setTimeout(() => restore(player), 4000));
mp.events.add('playerSpawn', (player) => setTimeout(() => restore(player), 1500));

// Prisoners can't use commands except a few harmless ones (checked in packages/_core runCommand).
global.commandGuard = (player, name) => {
    if (!recordOf(player) || ALLOWED_COMMANDS.includes(name)) return null;
    return '!{#ff6978}[Demorgan] !{#ffffff}დემორგანში ბრძანებები აკრძალულია. დარჩენილია ' + formatTime(recordOf(player).remaining) + '.';
};
global.demorganIsJailed = (player) => !!recordOf(player);
global.demorganMinutesLeft = (player) => { const r = recordOf(player); return r ? Math.ceil(r.remaining / 60) : 0; };
global.demorganSend = (admin, target, minutes, reason) => doSend(admin, target, minutes, reason);
global.demorganRelease = (admin, target) => doRelease(admin, target);

// ---- Admin actions (shared by commands and the admin panel) ----
function doSend(admin, target, minutes, reason) {
    if (!isAdmin(admin) || !adminMode(admin)) { tell(admin, 'მხოლოდ ადმინისთვის, Admin Mode-ში.'); return false; }
    if (!target) { tell(admin, 'მოთამაშე ვერ მოიძებნა.'); return false; }
    if (isAdmin(target)) { tell(admin, 'ადმინისტრატორს ვერ გაგზავნით დემორგანში.'); return false; }
    minutes = Math.floor(Number(minutes));
    if (!Number.isSafeInteger(minutes) || minutes < 1 || minutes > MAX_MINUTES) { tell(admin, `წუთები: 1-${MAX_MINUTES}.`); return false; }
    if (!sendTo(target, minutes, String(reason || '').trim().slice(0, 100), admin.name)) { tell(admin, 'მოთამაშეს არ აქვს Social Club იდენტიფიკატორი.'); return false; }
    tell(admin, `${target.name} (ID ${target.id}) — დემორგანი ${minutes} წთ.`);
    mp.players.forEach(p => { if (p !== admin && p !== target) tell(p, `${target.name} გადაიყვანეს დემორგანში ${minutes} წუთით.`); });
    return true;
}
function doRelease(admin, target) {
    if (!isAdmin(admin) || !adminMode(admin)) { tell(admin, 'მხოლოდ ადმინისთვის, Admin Mode-ში.'); return false; }
    if (!target || !recordOf(target)) { tell(admin, 'ეს მოთამაშე დემორგანში არ არის.'); return false; }
    release(target, `ადმინმა ${admin.name} გაგათავისუფლათ დემორგანიდან.`);
    tell(admin, `${target.name} გათავისუფლდა.`);
    return true;
}

// /demorgan <id> <minutes> [reason]
mp.events.addCommand('demorgan', (player, full, id, minutes) => {
    const reason = String(full || '').trim().split(/\s+/).slice(2).join(' ');
    if (id === undefined || minutes === undefined) return tell(player, `გამოყენება: /demorgan <id> <1-${MAX_MINUTES} წთ> [მიზეზი]`);
    doSend(player, onlineById(id), minutes, reason);
});
// /undemorgan <id>
mp.events.addCommand('undemorgan', (player, _, id) => {
    if (id === undefined) return tell(player, 'გამოყენება: /undemorgan <id>');
    doRelease(player, onlineById(id));
});
// /demorgans — everyone with a sentence (online and offline)
mp.events.addCommand('demorgans', (player) => {
    if (!isAdmin(player)) return tell(player, 'მხოლოდ ადმინისთვის.');
    const keys = Object.keys(data.jailed);
    if (!keys.length) return tell(player, 'დემორგანში არავინ არის.');
    keys.forEach(key => {
        const r = data.jailed[key];
        let online = null;
        mp.players.forEach(p => { if (keyOf(p) === key) online = p; });
        player.outputChatBox(`!{#9aa4ad}${r.name}${online ? ' (ID ' + online.id + ')' : ' (offline)'} — ${formatTime(r.remaining)} · ${r.reason} · ${r.by}`);
    });
});
// ---- Dimension commands (admins) ----
// Names: main = 0, demorgan = 1; anything else is a number.
function parseDimension(text) {
    const value = String(text || '').trim().toLowerCase();
    if (value === 'main') return MAIN_DIMENSION;
    if (value === 'demorgan' || value === 'dm') return DIMENSION;
    if (!/^\d+$/.test(value)) return null;
    const n = Number(value);
    return Number.isSafeInteger(n) && n <= MAX_DIMENSION ? n : null;
}
function dimensionName(dim) {
    dim = Number(dim) || 0;
    if (dim === MAIN_DIMENSION) return '0 (მთავარი)';
    if (dim === DIMENSION) return '1 (დემორგანი)';
    if (dim >= 100000) return `${dim} (სახლი #${dim - 100000})`;
    return String(dim);
}
function moveToDimension(target, dim) {
    try { if (target.vehicle) target.removeFromVehicle(); } catch (e) {}
    target.dimension = dim;
    if (dim === DIMENSION) placeInside(target);       // Demorgan: land on its spawn point
    syncTimer(target);
}
global.dimensionName = dimensionName;

// /dim — your dimension · /dim <0|1|main|demorgan|number> — move yourself
mp.events.addCommand('dim', (player, _, value) => {
    if (!isAdmin(player)) return tell(player, 'მხოლოდ ადმინისთვის.');
    if (value === undefined) return tell(player, `თქვენი განზომილება: ${dimensionName(player.dimension)}. გამოყენება: /dim <0|1|main|demorgan|ნომერი>`);
    const dim = parseDimension(value);
    if (dim === null) return tell(player, 'გამოყენება: /dim <0|1|main|demorgan|ნომერი>  (0 = მთავარი, 1 = დემორგანი)');
    player.sjailReturn = null; // a manual move replaces any /sjail return point
    moveToDimension(player, dim);
    tell(player, `განზომილება: ${dimensionName(dim)}.`);
});
// /setdim <id> <0|1|main|demorgan|number> — move another player
mp.events.addCommand('setdim', (player, _, id, value) => {
    if (!isAdmin(player)) return tell(player, 'მხოლოდ ადმინისთვის.');
    const target = onlineById(id);
    const dim = parseDimension(value);
    if (!target || dim === null) return tell(player, 'გამოყენება: /setdim <id> <0|1|main|demorgan|ნომერი>');
    if (recordOf(target)) return tell(player, `${target.name} დემორგანშია — ჯერ /undemorgan ${target.id}.`);
    moveToDimension(target, dim);
    tell(player, `${target.name} → განზომილება ${dimensionName(dim)}.`);
    if (target !== player) tell(target, `ადმინმა გადაგიყვანათ განზომილებაში ${dimensionName(dim)}.`);
});

// /sjail — admins: teleport into Demorgan to check on it, and /sjail again to go back.
// /sjail set — move the Demorgan spot to where you stand (in any dimension).
mp.events.addCommand('sjail', (player, _, action) => {
    if (!isAdmin(player)) return tell(player, 'მხოლოდ ადმინისთვის.');
    if (String(action || '').toLowerCase() === 'set') {
        const p = player.position;
        data.spot = { x: +p.x.toFixed(2), y: +p.y.toFixed(2), z: +p.z.toFixed(2), h: Math.round(Number(player.heading) || 0), interior: null };
        save();
        return tell(player, 'დემორგანის ადგილი შეიცვალა (აქ).');
    }
    if (player.sjailReturn) {
        const back = player.sjailReturn;
        player.sjailReturn = null;
        player.dimension = back.dim;
        player.position = new mp.Vector3(back.x, back.y, back.z);
        syncTimer(player);
        return tell(player, 'დაბრუნდით დემორგანიდან.');
    }
    if (player.vehicle) return tell(player, 'ჯერ გადმოდით მანქანიდან.');
    const p = player.position;
    player.sjailReturn = { x: p.x, y: p.y, z: p.z, dim: Number(player.dimension) || 0 };
    placeInside(player);
    syncTimer(player);
    const count = Object.keys(data.jailed).length;
    tell(player, `დემორგანში ხართ (განზომილება ${DIMENSION}). პატიმრები: ${count}. დასაბრუნებლად: /sjail`);
});
