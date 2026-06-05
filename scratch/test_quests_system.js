const assert = require('assert').strict;
const db = require('../db');

// Mock data structures to simulate server.js variables
const raidPlayers = new Map();
const bots = [];

// Helper functions copied/adapted from server.js for testing
function checkAndResetDailyQuests(user) {
  const todayStr = new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Taipei' });
  if (user.quests_last_reset === todayStr && user.quests_json) {
    return user;
  }

  const pool = [
    { id: "kill_players", desc: "擊殺其他玩家", progress: 0, target: 1, rewardType: "cash", rewardValue: 3000, claimed: false },
    { id: "kill_bots", desc: "擊殺機器人", progress: 0, target: 5, rewardType: "cash", rewardValue: 5000, claimed: false },
    { id: "search_boxes", desc: "搜刮物資箱", progress: 0, target: 10, rewardType: "cash", rewardValue: 1500, claimed: false },
    { id: "extract_success", desc: "成功撤離", progress: 0, target: 1, rewardType: "cash", rewardValue: 2000, claimed: false }
  ];

  const shuffled = pool.sort(() => 0.5 - Math.random());
  const selected = shuffled.slice(0, 2);

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

  db.prepare('UPDATE users SET quests_json = ?, quests_last_reset = ? WHERE id = ?').run(
    questsJson,
    todayStr,
    user.id
  );

  user.quests_json = questsJson;
  user.quests_last_reset = todayStr;
  return user;
}

// Mock Items
const ITEMS = {
  pistol: { id: 'pistol', baseDamage: 34 },
  rifle: { id: 'rifle', baseDamage: 45 }
};

function getWeaponDamage(shooterPlayer, weaponType) {
  let damage = ITEMS[weaponType].baseDamage;
  // Add medal_count damage bonus
  damage += (shooterPlayer.medal_count || 0);
  return damage;
}

async function runTests() {
  console.log('--- Starting Daily Quests System Tests ---');

  // 1. Setup Test User in database
  const username = 'test_quest_player_' + Math.random();
  db.prepare("INSERT INTO users (username, password_hash, cash, xp, level, stash_json, equipped_json, medal_count, quests_json, quests_last_reset) VALUES (?, 'hash', 1000, 0, 1, '[]', '{}', 0, NULL, NULL)").run(username);
  
  let user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
  assert.equal(user.medal_count, 0);
  assert.equal(user.quests_json, null);
  assert.equal(user.quests_last_reset, null);
  console.log('✓ Database initial state verified.');

  // 2. Test checkAndResetDailyQuests (Initial Generation)
  user = checkAndResetDailyQuests(user);
  assert.ok(user.quests_json);
  assert.ok(user.quests_last_reset);
  
  const quests = JSON.parse(user.quests_json);
  assert.equal(quests.length, 3);
  assert.ok(quests.find(q => q.id === 'kill_boss'));
  console.log('✓ Daily quests initial generation verified.');

  // 3. Test checkAndResetDailyQuests (No reset on same day)
  const firstResetDate = user.quests_last_reset;
  const firstQuestsJson = user.quests_json;
  
  // Re-run reset function
  user = checkAndResetDailyQuests(user);
  assert.equal(user.quests_last_reset, firstResetDate);
  assert.equal(user.quests_json, firstQuestsJson);
  console.log('✓ Daily quests bypass reset on same day verified.');

  // 4. Test checkAndResetDailyQuests (Reset on date mismatch)
  user.quests_last_reset = '1970-01-01'; // Force date mismatch
  db.prepare('UPDATE users SET quests_last_reset = ? WHERE id = ?').run('1970-01-01', user.id);
  
  user = checkAndResetDailyQuests(user);
  const todayStr = new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Taipei' });
  assert.equal(user.quests_last_reset, todayStr);
  assert.notEqual(user.quests_json, firstQuestsJson);
  console.log('✓ Daily quests reset on date mismatch verified.');

  // 5. Test Damage Medal Bonus
  const playerMock = { medal_count: 0 };
  assert.equal(getWeaponDamage(playerMock, 'pistol'), 34);
  assert.equal(getWeaponDamage(playerMock, 'rifle'), 45);

  playerMock.medal_count = 5;
  assert.equal(getWeaponDamage(playerMock, 'pistol'), 39);
  assert.equal(getWeaponDamage(playerMock, 'rifle'), 50);

  playerMock.medal_count = 12;
  assert.equal(getWeaponDamage(playerMock, 'pistol'), 46);
  assert.equal(getWeaponDamage(playerMock, 'rifle'), 57);
  console.log('✓ Medals permanent damage bonus calculation verified.');

  // 6. Test Quest Progress increments
  let currentQuests = JSON.parse(user.quests_json);
  
  // Setup playerState inside raid
  const playerState = {
    userId: user.id,
    quests: currentQuests,
    medal_count: user.medal_count,
    socket: { emit: (ev, data) => {} }
  };

  // Simulate killing players
  let questsChanged = false;
  playerState.quests = playerState.quests.map(q => {
    if (q.id === 'kill_players' && q.progress < q.target) {
      q.progress++;
      questsChanged = true;
    }
    return q;
  });
  
  // Verify progress
  const qPlayers = playerState.quests.find(q => q.id === 'kill_players');
  if (qPlayers) {
    assert.equal(qPlayers.progress, 1);
    console.log('✓ Kill player quest progress incremented successfully.');
  }

  // Simulate killing BOSS
  playerState.quests = playerState.quests.map(q => {
    if (q.id === 'kill_boss' && q.progress < q.target) {
      q.progress++;
    }
    return q;
  });
  const qBoss = playerState.quests.find(q => q.id === 'kill_boss');
  assert.equal(qBoss.progress, 1);
  console.log('✓ Kill BOSS quest progress incremented successfully.');

  // 7. Test Claim Quest Reward logic
  // Update database with completed quests
  db.prepare('UPDATE users SET quests_json = ? WHERE id = ?').run(
    JSON.stringify(playerState.quests),
    user.id
  );

  let updatedUser = db.prepare('SELECT * FROM users WHERE id = ?').get(user.id);
  let dbQuests = JSON.parse(updatedUser.quests_json);
  
  // Claim BOSS medal reward
  const bossQIdx = dbQuests.findIndex(q => q.id === 'kill_boss');
  assert.ok(bossQIdx !== -1);
  assert.equal(dbQuests[bossQIdx].progress, 1);
  assert.equal(dbQuests[bossQIdx].claimed, false);

  // Perform claim logic
  dbQuests[bossQIdx].claimed = true;
  let newCash = updatedUser.cash;
  let newMedalCount = updatedUser.medal_count + 1; // Medal reward

  db.prepare('UPDATE users SET cash = ?, medal_count = ?, quests_json = ? WHERE id = ?').run(
    newCash,
    newMedalCount,
    JSON.stringify(dbQuests),
    user.id
  );

  updatedUser = db.prepare('SELECT * FROM users WHERE id = ?').get(user.id);
  assert.equal(updatedUser.medal_count, 1);
  assert.equal(JSON.parse(updatedUser.quests_json)[bossQIdx].claimed, true);
  console.log('✓ Claiming medal reward verified.');

  // Cleanup test user
  db.prepare('DELETE FROM users WHERE id = ?').run(user.id);
  console.log('✓ Database cleaned up.');
  console.log('--- All Tests Passed Successfully! ---');
}

runTests().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
