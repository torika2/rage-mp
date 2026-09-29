// ===================== Custom chat: local / team / global routing =====================
// The native chat is hidden client-side. Messages come in via 'chat:submit' (regular text)
// or 'chat:command' (a "/..." line). Output goes to the custom CEF chat via global.chatSend.

const LOCAL_RANGE = 25.0; // metres for local chat

// --- anti-spam: same message > 3x within 1 min => 1-hour chat ban ---
const SPAM_WINDOW = 60 * 1000;      // 1 minute
const SPAM_LIMIT  = 3;              // identical messages allowed within the window
const CHATBAN_MS  = 60 * 60 * 1000; // 1 hour
const recentMsgs = {};              // key -> [{ text, ts }]
const chatBans   = {};              // key -> ban-until timestamp
function keyOf(player) { return player.socialClub || player.name || ('id' + player.id); }

function getTeam(player) {
    if (player.getVariable('police:duty') === true) return 'police';
    return null;
}
function nameOf(player) { return player.name || ('Player_' + player.id); }

function syncTeam(player) {
    const has = getTeam(player) !== null;
    player.setVariable('chat:hasTeam', has);
    player.call('chat:hasTeam', [has]);
}

mp.events.add('playerJoin', (player) => {
    setTimeout(() => { if (mp.players.exists(player)) syncTeam(player); }, 2000);
});

// Regular (non-command) message on a channel.
mp.events.add('chat:submit', (player, text, channel) => {
    text = String(text).trim().slice(0, 200);
    if (!text) return;

    // admin comms-mute (text side) — separate from the spam ban below
    const adminMute = global.getCommsMute && global.getCommsMute(player);
    if (adminMute) {
        const left = adminMute.expiresAt === null
            ? 'სამუდამოდ'
            : `~${Math.ceil((adminMute.expiresAt - Date.now()) / 60000)} წუთი`;
        global.chatSend(player, { ch: 'system', text: `!{#e0a94b}[Admin] !{#ffffff}დადუმებული ხარ (${left}).`, ts: Date.now() });
        return;
    }

    // anti-spam / chat ban
    const key = keyOf(player);
    const now = Date.now();
    if ((chatBans[key] || 0) > now) {
        const mins = Math.ceil((chatBans[key] - now) / 60000);
        global.chatSend(player, { ch: 'system', text: `!{#ff6b6b}ჩატში დაბლოკილი ხარ. დარჩენილია ~${mins} წუთი.`, ts: now });
        return;
    }
    const norm = text.toLowerCase();
    let recent = (recentMsgs[key] || []).filter(e => now - e.ts < SPAM_WINDOW);
    if (recent.filter(e => e.text === norm).length >= SPAM_LIMIT) {
        chatBans[key] = now + CHATBAN_MS;
        recentMsgs[key] = [];
        global.chatSend(player, { ch: 'system', text: '!{#ff6b6b}სპამის გამო ჩატი დაგებლოკა 1 საათით.', ts: now });
        console.log(`[chat] 1h chatban (spam): ${key}`);
        return;
    }
    recent.push({ text: norm, ts: now });
    recentMsgs[key] = recent;

    if (channel !== 'local' && channel !== 'team' && channel !== 'global') channel = 'local';

    // /me and /do style RP actions (allowed on any channel, shown as actions)
    const action = /^\/(me|do)\b/i.test(text);

    if (channel === 'team' && getTeam(player) === null) {
        global.chatSend(player, { ch: 'system', text: '!{#ff6b6b}შენ არ ხარ გუნდში.', ts: Date.now() });
        return;
    }

    const msg = { ch: channel, name: nameOf(player), sid: player.id, text, ts: Date.now(), action };
    const send = p => global.chatSend(p, msg);

    if (channel === 'global') {
        mp.players.forEach(send);
    } else if (channel === 'team') {
        const team = getTeam(player);
        mp.players.forEach(p => { if (getTeam(p) === team) send(p); });
    } else { // local
        const pos = player.position;
        mp.players.forEach(p => {
            if (p.dimension !== player.dimension) return;
            const dx = p.position.x - pos.x, dy = p.position.y - pos.y, dz = p.position.z - pos.z;
            if (dx * dx + dy * dy + dz * dz <= LOCAL_RANGE * LOCAL_RANGE) send(p);
        });
    }
});

// A "/..." line typed in the custom chat.
mp.events.add('chat:command', (player, text) => {
    global.runCommand(player, String(text));
});

// keep the client's TAB channel list in sync with duty status
setInterval(() => {
    mp.players.forEach(p => {
        const has = getTeam(p) !== null;
        if (p.getVariable('chat:hasTeam') !== has) {
            p.setVariable('chat:hasTeam', has);
            p.call('chat:hasTeam', [has]);
        }
    });
}, 5000);
