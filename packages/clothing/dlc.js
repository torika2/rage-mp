// ===================== Clothing DLC registry: upload times + "new" ranges =====================
// 1) Registry — every add-on pack in client_packages/game_resources/dlcpacks/<name>/dlc.rpf is recorded
//    with the time it was first uploaded (and re-uploaded, when its size changes). Stored in
//    data/dlc_registry.json so the dates survive restarts.
// 2) New-item ranges — the game numbers add-on clothes after the base game's, so the drawables a pack
//    adds are the indices past the base count. When a shop client reports its per-slot drawable counts,
//    any growth is stamped with the newest clothing pack for that gender (its upload time). The shop
//    then labels drawables stamped within NEW_DAYS as new. Stored in data/clothing_new.json.
const fs = require('fs');
const path = require('path');

const DLC_DIR = path.join(__dirname, '..', '..', 'client_packages', 'game_resources', 'dlcpacks');
const NAMES_FILE = path.join(__dirname, '..', '..', 'client_packages', 'ui', 'clothing', 'names.js');
const REGISTRY_FILE = path.join(__dirname, 'data', 'dlc_registry.json');
const STAMP_FILE = path.join(__dirname, 'data', 'clothing_new.json');
const NEW_DAYS = 7;
const HEADER_BYTES = 1024 * 1024; // the RPF table of contents sits at the start; no need to read 300 MB

function readJson(file, fallback) {
    try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch (e) { return fallback; }
}
function writeJson(file, data) {
    const temporaryFile = file + '.tmp';
    try { fs.writeFileSync(temporaryFile, JSON.stringify(data, null, 1)); fs.renameSync(temporaryFile, file); } catch (e) {}
}

let registry = readJson(REGISTRY_FILE, { packs: {} });
if (!registry.packs) registry.packs = {};
let stamps = readJson(STAMP_FILE, { m: {}, f: {} });
if (!stamps.m) stamps.m = {};
if (!stamps.f) stamps.f = {};

// 'm' | 'f' | null (both / not a clothing pack) by the freemode ped names listed in the pack's TOC.
function detectGender(file) {
    let fd;
    try {
        fd = fs.openSync(file, 'r');
        const buffer = Buffer.alloc(HEADER_BYTES);
        const read = fs.readSync(fd, buffer, 0, HEADER_BYTES, 0);
        const text = buffer.toString('latin1', 0, read);
        const male = text.includes('mp_m_freemode_01_mp_m_clothes');
        const female = text.includes('mp_f_freemode_01_mp_f_clothes');
        return { clothing: male || female, gender: male && !female ? 'm' : (female && !male ? 'f' : null) };
    } catch (e) {
        return { clothing: false, gender: null };
    } finally {
        if (fd !== undefined) try { fs.closeSync(fd); } catch (e) {}
    }
}

// Records new/changed packs. Safe to call often (stat only for packs already known).
function scanPacks() {
    let names = [];
    try { names = fs.readdirSync(DLC_DIR); } catch (e) { return registry; }
    const seen = new Set();
    let dirty = false;
    names.forEach(name => {
        const file = path.join(DLC_DIR, name, 'dlc.rpf');
        let stat;
        try { stat = fs.statSync(file); } catch (e) { return; }
        seen.add(name);
        const known = registry.packs[name];
        // birthtime = when the file landed on this box; fall back to mtime where the FS has none.
        const uploaded = Math.round(stat.birthtimeMs > 0 ? Math.min(stat.birthtimeMs, stat.mtimeMs) : stat.mtimeMs);
        if (!known) {
            const info = detectGender(file);
            registry.packs[name] = { addedAt: uploaded, uploadedAt: uploaded, size: stat.size, clothing: info.clothing, gender: info.gender, history: [] };
            console.log(`[clothing] new DLC pack recorded: ${name} (${new Date(uploaded).toISOString()})`);
            dirty = true;
        } else if (known.size !== stat.size) { // re-uploaded with different content
            known.history.push({ at: known.uploadedAt, size: known.size });
            known.uploadedAt = Math.round(stat.mtimeMs);
            known.size = stat.size;
            const info = detectGender(file);
            known.clothing = info.clothing; known.gender = info.gender;
            console.log(`[clothing] DLC pack updated: ${name}`);
            dirty = true;
        } else if (known.missing) { delete known.missing; dirty = true; }
    });
    Object.keys(registry.packs).forEach(name => {
        if (!seen.has(name) && !registry.packs[name].missing) { registry.packs[name].missing = true; dirty = true; }
    });
    if (dirty) writeJson(REGISTRY_FILE, registry);
    return registry;
}

// Base-game drawable count per slot, from the GTA Online name table (the best baseline we have
// without having seen the game before the pack was added). Slots without names (bag, decal) get none.
let baseCounts = null;
function baseline(gender, key) {
    if (!baseCounts) {
        baseCounts = { m: {}, f: {} };
        try {
            const text = fs.readFileSync(NAMES_FILE, 'utf8');
            const table = JSON.parse(text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1));
            ['m', 'f'].forEach(g => {
                Object.keys(table[g] || {}).forEach(slot => {
                    const indices = Object.keys(table[g][slot]).map(Number);
                    if (indices.length) baseCounts[g][slot] = Math.max(...indices) + 1;
                });
            });
        } catch (e) { console.log('[clothing] names.js unreadable — no base baseline'); }
    }
    return baseCounts[gender][key];
}

function newestClothingPack(gender) {
    return Object.keys(registry.packs)
        .filter(name => { const p = registry.packs[name]; return p.clothing && !p.missing && (p.gender === gender || p.gender === null); })
        .sort((a, b) => registry.packs[b].uploadedAt - registry.packs[a].uploadedAt)[0] || null;
}

// A shop client reports how many drawables each slot has. Growth since last time is attributed to the
// newest clothing pack for that gender. Returns the ranges for that gender.
function reportCounts(gender, counts) {
    if (gender !== 'm' && gender !== 'f') return {};
    scanPacks();
    const pack = newestClothingPack(gender);
    const at = pack ? registry.packs[pack].uploadedAt : Date.now();
    let dirty = false;
    Object.keys(counts || {}).forEach(key => {
        const count = Math.floor(Number(counts[key]));
        if (!Number.isFinite(count) || count < 0 || count > 5000) return;
        let slot = stamps[gender][key];
        if (!slot) {
            const base = baseline(gender, key);
            const first = Math.min(count, base === undefined ? count : base);
            slot = stamps[gender][key] = { count: first, ranges: [] };
            dirty = true;
        }
        if (count > slot.count) { // new drawables appeared
            slot.ranges.push({ from: slot.count, to: count, pack, at });
            slot.count = count;
            dirty = true;
        } else if (count < slot.count) { // a pack was removed — clip
            slot.count = count;
            slot.ranges = slot.ranges.map(r => ({ from: r.from, to: Math.min(r.to, count), pack: r.pack, at: r.at })).filter(r => r.to > r.from);
            dirty = true;
        }
    });
    if (dirty) writeJson(STAMP_FILE, stamps);
    const out = {};
    Object.keys(stamps[gender]).forEach(key => { if (stamps[gender][key].ranges.length) out[key] = stamps[gender][key].ranges; });
    return out;
}

scanPacks();

module.exports = { NEW_DAYS, scanPacks, reportCounts, packs: () => registry.packs, ranges: (gender) => (stamps[gender] || {}) };
