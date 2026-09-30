// ===================== Voice chat: enable 3D voice between players =====================
// Requires "voice-chat": true in conf.json. Players talk with push-to-talk (B) client-side.
// RAGE:MP voice is spatial (volume falls off with distance) once enabled between two players.

// Admin comms-mute (packages/admin) is enforced here too: a muted player gets no voice link to anyone,
// so even a modified client can't be heard. Both directions are cut (RAGE's enableVoiceTo direction
// isn't clearly documented), so while muted they neither talk nor hear voice.
function muted(player) { return typeof global.getCommsMute === 'function' && !!global.getCommsMute(player); }
function link(a, b) {
    const cut = muted(a) || muted(b);
    try {
        if (cut) { a.disableVoiceTo(b); b.disableVoiceTo(a); }
        else { a.enableVoiceTo(b); b.enableVoiceTo(a); }
    } catch (e) {}
}
// Called by the admin panel right after mute / unmute so it takes effect immediately.
global.voiceRelink = (player) => {
    mp.players.forEach(other => { if (other !== player && mp.players.exists(other)) link(player, other); });
};

mp.events.add('playerJoin', (player) => {
    mp.players.forEach(other => { if (other !== player) link(player, other); });
});

// safety net: (re)link everyone periodically in case someone was missed
setInterval(() => {
    const list = mp.players.toArray ? mp.players.toArray() : [];
    for (let i = 0; i < list.length; i++) {
        for (let j = i + 1; j < list.length; j++) link(list[i], list[j]);
    }
    // Keep the client's push-to-talk block in step with the mute (e.g. a timed mute that just expired).
    list.forEach(player => {
        const now = muted(player);
        if (player.voiceMutedFlag !== now) { player.voiceMutedFlag = now; try { player.call('voice:setMuted', [now]); } catch (e) {} }
    });
}, 15000);
