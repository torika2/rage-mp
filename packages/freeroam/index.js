// Clear friendly names -> actual model names for the add-on cars.
// Any name not listed here is used as-is (so default GTA models still work: /car adder).
const CAR_NAMES = {
    'bmwm4':        'g82adro',   // BMW M4 (G82 Adro Kit)
    'audirs7':      '23rs7',     // Audi RS7 (2023)
    'audirs7abt':   '23rs7abt',  // Audi RS7 ABT
    'audirs7sport': 'rmodrs7',   // Audi RS7 Sportback
    'f44':          'M235iXD',   // BMW M235i Gran Coupe (F44)
    'demon':        'dcd',       // Dodge Challenger SRT Demon (folder: demon)
    'm8':           'mansm8c',   // BMW M8 Competition (Mansory)
    'm5e39':        'bmwm5e39',  // BMW M5 E39
    'cls':          'cls2015',   // Mercedes-Benz CLS 6.3 AMG 2015
    'r8':           'r820',      // Audi R8 2020 (RsMods)
    'f90':          '2019M5',    // BMW M5 F90 Competition 2019
    'sclass':       'mercedessclass27', // Mercedes-Benz S-Class 2027 (DAVKU)
    'charger69':    '69charger', // 1969 Dodge Charger
    'z28':          '15z28',     // Chevrolet Camaro Z/28 2015
    'lx570':        'lx57019mc', // Lexus LX570 2019 Black Edition
    'swatvan':      'swatvanr2', // SWAT van
    'd5':           'coquette6c',// Invetero Coquette D5 (Corvette)
    'rs6':          'avant',     // Audi RS6 Avant (HAMMER)
    'lc300':        '300vxr',    // Toyota Land Cruiser 300 VX.R (HAMMER)
    'm4f82':        'm4f82',     // BMW M4 F82 (HAMMER)
    'fenomeno':     'fenomeno',  // Lamborghini Fenomeno 2026 (DAVKU)
    'yumi':         'yumi',      // yumi
    'colorado':     'ccadd'      // Chevy Colorado ZR2 ADD (HAMMER)
};

const VEHICLE_MENU_RANGE = 5;
const VEHICLE_MENU_ACTION_COOLDOWN_MS = 250;
const vehicleMenuActionAt = new Map();

function ownedVehicleForMenu(player, requestedId) {
    if (typeof requestedId !== 'number' || !Number.isSafeInteger(requestedId)) return null;
    const vehicleId = requestedId;
    let vehicle = player.myCar;
    if (!vehicle || !mp.vehicles.exists(vehicle) || Number(vehicle.id) !== vehicleId) {
        const found = mp.vehicles.at(vehicleId);
        if (found && mp.vehicles.exists(found)) vehicle = found;
    }
    if (!vehicle || !mp.vehicles.exists(vehicle) ||
        Number(vehicle.id) !== vehicleId || player.vehicle ||
        Number(player.dimension) !== Number(vehicle.dimension)) return null;

    const dx = player.position.x - vehicle.position.x;
    const dy = player.position.y - vehicle.position.y;
    const dz = player.position.z - vehicle.position.z;
    return dx * dx + dy * dy + dz * dz <= VEHICLE_MENU_RANGE * VEHICLE_MENU_RANGE
        ? vehicle
        : null;
}

mp.events.add('vehicle:menu:request', (player, vehicleId) => {
    const vehicle = ownedVehicleForMenu(player, vehicleId);
    if (!vehicle) {
        player.call('vehicle:menu:denied');
        return;
    }
    player.call('vehicle:menu:open', [Number(vehicle.id)]);
});

mp.events.add('vehicle:menu:action', (player, vehicleId, action) => {
    const validActions = ['engine', 'lights', 'doors', 'trunk', 'hood', 'lock'];
    if (!validActions.includes(action)) {
        player.call('vehicle:menu:denied');
        return;
    }
    const vehicle = ownedVehicleForMenu(player, vehicleId);
    if (!vehicle) {
        player.call('vehicle:menu:denied');
        return;
    }
    const now = Date.now();
    const lastActionAt = vehicleMenuActionAt.get(player.id) || 0;
    if (now - lastActionAt < VEHICLE_MENU_ACTION_COOLDOWN_MS) return;
    vehicleMenuActionAt.set(player.id, now);
    player.call('vehicle:menu:apply', [Number(vehicle.id), action]);
});

// ---- Ambient RP actions: getting in / out of a vehicle (local /me to nearby players) ----
mp.events.add('playerEnterVehicle', (player, vehicle, seat) => {
    if (global.chatLocalAction) global.chatLocalAction(player, 'ხსნის კარს და ჯდება მანქანაში');
});
mp.events.add('playerLeaveVehicle', (player, vehicle, seat) => {
    if (global.chatLocalAction) global.chatLocalAction(player, 'გამოდის მანქანიდან და კეტავს კარს');
});
// Player downed / killed — local RP action to nearby players.
mp.events.add('playerDeath', (player) => {
    if (global.chatLocalAction) global.chatLocalAction(player, 'ეცემა უგონოდ მიწაზე');
});

// /pos - show the current world position and heading
mp.events.addCommand('pos', (player) => {
    const position = player.position;
    const heading = Number(player.heading).toFixed(1);
    global.chatSend(player, {
        ch: 'system',
        text: `Position: X ${Number(position.x).toFixed(3)}, Y ${Number(position.y).toFixed(3)}, Z ${Number(position.z).toFixed(3)} | Heading ${heading}`,
        ts: Date.now()
    });
});

// /tp <x> <y> <z> - teleport to world coordinates (handy for testing map/ymap edits)
mp.events.addCommand('tp', (player, _, x, y, z) => {
    if (x === undefined || y === undefined || z === undefined)
        return player.outputChatBox('!{#ffb42e}გამოყენება: /tp <x> <y> <z>');
    const px = parseFloat(x), py = parseFloat(y), pz = parseFloat(z);
    if ([px, py, pz].some(Number.isNaN)) return player.outputChatBox('!{#ff6b6b}არასწორი კოორდინატები.');
    player.position = new mp.Vector3(px, py, pz);
    player.outputChatBox(`!{#8ed17a}გადაყვანა: ${px}, ${py}, ${pz}`);
});

// /hospital - jump to the Central LS Medical Center interior (rc12b_default.ymap area)
mp.events.addCommand('hospital', (player) => {
    player.position = new mp.Vector3(325.6, -579.0, 45.4);
    player.outputChatBox('!{#8ed17a}საავადმყოფო (Central LS Medical).');
});

// /car <name> - spawn a car and get in
mp.events.addCommand('car', (player, _, name) => {
    if (!name) return player.outputChatBox('!{#ffb42e}გამოყენება: /car <სახელი> — მაგ. /car bmwm4.  სია: /cars');

    const key = name.toLowerCase();
    const model = CAR_NAMES[key] || key;

    // remove this player's previous car so the map doesn't fill up
    if (player.myCar && mp.vehicles.exists(player.myCar)) player.myCar.destroy();

    const car = mp.vehicles.new(mp.joaat(model), player.position, {
        heading: player.heading,
        dimension: player.dimension
    });
    player.myCar = car;
    if (typeof global.vehOnSpawn === 'function') global.vehOnSpawn(player, car, name); // persist this car
    player.putIntoVehicle(car, 0);
    // Add-on models may not be streamed to the client on the very first spawn, so the instant
    // seat can miss — retry once the vehicle has had a moment to stream in.
    setTimeout(() => {
        if (mp.players.exists(player) && mp.vehicles.exists(car) && !player.vehicle) player.putIntoVehicle(car, 0);
    }, 700);
    player.outputChatBox(`!{#8ed17a}გამოძახდა: ${name}`);
});

// /cars - list the clear add-on car names
mp.events.addCommand('cars', (player) => {
    global.chatSend(player, {
        ch: 'system',
        text: '!{#ffb42e}დამატებული მანქანები: !{#ffffff}bmwm4, audirs7, audirs7abt, audirs7sport, f44, demon, m8, m5e39, cls, r8, f90, sclass, charger69, z28, lx570, swatvan, d5, rs6, lc300, m4f82, fenomeno, yumi, colorado (LHP: alamolhp/bufsxlhp/dnscoutlhp)',
        ts: Date.now()
    });
    global.chatSend(player, {
        ch: 'system',
        text: '!{#9aa4ad}სხვა GTA მანქანა: /car <მოდელი>  (მაგ. /car adder, /car t20)',
        ts: Date.now()
    });
});

// /fix - repair your current car
mp.events.addCommand('fix', (player) => {
    if (!player.vehicle) return player.outputChatBox('შენ არ ხარ მანქანაში.');
    player.vehicle.repair();
    player.outputChatBox('მანქანა შეკეთდა.');
    if (global.chatLocalAction) global.chatLocalAction(player, 'აკეთებს მანქანას'); // local RP action
});

// /dv - delete your car
mp.events.addCommand('dv', (player) => {
    if (player.myCar && mp.vehicles.exists(player.myCar)) {
        player.myCar.destroy();
        player.myCar = null;
        if (typeof global.vehForget === 'function') global.vehForget(player); // stop persisting it
        player.outputChatBox('მანქანა წაიშალა.');
    } else player.outputChatBox('მანქანა არ გაქვს.');
});

// clean up when a player leaves
mp.events.add('playerQuit', (player) => {
    vehicleMenuActionAt.delete(player.id);
    if (typeof global.vehPersist === 'function') global.vehPersist(player); // save its final spot & fuel first
    if (player.myCar && mp.vehicles.exists(player.myCar)) player.myCar.destroy();
});

// /arms <index> - set the ped's arms (clothing component 3) to test which value fits a worn top,
// then save it for that top with /armsfit <index> (packages/clothing).
mp.events.addCommand('arms', (player, _, num) => {
    const value = parseInt(num);
    if (Number.isNaN(value)) return player.outputChatBox('!{#ffb42e}გამოყენება: /arms <index>');
    try { player.setClothes(3, value, 0, 0); } catch (e) {}
    player.outputChatBox(`!{#8ed17a}arms (component 3) = ${value}`);
});

// /livery <number> - change car livery/wrap
mp.events.addCommand('livery', (player, _, num) => {
    if (!player.vehicle) return player.outputChatBox('შენ არ ხარ მანქანაში.');
    const n = parseInt(num) || 0;
    player.vehicle.livery = n;       // classic liveries
    player.vehicle.setMod(48, n);    // mod-kit liveries
    player.outputChatBox(`ლივერი დაყენდა: ${n}`);
});
