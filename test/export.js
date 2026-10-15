// Headless export: open index.html in Chromium, then write the A3 PDF and the STEP file for a design
// and save screenshots of the page with the bed closed and half down.
// usage: node test/export.js [params.json]      (default design without an argument)
// Needs a Chromium binary: set CHROMIUM_PATH, or have Playwright's browsers installed.
const { chromium } = require('playwright-core');
const fs = require('fs'), path = require('path');
const FILE = 'file://' + path.resolve(__dirname, '../index.html');
const OUT = path.resolve(__dirname, '../out');

(async () => {
  const paramsFile = process.argv[2];
  const params = paramsFile ? JSON.parse(fs.readFileSync(paramsFile, 'utf8')) : null;
  fs.mkdirSync(OUT, { recursive: true });
  const launch = { args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'] };
  if (process.env.CHROMIUM_PATH) launch.executablePath = process.env.CHROMIUM_PATH;
  const browser = await chromium.launch(launch);
  const page = await (await browser.newContext({ viewport: { width: 1440, height: 1000 } })).newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.route('**/*', (route) => (route.request().url().startsWith('file:') ? route.continue() : route.abort()));
  await page.goto(FILE);
  await page.waitForFunction(() => window.MurphyCore && window.MurphyDrawings && window.__murphy);
  const res = await page.evaluate(async (P) => {
    const C = window.MurphyCore;
    const m = C.build(C.normParams(P || C.DEFAULTS)), S = C.summary(m);
    const t0 = performance.now();
    const doc = await window.MurphyDrawings.make(m, S);
    return { pdf: doc.output('datauristring').split(',')[1], step: C.writeSTEP(m, { name: 'MURPHY_WARDROBE' }),
      csv: window.__murphy.csvText(S), ms: performance.now() - t0, pages: doc.getNumberOfPages(),
      checks: m.checks.filter(c => c.level !== 'info').map(c => `${c.level}: ${c.title}`) };
  }, params);
  const base = path.join(OUT, paramsFile ? path.basename(paramsFile, '.json') : 'default');
  fs.writeFileSync(base + '-drawings.pdf', Buffer.from(res.pdf, 'base64'));
  fs.writeFileSync(base + '.step', res.step);
  fs.writeFileSync(base + '-cutlist.csv', res.csv);
  for (const [a, name] of [[0, 'closed'], [45, 'half']]) {
    await page.evaluate((v) => window.__murphy.setBed(v), a);
    await page.waitForTimeout(400);
    await page.screenshot({ path: `${base}-${name}.png` });
  }
  console.log(`${path.basename(base)}: ${res.pages} sheets in ${res.ms.toFixed(0)} ms, STEP ${(res.step.length / 1024).toFixed(0)} KB`);
  for (const c of res.checks) console.log('  ' + c);
  if (errors.length) { console.log('page errors:\n  ' + errors.join('\n  ')); process.exitCode = 1; }
  await browser.close();
})();
