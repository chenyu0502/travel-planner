/* 航線班表（由 Claude Code 在對話中上網查詢後寫入）
 *
 * 只存公開的每週班表，不存任何人的旅行日期：網頁依行程的出發日、回程日，
 * 挑出當天有飛（days 包含該星期、日期在 validFrom～validTo 內）的航班顯示。
 *
 * 格式：routes["出發機場-抵達機場"] = {
 *   checkedAt: "查詢日期 YYYY-MM-DD", note: "整體說明",
 *   flights: [{ airline, flightNo, depart: "HH:MM", arrive: "HH:MM"（皆為當地時間）, durationMin,
 *               days: [1..7]（週一＝1，空陣列＝不確定）, validFrom, validTo（可省略）, source: "https://...", note }]
 * }
 */
'use strict';
window.RB_FLIGHT_DATA = {
  routes: {}
};
