// ===================== _core: shared command registry + chat redirect =====================
// Loads before other packages (name sorts first). Two jobs:
//  1) Wrap mp.events.addCommand so every command is recorded in a registry the custom chat dispatches to.
//  2) Redirect player.outputChatBox(...) into the custom chat UI (native chat is hidden), so all the
//     existing command/system replies still appear.

global.commandRegistry = global.commandRegistry || {};

const _addCommand = mp.events.addCommand.bind(mp.events);
mp.events.addCommand = function (name, handler) {
    if (name && typeof name === 'object') {
        for (const key in name) {
            if (typeof name[key] === 'function') global.commandRegistry[key.toLowerCase()] = name[key];
        }
    } else if (typeof name === 'string' && typeof handler === 'function') {
        global.commandRegistry[name.toLowerCase()] = handler;
    }
    return _addCommand(name, handler);
};

global.runCommand = function (player, raw) {
    const text = String(raw).trim();
    if (text[0] !== '/') return false;
    const parts = text.slice(1).split(/\s+/);
    const name = (parts.shift() || '').toLowerCase();
    const handler = global.commandRegistry[name];
    if (!handler) { player.outputChatBox('!{#ff6b6b}უცნობი ბრძანება: /' + name); return true; }
    // Other packages can block commands for a player (e.g. packages/demorgan while serving a sentence).
    if (typeof global.commandGuard === 'function') {
        const blocked = global.commandGuard(player, name);
        if (blocked) { player.outputChatBox(blocked); return true; }
    }
    try { handler(player, parts.join(' '), ...parts); }
    catch (e) { player.outputChatBox('!{#ff6b6b}ბრძანების შეცდომა.'); }
    return true;
};

// Send a structured line into the custom chat UI.
global.chatSend = function (player, msg) {
    try { player.call('chat:in', [JSON.stringify(msg)]); } catch (e) {}
};

// Redirect outputChatBox -> custom chat (as a "system" line, keeping !{#hex} codes for the UI to parse).
try {
    if (mp.Player && mp.Player.prototype) {
        const proto = mp.Player.prototype;
        const _out = proto.outputChatBox;
        proto.outputChatBox = function (text) {
            global.chatSend(this, { ch: 'system', text: String(text), ts: Date.now() });
            // keep native as a fallback only if the custom chat isn't up yet (harmless; native is hidden client-side)
        };
        proto._outputChatBoxNative = _out;
    }
} catch (e) { console.log('[_core] outputChatBox redirect failed: ' + e); }

mp.events.add('packagesLoaded', () => {
    console.log(`[_core] command registry ready: ${Object.keys(global.commandRegistry).length} commands`);
});
