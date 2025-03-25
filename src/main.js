const utils = require('./utils');
const { Harvester } = require('./utils');

function main() {
    console.log(`===> tick ${Game.time}`);
    utils.detectSafeSourcesPeriodicly();
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