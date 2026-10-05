// ===================== Phone =====================
// An on-screen smartphone with apps: Bank (view balances + mobile transfer), Contacts, Phone (call),
// and Car management (lock/engine/locate). Each player gets a persistent 7-digit number. Data is
// server-authoritative; the client renders the UI and forwards actions here.
const fs = require('fs');
const path = require('path');

const DATA_FILE = path.join(__dirname, 'phone.json');
let store = {};
try { store = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8')); } catch (e) { store = {}; }
function save() {
    const temporaryFile = DATA_FILE + '.tmp';
    try { fs.writeFileSync(temporaryFile, JSON.stringify(store)); fs.renameSync(temporaryFile, DATA_FILE); } catch (e) {}
}
function keyOf(player) { return String(player.socialClub || player.name || ('id' + player.id)); }
function genNumber() { return String(Math.floor(1000000 + Math.random() * 9000000)); }
function getRec(player) {
    const k = keyOf(player);
    if (!store[k] || typeof store[k] !== 'object') store[k] = {};
    if (!store[k].number) store[k].number = genNumber();
    if (!Array.isArray(store[k].contacts)) store[k].contacts = [];
    return store[k];
}
function findByNumber(number) {
    number = String(number || '').trim();
    if (!number) return null;
    let found = null;
    mp.players.forEach(p => { if (mp.players.exists(p) && getRec(p).number === number) found = p; });
    return found;
}

function carState(player) {
    const car = player.myCar;
    if (!car || !mp.vehicles.exists(car)) return { has: false };
    return { has: true, locked: car.locked === true, engine: car.engine === true, x: car.position.x, y: car.position.y };
}
function sendState(player) {
    const rec = getRec(player);
    player.call('phone:state', [JSON.stringify({
        number: rec.number,
        cash: (typeof global.getMoney === 'function' ? global.getMoney(player) : 0),
        bank: (typeof global.getBank === 'function' ? global.getBank(player) : 0),
        contacts: rec.contacts,
        car: carState(player)
    })]);
}

mp.events.add('playerJoin', (player) => player.setVariable('phone:number', getRec(player).number));
mp.events.add('phone:request', (player) => sendState(player));

// Parking finder: recompute on demand (distances change as the player moves). Returns free spots +
// the player's own, nearest-first, via the parking package.
mp.events.add('phone:parkingRequest', (player) => {
    const list = (typeof global.parkingPhoneData === 'function') ? global.parkingPhoneData(player) : [];
    player.call('phone:parking', [JSON.stringify(list)]);
});

// Player pulled the phone out — show a local RP action to nearby players.
mp.events.add('phone:taken', (player) => {
    if (global.chatLocalAction) global.chatLocalAction(player, 'იღებს მობილუს');
});

// Player put the phone away — local RP action to nearby players.
mp.events.add('phone:stowed', (player) => {
    if (global.chatLocalAction) global.chatLocalAction(player, 'ინახავს მობილურს');
});

// Mobile bank transfer (bank -> bank) by phone number. Deposit/withdraw still need an ATM.
mp.events.add('phone:bankTransfer', (player, number, amount) => {
    amount = Math.floor(Number(amount));
    if (!(amount > 0)) return sendState(player);
    if (typeof global.getBank !== 'function') return;
    if (global.getBank(player) < amount) { player.outputChatBox('!{#ff6978}[ტელეფონი] ბანკში თანხა არ არის.'); return sendState(player); }
    const target = findByNumber(number);
    if (!target) { player.outputChatBox('!{#ff6978}[ტელეფონი] ნომერი მიუწვდომელია (ონლაინ უნდა იყოს).'); return sendState(player); }
    if (target === player) return sendState(player);
    global.setBank(player, global.getBank(player) - amount);
    global.addBank(target, amount);
    player.outputChatBox(`!{#5ac8fa}[ტელეფონი] გადარიცხე $${amount} → ${target.name}.`);
    target.outputChatBox(`!{#5ac8fa}[ტელეფონი] მიიღე $${amount} ${player.name}-სგან.`);
    sendState(player);
});

mp.events.add('phone:contactAdd', (player, name, number) => {
    name = String(name || '').trim().slice(0, 24);
    number = String(number || '').trim().slice(0, 12);
    if (!name || !number) return;
    const rec = getRec(player);
    if (rec.contacts.length >= 50) return;
    rec.contacts.push({ name, number });
    save();
    sendState(player);
});
mp.events.add('phone:contactDelete', (player, index) => {
    index = Number(index);
    const rec = getRec(player);
    if (Number.isInteger(index) && index >= 0 && index < rec.contacts.length) { rec.contacts.splice(index, 1); save(); }
    sendState(player);
});

// ---- Voice calls (two-way, non-spatial while connected) ----
const pending = new Map(); // targetId -> callerId (a ringing, not-yet-accepted call)
function playerById(id) { let found = null; mp.players.forEach(p => { if (p.id === id) found = p; }); return found; }
function linkCallVoice(a, b, on) {
    try { a.enableVoiceTo(b); b.enableVoiceTo(a); } catch (e) {}
    a.call('call:voice', [b.id, on]);
    b.call('call:voice', [a.id, on]);
}
function endCall(player, reason) {
    // cancel any ringing call this player started
    for (const [targetId, callerId] of pending) {
        if (callerId === player.id) { pending.delete(targetId); const t = playerById(targetId); if (t) t.call('call:ended', ['']); }
    }
    const partner = player.callPartner;
    if (partner && mp.players.exists(partner)) {
        linkCallVoice(player, partner, false);
        partner.callPartner = null;
        partner.call('call:ended', [reason || '']);
    }
    player.callPartner = null;
    player.call('call:ended', [reason || '']);
}

mp.events.add('phone:call', (player, number) => {
    const target = findByNumber(number);
    if (!target || target === player) { player.call('call:failed', ['აბონენტი მიუწვდომელია']); return; }
    if (player.callPartner || target.callPartner || pending.has(target.id) || pending.has(player.id)) {
        player.call('call:failed', ['ხაზი დაკავებულია']); return;
    }
    pending.set(target.id, player.id);
    player.call('call:ringing', [target.name, getRec(target).number]);
    target.call('call:incoming', [player.name, getRec(player).number]);
    setTimeout(() => {
        if (pending.get(target.id) === player.id) {
            pending.delete(target.id);
            if (mp.players.exists(player)) player.call('call:ended', ['პასუხი არ არის']);
            if (mp.players.exists(target)) target.call('call:ended', ['']);
        }
    }, 30000);
});
mp.events.add('call:accept', (player) => {
    const callerId = pending.get(player.id);
    if (callerId === undefined) return;
    pending.delete(player.id);
    const caller = playerById(callerId);
    if (!caller || !mp.players.exists(caller)) { player.call('call:ended', ['გაწყდა']); return; }
    player.callPartner = caller; caller.callPartner = player;
    linkCallVoice(player, caller, true);
    player.call('call:connected', [caller.name]);
    caller.call('call:connected', [player.name]);
});
mp.events.add('call:decline', (player) => {
    const callerId = pending.get(player.id);
    if (callerId === undefined) return;
    pending.delete(player.id);
    const caller = playerById(callerId);
    if (caller) caller.call('call:ended', ['უარყო']);
    player.call('call:ended', ['']);
});
mp.events.add('call:hangup', (player) => endCall(player, 'დასრულდა'));
mp.events.add('playerQuit', (player) => endCall(player, 'გაწყდა'));

mp.events.add('phone:car', (player, action) => {
    const car = player.myCar;
    if (!car || !mp.vehicles.exists(car)) { player.outputChatBox('!{#ff6978}[ტელეფონი] მანქანა არ გაქვს.'); return sendState(player); }
    action = String(action || '');
    if (action === 'lock') { car.locked = !(car.locked === true); player.outputChatBox('!{#7ec8ff}[ტელეფონი] მანქანა ' + (car.locked ? 'დაიბლოკა' : 'გაიხსნა') + '.'); }
    else if (action === 'engine') { car.engine = !(car.engine === true); player.outputChatBox('!{#7ec8ff}[ტელეფონი] ძრავა ' + (car.engine ? 'ჩართულია' : 'გამორთულია') + '.'); }
    sendState(player);
});
