import { ORE_PRICES, ORE_NAMES, UPGRADE_DEFS, TILE_SIZE, SURFACE_Y, DEPTH_BONUS_MULTIPLIER, PET_DEFS, PET_TYPES, MAX_PETS } from './constants.js';

export class UIManager {
  constructor(game) {
    this.game = game;
    this.warningTimeout = null;
    this.setupShopButtons();
    this.setupTeleportButton();
  }

  setupTeleportButton() {
    document.getElementById('teleportBtn').addEventListener('click', () => {
      this.game.tryTeleport();
    });
  }

  setupShopButtons() {
    document.getElementById('sellAllBtn').addEventListener('click', () => {
      const maxDepth = this.game.player.maxDepth;
      const depthBonus = 1 + maxDepth * DEPTH_BONUS_MULTIPLIER;
      const result = this.game.player.sellOres(ORE_PRICES, depthBonus);
      if (result.total > 0) {
        let msg = `售出矿石获得 $${result.total}`;
        if (result.bonus > 0) {
          msg += ` (含深度加成 +$${result.bonus})`;
        }
        this.showWarning(msg, 2000, 'text-green-300');
      }
      this.updateShop();
    });

    document.getElementById('refuelBtn').addEventListener('click', () => {
      if (this.game.player.gold >= 50) {
        this.game.player.gold -= 50;
        this.game.player.fuel = this.game.player.maxFuel;
        this.updateShop();
      }
    });

    document.getElementById('refillOxygenBtn').addEventListener('click', () => {
      if (this.game.player.gold >= 30) {
        this.game.player.gold -= 30;
        this.game.player.oxygen = this.game.player.maxOxygen;
        this.updateShop();
      }
    });

    document.getElementById('coolBtn').addEventListener('click', () => {
      if (this.game.player.gold >= 20) {
        this.game.player.gold -= 20;
        this.game.player.heat = 20;
        this.updateShop();
      }
    });

    document.getElementById('repairBtn').addEventListener('click', () => {
      if (this.game.player.gold >= 40) {
        this.game.player.gold -= 40;
        this.game.player.health = this.game.player.maxHealth;
        this.updateShop();
      }
    });

    document.getElementById('closeShopBtn').addEventListener('click', () => {
      this.closeShop();
    });
  }

  updateHUD() {
    const p = this.game.player;
    const depth = Math.max(0, p.tileY - SURFACE_Y);

    this.setBar('fuel', p.fuel, p.maxFuel);
    this.setBar('oxygen', p.oxygen, p.maxOxygen);
    this.setBar('heat', p.heat, p.maxHeat);
    this.setBar('cargo', p.cargoUsed, p.maxCargo);
    this.setBar('health', p.health, p.maxHealth);

    document.getElementById('goldText').textContent = Math.floor(p.gold);
    document.getElementById('depthText').textContent = depth;

    const depthBonus = Math.floor(depth * DEPTH_BONUS_MULTIPLIER * 100);
    const bonusEl = document.getElementById('depthBonus');
    if (depthBonus > 0) {
      bonusEl.classList.remove('hidden');
      document.getElementById('depthBonusText').textContent = `+${depthBonus}%`;
    } else {
      bonusEl.classList.add('hidden');
    }

    document.getElementById('oreGold').textContent = p.cargo.gold;
    document.getElementById('oreIron').textContent = p.cargo.iron;
    document.getElementById('oreDiamond').textContent = p.cargo.diamond;
    document.getElementById('oreCoal').textContent = p.cargo.coal;
    document.getElementById('oreEmerald').textContent = p.cargo.emerald;
    document.getElementById('oreRuby').textContent = p.cargo.ruby;

    this.updateTeleportUI();
    this.updatePetHUD();
    this.checkWarnings();
  }

  updateTeleportUI() {
    const tele = this.game.teleport;
    const p = this.game.player;
    const depth = Math.max(0, p.tileY - SURFACE_Y);
    const cost = tele.calculateCost(depth);

    const btn = document.getElementById('teleportBtn');
    const costEl = document.getElementById('teleportCost');
    const progressWrap = document.getElementById('teleportProgressWrap');
    const progressBar = document.getElementById('teleportProgressBar');
    const cooldownEl = document.getElementById('teleportCooldown');
    const cooldownText = document.getElementById('teleportCooldownText');

    costEl.textContent = `$${cost}`;

    if (depth < 2) {
      btn.style.opacity = '0.4';
      btn.style.cursor = 'not-allowed';
      costEl.textContent = '已在地面';
    } else {
      btn.style.opacity = p.gold >= cost ? '1' : '0.6';
      btn.style.cursor = 'pointer';
    }

    if (tele.isTeleporting()) {
      progressWrap.classList.remove('hidden');
      progressBar.style.width = tele.getProgressPercent() + '%';
      btn.classList.add('hidden');
      cooldownEl.classList.add('hidden');
    } else {
      progressWrap.classList.add('hidden');
      btn.classList.remove('hidden');

      const cooldown = tele.getCooldownPercent();
      if (cooldown > 0) {
        cooldownEl.classList.remove('hidden');
        cooldownText.textContent = Math.ceil((cooldown / 100) * 5) + 's';
        btn.style.opacity = '0.4';
      } else {
        cooldownEl.classList.add('hidden');
      }
    }
  }

  setBar(name, value, max) {
    const bar = document.getElementById(name + 'Bar');
    const text = document.getElementById(name + 'Text');
    const pct = Math.max(0, Math.min(100, (value / max) * 100));
    bar.style.width = pct + '%';
    text.textContent = `${Math.floor(value)}/${Math.floor(max)}`;
  }

  checkWarnings() {
    const p = this.game.player;
    const warnings = [];

    if (p.fuel < p.maxFuel * 0.15) warnings.push('⚠️ 燃料不足！');
    if (p.oxygen < p.maxOxygen * 0.15) warnings.push('⚠️ 氧气不足！');
    if (p.heat > p.maxHeat * 0.8) warnings.push('⚠️ 温度过高！');
    if (p.health < p.maxHealth * 0.2) warnings.push('⚠️ 机身受损严重！');
    if (p.cargoUsed >= p.maxCargo) warnings.push('📦 货仓已满！');

    const msg = warnings.join('  ');
    if (msg && !this.warningTimeout) {
      this.showWarning(msg, 2000);
    }
  }

  showWarning(text, duration = 2000, colorClass = 'text-red-200') {
    const el = document.getElementById('warningMessage');
    const textEl = document.getElementById('warningText');
    textEl.textContent = text;
    textEl.className = `font-game text-lg ${colorClass}`;
    el.classList.remove('hidden');

    if (this.warningTimeout) clearTimeout(this.warningTimeout);
    this.warningTimeout = setTimeout(() => {
      el.classList.add('hidden');
      this.warningTimeout = null;
    }, duration);
  }

  openShop() {
    if (!this.game.player.isOnSurface()) {
      this.showWarning('需要返回地面才能打开商店！', 1500);
      return false;
    }
    this.updateShop();
    document.getElementById('shopMenu').classList.remove('hidden');
    document.getElementById('shopMenu').classList.add('flex');
    this.game.paused = true;
    return true;
  }

  closeShop() {
    document.getElementById('shopMenu').classList.add('hidden');
    document.getElementById('shopMenu').classList.remove('flex');
    this.game.paused = false;
  }

  isShopOpen() {
    return !document.getElementById('shopMenu').classList.contains('hidden');
  }

  updatePetHUD() {
    const petHud = document.getElementById('petHud');
    const petList = document.getElementById('petHudList');
    const pets = this.game.pets.pets;
    
    if (pets.length === 0) {
      petHud.classList.add('hidden');
      return;
    }
    
    petHud.classList.remove('hidden');
    petList.innerHTML = '';
    
    for (const pet of pets) {
      const def = pet.def;
      const healthPct = (pet.health / pet.maxHealth) * 100;
      const energyPct = (pet.energy / pet.maxEnergy) * 100;
      const statusColor = !pet.active || pet.health <= 0 ? 'text-gray-500' : 
                          pet.energy <= 0 ? 'text-blue-400' : 'text-gray-200';
      const statusText = !pet.active || pet.health <= 0 ? '⚠️ 离线' :
                         pet.energy <= 0 ? '🔋 缺电' : '✨ 运行中';
      
      const div = document.createElement('div');
      div.className = 'bg-black/40 rounded p-2 border border-gray-700';
      div.innerHTML = `
        <div class="flex justify-between items-center mb-1">
          <span style="color: ${def.color}" class="font-bold text-xs">${def.icon} ${def.name}</span>
          <span class="text-xs ${statusColor}">${statusText}</span>
        </div>
        <div class="flex items-center gap-1 mb-1">
          <span class="text-red-400 text-xs w-4">HP</span>
          <div class="flex-1 h-2 bg-gray-800 rounded overflow-hidden">
            <div class="h-full bg-gradient-to-r from-red-600 to-red-400" style="width: ${healthPct}%"></div>
          </div>
          <span class="text-xs text-gray-400 w-10 text-right">${Math.floor(pet.health)}/${pet.maxHealth}</span>
        </div>
        <div class="flex items-center gap-1">
          <span class="text-blue-400 text-xs w-4">EN</span>
          <div class="flex-1 h-2 bg-gray-800 rounded overflow-hidden">
            <div class="h-full bg-gradient-to-r from-blue-600 to-cyan-400" style="width: ${energyPct}%"></div>
          </div>
          <span class="text-xs text-gray-400 w-10 text-right">${Math.floor(pet.energy)}/${pet.maxEnergy}</span>
        </div>
      `;
      petList.appendChild(div);
    }
  }

  updateShop() {
    const p = this.game.player;
    document.getElementById('shopGold').textContent = Math.floor(p.gold);

    const sellArea = document.getElementById('sellArea');
    sellArea.innerHTML = '';
    for (const [type, count] of Object.entries(p.cargo)) {
      if (count > 0) {
        const div = document.createElement('div');
        div.className = 'flex justify-between items-center text-gray-300';
        div.innerHTML = `
          <span>${this.getOreIcon(type)} ${ORE_NAMES[type]} x${count}</span>
          <span class="text-yellow-400">$${count * ORE_PRICES[type]}</span>
        `;
        sellArea.appendChild(div);
      }
    }
    if (sellArea.children.length === 0) {
      sellArea.innerHTML = '<div class="text-gray-500 text-center py-2">货仓为空</div>';
    }

    const upgradeArea = document.getElementById('upgradeArea');
    upgradeArea.innerHTML = '';
    for (const [key, def] of Object.entries(UPGRADE_DEFS)) {
      const level = p.upgrades[key];
      const cost = p.getUpgradeCost(key);
      const isMaxed = cost === null;
      const canAfford = !isMaxed && p.gold >= cost;

      const div = document.createElement('div');
      div.className = 'bg-black/30 rounded p-3 border border-yellow-900';
      div.innerHTML = `
        <div class="flex justify-between items-center mb-1">
          <span class="text-yellow-300 font-bold">${def.icon} ${def.name}</span>
          <span class="text-xs text-gray-400">Lv.${level}/${def.maxLevel}</span>
        </div>
        <div class="text-xs text-gray-400 mb-2">${def.description}</div>
        <button class="w-full py-1 px-2 rounded text-xs font-bold transition-all ${
          isMaxed ? 'bg-gray-700 text-gray-500 cursor-not-allowed' :
          canAfford ? 'bg-yellow-700 hover:bg-yellow-600 text-white border border-yellow-500' :
          'bg-gray-800 text-gray-500 cursor-not-allowed border border-gray-700'
        }" ${isMaxed || !canAfford ? 'disabled' : `data-upgrade="${key}"`}>
          ${isMaxed ? '已满级' : `$${cost}`}
        </button>
      `;
      upgradeArea.appendChild(div);
    }

    upgradeArea.querySelectorAll('button[data-upgrade]').forEach(btn => {
      btn.addEventListener('click', () => {
        const type = btn.dataset.upgrade;
        if (p.buyUpgrade(type)) {
          this.updateShop();
        }
      });
    });

    this.updatePetShop();
  }

  updatePetShop() {
    const p = this.game.player;
    const pets = this.game.pets;
    
    document.getElementById('petCountText').textContent = `(${pets.pets.length}/${MAX_PETS})`;
    
    const petShopArea = document.getElementById('petShopArea');
    petShopArea.innerHTML = '';
    
    for (const [type, def] of Object.entries(PET_DEFS)) {
      const canBuy = pets.canAddPet() && p.gold >= def.basePrice;
      
      const div = document.createElement('div');
      div.className = 'bg-black/30 rounded p-3 border border-cyan-900';
      div.innerHTML = `
        <div class="flex justify-between items-center mb-1">
          <span style="color: ${def.color}" class="font-bold">${def.icon} ${def.name}</span>
        </div>
        <div class="text-xs text-gray-400 mb-2 min-h-[32px]">${def.description}</div>
        <div class="text-xs text-gray-500 mb-2">
          HP:${def.baseHealth} | EN:${def.baseEnergy} | 范围:${def.baseRange}
          ${def.baseDamage ? ` | ATK:${def.baseDamage}` : ''}
        </div>
        <button class="w-full py-1 px-2 rounded text-xs font-bold transition-all ${
          !pets.canAddPet() ? 'bg-gray-700 text-gray-500 cursor-not-allowed' :
          canBuy ? 'bg-cyan-700 hover:bg-cyan-600 text-white border border-cyan-500' :
          'bg-gray-800 text-gray-500 cursor-not-allowed border border-gray-700'
        }" ${!canBuy ? 'disabled' : `data-buy-pet="${type}"`}>
          ${!pets.canAddPet() ? '已达上限' : `$${def.basePrice}`}
        </button>
      `;
      petShopArea.appendChild(div);
    }
    
    petShopArea.querySelectorAll('button[data-buy-pet]').forEach(btn => {
      btn.addEventListener('click', () => {
        const type = btn.dataset.buyPet;
        const result = this.game.pets.buyPet(type, this.game.player.gold);
        if (result.success) {
          this.game.player.gold -= result.cost;
          const startX = this.game.player.tileX;
          const startY = this.game.player.tileY;
          result.pet.x = startX * TILE_SIZE + TILE_SIZE / 2;
          result.pet.y = startY * TILE_SIZE + TILE_SIZE / 2;
          this.showWarning(`✨ 购买成功: ${result.pet.def.name}`, 2000, 'text-cyan-300');
          this.updateShop();
        } else {
          this.showWarning(`购买失败: ${result.reason}`, 1500);
        }
      });
    });

    const petListArea = document.getElementById('petListArea');
    const ownedPetsArea = document.getElementById('ownedPetsArea');
    
    if (pets.pets.length === 0) {
      ownedPetsArea.classList.add('hidden');
    } else {
      ownedPetsArea.classList.remove('hidden');
      petListArea.innerHTML = '';
      
      for (const pet of pets.pets) {
        const def = pet.def;
        const upgradeCost = pet.getUpgradeCost();
        const repairCost = pet.getRepairCost();
        const chargeCost = pet.getChargeCost();
        const isMaxed = upgradeCost === null;
        
        const div = document.createElement('div');
        div.className = 'bg-black/30 rounded p-3 border border-cyan-900';
        div.innerHTML = `
          <div class="flex justify-between items-start mb-2">
            <div>
              <span style="color: ${def.color}" class="font-bold">${def.icon} ${def.name}</span>
              <span class="text-xs text-gray-400 ml-2">Lv.${pet.level}/${def.maxLevel}</span>
            </div>
            <button class="text-xs text-red-400 hover:text-red-300" data-sell-pet="${pet.id}">
              出售 ($${Math.floor(def.basePrice * 0.5)})
            </button>
          </div>
          <div class="grid grid-cols-2 gap-2 mb-2 text-xs">
            <div class="flex items-center gap-1">
              <span class="text-red-400">HP</span>
              <div class="flex-1 h-2 bg-gray-800 rounded overflow-hidden">
                <div class="h-full bg-gradient-to-r from-red-600 to-red-400" style="width: ${(pet.health/pet.maxHealth)*100}%"></div>
              </div>
              <span class="text-gray-400">${Math.floor(pet.health)}/${pet.maxHealth}</span>
            </div>
            <div class="flex items-center gap-1">
              <span class="text-blue-400">EN</span>
              <div class="flex-1 h-2 bg-gray-800 rounded overflow-hidden">
                <div class="h-full bg-gradient-to-r from-blue-600 to-cyan-400" style="width: ${(pet.energy/pet.maxEnergy)*100}%"></div>
              </div>
              <span class="text-gray-400">${Math.floor(pet.energy)}/${pet.maxEnergy}</span>
            </div>
          </div>
          <div class="text-xs text-gray-500 mb-2">
            范围:${pet.range.toFixed(1)} ${def.baseDamage ? `| 攻击:${pet.damage}` : ''}
          </div>
          <div class="grid grid-cols-3 gap-2">
            <button class="py-1 px-2 rounded text-xs font-bold transition-all ${
              isMaxed ? 'bg-gray-700 text-gray-500 cursor-not-allowed' :
              p.gold >= upgradeCost ? 'bg-green-700 hover:bg-green-600 text-white border border-green-500' :
              'bg-gray-800 text-gray-500 cursor-not-allowed border border-gray-700'
            }" ${isMaxed || p.gold < upgradeCost ? 'disabled' : `data-upgrade-pet="${pet.id}"`}>
              ${isMaxed ? '已满级' : `升级 $${upgradeCost}`}
            </button>
            <button class="py-1 px-2 rounded text-xs font-bold transition-all ${
              repairCost <= 0 ? 'bg-gray-700 text-gray-500 cursor-not-allowed' :
              p.gold >= repairCost ? 'bg-rose-700 hover:bg-rose-600 text-white border border-rose-500' :
              'bg-gray-800 text-gray-500 cursor-not-allowed border border-gray-700'
            }" ${repairCost <= 0 || p.gold < repairCost ? 'disabled' : `data-repair-pet="${pet.id}"`}>
              ${repairCost <= 0 ? '满血' : `维修 $${repairCost}`}
            </button>
            <button class="py-1 px-2 rounded text-xs font-bold transition-all ${
              chargeCost <= 0 ? 'bg-gray-700 text-gray-500 cursor-not-allowed' :
              p.gold >= chargeCost ? 'bg-blue-700 hover:bg-blue-600 text-white border border-blue-500' :
              'bg-gray-800 text-gray-500 cursor-not-allowed border border-gray-700'
            }" ${chargeCost <= 0 || p.gold < chargeCost ? 'disabled' : `data-charge-pet="${pet.id}"`}>
              ${chargeCost <= 0 ? '满电' : `充电 $${chargeCost}`}
            </button>
          </div>
        `;
        petListArea.appendChild(div);
      }
      
      petListArea.querySelectorAll('button[data-upgrade-pet]').forEach(btn => {
        btn.addEventListener('click', () => {
          const id = parseFloat(btn.dataset.upgradePet);
          const result = this.game.pets.upgradePet(id, this.game.player.gold);
          if (result.success) {
            this.game.player.gold -= result.cost;
            this.showWarning('✨ 宠物升级成功！', 1500, 'text-green-300');
            this.updateShop();
          } else {
            this.showWarning(`升级失败: ${result.reason}`, 1500);
          }
        });
      });
      
      petListArea.querySelectorAll('button[data-repair-pet]').forEach(btn => {
        btn.addEventListener('click', () => {
          const id = parseFloat(btn.dataset.repairPet);
          const result = this.game.pets.repairPet(id, this.game.player.gold);
          if (result.success) {
            this.game.player.gold -= result.cost;
            this.showWarning('🔧 宠物维修完成！', 1500, 'text-rose-300');
            this.updateShop();
          } else {
            this.showWarning(`维修失败: ${result.reason}`, 1500);
          }
        });
      });
      
      petListArea.querySelectorAll('button[data-charge-pet]').forEach(btn => {
        btn.addEventListener('click', () => {
          const id = parseFloat(btn.dataset.chargePet);
          const result = this.game.pets.chargePet(id, this.game.player.gold);
          if (result.success) {
            this.game.player.gold -= result.cost;
            this.showWarning('🔋 宠物充电完成！', 1500, 'text-blue-300');
            this.updateShop();
          } else {
            this.showWarning(`充电失败: ${result.reason}`, 1500);
          }
        });
      });
      
      petListArea.querySelectorAll('button[data-sell-pet]').forEach(btn => {
        btn.addEventListener('click', () => {
          const id = parseFloat(btn.dataset.sellPet);
          const result = this.game.pets.sellPet(id);
          if (result.success) {
            this.game.player.gold += result.refund;
            this.showWarning(`💰 出售成功，获得 $${result.refund}`, 1500, 'text-yellow-300');
            this.updateShop();
          }
        });
      });
    }
  }

  getOreIcon(type) {
    const icons = {
      coal: '⬛',
      iron: '🔩',
      gold: '🪙',
      emerald: '💚',
      ruby: '❤️',
      diamond: '💎'
    };
    return icons[type] || '🪨';
  }

  showGameOver(stats) {
    const screen = document.getElementById('gameOverScreen');
    const statsEl = document.getElementById('gameOverStats');
    statsEl.innerHTML = `
      <div>💰 最终金币: ${Math.floor(stats.gold)}</div>
      <div>📍 最深深度: ${stats.maxDepth}m</div>
      <div>⚔️ 击杀敌人: ${stats.enemiesKilled || 0}</div>
      <div>🪨 挖掘方块: ${stats.blocksDug || 0}</div>
    `;
    screen.classList.remove('hidden');
    screen.classList.add('flex');
  }

  hideGameOver() {
    const screen = document.getElementById('gameOverScreen');
    screen.classList.add('hidden');
    screen.classList.remove('flex');
  }

  showHUD() {
    document.getElementById('hud').classList.remove('hidden');
  }

  hideHUD() {
    document.getElementById('hud').classList.add('hidden');
  }
}
