// ===================== Teleports: named destinations (/cityhall, /hospital, …) =====================
// Simple named teleport points stored in points.json so they survive restarts. Anyone can teleport to a
// point; admins re-pin a point to their current spot with /settp <name> (handy because a map/interior
// mod loads wherever its author placed it — walk inside, /settp, and the command lands you there after).
const fs = require('fs');
const path = require('path');

const DATA_FILE = path.join(__dirname, 'points.json');
let points = {};
try { points = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8')); } catch (e) { points = {}; }

function save() {
    const tmp = DATA_FILE + '.tmp';
    try { fs.writeFileSync(tmp, JSON.stringify(points, null, 2)); fs.renameSync(tmp, DATA_FILE); }
    catch (e) { console.log('[teleports] save failed: ' + (e && e.message)); }
}

function tell(player, msg) { player.outputChatBox('!{#7ec8ff}[ტელეპორტი] !{#ffffff}' + msg); }

function isAdmin(player) {
    return typeof global.isProtectedAdmin === 'function' && global.isProtectedAdmin(player);
}

function teleport(player, name) {
    const p = points[name];
    if (!p || typeof p.x !== 'number') { tell(player, `წერტილი „${name}“ ჯერ არ არის დაყენებული. (ადმინი: /settp ${name})`); return; }
    try {
        player.dimension = Number(p.dim) || 0;
        player.position = new mp.Vector3(p.x, p.y, p.z);
        if (typeof p.h === 'number') player.heading = p.h;
    } catch (e) { tell(player, 'ტელეპორტი ვერ შესრულდა.'); return; }
    tell(player, `გადახვედი: ${name}.`);
}

// Open teleport commands.
mp.events.addCommand('cityhall', (player) => teleport(player, 'cityhall'));
mp.events.addCommand('hospital', (player) => teleport(player, 'hospital'));

// Admin: pin a named point to your current position (so you can aim a teleport at a mod's real interior).
mp.events.addCommand('settp', (player, _, name) => {
    if (!isAdmin(player)) return tell(player, 'ეს ბრძანება მხოლოდ ადმინისთვისაა.');
    name = String(name || '').trim().toLowerCase();
    if (!name) return tell(player, 'გამოყენება: /settp <სახელი> (მაგ: /settp hospital) — იდექი იქ, სადაც გინდა.');
    const pos = player.position;
    points[name] = { x: pos.x, y: pos.y, z: pos.z, h: Math.round(Number(player.heading) || 0), dim: Number(player.dimension) || 0 };
    save();
    tell(player, `წერტილი „${name}“ დაყენდა აქ (X ${pos.x.toFixed(2)} Y ${pos.y.toFixed(2)} Z ${pos.z.toFixed(2)}). ბრძანება: /${name}`);
});

// Admin: list configured points.
mp.events.addCommand('tps', (player) => {
    if (!isAdmin(player)) return tell(player, 'ეს ბრძანება მხოლოდ ადმინისთვისაა.');
    const names = Object.keys(points);
    tell(player, names.length ? ('წერტილები: ' + names.join(', ')) : 'წერტილები არ არის.');
});
