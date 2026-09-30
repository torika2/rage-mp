// ===================== Bank / ATM =====================
// A bank balance kept separately from cash-on-hand (packages/economy). Players use an ATM to deposit
// cash into the bank, withdraw it back, transfer to another player, and check balances. All moves are
// server-authoritative and validated at an ATM. Balances persist to bank.json keyed by Social Club.
const fs = require('fs');
const path = require('path');

const DATA_FILE = path.join(__dirname, 'bank.json');
const ATM_RANGE = 3.0;          // metres from an ATM to use it
const MAX_AMOUNT = 100000000;   // per-operation sanity cap

// ATM world locations — keep in sync with ATM_LOCATIONS in client_packages/index.js.
const ATM_LOCATIONS = [
    { x: -56.82, y: -92.09, z: 57.78 }, { x: -2072.42, y: -317.50, z: 13.33 },
    { x: -1414.52, y: -212.93, z: 46.52 }, { x: -1205.00, y: -324.90, z: 37.94 },
    { x: -821.61, y: -1081.90, z: 11.13 }, { x: -537.91, y: -854.60, z: 29.24 },
    { x: -357.42, y: -49.61, z: 49.04 }, { x: -284.90, y: 6224.28, z: 31.49 },
    { x: -260.92, y: -14.30, z: 49.28 }, { x: -201.92, y: -860.70, z: 30.22 },
    { x: 24.24, y: -946.30, z: 29.36 }, { x: 89.12, y: 2.50, z: 68.31 },
    { x: 112.53, y: -776.90, z: 31.42 }, { x: 129.40, y: -1292.40, z: 29.28 },
    { x: 147.32, y: 232.41, z: 106.29 }, { x: 155.00, y: 6642.30, z: 31.90 },
    { x: 240.80, y: 223.30, z: 106.35 }, { x: 285.50, y: 143.50, z: 104.57 },
    { x: 288.90, y: -1282.50, z: 29.66 }, { x: 295.90, y: -895.60, z: 29.22 },
    { x: 1077.70, y: -776.90, z: 58.22 }, { x: 1167.00, y: 2708.90, z: 38.01 },
    { x: 1822.60, y: 3683.10, z: 34.28 }, { x: 3011.80, y: 5940.00, z: 34.79 }
];

let store = {};
try { store = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8')); } catch (e) { store = {}; }
function save() {
    const temporaryFile = DATA_FILE + '.tmp';
    try { fs.writeFileSync(temporaryFile, JSON.stringify(store)); fs.renameSync(temporaryFile, DATA_FILE); } catch (e) {}
}
function keyOf(player) { return String(player.socialClub || player.name || ('id' + player.id)); }
function getBank(player) {
    const k = keyOf(player);
    if (typeof store[k] !== 'number') store[k] = 0;
    return store[k];
}
function setBank(player, amount) {
    store[keyOf(player)] = Math.max(0, Math.floor(amount));
    save();
    player.setVariable('bank', store[keyOf(player)]);
    return store[keyOf(player)];
}
global.getBank = getBank;
global.setBank = setBank;
global.addBank = (player, delta) => setBank(player, getBank(player) + Math.floor(delta));

function tell(player, message) { player.outputChatBox('!{#5ac8fa}[ბანკი] !{#ffffff}' + message); }

function atATM(player) {
    if (Number(player.dimension) !== 0) return false;
    const p = player.position;
    return ATM_LOCATIONS.some(loc => {
        const dx = p.x - loc.x, dy = p.y - loc.y, dz = p.z - loc.z;
        return dx * dx + dy * dy + dz * dz <= ATM_RANGE * ATM_RANGE;
    });
}
function sanitize(amount) {
    amount = Math.floor(Number(amount));
    return (Number.isFinite(amount) && amount > 0 && amount <= MAX_AMOUNT) ? amount : 0;
}
function pushState(player, message, ok) {
    player.call('bank:data', [JSON.stringify({
        cash: (typeof global.getMoney === 'function' ? global.getMoney(player) : 0),
        bank: getBank(player),
        message: message || null,
        ok: ok !== false
    })]);
}

mp.events.add('bank:request', (player) => pushState(player));

mp.events.add('bank:deposit', (player, amount) => {
    if (!atATM(player)) return pushState(player, 'მიდით ბანკომატთან.', false);
    amount = sanitize(amount);
    if (!amount) return pushState(player, 'არასწორი თანხა.', false);
    if (global.getMoney(player) < amount) return pushState(player, 'ნაღდი ფული არ გყოფნით.', false);
    global.setMoney(player, global.getMoney(player) - amount);
    addBank(player, amount);
    pushState(player, `შეიტანეთ $${amount}.`, true);
});

mp.events.add('bank:withdraw', (player, amount) => {
    if (!atATM(player)) return pushState(player, 'მიდით ბანკომატთან.', false);
    amount = sanitize(amount);
    if (!amount) return pushState(player, 'არასწორი თანხა.', false);
    if (getBank(player) < amount) return pushState(player, 'ბანკში საკმარისი თანხა არ არის.', false);
    setBank(player, getBank(player) - amount);
    global.setMoney(player, global.getMoney(player) + amount);
    pushState(player, `გამოიტანეთ $${amount}.`, true);
});

// Transfer from your bank to another (online) player's bank. `target` is a name or server id.
mp.events.add('bank:transfer', (player, target, amount) => {
    if (!atATM(player)) return pushState(player, 'მიდით ბანკომატთან.', false);
    amount = sanitize(amount);
    if (!amount) return pushState(player, 'არასწორი თანხა.', false);
    if (getBank(player) < amount) return pushState(player, 'ბანკში საკმარისი თანხა არ არის.', false);
    const recipient = findPlayer(String(target || ''));
    if (!recipient) return pushState(player, 'მიმღები ვერ მოიძებნა (უნდა იყოს ონლაინ).', false);
    if (recipient === player) return pushState(player, 'საკუთარ თავს ვერ გადარიცხავთ.', false);
    setBank(player, getBank(player) - amount);
    addBank(recipient, amount);
    tell(recipient, `მიიღეთ $${amount} ${player.name}-სგან. ბანკის ბალანსი: $${getBank(recipient)}.`);
    pushState(player, `გადარიცხეთ $${amount} → ${recipient.name}.`, true);
});

function findPlayer(query) {
    query = query.trim();
    if (!query) return null;
    if (/^\d+$/.test(query)) {
        const byId = mp.players.at(Number(query));
        if (byId && mp.players.exists(byId)) return byId;
    }
    const lower = query.toLowerCase();
    let exact = null, partial = null;
    mp.players.forEach(p => {
        if (!mp.players.exists(p) || !p.name) return;
        const name = p.name.toLowerCase();
        if (name === lower) exact = p;
        else if (!partial && name.indexOf(lower) !== -1) partial = p;
    });
    return exact || partial;
}

mp.events.add('playerJoin', (player) => player.setVariable('bank', getBank(player)));
mp.events.addCommand('bank', (player) => {
    player.outputChatBox(`!{#5ac8fa}[ბანკი] !{#ffffff}ნაღდი: $${global.getMoney(player)} · ბანკი: $${getBank(player)}`);
});

global.atmLocations = () => ATM_LOCATIONS;
