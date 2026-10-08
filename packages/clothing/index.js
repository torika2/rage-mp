// ===================== Clothing: Binco / Ponsonbys clothing stores =====================
// Server-authoritative catalog + cart. The client browses every drawable/texture the ped model
// actually supports (queried at runtime, so male & female both work) and tries them on locally.
// Nothing is worn on purchase: checkout recomputes the cart total from each item's index (so the
// client can't fake a cheaper price), charges money + government sales tax, and deposits each piece
// into the player's INVENTORY as a clothing item. The player then wears it from the inventory (I).
const STORE_LOCATIONS = [
    { x: 72.30, y: -1399.10, z: 29.38 },    // Binco — Davis
    { x: -703.80, y: -152.20, z: 37.42 },   // Ponsonbys — Rockford Hills
    { x: -165.00, y: -302.00, z: 39.73 },   // Suburban — Alta
    { x: -1193.40, y: -772.30, z: 17.32 },  // Suburban — Del Perro
    { x: -1447.80, y: -242.50, z: 49.82 },  // Ponsonbys — Morningwood
    { x: 425.20, y: -806.50, z: 29.49 },    // Suburban — Textile City
    { x: 123.60, y: -219.50, z: 54.56 },    // Ponsonbys — Burton
    { x: 613.10, y: 2762.60, z: 42.09 },    // Grapeseed
    { x: 1696.50, y: 4829.30, z: 42.06 },   // Sandy Shores
    { x: -3172.50, y: 1048.10, z: 20.86 },  // Chumash
    { x: 11.60, y: 6514.20, z: 31.88 }      // Paleto Bay
];
const STORE_RANGE = 6.0; // metres a player must be within to buy

// Clothing categories. `kind` is 'comp' (setClothes component) or 'prop' (setProp). `id` is the
// GTA component/prop slot. Price of an item = base + drawableIndex * step (colour/texture is free).
// Body armour (component 9) is deliberately excluded — the inventory (ჟილეტი) owns that slot.
const CATEGORIES = [
    { key: 'top',        kind: 'comp', id: 11, label: 'ზედა ტანსაცმელი', base: 150, step: 8 },
    { key: 'undershirt', kind: 'comp', id: 8,  label: 'მაისური',         base: 60,  step: 4 },
    // NOTE: component 3 (torso/arms) is intentionally NOT sold here — it changes the character's
    // body/arms, not clothing. Leave it to the character/surgery system.
    { key: 'pants',      kind: 'comp', id: 4,  label: 'შარვალი',         base: 120, step: 6 },
    { key: 'shoes',      kind: 'comp', id: 6,  label: 'ფეხსაცმელი',      base: 90,  step: 5 },
    { key: 'bag',        kind: 'comp', id: 5,  label: 'ჩანთა',           base: 70,  step: 4, vip: true, noShop: true }, // VIP-only (future GCOINS shop) — hidden from the normal store
    { key: 'mask',       kind: 'comp', id: 1,  label: 'ნიღაბი',          base: 100, step: 5 },
    { key: 'neck',       kind: 'comp', id: 7,  label: 'აქსესუარი',       base: 90,  step: 5 },
    { key: 'decal',      kind: 'comp', id: 10, label: 'ემბლემა',         base: 60,  step: 2, noShop: true }, // not sold in the clothing store
    { key: 'hat',        kind: 'prop', id: 0,  label: 'ქუდი',            base: 45,  step: 3 },
    { key: 'glasses',    kind: 'prop', id: 1,  label: 'სათვალე',         base: 80,  step: 4 },
    { key: 'ears',       kind: 'prop', id: 2,  label: 'საყურე',          base: 90,  step: 4 },
    { key: 'watch',      kind: 'prop', id: 6,  label: 'საათი',           base: 200, step: 15 },
    { key: 'bracelet',   kind: 'prop', id: 7,  label: 'სამაჯური',        base: 120, step: 8 }
];
const CAT_BY_KEY = {};
CATEGORIES.forEach(c => { CAT_BY_KEY[c.key] = c; });
// Categories the normal clothing store shows/sells. `noShop` categories (bags → future GCOINS shop;
// decals/emblems → not sold) stay in CATEGORIES so owned items can still be worn/labelled, but are
// excluded from the store browse list + buy flow.
const SHOP_CATEGORIES = CATEGORIES.filter(c => !c.noShop);
// Shared with the inventory package so it can label/apply clothing items without duplicating this.
global.clothingCategories = () => CATEGORIES;
global.clothingCatByKey = (key) => CAT_BY_KEY[String(key)] || null;

// ---- Admin-disabled shop colours (per gender + category + drawable + texture), backed by the DB ----
// Source of truth is the `disabled_clothing` table (api/src/clothing); loaded here into an in-memory
// Set on boot and kept in sync on every toggle. Effect: hidden from non-admins in the shop, blocked in
// buyCart (server-authoritative), and force-removed from everyone (online now + each player on login).
const disabledCloth = new Set();
const disKey = (gender, cat, drawable, texture) => `${gender}|${cat}|${drawable}|${texture}`;
// A colour is unavailable in the public store if: its exact entry is admin-disabled, the whole drawable
// is admin-disabled (texture -1 sentinel), OR it's reserved as a gang uniform piece (packages/gangs).
function isClothReserved(cat, drawable, texture) {
    return typeof global.gangWardrobeHas === 'function' && global.gangWardrobeHas(cat, drawable, texture);
}
function isClothDisabled(gender, cat, drawable, texture) {
    if (!gender) return false;
    if (disabledCloth.has(disKey(gender, cat, drawable, -1)) || disabledCloth.has(disKey(gender, cat, drawable, texture))) return true;
    return isClothReserved(cat, drawable, texture);
}
function disabledListFor(gender) {
    const out = [];
    if (!gender) return out;
    disabledCloth.forEach(k => { const [g, cat, d, t] = k.split('|'); if (g === gender) out.push({ cat, d: Number(d), t: Number(t) }); });
    return out;
}
// Gang-uniform pieces reserved out of the public store (gender-agnostic for now).
function reservedList() {
    return (typeof global.gangWardrobePieces === 'function') ? global.gangWardrobePieces() : [];
}
// What the shop UI needs per player: admin flag, the admin-toggleable DB list, and the set the CLIENT
// must hide outright. Players hide DB-disabled + reserved; admins still see/toggle DB-disabled but
// reserved uniform pieces are hidden from the store for everyone (managed in packages/gangs config).
function disabledSetsFor(player) {
    const gender = genderOf(player);
    const isAdmin = !!(typeof global.isProtectedAdmin === 'function' && global.isProtectedAdmin(player));
    const dbList = disabledListFor(gender);
    const reserved = reservedList();
    const hidden = isAdmin ? reserved.slice() : dbList.concat(reserved);
    return { isAdmin, disabled: dbList, hidden };
}
// Load the disabled set from the DB. The game server often boots a few seconds before the API is
// accepting connections, so a single attempt can hit ECONNREFUSED and leave the set empty (= nothing
// disabled in the shop). Retry with backoff until the API answers.
async function loadDisabledCloth(attempt = 1) {
    if (!global.api || typeof global.api.loadDisabledClothing !== 'function') return;
    try {
        const rows = await global.api.loadDisabledClothing();
        if (!Array.isArray(rows)) throw new Error('unexpected response');
        disabledCloth.clear();
        rows.forEach(r => disabledCloth.add(disKey(r.gender, r.cat, Number(r.drawable), Number(r.texture))));
        console.log(`[clothing] loaded ${disabledCloth.size} disabled colour(s)` + (attempt > 1 ? ` (attempt ${attempt})` : ''));
    } catch (e) {
        if (attempt <= 20) { // ~ up to 60s of API-startup lag
            if (attempt === 1) console.log('[clothing] disabled colours not ready yet (' + (e && e.message) + '); retrying…');
            setTimeout(() => loadDisabledCloth(attempt + 1), 3000);
            return;
        }
        console.log('[clothing] gave up loading disabled colours after ' + attempt + ' attempts: ' + (e && e.message));
    }
}
loadDisabledCloth();
// Force-remove every disabled colour for a gender from all matching online players.
function scrubDisabled(gender) {
    if (!gender || typeof global.invScrubCloth !== 'function') return;
    const reject = (cat, d, t) => isClothDisabled(gender, cat, d, t);
    mp.players.forEach(p => { if (genderOf(p) === gender) global.invScrubCloth(p, reject); });
}

// ---- Matching arms (component 3, "torso") for every top, so sleeves/arms don't clip ----
// data/besttorso.json is generated by tools/gen-clothing-data.py from the game's shop metadata:
// { m|f: { topDrawable: [torsoD, torsoT] | [[torsoD, torsoT] | 0 per texture] } }. About 15% of tops
// (mostly the base-game ones the game hardcodes in scripts) have no data; an admin fixes those
// in-game with /armsfit, saved to data/torso_overrides.json (same shape, wins over the dump).
const fs = require('fs');
const path = require('path');
const dlc = require('./dlc'); // DLC upload times + "new item" ranges
const TORSO_FILE = path.join(__dirname, 'data', 'besttorso.json');
const OVERRIDE_FILE = path.join(__dirname, 'data', 'torso_overrides.json');
let TORSO = { m: {}, f: {} };
try { TORSO = Object.assign(TORSO, JSON.parse(fs.readFileSync(TORSO_FILE, 'utf8'))); } catch (e) { console.log('[clothing] besttorso.json missing — run tools/gen-clothing-data.py'); }
let torsoOverrides = { m: {}, f: {} };
try { torsoOverrides = Object.assign(torsoOverrides, JSON.parse(fs.readFileSync(OVERRIDE_FILE, 'utf8'))); } catch (e) {}
function saveOverrides() {
    const temporaryFile = OVERRIDE_FILE + '.tmp';
    try { fs.writeFileSync(temporaryFile, JSON.stringify(torsoOverrides)); fs.renameSync(temporaryFile, OVERRIDE_FILE); } catch (e) {}
}
const FREEMODE_MALE = mp.joaat('mp_m_freemode_01');
const FREEMODE_FEMALE = mp.joaat('mp_f_freemode_01');
function genderOf(player) {
    const model = Number(player.model);
    return model === FREEMODE_MALE ? 'm' : (model === FREEMODE_FEMALE ? 'f' : null);
}
// The torso table this player's model uses (dump + admin overrides), sent to the shop for previews.
function torsoMap(player) {
    const gender = genderOf(player);
    return gender ? Object.assign({}, TORSO[gender], torsoOverrides[gender]) : {};
}
// [torsoDrawable, torsoTexture] for a top, or null when unknown (caller falls back to its default).
function torsoFor(player, drawable, texture) {
    const gender = genderOf(player);
    if (!gender) return null;
    const entry = torsoOverrides[gender][drawable] || TORSO[gender][drawable];
    if (!Array.isArray(entry)) return null;
    if (typeof entry[0] === 'number') return entry;
    return entry[texture] || entry.find(item => Array.isArray(item)) || null;
}
global.clothingTorsoFor = torsoFor;
global.clothingTorsoMap = torsoMap;

function tell(player, message) {
    player.outputChatBox('!{#c07ad0}[ტანსაცმლის მაღაზია] !{#ffffff}' + message);
}

function atStore(player) {
    if (Number(player.dimension) !== 0) return false;
    const p = player.position;
    return STORE_LOCATIONS.some(loc => {
        const dx = p.x - loc.x, dy = p.y - loc.y, dz = p.z - loc.z;
        return dx * dx + dy * dy + dz * dz <= STORE_RANGE * STORE_RANGE;
    });
}

// Sale price incl. government sales tax. Returns { base, tax, total }.
function priced(base) {
    const rate = (typeof global.govTaxRate === 'function' ? Number(global.govTaxRate()) : 0) || 0;
    const tax = Math.round(base * Math.max(0, rate));
    return { base, tax, total: base + tax };
}
function basePriceOf(cat, drawable) {
    return drawable < 0 ? 0 : Math.round(cat.base + Math.max(0, drawable) * cat.step);
}

// The client requests the catalog (ids/labels/prices) + the current balance to browse & preview.
// Private dimension per player while in a shop, so customers don't stack on the shared dressing spot.
const SHOP_DIM_BASE = 2000000;
const SHOP_SESSION_MS = 15 * 60 * 1000;
function clothingInSession(player) { return player.clothingSession && (Date.now() - player.clothingSession) < SHOP_SESSION_MS; }
mp.events.add('clothing:leave', (player) => { player.clothingSession = 0; player.dimension = 0; });

mp.events.add('clothing:requestState', (player) => {
    const open = atStore(player);
    if (open) { player.clothingSession = Date.now(); player.dimension = SHOP_DIM_BASE + player.id; } // own instance
    const rate = (typeof global.govTaxRate === 'function' ? Number(global.govTaxRate()) : 0) || 0;
    player.call('clothing:state', [JSON.stringify({
        open,
        gender: genderOf(player),
        money: (typeof global.getMoney === 'function' ? global.getMoney(player) : 0),
        taxRate: rate,
        categories: SHOP_CATEGORIES,
        worn: (typeof global.invWornClothing === 'function' ? global.invWornClothing(player) : {}),
        nude: (typeof global.invNudeLook === 'function' ? global.invNudeLook(player) : {}),
        topArms: (typeof global.invTopArms === 'function' ? global.invTopArms(player) : { def: 0, nude: 15, map: {} }),
        ...disabledSetsFor(player)
    })]);
});

// Admin (protected only): disable/enable one colour of an item. Persists to the DB, updates the
// in-memory set, force-removes it from everyone of this gender, and refreshes any open shops.
mp.events.add('clothing:toggleDisabled', async (player, catKey, drawable, texture, disable) => {
    if (typeof global.isProtectedAdmin !== 'function' || !global.isProtectedAdmin(player)) return;
    const cat = CAT_BY_KEY[String(catKey)];
    const gender = genderOf(player);
    if (!cat || !gender) return;
    const d = Math.max(0, Math.floor(Number(drawable) || 0));
    let t = Math.floor(Number(texture)); if (!Number.isInteger(t) || t < -1) t = 0; // -1 = whole drawable
    const on = !!disable;
    try {
        if (on) await global.api.disableClothing(gender, cat.key, d, t);
        else await global.api.enableClothing(gender, cat.key, d, t);
    } catch (e) { return tell(player, 'ბაზასთან კავშირი ვერ მოხერხდა — სცადეთ თავიდან.'); }
    if (on) disabledCloth.add(disKey(gender, cat.key, d, t));
    else disabledCloth.delete(disKey(gender, cat.key, d, t));
    if (on) scrubDisabled(gender); // force-remove from everyone wearing/owning it now
    // Refresh every open shop of this gender (admins re-render toggles, players re-hide). Per-player,
    // since admins and players get different hidden sets.
    mp.players.forEach(p => {
        if (genderOf(p) === gender && clothingInSession(p)) {
            try { p.call('clothing:disabledUpdate', [JSON.stringify(disabledSetsFor(p))]); } catch (e) {}
        }
    });
    const what = t === -1 ? `${cat.label} #${d + 1} (მთლიანად)` : `${cat.label} #${d + 1}/${t + 1}`;
    tell(player, `${on ? 'გათიშე' : 'ჩართე'}: ${what}`);
});

// The shop reports its per-slot drawable counts; we stamp growth with the pack's upload time and reply
// with the ranges so the shop can label recent additions as new.
mp.events.add('clothing:reportCounts', (player, countsJson) => {
    if (!atStore(player)) return;
    const gender = genderOf(player);
    if (!gender) return;
    let counts;
    try { counts = JSON.parse(countsJson); } catch (e) { return; }
    const ranges = dlc.reportCounts(gender, counts);
    player.call('clothing:newInfo', [JSON.stringify({ now: Date.now(), newDays: dlc.NEW_DAYS, ranges })]);
});

// /dlcs — admin: every recorded add-on pack with its upload time, and the new-item ranges per slot.
mp.events.addCommand('dlcs', (player) => {
    if (typeof global.isProtectedAdmin !== 'function' || !global.isProtectedAdmin(player)) return tell(player, 'მხოლოდ ადმინისთვის.');
    const packs = dlc.scanPacks().packs;
    Object.keys(packs).forEach(name => {
        const p = packs[name];
        const days = Math.floor((Date.now() - p.uploadedAt) / 86400000);
        player.outputChatBox(`!{#c07ad0}[DLC] !{#ffffff}${name}${p.clothing ? ' (' + (p.gender || 'm+f') + ')' : ''}${p.missing ? ' [missing]' : ''} — ${new Date(p.uploadedAt).toISOString().slice(0, 16).replace('T', ' ')} (${days}d)`);
    });
    ['m', 'f'].forEach(g => {
        const slots = dlc.ranges(g);
        const text = Object.keys(slots).filter(k => slots[k].ranges.length)
            .map(k => `${k} ${slots[k].ranges.map(r => r.from + '-' + (r.to - 1)).join(',')}`).join(' · ');
        if (text) player.outputChatBox(`!{#c07ad0}[DLC] !{#ffffff}${g}: ${text}`);
    });
});

// Take a worn piece off from inside the shop: it moves into the inventory (or is refused if full).
mp.events.add('clothing:unequip', (player, cat) => {
    if (typeof global.invUnequipCloth !== 'function') return;
    const result = global.invUnequipCloth(player, cat) || {};
    const worn = (typeof global.invWornClothing === 'function' ? global.invWornClothing(player) : {});
    player.call('clothing:unequipResult', [JSON.stringify({ ok: !!result.ok, full: !!result.full, cat: String(cat), worn })]);
});

// Checkout: buy every item in the cart at once. cart = [{ cat, d, t }, ...].
mp.events.add('clothing:buyCart', (player, cartJson) => {
    if (!atStore(player) && !clothingInSession(player)) return tell(player, 'ყიდვისთვის მიდით ტანსაცმლის მაღაზიაში (რუკაზე მაისურის ნიშანი).');
    let cart;
    try { cart = JSON.parse(cartJson); } catch (e) { return; }
    if (!Array.isArray(cart) || !cart.length) return;
    if (typeof global.getMoney !== 'function' || typeof global.invRegisterCloth !== 'function'
        || typeof global.invAddItem !== 'function' || typeof global.invCapacity !== 'function') {
        return tell(player, 'სისტემა ამჟამად მიუწვდომელია.');
    }
    const gender = genderOf(player);
    const items = [];
    let baseTotal = 0, blocked = 0;
    cart.slice(0, 24).forEach(entry => {
        const cat = CAT_BY_KEY[String(entry && entry.cat)];
        if (!cat || cat.noShop) return; // bags/decals aren't buyable in the normal store
        const d = Math.max(0, Math.floor(Number(entry.d) || 0));
        const t = Math.max(0, Math.floor(Number(entry.t) || 0));
        if (isClothDisabled(gender, cat.key, d, t)) { blocked++; return; } // admin-disabled — can't buy
        baseTotal += basePriceOf(cat, d);
        items.push({ cat, d, t });
    });
    if (blocked) tell(player, `${blocked} ნივთი მიუწვდომელია (ადმინმა გათიშა) და არ შეძენილა.`);
    if (!items.length) return;

    const cost = priced(baseTotal);
    if (!global.canAfford(player, cost.total)) {
        tell(player, `არასაკმარისი თანხა — საჭიროა $${cost.total} ($${cost.base} + $${cost.tax} გადასახადი). თქვენ გაქვთ $${global.getMoney(player)}.`);
        return player.call('clothing:cartResult', [JSON.stringify({ ok: false, money: global.getMoney(player) })]);
    }
    const cap = global.invCapacity(player);
    if (cap && (cap.max - cap.used) < items.length) {
        tell(player, `ინვენტარში ადგილი არ არის (საჭიროა ${items.length} სლოტი).`);
        return player.call('clothing:cartResult', [JSON.stringify({ ok: false, full: true, money: global.getMoney(player) })]);
    }

    global.setMoney(player, global.getMoney(player) - cost.total);
    if (cost.tax > 0 && typeof global.govAddToTreasury === 'function') global.govAddToTreasury(cost.tax);
    let added = 0;
    items.forEach(it => {
        const id = global.invRegisterCloth(it.cat.key, it.d, it.t);
        if (id && global.invAddItem(player, id, 1)) added++;
    });
    tell(player, `შეიძინეთ ${added} ნივთი $${cost.total}-ად${cost.tax ? ` (მ.შ. $${cost.tax} გადასახადი)` : ''}. ჩასაცმელად გახსენით ინვენტარი (I). ბალანსი: $${global.getMoney(player)}.`);
    player.call('clothing:cartResult', [JSON.stringify({ ok: true, added, money: global.getMoney(player) })]);
});

// On login, force-remove any now-disabled clothing this character still wears or carries (covers
// players who were offline when a colour was disabled). Delayed so the inventory has loaded from the DB.
if (typeof global.onCharacterLoad === 'function') {
    global.onCharacterLoad((player) => {
        setTimeout(() => {
            if (!mp.players.exists(player)) return;
            const gender = genderOf(player);
            if (gender && typeof global.invScrubCloth === 'function') {
                global.invScrubCloth(player, (cat, d, t) => isClothDisabled(gender, cat, d, t));
            }
        }, 6000);
    });
}

// /armsfit <torsoDrawable> [torsoTexture] — admin: fix the arms for the top you're wearing (for tops
// the dump has no data for, or gets wrong). Saved per model; applies to everyone wearing that top.
mp.events.addCommand('armsfit', (player, _, drawableArg, textureArg) => {
    if (typeof global.isProtectedAdmin !== 'function' || !global.isProtectedAdmin(player)) return tell(player, 'მხოლოდ ადმინისთვის.');
    const gender = genderOf(player);
    if (!gender) return tell(player, 'მხოლოდ სტანდარტულ პერსონაჟზე.');
    const torsoD = parseInt(drawableArg, 10), torsoT = parseInt(textureArg || '0', 10);
    let top = 0;
    try { top = Number(player.getClothes(11).drawable) || 0; } catch (e) {}
    if (drawableArg === 'reset') {
        delete torsoOverrides[gender][top];
        saveOverrides();
        return tell(player, `ზედა #${top}: ხელები დაბრუნდა მონაცემებზე.`);
    }
    if (!Number.isInteger(torsoD) || torsoD < 0 || torsoD > 400 || !Number.isInteger(torsoT) || torsoT < 0 || torsoT > 30) {
        return tell(player, 'გამოყენება: /armsfit <ხელების #> [ტექსტურა]  ან  /armsfit reset  (ჩაცმულ ზედაზე)');
    }
    torsoOverrides[gender][top] = [torsoD, torsoT];
    saveOverrides();
    try { player.setClothes(3, torsoD, torsoT, 0); } catch (e) {}
    tell(player, `ზედა #${top} (${gender === 'm' ? 'კაცი' : 'ქალი'}): ხელები = ${torsoD}/${torsoT} — შენახულია.`);
});

// Expose the locations so the client can draw blips without duplicating the list.
global.clothingLocations = () => STORE_LOCATIONS;
