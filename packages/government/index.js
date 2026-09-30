// ===================== Government: ranks, treasury, payroll, taxes, fines, laws =====================
// Mirrors the police roster model. Rank -> capabilities gate every action. Money moves through the
// shared economy API (global.getMoney/setMoney/addMoney). Treasury + roster persist to government.json.
const fs = require('fs');
const path = require('path');

const DATA_FILE = path.join(__dirname, 'government.json');
const data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));

function save() {
    const temporaryFile = DATA_FILE + '.tmp';
    fs.writeFileSync(temporaryFile, JSON.stringify(data, null, 2));
    fs.renameSync(temporaryFile, DATA_FILE);
}

function accountKey(player) {
    return String(player.socialClub || '').trim().toLowerCase();
}

function isAdmin(player) {
    const key = accountKey(player);
    return key !== '' && data.admins.some(name => String(name).trim().toLowerCase() === key);
}

function rankOf(player) {
    if (isAdmin(player)) return 'president';
    const official = data.officials[accountKey(player)];
    return official && data.ranks[official.rank] ? official.rank : null;
}

function labelOf(rank) {
    return rank ? data.ranks[rank].label : 'მოქალაქე';
}

function hasCapability(player, capability) {
    const rank = rankOf(player);
    return rank !== null && data.ranks[rank].capabilities.includes(capability);
}

function tell(player, message) {
    player.outputChatBox('!{#4b9ce0}[მთავრობა] !{#ffffff}' + message);
}

function onDuty(player) {
    return player.getVariable('gov:duty') === true;
}

function requireCapability(player, capability) {
    if (!hasCapability(player, capability)) {
        tell(player, 'თქვენს რანგს არ აქვს ამის უფლება.');
        return false;
    }
    if (!onDuty(player)) {
        tell(player, 'ჯერ გადით მორიგეობაზე — /gduty.');
        return false;
    }
    return true;
}

function onlinePlayerById(value) {
    const text = String(value === undefined || value === null ? '' : value);
    if (!/^\d+$/.test(text)) return null;
    const id = Number(text);
    if (!Number.isSafeInteger(id)) return null;
    let found = null;
    mp.players.forEach(player => {
        if (Number(player.id) === id) found = player;
    });
    return found;
}

function targetFor(actor, idText) {
    const target = onlinePlayerById(idText);
    if (!target) {
        tell(actor, 'მოთამაშის ID ვერ მოიძებნა. გამოიყენეთ სიაში ნაჩვენები ID.');
        return null;
    }
    if (target.id === actor.id) {
        tell(actor, 'საკუთარ თავზე ვერ გამოიყენებთ.');
        return null;
    }
    return target;
}

function adminMayManage(actor, target) {
    if (isAdmin(target)) {
        tell(actor, 'დაცული ადმინისტრატორის მართვა თამაშში შეუძლებელია.');
        return false;
    }
    const actorRank = rankOf(actor);
    const targetRank = rankOf(target);
    if (targetRank && data.ranks[targetRank].level >= data.ranks[actorRank].level) {
        tell(actor, 'ვერ მართავთ თანაბარი ან უფრო მაღალი რანგის წარმომადგენელს.');
        return false;
    }
    return true;
}

// ---- Shared treasury API for shops/markets (tax revenue flows here) ----
global.govTaxRate = () => data.taxRate;
global.govTreasury = () => data.treasury;
// Takes money out of the treasury (e.g. house sell-back). False if the treasury can't cover it.
global.govTakeFromTreasury = (amount) => {
    const n = Math.floor(Number(amount));
    if (!Number.isFinite(n) || n <= 0 || data.treasury < n) return false;
    data.treasury -= n;
    save();
    return true;
};
global.govAddToTreasury = (amount) => {
    const n = Math.floor(Number(amount));
    if (!Number.isFinite(n) || n <= 0) return;
    data.treasury += n;
    save();
};

// ---- Unpaid fines: whatever a /fine couldn't collect on the spot, payable at the City Hall desk ----
if (!data.unpaidFines || typeof data.unpaidFines !== 'object') data.unpaidFines = {};
function unpaidOf(player) {
    const key = accountKey(player);
    return key && Array.isArray(data.unpaidFines[key]) ? data.unpaidFines[key] : [];
}
global.govUnpaidFines = (player) => unpaidOf(player).map((fine, index) => ({ index, amount: fine.amount, reason: fine.reason, by: fine.by, ts: fine.ts }));
// Pays one unpaid fine (index) or all of them (index = -1) from cash into the treasury.
global.govPayFines = (player, index) => {
    const key = accountKey(player);
    const list = unpaidOf(player);
    if (!key || !list.length) return { ok: false, reason: 'none' };
    const picked = index === -1 ? list.slice() : (list[index] ? [list[index]] : []);
    if (!picked.length) return { ok: false, reason: 'none' };
    const total = picked.reduce((sum, fine) => sum + fine.amount, 0);
    if (global.getMoney(player) < total) return { ok: false, reason: 'money', total };
    global.setMoney(player, global.getMoney(player) - total);
    data.treasury += total;
    data.unpaidFines[key] = index === -1 ? [] : list.filter((_, i) => i !== index);
    if (!data.unpaidFines[key].length) delete data.unpaidFines[key];
    save();
    return { ok: true, total };
};

// ---- Shared rank/duty API for packages/cityhall ----
function toggleDuty(player) {
    if (!hasCapability(player, 'duty')) { tell(player, 'თქვენ არ ხართ მთავრობის წარმომადგენელი.'); return null; }
    // Officials clock in at the City Hall duty point (packages/cityhall); admins can do it anywhere.
    if (!isAdmin(player) && typeof global.cityhallAtDuty === 'function' && !global.cityhallAtDuty(player)) {
        tell(player, 'მორიგეობაზე გასასვლელად მიდით მერიაში (რუკაზე მერიის ნიშანი).');
        return null;
    }
    const nowOn = !onDuty(player);
    player.setVariable('gov:duty', nowOn);
    tell(player, nowOn ? `თქვენ ხართ მორიგეობაზე, როგორც ${labelOf(rankOf(player))}.` : 'თქვენ გამოხვედით მორიგეობიდან.');
    return nowOn;
}
global.govRankOf = rankOf;
global.govRankLabel = (player) => labelOf(rankOf(player));
global.govOnDuty = onDuty;
global.govToggleDuty = toggleDuty;
global.govIsAdmin = isAdmin;

mp.events.add('playerJoin', (player) => player.setVariable('gov:duty', false));

mp.events.addCommand('gov', (player) => {
    const rank = rankOf(player);
    if (!rank) return tell(player, 'თქვენ არ ხართ მთავრობის წევრი. კანონების სანახავად: /laws.');
    const state = onDuty(player) ? 'მორიგეობაზე' : 'მორიგეობის გარეშე';
    tell(player, `${labelOf(rank)} — ${state}.`);
    tell(player, 'ბრძანებები: /gduty, /gannounce <ტექსტი>, /fine <id> <თანხა> [მიზეზი], /tax <პროცენტი>, /treasury, /paysalary, /laws, /setlaw.');
    tell(player, 'მართვა: /ghire <id>, /gpromote <id> <რანგი>, /gdemote <id> <რანგი>, /gfire <id>, /granks.');
});

mp.events.addCommand('gduty', (player) => { toggleDuty(player); });

mp.events.addCommand('gannounce', (player, message) => {
    if (!requireCapability(player, 'announce')) return;
    const text = String(message || '').trim();
    if (!text) return tell(player, 'გამოყენება: /gannounce <ტექსტი>');
    mp.players.forEach(p => p.outputChatBox(`!{#ffd24b}[სამთავრობო განცხადება] !{#ffffff}${text}`));
});

mp.events.addCommand('laws', (player) => {
    tell(player, 'სახელმწიფოს კანონები:');
    data.laws.forEach((law, i) => player.outputChatBox(`!{#9aa4ad}${i + 1}. !{#ffffff}${law}`));
});

mp.events.addCommand('setlaw', (player, full) => {
    if (!requireCapability(player, 'law')) return;
    const parts = String(full || '').trim().split(/\s+/);
    const action = (parts.shift() || '').toLowerCase();
    if (action === 'add') {
        const text = parts.join(' ').trim();
        if (!text) return tell(player, 'გამოყენება: /setlaw add <კანონის ტექსტი>');
        data.laws.push(text);
        save();
        tell(player, `დაემატა კანონი #${data.laws.length}.`);
    } else if (action === 'remove') {
        const index = Number(parts[0]);
        if (!Number.isSafeInteger(index) || index < 1 || index > data.laws.length) {
            return tell(player, `გამოყენება: /setlaw remove <1-${data.laws.length}>`);
        }
        const [removed] = data.laws.splice(index - 1, 1);
        save();
        tell(player, `წაიშალა კანონი: "${removed}".`);
    } else {
        tell(player, 'გამოყენება: /setlaw add <ტექსტი>  |  /setlaw remove <ნომერი>');
    }
});

mp.events.addCommand('fine', (player, full, id, amountText) => {
    if (!requireCapability(player, 'fine')) return;
    const target = targetFor(player, id);
    if (!target) return;
    const amount = Math.floor(Number(amountText));
    if (!Number.isSafeInteger(amount) || amount <= 0 || amount > data.fineMax) {
        return tell(player, `გამოყენება: /fine <playerId> <1-${data.fineMax}> [მიზეზი]`);
    }
    const reason = String(full).split(/\s+/).slice(2).join(' ').trim() || 'მიზეზი არ არის მითითებული';
    const balance = global.getMoney(target);
    const collected = Math.min(amount, balance);
    global.setMoney(target, balance - collected);
    data.treasury += collected;
    // The part they couldn't pay stays on record, payable at the City Hall desk.
    const owed = amount - collected;
    const targetKey = accountKey(target);
    if (owed > 0 && targetKey) {
        if (!Array.isArray(data.unpaidFines[targetKey])) data.unpaidFines[targetKey] = [];
        data.unpaidFines[targetKey].push({ amount: owed, reason, by: player.name, ts: Date.now() });
    }
    save();
    tell(player, `დაჯარიმდა ${target.name} $${amount}-ით (ამოღებულია $${collected}${owed > 0 ? `, დავალიანება $${owed}` : ''}). მიზეზი: ${reason}.`);
    tell(target, `თქვენ დაგაჯარიმათ ${labelOf(rankOf(player))} ${player.name}-მ $${amount}-ით. მიზეზი: ${reason}. გადახდილია $${collected}.` +
        (owed > 0 ? ` დარჩენილი $${owed} გადაიხადეთ მერიაში.` : ''));
});

mp.events.addCommand('treasury', (player) => {
    if (!rankOf(player)) return tell(player, 'ხაზინის ნახვა შეუძლიათ მხოლოდ მთავრობის წარმომადგენლებს.');
    tell(player, `სახელმწიფო ხაზინა: $${data.treasury}. გადასახადი: ${(data.taxRate * 100).toFixed(1)}%.`);
});

mp.events.addCommand('tax', (player, _, percentText) => {
    if (!requireCapability(player, 'tax')) return;
    const percent = Number(percentText);
    const maxPercent = data.taxRateMax * 100;
    if (!Number.isFinite(percent) || percent < 0 || percent > maxPercent) {
        return tell(player, `გამოყენება: /tax <0-${maxPercent}> (პროცენტი)`);
    }
    data.taxRate = percent / 100;
    save();
    tell(player, `გადასახადი დაყენდა ${percent.toFixed(1)}%-ზე.`);
});

function payShare(rank) {
    return data.salaries[rank] || 0;
}

mp.events.addCommand('paysalary', (player) => {
    if (!requireCapability(player, 'salary')) return;
    let paid = 0, total = 0;
    mp.players.forEach(p => {
        const rank = rankOf(p);
        if (!rank || !onDuty(p)) return;
        const salary = payShare(rank);
        if (salary <= 0 || data.treasury < salary) return;
        data.treasury -= salary;
        total += salary;
        paid++;
        global.addMoney(p, salary);
        tell(p, `მიღებულია ხელფასი: $${salary}.`);
    });
    save();
    tell(player, `გაიცა ხელფასი ${paid} მორიგე წარმომადგენელზე, სულ $${total}. ხაზინა: $${data.treasury}.`);
});

mp.events.addCommand('ghire', (player, _, id) => {
    if (!requireCapability(player, 'recruit')) return;
    const target = targetFor(player, id);
    if (!target) return;
    if (!adminMayManage(player, target)) return;
    const key = accountKey(target);
    if (!key) return tell(player, 'მოთამაშეს არ აქვს Social Club იდენტიფიკატორი; ვერ დაემატება.');
    if (data.officials[key]) return tell(player, 'ეს მოთამაშე უკვე მთავრობის წარმომადგენელია.');
    data.officials[key] = { name: target.name, rank: 'official' };
    save();
    tell(player, `დაინიშნა ${target.name} როგორც ${labelOf('official')}.`);
    tell(target, 'თქვენ დაინიშნეთ მთავრობის წარმომადგენლად. ბრძანებებისთვის: /gov.');
});

function changeRank(player, id, requestedRank, direction) {
    if (!requireCapability(player, 'promote')) return;
    const target = targetFor(player, id);
    if (!target) return;
    if (!adminMayManage(player, target)) return;
    const key = accountKey(target);
    const currentRank = rankOf(target);
    const newRank = data.ranks[requestedRank];
    if (!key || !currentRank || !newRank || isAdmin(target)) {
        return tell(player, `გამოყენება: /${direction} <playerId> <რანგი>. რანგებისთვის: /granks.`);
    }
    const oldLevel = data.ranks[currentRank].level;
    if ((direction === 'gpromote' && newRank.level <= oldLevel) ||
        (direction === 'gdemote' && newRank.level >= oldLevel)) {
        return tell(player, `აირჩიეთ ${labelOf(currentRank)}-ზე ${direction === 'gpromote' ? 'მაღალი' : 'დაბალი'} რანგი.`);
    }
    if (newRank.level >= data.ranks[rankOf(player)].level) {
        return tell(player, 'ვერ მიანიჭებთ თქვენს რანგზე მაღალ ან ტოლ რანგს.');
    }
    data.officials[key].rank = requestedRank;
    data.officials[key].name = target.name;
    save();
    tell(player, `${target.name} ახლა არის ${newRank.label}.`);
    tell(target, `თქვენი სამთავრობო რანგი ახლა არის ${newRank.label}.`);
}

mp.events.addCommand('gpromote', (player, _, id, rank) => changeRank(player, id, rank, 'gpromote'));
mp.events.addCommand('gdemote', (player, _, id, rank) => changeRank(player, id, rank, 'gdemote'));

mp.events.addCommand('granks', (player) => {
    const lines = Object.keys(data.ranks).map(key => `${key} (${data.ranks[key].label})`);
    tell(player, 'რანგები: ' + lines.join(', '));
});

mp.events.addCommand('gfire', (player, _, id) => {
    if (!requireCapability(player, 'fire')) return;
    const target = targetFor(player, id);
    if (!target) return;
    if (!adminMayManage(player, target)) return;
    const key = accountKey(target);
    if (!key || !data.officials[key]) return tell(player, 'ეს მოთამაშე არ არის მთავრობის წარმომადგენელი.');
    delete data.officials[key];
    save();
    target.setVariable('gov:duty', false);
    tell(player, `${target.name} ამოირიცხა მთავრობიდან.`);
    tell(target, 'თქვენ ამოგრიცხეს მთავრობიდან.');
});

// ---- Automatic payroll: pay on-duty officials from the treasury on a fixed interval ----
const salaryIntervalMs = Math.max(1, Number(data.salaryIntervalMinutes) || 30) * 60 * 1000;
setInterval(() => {
    let total = 0;
    mp.players.forEach(p => {
        const rank = rankOf(p);
        if (!rank || !onDuty(p)) return;
        const salary = payShare(rank);
        if (salary <= 0 || data.treasury < salary) return;
        data.treasury -= salary;
        total += salary;
        global.addMoney(p, salary);
        tell(p, `ავტომატური ხელფასი: $${salary}.`);
    });
    if (total > 0) save();
}, salaryIntervalMs);
