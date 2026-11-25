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
  out.flights = normalizeFlights(d.flights);
  out.hotels = normalizeHotels(d.hotels);
  out.tickets = normalizeTickets(d.tickets);
  out.transport = normalizeTransport(d.transport);
  out.dining = normalizeDining(d.dining);
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

  $("#book").innerHTML = pass + overview + flightsHtml(t) + hotelsHtml(t) + ticketsHtml(t) + transportHtml(t) + diningHtml(t) +
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

/* ---------- 儲存 ----------
 * 在 Claude Flow 的 /travel/ 底下執行時，登入檢查會提供 window.ClaudeFlowTravel（雲端行程，存在 Firestore），
 * 行程存到雲端，可用 #trip=<ID> 連結分享給其他登入的親友（唯讀）。
 * 本機預覽（start.bat）沒有這個介面，行程存在瀏覽器 localStorage。
 */
let cloud = null;
/** 目前顯示中的行程來源：sample 範例、local 本機、cloud 雲端；cloud 時另有 id、isOwner、ownerName */
let meta = { source: "sample" };
const TRIP_ID_RE = /^[A-Za-z0-9]{10,40}$/;
const shareUrl = id => location.origin + location.pathname + "#trip=" + id;
function setHash(id) {
  // replaceState 不會觸發 hashchange，避免存檔後又重新讀一次
  try { history.replaceState(null, "", id ? "#trip=" + id : location.pathname + location.search); } catch {}
}
function hashTripId() {
  const m = location.hash.match(/^#trip=([A-Za-z0-9]+)$/);
  return m && TRIP_ID_RE.test(m[1]) ? m[1] : null;
}

/** 顯示行程並更新來源資訊（分享列、唯讀時隱藏調整行程） */
function show(t, m) {
  if (!trip || t.id !== trip.id) flDraft = null; // 換了行程：清掉還沒加入比較表的去回程組合
  meta = m;
  render(t);
  const bar = $("#shareBar"), readOnly = m.source === "cloud" && !m.isOwner;
  $("#refine").hidden = readOnly;
  const refineLink = document.querySelector('.secnav a[href="#refine"]'); if (refineLink) refineLink.hidden = readOnly;
  if (m.source === "cloud" && m.isOwner) {
    bar.innerHTML = `<p><b>已存到雲端。</b>把連結傳給親友，他們登入 Claude Flow 後就能看（唯讀）。</p>
      <button class="btn primary" type="button" data-act="copy-link">複製分享連結</button>`;
  } else if (readOnly) {
    bar.innerHTML = `<p><b>${esc(m.ownerName || "其他使用者")} 分享的行程（唯讀）。</b>想修改的話，先存一份到你的行程。</p>
      <button class="btn primary" type="button" data-act="fork">存一份到我的行程</button>`;
  } else if (m.source === "local" && cloud) {
    bar.innerHTML = `<p><b>這份行程只存在這台電腦。</b>存到雲端後才能分享給親友。</p>
      <button class="btn primary" type="button" data-act="upload">存到雲端</button>`;
  } else bar.innerHTML = "";
  bar.hidden = !bar.innerHTML;
}

async function copyText(text, okMsg) {
  try { await navigator.clipboard.writeText(text); toast(okMsg); }
  catch {
    const ta = document.createElement("textarea"); ta.value = text; ta.style.cssText = "position:fixed;left:0;top:0;width:1px;height:1px;opacity:0";
    document.body.append(ta); ta.select(); let ok = false; try { ok = document.execCommand("copy"); } catch {} ta.remove();
    toast(ok ? okMsg : "無法自動複製，請手動複製網址列的連結");
  }
}
const tripData = t => { const d = { ...t }; delete d.isSample; return d; };
const cloudError = err => "雲端存取失敗：" + (err && err.message ? err.message : "請確認網路連線後再試一次");

/** 存檔。雲端模式：更新自己的行程或新增一份；本機模式：存 localStorage。回傳是否成功 */
async function saveTrip(t, { asNew = false, targetId } = {}) {
  if (t.isSample) return false;
  if (cloud) {
    try {
      const own = meta.source === "cloud" && meta.isOwner ? meta.id : null;
      const id = await cloud.saveTrip(asNew ? null : (targetId || own), tripData(t));
      t.id = id; setHash(id); store.set("rb.current", "cloud:" + id);
      show(t, { source: "cloud", id, isOwner: true, ownerName: cloud.user.name });
      return true;
    } catch (err) { toast(cloudError(err)); return false; }
  }
  const list = store.get("rb.trips", []).filter(x => x.id !== t.id);
  list.unshift({ id: t.id, title: t.title, savedAt: new Date().toISOString(), data: t });
  store.set("rb.trips", list.slice(0, 20)); store.set("rb.current", t.id);
  show(t, { source: "local" });
  return true;
}

async function openCloudTrip(id) {
  try {
    const rec = await cloud.getTrip(id);
    if (!rec) { toast("找不到這份行程，可能已被刪除"); return false; }
    const t = normalize(rec.data); t.id = rec.id; t.isSample = false;
    setHash(rec.id); if (rec.isOwner) store.set("rb.current", "cloud:" + rec.id);
    show(t, { source: "cloud", id: rec.id, isOwner: rec.isOwner, ownerName: rec.ownerName });
    window.scrollTo({ top: 0 });
    return true;
  } catch (err) { toast(cloudError(err)); return false; }
}
function openLocalTrip(id) {
  const x = store.get("rb.trips", []).find(x => x.id === id);
  if (!x) return false;
  setHash(null); store.set("rb.current", id);
  show(normalize(x.data), { source: "local" });
  return true;
}
function openSample() { setHash(null); store.set("rb.current", ""); show(normalize(window.RB_SAMPLE), { source: "sample" }); }

$("#shareBar").addEventListener("click", async e => {
  const act = e.target.closest("[data-act]")?.dataset.act; if (!act) return;
  if (act === "copy-link") return copyText(shareUrl(meta.id), "已複製分享連結");
  e.target.disabled = true;
  if (act === "fork" && await saveTrip({ ...trip }, { asNew: true })) toast("已存一份到你的行程，可以開始修改");
  if (act === "upload") {
    const localId = trip.id;
    if (await saveTrip({ ...trip }, { asNew: true })) {
      store.set("rb.trips", store.get("rb.trips", []).filter(x => x.id !== localId));
      toast("已存到雲端");
    }
  }
  e.target.disabled = false;
});

const rowHtml = (title, sub, buttons) => `<div class="row"><span><b>${esc(title)}</b> <span class="status mono">${esc(sub)}</span></span>
  <span class="row-actions">${buttons}</span></div>`;
async function showSaved() {
  const box = $("#savedList");
  $("#savedPanel").hidden = false; $("#planner").hidden = true; $("#promptPanel").hidden = true;
  $("#savedLead").textContent = cloud
    ? "雲端的行程登入 Claude Flow 後在任何裝置都看得到，也可以複製連結分享給親友。只存在這台電腦的行程，可以按「存到雲端」。"
    : "行程儲存在這個瀏覽器中，換裝置或清除網站資料後不會保留。需要長期保存請用「下載 JSON」，之後可以再匯入。";
  let html = "";
  if (cloud) {
    box.innerHTML = `<p class="status">讀取雲端行程中…</p>`;
    try {
      const mine = await cloud.listMyTrips();
      html += `<h3 class="saved-h">雲端行程</h3>` + (mine.length
        ? mine.map(x => rowHtml(x.title, (x.updatedAt || "").slice(0, 10),
            `<button class="btn" type="button" data-cloud="${esc(x.id)}">開啟</button><button class="btn" type="button" data-link="${esc(x.id)}">複製連結</button><button class="btn ghost" type="button" data-cdel="${esc(x.id)}">刪除</button>`)).join("")
        : `<p class="status">還沒有雲端行程。產生或匯入行程後會自動存到這裡。</p>`);
    } catch (err) { html += `<p class="status err">${esc(cloudError(err))}</p>`; }
  }
  const local = store.get("rb.trips", []);
  if (local.length || !cloud) {
    html += (cloud ? `<h3 class="saved-h">只存在這台電腦</h3>` : "") + (local.length
      ? local.map(x => rowHtml(x.title, x.savedAt.slice(0, 10),
          `<button class="btn" type="button" data-load="${esc(x.id)}">開啟</button>${cloud ? `<button class="btn" type="button" data-up="${esc(x.id)}">存到雲端</button>` : ""}<button class="btn ghost" type="button" data-del="${esc(x.id)}">刪除</button>`)).join("")
      : `<p class="status">還沒有儲存的行程。產生第一份手冊後會自動存在這裡。</p>`);
  }
  html += rowHtml("範例：京都・大阪 5 日", "", `<button class="btn" type="button" data-load="sample">開啟範例</button>`);
  box.innerHTML = html;
  $("#savedPanel").scrollIntoView({ block: "start" });
}
function confirmClick(btn) {
  if (btn.dataset.confirm === "1") return true;
  btn.dataset.confirm = "1"; btn.textContent = "確認刪除"; return false;
}
$("#btnSaved").addEventListener("click", () => $("#savedPanel").hidden ? showSaved() : ($("#savedPanel").hidden = true));
$("#savedList").addEventListener("click", async e => {
  const b = e.target.closest("button"); if (!b) return;
  const d = b.dataset;
  if (d.load) {
    if (d.load === "sample") openSample(); else openLocalTrip(d.load);
    $("#savedPanel").hidden = true; window.scrollTo({ top: 0 });
  } else if (d.cloud) {
    if (await openCloudTrip(d.cloud)) $("#savedPanel").hidden = true;
  } else if (d.link) {
    copyText(shareUrl(d.link), "已複製分享連結");
  } else if (d.up) {
    const x = store.get("rb.trips", []).find(x => x.id === d.up); if (!x) return;
    b.disabled = true;
    if (await saveTrip(normalize(x.data), { asNew: true })) {
      store.set("rb.trips", store.get("rb.trips", []).filter(y => y.id !== d.up));
      toast("已存到雲端"); showSaved();
    } else b.disabled = false;
  } else if (d.del) {
    if (!confirmClick(b)) return;
    store.set("rb.trips", store.get("rb.trips", []).filter(x => x.id !== d.del));
    if (meta.source === "local" && trip.id === d.del) openSample();
    showSaved();
  } else if (d.cdel) {
    if (!confirmClick(b)) return;
    b.disabled = true;
    try {
      await cloud.deleteTrip(d.cdel);
      if (meta.source === "cloud" && meta.id === d.cdel) openSample();
      toast("已刪除"); showSaved();
    } catch (err) { toast(cloudError(err)); b.disabled = false; }
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
let importMode = "trip";
function showPrompt(text, title, mode = "trip") {
  importMode = mode;
  $("label[for=importText]").textContent = { flights: "匯入 Claude 回覆的航班選項 JSON", airline: "匯入 Claude 回覆的當日航班 JSON（整段回覆貼上即可）", hotels: "匯入 Claude 回覆的飯店 JSON（整段回覆貼上即可）", tickets: "匯入 Claude 回覆的門票 JSON（整段回覆貼上即可）", transport: "匯入 Claude 回覆的交通票券 JSON（整段回覆貼上即可）", dining: "匯入 Claude 回覆的餐廳 JSON（整段回覆貼上即可）" }[mode] || "匯入 Claude 回覆的 JSON";
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
  pendingRequest = f; pendingBase = null; pendingMeta = null;
  showPrompt(buildPrompt(f), "規劃提示詞：" + f.destination + " " + f.days + " 天");
});

$("#btnRefine").addEventListener("click", () => {
  const ask = $("#refineText").value.trim(), st = $("#refineStatus");
  if (!ask) { st.className = "status err"; st.textContent = "請先輸入要調整的內容。"; return; }
  st.className = "status"; st.textContent = "";
  const current = { ...trip }; delete current.request; delete current.isSample;
  pendingBase = trip; pendingMeta = meta; pendingRequest = trip.request;
  showPrompt(`${ROLE}

以下是目前的旅遊手冊 JSON：
${JSON.stringify(current)}

客戶的調整需求：${ask}

請依需求修改，未提到的部分維持原樣並保持前後一致（時間、交通、預算與注意事項要跟著連動）。若需求造成風險（例如過度緊湊），在 assumptions 加一條說明。
${SCHEMA}`, "調整提示詞");
});

let pendingRequest = null, pendingBase = null, pendingMeta = null;

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
async function importTrip(text) {
  if (importMode === "flights") return importFlights(text);
  if (importMode === "airline") return importAirline(text);
  if (importMode === "hotels") return importHotels(text);
  if (importMode === "tickets") return importTickets(text);
  if (importMode === "transport") return importTransport(text);
  if (importMode === "dining") return importDining(text);
  const st = $("#importStatus");
  try {
    const t = normalize(extractJson(text));
    t.isSample = false;
    // 調整行程：沿用原本的行程（本機用同一個 ID；雲端在 saveTrip 依 meta 更新同一份）
    const refining = !!pendingBase && !pendingBase.isSample;
    if (refining) t.id = pendingBase.id;
    // Claude 的調整結果不一定帶回機票比較資料，沿用原本的
    if (refining && !t.flights.options.length && pendingBase.flights) t.flights = pendingBase.flights;
    if (refining && !t.hotels.searches.length && !t.hotels.picks.length && pendingBase.hotels) t.hotels = pendingBase.hotels;
    if (refining && !t.tickets.items.length && pendingBase.tickets) t.tickets = pendingBase.tickets;
    if (refining && !t.transport.passes.length && pendingBase.transport) t.transport = pendingBase.transport;
    if (refining && !t.dining.searches.length && !t.dining.picks.length && pendingBase.dining) t.dining = pendingBase.dining;
    const targetId = refining && pendingMeta && pendingMeta.source === "cloud" && pendingMeta.isOwner ? pendingMeta.id : undefined;
    if (pendingRequest) { t.request = pendingRequest; if (!t.people) t.people = (pendingRequest.adults + pendingRequest.seniors + pendingRequest.kids) || null; }
    pendingBase = null; pendingMeta = null; pendingRequest = null;
    $("#promptPanel").hidden = true; $("#refineText").value = "";
    const saved = await saveTrip(t, { asNew: !refining, targetId });
    if (!saved) show(t, { source: "local" }); // 雲端存檔失敗：先顯示，避免使用者以為匯入失敗
    window.scrollTo({ top: 0 }); if (saved) toast(cloud ? "手冊已匯入並存到雲端" : "手冊已匯入並儲存");
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

/* ---------- 機票：搜尋、比較、選擇航班 ----------
 * 網站不直接購票（需要付費的訂位 API）。這裡負責：帶入條件到 Google Flights／Skyscanner 搜尋、
 * 請 Claude 列出候選航班、自行新增與比較、選定後寫回行程（第一天與最後一天的航班、預算的機票）。
 * 訂位代號只存在這台電腦（localStorage），不會跟著行程分享出去。
 */
function normalizeFlights(f) {
  const arr = v => Array.isArray(v) ? v : [];
  const leg = l => ({
    flightNo: String(l?.flightNo || "").trim(), from: String(l?.from || "").trim().toUpperCase().slice(0, 4),
    to: String(l?.to || "").trim().toUpperCase().slice(0, 4), date: /^\d{4}-\d{2}-\d{2}$/.test(l?.date || "") ? l.date : "",
    depart: /^\d{1,2}:\d{2}$/.test(l?.depart || "") ? l.depart : "", arrive: /^\d{1,2}:\d{2}$/.test(l?.arrive || "") ? l.arrive : "",
    durationMin: Math.max(0, Math.round(+l?.durationMin || 0)) || null,
  });
  const options = arr(f?.options).map((o, i) => ({
    id: String(o?.id || `f-${Date.now().toString(36)}-${i}`),
    airline: String(o?.airline || "未命名航空").slice(0, 40),
    outbound: leg(o?.outbound), inbound: leg(o?.inbound),
    priceTotal: Math.max(0, Math.round(+o?.priceTotal || 0)) || null,
    pricePerPerson: Math.max(0, Math.round(+o?.pricePerPerson || 0)) || null,
    baggage: String(o?.baggage || "").slice(0, 80), note: String(o?.note || "").slice(0, 200),
    source: o?.source === "claude" ? "claude" : "manual",
  }));
  const chosenId = options.some(o => o.id === f?.chosenId) ? f.chosenId : null;
  return { options, chosenId, booked: !!(chosenId && f?.booked), lookup: normalizeLookup(f?.lookup) };
}

const passengers = t => t.people || parsePeople(t.travelers) || 1;
const optTotal = (t, o) => o.priceTotal || (o.pricePerPerson ? o.pricePerPerson * passengers(t) : null);
const optPer = (t, o) => o.pricePerPerson || (o.priceTotal ? Math.round(o.priceTotal / passengers(t)) : null);
const tripEnd = t => t.startDate ? addDays(t.startDate, t.days - 1) : "";
const fmtDur = m => m ? `${Math.floor(m / 60)} 小時${m % 60 ? ` ${m % 60} 分` : ""}` : "";
/** 單程航班的顯示文字；inline 時飛行時間接在同一行（已選航班卡片），否則換行（比較表） */
function legText(l, inline = false) {
  if (!l.flightNo && !l.depart) return "—";
  const route = l.from && l.to ? `${l.from}→${l.to} ` : "";
  const dur = l.durationMin ? (inline ? ` <small>（${esc(fmtDur(l.durationMin))}）</small>` : `<br><small>${esc(fmtDur(l.durationMin))}</small>`) : "";
  return `${l.flightNo ? `<b>${esc(l.flightNo)}</b> ` : ""}${esc(route)}<span class="mono nowrap">${esc(l.depart || "?")}–${esc(l.arrive || "?")}</span>${dur}`;
}
function flightEditable() { return meta.source === "local" || (meta.source === "cloud" && meta.isOwner); }

/** Google Flights、Skyscanner 搜尋連結（帶入出發地、目的地、日期與人數） */
function flightSearchLinks(t) {
  const from = t.origin.code, to = t.dest.code, out = t.startDate, back = tripEnd(t);
  if (!/^[A-Z]{3}$/.test(from) || !/^[A-Z]{3}$/.test(to)) return "";
  const q = `Flights from ${from} to ${to}${out ? ` on ${out}` : ""}${back ? ` returning ${back}` : ""}`;
  const g = "https://www.google.com/travel/flights?hl=zh-TW&curr=TWD&q=" + encodeURIComponent(q);
  const r = t.request || {};
  const adults = (r.adults || 0) + (r.seniors || 0) || passengers(t);
  const yymmdd = d => d.replace(/-/g, "").slice(2);
  const sky = "https://www.skyscanner.com.tw/transport/flights/" + from.toLowerCase() + "/" + to.toLowerCase() + "/" +
    (out ? yymmdd(out) + "/" + (back ? yymmdd(back) + "/" : "") : "") + `?adultsv2=${adults}` + (r.kids ? `&childrenv2=${Array(r.kids).fill(8).join("|")}` : "") + "&cabinclass=economy";
  return `<a class="btn" href="${g}" target="_blank" rel="noopener">在 Google Flights 搜尋</a>
    <a class="btn" href="${sky}" target="_blank" rel="noopener">在 Skyscanner 搜尋</a>`;
}

function flightsHtml(t) {
  const f = t.flights, edit = flightEditable();
  const chosen = f.options.find(o => o.id === f.chosenId);
  const pnr = edit && chosen ? store.get("rb.pnr." + t.id, "") : "";
  const route = `${esc(t.origin.city || t.origin.code)}（${esc(t.origin.code)}）→ ${esc(t.dest.city || t.dest.code)}（${esc(t.dest.code)}）`;
  const dates = t.startDate ? `${esc(fmtDate(t.startDate))} 去、${esc(fmtDate(tripEnd(t)))} 回` : "日期未定";

  const chosenCard = chosen ? `
    <div class="fl-chosen">
      <div><span class="eyebrow">已選航班</span>
        <p class="fl-chosen-title"><b>${esc(chosen.airline)}</b><br>去程 ${legText(chosen.outbound, true)}<br>回程 ${legText(chosen.inbound, true)}</p>
        <p class="status">${optTotal(t, chosen) ? `總價約 NT$ ${num(optTotal(t, chosen))}（${passengers(t)} 人）` : "票價未填"}${chosen.baggage ? `・${esc(chosen.baggage)}` : ""}
          ・<span class="fl-state ${f.booked ? "ok" : ""}">${f.booked ? "已訂位" : "尚未訂位"}</span></p>
      </div>
      ${edit ? `<div class="fl-chosen-actions">
        <button class="btn" type="button" data-fl="booked">${f.booked ? "改為尚未訂位" : "標示為已訂位"}</button>
        <button class="btn" type="button" data-fl="adjust">依這個航班調整行程</button>
      </div>
      ${f.booked ? `<div class="fl-pnr"><label for="flPnr">訂位代號（只存在這台電腦，不會分享出去）</label>
        <div class="fl-pnr-row"><input id="flPnr" maxlength="12" autocomplete="off" value="${esc(pnr)}" placeholder="例：ABC123"><button class="btn" type="button" data-fl="pnr">儲存</button></div></div>` : ""}` : ""}
    </div>` : "";

  const rows = f.options.map(o => `
    <tr class="${o.id === f.chosenId ? "fl-row-chosen" : ""}">
      <td><b>${esc(o.airline)}</b>${o.source === "claude" ? `<br><small class="fl-src">Claude 建議・請核對</small>` : ""}</td>
      <td>${legText(o.outbound)}</td><td>${legText(o.inbound)}</td>
      <td class="num">${optTotal(t, o) ? num(optTotal(t, o)) : "—"}</td><td class="num">${optPer(t, o) ? num(optPer(t, o)) : "—"}</td>
      <td>${esc(o.baggage || "—")}</td><td class="fl-note">${esc(o.note || "")}</td>
      ${edit ? `<td class="fl-acts">${o.id === f.chosenId ? `<span class="badge-chosen">已選</span>` : `<button class="btn primary" type="button" data-fl="choose" data-id="${esc(o.id)}">選這班</button>`}
        <button class="btn ghost" type="button" data-fl="edit" data-id="${esc(o.id)}">編輯</button>
        <button class="btn ghost" type="button" data-fl="del" data-id="${esc(o.id)}">刪除</button></td>` : (o.id === f.chosenId ? `<td><span class="badge-chosen">已選</span></td>` : "<td></td>")}
    </tr>`).join("");

  const table = f.options.length ? `<div class="tablebox"><table class="fl-table">
      <thead><tr><th>航空公司</th><th>去程</th><th>回程</th><th class="num">總價 NT$</th><th class="num">每人</th><th>行李</th><th>備註</th><th></th></tr></thead>
      <tbody>${rows}</tbody></table></div>`
    : `<p class="status">還沒有候選航班。${edit ? "可以請 Claude 列出選項，或自己新增。" : ""}</p>`;

  const tools = edit ? `<div class="actions fl-tools">
      <button class="btn primary" type="button" data-fl="prompt">請 Claude 列出航班選項</button>
      <button class="btn" type="button" data-fl="add">自己新增航班</button>
    </div>` : (meta.source === "sample" ? `<p class="status">範例行程不能修改。建立或匯入自己的行程後，就能比較與選擇航班。</p>` : "");

  return `
  <section class="block" id="flights">
    <h2>機票 <span class="eyebrow">Flights</span></h2>
    <div class="panel">
      <p class="fl-route">${route}・${dates}・${passengers(t)} 人</p>
      <div class="actions fl-search">${flightSearchLinks(t)}</div>
      <p class="status">網站不直接購票。比較後選定航班，再到航空公司官網或訂票網站購買；票價與班表以購買時為準。</p>
      ${chosenCard}
      ${lookupHtml(t, edit)}
      ${table}
      ${tools}
      <form class="fl-form" id="flForm" hidden novalidate></form>
    </div>
  </section>`;
}

/** 新增或編輯航班的表單 */
function openFlightForm(o) {
  const t = trip, out = o?.outbound || {}, inb = o?.inbound || {};
  const legFields = (k, l, label, defFrom, defTo, defDate) => `
    <fieldset class="fl-leg"><legend>${label}</legend>
      <div class="field"><label for="fe-${k}-no">航班號碼</label><input id="fe-${k}-no" value="${esc(l.flightNo || "")}" placeholder="例：JX800"></div>
      <div class="field"><label for="fe-${k}-from">出發</label><input id="fe-${k}-from" value="${esc(l.from || defFrom)}" maxlength="4"></div>
      <div class="field"><label for="fe-${k}-to">抵達</label><input id="fe-${k}-to" value="${esc(l.to || defTo)}" maxlength="4"></div>
      <div class="field"><label for="fe-${k}-date">日期</label><input id="fe-${k}-date" type="date" value="${esc(l.date || defDate)}"></div>
      <div class="field"><label for="fe-${k}-dep">起飛（當地）</label><input id="fe-${k}-dep" type="time" value="${esc(l.depart || "")}"></div>
      <div class="field"><label for="fe-${k}-arr">抵達（當地）</label><input id="fe-${k}-arr" type="time" value="${esc(l.arrive || "")}"></div>
      <div class="field"><label for="fe-${k}-dur">飛行分鐘</label><input id="fe-${k}-dur" type="number" min="0" value="${esc(l.durationMin || "")}"></div>
    </fieldset>`;
  const form = $("#flForm");
  form.dataset.id = o ? o.id : "";
  form.innerHTML = `
    <h3>${o ? "編輯航班" : "新增航班"}</h3>
    <div class="field"><label for="fe-airline">航空公司 *</label><input id="fe-airline" value="${esc(o?.airline || "")}" placeholder="例：星宇航空"></div>
    ${legFields("out", out, "去程", t.origin.code, t.dest.code, t.startDate)}
    ${legFields("in", inb, "回程", t.dest.code, t.origin.code, tripEnd(t))}
    <div class="grid">
      <div class="field"><label for="fe-total">總價（全部旅客，NT$）</label><input id="fe-total" type="number" min="0" step="100" value="${esc(o?.priceTotal || "")}"></div>
      <div class="field"><label for="fe-per">或每人價格（NT$）</label><input id="fe-per" type="number" min="0" step="100" value="${esc(o?.pricePerPerson || "")}"><small>只填每人時，總價以 ${passengers(t)} 人計算</small></div>
      <div class="field"><label for="fe-bag">行李</label><input id="fe-bag" value="${esc(o?.baggage || "")}" placeholder="例：託運 23 公斤"></div>
      <div class="field"><label for="fe-note">備註</label><input id="fe-note" value="${esc(o?.note || "")}" placeholder="例：含餐、需另購座位"></div>
    </div>
    <div class="actions"><button class="btn primary" type="submit">儲存航班</button><button class="btn ghost" type="button" data-fl="cancel">取消</button><span class="status" id="flFormStatus"></span></div>`;
  form.hidden = false;
  form.scrollIntoView({ block: "center" });
  $("#fe-airline").focus({ preventScroll: true });
}

async function persistFlights(msg) {
  if (await saveTrip(trip)) { if (msg) toast(msg); return true; }
  return false;
}

/** 把選定的航班寫回行程：第一天與最後一天的航班項目、預算的機票 */
function applyFlightToPlan(t, o) {
  const legItem = (l, dir) => ({
    time: l.depart || "", type: "move", flight: dir,
    title: `${l.from || "?"} → ${l.to || "?"}`,
    mode: `${o.airline}${l.flightNo ? " " + l.flightNo : ""}`,
    minutes: l.durationMin || undefined,
    detail: [l.arrive && `當地時間 ${l.arrive} 抵達`, o.baggage].filter(Boolean).join("；"),
  });
  const isFlight = it => it.flight || (it.type === "move" && /航空|航班|機場|空港|✈|\b[A-Z0-9]{2}\s?\d{2,4}\b/.test(`${it.title} ${it.mode || ""}`));
  const first = t.dayPlans[0], last = t.dayPlans[t.dayPlans.length - 1];
  if (first && (o.outbound.flightNo || o.outbound.depart)) {
    const i = first.items.findIndex(it => it.flight === "outbound");
    const j = i >= 0 ? i : (first.items[0] && isFlight(first.items[0]) ? 0 : -1);
    if (j >= 0) first.items[j] = legItem(o.outbound, "outbound"); else first.items.unshift(legItem(o.outbound, "outbound"));
  }
  if (last && last !== first && (o.inbound.flightNo || o.inbound.depart)) {
    const i = last.items.findIndex(it => it.flight === "inbound");
    const k = last.items.length - 1;
    const j = i >= 0 ? i : (last.items[k] && isFlight(last.items[k]) ? k : -1);
    if (j >= 0) last.items[j] = legItem(o.inbound, "inbound"); else last.items.push(legItem(o.inbound, "inbound"));
  }
  // 依時間重新排列當天項目（新加入的航班不一定在最前或最後）；沒有時間的項目跟著前一項
  const byTime = items => {
    let lastKey = "";
    return items.map((it, i) => {
      const m = /^(\d{1,2}):(\d{2})$/.exec(it.time || "");
      if (m) lastKey = m[1].padStart(2, "0") + m[2];
      return { it, key: lastKey, i };
    }).sort((a, b) => a.key.localeCompare(b.key) || a.i - b.i).map(x => x.it);
  };
  if (first) first.items = byTime(first.items);
  if (last && last !== first) last.items = byTime(last.items);
  const total = optTotal(t, o);
  if (total) {
    const note = `${o.airline} ${[o.outbound.flightNo, o.inbound.flightNo].filter(Boolean).join("／")}`.trim();
    const b = t.budget.items.find(x => /機票|航空|機位/.test(x.category));
    if (b) { b.amount = total; b.note = note; } else t.budget.items.unshift({ category: "機票", amount: total, note });
  }
}

function flightPrompt(t) {
  const r = t.request || {};
  return `${ROLE}

請列出這趟旅行可以考慮的來回航班選項，讓客戶比較後自行到航空公司或訂票網站購買。

- 出發：${t.origin.city || ""}（${t.origin.code}）
- 目的地：${t.dest.city || ""}（${t.dest.code}）
- 去程日期：${t.startDate || "未定"}；回程日期：${tripEnd(t) || "未定"}
- 旅客：${t.travelers || passengers(t) + " 人"}
- 旅行型態與步調：${[t.style, t.pace].filter(Boolean).join("、") || "未指定"}
- 每人總預算（含機票）：${t.budgetPerPerson || r.budget || "未指定"}

規則：
1. 列出 4–6 個選項，涵蓋傳統航空與廉價航空，可包含不同出發時段；直飛優先。
2. 航班號碼與起降時刻依你所知的常見班表填寫；不確定的寫在 note，提醒「班號與時刻請以航空公司官網為準」。不要編造不存在的航空公司或航線。
3. pricePerPerson 是該季節每位成人來回含稅的估算新台幣整數；廉價航空要在 baggage 說明託運行李是否另計。
4. 時間一律是當地時間（HH:MM）；durationMin 是飛行分鐘數。
5. note 用一句話寫出這個選項適合或不適合這組旅伴的原因（例如抵達時間對長輩、小孩的影響）。

直接在對話中回覆，不要建立 artifact 或檔案。只回覆一個 \`\`\`json 程式碼區塊，區塊外不要任何其他文字。格式：
{"options":[{"airline":"航空公司中文名稱","outbound":{"flightNo":"","from":"${t.origin.code}","to":"${t.dest.code}","date":"${t.startDate || ""}","depart":"HH:MM","arrive":"HH:MM","durationMin":0},"inbound":{"flightNo":"","from":"${t.dest.code}","to":"${t.origin.code}","date":"${tripEnd(t) || ""}","depart":"HH:MM","arrive":"HH:MM","durationMin":0},"pricePerPerson":0,"baggage":"","note":""}]}`;
}

/* ---------- 依航空公司查當日航班 ----------
 * 一次查一家：網站產生提示詞，使用者貼到 claude.ai（開啟網路搜尋），把回覆的 JSON 匯入。
 * 結果依航空公司存在 trip.flights.lookup，分成去程（出發日）與回程（回程日）兩欄；
 * 使用者點「設為去程」「設為回程」組成一組，加入比較表。時刻為網路上查到的參考值。
 */
const AIRLINES = ["中華航空", "長榮航空", "星宇航空", "台灣虎航", "立榮航空", "日本航空", "全日空", "樂桃航空", "捷星日本", "酷航",
  "國泰航空", "香港快運", "大韓航空", "韓亞航空", "濟州航空", "真航空", "德威航空", "釜山航空", "越南航空", "越捷航空",
  "泰國航空", "泰國獅航", "新加坡航空", "菲律賓航空", "宿霧太平洋航空", "馬來西亞航空", "亞洲航空", "達美航空", "聯合航空"];
const safeUrl = u => /^https?:\/\/[^\s"'<>]+$/i.test(String(u || "")) ? String(u) : "";
function normalizeLookup(lk) {
  const out = {};
  if (!lk || typeof lk !== "object") return out;
  const fl = (x, dir) => ({
    dir, flightNo: String(x?.flightNo || "").trim().toUpperCase().slice(0, 10),
    depart: /^\d{1,2}:\d{2}$/.test(x?.depart || "") ? x.depart : "", arrive: /^\d{1,2}:\d{2}$/.test(x?.arrive || "") ? x.arrive : "",
    durationMin: Math.max(0, Math.round(+x?.durationMin || 0)) || null,
    days: String(x?.days || "").slice(0, 30), note: String(x?.note || "").slice(0, 160), source: safeUrl(x?.source),
    fareTwd: (n => n > 0 && n <= 200000 ? n : null)(Math.round(+x?.fareTwd || 0)),
    fareNote: String(x?.fareNote || "").slice(0, 100), baggage: String(x?.baggage || "").slice(0, 60),
  });
  for (const [name, v] of Object.entries(lk).slice(0, 30)) {
    const key = String(name).trim().slice(0, 30); if (!key) continue;
    out[key] = {
      fetchedAt: String(v?.fetchedAt || "").slice(0, 10), note: String(v?.note || "").slice(0, 300),
      via: v?.via === "search" ? "search" : "", model: String(v?.model || "").slice(0, 40),
      sources: (Array.isArray(v?.sources) ? v.sources : []).slice(0, 15)
        .map(x => ({ title: String(x?.title || "").slice(0, 120), uri: safeUrl(x?.uri) })).filter(x => x.uri),
      outbound: (Array.isArray(v?.outbound) ? v.outbound : []).slice(0, 20).map(x => fl(x, "out")).filter(x => x.flightNo),
      inbound: (Array.isArray(v?.inbound) ? v.inbound : []).slice(0, 20).map(x => fl(x, "in")).filter(x => x.flightNo),
    };
  }
  return out;
}

/** 正在組合的一組來回（只在畫面上，不存檔） */
let flDraft = null;
const oneWayLink = (from, to, date) => "https://www.google.com/travel/flights?hl=zh-TW&curr=TWD&q=" +
  encodeURIComponent(`Flights from ${from} to ${to}${date ? " on " + date : ""} one way`);

/* ---------- Claude Code 查好的航線班表（js/flight-data.js） ---------- */
const WEEKDAY_NAMES = ["", "一", "二", "三", "四", "五", "六", "日"];
const isoWeekday = d => { const x = new Date(d + "T00:00:00").getDay(); return x === 0 ? 7 : x; };
function daysText(days) {
  if (!Array.isArray(days) || !days.length) return "";
  if (days.length === 7) return "每天";
  return "週" + days.slice().sort().map(n => WEEKDAY_NAMES[n] || "").join("、");
}
/** 依航線與日期挑出當天有飛的航班；日期未定時列出全部 */
function publishedFlights(from, to, date) {
  const r = window.RB_FLIGHT_DATA?.routes?.[`${from}-${to}`];
  if (!r || !Array.isArray(r.flights)) return null;
  const wd = date ? isoWeekday(date) : 0;
  const flights = r.flights.filter(f => !date || (
    (!Array.isArray(f.days) || !f.days.length || f.days.includes(wd)) &&
    (!f.validFrom || f.validFrom <= date) && (!f.validTo || date <= f.validTo)));
  return { route: r, flights };
}
/** 把查好的班表整理成與 trip.flights.lookup 相同的格式（依航空公司分組），標記 published */
function publishedLookup(t) {
  const out = publishedFlights(t.origin.code, t.dest.code, t.startDate);
  const back = publishedFlights(t.dest.code, t.origin.code, tripEnd(t));
  if (!out && !back) return {};
  const groups = {};
  const add = (res, dir) => (res?.flights || []).forEach(f => {
    const name = String(f.airline || "").trim() || "未命名航空";
    const g = groups[name] ||= { published: true, fetchedAt: "", note: "", outbound: [], inbound: [] };
    g.fetchedAt = [g.fetchedAt, res.route.checkedAt].filter(Boolean).sort().pop() || "";
    const leg = normalizeLookup({ x: { [dir === "out" ? "outbound" : "inbound"]: [{ ...f, days: daysText(f.days) }] } }).x;
    g[dir === "out" ? "outbound" : "inbound"].push(...(dir === "out" ? leg.outbound : leg.inbound));
  });
  add(out, "out"); add(back, "in");
  const notes = [out?.route.note, back?.route.note].filter(Boolean);
  for (const g of Object.values(groups)) {
    g.note = [...new Set(notes)].join("；");
    for (const k of ["outbound", "inbound"]) g[k].sort((a, b) => (a.depart || "").localeCompare(b.depart || ""));
  }
  return groups;
}
/** 畫面上的查詢結果：Claude Code 查好的班表＋使用者自己匯入的（同一家航空以自己匯入的為準） */
const mergedLookup = t => ({ ...publishedLookup(t), ...t.flights.lookup });

function lookupHtml(t, edit) {
  const lk = mergedLookup(t), names = Object.keys(lk);
  const hasPublished = names.some(n => lk[n].published);
  const out = t.startDate, back = tripEnd(t);
  const flightRow = (name, x) => {
    const route = x.dir === "out" ? [t.origin.code, t.dest.code, out] : [t.dest.code, t.origin.code, back];
    const picked = flDraft && flDraft[x.dir] && flDraft[x.dir].flightNo === x.flightNo && flDraft[x.dir].airline === name;
    return `<li class="lk-flight${picked ? " picked" : ""}">
      <div class="lk-main"><b>${esc(x.flightNo)}</b> <span class="mono nowrap">${esc(x.depart || "?")}–${esc(x.arrive || "?")}</span>
        ${x.durationMin ? `<small>${esc(fmtDur(x.durationMin))}</small>` : ""}${x.days ? `<small>・${esc(x.days)}</small>` : ""}
        ${x.fareTwd || x.baggage ? `<div class="lk-fare">${x.fareTwd ? `參考票價 <b class="mono">NT$ ${num(x.fareTwd)}</b>／人・單程` : `<span class="lk-wait">票價未查到</span>`}${x.baggage ? `・${esc(x.baggage)}` : ""}${x.fareNote ? `<small>（${esc(x.fareNote)}）</small>` : ""}</div>` : ""}
        ${x.note ? `<div class="lk-note">${esc(x.note)}</div>` : ""}
        <div class="lk-links">${x.source ? `<a href="${esc(x.source)}" target="_blank" rel="noopener">來源</a>` : `<span class="lk-nosrc">無來源</span>`}
          <a href="${oneWayLink(...route)}" target="_blank" rel="noopener">查當日票價</a></div></div>
      ${edit ? `<button class="btn ${picked ? "primary" : ""}" type="button" data-lk="pick" data-air="${esc(name)}" data-dir="${x.dir}" data-no="${esc(x.flightNo)}">${picked ? "已選" : x.dir === "out" ? "設為去程" : "設為回程"}</button>` : ""}
    </li>`;
  };
  const groups = names.map(name => {
    const v = lk[name];
    return `<div class="lk-airline">
      <div class="lk-head"><h4>${esc(name)}</h4>
        ${v.published ? `<span class="lk-pub">Claude Code 已查好</span><small>查詢日期 ${esc(v.fetchedAt || "—")}</small>`
          : `<small>查詢日期 ${esc(v.fetchedAt || "—")}</small>`}
        ${edit && !v.published ? `<button class="btn ghost" type="button" data-lk="requery" data-air="${esc(name)}">重新查詢</button><button class="btn ghost" type="button" data-lk="remove" data-air="${esc(name)}">移除</button>` : ""}</div>
      ${v.note ? `<p class="lk-note">${esc(v.note)}</p>` : ""}
      ${v.sources?.length ? `<details class="lk-sources"><summary>查詢時參考的網頁（${v.sources.length}）</summary><ul>${v.sources.map(x => `<li><a href="${esc(x.uri)}" target="_blank" rel="noopener">${esc(x.title || x.uri)}</a></li>`).join("")}</ul></details>` : ""}
      <div class="lk-cols">
        <div><h5>去程・${esc(fmtDate(out) || "出發日")} ${esc(t.origin.code)}→${esc(t.dest.code)}</h5>
          ${v.outbound.length ? `<ul class="lk-list">${v.outbound.map(x => flightRow(name, x)).join("")}</ul>` : `<p class="status">查不到直飛航班</p>`}</div>
        <div><h5>回程・${esc(fmtDate(back) || "回程日")} ${esc(t.dest.code)}→${esc(t.origin.code)}</h5>
          ${v.inbound.length ? `<ul class="lk-list">${v.inbound.map(x => flightRow(name, x)).join("")}</ul>` : `<p class="status">查不到直飛航班</p>`}</div>
      </div></div>`;
  }).join("");

  const legStr = (d, label) => d ? `${label} <b>${esc(d.airline)} ${esc(d.flightNo)}</b> <span class="mono">${esc(d.depart || "?")}–${esc(d.arrive || "?")}</span>${d.fareTwd ? ` <small class="mono">NT$ ${num(d.fareTwd)}</small>` : ""}` : `${label} <span class="lk-wait">尚未選擇</span>`;
  const draftBar = edit && flDraft && (flDraft.out || flDraft.in) ? `
    <div class="lk-draft" role="status">
      <span>${legStr(flDraft.out, "去程")}　${legStr(flDraft.in, "回程")}</span>
      <span class="lk-draft-acts"><button class="btn primary" type="button" data-lk="commit">加入比較表</button><button class="btn ghost" type="button" data-lk="clear">清除</button></span>
    </div>` : "";

  const picker = edit ? `
    <div class="lk-picker">
      <label for="lkAirline">航空公司</label>
      <input id="lkAirline" list="lkAirlines" placeholder="例：中華航空" autocomplete="off" value="${esc(lkInput)}">
      <datalist id="lkAirlines">${AIRLINES.map(a => `<option value="${esc(a)}"></option>`).join("")}</datalist>
      ${canSearch() ? `<button class="btn primary" type="button" data-lk="search"${lkBusy ? " disabled" : ""}>${lkBusy ? "查詢中…" : "查這家的當日航班"}</button>
        <button class="btn ghost" type="button" data-lk="query">改用 claude.ai 查詢</button>`
        : `<button class="btn primary" type="button" data-lk="query">查這家的當日航班</button>`}
    </div>
    ${lkBusy ? `<p class="status lk-busy" role="status">正在上網查詢${esc(lkBusy)}的航班，約需 15～50 秒，請稍候…</p>` : ""}
    <p class="status">${canSearch()
      ? "按「查這家的當日航班」，網站會直接上網查詢並列在下方，一次查一家，結果會累積。查詢失敗或額度用完時，可以改用 claude.ai 查詢。"
      : `${hasPublished ? "下方標示「Claude Code 已查好」的航班不需要再查。" : ""}按上方按鈕產生提示詞，貼到 claude.ai 並開啟「網路搜尋」，再把回覆貼回來。`}</p>` : "";

  if (!edit && !names.length) return "";
  return `<div class="lk-block">
    <h3>依航空公司查當日航班</h3>
    ${picker}${draftBar}${groups}
    ${names.length ? `<p class="status">時刻與票價是從航空公司、航班動態或旅遊網站查到的參考值：班表可能還沒正式公布，票價隨時變動。加入比較表時會自動填入參考票價與行李，購票前請按「查當日票價」確認。</p>` : ""}
  </div>`;
}

function airlinePrompt(t, airline) {
  return `請使用網路搜尋，查詢「${airline}」在以下兩個日期的直飛定期航班，讓我挑選要搭哪一班：

- 去程：${t.startDate || "（日期未定，請列出一般班表）"}，${t.origin.city || ""}（${t.origin.code}）→ ${t.dest.city || ""}（${t.dest.code}）
- 回程：${tripEnd(t) || "（日期未定，請列出一般班表）"}，${t.dest.city || ""}（${t.dest.code}）→ ${t.origin.city || ""}（${t.origin.code}）

規則：
1. 只列「${airline}」自己執飛的直飛班次；不要列其他航空公司執飛的共用班號，也不要列轉機航班。
2. 優先查航空公司官網時刻表、機場航班時刻表，其次是 Trip.com、FlightConnections、Airportia 等航班動態或航線頁面。
3. 若這兩天的正式班表還沒公布，用最接近日期的班表推估，並在 note 寫明依據哪一天或哪個航季的資料。
4. 每一班都附上 source：你實際查到這班資訊的網頁網址。查不到來源的班次不要列。
5. 時間一律是當地時間（HH:MM）；durationMin 是飛行分鐘數；days 寫每週飛哪幾天（例如「每天」「週一、三、五」），不確定就留空。
6. 查不到這家航空在此航線有直飛航班時，outbound、inbound 回傳空陣列，在 note 說明。不要編造班號或時刻。
7. fareTwd：每位成人單程經濟艙的參考票價（新台幣整數，含稅），以該日期或最接近日期在航空公司官網、促銷頁、旅遊網站上看到的價格為準；查不到填 0，不要估算。fareNote 寫明價格來源與票種。
8. baggage：經濟艙基本票種的託運行李額度（例如「託運 23 公斤 1 件」）；廉價航空若基本票價不含託運，寫「基本票價不含託運，需加購」並附加購參考價。

直接在對話中回覆，不要建立 artifact 或檔案。最後只回覆一個 \`\`\`json 程式碼區塊，格式：
{"airline":"${airline}","outbound":[{"flightNo":"","depart":"HH:MM","arrive":"HH:MM","durationMin":0,"days":"","fareTwd":0,"fareNote":"","baggage":"","note":"","source":"https://..."}],"inbound":[{"flightNo":"","depart":"HH:MM","arrive":"HH:MM","durationMin":0,"days":"","fareTwd":0,"fareNote":"","baggage":"","note":"","source":"https://..."}],"note":""}`;
}

/* ---------- 直接查詢（Claude Flow 後端：Gemini＋Google 搜尋） ---------- */
/** 正在查詢的航空公司名稱；空字串表示沒有查詢在進行 */
let lkBusy = "";
/** 航空公司欄位的內容：畫面重新產生（查詢中、查詢失敗）時保留使用者輸入的值 */
let lkInput = "";
document.addEventListener("input", e => { if (e.target.id === "lkAirline") lkInput = e.target.value; });
const canSearch = () => !!(cloud && typeof cloud.searchFlights === "function") && flightEditable();
async function directSearch(airline) {
  if (lkBusy) return;
  const t = trip;
  lkBusy = airline; show(t, meta);
  let r;
  try {
    r = await cloud.searchFlights({ airline, from: t.origin.code, to: t.dest.code, outDate: t.startDate || "", backDate: tripEnd(t) || "" });
  } catch { r = { available: false, reason: "查詢失敗，請稍後再試。" }; }
  lkBusy = "";
  if (trip !== t) return; // 查詢期間切換了行程，結果不套用
  if (!r || !r.available) { show(trip, meta); toast(r?.reason || "查詢失敗，請稍後再試。"); return; }
  const entry = normalizeLookup({ [airline]: { ...r, via: "search" } })[airline];
  trip.flights = { ...trip.flights, lookup: { ...trip.flights.lookup, [airline]: entry } };
  const n = entry.outbound.length + entry.inbound.length;
  if (await persistFlights(n ? `已查到${airline}的 ${n} 個航班` : `${airline}在這條航線查不到直飛航班`)) {
    document.querySelector(".lk-block")?.scrollIntoView({ block: "start" });
  }
}

let lookupAirline = "";
async function importAirline(text) {
  const st = $("#importStatus");
  try {
    const raw = String(text || "").trim();
    const fences = [...raw.matchAll(/```(?:json)?\s*([\s\S]*?)```/gi)];
    const body = (fences.length ? fences[fences.length - 1][1] : raw).trim();  // 網路搜尋的回覆前面常有說明，取最後一個區塊
    let data;
    try { data = JSON.parse(body); } catch { data = extractJson(body); }
    if (!data || (!Array.isArray(data.outbound) && !Array.isArray(data.inbound))) throw new Error("找不到 outbound／inbound 航班清單");
    const name = String(lookupAirline || data.airline || "").trim() || "未命名航空";
    const entry = normalizeLookup({ [name]: { ...data, fetchedAt: new Date().toISOString().slice(0, 10) } })[name];
    trip.flights = { ...trip.flights, lookup: { ...trip.flights.lookup, [name]: entry } };
    $("#promptPanel").hidden = true;
    const n = entry.outbound.length + entry.inbound.length;
    if (await persistFlights(n ? `已加入${name}的 ${n} 個航班` : `${name}在這條航線查不到直飛航班`)) document.querySelector(".lk-block")?.scrollIntoView({ block: "start" });
  } catch (err) {
    st.className = "status err";
    st.textContent = err instanceof SyntaxError
      ? "JSON 格式有誤，常見原因是回覆被截斷。請請 Claude「繼續」或重新產生，再貼一次完整內容。"
      : "無法匯入：" + err.message + "。請確認貼上的是 Claude 回覆中的 JSON。";
  }
}

/** 把組好的去回程加入比較表 */
function draftToOption(t, d) {
  const leg = (x, from, to, date) => x ? { flightNo: x.flightNo, from, to, date, depart: x.depart, arrive: x.arrive, durationMin: x.durationMin } : {};
  const names = [...new Set([d.out?.airline, d.in?.airline].filter(Boolean))];
  const legs = [["去程", d.out], ["回程", d.in]].filter(([, x]) => x);
  // 每人票價：選到的每一段都有參考票價才加總，否則留空，避免把單程價當成來回價
  const allFares = legs.every(([, x]) => x.fareTwd);
  const pricePerPerson = allFares ? legs.reduce((sum, [, x]) => sum + x.fareTwd, 0) : null;
  const fareText = legs.map(([label, x]) => `${label} ${x.flightNo} ${x.fareTwd ? "NT$ " + num(x.fareTwd) + (x.fareNote ? "（" + x.fareNote + "）" : "") : "票價未查到"}`).join("；");
  const bags = [...new Set(legs.map(([, x]) => x.baggage).filter(Boolean))];
  const baggage = bags.length <= 1 ? (bags[0] || "") : legs.filter(([, x]) => x.baggage).map(([label, x]) => `${label}：${x.baggage}`).join("；");
  const fetched = [...new Set(legs.map(([, x]) => x.fetchedAt).filter(Boolean))].join("、");
  const notes = legs.map(([, x]) => x.note).filter(Boolean).join("；");
  return normalizeFlights({ options: [{
    id: `f-${Date.now().toString(36)}`, airline: names.join("／"), source: "claude",
    outbound: leg(d.out, t.origin.code, t.dest.code, t.startDate), inbound: leg(d.in, t.dest.code, t.origin.code, tripEnd(t)),
    pricePerPerson, baggage,
    note: [
      `參考票價${fetched ? `（${fetched} 查詢）` : ""}：${fareText}`,
      allFares ? "總價以成人票價 × 人數估算，兒童票價不同，實際以購票時為準" : "未查到完整票價，請按「查當日票價」後用「編輯」填入",
      notes,
    ].filter(Boolean).join("；"),
  }] }).options[0];
}

$("#book").addEventListener("click", async e => {
  const b = e.target.closest("[data-lk]"); if (!b || !trip) return;
  const act = b.dataset.lk, name = b.dataset.air;
  if (act === "search" || (act === "requery" && canSearch())) {
    const airline = act === "search" ? ($("#lkAirline").value || "").trim() : name;
    if (!airline) { $("#lkAirline").focus(); toast("請先輸入或選擇航空公司"); return; }
    return directSearch(airline);
  }
  if (act === "query" || act === "requery") {
    const airline = act === "query" ? ($("#lkAirline").value || "").trim() : name;
    if (!airline) { $("#lkAirline").focus(); toast("請先輸入或選擇航空公司"); return; }
    lookupAirline = airline;
    return showPrompt(airlinePrompt(trip, airline), `查詢${airline}的當日航班`, "airline");
  }
  if (!flightEditable()) return;
  if (act === "pick") {
    const v = mergedLookup(trip)[name]; if (!v) return;
    const x = (b.dataset.dir === "out" ? v.outbound : v.inbound).find(f => f.flightNo === b.dataset.no); if (!x) return;
    flDraft = { ...(flDraft || {}), [b.dataset.dir]: { ...x, airline: name, fetchedAt: v.fetchedAt || "" } };
    show(trip, meta);
    document.querySelector(".lk-draft")?.scrollIntoView({ block: "nearest" });
    if (flDraft.out && flDraft.in) toast("去程、回程都選好了，按「加入比較表」");
    return;
  }
  if (act === "clear") { flDraft = null; return show(trip, meta); }
  if (act === "commit") {
    if (!flDraft) return;
    const opt = draftToOption(trip, flDraft);
    trip.flights = { ...trip.flights, options: [...trip.flights.options, opt] };
    flDraft = null;
    if (await persistFlights("已加入比較表，票價可按「編輯」填入")) document.querySelector(".fl-table")?.scrollIntoView({ block: "center" });
    return;
  }
  if (act === "remove") {
    if (b.dataset.confirm !== "1") { b.dataset.confirm = "1"; b.textContent = "確認移除"; return; }
    const lookup = { ...trip.flights.lookup }; delete lookup[name];
    if (flDraft) for (const k of ["out", "in"]) if (flDraft[k]?.airline === name) delete flDraft[k];
    trip.flights = { ...trip.flights, lookup };
    return persistFlights(`已移除${name}的查詢結果`);
  }
});

async function importFlights(text) {
  const st = $("#importStatus");
  try {
    const raw = String(text || "").trim();
    const fence = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
    const body = (fence ? fence[1] : raw).trim();
    let data;
    try { data = JSON.parse(body); } catch { data = extractJson(body); }
    const list = Array.isArray(data) ? data : data?.options;
    if (!Array.isArray(list) || !list.length) throw new Error("找不到 options 航班清單");
    const added = normalizeFlights({ options: list.map((o, i) => ({ ...o, id: `f-${Date.now().toString(36)}-${i}`, source: "claude" })) }).options;
    trip.flights = { ...trip.flights, options: [...trip.flights.options, ...added] };
    $("#promptPanel").hidden = true;
    if (await persistFlights(`已加入 ${added.length} 個航班選項`)) $("#flights").scrollIntoView({ block: "start" });
  } catch (err) {
    st.className = "status err";
    st.textContent = err instanceof SyntaxError
      ? "JSON 格式有誤，常見原因是回覆被截斷。請請 Claude「繼續」或重新產生，再貼一次完整內容。"
      : "無法匯入：" + err.message + "。請確認貼上的是 Claude 回覆中的整段 JSON。";
  }
}

$("#book").addEventListener("click", async e => {
  const b = e.target.closest("[data-fl]"); if (!b || !trip) return;
  const act = b.dataset.fl, f = trip.flights, id = b.dataset.id;
  if (act === "prompt") return showPrompt(flightPrompt(trip), "航班選項提示詞", "flights");
  if (act === "add") return openFlightForm(null);
  if (act === "edit") return openFlightForm(f.options.find(o => o.id === id));
  if (act === "cancel") { $("#flForm").hidden = true; return; }
  if (!flightEditable()) return;
  if (act === "del") {
    if (b.dataset.confirm !== "1") { b.dataset.confirm = "1"; b.textContent = "確認刪除"; return; }
    trip.flights = { ...f, options: f.options.filter(o => o.id !== id), ...(f.chosenId === id ? { chosenId: null, booked: false } : {}) };
    return persistFlights("已刪除航班");
  }
  if (act === "choose") {
    const o = f.options.find(o => o.id === id); if (!o) return;
    trip.flights = { ...f, chosenId: id, booked: false };
    applyFlightToPlan(trip, o);
    if (await persistFlights("已選定航班並更新行程與預算；時間有變動時，可按「依這個航班調整行程」")) $("#flights").scrollIntoView({ block: "start" });
    return;
  }
  if (act === "booked") { trip.flights = { ...f, booked: !f.booked }; return persistFlights(f.booked ? "已改為尚未訂位" : "已標示為已訂位"); }
  if (act === "pnr") {
    store.set("rb.pnr." + trip.id, ($("#flPnr").value || "").trim().toUpperCase());
    return toast("訂位代號已存在這台電腦");
  }
  if (act === "adjust") {
    const o = f.options.find(o => o.id === f.chosenId); if (!o) return;
    const leg = (l, name) => l.flightNo || l.depart ? `${name} ${l.flightNo || ""} ${l.date || ""} ${l.depart || "?"} 起飛、${l.arrive || "?"} 抵達` : "";
    $("#refineText").value = `改搭${o.airline}：${[leg(o.outbound, "去程"), leg(o.inbound, "回程")].filter(Boolean).join("；")}（當地時間）。請依新的抵達與起飛時間調整第一天與最後一天的行程，其他天維持不變。`;
    $("#refine").scrollIntoView({ block: "center" });
    toast("已填好調整需求，按「產生調整提示詞」即可");
  }
});
$("#book").addEventListener("submit", async e => {
  if (e.target.id !== "flForm") return;
  e.preventDefault();
  const v = id => ($("#" + id)?.value || "").trim();
  if (!v("fe-airline")) { $("#flFormStatus").className = "status err"; $("#flFormStatus").textContent = "請填寫航空公司。"; return; }
  const leg = k => ({ flightNo: v(`fe-${k}-no`), from: v(`fe-${k}-from`), to: v(`fe-${k}-to`), date: v(`fe-${k}-date`), depart: v(`fe-${k}-dep`), arrive: v(`fe-${k}-arr`), durationMin: v(`fe-${k}-dur`) });
  const id = e.target.dataset.id;
  const prev = trip.flights.options.find(o => o.id === id);
  const [opt] = normalizeFlights({ options: [{ id: id || `f-${Date.now().toString(36)}`, airline: v("fe-airline"), outbound: leg("out"), inbound: leg("in"),
    priceTotal: v("fe-total"), pricePerPerson: v("fe-per"), baggage: v("fe-bag"), note: v("fe-note"), source: prev?.source === "claude" ? "claude" : "manual" }] }).options;
  const options = id ? trip.flights.options.map(o => o.id === id ? opt : o) : [...trip.flights.options, opt];
  trip.flights = { ...trip.flights, options };
  // 編輯的是已選航班：同步更新行程與預算
  if (id && trip.flights.chosenId === id) applyFlightToPlan(trip, opt);
  if (await persistFlights(id ? "已更新航班" : "已新增航班")) $("#flights").scrollIntoView({ block: "start" });
});

/* ---------- 住宿：依地區或景點搜尋附近飯店、比較、選定 ----------
 * 與機票相同的做法：在 Claude Flow 底下由後端（Gemini＋Google 搜尋）直接查詢，
 * 也可以改用 claude.ai 提示詞。可以分段（例如京都 3 晚、大阪 1 晚），每段各自選定。
 * 選定後寫回每天的「今晚住宿」與預算的住宿金額。訂房確認碼只存在這台電腦。
 */
const HOTEL_LEVELS = ["經濟", "舒適", "精品", "奢華"];
/** 網路評比：每個網站一筆，滿分只接受 5、10、100；舊格式 rating＋ratingNote 自動轉換。與後端 hotels.js 相同規則 */
function normalizeRatings(x) {
  const list = Array.isArray(x?.ratings) ? x.ratings.slice() : [];
  if (!list.length && +x?.rating > 0) {
    const note = String(x?.ratingNote || "");
    const outOf = /5\s*分制|\/\s*5\b|5 分滿分/.test(note) || +x.rating <= 5 ? 5 : 10;
    list.push({ site: note.replace(/\s*\d+\s*分制.*$/, "").trim() || "網路評分", score: x.rating, outOf });
  }
  const seen = new Set(), out = [];
  for (const r of list) {
    const site = String(r?.site || "").trim().slice(0, 30), outOf = +r?.outOf, score = Math.round((+r?.score || 0) * 10) / 10;
    if (!site || ![5, 10, 100].includes(outOf) || !(score > 0 && score <= outOf) || seen.has(site.toLowerCase())) continue;
    seen.add(site.toLowerCase());
    const reviews = Math.round(+r?.reviews || 0);
    out.push({ site, score, outOf, reviews: reviews > 0 && reviews < 10000000 ? reviews : null });
    if (out.length >= 3) break;
  }
  return out;
}
/** 換算成 5 分制的平均分數（依評論數加權；沒有評論數的以 1 計），用於星星與排序 */
function avgStars(h) {
  if (!h.ratings?.length) return null;
  let sum = 0, w = 0;
  for (const r of h.ratings) { const wt = Math.max(1, Math.log10((r.reviews || 1) + 1)); sum += r.score / r.outOf * 5 * wt; w += wt; }
  return Math.round(sum / w * 10) / 10;
}
const starsHtml = v => `<span class="stars" style="--v:${Math.max(0, Math.min(5, v))}" role="img" aria-label="${v} 顆星（滿分 5）"><span aria-hidden="true">★★★★★</span></span>`;
const CLASS_NAMES = ["", "一", "二", "三", "四", "五"];

function normalizeHotel(x) {
  const name = String(x?.name || "").trim().slice(0, 80);
  if (!name) return null;
  const int = (v, max) => { const n = Math.round(+v || 0); return n > 0 && n <= max ? n : null; };
  const one = (v, max) => { const n = Math.round((+v || 0) * 10) / 10; return n > 0 && n <= max ? n : null; };
  return {
    name, nameLocal: String(x?.nameLocal || "").trim().slice(0, 100), area: String(x?.area || "").slice(0, 40),
    access: String(x?.access || "").slice(0, 80), walkMin: int(x?.walkMin, 120),
    pricePerNightTwd: int(x?.pricePerNightTwd, 500000), rooms: int(x?.rooms, 10) || 1, roomNote: String(x?.roomNote || "").slice(0, 60),
    starClass: int(x?.starClass, 5), ratings: normalizeRatings(x),
    highlights: String(x?.highlights || "").slice(0, 160), cautions: String(x?.cautions || "").slice(0, 160), source: safeUrl(x?.source),
  };
}
const nightsBetween = (a, b) => a && b ? Math.max(0, Math.round((Date.parse(b) - Date.parse(a)) / 86400000)) : 0;
function normalizeHotels(h) {
  const arr = v => Array.isArray(v) ? v : [];
  const D = v => /^\d{4}-\d{2}-\d{2}$/.test(v || "") ? v : "";
  const searches = arr(h?.searches).slice(0, 10).map((g, i) => ({
    id: String(g?.id || `hs-${Date.now().toString(36)}-${i}`), area: String(g?.area || "").slice(0, 60),
    checkIn: D(g?.checkIn), checkOut: D(g?.checkOut), fetchedAt: String(g?.fetchedAt || "").slice(0, 10),
    note: String(g?.note || "").slice(0, 300), via: g?.via === "search" ? "search" : "",
    sources: arr(g?.sources).slice(0, 15).map(x => ({ title: String(x?.title || "").slice(0, 120), uri: safeUrl(x?.uri) })).filter(x => x.uri),
    hotels: arr(g?.hotels).map(normalizeHotel).filter(Boolean).slice(0, 12),
  })).filter(g => g.area);
  const picks = arr(h?.picks).slice(0, 10).map((p, i) => {
    const hotel = normalizeHotel(p); if (!hotel) return null;
    const checkIn = D(p?.checkIn), checkOut = D(p?.checkOut), nights = nightsBetween(checkIn, checkOut) || Math.max(0, Math.round(+p?.nights || 0));
    return { ...hotel, id: String(p?.id || `hp-${Date.now().toString(36)}-${i}`), checkIn, checkOut, nights,
      priceTotal: Math.max(0, Math.round(+p?.priceTotal || 0)) || (hotel.pricePerNightTwd && nights ? hotel.pricePerNightTwd * nights : null),
      booked: !!p?.booked };
  }).filter(Boolean).sort((a, b) => (a.checkIn || "").localeCompare(b.checkIn || ""));
  return { searches, picks };
}

/** 每組搜尋結果的排序方式（只在畫面上，不存檔）：""＝推薦順序、rating、price */
const htSort = {};
function sortHotels(g) {
  const list = g.hotels.map((h, i) => ({ h, i }));
  const mode = htSort[g.id] || "";
  // 沒有評分或價格的排在最後
  if (mode === "rating") list.sort((a, b) => (avgStars(b.h) ?? -1) - (avgStars(a.h) ?? -1) || a.i - b.i);
  if (mode === "price") list.sort((a, b) => (a.h.pricePerNightTwd ?? Infinity) - (b.h.pricePerNightTwd ?? Infinity) || a.i - b.i);
  return list;
}

/** 搜尋表單的內容：畫面重新產生時保留 */
let htForm = null;
let htBusy = "";
const canSearchHotels = () => !!(cloud && typeof cloud.searchHotels === "function") && flightEditable();
function htDefaults(t) {
  const r = t.request || {};
  const lvl = HOTEL_LEVELS.find(l => String(r.stay || "").startsWith(l)) || "舒適";
  return { area: "", checkIn: t.startDate || "", checkOut: t.startDate ? addDays(t.startDate, Math.max(1, t.days - 1)) : "", level: lvl, budget: "", notes: "" };
}
document.addEventListener("input", e => {
  const m = /^ht-(area|in|out|level|budget|notes)$/.exec(e.target.id || ""); if (!m || !htForm) return;
  htForm[{ area: "area", in: "checkIn", out: "checkOut", level: "level", budget: "budget", notes: "notes" }[m[1]]] = e.target.value;
});
function partyOf(t) {
  const r = t.request || {};
  const adults = (r.adults || 0), seniors = (r.seniors || 0), kids = (r.kids || 0);
  if (adults + seniors + kids) return { adults, seniors, kids, kidAges: r.kidAges || "" };
  // 沒有原始表單（例如匯入的行程）：從旅伴文字解析，例如「成人 2、長輩 1（68 歲）」「成人 3、兒童 2」
  const txt = String(t.travelers || "");
  const count = re => +((txt.match(re) || [])[1] || 0);
  const parsed = { adults: count(/成人\s*(\d+)/), seniors: count(/長輩[^\d、，,]*?(\d+)/), kids: count(/(?:兒童|小孩)\s*(\d+)/) };
  const ages = ((txt.match(/(?:兒童|小孩)\s*\d+\s*[（(]([^）)]*)[）)]/) || [])[1] || "").replace(/歲/g, "").trim();
  return parsed.adults + parsed.seniors + parsed.kids ? { ...parsed, kidAges: ages } : { adults: passengers(t), seniors: 0, kids: 0, kidAges: "" };
}
function bookingLink(t, h, g) {
  const p = partyOf(t);
  const ages = (String(p.kidAges).match(/\d+/g) || []).slice(0, p.kids);
  while (ages.length < p.kids) ages.push("8");
  const q = new URLSearchParams({ ss: h.nameLocal || h.name, group_adults: String(Math.max(1, p.adults + p.seniors)), group_children: String(p.kids), no_rooms: String(h.rooms || 1) });
  if (g.checkIn) q.set("checkin", g.checkIn);
  if (g.checkOut) q.set("checkout", g.checkOut);
  return "https://www.booking.com/searchresults.zh-tw.html?" + q.toString() + ages.map(a => "&age=" + a).join("");
}
const dateRange = (a, b) => a && b ? `${fmtDate(a)}–${fmtDate(b)}・${nightsBetween(a, b)} 晚` : (a ? `${fmtDate(a)} 入住` : "日期未定");

function hotelsHtml(t) {
  const H = t.hotels, edit = flightEditable();
  if (!htForm || htForm.tripId !== t.id) htForm = { tripId: t.id, ...htDefaults(t) };
  const people = passengers(t);
  const totalNights = Math.max(0, t.days - 1);
  const areas = [...new Set(t.dayPlans.flatMap(p => [p.area, p.stay]).map(s => String(s || "").split(/[→（(]/)[0].trim()).filter(Boolean))].slice(0, 12);

  const picks = H.picks.length ? `
    <div class="ht-picks">
      <span class="eyebrow">已選住宿</span>
      ${H.picks.map(p => {
        const conf = edit && p.booked ? store.get(`rb.hotelconf.${t.id}.${p.id}`, "") : "";
        return `<div class="ht-pick">
          <div class="ht-pick-main"><b>${esc(p.name)}</b> <small>${esc(p.area)}</small>
            <div class="status">${esc(dateRange(p.checkIn, p.checkOut))}・${p.priceTotal ? `約 NT$ ${num(p.priceTotal)}` : "價格未查到"}${p.roomNote ? `・${esc(p.roomNote)}` : ""}・<span class="fl-state ${p.booked ? "ok" : ""}">${p.booked ? "已訂房" : "尚未訂房"}</span></div></div>
          ${edit ? `<div class="fl-chosen-actions">
            <button class="btn" type="button" data-ht="booked" data-id="${esc(p.id)}">${p.booked ? "改為尚未訂房" : "標示為已訂房"}</button>
            <button class="btn ghost" type="button" data-ht="unpick" data-id="${esc(p.id)}">取消選擇</button></div>
            ${p.booked ? `<div class="fl-pnr"><label for="htConf-${esc(p.id)}">訂房確認碼（只存在這台電腦，不會分享出去）</label>
              <div class="fl-pnr-row"><input id="htConf-${esc(p.id)}" maxlength="30" autocomplete="off" value="${esc(conf)}"><button class="btn" type="button" data-ht="conf" data-id="${esc(p.id)}">儲存</button></div></div>` : ""}` : ""}
        </div>`;
      }).join("")}
    </div>` : "";

  const f = htForm;
  const form = edit ? `
    <div class="ht-form">
      <div class="field ht-area"><label for="ht-area">地區或景點 *</label><input id="ht-area" list="htAreas" value="${esc(f.area)}" placeholder="例：京都站、難波、伏見稻荷">
        <datalist id="htAreas">${areas.map(a => `<option value="${esc(a)}"></option>`).join("")}</datalist></div>
      <div class="field"><label for="ht-in">入住</label><input id="ht-in" type="date" value="${esc(f.checkIn)}"></div>
      <div class="field"><label for="ht-out">退房</label><input id="ht-out" type="date" value="${esc(f.checkOut)}"></div>
      <div class="field"><label for="ht-level">等級</label><select id="ht-level">${HOTEL_LEVELS.map(l => `<option${l === f.level ? " selected" : ""}>${l}</option>`).join("")}</select></div>
      <div class="field"><label for="ht-budget">每晚預算（全體，NT$）</label><input id="ht-budget" type="number" min="0" step="500" value="${esc(f.budget)}" placeholder="不限"></div>
      <div class="field ht-notes"><label for="ht-notes">其他需求</label><input id="ht-notes" value="${esc(f.notes)}" placeholder="例：要有大浴場、可放嬰兒車"></div>
    </div>
    <div class="actions ht-tools">
      ${canSearchHotels()
        ? `<button class="btn primary" type="button" data-ht="search"${htBusy ? " disabled" : ""}>${htBusy ? "搜尋中…" : "搜尋附近飯店"}</button>
           <button class="btn ghost" type="button" data-ht="query">改用 claude.ai 查詢</button>`
        : `<button class="btn primary" type="button" data-ht="query">搜尋附近飯店</button>`}
    </div>
    ${htBusy ? `<p class="status lk-busy" role="status">正在上網搜尋${esc(htBusy)}附近的飯店，約需 15～50 秒，請稍候…</p>` : ""}
    <p class="status">${canSearchHotels() ? "網站會直接上網搜尋並列在下方；" : "會產生一段提示詞，請貼到 claude.ai 並開啟「網路搜尋」，再把回覆貼回來；"}住兩個地方時，分段搜尋並各選一間。</p>`
    : (meta.source === "sample" ? `<p class="status">範例行程不能修改。建立或匯入自己的行程後，就能搜尋與選擇飯店。</p>` : "");

  const pickedKey = (g, h) => H.picks.some(p => p.name === h.name && p.checkIn === g.checkIn && p.checkOut === g.checkOut);
  const groups = H.searches.map(g => {
    const n = nightsBetween(g.checkIn, g.checkOut);
    return `<div class="lk-airline ht-group">
      <div class="lk-head"><h4>${esc(g.area)}附近</h4><small>${esc(dateRange(g.checkIn, g.checkOut))}・查詢日期 ${esc(g.fetchedAt || "—")}</small>
        ${edit ? `<button class="btn ghost" type="button" data-ht="requery" data-gid="${esc(g.id)}">重新搜尋</button><button class="btn ghost" type="button" data-ht="remove" data-gid="${esc(g.id)}">移除</button>` : ""}</div>
      ${g.note ? `<p class="lk-note">${esc(g.note)}</p>` : ""}
      ${g.sources.length ? `<details class="lk-sources"><summary>搜尋時參考的網頁（${g.sources.length}）</summary><ul>${g.sources.map(x => `<li><a href="${esc(x.uri)}" target="_blank" rel="noopener">${esc(x.title || x.uri)}</a></li>`).join("")}</ul></details>` : ""}
      ${g.hotels.length > 1 ? `<div class="ht-sort" role="group" aria-label="排序">排序：${[["", "推薦順序"], ["rating", "評分高到低"], ["price", "價格低到高"]].map(([k, label]) =>
          `<button class="chip" type="button" data-ht="sort" data-gid="${esc(g.id)}" data-sort="${k}" aria-pressed="${(htSort[g.id] || "") === k}">${label}</button>`).join("")}</div>` : ""}
      ${g.hotels.length ? `<ul class="ht-list">${sortHotels(g).map(({ h, i }) => {
        const picked = pickedKey(g, h);
        return `<li class="ht-card${picked ? " picked" : ""}">
          <div class="ht-main">
            <div class="ht-name"><b>${esc(h.name)}</b>${h.nameLocal && h.nameLocal !== h.name ? ` <small>${esc(h.nameLocal)}</small>` : ""}</div>
            <div class="ht-meta">${[h.area, h.access, h.walkMin ? `步行約 ${h.walkMin} 分` : ""].filter(Boolean).map(esc).join("・")}</div>
            <div class="ht-price">${h.pricePerNightTwd ? `每晚約 <b class="mono">NT$ ${num(h.pricePerNightTwd)}</b>（全體${h.rooms > 1 ? `・${h.rooms} 間` : ""}）${n ? `・${n} 晚約 NT$ ${num(h.pricePerNightTwd * n)}` : ""}` : `<span class="lk-wait">價格未查到</span>`}
              ${h.roomNote ? `<small>・${esc(h.roomNote)}</small>` : ""}</div>
            ${`<div class="ht-rating">
              ${h.ratings.length ? `${starsHtml(avgStars(h))}<b class="mono">${avgStars(h)}</b>
                <small>${h.ratings.map(r => `${esc(r.site)} ${r.score}／${r.outOf}${r.reviews ? `（${num(r.reviews)} 則）` : ""}`).join("・")}</small>` : `<small class="lk-wait">沒有查到網路評分</small>`}
              ${h.starClass ? `<span class="ht-class">${CLASS_NAMES[h.starClass]}星級飯店</span>` : ""}</div>`}
            ${h.highlights ? `<div class="ht-good">${esc(h.highlights)}</div>` : ""}
            ${h.cautions ? `<div class="ht-warn">注意：${esc(h.cautions)}</div>` : ""}
            <div class="lk-links">${h.source ? `<a href="${esc(h.source)}" target="_blank" rel="noopener">來源</a>` : `<span class="lk-nosrc">無來源</span>`}
              <a href="${gmap(h.nameLocal || h.name)}" target="_blank" rel="noopener">地圖</a>
              <a href="${bookingLink(t, h, g)}" target="_blank" rel="noopener">在 Booking.com 查房價</a></div>
          </div>
          ${edit ? `<button class="btn ${picked ? "primary" : ""}" type="button" data-ht="choose" data-gid="${esc(g.id)}" data-i="${i}"${picked ? " disabled" : ""}>${picked ? "已選" : "選這間"}</button>` : (picked ? `<span class="badge-chosen">已選</span>` : "")}
        </li>`;
      }).join("")}</ul>` : `<p class="status">沒有找到符合的飯店。</p>`}
    </div>`;
  }).join("");

  return `
  <section class="block" id="hotels">
    <h2>住宿 <span class="eyebrow">Hotels</span></h2>
    <div class="panel">
      <p class="fl-route">${esc(t.dest.city || t.dest.code)}・${totalNights} 晚・${people} 人</p>
      ${picks}${form}${groups}
      ${H.searches.length ? `<p class="status">房價與評分是從訂房網站、官網查到的參考值，房價隨日期與空房變動；選這間後會自動填入每天的住宿與預算，訂房前請按「在 Booking.com 查房價」確認。</p>` : ""}
    </div>
  </section>`;
}

async function persistTrip(msg) {
  if (await saveTrip(trip)) { if (msg) toast(msg); return true; }
  return false;
}

/** 把已選的住宿寫回行程：每天的「今晚住宿」與預算的住宿金額 */
function applyHotelsToPlan(t) {
  const picks = t.hotels.picks;
  for (const p of t.dayPlans) {
    if (!p.date) continue;
    const pick = picks.find(x => x.checkIn && x.checkOut && x.checkIn <= p.date && p.date < x.checkOut);
    if (pick) p.stay = `${pick.name}${pick.area ? `（${pick.area}）` : ""}`;
  }
  const priced = picks.filter(x => x.priceTotal);
  if (!priced.length) return;
  const total = priced.reduce((s, x) => s + x.priceTotal, 0);
  const missing = picks.length - priced.length;
  const note = picks.map(x => `${x.name} ${x.nights || "?"} 晚`).join("、") + (missing ? `；另有 ${missing} 間未查到價格` : "");
  const b = t.budget.items.find(x => /住宿|飯店|旅館/.test(x.category));
  if (b) { b.amount = total; b.note = note; } else t.budget.items.unshift({ category: "住宿", amount: total, note });
}

function hotelPrompt(t, f) {
  const p = partyOf(t);
  const who = [p.adults && `成人 ${p.adults}`, p.seniors && `長輩（65 歲以上）${p.seniors}`, p.kids && `兒童 ${p.kids}${p.kidAges ? `（${p.kidAges} 歲）` : ""}`].filter(Boolean).join("、");
  const n = nightsBetween(f.checkIn, f.checkOut);
  return `請使用網路搜尋，查詢「${t.dest.city || ""} ${f.area}」附近適合的飯店，列出 6～10 間讓我比較。

- 入住：${f.checkIn || "未定"}；退房：${f.checkOut || "未定"}${n ? `（${n} 晚）` : ""}
- 旅客：${who}
- 住宿等級：${f.level || "不限"}
- 每晚預算（全體，新台幣）：${f.budget || "不限"}
- 其他需求：${f.notes || "無"}

規則：
1. 以「${f.area}」為中心，步行或搭車 20 分鐘內為主；walkMin 是步行到該地點或最近車站的分鐘數，access 寫最近的車站與步行時間。
2. 涵蓋不同價位；有長輩或兒童時，優先列出有家庭房、電梯、離車站近的飯店。
3. pricePerNightTwd 是這組旅伴「全體每晚」的參考價（新台幣整數，含稅），以這個日期或最接近日期在訂房網站、官網看到的價格為準；查不到填 0，不要估算。rooms 是需要幾間房，roomNote 寫房型。
4. ratings 列出網路評比，每個網站一筆（優先 Google、Booking.com、Agoda、TripAdvisor，最多 3 個）：site 網站名稱、score 原始分數、outOf 滿分（5 或 10）、reviews 評論數（查不到填 0）；只填實際查到的。starClass 是官方星級，沒有或查不到填 0。
5. highlights 寫 1～2 句優點；cautions 寫需要注意的地方，沒有就留空。nameLocal 寫當地語言或英文正式名稱。
6. 每間都附上實際查到資料的網頁網址（source）。不要編造飯店、價格或評分。

直接在對話中回覆，不要建立 artifact 或檔案。最後只回覆一個 \`\`\`json 程式碼區塊，格式：
{"hotels":[{"name":"","nameLocal":"","area":"","access":"","walkMin":0,"pricePerNightTwd":0,"rooms":1,"roomNote":"","starClass":0,"ratings":[{"site":"Google","score":0,"outOf":5,"reviews":0}],"highlights":"","cautions":"","source":"https://..."}],"note":""}`;
}

/** 新增或取代一組搜尋結果（同地點、同日期視為同一組） */
function addHotelSearch(group) {
  const others = trip.hotels.searches.filter(g => !(g.id === group.id || (g.area === group.area && g.checkIn === group.checkIn && g.checkOut === group.checkOut)));
  const [norm] = normalizeHotels({ searches: [group] }).searches;
  trip.hotels = { ...trip.hotels, searches: [norm, ...others].slice(0, 10) };
  return norm;
}

let htPending = null; // 用 claude.ai 查詢時，記下這次的地點與日期
async function importHotels(text) {
  const st = $("#importStatus");
  try {
    const raw = String(text || "").trim();
    const fences = [...raw.matchAll(/```(?:json)?\s*([\s\S]*?)```/gi)];
    const body = (fences.length ? fences[fences.length - 1][1] : raw).trim();
    let data;
    try { data = JSON.parse(body); } catch { data = extractJson(body); }
    const list = Array.isArray(data) ? data : data?.hotels;
    if (!Array.isArray(list)) throw new Error("找不到 hotels 飯店清單");
    const f = htPending || { area: "未指定地點", checkIn: "", checkOut: "" };
    const g = addHotelSearch({ id: f.id, area: f.area, checkIn: f.checkIn, checkOut: f.checkOut, hotels: list, note: data?.note || "", fetchedAt: new Date().toISOString().slice(0, 10) });
    htPending = null;
    $("#promptPanel").hidden = true;
    if (await persistTrip(g.hotels.length ? `已加入${g.area}附近的 ${g.hotels.length} 間飯店` : "沒有找到符合的飯店")) $("#hotels").scrollIntoView({ block: "start" });
  } catch (err) {
    st.className = "status err";
    st.textContent = err instanceof SyntaxError
      ? "JSON 格式有誤，常見原因是回覆被截斷。請請 Claude「繼續」或重新產生，再貼一次完整內容。"
      : "無法匯入：" + err.message + "。請確認貼上的是 Claude 回覆中的 JSON。";
  }
}

async function directHotelSearch(f, gid) {
  if (htBusy) return;
  const t = trip, p = partyOf(t);
  htBusy = f.area; show(t, meta);
  let r;
  try {
    r = await cloud.searchHotels({ area: f.area, city: t.dest.city || "", checkIn: f.checkIn || "", checkOut: f.checkOut || "",
      ...p, level: f.level || "", budgetPerNight: +f.budget || 0, notes: f.notes || "" });
  } catch { r = { available: false, reason: "搜尋失敗，請稍後再試。" }; }
  htBusy = "";
  if (trip !== t) return;
  if (!r || !r.available) { show(trip, meta); toast(r?.reason || "搜尋失敗，請稍後再試。"); return; }
  const g = addHotelSearch({ id: gid, area: f.area, checkIn: f.checkIn, checkOut: f.checkOut, hotels: r.hotels, note: r.note, sources: r.sources, via: "search", fetchedAt: r.fetchedAt });
  if (await persistTrip(g.hotels.length ? `已找到${g.area}附近的 ${g.hotels.length} 間飯店` : "沒有找到符合的飯店")) document.querySelector(".ht-group")?.scrollIntoView({ block: "start" });
}

$("#book").addEventListener("click", async e => {
  const b = e.target.closest("[data-ht]"); if (!b || !trip) return;
  const act = b.dataset.ht, H = trip.hotels;
  const formValues = () => ({ ...htForm, area: (htForm.area || "").trim() });
  if (act === "search" || act === "query") {
    const f = formValues();
    if (!f.area) { $("#ht-area")?.focus(); toast("請先輸入地區或景點"); return; }
    if (f.checkIn && f.checkOut && f.checkOut <= f.checkIn) { toast("退房日期必須晚於入住日期"); return; }
    if (act === "search") return directHotelSearch(f);
    htPending = f;
    return showPrompt(hotelPrompt(trip, f), `搜尋${f.area}附近的飯店`, "hotels");
  }
  if (act === "sort") { htSort[b.dataset.gid] = b.dataset.sort; return show(trip, meta); }
  if (act === "requery") {
    const g = H.searches.find(x => x.id === b.dataset.gid); if (!g) return;
    const f = { ...htForm, area: g.area, checkIn: g.checkIn, checkOut: g.checkOut, id: g.id };
    if (canSearchHotels()) return directHotelSearch(f, g.id);
    htPending = f;
    return showPrompt(hotelPrompt(trip, f), `搜尋${g.area}附近的飯店`, "hotels");
  }
  if (!flightEditable()) return;
  if (act === "remove") {
    if (b.dataset.confirm !== "1") { b.dataset.confirm = "1"; b.textContent = "確認移除"; return; }
    trip.hotels = { ...H, searches: H.searches.filter(x => x.id !== b.dataset.gid) };
    return persistTrip("已移除這組搜尋結果");
  }
  if (act === "choose") {
    const g = H.searches.find(x => x.id === b.dataset.gid); const h = g?.hotels[+b.dataset.i]; if (!h) return;
    const nights = nightsBetween(g.checkIn, g.checkOut);
    const pick = { ...h, id: `hp-${Date.now().toString(36)}`, checkIn: g.checkIn, checkOut: g.checkOut, nights,
      priceTotal: h.pricePerNightTwd && nights ? h.pricePerNightTwd * nights : null, booked: false };
    // 與新選擇日期重疊的住宿換成這一間；沒有日期時同一地點的換掉
    const overlap = x => g.checkIn && g.checkOut && x.checkIn && x.checkOut ? x.checkIn < g.checkOut && g.checkIn < x.checkOut : x.area === h.area;
    trip.hotels = normalizeHotels({ ...H, picks: [...H.picks.filter(x => !overlap(x)), pick] });
    applyHotelsToPlan(trip);
    if (await persistTrip("已選定住宿，每天的住宿與預算已更新")) $("#hotels").scrollIntoView({ block: "start" });
    return;
  }
  if (act === "unpick") {
    trip.hotels = { ...H, picks: H.picks.filter(x => x.id !== b.dataset.id) };
    applyHotelsToPlan(trip);
    return persistTrip("已取消選擇");
  }
  if (act === "booked") {
    trip.hotels = { ...H, picks: H.picks.map(x => x.id === b.dataset.id ? { ...x, booked: !x.booked } : x) };
    return persistTrip(H.picks.find(x => x.id === b.dataset.id)?.booked ? "已改為尚未訂房" : "已標示為已訂房");
  }
  if (act === "conf") {
    store.set(`rb.hotelconf.${trip.id}.${b.dataset.id}`, ($(`#htConf-${b.dataset.id}`)?.value || "").trim());
    return toast("訂房確認碼已存在這台電腦");
  }
});

/* ---------- 門票：查詢行程中景點的門票、加入計畫、記錄購票 ----------
 * 與機票、住宿相同的做法：在 Claude Flow 底下由後端（Gemini＋Google 搜尋）直接查詢，也可以改用 claude.ai。
 * 加入計畫的門票會加總到預算的「門票與體驗」；需要預約的自動排進「預訂時程」。網站不代售門票。
 */
const TICKET_STATUS = {
  required: { label: "必須預約", cls: "crit", rank: 0 },
  recommended: { label: "建議預約", cls: "warn", rank: 1 },
  onsite: { label: "現場購票", cls: "info", rank: 2 },
  free: { label: "免費", cls: "ok", rank: 3 },
};
const TICKET_MAX = 8;
function normalizeTicket(x) {
  const name = String(x?.name || "").trim().slice(0, 60);
  if (!name) return null;
  const S = (v, m) => String(v || "").slice(0, m);
  const status = TICKET_STATUS[x?.status] ? x.status : "onsite";
  const types = (Array.isArray(x?.ticketTypes) ? x.ticketTypes : []).map(t => {
    const price = Math.round((+t?.price || 0) * 100) / 100, currency = String(t?.currency || "").trim().toUpperCase(), label = S(t?.label, 20).trim();
    return label && price >= 0 && price < 1e7 && /^[A-Z]{3}$/.test(currency) ? { label, price, currency } : null;
  }).filter(Boolean).slice(0, 6);
  const total = Math.round(+x?.partyTotalTwd || 0);
  return {
    name, nameLocal: S(x?.nameLocal, 80).trim(), status, date: /^\d{4}-\d{2}-\d{2}$/.test(x?.date || "") ? x.date : "", place: S(x?.place, 80),
    ticketTypes: status === "free" ? [] : types, partyTotalTwd: status !== "free" && total > 0 && total <= 1e6 ? total : null, fxNote: S(x?.fxNote, 40),
    openingHours: S(x?.openingHours, 80), closedDays: S(x?.closedDays, 60), timeSlot: x?.timeSlot === true, bookingWindow: S(x?.bookingWindow, 80),
    channels: (Array.isArray(x?.channels) ? x.channels : []).map(c => ({ name: S(c?.name, 20).trim(), url: safeUrl(c?.url) })).filter(c => c.name && c.url).slice(0, 3),
    tips: S(x?.tips, 160), cautions: S(x?.cautions, 160), source: safeUrl(x?.source), fetchedAt: S(x?.fetchedAt, 10),
    include: !!x?.include, booked: !!(x?.include && x?.booked),
  };
}
function normalizeTickets(tk) {
  const seen = new Set();
  const items = (Array.isArray(tk?.items) ? tk.items : []).map(normalizeTicket).filter(x => x && !seen.has(x.name) && seen.add(x.name)).slice(0, 30);
  return { items, note: String(tk?.note || "").slice(0, 300),
    sources: (Array.isArray(tk?.sources) ? tk.sources : []).slice(0, 15).map(x => ({ title: String(x?.title || "").slice(0, 120), uri: safeUrl(x?.uri) })).filter(x => x.uri) };
}

/** 行程中的景點（依日期），供勾選查詢 */
function tripSights(t) {
  const seen = new Set(), out = [];
  t.dayPlans.forEach(p => p.items.forEach(it => {
    if (it.type !== "sight") return;
    const name = String(it.title || "").replace(/^(午餐|晚餐|早餐)[:：]/, "").trim();
    if (!name || seen.has(name)) return;
    seen.add(name);
    out.push({ name, date: p.date || "", day: p.day, place: it.place || "" });
  }));
  return out;
}
let tkChecked = null, tkExtra = "", tkBusy = false;
const canSearchTickets = () => !!(cloud && typeof cloud.searchTickets === "function") && flightEditable();
document.addEventListener("change", e => {
  if (e.target.matches?.("[data-tk-sight]") && tkChecked) { const n = e.target.dataset.tkSight; e.target.checked ? tkChecked.add(n) : tkChecked.delete(n); updateTicketCount(); }
});
document.addEventListener("input", e => { if (e.target.id === "tk-extra") { tkExtra = e.target.value; updateTicketCount(); } });
function ticketQueryList(t) {
  const sights = tripSights(t);
  const picked = sights.filter(s => tkChecked.has(s.name));
  const extra = tkExtra.split(/[,，、\n]/).map(s => s.trim()).filter(Boolean).map(name => ({ name, date: "", place: "" }));
  const names = new Set();
  return [...picked, ...extra].filter(x => !names.has(x.name) && names.add(x.name));
}
function updateTicketCount() {
  const n = trip ? ticketQueryList(trip).length : 0;
  const el = $("#tkCount"); if (el) { el.textContent = n > TICKET_MAX ? `已選 ${n} 個，一次最多 ${TICKET_MAX} 個` : `已選 ${n} 個`; el.className = n > TICKET_MAX ? "status err" : "status"; }
}
const dayLabel = (t, date) => { const p = t.dayPlans.find(x => x.date === date); return p ? `Day ${p.day}・${fmtDate(date)}` : (date ? fmtDate(date) : ""); };
const priceText = types => types.map(x => `${x.label} ${x.currency === "JPY" ? "¥" : x.currency + " "}${num(x.price)}`).join("・");

function ticketsHtml(t) {
  const T = t.tickets, edit = flightEditable();
  const sights = tripSights(t);
  const done = new Set(T.items.map(x => x.name));
  if (!tkChecked || tkChecked.tripId !== t.id) {
    tkChecked = new Set(sights.filter(s => !done.has(s.name)).slice(0, TICKET_MAX).map(s => s.name)); tkChecked.tripId = t.id; tkExtra = "";
  }
  const inc = T.items.filter(x => x.include);
  const incTotal = inc.reduce((s, x) => s + (x.partyTotalTwd || 0), 0);
  const needBook = inc.filter(x => x.status === "required" || x.status === "recommended");
  const summary = T.items.length ? `<div class="tk-summary">
      <span>已加入計畫 <b>${inc.length}</b> 項${inc.length ? `・合計約 <b class="mono">NT$ ${num(incTotal)}</b>${inc.some(x => !x.partyTotalTwd && x.status !== "free") ? "（部分未查到價格）" : ""}` : ""}</span>
      ${needBook.length ? `<span>需要預約 <b>${needBook.length}</b> 項・已購票 <b>${needBook.filter(x => x.booked).length}</b> 項</span>` : ""}
    </div>` : "";

  const picker = edit ? `
    <div class="tk-picker">
      <span class="lbl">行程中的景點（勾選要查詢的，一次最多 ${TICKET_MAX} 個）</span>
      ${sights.length ? `<ul class="tk-sights">${sights.map((s, i) => `<li><label><input type="checkbox" data-tk-sight="${esc(s.name)}"${tkChecked.has(s.name) ? " checked" : ""}>
        <span>${esc(s.name)}</span><small>${esc(dayLabel(t, s.date) || `Day ${s.day}`)}</small>${done.has(s.name) ? `<span class="tk-done">已查</span>` : ""}</label></li>`).join("")}</ul>`
        : `<p class="status">行程中沒有標示為景點的項目，可以在下方自行輸入。</p>`}
      <div class="field"><label for="tk-extra">其他景點（用逗號分隔）</label><input id="tk-extra" value="${esc(tkExtra)}" placeholder="例：環球影城、海遊館"></div>
      <div class="actions">
        ${canSearchTickets()
          ? `<button class="btn primary" type="button" data-tk="search"${tkBusy ? " disabled" : ""}>${tkBusy ? "查詢中…" : "查詢門票"}</button>
             <button class="btn ghost" type="button" data-tk="query">改用 claude.ai 查詢</button>`
          : `<button class="btn primary" type="button" data-tk="query">查詢門票</button>`}
        <span id="tkCount" class="status">已選 ${ticketQueryList(t).length} 個</span>
      </div>
      ${tkBusy ? `<p class="status lk-busy" role="status">正在上網查詢門票資訊，約需 15～50 秒，請稍候…</p>` : ""}
    </div>` : (meta.source === "sample" ? `<p class="status">範例行程不能修改。建立或匯入自己的行程後，就能查詢與記錄門票。</p>` : "");

  const items = [...T.items].sort((a, b) => TICKET_STATUS[a.status].rank - TICKET_STATUS[b.status].rank || (a.date || "9").localeCompare(b.date || "9"));
  const cards = items.length ? `<ul class="tk-list">${items.map(x => {
    const st = TICKET_STATUS[x.status];
    const conf = edit && x.booked ? store.get(`rb.ticketconf.${t.id}.${x.name}`, "") : "";
    return `<li class="tk-card${x.include ? " included" : ""}">
      <div class="tk-head"><span class="tk-badge ${st.cls}">${st.label}</span><b>${esc(x.name)}</b>${x.nameLocal && x.nameLocal !== x.name ? ` <small>${esc(x.nameLocal)}</small>` : ""}
        ${x.date ? `<small class="tk-day">${esc(dayLabel(t, x.date))}</small>` : ""}</div>
      ${x.status !== "free" ? `<div class="tk-price">${x.ticketTypes.length ? esc(priceText(x.ticketTypes)) : `<span class="lk-wait">價格未查到</span>`}
        ${x.partyTotalTwd ? `<span>・全體約 <b class="mono">NT$ ${num(x.partyTotalTwd)}</b>${x.fxNote ? `<small>（${esc(x.fxNote)}）</small>` : ""}</span>` : ""}</div>` : ""}
      ${x.bookingWindow || x.timeSlot ? `<div class="tk-window">${x.bookingWindow ? `開賣：${esc(x.bookingWindow)}` : ""}${x.timeSlot ? `${x.bookingWindow ? "・" : ""}需預約入場時段` : ""}</div>` : ""}
      ${x.openingHours || x.closedDays ? `<div class="tk-meta">${[x.openingHours && `營業 ${x.openingHours}`, x.closedDays && `公休 ${x.closedDays}`].filter(Boolean).map(esc).join("・")}</div>` : ""}
      ${x.tips ? `<div class="ht-good">${esc(x.tips)}</div>` : ""}
      ${x.cautions ? `<div class="ht-warn">注意：${esc(x.cautions)}</div>` : ""}
      <div class="lk-links">${x.channels.map(c => `<a href="${esc(c.url)}" target="_blank" rel="noopener">${esc(c.name)}</a>`).join("")}
        ${x.source ? `<a href="${esc(x.source)}" target="_blank" rel="noopener">來源</a>` : `<span class="lk-nosrc">無來源</span>`}
        <small>查詢日期 ${esc(x.fetchedAt || "—")}</small></div>
      ${edit ? `<div class="tk-acts">
        ${x.status === "free" ? `<span class="status">免費參觀，不需購票</span>` : `<button class="btn ${x.include ? "primary" : ""}" type="button" data-tk="include" data-name="${esc(x.name)}">${x.include ? "已加入計畫" : "加入計畫"}</button>`}
        ${x.include ? `<button class="btn" type="button" data-tk="booked" data-name="${esc(x.name)}">${x.booked ? "改為尚未購票" : "標示已購票"}</button>` : ""}
        <button class="btn ghost" type="button" data-tk="remove" data-name="${esc(x.name)}">移除</button></div>
        ${x.booked ? `<div class="fl-pnr"><label>購票確認碼（只存在這台電腦，不會分享出去）</label>
          <div class="fl-pnr-row"><input data-tk-conf="${esc(x.name)}" maxlength="40" autocomplete="off" value="${esc(conf)}"><button class="btn" type="button" data-tk="conf" data-name="${esc(x.name)}">儲存</button></div></div>` : ""}`
        : (x.include ? `<div class="tk-acts"><span class="badge-chosen">${x.booked ? "已購票" : "已加入計畫"}</span></div>` : "")}
    </li>`;
  }).join("")}</ul>` : "";

  return `
  <section class="block" id="tickets">
    <h2>門票 <span class="eyebrow">Tickets</span></h2>
    <div class="panel">
      ${summary}${picker}
      ${T.note ? `<p class="lk-note">${esc(T.note)}</p>` : ""}
      ${T.sources.length ? `<details class="lk-sources"><summary>查詢時參考的網頁（${T.sources.length}）</summary><ul>${T.sources.map(x => `<li><a href="${esc(x.uri)}" target="_blank" rel="noopener">${esc(x.title || x.uri)}</a></li>`).join("")}</ul></details>` : ""}
      ${cards}
      ${items.length ? `<p class="status">價格、營業時間與開賣規則是從景點官網與購票平台查到的參考值，購票前請到購買管道確認。網站不代售門票。</p>` : ""}
    </div>
  </section>`;
}

/** 加入計畫的門票寫回預算（門票與體驗）與預訂時程（需要預約的） */
function applyTicketsToPlan(t) {
  const inc = t.tickets.items.filter(x => x.include);
  const priced = inc.filter(x => x.partyTotalTwd);
  if (priced.length) {
    const total = priced.reduce((s, x) => s + x.partyTotalTwd, 0);
    const note = priced.map(x => x.name).join("、") + (inc.length > priced.length ? `；另有 ${inc.length - priced.length} 項未查到價格` : "");
    const b = t.budget.items.find(x => /門票|體驗|入場/.test(x.category));
    if (b) { b.amount = total; b.note = note; } else t.budget.items.push({ category: "門票與體驗", amount: total, note });
  }
  // 預訂時程：先移除之前由門票自動產生的，再依目前計畫重新加入
  t.bookings = t.bookings.filter(b => !String(b.auto || "").startsWith("ticket:"));
  const manual = t.bookings.map(b => String(b.what || ""));
  for (const x of inc.filter(x => x.status === "required" || x.status === "recommended")) {
    // 原本的預訂時程已經提到這個景點（例如規劃時就寫好的），不重複加入
    const core = x.name.split(/[（(]/)[0].trim();
    if (core && manual.some(w => w.includes(core))) continue;
    t.bookings.push({
      auto: "ticket:" + x.name,
      when: x.bookingWindow || (x.status === "required" ? "出發前（開賣時間未查到）" : "出發前"),
      what: `${x.name} 門票${x.date ? `（${fmtDate(x.date)} 入場）` : ""}${x.timeSlot ? "，需選入場時段" : ""}`,
      note: [x.booked ? "已購票" : "", x.channels.map(c => c.name).join("、")].filter(Boolean).join("；"),
    });
  }
}

function ticketPrompt(t, list) {
  const p = partyOf(t);
  const who = [p.adults && `成人 ${p.adults}`, p.seniors && `長輩（65 歲以上）${p.seniors}`, p.kids && `兒童 ${p.kids}${p.kidAges ? `（${p.kidAges} 歲）` : ""}`].filter(Boolean).join("、");
  return `請使用網路搜尋，查詢以下${t.dest.city ? `${t.dest.city}的` : ""}景點門票資訊，旅客為${who}：
${list.map((a, i) => `${i + 1}. ${a.name}${a.place ? `（${a.place}）` : ""}：${a.date || "日期未定"}`).join("\n")}

每個景點回傳一筆，name 照上面的名稱填寫：
1. status：必須事先預約或購票填 "required"；可現場購買但建議先買填 "recommended"；現場購票填 "onsite"；免費填 "free"。
2. ticketTypes：各票種與當地貨幣原價（price 數字、currency 幣別代碼）。免費給空陣列。
3. partyTotalTwd：依旅客組成計算全體合計並換算新台幣整數，fxNote 寫匯率；查不到填 0。
4. openingHours、closedDays；查詢日期當天公休或特殊休館時寫在 cautions。
5. timeSlot：需要預約入場時段填 true；bookingWindow 寫開賣規則（例如「入場日前 1 個月的 10:00 開賣」）。
6. channels：購票管道最多 3 個（官網、Klook、KKday 等）附網址；tips、cautions；source 是主要資料網址。
不要編造價格、時間或網址，查不到的留空或填 0。

直接在對話中回覆，不要建立 artifact 或檔案。最後只回覆一個 \`\`\`json 程式碼區塊，格式：
{"attractions":[{"name":"","nameLocal":"","status":"required","ticketTypes":[{"label":"成人","price":0,"currency":"JPY"}],"partyTotalTwd":0,"fxNote":"","openingHours":"","closedDays":"","timeSlot":false,"bookingWindow":"","channels":[{"name":"官網","url":"https://..."}],"tips":"","cautions":"","source":"https://..."}],"note":""}`;
}

/** 把查詢結果併入行程：同名景點以新結果為準，保留原本的計畫與購票狀態 */
function mergeTicketResults(list, req, extra) {
  const byName = new Map(req.map(a => [a.name, a]));
  const old = new Map(trip.tickets.items.map(x => [x.name, x]));
  const fresh = list.map(x => {
    const q = byName.get(x.name) || {};
    const prev = old.get(x.name);
    return { ...x, date: q.date || prev?.date || "", place: q.place || "", fetchedAt: extra.fetchedAt, include: prev?.include || false, booked: prev?.booked || false };
  });
  const names = new Set(fresh.map(x => x.name));
  trip.tickets = normalizeTickets({ items: [...fresh, ...trip.tickets.items.filter(x => !names.has(x.name))], note: extra.note || trip.tickets.note, sources: extra.sources || trip.tickets.sources });
  applyTicketsToPlan(trip);
  return fresh.length;
}

let tkPending = null;
async function importTickets(text) {
  const st = $("#importStatus");
  try {
    const raw = String(text || "").trim();
    const fences = [...raw.matchAll(/```(?:json)?\s*([\s\S]*?)```/gi)];
    const body = (fences.length ? fences[fences.length - 1][1] : raw).trim();
    let data;
    try { data = JSON.parse(body); } catch { data = extractJson(body); }
    const list = Array.isArray(data) ? data : data?.attractions;
    if (!Array.isArray(list)) throw new Error("找不到 attractions 景點清單");
    const n = mergeTicketResults(list, tkPending || [], { fetchedAt: new Date().toISOString().slice(0, 10), note: data?.note, sources: [] });
    for (const a of tkPending || []) tkChecked?.delete(a.name);
    tkPending = null; tkExtra = "";
    $("#promptPanel").hidden = true;
    if (await persistTrip(`已加入 ${n} 個景點的門票資訊`)) $("#tickets").scrollIntoView({ block: "start" });
  } catch (err) {
    st.className = "status err";
    st.textContent = err instanceof SyntaxError
      ? "JSON 格式有誤，常見原因是回覆被截斷。請請 Claude「繼續」或重新產生，再貼一次完整內容。"
      : "無法匯入：" + err.message + "。請確認貼上的是 Claude 回覆中的 JSON。";
  }
}

async function directTicketSearch(list) {
  if (tkBusy) return;
  const t = trip;
  tkBusy = true; show(t, meta);
  let r;
  try { r = await cloud.searchTickets({ attractions: list, city: t.dest.city || "", ...partyOf(t) }); }
  catch { r = { available: false, reason: "查詢失敗，請稍後再試。" }; }
  tkBusy = false;
  if (trip !== t) return;
  if (!r || !r.available) { show(trip, meta); toast(r?.reason || "查詢失敗，請稍後再試。"); return; }
  for (const a of list) tkChecked.delete(a.name);
  tkExtra = "";
  const n = mergeTicketResults(r.attractions || [], list, { fetchedAt: r.fetchedAt, note: r.note, sources: r.sources });
  if (await persistTrip(n ? `已查到 ${n} 個景點的門票資訊` : "沒有查到門票資訊")) $("#tickets").scrollIntoView({ block: "start" });
}

$("#book").addEventListener("click", async e => {
  const b = e.target.closest("[data-tk]"); if (!b || !trip) return;
  const act = b.dataset.tk, name = b.dataset.name;
  if (act === "search" || act === "query") {
    const list = ticketQueryList(trip);
    if (!list.length) { toast("請先勾選或輸入景點"); return; }
    if (list.length > TICKET_MAX) { toast(`一次最多查詢 ${TICKET_MAX} 個景點，請減少勾選`); return; }
    if (act === "search") return directTicketSearch(list);
    tkPending = list;
    return showPrompt(ticketPrompt(trip, list), "查詢景點門票", "tickets");
  }
  if (!flightEditable()) return;
  const T = trip.tickets;
  if (act === "include" || act === "booked") {
    trip.tickets = { ...T, items: T.items.map(x => x.name !== name ? x
      : act === "include" ? { ...x, include: !x.include, booked: x.include ? false : x.booked } : { ...x, booked: !x.booked }) };
    applyTicketsToPlan(trip);
    const x = trip.tickets.items.find(x => x.name === name);
    return persistTrip(act === "include" ? (x.include ? "已加入計畫，預算與預訂時程已更新" : "已從計畫移除") : (x.booked ? "已標示已購票" : "已改為尚未購票"));
  }
  if (act === "remove") {
    if (b.dataset.confirm !== "1") { b.dataset.confirm = "1"; b.textContent = "確認移除"; return; }
    trip.tickets = { ...T, items: T.items.filter(x => x.name !== name) };
    applyTicketsToPlan(trip);
    return persistTrip("已移除");
  }
  if (act === "conf") {
    const input = [...document.querySelectorAll("[data-tk-conf]")].find(i => i.dataset.tkConf === name);
    store.set(`rb.ticketconf.${trip.id}.${name}`, (input?.value || "").trim());
    return toast("購票確認碼已存在這台電腦");
  }
});

/* ---------- 交通票券：依行程移動段分析周遊券、IC 卡、機場交通、需劃位的車票 ----------
 * 與門票相同的做法：在 Claude Flow 底下由後端（Gemini＋Google 搜尋）直接分析，也可以改用 claude.ai。
 * 加入計畫的票券另列預算「交通票券」（不改動原本的「交通」）、需要預約的排進預訂時程、並列在總覽的交通策略。
 */
const PASS_TYPES = { pass: "周遊券", ic: "IC 卡", airport: "機場交通", reserved: "需劃位車票", single: "單買" };
const PASS_VERDICT = { recommended: { label: "推薦", cls: "ok", rank: 0 }, optional: { label: "可考慮", cls: "info", rank: 1 }, not_needed: { label: "不需要", cls: "mute", rank: 2 } };
function normalizePassItem(x) {
  const name = String(x?.name || "").trim().slice(0, 60);
  if (!name) return null;
  const S = (v, m) => String(v || "").slice(0, m);
  const total = Math.round(+x?.partyTotalTwd || 0);
  return {
    name, nameLocal: S(x?.nameLocal, 80).trim(),
    type: PASS_TYPES[x?.type] ? x.type : "pass", verdict: PASS_VERDICT[x?.verdict] ? x.verdict : "optional",
    coverage: S(x?.coverage, 120), validity: S(x?.validity, 40),
    useDays: [...new Set((Array.isArray(x?.useDays) ? x.useDays : []).map(d => Math.round(+d)).filter(d => d >= 1 && d <= 60))].sort((a, b) => a - b),
    priceTypes: (Array.isArray(x?.priceTypes) ? x.priceTypes : []).map(t => {
      const price = Math.round((+t?.price || 0) * 100) / 100, currency = String(t?.currency || "").trim().toUpperCase(), label = S(t?.label, 20).trim();
      return label && price >= 0 && price < 1e7 && /^[A-Z]{3}$/.test(currency) ? { label, price, currency } : null;
    }).filter(Boolean).slice(0, 6),
    partyTotalTwd: total > 0 && total <= 1e6 ? total : null, fxNote: S(x?.fxNote, 40), savingsNote: S(x?.savingsNote, 160),
    buyWhere: S(x?.buyWhere, 120), needReservation: x?.needReservation === true, bookingWindow: S(x?.bookingWindow, 80),
    channels: (Array.isArray(x?.channels) ? x.channels : []).map(c => ({ name: S(c?.name, 20).trim(), url: safeUrl(c?.url) })).filter(c => c.name && c.url).slice(0, 3),
    tips: S(x?.tips, 160), cautions: S(x?.cautions, 160), source: safeUrl(x?.source),
    include: !!x?.include, booked: !!(x?.include && x?.booked),
  };
}
function normalizeTransport(tr) {
  const seen = new Set();
  const total = Math.round(+tr?.strategyTotalTwd || 0);
  return {
    strategy: String(tr?.strategy || "").slice(0, 400), strategyTotalTwd: total > 0 && total <= 2e6 ? total : null,
    passes: (Array.isArray(tr?.passes) ? tr.passes : []).map(normalizePassItem).filter(x => x && !seen.has(x.name) && seen.add(x.name)).slice(0, 12),
    note: String(tr?.note || "").slice(0, 300), fetchedAt: String(tr?.fetchedAt || "").slice(0, 10),
    sources: (Array.isArray(tr?.sources) ? tr.sources : []).slice(0, 15).map(x => ({ title: String(x?.title || "").slice(0, 120), uri: safeUrl(x?.uri) })).filter(x => x.uri),
  };
}

/** 行程中的移動段（不含飛機），依天數排列 */
function tripLegs(t) {
  const out = [];
  t.dayPlans.forEach(p => p.items.forEach(it => {
    if (it.type !== "move" || it.flight || /航空|飛機|班機/.test(`${it.mode || ""}${it.title || ""}`)) return;
    out.push({ day: p.day, date: p.date || "", from: it.from || "", to: it.to || "", mode: MODE[it.mode] || it.mode || "", title: it.title || "" });
  }));
  return out.slice(0, 40);
}
let trBusy = false;
const canSearchTransport = () => !!(cloud && typeof cloud.searchTransport === "function") && flightEditable();

function transportHtml(t) {
  const TR = t.transport, edit = flightEditable();
  const legs = tripLegs(t);
  const byDay = {};
  legs.forEach(l => (byDay[l.day] ||= []).push(l));
  const legList = legs.length ? `<details class="tr-legs"><summary>行程中的移動段（${legs.length} 段）</summary><ul>${Object.entries(byDay).map(([d, ls]) =>
      `<li><b>Day ${esc(d)}</b> ${ls.map(l => esc(l.from && l.to ? `${l.from} → ${l.to}` : l.title) + (l.mode ? `<small>（${esc(l.mode)}）</small>` : "")).join("、")}</li>`).join("")}</ul></details>`
    : `<p class="status">行程中沒有移動段，無法分析交通票券。</p>`;

  const tools = edit ? `
    ${legList}
    <div class="actions">
      ${legs.length ? (canSearchTransport()
        ? `<button class="btn primary" type="button" data-tr="search"${trBusy ? " disabled" : ""}>${trBusy ? "分析中…" : TR.passes.length ? "重新分析交通票券" : "分析交通票券"}</button>
           <button class="btn ghost" type="button" data-tr="query">改用 claude.ai 查詢</button>`
        : `<button class="btn primary" type="button" data-tr="query">分析交通票券</button>`) : ""}
    </div>
    ${trBusy ? `<p class="status lk-busy" role="status">正在上網查詢交通票券並與單買比較，約需 15～50 秒，請稍候…</p>` : ""}`
    : (meta.source === "sample" ? `<p class="status">範例行程不能修改。建立或匯入自己的行程後，就能分析交通票券。</p>` : "");

  const inc = TR.passes.filter(x => x.include);
  const strategy = TR.strategy || TR.passes.length ? `<div class="tr-strategy">
      <span class="eyebrow">建議策略${TR.fetchedAt ? `・${esc(TR.fetchedAt)} 分析` : ""}</span>
      ${TR.strategy ? `<p>${esc(TR.strategy)}</p>` : ""}
      <p class="status">${TR.strategyTotalTwd ? `推薦組合全體約 <b class="mono">NT$ ${num(TR.strategyTotalTwd)}</b>・` : ""}已加入計畫 <b>${inc.length}</b> 項${inc.length ? `，合計約 <b class="mono">NT$ ${num(inc.reduce((s, x) => s + (x.partyTotalTwd || 0), 0))}</b>` : ""}</p>
    </div>` : "";

  const items = [...TR.passes].sort((a, b) => PASS_VERDICT[a.verdict].rank - PASS_VERDICT[b.verdict].rank);
  const cards = items.length ? `<ul class="tk-list">${items.map(x => {
    const v = PASS_VERDICT[x.verdict];
    const conf = edit && x.booked ? store.get(`rb.passconf.${t.id}.${x.name}`, "") : "";
    return `<li class="tk-card${x.include ? " included" : ""}${x.verdict === "not_needed" ? " tr-off" : ""}">
      <div class="tk-head"><span class="tk-badge ${v.cls}">${v.label}</span><span class="tr-type">${PASS_TYPES[x.type]}</span><b>${esc(x.name)}</b>${x.nameLocal && x.nameLocal !== x.name ? ` <small>${esc(x.nameLocal)}</small>` : ""}</div>
      ${x.coverage || x.validity || x.useDays.length ? `<div class="tk-meta">${[x.coverage, x.validity && `效期 ${x.validity}`, x.useDays.length && `使用 ${x.useDays.map(d => "Day " + d).join("、")}`].filter(Boolean).map(esc).join("・")}</div>` : ""}
      <div class="tk-price">${x.priceTypes.length ? esc(priceText(x.priceTypes)) + (x.partyTotalTwd ? "・" : "") : (x.partyTotalTwd ? "" : `<span class="lk-wait">價格未查到</span>`)}
        ${x.partyTotalTwd ? `<span>全體約 <b class="mono">NT$ ${num(x.partyTotalTwd)}</b>${x.fxNote ? `<small>（${esc(x.fxNote)}）</small>` : ""}</span>` : ""}</div>
      ${x.savingsNote ? `<div class="tr-save">${esc(x.savingsNote)}</div>` : ""}
      ${x.buyWhere ? `<div class="tk-meta">購買：${esc(x.buyWhere)}</div>` : ""}
      ${x.needReservation || x.bookingWindow ? `<div class="tk-window">${x.needReservation ? "需事先預約或劃位" : ""}${x.needReservation && x.bookingWindow ? "・" : ""}${esc(x.bookingWindow)}</div>` : ""}
      ${x.tips ? `<div class="ht-good">${esc(x.tips)}</div>` : ""}
      ${x.cautions ? `<div class="ht-warn">注意：${esc(x.cautions)}</div>` : ""}
      <div class="lk-links">${x.channels.map(c => `<a href="${esc(c.url)}" target="_blank" rel="noopener">${esc(c.name)}</a>`).join("")}
        ${x.source ? `<a href="${esc(x.source)}" target="_blank" rel="noopener">來源</a>` : `<span class="lk-nosrc">無來源</span>`}</div>
      ${edit ? `<div class="tk-acts">
        <button class="btn ${x.include ? "primary" : ""}" type="button" data-tr="include" data-name="${esc(x.name)}">${x.include ? "已加入計畫" : "加入計畫"}</button>
        ${x.include ? `<button class="btn" type="button" data-tr="booked" data-name="${esc(x.name)}">${x.booked ? "改為尚未購買" : "標示已購買"}</button>` : ""}
        <button class="btn ghost" type="button" data-tr="remove" data-name="${esc(x.name)}">移除</button></div>
        ${x.booked ? `<div class="fl-pnr"><label>購買或預約確認碼（只存在這台電腦，不會分享出去）</label>
          <div class="fl-pnr-row"><input data-tr-conf="${esc(x.name)}" maxlength="40" autocomplete="off" value="${esc(conf)}"><button class="btn" type="button" data-tr="conf" data-name="${esc(x.name)}">儲存</button></div></div>` : ""}`
        : (x.include ? `<div class="tk-acts"><span class="badge-chosen">${x.booked ? "已購買" : "已加入計畫"}</span></div>` : "")}
    </li>`;
  }).join("")}</ul>` : "";

  return `
  <section class="block" id="transport">
    <h2>交通票券 <span class="eyebrow">Passes</span></h2>
    <div class="panel">
      ${strategy}${tools}
      ${TR.note ? `<p class="lk-note">${esc(TR.note)}</p>` : ""}
      ${TR.sources.length ? `<details class="lk-sources"><summary>分析時參考的網頁（${TR.sources.length}）</summary><ul>${TR.sources.map(x => `<li><a href="${esc(x.uri)}" target="_blank" rel="noopener">${esc(x.title || x.uri)}</a></li>`).join("")}</ul></details>` : ""}
      ${cards}
      ${items.length ? `<p class="status">票價與規定是從官方與購票平台查到的參考值；加入計畫的票券另列預算「交通票券」，原本的「交通」預算若已包含這些費用，請自行調整。網站不代售票券。</p>` : ""}
    </div>
  </section>`;
}

/** 加入計畫的票券寫回：預算「交通票券」、預訂時程（需預約的）、總覽的交通策略 */
function applyTransportToPlan(t) {
  const inc = t.transport.passes.filter(x => x.include);
  const priced = inc.filter(x => x.partyTotalTwd);
  const bi = t.budget.items.findIndex(x => x.category === "交通票券");
  if (priced.length) {
    const item = { category: "交通票券", amount: priced.reduce((s, x) => s + x.partyTotalTwd, 0),
      note: priced.map(x => x.name).join("、") + (inc.length > priced.length ? `；另有 ${inc.length - priced.length} 項未查到價格` : "") };
    if (bi >= 0) t.budget.items[bi] = item; else t.budget.items.push(item);
  } else if (bi >= 0) t.budget.items.splice(bi, 1);

  const core = n => n.split(/[（(]/)[0].trim();
  t.bookings = t.bookings.filter(b => !String(b.auto || "").startsWith("transport:"));
  const manualB = t.bookings.map(b => String(b.what || ""));
  for (const x of inc.filter(x => x.needReservation || x.bookingWindow)) {
    if (manualB.some(w => w.includes(core(x.name)))) continue;
    t.bookings.push({ auto: "transport:" + x.name, when: x.bookingWindow || "出發前", what: `${x.name}${x.needReservation ? "（需事先預約或劃位）" : ""}`,
      note: [x.booked ? "已購買" : "", x.buyWhere || x.channels.map(c => c.name).join("、")].filter(Boolean).join("；") });
  }

  const passes = t.overview.passes.filter(p => !String(p.auto || "").startsWith("transport:"));
  const manualP = passes.map(p => String(p.name || ""));
  for (const x of inc) {
    if (manualP.some(n => n.includes(core(x.name)) || core(x.name).includes(n))) continue;
    passes.push({ auto: "transport:" + x.name, name: x.name, note: [x.coverage, x.validity, x.useDays.length && `用於 ${x.useDays.map(d => "Day " + d).join("、")}`].filter(Boolean).join("；") });
  }
  t.overview = { ...t.overview, passes };
}

function transportPrompt(t, legs) {
  const p = partyOf(t);
  const who = [p.adults && `成人 ${p.adults}`, p.seniors && `長輩（65 歲以上）${p.seniors}`, p.kids && `兒童 ${p.kids}${p.kidAges ? `（${p.kidAges} 歲）` : ""}`].filter(Boolean).join("、");
  const known = t.overview.passes.filter(x => !x.auto).map(x => x.name);
  return `請使用網路搜尋，依以下${t.dest.city || ""}行程的移動段，分析該買哪些交通票券，旅客為${who}：
${legs.map(l => `- Day ${l.day}${l.date ? `（${l.date}）` : ""}：${l.from && l.to ? `${l.from} → ${l.to}` : l.title}${l.mode ? `（${l.mode}）` : ""}`).join("\n")}
${known.length ? `\n行程原本規劃的票券：${known.join("、")}（請一併評估是否划算）\n` : ""}
查詢可用的周遊券、一日券、IC 卡、機場交通優惠票、需劃位的特急或觀光列車，依實際移動段與單買比較，列出最多 8 項：
- type：pass（周遊券、一日券）、ic（IC 卡）、airport（機場交通）、reserved（需事先劃位的車票）、single（建議單買）。
- verdict：recommended（建議買）、optional（看情況）、not_needed（不划算或用不到，在 savingsNote 說明）。
- coverage 範圍、validity 效期、useDays 用得到的天數陣列；priceTypes 各票種當地貨幣原價；partyTotalTwd 全體合計新台幣與 fxNote 匯率（IC 卡填建議儲值總額）。
- savingsNote 與單買比較省或多多少及依據；buyWhere 購買地點與方式；needReservation、bookingWindow；channels 購買管道與網址（最多 3 個）；tips、cautions、source。
- strategy 用 2～3 句話寫整體建議；strategyTotalTwd 推薦組合全體合計。
不要編造票券、價格或網址，查不到的留空或填 0。

直接在對話中回覆，不要建立 artifact 或檔案。最後只回覆一個 \`\`\`json 程式碼區塊，格式：
{"strategy":"","strategyTotalTwd":0,"passes":[{"name":"","nameLocal":"","type":"pass","verdict":"recommended","coverage":"","validity":"","useDays":[1],"priceTypes":[{"label":"成人","price":0,"currency":"JPY"}],"partyTotalTwd":0,"fxNote":"","savingsNote":"","buyWhere":"","needReservation":false,"bookingWindow":"","channels":[{"name":"官網","url":"https://..."}],"tips":"","cautions":"","source":"https://..."}],"note":""}`;
}

/** 分析結果取代原本的清單，同名票券保留計畫與購買狀態 */
function setTransportResult(r) {
  const old = new Map(trip.transport.passes.map(x => [x.name, x]));
  const passes = (Array.isArray(r.passes) ? r.passes : []).map(x => {
    const prev = old.get(String(x?.name || "").trim());
    return { ...x, include: prev?.include || false, booked: prev?.booked || false };
  });
  trip.transport = normalizeTransport({ ...r, passes });
  applyTransportToPlan(trip);
  return trip.transport.passes.length;
}

async function importTransport(text) {
  const st = $("#importStatus");
  try {
    const raw = String(text || "").trim();
    const fences = [...raw.matchAll(/```(?:json)?\s*([\s\S]*?)```/gi)];
    const body = (fences.length ? fences[fences.length - 1][1] : raw).trim();
    let data;
    try { data = JSON.parse(body); } catch { data = extractJson(body); }
    if (!Array.isArray(data?.passes)) throw new Error("找不到 passes 票券清單");
    const n = setTransportResult({ ...data, sources: [], fetchedAt: new Date().toISOString().slice(0, 10) });
    $("#promptPanel").hidden = true;
    if (await persistTrip(`已分析 ${n} 種交通票券`)) $("#transport").scrollIntoView({ block: "start" });
  } catch (err) {
    st.className = "status err";
    st.textContent = err instanceof SyntaxError
      ? "JSON 格式有誤，常見原因是回覆被截斷。請請 Claude「繼續」或重新產生，再貼一次完整內容。"
      : "無法匯入：" + err.message + "。請確認貼上的是 Claude 回覆中的 JSON。";
  }
}

async function directTransportSearch() {
  if (trBusy) return;
  const t = trip;
  trBusy = true; show(t, meta);
  let r;
  try {
    r = await cloud.searchTransport({ legs: tripLegs(t), city: t.dest.city || "", ...partyOf(t), knownPasses: t.overview.passes.filter(x => !x.auto).map(x => x.name) });
  } catch { r = { available: false, reason: "分析失敗，請稍後再試。" }; }
  trBusy = false;
  if (trip !== t) return;
  if (!r || !r.available) { show(trip, meta); toast(r?.reason || "分析失敗，請稍後再試。"); return; }
  const n = setTransportResult(r);
  if (await persistTrip(n ? `已分析 ${n} 種交通票券` : "沒有找到適合的交通票券")) $("#transport").scrollIntoView({ block: "start" });
}

$("#book").addEventListener("click", async e => {
  const b = e.target.closest("[data-tr]"); if (!b || !trip) return;
  const act = b.dataset.tr, name = b.dataset.name;
  if (act === "search") return directTransportSearch();
  if (act === "query") return showPrompt(transportPrompt(trip, tripLegs(trip)), "分析交通票券", "transport");
  if (!flightEditable()) return;
  const TR = trip.transport;
  if (act === "include" || act === "booked") {
    trip.transport = { ...TR, passes: TR.passes.map(x => x.name !== name ? x
      : act === "include" ? { ...x, include: !x.include, booked: x.include ? false : x.booked } : { ...x, booked: !x.booked }) };
    applyTransportToPlan(trip);
    const x = trip.transport.passes.find(x => x.name === name);
    return persistTrip(act === "include" ? (x.include ? "已加入計畫，預算、預訂時程與總覽已更新" : "已從計畫移除") : (x.booked ? "已標示已購買" : "已改為尚未購買"));
  }
  if (act === "remove") {
    if (b.dataset.confirm !== "1") { b.dataset.confirm = "1"; b.textContent = "確認移除"; return; }
    trip.transport = { ...TR, passes: TR.passes.filter(x => x.name !== name) };
    applyTransportToPlan(trip);
    return persistTrip("已移除");
  }
  if (act === "conf") {
    const input = [...document.querySelectorAll("[data-tr-conf]")].find(i => i.dataset.trConf === name);
    store.set(`rb.passconf.${trip.id}.${name}`, (input?.value || "").trim());
    return toast("確認碼已存在這台電腦");
  }
});

/* ---------- 餐廳：為行程中的某一餐找餐廳、比較、選定、記錄訂位 ----------
 * 與住宿相同的做法：在 Claude Flow 底下由後端（Gemini＋Google 搜尋）直接查詢，也可以改用 claude.ai。
 * 選定後改寫每日行程中那一餐（名稱、地點、價位、訂位提醒），需要訂位的排進預訂時程。
 * 不改動預算的「餐飲」（那是全部餐費的估算），只在區塊內顯示已選餐廳的合計。網站不代為訂位。
 */
const MEALS = ["早餐", "午餐", "下午茶", "晚餐", "宵夜"];
const RSV = {
  required: { label: "必須訂位", cls: "crit" }, recommended: { label: "建議訂位", cls: "warn" },
  walkin: { label: "不需訂位", cls: "info" }, not_accepted: { label: "不接受訂位", cls: "mute" },
};
function normalizeRestaurant(x) {
  const name = String(x?.name || "").trim().slice(0, 80);
  if (!name) return null;
  const S = (v, m) => String(v || "").slice(0, m);
  const int = (v, max) => { const n = Math.round(+v || 0); return n > 0 && n <= max ? n : null; };
  let priceMin = int(x?.priceMin, 1e7), priceMax = int(x?.priceMax, 1e7);
  if (priceMin && priceMax && priceMin > priceMax) [priceMin, priceMax] = [priceMax, priceMin];
  const currency = String(x?.currency || "").trim().toUpperCase();
  return {
    name, nameLocal: S(x?.nameLocal, 100).trim(), cuisine: S(x?.cuisine, 30), area: S(x?.area, 40), access: S(x?.access, 80), walkMin: int(x?.walkMin, 120),
    priceMin, priceMax, currency: /^[A-Z]{3}$/.test(currency) && (priceMin || priceMax) ? currency : "",
    partyEstimateTwd: int(x?.partyEstimateTwd, 1e6), fxNote: S(x?.fxNote, 40), ratings: normalizeRatings(x),
    reservation: RSV[x?.reservation] ? x.reservation : "walkin", reservationHow: S(x?.reservationHow, 80), bookingWindow: S(x?.bookingWindow, 80),
    openingHours: S(x?.openingHours, 80), closedDays: S(x?.closedDays, 60), signature: S(x?.signature, 80),
    familyNote: S(x?.familyNote, 120), dietNote: S(x?.dietNote, 120), tips: S(x?.tips, 160), cautions: S(x?.cautions, 160),
    channels: (Array.isArray(x?.channels) ? x.channels : []).map(c => ({ name: S(c?.name, 20).trim(), url: safeUrl(c?.url) })).filter(c => c.name && c.url).slice(0, 3),
    source: safeUrl(x?.source),
  };
}
function normalizeDining(d) {
  const arr = v => Array.isArray(v) ? v : [];
  const D = v => /^\d{4}-\d{2}-\d{2}$/.test(v || "") ? v : "";
  const T = v => /^\d{1,2}:\d{2}$/.test(v || "") ? v.padStart(5, "0") : "";
  const M = v => MEALS.includes(v) ? v : "";
  const searches = arr(d?.searches).slice(0, 12).map((g, i) => ({
    id: String(g?.id || `ds-${Date.now().toString(36)}-${i}`), area: String(g?.area || "").slice(0, 60), date: D(g?.date), time: T(g?.time), meal: M(g?.meal),
    slot: String(g?.slot || "").slice(0, 20), fetchedAt: String(g?.fetchedAt || "").slice(0, 10), note: String(g?.note || "").slice(0, 300),
    sources: arr(g?.sources).slice(0, 15).map(x => ({ title: String(x?.title || "").slice(0, 120), uri: safeUrl(x?.uri) })).filter(x => x.uri),
    restaurants: arr(g?.restaurants).map(normalizeRestaurant).filter(Boolean).slice(0, 10),
  })).filter(g => g.area);
  const picks = arr(d?.picks).slice(0, 30).map((p, i) => {
    const r = normalizeRestaurant(p); if (!r) return null;
    return { ...r, id: String(p?.id || `dp-${Date.now().toString(36)}-${i}`), date: D(p?.date), time: T(p?.time), meal: M(p?.meal), slot: String(p?.slot || "").slice(0, 20), booked: !!p?.booked };
  }).filter(Boolean).sort((a, b) => `${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`));
  return { searches, picks };
}

/** 依時間判斷是哪一餐（標題已寫明時以標題為準） */
function mealOf(title, time) {
  const m = MEALS.find(x => String(title || "").startsWith(x));
  if (m) return m;
  const h = +String(time || "").split(":")[0];
  if (!time) return "";
  return h < 10 ? "早餐" : h < 15 ? "午餐" : h < 17 ? "下午茶" : h < 22 ? "晚餐" : "宵夜";
}
/** 行程中的用餐時段；slot 以「第幾天｜時間」識別，選定餐廳改寫標題後仍對得上 */
function tripMeals(t) {
  const out = [];
  t.dayPlans.forEach(p => p.items.forEach(it => {
    if (it.type !== "food") return;
    out.push({ slot: `${p.day}|${it.time || ""}`, day: p.day, date: p.date || "", time: it.time || "", meal: mealOf(it.title, it.time),
      title: it.title || "", place: it.place || "", area: p.area || "" });
  }));
  return out;
}
let rsForm = null, rsBusy = "";
const rsSort = {};
const canSearchDining = () => !!(cloud && typeof cloud.searchRestaurants === "function") && flightEditable();
document.addEventListener("input", e => {
  const m = /^rs-(area|date|time|meal|cuisine|budget|diet|notes)$/.exec(e.target.id || ""); if (!m || !rsForm) return;
  rsForm[m[1]] = e.target.value;
  if (["area", "date", "time", "meal"].includes(m[1]) && rsForm.slot) {
    rsForm.slot = ""; // 改了地點或時間就不再綁定行程中的那一餐
    document.querySelector(".rs-bound")?.remove();
  }
});
const sym = c => ({ JPY: "¥", TWD: "NT$ ", USD: "US$ ", KRW: "₩", EUR: "€" }[c] || (c ? c + " " : ""));
const rPrice = r => r.priceMin || r.priceMax ? `每人 ${sym(r.currency)}${num(r.priceMin || r.priceMax)}${r.priceMax && r.priceMin && r.priceMax !== r.priceMin ? `–${num(r.priceMax)}` : ""}` : "";
function sortRestaurants(g) {
  const list = g.restaurants.map((r, i) => ({ r, i }));
  const mode = rsSort[g.id] || "";
  if (mode === "rating") list.sort((a, b) => (avgStars(b.r) ?? -1) - (avgStars(a.r) ?? -1) || a.i - b.i);
  if (mode === "price") list.sort((a, b) => (a.r.partyEstimateTwd ?? a.r.priceMin ?? Infinity) - (b.r.partyEstimateTwd ?? b.r.priceMin ?? Infinity) || a.i - b.i);
  return list;
}
const slotLabel = (t, g) => {
  const p = t.dayPlans.find(x => x.date && x.date === g.date);
  return [p ? `Day ${p.day}` : "", g.date ? fmtDate(g.date) : "", g.time, g.meal].filter(Boolean).join(" ");
};

function diningHtml(t) {
  const D = t.dining, edit = flightEditable();
  const meals = tripMeals(t);
  if (!rsForm || rsForm.tripId !== t.id) rsForm = { tripId: t.id, slot: "", area: "", date: t.startDate || "", time: "", meal: "晚餐", cuisine: "", budget: "", diet: t.request?.diet || "", notes: "" };
  const pickBySlot = new Map(D.picks.filter(p => p.slot).map(p => [p.slot, p]));

  const total = D.picks.reduce((s, p) => s + (p.partyEstimateTwd || 0), 0);
  const need = D.picks.filter(p => p.reservation === "required" || p.reservation === "recommended");
  const summary = D.picks.length ? `<div class="tk-summary">
      <span>已選餐廳 <b>${D.picks.length}</b> 家${total ? `・全體約 <b class="mono">NT$ ${num(total)}</b>` : ""}</span>
      ${need.length ? `<span>需要訂位 <b>${need.length}</b> 家・已訂位 <b>${need.filter(p => p.booked).length}</b> 家</span>` : ""}
    </div>
    <ul class="rs-picks">${D.picks.map(p => {
      const conf = edit && p.booked ? store.get(`rb.diningconf.${t.id}.${p.id}`, "") : "";
      return `<li class="ht-pick"><div class="ht-pick-main"><span class="tk-badge ${RSV[p.reservation].cls}">${RSV[p.reservation].label}</span> <b>${esc(p.name)}</b>
          <div class="status">${esc(slotLabel(t, p) || "時間未定")}${p.partyEstimateTwd ? `・全體約 NT$ ${num(p.partyEstimateTwd)}` : ""}${p.reservation === "required" || p.reservation === "recommended" ? `・<span class="fl-state ${p.booked ? "ok" : ""}">${p.booked ? "已訂位" : "尚未訂位"}</span>` : ""}</div></div>
        ${edit ? `<div class="fl-chosen-actions">
          ${p.reservation === "required" || p.reservation === "recommended" ? `<button class="btn" type="button" data-rs="booked" data-id="${esc(p.id)}">${p.booked ? "改為尚未訂位" : "標示已訂位"}</button>` : ""}
          <button class="btn ghost" type="button" data-rs="unpick" data-id="${esc(p.id)}">取消選擇</button></div>
          ${p.booked ? `<div class="fl-pnr"><label for="rsConf-${esc(p.id)}">訂位確認碼（只存在這台電腦，不會分享出去）</label>
            <div class="fl-pnr-row"><input id="rsConf-${esc(p.id)}" maxlength="40" autocomplete="off" value="${esc(conf)}"><button class="btn" type="button" data-rs="conf" data-id="${esc(p.id)}">儲存</button></div></div>` : ""}` : ""}
      </li>`;
    }).join("")}</ul>` : "";

  const mealList = edit && meals.length ? `<details class="tr-legs rs-meals"${D.searches.length ? "" : " open"}><summary>行程中的用餐（${meals.length} 餐）</summary><ul>${meals.map(m => {
      const p = pickBySlot.get(m.slot);
      return `<li><b>Day ${m.day}</b> ${esc([m.date && fmtDate(m.date), m.time, m.meal].filter(Boolean).join(" "))}：${esc(m.title)}
        ${p ? `<span class="tk-done">已選 ${esc(p.name)}</span>` : ""}
        <button class="btn ghost rs-find" type="button" data-rs="slot" data-slot="${esc(m.slot)}">為這餐找餐廳</button></li>`;
    }).join("")}</ul></details>` : "";

  const f = rsForm;
  const boundMeal = f.slot && meals.find(m => m.slot === f.slot);
  const form = edit ? `
    ${boundMeal ? `<p class="rs-bound">正在為 <b>Day ${boundMeal.day} ${esc(boundMeal.time)} ${esc(boundMeal.meal)}</b>（${esc(boundMeal.title)}）找餐廳，選定後會改寫這一餐。</p>` : ""}
    <div class="ht-form">
      <div class="field ht-area"><label for="rs-area">地區或景點 *</label><input id="rs-area" value="${esc(f.area)}" placeholder="例：祇園、錦市場、道頓堀"></div>
      <div class="field"><label for="rs-date">日期</label><input id="rs-date" type="date" value="${esc(f.date)}"></div>
      <div class="field"><label for="rs-time">時間</label><input id="rs-time" type="time" value="${esc(f.time)}"></div>
      <div class="field"><label for="rs-meal">用餐</label><select id="rs-meal">${MEALS.map(m => `<option${m === f.meal ? " selected" : ""}>${m}</option>`).join("")}</select></div>
      <div class="field"><label for="rs-cuisine">想吃的料理</label><input id="rs-cuisine" value="${esc(f.cuisine)}" placeholder="例：壽喜燒、拉麵"></div>
      <div class="field"><label for="rs-budget">每人預算（NT$）</label><input id="rs-budget" type="number" min="0" step="100" value="${esc(f.budget)}" placeholder="不限"></div>
      <div class="field"><label for="rs-diet">飲食限制</label><input id="rs-diet" value="${esc(f.diet)}" placeholder="例：不吃牛、海鮮過敏"></div>
      <div class="field ht-notes"><label for="rs-notes">其他需求</label><input id="rs-notes" value="${esc(f.notes)}" placeholder="例：要有座位、可帶嬰兒車、想看夜景"></div>
    </div>
    <div class="actions ht-tools">
      ${canSearchDining()
        ? `<button class="btn primary" type="button" data-rs="search"${rsBusy ? " disabled" : ""}>${rsBusy ? "搜尋中…" : "搜尋附近餐廳"}</button>
           <button class="btn ghost" type="button" data-rs="query">改用 claude.ai 查詢</button>`
        : `<button class="btn primary" type="button" data-rs="query">搜尋附近餐廳</button>`}
    </div>
    ${rsBusy ? `<p class="status lk-busy" role="status">正在上網搜尋${esc(rsBusy)}附近的餐廳，約需 15～50 秒，請稍候…</p>` : ""}`
    : (meta.source === "sample" ? `<p class="status">範例行程不能修改。建立或匯入自己的行程後，就能為每一餐找餐廳。</p>` : "");

  const isPicked = (g, r) => D.picks.some(p => p.name === r.name && p.date === g.date && p.time === g.time);
  const groups = D.searches.map(g => `<div class="lk-airline ht-group">
      <div class="lk-head"><h4>${esc(g.area)}附近</h4><small>${esc(slotLabel(t, g) || "時間未定")}・查詢日期 ${esc(g.fetchedAt || "—")}</small>
        ${edit ? `<button class="btn ghost" type="button" data-rs="requery" data-gid="${esc(g.id)}">重新搜尋</button><button class="btn ghost" type="button" data-rs="remove" data-gid="${esc(g.id)}">移除</button>` : ""}</div>
      ${g.note ? `<p class="lk-note">${esc(g.note)}</p>` : ""}
      ${g.sources.length ? `<details class="lk-sources"><summary>搜尋時參考的網頁（${g.sources.length}）</summary><ul>${g.sources.map(x => `<li><a href="${esc(x.uri)}" target="_blank" rel="noopener">${esc(x.title || x.uri)}</a></li>`).join("")}</ul></details>` : ""}
      ${g.restaurants.length > 1 ? `<div class="ht-sort" role="group" aria-label="排序">排序：${[["", "推薦順序"], ["rating", "評分高到低"], ["price", "價格低到高"]].map(([k, label]) =>
          `<button class="chip" type="button" data-rs="sort" data-gid="${esc(g.id)}" data-sort="${k}" aria-pressed="${(rsSort[g.id] || "") === k}">${label}</button>`).join("")}</div>` : ""}
      ${g.restaurants.length ? `<ul class="ht-list">${sortRestaurants(g).map(({ r, i }) => {
        const picked = isPicked(g, r), rv = RSV[r.reservation];
        return `<li class="ht-card${picked ? " picked" : ""}"><div class="ht-main">
          <div class="ht-name"><span class="tk-badge ${rv.cls}">${rv.label}</span> <b>${esc(r.name)}</b>${r.nameLocal && r.nameLocal !== r.name ? ` <small>${esc(r.nameLocal)}</small>` : ""}${r.cuisine ? ` <span class="tr-type">${esc(r.cuisine)}</span>` : ""}</div>
          <div class="ht-meta">${[r.area, r.access, r.walkMin ? `步行約 ${r.walkMin} 分` : ""].filter(Boolean).map(esc).join("・")}</div>
          <div class="ht-price">${rPrice(r) ? esc(rPrice(r)) : `<span class="lk-wait">價位未查到</span>`}${r.partyEstimateTwd ? `・全體約 <b class="mono">NT$ ${num(r.partyEstimateTwd)}</b>${r.fxNote ? `<small>（${esc(r.fxNote)}）</small>` : ""}` : ""}</div>
          <div class="ht-rating">${r.ratings.length ? `${starsHtml(avgStars(r))}<b class="mono">${avgStars(r)}</b>
            <small>${r.ratings.map(x => `${esc(x.site)} ${x.score}／${x.outOf}${x.reviews ? `（${num(x.reviews)} 則）` : ""}`).join("・")}</small>` : `<small class="lk-wait">沒有查到網路評分</small>`}</div>
          ${r.signature ? `<div class="ht-good">招牌：${esc(r.signature)}</div>` : ""}
          ${r.familyNote ? `<div class="ht-good">${esc(r.familyNote)}</div>` : ""}
          ${r.dietNote ? `<div class="ht-good">飲食限制：${esc(r.dietNote)}</div>` : ""}
          ${r.reservationHow || r.bookingWindow ? `<div class="tk-window">${[r.reservationHow && `訂位：${r.reservationHow}`, r.bookingWindow].filter(Boolean).map(esc).join("・")}</div>` : ""}
          ${r.openingHours || r.closedDays ? `<div class="tk-meta">${[r.openingHours && `營業 ${r.openingHours}`, r.closedDays && `公休 ${r.closedDays}`].filter(Boolean).map(esc).join("・")}</div>` : ""}
          ${r.tips ? `<div class="ht-good">${esc(r.tips)}</div>` : ""}
          ${r.cautions ? `<div class="ht-warn">注意：${esc(r.cautions)}</div>` : ""}
          <div class="lk-links">${r.channels.map(c => `<a href="${esc(c.url)}" target="_blank" rel="noopener">${esc(c.name)}</a>`).join("")}
            ${r.source ? `<a href="${esc(r.source)}" target="_blank" rel="noopener">來源</a>` : `<span class="lk-nosrc">無來源</span>`}
            <a href="${gmap(r.nameLocal || r.name)}" target="_blank" rel="noopener">地圖</a></div>
        </div>
        ${edit ? `<button class="btn ${picked ? "primary" : ""}" type="button" data-rs="choose" data-gid="${esc(g.id)}" data-i="${i}"${picked ? " disabled" : ""}>${picked ? "已選" : "選這家"}</button>` : (picked ? `<span class="badge-chosen">已選</span>` : "")}
        </li>`;
      }).join("")}</ul>` : `<p class="status">沒有找到符合的餐廳。</p>`}
    </div>`).join("");

  return `
  <section class="block" id="dining">
    <h2>餐廳 <span class="eyebrow">Dining</span></h2>
    <div class="panel">
      ${summary}${mealList}${form}${groups}
      ${D.searches.length ? `<p class="status">價位、評分、營業時間與訂位方式是從網路查到的參考值；選這家後會改寫行程中的那一餐，需要訂位的排進預訂時程。預算的「餐飲」是全部餐費的估算，不會自動調整。網站不代為訂位。</p>` : ""}
    </div>
  </section>`;
}

/** 已選的餐廳寫回：每日行程中的那一餐、預訂時程（需訂位的） */
function applyDiningToPlan(t) {
  const people = passengers(t);
  for (const p of t.dining.picks) {
    const day = p.slot ? t.dayPlans.find(d => String(d.day) === p.slot.split("|")[0]) : t.dayPlans.find(d => d.date && d.date === p.date);
    if (!day) continue;
    const time = p.slot ? p.slot.split("|")[1] : p.time;
    const payload = {
      time: time || p.time || "", type: "food", diningPick: p.id,
      title: `${p.meal || mealOf("", time) || "用餐"}：${p.name}`, place: p.nameLocal || p.name,
      detail: [p.cuisine, p.signature && `招牌 ${p.signature}`, p.access].filter(Boolean).join("；"),
      cost: [rPrice(p), p.partyEstimateTwd && `全體約 NT$ ${num(p.partyEstimateTwd)}`].filter(Boolean).join("・"),
      tip: p.reservation === "required" || p.reservation === "recommended"
        ? `${RSV[p.reservation].label}${p.reservationHow ? `（${p.reservationHow}）` : ""}${p.booked ? "，已訂位" : ""}` : (p.cautions || ""),
    };
    const idx = day.items.findIndex(it => it.diningPick === p.id || (it.type === "food" && (it.time || "") === (time || "")));
    if (idx >= 0) day.items[idx] = { ...day.items[idx], ...payload };
    else if (payload.time) {
      day.items.push(payload);
      day.items.sort((a, b) => (a.time || "").localeCompare(b.time || ""));
    }
  }
  const core = n => n.split(/[（(]/)[0].trim();
  t.bookings = t.bookings.filter(b => !String(b.auto || "").startsWith("dining:"));
  const manual = t.bookings.map(b => String(b.what || ""));
  for (const p of t.dining.picks.filter(p => p.reservation === "required" || p.reservation === "recommended")) {
    if (manual.some(w => w.includes(core(p.name)))) continue;
    t.bookings.push({ auto: "dining:" + p.id, when: p.bookingWindow || "出發前",
      what: `${p.name} 訂位（${[p.date && fmtDate(p.date), p.time, p.meal].filter(Boolean).join(" ")}，${people} 人）`,
      note: [p.booked ? "已訂位" : "", p.reservationHow].filter(Boolean).join("；") });
  }
}

function diningPrompt(t, f) {
  const p = partyOf(t);
  const who = [p.adults && `成人 ${p.adults}`, p.seniors && `長輩（65 歲以上）${p.seniors}`, p.kids && `兒童 ${p.kids}${p.kidAges ? `（${p.kidAges} 歲）` : ""}`].filter(Boolean).join("、");
  return `請使用網路搜尋，查詢「${t.dest.city || ""} ${f.area}」附近適合的餐廳，列出 5～8 家讓我比較。

- 日期與時間：${f.date || "未定"} ${f.time || ""}（${f.meal || "用餐"}）
- 用餐人數：${who}
- 想吃的料理：${f.cuisine || "不限，以當地特色為主"}
- 每人預算（新台幣）：${f.budget || "不限"}
- 飲食限制：${f.diet || "無"}（無法配合的餐廳不要列入）
- 其他需求：${f.notes || "無"}

每家餐廳請提供：cuisine 料理、area 與 access 交通、walkMin 步行分鐘；priceMin、priceMax 每人價位與 currency 幣別；partyEstimateTwd 全體估算新台幣與 fxNote 匯率；
ratings 網路評比（每個網站一筆，最多 3 個：site、score、outOf、reviews）；reservation：required（必須訂位）、recommended（建議訂位）、walkin（不需訂位）、not_accepted（不接受訂位），reservationHow 訂位方式、bookingWindow 何時開放訂位；
openingHours、closedDays（當天公休或時段不營業要寫在 cautions）；signature 招牌菜、familyNote 長輩或兒童的友善程度、dietNote 能否配合飲食限制、tips、cautions；channels 訂位或資訊管道（最多 3 個，附網址）；source 主要資料網址；nameLocal 當地語言或英文正式名稱。
不要編造餐廳、價格、評分或網址，查不到的留空或填 0。

直接在對話中回覆，不要建立 artifact 或檔案。最後只回覆一個 \`\`\`json 程式碼區塊，格式：
{"restaurants":[{"name":"","nameLocal":"","cuisine":"","area":"","access":"","walkMin":0,"priceMin":0,"priceMax":0,"currency":"JPY","partyEstimateTwd":0,"fxNote":"","ratings":[{"site":"Google","score":0,"outOf":5,"reviews":0}],"reservation":"recommended","reservationHow":"","bookingWindow":"","openingHours":"","closedDays":"","signature":"","familyNote":"","dietNote":"","tips":"","cautions":"","channels":[{"name":"Tabelog","url":"https://..."}],"source":"https://..."}],"note":""}`;
}

function addDiningSearch(group) {
  const others = trip.dining.searches.filter(g => !(g.id === group.id || (g.area === group.area && g.date === group.date && g.time === group.time)));
  const [norm] = normalizeDining({ searches: [group] }).searches;
  trip.dining = { ...trip.dining, searches: [norm, ...others].slice(0, 12) };
  return norm;
}

let rsPending = null;
async function importDining(text) {
  const st = $("#importStatus");
  try {
    const raw = String(text || "").trim();
    const fences = [...raw.matchAll(/```(?:json)?\s*([\s\S]*?)```/gi)];
    const body = (fences.length ? fences[fences.length - 1][1] : raw).trim();
    let data;
    try { data = JSON.parse(body); } catch { data = extractJson(body); }
    const list = Array.isArray(data) ? data : data?.restaurants;
    if (!Array.isArray(list)) throw new Error("找不到 restaurants 餐廳清單");
    const f = rsPending || { area: "未指定地點" };
    const g = addDiningSearch({ id: f.id, area: f.area, date: f.date, time: f.time, meal: f.meal, slot: f.slot, restaurants: list, note: data?.note || "", fetchedAt: new Date().toISOString().slice(0, 10) });
    rsPending = null;
    $("#promptPanel").hidden = true;
    if (await persistTrip(g.restaurants.length ? `已加入${g.area}附近的 ${g.restaurants.length} 家餐廳` : "沒有找到符合的餐廳")) $("#dining").scrollIntoView({ block: "start" });
  } catch (err) {
    st.className = "status err";
    st.textContent = err instanceof SyntaxError
      ? "JSON 格式有誤，常見原因是回覆被截斷。請請 Claude「繼續」或重新產生，再貼一次完整內容。"
      : "無法匯入：" + err.message + "。請確認貼上的是 Claude 回覆中的 JSON。";
  }
}

async function directDiningSearch(f, gid) {
  if (rsBusy) return;
  const t = trip;
  rsBusy = f.area; show(t, meta);
  let r;
  try {
    r = await cloud.searchRestaurants({ area: f.area, city: t.dest.city || "", date: f.date || "", time: f.time || "", meal: f.meal || "",
      cuisine: f.cuisine || "", budgetPerPersonTwd: +f.budget || 0, diet: f.diet || "", notes: f.notes || "", ...partyOf(t) });
  } catch { r = { available: false, reason: "搜尋失敗，請稍後再試。" }; }
  rsBusy = "";
  if (trip !== t) return;
  if (!r || !r.available) { show(trip, meta); toast(r?.reason || "搜尋失敗，請稍後再試。"); return; }
  const g = addDiningSearch({ id: gid, area: f.area, date: f.date, time: f.time, meal: f.meal, slot: f.slot, restaurants: r.restaurants, note: r.note, sources: r.sources, fetchedAt: r.fetchedAt });
  if (await persistTrip(g.restaurants.length ? `已找到${g.area}附近的 ${g.restaurants.length} 家餐廳` : "沒有找到符合的餐廳")) document.querySelector("#dining .ht-group")?.scrollIntoView({ block: "start" });
}

$("#book").addEventListener("click", async e => {
  const b = e.target.closest("[data-rs]"); if (!b || !trip) return;
  const act = b.dataset.rs, D = trip.dining;
  if (act === "sort") { rsSort[b.dataset.gid] = b.dataset.sort; return show(trip, meta); }
  if (act === "slot") {
    const m = tripMeals(trip).find(x => x.slot === b.dataset.slot); if (!m) return;
    const area = String(m.place || m.area || "").replace(/\s*(京料理|拉麵|燒肉|壽喜燒|餐廳|お好み焼き|湯豆腐)$/, "").trim() || m.area;
    rsForm = { ...rsForm, slot: m.slot, area, date: m.date, time: m.time, meal: m.meal || rsForm.meal };
    show(trip, meta);
    $("#rs-area")?.scrollIntoView({ block: "center" });
    return;
  }
  if (act === "search" || act === "query") {
    const f = { ...rsForm, area: (rsForm.area || "").trim() };
    if (!f.area) { $("#rs-area")?.focus(); toast("請先輸入地區或景點"); return; }
    if (act === "search") return directDiningSearch(f);
    rsPending = f;
    return showPrompt(diningPrompt(trip, f), `搜尋${f.area}附近的餐廳`, "dining");
  }
  if (act === "requery") {
    const g = D.searches.find(x => x.id === b.dataset.gid); if (!g) return;
    const f = { ...rsForm, area: g.area, date: g.date, time: g.time, meal: g.meal, slot: g.slot, id: g.id };
    if (canSearchDining()) return directDiningSearch(f, g.id);
    rsPending = f;
    return showPrompt(diningPrompt(trip, f), `搜尋${g.area}附近的餐廳`, "dining");
  }
  if (!flightEditable()) return;
  if (act === "remove") {
    if (b.dataset.confirm !== "1") { b.dataset.confirm = "1"; b.textContent = "確認移除"; return; }
    trip.dining = { ...D, searches: D.searches.filter(x => x.id !== b.dataset.gid) };
    return persistTrip("已移除這組搜尋結果");
  }
  if (act === "choose") {
    const g = D.searches.find(x => x.id === b.dataset.gid); const r = g?.restaurants[+b.dataset.i]; if (!r) return;
    // 沒有指定哪一餐時，當天已有同一餐（例如晚餐）就取代那一餐，避免一天出現兩頓晚餐
    const matched = !g.slot && g.date && g.meal ? tripMeals(trip).find(m => m.date === g.date && m.meal === g.meal) : null;
    const slot = g.slot || matched?.slot || "";
    const pick = { ...r, id: `dp-${Date.now().toString(36)}`, date: g.date, time: matched?.time || g.time, meal: g.meal, slot, booked: false };
    // 同一餐只留一家：同一個行程時段，或同一天同一時間
    const same = x => (slot && x.slot === slot) || (!slot && x.date === g.date && x.time === g.time);
    trip.dining = normalizeDining({ ...D, picks: [...D.picks.filter(x => !same(x)), pick] });
    applyDiningToPlan(trip);
    if (await persistTrip(g.slot || g.date ? "已選定餐廳，行程中的這一餐已更新" : "已選定餐廳")) $("#dining").scrollIntoView({ block: "start" });
    return;
  }
  if (act === "unpick") {
    trip.dining = { ...D, picks: D.picks.filter(x => x.id !== b.dataset.id) };
    applyDiningToPlan(trip);
    return persistTrip("已取消選擇；行程中的這一餐保留目前內容，可再為它選其他餐廳");
  }
  if (act === "booked") {
    trip.dining = { ...D, picks: D.picks.map(x => x.id === b.dataset.id ? { ...x, booked: !x.booked } : x) };
    applyDiningToPlan(trip);
    return persistTrip(D.picks.find(x => x.id === b.dataset.id)?.booked ? "已改為尚未訂位" : "已標示已訂位");
  }
  if (act === "conf") {
    store.set(`rb.diningconf.${trip.id}.${b.dataset.id}`, ($(`#rsConf-${b.dataset.id}`)?.value || "").trim());
    return toast("訂位確認碼已存在這台電腦");
  }
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
// 頂列選單（匯出、版面風格）：選了項目、點選單以外的地方或按 Esc 就收起來；同時只開一個
const menus = [...document.querySelectorAll(".top details.menu")];
menus.forEach(m => {
  m.querySelector(".menu-list").addEventListener("click", e => { if (e.target.closest("button")) m.open = false; });
  m.addEventListener("toggle", () => { if (m.open) menus.forEach(o => { if (o !== m) o.open = false; }); });
});
document.addEventListener("click", e => menus.forEach(m => { if (m.open && !m.contains(e.target)) m.open = false; }));
document.addEventListener("keydown", e => {
  if (e.key !== "Escape") return;
  menus.forEach(m => { if (m.open) { m.open = false; m.querySelector("summary").focus(); } });
});

/* ---------- 版面風格 ---------- */
const STYLES_UI = [
  { key: "route", name: "航線", desc: "清爽的青綠與琥珀色，隨系統切換深淺色", sw: ["#0d5a6b", "#d99a12", "#eef2f1", "#ffffff"] },
  { key: "notebook", name: "旅行手帳", desc: "紙張、藏青墨色與郵戳紅，明朝體標題", sw: ["#10233f", "#b23a2e", "#f3eedd", "#ad8a2e"] },
  { key: "board", name: "機場看板", desc: "深色底與翻牌看板黃，方角等寬字", sw: ["#0b0f14", "#f5b301", "#121922", "#e8edf2"] },
];
function currentStyle() { return document.documentElement.dataset.style || "route"; }
function renderStyleList() {
  const cur = currentStyle();
  $("#styleList").innerHTML = STYLES_UI.map(x => `<button class="btn style-opt" type="button" role="menuitemradio" aria-checked="${x.key === cur}" data-style-key="${x.key}">
    <span class="sw" aria-hidden="true">${x.sw.map(c => `<i style="background:${c}"></i>`).join("")}</span><b>${esc(x.name)}</b><small>${esc(x.desc)}</small></button>`).join("");
}
$("#styleList").addEventListener("click", e => {
  const b = e.target.closest("[data-style-key]"); if (!b) return;
  document.documentElement.dataset.style = b.dataset.styleKey;
  // 存純文字（不經 store 的 JSON），index.html 開頭的腳本才能直接讀
  try { localStorage.setItem("rb.style", b.dataset.styleKey); } catch {}
  renderStyleList();
});
renderStyleList();

/* ---------- 啟動 ---------- */
$("#appVersion").textContent = "v" + window.RB_VERSION;
const underClaudeFlow = location.pathname.startsWith("/travel/") || !!document.getElementById("cf-gate-style");
// 在 Claude Flow 的 /travel/ 底下執行時，顯示回 Claude Flow 首頁的連結；本機預覽時不顯示。
if (underClaudeFlow) $("#cfHome").hidden = false;

/** 等 Claude Flow 的登入檢查提供雲端介面；它的程式比這裡晚執行，所以先檢查、沒有再等事件 */
function waitForCloud(ms) {
  return new Promise(resolve => {
    if (window.ClaudeFlowTravel) return resolve(window.ClaudeFlowTravel);
    const timer = setTimeout(() => resolve(null), ms);
    window.addEventListener("claudeflow:travel-ready", e => { clearTimeout(timer); resolve(e.detail || window.ClaudeFlowTravel || null); }, { once: true });
  });
}
function openLastLocal() {
  const curId = store.get("rb.current", "");
  if (curId && !curId.startsWith("cloud:") && openLocalTrip(curId)) return;
  openSample();
}

(async () => {
  // 先記下連結與上次開啟的行程：等待雲端時的暫時畫面不能改動它們
  const fromHash = hashTripId();
  const last = store.get("rb.current", "");
  if (!underClaudeFlow) { try { openLastLocal(); } catch { openSample(); } return; }
  // 暫時畫面（頁面在登入檢查通過前是隱藏的）：只顯示，不改網址與紀錄
  const localLast = !last.startsWith("cloud:") && store.get("rb.trips", []).find(x => x.id === last);
  try { show(normalize(localLast ? localLast.data : window.RB_SAMPLE), { source: localLast ? "local" : "sample" }); } catch { show(normalize(window.RB_SAMPLE), { source: "sample" }); }
  // 登入檢查要等登入狀態與使用者資料，給足時間；逾時就以本機模式繼續
  cloud = await waitForCloud(30000);
  if (!cloud) { toast("無法連線到 Claude Flow，行程只會存在這台電腦"); return; }
  if (fromHash) { if (!(await openCloudTrip(fromHash))) openLastLocal(); }
  else if (last.startsWith("cloud:")) { if (!(await openCloudTrip(last.slice(6)))) openSample(); }
  else show(trip, meta); // 重新整理分享列（本機行程顯示「存到雲端」）
  window.addEventListener("hashchange", () => {
    const id = hashTripId();
    if (id && id !== meta.id) openCloudTrip(id);
  });
})();
})();
