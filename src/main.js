const utils = require('./utils');
const { Harvester, roleTypes } = require('./utils');

function main() {
    const enter_time = Game.time;
    console.log(`start ${enter_time}`);
    Harvester.do_register();
    Harvester.generate_harvesters();
    Harvester.print_all_harvesters();
    Harvester.get_alive_harvesters().forEach(harvester => {
        harvester.run();
    });
    console.log(`end ${enter_time}`);
}

module.exports.loop = function () {
    main();
}