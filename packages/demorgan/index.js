// ===================== Demorgan: admin jail in its own dimension =====================
// Admins send rule-breakers to Demorgan for N minutes: an isolated copy of the Bolingbroke prison yard
// in dimension DIMENSION, so nobody in the normal world sees them. The server keeps them inside (pulled
// back if they leave the radius or the dimension), blocks most commands, and the client blocks weapons
// and shows the remaining time. Time only counts down while online; the sentence survives reconnects
// and restarts (demorgan.json). Admins can visit with /sjail (and back out with /sjail again).
const fs = require('fs');
const path = require('path');

const DATA_FILE = path.join(__dirname, 'demorgan.json');
// Dimensions: 0 = main world, 1 = Demorgan (houses use 100000 + id). /dim and /setdim move admins/players.
const MAIN_DIMENSION = 0;
const DIMENSION = 1;
const MAX_DIMENSION = 2147483647;
// Demorgan lives inside an enclosed underground interior (the Gunrunning bunker below the docks), so
// nothing of the outside map is visible from it and its walls keep prisoners in. /sjail set moves it.
const DEFAULT_SPOT = { x: 892.64, y: -3245.87, z: -98.27, h: 90, interior: 'bunker' };
const SAFETY_RADIUS = 250;    // invisible failsafe: only a prisoner who glitched out of the interior gets put back
const BOUNDARY_MS = 1000;
const RELEASE_SPOT = { x: 1846.0, y: 2585.8, z: 45.67, h: 270 }; // outside the prison gate, normal world
const MAX_MINUTES = 1440;
const PENALTY_SECONDS = 5 * 60; // added to the sentence for dying or getting out of Demorgan's bounds
const FLOOR_DROP = 40;          // this far below the spot = fell through the floor (out of the map)
const PLACE_GRACE_MS = 3000;    // after a teleport, ignore stale positions before checking bounds again
const TICK_MS = 2000;
// Prison work (every prisoner gets a pickaxe automatically while digging — no item needed): dig at the marked spot (E) for DIG_MS to earn money (digging does NOT shorten the sentence),
// then a new spot is marked. Spots default to offsets around the Demorgan spot; /dmdig moves them.
const DIG_MS = 10000;
const DIG_RANGE = 2.5;
// Prisoners can dig DIG_BATCH times, then must rest a random DIG_COOLDOWN_MIN..DIG_COOLDOWN_MAX minutes
// (rolled separately for each prisoner and each batch) before the next batch (repeats forever).
// Stored on the sentence record (wall clock), so reconnecting doesn't skip the cooldown. Admins aren't limited.
const DIG_BATCH = 10;
const DIG_COOLDOWN_MIN = 5;   // minutes
const DIG_COOLDOWN_MAX = 20;  // minutes
// Each successful dig by a prisoner also pays a random amount, DIG_MONEY_MIN..DIG_MONEY_MAX, weighted so the
// minimum is by far the most likely: amount = MIN + (MAX-MIN) * u^DIG_MONEY_SKEW, u uniform 0..1, rounded to 10.
// With skew 3 about 1 in 4 digs pays $50, the median is ~$80, the average ~$110 and $300 is a rare jackpot.
const DIG_MONEY_MIN = 50;
const DIG_MONEY_MAX = 300;
const DIG_MONEY_SKEW = 3;
const DIG_OFFSETS = [[4, 3], [4, -3], [-4, 3], [-4, -3], [6, 0], [-6, 0], [0, 5], [0, -5]];
// Commands a prisoner may still use (everything else is blocked while in Demorgan).
const ALLOWED_COMMANDS = ['pos', 'money', 'bank', 'needs', 'laws', 'inv'];

let data = { spot: DEFAULT_SPOT, jailed: {} };
try { data = Object.assign(data, JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'))); } catch (e) {}
if (!data.jailed) data.jailed = {};
// One-time move (spotVersion 2): Demorgan used to be the open prison yard (default or a /sjail set spot
// out there), where the rest of the map is visible — move it into the enclosed interior.
if (!data.spot || data.spotVersion !== 2) {
    data.spot = Object.assign({}, DEFAULT_SPOT);
    data.spotVersion = 2;
    save();
}
function save() {
    const temporaryFile = DATA_FILE + '.tmp';
    try { fs.writeFileSync(temporaryFile, JSON.stringify(data, null, 2)); fs.renameSync(temporaryFile, DATA_FILE); } catch (e) {}
}

function keyOf(player) { return String(player.socialClub || '').trim().toLowerCase(); }
function tell(player, message) { player.outputChatBox('!{#ff6978}[Demorgan] !{#ffffff}' + message); }
function isAdmin(player) { return typeof global.isProtectedAdmin === 'function' && global.isProtectedAdmin(player); }
function adminMode(player) { return player.getVariable('admin:mode') === true; }
function recordOf(player) { const key = keyOf(player); return key ? data.jailed[key] || null : null; }
function formatTime(seconds) {
    const s = Math.max(0, Math.ceil(seconds));
    return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
}
function onlineById(value) {
    const text = String(value === undefined || value === null ? '' : value);
    if (!/^\d+$/.test(text)) return null;
    let found = null;
    mp.players.forEach(p => { if (Number(p.id) === Number(text)) found = p; });
    return found;
}

// ---- Placing / releasing ----
function placeInside(player) {
    const spot = data.spot;
    try { if (player.vehicle) player.removeFromVehicle(); } catch (e) {}
    player.dimension = DIMENSION;
    player.position = new mp.Vector3(spot.x + (Math.random() * 4 - 2), spot.y + (Math.random() * 4 - 2), spot.z);
    player.heading = spot.h || 0;
    player.demorganGraceUntil = Date.now() + PLACE_GRACE_MS;
}
// Back to the spawn point only — the prisoner stays in whatever dimension they're in (Demorgan's).
function toSpawnPoint(player) {
    const spot = data.spot;
    try { if (player.vehicle) player.removeFromVehicle(); } catch (e) {}
    player.position = new mp.Vector3(spot.x, spot.y, spot.z);
    player.heading = spot.h || 0;
    player.demorganGraceUntil = Date.now() + PLACE_GRACE_MS;
}
// +5 minutes for dying / leaving the bounds (capped at MAX_MINUTES).
function addPenalty(player, why) {
    const record = recordOf(player);
    if (!record) return;
    record.remaining = Math.min(record.remaining + PENALTY_SECONDS, MAX_MINUTES * 60);
    save();
    syncTimer(player);
    tell(player, `${why} — სასჯელს დაემატა ${PENALTY_SECONDS / 60} წუთი. დარჩენილია ${formatTime(record.remaining)}.`);
}
function syncTimer(player) {
    const record = recordOf(player);
    player.setVariable('demorgan:left', record ? Math.ceil(record.remaining) : 0);
    player.setVariable('demorgan:reason', record ? record.reason : '');
    // Tells the client it's in Demorgan (hide minimap, no ambient NPCs, load the interior's furniture).
    const inside = record || player.sjailReturn || Number(player.dimension) === DIMENSION;
    syncDigSpot(player, !!record);
    // Admins only keep the pickaxe (given on /sjail or /dim) while they're in Demorgan.
    if (!record && isAdmin(player) && Number(player.dimension) !== DIMENSION) takePickaxes(player);
    // Admins see every digging spot (numbered like /dmdig) whenever they're in Demorgan.
    player.setVariable('demorgan:digAll', isAdmin(player) ? digSpots().map(s => ({ x: s.x, y: s.y, z: s.z })) : null);
    player.setVariable('demorgan:area', inside ? { x: data.spot.x, y: data.spot.y, z: data.spot.z, interior: data.spot.interior || null } : null);
}
// ---- Prison work: digging ----
// Every prisoner is handed a pickaxe inventory item automatically (and it's taken back on release).
// Registered in the shared item registry, so it shows up in the inventory like any other item.
global.invItemDefs = global.invItemDefs || {};
global.invItemDefs.pickaxe = {
    label: 'წერაყინი', type: 'tool', stackable: false,
    onUse: (player) => tell(player, 'წერაყინი — დადექით მონიშნულ ადგილზე და დააჭირეთ E-ს სათხრელად.')
};
function hasPickaxe(player) { return typeof global.invCountItem === 'function' && global.invCountItem(player, 'pickaxe') > 0; }
// Returns true if the prisoner has a pickaxe afterwards.
function givePickaxe(player) {
    if (typeof global.invAddItem !== 'function') return true; // inventory package missing: don't block the job
    if (hasPickaxe(player)) return true;
    if (global.invAddItem(player, 'pickaxe', 1)) { tell(player, 'ინვენტარში გადმოგეცათ წერაყინი — სამუშაოდ (თხრა).'); return true; }
    tell(player, 'ინვენტარი სავსეა — წერაყინი ვერ მიიღეთ. გაათავისუფლეთ ადგილი.');
    return false;
}
function takePickaxes(player) {
    if (typeof global.invCountItem !== 'function' || typeof global.invRemoveItem !== 'function') return;
    const n = global.invCountItem(player, 'pickaxe');
    if (n > 0) global.invRemoveItem(player, 'pickaxe', n);
}
function digSpots() {
    if (Array.isArray(data.digSpots) && data.digSpots.length) return data.digSpots;
    const spot = data.spot;
    return DIG_OFFSETS.map(([dx, dy]) => ({ x: spot.x + dx, y: spot.y + dy, z: spot.z }));
}
// Every prisoner has one marked spot (synced to their client); a new one is picked after each dig.
function rollDigMoney() {
    const raw = DIG_MONEY_MIN + (DIG_MONEY_MAX - DIG_MONEY_MIN) * Math.pow(Math.random(), DIG_MONEY_SKEW);
    return Math.max(DIG_MONEY_MIN, Math.min(DIG_MONEY_MAX, Math.round(raw / 10) * 10));
}
function pickDigSpot(player) {
    const spots = digSpots();
    let index = Math.floor(Math.random() * spots.length);
    if (spots.length > 1 && index === player.demorganDigIndex) index = (index + 1) % spots.length;
    player.demorganDigIndex = index;
}
// Digs left in the current batch and seconds of cooldown left (expired cooldowns reset the batch).
function digStatus(record) {
    if (record.digCooldownUntil && Date.now() >= record.digCooldownUntil) { record.digCooldownUntil = 0; record.digCount = 0; }
    const cooldown = record.digCooldownUntil ? Math.ceil((record.digCooldownUntil - Date.now()) / 1000) : 0;
    return { left: Math.max(0, DIG_BATCH - (record.digCount || 0)), cooldown };
}
function syncDigSpot(player, jailed) {
    if (!jailed) { player.demorganDigIndex = undefined; player.setVariable('demorgan:dig', null); return; }
    const spots = digSpots();
    if (!(player.demorganDigIndex < spots.length)) pickDigSpot(player);
    const spot = spots[player.demorganDigIndex];
    const status = digStatus(recordOf(player));
    player.setVariable('demorgan:dig', { x: spot.x, y: spot.y, z: spot.z, left: status.left, cd: status.cooldown });
}
function stopDigging(player) {
    if (!player.demorganDigging) return;
    clearTimeout(player.demorganDigging.timer);
    player.demorganDigging = null;
    try { player.stopAnimation(); } catch (e) {}
}
mp.events.add('demorgan:dig:start', (player) => {
    // Prisoners dig at their own marked spot and earn time off; admins inside Demorgan (/sjail) can dig at any spot (no sentence).
    const record = recordOf(player);
    const admin = !record && isAdmin(player);
    if ((!record && !admin) || player.demorganDigging || Number(player.health) <= 0 || player.vehicle) return;
    if (Number(player.dimension) !== DIMENSION) return;
    if (record) {
        const status = digStatus(record);
        if (status.cooldown > 0) return tell(player, `ისვენებთ — შემდეგი თხრა ${formatTime(status.cooldown)}-ში.`);
    }
    if (!givePickaxe(player)) return; // lost / dropped it: hand out a new one (needs a free slot)
    const p = player.position;
    const candidates = record ? [digSpots()[player.demorganDigIndex]] : digSpots();
    const spot = candidates.find(s => s && Math.hypot(p.x - s.x, p.y - s.y, p.z - s.z) <= DIG_RANGE);
    if (!spot) return tell(player, 'მიდით სათხრელ ადგილზე.');
    player.playAnimation('amb@world_human_hammering@male@base', 'base', 8.0, 1); // swinging the pickaxe
    mp.players.callInRange(player.position, 150, 'demorgan:digProp', [player.id, DIG_MS]);
    player.demorganDigging = {
        timer: setTimeout(() => {
            if (!mp.players.exists(player)) return;
            player.demorganDigging = null;
            try { player.stopAnimation(); } catch (e) {}
            const now = recordOf(player), q = player.position;
            if (Number(player.health) <= 0) return;
            if (Math.hypot(q.x - spot.x, q.y - spot.y, q.z - spot.z) > DIG_RANGE) return tell(player, 'სამუშაო შეწყდა — ადგილიდან გახვედით.');
            if (!now && !admin) return; // released mid-dig
            let batchDone = false, breakMinutes = 0;
            if (now) { // prisoners: count the dig, start the cooldown after DIG_BATCH, and get a new marked spot (admins can use any)
                now.digCount = (now.digCount || 0) + 1;
                if (now.digCount >= DIG_BATCH) {
                    breakMinutes = DIG_COOLDOWN_MIN + Math.floor(Math.random() * (DIG_COOLDOWN_MAX - DIG_COOLDOWN_MIN + 1));
                    now.digCooldownUntil = Date.now() + breakMinutes * 60 * 1000;
                    batchDone = true;
                }
                save();
                pickDigSpot(player);
                syncTimer(player);
            }
            // Every completed dig pays (100%): a random DIG_MONEY_MIN..DIG_MONEY_MAX, the minimum being the most likely amount.
            const money = rollDigMoney();
            if (typeof global.addMoney === 'function') global.addMoney(player, money);
            else console.log('[demorgan] WARNING: economy package not loaded, dig payout of $' + money + ' was NOT paid to ' + player.name);
            player.call('demorgan:dig:reward', [money]); // on-screen push notification
            tell(player, `გათხარეთ — ანაზღაურება: +$${money.toLocaleString('en-US')}.${now ? (batchDone ? ` ${DIG_BATCH}/${DIG_BATCH} — დაისვენეთ ${breakMinutes} წუთი, შემდეგ გააგრძელეთ.` : ` (${now.digCount}/${DIG_BATCH}) შემდეგი ადგილი მონიშნულია.`) : ''}`);
        }, DIG_MS)
    };
});
mp.events.add('playerDeath', (player) => stopDigging(player));
mp.events.add('playerQuit', (player) => stopDigging(player));

function sendTo(target, minutes, reason, byName) {
    const key = keyOf(target);
    if (!key) return false;
    data.jailed[key] = { name: target.name, remaining: minutes * 60, reason: reason || 'წესების დარღვევა', by: byName, at: Date.now() };
    save();
    placeInside(target);
    syncTimer(target);
    givePickaxe(target);
    tell(target, `თქვენ გადაგიყვანეს დემორგანში ${minutes} წუთით. მიზეზი: ${data.jailed[key].reason}. (ადმინი: ${byName})`);
    return true;
}
function release(target, message) {
    const key = keyOf(target);
    if (key && data.jailed[key]) { delete data.jailed[key]; save(); }
    stopDigging(target);
    takePickaxes(target);
    target.dimension = 0;
    target.position = new mp.Vector3(RELEASE_SPOT.x, RELEASE_SPOT.y, RELEASE_SPOT.z);
    target.heading = RELEASE_SPOT.h;
    syncTimer(target);
    tell(target, message || 'თქვენ გათავისუფლდით დემორგანიდან.');
}

// ---- Enforcement + countdown (online time only) ----
setInterval(() => {
    let changed = false;
    mp.players.forEach(player => {
        if (!mp.players.exists(player)) return;
        const record = recordOf(player);
        if (!record) return;
        record.remaining -= TICK_MS / 1000;
        changed = true;
        if (record.remaining <= 0) { release(player, 'სასჯელი დასრულდა — თქვენ გათავისუფლდით დემორგანიდან.'); return; }
        syncTimer(player);
    });
    if (changed) save();
}, TICK_MS);

// Bounds: a prisoner who fell through / glitched out of the interior (more than SAFETY_RADIUS m away,
// or FLOOR_DROP m below the floor) goes back to the spawn point and gets +5 minutes. One who isn't in
// Demorgan's dimension (e.g. just connected) is simply put back into it — no penalty.
setInterval(() => {
    mp.players.forEach(player => {
        if (!mp.players.exists(player) || !recordOf(player)) return;
        if (Number(player.dimension) !== DIMENSION) { placeInside(player); return; }
        if (Date.now() < (player.demorganGraceUntil || 0)) return;
        const spot = data.spot, p = player.position;
        if (Math.hypot(p.x - spot.x, p.y - spot.y, p.z - spot.z) > SAFETY_RADIUS || p.z < spot.z - FLOOR_DROP) {
            toSpawnPoint(player);
            addPenalty(player, 'დემორგანის ტერიტორიიდან გასვლა');
        } else if (player.vehicle) toSpawnPoint(player);
    });
}, BOUNDARY_MS);

// Death: respawn straight back inside Demorgan (no hospital) and +5 minutes.
mp.events.add('playerDeath', (player) => {
    if (!recordOf(player)) return;
    // Dying right after being pulled back from out of bounds was already penalized — don't double it.
    if (Date.now() >= (player.demorganGraceUntil || 0)) addPenalty(player, 'დემორგანში გარდაიცვალეთ');
    setTimeout(() => {
        if (!mp.players.exists(player) || !recordOf(player)) return;
        const spot = data.spot;
        player.dimension = DIMENSION;
        player.spawn(new mp.Vector3(spot.x + (Math.random() * 4 - 2), spot.y + (Math.random() * 4 - 2), spot.z));
        player.heading = spot.h || 0;
        player.demorganGraceUntil = Date.now() + PLACE_GRACE_MS;
    }, 100);
});

// Rejoin / respawn: prisoners go straight back (after houses / City Hall spawn logic, so Demorgan wins).
function restore(player) {
    if (!mp.players.exists(player) || !recordOf(player)) return;
    placeInside(player);
    syncTimer(player);
    givePickaxe(player);
    tell(player, `დემორგანი: დარჩენილია ${formatTime(recordOf(player).remaining)}. მიზეზი: ${recordOf(player).reason}.`);
}
mp.events.add('playerReady', (player) => setTimeout(() => restore(player), 4000));
mp.events.add('playerSpawn', (player) => setTimeout(() => restore(player), 1500));

// Prisoners can't use commands except a few harmless ones (checked in packages/_core runCommand).
global.commandGuard = (player, name) => {
    if (!recordOf(player) || ALLOWED_COMMANDS.includes(name)) return null;
    return '!{#ff6978}[Demorgan] !{#ffffff}დემორგანში ბრძანებები აკრძალულია. დარჩენილია ' + formatTime(recordOf(player).remaining) + '.';
};
global.demorganIsJailed = (player) => !!recordOf(player);
global.demorganMinutesLeft = (player) => { const r = recordOf(player); return r ? Math.ceil(r.remaining / 60) : 0; };
global.demorganSend = (admin, target, minutes, reason) => doSend(admin, target, minutes, reason);
global.demorganRelease = (admin, target) => doRelease(admin, target);

// ---- Admin actions (shared by commands and the admin panel) ----
function doSend(admin, target, minutes, reason) {
    if (!isAdmin(admin) || !adminMode(admin)) { tell(admin, 'მხოლოდ ადმინისთვის, Admin Mode-ში.'); return false; }
    if (!target) { tell(admin, 'მოთამაშე ვერ მოიძებნა.'); return false; }
    if (isAdmin(target)) { tell(admin, 'ადმინისტრატორს ვერ გაგზავნით დემორგანში.'); return false; }
    minutes = Math.floor(Number(minutes));
    if (!Number.isSafeInteger(minutes) || minutes < 1 || minutes > MAX_MINUTES) { tell(admin, `წუთები: 1-${MAX_MINUTES}.`); return false; }
    if (!sendTo(target, minutes, String(reason || '').trim().slice(0, 100), admin.name)) { tell(admin, 'მოთამაშეს არ აქვს Social Club იდენტიფიკატორი.'); return false; }
    tell(admin, `${target.name} (ID ${target.id}) — დემორგანი ${minutes} წთ.`);
    mp.players.forEach(p => { if (p !== admin && p !== target) tell(p, `${target.name} გადაიყვანეს დემორგანში ${minutes} წუთით.`); });
    return true;
}
function doRelease(admin, target) {
    if (!isAdmin(admin) || !adminMode(admin)) { tell(admin, 'მხოლოდ ადმინისთვის, Admin Mode-ში.'); return false; }
    if (!target || !recordOf(target)) { tell(admin, 'ეს მოთამაშე დემორგანში არ არის.'); return false; }
    release(target, `ადმინმა ${admin.name} გაგათავისუფლათ დემორგანიდან.`);
    tell(admin, `${target.name} გათავისუფლდა.`);
    return true;
}

// /demorgan <id> <minutes> [reason]
mp.events.addCommand('demorgan', (player, full, id, minutes) => {
    const reason = String(full || '').trim().split(/\s+/).slice(2).join(' ');
    if (id === undefined || minutes === undefined) return tell(player, `გამოყენება: /demorgan <id> <1-${MAX_MINUTES} წთ> [მიზეზი]`);
    doSend(player, onlineById(id), minutes, reason);
});
// /undemorgan <id>
mp.events.addCommand('undemorgan', (player, _, id) => {
    if (id === undefined) return tell(player, 'გამოყენება: /undemorgan <id>');
    doRelease(player, onlineById(id));
});
// /demorgans — everyone with a sentence (online and offline)
mp.events.addCommand('demorgans', (player) => {
    if (!isAdmin(player)) return tell(player, 'მხოლოდ ადმინისთვის.');
    const keys = Object.keys(data.jailed);
    if (!keys.length) return tell(player, 'დემორგანში არავინ არის.');
    keys.forEach(key => {
        const r = data.jailed[key];
        let online = null;
        mp.players.forEach(p => { if (keyOf(p) === key) online = p; });
        player.outputChatBox(`!{#9aa4ad}${r.name}${online ? ' (ID ' + online.id + ')' : ' (offline)'} — ${formatTime(r.remaining)} · ${r.reason} · ${r.by}`);
    });
});
// ---- Dimension commands (admins) ----
// Names: main = 0, demorgan = 1; anything else is a number.
function parseDimension(text) {
    const value = String(text || '').trim().toLowerCase();
    if (value === 'main') return MAIN_DIMENSION;
    if (value === 'demorgan' || value === 'dm') return DIMENSION;
    if (!/^\d+$/.test(value)) return null;
    const n = Number(value);
    return Number.isSafeInteger(n) && n <= MAX_DIMENSION ? n : null;
}
function dimensionName(dim) {
    dim = Number(dim) || 0;
    if (dim === MAIN_DIMENSION) return '0 (მთავარი)';
    if (dim === DIMENSION) return '1 (დემორგანი)';
    if (dim >= 100000) return `${dim} (სახლი #${dim - 100000})`;
    return String(dim);
}
function moveToDimension(target, dim) {
    try { if (target.vehicle) target.removeFromVehicle(); } catch (e) {}
    target.dimension = dim;
    if (dim === DIMENSION) { placeInside(target); if (isAdmin(target)) givePickaxe(target); } // Demorgan: land on its spawn point
    syncTimer(target);
}
global.dimensionName = dimensionName;

// /dim — your dimension · /dim <0|1|main|demorgan|number> — move yourself
mp.events.addCommand('dim', (player, _, value) => {
    if (!isAdmin(player)) return tell(player, 'მხოლოდ ადმინისთვის.');
    if (value === undefined) return tell(player, `თქვენი განზომილება: ${dimensionName(player.dimension)}. გამოყენება: /dim <0|1|main|demorgan|ნომერი>`);
    const dim = parseDimension(value);
    if (dim === null) return tell(player, 'გამოყენება: /dim <0|1|main|demorgan|ნომერი>  (0 = მთავარი, 1 = დემორგანი)');
    player.sjailReturn = null; // a manual move replaces any /sjail return point
    moveToDimension(player, dim);
    tell(player, `განზომილება: ${dimensionName(dim)}.`);
});
// /setdim <id> <0|1|main|demorgan|number> — move another player
mp.events.addCommand('setdim', (player, _, id, value) => {
    if (!isAdmin(player)) return tell(player, 'მხოლოდ ადმინისთვის.');
    const target = onlineById(id);
    const dim = parseDimension(value);
    if (!target || dim === null) return tell(player, 'გამოყენება: /setdim <id> <0|1|main|demorgan|ნომერი>');
    if (recordOf(target)) return tell(player, `${target.name} დემორგანშია — ჯერ /undemorgan ${target.id}.`);
    moveToDimension(target, dim);
    tell(player, `${target.name} → განზომილება ${dimensionName(dim)}.`);
    if (target !== player) tell(target, `ადმინმა გადაგიყვანათ განზომილებაში ${dimensionName(dim)}.`);
});

// /sjail — admins: teleport into Demorgan to check on it, and /sjail again to go back.
// /sjail set — move the Demorgan spot to where you stand (in any dimension).
mp.events.addCommand('sjail', (player, _, action) => {
    if (!isAdmin(player)) return tell(player, 'მხოლოდ ადმინისთვის.');
    if (String(action || '').toLowerCase() === 'set') {
        const p = player.position;
        data.spot = { x: +p.x.toFixed(2), y: +p.y.toFixed(2), z: +p.z.toFixed(2), h: Math.round(Number(player.heading) || 0), interior: null };
        save();
        syncTimer(player); // default dig spots follow the Demorgan spot
        return tell(player, 'დემორგანის ადგილი შეიცვალა (აქ).');
    }
    if (player.sjailReturn) {
        const back = player.sjailReturn;
        player.sjailReturn = null;
        player.dimension = back.dim;
        player.position = new mp.Vector3(back.x, back.y, back.z);
        syncTimer(player);
        return tell(player, 'დაბრუნდით დემორგანიდან.');
    }
    if (player.vehicle) return tell(player, 'ჯერ გადმოდით მანქანიდან.');
    const p = player.position;
    player.sjailReturn = { x: p.x, y: p.y, z: p.z, dim: Number(player.dimension) || 0 };
    placeInside(player);
    syncTimer(player);
    givePickaxe(player); // admins can work the dig spots too
    const count = Object.keys(data.jailed).length;
    tell(player, `დემორგანში ხართ (განზომილება ${DIMENSION}). პატიმრები: ${count}. დასაბრუნებლად: /sjail`);
});

// /dmset <set name> [off] — admin tool: switch a bunker entity set on/off for yourself (inside Demorgan), to find
// which one fixes missing floor/wall textures. /dmset alone lists the usual bunker sets.
const BUNKER_SET_HINTS = ['Bunker_Style_A', 'Bunker_Style_B', 'Bunker_Style_C', 'standard_bunker_set', 'upgrade_bunker_set', 'standard_security_set',
    'security_upgrade', 'Office_blocker_set', 'Office_Upgrade_set', 'gun_wall_blocker', 'gun_range_blocker_set', 'gun_range_lights',
    'Gun_schematic_set', 'gun_locker_upgrade'];
mp.events.addCommand('dmset', (player, full, name, off) => {
    if (!isAdmin(player)) return tell(player, 'მხოლოდ ადმინისთვის.');
    if (!name) return tell(player, 'გამოყენება: /dmset <set> [off]. მაგ.: ' + BUNKER_SET_HINTS.join(', '));
    if (!/^[A-Za-z0-9_]{1,48}$/.test(name)) return tell(player, 'არასწორი სახელი.');
    if (Number(player.dimension) !== DIMENSION) return tell(player, 'ჯერ შედით დემორგანში (/sjail).');
    player.call('demorgan:interior:set', [name, String(off || '').toLowerCase() !== 'off']);
});

// /dmdig — admins: list the digging spots · /dmdig add (your position) · /dmdig del <n> · /dmdig reset
mp.events.addCommand('dmdig', (player, _, action, n) => {
    if (!isAdmin(player)) return tell(player, 'მხოლოდ ადმინისთვის.');
    action = String(action || '').toLowerCase();
    const custom = Array.isArray(data.digSpots) && data.digSpots.length;
    const refresh = () => mp.players.forEach(p => {
        if (!mp.players.exists(p)) return;
        if (recordOf(p)) p.demorganDigIndex = undefined;
        if (recordOf(p) || isAdmin(p)) syncTimer(p);
    });
    if (action === 'add') {
        const p = player.position;
        if (!custom) data.digSpots = [];
        data.digSpots.push({ x: +p.x.toFixed(2), y: +p.y.toFixed(2), z: +p.z.toFixed(2) });
        save(); refresh();
        return tell(player, `სათხრელი ადგილი #${data.digSpots.length} დაემატა (აქ).${custom ? '' : ' (ნაგულისხმევი ადგილები შეიცვალა თქვენით)'}`);
    }
    if (action === 'del') {
        const i = Number(n) - 1;
        if (!custom || !Number.isInteger(i) || i < 0 || i >= data.digSpots.length) return tell(player, 'გამოყენება: /dmdig del <ნომერი> (იხ. /dmdig)');
        data.digSpots.splice(i, 1);
        save(); refresh();
        return tell(player, `ადგილი #${i + 1} წაიშალა.${data.digSpots.length ? '' : ' დაბრუნდა ნაგულისხმევი ადგილები.'}`);
    }
    if (action === 'reset') {
        data.digSpots = null;
        save(); refresh();
        return tell(player, 'სათხრელი ადგილები დაბრუნდა ნაგულისხმევზე (დემორგანის ადგილის გარშემო).');
    }
    tell(player, `სათხრელი ადგილები (${custom ? 'თქვენი' : 'ნაგულისხმევი'}): ${digSpots().map((s, i) => `#${i + 1} ${s.x.toFixed(1)}, ${s.y.toFixed(1)}, ${s.z.toFixed(1)}`).join(' · ')}. /dmdig add | del <n> | reset`);
});

// ---- Static walls inside Demorgan (dimension 1) ----
// Each captured /pos spot is expanded into a 3-wide × 2-tall block of containers (big solid wall):
// centre + one to the left + one to the right (along the container's length), each stacked 2 high.
const WALL_MODEL = 'prop_container_01a';
const WALL_H = 2.6;   // container height — vertical stack gap
const WALL_L = 12.0;  // container length — left/right spacing along the container's length axis
const DEMORGAN_WALL_SPOTS = [
    { x: 876.026, y: -3204.302, z: -97.063, rz: -104.7 },
    { x: 895.117, y: -3237.001, z: -98.281, rz: -94.6 },
    { x: 896.731, y: -3245.906, z: -98.239, rz: -91.1 }
];
const demorganObjects = [];
for (const s of DEMORGAN_WALL_SPOTS) {
    const rad = s.rz * Math.PI / 180;
    const ox = Math.cos(rad) * WALL_L, oy = Math.sin(rad) * WALL_L; // along the container's length axis
    for (const side of [-1, 0, 1]) {   // left · centre · right
        for (const lvl of [0, 1]) {    // bottom · top
            try {
                demorganObjects.push(mp.objects.new(mp.joaat(WALL_MODEL),
                    new mp.Vector3(s.x + ox * side, s.y + oy * side, s.z + WALL_H * lvl),
                    { rotation: new mp.Vector3(0, 0, s.rz), dimension: DIMENSION }));
            } catch (e) { try { mp.console.logError('[demorgan] wall spawn failed: ' + e.message); } catch (e2) {} }
        }
    }
}
console.log('[demorgan] walls spawned: ' + demorganObjects.length);
