// /veh <model> - spawn a car and get in
mp.events.addCommand('veh', (player, _, model) => {
    if (!model) return player.outputChatBox('Usage: /veh <model>  e.g. /veh adder');

    // remove this player's previous car so the map doesn't fill up
    if (player.myCar && mp.vehicles.exists(player.myCar)) player.myCar.destroy();

    const car = mp.vehicles.new(mp.joaat(model.toLowerCase()), player.position, {
        heading: player.heading,
        dimension: player.dimension
    });
    player.myCar = car;
    player.putIntoVehicle(car, 0);
    player.outputChatBox(`Spawned: ${model}`);
});

// /fix - repair your current car
mp.events.addCommand('fix', (player) => {
    if (!player.vehicle) return player.outputChatBox('You are not in a car.');
    player.vehicle.repair();
    player.outputChatBox('Car repaired.');
});

// /dv - delete your car
mp.events.addCommand('dv', (player) => {
    if (player.myCar && mp.vehicles.exists(player.myCar)) {
        player.myCar.destroy();
        player.myCar = null;
        player.outputChatBox('Car deleted.');
    } else player.outputChatBox('You have no car.');
});

// clean up when a player leaves
mp.events.add('playerQuit', (player) => {
    if (player.myCar && mp.vehicles.exists(player.myCar)) player.myCar.destroy();
});

// /livery <number> - change car livery/wrap
mp.events.addCommand('livery', (player, _, num) => {
    if (!player.vehicle) return player.outputChatBox('You are not in a car.');
    const n = parseInt(num) || 0;
    player.vehicle.livery = n;       // classic liveries
    player.vehicle.setMod(48, n);    // mod-kit liveries
    player.outputChatBox(`Livery set to ${n}`);
});
