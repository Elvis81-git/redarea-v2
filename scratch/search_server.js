const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../server.js');
const fileContent = fs.readFileSync(filePath, 'utf-8');
const lines = fileContent.split('\n');

const queries = ['executeShoot', 'handlePlayerDeath', 'handleBotDeath', 'handleExtraction', 'extract', 'connection', 'reset', 'quests', 'checkAndResetDailyQuests', 'claim_quest_reward', 'medals', 'medal_count'];

queries.forEach(query => {
  console.log(`=== Matches for: "${query}" ===`);
  lines.forEach((line, index) => {
    if (line.includes(query)) {
      console.log(`${index + 1}: ${line.trim()}`);
    }
  });
});
