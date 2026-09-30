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
    { key: 'bag',        kind: 'comp', id: 5,  label: 'ჩანთა',           base: 70,  step: 4 },
    { key: 'mask',       kind: 'comp', id: 1,  label: 'ნიღაბი',          base: 100, step: 5 },
    { key: 'neck',       kind: 'comp', id: 7,  label: 'აქსესუარი',       base: 90,  step: 5 },
    { key: 'hat',        kind: 'prop', id: 0,  label: 'ქუდი',            base: 45,  step: 3 },
    { key: 'glasses',    kind: 'prop', id: 1,  label: 'სათვალე',         base: 80,  step: 4 },
    { key: 'watch',      kind: 'prop', id: 6,  label: 'საათი',           base: 200, step: 15 },
    { key: 'bracelet',   kind: 'prop', id: 7,  label: 'სამაჯური',        base: 120, step: 8 }
];
const CAT_BY_KEY = {};
CATEGORIES.forEach(c => { CAT_BY_KEY[c.key] = c; });
// Shared with the inventory package so it can label/apply clothing items without duplicating this.
global.clothingCategories = () => CATEGORIES;
global.clothingCatByKey = (key) => CAT_BY_KEY[String(key)] || null;

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
mp.events.add('clothing:requestState', (player) => {
    const rate = (typeof global.govTaxRate === 'function' ? Number(global.govTaxRate()) : 0) || 0;
    player.call('clothing:state', [JSON.stringify({
        open: atStore(player),
        money: (typeof global.getMoney === 'function' ? global.getMoney(player) : 0),
        taxRate: rate,
        categories: CATEGORIES,
        worn: (typeof global.invWornClothing === 'function' ? global.invWornClothing(player) : {}),
        nude: (typeof global.invNudeLook === 'function' ? global.invNudeLook(player) : {}),
        topArms: (typeof global.invTopArms === 'function' ? global.invTopArms(player) : { def: 0, nude: 15, map: {} })
    })]);
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
    if (!atStore(player)) return tell(player, 'ყიდვისთვის მიდით ტანსაცმლის მაღაზიაში (რუკაზე მაისურის ნიშანი).');
    let cart;
    try { cart = JSON.parse(cartJson); } catch (e) { return; }
    if (!Array.isArray(cart) || !cart.length) return;
    if (typeof global.getMoney !== 'function' || typeof global.invRegisterCloth !== 'function'
        || typeof global.invAddItem !== 'function' || typeof global.invCapacity !== 'function') {
        return tell(player, 'სისტემა ამჟამად მიუწვდომელია.');
    }
    const items = [];
    let baseTotal = 0;
    cart.slice(0, 24).forEach(entry => {
        const cat = CAT_BY_KEY[String(entry && entry.cat)];
        if (!cat) return;
        const d = Math.max(0, Math.floor(Number(entry.d) || 0));
        const t = Math.max(0, Math.floor(Number(entry.t) || 0));
        baseTotal += basePriceOf(cat, d);
        items.push({ cat, d, t });
    });
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

// Expose the locations so the client can draw blips without duplicating the list.
global.clothingLocations = () => STORE_LOCATIONS;
