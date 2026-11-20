/* 範例行程：京都・大阪 5 日（長輩同行），首次開啟時顯示 */
'use strict';
window.RB_SAMPLE = {
  id: "sample-kix5",
  isSample: true,
  title: "京都・大阪 紅葉尾聲 5 日",
  tripCode: "KIX-05",
  origin: { code: "TPE", city: "台北 桃園" },
  dest: { code: "KIX", city: "京都・大阪" },
  startDate: "2026-12-03",
  days: 5,
  travelers: "成人 2、長輩 1（68 歲）",
  people: 3,
  style: "家庭（長輩同行）",
  pace: "適中",
  budgetPerPerson: 42000,
  summary: "前段住京都站、後段住難波，換一次飯店即可。清水寺、嵐山安排在上午避開人潮；坡道與石階多的行程放在體力最好的第 2、3 天，並以計程車補足長輩的移動。",
  assumptions: [
    "以成人 2 位、68 歲長輩 1 位，三人同住一間家庭房估算",
    "匯率以 1 日圓約 0.21 新台幣估算，實際以出發前匯率為準",
    "預算不含購物與伴手禮",
    "去程選上午班機、回程選傍晚班機"
  ],
  overview: {
    weather: "12 月初京都白天約 10–13°C、早晚約 3–5°C，紅葉季尾聲，偶有冷雨。",
    timezone: "UTC+9，比台灣快 1 小時",
    currency: "日圓（JPY）。多數店家可刷卡與 ICOCA，小型寺社與市場仍以現金為主。",
    power: "100V，A 型雙平腳插座，台灣電器多可直接使用",
    language: "日語；車站與主要景點有中英文標示",
    transport: "京都市內以 JR＋計程車為主，觀光季市巴士非常擁擠，帶長輩不建議搭乘尖峰班次。",
    passes: [
      { name: "ICOCA & HARUKA", note: "關西機場到京都的特急 HARUKA 單程優惠，附 ICOCA 交通卡，可在機場 JR 售票處購買" },
      { name: "ICOCA 交通卡", note: "JR、地鐵、私鐵、巴士與便利商店通用，不需另買市內一日券" }
    ]
  },
  dayPlans: [
    { day: 1, date: "2026-12-03", theme: "抵達關西，京都站周邊暖身", area: "關西機場 → 京都站", energy: 2, walkKm: 3,
      stay: "京都站周邊飯店（第 1–3 晚）",
      items: [
        { time: "08:50", type: "move", title: "桃園機場 → 關西機場", mode: "飛機", minutes: 150, detail: "日本比台灣快 1 小時，當地時間約 12:20 抵達" },
        { time: "12:30", type: "rest", title: "入境、領行李、換票", place: "関西国際空港", detail: "以 Visit Japan Web 的 QR Code 通關；在 JR 售票處購買 ICOCA & HARUKA", duration: "約 60 分" },
        { time: "13:45", type: "move", title: "JR 特急 HARUKA", from: "関西空港駅", to: "京都駅", mode: "transit", minutes: 80, detail: "自由席即可，行李放車廂兩端行李架" },
        { time: "15:20", type: "stay", title: "飯店寄放行李、入住", place: "京都駅", detail: "選步行 5 分鐘內的飯店，之後兩天的移動都從京都站出發", cost: "" },
        { time: "16:00", type: "rest", title: "午後休息", detail: "第一天保留體力，讓長輩適應溫差" },
        { time: "17:30", type: "sight", title: "京都站大樓大階梯與空中徑路", place: "京都駅ビル 大階段", detail: "免費夜景，搭手扶梯上樓即可，不必走階梯", duration: "45 分", cost: "免費" },
        { time: "18:30", type: "food", title: "晚餐：京都拉麵小路或伊勢丹餐廳街", place: "京都拉麺小路", detail: "都在車站內，雨天不受影響", cost: "每人約 ¥1,200–2,500" }
      ]},
    { day: 2, date: "2026-12-04", theme: "東山：清水寺、二年坂、八坂神社", area: "東山・祇園", energy: 4, walkKm: 6,
      stay: "京都站周邊飯店",
      items: [
        { time: "07:45", type: "move", title: "計程車直達清水寺下方", from: "京都駅", to: "清水寺", mode: "driving", minutes: 15, detail: "三人共乘約 ¥1,800，比巴士省力且準時", cost: "約 ¥1,800／車" },
        { time: "08:00", type: "sight", title: "清水寺", place: "清水寺", detail: "趕在旅行團抵達前參觀舞台與奧之院", duration: "75 分", cost: "¥500／人", tip: "清水坂上坡約 10 分鐘，請長輩穿防滑鞋，途中可在店家休息" },
        { time: "09:30", type: "sight", title: "三年坂、二年坂散步", place: "二年坂", detail: "石板路與階梯多，下坡時放慢速度", duration: "60 分" },
        { time: "10:45", type: "sight", title: "八坂神社、圓山公園", place: "八坂神社", detail: "地勢平緩，適合拍照與休息", duration: "40 分", cost: "免費" },
        { time: "11:45", type: "food", title: "午餐：祇園一帶的京料理或親子丼", place: "祇園 京料理", detail: "建議先訂位，週五中午排隊時間長", cost: "每人約 ¥2,000–4,000" },
        { time: "13:15", type: "sight", title: "建仁寺（雙龍圖、枯山水）", place: "建仁寺", detail: "可坐在緣側休息，室內參觀需脫鞋", duration: "50 分", cost: "¥800／人" },
        { time: "14:30", type: "move", title: "回飯店休息", from: "祇園四条駅", to: "京都駅", mode: "driving", minutes: 15, detail: "長輩先回飯店；體力足夠的人可續逛花見小路" },
        { time: "18:30", type: "food", title: "晚餐：先斗町或京都站周邊", place: "先斗町", detail: "先斗町臨鴨川的店家多需預約" }
      ]},
    { day: 3, date: "2026-12-05", theme: "嵐山：竹林、天龍寺、渡月橋", area: "嵐山・嵯峨野", energy: 3, walkKm: 5,
      stay: "京都站周邊飯店",
      items: [
        { time: "07:40", type: "move", title: "JR 嵯峨野線", from: "京都駅", to: "嵯峨嵐山駅", mode: "transit", minutes: 16, detail: "週六人潮多，08:00 前抵達竹林最好拍" },
        { time: "08:10", type: "sight", title: "竹林小徑", place: "竹林の小径", duration: "30 分", cost: "免費", detail: "平路為主，輪椅與推車可通行" },
        { time: "08:45", type: "sight", title: "天龍寺曹源池庭園", place: "天龍寺", detail: "世界遺產，從北門進入與竹林相連", duration: "60 分", cost: "庭園 ¥500／人" },
        { time: "10:00", type: "sight", title: "嵯峨野觀光小火車（嵐山站 → 龜岡）", place: "トロッコ嵐山駅", detail: "全程約 25 分鐘的保津川溪谷景觀，坐著就能賞楓，長輩友善", cost: "¥880／人", tip: "出發前約 1 個月開放預訂，週末熱門班次容易售罄" },
        { time: "10:45", type: "move", title: "龜岡回程", from: "亀岡駅", to: "嵯峨嵐山駅", mode: "transit", minutes: 10, detail: "搭 JR 嵯峨野線返回" },
        { time: "11:45", type: "food", title: "午餐：嵐山湯豆腐", place: "嵐山 湯豆腐", detail: "清淡好入口，適合長輩", cost: "每人約 ¥3,000–4,500" },
        { time: "13:15", type: "sight", title: "渡月橋與桂川河岸", place: "渡月橋", duration: "40 分", cost: "免費", detail: "河岸有長椅可休息" },
        { time: "14:15", type: "move", title: "返回京都站", from: "嵯峨嵐山駅", to: "京都駅", mode: "transit", minutes: 16 },
        { time: "15:00", type: "rest", title: "飯店休息、整理行李", detail: "明天換飯店，先把伴手禮分裝好" }
      ]},
    { day: 4, date: "2026-12-06", theme: "伏見稻荷，移動到大阪", area: "伏見 → 難波", energy: 4, walkKm: 7,
      stay: "難波周邊飯店（第 4 晚）",
      items: [
        { time: "07:50", type: "move", title: "JR 奈良線", from: "京都駅", to: "稲荷駅", mode: "transit", minutes: 5 },
        { time: "08:00", type: "sight", title: "伏見稻荷大社千本鳥居", place: "伏見稲荷大社", detail: "長輩走到奧社奉拜所即可折返（約 30 分鐘來回）；登頂全程需 2–3 小時", duration: "90 分", cost: "免費", tip: "週日上午 9 點後人潮快速增加" },
        { time: "09:45", type: "move", title: "回京都站取行李後前往大阪", from: "京都駅", to: "大阪駅", mode: "transit", minutes: 30, detail: "JR 新快速約 30 分鐘；行李多可考慮飯店間宅配" },
        { time: "11:00", type: "move", title: "轉乘地鐵御堂筋線到難波", from: "梅田駅", to: "なんば駅", mode: "transit", minutes: 10 },
        { time: "11:30", type: "stay", title: "難波飯店寄放行李", place: "なんば駅" },
        { time: "12:00", type: "food", title: "午餐：黑門市場", place: "黒門市場", detail: "生食海鮮價格偏高，先看標價；市場內不宜邊走邊吃", cost: "每人約 ¥2,000–3,500" },
        { time: "13:30", type: "rest", title: "入住、午休", detail: "下午到傍晚保留空檔" },
        { time: "17:30", type: "sight", title: "道頓堀、心齋橋筋", place: "道頓堀", detail: "固力果看板夜景，商店街有屋頂不怕雨", duration: "90 分" },
        { time: "19:00", type: "food", title: "晚餐：大阪燒或串炸", place: "道頓堀 お好み焼き", cost: "每人約 ¥2,000–3,000" }
      ]},
    { day: 5, date: "2026-12-07", theme: "大阪城，傍晚返台", area: "大阪城 → 關西機場", energy: 2, walkKm: 4,
      stay: "",
      items: [
        { time: "08:30", type: "move", title: "退房、行李寄放飯店", from: "なんば駅", to: "大阪城公園駅", mode: "transit", minutes: 25 },
        { time: "09:00", type: "sight", title: "大阪城公園與天守閣", place: "大阪城天守閣", detail: "天守閣內有電梯；公園範圍大，可搭園內遊園車減少步行", duration: "120 分", cost: "天守閣 ¥600／人" },
        { time: "11:30", type: "food", title: "午餐：難波周邊", place: "なんばパークス", cost: "每人約 ¥1,500–2,500" },
        { time: "13:30", type: "move", title: "南海電鐵 rapi:t 特急", from: "なんば駅", to: "関西空港駅", mode: "transit", minutes: 40, detail: "全車指定席，可先在網路購票" },
        { time: "14:30", type: "rest", title: "報到、退稅、登機", place: "関西国際空港", detail: "國際線建議起飛前 2 小時抵達" }
      ]}
  ],
  budget: {
    currency: "TWD",
    note: "三人合計估算",
    items: [
      { category: "機票", amount: 42000, note: "經濟艙來回含稅，每人約 14,000" },
      { category: "住宿", amount: 27000, note: "4 晚家庭房，紅葉季每晚約 6,000–7,500" },
      { category: "交通", amount: 9000, note: "HARUKA、rapi:t、JR、計程車" },
      { category: "餐飲", amount: 27000, note: "每人每日約 1,800" },
      { category: "門票與體驗", amount: 4500, note: "寺社、天守閣、小火車" },
      { category: "保險與網路", amount: 3600, note: "旅平險、eSIM" },
      { category: "預備金", amount: 10000, note: "約 8%，用於臨時計程車、醫療或延誤" }
    ]
  },
  bookings: [
    { when: "出發前 2–3 個月", what: "機票、京都站與難波飯店", note: "紅葉季京都房價高且房量少" },
    { when: "出發前 1 個月", what: "嵯峨野觀光小火車", note: "開賣日即訂，指定週六上午班次" },
    { when: "出發前 2 週", what: "祇園午餐、先斗町晚餐訂位", note: "告知同行長輩，請店家安排桌椅座位" },
    { when: "出發前 1 週", what: "Visit Japan Web 登錄、旅平險與海外突發疾病險、eSIM", note: "長輩保單確認是否涵蓋既有疾病" },
    { when: "出發前 1 天", what: "確認航班時間、列印訂位紀錄", note: "護照效期需涵蓋停留期間" }
  ],
  checklist: [
    { group: "證件與文件", items: ["護照（效期涵蓋停留期間）", "機票與飯店訂位紀錄（紙本＋手機）", "Visit Japan Web QR Code 截圖", "旅平險保單與緊急聯絡卡"] },
    { group: "金流", items: ["日圓現金（每人約 ¥20,000）", "海外回饋信用卡兩張分開放", "ICOCA（機場購買）"] },
    { group: "衣物", items: ["保暖外套與可脫換的洋蔥式穿搭", "防滑好走的鞋", "折疊傘", "暖暖包"] },
    { group: "健康", items: ["長輩常備藥（份量多帶 3 天）與藥單", "腸胃藥、止痛藥、OK 繃", "口罩"] },
    { group: "電子", items: ["eSIM 或漫遊", "行動電源（只能放隨身行李）", "充電線"] }
  ],
  notes: [
    { category: "入境", level: "critical", text: "持台灣護照入境日本觀光可免簽停留 90 天。出發前在 Visit Japan Web 填寫入境審查與海關申報，取得 QR Code。" },
    { category: "長輩照護", level: "warn", text: "清水坂、二年坂、伏見稻荷石階多。行程中每 60–90 分鐘安排一次坐下休息，必要時改搭計程車。" },
    { category: "交通", level: "warn", text: "京都市巴士在紅葉季經常滿載，帶長輩以 JR 與計程車為主。日本車輛靠左行駛，過馬路先看右邊。" },
    { category: "文化禮儀", level: "info", text: "寺社殿內多數禁止攝影，請看標示。電車上避免講電話，垃圾帶回飯店丟棄，街上垃圾桶很少。" },
    { category: "天氣", level: "info", text: "早晚溫差約 8°C，清晨出門需要保暖外套，室內暖氣強，內層穿薄。" },
    { category: "退稅", level: "info", text: "同一店家單日消費滿 ¥5,000（未稅）可辦理退稅，需出示護照本人。" }
  ],
  emergency: [
    { label: "警察", value: "110" },
    { label: "救護車、消防", value: "119" },
    { label: "日本觀光客熱線（JNTO，24 小時，可說中文）", value: "050-3816-2787" },
    { label: "外交部緊急聯絡中心（旅外國人急難救助）", value: "+886-800-085-095" },
    { label: "台北駐大阪經濟文化辦事處", value: "出發前至外交部領事事務局網站確認最新電話" }
  ]
};
