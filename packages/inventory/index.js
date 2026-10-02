// ===================== Inventory: persistent per-player items =====================
// Server-authoritative item storage keyed by Social Club, persisted to inventory.json.
// Phase 4 core: the 25-slot PERSONAL inventory. Market purchases add items here; the player
// opens the inventory (I) and Uses (applies effect) or Drops them. Clothing/vehicle-storage
// panels in the UI are wired later — this owns the personal item grid.
const fs = require('fs');
const path = require('path');

const DATA_FILE = path.join(__dirname, 'inventory.json');
const MAX_SLOTS = 25; // personal inventory capacity (unique item stacks)
const QUICK_SLOTS = 4; // quick-access bar, stored right after the grid (indexes 25..28)
const TOTAL_SLOTS = MAX_SLOTS + QUICK_SLOTS;

// Item catalog. `health` consumables heal on Use. Other packages (e.g. shops) add their own
// item types to the shared global.invItemDefs registry, so load order doesn't matter.
const ITEM_DEFS = global.invItemDefs = Object.assign(global.invItemDefs || {}, {
    // hunger/thirst restore the survival stats (packages/needs), 0-100.
    // anim/prop: eat or drink animation with that object in hand (see CONSUME_ANIMS).
    water:    { label: 'წყალი',            type: 'consumable', health: 10, thirst: 35, anim: 'drink', prop: 'prop_ld_flow_bottle' },
    soda:     { label: 'კოლა',             type: 'consumable', health: 15, thirst: 25, hunger: 5, anim: 'drinkCan', prop: 'prop_ecola_can' },
    energy:   { label: 'ენერგეტიკული',     type: 'consumable', health: 20, thirst: 20, anim: 'drinkCan', prop: 'prop_energy_drink' },
    chips:    { label: 'ჩიფსი',            type: 'consumable', health: 15, hunger: 15, anim: 'eat', prop: 'prop_ld_snack_01' },
    sandwich: { label: 'სენდვიჩი',         type: 'consumable', health: 25, hunger: 35, anim: 'eat', prop: 'prop_sandwich_01' },
    burger:   { label: 'ბურგერი',          type: 'consumable', health: 40, hunger: 50, anim: 'eat', prop: 'prop_cs_burger_01' },
    medkit:   { label: 'სამედიცინო ნაკრები', type: 'consumable', health: 100 }
    // Weapons, their own ammo items (ammo_<weapon>, type 'ammo', qty = rounds) and armour are
    // registered by packages/shops. `stackable: false` items take one slot each (e.g. armour).
});

// Eat/drink animations: upper body only (flag 49 = loop + upper body + can move), stopped after `ms`.
const CONSUME_ANIMS = {
    eat:   { dict: 'mp_player_inteat@burger', name: 'mp_player_int_eat_burger', ms: 3500 },
    drink: { dict: 'mp_player_intdrink',      name: 'loop_bottle',              ms: 3500 }, // bottle
    drinkCan: { dict: 'amb@world_human_drinking@coffee@male@idle_a', name: 'idle_c', ms: 3500 } // can held upright
};
const ANIM_FLAG = 49;

function playConsumeAnim(player, def) {
    const anim = CONSUME_ANIMS[def.anim];
    if (!anim || player.vehicle) return; // no animation while driving/in a vehicle
    player.invBusyUntil = Date.now() + anim.ms;
    player.playAnimation(anim.dict, anim.name, 8.0, ANIM_FLAG);
    // Prop in hand, created client-side for everyone nearby.
    mp.players.callInRange(player.position, 150, 'inventory:consumeProp', [player.id, def.prop, def.anim, anim.ms]);
    setTimeout(() => { if (mp.players.exists(player)) player.stopAnimation(); }, anim.ms);
}

// ---- Clothing items (bought at the clothing store, worn from the inventory) ----
// A clothing item id encodes its look: cloth_<category>_<drawable>_<texture>. The def is rebuilt on
// demand from the id (nothing extra to persist), labelled from the shared category list owned by
// packages/clothing.
function clothCats() { return (typeof global.clothingCategories === 'function' ? global.clothingCategories() : []); }
function clothCat(cat) { return (typeof global.clothingCatByKey === 'function' ? global.clothingCatByKey(cat) : (clothCats().find(c => c.key === cat) || null)); }
function parseCloth(id) {
    if (typeof id !== 'string' || id.indexOf('cloth_') !== 0) return null;
    const parts = id.split('_');
    if (parts.length < 4) return null;
    const drawable = parseInt(parts[2], 10), texture = parseInt(parts[3], 10);
    if (!Number.isInteger(drawable) || !Number.isInteger(texture)) return null;
    return { cat: parts[1], d: drawable, t: texture };
}
function clothItemLabel(parsed) {
    const c = clothCat(parsed.cat);
    return (c ? c.label : parsed.cat) + ' #' + (parsed.d + 1) + (parsed.t ? '/' + (parsed.t + 1) : '');
}
function ensureClothDef(id) {
    if (ITEM_DEFS[id]) return ITEM_DEFS[id];
    const parsed = parseCloth(id);
    if (!parsed) return null;
    ITEM_DEFS[id] = { label: clothItemLabel(parsed), type: 'clothing', stackable: false, cloth: parsed };
    return ITEM_DEFS[id];
}
// packages/clothing calls this on checkout so the def exists before the item is added.
global.invRegisterCloth = (cat, drawable, texture) => {
    const id = 'cloth_' + cat + '_' + Math.max(0, drawable) + '_' + Math.max(0, texture);
    return ensureClothDef(id) ? id : null;
};
// A top (component 11) needs a matching arms variant (component 3) or the sleeves clip. The pairing
// comes from packages/clothing (GTA's shop data per model/top/texture + admin /armsfit overrides);
// tops with no known pairing fall back to DEFAULT_ARMS. Returns [armsDrawable, armsTexture].
const ARMS_COMPONENT = 3;
const DEFAULT_ARMS = 0;
function armsForTop(player, drawable, texture) {
    const torso = (typeof global.clothingTorsoFor === 'function') ? global.clothingTorsoFor(player, drawable, texture) : null;
    return torso || [DEFAULT_ARMS, 0];
}

// Put a clothing look on the ped (server-side setClothes -> syncs). Props are also echoed to the
// wearer's own client, since server-side props don't sync on every RAGE:MP build.
function applyCloth(player, cat, drawable, texture) {
    const c = clothCat(cat);
    if (!c) return;
    try {
        if (c.kind === 'comp') {
            player.setClothes(c.id, Math.max(0, drawable), Math.max(0, texture), 0);
            if (cat === 'top') {
                const arms = armsForTop(player, Math.max(0, drawable), Math.max(0, texture));
                try { player.setClothes(ARMS_COMPONENT, arms[0], arms[1], 0); } catch (e) {}
            }
            return;
        }
        if (drawable < 0) player.setProp(c.id, -1, 0);
        else player.setProp(c.id, drawable, Math.max(0, texture));
    } catch (e) {}
    if (c.kind === 'prop') { try { player.call('inventory:selfProp', [c.id, drawable, Math.max(0, texture)]); } catch (e) {} }
}
// The bare body ("naked") look per clothing category — used on spawn for empty slots and when a
// piece is taken off, so nothing shows unless it's actually equipped. Freemode drawable indices;
// tweak these if a value looks off on your peds.
const FREEMODE_FEMALE = mp.joaat('mp_f_freemode_01');
// Bare-body ("naked") look, keyed by GTA clothing COMPONENT id. Only clothing is stripped — the
// body/skin/face stay the default character. Component 3 (arms) uses the nude-skin variant so an
// unequipped upper body shows bare skin, not a default t-shirt. Tweak indices if a value looks off.
const NUDE_BY_COMP = {
    male:   { 1: 0, 3: 15, 4: 21, 5: 0, 6: 34, 7: 0, 8: 15, 10: 0, 11: 15 },
    female: { 1: 0, 3: 15, 4: 15, 5: 0, 6: 35, 7: 0, 8: 15, 10: 0, 11: 15 }
};
const NUDE_PROPS = [0, 1, 2, 6, 7]; // hat, glasses, ears, watch, bracelet — cleared by default
function nudeComp(player) { return (Number(player.model) === FREEMODE_FEMALE) ? NUDE_BY_COMP.female : NUDE_BY_COMP.male; }
function nudeValueForComp(player, compId) { const map = nudeComp(player); return (compId in map) ? map[compId] : 0; }
// Strip the ped to the bare body: clothing components to their nude value, cosmetic props cleared.
function setNudeBase(player) {
    const map = nudeComp(player);
    Object.keys(map).forEach(compId => { try { player.setClothes(Number(compId), map[compId], 0, 0); } catch (e) {} });
    NUDE_PROPS.forEach(propId => {
        try { player.setProp(propId, -1, 0); } catch (e) {}
        try { player.call('inventory:selfProp', [propId, -1, 0]); } catch (e) {}
    });
}
// Taking a piece off restores that slot to bare (naked), so nothing shows unless equipped.
function defaultCloth(player, cat) {
    const c = clothCat(cat);
    if (!c) return;
    if (c.kind === 'comp') {
        try { player.setClothes(c.id, nudeValueForComp(player, c.id), 0, 0); } catch (e) {}
        if (cat === 'top') { try { player.setClothes(ARMS_COMPONENT, nudeValueForComp(player, ARMS_COMPONENT), 0, 0); } catch (e) {} } // arms back to bare
    } else {
        try { player.setProp(c.id, -1, 0); player.call('inventory:selfProp', [c.id, -1, 0]); } catch (e) {}
    }
}

// ---- Equipment slots (paperdoll). ჟილეტი (vest) + worn clothing per category ----
const EQUIP_FILE = path.join(__dirname, 'equipment.json');
let equipStore = {};
try { equipStore = JSON.parse(fs.readFileSync(EQUIP_FILE, 'utf8')); } catch (e) { equipStore = {}; }
function saveEquip() {
    const temporaryFile = EQUIP_FILE + '.tmp';
    try { fs.writeFileSync(temporaryFile, JSON.stringify(equipStore)); fs.renameSync(temporaryFile, EQUIP_FILE); } catch (e) {}
}
function getEquip(player) {
    const k = keyOf(player);
    if (!equipStore[k] || typeof equipStore[k] !== 'object') equipStore[k] = {};
    return equipStore[k];
}
function equipmentData(player) {
    const eq = getEquip(player);
    const vest = eq.vest;
    const clothing = {};
    const worn = eq.clothing || {};
    Object.keys(worn).forEach(cat => {
        const w = worn[cat];
        clothing[cat] = { id: w.id, label: (ITEM_DEFS[w.id] && ITEM_DEFS[w.id].label) || w.id };
    });
    return {
        vest: vest ? { id: vest.id, label: (ITEM_DEFS[vest.id] && ITEM_DEFS[vest.id].label) || vest.id, armour: Math.round(Number(player.armour) || 0) } : null,
        clothing
    };
}

// Visible vest on the character: freemode clothing component 9 (body armour).
// Change VEST_LOOK to pick a different vest model/colour.
const VEST_COMPONENT = 9;
const VEST_LOOK = { drawable: 1, texture: 0 };
function setVestLook(player, on) {
    try {
        if (on) player.setClothes(VEST_COMPONENT, VEST_LOOK.drawable, VEST_LOOK.texture, 0);
        else player.setClothes(VEST_COMPONENT, 0, 0, 0);
    } catch (e) {}
}

// Take a worn clothing item off: reset that component/prop to default and return the item to the grid.
function unequipCloth(player, cat, toIndex) {
    const eq = getEquip(player);
    const worn = eq.clothing && eq.clothing[cat];
    if (!worn) return { ok: false };
    if (!hasSpace(player, worn.id)) { // no room to store the removed piece -> refuse and tell the player
        player.outputChatBox('!{#ff6978}[ინვენტარი] !{#ffffff}ინვენტარი სავსეა — ვერ მოხსნით (ჯერ გაათავისუფლეთ ადგილი).');
        pushData(player);
        return { ok: false, full: true };
    }
    ensureClothDef(worn.id);
    defaultCloth(player, cat);
    delete eq.clothing[cat];
    saveEquip();
    const inv = getInv(player);
    toIndex = Number(toIndex);
    if (Number.isInteger(toIndex) && toIndex >= 0 && toIndex < MAX_SLOTS && !inv[toIndex]) { inv[toIndex] = { id: worn.id, qty: 1 }; save(); }
    else addItem(player, worn.id, 1);
    player.outputChatBox(`!{#9aa4ad}[ინვენტარი] გაიხადეთ ${(ITEM_DEFS[worn.id] && ITEM_DEFS[worn.id].label) || worn.id}.`);
    pushData(player);
    return { ok: true };
}

// Take the vest off. Only an undamaged vest goes back to the inventory (a damaged one can't be
// "repaired" by re-equipping); it's destroyed automatically when armour hits 0.
function unequip(player, slot, toIndex) {
    if (slot !== 'vest') { unequipCloth(player, slot, toIndex); return; }
    const eq = getEquip(player);
    const vest = eq.vest;
    if (!vest) return;
    const def = ITEM_DEFS[vest.id] || {};
    if (Number(player.armour) < (def.armour || 100)) {
        player.outputChatBox('!{#9aa4ad}[ინვენტარი] დაზიანებულ ჟილეტს ვერ გაიხდით.');
        return pushData(player);
    }
    if (!hasSpace(player, vest.id)) { player.outputChatBox('!{#9aa4ad}[ინვენტარი] ინვენტარი სავსეა.'); return pushData(player); }
    const inv = getInv(player);
    const existing = findStack(inv, vest.id);
    toIndex = Number(toIndex);
    if (!existing && Number.isInteger(toIndex) && toIndex >= 0 && toIndex < TOTAL_SLOTS && !inv[toIndex]) {
        inv[toIndex] = { id: vest.id, qty: 1 }; // dropped onto a specific empty slot
        save();
    } else addItem(player, vest.id, 1);
    delete eq.vest;
    player.armour = 0;
    setVestLook(player, false);
    saveEquip();
    player.outputChatBox(`!{#9aa4ad}[ინვენტარი] გაიხადეთ ${def.label || vest.id}.`);
    pushData(player);
}

// Keep the vest's stored armour in sync; when it's shot to 0 the vest is gone.
setInterval(() => {
    let dirty = false;
    mp.players.forEach(player => {
        if (!mp.players.exists(player)) return;
        const eq = equipStore[keyOf(player)];
        if (!eq || !eq.vest) return;
        if (!player.invRestored) return; // just joined: armour is 0 until restoreEquipped puts the vest back
        const armour = Math.round(Number(player.armour) || 0);
        if (armour <= 0) {
            delete eq.vest;
            setVestLook(player, false);
            player.outputChatBox('!{#ff6978}[ინვენტარი] !{#ffffff}ჟილეტი განადგურდა.');
            pushData(player);
            dirty = true;
        } else if (armour !== eq.vest.armour) { eq.vest.armour = armour; dirty = true; }
    });
    if (dirty) saveEquip();
}, 2000);

// Rejoin / server restart: put the saved vest and the weapon that was in hand back on. Done after
// spawning (spawn resets armour & clothes); playerReady is a fallback.
function restoreEquipped(player) {
    if (!mp.players.exists(player)) return;
    player.invRestored = true;
    const eq = getEquip(player);
    setNudeBase(player); // bare body by default; only equipped pieces below will show
    if (eq.vest && eq.vest.armour > 0) { player.armour = eq.vest.armour; setVestLook(player, true); }
    const worn = eq.clothing || {};
    Object.keys(worn).forEach(cat => { ensureClothDef(worn[cat].id); applyCloth(player, cat, worn[cat].d, worn[cat].t); });
    const slot = eq.weaponSlot;
    if (Number.isInteger(slot)) {
        const stack = getInv(player)[slot];
        const def = stack && ITEM_DEFS[stack.id];
        if (!def || def.type !== 'weapon' || stack.qty <= 0) { delete eq.weaponSlot; saveEquip(); }
        else if (player.invEquippedStack !== stack) toggleWeapon(player, stack.id, stack);
    }
    pushData(player);
}
mp.events.add('playerReady', (player) => setTimeout(() => restoreEquipped(player), 1500));
mp.events.add('playerSpawn', (player) => setTimeout(() => restoreEquipped(player), 1000));

let store = {};
try { store = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8')); } catch (e) { store = {}; }
function save() {
    const temporaryFile = DATA_FILE + '.tmp';
    try { fs.writeFileSync(temporaryFile, JSON.stringify(store)); fs.renameSync(temporaryFile, DATA_FILE); } catch (e) {}
}

function keyOf(player) { return String(player.socialClub || player.name || ('id' + player.id)); }
function getInv(player) {
    const k = keyOf(player);
    if (!Array.isArray(store[k])) store[k] = [];
    if (!migrated.has(k)) { migrated.add(k); migrateWeaponAmmo(store[k]); store[k].forEach(s => s && ensureClothDef(s.id)); }
    return store[k];
}

// Old saves: ammo kept on the weapon stack (stack.ammo) moves into that weapon's ammo item, and
// non-stackable items saved as one stack get split. Runs once per player (defs are registered by then).
const migrated = new Set();
function migrateWeaponAmmo(inv) {
    let changed = false;
    inv.forEach(stack => {
        if (!stack || !('ammo' in stack)) return;
        const def = ITEM_DEFS[stack.id] || {};
        const rounds = Math.floor(Number(stack.ammo) || 0);
        delete stack.ammo;
        changed = true;
        if (!def.ammoType || rounds <= 0) return;
        const ammoStack = findStack(inv, def.ammoType);
        if (ammoStack) ammoStack.qty += rounds;
        else { const slot = freeSlot(inv); if (slot !== -1) inv[slot] = { id: def.ammoType, qty: rounds }; }
    });
    // Non-stackable items saved as a stack (e.g. armour ×3) -> one slot each while there's room.
    for (let i = 0; i < inv.length; i++) {
        const stack = inv[i];
        if (!stack || isStackable(stack.id)) continue;
        while (stack.qty > 1) {
            const slot = freeSlot(inv);
            if (slot === -1) break;
            inv[slot] = { id: stack.id, qty: 1 };
            stack.qty--;
            changed = true;
        }
    }
    if (changed) save();
}
// Inventory is positional: index = grid slot, empty slots are null (so drag & drop order persists).
function findStack(inv, id) { return inv.find(s => s && s.id === id) || null; }
const isStackable = (id) => !(ITEM_DEFS[id] && ITEM_DEFS[id].stackable === false);
// The stack at a given slot if it holds `id`, else the first stack of `id` (slot-precise use/drop).
function stackAt(inv, id, index) {
    index = Number(index);
    if (Number.isInteger(index) && index >= 0 && index < TOTAL_SLOTS && inv[index] && inv[index].id === id) return inv[index];
    return findStack(inv, id);
}
// Stackable items can sit in several stacks after a split; these work across all of them.
function countItem(inv, id) { return inv.reduce((n, s) => n + (s && s.id === id ? Math.max(0, s.qty) : 0), 0); }
function removeCount(player, id, n) { // takes from the last stacks first
    const inv = getInv(player);
    for (let i = inv.length - 1; i >= 0 && n > 0; i--) {
        const stack = inv[i];
        if (!stack || stack.id !== id || stack.qty <= 0) continue;
        const take = Math.min(n, stack.qty);
        removeItem(player, id, take, stack);
        n -= take;
    }
}
function freeSlots(inv) { let n = 0; for (let i = 0; i < MAX_SLOTS; i++) if (!inv[i]) n++; return n; }
function usedSlots(inv) { return inv.slice(0, MAX_SLOTS).filter(Boolean).length; }
function freeSlot(inv) {
    for (let i = 0; i < MAX_SLOTS; i++) if (!inv[i]) return i;
    return -1;
}

function hasSpace(player, id, qty = 1) {
    const inv = getInv(player);
    if (!isStackable(id)) { // one slot per item; an empty quick-slot placeholder can take one
        const placeholder = inv.some(s => s && s.id === id && s.qty <= 0) ? 1 : 0;
        return freeSlots(inv) + placeholder >= qty;
    }
    return !!findStack(inv, id) || freeSlot(inv) !== -1;
}

function addItem(player, id, quantity) {
    const def = ITEM_DEFS[id];
    const qty = Math.floor(Number(quantity) || 0);
    if (!def || qty <= 0) return false;
    const inv = getInv(player);
    if (!isStackable(id)) { // one slot per item, refilling an empty quick-slot placeholder first
        if (!hasSpace(player, id, qty)) return false;
        for (let n = 0; n < qty; n++) {
            const placeholder = inv.find(s => s && s.id === id && s.qty <= 0);
            if (placeholder) placeholder.qty = 1;
            else inv[freeSlot(inv)] = { id, qty: 1 };
        }
        save();
        return true;
    }
    let stack = findStack(inv, id);
    if (def.type === 'ammo') syncAmmoFromGun(player); // count what's left in the gun before adding
    if (stack) stack.qty += qty;
    else {
        const slot = freeSlot(inv);
        if (slot === -1) return false; // full
        stack = inv[slot] = { id, qty };
    }
    save();
    if (def.type === 'ammo') pushAmmoToGun(player); // new rounds go straight into the gun in hand
    return true;
}

// ---- Weapons: toggled in/out of the player's hands; the item stays in the inventory ----
// Weapons hold no ammo of their own. Equipping loads every round of the matching ammo item
// (def.ammoType); rounds fired are taken off that ammo stack (polled + on holster), and ammo
// bought/picked up/dropped while the gun is out updates the gun. One weapon at a time.
const isMelee = (def) => !def.ammoType;
function equippedDef(player) { return player.invEquipped ? ITEM_DEFS[player.invEquipped] : null; }

// Gun -> inventory: rounds used since equipping come off the ammo stack (never adds rounds).
function syncAmmoFromGun(player) {
    const def = equippedDef(player);
    if (!def || isMelee(def)) return false;
    const total = countItem(getInv(player), def.ammoType);
    if (total <= 0) return false;
    let live = total;
    try { live = Math.max(0, Math.floor(Number(player.getWeaponAmmo(mp.joaat(def.model))) || 0)); } catch (e) {}
    if (live >= total) return false;
    removeCount(player, def.ammoType, total - live);
    return true;
}

// Inventory -> gun: the gun in hand always holds exactly the rounds in the ammo stack.
function pushAmmoToGun(player) {
    const def = equippedDef(player);
    if (!def || isMelee(def)) return;
    try { player.setWeaponAmmo(mp.joaat(def.model), countItem(getInv(player), def.ammoType)); } catch (e) {}
}

// keepSaved: leaving the server keeps the weapon marked as equipped so it comes back on rejoin.
function holster(player, silent, keepSaved) {
    const id = player.invEquipped;
    if (!id) return;
    if (!keepSaved) { delete getEquip(player).weaponSlot; saveEquip(); }
    syncAmmoFromGun(player);
    player.invEquipped = null;
    player.invEquippedStack = null;
    player.setVariable('inv:held', null);
    const def = ITEM_DEFS[id];
    if (!def) return;
    try { player.removeWeapon(mp.joaat(def.model)); } catch (e) {}
    if (!silent) player.outputChatBox(`!{#9aa4ad}[ინვენტარი] შეინახეთ ${def.label}.`);
}

// `stack` is the exact inventory stack (slot) being equipped — guns don't stack, so two pistols
// are two slots and only the one in hand is locked.
function toggleWeapon(player, id, stack) {
    const def = ITEM_DEFS[id];
    if (player.invEquippedStack === stack) { holster(player); return; }
    holster(player, true); // put away whatever else was in hand
    const hash = mp.joaat(def.model);
    player.giveWeapon(hash, isMelee(def) ? 1 : 0);
    player.weapon = hash;
    player.invEquipped = id;
    player.invEquippedStack = stack;
    player.setVariable('inv:held', def.model); // client keeps this gun in hand, even with no ammo
    getEquip(player).weaponSlot = getInv(player).indexOf(stack); // survives disconnects/restarts
    saveEquip();
    pushAmmoToGun(player);
    const rounds = isMelee(def) ? 0 : countItem(getInv(player), def.ammoType);
    player.outputChatBox(isMelee(def)
        ? `!{#8ed17a}[ინვენტარი] აიღეთ ${def.label}.`
        : `!{#8ed17a}[ინვენტარი] აიღეთ ${def.label} — ${rounds} ტყვია${rounds ? '' : ' (იყიდეთ ტყვია იარაღის მაღაზიაში)'}.`);
}

// While a gun is out, keep the ammo stack in step with shots fired.
setInterval(() => {
    mp.players.forEach(player => {
        if (mp.players.exists(player) && player.invEquipped && syncAmmoFromGun(player)) pushData(player);
    });
}, 2000);

function removeItem(player, id, quantity, stack) {
    const inv = getInv(player);
    stack = stack || findStack(inv, id);
    if (!stack) return false;
    stack.qty -= Math.floor(Number(quantity) || 0);
    if (stack.qty <= 0 && inv.indexOf(stack) >= MAX_SLOTS) {
        stack.qty = 0; // quick slots keep the item (shown empty) so buying more refills that slot
    } else if (stack.qty <= 0) {
        inv[inv.indexOf(stack)] = null;
        while (inv.length && !inv[inv.length - 1]) inv.pop(); // trim trailing empty slots
    }
    save();
    return true;
}

function inventoryData(player) {
    const inv = getInv(player);
    // Owner name for the item-details popup (character name if the account system is active).
    const ownerName = (player.character && player.character.firstName)
        ? `${player.character.firstName} ${player.character.lastName}`
        : String(player.socialClub || player.name || '');
    return {
        used: usedSlots(inv),
        max: MAX_SLOTS,
        owner: ownerName,
        quickStart: MAX_SLOTS,
        equipped: player.invEquipped || null,
        equippedSlot: player.invEquippedStack ? inv.indexOf(player.invEquippedStack) : -1,
        equipment: equipmentData(player),
        hasBackpack: player.getVariable('inv:backpack') === true, // set true when a backpack is equipped
        vehicleOpen: player.getVariable('inv:vehicleOpen') === true, // set true only at a vehicle trunk
        items: inv.map(s => s && ({
            id: s.id,
            label: (ITEM_DEFS[s.id] && ITEM_DEFS[s.id].label) || s.id,
            type: (ITEM_DEFS[s.id] && ITEM_DEFS[s.id].type) || 'misc',
            cat: (ITEM_DEFS[s.id] && ITEM_DEFS[s.id].cloth) ? ITEM_DEFS[s.id].cloth.cat : undefined,
            qty: s.qty,
            // guns: rounds of their own ammo in the inventory (shown on the gun slot, equipped or not)
            rounds: (ITEM_DEFS[s.id] && ITEM_DEFS[s.id].type === 'weapon' && ITEM_DEFS[s.id].ammoType)
                ? countItem(inv, ITEM_DEFS[s.id].ammoType) : undefined,
            // effect stats for the details popup (only the fields the item actually has)
            stats: (() => {
                const def = ITEM_DEFS[s.id] || {};
                const out = {};
                ['health', 'thirst', 'hunger', 'armour', 'armor'].forEach(k => { if (typeof def[k] === 'number') out[k] = def[k]; });
                return out;
            })()
        }))
    };
}
function pushData(player) {
    player.call('inventory:data', [JSON.stringify(inventoryData(player))]);
    syncBackWeapons(player);
}

// Guns in the quick bar that aren't in hand are shown on the character (back / thigh) for everyone.
// Synced as the shared variable 'inv:back' = [{ m: world model, k: 'back' | 'hip' | 'hipL' }].
const BACK_KIND = { pistol: 'hip', combatpistol: 'hip', appistol: 'hip', knife: 'belt' }; // hip = right waist, belt = lower back (horizontal); else back
const HIDDEN_ON_BODY = new Set([]); // weapons carried out of sight (only visible in hand)
function syncBackWeapons(player) {
    const inv = getInv(player);
    const list = [];
    for (let i = MAX_SLOTS; i < TOTAL_SLOTS; i++) {
        const stack = inv[i];
        const def = stack && ITEM_DEFS[stack.id];
        if (!def || def.type !== 'weapon' || stack.qty <= 0 || stack === player.invEquippedStack) continue;
        if (HIDDEN_ON_BODY.has(stack.id)) continue;
        list.push({ m: dropModel(stack.id), k: BACK_KIND[stack.id] || 'back' });
    }
    const value = JSON.stringify(list);
    if (player.getVariable('inv:back') !== value) player.setVariable('inv:back', value);
}

function useItem(player, id, index) {
    const def = ITEM_DEFS[id];
    const inv = getInv(player);
    const owned = stackAt(inv, id, index);
    if (!def || !owned || owned.qty <= 0) return;
    if (player.invBusyUntil && Date.now() < player.invBusyUntil) return; // still eating/drinking
    if (def.type === 'ammo') {
        player.outputChatBox('!{#9aa4ad}[ინვენტარი] ტყვია ავტომატურად იტვირთება, როცა შესაბამის იარაღს აიღებთ.');
        return;
    }
    if (def.type === 'weapon') {
        if (inv.indexOf(owned) < MAX_SLOTS) { // weapons are equipped from the quick bar only
            player.outputChatBox('!{#9aa4ad}[ინვენტარი] იარაღის ასაღებად გადაიტანეთ სწრაფ სლოტში (1-4).');
            return;
        }
        toggleWeapon(player, id, owned); pushData(player); return;
    }
    if (def.type === 'clothing') { equipCloth(player, id, owned); return; }
    // Items registered by other packages with their own behaviour (e.g. the ID card from
    // packages/cityhall shows itself to nearby players). They are not used up.
    if (typeof def.onUse === 'function') { try { def.onUse(player, id, owned); } catch (e) {} return; }
    if (def.type === 'armor') {
        // Armour goes into the ჟილეტი (vest) equipment slot instead of being used up.
        const eq = getEquip(player);
        if (eq.vest) { player.outputChatBox('!{#9aa4ad}[ინვენტარი] ჟილეტი უკვე გაცვიათ.'); return; }
        eq.vest = { id, armour: def.armour };
        player.armour = def.armour;
        player.invRestored = true;
        setVestLook(player, true);
        saveEquip();
    } else {
        // Consumables: usable while they restore something (health, hunger or thirst).
        const needs = typeof global.needsGet === 'function' ? global.needsGet(player) : null;
        const helpsHealth = def.health && Number(player.health) < 100;
        const helpsNeeds = needs && ((def.hunger && needs.hunger < 100) || (def.thirst && needs.thirst < 100));
        if (!helpsHealth && !helpsNeeds) {
            player.outputChatBox(def.hunger || def.thirst ? '!{#9aa4ad}[ინვენტარი] არ გშიათ და არ გწყურიათ.' : '!{#9aa4ad}[ინვენტარი] სიცოცხლე უკვე სავსეა.');
            return;
        }
        if (def.health) player.health = Math.min(100, Number(player.health) + def.health);
        if (needs && (def.hunger || def.thirst)) global.needsAdd(player, { hunger: def.hunger || 0, thirst: def.thirst || 0 });
        if (def.anim) playConsumeAnim(player, def);
        // Local RP action to nearby players: eat / drink / use (bandage, medkit, etc.)
        if (global.chatLocalAction) {
            const verb = def.anim === 'eat' ? 'ჭამს' : (def.anim ? 'სვამს' : 'იყენებს');
            global.chatLocalAction(player, `${verb} ${def.label}`);
        }
    }
    removeItem(player, id, 1, owned);
    player.outputChatBox(`!{#8ed17a}[ინვენტარი] გამოიყენეთ ${def.label}.`);
    pushData(player);
}

// Wear a clothing item from the grid: apply the look, move the item into its paperdoll slot, and
// swap whatever was already worn in that slot back into the inventory (wardrobe).
function equipCloth(player, id, stack) {
    const def = ITEM_DEFS[id];
    const cloth = def && def.cloth;
    if (!cloth) return;
    const eq = getEquip(player);
    if (!eq.clothing) eq.clothing = {};
    const cat = cloth.cat;
    const inv = getInv(player);
    const slotIndex = inv.indexOf(stack);
    const previous = eq.clothing[cat];
    applyCloth(player, cat, cloth.d, cloth.t);
    eq.clothing[cat] = { id, d: cloth.d, t: cloth.t };
    if (slotIndex >= 0) {
        inv[slotIndex] = null;
        while (inv.length && !inv[inv.length - 1]) inv.pop();
    }
    if (previous && previous.id) { ensureClothDef(previous.id); addItem(player, previous.id, 1); }
    saveEquip(); save();
    player.outputChatBox(`!{#8ed17a}[ინვენტარი] ჩაიცვით ${def.label}.`);
    if (global.chatLocalAction) global.chatLocalAction(player, 'იცვლის ტანსაცმელს'); // local RP action
    pushData(player);
}

// Drag & drop between grid and quick bar: move to an empty slot or swap with the item already there.
function moveItem(player, from, to) {
    from = Number(from); to = Number(to);
    if (!Number.isInteger(from) || !Number.isInteger(to) || from === to) return;
    if (from < 0 || to < 0 || from >= TOTAL_SLOTS || to >= TOTAL_SLOTS) return;
    const inv = getInv(player);
    if (!inv[from]) return;
    const target = inv[to] || null;
    if (isEquipped(player, inv[from]) || isEquipped(player, target)) { // the weapon in hand stays put
        player.outputChatBox('!{#9aa4ad}[ინვენტარი] ჯერ შეინახეთ იარაღი (აღჭურვილ ნივთს ვერ გადაიტანთ).');
        pushData(player);
        return;
    }
    if (target && target.id === inv[from].id && isStackable(target.id)) { // same item: merge stacks
        target.qty = Math.max(0, target.qty) + Math.max(0, inv[from].qty);
        inv[from] = null;
    } else {
        inv[to] = inv[from];
        inv[from] = target;
    }
    for (let i = 0; i < inv.length; i++) {
        if (inv[i] === undefined) inv[i] = null; // fill sparse holes
        if (i < MAX_SLOTS && inv[i] && inv[i].qty <= 0) inv[i] = null; // empty quick-slot item dragged into the grid = removed
    }
    while (inv.length && !inv[inv.length - 1]) inv.pop();
    save();
    pushData(player);
}

// Shift+drag: move `amount` from one stack into an empty slot (or onto a stack of the same item).
function splitItem(player, from, to, amount) {
    from = Number(from); to = Number(to); amount = Math.floor(Number(amount));
    if (!Number.isInteger(from) || !Number.isInteger(to) || from === to) return;
    if (from < 0 || to < 0 || from >= TOTAL_SLOTS || to >= TOTAL_SLOTS) return;
    const inv = getInv(player);
    const source = inv[from];
    if (!source || !isStackable(source.id) || source.qty < 2) return;
    if (!Number.isInteger(amount) || amount < 1 || amount >= source.qty) return;
    const target = inv[to] || null;
    if (target && target.id !== source.id) return pushData(player); // only into empty / same-item slots
    if (isEquipped(player, source) || isEquipped(player, target)) {
        player.outputChatBox('!{#9aa4ad}[ინვენტარი] ჯერ შეინახეთ იარაღი (აღჭურვილ ნივთს ვერ გადაიტანთ).');
        return pushData(player);
    }
    for (let i = inv.length; i < to; i++) inv[i] = null; // keep the array dense up to `to`
    source.qty -= amount;
    if (target) target.qty = Math.max(0, target.qty) + amount;
    else inv[to] = { id: source.id, qty: amount };
    save();
    pushData(player);
}

function isEquipped(player, stack) { return !!(stack && player.invEquippedStack === stack); }

function clearSlot(player, index) {
    const inv = getInv(player);
    inv[index] = null;
    while (inv.length && !inv[inv.length - 1]) inv.pop();
    save();
    pushData(player);
}

// `amount` (Ctrl+drag out of the window): how many of a stackable item to drop; default is one
// item, or the whole stack for ammo.
function dropItem(player, id, index, amount) {
    const def = ITEM_DEFS[id];
    const inv = getInv(player);
    const stack = stackAt(inv, id, index);
    if (!stack) return;
    if (stack.qty <= 0) { clearSlot(player, inv.indexOf(stack)); return; } // empty quick slot: just unassign it
    if (isEquipped(player, stack)) {
        player.outputChatBox('!{#9aa4ad}[ინვენტარი] ჯერ შეინახეთ იარაღი (აღჭურვილ ნივთს ვერ გადააგდებთ).');
        return;
    }
    // Ammo drops as the whole stack (all rounds); everything else one at a time.
    let count = 1;
    if (def && def.type === 'ammo') {
        syncAmmoFromGun(player); // rounds already fired aren't dropped
        count = stack.qty;
        if (count <= 0) return pushData(player);
    }
    const wanted = Math.floor(Number(amount));
    if (Number.isInteger(wanted) && wanted >= 1 && isStackable(id)) count = Math.min(wanted, stack.qty);
    if (!removeItem(player, id, count, stack)) return;
    if (def && def.type === 'ammo') pushAmmoToGun(player); // gun in hand loses those rounds too
    spawnDrop(player, id, count);
    player.outputChatBox(`!{#9aa4ad}[ინვენტარი] გადააგდეთ ${(def && def.label) || id}${count > 1 ? ' ×' + count : ''}.`);
    if (global.chatLocalAction) global.chatLocalAction(player, `დებს მიწაზე ${(def && def.label) || id}`); // local RP action
    pushData(player);
}

// ---- Ground drops: dropped items become world objects anyone can pick up (E) ----
const DROP_MODELS = {
    knife: 'w_me_knife_01', bat: 'w_me_bat', pistol: 'w_pi_pistol', combatpistol: 'w_pi_combatpistol',
    appistol: 'w_pi_appistol', microsmg: 'w_sb_microsmg', smg: 'w_sb_smg', pumpshotgun: 'w_sg_pumpshotgun',
    assaultrifle: 'w_ar_assaultrifle', carbinerifle: 'w_ar_carbinerifle', armor: 'prop_armour_pickup',
    medkit: 'prop_ld_health_pack', water: 'prop_ld_flow_bottle', soda: 'prop_ecola_can',
    energy: 'prop_energy_drink', pickaxe: 'prop_tool_pickaxe', chips: 'prop_ld_snack_01', sandwich: 'prop_sandwich_01', burger: 'prop_cs_burger_01',
};
const dropModel = (itemId) => DROP_MODELS[itemId]
    || (String(itemId).startsWith('ammo_') ? 'prop_ld_ammo_pack_01' : DROP_FALLBACK_MODEL);
const DROP_FALLBACK_MODEL = 'prop_paper_bag_small';
const DROP_LIFETIME_MS = 15 * 60 * 1000;
const PICKUP_RANGE = 2.5;
const drops = new Map(); // dropId -> { itemId, qty, object, dimension, expires }
let nextDropId = 1;

function spawnDrop(player, itemId, qty) {
    const heading = (Number(player.heading) || 0) * Math.PI / 180;
    const p = player.position;
    const pos = new mp.Vector3(p.x - Math.sin(heading) * 0.7, p.y + Math.cos(heading) * 0.7, p.z - 0.95); // at the feet, in front
    const object = mp.objects.new(mp.joaat(dropModel(itemId)), pos, {
        rotation: new mp.Vector3(0, 0, Number(player.heading) || 0),
        dimension: player.dimension
    });
    const dropId = nextDropId++;
    object.setVariable('drop:id', dropId);
    object.setVariable('drop:label', ((ITEM_DEFS[itemId] && ITEM_DEFS[itemId].label) || itemId) + (qty > 1 ? ' ×' + qty : ''));
    drops.set(dropId, { itemId, qty, object, dimension: player.dimension, expires: Date.now() + DROP_LIFETIME_MS });
}

function removeDrop(dropId) {
    const drop = drops.get(dropId);
    if (!drop) return;
    drops.delete(dropId);
    if (drop.object && mp.objects.exists(drop.object)) drop.object.destroy();
}

function pickupDrop(player, dropId) {
    const drop = drops.get(Number(dropId));
    if (!drop || player.vehicle || player.dimension !== drop.dimension) return;
    if (!drop.object || !mp.objects.exists(drop.object)) { drops.delete(Number(dropId)); return; }
    const a = player.position, b = drop.object.position;
    if (Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z) > PICKUP_RANGE) return;
    if (!hasSpace(player, drop.itemId, drop.qty)) { player.outputChatBox('!{#9aa4ad}[ინვენტარი] ინვენტარი სავსეა.'); return; }
    removeDrop(Number(dropId)); // claim first so two players can't both take it
    addItem(player, drop.itemId, drop.qty);
    player.outputChatBox(`!{#8ed17a}[ინვენტარი] აიღეთ ${(ITEM_DEFS[drop.itemId] && ITEM_DEFS[drop.itemId].label) || drop.itemId}.`);
    if (global.chatLocalAction) global.chatLocalAction(player, `იღებს მიწიდან ${(ITEM_DEFS[drop.itemId] && ITEM_DEFS[drop.itemId].label) || drop.itemId}`); // local RP action
    pushData(player);
}

setInterval(() => {
    const now = Date.now();
    drops.forEach((drop, dropId) => { if (now >= drop.expires) removeDrop(dropId); });
}, 60 * 1000);

// ---- Shared API for other packages (market, future shops) ----
global.invAddItem = (player, id, qty) => { const ok = addItem(player, id, qty); if (ok) pushData(player); return ok; };
global.invHasSpace = (player, id, qty) => hasSpace(player, id, qty);
global.invCountItem = (player, id) => countItem(getInv(player), id);
// Everything in the personal grid + quick bar, merged per item id: [{ id, label, qty, inHand }].
global.invList = (player) => {
    const merged = {};
    getInv(player).forEach(stack => {
        if (!stack || stack.qty <= 0) return;
        const entry = merged[stack.id] || (merged[stack.id] = { id: stack.id, label: (ITEM_DEFS[stack.id] && ITEM_DEFS[stack.id].label) || stack.id, qty: 0, inHand: false });
        entry.qty += stack.qty;
        if (player.invEquippedStack === stack) entry.inHand = true;
    });
    return Object.values(merged);
};
global.invItemExists = (id) => !!(ITEM_DEFS[id] || ensureClothDef(id));
global.invRemoveItem = (player, id, qty) => { removeCount(player, id, Math.max(0, Math.floor(Number(qty) || 0))); pushData(player); };
// Clothing worn/unequip API used by the clothing store so it can take pieces off into the inventory.
global.invUnequipCloth = (player, cat) => unequipCloth(player, String(cat), -1);
global.invWornClothing = (player) => {
    const worn = getEquip(player).clothing || {};
    const out = {};
    Object.keys(worn).forEach(cat => { out[cat] = { id: worn[cat].id, label: (ITEM_DEFS[worn[cat].id] && ITEM_DEFS[worn[cat].id].label) || worn[cat].id }; });
    return out;
};
// The bare ("none") drawable per category for this player's ped, so the shop can preview it.
global.invNudeLook = (player) => {
    const out = {};
    clothCats().forEach(cat => { out[cat.key] = cat.kind === 'prop' ? -1 : nudeValueForComp(player, cat.id); });
    return out;
};
// Lets the clothing shop preview arms correctly while browsing tops.
global.invTopArms = (player) => ({
    def: DEFAULT_ARMS, nude: nudeValueForComp(player, ARMS_COMPONENT),
    map: (typeof global.clothingTorsoMap === 'function') ? global.clothingTorsoMap(player) : {}
});
// Re-apply the bare base + equipped clothing (e.g. after a Director-mode model change).
global.invRestoreLook = (player) => restoreEquipped(player);
global.invItemLabel = (id) => (ITEM_DEFS[id] && ITEM_DEFS[id].label) || id;
global.invCapacity = (player) => ({ used: usedSlots(getInv(player)), max: MAX_SLOTS });

// ---- Client wiring ----
mp.events.add('inventory:request', (player) => pushData(player));
mp.events.add('inventory:use', (player, id, index) => useItem(player, String(id), index));
mp.events.add('inventory:drop', (player, id, index, amount) => dropItem(player, String(id), index, amount));
mp.events.add('inventory:move', (player, from, to) => moveItem(player, from, to));
mp.events.add('inventory:split', (player, from, to, amount) => splitItem(player, from, to, amount));
// Client reports the equipped gun's ammo when it changes (the server's own synced value can miss the
// last shot when GTA holsters an empty rifle). Only ever lowers the ammo item — can't create rounds.
mp.events.add('inventory:ammoReport', (player, rounds) => {
    const def = equippedDef(player);
    rounds = Math.floor(Number(rounds));
    if (!def || isMelee(def) || !Number.isInteger(rounds) || rounds < 0) return;
    const total = countItem(getInv(player), def.ammoType);
    if (rounds < total) { removeCount(player, def.ammoType, total - rounds); pushData(player); }
});
mp.events.add('inventory:unequip', (player, slot, toIndex) => unequip(player, String(slot), toIndex));
mp.events.add('inventory:pickup', (player, dropId) => pickupDrop(player, dropId));
// Quick-access keys 1-4: use/equip whatever sits in that quick slot.
mp.events.add('inventory:useQuick', (player, index) => {
    index = Number(index);
    if (!Number.isInteger(index) || index < 0 || index >= QUICK_SLOTS) return;
    const stack = getInv(player)[MAX_SLOTS + index];
    if (stack) useItem(player, stack.id, MAX_SLOTS + index);
});

mp.events.addCommand('inv', (player) => pushData(player)); // debug/refresh helper

// Put the weapon away (unfired rounds stay in the ammo item) when the player leaves or dies.
mp.events.add('playerQuit', (player) => holster(player, true, true));
mp.events.add('playerDeath', (player) => {
    holster(player, true);
    const eq = getEquip(player);
    if (eq.vest) { delete eq.vest; setVestLook(player, false); saveEquip(); } // the vest doesn't survive death
    pushData(player);
});
