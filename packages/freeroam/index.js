// Clear friendly names -> actual model names for the add-on cars.
// Any name not listed here is used as-is (so default GTA models still work: /car adder).
const CAR_NAMES = {
    'bmwm4':        'g82adro',   // BMW M4 (G82 Adro Kit)
    'audirs7':      '23rs7',     // Audi RS7 (2023)
    'audirs7abt':   '23rs7abt',  // Audi RS7 ABT
    'audirs7sport': 'rmodrs7'    // Audi RS7 Sportback
};

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
    player.putIntoVehicle(car, 0);
    player.outputChatBox(`!{#8ed17a}გამოძახდა: ${name}`);
});

// /cars - list the clear add-on car names
mp.events.addCommand('cars', (player) => {
    global.chatSend(player, {
        ch: 'system',
        text: '!{#ffb42e}დამატებული მანქანები: !{#ffffff}bmwm4, audirs7, audirs7abt, audirs7sport',
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
});

// /dv - delete your car
mp.events.addCommand('dv', (player) => {
    if (player.myCar && mp.vehicles.exists(player.myCar)) {
        player.myCar.destroy();
        player.myCar = null;
        player.outputChatBox('მანქანა წაიშალა.');
    } else player.outputChatBox('მანქანა არ გაქვს.');
});

// clean up when a player leaves
mp.events.add('playerQuit', (player) => {
    if (player.myCar && mp.vehicles.exists(player.myCar)) player.myCar.destroy();
});

// /livery <number> - change car livery/wrap
mp.events.addCommand('livery', (player, _, num) => {
    if (!player.vehicle) return player.outputChatBox('შენ არ ხარ მანქანაში.');
    const n = parseInt(num) || 0;
    player.vehicle.livery = n;       // classic liveries
    player.vehicle.setMod(48, n);    // mod-kit liveries
    player.outputChatBox(`ლივერი დაყენდა: ${n}`);
});
