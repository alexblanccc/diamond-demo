import datetime, json, random, sys, time
from pathlib import Path
root = Path(__file__).resolve().parent.parent
random.seed(7)
site = json.loads((root / 'data.json').read_text(encoding='utf-8'))
services = [s.get('title') or s.get('name') for s in site.get('services', []) if (s.get('title') or s.get('name'))] or ['Лечение кариеса']
names = ['Айгерим', 'Данияр', 'Мария', 'Ерлан', 'Светлана', 'Асель', 'Тимур', 'Ольга', 'Нурлан', 'Камила', 'Руслан', 'Жанар', 'Игорь', 'Дина', 'Арман', 'Елена', 'Бауыржан', 'Сауле', 'Виктор', 'Алия', 'Максат', 'Наталья']
price = {0: 15000, 1: 25000, 2: 18000, 3: 250000, 4: 12000, 5: 90000, 6: 20000}
today = datetime.date.today()
items = []
plan = ['paid'] * 8 + ['came'] * 2 + ['booked'] * 4 + ['contacted'] * 2 + ['new'] * 3 + ['no_show', 'cancelled', 'cancelled']
sources = ['site'] * 6 + ['whatsapp'] * 4 + ['instagram'] * 3 + ['2gis'] * 4 + ['phone'] * 2 + ['referral']
slots = ['10:00', '11:30', '14:00', '15:30', '17:00']
for i, st in enumerate(plan):
    ago = random.randint(0, 2) if st in ('new', 'contacted') else random.randint(1, 28)
    created = datetime.datetime.combine(today - datetime.timedelta(days=ago), datetime.time(random.randint(9, 20), random.choice([5, 17, 32, 48])))
    si = random.randrange(len(services))
    if st == 'booked':
        day = today + datetime.timedelta(days=1 if i % 2 else random.randint(2, 6))
    elif st in ('paid', 'came', 'no_show'):
        day = created.date() + datetime.timedelta(days=random.randint(0, 3))
        day = min(day, today)
    else:
        day = None
    if day and day.weekday() == 6:
        day = day + datetime.timedelta(days=1)
    t = slots[i % len(slots)] if day else ''
    b = {'id': int(time.time() * 1000) + i, 'created': created.strftime('%Y-%m-%d %H:%M'), 'name': f"{names[i % len(names)]} (тест)",
         'phone': f"+7700{random.randint(1000000, 9999999)}", 'service': services[si], 'date': '', 'day': day.isoformat() if day else '', 'time': t,
         'comment': '', 'channel': 'site', 'source': random.choice(sources), 'status': st,
         'amount': price.get(si, 20000) if st == 'paid' else 0, 'doctor': '', 'notes': [],
         'history': [{'at': created.strftime('%Y-%m-%d %H:%M'), 'to': 'new', 'by': 'site'}] + ([{'at': created.strftime('%Y-%m-%d %H:%M'), 'from': 'new', 'to': st, 'by': 'admin'}] if st != 'new' else [])}
    items.append(b)
(root / 'bookings.json').write_text(json.dumps(items, ensure_ascii=False, indent=1), encoding='utf-8')
print(len(items), 'demo bookings')
