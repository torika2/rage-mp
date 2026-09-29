// ===================== Shops: Ammu-Nation weapon sales =====================
// Server-authoritative: the server checks the player is physically at a gun store, checks money,
// applies the government sales tax (revenue -> treasury), then grants the weapon. The client only
// draws blips; it can never fabricate a purchase.
const AMMU_LOCATIONS = [
    { x: 22.09, y: -1107.28, z: 29.80 },
    { x: 810.25, y: -2157.60, z: 29.62 },
    { x: 1693.44, y: 3759.63, z: 34.70 },
    { x: -330.24, y: 6083.88, z: 31.45 },
    { x: 252.63, y: -50.00, z: 69.94 },
    { x: -662.10, y: -935.30, z: 21.83 },
    { x: -1305.18, y: -393.55, z: 36.70 },
    { x: -3172.55, y: 1085.79, z: 20.84 },
    { x: 2567.69, y: 294.38, z: 108.73 },
    { x: -1117.58, y: 2698.61, z: 18.55 },
    { x: 842.44, y: -1033.42, z: 28.19 }
];
const SHOP_RANGE = 6.0; // metres a player must be within to buy

const WEAPONS = {
    knife:        { label: 'დანა',                model: 'weapon_knife',        price: 150,   ammo: 1 },
    bat:          { label: 'ბეისბოლის ჯოხი',      model: 'weapon_bat',          price: 80,    ammo: 1 },
    pistol:       { label: 'პისტოლეტი',           model: 'weapon_pistol',       price: 500,   ammo: 60 },
    combatpistol: { label: 'საბრძოლო პისტოლეტი',  model: 'weapon_combatpistol', price: 900,   ammo: 60 },
    appistol:     { label: 'AP პისტოლეტი',        model: 'weapon_appistol',     price: 1500,  ammo: 90 },
    microsmg:     { label: 'მიკრო SMG',           model: 'weapon_microsmg',     price: 2500,  ammo: 120 },
    smg:          { label: 'SMG',                 model: 'weapon_smg',          price: 4000,  ammo: 150 },
    pumpshotgun:  { label: 'პომპიანი თოფი',       model: 'weapon_pumpshotgun',  price: 3500,  ammo: 40 },
    assaultrifle: { label: 'ავტომატური შაშხანა',  model: 'weapon_assaultrifle', price: 8000,  ammo: 150 },
    carbinerifle: { label: 'კარაბინი',            model: 'weapon_carbinerifle', price: 12000, ammo: 150 }
};
const ARMOR = { label: 'ჯავშანჟილეტი', price: 750, amount: 100 };

function tell(player, message) {
    player.outputChatBox('!{#c0894b}[იარაღის მაღაზია] !{#ffffff}' + message);
}

function atShop(player) {
    if (Number(player.dimension) !== 0) return false;
    const p = player.position;
    return AMMU_LOCATIONS.some(loc => {
        const dx = p.x - loc.x, dy = p.y - loc.y, dz = p.z - loc.z;
        return dx * dx + dy * dy + dz * dz <= SHOP_RANGE * SHOP_RANGE;
    });
}

// Sale price incl. government sales tax. Returns { base, tax, total }.
function priced(base) {
    const rate = (typeof global.govTaxRate === 'function' ? Number(global.govTaxRate()) : 0) || 0;
    const tax = Math.round(base * Math.max(0, rate));
    return { base, tax, total: base + tax };
}

function charge(player, cost) {
    if (typeof global.getMoney !== 'function') { tell(player, 'ეკონომიკა ამჟამად მიუწვდომელია.'); return false; }
    if (!global.canAfford(player, cost.total)) {
        tell(player, `არასაკმარისი თანხა — საჭიროა $${cost.total} ($${cost.base} + $${cost.tax} გადასახადი). თქვენ გაქვთ $${global.getMoney(player)}.`);
        return false;
    }
    global.setMoney(player, global.getMoney(player) - cost.total);
    if (cost.tax > 0 && typeof global.govAddToTreasury === 'function') global.govAddToTreasury(cost.tax);
    return true;
}

function buyWeapon(player, key) {
    if (!atShop(player)) return tell(player, 'ყიდვისთვის მიდით იარაღის მაღაზიაში (რუკაზე იარაღის ნიშანი).');
    const item = WEAPONS[String(key || '').toLowerCase()];
    if (!item) return tell(player, 'უცნობი იარაღი. სია: /guns.');
    const cost = priced(item.price);
    if (!charge(player, cost)) return;
    player.giveWeapon(mp.joaat(item.model), item.ammo);
    tell(player, `შეიძინეთ ${item.label} $${cost.total}-ად (მ.შ. $${cost.tax} გადასახადი). ბალანსი: $${global.getMoney(player)}.`);
}

function buyArmor(player) {
    if (!atShop(player)) return tell(player, 'ყიდვისთვის მიდით იარაღის მაღაზიაში (რუკაზე იარაღის ნიშანი).');
    if (Number(player.armour) >= ARMOR.amount) return tell(player, 'თქვენ უკვე გაქვთ სრული ჯავშანი.');
    const cost = priced(ARMOR.price);
    if (!charge(player, cost)) return;
    player.armour = ARMOR.amount;
    tell(player, `შეიძინეთ ${ARMOR.label} $${cost.total}-ად (მ.შ. $${cost.tax} გადასახადი). ბალანსი: $${global.getMoney(player)}.`);
}

mp.events.addCommand('guns', (player) => {
    if (!atShop(player)) return tell(player, 'ვაჭრობისთვის მიდით იარაღის მაღაზიაში (რუკაზე იარაღის ნიშანი).');
    tell(player, 'იყიდება იარაღი (გამოიყენეთ /buygun <key>):');
    Object.keys(WEAPONS).forEach(key => {
        const w = WEAPONS[key];
        const cost = priced(w.price);
        player.outputChatBox(`!{#9aa4ad}${key} !{#ffffff}— ${w.label}: $${cost.total}${cost.tax ? ` (მ.შ. $${cost.tax} გადასახადი)` : ''}`);
    });
    const armorCost = priced(ARMOR.price);
    player.outputChatBox(`!{#9aa4ad}armor !{#ffffff}— ${ARMOR.label}: $${armorCost.total} (/buyarmor)`);
});

mp.events.addCommand('buygun', (player, _, key) => buyWeapon(player, key));
mp.events.addCommand('buyarmor', (player) => buyArmor(player));

// CEF shop menu: send the catalog (prices incl. current tax) + the player's balance.
mp.events.add('shop:requestData', (player) => {
    if (!atShop(player)) { player.call('shop:setData', [JSON.stringify({ mode: 'weapons', title: 'იარაღის მაღაზია', money: 0, items: [] })]); return; }
    const items = Object.keys(WEAPONS).map(key => {
        const w = WEAPONS[key]; const c = priced(w.price);
        return { key, label: w.label, detail: c.tax ? `მ.შ. $${c.tax} გადასახადი` : '', price: c.total };
    });
    const armorCost = priced(ARMOR.price);
    items.push({ key: 'armor', label: ARMOR.label, detail: 'სრული ჯავშანი', price: armorCost.total });
    player.call('shop:setData', [JSON.stringify({ mode: 'weapons', title: 'იარაღის მაღაზია', money: global.getMoney(player), items })]);
});

// Purchases from the CEF menu route through the same server-authoritative checks as the commands.
mp.events.add('shop:buyWeapon', (player, key) => buyWeapon(player, key));
mp.events.add('shop:buyArmor', (player) => buyArmor(player));

// Expose the locations so the client can draw blips without duplicating the list.
global.ammuLocations = () => AMMU_LOCATIONS;
