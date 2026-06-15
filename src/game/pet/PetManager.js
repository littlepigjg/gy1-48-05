import { TILE_SIZE, PET_TYPES, PET_DEFS, MAX_PETS, PET_DAMAGE_FALLOFF } from '../constants.js';
import { PetBase } from './PetBase.js';
import { ScoutPet } from './ScoutPet.js';
import { MagnetPet } from './MagnetPet.js';
import { DefenderPet } from './DefenderPet.js';

const PET_CLASS_MAP = {
  [PET_TYPES.SCOUT]: ScoutPet,
  [PET_TYPES.MAGNET]: MagnetPet,
  [PET_TYPES.DEFENDER]: DefenderPet
};

export function createPetByType(type, id = null) {
  const Cls = PET_CLASS_MAP[type] || PetBase;
  const pet = new Cls(id);
  pet.applyUpgrades();
  return pet;
}

export function deserializePet(data) {
  const Cls = PET_CLASS_MAP[data.type] || PetBase;
  const pet = new Cls(data.id);
  pet.level = data.level;
  pet.active = data.active !== undefined ? data.active : true;
  pet.applyUpgrades();
  pet.health = Math.min(data.health, pet.maxHealth);
  pet.energy = Math.min(data.energy, pet.maxEnergy);
  return pet;
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

    const pet = createPetByType(type);
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

  getAllScoutMarkers() {
    const markers = [];
    const seen = new Set();
    for (const pet of this.pets) {
      if (pet.type === PET_TYPES.SCOUT && typeof pet.getDetectedMarkers === 'function') {
        const petMarkers = pet.getDetectedMarkers();
        for (const m of petMarkers) {
          const key = `${m.x},${m.y}`;
          if (!seen.has(key)) {
            seen.add(key);
            markers.push(m);
          }
        }
      }
    }
    return markers;
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
      this.pets = data.map(d => deserializePet(d));
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
