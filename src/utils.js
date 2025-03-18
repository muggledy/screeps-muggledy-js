function getRandomItemFromObject(obj) {
    const values = Object.values(obj);
    const randomIndex = Math.floor(Math.random() * values.length);
    return values[randomIndex];
}

// 定义常量
const HARVESTER_ENERGY_TYPE = 0;

class Harvester {
    /*
    Usage:
    creep = spawn.spawnCreep([WORK, CARRY, MOVE], name, {'memory': {'role': 'harvester'}})
    harvester = Harvester(creep)
    harvester.run()
    Note:
    1) we can get the original creep object by `harvester.self()`
    2) we can get all alive harvesters by Harvester.get_alive_harvesters()
    中文描述：
    当母巢生成一个(如资源)采集者creep，可以通过调用Harvester(creep)将其Harvester化，并返回一个harvester对象，新对象
    具有两个好处，一是向Harvester管理机构进行了注册并且对其角色类型进行了更精细的划分，也更方便后续管理这些采集者，
    二是Harvester管理机构提供了标准的运行动作供采集者执行，对于细分类型HARVESTER_ENERGY_TYPE角色的采集者来说，其标准动作为：
    不断采集能量资源并搬运至母巢；
    可通过harvester.self()获取原始creep对象（如果creep对象已经消亡，则返回None）；可通过Harvester.get_alive_harvesters()
    获取所有注册了的且当前仍存活的harvester对象列表，如果type参数非None，则获取指定细分类型的harvester列表
    */

    // 静态属性，用于存储已注册的 harvester 实例
    static get nameids() {
        // 检查 Memory 中是否已经存在容器
        if (!Memory.harvesterNameIds) {
            Memory.harvesterNameIds = {}; //Memory持久化存储，但是存储的不是harvester本身，而是序列化后的普通object（即非Harvester实例）
        }
        return Memory.harvesterNameIds;
    }
    static nameids_non_persistent = {}; //非持久化存储、临时存储，存储harvester实例本身
                                        // 对nameids、nameids_non_persistent的增删改查请使用addData、removeData、modifyDataProperty、getData

    static addData(name, harvester) {
        Harvester.nameids[name] = harvester;
        Harvester.nameids_non_persistent[name] = harvester;
    }

    static getData(name) {
        const harvester = Harvester.nameids_non_persistent[name];
        if (harvester) {
            return harvester;
        }
        const obj = Harvester.nameids[name];
        if (obj) {
            const new_harvester = Harvester.fromObject(obj);
            Harvester.nameids_non_persistent[new_harvester.name] = new_harvester;
            return new_harvester;
        }
        return undefined;
    }

    static removeData(name) {
        delete Harvester.nameids[name];
        delete Harvester.nameids_non_persistent[name];
    }

    static modifyDataProperty(name, property, value) { //modify nameids[name].property = value
        // 检查字典中是否存在指定的键
        if (Harvester.getData(name)) {
            Harvester.nameids[name][property] = value;
            Harvester.nameids_non_persistent[name][property] = value;
        }
    }

    static fromObject(obj) { //根据持久化数据恢复出harvester对象，入参是从持久化Memory.nameids中取的普通obj
        const harvester = Object.create(Harvester.prototype);
        // 在这里可以根据需要将obj中的属性复制到新的实例中
        harvester.name = obj.name;
        harvester.type = obj.type;
        harvester.id = obj.id;
        return harvester;
    }

    constructor(creep, type = HARVESTER_ENERGY_TYPE) {
        // 检查是否已经存在该 creep 名字对应的实例
        if (Harvester.getData(creep.name)) {
            Harvester.modifyDataProperty(creep.name, 'name', creep.name);
            Harvester.modifyDataProperty(creep.name, 'type', type);
            Harvester.modifyDataProperty(creep.name, 'id', creep.id);
            return Harvester.getData(creep.name);
        }
        // 若不存在，则创建新harvester实例
        console.log(`create new harvester for new register one creep(${creep.name},type:${type},id:${creep.id})`);
        this.name = creep.name;
        this.type = type;
        this.id = creep.id;
        // 将新实例存储到 nameids 中
        Harvester.addData(creep.name, this);
    }

    run() {
        if (HARVESTER_ENERGY_TYPE === this.type) {
            this.run_for_harvester_energy_type();
        }
    }

    run_for_harvester_energy_type() {
        const creep = this.self(); //i.e., this.creep()
        if (!creep) {
            return;
        }
        if (creep.store.getFreeCapacity() > 0) {
            // continue to find resource and do harvest（身上的容器未满则creep继续寻找资源并采集）
            const sources = creep.room.find(FIND_SOURCES_ACTIVE);
            if (sources.length > 0) {
                if (!creep.pos.isNearTo(sources[0])) {
                    creep.moveTo(sources[0]);
                } else {
                    creep.harvest(sources[0]);
                }
            }
        } else {
            // transfer resource the creep carry to spawn（否则creep将携带的资源转移给spawn）
            const spawns = creep.room.find(FIND_MY_SPAWNS);
            if (spawns.length > 0) {
                const spawn = getRandomItemFromObject(spawns); // get a random spawn
                if (!creep.pos.isNearTo(spawn)) {
                    creep.moveTo(spawn);
                } else {
                    creep.transfer(spawn, RESOURCE_ENERGY);
                }
            }
        }
    }

    is_alive() {
        return (Game.creeps.hasOwnProperty(this.name) && ((this.id === undefined) || (this.id === Game.creeps[this.name].id)));
    }

    self() {
        if (this.is_alive()) {
            if (this.id === undefined) {
                Harvester.modifyDataProperty(this.name, 'id', Game.creeps[this.name].id);
            }
            return Game.creeps[this.name];
        }
        return null;
    }

    static get_alive_harvesters(type = null) {
        const harvesters = [];
        let harvester = null;
        for (const [name, obj] of Object.entries(Harvester.nameids)) {
            harvester = Harvester.getData(name);
            if (harvester.is_alive()) {
                if ((type === null) || (harvester.type === type)) {
                    harvesters.push(harvester);
                }
            } else {
                Harvester.removeData(name);
            }
        }
        return harvesters;
    }

    static is_registered(creep) { //判断一个creep是否已经做过Harvester化（即是否已经注册过）
        let harvester = null;
        for (const [name, obj] of Object.entries(Harvester.nameids)) {
            harvester = Harvester.getData(name);
            if (harvester.is_alive() && (creep.id === harvester.id)) {
                return true;
            }
        }
        return false;
    }

    static print_all_harvesters(type = null) {
        let i = 1;
        let harvester = null;
        for (const [name, obj] of Object.entries(Harvester.nameids)) {
            harvester = Harvester.getData(name);
            if ((type === null) || (obj.type === type)) {
                console.log(`harvester-${i}: name:${name}, type:${obj.type}, id:${obj.id}, is_alive:${harvester.is_alive()}`);
                i += 1;
            }
        }
    }

    static generate_harvesters() { //生成采集者的标准策略
        let creep_energy_type_num = 0;
        Harvester.get_alive_harvesters(HARVESTER_ENERGY_TYPE).forEach(harvester => {
            creep_energy_type_num += 1;
        })
        const spawns = Game.spawns['Spawn1'].room.find(FIND_MY_SPAWNS);
        if (spawns.length <= 0) {
            return;
        }
        const spawn = getRandomItemFromObject(spawns);
        let name = null;
        if (creep_energy_type_num < 3) { //如果存活的能量采集者数量<3，则需要创建，否则不创建
            name = `harvester_${Game.time}`;
            if (spawn.spawnCreep([WORK, CARRY, MOVE], name, {'memory': {'role': 'harvester'}}) == OK) {
                new Harvester(Game.creeps[name], HARVESTER_ENERGY_TYPE);
            }
        }
    }
}

module.exports = {
    getRandomItemFromObject, 
    Harvester, HARVESTER_ENERGY_TYPE
};