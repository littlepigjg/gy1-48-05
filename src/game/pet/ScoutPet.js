import { TILE_SIZE, PET_TYPES, TILE_TYPES, TILE_ORE_MAP, SCOUT_MARK_TYPES, ORE_NAMES } from '../constants.js';
import { PetBase } from './PetBase.js';

const RARE_ORES = new Set([
  TILE_TYPES.ORE_EMERALD,
  TILE_TYPES.ORE_RUBY,
  TILE_TYPES.ORE_DIAMOND,
  TILE_TYPES.ORE_GOLD
]);

export class ScoutPet extends PetBase {
  constructor(id = null) {
    super(PET_TYPES.SCOUT, id);
    this.detectedMarkers = [];
    this.scanTimer = 0;
    this.scanInterval = 0.3;
  }

  update(dt, player, world, enemies, game) {
    super.update(dt, player, world, enemies, game);

    if (!this.active || this.health <= 0 || this.energy <= 0) {
      this.detectedMarkers = [];
      return;
    }

    this.scanTimer += dt;
    if (this.scanTimer >= this.scanInterval) {
      this.scanTimer = 0;
      this.scanArea(player, world);
    }
  }

  scanArea(player, world) {
    this.detectedMarkers = [];
    const tileRange = Math.ceil(this.range);
    const centerX = Math.floor(player.x / TILE_SIZE);
    const centerY = Math.floor(player.y / TILE_SIZE);

    for (let dy = -tileRange; dy <= tileRange; dy++) {
      for (let dx = -tileRange; dx <= tileRange; dx++) {
        const tx = centerX + dx;
        const ty = centerY + dy;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist > this.range) continue;
        if (!world.inBounds(tx, ty)) continue;

        const tile = world.getTile(tx, ty);
        const marker = this.identifyMarker(tx, ty, tile);
        if (marker) {
          this.detectedMarkers.push(marker);
        }
      }
    }
  }

  identifyMarker(tx, ty, tile) {
    if (RARE_ORES.has(tile)) {
      const oreType = TILE_ORE_MAP[tile];
      const rarity = this.getOreRarity(tile);
      return {
        x: tx,
        y: ty,
        type: SCOUT_MARK_TYPES.ORE,
        oreType: oreType,
        name: ORE_NAMES[oreType] || '矿石',
        rarity: rarity,
        tile: tile
      };
    }

    if (tile === TILE_TYPES.POISON_GAS) {
      return {
        x: tx,
        y: ty,
        type: SCOUT_MARK_TYPES.HAZARD_POISON,
        name: '毒气',
        tile: tile
      };
    }

    if (tile === TILE_TYPES.INSTABILITY) {
      return {
        x: tx,
        y: ty,
        type: SCOUT_MARK_TYPES.HAZARD_INSTABILITY,
        name: '不稳定区域',
        tile: tile
      };
    }

    if (tile === TILE_TYPES.LAVA) {
      return {
        x: tx,
        y: ty,
        type: SCOUT_MARK_TYPES.LAVA,
        name: '岩浆',
        tile: tile
      };
    }

    return null;
  }

  getOreRarity(tile) {
    switch (tile) {
      case TILE_TYPES.ORE_DIAMOND: return 5;
      case TILE_TYPES.ORE_RUBY: return 4;
      case TILE_TYPES.ORE_EMERALD: return 3;
      case TILE_TYPES.ORE_GOLD: return 2;
      case TILE_TYPES.ORE_IRON: return 1;
      default: return 0;
    }
  }

  getDetectedMarkers() {
    if (!this.active || this.health <= 0 || this.energy <= 0) {
      return [];
    }
    return this.detectedMarkers;
  }
}
