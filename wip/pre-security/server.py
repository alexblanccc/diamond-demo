import base64
import datetime
import json
import os
import re
import secrets
import threading
import time
import urllib.parse
import urllib.request
import html
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from pathlib import Path

ROOT = Path(__file__).parent
STATIC = ROOT / "static"
DATA_FILE = ROOT / "data.json"
BOOKINGS_FILE = ROOT / "bookings.json"
SCHEDULE_FILE = ROOT / "schedule.json"
LOCK = threading.Lock()

PORT = int(os.environ.get("PORT", "8090"))
ADMIN_PASS = os.environ.get("ADMIN_PASS", "diamond")
TG_TOKEN = os.environ.get("TG_TOKEN", "")
TG_CHAT = os.environ.get("TG_CHAT", "")
WEBHOOK_URL = os.environ.get("WEBHOOK_URL", "")

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
HOURS = {0: (9, 19), 1: (9, 19), 2: (9, 19), 3: (9, 19), 4: (9, 19), 5: (9, 18)}
REEL_RE = re.compile(r"instagram\.com/(?:[A-Za-z0-9_.]+/)?(reel|reels|p|tv)/([A-Za-z0-9_-]{5,20})")


def now_str():
    return time.strftime("%Y-%m-%d %H:%M")


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


def read_json(path, default):
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return default


def write_json(path, value):
    tmp = path.with_suffix(".tmp")
    tmp.write_text(json.dumps(value, ensure_ascii=False, indent=2), encoding="utf-8")
    tmp.replace(path)


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
        print("telegram error:", method, e)
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

    def run():
        tg_call("sendMessage", {"chat_id": TG_CHAT, "text": tg_text(b), "parse_mode": "HTML", "reply_markup": tg_keyboard(b)})

    threading.Thread(target=run, daemon=True).start()


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
                tg_call("editMessageText", {
                    "chat_id": TG_CHAT, "message_id": cq["message"]["message_id"],
                    "text": tg_text(it), "parse_mode": "HTML", "reply_markup": tg_keyboard(it),
                })
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
            print("webhook error:", e)

    threading.Thread(target=run, daemon=True).start()


def clean_text(v, n):
    return str(v or "").strip()[:n]


def clean_phone(v):
    return "".join(c for c in str(v or "") if c.isdigit() or c == "+")[:16]


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(STATIC), **kwargs)

    def log_message(self, fmt, *args):
        pass

    def end_headers(self):
        p = urllib.parse.urlparse(self.path).path
        if not p.startswith("/api/") and (p.endswith((".js", ".css", ".html")) or p in ("/", "/admin")):
            self.send_header("Cache-Control", "no-cache")
        super().end_headers()

    def send_json(self, code, payload):
        raw = json.dumps(payload, ensure_ascii=False).encode()
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(raw)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(raw)

    def body(self):
        n = int(self.headers.get("Content-Length") or 0)
        limit = 8_000_000 if self.path.startswith("/api/admin/") else 100_000
        if n > limit:
            return {}
        try:
            return json.loads(self.rfile.read(n).decode("utf-8") or "{}")
        except Exception:
            return {}

    def is_admin(self):
        return self.headers.get("X-Admin-Pass", "") == ADMIN_PASS

    def do_GET(self):
        path = urllib.parse.urlparse(self.path).path
        if path == "/api/site":
            return self.send_json(200, read_json(DATA_FILE, {}))
        if path == "/api/admin/bookings":
            if not self.is_admin():
                return self.send_json(401, {"error": "auth"})
            with LOCK:
                items = load_bookings()
            return self.send_json(200, {"items": items[::-1], "telegram": bool(TG_TOKEN and TG_CHAT), "webhook": bool(WEBHOOK_URL)})
        if path == "/api/slots":
            q = urllib.parse.parse_qs(urllib.parse.urlparse(self.path).query)
            start = (q.get("from", [""])[0] or time.strftime("%Y-%m-%d"))
            try:
                days = max(1, min(42, int(q.get("days", ["7"])[0])))
            except ValueError:
                days = 7
            if not DAY_RE.match(start):
                return self.send_json(400, {"error": "date"})
            d0 = datetime.date.fromisoformat(start)
            end = (d0 + datetime.timedelta(days=days - 1)).isoformat()
            with LOCK:
                m = busy_map(load_bookings(), read_json(SCHEDULE_FILE, {}), start, end)
            return self.send_json(200, {"busy": {k: v for k, v in m.items() if k != "_closed"}, "closed": m.get("_closed", [])})
        if path == "/api/admin/schedule":
            if not self.is_admin():
                return self.send_json(401, {"error": "auth"})
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
        if path == "/admin":
            self.path = "/admin.html"
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
        data = self.body()

        if path == "/api/book":
            name = clean_text(data.get("name"), 80)
            phone = clean_phone(data.get("phone"))
            if not name:
                return self.send_json(400, {"error": "Укажите имя"})
            if phone and len([c for c in phone if c.isdigit()]) < 10:
                return self.send_json(400, {"error": "Проверьте номер телефона"})
            if not data.get("consent"):
                return self.send_json(400, {"error": "Нужно согласие на обработку данных"})
            day = clean_text(data.get("day"), 10)
            slot = clean_text(data.get("time"), 5)
            if day and not DAY_RE.match(day):
                day = ""
            channel = "whatsapp" if data.get("channel") == "whatsapp" else "site"
            item = normalize({
                "id": int(time.time() * 1000),
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
            })
            with LOCK:
                items = load_bookings()
                err = self.check_slot(items, day, slot)
                if err:
                    return self.send_json(409 if "занял" in err or "нет" in err or "не принимает" in err else 400, {"error": err})
                items.append(item)
                write_json(BOOKINGS_FILE, items)
            push_webhook(item)
            notify_new(item)
            return self.send_json(200, {"ok": True})

        if path.startswith("/api/admin/"):
            if not self.is_admin():
                return self.send_json(401, {"error": "auth"})

            if path == "/api/admin/status":
                status = LEGACY.get(data.get("status"), data.get("status"))
                if status not in STATUSES:
                    return self.send_json(400, {"error": "status"})
                with LOCK:
                    items = load_bookings()
                    it = set_status(items, data.get("id"), status, "admin")
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
                        it = normalize({"id": int(time.time() * 1000), "created": now_str(), "channel": "manual", "source": "phone", "status": "new", "history": [{"at": now_str(), "to": "new", "by": "admin"}]})
                    for k, n in (("name", 80), ("service", 80), ("comment", 300), ("doctor", 80), ("date", 40)):
                        if k in data:
                            it[k] = clean_text(data[k], n)
                    if "phone" in data:
                        it["phone"] = clean_phone(data["phone"])
                    if "source" in data and data["source"] in SOURCES:
                        it["source"] = data["source"]
                    if "amount" in data:
                        try:
                            it["amount"] = max(0, int(float(str(data["amount"]).replace(" ", "") or 0)))
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
                        it["notes"].append({"at": now_str(), "text": note})
                    if "status" in data:
                        st = LEGACY.get(data["status"], data["status"])
                        if st in STATUSES:
                            set_status([it], it["id"], st, "admin")
                    it["updated"] = now_str()
                    if creating:
                        items.append(it)
                    write_json(BOOKINGS_FILE, items)
                push_webhook(it, "created" if creating else "updated")
                return self.send_json(200, {"ok": True, "item": it})

            if path == "/api/admin/booking/delete":
                with LOCK:
                    items = load_bookings()
                    left = [x for x in items if x["id"] != data.get("id")]
                    write_json(BOOKINGS_FILE, left)
                return self.send_json(200, {"ok": True, "removed": len(items) - len(left)})

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
                        site[key] = data[key]
                if "reels" in data:
                    site["reels"] = clean_reels(data["reels"])
                with LOCK:
                    write_json(DATA_FILE, site)
                return self.send_json(200, {"ok": True})

            if path == "/api/admin/ping":
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
                kinds = {"image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp"}
                ext = kinds.get(str(data.get("type", "")))
                raw = str(data.get("data", ""))
                if not ext or not raw:
                    return self.send_json(400, {"error": "Нужна картинка JPG, PNG или WEBP"})
                try:
                    blob = base64.b64decode(raw.split(",", 1)[-1], validate=True)
                except Exception:
                    return self.send_json(400, {"error": "Файл повреждён"})
                if len(blob) > 5_000_000:
                    return self.send_json(400, {"error": "Файл больше 5 МБ"})
                folder = STATIC / "img" / "uploads"
                folder.mkdir(parents=True, exist_ok=True)
                name = f"{int(time.time() * 1000)}{secrets.token_hex(3)}{ext}"
                (folder / name).write_bytes(blob)
                return self.send_json(200, {"ok": True, "path": f"img/uploads/{name}"})

        return self.send_json(404, {"error": "not found"})


if __name__ == "__main__":
    if not DATA_FILE.exists():
        raise SystemExit("data.json missing")
    with LOCK:
        if BOOKINGS_FILE.exists():
            write_json(BOOKINGS_FILE, load_bookings())
    print(f"Diamond demo: http://localhost:{PORT}  admin: /admin  password: {ADMIN_PASS}")
    print("Telegram:", "on" if TG_TOKEN and TG_CHAT else "off (set TG_TOKEN and TG_CHAT)")
    if TG_TOKEN and TG_CHAT:
        threading.Thread(target=tg_poll, daemon=True).start()
    ThreadingHTTPServer(("0.0.0.0", PORT), Handler).serve_forever()
