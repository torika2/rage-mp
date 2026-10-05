// ===================== Car drive keys =====================
// An owner can give another player a "key" to drive their car (drive-only — not the interaction menu).
// Keys are permanent (stored in the DB via global.api, table car_keys) and keyed by Social Club, to
// match the in-world ownership tag veh:ownerSc (packages/vehicles). This package keeps an in-memory
// cache and wires global.vehDrivePermitted(ownerKey, player) that the driver-seat guard consults.
//
// Flow: owner opens their car's interaction panel → "Keys" popover lists nearby players (grant) and
// current key holders (revoke). Grants/revokes update the cache immediately and persist to the DB.

const GRANT_RANGE = 12;       // metres a player must be within to be handed a key
const GRANT_RANGE_SQ = GRANT_RANGE * GRANT_RANGE;

function keyOf(player) { return String(player.socialClub || player.name || ('id' + player.id)); }

// ownerKey -> Map(granteeKey -> granteeName)
const cache = new Map();
function grantees(ownerKey) {
    let m = cache.get(ownerKey);
    if (!m) { m = new Map(); cache.set(ownerKey, m); }
    return m;
}

// Load every stored key into the cache on boot (retries until the API answers).
function loadAll(attempt = 0) {
    if (!global.api || typeof global.api.loadCarKeys !== 'function') {
        if (attempt < 10) setTimeout(() => loadAll(attempt + 1), 3000);
        return;
    }
    global.api.loadCarKeys().then(rows => {
        cache.clear();
        (Array.isArray(rows) ? rows : []).forEach(row => {
            if (row && row.ownerSocialClub && row.granteeSocialClub) {
                grantees(row.ownerSocialClub).set(row.granteeSocialClub, row.granteeName || row.granteeSocialClub);
            }
        });
        console.log(`[carkeys] loaded ${Array.isArray(rows) ? rows.length : 0} drive key(s)`);
    }).catch(() => { if (attempt < 10) setTimeout(() => loadAll(attempt + 1), 3000); });
}
setTimeout(() => loadAll(), 4000);

// The driver-seat guard (packages/vehicles) calls this for a car owned by someone else.
global.vehDrivePermitted = function (ownerKey, player) {
    const m = cache.get(ownerKey);
    return !!m && m.has(keyOf(player));
};

// Players near enough to be handed a key (excludes the owner and anyone who already holds one).
function nearbyCandidates(owner) {
    const held = cache.get(keyOf(owner));
    const out = [];
    const pos = owner.position;
    mp.players.forEach(other => {
        if (!mp.players.exists(other) || other === owner) return;
        if (Number(other.dimension) !== Number(owner.dimension)) return;
        if (held && held.has(keyOf(other))) return;
        const dx = pos.x - other.position.x, dy = pos.y - other.position.y, dz = pos.z - other.position.z;
        if (dx * dx + dy * dy + dz * dz > GRANT_RANGE_SQ) return;
        out.push({ id: other.id, name: other.name });
    });
    return out;
}

function sendData(player) {
    const held = cache.get(keyOf(player));
    const holders = held ? [...held.entries()].map(([sc, name]) => ({ sc, name })) : [];
    try { player.call('carkeys:data', [JSON.stringify({ holders, nearby: nearbyCandidates(player) })]); } catch (e) {}
}

// Owner opened the Keys popover.
mp.events.add('carkeys:request', (player) => sendData(player));

// Owner grants a key to a nearby player.
mp.events.add('carkeys:grant', (player, targetId) => {
    const target = (typeof mp.players.at === 'function') ? mp.players.at(Number(targetId)) : null;
    if (!target || !mp.players.exists(target) || target === player) return;
    if (Number(target.dimension) !== Number(player.dimension)) return;
    const dx = player.position.x - target.position.x, dy = player.position.y - target.position.y, dz = player.position.z - target.position.z;
    if (dx * dx + dy * dy + dz * dz > GRANT_RANGE_SQ) { player.outputChatBox('!{#ff6b6b}[გასაღები] ის ძალიან შორსაა.'); return; }

    const ownerKey = keyOf(player), granteeKey = keyOf(target);
    grantees(ownerKey).set(granteeKey, target.name);
    sendData(player);
    player.outputChatBox(`!{#8ed17a}[გასაღები] მიეცი შენი მანქანის გასაღები ${target.name}-ს.`);
    try { target.outputChatBox(`!{#8ed17a}[გასაღები] ${player.name}-მ მოგცა თავისი მანქანის ტარების უფლება.`); } catch (e) {}
    if (global.api && global.api.grantCarKey) global.api.grantCarKey(ownerKey, granteeKey, target.name).catch(() => {});
});

// Owner revokes a previously granted key (by the grantee's Social Club key).
mp.events.add('carkeys:revoke', (player, granteeKey) => {
    granteeKey = String(granteeKey || '');
    const ownerKey = keyOf(player);
    const m = cache.get(ownerKey);
    if (m && m.delete(granteeKey)) {
        sendData(player);
        player.outputChatBox('!{#ffb42e}[გასაღები] გასაღები გააუქმე.');
        if (global.api && global.api.revokeCarKey) global.api.revokeCarKey(ownerKey, granteeKey).catch(() => {});
    }
});
