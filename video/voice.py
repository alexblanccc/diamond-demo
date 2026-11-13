import hashlib, json, os, subprocess, sys, urllib.request
ROOT = os.path.dirname(os.path.abspath(__file__))
KEY = open(os.path.expanduser('~/.elevenlabs_key')).read().strip()
SETTINGS = {'stability': 0.7, 'similarity_boost': 0.85, 'style': 0.15, 'use_speaker_boost': True}
plan = json.load(open(os.path.join(ROOT, 'scenes.json'), encoding='utf-8'))
os.makedirs(os.path.join(ROOT, 'voice'), exist_ok=True)
sc = plan['scenes']
out = []
for i, s in enumerate(sc):
    body = {'text': s['text'], 'model_id': 'eleven_multilingual_v2', 'voice_settings': SETTINGS}
    if i: body['previous_text'] = sc[i-1]['text']
    if i + 1 < len(sc): body['next_text'] = sc[i+1]['text']
    h = hashlib.md5(json.dumps([plan['voice'], body], ensure_ascii=False, sort_keys=True).encode()).hexdigest()[:12]
    path = os.path.join(ROOT, 'voice', f"{i:02d}_{s['id']}_{h}.mp3")
    if not os.path.exists(path):
        req = urllib.request.Request(f"https://api.elevenlabs.io/v1/text-to-speech/{plan['voice']}?output_format=mp3_44100_128",
                                     json.dumps(body).encode(), {'xi-api-key': KEY, 'Content-Type': 'application/json'})
        with urllib.request.urlopen(req, timeout=120) as r:
            open(path, 'wb').write(r.read())
        print('voiced', s['id'])
    d = float(subprocess.check_output(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', path]).decode().strip())
    out.append({**s, 'file': path, 'dur': round(d, 3)})
json.dump(out, open(os.path.join(ROOT, 'timeline.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
print('total', round(sum(x['dur'] for x in out), 1), 's')
