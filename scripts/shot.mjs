// Dev helper: renders the running game in headless Chrome and saves screenshots.
// Usage: node scripts/shot.mjs <url> <out-prefix> [actions-json]
import { chromium } from 'playwright-core';

const [url = 'http://localhost:5173', out = '.shots/shot', actionsJson = '[]'] = process.argv.slice(2);
const actions = JSON.parse(actionsJson);

const browser = await chromium.launch({
  executablePath: '/usr/bin/google-chrome',
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: Number(process.env.DSF ?? 1) });
page.on('console', (m) => console.log(`[${m.type()}]`, m.text()));
page.on('pageerror', (e) => console.log('[pageerror]', e.message));
await page.goto(url);
await page.waitForTimeout(1500);
let n = 0;
for (const a of actions) {
  if (a.move) await page.mouse.move(a.move[0], a.move[1], { steps: a.steps ?? 1 });
  if (a.click) await page.mouse.click(a.click[0], a.click[1]);
  if (a.key) await page.keyboard.press(a.key);
  if (a.wait) await page.waitForTimeout(a.wait);
  // Auto-play: steer the creature under the lowest coin for a.track ms
  for (const end = Date.now() + (a.track ?? 0); Date.now() < end; ) {
    const x = await page.evaluate(() => {
      const g = window.game;
      const c = [...g.coins].sort((p, q) => q.y - p.y)[0];
      return c ? (c.x / g.worldWidth) * innerWidth : null;
    });
    if (x !== null) await page.mouse.move(x, 400);
    await page.waitForTimeout(30);
  }
  if (a.shot) await page.screenshot({ path: `${out}-${n++}.png`, clip: a.clip });
  if (a.eval) console.log(await page.evaluate(a.eval));
}
await browser.close();
