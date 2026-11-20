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
