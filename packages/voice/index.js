// ===================== Voice chat: enable 3D voice between players =====================
// Requires "voice-chat": true in conf.json. Players talk with push-to-talk (B) client-side.
// RAGE:MP voice is spatial (volume falls off with distance) once enabled between two players.

function link(a, b) {
    try { a.enableVoiceTo(b); b.enableVoiceTo(a); } catch (e) {}
}

mp.events.add('playerJoin', (player) => {
    mp.players.forEach(other => { if (other !== player) link(player, other); });
});

// safety net: (re)link everyone periodically in case someone was missed
setInterval(() => {
    const list = mp.players.toArray ? mp.players.toArray() : [];
    for (let i = 0; i < list.length; i++) {
        for (let j = i + 1; j < list.length; j++) link(list[i], list[j]);
    }
}, 15000);
