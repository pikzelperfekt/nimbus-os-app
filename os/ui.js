/* ===================================================================
   UI — in-OS modal dialogs (replaces native prompt/confirm/alert,
   which are blocked in many embedded/webview contexts).
   Exposes UI.prompt, UI.confirm, UI.alert, UI.filePanel — all
   Promise-based so callers can `await` them.
   =================================================================== */
window.UI = (function () {
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  function layer() {
    let l = document.getElementById('modal-layer');
    if (!l) { l = document.createElement('div'); l.id = 'modal-layer'; l.className = 'hidden'; document.body.appendChild(l); }
    return l;
  }

  // Generic modal frame. content(card, resolve) builds the body and wires buttons.
  function modal(build) {
    return new Promise(resolve => {
      const l = layer();
      const card = document.createElement('div');
      card.className = 'modal';
      l.innerHTML = '';
      l.appendChild(card);
      l.classList.remove('hidden');
      let done = false;
      function close(val) { if (done) return; done = true; l.classList.add('hidden'); l.innerHTML = ''; document.removeEventListener('keydown', onKey); resolve(val); }
      function onKey(e) { if (e.key === 'Escape') close(null); }
      document.addEventListener('keydown', onKey);
      l.onmousedown = e => { if (e.target === l) close(null); };
      build(card, close);
    });
  }

  function prompt(opts) {
    opts = opts || {};
    return modal((card, close) => {
      card.style.width = '340px';
      card.innerHTML = `
        <div class="modal-h">${esc(opts.title || 'Enter a value')}</div>
        <div class="modal-body">
          ${opts.label ? `<div class="muted" style="margin-bottom:8px;font-size:12px">${esc(opts.label)}</div>` : ''}
          <input class="fld dlg-input" value="${esc(opts.value || '')}" placeholder="${esc(opts.placeholder || '')}" spellcheck="false">
        </div>
        <div class="modal-foot">
          <button class="btn ghost dlg-cancel">Cancel</button>
          <button class="btn dlg-ok">${esc(opts.ok || 'OK')}</button>
        </div>`;
      const input = card.querySelector('.dlg-input');
      card.querySelector('.dlg-cancel').onclick = () => close(null);
      card.querySelector('.dlg-ok').onclick = () => close(input.value);
      input.addEventListener('keydown', e => { if (e.key === 'Enter') close(input.value); });
      setTimeout(() => { input.focus(); input.select(); }, 40);
    });
  }

  function confirm(opts) {
    opts = opts || {};
    return modal((card, close) => {
      card.style.width = '340px';
      card.innerHTML = `
        <div class="modal-h">${esc(opts.title || 'Are you sure?')}</div>
        ${opts.body ? `<div class="modal-body"><div class="muted" style="font-size:13px;line-height:1.4">${esc(opts.body)}</div></div>` : '<div style="height:6px"></div>'}
        <div class="modal-foot">
          <button class="btn ghost dlg-cancel">Cancel</button>
          <button class="btn dlg-ok ${opts.danger ? 'danger' : ''}">${esc(opts.ok || 'OK')}</button>
        </div>`;
      card.querySelector('.dlg-cancel').onclick = () => close(false);
      card.querySelector('.dlg-ok').onclick = () => close(true);
      setTimeout(() => card.querySelector('.dlg-ok').focus(), 40);
    });
  }

  function alert(opts) {
    opts = typeof opts === 'string' ? { title: opts } : (opts || {});
    return modal((card, close) => {
      card.style.width = '320px';
      card.innerHTML = `
        <div class="modal-h">${esc(opts.title || '')}</div>
        ${opts.body ? `<div class="modal-body"><div class="muted" style="font-size:13px;line-height:1.4">${esc(opts.body)}</div></div>` : '<div style="height:6px"></div>'}
        <div class="modal-foot"><button class="btn dlg-ok">OK</button></div>`;
      card.querySelector('.dlg-ok').onclick = () => close(true);
      setTimeout(() => card.querySelector('.dlg-ok').focus(), 40);
    });
  }

  // File Save/Open panel — navigate the FS, pick a folder + name (save) or a file (open).
  // opts: { mode:'save'|'open', startPath, filename, title }  ->  resolves full path or null
  function filePanel(opts) {
    opts = opts || {};
    const mode = opts.mode || 'save';
    let cwd = opts.startPath && FS.isDir(opts.startPath) ? opts.startPath : '/';
    return modal((card, close) => {
      card.style.width = '440px';
      card.innerHTML = `
        <div class="modal-h">${esc(opts.title || (mode === 'save' ? 'Save As' : 'Open File'))}</div>
        <div class="dlg-bar">
          <button class="fbtn dlg-up" title="Up">↑</button>
          <span class="dlg-path"></span>
        </div>
        <div class="dlg-list"></div>
        ${mode === 'save' ? `<div class="dlg-namerow"><span class="muted">Name</span><input class="fld dlg-name" value="${esc(opts.filename || 'untitled.txt')}" spellcheck="false"></div>` : ''}
        <div class="modal-foot">
          <button class="btn ghost dlg-cancel">Cancel</button>
          <button class="btn dlg-ok">${mode === 'save' ? 'Save' : 'Open'}</button>
        </div>`;
      const list = card.querySelector('.dlg-list');
      const pathEl = card.querySelector('.dlg-path');
      const nameInput = card.querySelector('.dlg-name');
      let picked = null;

      function full(name) { return (cwd === '/' ? '' : cwd) + '/' + name; }
      function go(p) { cwd = p; picked = null; render(); }
      function render() {
        pathEl.textContent = cwd === '/' ? 'Macintosh HD' : cwd;
        card.querySelector('.dlg-up').disabled = cwd === '/';
        const items = FS.list(cwd) || [];
        list.innerHTML = items.length ? '' : '<div class="muted" style="padding:14px;text-align:center;font-size:12px">Empty folder</div>';
        items.forEach(it => {
          const row = document.createElement('div');
          row.className = 'dlg-row' + (it.type === 'file' && mode === 'save' ? ' dim' : '');
          row.innerHTML = `<span class="dri">${it.type === 'dir' ? '📂' : '📄'}</span><span>${esc(it.name)}</span>`;
          row.onclick = () => {
            if (it.type === 'dir') go(full(it.name));
            else if (mode === 'open') { picked = full(it.name); list.querySelectorAll('.sel').forEach(r => r.classList.remove('sel')); row.classList.add('sel'); }
            else if (mode === 'save') { nameInput.value = it.name; }
          };
          row.ondblclick = () => { if (it.type === 'file' && mode === 'open') close(full(it.name)); };
          list.appendChild(row);
        });
      }
      card.querySelector('.dlg-up').onclick = () => { if (cwd !== '/') go(cwd.replace(/\/[^/]+$/, '') || '/'); };
      card.querySelector('.dlg-cancel').onclick = () => close(null);
      card.querySelector('.dlg-ok').onclick = () => {
        if (mode === 'save') {
          const name = (nameInput.value || '').trim();
          if (!name) return;
          close(full(name));
        } else {
          if (picked) close(picked);
        }
      };
      if (nameInput) nameInput.addEventListener('keydown', e => { if (e.key === 'Enter') card.querySelector('.dlg-ok').click(); });
      render();
      setTimeout(() => { if (nameInput) { nameInput.focus(); nameInput.select(); } }, 40);
    });
  }

  return { prompt, confirm, alert, filePanel };
})();
