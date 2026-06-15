import { TILE_SIZE, PET_TYPES, TILE_TYPES, TILE_ORE_MAP } from '../constants.js';
import { PetBase } from './PetBase.js';

export class MagnetPet extends PetBase {
  constructor(id = null) {
    super(PET_TYPES.MAGNET, id);
    this.collectTimer = 0;
    this.collectInterval = 0.08;
  }

  update(dt, player, world, enemies, game) {
    super.update(dt, player, world, enemies, game);

    if (!this.active || this.health <= 0 || this.energy <= 0) {
      return;
    }

    this.collectTimer += dt;
    if (this.collectTimer >= this.collectInterval) {
      this.collectTimer = 0;
      this.collectNearbyOres(player, world, game);
    }
  }

  collectNearbyOres(player, world, game) {
    const tileRange = Math.ceil(this.range);
    const centerX = Math.floor(player.x / TILE_SIZE);
    const centerY = Math.floor(player.y / TILE_SIZE);

    let collected = false;

    for (let dy = -tileRange; dy <= tileRange && !collected; dy++) {
      for (let dx = -tileRange; dx <= tileRange && !collected; dx++) {
        const tx = centerX + dx;
        const ty = centerY + dy;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist > this.range) continue;
        if (!world.inBounds(tx, ty)) continue;

        const tile = world.getTile(tx, ty);
        const oreType = TILE_ORE_MAP[tile];

        if (oreType) {
          const hardness = this.getOreHardness(tile);
          if (player.drillPower >= hardness) {
            if (player.addOre(oreType)) {
              const idx = world.getIndex(tx, ty);
              world.tiles[idx] = TILE_TYPES.EMPTY;
              world.tileHealth[idx] = 0;
              world.dugTiles[idx] = 1;

              if (game && game.particles) {
                const cx = tx * TILE_SIZE + TILE_SIZE / 2;
                const cy = ty * TILE_SIZE + TILE_SIZE / 2;
                game.particles.spawn(cx, cy, '#FFD700', 6, 2, { gravity: 0, lifeMin: 6, lifeMax: 10 });
              }

              this.consumeEnergy(0.02);
              collected = true;
            }
          }
        }
      }
    }
  }

  getOreHardness(tile) {
    switch (tile) {
      case TILE_TYPES.ORE_COAL:
      case TILE_TYPES.ORE_IRON:
      case TILE_TYPES.ORE_GOLD:
        return 3;
      case TILE_TYPES.ORE_EMERALD:
      case TILE_TYPES.ORE_RUBY:
        return 4;
      case TILE_TYPES.ORE_DIAMOND:
        return 5;
      default:
        return 99;
    }
  }
}
