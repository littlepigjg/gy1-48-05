import { TILE_SIZE, PET_TYPES, PET_DEFS, MAX_PETS, PET_REPAIR_COST_PER_HP, PET_CHARGE_COST_PER_ENERGY, PET_DAMAGE_FALLOFF, TILE_ORE_MAP, TILE_TYPES } from './constants.js';

export class Pet {
  constructor(type, id = null) {
    this.id = id || Date.now() + Math.random();
    this.type = type;
    this.def = PET_DEFS[type];
    
    this.level = 1;
    this.maxHealth = this.def.baseHealth;
    this.health = this.maxHealth;
    this.maxEnergy = this.def.baseEnergy;
    this.energy = this.maxEnergy;
    
    if (this.def.upgradeType === 'range') {
      this.range = this.def.baseRange;
      this.damage = this.def.baseDamage || 0;
    } else {
      this.range = this.def.baseRange;
      this.damage = this.def.baseDamage || 0;
    }
    
    this.lastAction = 0;
    this.x = 0;
    this.y = 0;
    this.angle = 0;
    this.active = true;
    this.targetEnemy = null;
    this.damageFlash = 0;
  }

  applyUpgrades() {
    if (this.def.upgradeType === 'range') {
      this.range = this.def.baseRange + (this.level - 1) * 1.5;
    } else if (this.def.upgradeType === 'attack') {
      this.damage = this.def.baseDamage + (this.level - 1) * 5;
      this.range = this.def.baseRange + (this.level - 1) * 0.5;
    }
    this.maxHealth = this.def.baseHealth + (this.level - 1) * 20;
    this.maxEnergy = this.def.baseEnergy + (this.level - 1) * 15;
  }

  getUpgradeCost() {
    if (this.level >= this.def.maxLevel) return null;
    return this.def.upgradeCosts[this.level - 1];
  }

  upgrade() {
    const cost = this.getUpgradeCost();
    if (cost === null) return false;
    this.level++;
    const oldMaxHealth = this.maxHealth;
    const oldMaxEnergy = this.maxEnergy;
    this.applyUpgrades();
    this.health += (this.maxHealth - oldMaxHealth);
    this.energy += (this.maxEnergy - oldMaxEnergy);
    if (this.health > this.maxHealth) this.health = this.maxHealth;
    if (this.energy > this.maxEnergy) this.energy = this.maxEnergy;
    return true;
  }

  getRepairCost() {
    const missing = this.maxHealth - this.health;
    return Math.ceil(missing * PET_REPAIR_COST_PER_HP);
  }

  repair() {
    const cost = this.getRepairCost();
    if (cost <= 0) return { success: false, cost: 0 };
    this.health = this.maxHealth;
    return { success: true, cost };
  }

  getChargeCost() {
    const missing = this.maxEnergy - this.energy;
    return Math.ceil(missing * PET_CHARGE_COST_PER_ENERGY);
  }

  charge() {
    const cost = this.getChargeCost();
    if (cost <= 0) return { success: false, cost: 0 };
    this.energy = this.maxEnergy;
    return { success: true, cost };
  }

  takeDamage(amount) {
    this.health -= amount;
    this.damageFlash = 0.3;
    if (this.health < 0) this.health = 0;
    if (this.health <= 0) {
      this.active = false;
    }
  }

  canAct(now) {
    if (!this.active || this.energy <= 0) return false;
    if (this.def.cooldown > 0 && now - this.lastAction < this.def.cooldown) return false;
    return true;
  }

  update(dt, player, world, enemies, game) {
    const dx = player.x - this.x;
    const dy = player.y - this.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    
    if (dist > TILE_SIZE * 1.5) {
      const speed = player.speed * 0.85;
      const moveX = (dx / dist) * speed * dt * 60;
      const moveY = (dy / dist) * speed * dt * 60;
      this.x += moveX;
      this.y += moveY;
    }
    
    this.angle += dt * 2;
    
    if (this.active) {
      this.energy -= this.def.energyDrain * dt * 60;
      if (this.energy <= 0) {
        this.energy = 0;
      }
    }
    
    if (this.damageFlash > 0) {
      this.damageFlash -= dt;
    }
    
    if (this.type === PET_TYPES.DEFENDER) {
      this.updateDefender(dt, player, enemies, game);
    } else if (this.type === PET_TYPES.MAGNET) {
      this.updateMagnet(dt, player, world, game);
    }
  }

  updateDefender(dt, player, enemies, game) {
    if (!enemies || enemies.length === 0) return;
    
    let closestEnemy = null;
    let closestDist = this.range * TILE_SIZE;
    
    for (const e of enemies) {
      const dx = e.x - this.x;
      const dy = e.y - this.y;
      const d = Math.sqrt(dx * dx + dy * dy);
      if (d < closestDist && e.health > 0) {
        closestDist = d;
        closestEnemy = e;
      }
    }
    
    if (closestEnemy) {
      this.targetEnemy = closestEnemy;
      const now = performance.now();
      if (this.canAct(now)) {
        this.lastAction = now;
        const distanceFactor = 1 - (closestDist / (this.range * TILE_SIZE)) * PET_DAMAGE_FALLOFF;
        const actualDamage = Math.max(1, this.damage * Math.max(0.5, distanceFactor));
        closestEnemy.health -= actualDamage;
        closestEnemy.damageFlash = 0.2;
        
        if (game && game.particles) {
          game.particles.spawn(closestEnemy.x, closestEnemy.y, this.def.color, 5, 2, { gravity: 0, lifeMin: 8, lifeMax: 12 });
        }
        
        this.energy -= 0.5;
        if (this.energy < 0) this.energy = 0;
      }
    } else {
      this.targetEnemy = null;
    }
  }

  updateMagnet(dt, player, world, game) {
    const now = performance.now();
    if (!this.canAct(now)) return;
    
    const tileRange = Math.ceil(this.range);
    const tileX = Math.floor(player.x / TILE_SIZE);
    const tileY = Math.floor(player.y / TILE_SIZE);
    let collected = false;
    
    for (let dy = -tileRange; dy <= tileRange; dy++) {
      for (let dx = -tileRange; dx <= tileRange; dx++) {
        const tx = tileX + dx;
        const ty = tileY + dy;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist > this.range) continue;
        
        if (!world.inBounds(tx, ty)) continue;
        const tile = world.getTile(tx, ty);
        const oreType = TILE_ORE_MAP[tile];
        
        if (oreType) {
          const hardness = (tile === TILE_TYPES.ORE_COAL || tile === TILE_TYPES.ORE_IRON || tile === TILE_TYPES.ORE_GOLD) ? 3 :
                           (tile === TILE_TYPES.ORE_EMERALD || tile === TILE_TYPES.ORE_RUBY) ? 4 : 5;
          if (player.drillPower >= hardness) {
            if (player.addOre(oreType)) {
              const idx = world.getIndex(tx, ty);
              world.tiles[idx] = TILE_TYPES.EMPTY;
              world.tileHealth[idx] = 0;
              world.dugTiles[idx] = 1;
              
              if (game && game.particles) {
                const cx = tx * TILE_SIZE + TILE_SIZE / 2;
                const cy = ty * TILE_SIZE + TILE_SIZE / 2;
                game.particles.spawn(cx, cy, '#FFD700', 8, 3);
                game.particles.spawnCircle(cx, cy, '#FFD700', 5, 2);
              }
              
              this.lastAction = now;
              this.energy -= 0.3;
              collected = true;
              
              if (this.energy < 0) this.energy = 0;
              return;
            }
          }
        }
      }
    }
  }

  serialize() {
    return {
      id: this.id,
      type: this.type,
      level: this.level,
      health: this.health,
      energy: this.energy,
      active: this.active
    };
  }

  static deserialize(data) {
    const pet = new Pet(data.type, data.id);
    pet.level = data.level;
    pet.active = data.active !== undefined ? data.active : true;
    pet.applyUpgrades();
    pet.health = Math.min(data.health, pet.maxHealth);
    pet.energy = Math.min(data.energy, pet.maxEnergy);
    return pet;
  }
}

export class PetManager {
  constructor() {
    this.pets = [];
    this.storageKey = 'deep_digger_pets';
  }

  getActivePets() {
    return this.pets.filter(p => p.active && p.health > 0);
  }

  canAddPet() {
    return this.pets.length < MAX_PETS;
  }

  buyPet(type, gold) {
    const def = PET_DEFS[type];
    if (!def) return { success: false, reason: '未知宠物类型' };
    if (!this.canAddPet()) return { success: false, reason: '已达到宠物携带上限' };
    if (gold < def.basePrice) return { success: false, reason: '金币不足' };
    
    const pet = new Pet(type);
    pet.applyUpgrades();
    this.pets.push(pet);
    this.save();
    return { success: true, pet, cost: def.basePrice };
  }

  sellPet(petId) {
    const idx = this.pets.findIndex(p => p.id === petId);
    if (idx === -1) return { success: false };
    const pet = this.pets[idx];
    const refund = Math.floor(pet.def.basePrice * 0.5);
    this.pets.splice(idx, 1);
    this.save();
    return { success: true, refund };
  }

  upgradePet(petId, gold) {
    const pet = this.pets.find(p => p.id === petId);
    if (!pet) return { success: false, reason: '宠物不存在' };
    const cost = pet.getUpgradeCost();
    if (cost === null) return { success: false, reason: '已满级' };
    if (gold < cost) return { success: false, reason: '金币不足' };
    pet.upgrade();
    this.save();
    return { success: true, cost };
  }

  repairPet(petId, gold) {
    const pet = this.pets.find(p => p.id === petId);
    if (!pet) return { success: false, reason: '宠物不存在' };
    const cost = pet.getRepairCost();
    if (cost <= 0) return { success: false, reason: '无需维修' };
    if (gold < cost) return { success: false, reason: '金币不足' };
    pet.repair();
    pet.active = true;
    this.save();
    return { success: true, cost };
  }

  chargePet(petId, gold) {
    const pet = this.pets.find(p => p.id === petId);
    if (!pet) return { success: false, reason: '宠物不存在' };
    const cost = pet.getChargeCost();
    if (cost <= 0) return { success: false, reason: '无需充电' };
    if (gold < cost) return { success: false, reason: '金币不足' };
    pet.charge();
    this.save();
    return { success: true, cost };
  }

  update(dt, player, world, enemies, game) {
    for (const pet of this.pets) {
      pet.update(dt, player, world, enemies, game);
    }
  }

  damagePetsInRange(x, y, radius, damage) {
    for (const pet of this.pets) {
      const dx = pet.x - x;
      const dy = pet.y - y;
      const d = Math.sqrt(dx * dx + dy * dy);
      if (d < radius && pet.active && pet.health > 0) {
        const falloff = 1 - (d / radius) * PET_DAMAGE_FALLOFF;
        pet.takeDamage(damage * Math.max(0.3, falloff));
      }
    }
  }

  getScoutRangeBonus() {
    const scouts = this.pets.filter(p => p.type === PET_TYPES.SCOUT && p.active && p.health > 0 && p.energy > 0);
    let bonus = 0;
    for (const s of scouts) {
      bonus += s.range;
    }
    return bonus;
  }

  save() {
    try {
      const data = this.pets.map(p => p.serialize());
      localStorage.setItem(this.storageKey, JSON.stringify(data));
    } catch (e) {
      console.warn('保存宠物数据失败:', e);
    }
  }

  load() {
    try {
      const raw = localStorage.getItem(this.storageKey);
      if (!raw) return;
      const data = JSON.parse(raw);
      if (!Array.isArray(data)) return;
      this.pets = data.map(d => Pet.deserialize(d));
    } catch (e) {
      console.warn('加载宠物数据失败:', e);
    }
  }

  clear() {
    this.pets = [];
    try {
      localStorage.removeItem(this.storageKey);
    } catch (e) {}
  }
}
