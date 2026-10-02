// ===================== Death / timeout / revive =====================
// When a player's health hits 0 they enter a "downed" state instead of GTA's instant respawn:
//   • the client blurs the screen over 5s and shows a Georgian "timeout" overlay,
//   • for the first 30s a nearby player holding a medkit can revive them (walk up, press E),
//   • after 30s revive is refused ("უკვე გარდაიცვალა ვერ გააცოცხლებ") and the only way out is
//     the timer: at 2.3 minutes they respawn at the hospital.
// A downed player can't use chat or voice (enforced in packages/chat and packages/voice via the
// synced 'downed' variable). The client (client_packages/index.js) drives the screen effects and
// the revive prompt; the server owns all timing, the revive window and the medkit cost so none of
// it can be faked.

const RESPAWN_MS = 138 * 1000;        // 2.3 minutes downed before auto-respawn at the hospital
const REVIVE_WINDOW_MS = 30 * 1000;   // a medic can only revive within this window after death
const BLUR_MS = 5000;                 // screen-blur ramp on death (kept in sync with the client)
const REVIVE_RANGE = 2.5;             // how close the reviver must stand (metres); re-checked here
const REVIVE_REFUSED = 'უკვე გარდაიცვალა ვერ გააცოცხლებ'; // "already dead, you can't revive"
const NEED_MEDKIT = 'გასაცოცხლებლად საჭიროა სამედიცინო ნაკრები.'; // "you need a medkit to revive"
const NOT_MEDIC = 'მხოლოდ მორიგე მედიკოსს შეუძლია გაცოცხლება.'; // only an on-duty medic can revive

const HOSPITAL_SPAWN = { x: 325.6, y: -579.0, z: 45.4, h: 0 }; // Central LS Medical Center

// player.id -> { diedAt, position, dimension, respawnTimer, windowTimer }
const downed = new Map();

function isDowned(player) { return downed.has(player.id); }

function refreshVoice(player) {
    if (typeof global.voiceRefresh === 'function') global.voiceRefresh(player);
}

function clearDowned(player) {
    const state = downed.get(player.id);
    if (state && state.respawnTimer) clearTimeout(state.respawnTimer);
    if (state && state.windowTimer) clearTimeout(state.windowTimer);
    downed.delete(player.id);
    player.setVariable('downed', false);     // chat/voice allowed again
    player.setVariable('reviveOpen', false); // no revive prompt for others
    refreshVoice(player);
}

function beginDeath(player) {
    // During onboarding (auth → gender → creator → spawn) the server changes player.model, which
    // makes RAGE:MP fire 'playerDeath'. That's not a real death — ignore it so the death blur/screen
    // doesn't show during login.
    if (player.onboarding) return;
    // Prisoners have their own respawn flow (straight back into Demorgan) — don't override it.
    if (typeof global.demorganIsJailed === 'function' && global.demorganIsJailed(player)) return;
    if (isDowned(player)) return;

    const pos = player.position;
    const state = {
        diedAt: Date.now(),
        position: new mp.Vector3(pos.x, pos.y, pos.z),
        dimension: Number(player.dimension),
        respawnTimer: null,
        windowTimer: null
    };
    downed.set(player.id, state);

    player.setVariable('downed', true);     // blocks their chat + voice
    player.setVariable('reviveOpen', true); // others see the "revive" prompt near them
    refreshVoice(player);

    // Client: blur over 5s + Georgian countdown overlay for the whole timer.
    player.call('death:begin', [RESPAWN_MS, BLUR_MS, REVIVE_WINDOW_MS]);

    // Close the revive window after 30s (still downed, just no longer revivable).
    state.windowTimer = setTimeout(() => {
        if (mp.players.exists(player) && isDowned(player)) player.setVariable('reviveOpen', false);
    }, REVIVE_WINDOW_MS);

    state.respawnTimer = setTimeout(() => {
        if (!mp.players.exists(player) || !isDowned(player)) return;
        respawnAtHospital(player);
    }, RESPAWN_MS);
}

function respawnAtHospital(player) {
    clearDowned(player);
    player.spawn(new mp.Vector3(HOSPITAL_SPAWN.x, HOSPITAL_SPAWN.y, HOSPITAL_SPAWN.z));
    player.dimension = 0;
    player.heading = HOSPITAL_SPAWN.h;
    player.health = 60; // woozy after a long wait, not fully healed
    player.call('death:end');
}

// Revive on the spot. Returns null on success, or a refusal message to show the reviver.
// Works for players downed by this system (respecting the 30s window) and, as a fallback, for
// any other unconscious player (e.g. died before the system loaded).
function revive(target) {
    const state = downed.get(target.id);
    if (state && Date.now() - state.diedAt > REVIVE_WINDOW_MS) return REVIVE_REFUSED;

    const pos = state ? state.position : target.position;
    const dimension = state ? state.dimension : Number(target.dimension);
    clearDowned(target);
    target.spawn(new mp.Vector3(pos.x, pos.y, pos.z));
    target.dimension = dimension;
    target.health = 100;
    target.call('death:end');
    return null;
}

mp.events.add('playerDeath', (player) => beginDeath(player));
mp.events.add('playerQuit', (player) => { if (isDowned(player)) clearDowned(player); });

// A nearby player pressed E on a downed player. Needs a medkit; it's consumed on success.
mp.events.add('hospital:revive:attempt', (reviver, targetId) => {
    if (Number(reviver.health) <= 0) return; // a downed player can't revive anyone
    const target = onlineById(Number(targetId));
    if (!target || !isDowned(target)) return;

    // Only an on-duty medic can revive — force institutes (police/army/SWAT) are off the roster.
    if (typeof global.medicCanRevive !== 'function' || !global.medicCanRevive(reviver)) {
        reviver.outputChatBox('!{#ff6b6b}' + NOT_MEDIC);
        return;
    }

    // Server-side proximity re-check (don't trust the client's claim of being close).
    if (Number(reviver.dimension) !== Number(target.dimension)) return;
    const a = reviver.position, b = target.position;
    const dx = a.x - b.x, dy = a.y - b.y, dz = a.z - b.z;
    if (dx * dx + dy * dy + dz * dz > REVIVE_RANGE * REVIVE_RANGE) return;

    if (typeof global.invCountItem !== 'function' || global.invCountItem(reviver, 'medkit') <= 0) {
        reviver.outputChatBox('!{#ff6b6b}' + NEED_MEDKIT);
        return;
    }

    const refused = revive(target); // enforces the 30s window
    if (refused) { reviver.outputChatBox('!{#ff6b6b}' + refused); return; }

    if (typeof global.invRemoveItem === 'function') global.invRemoveItem(reviver, 'medkit', 1);
    if (global.chatLocalAction) global.chatLocalAction(reviver, 'სამედიცინო ნაკრებით აცოცხლებს დაშავებულს');
    reviver.outputChatBox(`!{#8ed17a}გააცოცხლე ${target.name}.`);
    target.outputChatBox('!{#8ed17a}მედიკოსმა გაგაცოცხლა.');
});

function onlineById(id) {
    if (Number.isNaN(id)) return null;
    let found = null;
    mp.players.forEach(p => { if (p.id === id) found = p; });
    return found && mp.players.exists(found) ? found : null;
}

// Shared API for the admin panel (packages/admin) and any future EMS/medic job.
global.hospitalIsDowned = isDowned;
global.hospitalRevive = revive;                 // (target) -> null on success | refusal message
global.hospitalReviveRefused = REVIVE_REFUSED;
