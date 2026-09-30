// ===================== City Hall: Rockford Hills City Hall (government building) =====================
// Points of interest at the City Hall: map blip/entrance, the officials' duty point, the fines &
// taxes desk, the ID-card clerk (NPC) and the respawn point for on-duty officials. Rank, duty and
// fines live in packages/government; this package only places them in the world.
//
// The building has no interior in the base game. The points start in the front courtyard; once a
// City Hall MLO (interior mod) is installed, an admin walks to each spot inside and runs
// /cityhall set <point> — saved to cityhall.json, no code edits needed.
const fs = require('fs');
const path = require('path');

const POINTS_FILE = path.join(__dirname, 'cityhall.json');
const IDS_FILE = path.join(__dirname, 'ids.json');

// x/y/z = where the player stands (ped root, ~1m above ground); h = heading. Defaults: front courtyard.
const DEFAULT_POINTS = {
    entrance: { x: -545.00, y: -204.20, z: 38.22, h: 210 },  // front doors — blip + marker
    duty:     { x: -540.20, y: -203.40, z: 38.22, h: 210 },  // officials: E = on/off duty
    desk:     { x: -542.60, y: -207.60, z: 38.22, h: 210 },  // citizens: pay fines, tax info
    clerk:    { x: -548.60, y: -206.40, z: 38.22, h: 210 },  // ID-card clerk NPC (players stand in front)
    licenses: { x: -551.80, y: -204.70, z: 38.22, h: 210 },  // license office NPC (driving, boat, pilot …)
    weapons:  { x: -555.00, y: -202.90, z: 38.22, h: 210 },  // weapon permit NPC (NPCs ≥ 3.5 m apart: range is 3 m)
    spawn:    { x: -546.80, y: -210.80, z: 38.22, h: 30 }    // on-duty officials respawn here
};
const POINT_LABELS = { entrance: 'შესასვლელი', duty: 'მორიგეობა', desk: 'ჯარიმები/გადასახადები', clerk: 'პირადობის მოწმობა',
    licenses: 'ლიცენზიები', weapons: 'იარაღის ნებართვა', spawn: 'სპაუნი' };

// Licenses issued at City Hall (all need an ID card first). counter = which NPC sells it.
// weapon: Ammu-Nation requires it for firearms + ammo (packages/shops) — law #4 "weapons only with a permit".
const LICENSES = {
    driving:    { counter: 'licenses', label: 'მართვის მოწმობა (B — მსუბუქი ავტომობილი)', price: 500 },
    motorcycle: { counter: 'licenses', label: 'მოტოციკლის მართვის მოწმობა (A)', price: 400 },
    truck:      { counter: 'licenses', label: 'სატვირთოს მართვის მოწმობა (C)', price: 1200 },
    boat:       { counter: 'licenses', label: 'ნავის მართვის ლიცენზია', price: 800 },
    pilot:      { counter: 'licenses', label: 'პილოტის ლიცენზია', price: 5000 },
    hunting:    { counter: 'licenses', label: 'სანადირო ლიცენზია', price: 300 },
    business:   { counter: 'licenses', label: 'ბიზნესის ლიცენზია', price: 10000 },
    weapon:     { counter: 'weapons',  label: 'იარაღის ტარების ნებართვა', price: 2500 }
};
const INTERACT_RANGE = 3.0; // metres; the client prompt uses a smaller radius so it's always accepted
const ARRANGE_SPACING = 3.8; // /cityhall arrange: metres between counters (must stay > INTERACT_RANGE)

const ID_FEE = 200;        // first ID card or replacement, paid into the treasury
const ID_MIN_AGE = 16, ID_MAX_AGE = 100;
const SHOW_RANGE = 3.0;    // metres: who sees the card when you show it

function readJson(file, fallback) {
    try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch (e) { return fallback; }
}
function writeJson(file, value) {
    const temporaryFile = file + '.tmp';
    try { fs.writeFileSync(temporaryFile, JSON.stringify(value, null, 2)); fs.renameSync(temporaryFile, file); } catch (e) {}
}

let points = Object.assign({}, DEFAULT_POINTS, readJson(POINTS_FILE, {}));
let ids = readJson(IDS_FILE, { next: 1, cards: {}, licenses: {} }); // cards / licenses: { socialClubKey: … }
if (!ids.cards) ids.cards = {};
if (!ids.licenses) ids.licenses = {};
if (!Number.isInteger(ids.next)) ids.next = 1;

function keyOf(player) { return String(player.socialClub || '').trim().toLowerCase(); }
function tell(player, message) { player.outputChatBox('!{#4b9ce0}[მერია] !{#ffffff}' + message); }
function near(player, point, range) {
    if (!point || Number(player.dimension) !== 0) return false;
    const p = player.position;
    const dx = p.x - point.x, dy = p.y - point.y, dz = p.z - point.z;
    return dx * dx + dy * dy + dz * dz <= range * range;
}
function isAdmin(player) {
    return (typeof global.isProtectedAdmin === 'function' && global.isProtectedAdmin(player)) ||
        (typeof global.govIsAdmin === 'function' && global.govIsAdmin(player));
}
function taxRate() { return (typeof global.govTaxRate === 'function' ? Number(global.govTaxRate()) : 0) || 0; }

// ---- Points to clients (blip, markers, prompts, clerk NPC) ----
function sendPoints(player) { player.call('cityhall:points', [JSON.stringify(points)]); }
mp.events.add('playerReady', (player) => sendPoints(player));

global.cityhallAtDuty = (player) => near(player, points.duty, INTERACT_RANGE);

// ---- Duty point ----
mp.events.add('cityhall:duty', (player) => {
    if (!near(player, points.duty, INTERACT_RANGE)) return;
    if (typeof global.govToggleDuty === 'function') global.govToggleDuty(player);
});

// ---- Fines & taxes desk ----
function deskState(player) {
    const fines = typeof global.govUnpaidFines === 'function' ? global.govUnpaidFines(player) : [];
    return {
        mode: 'desk',
        money: typeof global.getMoney === 'function' ? global.getMoney(player) : 0,
        taxRate: taxRate(),
        fines,
        total: fines.reduce((sum, fine) => sum + fine.amount, 0)
    };
}
mp.events.add('cityhall:desk:open', (player) => {
    if (!near(player, points.desk, INTERACT_RANGE)) return;
    player.call('cityhall:ui', [JSON.stringify(deskState(player))]);
});
mp.events.add('cityhall:desk:pay', (player, indexArg) => {
    if (!near(player, points.desk, INTERACT_RANGE) || typeof global.govPayFines !== 'function') return;
    const index = Math.floor(Number(indexArg));
    if (!Number.isInteger(index) || index < -1) return;
    const result = global.govPayFines(player, index);
    if (result.ok) tell(player, `გადახდილია ჯარიმა: $${result.total}. მადლობა!`);
    else if (result.reason === 'money') tell(player, `არასაკმარისი თანხა — საჭიროა $${result.total}.`);
    player.call('cityhall:ui', [JSON.stringify(deskState(player))]);
});

// ---- ID cards (clerk NPC) ----
// Each card is an inventory item "idcard_<number>" (not used up). Using it shows the card to you and
// everyone within SHOW_RANGE. The item def is registered for every issued card at startup.
global.invItemDefs = global.invItemDefs || {};
function cardItemId(card) { return 'idcard_' + card.number; }
function cardByNumber(number) {
    return Object.values(ids.cards).find(card => card.number === number) || null;
}
function registerCardItem(card) {
    global.invItemDefs[cardItemId(card)] = {
        label: 'პირადობის მოწმობა — ' + card.first + ' ' + card.last,
        type: 'document', stackable: false,
        onUse: (player, itemId) => showCard(player, cardByNumber(Number(String(itemId).split('_')[1])))
    };
}
Object.values(ids.cards).forEach(registerCardItem);

function formatNumber(number) { return 'GE-' + String(number).padStart(6, '0'); }
// Licenses of an account: { type: { issued } }, only known types.
function licensesOfKey(key) {
    const own = (key && ids.licenses[key]) || {};
    return Object.keys(own).filter(type => LICENSES[type]).reduce((out, type) => { out[type] = own[type]; return out; }, {});
}
function licenseLabels(key) { return Object.keys(licensesOfKey(key)).map(type => LICENSES[type].label); }
function cardView(card, key) {
    return {
        number: formatNumber(card.number), first: card.first, last: card.last, dob: card.dob, sex: card.sex, issued: card.issued,
        licenses: key ? licenseLabels(key) : []
    };
}
function showCard(player, card) {
    if (!card) return tell(player, 'მოწმობა არ მოიძებნა.');
    const ownerKey = Object.keys(ids.cards).find(key => ids.cards[key] === card) || null;
    const view = JSON.stringify(cardView(card, ownerKey));
    const shownTo = [];
    mp.players.forEach(target => {
        if (target.dimension !== player.dimension) return;
        if (target !== player && !near(target, player.position, SHOW_RANGE)) return;
        target.call('cityhall:showId', [view]);
        if (target !== player) {
            shownTo.push(target.name);
            tell(target, `${player.name} გაჩვენებთ პირადობის მოწმობას.`);
        }
    });
    tell(player, shownTo.length ? `მოწმობა აჩვენეთ: ${shownTo.join(', ')}.` : 'ახლოს არავინ არის — მოწმობა მხოლოდ თქვენ ნახეთ.');
}

const NAME_RE = /^[A-Za-zა-ჰ][A-Za-zა-ჰ'\-]{1,19}$/;
function validDob(text) {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(text || ''));
    if (!match) return null;
    const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
    const date = new Date(Date.UTC(year, month - 1, day));
    if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
    const now = new Date();
    let age = now.getUTCFullYear() - year;
    if (now.getUTCMonth() < month - 1 || (now.getUTCMonth() === month - 1 && now.getUTCDate() < day)) age--;
    return age >= ID_MIN_AGE && age <= ID_MAX_AGE ? match[0] : null;
}
function sexOf(player) {
    return Number(player.model) === mp.joaat('mp_f_freemode_01') ? 'F' : 'M';
}
function hasCardItem(player, card) {
    return typeof global.invCountItem === 'function' ? global.invCountItem(player, cardItemId(card)) > 0 : false;
}
function clerkState(player) {
    const card = ids.cards[keyOf(player)] || null;
    return {
        mode: 'id',
        money: typeof global.getMoney === 'function' ? global.getMoney(player) : 0,
        fee: ID_FEE, taxRate: 0,
        sex: sexOf(player),
        card: card ? cardView(card, keyOf(player)) : null,
        hasItem: card ? hasCardItem(player, card) : false,
        minAge: ID_MIN_AGE, maxAge: ID_MAX_AGE
    };
}
mp.events.add('cityhall:id:open', (player) => {
    if (!near(player, points.clerk, INTERACT_RANGE)) return;
    player.call('cityhall:ui', [JSON.stringify(clerkState(player))]);
});
// Issue a new card, or a replacement (lost card / new details). Same number stays with the account.
mp.events.add('cityhall:id:issue', (player, firstArg, lastArg, dobArg) => {
    if (!near(player, points.clerk, INTERACT_RANGE)) return;
    const key = keyOf(player);
    if (!key) return tell(player, 'Social Club იდენტიფიკატორი ვერ მოიძებნა.');
    const first = String(firstArg || '').trim(), last = String(lastArg || '').trim();
    const dob = validDob(dobArg);
    const reply = () => player.call('cityhall:ui', [JSON.stringify(clerkState(player))]);
    if (!NAME_RE.test(first) || !NAME_RE.test(last)) { tell(player, 'სახელი და გვარი: 2-20 ასო (ქართული ან ლათინური).'); return reply(); }
    if (!dob) { tell(player, `დაბადების თარიღი: წწწწ-თთ-დდ, ასაკი ${ID_MIN_AGE}-${ID_MAX_AGE}.`); return reply(); }
    if (typeof global.getMoney !== 'function' || typeof global.invAddItem !== 'function') { tell(player, 'სისტემა ამჟამად მიუწვდომელია.'); return reply(); }
    if (global.getMoney(player) < ID_FEE) { tell(player, `მოწმობის საფასური $${ID_FEE} — არასაკმარისი თანხა.`); return reply(); }

    const previous = ids.cards[key] || null;
    const card = {
        number: previous ? previous.number : ids.next++,
        first, last, dob, sex: sexOf(player),
        issued: new Date().toISOString().slice(0, 10)
    };
    registerCardItem(card);
    // Old card in the inventory is replaced by the new one (same item id, so remove it first).
    if (previous && typeof global.invRemoveItem === 'function') global.invRemoveItem(player, cardItemId(previous), 99);
    if (!global.invAddItem(player, cardItemId(card), 1)) {
        if (previous) global.invAddItem(player, cardItemId(previous), 1);
        tell(player, 'ინვენტარში ადგილი არ არის.');
        return reply();
    }
    global.setMoney(player, global.getMoney(player) - ID_FEE);
    if (typeof global.govAddToTreasury === 'function') global.govAddToTreasury(ID_FEE);
    ids.cards[key] = card;
    writeJson(IDS_FILE, ids);
    tell(player, `${previous ? 'მოწმობა განახლდა' : 'მოწმობა გაიცა'}: ${formatNumber(card.number)}. ინვენტარში (I) გამოყენებით აჩვენებთ ახლოს მყოფებს.`);
    reply();
});

// ---- License office + weapon permit office (NPCs) ----
function licenseState(player, counter) {
    const key = keyOf(player);
    const owned = licensesOfKey(key);
    const fines = typeof global.govUnpaidFines === 'function' ? global.govUnpaidFines(player) : [];
    return {
        mode: 'licenses', counter,
        money: typeof global.getMoney === 'function' ? global.getMoney(player) : 0,
        hasId: !!ids.cards[key],
        blockers: counter === 'weapons' ? weaponBlockers(player, fines) : [],
        licenses: Object.keys(LICENSES).filter(type => LICENSES[type].counter === counter).map(type => ({
            type, label: LICENSES[type].label, price: LICENSES[type].price,
            owned: !!owned[type], issued: owned[type] ? owned[type].issued : null
        }))
    };
}
// Why someone can't get a weapon permit right now (empty = fine).
function weaponBlockers(player, fines) {
    const out = [];
    if (fines && fines.length) out.push('გადაუხდელი ჯარიმა (' + fines.length + ') — გადაიხადეთ სალაროში');
    if (player.getVariable('police:jailed') === true) out.push('იმყოფებით ციხეში');
    if (typeof global.demorganIsJailed === 'function' && global.demorganIsJailed(player)) out.push('იმყოფებით დემორგანში');
    return out;
}
function atCounter(player, counter) { return near(player, points[counter], INTERACT_RANGE); }
mp.events.add('cityhall:lic:open', (player, counter) => {
    counter = counter === 'weapons' ? 'weapons' : 'licenses';
    if (!atCounter(player, counter)) return;
    player.call('cityhall:ui', [JSON.stringify(licenseState(player, counter))]);
});
mp.events.add('cityhall:lic:buy', (player, typeArg) => {
    const type = String(typeArg || '');
    const def = LICENSES[type];
    if (!def || !atCounter(player, def.counter)) return;
    const key = keyOf(player);
    const reply = () => player.call('cityhall:ui', [JSON.stringify(licenseState(player, def.counter))]);
    if (!key || !ids.cards[key]) { tell(player, 'ჯერ აიღეთ პირადობის მოწმობა (მეზობელ ფანჯარასთან).'); return reply(); }
    if (licensesOfKey(key)[type]) { tell(player, 'ეს ლიცენზია უკვე გაქვთ.'); return reply(); }
    if (def.counter === 'weapons') {
        const blockers = weaponBlockers(player, typeof global.govUnpaidFines === 'function' ? global.govUnpaidFines(player) : []);
        if (blockers.length) { tell(player, 'ნებართვა ვერ გაიცემა: ' + blockers.join('; ') + '.'); return reply(); }
    }
    if (typeof global.getMoney !== 'function' || global.getMoney(player) < def.price) { tell(player, `არასაკმარისი თანხა — საჭიროა $${def.price}.`); return reply(); }
    global.setMoney(player, global.getMoney(player) - def.price);
    if (typeof global.govAddToTreasury === 'function') global.govAddToTreasury(def.price);
    if (!ids.licenses[key]) ids.licenses[key] = {};
    ids.licenses[key][type] = { issued: new Date().toISOString().slice(0, 10) };
    writeJson(IDS_FILE, ids);
    tell(player, `გაიცა: ${def.label} ($${def.price}). ჩანს თქვენს პირადობის მოწმობაზე.`);
    reply();
});

global.licenseHas = (player, type) => !!licensesOfKey(keyOf(player))[type];
global.licenseList = (player) => Object.keys(licensesOfKey(keyOf(player)));

// Who may look up / revoke someone else's licenses: admins, on-duty police, on-duty government.
function canInspect(player) {
    return isAdmin(player) || player.getVariable('police:duty') === true ||
        (typeof global.govRankOf === 'function' && global.govRankOf(player) && typeof global.govOnDuty === 'function' && global.govOnDuty(player));
}
function onlineById(value) {
    const text = String(value === undefined || value === null ? '' : value);
    if (!/^\d+$/.test(text)) return null;
    let found = null;
    mp.players.forEach(p => { if (Number(p.id) === Number(text)) found = p; });
    return found;
}
// /licenses — yours · /licenses <id> — someone else's (police / officials / admins)
mp.events.addCommand('licenses', (player, _, id) => {
    let target = player;
    if (id !== undefined) {
        if (!canInspect(player)) return tell(player, 'სხვისი ლიცენზიების ნახვა შეუძლია პოლიციას / მთავრობას (მორიგეობაზე).');
        target = onlineById(id);
        if (!target) return tell(player, 'მოთამაშე ვერ მოიძებნა.');
    }
    const key = keyOf(target);
    const card = ids.cards[key];
    const list = licenseLabels(key);
    tell(player, `${card ? card.first + ' ' + card.last + ' (' + formatNumber(card.number) + ')' : target.name + ' — პირადობის მოწმობა არ აქვს'}: ` +
        (list.length ? list.join(', ') : 'ლიცენზია არ აქვს') + '.');
});
// /revokelicense <id> <type> — admins and on-duty police
mp.events.addCommand('revokelicense', (player, _, id, typeArg) => {
    if (!isAdmin(player) && player.getVariable('police:duty') !== true) return tell(player, 'მხოლოდ პოლიცია (მორიგეობაზე) / ადმინი.');
    const target = onlineById(id);
    const type = String(typeArg || '').toLowerCase();
    if (!target || !LICENSES[type]) return tell(player, 'გამოყენება: /revokelicense <id> <' + Object.keys(LICENSES).join('|') + '>');
    const key = keyOf(target);
    if (!ids.licenses[key] || !ids.licenses[key][type]) return tell(player, 'ამ მოთამაშეს ეს ლიცენზია არ აქვს.');
    delete ids.licenses[key][type];
    writeJson(IDS_FILE, ids);
    tell(player, `${target.name}: ჩამოერთვა ${LICENSES[type].label}.`);
    tell(target, `${player.name}-მ ჩამოგართვათ: ${LICENSES[type].label}.`);
});

// ---- On-duty officials respawn at City Hall ----
mp.events.add('playerSpawn', (player) => {
    setTimeout(() => {
        if (!mp.players.exists(player)) return;
        const official = typeof global.govRankOf === 'function' && global.govRankOf(player);
        if (!official || typeof global.govOnDuty !== 'function' || !global.govOnDuty(player)) return;
        player.position = new mp.Vector3(points.spawn.x, points.spawn.y, points.spawn.z);
        player.heading = points.spawn.h;
    }, 300);
});

// ---- Admin: move points in-game (e.g. inside the MLO once it's installed) ----
// /cityhall set <entrance|duty|desk|clerk|spawn>  — uses your current position + heading
// /cityhall tp <point> · /cityhall reset <point> · /cityhall  (list)
mp.events.addCommand('cityhall', (player, _, action, name) => {
    if (!isAdmin(player)) return tell(player, 'მხოლოდ ადმინისთვის.');
    action = String(action || '').toLowerCase();
    name = String(name || '').toLowerCase();
    if (!action) {
        Object.keys(points).forEach(key => {
            const pt = points[key];
            player.outputChatBox(`!{#9aa4ad}${key} (${POINT_LABELS[key] || key}): !{#ffffff}${pt.x.toFixed(2)}, ${pt.y.toFixed(2)}, ${pt.z.toFixed(2)} h${Math.round(pt.h)}`);
        });
        return tell(player, 'გამოყენება: /cityhall arrange (ყველა NPC ერთ რიგში, სადაც დგახართ) · /cityhall set|tp|reset <entrance|duty|desk|clerk|licenses|weapons|spawn>');
    }
    if (action === 'arrange') {
        // Stand where the counters should be (middle of the row), facing the way the NPCs should face.
        // Clerk, licenses, weapons, cashier and the duty point go in a row across you, ARRANGE_SPACING apart.
        const p = player.position, h = Number(player.heading) || 0;
        const rad = h * Math.PI / 180;
        const right = { x: Math.cos(rad), y: Math.sin(rad) };
        const order = ['clerk', 'licenses', 'weapons', 'desk', 'duty'];
        order.forEach((key, i) => {
            const offset = (i - (order.length - 1) / 2) * ARRANGE_SPACING;
            points[key] = { x: +(p.x + right.x * offset).toFixed(2), y: +(p.y + right.y * offset).toFixed(2), z: +p.z.toFixed(2), h: Math.round(h) };
        });
        writeJson(POINTS_FILE, points);
        mp.players.forEach(sendPoints);
        return tell(player, `დალაგდა ${order.length} წერტილი (${ARRANGE_SPACING} მ დაშორებით). ცალკეული: /cityhall set <clerk|licenses|weapons|desk|duty>`);
    }
    if (!DEFAULT_POINTS[name]) return tell(player, 'წერტილი: entrance, duty, desk, clerk, licenses, weapons, spawn');
    if (action === 'set') {
        const p = player.position;
        points[name] = { x: +p.x.toFixed(2), y: +p.y.toFixed(2), z: +p.z.toFixed(2), h: Math.round(Number(player.heading) || 0) };
    } else if (action === 'reset') {
        points[name] = Object.assign({}, DEFAULT_POINTS[name]);
    } else if (action === 'tp') {
        const pt = points[name];
        player.position = new mp.Vector3(pt.x, pt.y, pt.z);
        player.heading = pt.h;
        return;
    } else {
        return tell(player, 'გამოყენება: /cityhall set|tp|reset <წერტილი>');
    }
    writeJson(POINTS_FILE, points);
    mp.players.forEach(sendPoints);
    tell(player, `${name} (${POINT_LABELS[name]}) — შენახულია.`);
});

global.cityhallPoints = () => points;
