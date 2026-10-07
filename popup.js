// Cowork Session Archiver — popup.js
// authors: 7hud41
// license: MIT
//
// Detects the session id in the active claude.ai tab and opens the archive page for it.

const SESSION_RE = /\/(?:cowork|code)\/((?:cse|session)_[A-Za-z0-9]+)/;

function extractSessionId(url) {
  if (!url) return null;
  const m = url.match(SESSION_RE);
  return m ? m[1] : null;
}

document.addEventListener('DOMContentLoaded', async () => {
  initLang();
  const detected = document.getElementById('detected');
  const input = document.getElementById('sessionId');
  const btn = document.getElementById('archiveBtn');

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const id = extractSessionId(tab && tab.url);

  const showDetected = () => {
    detected.removeAttribute('data-i18n');
    detected.textContent = '';
    if (id) {
      detected.appendChild(document.createTextNode(t('Session detected: ')));
      const code = document.createElement('code'); code.textContent = id; detected.appendChild(code);
    } else {
      detected.textContent = t('No Cowork session in the active tab. Open a claude.ai/cowork/cse_… page or paste the id below.');
    }
  };
  showDetected();
  window.onLangChange = showDetected;
  if (id) { input.value = id; btn.disabled = false; }

  input.addEventListener('input', () => {
    btn.disabled = !/^(cse|session)_[A-Za-z0-9]+$/.test(input.value.trim());
  });

  btn.addEventListener('click', () => {
    const sid = input.value.trim();
    chrome.tabs.create({ url: chrome.runtime.getURL('archive.html') + '?session=' + encodeURIComponent(sid) });
  });
});
