// End-to-end tests for the archive page: the claude.ai API is stubbed with a synthetic event log.
// authors: 7hud41 · license: MIT
// Run: npm test   (needs `npm install` once, for Playwright)
const test = require('node:test'); const assert = require('node:assert/strict');
const fs = require('fs'); const path = require('path'); const os = require('os'); const http = require('http');
const { chromium } = require('playwright');
const { cloudEvents } = require('./fixtures');

const ROOT = path.resolve(__dirname, '..');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.woff2': 'font/woff2', '.png': 'image/png', '.json': 'application/json' };
let server, port, browser, ctx;

test.before(async () => {
  server = http.createServer((req, res) => {
    const file = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]));
    if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); return res.end(); }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' }); fs.createReadStream(file).pipe(res);
  });
  await new Promise(r => server.listen(0, '127.0.0.1', r)); port = server.address().port;
  browser = await chromium.launch();
  ctx = await browser.newContext({ viewport: { width: 1100, height: 900 }, acceptDownloads: true });
});
test.after(async () => { await browser.close(); server.close(); });

// The events endpoint is paginated newest-first; the stub answers one page then an empty one.
async function archivePage(sessionId = 'cse_test') {
  const page = await ctx.newPage();
  page.errors = []; page.on('pageerror', e => page.errors.push(e.message));
  const base = `http://127.0.0.1:${port}/`;
  const events = cloudEvents().slice().reverse();
  await page.addInitScript(({ base, events }) => {
    window.chrome = { runtime: { getURL: p => base + p }, tabs: {} };
    const real = window.fetch.bind(window);
    window.fetch = async (url, opts) => {
      const u = String(url);
      if (u.includes('/events')) {
        if (!(opts && opts.headers && opts.headers['anthropic-version'])) return { ok: false, status: 400, text: async () => '{"error":{"message":"anthropic-version: header is required"}}' };
        const first = !/[?&](cursor|before|after)/.test(u);
        return { ok: true, status: 200, text: async () => JSON.stringify(first ? { data: events, next_cursor: null } : { data: [], next_cursor: null }) };
      }
      if (u.includes('claude.ai')) return { ok: true, status: 200, text: async () => JSON.stringify({ title: 'Synthetic session' }) };
      return real(url, opts);
    };
  }, { base, events });
  await page.goto(`${base}archive.html?session=${sessionId}`);
  await page.evaluate(() => localStorage.clear()); // each test starts in English
  await page.reload();
  return page;
}
const fetched = page => page.waitForFunction(() => !document.getElementById('zipBtn').disabled, null, { timeout: 15000 });
const texts = (page, sel) => page.$$eval(sel, els => els.map(e => e.textContent));

test('fetch, preview, day filter and ZIP contents', async () => {
  const page = await archivePage();
  assert.equal(await page.$eval('#sid', e => e.textContent), 'cse_test');
  await page.click('#fetchBtn'); await fetched(page);
  const log = await page.$eval('#log', e => e.textContent);
  assert.match(log, /Session metadata fetched/);
  assert.match(log, /Total: 10 events, sequences 1 → 10/);
  assert.match(log, /Preview ready: 2 messages from you, 3 from Claude, 1 tool calls, 1 images/);
  assert.match(await page.$eval('#summary', e => e.textContent), /Title.*Synthetic session.*Events10 \(sequences 1 → 10\)/s);
  assert.deepEqual([...new Set(await texts(page, '.who b'))], ['You', 'Claude']);
  assert.equal((await texts(page, '.compact-summary')).length, 1, 'compaction summary rendered as a distinct card');
  assert.match((await texts(page, '.compact-summary summary'))[0], /NOT a message from the user/);
  assert.equal((await texts(page, '.day')).length, 2, 'two day separators');
  const days = await texts(page, '#daySelect option');
  assert.equal(days.length, 3); assert.equal(days[0], 'Pick a day…  (show all)');

  // day filter hides the other day
  await page.selectOption('#daySelect', await page.$eval('#daySelect option:nth-child(3)', o => o.value));
  const visibleDays = await page.$$eval('.day', els => els.filter(e => !e.hidden).length);
  assert.equal(visibleDays, 1);

  const downloads = []; page.on('download', d => downloads.push(d));
  await page.click('#dayBtn'); await page.waitForTimeout(500);
  await page.selectOption('#daySelect', ''); 
  await page.click('#zipBtn'); await page.waitForTimeout(3000);
  await page.click('#zipDayBtn'); await page.waitForTimeout(3000);
  const names = downloads.map(d => d.suggestedFilename());
  assert.ok(names.some(n => /^cowork-cse_test-day-\d{4}-\d{2}-\d{2}\.md$/.test(n)), names.join());
  assert.ok(names.some(n => /^cowork-cse_test-\d{4}-\d{2}-\d{2}T[\d-]+\.zip$/.test(n)), names.join());
  assert.ok(names.some(n => /^cowork-cse_test-by-day-/.test(n)), names.join());
  const dayMd = fs.readFileSync(await downloads[0].path(), 'utf8');
  assert.match(dayMd, /^# Synthetic session — day /);
  assert.match(dayMd, /### You — \d\d:\d\d · #8\n\nThanks, second day message\./);

  // ZIP contents through JSZip inside the page
  const zipPath = await downloads.find(d => d.suggestedFilename().endsWith('.zip') && !d.suggestedFilename().includes('by-day')).path();
  const listing = await page.evaluate(async b64 => { const z = await JSZip.loadAsync(b64, { base64: true }); const names = Object.keys(z.files).filter(n => !z.files[n].dir).sort(); const manifest = JSON.parse(await z.file('manifest.json').async('string')); const transcript = await z.file('transcript.md').async('string'); return { names, manifest, transcript }; }, fs.readFileSync(zipPath).toString('base64'));
  assert.deepEqual(listing.names, ['events.json', 'images/0002-sample.png', 'manifest.json', 'session.json', 'transcript.html', 'transcript.md', 'written-files/0003-outputs__note.md']);
  assert.equal(listing.manifest.event_count, 10); assert.equal(listing.manifest.language, 'en'); assert.deepEqual(listing.manifest.sequence_range, [1, 10]);
  assert.match(listing.transcript, /^# Synthetic session\n\nSession: `cse_test`/);
  assert.match(listing.transcript, /## ⟢ COMPACTION SUMMARY — context kept by Claude \(this is NOT a message from the user\)/);
  assert.deepEqual(page.errors, []);
  await page.close();
});

test('French interface, remembered across reloads', async () => {
  const page = await archivePage();
  await page.selectOption('#langSelect', 'fr'); await page.waitForTimeout(200);
  assert.equal(await page.$eval('h1', e => e.textContent), 'Archivage de la session');
  assert.equal(await page.$eval('#fetchBtn', e => e.textContent), '1. Récupérer la conversation');
  await page.click('#fetchBtn'); await fetched(page);
  assert.deepEqual([...new Set(await texts(page, '.who b'))], ['Vous', 'Claude']);
  assert.match(await page.$eval('#summary', e => e.textContent), /Période/);
  await page.reload(); await page.waitForTimeout(200);
  assert.equal(await page.$eval('#modeBtn', e => e.textContent), 'Mode : lecture');
  assert.deepEqual(page.errors, []);
  await page.close();
});

test('invalid session id disables fetching', async () => {
  const page = await archivePage('not-a-session');
  assert.equal(await page.$eval('#fetchBtn', e => e.disabled), true);
  assert.match(await page.$eval('#log', e => e.textContent), /Missing or invalid session id/);
  await page.close();
});
