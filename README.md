# 《紅區 (RED ZONE)》 2D 俯視角多人撤離射擊遊戲

《紅區 (RED ZONE)》是一款基於 HTML5、Node.js、Socket.io 和 SQLite 實作的 2D 俯視角多人連線生存撤離射擊網頁遊戲。玩家可以進行裝備購買、大廳抽獎、部署進入戰場、搜刮物資、與機器人或隱藏 BOSS 對戰、搶奪其他玩家的物資，並在成功撤離後將戰利品帶回倉庫。

---

## 🎮 核心遊戲機制

1. **多人連線與即時碰撞**：
   - 使用 Socket.io 進行權威伺服器（Authoritative Server）同步，包含 2D 滑動牆體碰撞、Hitscan 射擊判定。
   - 獨特手電筒視覺遮罩光錐，呈現寫實的暗夜視線迷霧。

2. **左右分欄大廳背包與個人倉庫**：
   - **左側背包網格**：顯示玩家穿戴之背包內物品，格子大小依背包稀有度動態擴增（白 16 格至紅 32 格）。
   - **右側個人倉庫**：7x100 規格的大型物資倉庫。
   - 支援三向拖曳（倉庫 ↔ 背包 ↔ 穿戴裝備槽）與右鍵快捷轉移，提供流暢的整理體驗。

3. **隨機黑市商店與配贈機制**：
   - 商店物品顯示**購買總價**（如彈藥、繃帶整包價格），不再顯示單價，防止購買扣款時的認知混淆。
   - 購買槍枝時會**自動配贈一盒該槍適配子彈**，並實施雙重空間安全校驗（空間不足即防錯拒絕交易）。
   - 高階裝備機率隨玩家等級遞增而調高（每升一級高階刷出率 +1%）。

4. **CS:GO 滾輪式幸運軍火箱抽獎**：
   - 每次花費 **$5,000 美金** 抽獎。
   - 擁有平滑減速緩動動畫與 Web Audio API 自動合成的實時「滴答」指針碰撞音效。
   - 安全 Stash 空間防錯校驗（倉庫裝不下則拒絕扣款）。

5. **隨機機器人與隱藏 BOSS-潘誼**：
   - 普通機器人隨機套用真實玩家人名（如 `BOT-方文奕`）。
   - 隨機出現的隱藏 BOSS 潘誼：配備金色霰彈槍與全套紅色頂裝，擁有高達 300 生命與高額減傷防禦（赤甲 95.2% 減傷），擊殺後會全服廣播並生成專屬 6x6 超大型屍體搜刮箱。

6. **每日任務 (0/3) 與榮耀勳章永久加成**：
   - 自動在台北時間每日跨天重置。
   - 任務 3（每日必有）：擊殺隱藏 BOSS 1 次（獎勵「榮耀勳章」1 枚，攻擊力永久 +1）。
   - 任務 1 & 2：從搜刮、撤離、擊殺玩家、擊殺機器人中隨機抽配。
   - **永久加成**：每枚勳章使玩家開火造成的子彈傷害永久 +1，數值會動態整合在武器 Tooltip 的攻擊力顯示中。

7. **快捷鍵 (1~5) 與局內右鍵選單**：
   - 局內可按數字鍵 `1`~`5` 使用快捷欄內的醫療品或子彈進行快速治療與互動。
   - 局內右鍵物資會彈出自訂選單，支援快速使用、穿戴、放回箱子、或丟棄至地面生成落物箱。

---

## 📁 專案目錄結構

```text
├── db.js                 # SQLite 資料庫初始化與 ALTER 遷移腳本
├── server.js             # 遊戲主伺服器（Express 路由、Authoritative 物理與 Socket.io 協議）
├── package.json          # Node.js 專案依賴與啟動指令
├── public/               # 用戶端資源目錄
│   ├── index.html        # 大廳與戰局主 HTML 介面
│   ├── css/
│   │   └── style.css     # 精美毛玻璃擬態、發光霓虹稀有度邊框與抽獎 UI 樣式
│   └── js/
│       └── game.js       # 用戶端渲染與 Socket 同步、畫布繪製、Tooltip 與音效生成
└── scratch/              # 開發單元測試腳本目錄
```

---

## 🚀 本地開發與運行

請確保您本地已安裝 **Node.js**（推薦 v18+）。

1. **安裝相依套件**：
   ```bash
   npm install
   ```

2. **開發模式啟動**（支援存檔自動重載）：
   ```bash
   npm run dev
   ```

3. **生產模式啟動**：
   ```bash
   npm start
   ```

4. **瀏覽器存取**：
   打開瀏覽器存取 [http://localhost:3000](http://localhost:3000) 即可遊玩。

5. **運行單元測試**（驗證每日任務、重置與屬性加成）：
   ```bash
   node scratch/test_quests_system.js
   ```

---

## ☁️ 部署至 Render 雲端平台

如果您希望將此遊戲部署到 **Render**，請參考以下步驟：

### 第一步：將程式碼推送至 GitHub
將專案所有檔案（包含 `package.json`、`server.js`、`db.js`、`public/`）提交並推送到您個人的 GitHub 公開或私有倉庫中。

### 第二步：在 Render 建立 Web Service
1. 登入 [Render](https://render.com) 控制台。
2. 點擊 **New +** 並選擇 **Web Service**。
3. 連結您的 GitHub 帳戶，並選擇剛剛推送的《紅區》專案倉庫。

### 第三步：設定 Web Service 組態
- **Name**: `redzone-game` (或自訂名稱)
- **Environment**: `Node`
- **Region**: 選擇最靠近您的區域（如 `Singapore`）
- **Branch**: `main` (或您的預設分支)
- **Build Command**: `npm install`
- **Start Command**: `npm start`
- **Instance Type**: 選擇 `Free` (免費方案)

### ⚠️ 重要：設定 SQLite 資料持久化 (Persistence)
由於 Render 的 Web Service 免費方案容器在每次重新部署或休眠重啟時，其硬碟內容會被還原（Ephemeral Storage），這會導致玩家的 `redzone.db` 資料庫被重置清空。

若要保留玩家存檔：
1. **升級方案以附加硬碟**（Render 的 Web Service 需付費方案方能附加 Persistent Disk）。
2. 在 **Disks** 分頁中，點擊 **Add Disk**。
   - **Name**: `redzone-db-disk`
   - **Mount Path**: `/data`
   - **Size**: `1 GB` (最低即可)
3. 在 **Environment** 中新增環境變數：
   - `DATABASE_URL` 或在代碼中將資料庫儲存路徑修改為 `/data/redzone.db`。
4. **修改代碼中的 SQLite 路徑**：
   若已附加硬碟，可將 `db.js` 的第四行修改為支援環境變數或固定路徑：
   ```javascript
   const dbPath = process.env.PERSISTENT_DISK_PATH 
     ? path.join(process.env.PERSISTENT_DISK_PATH, 'redzone.db') 
     : path.join(__dirname, 'redzone.db');
   ```

設定完成後，點擊 **Create Web Service**，Render 將會自動編譯並在數分鐘內將您的遊戲上線！
