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
const BLIP_SPRITE = 84;       // "gang" style blip
const BLIP_COLOR = 1;         // red

// Server-seeded "static" turf gangs. Code is the source of truth for each one's name/tag/colour/base:
// they're created on first boot and reconciled on every boot (so moving a base here moves it in-game),
// they can't be disbanded, and their base can't be changed in-game. Members/ranks/treasury/stash still
// persist in the DB like any gang. A static gang starts leaderless — an admin appoints the first leader
// with /gsetleader <playerId> <key>, after which that leader runs it normally (invite, craft, …).
// To add another gang, append a line here (key must be unique and stable).
const STATIC_GANGS = [
    { key: 'greens', name: 'Greens', tag: 'GRN', color: '#27ae60', base: { x: 101.643, y: -1937.120, z: 20.108, dim: 0 } },
];

// Default rank ladder for a freshly founded gang (level 4 = leader, '*' = every permission).
const DEFAULT_RANKS = [
    { key: 'recruit',  label: 'ახალბედა',    level: 0, permissions: [] },
    { key: 'soldier',  label: 'ჯარისკაცი',   level: 1, permissions: ['stash_use'] },
    { key: 'enforcer', label: 'მებრძოლი',     level: 2, permissions: ['stash_use', 'craft'] },
    { key: 'officer',  label: 'ოფიცერი',      level: 3, permissions: ['stash_use', 'craft', 'invite', 'kick', 'treasury', 'buy_materials'] },
    { key: 'leader',   label: 'ლიდერი',       level: 4, permissions: ['*'] },
];

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

// ---- State ----
const gangs = new Map();          // gangId -> gang object (authoritative)
const charToGang = new Map();     // characterId -> gangId
const pendingInvites = new Map(); // characterId -> { gangId, byName, ts }
const baseEntities = new Map();   // gangId -> { blip, marker }
const craftTimers = new Map();    // gangId -> timeout
const persistTimers = new Map();  // gangId -> timeout

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

// ---- Persistence ----
function serialize(gang) {
    return {
        name: gang.name, tag: gang.tag, color: gang.color, staticKey: gang.staticKey || null,
        leaderCharacterId: gang.leaderCharacterId,
        members: gang.members, ranks: gang.ranks, base: gang.base,
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

// ---- Base world entities ----
function destroyBaseEntities(gangId) {
    const e = baseEntities.get(gangId);
    if (!e) return;
    try { if (e.blip) e.blip.destroy(); } catch (x) {}
    try { if (e.marker) e.marker.destroy(); } catch (x) {}
    baseEntities.delete(gangId);
}
function buildBaseEntities(gang) {
    destroyBaseEntities(gang.id);
    if (!gang.base) return;
    const b = gang.base, pos = new mp.Vector3(b.x, b.y, b.z);
    const blip = mp.blips.new(BLIP_SPRITE, pos, { name: gang.tag + ' ბაზა', color: BLIP_COLOR, scale: 0.9, shortRange: true });
    const marker = mp.markers.new(1, new mp.Vector3(b.x, b.y, b.z - 1), 1.6, { color: [192, 57, 43, 120], dimension: Number(b.dim || 0) });
    baseEntities.set(gang.id, { blip, marker });
}

// Tell a player's client where their gang base is (for the "Press E" prompt), or clear it.
function pushBaseZone(player) {
    const gang = gangOf(player);
    const zone = gang && gang.base ? { x: gang.base.x, y: gang.base.y, z: gang.base.z, dim: Number(gang.base.dim || 0) } : null;
    try { player.call('gangs:zone', [JSON.stringify(zone)]); } catch (e) {}
}
function pushBaseZoneToGang(gang) {
    gang.members.forEach((m) => { const p = onlineByChar(m.characterId); if (p) pushBaseZone(p); });
}

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
    };
    gangs.set(gang.id, gang);
    gang.members.forEach((m) => charToGang.set(Number(m.characterId), gang.id));
    buildBaseEntities(gang);
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
        const existing = findStaticGang(def.key);
        if (existing) {
            let changed = false;
            ['name', 'tag', 'color'].forEach((f) => { if (existing[f] !== def[f]) { existing[f] = def[f]; changed = true; } });
            const cur = existing.base;
            if (!cur || cur.x !== b.x || cur.y !== b.y || cur.z !== b.z || Number(cur.dim || 0) !== b.dim) {
                existing.base = b; buildBaseEntities(existing); pushBaseZoneToGang(existing); changed = true;
            }
            if (changed) persist(existing);
            return;
        }
        global.api.createGang({
            name: def.name, tag: def.tag, color: def.color, staticKey: def.key,
            leaderCharacterId: null, members: [], ranks: DEFAULT_RANKS.map((r) => ({ ...r })),
            base: b, treasury: 0, stash: {},
        }).then((row) => {
            const gang = adopt(row);
            console.log(`[gangs] seeded static gang "${gang.name}" [${gang.tag}]`);
            mp.players.forEach((p) => { if (p.character) { setGangVars(p); pushBaseZone(p); } });
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
        baseEntities.forEach((_, id) => destroyBaseEntities(id));
        (Array.isArray(rows) ? rows : []).forEach(adopt);
        console.log(`[gangs] loaded ${gangs.size} gang(s)`);
        ensureStaticGangs();
        mp.players.forEach((p) => { if (p.character) { setGangVars(p); pushBaseZone(p); } });
    }).catch(() => { if (attempt < 10) setTimeout(() => loadAll(attempt + 1), 3000); });
}
setTimeout(() => loadAll(), 4000);

// Hydrate identity when a character logs in.
global.onCharacterLoad((player) => { setGangVars(player); pushBaseZone(player); });

// ---- Shared API for other packages ----
global.gangOf = (player) => gangOf(player);
global.gangTagOf = (player) => { const g = gangOf(player); return g ? g.tag : null; };

// ===================== CEF panel =====================
function buildPanel(player) {
    const gang = gangOf(player);
    if (!gang) return null;
    const member = memberOf(gang, charId(player));
    const myRank = rankOfMember(gang, member);
    const perms = myRank ? myRank.permissions : [];
    const can = (cap) => perms.includes('*') || perms.includes(cap);

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
            rankOk: (myRank ? myRank.level : -1) >= r.minLevel,
        };
    });

    return {
        atBase: nearBase(player, gang),
        gang: { id: gang.id, name: gang.name, tag: gang.tag, color: gang.color, treasury: gang.treasury, hasBase: !!gang.base },
        me: { characterId: charId(player), rank: member ? member.rank : null, rankLabel: myRank ? myRank.label : '', rankLevel: myRank ? myRank.level : 0,
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
function refreshGangPanels(gang) { gang.members.forEach((m) => { const p = onlineByChar(m.characterId); if (p) refreshPanel(p); }); }

function openPanel(player) {
    const gang = gangOf(player);
    if (!gang) return tell(player, 'შენ არ ხარ ბანდაში.');
    if (!gang.base) return tell(player, 'ბანდას ჯერ არ აქვს ბაზა. ლიდერმა უნდა გამოიყენოს /gsetbase.');
    if (!nearBase(player, gang)) return tell(player, 'პანელი ხელმისაწვდომია მხოლოდ ბანდის ბაზაზე.');
    player.setVariable('gang:panel', true);
    player.call('gangs:open');
}
mp.events.add('gangs:openPanel', (player) => openPanel(player)); // E at base (client)
mp.events.add('gangs:ui:ready', (player) => refreshPanel(player));
mp.events.add('gangs:close', (player) => player.setVariable('gang:panel', false));
mp.events.add('gangs:zonesRequest', (player) => pushBaseZone(player));

// ---- Panel actions (all server-authoritative: member + at base + permission) ----
function panelGuard(player, cap) {
    const gang = gangOf(player);
    if (!gang) { tell(player, 'შენ არ ხარ ბანდაში.'); return null; }
    if (!nearBase(player, gang)) { tell(player, 'ეს ქმედება ხელმისაწვდომია მხოლოდ ბაზაზე.'); return null; }
    const member = memberOf(gang, charId(player));
    if (cap && !hasPerm(gang, member, cap)) { tell(player, 'შენს რანგს არ აქვს ამის ნებართვა.'); return null; }
    return { gang, member };
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
    refreshGangPanels(gang);
});

mp.events.add('gangs:craft', (player, recipeKey) => {
    const ctx = panelGuard(player, 'craft'); if (!ctx) return;
    const { gang, member } = ctx;
    const recipe = RECIPES[recipeKey];
    if (!recipe) return;
    if (gang.crafting) return tell(player, 'ბაზაზე უკვე მიმდინარეობს წარმოება.');
    if (rankOfMember(gang, member).level < recipe.minLevel) return tell(player, 'შენი რანგი ვერ აწარმოებს ამ ნივთს.');
    if (!stashHas(gang, recipe.needs)) return tell(player, 'საცავში არ არის საკმარისი მასალა.');
    Object.keys(recipe.needs).forEach((id) => stashAdd(gang, id, -recipe.needs[id]));
    gang.crafting = { recipe: recipeKey, finishAt: Date.now() + recipe.time * 1000, by: charId(player) };
    scheduleCraft(gang);
    persist(gang);
    tell(player, `დაიწყო წარმოება: ${recipe.label} (${recipe.time}წმ).`);
    refreshGangPanels(gang);
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
    refreshGangPanels(gang);
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
    refreshGangPanels(gang);
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
    refreshGangPanels(gang);
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
    refreshGangPanels(gang);
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
    setGangVars(player); pushBaseZone(player);
    persist(gang);
    tell(player, `შეუერთდი ბანდას "[${gang.tag}] ${gang.name}" როგორც ${rankByKey(gang, 'recruit').label}.`);
    gang.members.forEach((m) => { const p = onlineByChar(m.characterId); if (p && p !== player) tell(p, `${player.name} შეუერთდა ბანდას.`); });
    refreshGangPanels(gang);
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
    refreshGangPanels(gang);
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
    refreshGangPanels(gang);
}
mp.events.addCommand('gpromote', (player, _, id) => changeRank(player, id, 'promote'));
mp.events.addCommand('gdemote', (player, _, id) => changeRank(player, id, 'demote'));

function removeMember(gang, cid) {
    gang.members = gang.members.filter((m) => Number(m.characterId) !== Number(cid));
    charToGang.delete(Number(cid));
    const p = onlineByChar(cid);
    if (p) { p.setVariable('gang:panel', false); setGangVars(p); pushBaseZone(p); try { p.call('gangs:forceClose'); } catch (e) {} }
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
        refreshGangPanels(gang);
        return;
    }
    removeMember(gang, charId(player));
    tell(player, `დატოვე ბანდა "[${gang.tag}] ${gang.name}".`);
    refreshGangPanels(gang);
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
    buildBaseEntities(gang);
    persist(gang);
    pushBaseZoneToGang(gang);
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
    setGangVars(target); pushBaseZone(target);
    persist(gang);
    tell(player, `${target.name} დაინიშნა "[${gang.tag}] ${gang.name}"-ის ლიდერად.`);
    tell(target, `შენ დაინიშნე ბანდის "[${gang.tag}] ${gang.name}" ლიდერად.`);
    refreshGangPanels(gang);
});

function disband(gang) {
    const members = gang.members.slice();
    if (craftTimers.has(gang.id)) { clearTimeout(craftTimers.get(gang.id)); craftTimers.delete(gang.id); }
    destroyBaseEntities(gang.id);
    members.forEach((m) => {
        charToGang.delete(Number(m.characterId));
        const p = onlineByChar(m.characterId);
        if (p) { p.setVariable('gang:panel', false); setGangVars(p); pushBaseZone(p); try { p.call('gangs:forceClose'); } catch (e) {} tell(p, `ბანდა "[${gang.tag}] ${gang.name}" დაიშალა.`); }
    });
    gangs.delete(gang.id);
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
