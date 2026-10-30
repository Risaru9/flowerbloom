import json,time,urllib.request,urllib.error
from pathlib import Path
from datetime import datetime,timedelta,timezone
import pymysql
root=Path(r'C:\Users\USER\AppData\Local\Temp\flowerbloom-audit-20261026-211117\browser')
b='http://127.0.0.1:18080/api/v1'
def req(path,token=None,data=None):
 h={'Content-Type':'application/json'}
 if token:h['Authorization']='Bearer '+token
 r=urllib.request.Request(b+path,data=json.dumps(data).encode() if data is not None else None,headers=h)
 with urllib.request.urlopen(r,timeout=15) as x:return json.load(x)
def login(e,p):return req('/auth/masuk',data={'email':e,'kata_sandi':p})['access_token']
a=login('admin-audit@example.com','AuditAdmin-20261026-LocalOnly');c=login('browser-audit@example.com','AuditBrowser-20261026-LocalOnly')
stocks=req('/admin/stok',a);s=next(x for x in stocks if x['jenis']['nama_bunga']=='Mawar' and x['warna']['nama_warna']=='Putih')
initial=(s['jumlah_tersedia'],s['jumlah_ditahan'])
assert initial==(50,0),initial
p1=req('/admin/pesanan/1',a);p2=req('/admin/pesanan/2',a)
assert p1['status']['kode']=='selesai' and p2['status']['kode']=='dibatalkan'
info=req('/toko/info');date=(datetime.now(timezone(timedelta(hours=7))).date()+timedelta(days=2)).isoformat()
p=req('/pesanan',c,{'items':[{'jenis_item':'rangkai_sendiri','bunga':[{'id_stok':s['id_stok'],'jumlah_tangkai':5}]}],'nama_penerima':'Audit Scheduler Dummy','tanggal_kirim':date,'slot_jam':info['slot_pengiriman'][0]})
pid=p['id_pesanan']
conn=pymysql.connect(host='127.0.0.1',port=13316,user='flowerbloom_audit',password='auditDb_20261026_UrlSafe_9',database='flowerbloom_browser_uji',autocommit=True)
with conn.cursor() as cur:
 cur.execute('SELECT DATABASE()');assert cur.fetchone()[0]=='flowerbloom_browser_uji'
 cur.execute('UPDATE pesanan SET batas_bayar=UTC_TIMESTAMP()-INTERVAL 1 MINUTE WHERE id_pesanan=%s AND kode_pesanan=%s AND status=%s',(pid,p['kode_pesanan'],'menunggu_pembayaran'));assert cur.rowcount==1
conn.close()
print('Waiting for actual production lifespan scheduler on audit order '+str(pid),flush=True)
start=time.monotonic();status=None
while time.monotonic()-start<80:
 status=req('/pesanan/'+str(pid),c)['status']['kode']
 if status=='dibatalkan':break
 time.sleep(3)
stock_after=next(x for x in req('/admin/stok',a) if x['id_stok']==s['id_stok'])
result={'date':'2026-10-30','order1_status':p1['status']['kode'],'order1_revision_count':p1['jumlah_revisi'],'order1_photo_count':len(p1['foto']),'order2_status':p2['status']['kode'],'stock_after_browser_cancel':list(initial),'scheduler_order_id':pid,'scheduler_final_status':status,'scheduler_wait_seconds':round(time.monotonic()-start,2),'stock_restored':(stock_after['jumlah_tersedia'],stock_after['jumlah_ditahan'])==initial,'scope':'Only dummy audit database; timestamp moved into past for this newly created order only. Actual production API scheduler handled expiry.'}
(root/'resume-server-results.json').write_text(json.dumps(result,indent=2),encoding='utf-8');print(json.dumps(result,indent=2))
assert status=='dibatalkan' and result['stock_restored']
