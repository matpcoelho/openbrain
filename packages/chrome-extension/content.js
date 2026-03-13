(() => {
  'use strict';

  // Detect which AI service we're on
  const SERVICE = detectService();

  const API_DEFAULT = 'https://txojvogstovmmwnlnqhy.supabase.co/functions/v1/brain-api';
  const CATEGORIES = ['insight', 'project', 'interaction', 'contact', 'company', 'decision', 'task', 'preference'];

  let apiUrl = API_DEFAULT;
  let apiKey = '';
  let currentTab = 'load';

  function loadConfig() {
    return new Promise(resolve => {
      chrome.storage.sync.get({ apiUrl: API_DEFAULT, apiKey: '' }, items => {
        apiUrl = items.apiUrl;
        apiKey = items.apiKey;
        resolve();
      });
    });
  }

  async function api(action, opts = {}) {
    if (!apiKey) throw new Error('API key not configured. Right-click extension > Options.');

    const url = new URL(apiUrl);
    url.searchParams.set('action', action);
    if (opts.params) {
      for (const [k, v] of Object.entries(opts.params)) url.searchParams.set(k, v);
    }

    const fetchOpts = {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      }
    };

    if (opts.body) {
      fetchOpts.method = 'POST';
      fetchOpts.body = JSON.stringify(opts.body);
    }

    const res = await fetch(url.toString(), fetchOpts);
    const data = await res.json();
    if (!res.ok || data.ok === false) throw new Error(data.error || `HTTP ${res.status}`);
    return data;
  }

  function init() {
    // Inject dynamic accent color as CSS variable
    document.documentElement.style.setProperty('--ob-accent', SERVICE.accentColor);

    // FAB
    const fab = document.createElement('button');
    fab.id = 'ob-fab';
    fab.textContent = '🧠';
    fab.title = `Open Brain (${SERVICE.name})`;
    document.body.appendChild(fab);

    // Panel
    const panel = document.createElement('div');
    panel.id = 'ob-panel';
    panel.innerHTML = `
      <div class="ob-header">
        <span class="ob-header-icon">🧠</span> Open Brain
        <span class="ob-service-badge">${SERVICE.name}</span>
      </div>
      <div class="ob-tabs">
        <button class="ob-tab-btn active" data-tab="load">Load</button>
        <button class="ob-tab-btn" data-tab="store">Store</button>
        <button class="ob-tab-btn" data-tab="save-chat">Save</button>
        <button class="ob-tab-btn" data-tab="stats">Stats</button>
      </div>

      <!-- Load -->
      <div class="ob-tab-content active" data-tab="load">
        <div id="ob-load-config-warn" class="ob-config-warn" style="display:none">
          API key not set. Right-click the extension icon and select Options.
        </div>
        <div class="ob-load-info">Find a past conversation and load it into ${esc(SERVICE.name)} as context.</div>
        <div class="ob-input-row">
          <input class="ob-input" id="ob-load-q" placeholder="Search by topic..." />
          <button class="ob-btn ob-btn-primary" id="ob-load-btn">Find</button>
        </div>
        <div class="ob-slider-row">
          <label class="ob-label" for="ob-load-threshold">Relevance: <span id="ob-load-threshold-val">55%</span></label>
          <input type="range" class="ob-slider" id="ob-load-threshold" min="20" max="90" value="55" step="5" />
        </div>
        <div id="ob-load-selection-bar" style="display:none">
          <div class="ob-selection-bar">
            <button class="ob-btn ob-btn-secondary ob-btn-sm" id="ob-load-select-all">Select All</button>
            <span id="ob-load-selected-count" class="ob-selected-count">0 selected</span>
            <button class="ob-btn ob-btn-primary ob-btn-sm" id="ob-load-paste-selected" disabled>Paste Selected</button>
          </div>
        </div>
        <div id="ob-load-results"></div>
      </div>

      <!-- Store -->
      <div class="ob-tab-content" data-tab="store">
        <div id="ob-store-config-warn" class="ob-config-warn" style="display:none">
          API key not set. Right-click the extension icon and select Options.
        </div>
        <label class="ob-label">Content</label>
        <textarea class="ob-textarea" id="ob-store-content" placeholder="What do you want to remember?"></textarea>
        <div style="display:flex;gap:8px;align-items:center">
          <button class="ob-btn ob-btn-secondary ob-btn-sm" id="ob-store-suggest-btn">✨ Suggest</button>
          <span id="ob-store-suggest-status" style="font-size:12px;color:#888"></span>
        </div>
        <label class="ob-label">Category</label>
        <select class="ob-select" id="ob-store-cat">
          ${CATEGORIES.map(c => `<option value="${c}">${c}</option>`).join('')}
        </select>
        <label class="ob-label">Tags (comma-separated)</label>
        <input class="ob-input" id="ob-store-tags" placeholder="tag1, tag2" />
        <label class="ob-label">Summary (optional)</label>
        <input class="ob-input" id="ob-store-summary" placeholder="Brief summary" />
        <button class="ob-btn ob-btn-primary" id="ob-store-btn" style="align-self:flex-end">Store</button>
        <div id="ob-store-status"></div>
      </div>

      <!-- Save Chat -->
      <div class="ob-tab-content" data-tab="save-chat">
        <div id="ob-savechat-config-warn" class="ob-config-warn" style="display:none">
          API key not set. Right-click the extension icon and select Options.
        </div>
        <div class="ob-savechat-info">Capture the current ${esc(SERVICE.name)} conversation and save it to your brain.</div>
        <button class="ob-btn ob-btn-primary" id="ob-savechat-capture" style="align-self:center">📸 Capture Conversation</button>
        <div id="ob-savechat-preview" style="display:none">
          <div class="ob-savechat-meta" id="ob-savechat-meta"></div>
          <div class="ob-savechat-turns" id="ob-savechat-turns"></div>
          <label class="ob-label">Title</label>
          <input class="ob-input" id="ob-savechat-title" placeholder="suggesting title..." disabled />
          <label class="ob-label">Tags (comma-separated)</label>
          <input class="ob-input" id="ob-savechat-tags" placeholder="${SERVICE.key}, topic..." />
          <div class="ob-savechat-actions">
            <button class="ob-btn ob-btn-secondary" id="ob-savechat-cancel">Cancel</button>
            <button class="ob-btn ob-btn-primary" id="ob-savechat-save" disabled>💾 Save to Brain</button>
          </div>
        </div>
        <div id="ob-savechat-status"></div>
      </div>

      <!-- Stats -->
      <div class="ob-tab-content" data-tab="stats">
        <div id="ob-stats-config-warn" class="ob-config-warn" style="display:none">
          API key not set. Right-click the extension icon and select Options.
        </div>
        <div id="ob-stats-content"><div class="ob-empty">Click a tab to load stats</div></div>
      </div>
    `;
    document.body.appendChild(panel);

    // Events
    fab.addEventListener('click', () => {
      panel.classList.toggle('open');
      if (panel.classList.contains('open')) {
        checkConfig();
        if (currentTab === 'stats') loadStats();
      }
    });

    panel.querySelectorAll('.ob-tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        currentTab = btn.dataset.tab;
        panel.querySelectorAll('.ob-tab-btn').forEach(b => b.classList.remove('active'));
        panel.querySelectorAll('.ob-tab-content').forEach(c => c.classList.remove('active'));
        btn.classList.add('active');
        panel.querySelector(`.ob-tab-content[data-tab="${currentTab}"]`).classList.add('active');
        if (currentTab === 'stats') loadStats();
      });
    });

    // Search tab removed
    initLoad();
    panel.querySelector('#ob-store-btn').addEventListener('click', doStore);
    panel.querySelector('#ob-store-suggest-btn').addEventListener('click', doStoreSuggest);
    initSaveChat();

    document.addEventListener('click', e => {
      if (!panel.contains(e.target) && e.target !== fab) {
        panel.classList.remove('open');
      }
    });

    chrome.storage.onChanged.addListener(() => {
      loadConfig().then(checkConfig);
    });
  }

  function checkConfig() {
    document.querySelectorAll('[id$="-config-warn"]').forEach(w => {
      w.style.display = apiKey ? 'none' : 'block';
    });
  }

  // ===== SEARCH =====

  async function doSearch() {
    const q = document.querySelector('#ob-search-q').value.trim();
    if (!q) return;

    const results = document.querySelector('#ob-search-results');
    results.innerHTML = '<div style="text-align:center;padding:16px"><span class="ob-spinner"></span></div>';

    try {
      const data = await api('search', { body: { query: q, limit: 8 } });
      if (!data.results || data.results.length === 0) {
        results.innerHTML = '<div class="ob-empty">No memories found</div>';
        return;
      }
      results.innerHTML = data.results.map(r => renderCard(r)).join('');
      results.querySelectorAll('.ob-copy-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          navigator.clipboard.writeText(btn.dataset.text).then(() => {
            btn.textContent = '✓';
            setTimeout(() => btn.textContent = 'Copy', 1200);
          });
        });
      });
    } catch (err) {
      results.innerHTML = `<div class="ob-status ob-status-err">${esc(err.message)}</div>`;
    }
  }

  function renderCard(r) {
    const date = r.created_at ? new Date(r.created_at).toLocaleDateString() : '';
    const sim = r.similarity != null ? `<span class="ob-sim">${Math.round(r.similarity * 100)}%</span>` : '';
    const tags = (r.tags || []).map(t => `<span class="ob-tag">${esc(t)}</span>`).join(' ');
    const content = r.summary || r.content || '';
    const fullContent = r.content || '';
    return `
      <div class="ob-card">
        <div class="ob-card-content">${esc(content.slice(0, 200))}${content.length > 200 ? '...' : ''}</div>
        ${tags ? `<div style="margin-bottom:6px">${tags}</div>` : ''}
        <div class="ob-card-meta">
          <span>${esc(r.source || '')} · ${esc(r.category || '')} · ${date}</span>
          <div class="ob-card-actions">
            ${sim}
            <button class="ob-btn ob-btn-secondary ob-copy-btn" data-text="${esc(fullContent, true)}">Copy</button>
          </div>
        </div>
      </div>`;
  }

  // ===== SUGGEST =====

  async function fetchSuggestions(content) {
    const data = await api('suggest', { body: { content } });
    return { category: data.category, tags: data.tags || [], summary: data.summary || '' };
  }

  async function doStoreSuggest() {
    const content = document.querySelector('#ob-store-content').value.trim();
    if (!content) return;

    const btn = document.querySelector('#ob-store-suggest-btn');
    const status = document.querySelector('#ob-store-suggest-status');
    btn.disabled = true;
    status.textContent = 'thinking...';

    try {
      const s = await fetchSuggestions(content);
      document.querySelector('#ob-store-cat').value = s.category;
      document.querySelector('#ob-store-tags').value = s.tags.join(', ');
      document.querySelector('#ob-store-summary').value = s.summary;
      status.textContent = 'suggested ✓';
      setTimeout(() => status.textContent = '', 3000);
    } catch (err) {
      status.textContent = 'failed';
      setTimeout(() => status.textContent = '', 3000);
    } finally {
      btn.disabled = false;
    }
  }

  // ===== STORE =====

  async function doStore() {
    const content = document.querySelector('#ob-store-content').value.trim();
    if (!content) return;

    const cat = document.querySelector('#ob-store-cat').value;
    const tagsRaw = document.querySelector('#ob-store-tags').value.trim();
    const summary = document.querySelector('#ob-store-summary').value.trim();
    const tags = tagsRaw ? tagsRaw.split(',').map(t => t.trim()).filter(Boolean) : [];

    const status = document.querySelector('#ob-store-status');
    const btn = document.querySelector('#ob-store-btn');
    btn.disabled = true;
    status.innerHTML = '<div style="text-align:center"><span class="ob-spinner"></span></div>';

    try {
      const body = { content, source: SERVICE.key, category: cat, tags };
      if (summary) body.summary = summary;
      await api('store', { body });
      status.innerHTML = '<div class="ob-status ob-status-ok">Memory stored ✓</div>';
      document.querySelector('#ob-store-content').value = '';
      document.querySelector('#ob-store-tags').value = '';
      document.querySelector('#ob-store-summary').value = '';
      setTimeout(() => status.innerHTML = '', 3000);
    } catch (err) {
      status.innerHTML = `<div class="ob-status ob-status-err">${esc(err.message)}</div>`;
    } finally {
      btn.disabled = false;
    }
  }

  // ===== STATS =====

  async function loadStats() {
    const el = document.querySelector('#ob-stats-content');
    el.innerHTML = '<div style="text-align:center;padding:16px"><span class="ob-spinner"></span></div>';

    try {
      const data = await api('stats', { params: {} });
      let html = `<div class="ob-stat-row"><span class="ob-stat-label">Total memories</span><span class="ob-stat-value">${data.total || 0}</span></div>`;

      if (data.by_source && Object.keys(data.by_source).length) {
        html += '<div class="ob-stat-section">By Source</div>';
        for (const [k, v] of Object.entries(data.by_source)) {
          html += `<div class="ob-stat-row"><span class="ob-stat-label">${esc(k)}</span><span class="ob-stat-value">${v}</span></div>`;
        }
      }

      if (data.by_category && Object.keys(data.by_category).length) {
        html += '<div class="ob-stat-section">By Category</div>';
        for (const [k, v] of Object.entries(data.by_category)) {
          html += `<div class="ob-stat-row"><span class="ob-stat-label">${esc(k)}</span><span class="ob-stat-value">${v}</span></div>`;
        }
      }

      el.innerHTML = html;
    } catch (err) {
      el.innerHTML = `<div class="ob-status ob-status-err">${esc(err.message)}</div>`;
    }
  }

  // ===== LOAD CONTEXT =====

  function initLoad() {
    const loadBtn = document.querySelector('#ob-load-btn');
    const loadInput = document.querySelector('#ob-load-q');
    const slider = document.querySelector('#ob-load-threshold');
    const sliderVal = document.querySelector('#ob-load-threshold-val');

    loadBtn.addEventListener('click', doLoad);
    loadInput.addEventListener('keydown', e => { if (e.key === 'Enter') doLoad(); });
    slider.addEventListener('input', () => {
      sliderVal.textContent = slider.value + '%';
    });
  }

  async function doLoad() {
    const q = document.querySelector('#ob-load-q').value.trim();
    if (!q) return;

    const resultsEl = document.querySelector('#ob-load-results');
    resultsEl.innerHTML = '<div style="text-align:center;padding:16px"><span class="ob-spinner"></span></div>';

    try {
      const threshold = parseInt(document.querySelector('#ob-load-threshold').value) / 100;
      const data = await api('search', { body: { query: q, threshold, limit: 100 } });
      if (!data.results || data.results.length === 0) {
        resultsEl.innerHTML = '<div class="ob-empty">No conversations found</div>';
        return;
      }

      const groups = groupByConversation(data.results);
      if (groups.length === 0) {
        resultsEl.innerHTML = '<div class="ob-empty">No conversations found</div>';
        return;
      }

      resultsEl.innerHTML = groups.map((g, i) => renderConversationGroup(g, i)).join('');

      // Show selection bar and wire up select/paste-selected
      const selBar = document.querySelector('#ob-load-selection-bar');
      selBar.style.display = '';
      const selectAllBtn = document.querySelector('#ob-load-select-all');
      const pasteSelectedBtn = document.querySelector('#ob-load-paste-selected');
      const selectedCountEl = document.querySelector('#ob-load-selected-count');

      function updateSelectionCount() {
        const checked = resultsEl.querySelectorAll('.ob-load-select:checked');
        const count = checked.length;
        selectedCountEl.textContent = count + ' selected';
        pasteSelectedBtn.disabled = count === 0;
        selectAllBtn.textContent = count === resultsEl.querySelectorAll('.ob-load-select').length ? 'Deselect All' : 'Select All';
      }

      resultsEl.querySelectorAll('.ob-load-select').forEach(cb => {
        cb.addEventListener('change', updateSelectionCount);
      });

      // Click to expand/collapse full content
      resultsEl.querySelectorAll('.ob-expandable').forEach(el => {
        el.addEventListener('click', () => {
          const idx = el.dataset.groupIdx;
          const preview = resultsEl.querySelector(`.ob-load-group-preview[data-group-idx="${idx}"]`);
          const full = resultsEl.querySelector(`.ob-load-group-full[data-group-idx="${idx}"]`);
          if (!full) return;
          const isExpanded = full.style.display !== 'none';
          full.style.display = isExpanded ? 'none' : 'block';
          if (preview) preview.style.display = isExpanded ? '' : 'none';
        });
      });

      selectAllBtn.addEventListener('click', () => {
        const allCbs = resultsEl.querySelectorAll('.ob-load-select');
        const allChecked = [...allCbs].every(cb => cb.checked);
        allCbs.forEach(cb => cb.checked = !allChecked);
        updateSelectionCount();
      });

      pasteSelectedBtn.addEventListener('click', async () => {
        const checked = resultsEl.querySelectorAll('.ob-load-select:checked');
        if (checked.length === 0) return;
        pasteSelectedBtn.disabled = true;
        pasteSelectedBtn.textContent = 'Loading...';
        try {
          const parts = [];
          for (const cb of checked) {
            const idx = parseInt(cb.dataset.groupIdx);
            const group = groups[idx];
            const fullText = await reconstructConversation(group);
            const title = group.title || 'Untitled';
            parts.push(`=== ${title} ===\n\n${fullText}`);
          }
          const textToPaste = `Here are previous conversations for context:\n\n---\n\n` + parts.join('\n\n---\n\n');
          await navigator.clipboard.writeText(textToPaste);
          const inputEl = SERVICE.getInput();
          let pasted = false;
          if (inputEl) {
            const panel = document.querySelector('#ob-panel');
            if (panel) panel.classList.remove('open');
            await new Promise(r => setTimeout(r, 150));
            inputEl.focus();
            await new Promise(r => setTimeout(r, 50));
            const beforeLen = (inputEl.textContent || inputEl.value || '').length;
            await SERVICE.paste(inputEl, textToPaste);
            await new Promise(r => setTimeout(r, 100));
            const afterLen = (inputEl.textContent || inputEl.value || '').length;
            pasted = afterLen > beforeLen;
          }
          if (pasted) {
            pasteSelectedBtn.textContent = 'Pasted ✓';
          } else {
            const toast = document.createElement('div');
            toast.style.cssText = 'position:fixed;bottom:80px;right:24px;background:#1a1a2e;color:#fff;padding:12px 20px;border-radius:10px;font-size:14px;z-index:2147483647;box-shadow:0 4px 20px rgba(0,0,0,0.3);transition:opacity 0.3s';
            toast.textContent = '📋 Copied to clipboard! Press Cmd+V to paste';
            document.body.appendChild(toast);
            setTimeout(() => { toast.style.opacity = '0'; setTimeout(() => toast.remove(), 300); }, 4000);
            pasteSelectedBtn.textContent = '📋 Copied!';
          }
          setTimeout(() => { pasteSelectedBtn.textContent = 'Paste Selected'; pasteSelectedBtn.disabled = false; }, 3000);
        } catch (err) {
          pasteSelectedBtn.textContent = 'Failed';
          setTimeout(() => { pasteSelectedBtn.textContent = 'Paste Selected'; pasteSelectedBtn.disabled = false; }, 3000);
        }
      });

      resultsEl.querySelectorAll('.ob-load-copy-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
          const idx = parseInt(btn.dataset.groupIdx);
          const group = groups[idx];
          btn.disabled = true;
          btn.textContent = 'Loading...';
          try {
            const fullText = await reconstructConversation(group);
            await navigator.clipboard.writeText(`Here is a previous conversation for context:\n\n---\n\n` + fullText);
            btn.textContent = 'Copied ✓';
            setTimeout(() => { btn.textContent = 'Copy Full Chat'; btn.disabled = false; }, 2000);
          } catch (err) {
            btn.textContent = 'Failed';
            setTimeout(() => { btn.textContent = 'Copy Full Chat'; btn.disabled = false; }, 2000);
          }
        });
      });

      resultsEl.querySelectorAll('.ob-load-paste-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
          const idx = parseInt(btn.dataset.groupIdx);
          const group = groups[idx];
          btn.disabled = true;
          btn.textContent = 'Loading...';
          try {
            const fullText = await reconstructConversation(group);
            const textToPaste = `Here is a previous conversation for context:\n\n---\n\n` + fullText;
            // Always copy to clipboard first (while panel is open and page has focus)
            await navigator.clipboard.writeText(textToPaste);
            // Now try auto-paste
            const inputEl = SERVICE.getInput();
            let pasted = false;
            if (inputEl) {
              const panel = document.querySelector('#ob-panel');
              if (panel) panel.classList.remove('open');
              await new Promise(r => setTimeout(r, 150));
              inputEl.focus();
              await new Promise(r => setTimeout(r, 50));
              const beforeLen = (inputEl.textContent || inputEl.value || '').length;
              await SERVICE.paste(inputEl, textToPaste);
              await new Promise(r => setTimeout(r, 100));
              const afterLen = (inputEl.textContent || inputEl.value || '').length;
              pasted = afterLen > beforeLen;
            }
            if (pasted) {
              btn.textContent = 'Pasted ✓';
            } else {
              // Panel already closed, show a floating toast instead
              const toast = document.createElement('div');
              toast.style.cssText = 'position:fixed;bottom:80px;right:24px;background:#1a1a2e;color:#fff;padding:12px 20px;border-radius:10px;font-size:14px;z-index:2147483647;box-shadow:0 4px 20px rgba(0,0,0,0.3);transition:opacity 0.3s';
              toast.textContent = '📋 Copied to clipboard! Press Cmd+V to paste';
              document.body.appendChild(toast);
              setTimeout(() => { toast.style.opacity = '0'; setTimeout(() => toast.remove(), 300); }, 4000);
              btn.textContent = '📋 Copied!';
            }
            setTimeout(() => { btn.textContent = 'Paste into Chat'; btn.disabled = false; }, 3000);
          } catch (err) {
            try { await navigator.clipboard.writeText(
              `Here is a previous conversation for context:\n\n---\n\n` +
              group.chunks.map(c => c.content).join('\n\n---\n\n')
            ); } catch(e) {}
            const toast = document.createElement('div');
            toast.style.cssText = 'position:fixed;bottom:80px;right:24px;background:#1a1a2e;color:#fff;padding:12px 20px;border-radius:10px;font-size:14px;z-index:2147483647;box-shadow:0 4px 20px rgba(0,0,0,0.3);transition:opacity 0.3s';
            toast.textContent = '📋 Copied to clipboard! Press Cmd+V to paste';
            document.body.appendChild(toast);
            setTimeout(() => { toast.style.opacity = '0'; setTimeout(() => toast.remove(), 300); }, 4000);
            btn.textContent = '📋 Copied!';
            setTimeout(() => { btn.textContent = 'Paste into Chat'; btn.disabled = false; }, 3000);
          }
        });
      });

    } catch (err) {
      resultsEl.innerHTML = `<div class="ob-status ob-status-err">${esc(err.message)}</div>`;
    }
  }

  function groupByConversation(results) {
    const groups = {};
    // Match any service's chat pattern
    const chatPattern = /^(\w+) chat:\s*(.+?)(?:\s*\(part \d+\/\d+\))?\s*\[(\d{4}-\d{2}-\d{2})\]$/;
    const convPattern = /^(\w+) conversation/;

    for (const r of results) {
      let groupKey;
      const summary = r.summary || '';

      const chatMatch = summary.match(chatPattern);
      if (chatMatch) {
        groupKey = `chat:${chatMatch[2]}:${chatMatch[3]}`;
      } else if (convPattern.test(summary)) {
        const dateMatch = summary.match(/\[(\d{4}-\d{2}-\d{2})\]/);
        groupKey = `conv:${dateMatch ? dateMatch[1] : 'unknown'}`;
      } else {
        groupKey = `single:${r.id}`;
      }

      if (!groups[groupKey]) {
        groups[groupKey] = {
          key: groupKey,
          title: chatMatch ? chatMatch[2] : (summary || r.content.slice(0, 60)),
          date: chatMatch ? chatMatch[3] : (r.created_at ? r.created_at.slice(0, 10) : ''),
          source: chatMatch ? chatMatch[1] : (r.source || ''),
          isConversation: !!chatMatch || convPattern.test(summary),
          chunks: [],
          topSimilarity: 0,
          tags: new Set()
        };
      }

      groups[groupKey].chunks.push(r);
      if (r.similarity > groups[groupKey].topSimilarity) {
        groups[groupKey].topSimilarity = r.similarity;
      }
      (r.tags || []).forEach(t => groups[groupKey].tags.add(t));
    }

    return Object.values(groups).sort((a, b) => {
      if (a.isConversation && !b.isConversation) return -1;
      if (!a.isConversation && b.isConversation) return 1;
      return b.topSimilarity - a.topSimilarity;
    });
  }

  function renderConversationGroup(group, idx) {
    const sim = Math.round(group.topSimilarity * 100);
    const tags = [...group.tags].filter(t => !t.endsWith('-chat')).map(t => `<span class="ob-tag">${esc(t)}</span>`).join(' ');
    const chunkCount = group.chunks.length;
    const totalChars = group.chunks.reduce((sum, c) => sum + (c.content || '').length, 0);
    const preview = (group.chunks[0].content || '').slice(0, 150);
    const sourceLabel = group.source ? `<span class="ob-tag ob-tag-source">${esc(group.source)}</span>` : '';

    const fullContent = group.chunks.map(c => c.content || '').join('\n\n---\n\n');

    if (group.isConversation) {
      return `
        <div class="ob-load-group">
          <div class="ob-load-group-header">
            <label class="ob-select-checkbox"><input type="checkbox" class="ob-load-select" data-group-idx="${idx}" /></label>
            <span class="ob-load-group-title ob-expandable" data-group-idx="${idx}">💬 ${esc(group.title)}</span>
            <span class="ob-sim">${sim}%</span>
          </div>
          <div class="ob-load-group-meta">
            ${sourceLabel} ${group.date} · ${chunkCount} chunk${chunkCount > 1 ? 's' : ''} · ${Math.round(totalChars / 1000)}k chars
          </div>
          ${tags ? `<div style="margin:4px 0">${tags}</div>` : ''}
          <div class="ob-load-group-preview ob-expandable" data-group-idx="${idx}">${esc(preview)}...</div>
          <div class="ob-load-group-full" data-group-idx="${idx}" style="display:none"><pre class="ob-full-content">${esc(fullContent)}</pre></div>
          <div class="ob-load-group-actions">
            <button class="ob-btn ob-btn-secondary ob-load-copy-btn" data-group-idx="${idx}">Copy Full Chat</button>
            <button class="ob-btn ob-btn-primary ob-load-paste-btn" data-group-idx="${idx}">Paste into Chat</button>
          </div>
        </div>`;
    } else {
      const content = group.chunks[0].content || '';
      return `
        <div class="ob-load-group ob-load-single">
          <div class="ob-load-group-header">
            <label class="ob-select-checkbox"><input type="checkbox" class="ob-load-select" data-group-idx="${idx}" /></label>
            <span class="ob-load-group-title ob-expandable" data-group-idx="${idx}">📝 ${esc(group.title.slice(0, 60))}</span>
            <span class="ob-sim">${sim}%</span>
          </div>
          ${tags ? `<div style="margin:4px 0">${tags}</div>` : ''}
          <div class="ob-load-group-preview ob-expandable" data-group-idx="${idx}">${esc(content.slice(0, 200))}${content.length > 200 ? '...' : ''}</div>
          <div class="ob-load-group-full" data-group-idx="${idx}" style="display:none"><pre class="ob-full-content">${esc(fullContent)}</pre></div>
          <div class="ob-load-group-actions">
            <button class="ob-btn ob-btn-secondary ob-load-copy-btn" data-group-idx="${idx}">Copy</button>
            <button class="ob-btn ob-btn-primary ob-load-paste-btn" data-group-idx="${idx}">Paste into Chat</button>
          </div>
        </div>`;
    }
  }

  async function reconstructConversation(group) {
    const sorted = [...group.chunks].sort((a, b) => {
      const partA = (a.summary || '').match(/part (\d+)/);
      const partB = (b.summary || '').match(/part (\d+)/);
      return (partA ? parseInt(partA[1]) : 0) - (partB ? parseInt(partB[1]) : 0);
    });
    return sorted.map(c => c.content || '').join('\n\n');
  }

  // ===== SAVE CHAT =====

  let capturedTurns = [];

  function initSaveChat() {
    const captureBtn = document.querySelector('#ob-savechat-capture');
    const cancelBtn = document.querySelector('#ob-savechat-cancel');
    const saveBtn = document.querySelector('#ob-savechat-save');
    const preview = document.querySelector('#ob-savechat-preview');
    const meta = document.querySelector('#ob-savechat-meta');
    const turnsEl = document.querySelector('#ob-savechat-turns');
    const status = document.querySelector('#ob-savechat-status');

    captureBtn.addEventListener('click', async () => {
      capturedTurns = SERVICE.scrape();

      if (capturedTurns.length === 0) {
        status.innerHTML = `<div class="ob-status ob-status-err">No conversation found. Make sure you're on an active ${esc(SERVICE.name)} chat.</div>`;
        setTimeout(() => status.innerHTML = '', 4000);
        return;
      }

      const title = SERVICE.getTitle();
      const userTurns = capturedTurns.filter(t => t.role === 'user').length;
      const aiTurns = capturedTurns.filter(t => t.role === 'assistant').length;
      const totalChars = capturedTurns.reduce((sum, t) => sum + t.text.length, 0);
      const chunks = chunkConversation(capturedTurns);

      meta.innerHTML = `
        <div class="ob-savechat-stat">${title ? `<strong>${esc(title)}</strong><br>` : ''}
          ${userTurns + aiTurns} turns (${userTurns} you, ${aiTurns} ${esc(SERVICE.assistantLabel)}) · ${Math.round(totalChars / 1000)}k chars · ${chunks.length} chunk${chunks.length > 1 ? 's' : ''}
        </div>
      `;

      const previewTurns = capturedTurns.slice(0, 4);
      turnsEl.innerHTML = previewTurns.map(t => `
        <div class="ob-preview-turn ob-preview-${t.role}">
          <span class="ob-preview-role">${t.role === 'user' ? '👤 You' : `${SERVICE.assistantIcon} ${SERVICE.assistantLabel}`}</span>
          <span class="ob-preview-text">${esc(t.text.slice(0, 120))}${t.text.length > 120 ? '...' : ''}</span>
        </div>
      `).join('') + (capturedTurns.length > 4 ? `<div class="ob-preview-more">+ ${capturedTurns.length - 4} more turns</div>` : '');

      captureBtn.style.display = 'none';
      preview.style.display = 'flex';
      status.innerHTML = '';

      // Auto-suggest tags and title for the captured conversation
      const tagsInput = document.querySelector('#ob-savechat-tags');
      const titleInput = document.querySelector('#ob-savechat-title');
      tagsInput.value = '';
      tagsInput.placeholder = 'suggesting tags...';
      tagsInput.disabled = true;
      titleInput.value = '';
      titleInput.placeholder = 'suggesting title...';
      titleInput.disabled = true;
      saveBtn.disabled = true;
      try {
        const fullText = capturedTurns.map(t => `${t.role}: ${t.text}`).join('\n').slice(0, 2000);
        const s = await fetchSuggestions(fullText);
        // Pre-fill tags (add service key tag)
        const allTags = [...new Set([...s.tags, `${SERVICE.key}-chat`])];
        tagsInput.value = allTags.join(', ');
        // Pre-fill title from suggested summary (strip type prefix)
        if (s.summary) {
          titleInput.value = s.summary.replace(/^(Interaction|Insight|Project|Contact|Company|Decision|Task|Preference):\s*/i, '');
        }
      } catch (err) {
        tagsInput.value = `${SERVICE.key}-chat`;
        titleInput.value = SERVICE.getTitle() || '';
      } finally {
        tagsInput.placeholder = `${SERVICE.key}, topic...`;
        tagsInput.disabled = false;
        titleInput.placeholder = 'Conversation title';
        titleInput.disabled = false;
        saveBtn.disabled = false;
      }
    });

    cancelBtn.addEventListener('click', () => {
      capturedTurns = [];
      preview.style.display = 'none';
      captureBtn.style.display = '';
      status.innerHTML = '';
    });

    saveBtn.addEventListener('click', async () => {
      if (capturedTurns.length === 0) return;

      const tagsRaw = document.querySelector('#ob-savechat-tags').value.trim();
      const tags = tagsRaw ? tagsRaw.split(',').map(t => t.trim()).filter(Boolean) : [];
      tags.push(`${SERVICE.key}-chat`);

      const titleInput = document.querySelector('#ob-savechat-title');
      const smartTitle = (titleInput.value || '').trim() || SERVICE.getTitle();
      const chunks = chunkConversation(capturedTurns);
      const totalChunks = chunks.length;
      const date = new Date().toISOString().slice(0, 10);

      saveBtn.disabled = true;
      cancelBtn.disabled = true;
      status.innerHTML = '<div style="text-align:center"><span class="ob-spinner"></span> Saving...</div>';

      let saved = 0;
      let failed = 0;

      for (let i = 0; i < chunks.length; i++) {
        const content = formatChunk(chunks[i]);
        const chunkLabel = totalChunks > 1 ? ` (part ${i + 1}/${totalChunks})` : '';
        const summary = smartTitle
          ? `${SERVICE.name} chat: ${smartTitle}${chunkLabel} [${date}]`
          : `${SERVICE.name} conversation${chunkLabel} [${date}]`;

        try {
          await api('store', {
            body: {
              content,
              source: `${SERVICE.key}-chat`,
              category: 'interaction',
              tags,
              summary
            }
          });
          saved++;
          status.innerHTML = `<div style="text-align:center"><span class="ob-spinner"></span> Saved ${saved}/${totalChunks} chunks...</div>`;
        } catch (err) {
          failed++;
          console.error('Open Brain: failed to save chunk', i, err);
        }
      }

      if (failed === 0) {
        status.innerHTML = `<div class="ob-status ob-status-ok">Saved ${saved} chunk${saved > 1 ? 's' : ''} to your brain ✓</div>`;
      } else {
        status.innerHTML = `<div class="ob-status ob-status-err">Saved ${saved}, failed ${failed}</div>`;
      }

      capturedTurns = [];
      preview.style.display = 'none';
      captureBtn.style.display = '';
      document.querySelector('#ob-savechat-title').value = '';
      document.querySelector('#ob-savechat-tags').value = '';
      saveBtn.disabled = false;
      cancelBtn.disabled = false;
      setTimeout(() => status.innerHTML = '', 5000);
    });
  }

  function chunkConversation(turns, maxChars = 3000) {
    const chunks = [];
    let current = [];
    let currentLen = 0;

    for (const turn of turns) {
      const turnText = `${turn.role === 'user' ? 'Human' : SERVICE.assistantLabel}: ${turn.text}`;
      if (currentLen + turnText.length > maxChars && current.length > 0) {
        chunks.push(current);
        current = [];
        currentLen = 0;
      }
      current.push(turn);
      currentLen += turnText.length;
    }

    if (current.length > 0) chunks.push(current);
    return chunks;
  }

  function formatChunk(turns) {
    return turns.map(t => `${t.role === 'user' ? 'Human' : SERVICE.assistantLabel}: ${t.text}`).join('\n\n');
  }

  // ===== UTIL =====

  function esc(s, attr = false) {
    if (!s) return '';
    s = s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    if (attr) s = s.replace(/"/g, '&quot;');
    return s;
  }

  // Boot
  loadConfig().then(init);
})();
