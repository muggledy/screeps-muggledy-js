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

function sorted(list, key) {
    return list.slice().sort((a, b) => {
        const valueA = key(a);
        const valueB = key(b);
        return valueB - valueA;
    });
}

function sum(list, key) {
    return list.reduce((acc, item) => {
        return acc + key(item);
    }, 0);
}

// 定义角色细分类型常量
const roleTypes = {};
roleTypes.HARVESTER_TYPE_SUPPLY_ENERGY_FOR_SPAWN = 1;
roleTypes.HARVESTER_TYPE_SUPPLY_ENERGY_FOR_CONTROLLER = 2;
roleTypes.DESTINY_CHILD = 3;

const roleStates = {};
roleStates.HARVESTER_HARVESTING = 0x00000001;
roleStates.HARVESTER_BUILDING_SPAWN = 0x00000002;
roleStates.HARVESTER_SUPPLYING_SPAWN = 0x00000004;
roleStates.HARVESTER_SUPPLYING_CONTROL = 0x00000008;

// 设置标志
function SET_FLAG(obj, property, flag) {
    if (!obj.hasOwnProperty(property)) {
        obj[property] = 0;
    }
    obj[property] |= flag;
    return obj;
}

// 判断标志
function TST_FLAG(obj, property, flag) {
    if (!obj.hasOwnProperty(property)) {
        return false;
    }
    return (obj[property] & flag) === flag;
}

// 取消标志
function CLR_FLAG(obj, property, flag) {
    if (!obj.hasOwnProperty(property)) {
        return obj;
    }
    obj[property] &= ~flag;
    return obj;
}

function print_role_state(state) {
    const tmp = {};
    tmp.state = state;
    const states_str = [];
    if (TST_FLAG(tmp, 'state', roleStates.HARVESTER_HARVESTING)) {
        states_str.push('H');
    }
    if (TST_FLAG(tmp, 'state', roleStates.HARVESTER_BUILDING_SPAWN)) {
        states_str.push('BS');
    }
    if (TST_FLAG(tmp, 'state', roleStates.HARVESTER_SUPPLYING_SPAWN)) {
        states_str.push('SS');
    }
    if (TST_FLAG(tmp, 'state', roleStates.HARVESTER_SUPPLYING_CONTROL)) {
        states_str.push('SC');
    }
    return states_str.join('.');
}

function getSpawnSurroundingPositions(spawn) {
    const positions = [];
    const spawnPos = spawn.pos;

    // 遍历 Spawn 周围的坐标
    for (let dx = -1; dx <= 1; dx++) {
        for (let dy = -1; dy <= 1; dy++) {
            // 排除 Spawn 自身的坐标
            if (dx === 0 && dy === 0) continue;

            const newX = spawnPos.x + dx;
            const newY = spawnPos.y + dy;

            // 检查坐标是否在房间范围内
            if (newX >= 0 && newX < 50 && newY >= 0 && newY < 50) {
                const newPos = new RoomPosition(newX, newY, spawnPos.roomName);

                // 检查该位置是否可通行且没有其他建筑和建筑工地
                const lookResults = newPos.look();
                let isBuildable = true;
                for (const result of lookResults) {
                    if (result.type === LOOK_TERRAIN && result.terrain === 'wall') {
                        isBuildable = false;
                        break;
                    }
                    if (result.type === LOOK_STRUCTURES) {
                        isBuildable = false;
                        break;
                    }
                    // 增加对建筑工地的检查
                    if (result.type === LOOK_CONSTRUCTION_SITES) {
                        isBuildable = false;
                        break;
                    }
                }

                if (isBuildable) {
                    positions.push(newPos);
                }
            }
        }
    }

    return positions;
}

function build_and_supply_energy_for_spawn_extension(creep) { //建造spawn扩展、以及填充能量
    //1.在Swpan1周围创建扩展建筑工地
    const poss = getSpawnSurroundingPositions(Game.spawns['Spawn1']); //可供建筑的位置信息
    if (poss.length > 0) {
        creep.room.createConstructionSite(poss[0], STRUCTURE_EXTENSION); //可能会因为控制器等级不够无法创建太多spawn扩展工地
    }
    //2.找到(过滤出)已存在的且!(structure属性存在且建筑的 hits 是否等于 hitsMax)（表示扩展建筑尚未build建造完成）的spawn扩展建筑工地，继续建造
    const extensionConstructionSites = creep.room.find(FIND_CONSTRUCTION_SITES).filter((site) => {
        const structure = site.structure;
        if (site.structureType === STRUCTURE_EXTENSION) {
            if (!(structure && (structure.hits === structure.hitsMax))) {
                return true;
            }
        }
        return false;
    });
    if (extensionConstructionSites.length > 0) {
        const site = extensionConstructionSites[0];
        SET_FLAG(creep.memory, 'role_state', roleStates.HARVESTER_BUILDING_SPAWN);
        console.log(`${creep.name} build spawn extension ${site.pos}`);
        if(creep.build(site) == ERR_NOT_IN_RANGE) {
            creep.moveTo(site, {visualizePathStyle: {stroke: '#ffffff'}});
        }
        return;
    }
    //3.（针对步骤2）否则（所有工地都已完工的话）找到需要输送能量的spawn扩展建筑并向其转移能量
    const extensionSites = creep.room.find(FIND_STRUCTURES, {
        filter: (site) => {
            return (site.structureType == STRUCTURE_EXTENSION) &&
                site.store.getFreeCapacity(RESOURCE_ENERGY) > 0;
        }
    });
    if (extensionSites.length > 0) {
        SET_FLAG(creep.memory, 'role_state', roleStates.HARVESTER_SUPPLYING_SPAWN);
        console.log(`${creep.name} supply energy to spawn extension ${extensionSites[0].pos}`);
        if(creep.transfer(extensionSites[0], RESOURCE_ENERGY) == ERR_NOT_IN_RANGE) {
            creep.moveTo(extensionSites[0], {visualizePathStyle: {stroke: '#ffffff'}});
        }
        return;
    }
    //4.如果当前spawn以及spawn扩展全部填满了能量，即以上步骤2、3逻辑都未走进去，总不能闲着不动吧，那就临时转去向房间控制器输送能量吧
    SET_FLAG(creep.memory, 'role_state', roleStates.HARVESTER_SUPPLYING_CONTROL);
    console.log(`${creep.name} supply energy to room control temporarily`);
    if(creep.upgradeController(creep.room.controller) == ERR_NOT_IN_RANGE) {
        creep.moveTo(creep.room.controller, {visualizePathStyle: {stroke: '#ffffff'}});
    }
}

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
        CLR_FLAG(creep.memory, 'role_state', roleStates.HARVESTER_BUILDING_SPAWN);
        CLR_FLAG(creep.memory, 'role_state', roleStates.HARVESTER_SUPPLYING_SPAWN);
        CLR_FLAG(creep.memory, 'role_state', roleStates.HARVESTER_SUPPLYING_CONTROL);
        if (!TST_FLAG(creep.memory, 'role_state', roleStates.HARVESTER_HARVESTING) && (creep.store[RESOURCE_ENERGY] == 0)) {
            SET_FLAG(creep.memory, 'role_state', roleStates.HARVESTER_HARVESTING);
        }
        if (TST_FLAG(creep.memory, 'role_state', roleStates.HARVESTER_HARVESTING) && (creep.store.getFreeCapacity() <= 0)) {
            CLR_FLAG(creep.memory, 'role_state', roleStates.HARVESTER_HARVESTING);
        }
        if (TST_FLAG(creep.memory, 'role_state', roleStates.HARVESTER_HARVESTING)) {
            // continue to find resource and do harvest（身上的容器未满则creep继续寻找资源并采集）
            const sources = creep.room.find(FIND_SOURCES_ACTIVE);
            if (sources.length > 0) {
                if (!creep.pos.isNearTo(sources[0])) {
                    creep.moveTo(sources[0], {visualizePathStyle: {stroke: '#ffaa00'}});
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
            /*const lowEnergySpawns = creep.room.find(FIND_MY_SPAWNS, {
                filter: (spawn) => {
                    return spawn.energy < spawn.energyCapacity / 2;
                }
            });*/
            let spawn = null;
            if (spawns.length > 0) {
                spawn = getRandomItemFromObject2(spawns, (_spawn) => {return (_spawn.energy < _spawn.energyCapacity)});
                if (spawn === undefined) { //所有spawn都填满能量了，就转而去建造spawn扩展，并往spawn扩展结构建筑中继续填充能量资源
                    //spawn = getRandomItemFromObject(spawns); // get a random spawn， i.e., getRandomItemFromObject2(spawns, null)
                    build_and_supply_energy_for_spawn_extension(creep);
                } else {
                    SET_FLAG(creep.memory, 'role_state', roleStates.HARVESTER_SUPPLYING_SPAWN);
                    if (!creep.pos.isNearTo(spawn)) {
                        creep.moveTo(spawn, {visualizePathStyle: {stroke: '#ffffff'}});
                    } else {
                        creep.transfer(spawn, RESOURCE_ENERGY);
                    }
                }
            }
        }
    }

    run_for_harvester_energy_supply_controller_type() {
        const creep = this.self(); //i.e., this.creep()
        if (!creep) {
            return;
        }
        CLR_FLAG(creep.memory, 'role_state', roleStates.HARVESTER_SUPPLYING_CONTROL);
        //creep如果身上一点能量都没有了，就去矿场采集能量，身上满了之后，就输送给房间控制器
        if (!TST_FLAG(creep.memory, 'role_state', roleStates.HARVESTER_HARVESTING) && (creep.store[RESOURCE_ENERGY] == 0)) {
            SET_FLAG(creep.memory, 'role_state', roleStates.HARVESTER_HARVESTING);
        }
        if (TST_FLAG(creep.memory, 'role_state', roleStates.HARVESTER_HARVESTING) && (creep.store.getFreeCapacity() <= 0)) {
            CLR_FLAG(creep.memory, 'role_state', roleStates.HARVESTER_HARVESTING);
        }
        if (TST_FLAG(creep.memory, 'role_state', roleStates.HARVESTER_HARVESTING)) {
            const sources = creep.room.find(FIND_SOURCES_ACTIVE);
            if (sources.length > 0) {
                if(creep.harvest(sources[0]) == ERR_NOT_IN_RANGE) {
                    creep.moveTo(sources[0], {visualizePathStyle: {stroke: '#ffaa00'}});
                }
            }
        } else {
            SET_FLAG(creep.memory, 'role_state', roleStates.HARVESTER_SUPPLYING_CONTROL);
            if(creep.upgradeController(creep.room.controller) == ERR_NOT_IN_RANGE) {
                creep.moveTo(creep.room.controller, {visualizePathStyle: {stroke: '#ffffff'}});
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
                console.log(`harvester-${i}: name:${name}, type:${obj.type}, id:${obj.id}, is_alive:${harvester.is_alive()}, role_state:${print_role_state(harvester.self().memory.role_state)}`);
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
        const spawn = sorted(spawns, (obj) => obj.energy)[0]; //getRandomItemFromObject(spawns);
        let name = null;
        if (harvester_energy_supply_spawn_type_num < 7) { //如果存活的能量采集者数量<3，则需要创建，否则不创建
            name = `harvester_t${roleTypes.HARVESTER_TYPE_SUPPLY_ENERGY_FOR_SPAWN}_${Game.time}`;
            if (spawn.spawnCreep([WORK, CARRY, MOVE], name, {'memory': {'role': roleTypes.HARVESTER_TYPE_SUPPLY_ENERGY_FOR_SPAWN}}) == OK) {
                new Harvester(Game.creeps[name], roleTypes.HARVESTER_TYPE_SUPPLY_ENERGY_FOR_SPAWN); //注意母巢刚创建creep时，这里creep.id还是undefined的
            }
            return;
        }
        if (harvester_energy_supply_controller_type_num < 3) {
            name = `harvester_t${roleTypes.HARVESTER_TYPE_SUPPLY_ENERGY_FOR_CONTROLLER}_${Game.time}`;
            if (spawn.spawnCreep([WORK, CARRY, MOVE], name, {'memory': {'role': roleTypes.HARVESTER_TYPE_SUPPLY_ENERGY_FOR_CONTROLLER}}) == OK) {
                new Harvester(Game.creeps[name], roleTypes.HARVESTER_TYPE_SUPPLY_ENERGY_FOR_CONTROLLER);
            }
        }
    }

    static do_register() {
        let destiny_child_num = 1;
        Object.entries(Game.creeps).forEach(([name, creep]) => {
            if (!Harvester.is_registered(creep)) {
                if (roleTypes.HARVESTER_TYPE_SUPPLY_ENERGY_FOR_SPAWN == creep.memory.role) {
                    new Harvester(creep, roleTypes.HARVESTER_TYPE_SUPPLY_ENERGY_FOR_SPAWN);
                } else if (roleTypes.HARVESTER_TYPE_SUPPLY_ENERGY_FOR_CONTROLLER == creep.memory.role) {
                    new Harvester(creep, roleTypes.HARVESTER_TYPE_SUPPLY_ENERGY_FOR_CONTROLLER);
                } else {
                    if (creep.memory.role == roleTypes.DESTINY_CHILD) { //Game.spawns['Spawn1'].spawnCreep([WORK, CARRY, MOVE], 'muggledy0', {'memory': {'role': 3}})
                        console.log(`destiny_child-${destiny_child_num}: ${creep.name}, room:${creep.room.name}`); //用于手动任务的执行，不纳入自动化脚本管理
                        destiny_child_num += 1;
                    } else {
                        new Harvester(creep, roleTypes.HARVESTER_TYPE_SUPPLY_ENERGY_FOR_SPAWN);
                    }
                }
            }
        })
    }
}

module.exports = {
    getRandomItemFromObject, getRandomItemFromObject2, 
    Harvester, roleTypes
};