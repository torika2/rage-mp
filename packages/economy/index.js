// ===================== Economy: money + fuel purchases =====================
// Money is server-authoritative and persisted to money.json (keyed by Social Club).
const fs = require('fs');
const path = require('path');

const DATA_FILE = path.join(__dirname, 'money.json');
const START_MONEY = 5000;

// Prices per litre by octane index — MUST match the client's OCTANES order.
const OCTANE_PRICES = [2.3, 3.0, 4.2, 5.5]; // keep in sync with client OCTANES prices
const OCTANE_NAMES = ['რეგულარი 87', 'პლუსი 91', 'პრემიუმი 98', 'სუპერი 100'];

let store = {};
try { store = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8')); } catch (e) { store = {}; }
function save() { try { fs.writeFileSync(DATA_FILE, JSON.stringify(store)); } catch (e) {} }

function keyOf(player) { return player.socialClub || player.name || ('id' + player.id); }
function getMoney(player) {
    const k = keyOf(player);
    if (typeof store[k] !== 'number') store[k] = START_MONEY;
    return store[k];
}
function setMoney(player, amount) {
    store[keyOf(player)] = Math.max(0, Math.floor(amount));
    player.setVariable('money', store[keyOf(player)]);
    save();
}

mp.events.add('playerJoin', (player) => player.setVariable('money', getMoney(player)));

mp.events.addCommand('money', (player) => {
    player.outputChatBox('!{#7ec8ff}ბალანსი: $' + getMoney(player));
});

// testing/admin helper — remove or lock down later
mp.events.addCommand('addmoney', (player, _, amt) => {
    const n = parseInt(amt);
    if (isNaN(n)) return player.outputChatBox('გამოყენება: /addmoney <თანხა>');
    setMoney(player, getMoney(player) + n);
    player.outputChatBox('ახალი ბალანსი: $' + getMoney(player));
});

// Fuel purchase: client sends octane index + litres; server prices & charges it.
mp.events.add('fuel:buy', (player, octaneIndex, liters) => {
    octaneIndex = parseInt(octaneIndex);
    liters = Math.floor(parseFloat(liters));
    if (isNaN(octaneIndex) || octaneIndex < 0 || octaneIndex >= OCTANE_PRICES.length) return;
    if (isNaN(liters) || liters <= 0 || liters > 200) return; // sanity cap

    const cost = Math.ceil(liters * OCTANE_PRICES[octaneIndex]);
    const money = getMoney(player);
    if (money < cost) { player.call('fuel:deny', ['Not enough money — $' + cost + ' needed']); return; }

    setMoney(player, money - cost);
    player.call('fuel:confirm', [octaneIndex, liters, cost]);
    player.outputChatBox(`!{#8ed17a}Refuelled ${liters}L ${OCTANE_NAMES[octaneIndex]} for $${cost}. Balance: $${getMoney(player)}`);
});
