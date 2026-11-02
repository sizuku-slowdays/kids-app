from pathlib import Path
root=Path(__file__).resolve().parent.parent
p=root/'cloudflare/calendar-worker/calendar-worker.js'
s=p.read_text();mark='\n// BEGIN HOME BODY CALENDAR\n'
if mark in s:s=s.split(mark)[0]
s=s.replace("    const homeResponse = await homeCalendarGate(request,env,path);", "    if(path.startsWith('/home-karada/'))return homeBodyRoute(request,env);\n    if(path.startsWith('/karada/')&&await env.DB.prepare(\"SELECT 1 FROM sqlite_master WHERE type='table' AND name='home_karada_links'\").first())return err('HOMEのからだカレンダーを開いてください。旧記録は保管されています',409);\n    const homeResponse = await homeCalendarGate(request,env,path);") if 'return homeBodyRoute(request,env)' not in s else s
p.write_text(s+mark+(root/'cloudflare/calendar-worker/body-home.js').read_text())
