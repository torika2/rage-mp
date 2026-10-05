const fs = require('fs');
const path = require('path');
const carHandling = require('./carhandling'); // add-on car handling editor (Cars tab)
const carSpeed = require('./carspeed');       // live per-car speed multiplier (Cars tab)

// Hardcoded "owner" admins — can't be removed, and only they can grant/revoke admin in the panel.
const FLY_ADMINS = new Set(['sephigr', 'torika2']);
// Dynamic admins granted via the panel, persisted by Social Club (lowercase) in admins.json.
const ADMINS_FILE = path.join(__dirname, 'admins.json');
let grantedAdmins = new Set();
try {
    const d = JSON.parse(fs.readFileSync(ADMINS_FILE, 'utf8'));
    if (d && Array.isArray(d.admins)) grantedAdmins = new Set(d.admins.map(s => String(s).trim().toLowerCase()).filter(Boolean));
} catch (e) { grantedAdmins = new Set(); }
function saveAdmins() {
    const temporaryFile = ADMINS_FILE + '.tmp';
    try { fs.writeFileSync(temporaryFile, JSON.stringify({ admins: [...grantedAdmins] }, null, 2)); fs.renameSync(temporaryFile, ADMINS_FILE); } catch (e) {}
}
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

// Mute/ban length in seconds: 0 = permanent, otherwise whole minutes from 1 minute up to 1 year
// (the panel sends minutes * 60).
const MAX_MODERATION_SECONDS = 365 * 24 * 60 * 60;
function moderationDuration(value) {
    if (value === null || value === '' || (typeof value !== 'number' && typeof value !== 'string')) return null;
    const seconds = Number(value);
    if (!Number.isSafeInteger(seconds)) return null;
    if (seconds === 0 || MODERATION_DURATIONS.has(seconds)) return seconds;
    return seconds >= 60 && seconds <= MAX_MODERATION_SECONDS && seconds % 60 === 0 ? seconds : null;
}

function sanctionRecord(player, duration) {
    const now = Date.now();
    return {
        name: String(player.name || 'Unknown').slice(0, 64),
        createdAt: now,
        expiresAt: duration === 0 ? null : now + duration * 1000
    };
}

// "permanently" or "for 1 day 6 hours" / "for 45 minutes".
function durationText(duration) {
    if (duration === 0) return 'permanently';
    let minutes = Math.round(duration / 60);
    const days = Math.floor(minutes / 1440); minutes -= days * 1440;
    const hours = Math.floor(minutes / 60); minutes -= hours * 60;
    const parts = [];
    if (days) parts.push(days + (days === 1 ? ' day' : ' days'));
    if (hours) parts.push(hours + (hours === 1 ? ' hour' : ' hours'));
    if (minutes) parts.push(minutes + (minutes === 1 ? ' minute' : ' minutes'));
    return 'for ' + parts.join(' ');
}

function tell(player, message) {
    player.outputChatBox('!{#e0a94b}[Admin] !{#ffffff}' + message);
}

function adminKey(player) { return String(player.socialClub || '').trim().toLowerCase(); }
function isOwnerAdmin(player) { const k = adminKey(player); return k !== '' && FLY_ADMINS.has(k); }
function isAdmin(player) { const k = adminKey(player); return k !== '' && (FLY_ADMINS.has(k) || grantedAdmins.has(k)); }

global.isProtectedAdmin = isAdmin;

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
            isOwnerAdmin: isOwnerAdmin(target),      // owners can't be revoked
            viewerIsOwner: isOwnerAdmin(player),     // only owners see the grant/revoke buttons
            adminMode: player.getVariable('admin:mode') === true,
            muted: Boolean(accountKey(target) && activeSanction(moderation.mutes, accountKey(target))),
            demorgan: typeof global.demorganIsJailed === 'function' && global.demorganIsJailed(target),
            demorganMinutes: typeof global.demorganMinutesLeft === 'function' ? global.demorganMinutesLeft(target) : 0,
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
    player.setVariable('admin:esp', isAdmin(player)); // admins get player ESP automatically
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

    if (action === 'makeAdmin' || action === 'removeAdmin') {
        if (!isOwnerAdmin(player)) { tell(player, 'Only an owner admin can grant or revoke admin.'); return; }
        const key = adminKey(target);
        if (!key) { tell(player, 'That player has no Social Club identity; cannot change admin.'); return; }
        if (FLY_ADMINS.has(key)) { tell(player, 'That player is an owner admin and cannot be changed here.'); return; }
        if (action === 'makeAdmin') {
            if (grantedAdmins.has(key)) { tell(player, `${target.name} is already an admin.`); return; }
            grantedAdmins.add(key); saveAdmins();
            target.setVariable('admin:esp', true); // ESP on immediately
            finishAction(player, `${target.name} is now an admin.`);
            target.outputChatBox('!{#8ed17a}[Admin] !{#ffffff}You have been granted admin. Use /admin.');
        } else {
            if (!grantedAdmins.has(key)) { tell(player, `${target.name} is not a granted admin.`); return; }
            grantedAdmins.delete(key); saveAdmins();
            target.setVariable('admin:mode', false);
            target.setVariable('admin:esp', false); // ESP off
            finishAction(player, `Removed admin from ${target.name}.`);
            target.outputChatBox('!{#ff6b6b}[Admin] !{#ffffff}Your admin access has been removed.');
        }
        return;
    }

    if (action === 'kill') {
        if (target.id === player.id || isAdmin(target)) {
            tell(player, 'You cannot kill yourself or an allowlisted administrator.');
            return;
        }
        target.health = 0;
        finishAction(player, `Killed ${target.name}.`);
        return;
    }

    if (action === 'addMoney') {
        const amount = request.amount;
        if (!Number.isSafeInteger(amount) || amount <= 0 || amount > 1000000) {
            tell(player, 'Money amount must be a whole number between 1 and 1,000,000.');
            return;
        }
        if (typeof global.adminAddMoney !== 'function') {
            tell(player, 'Money service is unavailable; no money was added.');
            console.error('[admin] adminAddMoney API is unavailable.');
            return;
        }
        let balance;
        try {
            balance = global.adminAddMoney(target, amount);
        } catch (error) {
            console.error(`[admin] Could not add money to ${target.name}:`, error);
            tell(player, 'Could not add money; the balance was not changed.');
            return;
        }
        finishAction(player, `Added $${amount} to ${target.name}. New balance: $${balance}.`);
        target.outputChatBox(`!{#8ed17a}[Admin] !{#ffffff}An administrator added $${amount} to your balance.`);
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
        // Go through the hospital death system so the 30-second revive window is enforced.
        if (typeof global.hospitalRevive === 'function') {
            const refused = global.hospitalRevive(target);
            if (refused) {
                tell(player, refused); // "უკვე გარდაიცვალა ვერ გააცოცხლებ"
                return;
            }
            finishAction(player, `Revived ${target.name}.`);
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
            if (typeof global.voiceRelink === 'function') global.voiceRelink(target); // restore server-side voice
            target.outputChatBox('!{#e0a94b}[Admin] !{#ffffff}Your mute (text + voice) has been removed.');
            finishAction(player, `Unmuted ${target.name}.`);
            return;
        }

        const duration = moderationDuration(request.duration);
        if (duration === null) {
            tell(player, 'Choose a valid moderation duration in the panel.');
            return;
        }

        if (action === 'ban' && duration % 86400 !== 0) {
            tell(player, 'Bans are in whole days (1, 3, 7, 14, 30) or permanent.');
            return;
        }

        const collection = action === 'mute' ? moderation.mutes : moderation.bans;
        collection[key] = sanctionRecord(target, duration);
        saveModeration();

        if (action === 'mute') {
            target.call('voice:setMuted', [true]);
            if (typeof global.voiceRelink === 'function') global.voiceRelink(target); // cut server-side voice
            target.outputChatBox(`!{#e0a94b}[Admin] !{#ffffff}You have been muted (text + voice) ${durationText(duration)}.`);
            finishAction(player, `Muted ${target.name} (text + voice) ${durationText(duration)}.`);
            return;
        }

        const until = durationText(duration);
        target.kick(`You have been banned from this server ${until}.`);
        finishAction(player, `Banned ${target.name} ${until}.`);
        return;
    }

    // Demorgan (packages/demorgan): duration arrives in seconds from the panel's minutes field.
    if (action === 'demorgan' || action === 'undemorgan') {
        if (typeof global.demorganSend !== 'function') { tell(player, 'Demorgan is unavailable.'); return; }
        const ok = action === 'demorgan'
            ? global.demorganSend(player, target, Math.round(Number(request.duration) / 60), String(request.reason || '').trim().slice(0, 100) || 'Admin panel')
            : global.demorganRelease(player, target);
        if (ok) finishAction(player, action === 'demorgan' ? `${target.name} sent to Demorgan.` : `${target.name} released from Demorgan.`);
        else sendPlayerList(player);
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

// ---- Commands tab: every chat command on the server, runnable from the panel ----
// cmd = what gets typed (may include a fixed sub-command); args = usage of the rest; target = the
// first argument is a player id (the panel offers a player picker). Anything registered via
// mp.events.addCommand but missing here is still listed under "Other" (from global.commandRegistry).
// Running a command is exactly like typing it: each command still does its own permission checks.
const COMMAND_CATALOG = [
    { group: 'General', cmd: 'pos', desc: 'Show your coordinates and heading' },
    { group: 'General', cmd: 'tp', args: '<x> <y> <z>', desc: 'Teleport to coordinates' },
    { group: 'General', cmd: 'hospital', desc: 'Teleport to Central LS Medical Center' },
    { group: 'General', cmd: 'money', desc: 'Show your cash' },
    { group: 'General', cmd: 'bank', desc: 'Show your cash and bank balance' },
    { group: 'General', cmd: 'needs', desc: 'Show your hunger and thirst' },
    { group: 'General', cmd: 'inv', desc: 'Re-send your inventory to the client' },
    { group: 'General', cmd: 'laws', desc: 'List the state laws' },
    { group: 'Vehicles', cmd: 'car', args: '<model>', desc: 'Spawn a car (e.g. adder, bmwm4, audirs7) and get in' },
    { group: 'Vehicles', cmd: 'cars', desc: 'List the add-on car names' },
    { group: 'Vehicles', cmd: 'fix', desc: 'Repair the car you are in' },
    { group: 'Vehicles', cmd: 'dv', desc: 'Delete your car' },
    { group: 'Vehicles', cmd: 'livery', args: '<number>', desc: 'Set livery on the car you are in' },
    { group: 'Economy & shops', cmd: 'addmoney', args: '<1-1000000>', desc: 'Add money to yourself (Admin Mode)' },
    { group: 'Economy & shops', cmd: 'store', desc: 'Show the 24/7 catalog' },
    { group: 'Economy & shops', cmd: 'buy', args: '<item> [qty]', desc: 'Buy from a 24/7 (stand at a store)' },
    { group: 'Economy & shops', cmd: 'guns', desc: 'Show the Ammu-Nation catalog' },
    { group: 'Economy & shops', cmd: 'buygun', args: '<weapon> [ammo boxes]', desc: 'Buy a weapon/ammo (stand at Ammu-Nation)' },
    { group: 'Economy & shops', cmd: 'buyarmor', desc: 'Buy body armour (stand at Ammu-Nation)' },
    { group: 'Parking', cmd: 'parkings', desc: 'Your parking rentals and stored cars' },
    { group: 'Parking', cmd: 'rentspot', args: '<days> [slots]', desc: 'Rent the parking spot you stand at' },
    { group: 'Parking', cmd: 'renewspot', args: '<days>', desc: 'Extend your parking rental' },
    { group: 'Parking', cmd: 'park', desc: 'Store your car in your rented spot' },
    { group: 'Parking', cmd: 'unpark', args: '[slot]', desc: 'Take a stored car out of your spot' },
    { group: 'Parking', cmd: 'impound', desc: 'Get your impounded car back (fee)' },
    { group: 'Parking', cmd: 'addparkspot', args: '<price per day>', desc: 'Admin: create a parking spot where you stand' },
    { group: 'Parking', cmd: 'delparkspot', args: '<id>', desc: 'Admin: delete a parking spot' },
    { group: 'Parking', cmd: 'parkspots', desc: 'Admin: list parking spots' },
    { group: 'Clothing', cmd: 'arms', args: '<number>', desc: 'Try arms (component 3) on your worn top' },
    { group: 'Clothing', cmd: 'armsfit', args: '<arms> [texture] | reset', desc: 'Save the fitting arms for the top you wear (everyone)' },
    { group: 'Government', cmd: 'gov', desc: 'Your government rank and commands' },
    { group: 'Government', cmd: 'gduty', desc: 'Go on/off government duty (at City Hall)' },
    { group: 'Government', cmd: 'gannounce', args: '<text>', desc: 'Government announcement to everyone' },
    { group: 'Government', cmd: 'fine', args: '<id> <amount> [reason]', target: true, desc: 'Fine a player (unpaid part is payable at City Hall)' },
    { group: 'Government', cmd: 'treasury', desc: 'Show the treasury and tax rate' },
    { group: 'Government', cmd: 'tax', args: '<percent>', desc: 'Set the sales tax' },
    { group: 'Government', cmd: 'paysalary', desc: 'Pay on-duty officials now' },
    { group: 'Government', cmd: 'setlaw add', args: '<text>', desc: 'Add a law' },
    { group: 'Government', cmd: 'setlaw remove', args: '<number>', desc: 'Remove a law' },
    { group: 'Government', cmd: 'ghire', args: '<id>', target: true, desc: 'Hire a government official' },
    { group: 'Government', cmd: 'gpromote', args: '<id> <rank>', target: true, desc: 'Promote an official' },
    { group: 'Government', cmd: 'gdemote', args: '<id> <rank>', target: true, desc: 'Demote an official' },
    { group: 'Government', cmd: 'gfire', args: '<id>', target: true, desc: 'Fire an official' },
    { group: 'Government', cmd: 'granks', desc: 'List government ranks' },
    { group: 'Police', cmd: 'police', desc: 'Your police rank and commands' },
    { group: 'Police', cmd: 'pduty', desc: 'Go on/off police duty' },
    { group: 'Police', cmd: 'cuff', args: '<id>', target: true, desc: 'Cuff a player' },
    { group: 'Police', cmd: 'uncuff', args: '<id>', target: true, desc: 'Uncuff a player' },
    { group: 'Police', cmd: 'arrest', args: '<id>', target: true, desc: 'Arrest a cuffed player' },
    { group: 'Police', cmd: 'jail', args: '<id> <minutes>', target: true, desc: 'Jail a player' },
    { group: 'Police', cmd: 'release', args: '<id>', target: true, desc: 'Release from jail' },
    { group: 'Police', cmd: 'hire', args: '<id>', target: true, desc: 'Hire a police officer' },
    { group: 'Police', cmd: 'promote', args: '<id> <rank>', target: true, desc: 'Promote an officer' },
    { group: 'Police', cmd: 'demote', args: '<id> <rank>', target: true, desc: 'Demote an officer' },
    { group: 'Police', cmd: 'fire', args: '<id>', target: true, desc: 'Fire an officer' },
    { group: 'Police', cmd: 'ranks', desc: 'List police ranks' },
    { group: 'City Hall', cmd: 'cityhall', desc: 'List City Hall points' },
    { group: 'City Hall', cmd: 'cityhall arrange', desc: 'Line up all City Hall NPCs + duty point where you stand, facing your direction' },
    { group: 'City Hall', cmd: 'cityhall set', args: '<entrance|duty|desk|clerk|licenses|weapons|spawn>', desc: 'Move a City Hall point / NPC to where you stand' },
    { group: 'City Hall', cmd: 'licenses', args: '[id]', desc: "Your licenses, or a player's (police / officials on duty, admins)" },
    { group: 'City Hall', cmd: 'revokelicense', args: '<id> <driving|motorcycle|truck|boat|pilot|hunting|business|weapon>', target: true, desc: 'Take a license away (on-duty police, admins)' },
    { group: 'City Hall', cmd: 'cityhall tp', args: '<point>', desc: 'Teleport to a City Hall point' },
    { group: 'City Hall', cmd: 'cityhall reset', args: '<point>', desc: 'Reset a City Hall point to default' },
    { group: 'Houses', cmd: 'houses', desc: 'Buyable houses near you, with GPS + map highlight (anyone)' },
    { group: 'Houses', cmd: 'house list', desc: 'List all houses' },
    { group: 'Houses', cmd: 'house info', args: '[id]', desc: 'House details (no id: the door you stand at)' },
    { group: 'Houses', cmd: 'house add', args: '<price> <interior|walkin> [name]', desc: 'Put the house at your position up for sale' },
    { group: 'Houses', cmd: 'house building', args: '<key> <units> <price> <interior> [name]', desc: 'Create an apartment building at your position' },
    { group: 'Houses', cmd: 'house addunit', args: '<building> <price> [interior]', desc: 'Add an apartment to a building' },
    { group: 'Houses', cmd: 'house interiors', desc: 'List interiors' },
    { group: 'Houses', cmd: 'house itp', args: '<interior>', desc: 'Visit an interior (to check it)' },
    { group: 'Houses', cmd: 'house addinterior', args: '<key> [label]', desc: 'Save your spot as an interior (fixes a preset)' },
    { group: 'Houses', cmd: 'house delinterior', args: '<key>', desc: 'Delete a custom interior' },
    { group: 'Houses', cmd: 'house setinterior', args: '<id> <interior|walkin>', desc: 'Change a house interior' },
    { group: 'Houses', cmd: 'house price', args: '<id> <price>', desc: 'Change a house price' },
    { group: 'Houses', cmd: 'house name', args: '<id> <name>', desc: 'Rename a house' },
    { group: 'Houses', cmd: 'house movedoor', args: '[id]', desc: 'Move a house / building entrance to your position' },
    { group: 'Houses', cmd: 'house setdoor', args: '<id>', desc: 'Re-pick the real door (walk-in houses; look at it)' },
    { group: 'Houses', cmd: 'house setchest', args: '<id>', desc: 'Put the chest where you stand (inside)' },
    { group: 'Houses', cmd: 'house setgarage', args: '<id>', desc: 'Put the garage where you stand / park' },
    { group: 'Houses', cmd: 'house setspawn', args: '<id>', desc: 'Set where the owner spawns' },
    { group: 'Houses', cmd: 'house tp', args: '<id>', desc: 'Teleport to a house door' },
    { group: 'Houses', cmd: 'house evict', args: '[id]', desc: 'Take a house back from its owner' },
    { group: 'Houses', cmd: 'house remove', args: '[id]', desc: 'Delete a for-sale house (no id: the door / building you stand at)' },
    { group: 'Admin', cmd: 'fly', desc: 'Toggle flight (Admin Mode; also the N key)' },
    { group: 'Admin', cmd: 'demorgan', args: '<id> <minutes> [reason]', target: true, desc: 'Send a player to Demorgan (admin jail, own dimension; Admin Mode)' },
    { group: 'Admin', cmd: 'undemorgan', args: '<id>', target: true, desc: 'Release a player from Demorgan (Admin Mode)' },
    { group: 'Admin', cmd: 'demorgans', desc: 'List everyone serving Demorgan (online + offline)' },
    { group: 'Admin', cmd: 'sjail', desc: 'Teleport yourself into Demorgan / back out (admins only)' },
    { group: 'Admin', cmd: 'sjail set', desc: 'Move the Demorgan spot to where you stand' },
    { group: 'Admin', cmd: 'dmset', args: '<set> [off]', desc: 'Switch a Demorgan bunker entity set on/off (texture debugging)' },
    { group: 'Admin', cmd: 'dmdig', args: '[add|del <n>|reset]', desc: 'List / add (your position) / remove Demorgan digging spots' },
    { group: 'Admin', cmd: 'dim', args: '[0|1|main|demorgan|number]', desc: 'Show / change your dimension (0 = main world, 1 = Demorgan)' },
    { group: 'Admin', cmd: 'setdim', args: '<id> <0|1|main|demorgan|number>', target: true, desc: "Move a player to a dimension (0 = main, 1 = Demorgan)" },
    { group: 'Admin', cmd: 'director', desc: 'Open Director Mode (super admin; also F6)' }
];
const PANEL_HIDDEN_COMMANDS = ['admin']; // /admin opens this panel — pointless inside it

function commandList() {
    const registry = global.commandRegistry || {};
    const listed = new Set();
    const out = [];
    COMMAND_CATALOG.forEach(entry => {
        const base = entry.cmd.split(' ')[0];
        if (!registry[base]) return; // package not loaded
        listed.add(base);
        out.push(entry);
    });
    Object.keys(registry).sort().forEach(name => {
        if (listed.has(name) || PANEL_HIDDEN_COMMANDS.includes(name)) return;
        out.push({ group: 'Other', cmd: name, args: '', desc: '' });
    });
    return out;
}

mp.events.add('admin:panel:commands', player => {
    if (!requireAdmin(player)) return;
    player.call('admin:panel:commands', [JSON.stringify(commandList())]);
});

// ---- Cars tab: edit add-on car handling (writes to the dlc.rpf; applies after restart+reconnect) ----
mp.events.add('admin:panel:cars', player => {
    if (!requireAdmin(player)) return;
    let cars = [];
    try { cars = carHandling.list(); } catch (e) { tell(player, 'Failed to read car handling.'); }
    player.call('admin:panel:cars', [JSON.stringify({ cars, fields: carHandling.FIELDS })]);
});

mp.events.add('admin:panel:carSave', (player, pack, handlingName, valuesJson) => {
    if (!requireAdminMode(player)) return; // file writes require Admin Mode on
    let edits = {};
    try { edits = JSON.parse(String(valuesJson)) || {}; } catch (e) {
        player.call('admin:panel:carResult', ['Invalid data.']);
        return;
    }
    const result = carHandling.save(String(pack), String(handlingName), edits);
    player.call('admin:panel:carResult', [result.message]);
    if (result.ok) console.log(`[admin] ${player.name} edited handling ${pack}/${handlingName}: ${JSON.stringify(edits)}`);
});

// ---- Cars tab: live tuning stages (applies instantly to every client, no restart) ----
// Push the resolved per-car tuning (power/topMult/kick) to all online players so they re-apply it live.
function broadcastSpeedMods() {
    const json = JSON.stringify(carSpeed.resolved());
    mp.players.forEach(p => { try { p.call('speed:mods', [json]); } catch (e) {} });
}
global.carSpeedBroadcast = broadcastSpeedMods;

mp.events.add('admin:panel:speed', player => {
    if (!requireAdmin(player)) return;
    const tuned = carSpeed.all();
    const catalog = (typeof global.carCatalog === 'function') ? global.carCatalog() : [];
    const addon = (typeof global.addonVehicles === 'function') ? global.addonVehicles() : [];
    // Each row carries its current stage ('' = Stock) and custom speed multiplier (1 = stock).
    const rowFor = (model, label) => {
        const t = carSpeed.get(model);
        return { model, label, stage: t.stage, speed: t.speed };
    };
    // Buyable catalog first (best labels), then non-buyable add-ons (police/SWAT), then any tuned
    // model not covered by either — deduped by model so a car appears once with its nicest label.
    const cars = [];
    const seen = new Set();
    const pushRow = (model, label) => {
        const key = String(model).toLowerCase();
        if (seen.has(key)) return;
        seen.add(key);
        cars.push(rowFor(model, label));
    };
    catalog.forEach(car => pushRow(car.model, car.label));
    addon.forEach(car => pushRow(car.model, car.label));
    Object.keys(tuned).forEach(model => pushRow(model, model));
    player.call('admin:panel:speed', [JSON.stringify({
        cars, stages: carSpeed.stageNames(),
        speedMin: carSpeed.SPEED_MIN, speedMax: carSpeed.SPEED_MAX, speedDefault: carSpeed.SPEED_DEFAULT
    })]);
});

mp.events.add('admin:panel:speedSave', (player, model, stage, speed) => {
    if (!requireAdmin(player)) return; // live tuning is reversible (pick Stock) — admin rights are enough
    const result = carSpeed.set(String(model), stage, speed);
    player.call('admin:panel:speedResult', [result.message]);
    if (result.ok) {
        broadcastSpeedMods();
        console.log(`[admin] ${player.name} tuned ${model}: ${result.stage || 'stock'} · speed ×${result.speed}`);
    }
});

// Push the current map to each player once they're in-game.
mp.events.add('playerReady', player => {
    setTimeout(() => {
        if (!mp.players.exists(player)) return;
        try { player.call('speed:mods', [JSON.stringify(carSpeed.resolved())]); } catch (e) {}
    }, 3000);
});

mp.events.add('admin:panel:run', (player, rawText) => {
    if (!requireAdmin(player)) return;
    const text = String(rawText || '').replace(/[\r\n]+/g, ' ').trim().replace(/^\/+/, '').slice(0, 200);
    const name = (text.split(/\s+/)[0] || '').toLowerCase();
    const registry = global.commandRegistry || {};
    if (!name || !registry[name] || PANEL_HIDDEN_COMMANDS.includes(name) || typeof global.runCommand !== 'function') {
        player.call('admin:panel:result', ['Unknown command: /' + name]);
        return;
    }
    global.runCommand(player, '/' + text);
    player.call('admin:panel:result', ['Ran /' + text + ' — see chat for the result.']);
    sendPlayerList(player);
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
        ? 'Flight enabled. WASD moves, Space rises, Ctrl descends, Shift = fast, Alt = slow. N or /fly to stop.'
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
