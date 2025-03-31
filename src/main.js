const utils = require('./utils');
const { Harvester } = require('./utils');

function main() {
    console.log(`===> [2025.4.4/0] tick ${Game.time}`);
    utils.detectSafeSourcesPeriodicly();
    utils.attack_enemies_with_tower();
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