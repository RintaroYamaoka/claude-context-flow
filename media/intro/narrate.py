#!/usr/bin/env python3
"""narrate.py ― 台本 → Kokoro(jf_alpha)で声 → 声の長さに合わせて場面の時間軸を伸ばす →
src/scenes-timed/*.html(build.mjs が読む)・index.html・assets/mix.wav(声+効果音+BGM)を作る。
出来事の時刻(ev)も同じ写像で動かし、通しの時刻の表 G と場面の開始 T0 を各 scene に書き戻す(src/pane.js が読む)。
使い方: VENV_PY narrate.py   (VENV_PY = kokoro_onnx / pyopenjtalk / misaki[ja] / soundfile / numpy の入った Python)"""
import re, os, json, subprocess, sys, glob
import numpy as np, soundfile as sf
ROOT=os.path.dirname(os.path.abspath(__file__)); os.chdir(ROOT)
PY=sys.executable
SPEED='1.16'; PAD=0.45; LEAD=0.1
SR=48000

# 場面: (id, 旧の尺, アンカー[(旧時刻, 台本 or None)])  None = 字幕が消える点(その区間は伸ばさない)
SC=[
 ('hook',8,[(0.6,'セッションが長くなると、トランスクリプトは流れていく。'),(3.4,None),
            (3.8,'いま何の話をしていて、ここまでに何が決まったのか。さかのぼらないと、分からない。'),(7.6,None)]),
 ('reveal',9,[(0.3,'コンテキストフロー。右にペインを一枚。左の Claude Code は素のまま。'),(3.2,None),
              (3.6,'途中から入れても、それまでの会話を読んで、流れを起こす。'),(8.6,None)]),
 ('flow',12,[(0.4,'流れは年表。一ターンが、見出しと説明。何を頼み、どうなったか。'),(4.6,None),
             (5.0,'書くのは会話の中身だけ。中断した、ツールを実行した、といった動作は書かない。'),(8.2,None),
             (8.6,'古い順に上から、最新が下。窓の外の続きは、前に何ターン、と出る。'),(11.6,None)]),
 ('now',14,[(2.2,'送った瞬間に、下に、いま、が出る。依頼文と、経過時間。'),(4.0,None),
            (4.4,'実行中のツールが流れる。いま動いている一行には、小さな波形。'),(8.0,None),
            (8.4,'サブエージェントが走れば、種類と、説明と、最新のツールが、一行ずつ。'),(13.6,None)]),
 ('meter',11,[(0.4,'モデルとコンテキストの量は、常に上。バーは七十パーセントで琥珀、八十五パーセントで赤。'),(4.8,None),
              (5.2,'上と下は固定。スクロールするのは、年表だけ。'),(10.6,None)]),
 ('done',10,[(0.6,'ターンが終わると、要約が届く。見出しと説明が、一文字ずつ打ち出される。'),(4.8,None),
             (5.2,'一番上は目的。セッション全体を一文で。話がずれると、直る。'),(9.6,None)]),
 ('jump',5.8,[(0.4,'見出しを押すと、左のトランスクリプトが、そのターンの発言まで飛ぶ。'),(5.4,None)]),
 ('end',7.6,[(0.6,'長いセッションでも、話の流れを見失わない。設定は無い。プラグイン インストール、コンテキストフロー。'),(7.6,None)]),
]
FILES={re.sub(r'^\d+-','',os.path.basename(f))[:-5]:f for f in glob.glob('src/scenes/*.html')}

# 1) 声
lines=[]
for sid,dur,anc in SC:
    for i,(t0,txt) in enumerate(anc):
        if txt: lines.append(dict(id=f'{sid}_{i:02d}',tts=txt))
json.dump(lines,open('_lines.json','w'),ensure_ascii=False,indent=0)
subprocess.run(['timeout','900',PY,'tools/synth.py','_lines.json','_vo',SPEED],check=True)
VD={l['id']:sf.info(f"_vo/{l['id']}.wav").duration for l in lines}

# 2) 時間軸の写像(区間ごと・伸ばすだけ)
def build_map(anc,end,sid):
    times=[a[0] for a in anc]+[end]; pts=[(0.0,0.0),(times[0],times[0])]; cur=times[0]
    for i,(t0,txt) in enumerate(anc):
        old=times[i+1]-t0; need=(VD[f'{sid}_{i:02d}']+LEAD+PAD) if txt else 0
        cur+=max(old,need); pts.append((times[i+1],cur))
    xs=[p[0] for p in pts]; ys=[p[1] for p in pts]
    def m(t):
        if t>=xs[-1]: return t+(ys[-1]-xs[-1])
        return float(np.interp(t,xs,ys))
    return m, ys[-1]
NUM=r'(\d+(?:\.\d+)?)'
P1=re.compile(r'\b(ev|words|unwords|show|hide|rise|pop|swapIn|swapOut|press|flip|keys|unkeys|typeIn|pick|swapTo|label|unlabel|scrollTo|unfocusRows)\(("[^"]*"|\[[^\]]*\]),\s*'+NUM)
P2=re.compile(r'\bblink\(("[^"]*"|\[[^\]]*\]),\s*'+NUM+r',\s*'+NUM)
P3=re.compile(r'(tl\.(?:to|fromTo|set)\((?:[^()]|\([^()]*\))*?\},\s*)'+NUM+r'(\))')
P4=re.compile(r'(\bfocusRows\("[^"]*",\s*\[[^\]]*\],\s*)'+NUM)
def fmt(x): return ('%.3f'%x).rstrip('0').rstrip('.') or '0'
NEW={}; cur=0.0; VOICE=[]
os.makedirs('src/scenes-timed',exist_ok=True)
for f in glob.glob('src/scenes-timed/*.html'): os.remove(f)
for sid,dur,anc in SC:
    m,new_end=build_map(anc,dur,sid); new_end=round(new_end,2)
    src=open(FILES[sid],encoding='utf-8').read(); markup,script=src.split('<!--SCRIPT-->')
    markup=re.sub(r'(class="stage clip" data-start="0" data-duration=")[\d.]+(")',lambda g:g.group(1)+fmt(new_end)+g.group(2),markup,count=1)
    out=[]
    for ln in script.split('\n'):
        ln=P1.sub(lambda g:f'{g.group(1)}({g.group(2)},{fmt(m(float(g.group(3))))}',ln)
        ln=P2.sub(lambda g:f'blink({g.group(1)},{fmt(m(float(g.group(2))))},{fmt(m(float(g.group(3))))}',ln)
        ln=P3.sub(lambda g:g.group(1)+fmt(m(float(g.group(2))))+g.group(3),ln)
        ln=P4.sub(lambda g:g.group(1)+fmt(m(float(g.group(2)))),ln)
        out.append(ln)
    open(f'src/scenes-timed/{os.path.basename(FILES[sid])}','w',encoding='utf-8').write(markup+'<!--SCRIPT-->'+'\n'.join(out))
    NEW[sid]=dict(start=round(cur,2),dur=new_end,map=m)
    for i,(t0,txt) in enumerate(anc):
        if txt: VOICE.append((f'{sid}_{i:02d}',round(cur+m(t0)+LEAD,3)))
    print(f'{sid:7s} {dur:5.1f} -> {new_end:6.2f}  start {cur:7.2f}',flush=True); cur=round(cur+new_end,2)
TOTAL=round(cur,2); print('TOTAL',TOTAL,round(TOTAL/60,2),'min')

# 2b) 出来事の時刻の表(通し時刻)と場面の開始を、各 scene に書き戻す
G={}
for sid,dur,anc in SC:
    src=open(f'src/scenes-timed/{os.path.basename(FILES[sid])}',encoding='utf-8').read()
    for g in re.finditer(r'\bev\("(\w+)",\s*'+NUM+r'\)',src): G[g.group(1)]=round(NEW[sid]['start']+float(g.group(2)),3)
for sid,dur,anc in SC:
    f=f'src/scenes-timed/{os.path.basename(FILES[sid])}'; src=open(f,encoding='utf-8').read()
    src=re.sub(r'(?m)^const G=.*$',lambda _:'const G='+json.dumps(G,separators=(',',':'))+';',src)
    src=re.sub(r'(?m)^const T0=.*$',lambda _:f'const T0={NEW[sid]["start"]};',src)
    open(f,'w',encoding='utf-8').write(src)


# 3) 効果音:press → key、pop → pop、大きな遷移に whoosh(旧時刻)
WHOOSH={'reveal':[0.7],'now':[2.0],'done':[2.4],'jump':[2.5],'end':[0.3]}
CLICK={'now':[2.0],'jump':[2.4],'meter':[6.6,6.8,7.0,7.2,7.4,8.8,9.0,9.2,9.4,9.6]}
SFX=[]
for sid,dur,anc in SC:
    src=open(FILES[sid],encoding='utf-8').read().split('<!--SCRIPT-->')[1]; m=NEW[sid]['map']; st=NEW[sid]['start']
    for g in re.finditer(r'\bpress\(("[^"]*"),\s*'+NUM,src): SFX.append(('assets/audio/key.mp3',st+m(float(g.group(2))),.45))
    for g in re.finditer(r'\bpop\(("[^"]*"),\s*'+NUM,src): SFX.append(('assets/audio/pop.mp3',st+m(float(g.group(2))),.4))
    for t in WHOOSH.get(sid,[]): SFX.append(('assets/audio/whoosh.mp3',st+m(t),.5))
    for t in CLICK.get(sid,[]): SFX.append(('assets/audio/key.mp3',st+m(t),.3 if sid=='meter' else .6))
json.dump([dict(src=a,at=round(t,3),vol=v) for a,t,v in sorted(SFX,key=lambda x:x[1])],open('_sfx.json','w'),indent=0)
print('sfx',len(SFX))

# 4) ミックス:声 −16 dBFS RMS / BGM −20 dBFS・声の下で −55 % / 効果音
N=int((TOTAL+1)*SR)
def load(path):
    tmp=f'_vo/_{os.path.basename(path)}.wav'
    if not os.path.exists(tmp): subprocess.run(['ffmpeg','-nostdin','-v','error','-y','-i',path,'-ac','1','-ar',str(SR),tmp],check=True)
    x,_=sf.read(tmp,dtype='float32'); return x
def place(buf,x,t,g=1.0):
    i=int(t*SR); x=x[:max(0,N-i)]; buf[i:i+len(x)]+=x*g
voice=np.zeros(N,dtype='float32')
for vid,t in VOICE:
    v,sr=sf.read(f'_vo/{vid}.wav',dtype='float32')
    if v.ndim>1: v=v.mean(axis=1)
    m_=int(len(v)*SR/sr); v=np.interp(np.linspace(0,len(v)-1,m_),np.arange(len(v)),v).astype('float32')
    place(voice,v,t)
voice*=10**(-16/20)/max(1e-6,float(np.sqrt(np.mean(voice[np.abs(voice)>1e-3]**2))))
fx=np.zeros(N,dtype='float32')
for s,t,v in SFX: place(fx,load(s),t,v)
mus=load('assets/audio/drift-minimal-podcastac-ccby.mp3'); fade=4*SR
w=np.ones(len(mus),dtype='float32'); w[:fade]=np.linspace(0,1,fade); w[-fade:]=np.linspace(1,0,fade)
bed=np.zeros(N,dtype='float32'); i=0
while i<N:
    a=(mus*w)[:max(0,N-i)]; bed[i:i+len(a)]+=a; i+=len(mus)-fade
bed*=10**(-20/20)/max(1e-6,float(np.sqrt(np.mean(bed**2))))
hop=SR//10; env=np.array([float(np.abs(voice[p:p+hop]).max())>.01 for p in range(0,N,hop)],dtype='float32')
env=np.convolve(env,np.ones(5)/5,'same'); duck=np.interp(np.arange(N),np.arange(len(env))*hop,1-.55*env).astype('float32')
end=int(TOTAL*SR); f_=np.ones(N,dtype='float32'); f_[end-2*SR:end]=np.linspace(1,0,2*SR); f_[end:]=0
mix=voice+bed*duck*f_*.7+fx
pk=float(np.abs(mix).max()); mix=mix*min(1,.89/pk)
sf.write('assets/mix.wav',mix[:end],SR,subtype='PCM_16'); print('mix.wav peak',round(pk,3))

# 5) index.html
hosts='\n'.join(f'      <div id="{sid}" data-composition-id="{sid}" data-composition-src="compositions/{sid}.html" data-start="{NEW[sid]["start"]}" data-duration="{NEW[sid]["dur"]}" data-track-index="1" data-track-kind="graphics" data-width="1920" data-height="1080"></div>' for sid,_,_ in SC)
head=open('index.html',encoding='utf-8').read().split('<div id="root"')[0]
open('index.html','w',encoding='utf-8').write(head+f'''<div id="root" data-composition-id="main" data-start="0" data-duration="{TOTAL}" data-width="1920" data-height="1080" data-fps="30">
      <div id="bg"></div>
{hosts}
      <audio id="mix" src="assets/mix.wav" data-start="0" data-duration="{TOTAL}" data-track-index="3" data-volume="1"></audio>
    </div>
    <script>
      window.__timelines["main"] = gsap.timeline({{ paused: true }});
    </script>
  </body>
</html>
''')
json.dump(dict(total=TOTAL,scenes={s:dict(start=NEW[s]['start'],dur=NEW[s]['dur']) for s,_,_ in SC},voice=VOICE),open('_timing.json','w'),ensure_ascii=False,indent=1)
print('index.html written')
