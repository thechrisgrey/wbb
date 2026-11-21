// Render a 3D model from several angles through the dev harness (dev-model.html) and save PNGs.
// Needs the dev server running:  npm run dev   (http://localhost:5173)
//
//   node scripts/dev/model-shot.cjs <handle> <outPrefix> [wood] [yaws] [pitches] [size] [bg]
//
//   wood     species key (walnut | oak | maple | mahogany | rosewood | ebonized) or "" for the product default
//   yaws     comma list of turntable angles in radians      (default "-0.6,0.5,1.57,2.6,3.7,4.71")
//   pitches  comma list of camera elevations in radians     (default: the model's own view pitch, then 1.05 from above)
//   size     square viewport in px (default 560)             bg: cream | ink | orange | paper | white
//
// Writes <outPrefix>_p<i>_y<j>.png plus <outPrefix>_sheet.png (all views in one grid) and prints model stats.
const { chromium } = require('playwright');
const { execFileSync } = require('node:child_process');

(async () => {
  const [handle, out, wood = '', yawArg = '', pitchArg = '', size = '560', bg = 'cream'] = process.argv.slice(2);
  if (!handle || !out) {
    console.error('usage: node scripts/dev/model-shot.cjs <handle> <outPrefix> [wood] [yaws] [pitches] [size] [bg]');
    process.exit(1);
  }
  const base = process.env.WBB_URL || 'http://localhost:5173';
  const yaws = (yawArg || '-0.6,0.5,1.57,2.6,3.7,4.71').split(',').map(Number);
  const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const page = await browser.newPage({ viewport: { width: +size, height: +size }, deviceScaleFactor: 1 });
  const errs = [];
  page.on('pageerror', (e) => errs.push('PAGEERROR ' + e.message));
  page.on('console', (m) => {
    const t = m.text();
    if ((m.type() === 'error' || m.type() === 'warning') && !t.includes('GL Driver Message')) errs.push(m.type().toUpperCase() + ' ' + t);
  });
  await page.goto(`${base}/dev-model.html?m=${handle}&bg=${bg}&hud=0${wood ? '&wood=' + wood : ''}`, { waitUntil: 'load' });
  await page.waitForFunction(() => document.documentElement.dataset.ready === '1', null, { timeout: 45000 }).catch(() => errs.push('TIMEOUT: model never became ready (build() threw?)'));
  await page.waitForTimeout(600);
  const stats = await page.evaluate(() => window.__stats || null);
  const ownPitch = await page.evaluate(() => window.__stage?.state.pitch ?? 0.42);
  const pitches = pitchArg ? pitchArg.split(',').map(Number) : [ownPitch, 1.05];
  const files = [];
  for (const [pi, pitch] of pitches.entries()) {
    for (const [yi, yaw] of yaws.entries()) {
      await page.evaluate(([y, p]) => { window.__stage.setView({ yaw: y, pitch: p }, { duration: 0 }); window.__stage.render(); }, [yaw, pitch]);
      await page.waitForTimeout(180);
      const file = `${out}_p${pi}_y${yi}.png`;
      await page.screenshot({ path: file });
      files.push(file);
    }
  }
  await browser.close();
  try {
    execFileSync('montage', [...files, '-tile', `${yaws.length}x`, '-geometry', '+3+3', '-background', '#888', `${out}_sheet.png`]);
    console.log('sheet', `${out}_sheet.png`, `(${pitches.length} rows = pitches ${pitches.map((p) => p.toFixed(2)).join(', ')}; ${yaws.length} columns = yaws ${yaws.join(', ')})`);
  } catch (e) {
    console.log('montage failed:', e.message);
  }
  if (stats) console.log('stats', JSON.stringify(stats));
  if (errs.length) console.log('PROBLEMS:\n' + [...new Set(errs)].slice(0, 15).join('\n'));
  else console.log('no console errors');
})();
