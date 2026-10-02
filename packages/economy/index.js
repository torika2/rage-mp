// ===================== Economy: money + fuel purchases =====================
// Money is server-authoritative. It lives in memory (keyed by Social Club) and is persisted to the
// database (characters.money) via packages/_core dbSync. money.json is only read once, to import
// pre-database saves into a character the first time it logs in.
const fs = require('fs');
const path = require('path');

const DATA_FILE = path.join(__dirname, 'money.json');
const START_MONEY = 5000;
const MAX_ADMIN_GRANT = 1000000;

// Prices per litre by octane index — MUST match the client's OCTANES order.
const OCTANE_PRICES = [2.3, 3.0, 4.2, 5.5]; // keep in sync with client OCTANES prices
const OCTANE_NAMES = ['რეგულარი 87', 'პლუსი 91', 'პრემიუმი 98', 'სუპერი 100'];

let store = {};
try { store = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8')); } catch (e) { store = {}; }
function save() { global.dbSync.touch('money'); }

function keyOf(player) { return player.socialClub || player.name || ('id' + player.id); }
function getMoney(player) {
    const k = keyOf(player);
    if (typeof store[k] !== 'number') store[k] = START_MONEY;
    return store[k];
}
function setMoney(player, amount) {
    const key = keyOf(player);
    const previous = store[key];
    const updated = Math.max(0, Math.floor(amount));
    store[key] = updated;
    try {
        save();
    } catch (error) {
        if (previous === undefined) delete store[key];
        else store[key] = previous;
        throw error;
    }
    player.setVariable('money', updated);
    return updated;
}

global.adminAddMoney = function (player, amount) {
    if (!Number.isSafeInteger(amount) || amount <= 0 || amount > MAX_ADMIN_GRANT) {
        throw new RangeError('Admin money grant must be an integer from 1 to 1,000,000.');
    }
    const current = getMoney(player);
    if (current > Number.MAX_SAFE_INTEGER - amount) {
        throw new RangeError('Player balance would exceed the safe integer limit.');
    }
    return setMoney(player, current + amount);
};

mp.events.add('playerJoin', (player) => player.setVariable('money', getMoney(player)));

global.dbSync.register('money', {
    get: (player) => getMoney(player),
    push: (characterId, money) => global.api.saveCharacter(characterId, { money }),
});
global.onCharacterLoad((player, character, firstTime) => {
    if (!firstTime) store[keyOf(player)] = Math.max(0, Math.floor(Number(character.money) || 0));
    player.setVariable('money', getMoney(player)); // firstTime: keeps money.json value (or START_MONEY)
});

// Shared money API so other packages (government, shops, markets) can charge/pay.
global.getMoney = getMoney;
global.setMoney = setMoney;
global.addMoney = (player, delta) => setMoney(player, getMoney(player) + Math.floor(delta));
global.canAfford = (player, cost) => getMoney(player) >= Math.max(0, Math.floor(cost));

mp.events.addCommand('money', (player) => {
    player.outputChatBox('!{#7ec8ff}ბალანსი: $' + getMoney(player));
});

mp.events.addCommand('addmoney', (player, _, amt) => {
    if (typeof global.isProtectedAdmin !== 'function' ||
        !global.isProtectedAdmin(player) || player.getVariable('admin:mode') !== true) {
        return player.outputChatBox('!{#ff6b6b}ეს ბრძანება ხელმისაწვდომია მხოლოდ Admin Mode-ში.');
    }
    const amount = Number(amt);
    if (!Number.isSafeInteger(amount) || amount <= 0 || amount > MAX_ADMIN_GRANT) {
        return player.outputChatBox('გამოყენება: /addmoney <1-1000000>');
    }
    try {
        player.outputChatBox('ახალი ბალანსი: $' + global.adminAddMoney(player, amount));
    } catch (error) {
        console.error(`[economy] Could not add money to ${player.name}:`, error);
        player.outputChatBox('!{#ff6b6b}თანხის დამატება ვერ მოხერხდა.');
    }
});

// Fuel purchase: client sends octane index + litres; server prices & charges it.
mp.events.add('fuel:buy', (player, octaneIndex, liters) => {
    octaneIndex = parseInt(octaneIndex);
    liters = Math.floor(parseFloat(liters));
    if (isNaN(octaneIndex) || octaneIndex < 0 || octaneIndex >= OCTANE_PRICES.length) return;
    if (isNaN(liters) || liters <= 0 || liters > 200) return; // sanity cap

    const cost = Math.ceil(liters * OCTANE_PRICES[octaneIndex]);
    const money = getMoney(player);
    if (money < cost) { player.call('fuel:deny', ['არასაკმარისი თანხა — საჭიროა $' + cost]); return; }

    setMoney(player, money - cost);
    player.call('fuel:confirm', [octaneIndex, liters, cost]);
    player.outputChatBox(`!{#8ed17a}შეივსო ${liters}ლ ${OCTANE_NAMES[octaneIndex]} — $${cost}. ბალანსი: $${getMoney(player)}`);
    if (global.chatLocalAction) global.chatLocalAction(player, 'ასხამს საწვავს მანქანაში'); // local RP action
});
