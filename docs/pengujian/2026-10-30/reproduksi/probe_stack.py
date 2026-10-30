"""Bounded HTTP checks against the disposable audit stack only."""
import concurrent.futures
import io
import json
import re
import statistics
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent
BASE = sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:18080'
API = '/api/v1'
RESULTS = []


def request(path, method='GET', data=None, token=None, raw=None, content_type=None):
    headers = {}
    if token:
        headers['Authorization'] = 'Bearer ' + token
    if data is not None:
        raw = json.dumps(data).encode()
        headers['Content-Type'] = 'application/json'
    if content_type:
        headers['Content-Type'] = content_type
    before = time.perf_counter()
    req = urllib.request.Request(BASE + path, data=raw, headers=headers, method=method)
    try:
        response = urllib.request.urlopen(req, timeout=30)
    except urllib.error.HTTPError as exc:
        response = exc
    body = response.read()
    elapsed = time.perf_counter() - before
    try:
        parsed = json.loads(body)
    except (json.JSONDecodeError, UnicodeDecodeError):
        parsed = body.decode(errors='replace')
    return response.status, parsed, dict(response.headers), elapsed


def record(name, expected, response):
    status, body, headers, elapsed = response
    result = {'case': name, 'expected': expected, 'status': status, 'passed': status == expected, 'seconds': round(elapsed, 4)}
    if isinstance(body, dict) and 'kode' in body:
        result['kode'] = body['kode']
    RESULTS.append(result)
    return response


def login(email, password):
    response = request(API + '/auth/masuk', 'POST', {'email': email, 'kata_sandi': password})
    assert response[0] == 200, (email, response[0], response[1])
    return response[1]['access_token']


home = record('nginx homepage', 200, request('/'))
assert 'text/html' in home[2].get('Content-Type', '')
RESULTS.append({'case': 'homepage security headers', 'headers': {k: v for k, v in home[2].items() if k.lower() in {'content-security-policy','x-content-type-options','referrer-policy','permissions-policy','cache-control'} }})
record('SPA deep route direct navigation', 200, request('/akun/pesanan/999999'))
record('unknown API is JSON 404', 404, request(API + '/does-not-exist-audit'))
record('account without token', 401, request(API + '/auth/saya'))
record('admin without token', 401, request(API + '/admin/stok'))
record('tampered bearer token rejected', 401, request(API + '/auth/saya', token='not-a-valid-jwt'))

assets = re.findall(r'(?:src|href)="(/assets/[^\"]+)"', home[1])
if assets:
    asset = record('hashed static asset served', 200, request(assets[0]))
    RESULTS.append({'case': 'hashed asset cache', 'cache_control': asset[2].get('Cache-Control')})

for path in ['/manifest.webmanifest', '/sw.js']:
    response = record('PWA resource ' + path, 200, request(path))
    RESULTS.append({'case': 'PWA resource cache ' + path, 'cache_control': response[2].get('Cache-Control'), 'content_type': response[2].get('Content-Type')})

admin = login('admin-audit@example.com', 'AuditAdmin-20261026-LocalOnly')
customer = login('pelanggan@example.com', 'contoh-flowerbloom-123')
record('customer forbidden admin stock', 403, request(API + '/admin/stok', token=customer))
record('admin cannot customer checkout', 403, request(API + '/pesanan', 'POST', {
    'items':[{'jenis_item':'paket','id_produk':1,'jumlah':1}],
    'nama_penerima':'Audit Dummy','tanggal_kirim':'2026-10-28','slot_jam':'09:00-11:00'
}, token=admin))
record('admin stock list', 200, request(API + '/admin/stok', token=admin))

paths = [API + '/produk', API + '/rangkai/opsi', API + '/warna', API + '/toko/info']
before = time.perf_counter()
with concurrent.futures.ThreadPoolExecutor(max_workers=5) as pool:
    load = list(pool.map(lambda i: request(paths[i % len(paths)]), range(50)))
durations = sorted(r[3] for r in load)
RESULTS.append({'case':'bounded mixed public reads', 'requests':len(load), 'concurrency':5,
    'statuses':{str(s):sum(r[0] == s for r in load) for s in set(r[0] for r in load)},
    'total_seconds':round(time.perf_counter()-before,3),
    'median_seconds':round(statistics.median(durations),4),
    'p95_seconds':round(durations[int(.95*(len(durations)-1))],4), 'max_seconds':round(max(durations),4)})

source = Image.open(Path(r'D:\capstone\backend\scripts\foto_demo\pesona-merah.webp')).convert('RGB')
for size in [(1000,1000), (4000,3000)]:
    image = source.resize(size)
    buffer = io.BytesIO()
    image.save(buffer, format='JPEG', quality=90)
    photo = buffer.getvalue()
    boundary = 'flowerbloom-audit-fixture-boundary'
    body = (f'--{boundary}\r\nContent-Disposition: form-data; name="foto"; filename="audit-{size[0]}x{size[1]}.jpg"\r\nContent-Type: image/jpeg\r\n\r\n'.encode() + photo + f'\r\n--{boundary}--\r\n'.encode())
    timing = []
    for iteration in range(3):
        response = record(f'scan {size[0]}x{size[1]} sample {iteration+1}', 200,
            request(API + '/admin/stok/pindai', 'POST', token=admin, raw=body, content_type=f'multipart/form-data; boundary={boundary}'))
        timing.append(response[3])
    RESULTS.append({'case':'scan timing summary', 'dimensions':list(size),'bytes':len(photo),
        'samples':3,'median_seconds':round(statistics.median(timing),4),'max_seconds':round(max(timing),4),
        'under_3_seconds_all':all(t < 3 for t in timing), 'accuracy_measured':False})

RESULTS.insert(0, {'base_url':BASE, 'purpose':'local smoke and bounded workload; not hosting capacity guarantee'})
filename = 'http-results-ipv4.json' if '127.0.0.1' in BASE else 'http-results.json'
(ROOT / filename).write_text(json.dumps(RESULTS, ensure_ascii=False, indent=2),encoding='utf-8')
print(json.dumps(RESULTS, ensure_ascii=False, indent=2))
