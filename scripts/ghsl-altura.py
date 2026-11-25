# Lê os quadros GeoTIFF da GHSL (float32, LZW, 256x256) e grava a altura média por célula de 100 m em metros do jogo.
import struct, sys, json, math
def lzw(data):
    out=bytearray(); tab=[bytes([i]) for i in range(256)]+[b'',b'']
    bitpos=0; n=9; prev=None; total=len(data)*8
    while bitpos+n<=total:
        byte=bitpos>>3; chunk=int.from_bytes(data[byte:byte+3].ljust(3,b'\0'),'big')
        code=(chunk>>(24-(bitpos&7)-n))&((1<<n)-1); bitpos+=n
        if code==256: tab=tab[:258]; n=9; prev=None; continue
        if code==257: break
        if prev is None: e=tab[code]
        elif code<len(tab): e=tab[code]; tab.append(prev+e[:1])
        else: e=prev+prev[:1]; tab.append(e)
        out+=e; prev=e
        if len(tab)+1>=(1<<n) and n<12: n+=1
    return bytes(out)
class Tif:
    def __init__(s,path):
        f=s.f=open(path,'rb').read(); off=struct.unpack('<I',f[4:8])[0]; n=struct.unpack('<H',f[off:off+2])[0]; s.t={}
        for i in range(n):
            tag,typ,cnt=struct.unpack('<HHI',f[off+2+i*12:off+10+i*12]); raw=f[off+10+i*12:off+14+i*12]
            sz={3:2,4:4,12:8}.get(typ,1)*cnt; d=raw if sz<=4 else f[struct.unpack('<I',raw)[0]:][:sz]
            if typ==3: s.t[tag]=struct.unpack('<%dH'%cnt,d[:2*cnt])
            elif typ==4: s.t[tag]=struct.unpack('<%dI'%cnt,d[:4*cnt])
            elif typ==12: s.t[tag]=struct.unpack('<%dd'%cnt,d[:8*cnt])
        s.W=s.t[256][0]; s.H=s.t[257][0]; s.x0=s.t[33922][3]; s.y0=s.t[33922][4]; s.cache={}
        s.tpr=(s.W+255)//256
    def px(s,c,r):
        if not(0<=c<s.W and 0<=r<s.H): return None
        k=(r//256)*s.tpr+c//256
        if k not in s.cache:
            o=s.t[324][k]; b=s.t[325][k]; s.cache[k]=struct.unpack('<65536f',lzw(s.f[o:o+b])[:262144].ljust(262144,b'\0'))
        return s.cache[k][(r%256)*256+c%256]
R=6378137
def moll(lat,lon):
    p=math.radians(lat); t=p
    for _ in range(30): t-=(2*t+math.sin(2*t)-math.pi*math.sin(p))/(2+2*math.cos(2*t))
    return 2*math.sqrt(2)/math.pi*R*math.radians(lon)*math.cos(t), math.sqrt(2)*R*math.sin(t)
meta=json.load(open(sys.argv[1]))['meta']; tifs=[Tif(p) for p in sys.argv[3:]]
xmin=(meta['bbox']['w']-meta['lon0'])*meta['mLon']; xmax=(meta['bbox']['e']-meta['lon0'])*meta['mLon']
zmin=-(meta['bbox']['n']-meta['lat0'])*meta['mLat']; zmax=-(meta['bbox']['s']-meta['lat0'])*meta['mLat']
C=100; gw=math.ceil((xmax-xmin)/C); gh=math.ceil((zmax-zmin)/C); v=[]; known=0
for j in range(gh):
    for i in range(gw):
        x=xmin+(i+.5)*C; z=zmin+(j+.5)*C; lon=meta['lon0']+x/meta['mLon']; lat=meta['lat0']-z/meta['mLat']
        mx,my=moll(lat,lon); h=None
        for t in tifs:
            h=t.px(int((mx-t.x0)//100), int((t.y0-my)//100))
            if h is not None: break
        if h is None or h<0: v.append(-1)
        else: v.append(round(h*2)); known+=1
json.dump({'src':'GHSL GHS-BUILT-H ANBH 2018 R2023A (CC BY 4.0, European Commission JRC)','cell':C,'x0':xmin,'z0':zmin,'w':gw,'h':gh,'scale':0.5,'v':v},open(sys.argv[2],'w'),separators=(',',':'))
hs=sorted(x/2 for x in v if x>0); print('cells',gw*gh,'known',known,'built',len(hs),'pcts',[hs[int(len(hs)*p)] for p in (.1,.5,.9,.99)] if hs else None)
