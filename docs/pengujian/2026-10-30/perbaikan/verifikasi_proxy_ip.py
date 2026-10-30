"""Verify login throttling through the real audit Nginx -> Uvicorn chain."""
import json
import urllib.error
import urllib.request
from pathlib import Path

url = 'http://127.0.0.1:18080/api/v1/auth/masuk'
payload = json.dumps({'email':'audit-rate-nonexistent@example.com','kata_sandi':'DummyWrongPassword-OnlyLocal'}).encode()


def attempt(forwarded=None):
    headers = {'Content-Type':'application/json'}
    if forwarded:
        headers['X-Forwarded-For'] = forwarded
    req = urllib.request.Request(url, data=payload, headers=headers,method='POST')
    try:
        response = urllib.request.urlopen(req,timeout=15)
    except urllib.error.HTTPError as exc:
        response = exc
    body = json.loads(response.read())
    return {'claimed_forwarded_for':forwarded,'status':response.status,'kode':body.get('kode')}


baseline = [attempt() for _ in range(7)]
spoofed = [attempt(f'198.51.100.{i}') for i in range(1,8)]
result = {'baseline':baseline,'spoofed':spoofed,
    'baseline_lock_seen':any(r['status'] == 429 for r in baseline),
    'caller_controlled_header_resets_limit':all(r['status'] == 401 for r in spoofed)}
Path(__file__).with_name('proxy-ip.json').write_text(json.dumps(result,indent=2),encoding='utf-8')
print(json.dumps(result,indent=2))

assert result['baseline_lock_seen']
assert all(r['status'] == 429 for r in spoofed), result
print('PASS: header X-Forwarded-For buatan tidak mereset pembatas login')
