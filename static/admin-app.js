const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
let csrf = "";
let me = null;
let site = {};
let bookings = [];
let tab = "home";
let dirty = false;
let openItems = new Set();

const MON = ["января", "февраля", "марта", "апреля", "мая", "июня", "июля", "августа", "сентября", "октября", "ноября", "декабря"];
const DOW = ["Воскресенье", "Понедельник", "Вторник", "Среда", "Четверг", "Пятница", "Суббота"];
const STATUS = { new: "Новая", confirmed: "Подтверждена", done: "Пришёл", cancelled: "Отмена" };
const isoLocal = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const todayIso = () => isoLocal(new Date());
const fmtDay = (iso) => { const d = new Date(iso + "T00:00"); return isNaN(d) ? "" : `${d.getDate()} ${MON[d.getMonth()]} ${d.getFullYear()}`; };
const imgUrl = (p) => (!p ? "" : /^https?:/.test(p) ? p : "/" + p);

const IC = {
  pipeline: '<rect x="3" y="4" width="5" height="16" rx="1.5" fill="none" stroke="currentColor" stroke-width="2"/><rect x="10" y="4" width="5" height="11" rx="1.5" fill="none" stroke="currentColor" stroke-width="2"/><rect x="17" y="4" width="4" height="7" rx="1.5" fill="none" stroke="currentColor" stroke-width="2"/>',
  stats: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2" stroke="currentColor" stroke-width="2" stroke-linecap="round" fill="none"/>',
  cases: '<rect x="3" y="5" width="8" height="14" rx="2" fill="none" stroke="currentColor" stroke-width="2"/><rect x="13" y="5" width="8" height="14" rx="2" fill="none" stroke="currentColor" stroke-width="2"/>',
  users: '<circle cx="9" cy="8" r="3.5" fill="none" stroke="currentColor" stroke-width="2"/><path d="M2.5 20c.8-3.6 3.4-5.5 6.5-5.5s5.7 1.9 6.5 5.5M16 4.5a3.5 3.5 0 0 1 0 7M18 14.5c1.9.6 3.1 2.4 3.5 5.5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
  audit: '<path d="M12 3l8 3v6c0 4.5-3.4 8-8 9-4.6-1-8-4.5-8-9V6z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><path d="M8.5 12l2.5 2.5 4.5-5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
  integrations: '<path d="M8 12h8M12 8v8" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><rect x="3" y="3" width="18" height="18" rx="5" fill="none" stroke="currentColor" stroke-width="2"/>',
  home: '<path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>',
  bookings: '<rect x="4" y="3" width="16" height="18" rx="2" fill="none" stroke="currentColor" stroke-width="2"/><path d="M8 8h8M8 12h8M8 16h5" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
  schedule: '<rect x="3" y="5" width="18" height="16" rx="3" fill="none" stroke="currentColor" stroke-width="2"/><path d="M3 10h18M8 3v4M16 3v4" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
  promos: '<path d="M4 12l8-8h7v7l-8 8z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><circle cx="15.5" cy="8.5" r="1.5" fill="currentColor"/>',
  services: '<path d="M7 3c-2.5 0-4 2-4 4.5 0 3 1.5 4.5 2 7.5.4 2.6 1 6 2.6 6 1.5 0 1.6-3.3 2.4-5 .4-.8 1.6-.8 2 0 .8 1.7.9 5 2.4 5 1.6 0 2.2-3.4 2.6-6 .5-3 2-4.5 2-7.5C21 5 19.5 3 17 3c-2 0-3 1-5 1S9 3 7 3Z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/>',
  doctors: '<circle cx="12" cy="8" r="4" fill="none" stroke="currentColor" stroke-width="2"/><path d="M4 21c1-4 4-6 8-6s7 2 8 6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
  reviews: '<path d="M12 3l2.6 5.6 6 .7-4.5 4.1 1.2 6L12 16.5 6.7 19.4l1.2-6L3.4 9.3l6-.7z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>',
  trust: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>',
  faq: '<circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="2"/><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.6V14M12 17.5v.1" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
  reels: '<rect x="3" y="3" width="18" height="18" rx="5" fill="none" stroke="currentColor" stroke-width="2"/><path d="M10 9v6l5-3z" fill="currentColor"/>',
  settings: '<circle cx="12" cy="12" r="3" fill="none" stroke="currentColor" stroke-width="2"/><path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
};

const SCHEMA = {
  promos: {
    label: "Акции", hint: "Карточки акций вверху блока «Услуги». Если указать дату окончания, акция сама исчезнет с сайта на следующий день.",
    title: (x) => x.title, sub: (x) => [x.price, x.until ? "до " + fmtDay(x.until) : "бессрочно"].filter(Boolean).join(" · "), thumb: (x) => x.img,
    tags: (x) => (x.until && x.until < todayIso() ? [["warn", "закончилась"]] : []),
    fields: [
      { k: "title", l: "Название", bi: 1 }, { k: "price", l: "Крупная цифра (цена или «бесплатно»)", bi: 1 },
      { k: "note", l: "Подпись", bi: 1 }, { k: "tag", l: "Метка в углу (Акция, Kaspi…)", bi: 1 },
      { k: "until", l: "Действует до (пусто: бессрочно)", t: "date" }, { k: "img", l: "Фоновое фото", t: "img" },
    ],
  },
  services: {
    label: "Услуги", hint: "Цена необязательна. Пишите «от 12 000 ₸» для минимальной цены. Если цены нет, заполните метку, например «В день обращения».",
    title: (x) => x.title, sub: (x) => x.price || x.tag || "без цены",
    fields: [
      { k: "title", l: "Название", bi: 1 }, { k: "desc", l: "Описание", bi: 1, t: "area" },
      { k: "price", l: "Цена", bi: 1 }, { k: "tag", l: "Метка вместо цены", bi: 1 },
      { k: "slug", l: "Адрес страницы услуги (/uslugi/…), латиница" },
      { k: "seo_h1", l: "Заголовок страницы услуги (для Google)" },
      { k: "seo_intro", l: "Вступление на странице услуги", t: "area", wide: 1 },
      { k: "seo_steps", l: "Как проходит (по шагу в строке)", t: "lines", wide: 1 },
      { k: "seo_faq", l: "Вопросы: «Вопрос | Ответ», по одному в строке", t: "lines", wide: 1 },
    ],
  },
  cases: {
    label: "До и после", hint: "Пары фото одной работы. Лучше снимать с одного ракурса и при одном свете. Перед публикацией нужно согласие пациента.",
    title: (x) => x.title || "Работа", sub: (x) => x.text || "", thumb: (x) => x.after,
    fields: [
      { k: "title", l: "Подпись", bi: 1 }, { k: "text", l: "Пояснение (необязательно)", bi: 1 },
      { k: "before", l: "Фото до", t: "img" }, { k: "after", l: "Фото после", t: "img" },
    ],
  },
  doctors: {
    label: "Врачи", hint: "Без фото показывается нарисованный аватар. Фото лучше вертикальное, лицо в верхней части.",
    title: (x) => x.name, sub: (x) => x.role, thumb: (x) => x.photo,
    fields: [
      { k: "name", l: "ФИО", bi: 1 }, { k: "role", l: "Специальность", bi: 1 },
      { k: "exp", l: "Опыт, чем занимается", bi: 1, t: "area" }, { k: "photo", l: "Фото", t: "img" },
      { k: "avatar", l: "Аватар без фото", t: "select", o: [["m", "Мужчина"], ["f", "Женщина"], ["f2", "Женщина 2"], ["f3", "Женщина 3"]] },
    ],
  },
  reviews: {
    label: "Отзывы", hint: "",
    title: (x) => (x.author || "Без имени") + "  " + "★".repeat(+x.rating || 0), sub: (x) => [x.date ? fmtDay(x.date) : "без даты", (x.text || "").slice(0, 80)].join(" · "),
    tags: (x) => reviewTags(x),
    fields: [
      { k: "author", l: "Имя автора (без фамилии)" }, { k: "date", l: "Дата отзыва", t: "date" },
      { k: "rating", l: "Оценка", t: "stars" }, { k: "service", l: "Услуга (необязательно)" },
      { k: "text", l: "Текст отзыва", t: "area", wide: 1 },
      { k: "url", l: "Ссылка на отзыв в 2ГИС (необязательно)", wide: 1 },
    ],
  },
  trust: {
    label: "Безопасность", hint: "Тёмный блок «Безопасность и гарантии». Каждый пункт списка с новой строки.",
    title: (x) => x.title, sub: (x) => (x.items || []).length + " пунктов",
    fields: [
      { k: "title", l: "Заголовок", bi: 1 }, { k: "items", l: "Пункты (по одному в строке)", bi: 1, t: "lines" },
      { k: "icon", l: "Иконка", t: "select", o: [["shield", "Щит (стерильность)"], ["scan", "Снимок (оборудование)"], ["badge", "Медаль (гарантии)"]] },
    ],
  },
  faq: {
    label: "Вопросы", hint: "Блок «Частые вопросы». Первый вопрос на сайте открыт по умолчанию.",
    title: (x) => x.q, sub: (x) => (x.a || "").slice(0, 90),
    fields: [{ k: "q", l: "Вопрос", bi: 1 }, { k: "a", l: "Ответ", bi: 1, t: "area" }],
  },
  reels: {
    label: "Рилсы", hint: "Карусель «Diamond в Instagram». Если Instagram не даёт встроить видео, снимите «Открывать на сайте», и по клику оно откроется в Instagram.",
    title: (x) => x.title || x.url, sub: (x) => (x.views ? x.views + " просмотров" : "") , thumb: (x) => x.cover,
    tags: (x) => (x.embed === false ? [["off", "открывается в Instagram"]] : []),
    fields: [
      { k: "url", l: "Ссылка на рилс", wide: 1 }, { k: "title", l: "Подпись на карточке" }, { k: "views", l: "Просмотры" },
      { k: "cover", l: "Обложка", t: "img" }, { k: "embed", l: "Открывать на сайте", t: "check", def: true },
    ],
  },
};
const SETTINGS = [
  ["Основное", [["name", "Название"], ["tagline", "Подпись под логотипом", 1], ["about", "Текст «О клинике»", 1, "area"]]],
  ["Контакты", [["phone", "Телефон"], ["whatsapp", "WhatsApp (только цифры)"], ["instagram", "Instagram (логин)"], ["address", "Адрес", 1], ["hours", "Время работы", 1], ["firmId", "ID в 2ГИС"], ["lat", "Широта"], ["lon", "Долгота"]]],
  ["Первый экран", [["promoBadge", "Плашка Kaspi", 1], ["promoTitle", "Заголовок", 1], ["promoText", "Подзаголовок", 1, "area"]]],
  ["Рейтинг и отзывы", [["rating", "Рейтинг в 2ГИС"], ["reviews", "Число оценок"], ["reviewsText", "Число отзывов"], ["reviewsMinRating", "Показывать отзывы от (звёзд)"], ["reviewsLimit", "Сколько отзывов показывать"], ["followers", "Подписчики Instagram", 1]]],
  ["Прочее", [["emergencyText", "Текст «Срочная помощь»", 1, "area"], ["license", "Лицензия (в подвале)", 1, "area"]]],
];
const NAV_ALL = [
  ["Работа", [["home", "Обзор"], ["pipeline", "Воронка"], ["bookings", "Заявки"], ["schedule", "Расписание"], ["stats", "Статистика"]]],
  ["Сайт", [["promos", "Акции"], ["services", "Услуги"], ["doctors", "Врачи"], ["reviews", "Отзывы"], ["cases", "До и после"], ["trust", "Безопасность"], ["faq", "Вопросы"], ["reels", "Рилсы"]]],
  ["Настройки", [["integrations", "Интеграции"], ["settings", "Настройки сайта"], ["users", "Сотрудники"], ["audit", "Журнал действий"]]],
];
let NAV = NAV_ALL;
const TITLES = Object.fromEntries(NAV_ALL.flatMap(([, it]) => it));
const allowedTab = (t) => NAV.some(([, it]) => it.some(([k]) => k === t));

function toast(t) { const el = $("toast"); el.textContent = t; el.classList.add("on"); clearTimeout(toast.t); toast.t = setTimeout(() => el.classList.remove("on"), 2200); }
function setDirty(v) { dirty = v; $("savebar").classList.toggle("on", v); }

async function api(path, body) {
  const opt = { credentials: "same-origin", headers: { "Content-Type": "application/json" } };
  if (body) { opt.method = "POST"; opt.body = JSON.stringify(body); opt.headers["X-CSRF"] = csrf; }
  const r = await fetch(path, opt);
  if (r.status === 401 && path !== "/api/login") { showLogin(me ? "Сессия закончилась, войдите снова" : ""); throw new Error("auth"); }
  let j = {};
  try { j = await r.json(); } catch (e) {}
  if (!r.ok) throw new Error(j.error || "Ошибка " + r.status);
  return j;
}

function showOnly(id) { ["login", "pwbox", "app"].forEach((k) => $(k).classList.toggle("hide", k !== id)); }
function showLogin(msg) { me = null; dirty = false; $("loginErr").textContent = msg || ""; $("pass").value = ""; showOnly("login"); setTimeout(() => ($("user").value ? $("pass") : $("user")).focus(), 30); }
function showPw(forced) {
  ["pwOld", "pwNew", "pwNew2"].forEach((k) => ($(k).value = ""));
  $("pwErr").textContent = "";
  $("pwWhy").textContent = forced ? "Это первый вход со стандартным паролем. Задайте свой: минимум 10 символов, буквы и цифры." : "Минимум 10 символов, буквы и цифры. После смены другие устройства выйдут из админки.";
  $("pwCancel").classList.toggle("hide", forced);
  showOnly("pwbox"); setTimeout(() => $("pwOld").focus(), 30);
}

async function enter() {
  try { me = await api("/api/admin/me"); }
  catch (e) { if (e.message !== "auth") showLogin(""); return; }
  csrf = me.csrf;
  if (me.mustChange) return showPw(true);
  NAV = me.role === "owner" ? NAV_ALL : [NAV_ALL[0]];
  $("whoami").textContent = me.name && me.name !== me.roleName ? `${me.name} · ${me.roleName}` : `${me.login} · ${me.roleName}`;
  showOnly("app");
  await Promise.all([reloadSite(), loadBookings()]);
  const h = location.hash.slice(1);
  if (TITLES[h]) tab = h;
  if (!allowedTab(tab)) tab = "home";
  go(tab, true);
}
async function reloadSite() { site = await (await fetch("/api/site", { cache: "no-store" })).json(); }
let intState = {};
async function loadBookings() {
  const d = await api("/api/admin/bookings");
  bookings = d.items || [];
  intState = { telegram: d.telegram, webhook: d.webhook };
  $("intState").textContent = [d.telegram ? "Telegram ✓" : "Telegram —", d.webhook ? "CRM ✓" : "CRM —"].join(" · ");
}
$("loginBtn").onclick = async () => {
  const login = $("user").value.trim().toLowerCase(), password = $("pass").value;
  if (!login || !password) { $("loginErr").textContent = "Введите логин и пароль"; return; }
  $("loginBtn").disabled = true;
  try { const r = await api("/api/login", { login, password }); csrf = r.csrf; $("pass").value = ""; await enter(); }
  catch (e) { $("loginErr").textContent = e.message; }
  finally { $("loginBtn").disabled = false; }
};
["user", "pass"].forEach((k) => $(k).addEventListener("keydown", (e) => { if (e.key === "Enter") $("loginBtn").click(); }));
$("logout").onclick = async () => { if (dirty && !confirm("Есть несохранённые изменения. Выйти?")) return; try { await api("/api/logout", {}); } catch (e) {} dirty = false; location.hash = ""; location.reload(); };
$("chpass").onclick = () => { if (dirty && !confirm("Есть несохранённые изменения. Продолжить?")) return; setDirty(false); showPw(false); };
$("pwCancel").onclick = () => showOnly("app");
$("pwBtn").onclick = async () => {
  const old = $("pwOld").value, nw = $("pwNew").value;
  if (nw !== $("pwNew2").value) { $("pwErr").textContent = "Новые пароли не совпадают"; return; }
  $("pwBtn").disabled = true;
  try { const r = await api("/api/admin/password", { old, new: nw }); csrf = r.csrf; toast("Пароль изменён"); await enter(); }
  catch (e) { $("pwErr").textContent = e.message; }
  finally { $("pwBtn").disabled = false; }
};
["pwOld", "pwNew", "pwNew2"].forEach((k) => $(k).addEventListener("keydown", (e) => { if (e.key === "Enter") $("pwBtn").click(); }));

function renderNav() {
  const fresh = bookings.filter((b) => b.status === "new").length;
  $("nav").innerHTML = NAV.map(([g, items]) => `${g ? `<div class="grp">${g}</div>` : `<div class="grp"></div>`}${items.map(([k, l]) => `<button class="nav-i ${k === tab ? "on" : ""}" data-t="${k}"><svg viewBox="0 0 24 24">${IC[k] || ""}</svg>${l}${k === "pipeline" && fresh ? `<span class="badge">${fresh}</span>` : ""}</button>`).join("")}`).join("");
  $("nav").querySelectorAll(".nav-i").forEach((b) => b.onclick = () => go(b.dataset.t));
}
function go(t, force) {
  if (!allowedTab(t)) t = "home";
  if (!force && t === tab) { closeMenu(); return; }
  if (dirty && !confirm("Есть несохранённые изменения. Перейти без сохранения?")) return;
  setDirty(false); tab = t; openItems = new Set(); $("main").oninput = null; pasteFound = [];
  history.replaceState(null, "", "#" + t);
  $("pageTitle").textContent = TITLES[t] || "";
  $("topTitle").textContent = TITLES[t] || "Diamond";
  $("pageActions").innerHTML = "";
  renderNav(); closeMenu(); window.scrollTo(0, 0); render();
}
function openMenu() { $("side").classList.add("open"); $("scrim").classList.remove("hide"); }
function closeMenu() { $("side").classList.remove("open"); $("scrim").classList.add("hide"); }
$("menuBtn").onclick = openMenu;
$("scrim").onclick = closeMenu;
window.addEventListener("scroll", () => $("pageHead").classList.toggle("sc", window.scrollY > 4), { passive: true });

function render() {
  if (tab === "home") return renderHome();
  if (tab === "pipeline") return renderPipeline();
  if (tab === "stats") return renderStats();
  if (tab === "integrations") return renderIntegrations();
  if (tab === "users") return renderUsers();
  if (tab === "audit") return renderAudit();
  if (tab === "bookings") return renderBookings();
  if (tab === "schedule") return renderSchedule();
  if (tab === "settings") return renderSettings();
  renderList(tab);
}

function reviewTags(x) {
  const min = +(site.settings || {}).reviewsMinRating || 5;
  if (x.hidden) return [["off", "скрыт"]];
  if (!String(x.text || "").trim()) return [["warn", "нет текста"]];
  if ((+x.rating || 0) < min) return [["off", `не на сайте: ${+x.rating || 0}★`]];
  const shownList = (site.reviews || []).filter((r) => !r.hidden && (+r.rating || 0) >= min && String(r.text || "").trim())
    .sort((a, b) => String(b.date || "").localeCompare(String(a.date || ""))).slice(0, +(site.settings || {}).reviewsLimit || 9);
  return shownList.includes(x) ? [["ok", "на сайте"]] : [["warn", "не влез в лимит"]];
}

let schedDay = todayIso();
function shiftDay(iso, n) { const d = new Date(iso + "T00:00"); d.setDate(d.getDate() + n); return isoLocal(d); }
async function renderSchedule() {
  const d = new Date(schedDay + "T00:00");
  const j = await api("/api/admin/schedule?day=" + schedDay);
  const blocked = new Set(j.blocked);
  $("pageActions").innerHTML = `<button class="sec" id="dPrev">‹</button><input type="date" id="dPick" value="${schedDay}" style="width:auto;padding:6px 10px"><button class="sec" id="dNext">›</button><button class="sec" id="dToday">Сегодня</button>`;
  $("main").innerHTML = `<section class="box">
    <p class="hint lead">Нажмите на свободное время, чтобы закрыть его для записи (перерыв, врач занят), и ещё раз, чтобы открыть. Время с заявками закрывается само и освобождается, если заявку отменить.</p>
    <div class="sched-day"><b>${DOW[d.getDay()]}, ${d.getDate()} ${MON[d.getMonth()]}</b>
      ${j.slots.length ? `<label class="chk"><input type="checkbox" id="dClosed" ${j.closed ? "checked" : ""}>Закрыть весь день</label>` : `<span class="hint">Выходной по графику клиники</span>`}
    </div>
    <div class="sched-grid ${j.closed ? "closed" : ""}">${j.slots.map((t) => {
      const b = j.booked[t];
      if (b) return `<button class="sl sl-book" data-lead="${b.id}" title="${esc(b.service || "")}"><b>${t}</b><span>${esc(b.name)}</span><small>${esc((STAGE[b.status] || {}).l || b.status)}</small></button>`;
      return `<button class="sl ${blocked.has(t) ? "sl-block" : ""}" data-t="${t}"><b>${t}</b><span>${blocked.has(t) ? "закрыто" : "свободно"}</span></button>`;
    }).join("")}</div>
    <div class="sched-legend"><span><i class="lg-free"></i>свободно</span><span><i class="lg-book"></i>заявка</span><span><i class="lg-block"></i>закрыто вручную</span></div>
  </section>`;
  bindLeadOpeners();
  const save = async () => { await api("/api/admin/schedule", { day: schedDay, blocked: [...blocked], closed: $("dClosed") ? $("dClosed").checked : false }); toast("Сохранено, на сайте уже видно"); };
  $("main").querySelectorAll(".sl[data-t]").forEach((b) => b.onclick = async () => {
    const t = b.dataset.t;
    if (blocked.has(t)) blocked.delete(t); else blocked.add(t);
    b.classList.toggle("sl-block", blocked.has(t));
    b.querySelector("span").textContent = blocked.has(t) ? "закрыто" : "свободно";
    await save();
  });
  if ($("dClosed")) $("dClosed").onchange = async () => { $("main").querySelector(".sched-grid").classList.toggle("closed", $("dClosed").checked); await save(); };
  $("dPrev").onclick = () => { schedDay = shiftDay(schedDay, -1); renderSchedule(); };
  $("dNext").onclick = () => { schedDay = shiftDay(schedDay, 1); renderSchedule(); };
  $("dToday").onclick = () => { schedDay = todayIso(); renderSchedule(); };
  $("dPick").onchange = (e) => { if (e.target.value) { schedDay = e.target.value; renderSchedule(); } };
}

function input(k, val, t, extra = "") {
  if (t === "area") return `<textarea data-k="${k}" ${extra}>${esc(val)}</textarea>`;
  if (t === "lines") return `<textarea data-k="${k}" data-lines="1" ${extra}>${esc((val || []).join("\n"))}</textarea>`;
  if (t === "date") return `<input type="date" data-k="${k}" value="${esc(val)}" ${extra}>`;
  return `<input data-k="${k}" value="${esc(val)}" ${extra}>`;
}
function fieldHtml(f, x) {
  if (f.bi) {
    return `<div class="pair"><label class="f"><span>${f.l}</span>${input(f.k, x[f.k], f.t)}</label><label class="f"><span>${f.l}</span>${input(f.k + "_kz", x[f.k + "_kz"], f.t, 'placeholder="если пусто, покажем русский"')}</label></div>`;
  }
  if (f.t === "img") {
    return `<label class="f ${f.wide ? "wide" : ""}"><span>${f.l}</span><div class="img-f"><div class="th" style="background-image:${x[f.k] ? `url('${esc(imgUrl(x[f.k]))}')` : "none"}"></div>${input(f.k, x[f.k], "text", 'placeholder="img/… или загрузите файл"')}<span class="sec sm upl">Загрузить<input type="file" accept="image/jpeg,image/png,image/webp" data-up="${f.k}"></span></div></label>`;
  }
  if (f.t === "select") {
    return `<label class="f"><span>${f.l}</span><select data-k="${f.k}">${f.o.map(([v, l]) => `<option value="${v}" ${String(x[f.k]) === v ? "selected" : ""}>${l}</option>`).join("")}</select></label>`;
  }
  if (f.t === "stars") {
    const v = +x[f.k] || 5;
    return `<div class="f"><span>${f.l}</span><input type="hidden" data-k="${f.k}" value="${v}"><div class="stars-in">${[1, 2, 3, 4, 5].map((n) => `<button type="button" class="${n <= v ? "on" : ""}" data-star="${n}" aria-label="${n}">★</button>`).join("")}</div></div>`;
  }
  if (f.t === "check") {
    const on = x[f.k] === undefined ? f.def : x[f.k] !== false;
    return `<label class="f"><span>&nbsp;</span><span class="chk"><input type="checkbox" data-k="${f.k}" data-check="1" ${on ? "checked" : ""}>${f.l}</span></label>`;
  }
  return `<label class="f ${f.wide ? "wide" : ""}"><span>${f.l}</span>${input(f.k, x[f.k], f.t)}</label>`;
}

function readItem(el, base) {
  const out = { ...base };
  el.querySelectorAll("[data-k]").forEach((i) => {
    if (i.dataset.check) out[i.dataset.k] = i.checked;
    else if (i.dataset.lines) out[i.dataset.k] = i.value.split("\n").map((s) => s.trim()).filter(Boolean);
    else out[i.dataset.k] = i.value;
  });
  const h = el.querySelector("[data-hidden]");
  out.hidden = h ? h.checked : false;
  return out;
}
function readList(key) {
  const list = site[key] || [];
  return [...document.querySelectorAll("#list .item")].map((el) => readItem(el, list[+el.dataset.i] || {}));
}
function rememberOpen() {
  openItems = new Set([...document.querySelectorAll("#list .item.open")].map((el) => +el.dataset.i));
}

function itemHtml(key, x, i, len) {
  const S = SCHEMA[key];
  const th = S.thumb ? S.thumb(x) : "";
  const tags = (S.tags ? S.tags(x) : []).concat(x.hidden && key !== "reviews" ? [["off", "скрыт"]] : []);
  return `<div class="item ${x.hidden ? "off" : ""} ${openItems.has(i) ? "open" : ""}" data-i="${i}">
    <div class="item-top" data-toggle="1">
      <span class="num">${i + 1}</span>
      ${S.thumb ? `<span class="thumb" style="background-image:${th ? `url('${esc(imgUrl(th))}')` : "none"}"></span>` : ""}
      <span class="ttl"><b>${esc(S.title(x) || "Без названия")}</b><small>${esc(S.sub ? S.sub(x) : "")}</small></span>
      <span class="tags">${tags.map(([c, t]) => `<span class="tg tg-${c}">${esc(t)}</span>`).join("")}</span>
      <span class="caret">›</span>
    </div>
    <div class="item-body">
      <div class="item-tools">
        <label class="chk"><input type="checkbox" data-hidden="1" ${x.hidden ? "checked" : ""}>Скрыть на сайте</label>
        <span class="grow"></span>
        <button class="sec sm" data-mv="-1" ${i === 0 ? "disabled" : ""} title="Выше">↑</button><button class="sec sm" data-mv="1" ${i === len - 1 ? "disabled" : ""} title="Ниже">↓</button>
        <button class="del sm" data-del="1">Удалить</button>
      </div>
      <div class="fields">${S.fields.map((f) => fieldHtml(f, x)).join("")}</div>
    </div>
  </div>`;
}

function renderList(key) {
  const S = SCHEMA[key];
  const list = site[key] || [];
  $("pageActions").innerHTML = `<button class="pri" id="addBtn">+ Добавить</button>`;
  $("main").innerHTML = `
    ${S.hint ? `<p class="hint lead">${S.hint}</p>` : ""}
    ${key === "reviews" ? reviewsTop() : ""}
    ${key === "reels" ? `<div class="paste"><div class="paste-head"><b>Быстрый импорт ссылок</b></div><p class="hint" style="margin:0">Вставьте текст со ссылками на рилсы, лишнее отбросится, повторы не добавятся.</p><textarea id="bulk" rows="3" placeholder="https://www.instagram.com/reel/..."></textarea><div class="paste-row"><button class="sec" id="bulkBtn">Добавить ссылки</button><span class="hint" id="bulkHint"></span></div></div>` : ""}
    <div id="list">${list.map((x, i) => itemHtml(key, x, i, list.length)).join("") || `<div class="box empty">Пусто. Нажмите «+ Добавить».</div>`}</div>`;

  const listEl = $("list");
  listEl.addEventListener("input", () => setDirty(true));
  listEl.addEventListener("change", (e) => {
    setDirty(true);
    if (e.target.dataset.hidden) e.target.closest(".item").classList.toggle("off", e.target.checked);
  });
  listEl.querySelectorAll(".item").forEach((el) => {
    const i = +el.dataset.i;
    el.querySelector("[data-toggle]").onclick = () => el.classList.toggle("open");
    el.querySelectorAll("[data-mv]").forEach((b) => b.onclick = () => {
      rememberOpen();
      const cur = readList(key); const j = i + +b.dataset.mv;
      [cur[i], cur[j]] = [cur[j], cur[i]]; site[key] = cur;
      if (openItems.has(i)) { openItems.delete(i); openItems.add(j); }
      renderList(key); setDirty(true);
    });
    el.querySelector("[data-del]").onclick = () => {
      if (!confirm("Удалить этот пункт?")) return;
      const cur = readList(key); cur.splice(i, 1); site[key] = cur; openItems = new Set(); renderList(key); setDirty(true);
    };
    el.querySelectorAll("[data-star]").forEach((s) => s.onclick = () => {
      const n = +s.dataset.star;
      el.querySelector('[data-k="rating"]').value = n;
      el.querySelectorAll("[data-star]").forEach((x) => x.classList.toggle("on", +x.dataset.star <= n));
      setDirty(true);
    });
    el.querySelectorAll("[data-up]").forEach((inp) => inp.onchange = async () => {
      const file = inp.files[0]; if (!file) return;
      if (file.size > 5_000_000) { toast("Файл больше 5 МБ"); return; }
      const data = await new Promise((res) => { const r = new FileReader(); r.onload = () => res(r.result); r.readAsDataURL(file); });
      try {
        const j = await api("/api/admin/upload", { type: file.type, data });
        const field = el.querySelector(`[data-k="${inp.dataset.up}"]`);
        field.value = j.path;
        field.closest(".img-f").querySelector(".th").style.backgroundImage = `url('/${j.path}')`;
        setDirty(true); toast("Фото загружено, не забудьте сохранить");
      } catch (e) { toast(e.message); }
    });
  });
  $("addBtn").onclick = () => addItem(key, {});
  if (key === "reels") bindReelsImport();
  if (key === "reviews") bindReviewsPaste();
}

function addItem(key, preset) {
  const S = SCHEMA[key];
  rememberOpen();
  const cur = readList(key); const blank = {};
  S.fields.forEach((f) => { blank[f.k] = f.t === "lines" ? [] : f.t === "check" ? !!f.def : ""; });
  if (key === "doctors") blank.avatar = "m";
  if (key === "trust") blank.icon = "shield";
  if (key === "reviews") { blank.rating = "5"; blank.date = todayIso(); }
  const item = { ...blank, ...preset };
  const atTop = key === "reviews";
  if (atTop) { cur.unshift(item); openItems = new Set([0, ...[...openItems].map((n) => n + 1)]); }
  else { cur.push(item); openItems.add(cur.length - 1); }
  site[key] = cur; renderList(key); setDirty(true);
  const el = document.querySelector(`#list .item[data-i="${atTop ? 0 : cur.length - 1}"]`);
  if (el) { el.scrollIntoView({ behavior: "smooth", block: "center" }); const first = el.querySelector("input:not([type=hidden]):not([type=checkbox]),textarea"); if (first && !preset.text) first.focus(); }
}

function bindReelsImport() {
  $("bulkBtn").onclick = () => {
    const re = /instagram\.com\/(?:[A-Za-z0-9_.]+\/)?(reel|reels|p|tv)\/([A-Za-z0-9_-]{5,20})/g;
    const found = [...new Set([...$("bulk").value.matchAll(re)].map((m) => `https://www.instagram.com/${m[1] === "p" ? "p" : "reel"}/${m[2]}/`))];
    rememberOpen();
    const cur = readList("reels"); const have = cur.map((r) => r.url);
    const fresh = found.filter((u) => !have.includes(u)).map((url) => ({ url, cover: "", title: "", views: "", embed: true }));
    if (!found.length) { $("bulkHint").textContent = "Ссылок не нашлось."; return; }
    site.reels = [...fresh, ...cur]; openItems = new Set(fresh.map((_, i) => i)); renderList("reels"); setDirty(true);
    $("bulkHint").textContent = fresh.length ? `Добавлено: ${fresh.length}. Нажмите «Сохранить».` : "Эти рилсы уже есть.";
  };
}

function reviewsTop() {
  const s = site.settings || {};
  const min = +s.reviewsMinRating || 5;
  const all = site.reviews || [];
  const on = all.filter((r) => reviewTags(r)[0][0] === "ok").length;
  const gis = `https://2gis.kz/pavlodar/firm/${s.firmId}/tab/reviews`;
  return `<div class="paste" id="pasteBox">
    <div class="paste-head"><b>Вставить отзывы из 2ГИС</b><a class="sec sm" href="${esc(gis)}" target="_blank" rel="noopener">Открыть отзывы в 2ГИС ↗</a></div>
    <ol><li>Откройте отзывы клиники в 2ГИС и выделите мышкой один или сразу несколько отзывов: от имени первого до текста последнего.</li><li>Скопируйте, вставьте сюда и нажмите «Разобрать». Появится список, отметьте нужные и добавьте.</li></ol>
    <textarea id="pasteText" rows="6" placeholder="Айдана&#10;3 отзыва&#10;12 ноября 2026&#10;Очень понравилось, врач всё объяснил…&#10;&#10;Ерлан&#10;10 ноября 2026&#10;Быстро вылечили зуб…"></textarea>
    <div class="paste-row"><button class="pri" id="pasteBtn">Разобрать</button><button class="sec" id="manualBtn">Заполнить вручную</button><span class="hint" id="pasteHint"></span></div>
    <div class="bm">
      <div><b>Быстрее: закладка «В Diamond»</b><p class="hint" style="margin:2px 0 0">Перетащите кнопку на панель закладок браузера один раз. Потом откройте отзыв или вкладку отзывов в 2ГИС и нажмите закладку: отзывы вместе с оценками сами появятся здесь.</p></div>
      <a class="bm-btn" id="bmLink" href="#" title="Перетащите на панель закладок">⭐ В Diamond</a>
    </div>
    <div id="pastePreview"></div>
    <p class="hint" style="margin:0">На сайте сейчас <b>${on}</b> из ${all.length}. Показываются отзывы от ${min}★, самые свежие, не больше ${+s.reviewsLimit || 9}. Порог и количество меняются в «Настройках».</p>
  </div>`;
}

const MONTH_RE = "(января|февраля|марта|апреля|мая|июня|июля|августа|сентября|октября|ноября|декабря)";
const NAME_RE = /^\p{Lu}[\p{L}\-]+(\s+\p{Lu}[\p{L}\-]*\.?){0,2}$/u;
const JUNK_RE = /^(полезно|ответить|читать (целиком|полностью)|ещё|еще|пожаловаться|поделиться|подписаться|\d+ (отзыв|оцен)\S*|\d+|отзыв подтвержд\S*|подтвержд\S*|оценка подтвержд\S*|знаток города.*|★+|☆+|нравится|\d+ нравится|\d+ посещени\S*|полезно\??|изменён|изменен|отзыв подтверждён|отзыв подтвержден)$/i;
const STOP_RE = /^(официальный ответ|ответ (организации|компании|владельца)|diamond\b)/i;
const URL_RE = /https?:\/\/\S*2gis\S*/i;
function dateOf(s) {
  let m = s.match(new RegExp(`^(\\d{1,2})\\s+${MONTH_RE}(?:\\s+(\\d{4}))?`, "i"));
  if (m) {
    const mi = MON.indexOf(m[2].toLowerCase());
    const y = m[3] ? +m[3] : new Date().getFullYear();
    const d = new Date(y, mi, +m[1]);
    if (!m[3] && d > new Date()) d.setFullYear(y - 1);
    return isoLocal(d);
  }
  m = s.match(/^(\d{1,2})\.(\d{1,2})\.(\d{2,4})/);
  if (m) return isoLocal(new Date(+(m[3].length === 2 ? "20" + m[3] : m[3]), +m[2] - 1, +m[1]));
  if (/^сегодня/i.test(s)) return todayIso();
  if (/^вчера/i.test(s)) return isoLocal(new Date(Date.now() - 864e5));
  return "";
}
function cleanLines(raw) {
  return raw.split(/\r?\n/).map((s) => s.replace(/\s+/g, " ").trim()).filter(Boolean);
}
function parseReview(raw) {
  const lines = Array.isArray(raw) ? raw : cleanLines(raw);
  const out = { author: "", date: "", rating: "5", text: "", url: "" };
  const textParts = [];
  for (const s of lines) {
    const u = s.match(URL_RE);
    if (u) { if (!out.url) out.url = u[0]; if (s.trim() === u[0]) continue; }
    if (STOP_RE.test(s) && textParts.length) break;
    const d = dateOf(s);
    if (d && !out.date) { out.date = d; continue; }
    const stars = s.match(/^([1-5])\s*(из 5|★|звезд)/i);
    if (stars) { out.rating = stars[1]; continue; }
    if (JUNK_RE.test(s) || /^\p{Lu}{1,3}$/u.test(s)) continue;
    if (!out.author && s.length <= 40 && NAME_RE.test(s) && !out.date && !textParts.length) { out.author = s.split(" ")[0].replace(/[^\p{L}\-]/gu, "") || s; continue; }
    if (STOP_RE.test(s)) break;
    textParts.push(s.replace(URL_RE, "").trim());
  }
  out.text = textParts.filter(Boolean).join("\n").trim();
  return out;
}
function splitReviews(raw) {
  const lines = cleanLines(raw);
  const parts = [];
  let cur = [];
  let hasText = false;
  let inReply = false;
  const clinic = String((site.settings || {}).name || "Diamond").toLowerCase();
  for (let i = 0; i < lines.length; i++) {
    const s = lines[i];
    const near = lines.slice(i + 1, i + 4);
    const isClinic = s.toLowerCase().startsWith(clinic) || STOP_RE.test(s);
    const startsNew = !isClinic && s.length <= 40 && NAME_RE.test(s) && near.some((x) => dateOf(x)) && !dateOf(s);
    if (startsNew) inReply = false;
    if (/^(официальный ответ|ответ (организации|компании|владельца))/i.test(s)) { inReply = true; continue; }
    if (inReply) continue;
    if (startsNew && cur.length && hasText) { parts.push(cur); cur = []; hasText = false; }
    cur.push(s);
    if (!dateOf(s) && !JUNK_RE.test(s) && !NAME_RE.test(s) && s.length > 15) hasText = true;
  }
  if (cur.length) parts.push(cur);
  return parts.map(parseReview).filter((r) => r.text);
}

let pasteFound = [];
function renderPastePreview() {
  const box = $("pastePreview");
  if (!pasteFound.length) { box.innerHTML = ""; return; }
  const sel = pasteFound.filter((r) => r._on).length;
  box.innerHTML = `<div class="pv">
    <div class="pv-head"><b>Найдено: ${pasteFound.length}</b><label class="chk"><input type="checkbox" id="pvAll" ${sel === pasteFound.length ? "checked" : ""}>выбрать все</label><span class="grow"></span><button class="pri" id="pvAdd" ${sel ? "" : "disabled"}>Добавить выбранные (${sel})</button></div>
    ${pasteFound.map((r, i) => `<div class="pv-row ${r._on ? "" : "pv-off"}" data-i="${i}">
      <input type="checkbox" data-pk="_on" ${r._on ? "checked" : ""} aria-label="Добавить">
      <div class="pv-main">
        <div class="pv-meta">
          <input data-pk="author" value="${esc(r.author)}" placeholder="Имя">
          <input type="date" data-pk="date" value="${esc(r.date)}">
          <select data-pk="rating">${[5, 4, 3, 2, 1].map((n) => `<option value="${n}" ${+r.rating === n ? "selected" : ""}>${"★".repeat(n)}</option>`).join("")}</select>
          ${r._dup ? `<span class="tg tg-warn">уже есть</span>` : ""}
          ${!r.author ? `<span class="tg tg-warn">нет имени</span>` : ""}
          ${!r.date ? `<span class="tg tg-warn">нет даты</span>` : ""}
        </div>
        <textarea data-pk="text" rows="2">${esc(r.text)}</textarea>
      </div>
    </div>`).join("")}
  </div>`;
  box.querySelectorAll(".pv-row").forEach((row) => {
    const r = pasteFound[+row.dataset.i];
    row.querySelectorAll("[data-pk]").forEach((inp) => {
      const k = inp.dataset.pk;
      inp.addEventListener(inp.type === "checkbox" ? "change" : "input", () => {
        r[k] = inp.type === "checkbox" ? inp.checked : inp.value;
        if (k === "_on") renderPastePreview();
      });
    });
  });
  $("pvAll").onchange = (e) => { pasteFound.forEach((r) => { r._on = e.target.checked; }); renderPastePreview(); };
  $("pvAdd").onclick = () => {
    const pick = pasteFound.filter((r) => r._on && String(r.text).trim());
    if (!pick.length) return;
    rememberOpen();
    const cur = readList("reviews");
    const items = pick.map(({ _on, _dup, ...r }) => ({ service: "", ...r }));
    site.reviews = [...items, ...cur];
    openItems = new Set([...openItems].map((n) => n + items.length));
    pasteFound = [];
    renderList("reviews");
    setDirty(true);
    toast(`Добавлено отзывов: ${items.length}. Нажмите «Сохранить»`);
  };
}

function bookmarkletHref() {
  const code = `(()=>{const O=${JSON.stringify(location.origin)};const R=/\\d{1,2} (января|февраля|марта|апреля|мая|июня|июля|августа|сентября|октября|ноября|декабря) \\d{4}/;const isBar=e=>/^\\s*width:\\s*(16|32|48|64|80)px;?\\s*$/.test(e.getAttribute('style')||'');const bars=[...document.querySelectorAll('[style]')].filter(isBar);const out=[];const seen=new Set();for(const b of bars){let c=b;for(let i=0;i<8&&c;i++){c=c.parentElement;if(c&&R.test(c.innerText)&&c.innerText.split('\\n').length>3)break;}if(!c)continue;while(c.parentElement&&[...c.parentElement.querySelectorAll('[style]')].filter(isBar).length===1)c=c.parentElement;if(seen.has(c))continue;seen.add(c);out.push({t:c.innerText.slice(0,3000),r:Math.round(parseInt(b.style.width)/16)});}if(!out.length){alert('Отзывы не найдены. Откройте отзыв или вкладку отзывов клиники в 2ГИС.');return;}const m=location.href.match(/review\\/(\\d+)/);const cnt={};out.forEach(o=>{cnt[o.t]=(cnt[o.t]||0)+1;});const st=new Set();const uniq=out.filter(o=>!st.has(o.t)&&st.add(o.t));let items=uniq;let one=false;if(m){const d=uniq.filter(o=>cnt[o.t]>1);if(d.length===1){items=d;one=true;}}items=items.slice(0,60);const data={u:one?location.href:'',items};window.open(O+'/admin#import='+encodeURIComponent(JSON.stringify(data)),'diamond_admin');})()`;
  return "javascript:" + encodeURIComponent(code);
}
let pendingImport = null;
function takeImportFromHash() {
  const h = location.hash;
  if (!h.startsWith("#import=")) return;
  try { pendingImport = JSON.parse(decodeURIComponent(h.slice(8))); } catch (e) { pendingImport = null; }
  history.replaceState(null, "", location.pathname + "#reviews");
}
function applyImport() {
  if (!pendingImport) return;
  const have = new Set((site.reviews || []).map((x) => String(x.text || "").trim()));
  const min = +(site.settings || {}).reviewsMinRating || 5;
  const items = (pendingImport.items || []).map((it) => {
    const r = parseReview(String(it.t || ""));
    if (it.r >= 1 && it.r <= 5) r.rating = String(it.r);
    if (pendingImport.u && !r.url) r.url = pendingImport.u;
    return r;
  }).filter((r) => r.text);
  pendingImport = null;
  pasteFound = items.map((r) => ({ ...r, _dup: have.has(r.text), _on: !have.has(r.text) && +r.rating >= min }));
  renderPastePreview();
  toast(items.length ? `Из 2ГИС пришло отзывов: ${items.length}. Отмечены новые от ${min}★` : "Отзывы не распознаны");
}

function bindReviewsPaste() {
  $("manualBtn").onclick = () => addItem("reviews", {});
  $("pasteBtn").onclick = () => {
    const raw = $("pasteText").value;
    if (!raw.trim()) { $("pasteHint").textContent = "Сначала вставьте текст отзывов."; return; }
    if (URL_RE.test(raw.trim()) && cleanLines(raw).length === 1) {
      $("pasteHint").textContent = "По одной ссылке 2ГИС текст отзыва не отдаёт. Скопируйте сам отзыв (имя, дату, текст), ссылку можно вставить рядом.";
      return;
    }
    const have = new Set((site.reviews || []).map((x) => String(x.text || "").trim()));
    const found = splitReviews(raw);
    if (!found.length) { $("pasteHint").textContent = "Не нашёл отзывов в тексте. Добавьте вручную."; return; }
    pasteFound = found.map((r) => ({ ...r, _dup: have.has(r.text), _on: !have.has(r.text) }));
    $("pasteHint").textContent = "";
    $("pasteText").value = "";
    renderPastePreview();
  };
  $("bmLink").href = bookmarkletHref();
  $("bmLink").onclick = (e) => { e.preventDefault(); toast("Эту кнопку нужно перетащить на панель закладок, а нажимать уже на странице 2ГИС"); };
  renderPastePreview();
  applyImport();
  if (go.paste) { go.paste = false; setTimeout(() => $("pasteText").focus(), 50); }
}

function renderSettings() {
  const s = site.settings || {};
  $("main").innerHTML = SETTINGS.map(([g, fields]) => `<section class="box"><h3>${g}</h3><div class="fields">${fields.map(([k, l, bi, t]) => fieldHtml({ k, l, bi, t, wide: !bi && t === "area" }, s)).join("")}</div></section>`).join("");
  $("main").oninput = () => setDirty(true);
}
function readSettings() {
  const out = { ...(site.settings || {}) };
  $("main").querySelectorAll("[data-k]").forEach((i) => { out[i.dataset.k] = i.value; });
  ["lat", "lon"].forEach((k) => { const n = parseFloat(out[k]); if (!isNaN(n)) out[k] = n; });
  ["reviews", "reviewsText", "reviewsMinRating", "reviewsLimit"].forEach((k) => { const n = parseInt(out[k], 10); if (!isNaN(n)) out[k] = n; });
  return out;
}

$("saveBtn").onclick = async () => {
  try {
    if (tab === "settings") { await api("/api/admin/site", { settings: readSettings() }); $("main").oninput = null; }
    else if (SCHEMA[tab]) { rememberOpen(); await api("/api/admin/site", { [tab]: readList(tab) }); }
    await reloadSite(); setDirty(false); render(); toast("Сохранено, на сайте уже видно");
  } catch (e) { toast("Не сохранилось: " + e.message); }
};
$("discardBtn").onclick = async () => { await reloadSite(); setDirty(false); render(); };
window.addEventListener("beforeunload", (e) => { if (dirty) { e.preventDefault(); e.returnValue = ""; } });
document.addEventListener("keydown", (e) => {
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s" && dirty) { e.preventDefault(); $("saveBtn").click(); }
});

takeImportFromHash();
if (pendingImport) tab = "reviews";
enter();
