// ===================== Inventory: persistent per-player items =====================
// Server-authoritative item storage keyed by Social Club, persisted to inventory.json.
// Phase 4 core: the 25-slot PERSONAL inventory. Market purchases add items here; the player
// opens the inventory (I) and Uses (applies effect) or Drops them. Clothing/vehicle-storage
// panels in the UI are wired later — this owns the personal item grid.
const fs = require('fs');
const path = require('path');

const DATA_FILE = path.join(__dirname, 'inventory.json');
const MAX_SLOTS = 25; // personal inventory capacity (unique item stacks)

// Item catalog. `health` consumables heal on Use. Add more item types here later.
const ITEM_DEFS = {
    water:    { label: 'წყალი',            type: 'consumable', health: 10 },
    soda:     { label: 'კოლა',             type: 'consumable', health: 15 },
    energy:   { label: 'ენერგეტიკული',     type: 'consumable', health: 20 },
    chips:    { label: 'ჩიფსი',            type: 'consumable', health: 15 },
    sandwich: { label: 'სენდვიჩი',         type: 'consumable', health: 25 },
    burger:   { label: 'ბურგერი',          type: 'consumable', health: 40 },
    medkit:   { label: 'სამედიცინო ნაკრები', type: 'consumable', health: 100 }
};

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
    return store[k];
}
function findStack(inv, id) { return inv.find(s => s && s.id === id) || null; }

function hasSpace(player, id) {
    const inv = getInv(player);
    return !!findStack(inv, id) || inv.length < MAX_SLOTS;
}

function addItem(player, id, quantity) {
    const def = ITEM_DEFS[id];
    const qty = Math.floor(Number(quantity) || 0);
    if (!def || qty <= 0) return false;
    const inv = getInv(player);
    const stack = findStack(inv, id);
    if (stack) stack.qty += qty;
    else if (inv.length < MAX_SLOTS) inv.push({ id, qty });
    else return false; // full
    save();
    return true;
}

function removeItem(player, id, quantity) {
    const inv = getInv(player);
    const stack = findStack(inv, id);
    if (!stack) return false;
    stack.qty -= Math.floor(Number(quantity) || 0);
    if (stack.qty <= 0) inv.splice(inv.indexOf(stack), 1);
    save();
    return true;
}

function inventoryData(player) {
    const inv = getInv(player);
    return {
        used: inv.length,
        max: MAX_SLOTS,
        hasBackpack: player.getVariable('inv:backpack') === true, // set true when a backpack is equipped
        vehicleOpen: player.getVariable('inv:vehicleOpen') === true, // set true only at a vehicle trunk
        items: inv.map(s => ({
            id: s.id,
            label: (ITEM_DEFS[s.id] && ITEM_DEFS[s.id].label) || s.id,
            type: (ITEM_DEFS[s.id] && ITEM_DEFS[s.id].type) || 'misc',
            qty: s.qty
        }))
    };
}
function pushData(player) { player.call('inventory:data', [JSON.stringify(inventoryData(player))]); }

function useItem(player, id) {
    const def = ITEM_DEFS[id];
    const inv = getInv(player);
    if (!def || !findStack(inv, id)) return;
    if (def.health) {
        if (Number(player.health) >= 100) { player.outputChatBox('!{#9aa4ad}[ინვენტარი] სიცოცხლე უკვე სავსეა.'); return; }
        player.health = Math.min(100, Number(player.health) + def.health);
    }
    removeItem(player, id, 1);
    player.outputChatBox(`!{#8ed17a}[ინვენტარი] გამოიყენეთ ${def.label}.`);
    pushData(player);
}

function dropItem(player, id) {
    const def = ITEM_DEFS[id];
    if (!removeItem(player, id, 1)) return;
    player.outputChatBox(`!{#9aa4ad}[ინვენტარი] გადააგდეთ ${(def && def.label) || id}.`);
    pushData(player);
}

// ---- Shared API for other packages (market, future shops) ----
global.invAddItem = (player, id, qty) => { const ok = addItem(player, id, qty); if (ok) pushData(player); return ok; };
global.invHasSpace = (player, id) => hasSpace(player, id);
global.invItemLabel = (id) => (ITEM_DEFS[id] && ITEM_DEFS[id].label) || id;
global.invCapacity = (player) => ({ used: getInv(player).length, max: MAX_SLOTS });

// ---- Client wiring ----
mp.events.add('inventory:request', (player) => pushData(player));
mp.events.add('inventory:use', (player, id) => useItem(player, String(id)));
mp.events.add('inventory:drop', (player, id) => dropItem(player, String(id)));

mp.events.addCommand('inv', (player) => pushData(player)); // debug/refresh helper
