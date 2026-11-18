// node shots.mjs <outdir> <level> id1 id2 ... : 1600x900 screenshots of the game with ?art=<id>
import { chromium } from 'playwright';
const [,, out, level, ...ids] = process.argv;
const b = await chromium.launch({ executablePath: process.env.CHROME, args: ['--use-angle=metal'] });
const p = await b.newPage({ viewport: { width: 1600, height: 900 } });
const errs = []; p.on('pageerror', e => errs.push(String(e))); p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
for (const id of ids) {
  await p.goto(`http://localhost:8766/games/tiny-trains/?level=${level}&art=${id}`);
  await p.waitForTimeout(2500);
  await p.screenshot({ path: `${out}/${id}.png` });
  console.log('shot', id);
}
console.log(errs.length ? 'ERRORS ' + errs.join(' | ') : 'no errors');
await b.close();
