/* 行程手冊 Roadbook：表單、手冊排版、匯入匯出（純前端，不呼叫任何 API） */
(() => {
'use strict';

/* ---------- 工具 ---------- */
const $ = (s, r = document) => r.querySelector(s);
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[c]));
const store = {
  get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} }
};
const WEEK = ["日","一","二","三","四","五","六"];
function fmtDate(iso) {
  if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return "";
  const d = new Date(iso + "T00:00:00");
  return `${d.getMonth()+1}/${d.getDate()}（${WEEK[d.getDay()]}）`;
}
function addDays(iso, n) {
  if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return "";
  const d = new Date(iso + "T00:00:00"); d.setDate(d.getDate() + n);
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}
const num = n => Number.isFinite(+n) ? Math.round(+n).toLocaleString("zh-TW") : "";
const gmap = q => "https://www.google.com/maps/search/?api=1&query=" + encodeURIComponent(q);
const gdir = (a, b, mode) => "https://www.google.com/maps/dir/?api=1&origin=" + encodeURIComponent(a) + "&destination=" + encodeURIComponent(b) + "&travelmode=" + (["transit","walking","driving"].includes(mode) ? mode : "transit");
const TYPE = { move: "移動", sight: "景點", food: "用餐", stay: "住宿", rest: "休息" };
const MODE = { transit: "大眾運輸", walking: "步行", driving: "計程車／開車" };
const BUDGET_COLORS = ["var(--accent)","var(--signal)","var(--t-stay)","var(--t-food)","var(--ok)","var(--t-move)","var(--crit)","var(--t-sight)"];
function toast(msg) {
  const t = document.createElement("div"); t.className = "toast"; t.textContent = msg; t.setAttribute("role","status");
  document.body.append(t); setTimeout(() => t.remove(), 2600);
}

/* 將 Claude 回傳的資料整理成安全的結構，缺漏欄位補預設值 */
function normalize(d) {
  if (!d || typeof d !== "object") throw new Error("格式不正確");
  const arr = v => Array.isArray(v) ? v : [];
  const out = {
    id: d.id || ("trip-" + Date.now().toString(36)),
    title: String(d.title || "未命名行程"),
    tripCode: String(d.tripCode || "TRIP").slice(0, 10),
    origin: { code: String(d.origin?.code || "TPE").slice(0,4), city: String(d.origin?.city || "") },
    dest: { code: String(d.dest?.code || "---").slice(0,4), city: String(d.dest?.city || "") },
    startDate: d.startDate || "",
    days: +d.days || arr(d.dayPlans).length,
    travelers: String(d.travelers || ""), people: Math.max(1, parseInt(d.people) || 0) || null, style: String(d.style || ""), pace: String(d.pace || ""),
    budgetPerPerson: +d.budgetPerPerson || 0,
    summary: String(d.summary || ""),
    assumptions: arr(d.assumptions).map(String),
    overview: Object.assign({ passes: [] }, d.overview || {}),
    dayPlans: arr(d.dayPlans).map((p, i) => ({
      day: +p.day || i + 1, date: p.date || "", theme: String(p.theme || ""), area: String(p.area || ""),
      energy: Math.max(1, Math.min(5, +p.energy || 3)), walkKm: +p.walkKm || 0, stay: String(p.stay || ""),
      items: arr(p.items).map(it => ({ ...it, type: TYPE[it.type] ? it.type : "sight" }))
    })),
    budget: { currency: d.budget?.currency || "TWD", note: d.budget?.note || "", items: arr(d.budget?.items).filter(x => +x.amount > 0) },
    bookings: arr(d.bookings), checklist: arr(d.checklist).map(g => ({ group: String(g.group || ""), items: arr(g.items).map(String) })),
    notes: arr(d.notes).map(n => ({ ...n, level: ["info","warn","critical"].includes(n.level) ? n.level : "info" })),
    emergency: arr(d.emergency),
    isSample: !!d.isSample, request: d.request || null
  };
  out.overview.passes = arr(out.overview.passes);
  if (!out.dayPlans.length) throw new Error("沒有每日行程");
  return out;
}

/* ---------- 渲染 ---------- */
let trip = null;

function render(t) {
  trip = t;
  $("#sampleBanner").hidden = !t.isSample;
  const total = t.budget.items.reduce((s, x) => s + (+x.amount || 0), 0);
  const end = t.startDate ? addDays(t.startDate, t.days - 1) : "";
  const ov = t.overview;

  const pass = `
  <article class="pass" id="overview" style="scroll-margin-top:120px">
    <div class="pass-main">
      <div class="eyebrow">旅遊手冊 · Roadbook${t.isSample ? " · 範例" : ""}</div>
      <div class="route">
        <div><div class="code">${esc(t.origin.code)}</div><div class="city">${esc(t.origin.city)}</div></div>
        <div class="arrow" aria-hidden="true"></div>
        <div><div class="code">${esc(t.dest.code)}</div><div class="city">${esc(t.dest.city)}</div></div>
      </div>
      <h1>${esc(t.title)}</h1>
      ${t.summary ? `<p class="summary">${esc(t.summary)}</p>` : ""}
      <div class="meta">
        <div><span class="eyebrow">日期</span><b class="mono">${t.startDate ? esc(fmtDate(t.startDate) + " – " + fmtDate(end)) : "未指定"}</b></div>
        <div><span class="eyebrow">天數</span><b>${t.days} 天 ${Math.max(t.days-1,0)} 夜</b></div>
        <div><span class="eyebrow">旅伴</span><b>${esc(t.travelers || "未指定")}</b></div>
        <div><span class="eyebrow">型態 / 步調</span><b>${esc([t.style, t.pace].filter(Boolean).join(" · ") || "未指定")}</b></div>
      </div>
    </div>
    <aside class="pass-stub">
      <div><span class="eyebrow">行程代號</span><div class="tripcode">${esc(t.tripCode)}</div></div>
      <div class="stub-row"><span class="eyebrow">預算估算</span><b>NT$ ${num(total)}</b></div>
      ${t.budgetPerPerson ? `<div class="stub-row"><span class="eyebrow">每人目標</span><b>NT$ ${num(t.budgetPerPerson)}</b></div>` : ""}
      <div class="barcode" aria-hidden="true"></div>
    </aside>
  </article>`;

  const ovRows = [["氣候", ov.weather], ["時區", ov.timezone], ["貨幣與支付", ov.currency], ["電壓插座", ov.power], ["語言", ov.language]]
    .filter(r => r[1]).map(r => `<dt>${r[0]}</dt><dd>${esc(r[1])}</dd>`).join("");
  const overview = `
  <section class="block">
    <h2>旅程總覽 <span class="eyebrow">Overview</span></h2>
    <div class="cols">
      <div class="panel"><h3>目的地基本資訊</h3><dl class="kv">${ovRows}</dl></div>
      <div class="panel"><h3>交通策略</h3><p style="margin:0 0 10px">${esc(ov.transport || "")}</p>
        ${ov.passes.length ? `<ul class="plain">${ov.passes.map(p => `<li><b>${esc(p.name)}</b>：${esc(p.note || "")}</li>`).join("")}</ul>` : ""}</div>
      ${t.assumptions.length ? `<div class="panel"><h3>規劃假設（請核對）</h3><ul class="plain">${t.assumptions.map(a => `<li>${esc(a)}</li>`).join("")}</ul></div>` : ""}
    </div>
  </section>`;

  const tabs = t.dayPlans.map(p => `<a href="#day-${p.day}"><b>DAY ${String(p.day).padStart(2,"0")}</b>${esc(p.area || p.theme)}</a>`).join("");
  const days = t.dayPlans.map(renderDay).join("");

  const bItems = t.budget.items;
  const bar = bItems.map((x, i) => `<span style="width:${total ? (x.amount/total*100).toFixed(2) : 0}%;background:${BUDGET_COLORS[i % BUDGET_COLORS.length]}" title="${esc(x.category)}"></span>`).join("");
  const people = t.people || parsePeople(t.travelers);
  const budget = `
  <section class="block" id="budget">
    <h2>預算明細 <span class="eyebrow">Budget · ${esc(t.budget.currency)}</span></h2>
    <div class="panel">
      <div style="display:flex;justify-content:space-between;flex-wrap:wrap;gap:8px;align-items:baseline">
        <span>${esc(t.budget.note || "全體合計估算")}</span>
        <span class="mono" style="font-size:20px;font-weight:700">NT$ ${num(total)}${people > 1 ? `<small style="font-size:13px;color:var(--muted);font-weight:500"> ／ 每人約 ${num(total/people)}</small>` : ""}</span>
      </div>
      <div class="budget-bar" role="img" aria-label="預算分配比例">${bar}</div>
      <div class="tablebox"><table>
        <thead><tr><th>項目</th><th class="num">金額</th><th class="num">占比</th><th>說明</th></tr></thead>
        <tbody>${bItems.map((x, i) => `<tr><td><span class="swatch" style="background:${BUDGET_COLORS[i % BUDGET_COLORS.length]}"></span>${esc(x.category)}</td><td class="num">${num(x.amount)}</td><td class="num">${total ? Math.round(x.amount/total*100) : 0}%</td><td>${esc(x.note || "")}</td></tr>`).join("")}</tbody>
        <tfoot><tr><td>合計</td><td class="num">${num(total)}</td><td class="num">100%</td><td>${t.budgetPerPerson && people ? (total/people > t.budgetPerPerson ? `<span style="color:var(--warn)">每人超出目標約 ${num(total/people - t.budgetPerPerson)}</span>` : `<span style="color:var(--ok)">在每人目標內</span>`) : ""}</td></tr></tfoot>
      </table></div>
    </div>
  </section>`;

  const bookings = t.bookings.length ? `
  <section class="block" id="bookings">
    <h2>預訂時程 <span class="eyebrow">Booking timeline</span></h2>
    <div class="panel tablebox"><table>
      <thead><tr><th>時間點</th><th>要完成的事</th><th>提醒</th></tr></thead>
      <tbody>${t.bookings.map(b => `<tr><td style="white-space:nowrap"><b>${esc(b.when)}</b></td><td>${esc(b.what)}</td><td>${esc(b.note || "")}</td></tr>`).join("")}</tbody>
    </table></div>
  </section>` : "";

  const checked = store.get("rb.check." + t.id, {});
  const checklist = `
  <section class="block" id="checklist">
    <h2>行前清單 <span class="eyebrow">Packing</span> <span class="progress" id="checkProgress"></span></h2>
    <div class="cols">${t.checklist.map((g, gi) => `
      <div class="panel"><h3>${esc(g.group)}</h3><ul class="check">${g.items.map((it, ii) => {
        const k = gi + "-" + ii, on = !!checked[k];
        return `<li class="${on ? "done" : ""}"><input type="checkbox" id="ck-${k}" data-k="${k}" ${on ? "checked" : ""}><label for="ck-${k}"><span>${esc(it)}</span></label></li>`;
      }).join("")}</ul></div>`).join("")}
    </div>
  </section>`;

  const notes = `
  <section class="block" id="notes">
    <h2>注意事項 <span class="eyebrow">Advisories</span></h2>
    <div class="notes">${[...t.notes].sort((a,b) => rank(a.level) - rank(b.level)).map(n => `
      <div class="note ${n.level}"><div class="cat">${esc(n.category)}${n.level === "critical" ? "・必讀" : ""}</div><div>${esc(n.text)}</div></div>`).join("")}
    </div>
  </section>`;

  const emergency = `
  <section class="block" id="emergency">
    <h2>緊急聯絡 <span class="eyebrow">Emergency</span></h2>
    <div class="panel">${t.emergency.map(e => `<div class="contact"><span>${esc(e.label)}</span><b>${esc(e.value)}</b></div>`).join("")}
      <p class="status" style="margin:10px 0 0">電話號碼可長按或點兩下選取複製。建議另外抄寫一份放在錢包。</p></div>
  </section>`;

  $("#book").innerHTML = pass + overview +
    `<section class="block" id="days"><h2>每日行程 <span class="eyebrow">Daily route</span></h2><nav class="daytabs" aria-label="跳到某一天">${tabs}</nav>${days}</section>` +
    budget + bookings + checklist + notes + emergency;
  updateProgress();
}
const rank = l => ({ critical: 0, warn: 1, info: 2 }[l] ?? 3);
function parsePeople(s) {
  const t = String(s).replace(/（[^）]*）|\([^)]*\)/g, ""); const m = t.match(/\d+/g);
  return m ? Math.max(1, m.reduce((a, b) => a + +b, 0)) : 1;
}

function renderDay(p) {
  const energy = Array.from({ length: 5 }, (_, i) => `<i class="${i < p.energy ? "on" : ""}" style="height:${6 + i*3}px"></i>`).join("");
  const items = p.items.map(it => {
    const tc = "t-" + it.type;
    if (it.type === "move") {
      const link = it.from && it.to ? ` · <a href="${gdir(it.from, it.to, it.mode)}" target="_blank" rel="noopener">路線</a>` : "";
      return `<li class="ti move ${tc}"><div class="time">${esc(it.time || "")}</div><div class="rail"></div>
        <div class="body"><div class="name"><b>${esc(it.title)}</b>${it.minutes ? ` · <span class="mono">${+it.minutes} 分</span>` : ""}${it.mode && MODE[it.mode] ? ` · ${MODE[it.mode]}` : (it.mode ? ` · ${esc(it.mode)}` : "")}${link}</div>
        ${it.detail ? `<div class="sub">${esc(it.detail)}</div>` : ""}${it.cost ? `<div class="sub">${esc(it.cost)}</div>` : ""}</div></li>`;
    }
    const sub = [it.duration && `停留 ${esc(it.duration)}`, it.cost && esc(it.cost), it.place && `<a href="${gmap(it.place)}" target="_blank" rel="noopener">地圖</a>`].filter(Boolean).join("<span aria-hidden='true'>·</span>");
    return `<li class="ti ${tc}"><div class="time">${esc(it.time || "")}</div><div class="rail"></div>
      <div class="body"><div><span class="tag">${TYPE[it.type]}</span><span class="name">${esc(it.title)}</span></div>
      ${it.detail ? `<p class="detail">${esc(it.detail)}</p>` : ""}${sub ? `<div class="sub">${sub}</div>` : ""}
      ${it.tip ? `<div class="tip"><b>規劃師提醒：</b>${esc(it.tip)}</div>` : ""}</div></li>`;
  }).join("");
  const moveMin = p.items.filter(i => i.type === "move").reduce((s, i) => s + (+i.minutes || 0), 0);
  return `
  <article class="day" id="day-${p.day}">
    <div class="day-head">
      <div class="daynum">${String(p.day).padStart(2,"0")}<small>${esc(fmtDate(p.date) || "DAY " + p.day)}</small></div>
      <div class="day-title"><h3>${esc(p.theme)}</h3><p>${esc(p.area)}</p></div>
      <div class="day-stats">
        <div class="stat"><span class="eyebrow">體力負荷</span><div class="energy" role="img" aria-label="體力負荷 ${p.energy} / 5">${energy}</div></div>
        ${p.walkKm ? `<div class="stat"><span class="eyebrow">步行</span><b class="mono">約 ${p.walkKm} km</b></div>` : ""}
        ${moveMin ? `<div class="stat"><span class="eyebrow">交通</span><b class="mono">${moveMin} 分</b></div>` : ""}
      </div>
    </div>
    <ol class="timeline">${items}</ol>
    ${p.stay ? `<div class="day-foot"><span><b>今晚住宿：</b>${esc(p.stay)}</span></div>` : ""}
  </article>`;
}

function updateProgress() {
  const boxes = document.querySelectorAll("#checklist input[type=checkbox]");
  const done = [...boxes].filter(b => b.checked).length;
  const el = $("#checkProgress"); if (el) el.textContent = `${done} / ${boxes.length} 已備妥`;
}
document.addEventListener("change", e => {
  const cb = e.target.closest("#checklist input[type=checkbox]"); if (!cb || !trip) return;
  const key = "rb.check." + trip.id, m = store.get(key, {});
  m[cb.dataset.k] = cb.checked; store.set(key, m);
  cb.closest("li").classList.toggle("done", cb.checked); updateProgress();
});

/* ---------- 匯出 ---------- */
function toMarkdown(t) {
  const L = [];
  L.push(`# ${t.title}`, "", `${t.origin.city}（${t.origin.code}）→ ${t.dest.city}（${t.dest.code}）｜${t.days} 天｜${t.travelers}`);
  if (t.startDate) L.push(`日期：${t.startDate} 起`);
  if (t.summary) L.push("", t.summary);
  if (t.assumptions.length) { L.push("", "## 規劃假設"); t.assumptions.forEach(a => L.push(`- ${a}`)); }
  L.push("", "## 每日行程");
  t.dayPlans.forEach(p => {
    L.push("", `### Day ${p.day} ${fmtDate(p.date)} ${p.theme}`, `區域：${p.area}｜體力負荷 ${p.energy}/5${p.walkKm ? `｜步行約 ${p.walkKm} km` : ""}`, "");
    p.items.forEach(i => {
      const extra = [i.minutes && `${i.minutes} 分`, i.duration, i.cost].filter(Boolean).join("，");
      L.push(`- ${i.time || ""} 【${TYPE[i.type]}】${i.title}${extra ? `（${extra}）` : ""}${i.detail ? `：${i.detail}` : ""}`);
      if (i.tip) L.push(`  - 提醒：${i.tip}`);
    });
    if (p.stay) L.push("", `住宿：${p.stay}`);
  });
  const total = t.budget.items.reduce((s, x) => s + (+x.amount || 0), 0);
  L.push("", "## 預算（新台幣）", "", "| 項目 | 金額 | 說明 |", "|---|---:|---|");
  t.budget.items.forEach(x => L.push(`| ${x.category} | ${num(x.amount)} | ${x.note || ""} |`));
  L.push(`| 合計 | ${num(total)} | |`);
  if (t.bookings.length) { L.push("", "## 預訂時程"); t.bookings.forEach(b => L.push(`- ${b.when}：${b.what}${b.note ? `（${b.note}）` : ""}`)); }
  L.push("", "## 行前清單"); t.checklist.forEach(g => { L.push(`**${g.group}**`); g.items.forEach(i => L.push(`- [ ] ${i}`)); });
  L.push("", "## 注意事項"); t.notes.forEach(n => L.push(`- ${n.category}：${n.text}`));
  L.push("", "## 緊急聯絡"); t.emergency.forEach(e => L.push(`- ${e.label}：${e.value}`));
  return L.join("\n");
}
$("#btnCopy").addEventListener("click", async () => {
  const md = toMarkdown(trip);
  try { await navigator.clipboard.writeText(md); toast("已複製文字版行程"); }
  catch {
    const ta = document.createElement("textarea"); ta.value = md; ta.style.cssText = "position:fixed;left:0;top:0;width:1px;height:1px;opacity:0";
    document.body.append(ta); ta.select(); let ok = false; try { ok = document.execCommand("copy"); } catch {} ta.remove();
    toast(ok ? "已複製文字版行程" : "瀏覽器不允許複製，請改用下載");
  }
});

/* ---------- 儲存 ---------- */
function saveTrip(t) {
  if (t.isSample) return;
  const list = store.get("rb.trips", []).filter(x => x.id !== t.id);
  list.unshift({ id: t.id, title: t.title, savedAt: new Date().toISOString(), data: t });
  store.set("rb.trips", list.slice(0, 20)); store.set("rb.current", t.id);
}
function showSaved() {
  const list = store.get("rb.trips", []);
  const box = $("#savedList");
  box.innerHTML = (list.length ? list.map(x => `<div class="row"><span><b>${esc(x.title)}</b> <span class="status mono">${esc(x.savedAt.slice(0,10))}</span></span>
    <span style="display:flex;gap:6px"><button class="btn" type="button" data-load="${esc(x.id)}">開啟</button><button class="btn ghost" type="button" data-del="${esc(x.id)}">刪除</button></span></div>`).join("")
    : `<p class="status">還沒有儲存的行程。產生第一份手冊後會自動存在這裡。</p>`)
    + `<div class="row"><span>範例：京都・大阪 5 日</span><button class="btn" type="button" data-load="sample">開啟範例</button></div>`;
  $("#savedPanel").hidden = false; $("#planner").hidden = true;
  $("#savedPanel").scrollIntoView({ block: "start" });
}
$("#btnSaved").addEventListener("click", () => $("#savedPanel").hidden ? showSaved() : ($("#savedPanel").hidden = true));
$("#savedList").addEventListener("click", e => {
  const ld = e.target.closest("[data-load]"), del = e.target.closest("[data-del]");
  if (ld) {
    const id = ld.dataset.load;
    if (id === "sample") { render(normalize(window.RB_SAMPLE)); store.set("rb.current", ""); }
    else { const x = store.get("rb.trips", []).find(x => x.id === id); if (x) { render(normalize(x.data)); store.set("rb.current", id); } }
    $("#savedPanel").hidden = true; window.scrollTo({ top: 0 });
  }
  if (del) {
    if (del.dataset.confirm !== "1") { del.dataset.confirm = "1"; del.textContent = "確認刪除"; return; }
    store.set("rb.trips", store.get("rb.trips", []).filter(x => x.id !== del.dataset.del)); showSaved();
  }
});

/* ---------- 表單 ---------- */
const STYLES = ["家庭（長輩同行）","親子","蜜月 / 情侶","朋友","獨旅","企業獎勵 / 商務"];
const INTERESTS = ["經典景點","自然景觀","美食小吃","米其林 / 名店","購物","歷史文化","藝術博物館","溫泉放鬆","主題樂園","攝影打卡","戶外運動","夜生活","在地市場"];
function chips(group, list) {
  const el = document.querySelector(`[data-group="${group}"]`);
  el.innerHTML = list.map(x => `<button type="button" class="chip" aria-pressed="false">${esc(x)}</button>`).join("");
  el.addEventListener("click", e => {
    const c = e.target.closest(".chip"); if (!c) return;
    if (el.dataset.single) el.querySelectorAll(".chip").forEach(o => o !== c && o.setAttribute("aria-pressed","false"));
    c.setAttribute("aria-pressed", c.getAttribute("aria-pressed") === "true" ? "false" : "true");
  });
}
chips("style", STYLES); chips("interests", INTERESTS);
const picked = g => [...document.querySelectorAll(`[data-group="${g}"] .chip[aria-pressed="true"]`)].map(c => c.textContent);

function openPlanner() { $("#planner").hidden = false; $("#savedPanel").hidden = true; $("#planner").scrollIntoView({ block: "start" }); $("#fDest").focus({ preventScroll: true }); }
$("#btnNew").addEventListener("click", openPlanner);
document.addEventListener("click", e => { if (e.target.closest("[data-open-planner]")) openPlanner(); });
$("#btnCancelPlan").addEventListener("click", () => { $("#planner").hidden = true; });

function readForm() {
  const v = id => $(id).value.trim();
  return {
    destination: v("#fDest"), days: Math.max(1, Math.min(14, parseInt(v("#fDays")) || 0)), startDate: v("#fStart"),
    from: v("#fFrom"), adults: +v("#fAdults") || 0, seniors: +v("#fSeniors") || 0, kids: +v("#fKids") || 0, kidAges: v("#fKidAges"),
    style: picked("style")[0] || "", pace: v("#fPace"), budget: +v("#fBudget") || 0, stay: v("#fStay"), transport: v("#fTransport"),
    interests: picked("interests"), diet: v("#fDiet"), mobility: v("#fMobility"), notes: v("#fNotes")
  };
}

/* ---------- 規劃師提示詞 ---------- */
const ROLE = `你是一位資深旅遊規劃師，同時具備專案經理、生活顧問與危機處理專家的能力。
工作原則：
1. 熟悉目的地的地理方位、季節氣候、簽證法規、文化禁忌與交通網絡（通票、自駕規則、轉乘）。
2. 精準估算景點間移動時間、排隊人潮與體力消耗，避免拉車過久或過度緊湊；依客群調整步調（長輩：無障礙、如廁與休息頻率；兒童：午休與彈性時間；蜜月：氛圍與私密性）。
3. 把預算花在最有感的地方，交通與票券盡量省；報價列出明細，不隱藏費用；金額為估算時要說明。
4. 不捏造：店名與具體設施只寫你有把握存在的知名地點；不確定的票價、營業時間與電話，改寫成「出發前至官方網站確認」。
5. 使用者沒提供的資訊，用合理假設補齊，並逐條寫進 assumptions。
6. 所有文字使用台灣繁體中文用語，不用 emoji。中文與英文、數字之間保留半形空格。`;

const SCHEMA = `直接在對話中回覆，不要建立 artifact 或檔案。只回覆一個 \`\`\`json 程式碼區塊，區塊外不要任何其他文字。結構如下（欄位名稱必須完全一致）：
{
 "title": "行程名稱，10–18 字",
 "tripCode": "3 碼機場代碼-天數，例 KIX-05",
 "origin": {"code": "出發機場 IATA 代碼", "city": "城市名"},
 "dest": {"code": "主要抵達機場 IATA 代碼", "city": "目的地簡稱"},
 "startDate": "YYYY-MM-DD 或空字串",
 "days": 天數數字,
 "travelers": "例：成人 2、長輩 1（70 歲）",
 "people": 總人數數字,
 "style": "旅行型態", "pace": "悠閒／適中／緊湊",
 "budgetPerPerson": 每人預算數字或 0,
 "summary": "2–3 句說明整體動線與住宿策略",
 "assumptions": ["規劃假設"],
 "overview": {"weather": "該季節氣溫與天候", "timezone": "", "currency": "貨幣與支付習慣", "power": "電壓與插座", "language": "", "transport": "整體交通策略", "passes": [{"name": "票券名稱", "note": "適用情境"}]},
 "dayPlans": [{"day": 1, "date": "YYYY-MM-DD 或空字串", "theme": "當日主題", "area": "區域動線，例：東山・祇園", "energy": 1到5的體力負荷, "walkKm": 步行公里估算, "stay": "當晚住宿區域與建議",
   "items": [
     {"time": "HH:MM", "type": "move", "title": "交通方式名稱", "from": "起點地名（當地語言，可在 Google 地圖搜尋）", "to": "終點地名", "mode": "transit 或 walking 或 driving", "minutes": 分鐘數, "detail": "轉乘或注意事項", "cost": "費用估算"},
     {"time": "HH:MM", "type": "sight 或 food 或 stay 或 rest", "title": "名稱", "place": "Google 地圖搜尋用地名（當地語言）", "detail": "做什麼、為什麼這樣排", "duration": "停留時間", "cost": "費用估算", "tip": "針對這組旅伴的提醒，可省略"}
   ]}],
 "budget": {"currency": "TWD", "note": "例：三人合計估算", "items": [{"category": "機票／住宿／交通／餐飲／門票與體驗／保險與網路／預備金", "amount": 新台幣整數, "note": "計算依據"}]},
 "bookings": [{"when": "出發前多久", "what": "要預訂或辦理的事", "note": ""}],
 "checklist": [{"group": "分類", "items": ["物品"]}],
 "notes": [{"category": "入境／交通／文化禮儀／安全／天氣／健康／退稅等", "level": "critical 或 warn 或 info", "text": "具體說明"}],
 "emergency": [{"label": "名稱", "value": "電話或確認方式"}]
}
規則：每天 5–9 個 items，景點之間要有 move 項目並寫出分鐘數；第一天與最後一天考量航班；budget 金額為全體合計；notes 至少 5 則且第一則為入境或簽證；emergency 包含當地報警、救護與台灣外交部緊急聯絡中心 +886-800-085-095。`;

function buildPrompt(f) {
  const who = [f.adults && `成人 ${f.adults}`, f.seniors && `長輩（65 歲以上）${f.seniors}`, f.kids && `兒童 ${f.kids}${f.kidAges ? `（${f.kidAges} 歲）` : ""}`].filter(Boolean).join("、") || "未指定";
  return `${ROLE}

今天日期：${new Date().toISOString().slice(0,10)}

客戶需求：
- 目的地：${f.destination}
- 天數：${f.days} 天
- 出發日期：${f.startDate || "未指定（請依目的地最佳季節假設並寫入 assumptions）"}
- 出發城市：${f.from || "台北"}
- 旅伴：${who}
- 旅行型態：${f.style || "未指定"}
- 步調：${f.pace}
- 每人預算（新台幣，含機票）：${f.budget || "未指定"}
- 住宿等級：${f.stay}
- 交通偏好：${f.transport}
- 興趣：${f.interests.join("、") || "未指定"}
- 飲食限制：${f.diet || "無"}
- 體力與行動考量：${f.mobility || "無"}
- 其他需求：${f.notes || "無"}

${SCHEMA}`;
}

/* ---------- 提示詞面板：複製到 claude.ai，再把 JSON 貼回來 ---------- */
function showPrompt(text, title) {
  $("#promptTitle").textContent = title;
  $("#promptText").value = text;
  $("#promptPanel").hidden = false; $("#planner").hidden = true; $("#savedPanel").hidden = true;
  $("#importText").value = ""; $("#importStatus").textContent = "";
  $("#promptPanel").scrollIntoView({ block: "start" });
}
$("#btnCopyPrompt").addEventListener("click", async () => {
  const ta = $("#promptText");
  try { await navigator.clipboard.writeText(ta.value); toast("已複製提示詞，請貼到 claude.ai"); }
  catch { ta.focus(); ta.select(); toast("請按 Ctrl+C 複製已選取的提示詞"); }
});
$("#btnClosePrompt").addEventListener("click", () => { $("#promptPanel").hidden = true; });
$("#btnShowImport").addEventListener("click", () => showPrompt("", "匯入行程 JSON"));

$("#planForm").addEventListener("submit", e => {
  e.preventDefault();
  const f = readForm(), st = $("#planStatus");
  if (!f.destination || !f.days) { st.className = "status err"; st.textContent = "請填寫目的地與天數。"; return; }
  st.className = "status"; st.textContent = "";
  pendingRequest = f; pendingBase = null;
  showPrompt(buildPrompt(f), "規劃提示詞：" + f.destination + " " + f.days + " 天");
});

$("#btnRefine").addEventListener("click", () => {
  const ask = $("#refineText").value.trim(), st = $("#refineStatus");
  if (!ask) { st.className = "status err"; st.textContent = "請先輸入要調整的內容。"; return; }
  st.className = "status"; st.textContent = "";
  const current = { ...trip }; delete current.request; delete current.isSample;
  pendingBase = trip; pendingRequest = trip.request;
  showPrompt(`${ROLE}

以下是目前的旅遊手冊 JSON：
${JSON.stringify(current)}

客戶的調整需求：${ask}

請依需求修改，未提到的部分維持原樣並保持前後一致（時間、交通、預算與注意事項要跟著連動）。若需求造成風險（例如過度緊湊），在 assumptions 加一條說明。
${SCHEMA}`, "調整提示詞");
});

let pendingRequest = null, pendingBase = null;

/* 從 Claude 的回覆中取出 JSON：接受純 JSON、```json 區塊，或前後夾帶文字 */
function extractJson(text) {
  const t = String(text || "").trim();
  if (!t) throw new Error("沒有內容");
  const fence = t.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const body = fence ? fence[1] : t;
  const a = body.indexOf("{"), b = body.lastIndexOf("}");
  if (a < 0) throw new Error("找不到 JSON 物件");
  if (b <= a) throw new SyntaxError("JSON 不完整");
  return JSON.parse(body.slice(a, b + 1));
}
function importTrip(text) {
  const st = $("#importStatus");
  try {
    const t = normalize(extractJson(text));
    t.isSample = false;
    if (pendingBase && !pendingBase.isSample) t.id = pendingBase.id;
    if (pendingRequest) { t.request = pendingRequest; if (!t.people) t.people = (pendingRequest.adults + pendingRequest.seniors + pendingRequest.kids) || null; }
    render(t); saveTrip(t);
    pendingBase = null; pendingRequest = null;
    $("#promptPanel").hidden = true; $("#refineText").value = "";
    window.scrollTo({ top: 0 }); toast("手冊已匯入並儲存");
  } catch (err) {
    st.className = "status err";
    st.textContent = err instanceof SyntaxError
      ? "JSON 格式有誤，常見原因是回覆被截斷。請請 Claude「繼續」或重新產生，再貼一次完整內容。"
      : "無法匯入：" + err.message + "。請確認貼上的是 Claude 回覆中的整段 JSON。";
  }
}
$("#btnImport").addEventListener("click", () => importTrip($("#importText").value));
$("#importFile").addEventListener("change", e => {
  const file = e.target.files[0]; if (!file) return;
  const r = new FileReader(); r.onload = () => importTrip(r.result); r.readAsText(file, "utf-8");
  e.target.value = "";
});

/* ---------- 下載與列印 ---------- */
function download(filename, text, type) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement("a"); a.href = url; a.download = filename;
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
const fileBase = () => (trip.title || "roadbook").replace(/[\\/:*?"<>|]/g, "_");
$("#btnDownloadMd").addEventListener("click", () => download(fileBase() + ".md", toMarkdown(trip), "text/markdown;charset=utf-8"));
$("#btnDownloadJson").addEventListener("click", () => {
  const data = { ...trip }; delete data.isSample;
  download(fileBase() + ".json", JSON.stringify(data, null, 2), "application/json;charset=utf-8");
});
$("#btnPrint").addEventListener("click", () => window.print());

/* ---------- 啟動 ---------- */
$("#appVersion").textContent = "v" + window.RB_VERSION;
// 在 Claude Flow 的 /travel/ 底下執行時，顯示回 Claude Flow 首頁的連結；本機預覽時不顯示。
if (location.pathname.startsWith("/travel/")) $("#cfHome").hidden = false;
const curId = store.get("rb.current", "");
const cur = curId && store.get("rb.trips", []).find(x => x.id === curId);
try { render(normalize(cur ? cur.data : window.RB_SAMPLE)); } catch { render(normalize(window.RB_SAMPLE)); }
})();
