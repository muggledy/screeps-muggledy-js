const utils = require('utils');

function main() {
    const creep_name = '_harvest0';
    const creep = Game.creeps[creep_name];

    if (creep) {
        if (creep.store.getFreeCapacity() > 0) {
            // creep 寻找资源并采集
            const sources = creep.room.find(FIND_SOURCES_ACTIVE);
            if (sources.length > 0) {
                if (!creep.pos.isNearTo(sources[0])) {
                    creep.moveTo(sources[0]);
                } else {
                    creep.harvest(sources[0]);
                }
            }
        } else {
            // 将 creep 携带的资源转移到 spawn
            const spawns = creep.room.find(FIND_MY_SPAWNS);
            if (spawns.length > 0) {
                const spawn = _.sample(spawns);
                if (!creep.pos.isNearTo(spawn)) {
                    creep.moveTo(spawn);
                } else {
                    creep.transfer(spawn, RESOURCE_ENERGY);
                }
            }
        }
    } else {
        // 获取当前房间中随机一个 spawn
        const one_spawn = utils.getRandomItemFromObject(Game.spawns);
        // 生成一个新的 creep
        one_spawn.spawnCreep([WORK, CARRY, MOVE], creep_name, { memory: { role: 'harvester' } });
    }
}

module.exports.loop = function () {
    main();
}