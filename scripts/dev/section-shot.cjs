// Screenshot one or more sections on a phone viewport through the dev harness, at several scroll positions.
// Needs the dev server running (http://localhost:5173).
//
//   node scripts/dev/section-shot.cjs <sections> <outPrefix> [steps] [device] [mode] [extraQuery]
//
//   sections    harness "s" value, e.g. hero   or   hero,manifesto   or   @page for the full index.html
//   steps       number of evenly spaced scroll positions from top to bottom (default 8),
//               or a comma list of absolute scroll offsets in px, e.g. "0,400,800"
//   device      iphone (390x844, default) | small (360x740) | max (430x932) | desktop (1440x900)
//   mode        scroll (default): one shot per scroll position after the animations settle
//               intro: stay at the top and capture frames over time (0.15s, 0.5s, 1s, 1.7s, 2.6s, 4s) to review entrances
//   extraQuery  appended to the harness URL, e.g. "pad=0&sheet=1"
//
// Writes <outPrefix>_<i>.png and <outPrefix>_sheet.png (a contact sheet), and prints page height and console problems.
const { chromium } = require('playwright');
const { execFileSync } = require('node:child_process');

const DEVICES = {
  iphone: { width: 390, height: 844, mobile: true },
  small: { width: 360, height: 740, mobile: true },
  max: { width: 430, height: 932, mobile: true },
  desktop: { width: 1440, height: 900, mobile: false },
};

(async () => {
  const [sections, out, stepsArg = '8', device = 'iphone', mode = 'scroll', extra = ''] = process.argv.slice(2);
  if (!sections || !out) {
    console.error('usage: node scripts/dev/section-shot.cjs <sections> <outPrefix> [steps] [device] [mode] [extraQuery]');
    process.exit(1);
  }
  const base = process.env.WBB_URL || 'http://localhost:5173';
  const d = DEVICES[device] || DEVICES.iphone;
  const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
  const context = await browser.newContext({
    viewport: { width: d.width, height: d.height },
    deviceScaleFactor: 1,
    isMobile: d.mobile,
    hasTouch: d.mobile,
    userAgent: d.mobile ? 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1' : undefined,
  });
  const page = await context.newPage();
  const errs = [];
  page.on('pageerror', (e) => errs.push('PAGEERROR ' + e.message));
  page.on('console', (m) => {
    const t = m.text();
    if ((m.type() === 'error' || m.type() === 'warning') && !t.includes('GL Driver Message')) errs.push(m.type().toUpperCase() + ' ' + t);
  });
  page.on('requestfailed', (r) => errs.push('REQUESTFAILED ' + r.url()));
  const url = sections === '@page' ? `${base}/index.html${extra ? '?' + extra : ''}` : `${base}/dev-section.html?s=${sections}${extra ? '&' + extra : ''}`;
  await page.goto(url, { waitUntil: 'load' });
  const files = [];
  if (mode === 'intro') {
    const times = [150, 500, 1000, 1700, 2600, 4000];
    let prev = 0;
    for (const [i, t] of times.entries()) {
      await page.waitForTimeout(t - prev);
      prev = t;
      const file = `${out}_${i}.png`;
      await page.screenshot({ path: file });
      files.push(file);
    }
  } else {
    if (sections === '@page') await page.waitForTimeout(5200); // let the preloader finish
    else await page.waitForFunction(() => document.documentElement.dataset.ready === '1', null, { timeout: 30000 }).catch(() => errs.push('TIMEOUT: harness never became ready'));
    await page.waitForTimeout(900);
    const height = await page.evaluate(() => document.documentElement.scrollHeight);
    const max = Math.max(0, height - d.height);
    const positions = stepsArg.includes(',') ? stepsArg.split(',').map(Number) : Array.from({ length: +stepsArg }, (_, i, a) => Math.round((max * i) / Math.max(1, a.length - 1)));
    console.log('pageHeight', height, 'viewport', `${d.width}x${d.height}`, 'positions', positions.join(','));
    let cur = 0;
    for (const [i, y] of positions.entries()) {
      // scroll in small steps so scrubbed timelines and triggers fire the way they do under a thumb
      const stepsN = Math.max(1, Math.ceil(Math.abs(y - cur) / 120));
      for (let k = 1; k <= stepsN; k++) {
        const to = cur + ((y - cur) * k) / stepsN;
        await page.evaluate((v) => window.scrollTo(0, v), to);
        await page.waitForTimeout(16);
      }
      cur = y;
      await page.waitForTimeout(1300);
      const file = `${out}_${i}.png`;
      await page.screenshot({ path: file });
      files.push(file);
    }
  }
  await browser.close();
  try {
    execFileSync('montage', [...files, '-tile', `${Math.min(files.length, 6)}x`, '-geometry', '+4+4', '-background', '#777', `${out}_sheet.png`]);
    console.log('sheet', `${out}_sheet.png`, `(${files.length} frames, left to right, top to bottom)`);
  } catch (e) {
    console.log('montage failed:', e.message);
  }
  const uniq = [...new Set(errs)];
  console.log(uniq.length ? 'PROBLEMS:\n' + uniq.slice(0, 20).join('\n') : 'no console errors');
})();
