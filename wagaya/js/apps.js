(() => {
  'use strict';

  const DATA_URL = './data/apps.json';
  const ALLOWED_PROTOCOLS = new Set(['https:', 'http:']);

  document.addEventListener('DOMContentLoaded', () => {
    setTodayAndGreeting();
    renderApps();
    registerServiceWorker();
  });

  function setTodayAndGreeting() {
    const today = document.querySelector('#today');
    const greeting = document.querySelector('#greeting');
    const now = new Date();

    if (today) {
      today.textContent = new Intl.DateTimeFormat('ja-JP', {
        month: 'long',
        day: 'numeric',
        weekday: 'short'
      }).format(now);
    }

    if (greeting) {
      const hour = now.getHours();
      greeting.textContent = hour < 11 ? 'おはよう' : hour < 18 ? 'こんにちは' : 'こんばんは';
    }
  }

  async function renderApps() {
    const featuredRoot = document.querySelector('#featured-apps');
    const allAppsRoot = document.querySelector('#all-apps');
    if (!featuredRoot && !allAppsRoot) return;

    try {
      const response = await fetch(DATA_URL, { cache: 'no-cache' });
      if (!response.ok) throw new Error(`apps.json: ${response.status}`);

      const data = await response.json();
      const apps = Array.isArray(data.apps) ? data.apps.filter(isValidApp).sort(byOrder) : [];

      if (featuredRoot) {
        const featured = apps.filter((app) => app.featured).slice(0, 4);
        featuredRoot.replaceChildren(...featured.map(createAppCard));
        if (!featured.length) showEmpty(featuredRoot);
      }

      if (allAppsRoot) {
        renderAllApps(allAppsRoot, apps, Array.isArray(data.categories) ? data.categories : []);
      }
    } catch (error) {
      console.error('アプリ一覧を読み込めませんでした。', error);
      [featuredRoot, allAppsRoot].filter(Boolean).forEach(showLoadError);
    }
  }

  function renderAllApps(root, apps, categories) {
    const sections = categories.map((category) => {
      const categoryApps = apps.filter((app) => app.category === category.id);
      if (!categoryApps.length) return null;

      const section = document.createElement('section');
      section.className = 'app-category';

      const heading = document.createElement('h3');
      heading.textContent = category.name;

      const grid = document.createElement('div');
      grid.className = 'app-grid';
      grid.replaceChildren(...categoryApps.map(createAppCard));
      section.append(heading, grid);
      return section;
    }).filter(Boolean);

    const categorizedIds = new Set(categories.map((category) => category.id));
    const uncategorized = apps.filter((app) => !categorizedIds.has(app.category));
    if (uncategorized.length) {
      const section = document.createElement('section');
      section.className = 'app-category';
      const heading = document.createElement('h3');
      heading.textContent = 'そのほか';
      const grid = document.createElement('div');
      grid.className = 'app-grid';
      grid.replaceChildren(...uncategorized.map(createAppCard));
      section.append(heading, grid);
      sections.push(section);
    }

    root.replaceChildren(...sections);
    if (!sections.length) showEmpty(root);
  }

  function createAppCard(app) {
    const card = document.createElement('a');
    card.className = `app-card color-${safeToken(app.color)}`;
    card.href = app.url;
    card.setAttribute('aria-label', `${app.name}を開く`);

    const icon = document.createElement('span');
    icon.className = 'app-icon';
    icon.textContent = app.icon || '•';
    icon.setAttribute('aria-hidden', 'true');

    const copy = document.createElement('span');
    copy.className = 'app-copy';
    const name = document.createElement('strong');
    name.textContent = app.name;
    const description = document.createElement('span');
    description.textContent = app.description || '';
    copy.append(name, description);

    const arrow = document.createElement('span');
    arrow.className = 'app-arrow';
    arrow.textContent = '›';
    arrow.setAttribute('aria-hidden', 'true');

    card.append(icon, copy, arrow);
    return card;
  }

  function isValidApp(app) {
    if (!app || typeof app.name !== 'string' || typeof app.url !== 'string') return false;
    try {
      return ALLOWED_PROTOCOLS.has(new URL(app.url, location.href).protocol);
    } catch {
      return false;
    }
  }

  function byOrder(a, b) {
    return Number(a.order || 999) - Number(b.order || 999);
  }

  function safeToken(value) {
    return typeof value === 'string' && /^[a-z0-9-]+$/i.test(value) ? value : 'mint';
  }

  function showEmpty(root) {
    const message = document.createElement('p');
    message.className = 'status-message';
    message.textContent = '表示するアプリはまだありません。';
    root.replaceChildren(message);
  }

  function showLoadError(root) {
    const message = document.createElement('p');
    message.className = 'status-message error-message';
    message.textContent = 'アプリ一覧を読み込めませんでした。通信環境を確認して、もう一度開いてください。';
    root.replaceChildren(message);
  }

  function registerServiceWorker() {
    if (!('serviceWorker' in navigator) || location.protocol !== 'https:') return;
    navigator.serviceWorker.register('./sw.js', { scope: './' }).catch((error) => {
      console.warn('Service Workerを登録できませんでした。', error);
    });
  }
})();
