// ===================== Medic / EMS faction: roster, duty, revive rights =====================
// Mirrors the police roster model (packages/police) but trimmed down: medics have ranks, go on/off
// duty, and the senior ranks can hire/promote/fire. The one capability that matters elsewhere is
// "revive": the hospital death system (packages/hospital/death.js) only lets an ON-DUTY medic with
// that capability revive a downed player (and only if they're holding a medkit). Force institutes
// (police, army, SWAT, …) are simply not on this roster, so they can't revive.
// Commands are prefixed with "m" (/mduty, /mhire, …) so they don't collide with the police ones.
const fs = require('fs');
const path = require('path');

const DATA_FILE = path.join(__dirname, 'medics.json');
const data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));

function save() {
    const temporaryFile = DATA_FILE + '.tmp';
    fs.writeFileSync(temporaryFile, JSON.stringify(data, null, 2));
    fs.renameSync(temporaryFile, DATA_FILE);
}

function accountKey(player) {
    return String(player.socialClub || '').trim().toLowerCase();
}

function isAdmin(player) {
    const key = accountKey(player);
    return key !== '' && data.admins.some(name => String(name).trim().toLowerCase() === key);
}

function rankOf(player) {
    if (isAdmin(player)) return 'chief_physician';
    const medic = data.medics[accountKey(player)];
    return medic && data.ranks[medic.rank] ? medic.rank : null;
}

function labelOf(rank) {
    return rank ? data.ranks[rank].label : 'მოქალაქე';
}

function hasCapability(player, capability) {
    const rank = rankOf(player);
    return rank !== null && data.ranks[rank].capabilities.includes(capability);
}

function onDuty(player) {
    return player.getVariable('medic:duty') === true;
}

function tell(player, message) {
    player.outputChatBox('!{#6fcf97}[სამედიცინო] !{#ffffff}' + message);
}

function requireDuty(player) {
    if (!hasCapability(player, 'duty')) { tell(player, 'თქვენ არ ხართ მედიკოსი.'); return false; }
    if (!onDuty(player)) { tell(player, 'ჯერ გადით მორიგეობაზე — /mduty.'); return false; }
    return true;
}

function requireCapability(player, capability) {
    if (!requireDuty(player)) return false;
    if (!hasCapability(player, capability)) { tell(player, 'თქვენს რანგს არ აქვს ამის უფლება.'); return false; }
    return true;
}

function onlinePlayerById(value) {
    const text = String(value === undefined || value === null ? '' : value);
    if (!/^\d+$/.test(text)) return null;
    const id = Number(text);
    if (!Number.isSafeInteger(id)) return null;
    let found = null;
    mp.players.forEach(player => { if (Number(player.id) === id) found = player; });
    return found;
}

function targetFor(actor, idText) {
    const target = onlinePlayerById(idText);
    if (!target) { tell(actor, 'მოთამაშის ID ვერ მოიძებნა. გამოიყენეთ სიაში ნაჩვენები ID.'); return null; }
    if (target.id === actor.id) { tell(actor, 'საკუთარ თავზე ვერ გამოიყენებთ.'); return null; }
    return target;
}

function adminMayManage(actor, target) {
    if (isAdmin(target)) { tell(actor, 'დაცული ადმინისტრატორის მართვა თამაშში შეუძლებელია.'); return false; }
    const actorRank = rankOf(actor);
    const targetRank = rankOf(target);
    if (targetRank && data.ranks[targetRank].level >= data.ranks[actorRank].level) {
        tell(actor, 'ვერ მართავთ თანაბარი ან უფრო მაღალი რანგის მედიკოსს.');
        return false;
    }
    return true;
}

mp.events.add('playerJoin', (player) => player.setVariable('medic:duty', false));

mp.events.addCommand('medic', (player) => {
    const rank = rankOf(player);
    if (!rank) return tell(player, 'თქვენ არ ხართ მედიკოსთა შემადგენლობაში.');
    const state = onDuty(player) ? 'მორიგეზე' : 'მორიგეობის გარეშე';
    tell(player, `${labelOf(rank)} — ${state}. ბრძანებები: /mduty. მენეჯმენტი: /mhire <id>, /mpromote <id> <rank>, /mdemote <id> <rank>, /mfire <id>, /mranks.`);
});

mp.events.addCommand('mduty', (player) => {
    if (!hasCapability(player, 'duty')) return tell(player, 'თქვენ არ ხართ მედიკოსი.');
    const next = !onDuty(player);
    player.setVariable('medic:duty', next);
    tell(player, next ? `მორიგეზე ხართ როგორც ${labelOf(rankOf(player))}.` : 'მორიგეობიდან გახვედით.');
});

mp.events.addCommand('mhire', (player, _, id) => {
    if (!requireCapability(player, 'recruit')) return;
    const target = targetFor(player, id);
    if (!target) return;
    if (!adminMayManage(player, target)) return;
    const key = accountKey(target);
    if (!key) return tell(player, 'სამიზნეს არ აქვს Social Club იდენტობა; ვერ დაემატება შემადგენლობაში.');
    if (data.medics[key]) return tell(player, 'ეს მოთამაშე უკვე მედიკოსთა შემადგენლობაშია.');
    data.medics[key] = { name: target.name, rank: 'trainee' };
    save();
    tell(player, `${target.name} მიიღეთ სტაჟიორად.`);
    tell(target, 'თქვენ მიგიღეს მედიკოსად (სტაჟიორი). ბრძანებებისთვის: /medic.');
});

function changeRank(player, id, requestedRank, direction) {
    if (!requireCapability(player, 'promote')) return;
    const target = targetFor(player, id);
    if (!target) return;
    if (!adminMayManage(player, target)) return;
    const key = accountKey(target);
    const currentRank = rankOf(target);
    const newRank = data.ranks[requestedRank];
    if (!key || !currentRank || !newRank || isAdmin(target)) {
        return tell(player, 'გამოყენება: /' + (direction === 'promote' ? 'mpromote' : 'mdemote') + ' <id> <rank>. რანგები: /mranks.');
    }
    const oldLevel = data.ranks[currentRank].level;
    if ((direction === 'promote' && newRank.level <= oldLevel) ||
        (direction === 'demote' && newRank.level >= oldLevel)) {
        return tell(player, `აირჩიეთ რანგი ${labelOf(currentRank)}-ზე ${direction === 'promote' ? 'მაღალი' : 'დაბალი'}.`);
    }
    if (newRank.level >= data.ranks[rankOf(player)].level) {
        return tell(player, 'ვერ ანიჭებთ თქვენი ან უფრო მაღალი რანგის დონეს.');
    }
    data.medics[key].rank = requestedRank;
    data.medics[key].name = target.name;
    save();
    tell(player, `${target.name} ახლა არის ${newRank.label}.`);
    tell(target, `თქვენი სამედიცინო რანგია ${newRank.label}.`);
}

mp.events.addCommand('mpromote', (player, _, id, rank) => changeRank(player, id, rank, 'promote'));
mp.events.addCommand('mdemote', (player, _, id, rank) => changeRank(player, id, rank, 'demote'));

mp.events.addCommand('mranks', (player) => {
    const lines = Object.keys(data.ranks).map(key => `${key} (${data.ranks[key].label})`);
    tell(player, 'რანგები: ' + lines.join(', '));
});

mp.events.addCommand('mfire', (player, _, id) => {
    if (!requireCapability(player, 'fire')) return;
    const target = targetFor(player, id);
    if (!target) return;
    if (!adminMayManage(player, target)) return;
    const key = accountKey(target);
    if (!key || !data.medics[key]) return tell(player, 'ეს მოთამაშე არ არის მედიკოსთა შემადგენლობაში.');
    delete data.medics[key];
    save();
    target.setVariable('medic:duty', false);
    tell(player, `${target.name} ამოირიცხა მედიკოსთა შემადგენლობიდან.`);
    tell(target, 'თქვენ ამოგრიცხეს მედიკოსთა შემადგენლობიდან.');
});

// ---- Shared API used by the hospital death system (packages/hospital/death.js) ----
global.medicIsMedic = (player) => rankOf(player) !== null;    // on the roster at all
global.medicOnDuty = onDuty;                                  // clocked in right now
global.medicCanRevive = (player) => hasCapability(player, 'revive') && onDuty(player);
