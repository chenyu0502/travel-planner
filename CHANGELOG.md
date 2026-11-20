# 更新紀錄

## 0.2.0（2026-11-20）

- 接上 Claude Flow，發布在 `/travel/`，需要登入 Claude Flow 才能使用。
- 在 Claude Flow 底下執行時，頂列顯示回 Claude Flow 首頁的連結。
- 新增 GitHub Actions：合併到 main 後透過 Deploy Hook 通知 Claude Flow 重新部署。

## 0.1.0（2026-11-20）

- 第一版：需求表單、規劃提示詞、匯入 Claude 回覆的 JSON、手冊排版（封面、總覽、每日動線、預算、預訂時程、行前清單、注意事項、緊急聯絡）。
- 調整行程：以目前手冊與一句需求產生調整提示詞。
- 匯出：複製文字版、下載 Markdown、下載 JSON、列印 / 另存 PDF。
- 行程存在瀏覽器 localStorage，可在「我的行程」切換。
