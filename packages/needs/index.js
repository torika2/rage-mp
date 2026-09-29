// ===================== Needs: hunger + thirst =====================
// Server-authoritative survival stats (0-100, 100 = full), persisted to needs.json keyed by
// Social Club. They drain over play time; at 0 the player slowly loses health. Food and drinks
// from the inventory (packages/inventory) restore them via global.needsAdd. The client only
// displays the values it receives through the synced 'needs:hunger' / 'needs:thirst' variables.
const fs = require('fs');
const path = require('path');

const DATA_FILE = path.join(__dirname, 'needs.json');
const TICK_MS = 30 * 1000;             // drain / penalty interval
const HUNGER_EMPTY_MINUTES = 60;       // full -> empty
const THIRST_EMPTY_MINUTES = 40;
const STARVE_DAMAGE = 2;               // HP lost per tick for EACH stat at 0
const RESPAWN_MIN = 40;                // after death you come back with at least this much
const WARN_AT = [20, 10];              // chat warnings when crossing these values

const HUNGER_DRAIN = 100 / (HUNGER_EMPTY_MINUTES * 60000 / TICK_MS);
const THIRST_DRAIN = 100 / (THIRST_EMPTY_MINUTES * 60000 / TICK_MS);

let store = {};
try { store = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8')); } catch (e) { store = {}; }
function save() {
    const temporaryFile = DATA_FILE + '.tmp';
    try { fs.writeFileSync(temporaryFile, JSON.stringify(store)); fs.renameSync(temporaryFile, DATA_FILE); } catch (e) {}
}

const clamp = (v) => Math.max(0, Math.min(100, v));
function keyOf(player) { return String(player.socialClub || player.name || ('id' + player.id)); }
function getNeeds(player) {
    const k = keyOf(player);
    if (!store[k]) store[k] = { hunger: 100, thirst: 100 };
    return store[k];
}
function sync(player) {
    const n = getNeeds(player);
    player.setVariable('needs:hunger', Math.round(n.hunger));
    player.setVariable('needs:thirst', Math.round(n.thirst));
}

function warn(player, label, before, after) {
    const crossed = WARN_AT.find(w => before > w && after <= w);
    if (crossed !== undefined) player.outputChatBox(`!{#ff6978}[საჭიროებები] !{#ffffff}${label} — ${crossed}%. მიირთვით რამე (24/7 მაღაზია).`);
    if (before > 0 && after <= 0) player.outputChatBox(`!{#ff6978}[საჭიროებები] !{#ffffff}${label} ამოიწურა — სიცოცხლე მცირდება!`);
}

setInterval(() => {
    mp.players.forEach(player => {
        if (!mp.players.exists(player) || Number(player.health) <= 0) return; // dead: no drain
        const n = getNeeds(player);
        const hunger = clamp(n.hunger - HUNGER_DRAIN);
        const thirst = clamp(n.thirst - THIRST_DRAIN);
        warn(player, 'შიმშილი', n.hunger, hunger);
        warn(player, 'წყურვილი', n.thirst, thirst);
        n.hunger = hunger;
        n.thirst = thirst;
        const damage = (hunger <= 0 ? STARVE_DAMAGE : 0) + (thirst <= 0 ? STARVE_DAMAGE : 0);
        if (damage) player.health = Math.max(0, Number(player.health) - damage);
        sync(player);
    });
    save();
}, TICK_MS);

mp.events.add('playerJoin', (player) => sync(player));
mp.events.add('playerDeath', (player) => {
    const n = getNeeds(player);
    n.hunger = Math.max(n.hunger, RESPAWN_MIN);
    n.thirst = Math.max(n.thirst, RESPAWN_MIN);
    sync(player);
    save();
});

// ---- Shared API: food/drinks (inventory) call this. Returns true if anything was restored. ----
global.needsAdd = (player, delta) => {
    const n = getNeeds(player);
    const before = n.hunger + n.thirst;
    n.hunger = clamp(n.hunger + (Number(delta && delta.hunger) || 0));
    n.thirst = clamp(n.thirst + (Number(delta && delta.thirst) || 0));
    sync(player);
    save();
    return n.hunger + n.thirst > before;
};
global.needsGet = (player) => ({ ...getNeeds(player) });

// Admin/debug helper: /needs shows your current values.
mp.events.addCommand('needs', (player) => {
    const n = getNeeds(player);
    player.outputChatBox(`!{#9aa4ad}[საჭიროებები] !{#ffffff}შიმშილი: ${Math.round(n.hunger)}% · წყურვილი: ${Math.round(n.thirst)}%`);
});
