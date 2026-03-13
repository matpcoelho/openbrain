/**
 * Open Brain - Service Definitions
 *
 * Each service defines how to scrape conversations, paste into input,
 * extract titles, and detect dark mode for that specific AI platform.
 *
 * To add a new service: add an entry to SERVICES with the required methods.
 */

/**
 * Clipboard-based paste that works with React/ProseMirror inputs.
 * Writes to the real clipboard, focuses the element, then dispatches
 * Ctrl+V / Cmd+V. Falls back through multiple strategies.
 */
async function clipboardPaste(el, text) {
  el.focus();

  // Strategy 1: Write to clipboard and trigger a real paste via execCommand
  try {
    await navigator.clipboard.writeText(text);
    document.execCommand('paste');
    // Check if it worked (give React a tick to update)
    await new Promise(r => setTimeout(r, 100));
    if (el.textContent && el.textContent.includes(text.slice(0, 30))) return;
    if (el.value && el.value.includes(text.slice(0, 30))) return;
  } catch (e) {}

  // Strategy 2: Synthetic ClipboardEvent with DataTransfer
  try {
    const dt = new DataTransfer();
    dt.setData('text/plain', text);
    el.dispatchEvent(new ClipboardEvent('paste', {
      bubbles: true, cancelable: true, clipboardData: dt
    }));
    await new Promise(r => setTimeout(r, 100));
    if (el.textContent && el.textContent.includes(text.slice(0, 30))) return;
    if (el.value && el.value.includes(text.slice(0, 30))) return;
  } catch (e) {}

  // Strategy 3: InputEvent with insertText (works on many modern frameworks)
  try {
    el.dispatchEvent(new InputEvent('beforeinput', {
      bubbles: true, cancelable: true, inputType: 'insertText', data: text
    }));
    el.dispatchEvent(new InputEvent('input', {
      bubbles: true, cancelable: false, inputType: 'insertText', data: text
    }));
    await new Promise(r => setTimeout(r, 100));
    if (el.textContent && el.textContent.includes(text.slice(0, 30))) return;
    if (el.value && el.value.includes(text.slice(0, 30))) return;
  } catch (e) {}

  // Strategy 4: For textarea, use native setter
  if (el.tagName === 'TEXTAREA' || el.tagName === 'INPUT') {
    try {
      const proto = el.tagName === 'TEXTAREA' ? HTMLTextAreaElement : HTMLInputElement;
      const setter = Object.getOwnPropertyDescriptor(proto.prototype, 'value').set;
      setter.call(el, text);
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
      return;
    } catch (e) {}
  }

  // Strategy 5: execCommand insertText (contenteditable)
  try {
    document.execCommand('insertText', false, text);
  } catch (e) {}
}

const SERVICES = {

  gemini: {
    name: 'Gemini',
    hostPatterns: ['gemini.google.com'],
    accentColor: '#1a73e8',
    darkSelectors: ['html[dark]', 'body.dark-theme'],
    assistantLabel: 'Gemini',
    assistantIcon: '✨',

    scrape() {
      const turns = [];

      // Gemini custom elements
      const modelResponses = document.querySelectorAll('model-response');
      const userQueries = document.querySelectorAll('user-query');

      if (modelResponses.length > 0 || userQueries.length > 0) {
        const allTurns = [];

        userQueries.forEach(el => {
          const text = extractText(el);
          if (text) allTurns.push({ role: 'user', text, el });
        });

        modelResponses.forEach(el => {
          const text = extractText(el);
          if (text) allTurns.push({ role: 'assistant', text, el });
        });

        allTurns.sort((a, b) => {
          const pos = a.el.compareDocumentPosition(b.el);
          return pos & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1;
        });

        allTurns.forEach(t => turns.push({ role: t.role, text: t.text }));
      }

      return turns;
    },

    getTitle() {
      const title = document.title || '';
      if (title && title !== 'Gemini' && !title.startsWith('Gemini -')) {
        return title.replace(' - Gemini', '').trim();
      }
      const activeChat = document.querySelector('[class*="selected"] [class*="title"], .active-conversation');
      if (activeChat) return activeChat.textContent.trim();
      return '';
    },

    getInput() {
      return document.querySelector(
        'div[contenteditable="true"].ql-editor, ' +
        'div[contenteditable="true"][aria-label*="prompt"], ' +
        'div[contenteditable="true"][role="textbox"], ' +
        'rich-textarea div[contenteditable="true"], ' +
        '.text-input-field div[contenteditable="true"], ' +
        'div[contenteditable="true"]'
      );
    },

    paste(el, text) {
      el.focus();
      document.execCommand('insertText', false, text);
    }
  },

  chatgpt: {
    name: 'ChatGPT',
    hostPatterns: ['chatgpt.com', 'chat.openai.com'],
    accentColor: '#10a37f',
    darkSelectors: ['html.dark'],
    assistantLabel: 'ChatGPT',
    assistantIcon: '🤖',

    scrape() {
      const turns = [];

      // Strategy 1: data-message-author-role
      const roleEls = document.querySelectorAll('[data-message-author-role]');
      if (roleEls.length > 0) {
        roleEls.forEach(el => {
          const role = el.getAttribute('data-message-author-role');
          const text = extractText(el);
          if (text) turns.push({ role: role === 'user' ? 'user' : 'assistant', text });
        });
        return turns;
      }

      // Strategy 2: article-based turns
      const articles = document.querySelectorAll('article[data-testid^="conversation-turn"]');
      if (articles.length > 0) {
        articles.forEach(el => {
          const isUser = el.querySelector('[data-message-author-role="user"]');
          const text = extractText(el);
          if (text) turns.push({ role: isUser ? 'user' : 'assistant', text });
        });
        return turns;
      }

      // Strategy 3: conversation turn groups
      const groups = document.querySelectorAll('[class*="group/conversation-turn"]');
      if (groups.length > 0) {
        groups.forEach(el => {
          const hasUserImg = el.querySelector('img[alt*="User"]');
          const role = hasUserImg ? 'user' : 'assistant';
          const text = extractText(el);
          if (text && text.length > 2) turns.push({ role, text });
        });
      }

      return turns;
    },

    getTitle() {
      const title = document.title || '';
      if (title && title !== 'ChatGPT' && !title.startsWith('ChatGPT -')) {
        return title.replace('ChatGPT - ', '').trim();
      }
      const activeChat = document.querySelector('nav a.bg-token-sidebar-surface-secondary');
      if (activeChat) {
        const titleEl = activeChat.querySelector('div, span');
        if (titleEl) return titleEl.textContent.trim();
      }
      return '';
    },

    getInput() {
      return document.querySelector(
        '#prompt-textarea, ' +
        'div[contenteditable="true"][id="prompt-textarea"], ' +
        'div[contenteditable="true"][class*="ProseMirror"], ' +
        'form textarea'
      );
    },

    async paste(el, text) {
      // Always target ChatGPT's actual input, not whatever has focus
      const target = document.querySelector('#prompt-textarea') || el;
      // Close the OB panel briefly to release focus, then paste
      const panel = document.querySelector('#ob-panel');
      if (panel) panel.classList.remove('open');
      await new Promise(r => setTimeout(r, 100));
      target.focus();
      await new Promise(r => setTimeout(r, 50));
      document.execCommand('insertText', false, text);
    }
  },

  perplexity: {
    name: 'Perplexity',
    hostPatterns: ['perplexity.ai', 'www.perplexity.ai'],
    accentColor: '#20b8cd',
    darkSelectors: ['html.dark', '[data-color-scheme="dark"]'],
    assistantLabel: 'Perplexity',
    assistantIcon: '🔍',

    scrape() {
      const turns = [];

      // Strategy 1: Current Perplexity DOM (2026+)
      // User queries: [class*="group/query"]
      // AI answers: div with prose + dark:prose-invert + inline classes
      const queries = document.querySelectorAll('[class*="group/query"]');
      const answers = document.querySelectorAll('div[class*="prose"][class*="dark:prose-invert"][class*="inline"]');

      if (queries.length > 0 || answers.length > 0) {
        const allEls = [];
        queries.forEach(el => allEls.push({ role: 'user', el }));
        answers.forEach(el => allEls.push({ role: 'assistant', el }));

        allEls.sort((a, b) => {
          const pos = a.el.compareDocumentPosition(b.el);
          return pos & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1;
        });

        allEls.forEach(item => {
          const text = extractText(item.el);
          if (text) turns.push({ role: item.role, text });
        });
        return turns;
      }

      // Strategy 2: Legacy selectors
      const queryBlocks = document.querySelectorAll('[class*="QueryBlock"], [class*="query-text"]');
      const answerBlocks = document.querySelectorAll('[class*="AnswerBlock"], [class*="answer-text"]');

      if (queryBlocks.length > 0 && answerBlocks.length > 0) {
        const allEls = [];
        queryBlocks.forEach(el => allEls.push({ role: 'user', el }));
        answerBlocks.forEach(el => allEls.push({ role: 'assistant', el }));

        allEls.sort((a, b) => {
          const pos = a.el.compareDocumentPosition(b.el);
          return pos & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1;
        });

        allEls.forEach(item => {
          const text = extractText(item.el);
          if (text) turns.push({ role: item.role, text });
        });
        return turns;
      }

      // Strategy 3: Thread container fallback
      const thread = document.querySelector('[class*="ThreadLayout"], [class*="thread-"]');
      if (thread) {
        let role = 'user';
        for (const child of thread.children) {
          const text = extractText(child);
          if (text && text.length > 10) {
            turns.push({ role, text });
            role = role === 'user' ? 'assistant' : 'user';
          }
        }
      }

      return turns;
    },

    getTitle() {
      const title = document.title || '';
      if (title && !title.startsWith('Perplexity')) {
        return title.replace(' - Perplexity', '').trim();
      }
      return '';
    },

    getInput() {
      return document.querySelector(
        '#ask-input, ' +
        'textarea[placeholder*="Ask"], ' +
        'textarea[placeholder*="follow"], ' +
        'div[contenteditable="true"][class*="editor"], ' +
        'textarea'
      );
    },

    async paste(el, text) {
      const target = document.querySelector('#ask-input') || el;
      target.focus();
      await new Promise(r => setTimeout(r, 50));
      document.execCommand('insertText', false, text);
    }
  },

  grok: {
    name: 'Grok',
    hostPatterns: ['grok.com', 'x.com'],
    accentColor: '#1d9bf0',
    darkSelectors: ['[data-color-mode="dark"]', 'html[style*="color-scheme: dark"]'],
    assistantLabel: 'Grok',
    assistantIcon: '⚡',

    scrape() {
      const turns = [];

      // Grok message containers
      const messages = document.querySelectorAll('[class*="message"], [data-testid*="message"]');
      if (messages.length > 0) {
        messages.forEach(el => {
          const isUser = el.querySelector('[data-testid*="user"]') ||
                         el.classList.toString().includes('user') ||
                         el.getAttribute('data-role') === 'user';
          const text = extractText(el);
          if (text && text.length > 2) {
            turns.push({ role: isUser ? 'user' : 'assistant', text });
          }
        });
        return turns;
      }

      // Fallback: look for turn containers
      const container = document.querySelector('[class*="conversation"], [class*="chat-"]');
      if (container) {
        let role = 'user';
        for (const child of container.children) {
          const text = extractText(child);
          if (text && text.length > 5) {
            turns.push({ role, text });
            role = role === 'user' ? 'assistant' : 'user';
          }
        }
      }

      return turns;
    },

    getTitle() {
      const title = document.title || '';
      if (title && title !== 'Grok') return title.replace(' - Grok', '').trim();
      return '';
    },

    getInput() {
      return document.querySelector(
        'textarea, div[contenteditable="true"][role="textbox"]'
      );
    },

    paste(el, text) {
      el.focus();
      if (el.tagName === 'TEXTAREA') {
        const setter = Object.getOwnPropertyDescriptor(
          window.HTMLTextAreaElement.prototype, 'value'
        ).set;
        setter.call(el, text);
        el.dispatchEvent(new Event('input', { bubbles: true }));
      } else {
        document.execCommand('insertText', false, text);
      }
    }
  },

  claude: {
    name: 'Claude',
    hostPatterns: ['claude.ai'],
    accentColor: '#d97706',
    darkSelectors: ['html.dark', '[data-theme="dark"]'],
    assistantLabel: 'Claude',
    assistantIcon: '🧡',

    scrape() {
      const turns = [];

      // Strategy 1: Current Claude DOM (2026+)
      // User messages: [data-testid="user-message"]
      // AI responses: div.font-claude-response
      const humanMsgs = document.querySelectorAll('[data-testid="user-message"]');
      const aiMsgs = document.querySelectorAll('div.font-claude-response');

      if (humanMsgs.length > 0 || aiMsgs.length > 0) {
        const allEls = [];
        humanMsgs.forEach(el => allEls.push({ role: 'user', el }));
        aiMsgs.forEach(el => allEls.push({ role: 'assistant', el }));

        allEls.sort((a, b) => {
          const pos = a.el.compareDocumentPosition(b.el);
          return pos & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1;
        });

        allEls.forEach(item => {
          const text = extractText(item.el);
          if (text) turns.push({ role: item.role, text });
        });
        return turns;
      }

      // Strategy 2: Legacy selectors (pre-2026)
      const legacyHuman = document.querySelectorAll('[data-testid="human-turn"], [class*="human-turn"]');
      const legacyAi = document.querySelectorAll('[data-testid="ai-turn"], [class*="ai-turn"]');

      if (legacyHuman.length > 0 || legacyAi.length > 0) {
        const allEls = [];
        legacyHuman.forEach(el => allEls.push({ role: 'user', el }));
        legacyAi.forEach(el => allEls.push({ role: 'assistant', el }));

        allEls.sort((a, b) => {
          const pos = a.el.compareDocumentPosition(b.el);
          return pos & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1;
        });

        allEls.forEach(item => {
          const text = extractText(item.el);
          if (text) turns.push({ role: item.role, text });
        });
        return turns;
      }

      // Strategy 3: Generic fallback
      const msgs = document.querySelectorAll('[class*="Message"], [class*="message-row"]');
      msgs.forEach(el => {
        const isHuman = el.classList.toString().includes('human') ||
                        el.querySelector('[class*="human"]');
        const text = extractText(el);
        if (text) turns.push({ role: isHuman ? 'user' : 'assistant', text });
      });

      return turns;
    },

    getTitle() {
      const title = document.title || '';
      if (title && title !== 'Claude') return title.replace(' \\ Claude', '').trim();
      return '';
    },

    getInput() {
      return document.querySelector(
        'div[contenteditable="true"].ProseMirror, ' +
        'div[contenteditable="true"][aria-label*="Message"], ' +
        'fieldset div[contenteditable="true"]'
      );
    },

    paste(el, text) {
      el.focus();
      const clipboardData = new DataTransfer();
      clipboardData.setData('text/plain', text);
      const pasteEvent = new ClipboardEvent('paste', {
        bubbles: true, cancelable: true, clipboardData
      });
      el.dispatchEvent(pasteEvent);
      if (!el.textContent.includes(text.slice(0, 50))) {
        document.execCommand('insertText', false, text);
      }
    }
  },

  deepseek: {
    name: 'DeepSeek',
    hostPatterns: ['chat.deepseek.com'],
    accentColor: '#4f6ef7',
    darkSelectors: ['html.dark', '[data-theme="dark"]'],
    assistantLabel: 'DeepSeek',
    assistantIcon: '🐋',

    scrape() {
      const turns = [];
      const msgs = document.querySelectorAll('[class*="message"], [class*="Message"]');
      msgs.forEach(el => {
        const isUser = el.classList.toString().includes('user') ||
                       el.querySelector('[class*="user"]');
        const text = extractText(el);
        if (text && text.length > 2) {
          turns.push({ role: isUser ? 'user' : 'assistant', text });
        }
      });
      return turns;
    },

    getTitle() {
      const title = document.title || '';
      return title.replace(' - DeepSeek', '').trim();
    },

    getInput() {
      return document.querySelector('textarea, div[contenteditable="true"]');
    },

    paste(el, text) {
      el.focus();
      if (el.tagName === 'TEXTAREA') {
        const setter = Object.getOwnPropertyDescriptor(
          window.HTMLTextAreaElement.prototype, 'value'
        ).set;
        setter.call(el, text);
        el.dispatchEvent(new Event('input', { bubbles: true }));
      } else {
        document.execCommand('insertText', false, text);
      }
    }
  },

  mistral: {
    name: 'Mistral',
    hostPatterns: ['chat.mistral.ai'],
    accentColor: '#ff7000',
    darkSelectors: ['html.dark', '[data-theme="dark"]'],
    assistantLabel: 'Mistral',
    assistantIcon: '🌀',

    scrape() {
      const turns = [];
      const msgs = document.querySelectorAll('[class*="message"], [data-role]');
      msgs.forEach(el => {
        const role = el.getAttribute('data-role');
        const isUser = role === 'user' || el.classList.toString().includes('user');
        const text = extractText(el);
        if (text && text.length > 2) {
          turns.push({ role: isUser ? 'user' : 'assistant', text });
        }
      });
      return turns;
    },

    getTitle() {
      const title = document.title || '';
      return title.replace(' - Le Chat', '').replace(' - Mistral', '').trim();
    },

    getInput() {
      return document.querySelector('textarea, div[contenteditable="true"]');
    },

    paste(el, text) {
      el.focus();
      if (el.tagName === 'TEXTAREA') {
        const setter = Object.getOwnPropertyDescriptor(
          window.HTMLTextAreaElement.prototype, 'value'
        ).set;
        setter.call(el, text);
        el.dispatchEvent(new Event('input', { bubbles: true }));
      } else {
        document.execCommand('insertText', false, text);
      }
    }
  },

  copilot: {
    name: 'Copilot',
    hostPatterns: ['copilot.microsoft.com'],
    accentColor: '#7b61ff',
    darkSelectors: ['html.dark', '[data-theme="dark"]'],
    assistantLabel: 'Copilot',
    assistantIcon: '🪁',

    scrape() {
      const turns = [];
      const msgs = document.querySelectorAll('[class*="message"], [data-content]');
      msgs.forEach(el => {
        const isUser = el.classList.toString().includes('user') ||
                       el.getAttribute('data-author') === 'user';
        const text = extractText(el);
        if (text && text.length > 2) {
          turns.push({ role: isUser ? 'user' : 'assistant', text });
        }
      });
      return turns;
    },

    getTitle() {
      return (document.title || '').replace(' - Microsoft Copilot', '').trim();
    },

    getInput() {
      return document.querySelector('textarea, div[contenteditable="true"]');
    },

    paste(el, text) {
      el.focus();
      if (el.tagName === 'TEXTAREA') {
        const setter = Object.getOwnPropertyDescriptor(
          window.HTMLTextAreaElement.prototype, 'value'
        ).set;
        setter.call(el, text);
        el.dispatchEvent(new Event('input', { bubbles: true }));
      } else {
        document.execCommand('insertText', false, text);
      }
    }
  },

  poe: {
    name: 'Poe',
    hostPatterns: ['poe.com'],
    accentColor: '#6c5ce7',
    darkSelectors: ['html.dark', '[data-theme="dark"]'],
    assistantLabel: 'Bot',
    assistantIcon: '💬',

    scrape() {
      const turns = [];
      const msgs = document.querySelectorAll('[class*="Message_row"]');
      msgs.forEach(el => {
        const isHuman = el.classList.toString().includes('human');
        const text = extractText(el);
        if (text && text.length > 2) {
          turns.push({ role: isHuman ? 'user' : 'assistant', text });
        }
      });
      return turns;
    },

    getTitle() {
      return (document.title || '').replace(' - Poe', '').trim();
    },

    getInput() {
      return document.querySelector('textarea[class*="TextArea"], textarea');
    },

    paste(el, text) {
      el.focus();
      const setter = Object.getOwnPropertyDescriptor(
        window.HTMLTextAreaElement.prototype, 'value'
      ).set;
      setter.call(el, text);
      el.dispatchEvent(new Event('input', { bubbles: true }));
    }
  }
};

// Shared text extraction utility (used by all services)
function extractText(el) {
  const clone = el.cloneNode(true);
  clone.querySelectorAll('button, nav, [class*="btn"], [class*="action"], [class*="toolbar"]').forEach(b => b.remove());
  clone.querySelectorAll('pre code').forEach(cb => {
    cb.textContent = '\n```\n' + cb.textContent + '\n```\n';
  });
  let text = clone.textContent || clone.innerText || '';
  text = text.replace(/\n{3,}/g, '\n\n').trim();
  // Skip noise
  if (text.length < 3) return '';
  const noise = ['ChatGPT', 'You', 'Gemini', 'Claude', 'Grok', 'Copilot', 'Assistant'];
  if (noise.includes(text)) return '';
  return text;
}

// Detect current service from hostname
function detectService() {
  const host = window.location.hostname;
  for (const [key, svc] of Object.entries(SERVICES)) {
    if (svc.hostPatterns.some(p => host.includes(p))) {
      return { key, ...svc };
    }
  }
  // Fallback: unknown service, basic scraping
  return {
    key: 'unknown',
    name: host.split('.')[0],
    accentColor: '#6366f1',
    darkSelectors: ['html.dark'],
    assistantLabel: 'AI',
    assistantIcon: '🤖',
    scrape() { return []; },
    getTitle() { return document.title || ''; },
    getInput() { return document.querySelector('textarea, div[contenteditable="true"]'); },
    paste(el, text) {
      el.focus();
      document.execCommand('insertText', false, text);
    }
  };
}
