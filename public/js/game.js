// Item Catalog
const ITEMS = {
  pistol: { id: 'pistol', name: '手槍', width: 2, height: 1, type: 'weapon', price: 1500, sellPrice: 750, maxAmmo: 8, baseDamage: 34, reloadTime: 1500, ammoType: 'ammo_9mm' },
  pistol_infinite: { id: 'pistol_infinite', name: '保底無限手槍', width: 2, height: 1, type: 'weapon', price: 999999, sellPrice: 0, maxAmmo: 8, baseDamage: 34, reloadTime: 1000, ammoType: 'ammo_9mm' },
  rifle: { id: 'rifle', name: '步槍', width: 4, height: 2, type: 'weapon', price: 5000, sellPrice: 2500, maxAmmo: 30, baseDamage: 45, reloadTime: 2200, ammoType: 'ammo_556' },
  shotgun: { id: 'shotgun', name: '散彈槍', width: 4, height: 1, type: 'weapon', price: 3000, sellPrice: 1500, maxAmmo: 5, baseDamage: 22, reloadTime: 2500, ammoType: 'ammo_12g' },
  ammo_9mm: { id: 'ammo_9mm', name: '9mm子彈', width: 1, height: 1, type: 'ammo', maxStack: 60, price: 10, sellPrice: 5 },
  ammo_556: { id: 'ammo_556', name: '5.56mm子彈', width: 1, height: 1, type: 'ammo', maxStack: 60, price: 15, sellPrice: 7 },
  ammo_12g: { id: 'ammo_12g', name: '12G霰彈', width: 1, height: 1, type: 'ammo', maxStack: 30, price: 20, sellPrice: 10 },
  armor_heavy: { id: 'armor_heavy', name: '重型防彈衣', width: 2, height: 2, type: 'armor', reduction: 0.50, price: 4000, sellPrice: 2000 },
  helmet: { id: 'helmet', name: '防彈頭盔', width: 2, height: 2, type: 'armor', reduction: 0.25, price: 2000, sellPrice: 1000 },
  backpack_small: { id: 'backpack_small', name: '戰術背包', width: 2, height: 2, type: 'backpack', cols: 4, rows: 4, price: 1500, sellPrice: 750 },
  bandage: { id: 'bandage', name: '醫用繃帶', width: 1, height: 1, type: 'med', maxStack: 3, heal: 30, useTime: 2000, price: 200, sellPrice: 100 },
  medkit: { id: 'medkit', name: '醫療包', width: 2, height: 1, type: 'med', maxStack: 1, heal: 80, useTime: 4000, price: 600, sellPrice: 300 },
  cheat_card: { id: 'cheat_card', name: '全圖雷達作弊卡', width: 1, height: 1, type: 'special', price: 1000, sellPrice: 500 }
};

// Generic function to retrieve stats for a specific item instance including rarity multipliers
function getItemStats(item) {
  if (!item) return null;
  const baseInfo = ITEMS[item.type];
  if (!baseInfo) return null;

  const stats = { ...baseInfo, rarity: item.rarity || 'white' };
  
  const rarityFactors = {
    white: { price: 1.0, stat: 1.0 },
    green: { price: 1.5, stat: 1.2 },
    blue: { price: 2.25, stat: 1.44 },
    gold: { price: 3.375, stat: 1.728 },
    red: { price: 5.0625, stat: 2.0736 }
  };

  const f = rarityFactors[stats.rarity];
  stats.price = Math.round(baseInfo.price * f.price);
  stats.sellPrice = Math.round(baseInfo.sellPrice * f.price);

  if (stats.type === 'weapon' && baseInfo.baseDamage) {
    stats.baseDamage = Math.round(baseInfo.baseDamage * f.stat);
  }

  if (stats.type === 'armor' && baseInfo.reduction) {
    stats.reduction = Math.min(0.90, baseInfo.reduction * f.stat);
  }

  const baseMaxDurabilityMap = {
    pistol: 100,
    pistol_infinite: 999999,
    rifle: 150,
    shotgun: 120,
    armor_heavy: 200,
    helmet: 100
  };

  const durabilityRarityMultipliers = {
    white: 1.0,
    green: 1.2,
    blue: 1.4,
    gold: 1.7,
    red: 2.0
  };

  if (baseMaxDurabilityMap[item.type] !== undefined) {
    const baseDur = baseMaxDurabilityMap[item.type];
    const rarityMultiplier = durabilityRarityMultipliers[item.rarity || 'white'] || 1.0;
    const maxDur = Math.round(baseDur * rarityMultiplier);
    
    if (item.maxDurability === undefined) {
      item.maxDurability = maxDur;
    }
    if (item.durability === undefined) {
      item.durability = maxDur;
    }
    if (item.durability > item.maxDurability) {
      item.durability = item.maxDurability;
    }
    
    stats.maxDurability = item.maxDurability;
    stats.durability = item.durability;

    const durabilityRatio = stats.maxDurability > 0 ? stats.durability / stats.maxDurability : 0;

    if (stats.type === 'weapon' && stats.baseDamage) {
      stats.baseDamage = Math.max(1, Math.ceil(stats.baseDamage * durabilityRatio));
    }
    if (stats.type === 'armor' && stats.reduction) {
      stats.reduction = stats.reduction * durabilityRatio;
    }
  }

  return stats;
}

// Visual durability bar helper for items
function getDurabilityBarHTML(item) {
  if (!item) return '';
  const stats = getItemStats(item);
  if (stats && stats.maxDurability !== undefined && stats.durability !== undefined) {
    const percent = Math.round((stats.durability / stats.maxDurability) * 100);
    if (percent < 100) {
      const color = percent < 30 ? '#ff3b30' : (percent < 70 ? '#ffcc00' : '#34c759');
      return `
        <div class="item-durability-bar-container" style="position: absolute; bottom: 3px; left: 3px; right: 3px; height: 3px; background: rgba(0,0,0,0.5); border-radius: 1.5px; overflow: hidden; pointer-events: none;">
          <div style="width: ${percent}%; height: 100%; background-color: ${color}; transition: width 0.2s ease;"></div>
        </div>
      `;
    }
  }
  return '';
}

// Global App States
let socket = null;
let currentUser = null; // Storing user profile info (id, username, level, xp, cash, stash, equipped)
let inRaid = false;

// Active Game States (In Raid)
let mapGrid = [];
const MAP_SIZE = 32;
const TILE_SIZE = 64;
let extractions = [];
let localPlayer = { x: 0, y: 0, health: 100, maxHealth: 100, ammoCount: 0, maxAmmo: 0, weaponType: null, angle: 0, vx: 0, vy: 0 };
let entities = new Map(); // other players & bots
let activeBullets = [];
let bloodParticles = [];

// Drag and Drop Globals
let draggedItem = null; // { itemRef, originSlot, originGridId }
let draggedElement = null;
let draggedOffsetCells = { x: 0, y: 0 };
let currentDragHighlight = null; // highlighting placeholder

// Key States
const keys = { w: false, a: false, s: false, d: false, r: false };

// Action Progress Tracker (Healing/Looting)
let actionProgress = { active: false, timer: 0, duration: 0, label: '', intervalId: null };

// Camera viewport tracking
const camera = { x: 0, y: 0 };

// Initialize Canvas
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

function resizeCanvas() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}
window.addEventListener('resize', resizeCanvas);
resizeCanvas();

// Helper for absolute positioning inside grids
const cellStep = 52; // 50px cell + 2px gap

// Helper for dynamic bag dimensions based on backpack rarity
function getPlayerBagDimensions(equipped, level) {
  if (!equipped || !equipped.backpack || !equipped.backpack.type) {
    return { cols: 4, rows: 2 }; // base pockets size: 8 cells
  }
  const bp = equipped.backpack;
  const rarity = bp.rarity || 'white';
  if (rarity === 'white') return { cols: 4, rows: 4 };
  if (rarity === 'green') return { cols: 4, rows: 5 };
  if (rarity === 'blue') return { cols: 4, rows: 6 };
  if (rarity === 'gold') return { cols: 4, rows: 7 };
  if (rarity === 'red') return { cols: 4, rows: 8 };
  return { cols: 4, rows: 4 };
}


// ----------------------------------------------------
// UI Navigation Controllers
// ----------------------------------------------------
function showScreen(screenId) {
  document.getElementById('login-screen').classList.add('hidden');
  document.getElementById('lobby-screen').classList.add('hidden');
  document.getElementById('raid-screen').classList.add('hidden');
  document.getElementById(screenId).classList.remove('hidden');
}

// ----------------------------------------------------
// Auth Handlers (Register & Login)
// ----------------------------------------------------
const tabLogin = document.getElementById('tab-login');
const tabRegister = document.getElementById('tab-register');
const btnAuthSubmit = document.getElementById('btn-auth-submit');
const authError = document.getElementById('auth-error');
const inputUser = document.getElementById('auth-username');
const inputPass = document.getElementById('auth-password');
let authMode = 'login'; // login or register

tabLogin.addEventListener('click', () => {
  authMode = 'login';
  tabLogin.classList.add('active');
  tabRegister.classList.remove('active');
  btnAuthSubmit.textContent = '登 入';
  authError.textContent = '';
});

tabRegister.addEventListener('click', () => {
  authMode = 'register';
  tabRegister.classList.add('active');
  tabLogin.classList.remove('active');
  btnAuthSubmit.textContent = '註 冊';
  authError.textContent = '';
});

btnAuthSubmit.addEventListener('click', async () => {
  const username = inputUser.value.trim();
  const password = inputPass.value.trim();
  if (!username || !password) {
    authError.textContent = '請輸入完整帳號及密碼！';
    return;
  }

  const endpoint = authMode === 'login' ? '/api/login' : '/api/register';
  authError.textContent = '';

  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });
    const data = await res.json();
    if (!res.ok) {
      authError.textContent = data.error || '伺服器錯誤';
      return;
    }

    if (authMode === 'register') {
      authError.style.color = '#00ff88';
      authError.textContent = '註冊成功！請直接登入';
      setTimeout(() => {
        authMode = 'login';
        tabLogin.classList.add('active');
        tabRegister.classList.remove('active');
        btnAuthSubmit.textContent = '登 入';
        authError.style.color = '#ff3b30';
        authError.textContent = '';
      }, 1500);
    } else {
      // Login successful, load lobby
      currentUser = data;
      initSocketConnection();
      loadLobbyUI();
      showScreen('lobby-screen');
    }
  } catch (err) {
    authError.textContent = '網路連接失敗';
  }
});

// ----------------------------------------------------
// Lobby UI Populating & Loading
// ----------------------------------------------------
function loadLobbyUI() {
  document.getElementById('lobby-username').textContent = currentUser.username;
  document.getElementById('lobby-level').textContent = currentUser.level;
  document.getElementById('lobby-xp-text').textContent = `${currentUser.xp} / ${currentUser.level * 1000}`;
  
  const xpPct = (currentUser.xp % 1000) / 10;
  document.getElementById('lobby-xp-bar').style.width = `${xpPct}%`;
  document.getElementById('lobby-cash').textContent = currentUser.cash.toLocaleString();

  // Bankruptcy button check
  const reliefBtn = document.getElementById('btn-bankruptcy');
  if (currentUser.cash < 2000) {
    reliefBtn.classList.remove('hidden');
  } else {
    reliefBtn.classList.add('hidden');
  }

  // Update medals display
  const medals = currentUser.medal_count || 0;
  const lobbyMedals = document.getElementById('lobby-medals');
  const lobbyMedalsBonus = document.getElementById('lobby-medals-bonus');
  if (lobbyMedals) lobbyMedals.textContent = medals;
  if (lobbyMedalsBonus) lobbyMedalsBonus.textContent = medals;

  renderStash();
  renderLobbyBackpack();
  renderEquipped();
  renderShop();
  renderQuests();
}

function renderQuests() {
  const container = document.getElementById('quest-list-container');
  if (!container) return;

  container.innerHTML = '';
  const quests = currentUser.quests || [];
  let completedCount = 0;

  quests.forEach((q) => {
    const card = document.createElement('div');
    card.className = 'quest-card';
    if (q.claimed) {
      card.classList.add('claimed');
    }

    const pct = Math.min(100, (q.progress / q.target) * 100);
    const isCompleted = q.progress >= q.target;
    if (isCompleted) {
      completedCount++;
    }

    let rewardText = '';
    if (q.rewardType === 'cash') {
      rewardText = `+$${q.rewardValue.toLocaleString()} 美金`;
    } else if (q.rewardType === 'medal') {
      rewardText = `+${q.rewardValue} 榮耀勳章`;
    }

    let statusHtml = '';
    if (q.claimed) {
      statusHtml = `<div class="quest-status-badge">已領取</div>`;
    } else if (isCompleted) {
      statusHtml = `<button class="btn-claim-reward" onclick="claimQuestReward('${q.id}')">領取獎勵</button>`;
    } else {
      statusHtml = `<div class="quest-status-badge">進行中</div>`;
    }

    card.innerHTML = `
      <div class="quest-card-header">
        <div class="quest-title">${q.desc}</div>
        <div class="quest-reward">${rewardText}</div>
      </div>
      <div class="quest-progress-bar-wrapper">
        <div class="quest-progress-bar">
          <div class="quest-progress-fill" style="width: ${pct}%"></div>
        </div>
        <div class="quest-progress-text">${q.progress} / ${q.target}</div>
      </div>
      ${statusHtml}
    `;
    container.appendChild(card);
  });

  const summaryCount = document.getElementById('quest-summary-count');
  if (summaryCount) {
    summaryCount.textContent = `${completedCount}/3`;
  }
}

window.claimQuestReward = function(questId) {
  if (socket) {
    socket.emit('claim_quest_reward', { userId: currentUser.id, questId });
  }
};

// Relief Claiming
document.getElementById('btn-bankruptcy').addEventListener('click', async () => {
  try {
    const res = await fetch('/api/bankruptcy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: currentUser.id })
    });
    const data = await res.json();
    if (res.ok) {
      currentUser.cash = data.cash;
      currentUser.stash = data.stash;
      loadLobbyUI();
    }
  } catch (err) {
    showAnnouncement('領取失敗', 'error');
  }
});

// Leaderboard Loading
document.getElementById('btn-leaderboard').addEventListener('click', async () => {
  try {
    const res = await fetch('/api/leaderboard');
    const list = await res.json();
    const body = document.getElementById('leaderboard-body');
    body.innerHTML = '';
    list.forEach((user, index) => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td class="rank-num">${index + 1}</td>
        <td>${user.username}</td>
        <td>LV ${user.level}</td>
        <td class="rank-cash">$${user.cash.toLocaleString()}</td>
      `;
      body.appendChild(tr);
    });
    document.getElementById('leaderboard-modal').classList.remove('hidden');
  } catch (err) {
    showAnnouncement('加載排行榜失敗', 'error');
  }
});

document.getElementById('btn-close-leaderboard').addEventListener('click', () => {
  document.getElementById('leaderboard-modal').classList.add('hidden');
});

// Logout
document.getElementById('btn-logout').addEventListener('click', () => {
  if (socket) socket.disconnect();
  currentUser = null;
  showScreen('login-screen');
});

// ----------------------------------------------------
// Stash & Grid Inventory Renderers
// ----------------------------------------------------
function renderStash() {
  const container = document.getElementById('stash-grid');
  // Clear items except cells
  container.innerHTML = '';

  // Max heights dynamically set. We will draw 7 columns and 35 rows
  const cols = 7;
  const rows = 35; // visually capped scrollable height
  container.style.gridTemplateColumns = `repeat(${cols}, var(--cell-size))`;
  container.style.gridAutoRows = 'var(--cell-size)';
  container.style.height = `${rows * cellStep + 8}px`;

  // Draw background helper cells
  for (let i = 0; i < cols * rows; i++) {
    const cell = document.createElement('div');
    cell.classList.add('grid-cell');
    container.appendChild(cell);
  }

  // Draw items
  currentUser.stash.forEach(item => {
    createGridItemElement(item, container, 'stash');
  });
}

function renderLobbyBackpack() {
  const container = document.getElementById('lobby-bag-grid');
  if (!container) return;
  container.innerHTML = '';

  const bp = currentUser.equipped.backpack;
  const dims = getPlayerBagDimensions(currentUser.equipped, currentUser.level);
  const cols = dims.cols; // 4
  const rows = dims.rows; // dynamically 4~8 depending on level

  container.style.gridTemplateColumns = `repeat(${cols}, var(--cell-size))`;
  container.style.gridAutoRows = 'var(--cell-size)';
  container.style.height = `${rows * cellStep + 8}px`;

  // Draw background cells
  for (let i = 0; i < cols * rows; i++) {
    const cell = document.createElement('div');
    cell.classList.add('grid-cell');
    container.appendChild(cell);
  }

  // Draw backpack items
  const innerItems = bp ? (bp.items || []) : [];
  innerItems.forEach(item => {
    createGridItemElement(item, container, 'backpack');
  });
}

function renderEquipped() {
  // Clear equipped slots
  const slots = ['helmet', 'armor', 'weapon', 'backpack', 'pocket1', 'pocket2', 'ammo', 'quick1', 'quick2', 'quick3', 'quick4', 'quick5'];
  slots.forEach(slot => {
    const el = document.getElementById(`slot-${slot}`);
    if (!el) return;
    // Clear previous items (except labels and keys)
    const label = el.querySelector('.slot-label');
    const keySpan = el.querySelector('.slot-key');
    el.innerHTML = '';
    if (keySpan) el.appendChild(keySpan);
    if (label) el.appendChild(label);
    
    if (currentUser && currentUser.equipped) {
      const item = currentUser.equipped[slot];
      if (item && (slot !== 'backpack' || item.type !== null)) {
        createSlotItemElement(item, el, slot);
      }
    }
  });
}

// ----------------------------------------------------
// UI Element Factory
// ----------------------------------------------------
function createGridItemElement(item, gridContainer, location) {
  const info = ITEMS[item.type];
  if (!info) return;

  const div = document.createElement('div');
  div.classList.add('grid-item');
  div.setAttribute('draggable', 'true');
  div.setAttribute('data-id', item.id);
  div.setAttribute('data-type', info.type);

  // Position absolutely
  div.style.left = `${item.x * cellStep + 4}px`;
  div.style.top = `${item.y * cellStep + 4}px`;
  div.style.width = `${info.width * cellStep - 2}px`;
  div.style.height = `${info.height * cellStep - 2}px`;

  const rarity = item.rarity || 'white';
  div.classList.add(`rarity-border-${rarity}`);

  const rarityLabel = {
    white: '',
    green: ' (綠)',
    blue: ' (藍)',
    gold: ' (金)',
    red: ' (紅)'
  }[rarity];

  div.innerHTML = `
    <span class="item-name rarity-text-${rarity}">${info.name}${rarityLabel}</span>
    ${item.count > 1 ? `<span class="item-count">${item.count}</span>` : ''}
    ${getDurabilityBarHTML(item)}
  `;

  // Drag listeners
  div.addEventListener('dragstart', (e) => handleDragStart(e, item, location, gridContainer.id));
  div.addEventListener('dragend', handleDragEnd);
  div.addEventListener('contextmenu', (e) => handleContextMenu(e, item, location));

  // Bind hover tooltips
  bindTooltip(div, item);

  gridContainer.appendChild(div);
}

function createSlotItemElement(item, slotElement, slotName) {
  const info = ITEMS[item.type];
  if (!info) return;

  const div = document.createElement('div');
  div.classList.add('grid-item');
  div.setAttribute('draggable', 'true');
  div.setAttribute('data-id', item.id);
  div.setAttribute('data-type', info.type);
  div.style.position = 'relative';
  div.style.left = '0';
  div.style.top = '0';
  div.style.width = '95%';
  div.style.height = '95%';

  const rarity = item.rarity || 'white';
  div.classList.add(`rarity-border-${rarity}`);

  const rarityLabel = {
    white: '',
    green: ' (綠)',
    blue: ' (藍)',
    gold: ' (金)',
    red: ' (紅)'
  }[rarity];

  div.innerHTML = `
    <span class="item-name rarity-text-${rarity}">${info.name}${rarityLabel}</span>
    ${item.count > 1 ? `<span class="item-count">${item.count}</span>` : ''}
    ${getDurabilityBarHTML(item)}
  `;

  // Drag listeners
  div.addEventListener('dragstart', (e) => handleDragStart(e, item, slotName, null));
  div.addEventListener('dragend', handleDragEnd);
  div.addEventListener('contextmenu', (e) => handleContextMenu(e, item, slotName));

  // Bind hover tooltips
  bindTooltip(div, item);

  slotElement.appendChild(div);
}

// ----------------------------------------------------
// HTML5 Grid Drag and Drop Actions
// ----------------------------------------------------
function handleDragStart(e, item, originSlot, originGridId) {
  const itemEl = e.target.closest('.grid-item') || e.target;
  draggedItem = { itemRef: item, originSlot, originGridId };
  draggedElement = itemEl;
  itemEl.classList.add('dragging');

  // Compute offset clicked cells relative to item top-left corner
  const rect = itemEl.getBoundingClientRect();
  const clickX = e.clientX - rect.left;
  const clickY = e.clientY - rect.top;
  
  draggedOffsetCells = {
    x: Math.floor(clickX / cellStep),
    y: Math.floor(clickY / cellStep)
  };

  // Set drag data
  e.dataTransfer.setData('text/plain', item.id);
}

function handleDragEnd(e) {
  const itemEl = e.target.closest('.grid-item') || e.target;
  itemEl.classList.remove('dragging');
  removeDragHighlight();
}

function removeDragHighlight() {
  if (currentDragHighlight) {
    currentDragHighlight.remove();
    currentDragHighlight = null;
  }
}

// Configure stash drops
const stashGrid = document.getElementById('stash-grid');
stashGrid.addEventListener('dragover', (e) => handleGridDragOver(e, stashGrid, 7, 100));
stashGrid.addEventListener('dragleave', removeDragHighlight);
stashGrid.addEventListener('drop', (e) => handleGridDrop(e, stashGrid, 'stash'));

// Configure lobby backpack drops
const lobbyBagGrid = document.getElementById('lobby-bag-grid');
if (lobbyBagGrid) {
  lobbyBagGrid.addEventListener('dragover', (e) => {
    e.preventDefault();
    if (!currentUser.equipped.backpack || currentUser.equipped.backpack.type === null) return;
    const dims = getPlayerBagDimensions(currentUser.equipped, currentUser.level);
    handleGridDragOver(e, lobbyBagGrid, dims.cols, dims.rows);
  });
  lobbyBagGrid.addEventListener('dragleave', removeDragHighlight);
  lobbyBagGrid.addEventListener('drop', (e) => handleGridDrop(e, lobbyBagGrid, 'backpack'));
}

// Configure equipped drops
const equipSlots = document.querySelectorAll('.equip-slot');
equipSlots.forEach(slot => {
  slot.addEventListener('dragover', (e) => handleSlotDragOver(e, slot));
  slot.addEventListener('dragleave', () => {
    slot.classList.remove('hover-valid', 'hover-invalid');
  });
  slot.addEventListener('drop', (e) => handleSlotDrop(e, slot));
});

// Shop Sell Box drops
const shopSellBox = document.getElementById('shop-sell-box');
shopSellBox.addEventListener('dragover', (e) => {
  e.preventDefault();
  shopSellBox.classList.add('hover-valid');
});
shopSellBox.addEventListener('dragleave', () => {
  shopSellBox.classList.remove('hover-valid');
});
shopSellBox.addEventListener('drop', (e) => {
  e.preventDefault();
  shopSellBox.classList.remove('hover-valid');
  if (draggedItem) {
    sellItem(draggedItem.itemRef, draggedItem.originSlot);
  }
});

// Grid DragOver calculation details
function handleGridDragOver(e, grid, maxCols, maxRows) {
  e.preventDefault();
  if (!draggedItem) return;

  const info = ITEMS[draggedItem.itemRef.type];
  const rect = grid.getBoundingClientRect();
  const mouseX = e.clientX - rect.left;
  const mouseY = e.clientY - rect.top;

  const cellX = Math.floor(mouseX / cellStep);
  const cellY = Math.floor(mouseY / cellStep);

  const x = cellX - draggedOffsetCells.x;
  const y = cellY - draggedOffsetCells.y;

  const inBounds = x >= 0 && x + info.width <= maxCols && y >= 0 && y + info.height <= maxRows;

  // Collision Overlap check
  let overlaps = false;
  
  // Decide which items we compare against (stash list or backpack list)
  let existingItems = [];
  if (grid.id === 'stash-grid') {
    existingItems = currentUser.stash;
  } else if (grid.id === 'lobby-bag-grid') {
    existingItems = (currentUser.equipped.backpack ? currentUser.equipped.backpack.items : []) || [];
  }

  if (inBounds) {
    for (const it of existingItems) {
      if (it.id === draggedItem.itemRef.id) continue;
      const itInfo = ITEMS[it.type];
      const hasOverlap = !(
        (x + info.width <= it.x) ||
        (it.x + itInfo.width <= x) ||
        (y + info.height <= it.y) ||
        (it.y + itInfo.height <= y)
      );
      if (hasOverlap) {
        overlaps = true;
        break;
      }
    }
  }

  // Draw highlight block
  removeDragHighlight();
  const hl = document.createElement('div');
  hl.style.position = 'absolute';
  hl.style.left = `${x * cellStep + 4}px`;
  hl.style.top = `${y * cellStep + 4}px`;
  hl.style.width = `${info.width * cellStep - 2}px`;
  hl.style.height = `${info.height * cellStep - 2}px`;
  hl.style.pointerEvents = 'none';
  hl.style.borderRadius = '4px';
  hl.style.zIndex = '5';
  
  if (inBounds && !overlaps) {
    hl.classList.add('highlight-valid');
  } else {
    hl.classList.add('highlight-invalid');
  }
  grid.appendChild(hl);
  currentDragHighlight = hl;
}

// Grid Drop Handler
function handleGridDrop(e, grid, destLocation) {
  e.preventDefault();
  removeDragHighlight();
  if (!draggedItem) return;

  const info = ITEMS[draggedItem.itemRef.type];
  const rect = grid.getBoundingClientRect();
  const mouseX = e.clientX - rect.left;
  const mouseY = e.clientY - rect.top;

  const cellX = Math.floor(mouseX / cellStep);
  const cellY = Math.floor(mouseY / cellStep);

  const x = cellX - draggedOffsetCells.x;
  const y = cellY - draggedOffsetCells.y;

  let maxCols = 7;
  let maxRows = 100;
  let existingItems = [];

  if (destLocation === 'stash') {
    maxCols = 7;
    maxRows = 100;
    existingItems = currentUser.stash;
  } else if (destLocation === 'backpack') {
    if (!currentUser.equipped.backpack || currentUser.equipped.backpack.type === null) {
      showAnnouncement('您沒有裝備背包，無法放入物品！', 'error');
      return;
    }
    const dims = getPlayerBagDimensions(currentUser.equipped, currentUser.level);
    maxCols = dims.cols;
    maxRows = dims.rows;
    existingItems = currentUser.equipped.backpack.items || [];
  }

  const inBounds = x >= 0 && x + info.width <= maxCols && y >= 0 && y + info.height <= maxRows;
  if (!inBounds) return;

  // Overlap test
  let overlaps = false;
  for (const it of existingItems) {
    if (it.id === draggedItem.itemRef.id) continue;
    const itInfo = ITEMS[it.type];
    const hasOverlap = !(
      (x + info.width <= it.x) ||
      (it.x + itInfo.width <= x) ||
      (y + info.height <= it.y) ||
      (it.y + itInfo.height <= y)
    );
    if (hasOverlap) {
      overlaps = true;
      break;
    }
  }

  if (overlaps) return;

  // Remove from origin location
  const origin = draggedItem.originSlot;
  const itemData = {
    id: draggedItem.itemRef.id,
    type: draggedItem.itemRef.type,
    x: x,
    y: y,
    count: draggedItem.itemRef.count
  };

  if (origin === 'stash') {
    if (destLocation === 'stash') {
      // 倉庫內移動
      const stashItem = currentUser.stash.find(it => it.id === draggedItem.itemRef.id);
      if (stashItem) {
        stashItem.x = x;
        stashItem.y = y;
      }
    } else {
      // 從倉庫移出
      currentUser.stash = currentUser.stash.filter(it => it.id !== draggedItem.itemRef.id);
    }
  } else if (origin === 'backpack') {
    if (destLocation === 'backpack') {
      // 背包內移動
      const bagItem = currentUser.equipped.backpack.items.find(it => it.id === draggedItem.itemRef.id);
      if (bagItem) {
        bagItem.x = x;
        bagItem.y = y;
      }
    } else {
      // 從背包移出
      currentUser.equipped.backpack.items = currentUser.equipped.backpack.items.filter(it => it.id !== draggedItem.itemRef.id);
    }
  } else {
    // 從裝備槽移出
    currentUser.equipped[origin] = null;
  }

  // 加入到目標位置
  if (origin !== destLocation) {
    if (destLocation === 'stash') {
      currentUser.stash.push(itemData);
    } else if (destLocation === 'backpack') {
      if (!currentUser.equipped.backpack.items) {
        currentUser.equipped.backpack.items = [];
      }
      currentUser.equipped.backpack.items.push(itemData);
    }
  }

  // Save changes to database
  saveLobbyData();
  renderStash();
  renderLobbyBackpack();
  renderEquipped();
  draggedItem = null;
}

// Equip Slot DragOver calculation details
function handleSlotDragOver(e, slot) {
  e.preventDefault();
  if (!draggedItem) return;

  const slotType = slot.getAttribute('data-slot');
  const info = ITEMS[draggedItem.itemRef.type];

  // Validate equip slot filters
  let valid = false;
  if (slotType === 'helmet' && info.id === 'helmet') valid = true;
  else if (slotType === 'armor' && info.id === 'armor_heavy') valid = true;
  else if (slotType === 'weapon' && info.type === 'weapon') valid = true;
  else if (slotType === 'backpack' && info.type === 'backpack') valid = true;
  else if (slotType === 'ammo' && info.type === 'ammo') valid = true;
  else if ((slotType === 'pocket1' || slotType === 'pocket2') && info.type === 'med') valid = true;
  else if (slotType.startsWith('quick') && (info.type === 'med' || info.type === 'ammo')) valid = true;

  if (valid) {
    slot.classList.add('hover-valid');
  } else {
    slot.classList.add('hover-invalid');
  }
}

// Equip Slot Drop Handler
function handleSlotDrop(e, slot) {
  e.preventDefault();
  slot.classList.remove('hover-valid', 'hover-invalid');
  if (!draggedItem) return;

  const slotType = slot.getAttribute('data-slot');
  const info = ITEMS[draggedItem.itemRef.type];

  // Validate
  let valid = false;
  if (slotType === 'helmet' && info.id === 'helmet') valid = true;
  else if (slotType === 'armor' && info.id === 'armor_heavy') valid = true;
  else if (slotType === 'weapon' && info.type === 'weapon') valid = true;
  else if (slotType === 'backpack' && info.type === 'backpack') valid = true;
  else if (slotType === 'ammo' && info.type === 'ammo') valid = true;
  else if ((slotType === 'pocket1' || slotType === 'pocket2') && info.type === 'med') valid = true;
  else if (slotType.startsWith('quick') && (info.type === 'med' || info.type === 'ammo')) valid = true;

  if (!valid) return;

  const isRaid = slot.id.startsWith('raid-');
  if (isRaid) {
    if (draggedItem.originSlot === 'backpack') {
      socket.emit('equip_item_in_raid', { itemId: draggedItem.itemRef.id, slot: slotType });
    } else if (draggedItem.originSlot === 'container') {
      showAnnouncement('請先將物品拾取至背包後再裝備！', 'info');
    } else {
      // Slot to slot move
      socket.emit('equip_item_in_raid', { itemId: draggedItem.itemRef.id, slot: slotType });
    }
    draggedItem = null;
    return;
  }

  // If slot already contains item, swap them
  const oldItem = currentUser.equipped[slotType];
  const hasOldItem = oldItem && oldItem.type !== null;

  if (hasOldItem) {
    const oldInfo = ITEMS[oldItem.type];
    if (draggedItem.originSlot === 'stash') {
      // 暫時將 draggedItem 從 stash 拿掉，再尋找空間
      const tempStash = currentUser.stash.filter(it => it.id !== draggedItem.itemRef.id);
      const space = findFreeSpaceInGrid(7, 100, tempStash, oldInfo.width, oldInfo.height);
      if (space) {
        currentUser.stash = tempStash;
        currentUser.stash.push({
          id: oldItem.id,
          type: oldItem.type,
          x: space.x,
          y: space.y,
          count: oldItem.count
        });
        currentUser.equipped[slotType] = draggedItem.itemRef;
      } else {
        showAnnouncement('倉庫空間不足，無法替換裝備！', 'error');
        return;
      }
    } else if (draggedItem.originSlot === 'backpack') {
      // 暫時將 draggedItem 從背包拿掉
      if (!currentUser.equipped.backpack || currentUser.equipped.backpack.type === null) {
        showAnnouncement('您沒有裝備背包，無法替換物品！', 'error');
        return;
      }
      const tempBagItems = currentUser.equipped.backpack.items.filter(it => it.id !== draggedItem.itemRef.id);
      const dims = getPlayerBagDimensions(currentUser.equipped, currentUser.level);
      const space = findFreeSpaceInGrid(dims.cols, dims.rows, tempBagItems, oldInfo.width, oldInfo.height);
      if (space) {
        currentUser.equipped.backpack.items = tempBagItems;
        currentUser.equipped.backpack.items.push({
          id: oldItem.id,
          type: oldItem.type,
          x: space.x,
          y: space.y,
          count: oldItem.count
        });
        currentUser.equipped[slotType] = draggedItem.itemRef;
      } else {
        showAnnouncement('背包空間不足，無法替換裝備！', 'error');
        return;
      }
    } else {
      // 裝備欄之間互相交換
      currentUser.equipped[draggedItem.originSlot] = oldItem;
      currentUser.equipped[slotType] = draggedItem.itemRef;
    }
  } else {
    // 沒有舊裝備，直接穿上
    if (draggedItem.originSlot === 'stash') {
      currentUser.stash = currentUser.stash.filter(it => it.id !== draggedItem.itemRef.id);
    } else if (draggedItem.originSlot === 'backpack') {
      if (currentUser.equipped.backpack) {
        currentUser.equipped.backpack.items = currentUser.equipped.backpack.items.filter(it => it.id !== draggedItem.itemRef.id);
      }
    } else {
      currentUser.equipped[draggedItem.originSlot] = null;
    }
    currentUser.equipped[slotType] = draggedItem.itemRef;
  }

  saveLobbyData();
  renderStash();
  renderLobbyBackpack();
  renderEquipped();
  draggedItem = null;
}

// Save Lobby state via WebSocket API
function saveLobbyData() {
  if (socket) {
    socket.emit('save_lobby_data', {
      userId: currentUser.id,
      stash: currentUser.stash,
      equipped: currentUser.equipped,
      cash: currentUser.cash,
      cheat_card_purchases: currentUser.cheat_card_purchases || 0
    });
  }
}

// ----------------------------------------------------
// Context Menu & Lobby Operations
// ----------------------------------------------------
const contextMenu = document.getElementById('custom-context-menu');
let contextActiveItem = null;
let contextActiveLocation = null;

function handleContextMenu(e, item, location) {
  e.preventDefault();
  contextActiveItem = item;
  contextActiveLocation = location;

  contextMenu.classList.remove('hidden');
  contextMenu.style.left = `${e.clientX}px`;
  contextMenu.style.top = `${e.clientY}px`;

  // Toggle options based on item characteristics and place
  const info = ITEMS[item.type];
  const itemEquip = document.getElementById('ctx-equip');
  const itemUnequip = document.getElementById('ctx-unequip');
  const itemUse = document.getElementById('ctx-use');
  const itemSell = document.getElementById('ctx-sell');
  const itemQuickSubmenu = document.getElementById('ctx-quick-submenu');
  const itemTransferToStash = document.getElementById('ctx-transfer-to-stash');
  const itemTransferToBag = document.getElementById('ctx-transfer-to-bag');

  if (location === 'stash' || location === 'backpack') {
    itemEquip.classList.remove('hidden');
    itemUnequip.classList.add('hidden');
    itemSell.classList.remove('hidden');
    if (info.type === 'med') itemUse.classList.remove('hidden');
    else itemUse.classList.add('hidden');

    if (info.type === 'med' || info.type === 'ammo') {
      itemQuickSubmenu.classList.remove('hidden');
    } else {
      itemQuickSubmenu.classList.add('hidden');
    }

    // Handle stash <-> backpack transfer options
    if (location === 'stash') {
      if (itemTransferToBag) itemTransferToBag.classList.remove('hidden');
      if (itemTransferToStash) itemTransferToStash.classList.add('hidden');
    } else {
      if (itemTransferToStash) itemTransferToStash.classList.remove('hidden');
      if (itemTransferToBag) itemTransferToBag.classList.add('hidden');
    }
  } else {
    // equipped items
    itemEquip.classList.add('hidden');
    itemUnequip.classList.remove('hidden');
    itemUse.classList.add('hidden');
    itemSell.classList.remove('hidden');
    itemQuickSubmenu.classList.add('hidden');
    if (itemTransferToStash) itemTransferToStash.classList.add('hidden');
    if (itemTransferToBag) itemTransferToBag.classList.add('hidden');
  }
}

// Close Context Menu
window.addEventListener('click', () => {
  contextMenu.classList.add('hidden');
  if (typeof raidContextMenu !== 'undefined' && raidContextMenu) {
    raidContextMenu.classList.add('hidden');
  }
});

// ----------------------------------------------------
// Raid Context Menu & Grid Operations
// ----------------------------------------------------
const raidContextMenu = document.getElementById('raid-context-menu');
let raidContextActiveItem = null;
let raidContextActiveLocation = null; // 'backpack' or slotName

function handleRaidContextMenu(e, item, location) {
  e.preventDefault();
  raidContextActiveItem = item;
  raidContextActiveLocation = location;

  raidContextMenu.classList.remove('hidden');
  raidContextMenu.style.left = `${e.clientX}px`;
  raidContextMenu.style.top = `${e.clientY}px`;

  const info = ITEMS[item.type];
  const itemUse = document.getElementById('raid-ctx-use');
  const itemEquip = document.getElementById('raid-ctx-equip');
  const itemQuickSubmenu = document.getElementById('raid-ctx-quick-submenu');
  const itemPut = document.getElementById('raid-ctx-put');
  const itemDrop = document.getElementById('raid-ctx-drop');

  // Configure visibility
  if (currentLootingContainerId && location === 'backpack') {
    itemPut.classList.remove('hidden');
  } else {
    itemPut.classList.add('hidden');
  }

  if (location === 'backpack') {
    itemDrop.classList.remove('hidden');
    if (info.type === 'med') {
      itemUse.classList.remove('hidden');
    } else {
      itemUse.classList.add('hidden');
    }
    if (info.type === 'med' || info.type === 'ammo') {
      itemEquip.classList.add('hidden');
      itemQuickSubmenu.classList.remove('hidden');
    } else {
      itemEquip.classList.remove('hidden');
      itemQuickSubmenu.classList.add('hidden');
    }
  } else {
    itemUse.classList.add('hidden');
    itemEquip.classList.add('hidden');
    itemQuickSubmenu.classList.add('hidden');
    itemDrop.classList.remove('hidden');
  }
}

// In-raid Context Menu Action Listeners
document.getElementById('raid-ctx-use').addEventListener('click', () => {
  if (!raidContextActiveItem) return;
  socket.emit('use_med_in_raid', { itemId: raidContextActiveItem.id, slot: 'backpack' });
  toggleRaidInventoryOverlay();
});

document.getElementById('raid-ctx-equip').addEventListener('click', () => {
  if (!raidContextActiveItem) return;
  const item = raidContextActiveItem;
  const info = ITEMS[item.type];
  if (!info) return;

  let targetSlot = null;
  if (info.id === 'helmet') targetSlot = 'helmet';
  else if (info.id === 'armor_heavy') targetSlot = 'armor';
  else if (info.type === 'weapon') targetSlot = 'weapon';
  else if (info.type === 'backpack') targetSlot = 'backpack';

  if (targetSlot) {
    socket.emit('equip_item_in_raid', { itemId: item.id, slot: targetSlot });
  } else {
    showAnnouncement('沒有合適的空裝備欄位！', 'error');
  }
});

for (let i = 1; i <= 5; i++) {
  document.getElementById(`raid-ctx-quick-${i}`).addEventListener('click', () => {
    if (!raidContextActiveItem) return;
    socket.emit('equip_item_in_raid', { itemId: raidContextActiveItem.id, slot: `quick${i}` });
  });
}

document.getElementById('raid-ctx-put').addEventListener('click', () => {
  if (!raidContextActiveItem || !currentLootingContainerId) return;
  socket.emit('put_item_to_container', {
    containerId: currentLootingContainerId,
    itemId: raidContextActiveItem.id
  });
});

document.getElementById('raid-ctx-drop').addEventListener('click', () => {
  if (!raidContextActiveItem) return;
  const source = raidContextActiveLocation === 'backpack' ? 'backpack' : 'equipped';
  socket.emit('drop_item_to_ground', {
    source: source,
    itemId: raidContextActiveItem.id,
    slot: raidContextActiveLocation
  });
});

// Configure Raid Grid drag over / drop actions
function handleRaidGridDragOver(e, grid) {
  e.preventDefault();
  if (!draggedItem) return;

  const info = ITEMS[draggedItem.itemRef.type];
  const rect = grid.getBoundingClientRect();
  const mouseX = e.clientX - rect.left;
  const mouseY = e.clientY - rect.top;

  const cellX = Math.floor(mouseX / cellStep);
  const cellY = Math.floor(mouseY / cellStep);

  const x = cellX - draggedOffsetCells.x;
  const y = cellY - draggedOffsetCells.y;

  let maxCols = 4;
  let maxRows = 4;
  if (grid.id !== 'loot-box-grid') {
    const dims = getPlayerBagDimensions(currentUser.equipped, currentUser.level);
    maxCols = dims.cols;
    maxRows = dims.rows;
  }

  const inBounds = x >= 0 && x + info.width <= maxCols && y >= 0 && y + info.height <= maxRows;

  let overlaps = false;
  let existingItems = [];
  if (grid.id === 'loot-box-grid') {
    existingItems = currentLootingContainerItems || [];
  } else {
    existingItems = (currentUser.equipped.backpack ? currentUser.equipped.backpack.items : []) || [];
  }

  if (inBounds) {
    for (const it of existingItems) {
      if (it.id === draggedItem.itemRef.id) continue;
      const itInfo = ITEMS[it.type];
      const hasOverlap = !(
        (x + info.width <= it.x) ||
        (it.x + itInfo.width <= x) ||
        (y + info.height <= it.y) ||
        (it.y + itInfo.height <= y)
      );
      if (hasOverlap) {
        overlaps = true;
        break;
      }
    }
  }

  removeDragHighlight();
  const hl = document.createElement('div');
  hl.style.position = 'absolute';
  hl.style.left = `${x * cellStep + 4}px`;
  hl.style.top = `${y * cellStep + 4}px`;
  hl.style.width = `${info.width * cellStep - 2}px`;
  hl.style.height = `${info.height * cellStep - 2}px`;
  hl.style.pointerEvents = 'none';
  hl.style.borderRadius = '4px';
  hl.style.zIndex = '5';
  
  if (inBounds && !overlaps) {
    hl.classList.add('highlight-valid');
  } else {
    hl.classList.add('highlight-invalid');
  }
  grid.appendChild(hl);
  currentDragHighlight = hl;
}

function handleRaidGridDrop(e, grid, destLocation) {
  e.preventDefault();
  removeDragHighlight();
  if (!draggedItem) return;

  const info = ITEMS[draggedItem.itemRef.type];
  const rect = grid.getBoundingClientRect();
  const mouseX = e.clientX - rect.left;
  const mouseY = e.clientY - rect.top;

  const cellX = Math.floor(mouseX / cellStep);
  const cellY = Math.floor(mouseY / cellStep);

  const x = cellX - draggedOffsetCells.x;
  const y = cellY - draggedOffsetCells.y;

  let maxCols = 4;
  let maxRows = 4;
  if (grid.id !== 'loot-box-grid') {
    const dims = getPlayerBagDimensions(currentUser.equipped, currentUser.level);
    maxCols = dims.cols;
    maxRows = dims.rows;
  }

  const inBounds = x >= 0 && x + info.width <= maxCols && y >= 0 && y + info.height <= maxRows;
  if (!inBounds) return;

  let existingItems = [];
  if (grid.id === 'loot-box-grid') {
    existingItems = currentLootingContainerItems || [];
  } else {
    existingItems = (currentUser.equipped.backpack ? currentUser.equipped.backpack.items : []) || [];
  }

  let overlaps = false;
  for (const it of existingItems) {
    if (it.id === draggedItem.itemRef.id) continue;
    const itInfo = ITEMS[it.type];
    const hasOverlap = !(
      (x + info.width <= it.x) ||
      (it.x + itInfo.width <= x) ||
      (y + info.height <= it.y) ||
      (it.y + itInfo.height <= y)
    );
    if (hasOverlap) {
      overlaps = true;
      break;
    }
  }

  if (overlaps) return;

  const origin = draggedItem.originSlot;
  if (destLocation === 'backpack') {
    if (origin === 'backpack') {
      socket.emit('move_backpack_item_in_raid', { itemId: draggedItem.itemRef.id, toX: x, toY: y });
    } else if (origin === 'container') {
      socket.emit('loot_item', { containerId: draggedItem.containerId, itemId: draggedItem.itemRef.id, toX: x, toY: y });
    } else {
      socket.emit('unequip_item_in_raid', { slot: origin });
    }
  } else if (destLocation === 'container') {
    if (origin === 'backpack') {
      socket.emit('put_item_to_container', { containerId: currentLootingContainerId, itemId: draggedItem.itemRef.id, toX: x, toY: y });
    }
  }

  draggedItem = null;
}

const raidBagGrid = document.getElementById('raid-bag-grid');
const raidLootBagGrid = document.getElementById('raid-loot-bag-grid');
const lootBoxGrid = document.getElementById('loot-box-grid');

raidBagGrid.addEventListener('dragover', (e) => handleRaidGridDragOver(e, raidBagGrid));
raidBagGrid.addEventListener('dragleave', removeDragHighlight);
raidBagGrid.addEventListener('drop', (e) => handleRaidGridDrop(e, raidBagGrid, 'backpack'));

raidLootBagGrid.addEventListener('dragover', (e) => handleRaidGridDragOver(e, raidLootBagGrid));
raidLootBagGrid.addEventListener('dragleave', removeDragHighlight);
raidLootBagGrid.addEventListener('drop', (e) => handleRaidGridDrop(e, raidLootBagGrid, 'backpack'));

lootBoxGrid.addEventListener('dragover', (e) => handleRaidGridDragOver(e, lootBoxGrid));
lootBoxGrid.addEventListener('dragleave', removeDragHighlight);
lootBoxGrid.addEventListener('drop', (e) => handleRaidGridDrop(e, lootBoxGrid, 'container'));


// Prevent default browser context menu globally inside the game
window.addEventListener('contextmenu', (e) => {
  e.preventDefault();
});

// Context Menu Action Listeners
document.getElementById('ctx-equip').addEventListener('click', () => {
  if (!contextActiveItem) return;
  const info = ITEMS[contextActiveItem.type];
  
  // Decide slot
  let targetSlot = null;
  if (info.id === 'helmet') targetSlot = 'helmet';
  else if (info.id === 'armor_heavy') targetSlot = 'armor';
  else if (info.type === 'weapon') targetSlot = 'weapon';
  else if (info.type === 'backpack') targetSlot = 'backpack';
  else if (info.type === 'ammo') {
    if (!currentUser.equipped.ammo) targetSlot = 'ammo';
    else if (!currentUser.equipped.quick1) targetSlot = 'quick1';
    else if (!currentUser.equipped.quick2) targetSlot = 'quick2';
    else if (!currentUser.equipped.quick3) targetSlot = 'quick3';
    else if (!currentUser.equipped.quick4) targetSlot = 'quick4';
    else if (!currentUser.equipped.quick5) targetSlot = 'quick5';
  }
  else if (info.type === 'med') {
    if (!currentUser.equipped.pocket1) targetSlot = 'pocket1';
    else if (!currentUser.equipped.pocket2) targetSlot = 'pocket2';
    else if (!currentUser.equipped.quick1) targetSlot = 'quick1';
    else if (!currentUser.equipped.quick2) targetSlot = 'quick2';
    else if (!currentUser.equipped.quick3) targetSlot = 'quick3';
    else if (!currentUser.equipped.quick4) targetSlot = 'quick4';
    else if (!currentUser.equipped.quick5) targetSlot = 'quick5';
  }

  if (targetSlot) {
    if (contextActiveLocation === 'stash') {
      currentUser.stash = currentUser.stash.filter(it => it.id !== contextActiveItem.id);
    } else if (contextActiveLocation === 'backpack') {
      if (currentUser.equipped.backpack) {
        currentUser.equipped.backpack.items = currentUser.equipped.backpack.items.filter(it => it.id !== contextActiveItem.id);
      }
    }
    currentUser.equipped[targetSlot] = contextActiveItem;
    saveLobbyData();
    renderStash();
    renderLobbyBackpack();
    renderEquipped();
  } else {
    showAnnouncement('沒有合適的空裝備欄位！', 'error');
  }
});

// Quick Slot submenu item click handlers
for (let i = 1; i <= 5; i++) {
  document.getElementById(`ctx-quick-${i}`).addEventListener('click', () => {
    if (!contextActiveItem) return;
    equipToQuickSlot(`quick${i}`);
  });
}

function equipToQuickSlot(targetSlot) {
  const item = contextActiveItem;
  const info = ITEMS[item.type];
  if (!info) return;

  if (info.type !== 'med' && info.type !== 'ammo') {
    showAnnouncement('此物品無法放入快捷鍵欄位！', 'error');
    return;
  }

  if (currentUser.equipped[targetSlot]) {
    const oldItem = currentUser.equipped[targetSlot];
    // Temporarily remove new item from source to free its cells
    if (contextActiveLocation === 'stash') {
      currentUser.stash = currentUser.stash.filter(it => it.id !== item.id);
      const oldInfo = ITEMS[oldItem.type];
      const space = findFreeStashSpace(oldInfo.width, oldInfo.height);
      if (space) {
        currentUser.stash.push({
          id: oldItem.id,
          type: oldItem.type,
          x: space.x,
          y: space.y,
          count: oldItem.count
        });
        currentUser.equipped[targetSlot] = item;
        saveLobbyData();
        renderStash();
        renderLobbyBackpack();
        renderEquipped();
        showAnnouncement(`已成功替換並裝備 ${info.name} 至快捷鍵 ${targetSlot.replace('quick', '')}`, 'success');
      } else {
        currentUser.stash.push(item);
        showAnnouncement('倉庫空間不足，無法替換物品！', 'error');
      }
    } else if (contextActiveLocation === 'backpack') {
      if (!currentUser.equipped.backpack) return;
      currentUser.equipped.backpack.items = currentUser.equipped.backpack.items.filter(it => it.id !== item.id);
      const oldInfo = ITEMS[oldItem.type];
      const space = findFreeLobbyBagSpace(oldInfo.width, oldInfo.height);
      if (space) {
        currentUser.equipped.backpack.items.push({
          id: oldItem.id,
          type: oldItem.type,
          x: space.x,
          y: space.y,
          count: oldItem.count
        });
        currentUser.equipped[targetSlot] = item;
        saveLobbyData();
        renderStash();
        renderLobbyBackpack();
        renderEquipped();
        showAnnouncement(`已成功替換並裝備 ${info.name} 至快捷鍵 ${targetSlot.replace('quick', '')}`, 'success');
      } else {
        currentUser.equipped.backpack.items.push(item);
        showAnnouncement('背包空間不足，無法替換物品！', 'error');
      }
    }
  } else {
    if (contextActiveLocation === 'stash') {
      currentUser.stash = currentUser.stash.filter(it => it.id !== item.id);
    } else if (contextActiveLocation === 'backpack') {
      if (currentUser.equipped.backpack) {
        currentUser.equipped.backpack.items = currentUser.equipped.backpack.items.filter(it => it.id !== item.id);
      }
    }
    currentUser.equipped[targetSlot] = item;
    saveLobbyData();
    renderStash();
    renderLobbyBackpack();
    renderEquipped();
    showAnnouncement(`已裝備 ${info.name} 至快捷鍵 ${targetSlot.replace('quick', '')}`, 'success');
  }
}

document.getElementById('ctx-unequip').addEventListener('click', () => {
  if (!contextActiveItem) return;
  
  const info = ITEMS[contextActiveItem.type];
  // 1. Try stash
  let space = findFreeStashSpace(info.width, info.height);
  if (space) {
    currentUser.equipped[contextActiveLocation] = null;
    currentUser.stash.push({
      id: contextActiveItem.id,
      type: contextActiveItem.type,
      x: space.x,
      y: space.y,
      count: contextActiveItem.count
    });
    saveLobbyData();
    renderStash();
    renderLobbyBackpack();
    renderEquipped();
    showAnnouncement(`已卸下 ${info.name} 至倉庫`, 'success');
    return;
  }

  // 2. Try backpack
  if (currentUser.equipped.backpack && currentUser.equipped.backpack.type !== null) {
    space = findFreeLobbyBagSpace(info.width, info.height);
    if (space) {
      currentUser.equipped[contextActiveLocation] = null;
      if (!currentUser.equipped.backpack.items) {
        currentUser.equipped.backpack.items = [];
      }
      currentUser.equipped.backpack.items.push({
        id: contextActiveItem.id,
        type: contextActiveItem.type,
        x: space.x,
        y: space.y,
        count: contextActiveItem.count
      });
      saveLobbyData();
      renderStash();
      renderLobbyBackpack();
      renderEquipped();
      showAnnouncement(`已卸下 ${info.name} 至背包`, 'success');
      return;
    }
  }

  showAnnouncement('倉庫與背包空間均不足，無法卸下！', 'error');
});

document.getElementById('ctx-use').addEventListener('click', () => {
  if (!contextActiveItem) return;
  showAnnouncement('在大廳直接使用藥品無效，請進入戰區部署。', 'info');
});

document.getElementById('ctx-sell').addEventListener('click', () => {
  if (contextActiveItem) {
    sellItem(contextActiveItem, contextActiveLocation);
  }
});

document.getElementById('ctx-transfer-to-stash').addEventListener('click', () => {
  if (!contextActiveItem) return;
  const info = ITEMS[contextActiveItem.type];
  if (!info) return;

  const space = findFreeStashSpace(info.width, info.height);
  if (space) {
    // 從大廳背包中移除
    if (currentUser.equipped.backpack) {
      currentUser.equipped.backpack.items = currentUser.equipped.backpack.items.filter(it => it.id !== contextActiveItem.id);
    }
    // 加入倉庫
    currentUser.stash.push({
      id: contextActiveItem.id,
      type: contextActiveItem.type,
      x: space.x,
      y: space.y,
      count: contextActiveItem.count
    });

    saveLobbyData();
    renderStash();
    renderLobbyBackpack();
    renderEquipped();
    showAnnouncement(`已將 ${info.name} 移入倉庫`, 'success');
  } else {
    showAnnouncement('倉庫空間不足，無法移入！', 'error');
  }
});

document.getElementById('ctx-transfer-to-bag').addEventListener('click', () => {
  if (!contextActiveItem) return;
  const info = ITEMS[contextActiveItem.type];
  if (!info) return;

  if (!currentUser.equipped.backpack || currentUser.equipped.backpack.type === null) {
    showAnnouncement('您沒有裝備背包，無法移入！', 'error');
    return;
  }

  const space = findFreeLobbyBagSpace(info.width, info.height);
  if (space) {
    // 從個人倉庫中移除
    currentUser.stash = currentUser.stash.filter(it => it.id !== contextActiveItem.id);
    // 加入背包
    if (!currentUser.equipped.backpack.items) {
      currentUser.equipped.backpack.items = [];
    }
    currentUser.equipped.backpack.items.push({
      id: contextActiveItem.id,
      type: contextActiveItem.type,
      x: space.x,
      y: space.y,
      count: contextActiveItem.count
    });

    saveLobbyData();
    renderStash();
    renderLobbyBackpack();
    renderEquipped();
    showAnnouncement(`已將 ${info.name} 移入背包`, 'success');
  } else {
    showAnnouncement('背包空間不足，無法移入！', 'error');
  }
});

// Generic function to find free space in a grid
function findFreeSpaceInGrid(cols, rows, items, w, h) {
  const grid = Array(rows).fill(null).map(() => Array(cols).fill(false));
  
  items.forEach(it => {
    const itInfo = ITEMS[it.type];
    if (!itInfo) return;
    for (let r = 0; r < itInfo.height; r++) {
      for (let c = 0; c < itInfo.width; c++) {
        const targetY = it.y + r;
        const targetX = it.x + c;
        if (targetY < rows && targetX < cols) {
          grid[targetY][targetX] = true;
        }
      }
    }
  });

  for (let y = 0; y <= rows - h; y++) {
    for (let x = 0; x <= cols - w; x++) {
      let fits = true;
      for (let r = 0; r < h; r++) {
        for (let c = 0; c < w; c++) {
          if (grid[y+r][x+c]) fits = false;
        }
      }
      if (fits) return { x, y };
    }
  }
  return null;
}

// Find free Stash coordinates
function findFreeStashSpace(w, h) {
  return findFreeSpaceInGrid(7, 100, currentUser.stash, w, h);
}

// Find free Lobby Backpack coordinates
function findFreeLobbyBagSpace(w, h) {
  if (!currentUser.equipped.backpack || currentUser.equipped.backpack.type === null) return null;
  const dims = getPlayerBagDimensions(currentUser.equipped, currentUser.level);
  const items = currentUser.equipped.backpack.items || [];
  return findFreeSpaceInGrid(dims.cols, dims.rows, items, w, h);
}

// ----------------------------------------------------
// Black Market Buy and Sell Operations
// ----------------------------------------------------
function renderShop() {
  const container = document.getElementById('shop-items-container');
  if (!container) return;
  container.innerHTML = '';

  const lvl = currentUser.level || 1;

  // 1. Basic Items (Always white rarity)
  const basicItems = [
    { type: 'ammo_9mm', rarity: 'white' },
    { type: 'ammo_556', rarity: 'white' },
    { type: 'ammo_12g', rarity: 'white' },
    { type: 'bandage', rarity: 'white' },
    { type: 'medkit', rarity: 'white' },
    { type: 'pistol', rarity: 'white' },
    { type: 'shotgun', rarity: 'white' },
    { type: 'rifle', rarity: 'white' },
    { type: 'armor_heavy', rarity: 'white' },
    { type: 'helmet', rarity: 'white' },
    { type: 'backpack_small', rarity: 'white' }
  ];

  const shopItems = [...basicItems];

  // 2. Roll for high tier items based on level
  const upgradeTypes = ['pistol', 'shotgun', 'rifle', 'armor_heavy', 'helmet', 'backpack_small'];
  const rarities = ['green', 'blue', 'gold', 'red'];
  const rollChances = {
    green: 0.10 + lvl * 0.01,
    blue: 0.05 + lvl * 0.01,
    gold: 0.02 + lvl * 0.01,
    red: 0.005 + lvl * 0.01
  };

  upgradeTypes.forEach(type => {
    rarities.forEach(rarity => {
      const roll = Math.random();
      if (roll < rollChances[rarity]) {
        shopItems.push({ type, rarity });
      }
    });
  });

  // 3. Render cards dynamically
  shopItems.forEach(shopItem => {
    const isCheatCard = shopItem.type === 'cheat_card';
    const purchases = currentUser.cheat_card_purchases || 0;
    const cheatCardPrice = purchases === 0 ? 1000 : 10000;

    const stats = getItemStats({ type: shopItem.type, rarity: shopItem.rarity });
    if (!stats) return;

    if (isCheatCard) {
      stats.price = cheatCardPrice;
      stats.sellPrice = Math.round(cheatCardPrice / 2);
    }

    const card = document.createElement('div');
    card.className = `shop-card rarity-${shopItem.rarity}`;

    const qty = stats.maxStack || 1;
    const totalPrice = stats.price * qty;
    const priceText = `$${totalPrice.toLocaleString()}`;
    const rarityLabel = {
      white: '白',
      green: '綠',
      blue: '藍',
      gold: '金',
      red: '紅'
    }[shopItem.rarity];

    let desc = '';
    if (stats.type === 'weapon') desc = `傷害: ${stats.baseDamage}`;
    else if (stats.type === 'armor') desc = `減傷: ${Math.round(stats.reduction * 100)}%`;
    else if (stats.type === 'backpack') {
      const dims = getPlayerBagDimensions({ backpack: { type: stats.id, rarity: shopItem.rarity } });
      desc = `容量: ${dims.cols * dims.rows}格 (${dims.cols}x${dims.rows})`;
    }
    else if (stats.type === 'ammo') desc = `數量: 一盒 ${qty} 發`;
    else if (stats.type === 'med') desc = `回復: ${stats.heal} HP`;

    card.innerHTML = `
      <div class="shop-card-info">
        <span class="shop-card-name rarity-text-${shopItem.rarity}">${stats.name} (${rarityLabel})</span>
        <span class="shop-card-desc">${desc}</span>
        <span class="shop-card-price">${priceText}</span>
      </div>
      <button class="btn-buy rarity-btn-${shopItem.rarity}">購買</button>
    `;

    card.querySelector('.btn-buy').addEventListener('click', () => {
      buyItem(shopItem.type, shopItem.rarity);
    });

    container.appendChild(card);
  });
}

function buyItem(type, rarity = 'white') {
  const isCheatCard = type === 'cheat_card';
  const purchases = currentUser.cheat_card_purchases || 0;
  const cheatCardPrice = purchases === 0 ? 1000 : 10000;

  const stats = getItemStats({ type, rarity });
  if (!stats) return;

  if (isCheatCard) {
    stats.price = cheatCardPrice;
    stats.sellPrice = Math.round(cheatCardPrice / 2);
  }

  const qty = stats.maxStack || 1;
  const totalPrice = stats.price * qty;

  if (currentUser.cash < totalPrice) {
    showAnnouncement('美金餘額不足，無法購買！', 'error');
    return;
  }

  const isWeapon = stats.type === 'weapon';
  let weaponSpace = null;
  let ammoSpace = null;

  if (isWeapon) {
    // 1. Find space for weapon
    weaponSpace = findFreeStashSpace(stats.width, stats.height);
    if (!weaponSpace) {
      showAnnouncement('倉庫空間不足以容納槍枝！', 'error');
      return;
    }

    // 2. Simulate inserting weapon to find space for its ammunition
    const tempStash = [...currentUser.stash, {
      id: 'temp-weapon',
      type: type,
      rarity: rarity,
      x: weaponSpace.x,
      y: weaponSpace.y,
      count: qty
    }];
    
    const ammoType = stats.ammoType || 'ammo_9mm';
    const ammoInfo = ITEMS[ammoType];
    ammoSpace = findFreeSpaceInGrid(7, 100, tempStash, ammoInfo.width, ammoInfo.height);
    if (!ammoSpace) {
      showAnnouncement('倉庫空間不足以容納配贈的子彈！', 'error');
      return;
    }
  } else {
    // Non-weapon normal check
    const space = findFreeStashSpace(stats.width, stats.height);
    if (!space) {
      showAnnouncement('倉庫空間已滿，請先整理倉庫！', 'error');
      return;
    }
    weaponSpace = space;
  }

  // Deduct cash and grant item(s)
  currentUser.cash -= totalPrice;
  
  if (isWeapon) {
    currentUser.stash.push({
      id: 'bought-' + Math.random(),
      type: type,
      rarity: rarity,
      x: weaponSpace.x,
      y: weaponSpace.y,
      count: qty
    });
    
    const ammoType = stats.ammoType || 'ammo_9mm';
    const ammoInfo = ITEMS[ammoType];
    currentUser.stash.push({
      id: 'bought-ammo-' + Math.random(),
      type: ammoType,
      rarity: 'white',
      x: ammoSpace.x,
      y: ammoSpace.y,
      count: ammoInfo.maxStack || 60
    });
    showAnnouncement(`購買成功！獲得 ${stats.name}，並配贈一盒 ${ammoInfo.name}！`, 'success');
  } else {
    currentUser.stash.push({
      id: 'bought-' + Math.random(),
      type: type,
      rarity: rarity,
      x: weaponSpace.x,
      y: weaponSpace.y,
      count: qty
    });
    showAnnouncement(`購買成功！獲得 ${stats.name}`, 'success');
  }

  if (isCheatCard) {
    currentUser.cheat_card_purchases = (currentUser.cheat_card_purchases || 0) + 1;
  }

  saveLobbyData();
  loadLobbyUI();
}

function sellItem(item, location) {
  const stats = getItemStats(item);
  if (!stats) return;

  const isCheatCard = item.type === 'cheat_card';
  if (isCheatCard) {
    const purchases = currentUser.cheat_card_purchases || 0;
    const cheatCardPrice = purchases <= 1 ? 1000 : 10000;
    stats.sellPrice = Math.round(cheatCardPrice / 2);
  }

  // Add Cash
  const reward = stats.sellPrice * (item.count || 1);
  currentUser.cash += reward;

  // Delete item from stash/equipped/backpack
  if (location === 'stash') {
    currentUser.stash = currentUser.stash.filter(it => it.id !== item.id);
  } else if (location === 'backpack') {
    if (currentUser.equipped.backpack) {
      currentUser.equipped.backpack.items = currentUser.equipped.backpack.items.filter(it => it.id !== item.id);
    }
  } else {
    currentUser.equipped[location] = null;
  }

  saveLobbyData();
  loadLobbyUI();
}

// ----------------------------------------------------
// Deploy Matchmaking Trigger
// ----------------------------------------------------
document.getElementById('btn-deploy').addEventListener('click', () => {
  // Show matchmaking waiting modal
  document.getElementById('match-overlay').classList.remove('hidden');
  
  // Enter Raid
  setTimeout(() => {
    if (socket) {
      socket.emit('enter_raid', { userId: currentUser.id });
    }
  }, 1000);
});

// ----------------------------------------------------
// Global Announcement Notice Banner (Universal Toast)
// ----------------------------------------------------
let announcementTimeout = null;
function showAnnouncement(message, type = 'info') {
  const el = document.getElementById('global-announcement');
  const txt = document.getElementById('announcement-text');
  if (!el || !txt) return;

  txt.textContent = message;
  
  // Set theme classes
  el.className = 'announcement-banner';
  if (type === 'error') {
    el.classList.add('error');
  } else if (type === 'success') {
    el.classList.add('success');
  } else {
    el.classList.add('info');
  }

  el.classList.remove('hidden');
  el.style.opacity = '1';

  if (announcementTimeout) {
    clearTimeout(announcementTimeout);
  }

  // Fade out after 2.5 seconds
  announcementTimeout = setTimeout(() => {
    el.style.opacity = '0';
    setTimeout(() => {
      if (el.style.opacity === '0') {
        el.classList.add('hidden');
      }
    }, 300);
  }, 2500);
}

// ----------------------------------------------------
// Global Item Tooltip HUD Bindings
// ----------------------------------------------------
function bindTooltip(element, item) {
  element.addEventListener('mouseenter', (e) => {
    showTooltip(e, item);
  });
  element.addEventListener('mousemove', (e) => {
    moveTooltip(e);
  });
  element.addEventListener('mouseleave', () => {
    hideTooltip();
  });
  // Hide tooltip if drag starts
  element.addEventListener('dragstart', () => {
    hideTooltip();
  });
}

function showTooltip(e, itemInput) {
  let itemObj = itemInput;
  if (typeof itemInput === 'string') {
    itemObj = { type: itemInput, rarity: 'white' };
  }
  
  const stats = getItemStats(itemObj);
  if (!stats) return;

  const tooltip = document.getElementById('item-tooltip');
  if (!tooltip) return;

  const rarityLabel = {
    white: '白色 (普通)',
    green: '綠色 (精良)',
    blue: '藍色 (稀有)',
    gold: '金色 (史詩)',
    red: '紅色 (傳說)'
  }[stats.rarity];

  let html = `<div class="tooltip-title rarity-text-${stats.rarity}">${stats.name} (${rarityLabel})</div>`;

  if (stats.type === 'weapon') {
    html += `<div class="tooltip-row"><span class="tooltip-label">類型:</span><span class="tooltip-value">武器</span></div>`;
    const medalBonus = (currentUser && currentUser.medal_count) ? currentUser.medal_count : 0;
    if (medalBonus > 0) {
      html += `<div class="tooltip-row"><span class="tooltip-label">攻擊力:</span><span class="tooltip-value damage">${stats.baseDamage} <span style="color:#ffaa00; font-size:10px;">(+${medalBonus} 勳章加成)</span></span></div>`;
    } else {
      html += `<div class="tooltip-row"><span class="tooltip-label">攻擊力:</span><span class="tooltip-value damage">${stats.baseDamage}</span></div>`;
    }
    html += `<div class="tooltip-row"><span class="tooltip-label">彈匣容量:</span><span class="tooltip-value">${stats.maxAmmo} 發</span></div>`;
    if (stats.reloadTime) {
      html += `<div class="tooltip-row"><span class="tooltip-label">裝彈時間:</span><span class="tooltip-value">${(stats.reloadTime / 1000).toFixed(1)} 秒</span></div>`;
    }
  } else if (stats.type === 'armor') {
    const isHelmet = stats.id === 'helmet';
    html += `<div class="tooltip-row"><span class="tooltip-label">類型:</span><span class="tooltip-value">${isHelmet ? '防護頭盔' : '防彈護甲'}</span></div>`;
    html += `<div class="tooltip-row"><span class="tooltip-label">防禦減傷:</span><span class="tooltip-value reduction">${Math.round(stats.reduction * 100)}%</span></div>`;
    if (stats.id === 'armor_heavy') {
      html += `<div class="tooltip-row"><span class="tooltip-label">移動速度:</span><span class="tooltip-value damage">-15%</span></div>`;
    }
  } else if (stats.type === 'backpack') {
    const dims = getPlayerBagDimensions({ backpack: { type: stats.id, rarity: stats.rarity } });
    html += `<div class="tooltip-row"><span class="tooltip-label">類型:</span><span class="tooltip-value">戰術背包</span></div>`;
    html += `<div class="tooltip-row"><span class="tooltip-label">容量大小:</span><span class="tooltip-value">${dims.cols * dims.rows} 格 (${dims.cols}x${dims.rows})</span></div>`;
  } else if (stats.type === 'med') {
    html += `<div class="tooltip-row"><span class="tooltip-label">類型:</span><span class="tooltip-value">醫療物資</span></div>`;
    html += `<div class="tooltip-row"><span class="tooltip-label">生命回復:</span><span class="tooltip-value heal">+${stats.heal} HP</span></div>`;
    html += `<div class="tooltip-row"><span class="tooltip-label">使用時間:</span><span class="tooltip-value">${(stats.useTime / 1000).toFixed(1)} 秒</span></div>`;
    if (stats.maxStack) {
      html += `<div class="tooltip-row"><span class="tooltip-label">最大堆疊:</span><span class="tooltip-value">${stats.maxStack}</span></div>`;
    }
  } else if (stats.type === 'ammo') {
    html += `<div class="tooltip-row"><span class="tooltip-label">類型:</span><span class="tooltip-value">武器彈藥</span></div>`;
    if (stats.maxStack) {
      html += `<div class="tooltip-row"><span class="tooltip-label">單包最大:</span><span class="tooltip-value">${stats.maxStack} 發</span></div>`;
    }
  } else if (stats.type === 'special') {
    html += `<div class="tooltip-row"><span class="tooltip-label">類型:</span><span class="tooltip-value">特殊物品</span></div>`;
    html += `<div class="tooltip-row"><span class="tooltip-label">功能:</span><span class="tooltip-value" style="color:#00ff88; font-weight:800;">除迷霧 (全圖可見)</span></div>`;
  }

  if (stats.maxDurability !== undefined && stats.durability !== undefined) {
    const percent = Math.round((stats.durability / stats.maxDurability) * 100);
    const color = percent < 30 ? '#ff3b30' : '#34c759';
    html += `<div class="tooltip-row"><span class="tooltip-label">耐久度:</span><span class="tooltip-value" style="color: ${color}; font-weight: bold;">${stats.durability} / ${stats.maxDurability} (${percent}%)</span></div>`;
  }

  // Price Information
  if (stats.price !== undefined) {
    html += `<div class="tooltip-row"><span class="tooltip-label">購買價格:</span><span class="tooltip-value price">$${stats.price.toLocaleString()}</span></div>`;
  }
  if (stats.sellPrice !== undefined) {
    html += `<div class="tooltip-row"><span class="tooltip-label">回收價值:</span><span class="tooltip-value price">$${stats.sellPrice.toLocaleString()}</span></div>`;
  }

  // Size Information
  html += `<div class="tooltip-row"><span class="tooltip-label">格數大小:</span><span class="tooltip-value">${stats.width}x${stats.height}</span></div>`;

  tooltip.innerHTML = html;
  tooltip.classList.remove('hidden');

  // Initial positioning
  moveTooltip(e);
}

function moveTooltip(e) {
  const tooltip = document.getElementById('item-tooltip');
  if (tooltip) {
    const tooltipWidth = tooltip.offsetWidth || 200;
    const tooltipHeight = tooltip.offsetHeight || 150;

    let x = e.clientX + 15;
    let y = e.clientY + 15;

    // Boundary restriction
    if (x + tooltipWidth > window.innerWidth) {
      x = e.clientX - tooltipWidth - 10;
    }
    if (y + tooltipHeight > window.innerHeight) {
      y = e.clientY - tooltipHeight - 10;
    }

    tooltip.style.left = `${x}px`;
    tooltip.style.top = `${y}px`;
  }
}

function hideTooltip() {
  const tooltip = document.getElementById('item-tooltip');
  if (tooltip) {
    tooltip.classList.add('hidden');
  }
}

function showAnnouncement(message, type = 'info') {
  const el = document.getElementById('global-announcement');
  const txt = document.getElementById('announcement-text');
  if (!el || !txt) return;

  txt.textContent = message;
  
  // Set theme classes
  el.className = 'announcement-banner';
  if (type === 'error') {
    el.classList.add('error');
  } else if (type === 'success') {
    el.classList.add('success');
  } else {
    el.classList.add('info');
  }

  el.classList.remove('hidden');
  el.style.opacity = '1';

  if (announcementTimeout) {
    clearTimeout(announcementTimeout);
  }

  // Fade out after 2.5 seconds
  announcementTimeout = setTimeout(() => {
    el.style.opacity = '0';
    setTimeout(() => {
      if (el.style.opacity === '0') {
        el.classList.add('hidden');
      }
    }, 300);
  }, 2500);
}

// ----------------------------------------------------
// Socket.io Real-Time Synchronization
// ----------------------------------------------------
function initSocketConnection() {
  if (socket) return;
  socket = io();

  // Save validation feedback
  socket.on('lobby_data_saved', ({ cash }) => {
    currentUser.cash = cash;
  });

  // Quests & claim listeners
  socket.on('quests_updated', ({ quests }) => {
    currentUser.quests = quests;
    renderQuests();
  });

  socket.on('quest_claim_success', ({ questId, cash, medal_count, quests }) => {
    showAnnouncement('領取獎勵成功！', 'success');
    currentUser.cash = cash;
    currentUser.medal_count = medal_count;
    currentUser.quests = quests;
    loadLobbyUI();
  });

  socket.on('error_msg', ({ message }) => {
    document.getElementById('match-overlay').classList.add('hidden');
    showAnnouncement(message, 'error');
  });

  // Successful entering to Raid
  socket.on('joined_raid', (data) => {
    inRaid = true;
    document.getElementById('match-overlay').classList.add('hidden');
    showScreen('raid-screen');

    // Init values
    localPlayer.x = data.x;
    localPlayer.y = data.y;
    localPlayer.health = data.health;
    localPlayer.maxHealth = data.maxHealth;
    localPlayer.ammoCount = data.ammoCount;
    localPlayer.maxAmmo = data.maxAmmo;
    localPlayer.weaponType = data.weaponType;

    mapGrid = data.mapGrid;
    extractions = data.extractions;

    // Reset controls
    keys.w = keys.a = keys.s = keys.d = keys.r = false;

    // Clear local lists
    entities.clear();
    activeBullets = [];
    bloodParticles = [];

    // Keyboard registers
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    canvas.addEventListener('mousemove', handleMouseMove);
    canvas.addEventListener('mousedown', handleMouseDown);
    
    // Start drawing loop
    renderRaidHotbar();
    requestAnimationFrame(renderLoop);
  });

  // Authoritative Ticks updates package
  socket.on('raid_update', (pack) => {
    if (!inRaid) return;

    // Update Local player parameters
    const localServer = pack.players.find(p => p.id === socket.id);
    if (localServer) {
      // Store health and actions indicators
      localPlayer.health = localServer.health;
      
      // Extraction notification
      const indicator = document.getElementById('extract-indicator');
      const timer = document.getElementById('extract-countdown');
      if (localServer.extracting) {
        indicator.classList.remove('hidden');
        timer.textContent = localServer.extractTimer;
      } else {
        indicator.classList.add('hidden');
      }

      // Input reconcile: if client deviates significantly from server position, pull
      const dx = localPlayer.x - localServer.x;
      const dy = localPlayer.y - localServer.y;
      const dist = Math.sqrt(dx*dx + dy*dy);
      
      if (dist > 64) {
        // High rubber banding, hard snap
        localPlayer.x = localServer.x;
        localPlayer.y = localServer.y;
      } else if (dist > 2) {
        // Smooth pulling interpolation
        localPlayer.x = localPlayer.x * 0.9 + localServer.x * 0.1;
        localPlayer.y = localPlayer.y * 0.9 + localServer.y * 0.1;
      }
    }

    // Sync other players & bots into map
    const serverEntities = new Map();
    pack.players.forEach(p => {
      if (p.id !== socket.id) serverEntities.set(p.id, { ...p, type: 'player' });
    });
    pack.bots.forEach(b => {
      serverEntities.set(b.id, { ...b, type: 'bot' });
    });

    // Run interpolation positions on entities
    serverEntities.forEach((servEnt, id) => {
      const existing = entities.get(id);
      if (!existing) {
        entities.set(id, servEnt); // add new entity
      } else {
        // Linear Interpolate LERP to align matching 20Hz vs 60Hz rate
        existing.x = existing.x * 0.65 + servEnt.x * 0.35;
        existing.y = existing.y * 0.65 + servEnt.y * 0.35;
        existing.angle = servEnt.angle;
        existing.health = servEnt.health;
        existing.maxHealth = servEnt.maxHealth;
        existing.reloading = servEnt.reloading;
        existing.usingMed = servEnt.usingMed;
      }
    });

    // Delete lost entities
    entities.forEach((ent, id) => {
      if (!serverEntities.has(id)) {
        entities.delete(id);
      }
    });

    // Renders Bullet tracer lines and particles
    pack.bullets.forEach(b => {
      // check duplicates
      if (!activeBullets.some(activeB => activeB.id === b.id)) {
        activeBullets.push({
          id: b.id,
          sx: b.sx,
          sy: b.sy,
          ex: b.ex,
          ey: b.ey,
          weapon: b.weapon,
          t: 0
        });
      }
    });

    // Sync raid containers
    raidContainers = pack.containers;
    
    // Auto-close looting overlay if currently looting container disappears from the map
    if (currentLootingContainerId && !raidContainers.some(c => c.id === currentLootingContainerId)) {
      document.getElementById('raid-looting-overlay').classList.add('hidden');
      currentLootingContainerId = null;
      currentLootingContainerItems = [];
    }
  });

  socket.on('container_closed', () => {
    document.getElementById('raid-looting-overlay').classList.add('hidden');
    currentLootingContainerId = null;
    currentLootingContainerItems = [];
  });

  // Action count complete notifications
  socket.on('ammo_updated', ({ ammoCount }) => {
    localPlayer.ammoCount = ammoCount;
  });

  socket.on('reload_start', ({ reloadTime }) => {
    startActionCount(reloadTime, '更換彈匣中...');
  });

  socket.on('reload_complete', ({ ammoCount }) => {
    localPlayer.ammoCount = ammoCount;
  });

  socket.on('use_med_start', ({ useTime, medName }) => {
    startActionCount(useTime, `正在使用 ${medName}...`);
  });

  socket.on('heal_complete', ({ health }) => {
    localPlayer.health = health;
  });

  socket.on('damaged', ({ health, damage }) => {
    localPlayer.health = health;
    // Spawn red damage flash particle effects
    spawnSplatterParticles(localPlayer.x, localPlayer.y, true);
    
    // Flash screen-wide red vignette damage indicator
    const vignette = document.getElementById('damage-vignette');
    if (vignette) {
      vignette.classList.remove('hidden');
      vignette.classList.remove('flash');
      void vignette.offsetWidth; // trigger reflow
      vignette.classList.add('flash');
    }
  });

  socket.on('action_cancelled', ({ reason }) => {
    stopActionCount();
    showAnnouncement(`[動作中斷] ${reason}`, 'error');
  });

  // Looting UI open trigger
  socket.on('searching_container', ({ useTime }) => {
    startActionCount(useTime, '搜刮箱子中...');
  });

  socket.on('container_opened', ({ containerId, name, items, cols, rows }) => {
    stopActionCount();
    openLootOverlay(containerId, name, items, cols, rows);
  });

  // Unequip slot trigger in raid
  socket.on('unequip_success', (data) => {
    currentUser.equipped = data.equipped;
    if (data.ammoCount !== undefined) {
      localPlayer.ammoCount = data.ammoCount;
      localPlayer.maxAmmo = data.maxAmmo;
      localPlayer.weaponType = data.weaponType;
    }
    // Redraw open overlays
    if (!document.getElementById('raid-inventory-overlay').classList.contains('hidden')) {
      renderRaidInventoryOverlay();
    }
    if (!document.getElementById('raid-looting-overlay').classList.contains('hidden')) {
      renderRaidLootOverlay(currentLootingContainerId, document.getElementById('loot-title').textContent, currentLootingContainerItems, currentLootingContainerCols || 4, currentLootingContainerRows || 4);
    }
    renderRaidHotbar();
  });

  // Match endings
  socket.on('raid_died', ({ killerName }) => {
    exitRaidScene();
    document.getElementById('death-killer-name').textContent = killerName;
    showScreen('lobby-screen');
    document.getElementById('death-summary-screen').classList.remove('hidden');
  });

  socket.on('raid_extracted', ({ xpGained }) => {
    exitRaidScene();
    // Update client profile stats
    currentUser.xp += xpGained;
    currentUser.level = Math.floor(currentUser.xp / 1000) + 1;
    showScreen('lobby-screen');
    document.getElementById('extract-summary-screen').classList.remove('hidden');
  });

  socket.on('xp_gained', ({ xp, level, levelUp }) => {
    currentUser.xp += xp;
    currentUser.level = level;
    if (levelUp) {
      showAnnouncement(`恭喜升級！您已達到了 Level ${level}`, 'success');
    }
  });
}

// ----------------------------------------------------
// Keyboard Action Listeners
// ----------------------------------------------------
function handleKeyDown(e) {
  if (!inRaid) return;
  const key = e.key.toLowerCase();
  
  // E Key toggles overlay or closes looting overlay
  if (key === 'e') {
    e.preventDefault();
    const lootOverlay = document.getElementById('raid-looting-overlay');
    if (lootOverlay && !lootOverlay.classList.contains('hidden')) {
      // Close looting overlay
      lootOverlay.classList.add('hidden');
      currentLootingContainerId = null;
      currentLootingContainerItems = [];
    } else {
      toggleRaidInventoryOverlay();
    }
    return;
  }

  // F Key initiates container looting search
  if (key === 'f') {
    e.preventDefault();
    triggerContainerLootSearch();
    return;
  }

  // Hotkeys 1~5 for quick slot usage
  if (['1', '2', '3', '4', '5'].includes(key)) {
    e.preventDefault();
    const slotNum = key;
    const slotName = `quick${slotNum}`;
    const item = currentUser.equipped[slotName];
    if (item) {
      const info = ITEMS[item.type];
      if (info && info.type === 'med') {
        const hudSlot = document.getElementById(`hud-quick${slotNum}`);
        if (hudSlot) {
          hudSlot.classList.add('active-use');
          setTimeout(() => hudSlot.classList.remove('active-use'), 400);
        }
        socket.emit('use_med_in_raid', { itemId: item.id, slot: slotName });
        if (!document.getElementById('raid-inventory-overlay').classList.contains('hidden')) {
          toggleRaidInventoryOverlay();
        }
      } else {
        showAnnouncement('該快捷鍵欄位中沒有可用的醫療物品！', 'error');
      }
    } else {
      showAnnouncement(`快捷鍵欄位 ${slotNum} 是空的！`, 'info');
    }
    return;
  }

  // Disable movement if overlays are open
  if (isRaidOverlayOpen()) return;

  if (key === 'w' || key === 'arrowup') keys.w = true;
  if (key === 'a' || key === 'arrowleft') keys.a = true;
  if (key === 's' || key === 'arrowdown') keys.s = true;
  if (key === 'd' || key === 'arrowright') keys.d = true;
  
  if (key === 'r') {
    // Reload weapon
    socket.emit('player_reload');
  }
}

function handleKeyUp(e) {
  if (!inRaid) return;
  const key = e.key.toLowerCase();
  if (key === 'w' || key === 'arrowup') keys.w = false;
  if (key === 'a' || key === 'arrowleft') keys.a = false;
  if (key === 's' || key === 'arrowdown') keys.s = false;
  if (key === 'd' || key === 'arrowright') keys.d = false;
}

function handleMouseMove(e) {
  if (!inRaid || isRaidOverlayOpen()) return;

  // Aim angle matches player screen coordinates relative to screen center
  const screenX = canvas.width / 2;
  const screenY = canvas.height / 2;
  const dx = e.clientX - screenX;
  const dy = e.clientY - screenY;
  
  localPlayer.angle = Math.atan2(dy, dx);
  
  // Broadcast aim angle changes
  socket.emit('player_aim', { angle: localPlayer.angle });
}

function handleMouseDown(e) {
  if (!inRaid || isRaidOverlayOpen() || e.button !== 0) return;
  // Trigger weapon shot
  socket.emit('player_shoot');
}

function isRaidOverlayOpen() {
  const inv = !document.getElementById('raid-inventory-overlay').classList.contains('hidden');
  const loot = !document.getElementById('raid-looting-overlay').classList.contains('hidden');
  return inv || loot;
}

function exitRaidScene() {
  inRaid = false;
  
  // Remove keyboard inputs
  window.removeEventListener('keydown', handleKeyDown);
  window.removeEventListener('keyup', handleKeyUp);
  canvas.removeEventListener('mousemove', handleMouseMove);
  canvas.removeEventListener('mousedown', handleMouseDown);
  
  // Close overlay components
  document.getElementById('raid-inventory-overlay').classList.add('hidden');
  document.getElementById('raid-looting-overlay').classList.add('hidden');
  
  // Hide announcement banner and clear timeout
  const annEl = document.getElementById('global-announcement');
  if (annEl) annEl.classList.add('hidden');
  if (announcementTimeout) {
    clearTimeout(announcementTimeout);
    announcementTimeout = null;
  }

  stopActionCount();

  // Load profile state
  loadLobbyProfile();
}

async function loadLobbyProfile() {
  try {
    const res = await fetch('/api/profile', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: currentUser.id })
    });
    const data = await res.json();
    if (res.ok) {
      currentUser = data;
      loadLobbyUI();
    }
  } catch (err) {
    console.error('Error reloading profile:', err.message);
  }
}

// Summary closings
document.getElementById('btn-extract-summary-close').addEventListener('click', () => {
  document.getElementById('extract-summary-screen').classList.add('hidden');
});
document.getElementById('btn-death-summary-close').addEventListener('click', () => {
  document.getElementById('death-summary-screen').classList.add('hidden');
});

// ----------------------------------------------------
// Client side physical predict & 2D Tile map collisions
// ----------------------------------------------------
function localClientMovePredict(dt) {
  let vx = 0;
  let vy = 0;
  if (keys.w) vy -= 1;
  if (keys.s) vy += 1;
  if (keys.a) vx -= 1;
  if (keys.d) vx += 1;

  // Normalize vectors
  if (vx !== 0 && vy !== 0) {
    const len = Math.sqrt(vx*vx + vy*vy);
    vx /= len;
    vy /= len;
  }

  // Multiply speed
  let baseSpeed = 180.0; // 180 pixels per second
  if (currentUser.equipped.armor && currentUser.equipped.armor.type === 'armor_heavy') {
    baseSpeed = 153.0; // 15% speed reduction
  }

  // Update locally instantly (Client-side prediction)
  if (vx !== 0 || vy !== 0) {
    localPlayer.x += vx * baseSpeed * dt;
    localPlayer.y += vy * baseSpeed * dt;

    // Local collision validation
    const res = localCollisionSlide(localPlayer.x, localPlayer.y, 20);
    localPlayer.x = res.x;
    localPlayer.y = res.y;

    // Send velocity vectors to authoritative server
    socket.emit('player_move', { vx, vy });
  } else {
    socket.emit('player_move', { vx: 0, vy: 0 });
  }
}

// Client tile collision slide simulator
function localCollisionSlide(x, y, r) {
  const minTileX = Math.floor((x - r) / TILE_SIZE);
  const maxTileX = Math.floor((x + r) / TILE_SIZE);
  const minTileY = Math.floor((y - r) / TILE_SIZE);
  const maxTileY = Math.floor((y + r) / TILE_SIZE);

  let newX = x;
  let newY = y;

  for (let ty = minTileY; ty <= maxTileY; ty++) {
    for (let tx = minTileX; tx <= maxTileX; tx++) {
      if (tx >= 0 && tx < MAP_SIZE && ty >= 0 && ty < MAP_SIZE) {
        if (mapGrid[ty] && mapGrid[ty][tx] === 1) {
          const closestX = Math.max(tx * TILE_SIZE, Math.min(newX, (tx + 1) * TILE_SIZE));
          const closestY = Math.max(ty * TILE_SIZE, Math.min(newY, (ty + 1) * TILE_SIZE));
          
          const dx = newX - closestX;
          const dy = newY - closestY;
          const dist = Math.sqrt(dx*dx + dy*dy);
          
          if (dist < r) {
            if (dist === 0) {
              newX += r;
            } else {
              const overlap = r - dist;
              newX += (dx / dist) * overlap;
              newY += (dy / dist) * overlap;
            }
          }
        }
      }
    }
  }

  return { x: newX, y: newY };
}

// ----------------------------------------------------
// Action Timer HUD Progress bar handlers
// ----------------------------------------------------
function startActionCount(duration, label) {
  stopActionCount();
  actionProgress.active = true;
  actionProgress.timer = 0;
  actionProgress.duration = duration;
  actionProgress.label = label;
  
  document.getElementById('action-bar-title').textContent = label;
  document.getElementById('action-bar').classList.remove('hidden');

  const step = 50;
  actionProgress.intervalId = setInterval(() => {
    actionProgress.timer += step;
    const pct = Math.min(100, (actionProgress.timer / actionProgress.duration) * 100);
    document.getElementById('action-bar-fill').style.width = `${pct}%`;

    if (actionProgress.timer >= actionProgress.duration) {
      stopActionCount();
    }
  }, step);
}

function stopActionCount() {
  actionProgress.active = false;
  if (actionProgress.intervalId) {
    clearInterval(actionProgress.intervalId);
    actionProgress.intervalId = null;
  }
  document.getElementById('action-bar').classList.add('hidden');
}

// ----------------------------------------------------
// Particle Generators for Impacts / Splatters
// ----------------------------------------------------
function spawnSplatterParticles(x, y, isBlood = false) {
  const count = isBlood ? 12 : 5;
  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = Math.random() * 3 + 1;
    bloodParticles.push({
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      color: isBlood ? `rgba(200, 0, 0, ${Math.random() * 0.5 + 0.5})` : `rgba(255, 200, 100, ${Math.random() * 0.7 + 0.3})`,
      size: isBlood ? Math.random() * 3 + 2 : Math.random() * 2 + 1,
      life: 1.0, // fade out timer
      decay: Math.random() * 0.05 + 0.03
    });
  }
}

// ----------------------------------------------------
// Client Canvas Rendering Loops & Flashlight Shader
// ----------------------------------------------------
let raidContainers = [];
let lastFrameTime = Date.now();

function renderLoop() {
  if (!inRaid) return;

  const now = Date.now();
  const dt = Math.min(0.1, (now - lastFrameTime) / 1000);
  lastFrameTime = now;

  // 1. Move predicted player positions
  if (!isRaidOverlayOpen()) {
    localClientMovePredict(dt);
  }

  // 2. Position camera offset viewport centered around local player coordinate
  camera.x = localPlayer.x - canvas.width / 2;
  camera.y = localPlayer.y - canvas.height / 2;

  // 3. Clear main screen
  ctx.fillStyle = '#06080b';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.save();
  ctx.translate(-camera.x, -camera.y);

  // A. Draw Tile Floor Grid
  drawMapGrid();

  // B. Draw Extractions Circle Spots
  extractions.forEach(zone => {
    ctx.strokeStyle = 'rgba(0, 255, 136, 0.4)';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(zone.x, zone.y, zone.r, 0, Math.PI * 2);
    ctx.stroke();

    ctx.fillStyle = 'rgba(0, 255, 136, 0.05)';
    ctx.fill();

    ctx.fillStyle = '#00ff88';
    ctx.font = 'bold 12px Outfit';
    ctx.textAlign = 'center';
    ctx.fillText(zone.name, zone.x, zone.y + 5);
  });

  // C. Draw Loot boxes & Bodies corpses
  raidContainers.forEach(box => {
    ctx.save();
    ctx.translate(box.x, box.y);
    if (box.isCorpse) {
      // Body shape
      ctx.fillStyle = '#4a5568';
      ctx.beginPath();
      ctx.arc(0, 0, 18, 0, Math.PI*2);
      ctx.fill();
      ctx.fillStyle = '#2d3748';
      ctx.beginPath();
      ctx.arc(-8, -8, 8, 0, Math.PI*2);
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.font = '9px Outfit';
      ctx.textAlign = 'center';
      ctx.fillText('尸', 0, 3);
    } else {
      // Box rectangular shape
      ctx.fillStyle = '#8b5a2b';
      ctx.strokeStyle = '#5c3a21';
      ctx.lineWidth = 2;
      ctx.fillRect(-22, -15, 44, 30);
      ctx.strokeRect(-22, -15, 44, 30);
      
      // Box lines
      ctx.beginPath();
      ctx.moveTo(-22, 0); ctx.lineTo(22, 0);
      ctx.stroke();
    }

    // Floating text label
    ctx.fillStyle = box.isCorpse ? '#ff5500' : '#ffaa00';
    ctx.font = 'bold 11px Outfit';
    ctx.textAlign = 'center';
    ctx.fillText(box.name, 0, box.isCorpse ? -25 : -20);
    ctx.restore();
  });

  // D. Draw other Entities (Players & Bots)
  entities.forEach(ent => {
    drawCharacter(ent.x, ent.y, ent.angle, ent.username || ent.name, ent.health, ent.maxHealth, ent.type === 'bot');
  });

  // E. Draw local player
  drawCharacter(localPlayer.x, localPlayer.y, localPlayer.angle, currentUser.username, localPlayer.health, localPlayer.maxHealth, false, true);

  // F. Draw Blood splash and Sparks particle effects
  bloodParticles.forEach((p, idx) => {
    p.x += p.vx * dt * 60;
    p.y += p.vy * dt * 60;
    p.life -= p.decay * dt * 60;
    if (p.life <= 0) {
      bloodParticles.splice(idx, 1);
    } else {
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * p.life, 0, Math.PI * 2);
      ctx.fill();
    }
  });

  // G. Draw Bullet tracer lines (flying tracer laser)
  for (let i = activeBullets.length - 1; i >= 0; i--) {
    const b = activeBullets[i];
    b.t += dt * 10; // bullet speed: cross entire distance in 100ms
    if (b.t >= 1) {
      spawnSplatterParticles(b.ex, b.ey);
      activeBullets.splice(i, 1);
    } else {
      const headPct = b.t;
      const tailPct = Math.max(0, b.t - 0.2);
      
      const hx = b.sx + (b.ex - b.sx) * headPct;
      const hy = b.sy + (b.ey - b.sy) * headPct;
      const tx = b.sx + (b.ex - b.sx) * tailPct;
      const ty = b.sy + (b.ey - b.sy) * tailPct;

      ctx.strokeStyle = b.weapon === 'shotgun' ? 'rgba(255, 230, 150, 0.8)' : 'rgba(255, 170, 0, 0.9)';
      ctx.lineWidth = b.weapon === 'shotgun' ? 2.5 : 3.5;
      ctx.beginPath();
      ctx.moveTo(tx, ty);
      ctx.lineTo(hx, hy);
      ctx.stroke();

      // glowing tip
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(hx, hy, b.weapon === 'shotgun' ? 1.5 : 2.5, 0, Math.PI*2);
      ctx.fill();
    }
  }

  ctx.restore();

  // H. Draw flashlight Visibility Shader Mask
  drawFlashlightFogOverlay();

  // Draw HUD Values
  document.getElementById('hud-health-text').textContent = `${Math.ceil(localPlayer.health)} / ${localPlayer.maxHealth}`;
  const hpPct = Math.max(0, (localPlayer.health / localPlayer.maxHealth) * 100);
  document.getElementById('hud-health-fill').style.width = `${hpPct}%`;

  if (localPlayer.weaponType) {
    document.getElementById('hud-weapon-group').classList.remove('hidden');
    document.getElementById('hud-weapon-name').textContent = ITEMS[localPlayer.weaponType].name;
    document.getElementById('hud-ammo-cur').textContent = localPlayer.ammoCount;
    document.getElementById('hud-ammo-max').textContent = localPlayer.maxAmmo;
  } else {
    document.getElementById('hud-weapon-group').classList.add('hidden');
  }

  requestAnimationFrame(renderLoop);
}

// Character render helper
function drawCharacter(x, y, angle, label, health, maxHealth, isBot, isLocal = false) {
  ctx.save();
  ctx.translate(x, y);

  const isBoss = label && label.startsWith('BOSS-');
  const sizeMult = isBoss ? 1.25 : 1.0;
  const radius = 20 * sizeMult;

  // Floating text label
  ctx.fillStyle = isBoss ? '#ffaa00' : (isBot ? '#ff5555' : (isLocal ? '#00e5ff' : '#ffffff'));
  ctx.font = isBoss ? 'bold 13px Outfit' : 'bold 12px Outfit';
  ctx.textAlign = 'center';
  ctx.fillText(label, 0, -32 * sizeMult);

  // Health mini-bar floating
  const barW = 32 * sizeMult;
  const barH = 3 * sizeMult;
  ctx.fillStyle = 'rgba(0,0,0,0.6)';
  ctx.fillRect(-barW/2, -26 * sizeMult, barW, barH);
  ctx.fillStyle = health < (maxHealth * 0.3) ? '#ff3b30' : (isBoss ? '#ffaa00' : '#00ff88');
  ctx.fillRect(-barW/2, -26 * sizeMult, barW * (health / maxHealth), barH);

  // Outer circles body shapes (crimson-dark with golden border for Boss)
  ctx.fillStyle = isLocal ? '#0d9488' : (isBoss ? '#7a1a2b' : (isBot ? '#dc2626' : '#2563eb'));
  ctx.strokeStyle = isBoss ? '#ffaa00' : '#ffffff';
  ctx.lineWidth = isBoss ? 3.5 : 2.5;
  ctx.beginPath();
  ctx.arc(0, 0, radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // Facing barrel direction line
  ctx.rotate(angle);
  ctx.strokeStyle = isBoss ? '#ffaa00' : '#ffffff';
  ctx.lineWidth = isBoss ? 6 : 5;
  ctx.beginPath();
  ctx.moveTo(10 * sizeMult, 0);
  ctx.lineTo(26 * sizeMult, 0); // barrel length
  ctx.stroke();

  ctx.restore();
}

// 2D Map floor and walls layout drawer
function drawMapGrid() {
  for (let y = 0; y < MAP_SIZE; y++) {
    for (let x = 0; x < MAP_SIZE; x++) {
      const tile = mapGrid[y] ? mapGrid[y][x] : 0;
      const px = x * TILE_SIZE;
      const py = y * TILE_SIZE;

      if (tile === 1) {
        // Wall box
        ctx.fillStyle = '#1e293b';
        ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);
        ctx.strokeStyle = 'rgba(255,255,255,0.05)';
        ctx.lineWidth = 1;
        ctx.strokeRect(px, py, TILE_SIZE, TILE_SIZE);
      } else {
        // Floor tile
        ctx.fillStyle = '#0f172a';
        ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);
        
        ctx.strokeStyle = 'rgba(255,255,255,0.015)';
        ctx.lineWidth = 0.5;
        ctx.strokeRect(px, py, TILE_SIZE, TILE_SIZE);
      }
    }
  }
}

// Hand flashlight cone visibility shader mask overlay
function hasCheatCardInRaid() {
  if (!currentUser || !currentUser.equipped) return false;
  const slots = ['helmet', 'armor', 'weapon', 'backpack', 'pocket1', 'pocket2', 'ammo', 'quick1', 'quick2', 'quick3', 'quick4', 'quick5'];
  for (const slot of slots) {
    const item = currentUser.equipped[slot];
    if (item && item.type === 'cheat_card') return true;
  }
  if (currentUser.equipped.backpack && currentUser.equipped.backpack.items) {
    const bpItems = currentUser.equipped.backpack.items || [];
    if (bpItems.some(it => it.type === 'cheat_card')) return true;
  }
  return false;
}

function drawFlashlightFogOverlay() {
  if (hasCheatCardInRaid()) {
    return; // Cheat card is active: render no fog!
  }

  const mask = document.createElement('canvas');
  mask.width = canvas.width;
  mask.height = canvas.height;
  const mCtx = mask.getContext('2d');

  // Fill black night mist
  mCtx.fillStyle = 'rgba(3, 4, 6, 0.97)';
  mCtx.fillRect(0, 0, canvas.width, canvas.height);

  // Composite eraser
  mCtx.globalCompositeOperation = 'destination-out';

  // Screen coordinates of local player center
  const px = canvas.width / 2;
  const py = canvas.height / 2;

  // A. Ambient glow circle around player
  const ambientGrad = mCtx.createRadialGradient(px, py, 10, px, py, 110);
  ambientGrad.addColorStop(0, 'rgba(0, 0, 0, 1.0)');
  ambientGrad.addColorStop(1, 'rgba(0, 0, 0, 0.0)');
  mCtx.fillStyle = ambientGrad;
  mCtx.beginPath();
  mCtx.arc(px, py, 110, 0, Math.PI * 2);
  mCtx.fill();

  // B. Flashlight sector cone
  const angle = localPlayer.angle;
  const beamLength = 400;
  const spreadAngle = 0.40; // radians (~23 degrees)

  const beamGrad = mCtx.createRadialGradient(px, py, 20, px + Math.cos(angle)*beamLength*0.8, py + Math.sin(angle)*beamLength*0.8, beamLength/2);
  beamGrad.addColorStop(0, 'rgba(0, 0, 0, 1.0)');
  beamGrad.addColorStop(1, 'rgba(0, 0, 0, 0.0)');
  
  mCtx.fillStyle = beamGrad;
  mCtx.beginPath();
  mCtx.moveTo(px, py);
  mCtx.arc(px, py, beamLength, angle - spreadAngle, angle + spreadAngle);
  mCtx.closePath();
  mCtx.fill();

  // Draw mask over main canvas
  ctx.drawImage(mask, 0, 0);

  // C. Screen yellow halo overlay over flashlight beam
  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  const yellowHalo = ctx.createRadialGradient(px, py, 20, px + Math.cos(angle)*beamLength*0.6, py + Math.sin(angle)*beamLength*0.6, beamLength*0.7);
  yellowHalo.addColorStop(0, 'rgba(255, 230, 160, 0.12)');
  yellowHalo.addColorStop(1, 'rgba(0, 0, 0, 0.0)');
  
  ctx.fillStyle = yellowHalo;
  ctx.beginPath();
  ctx.moveTo(px, py);
  ctx.arc(px, py, beamLength, angle - spreadAngle, angle + spreadAngle);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

// ----------------------------------------------------
// Raid Overlay Inventory overlay (E key toggle)
// ----------------------------------------------------
function toggleRaidInventoryOverlay() {
  const overlay = document.getElementById('raid-inventory-overlay');
  if (overlay.classList.contains('hidden')) {
    // Open
    overlay.classList.remove('hidden');
    renderRaidInventoryOverlay();
  } else {
    // Close
    overlay.classList.add('hidden');
  }
}

function renderRaidInventoryOverlay() {
  // Draw Equipped slots in overlay
  const slots = ['helmet', 'armor', 'weapon', 'backpack', 'pocket1', 'pocket2', 'ammo', 'quick1', 'quick2', 'quick3', 'quick4', 'quick5'];
  slots.forEach(slot => {
    const el = document.getElementById(`raid-slot-${slot}`);
    if (!el) return;
    const label = el.querySelector('.slot-label');
    const keySpan = el.querySelector('.slot-key');
    el.innerHTML = '';
    if (keySpan) el.appendChild(keySpan);
    if (label) el.appendChild(label);

    const item = currentUser.equipped[slot];
    if (item && (slot !== 'backpack' || item.type !== null)) {
      createRaidSlotItemElement(item, el, slot);
    }
  });
}

function renderRaidHotbar() {
  if (!inRaid) return;
  const quickSlots = ['quick1', 'quick2', 'quick3', 'quick4', 'quick5'];
  quickSlots.forEach((slot, idx) => {
    const slotEl = document.getElementById(`hud-${slot}`);
    if (!slotEl) return;
    const item = currentUser.equipped[slot];
    const contentEl = slotEl.querySelector('.hotbar-item-content');
    const nameEl = contentEl.querySelector('.hotbar-item-name');
    const countEl = contentEl.querySelector('.hotbar-item-count');
    
    if (item) {
      const info = ITEMS[item.type];
      nameEl.textContent = info ? info.name : item.type;
      countEl.textContent = item.count > 1 ? item.count : '';
      slotEl.style.borderColor = 'rgba(255, 170, 0, 0.4)';
    } else {
      nameEl.textContent = '-';
      countEl.textContent = '';
      slotEl.style.borderColor = 'rgba(255, 255, 255, 0.06)';
    }
  });

  // Draw Backpack grid contents
  const gridContainer = document.getElementById('raid-bag-grid');
  gridContainer.innerHTML = '';
  
  const bp = currentUser.equipped.backpack;
  const dims = getPlayerBagDimensions(currentUser.equipped, currentUser.level);
  const cols = dims.cols;
  const rows = dims.rows;

  gridContainer.style.gridTemplateColumns = `repeat(${cols}, var(--cell-size))`;
  gridContainer.style.gridAutoRows = 'var(--cell-size)';
  gridContainer.style.width = `${cols * cellStep + 8}px`;
  gridContainer.style.height = `${rows * cellStep + 8}px`;

  // cells
  for (let i = 0; i < cols * rows; i++) {
    const cell = document.createElement('div');
    cell.classList.add('grid-cell');
    gridContainer.appendChild(cell);
  }

  // items inside backpack
  const innerItems = bp ? (bp.items || []) : [];
  innerItems.forEach(item => {
    createRaidGridItemElement(item, gridContainer, 'backpack');
  });
}

function createRaidSlotItemElement(item, slotElement, slotName) {
  const info = ITEMS[item.type];
  if (!info) return;

  const div = document.createElement('div');
  div.classList.add('grid-item');
  div.setAttribute('draggable', 'true');
  div.setAttribute('data-id', item.id);
  div.setAttribute('data-type', info.type);
  div.style.position = 'relative';
  div.style.width = '95%';
  div.style.height = '95%';

  div.innerHTML = `
    <span class="item-name">${info.name}</span>
    ${item.count > 1 ? `<span class="item-count">${item.count}</span>` : ''}
    ${getDurabilityBarHTML(item)}
  `;

  div.addEventListener('dragstart', (e) => {
    draggedItem = { itemRef: item, originSlot: slotName, originGridId: null };
    const itemEl = e.target.closest('.grid-item') || e.target;
    draggedElement = itemEl;
    itemEl.classList.add('dragging');
    // Compute offset click inside slot element (95% relative size, so cellStep fits or default to 0)
    draggedOffsetCells = { x: 0, y: 0 };
    e.dataTransfer.setData('text/plain', item.id);
  });
  div.addEventListener('dragend', handleDragEnd);

  div.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    handleRaidContextMenu(e, item, slotName);
  });

  // Bind hover tooltips
  bindTooltip(div, item);

  slotElement.appendChild(div);
}

function createRaidGridItemElement(item, gridContainer, location, containerId = null) {
  const info = ITEMS[item.type];
  if (!info) return;

  const div = document.createElement('div');
  div.classList.add('grid-item');
  div.setAttribute('draggable', 'true');
  div.setAttribute('data-id', item.id);
  div.setAttribute('data-type', info.type);
  div.style.left = `${item.x * cellStep + 4}px`;
  div.style.top = `${item.y * cellStep + 4}px`;
  div.style.width = `${info.width * cellStep - 2}px`;
  div.style.height = `${info.height * cellStep - 2}px`;

  div.innerHTML = `
    <span class="item-name">${info.name}</span>
    ${item.count > 1 ? `<span class="item-count">${item.count}</span>` : ''}
    ${getDurabilityBarHTML(item)}
  `;

  div.addEventListener('dragstart', (e) => {
    draggedItem = { itemRef: item, originSlot: location, originGridId: gridContainer.id, containerId: containerId };
    const itemEl = e.target.closest('.grid-item') || e.target;
    draggedElement = itemEl;
    itemEl.classList.add('dragging');
    const rect = itemEl.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;
    draggedOffsetCells = {
      x: Math.floor(clickX / cellStep),
      y: Math.floor(clickY / cellStep)
    };
    e.dataTransfer.setData('text/plain', item.id);
  });
  div.addEventListener('dragend', handleDragEnd);

  // Right-click in raid
  div.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    if (location === 'backpack') {
      handleRaidContextMenu(e, item, location);
    } else if (location === 'container') {
      // Loot item fast
      socket.emit('loot_item', { containerId, itemId: item.id });
    }
  });

  // Bind hover tooltips
  bindTooltip(div, item);

  gridContainer.appendChild(div);
}

// ----------------------------------------------------
// Looting Crate / Corpse Container view overlays
// ----------------------------------------------------
let currentLootingContainerId = null;
let currentLootingContainerItems = [];

function triggerContainerLootSearch() {
  // Find nearest container
  let nearest = null;
  let minDist = Infinity;
  
  raidContainers.forEach(box => {
    const dx = localPlayer.x - box.x;
    const dy = localPlayer.y - box.y;
    const dist = Math.sqrt(dx*dx + dy*dy);
    if (dist < 80 && dist < minDist) {
      minDist = dist;
      nearest = box;
    }
  });

  if (nearest) {
    socket.emit('start_search_container', { containerId: nearest.id });
  }
}

// Globals to track current container grid size
let currentLootingContainerCols = 4;
let currentLootingContainerRows = 4;

function openLootOverlay(containerId, name, items, cols = 4, rows = 4) {
  currentLootingContainerId = containerId;
  currentLootingContainerItems = items;
  currentLootingContainerCols = cols;
  currentLootingContainerRows = rows;

  document.getElementById('loot-title').textContent = name;
  document.getElementById('raid-looting-overlay').classList.remove('hidden');

  renderRaidLootOverlay(containerId, name, items, cols, rows);
}

function renderRaidLootOverlay(containerId, name, items, cols = 4, rows = 4) {
  // 1. Draw Container grid
  const cGrid = document.getElementById('loot-box-grid');
  cGrid.innerHTML = '';
  
  cGrid.style.gridTemplateColumns = `repeat(${cols}, var(--cell-size))`;
  cGrid.style.gridAutoRows = 'var(--cell-size)';
  cGrid.style.width = `${cols * cellStep + 8}px`;
  cGrid.style.height = `${rows * cellStep + 8}px`;

  for (let i = 0; i < cols * rows; i++) {
    const cell = document.createElement('div');
    cell.classList.add('grid-cell');
    cGrid.appendChild(cell);
  }

  items.forEach(item => {
    createRaidGridItemElement(item, cGrid, 'container', containerId);
  });

  // 2. Draw Player Backpack grid side-by-side
  const bGrid = document.getElementById('raid-loot-bag-grid');
  bGrid.innerHTML = '';

  const bp = currentUser.equipped.backpack;
  const dims = getPlayerBagDimensions(currentUser.equipped, currentUser.level);
  const bCols = dims.cols;
  const bRows = dims.rows;

  bGrid.style.gridTemplateColumns = `repeat(${bCols}, var(--cell-size))`;
  bGrid.style.gridAutoRows = 'var(--cell-size)';
  bGrid.style.width = `${bCols * cellStep + 8}px`;
  bGrid.style.height = `${bRows * cellStep + 8}px`;

  for (let i = 0; i < bCols * bRows; i++) {
    const cell = document.createElement('div');
    cell.classList.add('grid-cell');
    bGrid.appendChild(cell);
  }

  const bpItems = bp ? (bp.items || []) : [];
  bpItems.forEach(item => {
    createRaidGridItemElement(item, bGrid, 'backpack');
  });
}

document.getElementById('btn-close-loot').addEventListener('click', () => {
  document.getElementById('raid-looting-overlay').classList.add('hidden');
  currentLootingContainerId = null;
  currentLootingContainerItems = [];
});

// ----------------------------------------------------
// LUCKY DRAW (GACHA) SYSTEM LOGIC
// ----------------------------------------------------
const gachaModal = document.getElementById('gacha-modal');
const btnGachaOpen = document.getElementById('btn-gacha-open');
const btnGachaClose = document.getElementById('btn-gacha-close');
const btnGachaRoll = document.getElementById('btn-gacha-roll');
const gachaCarouselRow = document.getElementById('gacha-carousel-row');
const gachaWonDisplay = document.getElementById('gacha-won-display');
const gachaWonCardContainer = document.getElementById('gacha-won-card-container');

// Open / Close Modal Event Listeners
if (btnGachaOpen) {
  btnGachaOpen.addEventListener('click', () => {
    if (inRaid) return;
    gachaModal.classList.remove('hidden');
    gachaWonDisplay.classList.add('hidden');
    gachaCarouselRow.style.transition = 'none';
    gachaCarouselRow.style.transform = 'translateX(0px)';
    gachaCarouselRow.innerHTML = '';
  });
}

if (btnGachaClose) {
  btnGachaClose.addEventListener('click', () => {
    // Only allow closing if not spinning
    if (btnGachaRoll.disabled) return;
    gachaModal.classList.add('hidden');
  });
}

// Generate short retro "click" tick sound using Web Audio API
function playGachaTickSound() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    
    osc.type = 'sine';
    // Sharp high pitch drop simulating mechanical tick
    osc.frequency.setValueAtTime(900, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(150, ctx.currentTime + 0.04);
    
    gain.gain.setValueAtTime(0.08, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.005, ctx.currentTime + 0.04);
    
    osc.start();
    osc.stop(ctx.currentTime + 0.04);
  } catch (e) {
    // Blocked or unsupported
  }
}

// Play premium arpeggio chime sound for winning item
function playGachaWinSound() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const gain = ctx.createGain();
    
    osc1.connect(gain);
    osc2.connect(gain);
    gain.connect(ctx.destination);
    
    // Play quick ascending notes (chime)
    const now = ctx.currentTime;
    osc1.frequency.setValueAtTime(523.25, now); // C5
    osc1.frequency.setValueAtTime(659.25, now + 0.1); // E5
    osc1.frequency.setValueAtTime(783.99, now + 0.2); // G5
    osc1.frequency.setValueAtTime(1046.50, now + 0.3); // C6
    
    osc2.frequency.setValueAtTime(523.25 * 1.5, now);
    osc2.frequency.setValueAtTime(659.25 * 1.5, now + 0.1);
    osc2.frequency.setValueAtTime(783.99 * 1.5, now + 0.2);
    osc2.frequency.setValueAtTime(1046.50 * 1.5, now + 0.3);
    
    gain.gain.setValueAtTime(0.12, now);
    gain.gain.exponentialRampToValueAtTime(0.005, now + 0.6);
    
    osc1.start();
    osc2.start();
    osc1.stop(now + 0.6);
    osc2.stop(now + 0.6);
  } catch (e) {}
}

// Gacha Probability Roller
function rollGachaItem() {
  const roll = Math.random();
  let rarity = 'white';
  
  if (roll < 0.005) rarity = 'red';        // 0.5%
  else if (roll < 0.04) rarity = 'gold';   // 3.5%
  else if (roll < 0.12) rarity = 'blue';   // 8.0%
  else if (roll < 0.30) rarity = 'green';  // 18.0%
  
  const upgradeTypes = ['pistol', 'shotgun', 'rifle', 'armor_heavy', 'helmet', 'backpack_small'];
  const allTypes = ['pistol', 'shotgun', 'rifle', 'armor_heavy', 'helmet', 'backpack_small', 'bandage', 'medkit', 'ammo_9mm', 'ammo_556', 'ammo_12g'];
  
  let type = '';
  if (rarity === 'white') {
    type = allTypes[Math.floor(Math.random() * allTypes.length)];
  } else {
    type = upgradeTypes[Math.floor(Math.random() * upgradeTypes.length)];
  }
  
  // Standard stack sizes for consumables
  let count = 1;
  if (type === 'ammo_9mm') count = 60;
  else if (type === 'ammo_556') count = 60;
  else if (type === 'ammo_12g') count = 30;
  else if (type === 'bandage') count = 3;
  
  return { type, rarity, count };
}

// Create Card DOM element
function createGachaCardElement(item) {
  const stats = getItemStats(item);
  const card = document.createElement('div');
  card.className = `gacha-item-card rarity-${item.rarity}`;
  
  const rarityLabel = {
    white: '白',
    green: '綠',
    blue: '藍',
    gold: '金',
    red: '紅'
  }[item.rarity];
  
  card.innerHTML = `
    <span class="card-rarity-tag">${rarityLabel}級</span>
    <span class="card-item-name">${stats.name}</span>
    <span class="card-item-type">${item.count > 1 ? item.count + ' 發/個' : stats.type === 'weapon' ? '武器' : stats.type === 'armor' ? '護甲/頭盔' : '背包'}</span>
  `;
  return card;
}

// Main Spin Execution
if (btnGachaRoll) {
  btnGachaRoll.addEventListener('click', () => {
    if (inRaid) return;
    
    // 1. Balance check
    if (currentUser.cash < 5000) {
      showAnnouncement('餘額不足，抽獎需要花費 $5,000 美金！', 'error');
      return;
    }
    
    // 2. Pre-generate won item & check stash space
    const rolled = rollGachaItem();
    const stats = getItemStats(rolled);
    const space = findFreeStashSpace(stats.width, stats.height);
    
    if (!space) {
      showAnnouncement(`倉庫空間不足，裝不下即將抽到的 ${stats.name} (${stats.width}x${stats.height})！請先整理倉庫。`, 'error');
      return;
    }
    
    // Disable controls
    btnGachaRoll.disabled = true;
    btnGachaClose.disabled = true;
    gachaWonDisplay.classList.add('hidden');
    
    // 3. Construct Carousel Items (45 items total, winner is index 35)
    const carouselItems = [];
    for (let i = 0; i < 45; i++) {
      if (i === 35) {
        carouselItems.push(rolled);
      } else {
        carouselItems.push(rollGachaItem());
      }
    }
    
    // Render carousel elements
    gachaCarouselRow.innerHTML = '';
    gachaCarouselRow.style.transition = 'none';
    gachaCarouselRow.style.transform = 'translateX(0px)';
    
    carouselItems.forEach(item => {
      gachaCarouselRow.appendChild(createGachaCardElement(item));
    });
    
    // Trigger reflow to apply translateX(0) instantly
    gachaCarouselRow.offsetHeight;
    
    // 4. Calculate CS:GO scrolling physics
    const cardStepWidth = 130; // 120px card + 10px gap
    const centerOffset = 400; // 800px viewport center
    const winnerLeftPos = 35 * cardStepWidth + 60; // Index 35 card center
    
    // Random offset inside the winning card (between -45px to +45px) so it stops organically
    const organicRandomOffset = Math.floor(Math.random() * 90 - 45);
    const targetX = centerOffset - winnerLeftPos + organicRandomOffset;
    
    // Apply scrolling transition
    gachaCarouselRow.style.transition = 'transform 5s cubic-bezier(0.1, 0.8, 0.15, 1)';
    gachaCarouselRow.style.transform = `translateX(${targetX}px)`;
    
    // 5. Track slide pointer crossings for tick sound
    const viewportRect = document.querySelector('.gacha-carousel-viewport').getBoundingClientRect();
    let lastCardIdx = 0;
    let isSpinning = true;
    
    function trackTick() {
      if (!isSpinning) return;
      
      const rowRect = gachaCarouselRow.getBoundingClientRect();
      const relativeOffset = (viewportRect.left + centerOffset) - rowRect.left;
      const currentCardIdx = Math.floor(relativeOffset / cardStepWidth);
      
      if (currentCardIdx !== lastCardIdx && currentCardIdx >= 0 && currentCardIdx < 45) {
        playGachaTickSound();
        lastCardIdx = currentCardIdx;
      }
      requestAnimationFrame(trackTick);
    }
    requestAnimationFrame(trackTick);
    
    // 6. Stop spinning and grant item
    setTimeout(() => {
      isSpinning = false;
      playGachaWinSound();
      
      // Deduct balance and push item
      currentUser.cash -= 5000;
      
      const newItem = {
        id: 'gacha-' + Math.random(),
        type: rolled.type,
        rarity: rolled.rarity,
        x: space.x,
        y: space.y,
        count: rolled.count
      };
      currentUser.stash.push(newItem);
      
      // Save state and re-render lobby
      saveLobbyData();
      loadLobbyUI();
      
      // Render won display
      gachaWonCardContainer.innerHTML = '';
      gachaWonCardContainer.appendChild(createGachaCardElement(rolled));
      gachaWonDisplay.classList.remove('hidden');
      
      // Re-enable controls
      btnGachaRoll.disabled = false;
      btnGachaClose.disabled = false;
    }, 5000);
  });
}

