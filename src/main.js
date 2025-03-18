const utils = require('utils');
const { Harvester } = require('./utils');

function main() {
    const enter_time = Game.time;
    console.log(`start ${enter_time}`);
    Harvester.print_all_harvesters();
    /*Object.entries(Game.creeps).forEach(([name, creep]) => {
        if (!Harvester.is_registered(creep)) {
            new Harvester(creep);
        }
    })*/
    Harvester.generate_harvesters();
    Harvester.get_alive_harvesters().forEach(harvester => {
        harvester.run();
    });
    console.log(`end ${enter_time}`);
}

module.exports.loop = function () {
    main();
}