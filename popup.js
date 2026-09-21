const SESSION_RE = /\/(?:cowork|code)\/((?:cse|session)_[A-Za-z0-9]+)/;

function extractSessionId(url) {
  if (!url) return null;
  const m = url.match(SESSION_RE);
  return m ? m[1] : null;
}

document.addEventListener('DOMContentLoaded', async () => {
  const detected = document.getElementById('detected');
  const input = document.getElementById('sessionId');
  const btn = document.getElementById('archiveBtn');

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const id = extractSessionId(tab && tab.url);

  if (id) {
    input.value = id;
    detected.innerHTML = 'Session détectée : <code>' + id + '</code>';
    btn.disabled = false;
  } else {
    detected.textContent = "Aucune session Cowork dans l'onglet actif. Ouvre une page claude.ai/cowork/cse_… ou colle l'identifiant ci-dessous.";
  }

  input.addEventListener('input', () => {
    btn.disabled = !/^(cse|session)_[A-Za-z0-9]+$/.test(input.value.trim());
  });

  btn.addEventListener('click', () => {
    const sid = input.value.trim();
    chrome.tabs.create({ url: chrome.runtime.getURL('archive.html') + '?session=' + encodeURIComponent(sid) });
  });
});
