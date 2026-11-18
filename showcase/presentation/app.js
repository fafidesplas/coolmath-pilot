/* Coolmath Pilot — Prototype Review.
   Plain script, no build step. The slides are static HTML in index.html; this file
   adds the art comparison (read from games/<slug>/art-options.json at run time),
   the live game windows (same-origin iframes of ../../games/<slug>/) and the
   presentation mode (#present or #present=N). */
(() => {
  'use strict';

  const GAMES = '../../games/';
  const STAGES = ['brief', 'gdd', 'slice', 'content', 'polish', 'done'];
  const STAGE_NAME = { brief: 'Brief', gdd: 'Design', slice: 'Slice', content: 'Content', polish: 'Polish', done: 'Done' };
  const PREVIEW_BASE = 1280; // art previews render the game at 1280x720 and scale it down

  const $ = sel => document.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
  function el(tag, attrs, ...kids) {
    const n = document.createElement(tag);
    if (attrs) for (const [k, v] of Object.entries(attrs)) {
      if (v == null || v === false) continue;
      if (k === 'class') n.className = v;
      else if (k === 'text') n.textContent = v;
      else if (k.startsWith('on')) n.addEventListener(k.slice(2), v);
      else n.setAttribute(k, v === true ? '' : v);
    }
    for (const k of kids.flat()) if (k != null && k !== false) n.append(k.nodeType ? k : document.createTextNode(String(k)));
    return n;
  }
  function gameUrl(slug, query) {
    const q = String(query || '').replace(/^\?/, '');
    return GAMES + slug + '/' + (q ? '?' + q : '');
  }
  async function getJSON(url) {
    try {
      const r = await fetch(url, { cache: 'no-cache' });
      return r.ok ? await r.json() : null;
    } catch { return null; }
  }
  const availability = {};
  function available(slug) {
    if (!(slug in availability)) {
      availability[slug] = fetch(GAMES + slug + '/index.html', { method: 'HEAD', cache: 'no-cache' }).then(r => r.ok).catch(() => false);
    }
    return availability[slug];
  }

  const slides = $$('.slide');
  const stage = $('#stage');
  let present = false, cur = 0;

  // ---------------------------------------------------------------- live game windows
  // A .live box holds one iframe at most. Interactive boxes (the demos) get a veil
  // that turns into keyboard control on click; Esc hands control back to the deck.
  const ro = typeof ResizeObserver === 'function' ? new ResizeObserver(es => es.forEach(e => fit(e.target))) : null;

  function initLive(box) {
    if (box._init) return;
    box._init = true;
    if (box.hasAttribute('data-interactive')) {
      box.append(el('button', { class: 'veil', type: 'button', 'aria-label': 'Play the game here', onclick: () => playHere(box) }));
    } else if (ro) ro.observe(box);
  }

  function fit(box) {
    const f = box._frame;
    if (!f || box.hasAttribute('data-interactive')) return;
    const w = box.offsetWidth || 1;
    f.style.width = PREVIEW_BASE + 'px';
    f.style.height = Math.round(PREVIEW_BASE * 9 / 16) + 'px';
    f.style.transform = `scale(${w / PREVIEW_BASE})`;
  }

  function src(box) {
    const p = new URLSearchParams(box.dataset.query || '');
    if (box.dataset.art) p.set('art', box.dataset.art);
    return gameUrl(box.dataset.slug, p.toString().replace(/=(?=&|$)/g, ''));
  }

  function load(box) {
    initLive(box);
    if (box._frame || box._loading) return;
    box._loading = true;
    available(box.dataset.slug).then(ok => {
      box._loading = false;
      if (box._cancel) { box._cancel = false; return; }
      if (box._frame) return;
      if (!ok) { if (!box.querySelector('.empty')) box.append(el('div', { class: 'empty', text: 'Preview unavailable' })); return; }
      const interactive = box.hasAttribute('data-interactive');
      const f = el('iframe', {
        src: src(box), title: box.dataset.title || 'Game', allow: 'fullscreen; gamepad; autoplay',
        tabindex: '-1', 'aria-hidden': interactive ? null : 'true',
      });
      if (interactive) { f.style.width = '100%'; f.style.height = '100%'; }
      else f.style.pointerEvents = 'none';
      f.addEventListener('load', () => onFrameLoad(box, f));
      box._frame = f;
      box.prepend(f);
      fit(box);
      const loop = +box.dataset.loop || 0;
      if (loop) box._timer = setInterval(() => {
        if (box._frame && !box.classList.contains('playing')) {
          box._frame.classList.remove('ready');
          try { box._frame.contentWindow.location.reload(); } catch { box._frame.src = box._frame.src; }
        }
      }, loop * 1000);
    });
  }

  function unload(box) {
    if (box._loading) box._cancel = true;
    clearInterval(box._timer); box._timer = 0;
    if (box._frame) { box._frame.remove(); box._frame = null; }
    box.classList.remove('playing');
    mark(box, false);
  }

  function onFrameLoad(box, f) {
    f.classList.add('ready');
    try {
      const w = f.contentWindow;
      // Capture phase on the game's window runs before the game's own key listeners.
      w.addEventListener('keydown', e => {
        if (box.classList.contains('playing')) {
          if (e.key === 'Escape') { e.preventDefault(); e.stopImmediatePropagation(); release(box); }
          else if (e.key === 'PageDown' || e.key === 'PageUp') { e.preventDefault(); e.stopImmediatePropagation(); onKey(e); }
          return;
        }
        e.preventDefault(); e.stopImmediatePropagation(); onKey(e);
      }, true);
      if (!box.classList.contains('playing') && document.activeElement === f) f.blur();
    } catch { /* not same-origin: nothing to forward */ }
    if (box.classList.contains('playing')) focusGame(box);
  }

  function focusGame(box) {
    const f = box._frame;
    if (!f) return;
    f.removeAttribute('tabindex');
    try {
      f.focus(); f.contentWindow.focus();
      const c = f.contentDocument && f.contentDocument.querySelector('canvas');
      if (c) { if (!c.hasAttribute('tabindex')) c.tabIndex = -1; c.focus(); }
    } catch { /* ignore */ }
  }

  function playHere(box) {
    $$('.live.playing').forEach(b => b !== box && release(b));
    box.classList.add('playing');
    mark(box, true);
    if (!box._frame) load(box); else focusGame(box);
  }

  function mark(box, on) {
    const host = box.closest('.demo-main');
    if (host) host.classList.toggle('is-playing', on);
  }

  function release(box) {
    box.classList.remove('playing');
    mark(box, false);
    if (box._frame) {
      box._frame.setAttribute('tabindex', '-1');
      try { box._frame.blur(); } catch { /* ignore */ }
    }
    if (document.activeElement && document.activeElement.tagName === 'IFRAME') document.activeElement.blur();
    window.focus();
  }

  // demo presets
  $$('.s-demo').forEach(s => {
    const box = s.querySelector('.live');
    box.dataset.title = (s.querySelector('h3') || {}).textContent || 'Game';
    initLive(box);
    s.querySelectorAll('.presets button').forEach(b => b.addEventListener('click', () => {
      s.querySelectorAll('.presets button').forEach(x => x.setAttribute('aria-pressed', String(x === b)));
      box.dataset.query = b.dataset.query || '';
      const wasLoaded = !!box._frame || present;
      unload(box);
      if (wasLoaded) load(box);
    }));
  });

  // ---------------------------------------------------------------- art comparison
  const isImage = p => typeof p === 'string' && /\.(png|jpe?g|webp|gif|svg)(\?.*)?$/i.test(p);
  function resolvePreview(slug, p) {
    if (/^(https?:)?\/\//.test(p)) return p;
    if (p.startsWith('games/')) return '../../' + p;
    return GAMES + slug + '/' + p.replace(/^\.\//, '');
  }

  async function buildArt(section) {
    const slug = section.dataset.art;
    const grid = section.querySelector('.art-grid');
    const data = await getJSON(GAMES + slug + '/art-options.json');
    const raw = Array.isArray(data) ? data : (data && Array.isArray(data.options) ? data.options : []);
    const list = raw.filter(o => o && typeof o.id === 'string' && /^[\w-]+$/.test(o.id));
    grid.replaceChildren();
    if (!list.length) {
      grid.append(el('p', { class: 'art-empty', text: 'No art options listed yet (art-options.json).' }));
      return;
    }
    const n = Math.min(list.length, 5);
    grid.style.setProperty('--n', n);
    grid.className = 'art-grid n' + n;
    const key = section.dataset.artKey || 'V';
    section.querySelector('.art-note').textContent =
      `${list.length} options. Each one is the real game with ?art=<id>. In the game, press ${key} to switch.`;

    list.forEach(o => {
      const shot = el('div', { class: 'art-shot' });
      const liveBox = () => {
        const b = el('div', { class: 'live', 'data-slug': slug, 'data-art': o.id, 'data-query': section.dataset.artQuery || '', 'data-loop': section.dataset.artLoop || '0' });
        b.dataset.title = `${o.name || o.id} preview`;
        return b;
      };
      if (isImage(o.preview)) {
        const img = el('img', { src: resolvePreview(slug, o.preview), alt: `${o.name || o.id}: screenshot`, loading: 'lazy', decoding: 'async' });
        img.addEventListener('error', () => { const b = liveBox(); img.replaceWith(b); watch(b); if (present && slides[cur] === section) load(b); });
        shot.append(img);
      } else {
        shot.append(liveBox());
      }
      // Seven direct children per option, so the grid's subgrid rows line up across columns.
      const row = (label, value) => el('div', { class: 'art-row' }, el('span', { class: 'k', text: label }),
        el('span', { class: 'v' + (value ? '' : ' none'), text: value || 'Not listed', title: value || null }));
      grid.append(el('article', { class: 'art-opt' },
        shot,
        el('div', { class: 'art-name' }, el('h3', { text: o.name || o.id }), o.id === 'classic' ? el('small', { text: 'Current default' }) : null),
        el('p', { class: 'art-desc', text: o.description || '', title: o.description || null }),
        row('Pack', o.pack), row('Author', o.author), row('License', o.license),
        el('div', { class: 'art-links' },
          o.url ? el('a', { href: o.url, target: '_blank', rel: 'noopener', text: 'Pack page' }) : el('span', { text: 'No pack page' }),
          el('a', { href: gameUrl(slug, 'art=' + encodeURIComponent(o.id)), target: '_blank', rel: 'noopener', text: 'Open in game' }))));
    });
    grid.querySelectorAll('.live').forEach(watch);
    if (present && slides[cur] === section) activate(section);
  }

  // ---------------------------------------------------------------- stage from meta.json
  function applyStage(slug, st) {
    const i = STAGES.indexOf(st);
    if (i < 0) return;
    const row = document.querySelector(`[data-stage-row="${slug}"]`);
    if (row) row.querySelectorAll('td').forEach((td, k) => { td.className = k < i ? 'done' : k === i ? 'now' : ''; });
    const name = document.querySelector(`[data-stage-name="${slug}"]`);
    if (name) name.textContent = STAGE_NAME[st];
  }
  $$('[data-stage-row]').forEach(r => {
    applyStage(r.dataset.stageRow, r.dataset.stage);
    getJSON(GAMES + r.dataset.stageRow + '/meta.json').then(m => { if (m && m.stage) applyStage(r.dataset.stageRow, m.stage); });
  });

  // ---------------------------------------------------------------- document mode: load previews in view
  const io = typeof IntersectionObserver === 'function' ? new IntersectionObserver(es => es.forEach(e => {
    e.target._visible = e.isIntersecting;
    if (present) return;
    if (e.isIntersecting) load(e.target); else unload(e.target);
  }), { rootMargin: '200px 0px' }) : null;
  function watch(box) { if (io) io.observe(box); else if (!present) load(box); }

  // ---------------------------------------------------------------- presentation mode
  const counter = $('#counter'), help = $('#deck-help');
  const pad = n => String(n).padStart(2, '0');
  let helpTimer = 0;

  function scale() {
    const k = Math.min(window.innerWidth / 1920, window.innerHeight / 1080);
    stage.style.setProperty('--k', k.toFixed(4));
  }

  function activate(slide) {
    slide.querySelectorAll('.live').forEach(load);
  }

  function show(i) {
    i = Math.max(0, Math.min(slides.length - 1, i));
    const prev = slides[cur];
    cur = i;
    const s = slides[i];
    slides.forEach((x, k) => {
      x.classList.toggle('active', k === i);
      x.setAttribute('aria-hidden', String(k !== i));
    });
    if (prev && prev !== s) {
      prev.querySelectorAll('.live').forEach(release);
      setTimeout(() => { if (slides[cur] !== prev) prev.querySelectorAll('.live').forEach(unload); }, 260);
    }
    setTimeout(() => { if (present && slides[cur] === s) activate(s); }, 120);
    counter.textContent = `${pad(i + 1)} / ${pad(slides.length)}`;
    $('#chrome-section').textContent = s.dataset.section || '';
    document.body.classList.toggle('cover', i === 0);
    if (history.replaceState) history.replaceState(null, '', '#present=' + (i + 1));
  }

  function enterPresent(at = 0, fullscreen = false) {
    if (!present) {
      present = true;
      document.body.classList.add('present');
      $$('.live').forEach(unload);
      scale();
    }
    show(at);
    if (fullscreen) toggleFullscreen(true);
    help.classList.remove('hide');
    clearTimeout(helpTimer);
    helpTimer = setTimeout(() => help.classList.add('hide'), 5000);
    window.focus();
  }

  function exitPresent() {
    if (!present) return;
    present = false;
    $$('.live').forEach(unload);
    document.body.classList.remove('present', 'cover');
    slides.forEach(x => { x.classList.remove('active'); x.removeAttribute('aria-hidden'); });
    if (document.fullscreenElement && document.exitFullscreen) document.exitFullscreen().catch(() => {});
    if (history.replaceState) history.replaceState(null, '', location.pathname + location.search);
    const s = slides[cur];
    requestAnimationFrame(() => {
      if (cur > 0) s.scrollIntoView({ block: 'start' }); else window.scrollTo(0, 0);
      $$('.live').forEach(b => { if (b._visible && !b.hasAttribute('data-interactive')) load(b); });
    });
  }

  function toggleFullscreen(on) {
    const want = on == null ? !document.fullscreenElement : on;
    try {
      if (want && !document.fullscreenElement && document.documentElement.requestFullscreen) document.documentElement.requestFullscreen().catch(() => {});
      else if (!want && document.fullscreenElement) document.exitFullscreen().catch(() => {});
    } catch { /* not allowed here */ }
  }

  function currentSlideInDoc() {
    let best = 0;
    slides.forEach((s, i) => { if (s.getBoundingClientRect().top < window.innerHeight * 0.4) best = i; });
    return best;
  }

  function onKey(e) {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const k = e.key;
    const t = e.target;
    if (!present) {
      if (k === 'Escape') { $$('.live.playing').forEach(release); return; }
      if ((k === 'f' || k === 'F') && !(t && /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) { e.preventDefault(); enterPresent(currentSlideInDoc(), true); }
      return;
    }
    if ((k === ' ' || k === 'Enter') && t && (t.tagName === 'BUTTON' || t.tagName === 'A')) return; // let the control work
    switch (k) {
      case 'ArrowRight': case 'ArrowDown': case 'PageDown': case ' ': case 'Enter':
        e.preventDefault(); show(cur + 1); break;
      case 'ArrowLeft': case 'ArrowUp': case 'PageUp': case 'Backspace':
        e.preventDefault(); show(cur - 1); break;
      case 'Home': e.preventDefault(); show(0); break;
      case 'End': e.preventDefault(); show(slides.length - 1); break;
      case 'f': case 'F': e.preventDefault(); toggleFullscreen(); break;
      case 'p': case 'P': {
        e.preventDefault();
        const g = slides[cur].dataset.game;
        if (g) window.open(gameUrl(g), '_blank', 'noopener');
        break;
      }
      case 'Escape': {
        e.preventDefault();
        const playing = slides[cur].querySelector('.live.playing');
        if (playing) release(playing); else exitPresent();
        break;
      }
      default: break;
    }
  }
  document.addEventListener('keydown', onKey);
  window.addEventListener('resize', () => { if (present) scale(); });

  $('#present-btn').addEventListener('click', () => enterPresent(0, true));
  $('#nav-prev').addEventListener('click', () => show(cur - 1));
  $('#nav-next').addEventListener('click', () => show(cur + 1));
  // A click outside a live game hands the keyboard back to the deck.
  document.addEventListener('pointerdown', e => {
    if (e.target.closest('.live')) return;
    $$('.live.playing').forEach(release);
  });
  window.addEventListener('hashchange', () => {
    const m = /^#present(?:=(\d+))?$/.exec(location.hash);
    if (m) enterPresent(m[1] ? +m[1] - 1 : 0);
  });

  // ---------------------------------------------------------------- boot
  $$('.s-art').forEach(s => buildArt(s));
  const m = /^#present(?:=(\d+))?$/.exec(location.hash);
  if (m) enterPresent(m[1] ? +m[1] - 1 : 0);
})();
