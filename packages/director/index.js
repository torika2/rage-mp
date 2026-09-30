// ===================== Director Mode (super admin) =====================
// A creator toolset for super admins (the existing protected-admin allowlist): change your ped model,
// control world time & weather, teleport, and noclip. Every power is gated server-side on
// isProtectedAdmin so a normal client can never trigger it. Noclip itself runs client-side.
function isSuper(player) { return typeof global.isProtectedAdmin === 'function' && global.isProtectedAdmin(player); }
function tell(player, message) { player.outputChatBox('!{#c07ad0}[Director] !{#ffffff}' + message); }

const WEATHERS = ['EXTRASUNNY', 'CLEAR', 'CLOUDS', 'OVERCAST', 'RAIN', 'THUNDER', 'CLEARING', 'FOGGY', 'SMOG', 'SNOWLIGHT', 'BLIZZARD', 'XMAS'];
const originalModel = new Map(); // player.id -> model hash before Director changed it

// Tell each client whether it may open Director Mode.
mp.events.add('playerJoin', (player) => player.setVariable('director:super', isSuper(player)));

mp.events.addCommand('director', (player) => {
    if (!isSuper(player)) return tell(player, 'მხოლოდ სუპერ ადმინისთვის.');
    player.call('director:ui:toggle');
});
mp.events.add('director:open', (player) => { if (isSuper(player)) player.call('director:ui:toggle'); });

mp.events.add('director:setTime', (player, hour, minute) => {
    if (!isSuper(player)) return;
    hour = Math.max(0, Math.min(23, parseInt(hour) || 0));
    minute = Math.max(0, Math.min(59, parseInt(minute) || 0));
    try { mp.world.time.set(hour, minute, 0); }
    catch (e) { try { mp.world.time.hour = hour; mp.world.time.minute = minute; mp.world.time.second = 0; } catch (e2) {} }
    tell(player, `დრო: ${hour}:${String(minute).padStart(2, '0')}`);
});

mp.events.add('director:setWeather', (player, weather) => {
    if (!isSuper(player)) return;
    weather = String(weather || '').toUpperCase();
    if (!WEATHERS.includes(weather)) return;
    try { mp.world.weather = weather; } catch (e) {}
    tell(player, `ამინდი: ${weather}`);
});

mp.events.add('director:setModel', (player, name) => {
    if (!isSuper(player)) return;
    name = String(name || '').trim().toLowerCase();
    if (!name) return;
    if (name === 'reset') {
        const original = originalModel.get(player.id) || mp.joaat('mp_m_freemode_01');
        try { player.model = original; } catch (e) {}
        originalModel.delete(player.id);
        tell(player, 'მოდელი დაბრუნდა.');
    } else {
        const hash = mp.joaat(name);
        if (!originalModel.has(player.id)) originalModel.set(player.id, player.model);
        try { player.model = hash; } catch (e) { return tell(player, 'არასწორი მოდელი.'); }
        tell(player, `მოდელი: ${name}`);
    }
    // Re-apply saved clothing once the new model has streamed (freemode peds only).
    if (typeof global.invRestoreLook === 'function') {
        setTimeout(() => { if (mp.players.exists(player)) global.invRestoreLook(player); }, 1200);
    }
    if (typeof global.barberRestoreLook === 'function') {
        setTimeout(() => { if (mp.players.exists(player)) global.barberRestoreLook(player); }, 1400);
    }
});

mp.events.add('director:teleport', (player, x, y, z) => {
    if (!isSuper(player)) return;
    x = parseFloat(x); y = parseFloat(y); z = parseFloat(z);
    if ([x, y, z].some(Number.isNaN)) return;
    if (player.vehicle) { try { player.vehicle.position = new mp.Vector3(x, y, z); return; } catch (e) {} }
    player.position = new mp.Vector3(x, y, z);
});

mp.events.add('playerQuit', (player) => originalModel.delete(player.id));
