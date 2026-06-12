/* ===================================================================
   WM — window manager. Owns the window lifecycle: open, focus,
   drag, resize, minimize, maximize, close. Apps just supply a body.
   =================================================================== */
window.WM = (function () {
  const layer = () => document.getElementById('windows');
  let z = 100;
  let cascade = 0;
  const wins = {};          // id -> win record
  let activeId = null;

  function focus(id) {
    const w = wins[id];
    if (!w) return;
    z += 1;
    w.el.style.zIndex = z;
    Object.values(wins).forEach(o => o.el.classList.toggle('inactive', o.id !== id));
    activeId = id;
    const nameEl = document.getElementById('mb-appname');
    if (nameEl) nameEl.textContent = w.appTitle || w.title;
    document.dispatchEvent(new CustomEvent('wm:focus', { detail: { id, appId: w.appId } }));
  }

  function activeApp() { return activeId && wins[activeId] ? wins[activeId].appId : null; }

  function open(opts) {
    // opts: { appId, title, icon, width, height, build(body, win), onClose }
    const id = 'w' + Math.random().toString(36).slice(2, 8);
    const el = document.createElement('div');
    el.className = 'win';
    el.dataset.id = id;

    const w = Math.min(opts.width || 480, window.innerWidth - 40);
    const h = Math.min(opts.height || 320, window.innerHeight - 80);
    const x = 60 + (cascade % 6) * 28;
    const y = 50 + (cascade % 6) * 26;
    cascade++;
    el.style.left = x + 'px';
    el.style.top = y + 'px';
    el.style.width = w + 'px';
    el.style.height = h + 'px';

    el.innerHTML = `
      <div class="titlebar">
        <div class="traffic">
          <div class="tl close"><span>×</span></div>
          <div class="tl min"><span>−</span></div>
          <div class="tl max"><span>+</span></div>
        </div>
        <div class="win-title"><span class="win-ico">${opts.icon || ''}</span> ${esc(opts.title || '')}</div>
        <div style="width:54px"></div>
      </div>
      <div class="win-body"></div>
      <div class="resize-h"></div>`;
    layer().appendChild(el);

    const rec = {
      id, el, appId: opts.appId, title: opts.title, appTitle: opts.appTitle || opts.title,
      onClose: opts.onClose, minimized: false, maximized: false, prevRect: null
    };
    wins[id] = rec;

    const body = el.querySelector('.win-body');
    if (opts.build) opts.build(body, rec);

    // --- focus on any interaction ---
    el.addEventListener('mousedown', () => focus(id));

    // --- traffic lights ---
    el.querySelector('.tl.close').addEventListener('click', e => { e.stopPropagation(); requestClose(id); });
    el.querySelector('.tl.min').addEventListener('click', e => { e.stopPropagation(); minimize(id); });
    el.querySelector('.tl.max').addEventListener('click', e => { e.stopPropagation(); toggleMax(id); });

    // --- drag ---
    const tb = el.querySelector('.titlebar');
    tb.addEventListener('mousedown', startDrag);
    tb.addEventListener('dblclick', () => toggleMax(id));
    function startDrag(e) {
      if (e.target.closest('.traffic')) return;
      if (rec.maximized) { toggleMax(id); } // un-snap on drag
      const sx = e.clientX, sy = e.clientY;
      const ox = el.offsetLeft, oy = el.offsetTop;
      document.body.style.userSelect = 'none';
      let zone = null;
      function move(ev) {
        let nx = ox + ev.clientX - sx;
        let ny = Math.max(28, oy + ev.clientY - sy);
        el.style.left = nx + 'px';
        el.style.top = ny + 'px';
        zone = snapZone(ev.clientX, ev.clientY);
        showSnap(zone);
      }
      function up() {
        document.removeEventListener('mousemove', move);
        document.removeEventListener('mouseup', up);
        document.body.style.userSelect = '';
        hideSnap();
        if (zone) applySnap(rec, zone);
      }
      document.addEventListener('mousemove', move);
      document.addEventListener('mouseup', up);
    }

    // --- resize ---
    const rh = el.querySelector('.resize-h');
    rh.addEventListener('mousedown', e => {
      e.stopPropagation();
      if (rec.maximized) return;
      const sx = e.clientX, sy = e.clientY;
      const ow = el.offsetWidth, oh = el.offsetHeight;
      document.body.style.userSelect = 'none';
      function move(ev) {
        el.style.width = Math.max(240, ow + ev.clientX - sx) + 'px';
        el.style.height = Math.max(140, oh + ev.clientY - sy) + 'px';
      }
      function up() {
        document.removeEventListener('mousemove', move);
        document.removeEventListener('mouseup', up);
        document.body.style.userSelect = '';
      }
      document.addEventListener('mousemove', move);
      document.addEventListener('mouseup', up);
    });

    focus(id);
    document.dispatchEvent(new CustomEvent('wm:open', { detail: { id, appId: opts.appId } }));
    return rec;
  }

  // close, but let the app veto (e.g. unsaved-changes prompt) via confirmClose
  async function requestClose(id) {
    const w = wins[id];
    if (!w) return;
    if (w.confirmClose) { let ok = true; try { ok = await w.confirmClose(w); } catch (e) {} if (!ok) return; }
    close(id);
  }

  function close(id) {
    const w = wins[id];
    if (!w) return;
    if (w.onClose) try { w.onClose(w); } catch (e) {}
    w.el.classList.add('closing');
    setTimeout(() => {
      w.el.remove();
      delete wins[id];
      if (activeId === id) activeId = null;
      document.dispatchEvent(new CustomEvent('wm:close', { detail: { id, appId: w.appId } }));
    }, 130);
  }

  function minimize(id) {
    const w = wins[id];
    if (!w || w.minimized) return;
    w.el.classList.add('minimizing');
    setTimeout(() => {
      w.el.style.display = 'none';
      w.el.classList.remove('minimizing');
      w.minimized = true;
      document.dispatchEvent(new CustomEvent('wm:minimize', { detail: { id, appId: w.appId } }));
    }, 270);
  }

  function restore(id) {
    const w = wins[id];
    if (!w) return;
    w.el.style.display = '';
    w.minimized = false;
    focus(id);
  }

  function toggleMax(id) {
    const w = wins[id];
    if (!w) return;
    const el = w.el;
    if (w.maximized) {
      const r = w.prevRect;
      el.style.left = r.x; el.style.top = r.y; el.style.width = r.w; el.style.height = r.h;
      w.maximized = false;
    } else {
      w.prevRect = { x: el.style.left, y: el.style.top, w: el.style.width, h: el.style.height };
      el.style.left = '4px'; el.style.top = '32px';
      el.style.width = (window.innerWidth - 8) + 'px';
      el.style.height = (window.innerHeight - 88) + 'px';
      w.maximized = true;
    }
  }

  // --- snapping ---------------------------------------------------
  const TOP = 28, BAR = 80; // menu bar height, dock reserve
  function rects() {
    const W = window.innerWidth, H = window.innerHeight;
    const usableH = H - TOP - BAR;
    return {
      max:   { x: 4, y: TOP + 4, w: W - 8, h: usableH },
      left:  { x: 4, y: TOP + 4, w: W / 2 - 6, h: usableH },
      right: { x: W / 2 + 2, y: TOP + 4, w: W / 2 - 6, h: usableH },
      tl: { x: 4, y: TOP + 4, w: W / 2 - 6, h: usableH / 2 - 2 },
      tr: { x: W / 2 + 2, y: TOP + 4, w: W / 2 - 6, h: usableH / 2 - 2 },
      bl: { x: 4, y: TOP + usableH / 2 + 4, w: W / 2 - 6, h: usableH / 2 - 2 },
      br: { x: W / 2 + 2, y: TOP + usableH / 2 + 4, w: W / 2 - 6, h: usableH / 2 - 2 }
    };
  }
  function snapZone(x, y) {
    const W = window.innerWidth, H = window.innerHeight, M = 30;
    const top = y < TOP + 6, left = x < M, right = x > W - M, bottom = y > H - M;
    if (top) return 'max';
    if (left && y < (H + TOP) / 2) return 'tl';
    if (left && y >= (H + TOP) / 2) return 'bl';
    if (right && y < (H + TOP) / 2) return 'tr';
    if (right && y >= (H + TOP) / 2) return 'br';
    if (left) return 'left';
    if (right) return 'right';
    return null;
  }
  function showSnap(zone) {
    const p = document.getElementById('snap-preview');
    if (!zone) return p.classList.add('hidden');
    const r = rects()[zone];
    p.classList.remove('hidden');
    p.style.left = r.x + 'px'; p.style.top = r.y + 'px';
    p.style.width = r.w + 'px'; p.style.height = r.h + 'px';
  }
  function hideSnap() { document.getElementById('snap-preview').classList.add('hidden'); }
  function applySnap(rec, zone) {
    const r = rects()[zone];
    if (!rec.prevRect) rec.prevRect = { x: rec.el.style.left, y: rec.el.style.top, w: rec.el.style.width, h: rec.el.style.height };
    rec.el.style.transition = 'left .14s ease, top .14s ease, width .14s ease, height .14s ease';
    rec.el.style.left = r.x + 'px'; rec.el.style.top = r.y + 'px';
    rec.el.style.width = r.w + 'px'; rec.el.style.height = r.h + 'px';
    rec.maximized = (zone === 'max');
    setTimeout(() => { rec.el.style.transition = ''; }, 160);
  }

  // toggle from dock: if an app window exists, restore/minimize it; else null
  function windowsOf(appId) { return Object.values(wins).filter(w => w.appId === appId); }

  function esc(s) { return String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }

  return { open, close, requestClose, focus, minimize, restore, toggleMax, windowsOf, activeApp, wins: () => wins };
})();
