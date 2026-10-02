// ===================== Barber: the 7 GTA barber shops (Herr Kutz, Bob Mulét, O'Sheas, ...) =====================
// Server-authoritative hair, beard, eyebrows and eye colour. The client browses the GTA Online
// lists and previews locally. Checkout re-prices the change here (only what actually changed is
// charged), takes money + government sales tax, applies the look (synced to everyone) and saves it
// to barber.json so it comes back on rejoin / respawn.
//
// GTA only draws hair tint and head overlays (beard, eyebrows) on a ped that has HEAD BLEND data,
// so every freemode player gets DEFAULT_BLEND on spawn (there's no character creator yet).
const fs = require('fs');
const path = require('path');

const SHOP_LOCATIONS = [
    { x: -814.31, y: -183.82, z: 37.57 },   // Bob Mulét — Rockford Hills
    { x: 136.83, y: -1708.37, z: 29.29 },   // Herr Kutz — Davis
    { x: -1282.60, y: -1116.76, z: 6.99 },  // Beach Combover — Vespucci
    { x: 1931.51, y: 3729.67, z: 32.84 },   // O'Sheas — Sandy Shores
    { x: 1212.84, y: -472.92, z: 66.21 },   // Herr Kutz — Mirror Park
    { x: -32.89, y: -152.32, z: 57.08 },    // Hair on Hawick — Hawick
    { x: -278.08, y: 6228.46, z: 31.70 }    // Herr Kutz — Paleto Bay
];
const SHOP_RANGE = 6.0; // metres a player must be within to open the salon
// The client previews at a clean dressing spot away from the salon, so opening the menu AT a salon
// starts a short server-side session that checkout accepts instead of the live position.
const SESSION_MS = 15 * 60 * 1000;

// Look fields: d = hair style, c/h = hair colour/highlight, b/bc = beard/colour, e/ec = eyebrows/colour,
// eye = eye colour. b/e = -1 means none. Base prices (before tax); only changed fields are charged.
const PRICES = { d: 80, c: 40, h: 30, b: 60, bc: 25, e: 40, ec: 20, eye: 50 };
const HAIR_COMPONENT = 2;
const HAIR_COLORS = 64;      // GTA hair tint palette (0..63), also used for beard/eyebrow colour
const MAX_HAIR_DRAWABLE = 255;
const BEARDS = 29;           // head overlay 1 values (0..28)
const EYEBROWS = 34;         // head overlay 2 values (0..33)
const EYE_COLORS = 32;       // eye colour indices (0..31)
const OVERLAY_BEARD = 1, OVERLAY_EYEBROWS = 2, OVERLAY_NONE = 255;
const FREEMODE_MALE = mp.joaat('mp_m_freemode_01');
const FREEMODE_FEMALE = mp.joaat('mp_f_freemode_01');
// Parents: 0 = Benjamin (male), 21 = Hannah (female). [shape1, shape2, shape3, skin1, skin2, skin3, shapeMix, skinMix, thirdMix]
const DEFAULT_BLEND = { m: [0, 0, 0, 0, 0, 0, 0.5, 0.5, 0], f: [21, 21, 0, 21, 21, 0, 0.5, 0.5, 0] };

const DATA_FILE = path.join(__dirname, 'barber.json');
let store = {};
try { store = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8')); } catch (e) { store = {}; }
function save() {
    const temporaryFile = DATA_FILE + '.tmp';
    try { fs.writeFileSync(temporaryFile, JSON.stringify(store)); fs.renameSync(temporaryFile, DATA_FILE); } catch (e) {}
}

function keyOf(player) { return String(player.socialClub || player.name || ('id' + player.id)); }
// Hair drawables differ between the male and female freemode peds, so the look is saved per model.
function modelKey(player) {
    const model = Number(player.model);
    if (model === FREEMODE_MALE) return 'm';
    if (model === FREEMODE_FEMALE) return 'f';
    return null;
}
// Fills missing fields AND clamps every field to its valid range. The live ped can report junk
// values (e.g. hairColor 255 on a fresh char), which must not pass through or the buy's parseLook
// rejects the whole look.
function withDefaults(look) {
    const inRange = (v, min, max, dflt) => (Number.isInteger(v) && v >= min && v <= max) ? v : dflt;
    const c = inRange(look.c, 0, HAIR_COLORS - 1, 0);
    return {
        d: inRange(look.d, 0, MAX_HAIR_DRAWABLE, 0),
        c,
        h: inRange(look.h, 0, HAIR_COLORS - 1, c),
        b: inRange(look.b, -1, BEARDS - 1, -1),
        bc: inRange(look.bc, 0, HAIR_COLORS - 1, c),
        e: inRange(look.e, -1, EYEBROWS - 1, 0),
        ec: inRange(look.ec, 0, HAIR_COLORS - 1, c),
        eye: inRange(look.eye, 0, EYE_COLORS - 1, 0)
    };
}
// Creator-era characters: the appearance blob (characters.appearance) is the saved look.
function blobLook(player) {
    const blob = player.character && player.character.appearance;
    if (!blob || !blob.hair) return null;
    const overlays = blob.overlays || {};
    const beard = overlays.beard || {}, brows = overlays.eyebrows || {};
    return withDefaults({
        d: blob.hair.style, c: blob.hair.color, h: blob.hair.highlight,
        b: Number.isInteger(beard.style) ? beard.style : -1, bc: beard.color,
        e: Number.isInteger(brows.style) ? brows.style : 0, ec: brows.color,
        eye: blob.eyeColor,
    });
}
function savedLook(player) {
    const fromBlob = blobLook(player);
    if (fromBlob) return fromBlob;
    const model = modelKey(player);
    const entry = store[keyOf(player)];
    return (model && entry && entry[model]) ? withDefaults(entry[model]) : null;
}
// What the player has on right now: the saved look, else the ped's hair + default face details.
function currentLook(player) {
    const saved = savedLook(player);
    if (saved) return saved;
    let d = 0, c = 0, h = 0;
    try { d = Number(player.getClothes(HAIR_COMPONENT).drawable) || 0; } catch (e) {}
    try { c = Number(player.hairColor) || 0; } catch (e) {}
    try { h = Number(player.hairHighlightColor) || 0; } catch (e) {}
    return withDefaults({ d, c, h });
}
function applyLook(player, look) {
    const model = modelKey(player);
    if (!model) return;
    // A character-creator appearance owns the head blend + face features; don't reset them to default.
    const hasCreatorLook = typeof global.creatorHasAppearance === 'function' && global.creatorHasAppearance(player);
    if (!hasCreatorLook) { try { player.setHeadBlend(...DEFAULT_BLEND[model]); } catch (e) {} }
    try { player.setClothes(HAIR_COMPONENT, look.d, 0, 0); } catch (e) {}
    try { player.setHairColor(look.c, look.h); } catch (e) {}
    try { player.setHeadOverlay(OVERLAY_BEARD, [look.b < 0 ? OVERLAY_NONE : look.b, 1.0, look.bc, look.bc]); } catch (e) {}
    try { player.setHeadOverlay(OVERLAY_EYEBROWS, [look.e < 0 ? OVERLAY_NONE : look.e, 1.0, look.ec, look.ec]); } catch (e) {}
    try { player.eyeColor = look.eye; } catch (e) {}
}
// Every freemode ped gets the head blend + its (saved or default) look, so colours/overlays render.
function restoreLook(player) {
    if (!mp.players.exists(player) || !modelKey(player)) return;
    // When the character has a creator appearance, that blob is authoritative — apply it instead.
    if (typeof global.creatorHasAppearance === 'function' && global.creatorHasAppearance(player)) {
        global.applyCreatorAppearance(player);
        return;
    }
    applyLook(player, currentLook(player));
}

function tell(player, message) {
    player.outputChatBox('!{#7ac8d0}[სალონი] !{#ffffff}' + message);
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
// Price of going from `from` to `to`, incl. government sales tax. Returns { base, tax, total }.
function quote(from, to) {
    let base = 0;
    Object.keys(PRICES).forEach(field => { if (to[field] !== from[field]) base += PRICES[field]; });
    const tax = Math.round(base * Math.max(0, taxRate()));
    return { base, tax, total: base + tax };
}

function clampInt(value, min, max) {
    const n = Math.floor(Number(value));
    if (!Number.isFinite(n)) return null;
    return (n < min || n > max) ? null : n;
}
// Validates a client look; null if any field is out of range. Female peds can't have a beard.
function parseLook(raw, model) {
    const look = {
        d: clampInt(raw.d, 0, MAX_HAIR_DRAWABLE),
        c: clampInt(raw.c, 0, HAIR_COLORS - 1),
        h: clampInt(raw.h, 0, HAIR_COLORS - 1),
        b: clampInt(raw.b, -1, BEARDS - 1),
        bc: clampInt(raw.bc, 0, HAIR_COLORS - 1),
        e: clampInt(raw.e, -1, EYEBROWS - 1),
        ec: clampInt(raw.ec, 0, HAIR_COLORS - 1),
        eye: clampInt(raw.eye, 0, EYE_COLORS - 1)
    };
    if (Object.keys(look).some(field => look[field] === null)) return null;
    if (model === 'f' && look.b !== -1) return null;
    return look;
}

// The client asks to open the salon (E, while still standing at it). If in range this starts the
// session and returns prices, balance and the current look; the client only then opens the UI.
mp.events.add('barber:leave', (player) => { player.barberSession = 0; player.dimension = 0; });
mp.events.add('barber:requestState', (player) => {
    const open = atShop(player) && !!modelKey(player);
    player.barberSession = open ? Date.now() : 0;
    if (open) player.dimension = 2000000 + player.id; // own instance so customers don't overlap

    if (!open) tell(player, atShop(player) ? 'სალონი მხოლოდ სტანდარტულ პერსონაჟს ემსახურება.' : 'მიდით სალონთან (რუკაზე მაკრატლის ნიშანი).');
    if (open) applyLook(player, currentLook(player)); // make sure the head blend is on before previewing
    player.call('barber:state', [JSON.stringify({
        open,
        money: (typeof global.getMoney === 'function' ? global.getMoney(player) : 0),
        taxRate: taxRate(),
        prices: PRICES,
        limits: { colors: HAIR_COLORS, beards: BEARDS, eyebrows: EYEBROWS, eyes: EYE_COLORS },
        blend: modelKey(player) ? DEFAULT_BLEND[modelKey(player)] : null,
        current: currentLook(player)
    })]);
});

// Checkout: lookJson = { d, c, h, b, bc, e, ec, eye } — the full look to end up with.
mp.events.add('barber:buy', (player, lookJson) => {
    const reply = (ok) => player.call('barber:result', [JSON.stringify({
        ok, money: (typeof global.getMoney === 'function' ? global.getMoney(player) : 0), current: currentLook(player)
    })]);
    const inSession = player.barberSession && (Date.now() - player.barberSession) < SESSION_MS;
    if (!inSession && !atShop(player)) { tell(player, 'გადასახდელად მიდით სალონში (რუკაზე მაკრატლის ნიშანი).'); return reply(false); }
    const model = modelKey(player);
    if (!model) { tell(player, 'სალონი მხოლოდ სტანდარტულ პერსონაჟს ემსახურება.'); return reply(false); }
    let raw;
    try { raw = JSON.parse(lookJson); } catch (e) { console.log('[barber] buy: bad JSON', lookJson); return reply(false); }
    const next = raw && typeof raw === 'object' ? parseLook(raw, model) : null;
    if (!next) {
        console.log(`[barber] buy rejected by parseLook — model=${model} raw=${JSON.stringify(raw)}`);
        tell(player, 'იერსახის მონაცემები არასწორია (სცადე თავიდან).');
        return reply(false);
    }
    if (typeof global.getMoney !== 'function' || typeof global.setMoney !== 'function') {
        tell(player, 'სისტემა ამჟამად მიუწვდომელია.');
        return reply(false);
    }

    const cost = quote(currentLook(player), next);
    if (cost.total <= 0) { tell(player, 'არაფერი შეცვლილა.'); return reply(false); }
    if (!global.canAfford(player, cost.total)) {
        tell(player, `არასაკმარისი თანხა — საჭიროა $${cost.total} ($${cost.base} + $${cost.tax} გადასახადი). თქვენ გაქვთ $${global.getMoney(player)}.`);
        return reply(false);
    }

    global.setMoney(player, global.getMoney(player) - cost.total);
    if (cost.tax > 0 && typeof global.govAddToTreasury === 'function') global.govAddToTreasury(cost.tax);
    applyLook(player, next);
    // Persist: for creator-era characters the change goes into the authoritative appearance blob
    // (so it survives respawn); otherwise it goes to barber.json as before.
    if (typeof global.creatorHasAppearance === 'function' && global.creatorHasAppearance(player) && player.character) {
        const blob = player.character.appearance;
        blob.hair = { style: next.d, color: next.c, highlight: next.h };
        if (!blob.overlays) blob.overlays = {};
        blob.overlays.beard = Object.assign({ opacity: 1 }, blob.overlays.beard, { style: next.b, color: next.bc });
        blob.overlays.eyebrows = Object.assign({ opacity: 1 }, blob.overlays.eyebrows, { style: next.e, color: next.ec });
        blob.eyeColor = next.eye;
        if (global.api) global.api.saveAppearance(player.character.id, blob).catch(() => {});
    } else {
        const key = keyOf(player);
        if (!store[key] || typeof store[key] !== 'object') store[key] = {};
        store[key][model] = next;
        save();
    }
    // keep barberSession alive so the player can keep buying items in this visit (cleared on barber:leave)
    tell(player, `ახალი იერსახე — $${cost.total}${cost.tax ? ` (მ.შ. $${cost.tax} გადასახადი)` : ''}. ბალანსი: $${global.getMoney(player)}.`);
    reply(true);
});

// Spawn and model changes reset the head; put the blend + look back (after inventory re-dresses the ped).
mp.events.add('playerReady', (player) => setTimeout(() => restoreLook(player), 1800));
mp.events.add('playerSpawn', (player) => setTimeout(() => restoreLook(player), 1300));

global.barberRestoreLook = (player) => restoreLook(player);
global.barberLocations = () => SHOP_LOCATIONS;
