// ===================== City map props: static scenery built from base-game props =====================
// A "City Hall" (and any future prop builds) imported from a GTA V Map Editor XML (converted to
// cityhall.json: [{ m: modelHash, x,y,z, rx,ry,rz }]). Each prop is recreated SERVER-SIDE via
// mp.objects.new so every player sees the same scene — no DLC/RPF, so there's nothing to crash the
// client (unlike custom interior/MLO packs). Props are frozen scenery in dimension 0.
//
// Perf note: this streams N server objects near the build. Keep an eye on the count; GTA/RAGE:MP handle
// a few thousand streamed props, but only what's near the player is drawn. To disable a build, remove
// its file from FILES below (or delete the json) and restart.
const fs = require('fs');
const path = require('path');

const FILES = ['cityhall.json']; // prop sets to load, in order

const created = []; // keep handles so we can clean up / reload

function loadFile(name) {
    let rows;
    try { rows = JSON.parse(fs.readFileSync(path.join(__dirname, name), 'utf8')); }
    catch (e) { console.log(`[citymap] could not read ${name}: ${e && e.message}`); return 0; }
    if (!Array.isArray(rows)) return 0;
    let ok = 0, bad = 0;
    for (const p of rows) {
        try {
            const obj = mp.objects.new(
                (Number(p.m) >>> 0), // model hash (unsigned 32-bit)
                new mp.Vector3(Number(p.x), Number(p.y), Number(p.z)),
                { rotation: new mp.Vector3(Number(p.rx) || 0, Number(p.ry) || 0, Number(p.rz) || 0), dimension: 0 }
            );
            created.push(obj);
            ok++;
        } catch (e) { bad++; }
    }
    console.log(`[citymap] ${name}: created ${ok} prop(s)${bad ? `, ${bad} failed` : ''}`);
    return ok;
}

function loadAll() {
    FILES.forEach(loadFile);
    console.log(`[citymap] total props placed: ${created.length}`);
}

// Build after packages load so the server is fully up.
mp.events.add('packagesLoaded', () => { setTimeout(loadAll, 1000); });

// Expose a manual reload (admin) in case props are edited at runtime.
global.cityMapReload = () => {
    created.forEach((o) => { try { if (mp.objects.exists(o)) o.destroy(); } catch (e) {} });
    created.length = 0;
    loadAll();
};
