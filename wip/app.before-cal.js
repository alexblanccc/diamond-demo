const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

let S = {};
let SITE_DATA = {};
let currentLang = "ru";
try { currentLang = localStorage.getItem("diamond_lang") === "kz" ? "kz" : "ru"; } catch (e) {}
const shown = (arr) => (arr || []).filter((x) => x && !x.hidden);
const MONTHS_FULL_RU = ["января", "февраля", "марта", "апреля", "мая", "июня", "июля", "августа", "сентября", "октября", "ноября", "декабря"];
const MONTHS_FULL_KZ = ["қаңтар", "ақпан", "наурыз", "сәуір", "мамыр", "маусым", "шілде", "тамыз", "қыркүйек", "қазан", "қараша", "желтоқсан"];
function promoActive(p) {
  if (!p.until) return true;
  const end = new Date(p.until + "T23:59:59");
  return !isNaN(end) && end >= new Date();
}
function untilLabel(p, isKz) {
  if (!p.until) return "";
  const end = new Date(p.until + "T23:59:59");
  if (isNaN(end)) return "";
  const days = Math.max(0, Math.ceil((end - new Date()) / 86400000));
  return isKz
    ? `${MONTHS_FULL_KZ[end.getMonth()]} ${end.getDate()} дейін · ${days} күн қалды`
    : `до ${end.getDate()} ${MONTHS_FULL_RU[end.getMonth()]} · осталось ${days} дн.`;
}
function priceHtml(price) {
  const s = String(price || "").trim();
  const m = s.match(/^(от|бастап)\s+(.+)$/i) || s.match(/^(.+?)\s+(бастап)$/i);
  if (!m) return esc(s);
  if (/^от$/i.test(m[1])) return `<small>от</small>${esc(m[2])}`;
  return `${esc(m[1])} <small>бастап</small>`;
}
function avatarSvg(kind, i) {
  const coat = "#ffffff";
  const hair = ["#3b2a20", "#1f1a17", "#5a3b26", "#2b2b2b"][i % 4];
  const skin = ["#f1c9a5", "#e8b98f", "#f3d2b3", "#dba77f"][i % 4];
  const female = /^f/.test(kind || "");
  const hairPath = female
    ? `<path d="M60 34c-16 0-26 11-26 27 0 9 2 17 5 23h42c3-6 5-14 5-23 0-16-10-27-26-27Z" fill="${hair}"/>`
    : `<path d="M42 44c0-11 8-17 18-17s18 6 18 17c-3-5-8-8-18-8s-15 3-18 8Z" fill="${hair}"/>`;
  return `<svg class="avatar-svg" viewBox="0 0 120 100" preserveAspectRatio="xMidYMax slice" aria-hidden="true">
    <circle cx="60" cy="40" r="44" fill="#ffffff" opacity=".35"/>
    ${female ? hairPath : ""}
    <path d="M22 100c2-20 18-31 38-31s36 11 38 31Z" fill="${coat}"/>
    <path d="M48 70l12 14 12-14" fill="none" stroke="#0e9f9a" stroke-width="5" stroke-linejoin="round"/>
    <path d="M38 78c4 6 9 8 14 8" fill="none" stroke="#0a7a76" stroke-width="2.5" stroke-linecap="round"/>
    <circle cx="36" cy="88" r="3.5" fill="#0a7a76"/>
    <rect x="53" y="58" width="14" height="14" rx="5" fill="${skin}"/>
    <ellipse cx="60" cy="47" rx="17" ry="19" fill="${skin}"/>
    ${female ? "" : hairPath}
    <rect x="43" y="51" width="34" height="13" rx="6" fill="#bfe9e6" opacity=".9"/>
  </svg>`;
}

const ICONS = {
  tooth: '<path d="M7 3c-2.5 0-4 2-4 4.5 0 3 1.5 4.5 2 7.5.4 2.6 1 6 2.6 6 1.5 0 1.6-3.3 2.4-5 .4-.8 1.6-.8 2 0 .8 1.7.9 5 2.4 5 1.6 0 2.2-3.4 2.6-6 .5-3 2-4.5 2-7.5C21 5 19.5 3 17 3c-2 0-3 1-5 1S9 3 7 3Z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/>',
  spark: '<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3Zm6 11 .9 2.1L21 17l-2.1.9L18 20l-.9-2.1L15 17l2.1-.9L18 14Z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/>',
  smile: '<circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M8 14c1 1.5 2.4 2.2 4 2.2s3-.7 4-2.2" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><circle cx="9" cy="10" r="1.2" fill="currentColor"/><circle cx="15" cy="10" r="1.2" fill="currentColor"/>',
  implant: '<path d="M8 3h8l-1 5H9L8 3Zm1.5 5h5M10 11h4M10 14h4M10.5 17h3M11 20h2M9 8l1 12m5-12-1 12" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/>',
  heart: '<path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10Z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/>',
  plus: '<rect x="3" y="3" width="18" height="18" rx="5" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M12 8v8M8 12h8" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
  gift: '<rect x="3" y="9" width="18" height="12" rx="2" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M3 13h18M12 9v12M12 9c-2-4-6-4-6-1.5S10 9 12 9Zm0 0c2-4 6-4 6-1.5S14 9 12 9Z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/>',
  shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="M9 12l2 2 4-4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>',
  scan: '<path d="M3 7V5a2 2 0 0 1 2-2h2M17 3h2a2 2 0 0 1 2 2v2M21 17v2a2 2 0 0 1-2 2h-2M7 21H5a2 2 0 0 1-2-2v-2" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><circle cx="12" cy="12" r="3" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M7 12h10" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>',
  badge: '<circle cx="12" cy="9" r="6" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M8.2 14.5L7 22l5-3 5 3-1.2-7.5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/>'
};

const DOCTOR_AVATAR = `<svg viewBox="0 0 24 24" width="64" height="64" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="8" r="4"/><path d="M6 20v-1a6 6 0 0 1 12 0v1"/><path d="M12 12v3m-1.5-1.5h3" stroke-width="1.8" stroke-linecap="round"/></svg>`;
const EYE = '<svg viewBox="0 0 24 24"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="12" cy="12" r="3" fill="currentColor"/></svg>';

function iconFor(title) {
  const t = title.toLowerCase();
  if (t.includes("чистк") || t.includes("тазалау")) return ICONS.spark;
  if (t.includes("детск") || t.includes("балалар")) return ICONS.smile;
  if (t.includes("имплант")) return ICONS.implant;
  if (t.includes("уздечк") || t.includes("үзбе")) return ICONS.heart;
  if (t.includes("неотлож") || t.includes("срочн") || t.includes("шұғыл")) return ICONS.plus;
  if (t.includes("сертификат")) return ICONS.gift;
  return ICONS.tooth;
}

function links() {
  const tel = "tel:+" + String(S.phone || "").replace(/\D/g, "");
  const wa = "https://wa.me/" + (S.whatsapp || "");
  const firm = `https://2gis.kz/pavlodar/firm/${S.firmId}`;
  const route = `https://2gis.kz/pavlodar/directions/points/%7C${S.lon}%2C${S.lat}%3B${S.firmId}`;
  return { tel, wa, firm, route, reviews: firm + "/tab/reviews" };
}

const MONTHS_RU = ["янв", "фев", "мар", "апр", "май", "июн", "июл", "авг", "сен", "окт", "ноя", "дек"];
const DAYS_RU = ["вс", "пн", "вт", "ср", "чт", "пт", "сб"];
const MONTHS_KZ = ["қаң", "ақп", "нау", "сәу", "мам", "мау", "шіл", "там", "қыр", "қаз", "қар", "жел"];
const DAYS_KZ = ["жс", "дс", "сс", "ср", "бс", "жм", "сн"];

let selectedDate = null;
let selectedTime = null;

function renderDynamic(instant) {
  const isKz = currentLang === "kz";
  const set = (id, v) => { const el = $(id); if (el) el.textContent = v ?? ""; };
  const L = links();

  set("brandName", S.name);
  set("brandTag", isKz ? (S.tagline_kz || S.tagline) : S.tagline);
  set("phoneTop", S.phone);
  set("promoBadge", isKz ? (S.promoBadge_kz || S.promoBadge) : S.promoBadge);
  set("promoTitle", isKz ? (S.promoTitle_kz || S.promoTitle) : S.promoTitle);
  set("promoText", isKz ? (S.promoText_kz || S.promoText) : S.promoText);
  set("emergencyText", isKz ? (S.emergencyText_kz || S.emergencyText) : S.emergencyText);
  set("ratingNum", S.rating);
  set("reviewsNum", S.reviews);
  set("followersNum", isKz ? (S.followers_kz || S.followers) : S.followers);
  set("addr", isKz ? (S.address_kz || S.address) : S.address);
  set("hours", isKz ? (S.hours_kz || S.hours) : S.hours);
  set("phoneC", S.phone);
  set("phoneBook", S.phone);
  set("tbHours", isKz ? (S.hours_kz || S.hours) : S.hours);
  set("aboutText", isKz ? (S.about_kz || S.about) : S.about);
  set("footTag", isKz ? (S.tagline_kz || S.tagline) : S.tagline);
  set("licText", isKz ? (S.license_kz || S.license) : S.license);

  // Promos
  const tagsRu = ["Акция", "Kaspi", "Бесплатно"];
  const tagsKz = ["Акция", "Kaspi", "Тегін"];
  const tags = isKz ? tagsKz : tagsRu;
  const promosGrid = $("promosGrid");
  if (promosGrid) {
    promosGrid.innerHTML = shown(SITE_DATA.promos).filter(promoActive)
      .map((p, i) => {
        const title = isKz ? (p.title_kz || p.title) : p.title;
        const price = isKz ? (p.price_kz || p.price) : p.price;
        const note = isKz ? (p.note_kz || p.note) : p.note;
        const tag = isKz ? (p.tag_kz || p.tag || tags[i]) : (p.tag || tags[i]);
        const until = untilLabel(p, isKz);
        return `<article class="promo reveal" style="--d:${i}">
          ${p.img ? `<img src="${esc(p.img)}" alt="" loading="lazy">` : ""}
          <span class="promo-tag">${esc(tag || "Акция")}</span>
          <b>${esc(price)}</b>
          <h3>${esc(title)}</h3>
          <p>${esc(note)}</p>
          ${until ? `<span class="promo-until">${esc(until)}</span>` : ""}
        </article>`;
      })
      .join("");
  }

  // Services
  const services = shown(SITE_DATA.services);
  const servicesGrid = $("servicesGrid");
  if (servicesGrid) {
    servicesGrid.innerHTML = services
      .map((x, i) => {
        const title = isKz ? (x.title_kz || x.title) : x.title;
        const desc = isKz ? (x.desc_kz || x.desc) : x.desc;
        const price = isKz ? (x.price_kz || x.price) : x.price;
        const tag = isKz ? (x.tag_kz || x.tag) : x.tag;
        const bookBtn = isKz ? "Жазылу" : "Записаться";
        return `<article class="card reveal" style="--d:${i % 4}">
          <div class="svc-ico"><svg viewBox="0 0 24 24">${iconFor(x.title)}</svg></div>
          <h3>${esc(title)}</h3>
          <p>${esc(desc)}</p>
          <div class="card-foot">
            ${price ? `<span class="price">${priceHtml(price)}</span>` : tag ? `<span class="tag">${esc(tag)}</span>` : "<span></span>"}
            <a class="btn btn-ghost" href="#book" data-service="${esc(title)}">${bookBtn}</a>
          </div>
        </article>`;
      })
      .join("");
  }

  const sSelect = $("serviceSelect");
  if (sSelect) {
    const curVal = sSelect.value;
    const defOpt = isKz ? "Консультация (Кеңес)" : "Консультация";
    sSelect.innerHTML = `<option value="">${defOpt}</option>` +
      services.map((x) => {
        const title = isKz ? (x.title_kz || x.title) : x.title;
        return `<option value="${esc(title)}" ${title === curVal ? "selected" : ""}>${esc(title)}</option>`;
      }).join("");

    document.querySelectorAll("[data-service]").forEach((a) =>
      a.addEventListener("click", () => {
        sSelect.value = a.dataset.service;
      })
    );
  }

  // Doctors
  const docsGrid = $("doctorsGrid");
  if (docsGrid) {
    docsGrid.innerHTML = shown(SITE_DATA.doctors)
      .map((d, i) => {
        const name = isKz ? (d.name_kz || d.name) : d.name;
        const role = isKz ? (d.role_kz || d.role) : d.role;
        const exp = isKz ? (d.exp_kz || d.exp) : d.exp;
        return `<article class="card reveal" style="--d:${i % 4}">
          <div class="doc-photo">${d.photo ? `<img src="${esc(d.photo)}" alt="${esc(name)}" loading="lazy">` : avatarSvg(d.avatar, i)}</div>
          <div class="doc-body">
            <h3>${esc(name)}</h3>
            <div class="role">${esc(role)}</div>
            <p>${esc(exp)}</p>
          </div>
        </article>`;
      })
      .join("");
  }

  // Trust / Safety
  const trustGrid = $("trustGrid");
  if (trustGrid && SITE_DATA.trust) {
    trustGrid.innerHTML = shown(SITE_DATA.trust)
      .map((t, i) => {
        const title = isKz ? (t.title_kz || t.title) : t.title;
        const items = isKz ? (t.items_kz || t.items) : t.items;
        const iconSvg = ICONS[t.icon] || ICONS.shield;
        return `<article class="trust-i reveal" style="--d:${i}">
          <div class="trust-ico"><svg viewBox="0 0 24 24">${iconSvg}</svg></div>
          <h3>${esc(title)}</h3>
          <ul>${(items || []).map((it) => `<li>${esc(it)}</li>`).join("")}</ul>
        </article>`;
      })
      .join("");
  }

  // FAQ
  const faqList = $("faqList");
  if (faqList && SITE_DATA.faq) {
    faqList.innerHTML = shown(SITE_DATA.faq)
      .map((f, i) => {
        const q = isKz ? (f.q_kz || f.q) : f.q;
        const a = isKz ? (f.a_kz || f.a) : f.a;
        return `<details ${i === 0 ? "open" : ""}>
          <summary>${esc(q)}</summary>
          <div class="ans"><p>${esc(a)}</p></div>
        </details>`;
      })
      .join("");
  }

  cases(shown(SITE_DATA.cases));
  reels(SITE_DATA.reels || []);
  renderDayChips();
  if (instant) {
    document.querySelectorAll(".reveal").forEach((e) => e.classList.add("in"));
  } else {
    observe();
  }
}

function applyLang(lang, skipRender) {
  currentLang = lang;
  try { localStorage.setItem("diamond_lang", lang); } catch (e) {}
  document.documentElement.lang = lang === "kz" ? "kk" : "ru";

  document.querySelectorAll(".lang").forEach((g) => { g.dataset.cur = lang; });
  document.querySelectorAll("[data-lang]").forEach((b) => {
    b.classList.toggle("on", b.dataset.lang === lang);
  });

  document.querySelectorAll("[data-kz]").forEach((el) => {
    if (el.dataset.ru === undefined) el.dataset.ru = el.textContent;
    el.textContent = lang === "kz" ? el.dataset.kz : el.dataset.ru;
  });

  document.querySelectorAll("[data-kz-ph]").forEach((el) => {
    if (el.dataset.ruPh === undefined) el.dataset.ruPh = el.placeholder;
    el.placeholder = lang === "kz" ? el.dataset.kzPh : el.dataset.ruPh;
  });

  if (!skipRender) renderDynamic(true);
}

let switching = false;
function switchLang(lang) {
  if (lang === currentLang || switching) return;
  document.querySelectorAll(".lang").forEach((g) => { g.dataset.cur = lang; });
  if (reduce) { applyLang(lang); return; }
  switching = true;
  document.body.classList.add("lang-out");
  setTimeout(() => {
    applyLang(lang);
    requestAnimationFrame(() => {
      document.body.classList.remove("lang-out");
      switching = false;
    });
  }, 220);
}

function initLang() {
  document.querySelectorAll("[data-lang]").forEach((b) => {
    b.addEventListener("click", () => switchLang(b.dataset.lang));
  });
  document.querySelectorAll(".lang").forEach((g) => { g.dataset.cur = currentLang; });
  if (currentLang === "kz") applyLang("kz", true);
}

async function load() {
  try {
    SITE_DATA = await (await fetch("/api/site")).json();
  } catch (e) {
    SITE_DATA = {};
  }
  S = SITE_DATA.settings || {};
  const L = links();
  const href = (id, v) => { const el = $(id); if (el) el.href = v; };

  ["phoneTop", "callSos", "fabCall", "phoneC", "phoneBook", "mbarCall"].forEach((id) => href(id, L.tel));
  ["waHero", "waSos", "fabWa", "mbarWa", "waFaq"].forEach((id) => href(id, L.wa));
  href("gisOpen", L.firm);
  href("gisRoute", L.route);
  href("gisReviews", L.reviews);
  const ig = "https://www.instagram.com/" + S.instagram + "/";
  href("igC", ig);
  href("igMore", ig + "reels/");
  href("fabIg", ig);
  href("mbarIg", ig);

  const statReviews = document.querySelector('[data-count="622"]');
  if (statReviews) statReviews.dataset.count = S.reviews;

  initLang();
  renderDynamic();
}

function observe() {
  const els = document.querySelectorAll(".reveal:not(.in)");
  if (reduce || !("IntersectionObserver" in window)) {
    els.forEach((e) => e.classList.add("in"));
    return;
  }
  const io = new IntersectionObserver(
    (entries) => entries.forEach((en) => {
      if (en.isIntersecting) { en.target.classList.add("in"); io.unobserve(en.target); }
    }),
    { threshold: 0.12, rootMargin: "0px 0px -40px 0px" }
  );
  els.forEach((e) => io.observe(e));
}

function counters() {
  const run = (el) => {
    const to = parseFloat(el.dataset.count);
    const dec = +(el.dataset.dec || 0);
    if (reduce) { el.textContent = to.toFixed(dec); return; }
    const t0 = performance.now();
    const dur = 1600;
    const step = (t) => {
      const p = Math.min(1, (t - t0) / dur);
      el.textContent = (to * (1 - Math.pow(1 - p, 3))).toFixed(dec);
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  };
  const io = new IntersectionObserver((en) => en.forEach((e) => {
    if (e.isIntersecting) { run(e.target); io.unobserve(e.target); }
  }), { threshold: 0.5 });
  document.querySelectorAll("[data-count]").forEach((el) => io.observe(el));
}

function header() {
  const top = $("top");
  const mbar = $("mbar");
  const hero = $("hero");
  const book = $("book");
  const onScroll = () => {
    top.classList.toggle("scrolled", window.scrollY > 10);
    const pastHero = window.scrollY > (hero ? hero.offsetHeight * 0.6 : 300);
    const r = book ? book.getBoundingClientRect() : { top: 9999, bottom: 0 };
    const inBook = r.top < window.innerHeight * 0.8 && r.bottom > 0;
    if (mbar) mbar.classList.toggle("show", pastHero && !inBook);
  };
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  const burger = $("burger");
  const mnav = $("mnav");
  if (burger && mnav) {
    burger.addEventListener("click", () => {
      const open = !mnav.classList.contains("open");
      mnav.classList.toggle("open", open);
      burger.setAttribute("aria-expanded", open);
    });
    mnav.querySelectorAll("a").forEach((a) => a.addEventListener("click", () => {
      mnav.classList.remove("open");
      burger.setAttribute("aria-expanded", "false");
    }));
  }

  const navLinks = [...document.querySelectorAll("#nav a")];
  const io = new IntersectionObserver((en) => en.forEach((e) => {
    if (!e.isIntersecting) return;
    navLinks.forEach((a) => a.classList.toggle("active", a.getAttribute("href") === "#" + e.target.id));
  }), { rootMargin: "-45% 0px -50% 0px" });
  navLinks.forEach((a) => { const sec = document.querySelector(a.getAttribute("href")); if (sec) io.observe(sec); });
}

let CASES = [];
function cases(list) {
  CASES = list;
  const isKz = currentLang === "kz";
  const caseTabs = $("caseTabs");
  if (!list.length) { if ($("results")) $("results").style.display = "none"; return; }
  if (caseTabs) {
    caseTabs.innerHTML = list.map((c, i) => {
      const title = isKz ? (c.title_kz || c.title) : c.title;
      return `<button class="case-tab ${i ? "" : "on"}" role="tab" data-i="${i}">${esc(title)}</button>`;
    }).join("");
    caseTabs.style.display = list.length > 1 ? "" : "none";
    caseTabs.querySelectorAll(".case-tab").forEach((b) => b.addEventListener("click", () => showCase(+b.dataset.i)));
  }
  showCase(0, true);
}

function showCase(i, first) {
  const c = CASES[i];
  if (!c) return;
  const isKz = currentLang === "kz";
  const ba = $("ba");
  document.querySelectorAll(".case-tab").forEach((b) => b.classList.toggle("on", +b.dataset.i === i));
  const apply = () => {
    if ($("baAfter")) $("baAfter").src = c.after;
    if ($("baBeforeImg")) $("baBeforeImg").src = c.before;
    if ($("caseTitle")) $("caseTitle").textContent = isKz ? (c.title_kz || c.title) : c.title;
    if ($("caseText")) $("caseText").textContent = (isKz ? (c.text_kz || c.text) : c.text) || "";
    if ($("caseCredit")) $("caseCredit").textContent = c.credit || "";
    if (ba) ba.classList.remove("swap");
  };
  if (first || reduce) return apply();
  if (ba) ba.classList.add("swap");
  setTimeout(apply, 300);
}

function slider() {
  const r = $("baRange");
  if (!r) return;
  const apply = () => {
    if ($("baBefore")) $("baBefore").style.clipPath = `inset(0 ${100 - r.value}% 0 0)`;
    if ($("baLine")) $("baLine").style.left = r.value + "%";
  };
  r.addEventListener("input", apply);
  apply();
  if (reduce) return;
  let touched = false;
  r.addEventListener("pointerdown", () => { touched = true; });
  const io = new IntersectionObserver((en) => {
    if (!en[0].isIntersecting) return;
    io.disconnect();
    const keys = [50, 22, 78, 50];
    const t0 = performance.now();
    const seg = 750;
    const step = (t) => {
      if (touched) return;
      const k = Math.min(keys.length - 1.0001, (t - t0) / seg);
      const i = Math.floor(k);
      const p = k - i;
      const e = p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;
      r.value = keys[i] + (keys[i + 1] - keys[i]) * e;
      apply();
      if ((t - t0) / seg < keys.length - 1) requestAnimationFrame(step);
    };
    setTimeout(() => requestAnimationFrame(step), 400);
  }, { threshold: 0.6 });
  io.observe($("ba"));
}

function reelId(url) {
  const m = String(url).match(/instagram\.com\/(reel|p)\/([A-Za-z0-9_-]+)/);
  return m ? { kind: m[1], id: m[2] } : null;
}

function reels(list) {
  const track = $("reelsGrid");
  if (!track) return;
  list = list.map((r) => (typeof r === "string" ? { url: r } : r)).filter((r) => !r.hidden && reelId(r.url));
  if (!list.length) { if ($("reels")) $("reels").style.display = "none"; return; }
  const isKz = currentLang === "kz";
  const igUrl = "https://www.instagram.com/" + (S.instagram || "") + "/reels/";
  track.innerHTML = list
    .map((r, i) => `<button class="reel-card reveal in" style="--d:${i % 4}" data-url="${esc(r.url)}" data-embed="${r.embed === false ? 0 : 1}" aria-label="Смотреть видео: ${esc(r.title || "рилс")}">${r.cover ? `<img src="${esc(r.cover)}" alt="" loading="lazy">` : `<span class="reel-noimg"><img src="img/logo.jpg" alt=""></span>`}<span class="reel-play"></span><span class="reel-meta">${r.title ? `<b>${esc(r.title)}</b>` : ""}${r.views ? `<span class="reel-views">${EYE}${esc(r.views)}</span>` : ""}</span></button>`)
    .join("") +
    `<a class="reel-card reel-more reveal in" href="${esc(igUrl)}" target="_blank" rel="noopener">
      <span class="reel-more-in">
        <span class="reel-more-ico"><svg viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="5" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="12" cy="12" r="4" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="17.3" cy="6.7" r="1.3" fill="currentColor"/></svg></span>
        <b>${isKz ? "Барлық видео" : "Все видео"}</b>
        <span>${isKz ? "Instagram-да 430-дан астам жарияланым" : "Ещё 430+ публикаций в Instagram"}</span>
        <span class="reel-more-btn">@${esc(S.instagram || "")} →</span>
      </span>
    </a>`;
  track.querySelectorAll("button.reel-card").forEach((b) => b.addEventListener("click", () => {
    if (b.dataset.embed === "0") { window.open(b.dataset.url, "_blank", "noopener"); return; }
    openReel(b.dataset.url);
  }));

  const prev = $("reelPrev");
  const next = $("reelNext");
  const upd = () => {
    if (prev) prev.disabled = track.scrollLeft < 8;
    if (next) next.disabled = track.scrollLeft + track.clientWidth >= track.scrollWidth - 8;
  };
  const by = (dir) => track.scrollBy({ left: dir * track.clientWidth * 0.75, behavior: "smooth" });
  if (prev) prev.onclick = () => by(-1);
  if (next) next.onclick = () => by(1);
  track.onscroll = upd;
  if (!reels.bound) { window.addEventListener("resize", () => track.onscroll && track.onscroll()); reels.bound = true; }
  setTimeout(upd, 300);
}

function openReel(url) {
  const r = reelId(url);
  if (!r) return;
  $("reelFrame").innerHTML = `<blockquote class="instagram-media" data-instgrm-permalink="https://www.instagram.com/${r.kind}/${r.id}/" data-instgrm-version="14"><div class="reel-loading">Загружаем видео…</div></blockquote>`;
  const run = () => window.instgrm && window.instgrm.Embeds.process();
  if (window.instgrm) run();
  else if (!document.getElementById("igjs")) {
    const s = document.createElement("script");
    s.id = "igjs";
    s.async = true;
    s.src = "https://www.instagram.com/embed.js";
    s.onload = run;
    document.body.appendChild(s);
  }
  $("reelOpen").href = url;
  const token = (openReel.t = (openReel.t || 0) + 1);
  setTimeout(() => {
    if (token !== openReel.t || !$("reelModal").classList.contains("open")) return;
    const f = $("reelFrame").querySelector("iframe");
    if (!f || f.offsetHeight < 50) {
      $("reelFrame").innerHTML = `<div class="reel-fallback"><img src="img/logo.jpg" alt=""><b>Это видео можно посмотреть только в Instagram</b><a class="btn btn-main" href="${esc(url)}" target="_blank" rel="noopener">Смотреть в Instagram</a></div>`;
    }
  }, 7000);
  $("reelModal").classList.add("open");
  $("reelModal").setAttribute("aria-hidden", "false");
  document.body.style.overflow = "hidden";
}

function closeReel() {
  $("reelModal").classList.remove("open");
  $("reelModal").setAttribute("aria-hidden", "true");
  document.body.style.overflow = "";
  setTimeout(() => { $("reelFrame").innerHTML = ""; }, 300);
}

function modal() {
  const rc = $("reelClose");
  if (rc) rc.onclick = closeReel;
  const rm = $("reelModal");
  if (rm) rm.addEventListener("click", (e) => { if (e.target.id === "reelModal") closeReel(); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && $("reelModal").classList.contains("open")) closeReel(); });
}

function map() {
  const box = $("mapBox");
  if (!box) return;
  const io = new IntersectionObserver((en) => {
    if (!en[0].isIntersecting || !S.firmId) return;
    io.disconnect();
    const opts = { pos: { lat: S.lat, lon: S.lon, zoom: 16 }, opt: { city: "pavlodar" }, org: String(S.firmId) };
    const f = document.createElement("iframe");
    f.title = "Карта 2ГИС";
    f.src = "https://widgets.2gis.com/widget?type=firmsonmap&options=" + encodeURIComponent(JSON.stringify(opts));
    f.onload = () => { f.classList.add("ready"); const ph = box.querySelector(".map-ph"); if (ph) setTimeout(() => ph.remove(), 600); };
    box.appendChild(f);
  }, { rootMargin: "300px 0px" });
  io.observe(box);
}

function renderDayChips() {
  const box = $("dayChips");
  if (!box) return;
  const isKz = currentLang === "kz";
  const daysArr = isKz ? DAYS_KZ : DAYS_RU;
  const monthsArr = isKz ? MONTHS_KZ : MONTHS_RU;
  const today = new Date();
  const chipsHtml = [];

  let firstValidDate = null;

  for (let i = 0; i < 14; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    const dow = d.getDay();
    const dateNum = d.getDate();
    const month = monthsArr[d.getMonth()];
    const dayName = i === 0 ? (isKz ? "бүгін" : "сегодня") : i === 1 ? (isKz ? "ертең" : "завтра") : daysArr[dow];
    const isSun = dow === 0 || (i === 0 && slotsFor(dow, true).length === 0);
    const dateIso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(dateNum).padStart(2, "0")}`;

    if (!isSun && !firstValidDate) firstValidDate = dateIso;

    if (isSun) {
      chipsHtml.push(`<button type="button" class="chip disabled" disabled aria-disabled="true">
        <span>${dateNum} ${month}</span>
        <small>${dow === 0 ? `${daysArr[0]} (${isKz ? "демалыс" : "вых"})` : (isKz ? "бос уақыт жоқ" : "мест нет")}</small>
      </button>`);
    } else {
      chipsHtml.push(`<button type="button" class="chip" data-date="${dateIso}" data-dow="${dow}" data-today="${i === 0 ? 1 : 0}" data-disp="${dateNum} ${month} (${daysArr[dow]})">
        <span>${dateNum} ${month}</span>
        <small>${dayName}</small>
      </button>`);
    }
  }

  box.innerHTML = chipsHtml.join("");

  if (!selectedDate || selectedDate.dow === 0) {
    const firstBtn = box.querySelector(`[data-date="${firstValidDate}"]`);
    if (firstBtn) selectDayBtn(firstBtn);
  } else {
    const activeBtn = box.querySelector(`[data-date="${selectedDate.iso}"]`);
    if (activeBtn) selectDayBtn(activeBtn);
    else {
      const firstBtn = box.querySelector(`[data-date="${firstValidDate}"]`);
      if (firstBtn) selectDayBtn(firstBtn);
    }
  }

  box.querySelectorAll(".chip:not(.disabled)").forEach((b) => {
    b.addEventListener("click", () => selectDayBtn(b));
  });
}

function selectDayBtn(btn) {
  document.querySelectorAll("#dayChips .chip").forEach((b) => b.classList.remove("on"));
  btn.classList.add("on");
  selectedDate = {
    iso: btn.dataset.date,
    dow: +btn.dataset.dow,
    today: btn.dataset.today === "1",
    display: btn.dataset.disp
  };
  renderTimeChips(selectedDate.dow, selectedDate.today);
}

function slotsFor(dow, isToday) {
  const end = dow === 6 ? 17.5 : 18.5;
  const now = new Date();
  const minH = isToday ? now.getHours() + now.getMinutes() / 60 + 1 : 0;
  const out = [];
  for (let h = 9; h <= end; h += 0.5) {
    if (h >= minH) out.push(`${Math.floor(h)}:${h % 1 ? "30" : "00"}`);
  }
  return out;
}

function renderTimeChips(dow, isToday) {
  const box = $("timeChips");
  if (!box) return;
  const isKz = currentLang === "kz";
  const timesList = slotsFor(dow, isToday);
  const anyLabel = isKz ? "Кез келген" : "Любое";

  box.innerHTML = `<button type="button" class="chip" data-time="">${anyLabel}</button>` + timesList
    .map((t) => `<button type="button" class="chip" data-time="${t}">${t}</button>`)
    .join("");

  if (selectedTime && !timesList.includes(selectedTime)) selectedTime = null;

  const activeTimeBtn = box.querySelector(`[data-time="${selectedTime || ""}"]`);
  if (activeTimeBtn) activeTimeBtn.classList.add("on");

  box.querySelectorAll(".chip").forEach((b) => {
    b.addEventListener("click", () => {
      box.querySelectorAll(".chip").forEach((x) => x.classList.remove("on"));
      b.classList.add("on");
      selectedTime = b.dataset.time || null;
    });
  });
}

function setupPhoneMask(input) {
  if (!input) return;
  input.addEventListener("input", () => {
    let raw = input.value.replace(/\D/g, "");
    if (!raw) { input.value = ""; return; }
    if (raw.length === 11 && (raw[0] === "8" || raw[0] === "7")) {
      raw = raw.slice(1);
    } else if (raw.length > 11 && raw[0] === "7") {
      raw = raw.slice(1, 11);
    }
    raw = raw.slice(0, 10);
    let res = "+7 ";
    if (raw.length > 0) res += "(" + raw.slice(0, 3);
    if (raw.length >= 3) res += ") ";
    if (raw.length > 3) res += raw.slice(3, 6);
    if (raw.length >= 6) res += "-";
    if (raw.length > 6) res += raw.slice(6, 8);
    if (raw.length >= 8) res += "-";
    if (raw.length > 8) res += raw.slice(8, 10);
    input.value = res;
  });
}

function form() {
  const f = $("bookForm");
  if (!f) return;
  const msg = $("formMsg");
  const phone = $("phoneInput");
  setupPhoneMask(phone);

  f.addEventListener("submit", (e) => {
    e.preventDefault();
    const isKz = currentLang === "kz";
    msg.className = "form-msg";
    msg.textContent = "";
    f.querySelectorAll(".bad").forEach((x) => x.classList.remove("bad"));

    const name = f.elements.name.value.trim();
    const phoneVal = phone ? phone.value.trim() : "";
    const bad = (el, text) => {
      el.classList.remove("bad");
      void el.offsetWidth;
      el.classList.add("bad");
      el.focus();
      msg.className = "form-msg err";
      msg.textContent = text;
    };

    if (!name) return bad(f.elements.name, isKz ? "Сізге қалай хабарласу керектігін көрсетіңіз." : "Укажите, как к вам обращаться.");
    if (phoneVal && phoneVal.replace(/\D/g, "").length < 10) {
      return bad(phone, isKz ? "Телефон нөмірін тексеріңіз." : "Проверьте номер телефона.");
    }
    if (!f.elements.consent.checked) {
      return bad(f.elements.consent, isKz ? "Деректерді өңдеуге келісім беру қажет." : "Нужно согласие на обработку данных.");
    }

    const whenDisp = (selectedDate ? selectedDate.display : "") + (selectedTime ? (isKz ? `, сағат ${selectedTime}` : ` в ${selectedTime}`) : "");
    const service = f.elements.service.value;
    const comment = f.elements.comment.value.trim();

    let lines = [];
    if (isKz) {
      lines = [
        `Сәлеметсіз бе! ${S.name || "Diamond"} клиникасына жазылғым келеді.`,
        `Аты-жөні: ${name}`,
        phoneVal ? `Телефон: ${phoneVal}` : "",
        `Қызмет: ${service || "кеңес алу"}`,
        `Ыңғайлы уақыт: ${whenDisp || "бос уақытты айтыңызшы"}`,
        comment ? `Пікір: ${comment}` : "",
      ].filter(Boolean);
    } else {
      lines = [
        `Здравствуйте! Хочу записаться на приём в ${S.name || "Diamond"}.`,
        `Имя: ${name}`,
        phoneVal ? `Телефон: ${phoneVal}` : "",
        `Услуга: ${service || "консультация"}`,
        `Когда удобно: ${whenDisp || "подскажите свободное время"}`,
        comment ? `Комментарий: ${comment}` : "",
      ].filter(Boolean);
    }

    const wa = "https://wa.me/" + (S.whatsapp || "77055808170") + "?text=" + encodeURIComponent(lines.join("\n"));

    fetch("/api/book", {
      method: "POST",
      keepalive: true,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, phone: phoneVal, service, date: whenDisp, comment, consent: true, channel: "whatsapp" }),
    }).catch(() => {});

    const w = window.open(wa, "_blank");
    if (w) w.opener = null;
    else window.location.href = wa;

    f.reset();
    renderDayChips();
    msg.className = "form-msg ok";
    msg.textContent = isKz
      ? "WhatsApp ашылуда. Чатта «Жіберу» түймесін басыңыз, әкімші жауап береді."
      : "Открываем WhatsApp. Нажмите «Отправить» в чате, и администратор подтвердит время.";
  });
}

header();
slider();
modal();
form();
counters();
observe();
load().then(map);
