const fs = require('fs');

// Read server.js and public/js/game.js to extract their ITEMS, getItemStats, and getPlayerBagDimensions
function extractFunctionAndCatalog(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  
  // Extract ITEMS block
  const itemsMatch = content.match(/const ITEMS = \{[\s\S]*?\n\};/);
  if (!itemsMatch) throw new Error(`Could not find ITEMS in ${filePath}`);
  
  // Extract getItemStats function block
  const getItemStatsMatch = content.match(/function getItemStats\([\s\S]*?\n\}/);
  if (!getItemStatsMatch) throw new Error(`Could not find getItemStats in ${filePath}`);

  // Extract getPlayerBagDimensions function block
  const getPlayerBagDimensionsMatch = content.match(/function getPlayerBagDimensions\([\s\S]*?\n\}/);
  if (!getPlayerBagDimensionsMatch) throw new Error(`Could not find getPlayerBagDimensions in ${filePath}`);

  // Evaluate them in a sandboxed context
  const sandbox = {};
  new Function('exports', itemsMatch[0] + '\n' + getItemStatsMatch[0] + '\n' + getPlayerBagDimensionsMatch[0] + '\nexports.ITEMS = ITEMS;\nexports.getItemStats = getItemStats;\nexports.getPlayerBagDimensions = getPlayerBagDimensions;')(sandbox);
  return sandbox;
}

console.log('--- EXTRACTING LOGIC ---');
const serverLogic = extractFunctionAndCatalog('server.js');
const clientLogic = extractFunctionAndCatalog('public/js/game.js');

console.log('\n--- VERIFYING CATALOGS ---');
const serverItemKeys = Object.keys(serverLogic.ITEMS);
const clientItemKeys = Object.keys(clientLogic.ITEMS);

if (serverItemKeys.length !== clientItemKeys.length) {
  console.error(`Mismatch: server has ${serverItemKeys.length} items, client has ${clientItemKeys.length} items`);
} else {
  console.log(`Success: Both catalogs have the same number of items (${serverItemKeys.length})`);
}

for (const key of serverItemKeys) {
  const sItem = serverLogic.ITEMS[key];
  const cItem = clientLogic.ITEMS[key];
  if (!cItem) {
    console.error(`Item ${key} is missing in client`);
    continue;
  }
  const sStr = JSON.stringify(sItem);
  const cStr = JSON.stringify(cItem);
  if (sStr !== cStr) {
    console.error(`Item ${key} mismatches:\nServer: ${sStr}\nClient: ${cStr}`);
  }
}

console.log('\n--- VERIFYING GETITEMSTATS (RARITY MULTIPLIERS) ---');
const rarities = ['white', 'green', 'blue', 'gold', 'red'];
const itemsToTest = [
  { type: 'pistol', baseDmg: 34, basePrice: 1500 },
  { type: 'rifle', baseDmg: 45, basePrice: 5000 },
  { type: 'shotgun', baseDmg: 22, basePrice: 3000 },
  { type: 'armor_heavy', reduction: 0.50, basePrice: 4000 },
  { type: 'helmet', reduction: 0.25, basePrice: 2000 }
];

let mismatchCount = 0;
for (const test of itemsToTest) {
  console.log(`\nTesting item type: ${test.type}`);
  for (const rarity of rarities) {
    const sStats = serverLogic.getItemStats({ type: test.type, rarity });
    const cStats = clientLogic.getItemStats({ type: test.type, rarity });
    
    const sStr = JSON.stringify(sStats);
    const cStr = JSON.stringify(cStats);
    
    if (sStr !== cStr) {
      console.error(`  [MISMATCH] Rarity: ${rarity}\n    Server: ${sStr}\n    Client: ${cStr}`);
      mismatchCount++;
    } else {
      // Print values to verify against the specifications
      if (sStats.type === 'weapon') {
        console.log(`  Rarity: ${rarity.padEnd(6)} -> Price: ${sStats.price.toString().padEnd(6)} SellPrice: ${sStats.sellPrice.toString().padEnd(6)} Damage: ${sStats.baseDamage}`);
      } else if (sStats.type === 'armor') {
        console.log(`  Rarity: ${rarity.padEnd(6)} -> Price: ${sStats.price.toString().padEnd(6)} SellPrice: ${sStats.sellPrice.toString().padEnd(6)} Reduction: ${Math.round(sStats.reduction * 100)}%`);
      }
    }
  }
}

console.log('\n--- VERIFYING GETPLAYERBAGDIMENSIONS ---');
for (const rarity of rarities) {
  const sDims = serverLogic.getPlayerBagDimensions({ backpack: { type: 'backpack_small', rarity } });
  const cDims = clientLogic.getPlayerBagDimensions({ backpack: { type: 'backpack_small', rarity } });
  const sStr = JSON.stringify(sDims);
  const cStr = JSON.stringify(cDims);
  
  if (sStr !== cStr) {
    console.error(`  [MISMATCH] Backpack Rarity: ${rarity}\n    Server: ${sStr}\n    Client: ${cStr}`);
    mismatchCount++;
  } else {
    console.log(`  Backpack Rarity: ${rarity.padEnd(6)} -> cols: ${sDims.cols} rows: ${sDims.rows} (${sDims.cols * sDims.rows} slots)`);
  }
}

// Pockets only (no backpack)
const sDimsPocket = serverLogic.getPlayerBagDimensions(null);
const cDimsPocket = clientLogic.getPlayerBagDimensions(null);
if (JSON.stringify(sDimsPocket) !== JSON.stringify(cDimsPocket)) {
  console.error(`  [MISMATCH] Pockets only\n    Server: ${JSON.stringify(sDimsPocket)}\n    Client: ${JSON.stringify(cDimsPocket)}`);
  mismatchCount++;
} else {
  console.log(`  No Backpack (Pockets) -> cols: ${sDimsPocket.cols} rows: ${sDimsPocket.rows} (${sDimsPocket.cols * sDimsPocket.rows} slots)`);
}

if (mismatchCount === 0) {
  console.log('\nVERIFICATION SUCCESSFUL: Server and Client logic are perfectly aligned!');
} else {
  console.error(`\nVERIFICATION FAILED: Found ${mismatchCount} mismatches between Server and Client!`);
  process.exit(1);
}
