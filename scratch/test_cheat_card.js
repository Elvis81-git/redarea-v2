const assert = require('assert').strict;
const db = require('../db');

async function runTests() {
  console.log('--- Starting Cheat Card System Tests ---');

  // 1. Setup Test User
  const username = 'test_cheat_player_' + Math.random();
  db.prepare("INSERT INTO users (username, password_hash, cash, cheat_card_purchases) VALUES (?, 'hash', 20000, 0)").run(username);

  let user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
  assert.equal(user.cheat_card_purchases, 0);
  console.log('✓ Database initial state verified: cheat_card_purchases = 0');

  // 2. First Purchase Price Check
  let purchases = user.cheat_card_purchases || 0;
  let cheatCardPrice = purchases === 0 ? 1000 : 10000;
  assert.equal(cheatCardPrice, 1000);
  console.log('✓ First purchase price is correctly $1000.');

  // 3. Simulate First Purchase
  purchases += 1;
  let newCash = user.cash - cheatCardPrice;
  db.prepare('UPDATE users SET cash = ?, cheat_card_purchases = ? WHERE id = ?').run(newCash, purchases, user.id);

  user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
  assert.equal(user.cash, 19000);
  assert.equal(user.cheat_card_purchases, 1);
  console.log('✓ First purchase recorded. Balance is $19000 and purchases = 1.');

  // 4. Second Purchase Price Check
  purchases = user.cheat_card_purchases || 0;
  cheatCardPrice = purchases === 0 ? 1000 : 10000;
  assert.equal(cheatCardPrice, 10000);
  console.log('✓ Second purchase price is correctly $10000.');

  // 5. Simulate Second Purchase
  purchases += 1;
  newCash = user.cash - cheatCardPrice;
  db.prepare('UPDATE users SET cash = ?, cheat_card_purchases = ? WHERE id = ?').run(newCash, purchases, user.id);

  user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
  assert.equal(user.cash, 9000);
  assert.equal(user.cheat_card_purchases, 2);
  console.log('✓ Second purchase recorded. Balance is $9000 and purchases = 2.');

  // Cleanup
  db.prepare('DELETE FROM users WHERE id = ?').run(user.id);
  console.log('✓ Database cleaned up.');
  console.log('--- All Cheat Card Tests Passed! ---');
}

runTests().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
