function getRandomItemFromObject(obj) {
    const values = Object.values(obj);
    const randomIndex = Math.floor(Math.random() * values.length);
    return values[randomIndex];
}

// 定义常量
const HARVESTER_ENERGY_TYPE = 0;

class Harvester {
    // 静态属性，用于存储已注册的 harvester 实例
    static nameids = {};

    constructor(creep, type = HARVESTER_ENERGY_TYPE) {
        // 检查是否已经存在该 creep 名字对应的实例
        if (Harvester.nameids[creep.name]) {
            Harvester.nameids[creep.name].name = creep.name;
            Harvester.nameids[creep.name].type = type;
            Harvester.nameids[creep.name].id = creep.id;
            return Harvester.nameids[creep.name];
        }
        // 若不存在，则创建新实例
        this.name = creep.name;
        this.type = type;
        this.id = creep.id;
        // 将新实例存储到 nameids 中
        Harvester.nameids[creep.name] = this;
    }

    run() {
        if (HARVESTER_ENERGY_TYPE === this.type) {
            this.run_for_harvester_energy_type();
        }
    }

    run_for_harvester_energy_type() {
        const creep = this.self();
        if (!creep) {
            return;
        }
        if (creep.store.getFreeCapacity() > 0) {
            // continue to find resource and do harvest
            const sources = creep.room.find(FIND_SOURCES_ACTIVE);
            if (sources.length > 0) {
                if (!creep.pos.isNearTo(sources[0])) {
                    creep.moveTo(sources[0]);
                } else {
                    creep.harvest(sources[0]);
                }
            }
        } else {
            // transfer resource the creep carry to spawn
            const spawns = creep.room.find(FIND_MY_SPAWNS);
            if (spawns.length > 0) {
                const spawn = _.sample(spawns); // get a random spawn
                if (!creep.pos.isNearTo(spawn)) {
                    creep.moveTo(spawn);
                } else {
                    creep.transfer(spawn, RESOURCE_ENERGY);
                }
            }
        }
    }

    is_alive() {
        return Game.creeps.hasOwnProperty(this.name) && this.id === Game.creeps[this.name].id;
    }

    self() {
        if (this.is_alive()) {
            return Game.creeps[this.name];
        }
        return null;
    }

    static get_alive_harvesters(type = null) {
        const harvesters = [];
        for (const [name, harvester] of Object.entries(Harvester.nameids)) {
            if (harvester.is_alive()) {
                if (type === null || harvester.type === type) {
                    harvesters.push(harvester);
                }
            } else {
                delete Harvester.nameids[name];
            }
        }
        return harvesters;
    }
}

module.exports = {
    getRandomItemFromObject: getRandomItemFromObject
};