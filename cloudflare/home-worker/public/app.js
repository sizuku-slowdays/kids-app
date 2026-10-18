const root = document.querySelector("#root");
const el = (tag, text, cls) => {
  const n = document.createElement(tag);
  if (text) n.textContent = text;
  if (cls) n.className = cls;
  return n;
};
let me, apps;
const existingApps = {
  album: ['https://cetus.fun/wagaya/album/', '写真・動画やゲームの思い出'],
  timetable: ['https://cetus.fun/wagaya/timetable.html', '4年生・2年生の時間割'],
  notification: ['https://cetus.fun/kanriapp/notification-center.html', '家族のお知らせを確認'],
  learning: ['https://cetus.fun/wagaya/keisan/', '計算・ことばの練習'],
};
const descriptions = {
  'school-prep': '宿題と持ち物を、夜と朝に確認しよう',
  'good-deeds': '自分のいいことを記録して、ポイントをためよう',
  'daily-kanji': '1日3文字。よみ・いみ・書きじゅんをたしかめよう',
  'dining-prices': '人数を選んで、コース料金を比較',
  calendar: '家族みんなの予定を共有',
  kidney: 'じいちゃんの食事を確認',
  'kidney-grandma': 'ばあちゃんの食事を確認',
  passbook: 'おこづかい・ポイント・残高',
  'muscle-bank': '思い立ったらすぐ運動',
  'play-agreement': '外遊びの約束を確認',
};
function appCard(app, featured = false) {
  const target = app.status === 'ready' && app.path ? app.path : existingApps[app.id]?.[0];
  const card = el(target ? 'a' : 'div', null, featured ? 'home-card hero-card' : 'home-card list-card');
  if (target) {
    const url = new URL(target, location.origin);
    if (url.origin === location.origin && url.pathname.startsWith('/apps/')) card.href = url.pathname + url.search;
    else if (url.origin === 'https://cetus.fun') card.href = url.href;
  }
  const copy = el('span', null, 'card-copy');
  copy.append(el('strong', app.name), el('small', target ? (descriptions[app.id] || existingApps[app.id]?.[1] || 'ひらく') : '準備中'));
  card.append(el('span', app.icon, 'card-icon'), copy, el('span', target ? '›' : '', 'card-arrow'));
  return card;
}
function appSection(kicker, title, cls) {
  const section = el('section', null, 'home-section');
  section.append(el('p', kicker, 'section-kicker'), el('h2', title));
  const grid = el('div', null, cls);
  section.append(grid);
  root.append(section);
  return grid;
}
async function api(path, method = "GET", body) {
  const res = await fetch(path, {
    method,
    credentials: "same-origin",
    headers: body ? { "Content-Type": "application/json" } : {},
    body: body ? JSON.stringify(body) : undefined,
    cache: "no-store",
  });
  const data = await res.json();
  if (!res.ok) {
    if (res.status === 401 && !["/api/login", "/api/me"].includes(path))
      location.replace("/login");
    throw new Error(data.error || "接続できません");
  }
  return data;
}
function field(form, key, label, type = "text", autocomplete) {
  const id = "field-" + key;
  form.append(el("label", label));
  const input = el("input");
  input.id = id;
  input.name = key;
  input.type = type;
  input.required = true;
  if (autocomplete) input.autocomplete = autocomplete;
  form.lastChild.htmlFor = id;
  form.append(input);
  return input;
}
function button(text, action, cls = "") {
  const b = el("button", text, cls);
  b.type = "button";
  b.addEventListener("click", action);
  return b;
}
function authScreen() {
  const mode = location.pathname;
  root.replaceChildren(el("div", "WELCOME", "eyebrow"), el("h1", "HOME"));
  const panel = el("section", null, "panel"),
    form = el("form");
  panel.append(
    el(
      "h2",
      mode === "/setup"
        ? "最初のHOMEをつくる"
        : mode === "/register"
          ? "招待からはじめる"
          : "おかえりなさい",
    ),
  );
  if (mode === "/setup") {
    field(form, "secret", "初期設定コード", "password");
    field(form, "household_name", "家庭の名前");
  }
  if (mode === "/register") field(form, "invitation", "招待コード", "password");
  field(form, "login_name", "ログインID", "text", "username");
  if (mode !== "/login") field(form, "display_name", "表示する名前");
  field(
    form,
    "password",
    "パスワード",
    "password",
    mode === "/login" ? "current-password" : "new-password",
  );
  const device = field(form, "device_name", "この端末の名前");
  device.value = /iPhone/.test(navigator.userAgent)
    ? "iPhone"
    : /iPad/.test(navigator.userAgent)
      ? "iPad"
      : "この端末";
  if (mode !== "/login")
    form.append(
      el(
        "p",
        "パスワードは10文字以上。名前はログイン後だけ表示します。",
        "muted",
      ),
    );
  const submit = el("button", mode === "/login" ? "ログイン" : "HOMEをひらく");
  submit.type = "submit";
  const error = el("p", null, "error");
  error.setAttribute("role", "alert");
  form.append(submit, error);
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    submit.disabled = true;
    error.textContent = "";
    try {
      const data = Object.fromEntries(new FormData(form));
      await api(
        mode === "/setup"
          ? "/api/bootstrap"
          : mode === "/register"
            ? "/api/register"
            : "/api/login",
        "POST",
        data,
      );
      location.replace("/");
    } catch (e) {
      error.textContent = e.message;
    } finally {
      submit.disabled = false;
    }
  });
  panel.append(form);
  root.append(panel);
  const nav = el("nav");
  for (const [href, label] of [
    ["/login", "ログイン"],
    ["/register", "招待を受けた方"],
    ["/setup", "最初の設定"],
  ]) {
    if (href === mode) continue;
    const a = el("a", label);
    a.href = href;
    nav.append(a);
  }
  root.append(nav);
}
async function home() {
  me = await api("/api/me");
  apps = await api("/api/home");
  root.classList.remove("home-editor");
  root.replaceChildren();
  const header = el("header"),
    title = el("div");
  title.append(
    el("div", new Intl.DateTimeFormat('ja-JP', {timeZone:'Asia/Tokyo',month:'long',day:'numeric',weekday:'short'}).format(new Date()), "eyebrow"),
    el("h1", "わが家"),
    el("p", me.user.display_name + " さん", "muted"),
  );
  const actions=el("div",null,"home-actions");actions.append(button("HOMEを編集",()=>editHome().catch(showError),"quiet"),button("⚙️ 設定", settings, "quiet"));
  header.append(title,actions);
  root.append(header);
  const visibleApps=apps.filter(a=>a.visible);
  const legacyHome=me.groups.some(g=>g.kind==="household"&&g.workspace_mode==="legacy");
  const isMamaHome=me.groups.some(g=>g.kind==="household"&&g.workspace_mode==="legacy"&&["owner","admin"].includes(g.role));
  document.body.classList.toggle("mama-home",isMamaHome);
  if(isMamaHome){
    const quick=appSection("家計簿","すぐ入力・確認","money-quick-grid");
    for(const app of [
      {id:"kakeibo-index",name:"家計簿メニュー",icon:"💰",path:"https://cetus.fun/kanriapp/kakeibo-index.html",status:"ready"},
      {id:"kakeibo-input",name:"すぐ入力",icon:"✍️",path:"https://cetus.fun/kanriapp/kakeibo-input.html",status:"ready"},
    ]) quick.append(appCard(app));
  }
  const favoriteApps=visibleApps.filter(a=>a.featured);
  const otherApps=visibleApps.filter(a=>!a.featured);
  const simple=visibleApps.length===2&&favoriteApps.length===2&&visibleApps.some(a=>a.id==="calendar")&&visibleApps.some(a=>["kidney","kidney-grandma"].includes(a.id));
  if (visibleApps.length) {
    if(favoriteApps.length){
    const featured = appSection('すぐ開く', simple ? '毎日使うアプリ' : 'よく使うアプリ', simple ? 'hero-grid grandpa-home' : 'hero-grid');
    favoriteApps.forEach(app => featured.append(appCard(app, true)));
    }
    if (!simple) {
      if(otherApps.length){
      const grid = appSection('一覧', 'アプリ', 'home-app-list');
      otherApps.forEach(app => grid.append(appCard(app)));
      }
      if(legacyHome){
      const links = appSection('いつもの', 'からだパワー・お薬タイマー', 'home-app-list');
      for (const app of [
        {id:'karada',name:'からだパワー',icon:'🌈',path:'https://cetus.fun/karada_power/',status:'ready'},
        {id:'medicine',name:'いっぷんお薬タイマー',icon:'💊',path:'https://cetus.fun/kids-app/medicine-game.html',status:'ready'},
      ]) links.append(appCard(app));
      }
    }
  }
  if (!visibleApps.length)
    root.append(el("p", "設定から、使うアプリを追加できます。", "muted"));
  const previousHome = el("a", null, "previous-home");
  previousHome.href = "https://cetus.fun/kids-app/";
  previousHome.append(
    el("span", "🎮", "icon"),
    el("strong", "キッズアプリ一覧"),
    el("small", "›"),
  );
  root.append(previousHome);
}
function settings() {
  root.replaceChildren();
  const header = el("header");
  header.append(el("h1", "設定"), button("HOMEへ", home, "quiet"));
  root.append(header,button("ファミリー・共有グループ",()=>{location.href="/groups";},"quiet"));
  const inviteGroups=me.groups.filter(g=>["owner","admin"].includes(g.role)&&(g.kind==="household"||me.user.platform_role==="operator"));
  if (inviteGroups.length) {
    root.append(el("h2", "大人の家族を招待"),el("p","おじいちゃん・おばあちゃんはこちら。子どもの登録は不要です。","muted"));
    const select = el("select");
    for (const group of inviteGroups) {
      const option = el("option", group.name);
      option.value = group.id;
      select.append(option);
    }
    select.setAttribute("aria-label","招待する家庭・グループ");
    select.hidden=inviteGroups.length===1;
    root.append(select);
    const invitationBox=el("div");root.append(invitationBox);
    root.append(
      button("大人用の招待コードを作る", async () => {
        try {
          const result = await api("/api/invitations", "POST", {
            group_id: select.value,
          });
          const box = el("div", null, "panel");
          box.append(
            el("p", "招待を受けた人が、登録ページでこのコード・ログインID・パスワードを入力します。1人・1回限り、7日間有効です。", "muted"),
            Object.assign(el("a","招待の登録ページを開く"),{href:"/register",target:"_blank",rel:"noopener"}),
            el("p", result.invitation, "token"),
            button(
              "コピー",
              async () => {
                await navigator.clipboard.writeText(result.invitation);
              },
              "quiet",
            ),
            button(
              "この招待を取り消す",
              async () => {
                await api("/api/invitations/" + result.id, "DELETE");
                box.remove();
              },
              "danger",
            ),
          );
          invitationBox.replaceChildren(box);
        } catch (e) {
          showError(e);
        }
      }),
    );
  }
  root.append(el("h2","HOMEの表示"),button("HOMEを編集",()=>editHome().catch(showError),"quiet"),el("p","HOME画面からアプリを移動・非表示にできます。データは削除されません。","muted"));
  if (
    me.groups.some(
      (g) => g.kind === "household" && ["owner", "admin"].includes(g.role),
    )
  )
    root.append(
      el("h2", "家庭の子ども"),
      button("登録・招待", children, "quiet"),
    );
  root.append(
    el("h2", "ログインしている端末"),
    button("端末を確認する", sessions, "quiet"),
  );
  root.append(
    el("h2", "アプリの更新"),
    button("🔄 最新版に更新", async (event) => {
      const update = event.currentTarget;
      update.disabled = true;
      update.textContent = "更新しています…";
      try {
        for (const path of ["/app.js", "/style.css"]) {
          const response = await fetch(path, {cache: "reload", credentials: "same-origin"});
          if (!response.ok) throw new Error("更新できませんでした。もう一度お試しください。");
          await response.text();
        }
        location.replace("/?updated=" + Date.now());
      } catch (e) {
        showError(e);
        update.disabled = false;
        update.textContent = "🔄 最新版に更新";
      }
    }, "quiet"),
    el("p", "最新の画面を読み直します。記録やログインはそのままです。", "muted"),
  );
  root.append(
    el("h2", "この端末"),
    button(
      "ログアウト",
      async () => {
        await api("/api/logout", "POST", {});
        location.replace("/login");
      },
      "danger",
    ),
  );
}
function showError(e) {
  const p = el("p", e.message, "error");
  p.setAttribute("role", "alert");
  root.append(p);
}
async function children() {
  try {
    const [list, accounts] = await Promise.all([api("/api/children"), api("/api/children/accounts")]);
    root.replaceChildren(
      el("h1", "家庭の子ども"),
      button("設定へ", settings, "quiet"),
    );
    const form = el("form"),
      select = el("select");
    select.name = "household_id";
    for (const group of me.groups.filter(
      (g) => g.kind === "household" && ["owner", "admin"].includes(g.role),
    )) {
      const option = el("option", group.name);
      option.value = group.id;
      select.append(option);
    }
    form.append(select);
    field(form, "display_name", "子どもの名前");
    const submit = el("button", "子どもを登録");
    submit.type = "submit";
    form.append(submit);
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      submit.disabled = true;
      try {
        await api(
          "/api/children",
          "POST",
          Object.fromEntries(new FormData(form)),
        );
        await children();
      } catch (e) {
        showError(e);
        submit.disabled = false;
      }
    });
    root.append(form);
    for (const child of list) {
      const row = el("div", null, "row");
      row.append(el("strong", child.display_name));
      if (child.user_id) {
        row.append(el("span", "アカウント登録済み（ID: " + child.login_name + "）", "muted"));
        const targets = list.filter(c => c.household_id === child.household_id && !c.user_id);
        if (targets.length) row.append(button("連携先を修正", () => {
          root.replaceChildren(el("h1", "アカウントの連携先を修正"), button("戻る", children, "quiet"));
          root.append(el("p", "ID「" + child.login_name + "」の現在の連携先：" + child.display_name), el("p", "ID・パスワードは変わりません。変更後、このアカウントはログインし直してください。", "muted"));
          const picker = el("select");
          picker.setAttribute("aria-label", "正しい子どものプロフィール");
          const blank = el("option", "正しい子どもを選ぶ"); blank.value = ""; picker.append(blank);
          for (const target of targets) { const o = el("option", target.display_name); o.value = target.id; picker.append(o); }
          const save = button("選んだ子どもへ結び直す", async () => {
            const target = targets.find(c => c.id === picker.value);
            if (!target || !confirm("ID「" + child.login_name + "」を「" + child.display_name + "」から「" + target.display_name + "」へ結び直しますか？")) return;
            save.disabled = true;
            try {
              await api("/api/children/move-account", "POST", {source_child_id:child.id,target_child_id:target.id,user_id:child.user_id});
              await children();
              root.append(el("p", "連携先を変更しました。対象の携帯では同じID・パスワードでログインし直してください。", "muted"));
            } catch (e) { showError(e); save.disabled = false; }
          });
          save.disabled = true; picker.onchange = () => { save.disabled = !picker.value; };
          root.append(picker, save);
        }, "quiet"));
      }
      else if (me.groups.some(g=>g.id===child.household_id&&["owner","admin"].includes(g.role)))
        row.append(
          button(
            "招待コード",
            async () => {
              try {
                const result = await api("/api/invitations", "POST", {
                  group_id: child.household_id,
                  child_id: child.id,
                });
                root.append(
                  el("p", child.display_name + " さん用（7日間有効）", "muted"),
                  el("p", result.invitation, "token"),
                );
              } catch (e) {
                showError(e);
              }
            },
            "quiet",
          ),
        );
      if (!child.user_id) {
        const candidates = accounts.filter(a => a.household_id === child.household_id);
        if (candidates.length) {
          const picker = el("select");
          picker.setAttribute("aria-label", child.display_name + "の登録済みアカウント");
          const placeholder = el("option", "登録済みアカウントを選ぶ");
          placeholder.value = "";
          picker.append(placeholder);
          for (const a of candidates) {
            const option = el("option", a.display_name + "（ID: " + a.login_name + "）");
            option.value = a.id;
            picker.append(option);
          }
          const link = button("このアカウントと連携", async () => {
            const account = candidates.find(a => a.id === picker.value);
            if (!account) return;
            if (!confirm(child.display_name + " と「" + account.display_name + "（ID: " + account.login_name + "）」を連携します。本人のアカウントで間違いありませんか？")) return;
            link.disabled = true;
            try {
              await api("/api/children/" + encodeURIComponent(child.id) + "/account", "PUT", {user_id: account.id});
              await children();
            } catch (e) { showError(e); link.disabled = false; }
          }, "quiet");
          link.disabled = true;
          picker.onchange = () => { link.disabled = !picker.value; };
          row.append(picker, link);
        }
      }
      root.append(row);
    }
  } catch (e) {
    showError(e);
  }
}
async function sessions() {
  try {
    const data = await api("/api/sessions");
    root.replaceChildren();
    root.append(el("h1", "端末"), button("設定へ", settings, "quiet"));
    for (const s of data.sessions) {
      const row = el("div", null, "row"),
        text = el("div");
      text.append(
        el(
          "strong",
          s.device_name + (s.id === data.current ? "（この端末）" : ""),
        ),
        el(
          "p",
          "ログイン：" + new Date(s.created_at * 1000).toLocaleString("ja-JP"),
          "date",
        ),
      );
      row.append(
        text,
        button(
          "無効にする",
          async () => {
            if (!confirm(s.device_name + " のログインを無効にしますか？"))
              return;
            await api("/api/sessions/" + s.id, "DELETE");
            if (s.id === data.current) location.replace("/login");
            else await sessions();
          },
          "danger",
        ),
      );
      root.append(row);
    }
  } catch (e) {
    showError(e);
  }
}
document.addEventListener("visibilitychange", () => {
  if(document.visibilityState === "visible" && me && root.querySelector("h1")?.textContent === "わが家")
    home().catch(showError);
});
addEventListener("pageshow", (event) => {
  if (event.persisted) location.reload();
});
if (location.pathname === "/join") joinFamily().catch(showError);
else if(location.pathname === "/groups") familyGroups().catch(showError);
else if (["/login", "/setup", "/register"].includes(location.pathname)) authScreen();
else
  home().catch((e) => {
    if (e.message === "ログインしてください") location.replace("/login");
    else {
      root.replaceChildren(
        el("p", "HOMEに接続できませんでした。", "error"),
        button("もう一度", () => location.reload(), "quiet"),
      );
    }
  });





// Invitation tokens stay in the URL fragment, never in query strings or analytics.
async function joinFamily(){
 root.classList.add('family-screen');
 const token=location.hash.slice(1);
 root.replaceChildren(el('h1','招待から参加'));
 if(!/^[0-9a-f]{64}$/.test(token)){root.append(el('p','招待URLを確認してください。','error'));return;}
 const details=await api('/api/families/preview','POST',{invitation:token});
 const labels={create_family:'新しいファミリーを作成',join_family:'招待されたファミリーへ参加',join_sharing:'共有グループへ参加'};
 root.append(el('h2',labels[details.purpose]),el('p','参加しただけで、通帳や他の家庭の個人情報が公開されることはありません。','muted'));
 let signedIn=null;try{signedIn=await api('/api/me');}catch{}
 const familyInput=form=>details.purpose==='create_family'?field(form,'household_name','新しいファミリー名'):null;
 const finish=()=>location.replace('/groups');
 if(signedIn){
  const target=await api('/api/families/inspect','POST',{invitation:token});
  if(target.group)root.append(el('p','参加先：'+target.group.name));
  root.append(el('p',signedIn.user.display_name+' さんとして参加します。'));
  const form=el('form'),name=familyInput(form),confirm=field(form,'confirmed','この招待で参加します','checkbox');
  form.append(el('button','参加する'));form.addEventListener('submit',async e=>{e.preventDefault();const b=form.querySelector('button');b.disabled=true;try{await api('/api/families/accept','POST',{invitation:token,household_name:name?.value,confirmed:confirm.checked});finish();}catch(error){showError(error);}finally{b.disabled=false;}});root.append(form);return;
 }
 const loginPanel=el('section',null,'panel'),login=el('form');loginPanel.append(el('h2','アカウントをお持ちの方'),login);
 const loginId=field(login,'login_name','ログインID','text','username'),loginPassword=field(login,'password','パスワード','password','current-password');
 login.append(el('button','ログインして参加内容を確認'));login.addEventListener('submit',async e=>{e.preventDefault();try{await api('/api/login','POST',{login_name:loginId.value,password:loginPassword.value,device_name:'この端末'});await joinFamily();}catch(error){showError(error);}});root.append(loginPanel);
 const panel=el('section',null,'panel'),form=el('form');panel.append(el('h2','初めて利用する方'),form);
 const name=field(form,'display_name','表示する名前'),id=field(form,'login_name','ログインID（英数字・_・-、3〜40文字）','text','username'),password=field(form,'password','パスワード（10文字以上）','password','new-password'),family=familyInput(form),confirm=field(form,'confirmed','招待を受けてアカウントを作成します','checkbox');
 form.append(el('button','登録して参加する'));form.addEventListener('submit',async e=>{e.preventDefault();const b=form.querySelector('button');b.disabled=true;try{await api('/api/register-family','POST',{invitation:token,display_name:name.value,login_name:id.value,password:password.value,household_name:family?.value,confirmed:confirm.checked,device_name:'この端末'});finish();}catch(error){showError(error);}finally{b.disabled=false;}});root.append(panel);
}
async function familyGroups(){
 root.classList.add('family-screen');
 const state=await api('/api/families');
 root.replaceChildren(el('h1','ファミリー・共有グループ'),button('HOMEへ',()=>{location.href='/';},'quiet'));
 if(!state.ready)root.append(el('p','準備中です。カレンダーの複数家庭対応を確認するまで、新しい招待・参加・グループ作成を停止しています。現在のご家族はこれまで通り利用できます。','muted'));
 const inviteBox=el('section',null,'panel');
 async function issue(purpose,group_id){try{const result=await api('/api/families/invitations','POST',{purpose,group_id});const url=new URL('/join',location.origin);url.hash=result.token;inviteBox.replaceChildren(el('h2','招待URL'),el('p','1回だけ利用できます。有効期限は7日です。URLはこの画面を閉じる前に控えてください。','muted'));const value=el('input');value.value=url.href;value.readOnly=true;value.setAttribute('aria-label','招待URL');inviteBox.append(value,button('コピー',async()=>{try{await navigator.clipboard.writeText(value.value);}catch{value.focus();value.select();}}));root.prepend(inviteBox);}catch(error){showError(error);}}
 if(state.can_create_family_invite){const b=button('新しいファミリー作成用の招待URL',()=>issue('create_family'));b.disabled=!state.ready;root.append(b);}
 for(const g of state.groups){
  const info=await api('/api/families/groups/'+encodeURIComponent(g.id)),panel=el('section',null,'panel');
  panel.append(el('h2',g.name),el('p',g.kind==='household'?'ファミリー':'共有グループ','muted'));
  const list=el('ul');for(const member of info.members)list.append(el('li',member.display_name+(member.role==='owner'?'（管理者）':member.role==='admin'?'（共同管理者）':'')));panel.append(list);
  if(info.can_manage){const b=button('メンバーを招待する',()=>issue(g.kind==='household'?'join_family':'join_sharing',g.id));b.disabled=!state.ready;panel.append(b);
   if(g.workspace_mode==='restricted'){
    const form=el('form');form.append(el('h3','利用するアプリ'));const labels={calendar:'カレンダー',notification:'通知','family-tree':'家系図','daily-kanji':'まいにち漢字3文字','good-deeds':'いいことポイント','school-prep':'学校準備','dining-prices':'外食料金'};
    for(const app of info.app_choices){const label=el('label'),box=el('input');box.type='checkbox';box.value=app;box.checked=info.app_ids.includes(app);box.disabled=!state.ready;label.append(box,document.createTextNode(labels[app]||app));form.append(label);}
    const save=el('button','利用アプリを保存');save.disabled=!state.ready;form.append(save);form.addEventListener('submit',async e=>{e.preventDefault();save.disabled=true;try{await api('/api/families/groups/'+encodeURIComponent(g.id)+'/apps','PUT',{app_ids:[...form.querySelectorAll('input:checked')].map(n=>n.value)});await familyGroups();}catch(error){showError(error);save.disabled=false;}});panel.append(form);
   }
  }else if(g.kind==='sharing'){
   const leave=button('この共有グループから脱退',async()=>{if(!confirm('この共有グループから脱退しますか？再参加には新しい招待が必要です。'))return;try{await api('/api/families/groups/'+encodeURIComponent(g.id)+'/leave','POST',{});await familyGroups();}catch(error){showError(error);}},'quiet');leave.disabled=!state.ready;panel.append(leave);
  }
  root.append(panel);
 }
 if(state.groups.some(g=>g.kind==='household'&&['owner','admin'].includes(g.role))){const form=el('form'),name=field(form,'name','新しい共有グループ名'),b=el('button','共有グループを作成');b.disabled=!state.ready;form.append(b);form.addEventListener('submit',async e=>{e.preventDefault();b.disabled=true;try{await api('/api/families/groups','POST',{name:name.value,kind:'sharing'});await familyGroups();}catch(error){showError(error);b.disabled=false;}});root.append(form);}
 const invites=await api('/api/families/invitations');
 if(invites.length){const panel=el('section',null,'panel');panel.append(el('h2','発行した招待'));for(const i of invites){const row=el('div'),ended=i.revoked_at||i.use_count>=i.use_limit||i.expires_at<=Date.now()/1000;row.append(el('p',(i.purpose==='create_family'?'新しい家庭':i.purpose==='join_family'?'家庭への参加':'共有グループへの参加')+'：'+(i.revoked_at?'取り消し済み':i.use_count>=i.use_limit?'使用済み':i.expires_at<=Date.now()/1000?'期限切れ':'未使用')));if(!ended){const b=button('招待を取り消す',async()=>{try{await api('/api/families/invitations/'+encodeURIComponent(i.id),'DELETE');await familyGroups();}catch(error){showError(error);}},'quiet');b.disabled=!state.ready;row.append(b);}panel.append(row);}root.append(panel);}
}


// Pure order operation; shared by long-press dragging and the tap controls.
function moveHomeLayout(items,id,section,beforeId=null){
 if(!['favorite','list','hidden'].includes(section)||beforeId===id)return items;
 const source=items.find(x=>x.id===id);if(!source)return items;
 const next=items.filter(x=>x.id!==id),before=next.findIndex(x=>x.id===beforeId&&x.section===section);
 let at=before;
 if(at<0){const indices=next.map((x,i)=>x.section===section?i:-1).filter(i=>i>=0);at=indices.length?indices.at(-1)+1:next.length;}
 next.splice(at,0,{...source,section});return next;
}
async function editHome(target=me.user.id){
 const state=await api('/api/home/layout?user='+encodeURIComponent(target));
 let items=state.apps.map(a=>({...a})),dirty=false,busy=false,operation=crypto.randomUUID(),menu=null,lastDrag=0;
 const cleanups=new Set();
 const cleanDrag=()=>{for(const fn of cleanups)fn();cleanups.clear();};
 const names={favorite:'よく使うアプリ',list:'アプリ一覧',hidden:'非表示'};
 root.classList.add('home-editor');
 const move=(id,section,before)=>{if(busy)return;const next=moveHomeLayout(items,id,section,before);if(next===items)return;items=next;dirty=true;operation=crypto.randomUUID();menu=null;render();};
 function render(){
  cleanDrag();
  root.replaceChildren();
  const header=el('header'),actions=el('div',null,'home-actions');
  header.append(el('h1','HOMEを編集'),actions);
  const cancel=button('キャンセル',()=>{if(!dirty||confirm('保存していない変更を取り消しますか？')){cleanDrag();home().catch(showError);}},'quiet');
  const save=button('編集完了',async()=>{
   if(busy)return;busy=true;render();
   try{await api('/api/home/layout?user='+encodeURIComponent(target),'PUT',{revision:state.revision,operation_id:operation,items:['favorite','list','hidden'].flatMap(section=>items.filter(a=>a.section===section).map(a=>({id:a.id,section})))});await home();}
   catch(error){busy=false;render();showError(error);}
  });save.disabled=busy;cancel.disabled=busy;actions.append(cancel,save);root.append(header);
  if(state.children.length){const label=el('label','編集するHOME'),select=el('select');select.setAttribute('aria-label','編集するHOME');select.add(new Option(me.user.display_name+'（自分）',me.user.id));for(const c of state.children)select.add(new Option(c.display_name,c.id));select.value=target;select.disabled=busy;select.onchange=async()=>{if(dirty&&!confirm('保存していない変更を取り消して、別のHOMEを編集しますか？')){select.value=target;return;}try{cleanDrag();await editHome(select.value);}catch(error){select.value=target;showError(error);}};root.append(label,select);}
  root.append(el('p',state.display_name+' さんのHOMEだけを変更します。','muted'),el('p','☰ を長押しして移動。タップでも移動先を選べます。非表示にしてもデータは残ります。','muted'));
  const announce=el('p',busy?'保存しています…':dirty?'変更はまだ保存されていません':'表示設定を読み込みました','muted');announce.setAttribute('role','status');root.append(announce);
  for(const section of ['favorite','list','hidden']){
   const zone=el('section',null,'home-section layout-zone');zone.dataset.layoutSection=section;zone.append(el('h2',names[section]));
   const grid=el('div',null,'home-app-list');zone.append(grid);
   const list=items.filter(a=>a.section===section);if(!list.length)grid.append(el('p','ここに移動できます','muted layout-empty'));
   for(const item of list){
    const card=el('div',null,'home-card list-card layout-card');card.dataset.appId=item.id;
    const copy=el('span',null,'card-copy');copy.append(el('strong',item.name));
    const handle=button('☰',()=>{if(Date.now()-lastDrag<500||busy)return;menu=menu===item.id?null:item.id;render();root.querySelector('[data-menu-for="'+CSS.escape(item.id)+'"] button')?.focus();},'layout-handle quiet');handle.disabled=busy;handle.setAttribute('aria-label',item.name+'を移動（長押し、またはタップ）');handle.setAttribute('aria-expanded',String(menu===item.id));
    card.append(el('span',item.icon,'card-icon'),copy,handle);grid.append(card);drag(handle,card,item,announce);
    if(menu===item.id){
     const controls=el('div',null,'layout-controls');controls.dataset.menuFor=item.id;controls.setAttribute('role','group');controls.setAttribute('aria-label',item.name+'の移動先');
     for(const dest of ['favorite','list','hidden'])if(dest!==section)controls.append(button(names[dest]+'へ',()=>move(item.id,dest),'quiet'));
     const others=list.filter(a=>a.id!==item.id);
     if(others.length){controls.append(button('この欄の先頭へ',()=>move(item.id,section,others[0].id),'quiet'));const label=el('label','このアプリの前へ'),select=el('select');select.setAttribute('aria-label',item.name+'をどのアプリの前へ移動するか');select.add(new Option('移動先を選ぶ',''));for(const a of others)select.add(new Option(a.name,a.id));select.onchange=()=>{if(select.value)move(item.id,section,select.value);};controls.append(label,select,button('この欄の最後へ',()=>move(item.id,section),'quiet'));}
     controls.append(button('閉じる',()=>{menu=null;render();},'quiet'));grid.append(controls);
    }
   }
   root.append(zone);
  }
 }
 function drag(handle,card,item,announce){
  let pending=null,active=false,x=0,y=0,startX=0,startY=0,ghost=null,drop=null,frame=null;
  function destination(){document.querySelectorAll('.layout-drop').forEach(n=>n.classList.remove('layout-drop'));const node=document.elementFromPoint(x,y),zone=node?.closest('[data-layout-section]');if(!zone){drop=null;return;}const target=node.closest('[data-app-id]');drop={section:zone.dataset.layoutSection,before:target?.dataset.appId||null};(target||zone).classList.add('layout-drop');}
  function tick(){if(!active)return;ghost.style.left=(x+12)+'px';ghost.style.top=(y+12)+'px';if(y<90)window.scrollBy(0,-12);else if(y>innerHeight-90)window.scrollBy(0,12);destination();frame=requestAnimationFrame(tick);}
  function clear(){clearTimeout(pending);pending=null;if(frame)cancelAnimationFrame(frame);frame=null;ghost?.remove();ghost=null;card.classList.remove('layout-dragging');document.querySelectorAll('.layout-drop').forEach(n=>n.classList.remove('layout-drop'));if(active)lastDrag=Date.now();active=false;}
  handle.addEventListener('pointerdown',e=>{if(busy||e.button!==0)return;x=startX=e.clientX;y=startY=e.clientY;pending=setTimeout(()=>{pending=null;active=true;handle.setPointerCapture(e.pointerId);card.classList.add('layout-dragging');ghost=card.cloneNode(true);ghost.className='layout-ghost';ghost.setAttribute('aria-hidden','true');document.body.append(ghost);announce.textContent=item.name+'を移動中です';tick();},350);});
  handle.addEventListener('pointermove',e=>{x=e.clientX;y=e.clientY;if(pending&&Math.hypot(x-startX,y-startY)>10){clearTimeout(pending);pending=null;}if(active)e.preventDefault();});
  handle.addEventListener('pointerup',()=>{const chosen=active?drop:null;clear();if(chosen)move(item.id,chosen.section,chosen.before);});
  cleanups.add(clear);
  handle.addEventListener('pointercancel',clear);
  handle.addEventListener('lostpointercapture',()=>{if(active)clear();});
 }
 render();
}
