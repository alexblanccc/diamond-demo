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
LOCK = threading.Lock()

PORT = int(os.environ.get("PORT", "8090"))
ADMIN_PASS = os.environ.get("ADMIN_PASS", "diamond")
TG_TOKEN = os.environ.get("TG_TOKEN", "")
TG_CHAT = os.environ.get("TG_CHAT", "")
WEBHOOK_URL = os.environ.get("WEBHOOK_URL", "")

STATUSES = ["new", "confirmed", "done", "cancelled"]
SCHEDULE_FILE = ROOT / "schedule.json"
DAY_RE = re.compile(r"^\d{4}-\d{2}-\d{2}$")
HOURS = {0: (9, 19), 1: (9, 19), 2: (9, 19), 3: (9, 19), 4: (9, 19), 5: (9, 18)}


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


def busy_map(bookings, sched, start, end):
    out = {}
    for b in bookings:
        d, t = b.get("day"), b.get("time")
        if d and t and start <= d <= end and b.get("status") in ("new", "confirmed"):
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
REEL_RE = re.compile(r"instagram\.com/(?:[A-Za-z0-9_.]+/)?(reel|reels|p|tv)/([A-Za-z0-9_-]{5,20})")


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


def notify(text):
    if not TG_TOKEN or not TG_CHAT:
        return

    def run():
        try:
            body = urllib.parse.urlencode(
                {"chat_id": TG_CHAT, "text": text, "parse_mode": "HTML"}
            ).encode()
            urllib.request.urlopen(
                f"https://api.telegram.org/bot{TG_TOKEN}/sendMessage", body, timeout=10
            )
        except Exception as e:
            print("telegram error:", e)

    threading.Thread(target=run, daemon=True).start()


def push_webhook(item):
    if not WEBHOOK_URL:
        return

    def run():
        try:
            req = urllib.request.Request(
                WEBHOOK_URL,
                data=json.dumps({"event": "booking", "source": "diamond-site", "booking": item}, ensure_ascii=False).encode(),
                headers={"Content-Type": "application/json"},
                method="POST",
            )
            urllib.request.urlopen(req, timeout=10)
        except Exception as e:
            print("webhook error:", e)

    threading.Thread(target=run, daemon=True).start()


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(STATIC), **kwargs)

    def log_message(self, fmt, *args):
        pass

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
                items = read_json(BOOKINGS_FILE, [])
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
                m = busy_map(read_json(BOOKINGS_FILE, []), read_json(SCHEDULE_FILE, {}), start, end)
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
                items = read_json(BOOKINGS_FILE, [])
            booked = {b["time"]: {"name": b.get("name", ""), "phone": b.get("phone", ""), "status": b.get("status"), "service": b.get("service", "")}
                      for b in items if b.get("day") == day and b.get("time") and b.get("status") in ("new", "confirmed")}
            entry = sched.get(day, {})
            return self.send_json(200, {"slots": day_slots(day), "booked": booked, "blocked": entry.get("blocked", []), "closed": bool(entry.get("closed"))})
        if path == "/admin":
            self.path = "/admin.html"
        return super().do_GET()

    def do_POST(self):
        path = urllib.parse.urlparse(self.path).path
        data = self.body()

        if path == "/api/book":
            name = str(data.get("name", "")).strip()[:80]
            phone = "".join(c for c in str(data.get("phone", "")) if c.isdigit() or c == "+")[:16]
            service = str(data.get("service", "")).strip()[:80]
            date = str(data.get("date", "")).strip()[:30]
            comment = str(data.get("comment", "")).strip()[:300]
            channel = "whatsapp" if data.get("channel") == "whatsapp" else "site"
            if not name:
                return self.send_json(400, {"error": "Укажите имя"})
            if phone and len([c for c in phone if c.isdigit()]) < 10:
                return self.send_json(400, {"error": "Проверьте номер телефона"})
            if not data.get("consent"):
                return self.send_json(400, {"error": "Нужно согласие на обработку данных"})
            day = str(data.get("day", "")).strip()
            slot = str(data.get("time", "")).strip()
            if day and not DAY_RE.match(day):
                day = ""
            if slot and (not day or slot not in day_slots(day)):
                return self.send_json(400, {"error": "Это время недоступно"})
            if day and not day_slots(day):
                return self.send_json(409, {"error": "В этот день клиника не принимает"})
            item = {
                "id": int(time.time() * 1000),
                "created": time.strftime("%Y-%m-%d %H:%M"),
                "name": name,
                "phone": phone,
                "service": service,
                "date": date,
                "day": day,
                "time": slot,
                "comment": comment,
                "channel": channel,
                "status": "new",
            }
            with LOCK:
                items = read_json(BOOKINGS_FILE, [])
                if day:
                    taken = busy_map(items, read_json(SCHEDULE_FILE, {}), day, day)
                    if day in taken.get("_closed", []):
                        return self.send_json(409, {"error": "В этот день записи нет. Выберите другой день."})
                    if slot and slot in taken.get(day, []):
                        return self.send_json(409, {"error": "Это время уже заняли. Выберите другое."})
                items.append(item)
                write_json(BOOKINGS_FILE, items)
            push_webhook(item)
            e = html.escape
            notify(
                "<b>Новая запись</b>\n"
                f"Имя: {e(name)}\nТелефон: {e(phone)}\n"
                f"Услуга: {e(service or 'не выбрана')}\nКогда: {e(date or 'не указано')}\n"
                f"Комментарий: {e(comment or '-')}"
            )
            return self.send_json(200, {"ok": True})

        if path.startswith("/api/admin/"):
            if not self.is_admin():
                return self.send_json(401, {"error": "auth"})

            if path == "/api/admin/status":
                bid = data.get("id")
                status = data.get("status")
                if status not in STATUSES:
                    return self.send_json(400, {"error": "status"})
                with LOCK:
                    items = read_json(BOOKINGS_FILE, [])
                    for it in items:
                        if it["id"] == bid:
                            it["status"] = status
                    write_json(BOOKINGS_FILE, items)
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
    print(f"Diamond demo: http://localhost:{PORT}  admin: /admin  password: {ADMIN_PASS}")
    print("Telegram:", "on" if TG_TOKEN and TG_CHAT else "off (set TG_TOKEN and TG_CHAT)")
    ThreadingHTTPServer(("0.0.0.0", PORT), Handler).serve_forever()
