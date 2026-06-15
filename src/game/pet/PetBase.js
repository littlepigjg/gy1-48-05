import { TILE_SIZE, PET_DEFS, PET_REPAIR_COST_PER_HP, PET_CHARGE_COST_PER_ENERGY } from '../constants.js';

export class PetBase {
  constructor(type, id = null) {
    this.id = id || Date.now() + Math.random();
    this.type = type;
    this.def = PET_DEFS[type];

    this.level = 1;
    this.maxHealth = this.def.baseHealth;
    this.health = this.maxHealth;
    this.maxEnergy = this.def.baseEnergy;
    this.energy = this.maxEnergy;

    this.range = this.def.baseRange;
    this.damage = this.def.baseDamage || 0;

    this.lastAction = 0;
    this.x = 0;
    this.y = 0;
    this.angle = 0;
    this.active = true;
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
    this.active = true;
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

  consumeEnergy(amount) {
    this.energy -= amount;
    if (this.energy < 0) this.energy = 0;
  }

  updateMovement(dt, player) {
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
  }

  updateEnergy(dt) {
    if (this.active && this.health > 0) {
      this.consumeEnergy(this.def.energyDrain * dt * 60);
    }
    if (this.damageFlash > 0) {
      this.damageFlash -= dt;
    }
  }

  update(dt, player, world, enemies, game) {
    this.updateMovement(dt, player);
    this.updateEnergy(dt);
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

  static getTypeClass(type) {
    return PetBase;
  }
}
