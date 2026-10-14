"""Build local教材 from existing app, KANJIDIC2 JSON and a pinned KanjiVG ZIP.
Usage: python scripts/build-daily-kanji.py /path/kanjidic.json /path/kvg.zip
Build-only dependency: pykakasi. No network access and no private user data.
"""
import json,re,sys,zipfile,subprocess,hashlib
from pathlib import Path
from xml.etree import ElementTree as ET
from pykakasi import kakasi
root=Path(__file__).resolve().parents[1]
source=root/'kids-app/kanji-stroke-app.html'
js="const fs=require('fs'),vm=require('vm');const s=fs.readFileSync(process.argv[1],'utf8'),c={};vm.runInNewContext(s.slice(s.indexOf('const GRADE_KANJI'),s.indexOf('const KANJI_LIST'))+';this.grades=GRADE_KANJI;this.meta=KANJI_META',c);process.stdout.write(JSON.stringify(c));"
old=json.loads(subprocess.check_output(['node','-e',js,str(source)]))
review=json.loads(re.search(r'const KANJI_BY_GRADE = (.*);', (root/'kids-app/kanji_review_multi_grade_v1.html').read_text()).group(1))
words={x['k']:x['words'] for g in review.values() for x in g}
supp=dict(line.split('|',1) for line in (root/'scripts/kanji-meaning-supplement.txt').read_text().splitlines() if line)
extra={p[0]:{'w':p[1],'r':p[2]} for p in (line.split('|') for line in (root/'scripts/kanji-future-examples.txt').read_text().splitlines() if line)}
dictionary=json.load(open(sys.argv[1]));kd={c['literal']:c for c in dictionary['characters']}
z=zipfile.ZipFile(sys.argv[2]);reader=kakasi()
def kana(s):return ''.join(p['hira'] for p in reader.convert(s))
entries=[];stroke_files={};expected={1:80,2:160,3:200,4:202,5:193,6:191}
for g,chars in old['grades'].items():
 g=int(g);assert len(chars)==expected[g]
 paths={}
 for c in chars:
  assert kd[c]['misc'].get('grade')==g,(c,g,kd[c]['misc'].get('grade'))
  meta=old['meta'].get(c,{})
  raw=[r for group in kd[c]['readingMeaning']['groups'] for r in group['readings']]
  on=meta.get('on','').split('・') if meta.get('on') else [r['value'] for r in raw if r['type']=='ja_on'][:3]
  kun=meta.get('kun','').split('・') if meta.get('kun') else [r['value'].replace('.','').strip('-') for r in raw if r['type']=='ja_kun'][:6]
  kun=[{'みつ':'みっつ','よつ':'よっつ','やつ':'やっつ','むつ':'むっつ'}.get(v,v) for v in kun]
  meaning=supp.get(c) or meta.get('m');assert meaning,c
  candidates=words.get(c)
  example=extra.get(c) or (candidates[0] if candidates else None);assert example,c
  w,r=example['w'],example['r']
  # Old review examples sometimes omitted kana affixes; keep full word readings.
  prefix=re.match(r'^[ぁ-ゖー]+',w);suffix=re.search(r'[ぁ-ゖー]+$',w)
  if prefix and not r.startswith(prefix[0]):r=prefix[0]+r
  if suffix and not r.endswith(suffix[0]):r+=suffix[0]
  corrections={'文なし':('作文','さくぶん'),'論理的':('論理的','ろんりてき'),'ほう石':('宝石','ほうせき'),'三日':('三日','みっか'),'四日':('四日','よっか'),'七日':('七日','なのか'),'雲天':('雲海','うんかい'),'朝の会':('朝の会','あさのかい'),'家の門':('家の門','いえのもん'),'福の神':('福の神','ふくのかみ')}
  w,r=corrections.get(w,(w,r));assert c in w,(c,w)
  entries.append({'character':c,'grade':g,'on':on,'kun':kun,'meaning':meaning,'meaning_reading':kana(meaning),'example':w,'example_reading':r})
  code=f'{ord(c):05x}';doc=ET.fromstring(z.read(f'kanji/{code}.svg'))
  ps=[p.attrib['d'] for p in doc.iter('{http://www.w3.org/2000/svg}path') if re.search(r'-s\d+$',p.attrib.get('id',''))]
  assert len(ps)==kd[c]['misc']['strokeCounts'][0],(c,len(ps),kd[c]['misc']['strokeCounts'])
  paths[c]=ps
 stroke_files[g]=paths
assert len(entries)==1026 and len({x['character'] for x in entries})==1026
out=root/'cloudflare/home-worker/public/apps/daily-kanji'
(out/'catalog.json').write_text(json.dumps({'version':'mext-2017-home-20261014','entries':entries},ensure_ascii=False,separators=(',',':'))+'\n')
for g,data in stroke_files.items():(out/f'strokes-{g}.json').write_text(json.dumps(data,ensure_ascii=False,separators=(',',':'))+'\n')
audit={'version':'20261014','counts':expected,'total':len(entries),'initial_range_1_3':sum(expected[g] for g in [1,2,3]),'strokes':sum(len(v) for v in stroke_files.values()),'missing':[],'independent_grade_check':'KANJIDIC2 1026/1026 matched','kanjidic_date':dictionary['dictDate'],'kanjivg_release':'r20260714','input_sha256':{Path(p).name:hashlib.sha256(Path(p).read_bytes()).hexdigest() for p in sys.argv[1:3]},'existing_app_commit':'b4c2ddafbf561ccaf791133d8e3475a218f0c262'}
(root/'docs/main-work/daily-kanji-content-audit.json').write_text(json.dumps(audit,ensure_ascii=False,indent=2)+'\n')
print(json.dumps(audit,ensure_ascii=False))
