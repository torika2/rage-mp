// ===================== Pillbox Hospital map =====================
// Static map imported from the Menyoo "Pill Box Hospital NR v1.4.4" (No Roads) mod
// by Malik Nomi / HiFi GAMING STAR. The Menyoo XML was converted into a flat list of
// object placements (pillbox_nr.js) — RAGE:MP can't load Menyoo XML directly, so each
// placement is recreated server-side via mp.objects.new so every player sees it.
//
// Peds/vehicles from the mod are intentionally excluded (server ped sync is unreliable and
// the mod's peds rely on Menyoo-only animation setup). Objects live in dimension 0 (global).
//
// To remove individual objects: stand near them in-game and run /hnear — it lists the
// nearest hospital objects with their #index and model name. Then open pillbox_nr.js,
// delete the matching #index line(s), and restart the server.
// To remove the whole hospital at runtime: global.clearHospital().

let placements = [];
try {
    placements = require('./pillbox_nr');
} catch (e) {
    mp.console.logError(`[hospital] failed to load pillbox_nr.js: ${e.message}`);
}

const NAME_BY_HASH = require('./model_names'); // { hash: 'model_name' }

// Each entry: { index (1-based, matches #N in pillbox_nr.js), name, object, x, y, z }
const hospitalObjects = [];

function spawnHospital() {
    let created = 0, failed = 0;
    for (let i = 0; i < placements.length; i++) {
        const p = placements[i];
        try {
            const obj = mp.objects.new(
                p.m >>> 0, // model hash (unsigned 32-bit)
                new mp.Vector3(p.x, p.y, p.z),
                {
                    rotation: new mp.Vector3(p.rx || 0, p.ry || 0, p.rz || 0), // pitch, roll, yaw
                    dimension: 0
                }
            );
            hospitalObjects.push({
                index: p.i || (i + 1), // the #N label from pillbox_nr.js (stable across removals)
                name: NAME_BY_HASH[p.m >>> 0] || `hash_${p.m >>> 0}`,
                object: obj,
                x: p.x, y: p.y, z: p.z
            });
            created++;
        } catch (e) {
            failed++;
        }
    }
    console.log(`[hospital] Pillbox Hospital loaded: ${created} objects spawned${failed ? `, ${failed} failed` : ''}.`);
}

global.clearHospital = () => {
    for (const entry of hospitalObjects) {
        try { if (entry.object && mp.objects.exists(entry.object)) entry.object.destroy(); } catch (e) {}
    }
    hospitalObjects.length = 0;
    console.log('[hospital] all hospital objects destroyed.');
};

// /hnear [radius] — list the nearest hospital objects (default 8m, max 30m) with their
// #index and model name, so you can find which line to delete in pillbox_nr.js.
mp.events.addCommand('hnear', (player, _, radiusArg) => {
    let radius = parseFloat(radiusArg);
    if (Number.isNaN(radius) || radius <= 0) radius = 8;
    if (radius > 30) radius = 30;

    const pos = player.position;
    const near = [];
    for (const entry of hospitalObjects) {
        const dx = entry.x - pos.x, dy = entry.y - pos.y;
        // Horizontal (2D) distance only — the hospital interior is underground (z ≈ -8),
        // so a 3D radius would miss everything when you stand above it at street level.
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist <= radius) near.push({ entry, dist, dz: entry.z - pos.z });
    }
    near.sort((a, b) => a.dist - b.dist);

    // Log to the server console (journalctl -u rageserv) so results are readable while editing files.
    console.log(`[hnear] ${player.name} @ (${pos.x.toFixed(1)}, ${pos.y.toFixed(1)}, ${pos.z.toFixed(1)}) radius=${radius}m(2D) -> ${near.length} object(s), ${hospitalObjects.length} active total`);

    if (!near.length) {
        player.outputChatBox(`!{#ffb42e}ახლომახლო საავადმყოფოს ობიექტი არ არის (${radius}მ რადიუსში).`);
        return;
    }

    const shown = near.slice(0, 15);
    player.outputChatBox(`!{#8ed17a}ახლომახლო ${near.length} ობიექტი (${radius}მ). ${shown.length} უახლოესი:`);
    for (const { entry, dist, dz } of shown) {
        const vert = dz >= 0 ? `+${dz.toFixed(0)}` : dz.toFixed(0); // height relative to you
        player.outputChatBox(`!{#9ecbff}#${entry.index} !{#ffffff}${entry.name} !{#999999}— ${dist.toFixed(1)}მ (h ${vert}მ)`);
        console.log(`[hnear]   #${entry.index}  ${entry.name}  — ${dist.toFixed(1)}m horiz, ${vert}m vert  (x: ${entry.x}, y: ${entry.y}, z: ${entry.z})`);
    }
    if (near.length > shown.length) {
        player.outputChatBox(`!{#999999}...კიდევ ${near.length - shown.length}. შეამცირე რადიუსი: /hnear 3`);
    }
});

// NOTE: Pillbox Hill Medical Center now uses the native GTA interior (v_hospital /
// RC12B_HospitalInterior), which the client already streams in via client_packages/interiors.js
// ("Open All Interiors"). The native interior sits on the same Pillbox site, so the custom
// Menyoo object map is no longer spawned — it would overlap/fight the native interior.
// The data (pillbox_nr.js, model_names.js) and the /hnear + global.clearHospital helpers are
// kept for reference; set USE_CUSTOM_MAP = true to bring the imported map back.
const USE_CUSTOM_MAP = false;
if (USE_CUSTOM_MAP && placements.length) spawnHospital();

// Death / timeout screen / revive system (separate file; see death.js).
require('./death');
