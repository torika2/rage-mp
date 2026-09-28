const fs = require('fs');
const path = require('path');

const DATA_FILE = path.join(__dirname, 'hospital.json');
const INTERIOR_DLC = path.resolve(__dirname, '../../client_packages/game_resources/dlcpacks/phmc/dlc.rpf');
const data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));

function interiorEnabled() {
    return data.interior.enabled === true && fs.existsSync(INTERIOR_DLC);
}

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
    return key !== '' && data.admins.some(
        name => String(name).trim().toLowerCase() === key
    );
}

function rankOf(player) {
    if (isAdmin(player)) return 'chief_physician';
    const member = data.staff[accountKey(player)];
    return member && data.ranks[member.rank] ? member.rank : null;
}

function labelOf(rank) {
    return rank ? data.ranks[rank].label : 'Civilian';
}

function hasCapability(player, capability) {
    const rank = rankOf(player);
    return rank !== null && data.ranks[rank].capabilities.includes(capability);
}

function tell(player, message) {
    player.outputChatBox('!{#61c9a8}[Hospital] !{#ffffff}' + message);
}

function requireDuty(player) {
    if (!hasCapability(player, 'duty')) {
        tell(player, 'You are not on the hospital staff roster.');
        return false;
    }
    if (player.getVariable('hospital:duty') !== true) {
        tell(player, 'Go on duty first with /hduty.');
        return false;
    }
    return true;
}

function requireCapability(player, capability) {
    if (!requireDuty(player)) return false;
    if (!hasCapability(player, capability)) {
        tell(player, 'Your hospital rank does not allow that.');
        return false;
    }
    return true;
}

function onlinePlayerById(value) {
    const text = String(value === undefined || value === null ? '' : value);
    if (!/^\d+$/.test(text)) return null;
    const id = Number(text);
    if (!Number.isSafeInteger(id)) return null;
    let found = null;
    mp.players.forEach(player => {
        if (Number(player.id) === id) found = player;
    });
    return found;
}

function closeEnough(actor, target) {
    if (Number(actor.dimension) !== Number(target.dimension)) return false;
    const a = actor.position;
    const b = target.position;
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    const dz = a.z - b.z;
    return dx * dx + dy * dy + dz * dz <= 9;
}

function targetFor(actor, idText) {
    const target = onlinePlayerById(idText);
    if (!target) {
        tell(actor, 'Player ID not found. Use the ID shown in the player list.');
        return null;
    }
    if (target.id === actor.id) {
        tell(actor, 'You cannot target yourself.');
        return null;
    }
    if (!closeEnough(actor, target)) {
        tell(actor, 'The patient must be within 3 metres and in the same dimension.');
        return null;
    }
    return target;
}

function adminMayManage(actor, target) {
    if (isAdmin(target)) {
        tell(actor, 'An allowlisted hospital administrator cannot be managed in-game.');
        return false;
    }
    const actorRank = rankOf(actor);
    const targetRank = rankOf(target);
    if (targetRank && data.ranks[targetRank].level >= data.ranks[actorRank].level) {
        tell(actor, 'You cannot manage a staff member of equal or higher rank.');
        return false;
    }
    return true;
}

function movePlayer(player, position, dimension) {
    player.dimension = dimension;
    player.position = new mp.Vector3(position.x, position.y, position.z);
}

function distanceSquared(position, target) {
    const dx = position.x - target.x;
    const dy = position.y - target.y;
    const dz = position.z - target.z;
    return dx * dx + dy * dy + dz * dz;
}

function enterHospital(player) {
    if (player.vehicle) return tell(player, 'Exit your vehicle before entering.');
    if (Number(player.dimension) !== Number(data.exterior.dimension)) {
        return tell(player, 'You must be in the public world to enter the hospital.');
    }
    if (distanceSquared(player.position, data.exterior.position) > 16) {
        return tell(player, 'Move to the hospital entrance first.');
    }
    if (!interiorEnabled()) {
        return tell(player, 'The hospital interior is not installed yet; entrance disabled to prevent falling through the map.');
    }
    movePlayer(player, data.interior.entrance, data.interior.dimension);
    player.setVariable('hospital:inside', true);
    tell(player, 'Welcome to St Fiacre Hospital. Use E at the marked door to exit.');
}

function exitHospital(player) {
    if (player.vehicle) return tell(player, 'Exit your vehicle before leaving.');
    const position = player.position;
    const insideHospitalArea =
        Math.pow(position.x - data.interior.entrance.x, 2) +
        Math.pow(position.y - data.interior.entrance.y, 2) <= 10000;
    if (player.getVariable('hospital:inside') !== true &&
        !(Number(player.dimension) === Number(data.interior.dimension) && insideHospitalArea)) {
        return tell(player, 'You are not inside the hospital.');
    }
    if (!interiorEnabled()) {
        movePlayer(player, data.exterior.position, data.exterior.dimension);
        player.setVariable('hospital:inside', false);
        return tell(player, 'You were returned outside. The hospital interior is not installed yet.');
    }
    if (distanceSquared(player.position, data.interior.exit) > 25) {
        return tell(player, 'Move to the marked hospital exit first.');
    }
    movePlayer(player, data.exterior.position, data.exterior.dimension);
    player.setVariable('hospital:inside', false);
    tell(player, 'You have exited St Fiacre Hospital.');
}

mp.events.add('playerJoin', player => {
    player.setVariable('hospital:duty', false);
    player.setVariable('hospital:inside', false);
});

mp.events.add('hospital:enter', player => enterHospital(player));
mp.events.add('hospital:exit', player => exitHospital(player));

mp.events.addCommand('henter', player => enterHospital(player));
mp.events.addCommand('hexit', player => exitHospital(player));
mp.events.addCommand('hreset', player => {
    if (player.vehicle) return tell(player, 'Exit your vehicle before using recovery.');
    const position = player.position;
    const dx = position.x - data.interior.entrance.x;
    const dy = position.y - data.interior.entrance.y;
    const inHospitalArea = dx * dx + dy * dy <= 10000;
    if (player.getVariable('hospital:inside') !== true && !inHospitalArea) {
        return tell(player, 'Recovery is only available at the hospital.');
    }
    movePlayer(player, data.exterior.position, data.exterior.dimension);
    player.setVariable('hospital:inside', false);
    tell(player, 'You were safely returned outside the hospital.');
});

mp.events.addCommand('hospital', player => {
    const rank = rankOf(player);
    if (!rank) {
        tell(player, 'You are not on the hospital staff roster. The interior is disabled until interior assets are installed.');
        return;
    }
    const state = player.getVariable('hospital:duty') === true ? 'on duty' : 'off duty';
    tell(player, `${labelOf(rank)} — ${state}. Commands: /hduty, /heal <id>, /revive <id>. Staff management: /hhire <id>, /hpromote <id> <rank>, /hdemote <id> <rank>, /hfire <id>.`);
});

mp.events.addCommand('hduty', player => {
    if (!hasCapability(player, 'duty')) {
        tell(player, 'You are not on the hospital staff roster.');
        return;
    }
    const onDuty = player.getVariable('hospital:duty') !== true;
    player.setVariable('hospital:duty', onDuty);
    tell(player, onDuty
        ? `You are on duty as ${labelOf(rankOf(player))}.`
        : 'You are off duty.');
});

mp.events.addCommand('heal', (player, _, id) => {
    if (!requireCapability(player, 'treat')) return;
    const target = targetFor(player, id);
    if (!target) return;
    if (target.health <= 0) return tell(player, 'Use /revive for an unconscious patient.');
    if (target.health >= data.maxHealth) return tell(player, 'That patient is already at full health.');
    target.health = data.maxHealth;
    tell(player, `You treated ${target.name}.`);
    tell(target, `You were treated by hospital staff ${player.name}.`);
});

mp.events.addCommand('revive', (player, _, id) => {
    if (!requireCapability(player, 'revive')) return;
    const target = targetFor(player, id);
    if (!target) return;
    if (target.health > 0) return tell(player, 'That patient is not unconscious.');
    const position = target.position;
    const dimension = Number(target.dimension);
    target.spawn(new mp.Vector3(position.x, position.y, position.z));
    target.dimension = dimension;
    target.health = data.maxHealth;
    tell(player, `You revived ${target.name}.`);
    tell(target, `You were revived by hospital staff ${player.name}.`);
});

mp.events.addCommand('hhire', (player, _, id) => {
    if (!requireCapability(player, 'recruit')) return;
    const target = onlinePlayerById(id);
    if (!target) return tell(player, 'Player ID not found.');
    if (target.id === player.id) return tell(player, 'You cannot hire yourself.');
    if (!adminMayManage(player, target)) return;
    const key = accountKey(target);
    if (!key) return tell(player, 'The target has no Social Club identity and cannot be added.');
    if (data.staff[key]) return tell(player, 'That player is already on the hospital roster.');
    data.staff[key] = { name: target.name, rank: 'intern' };
    save();
    tell(player, `Hired ${target.name} as an Intern.`);
    tell(target, 'You have been hired as a hospital Intern. Use /hospital for commands.');
});

function changeRank(player, id, requestedRank, direction) {
    if (!requireCapability(player, 'promote')) return;
    const target = onlinePlayerById(id);
    if (!target) return tell(player, 'Player ID not found.');
    if (target.id === player.id) return tell(player, 'You cannot change your own rank.');
    if (!adminMayManage(player, target)) return;
    const key = accountKey(target);
    const currentRank = rankOf(target);
    const newRank = data.ranks[requestedRank];
    if (!key || !currentRank || !newRank || isAdmin(target)) {
        return tell(player, `Usage: /h${direction} <playerId> <rankKey>. Use /hranks for valid rank keys.`);
    }
    const oldLevel = data.ranks[currentRank].level;
    if ((direction === 'promote' && newRank.level <= oldLevel) ||
        (direction === 'demote' && newRank.level >= oldLevel)) {
        return tell(player, `Choose a rank ${direction === 'promote' ? 'above' : 'below'} ${labelOf(currentRank)}.`);
    }
    if (newRank.level >= data.ranks[rankOf(player)].level) {
        return tell(player, 'You cannot assign a rank equal to or above your own.');
    }
    data.staff[key].rank = requestedRank;
    data.staff[key].name = target.name;
    save();
    tell(player, `${target.name} is now ${newRank.label}.`);
    tell(target, `Your hospital rank is now ${newRank.label}.`);
}

mp.events.addCommand('hpromote', (player, _, id, rank) =>
    changeRank(player, id, rank, 'promote'));
mp.events.addCommand('hdemote', (player, _, id, rank) =>
    changeRank(player, id, rank, 'demote'));

mp.events.addCommand('hranks', player => {
    const lines = Object.keys(data.ranks).map(
        key => `${key} (${data.ranks[key].label})`
    );
    tell(player, 'Rank keys: ' + lines.join(', '));
});

mp.events.addCommand('hfire', (player, _, id) => {
    if (!requireCapability(player, 'fire')) return;
    const target = onlinePlayerById(id);
    if (!target) return tell(player, 'Player ID not found.');
    if (target.id === player.id) return tell(player, 'You cannot remove yourself.');
    if (!adminMayManage(player, target)) return;
    const key = accountKey(target);
    if (!key || !data.staff[key]) {
        return tell(player, 'That player is not on the hospital roster.');
    }
    delete data.staff[key];
    save();
    target.setVariable('hospital:duty', false);
    tell(player, `${target.name} has been removed from the hospital roster.`);
    tell(target, 'You have been removed from the hospital roster.');
});
