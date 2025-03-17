const utils = require('utils');

function main() {
    const enter_time = Game.time;
    console.log(`start ${enter_time}`);
    utils.Harvester.print_all_harvesters();
    /*Object.entries(Game.creeps).forEach(([name, creep]) => {
        if (!utils.Harvester.is_registered(creep)) {
            new utils.Harvester(creep);
        }
    })*/
    utils.Harvester.get_alive_harvesters().forEach(harvester => {
        harvester.run();
    });
    console.log(`end ${enter_time}`);
}

module.exports.loop = function () {
    main();
}