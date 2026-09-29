const fs = require('fs');
const path = require('path');

const FLY_ADMINS = new Set(['sephigr', 'torika2']);
const MODERATION_FILE = path.join(__dirname, 'moderation.json');
const MODERATION_DURATIONS = new Map([
    [300, '5 minutes'],
    [1800, '30 minutes'],
    [3600, '1 hour'],
    [21600, '6 hours'],
    [86400, '1 day'],
    [604800, '7 days'],
    [0, 'permanently']
]);
const moderation = JSON.parse(fs.readFileSync(MODERATION_FILE, 'utf8'));
if (!moderation || moderation.version !== 1 ||
    !moderation.mutes || typeof moderation.mutes !== 'object' || Array.isArray(moderation.mutes) ||
    !moderation.bans || typeof moderation.bans !== 'object' || Array.isArray(moderation.bans)) {
    throw new Error('Invalid admin moderation store: expected version 1 with mutes and bans objects.');
}

function validateSanctions(collection, label) {
    for (const [key, sanction] of Object.entries(collection)) {
        if (!/^[a-z0-9_.-]{1,64}$/.test(key) || !sanction ||
            typeof sanction.name !== 'string' || !Number.isSafeInteger(sanction.createdAt) ||
            (sanction.expiresAt !== null && !Number.isSafeInteger(sanction.expiresAt))) {
            throw new Error(`Invalid ${label} entry in admin moderation store.`);
        }
    }
}

validateSanctions(moderation.mutes, 'mute');
validateSanctions(moderation.bans, 'ban');
moderation.mutes = Object.assign(Object.create(null), moderation.mutes);
moderation.bans = Object.assign(Object.create(null), moderation.bans);

function saveModeration() {
    const temporaryFile = MODERATION_FILE + '.tmp';
    fs.writeFileSync(temporaryFile, JSON.stringify(moderation, null, 2));
    fs.renameSync(temporaryFile, MODERATION_FILE);
}

function accountKey(player) {
    return String(player.socialClub || '').trim().toLowerCase();
}

function activeSanction(collection, key) {
    const sanction = collection[key];
    if (!sanction) return null;
    if (sanction.expiresAt !== null && sanction.expiresAt <= Date.now()) {
        delete collection[key];
        saveModeration();
        return null;
    }
    return sanction;
}

// Exposed so the chat package can enforce the admin comms-mute (text side).
global.getCommsMute = function (player) {
    const key = accountKey(player);
    return key ? activeSanction(moderation.mutes, key) : null;
};

function moderationDuration(value) {
    if (value === null || value === '' || (typeof value !== 'number' && typeof value !== 'string')) return null;
    const seconds = Number(value);
    return Number.isSafeInteger(seconds) && MODERATION_DURATIONS.has(seconds) ? seconds : null;
}

function sanctionRecord(player, duration) {
    const now = Date.now();
    return {
        name: String(player.name || 'Unknown').slice(0, 64),
        createdAt: now,
        expiresAt: duration === 0 ? null : now + duration * 1000
    };
}

function durationText(duration) {
    return MODERATION_DURATIONS.get(duration);
}

function tell(player, message) {
    player.outputChatBox('!{#e0a94b}[Admin] !{#ffffff}' + message);
}

function isAdmin(player) {
    return FLY_ADMINS.has(String(player.socialClub || '').trim().toLowerCase());
}

function requireAdmin(player) {
    if (isAdmin(player)) return true;
    tell(player, 'You are not authorized to use the admin panel.');
    return false;
}

function requireAdminMode(player) {
    if (!requireAdmin(player)) return false;
    if (player.getVariable('admin:mode') === true) return true;
    tell(player, 'Turn Admin Mode on in the admin panel first.');
    return false;
}

function onlinePlayerById(value) {
    const text = String(value === undefined || value === null ? '' : value);
    if (!/^\d+$/.test(text)) return null;
    const id = Number(text);
    if (!Number.isSafeInteger(id)) return null;
    let found = null;
    mp.players.forEach(target => {
        if (Number(target.id) === id) found = target;
    });
    return found;
}

function syncFlyVisibility(player, enabled) {
    mp.players.forEach(target => {
        target.call('admin:fly:sync', [player.id, enabled]);
    });
}

function sendPlayerList(player) {
    const players = [];
    mp.players.forEach(target => {
        const position = target.position;
        players.push({
            id: Number(target.id),
            name: String(target.name || 'Unknown'),
            health: Math.max(0, Math.min(100, Number(target.health) || 0)),
            dimension: Number(target.dimension) || 0,
            x: Number(position.x.toFixed(1)),
            y: Number(position.y.toFixed(1)),
            z: Number(position.z.toFixed(1)),
            inVehicle: Boolean(target.vehicle),
            isSelf: target.id === player.id,
            isAdmin: isAdmin(target),
            adminMode: player.getVariable('admin:mode') === true,
            muted: Boolean(accountKey(target) && activeSanction(moderation.mutes, accountKey(target))),
            adminFly: target.id === player.id && target.getVariable('admin:fly') === true
        });
    });
    player.call('admin:panel:data', [JSON.stringify(players)]);
}

function finishAction(player, message) {
    tell(player, message);
    player.call('admin:panel:result', [message]);
    sendPlayerList(player);
}

mp.events.add('playerJoin', player => {
    const key = accountKey(player);
    const ban = key && activeSanction(moderation.bans, key);
    if (ban) {
        const until = ban.expiresAt === null ? 'permanently' : `until ${new Date(ban.expiresAt).toISOString()}`;
        player.kick(`You are banned from this server ${until}.`);
        return;
    }

    // re-apply an active comms-mute's voice side once the client is ready
    if (key && activeSanction(moderation.mutes, key)) {
        setTimeout(() => { if (mp.players.exists(player)) player.call('voice:setMuted', [true]); }, 2500);
    }

    player.setVariable('admin:mode', false);
    player.setVariable('admin:panelOpen', false);
    player.setVariable('admin:fly', false);
    player.call('admin:mode:set', [false]);
    mp.players.forEach(target => {
        if (target.id !== player.id && target.getVariable('admin:fly') === true) {
            player.call('admin:fly:sync', [target.id, true]);
        }
    });
});

function toggleAdminPanel(player) {
    if (!requireAdmin(player)) return;
    const open = player.getVariable('admin:panelOpen') !== true;
    player.setVariable('admin:panelOpen', open);
    player.call(open ? 'admin:panel:open' : 'admin:panel:hide');
}

mp.events.addCommand('admin', toggleAdminPanel);
mp.events.add('admin:panel:toggle', toggleAdminPanel);

mp.events.add('admin:panel:closed', player => {
    if (!requireAdmin(player)) return;
    player.setVariable('admin:panelOpen', false);
});

mp.events.add('admin:panel:mode', player => {
    if (!requireAdmin(player)) return;
    const enabled = player.getVariable('admin:mode') !== true;
    player.setVariable('admin:mode', enabled);
    player.call('admin:mode:set', [enabled]);

    if (!enabled && player.getVariable('admin:fly') === true) {
        player.setVariable('admin:fly', false);
        player.call('admin:fly:set', [false]);
        syncFlyVisibility(player, false);
    }

    player.call('admin:panel:result', [enabled ? 'Admin Mode enabled.' : 'Admin Mode disabled.']);
    sendPlayerList(player);
});

mp.events.add('admin:panel:refresh', player => {
    if (!requireAdmin(player)) return;
    sendPlayerList(player);
});

mp.events.add('admin:panel:action', (player, actionJson) => {
    if (!requireAdminMode(player)) return;

    let request;
    try {
        request = JSON.parse(String(actionJson || ''));
    } catch (error) {
        tell(player, 'Invalid panel request.');
        return;
    }
    if (!request || typeof request !== 'object' || Array.isArray(request)) {
        tell(player, 'Invalid panel request.');
        return;
    }

    const action = String(request.action || '');
    const target = onlinePlayerById(request.id);
    if (!target) {
        tell(player, 'Player ID not found; refresh the player list.');
        sendPlayerList(player);
        return;
    }

    if (action === 'heal') {
        if (target.health <= 0) {
            tell(player, 'That player is unconscious; use Revive.');
            return;
        }
        target.health = 100;
        finishAction(player, `Healed ${target.name}.`);
        return;
    }

    if (action === 'revive') {
        if (target.health > 0) {
            tell(player, `${target.name} is not unconscious.`);
            return;
        }
        const position = target.position;
        const dimension = Number(target.dimension);
        target.spawn(new mp.Vector3(position.x, position.y, position.z));
        target.dimension = dimension;
        target.health = 100;
        finishAction(player, `Revived ${target.name}.`);
        return;
    }

    if (action === 'teleportTo') {
        if (target.id === player.id) {
            tell(player, 'You are already at your own location.');
            return;
        }
        if (player.vehicle || target.vehicle) {
            tell(player, 'Both you and the target must be on foot to teleport.');
            return;
        }
        player.dimension = target.dimension;
        player.position = new mp.Vector3(
            target.position.x,
            target.position.y,
            target.position.z + 1
        );
        finishAction(player, `Teleported to ${target.name}.`);
        return;
    }

    if (action === 'bring') {
        if (target.id === player.id) {
            tell(player, 'You cannot bring yourself.');
            return;
        }
        if (player.vehicle || target.vehicle) {
            tell(player, 'Both you and the target must be on foot to bring a player.');
            return;
        }
        target.dimension = player.dimension;
        target.position = new mp.Vector3(
            player.position.x,
            player.position.y,
            player.position.z + 1
        );
        finishAction(player, `Brought ${target.name} to you.`);
        return;
    }

    if (['kick', 'mute', 'unmute', 'ban'].includes(action)) {
        if (target.id === player.id || isAdmin(target)) {
            tell(player, 'You cannot moderate yourself or another allowlisted administrator.');
            return;
        }

        if (action === 'kick') {
            target.kick('Removed by server administration.');
            finishAction(player, `Kicked ${target.name}.`);
            return;
        }

        const key = accountKey(target);
        if (!key) {
            tell(player, 'This player has no Social Club account name; persistent moderation is unavailable.');
            return;
        }

        if (action === 'unmute') {
            if (!activeSanction(moderation.mutes, key)) {
                tell(player, `${target.name} is not muted.`);
                return;
            }
            delete moderation.mutes[key];
            saveModeration();
            target.call('voice:setMuted', [false]);
            target.outputChatBox('!{#e0a94b}[Admin] !{#ffffff}Your mute (text + voice) has been removed.');
            finishAction(player, `Unmuted ${target.name}.`);
            return;
        }

        const duration = moderationDuration(request.duration);
        if (duration === null) {
            tell(player, 'Choose a valid moderation duration in the panel.');
            return;
        }

        const collection = action === 'mute' ? moderation.mutes : moderation.bans;
        collection[key] = sanctionRecord(target, duration);
        saveModeration();

        if (action === 'mute') {
            target.call('voice:setMuted', [true]);
            target.outputChatBox(`!{#e0a94b}[Admin] !{#ffffff}You have been muted (text + voice) ${durationText(duration)}.`);
            finishAction(player, `Muted ${target.name} (text + voice) ${durationText(duration)}.`);
            return;
        }

        const until = duration === 0 ? 'permanently' : `for ${durationText(duration)}`;
        target.kick(`You have been banned from this server ${until}.`);
        finishAction(player, `Banned ${target.name} ${until}.`);
        return;
    }

    tell(player, 'Unknown admin action.');
});

mp.events.add('playerChat', (player) => {
    const key = accountKey(player);
    const mute = key && activeSanction(moderation.mutes, key);
    if (!mute) return;
    const until = mute.expiresAt === null ? 'permanently' : `until ${new Date(mute.expiresAt).toISOString()}`;
    player.outputChatBox(`!{#e0a94b}[Admin] !{#ffffff}You are muted ${until}.`);
    return false;
});

mp.events.add('admin:panel:unban', (player, rawAccount) => {
    if (!requireAdminMode(player)) return;
    const key = String(rawAccount || '').trim().toLowerCase();
    if (!/^[a-z0-9_.-]{1,64}$/.test(key)) {
        player.call('admin:panel:result', ['Enter a valid Social Club account name.']);
        return;
    }
    if (!activeSanction(moderation.bans, key)) {
        player.call('admin:panel:result', [`No active ban found for ${key}.`]);
        return;
    }
    delete moderation.bans[key];
    saveModeration();
    player.call('admin:panel:result', [`Unbanned ${key}.`]);
});

mp.events.add('admin:panel:announce', (player, rawMessage) => {
    if (!requireAdminMode(player)) return;
    const message = String(rawMessage || '').replace(/[\r\n!{}<>]/g, ' ').trim().slice(0, 180);
    if (!message) {
        tell(player, 'Announcement cannot be empty.');
        return;
    }
    mp.players.forEach(target => {
        target.outputChatBox(`!{#e0a94b}[Announcement] !{#ffffff}${message}`);
    });
    player.call('admin:panel:result', ['Announcement sent.']);
});

function toggleAdminFlight(player) {
    const currentlyEnabled = player.getVariable('admin:fly') === true;
    if (!currentlyEnabled && player.vehicle) {
        tell(player, 'Exit your vehicle before enabling flight.');
        return null;
    }

    const enabled = !currentlyEnabled;
    player.setVariable('admin:fly', enabled);
    player.call('admin:fly:set', [enabled]);
    syncFlyVisibility(player, enabled);
    tell(player, enabled
        ? 'Flight enabled. WASD moves, Space rises, Ctrl descends, Shift speeds up. Use /fly again to stop.'
        : 'Flight disabled.');
    sendPlayerList(player);
    return enabled;
}

mp.events.addCommand('fly', player => {
    if (!requireAdminMode(player)) return;
    toggleAdminFlight(player);
});

mp.events.add('admin:fly:toggle', player => {
    if (!requireAdminMode(player)) return;
    toggleAdminFlight(player);
});

mp.events.add('admin:panel:fly', player => {
    if (!requireAdminMode(player)) return;
    const enabled = toggleAdminFlight(player);
    if (enabled === null) {
        player.call('admin:panel:result', ['Exit your vehicle before enabling flight.']);
        return;
    }
    player.call('admin:panel:result', [enabled ? 'Flight enabled.' : 'Flight disabled.']);
});

mp.events.add('playerQuit', player => {
    syncFlyVisibility(player, false);
    player.setVariable('admin:fly', false);
});

mp.events.add('playerDeath', player => {
    if (player.getVariable('admin:fly') !== true) return;
    player.setVariable('admin:fly', false);
    player.call('admin:fly:set', [false]);
    syncFlyVisibility(player, false);
    sendPlayerList(player);
});
