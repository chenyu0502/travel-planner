# 行程手冊 Roadbook（旅遊規劃師）

輸入目的地、天數與旅伴需求，產生一份包含每日動線、預算、預訂時程、行前清單、注意事項與緊急聯絡的旅遊手冊。

- 純靜態網頁（HTML、CSS、JavaScript），不需要建置，也不需要安裝套件。
- **不呼叫任何 API、不需要 API 金鑰**：網站產生規劃提示詞，貼到 claude.ai 由 Claude 規劃，再把回覆的 JSON 匯入網站排版。
- 發布在 [Claude Flow](https://github.com/chenyu0502/Claude_Flow) 的子網站 `/travel/`，共用登入，只有登入的親友看得到。

## 發布流程

1. 合併到 `main`。
2. GitHub Actions（`.github/workflows/notify-claude-flow.yml`）呼叫 Vercel Deploy Hook，Claude Flow 重新部署。
3. Claude Flow 建置時由 `scripts/fetch-travel.mjs` 下載本 repo 的 `index.html`、`css/`、`js/`，並插入登入檢查。

首次設定：在 Vercel 的 Claude Flow 專案建立 Deploy Hook（分支 `master`），把網址存到本 repo 的 Secret `VERCEL_DEPLOY_HOOK`。沒有設定時 Actions 會略過，不會失敗。

## 使用方式

1. 按「規劃新行程」，填寫需求（只有目的地與天數必填），按「產生規劃提示詞」。
2. 按「複製提示詞」，到 claude.ai 開新對話貼上送出。
3. 複製 Claude 回覆的整段 JSON，貼回網站的匯入欄位，按「匯入手冊」。
4. 要修改行程：在頁面最下方「調整行程」寫一句需求，產生調整提示詞，同樣貼到 claude.ai 再匯入。

## 本機預覽

雙擊 `start.bat`（需要 Python 或 Node.js 其中一個），瀏覽器會開啟 http://localhost:8090 。
也可以直接用瀏覽器開啟 `index.html`。

## 機票

「機票」區塊幫你比較與選擇航班，但**不直接購票**（購票需要付費的訂位 API 與航空公司授權）：

1. 用 Google Flights、Skyscanner 搜尋（自動帶入航線、日期、人數），或請 Claude 列出候選航班後匯入。
   **Claude Code 查好的班表**：在 Claude Code 對話中告訴它航線與航空公司，它會上網查詢並寫入 `js/flight-data.js`，網頁依行程日期自動列出當天的航班（只存每週班表，不存旅行日期）。
   **依航空公司直接查詢**：在 Claude Flow 底下，選航空公司後按「查這家的當日航班」，網站後端（Claude Flow 的 `/api/travel/flights`，Gemini＋Google 搜尋）會直接上網查詢並列出結果。
   也可以「依航空公司查當日航班」：一次選一家航空，產生提示詞貼到 claude.ai（開啟網路搜尋），把出發日、回程日的直飛航班匯入，再點選組成去回程加入比較表。時刻來自網路上的航空公司或航班動態網站，是參考值。
2. 在比較表新增、編輯航班，按「選這班」後，第一天與最後一天的航班與預算的機票會自動更新。
3. 到航空公司官網或訂票網站購買後，標示「已訂位」。訂位代號只存在這台電腦（localStorage 的 `rb.pnr.<行程 ID>`），不會存進行程，也不會跟著分享連結給別人。

## 住宿

「住宿」區塊依地區或景點搜尋附近飯店（不直接訂房）：

1. 輸入地區或景點與入住、退房日期，按「搜尋附近飯店」。在 Claude Flow 底下由後端（`/api/travel/hotels`，Gemini＋Google 搜尋）直接查詢，也可以改用 claude.ai 提示詞。
2. 比較每間飯店的交通、參考價、房型、評分與注意事項，按「選這間」後，每天的住宿與預算的住宿金額會自動更新。住兩個地方時分段搜尋、各選一間。
3. 到 Booking.com 或飯店官網訂房後，標示「已訂房」。訂房確認碼只存在這台電腦（localStorage 的 `rb.hotelconf.<行程 ID>.<住宿 ID>`）。

## 門票

「門票」區塊查詢行程中景點的門票（不代售）：勾選景點後查詢（在 Claude Flow 底下由 `/api/travel/tickets` 直接查詢，或改用 claude.ai 提示詞），比較預約狀態、價格、開賣規則與購買管道。「加入計畫」的門票會加總到預算，需要預約的排進預訂時程。購票確認碼只存在這台電腦（localStorage 的 `rb.ticketconf.<行程 ID>.<景點名稱>`）。

## 交通票券

「交通票券」區塊依行程中的移動段分析該買哪些票券（不代售）：在 Claude Flow 底下由 `/api/travel/transport` 直接分析，或改用 claude.ai 提示詞。比較周遊券、IC 卡、機場交通與需劃位的車票是否比單買划算。「加入計畫」的票券另列預算「交通票券」、需預約的排進預訂時程、並列在總覽的交通策略。確認碼只存在這台電腦（localStorage 的 `rb.passconf.<行程 ID>.<票券名稱>`）。

## 餐廳

「餐廳」區塊為行程中的每一餐找餐廳（不代為訂位）：按「為這餐找餐廳」帶入地點與時間，在 Claude Flow 底下由 `/api/travel/restaurants` 直接查詢，或改用 claude.ai 提示詞。「選這家」會改寫行程中的那一餐，需要訂位的排進預訂時程。訂位確認碼只存在這台電腦（localStorage 的 `rb.diningconf.<行程 ID>.<選擇 ID>`）。

## 資料儲存與分享

| 執行環境 | 存在哪裡 | 誰看得到 |
|---|---|---|
| Claude Flow 的 `/travel/` | Firestore `trips/{ID}`（由 Claude Flow 提供存取介面） | 建立者在任何裝置都看得到；知道連結（`/travel/#trip=<ID>`）的其他登入使用者可以看，只有建立者能修改與刪除 |
| 本機預覽（`start.bat` 或直接開 `index.html`） | 瀏覽器 localStorage | 只有這台電腦的這個瀏覽器 |

- 本 repo 不載入 Firebase。在 Claude Flow 底下時，Claude Flow 的登入檢查會提供 `window.ClaudeFlowTravel`（`listMyTrips`、`getTrip`、`saveTrip`、`deleteTrip`），並發出 `claudeflow:travel-ready` 事件；`js/app.js` 偵測到就改用雲端。介面與權限規則定義在 Claude_Flow 的 `src/travel-store.ts` 與 `firestore.rules`。
- 行前清單的勾選狀態只存在各自的瀏覽器，不會同步給其他人。
- 長期保存或傳給沒有帳號的人，可以用「下載 JSON」，之後再「匯入 JSON」。
- **repo 是公開的，不要把真實行程（日期、住宿、旅伴）commit 進來。** `.gitignore` 已排除 `trips/` 與 `*.trip.json`。

## 檔案結構

| 檔案 | 內容 |
|---|---|
| `index.html` | 頁面結構 |
| `css/style.css` | 樣式（淺色、深色、列印），以及版面風格：航線（預設）、旅行手帳、機場看板（`<html data-style>`，選擇存在 localStorage 的 `rb.style`） |
| `js/app.js` | 表單、提示詞、匯入匯出、手冊排版 |
| `js/sample.js` | 範例行程（京都・大阪 5 日） |
| `js/version.js` | 版本號 |

## 手冊 JSON 格式

格式定義在 `js/app.js` 的 `SCHEMA`（也是提示詞的一部分）。主要欄位：`title`、`dayPlans[].items[]`（`type` 為 `move`、`sight`、`food`、`stay`、`rest`）、`budget.items[]`、`bookings[]`、`checklist[]`、`notes[]`（`level` 為 `critical`、`warn`、`info`）、`emergency[]`。匯入時 `normalize()` 會補齊缺漏欄位。

## 已知限制

- 票價、營業時間、交通時間是 Claude 依知識估算，不是即時資料；出發前請以官方網站為準。
- 行程天數上限 14 天；天數長時 Claude 的回覆可能被截斷，請它「繼續」後再完整複製。
