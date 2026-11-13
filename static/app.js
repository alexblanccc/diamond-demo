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
          <div class="svc-head">
            <div class="svc-ico"><svg viewBox="0 0 24 24">${iconFor(x.title)}</svg></div>
            ${tag ? `<span class="svc-badge">${esc(tag)}</span>` : ""}
          </div>
          <h3>${x.slug ? `<a class="svc-link" href="/uslugi/${esc(x.slug)}">${esc(title)}</a>` : esc(title)}</h3>
          <p>${esc(desc)}</p>
          ${x.slug ? `<a class="svc-more" href="/uslugi/${esc(x.slug)}">${isKz ? "Толығырақ →" : "Подробнее →"}</a>` : ""}
          <div class="card-foot">
            <span class="price">${priceHtml(price || (isKz ? "Кеңес 0 ₸" : "Консультация 0 ₸"))}</span>
            <a class="btn btn-ghost" href="#book" data-service="${esc(title)}">${bookBtn}</a>
          </div>
        </article>`;
      })
      .join("") + `<article class="card svc-cta reveal" style="--d:3">
          <div class="svc-ico"><svg viewBox="0 0 24 24"><path d="M12 3a9 9 0 0 0-7.8 13.5L3 21l4.6-1.2A9 9 0 1 0 12 3Z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg></div>
          <h3>${isKz ? "Қажетті қызметті таппадыңыз ба?" : "Не нашли свою услугу?"}</h3>
          <p>${isKz ? "Не мазалайтынын жазыңыз. Дәрігер тегін кеңесте көмектеседі." : "Напишите, что беспокоит. Врач подскажет на бесплатной консультации."}</p>
          <div class="card-foot"><span></span><a class="btn btn-wa" href="https://wa.me/${esc(S.whatsapp || "77055808170")}" target="_blank" rel="noopener">${isKz ? "WhatsApp-қа жазу" : "Спросить в WhatsApp"}</a></div>
        </article>`;
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

  renderReviews();
  reels(SITE_DATA.reels || []);
  results(shown(SITE_DATA.cases || []));
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
    const res = await fetch("/api/site");
    if (!res.ok) throw new Error();
    SITE_DATA = await res.json();
  } catch (e) {
    const localSaved = localStorage.getItem("diamond_site_data");
    if (localSaved) {
      try { SITE_DATA = JSON.parse(localSaved); } catch(err) {}
    }
    if (!SITE_DATA || !SITE_DATA.settings) {
      try {
        SITE_DATA = await (await fetch("data.json", { cache: "no-store" })).json();
      } catch (e2) {
        SITE_DATA = {};
      }
    }
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
  href("mcRoute", L.route);
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

function renderReviews() {
  const sec = $("reviewsSec");
  if (!sec) return;
  const isKz = currentLang === "kz";
  const L = links();
  const set = (id, v) => { const el = $(id); if (el) el.textContent = v; };
  set("revRating", S.rating || "5.0");
  set("revCount", S.reviews || "");
  set("revTextCount", S.reviewsText || "");
  $("revAll").href = L.reviews;
  $("revWrite").href = L.reviews;

  const min = +S.reviewsMinRating || 5;
  const limit = +S.reviewsLimit || 9;
  const list = shown(SITE_DATA.reviews)
    .filter((r) => (+r.rating || 0) >= min && String(r.text || "").trim())
    .sort((a, b) => String(b.date || "").localeCompare(String(a.date || "")))
    .slice(0, limit);

  const track = $("revTrack");
  sec.classList.toggle("rev-empty", !list.length);
  if (!list.length) { track.innerHTML = ""; return; }

  const mFull = isKz ? MONTHS_FULL_KZ : MONTHS_FULL_RU;
  const fmt = (iso) => {
    const d = new Date(iso + "T00:00");
    if (isNaN(d)) return "";
    return isKz ? `${d.getFullYear()} ж. ${d.getDate()} ${mFull[d.getMonth()]}` : `${d.getDate()} ${mFull[d.getMonth()]} ${d.getFullYear()}`;
  };
  const more = isKz ? "Толығырақ" : "Читать полностью";
  const less = isKz ? "Жасыру" : "Свернуть";
  const hues = [172, 190, 150, 205, 165];
  track.innerHTML = list.map((r, i) => {
    const name = String(r.author || (isKz ? "Пациент" : "Пациент")).trim();
    return `<article class="rev-card">
      <header>
        <span class="rev-ava" style="--h:${hues[i % hues.length]}">${esc(name.charAt(0).toUpperCase())}</span>
        <div><b>${esc(name)}</b><small>${esc(fmt(r.date))}</small></div>
        <span class="rev-mini-stars" aria-label="${+r.rating} из 5">${"★".repeat(+r.rating || 5)}</span>
      </header>
      ${r.service ? `<span class="rev-svc">${esc(r.service)}</span>` : ""}
      <p class="rev-text">${esc(r.text)}</p>
      <button type="button" class="rev-more" hidden>${more}</button>
      <footer><a href="${esc(r.url || "https://2gis.kz/pavlodar/firm/70000001083785122/tab/reviews")}" target="_blank" rel="noopener">${isKz ? "2ГИС-те ашу" : "Открыть в 2ГИС"}</a></footer>
    </article>`;
  }).join("");

  requestAnimationFrame(() => {
    track.querySelectorAll(".rev-card").forEach((c) => {
      const p = c.querySelector(".rev-text");
      const b = c.querySelector(".rev-more");
      if (p.scrollHeight > p.clientHeight + 4) {
        b.hidden = false;
        b.onclick = () => { const open = c.classList.toggle("open"); b.textContent = open ? less : more; };
      }
    });
  });

  const prev = $("revPrev");
  const next = $("revNext");
  const upd = () => {
    prev.disabled = track.scrollLeft < 8;
    next.disabled = track.scrollLeft + track.clientWidth >= track.scrollWidth - 8;
    $("revCtrl").style.visibility = track.scrollWidth > track.clientWidth + 8 ? "" : "hidden";
  };
  prev.onclick = () => track.scrollBy({ left: -track.clientWidth * 0.8, behavior: "smooth" });
  next.onclick = () => track.scrollBy({ left: track.clientWidth * 0.8, behavior: "smooth" });
  track.onscroll = upd;
  setTimeout(upd, 200);
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
    f.onload = () => { f.classList.add("ready"); box.classList.add("loaded"); const ph = box.querySelector(".map-ph"); if (ph) setTimeout(() => ph.remove(), 600); };
    const card = $("mapCard");
    box.insertBefore(f, card);
    if ($("mcRoute")) $("mcRoute").href = links().route;
    if ($("mcRating")) $("mcRating").textContent = S.rating || "5.0";
  }, { rootMargin: "300px 0px" });
  io.observe(box);
}

const MONTHS_NOM_RU = ["январь", "февраль", "март", "апрель", "май", "июнь", "июль", "август", "сентябрь", "октябрь", "ноябрь", "декабрь"];
const MAX_DAYS_AHEAD = 90;
let weekOffset = 0;
let busyCache = {};
let closedCache = {};
let loadedWeeks = {};

function isoOf(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function startOfToday() { const t = new Date(); t.setHours(0, 0, 0, 0); return t; }
function weekStart(offset) {
  const t = startOfToday();
  const dow = (t.getDay() + 6) % 7;
  t.setDate(t.getDate() - dow + offset * 7);
  return t;
}
function allSlots(dow) {
  if (dow === 0) return [];
  const end = dow === 6 ? 17.5 : 18.5;
  const out = [];
  for (let h = 9; h <= end; h += 0.5) out.push(`${Math.floor(h)}:${h % 1 ? "30" : "00"}`);
  return out;
}
function freeSlots(d) {
  const iso = isoOf(d);
  const isToday = iso === isoOf(new Date());
  const now = new Date();
  const minH = isToday ? now.getHours() + now.getMinutes() / 60 + 1 : -1;
  const busy = busyCache[iso] || [];
  return allSlots(d.getDay()).map((t) => {
    const [hh, mm] = t.split(":").map(Number);
    const past = hh + mm / 60 < minH;
    return { t, past, busy: busy.includes(t) };
  }).filter((s) => !s.past);
}
function dayState(d) {
  const today = startOfToday();
  const max = new Date(today); max.setDate(max.getDate() + MAX_DAYS_AHEAD);
  if (d < today || d > max) return "out";
  if (d.getDay() === 0) return "sun";
  if (closedCache[isoOf(d)]) return "closed";
  const slots = freeSlots(d);
  if (!slots.length || slots.every((s) => s.busy)) return "full";
  return "ok";
}

async function loadWeek(offset) {
  if (loadedWeeks[offset]) return;
  const from = isoOf(weekStart(offset));
  try {
    const j = await (await fetch(`/api/slots?from=${from}&days=7`, { cache: "no-store" })).json();
    for (let i = 0; i < 7; i++) {
      const d = weekStart(offset); d.setDate(d.getDate() + i);
      const iso = isoOf(d);
      busyCache[iso] = (j.busy || {})[iso] || [];
      closedCache[iso] = (j.closed || []).includes(iso);
    }
    loadedWeeks[offset] = true;
  } catch (e) {}
}

async function renderDayChips(dir) {
  const week = $("calWeek");
  if (!week) return;
  const isKz = currentLang === "kz";
  const start = weekStart(weekOffset);
  const end = new Date(start); end.setDate(end.getDate() + 6);
  const mNames = isKz ? MONTHS_FULL_KZ : MONTHS_NOM_RU;
  $("calMonth").textContent = start.getMonth() === end.getMonth()
    ? `${mNames[start.getMonth()]} ${start.getFullYear()}`
    : `${mNames[start.getMonth()]} / ${mNames[end.getMonth()]}`;
  const maxOffset = Math.floor((MAX_DAYS_AHEAD + (startOfToday().getDay() + 6) % 7) / 7);
  $("calPrev").disabled = weekOffset <= 0;
  $("calNext").disabled = weekOffset >= maxOffset;

  if (dir && !reduce) { week.classList.add(dir > 0 ? "slide-l" : "slide-r"); }
  await loadWeek(weekOffset);

  const daysArr = isKz ? DAYS_KZ : DAYS_RU;
  const todayIso = isoOf(new Date());
  let html = "";
  for (let i = 0; i < 7; i++) {
    const d = new Date(start); d.setDate(d.getDate() + i);
    const iso = isoOf(d);
    const st = dayState(d);
    const label = iso === todayIso ? (isKz ? "бүгін" : "сегодня") : daysArr[d.getDay()];
    const note = st === "sun" ? (isKz ? "демалыс" : "выходной") : st === "full" ? (isKz ? "орын жоқ" : "мест нет") : st === "closed" ? (isKz ? "жабық" : "закрыто") : "";
    html += `<button type="button" class="day ${selectedDate && selectedDate.iso === iso ? "on" : ""}" data-iso="${iso}" ${st === "ok" ? "" : "disabled"}><small>${label}</small><b>${d.getDate()}</b><em>${note}</em></button>`;
  }
  week.innerHTML = html;
  week.querySelectorAll(".day:not([disabled])").forEach((b) => b.addEventListener("click", () => pickDay(b.dataset.iso)));

  if (dir && !reduce) {
    week.classList.remove("slide-l", "slide-r");
    week.classList.add(dir > 0 ? "slide-r" : "slide-l");
    requestAnimationFrame(() => requestAnimationFrame(() => week.classList.remove("slide-l", "slide-r")));
  }

  if (!selectedDate) {
    const first = week.querySelector(".day:not([disabled])");
    if (first) pickDay(first.dataset.iso);
    else if (!dir && weekOffset < maxOffset) { weekOffset++; return renderDayChips(); }
    else renderSlots();
  } else {
    renderSlots();
  }
}

function pickDay(iso) {
  const d = new Date(iso + "T00:00");
  const isKz = currentLang === "kz";
  const daysArr = isKz ? DAYS_KZ : DAYS_RU;
  const monthsArr = isKz ? MONTHS_KZ : MONTHS_RU;
  selectedDate = { iso, dow: d.getDay(), display: `${d.getDate()} ${monthsArr[d.getMonth()]} (${daysArr[d.getDay()]})` };
  document.querySelectorAll("#calWeek .day").forEach((b) => b.classList.toggle("on", b.dataset.iso === iso));
  activePart = null;
  renderSlots();
}

const PARTS = [
  { k: "m", ru: "Утро", kz: "Таңертең", from: 0, to: 12 },
  { k: "d", ru: "День", kz: "Күндіз", from: 12, to: 16 },
  { k: "e", ru: "Вечер", kz: "Кешке", from: 16, to: 24 },
];
let activePart = null;

function updateWhen() {
  const isKz = currentLang === "kz";
  const day = $("whenDay");
  const tm = $("whenTime");
  if (!day) return;
  if (!selectedDate) {
    day.textContent = isKz ? "Күнді таңдаңыз" : "Выберите день";
    tm.textContent = "";
    return;
  }
  const d = new Date(selectedDate.iso + "T00:00");
  const todayIso = isoOf(new Date());
  const tmr = new Date(); tmr.setDate(tmr.getDate() + 1);
  const mFull = isKz ? MONTHS_FULL_KZ : MONTHS_FULL_RU;
  const wd = isKz ? ["жексенбі", "дүйсенбі", "сейсенбі", "сәрсенбі", "бейсенбі", "жұма", "сенбі"] : ["воскресенье", "понедельник", "вторник", "среда", "четверг", "пятница", "суббота"];
  const prefix = selectedDate.iso === todayIso ? (isKz ? "Бүгін, " : "Сегодня, ") : selectedDate.iso === isoOf(tmr) ? (isKz ? "Ертең, " : "Завтра, ") : "";
  day.textContent = isKz
    ? `${prefix}${mFull[d.getMonth()]} ${d.getDate()}, ${wd[d.getDay()]}`
    : `${prefix}${d.getDate()} ${mFull[d.getMonth()]}, ${wd[d.getDay()]}`;
  tm.textContent = selectedTime ? (isKz ? `сағат ${selectedTime}` : `в ${selectedTime}`) : (isKz ? "кез келген уақыт" : "любое время");
}

function renderSlots() {
  const box = $("slots");
  if (!box) return;
  const isKz = currentLang === "kz";
  const parts = $("parts");
  if (!selectedDate) {
    parts.innerHTML = "";
    box.innerHTML = `<p class="slots-empty">${isKz ? "Алдымен күнді таңдаңыз" : "Сначала выберите день"}</p>`;
    updateWhen();
    return;
  }
  const d = new Date(selectedDate.iso + "T00:00");
  const list = freeSlots(d);
  if (selectedTime && !list.some((s) => s.t === selectedTime && !s.busy)) selectedTime = null;
  const hourOf = (t) => +t.split(":")[0];
  const groups = PARTS.map((p) => {
    const items = list.filter((s) => hourOf(s.t) >= p.from && hourOf(s.t) < p.to);
    return { ...p, items, free: items.filter((s) => !s.busy).length };
  });
  const selPart = selectedTime ? groups.find((g) => g.items.some((s) => s.t === selectedTime)) : null;
  if (selPart && activePart === null) activePart = selPart.k;
  if (!activePart || !groups.find((g) => g.k === activePart && g.free)) {
    const firstFree = groups.find((g) => g.free);
    activePart = firstFree ? firstFree.k : groups[0].k;
  }
  parts.innerHTML = groups.map((g) => `<button type="button" class="part ${g.k === activePart ? "on" : ""}" data-p="${g.k}" ${g.items.length ? "" : "disabled"} role="tab"><span>${isKz ? g.kz : g.ru}</span><small>${g.items.length ? (g.free ? `${g.free} ${isKz ? "бос" : "своб."}` : (isKz ? "бос жоқ" : "нет мест")) : "—"}</small></button>`).join("");
  parts.querySelectorAll(".part:not([disabled])").forEach((b) => b.onclick = () => { activePart = b.dataset.p; renderSlots(); });
  const cur = groups.find((g) => g.k === activePart);
  box.innerHTML = cur && cur.items.length
    ? cur.items.map((s) => `<button type="button" class="slot ${s.t === selectedTime ? "on" : ""}" data-t="${s.t}" ${s.busy ? `disabled title="${isKz ? "Бос емес" : "Занято"}"` : ""}>${s.t}</button>`).join("")
    : `<p class="slots-empty">${isKz ? "Бұл уақытта қабылдау жоқ" : "В это время приёма нет"}</p>`;
  box.querySelectorAll(".slot:not([disabled])").forEach((b) => b.addEventListener("click", () => {
    selectedTime = b.dataset.t;
    box.querySelectorAll(".slot").forEach((x) => x.classList.toggle("on", x === b));
    $("anyTime").classList.remove("on");
    updateWhen();
    setTimeout(closeWhen, 220);
  }));
  $("anyTime").classList.toggle("on", !selectedTime);
  updateWhen();
}

let whenOpen = false;
function openWhen() {
  const pop = $("whenPop");
  if (whenOpen) return;
  whenOpen = true;
  activePart = null;
  renderSlots();
  pop.hidden = false;
  $("whenBtn").setAttribute("aria-expanded", "true");
  if (window.matchMedia("(max-width:640px)").matches) document.body.style.overflow = "hidden";
  requestAnimationFrame(() => requestAnimationFrame(() => pop.classList.add("open")));
}
function closeWhen() {
  const pop = $("whenPop");
  if (!whenOpen) return;
  whenOpen = false;
  pop.classList.remove("open");
  $("whenBtn").setAttribute("aria-expanded", "false");
  document.body.style.overflow = "";
  setTimeout(() => { if (!whenOpen) pop.hidden = true; }, reduce ? 0 : 300);
}

function calendar() {
  const prev = $("calPrev");
  const next = $("calNext");
  if (prev) prev.onclick = () => { if (weekOffset > 0) { weekOffset--; renderDayChips(-1); } };
  if (next) next.onclick = () => { weekOffset++; renderDayChips(1); };
  $("whenBtn").onclick = () => (whenOpen ? closeWhen() : openWhen());
  $("whenClose").onclick = closeWhen;
  $("anyTime").onclick = () => { selectedTime = null; renderSlots(); setTimeout(closeWhen, 220); };
  $("whenPop").addEventListener("click", (e) => { if (e.target.id === "whenPop") closeWhen(); });
  document.addEventListener("pointerdown", (e) => {
    if (whenOpen && !$("when").contains(e.target)) closeWhen();
  });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && whenOpen) { closeWhen(); $("whenBtn").focus(); } });
  const week = $("calWeek");
  let sx = null;
  week.addEventListener("touchstart", (e) => { sx = e.touches[0].clientX; }, { passive: true });
  week.addEventListener("touchend", (e) => {
    if (sx === null) return;
    const dx = e.changedTouches[0].clientX - sx;
    sx = null;
    if (Math.abs(dx) > 50) (dx < 0 ? next : prev).click();
  });
  const add = $("addComment");
  if (add) add.onclick = () => {
    $("commentField").hidden = false;
    add.hidden = true;
    $("commentField").querySelector("textarea").focus();
  };
}

function refreshBusy() {
  busyCache = {}; closedCache = {}; loadedWeeks = {};
  return renderDayChips();
}

function setupPhoneMask(input) {
  if (!input) return;
  input.addEventListener("input", (e) => {
    const v = input.value;
    let raw;
    if (v.startsWith("+7")) {
      raw = v.slice(2).replace(/\D/g, "");
      if (raw.length === 11 && (raw[0] === "7" || raw[0] === "8")) raw = raw.slice(1);
    } else {
      raw = v.replace(/\D/g, "");
      if (!raw) { input.value = ""; return; }
      if (raw === "8") { input.value = "+7 "; return; }
      if (raw.length >= 11 && (raw[0] === "8" || raw[0] === "7")) raw = raw.slice(1);
    }
    raw = raw.slice(0, 10);
    if (!raw) { input.value = e.inputType && e.inputType.startsWith("delete") ? "" : "+7 "; return; }
    let res = "+7 (" + raw.slice(0, 3);
    if (raw.length >= 3) res += ") ";
    if (raw.length > 3) res += raw.slice(3, 6);
    if (raw.length >= 6) res += "-";
    if (raw.length > 6) res += raw.slice(6, 8);
    if (raw.length >= 8) res += "-";
    if (raw.length > 8) res += raw.slice(8, 10);
    if (e.inputType && e.inputType.startsWith("delete")) res = res.replace(/[^\d]+$/, "");
    input.value = res;
  });
}

function form() {
  const f = $("bookForm");
  if (!f) return;
  const msg = $("formMsg");
  const phone = $("phoneInput");
  setupPhoneMask(phone);
  calendar();

  f.addEventListener("submit", async (e) => {
    e.preventDefault();
    const isKz = currentLang === "kz";
    msg.className = "form-msg";
    msg.textContent = "";
    f.querySelectorAll(".bad").forEach((x) => x.classList.remove("bad"));

    const name = f.elements.name.value.trim();
    const phoneVal = phone ? phone.value.trim() : "";
    const bad = (el, text) => {
      if (el) {
        el.classList.remove("bad");
        void el.offsetWidth;
        el.classList.add("bad");
        el.focus();
      }
      msg.className = "form-msg err";
      msg.textContent = text;
    };

    if (!name) return bad(f.elements.name, isKz ? "Сізге қалай хабарласу керектігін көрсетіңіз." : "Укажите, как к вам обращаться.");
    if (phoneVal && phoneVal.replace(/\D/g, "").length < 11) {
      return bad(phone, isKz ? "Телефон нөмірін толық жазыңыз." : "Допишите номер телефона полностью.");
    }
    if (!f.elements.consent.checked) {
      return bad(f.elements.consent, isKz ? "Деректерді өңдеуге келісім беру қажет." : "Нужно согласие на обработку данных.");
    }

    const whenDisp = (selectedDate ? selectedDate.display : "") + (selectedTime ? (isKz ? `, сағат ${selectedTime}` : ` в ${selectedTime}`) : "");
    const service = f.elements.service.value;
    const comment = f.elements.comment.value.trim();
    const lines = isKz
      ? [
          `Сәлеметсіз бе! ${S.name || "Diamond"} клиникасына жазылғым келеді.`,
          `Аты-жөні: ${name}`,
          phoneVal ? `Телефон: ${phoneVal}` : "",
          `Қызмет: ${service || "кеңес алу"}`,
          `Ыңғайлы уақыт: ${whenDisp || "бос уақытты айтыңызшы"}`,
          comment ? `Пікір: ${comment}` : "",
        ]
      : [
          `Здравствуйте! Хочу записаться на приём в ${S.name || "Diamond"}.`,
          `Имя: ${name}`,
          phoneVal ? `Телефон: ${phoneVal}` : "",
          `Услуга: ${service || "консультация"}`,
          `Когда удобно: ${whenDisp || "подскажите свободное время"}`,
          comment ? `Комментарий: ${comment}` : "",
        ];
    const wa = "https://wa.me/" + (S.whatsapp || "77055808170") + "?text=" + encodeURIComponent(lines.filter(Boolean).join("\n"));

    const win = window.open("", "_blank");
    const btn = f.querySelector("button[type=submit]");
    btn.disabled = true;
    let res;
    try {
      const r = await fetch("/api/book", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name, phone: phoneVal, service, comment, consent: true, channel: "whatsapp", website: f.elements.website ? f.elements.website.value : "",
          date: whenDisp, day: selectedDate ? selectedDate.iso : "", time: selectedTime || "",
        }),
      });
      res = { ok: r.ok, status: r.status, body: await r.json().catch(() => ({})) };
    } catch (err) {
      res = { ok: false, status: 0, body: {} };
    }
    btn.disabled = false;

    if (res.status === 409 || res.status === 400) {
      if (win) win.close();
      msg.className = "form-msg err";
      msg.textContent = res.body.error || (isKz ? "Бұл уақыт бос емес. Басқасын таңдаңыз." : "Это время уже заняли. Выберите другое.");
      selectedTime = null;
      refreshBusy();
      return;
    }

    if (win) { win.opener = null; win.location.href = wa; }
    else window.location.href = wa;

    f.reset();
    $("commentField").hidden = true;
    $("addComment").hidden = false;
    selectedTime = null;
    refreshBusy();
    msg.className = "form-msg ok";
    msg.textContent = isKz
      ? "WhatsApp ашылуда. Чатта «Жіберу» түймесін басыңыз, әкімші уақытты растайды."
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

(function cookieNote() {
  const el = document.getElementById("cookieNote");
  if (!el) return;
  let seen = false;
  try { seen = localStorage.getItem("diamond_cookie_ok") === "1"; } catch (e) {}
  if (seen) return;
  setTimeout(() => { el.hidden = false; requestAnimationFrame(() => el.classList.add("on")); }, 1200);
  document.getElementById("cookieOk").addEventListener("click", () => {
    try { localStorage.setItem("diamond_cookie_ok", "1"); } catch (e) {}
    el.classList.remove("on");
    setTimeout(() => (el.hidden = true), 300);
  });
})();

(function screenVars() {
  const root = document.documentElement;
  const set = () => {
    const h = document.querySelector("header.top"), tb = document.querySelector(".topbar"), st = document.getElementById("stats"), ft = document.querySelector("footer.foot");
    if (h) {
      const inner = h.querySelector(".top-in"); if (inner) inner.style.transition = "none";
      const had = h.classList.contains("scrolled");
      h.classList.add("scrolled"); const small = h.offsetHeight;
      h.classList.remove("scrolled"); const big = h.offsetHeight;
      if (had) h.classList.add("scrolled");
      if (inner) { void inner.offsetHeight; inner.style.transition = ""; }
      root.style.setProperty("--hdr", small + "px");
      root.style.setProperty("--hdr0", big + "px");
    }
    if (tb) root.style.setProperty("--tb", tb.offsetHeight + "px");
    if (st) root.style.setProperty("--stats", st.offsetHeight + "px");
    if (ft) root.style.setProperty("--foot", ft.offsetHeight + "px");
  };
  set();
  window.addEventListener("resize", set, { passive: true });
  window.addEventListener("load", set);
})();

(function heroVideo() {
  const v = document.querySelector(".hero-video");
  if (!v) return;
  const slow = navigator.connection && (navigator.connection.saveData || /2g/.test(navigator.connection.effectiveType || ""));
  if (slow || matchMedia("(prefers-reduced-motion: reduce)").matches) { v.remove(); return; }
  const show = () => v.classList.add("on");
  if (v.readyState >= 3) show(); else v.addEventListener("canplay", show, { once: true });
  v.play().catch(() => {});
})();

function results(list) {
  const sec = $("results"), track = $("resultsGrid");
  if (!sec || !track) return;
  list = list.filter((c) => c.before && c.after);
  sec.style.display = list.length ? "" : "none";
  if (!list.length) return;
  const isKz = currentLang === "kz";
  const B = isKz ? "Дейін" : "До", A = isKz ? "Кейін" : "После";
  track.innerHTML = list.map((c, i) => {
    const title = isKz ? (c.title_kz || c.title) : c.title;
    const text = isKz ? (c.text_kz || c.text) : c.text;
    return `<figure class="res-card reveal in" style="--d:${i % 3}">
      <div class="res-ph"><img src="${esc(c.before)}" alt="${esc(B + ": " + (title || ""))}" loading="lazy"><span class="res-tag">${B}</span></div>
      <div class="res-ph"><img src="${esc(c.after)}" alt="${esc(A + ": " + (title || ""))}" loading="lazy"><span class="res-tag res-tag-a">${A}</span></div>
      ${title || text ? `<figcaption>${title ? `<b>${esc(title)}</b>` : ""}${text ? `<span>${esc(text)}</span>` : ""}</figcaption>` : ""}
    </figure>`;
  }).join("");
  const prev = $("resPrev"), next = $("resNext");
  const upd = () => {
    if (!prev || !next) return;
    prev.disabled = track.scrollLeft < 8;
    next.disabled = track.scrollLeft + track.clientWidth > track.scrollWidth - 8;
  };
  if (prev) prev.onclick = () => track.scrollBy({ left: -track.clientWidth * 0.8, behavior: "smooth" });
  if (next) next.onclick = () => track.scrollBy({ left: track.clientWidth * 0.8, behavior: "smooth" });
  track.onscroll = upd;
  setTimeout(upd, 200);
}
