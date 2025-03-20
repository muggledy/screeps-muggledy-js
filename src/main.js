const utils = require('./utils');
const { Harvester, roleTypes } = require('./utils');

function main() {
    const enter_time = Game.time;
    console.log(`===> tick ${enter_time}`);
    Harvester.do_register();
    Harvester.generate_harvesters();
    Harvester.print_all_harvesters();
    Harvester.get_alive_harvesters().forEach(harvester => {
        harvester.run();
    });
}

module.exports.loop = function () {
    main();
}