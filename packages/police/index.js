const fs = require('fs');
const path = require('path');

const DATA_FILE = path.join(__dirname, 'police.json');
const data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
const jailTimers = new Map();

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
    if (isAdmin(player)) return 'chief';
    const officer = data.officers[accountKey(player)];
    return officer && data.ranks[officer.rank] ? officer.rank : null;
}

function labelOf(rank) {
    return rank ? data.ranks[rank].label : 'Civilian';
}

// On the police roster (excludes admins who merely get 'chief' powers). For the spawn selector.
global.policeIsOfficer = (player) => !!data.officers[accountKey(player)];

function hasCapability(player, capability) {
    const rank = rankOf(player);
    return rank !== null && data.ranks[rank].capabilities.includes(capability);
}

function tell(player, message) {
    player.outputChatBox('!{#e0a94b}[Police] !{#ffffff}' + message);
}

function requireDuty(player) {
    if (!hasCapability(player, 'duty')) {
        tell(player, 'You are not a police officer.');
        return false;
    }
    if (player.getVariable('police:duty') !== true) {
        tell(player, 'Go on duty first with /pduty.');
        return false;
    }
    return true;
}

function requireCapability(player, capability) {
    if (!requireDuty(player)) return false;
    if (!hasCapability(player, capability)) {
        tell(player, 'Your rank does not have permission for that.');
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

function targetFor(actor, idText, requireNearby = true) {
    const target = onlinePlayerById(idText);
    if (!target) {
        tell(actor, 'Player ID not found. Use the ID shown in the player list.');
        return null;
    }
    if (target.id === actor.id) {
        tell(actor, 'You cannot target yourself.');
        return null;
    }
    if (requireNearby && !closeEnough(actor, target)) {
        tell(actor, 'The player must be within 3 metres and in the same dimension.');
        return null;
    }
    return target;
}

function adminMayManage(actor, target) {
    if (isAdmin(target)) {
        tell(actor, 'An allowlisted police administrator cannot be managed in-game.');
        return false;
    }
    const actorRank = rankOf(actor);
    const targetRank = rankOf(target);
    if (targetRank && data.ranks[targetRank].level >= data.ranks[actorRank].level) {
        tell(actor, 'You cannot manage an officer of equal or higher rank.');
        return false;
    }
    return true;
}

function setCuffed(target, cuffed) {
    target.setVariable('police:cuffed', cuffed);
    target.freezePosition(cuffed);
}

function findOnlineByAccount(key) {
    let found = null;
    mp.players.forEach(player => {
        if (accountKey(player) === key) found = player;
    });
    return found;
}

function stopJailTimer(key) {
    const timer = jailTimers.get(key);
    if (timer) clearTimeout(timer);
    jailTimers.delete(key);
}

function movePlayer(player, position, dimension) {
    player.dimension = dimension;
    player.position = new mp.Vector3(position.x, position.y, position.z);
}

function releaseJail(key, message) {
    const record = data.activeJails[key];
    if (!record) return;
    stopJailTimer(key);
    delete data.activeJails[key];
    save();

    const player = findOnlineByAccount(key);
    if (!player) return;
    movePlayer(player, record.returnPosition, record.returnDimension);
    setCuffed(player, false);
    player.setVariable('police:arrested', false);
    player.setVariable('police:jailed', false);
    tell(player, message);
}

function scheduleJailRelease(key) {
    stopJailTimer(key);
    const record = data.activeJails[key];
    if (!record) return;
    const delay = Math.max(0, record.releaseAt - Date.now());
    jailTimers.set(key, setTimeout(() => releaseJail(key, 'Your jail sentence is complete.'), delay));
}

function restoreOrJailOnJoin(player) {
    player.setVariable('police:duty', false);
    player.setVariable('police:cuffed', false);
    player.setVariable('police:arrested', false);
    player.setVariable('police:jailed', false);

    const key = accountKey(player);
    const record = data.activeJails[key];
    if (!key || !record) return;
    if (record.releaseAt <= Date.now()) {
        movePlayer(player, record.returnPosition, record.returnDimension);
        delete data.activeJails[key];
        save();
        tell(player, 'Your jail sentence ended while you were offline.');
        return;
    }
    movePlayer(player, data.jail.position, data.jail.dimension);
    setCuffed(player, true);
    player.setVariable('police:arrested', true);
    player.setVariable('police:jailed', true);
    tell(player, 'You are serving a remaining jail sentence.');
    scheduleJailRelease(key);
}

mp.events.add('playerJoin', restoreOrJailOnJoin);

mp.events.addCommand('police', (player) => {
    const rank = rankOf(player);
    if (!rank) return tell(player, 'You are not on the police roster.');
    const state = player.getVariable('police:duty') === true ? 'on duty' : 'off duty';
    tell(player, `${labelOf(rank)} — ${state}. Commands: /pduty, /cuff <id>, /uncuff <id>, /arrest <id>, /jail <id> <minutes>, /release <id>. Management: /hire <id>, /promote <id> <rank>, /demote <id> <rank>, /fire <id>.`);
});

mp.events.addCommand('pduty', (player) => {
    if (!hasCapability(player, 'duty')) return tell(player, 'You are not a police officer.');
    const onDuty = player.getVariable('police:duty') !== true;
    player.setVariable('police:duty', onDuty);
    tell(player, onDuty ? `You are on duty as ${labelOf(rankOf(player))}.` : 'You are off duty.');
});

mp.events.addCommand('cuff', (player, _, id) => {
    if (!requireCapability(player, 'cuff')) return;
    const target = targetFor(player, id);
    if (!target) return;
    if (target.getVariable('police:jailed') === true) return tell(player, 'That player is already jailed.');
    if (target.getVariable('police:cuffed') === true) return tell(player, 'That player is already handcuffed.');
    setCuffed(target, true);
    tell(player, `Handcuffed player ${target.id}.`);
    tell(target, `You have been handcuffed by ${player.name}.`);
});

mp.events.addCommand('uncuff', (player, _, id) => {
    if (!requireCapability(player, 'cuff')) return;
    const target = targetFor(player, id);
    if (!target) return;
    if (target.getVariable('police:arrested') === true || target.getVariable('police:jailed') === true) {
        return tell(player, 'An arrested or jailed player cannot be uncuffed this way.');
    }
    if (target.getVariable('police:cuffed') !== true) return tell(player, 'That player is not handcuffed.');
    setCuffed(target, false);
    tell(player, `Uncuffed player ${target.id}.`);
    tell(target, 'You have been uncuffed.');
});

mp.events.addCommand('arrest', (player, _, id) => {
    if (!requireCapability(player, 'arrest')) return;
    const target = targetFor(player, id);
    if (!target) return;
    if (target.getVariable('police:cuffed') !== true) return tell(player, 'Handcuff the player first.');
    target.setVariable('police:arrested', true);
    tell(player, `Player ${target.id} is under arrest. Use /jail ${target.id} <minutes> to sentence them.`);
    tell(target, `You have been arrested by ${player.name}.`);
});

mp.events.addCommand('jail', (player, _, id, minutesText) => {
    if (!requireCapability(player, 'jail')) return;
    const target = targetFor(player, id);
    if (!target) return;
    const minutes = Number(minutesText);
    if (!Number.isSafeInteger(minutes) || minutes < data.jail.minMinutes || minutes > data.jail.maxMinutes) {
        return tell(player, `Usage: /jail <playerId> <${data.jail.minMinutes}-${data.jail.maxMinutes} minutes>`);
    }
    if (target.getVariable('police:arrested') !== true || target.getVariable('police:cuffed') !== true) {
        return tell(player, 'The player must be handcuffed and arrested first.');
    }
    const key = accountKey(target);
    if (!key) return tell(player, 'The target has no Social Club identity; jail persistence is unavailable.');
    if (data.activeJails[key]) return tell(player, 'That player is already jailed.');

    data.activeJails[key] = {
        releaseAt: Date.now() + minutes * 60 * 1000,
        returnPosition: { x: target.position.x, y: target.position.y, z: target.position.z },
        returnDimension: Number(target.dimension)
    };
    save();
    movePlayer(target, data.jail.position, data.jail.dimension);
    setCuffed(target, true);
    target.setVariable('police:arrested', true);
    target.setVariable('police:jailed', true);
    scheduleJailRelease(key);
    tell(player, `Player ${target.id} jailed for ${minutes} minute(s).`);
    tell(target, `You have been jailed for ${minutes} minute(s).`);
});

mp.events.addCommand('release', (player, _, id) => {
    if (!requireCapability(player, 'release')) return;
    const target = targetFor(player, id);
    if (!target) return;
    const key = accountKey(target);
    if (!key || !data.activeJails[key]) return tell(player, 'That player is not serving a jail sentence.');
    tell(player, `Released player ${target.id} early.`);
    releaseJail(key, 'You have been released early.');
});

mp.events.addCommand('hire', (player, _, id) => {
    if (!requireCapability(player, 'recruit')) return;
    const target = targetFor(player, id, false);
    if (!target) return;
    if (!adminMayManage(player, target)) return;
    const key = accountKey(target);
    if (!key) return tell(player, 'The target has no Social Club identity; they cannot be added to the roster.');
    if (data.officers[key]) return tell(player, 'That player is already on the police roster.');
    data.officers[key] = { name: target.name, rank: 'cadet' };
    save();
    tell(player, `Hired ${target.name} as Cadet.`);
    tell(target, 'You have been hired as a Cadet. Use /police for commands.');
});

function changeRank(player, id, requestedRank, direction) {
    if (!requireCapability(player, 'promote')) return;
    const target = targetFor(player, id, false);
    if (!target) return;
    if (!adminMayManage(player, target)) return;
    const key = accountKey(target);
    const currentRank = rankOf(target);
    const newRank = data.ranks[requestedRank];
    if (!key || !currentRank || !newRank || isAdmin(target)) {
        return tell(player, 'Usage: /' + direction + ' <playerId> <rankKey>. Use /ranks for rank keys.');
    }
    const oldLevel = data.ranks[currentRank].level;
    if ((direction === 'promote' && newRank.level <= oldLevel) ||
        (direction === 'demote' && newRank.level >= oldLevel)) {
        return tell(player, `Choose a rank ${direction === 'promote' ? 'above' : 'below'} ${labelOf(currentRank)}.`);
    }
    if (newRank.level >= data.ranks[rankOf(player)].level) {
        return tell(player, 'You cannot assign a rank equal to or above your own.');
    }
    data.officers[key].rank = requestedRank;
    data.officers[key].name = target.name;
    save();
    tell(player, `${target.name} is now ${newRank.label}.`);
    tell(target, `Your police rank is now ${newRank.label}.`);
}

mp.events.addCommand('promote', (player, _, id, rank) => changeRank(player, id, rank, 'promote'));
mp.events.addCommand('demote', (player, _, id, rank) => changeRank(player, id, rank, 'demote'));

mp.events.addCommand('ranks', (player) => {
    const lines = Object.keys(data.ranks).map(key => `${key} (${data.ranks[key].label})`);
    tell(player, 'Rank keys: ' + lines.join(', '));
});

mp.events.addCommand('fire', (player, _, id) => {
    if (!requireCapability(player, 'fire')) return;
    const target = targetFor(player, id, false);
    if (!target) return;
    if (!adminMayManage(player, target)) return;
    const key = accountKey(target);
    if (!key || !data.officers[key]) return tell(player, 'That player is not on the police roster.');
    delete data.officers[key];
    save();
    target.setVariable('police:duty', false);
    tell(player, `${target.name} has been removed from the police roster.`);
    tell(target, 'You have been removed from the police roster.');
});