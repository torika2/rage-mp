// ===================== Tattoo salons: the 6 GTA tattoo parlours =====================
// Server-authoritative. data.json (tools/gen-tattoo-data.py) holds every GTA Online tattoo per gender;
// an item's id is its index in that list. The salon page browses and previews locally; checkout sends
// { add: [ids], remove: [ids] }, which is re-priced here (client prices are never trusted), charged
// with government sales tax, saved to tattoo.json and applied (synced to everyone) as ped decorations.
const fs = require('fs');
const path = require('path');

const SHOP_LOCATIONS = [
    { x: 322.14, y: 180.47, z: 103.59 },     // Vinewood — Hawick
    { x: -1153.68, y: -1425.68, z: 4.95 },   // Vespucci Beach
    { x: 1322.65, y: -1651.98, z: 51.28 },   // El Burro Heights
    { x: -3170.07, y: 1075.06, z: 20.83 },   // Chumash
    { x: 1864.63, y: 3747.74, z: 33.03 },    // Sandy Shores
    { x: -293.71, y: 6200.04, z: 31.49 }     // Paleto Bay
];
const SHOP_RANGE = 6.0;
const SESSION_MS = 15 * 60 * 1000; // the preview happens away from the salon, so checkout accepts a session
// Base price per zone (head, torso, left arm, right arm, left leg, right leg); removal is a flat fee.
const ZONE_PRICE = [250, 350, 200, 200, 200, 200];
const REMOVE_PRICE = 75;
const MAX_OWNED = 120;
const MAX_PER_PURCHASE = 40;

const DATA = JSON.parse(fs.readFileSync(path.join(__dirname, 'data.json'), 'utf8'));
const FREEMODE_MALE = mp.joaat('mp_m_freemode_01');
const FREEMODE_FEMALE = mp.joaat('mp_f_freemode_01');

const DATA_FILE = path.join(__dirname, 'tattoo.json');
let store = {};
try { store = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8')); } catch (e) { store = {}; }
function save() {
    const temporaryFile = DATA_FILE + '.tmp';
    try { fs.writeFileSync(temporaryFile, JSON.stringify(store)); fs.renameSync(temporaryFile, DATA_FILE); } catch (e) {}
}

function keyOf(player) { return String(player.socialClub || player.name || ('id' + player.id)); }
function modelKey(player) {
    const model = Number(player.model);
    return model === FREEMODE_MALE ? 'm' : (model === FREEMODE_FEMALE ? 'f' : null);
}
function owned(player) {
    const model = modelKey(player);
    const entry = store[keyOf(player)];
    return (model && entry && Array.isArray(entry[model])) ? entry[model] : [];
}
function tell(player, message) {
    player.outputChatBox('!{#d0827a}[ტატუს სალონი] !{#ffffff}' + message);
}
function atShop(player) {
    if (Number(player.dimension) !== 0) return false;
    const p = player.position;
    return SHOP_LOCATIONS.some(loc => {
        const dx = p.x - loc.x, dy = p.y - loc.y, dz = p.z - loc.z;
        return dx * dx + dy * dy + dz * dz <= SHOP_RANGE * SHOP_RANGE;
    });
}
function taxRate() {
    return (typeof global.govTaxRate === 'function' ? Number(global.govTaxRate()) : 0) || 0;
}

// Draws the player's saved tattoos (synced to everyone). Clears first so removals take effect.
function applyTattoos(player) {
    const model = modelKey(player);
    if (!model) return;
    try { player.clearDecorations(); } catch (e) {}
    owned(player).forEach(id => {
        const item = DATA[model][id];
        if (!item) return;
        try { player.setDecoration(DATA.collections[item[1]].h, item[2]); } catch (e) {}
    });
}
function restoreTattoos(player) {
    if (!mp.players.exists(player)) return;
    applyTattoos(player);
}

mp.events.add('tattoo:requestState', (player) => {
    const model = modelKey(player);
    const open = atShop(player) && !!model;
    player.tattooSession = open ? Date.now() : 0;
    if (!open) tell(player, atShop(player) ? 'სალონი მხოლოდ სტანდარტულ პერსონაჟს ემსახურება.' : 'მიდით ტატუს სალონთან (რუკაზე ტატუს ნიშანი).');
    player.call('tattoo:state', [JSON.stringify({
        open,
        gender: model,
        money: (typeof global.getMoney === 'function' ? global.getMoney(player) : 0),
        taxRate: taxRate(),
        zonePrice: ZONE_PRICE,
        removePrice: REMOVE_PRICE,
        maxOwned: MAX_OWNED,
        owned: open ? owned(player) : [],
        // Bare-body values so the preview can strip the clothes that would hide the tattoos.
        nude: open && typeof global.invNudeLook === 'function' ? global.invNudeLook(player) : {},
        nudeArms: open && typeof global.invTopArms === 'function' ? global.invTopArms(player).nude : 15
    })]);
});

// Checkout: addJson/removeJson = arrays of item ids. Only genuinely new / owned ids are charged.
mp.events.add('tattoo:buy', (player, requestJson) => {
    const reply = (ok) => player.call('tattoo:result', [JSON.stringify({
        ok, money: (typeof global.getMoney === 'function' ? global.getMoney(player) : 0), owned: owned(player)
    })]);
    const inSession = player.tattooSession && (Date.now() - player.tattooSession) < SESSION_MS;
    if (!inSession && !atShop(player)) { tell(player, 'გადასახდელად მიდით ტატუს სალონში.'); return reply(false); }
    const model = modelKey(player);
    if (!model) return reply(false);
    let request;
    try { request = JSON.parse(requestJson); } catch (e) { return reply(false); }
    if (!request || !Array.isArray(request.add) || !Array.isArray(request.remove)) return reply(false);
    if (typeof global.getMoney !== 'function' || typeof global.setMoney !== 'function') {
        tell(player, 'სისტემა ამჟამად მიუწვდომელია.');
        return reply(false);
    }

    const list = DATA[model];
    const have = new Set(owned(player));
    const toAdd = [...new Set(request.add.map(Number))].filter(id => Number.isInteger(id) && id >= 0 && id < list.length && !have.has(id));
    const toRemove = [...new Set(request.remove.map(Number))].filter(id => have.has(id));
    if (toAdd.length > MAX_PER_PURCHASE) { tell(player, `ერთდროულად მაქსიმუმ ${MAX_PER_PURCHASE} ტატუ.`); return reply(false); }
    if (!toAdd.length && !toRemove.length) { tell(player, 'არაფერი შეცვლილა.'); return reply(false); }
    if (have.size - toRemove.length + toAdd.length > MAX_OWNED) { tell(player, `ტატუების ლიმიტი: ${MAX_OWNED}.`); return reply(false); }

    const base = toAdd.reduce((sum, id) => sum + ZONE_PRICE[list[id][0]], 0) + toRemove.length * REMOVE_PRICE;
    const tax = Math.round(base * Math.max(0, taxRate()));
    const total = base + tax;
    if (!global.canAfford(player, total)) {
        tell(player, `არასაკმარისი თანხა — საჭიროა $${total} ($${base} + $${tax} გადასახადი). თქვენ გაქვთ $${global.getMoney(player)}.`);
        return reply(false);
    }

    global.setMoney(player, global.getMoney(player) - total);
    if (tax > 0 && typeof global.govAddToTreasury === 'function') global.govAddToTreasury(tax);
    const removeSet = new Set(toRemove);
    const key = keyOf(player);
    if (!store[key] || typeof store[key] !== 'object') store[key] = {};
    store[key][model] = owned(player).filter(id => !removeSet.has(id)).concat(toAdd);
    save();
    applyTattoos(player);
    player.tattooSession = 0;
    tell(player, `დაემატა ${toAdd.length}, მოიხსნა ${toRemove.length} — $${total}${tax ? ` (მ.შ. $${tax} გადასახადი)` : ''}. ბალანსი: $${global.getMoney(player)}.`);
    reply(true);
});

// The salon closed (bought or not): redraw the saved set over whatever the preview left on the ped.
mp.events.add('tattoo:refresh', (player) => {
    const now = Date.now();
    if (player.tattooRefreshAt && now - player.tattooRefreshAt < 1000) return;
    player.tattooRefreshAt = now;
    applyTattoos(player);
});

// Spawn and model changes reset decorations; put them back (after inventory re-dresses the ped).
mp.events.add('playerReady', (player) => setTimeout(() => restoreTattoos(player), 2000));
mp.events.add('playerSpawn', (player) => setTimeout(() => restoreTattoos(player), 1500));

global.tattooRestore = (player) => restoreTattoos(player);
global.tattooLocations = () => SHOP_LOCATIONS;
