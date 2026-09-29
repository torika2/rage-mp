// ===================== Market: 24/7 mini-market =====================
// Server-authoritative: the server verifies the player is at a store, checks money, applies the
// government sales tax (revenue -> treasury), then adds the item to the player's inventory
// (packages/inventory). Items are Used later from the inventory (I).
const STORE_LOCATIONS = [
    { x: 25.70, y: -1347.30, z: 29.50 },
    { x: -47.50, y: -1757.50, z: 29.42 },
    { x: 373.50, y: 325.60, z: 103.57 },
    { x: 1135.80, y: -982.30, z: 46.20 },
    { x: -707.50, y: -914.30, z: 19.22 },
    { x: -1223.00, y: -908.00, z: 12.33 },
    { x: -1487.60, y: -379.10, z: 40.16 },
    { x: 1728.70, y: 6414.10, z: 35.04 },
    { x: 1698.40, y: 4924.40, z: 42.06 },
    { x: 1961.50, y: 3740.70, z: 32.34 },
    { x: 547.40, y: 2671.70, z: 42.16 },
    { x: 2678.50, y: 3280.70, z: 55.24 },
    { x: -3038.70, y: 585.90, z: 7.91 }
];
const STORE_RANGE = 5.0;

const ITEMS = {
    water:    { label: 'წყალი',            price: 5,   health: 10 },
    soda:     { label: 'კოლა',             price: 8,   health: 15 },
    energy:   { label: 'ენერგეტიკული',     price: 12,  health: 20 },
    chips:    { label: 'ჩიფსი',            price: 10,  health: 15 },
    sandwich: { label: 'სენდვიჩი',         price: 15,  health: 25 },
    burger:   { label: 'ბურგერი',          price: 25,  health: 40 },
    medkit:   { label: 'სამედიცინო ნაკრები', price: 200, health: 100 }
};

function tell(player, message) {
    player.outputChatBox('!{#5bbf8e}[24/7] !{#ffffff}' + message);
}

function atStore(player) {
    if (Number(player.dimension) !== 0) return false;
    const p = player.position;
    return STORE_LOCATIONS.some(loc => {
        const dx = p.x - loc.x, dy = p.y - loc.y, dz = p.z - loc.z;
        return dx * dx + dy * dy + dz * dz <= STORE_RANGE * STORE_RANGE;
    });
}

function priced(base) {
    const rate = (typeof global.govTaxRate === 'function' ? Number(global.govTaxRate()) : 0) || 0;
    const tax = Math.round(base * Math.max(0, rate));
    return { base, tax, total: base + tax };
}

function charge(player, cost) {
    if (typeof global.getMoney !== 'function') { tell(player, 'ეკონომიკა ამჟამად მიუწვდომელია.'); return false; }
    if (!global.canAfford(player, cost.total)) {
        tell(player, `არასაკმარისი თანხა — საჭიროა $${cost.total}${cost.tax ? ` (მ.შ. $${cost.tax} გადასახადი)` : ''}. თქვენ გაქვთ $${global.getMoney(player)}.`);
        return false;
    }
    global.setMoney(player, global.getMoney(player) - cost.total);
    if (cost.tax > 0 && typeof global.govAddToTreasury === 'function') global.govAddToTreasury(cost.tax);
    return true;
}

function buyItem(player, key, quantity) {
    if (!atStore(player)) return tell(player, 'ყიდვისთვის მიდით 24/7 მაღაზიაში (რუკაზე მაღაზიის ნიშანი).');
    const id = String(key || '').toLowerCase();
    const item = ITEMS[id];
    if (!item) return tell(player, 'უცნობი ნივთი. სია: /store.');
    const qty = Math.max(1, Math.min(99, Math.floor(Number(quantity) || 1)));
    if (typeof global.invHasSpace !== 'function') return tell(player, 'ინვენტარი ამჟამად მიუწვდომელია.');
    if (!global.invHasSpace(player, id)) return tell(player, 'თქვენი ინვენტარი სავსეა.');
    const unit = priced(item.price);
    const cost = { base: unit.base * qty, tax: unit.tax * qty, total: unit.total * qty };
    if (!charge(player, cost)) return;
    global.invAddItem(player, id, qty);
    tell(player, `შეიძინეთ ${item.label} ×${qty} — $${cost.total}${cost.tax ? ` (მ.შ. $${cost.tax} გადასახადი)` : ''}. დაემატა ინვენტარში (I). ბალანსი: $${global.getMoney(player)}.`);
}

mp.events.addCommand('store', (player) => {
    if (!atStore(player)) return tell(player, 'ვაჭრობისთვის მიდით 24/7 მაღაზიაში (რუკაზე მაღაზიის ნიშანი).');
    tell(player, 'იყიდება ნივთები (გამოიყენეთ /buy <key>):');
    Object.keys(ITEMS).forEach(key => {
        const item = ITEMS[key];
        const cost = priced(item.price);
        player.outputChatBox(`!{#9aa4ad}${key} !{#ffffff}— ${item.label}: $${cost.total} (+${item.health} HP)`);
    });
});

mp.events.addCommand('buy', (player, _, key, qty) => buyItem(player, key, qty));

// CEF store menu: send the catalog (prices incl. current tax) + balance + inventory capacity.
mp.events.add('market:requestData', (player) => {
    const capacity = (typeof global.invCapacity === 'function') ? global.invCapacity(player) : { used: 0, max: 0 };
    if (!atStore(player)) { player.call('shop:setData', [JSON.stringify({ mode: 'market', title: '24/7 მაღაზია', money: 0, items: [], capacity })]); return; }
    const items = Object.keys(ITEMS).map(key => {
        const item = ITEMS[key]; const c = priced(item.price);
        return { key, label: item.label, detail: `+${item.health} HP${c.tax ? ` · მ.შ. $${c.tax} გადასახადი` : ''}`, price: c.total };
    });
    player.call('shop:setData', [JSON.stringify({ mode: 'market', title: '24/7 მაღაზია', money: global.getMoney(player), items, capacity })]);
});

// Purchases from the CEF menu route through the same server-authoritative checks as the commands.
mp.events.add('market:buy', (player, key, qty) => buyItem(player, key, qty));
