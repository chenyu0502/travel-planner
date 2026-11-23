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
 * 時刻為參考值：查不到的欄位留空，不推測。
 */
'use strict';
window.RB_FLIGHT_DATA = {
  routes: {
    "TPE-KIX": {
      checkedAt: "2026-11-23",
      note: "三家航空都還沒公布完整的 2026 冬季班表（2026/10/25～2027/3/27），以下依 FlyTeam、Trip.com、關西機場等網站資料整理，時刻與飛航日可能變動",
      flights: [
        { airline: "中華航空", flightNo: "CI152", depart: "09:45", arrive: "13:20", durationMin: 155, days: [],
          source: "https://flyteam.jp/en/flightnumber/CI152", note: "依去年冬季（10/26 起）時刻；2026 年 10 月曾為 09:00 起飛" },
        { airline: "中華航空", flightNo: "CI156", depart: "08:05", arrive: "", durationMin: null, days: [],
          source: "https://info.flightmapper.net/flight/China_Airlines_CI_156", note: "2026/10/25 起改為 08:05 起飛，飛航星期與抵達時間未查到" },
        { airline: "中華航空", flightNo: "CI172", depart: "14:20", arrive: "17:50", durationMin: 150, days: [1, 3, 4, 5, 7],
          validFrom: "2026-10-25", validTo: "2027-03-26",
          source: "https://flyteam.jp/en/flightnumber/CI172", note: "已確認 2026 冬季班表" },
        { airline: "星宇航空", flightNo: "JX820", depart: "07:40", arrive: "11:10", durationMin: 150, days: [],
          source: "https://us.trip.com/flights/status-jx820/", note: "依 2026/11/18 實際飛行時刻；抵達時間各網站在 10:48～11:10 之間" },
        { airline: "星宇航空", flightNo: "JX822", depart: "10:15", arrive: "14:00", durationMin: 165, days: [],
          source: "https://us.trip.com/flights/status-jx822/", note: "依 2026 年 10 月時刻，冬季是否相同未確認" },
        { airline: "星宇航空", flightNo: "JX824", depart: "15:30", arrive: "19:00", durationMin: 150, days: [],
          validFrom: "2027-01-15", validTo: "2027-03-27",
          source: "https://www.aviationwire.jp/?p=353628", note: "2027/1/15 起新增的下午班次" },
        { airline: "台灣虎航", flightNo: "IT210", depart: "06:40", arrive: "10:25", durationMin: 165, days: [],
          source: "https://www.trip.com/flights/status-it210/", note: "起飛時間在 06:10～07:00 之間變動，去年冬季曾為 06:10～09:35" },
        { airline: "台灣虎航", flightNo: "IT212", depart: "15:15", arrive: "19:00", durationMin: 165, days: [],
          source: "https://us.trip.com/flights/status-it212/", note: "部分日期 14:15 或 14:40 起飛；準點率偏低" }
      ]
    },
    "KIX-TPE": {
      checkedAt: "2026-11-23",
      note: "三家航空都還沒公布完整的 2026 冬季班表（2026/10/25～2027/3/27），以下依 FlyTeam、Trip.com、關西機場等網站資料整理，時刻與飛航日可能變動",
      flights: [
        { airline: "中華航空", flightNo: "CI153", depart: "14:00", arrive: "", durationMin: 195, days: [],
          source: "https://us.trip.com/flights/status-ci153/", note: "依 2026 年 10 月時刻；抵達時間未查到，去年同班為 14:30～16:45" },
        { airline: "中華航空", flightNo: "CI157", depart: "13:10", arrive: "", durationMin: 175, days: [],
          source: "https://sg.trip.com/flights/status-ci157/", note: "2026 年 11 月實際起飛約 13:01～13:21；抵達時間未查到" },
        { airline: "中華航空", flightNo: "CI173", depart: "19:05", arrive: "", durationMin: 195, days: [],
          source: "https://www.airpaz.com/en/airlines/CI-China-Airlines/city-city/osaka-kansai-jp-taipei-tw", note: "抵達時間未查到，去年同季為 19:00～21:15" },
        { airline: "星宇航空", flightNo: "JX821", depart: "12:20", arrive: "14:35", durationMin: 195, days: [1, 2, 3, 4, 5, 6, 7],
          validFrom: "2026-10-25", validTo: "2027-03-27",
          source: "https://flyteam.jp/en/flightnumber/JX821", note: "冬季班表（夏季改為 13:25 起飛）" },
        { airline: "星宇航空", flightNo: "JX823", depart: "14:00", arrive: "16:15", durationMin: 195, days: [],
          source: "https://flyteam.jp/en/airline_route/kix_tpe/flight_schedule", note: "依去年 11 月班表（每天），2026 冬季未確認" },
        { airline: "台灣虎航", flightNo: "IT211", depart: "11:30", arrive: "13:50", durationMin: 200, days: [],
          source: "https://www.kansai-airport.or.jp/tw/flight/detail/DEP/INT/1?flight_number=IT211&date=today&service_type=PAX", note: "關西機場 2026/11/20 顯示 11:30 起飛；去年冬季也是 11:30～13:50" },
        { airline: "台灣虎航", flightNo: "IT213", depart: "20:00", arrive: "21:50", durationMin: 170, days: [],
          source: "https://us.trip.com/flights/status-it213/", note: "依 2026/10/24 時刻" }
      ]
    }
  }
};
