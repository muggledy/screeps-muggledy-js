function getRandomItemFromObject(obj) {
    const values = Object.values(obj);
    const randomIndex = Math.floor(Math.random() * values.length);
    return values[randomIndex];
}

function getRandomItemFromObject2(obj, cmp) {
    // 获取对象的所有值
    const values = Object.values(obj);
    // 筛选出满足比较函数的项
    const filteredValues = values.filter((value) => {
        return cmp ? cmp(value) : true;
    });
    // 如果没有满足条件的项，返回 undefined
    if (filteredValues.length === 0) {
        return undefined;
    }
    // 生成一个随机索引
    const randomIndex = Math.floor(Math.random() * filteredValues.length);
    // 返回随机选择的满足条件的项
    return filteredValues[randomIndex];
}

// 定义角色细分类型常量
const roleTypes = {};
roleTypes.HARVESTER_TYPE_SUPPLY_ENERGY_FOR_SPAWN = 1;
roleTypes.HARVESTER_TYPE_SUPPLY_ENERGY_FOR_CONTROLLER = 2;

const roleStates = {};
roleStates.HARVESTER_HARVESTING = 1;
roleStates.HARVESTER_HARVEST_DONE = 2;

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
    具有两个好处，一是向Harvester管理机构进行了注册并且对其角色类型进行了精细的划分，也更方便在代码中管理这些不同类型的采集者，
    二是Harvester管理机构提供了标准的运行动作供采集者执行，对于细分类型HARVESTER_ENERGY_TYPE角色的采集者来说，其标准动作为：
    不断采集能量资源并搬运至母巢；
    可通过harvester.self()获取原始creep对象（如果creep对象已经消亡，则返回None）；可通过Harvester.get_alive_harvesters()
    获取所有注册了的且当前仍存活的harvester对象列表，如果type参数非None，则获取指定细分类型的harvester列表
    PS：后期军队的建设不会再采用该实现方式，说实话层次封装太冗余了
    */

    // 静态属性，用于存储已注册的 harvester 实例
    static get nameids() {
        // 检查 Memory 中是否已经存在该容器
        if (!Memory.harvesterNameIds) {
            Memory.harvesterNameIds = {}; //Memory持久化存储，但是存储的不是harvester本身，而是序列化后的普通object（即非Harvester实例）
        }
        return Memory.harvesterNameIds;
    }
    static nameids_non_persistent = {}; //非持久化存储、临时存储，存储harvester实例本身：{<name:harvester>,...}
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
        /*harvester.name = obj.name;
        harvester.type = obj.type;
        harvester.id = obj.id;*/
        for (const key in obj) {
            if (obj.hasOwnProperty(key)) {
                harvester[key] = obj[key];
            }
        }
        return harvester;
    }

    constructor(creep, type = roleTypes.HARVESTER_TYPE_SUPPLY_ENERGY_FOR_SPAWN) {
        // 检查是否已经存在该 creep 名字对应的实例
        if (Harvester.getData(creep.name)) {
            Harvester.modifyDataProperty(creep.name, 'name', creep.name);
            Harvester.modifyDataProperty(creep.name, 'type', type);
            Harvester.modifyDataProperty(creep.name, 'id', creep.id);
            return Harvester.getData(creep.name);
        }
        // 若不存在，则创建新harvester实例
        console.log(`create new harvester for new register one creep(${creep.name},type:${type},id:${creep.id})`);
        this.name = creep.name; //name, type, id是harvester的基础属性
        this.type = type;
        this.id = creep.id;
        // 将新实例存储到 nameids 中
        Harvester.addData(creep.name, this);
    }

    run() {
        if (roleTypes.HARVESTER_TYPE_SUPPLY_ENERGY_FOR_SPAWN === this.type) {
            this.run_for_harvester_energy_supply_spawn_type();
        } else if (roleTypes.HARVESTER_TYPE_SUPPLY_ENERGY_FOR_CONTROLLER == this.type) {
            this.run_for_harvester_energy_supply_controller_type();
        }
    }

    run_for_harvester_energy_supply_spawn_type() {
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
                /*i.e., if(creep.harvest(sources[0]) == ERR_NOT_IN_RANGE) {
                    creep.moveTo(sources[0]);
                }*/
            }
        } else {
            // transfer resource the creep carry to spawn（否则creep将携带的资源转移给spawn）
            const spawns = creep.room.find(FIND_MY_SPAWNS);
            let spawn = null;
            if (spawns.length > 0) {
                spawn = getRandomItemFromObject2(spawns, (_spawn) => {_spawn.energy < _spawn.energyCapacity});
                if (spawn === undefined) {
                    spawn = getRandomItemFromObject(spawns); // get a random spawn， i.e., getRandomItemFromObject2(spawns, null)
                }
                if (!creep.pos.isNearTo(spawn)) {
                    creep.moveTo(spawn);
                } else {
                    creep.transfer(spawn, RESOURCE_ENERGY);
                }
            }
        }
    }

    run_for_harvester_energy_supply_controller_type() {
        const creep = this.self(); //i.e., this.creep()
        if (!creep) {
            return;
        }
        if (creep.store.getFreeCapacity() <= 0) {
            creep.memory.role_state = roleStates.HARVESTER_HARVEST_DONE;
        }
        if ((creep.store[RESOURCE_ENERGY] == 0) || (roleStates.HARVESTER_HARVESTING == creep.memory.role_state)) {
            creep.memory.role_state = roleStates.HARVESTER_HARVESTING;
            const sources = creep.room.find(FIND_SOURCES_ACTIVE);
            if (sources.length > 0) {
                if(creep.harvest(sources[0]) == ERR_NOT_IN_RANGE) {
                    creep.moveTo(sources[0]);
                }
            }
        } else {
            if(creep.upgradeController(creep.room.controller) == ERR_NOT_IN_RANGE) {
                creep.moveTo(creep.room.controller);
            }
        }
    }

    is_alive() {
        const ret = (Game.creeps.hasOwnProperty(this.name) && ((this.id === undefined) || (this.id === Game.creeps[this.name].id)));
        if (ret && (this.id === undefined)) {
            Harvester.modifyDataProperty(this.name, 'id', Game.creeps[this.name].id);
        }
        return ret;
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
            if (harvester && harvester.is_alive()) {
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
            if (harvester && harvester.is_alive() && 
                    (((harvester.id === undefined) && (creep.name === harvester.name)) 
                    || ((harvester.id !== undefined) && (creep.id === harvester.id)))) {
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
            if (harvester && ((type === null) || (obj.type === type))) {
                console.log(`harvester-${i}: name:${name}, type:${obj.type}, id:${obj.id}, is_alive:${harvester.is_alive()}`);
                i += 1;
            }
        }
    }

    static generate_harvesters() { //生成各种类型采集者的策略模板
        let harvester_energy_supply_spawn_type_num = 0;
        let harvester_energy_supply_controller_type_num = 0;
        Harvester.get_alive_harvesters().forEach(harvester => {
            if (roleTypes.HARVESTER_TYPE_SUPPLY_ENERGY_FOR_SPAWN == harvester.type) {
                harvester_energy_supply_spawn_type_num += 1;
            } else if (roleTypes.HARVESTER_TYPE_SUPPLY_ENERGY_FOR_CONTROLLER == harvester.type) {
                harvester_energy_supply_controller_type_num += 1;
            }
        })
        const spawns = Game.spawns['Spawn1'].room.find(FIND_MY_SPAWNS);
        if (spawns.length <= 0) {
            return;
        }
        const spawn = getRandomItemFromObject(spawns);
        let name = null;
        if (harvester_energy_supply_spawn_type_num < 3) { //如果存活的能量采集者数量<3，则需要创建，否则不创建
            name = `harvester_t${roleTypes.HARVESTER_TYPE_SUPPLY_ENERGY_FOR_SPAWN}_${Game.time}`;
            if (spawn.spawnCreep([WORK, CARRY, MOVE], name, {'memory': {'role': roleTypes.HARVESTER_TYPE_SUPPLY_ENERGY_FOR_SPAWN}}) == OK) {
                new Harvester(Game.creeps[name], roleTypes.HARVESTER_TYPE_SUPPLY_ENERGY_FOR_SPAWN); //注意母巢刚创建creep时，这里creep.id还是undefined的
            }
        }
        if (harvester_energy_supply_controller_type_num < 2) {
            name = `harvester_t${roleTypes.HARVESTER_TYPE_SUPPLY_ENERGY_FOR_CONTROLLER}_${Game.time}`;
            if (spawn.spawnCreep([WORK, CARRY, MOVE], name, {'memory': {'role': roleTypes.HARVESTER_TYPE_SUPPLY_ENERGY_FOR_CONTROLLER}}) == OK) {
                new Harvester(Game.creeps[name], roleTypes.HARVESTER_TYPE_SUPPLY_ENERGY_FOR_CONTROLLER);
            }
        }
    }

    static do_register() {
        Object.entries(Game.creeps).forEach(([name, creep]) => {
            if (!Harvester.is_registered(creep)) {
                if (roleTypes.HARVESTER_TYPE_SUPPLY_ENERGY_FOR_SPAWN == creep.memory.role) {
                    new Harvester(creep, roleTypes.HARVESTER_TYPE_SUPPLY_ENERGY_FOR_SPAWN);
                } else if (roleTypes.HARVESTER_TYPE_SUPPLY_ENERGY_FOR_CONTROLLER == creep.memory.role) {
                    new Harvester(creep, roleTypes.HARVESTER_TYPE_SUPPLY_ENERGY_FOR_CONTROLLER);
                } else {
                    new Harvester(creep, roleTypes.HARVESTER_TYPE_SUPPLY_ENERGY_FOR_SPAWN);
                }
            }
        })
    }
}

module.exports = {
    getRandomItemFromObject, getRandomItemFromObject2, 
    Harvester, roleTypes
};