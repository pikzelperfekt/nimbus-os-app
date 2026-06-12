/* Standalone NimbusNet browser logic (no OS dependencies). Uses Net (net.js).
   Powers the hosted browser page and the macOS Electron app. */
(function () {
  const frame = document.getElementById('frame');
  const portal = document.getElementById('portal');
  const urlEl = document.getElementById('url');
  const acctEl = document.getElementById('acct');
  const modal = document.getElementById('modal');
  const HOME = 'home://';
  let hist = [HOME], idx = 0, allSites = null;
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  const cur = () => hist[idx];
  function navigate(u) { hist = hist.slice(0, idx + 1); hist.push(u); idx = hist.length - 1; render(); }
  function asDomain(s) {
    s = String(s || '').toLowerCase().replace(/^nim:\/\//, '').trim();
    const m = s.match(/^([a-z0-9](?:[a-z0-9-]{0,28}[a-z0-9])?)\.([a-z]+)$/);
    return (m && Net.TLDS.includes(m[2])) ? s : null;
  }
  function go(input) { const s = (input || '').trim(); const d = asDomain(s); navigate(d ? 'nim://' + d : 'home://' + encodeURIComponent(s)); }

  function render() {
    const u = cur(), isHome = u.startsWith('home://'), isNim = u.startsWith('nim://');
    urlEl.value = isNim ? u.slice(6) : (isHome ? decodeURIComponent(u.slice(7)) : '');
    portal.style.display = isHome ? '' : 'none';
    frame.style.display = isHome ? 'none' : '';
    document.querySelector('[data-a=back]').disabled = idx <= 0;
    document.querySelector('[data-a=fwd]').disabled = idx >= hist.length - 1;
    if (isHome) renderPortal(decodeURIComponent(u.slice(7)));
    else if (isNim) loadNim(u.slice(6));
    document.title = isNim ? u.slice(6) : 'NimbusNet';
  }

  function loadNim(domain) {
    frame.removeAttribute('src');
    frame.srcdoc = `<body style="font:15px system-ui;color:#8a90a6;text-align:center;padding:60px">Loading ${esc(domain)}…</body>`;
    Net.getSite(domain).then(site => {
      if (cur() !== 'nim://' + domain) return;
      frame.srcdoc = site.html; document.title = site.title || domain;
    }).catch(e => {
      frame.srcdoc = `<body style="font:15px system-ui;color:#555;text-align:center;padding:56px">
        <div style="font-size:42px">🌐</div><h2 style="margin:10px 0 4px">${esc(domain)}</h2>
        <p>${esc(e.message)}</p><p style="color:#9aa0b8">Nobody has claimed <b>${esc(domain)}</b> yet.</p></body>`;
    });
  }

  function renderPortal(query) {
    portal.innerHTML = `<div class="portal-inner">
      <div class="logo">◈ NimbusNet</div><div class="tag">your own internet</div>
      <input id="search" class="search" placeholder="Search NimbusNet, or type a domain like cool.nim" spellcheck="false" value="${esc(query || '')}">
      <div class="net-h"><span>🌐 ${query ? 'Results' : 'Recently published'}</span><span class="count"></span></div>
      <div class="net-list"><span class="muted">Loading…</span></div>
      <div class="tip">Endings on NimbusNet: ${Net.TLDS.map(t => '<b>.' + t + '</b>').join(' ')}</div>
    </div>`;
    const si = portal.querySelector('#search');
    si.oninput = () => paint(allSites || [], si.value);
    si.onkeydown = e => { if (e.key === 'Enter' && asDomain(si.value.trim())) go(si.value); };
    setTimeout(() => si.focus(), 20);
    function paint(sites, q) {
      const list = portal.querySelector('.net-list'), cnt = portal.querySelector('.count');
      if (!list) return;
      const ql = (q || '').toLowerCase().trim();
      const f = ql ? sites.filter(s => s.domain.includes(ql) || (s.title || '').toLowerCase().includes(ql) || (s.owner || '').toLowerCase().includes(ql)) : sites;
      if (cnt) cnt.textContent = f.length + ' site' + (f.length === 1 ? '' : 's');
      if (!f.length) { list.innerHTML = `<span class="muted">${ql ? 'No sites match “' + esc(q) + '”.' : 'No sites yet.'}</span>`; return; }
      list.innerHTML = f.map(s => `<div class="net-item" data-nim="${esc(s.domain)}"><b>${esc(s.domain)}</b><span class="t">${esc(s.title)}</span><span class="muted m">${esc(s.owner)} · ${s.views || 0}👁</span></div>`).join('');
      list.querySelectorAll('[data-nim]').forEach(it => it.onclick = () => go(it.dataset.nim));
    }
    Net.directory().then(s => { allSites = s; paint(s, query); })
      .catch(() => { const l = portal.querySelector('.net-list'); if (l) l.innerHTML = '<span class="muted">NimbusNet is offline right now.</span>'; });
  }

  // ---- login modal ----
  function updateAcct() { acctEl.textContent = Net.isAuthed() ? '👤 @' + Net.user().username : 'Sign in'; }
  function openLogin() {
    if (Net.isAuthed()) {
      modal.classList.remove('hidden');
      modal.innerHTML = `<div class="m-card"><div class="m-brand">@${esc(Net.user().username)}</div>
        <button class="m-btn" data-a="close">Done</button>
        <div class="m-links"><a data-a="logout">Sign out</a></div></div>`;
      modal.querySelector('[data-a=close]').onclick = () => modal.classList.add('hidden');
      modal.querySelector('[data-a=logout]').onclick = async () => { await Net.logout(); modal.classList.add('hidden'); };
      return;
    }
    let mode = 'login';
    modal.classList.remove('hidden');
    (function form() {
      modal.innerHTML = `<div class="m-card">
        <div class="m-brand">◈ NimbusNet</div>
        <div class="m-tabs"><button class="${mode === 'login' ? 'on' : ''}" data-m="login">Sign in</button><button class="${mode === 'signup' ? 'on' : ''}" data-m="signup">Create account</button></div>
        <input class="m-field" data-f="username" placeholder="Username" autocapitalize="off" spellcheck="false">
        ${mode === 'signup' ? '<input class="m-field" data-f="display" placeholder="Display name (optional)">' : ''}
        <input class="m-field" type="password" data-f="password" placeholder="Password">
        <div class="m-err"></div>
        <button class="m-btn" data-a="go">${mode === 'login' ? 'Sign in' : 'Create account'}</button>
        <div class="m-links"><a data-a="cancel">Cancel</a></div>
      </div>`;
      modal.querySelectorAll('[data-m]').forEach(b => b.onclick = () => { mode = b.dataset.m; form(); });
      const err = modal.querySelector('.m-err');
      const val = f => { const e = modal.querySelector(`[data-f="${f}"]`); return e ? e.value : ''; };
      async function submit() {
        err.textContent = '';
        try {
          if (mode === 'login') await Net.login(val('username'), val('password'));
          else await Net.signup(val('username'), val('password'), val('display'));
          modal.classList.add('hidden');
        } catch (e) { err.textContent = e.message; }
      }
      modal.querySelector('[data-a=go]').onclick = submit;
      modal.querySelectorAll('.m-field').forEach(i => i.addEventListener('keydown', e => { if (e.key === 'Enter') submit(); }));
      modal.querySelector('[data-a=cancel]').onclick = () => modal.classList.add('hidden');
      setTimeout(() => { const f = modal.querySelector('[data-f=username]'); if (f) f.focus(); }, 20);
    })();
  }

  document.querySelector('[data-a=back]').onclick = () => { if (idx > 0) { idx--; render(); } };
  document.querySelector('[data-a=fwd]').onclick = () => { if (idx < hist.length - 1) { idx++; render(); } };
  document.querySelector('[data-a=reload]').onclick = () => render();
  document.querySelector('[data-a=home]').onclick = () => navigate(HOME);
  urlEl.addEventListener('keydown', e => { if (e.key === 'Enter') go(urlEl.value); });
  acctEl.onclick = openLogin;
  modal.addEventListener('click', e => { if (e.target === modal) modal.classList.add('hidden'); });
  document.addEventListener('nimbus:auth', updateAcct);

  Net.restore().then(updateAcct);
  updateAcct();
  render();
})();
