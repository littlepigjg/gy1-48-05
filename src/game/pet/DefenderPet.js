import { TILE_SIZE, PET_TYPES, PET_DAMAGE_FALLOFF } from '../constants.js';
import { PetBase } from './PetBase.js';

export class DefenderPet extends PetBase {
  constructor(id = null) {
    super(PET_TYPES.DEFENDER, id);
    this.targetEnemy = null;
  }

  update(dt, player, world, enemies, game) {
    super.update(dt, player, world, enemies, game);
    this.updateCombat(dt, enemies, game);
  }

  updateCombat(dt, enemies, game) {
    if (!this.active || this.health <= 0 || this.energy <= 0) {
      this.targetEnemy = null;
      return;
    }

    if (!enemies || enemies.length === 0) {
      this.targetEnemy = null;
      return;
    }

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
          game.particles.spawn(closestEnemy.x, closestEnemy.y, this.def.color, 4, 2, { gravity: 0, lifeMin: 6, lifeMax: 10 });
        }

        this.consumeEnergy(0.02);
      }
    } else {
      this.targetEnemy = null;
    }
  }
}
