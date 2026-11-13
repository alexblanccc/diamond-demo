const STAGES = [
  { k: "new", l: "Новая", c: "#f5b301" },
  { k: "contacted", l: "Связались", c: "#3b82f6" },
  { k: "booked", l: "Записан", c: "#0e9f9a" },
  { k: "came", l: "Пришёл", c: "#7c3aed" },
  { k: "paid", l: "Оплачено", c: "#16a34a" },
  { k: "no_show", l: "Не пришёл", c: "#9ca3af" },
  { k: "cancelled", l: "Отказ", c: "#e5484d" },
];
const STAGE = Object.fromEntries(STAGES.map((s) => [s.k, s]));
const FUNNEL = ["new", "contacted", "booked", "came", "paid"];
const SOURCE_L = { site: "Сайт", whatsapp: "WhatsApp", phone: "Звонок", instagram: "Instagram", "2gis": "2ГИС", walkin: "Пришёл сам", referral: "По рекомендации", other: "Другое" };
const WA_DEFAULT = {
  confirm: "Здравствуйте, {name}! Это клиника Diamond. Подтверждаем вашу запись{when}. Адрес: {address}. Если планы изменятся, напишите нам, пожалуйста.",
  remind: "Здравствуйте, {name}! Напоминаем о приёме в клинике Diamond{when}. Ждём вас по адресу {address}.",
  noanswer: "Здравствуйте, {name}! Это клиника Diamond, вы оставляли заявку{service}. Не смогли до вас дозвониться. Когда вам удобно поговорить?",
  review: "{name}, спасибо, что выбрали Diamond! Будем очень благодарны за отзыв в 2ГИС, это займёт минуту: {review_link}",
};
const WA_LABEL = { confirm: "Подтвердить запись", remind: "Напомнить о приёме", noanswer: "Не дозвонились", review: "Попросить отзыв" };

(function injectCrmStyles() {
  const css = `
  .kanban{display:grid;grid-auto-flow:column;grid-auto-columns:minmax(180px,1fr);gap:12px;overflow-x:auto;padding-bottom:12px;align-items:start}
  .kcol{background:#eaf2f2;border-radius:14px;padding:10px;min-height:120px;transition:background .15s,outline-color .15s;outline:2px dashed transparent}
  .kcol.over{background:#dff3f1;outline-color:var(--teal)}
  .kcol-head{display:flex;align-items:center;gap:8px;margin:2px 4px 10px;font-weight:700;font-size:14px}
  .kcol-head i{width:10px;height:10px;border-radius:50%}
  .kcol-head span{margin-left:auto;color:var(--muted);font-weight:600;font-size:12px}
  .kcol-sum{font-size:12px;color:var(--muted);margin:-6px 4px 8px}
  .kcard{background:#fff;border-radius:12px;padding:10px 12px;margin-bottom:8px;box-shadow:0 1px 2px rgba(0,0,0,.06);border-left:4px solid var(--c);cursor:pointer;transition:transform .15s,box-shadow .15s;display:grid;gap:3px}
  .kcard:hover{box-shadow:0 6px 16px rgba(10,60,60,.12);transform:translateY(-1px)}
  .kcard.dragging{opacity:.5}
  .kcard b{font-size:14px;display:flex;gap:6px;align-items:center}
  .kcard b .late{width:8px;height:8px;border-radius:50%;background:var(--sos);flex:none}
  .kcard small{color:var(--muted);font-size:12px;line-height:1.35}
  .kcard .kmeta{display:flex;gap:6px;flex-wrap:wrap;align-items:center;margin-top:2px}
  .kchip{font-size:11px;font-weight:700;background:var(--alt);color:var(--teal-d);border-radius:999px;padding:1px 8px}
  .kchip.money{background:#e7f8ec;color:#137a3b}
  .kempty{color:var(--muted);font-size:12px;text-align:center;padding:14px 4px}
  .kmore{width:100%;border:1.5px dashed var(--line);background:transparent;border-radius:10px;padding:8px;color:var(--muted);font-size:13px}
  .toolbar{display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-bottom:12px}
  .toolbar input,.toolbar select{width:auto;padding:7px 10px}
  .toolbar .grow{flex:1}
  .drawer{position:fixed;inset:0;z-index:80;background:rgba(6,25,26,0);pointer-events:none;transition:background .25s}
  .drawer.open{background:rgba(6,25,26,.35);pointer-events:auto}
  .dw{position:absolute;top:0;right:0;bottom:0;width:min(480px,100%);background:#fff;box-shadow:-20px 0 60px rgba(0,0,0,.18);transform:translateX(100%);transition:transform .28s cubic-bezier(.2,.7,.2,1);display:flex;flex-direction:column}
  .drawer.open .dw{transform:none}
  .dw-head{padding:16px 18px 12px;border-bottom:1px solid var(--line);display:grid;gap:8px}
  .dw-top{display:flex;align-items:center;gap:10px}
  .dw-top h2{margin:0;font-size:19px;flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  .dw-x{border:0;background:var(--alt);width:34px;height:34px;border-radius:50%;font-size:20px;line-height:1}
  .dw-sub{color:var(--muted);font-size:13px}
  .dw-acts{display:flex;gap:6px;flex-wrap:wrap}
  .dw-acts a,.dw-acts button{text-decoration:none}
  .dw-body{flex:1;overflow:auto;padding:14px 18px 20px;display:grid;gap:16px;align-content:start}
  .dw-sec h4{margin:0 0 8px;font-size:12px;text-transform:uppercase;letter-spacing:.06em;color:var(--muted)}
  .stages{display:flex;gap:4px;flex-wrap:wrap}
  .stg{border:1.5px solid var(--line);background:#fff;border-radius:999px;padding:5px 11px;font-size:13px;font-weight:600;color:var(--ink)}
  .stg.on{background:var(--c);border-color:var(--c);color:#fff}
  .dw-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}
  .dw-grid .wide{grid-column:1 / -1}
  .dw-foot{padding:12px 18px;border-top:1px solid var(--line);display:flex;gap:8px;align-items:center}
  .dw-foot .grow{flex:1}
  .wa-tpl{display:grid;gap:6px}
  .wa-tpl a{display:flex;justify-content:space-between;align-items:center;text-decoration:none}
  .note{background:#fffbea;border:1px solid #f4e3a1;border-radius:10px;padding:8px 10px;font-size:14px;white-space:pre-wrap}
  .note small,.hist small{display:block;color:var(--muted);font-size:11px;margin-bottom:2px}
  .hist{display:grid;gap:6px;font-size:13px}
  .hist div{padding-left:12px;border-left:2px solid var(--line)}
  .fhint{font-size:12px;color:var(--warn);margin-top:2px}
  .btable{width:100%;border-collapse:collapse}
  .btable th{font-size:11px;text-transform:uppercase;letter-spacing:.05em;color:var(--muted);text-align:left;padding:8px;border-bottom:1px solid var(--line)}
  .btable td{padding:10px 8px;border-bottom:1px solid var(--line);vertical-align:top;font-size:14px}
  .btable tr{cursor:pointer}
  .btable tr:hover td{background:#f6fbfb}
  .btable td small{display:block;color:var(--muted);font-size:12px}
  .stchip{display:inline-flex;align-items:center;gap:6px;font-size:12px;font-weight:700;border-radius:999px;padding:2px 10px;background:color-mix(in srgb,var(--c) 14%,#fff);color:color-mix(in srgb,var(--c) 75%,#000)}
  .stchip i{width:7px;height:7px;border-radius:50%;background:var(--c)}
  .stats-kpis{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:16px}
  .skpi{background:#fff;border:1px solid var(--line);border-radius:16px;padding:14px 16px}
  .skpi b{display:block;font-size:24px;line-height:1.15}
  .skpi span{font-size:13px;color:var(--muted)}
  .skpi em{font-style:normal;font-size:12px;color:var(--teal-d);font-weight:700}
  .funnel{display:grid;gap:8px}
  .fn-row{display:grid;grid-template-columns:110px 1fr 90px;gap:10px;align-items:center;font-size:14px}
  .fn-bar{height:26px;border-radius:8px;background:var(--alt);overflow:hidden}
  .fn-bar i{display:block;height:100%;border-radius:8px;background:var(--c);min-width:2px;transition:width .5s}
  .fn-row span:last-child{text-align:right;color:var(--muted);font-size:13px}
  .chart{display:flex;align-items:flex-end;gap:3px;height:150px;padding-top:10px}
  .chart div{flex:1;display:flex;flex-direction:column;justify-content:flex-end;gap:2px;min-width:4px;position:relative}
  .chart i{display:block;border-radius:3px 3px 0 0;background:#9edbd6}
  .chart i.p{background:#16a34a}
  .chart-x{display:flex;justify-content:space-between;color:var(--muted);font-size:11px;margin-top:4px}
  .legend2{display:flex;gap:14px;font-size:12px;color:var(--muted);margin-top:6px}
  .legend2 i{display:inline-block;width:10px;height:10px;border-radius:2px;margin-right:5px;vertical-align:-1px}
  .grid2{display:grid;grid-template-columns:1fr 1fr;gap:16px}
  .stable{width:100%;border-collapse:collapse;font-size:14px}
  .stable td,.stable th{padding:7px 6px;border-bottom:1px solid var(--line);text-align:left}
  .stable th{font-size:11px;color:var(--muted);text-transform:uppercase}
  .stable td:not(:first-child),.stable th:not(:first-child){text-align:right}
  .intg{display:grid;gap:16px}
  .intg .box p{margin:6px 0}
  .intg ol{margin:6px 0;padding-left:20px;font-size:14px;color:#2a4a4c}
  .state{display:inline-flex;gap:6px;align-items:center;font-size:13px;font-weight:700;border-radius:999px;padding:3px 10px}
  .state.on{background:#e7f8ec;color:#137a3b}.state.off{background:#eceff0;color:#6b7b7c}
  .code{background:#0f2c2d;color:#cfe7e5;border-radius:10px;padding:10px 12px;font:12px/1.5 ui-monospace,Menlo,monospace;white-space:pre-wrap;overflow:auto}
  .wlist{display:grid;gap:8px}
  .witem{display:flex;gap:10px;align-items:center;justify-content:space-between;padding:8px 4px;border-bottom:1px solid var(--line);flex-wrap:wrap}
  .witem:last-child{border-bottom:0}
  .witem b{display:block}
  .witem small{color:var(--muted);font-size:12px}
  .witem .late{color:var(--sos);font-weight:700}
  @media(max-width:900px){
    .stats-kpis{grid-template-columns:1fr 1fr}
    .grid2{grid-template-columns:1fr}
    .kanban{grid-auto-columns:80%}
    .dw-grid{grid-template-columns:1fr}
    .btable thead{display:none}
    .btable,.btable tbody,.btable tr,.btable td{display:block}
    .btable tr{border-bottom:1px solid var(--line);padding:8px 0}
    .btable td{border:0;padding:2px 4px}
    .fn-row{grid-template-columns:90px 1fr 70px}
  }`;
  const st = document.createElement("style");
  st.textContent = css;
  document.head.appendChild(st);
})();

const money = (n) => (+n || 0).toLocaleString("ru-RU").replace(/,/g, " ") + " ₸";
const tsOf = (s) => { const d = new Date(String(s || "").replace(" ", "T")); return isNaN(d) ? null : d; };
function ago(s) {
  const d = tsOf(s); if (!d) return "";
  const m = Math.round((Date.now() - d) / 60000);
  if (m < 1) return "только что";
  if (m < 60) return `${m} мин назад`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} ч назад`;
  const dd = Math.round(h / 24);
  return `${dd} дн назад`;
}
function whenOf(b) {
  if (b.day) {
    const d = new Date(b.day + "T00:00");
    return `${d.getDate()} ${MON[d.getMonth()]}${b.time ? ", " + b.time : ""}`;
  }
  return b.date || "время не выбрано";
}
function stChip(k) { const s = STAGE[k] || STAGE.new; return `<span class="stchip" style="--c:${s.c}"><i></i>${s.l}</span>`; }
function digitsOf(p) { return String(p || "").replace(/\D/g, ""); }
function isLate(b) { const d = tsOf(b.created); return b.status === "new" && d && Date.now() - d > 3600e3; }
function reachedIndex(b) {
  const idx = (k) => FUNNEL.indexOf(k);
  let max = idx(b.status);
  (b.history || []).forEach((h) => { max = Math.max(max, idx(h.to)); });
  if (b.status === "no_show") max = Math.max(max, idx("booked"));
  return max;
}
function firstResponseMin(b) {
  const h = (b.history || []).find((x) => x.from === "new");
  const a = tsOf(b.created); const z = h && tsOf(h.at);
  return a && z ? Math.max(0, Math.round((z - a) / 60000)) : null;
}
function paidAt(b) { const h = [...(b.history || [])].reverse().find((x) => x.to === "paid"); return h ? h.at : b.updated || b.created; }
function waTemplates() { return { ...WA_DEFAULT, ...((site.settings || {}).waTemplates || {}) }; }
function waText(key, b) {
  const s = site.settings || {};
  const w = b.day ? ` на ${whenOf(b)}` : b.date ? ` на ${b.date}` : "";
  const review = `https://2gis.kz/pavlodar/firm/${s.firmId}/tab/reviews`;
  return waTemplates()[key]
    .replace(/\{name\}/g, (b.name || "").split(" ")[0])
    .replace(/\{when\}/g, w)
    .replace(/\{service\}/g, b.service ? ` на «${b.service}»` : "")
    .replace(/\{address\}/g, s.address || "")
    .replace(/\{review_link\}/g, review);
}
function waHref(b, key) { const d = digitsOf(b.phone); return d ? `https://wa.me/${d}?text=${encodeURIComponent(waText(key, b))}` : ""; }

async function refreshBookings() { await loadBookings(); renderNav(); }
function patchLocal(item) {
  const i = bookings.findIndex((x) => x.id === item.id);
  if (i >= 0) bookings[i] = item; else bookings.unshift(item);
}
async function setStage(id, status) {
  const r = await api("/api/admin/status", { id, status });
  if (r.item) patchLocal(r.item);
  renderNav();
  return r.item;
}

function renderHome() {
  const t = todayIso();
  const tmr = isoLocal(new Date(Date.now() + 864e5));
  const fresh = bookings.filter((b) => b.status === "new").sort((a, b) => a.id - b.id);
  const today = bookings.filter((b) => b.day === t && ["booked", "contacted", "new"].includes(b.status));
  const tomorrow = bookings.filter((b) => b.day === tmr && ["booked", "contacted", "new"].includes(b.status)).sort((a, b) => String(a.time).localeCompare(String(b.time)));
  const since = Date.now() - 30 * 864e5;
  const paid30 = bookings.filter((b) => b.status === "paid" && (tsOf(paidAt(b)) || 0) >= since);
  const rev30 = paid30.reduce((s, b) => s + (+b.amount || 0), 0);
  const revOn = (site.reviews || []).filter((r) => reviewTags(r)[0][0] === "ok").length;
  $("pageActions").innerHTML = `<button class="pri" id="newLead">+ Заявка</button>`;
  $("newLead").onclick = () => openLead(null);
  $("main").innerHTML = `
    <div class="kpis">
      <div class="kpi ${fresh.length ? "hot" : ""}"><b>${fresh.length}</b><span>новых заявок ждут ответа</span>${fresh.length ? `<button class="sec sm" data-go="pipeline">В воронку</button>` : ""}</div>
      <div class="kpi"><b>${today.length}</b><span>на приём сегодня</span></div>
      <div class="kpi"><b>${tomorrow.length}</b><span>на приём завтра</span></div>
      <div class="kpi"><b>${money(rev30)}</b><span>оплачено за 30 дней · ${paid30.length} пациентов</span><button class="sec sm" data-go="stats">Статистика</button></div>
    </div>
    <div class="two-col">
      <section class="box"><h3>Ждут ответа</h3>
        ${fresh.length ? `<div class="wlist">${fresh.slice(0, 8).map((b) => `<div class="witem"><div><b>${esc(b.name)}</b><small>${esc(b.service || "консультация")} · ${esc(whenOf(b))} · <span class="${isLate(b) ? "late" : ""}">${ago(b.created)}</span></small></div><div class="dw-acts">${digitsOf(b.phone) ? `<a class="sec sm" href="tel:+${digitsOf(b.phone)}">Позвонить</a>` : ""}<button class="sec sm" data-lead="${b.id}">Открыть</button></div></div>`).join("")}</div>` : `<div class="empty">Все заявки обработаны 👍</div>`}
      </section>
      <section class="box"><h3>Завтра на приём</h3>
        ${tomorrow.length ? `<div class="wlist">${tomorrow.map((b) => `<div class="witem"><div><b>${esc(b.time || "—")} · ${esc(b.name)}</b><small>${esc(b.service || "консультация")}${b.doctor ? " · " + esc(b.doctor) : ""}</small></div><div class="dw-acts">${waHref(b, "remind") ? `<a class="sec sm" href="${esc(waHref(b, "remind"))}" target="_blank" rel="noopener">Напомнить в WhatsApp</a>` : ""}<button class="sec sm" data-lead="${b.id}">Открыть</button></div></div>`).join("")}</div>` : `<div class="empty">На завтра записей нет</div>`}
        <h3 style="margin-top:18px">Быстрые действия</h3>
        <div class="quick">
          <button class="sec" data-go="reviews" data-paste="1">Добавить отзывы из 2ГИС (на сайте ${revOn}) <span>→</span></button>
          <button class="sec" data-go="schedule">Закрыть время в расписании <span>→</span></button>
          <button class="sec" data-go="integrations">Telegram и WhatsApp <span>→</span></button>
        </div>
      </section>
    </div>`;
  bindLeadOpeners();
  $("main").querySelectorAll("[data-go]").forEach((b) => { if (!allowedTab(b.dataset.go)) b.remove(); });
  $("main").querySelectorAll("[data-go]").forEach((b) => b.onclick = () => { if (b.dataset.paste) go.paste = true; go(b.dataset.go); });
}

function bindLeadOpeners(root) {
  (root || $("main")).querySelectorAll("[data-lead]").forEach((el) => el.addEventListener("click", (e) => {
    if (e.target.closest("a")) return;
    openLead(+el.dataset.lead);
  }));
}

let pipeQuery = "";
let showLost = false;
function renderPipeline() {
  $("pageActions").innerHTML = `<button class="pri" id="newLead">+ Заявка</button>`;
  $("newLead").onclick = () => openLead(null);
  const q = pipeQuery.toLowerCase();
  const match = (b) => !q || (b.name + " " + b.phone + " " + b.service + " " + (b.doctor || "")).toLowerCase().includes(q);
  const cols = ["new", "contacted", "booked", "came", "paid"].concat(showLost ? ["no_show", "cancelled"] : []);
  const lostCount = bookings.filter((b) => ["no_show", "cancelled"].includes(b.status)).length;
  const card = (b) => {
    const s = STAGE[b.status];
    return `<div class="kcard" draggable="true" data-lead="${b.id}" style="--c:${s.c}">
      <b>${isLate(b) ? `<span class="late" title="Ждёт ответа больше часа"></span>` : ""}${esc(b.name)}</b>
      <small>${esc(b.service || "консультация")}</small>
      <small>${esc(whenOf(b))}${b.doctor ? " · " + esc(b.doctor.split(" ")[0]) : ""}</small>
      <div class="kmeta"><span class="kchip">${esc(SOURCE_L[b.source] || b.source)}</span>${+b.amount ? `<span class="kchip money">${money(b.amount)}</span>` : ""}<small>${ago(b.created)}</small></div>
    </div>`;
  };
  $("main").innerHTML = `
    <div class="toolbar"><input id="pq" placeholder="Поиск: имя, телефон, услуга, врач" value="${esc(pipeQuery)}"><span class="grow"></span>
      <button class="sec sm" id="toggleLost">${showLost ? "Скрыть" : "Показать"} отказы и неявки (${lostCount})</button></div>
    <p class="hint lead">Перетаскивайте карточки между колонками, на телефоне откройте карточку и смените этап. Красная точка: заявка ждёт ответа больше часа.</p>
    <div class="kanban">${cols.map((k) => {
      const list = bookings.filter((b) => b.status === k && match(b)).sort((a, b) => b.id - a.id);
      const sum = list.reduce((s, b) => s + (+b.amount || 0), 0);
      return `<div class="kcol" data-col="${k}"><div class="kcol-head"><i style="background:${STAGE[k].c}"></i>${STAGE[k].l}<span>${list.length}</span></div>
        ${sum ? `<div class="kcol-sum">${money(sum)}</div>` : ""}
        ${list.slice(0, 40).map(card).join("") || `<div class="kempty">Пусто</div>`}
        ${list.length > 40 ? `<div class="kempty">и ещё ${list.length - 40}, найдите через поиск</div>` : ""}
      </div>`;
    }).join("")}</div>`;
  const qi = $("pq");
  qi.oninput = () => { pipeQuery = qi.value; const p = qi.selectionStart; renderPipeline(); const n = $("pq"); n.focus(); n.setSelectionRange(p, p); };
  $("toggleLost").onclick = () => { showLost = !showLost; renderPipeline(); };
  bindLeadOpeners();
  let dragId = null;
  $("main").querySelectorAll(".kcard").forEach((c) => {
    c.addEventListener("dragstart", (e) => { dragId = +c.dataset.lead; c.classList.add("dragging"); e.dataTransfer.effectAllowed = "move"; e.dataTransfer.setData("text/plain", c.dataset.lead); });
    c.addEventListener("dragend", () => c.classList.remove("dragging"));
  });
  $("main").querySelectorAll(".kcol").forEach((col) => {
    col.addEventListener("dragover", (e) => { e.preventDefault(); col.classList.add("over"); });
    col.addEventListener("dragleave", () => col.classList.remove("over"));
    col.addEventListener("drop", async (e) => {
      e.preventDefault(); col.classList.remove("over");
      const id = dragId || +e.dataTransfer.getData("text/plain");
      const b = bookings.find((x) => x.id === id);
      if (!b || b.status === col.dataset.col) return;
      try {
        const item = await setStage(id, col.dataset.col);
        toast(`${b.name}: ${STAGE[col.dataset.col].l}`);
        renderPipeline();
        if (col.dataset.col === "paid" && !(+item.amount)) { openLead(id, { focusAmount: true }); }
      } catch (err) { toast(err.message); }
    });
  });
}

let bkFilter = "all";
let bkQuery = "";
async function renderBookings() {
  $("pageActions").innerHTML = `<button class="sec" id="exportCsv">Выгрузить в Excel</button><button class="sec" id="reload">Обновить</button><button class="pri" id="newLead">+ Заявка</button>`;
  $("reload").onclick = async () => { await refreshBookings(); renderBookings(); toast("Обновлено"); };
  $("newLead").onclick = () => openLead(null);
  const count = (s) => bookings.filter((b) => s === "all" || b.status === s).length;
  const q = bkQuery.toLowerCase();
  const list = bookings.filter((b) => (bkFilter === "all" || b.status === bkFilter) && (!q || (b.name + " " + b.phone + " " + b.service + " " + (b.doctor || "")).toLowerCase().includes(q)));
  $("exportCsv").onclick = () => exportCsv(list, "zayavki");
  $("main").innerHTML = `<section class="box">
    <div class="filters">${[["all", "Все"], ...STAGES.map((s) => [s.k, s.l])].map(([k, l]) => `<button class="chipf ${bkFilter === k ? "on" : ""}" data-f="${k}">${l}<i>${count(k)}</i></button>`).join("")}
      <input id="bkq" placeholder="Поиск: имя, телефон, услуга, врач" value="${esc(bkQuery)}"></div>
    ${list.length ? `<table class="btable"><thead><tr><th>Пациент</th><th>Услуга</th><th>Когда</th><th>Источник</th><th>Сумма</th><th>Этап</th></tr></thead><tbody>
      ${list.map((b) => `<tr data-lead="${b.id}">
        <td><b>${esc(b.name)}</b><small>${esc(b.phone || "без телефона")} · ${ago(b.created)}</small></td>
        <td>${esc(b.service || "консультация")}${b.doctor ? `<small>${esc(b.doctor)}</small>` : ""}</td>
        <td>${esc(whenOf(b))}</td>
        <td>${esc(SOURCE_L[b.source] || b.source)}</td>
        <td>${+b.amount ? money(b.amount) : "—"}</td>
        <td>${stChip(b.status)}</td></tr>`).join("")}
    </tbody></table>` : `<div class="empty">${bookings.length ? "Ничего не нашлось" : "Заявок пока нет"}</div>`}
  </section>`;
  $("main").querySelectorAll(".chipf").forEach((b) => b.onclick = () => { bkFilter = b.dataset.f; renderBookings(); });
  const qi = $("bkq");
  qi.oninput = () => { bkQuery = qi.value; const p = qi.selectionStart; renderBookings(); const n = $("bkq"); n.focus(); n.setSelectionRange(p, p); };
  bindLeadOpeners();
}

function exportCsv(list, name) {
  api("/api/admin/export", { what: `${name}: ${list.length}` }).catch(() => {});
  const head = ["Дата заявки", "Имя", "Телефон", "Услуга", "Врач", "Когда", "Источник", "Этап", "Сумма, тг", "Комментарий", "Заметки"];
  const rows = list.map((b) => [b.created, b.name, b.phone, b.service, b.doctor, whenOf(b), SOURCE_L[b.source] || b.source, (STAGE[b.status] || {}).l, +b.amount || 0, b.comment, (b.notes || []).map((n) => n.at + ": " + n.text).join(" | ")]);
  const csv = "﻿" + [head, ...rows].map((r) => r.map((v) => `"${String(v ?? "").replace(/"/g, '""')}"`).join(";")).join("\r\n");
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  a.download = `${name}-${todayIso()}.csv`;
  document.body.appendChild(a); a.click(); a.remove();
  toast(`Выгружено строк: ${list.length}`);
}

let drawerEl = null;
function ensureDrawer() {
  if (drawerEl) return drawerEl;
  drawerEl = document.createElement("div");
  drawerEl.className = "drawer";
  drawerEl.innerHTML = `<div class="dw" role="dialog" aria-modal="true"></div>`;
  document.body.appendChild(drawerEl);
  drawerEl.addEventListener("click", (e) => { if (e.target === drawerEl) closeLead(); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && drawerEl.classList.contains("open")) closeLead(); });
  return drawerEl;
}
function closeLead() { if (drawerEl) drawerEl.classList.remove("open"); }

function openLead(id, opts = {}) {
  const dr = ensureDrawer();
  const b = id ? bookings.find((x) => x.id === id) : { id: null, name: "", phone: "", service: "", doctor: "", source: "phone", status: "new", amount: 0, day: "", time: "", comment: "", notes: [], history: [] };
  if (!b) return;
  const isNew = !b.id;
  const services = (site.services || []).map((s) => s.title);
  const doctors = (site.doctors || []).filter((d) => !d.hidden).map((d) => d.name);
  const opt = (arr, cur, empty) => `${empty !== undefined ? `<option value="">${empty}</option>` : ""}${[...new Set([...(cur && !arr.includes(cur) ? [cur] : []), ...arr])].map((v) => `<option ${v === cur ? "selected" : ""}>${esc(v)}</option>`).join("")}`;
  const d = digitsOf(b.phone);
  const tpls = Object.keys(WA_LABEL).filter((k) => k !== "review" || ["came", "paid"].includes(b.status));
  dr.querySelector(".dw").innerHTML = `
    <div class="dw-head">
      <div class="dw-top"><h2>${isNew ? "Новая заявка" : esc(b.name)}</h2><button class="dw-x" id="dwX" aria-label="Закрыть">×</button></div>
      ${isNew ? `<div class="dw-sub">Для звонков и визитов без заявки с сайта</div>` : `<div class="dw-sub">${stChip(b.status)} · заявка ${esc(b.created)} · ${esc(SOURCE_L[b.source] || b.source)}</div>
      <div class="dw-acts">${d ? `<a class="sec sm" href="tel:+${d}">📞 Позвонить</a><a class="sec sm" href="https://wa.me/${d}" target="_blank" rel="noopener">WhatsApp</a>` : `<span class="hint">Телефон не указан</span>`}</div>`}
    </div>
    <div class="dw-body">
      ${isNew ? "" : `<div class="dw-sec"><h4>Этап</h4><div class="stages">${STAGES.map((s) => `<button class="stg ${b.status === s.k ? "on" : ""}" style="--c:${s.c}" data-stg="${s.k}">${s.l}</button>`).join("")}</div></div>`}
      <div class="dw-sec"><h4>Данные</h4><div class="dw-grid">
        <label class="f"><span>Имя</span><input id="lf-name" value="${esc(b.name)}"></label>
        <label class="f"><span>Телефон</span><input id="lf-phone" value="${esc(b.phone)}" inputmode="tel" placeholder="+7 7__ ___ __ __"></label>
        <label class="f"><span>Услуга</span><select id="lf-service">${opt(services, b.service, "Консультация")}</select></label>
        <label class="f"><span>Врач</span><select id="lf-doctor">${opt(doctors, b.doctor, "Не назначен")}</select></label>
        <label class="f"><span>Дата приёма</span><input type="date" id="lf-day" value="${esc(b.day || "")}"></label>
        <label class="f"><span>Время</span><input id="lf-time" value="${esc(b.time || "")}" placeholder="например, 10:30"></label>
        <label class="f"><span>Источник</span><select id="lf-source">${Object.entries(SOURCE_L).map(([k, l]) => `<option value="${k}" ${b.source === k ? "selected" : ""}>${l}</option>`).join("")}</select></label>
        <label class="f"><span>Сумма оплаты, ₸</span><input id="lf-amount" inputmode="numeric" value="${+b.amount || ""}" placeholder="0">${opts.focusAmount ? `<span class="fhint">Укажите сумму, чтобы она попала в статистику</span>` : ""}</label>
        <label class="f wide"><span>Комментарий пациента</span><textarea id="lf-comment" rows="2">${esc(b.comment || "")}</textarea></label>
      </div></div>
      ${isNew ? "" : `
      <div class="dw-sec"><h4>Сообщение в WhatsApp</h4>${d ? `<div class="wa-tpl">${tpls.map((k) => `<a class="sec" href="${esc(waHref(b, k))}" target="_blank" rel="noopener">${WA_LABEL[k]} <span>↗</span></a>`).join("")}</div><p class="hint" style="margin:6px 0 0">Откроется чат с готовым текстом, его можно поправить перед отправкой. Тексты меняются в «Интеграциях».</p>` : `<p class="hint">Добавьте телефон, чтобы писать в WhatsApp</p>`}</div>
      <div class="dw-sec"><h4>Заметки</h4>
        ${(b.notes || []).slice().reverse().map((n) => `<div class="note"><small>${esc(n.at)}</small>${esc(n.text)}</div>`).join("") || `<p class="hint" style="margin:0 0 6px">Заметок пока нет</p>`}
        <textarea id="lf-note" rows="2" placeholder="Например: перезвонить в пятницу после 18:00" style="margin-top:6px"></textarea>
        <button class="sec sm" id="addNote" style="margin-top:6px">Добавить заметку</button>
      </div>
      <div class="dw-sec"><h4>История</h4><div class="hist">${(b.history || []).slice().reverse().map((h) => `<div><small>${esc(h.at)} · ${h.by === "telegram" ? "из Telegram" : h.by === "admin" ? "админка" : "сайт"}</small>${h.from ? `${esc((STAGE[h.from] || {}).l || h.from)} → ` : ""}<b>${esc((STAGE[h.to] || {}).l || h.to)}</b></div>`).join("")}</div></div>`}
    </div>
    <div class="dw-foot">${isNew ? "" : `<button class="del sm" id="delLead">Удалить</button>`}<span class="grow"></span><button class="sec" id="dwCancel">Закрыть</button><button class="pri" id="saveLead">${isNew ? "Создать" : "Сохранить"}</button></div>`;
  dr.classList.add("open");
  const v = (k) => $("lf-" + k).value;
  const collect = () => ({ name: v("name"), phone: v("phone"), service: v("service"), doctor: v("doctor"), day: v("day"), time: v("time").trim(), source: v("source"), amount: v("amount") || 0, comment: v("comment") });
  const save = async (extra = {}) => {
    try {
      const r = await api("/api/admin/booking", { id: b.id || undefined, ...collect(), ...extra });
      patchLocal(r.item); renderNav(); render();
      toast(isNew ? "Заявка создана" : "Сохранено");
      openLead(r.item.id);
      return r.item;
    } catch (e) { toast(e.message); return null; }
  };
  $("dwX").onclick = closeLead;
  $("dwCancel").onclick = closeLead;
  $("saveLead").onclick = () => save();
  if (!isNew) {
    dr.querySelectorAll("[data-stg]").forEach((s) => s.onclick = async () => {
      const st = s.dataset.stg;
      const item = await save({ status: st });
      if (item && st === "paid" && !(+item.amount)) openLead(item.id, { focusAmount: true });
    });
    $("addNote").onclick = async () => { const t = $("lf-note").value.trim(); if (!t) return; await save({ note: t }); };
    $("delLead").onclick = async () => {
      if (!confirm(`Удалить заявку «${b.name}» навсегда? Лучше поставить этап «Отказ», чтобы она осталась в статистике.`)) return;
      await api("/api/admin/booking/delete", { id: b.id });
      bookings = bookings.filter((x) => x.id !== b.id);
      closeLead(); renderNav(); render(); toast("Заявка удалена");
    };
  }
  setTimeout(() => { const el = opts.focusAmount ? $("lf-amount") : isNew ? $("lf-name") : null; if (el) el.focus(); }, 300);
}

let statPeriod = 30;
function renderStats() {
  $("pageActions").innerHTML = `<select id="period" style="width:auto;padding:7px 10px">${[[7, "7 дней"], [30, "30 дней"], [90, "3 месяца"], [365, "Год"], [0, "Всё время"]].map(([d, l]) => `<option value="${d}" ${statPeriod === d ? "selected" : ""}>${l}</option>`).join("")}</select><button class="sec" id="exportStat">Выгрузить заявки</button>`;
  $("period").onchange = (e) => { statPeriod = +e.target.value; renderStats(); };
  const from = statPeriod ? Date.now() - statPeriod * 864e5 : 0;
  const leads = bookings.filter((b) => (tsOf(b.created) || 0) >= from);
  $("exportStat").onclick = () => exportCsv(leads, "statistika");
  const paid = bookings.filter((b) => b.status === "paid" && (tsOf(paidAt(b)) || 0) >= from);
  const revenue = paid.reduce((s, b) => s + (+b.amount || 0), 0);
  const handled = leads.filter((b) => b.status !== "new").length;
  const reach = (k) => leads.filter((b) => reachedIndex(b) >= FUNNEL.indexOf(k)).length;
  const resp = leads.map(firstResponseMin).filter((x) => x !== null);
  const avgResp = resp.length ? Math.round(resp.reduce((a, b) => a + b, 0) / resp.length) : null;
  const pct = (a, b) => (b ? Math.round((a / b) * 100) : 0);
  const lost = leads.filter((b) => b.status === "cancelled").length;
  const noshow = leads.filter((b) => b.status === "no_show").length;
  const respStr = avgResp === null ? "—" : avgResp < 60 ? `${avgResp} мин` : `${Math.round(avgResp / 6) / 10} ч`;
  const group = (keyFn) => {
    const m = {};
    leads.forEach((b) => { const k = keyFn(b) || "—"; m[k] = m[k] || { n: 0, paid: 0, sum: 0 }; m[k].n++; if (b.status === "paid") { m[k].paid++; m[k].sum += +b.amount || 0; } });
    return Object.entries(m).sort((a, b) => b[1].sum - a[1].sum || b[1].n - a[1].n);
  };
  const days = statPeriod && statPeriod <= 90 ? statPeriod : 30;
  const chartFrom = new Date(); chartFrom.setHours(0, 0, 0, 0); chartFrom.setDate(chartFrom.getDate() - days + 1);
  const series = [];
  for (let i = 0; i < days; i++) {
    const d = new Date(chartFrom); d.setDate(d.getDate() + i);
    const iso = isoLocal(d);
    series.push({ iso, n: bookings.filter((b) => String(b.created).startsWith(iso)).length, p: bookings.filter((b) => b.status === "paid" && String(paidAt(b)).startsWith(iso)).length });
  }
  const maxV = Math.max(1, ...series.map((s) => s.n + s.p));
  const table = (rows, label) => `<table class="stable"><thead><tr><th>${label}</th><th>Заявок</th><th>Оплат</th><th>Выручка</th></tr></thead><tbody>${rows.map(([k, v]) => `<tr><td>${esc(k)}</td><td>${v.n}</td><td>${v.paid}</td><td>${v.sum ? money(v.sum) : "—"}</td></tr>`).join("") || `<tr><td colspan="4" class="hint">Нет данных</td></tr>`}</tbody></table>`;
  $("main").innerHTML = `
    <div class="stats-kpis">
      <div class="skpi"><b>${leads.length}</b><span>заявок</span></div>
      <div class="skpi"><b>${pct(handled, leads.length)}%</b><span>обработано · ответ в среднем за ${respStr}</span></div>
      <div class="skpi"><b>${pct(reach("paid"), leads.length)}%</b><span>конверсия заявка → оплата</span></div>
      <div class="skpi"><b>${money(revenue)}</b><span>выручка · ${paid.length} оплат · средний чек ${paid.length ? money(Math.round(revenue / paid.length)) : "—"}</span></div>
    </div>
    <div class="grid2">
      <section class="box"><h3>Воронка</h3><div class="funnel">${FUNNEL.map((k) => { const n = reach(k); return `<div class="fn-row"><span>${STAGE[k].l}</span><div class="fn-bar"><i style="width:${pct(n, leads.length)}%;--c:${STAGE[k].c};background:${STAGE[k].c}"></i></div><span>${n} · ${pct(n, leads.length)}%</span></div>`; }).join("")}</div>
        <p class="hint" style="margin:10px 0 0">Отказов: ${lost} · не пришли: ${noshow}. Заявка учитывается на этапе, до которого дошла.</p></section>
      <section class="box"><h3>Заявки и оплаты по дням</h3>
        <div class="chart">${series.map((s) => `<div title="${s.iso}: заявок ${s.n}, оплат ${s.p}"><i class="p" style="height:${(s.p / maxV) * 130}px"></i><i style="height:${(s.n / maxV) * 130}px"></i></div>`).join("")}</div>
        <div class="chart-x"><span>${fmtDay(series[0].iso)}</span><span>${fmtDay(series[series.length - 1].iso)}</span></div>
        <div class="legend2"><span><i style="background:#9edbd6"></i>заявки</span><span><i style="background:#16a34a"></i>оплаты</span></div></section>
      <section class="box"><h3>Источники</h3>${table(group((b) => SOURCE_L[b.source] || b.source), "Откуда")}</section>
      <section class="box"><h3>Услуги</h3>${table(group((b) => b.service || "Консультация"), "Услуга")}</section>
      <section class="box"><h3>Врачи</h3>${table(group((b) => b.doctor || "Не назначен"), "Врач")}</section>
      <section class="box"><h3>Что это даёт</h3><p class="hint" style="margin:0">Источники показывают, откуда приходят пациенты, и куда вкладывать рекламу. Услуги и врачи показывают, что приносит выручку. Время ответа влияет на конверсию: на заявку стоит отвечать в первые 15 минут.</p></section>
    </div>`;
}

function renderIntegrations() {
  const s = site.settings || {};
  const tpl = waTemplates();
  $("main").innerHTML = `<div class="intg">
    <section class="box"><div class="head" style="display:flex;gap:10px;align-items:center;flex-wrap:wrap"><h3 style="margin:0;flex:1">Telegram: уведомления о заявках</h3><span class="state ${intState.telegram ? "on" : "off"}">${intState.telegram ? "● подключён" : "○ не подключён"}</span></div>
      <p>Каждая новая заявка приходит в Telegram администратору или в общий чат с кнопками <b>«Связались»</b>, <b>«Записан»</b>, <b>«Отказ»</b> и <b>WhatsApp</b>. Нажатие кнопки сразу меняет этап в CRM.</p>
      <ol><li>В Telegram откройте <b>@BotFather</b>, команда <code>/newbot</code>, придумайте имя. Он выдаст токен бота.</li><li>Добавьте бота в чат администраторов (или напишите ему сами) и узнайте ID чата, например через <b>@userinfobot</b>.</li><li>Передайте токен и ID разработчику: они прописываются на сервере как <code>TG_TOKEN</code> и <code>TG_CHAT</code>.</li></ol>
      <button class="sec" id="tgTest" ${intState.telegram ? "" : "disabled"}>Отправить тестовое сообщение</button></section>
    <section class="box"><div class="head" style="display:flex;gap:10px;align-items:center;flex-wrap:wrap"><h3 style="margin:0;flex:1">WhatsApp</h3><span class="state on">● работает через ссылки</span></div>
      <p>Сейчас заявки с сайта приходят в WhatsApp клиники готовым сообщением, а из карточки пациента можно в один клик открыть чат с подготовленным текстом. Это бесплатно и не требует подключения.</p>
      <p class="hint">Автоматическая рассылка (напоминание за день до приёма без участия администратора) требует WhatsApp Business API от Meta: верификация бизнеса и оплата за каждый диалог по тарифу Meta. Подключается отдельно по запросу.</p>
      <h4 style="margin:14px 0 6px">Шаблоны сообщений</h4><p class="hint" style="margin:0 0 8px">Подстановки: {name} имя, {when} дата и время приёма, {service} услуга, {address} адрес, {review_link} ссылка на отзывы в 2ГИС.</p>
      <div class="fields" id="tplFields">${Object.keys(WA_LABEL).map((k) => `<label class="f wide"><span>${WA_LABEL[k]}</span><textarea data-tpl="${k}" rows="2">${esc(tpl[k])}</textarea></label>`).join("")}</div>
      <div style="display:flex;gap:8px;margin-top:10px"><button class="pri" id="saveTpl">Сохранить шаблоны</button><button class="sec" id="resetTpl">Вернуть стандартные</button></div></section>
    <section class="box"><div class="head" style="display:flex;gap:10px;align-items:center;flex-wrap:wrap"><h3 style="margin:0;flex:1">Передача заявок в amoCRM, Bitrix24 или МИС</h3><span class="state ${intState.webhook ? "on" : "off"}">${intState.webhook ? "● подключено" : "○ не подключено"}</span></div>
      <p>Если в клинике уже есть CRM или медицинская система, каждая заявка и смена этапа отправляются туда по вебхуку (адрес прописывается на сервере как <code>WEBHOOK_URL</code>). Пример данных:</p>
      <div class="code">{ "event": "booking", "booking": { "name": "Айдана", "phone": "+77011234567", "service": "Детский приём", "day": "2026-11-20", "time": "10:30", "status": "new", "source": "site" } }</div></section>
  </div>`;
  if ($("tgTest")) $("tgTest").onclick = async () => { try { await api("/api/admin/tg-test", {}); toast("Отправлено, проверьте Telegram"); } catch (e) { toast(e.message); } };
  $("saveTpl").onclick = async () => {
    const t = {}; $("tplFields").querySelectorAll("[data-tpl]").forEach((x) => { t[x.dataset.tpl] = x.value; });
    await api("/api/admin/site", { settings: { ...(site.settings || {}), waTemplates: t } }); await reloadSite(); toast("Шаблоны сохранены");
  };
  $("resetTpl").onclick = async () => {
    const st = { ...(site.settings || {}) }; delete st.waTemplates;
    await api("/api/admin/site", { settings: st }); await reloadSite(); renderIntegrations(); toast("Вернули стандартные тексты");
  };
}


const AUDIT_L = { login: "Вход", logout: "Выход", login_failed: "Неудачный вход", login_blocked: "Вход заблокирован (перебор)", password_changed: "Сменён пароль", password_change_failed: "Неверный пароль при смене", user_saved: "Сотрудник сохранён", user_deleted: "Сотрудник удалён", booking_deleted: "Удалена заявка", site_saved: "Изменён сайт", upload: "Загружено фото", upload_rejected: "Отклонён файл", export: "Выгрузка в Excel", forbidden: "Попытка без прав", csrf_rejected: "Отклонён поддельный запрос", anonymize: "Обезличены старые заявки" };
const AUDIT_BAD = new Set(["login_failed", "login_blocked", "password_change_failed", "upload_rejected", "forbidden", "csrf_rejected"]);

async function renderUsers() {
  $("main").innerHTML = `<div class="empty">Загружаем…</div>`;
  let items = [];
  try { items = (await api("/api/admin/users")).items; } catch (e) { $("main").innerHTML = `<div class="empty">${esc(e.message)}</div>`; return; }
  $("pageActions").innerHTML = `<button class="pri" id="userNew">+ Сотрудник</button>`;
  $("main").innerHTML = `<section class="box"><h3>Кто имеет доступ</h3>
    <p class="hint" style="margin:0 0 12px">У каждого сотрудника свой логин. <b>Владелец</b> видит всё: сайт, интеграции, сотрудников, журнал. <b>Администратор</b> работает только с заявками, воронкой, расписанием и статистикой. Пароли хранятся в зашифрованном виде, их не видит даже владелец.</p>
    <div style="overflow-x:auto"><table class="tbl" style="width:100%;border-collapse:collapse">
      <thead><tr><th style="text-align:left;padding:8px">Логин</th><th style="text-align:left;padding:8px">Имя</th><th style="text-align:left;padding:8px">Роль</th><th style="text-align:left;padding:8px">Статус</th><th></th></tr></thead>
      <tbody>${items.map((u) => `<tr style="border-top:1px solid var(--line)"><td style="padding:8px"><b>${esc(u.login)}</b>${u.login === me.login ? ` <small class="hint">это вы</small>` : ""}</td><td style="padding:8px">${esc(u.name)}</td><td style="padding:8px">${u.role === "owner" ? "Владелец" : "Администратор"}</td><td style="padding:8px">${u.disabled ? "отключён" : "активен"}</td><td style="padding:8px;text-align:right"><button class="sec sm" data-u="${esc(u.login)}">Изменить</button></td></tr>`).join("")}</tbody>
    </table></div></section>
    <section class="box hide" id="userForm"></section>`;
  const form = (u) => {
    const isNew = !u, self = u && u.login === me.login;
    const box = $("userForm");
    box.classList.remove("hide");
    box.innerHTML = `<h3>${isNew ? "Новый сотрудник" : "Сотрудник " + esc(u.login)}</h3><div class="fields">
      <label class="f"><span>Логин (латиница)</span><input id="uLogin" value="${esc(u ? u.login : "")}" ${isNew ? "" : "disabled"} autocomplete="off"></label>
      <label class="f"><span>Имя</span><input id="uName" value="${esc(u ? u.name : "")}"></label>
      <label class="f"><span>Роль</span><select id="uRole" ${self ? "disabled" : ""}><option value="manager">Администратор (только CRM)</option><option value="owner">Владелец (всё)</option></select></label>
      <label class="f"><span>${isNew ? "Временный пароль" : "Новый временный пароль (пусто: не менять)"}</span><input id="uPass" type="text" autocomplete="off" placeholder="минимум 10 символов, буквы и цифры"></label>
      ${self ? "" : `<label class="f" style="display:flex;gap:8px;align-items:center"><input type="checkbox" id="uOff" ${u && u.disabled ? "checked" : ""} style="width:auto"><span>Отключить доступ</span></label>`}
    </div><p class="hint">Сотрудник сменит временный пароль при первом входе.</p>
    <div style="display:flex;gap:8px;flex-wrap:wrap"><button class="pri" id="uSave">Сохранить</button>${isNew || self ? "" : `<button class="sec" id="uDel">Удалить</button>`}<button class="sec" id="uCancel">Отмена</button></div>`;
    $("uRole").value = u ? u.role : "manager";
    box.scrollIntoView({ behavior: "smooth", block: "start" });
    $("uCancel").onclick = () => box.classList.add("hide");
    $("uSave").onclick = async () => {
      try {
        await api("/api/admin/users", { login: $("uLogin").value.trim().toLowerCase(), name: $("uName").value.trim(), role: self ? "owner" : $("uRole").value, password: $("uPass").value, disabled: $("uOff") ? $("uOff").checked : false });
        toast("Сохранено"); renderUsers();
      } catch (e) { toast(e.message); }
    };
    if ($("uDel")) $("uDel").onclick = async () => {
      if (!confirm(`Удалить сотрудника ${u.login}? Он сразу потеряет доступ.`)) return;
      try { await api("/api/admin/users/delete", { login: u.login }); toast("Удалён"); renderUsers(); } catch (e) { toast(e.message); }
    };
  };
  $("userNew").onclick = () => form(null);
  $("main").querySelectorAll("[data-u]").forEach((b) => b.onclick = () => form(items.find((x) => x.login === b.dataset.u)));
}

async function renderAudit() {
  $("main").innerHTML = `<div class="empty">Загружаем…</div>`;
  let items = [];
  try { items = (await api("/api/admin/audit")).items; } catch (e) { $("main").innerHTML = `<div class="empty">${esc(e.message)}</div>`; return; }
  $("pageActions").innerHTML = `<button class="sec" id="auditReload">Обновить</button>`;
  $("auditReload").onclick = renderAudit;
  const bad = items.filter((x) => AUDIT_BAD.has(x.action)).length;
  $("main").innerHTML = `<section class="box"><h3>Последние 300 событий</h3>
    <p class="hint" style="margin:0 0 12px">Входы, неудачные попытки, смены паролей, удаления и изменения сайта. Если видите много неудачных входов с незнакомых адресов, смените пароли. Подозрительных событий в списке: <b>${bad}</b>.</p>
    ${items.length ? `<div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;font-size:13px"><thead><tr><th style="text-align:left;padding:6px">Когда</th><th style="text-align:left;padding:6px">Кто</th><th style="text-align:left;padding:6px">Событие</th><th style="text-align:left;padding:6px">IP</th><th style="text-align:left;padding:6px">Детали</th></tr></thead><tbody>
    ${items.map((x) => `<tr style="border-top:1px solid var(--line);${AUDIT_BAD.has(x.action) ? "background:#fff4f2" : ""}"><td style="padding:6px;white-space:nowrap">${esc(x.at)}</td><td style="padding:6px">${esc(x.user)}</td><td style="padding:6px">${esc(AUDIT_L[x.action] || x.action)}</td><td style="padding:6px">${esc(x.ip)}</td><td style="padding:6px">${esc(x.detail)}</td></tr>`).join("")}
    </tbody></table></div>` : `<div class="empty">Пока пусто</div>`}</section>`;
}
