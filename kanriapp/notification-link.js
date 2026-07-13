/**
 * notification-link.js  —  既存アプリ → 通知センター の「できた」連携
 *
 * 設計方針（重要）
 *  1. 元のアプリを絶対に止めない。通信が失敗しても例外を投げず、必ず解決する Promise を返す。
 *     チェックの保存・表示は、この結果に関係なく成功扱いのまま。
 *  2. 通知ルールとの対応づけは「固定キー(external_key) × recipient」で行う。
 *     項目名の文字列一致はしない（項目名を変えても壊れない）。
 *  3. 同じ完了を何度送っても二重記録にならない。
 *       - サーバ側: UNIQUE(rule_id, recipient, occurrence_key)、キーは 'app-YYYY-MM-DD' なので上書きされるだけ
 *       - 端末側:   その日すでに送信済みなら通信自体を省く
 *  4. 失敗は右下に小さく出すだけ。alert等でユーザーを止めない。
 *
 * 使い方（既存ファイルに2行足すだけ）
 *   <script src="/kanriapp/notification-link.js" defer></script>
 *   ...
 *   NotifyDone('mouthpiece', 'child1');   // 対象項目が完了したときに呼ぶ
 *
 * 設定（同一オリジンのlocalStorageから読む。子ども向けページに合言葉を直書きしない）
 *   通知WorkerのURL : script タグの data-api 属性 → なければ localStorage 'nc_api_base'
 *   あいことば       : localStorage 'nc_app_password' → なければ既存の 'cloudflare_app_password'
 *                      （きょうせいチェック等が既に保存している値をそのまま使える）
 *   どちらも無ければ「連携なし」として静かに何もしない（＝元アプリはそのまま動く）。
 *
 *   <script src="/kanriapp/notification-link.js" data-api="https://notification-center-api.sslowdayss.workers.dev" defer></script>
 */
(function (global) {
  'use strict';

  var LS_API = 'nc_api_base';
  var LS_PW = 'nc_app_password';
  var LS_PW_FALLBACK = 'cloudflare_app_password';  // 既存アプリが保存している合言葉
  var SENT_PREFIX = 'nc_sent_';   // nc_sent_<key>_<recipient>_<YYYY-MM-DD>
  var TIMEOUT_MS = 6000;

  // 読み込み時点でしか document.currentScript は取れないので、ここで拾っておく
  var SCRIPT_API = (function () {
    try {
      var tag = document.currentScript || document.querySelector('script[src*="notification-link.js"]');
      return (tag && tag.getAttribute('data-api')) || '';
    } catch (e) { return ''; }
  })();

  /** 通知WorkerのURL。script の data-api を優先し、無ければ localStorage */
  function apiBase() {
    return (SCRIPT_API || ls(LS_API)).replace(/\/+$/, '');
  }

  function password() {
    return ls(LS_PW) || ls(LS_PW_FALLBACK);
  }

  /** JSTの今日（YYYY-MM-DD） */
  function todayJst() {
    var d = new Date(Date.now() + 9 * 60 * 60 * 1000);
    return d.toISOString().slice(0, 10);
  }

  function ls(key) {
    try { return localStorage.getItem(key) || ''; } catch (e) { return ''; }
  }

  /** 右下に小さく出すだけ。数秒で消える。 */
  function miniNotice(text, isError) {
    try {
      var el = document.getElementById('nc-link-notice');
      if (!el) {
        el = document.createElement('div');
        el.id = 'nc-link-notice';
        el.style.cssText =
          'position:fixed;right:10px;bottom:10px;z-index:9999;max-width:70vw;' +
          'font:600 11px/1.5 "Hiragino Kaku Gothic ProN","Noto Sans JP",system-ui,sans-serif;' +
          'padding:6px 10px;border-radius:9px;opacity:0;transition:opacity .2s;pointer-events:none;';
        document.body.appendChild(el);
      }
      el.textContent = text;
      el.style.background = isError ? '#fdeaee' : '#e7f6f1';
      el.style.color = isError ? '#b04a60' : '#2f8a72';
      el.style.opacity = '1';
      clearTimeout(el._t);
      el._t = setTimeout(function () { el.style.opacity = '0'; }, isError ? 3500 : 1800);
    } catch (e) { /* 表示できなくても無視 */ }
  }

  /**
   * 完了を通知センターへ送る。
   * @param {string} externalKey  固定キー 例: 'mouthpiece' / 'homework'
   * @param {string} recipient    'mama' | 'child1' | 'child2' | 'all'
   * @param {object} [opts]       { silent:true で成功表示なし }
   * @returns {Promise<{ok:boolean, reason?:string}>}  ★絶対に reject しない
   */
  function notifyDone(externalKey, recipient, opts) {
    opts = opts || {};
    var api = apiBase();
    var pw = password();
    var date = todayJst();
    var sentKey = SENT_PREFIX + externalKey + '_' + recipient + '_' + date;

    // 通知センター未設定 → 何もしない（元アプリは通常どおり）
    if (!api || !pw) return Promise.resolve({ ok: false, reason: 'not_configured' });

    // その日すでに送信済み → 通信しない（サーバ側でも冪等だが、無駄打ちを避ける）
    if (ls(sentKey) === '1') return Promise.resolve({ ok: true, reason: 'already_sent' });

    var ctl = typeof AbortController !== 'undefined' ? new AbortController() : null;
    var timer = ctl ? setTimeout(function () { ctl.abort(); }, TIMEOUT_MS) : null;

    return fetch(api + '/api/complete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-App-Password': pw },
      body: JSON.stringify({
        external_key: externalKey,   // ★rule_idではなく固定キーで対応づけ
        recipient: recipient,
        status: 'done',
        source: 'app',               // occurrence_key は 'app-YYYY-MM-DD' になり冪等
      }),
      signal: ctl ? ctl.signal : undefined,
      keepalive: true,               // 画面遷移中でも送信を落としにくくする
    })
      .then(function (res) {
        return res.json().catch(function () { return {}; }).then(function (data) {
          if (!res.ok) throw new Error(data.error || 'HTTP ' + res.status);
          return data;
        });
      })
      .then(function () {
        try { localStorage.setItem(sentKey, '1'); } catch (e) {}
        if (!opts.silent) miniNotice('✅ きろくしました', false);
        return { ok: true };
      })
      .catch(function (err) {
        // ★ここで握りつぶす。元アプリの完了処理は成功のまま。
        miniNotice('きろくの連携に失敗（チェックは保存ずみ）', true);
        if (global.console && console.warn) console.warn('[notification-link]', err);
        return { ok: false, reason: String(err && err.message || err) };
      })
      .finally(function () { if (timer) clearTimeout(timer); });
  }

  /** 古い送信済みフラグを掃除（今日以外を消す） */
  function cleanup() {
    try {
      var today = todayJst();
      for (var i = localStorage.length - 1; i >= 0; i--) {
        var k = localStorage.key(i);
        if (k && k.indexOf(SENT_PREFIX) === 0 && k.slice(-10) !== today) localStorage.removeItem(k);
      }
    } catch (e) {}
  }

  cleanup();

  global.NotifyDone = notifyDone;
  global.NotificationLink = { done: notifyDone, todayJst: todayJst, cleanup: cleanup };
})(typeof window !== 'undefined' ? window : globalThis);
