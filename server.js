const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const bcrypt = require('bcryptjs');
const path = require('path');
const db = require('./db');

// Create Express app
const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const server = http.createServer(app);
const io = new Server(server);

// Prepare Database Statements
const selectUser = db.prepare('SELECT * FROM users WHERE username = ?');
const selectUserById = db.prepare('SELECT * FROM users WHERE id = ?');
const insertUser = db.prepare('INSERT INTO users (username, password_hash, stash_json, equipped_json) VALUES (?, ?, ?, ?)');
const updateUserStash = db.prepare('UPDATE users SET stash_json = ?, equipped_json = ?, cash = ?, xp = ?, level = ?, deployed_after_relief = ? WHERE id = ?');
const selectLeaderboard = db.prepare('SELECT id, username, cash, level, xp FROM users ORDER BY cash DESC LIMIT 10');
const updateCash = db.prepare('UPDATE users SET cash = ? WHERE id = ?');

function checkAndResetDailyQuests(user) {
  const todayStr = new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Taipei' });
  if (user.quests_last_reset === todayStr && user.quests_json) {
    return user;
  }

  // Generate new quests
  const pool = [
    {
      id: "kill_players",
      desc: "擊殺其他玩家",
      progress: 0,
      target: 1,
      rewardType: "cash",
      rewardValue: 3000,
      claimed: false
    },
    {
      id: "kill_bots",
      desc: "擊殺機器人",
      progress: 0,
      target: 5,
      rewardType: "cash",
      rewardValue: 5000,
      claimed: false
    },
    {
      id: "search_boxes",
      desc: "搜刮物資箱",
      progress: 0,
      target: 10,
      rewardType: "cash",
      rewardValue: 1500,
      claimed: false
    },
    {
      id: "extract_success",
      desc: "成功撤離",
      progress: 0,
      target: 1,
      rewardType: "cash",
      rewardValue: 2000,
      claimed: false
    }
  ];

  // Shuffle and pick 2
  const shuffled = pool.sort(() => 0.5 - Math.random());
  const selected = shuffled.slice(0, 2);

  // Add the boss quest (always present)
  const bossQuest = {
    id: "kill_boss",
    desc: "擊殺隱藏BOSS-潘誼",
    progress: 0,
    target: 1,
    rewardType: "medal",
    rewardValue: 1,
    claimed: false
  };
  selected.push(bossQuest);

  const questsJson = JSON.stringify(selected);

  // Save to database
  db.prepare('UPDATE users SET quests_json = ?, quests_last_reset = ? WHERE id = ?').run(
    questsJson,
    todayStr,
    user.id
  );

  // Update user object fields in place
  user.quests_json = questsJson;
  user.quests_last_reset = todayStr;
  return user;
}

// Initial Stash and Equipment for new accounts
const initialStash = [
  { id: "item-init-backpack", type: "backpack_small", x: 0, y: 0, count: 1 },
  { id: "item-init-pistol", type: "pistol", x: 2, y: 0, count: 1 },
  { id: "item-init-ammo", type: "ammo_9mm", x: 0, y: 2, count: 60 },
  { id: "item-init-bandage1", type: "bandage", x: 1, y: 2, count: 3 },
  { id: "item-init-bandage2", type: "bandage", x: 2, y: 2, count: 3 }
];
const initialEquipped = {
  helmet: null,
  armor: null,
  weapon: null,
  backpack: { type: null, items: [] },
  pocket1: null,
  pocket2: null,
  ammo: null,
  quick1: null,
  quick2: null,
  quick3: null,
  quick4: null,
  quick5: null
};

function sanitizeEquipped(equipped) {
  if (!equipped) equipped = {};
  if (!equipped.backpack || typeof equipped.backpack !== 'object') {
    equipped.backpack = { type: null, items: [] };
  }
  const keys = ['helmet', 'armor', 'weapon', 'pocket1', 'pocket2', 'ammo', 'quick1', 'quick2', 'quick3', 'quick4', 'quick5'];
  for (const k of keys) {
    if (equipped[k] === undefined) {
      equipped[k] = null;
    }
  }
  return equipped;
}

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
  cheat_card: { id: 'cheat_card', name: '全圖雷達作弊卡', width: 1, height: 1, type: 'special', price: 1000, sellPrice: 500 },
  trash_jiang: { id: 'trash_jiang', name: '江東其的垃圾', width: 1, height: 1, type: 'trash', price: 999999, sellPrice: -100 },
  trash_yang: { id: 'trash_yang', name: '楊翰顯的垃圾', width: 1, height: 1, type: 'trash', price: 999999, sellPrice: -100 }
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
    purple: { price: 2.5, stat: 1.6 },
    gold: { price: 3.375, stat: 1.728 },
    red: { price: 5.0625, stat: 2.0736 }
  };

  const f = rarityFactors[stats.rarity] || { price: 1.0, stat: 1.0 };
  stats.price = Math.round(baseInfo.price * f.price);
  stats.sellPrice = Math.round(baseInfo.sellPrice * f.price);

  if (stats.type === 'trash') {
    stats.rarity = 'purple';
    stats.price = 999999;
    stats.sellPrice = -100;
  }

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

// Calculate total value of player's assets (cash + stash item values + equipped item values)
function calculateTotalValue(stash, equipped, cash) {
  let total = cash || 0;

  // Stash value
  if (Array.isArray(stash)) {
    for (const item of stash) {
      const stats = getItemStats(item);
      if (stats) {
        const count = item.count !== undefined ? item.count : 1;
        total += (stats.sellPrice || 0) * count;
      }
    }
  }

  // Equipped value
  if (equipped) {
    const slots = ['helmet', 'armor', 'weapon', 'backpack', 'pocket1', 'pocket2', 'ammo', 'quick1', 'quick2', 'quick3', 'quick4', 'quick5'];
    for (const slot of slots) {
      const item = equipped[slot];
      if (item && item.type !== null) {
        const stats = getItemStats(item);
        if (stats) {
          total += (stats.sellPrice || 0);
        }
        // Items inside backpack
        if (slot === 'backpack' && Array.isArray(item.items)) {
          for (const inner of item.items) {
            const innerStats = getItemStats(inner);
            if (innerStats) {
              const count = inner.count !== undefined ? inner.count : 1;
              total += (innerStats.sellPrice || 0) * count;
            }
          }
        }
      }
    }
  }

  return total;
}

// Item overlap & placement verification function
function validateStashAndEquipped(stash, equipped, level = 1) {
  // Validate pockets
  if (equipped.pocket1 && ITEMS[equipped.pocket1.type].type !== 'med') return false;
  if (equipped.pocket2 && ITEMS[equipped.pocket2.type].type !== 'med') return false;
  if (equipped.ammo && ITEMS[equipped.ammo.type].type !== 'ammo') return false;

  // Validate quick slots (only med or ammo)
  const quickSlots = ['quick1', 'quick2', 'quick3', 'quick4', 'quick5'];
  for (const q of quickSlots) {
    if (equipped[q]) {
      const itInfo = ITEMS[equipped[q].type];
      if (!itInfo || (itInfo.type !== 'med' && itInfo.type !== 'ammo')) return false;
    }
  }

  // Stash grid check (10 cols, infinite rows conceptually, limit to 100 for safety)
  const stashCols = 10;
  const stashRows = 100;
  const stashGrid = Array(stashRows).fill(null).map(() => Array(stashCols).fill(false));
  for (const it of stash) {
    const info = ITEMS[it.type];
    if (!info) return false;
    if (it.x < 0 || it.x + info.width > stashCols || it.y < 0 || it.y + info.height > stashRows) return false;
    for (let r = 0; r < info.height; r++) {
      for (let c = 0; c < info.width; c++) {
        if (stashGrid[it.y + r][it.x + c]) return false;
        stashGrid[it.y + r][it.x + c] = true;
      }
    }
  }

  // Backpack contents check
  if (equipped.backpack) {
    const bpType = equipped.backpack.type;
    let bpCols = 4;
    let bpRows = 2; // base pockets size
    if (bpType) {
      const bpInfo = ITEMS[bpType];
      if (!bpInfo || bpInfo.type !== 'backpack') return false;
      const dims = getPlayerBagDimensions(equipped, level);
      bpCols = dims.cols;
      bpRows = dims.rows;
    }
    const bpGrid = Array(bpRows).fill(null).map(() => Array(bpCols).fill(false));
    const bpItems = equipped.backpack.items || [];
    for (const it of bpItems) {
      const info = ITEMS[it.type];
      if (!info) return false;
      if (it.x < 0 || it.x + info.width > bpCols || it.y < 0 || it.y + info.height > bpRows) return false;
      for (let r = 0; r < info.height; r++) {
        for (let c = 0; c < info.width; c++) {
          if (bpGrid[it.y + r][it.x + c]) return false;
          bpGrid[it.y + r][it.x + c] = true;
        }
      }
    }
  }
  return true;
}

// ----------------------------------------------------
// Express API Endpoints
// ----------------------------------------------------
app.post('/api/register', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: '請輸入帳號密碼' });
  try {
    const existing = selectUser.get(username);
    if (existing) return res.status(400).json({ error: '此帳號已存在' });

    const hash = bcrypt.hashSync(password, 10);
    insertUser.run(username, hash, JSON.stringify(initialStash), JSON.stringify(initialEquipped));
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: '註冊錯誤：' + err.message });
  }
});

app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: '請輸入帳號密碼' });
  try {
    const user = selectUser.get(username);
    if (!user) return res.status(400).json({ error: '帳號或密碼錯誤' });

    const match = bcrypt.compareSync(password, user.password_hash);
    if (!match) return res.status(400).json({ error: '帳號或密碼錯誤' });

    const updatedUser = checkAndResetDailyQuests(user);
    res.json({
      id: updatedUser.id,
      username: updatedUser.username,
      cash: updatedUser.cash,
      xp: updatedUser.xp,
      level: updatedUser.level,
      stash: JSON.parse(updatedUser.stash_json),
      equipped: sanitizeEquipped(JSON.parse(updatedUser.equipped_json)),
      medal_count: updatedUser.medal_count || 0,
      quests: JSON.parse(updatedUser.quests_json),
      cheat_card_purchases: updatedUser.cheat_card_purchases || 0
    });
  } catch (err) {
    res.status(500).json({ error: '登入錯誤：' + err.message });
  }
});

app.post('/api/profile', (req, res) => {
  const { userId } = req.body;
  try {
    const user = selectUserById.get(userId);
    if (!user) return res.status(404).json({ error: '未找到該玩家' });
    const updatedUser = checkAndResetDailyQuests(user);
    res.json({
      id: updatedUser.id,
      username: updatedUser.username,
      cash: updatedUser.cash,
      xp: updatedUser.xp,
      level: updatedUser.level,
      stash: JSON.parse(updatedUser.stash_json),
      equipped: sanitizeEquipped(JSON.parse(updatedUser.equipped_json)),
      medal_count: updatedUser.medal_count || 0,
      quests: JSON.parse(updatedUser.quests_json),
      cheat_card_purchases: updatedUser.cheat_card_purchases || 0
    });
  } catch (err) {
    res.status(500).json({ error: '獲取檔案錯誤：' + err.message });
  }
});

app.get('/api/leaderboard', (req, res) => {
  try {
    const list = selectLeaderboard.all();
    res.json(list);
  } catch (err) {
    res.status(500).json({ error: '排行榜加載錯誤：' + err.message });
  }
});

app.post('/api/bankruptcy', (req, res) => {
  const { userId } = req.body;
  try {
    const user = selectUserById.get(userId);
    if (!user) return res.status(404).json({ error: '找不到該玩家' });

    const stash = JSON.parse(user.stash_json);
    const equipped = sanitizeEquipped(JSON.parse(user.equipped_json));

    // 1. Calculate total asset value
    const totalValue = calculateTotalValue(stash, equipped, user.cash);

    if (totalValue >= 2000) {
      return res.status(400).json({ error: `您的全身總價值（含物資與現金）為 $${totalValue}，大於等於 $2000，不符合領取資格！` });
    }

    // 2. Check deployment requirement
    if (user.deployed_after_relief === 0) {
      return res.status(400).json({ error: '您在上次領取救濟後尚未出戰部署，請先部署出戰一次戰區！' });
    }

    // 3. Grant relief ($2000 + infinite pistol)
    const info = ITEMS['pistol_infinite'];
    const space = findFreeSpace(10, 100, stash, info.width, info.height);
    if (space) {
      stash.push({
        id: 'infinite-' + Math.random(),
        type: 'pistol_infinite',
        x: space.x,
        y: space.y,
        count: 1
      });
    }

    // Update stash, equipped, cash, xp, level, and deployed_after_relief (set to 0)
    updateUserStash.run(
      JSON.stringify(stash),
      user.equipped_json,
      2000,
      user.xp,
      user.level,
      0, // deployed_after_relief = 0 (cooldown until next deploy)
      userId
    );

    res.json({ success: true, cash: 2000, stash });
  } catch (err) {
    res.status(500).json({ error: '破產申領錯誤：' + err.message });
  }
});

// ----------------------------------------------------
// Game World Map & Math Setup
// ----------------------------------------------------
const MAP_SIZE = 32;
const TILE_SIZE = 64;
const mapGrid = [];
for (let y = 0; y < MAP_SIZE; y++) {
  const row = [];
  for (let x = 0; x < MAP_SIZE; x++) {
    if (x === 0 || x === MAP_SIZE - 1 || y === 0 || y === MAP_SIZE - 1) {
      row.push(1); // boundary walls
    } else if ((x === 10 || x === 22) && (y >= 10 && y <= 22) && y !== 15 && y !== 16) {
      row.push(1); // central building walls
    } else if ((y === 10 || y === 22) && (x >= 10 && x <= 22) && x !== 15 && x !== 16) {
      row.push(1); // central building walls
    } else if (x === 16 && y >= 12 && y <= 20 && y !== 16) {
      row.push(1); // divider inner wall
    } else if (x === 5 && y >= 5 && y <= 9) {
      row.push(1); // top left small obstacles
    } else if (y === 5 && x >= 5 && x <= 9) {
      row.push(1);
    } else if (x === 26 && y >= 22 && y <= 26) {
      row.push(1); // bottom right obstacle
    } else if (y === 26 && x >= 22 && x <= 26) {
      row.push(1);
    } else {
      row.push(0);
    }
  }
  mapGrid.push(row);
}

// Extraction zones (Circles)
const extractions = [
  { id: 'extract_1', x: 128, y: 128, r: 90, name: '撤離點 A (西北)' },
  { id: 'extract_2', x: 1920, y: 1920, r: 90, name: '撤離點 B (東南)' }
];

// Spawn Points
const playerSpawns = [
  { x: 200, y: 1800 },
  { x: 1800, y: 200 },
  { x: 200, y: 1000 },
  { x: 1800, y: 1000 }
];

// Raid active state
const raidPlayers = new Map(); // socket.id -> player state
const bots = [];
const containers = new Map(); // containerId -> container state
let bullets = []; // Bullet lines to broadcast

// Spawning static map containers
// Spawning static map containers
const staticContainers = [
  { id: 'box_w1', name: '武器箱 (中央)', x: 960, y: 800, type: 'weapon_box' },
  { id: 'box_w2', name: '武器箱 (二號)', x: 1200, y: 1200, type: 'weapon_box' },
  { id: 'box_m1', name: '醫療箱 (中央)', x: 1100, y: 800, type: 'med_box' },
  { id: 'box_m2', name: '醫療箱 (二號)', x: 960, y: 1200, type: 'med_box' },
  { id: 'box_s1', name: '物資箱 (西北)', x: 300, y: 300, type: 'supply_box' },
  { id: 'box_s2', name: '物資箱 (東南)', x: 1700, y: 1700, type: 'supply_box' }
];

function getRandomRarity() {
  const roll = Math.random();
  if (roll < 0.005) return 'red';   // 0.5%
  if (roll < 0.04) return 'gold';    // 3.5%
  if (roll < 0.12) return 'blue';    // 8%
  if (roll < 0.30) return 'green';   // 18%
  return 'white';                    // 70%
}

// Populate containers
function populateContainer(c) {
  if (c.isTrashTrap) {
    c.items = [];
    return;
  }
  const items = [];
  const size = 4; // 4x4 containers
  // Randomly distribute items based on type
  if (c.type === 'weapon_box') {
    if (Math.random() < 0.4) {
      const wRarity = getRandomRarity();
      items.push({ id: 'loot-' + Math.random(), type: 'rifle', rarity: wRarity, x: 0, y: 0, count: 1 });
      items.push({ id: 'loot-' + Math.random(), type: 'ammo_556', rarity: 'white', x: 0, y: 2, count: 40 });
    } else {
      const wRarity = getRandomRarity();
      items.push({ id: 'loot-' + Math.random(), type: 'pistol', rarity: wRarity, x: 0, y: 0, count: 1 });
      items.push({ id: 'loot-' + Math.random(), type: 'ammo_9mm', rarity: 'white', x: 2, y: 0, count: 60 });
      if (Math.random() < 0.5) {
        const hRarity = getRandomRarity();
        items.push({ id: 'loot-' + Math.random(), type: 'helmet', rarity: hRarity, x: 0, y: 1, count: 1 });
      }
    }
  } else if (c.type === 'med_box') {
    items.push({ id: 'loot-' + Math.random(), type: 'bandage', rarity: 'white', x: 0, y: 0, count: 3 });
    if (Math.random() < 0.6) items.push({ id: 'loot-' + Math.random(), type: 'medkit', rarity: 'white', x: 1, y: 0, count: 1 });
    if (Math.random() < 0.5) items.push({ id: 'loot-' + Math.random(), type: 'bandage', rarity: 'white', x: 0, y: 1, count: 2 });
  } else {
    // Supply Box
    if (Math.random() < 0.4) {
      const aRarity = getRandomRarity();
      items.push({ id: 'loot-' + Math.random(), type: 'armor_heavy', rarity: aRarity, x: 0, y: 0, count: 1 });
    }
    if (Math.random() < 0.5) {
      const bRarity = getRandomRarity();
      items.push({ id: 'loot-' + Math.random(), type: 'backpack_small', rarity: bRarity, x: 2, y: 0, count: 1 });
    }
    items.push({ id: 'loot-' + Math.random(), type: 'bandage', rarity: 'white', x: 0, y: 2, count: 3 });
    items.push({ id: 'loot-' + Math.random(), type: 'ammo_9mm', rarity: 'white', x: 1, y: 2, count: 50 });
  }

  c.items = items;
}

function assignTrashTrap() {
  staticContainers.forEach(box => {
    box.isTrashTrap = false;
    const cur = containers.get(box.id);
    if (cur) cur.isTrashTrap = false;
  });
  const trapIndex = Math.floor(Math.random() * staticContainers.length);
  staticContainers[trapIndex].isTrashTrap = true;
  const trapBoxId = staticContainers[trapIndex].id;
  const trapBox = containers.get(trapBoxId);
  if (trapBox) {
    trapBox.isTrashTrap = true;
    trapBox.items = []; // It's a trap, no other items!
  }
}

staticContainers.forEach(box => {
  populateContainer(box);
  box.cols = 4;
  box.rows = 4;
  containers.set(box.id, box);
});
assignTrashTrap();

// Respawn containers checker
setInterval(() => {
  staticContainers.forEach(box => {
    const cur = containers.get(box.id);
    if (!cur || cur.items.length === 0 || cur.isTrashTrap) {
      populateContainer(box);
      box.cols = 4;
      box.rows = 4;
      containers.set(box.id, box);
    }
  });
  assignTrashTrap();
}, 120000); // refill containers every 2 mins if they are cleared

const candidateBotNames = ['方文奕', '王域魁', '伍益叡', '江東其', '林家豪', '楊翰顯', '潘廷育', '鄭喬澤', '阮聖慧'];
const patrolPaths = [
  // 4 interest waypoints per bot
  [{ x: 960, y: 960 }, { x: 1200, y: 960 }, { x: 1200, y: 1200 }, { x: 960, y: 1200 }], // Center Building
  [{ x: 1600, y: 400 }, { x: 1800, y: 600 }, { x: 1500, y: 800 }, { x: 1400, y: 300 }],  // Top Right
  [{ x: 400, y: 1600 }, { x: 600, y: 1800 }, { x: 800, y: 1500 }, { x: 300, y: 1400 }],  // Bottom Left
  [{ x: 400, y: 400 }, { x: 600, y: 600 }, { x: 500, y: 300 }, { x: 300, y: 700 }],      // Top Left
  [{ x: 960, y: 1600 }, { x: 1400, y: 1600 }, { x: 1400, y: 1800 }, { x: 960, y: 1800 }] // Bottom Center
];

function spawnBot(index) {
  const path = patrolPaths[index];
  const start = path[0];
  const botWeapon = index % 2 === 0 ? 'rifle' : (index % 3 === 0 ? 'shotgun' : 'pistol');
  const randName = 'BOT-' + candidateBotNames[Math.floor(Math.random() * candidateBotNames.length)];
  return {
    id: 'bot-' + index + '-' + Math.random(),
    name: randName,
    botIndex: index,
    isBoss: false,
    x: start.x,
    y: start.y,
    vx: 0,
    vy: 0,
    angle: 0,
    health: 100,
    maxHealth: 100,
    weaponType: botWeapon,
    state: 'patrol', // patrol, chase, wait
    patrolPath: path,
    currentWaypointIndex: 0,
    chaseTarget: null,
    lastKnownTargetPos: null,
    waitTimer: 0,
    shootCooldown: 0,
    speed: 4.0
  };
}

for (let i = 0; i < 5; i++) {
  bots.push(spawnBot(i));
}

// Respawn dead bots
function handleBotRespawn(index) {
  setTimeout(() => {
    bots[index] = spawnBot(index);
  }, 15000); // respawn after 15s
}

// BOSS spawning states
let bossAlive = false;
let bossRespawnAllowed = true;

function spawnBoss() {
  const spawn = playerSpawns[Math.floor(Math.random() * playerSpawns.length)] || { x: 960, y: 960 };
  const boss = {
    id: 'boss-' + Math.random(),
    name: 'BOSS-潘誼',
    isBoss: true,
    x: spawn.x,
    y: spawn.y,
    vx: 0,
    vy: 0,
    angle: 0,
    health: 300,
    maxHealth: 300,
    weaponType: 'shotgun',
    state: 'patrol',
    patrolPath: patrolPaths[0], // Patrols center building area
    currentWaypointIndex: 0,
    chaseTarget: null,
    lastKnownTargetPos: null,
    waitTimer: 0,
    shootCooldown: 0,
    speed: 6.5, // slightly slower than player (7.65 ~ 9.0)
    equipped: {
      armor: { type: 'armor_heavy', rarity: 'red' },
      helmet: { type: 'helmet', rarity: 'red' },
      backpack: { type: 'backpack_small', rarity: 'red', items: [] }
    }
  };
  bots.push(boss);
  bossAlive = true;
  io.emit('error_msg', { message: '隱藏BOSS已現身，請各位玩家注意' });
  console.log('BOSS-潘誼 spawned at:', spawn.x, spawn.y);
}

// Check every 30 seconds if we should spawn the Boss
setInterval(() => {
  if (!bossAlive && bossRespawnAllowed && raidPlayers.size > 0) {
    if (Math.random() < 0.3) {
      spawnBoss();
    }
  }
}, 30000);

// ----------------------------------------------------
// 2D Physics & Sliding Collisions
// ----------------------------------------------------
function checkTileCollision(x, y, r) {
  const minTileX = Math.floor((x - r) / TILE_SIZE);
  const maxTileX = Math.floor((x + r) / TILE_SIZE);
  const minTileY = Math.floor((y - r) / TILE_SIZE);
  const maxTileY = Math.floor((y + r) / TILE_SIZE);

  let collisionOccurred = false;
  let newX = x;
  let newY = y;

  for (let ty = minTileY; ty <= maxTileY; ty++) {
    for (let tx = minTileX; tx <= maxTileX; tx++) {
      if (tx >= 0 && tx < MAP_SIZE && ty >= 0 && ty < MAP_SIZE) {
        if (mapGrid[ty][tx] === 1) {
          // Find closest point on wall AABB
          const closestX = Math.max(tx * TILE_SIZE, Math.min(newX, (tx + 1) * TILE_SIZE));
          const closestY = Math.max(ty * TILE_SIZE, Math.min(newY, (ty + 1) * TILE_SIZE));
          
          const dx = newX - closestX;
          const dy = newY - closestY;
          const dist = Math.sqrt(dx*dx + dy*dy);
          
          if (dist < r) {
            collisionOccurred = true;
            if (dist === 0) {
              // Center is exactly inside, push away
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

  return { collision: collisionOccurred, x: newX, y: newY };
}

// Raycasting function for Line of Sight and instant Hitscan Bullets
function raycast(x1, y1, x2, y2) {
  // Simple DDA (Digital Differential Analysis) to step along ray and check walls
  const dx = x2 - x1;
  const dy = y2 - y1;
  const steps = Math.max(Math.abs(dx), Math.abs(dy));
  if (steps === 0) return { hit: false, x: x1, y: y1 };

  const xInc = dx / steps;
  const yInc = dy / steps;

  let cx = x1;
  let cy = y1;

  for (let i = 0; i <= steps; i++) {
    const tx = Math.floor(cx / TILE_SIZE);
    const ty = Math.floor(cy / TILE_SIZE);

    if (tx < 0 || tx >= MAP_SIZE || ty < 0 || ty >= MAP_SIZE) {
      return { hit: true, x: cx, y: cy }; // out of bounds
    }

    if (mapGrid[ty][tx] === 1) {
      return { hit: true, x: cx, y: cy }; // hit wall
    }

    // Step further
    if (i < steps) {
      cx += xInc;
      cy += yInc;
    }
  }

  return { hit: false, x: x2, y: y2 };
}

// Ray vs Circle intersection check
function rayCircleIntersection(sx, sy, ex, ey, cx, cy, r) {
  // Vector from start of ray to circle center
  const acx = cx - sx;
  const acy = cy - sy;
  // Direction vector of the ray segment
  const rx = ex - sx;
  const ry = ey - sy;
  const rLen = Math.sqrt(rx*rx + ry*ry);
  if (rLen === 0) return null;

  const dx = rx / rLen;
  const dy = ry / rLen;

  // Project AC onto ray direction to find closest point projection
  const proj = acx * dx + acy * dy;
  if (proj < 0 || proj > rLen) {
    // Closest point is outside the ray segment, check endpoints
    const dStartSq = (cx - sx)*(cx - sx) + (cy - sy)*(cy - sy);
    const dEndSq = (cx - ex)*(cx - ex) + (cy - ey)*(cy - ey);
    if (dStartSq <= r*r) return { x: sx, y: sy, dist: 0 };
    if (dEndSq <= r*r) return { x: ex, y: ey, dist: rLen };
    return null;
  }

  const closestX = sx + dx * proj;
  const closestY = sy + dy * proj;

  // Check distance to closest point
  const distSq = (cx - closestX)*(cx - closestX) + (cy - closestY)*(cy - closestY);
  if (distSq <= r*r) {
    const hitDist = proj - Math.sqrt(r*r - distSq); // entry point distance
    return {
      x: sx + dx * Math.max(0, hitDist),
      y: sy + dy * Math.max(0, hitDist),
      dist: Math.max(0, hitDist)
    };
  }

  return null;
}

// Helper to check if item can fit in slot / bag
function findFreeSpace(gridCols, gridRows, existingItems, itemWidth, itemHeight) {
  const grid = Array(gridRows).fill(null).map(() => Array(gridCols).fill(false));
  for (const it of existingItems) {
    const info = ITEMS[it.type];
    if (!info) continue;
    for (let r = 0; r < info.height; r++) {
      for (let c = 0; c < info.width; c++) {
        const py = it.y + r;
        const px = it.x + c;
        if (py >= 0 && py < gridRows && px >= 0 && px < gridCols) {
          grid[py][px] = true;
        }
      }
    }
  }

  for (let y = 0; y <= gridRows - itemHeight; y++) {
    for (let x = 0; x <= gridCols - itemWidth; x++) {
      let fits = true;
      for (let r = 0; r < itemHeight; r++) {
        for (let c = 0; c < itemWidth; c++) {
          if (grid[y + r][x + c]) {
            fits = false;
            break;
          }
        }
        if (!fits) break;
      }
      if (fits) {
        return { x, y };
      }
    }
  }
  return null;
}

// Packing items into corpse box on death
function packItemsIntoCorpse(equipped, stashItems, corpseItems) {
  const cols = 6;
  const rows = 6;
  
  const isTrash = (item) => item && ITEMS[item.type] && ITEMS[item.type].type === 'trash';

  // Gather all items that were on the corpse
  const itemsToPack = [];
  if (equipped.helmet && !isTrash(equipped.helmet)) itemsToPack.push(equipped.helmet);
  if (equipped.armor && !isTrash(equipped.armor)) itemsToPack.push(equipped.armor);
  if (equipped.weapon && !isTrash(equipped.weapon)) itemsToPack.push(equipped.weapon);
  if (equipped.pocket1 && !isTrash(equipped.pocket1)) itemsToPack.push(equipped.pocket1);
  if (equipped.pocket2 && !isTrash(equipped.pocket2)) itemsToPack.push(equipped.pocket2);
  if (equipped.ammo && !isTrash(equipped.ammo)) itemsToPack.push(equipped.ammo);
  if (equipped.quick1 && !isTrash(equipped.quick1)) itemsToPack.push(equipped.quick1);
  if (equipped.quick2 && !isTrash(equipped.quick2)) itemsToPack.push(equipped.quick2);
  if (equipped.quick3 && !isTrash(equipped.quick3)) itemsToPack.push(equipped.quick3);
  if (equipped.quick4 && !isTrash(equipped.quick4)) itemsToPack.push(equipped.quick4);
  if (equipped.quick5 && !isTrash(equipped.quick5)) itemsToPack.push(equipped.quick5);
  
  // Backpack itself and its contents
  if (equipped.backpack) {
    const hasTrash = equipped.backpack.items && equipped.backpack.items.some(it => isTrash(it));
    if (hasTrash) {
      // Only drop non-trash items inside the backpack
      const nonTrashItems = equipped.backpack.items.filter(it => !isTrash(it));
      nonTrashItems.forEach(item => itemsToPack.push(item));
      // Backpack itself does NOT drop
    } else {
      // Normal behavior: drop backpack and all its items
      const bpItems = equipped.backpack.items || [];
      bpItems.forEach(item => itemsToPack.push(item));
      const backpackClean = { ...equipped.backpack };
      delete backpackClean.items;
      itemsToPack.push(backpackClean);
    }
  }

  // Pack them
  itemsToPack.forEach(it => {
    const info = ITEMS[it.type];
    if (!info) return;
    const space = findFreeSpace(cols, rows, corpseItems, info.width, info.height);
    if (space) {
      corpseItems.push({
        id: it.id || 'loot-' + Math.random(),
        type: it.type,
        x: space.x,
        y: space.y,
        count: it.count || 1
      });
    }
  });
}

// ----------------------------------------------------
// Authoritative Game Tick Loop (20Hz / 50ms)
// ----------------------------------------------------
function tick() {
  const now = Date.now();

  // 1. Process Bullets (clear old tracer lines)
  bullets = bullets.filter(b => now - b.createdAt < 200);

  // Cleanup empty dropped containers
  containers.forEach((c, cId) => {
    if (cId.startsWith('dropped-') && (!c.items || c.items.length === 0)) {
      containers.delete(cId);
    }
  });

  // 2. Update Players (Active inside raid)
  raidPlayers.forEach((p, socketId) => {
    if (p.health <= 0) return;

    // Movement: Server side update and slide collision
    if (p.vx !== 0 || p.vy !== 0) {
      const speedMult = p.speed;
      p.x += p.vx * speedMult;
      p.y += p.vy * speedMult;

      const res = checkTileCollision(p.x, p.y, 20); // player size: 20px
      p.x = res.x;
      p.y = res.y;
    }

    // Interrupted checks for action timers
    if (p.vx !== 0 || p.vy !== 0) {
      // Searching container gets cancelled on movement
      if (p.searchingContainerId) {
        p.searchingContainerId = null;
        p.searchTimer = 0;
        p.socket.emit('action_cancelled', { reason: '移動中斷開箱' });
      }
    }

    // Reloading action tick
    if (p.reloading) {
      p.reloadTimer -= 50;
      if (p.reloadTimer <= 0) {
        p.reloading = false;
        // Refill magazine completed (p.ammoCount was already updated in player_reload)
        p.socket.emit('reload_complete', { ammoCount: p.ammoCount });
      }
    }

    // Healing action tick
    if (p.usingMed) {
      p.medTimer -= 50;
      if (p.medTimer <= 0) {
        p.usingMed = false;
        const itemInfo = ITEMS[p.medType];
        if (itemInfo) {
          p.health = Math.min(100, p.health + itemInfo.heal);
          p.socket.emit('heal_complete', { health: p.health });
        }
      }
    }

    // Container searching countdown
    if (p.searchingContainerId) {
      p.searchTimer -= 50;
      if (p.searchTimer <= 0) {
        const cId = p.searchingContainerId;
        p.searchingContainerId = null;
        p.searchTimer = 0;
        const c = containers.get(cId);
        if (c) {
          if (c.isTrashTrap) {
            const trashType = Math.random() < 0.5 ? 'trash_jiang' : 'trash_yang';
            const trashName = trashType === 'trash_jiang' ? '江東其的垃圾' : '楊翰顯的垃圾';

            if (!p.equipped.backpack) {
              p.equipped.backpack = { type: null, items: [] };
            }
            const dims = getPlayerBagDimensions(p.equipped, p.level);
            const bpCols = dims.cols;
            const bpRows = dims.rows;
            const bpItems = p.equipped.backpack.items || [];

            const fullGrid = Array(bpRows).fill(null).map(() => Array(bpCols).fill(false));
            for (const it of bpItems) {
              const itInfo = ITEMS[it.type];
              if (!itInfo) continue;
              for (let r = 0; r < itInfo.height; r++) {
                for (let c = 0; c < itInfo.width; c++) {
                  const gy = it.y + r;
                  const gx = it.x + c;
                  if (gy >= 0 && gy < bpRows && gx >= 0 && gx < bpCols) {
                    fullGrid[gy][gx] = true;
                  }
                }
              }
            }

            for (let y = 0; y < bpRows; y++) {
              for (let x = 0; x < bpCols; x++) {
                if (!fullGrid[y][x]) {
                  bpItems.push({
                    id: 'trash-' + Math.random(),
                    type: trashType,
                    x: x,
                    y: y,
                    count: 1
                  });
                }
              }
            }

            p.equipped.backpack.items = bpItems;

            containers.delete(cId);

            p.socket.emit('unequip_success', { equipped: p.equipped });
            p.socket.emit('error_msg', { message: `⚠️ 你觸發了垃圾陷阱箱！背包已被 ${trashName} 塞滿！` });
            p.socket.emit('container_closed');
            
            let questsChanged = false;
            if (p.quests) {
              p.quests = p.quests.map(q => {
                if (q.id === 'search_boxes' && q.progress < q.target) {
                  q.progress++;
                  questsChanged = true;
                }
                return q;
              });
            }
            if (questsChanged) {
              db.prepare('UPDATE users SET quests_json = ? WHERE id = ?').run(
                JSON.stringify(p.quests),
                p.userId
              );
              p.socket.emit('quests_updated', { quests: p.quests });
            }
            return;
          }

          // Increment quest progress for search_boxes
          let questsChanged = false;
          if (p.quests) {
            p.quests = p.quests.map(q => {
              if (q.id === 'search_boxes' && q.progress < q.target) {
                q.progress++;
                questsChanged = true;
              }
              return q;
            });
          }
          if (questsChanged) {
            db.prepare('UPDATE users SET quests_json = ? WHERE id = ?').run(
              JSON.stringify(p.quests),
              p.userId
            );
            p.socket.emit('quests_updated', { quests: p.quests });
          }

          p.socket.emit('container_opened', {
            containerId: cId,
            name: c.name,
            type: c.type,
            items: c.items,
            cols: c.cols || 4,
            rows: c.rows || 4
          });
        }
      }
    }

    // Extraction processing
    let insideExtraction = false;
    let currentExtract = null;
    extractions.forEach(zone => {
      const dx = p.x - zone.x;
      const dy = p.y - zone.y;
      const dist = Math.sqrt(dx*dx + dy*dy);
      if (dist <= zone.r) {
        insideExtraction = true;
        currentExtract = zone;
      }
    });

    if (insideExtraction) {
      p.extracting = true;
      p.extractTimer -= 0.05; // decrement 50ms (0.05s)
      if (p.extractTimer <= 0) {
        // Player successfully extracted!
        handleExtraction(socketId, p);
      }
    } else {
      p.extracting = false;
      p.extractTimer = 10.0; // reset to 10s
    }
  });

  // 3. Update AI Bots
  bots.forEach((bot, botIndex) => {
    if (bot.health <= 0) return;

    if (bot.shootCooldown > 0) bot.shootCooldown -= 50;

    // Detect players within radius 400px and clear Line of Sight
    let targetPlayer = null;
    let targetDist = Infinity;
    raidPlayers.forEach((p, socketId) => {
      if (p.health <= 0) return;
      const dx = p.x - bot.x;
      const dy = p.y - bot.y;
      const dist = Math.sqrt(dx*dx + dy*dy);
      if (dist < 400 && dist < targetDist) {
        // check line of sight
        const check = raycast(bot.x, bot.y, p.x, p.y);
        if (!check.hit) {
          targetPlayer = { id: socketId, x: p.x, y: p.y };
          targetDist = dist;
        }
      }
    });

    // Bot State Machine
    if (bot.state === 'patrol') {
      if (targetPlayer) {
        bot.state = 'chase';
        bot.chaseTarget = targetPlayer.id;
      } else {
        // Move towards current patrol waypoint
        const wp = bot.patrolPath[bot.currentWaypointIndex];
        const dx = wp.x - bot.x;
        const dy = wp.y - bot.y;
        const dist = Math.sqrt(dx*dx + dy*dy);

        if (dist <= 15) {
          // Switch waypoint
          bot.currentWaypointIndex = (bot.currentWaypointIndex + 1) % bot.patrolPath.length;
        } else {
          // Move towards it
          bot.angle = Math.atan2(dy, dx);
          bot.vx = Math.cos(bot.angle);
          bot.vy = Math.sin(bot.angle);
          bot.x += bot.vx * bot.speed;
          bot.y += bot.vy * bot.speed;
          
          const res = checkTileCollision(bot.x, bot.y, 20);
          bot.x = res.x;
          bot.y = res.y;
        }
      }
    } else if (bot.state === 'chase') {
      // Find chase target
      const p = raidPlayers.get(bot.chaseTarget);
      if (!p || p.health <= 0) {
        // Target lost or died
        bot.state = 'patrol';
        bot.chaseTarget = null;
      } else {
        const dx = p.x - bot.x;
        const dy = p.y - bot.y;
        const dist = Math.sqrt(dx*dx + dy*dy);

        // Check visual line of sight
        const check = raycast(bot.x, bot.y, p.x, p.y);
        if (check.hit) {
          // lost visual, go to last known spot
          bot.state = 'wait';
          bot.lastKnownTargetPos = { x: p.x, y: p.y };
          bot.waitTimer = 3000; // wait 3s
          bot.chaseTarget = null;
        } else {
          bot.angle = Math.atan2(dy, dx);
          bot.lastKnownTargetPos = { x: p.x, y: p.y };

          if (dist > 200) {
            // keep moving close
            bot.vx = Math.cos(bot.angle);
            bot.vy = Math.sin(bot.angle);
            bot.x += bot.vx * bot.speed;
            bot.y += bot.vy * bot.speed;
            
            const res = checkTileCollision(bot.x, bot.y, 20);
            bot.x = res.x;
            bot.y = res.y;
          } else {
            // stop moving and shoot
            bot.vx = 0;
            bot.vy = 0;
            if (bot.shootCooldown <= 0) {
              botShoot(bot, p);
            }
          }
        }
      }
    } else if (bot.state === 'wait') {
      bot.vx = 0;
      bot.vy = 0;
      if (targetPlayer) {
        bot.state = 'chase';
        bot.chaseTarget = targetPlayer.id;
      } else {
        bot.waitTimer -= 50;
        if (bot.waitTimer <= 0) {
          bot.state = 'patrol';
        } else if (bot.lastKnownTargetPos) {
          // Move towards last known position
          const dx = bot.lastKnownTargetPos.x - bot.x;
          const dy = bot.lastKnownTargetPos.y - bot.y;
          const dist = Math.sqrt(dx*dx + dy*dy);
          if (dist > 15) {
            bot.angle = Math.atan2(dy, dx);
            bot.x += Math.cos(bot.angle) * bot.speed;
            bot.y += Math.sin(bot.angle) * bot.speed;
            const res = checkTileCollision(bot.x, bot.y, 20);
            bot.x = res.x;
            bot.y = res.y;
          }
        }
      }
    }
  });

  // 4. Broadcast update package to clients
  const pList = [];
  raidPlayers.forEach((p, socketId) => {
    pList.push({
      id: socketId,
      username: p.username,
      x: p.x,
      y: p.y,
      angle: p.angle,
      health: p.health,
      maxHealth: p.maxHealth,
      reloading: p.reloading,
      usingMed: p.usingMed,
      searching: !!p.searchingContainerId,
      extracting: p.extracting,
      extractTimer: Math.ceil(p.extractTimer)
    });
  });

  const bList = bots.map(b => ({
    id: b.id,
    name: b.name,
    x: b.x,
    y: b.y,
    angle: b.angle,
    health: b.health,
    maxHealth: b.maxHealth,
    state: b.state
  })).filter(b => b.health > 0);

  const containerList = Array.from(containers.values()).map(c => ({
    id: c.id,
    name: c.name,
    x: c.x,
    y: c.y,
    type: c.type,
    isCorpse: !!c.isCorpse
  }));

  io.emit('raid_update', {
    players: pList,
    bots: bList,
    containers: containerList,
    bullets: bullets
  });
}

// Trigger loop
setInterval(tick, 50);

// ----------------------------------------------------
// Server Shooting Mechanics
// ----------------------------------------------------
function executeShoot(shooterX, shooterY, angle, weaponType, sourceId, isBot = false) {
  const wInfo = ITEMS[weaponType];
  if (!wInfo) return;

  const now = Date.now();
  const range = 600;

  // Calculate damage using quality stats
  let damage = wInfo.baseDamage;
  const shooterPlayer = raidPlayers.get(sourceId);
  if (shooterPlayer && shooterPlayer.equipped && shooterPlayer.equipped.weapon) {
    const stats = getItemStats(shooterPlayer.equipped.weapon);
    if (stats) damage = stats.baseDamage;
  } else {
    const shooterBot = bots.find(b => b.id === sourceId);
    if (shooterBot) {
      const rarity = shooterBot.isBoss ? 'gold' : 'white';
      const stats = getItemStats({ type: shooterBot.weaponType, rarity: rarity });
      if (stats) damage = stats.baseDamage;
    }
  }

  // Medals damage bonus: permanent +1 damage per medal owned
  if (shooterPlayer) {
    damage += (shooterPlayer.medal_count || 0);
  }

  if (weaponType === 'shotgun') {
    // Shotgun fires 6 pellets spread in a sector
    const pellets = 6;
    for (let i = 0; i < pellets; i++) {
      const spreadAngle = angle + (Math.random() - 0.5) * 0.3;
      const exTarget = shooterX + Math.cos(spreadAngle) * range;
      const eyTarget = shooterY + Math.sin(spreadAngle) * range;

      // 1. Raycast wall collision
      const wallHit = raycast(shooterX, shooterY, exTarget, eyTarget);
      let hitEndpointX = wallHit.x;
      let hitEndpointY = wallHit.y;

      // 2. Check intersections with players & bots
      let closestHit = null;
      let closestDist = Infinity;
      let targetHitType = null; // 'player' or 'bot'
      let targetObj = null;

      // Check players
      raidPlayers.forEach((p, sId) => {
        if (sId === sourceId) return; // cannot shoot self
        if (p.health <= 0) return;
        const intersect = rayCircleIntersection(shooterX, shooterY, hitEndpointX, hitEndpointY, p.x, p.y, 20);
        if (intersect && intersect.dist < closestDist) {
          closestDist = intersect.dist;
          closestHit = intersect;
          targetHitType = 'player';
          targetObj = { id: sId, ref: p };
        }
      });

      // Check bots
      bots.forEach((b) => {
        if (b.id === sourceId) return;
        if (b.health <= 0) return;
        const intersect = rayCircleIntersection(shooterX, shooterY, hitEndpointX, hitEndpointY, b.x, b.y, 20);
        if (intersect && intersect.dist < closestDist) {
          closestDist = intersect.dist;
          closestHit = intersect;
          targetHitType = 'bot';
          targetObj = b;
        }
      });

      if (closestHit) {
        hitEndpointX = closestHit.x;
        hitEndpointY = closestHit.y;
        // Apply Damage
        applyDamage(targetObj, targetHitType, damage, sourceId);
      }

      bullets.push({
        id: 'b-' + Math.random(),
        sx: shooterX,
        sy: shooterY,
        ex: hitEndpointX,
        ey: hitEndpointY,
        weapon: 'shotgun',
        createdAt: now
      });
    }
  } else {
    // Rifle or Pistol single shot
    const exTarget = shooterX + Math.cos(angle) * range;
    const eyTarget = shooterY + Math.sin(angle) * range;

    const wallHit = raycast(shooterX, shooterY, exTarget, eyTarget);
    let hitEndpointX = wallHit.x;
    let hitEndpointY = wallHit.y;

    let closestHit = null;
    let closestDist = Infinity;
    let targetHitType = null;
    let targetObj = null;

    // Check players
    raidPlayers.forEach((p, sId) => {
      if (sId === sourceId) return;
      if (p.health <= 0) return;
      const intersect = rayCircleIntersection(shooterX, shooterY, hitEndpointX, hitEndpointY, p.x, p.y, 20);
      if (intersect && intersect.dist < closestDist) {
        closestDist = intersect.dist;
        closestHit = intersect;
        targetHitType = 'player';
        targetObj = { id: sId, ref: p };
      }
    });

    // Check bots
    bots.forEach((b) => {
      if (b.id === sourceId) return;
      if (b.health <= 0) return;
      const intersect = rayCircleIntersection(shooterX, shooterY, hitEndpointX, hitEndpointY, b.x, b.y, 20);
      if (intersect && intersect.dist < closestDist) {
        closestDist = intersect.dist;
        closestHit = intersect;
        targetHitType = 'bot';
        targetObj = b;
      }
    });

    if (closestHit) {
      hitEndpointX = closestHit.x;
      hitEndpointY = closestHit.y;
      applyDamage(targetObj, targetHitType, damage, sourceId);
    }

    bullets.push({
      id: 'b-' + Math.random(),
      sx: shooterX,
      sy: shooterY,
      ex: hitEndpointX,
      ey: hitEndpointY,
      weapon: weaponType,
      createdAt: now
    });
  }
}

// Bot Shooting implementation
function botShoot(bot, player) {
  bot.shootCooldown = bot.weaponType === 'rifle' ? 1200 : (bot.weaponType === 'shotgun' ? 2000 : 1500);
  // Perform shoot raycast
  executeShoot(bot.x, bot.y, bot.angle, bot.weaponType, bot.id, true);
}

// Apply Damage accounting for Helmets and Armors
function applyDamage(target, targetType, baseDamage, sourceId) {
  let finalDamage = baseDamage;

  if (targetType === 'player') {
    const p = target.ref;
    // Calculate Reduction
    let mult = 1.0;
    if (p.equipped.armor) {
      const stats = getItemStats(p.equipped.armor);
      const red = stats ? (stats.reduction || 0) : 0;
      mult *= (1 - red);
    }
    if (p.equipped.helmet) {
      const stats = getItemStats(p.equipped.helmet);
      const red = stats ? (stats.reduction || 0) : 0;
      mult *= (1 - red);
    }
    finalDamage = Math.round(baseDamage * mult);
    p.health -= finalDamage;

    // Degrade durability of armor and helmet
    let armorBroken = false;
    let helmetBroken = false;

    if (p.equipped.armor) {
      const stats = getItemStats(p.equipped.armor);
      const dec = Math.max(1, Math.ceil(finalDamage * 0.15));
      if (p.equipped.armor.durability !== undefined) {
        p.equipped.armor.durability = Math.max(0, p.equipped.armor.durability - dec);
      } else if (stats && stats.maxDurability) {
        p.equipped.armor.durability = Math.max(0, stats.maxDurability - dec);
      }
      if (p.equipped.armor.durability <= 0) {
        p.equipped.armor = null;
        armorBroken = true;
      }
    }

    if (p.equipped.helmet) {
      const stats = getItemStats(p.equipped.helmet);
      const dec = Math.max(1, Math.ceil(finalDamage * 0.10));
      if (p.equipped.helmet.durability !== undefined) {
        p.equipped.helmet.durability = Math.max(0, p.equipped.helmet.durability - dec);
      } else if (stats && stats.maxDurability) {
        p.equipped.helmet.durability = Math.max(0, stats.maxDurability - dec);
      }
      if (p.equipped.helmet.durability <= 0) {
        p.equipped.helmet = null;
        helmetBroken = true;
      }
    }

    if (armorBroken || helmetBroken) {
      p.socket.emit('unequip_success', { equipped: p.equipped });
      if (armorBroken && helmetBroken) {
        p.socket.emit('error_msg', { message: '你的防彈衣與頭盔皆已損壞消失！' });
      } else if (armorBroken) {
        p.socket.emit('error_msg', { message: '你的防彈衣已損壞消失！' });
      } else if (helmetBroken) {
        p.socket.emit('error_msg', { message: '你的防彈頭盔已損壞消失！' });
      }
    }

    // Trigger action interrupt upon damage
    if (p.searchingContainerId) {
      p.searchingContainerId = null;
      p.searchTimer = 0;
      p.socket.emit('action_cancelled', { reason: '受傷中斷開箱' });
    }
    if (p.usingMed) {
      p.usingMed = false;
      p.socket.emit('action_cancelled', { reason: '受傷中斷治療' });
    }

    p.socket.emit('damaged', { health: p.health, damage: finalDamage });

    if (p.health <= 0) {
      handlePlayerDeath(target.id, p, sourceId);
    }
  } else if (targetType === 'bot') {
    const b = target;
    let mult = 1.0;
    if (b.equipped) {
      if (b.equipped.armor) {
        const stats = getItemStats(b.equipped.armor);
        const red = stats ? (stats.reduction || 0) : 0;
        mult *= (1 - red);
      }
      if (b.equipped.helmet) {
        const stats = getItemStats(b.equipped.helmet);
        const red = stats ? (stats.reduction || 0) : 0;
        mult *= (1 - red);
      }
      finalDamage = Math.round(baseDamage * mult);

      // Degrade bot durability of armor and helmet
      if (b.equipped.armor) {
        const stats = getItemStats(b.equipped.armor);
        const dec = Math.max(1, Math.ceil(finalDamage * 0.15));
        if (b.equipped.armor.durability !== undefined) {
          b.equipped.armor.durability = Math.max(0, b.equipped.armor.durability - dec);
        } else if (stats && stats.maxDurability) {
          b.equipped.armor.durability = Math.max(0, stats.maxDurability - dec);
        }
        if (b.equipped.armor.durability <= 0) {
          b.equipped.armor = null;
        }
      }
      if (b.equipped.helmet) {
        const stats = getItemStats(b.equipped.helmet);
        const dec = Math.max(1, Math.ceil(finalDamage * 0.10));
        if (b.equipped.helmet.durability !== undefined) {
          b.equipped.helmet.durability = Math.max(0, b.equipped.helmet.durability - dec);
        } else if (stats && stats.maxDurability) {
          b.equipped.helmet.durability = Math.max(0, stats.maxDurability - dec);
        }
        if (b.equipped.helmet.durability <= 0) {
          b.equipped.helmet = null;
        }
      }
    } else {
      // Bots have standard flat reduction of 10% for simplicity
      finalDamage = Math.round(baseDamage * 0.9);
    }
    b.health -= finalDamage;
    
    // Switch bot state to chase the attacker if it's a player
    const attackerPlayer = raidPlayers.get(sourceId);
    if (attackerPlayer && b.health > 0) {
      b.state = 'chase';
      b.chaseTarget = sourceId;
    }

    if (b.health <= 0) {
      handleBotDeath(b, sourceId);
    }
  }
}

// ----------------------------------------------------
// Death & Extraction Processing
// ----------------------------------------------------
function handlePlayerDeath(socketId, p, killerId) {
  console.log(`Player ${p.username} was killed in-raid.`);

  // Update quests progress for killer if killer is player
  if (killerId) {
    const killer = raidPlayers.get(killerId);
    if (killer && killer.quests) {
      let questsChanged = false;
      killer.quests = killer.quests.map(q => {
        if (q.id === 'kill_players' && q.progress < q.target) {
          q.progress++;
          questsChanged = true;
        }
        return q;
      });
      if (questsChanged) {
        db.prepare('UPDATE users SET quests_json = ? WHERE id = ?').run(
          JSON.stringify(killer.quests),
          killer.userId
        );
        killer.socket.emit('quests_updated', { quests: killer.quests });
      }
    }
  }
  
  // 1. Pack inventory items and spawn corpse loot box
  const corpseId = 'corpse-' + socketId + '-' + Date.now();
  const corpse = {
    id: corpseId,
    name: `${p.username} 的屍體`,
    x: p.x,
    y: p.y,
    type: 'corpse',
    isCorpse: true,
    cols: 6,
    rows: 6,
    items: []
  };

  // Pack equipped gear + backpack items
  packItemsIntoCorpse(p.equipped, p.stash, corpse.items);
  containers.set(corpseId, corpse);

  // Remove corpse after 30 seconds
  setTimeout(() => {
    containers.delete(corpseId);
    raidPlayers.forEach(player => {
      if (player.searchingContainerId === corpseId) {
        player.searchingContainerId = null;
        player.socket.emit('container_closed');
      }
    });
  }, 30000);

  // 2. Wipe player equipped gear and save to db (Lost all gear!)
  const isTrash = (item) => item && ITEMS[item.type] && ITEMS[item.type].type === 'trash';
  const updatedEquipped = {
    helmet: isTrash(p.equipped.helmet) ? p.equipped.helmet : null,
    armor: isTrash(p.equipped.armor) ? p.equipped.armor : null,
    weapon: isTrash(p.equipped.weapon) ? p.equipped.weapon : null,
    pocket1: isTrash(p.equipped.pocket1) ? p.equipped.pocket1 : null,
    pocket2: isTrash(p.equipped.pocket2) ? p.equipped.pocket2 : null,
    ammo: isTrash(p.equipped.ammo) ? p.equipped.ammo : null,
    quick1: isTrash(p.equipped.quick1) ? p.equipped.quick1 : null,
    quick2: isTrash(p.equipped.quick2) ? p.equipped.quick2 : null,
    quick3: isTrash(p.equipped.quick3) ? p.equipped.quick3 : null,
    quick4: isTrash(p.equipped.quick4) ? p.equipped.quick4 : null,
    quick5: isTrash(p.equipped.quick5) ? p.equipped.quick5 : null,
    backpack: null
  };

  if (p.equipped.backpack) {
    const hasTrash = p.equipped.backpack.items && p.equipped.backpack.items.some(it => isTrash(it));
    if (hasTrash) {
      updatedEquipped.backpack = {
        ...p.equipped.backpack,
        items: p.equipped.backpack.items.filter(it => isTrash(it))
      };
    }
  }

  try {
    updateUserStash.run(
      JSON.stringify(p.stash),
      JSON.stringify(updatedEquipped),
      p.cash, // Keep cash
      p.xp,   // Keep xp
      p.level,
      1,      // deployed_after_relief = 1
      p.userId
    );
  } catch (err) {
    console.error('Error updating player death DB:', err.message);
  }

  // 3. Emit died event and remove player from active match
  p.socket.emit('raid_died', { killerName: getKillerName(killerId) });
  raidPlayers.delete(socketId);
}

function handleBotDeath(bot, killerId) {
  console.log(`Bot ${bot.name} was killed.`);

  // Update quests progress for killer if killer is player
  if (killerId) {
    const killer = raidPlayers.get(killerId);
    if (killer && killer.quests) {
      let questsChanged = false;
      killer.quests = killer.quests.map(q => {
        if (bot.isBoss) {
          if (q.id === 'kill_boss' && q.progress < q.target) {
            q.progress++;
            questsChanged = true;
          }
        } else {
          if (q.id === 'kill_bots' && q.progress < q.target) {
            q.progress++;
            questsChanged = true;
          }
        }
        return q;
      });
      if (questsChanged) {
        db.prepare('UPDATE users SET quests_json = ? WHERE id = ?').run(
          JSON.stringify(killer.quests),
          killer.userId
        );
        killer.socket.emit('quests_updated', { quests: killer.quests });
      }
    }
  }
  
  // Spawn corpse loot box
  const corpseId = 'corpse-bot-' + Date.now();
  const corpse = {
    id: corpseId,
    name: `${bot.name} 的屍體`,
    x: bot.x,
    y: bot.y,
    type: 'corpse',
    isCorpse: true,
    cols: bot.isBoss ? 6 : 4,
    rows: bot.isBoss ? 6 : 4,
    items: []
  };

  // Fill bot corpse with random loot
  const lootItems = [];
  if (bot.isBoss) {
    // Boss drops: Gold shotgun (4x1), Red heavy armor (2x2), Red helmet (2x2), Red backpack (2x2), and 12G ammo
    lootItems.push({ id: 'loot-' + Math.random(), type: 'shotgun', rarity: 'gold', x: 0, y: 0, count: 1 });
    lootItems.push({ id: 'loot-' + Math.random(), type: 'armor_heavy', rarity: 'red', x: 0, y: 1, count: 1 });
    lootItems.push({ id: 'loot-' + Math.random(), type: 'helmet', rarity: 'red', x: 2, y: 1, count: 1 });
    lootItems.push({ id: 'loot-' + Math.random(), type: 'backpack_small', rarity: 'red', x: 4, y: 1, count: 1 });
    lootItems.push({ id: 'loot-' + Math.random(), type: 'ammo_12g', rarity: 'white', x: 0, y: 3, count: 30 });
    lootItems.push({ id: 'loot-' + Math.random(), type: 'ammo_12g', rarity: 'white', x: 1, y: 3, count: 30 });
    lootItems.push({ id: 'loot-' + Math.random(), type: 'bandage', rarity: 'white', x: 2, y: 3, count: 3 });
  } else {
    const botRarity = getRandomRarity();
    const wInfo = ITEMS[bot.weaponType];
    const ammoType = wInfo ? (wInfo.ammoType || 'ammo_9mm') : 'ammo_9mm';

    lootItems.push({ id: 'loot-' + Math.random(), type: bot.weaponType, rarity: botRarity, x: 0, y: 0, count: 1 });
    lootItems.push({ id: 'loot-' + Math.random(), type: ammoType, rarity: 'white', x: 0, y: 1, count: 30 });
    if (Math.random() < 0.4) {
      lootItems.push({ id: 'loot-' + Math.random(), type: 'bandage', rarity: 'white', x: 2, y: 0, count: 2 });
    }
  }
  corpse.items = lootItems;
  containers.set(corpseId, corpse);

  // Delete bot corpse after 30 seconds
  setTimeout(() => {
    containers.delete(corpseId);
    raidPlayers.forEach(player => {
      if (player.searchingContainerId === corpseId) {
        player.searchingContainerId = null;
        player.socket.emit('container_closed');
      }
    });
  }, 30000);

  // Reward XP to killer
  const killer = raidPlayers.get(killerId);
  if (killer) {
    killer.xp += 150;
    // Check level up (every 1000 XP)
    const oldLvl = killer.level;
    killer.level = Math.floor(killer.xp / 1000) + 1;
    killer.socket.emit('xp_gained', { xp: 150, level: killer.level, levelUp: killer.level > oldLvl });
  }

  // Respawn bot scheduler
  if (bot.isBoss) {
    const idx = bots.findIndex(b => b.id === bot.id);
    if (idx !== -1) {
      bots.splice(idx, 1);
    }
    bossAlive = false;
    bossRespawnAllowed = false;
    // Cooldown of 90 seconds before Boss can spawn again
    setTimeout(() => {
      bossRespawnAllowed = true;
    }, 90000);
  } else {
    if (bot.botIndex !== undefined && bot.botIndex !== null) {
      handleBotRespawn(bot.botIndex);
    }
  }
}

function handleExtraction(socketId, p) {
  console.log(`Player ${p.username} extracted successfully!`);

  // Update quests progress for extract_success
  let questsChanged = false;
  if (p.quests) {
    p.quests = p.quests.map(q => {
      if (q.id === 'extract_success' && q.progress < q.target) {
        q.progress++;
        questsChanged = true;
      }
      return q;
    });
  }

  // 1. Player brought back everything equipped
  // Update DB with current equipped items and stash items
  try {
    updateUserStash.run(
      JSON.stringify(p.stash),
      JSON.stringify(p.equipped),
      p.cash,
      p.xp + 300, // Reward XP for extraction
      Math.floor((p.xp + 300) / 1000) + 1,
      1,          // deployed_after_relief = 1
      p.userId
    );
    if (questsChanged) {
      db.prepare('UPDATE users SET quests_json = ? WHERE id = ?').run(
        JSON.stringify(p.quests),
        p.userId
      );
    }
  } catch (err) {
    console.error('Error saving extraction state:', err.message);
  }

  p.socket.emit('raid_extracted', { xpGained: 300 });
  raidPlayers.delete(socketId);
}

function getKillerName(id) {
  const p = raidPlayers.get(id);
  if (p) return p.username;
  const bot = bots.find(b => b.id === id);
  if (bot) return bot.name;
  return '未知威脅';
}

// ----------------------------------------------------
// Socket.io Real-Time Event Listeners
// ----------------------------------------------------
io.on('connection', (socket) => {
  console.log(`Socket connected: ${socket.id}`);

  // Enter Raid
  socket.on('enter_raid', ({ userId }) => {
    try {
      const user = selectUserById.get(userId);
      if (!user) return socket.emit('error_msg', { message: '無法讀取帳號存檔' });

      // Check if player is already in raid (prevent duplicate session)
      let duplicate = false;
      raidPlayers.forEach((p, sId) => {
        if (p.userId === userId) duplicate = sId;
      });

      if (duplicate) {
        // Drop existing player
        const oldP = raidPlayers.get(duplicate);
        if (oldP) {
          oldP.socket.emit('error_msg', { message: '在其他地方登入' });
          raidPlayers.delete(duplicate);
        }
      }

      const updatedUser = checkAndResetDailyQuests(user);

      // Read gear stats
      const equipped = sanitizeEquipped(JSON.parse(updatedUser.equipped_json));
      const stash = JSON.parse(updatedUser.stash_json);

      let maxAmmo = 0;
      let ammoCount = 0;
      let weaponType = null;
      if (equipped.weapon) {
        weaponType = equipped.weapon.type;
        const wInfo = ITEMS[weaponType];
        if (wInfo) {
          maxAmmo = wInfo.maxAmmo;
          // Sub-ammo validation: count from gun properties if stored, or start full
          ammoCount = equipped.weapon.ammoCount !== undefined ? equipped.weapon.ammoCount : maxAmmo;
        }
      }

      // Calculate speed
      let speed = 9.0; // Base speed: 9px per tick (180px/s)
      if (equipped.armor && equipped.armor.type === 'armor_heavy') {
        speed = 7.65; // 15% speed reduction
      }

      // 等級速度加成：每提升一級增加 1%
      const levelSpeedBonus = 1 + (user.level || 1) * 0.01;
      speed *= levelSpeedBonus;

      // Spawn coordinate
      const spawn = playerSpawns[Math.floor(Math.random() * playerSpawns.length)];

      const playerState = {
        userId: user.id,
        username: user.username,
        x: spawn.x,
        y: spawn.y,
        vx: 0,
        vy: 0,
        angle: 0,
        health: 100,
        maxHealth: 100,
        weaponType: weaponType,
        maxAmmo: maxAmmo,
        ammoCount: ammoCount,
        reloading: false,
        reloadTimer: 0,
        usingMed: false,
        medTimer: 0,
        medType: null,
        searchingContainerId: null,
        searchTimer: 0,
        extracting: false,
        extractTimer: 10.0,
        equipped: equipped,
        stash: stash,
        cash: updatedUser.cash,
        xp: updatedUser.xp,
        level: updatedUser.level,
        speed: speed,
        quests: JSON.parse(updatedUser.quests_json),
        medal_count: updatedUser.medal_count || 0,
        socket: socket
      };

      // Reset the relief deployment flag on successful entry
      db.prepare('UPDATE users SET deployed_after_relief = 1 WHERE id = ?').run(userId);

      raidPlayers.set(socket.id, playerState);
      socket.emit('joined_raid', {
        x: playerState.x,
        y: playerState.y,
        health: playerState.health,
        maxHealth: playerState.maxHealth,
        ammoCount: playerState.ammoCount,
        maxAmmo: playerState.maxAmmo,
        weaponType: playerState.weaponType,
        mapGrid: mapGrid,
        extractions: extractions
      });
      console.log(`Player ${user.username} entered raid successfully.`);
    } catch (err) {
      socket.emit('error_msg', { message: '進入戰局失敗：' + err.message });
    }
  });

  // Client Control Input Handler
  socket.on('player_move', ({ vx, vy }) => {
    const p = raidPlayers.get(socket.id);
    if (p && p.health > 0) {
      p.vx = vx;
      p.vy = vy;
    }
  });

  socket.on('player_aim', ({ angle }) => {
    const p = raidPlayers.get(socket.id);
    if (p && p.health > 0) {
      p.angle = angle;
    }
  });

  socket.on('player_shoot', () => {
    const p = raidPlayers.get(socket.id);
    if (!p || p.health <= 0 || p.reloading || p.usingMed || !p.weaponType) return;

    if (p.ammoCount > 0) {
      p.ammoCount--;
      
      const firedWeaponType = p.weaponType;
      let weaponBroke = false;

      // Sync ammo inside equipped slot to prevent hacks/save correctly
      if (p.equipped.weapon) {
        p.equipped.weapon.ammoCount = p.ammoCount;
        if (p.equipped.weapon.type !== 'pistol_infinite') {
          const wStats = getItemStats(p.equipped.weapon);
          if (p.equipped.weapon.durability !== undefined) {
            p.equipped.weapon.durability = Math.max(0, p.equipped.weapon.durability - 1);
          } else if (wStats && wStats.maxDurability) {
            p.equipped.weapon.durability = Math.max(0, wStats.maxDurability - 1);
          }
          if (p.equipped.weapon.durability <= 0) {
            p.equipped.weapon = null;
            p.weaponType = null;
            p.ammoCount = 0;
            p.maxAmmo = 0;
            weaponBroke = true;
          }
        }
      }

      if (weaponBroke) {
        socket.emit('unequip_success', {
          equipped: p.equipped,
          ammoCount: p.ammoCount,
          maxAmmo: p.maxAmmo,
          weaponType: p.weaponType
        });
        socket.emit('error_msg', { message: '你的武器已損壞消失！' });
      } else {
        socket.emit('ammo_updated', { ammoCount: p.ammoCount });
      }

      executeShoot(p.x, p.y, p.angle, firedWeaponType, socket.id, false);
    } else {
      socket.emit('error_msg', { message: '彈匣已空！請換彈' });
    }
  });

  // Reload Bullet Handler
  socket.on('player_reload', () => {
    const p = raidPlayers.get(socket.id);
    if (!p || p.health <= 0 || p.reloading || p.usingMed || !p.weaponType) return;

    const wInfo = ITEMS[p.weaponType];
    if (!wInfo) return;

    // Fast-track reload for infinite pistol
    if (p.weaponType === 'pistol_infinite') {
      p.ammoCount = wInfo.maxAmmo;
      p.reloading = true;
      p.reloadTimer = wInfo.reloadTime;
      socket.emit('reload_start', { reloadTime: wInfo.reloadTime });
      return;
    }

    // Find ammo in backpack or pockets
    let ammoItem = null;
    let location = null; // 'ammo', 'pocket1', 'pocket2', 'backpack'
    const ammoType = wInfo.ammoType || 'ammo_9mm';
    const ammoName = ITEMS[ammoType] ? ITEMS[ammoType].name : '子彈';

    if (p.equipped.ammo && p.equipped.ammo.type === ammoType) {
      ammoItem = p.equipped.ammo;
      location = 'ammo';
    } else if (p.equipped.pocket1 && p.equipped.pocket1.type === ammoType) {
      ammoItem = p.equipped.pocket1;
      location = 'pocket1';
    } else if (p.equipped.pocket2 && p.equipped.pocket2.type === ammoType) {
      ammoItem = p.equipped.pocket2;
      location = 'pocket2';
    } else if (p.equipped.backpack) {
      const items = p.equipped.backpack.items || [];
      const idx = items.findIndex(it => it.type === ammoType);
      if (idx !== -1) {
        ammoItem = items[idx];
        location = 'backpack';
      }
    }

    if (!ammoItem) {
      return socket.emit('error_msg', { message: `口袋、背包或子彈欄位中沒有 ${ammoName}！` });
    }

    // Deduct ammo
    const needed = wInfo.maxAmmo - p.ammoCount;
    if (needed <= 0) return;

    const deduct = Math.min(needed, ammoItem.count);
    ammoItem.count -= deduct;
    p.ammoCount += deduct;

    // Clean up empty ammo stack
    if (ammoItem.count <= 0) {
      if (location === 'ammo') p.equipped.ammo = null;
      else if (location === 'pocket1') p.equipped.pocket1 = null;
      else if (location === 'pocket2') p.equipped.pocket2 = null;
      else if (location === 'backpack') {
        p.equipped.backpack.items = p.equipped.backpack.items.filter(it => it.id !== ammoItem.id);
      }
    }

    // Trigger reloading delay
    p.reloading = true;
    p.reloadTimer = wInfo.reloadTime;

    socket.emit('unequip_success', { equipped: p.equipped });
    socket.emit('reload_start', { reloadTime: wInfo.reloadTime });
  });

  // Use Medicine
  socket.on('use_med_in_raid', ({ itemId, slot }) => {
    const p = raidPlayers.get(socket.id);
    if (!p || p.health <= 0 || p.reloading || p.usingMed) return;

    let medItem = null;
    if (slot === 'pocket1') medItem = p.equipped.pocket1;
    else if (slot === 'pocket2') medItem = p.equipped.pocket2;
    else if (slot.startsWith('quick')) medItem = p.equipped[slot];
    else if (slot === 'backpack' && p.equipped.backpack) {
      const items = p.equipped.backpack.items || [];
      medItem = items.find(it => it.id === itemId);
    }

    if (!medItem) return socket.emit('error_msg', { message: '找不到醫療物品' });
    const mInfo = ITEMS[medItem.type];
    if (!mInfo || mInfo.type !== 'med') return;

    // Consume stack item
    if (medItem.count !== undefined) {
      medItem.count--;
      if (medItem.count <= 0) {
        if (slot === 'pocket1') p.equipped.pocket1 = null;
        else if (slot === 'pocket2') p.equipped.pocket2 = null;
        else if (slot.startsWith('quick')) p.equipped[slot] = null;
        else if (slot === 'backpack') {
          p.equipped.backpack.items = p.equipped.backpack.items.filter(it => it.id !== itemId);
        }
      }
    } else {
      // non-stackable
      if (slot === 'pocket1') p.equipped.pocket1 = null;
      else if (slot === 'pocket2') p.equipped.pocket2 = null;
      else if (slot.startsWith('quick')) p.equipped[slot] = null;
      else if (slot === 'backpack') {
        p.equipped.backpack.items = p.equipped.backpack.items.filter(it => it.id !== itemId);
      }
    }

    // Sync inventory to client immediately to show consumption
    socket.emit('unequip_success', { equipped: p.equipped });

    p.usingMed = true;
    p.medTimer = mInfo.useTime;
    p.medType = medItem.type;

    socket.emit('use_med_start', { useTime: mInfo.useTime, medName: mInfo.name });
  });

  // Unequip slot in raid
  socket.on('unequip_item_in_raid', ({ slot }) => {
    const p = raidPlayers.get(socket.id);
    if (!p || p.health <= 0) return;

    const item = p.equipped[slot];
    if (!item) return;

    if (slot === 'backpack') {
      // Backpack must be empty before unequipped in raid
      const innerItems = item.items || [];
      if (innerItems.length > 0) {
        return socket.emit('error_msg', { message: '必須先清空背包才能卸載' });
      }
      
      // Drop empty backpack to floor as a container box
      const boxId = 'box-drop-' + Date.now();
      const dropBox = {
        id: boxId,
        name: '掉落的背包',
        x: p.x,
        y: p.y,
        type: 'supply_box',
        cols: 4,
        rows: 4,
        items: []
      };
      containers.set(boxId, dropBox);
      p.equipped.backpack = { type: null, items: [] };
      socket.emit('unequip_success', { equipped: p.equipped });
      return;
    }

    // Try to fit the item inside backpack/pocket grid
    if (!p.equipped.backpack) {
      p.equipped.backpack = { type: null, items: [] };
    }

    const info = ITEMS[item.type];
    const bp = p.equipped.backpack;
    const dims = getPlayerBagDimensions(p.equipped, p.level);
    const bpCols = dims.cols;
    const bpRows = dims.rows;
    const bpItems = bp.items || [];

    const space = findFreeSpace(bpCols, bpRows, bpItems, info.width, info.height);
    if (!space) {
      return socket.emit('error_msg', { message: '背包/口袋空間不足，無法卸載' });
    }

    // Move to backpack
    bpItems.push({
      id: item.id || 'loot-' + Math.random(),
      type: item.type,
      x: space.x,
      y: space.y,
      count: item.count || 1
    });
    p.equipped[slot] = null;
    p.equipped.backpack.items = bpItems;

    // Reload weapon check if weapon unequipped
    if (slot === 'weapon') {
      p.weaponType = null;
      p.maxAmmo = 0;
      p.ammoCount = 0;
    }

    socket.emit('unequip_success', { equipped: p.equipped, ammoCount: p.ammoCount, maxAmmo: p.maxAmmo, weaponType: p.weaponType });
  });

  // Searching Loot Crate
  socket.on('start_search_container', ({ containerId }) => {
    const p = raidPlayers.get(socket.id);
    if (!p || p.health <= 0 || p.reloading || p.usingMed) return;

    const c = containers.get(containerId);
    if (!c) return socket.emit('error_msg', { message: '找不到補給箱' });

    // Check distance (< 80px)
    const dx = p.x - c.x;
    const dy = p.y - c.y;
    const dist = Math.sqrt(dx*dx + dy*dy);
    if (dist > 80) {
      return socket.emit('error_msg', { message: '離補給箱太遠！' });
    }

    // Start 3s timer
    p.searchingContainerId = containerId;
    p.searchTimer = 3000;
    socket.emit('searching_container', { useTime: 3000, containerId });
  });

  // Fast Loot or Drag Loot from Crate to Backpack
  socket.on('loot_item', ({ containerId, itemId, toX, toY }) => {
    const p = raidPlayers.get(socket.id);
    if (!p || p.health <= 0) return;

    const c = containers.get(containerId);
    if (!c) return socket.emit('error_msg', { message: '找不到補給箱' });

    // Check distance (< 80px)
    const dx = p.x - c.x;
    const dy = p.y - c.y;
    const dist = Math.sqrt(dx*dx + dy*dy);
    if (dist > 80) return socket.emit('error_msg', { message: '離補給箱太遠！' });

    const itemIdx = c.items.findIndex(it => it.id === itemId);
    if (itemIdx === -1) return socket.emit('error_msg', { message: '物品已被搜刮' });
    const item = c.items[itemIdx];

    // Make sure we have the backpack structure initialized
    if (!p.equipped.backpack) {
      p.equipped.backpack = { type: null, items: [] };
    }

    const info = ITEMS[item.type];
    const bp = p.equipped.backpack;
    const dims = getPlayerBagDimensions(p.equipped, p.level);
    const bpCols = dims.cols;
    const bpRows = dims.rows;
    const bpItems = bp.items || [];

    let targetX = toX;
    let targetY = toY;

    if (targetX === undefined || targetY === undefined) {
      // Auto packing (fast loot)
      const space = findFreeSpace(bpCols, bpRows, bpItems, info.width, info.height);
      if (!space) return socket.emit('error_msg', { message: '空間不足，無法搜刮' });
      targetX = space.x;
      targetY = space.y;
    } else {
      // Manual placing, check validity
      // check overlap
      const grid = Array(bpRows).fill(null).map(() => Array(bpCols).fill(false));
      for (const it of bpItems) {
        const itInfo = ITEMS[it.type];
        for (let r = 0; r < itInfo.height; r++) {
          for (let c = 0; c < itInfo.width; c++) {
            grid[it.y + r][it.x + c] = true;
          }
        }
      }
      // Check fits inside boundary
      if (targetX < 0 || targetX + info.width > bpCols || targetY < 0 || targetY + info.height > bpRows) {
        return socket.emit('error_msg', { message: '超出背包邊界' });
      }
      // Check overlap
      let overlaps = false;
      for (let r = 0; r < info.height; r++) {
        for (let c = 0; c < info.width; c++) {
          if (grid[targetY + r][targetX + c]) overlaps = true;
        }
      }
      if (overlaps) return socket.emit('error_msg', { message: '與背包內物品重疊' });
    }

    // Transfer item
    c.items.splice(itemIdx, 1);
    bpItems.push({
      id: item.id,
      type: item.type,
      x: targetX,
      y: targetY,
      count: item.count
    });

    // If it is a trash item, auto-fill all remaining slots in the backpack!
    if (info.type === 'trash') {
      const fullGrid = Array(bpRows).fill(null).map(() => Array(bpCols).fill(false));
      for (const it of bpItems) {
        const itInfo = ITEMS[it.type];
        if (!itInfo) continue;
        for (let r = 0; r < itInfo.height; r++) {
          for (let c = 0; c < itInfo.width; c++) {
            const gy = it.y + r;
            const gx = it.x + c;
            if (gy >= 0 && gy < bpRows && gx >= 0 && gx < bpCols) {
              fullGrid[gy][gx] = true;
            }
          }
        }
      }
      // Fill all empty slots with 1x1 trash items of the same type
      for (let y = 0; y < bpRows; y++) {
        for (let x = 0; x < bpCols; x++) {
          if (!fullGrid[y][x]) {
            bpItems.push({
              id: 'trash-' + Math.random(),
              type: item.type,
              x: x,
              y: y,
              count: 1
            });
          }
        }
      }
    }

    p.equipped.backpack.items = bpItems;

    // Refresh inventory and container for client
    socket.emit('unequip_success', { equipped: p.equipped });
    
    if (c.items.length === 0) {
      containers.delete(c.id);
      socket.emit('container_closed');
    } else {
      socket.emit('container_opened', {
        containerId: c.id,
        name: c.name,
        type: c.type,
        items: c.items,
        cols: c.cols || 4,
        rows: c.rows || 4
      });
    }
  });

  // Equip item inside raid (Backpack -> Equip Slot)
  socket.on('equip_item_in_raid', ({ itemId, slot }) => {
    const p = raidPlayers.get(socket.id);
    if (!p || p.health <= 0) return;

    if (!p.equipped.backpack || !p.equipped.backpack.items) return;
    const bpItems = p.equipped.backpack.items;
    const itemIdx = bpItems.findIndex(it => it.id === itemId);
    if (itemIdx === -1) return socket.emit('error_msg', { message: '背包中找不到此物品' });
    const item = bpItems[itemIdx];
    const info = ITEMS[item.type];
    if (!info) return;

    // Validate type for target slot
    let valid = false;
    if (slot === 'helmet' && info.id === 'helmet') valid = true;
    else if (slot === 'armor' && info.id === 'armor_heavy') valid = true;
    else if (slot === 'weapon' && info.type === 'weapon') valid = true;
    else if (slot === 'backpack' && info.type === 'backpack') valid = true;
    else if (slot === 'ammo' && info.type === 'ammo') valid = true;
    else if ((slot === 'pocket1' || slot === 'pocket2') && info.type === 'med') valid = true;
    else if (slot.startsWith('quick') && (info.type === 'med' || info.type === 'ammo')) valid = true;

    if (!valid) {
      return socket.emit('error_msg', { message: '該插槽無法放入此物品！' });
    }

    const oldItem = p.equipped[slot];
    if (oldItem && oldItem.type !== null) {
      // Swapping with backpack. Try to fit oldItem inside backpack.
      const tempBpItems = bpItems.filter(it => it.id !== itemId);
      const dims = getPlayerBagDimensions(p.equipped, p.level);
      const bpCols = dims.cols;
      const bpRows = dims.rows;
      const oldInfo = ITEMS[oldItem.type];
      const space = findFreeSpace(bpCols, bpRows, tempBpItems, oldInfo.width, oldInfo.height);
      if (!space) {
        return socket.emit('error_msg', { message: '背包空間不足，無法替換裝備！' });
      }
      tempBpItems.push({
        id: oldItem.id || 'loot-' + Math.random(),
        type: oldItem.type,
        x: space.x,
        y: space.y,
        count: oldItem.count || 1,
        ammoCount: oldItem.ammoCount
      });
      p.equipped[slot] = item;
      p.equipped.backpack.items = tempBpItems;
    } else {
      // Clean Slot, just equip
      p.equipped[slot] = item;
      p.equipped.backpack.items = bpItems.filter(it => it.id !== itemId);
    }

    // Weapon slot updates ammo states
    if (slot === 'weapon') {
      p.weaponType = item.type;
      p.maxAmmo = info.maxAmmo;
      p.ammoCount = item.ammoCount !== undefined ? item.ammoCount : info.maxAmmo;
      p.equipped.weapon.ammoCount = p.ammoCount;
    }

    socket.emit('unequip_success', { equipped: p.equipped, ammoCount: p.ammoCount, maxAmmo: p.maxAmmo, weaponType: p.weaponType });
  });

  // Organize/Move backpack item inside raid (Backpack -> Backpack)
  socket.on('move_backpack_item_in_raid', ({ itemId, toX, toY }) => {
    const p = raidPlayers.get(socket.id);
    if (!p || p.health <= 0) return;

    if (!p.equipped.backpack || !p.equipped.backpack.items) return;
    const bp = p.equipped.backpack;
    const bpItems = bp.items;
    const item = bpItems.find(it => it.id === itemId);
    if (!item) return socket.emit('error_msg', { message: '背包中找不到此物品' });

    const info = ITEMS[item.type];
    const dims = getPlayerBagDimensions(p.equipped, p.level);
    const bpCols = dims.cols;
    const bpRows = dims.rows;

    // Check bounds
    if (toX < 0 || toX + info.width > bpCols || toY < 0 || toY + info.height > bpRows) {
      return socket.emit('error_msg', { message: '超出背包邊界' });
    }

    // Check overlaps
    const grid = Array(bpRows).fill(null).map(() => Array(bpCols).fill(false));
    for (const it of bpItems) {
      if (it.id === itemId) continue;
      const itInfo = ITEMS[it.type];
      for (let r = 0; r < itInfo.height; r++) {
        for (let c = 0; c < itInfo.width; c++) {
          grid[it.y + r][it.x + c] = true;
        }
      }
    }

    let overlaps = false;
    for (let r = 0; r < info.height; r++) {
      for (let c = 0; c < info.width; c++) {
        if (grid[toY + r][toX + c]) overlaps = true;
      }
    }

    if (overlaps) {
      return socket.emit('error_msg', { message: '與背包內其他物品重疊' });
    }

    item.x = toX;
    item.y = toY;

    socket.emit('unequip_success', { equipped: p.equipped });
  });

  // Transfer item from Backpack to Container inside raid
  socket.on('put_item_to_container', ({ containerId, itemId, toX, toY }) => {
    const p = raidPlayers.get(socket.id);
    if (!p || p.health <= 0) return;

    const c = containers.get(containerId);
    if (!c) return socket.emit('error_msg', { message: '找不到補給箱' });

    // Distance check
    const dx = p.x - c.x;
    const dy = p.y - c.y;
    const dist = Math.sqrt(dx*dx + dy*dy);
    if (dist > 80) return socket.emit('error_msg', { message: '離補給箱太遠！' });

    if (!p.equipped.backpack || !p.equipped.backpack.items) return;
    const bpItems = p.equipped.backpack.items;
    const itemIdx = bpItems.findIndex(it => it.id === itemId);
    if (itemIdx === -1) return socket.emit('error_msg', { message: '背包中找不到此物品' });
    const item = bpItems[itemIdx];
    const info = ITEMS[item.type];

    if (info.type === 'trash') {
      return socket.emit('error_msg', { message: '垃圾無法遺棄至箱子內，必須帶回大廳處置！' });
    }

    const cCols = 4;
    const cRows = 4;
    let targetX = toX;
    let targetY = toY;

    if (targetX === undefined || targetY === undefined) {
      // Auto packing inside container
      const space = findFreeSpace(cCols, cRows, c.items, info.width, info.height);
      if (!space) return socket.emit('error_msg', { message: '補給箱空間已滿，放不下了！' });
      targetX = space.x;
      targetY = space.y;
    } else {
      if (targetX < 0 || targetX + info.width > cCols || targetY < 0 || targetY + info.height > cRows) {
        return socket.emit('error_msg', { message: '超出補給箱邊界' });
      }
      const grid = Array(cRows).fill(null).map(() => Array(cCols).fill(false));
      for (const it of c.items) {
        const itInfo = ITEMS[it.type];
        for (let r = 0; r < itInfo.height; r++) {
          for (let c = 0; c < itInfo.width; c++) {
            grid[it.y + r][it.x + c] = true;
          }
        }
      }
      let overlaps = false;
      for (let r = 0; r < info.height; r++) {
        for (let c = 0; c < info.width; c++) {
          if (grid[targetY + r][targetX + c]) overlaps = true;
        }
      }
      if (overlaps) return socket.emit('error_msg', { message: '與補給箱內物品重疊' });
    }

    // Transfer
    bpItems.splice(itemIdx, 1);
    c.items.push({
      id: item.id,
      type: item.type,
      x: targetX,
      y: targetY,
      count: item.count,
      ammoCount: item.ammoCount
    });

    socket.emit('unequip_success', { equipped: p.equipped });
    socket.emit('container_opened', {
      containerId: c.id,
      name: c.name,
      type: c.type,
      items: c.items,
      cols: c.cols || 4,
      rows: c.rows || 4
    });
  });

  // Drop item to ground (Backpack or Slot -> Ground)
  socket.on('drop_item_to_ground', ({ source, itemId, slot }) => {
    const p = raidPlayers.get(socket.id);
    if (!p || p.health <= 0) return;

    let item = null;
    let type = null;
    let count = 1;
    let ammoCount = undefined;

    if (source === 'backpack') {
      if (!p.equipped.backpack || !p.equipped.backpack.items) return;
      const bpItems = p.equipped.backpack.items;
      const itemIdx = bpItems.findIndex(it => it.id === itemId);
      if (itemIdx === -1) return socket.emit('error_msg', { message: '背包中找不到此物品' });
      item = bpItems[itemIdx];
      type = item.type;
      count = item.count;
      ammoCount = item.ammoCount;
    } else if (source === 'equipped') {
      item = p.equipped[slot];
      if (!item) return;
      type = item.type;
      count = item.count;
      ammoCount = item.ammoCount;
    }

    if (!item) return;

    if (type === 'trash_jiang' || type === 'trash_yang') {
      return socket.emit('error_msg', { message: '垃圾無法丟棄，必須帶回大廳處置！' });
    }

    // Perform actual removal now that we confirmed it's not trash
    if (source === 'backpack') {
      const bpItems = p.equipped.backpack.items;
      const itemIdx = bpItems.findIndex(it => it.id === itemId);
      if (itemIdx !== -1) bpItems.splice(itemIdx, 1);
    } else if (source === 'equipped') {
      p.equipped[slot] = null;
      if (slot === 'weapon') {
        p.weaponType = null;
        p.maxAmmo = 0;
        p.ammoCount = 0;
      }
    }

    // Create container
    const dropId = 'dropped-' + Date.now() + '-' + Math.round(Math.random() * 10000);
    const dropBox = {
      id: dropId,
      name: '掉落的物資',
      x: p.x + (Math.random() - 0.5) * 20,
      y: p.y + (Math.random() - 0.5) * 20,
      type: 'supply_box',
      isCorpse: false,
      cols: 4,
      rows: 4,
      items: [{
        id: item.id || 'loot-' + Math.random(),
        type: type,
        x: 0,
        y: 0,
        count: count || 1,
        ammoCount: ammoCount
      }]
    };

    containers.set(dropId, dropBox);

    socket.emit('unequip_success', { equipped: p.equipped, ammoCount: p.ammoCount, maxAmmo: p.maxAmmo, weaponType: p.weaponType });
    socket.emit('error_msg', { message: `已丟棄 ${ITEMS[type].name} 至地面` });
  });

  // Save Lobby Grid changes (Drag and Drop in lobby)
  socket.on('save_lobby_data', ({ userId, stash, equipped, cash, cheat_card_purchases }) => {
    try {
      const user = selectUserById.get(userId);
      if (!user) return socket.emit('error_msg', { message: '存檔失敗，用戶不存在' });

      const sanitizedEquipped = sanitizeEquipped(equipped);

      // Security check - pass correct user.level
      if (!validateStashAndEquipped(stash, sanitizedEquipped, user.level)) {
        return socket.emit('error_msg', { message: '存檔內容非法（重疊或格式錯誤）！' });
      }

      // Check cash
      updateUserStash.run(
        JSON.stringify(stash),
        JSON.stringify(sanitizedEquipped),
        cash,
        user.xp,
        user.level,
        user.deployed_after_relief,
        userId
      );

      if (cheat_card_purchases !== undefined) {
        db.prepare('UPDATE users SET cheat_card_purchases = ? WHERE id = ?').run(cheat_card_purchases, userId);
      }

      socket.emit('lobby_data_saved', { cash });
    } catch (err) {
      socket.emit('error_msg', { message: '同步大廳存檔失敗：' + err.message });
    }
  });

  // Claim quest reward
  socket.on('claim_quest_reward', ({ userId, questId }) => {
    try {
      const user = selectUserById.get(userId);
      if (!user) return socket.emit('error_msg', { message: '無法讀取帳號存檔' });

      let quests = [];
      if (user.quests_json) {
        quests = JSON.parse(user.quests_json);
      }

      const q = quests.find(item => item.id === questId);
      if (!q) {
        return socket.emit('error_msg', { message: '找不到對應的任務' });
      }

      if (q.progress < q.target) {
        return socket.emit('error_msg', { message: '任務尚未完成！' });
      }

      if (q.claimed) {
        return socket.emit('error_msg', { message: '獎勵已經領取過了！' });
      }

      // Mark as claimed
      q.claimed = true;

      let cashAward = 0;
      let medalAward = 0;

      if (q.rewardType === 'cash') {
        cashAward = q.rewardValue;
      } else if (q.rewardType === 'medal') {
        medalAward = q.rewardValue;
      }

      // Update cash and medal count in DB
      const newCash = user.cash + cashAward;
      const newMedalCount = (user.medal_count || 0) + medalAward;

      db.prepare('UPDATE users SET cash = ?, medal_count = ?, quests_json = ? WHERE id = ?').run(
        newCash,
        newMedalCount,
        JSON.stringify(quests),
        userId
      );

      // Sync player state if active
      const p = raidPlayers.get(socket.id);
      if (p) {
        p.cash = newCash;
        p.quests = quests;
        p.medal_count = newMedalCount;
      }

      socket.emit('quest_claim_success', {
        questId,
        cash: newCash,
        medal_count: newMedalCount,
        quests
      });

      console.log(`User ${user.username} claimed quest ${questId}. Cash: +${cashAward}, Medals: +${medalAward}`);
    } catch (err) {
      socket.emit('error_msg', { message: '領取獎勵失敗：' + err.message });
    }
  });

  // Disconnection handler (Treat as Raid death)
  socket.on('disconnect', () => {
    console.log(`Socket disconnected: ${socket.id}`);
    const p = raidPlayers.get(socket.id);
    if (p) {
      // Disconnection Penalty: Kill the player and spawn their corpse crate
      handlePlayerDeath(socket.id, p, null);
    }
  });
});

// Run server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`========================================`);
  console.log(`RED ZONE Authoritative Server is running!`);
  console.log(`Server Address: http://localhost:${PORT}`);
  console.log(`========================================`);
});
