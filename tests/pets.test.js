import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TILE_SIZE, PET_TYPES, TILE_TYPES, SCOUT_MARK_TYPES, MAX_PETS } from '../src/game/constants.js';
import { PetBase } from '../src/game/pet/PetBase.js';
import { ScoutPet } from '../src/game/pet/ScoutPet.js';
import { MagnetPet } from '../src/game/pet/MagnetPet.js';
import { DefenderPet } from '../src/game/pet/DefenderPet.js';
import { PetManager, createPetByType, deserializePet } from '../src/game/pet/PetManager.js';

function createMockWorld(ores = []) {
  const tiles = {};
  const tileHealth = {};
  const dugTiles = {};

  for (const o of ores) {
    const key = `${o.x},${o.y}`;
    tiles[key] = o.tile;
    tileHealth[key] = 100;
    dugTiles[key] = 0;
  }

  return {
    inBounds: (x, y) => x >= 0 && x < 200 && y >= 0 && y < 500,
    getTile: (x, y) => tiles[`${x},${y}`] || TILE_TYPES.STONE,
    isSolid: (x, y) => {
      const t = tiles[`${x},${y}`];
      return t !== undefined && t !== TILE_TYPES.EMPTY && t !== TILE_TYPES.CAVE;
    },
    getIndex: (x, y) => y * 200 + x,
    tiles: new Proxy({}, {
      get: (_, prop) => {
        if (typeof prop === 'string' && !isNaN(prop)) {
          const idx = parseInt(prop);
          const y = Math.floor(idx / 200);
          const x = idx % 200;
          const key = `${x},${y}`;
          if (tiles[key] !== undefined) return tiles[key];
          return TILE_TYPES.STONE;
        }
        return undefined;
      },
      set: (_, prop, value) => {
        if (typeof prop === 'string' && !isNaN(prop)) {
          const idx = parseInt(prop);
          const y = Math.floor(idx / 200);
          const x = idx % 200;
          tiles[`${x},${y}`] = value;
        }
        return true;
      }
    }),
    tileHealth: new Proxy({}, {
      get: (_, prop) => {
        if (typeof prop === 'string' && !isNaN(prop)) {
          const idx = parseInt(prop);
          const y = Math.floor(idx / 200);
          const x = idx % 200;
          return tileHealth[`${x},${y}`] || 0;
        }
        return undefined;
      },
      set: (_, prop, value) => {
        if (typeof prop === 'string' && !isNaN(prop)) {
          const idx = parseInt(prop);
          const y = Math.floor(idx / 200);
          const x = idx % 200;
          tileHealth[`${x},${y}`] = value;
        }
        return true;
      }
    }),
    dugTiles: new Proxy({}, {
      get: (_, prop) => {
        if (typeof prop === 'string' && !isNaN(prop)) {
          const idx = parseInt(prop);
          const y = Math.floor(idx / 200);
          const x = idx % 200;
          return dugTiles[`${x},${y}`] || 0;
        }
        return undefined;
      },
      set: (_, prop, value) => {
        if (typeof prop === 'string' && !isNaN(prop)) {
          const idx = parseInt(prop);
          const y = Math.floor(idx / 200);
          const x = idx % 200;
          dugTiles[`${x},${y}`] = value;
        }
        return true;
      }
    })
  };
}

function createMockPlayer(overrides = {}) {
  return {
    x: 100 * TILE_SIZE + TILE_SIZE / 2,
    y: 25 * TILE_SIZE + TILE_SIZE / 2,
    tileX: 100,
    tileY: 25,
    speed: 3,
    drillPower: 5,
    gold: 5000,
    maxCargo: 200,
    cargoUsed: 0,
    cargo: { coal: 0, iron: 0, gold: 0, emerald: 0, ruby: 0, diamond: 0 },
    addOre: function(type) {
      if (this.cargoUsed >= this.maxCargo) return false;
      this.cargo[type]++;
      this.cargoUsed++;
      return true;
    },
    ...overrides
  };
}

describe('PetBase', () => {
  it('应该正确初始化基础属性', () => {
    const pet = new PetBase(PET_TYPES.SCOUT);
    expect(pet.type).toBe(PET_TYPES.SCOUT);
    expect(pet.level).toBe(1);
    expect(pet.health).toBe(pet.maxHealth);
    expect(pet.energy).toBe(pet.maxEnergy);
    expect(pet.active).toBe(true);
  });

  it('takeDamage应该减少生命值并设置闪烁', () => {
    const pet = new PetBase(PET_TYPES.SCOUT);
    pet.takeDamage(10);
    expect(pet.health).toBe(pet.maxHealth - 10);
    expect(pet.damageFlash).toBeGreaterThan(0);
  });

  it('生命值归零时active应变为false', () => {
    const pet = new PetBase(PET_TYPES.SCOUT);
    pet.takeDamage(pet.maxHealth + 10);
    expect(pet.health).toBe(0);
    expect(pet.active).toBe(false);
  });

  it('升级应该提升属性', () => {
    const pet = new PetBase(PET_TYPES.SCOUT);
    const oldRange = pet.range;
    const oldMaxHealth = pet.maxHealth;
    pet.upgrade();
    expect(pet.level).toBe(2);
    expect(pet.range).toBeGreaterThan(oldRange);
    expect(pet.maxHealth).toBeGreaterThan(oldMaxHealth);
    expect(pet.health).toBe(pet.maxHealth);
    expect(pet.energy).toBe(pet.maxEnergy);
  });

  it('满级后getUpgradeCost返回null', () => {
    const pet = new PetBase(PET_TYPES.SCOUT);
    while (pet.level < 5) pet.upgrade();
    expect(pet.getUpgradeCost()).toBeNull();
  });

  it('getRepairCost计算正确', () => {
    const pet = new PetBase(PET_TYPES.SCOUT);
    pet.health = pet.maxHealth - 30;
    expect(pet.getRepairCost()).toBe(30);
  });

  it('getChargeCost计算正确', () => {
    const pet = new PetBase(PET_TYPES.SCOUT);
    pet.energy = pet.maxEnergy - 50;
    const cost = pet.getChargeCost();
    expect(cost).toBe(Math.ceil(50 * 0.3));
  });

  it('repair应该恢复满血', () => {
    const pet = new PetBase(PET_TYPES.SCOUT);
    pet.takeDamage(30);
    const result = pet.repair();
    expect(result.success).toBe(true);
    expect(pet.health).toBe(pet.maxHealth);
    expect(pet.active).toBe(true);
  });

  it('charge应该恢复满电', () => {
    const pet = new PetBase(PET_TYPES.SCOUT);
    pet.consumeEnergy(50);
    const result = pet.charge();
    expect(result.success).toBe(true);
    expect(pet.energy).toBe(pet.maxEnergy);
  });

  it('consumeEnergy不应让能量低于0', () => {
    const pet = new PetBase(PET_TYPES.SCOUT);
    pet.consumeEnergy(9999);
    expect(pet.energy).toBe(0);
  });

  it('canAct在能量为0时返回false', () => {
    const pet = new PetBase(PET_TYPES.SCOUT);
    pet.energy = 0;
    expect(pet.canAct(performance.now())).toBe(false);
  });

  it('canAct在inactive时返回false', () => {
    const pet = new PetBase(PET_TYPES.SCOUT);
    pet.active = false;
    expect(pet.canAct(performance.now())).toBe(false);
  });

  it('serialize/deserialize应保持数据一致', () => {
    const pet = new PetBase(PET_TYPES.SCOUT);
    pet.upgrade();
    pet.takeDamage(10);
    pet.consumeEnergy(20);
    const data = pet.serialize();
    const restored = deserializePet(data);
    expect(restored.type).toBe(pet.type);
    expect(restored.level).toBe(pet.level);
    expect(Math.floor(restored.health)).toBe(Math.floor(pet.health));
    expect(Math.floor(restored.energy)).toBe(Math.floor(pet.energy));
  });
});

describe('ScoutPet', () => {
  it('应该能探测稀有矿石', () => {
    const scout = new ScoutPet();
    const world = createMockWorld([
      { x: 100, y: 25, tile: TILE_TYPES.ORE_DIAMOND },
      { x: 101, y: 25, tile: TILE_TYPES.ORE_GOLD }
    ]);
    const player = createMockPlayer();
    scout.scanArea(player, world);
    const markers = scout.getDetectedMarkers();
    expect(markers.length).toBeGreaterThanOrEqual(2);
    const oreMarkers = markers.filter(m => m.type === SCOUT_MARK_TYPES.ORE);
    expect(oreMarkers.length).toBeGreaterThanOrEqual(2);
  });

  it('应该能探测毒气区域', () => {
    const scout = new ScoutPet();
    const world = createMockWorld([
      { x: 100, y: 25, tile: TILE_TYPES.POISON_GAS }
    ]);
    const player = createMockPlayer();
    scout.scanArea(player, world);
    const markers = scout.getDetectedMarkers();
    const poison = markers.find(m => m.type === SCOUT_MARK_TYPES.HAZARD_POISON);
    expect(poison).toBeDefined();
    expect(poison.name).toBe('毒气');
  });

  it('应该能探测不稳定区域', () => {
    const scout = new ScoutPet();
    const world = createMockWorld([
      { x: 100, y: 25, tile: TILE_TYPES.INSTABILITY }
    ]);
    const player = createMockPlayer();
    scout.scanArea(player, world);
    const markers = scout.getDetectedMarkers();
    const unstable = markers.find(m => m.type === SCOUT_MARK_TYPES.HAZARD_INSTABILITY);
    expect(unstable).toBeDefined();
    expect(unstable.name).toBe('不稳定区域');
  });

  it('应该能探测岩浆', () => {
    const scout = new ScoutPet();
    const world = createMockWorld([
      { x: 100, y: 25, tile: TILE_TYPES.LAVA }
    ]);
    const player = createMockPlayer();
    scout.scanArea(player, world);
    const markers = scout.getDetectedMarkers();
    const lava = markers.find(m => m.type === SCOUT_MARK_TYPES.LAVA);
    expect(lava).toBeDefined();
    expect(lava.name).toBe('岩浆');
  });

  it('能量耗尽或离线时不应返回标记', () => {
    const scout = new ScoutPet();
    const world = createMockWorld([
      { x: 100, y: 25, tile: TILE_TYPES.ORE_DIAMOND }
    ]);
    const player = createMockPlayer();
    scout.scanArea(player, world);
    expect(scout.getDetectedMarkers().length).toBeGreaterThan(0);

    scout.energy = 0;
    expect(scout.getDetectedMarkers().length).toBe(0);

    scout.energy = scout.maxEnergy;
    scout.active = false;
    expect(scout.getDetectedMarkers().length).toBe(0);
  });

  it('矿石稀有度应该正确分级', () => {
    const scout = new ScoutPet();
    expect(scout.getOreRarity(TILE_TYPES.ORE_DIAMOND)).toBe(5);
    expect(scout.getOreRarity(TILE_TYPES.ORE_RUBY)).toBe(4);
    expect(scout.getOreRarity(TILE_TYPES.ORE_EMERALD)).toBe(3);
    expect(scout.getOreRarity(TILE_TYPES.ORE_GOLD)).toBe(2);
    expect(scout.getOreRarity(TILE_TYPES.ORE_IRON)).toBe(1);
  });
});

describe('MagnetPet', () => {
  it('应该一口气收集范围内所有矿石，不中途停止', () => {
    const magnet = new MagnetPet();
    magnet.x = 100 * TILE_SIZE;
    magnet.y = 25 * TILE_SIZE;

    const world = createMockWorld([
      { x: 100, y: 25, tile: TILE_TYPES.ORE_GOLD },
      { x: 101, y: 25, tile: TILE_TYPES.ORE_IRON },
      { x: 100, y: 26, tile: TILE_TYPES.ORE_COAL }
    ]);

    const player = createMockPlayer({ drillPower: 5 });
    const startCargo = player.cargoUsed;
    magnet.collectNearbyOres(player, world);

    expect(player.cargoUsed - startCargo).toBe(3);
    expect(player.cargo.gold).toBe(1);
    expect(player.cargo.iron).toBe(1);
    expect(player.cargo.coal).toBe(1);
  });

  it('收集多个矿石应连续消耗能量', () => {
    const magnet = new MagnetPet();
    magnet.x = 100 * TILE_SIZE;
    magnet.y = 25 * TILE_SIZE;

    const world = createMockWorld([
      { x: 100, y: 25, tile: TILE_TYPES.ORE_GOLD },
      { x: 101, y: 25, tile: TILE_TYPES.ORE_IRON },
      { x: 100, y: 26, tile: TILE_TYPES.ORE_COAL }
    ]);

    const player = createMockPlayer({ drillPower: 5 });
    const startEnergy = magnet.energy;
    magnet.collectNearbyOres(player, world);

    expect(magnet.energy).toBeLessThan(startEnergy);
    const energyPerOre = 0.01;
    expect(startEnergy - magnet.energy).toBeCloseTo(3 * energyPerOre, 2);
  });

  it('不应收集超出范围的矿石', () => {
    const magnet = new MagnetPet();
    magnet.x = 100 * TILE_SIZE;
    magnet.y = 25 * TILE_SIZE;

    const farX = 100 + Math.ceil(magnet.range) + 2;
    const world = createMockWorld([
      { x: 100, y: 25, tile: TILE_TYPES.ORE_GOLD },
      { x: farX, y: 25, tile: TILE_TYPES.ORE_DIAMOND }
    ]);

    const player = createMockPlayer({ drillPower: 5 });
    magnet.collectNearbyOres(player, world);

    expect(player.cargo.gold).toBe(1);
    expect(player.cargo.diamond).toBe(0);
  });

  it('钻探等级不够时不应收集矿石', () => {
    const magnet = new MagnetPet();
    magnet.x = 100 * TILE_SIZE;
    magnet.y = 25 * TILE_SIZE;

    const world = createMockWorld([
      { x: 100, y: 25, tile: TILE_TYPES.ORE_DIAMOND }
    ]);

    const player = createMockPlayer({ drillPower: 2 });
    magnet.collectNearbyOres(player, world);
    expect(player.cargo.diamond).toBe(0);
  });

  it('货仓满时不应收集', () => {
    const magnet = new MagnetPet();
    magnet.x = 100 * TILE_SIZE;
    magnet.y = 25 * TILE_SIZE;

    const world = createMockWorld([
      { x: 100, y: 25, tile: TILE_TYPES.ORE_GOLD }
    ]);

    const player = createMockPlayer({ drillPower: 5, maxCargo: 0, cargoUsed: 0 });
    magnet.collectNearbyOres(player, world);
    expect(player.cargo.gold).toBe(0);
  });
});

describe('DefenderPet', () => {
  it('应该攻击范围内的敌人', () => {
    const defender = new DefenderPet();
    defender.x = 100 * TILE_SIZE;
    defender.y = 25 * TILE_SIZE;

    const enemy = {
      x: defender.x + TILE_SIZE,
      y: defender.y,
      health: 100,
      maxHealth: 100,
      damageFlash: 0,
      width: TILE_SIZE,
      height: TILE_SIZE
    };

    defender.updateCombat(1/60, [enemy], null);
    expect(enemy.health).toBeLessThan(100);
  });

  it('不应攻击范围外的敌人', () => {
    const defender = new DefenderPet();
    defender.x = 0;
    defender.y = 0;

    const farEnemy = {
      x: 99999,
      y: 99999,
      health: 100,
      maxHealth: 100,
      damageFlash: 0,
      width: TILE_SIZE,
      height: TILE_SIZE
    };

    defender.updateCombat(1/60, [farEnemy], null);
    expect(farEnemy.health).toBe(100);
    expect(defender.targetEnemy).toBeNull();
  });

  it('能量耗尽时不应攻击', () => {
    const defender = new DefenderPet();
    defender.x = 100 * TILE_SIZE;
    defender.y = 25 * TILE_SIZE;
    defender.energy = 0;

    const enemy = {
      x: defender.x + TILE_SIZE,
      y: defender.y,
      health: 100,
      maxHealth: 100,
      damageFlash: 0,
      width: TILE_SIZE,
      height: TILE_SIZE
    };

    defender.updateCombat(1/60, [enemy], null);
    expect(enemy.health).toBe(100);
  });

  it('冷却期内不应攻击', () => {
    const defender = new DefenderPet();
    defender.x = 100 * TILE_SIZE;
    defender.y = 25 * TILE_SIZE;
    defender.lastAction = performance.now();

    const enemy = {
      x: defender.x + TILE_SIZE,
      y: defender.y,
      health: 100,
      maxHealth: 100,
      damageFlash: 0,
      width: TILE_SIZE,
      height: TILE_SIZE
    };

    defender.updateCombat(1/60, [enemy], null);
    expect(enemy.health).toBe(100);
  });

  it('距离越远伤害越低（递减机制）', () => {
    const defender = new DefenderPet();
    defender.x = 0;
    defender.y = 0;

    const closeEnemy = {
      x: defender.x + TILE_SIZE,
      y: defender.y,
      health: 1000,
      maxHealth: 1000,
      damageFlash: 0,
      width: TILE_SIZE,
      height: TILE_SIZE
    };

    const farEnemy = {
      x: defender.x + (defender.range - 0.5) * TILE_SIZE,
      y: defender.y,
      health: 1000,
      maxHealth: 1000,
      damageFlash: 0,
      width: TILE_SIZE,
      height: TILE_SIZE
    };

    defender.updateCombat(1/60, [closeEnemy], null);
    const closeDamage = 1000 - closeEnemy.health;

    defender.lastAction = 0;
    defender.updateCombat(1/60, [farEnemy], null);
    const farDamage = 1000 - farEnemy.health;

    expect(closeDamage).toBeGreaterThan(farDamage);
    expect(farDamage).toBeGreaterThan(0);
  });

  it('攻击消耗能量应合理，满电可持续战斗较长时间', () => {
    const defender = new DefenderPet();
    const baseDrain = defender.def.energyDrain;
    const attackDrain = 0.02;
    const totalDrainPerSecond = baseDrain * 60 + (1000 / 600) * attackDrain;
    const estimatedSeconds = defender.maxEnergy / totalDrainPerSecond;
    expect(estimatedSeconds).toBeGreaterThan(120);
  });
});

describe('PetManager', () => {
  let pm;
  let localStorageMock;

  beforeEach(() => {
    const store = {};
    localStorageMock = {
      getItem: vi.fn((key) => store[key] || null),
      setItem: vi.fn((key, value) => { store[key] = value; }),
      removeItem: vi.fn((key) => { delete store[key]; }),
      clear: vi.fn(() => Object.keys(store).forEach(k => delete store[k]))
    };
    vi.stubGlobal('localStorage', localStorageMock);
    pm = new PetManager();
  });

  it('初始应该没有宠物', () => {
    expect(pm.pets.length).toBe(0);
  });

  it('canAddPet在未达上限时返回true', () => {
    expect(pm.canAddPet()).toBe(true);
  });

  it('buyPet应该成功购买宠物', () => {
    const result = pm.buyPet(PET_TYPES.SCOUT, 1000);
    expect(result.success).toBe(true);
    expect(result.cost).toBe(500);
    expect(pm.pets.length).toBe(1);
    expect(pm.pets[0].type).toBe(PET_TYPES.SCOUT);
  });

  it('buyPet金币不足应该失败', () => {
    const result = pm.buyPet(PET_TYPES.SCOUT, 100);
    expect(result.success).toBe(false);
    expect(result.reason).toContain('金币不足');
  });

  it('buyPet达到上限应该失败', () => {
    pm.buyPet(PET_TYPES.SCOUT, 5000);
    pm.buyPet(PET_TYPES.MAGNET, 5000);
    const result = pm.buyPet(PET_TYPES.DEFENDER, 5000);
    expect(result.success).toBe(false);
    expect(result.reason).toContain('上限');
    expect(pm.pets.length).toBe(MAX_PETS);
  });

  it('sellPet应该移除宠物并返回退款', () => {
    const buyResult = pm.buyPet(PET_TYPES.SCOUT, 5000);
    const petId = buyResult.pet.id;
    const sellResult = pm.sellPet(petId);
    expect(sellResult.success).toBe(true);
    expect(sellResult.refund).toBe(Math.floor(500 * 0.5));
    expect(pm.pets.length).toBe(0);
  });

  it('upgradePet应该成功升级', () => {
    const buyResult = pm.buyPet(PET_TYPES.SCOUT, 5000);
    const petId = buyResult.pet.id;
    const upgradeResult = pm.upgradePet(petId, 5000);
    expect(upgradeResult.success).toBe(true);
    expect(pm.pets[0].level).toBe(2);
  });

  it('upgradePet金币不足应该失败', () => {
    const buyResult = pm.buyPet(PET_TYPES.SCOUT, 500);
    const petId = buyResult.pet.id;
    const upgradeResult = pm.upgradePet(petId, 10);
    expect(upgradeResult.success).toBe(false);
  });

  it('repairPet应该维修宠物', () => {
    const buyResult = pm.buyPet(PET_TYPES.SCOUT, 5000);
    const pet = buyResult.pet;
    pet.takeDamage(30);
    const repairResult = pm.repairPet(pet.id, 5000);
    expect(repairResult.success).toBe(true);
    expect(pet.health).toBe(pet.maxHealth);
  });

  it('chargePet应该充电', () => {
    const buyResult = pm.buyPet(PET_TYPES.SCOUT, 5000);
    const pet = buyResult.pet;
    pet.consumeEnergy(50);
    const chargeResult = pm.chargePet(pet.id, 5000);
    expect(chargeResult.success).toBe(true);
    expect(pet.energy).toBe(pet.maxEnergy);
  });

  it('damagePetsInRange应该对范围内宠物造成伤害', () => {
    const buyResult = pm.buyPet(PET_TYPES.SCOUT, 5000);
    const pet = buyResult.pet;
    pet.x = 500;
    pet.y = 500;
    const startHealth = pet.health;
    pm.damagePetsInRange(500, 500, 100, 20);
    expect(pet.health).toBeLessThan(startHealth);
  });

  it('damagePetsInRange不应伤害范围外的宠物', () => {
    const buyResult = pm.buyPet(PET_TYPES.SCOUT, 5000);
    const pet = buyResult.pet;
    pet.x = 0;
    pet.y = 0;
    pm.damagePetsInRange(9999, 9999, 100, 20);
    expect(pet.health).toBe(pet.maxHealth);
  });

  it('getScoutRangeBonus应该返回侦查无人机范围加成', () => {
    pm.buyPet(PET_TYPES.SCOUT, 5000);
    const bonus = pm.getScoutRangeBonus();
    expect(bonus).toBeGreaterThan(0);
  });

  it('getAllScoutMarkers应该合并所有侦查无人机的标记', () => {
    pm.buyPet(PET_TYPES.SCOUT, 5000);
    const markers = pm.getAllScoutMarkers();
    expect(Array.isArray(markers)).toBe(true);
  });

  it('save和load应该持久化宠物数据', () => {
    const buyResult = pm.buyPet(PET_TYPES.SCOUT, 5000);
    const pet = buyResult.pet;
    pet.upgrade();
    pm.save();

    const pm2 = new PetManager();
    pm2.load();
    expect(pm2.pets.length).toBe(1);
    expect(pm2.pets[0].type).toBe(PET_TYPES.SCOUT);
    expect(pm2.pets[0].level).toBe(2);
  });

  it('clear应该清空所有宠物', () => {
    pm.buyPet(PET_TYPES.SCOUT, 5000);
    pm.buyPet(PET_TYPES.MAGNET, 5000);
    expect(pm.pets.length).toBe(2);
    pm.clear();
    expect(pm.pets.length).toBe(0);
  });
});

describe('createPetByType', () => {
  it('应该根据类型创建正确的宠物实例', () => {
    const scout = createPetByType(PET_TYPES.SCOUT);
    expect(scout).toBeInstanceOf(ScoutPet);

    const magnet = createPetByType(PET_TYPES.MAGNET);
    expect(magnet).toBeInstanceOf(MagnetPet);

    const defender = createPetByType(PET_TYPES.DEFENDER);
    expect(defender).toBeInstanceOf(DefenderPet);
  });

  it('创建的宠物应该已应用升级', () => {
    const pet = createPetByType(PET_TYPES.SCOUT);
    expect(pet.range).toBe(pet.def.baseRange);
    expect(pet.maxHealth).toBe(pet.def.baseHealth);
  });
});

describe('能量续航验证', () => {
  it('侦查无人机满电应可持续运行超过5分钟', () => {
    const scout = new ScoutPet();
    const drainPerSecond = scout.def.energyDrain * 60;
    const uptimeSeconds = scout.maxEnergy / drainPerSecond;
    expect(uptimeSeconds).toBeGreaterThan(300);
  });

  it('磁力宠物满电应可持续运行超过3分钟（不含收集消耗）', () => {
    const magnet = new MagnetPet();
    const drainPerSecond = magnet.def.energyDrain * 60;
    const uptimeSeconds = magnet.maxEnergy / drainPerSecond;
    expect(uptimeSeconds).toBeGreaterThan(180);
  });

  it('防御型宠物满电+持续战斗应可持续超过2分钟', () => {
    const defender = new DefenderPet();
    const baseDrainPerSecond = defender.def.energyDrain * 60;
    const attacksPerSecond = 1000 / defender.def.cooldown;
    const attackDrainPerSecond = attacksPerSecond * 0.02;
    const totalDrain = baseDrainPerSecond + attackDrainPerSecond;
    const uptimeSeconds = defender.maxEnergy / totalDrain;
    expect(uptimeSeconds).toBeGreaterThan(120);
  });
});
