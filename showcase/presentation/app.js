/* Coolmath pilot presentation page.
   Plain script, no build step, no frameworks. Every game view is a real, same-origin
   iframe of ../../games/<slug>/; if a game or a file is missing, the animated
   mechanic.svg stays visible and nothing else breaks. */
(() => {
  'use strict';

  const GAMES_ROOT = '../../games/';
  const REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const STAGES = ['brief', 'gdd', 'slice', 'content', 'polish', 'done'];
  const STAGE_NAMES = { brief: 'Brief', gdd: 'Design', slice: 'Slice', content: 'Content', polish: 'Polish', done: 'Done' };

  const GAMES = [
    {
      slug: 'magnet-twins', name: 'Magnet Twins', num: '01',
      a1: '#ff4d6d', a2: '#3d8bff',
      genre: '2-player co-op puzzle platformer · Chunky Cartoon',
      hook: 'Two robots, one keyboard. One pulls metal, one pushes it, and every level needs both.',
      features: [
        ['🧲', 'Pull and push', 'Plus attracts, Minus repels: an aimable magnetic cone that moves crates, doors, platforms and each other.'],
        ['🎮', 'Two friends, one Chromebook', 'Same-keyboard co-op, or solo mode where one player swaps robots with Tab.'],
        ['⭐', 'Short levels, three stars', 'Finish, grab all 3 bolts, beat the par time. No lives, no game over.'],
      ],
      controls: [[['W', 'A', 'D'], 'Plus: move, jump'], [['F'], 'Plus: power (hold)'], [['←', '↑', '→'], 'Minus: move, jump'], [['/'], 'Minus: power (hold)'], [['Tab'], 'Swap robot (solo)'], [['V'], 'Switch art style']],
      artKey: 'V',
      progress: { done: 13, total: 30, unit: 'levels built' },
      notes: ['World 1, the Workshop, is complete (10 levels)', 'World 2 started: hanging platform on a rail, levels 11–13', '4 art styles, switch live with V or the on-screen pill', '156 automated checks (136 sim + 20 art); a bot solves every level in co-op and solo'],
      stage: 'content',
      preview: 'level=w2l13&replay=coop', loop: 26,
      previewNote: 'Live: the bot playing level 13, Cable Car, in co-op.',
      demos: [['Watch the bot', 'level=w2l13&replay=coop'], ['All worlds unlocked', 'unlock']],
    },
    {
      slug: 'echo-steps', name: 'Echo Steps', num: '02',
      a1: '#37e2ff', a2: '#a77bff',
      genre: 'Time-loop puzzle platformer · Night Neon',
      hook: 'Every attempt leaves an echo that replays what you did. Solve each room with your past selves.',
      features: [
        ['⟳', 'Team up with yourself', 'When the loop ends, your run becomes a ghost that holds plates and doors while you go further.'],
        ['💡', 'Hints that show the way', 'A lightbulb appears when you are stuck and draws the next echo’s route right on the room.'],
        ['↷', 'Never stuck for good', 'After 3 minutes or all hints, Skip room moves on; come back later for the stars.'],
      ],
      controls: [[['←', '→'], 'Move'], [['Space'], 'Jump'], [['E'], 'Loop now: make an echo'], [['⌫'], 'Delete last echo'], [['H'], 'Hint'], [['R'], 'Restart room'], [['V'], 'Switch art style']],
      artKey: 'V',
      progress: { done: 10, total: 36, unit: 'rooms built' },
      notes: ['The Lab: rooms 1–10, each with a reference solution', 'New: hints and Skip room for the presentation', '4 art styles, switch live with V or the on-screen pill', '263 automated checks passing (212 sim + 51 smoke)'],
      stage: 'slice',
      preview: 'replay&room=w1l09', loop: 34,
      previewNote: 'Live: the reference solution of room 9, High Plate.',
      demos: [['Hints on, room 7', 'room=w1l07&hints=now'], ['Watch the solution', 'replay&room=w1l09']],
    },
    {
      slug: 'tiny-trains', name: 'Tiny Trains', num: '03',
      a1: '#ffc93c', a2: '#ff6b3d',
      genre: 'Routing puzzle · Toybox Flat',
      hook: 'Flip the track switches so every colored train reaches its own station, without crashing.',
      features: [
        ['🔀', 'Plan, then GO', 'Time stands still while you set switches. Press GO and watch your plan run like a toy train set.'],
        ['🎫', 'Par stars and a golden ticket', 'Stars for a first-run win, for par switch flips and for collecting the golden ticket.'],
        ['💡', 'Hints after two misses', 'A hint locks one right switch in place. Endless loops fast-forward on their own.'],
      ],
      controls: [[['Click'], 'Flip a switch'], [['Space'], 'GO / Stop'], [['F'], 'Fast-forward'], [['Tab', '↵'], 'Select, flip'], [['H'], 'Hint'], [['R'], 'Reset'], [['A'], 'Switch art style']],
      artKey: 'A',
      progress: { done: 10, total: 50, unit: 'levels built' },
      notes: ['Village levels 1-1 to 1-10, every par checked by a solver', 'New: hints with padlocked switches and the loop skip', '4 art styles, switch live with A or the on-screen pill', '298 automated checks passing (219 sim + 79 smoke)'],
      stage: 'gdd',
      preview: 'level=1-9', loop: 0,
      previewNote: 'Live: level 1-9, Round and Round.',
      demos: [['Hints on, level 1-7', 'level=1-7&hints=now'], ['The loop level', 'level=1-9']],
    },
  ];
  const STATS = [['3', 'original games'], ['33', 'levels and rooms playable'], ['717', 'automated checks passing'], ['4', 'art styles per game'], ['0', 'frameworks']];

  // ---------- helpers ----------
  const $ = id => document.getElementById(id);
  function el(tag, attrs, ...kids) {
    const n = document.createElement(tag);
    if (attrs) for (const [k, v] of Object.entries(attrs)) {
      if (v == null || v === false) continue;
      if (k === 'class') n.className = v;
      else if (k === 'text') n.textContent = v;
      else if (k === 'html') n.innerHTML = v;
      else if (k === 'style') n.style.cssText = v;
      else if (k.startsWith('on')) n.addEventListener(k.slice(2), v);
      else n.setAttribute(k, v === true ? '' : v);
    }
    for (const k of kids.flat()) if (k != null && k !== false) n.append(k.nodeType ? k : document.createTextNode(String(k)));
    return n;
  }
  const accent = g => `--a1:${g.a1};--a2:${g.a2}`;
  function gameUrl(g, query, art) {
    const p = new URLSearchParams(query || '');
    if (art && art !== 'classic') p.set('art', art);
    const s = p.toString().replace(/=(?=&|$)/g, '');
    return GAMES_ROOT + g.slug + '/' + (s ? '?' + s : '');
  }
  const svgUrl = g => GAMES_ROOT + g.slug + '/mechanic.svg';
  const creditsUrl = g => GAMES_ROOT + g.slug + '/assets/CREDITS.md';
  async function getJSON(url) {
    try {
      const r = await fetch(url, { cache: 'no-cache' });
      if (!r.ok) return null;
      return await r.json();
    } catch { return null; }
  }
  const available = {};
  function gameAvailable(g) {
    if (!available[g.slug]) {
      available[g.slug] = fetch(GAMES_ROOT + g.slug + '/index.html', { method: 'HEAD', cache: 'no-cache' })
        .then(r => r.ok).catch(() => false);
    }
    return available[g.slug];
  }

  // ---------- art options ----------
  const art = {}; // slug -> [{id,name,description,pack,license,url}]
  const CLASSIC = { id: 'classic', name: 'Classic', description: 'The current look of the game.', pack: '', license: '', url: '' };
  async function loadArt(g) {
    const data = await getJSON(GAMES_ROOT + g.slug + '/art-options.json');
    const list = Array.isArray(data) ? data : (data && Array.isArray(data.options) ? data.options : []);
    const clean = list.filter(o => o && typeof o.id === 'string' && /^[\w-]+$/.test(o.id))
      .map(o => ({ ...CLASSIC, ...o, name: String(o.name || o.id) }));
    const classic = clean.find(o => o.id === 'classic') || CLASSIC;
    art[g.slug] = [classic, ...clean.filter(o => o.id !== 'classic')];
    return art[g.slug];
  }
  const artCredit = o => [o.pack, o.license].filter(Boolean).join(' · ');

  // ---------- live screens (iframe over the animated mechanic.svg) ----------
  const screens = new Set();
  let ro = null;
  if (typeof ResizeObserver === 'function') ro = new ResizeObserver(entries => entries.forEach(e => fit(e.target)));

  function makeScreen(g, query, opts = {}) {
    const s = el('div', { class: 'screen' + (opts.interactive ? '' : ' preview'), style: accent(g) });
    s._g = g; s._query = query; s._loop = opts.loop || 0; s._interactive = !!opts.interactive; s._base = opts.base || 1180;
    s.append(el('img', { class: 'svg-fallback', src: svgUrl(g), alt: `${g.name}: how it plays`, loading: 'lazy', decoding: 'async' }));
    if (opts.badge !== false) s.append(el('span', { class: 'live off', text: 'PREVIEW' }));
    if (opts.link) {
      s.append(el('a', { class: 'hover-play', href: opts.link, target: '_blank', rel: 'noopener', 'aria-label': `Play ${g.name}` }, el('span', { text: '▶ Play' })));
    }
    screens.add(s);
    if (ro) ro.observe(s);
    return s;
  }

  function fit(s) {
    const f = s._frame;
    if (!f) return;
    const w = s.clientWidth || 1;
    const base = Math.max(w, s._base);
    const k = w / base;
    f.style.width = base + 'px';
    f.style.height = Math.round(base * 9 / 16) + 'px';
    f.style.transform = k === 1 ? 'none' : `scale(${k})`;
  }

  function loadScreen(s) {
    if (s._frame || s._loading) return;
    s._loading = true;
    gameAvailable(s._g).then(ok => {
      s._loading = false;
      if (!ok || s._wantOff || s._frame) { s._wantOff = false; return; }
      const f = el('iframe', {
        title: `${s._g.name} (live)`, src: gameUrl(s._g, s._query, s._art),
        loading: 'eager', allow: 'fullscreen; gamepad', tabindex: s._interactive ? null : '-1',
        'aria-hidden': s._interactive ? null : 'true',
      });
      f.addEventListener('load', () => onFrameLoad(s, f));
      s._frame = f;
      s.insertBefore(f, s.children[1] || null);
      fit(s);
      if (s._loop) s._timer = setInterval(() => {
        if (s._frame && !s._live) try { s._frame.contentWindow.location.reload(); } catch { s._frame.src = s._frame.src; }
      }, s._loop * 1000);
    });
  }

  function unloadScreen(s) {
    if (s._loading) s._wantOff = true;
    clearInterval(s._timer); s._timer = 0;
    if (s._frame) { s._frame.remove(); s._frame = null; }
    s._live = false;
    const b = s.querySelector('.live');
    if (b) { b.textContent = 'PREVIEW'; b.classList.add('off'); }
  }

  function onFrameLoad(s, f) {
    f.classList.add('ready');
    const b = s.querySelector('.live');
    if (b) { b.textContent = 'LIVE'; b.classList.remove('off'); }
    // Same-origin: forward keys so slide navigation keeps working even if the game grabs focus.
    try {
      const w = f.contentWindow;
      w.addEventListener('keydown', e => {
        if (s._live) {
          if (e.key === 'PageDown' || e.key === 'PageUp') { e.preventDefault(); e.stopImmediatePropagation(); onKey(e); }
          return;
        }
        e.preventDefault(); e.stopImmediatePropagation(); onKey(e);
      }, true);
      if (!s._live) {
        if (w.document.activeElement) w.document.activeElement.blur();
        refocus();
      }
    } catch { /* cross-origin or not ready: ignore */ }
  }

  function goLive(s) {
    s._live = true;
    s.classList.remove('preview');
    if (s._frame) {
      s._frame.removeAttribute('tabindex'); s._frame.removeAttribute('aria-hidden');
      try { s._frame.focus(); s._frame.contentWindow.focus(); const c = s._frame.contentDocument.querySelector('canvas'); if (c) c.focus(); } catch { /* ignore */ }
    }
  }

  function refocus() {
    if (deckOpen) deck.focus({ preventScroll: true });
    else if (document.activeElement && document.activeElement.tagName === 'IFRAME') document.activeElement.blur();
  }

  // ---------- page ----------
  function buildPage() {
    const today = new Date();
    $('hero-date').textContent = today.toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' });

    const links = $('top-links');
    GAMES.forEach(g => links.append(el('a', { href: '#' + g.slug, text: g.name })));
    links.append(el('a', { href: '../', text: 'All games' }));

    const hg = $('hero-games');
    GAMES.forEach(g => hg.append(el('a', { class: 'hero-game', href: '#' + g.slug, style: accent(g) },
      el('img', { src: svgUrl(g), alt: '', decoding: 'async' }),
      el('div', null, el('span', { class: 'n', text: g.num }), el('b', { text: g.name }), el('span', { text: g.genre.split(' · ')[0] })))));

    const words = ['Magnet Twins', 'Echo Steps', 'Tiny Trains', 'Co-op on one keyboard', 'Time-loop puzzles', 'Flip the switches', 'Plays on Chromebooks', 'Short levels', 'Stars to chase'];
    const mq = $('marquee');
    for (let i = 0; i < 2; i++) words.forEach(w => mq.append(el('span', { text: w }), el('i', { text: '✦' })));

    const host = $('games');
    GAMES.forEach(g => host.append(buildGame(g)));

    const st = $('stats');
    STATS.forEach(([n, l]) => st.append(el('div', null, el('b', { class: 'grad', 'data-count': n, text: n }), el('span', { text: l }))));
    const cp = $('closing-play');
    GAMES.forEach(g => cp.append(el('a', { class: 'btn play', style: accent(g), href: gameUrl(g), target: '_blank', rel: 'noopener', text: '▶ ' + g.name })));
  }

  function buildGame(g) {
    const play = gameUrl(g);
    const screen = makeScreen(g, g.preview, { loop: g.loop, link: play });
    const stageIdx = STAGES.indexOf(g.stage);
    const phases = el('div', { class: 'phases' }, STAGES.map((st, i) => el('i', { class: i < stageIdx ? 'done' : i === stageIdx ? 'done now' : '' })));
    const names = el('div', { class: 'phase-names' }, STAGES.map((st, i) => el('span', { class: i === stageIdx ? 'now' : '', text: STAGE_NAMES[st] })));
    const pct = Math.round(100 * g.progress.done / g.progress.total);
    const meter = el('i', { style: 'width:0' });

    const sec = el('article', { class: 'game', id: g.slug, style: accent(g) },
      el('div', { class: 'game-visual' }, screen,
        el('p', { class: 'visual-note' }, g.previewNote + ' ', el('a', { href: play, target: '_blank', rel: 'noopener', text: 'Open in a new tab ↗' }))),
      el('div', { class: 'game-info' },
        el('div', { class: 'num', text: g.num + ' / 03' }),
        el('h2', { text: g.name }),
        el('div', { class: 'genre', text: g.genre }),
        el('p', { class: 'hook', text: g.hook }),
        el('ul', { class: 'features' }, g.features.map(([ico, t, d]) => el('li', null, el('div', { class: 'ico', 'aria-hidden': 'true', text: ico }), el('div', null, el('b', { text: t }), el('span', { text: d }))))),
        el('div', { class: 'play-row' },
          el('a', { class: 'btn play', href: play, target: '_blank', rel: 'noopener', text: '▶ PLAY ' + g.name.toUpperCase() }),
          el('div', { class: 'demo-links' }, g.demos.map(([t, q]) => el('a', { class: 'chip', href: gameUrl(g, q), target: '_blank', rel: 'noopener', text: t })))),
        el('div', { class: 'block-title', text: 'Controls' }),
        el('div', { class: 'controls' }, g.controls.map(([keys, label]) => el('div', null, el('span', { class: 'keys' }, keys.map(k => el('kbd', { text: k }))), el('span', { text: label })))),
        el('div', { class: 'block-title', text: 'Art styles' }),
        el('div', { class: 'chips', 'data-art': g.slug }, el('a', { class: 'chip', href: play, target: '_blank', rel: 'noopener', text: 'Classic' })),
        el('p', { class: 'art-help' }, 'In the game: press ', el('kbd', { text: g.artKey }), ' or tap the Art pill to switch styles live. ',
          el('a', { href: creditsUrl(g), target: '_blank', rel: 'noopener', text: 'Credits & licenses ↗' })),
        el('div', { class: 'block-title', text: 'Where it is' }),
        el('div', { class: 'status' }, phases, names,
          el('div', { class: 'count' }, el('b', null, String(g.progress.done), el('small', { text: ' / ' + g.progress.total })), el('span', { text: g.progress.unit })),
          el('div', { class: 'meter' }, meter),
          el('ul', null, g.notes.map(n => el('li', { text: n }))))));
    g._sec = sec; sec._screen = screen; sec._meter = meter; sec._pct = pct; sec._phases = [phases, names];
    return sec;
  }

  function renderArtChips(g) {
    const box = document.querySelector(`.chips[data-art="${g.slug}"]`);
    if (!box) return;
    const opts = art[g.slug] || [CLASSIC];
    box.replaceChildren(...opts.map(o => el('a', {
      class: 'chip', href: gameUrl(g, '', o.id), target: '_blank', rel: 'noopener',
      title: [o.description, artCredit(o)].filter(Boolean).join(' · '), text: o.name,
    })));
    if (opts.length > 1) box.append(el('button', { class: 'chip compare-btn', type: 'button', text: 'Compare side by side', onclick: () => openCompare(g) }));
    else box.append(el('span', { class: 'note', text: 'More art directions are in the works.' }));
  }

  function applyStage(g, stage) {
    if (!STAGES.includes(stage) || stage === g.stage) return;
    g.stage = stage;
    const sec = g._sec;
    if (!sec || !sec._phases) return;
    const i = STAGES.indexOf(stage);
    sec._phases[0].querySelectorAll('i').forEach((n, k) => { n.className = k < i ? 'done' : k === i ? 'done now' : ''; });
    sec._phases[1].querySelectorAll('span').forEach((n, k) => { n.className = k === i ? 'now' : ''; });
  }

  // reveal + lazy live previews
  function watchPage() {
    const reveal = typeof IntersectionObserver === 'function' ? new IntersectionObserver(es => es.forEach(e => {
      if (e.isIntersecting) {
        e.target.classList.add('in');
        e.target._meter.style.width = e.target._pct + '%';
        reveal.unobserve(e.target);
      }
    }), { threshold: .12 }) : null;
    const lazy = typeof IntersectionObserver === 'function' ? new IntersectionObserver(es => es.forEach(e => {
      e.target._visible = e.isIntersecting;
      if (deckOpen || compareOpen) return;
      if (e.isIntersecting) loadScreen(e.target); else unloadScreen(e.target);
    }), { rootMargin: '150px 0px' }) : null;
    document.querySelectorAll('.game').forEach(sec => {
      if (reveal) reveal.observe(sec); else { sec.classList.add('in'); sec._meter.style.width = sec._pct + '%'; }
      if (lazy) lazy.observe(sec._screen); else loadScreen(sec._screen);
    });
  }
  const pageScreens = () => [...document.querySelectorAll('.game')].map(s => s._screen);
  function pausePage() { pageScreens().forEach(unloadScreen); }
  function resumePage() { pageScreens().forEach(s => { if (s._visible) loadScreen(s); }); }

  // ---------- compare modal ----------
  let compareOpen = false, compareGame = null, comparePick = [];
  const compareScreens = [];
  const MAX_PICK = 4;
  function defaultPick(g) { return (art[g.slug] || [CLASSIC]).slice(0, MAX_PICK).map(o => o.id); }

  function artFigure(g, o, opts = {}) {
    const s = makeScreen(g, g.preview, { loop: g.loop, link: gameUrl(g, '', o.id), interactive: false });
    s._art = o.id;
    const credit = artCredit(o);
    return {
      screen: s,
      fig: el('figure', { class: 'cmp' }, s, el('figcaption', null, el('b', { text: o.name }), opts.desc === false ? null : (o.description || ''),
        credit ? el('small', null, o.url ? el('a', { href: o.url, target: '_blank', rel: 'noopener', text: credit }) : credit) : null)),
    };
  }

  function openCompare(g) {
    compareGame = g; comparePick = defaultPick(g);
    compareOpen = true; pausePage();
    const m = $('compare');
    m.style.cssText = accent(g);
    const n = (art[g.slug] || [CLASSIC]).length;
    $('compare-title').textContent = `${g.name}: ${n} art styles`;
    m.hidden = false; document.body.style.overflow = 'hidden';
    renderCompare();
    $('compare-close').focus();
  }
  function renderCompare() {
    const g = compareGame, opts = art[g.slug] || [CLASSIC];
    $('compare-pick').replaceChildren(...opts.map(o => el('button', {
      type: 'button', 'aria-pressed': String(comparePick.includes(o.id)), text: o.name,
      onclick: () => {
        if (comparePick.includes(o.id)) { if (comparePick.length > 1) comparePick = comparePick.filter(x => x !== o.id); }
        else { comparePick.push(o.id); if (comparePick.length > MAX_PICK) comparePick.shift(); }
        renderCompare();
      },
    })));
    compareScreens.splice(0).forEach(s => { unloadScreen(s); screens.delete(s); if (ro) ro.unobserve(s); });
    const grid = $('compare-grid');
    grid.style.setProperty('--n', comparePick.length);
    grid.replaceChildren(...comparePick.map(id => {
      const o = opts.find(x => x.id === id) || CLASSIC;
      const { screen, fig } = artFigure(g, o);
      compareScreens.push(screen);
      return fig;
    }));
    compareScreens.forEach(loadScreen);
  }
  function closeCompare() {
    if (!compareOpen) return;
    compareOpen = false;
    compareScreens.splice(0).forEach(s => { unloadScreen(s); screens.delete(s); if (ro) ro.unobserve(s); });
    $('compare').hidden = true; document.body.style.overflow = '';
    resumePage();
  }
  $('compare-close').addEventListener('click', closeCompare);
  $('compare').addEventListener('click', e => { if (e.target === e.currentTarget) closeCompare(); });

  // ---------- slides ----------
  const deck = $('deck'), stage = $('deck-stage');
  deck.tabIndex = -1;
  let deckOpen = false, slides = [], cur = 0, helpTimer = 0;

  function buildSlides() {
    stage.replaceChildren();
    slides = [];
    const add = (cls, g, ...kids) => {
      const s = el('section', { class: 'slide ' + cls, style: g ? accent(g) : null, 'aria-roledescription': 'slide' }, ...kids);
      s._g = g; s._screens = [];
      stage.append(s); slides.push(s);
      return s;
    };

    add('s-title', null,
      el('p', { class: 'kicker', text: 'Coolmath pilot · ' + $('hero-date').textContent }),
      el('h1', null, 'Three games.', el('br'), el('span', { class: 'grad', text: 'Ready to play.' })),
      el('p', { text: 'Magnet Twins, Echo Steps and Tiny Trains: original puzzle games for the browser, running live in this deck.' }),
      el('div', { class: 'trio' }, GAMES.map(g => el('div', { style: accent(g) }, el('img', { src: svgUrl(g), alt: '' }), el('b', { text: g.name })))));

    GAMES.forEach(g => {
      const scr = makeScreen(g, g.preview, { interactive: false, loop: g.loop, base: 960 });
      const shot = el('div', { class: 's-shot' }, scr,
        el('button', { class: 'live-btn', type: 'button', onclick: () => { shot.classList.add('interactive'); goLive(scr); } }, el('span', { text: '🎮 Click to play it live here' })));
      const s = add('s-game', g,
        el('div', null,
          el('p', { class: 'kicker', text: g.num + ' · ' + g.genre }),
          el('h2', { text: g.name }),
          el('p', { class: 'hook', text: g.hook }),
          el('ul', null, g.features.map(([i, t]) => el('li', null, el('i', { text: i }), t))),
          el('div', { class: 's-status', text: `${g.progress.done} / ${g.progress.total} ${g.progress.unit} · ${STAGE_NAMES[g.stage]} phase` }),
          el('div', { class: 's-keys' }, g.controls.slice(0, 4).map(([k, l]) => el('span', null, k.map(x => el('kbd', { text: x })), l))),
          el('a', { class: 'btn play', href: gameUrl(g), target: '_blank', rel: 'noopener', text: '▶ PLAY' })),
        shot);
      s._screens.push(scr); s._shot = shot;

      const opts = art[g.slug] || [CLASSIC];
      const pick = opts.slice(0, MAX_PICK);
      const a = add('s-art', g,
        el('p', { class: 'kicker', text: g.num + ' · ' + g.name + ' · Art styles' }),
        el('h2', null, pick.length > 1 ? 'Same game, ' : 'The look: ', el('span', { class: 'grad', text: pick.length > 1 ? `${pick.length} looks.` : 'Classic.' })),
        el('p', { class: 'lead', text: pick.length > 1 ? `Each view is the real game switched with one URL parameter, ?art=<style>. In the game, press ${g.artKey} to switch live.` : 'More art directions are in the works; they plug in with one URL parameter, ?art=<style>.' }));
      const grid = el('div', { class: 'compare-grid' + (pick.length > 1 ? '' : ' solo'), style: `--n:${pick.length}` });
      pick.forEach(o => { const { screen, fig } = artFigure(g, o, { desc: pick.length < 3 }); a._screens.push(screen); grid.append(fig); });
      a.append(grid);
    });

    add('s-close', null,
      el('p', { class: 'kicker', text: 'Thank you' }),
      el('h2', null, 'Pick one. ', el('span', { class: 'grad', text: 'Press play.' })),
      el('div', { class: 'stats' }, STATS.map(([n, l]) => el('div', null, el('b', { class: 'grad', text: n }), el('span', { text: l })))),
      el('div', { class: 'closing-play' }, GAMES.map(g => el('a', { class: 'btn play', style: accent(g), href: gameUrl(g), target: '_blank', rel: 'noopener', text: '▶ ' + g.name }))));
  }

  function show(i) {
    i = Math.max(0, Math.min(slides.length - 1, i));
    const prev = slides[cur];
    cur = i;
    slides.forEach((s, k) => {
      s.classList.toggle('active', k === i);
      s.classList.toggle('before', k < i);
      s.setAttribute('aria-hidden', k === i ? 'false' : 'true');
    });
    // Only the current slide runs games; the others are unloaded after the transition.
    if (prev && prev !== slides[i]) {
      const old = prev;
      setTimeout(() => { if (slides[cur] !== old) old._screens.forEach(unloadScreen); if (old._shot && slides[cur] !== old) old._shot.classList.remove('interactive'); }, REDUCED ? 0 : 700);
      old._screens.forEach(sc => { sc._live = false; });
    }
    const s = slides[i];
    s._screens.forEach(sc => { sc.classList.add('preview'); setTimeout(() => { if (slides[cur] === s) loadScreen(sc); }, REDUCED ? 0 : 250); });
    const g = s._g;
    deck.style.cssText = g ? accent(g) : '--a1:#ff4d6d;--a2:#37e2ff';
    $('deck-progress').style.width = (100 * (i + 1) / slides.length) + '%';
    $('deck-count').textContent = `${i + 1} / ${slides.length}`;
    if (history.replaceState) history.replaceState(null, '', '#present=' + (i + 1));
    refocus();
  }

  function openDeck(at = 0, fullscreen = false) {
    if (deckOpen) return;
    closeCompare();
    deckOpen = true;
    pausePage();
    buildSlides();
    deck.hidden = false;
    document.body.classList.add('deck-open');
    cur = 0;
    show(at);
    deck.focus({ preventScroll: true });
    if (fullscreen) toggleFullscreen(true);
    $('deck-help').classList.remove('hide');
    clearTimeout(helpTimer);
    helpTimer = setTimeout(() => $('deck-help').classList.add('hide'), 6000);
  }
  function closeDeck() {
    if (!deckOpen) return;
    deckOpen = false;
    slides.forEach(s => s._screens.forEach(sc => { unloadScreen(sc); screens.delete(sc); if (ro) ro.unobserve(sc); }));
    stage.replaceChildren(); slides = [];
    deck.hidden = true;
    document.body.classList.remove('deck-open');
    if (document.fullscreenElement && document.exitFullscreen) document.exitFullscreen().catch(() => {});
    if (history.replaceState) history.replaceState(null, '', location.pathname + location.search);
    resumePage();
  }
  function toggleFullscreen(on) {
    const want = on == null ? !document.fullscreenElement : on;
    try {
      if (want && !document.fullscreenElement && document.documentElement.requestFullscreen) document.documentElement.requestFullscreen().catch(() => {});
      else if (!want && document.fullscreenElement) document.exitFullscreen().catch(() => {});
    } catch { /* not allowed: fine */ }
  }

  $('deck-prev').addEventListener('click', () => show(cur - 1));
  $('deck-next').addEventListener('click', () => show(cur + 1));
  $('deck-close').addEventListener('click', closeDeck);
  $('deck-fs').addEventListener('click', () => toggleFullscreen());
  $('present-top').addEventListener('click', () => openDeck(0, true));
  $('present-hero').addEventListener('click', () => openDeck(0, true));
  deck.addEventListener('click', e => {
    if (e.target.closest('a, button, iframe')) return;
    refocus(); // a click outside a live game hands the keyboard back to the deck
  });

  // ---------- keyboard ----------
  function onKey(e) {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const k = e.key;
    if (compareOpen) { if (k === 'Escape') closeCompare(); return; }
    if (!deckOpen) {
      if (k === 'f' || k === 'F') { e.preventDefault(); openDeck(0, true); }
      return;
    }
    const tag = e.target && e.target.tagName;
    if ((k === ' ' || k === 'Enter') && (tag === 'A' || tag === 'BUTTON') && e.target !== deck) return; // let buttons work
    switch (k) {
      case 'ArrowRight': case 'ArrowDown': case 'PageDown': case ' ': case 'Enter': case 'n': case 'N':
        e.preventDefault(); show(cur + 1); break;
      case 'ArrowLeft': case 'ArrowUp': case 'PageUp': case 'Backspace': case 'p': case 'P':
        if (k === 'p' || k === 'P') { const g = slides[cur] && slides[cur]._g; if (g) window.open(gameUrl(g), '_blank', 'noopener'); break; }
        e.preventDefault(); show(cur - 1); break;
      case 'Home': e.preventDefault(); show(0); break;
      case 'End': e.preventDefault(); show(slides.length - 1); break;
      case 'f': case 'F': e.preventDefault(); toggleFullscreen(); break;
      case 'Escape':
        e.preventDefault();
        if (slides[cur] && slides[cur]._shot && slides[cur]._shot.classList.contains('interactive')) {
          slides[cur]._shot.classList.remove('interactive');
          slides[cur]._screens.forEach(sc => { sc._live = false; sc.classList.add('preview'); });
          refocus();
        } else closeDeck();
        break;
      default:
        if (/^[1-9]$/.test(k)) { e.preventDefault(); show(+k - 1); }
    }
  }
  document.addEventListener('keydown', onKey);

  // ---------- hero particles (magnets, echoes, trains) ----------
  function startFx() {
    const c = $('fx'), ctx = c.getContext && c.getContext('2d');
    if (!ctx) return;
    const COLORS = ['#ff4d6d', '#3d8bff', '#37e2ff', '#a77bff', '#ffc93c', '#ff7a3d'];
    let W = 0, H = 0, dpr = 1, parts = [], mouse = { x: -1e4, y: -1e4 }, t0 = performance.now(), raf = 0;
    function resize() {
      dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      W = c.clientWidth; H = c.clientHeight;
      c.width = Math.round(W * dpr); c.height = Math.round(H * dpr);
      const n = Math.round(Math.min(130, W * H / 14000));
      parts = Array.from({ length: n }, (_, i) => ({
        x: Math.random() * W, y: Math.random() * H,
        vx: (Math.random() - .5) * .35, vy: (Math.random() - .5) * .35,
        r: 1.5 + Math.random() * 3.2, c: COLORS[i % COLORS.length], kind: i % 5, ph: Math.random() * 6.28,
      }));
    }
    function draw(now) {
      const t = (now - t0) / 1000;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, W, H);
      // slow magnetic field arcs
      ctx.lineWidth = 1.2;
      for (let i = 0; i < 6; i++) {
        const cx = W * (.18 + .64 * ((i % 3) / 2)), cy = H * (i < 3 ? .32 : .72);
        const rr = 90 + 60 * Math.sin(t * .4 + i);
        ctx.strokeStyle = COLORS[i] + '22';
        ctx.beginPath(); ctx.arc(cx, cy, rr, t * .25 + i, t * .25 + i + 2.2); ctx.stroke();
        ctx.beginPath(); ctx.arc(cx, cy, rr * 1.6, -t * .18 + i, -t * .18 + i + 1.4); ctx.stroke();
      }
      for (const p of parts) {
        const dx = p.x - mouse.x, dy = p.y - mouse.y, d2 = dx * dx + dy * dy;
        if (d2 < 32000) { const f = (p.kind % 2 ? -1 : 1) * 30 / (d2 + 600); p.vx += dx * f; p.vy += dy * f; }
        p.vx *= .985; p.vy *= .985;
        p.vx += (Math.random() - .5) * .02; p.vy += (Math.random() - .5) * .02;
        p.x += p.vx; p.y += p.vy;
        if (p.x < -20) p.x = W + 20; if (p.x > W + 20) p.x = -20;
        if (p.y < -20) p.y = H + 20; if (p.y > H + 20) p.y = -20;
      }
      ctx.lineWidth = 1;
      for (let i = 0; i < parts.length; i++) for (let j = i + 1; j < parts.length; j++) {
        const a = parts[i], b = parts[j], dx = a.x - b.x, dy = a.y - b.y, d = dx * dx + dy * dy;
        if (d < 12000) { ctx.strokeStyle = a.c + Math.round((1 - d / 12000) * 60).toString(16).padStart(2, '0'); ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke(); }
      }
      for (const p of parts) {
        const s = p.r * (1 + .25 * Math.sin(t * 2 + p.ph));
        ctx.fillStyle = p.c; ctx.strokeStyle = p.c; ctx.shadowColor = p.c; ctx.shadowBlur = 12;
        if (p.kind === 0) { ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(p.x - s * 1.6, p.y); ctx.lineTo(p.x + s * 1.6, p.y); ctx.moveTo(p.x, p.y - s * 1.6); ctx.lineTo(p.x, p.y + s * 1.6); ctx.stroke(); }
        else if (p.kind === 1) { ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(p.x - s * 1.6, p.y); ctx.lineTo(p.x + s * 1.6, p.y); ctx.stroke(); }
        else if (p.kind === 2) { ctx.globalAlpha = .55; ctx.beginPath(); ctx.arc(p.x, p.y, s * 1.3, 0, 6.283); ctx.fill(); ctx.globalAlpha = 1; }
        else if (p.kind === 3) { ctx.fillRect(p.x - s, p.y - s * .7, s * 2, s * 1.4); }
        else { ctx.beginPath(); ctx.arc(p.x, p.y, s, 0, 6.283); ctx.fill(); }
      }
      ctx.shadowBlur = 0;
    }
    function loop(now) {
      raf = 0;
      if (!deckOpen && !document.hidden) draw(now);
      if (!REDUCED) raf = requestAnimationFrame(loop);
    }
    resize();
    window.addEventListener('resize', () => { resize(); if (REDUCED) draw(performance.now()); });
    window.addEventListener('pointermove', e => { mouse.x = e.clientX; mouse.y = e.clientY; }, { passive: true });
    document.addEventListener('pointerleave', () => { mouse.x = mouse.y = -1e4; });
    if (REDUCED) draw(performance.now()); else raf = requestAnimationFrame(loop);
  }

  // ---------- count-up for stats ----------
  function countUp() {
    if (REDUCED || !(typeof IntersectionObserver === 'function')) return;
    const io = new IntersectionObserver(es => es.forEach(e => {
      if (!e.isIntersecting) return;
      io.unobserve(e.target);
      const end = +e.target.dataset.count, t0 = performance.now();
      if (!end) return;
      const tick = now => {
        const k = Math.min(1, (now - t0) / 1400), v = Math.round(end * (1 - Math.pow(1 - k, 3)));
        e.target.textContent = String(v);
        if (k < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    }), { threshold: .6 });
    document.querySelectorAll('[data-count]').forEach(n => io.observe(n));
  }

  // ---------- boot ----------
  try { buildPage(); } catch (err) { console.error('Showcase build failed', err); }
  watchPage();
  countUp();
  try { startFx(); } catch (err) { console.warn('FX off', err); }
  GAMES.forEach(g => {
    loadArt(g).then(() => renderArtChips(g)).catch(() => {});
    getJSON(GAMES_ROOT + g.slug + '/meta.json').then(m => { if (m && m.stage) applyStage(g, m.stage); });
  });
  const m = /^#present(?:=(\d+))?$/.exec(location.hash);
  if (m) Promise.all(GAMES.map(g => art[g.slug] ? null : loadArt(g))).finally(() => openDeck(m[1] ? +m[1] - 1 : 0, false));
})();
