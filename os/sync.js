/* ===================================================================
   Sync — cloud account sync. Mirrors the local OS state (filesystem,
   prefs, installed apps, notes, bookmarks) to the signed-in user's
   NimbusNet account so it follows them across devices.

   Strategy: last-write-wins. On sign-in we pull the account's state;
   if the account has none yet, we seed it from whatever's local (so
   guest work is preserved into a brand-new account). Any change marks
   the state dirty and pushes (debounced).
   =================================================================== */
window.Sync = (function () {
  let timer = null, applying = false, status = 'off';
  function setStatus(s) { status = s; document.dispatchEvent(new CustomEvent('nimbus:sync', { detail: { status: s } })); }

  function snapshot() {
    let bookmarks = [];
    try { bookmarks = JSON.parse(localStorage.getItem('nimbus.bookmarks')) || []; } catch (e) {}
    return {
      v: 1,
      fs: FS.root(),
      prefs: OS.prefs(),
      installed: Apps.installedApps ? Apps.installedApps() : [],
      notes: localStorage.getItem('nimbus.notes') || '',
      bookmarks: bookmarks
    };
  }

  function apply(state) {
    if (!state) return;
    applying = true;
    try {
      if (state.fs && FS.replaceRoot) FS.replaceRoot(state.fs);
      if (Array.isArray(state.installed)) localStorage.setItem('nimbus.installed', JSON.stringify(state.installed));
      if (typeof state.notes === 'string') localStorage.setItem('nimbus.notes', state.notes);
      if (Array.isArray(state.bookmarks)) localStorage.setItem('nimbus.bookmarks', JSON.stringify(state.bookmarks));
      if (state.prefs && OS.loadPrefs) OS.loadPrefs(state.prefs);
      if (OS.refreshFiles) OS.refreshFiles();
      document.dispatchEvent(new Event('nimbus:installed')); // rebuild desktop icons
    } catch (e) {}
    setTimeout(() => { applying = false; }, 120);
  }

  async function pull() {
    if (!window.Net || !Net.isAuthed()) { setStatus('off'); return; }
    setStatus('syncing');
    try {
      const r = await Net.getState();
      if (r && r.data) { apply(r.data); if (OS.notify) OS.notify('☁️', 'Synced', 'Your Nimbus is up to date on this device.'); setStatus('synced'); }
      else { push(true); } // first sign-in on this account → seed from local
    } catch (e) { setStatus('offline'); }
  }

  function push(immediate) {
    if (!window.Net || !Net.isAuthed() || applying) { if (!Net || !Net.isAuthed()) setStatus('off'); return; }
    clearTimeout(timer);
    const run = async () => { setStatus('syncing'); try { await Net.putState(snapshot()); setStatus('synced'); } catch (e) { setStatus('offline'); } };
    if (immediate) run(); else timer = setTimeout(run, 2500);
  }

  function markDirty() { if (!applying) push(false); }

  document.addEventListener('nimbus:dirty', markDirty);
  document.addEventListener('nimbus:installed', markDirty);
  document.addEventListener('nimbus:auth', e => { if (e.detail && e.detail.user) { if (navigator.onLine === false) setStatus('offline'); else pull(); } else setStatus('off'); });
  // reflect connectivity ("acts like wi-fi is off")
  if (typeof window !== 'undefined') {
    window.addEventListener('offline', () => { if (window.Net && Net.isAuthed()) setStatus('offline'); });
    window.addEventListener('online', () => { if (window.Net && Net.isAuthed()) pull(); });
  }

  return { pull, push: () => push(true), snapshot, apply, status: () => status };
})();
