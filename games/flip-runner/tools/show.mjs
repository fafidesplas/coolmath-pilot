// Print a slice of a level map: node tools/show.mjs w1l06 190 240
const [id, a = '0', b = '60'] = process.argv.slice(2);
const lv = (await import(new URL(`../levels/${id}.js`, import.meta.url))).default;
const c0 = +a, c1 = +b;
let head = '     ';
for (let c = c0; c < c1; c++) head += c % 10 === 0 ? String(Math.floor(c / 10) % 10) : ' ';
console.log(head);
lv.tiles.forEach((row, r) => console.log(String(r).padStart(3) + '  ' + row.slice(c0, c1)));
for (const o of lv.objects) if ((o.x ?? 0) >= c0 && (o.x ?? 0) < c1) console.log(' ', JSON.stringify(o));
