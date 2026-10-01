// ===================== Character: gender selection (male / female) =====================
// On a player's first join we ask them to pick a body — male or female — and save it per account
// (Social Club) in character.json. On later joins the saved freemode model is applied automatically.
// Other appearance systems (barber, clothing/inventory) key off the freemode model, so they dress
// the ped correctly once it's set. Exposes global.characterGender(player) -> 'm' | 'f' | null.
const fs = require('fs');
const path = require('path');

const DATA_FILE = path.join(__dirname, 'character.json');
const MODEL = { m: mp.joaat('mp_m_freemode_01'), f: mp.joaat('mp_f_freemode_01') };

let store = {};
try { store = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8')); } catch (e) { store = {}; }
function save() {
    const temporaryFile = DATA_FILE + '.tmp';
    try { fs.writeFileSync(temporaryFile, JSON.stringify(store)); fs.renameSync(temporaryFile, DATA_FILE); } catch (e) {}
}
function keyOf(player) { return String(player.socialClub || player.name || ('id' + player.id)); }
function genderOf(player) { const g = store[keyOf(player)]; return (g === 'm' || g === 'f') ? g : null; }

global.characterGender = genderOf;

// Set the freemode body model. `respawn` re-runs the spawn pipeline so barber/clothing re-dress it.
function applyBody(player, gender, respawn) {
    try { player.model = MODEL[gender]; } catch (e) {}
    if (respawn) {
        const p = player.position;
        try { player.spawn(new mp.Vector3(p.x, p.y, p.z)); } catch (e) {}
    }
}

mp.events.add('playerReady', (player) => {
    const gender = genderOf(player);
    if (gender) {
        applyBody(player, gender, false); // set early so barber/clothing (delayed) dress the right model
    } else {
        // First time: freeze + show the chooser; they can't play until they pick.
        setTimeout(() => { if (mp.players.exists(player)) player.call('character:choose'); }, 800);
    }
});

mp.events.add('character:setGender', (player, gender) => {
    if (genderOf(player)) return; // already chosen — ignore (gender is permanent per account)
    gender = (gender === 'f') ? 'f' : 'm';
    store[keyOf(player)] = gender;
    save();
    applyBody(player, gender, true); // respawn to apply the model + default look cleanly
    player.call('character:done');
    player.outputChatBox(`!{#8ed17a}[პერსონაჟი] !{#ffffff}არჩეულია: ${gender === 'm' ? 'კაცი' : 'ქალი'}.`);
    console.log(`[character] ${player.name} chose ${gender}`);
});
