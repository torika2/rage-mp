const fs = require('fs');
const path = require('path');

const DATA_FILE = path.join(__dirname, 'police.json');
const data = global.kv.load('police', DATA_FILE, {});
const jailTimers = new Map();

function save() {
    global.kv.save('police', data, DATA_FILE);
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

// On the roster (or an allowlisted admin) -> may use the LSPD uniform locker. Synced so the client shows the prompt.
const rosterOf = (player) => rankOf(player) !== null;

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
    player.setVariable('police:roster', rosterOf(player));
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
    target.setVariable('police:roster', true);
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
    target.setVariable('police:roster', rosterOf(target));
    if (policeUniform.has(key)) { policeUniform.delete(key); setVestSkin(target, null); if (typeof global.invRestoreLook === 'function') global.invRestoreLook(target); }
    tell(player, `${target.name} has been removed from the police roster.`);
    tell(target, 'You have been removed from the police roster.');
});
// ===================== LSPD armoury (craft station) =====================
// Mission Row. On-duty officers craft department-issue gear for a fee; output goes to the inventory.
// Server-authoritative: duty, rank level, distance, money and inventory space are all checked here.
const ARMOURY = { x: 452.471, y: -980.151, z: 30.689, h: -88.0, range: 2.5 };

// Police-only item defs (the rest — pistols, SMGs, ammo_*, armor — are registered by packages/shops).
global.invItemDefs = global.invItemDefs || {};
Object.assign(global.invItemDefs, {
    nightstick:    { label: 'Nightstick', type: 'weapon', model: 'weapon_nightstick', stackable: false },
    flashlight:    { label: 'Flashlight', type: 'weapon', model: 'weapon_flashlight', stackable: false },
    stungun:       { label: 'Stun Gun', type: 'weapon', model: 'weapon_stungun', ammoType: 'ammo_stungun', stackable: false },
    ammo_stungun:  { label: 'Stun Gun — Cartridges', type: 'ammo', weapon: 'stungun' },
});

// minLevel = police rank level (cadet 0 … chief 6). `qty` items are crafted in boxes of `give`.
const ARMOURY_RECIPES = [
    { key: 'nightstick',         label: 'Nightstick',           detail: 'Melee',                minLevel: 0, price: 100 },
    { key: 'flashlight',         label: 'Flashlight',           detail: 'Utility',              minLevel: 0, price: 50 },
    { key: 'stungun',            label: 'Stun Gun',             detail: 'Non-lethal',           minLevel: 0, price: 400 },
    { key: 'combatpistol',       label: 'Combat Pistol',        detail: 'Sidearm',              minLevel: 0, price: 600 },
    { key: 'armor',              label: 'Body Armour',          detail: 'Full armour',          minLevel: 0, price: 400 },
    { key: 'medkit',             label: 'Medkit',               detail: '+100 HP',              minLevel: 0, price: 150 },
    { key: 'pumpshotgun',        label: 'Pump Shotgun',         detail: 'Officer+',             minLevel: 1, price: 1500 },
    { key: 'smg',                label: 'SMG',                  detail: 'Senior Officer+',      minLevel: 2, price: 2500 },
    { key: 'carbinerifle',       label: 'Carbine Rifle',        detail: 'Sergeant+',            minLevel: 3, price: 5000 },
    { key: 'ammo_stungun',       label: 'Stun Gun Cartridges',  detail: '5 cartridges / box',   minLevel: 0, price: 50,  give: 5,  qty: true },
    { key: 'ammo_combatpistol',  label: 'Combat Pistol Ammo',   detail: '24 rounds / box',      minLevel: 0, price: 40,  give: 24, qty: true },
    { key: 'ammo_pumpshotgun',   label: 'Shotgun Shells',       detail: '16 shells / box',      minLevel: 1, price: 60,  give: 16, qty: true },
    { key: 'ammo_smg',           label: 'SMG Ammo',             detail: '60 rounds / box',      minLevel: 2, price: 90,  give: 60, qty: true },
    { key: 'ammo_carbinerifle',  label: 'Carbine Ammo',         detail: '60 rounds / box',      minLevel: 3, price: 140, give: 60, qty: true },
];

function nearArmoury(player) {
    if (Number(player.dimension) !== 0) return false;
    const p = player.position;
    const dx = p.x - ARMOURY.x, dy = p.y - ARMOURY.y, dz = p.z - ARMOURY.z;
    return dx * dx + dy * dy + dz * dz <= ARMOURY.range * ARMOURY.range;
}

function armouryGuard(player) {
    if (!requireDuty(player)) return false;
    if (!nearArmoury(player)) { tell(player, 'Go to the LSPD armoury.'); return false; }
    return true;
}

mp.events.add('police:armoury:open', (player) => {
    const p = player.position;
    console.log(`[police] armoury open from ${player.name}: rank=${rankOf(player)} duty=${player.getVariable('police:duty')} dim=${player.dimension} pos=${p.x.toFixed(2)},${p.y.toFixed(2)},${p.z.toFixed(2)}`);
    if (!armouryGuard(player)) return;
    player.call('police:armoury:ui');
});

mp.events.add('police:armoury:data', (player) => {
    const empty = { mode: 'weapons', title: 'LSPD Armoury', buyLabel: 'Craft', money: 0, items: [] };
    if (!armouryGuard(player)) return player.call('shop:setData', [JSON.stringify(empty)]);
    const level = data.ranks[rankOf(player)].level;
    const items = ARMOURY_RECIPES.filter(r => r.minLevel <= level).map(r => ({
        key: r.key, label: r.label, detail: r.detail, price: r.price, qty: r.qty || undefined,
    }));
    player.call('shop:setData', [JSON.stringify({ mode: 'weapons', title: 'LSPD Armoury', buyLabel: 'Craft', money: global.getMoney(player), items })]);
});

mp.events.add('police:armoury:craft', (player, key, qty) => {
    if (!armouryGuard(player)) return;
    const recipe = ARMOURY_RECIPES.find(r => r.key === String(key));
    if (!recipe) return;
    if (data.ranks[rankOf(player)].level < recipe.minLevel) return tell(player, 'Your rank cannot craft that.');
    const boxes = recipe.qty ? Math.max(1, Math.min(20, Math.floor(Number(qty) || 1))) : 1;
    const cost = recipe.price * boxes;
    if (typeof global.invHasSpace !== 'function' || !global.invHasSpace(player, recipe.key)) return tell(player, 'Your inventory is full.');
    if (!global.canAfford(player, cost)) return tell(player, `You need $${cost}.`);
    global.setMoney(player, global.getMoney(player) - cost);
    global.invAddItem(player, recipe.key, (recipe.give || 1) * boxes);
    tell(player, `Crafted ${recipe.label}${recipe.give ? ' ×' + recipe.give * boxes : ''} for $${cost}. Added to your inventory (I).`);
});


// ===================== LSPD uniform locker =====================
// Mission Row locker room. Roster members browse a curated uniform catalog and equip pieces for free
// (visual-only, never an inventory item; hides civilian clothes until taken off). Reuses the gang
// wardrobe CEF (ui/gangwardrobe); the client routes its actions to the police:* events below.
// NOTE: GTA clothing has no colour metadata, so drawable/texture ids are best guesses for the vanilla
// LSPD look — verify in-game (each item shows its index in the UI) and tune the catalogs here.
const LOCKER = { x: 456.519, y: -989.062, z: 30.689, h: -7.5, range: 2.5 };
const LOCKER_DIM_BASE = 2200000;            // private per-player dimension while the locker UI is open
const policeUniform = new Map();            // accountKey -> { look: { cat: {d,t} } } (in-memory; reapplied on respawn)

const pieces = (label, list) => list.map(([d, t], i) => ({ d, t, label: label + ' ' + (i + 1) }));
const UNIFORMS = {
    m: {
        top:        pieces('Shirt',   [[55, 0], [55, 1], [53, 0], [200, 0], [190, 0]]),
        undershirt: pieces('Undershirt', [[58, 0], [58, 1], [15, 0]]),
        pants:      pieces('Pants',   [[35, 0], [35, 1], [34, 0]]),
        shoes:      pieces('Boots',   [[25, 0], [24, 0], [51, 0]]),
        neck:       pieces('Badge/Tie', [[38, 0], [10, 0], [29, 0]]),
        hat:        pieces('Cap',     [[46, 0], [46, 1], [45, 0]]),
        glasses:    pieces('Glasses', [[5, 0], [7, 0], [11, 0]]),
        vest:       pieces('LSPD Armour', [[12, 0], [12, 1], [13, 0], [14, 0]]), // body-armour skin (component 9)
    },
    f: {
        top:        pieces('Shirt',   [[48, 0], [48, 1], [46, 0], [210, 0]]),
        undershirt: pieces('Undershirt', [[35, 0], [35, 1], [3, 0]]),
        pants:      pieces('Pants',   [[34, 0], [34, 1], [30, 0]]),
        shoes:      pieces('Boots',   [[52, 0], [51, 0], [25, 0]]),
        neck:       pieces('Badge/Tie', [[11, 0], [12, 0], [28, 0]]),
        hat:        pieces('Cap',     [[45, 0], [45, 1], [44, 0]]),
        glasses:    pieces('Glasses', [[5, 0], [7, 0], [11, 0]]),
        vest:       pieces('LSPD Armour', [[14, 0], [14, 1], [15, 0], [16, 0]]), // body-armour skin (component 9)
    },
};
const uniformCatalog = (player) => UNIFORMS[(typeof global.characterGender === 'function' && global.characterGender(player)) === 'f' ? 'f' : 'm'];

function nearLocker(player) {
    if (Number(player.dimension) !== 0) return false;
    const p = player.position;
    const dx = p.x - LOCKER.x, dy = p.y - LOCKER.y, dz = p.z - LOCKER.z;
    return dx * dx + dy * dy + dz * dz <= LOCKER.range * LOCKER.range;
}

function sendLocker(player) {
    const catalog = uniformCatalog(player);
    const out = {};
    Object.keys(catalog).forEach(cat => { out[cat] = catalog[cat].map((p, index) => ({ index, d: p.d, t: p.t, label: p.label })); });
    const duty = policeUniform.get(accountKey(player));
    player.call('police:wardrobe:open', [JSON.stringify({ gang: 'LSPD', color: '#2f6fb5', catalog: out, current: duty ? duty.look : {} })]);
}

const inLockerSession = (player) => player.inPoliceLocker === true;
const applyUniform = (player, look) => {
    if (typeof global.invApplyClothingLook === 'function') global.invApplyClothingLook(player, look || {});
    setVestSkin(player, look && look.vest);
};
// The 'vest' slot is the visible look of body armour (component 9), owned by packages/inventory: it reads
// player.vestSkin whenever armour is put on, and we repaint right away if armour is already worn.
function setVestSkin(player, piece) {
    player.vestSkin = piece ? { d: piece.d, t: piece.t } : null;
    try { if (Number(player.armour) > 0) player.setClothes(9, piece ? piece.d : 1, piece ? piece.t : 0, 0); } catch (e) {}
}

mp.events.add('police:wardrobe', (player) => {
    if (!rankOf(player)) return tell(player, 'Only LSPD officers can use the locker.');
    if (!nearLocker(player)) return tell(player, 'Go to the LSPD locker.');
    if (player.lockerReturnDim === undefined) player.lockerReturnDim = Number(player.dimension) || 0;
    try { player.dimension = LOCKER_DIM_BASE + player.id; } catch (e) {}
    player.inPoliceLocker = true;
    sendLocker(player);
});

mp.events.add('police:wardrobe:leave', (player) => {
    try { player.dimension = Number(player.lockerReturnDim) || 0; } catch (e) {}
    player.lockerReturnDim = undefined;
    player.inPoliceLocker = false;
});

mp.events.add('police:duty:pick', (player, cat, indexRaw) => {
    if (!inLockerSession(player) || !rankOf(player)) return;
    const list = uniformCatalog(player)[String(cat)];
    const piece = list && list[Math.floor(Number(indexRaw))];
    if (!piece) return;
    const key = accountKey(player);
    const duty = policeUniform.get(key) || { look: {} };
    duty.look = Object.assign({}, duty.look, { [String(cat)]: { d: piece.d, t: piece.t } });
    policeUniform.set(key, duty);
    applyUniform(player, duty.look);
    sendLocker(player);
});

mp.events.add('police:duty:clear', (player, cat) => {
    if (!inLockerSession(player)) return;
    const key = accountKey(player);
    const duty = policeUniform.get(key);
    if (!duty || !duty.look[String(cat)]) return;
    delete duty.look[String(cat)];
    if (Object.keys(duty.look).length === 0) { policeUniform.delete(key); setVestSkin(player, null); if (typeof global.invRestoreLook === 'function') global.invRestoreLook(player); }
    else applyUniform(player, duty.look);
    sendLocker(player);
});

mp.events.add('police:duty:off', (player) => {
    if (!inLockerSession(player)) return;
    if (!policeUniform.delete(accountKey(player))) return;
    setVestSkin(player, null);
    if (typeof global.invRestoreLook === 'function') global.invRestoreLook(player);
    tell(player, 'Uniform removed — civilian clothes restored.');
    sendLocker(player);
});

// Death/respawn resets the ped to the civilian look; re-apply the uniform until it's taken off at the locker.
mp.events.add('playerSpawn', (player) => {
    const key = accountKey(player);
    const duty = policeUniform.get(key);
    if (!duty || !Object.keys(duty.look).length) return;
    setTimeout(() => { if (mp.players.exists(player) && policeUniform.get(key) === duty) applyUniform(player, duty.look); }, 800);
});

mp.events.add('playerQuit', (player) => {
    policeUniform.delete(accountKey(player));
    player.inPoliceLocker = false;
});

// ===================== LSPD garage (police car spawner) =====================
// Mission Row. On-duty officers pick a model from the LSPD Pack 3.1 add-on cars (dlcpacks/11john11_lspd_pack)
// and it spawns at the garage point. One car per officer (spawning again replaces the old one). The cars
// are tagged veh:police — only roster members/admins may sit in them (a non-officer is removed).
const GARAGE = { x: 457.487, y: -1008.553, z: 28.301, h: 169.9, range: 2.5 };      // where the officer stands (E)
const GARAGE_SPAWN = { x: 437.424, y: -1024.271, z: 28.757, h: 90.2 };               // where the chosen car appears
const GARAGE_CARS = [
    { model: 'police42OLD',  label: 'Police Cruiser (Old)',  minLevel: 0 },
    { model: 'policeold',    label: 'Police Classic',        minLevel: 0 },
    { model: 'policeslick',  label: 'Police Slicktop',       minLevel: 0 },
    { model: 'pscout',       label: 'Police Scout',          minLevel: 0 },
    { model: 'pscoutnew',    label: 'Police Scout (New)',    minLevel: 0 },
    { model: 'polalamoold',  label: 'Police Alamo',          minLevel: 1 },
    { model: 'poleveron',    label: 'Police Everon',         minLevel: 1 },
    { model: 'polsadlerk9',  label: 'K9 Sadler',             minLevel: 1 },
    { model: 'lspdb',        label: 'LSPD Unit B',        minLevel: 1 },
    { model: 'polspeedo',    label: 'Police Speedo Van',     minLevel: 2 },
    { model: 'polriot',      label: 'Riot Van',              minLevel: 3 },
    { model: 'swatstalker',  label: 'SWAT Stalker',          minLevel: 3 },
];
const GARAGE_MAX_CARS = 5;     // per officer; only past this is the oldest one removed
const garageCars = new Map(); // accountKey -> [vehicle, …] (oldest first)

function nearGarage(player) {
    if (Number(player.dimension) !== 0) return false;
    const p = player.position;
    const dx = p.x - GARAGE.x, dy = p.y - GARAGE.y, dz = p.z - GARAGE.z;
    return dx * dx + dy * dy + dz * dz <= GARAGE.range * GARAGE.range;
}

function garageGuard(player) {
    if (!requireDuty(player)) return false;
    if (!nearGarage(player)) { tell(player, 'Go to the LSPD garage.'); return false; }
    return true;
}

function liveGarageCars(key) {
    const list = (garageCars.get(key) || []).filter(v => mp.vehicles.exists(v));
    garageCars.set(key, list);
    return list;
}

// Remove all of an officer's garage cars (on quit).
function removeGarageCars(key) {
    (garageCars.get(key) || []).forEach(v => { try { if (mp.vehicles.exists(v)) v.destroy(); } catch (e) {} });
    garageCars.delete(key);
}

mp.events.add('police:garage:open', (player) => {
    if (!garageGuard(player)) return;
    player.call('police:garage:ui');
});

mp.events.add('police:garage:data', (player) => {
    const base = { mode: 'weapons', noTabs: true, icon: '🚓', title: 'LSPD Garage', buyLabel: 'Spawn', money: 0 };
    if (!garageGuard(player)) return player.call('shop:setData', [JSON.stringify(Object.assign(base, { items: [] }))]);
    const level = data.ranks[rankOf(player)].level;
    const items = GARAGE_CARS.filter(c => c.minLevel <= level).map(c => ({ key: c.model, label: c.label, detail: c.model, price: 0 }));
    player.call('shop:setData', [JSON.stringify(Object.assign(base, { money: global.getMoney(player), items }))]);
});

mp.events.add('police:garage:spawn', (player, model) => {
    if (!garageGuard(player)) return;
    const car = GARAGE_CARS.find(c => c.model === String(model));
    if (!car) return;
    if (data.ranks[rankOf(player)].level < car.minLevel) return tell(player, 'Your rank cannot use that vehicle.');
    const key = accountKey(player);
    const mine = liveGarageCars(key);
    while (mine.length >= GARAGE_MAX_CARS) { const oldest = mine.shift(); try { oldest.destroy(); } catch (e) {} }
    try {
        const veh = mp.vehicles.new(mp.joaat(car.model), new mp.Vector3(GARAGE_SPAWN.x, GARAGE_SPAWN.y, GARAGE_SPAWN.z),
            { heading: GARAGE_SPAWN.h, dimension: 0, locked: false, numberPlate: 'LSPD' });
        veh.setVariable('veh:police', true);
        veh.setVariable('veh:fuel', 100);
        mine.push(veh);
        tell(player, `${car.label} is ready in the LSPD car park.`);
    } catch (e) {
        console.log(`[police] garage spawn failed (${car.model}): ${e && e.message}`);
        tell(player, 'Could not spawn that vehicle.');
    }
});

mp.events.add('playerEnterVehicle', (player, vehicle) => {
    if (!vehicle || !mp.vehicles.exists(vehicle) || vehicle.getVariable('veh:police') !== true) return;
    if (rankOf(player)) return;
    try { player.removeFromVehicle(); } catch (e) {}
    tell(player, 'This is an LSPD vehicle.');
});

mp.events.add('playerQuit', (player) => removeGarageCars(accountKey(player)));

// ===================== LSPD parked cars (static spawns) =====================
// Always-present patrol cars parked at fixed points (tagged veh:police → roster/admins only). Respawned if
// wrecked or removed. Add another { model, x, y, z, h } line to park more.
// (Empty: the garage spawn point is the car park bay, so a permanent car there would block it.)
const PARKED_CARS = [
    // { model: 'police42OLD', x: 0, y: 0, z: 0, h: 0 },
];
const parkedVehs = new Map(); // index -> vehicle

function spawnParked(i) {
    const sp = PARKED_CARS[i];
    const old = parkedVehs.get(i);
    try { if (old && mp.vehicles.exists(old)) old.destroy(); } catch (e) {}
    try {
        const veh = mp.vehicles.new(mp.joaat(sp.model), new mp.Vector3(sp.x, sp.y, sp.z),
            { heading: sp.h, dimension: 0, locked: false, numberPlate: 'LSPD' });
        veh.setVariable('veh:police', true);
        veh.setVariable('veh:fuel', 100);
        veh.parkedIndex = i;
        parkedVehs.set(i, veh);
    } catch (e) { console.log(`[police] parked car spawn failed (${sp.model}): ${e && e.message}`); }
}
PARKED_CARS.forEach((_, i) => spawnParked(i));

// Wrecked → respawn after a short delay.
mp.events.add('vehicleDeath', (vehicle) => {
    const i = vehicle && vehicle.parkedIndex;
    if (i === undefined || parkedVehs.get(i) !== vehicle) return;
    setTimeout(() => spawnParked(i), 10000);
});
// Safety net: removed/destroyed by anything else.
setInterval(() => {
    PARKED_CARS.forEach((_, i) => { const v = parkedVehs.get(i); if (!v || !mp.vehicles.exists(v)) spawnParked(i); });
}, 30000);
