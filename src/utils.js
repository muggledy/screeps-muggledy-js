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
roleTypes.HARVESTER_TYPE_CONSTRUCT_DEFENSIVE_BUILDING = 4;

const roleStates = {};
roleStates.HARVESTER_HARVESTING = 0x00000001;
roleStates.HARVESTER_BUILDING_SPAWN = 0x00000002;
roleStates.HARVESTER_SUPPLYING_SPAWN = 0x00000004;
roleStates.HARVESTER_SUPPLYING_CONTROL = 0x00000008;
roleStates.HARVESTER_BUILDING_WALL = 0x00000010;
roleStates.HARVESTER_REPAIRING_WALL = 0x00000020;

let g_supply_spawn_firstly = false; //一旦为true，所有creeps全部将能量优先输送给spawn

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
    if (TST_FLAG(tmp, 'state', roleStates.HARVESTER_BUILDING_WALL)) {
        states_str.push('BW');
    }
    if (TST_FLAG(tmp, 'state', roleStates.HARVESTER_REPAIRING_WALL)) {
        states_str.push('RW');
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
    const spawn = get_spawn(creep.room, null);
    if (!spawn) {
        return;
    }
    //1.在Swpan1周围创建扩展建筑工地
    const poss = getSpawnSurroundingPositions(spawn); //可供建筑的位置信息
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
        const [totalCurrentEnergy, totalMaxEnergy] = get_room_spawn_energy_statistic(creep.room);
        if (totalCurrentEnergy >= totalMaxEnergy) {
            const site = extensionConstructionSites[0];
            SET_FLAG(creep.memory, 'role_state', roleStates.HARVESTER_BUILDING_SPAWN);
            if (roleTypes.HARVESTER_TYPE_SUPPLY_ENERGY_FOR_SPAWN == creep.memory.role) {
                console.log(`${creep.name} build spawn extension ${site.pos}`);
            }
            if(creep.build(site) == ERR_NOT_IN_RANGE) {
                creep.moveTo(site, {visualizePathStyle: {stroke: '#ffffff'}});
            }
            return;
        } //否则（即已存储能量小于容器总大小，说明存在spawn扩展还没有填充满能量，因为走到这里必然是spawn本体已经填充满了），先去给已建造好的spawn扩展填充能量，之后再去建造更多的spawn扩展
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
        if (roleTypes.HARVESTER_TYPE_SUPPLY_ENERGY_FOR_SPAWN == creep.memory.role) {
            console.log(`${creep.name} supply energy to spawn extension ${extensionSites[0].pos}`);
        }
        if(creep.transfer(extensionSites[0], RESOURCE_ENERGY) == ERR_NOT_IN_RANGE) {
            creep.moveTo(extensionSites[0], {visualizePathStyle: {stroke: '#ffffff'}});
        }
        return;
    }
    //4.如果当前spawn以及spawn扩展全部填满了能量，即以上步骤2、3逻辑都未走进去，总不能闲着不动吧，那就临时转去向房间控制器输送能量吧
    SET_FLAG(creep.memory, 'role_state', roleStates.HARVESTER_SUPPLYING_CONTROL);
    if (roleTypes.HARVESTER_TYPE_SUPPLY_ENERGY_FOR_SPAWN == creep.memory.role) {
        console.log(`${creep.name} supply energy to room control temporarily`);
    }
    if(creep.upgradeController(creep.room.controller) == ERR_NOT_IN_RANGE) {
        creep.moveTo(creep.room.controller, {visualizePathStyle: {stroke: '#ffffff'}});
    }
}

// 围绕 Spawn 生成带门的城墙建筑工地
function createWallConstructionSitesAroundSpawn(spawn, doorSide, sideLength) { // doorSide可以修改为 'top', 'bottom', 'left', 'right' 来改变门的位置
    const room = spawn.room;
    const spawnPos = spawn.pos;
    const doorWidth = 3;
    let create_success = false;

    // 遍历方形区域的坐标
    for (let x = spawnPos.x - sideLength / 2; x <= spawnPos.x + sideLength / 2; x++) {
        for (let y = spawnPos.y - sideLength / 2; y <= spawnPos.y + sideLength / 2; y++) {
            // 只处理方形的边缘
            if (x === spawnPos.x - sideLength / 2 || x === spawnPos.x + sideLength / 2 ||
                y === spawnPos.y - sideLength / 2 || y === spawnPos.y + sideLength / 2) {
                // 检查坐标是否在房间范围内
                if (x >= 0 && x < 50 && y >= 0 && y < 50) {
                    // 处理门的逻辑
                    let isDoorArea = false;
                    if (doorSide === 'bottom' && y === spawnPos.y + sideLength / 2) {
                        isDoorArea = x >= spawnPos.x - doorWidth / 2 && x <= spawnPos.x + doorWidth / 2;
                    } else if (doorSide === 'top' && y === spawnPos.y - sideLength / 2) {
                        isDoorArea = x >= spawnPos.x - doorWidth / 2 && x <= spawnPos.x + doorWidth / 2;
                    } else if (doorSide === 'left' && x === spawnPos.x - sideLength / 2) {
                        isDoorArea = y >= spawnPos.y - doorWidth / 2 && y <= spawnPos.y + doorWidth / 2;
                    } else if (doorSide === 'right' && x === spawnPos.x + sideLength / 2) {
                        isDoorArea = y >= spawnPos.y - doorWidth / 2 && y <= spawnPos.y + doorWidth / 2;
                    }

                    if (!isDoorArea) {
                        const newPos = new RoomPosition(x, y, room.name);
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
                            if (result.type === LOOK_CONSTRUCTION_SITES) {
                                isBuildable = false;
                                break;
                            }
                        }
                        if (isBuildable) {
                            if (room.createConstructionSite(newPos, STRUCTURE_WALL) == OK) {
                                create_success = true;
                            }
                        }
                    }
                }
            }
        }
    }
    return create_success;
}

function getSourceDirectionRelativeToWall(spawn, source) { //判断金矿在spawn的哪个方位
    const spawnPos = spawn.pos;
    const sourcePos = source.pos;

    // 计算城墙区域的边界
    const leftBoundary = spawnPos.x - 5;
    const rightBoundary = spawnPos.x + 5;
    const topBoundary = spawnPos.y - 5;
    const bottomBoundary = spawnPos.y + 5;

    if (sourcePos.y < topBoundary) {
        if ((sourcePos.x < leftBoundary) && ((leftBoundary - sourcePos.x) > (topBoundary - sourcePos.y))) {
            return 'left';
        } else if ((sourcePos.x > rightBoundary) && ((rightBoundary - sourcePos.x) > (topBoundary - sourcePos.y))) {
            return 'right';
        } else {
            return 'top';
        }
    } else if (sourcePos.y > bottomBoundary) {
        if ((sourcePos.x < leftBoundary) && ((leftBoundary - sourcePos.x) > (sourcePos.y - bottomBoundary))) {
            return 'left';
        } else if ((sourcePos.x > rightBoundary) && ((rightBoundary - sourcePos.x) > (sourcePos.y - bottomBoundary))) {
            return 'right';
        } else {
            return 'bottom';
        }
    } else if (sourcePos.x < leftBoundary) {
        if ((sourcePos.y < topBoundary) && ((topBoundary - sourcePos.y) > (leftBoundary - sourcePos.x))) {
            return 'top';
        } else if ((sourcePos.y > bottomBoundary) && ((sourcePos.y - bottomBoundary) > (leftBoundary - sourcePos.x))) {
            return 'bottom';
        } else {
            return 'left';
        }
    } else if (sourcePos.x > rightBoundary) {
        if ((sourcePos.y < topBoundary) && ((topBoundary - sourcePos.y) > (sourcePos.x - rightBoundary))) {
            return 'top';
        } else if ((sourcePos.y > bottomBoundary) && ((sourcePos.y - bottomBoundary) > (sourcePos.x - rightBoundary))) {
            return 'bottom';
        } else {
            return 'right';
        }
    } else {
        return 'inside'; // 金矿在城墙区域内部
    }
}

function getReverseDirection(direction) {
    if (direction == 'top') {
        return 'bottom';
    } else if (direction == 'bottom') {
        return 'top';
    } else if (direction == 'left') {
        return 'right';
    } else if (direction == 'right') {
        return 'left';
    } else {
        return 'top';
    }
}

function build_defense_wall_for_spawn(creep) {
    const spawn = get_spawn(creep.room, null);
    if (!spawn) {
        return;
    }
    let sources = undefined;
    let direction = undefined;
    //1.在Swpan1周围创建扩展建筑工地
    if ((spawn.memory.wall0_flag === undefined) || (spawn.memory.wall0_flag < 1)) {
        sources = creep.room.find(FIND_SOURCES_ACTIVE);
        direction = 'right';
        if (sources.length > 0) {
            direction = getSourceDirectionRelativeToWall(spawn, sources[0]);
            if (direction == 'inside') {
                direction = getRandomItemFromObject(['top','bottom','left','right']);
            }
        }
        if (createWallConstructionSitesAroundSpawn(spawn, direction, 8)) { //金矿在spawn的哪个方位，就在哪个方位开城门
            spawn.memory.wall0_flag = 1; //表示spawn的城墙0已创建好工地
        }
    }
    if ((spawn.memory.wall1_flag === undefined) || (spawn.memory.wall1_flag < 1)) {
        sources = creep.room.find(FIND_SOURCES_ACTIVE);
        direction = 'right';
        if (sources.length > 0) {
            direction = getSourceDirectionRelativeToWall(spawn, sources[0]);
            if (direction == 'inside') {
                direction = getRandomItemFromObject(['top','bottom','left','right']);
            }
            //direction = getReverseDirection(direction);
        }
        if (createWallConstructionSitesAroundSpawn(spawn, direction, 14)) { //金矿在spawn的哪个方位，就在哪个方位开城门
            spawn.memory.wall1_flag = 1; //表示spawn的城墙0已创建好工地
        }
    }
    //if (spawn.memory.wall0_flag < 2) {
        //2.找到(过滤出)已存在的且!(structure属性存在且建筑的 hits 是否等于 hitsMax)（表示扩展建筑尚未build建造完成）的城墙建筑工地，继续建造
        const constructionSites = creep.room.find(FIND_CONSTRUCTION_SITES).filter((site) => {
            const structure = site.structure;
            if (site.structureType === STRUCTURE_WALL) {
                if (!(structure && (structure.hits === structure.hitsMax))) {
                    return true;
                }
            }
            return false;
        });
        if (constructionSites.length > 0) {
            SET_FLAG(creep.memory, 'role_state', roleStates.HARVESTER_BUILDING_WALL);
            console.log(`${creep.name} build wall ${constructionSites[0].pos}`);
            if (creep.build(constructionSites[0]) === ERR_NOT_IN_RANGE) {
                creep.moveTo(constructionSites[0], { visualizePathStyle: { stroke: '#ffffff' } });
            }
            return;
        }
    //}
    //spawn.memory.wall0_flag = 2; //表示spawn的城墙0已建造完毕
    //3.修理城墙，提升耐久值
    // 查找需要修理的城墙
    let walls = creep.room.find(FIND_STRUCTURES, {
        filter: (structure) => structure.structureType === STRUCTURE_WALL && structure.hits < structure.hitsMax
    });
    walls = sorted(walls, (obj) => (-obj.hits)); //以期找到耐久值最低的城墙优先进行repair，防止长时间陷入只对一个城墙进行repair的不公平情况
    // 执行修理
    if (walls.length > 0) {
        SET_FLAG(creep.memory, 'role_state', roleStates.HARVESTER_REPAIRING_WALL);
        console.log(`${creep.name} repair wall ${walls[0].pos}`);
        if (creep.repair(walls[0]) === ERR_NOT_IN_RANGE) {
            creep.moveTo(walls[0], { visualizePathStyle: { stroke: '#ffffff' } });
        }
        return;
    }
    //4.如果城墙建造完毕也没有要维修的城墙，总不能闲着不动吧，那就临时转去向房间控制器输送能量吧
    SET_FLAG(creep.memory, 'role_state', roleStates.HARVESTER_SUPPLYING_CONTROL);
    console.log(`${creep.name} supply energy to room control temporarily`);
    if(creep.upgradeController(creep.room.controller) == ERR_NOT_IN_RANGE) {
        creep.moveTo(creep.room.controller, {visualizePathStyle: {stroke: '#ffffff'}});
    }
}

function supply_energy_to_spawn(creep) {
    const spawns = creep.room.find(FIND_MY_SPAWNS);
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

function get_room() {
    for (const roomName in Game.rooms) {
        const room = Game.rooms[roomName];
        return room;
    }
    return undefined;
}

function get_spawn(room, filter) {
    const spawns = room.find(FIND_MY_SPAWNS);

    if (spawns.length > 0) {
        if (filter == 'all') {
            return spawns;
        }
        for (const spawn of spawns) {
            return spawn;
        }
    }
    return undefined;
}

function get_room_spawn_energy_statistic(room) {
    let totalCurrentEnergy = 0;
    let totalMaxEnergy = 0;

    // 统计 Spawn 的能量
    const spawns = room.find(FIND_MY_SPAWNS);
    for (const spawn of spawns) {
        totalCurrentEnergy += spawn.energy;
        totalMaxEnergy += spawn.energyCapacity;
    }

    // 统计扩展的能量
    const extensions = room.find(FIND_MY_STRUCTURES, {
        filter: (structure) => structure.structureType === STRUCTURE_EXTENSION
    });
    for (const extension of extensions) {
        totalCurrentEnergy += extension.energy;
        totalMaxEnergy += extension.energyCapacity;
    }
    return [totalCurrentEnergy, totalMaxEnergy];
}

function isSpawnAndExtensionsEnergyHalfFull(room) { //如果房间内spawn中已存储能量超过总容量的1/2，则返回true
    const [totalCurrentEnergy, totalMaxEnergy] = get_room_spawn_energy_statistic(room);
    if (((room.memory.current_phase == undefined) || (room.memory.current_phase < 1)) && (totalMaxEnergy >= 450)) {
        room.memory.current_phase = 1;
    }
    console.log(`(${room.name}) current energy: ${totalCurrentEnergy}, max capacity: ${totalMaxEnergy}`);
    if (totalCurrentEnergy < 300) {
        return false;
    }
    return totalCurrentEnergy >= (totalMaxEnergy * (17/20));
}

function simpleAdditiveHash(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        hash += str.charCodeAt(i);
    }
    return hash;
}

function hash_str_to_num(str, range) { //range n means hash to [0, n-1]
    const hash = simpleAdditiveHash(str);
    return hash % range;
}

function findSafeSources(room) {
    const activeSources = room.find(FIND_SOURCES_ACTIVE);

    room.memory.safeSourceIDList = [];
    if (room.memory.unsafeSourceIDList == undefined) {
        room.memory.unsafeSourceIDList = []; //具有潜在危险的金矿集合，即使后续发现危险取消，但仍认为具有潜在危险，不会从该列表中移除
    }
    for (const source of activeSources) {
        const nearbyHostileCreeps = source.pos.findInRange(FIND_HOSTILE_CREEPS, 3);
        if (nearbyHostileCreeps.length === 0) {
            room.memory.safeSourceIDList.push(source.id);
        } else {
            console.log(`warn: ${source} at ${source.pos} is unsafe`);
            if (!room.memory.unsafeSourceIDList.includes(source.id)) {
                room.memory.unsafeSourceIDList.push(source.id);
            }
        }
    }
}

function getSafeSourcesListFromRoomMemory(room) {
    const sources = [];
    if (room.memory.current_phase == undefined) {
        room.memory.current_phase = 0;
    }
    if (room.memory.unsafeSourceIDList == undefined) {
        room.memory.unsafeSourceIDList = [];
    }
    for (const id of room.memory.safeSourceIDList) {
        if (room.memory.current_phase < 2) { //在游戏前期阶段，禁止采集具有潜在危险的金矿，因为一旦creep被守卫杀死，重新创建消耗的能量太大了，得不偿失
            if (!room.memory.unsafeSourceIDList.includes(id)) {
                sources.push(Game.getObjectById(id));
            }
        } else { //游戏的高级阶段，才允许采集那些具有潜在危险的金矿
            sources.push(Game.getObjectById(id));
        }
    }
    return sources;
}

function detectSafeSourcesPeriodicly() { //定期检测房间内的安全的金矿资源，只有这些安全的金矿才能进行采集，否则creep靠近会被守卫杀死
    if (((Game.time % 30) == 0) || (Game.time < 10)) {
        for (const roomName in Game.rooms) {
            findSafeSources(Game.rooms[roomName]);
            console.log(`safe sources: ${getSafeSourcesListFromRoomMemory(Game.rooms[roomName]).map(obj => obj.pos)}`);
        }
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
        } else if (roleTypes.HARVESTER_TYPE_CONSTRUCT_DEFENSIVE_BUILDING == this.type) {
            this.run_for_harvester_construct_defensive_building_type();
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
            let sources = undefined;
            if ((creep.room.memory.safeSourceList !== undefined) && (creep.room.memory.safeSourceList.length > 0)) {
                sources = getSafeSourcesListFromRoomMemory(creep.room);
            } else {
                sources = creep.room.find(FIND_SOURCES_ACTIVE);
            }
            if (sources.length > 0) {
                const index = hash_str_to_num(creep.name, sources.length); //不同的creep根据其名字哈希开来分别去采集不同的金矿，否则扎堆效率很低
                if (!creep.pos.isNearTo(sources[index])) {
                    creep.moveTo(sources[index], {visualizePathStyle: {stroke: '#ffaa00'}});
                } else {
                    creep.harvest(sources[index]);
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
        CLR_FLAG(creep.memory, 'role_state', roleStates.HARVESTER_SUPPLYING_SPAWN);
        CLR_FLAG(creep.memory, 'role_state', roleStates.HARVESTER_BUILDING_SPAWN);
        //creep如果身上一点能量都没有了，就去矿场采集能量，身上满了之后，就输送给房间控制器
        if (!TST_FLAG(creep.memory, 'role_state', roleStates.HARVESTER_HARVESTING) && (creep.store[RESOURCE_ENERGY] == 0)) {
            SET_FLAG(creep.memory, 'role_state', roleStates.HARVESTER_HARVESTING);
        }
        if (TST_FLAG(creep.memory, 'role_state', roleStates.HARVESTER_HARVESTING) && (creep.store.getFreeCapacity() <= 0)) {
            CLR_FLAG(creep.memory, 'role_state', roleStates.HARVESTER_HARVESTING);
        }
        if (TST_FLAG(creep.memory, 'role_state', roleStates.HARVESTER_HARVESTING)) {
            let sources = undefined;
            if ((creep.room.memory.safeSourceList !== undefined) && (creep.room.memory.safeSourceList.length > 0)) {
                sources = getSafeSourcesListFromRoomMemory(creep.room);
            } else {
                sources = creep.room.find(FIND_SOURCES_ACTIVE);
            }
            if (sources.length > 0) {
                const index = hash_str_to_num(creep.name, sources.length);
                if(creep.harvest(sources[index]) == ERR_NOT_IN_RANGE) {
                    creep.moveTo(sources[index], {visualizePathStyle: {stroke: '#ffaa00'}});
                }
            }
        } else {
            if (g_supply_spawn_firstly) {
                console.log(`${creep.name} supply energy to spawn temporarily`);
                supply_energy_to_spawn(creep);
                return;
            }
            SET_FLAG(creep.memory, 'role_state', roleStates.HARVESTER_SUPPLYING_CONTROL);
            if(creep.upgradeController(creep.room.controller) == ERR_NOT_IN_RANGE) {
                creep.moveTo(creep.room.controller, {visualizePathStyle: {stroke: '#ffffff'}});
            }
        }
    }

    run_for_harvester_construct_defensive_building_type() {
        const creep = this.self(); //i.e., this.creep()
        if (!creep) {
            return;
        }
        CLR_FLAG(creep.memory, 'role_state', roleStates.HARVESTER_BUILDING_WALL);
        CLR_FLAG(creep.memory, 'role_state', roleStates.HARVESTER_REPAIRING_WALL);
        CLR_FLAG(creep.memory, 'role_state', roleStates.HARVESTER_SUPPLYING_CONTROL);
        CLR_FLAG(creep.memory, 'role_state', roleStates.HARVESTER_SUPPLYING_SPAWN);
        CLR_FLAG(creep.memory, 'role_state', roleStates.HARVESTER_BUILDING_SPAWN);
        if (!TST_FLAG(creep.memory, 'role_state', roleStates.HARVESTER_HARVESTING) && (creep.store[RESOURCE_ENERGY] == 0)) {
            SET_FLAG(creep.memory, 'role_state', roleStates.HARVESTER_HARVESTING);
        }
        if (TST_FLAG(creep.memory, 'role_state', roleStates.HARVESTER_HARVESTING) && (creep.store.getFreeCapacity() <= 0)) {
            CLR_FLAG(creep.memory, 'role_state', roleStates.HARVESTER_HARVESTING);
        }
        if (TST_FLAG(creep.memory, 'role_state', roleStates.HARVESTER_HARVESTING)) {
            let sources = undefined;
            if ((creep.room.memory.safeSourceList !== undefined) && (creep.room.memory.safeSourceList.length > 0)) {
                sources = getSafeSourcesListFromRoomMemory(creep.room);
            } else {
                sources = creep.room.find(FIND_SOURCES_ACTIVE);
            }
            if (sources.length > 0) {
                const index = hash_str_to_num(creep.name, sources.length);
                if(creep.harvest(sources[index]) == ERR_NOT_IN_RANGE) {
                    creep.moveTo(sources[index], {visualizePathStyle: {stroke: '#ffaa00'}});
                }
            }
        } else {
            if (g_supply_spawn_firstly) { //确保采集能量供养spawn的存在性
                console.log(`${creep.name} supply energy to spawn temporarily`);
                supply_energy_to_spawn(creep);
                return;
            }
            build_defense_wall_for_spawn(creep);
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
        //let num = 0;
        for (const [name, obj] of Object.entries(Harvester.nameids)) {
            //num += 1;
            harvester = Harvester.getData(name);
            if (harvester && harvester.is_alive()) {
                if ((type === null) || (harvester.type === type)) {
                    harvesters.push(harvester);
                }
            } else {
                Harvester.removeData(name);
            }
        }
        //console.log(`Memory.harvesterNameIds: ${num}`);
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
                console.log(`harvester-${i}: name:${name}, type:${obj.type}, id:${obj.id}, is_alive:${harvester.is_alive()}, `+
                `role_state:${print_role_state(harvester.self().memory.role_state)}`);
                i += 1;
            }
        }
    }

    static generate_harvesters() { //生成各种类型采集者的策略模板
        let harvester_energy_supply_spawn_type_num = 0;
        let harvester_energy_supply_controller_type_num = 0;
        let harvester_construct_defensive_building_type_num = 0;
        Harvester.get_alive_harvesters().forEach(harvester => {
            if (roleTypes.HARVESTER_TYPE_SUPPLY_ENERGY_FOR_SPAWN == harvester.type) {
                harvester_energy_supply_spawn_type_num += 1;
            } else if (roleTypes.HARVESTER_TYPE_SUPPLY_ENERGY_FOR_CONTROLLER == harvester.type) {
                harvester_energy_supply_controller_type_num += 1;
            } else if (roleTypes.HARVESTER_TYPE_CONSTRUCT_DEFENSIVE_BUILDING == harvester.type) {
                harvester_construct_defensive_building_type_num += 1;
            }
        })
        const room = get_room();
        if (!room) {
            console.log("Error: no room exist");
            return;
        }
        const spawns = get_spawn(room, 'all');
        if (!spawns) {
            console.log(`Error: can't find any spawn in room ${room.name}`);
            return;
        }
        if (room.memory.current_phase == undefined) {
            room.memory.current_phase = 0;
        }
        const spawn = sorted(spawns, (obj) => obj.energy)[0]; //getRandomItemFromObject(spawns);
        console.log(`[2025.3.26] room: ${room.name}, phase: ${room.memory.current_phase}, current max spawn: ${spawn.name}, `+
            `harvesters: ${harvester_energy_supply_spawn_type_num}+`+
            `${harvester_energy_supply_controller_type_num}+${harvester_construct_defensive_building_type_num}=`+
            `${harvester_energy_supply_spawn_type_num+harvester_energy_supply_controller_type_num+harvester_construct_defensive_building_type_num}`);
        let name = null;
        let body = null;
        if (harvester_energy_supply_spawn_type_num < 6) { //如果存活的能量采集者数量<6，则需要创建，否则不创建
            g_supply_spawn_firstly = true;
            name = `harvester_t${roleTypes.HARVESTER_TYPE_SUPPLY_ENERGY_FOR_SPAWN}_${Game.time}`;
            if (room.memory.current_phase < 1) {
                body = [WORK, CARRY, MOVE];
            } else if (room.memory.current_phase < 2) { //当前游戏阶段，当spawn总容量达到450，进入阶段1，就可以建造具有更庞大身体部件的creeps了，譬如更多的CARRY或WORK部件
                body = [WORK, CARRY, CARRY, CARRY, MOVE, MOVE];
            }
            if (spawn.spawnCreep(body, name, {'memory': {'role': roleTypes.HARVESTER_TYPE_SUPPLY_ENERGY_FOR_SPAWN}}) == OK) {
                new Harvester(Game.creeps[name], roleTypes.HARVESTER_TYPE_SUPPLY_ENERGY_FOR_SPAWN); //注意母巢刚创建creep时，这里creep.id还是undefined的
            }
            return; //spawn存储的能量优先用于造出指定数量的能量采集者
        }
        if (!isSpawnAndExtensionsEnergyHalfFull(room)) {
            g_supply_spawn_firstly = true;
        } else {
            g_supply_spawn_firstly = false;
        }
        if (harvester_energy_supply_controller_type_num < 4) {
            name = `harvester_t${roleTypes.HARVESTER_TYPE_SUPPLY_ENERGY_FOR_CONTROLLER}_${Game.time}`;
            if (room.memory.current_phase < 1) {
                body = [WORK, CARRY, MOVE];
            } else if (room.memory.current_phase < 2) {
                body = [WORK, CARRY, MOVE];
            }
            if (spawn.spawnCreep(body, name, {'memory': {'role': roleTypes.HARVESTER_TYPE_SUPPLY_ENERGY_FOR_CONTROLLER}}) == OK) {
                new Harvester(Game.creeps[name], roleTypes.HARVESTER_TYPE_SUPPLY_ENERGY_FOR_CONTROLLER);
            }
        }
        if (harvester_construct_defensive_building_type_num < 4) { //创建修筑(及维修)防御工事工人
            name = `harvester_t${roleTypes.HARVESTER_TYPE_CONSTRUCT_DEFENSIVE_BUILDING}_${Game.time}`;
            if (room.memory.current_phase < 1) {
                body = [WORK, CARRY, MOVE];
            } else if (room.memory.current_phase < 2) {
                body = [WORK, WORK, CARRY, MOVE];
            }
            if (spawn.spawnCreep(body, name, {'memory': {'role': roleTypes.HARVESTER_TYPE_CONSTRUCT_DEFENSIVE_BUILDING}}) == OK) {
                new Harvester(Game.creeps[name], roleTypes.HARVESTER_TYPE_CONSTRUCT_DEFENSIVE_BUILDING);
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
                } else if (roleTypes.HARVESTER_TYPE_CONSTRUCT_DEFENSIVE_BUILDING == creep.memory.role) {
                    new Harvester(creep, roleTypes.HARVESTER_TYPE_CONSTRUCT_DEFENSIVE_BUILDING);
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
    Harvester, detectSafeSourcesPeriodicly
};