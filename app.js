'use strict';

// ─── 設定 ────────────────────────────────────────────────────────────────────
const HUBS = {
  ai: {
    name: 'AI Hub',
    icon: '🤖',
    color: '#6366f1',
    colorBg: 'rgba(99,102,241,0.15)',
    colorBorder: 'rgba(99,102,241,0.5)',
    desc: 'AI・機械学習の最新ニュースを日英まとめて自動収集',
    schedule: '毎日 7:00',
    badgeClass: 'badge-indigo',
  },
  design: {
    name: 'Design Hub',
    icon: '🎨',
    color: '#8b5cf6',
    colorBg: 'rgba(139,92,246,0.15)',
    colorBorder: 'rgba(139,92,246,0.5)',
    desc: 'UI/UX・グラフィック・プロダクトデザインのトレンドを日英まとめて自動収集',
    schedule: '毎日 7:05',
    badgeClass: 'badge-purple',
  },
  screen: {
    name: 'Screen Hub',
    icon: '📺',
    color: '#06b6d4',
    colorBg: 'rgba(6,182,212,0.15)',
    colorBorder: 'rgba(6,182,212,0.5)',
    desc: 'デジタルサイネージ・プロジェクションマッピング・オンスクリーンコンテンツの最新情報を収集',
    schedule: '毎日 7:10',
    badgeClass: 'badge-cyan',
  },
  gameui: {
    name: 'Game UI Hub',
    icon: '🎮',
    color: '#f59e0b',
    colorBg: 'rgba(245,158,11,0.15)',
    colorBorder: 'rgba(245,158,11,0.5)',
    desc: 'ゲームUI・UX・アートディレクション・インタラクションデザインの最新トレンド',
    schedule: '毎日 7:15',
    badgeClass: 'badge-amber',
  },
};

// ─── データ取得 ───────────────────────────────────────────────────────────────
const _cache = {};

async function loadHub(id) {
  if (_cache[id]) return _cache[id];
  const res = await fetch(`./data/${id}_news.json`);
  if (!res.ok) throw new Error(`Failed to fetch ${id}_news.json: ${res.status}`);
  const data = await res.json();
  _cache[id] = data;
  return data;
}

// ─── メモ (localStorage) ──────────────────────────────────────────────────────
function getMemos() {
  try {
    return JSON.parse(localStorage.getItem('hub-memos') || '{}');
  } catch { return {}; }
}

function saveMemo(url, memo) {
  const memos = getMemos();
  if (memo && memo.trim()) {
    memos[url] = { memo: memo.trim(), saved_at: new Date().toISOString() };
  } else {
    delete memos[url];
  }
  localStorage.setItem('hub-memos', JSON.stringify(memos));
}

function deleteMemo(url) {
  const memos = getMemos();
  delete memos[url];
  localStorage.setItem('hub-memos', JSON.stringify(memos));
}

// ─── ルーター ─────────────────────────────────────────────────────────────────
function getRoute() {
  const hash = location.hash.replace(/^#\/?/, '');
  if (!hash || hash === '/') return 'home';
  if (hash === 'memo') return 'memo';
  if (HUBS[hash]) return hash;
  return 'home';
}

function router() {
  const route = getRoute();
  if (route === 'home') {
    renderHome();
  } else if (route === 'memo') {
    renderMemoHub();
  } else {
    renderHub(route);
  }
  window.scrollTo(0, 0);
}

// ─── ユーティリティ ──────────────────────────────────────────────────────────
function formatDate(iso) {
  if (!iso) return '';
  try {
    const d = new Date(iso);
    return d.toLocaleDateString('ja-JP', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  } catch { return ''; }
}

function stripHtml(html) {
  if (!html) return '';
  return html.replace(/<[^>]+>/g, '').trim();
}

function escHtml(str) {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function setCSS(color, colorBg, colorBorder) {
  const root = document.documentElement;
  root.style.setProperty('--hub-color', color);
  root.style.setProperty('--hub-color-bg', colorBg);
  root.style.setProperty('--hub-color-border', colorBorder);
}

function resetCSS() {
  setCSS('#6366f1', 'rgba(99,102,241,0.15)', 'rgba(99,102,241,0.5)');
}

// ─── レンダリング共通 ─────────────────────────────────────────────────────────
function renderNav(activeRoute) {
  const memos = getMemos();
  const memoCount = Object.keys(memos).length;

  const links = [
    { route: 'home', label: '🏠 Home', hash: '#/' },
    ...Object.entries(HUBS).map(([id, h]) => ({
      route: id,
      label: `${h.icon} ${h.name}`,
      hash: `#/${id}`,
    })),
  ];

  const linksHtml = links.map(l => `
    <a class="nav-link ${activeRoute === l.route ? 'active' : ''}" href="${l.hash}">${escHtml(l.label)}</a>
  `).join('');

  return `
    <nav>
      <span class="nav-logo">My<span>Hub</span></span>
      ${linksHtml}
      <a class="nav-link nav-memo ${activeRoute === 'memo' ? 'active' : ''}" href="#/memo">
        📌 メモ${memoCount > 0 ? ` <span class="badge badge-amber">${memoCount}</span>` : ''}
      </a>
    </nav>
  `;
}

// ─── ホーム ──────────────────────────────────────────────────────────────────
function renderHome() {
  resetCSS();
  const app = document.getElementById('app');

  const cards = Object.entries(HUBS).map(([id, h]) => `
    <a class="hub-card" href="#/${id}" style="--hub-card-border: ${h.colorBorder}">
      <div class="hub-card-top">
        <div class="hub-icon" style="background:${h.colorBg}; color:${h.color};">${h.icon}</div>
        <div class="hub-meta">
          <h2>${escHtml(h.name)}</h2>
          <p>${escHtml(h.schedule)}</p>
        </div>
      </div>
      <p class="hub-desc">${escHtml(h.desc)}</p>
      <span class="hub-arrow">→</span>
    </a>
  `).join('');

  app.innerHTML = renderNav('home') + `
    <main>
      <div class="hero fade-in">
        <h1>My Hub</h1>
        <p>AI・デザイン・スクリーン・ゲームUIの最新情報を自動収集</p>
      </div>
      <div class="section-title">HUB 一覧</div>
      <div class="hub-grid fade-in">
        ${cards}
        <div class="add-hub-card">
          <span>＋</span>
          <span>Hub を追加</span>
        </div>
      </div>
    </main>
  `;
}

// ─── Hub ページ状態 ──────────────────────────────────────────────────────────
let _hub = { id: null, lang: 'all', source: 'all', articles: [] };

function _filterArticles() {
  return _hub.articles.filter(a => {
    const langOk = _hub.lang === 'all' || a.lang === _hub.lang;
    const srcOk  = _hub.source === 'all' || a.source === _hub.source;
    return langOk && srcOk;
  });
}

function _renderCards(articles) {
  const memos = getMemos();
  if (!articles.length) {
    return '<div class="error-state"><span class="error-icon">📭</span><p>記事がありません</p></div>';
  }

  return articles.map((a, i) => {
    const cardId = `card-${_hub.id}-${i}`;
    const hasMemo = !!memos[a.url];
    const memoText = hasMemo ? escHtml(memos[a.url].memo) : '';
    const title = escHtml(a.title_ja || a.title || '');
    const titleOrig = (a.lang === 'en' && a.title_ja && a.title) ? `<div class="title-original">${escHtml(a.title)}</div>` : '';
    const body = escHtml(a.body_ja || a.summary_ja || stripHtml(a.summary) || '');

    const thumb = a.image_url
      ? `<div class="card-thumbnail"><img src="${escHtml(a.image_url)}" alt="" class="loading" onload="this.classList.remove('loading')" onerror="this.parentNode.innerHTML='<div class=\\'card-thumbnail-placeholder\\'>${a.icon || '📰'}</div>'"></div>`
      : `<div class="card-thumbnail-placeholder">${a.icon || '📰'}</div>`;

    const langClass = a.lang === 'ja' ? 'lang-ja' : 'lang-en';
    const langLabel = a.lang === 'ja' ? 'JA' : 'EN';

    return `
      <div class="news-card fade-in" id="${cardId}">
        <div class="card-body">
          ${thumb}
          <div class="card-content">
            <div class="news-card-meta">
              <span class="source-badge">${escHtml(a.source || '')}</span>
              <span class="lang-tag ${langClass}">${langLabel}</span>
              <span class="news-date">${formatDate(a.published)}</span>
            </div>
            <h3><a href="${escHtml(a.url)}" target="_blank" rel="noopener">${title}</a></h3>
            ${titleOrig}
            ${body ? `<p>${body}</p>` : ''}
          </div>
        </div>
        <button class="memo-toggle ${hasMemo ? 'has-memo' : ''}" onclick="toggleMemo('${cardId}', event)" data-url="${escHtml(a.url)}">
          ${hasMemo ? '📌 メモあり' : '＋ メモを追加'}
        </button>
        <div class="memo-area ${hasMemo ? 'open' : ''}" id="memo-${cardId}">
          <textarea class="memo-textarea" placeholder="メモを入力..." onblur="saveMemo_blur(this)" data-url="${escHtml(a.url)}" data-cardid="${cardId}">${memoText}</textarea>
          <div class="memo-footer">
            <span class="memo-status" id="status-${cardId}"></span>
            <button class="memo-save-btn" onclick="saveMemo_btn('${cardId}')">保存</button>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

function _renderSidebar(articles) {
  const hub = HUBS[_hub.id];
  const memos = getMemos();
  const memoCount = Object.keys(memos).length;

  // ソース別集計
  const sourceCounts = {};
  _hub.articles.forEach(a => {
    sourceCounts[a.source] = (sourceCounts[a.source] || 0) + 1;
  });

  const jaCount = _hub.articles.filter(a => a.lang === 'ja').length;
  const enCount = _hub.articles.filter(a => a.lang === 'en').length;

  const sourceItems = Object.entries(sourceCounts).map(([src, cnt]) => `
    <div class="source-item ${_hub.source === src ? 'active' : ''}" onclick="setSource('${escHtml(src)}')">
      <span class="source-item-left">${escHtml(src)}</span>
      <span class="source-count">${cnt}</span>
    </div>
  `).join('');

  return `
    <aside class="sidebar">
      <div class="sidebar-card">
        <div class="sidebar-title">統計</div>
        <div class="stat-row"><span>総記事数</span><span>${_hub.articles.length}</span></div>
        <div class="stat-row"><span>日本語</span><span>${jaCount}</span></div>
        <div class="stat-row"><span>英語</span><span>${enCount}</span></div>
        <div class="stat-row"><span>表示中</span><span>${articles.length}</span></div>
        <div class="stat-row"><span>メモ数</span><span>${memoCount}</span></div>
      </div>
      <div class="sidebar-card">
        <div class="sidebar-title">ソースで絞り込み</div>
        <div class="source-item ${_hub.source === 'all' ? 'active' : ''}" onclick="setSource('all')">
          <span class="source-item-left">すべて</span>
          <span class="source-count">${_hub.articles.length}</span>
        </div>
        ${sourceItems}
      </div>
    </aside>
  `;
}

function setLang(lang) {
  _hub.lang = lang;
  _reRenderHubContent();
}

function setSource(src) {
  _hub.source = src;
  _reRenderHubContent();
}

function _reRenderHubContent() {
  const hub = HUBS[_hub.id];
  const filtered = _filterArticles();

  const filterEl = document.getElementById('hub-filter');
  if (filterEl) {
    filterEl.innerHTML = _buildFilterHtml();
  }

  const listEl = document.getElementById('hub-news-list');
  if (listEl) listEl.innerHTML = _renderCards(filtered);

  const sideEl = document.getElementById('hub-sidebar');
  if (sideEl) sideEl.innerHTML = _renderSidebar(filtered);
}

function _buildFilterHtml() {
  return `
    <div class="filter-section" id="hub-filter">
      <div class="filter-row">
        <span class="filter-label">言語</span>
        <button class="filter-btn ${_hub.lang === 'all' ? 'active-lang' : ''}" onclick="setLang('all')">すべて</button>
        <button class="filter-btn ${_hub.lang === 'ja' ? 'active-lang' : ''}" onclick="setLang('ja')">🇯🇵 日本語</button>
        <button class="filter-btn ${_hub.lang === 'en' ? 'active-lang' : ''}" onclick="setLang('en')">🇺🇸 English</button>
      </div>
    </div>
  `;
}

// ─── Hub ページレンダリング ──────────────────────────────────────────────────
async function renderHub(id) {
  const hub = HUBS[id];
  setCSS(hub.color, hub.colorBg, hub.colorBorder);
  _hub = { id, lang: 'all', source: 'all', articles: [] };

  const app = document.getElementById('app');
  app.innerHTML = renderNav(id) + `
    <main>
      <div class="breadcrumb">
        <a href="#/">Home</a>
        <span>›</span>
        <span>${escHtml(hub.name)}</span>
      </div>
      <div class="hub-header">
        <div class="hub-header-icon">${hub.icon}</div>
        <div class="hub-header-info">
          <h1>${escHtml(hub.name)}</h1>
          <p>${escHtml(hub.desc)}</p>
          <div class="hub-header-meta">
            <span class="badge ${hub.badgeClass}">${escHtml(hub.schedule)}</span>
          </div>
        </div>
      </div>
      <div id="hub-filter"></div>
      <div class="news-layout">
        <div id="hub-news-list">
          <div class="loading-state">
            <div class="spinner"></div>
            <span>記事を読み込み中...</span>
          </div>
        </div>
        <div id="hub-sidebar"></div>
      </div>
    </main>
  `;

  // フィルター初期表示
  document.getElementById('hub-filter').innerHTML = _buildFilterHtml();

  try {
    const data = await loadHub(id);
    _hub.articles = data.articles || [];

    const filtered = _filterArticles();
    document.getElementById('hub-news-list').innerHTML = _renderCards(filtered);
    document.getElementById('hub-sidebar').innerHTML = _renderSidebar(filtered);

    // ヘッダーに件数バッジを追加
    const meta = document.querySelector('.hub-header-meta');
    if (meta) {
      meta.innerHTML += `<span class="count-badge">📰 ${_hub.articles.length} 件</span>`;
      if (data.last_updated) {
        const dt = formatDate(data.last_updated);
        meta.innerHTML += `<span style="font-size:11px;color:var(--text3)">最終更新: ${dt}</span>`;
      }
    }
  } catch (err) {
    document.getElementById('hub-news-list').innerHTML = `
      <div class="error-state">
        <span class="error-icon">⚠️</span>
        <p>データの読み込みに失敗しました</p>
        <p style="font-size:12px;color:var(--text3)">${escHtml(err.message)}</p>
      </div>
    `;
  }
}

// ─── メモ UI ─────────────────────────────────────────────────────────────────
function toggleMemo(cardId, e) {
  e.preventDefault();
  const area = document.getElementById(`memo-${cardId}`);
  const btn = e.currentTarget;
  const url = btn.dataset.url;
  const memos = getMemos();

  if (area.classList.contains('open')) {
    area.classList.remove('open');
  } else {
    area.classList.add('open');
    setTimeout(() => {
      const ta = area.querySelector('.memo-textarea');
      if (ta) ta.focus();
    }, 50);
  }
}

function _doSave(textarea, cardId) {
  const url = textarea.dataset.url;
  const memo = textarea.value;
  saveMemo(url, memo);

  const btn = document.querySelector(`#${cardId} .memo-toggle`);
  const status = document.getElementById(`status-${cardId}`);
  const hasMemo = !!(memo && memo.trim());

  if (btn) {
    btn.textContent = hasMemo ? '📌 メモあり' : '＋ メモを追加';
    btn.className = `memo-toggle${hasMemo ? ' has-memo' : ''}`;
  }
  if (status) {
    status.textContent = '保存しました';
    status.className = 'memo-status saved';
    setTimeout(() => { status.textContent = ''; status.className = 'memo-status'; }, 2000);
  }

  // ナビのメモカウントを更新
  _updateNavMemoCount();
}

function saveMemo_btn(cardId) {
  const area = document.getElementById(`memo-${cardId}`);
  const ta = area && area.querySelector('.memo-textarea');
  if (ta) _doSave(ta, cardId);
}

function saveMemo_blur(textarea) {
  const cardId = textarea.dataset.cardid;
  if (cardId) _doSave(textarea, cardId);
}

function _updateNavMemoCount() {
  const memos = getMemos();
  const cnt = Object.keys(memos).length;
  const memoLink = document.querySelector('.nav-memo');
  if (memoLink) {
    memoLink.innerHTML = `📌 メモ${cnt > 0 ? ` <span class="badge badge-amber">${cnt}</span>` : ''}`;
  }
}

// ─── メモ Hub ─────────────────────────────────────────────────────────────────
async function renderMemoHub() {
  setCSS('#f59e0b', 'rgba(245,158,11,0.15)', 'rgba(245,158,11,0.5)');
  const app = document.getElementById('app');

  app.innerHTML = renderNav('memo') + `
    <main>
      <div class="breadcrumb">
        <a href="#/">Home</a>
        <span>›</span>
        <span>メモ Hub</span>
      </div>
      <div class="hub-header">
        <div class="hub-header-icon">📌</div>
        <div class="hub-header-info">
          <h1>メモ Hub</h1>
          <p>メモを追加した記事を一覧表示</p>
          <div class="hub-header-meta">
            <span class="badge badge-amber">ローカル保存</span>
          </div>
        </div>
      </div>
      <div id="memo-hub-content">
        <div class="loading-state">
          <div class="spinner"></div>
          <span>読み込み中...</span>
        </div>
      </div>
    </main>
  `;

  const memos = getMemos();
  const memoUrls = Object.keys(memos);

  if (!memoUrls.length) {
    document.getElementById('memo-hub-content').innerHTML = `
      <div class="empty-state">
        <span class="empty-icon">📌</span>
        <h2>メモがありません</h2>
        <p>各 Hub の記事にメモを追加すると、ここに表示されます。</p>
      </div>
    `;
    return;
  }

  // 全 Hub の JSON を並列取得してURLテーブルを構築
  let urlToArticle = {};
  try {
    const results = await Promise.all(
      Object.keys(HUBS).map(id => loadHub(id).then(d => ({ id, data: d })).catch(() => null))
    );
    results.forEach(r => {
      if (!r) return;
      const hubInfo = HUBS[r.id];
      (r.data.articles || []).forEach(a => {
        urlToArticle[a.url] = {
          ...a,
          hub_id:    r.id,
          hub_name:  hubInfo.name,
          hub_icon:  hubInfo.icon,
          hub_color: hubInfo.color,
        };
      });
    });
  } catch (_) {}

  // メモとジョイン
  const enriched = memoUrls.map(url => {
    const article = urlToArticle[url] || {
      title: url, url, icon: '📰',
      source: '—', lang: '?', published: null,
      hub_id: null, hub_name: '不明', hub_icon: '📰',
      hub_color: '#6366f1',
    };
    return { ...article, memo: memos[url].memo, memo_saved_at: memos[url].saved_at };
  }).sort((a, b) => (b.memo_saved_at || '') > (a.memo_saved_at || '') ? 1 : -1);

  document.getElementById('memo-hub-content').innerHTML = `
    <div class="memo-layout">
      <div id="memo-cards">${_renderMemoCards(enriched)}</div>
      <aside class="sidebar">
        <div class="sidebar-card">
          <div class="sidebar-title">統計</div>
          <div class="stat-row"><span>メモ数</span><span>${enriched.length}</span></div>
        </div>
      </aside>
    </div>
  `;
}

function _renderMemoCards(articles) {
  return articles.map((a, i) => {
    const cardId = `memo-card-${i}`;
    const title = escHtml(a.title_ja || a.title || '');
    const hubColor = a.hub_color || '#6366f1';

    const thumb = a.image_url
      ? `<div class="memo-thumb"><img src="${escHtml(a.image_url)}" alt="" onerror="this.parentNode.innerHTML='<div class=\\'memo-thumb-placeholder\\'>${a.hub_icon || '📰'}</div>'"></div>`
      : `<div class="memo-thumb-placeholder">${a.hub_icon || '📰'}</div>`;

    return `
      <div class="memo-card" id="${cardId}" data-url="${escHtml(a.url)}">
        <div class="memo-article">
          ${thumb}
          <div class="memo-article-content">
            <div class="memo-article-meta">
              <span class="hub-badge" style="color:${hubColor};border-color:${hubColor}40;">${a.hub_icon || '📰'} ${escHtml(a.hub_name || '')}</span>
              <span class="source-badge">${escHtml(a.source || '')}</span>
              <span class="news-date">${formatDate(a.published)}</span>
            </div>
            <h3><a href="${escHtml(a.url)}" target="_blank" rel="noopener">${title}</a></h3>
          </div>
        </div>
        <div class="memo-body">
          <div class="memo-label">📌 メモ</div>
          <div class="memo-text-display" id="text-${cardId}">${escHtml(a.memo)}</div>
          <textarea class="memo-edit-area" id="edit-${cardId}">${escHtml(a.memo)}</textarea>
          <div class="memo-saved-at">保存: ${formatDate(a.memo_saved_at)}</div>
          <div class="memo-actions">
            <button class="btn-edit" onclick="startEdit('${cardId}')">編集</button>
            <button class="btn-save visible" id="save-${cardId}" onclick="saveEdit('${cardId}')" style="display:none">保存</button>
            <button class="btn-delete" onclick="deleteMemoCb('${cardId}', '${escHtml(a.url)}')">削除</button>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

function startEdit(cardId) {
  const textEl = document.getElementById(`text-${cardId}`);
  const editEl = document.getElementById(`edit-${cardId}`);
  const saveBtn = document.getElementById(`save-${cardId}`);
  if (!textEl || !editEl) return;
  textEl.style.display = 'none';
  editEl.classList.add('visible');
  editEl.style.display = 'block';
  if (saveBtn) saveBtn.style.display = 'inline-flex';
  editEl.focus();
}

function saveEdit(cardId) {
  const card = document.getElementById(cardId);
  const editEl = document.getElementById(`edit-${cardId}`);
  const textEl = document.getElementById(`text-${cardId}`);
  const saveBtn = document.getElementById(`save-${cardId}`);
  if (!card || !editEl) return;

  const url = card.dataset.url;
  const memo = editEl.value;
  saveMemo(url, memo);

  if (textEl) {
    textEl.textContent = memo;
    textEl.style.display = '';
  }
  editEl.classList.remove('visible');
  editEl.style.display = 'none';
  if (saveBtn) saveBtn.style.display = 'none';

  _updateNavMemoCount();
}

function deleteMemoCb(cardId, url) {
  if (!confirm('このメモを削除しますか？')) return;
  deleteMemo(url);
  const card = document.getElementById(cardId);
  if (card) {
    card.style.transition = 'opacity 0.2s';
    card.style.opacity = '0';
    setTimeout(() => card.remove(), 200);
  }
  _updateNavMemoCount();

  // 全削除後は空状態を表示
  const memos = getMemos();
  if (!Object.keys(memos).length) {
    const container = document.getElementById('memo-cards');
    if (container) {
      container.innerHTML = `
        <div class="empty-state">
          <span class="empty-icon">📌</span>
          <h2>メモがありません</h2>
          <p>各 Hub の記事にメモを追加すると、ここに表示されます。</p>
        </div>
      `;
    }
  }
}

// ─── 初期化 ──────────────────────────────────────────────────────────────────
window.addEventListener('hashchange', router);
window.addEventListener('load', router);
