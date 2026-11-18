// node bake.mjs jobs.json outdir  (jobs: {name: job})
import { chromium } from 'playwright'; import fs from 'fs'; import path from 'path';
const [,, jobsFile, outDir] = process.argv;
const jobs = JSON.parse(fs.readFileSync(jobsFile, 'utf8'));
const b = await chromium.launch({ executablePath: process.env.CHROME, args: ['--use-angle=metal', '--enable-gpu'] });
const p = await b.newPage(); p.on('console', m => console.log('page:', m.text())); p.on('pageerror', e => console.log('err', e));
await p.goto('http://localhost:8765/tooling/render.html'); await p.waitForFunction(() => window.ready);
fs.mkdirSync(outDir, { recursive: true });
for (const [name, job] of Object.entries(jobs)) {
  for (const it of job.items) it.url = 'http://localhost:8765/' + it.url;
  const d = await p.evaluate(j => window.render(j), job);
  fs.writeFileSync(path.join(outDir, name + '.png'), Buffer.from(d.split(',')[1], 'base64'));
  console.log('ok', name);
}
await b.close();
