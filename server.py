import base64
import datetime
import getpass
import hashlib
import hmac
import html
import json
import os
import re
import secrets
import shutil
import sys
import threading
import time
import urllib.parse
import urllib.request
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from pathlib import Path

ROOT = Path(__file__).parent
STATIC = ROOT / "static"
DATA_FILE = ROOT / "data.json"
BOOKINGS_FILE = ROOT / "bookings.json"
SCHEDULE_FILE = ROOT / "schedule.json"
USERS_FILE = ROOT / "users.json"
AUDIT_FILE = ROOT / "audit.log"
BACKUP_DIR = ROOT / "backups"
LOCK = threading.Lock()

PORT = int(os.environ.get("PORT", "8090"))
HOST = os.environ.get("HOST", "0.0.0.0")
TG_TOKEN = os.environ.get("TG_TOKEN", "")
TG_CHAT = os.environ.get("TG_CHAT", "")
WEBHOOK_URL = os.environ.get("WEBHOOK_URL", "")
TRUST_PROXY = os.environ.get("TRUST_PROXY", "") == "1"
SECURE_COOKIES = os.environ.get("SECURE_COOKIES", "") == "1"
DEMO = os.environ.get("DEMO", "") == "1"
SITE_URL = os.environ.get("SITE_URL", "").rstrip("/")
GEO = (52.242155, 76.99047)
FIRM_2GIS = "https://2gis.kz/pavlodar/firm/70000001083785122"
RETENTION_DAYS = int(os.environ.get("RETENTION_DAYS", "1095"))
BACKUP_KEEP_DAYS = int(os.environ.get("BACKUP_KEEP_DAYS", "14"))
POLICY_VERSION = "2026-11-13"

SESSION_TTL = 12 * 3600
SESSION_IDLE = 2 * 3600
PBKDF2_ROUNDS = 240_000
ROLES = {"owner": "Владелец", "manager": "Администратор"}
MANAGER_ALLOWED = {"/api/admin/status", "/api/admin/booking", "/api/admin/schedule", "/api/admin/password", "/api/admin/ping"}

STATUSES = ["new", "contacted", "booked", "came", "paid", "no_show", "cancelled"]
STATUS_RU = {
    "new": "Новая", "contacted": "Связались", "booked": "Записан", "came": "Пришёл",
    "paid": "Оплачено", "no_show": "Не пришёл", "cancelled": "Отказ",
}
LEGACY = {"confirmed": "booked", "done": "came"}
ACTIVE = {"new", "contacted", "booked"}
SOURCES = ["site", "whatsapp", "phone", "instagram", "2gis", "walkin", "referral", "other"]
SOURCE_RU = {"site": "сайт", "whatsapp": "WhatsApp", "phone": "звонок", "instagram": "Instagram", "2gis": "2ГИС", "walkin": "пришёл сам", "referral": "рекомендация", "other": "другое"}
DAY_RE = re.compile(r"^\d{4}-\d{2}-\d{2}$")
LOGIN_RE = re.compile(r"^[a-z0-9_.-]{3,32}$")
HOURS = {0: (9, 19), 1: (9, 19), 2: (9, 19), 3: (9, 19), 4: (9, 19), 5: (9, 18)}
REEL_RE = re.compile(r"instagram\.com/(?:[A-Za-z0-9_.]+/)?(reel|reels|p|tv)/([A-Za-z0-9_-]{5,20})")

CSP_SITE = "; ".join([
    "default-src 'self'",
    "script-src 'self' https://www.instagram.com",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: https:",
    "frame-src https://www.instagram.com https://widgets.2gis.com",
    "connect-src 'self'",
    "font-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
])
CSP_ADMIN = "; ".join([
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: https:",
    "connect-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
])


def now_str():
    return time.strftime("%Y-%m-%d %H:%M")


def read_json(path, default):
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return default


def write_json(path, value):
    tmp = path.with_suffix(".tmp")
    tmp.write_text(json.dumps(value, ensure_ascii=False, indent=2), encoding="utf-8")
    try:
        os.chmod(tmp, 0o600)
    except OSError:
        pass
    tmp.replace(path)


def audit(ip, who, action, detail=""):
    line = json.dumps({"at": now_str(), "ip": ip, "user": who, "action": action, "detail": detail}, ensure_ascii=False)
    with LOCK:
        with AUDIT_FILE.open("a", encoding="utf-8") as f:
            f.write(line + "\n")


def hash_password(password, salt=None):
    salt = salt or secrets.token_hex(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode(), bytes.fromhex(salt), PBKDF2_ROUNDS).hex()
    return salt, digest


def check_password(user, password):
    _, digest = hash_password(password, user["salt"])
    return hmac.compare_digest(digest, user["hash"])


def password_problem(pw):
    if len(pw) < 10:
        return "Пароль должен быть не короче 10 символов"
    if pw.lower() in {"diamond", "password", "qwerty12345", "1234567890", "diamond123"}:
        return "Этот пароль слишком простой"
    if not (re.search(r"\d", pw) and re.search(r"[A-Za-zА-Яа-яЁё]", pw)):
        return "Нужны и буквы, и цифры"
    return ""


def load_users():
    return read_json(USERS_FILE, {})


def save_users(users):
    write_json(USERS_FILE, users)


def bootstrap_users():
    if USERS_FILE.exists():
        return
    pw = os.environ.get("ADMIN_PASS", "diamond")
    salt, digest = hash_password(pw)
    save_users({"owner": {"salt": salt, "hash": digest, "role": "owner", "name": "Владелец", "mustChange": True, "created": now_str()}})
    print("Создан пользователь owner. Пароль из ADMIN_PASS (или стандартный), при первом входе его нужно сменить.")


SESSIONS = {}
RATE = {}
FAILS = {}


def rate_ok(key, limit, window):
    t = time.time()
    with LOCK:
        hits = [x for x in RATE.get(key, []) if t - x < window]
        if len(hits) >= limit:
            RATE[key] = hits
            return False
        hits.append(t)
        RATE[key] = hits
        return True


def login_locked(key):
    rec = FAILS.get(key)
    return bool(rec and rec["until"] > time.time())


def login_failed(key, limit=5):
    t = time.time()
    rec = FAILS.get(key, {"n": 0, "until": 0, "first": t})
    if t - rec.get("first", t) > 900:
        rec = {"n": 0, "until": 0, "first": t}
    rec["n"] += 1
    if rec["n"] >= limit:
        rec["until"] = t + 900
        rec["n"] = 0
        rec["first"] = t
    FAILS[key] = rec


def new_session(login, role):
    token = secrets.token_urlsafe(32)
    csrf = secrets.token_urlsafe(24)
    t = time.time()
    with LOCK:
        SESSIONS[token] = {"login": login, "role": role, "csrf": csrf, "created": t, "seen": t}
    return token, csrf


def drop_sessions_of(login):
    with LOCK:
        for k in [k for k, v in SESSIONS.items() if v["login"] == login]:
            SESSIONS.pop(k, None)


def day_slots(day):
    try:
        d = datetime.date.fromisoformat(day)
    except ValueError:
        return []
    span = HOURS.get(d.weekday())
    if not span:
        return []
    out = []
    m = span[0] * 60
    while m <= span[1] * 60 - 30:
        out.append(f"{m // 60}:{m % 60:02d}")
        m += 30
    return out


def busy_map(bookings, sched, start, end, skip_id=None):
    out = {}
    for b in bookings:
        if skip_id is not None and b.get("id") == skip_id:
            continue
        d, t = b.get("day"), b.get("time")
        if d and t and start <= d <= end and b.get("status") in ACTIVE:
            out.setdefault(d, []).append(t)
    closed = []
    for d, entry in sched.items():
        if start <= d <= end:
            if entry.get("closed"):
                closed.append(d)
            out.setdefault(d, []).extend(entry.get("blocked", []))
    for d in list(out):
        out[d] = sorted(set(out[d]), key=lambda t: tuple(map(int, t.split(":"))))
    out["_closed"] = closed
    return out


def clean_reels(items):
    out = []
    seen = set()
    for raw in items if isinstance(items, list) else []:
        src = raw if isinstance(raw, dict) else {"url": raw}
        m = REEL_RE.search(str(src.get("url", "")))
        if not m:
            continue
        kind = "p" if m.group(1) == "p" else "reel"
        url = f"https://www.instagram.com/{kind}/{m.group(2)}/"
        if url in seen:
            continue
        seen.add(url)
        cover = str(src.get("cover", "")).strip()[:200]
        if cover and not (cover.startswith("img/") or cover.startswith("https://")):
            cover = ""
        out.append({
            "url": url,
            "cover": cover,
            "title": str(src.get("title", "")).strip()[:80],
            "views": str(src.get("views", "")).strip()[:20],
            "embed": src.get("embed", True) is not False,
            "hidden": bool(src.get("hidden", False)),
        })
    return out[:24]


def normalize(b):
    st = LEGACY.get(b.get("status"), b.get("status"))
    if st not in STATUSES:
        st = "new"
    b["status"] = st
    b.setdefault("source", "whatsapp" if b.get("channel") == "whatsapp" else "site")
    b.setdefault("amount", 0)
    b.setdefault("doctor", "")
    b.setdefault("notes", [])
    b.setdefault("history", [{"at": b.get("created", now_str()), "to": "new", "by": "site"}])
    return b


def load_bookings():
    return [normalize(b) for b in read_json(BOOKINGS_FILE, [])]


def tg_call(method, payload):
    if not TG_TOKEN:
        return None
    try:
        req = urllib.request.Request(
            f"https://api.telegram.org/bot{TG_TOKEN}/{method}",
            data=json.dumps(payload).encode(),
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        with urllib.request.urlopen(req, timeout=35) as r:
            return json.loads(r.read().decode())
    except Exception as e:
        print("telegram error:", method, type(e).__name__)
        return None


def tg_text(b):
    e = html.escape
    lines = [
        f"<b>{'Новая заявка' if b['status'] == 'new' else STATUS_RU[b['status']]}</b> · {e(SOURCE_RU.get(b.get('source', ''), b.get('source', '')))}",
        f"Имя: {e(b.get('name', ''))}",
        f"Телефон: {e(b.get('phone') or 'не указан')}",
        f"Услуга: {e(b.get('service') or 'консультация')}",
        f"Когда: {e(b.get('date') or 'любое время')}",
    ]
    if b.get("comment"):
        lines.append(f"Комментарий: {e(b['comment'])}")
    if b["status"] != "new":
        lines.append(f"\nСтатус: <b>{STATUS_RU[b['status']]}</b>")
    return "\n".join(lines)


def tg_keyboard(b):
    bid = b["id"]
    row1 = [{"text": "📞 Связались", "callback_data": f"st:{bid}:contacted"}, {"text": "✅ Записан", "callback_data": f"st:{bid}:booked"}]
    row2 = [{"text": "❌ Отказ", "callback_data": f"st:{bid}:cancelled"}]
    digits = re.sub(r"\D", "", b.get("phone") or "")
    if digits:
        row2.insert(0, {"text": "WhatsApp", "url": f"https://wa.me/{digits}"})
    return {"inline_keyboard": [row1, row2]}


def notify_new(b):
    if not TG_TOKEN or not TG_CHAT:
        return
    threading.Thread(target=lambda: tg_call("sendMessage", {"chat_id": TG_CHAT, "text": tg_text(b), "parse_mode": "HTML", "reply_markup": tg_keyboard(b)}), daemon=True).start()


def set_status(items, bid, status, by):
    for it in items:
        if it["id"] == bid:
            if it["status"] != status:
                it["history"].append({"at": now_str(), "from": it["status"], "to": status, "by": by})
                it["status"] = status
                it["updated"] = now_str()
            return it
    return None


def tg_poll():
    offset = 0
    while True:
        res = tg_call("getUpdates", {"timeout": 30, "offset": offset, "allowed_updates": ["callback_query"]})
        if not res or not res.get("ok"):
            time.sleep(5)
            continue
        for upd in res.get("result", []):
            offset = upd["update_id"] + 1
            cq = upd.get("callback_query")
            if not cq:
                continue
            chat = str(((cq.get("message") or {}).get("chat") or {}).get("id", ""))
            m = re.match(r"^st:(\d+):(\w+)$", cq.get("data", ""))
            if chat != str(TG_CHAT) or not m or m.group(2) not in STATUSES:
                tg_call("answerCallbackQuery", {"callback_query_id": cq["id"], "text": "Нет доступа"})
                continue
            with LOCK:
                items = load_bookings()
                it = set_status(items, int(m.group(1)), m.group(2), "telegram")
                write_json(BOOKINGS_FILE, items)
            if it:
                tg_call("editMessageText", {"chat_id": TG_CHAT, "message_id": cq["message"]["message_id"], "text": tg_text(it), "parse_mode": "HTML", "reply_markup": tg_keyboard(it)})
            tg_call("answerCallbackQuery", {"callback_query_id": cq["id"], "text": STATUS_RU.get(m.group(2), "OK")})


def push_webhook(item, event="booking"):
    if not WEBHOOK_URL:
        return

    def run():
        try:
            req = urllib.request.Request(
                WEBHOOK_URL,
                data=json.dumps({"event": event, "source": "diamond-site", "booking": item}, ensure_ascii=False).encode(),
                headers={"Content-Type": "application/json"},
                method="POST",
            )
            urllib.request.urlopen(req, timeout=10)
        except Exception as e:
            print("webhook error:", type(e).__name__)

    threading.Thread(target=run, daemon=True).start()


def anonymize_old():
    cutoff = (datetime.date.today() - datetime.timedelta(days=RETENTION_DAYS)).isoformat()
    changed = 0
    with LOCK:
        items = load_bookings()
        for b in items:
            if str(b.get("created", "9999"))[:10] < cutoff and not b.get("anonymized"):
                b.update({"name": "Обезличено", "phone": "", "comment": "", "notes": [], "anonymized": True})
                changed += 1
        if changed:
            write_json(BOOKINGS_FILE, items)
    return changed


def backup_once():
    day = datetime.date.today().isoformat()
    target = BACKUP_DIR / day
    target.mkdir(parents=True, exist_ok=True)
    for f in (DATA_FILE, BOOKINGS_FILE, SCHEDULE_FILE, USERS_FILE):
        if f.exists():
            shutil.copy2(f, target / f.name)
    for old in BACKUP_DIR.iterdir():
        try:
            if (datetime.date.today() - datetime.date.fromisoformat(old.name)).days > BACKUP_KEEP_DAYS:
                shutil.rmtree(old)
        except ValueError:
            continue


def maintenance_loop():
    while True:
        try:
            n = anonymize_old()
            if n:
                audit("system", "system", "anonymize", f"{n} заявок старше {RETENTION_DAYS} дней")
            backup_once()
        except Exception as e:
            print("maintenance error:", type(e).__name__, e)
        time.sleep(6 * 3600)


TR = dict(zip("абвгдеёжзийклмнопрстуфхцчшщъыьэюяәғқңөұүһі", ["a","b","v","g","d","e","e","zh","z","i","y","k","l","m","n","o","p","r","s","t","u","f","h","c","ch","sh","sch","","y","","e","yu","ya","a","g","k","n","o","u","u","h","i"]))


def translit_slug(title):
    out = "".join(TR.get(c, c) for c in str(title).lower())
    return re.sub(r"-+", "-", re.sub(r"[^a-z0-9]+", "-", out)).strip("-")[:50]


def num_price(p):
    digits = re.sub(r"\D", "", str(p or ""))
    return int(digits) if digits else None


def opening_hours():
    days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]
    return [{"@type": "OpeningHoursSpecification", "dayOfWeek": d, "opens": f"{HOURS[i][0]:02d}:00", "closes": f"{HOURS[i][1]:02d}:00"} for i, d in enumerate(days)]


def clinic_ld(site, base):
    st = site.get("settings", {})
    ld = {
        "@context": "https://schema.org",
        "@type": "Dentist",
        "@id": base + "/#clinic",
        "name": "Diamond, стоматологическая клиника",
        "url": base + "/",
        "image": base + "/img/og.jpg",
        "logo": base + "/img/logo.jpg",
        "telephone": st.get("phone", ""),
        "priceRange": "₸₸",
        "currenciesAccepted": "KZT",
        "paymentAccepted": "Наличные, карта, QR, Kaspi рассрочка 0-0-24, Kaspi Red",
        "address": {"@type": "PostalAddress", "streetAddress": "пр. Нурсултана Назарбаева, 285", "addressLocality": "Павлодар", "addressRegion": "Павлодарская область", "addressCountry": "KZ"},
        "geo": {"@type": "GeoCoordinates", "latitude": GEO[0], "longitude": GEO[1]},
        "openingHoursSpecification": opening_hours(),
        "sameAs": [f"https://www.instagram.com/{st.get('instagram', '')}/", FIRM_2GIS],
        "areaServed": "Павлодар",
    }
    try:
        ld["aggregateRating"] = {"@type": "AggregateRating", "ratingValue": float(st.get("rating", 5)), "reviewCount": int(st.get("reviews", 0)), "bestRating": 5}
    except (TypeError, ValueError):
        pass
    offers = []
    for sv in site.get("services", []):
        if sv.get("hidden"):
            continue
        item = {"@type": "Offer", "itemOffered": {"@type": "MedicalProcedure", "name": sv.get("title", "")}}
        if sv.get("slug"):
            item["url"] = f"{base}/uslugi/{sv['slug']}"
        n = num_price(sv.get("price"))
        if n:
            item["priceSpecification"] = {"@type": "PriceSpecification", "price": n, "priceCurrency": "KZT", **({"minPrice": n} if "от" in str(sv.get("price")) else {})}
        offers.append(item)
    if offers:
        ld["hasOfferCatalog"] = {"@type": "OfferCatalog", "name": "Стоматологические услуги", "itemListElement": offers}
    return ld


def faq_ld(pairs):
    return {"@context": "https://schema.org", "@type": "FAQPage", "mainEntity": [{"@type": "Question", "name": q, "acceptedAnswer": {"@type": "Answer", "text": a}} for q, a in pairs if q and a]}


def ld_tag(obj):
    return '<script type="application/ld+json">' + json.dumps(obj, ensure_ascii=False).replace("</", "<\\/") + "</script>"


def head_meta(base, path, title, desc):
    e = html.escape
    url = base + path
    return "\n".join([
        f'<link rel="canonical" href="{e(url)}">',
        '<meta property="og:type" content="website">',
        '<meta property="og:site_name" content="Diamond, стоматология в Павлодаре">',
        '<meta property="og:locale" content="ru_RU">',
        f'<meta property="og:title" content="{e(title)}">',
        f'<meta property="og:description" content="{e(desc)}">',
        f'<meta property="og:url" content="{e(url)}">',
        f'<meta property="og:image" content="{e(base)}/img/og.jpg">',
        '<meta property="og:image:width" content="1200">',
        '<meta property="og:image:height" content="630">',
        '<meta name="twitter:card" content="summary_large_image">',
    ])


def render_index(base):
    page = (STATIC / "index.html").read_text(encoding="utf-8")
    site = read_json(DATA_FILE, {})
    title = "Diamond: стоматология в Павлодаре. Запись онлайн"
    desc = "Стоматологическая клиника Diamond в Павлодаре: лечение, чистка, удаление, имплантация, детский приём. Рассрочка 0-0-24 через Kaspi. Бесплатная консультация. Запись онлайн."
    faq = [(f.get("q", ""), f.get("a", "")) for f in site.get("faq", []) if not f.get("hidden")]
    extra = head_meta(base, "/", title, desc) + "\n" + ld_tag(clinic_ld(site, base)) + ("\n" + ld_tag(faq_ld(faq)) if faq else "")
    return page.replace("</head>", extra + "\n</head>", 1)


SERVICE_CSS = """
.sp-hero{background:linear-gradient(135deg,#e3f6f5 0%,#f5fcfc 55%,#fff 100%);padding:48px 0 40px}
.sp-crumbs{font-size:14px;color:var(--muted);margin-bottom:14px}.sp-crumbs a{color:var(--teal-d)}
.sp-hero h1{font-size:clamp(30px,4.4vw,52px);line-height:1.08;margin:0 0 14px;letter-spacing:-.02em}
.sp-intro{font-size:19px;color:#2a4a4c;max-width:760px;margin:0 0 22px}
.sp-price{display:inline-flex;gap:10px;align-items:center;background:#fff;border:1px solid var(--line);border-radius:999px;padding:8px 18px;font-weight:700;margin-bottom:22px}
.sp-price small{color:var(--muted);font-weight:500}
.sp-cta{display:flex;gap:10px;flex-wrap:wrap}
.sp-body{padding:48px 0 60px;display:grid;grid-template-columns:1.2fr .8fr;gap:36px;align-items:start}
.sp-steps{counter-reset:s;list-style:none;padding:0;margin:0;display:grid;gap:10px}
.sp-steps li{counter-increment:s;background:#fff;border:1px solid var(--line);border-radius:14px;padding:14px 16px 14px 56px;position:relative}
.sp-steps li::before{content:counter(s);position:absolute;left:14px;top:50%;transform:translateY(-50%);width:30px;height:30px;border-radius:50%;background:var(--teal);color:#fff;display:grid;place-items:center;font-weight:700;font-size:14px}
.sp-side{background:#0f2c2d;color:#cfe7e5;border-radius:20px;padding:24px;display:grid;gap:10px;position:sticky;top:20px}
.sp-side b{color:#fff;font-size:20px}.sp-side p{margin:0}.sp-side a{color:#7fe3dc}
.sp-faq details{background:#fff;border:1px solid var(--line);border-radius:14px;padding:14px 18px;margin-bottom:10px}
.sp-faq summary{font-weight:700;cursor:pointer}.sp-faq p{color:#2a4a4c;margin:10px 0 0}
.sp-more{display:flex;gap:8px;flex-wrap:wrap}.sp-more a{border:1px solid var(--line);border-radius:999px;padding:8px 14px;color:var(--teal-d);text-decoration:none;background:#fff}
.sp-top{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:14px 0}
.sp-top .brand{display:flex;gap:10px;align-items:center;text-decoration:none;color:inherit;font-weight:700}
.sp-top img{width:40px;height:40px;border-radius:50%}
.sp-price b{white-space:nowrap}
@media(max-width:860px){.sp-body{grid-template-columns:1fr}.sp-side{position:static}.sp-hero{padding:28px 0}.sp-intro{font-size:17px}.sp-top .btn-call,.sp-top .brand small{display:none}.sp-price{flex-wrap:wrap;border-radius:16px;gap:4px 10px}.sp-cta .btn-lg{flex:1 1 100%;justify-content:center}}
"""


def render_service(base, slug):
    site = read_json(DATA_FILE, {})
    st = site.get("settings", {})
    services = [x for x in site.get("services", []) if not x.get("hidden")]
    sv = next((x for x in services if x.get("slug") == slug), None)
    if not sv:
        return None
    e = html.escape
    h1 = sv.get("seo_h1") or f"{sv.get('title', '')} в Павлодаре"
    intro = sv.get("seo_intro") or sv.get("desc", "")
    steps = [x for x in (sv.get("seo_steps") or []) if isinstance(x, str) and x.strip()]
    faq = []
    for line in sv.get("seo_faq") or []:
        q, _, a = str(line).partition("|")
        if q.strip() and a.strip():
            faq.append((q.strip(), a.strip()))
    price = sv.get("price") or sv.get("tag") or ""
    phone = st.get("phone", "")
    tel = re.sub(r"[^\d+]", "", phone)
    wa_num = st.get("whatsapp", "77055808170")
    wa = f"https://wa.me/{wa_num}?text=" + urllib.parse.quote(f"Здравствуйте! Хочу записаться: {sv.get('title', '')}")
    title = f"{h1}: цены, запись онлайн | Diamond"
    desc = (intro[:150].rsplit(" ", 1)[0] + "…") if len(intro) > 155 else intro
    proc = {"@context": "https://schema.org", "@type": "MedicalProcedure", "name": sv.get("title", ""), "description": intro, "url": f"{base}/uslugi/{slug}", "provider": {"@id": base + "/#clinic"}}
    n = num_price(sv.get("price"))
    if n:
        proc["offers"] = {"@type": "Offer", "price": n, "priceCurrency": "KZT", "url": f"{base}/uslugi/{slug}"}
    crumbs = {"@context": "https://schema.org", "@type": "BreadcrumbList", "itemListElement": [
        {"@type": "ListItem", "position": 1, "name": "Diamond", "item": base + "/"},
        {"@type": "ListItem", "position": 2, "name": "Услуги", "item": base + "/#services"},
        {"@type": "ListItem", "position": 3, "name": sv.get("title", ""), "item": f"{base}/uslugi/{slug}"}]}
    lds = [ld_tag(proc), ld_tag(crumbs), ld_tag(clinic_ld(site, base))] + ([ld_tag(faq_ld(faq))] if faq else [])
    others = "".join(f'<a href="/uslugi/{e(x["slug"])}">{e(x.get("title", ""))}</a>' for x in services if x.get("slug") and x.get("slug") != slug)
    return f"""<!doctype html>
<html lang="ru">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>{e(title)}</title>
<meta name="description" content="{e(desc)}">
<meta name="theme-color" content="#0e9f9a">
<link rel="icon" href="/img/logo.jpg">
<link rel="stylesheet" href="/style.css">
<style>{SERVICE_CSS}</style>
{head_meta(base, '/uslugi/' + slug, title, desc)}
{chr(10).join(lds)}
</head>
<body>
<div class="wrap sp-top">
  <a class="brand" href="/"><img src="/img/logo.jpg" alt="">Diamond<small style="font-weight:500;color:var(--muted)">стоматология в Павлодаре</small></a>
  <div class="sp-cta"><a class="btn btn-ghost btn-call" href="tel:{e(tel)}">{e(phone)}</a><a class="btn btn-main" href="/#book">Записаться</a></div>
</div>
<section class="sp-hero"><div class="wrap">
  <nav class="sp-crumbs"><a href="/">Главная</a> · <a href="/#services">Услуги</a> · {e(sv.get('title', ''))}</nav>
  <h1>{e(h1)}</h1>
  <p class="sp-intro">{e(intro)}</p>
  {f'<div class="sp-price"><b>{e(price)}</b> <small>точную цену врач назовёт на бесплатной консультации</small></div>' if price else ''}
  <div class="sp-cta"><a class="btn btn-main btn-lg" href="/#book">Записаться онлайн</a><a class="btn btn-wa btn-lg" href="{e(wa)}" target="_blank" rel="noopener">Написать в WhatsApp</a></div>
</div></section>
<div class="wrap sp-body">
  <div>
    {f'<h2>Как проходит</h2><ol class="sp-steps">' + ''.join(f'<li>{e(x)}</li>' for x in steps) + '</ol>' if steps else ''}
    {f'<h2 style="margin-top:36px">Частые вопросы</h2><div class="sp-faq">' + ''.join(f'<details><summary>{e(q)}</summary><p>{e(a)}</p></details>' for q, a in faq) + '</div>' if faq else ''}
    {f'<h2 style="margin-top:36px">Другие услуги</h2><div class="sp-more">{others}</div>' if others else ''}
  </div>
  <aside class="sp-side">
    <b>Бесплатная консультация</b>
    <p>Осмотр и план лечения бесплатно. Рассрочка 0-0-24 через Kaspi, можно Kaspi Red.</p>
    <p>{e(st.get('address', ''))}<br>{e(st.get('hours', ''))}</p>
    <p><a href="tel:{e(tel)}">{e(phone)}</a> · <a href="{e(wa)}" target="_blank" rel="noopener">WhatsApp</a></p>
    <a class="btn btn-main" href="/#book" style="justify-self:start">Выбрать время</a>
  </aside>
</div>
<footer class="foot"><div class="wrap foot-grid"><p class="foot-small">{e(st.get('license', ''))}</p><p class="foot-small">Имеются противопоказания, необходима консультация специалиста. © Diamond, Павлодар · <a href="/privacy">Политика конфиденциальности</a></p></div></footer>
</body>
</html>"""


def render_sitemap(base):
    site = read_json(DATA_FILE, {})
    day = datetime.date.today().isoformat()
    urls = [(base + "/", "1.0")] + [(f"{base}/uslugi/{x['slug']}", "0.8") for x in site.get("services", []) if x.get("slug") and not x.get("hidden")] + [(base + "/privacy", "0.2")]
    body = "".join(f"<url><loc>{html.escape(u)}</loc><lastmod>{day}</lastmod><priority>{p}</priority></url>" for u, p in urls)
    return '<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">' + body + "</urlset>"


def clean_text(v, n):
    return re.sub(r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]", "", str(v or "")).strip()[:n]


def clean_phone(v):
    return "".join(c for c in str(v or "") if c.isdigit() or c == "+")[:16]


IMAGE_MAGIC = {
    "image/jpeg": (b"\xff\xd8\xff", ".jpg"),
    "image/png": (b"\x89PNG\r\n\x1a\n", ".png"),
    "image/webp": (b"RIFF", ".webp"),
}


class Handler(SimpleHTTPRequestHandler):
    timeout = 20
    server_version = "Diamond"
    sys_version = ""

    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(STATIC), **kwargs)

    def log_message(self, fmt, *args):
        pass

    def client_ip(self):
        if TRUST_PROXY:
            cf = self.headers.get("CF-Connecting-IP", "")
            if cf:
                return cf.strip()[:64]
            xff = self.headers.get("X-Forwarded-For", "")
            if xff:
                return xff.split(",")[0].strip()[:64]
        return self.client_address[0]

    def is_https(self):
        return SECURE_COOKIES or (TRUST_PROXY and self.headers.get("X-Forwarded-Proto") == "https")

    def end_headers(self):
        p = urllib.parse.urlparse(self.path).path
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("Referrer-Policy", "strict-origin-when-cross-origin")
        self.send_header("X-Frame-Options", "DENY")
        self.send_header("Permissions-Policy", "camera=(), microphone=(), geolocation=(), payment=()")
        self.send_header("Cross-Origin-Opener-Policy", "same-origin-allow-popups")
        if p.startswith("/admin") or p in ("/crm.js", "/admin-app.js"):
            self.send_header("Content-Security-Policy", CSP_ADMIN)
            self.send_header("X-Robots-Tag", "noindex, nofollow")
            self.send_header("Cache-Control", "no-store")
        elif not p.startswith("/api/"):
            self.send_header("Content-Security-Policy", CSP_SITE)
            if p.endswith((".js", ".css", ".html")) or p == "/" or p.startswith("/uslugi/"):
                self.send_header("Cache-Control", "no-cache")
        if DEMO:
            self.send_header("X-Robots-Tag", "noindex, nofollow")
        if self.is_https():
            self.send_header("Strict-Transport-Security", "max-age=31536000; includeSubDomains")
        self.send_header("Connection", "close")
        self.close_connection = True
        super().end_headers()

    def base_url(self):
        if SITE_URL:
            return SITE_URL
        host = re.sub(r"[^A-Za-z0-9.:\-\[\]]", "", self.headers.get("Host", "localhost"))[:100] or "localhost"
        return ("https" if self.is_https() or self.headers.get("X-Forwarded-Proto") == "https" else "http") + "://" + host

    def send_text(self, code, text, ctype):
        raw = text.encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(raw)))
        self.end_headers()
        if self.command != "HEAD":
            self.wfile.write(raw)

    def list_directory(self, path):
        self.send_error(404)
        return None

    def send_json(self, code, payload, cookies=()):
        raw = json.dumps(payload, ensure_ascii=False).encode()
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(raw)))
        self.send_header("Cache-Control", "no-store")
        for c in cookies:
            self.send_header("Set-Cookie", c)
        self.end_headers()
        self.wfile.write(raw)

    def body(self, limit):
        try:
            n = int(self.headers.get("Content-Length") or 0)
        except ValueError:
            return None
        if n < 0 or n > limit:
            return None
        if n and "application/json" not in self.headers.get("Content-Type", ""):
            return None
        try:
            data = json.loads(self.rfile.read(n).decode("utf-8") or "{}")
        except Exception:
            return None
        return data if isinstance(data, dict) else None

    def cookie(self, name):
        for part in self.headers.get("Cookie", "").split(";"):
            k, _, v = part.strip().partition("=")
            if k == name:
                return v
        return ""

    def session(self):
        token = self.cookie("dd_session")
        if not token:
            return None, None
        t = time.time()
        with LOCK:
            s = SESSIONS.get(token)
            if not s:
                return None, None
            if t - s["created"] > SESSION_TTL or t - s["seen"] > SESSION_IDLE:
                SESSIONS.pop(token, None)
                return None, None
            s["seen"] = t
        user = load_users().get(s["login"])
        if not user or user.get("disabled"):
            return None, None
        s["role"] = user["role"]
        return token, s

    def session_cookie(self, token, max_age):
        flags = "HttpOnly; SameSite=Strict; Path=/"
        if self.is_https():
            flags += "; Secure"
        return f"dd_session={token}; Max-Age={max_age}; {flags}"

    def do_HEAD(self):
        self.do_GET()

    def do_GET(self):
        path = urllib.parse.urlparse(self.path).path
        ip = self.client_ip()
        if not rate_ok(("get", ip), 600, 60):
            return self.send_json(429, {"error": "Слишком много запросов. Подождите минуту."})
        if any(seg.startswith(".") for seg in path.split("/") if seg) or path.endswith((".json", ".log", ".py", ".tmp")) and not path.startswith("/api/"):
            return self.send_error(404)
        if path == "/api/site":
            return self.send_json(200, read_json(DATA_FILE, {}))
        if path == "/api/slots":
            if not rate_ok(("slots", ip), 120, 60):
                return self.send_json(429, {"error": "Слишком много запросов"})
            q = urllib.parse.parse_qs(urllib.parse.urlparse(self.path).query)
            start = (q.get("from", [""])[0] or time.strftime("%Y-%m-%d"))
            try:
                days = max(1, min(42, int(q.get("days", ["7"])[0])))
            except ValueError:
                days = 7
            if not DAY_RE.match(start):
                return self.send_json(400, {"error": "date"})
            try:
                d0 = datetime.date.fromisoformat(start)
            except ValueError:
                return self.send_json(400, {"error": "date"})
            end = (d0 + datetime.timedelta(days=days - 1)).isoformat()
            with LOCK:
                m = busy_map(load_bookings(), read_json(SCHEDULE_FILE, {}), start, end)
            return self.send_json(200, {"busy": {k: v for k, v in m.items() if k != "_closed"}, "closed": m.get("_closed", [])})
        if path.startswith("/api/admin/"):
            _, s = self.session()
            if not s:
                return self.send_json(401, {"error": "auth"})
            if path == "/api/admin/me":
                user = load_users().get(s["login"], {})
                return self.send_json(200, {"login": s["login"], "role": s["role"], "roleName": ROLES.get(s["role"], s["role"]), "name": user.get("name", ""), "mustChange": bool(user.get("mustChange")), "csrf": s["csrf"]})
            if path == "/api/admin/bookings":
                with LOCK:
                    items = load_bookings()
                return self.send_json(200, {"items": items[::-1], "telegram": bool(TG_TOKEN and TG_CHAT), "webhook": bool(WEBHOOK_URL)})
            if path == "/api/admin/schedule":
                q = urllib.parse.parse_qs(urllib.parse.urlparse(self.path).query)
                day = q.get("day", [""])[0]
                if not DAY_RE.match(day):
                    return self.send_json(400, {"error": "date"})
                with LOCK:
                    sched = read_json(SCHEDULE_FILE, {})
                    items = load_bookings()
                booked = {b["time"]: {"id": b["id"], "name": b.get("name", ""), "phone": b.get("phone", ""), "status": b.get("status"), "service": b.get("service", "")}
                          for b in items if b.get("day") == day and b.get("time") and b.get("status") in ACTIVE | {"came", "paid"}}
                entry = sched.get(day, {})
                return self.send_json(200, {"slots": day_slots(day), "booked": booked, "blocked": entry.get("blocked", []), "closed": bool(entry.get("closed"))})
            if s["role"] != "owner":
                return self.send_json(403, {"error": "Недостаточно прав"})
            if path == "/api/admin/users":
                users = load_users()
                return self.send_json(200, {"items": [{"login": k, "name": v.get("name", ""), "role": v["role"], "disabled": bool(v.get("disabled")), "created": v.get("created", "")} for k, v in users.items()]})
            if path == "/api/admin/audit":
                lines = AUDIT_FILE.read_text(encoding="utf-8").splitlines()[-300:] if AUDIT_FILE.exists() else []
                return self.send_json(200, {"items": [json.loads(x) for x in reversed(lines) if x.strip()]})
            return self.send_json(404, {"error": "not found"})
        if path.startswith("/api/"):
            return self.send_json(404, {"error": "not found"})
        if path == "/robots.txt":
            if DEMO:
                return self.send_text(200, "User-agent: *\nDisallow: /\n", "text/plain; charset=utf-8")
            return self.send_text(200, f"User-agent: *\nDisallow: /admin\nDisallow: /api/\n\nSitemap: {self.base_url()}/sitemap.xml\n", "text/plain; charset=utf-8")
        if path == "/sitemap.xml":
            return self.send_text(200, render_sitemap(self.base_url()), "application/xml; charset=utf-8")
        if path in ("/", "/index.html"):
            return self.send_text(200, render_index(self.base_url()), "text/html; charset=utf-8")
        m = re.match(r"^/uslugi/([a-z0-9-]{2,60})/?$", path)
        if m:
            page = render_service(self.base_url(), m.group(1))
            if page:
                return self.send_text(200, page, "text/html; charset=utf-8")
            return self.send_error(404)
        if path == "/admin":
            self.path = "/admin.html"
        if path == "/privacy":
            self.path = "/privacy.html"
        return super().do_GET()

    def check_slot(self, items, day, slot, skip_id=None):
        if slot and (not day or slot not in day_slots(day)):
            return "Это время недоступно"
        if day and not day_slots(day):
            return "В этот день клиника не принимает"
        if day:
            taken = busy_map(items, read_json(SCHEDULE_FILE, {}), day, day, skip_id)
            if day in taken.get("_closed", []):
                return "В этот день записи нет. Выберите другой день."
            if slot and slot in taken.get(day, []):
                return "Это время уже заняли. Выберите другое."
        return ""

    def do_POST(self):
        path = urllib.parse.urlparse(self.path).path
        ip = self.client_ip()
        if not rate_ok(("post", ip), 120, 60):
            return self.send_json(429, {"error": "Слишком много запросов. Подождите минуту."})

        if path == "/api/book":
            data = self.body(20_000)
            if data is None:
                return self.send_json(400, {"error": "Некорректный запрос"})
            if not rate_ok(("book", ip), 5, 600) or not rate_ok(("book-all",), 200, 3600):
                return self.send_json(429, {"error": "Слишком много заявок. Позвоните нам или попробуйте позже."})
            if clean_text(data.get("website"), 200):
                return self.send_json(200, {"ok": True})
            name = clean_text(data.get("name"), 80)
            phone = clean_phone(data.get("phone"))
            if not name:
                return self.send_json(400, {"error": "Укажите имя"})
            if phone and len([c for c in phone if c.isdigit()]) < 10:
                return self.send_json(400, {"error": "Проверьте номер телефона"})
            if data.get("consent") is not True:
                return self.send_json(400, {"error": "Нужно согласие на обработку данных"})
            day = clean_text(data.get("day"), 10)
            slot = clean_text(data.get("time"), 5)
            if day and not DAY_RE.match(day):
                day = ""
            channel = "whatsapp" if data.get("channel") == "whatsapp" else "site"
            item = normalize({
                "id": int(time.time() * 1000) + secrets.randbelow(1000),
                "created": now_str(),
                "name": name,
                "phone": phone,
                "service": clean_text(data.get("service"), 80),
                "date": clean_text(data.get("date"), 40),
                "day": day,
                "time": slot,
                "comment": clean_text(data.get("comment"), 300),
                "channel": channel,
                "source": channel,
                "status": "new",
                "consent": {"at": now_str(), "policy": POLICY_VERSION},
            })
            with LOCK:
                items = load_bookings()
                err = self.check_slot(items, day, slot)
                if err:
                    return self.send_json(400 if err == "Это время недоступно" else 409, {"error": err})
                items.append(item)
                write_json(BOOKINGS_FILE, items)
            push_webhook(item)
            notify_new(item)
            return self.send_json(200, {"ok": True})

        if path == "/api/login":
            data = self.body(4_000)
            if data is None:
                return self.send_json(400, {"error": "Некорректный запрос"})
            login = clean_text(data.get("login"), 32).lower()
            pw = str(data.get("password") or "")[:200]
            if not rate_ok(("login", ip), 20, 900) or login_locked(("ip", ip)) or login_locked(("user", login)):
                audit(ip, login, "login_blocked")
                return self.send_json(429, {"error": "Слишком много попыток. Вход заблокирован на 15 минут."})
            user = load_users().get(login)
            ok = bool(user) and not user.get("disabled") and check_password(user, pw)
            if not ok:
                login_failed(("ip", ip))
                login_failed(("user", login), 20)
                audit(ip, login, "login_failed")
                time.sleep(0.6)
                return self.send_json(401, {"error": "Неверный логин или пароль"})
            FAILS.pop(("user", login), None)
            token, csrf = new_session(login, user["role"])
            audit(ip, login, "login")
            return self.send_json(200, {"ok": True, "role": user["role"], "mustChange": bool(user.get("mustChange")), "csrf": csrf}, [self.session_cookie(token, SESSION_TTL)])

        if path == "/api/logout":
            token, s = self.session()
            if token:
                with LOCK:
                    SESSIONS.pop(token, None)
                audit(ip, s["login"], "logout")
            return self.send_json(200, {"ok": True}, [self.session_cookie("", 0)])

        if not path.startswith("/api/admin/"):
            return self.send_json(404, {"error": "not found"})

        token, s = self.session()
        if not s:
            return self.send_json(401, {"error": "auth"})
        if not hmac.compare_digest(self.headers.get("X-CSRF", ""), s["csrf"]):
            audit(ip, s["login"], "csrf_rejected", path)
            return self.send_json(403, {"error": "Сессия устарела, обновите страницу"})
        if not rate_ok(("admin", s["login"]), 300, 60):
            return self.send_json(429, {"error": "Слишком много запросов"})
        user = load_users().get(s["login"], {})
        if user.get("mustChange") and path != "/api/admin/password":
            return self.send_json(403, {"error": "Сначала смените пароль"})
        if s["role"] != "owner" and path not in MANAGER_ALLOWED:
            audit(ip, s["login"], "forbidden", path)
            return self.send_json(403, {"error": "Недостаточно прав"})
        data = self.body(8_000_000 if path == "/api/admin/upload" else 600_000)
        if data is None:
            return self.send_json(400, {"error": "Некорректный запрос"})
        who = s["login"]

        if path == "/api/admin/ping":
            return self.send_json(200, {"ok": True})

        if path == "/api/admin/password":
            users = load_users()
            u = users.get(who)
            if not u or not check_password(u, str(data.get("old") or "")):
                audit(ip, who, "password_change_failed")
                return self.send_json(400, {"error": "Текущий пароль неверный"})
            new = str(data.get("new") or "")
            prob = password_problem(new)
            if prob:
                return self.send_json(400, {"error": prob})
            u["salt"], u["hash"] = hash_password(new)
            u["mustChange"] = False
            with LOCK:
                save_users(users)
            drop_sessions_of(who)
            token, csrf = new_session(who, u["role"])
            audit(ip, who, "password_changed")
            return self.send_json(200, {"ok": True, "csrf": csrf}, [self.session_cookie(token, SESSION_TTL)])

        if path == "/api/admin/users":
            login = clean_text(data.get("login"), 32).lower()
            if not LOGIN_RE.match(login):
                return self.send_json(400, {"error": "Логин: 3–32 символа, латиница, цифры, точка, дефис"})
            role = data.get("role")
            if role not in ROLES:
                return self.send_json(400, {"error": "Неизвестная роль"})
            users = load_users()
            if login == "owner" and who != "owner":
                return self.send_json(403, {"error": "Главную учётку владельца может менять только она сама"})
            u = users.get(login, {"created": now_str()})
            if login == who and role != "owner":
                return self.send_json(400, {"error": "Нельзя снять с себя роль владельца"})
            pw = str(data.get("password") or "")
            if login not in users and not pw:
                return self.send_json(400, {"error": "Для нового сотрудника нужен пароль"})
            if pw:
                prob = password_problem(pw)
                if prob:
                    return self.send_json(400, {"error": prob})
                u["salt"], u["hash"] = hash_password(pw)
                u["mustChange"] = True
                drop_sessions_of(login)
            u["role"] = role
            u["name"] = clean_text(data.get("name"), 60)
            u["disabled"] = bool(data.get("disabled")) and login != who
            if u["disabled"]:
                drop_sessions_of(login)
            users[login] = u
            with LOCK:
                save_users(users)
            audit(ip, who, "user_saved", f"{login} ({role}{', отключён' if u['disabled'] else ''}{', новый пароль' if pw else ''})")
            return self.send_json(200, {"ok": True})

        if path == "/api/admin/users/delete":
            login = clean_text(data.get("login"), 32).lower()
            if login == who:
                return self.send_json(400, {"error": "Нельзя удалить себя"})
            if login == "owner":
                return self.send_json(403, {"error": "Главную учётку владельца удалить нельзя"})
            users = load_users()
            if users.pop(login, None) is not None:
                with LOCK:
                    save_users(users)
                drop_sessions_of(login)
                audit(ip, who, "user_deleted", login)
            return self.send_json(200, {"ok": True})

        if path == "/api/admin/status":
            status = LEGACY.get(data.get("status"), data.get("status"))
            if status not in STATUSES:
                return self.send_json(400, {"error": "status"})
            with LOCK:
                items = load_bookings()
                it = set_status(items, data.get("id"), status, who)
                write_json(BOOKINGS_FILE, items)
            if it:
                push_webhook(it, "status")
            return self.send_json(200, {"ok": True, "item": it})

        if path == "/api/admin/booking":
            bid = data.get("id")
            with LOCK:
                items = load_bookings()
                it = next((x for x in items if x["id"] == bid), None) if bid else None
                creating = it is None
                if creating:
                    it = normalize({"id": int(time.time() * 1000) + secrets.randbelow(1000), "created": now_str(), "channel": "manual", "source": "phone", "status": "new", "history": [{"at": now_str(), "to": "new", "by": who}]})
                for k, n in (("name", 80), ("service", 80), ("comment", 300), ("doctor", 80), ("date", 40)):
                    if k in data:
                        it[k] = clean_text(data[k], n)
                if "phone" in data:
                    it["phone"] = clean_phone(data["phone"])
                if "source" in data and data["source"] in SOURCES:
                    it["source"] = data["source"]
                if "amount" in data:
                    try:
                        it["amount"] = max(0, min(100_000_000, int(float(str(data["amount"]).replace(" ", "") or 0))))
                    except ValueError:
                        return self.send_json(400, {"error": "Сумма должна быть числом"})
                if "day" in data or "time" in data:
                    day = clean_text(data.get("day", it.get("day")), 10)
                    slot = clean_text(data.get("time", it.get("time")), 5)
                    if day and not DAY_RE.match(day):
                        return self.send_json(400, {"error": "Неверная дата"})
                    if (day, slot) != (it.get("day"), it.get("time")):
                        err = self.check_slot(items, day, slot, None if creating else it["id"])
                        if err:
                            return self.send_json(409, {"error": err})
                    it["day"], it["time"] = day, slot
                if not it.get("name"):
                    return self.send_json(400, {"error": "Укажите имя"})
                note = clean_text(data.get("note"), 1000)
                if note:
                    it["notes"].append({"at": now_str(), "text": note, "by": who})
                if "status" in data:
                    st = LEGACY.get(data["status"], data["status"])
                    if st in STATUSES:
                        set_status([it], it["id"], st, who)
                it["updated"] = now_str()
                if creating:
                    items.append(it)
                write_json(BOOKINGS_FILE, items)
            push_webhook(it, "created" if creating else "updated")
            return self.send_json(200, {"ok": True, "item": it})

        if path == "/api/admin/booking/delete":
            with LOCK:
                items = load_bookings()
                gone = [x for x in items if x["id"] == data.get("id")]
                left = [x for x in items if x["id"] != data.get("id")]
                write_json(BOOKINGS_FILE, left)
            if gone:
                audit(ip, who, "booking_deleted", f"id {gone[0]['id']}")
            return self.send_json(200, {"ok": True, "removed": len(gone)})

        if path == "/api/admin/export":
            audit(ip, who, "export", clean_text(data.get("what"), 40))
            return self.send_json(200, {"ok": True})

        if path == "/api/admin/tg-test":
            if not TG_TOKEN or not TG_CHAT:
                return self.send_json(400, {"error": "Telegram не подключён: нужны TG_TOKEN и TG_CHAT"})
            r = tg_call("sendMessage", {"chat_id": TG_CHAT, "text": "✅ Diamond: тестовое сообщение. Уведомления о заявках будут приходить сюда."})
            if not r or not r.get("ok"):
                return self.send_json(502, {"error": "Telegram не принял сообщение. Проверьте токен и chat id."})
            return self.send_json(200, {"ok": True})

        if path == "/api/admin/site":
            site = read_json(DATA_FILE, {})
            for key in ("settings", "services", "doctors", "promos", "cases", "trust", "faq", "reviews"):
                if key in data:
                    if not isinstance(data[key], (list, dict)):
                        return self.send_json(400, {"error": f"Неверный формат: {key}"})
                    site[key] = data[key]
            if "reels" in data:
                site["reels"] = clean_reels(data["reels"])
            used = set()
            for sv in site.get("services", []) if isinstance(site.get("services"), list) else []:
                if isinstance(sv, dict):
                    slug = re.sub(r"[^a-z0-9-]", "", str(sv.get("slug") or "").lower().replace(" ", "-")) or translit_slug(sv.get("title", ""))
                    base_slug, n = slug or "usluga", 2
                    slug = base_slug
                    while slug in used:
                        slug = f"{base_slug}-{n}"; n += 1
                    used.add(slug)
                    sv["slug"] = slug
            with LOCK:
                write_json(DATA_FILE, site)
            audit(ip, who, "site_saved", ", ".join(k for k in data.keys())[:120])
            return self.send_json(200, {"ok": True})

        if path == "/api/admin/schedule":
            day = str(data.get("day", ""))
            if not DAY_RE.match(day):
                return self.send_json(400, {"error": "date"})
            valid = set(day_slots(day))
            blocked = sorted({t for t in data.get("blocked", []) if t in valid}, key=lambda t: tuple(map(int, t.split(":"))))
            with LOCK:
                sched = read_json(SCHEDULE_FILE, {})
                entry = {"blocked": blocked, "closed": bool(data.get("closed"))}
                if entry["blocked"] or entry["closed"]:
                    sched[day] = entry
                else:
                    sched.pop(day, None)
                write_json(SCHEDULE_FILE, sched)
            return self.send_json(200, {"ok": True})

        if path == "/api/admin/upload":
            kind = IMAGE_MAGIC.get(str(data.get("type", "")))
            raw = str(data.get("data", ""))
            if not kind or not raw:
                return self.send_json(400, {"error": "Нужна картинка JPG, PNG или WEBP"})
            try:
                blob = base64.b64decode(raw.split(",", 1)[-1], validate=True)
            except Exception:
                return self.send_json(400, {"error": "Файл повреждён"})
            if len(blob) > 5_000_000:
                return self.send_json(400, {"error": "Файл больше 5 МБ"})
            magic, ext = kind
            if not blob.startswith(magic) or (ext == ".webp" and blob[8:12] != b"WEBP"):
                audit(ip, who, "upload_rejected", "содержимое не совпадает с типом")
                return self.send_json(400, {"error": "Файл не является картинкой этого типа"})
            folder = STATIC / "img" / "uploads"
            folder.mkdir(parents=True, exist_ok=True)
            name = f"{int(time.time() * 1000)}{secrets.token_hex(4)}{ext}"
            (folder / name).write_bytes(blob)
            audit(ip, who, "upload", name)
            return self.send_json(200, {"ok": True, "path": f"img/uploads/{name}"})

        return self.send_json(404, {"error": "not found"})

    def do_PUT(self):
        self.send_error(405)

    def do_DELETE(self):
        self.send_error(405)

    def do_OPTIONS(self):
        self.send_error(405)


def cli_users(args):
    users = load_users()
    if not args or args[0] == "list":
        for k, v in users.items():
            print(f"{k:20} {v['role']:8} {'отключён' if v.get('disabled') else ''}")
        return
    if args[0] in ("add", "passwd") and len(args) >= 2:
        login = args[1].lower()
        if not LOGIN_RE.match(login):
            raise SystemExit("Логин: 3–32 символа, латиница, цифры, точка, дефис")
        role = args[2] if len(args) > 2 else users.get(login, {}).get("role", "manager")
        if role not in ROLES:
            raise SystemExit("Роль: owner или manager")
        pw = getpass.getpass("Пароль: ")
        prob = password_problem(pw)
        if prob:
            raise SystemExit(prob)
        if pw != getpass.getpass("Ещё раз: "):
            raise SystemExit("Пароли не совпадают")
        u = users.get(login, {"created": now_str(), "name": ""})
        u["salt"], u["hash"] = hash_password(pw)
        u["role"] = role
        u["mustChange"] = False
        u.pop("disabled", None)
        users[login] = u
        save_users(users)
        print(f"Готово: {login} ({role})")
        return
    if args[0] == "del" and len(args) >= 2:
        users.pop(args[1].lower(), None)
        save_users(users)
        print("Удалён")
        return
    raise SystemExit("Команды: users list | users add <логин> [owner|manager] | users passwd <логин> | users del <логин>")


if __name__ == "__main__":
    if len(sys.argv) > 1 and sys.argv[1] == "users":
        cli_users(sys.argv[2:])
        raise SystemExit(0)
    if not DATA_FILE.exists():
        raise SystemExit("data.json missing")
    bootstrap_users()
    with LOCK:
        if BOOKINGS_FILE.exists():
            write_json(BOOKINGS_FILE, load_bookings())
    for f in (DATA_FILE, SCHEDULE_FILE, USERS_FILE, AUDIT_FILE):
        if f.exists():
            try:
                os.chmod(f, 0o600)
            except OSError:
                pass
    print(f"Diamond: http://localhost:{PORT}  admin: /admin")
    print("Telegram:", "on" if TG_TOKEN and TG_CHAT else "off (set TG_TOKEN and TG_CHAT)")
    threading.Thread(target=maintenance_loop, daemon=True).start()
    if TG_TOKEN and TG_CHAT:
        threading.Thread(target=tg_poll, daemon=True).start()
    srv = ThreadingHTTPServer((HOST, PORT), Handler)
    srv.daemon_threads = True
    srv.request_queue_size = 64
    srv.serve_forever()
