// ===================== Auth: account login / registration gate =====================
// On connect, every player must log in or register before they can play. The account data
// (email/password/identity) lives in MySQL behind the NestJS API; we talk to it via global.api
// (see packages/_core). Flow:
//   1) playerReady -> look up the player's Social Club name in the API.
//        found    -> tell the client to show the LOGIN screen.
//        not found-> tell the client to show the REGISTER screen.
//   2) Client submits -> we call the API (login-social / register).
//   3) On success: stash account + active character on the player, set the body from the
//      character's gender, spawn them, and release controls (client 'auth:enter').
//      If the account has no gender yet, force the in-game chooser first (every login until set).
//
// While unauthenticated the player is frozen client-side (no movement/chat), so they cannot
// act before authenticating. We also gate chat commands as a second line of defence.

// Tell the character package to defer its first-join gender chooser to us.
global.AUTH_ACTIVE = true;

// Where freshly authenticated players spawn (Legion Square).
const SPAWN = { x: 195.17, y: -933.77, z: 30.69 };

function scNameOf(player) {
    return String(player.socialClub || player.name || ('id' + player.id));
}

function setAuthed(player, user) {
    player.account = user;
    player.character = (user.characters && user.characters[0]) || null;
    player.authed = true;
}

// Onboarding gate, run after auth. Order: character creator (gender is chosen inside it) -> spawn.
//   no appearance -> launch the character creator (which also sets gender).
//   has appearance -> spawn into the world.
function proceed(player) {
    if (!player.character || !player.character.appearance) {
        if (typeof global.startCharacterCreator === 'function') { global.startCharacterCreator(player); return; }
        // creator package missing — fall through to spawn so the player isn't stuck
    }
    finishSpawn(player);
}

// Faction HQ spawn points (tune in-game if needed).
const FACTION_SPAWNS = {
    police: { x: 441.8, y: -982.0, z: 30.69, h: 90, label: 'პოლიცია' },   // Mission Row PD
    medic:  { x: 298.56, y: -1437.33, z: 29.96, h: 230, label: 'მედიკოსი' }, // Pillbox hospital
    gov:    { x: -546.80, y: -210.80, z: 38.22, h: 30, label: 'მთავრობა' },  // City Hall
};

// Build the rejoin spawn choices: last location (always), home (if owned), factions (if a member).
function spawnOptionsFor(player) {
    const lp = player.character && player.character.lastPosition;
    const last = (lp && typeof lp.x === 'number')
        ? { x: lp.x, y: lp.y, z: lp.z, h: Number(lp.heading) || 0, dim: Number(lp.dim) || 0 }
        : { x: SPAWN.x, y: SPAWN.y, z: SPAWN.z, h: 0, dim: 0 };

    const home = typeof global.houseSpawnPoint === 'function' ? global.houseSpawnPoint(player) : null;

    const factions = [];
    if (global.policeIsOfficer && global.policeIsOfficer(player)) factions.push({ key: 'police', ...FACTION_SPAWNS.police });
    if (global.medicIsMedic && global.medicIsMedic(player)) factions.push({ key: 'medic', ...FACTION_SPAWNS.medic });
    if (global.govRankOf && global.govRankOf(player)) factions.push({ key: 'gov', ...FACTION_SPAWNS.gov });

    return { last, home, factions };
}

// Called once appearance/gender are settled. Offer a spawn choice if the player has a home or a
// faction; otherwise drop them straight at their last location.
function finishSpawn(player) {
    const options = spawnOptionsFor(player);
    player.spawnOptions = options;
    if (options.home || options.factions.length) {
        player.call('auth:spawnSelect', [JSON.stringify({
            home: !!options.home,
            factions: options.factions.map((f) => ({ key: f.key, label: f.label })),
        })]);
        console.log(`[auth] ${scNameOf(player)} choosing spawn (home=${!!options.home}, factions=${options.factions.length})`);
    } else {
        doSpawn(player, options.last);
    }
}
global.authFinishSpawn = finishSpawn;

// Apply body + appearance and place the player at `pos`, then release them into the world.
function doSpawn(player, pos) {
    player.suppressAutoSpawn = true; // one-shot: stop houses auto-send-home overriding this spawn
    const gender = player.account.gender === 'f' ? 'f' : 'm';
    if (typeof global.setCharacterGender === 'function') {
        global.setCharacterGender(player, gender, pos);
    } else {
        try { player.model = mp.joaat(gender === 'f' ? 'mp_f_freemode_01' : 'mp_m_freemode_01'); } catch (e) {}
        try { player.spawn(new mp.Vector3(pos.x, pos.y, pos.z)); } catch (e) {}
    }
    if (typeof global.applyCreatorAppearance === 'function') global.applyCreatorAppearance(player);
    try { player.dimension = Number(pos.dim) || 0; } catch (e) {}
    try { player.alpha = 255; } catch (e) {} // make the character visible again
    try { player.health = 100; } catch (e) {} // clear any model-change "death" state
    try { if (typeof pos.h === 'number') player.heading = pos.h; } catch (e) {}
    player.spawnOptions = null;
    player.inWorld = true; // from here on the position is saved as the character's last location
    player.call('auth:enter'); // closes any open auth/chooser/creator/spawn UI, unfreezes
    const character = player.character;
    const name = character ? `${character.firstName} ${character.lastName}` : scNameOf(player);
    player.outputChatBox(`!{#8ed17a}[ავტორიზაცია] !{#ffffff}კეთილი იყოს თქვენი დაბრუნება, ${name}.`);
    console.log(`[auth] ${scNameOf(player)} authenticated as user #${player.account.id} (${player.account.userType})`);
    // Release the death-suppression a moment after spawn so the model-change playerDeath (queued
    // during the spawn above) is ignored, but real deaths right after are handled normally.
    setTimeout(() => { if (mp.players.exists(player)) player.onboarding = false; }, 2000);
}

// Spawn selector choice from the client: 'home' | 'faction:<key>' | 'last' (or anything else).
mp.events.add('auth:spawnChoose', (player, choice) => {
    if (!player.authed || !player.spawnOptions) return;
    choice = String(choice || 'last');
    const options = player.spawnOptions;
    let pos = options.last;
    if (choice === 'home' && options.home) {
        pos = options.home;
    } else if (choice.startsWith('faction:')) {
        const faction = options.factions.find((f) => f.key === choice.slice(8));
        if (faction) pos = faction;
    }
    doSpawn(player, pos);
});

// Last location -> characters.last_position, so the rejoin selector can offer it. Saved every
// POSITION_SAVE_MS while the player is in the world (so a server restart/crash can't lose it) and
// again on quit (packages/_core flushes on playerQuit). Never saved before the player has actually
// spawned into the world — otherwise quitting at the spawn selector would overwrite it with the
// default spawn — nor from the private dimensions used by the login screen / barber / etc.
const POSITION_SAVE_MS = 20 * 1000;
global.dbSync.register('position', {
    get: (player) => {
        if (!player.inWorld || Number(player.health) <= 0) return undefined;
        const dim = Number(player.dimension) || 0;
        if (dim >= 1000000) return undefined; // private instance (login screen, barber, ...)
        const p = player.position;
        const r = (v) => Math.round(v * 100) / 100;
        return { x: r(p.x), y: r(p.y), z: r(p.z), heading: r(Number(player.heading) || 0), dim };
    },
    push: (characterId, position) => global.api.saveLastPosition(characterId, position),
});
setInterval(() => global.dbSync.touch('position'), POSITION_SAVE_MS);

// (Gender is now chosen inside the character creator — see packages/creator.)

// --- connect: decide login vs register ---
mp.events.add('playerReady', async (player) => {
    player.authed = false;
    player.onboarding = true; // suppresses the death system while model changes fire playerDeath
    // Park the connecting player in a private dimension and make them invisible so no character is
    // shown in the world (to them or others) until they finish authenticating.
    try { player.dimension = 3000000 + player.id; } catch (e) {}
    try { player.alpha = 0; } catch (e) {}
    const socialClub = scNameOf(player);
    try {
        const user = await global.api.get(`/users/social-club/${encodeURIComponent(socialClub)}`);
        // Known account -> ask for the password (show the stored email as a hint).
        player.call('auth:show', ['login', JSON.stringify({ socialClub, email: user.email })]);
    } catch (e) {
        // 404 (or API down) -> treat as unregistered; show the register form with SC prefilled.
        player.call('auth:show', ['register', JSON.stringify({ socialClub })]);
    }
});

// --- register submission ---
mp.events.add('auth:submitRegister', async (player, payloadJson) => {
    if (player.authed) return;
    let form;
    try { form = JSON.parse(payloadJson); } catch (e) { return; }

    const payload = {
        firstName: String(form.firstName || '').trim(),
        lastName: String(form.lastName || '').trim(),
        email: String(form.email || '').trim(),
        password: String(form.password || ''),
        residentNumber: String(form.residentNumber || '').trim(),
        phoneNumber: form.phoneNumber ? String(form.phoneNumber).trim() : undefined,
        // server-authoritative — never trust the client for these
        socialClubName: scNameOf(player),
        ipAddress: player.ip,
    };

    try {
        const user = await global.api.register(payload);
        setAuthed(player, user);
        if (typeof global.runCharacterLoad === 'function') await global.runCharacterLoad(player);
        proceed(player);
    } catch (e) {
        player.call('auth:error', [apiErrorMessage(e)]);
    }
});

// --- login submission ---
mp.events.add('auth:submitLogin', async (player, password) => {
    if (player.authed) return;
    try {
        const user = await global.api.loginBySocialClub(scNameOf(player), String(password || ''));
        setAuthed(player, user);
        if (typeof global.runCharacterLoad === 'function') await global.runCharacterLoad(player);
        proceed(player);
    } catch (e) {
        player.call('auth:error', ['არასწორი პაროლი.']);
    }
});

// Turn an API error into a short Georgian message for the client.
function apiErrorMessage(error) {
    const text = String(error && error.message || '');
    if (text.includes('409')) return 'ეს მონაცემები უკვე რეგისტრირებულია.';
    if (text.includes('400')) return 'შეავსეთ ველები სწორად (ემაილი, პაროლი 8+, პირადობა 11 ციფრი, ტელ. +995).';
    return 'რეგისტრაცია ვერ შესრულდა. სცადეთ თავიდან.';
}

// Second line of defence: block chat commands until authenticated (client freeze is the first).
const previousGuard = typeof global.commandGuard === 'function' ? global.commandGuard : null;
global.commandGuard = function (player, name) {
    if (!player.authed) return '!{#ff6b6b}ჯერ გაიარეთ ავტორიზაცია.';
    return previousGuard ? previousGuard(player, name) : null;
};
