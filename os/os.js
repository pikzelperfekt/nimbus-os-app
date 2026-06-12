/* ===================================================================
   OS — boots the desktop and wires up the shell:
   boot screen, menu bar, dock, desktop icons, prefs (theme/wallpaper).
   =================================================================== */
window.OS = (function () {
  const wallpapers = {
    aurora: {
      thumb: 'radial-gradient(circle at 30% 30%,#2d3a6b,transparent 60%),linear-gradient(135deg,#0f1226,#1a1f3d)',
      css: `radial-gradient(circle at 20% 20%, #2d3a6b 0%, transparent 55%),
            radial-gradient(circle at 80% 70%, #6b2d5f 0%, transparent 55%),
            linear-gradient(135deg, #0f1226 0%, #1a1f3d 100%)`
    },
    sunset: {
      thumb: 'linear-gradient(135deg,#ff7e5f,#feb47b,#ffd194)',
      css: 'linear-gradient(160deg, #2b1055 0%, #7597de 100%), linear-gradient(135deg,#ff6e7f88,#bfe9ff44)'
    },
    forest: {
      thumb: 'linear-gradient(135deg,#134e5e,#71b280)',
      css: 'linear-gradient(135deg,#0b3d2e 0%,#134e5e 45%,#71b280 100%)'
    },
    mono: {
      thumb: 'linear-gradient(135deg,#232526,#414345)',
      css: 'linear-gradient(135deg,#16181d 0%,#2b2f38 60%,#3a3f4b 100%)'
    },
    bloom: {
      thumb: 'linear-gradient(135deg,#c33764,#1d2671)',
      css: 'radial-gradient(circle at 70% 20%,#c33764aa,transparent 55%),linear-gradient(135deg,#1d2671,#371a52)'
    },
    daylight: {
      thumb: 'linear-gradient(135deg,#a1c4fd,#c2e9fb)',
      css: 'linear-gradient(160deg,#a1c4fd 0%,#c2e9fb 100%)'
    }
  };
  const accents = { blue: '#3b82f6', purple: '#8b5cf6', pink: '#ec4899', green: '#22c55e', orange: '#f97316', red: '#ef4444' };

  const PKEY = 'nimbus.prefs.v1';
  const DEFAULTS = {
    theme: 'dark', wallpaper: 'aurora', accent: 'blue', customAccent: '', customWall: '',
    dockPos: 'bottom', dockSize: 46, dockMagnify: true, dockAutohide: false,
    sound: true, volume: 0.5, clock24: false, clockSeconds: false,
    brightness: 100, dnd: false, reduceMotion: false, wifi: true, bluetooth: true,
    assoc: { txt: 'editor', md: 'code', js: 'code', json: 'code', css: 'code', html: 'code', cfg: 'editor', log: 'editor', png: 'viewer', jpg: 'viewer', jpeg: 'viewer', gif: 'viewer', svg: 'viewer' },
    restoreWindows: true
  };
  let prefs = {};
  try { prefs = JSON.parse(localStorage.getItem(PKEY)) || {}; } catch (e) {}
  prefs = Object.assign({}, DEFAULTS, prefs);
  function savePrefs() { localStorage.setItem(PKEY, JSON.stringify(prefs)); document.dispatchEvent(new Event('nimbus:dirty')); }
  // replace prefs wholesale (cloud sync) and re-apply the desktop
  function loadPrefs(obj) {
    prefs = Object.assign({}, DEFAULTS, obj || {});
    localStorage.setItem(PKEY, JSON.stringify(prefs));
    applyPrefs(); startClock(); updateTray(); buildDock(); buildIcons();
  }

  function applyPrefs() {
    document.body.classList.toggle('light', prefs.theme === 'light');
    document.body.classList.toggle('reduce-motion', !!prefs.reduceMotion);

    // wallpaper — named gradient or a custom solid color
    const desk = document.getElementById('desktop');
    if (prefs.wallpaper === 'custom' && prefs.customWall) desk.style.background = prefs.customWall;
    else desk.style.background = (wallpapers[prefs.wallpaper] || wallpapers.aurora).css;
    desk.style.backgroundSize = 'cover';

    // accent — named or custom hex
    const ac = prefs.accent === 'custom' && prefs.customAccent ? prefs.customAccent : (accents[prefs.accent] || accents.blue);
    document.documentElement.style.setProperty('--accent', ac);

    // dock
    const dock = document.getElementById('dock');
    if (dock) {
      dock.className = '';
      dock.classList.add('dock-' + (prefs.dockPos || 'bottom'));
      dock.classList.toggle('no-mag', !prefs.dockMagnify);
      dock.classList.toggle('autohide', !!prefs.dockAutohide);
      document.documentElement.style.setProperty('--dock-size', (prefs.dockSize || 46) + 'px');
    }

    // brightness dim overlay
    const dim = document.getElementById('brightness');
    if (dim) dim.style.opacity = (1 - (prefs.brightness == null ? 100 : prefs.brightness) / 100) * 0.7;

    // sound engine
    if (window.Sound) { Sound.setEnabled(prefs.sound !== false); Sound.setVolume(prefs.volume == null ? 0.5 : prefs.volume); }
  }

  // dock + desktop layout
  const dockApps = ['files', 'browser', 'people', 'studio', 'appstore', 'terminal', 'code', 'editor', 'notes', 'paint', 'photos', 'music', 'tunes', 'mines', 'calendar', 'calc', 'activity', 'settings'];
  const desktopApps = ['about', 'browser', 'people', 'studio', 'appstore', 'files'];

  // the dock's app list — user-customized (prefs.dock) or the default
  function dockList() {
    const v = (prefs.dock && prefs.dock.length) ? prefs.dock.filter(id => Apps.reg[id]) : null;
    return (v && v.length) ? v : dockApps.slice();
  }
  function setDock(list) { prefs.dock = list.slice(); savePrefs(); buildDock(); }
  let dockJustDragged = false;

  function launchFromDock(id, item) {
    const open = WM.windowsOf(id);
    if (open.length) {
      const w = open[0];
      if (w.minimized) WM.restore(w.id);
      else if (WM.activeApp() === id) WM.minimize(w.id);
      else WM.focus(w.id);
    } else {
      item.classList.add('bounce');
      setTimeout(() => item.classList.remove('bounce'), 560);
      Apps.launch(id);
    }
  }

  function buildDock() {
    const dock = document.getElementById('dock');
    dock.innerHTML = '';
    dockList().forEach(id => {
      const d = Apps.reg[id]; if (!d) return;
      const item = document.createElement('div');
      item.className = 'dock-item';
      item.dataset.app = id;
      item.title = d.title;
      item.innerHTML = `${d.icon}<span class="dot"></span>`;
      item.addEventListener('click', () => { if (dockJustDragged) return; launchFromDock(id, item); });
      item.addEventListener('contextmenu', e => {
        e.preventDefault();
        contextMenu(e.clientX, e.clientY, [
          { label: 'Open', fn: () => launchFromDock(id, item) },
          { label: 'Remove from Dock', fn: () => setDock(dockList().filter(x => x !== id)) }
        ]);
      });
      wireDockDrag(item);
      dock.appendChild(item);
    });
    refreshDockState();
  }

  // drag a dock item to reorder it
  function wireDockDrag(item) {
    item.addEventListener('mousedown', e => {
      if (e.button !== 0) return;
      const start = { x: e.clientX, y: e.clientY };
      let dragging = false;
      const dock = document.getElementById('dock');
      const horizontal = !dock.classList.contains('dock-left') && !dock.classList.contains('dock-right');
      const move = ev => {
        if (!dragging && Math.hypot(ev.clientX - start.x, ev.clientY - start.y) > 6) {
          dragging = true; dock.classList.add('reordering'); item.classList.add('dragging');
        }
        if (!dragging) return;
        const sibs = [...dock.querySelectorAll('.dock-item')].filter(s => s !== item);
        const pos = horizontal ? ev.clientX : ev.clientY;
        let placed = false;
        for (const s of sibs) {
          const r = s.getBoundingClientRect();
          const mid = horizontal ? (r.left + r.right) / 2 : (r.top + r.bottom) / 2;
          if (pos < mid) { dock.insertBefore(item, s); placed = true; break; }
        }
        if (!placed) dock.appendChild(item);
      };
      const up = () => {
        document.removeEventListener('mousemove', move);
        document.removeEventListener('mouseup', up);
        if (dragging) {
          dock.classList.remove('reordering'); item.classList.remove('dragging');
          dockJustDragged = true; setTimeout(() => { dockJustDragged = false; }, 60);
          setDock([...dock.querySelectorAll('.dock-item')].map(el => el.dataset.app));
        }
      };
      document.addEventListener('mousemove', move);
      document.addEventListener('mouseup', up);
    });
  }

  function refreshDockState() {
    document.querySelectorAll('.dock-item').forEach(item => {
      item.classList.toggle('running', WM.windowsOf(item.dataset.app).length > 0);
    });
  }

  function buildIcons() {
    const wrap = document.getElementById('icons');
    wrap.innerHTML = '';
    // app shortcuts
    desktopApps.forEach(id => {
      const d = Apps.reg[id];
      const ic = document.createElement('div');
      ic.className = 'desk-icon';
      ic.innerHTML = `<div class="gly">${d.icon}</div><div class="lbl">${d.title}</div>`;
      ic.addEventListener('click', () => {
        wrap.querySelectorAll('.sel').forEach(s => s.classList.remove('sel'));
        ic.classList.add('sel');
      });
      ic.addEventListener('dblclick', () => Apps.launch(id));
      ic.addEventListener('contextmenu', e => {
        e.preventDefault();
        const inDock = dockList().includes(id);
        contextMenu(e.clientX, e.clientY, [
          { label: 'Open', fn: () => Apps.launch(id) },
          inDock
            ? { label: 'Remove from Dock', fn: () => setDock(dockList().filter(x => x !== id)) }
            : { label: 'Add to Dock', fn: () => setDock(dockList().concat(id)) }
        ]);
      });
      wrap.appendChild(ic);
    });
    // installed third-party apps
    (Apps.installedApps ? Apps.installedApps() : []).forEach(a => {
      const ic = document.createElement('div');
      ic.className = 'desk-icon';
      ic.innerHTML = `<div class="gly">${a.icon || '📦'}</div><div class="lbl">${a.name}</div>`;
      ic.addEventListener('click', () => { wrap.querySelectorAll('.sel').forEach(s => s.classList.remove('sel')); ic.classList.add('sel'); });
      ic.addEventListener('dblclick', () => Apps.runUserApp(a.id));
      wrap.appendChild(ic);
    });
    // real files living on the Desktop
    (FS.list('/Desktop') || []).forEach(it => {
      const full = '/Desktop/' + it.name;
      const isImg = /\.(png|jpg|jpeg|gif|svg)$/i.test(it.name);
      const gly = it.type === 'dir' ? '📂' : isImg ? '🖼️' : it.name.endsWith('.md') ? '📝' : '📄';
      const ic = document.createElement('div');
      ic.className = 'desk-icon';
      ic.innerHTML = `<div class="gly">${gly}</div><div class="lbl">${escH(it.name)}</div>`;
      ic.draggable = true;
      ic.addEventListener('dragstart', e => { window.__nimDrag = { path: full, name: it.name }; e.dataTransfer.effectAllowed = 'move'; });
      ic.addEventListener('click', () => { wrap.querySelectorAll('.sel').forEach(s => s.classList.remove('sel')); ic.classList.add('sel'); });
      ic.addEventListener('dblclick', () => {
        if (it.type === 'dir') Apps.launch('files', full);
        else openFile(full);
      });
      if (it.type === 'dir') {
        ic.addEventListener('dragover', e => { if (window.__nimDrag) { e.preventDefault(); ic.classList.add('drop-target'); } });
        ic.addEventListener('dragleave', () => ic.classList.remove('drop-target'));
        ic.addEventListener('drop', e => { e.preventDefault(); ic.classList.remove('drop-target'); const d = window.__nimDrag; window.__nimDrag = null; if (d && d.path !== full && d.path.replace(/\/[^/]+$/, '') !== full) { FS.mv(d.path, FS.freeName(full, d.name)); buildIcons(); refreshFiles(); } });
      }
      wrap.appendChild(ic);
    });
    // Trash
    const trashItems = (FS.list('/Trash') || []).length;
    const trash = document.createElement('div');
    trash.className = 'desk-icon';
    trash.innerHTML = `<div class="gly">${trashItems ? '🗑️' : '🗑'}</div><div class="lbl">Trash</div>`;
    trash.addEventListener('dblclick', () => Apps.launch('files', '/Trash'));
    trash.addEventListener('dragover', e => { if (window.__nimDrag) { e.preventDefault(); trash.classList.add('drop-target'); } });
    trash.addEventListener('dragleave', () => trash.classList.remove('drop-target'));
    trash.addEventListener('drop', e => { e.preventDefault(); trash.classList.remove('drop-target'); const d = window.__nimDrag; window.__nimDrag = null; if (d) { FS.trash(d.path); if (window.Sound) Sound.play('trash'); buildIcons(); refreshFiles(); } });
    wrap.appendChild(trash);
  }
  function escH(s) { return String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }
  document.addEventListener('nimbus:installed', () => buildIcons());

  // ---- menu bar clock ----
  function startClock() {
    const el = document.getElementById('mb-clock');
    function tick() {
      const opts = { hour: '2-digit', minute: '2-digit', hour12: !prefs.clock24 };
      if (prefs.clockSeconds) opts.second = '2-digit';
      el.textContent = new Date().toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })
        + '  ' + new Date().toLocaleTimeString([], opts);
    }
    tick(); setInterval(tick, prefs.clockSeconds ? 1000 : 1000 * 5);
    el.style.cursor = 'pointer';
    el.onclick = e => { e.stopPropagation(); toggleCalendarPop(); };
  }

  // little calendar popover under the menu-bar clock
  function toggleCalendarPop() {
    const pop = document.getElementById('menu-pop');
    if (!pop.classList.contains('hidden') && pop.dataset.cur === 'cal') return closeMenu();
    pop.dataset.cur = 'cal';
    const d = new Date();
    const MON = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    const first = new Date(d.getFullYear(), d.getMonth(), 1).getDay();
    const days = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
    let cells = '';
    for (let i = 0; i < first; i++) cells += '<span class="cp-c"></span>';
    for (let n = 1; n <= days; n++) cells += `<span class="cp-c ${n === d.getDate() ? 'today' : ''}">${n}</span>`;
    pop.innerHTML = `<div class="cal-pop"><div class="cp-h">${MON[d.getMonth()]} ${d.getFullYear()}</div>
      <div class="cp-dow">${['S', 'M', 'T', 'W', 'T', 'F', 'S'].map(x => `<span>${x}</span>`).join('')}</div>
      <div class="cp-grid">${cells}</div></div>`;
    pop.classList.remove('hidden');
    pop.style.right = '8px'; pop.style.left = 'auto'; pop.style.top = '26px';
  }

  // ---- Control Center ----
  function toggleControlCenter() {
    const cc = document.getElementById('control-center');
    if (!cc.classList.contains('hidden')) { cc.classList.add('hidden'); return; }
    renderControlCenter();
    cc.classList.remove('hidden');
  }
  function renderControlCenter() {
    const cc = document.getElementById('control-center');
    const tile = (key, on, icon, label) =>
      `<button class="cc-tile ${on ? 'on' : ''}" data-cc="${key}"><span class="cc-ic">${icon}</span><span class="cc-lbl">${label}</span></button>`;
    cc.innerHTML = `
      <div class="cc-grid">
        ${tile('wifi', prefs.wifi, '📶', prefs.wifi ? 'Wi-Fi On' : 'Wi-Fi Off')}
        ${tile('bluetooth', prefs.bluetooth, 'ᛒ', 'Bluetooth')}
        ${tile('theme', prefs.theme === 'dark', '🌙', prefs.theme === 'dark' ? 'Dark' : 'Light')}
        ${tile('dnd', prefs.dnd, '🌙', 'Do Not Disturb')}
      </div>
      <div class="cc-slider"><span>☀️</span><input type="range" min="20" max="100" value="${prefs.brightness}" data-cc-range="brightness"><span class="cc-big">Brightness</span></div>
      <div class="cc-slider"><span>🔊</span><input type="range" min="0" max="100" value="${Math.round(prefs.volume * 100)}" data-cc-range="volume"><span class="cc-big">Volume</span></div>`;
    cc.querySelectorAll('[data-cc]').forEach(b => b.onclick = () => {
      const k = b.dataset.cc;
      if (window.Sound) Sound.play('toggle');
      if (k === 'theme') setTheme(prefs.theme === 'dark' ? 'light' : 'dark');
      else setPref(k, !prefs[k]);
      if (k === 'wifi') updateTray();
      renderControlCenter();
    });
    cc.querySelectorAll('[data-cc-range]').forEach(r => r.oninput = () => {
      const k = r.dataset.ccRange;
      setPref(k, k === 'volume' ? +r.value / 100 : +r.value);
    });
  }
  function updateTray() {
    const w = document.getElementById('mb-wifi');
    if (w) w.textContent = prefs.wifi ? '▮▮▮' : '▱▱▱';
  }

  const menus = {
    apple: [
      { label: 'About This Computer', fn: () => Apps.launch('about') },
      { sep: true },
      { label: 'System Settings…', fn: () => Apps.launch('settings') },
      { label: 'Spotlight Search', fn: () => spotlight() },
      { sep: true },
      { label: 'Lock Screen', fn: () => lock() },
      { label: 'Restart…', fn: () => location.reload() }
    ],
    file: [
      { label: 'New Terminal', fn: () => Apps.launch('terminal') },
      { label: 'New Text File', fn: () => Apps.launch('editor') },
      { label: 'New Finder Window', fn: () => Apps.launch('files') }
    ],
    view: [
      { label: 'Mission Control', fn: () => toggleMission() },
      { label: 'Switch apps: ⌥Tab', dim: true },
      { sep: true },
      { label: 'Dark Mode', fn: () => setTheme('dark') },
      { label: 'Light Mode', fn: () => setTheme('light') }
    ],
    help: [
      { label: 'Open Terminal & type help', fn: () => Apps.launch('terminal') }
    ]
  };

  function openMenu(which, x) {
    const pop = document.getElementById('menu-pop');
    const items = menus[which];
    if (!items) return closeMenu();
    pop.innerHTML = items.map((it, i) => it.sep
      ? '<div class="menu-sep"></div>'
      : `<div class="menu-row" data-i="${i}">${it.label}</div>`).join('');
    pop.classList.remove('hidden');
    pop.style.right = 'auto';
    pop.style.left = Math.min(x, window.innerWidth - 200) + 'px';
    pop.style.top = '26px';
    pop.querySelectorAll('.menu-row').forEach(row => row.onclick = () => {
      const it = items[+row.dataset.i];
      closeMenu();
      if (it.fn) it.fn();
    });
  }
  function closeMenu() { document.getElementById('menu-pop').classList.add('hidden'); }

  function contextMenu(x, y, items) {
    const cm = document.getElementById('context-menu');
    cm.innerHTML = items.map((it, i) => it.sep
      ? '<div class="menu-sep"></div>'
      : `<div class="menu-row" data-i="${i}">${it.label}</div>`).join('');
    cm.classList.remove('hidden');
    cm.style.left = Math.min(x, window.innerWidth - 190) + 'px';
    cm.style.top = Math.min(y, window.innerHeight - 40 - items.length * 30) + 'px';
    cm.querySelectorAll('.menu-row').forEach(row => row.onclick = () => {
      const it = items[+row.dataset.i];
      cm.classList.add('hidden');
      if (it.fn) it.fn();
    });
  }

  function wireMenuBar() {
    document.querySelectorAll('[data-menu]').forEach(el => {
      el.addEventListener('click', e => {
        e.stopPropagation();
        const pop = document.getElementById('menu-pop');
        if (!pop.classList.contains('hidden') && pop.dataset.cur === el.dataset.menu) return closeMenu();
        pop.dataset.cur = el.dataset.menu;
        openMenu(el.dataset.menu, el.getBoundingClientRect().left);
      });
    });
    document.getElementById('mb-search').addEventListener('click', e => { e.stopPropagation(); spotlight(); });
    document.getElementById('mb-control').addEventListener('click', e => { e.stopPropagation(); toggleControlCenter(); });
    document.getElementById('mb-account').addEventListener('click', e => { e.stopPropagation(); Apps.launch('account'); });
    document.addEventListener('click', e => {
      closeMenu();
      document.getElementById('context-menu').classList.add('hidden');
      const cc = document.getElementById('control-center');
      if (!cc.contains(e.target) && e.target.id !== 'mb-control') cc.classList.add('hidden');
    });
    // desktop right-click
    document.getElementById('desktop').addEventListener('contextmenu', e => {
      if (e.target.closest('.win') || e.target.closest('#dock') || e.target.closest('.desk-icon')) return;
      e.preventDefault();
      contextMenu(e.clientX, e.clientY, [
        { label: 'New Folder…', fn: async () => { const n = await UI.prompt({ title: 'New Folder', label: 'Create a folder on the Desktop', value: 'New Folder', ok: 'Create' }); if (n) { FS.mkdir('/Desktop/' + n); refreshFiles(); } } },
        { label: 'Change Wallpaper…', fn: () => Apps.launch('settings') },
        { sep: true },
        { label: 'Open Terminal', fn: () => Apps.launch('terminal') }
      ]);
    });
    // click empty desktop clears icon selection
    document.getElementById('desktop').addEventListener('mousedown', e => {
      if (e.target.id === 'desktop' || e.target.id === 'windows' || e.target.id === 'icons')
        document.querySelectorAll('.desk-icon.sel').forEach(s => s.classList.remove('sel'));
    });
    // drop a dragged file onto empty desktop → move it to /Desktop
    const deskEl = document.getElementById('desktop');
    deskEl.addEventListener('dragover', e => { if (window.__nimDrag && (e.target.id === 'desktop' || e.target.id === 'windows' || e.target.id === 'icons')) e.preventDefault(); });
    deskEl.addEventListener('drop', e => {
      if (e.target.closest('.win') || e.target.closest('.desk-icon')) return;
      e.preventDefault();
      const d = window.__nimDrag; window.__nimDrag = null;
      if (d && d.path.replace(/\/[^/]+$/, '') !== '/Desktop') { FS.mv(d.path, FS.freeName('/Desktop', d.name)); buildIcons(); refreshFiles(); }
    });
  }

  // keep dock indicators synced + play UI sounds
  ['wm:open', 'wm:close', 'wm:minimize', 'wm:focus'].forEach(ev =>
    document.addEventListener(ev, refreshDockState));
  document.addEventListener('wm:open', () => window.Sound && Sound.play('open'));
  document.addEventListener('wm:close', () => window.Sound && Sound.play('close'));
  document.addEventListener('wm:minimize', () => window.Sound && Sound.play('minimize'));

  // NimbusNet account chip in the menu bar
  function updateAccountChip() {
    const el = document.getElementById('mb-account-name');
    if (el) el.textContent = window.Net && Net.isAuthed() ? '@' + Net.user().username : 'Sign in';
  }
  document.addEventListener('nimbus:auth', updateAccountChip);

  // ---- sync status indicator ----
  const SYNC_ICON = { off: '', syncing: '☁︎', synced: '☁️', offline: '⚠️' };
  const SYNC_TIP = { off: 'Not signed in', syncing: 'Syncing…', synced: 'Synced to your account', offline: 'Offline — changes saved locally' };
  function updateSyncChip(s) {
    const el = document.getElementById('mb-sync');
    if (!el) return;
    el.textContent = SYNC_ICON[s] || '';
    el.title = SYNC_TIP[s] || '';
    el.classList.toggle('syncing', s === 'syncing');
  }
  document.addEventListener('nimbus:sync', e => updateSyncChip(e.detail.status));

  // ---- session restore (per-device): reopen the windows you had open ----
  let sessionTimer = null, restoringSession = false;
  function captureSession() {
    if (restoringSession) return;
    const data = Object.values(WM.wins())
      .filter(w => !w.el.classList.contains('closing') && Apps.reg[w.appId])
      .map(w => ({ appId: w.appId, arg: w._launchArg || null,
        x: parseInt(w.el.style.left) || 60, y: parseInt(w.el.style.top) || 50,
        w: parseInt(w.el.style.width) || 480, h: parseInt(w.el.style.height) || 320, min: !!w.minimized }));
    try { localStorage.setItem('nimbus.session', JSON.stringify(data)); } catch (e) {}
  }
  function scheduleCapture() { clearTimeout(sessionTimer); sessionTimer = setTimeout(captureSession, 700); }
  ['wm:open', 'wm:close', 'wm:minimize'].forEach(ev => document.addEventListener(ev, scheduleCapture));
  setInterval(() => { if (Object.values(WM.wins()).length) captureSession(); }, 4000);

  function restoreSession() {
    if (prefs.restoreWindows === false) return;
    let data; try { data = JSON.parse(localStorage.getItem('nimbus.session')) || []; } catch (e) { data = []; }
    if (!data.length) return;
    restoringSession = true;
    data.forEach(s => {
      if (!Apps.reg[s.appId]) return;
      const win = Apps.launch(s.appId, s.arg || undefined);
      if (win && win.el) {
        win.el.style.left = s.x + 'px'; win.el.style.top = s.y + 'px';
        win.el.style.width = s.w + 'px'; win.el.style.height = s.h + 'px';
        if (s.min) WM.minimize(win.id);
      }
    });
    setTimeout(() => { restoringSession = false; }, 600);
  }

  // refresh any window that exposes a _refresh() (Files, Photos) + desktop icons
  function refreshFiles() {
    Object.values(WM.wins()).forEach(w => { if (w._refresh) w._refresh(); });
    buildIcons();
  }

  // ---- preference setters (local, so internal callers can use them) ----
  function setTheme(t) { prefs.theme = t; savePrefs(); applyPrefs(); }
  function setWallpaper(w) { prefs.wallpaper = w; savePrefs(); applyPrefs(); }
  function setAccent(a) { prefs.accent = a; savePrefs(); applyPrefs(); }
  function setAccentColor(hex) { prefs.accent = 'custom'; prefs.customAccent = hex; savePrefs(); applyPrefs(); }
  function setCustomWallpaper(color) { prefs.wallpaper = 'custom'; prefs.customWall = color; savePrefs(); applyPrefs(); }
  function setPref(key, val) {
    prefs[key] = val; savePrefs(); applyPrefs();
    if (key === 'clock24' || key === 'clockSeconds') startClock();
  }
  // open a file with its associated app (file type → default app)
  function openFile(path) {
    const ext = (path.split('.').pop() || '').toLowerCase();
    const isImg = /^(png|jpg|jpeg|gif|svg)$/.test(ext);
    const app = (prefs.assoc && prefs.assoc[ext]) || (isImg ? 'viewer' : 'editor');
    Apps.launch(Apps.reg[app] ? app : (isImg ? 'viewer' : 'editor'), path);
  }
  function setAssoc(ext, app) { prefs.assoc = Object.assign({}, prefs.assoc); prefs.assoc[ext] = app; savePrefs(); }
  function resetPrefs() {
    prefs = Object.assign({}, DEFAULTS); savePrefs(); applyPrefs(); startClock(); updateTray();
    notify('⚙️', 'Settings reset', 'All preferences are back to defaults.');
  }

  // ---- boot ----
  function boot() {
    const steps = ['Mounting filesystem…', 'Starting window server…', 'Loading apps…', 'Almost there…'];
    const fill = document.querySelector('.boot-fill');
    const status = document.querySelector('.boot-status');
    let p = 0, s = 0;
    const iv = setInterval(() => {
      p += 6 + Math.random() * 14;
      if (p > 100) p = 100;
      fill.style.width = p + '%';
      const idx = Math.min(steps.length - 1, Math.floor(p / 26));
      if (idx !== s) { s = idx; status.textContent = steps[idx]; }
      if (p >= 100) {
        clearInterval(iv);
        status.textContent = 'Welcome';
        setTimeout(finishBoot, 350);
      }
    }, 180);
  }

  function finishBoot() {
    document.getElementById('boot').classList.add('fade');
    const desk = document.getElementById('desktop');
    desk.classList.remove('hidden');
    setTimeout(() => document.getElementById('boot').remove(), 650);
    lock();
  }

  // ---- login / lock screen (this IS the NimbusNet sign-in) ----
  let lockIv = null;
  async function lock() {
    const el = document.getElementById('lock');
    el.classList.remove('hidden', 'unlocking');
    const clk = el.querySelector('.lock-clock'), dt = el.querySelector('.lock-date');
    function tick() {
      const d = new Date();
      clk.textContent = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: !prefs.clock24 });
      dt.textContent = d.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' });
    }
    tick(); clearInterval(lockIv); lockIv = setInterval(tick, 1000 * 5);

    const authEl = el.querySelector('.lock-auth');
    authEl.innerHTML = '<div class="lock-connecting">Connecting to NimbusNet…</div>';
    if (window.Net && !Net.isAuthed()) { try { await Net.restore(); } catch (e) {} }
    renderAuth(authEl);
  }

  function renderAuth(authEl) {
    // Already signed in (valid session) → quick "welcome back" unlock
    if (window.Net && Net.isAuthed()) {
      const u = Net.user();
      authEl.innerHTML = `
        <div class="lock-avatar">${esc((u.display || u.username)[0].toUpperCase())}</div>
        <div class="lock-name">${esc(u.display)} ${Net.isAdmin() ? '<span class="acct-badge">🛡️ ADMIN</span>' : ''}</div>
        <div class="lock-handle">@${esc(u.username)}</div>
        <button class="lock-go-btn" data-a="enter">Enter Nimbus →</button>
        <div class="lock-links"><a data-a="switch">Sign out</a> <span>·</span> <a data-a="guest">Continue as guest</a></div>`;
      authEl.querySelector('[data-a="enter"]').onclick = () => unlock();
      authEl.querySelector('[data-a="switch"]').onclick = async () => { await Net.logout(); renderAuth(authEl); };
      authEl.querySelector('[data-a="guest"]').onclick = async () => { if (window.Net) await Net.logout(); unlock(); };
      setTimeout(() => authEl.querySelector('[data-a="enter"]').focus(), 60);
      return;
    }
    // Not signed in → login / create account / guest
    let mode = 'login';
    (function form() {
      authEl.innerHTML = `
        <div class="lock-brand">◈ NimbusNet</div>
        <div class="lock-tabs">
          <button class="${mode === 'login' ? 'on' : ''}" data-m="login">Sign in</button>
          <button class="${mode === 'signup' ? 'on' : ''}" data-m="signup">Create account</button>
        </div>
        <input class="lock-field" data-f="username" placeholder="Username" autocapitalize="off" autocomplete="off" spellcheck="false">
        ${mode === 'signup' ? '<input class="lock-field" data-f="display" placeholder="Display name (optional)">' : ''}
        <input class="lock-field" type="password" data-f="password" placeholder="Password">
        <div class="lock-err"></div>
        <button class="lock-go-btn" data-a="go">${mode === 'login' ? 'Sign in & enter' : 'Create account & enter'}</button>
        <div class="lock-links"><a data-a="guest">Continue as guest →</a></div>
        <div class="lock-fine">The first account created becomes the NimbusNet admin. Passwords are salted &amp; hashed on the server.</div>`;
      authEl.querySelectorAll('[data-m]').forEach(b => b.onclick = () => { mode = b.dataset.m; form(); });
      const err = authEl.querySelector('.lock-err');
      const val = f => { const e = authEl.querySelector(`[data-f="${f}"]`); return e ? e.value : ''; };
      async function submit() {
        err.textContent = '';
        const go = authEl.querySelector('[data-a="go"]'); go.disabled = true;
        try {
          if (window.Sound) Sound.unlock();
          if (mode === 'login') await Net.login(val('username'), val('password'));
          else await Net.signup(val('username'), val('password'), val('display'));
          unlock();
        } catch (e) { err.textContent = e.message; go.disabled = false; }
      }
      authEl.querySelector('[data-a="go"]').onclick = submit;
      authEl.querySelectorAll('.lock-field').forEach(i => i.addEventListener('keydown', e => { if (e.key === 'Enter') submit(); }));
      authEl.querySelector('[data-a="guest"]').onclick = () => unlock();
      setTimeout(() => { const f = authEl.querySelector('[data-f="username"]'); if (f) f.focus(); }, 60);
    })();
  }

  function unlock() {
    const el = document.getElementById('lock');
    if (el.classList.contains('hidden')) return;
    el.classList.add('unlocking');
    clearInterval(lockIv);
    if (window.Sound) { Sound.unlock(); Sound.play('boot'); }
    setTimeout(() => { el.classList.add('hidden'); }, 460);
    updateAccountChip();
    if (!sessionRestored) { sessionRestored = true; setTimeout(restoreSession, 560); }
    const authed = window.Net && Net.isAuthed();
    setTimeout(() => notify('◈', 'Welcome to Nimbus OS',
      authed ? ('Signed in as @' + Net.user().username + (Net.isAdmin() ? ' · admin' : '')) : 'Browsing as guest — sign in anytime to publish.'), 700);
  }
  let sessionRestored = false;

  // ---- notifications ----
  function notify(icon, title, body) {
    if (prefs.dnd) return; // do not disturb
    const wrap = document.getElementById('notifs');
    const card = document.createElement('div');
    card.className = 'notif';
    card.innerHTML = `<div class="ni">${icon || '◈'}</div><div><div class="nt">${esc(title)}</div>${body ? `<div class="nb">${esc(body)}</div>` : ''}</div>`;
    wrap.appendChild(card);
    if (window.Sound) Sound.play('notify');
    // native macOS notification when the app window isn't focused
    if (window.nimbusNative && document.hidden) { try { window.nimbusNative.notify(title, typeof body === 'string' ? body : ''); } catch (e) {} }
    const kill = () => { card.classList.add('out'); setTimeout(() => card.remove(), 320); };
    card.addEventListener('click', kill);
    setTimeout(kill, 5200);
  }

  // ---- spotlight ----
  function spotlight() {
    const sl = document.getElementById('spotlight');
    if (!sl.classList.contains('hidden')) return closeSpotlight();
    sl.classList.remove('hidden');
    const input = sl.querySelector('.sl-input');
    input.value = '';
    renderSpot('');
    setTimeout(() => input.focus(), 30);
  }
  function closeSpotlight() { document.getElementById('spotlight').classList.add('hidden'); }
  let spotItems = [], spotSel = 0;
  function searchFiles(q, path, acc) {
    (FS.list(path) || []).forEach(it => {
      const full = (path === '/' ? '' : path) + '/' + it.name;
      if (it.name.toLowerCase().includes(q)) acc.push({ icon: it.type === 'dir' ? '📂' : '📄', title: it.name, meta: full, type: it.type, path: full });
      if (it.type === 'dir' && acc.length < 8) searchFiles(q, full, acc);
    });
    return acc;
  }
  function renderSpot(q) {
    const res = document.getElementById('spotlight').querySelector('.sl-results');
    q = q.trim().toLowerCase();
    spotItems = [];
    Apps.list().forEach(a => { if (!q || a.title.toLowerCase().includes(q)) spotItems.push({ icon: a.icon, title: a.title, meta: 'Application', kind: 'app', id: a.id }); });
    if (q) searchFiles(q, '/', []).slice(0, 6).forEach(f => spotItems.push({ icon: f.icon, title: f.title, meta: f.meta, kind: 'file', ftype: f.type, path: f.path }));
    spotSel = 0;
    res.innerHTML = spotItems.map((it, i) =>
      `<div class="sl-row ${i === 0 ? 'active' : ''}" data-i="${i}"><span class="si">${it.icon}</span><span>${esc(it.title)}</span><span class="smeta">${esc(it.meta)}</span></div>`).join('');
    res.querySelectorAll('.sl-row').forEach(r => {
      r.onmousemove = () => { spotSel = +r.dataset.i; highlightSpot(); };
      r.onclick = () => runSpot(+r.dataset.i);
    });
  }
  function highlightSpot() {
    document.querySelectorAll('#spotlight .sl-row').forEach(r => r.classList.toggle('active', +r.dataset.i === spotSel));
  }
  function runSpot(i) {
    const it = spotItems[i];
    if (!it) return;
    closeSpotlight();
    if (it.kind === 'app') Apps.launch(it.id);
    else if (it.ftype === 'dir') Apps.launch('files');
    else Apps.launch('editor', it.path);
  }
  function wireSpotlight() {
    const sl = document.getElementById('spotlight');
    const input = sl.querySelector('.sl-input');
    input.addEventListener('input', () => renderSpot(input.value));
    input.addEventListener('keydown', e => {
      if (e.key === 'Escape') closeSpotlight();
      else if (e.key === 'ArrowDown') { spotSel = Math.min(spotItems.length - 1, spotSel + 1); highlightSpot(); e.preventDefault(); }
      else if (e.key === 'ArrowUp') { spotSel = Math.max(0, spotSel - 1); highlightSpot(); e.preventDefault(); }
      else if (e.key === 'Enter') runSpot(spotSel);
    });
    sl.addEventListener('click', e => { if (e.target === sl) closeSpotlight(); });
  }

  // ---- app switcher (⌥-Tab) ----
  let swOpen = false, swList = [], swIdx = 0;
  function switcherList() {
    return Object.values(WM.wins())
      .sort((a, b) => (+b.el.style.zIndex || 0) - (+a.el.style.zIndex || 0));
  }
  function openSwitcher(reverse) {
    swList = switcherList();
    if (swList.length < 2) return;
    const el = document.getElementById('switcher');
    if (!swOpen) { swOpen = true; swIdx = 1; }
    else { swIdx = (swIdx + (reverse ? -1 : 1) + swList.length) % swList.length; }
    el.classList.remove('hidden');
    el.innerHTML = swList.map((w, i) => {
      const d = Apps.reg[w.appId] || {}; const icon = d.icon || '📦';
      const title = (w.appTitle || w.title || w.appId);
      return `<div class="sw-item ${i === swIdx ? 'on' : ''}"><div class="sw-ic">${icon}</div><div class="sw-t">${esc(title)}</div></div>`;
    }).join('');
  }
  function commitSwitcher() {
    document.getElementById('switcher').classList.add('hidden');
    if (swOpen && swList[swIdx]) { const w = swList[swIdx]; w.minimized ? WM.restore(w.id) : WM.focus(w.id); }
    swOpen = false;
  }

  // ---- Mission Control ----
  let missionOpen = false;
  function toggleMission() { missionOpen ? exitMission() : enterMission(); }
  function enterMission() {
    const wins = Object.values(WM.wins()).filter(w => !w.minimized);
    if (!wins.length) return;
    missionOpen = true;
    document.getElementById('mission-backdrop').classList.remove('hidden');
    const W = window.innerWidth, H = window.innerHeight, top = 40, bottom = 96;
    const cols = Math.ceil(Math.sqrt(wins.length));
    const rows = Math.ceil(wins.length / cols);
    const cellW = W / cols, cellH = (H - top - bottom) / rows;
    wins.forEach((w, i) => {
      const el = w.el;
      const cx = (i % cols) * cellW, cy = top + Math.floor(i / cols) * cellH;
      const ww = el.offsetWidth, wh = el.offsetHeight;
      const s = Math.min(cellW * 0.86 / ww, cellH * 0.86 / wh, 1);
      const tx = cx + (cellW - ww * s) / 2, ty = cy + (cellH - wh * s) / 2;
      el.classList.add('mission-win');
      el.style.transformOrigin = '0 0';
      el.style.transform = `translate(${tx - el.offsetLeft}px, ${ty - el.offsetTop}px) scale(${s})`;
      el._missionClick = (ev) => { ev.stopPropagation(); exitMission(); WM.focus(w.id); };
      el.addEventListener('click', el._missionClick, true);
    });
  }
  function exitMission() {
    missionOpen = false;
    document.getElementById('mission-backdrop').classList.add('hidden');
    Object.values(WM.wins()).forEach(w => {
      const el = w.el;
      el.classList.remove('mission-win');
      el.style.transform = '';
      if (el._missionClick) { el.removeEventListener('click', el._missionClick, true); el._missionClick = null; }
    });
  }

  // ---- global keys + hot corner ----
  function wireKeys() {
    document.addEventListener('keydown', e => {
      const locked = !document.getElementById('lock').classList.contains('hidden');
      if ((e.metaKey || e.ctrlKey) && e.code === 'Space') { e.preventDefault(); if (locked) return; spotlight(); }
      else if (e.altKey && e.key === 'Tab') { e.preventDefault(); if (locked) return; openSwitcher(e.shiftKey); }
      else if (e.key === 'Escape') { closeSpotlight(); if (missionOpen) exitMission(); if (swOpen) { document.getElementById('switcher').classList.add('hidden'); swOpen = false; } }
    });
    document.addEventListener('keyup', e => { if (swOpen && (e.key === 'Alt' || !e.altKey)) commitSwitcher(); });
    document.getElementById('mission-backdrop').addEventListener('click', exitMission);
    // hot corner: bottom-right → Mission Control
    let cornerArmed = true;
    document.addEventListener('mousemove', e => {
      const inCorner = e.clientX > window.innerWidth - 4 && e.clientY > window.innerHeight - 4;
      if (inCorner && cornerArmed && !missionOpen) { cornerArmed = false; toggleMission(); }
      else if (!inCorner) cornerArmed = true;
    });
  }

  function init() {
    // running inside the native macOS shell? (loaded with ?native=1)
    if (location.search.indexOf('native') >= 0) document.documentElement.classList.add('native');
    buildDock();
    buildIcons();
    applyPrefs();
    updateTray();
    wireMenuBar();
    wireSpotlight();
    wireKeys();
    startClock();
    updateAccountChip();
    if (window.Net) Net.restore().then(u => { updateAccountChip(); if (u && window.Sync) Sync.pull(); });
    boot();
  }

  function esc(s) { return String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }

  return {
    init, wallpapers, accents,
    prefs: () => prefs,
    contextMenu, refreshFiles, notify, lock, spotlight,
    setTheme, setWallpaper, setAccent, setAccentColor, setCustomWallpaper, setPref, resetPrefs, loadPrefs,
    dockList, setDock, openFile, setAssoc
  };
})();

document.addEventListener('DOMContentLoaded', OS.init);
