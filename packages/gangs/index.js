// ===================== Gangs: player-run gangs, bases, ranks & crafting =====================
// A gang has a leader, a rank ladder with per-rank permissions, a physical base, a shared treasury
// and a shared item stash. Members buy raw materials into the stash with treasury money, then craft
// real weapons/armour/ammo at the base (timed, rank-gated); the output lands in the stash for members
// to withdraw into their personal inventory.
//
// Persistence: the authoritative state lives in this in-memory cache (keyed by gang id) and is written
// through to MySQL via the NestJS API (table `gangs`, global.api.*). Loaded on boot with retry — like
// packages/carkeys. Membership is keyed by DB characterId so it survives name/socialClub changes.

const FOUND_COST = 50000;     // cost to found a gang
const STASH_CAP = 1000;       // total item units a gang stash holds
const BASE_RANGE = 4;         // metres from the base a member must be to use it
const BASE_RANGE_SQ = BASE_RANGE * BASE_RANGE;
const STATION_RANGE = 2.2;    // metres from a station prop (crafting table / storage) to interact
const STATION_RANGE_SQ = STATION_RANGE * STATION_RANGE;
const BLIP_SPRITE = 84;       // skull (GTA blip sprite 84); change here to restyle gang blips
const BLIP_COLOR = 1;         // default blip colour index (1 = red) for gangs with no colour set
const GANG_DIM_BASE = 200000; // each gang's HQ interior copy lives in dimension GANG_DIM_BASE + gang.id
                              // (kept clear of packages/houses' DIM_BASE = 100000)

// Server-seeded "static" turf gangs. Code is the source of truth for each one's name/tag/colour/base:
// they're created on first boot and reconciled on every boot (so moving a base here moves it in-game),
// they can't be disbanded, and their base can't be changed in-game. Members/ranks/treasury/stash still
// persist in the DB like any gang. A static gang starts leaderless — an admin appoints the first leader
// with /gsetleader <playerId> <key>, after which that leader runs it normally (invite, craft, …).
//  - blipColor: GTA blip colour index for the map skull (2 = green).
//  - interior:  the members-only HQ you teleport into from the base door ({x,y,z,h} + optional ipl).
//               Reuses the built-in low-end apartment shell (always loaded, no IPL needed), isolated
//               per gang by dimension, so only this gang's members share it.
// To add another gang, append a line here (key must be unique and stable).
const STATIC_GANGS = [
    {
        key: 'greens', name: 'Ballas', tag: 'BLS', color: '#7d3cb5', blipColor: 7, // blip colour 7 = purple
        base: { x: 85.535, y: -1959.401, z: 21.122, dim: 0, h: -131.3 }, // the Ballas house front door
        interior: { x: 85.535, y: -1959.401, z: 21.122, h: -131.3 },     // default = the door; refine inside with /gsethq
        craftTable: { x: 84.364, y: -1964.055, z: 18.043, h: -132.0 },   // weapon-crafting table (E here -> craft tab)
        storage:    { x: 79.714, y: -1962.737, z: 18.043, h: 143.5 },    // armory/storage (E here -> stash tab)
        wardrobe:   { x: 79.798, y: -1958.621, z: 18.043, h: 46.9 },     // duty-outfit locker (E here -> set/apply duty clothes)
    },
];

// Default rank ladder for a freshly founded gang (level 4 = leader, '*' = every permission).
// `vehicle` = may DRIVE the gang's cars (enforcer+). All members may still RIDE as passengers.
const DEFAULT_RANKS = [
    { key: 'recruit',  label: 'ახალბედა',    level: 0, permissions: [] },
    { key: 'soldier',  label: 'ჯარისკაცი',   level: 1, permissions: ['stash_use'] },
    { key: 'enforcer', label: 'მებრძოლი',     level: 2, permissions: ['stash_use', 'craft', 'vehicle'] },
    { key: 'officer',  label: 'ოფიცერი',      level: 3, permissions: ['stash_use', 'craft', 'invite', 'kick', 'treasury', 'buy_materials', 'vehicle'] },
    { key: 'leader',   label: 'ლიდერი',       level: 4, permissions: ['*'] },
];

// Per-gang vehicles: a model + fixed spawn points. The car is spawned at each point on boot, tagged to
// the gang (synced var veh:gang), and respawned if wrecked/removed. Entry is gang-members-and-admins
// only; DRIVING (seat 0) additionally needs the `vehicle` rank permission (admins bypass).
const GANG_CARS = {
    greens: {
        model: '404lencatv4', // the purple Charger Hellcat add-on (dlcpacks/404lencatv4)
        spawns: [
            { x: 103.395, y: -1956.147, z: 20.750, h: -0.9 },
            { x: 115.498, y: -1949.144, z: 20.667, h: 49.5 },
            { x: 119.159, y: -1940.915, z: 20.685, h: 82.1 },
            { x: 109.748, y: -1924.709, z: 20.752, h: 159.2 }
            // add more { x, y, z, h } points here for extra Ballas car spawns
        ],
    },
};

// Raw materials bought into the stash with treasury money (price = treasury cost per unit).
const MATERIALS = {
    metal_scrap:  { label: 'ლითონის ჯართი',    price: 50 },
    gunpowder:    { label: 'დენთი',             price: 80 },
    weapon_parts: { label: 'იარაღის ნაწილები',  price: 200 },
    kevlar:       { label: 'კევლარი',           price: 150 },
};
// Register materials as inventory item defs so members can withdraw them to their personal inventory.
Object.keys(MATERIALS).forEach((id) => {
    global.invItemDefs = global.invItemDefs || {};
    if (!global.invItemDefs[id]) global.invItemDefs[id] = { label: MATERIALS[id].label, type: 'material', stackable: true };
});

// Crafting recipes. `out` ids reuse the real weapon/armour/ammo item ids registered by packages/shops,
// so a crafted gun behaves exactly like a bought one. `minLevel` gates by rank level. `time` in seconds.
const RECIPES = {
    vest:         { label: 'ბრონეჟილეტი',          out: { armor: 1 },        needs: { kevlar: 3, metal_scrap: 2 },                    time: 30, minLevel: 1 },
    ammo_pistol:  { label: 'პისტოლეტის ტყვია ×24',  out: { ammo_pistol: 24 }, needs: { gunpowder: 2, metal_scrap: 1 },                 time: 15, minLevel: 1 },
    pistol:       { label: 'პისტოლეტი',             out: { pistol: 1 },       needs: { weapon_parts: 3, metal_scrap: 4 },              time: 45, minLevel: 1 },
    smg:          { label: 'SMG',                    out: { smg: 1 },          needs: { weapon_parts: 6, metal_scrap: 8, gunpowder: 2 }, time: 60, minLevel: 2 },
    assaultrifle: { label: 'ავტომატური შაშხანა',     out: { assaultrifle: 1 }, needs: { weapon_parts: 10, metal_scrap: 12, gunpowder: 4 }, time: 90, minLevel: 3 },
};

// Per-gang DUTY WARDROBE — a curated catalog of pink/purple pieces a member browses (store-style) at the
// base locker and equips FREE to build an on-duty uniform. Keyed by static-gang key; each category key
// (packages/clothing: top, undershirt, pants, shoes, mask, hat, glasses) holds a list of { d, t, label }
// pieces. Equipping is visual-only (never an inventory item → can't be dropped/sold/traded) and hides the
// member's civilian clothes while on duty.
// NOTE: GTA clothing has NO colour metadata, so these pink/purple d/t indices are BEST GUESSES — the only
// way to confirm a colour is to look at it on the ped in-game. Each item shows its #d/t in the UI so bad
// ones can be reported and culled. This block is the ONE place to tune the Ballas wardrobe. The same list
// is offered to both genders for now; split into { m:{...}, f:{...} } here if a piece differs by gender.
const DUTY_WARDROBE = {
    greens: { // staticKey 'greens' = the Ballas gang (purple/pink)
        top: [
            { d: 31,  t: 0, label: 'ჰუდი' },
            { d: 15,  t: 2, label: 'მაისური' },
            { d: 7,   t: 3, label: 'ქურთუკი' },
            { d: 4,   t: 5, label: 'პიჯაკი' },
            { d: 11,  t: 1, label: 'სვიტრი' },
            { d: 42,  t: 2, label: 'ჟილეტი' },
        ],
        undershirt: [
            { d: 0, t: 0, label: 'მაისური' },
            { d: 2, t: 1, label: 'მაისური 2' },
        ],
        pants: [
            { d: 24, t: 0, label: 'შარვალი' },
            { d: 10, t: 3, label: 'შარვალი 2' },
            { d: 4,  t: 2, label: 'ჯინსი' },
        ],
        shoes: [
            { d: 10, t: 0, label: 'სნიკერსი' },
            { d: 1,  t: 0, label: 'ფეხსაცმელი' },
            { d: 17, t: 4, label: 'ბოტასი' },
        ],
        mask: [
            { d: 0,  t: 0, label: 'ნიღაბი' },
        ],
        hat: [
            { d: 2,  t: 2, label: 'ქუდი' },
            { d: 6,  t: 3, label: 'კეპი' },
        ],
        glasses: [
            { d: 5,  t: 0, label: 'სათვალე' },
        ],
    },
};
function dutyCatalogFor(gang) { return (gang && gang.staticKey && DUTY_WARDROBE[gang.staticKey]) || null; }
function dutyHasWardrobe(gang) { const c = dutyCatalogFor(gang); return !!c && Object.keys(c).length > 0; }
// The piece at catalog[cat][index], or null.
function dutyPiece(gang, cat, index) {
    const catalog = dutyCatalogFor(gang);
    const list = catalog && catalog[cat];
    return (list && list[index]) || null;
}

// ---- State ----
const gangs = new Map();          // gangId -> gang object (authoritative)
const charToGang = new Map();     // characterId -> gangId
const pendingInvites = new Map(); // characterId -> { gangId, byName, ts }
const craftTimers = new Map();    // gangId -> timeout
const persistTimers = new Map();  // gangId -> timeout
const onDuty = new Map();         // characterId -> duty-outfit preset key currently worn (in-memory; off on respawn)

// ---- Small helpers ----
function tell(player, message) { player.outputChatBox('!{#c0392b}[Gang] !{#ffffff}' + message); }
function charId(player) { return player && player.character ? Number(player.character.id) : null; }
function gangById(id) { return gangs.get(Number(id)) || null; }
function gangOf(player) {
    const cid = charId(player);
    if (cid == null) return null;
    const gid = charToGang.get(cid);
    return gid ? gangById(gid) : null;
}
function memberOf(gang, cid) { return gang.members.find((m) => Number(m.characterId) === Number(cid)) || null; }
function rankByKey(gang, key) { return gang.ranks.find((r) => r.key === key) || null; }
function rankOfMember(gang, member) { return member ? (rankByKey(gang, member.rank) || DEFAULT_RANKS[0]) : null; }
function hasPerm(gang, member, cap) {
    const rank = rankOfMember(gang, member);
    return !!rank && (rank.permissions.includes('*') || rank.permissions.includes(cap));
}
function isLeader(gang, member) { const r = rankOfMember(gang, member); return !!r && r.level >= 4; }

function onlinePlayerById(value) {
    const text = String(value == null ? '' : value);
    if (!/^\d+$/.test(text)) return null;
    let found = null;
    mp.players.forEach((p) => { if (Number(p.id) === Number(text)) found = p; });
    return found;
}
function onlineByChar(cid) {
    let found = null;
    mp.players.forEach((p) => { if (charId(p) === Number(cid)) found = p; });
    return found;
}
function nearBase(player, gang) {
    if (!gang || !gang.base) return false;
    if (Number(player.dimension) !== Number(gang.base.dim || 0)) return false;
    const p = player.position, b = gang.base;
    const dx = p.x - b.x, dy = p.y - b.y, dz = p.z - b.z;
    return dx * dx + dy * dy + dz * dz <= BASE_RANGE_SQ;
}
// A base station (the crafting table or the storage); falls back to the base if that gang has no point set.
function craftTableOf(gang) { return (gang && gang.craftTable) || (gang && gang.base) || null; }
function storageOf(gang) { return (gang && gang.storage) || (gang && gang.base) || null; }
function nearPoint(player, gang, point) {
    if (!gang || !gang.base || !point) return false;
    if (Number(player.dimension) !== Number(gang.base.dim || 0)) return false;
    const p = player.position;
    const dx = p.x - point.x, dy = p.y - point.y, dz = p.z - point.z;
    return dx * dx + dy * dy + dz * dz <= STATION_RANGE_SQ;
}
function nearStation(player, gang) {
    return nearPoint(player, gang, craftTableOf(gang)) || nearPoint(player, gang, storageOf(gang));
}
function nearWardrobe(player, gang) { return nearPoint(player, gang, gang && gang.wardrobe); }

// ---- Persistence ----
function serialize(gang) {
    return {
        name: gang.name, tag: gang.tag, color: gang.color, staticKey: gang.staticKey || null,
        leaderCharacterId: gang.leaderCharacterId,
        members: gang.members, ranks: gang.ranks, base: gang.base, interior: gang.interior || null,
        treasury: Math.max(0, Math.floor(gang.treasury || 0)),
        stash: gang.stash, crafting: gang.crafting || null,
    };
}
function persist(gang) {
    if (!global.api || persistTimers.has(gang.id)) return;
    persistTimers.set(gang.id, setTimeout(() => {
        persistTimers.delete(gang.id);
        global.api.updateGang(gang.id, serialize(gang)).catch((e) => console.log('[gangs] save failed: ' + (e && e.message)));
    }, 1200));
}

// ---- Synced vars (expose membership to chat & other packages) ----
function setGangVars(player) {
    const gang = gangOf(player);
    if (gang) {
        const member = memberOf(gang, charId(player));
        player.setVariable('gang:id', gang.id);
        player.setVariable('gang:tag', gang.tag);
        player.setVariable('gang:name', gang.name);
        player.setVariable('gang:rank', member ? member.rank : null);
    } else {
        player.setVariable('gang:id', null);
        player.setVariable('gang:tag', null);
        player.setVariable('gang:name', null);
        player.setVariable('gang:rank', null);
    }
}

// ---- Map blips (client-local, visibility-restricted) ----
// No server-side global blip and no ground marker: the base is marked only on the map, and only to the
// people allowed to see it — the gang's own members and admins. Each client creates its own local blips
// from a list the server pushes, so other players never see a gang's HQ on the map.
function isGangAdmin(player) {
    return typeof global.isProtectedAdmin === 'function' && global.isProtectedAdmin(player);
}
// Interaction stations at the base, each a ground marker + "Press E" the client draws. craft/stash fall
// back to the base when a gang hasn't set a point; the wardrobe only appears when explicitly configured.
function stationsOf(gang) {
    if (!gang.base) return [];
    const point = (p) => ({ x: p.x, y: p.y, z: p.z });
    const stations = [
        { kind: 'craft', ...point(craftTableOf(gang)) },
        { kind: 'stash', ...point(storageOf(gang)) },
    ];
    // The duty-uniform locker appears for gangs that have both a configured point and a curated catalog.
    if (gang.wardrobe && dutyHasWardrobe(gang)) stations.push({ kind: 'wardrobe', ...point(gang.wardrobe) });
    return stations;
}
function blipEntry(gang) {
    return {
        id: gang.id, x: gang.base.x, y: gang.base.y, z: gang.base.z, dim: Number(gang.base.dim || 0),
        sprite: gang.blipSprite || BLIP_SPRITE, color: gang.blipColor || BLIP_COLOR,
        hex: gang.color || '#c0392b', // for the client-side station markers
        name: '[' + gang.tag + '] ' + gang.name,
        stations: stationsOf(gang),
    };
}
// Which gang bases THIS player may see on the map: admins see all, members see their own.
function blipListFor(player) {
    if (isGangAdmin(player)) {
        const out = [];
        gangs.forEach((g) => { if (g.base) out.push(blipEntry(g)); });
        return out;
    }
    const gang = gangOf(player);
    return gang && gang.base ? [blipEntry(gang)] : [];
}
function pushBlips(player) {
    try { player.call('gangs:blips', [JSON.stringify(blipListFor(player))]); } catch (e) {}
}
function pushBlipsAll() { mp.players.forEach((p) => { if (p.character) pushBlips(p); }); }

// Tell a player's client where their gang base is (for the "Press E" prompt), or clear it.
function pushBaseZone(player) {
    const gang = gangOf(player);
    const zone = gang && gang.base ? { x: gang.base.x, y: gang.base.y, z: gang.base.z, dim: Number(gang.base.dim || 0) } : null;
    try { player.call('gangs:zone', [JSON.stringify(zone)]); } catch (e) {}
}
function pushBaseZoneToGang(gang) {
    gang.members.forEach((m) => { const p = onlineByChar(m.characterId); if (p) pushBaseZone(p); });
}

// ---- HQ interior (members-only, one shared copy per gang, isolated by dimension) ----
function gangInteriorDim(gang) { return GANG_DIM_BASE + gang.id; }
function inInterior(player, gang) { return !!gang.interior && Number(player.dimension) === gangInteriorDim(gang); }
function atHQ(player, gang) { return nearBase(player, gang) || inInterior(player, gang); } // base door OR inside

// The gang a player is acting on. Members → their own gang. Admins who aren't members → the gang whose
// base/station/HQ they're standing at (so an admin can use any gang's base exactly like a member).
function contextGang(player) {
    const own = gangOf(player);
    if (own) return own;
    if (!isGangAdmin(player)) return null;
    let found = null;
    gangs.forEach((g) => {
        if (found || !g.base) return;
        if (nearBase(player, g) || nearStation(player, g) || nearWardrobe(player, g) || inInterior(player, g)) found = g;
    });
    return found;
}
// True when this player is operating a gang they don't belong to, by virtue of being an admin.
function actingAdmin(player, gang) { return !memberOf(gang, charId(player)) && isGangAdmin(player); }

function enterInterior(player, gang) {
    const it = gang.interior || gang.base; // fall back to the base/door if no inside point captured yet
    if (!it) return false;
    player.dimension = gangInteriorDim(gang);
    player.position = new mp.Vector3(it.x, it.y, it.z);
    if (typeof it.h === 'number') { try { player.heading = it.h; } catch (e) {} }
    try { player.call('gangs:entered', [JSON.stringify({ ipl: it.ipl || null })]); } catch (e) {}
    tell(player, 'შეხვედი ბანდის სახლში (პირადი ზონა — მხოლოდ წევრები/ადმინები). მენიუსთვის დააჭირე E, გასასვლელად /gexit.');
    return true;
}
function exitInterior(player, gang) {
    player.dimension = Number((gang && gang.base && gang.base.dim) || 0);
    if (gang && gang.base) {
        player.position = new mp.Vector3(gang.base.x, gang.base.y, gang.base.z);
        if (typeof gang.base.h === 'number') { try { player.heading = gang.base.h; } catch (e) {} }
    }
    try { player.call('gangs:exited'); } catch (e) {}
    tell(player, 'გამოხვედი ბანდის სახლიდან.');
}
// If a player is inside this gang's HQ, push them back out (used on kick/disband so no one gets stranded).
function ejectIfInside(player, gang) { if (inInterior(player, gang)) exitInterior(player, gang); }

// ===================== Gang vehicles =====================
// Spawn a gang's car at each configured point, tagged with the gang's staticKey (synced var veh:gang).
// Entry is gang-members + admins only; driving (seat 0) also needs the `vehicle` rank permission.
const gangCars = new Map(); // gangId -> [vehicle, ...]
function spawnGangCars(gang) {
    const cfg = gang.staticKey && GANG_CARS[gang.staticKey];
    if (!cfg || !cfg.spawns || !cfg.spawns.length) return;
    // Clear any existing (reload-safe).
    (gangCars.get(gang.id) || []).forEach((v) => { try { if (mp.vehicles.exists(v)) v.destroy(); } catch (e) {} });
    const list = [];
    cfg.spawns.forEach((sp) => {
        try {
            const veh = mp.vehicles.new(mp.joaat(cfg.model), new mp.Vector3(sp.x, sp.y, sp.z),
                { heading: Number(sp.h) || 0, dimension: 0, locked: false });
            veh.setVariable('veh:gang', gang.staticKey);
            veh.setVariable('veh:gangName', gang.name);
            veh.gangSpawn = sp;      // remember the spot for respawn
            veh.gangId = gang.id;
            list.push(veh);
        } catch (e) { console.log(`[gangs] car spawn failed (${cfg.model}): ${e && e.message}`); }
    });
    gangCars.set(gang.id, list);
    console.log(`[gangs] ${gang.tag}: spawned ${list.length} gang car(s) (${cfg.model})`);
}
// Access control: who may be in a gang car, and who may drive it.
function gangCarAccess(player, vehicle) {
    const key = vehicle.getVariable && vehicle.getVariable('veh:gang');
    if (!key) return null; // not a gang car
    const admin = isGangAdmin(player);
    const gang = gangOf(player);
    const member = gang && gang.staticKey === key ? memberOf(gang, charId(player)) : null;
    return { key, admin, gang, member, isMember: !!member };
}
mp.events.add('playerEnterVehicle', (player, vehicle, seat) => {
    if (!vehicle || !mp.vehicles.exists(vehicle)) return;
    const a = gangCarAccess(player, vehicle);
    if (!a) return; // normal (non-gang) car — handled elsewhere
    // Only gang members + admins may be in the car at all.
    if (!a.admin && !a.isMember) {
        try { player.removeFromVehicle(); } catch (e) {}
        tell(player, 'ეს ბანდის მანქანაა — მხოლოდ წევრებისთვის.');
        return;
    }
    // Driving (seat 0) also needs the `vehicle` rank permission (admins bypass).
    if (seat === 0 && !a.admin && !hasPerm(a.gang, a.member, 'vehicle')) {
        try { player.removeFromVehicle(); } catch (e) {}
        tell(player, 'შენს რანგს არ აქვს ბანდის მანქანის ტარების ნებართვა (შეგიძლია იმგზავრო მგზავრად).');
    }
});
// Respawn a wrecked/removed gang car back at its spot so the spawns are permanent.
function respawnGangCar(vehicle) {
    if (!vehicle || vehicle.gangId == null || !vehicle.gangSpawn) return;
    const gang = gangById(vehicle.gangId); const sp = vehicle.gangSpawn;
    const list = gangCars.get(vehicle.gangId);
    if (list) { const i = list.indexOf(vehicle); if (i >= 0) list.splice(i, 1); }
    try { if (mp.vehicles.exists(vehicle)) vehicle.destroy(); } catch (e) {}
    if (!gang) return;
    setTimeout(() => {
        const cfg = GANG_CARS[gang.staticKey]; if (!cfg) return;
        try {
            const veh = mp.vehicles.new(mp.joaat(cfg.model), new mp.Vector3(sp.x, sp.y, sp.z),
                { heading: Number(sp.h) || 0, dimension: 0 });
            veh.setVariable('veh:gang', gang.staticKey); veh.setVariable('veh:gangName', gang.name);
            veh.gangSpawn = sp; veh.gangId = gang.id;
            let arr = gangCars.get(gang.id); if (!arr) { arr = []; gangCars.set(gang.id, arr); }
            arr.push(veh);
        } catch (e) {}
    }, 5000);
}
mp.events.add('vehicleDeath', (vehicle) => respawnGangCar(vehicle));

// ===================== Crafting =====================
function craftRemainingMs(gang) {
    if (!gang.crafting) return 0;
    return Math.max(0, Number(gang.crafting.finishAt) - Date.now());
}
function stashUnits(gang) { return Object.values(gang.stash).reduce((sum, qty) => sum + Math.max(0, Number(qty) || 0), 0); }
function stashAdd(gang, id, qty) { gang.stash[id] = Math.max(0, (Number(gang.stash[id]) || 0) + qty); if (gang.stash[id] === 0) delete gang.stash[id]; }
function stashHas(gang, needs) { return Object.keys(needs).every((id) => (Number(gang.stash[id]) || 0) >= needs[id]); }

function finishCraft(gangId) {
    const gang = gangById(gangId);
    if (!gang || !gang.crafting) return;
    const recipe = RECIPES[gang.crafting.recipe];
    craftTimers.delete(gangId);
    gang.crafting = null;
    if (recipe) {
        Object.keys(recipe.out).forEach((id) => stashAdd(gang, id, recipe.out[id]));
        gang.members.forEach((m) => {
            const p = onlineByChar(m.characterId);
            if (p) { tell(p, `დასრულდა წარმოება: !{#8ed17a}${recipe.label}!{#ffffff} — ინახება საცავში.`); refreshPanel(p); }
        });
    }
    persist(gang);
}
function scheduleCraft(gang) {
    if (!gang.crafting) return;
    const remaining = craftRemainingMs(gang);
    if (remaining <= 0) { finishCraft(gang.id); return; }
    if (craftTimers.has(gang.id)) clearTimeout(craftTimers.get(gang.id));
    craftTimers.set(gang.id, setTimeout(() => finishCraft(gang.id), remaining));
}

// ===================== Boot load =====================
function adopt(row) {
    const gang = {
        id: Number(row.id), name: row.name, tag: row.tag, color: row.color || '#c0392b',
        staticKey: row.staticKey || null,
        leaderCharacterId: row.leaderCharacterId != null ? Number(row.leaderCharacterId) : null,
        members: Array.isArray(row.members) ? row.members : [],
        ranks: Array.isArray(row.ranks) && row.ranks.length ? row.ranks : DEFAULT_RANKS.map((r) => ({ ...r })),
        base: row.base || null,
        treasury: Math.max(0, Math.floor(Number(row.treasury) || 0)),
        stash: row.stash && typeof row.stash === 'object' ? row.stash : {},
        crafting: row.crafting || null,
        // interior persists (captured in-game via /gsethq); null falls back to the config default below.
        interior: row.interior || null,
        // blipColor/blipSprite are config-only (not stored); set for static gangs by ensureStaticGangs().
        blipColor: null, blipSprite: null,
    };
    gangs.set(gang.id, gang);
    gang.members.forEach((m) => charToGang.set(Number(m.characterId), gang.id));
    if (gang.crafting) scheduleCraft(gang);
    return gang;
}
function findStaticGang(key) {
    for (const g of gangs.values()) if (g.staticKey === key) return g;
    return null;
}
// Create missing static gangs and reconcile existing ones' name/tag/colour/base from the config.
function ensureStaticGangs() {
    if (!global.api || typeof global.api.createGang !== 'function') return;
    STATIC_GANGS.forEach((def) => {
        const b = { x: def.base.x, y: def.base.y, z: def.base.z, dim: Number(def.base.dim || 0) };
        if (typeof def.base.h === 'number') b.h = def.base.h;
        const applyConfig = (gang) => {
            // A point captured in-game (/gsethq, stored in the DB) wins; otherwise use the config default.
            if (!gang.interior) gang.interior = def.interior || null;
            gang.blipColor = def.blipColor || null;
            gang.blipSprite = def.blipSprite || null;
            // Station points (config-only, not persisted): crafting table, armory storage, duty wardrobe.
            gang.craftTable = def.craftTable || null;
            gang.storage = def.storage || null;
            gang.wardrobe = def.wardrobe || null;
        };
        const existing = findStaticGang(def.key);
        if (existing) {
            applyConfig(existing);
            let changed = false;
            ['name', 'tag', 'color'].forEach((f) => { if (existing[f] !== def[f]) { existing[f] = def[f]; changed = true; } });
            const cur = existing.base;
            if (!cur || cur.x !== b.x || cur.y !== b.y || cur.z !== b.z || Number(cur.dim || 0) !== b.dim || Number(cur.h || 0) !== Number(b.h || 0)) {
                existing.base = b; pushBaseZoneToGang(existing); changed = true;
            }
            // Rank DEFINITIONS are code-owned (no in-game editor) — reconcile them from DEFAULT_RANKS so
            // permission changes (e.g. the new `vehicle` perm) reach already-seeded static gangs. Member
            // assignments (member.rank, keyed by the stable rank keys) are untouched.
            const freshRanks = DEFAULT_RANKS.map((r) => ({ ...r }));
            if (JSON.stringify(existing.ranks) !== JSON.stringify(freshRanks)) { existing.ranks = freshRanks; changed = true; }
            if (changed) persist(existing);
            pushBlipsAll();
            spawnGangCars(existing);
            return;
        }
        global.api.createGang({
            name: def.name, tag: def.tag, color: def.color, staticKey: def.key,
            leaderCharacterId: null, members: [], ranks: DEFAULT_RANKS.map((r) => ({ ...r })),
            base: b, treasury: 0, stash: {},
        }).then((row) => {
            const gang = adopt(row);
            applyConfig(gang);
            console.log(`[gangs] seeded static gang "${gang.name}" [${gang.tag}]`);
            mp.players.forEach((p) => { if (p.character) { setGangVars(p); pushBaseZone(p); pushBlips(p); } });
            spawnGangCars(gang);
        }).catch((e) => console.log(`[gangs] seed failed for ${def.key}: ${e && e.message}`));
    });
}
function loadAll(attempt = 0) {
    if (!global.api || typeof global.api.loadGangs !== 'function') {
        if (attempt < 10) setTimeout(() => loadAll(attempt + 1), 3000);
        return;
    }
    global.api.loadGangs().then((rows) => {
        gangs.clear(); charToGang.clear();
        (Array.isArray(rows) ? rows : []).forEach(adopt);
        console.log(`[gangs] loaded ${gangs.size} gang(s)`);
        ensureStaticGangs();
        mp.players.forEach((p) => { if (p.character) { setGangVars(p); pushBaseZone(p); pushBlips(p); } });
    }).catch(() => { if (attempt < 10) setTimeout(() => loadAll(attempt + 1), 3000); });
}
setTimeout(() => loadAll(), 4000);

// Hydrate identity when a character logs in.
global.onCharacterLoad((player) => { setGangVars(player); pushBaseZone(player); pushBlips(player); });

// Rescue anyone who logged out inside an HQ interior: after auth has spawned them, if they're still in
// a gang dimension, put them back at their gang's base (or the normal world) so they're never stranded.
mp.events.add('playerReady', (player) => {
    setTimeout(() => {
        if (!mp.players.exists(player) || Number(player.dimension) < GANG_DIM_BASE) return;
        const gang = gangOf(player);
        exitInterior(player, gang); // falls back to dimension 0 when the gang/base is gone
    }, 2500);
});

// ---- Shared API for other packages ----
global.gangOf = (player) => gangOf(player);
global.gangTagOf = (player) => { const g = gangOf(player); return g ? g.tag : null; };

// ===================== CEF panel =====================
function buildPanel(player) {
    const gang = contextGang(player);
    if (!gang) return null;
    const member = memberOf(gang, charId(player));
    const admin = !member && isGangAdmin(player); // admin operating a gang they don't belong to
    const myRank = rankOfMember(gang, member);
    const perms = myRank ? myRank.permissions : [];
    const can = (cap) => admin || perms.includes('*') || perms.includes(cap); // admins get everything

    const members = gang.members.map((m) => ({
        characterId: m.characterId, name: m.name, rank: m.rank,
        rankLabel: (rankByKey(gang, m.rank) || {}).label || m.rank,
        online: !!onlineByChar(m.characterId),
    })).sort((a, b) => (rankByKey(gang, b.rank).level - rankByKey(gang, a.rank).level));

    const stash = Object.keys(gang.stash).map((id) => ({
        id, qty: gang.stash[id], label: (global.invItemLabel ? global.invItemLabel(id) : id),
    }));
    const materials = Object.keys(MATERIALS).map((id) => ({
        id, label: MATERIALS[id].label, price: MATERIALS[id].price, have: Number(gang.stash[id]) || 0,
    }));
    const recipes = Object.keys(RECIPES).map((key) => {
        const r = RECIPES[key];
        return {
            key, label: r.label, time: r.time, minLevel: r.minLevel,
            needs: Object.keys(r.needs).map((id) => ({ id, label: MATERIALS[id] ? MATERIALS[id].label : id, qty: r.needs[id], have: Number(gang.stash[id]) || 0 })),
            out: Object.keys(r.out).map((id) => ({ id, label: (global.invItemLabel ? global.invItemLabel(id) : id), qty: r.out[id] })),
            rankOk: admin || (myRank ? myRank.level : -1) >= r.minLevel,
        };
    });

    const inside = inInterior(player, gang);
    return {
        atBase: nearBase(player, gang),
        canEnter: !!(gang.interior && nearBase(player, gang) && !inside), // at the door, not yet inside
        inHouse: inside,
        gang: { id: gang.id, name: gang.name, tag: gang.tag, color: gang.color, treasury: gang.treasury, hasBase: !!gang.base, hasInterior: !!gang.interior },
        me: { characterId: charId(player), admin,
              rank: member ? member.rank : (admin ? 'admin' : null),
              rankLabel: member ? (myRank ? myRank.label : '') : (admin ? 'ადმინი' : ''),
              rankLevel: admin ? 99 : (myRank ? myRank.level : 0),
              perms: { craft: can('craft'), stash: can('stash_use'), treasury: can('treasury'), buyMaterials: can('buy_materials'), invite: can('invite'), kick: can('kick') } },
        ranks: gang.ranks.map((r) => ({ key: r.key, label: r.label, level: r.level })),
        members, stash, materials, recipes,
        capacity: { used: stashUnits(gang), max: STASH_CAP },
        craft: gang.crafting ? { recipe: gang.crafting.recipe, label: (RECIPES[gang.crafting.recipe] || {}).label || gang.crafting.recipe, remaining: Math.ceil(craftRemainingMs(gang) / 1000) } : null,
    };
}
function refreshPanel(player) {
    if (player.getVariable('gang:panel') !== true) return;
    const data = buildPanel(player);
    if (!data) return;
    try { player.call('gangs:data', [JSON.stringify(data)]); } catch (e) {}
}
// Refresh every member's open panel, plus an acting admin (who isn't a member) when given.
function refreshGangPanels(gang, also) {
    gang.members.forEach((m) => { const p = onlineByChar(m.characterId); if (p) refreshPanel(p); });
    if (also && !memberOf(gang, charId(also))) refreshPanel(also);
}

function openPanel(player) {
    const gang = contextGang(player);
    if (!gang) return tell(player, 'შენ არ ხარ ბანდაში.');
    if (!gang.base) return tell(player, 'ბანდას ჯერ არ აქვს ბაზა. ლიდერმა უნდა გამოიყენოს /gsetbase.');
    if (!atHQ(player, gang) && !nearStation(player, gang)) return tell(player, 'პანელი ხელმისაწვდომია მხოლოდ ბაზაზე ან სამუშაო მაგიდასთან.');
    player.setVariable('gang:panel', true);
    player.call('gangs:open');
}
mp.events.add('gangs:openPanel', (player) => openPanel(player)); // E at base / inside the HQ (client)

// ---- Duty wardrobe (members browse a curated pink/purple catalog and equip pieces to build an on-duty
// uniform; free; visual-only; hides civilian clothes; toggled off at the locker). onDuty value shape:
// { gangId, look: { catKey: { d, t } } }. `look` is the pieces the member has equipped.
function sendWardrobe(player, gang) {
    const catalog = dutyCatalogFor(gang) || {};
    const out = {};
    Object.keys(catalog).forEach((cat) => {
        out[cat] = catalog[cat].map((piece, index) => ({ index, d: piece.d, t: piece.t, label: piece.label || cat }));
    });
    const duty = onDuty.get(charId(player));
    const payload = {
        gang: gang.name, color: gang.color,
        catalog: out,
        current: (duty && duty.gangId === gang.id) ? (duty.look || {}) : {},
    };
    player.call('gangs:wardrobe:open', [JSON.stringify(payload)]);
}
mp.events.add('gangs:wardrobe', (player) => {
    const gang = contextGang(player);
    if (!gang) return tell(player, 'შენ არ ხარ ბანდაში.');
    if (!gang.wardrobe || !nearWardrobe(player, gang)) return tell(player, 'მიდი ბანდის გარდერობთან.');
    if (!dutyHasWardrobe(gang)) return tell(player, 'ამ ბანდას არ აქვს სამორიგეო გარდერობი.');
    sendWardrobe(player, gang);
});
// Apply the whole stored duty look (bare body + each equipped piece).
function applyDutyLook(player, look) {
    if (typeof global.invApplyClothingLook === 'function') global.invApplyClothingLook(player, look || {});
}
// Equip (or re-equip) one catalog piece into the member's duty look; applies live and marks them on duty.
mp.events.add('gangs:duty:pick', (player, cat, indexRaw) => {
    const gang = contextGang(player);
    if (!gang || !gang.wardrobe || !nearWardrobe(player, gang)) return;
    const piece = dutyPiece(gang, String(cat), Math.floor(Number(indexRaw)));
    if (!piece) return;
    const cid = charId(player);
    const duty = (onDuty.get(cid) && onDuty.get(cid).gangId === gang.id) ? onDuty.get(cid) : { gangId: gang.id, look: {} };
    duty.look = Object.assign({}, duty.look, { [String(cat)]: { d: piece.d, t: piece.t } });
    onDuty.set(cid, duty); // visual-only uniform, never an inventory item
    applyDutyLook(player, duty.look);
    sendWardrobe(player, gang); // refresh selection highlight
});
// Remove one slot from the duty look (keeps the rest of the uniform on).
mp.events.add('gangs:duty:clear', (player, cat) => {
    const gang = contextGang(player);
    if (!gang || !nearWardrobe(player, gang)) return;
    const cid = charId(player);
    const duty = onDuty.get(cid);
    if (!duty || duty.gangId !== gang.id || !duty.look[String(cat)]) return;
    delete duty.look[String(cat)];
    if (Object.keys(duty.look).length === 0) { onDuty.delete(cid); if (typeof global.invRestoreLook === 'function') global.invRestoreLook(player); }
    else { onDuty.set(cid, duty); applyDutyLook(player, duty.look); }
    sendWardrobe(player, gang);
});
mp.events.add('gangs:duty:off', (player) => {
    const gang = contextGang(player);
    if (!gang || !nearWardrobe(player, gang)) return;
    if (!onDuty.has(charId(player))) return;
    onDuty.delete(charId(player));
    if (typeof global.invRestoreLook === 'function') global.invRestoreLook(player);
    tell(player, 'სამსახურიდან გახვედი — ჩვეულებრივი ტანსაცმელი დაბრუნდა.');
    sendWardrobe(player, gang);
});
// Respawn/death resets the ped to the civilian look, so re-apply the on-duty uniform a tick later —
// the uniform persists "while on duty" across deaths/respawns until taken off at the locker.
mp.events.add('playerSpawn', (player) => {
    const cid = charId(player);
    const duty = cid != null ? onDuty.get(cid) : null;
    if (!duty || !duty.look || !Object.keys(duty.look).length) { if (duty) onDuty.delete(cid); return; }
    setTimeout(() => {
        const still = onDuty.get(cid);
        if (mp.players.exists(player) && still === duty) applyDutyLook(player, duty.look);
    }, 800);
});
mp.events.add('gangs:ui:ready', (player) => refreshPanel(player));
mp.events.add('gangs:close', (player) => player.setVariable('gang:panel', false));
mp.events.add('gangs:zonesRequest', (player) => { pushBaseZone(player); pushBlips(player); });

// Enter the members-only HQ from the base door; leave it from inside.
mp.events.add('gangs:enterHouse', (player) => {
    const gang = gangOf(player);
    if (!gang) return tell(player, 'შენ არ ხარ ბანდაში.');
    if (!gang.interior) return tell(player, 'ამ ბანდას არ აქვს შტაბის ინტერიერი.');
    if (!nearBase(player, gang)) return tell(player, 'შესვლა შესაძლებელია მხოლოდ ბაზის კართან.');
    enterInterior(player, gang);
    refreshPanel(player);
});
mp.events.add('gangs:exitHouse', (player) => {
    const gang = gangOf(player);
    if (!gang || !inInterior(player, gang)) return;
    exitInterior(player, gang);
    refreshPanel(player);
});
// Door interaction (E at the base door). Entry is allowed only for that gang's members and for admins.
mp.events.add('gangs:enterDoor', (player, gangIdRaw) => {
    const gang = gangById(gangIdRaw);
    if (!gang) return;
    if (!(memberOf(gang, charId(player)) || isGangAdmin(player))) return tell(player, 'სახლში შედიან მხოლოდ ბანდის წევრები და ადმინები.');
    if (!nearBase(player, gang)) return tell(player, 'მიდი ბანდის სახლის კართან.');
    enterInterior(player, gang);
    refreshPanel(player);
});
// Leave whatever gang HQ you're in — works for members and admins (panel also has a გასვლა button).
mp.events.addCommand('gexit', (player) => {
    for (const gang of gangs.values()) {
        if (inInterior(player, gang)) { exitInterior(player, gang); refreshPanel(player); return; }
    }
    tell(player, 'შენ არ ხარ ბანდის შტაბში.');
});

// Diagnostic: report why (or whether) you get gang doors, and force a fresh push to your client.
mp.events.addCommand('gangdebug', (player) => {
    const list = blipListFor(player);
    pushBaseZone(player); pushBlips(player);
    const g = gangOf(player);
    tell(player, `debug: sc=${player.socialClub} admin=${isGangAdmin(player)} member=${g ? g.tag : 'none'} gangsLoaded=${gangs.size} doorsForYou=${list.length} yourDim=${player.dimension}`);
    list.forEach((d) => tell(player, `  door: ${d.name} @ ${d.x.toFixed(1)}, ${d.y.toFixed(1)}, ${d.z.toFixed(1)} dim ${d.dim} (blip ${d.color})`));
    if (!list.length) tell(player, 'შენთვის კარი არ არის — ან არ ხარ ადმინი/წევრი, ან ბანდა არ ჩაიტვირთა.');
});

// ---- Panel actions (all server-authoritative: member + at base/HQ + permission) ----
function panelGuard(player, cap) {
    const gang = contextGang(player);
    if (!gang) { tell(player, 'შენ არ ხარ ბანდაში.'); return null; }
    if (!atHQ(player, gang) && !nearStation(player, gang)) { tell(player, 'ეს ქმედება ხელმისაწვდომია მხოლოდ ბაზაზე ან სამუშაო მაგიდასთან.'); return null; }
    const member = memberOf(gang, charId(player));
    const admin = !member && isGangAdmin(player);
    if (cap && !admin && !hasPerm(gang, member, cap)) { tell(player, 'შენს რანგს არ აქვს ამის ნებართვა.'); return null; }
    return { gang, member, admin };
}

mp.events.add('gangs:buyMaterial', (player, matId, qtyRaw) => {
    const ctx = panelGuard(player, 'buy_materials'); if (!ctx) return;
    const { gang } = ctx;
    const mat = MATERIALS[matId]; const qty = Math.floor(Number(qtyRaw));
    if (!mat || !Number.isFinite(qty) || qty <= 0 || qty > 100) return;
    const cost = mat.price * qty;
    if (gang.treasury < cost) return tell(player, `ხაზინაში არ არის საკმარისი თანხა — საჭიროა $${cost}.`);
    if (stashUnits(gang) + qty > STASH_CAP) return tell(player, 'საცავი სავსეა.');
    gang.treasury -= cost; stashAdd(gang, matId, qty);
    persist(gang);
    tell(player, `შეძენილია ${mat.label} ×${qty} — $${cost}. ხაზინა: $${gang.treasury}.`);
    refreshGangPanels(gang, player);
});

mp.events.add('gangs:craft', (player, recipeKey) => {
    const ctx = panelGuard(player, 'craft'); if (!ctx) return;
    const { gang, member, admin } = ctx;
    const recipe = RECIPES[recipeKey];
    if (!recipe) return;
    if (gang.crafting) return tell(player, 'ბაზაზე უკვე მიმდინარეობს წარმოება.');
    if (!admin && rankOfMember(gang, member).level < recipe.minLevel) return tell(player, 'შენი რანგი ვერ აწარმოებს ამ ნივთს.');
    if (!stashHas(gang, recipe.needs)) return tell(player, 'საცავში არ არის საკმარისი მასალა.');
    Object.keys(recipe.needs).forEach((id) => stashAdd(gang, id, -recipe.needs[id]));
    gang.crafting = { recipe: recipeKey, finishAt: Date.now() + recipe.time * 1000, by: charId(player) };
    scheduleCraft(gang);
    persist(gang);
    tell(player, `დაიწყო წარმოება: ${recipe.label} (${recipe.time}წმ).`);
    refreshGangPanels(gang, player);
});

mp.events.add('gangs:stashTake', (player, itemId, qtyRaw) => {
    const ctx = panelGuard(player, 'stash_use'); if (!ctx) return;
    const { gang } = ctx;
    const qty = Math.floor(Number(qtyRaw));
    const have = Number(gang.stash[itemId]) || 0;
    if (!Number.isFinite(qty) || qty <= 0 || qty > have) return;
    if (typeof global.invItemExists === 'function' && !global.invItemExists(itemId)) return tell(player, 'ამ ნივთის აღება ინვენტარში ვერ ხერხდება.');
    if (typeof global.invHasSpace === 'function' && !global.invHasSpace(player, itemId, qty)) return tell(player, 'ინვენტარში არ არის ადგილი.');
    stashAdd(gang, itemId, -qty);
    if (typeof global.invAddItem === 'function') global.invAddItem(player, itemId, qty);
    persist(gang);
    tell(player, `აიღე ${(global.invItemLabel ? global.invItemLabel(itemId) : itemId)} ×${qty} საცავიდან.`);
    refreshGangPanels(gang, player);
});

mp.events.add('gangs:stashPut', (player, itemId, qtyRaw) => {
    const ctx = panelGuard(player, 'stash_use'); if (!ctx) return;
    const { gang } = ctx;
    const qty = Math.floor(Number(qtyRaw));
    if (!Number.isFinite(qty) || qty <= 0) return;
    const have = typeof global.invCountItem === 'function' ? global.invCountItem(player, itemId) : 0;
    if (qty > have) return tell(player, 'შენ არ გაქვს ამდენი ნივთი.');
    if (stashUnits(gang) + qty > STASH_CAP) return tell(player, 'საცავი სავსეა.');
    if (typeof global.invRemoveItem === 'function') global.invRemoveItem(player, itemId, qty);
    stashAdd(gang, itemId, qty);
    persist(gang);
    tell(player, `შეინახე ${(global.invItemLabel ? global.invItemLabel(itemId) : itemId)} ×${qty} საცავში.`);
    refreshGangPanels(gang, player);
});

mp.events.add('gangs:deposit', (player, amtRaw) => {
    const ctx = panelGuard(player, 'treasury'); if (!ctx) return;
    const { gang } = ctx;
    const amount = Math.floor(Number(amtRaw));
    if (!Number.isFinite(amount) || amount <= 0) return;
    if (!global.canAfford(player, amount)) return tell(player, 'არასაკმარისი თანხა.');
    global.setMoney(player, global.getMoney(player) - amount);
    gang.treasury += amount;
    persist(gang);
    tell(player, `შეიტანე $${amount} ხაზინაში. ხაზინა: $${gang.treasury}.`);
    refreshGangPanels(gang, player);
});

mp.events.add('gangs:withdraw', (player, amtRaw) => {
    const ctx = panelGuard(player, 'treasury'); if (!ctx) return;
    const { gang } = ctx;
    const amount = Math.floor(Number(amtRaw));
    if (!Number.isFinite(amount) || amount <= 0) return;
    if (gang.treasury < amount) return tell(player, 'ხაზინაში არ არის ამდენი თანხა.');
    gang.treasury -= amount;
    global.setMoney(player, global.getMoney(player) + amount);
    persist(gang);
    tell(player, `გამოიტანე $${amount} ხაზინიდან. ხაზინა: $${gang.treasury}.`);
    refreshGangPanels(gang, player);
});

// ===================== Commands =====================
mp.events.addCommand('gang', (player) => {
    const gang = gangOf(player);
    if (!gang) {
        tell(player, `შენ არ ხარ ბანდაში. ბანდის დასაფუძნებლად: /gangcreate <ტეგი> <სახელი> ($${FOUND_COST}).`);
        return;
    }
    const member = memberOf(gang, charId(player));
    const online = gang.members.filter((m) => onlineByChar(m.characterId)).length;
    tell(player, `[${gang.tag}] ${gang.name} — შენი რანგი: ${rankOfMember(gang, member).label}. წევრები: ${gang.members.length} (ონლაინ ${online}). ხაზინა: $${gang.treasury}.`);
    tell(player, 'ბრძანებები: /gmembers, /ginvite, /gaccept, /gkick, /gpromote, /gdemote, /gleave, /gsetbase, /gbank, /gc. ბაზაზე დააჭირე E პანელისთვის.');
});

mp.events.addCommand('gangcreate', (player, fullText, tag, ...nameParts) => {
    if (gangOf(player)) return tell(player, 'შენ უკვე ბანდაში ხარ.');
    if (charId(player) == null) return tell(player, 'ანგარიში ჯერ არ ჩაიტვირთა.');
    const name = (nameParts || []).join(' ').trim();
    tag = String(tag || '').trim();
    if (tag.length < 2 || tag.length > 8 || name.length < 2 || name.length > 48) {
        return tell(player, 'გამოყენება: /gangcreate <ტეგი 2-8> <სახელი 2-48>');
    }
    const lower = (s) => String(s).toLowerCase();
    for (const g of gangs.values()) {
        if (lower(g.tag) === lower(tag)) return tell(player, 'ეს ტეგი უკვე დაკავებულია.');
        if (lower(g.name) === lower(name)) return tell(player, 'ეს სახელი უკვე დაკავებულია.');
    }
    if (!global.canAfford(player, FOUND_COST)) return tell(player, `ბანდის დაფუძნება ღირს $${FOUND_COST}.`);
    if (!global.api || typeof global.api.createGang !== 'function') return tell(player, 'სერვისი დროებით მიუწვდომელია.');

    const member = { characterId: charId(player), socialClub: player.socialClub || '', name: player.name, rank: 'leader', joinedAt: Date.now() };
    global.api.createGang({
        name, tag, color: '#c0392b', leaderCharacterId: charId(player),
        members: [member], ranks: DEFAULT_RANKS.map((r) => ({ ...r })), treasury: 0, stash: {},
    }).then((row) => {
        global.setMoney(player, global.getMoney(player) - FOUND_COST);
        const gang = adopt(row);
        setGangVars(player);
        tell(player, `ბანდა "[${gang.tag}] ${gang.name}" დაფუძნდა! შენ ხარ ლიდერი. გამოიყენე /gsetbase ბაზის დასაყენებლად.`);
    }).catch((e) => {
        console.log('[gangs] create failed: ' + (e && e.message));
        tell(player, 'ბანდის შექმნა ვერ მოხერხდა (შესაძლოა სახელი/ტეგი დაკავებულია).');
    });
});

mp.events.addCommand('ginvite', (player, _, id) => {
    const gang = gangOf(player);
    const member = gang && memberOf(gang, charId(player));
    if (!gang) return tell(player, 'შენ არ ხარ ბანდაში.');
    if (!hasPerm(gang, member, 'invite')) return tell(player, 'შენს რანგს არ აქვს მოწვევის ნებართვა.');
    const target = onlinePlayerById(id);
    if (!target || target === player) return tell(player, 'გამოყენება: /ginvite <playerId> (ახლომახლო).');
    if (charId(target) == null) return tell(player, 'სამიზნის ანგარიში ჯერ არ ჩაიტვირთა.');
    if (gangOf(target)) return tell(player, 'ეს მოთამაშე უკვე ბანდაშია.');
    pendingInvites.set(charId(target), { gangId: gang.id, byName: player.name, ts: Date.now() });
    tell(player, `მოიწვიე ${target.name}.`);
    tell(target, `${player.name}-მ მოგიწვია ბანდაში "[${gang.tag}] ${gang.name}". დაწერე /gaccept 60წმ-ში.`);
});

mp.events.addCommand('gaccept', (player) => {
    if (gangOf(player)) return tell(player, 'შენ უკვე ბანდაში ხარ.');
    const invite = pendingInvites.get(charId(player));
    if (!invite || Date.now() - invite.ts > 60000) { pendingInvites.delete(charId(player)); return tell(player, 'აქტიური მოწვევა არ გაქვს.'); }
    const gang = gangById(invite.gangId);
    if (!gang) { pendingInvites.delete(charId(player)); return tell(player, 'ბანდა აღარ არსებობს.'); }
    pendingInvites.delete(charId(player));
    gang.members.push({ characterId: charId(player), socialClub: player.socialClub || '', name: player.name, rank: 'recruit', joinedAt: Date.now() });
    charToGang.set(charId(player), gang.id);
    setGangVars(player); pushBaseZone(player); pushBlips(player);
    persist(gang);
    tell(player, `შეუერთდი ბანდას "[${gang.tag}] ${gang.name}" როგორც ${rankByKey(gang, 'recruit').label}.`);
    gang.members.forEach((m) => { const p = onlineByChar(m.characterId); if (p && p !== player) tell(p, `${player.name} შეუერთდა ბანდას.`); });
    refreshGangPanels(gang, player);
});

function requireManage(player) {
    const gang = gangOf(player);
    if (!gang) { tell(player, 'შენ არ ხარ ბანდაში.'); return null; }
    return { gang, actor: memberOf(gang, charId(player)) };
}
function canManageTarget(gang, actor, target) {
    if (!target) return false;
    return rankOfMember(gang, actor).level > rankOfMember(gang, target).level;
}

mp.events.addCommand('gkick', (player, _, id) => {
    const ctx = requireManage(player); if (!ctx) return;
    const { gang, actor } = ctx;
    if (!hasPerm(gang, actor, 'kick')) return tell(player, 'შენს რანგს არ აქვს გარიცხვის ნებართვა.');
    const targetPlayer = onlinePlayerById(id);
    const targetCid = targetPlayer ? charId(targetPlayer) : null;
    const targetMember = targetCid != null ? memberOf(gang, targetCid) : null;
    if (!targetMember) return tell(player, 'ეს მოთამაშე არ არის შენს ბანდაში (უნდა იყოს ონლაინ).');
    if (targetCid === charId(player)) return tell(player, 'საკუთარ თავს ვერ გარიცხავ (გამოიყენე /gleave).');
    if (!canManageTarget(gang, actor, targetMember)) return tell(player, 'თანაბარ ან მაღალ რანგს ვერ გარიცხავ.');
    removeMember(gang, targetCid);
    tell(player, `გარიცხე ${targetMember.name}.`);
    if (targetPlayer) tell(targetPlayer, `შენ გარიცხეს ბანდიდან "[${gang.tag}] ${gang.name}".`);
    refreshGangPanels(gang, player);
});

function changeRank(player, id, direction) {
    const ctx = requireManage(player); if (!ctx) return;
    const { gang, actor } = ctx;
    if (!hasPerm(gang, actor, 'promote') && !isLeader(gang, actor)) return tell(player, 'მხოლოდ ლიდერს შეუძლია რანგების შეცვლა.');
    const targetPlayer = onlinePlayerById(id);
    const targetCid = targetPlayer ? charId(targetPlayer) : null;
    const targetMember = targetCid != null ? memberOf(gang, targetCid) : null;
    if (!targetMember) return tell(player, 'ეს მოთამაშე არ არის შენს ბანდაში (უნდა იყოს ონლაინ).');
    if (!canManageTarget(gang, actor, targetMember)) return tell(player, 'თანაბარ ან მაღალ რანგს ვერ მართავ.');
    const sorted = gang.ranks.slice().sort((a, b) => a.level - b.level);
    const curIndex = sorted.findIndex((r) => r.key === targetMember.rank);
    const nextIndex = direction === 'promote' ? curIndex + 1 : curIndex - 1;
    if (nextIndex < 0 || nextIndex >= sorted.length) return tell(player, 'რანგი ვერ შეიცვალა.');
    const newRank = sorted[nextIndex];
    if (newRank.level >= rankOfMember(gang, actor).level) return tell(player, 'შენი რანგის ტოლ ან მაღალ რანგს ვერ ანიჭებ.');
    targetMember.rank = newRank.key;
    persist(gang);
    tell(player, `${targetMember.name} ახლა არის ${newRank.label}.`);
    if (targetPlayer) { setGangVars(targetPlayer); tell(targetPlayer, `შენი რანგი ახლა არის ${newRank.label}.`); refreshPanel(targetPlayer); }
    refreshGangPanels(gang, player);
}
mp.events.addCommand('gpromote', (player, _, id) => changeRank(player, id, 'promote'));
mp.events.addCommand('gdemote', (player, _, id) => changeRank(player, id, 'demote'));

function removeMember(gang, cid) {
    gang.members = gang.members.filter((m) => Number(m.characterId) !== Number(cid));
    charToGang.delete(Number(cid));
    const p = onlineByChar(cid);
    if (p) {
        ejectIfInside(p, gang); // don't strand an ex-member inside the HQ
        p.setVariable('gang:panel', false); setGangVars(p); pushBaseZone(p); pushBlips(p);
        try { p.call('gangs:forceClose'); } catch (e) {}
    }
    persist(gang);
}

mp.events.addCommand('gleave', (player) => {
    const gang = gangOf(player);
    if (!gang) return tell(player, 'შენ არ ხარ ბანდაში.');
    const member = memberOf(gang, charId(player));
    if (isLeader(gang, member)) {
        const others = gang.members.filter((m) => Number(m.characterId) !== charId(player));
        if (others.length === 0) {
            if (gang.staticKey) {
                removeMember(gang, charId(player)); // removeMember persists
                gang.leaderCharacterId = null; persist(gang);
                tell(player, 'დატოვე ბანდა. ბანდა რჩება ლიდერის გარეშე (ადმინი დანიშნავს ახალს).');
                return;
            }
            disband(gang); tell(player, 'დატოვე ბანდა — სხვა წევრები აღარ იყვნენ, ბანდა დაიშალა.'); return;
        }
        // Hand leadership to the highest-ranked remaining member.
        others.sort((a, b) => rankByKey(gang, b.rank).level - rankByKey(gang, a.rank).level);
        const heir = others[0];
        heir.rank = 'leader'; gang.leaderCharacterId = Number(heir.characterId);
        removeMember(gang, charId(player));
        const heirPlayer = onlineByChar(heir.characterId);
        if (heirPlayer) { setGangVars(heirPlayer); tell(heirPlayer, `${player.name}-მ დატოვა ბანდა — შენ ხარ ახალი ლიდერი.`); }
        tell(player, 'დატოვე ბანდა; ლიდერობა გადაეცა უახლოეს რანგს.');
        refreshGangPanels(gang, player);
        return;
    }
    removeMember(gang, charId(player));
    tell(player, `დატოვე ბანდა "[${gang.tag}] ${gang.name}".`);
    refreshGangPanels(gang, player);
});

mp.events.addCommand('gmembers', (player) => {
    const gang = gangOf(player);
    if (!gang) return tell(player, 'შენ არ ხარ ბანდაში.');
    tell(player, `წევრები (${gang.members.length}):`);
    gang.members.slice().sort((a, b) => rankByKey(gang, b.rank).level - rankByKey(gang, a.rank).level).forEach((m) => {
        const p = onlineByChar(m.characterId);
        player.outputChatBox(`  ${rankByKey(gang, m.rank).label} — ${m.name}${p ? ` !{#8ed17a}(ID ${p.id})` : ' !{#888}(ოფლაინ)'}`);
    });
});

mp.events.addCommand('gsetbase', (player) => {
    const gang = gangOf(player);
    if (!gang) return tell(player, 'შენ არ ხარ ბანდაში.');
    if (gang.staticKey) return tell(player, 'ამ ბანდას აქვს ფიქსირებული ბაზა — ვერ შეიცვლება.');
    const member = memberOf(gang, charId(player));
    if (!isLeader(gang, member) && !hasPerm(gang, member, 'setbase')) return tell(player, 'მხოლოდ ლიდერს შეუძლია ბაზის დაყენება.');
    const pos = player.position;
    gang.base = { x: pos.x, y: pos.y, z: pos.z, dim: Number(player.dimension) || 0 };
    persist(gang);
    pushBaseZoneToGang(gang);
    pushBlipsAll();
    tell(player, 'ბანდის ბაზა დაყენდა შენს მდებარეობაზე. ბაზაზე დააჭირე E პანელისთვის.');
});

mp.events.addCommand('gbank', (player) => {
    const gang = gangOf(player);
    if (!gang) return tell(player, 'შენ არ ხარ ბანდაში.');
    tell(player, `ხაზინა: $${gang.treasury}. შეტანა/გამოტანა — ბაზის პანელიდან (/gang → E).`);
});

// Admin: appoint (or replace) a gang's leader — the way a leaderless static gang gets bootstrapped.
// gangKey matches a static key (e.g. "greens") or any gang's tag.
mp.events.addCommand('gsetleader', (player, _, id, gangKey) => {
    if (typeof global.isProtectedAdmin !== 'function' || !global.isProtectedAdmin(player) || player.getVariable('admin:mode') !== true) {
        return tell(player, 'ეს ბრძანება ხელმისაწვდომია მხოლოდ Admin Mode-ში.');
    }
    const target = onlinePlayerById(id);
    if (!target) return tell(player, 'გამოყენება: /gsetleader <playerId> <gangKey|tag> (მაგ: greens)');
    if (charId(target) == null) return tell(player, 'სამიზნის ანგარიში ჯერ არ ჩაიტვირთა.');
    const key = String(gangKey || '').toLowerCase();
    if (!key) return tell(player, 'გამოყენება: /gsetleader <playerId> <gangKey|tag>');
    const gang = findStaticGang(key) || [...gangs.values()].find((g) => g.tag.toLowerCase() === key);
    if (!gang) return tell(player, 'ასეთი ბანდა ვერ მოიძებნა.');

    const current = gangOf(target);
    if (current && current.id !== gang.id) removeMember(current, charId(target));
    const oldLeader = gang.members.find((m) => m.rank === 'leader');
    if (oldLeader && Number(oldLeader.characterId) !== charId(target)) {
        oldLeader.rank = 'officer';
        const lp = onlineByChar(oldLeader.characterId); if (lp) { setGangVars(lp); tell(lp, 'შენ გადაგაყენეს ლიდერობიდან ოფიცრად.'); }
    }
    let member = memberOf(gang, charId(target));
    if (!member) {
        member = { characterId: charId(target), socialClub: target.socialClub || '', name: target.name, rank: 'leader', joinedAt: Date.now() };
        gang.members.push(member); charToGang.set(charId(target), gang.id);
    } else member.rank = 'leader';
    gang.leaderCharacterId = charId(target);
    setGangVars(target); pushBaseZone(target); pushBlips(target);
    persist(gang);
    tell(player, `${target.name} დაინიშნა "[${gang.tag}] ${gang.name}"-ის ლიდერად.`);
    tell(target, `შენ დაინიშნე ბანდის "[${gang.tag}] ${gang.name}" ლიდერად.`);
    refreshGangPanels(gang, player);
});

// Admin: capture the HQ interior teleport point. Stand INSIDE the installed interior (e.g. the Ballas
// gang house) and run /gsethq <key|tag>; members then teleport to exactly here when they enter the HQ.
mp.events.addCommand('gsethq', (player, _, gangKey) => {
    if (typeof global.isProtectedAdmin !== 'function' || !global.isProtectedAdmin(player) || player.getVariable('admin:mode') !== true) {
        return tell(player, 'ეს ბრძანება ხელმისაწვდომია მხოლოდ Admin Mode-ში.');
    }
    const key = String(gangKey || '').toLowerCase();
    const gang = key ? (findStaticGang(key) || [...gangs.values()].find((g) => g.tag.toLowerCase() === key)) : gangOf(player);
    if (!gang) return tell(player, 'გამოყენება: /gsethq <gangKey|tag> (მაგ: greens) — იდექი ინტერიერში.');
    const pos = player.position;
    gang.interior = { x: pos.x, y: pos.y, z: pos.z, h: Math.round(Number(player.heading) || 0) };
    persist(gang);
    // Refresh anyone who has the panel open so the "Enter HQ" button appears.
    refreshGangPanels(gang, player);
    tell(player, `შტაბის ინტერიერი დაყენდა "[${gang.tag}] ${gang.name}"-ისთვის ამ წერტილზე (X ${pos.x.toFixed(2)} Y ${pos.y.toFixed(2)} Z ${pos.z.toFixed(2)}).`);
});

function disband(gang) {
    const members = gang.members.slice();
    if (craftTimers.has(gang.id)) { clearTimeout(craftTimers.get(gang.id)); craftTimers.delete(gang.id); }
    members.forEach((m) => {
        charToGang.delete(Number(m.characterId));
        const p = onlineByChar(m.characterId);
        if (p) {
            ejectIfInside(p, gang);
            p.setVariable('gang:panel', false); setGangVars(p); pushBaseZone(p); pushBlips(p);
            try { p.call('gangs:forceClose'); } catch (e) {}
            tell(p, `ბანდა "[${gang.tag}] ${gang.name}" დაიშალა.`);
        }
    });
    gangs.delete(gang.id);
    pushBlipsAll();
    if (global.api && typeof global.api.deleteGang === 'function') global.api.deleteGang(gang.id).catch((e) => console.log('[gangs] delete failed: ' + (e && e.message)));
}
mp.events.addCommand('gdisband', (player) => {
    const gang = gangOf(player);
    if (!gang) return tell(player, 'შენ არ ხარ ბანდაში.');
    if (gang.staticKey) return tell(player, 'სტატიკური ბანდის დაშლა შეუძლებელია.');
    if (!isLeader(gang, memberOf(gang, charId(player)))) return tell(player, 'მხოლოდ ლიდერს შეუძლია ბანდის დაშლა.');
    disband(gang);
});

// Gang chat.
mp.events.addCommand('gc', (player, message) => {
    const gang = gangOf(player);
    if (!gang) return tell(player, 'შენ არ ხარ ბანდაში.');
    message = String(message || '').trim();
    if (!message) return tell(player, 'გამოყენება: /gc <შეტყობინება>');
    const member = memberOf(gang, charId(player));
    const line = { ch: 'system', text: `!{${gang.color}}[${gang.tag}] ${rankOfMember(gang, member).label} ${player.name}: !{#ffffff}${message}`, ts: Date.now() };
    gang.members.forEach((m) => { const p = onlineByChar(m.characterId); if (p) global.chatSend(p, line); });
});

// Keep cached member display names fresh, and refresh vars on join.
mp.events.add('playerJoin', (player) => { player.setVariable('gang:panel', false); });
mp.events.add('playerQuit', (player) => {
    const gang = gangOf(player);
    if (!gang) return;
    const member = memberOf(gang, charId(player));
    if (member && member.name !== player.name) { member.name = player.name; persist(gang); }
});
