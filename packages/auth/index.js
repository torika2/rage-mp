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

// A real authenticated user must come back from the API as an object carrying an id. Guards against a
// 2xx with an empty/garbage body ever being treated as a successful login/registration.
function isValidUser(user) {
    return !!(user && typeof user === 'object' && (user.id !== undefined && user.id !== null));
}

// Finalize auth only after the API confirmed a valid user: load the character, then onboard/spawn. If
// loading fails we roll the player back to unauthenticated so a half-authed state can never slip in.
async function completeAuth(player, user) {
    setAuthed(player, user);
    try {
        if (typeof global.runCharacterLoad === 'function') await global.runCharacterLoad(player);
        proceed(player);
    } catch (loadError) {
        player.authed = false;
        player.account = null;
        player.character = null;
        console.log(`[auth] character load failed for ${scNameOf(player)}: ${(loadError && loadError.message) || loadError}`);
        player.call('auth:error', ['მონაცემების ჩატვირთვა ვერ მოხერხდა. სცადეთ ხელახლა.']);
    }
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
    // Show the character's name + database id on the HUD.
    try {
        player.call('hud:identity', [JSON.stringify({
            name,
            residentId: (player.account && player.account.residentNumber) || '',
            charId: character ? character.id : null,
        })]);
    } catch (e) {}
    // Synced character name so other players' clients can draw it as an overhead nametag.
    try { player.setVariable('char:name', name); } catch (e) {}
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
        if (e && e.status === 404) {
            // genuinely unregistered -> show the register form with SC prefilled.
            player.call('auth:show', ['register', JSON.stringify({ socialClub })]);
        } else {
            // API unreachable / 5xx — do NOT present registration (it would fail against a dead backend
            // and must never let someone in without a real API success). Keep them on the login gate
            // with a clear connection error; they stay frozen until the API answers for real.
            player.call('auth:show', ['login', JSON.stringify({ socialClub, email: '' })]);
            player.call('auth:error', ['სერვერთან კავშირი ვერ დამყარდა. სცადეთ ხელახლა მოგვიანებით.']);
            console.log(`[auth] account lookup failed for ${socialClub}: ${(e && (e.serverMessage || e.message)) || e}`);
        }
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
        if (!isValidUser(user)) { player.call('auth:error', ['რეგისტრაცია ვერ შესრულდა. სცადეთ ხელახლა.']); return; }
        await completeAuth(player, user);
    } catch (e) {
        player.call('auth:error', [apiErrorMessage(e)]);
    }
});

// --- login submission ---
// Email + password login (the client sends both). The account is matched by email, so a player can
// sign into any account regardless of which Social Club they are currently connected from.
mp.events.add('auth:submitLogin', async (player, email, password) => {
    if (player.authed) return;
    try {
        const user = await global.api.login(String(email || '').trim(), String(password || ''));
        if (!isValidUser(user)) { player.call('auth:error', ['ავტორიზაცია ვერ შესრულდა.']); return; }
        await completeAuth(player, user);
    } catch (e) {
        player.call('auth:error', [loginErrorMessage(e)]);
    }
});

// Wrong credentials (401/400) get a plain message; anything else (API down, 5xx) is surfaced as a
// connection failure so a backend outage is never mistaken for a bad password — and never lets anyone in.
function loginErrorMessage(error) {
    const status = error && error.status;
    if (status === 401 || status === 400) return 'არასწორი ემაილი ან პაროლი.';
    const reason = (error && error.serverMessage) || (status ? `HTTP ${status}` : 'სერვერთან კავშირი ვერ დამყარდა');
    return `ავტორიზაცია ვერ შესრულდა: ${reason}`;
}

// Turn an API error into a short Georgian message for the client. On a 409 conflict we map the
// API's specific message so the player learns exactly which detail is already taken.
function apiErrorMessage(error) {
    const status = error && error.status;
    const serverMessage = String(error && error.serverMessage || '');
    const text = String(error && error.message || '');
    if (status === 409 || text.includes('409')) {
        if (serverMessage.includes('Email')) return 'ეს ემაილი უკვე რეგისტრირებულია.';
        if (serverMessage.includes('Resident')) return 'ეს პირადი ნომერი უკვე რეგისტრირებულია.';
        if (serverMessage.includes('Social Club')) return 'ამ Social Club-ზე ანგარიში უკვე რეგისტრირებულია.';
        if (serverMessage.includes('Phone')) return 'ეს ტელეფონის ნომერი უკვე რეგისტრირებულია.';
        return 'მომხმარებელი ამ მონაცემებით უკვე რეგისტრირებულია.';
    }
    if (status === 400 || text.includes('400')) return 'შეავსეთ ველები სწორად (ემაილი, პაროლი 8+, პირადობა 11 ციფრი, ტელ. +995).';
    // Unexpected failure (API down, misconfig, 401/500, ...). Surface the real reason so it isn't
    // masked by a bland message — otherwise the player (and we) can't tell what actually broke.
    const reason = serverMessage || (status ? `HTTP ${status}` : 'კავშირი ვერ დამყარდა');
    return `რეგისტრაცია ვერ შესრულდა: ${reason}`;
}

// Second line of defence: block chat commands until authenticated (client freeze is the first).
const previousGuard = typeof global.commandGuard === 'function' ? global.commandGuard : null;
global.commandGuard = function (player, name) {
    if (!player.authed) return '!{#ff6b6b}ჯერ გაიარეთ ავტორიზაცია.';
    return previousGuard ? previousGuard(player, name) : null;
};
