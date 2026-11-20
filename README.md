# 行程手冊 Roadbook（旅遊規劃師）

輸入目的地、天數與旅伴需求，產生一份包含每日動線、預算、預訂時程、行前清單、注意事項與緊急聯絡的旅遊手冊。

- 純靜態網頁（HTML、CSS、JavaScript），不需要建置，也不需要安裝套件。
- **不呼叫任何 API、不需要 API 金鑰**：網站產生規劃提示詞，貼到 claude.ai 由 Claude 規劃，再把回覆的 JSON 匯入網站排版。
- 規劃預計做成 [Claude Flow](https://github.com/chenyu0502/Claude_Flow) 的子網站 `/travel/`，共用登入，只有登入的親友看得到。

## 使用方式

1. 按「規劃新行程」，填寫需求（只有目的地與天數必填），按「產生規劃提示詞」。
2. 按「複製提示詞」，到 claude.ai 開新對話貼上送出。
3. 複製 Claude 回覆的整段 JSON，貼回網站的匯入欄位，按「匯入手冊」。
4. 要修改行程：在頁面最下方「調整行程」寫一句需求，產生調整提示詞，同樣貼到 claude.ai 再匯入。

## 本機預覽

雙擊 `start.bat`（需要 Python 或 Node.js 其中一個），瀏覽器會開啟 http://localhost:8090 。
也可以直接用瀏覽器開啟 `index.html`。

## 資料儲存

- 行程存在瀏覽器的 localStorage，只有這台電腦的這個瀏覽器看得到；換裝置或清除網站資料後就會消失。
- 長期保存請用「下載 JSON」，之後可用「匯入 JSON」還原。
- **repo 是公開的，不要把真實行程（日期、住宿、旅伴）commit 進來。** `.gitignore` 已排除 `trips/` 與 `*.trip.json`。

## 檔案結構

| 檔案 | 內容 |
|---|---|
| `index.html` | 頁面結構 |
| `css/style.css` | 樣式（淺色、深色、列印） |
| `js/app.js` | 表單、提示詞、匯入匯出、手冊排版 |
| `js/sample.js` | 範例行程（京都・大阪 5 日） |
| `js/version.js` | 版本號 |

## 手冊 JSON 格式

格式定義在 `js/app.js` 的 `SCHEMA`（也是提示詞的一部分）。主要欄位：`title`、`dayPlans[].items[]`（`type` 為 `move`、`sight`、`food`、`stay`、`rest`）、`budget.items[]`、`bookings[]`、`checklist[]`、`notes[]`（`level` 為 `critical`、`warn`、`info`）、`emergency[]`。匯入時 `normalize()` 會補齊缺漏欄位。

## 已知限制

- 票價、營業時間、交通時間是 Claude 依知識估算，不是即時資料；出發前請以官方網站為準。
- 行程天數上限 14 天；天數長時 Claude 的回覆可能被截斷，請它「繼續」後再完整複製。
