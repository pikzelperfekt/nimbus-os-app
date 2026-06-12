/* ===================================================================
   Apps — every built-in application. Each registers a definition;
   Apps.launch(id, arg) opens one. Terminal/Files/Editor share FS.
   =================================================================== */
window.Apps = (function () {
  const reg = {};
  function def(d) { reg[d.id] = d; }
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  /* ---------------------------------------------------------------
     TERMINAL — a real (tiny) shell over FS
  --------------------------------------------------------------- */
  def({
    id: 'terminal', title: 'Terminal', icon: '🖥️', width: 560, height: 360,
    build(body, win) {
      let cwd = '/';
      const term = document.createElement('div');
      term.className = 'term';
      body.appendChild(term);
      const history = [];
      let hIdx = 0;

      function shortCwd() { return cwd === '/' ? '/' : cwd; }
      function print(html, cls) {
        const d = document.createElement('div');
        d.className = 'ln' + (cls ? ' ' + cls : '');
        d.innerHTML = html;
        term.insertBefore(d, inputLine);
        term.scrollTop = term.scrollHeight;
      }

      // Commands return a STRING (stdout, plain text) to print/pipe, or
      // undefined if they act/print themselves (side-effect or rich output).
      const commands = {
        help() {
          print(`<span class="dim">Files:</span> ls cd pwd cat echo write mkdir touch rm cp mv tree find
<span class="dim">Text/pipes:</span> grep head tail wc sort uniq rev   <span class="dim">(use</span> | <span class="dim">and</span> &gt; file<span class="dim">)</span>
<span class="dim">System:</span> clear date whoami history neofetch cal open edit reset help`);
        },
        ls(args) {
          const path = FS.normalize(cwd, args[0] || '.');
          const items = FS.list(path);
          if (!items) throw new Error('ls: not a directory: ' + (args[0] || '.'));
          return items.map(i => i.type === 'dir' ? i.name + '/' : i.name).join('\n');
        },
        cd(args) { const p = FS.normalize(cwd, args[0] || '/'); if (!FS.isDir(p)) throw new Error('cd: no such directory: ' + (args[0] || '')); cwd = p || '/'; },
        pwd() { return shortCwd(); },
        cat(args, stdin) {
          if (!args[0]) return stdin || '';
          return args.map(a => { const c = FS.read(FS.normalize(cwd, a)); if (c == null) throw new Error('cat: no such file: ' + a); return c; }).join('');
        },
        echo(args) { return args.join(' '); },
        write(args) { if (args.length < 2) throw new Error('usage: write <file> <text...>'); const f = args.shift(); FS.write(FS.normalize(cwd, f), args.join(' ') + '\n'); },
        mkdir(args) { if (!args[0]) throw new Error('mkdir: missing name'); if (!FS.mkdir(FS.normalize(cwd, args[0]))) throw new Error('mkdir: cannot create ' + args[0]); },
        touch(args) { if (args[0]) FS.touch(FS.normalize(cwd, args[0])); },
        rm(args) { if (!args[0]) throw new Error('rm: missing target'); if (!FS.remove(FS.normalize(cwd, args[0]))) throw new Error('rm: cannot remove ' + args[0]); },
        cp(args) { if (args.length < 2) throw new Error('usage: cp <src> <dest>'); if (!FS.cp(FS.normalize(cwd, args[0]), FS.normalize(cwd, args[1]))) throw new Error('cp: failed'); },
        mv(args) { if (args.length < 2) throw new Error('usage: mv <src> <dest>'); if (!FS.mv(FS.normalize(cwd, args[0]), FS.normalize(cwd, args[1]))) throw new Error('mv: failed'); },
        find(args) {
          const q = (args[0] || '').toLowerCase(), res = [];
          (function w(p) { (FS.list(p) || []).forEach(it => { const f = (p === '/' ? '' : p) + '/' + it.name; if (!q || it.name.toLowerCase().includes(q)) res.push(f); if (it.type === 'dir') w(f); }); })(cwd);
          return res.join('\n');
        },
        grep(args, stdin) { if (!args[0]) throw new Error('usage: grep <pattern>'); let re; try { re = new RegExp(args[0], 'i'); } catch (e) { throw new Error('grep: bad pattern'); } return (stdin || '').split('\n').filter(l => re.test(l)).join('\n'); },
        head(args, stdin) { return (stdin || '').split('\n').slice(0, parseInt(args[0]) || 10).join('\n'); },
        tail(args, stdin) { const n = parseInt(args[0]) || 10, l = (stdin || '').split('\n'); return l.slice(Math.max(0, l.length - n)).join('\n'); },
        wc(args, stdin) { const s = stdin || ''; return (s ? s.replace(/\n$/, '').split('\n').length : 0) + ' lines, ' + (s.trim() ? s.trim().split(/\s+/).length : 0) + ' words, ' + s.length + ' chars'; },
        sort(args, stdin) { return (stdin || '').split('\n').sort().join('\n'); },
        uniq(args, stdin) { const o = []; (stdin || '').split('\n').forEach(l => { if (o[o.length - 1] !== l) o.push(l); }); return o.join('\n'); },
        rev(args, stdin) { return (stdin || '').split('\n').map(l => l.split('').reverse().join('')).join('\n'); },
        tree() {
          const lines = [];
          (function walk(path, prefix) {
            const items = FS.list(path) || [];
            items.forEach((it, i) => {
              const last = i === items.length - 1;
              lines.push(prefix + (last ? '└─ ' : '├─ ') + it.name + (it.type === 'dir' ? '/' : ''));
              if (it.type === 'dir') walk((path === '/' ? '' : path) + '/' + it.name, prefix + (last ? '   ' : '│  '));
            });
          })(cwd, '');
          return lines.join('\n') || '(empty)';
        },
        clear() { term.querySelectorAll('.ln').forEach(n => n.remove()); },
        date() { return new Date().toString(); },
        whoami() { return (window.Net && Net.isAuthed()) ? Net.user().username : 'guest'; },
        history() { return history.map((h, i) => '  ' + (i + 1) + '  ' + h).join('\n'); },
        cal() {
          const d = new Date(), y = d.getFullYear(), m = d.getMonth();
          const MON = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
          const first = new Date(y, m, 1).getDay(), days = new Date(y, m + 1, 0).getDate();
          let out = '   ' + MON[m] + ' ' + y + '\nSu Mo Tu We Th Fr Sa\n' + '   '.repeat(first);
          for (let n = 1; n <= days; n++) { out += String(n).padStart(2) + (((first + n) % 7 === 0) ? '\n' : ' '); }
          return out;
        },
        open(args) { if (!args[0]) throw new Error('open: which app?'); if (reg[args[0]]) { Apps.launch(args[0]); print(`<span class="dim">opening ${esc(args[0])}…</span>`); } else throw new Error('open: unknown app: ' + args[0]); },
        edit(args) { if (!args[0]) throw new Error('edit: missing file'); const p = FS.normalize(cwd, args[0]); if (!FS.exists(p)) FS.write(p, ''); if (FS.isDir(p)) throw new Error('edit: is a directory'); Apps.launch('code', p); },
        neofetch() {
          print(
`<span class="pr">       ◈◈◈        </span>  <span class="pth">${esc((window.Net && Net.isAuthed()) ? Net.user().username : 'nimbus')}</span>@<span class="pth">nimbus</span>
<span class="pr">     ◈◈◈◈◈◈      </span>  ---------------
<span class="pr">    ◈◈◈   ◈◈◈     </span>  OS:     Nimbus OS 1.3
<span class="pr">    ◈◈◈   ◈◈◈     </span>  Shell:  nsh (pipes!)
<span class="pr">     ◈◈◈◈◈◈      </span>  Apps:   ${Apps.list().length}
<span class="pr">       ◈◈◈        </span>  Uptime: ${Math.floor(performance.now() / 1000)}s`);
        },
        reset() { FS.reset(); return 'filesystem reset.'; }
      };

      function run(raw) {
        const line = raw.trim();
        print(`<span class="pr">nimbus</span>:<span class="pth">${esc(shortCwd())}</span>$ ${esc(raw)}`);
        if (!line) return;
        history.push(line); hIdx = history.length;
        // trailing redirect:  ... > file
        let body = line, redirect = null;
        const rm = line.match(/^(.*?)\s*>\s*(\S+)\s*$/);
        if (rm) { body = rm[1]; redirect = rm[2]; }
        const segs = body.split('|').map(s => s.trim()).filter(Boolean);
        let stdin = '', lastStr = false, lastOut = '';
        try {
          for (const seg of segs) {
            const parts = seg.match(/(?:[^\s"']+|"[^"]*"|'[^']*')+/g) || [];
            const cmd = parts.shift();
            const args = parts.map(a => a.replace(/^["']|["']$/g, ''));
            if (!commands[cmd]) throw new Error(`nsh: command not found: ${cmd}  (try 'help')`);
            const out = commands[cmd](args, stdin, seg);
            lastStr = typeof out === 'string'; lastOut = out;
            stdin = lastStr ? out : '';
          }
        } catch (e) { print(esc(e.message), 'err'); return; }
        if (redirect) { FS.write(FS.normalize(cwd, redirect), stdin.replace(/\n?$/, '\n')); }
        else if (lastStr && lastOut !== '') print(esc(lastOut));
      }

      const inputLine = document.createElement('div');
      inputLine.className = 'term-input-line';
      inputLine.innerHTML = `<span class="pr">nimbus</span>:<span class="pth term-cwd">/</span>$&nbsp;`;
      const input = document.createElement('input');
      input.className = 'term-input';
      input.spellcheck = false; input.autocapitalize = 'off'; input.autocomplete = 'off';
      inputLine.appendChild(input);
      term.appendChild(inputLine);

      function syncPrompt() { inputLine.querySelector('.term-cwd').textContent = shortCwd(); }
      input.addEventListener('keydown', e => {
        if (e.key === 'Enter') { run(input.value); input.value = ''; syncPrompt(); }
        else if (e.key === 'ArrowUp') { if (hIdx > 0) { hIdx--; input.value = history[hIdx]; } e.preventDefault(); }
        else if (e.key === 'ArrowDown') { if (hIdx < history.length - 1) { hIdx++; input.value = history[hIdx]; } else { hIdx = history.length; input.value = ''; } e.preventDefault(); }
        else if (e.key === 'l' && e.ctrlKey) { commands.clear(); e.preventDefault(); }
      });
      term.addEventListener('mousedown', () => setTimeout(() => input.focus(), 0));

      print('<span class="dim">Nimbus shell — type</span> help <span class="dim">to begin.</span>');
      setTimeout(() => input.focus(), 60);
    }
  });

  /* ---------------------------------------------------------------
     FILES — browse FS, open files in the editor
  --------------------------------------------------------------- */
  let fileClipboard = null; // { path, name, op:'copy'|'cut' } shared across Files windows
  def({
    id: 'files', title: 'Files', icon: '📁', width: 520, height: 360,
    build(body, win, arg) {
      let cwd = (arg && FS.isDir(arg)) ? arg : '/';
      const hist = [cwd]; let hi = 0;

      body.innerHTML = `
        <div class="files-bar">
          <button class="fbtn" data-a="back">‹</button>
          <button class="fbtn" data-a="up">↑</button>
          <span class="files-path"></span>
          <button class="fbtn" data-a="paste" title="Paste" style="display:none">📋</button>
          <button class="fbtn" data-a="emptytrash" title="Empty Trash" style="display:none">🗑</button>
          <button class="fbtn" data-a="newfile" title="New file">＋</button>
          <button class="fbtn" data-a="newdir" title="New folder">📁</button>
        </div>
        <div class="files-grid"></div>`;
      const grid = body.querySelector('.files-grid');
      const pathEl = body.querySelector('.files-path');

      function nav(path, pushHist = true) {
        if (!FS.isDir(path)) return;
        cwd = path;
        if (pushHist) { hist.splice(hi + 1); hist.push(path); hi = hist.length - 1; }
        render();
      }

      function iconFor(it) {
        if (it.type === 'dir') return '📂';
        const n = it.name.toLowerCase();
        if (n.endsWith('.md')) return '📝';
        if (n.endsWith('.txt')) return '📄';
        if (n.endsWith('.cfg') || n.endsWith('.json')) return '⚙️';
        if (/\.(png|jpg|jpeg|gif|svg)$/.test(n)) return '🖼️';
        return '📄';
      }

      function doPaste() {
        if (!fileClipboard) return;
        const dest = FS.freeName(cwd, fileClipboard.name);
        if (fileClipboard.op === 'cut') { FS.mv(fileClipboard.path, dest); fileClipboard = null; }
        else FS.cp(fileClipboard.path, dest);
        render(); OS.refreshFiles();
      }
      function render() {
        const inTrash = cwd === '/Trash';
        pathEl.textContent = cwd === '/' ? 'Macintosh HD' : (cwd === '/Trash' ? '🗑 Trash' : cwd);
        win.el.querySelector('.win-title').innerHTML = `<span class="win-ico">📁</span> ${esc(cwd === '/' ? 'Files' : cwd.split('/').pop())}`;
        body.querySelector('[data-a="paste"]').style.display = fileClipboard ? '' : 'none';
        body.querySelector('[data-a="emptytrash"]').style.display = (inTrash && (FS.list('/Trash') || []).length) ? '' : 'none';
        const items = FS.list(cwd) || [];
        grid.innerHTML = '';
        if (!items.length) {
          grid.innerHTML = `<div class="muted" style="grid-column:1/-1;padding:20px;text-align:center">${inTrash ? 'Trash is empty' : 'Empty folder'}</div>`;
          return;
        }
        items.forEach(it => {
          const cell = document.createElement('div');
          cell.className = 'file-cell';
          cell.innerHTML = `<div class="fi">${iconFor(it)}</div><div class="fn">${esc(it.name)}</div>`;
          const full = (cwd === '/' ? '' : cwd) + '/' + it.name;
          // drag source
          cell.draggable = true;
          cell.addEventListener('dragstart', e => { window.__nimDrag = { path: full, name: it.name }; e.dataTransfer.effectAllowed = 'move'; try { e.dataTransfer.setData('text/plain', full); } catch (x) {} });
          // folders are drop targets — drop a file in to move it
          if (it.type === 'dir') {
            cell.addEventListener('dragover', e => { if (window.__nimDrag) { e.preventDefault(); cell.classList.add('drop-target'); } });
            cell.addEventListener('dragleave', () => cell.classList.remove('drop-target'));
            cell.addEventListener('drop', e => {
              e.preventDefault(); cell.classList.remove('drop-target');
              const d = window.__nimDrag; window.__nimDrag = null;
              if (d && d.path !== full && d.path.replace(/\/[^/]+$/, '') !== full) { FS.mv(d.path, FS.freeName(full, d.name)); render(); OS.refreshFiles(); }
            });
          }
          cell.addEventListener('click', () => {
            grid.querySelectorAll('.sel').forEach(c => c.classList.remove('sel'));
            cell.classList.add('sel');
          });
          cell.addEventListener('dblclick', () => {
            if (it.type === 'dir') nav(full);
            else OS.openFile(full);
          });
          cell.addEventListener('contextmenu', e => {
            e.preventDefault();
            const ext = (it.name.split('.').pop() || '').toLowerCase();
            const menu = [
              { label: 'Open', fn: () => it.type === 'dir' ? nav(full) : OS.openFile(full) }
            ];
            if (it.type === 'file') {
              menu.push({ label: 'Open with Code', fn: () => Apps.launch('code', full) });
              menu.push({ label: 'Open with Text Editor', fn: () => Apps.launch('editor', full) });
              if (/^(png|jpg|jpeg|gif|svg)$/.test(ext)) menu.push({ label: 'Open with Image Viewer', fn: () => Apps.launch('viewer', full) });
            }
            menu.push(
              { label: 'Copy', fn: () => { fileClipboard = { path: full, name: it.name, op: 'copy' }; render(); } },
              { label: 'Cut', fn: () => { fileClipboard = { path: full, name: it.name, op: 'cut' }; render(); } },
              { label: 'Duplicate', fn: () => { FS.cp(full, FS.freeName(cwd, it.name)); render(); } },
              { label: 'Rename…', fn: async () => {
                const nn = await UI.prompt({ title: 'Rename', label: 'New name for “' + it.name + '”', value: it.name, ok: 'Rename' });
                if (nn && nn !== it.name) { FS.rename(full, nn); render(); OS.refreshFiles(); }
              } }
            );
            if (inTrash) menu.push({ label: 'Delete Permanently', fn: async () => {
              if (await UI.confirm({ title: 'Delete “' + it.name + '” forever?', body: 'This can’t be undone.', ok: 'Delete', danger: true })) { FS.remove(full); render(); }
            } });
            else menu.push({ label: 'Move to Trash', fn: () => { FS.trash(full); render(); OS.refreshFiles(); } });
            OS.contextMenu(e.clientX, e.clientY, menu);
          });
          grid.appendChild(cell);
        });
      }

      const upBtn = body.querySelector('[data-a="up"]');
      body.querySelector('[data-a="back"]').onclick = () => { if (hi > 0) { hi--; nav(hist[hi], false); } };
      upBtn.onclick = () => { if (cwd !== '/') nav(cwd.replace(/\/[^/]+$/, '') || '/'); };
      upBtn.addEventListener('dragover', e => { if (window.__nimDrag && cwd !== '/') { e.preventDefault(); upBtn.classList.add('drop-target'); } });
      upBtn.addEventListener('dragleave', () => upBtn.classList.remove('drop-target'));
      upBtn.addEventListener('drop', e => {
        e.preventDefault(); upBtn.classList.remove('drop-target');
        const parent = cwd.replace(/\/[^/]+$/, '') || '/'; const d = window.__nimDrag; window.__nimDrag = null;
        if (d && d.path.replace(/\/[^/]+$/, '') !== parent) { FS.mv(d.path, FS.freeName(parent, d.name)); render(); OS.refreshFiles(); }
      });
      body.querySelector('[data-a="paste"]').onclick = doPaste;
      body.querySelector('[data-a="emptytrash"]').onclick = async () => {
        if (await UI.confirm({ title: 'Empty the Trash?', body: 'Everything in the Trash will be permanently deleted.', ok: 'Empty Trash', danger: true })) { FS.emptyTrash(); render(); }
      };
      // right-click empty area → Paste / New
      grid.addEventListener('contextmenu', e => {
        if (e.target.closest('.file-cell')) return;
        e.preventDefault();
        const menu = [];
        if (fileClipboard) menu.push({ label: 'Paste', fn: doPaste });
        menu.push({ label: 'New Folder…', fn: async () => { const n = await UI.prompt({ title: 'New Folder', value: 'New Folder', ok: 'Create' }); if (n) { FS.mkdir((cwd === '/' ? '' : cwd) + '/' + n); render(); } } });
        OS.contextMenu(e.clientX, e.clientY, menu);
      });
      body.querySelector('[data-a="newfile"]').onclick = async () => {
        const name = await UI.prompt({ title: 'New File', label: 'Create a file in ' + (cwd === '/' ? 'Macintosh HD' : cwd), value: 'untitled.txt', ok: 'Create' });
        if (name) { FS.write((cwd === '/' ? '' : cwd) + '/' + name, ''); render(); }
      };
      body.querySelector('[data-a="newdir"]').onclick = async () => {
        const name = await UI.prompt({ title: 'New Folder', label: 'Create a folder in ' + (cwd === '/' ? 'Macintosh HD' : cwd), value: 'New Folder', ok: 'Create' });
        if (name) { FS.mkdir((cwd === '/' ? '' : cwd) + '/' + name); render(); }
      };

      win._refresh = render;
      render();
    }
  });

  /* ---------------------------------------------------------------
     EDITOR — open & save files into FS
  --------------------------------------------------------------- */
  def({
    id: 'editor', title: 'Text Editor', icon: '📝', width: 500, height: 380,
    build(body, win, arg) {
      let path = arg || null;
      body.innerHTML = `
        <div class="ed-wrap">
          <div class="ed-bar">
            <button class="btn ghost" data-a="open">Open…</button>
            <button class="btn ghost" data-a="save">Save</button>
            <button class="btn ghost" data-a="saveas">Save As…</button>
            <span class="ed-name"></span>
            <span class="muted" data-a="status"></span>
          </div>
          <textarea class="ed-area" spellcheck="false" placeholder="Start typing…"></textarea>
        </div>`;
      const area = body.querySelector('.ed-area');
      const nameEl = body.querySelector('.ed-name');
      const status = body.querySelector('[data-a="status"]');
      let dirty = false;

      function load(p) {
        path = p;
        area.value = FS.read(p) || '';
        nameEl.textContent = p;
        win.el.querySelector('.win-title').innerHTML = `<span class="win-ico">📝</span> ${esc(p.split('/').pop())}`;
        dirty = false; status.textContent = '';
      }
      function save() {
        if (!path) return saveAs();
        FS.write(path, area.value);
        dirty = false; status.textContent = 'saved'; setTimeout(() => status.textContent = '', 1200);
        OS.refreshFiles();
      }
      async function saveAs() {
        const dir = path ? path.replace(/\/[^/]+$/, '') || '/' : '/Documents';
        const fname = path ? path.split('/').pop() : 'untitled.txt';
        const p = await UI.filePanel({ mode: 'save', startPath: dir, filename: fname, title: 'Save As' });
        if (!p) return;
        FS.write(p, area.value);
        load(p); status.textContent = 'saved'; setTimeout(() => status.textContent = '', 1200);
        OS.refreshFiles();
      }
      async function openFile() {
        const p = await UI.filePanel({ mode: 'open', startPath: path ? path.replace(/\/[^/]+$/, '') || '/' : '/Documents', title: 'Open File' });
        if (p && FS.isFile(p)) load(p);
      }

      area.addEventListener('input', () => { dirty = true; status.textContent = '• unsaved'; });
      area.addEventListener('keydown', e => {
        if ((e.metaKey || e.ctrlKey) && e.key === 's') { e.preventDefault(); save(); }
        if (e.key === 'Tab') { e.preventDefault();
          const s = area.selectionStart; area.value = area.value.slice(0, s) + '  ' + area.value.slice(area.selectionEnd);
          area.selectionStart = area.selectionEnd = s + 2; }
      });
      body.querySelector('[data-a="save"]').onclick = save;
      body.querySelector('[data-a="saveas"]').onclick = saveAs;
      body.querySelector('[data-a="open"]').onclick = openFile;
      win.confirmClose = async () => dirty ? UI.confirm({ title: 'Discard changes?', body: '“' + (path ? path.split('/').pop() : 'untitled') + '” has unsaved changes.', ok: 'Discard', danger: true }) : true;

      if (path) load(path); else { nameEl.textContent = 'untitled'; }
      setTimeout(() => area.focus(), 60);
    }
  });

  /* ---------------------------------------------------------------
     NOTES — quick persistent scratchpad (localStorage)
  --------------------------------------------------------------- */
  def({
    id: 'notes', title: 'Notes', icon: '🗒️', width: 360, height: 320,
    build(body) {
      body.innerHTML = `<textarea class="ed-area" style="height:100%" spellcheck="false"
        placeholder="A scratchpad. Saved automatically."></textarea>`;
      const ta = body.querySelector('textarea');
      ta.value = localStorage.getItem('nimbus.notes') || '';
      ta.addEventListener('input', () => { localStorage.setItem('nimbus.notes', ta.value); document.dispatchEvent(new Event('nimbus:dirty')); });
      setTimeout(() => ta.focus(), 60);
    }
  });

  /* ---------------------------------------------------------------
     CLOCK — analog + digital, live
  --------------------------------------------------------------- */
  def({
    id: 'clock', title: 'Clock', icon: '🕐', width: 240, height: 300, single: true,
    build(body, win) {
      let ticks = '';
      for (let i = 0; i < 12; i++) ticks += `<div class="tick" style="transform:rotate(${i * 30}deg)"></div>`;
      body.innerHTML = `
        <div class="clock-wrap">
          <div class="analog">
            ${ticks}
            <div class="hand h-hr"></div>
            <div class="hand h-min"></div>
            <div class="hand h-sec"></div>
            <div class="clock-center"></div>
          </div>
          <div class="digi"></div>
          <div class="digi-date"></div>
        </div>`;
      const hr = body.querySelector('.h-hr'), mn = body.querySelector('.h-min'), sc = body.querySelector('.h-sec');
      const digi = body.querySelector('.digi'), date = body.querySelector('.digi-date');
      function tick() {
        const d = new Date();
        const s = d.getSeconds(), m = d.getMinutes(), h = d.getHours();
        sc.style.transform = `rotate(${s * 6}deg)`;
        mn.style.transform = `rotate(${m * 6 + s * 0.1}deg)`;
        hr.style.transform = `rotate(${(h % 12) * 30 + m * 0.5}deg)`;
        digi.textContent = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        date.textContent = d.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' });
      }
      tick();
      const iv = setInterval(tick, 1000);
      win.onClose = () => clearInterval(iv);
    }
  });

  /* ---------------------------------------------------------------
     ABOUT THIS COMPUTER
  --------------------------------------------------------------- */
  def({
    id: 'about', title: 'About This Computer', icon: '◈', width: 340, height: 320, single: true,
    build(body) {
      const mem = (navigator.deviceMemory ? navigator.deviceMemory + ' GB' : '∞');
      const cores = navigator.hardwareConcurrency || '?';
      body.innerHTML = `
        <div class="about">
          <div class="logo">◈</div>
          <div style="font-size:18px;font-weight:700">Nimbus OS</div>
          <div class="muted" style="font-size:12px">Version 1.0 “Cumulus”</div>
          <table>
            <tr><td>Model</td><td>Browser Tab (Virtual)</td></tr>
            <tr><td>Processor</td><td>${cores}-core JS Engine</td></tr>
            <tr><td>Memory</td><td>${mem}</td></tr>
            <tr><td>Graphics</td><td>CSS Compositor</td></tr>
            <tr><td>Display</td><td>${window.innerWidth}×${window.innerHeight}</td></tr>
            <tr><td>Storage</td><td>localStorage</td></tr>
          </table>
          <div class="muted" style="font-size:11px;margin-top:14px">Built entirely in one browser tab.</div>
        </div>`;
    }
  });

  /* ---------------------------------------------------------------
     SETTINGS — a real System Settings with a category sidebar
  --------------------------------------------------------------- */
  def({
    id: 'settings', title: 'Settings', icon: '⚙️', width: 580, height: 460, single: true,
    build(body) {
      const SEC = [
        { id: 'appearance', name: 'Appearance', icon: '🎨' },
        { id: 'wallpaper', name: 'Wallpaper', icon: '🏞️' },
        { id: 'dock', name: 'Dock & Menu', icon: '📊' },
        { id: 'sound', name: 'Sound', icon: '🔊' },
        { id: 'datetime', name: 'Date & Time', icon: '🕐' },
        { id: 'filetypes', name: 'File Types', icon: '📄' },
        { id: 'general', name: 'General', icon: '⚙️' }
      ];
      body.innerHTML = `
        <div class="settings2">
          <div class="set-side">${SEC.map((s, i) =>
            `<div class="set-nav ${i === 0 ? 'active' : ''}" data-sec="${s.id}"><span class="sn-ic">${s.icon}</span>${s.name}</div>`).join('')}</div>
          <div class="set-content"></div>
        </div>`;
      const content = body.querySelector('.set-content');
      const P = () => OS.prefs();

      // --- small control builders (return HTML strings) ---
      function row(label, controlHTML, sub) {
        return `<div class="s-row"><div class="s-label">${label}${sub ? `<span class="s-sub">${sub}</span>` : ''}</div><div class="s-ctl">${controlHTML}</div></div>`;
      }
      const tg = (on, attr) => `<span class="tg ${on ? 'on' : ''}" ${attr}></span>`;
      const seg = (opts, val, attr) => `<div class="seg" ${attr}>${opts.map(o => `<button class="${o.v === val ? 'on' : ''}" data-v="${o.v}">${o.label}</button>`).join('')}</div>`;

      function head(t) { return `<h2 class="set-h2">${t}</h2>`; }

      const PANELS = {
        appearance() {
          const cur = P();
          content.innerHTML = head('Appearance') +
            row('Theme', seg([{ v: 'dark', label: 'Dark' }, { v: 'light', label: 'Light' }], cur.theme, 'data-a="theme"')) +
            row('Accent color',
              `<div class="swatches" data-a="accent">${Object.keys(OS.accents).map(k =>
                `<span class="sw ${cur.accent === k ? 'sel' : ''}" data-ac="${k}" style="background:${OS.accents[k]}"></span>`).join('')}
                <label class="sw sw-custom" title="Custom" style="background:${cur.customAccent || '#888'}"><input type="color" value="${cur.customAccent || '#3b82f6'}" data-a="accent-custom"></label></div>`) +
            row('Reduce motion', tg(cur.reduceMotion, 'data-a="motion"'), 'Minimize window & dock animations');
          content.querySelector('[data-a="theme"]').onclick = e => { const b = e.target.closest('button'); if (b) OS.setTheme(b.dataset.v), PANELS.appearance(); };
          content.querySelectorAll('[data-ac]').forEach(s => s.onclick = () => { OS.setAccent(s.dataset.ac); PANELS.appearance(); });
          content.querySelector('[data-a="accent-custom"]').oninput = e => OS.setAccentColor(e.target.value);
          content.querySelector('[data-a="motion"]').onclick = () => { OS.setPref('reduceMotion', !P().reduceMotion); PANELS.appearance(); };
        },
        wallpaper() {
          const cur = P();
          content.innerHTML = head('Wallpaper') +
            `<div class="wp-grid">${Object.keys(OS.wallpapers).map(k =>
              `<div class="wp ${cur.wallpaper === k ? 'sel' : ''}" data-wp="${k}" style="background:${OS.wallpapers[k].thumb}"></div>`).join('')}</div>` +
            row('Solid color', `<label class="sw sw-custom" style="background:${cur.customWall || '#444'}"><input type="color" value="${cur.customWall || '#222433'}" data-a="wall-custom"></label>`, 'Use a plain color instead');
          content.querySelectorAll('[data-wp]').forEach(el => el.onclick = () => { OS.setWallpaper(el.dataset.wp); PANELS.wallpaper(); });
          content.querySelector('[data-a="wall-custom"]').oninput = e => OS.setCustomWallpaper(e.target.value);
        },
        dock() {
          const cur = P();
          const inDock = OS.dockList();
          const dockable = Apps.list().filter(a => a.id !== 'viewer'); // viewer opens via Files
          content.innerHTML = head('Dock & Menu Bar') +
            row('Position', seg([{ v: 'bottom', label: 'Bottom' }, { v: 'left', label: 'Left' }, { v: 'right', label: 'Right' }], cur.dockPos, 'data-a="dockpos"')) +
            row('Size', `<input type="range" min="34" max="64" value="${cur.dockSize}" data-a="docksize" class="s-range">`) +
            row('Magnification', tg(cur.dockMagnify, 'data-a="dockmag"'), 'Icons grow on hover') +
            row('Automatically hide', tg(cur.dockAutohide, 'data-a="dockhide"'), 'Dock slides away until you reach for it') +
            `<div class="s-row" style="display:block"><div class="s-label" style="margin-bottom:8px">Apps in the Dock<span class="s-sub">Drag dock icons to reorder · right-click one to remove</span></div>
              <div class="dock-mgr">${dockable.map(a => `<button class="dock-chip ${inDock.includes(a.id) ? 'on' : ''}" data-app="${a.id}"><span>${a.icon}</span> ${esc(a.title)}</button>`).join('')}</div></div>`;
          content.querySelector('[data-a="dockpos"]').onclick = e => { const b = e.target.closest('button'); if (b) { OS.setPref('dockPos', b.dataset.v); PANELS.dock(); } };
          content.querySelector('[data-a="docksize"]').oninput = e => OS.setPref('dockSize', +e.target.value);
          content.querySelector('[data-a="dockmag"]').onclick = () => { OS.setPref('dockMagnify', !P().dockMagnify); PANELS.dock(); };
          content.querySelector('[data-a="dockhide"]').onclick = () => { OS.setPref('dockAutohide', !P().dockAutohide); PANELS.dock(); };
          content.querySelectorAll('.dock-chip').forEach(c => c.onclick = () => {
            const id = c.dataset.app; const list = OS.dockList();
            OS.setDock(list.includes(id) ? list.filter(x => x !== id) : list.concat(id));
            c.classList.toggle('on');
          });
        },
        sound() {
          const cur = P();
          content.innerHTML = head('Sound') +
            row('Sound effects', tg(cur.sound, 'data-a="sound"'), 'Boot chime, clicks, notifications') +
            row('Volume', `<input type="range" min="0" max="100" value="${Math.round(cur.volume * 100)}" data-a="vol" class="s-range">`) +
            `<div class="s-row"><button class="btn ghost" data-a="test">Play test sound</button></div>`;
          content.querySelector('[data-a="sound"]').onclick = () => { OS.setPref('sound', !P().sound); PANELS.sound(); };
          content.querySelector('[data-a="vol"]').oninput = e => OS.setPref('volume', +e.target.value / 100);
          content.querySelector('[data-a="test"]').onclick = () => Sound.play('notify');
        },
        datetime() {
          const cur = P();
          content.innerHTML = head('Date & Time') +
            row('24-hour clock', tg(cur.clock24, 'data-a="clock24"')) +
            row('Show seconds', tg(cur.clockSeconds, 'data-a="secs"'), 'In the menu bar clock');
          content.querySelector('[data-a="clock24"]').onclick = () => { OS.setPref('clock24', !P().clock24); PANELS.datetime(); };
          content.querySelector('[data-a="secs"]').onclick = () => { OS.setPref('clockSeconds', !P().clockSeconds); PANELS.datetime(); };
        },
        filetypes() {
          const assoc = P().assoc || {};
          const APPS = [{ v: 'editor', label: '📝 Text Editor' }, { v: 'code', label: '💻 Code' }, { v: 'viewer', label: '🖼️ Image Viewer' }];
          const exts = ['txt', 'md', 'js', 'json', 'css', 'html', 'cfg', 'log', 'png', 'jpg', 'gif', 'svg'];
          content.innerHTML = head('File Types') +
            '<div class="s-sub" style="margin-bottom:10px">Choose which app opens each kind of file by default.</div>' +
            exts.map(ext => row('.' + ext,
              `<select class="fld" data-ext="${ext}" style="width:auto">${APPS.map(a => `<option value="${a.v}" ${assoc[ext] === a.v ? 'selected' : ''}>${a.label}</option>`).join('')}</select>`)).join('');
          content.querySelectorAll('[data-ext]').forEach(s => s.onchange = () => OS.setAssoc(s.dataset.ext, s.value));
        },
        general() {
          const cur = P();
          content.innerHTML = head('General') +
            `<div class="s-about"><div class="logo">◈</div><b>Nimbus OS</b><span class="muted">Version 1.3 “Cirrus”</span></div>` +
            row('Reopen windows on login', tg(cur.restoreWindows !== false, 'data-a="restorewin"'), 'Pick up where you left off') +
            `<div class="s-row" style="display:block"><div class="s-label" style="margin-bottom:8px">Backup<span class="s-sub">Save or restore your whole Nimbus (files, settings, apps)</span></div>
              <div class="row"><button class="btn ghost" data-a="export">Export…</button><button class="btn ghost" data-a="import">Import…</button></div></div>` +
            `<div class="s-row"><button class="btn ghost" data-a="resetfs">Reset filesystem…</button></div>` +
            `<div class="s-row"><button class="btn ghost" data-a="resetset">Reset all settings…</button></div>` +
            `<div class="s-row"><button class="btn" data-a="about">About This Computer</button></div>`;
          content.querySelector('[data-a="restorewin"]').onclick = () => { OS.setPref('restoreWindows', !(P().restoreWindows !== false)); PANELS.general(); };
          content.querySelector('[data-a="export"]').onclick = () => {
            const data = JSON.stringify(window.Sync ? Sync.snapshot() : { fs: FS.root(), prefs: OS.prefs() }, null, 2);
            const a = document.createElement('a');
            a.href = URL.createObjectURL(new Blob([data], { type: 'application/json' }));
            a.download = 'nimbus-backup.json'; a.click();
            setTimeout(() => URL.revokeObjectURL(a.href), 1000);
            OS.notify('💾', 'Exported', 'nimbus-backup.json');
          };
          content.querySelector('[data-a="import"]').onclick = () => {
            const inp = document.createElement('input'); inp.type = 'file'; inp.accept = 'application/json,.json';
            inp.onchange = () => {
              const f = inp.files[0]; if (!f) return;
              const r = new FileReader();
              r.onload = async () => {
                try {
                  const data = JSON.parse(r.result);
                  if (!(await UI.confirm({ title: 'Import backup?', body: 'This replaces your current files, settings, and apps with the backup.', ok: 'Import', danger: true }))) return;
                  if (window.Sync) Sync.apply(data); else { if (data.fs) FS.replaceRoot(data.fs); if (data.prefs) OS.loadPrefs(data.prefs); }
                  OS.notify('💾', 'Imported', 'Your Nimbus was restored.');
                } catch (e) { UI.alert({ title: 'Import failed', body: 'That doesn’t look like a Nimbus backup.' }); }
              };
              r.readAsText(f);
            };
            inp.click();
          };
          content.querySelector('[data-a="resetfs"]').onclick = async () => {
            const ok = await UI.confirm({ title: 'Reset filesystem?', body: 'All files and folders return to defaults. This cannot be undone.', ok: 'Reset', danger: true });
            if (ok) { FS.reset(); OS.refreshFiles(); OS.notify('⚙️', 'Filesystem reset', 'Back to defaults.'); }
          };
          content.querySelector('[data-a="resetset"]').onclick = async () => {
            const ok = await UI.confirm({ title: 'Reset all settings?', body: 'Theme, wallpaper, dock and other preferences return to defaults.', ok: 'Reset', danger: true });
            if (ok) OS.resetPrefs();
          };
          content.querySelector('[data-a="about"]').onclick = () => Apps.launch('about');
        }
      };

      body.querySelectorAll('.set-nav').forEach(n => n.onclick = () => {
        body.querySelectorAll('.set-nav').forEach(x => x.classList.remove('active'));
        n.classList.add('active');
        PANELS[n.dataset.sec]();
      });
      PANELS.appearance();
    }
  });

  /* ---------------------------------------------------------------
     CALCULATOR
  --------------------------------------------------------------- */
  def({
    id: 'calc', title: 'Calculator', icon: '🧮', width: 240, height: 320, single: true,
    build(body) {
      body.innerHTML = `
        <div class="calc">
          <div class="calc-disp">0</div>
          <div class="calc-grid">
            <button data-k="C" class="op">AC</button>
            <button data-k="±">±</button>
            <button data-k="%">%</button>
            <button data-k="/" class="op">÷</button>
            <button data-k="7">7</button><button data-k="8">8</button><button data-k="9">9</button>
            <button data-k="*" class="op">×</button>
            <button data-k="4">4</button><button data-k="5">5</button><button data-k="6">6</button>
            <button data-k="-" class="op">−</button>
            <button data-k="1">1</button><button data-k="2">2</button><button data-k="3">3</button>
            <button data-k="+" class="op">+</button>
            <button data-k="0" class="span2">0</button><button data-k=".">.</button>
            <button data-k="=" class="op">=</button>
          </div>
        </div>`;
      const disp = body.querySelector('.calc-disp');
      let cur = '0', prev = null, op = null, fresh = true;
      function show() { disp.textContent = cur.length > 11 ? Number(cur).toPrecision(8) : cur; }
      function compute() {
        const a = parseFloat(prev), b = parseFloat(cur);
        let r = b;
        if (op === '+') r = a + b; else if (op === '-') r = a - b;
        else if (op === '*') r = a * b; else if (op === '/') r = b === 0 ? NaN : a / b;
        return isNaN(r) ? 'Error' : String(+r.toFixed(10));
      }
      body.querySelectorAll('button').forEach(btn => btn.onclick = () => {
        const k = btn.dataset.k;
        if (k === 'C') { cur = '0'; prev = null; op = null; fresh = true; }
        else if (k === '±') cur = String(parseFloat(cur) * -1);
        else if (k === '%') cur = String(parseFloat(cur) / 100);
        else if ('+-*/'.includes(k)) {
          if (op && !fresh) { cur = compute(); }
          prev = cur; op = k; fresh = true;
        }
        else if (k === '=') { if (op) { cur = compute(); op = null; prev = null; fresh = true; } }
        else if (k === '.') { if (!cur.includes('.')) cur += '.'; fresh = false; }
        else { cur = (fresh || cur === '0') ? k : cur + k; fresh = false; }
        show();
      });
    }
  });

  /* ---------------------------------------------------------------
     IMAGE VIEWER — shows a PNG dataURL stored in the FS
  --------------------------------------------------------------- */
  def({
    id: 'viewer', title: 'Image Viewer', icon: '🖼️', width: 420, height: 380,
    build(body, win, arg) {
      body.style.display = 'flex'; body.style.alignItems = 'center'; body.style.justifyContent = 'center';
      body.style.background = 'repeating-conic-gradient(rgba(127,127,127,.12) 0% 25%, transparent 0% 50%) 50%/22px 22px';
      const data = arg && FS.read(arg);
      if (data && data.startsWith('data:image')) {
        body.innerHTML = `<img src="${data}" style="max-width:100%;max-height:100%;object-fit:contain;display:block">`;
        win.el.querySelector('.win-title').innerHTML = `<span class="win-ico">🖼️</span> ${esc(arg.split('/').pop())}`;
      } else {
        body.innerHTML = `<div class="muted pad">No image to display.<br>Draw one in Paint and save it to /Pictures.</div>`;
      }
    }
  });

  /* ---------------------------------------------------------------
     PAINT — canvas drawing, saves a PNG into the filesystem
  --------------------------------------------------------------- */
  def({
    id: 'paint', title: 'Paint', icon: '🎨', width: 480, height: 420,
    build(body, win) {
      const colors = ['#111827', '#ef4444', '#f97316', '#eab308', '#22c55e', '#3b82f6', '#8b5cf6', '#ec4899', '#ffffff'];
      body.innerHTML = `
        <div style="display:flex;flex-direction:column;height:100%">
          <div class="ed-bar" style="flex-wrap:wrap;gap:6px">
            <div class="paint-pal">${colors.map((c, i) => `<span class="paint-sw ${i === 0 ? 'sel' : ''}" data-c="${c}" style="background:${c}"></span>`).join('')}</div>
            <input type="range" min="1" max="40" value="5" class="paint-size" title="Brush size">
            <button class="btn ghost" data-a="erase">Eraser</button>
            <button class="btn ghost" data-a="clear">Clear</button>
            <button class="btn ghost" data-a="save">Save</button>
            <button class="btn" data-a="share">🎨 Share</button>
          </div>
          <canvas class="paint-canvas" style="flex:1;background:#fff;cursor:crosshair;touch-action:none"></canvas>
        </div>`;
      const canvas = body.querySelector('.paint-canvas');
      const ctx = canvas.getContext('2d');
      let color = '#111827', size = 5, erasing = false, drawing = false;

      function fit() {
        const r = canvas.getBoundingClientRect();
        if (!r.width) return;
        const img = ctx.getImageData ? null : null;
        const snap = canvas.toDataURL();
        canvas.width = r.width; canvas.height = r.height;
        ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, canvas.width, canvas.height);
        const im = new Image(); im.onload = () => ctx.drawImage(im, 0, 0); im.src = snap;
      }
      setTimeout(fit, 60);

      function pos(e) {
        const r = canvas.getBoundingClientRect();
        return { x: (e.touches ? e.touches[0].clientX : e.clientX) - r.left, y: (e.touches ? e.touches[0].clientY : e.clientY) - r.top };
      }
      function start(e) { drawing = true; const p = pos(e); ctx.beginPath(); ctx.moveTo(p.x, p.y); draw(e); }
      function draw(e) {
        if (!drawing) return;
        const p = pos(e);
        ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.lineWidth = size;
        ctx.strokeStyle = erasing ? '#fff' : color;
        ctx.lineTo(p.x, p.y); ctx.stroke(); ctx.beginPath(); ctx.moveTo(p.x, p.y);
        e.preventDefault();
      }
      function end() { drawing = false; }
      canvas.addEventListener('mousedown', start); canvas.addEventListener('mousemove', draw);
      window.addEventListener('mouseup', end);
      canvas.addEventListener('touchstart', start); canvas.addEventListener('touchmove', draw); canvas.addEventListener('touchend', end);
      win.onClose = () => window.removeEventListener('mouseup', end);

      body.querySelectorAll('.paint-sw').forEach(s => s.onclick = () => {
        color = s.dataset.c; erasing = false;
        body.querySelectorAll('.paint-sw').forEach(x => x.classList.remove('sel')); s.classList.add('sel');
      });
      body.querySelector('.paint-size').oninput = e => size = +e.target.value;
      body.querySelector('[data-a="erase"]').onclick = () => erasing = !erasing;
      body.querySelector('[data-a="clear"]').onclick = () => { ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, canvas.width, canvas.height); };
      body.querySelector('[data-a="save"]').onclick = async () => {
        let p = await UI.filePanel({ mode: 'save', startPath: '/Pictures', filename: 'drawing.png', title: 'Save Image' });
        if (!p) return;
        if (!/\.png$/i.test(p)) p += '.png';
        FS.write(p, canvas.toDataURL('image/png'));
        OS.refreshFiles();
        OS.notify('🎨', 'Saved', p);
      };
      // downscale to keep shared drawings light (~max 640px wide)
      function exportShareData() {
        const max = 640;
        if (canvas.width <= max) return canvas.toDataURL('image/png');
        const s = max / canvas.width;
        const off = document.createElement('canvas');
        off.width = max; off.height = Math.round(canvas.height * s);
        const octx = off.getContext('2d');
        octx.fillStyle = '#fff'; octx.fillRect(0, 0, off.width, off.height);
        octx.drawImage(canvas, 0, 0, off.width, off.height);
        return off.toDataURL('image/png');
      }
      body.querySelector('[data-a="share"]').onclick = async () => {
        if (!Net.isAuthed()) {
          const go = await UI.confirm({ title: 'Sign in to share', body: 'Share your drawing to nimbuspaint.nim so everyone on NimbusNet can see it. Sign in first?', ok: 'Sign in' });
          if (go) Apps.launch('account');
          return;
        }
        const title = await UI.prompt({ title: 'Share to NimbusPaint', label: 'Give your drawing a title', value: 'My drawing', ok: 'Share' });
        if (title == null) return;
        try {
          await Net.shareDrawing(title || 'Untitled', exportShareData());
          OS.notify('🎨', 'Shared!', 'Your drawing is live on nimbuspaint.nim');
          const open = await UI.confirm({ title: 'Shared to nimbuspaint.nim', body: 'Your drawing is now in the gallery. Open it in the browser?', ok: 'Open gallery' });
          if (open) Apps.launch('browser', 'nimbuspaint.nim');
        } catch (e) { UI.alert({ title: 'Couldn’t share', body: e.message }); }
      };
    }
  });

  /* ---------------------------------------------------------------
     MINESWEEPER
  --------------------------------------------------------------- */
  def({
    id: 'mines', title: 'Minesweeper', icon: '💣', width: 320, height: 380, single: true,
    build(body, win) {
      const N = 9, MINES = 10;
      body.innerHTML = `
        <div class="mine-wrap">
          <div class="mine-bar"><span class="mine-flags">🚩 ${MINES}</span><button class="btn ghost mine-reset">🙂 New</button><span class="mine-status"></span></div>
          <div class="mine-grid"></div>
        </div>`;
      const grid = body.querySelector('.mine-grid');
      const flagsEl = body.querySelector('.mine-flags');
      const statusEl = body.querySelector('.mine-status');
      let cells, over, flags, revealed;

      function reset() {
        over = false; flags = 0; revealed = 0; statusEl.textContent = '';
        flagsEl.textContent = '🚩 ' + MINES;
        cells = [];
        for (let i = 0; i < N * N; i++) cells.push({ mine: false, open: false, flag: false, n: 0 });
        // place mines
        let placed = 0;
        while (placed < MINES) {
          const k = Math.floor(Math.random() * N * N);
          if (!cells[k].mine) { cells[k].mine = true; placed++; }
        }
        // counts
        for (let i = 0; i < N * N; i++) {
          if (cells[i].mine) continue;
          cells[i].n = neighbors(i).filter(j => cells[j].mine).length;
        }
        render();
      }
      function neighbors(i) {
        const r = Math.floor(i / N), c = i % N, out = [];
        for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
          if (!dr && !dc) continue;
          const nr = r + dr, nc = c + dc;
          if (nr >= 0 && nr < N && nc >= 0 && nc < N) out.push(nr * N + nc);
        }
        return out;
      }
      function open(i) {
        if (over || cells[i].open || cells[i].flag) return;
        cells[i].open = true; revealed++;
        if (cells[i].mine) { over = true; statusEl.textContent = '💥 Boom!'; cells.forEach(c => c.open = c.mine ? true : c.open); render(); return; }
        if (cells[i].n === 0) neighbors(i).forEach(open);
        if (revealed === N * N - MINES) { over = true; statusEl.textContent = '🏆 You win!'; }
        render();
      }
      function render() {
        grid.innerHTML = '';
        grid.style.gridTemplateColumns = `repeat(${N}, 1fr)`;
        cells.forEach((c, i) => {
          const d = document.createElement('div');
          d.className = 'mine-cell' + (c.open ? ' open' : '');
          if (c.open) {
            if (c.mine) d.textContent = '💣';
            else if (c.n) { d.textContent = c.n; d.dataset.n = c.n; }
          } else if (c.flag) d.textContent = '🚩';
          d.onclick = () => open(i);
          d.oncontextmenu = e => {
            e.preventDefault();
            if (over || c.open) return;
            c.flag = !c.flag; flags += c.flag ? 1 : -1;
            flagsEl.textContent = '🚩 ' + (MINES - flags); render();
          };
          grid.appendChild(d);
        });
      }
      body.querySelector('.mine-reset').onclick = reset;
      reset();
    }
  });

  /* ---------------------------------------------------------------
     MUSIC — a Web-Audio step sequencer
  --------------------------------------------------------------- */
  def({
    id: 'music', title: 'Music', icon: '🎵', width: 440, height: 320, single: true,
    build(body, win) {
      const NOTES = ['C5', 'A4', 'G4', 'E4', 'D4', 'C4'];
      const FREQ = { C5: 523.25, A4: 440, G4: 392, E4: 329.63, D4: 293.66, C4: 261.63 };
      const STEPS = 16;
      const cellOn = NOTES.map(() => new Array(STEPS).fill(false));
      let ac = null, playing = false, step = 0, timer = null, bpm = 120;

      body.innerHTML = `
        <div class="music-wrap">
          <div class="ed-bar">
            <button class="btn music-play">▶ Play</button>
            <button class="btn ghost music-clear">Clear</button>
            <label class="muted" style="margin-left:auto">Tempo <input type="range" min="60" max="220" value="120" class="music-bpm"></label>
            <span class="muted music-bpmval">120</span>
          </div>
          <div class="music-grid"></div>
        </div>`;
      const grid = body.querySelector('.music-grid');
      NOTES.forEach((note, r) => {
        const row = document.createElement('div'); row.className = 'music-row';
        const lbl = document.createElement('span'); lbl.className = 'music-lbl'; lbl.textContent = note; row.appendChild(lbl);
        for (let s = 0; s < STEPS; s++) {
          const cell = document.createElement('div');
          cell.className = 'music-cell' + (s % 4 === 0 ? ' beat' : '');
          cell.dataset.r = r; cell.dataset.s = s;
          cell.onclick = () => { cellOn[r][s] = !cellOn[r][s]; cell.classList.toggle('active'); };
          row.appendChild(cell);
        }
        grid.appendChild(row);
      });

      function beep(freq) {
        if (!ac) ac = new (window.AudioContext || window.webkitAudioContext)();
        const o = ac.createOscillator(), g = ac.createGain();
        o.type = 'triangle'; o.frequency.value = freq;
        g.gain.setValueAtTime(0.0001, ac.currentTime);
        g.gain.exponentialRampToValueAtTime(0.22, ac.currentTime + 0.01);
        g.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + 0.25);
        o.connect(g); g.connect(ac.destination);
        o.start(); o.stop(ac.currentTime + 0.26);
      }
      function tick() {
        grid.querySelectorAll('.music-cell').forEach(c => c.classList.toggle('playhead', +c.dataset.s === step));
        NOTES.forEach((n, r) => { if (cellOn[r][step]) beep(FREQ[n]); });
        step = (step + 1) % STEPS;
        timer = setTimeout(tick, (60 / bpm) * 1000 / 4);
      }
      const playBtn = body.querySelector('.music-play');
      playBtn.onclick = () => {
        playing = !playing;
        if (playing) { if (!ac) ac = new (window.AudioContext || window.webkitAudioContext)(); step = 0; playBtn.textContent = '⏸ Stop'; tick(); }
        else { clearTimeout(timer); playBtn.textContent = '▶ Play'; grid.querySelectorAll('.playhead').forEach(c => c.classList.remove('playhead')); }
      };
      body.querySelector('.music-clear').onclick = () => {
        cellOn.forEach(row => row.fill(false));
        grid.querySelectorAll('.music-cell').forEach(c => c.classList.remove('active'));
      };
      body.querySelector('.music-bpm').oninput = e => { bpm = +e.target.value; body.querySelector('.music-bpmval').textContent = bpm; };
      win.onClose = () => { clearTimeout(timer); if (ac) ac.close(); };
    }
  });

  /* ---------------------------------------------------------------
     NIMBUS BROWSER — a real web browser (iframe) with tabs, history,
     bookmarks, a start page, and a graceful fallback for sites that
     refuse to be embedded (X-Frame-Options / CSP).
  --------------------------------------------------------------- */
  def({
    id: 'browser', title: 'Nimbus Browser', icon: '🌐', width: 720, height: 500,
    build(body, win, arg) {
      const HOME = 'home://';   // the NimbusNet portal
      let bookmarks;
      try { bookmarks = JSON.parse(localStorage.getItem('nimbus.bookmarks')) || []; }
      catch (e) { bookmarks = []; }
      // drop any old real-web bookmarks from earlier versions
      bookmarks = bookmarks.filter(b => typeof b.url === 'string' && b.url.startsWith('nim://'));
      function saveBM() { localStorage.setItem('nimbus.bookmarks', JSON.stringify(bookmarks)); }

      let tabs = [{ hist: [HOME], i: 0, title: 'NimbusNet' }];
      let active = 0;

      body.innerHTML = `
        <div class="br-wrap">
          <div class="br-tabs"></div>
          <div class="br-toolbar">
            <button class="br-btn" data-a="back" title="Back">‹</button>
            <button class="br-btn" data-a="fwd" title="Forward">›</button>
            <button class="br-btn" data-a="reload" title="Reload">⟳</button>
            <button class="br-btn" data-a="home" title="NimbusNet home">⌂</button>
            <div class="br-omni">
              <span class="br-lock">🌐</span>
              <input class="br-url" placeholder="Search NimbusNet, or type a domain like cool.nim" spellcheck="false">
              <button class="br-btn br-star" data-a="star" title="Bookmark">☆</button>
            </div>
          </div>
          <div class="br-view">
            <iframe class="br-frame" sandbox="allow-scripts allow-same-origin allow-forms allow-popups"></iframe>
            <div class="br-start"></div>
          </div>
        </div>`;

      const tabsEl = body.querySelector('.br-tabs');
      const urlEl = body.querySelector('.br-url');
      const frame = body.querySelector('.br-frame');
      const startEl = body.querySelector('.br-start');
      const starBtn = body.querySelector('.br-star');

      function curTab() { return tabs[active]; }
      function curURL() { const t = curTab(); return t.hist[t.i]; }

      // a valid NimbusNet domain "name.tld" (our TLDs only), else null
      function asDomain(input) {
        const s = String(input || '').toLowerCase().replace(/^nim:\/\//, '').trim();
        const m = s.match(/^([a-z0-9](?:[a-z0-9-]{0,28}[a-z0-9])?)\.([a-z]+)$/);
        return (m && Net.TLDS.includes(m[2])) ? s : null;
      }
      function navigate(url) {
        const t = curTab();
        t.hist = t.hist.slice(0, t.i + 1);
        t.hist.push(url); t.i = t.hist.length - 1;
        render();
      }
      // anything that's a domain → visit it; otherwise → search the portal
      function go(input) {
        const s = (input || '').trim();
        const dom = asDomain(s);
        navigate(dom ? 'nim://' + dom : 'home://' + encodeURIComponent(s));
      }

      function render() {
        const url = curURL();
        const isHome = url.startsWith('home://');
        const isNim = url.startsWith('nim://');
        urlEl.value = isNim ? url.slice(6) : (isHome ? decodeURIComponent(url.slice(7)) : '');
        startEl.style.display = isHome ? '' : 'none';
        frame.style.display = isHome ? 'none' : '';
        starBtn.style.visibility = isNim ? 'visible' : 'hidden';
        starBtn.textContent = bookmarks.some(b => b.url === url) ? '★' : '☆';
        body.querySelector('[data-a="back"]').disabled = curTab().i <= 0;
        body.querySelector('[data-a="fwd"]').disabled = curTab().i >= curTab().hist.length - 1;
        if (isHome) { const q = decodeURIComponent(url.slice(7)); curTab().title = q ? 'Search: ' + q : 'NimbusNet'; renderHome(q); }
        else if (isNim) { curTab().title = url.slice(6); loadNim(url.slice(6)); }
        renderTabs();
        win.el.querySelector('.win-title').innerHTML = `<span class="win-ico">🌐</span> ${esc(curTab().title)}`;
      }

      // resolve a NimbusNet domain from the registry and render its HTML
      function loadNim(domain) {
        frame.removeAttribute('src');
        frame.srcdoc = `<body style="font:15px system-ui;color:#8a90a6;text-align:center;padding:60px">Loading ${esc(domain)}…</body>`;
        Net.getSite(domain).then(site => {
          if (curURL() !== 'nim://' + domain) return; // tab moved on
          frame.srcdoc = site.html;
          curTab().title = domain; renderTabs();
          win.el.querySelector('.win-title').innerHTML = `<span class="win-ico">🌐</span> ${esc(site.title || domain)}`;
        }).catch(e => {
          frame.srcdoc = `<body style="font:15px system-ui;color:#555;text-align:center;padding:56px">
            <div style="font-size:42px">🌐</div><h2 style="margin:10px 0 4px">${esc(domain)}</h2>
            <p>${esc(e.message)}</p>
            <p style="color:#9aa0b8">Nobody has claimed <b>${esc(domain)}</b> yet — grab it in 🛠️ Web Studio.</p></body>`;
        });
      }

      let allSites = null;
      function renderHome(query) {
        const pinned = bookmarks.length
          ? `<div class="br-tiles">${bookmarks.map((b, i) =>
              `<div class="br-tile" data-nim="${esc(b.url.slice(6))}"><span class="br-tile-x" data-rm="${i}">×</span><div class="bt-ico">🔖</div><div class="bt-name">${esc(b.name)}</div></div>`).join('')}</div>`
          : '';
        startEl.innerHTML = `
          <div class="br-start-inner">
            <div class="br-logo">◈ NimbusNet</div>
            <div class="br-tag">your own internet</div>
            <div class="br-search"><input class="br-search-in" placeholder="Search NimbusNet, or type a domain like cool.nim" spellcheck="false" value="${esc(query || '')}"></div>
            ${pinned}
            <div class="br-net">
              <div class="br-net-h"><span>🌐 ${query ? 'Results' : 'Recently published'}</span><span class="muted br-net-count"></span></div>
              <div class="br-net-list"><span class="muted">Loading…</span></div>
            </div>
            <div class="br-tip">Endings on NimbusNet: ${Net.TLDS.map(t => '<b>.' + t + '</b>').join(' ')} — make your own site in 🛠️ Web Studio.</div>
          </div>`;
        const si = startEl.querySelector('.br-search-in');
        si.oninput = () => paint(allSites || [], si.value);
        si.onkeydown = e => { if (e.key === 'Enter' && asDomain(si.value.trim())) go(si.value); };
        setTimeout(() => { si.focus(); si.setSelectionRange(si.value.length, si.value.length); }, 30);
        startEl.querySelectorAll('.br-tile[data-nim]').forEach(t => {
          t.onclick = e => { if (e.target.dataset.rm != null) return; go(t.dataset.nim); };
          const x = t.querySelector('.br-tile-x');
          if (x) x.onclick = e => { e.stopPropagation(); bookmarks.splice(+x.dataset.rm, 1); saveBM(); renderHome(query); };
        });

        function paint(sites, q) {
          const list = startEl.querySelector('.br-net-list'); if (!list) return;
          const cnt = startEl.querySelector('.br-net-count');
          const ql = (q || '').toLowerCase().trim();
          const filtered = ql ? sites.filter(s => s.domain.includes(ql) || (s.title || '').toLowerCase().includes(ql) || (s.owner || '').toLowerCase().includes(ql)) : sites;
          if (cnt) cnt.textContent = filtered.length + ' site' + (filtered.length === 1 ? '' : 's');
          if (!filtered.length) { list.innerHTML = `<span class="muted">${ql ? 'No sites match “' + esc(q) + '”.' : 'No sites yet — be the first in 🛠️ Web Studio!'}</span>`; return; }
          list.innerHTML = filtered.map(s =>
            `<div class="br-net-item" data-nim="${esc(s.domain)}"><b>${esc(s.domain)}</b><span class="bn-t">${esc(s.title)}</span><span class="muted bn-m">${esc(s.owner)} · ${s.views || 0}👁</span>${Net.isAdmin() ? `<button class="bn-del" data-del="${esc(s.domain)}" title="Admin: remove">🗑</button>` : ''}</div>`).join('');
          list.querySelectorAll('[data-nim]').forEach(it => it.onclick = e => { if (e.target.dataset.del != null) return; go(it.dataset.nim); });
          list.querySelectorAll('[data-del]').forEach(b => b.onclick = async e => {
            e.stopPropagation();
            const dom = b.dataset.del;
            if (!(await UI.confirm({ title: 'Remove ' + dom + '?', body: 'Admin moderation — this deletes the site for everyone on NimbusNet.', ok: 'Remove', danger: true }))) return;
            try { await Net.deleteSite(dom); OS.notify('🛡️', 'Removed', dom); allSites = allSites.filter(s => s.domain !== dom); paint(allSites, startEl.querySelector('.br-search-in').value); }
            catch (err) { UI.alert({ title: 'Could not remove', body: err.message }); }
          });
        }
        Net.directory().then(sites => { allSites = sites; paint(sites, query); })
          .catch(e => { const list = startEl.querySelector('.br-net-list'); if (list) list.innerHTML = '<span class="muted">NimbusNet is offline right now.</span>'; });
      }

      function renderTabs() {
        tabsEl.innerHTML = tabs.map((t, idx) =>
          `<div class="br-tab ${idx === active ? 'active' : ''}" data-i="${idx}">
            <span class="bt-title">${esc(t.title)}</span>
            <span class="bt-close" data-close="${idx}">×</span>
          </div>`).join('') + `<button class="br-newtab" title="New tab">+</button>`;
        tabsEl.querySelectorAll('.br-tab').forEach(el => {
          el.onclick = e => { if (e.target.dataset.close != null) return; active = +el.dataset.i; render(); };
          const c = el.querySelector('.bt-close');
          c.onclick = e => { e.stopPropagation(); closeTab(+c.dataset.close); };
        });
        tabsEl.querySelector('.br-newtab').onclick = () => {
          tabs.push({ hist: [HOME], i: 0, title: 'NimbusNet' }); active = tabs.length - 1; render();
        };
      }
      function closeTab(i) {
        tabs.splice(i, 1);
        if (!tabs.length) tabs.push({ hist: [HOME], i: 0, title: 'NimbusNet' });
        active = Math.min(active, tabs.length - 1);
        render();
      }

      urlEl.addEventListener('keydown', e => { if (e.key === 'Enter') go(urlEl.value); });
      body.querySelector('[data-a="back"]').onclick = () => { const t = curTab(); if (t.i > 0) { t.i--; render(); } };
      body.querySelector('[data-a="fwd"]').onclick = () => { const t = curTab(); if (t.i < t.hist.length - 1) { t.i++; render(); } };
      body.querySelector('[data-a="reload"]').onclick = () => render();
      body.querySelector('[data-a="home"]').onclick = () => navigate(HOME);
      starBtn.onclick = () => {
        const url = curURL(); if (!url.startsWith('nim://')) return;
        const at = bookmarks.findIndex(b => b.url === url);
        if (at >= 0) bookmarks.splice(at, 1);
        else bookmarks.push({ name: url.slice(6), url });
        saveBM(); render();
      };

      // optional launch arg = domain to open ('nimbusnet' just shows the portal)
      if (arg && arg !== 'nimbusnet') go(arg);
      else render();
    }
  });

  /* ---------------------------------------------------------------
     ACTIVITY MONITOR — lists open windows as "processes"; force-quit.
  --------------------------------------------------------------- */
  def({
    id: 'activity', title: 'Activity Monitor', icon: '📊', width: 460, height: 360, single: true,
    build(body, win) {
      body.innerHTML = `
        <div class="act-wrap">
          <div class="act-head">
            <div class="act-gauge"><div class="ag-label">CPU</div><div class="ag-bar"><div class="ag-fill cpu"></div></div><div class="ag-val cpu-v"></div></div>
            <div class="act-gauge"><div class="ag-label">Memory</div><div class="ag-bar"><div class="ag-fill mem"></div></div><div class="ag-val mem-v"></div></div>
          </div>
          <div class="act-list"></div>
        </div>`;
      const cpuFill = body.querySelector('.ag-fill.cpu'), memFill = body.querySelector('.ag-fill.mem');
      const cpuV = body.querySelector('.cpu-v'), memV = body.querySelector('.mem-v');
      const list = body.querySelector('.act-list');
      const seeds = {};
      function render() {
        const wins = Object.values(WM.wins());
        // system processes always present
        const procs = [{ name: 'Nimbus Kernel', appId: null, sys: true }, { name: 'WindowServer', appId: null, sys: true }, { name: 'Dock', appId: null, sys: true }];
        wins.forEach(w => procs.push({ name: (Apps.reg[w.appId] ? Apps.reg[w.appId].title : w.appId), appId: w.appId, id: w.id }));
        let totalCpu = 3;
        list.innerHTML = procs.map((p, i) => {
          const key = p.id || p.name;
          if (seeds[key] == null) seeds[key] = Math.random();
          const cpu = p.sys ? (seeds[key] * 1.5).toFixed(1) : (seeds[key] * 9 + 0.2).toFixed(1);
          const mem = p.sys ? Math.round(seeds[key] * 40 + 20) : Math.round(seeds[key] * 120 + 30);
          totalCpu += +cpu;
          return `<div class="act-row">
            <span class="ar-icon">${p.appId && Apps.reg[p.appId] ? Apps.reg[p.appId].icon : '⚙️'}</span>
            <span class="ar-name">${esc(p.name)}</span>
            <span class="ar-cpu">${cpu}%</span>
            <span class="ar-mem">${mem} MB</span>
            ${p.id ? `<button class="ar-kill" data-kill="${p.id}" title="Force quit">⏻</button>` : '<span class="ar-kill-sp"></span>'}
          </div>`;
        }).join('');
        list.querySelectorAll('[data-kill]').forEach(b => b.onclick = () => { WM.close(b.dataset.kill); setTimeout(render, 160); });
        cpuFill.style.width = Math.min(100, totalCpu) + '%'; cpuV.textContent = totalCpu.toFixed(0) + '%';
        const memUsed = 1.2 + wins.length * 0.4;
        memFill.style.width = Math.min(100, memUsed / 8 * 100) + '%'; memV.textContent = memUsed.toFixed(1) + ' / 8 GB';
      }
      render();
      const iv = setInterval(() => { Object.keys(seeds).forEach(k => { seeds[k] += (Math.random() - 0.5) * 0.12; seeds[k] = Math.max(0.02, Math.min(1, seeds[k])); }); render(); }, 1500);
      win.onClose = () => clearInterval(iv);
      document.addEventListener('wm:close', render);
      document.addEventListener('wm:open', render);
    }
  });

  /* ---------------------------------------------------------------
     CALENDAR — a month grid with today highlighted
  --------------------------------------------------------------- */
  def({
    id: 'calendar', title: 'Calendar', icon: '📅', width: 360, height: 360, single: true,
    build(body) {
      const now = new Date();
      let y = now.getFullYear(), m = now.getMonth();
      const MON = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
      function render() {
        const first = new Date(y, m, 1).getDay();
        const days = new Date(y, m + 1, 0).getDate();
        let cells = '';
        for (let i = 0; i < first; i++) cells += '<div class="cal-cell empty"></div>';
        for (let d = 1; d <= days; d++) {
          const today = d === now.getDate() && m === now.getMonth() && y === now.getFullYear();
          cells += `<div class="cal-cell ${today ? 'today' : ''}">${d}</div>`;
        }
        body.innerHTML = `
          <div class="cal-app">
            <div class="cal-bar">
              <button class="fbtn" data-a="prev">‹</button>
              <span class="cal-title">${MON[m]} ${y}</span>
              <button class="fbtn" data-a="next">›</button>
            </div>
            <div class="cal-dow">${['S', 'M', 'T', 'W', 'T', 'F', 'S'].map(d => `<span>${d}</span>`).join('')}</div>
            <div class="cal-grid">${cells}</div>
          </div>`;
        body.querySelector('[data-a="prev"]').onclick = () => { m--; if (m < 0) { m = 11; y--; } render(); };
        body.querySelector('[data-a="next"]').onclick = () => { m++; if (m > 11) { m = 0; y++; } render(); };
      }
      render();
    }
  });

  /* ---------------------------------------------------------------
     PHOTOS — a gallery of images saved in /Pictures (e.g. from Paint)
  --------------------------------------------------------------- */
  def({
    id: 'photos', title: 'Photos', icon: '🖼️', width: 480, height: 380, single: true,
    build(body, win) {
      function render() {
        const items = (FS.list('/Pictures') || []).filter(it => it.type === 'file' && /\.(png|jpg|jpeg|gif|svg)$/i.test(it.name));
        if (!items.length) {
          body.innerHTML = `<div class="muted pad" style="text-align:center;padding-top:60px">No photos yet.<br>Make one in 🎨 Paint and save it to /Pictures.</div>`;
          return;
        }
        body.innerHTML = `<div class="photos-grid">${items.map(it => {
          const data = FS.read('/Pictures/' + it.name);
          return `<figure class="photo-cell" data-name="${esc(it.name)}"><img src="${data}" alt=""><figcaption>${esc(it.name)}</figcaption></figure>`;
        }).join('')}</div>`;
        body.querySelectorAll('.photo-cell').forEach(c => c.onclick = () => Apps.launch('viewer', '/Pictures/' + c.dataset.name));
      }
      render();
      win._refresh = render;
    }
  });

  /* ---------------------------------------------------------------
     ACCOUNT — sign in / create a NimbusNet account
  --------------------------------------------------------------- */
  def({
    id: 'account', title: 'Account', icon: '👤', width: 340, height: 380, single: true,
    build(body) {
      let mode = 'login';
      function render() {
        if (Net.isAuthed()) {
          const u = Net.user();
          body.innerHTML = `
            <div class="acct">
              <div class="acct-avatar">${esc((u.display || u.username)[0].toUpperCase())}</div>
              <div class="acct-name">${esc(u.display)} ${Net.isAdmin() ? '<span class="acct-badge">🛡️ ADMIN</span>' : ''}</div>
              <div class="muted">@${esc(u.username)}</div>
              <button class="btn" data-a="studio">Open Web Studio</button>
              <button class="btn ghost" data-a="browse">Browse NimbusNet</button>
              <button class="btn ghost" data-a="logout">Sign out</button>
            </div>`;
          body.querySelector('[data-a="studio"]').onclick = () => Apps.launch('studio');
          body.querySelector('[data-a="browse"]').onclick = () => Apps.launch('browser', 'nimbusnet');
          body.querySelector('[data-a="logout"]').onclick = async () => { await Net.logout(); OS.notify('👤', 'Signed out', ''); render(); };
          return;
        }
        body.innerHTML = `
          <div class="acct">
            <div class="acct-logo">◈ NimbusNet</div>
            <div class="acct-tabs">
              <button class="${mode === 'login' ? 'on' : ''}" data-m="login">Sign in</button>
              <button class="${mode === 'signup' ? 'on' : ''}" data-m="signup">Create account</button>
            </div>
            <input class="fld" data-f="username" placeholder="Username" autocapitalize="off" autocomplete="off" spellcheck="false">
            ${mode === 'signup' ? '<input class="fld" data-f="display" placeholder="Display name (optional)">' : ''}
            <input class="fld" type="password" data-f="password" placeholder="Password">
            <div class="acct-err"></div>
            <button class="btn" data-a="go">${mode === 'login' ? 'Sign in' : 'Create account'}</button>
            <div class="muted acct-fine">Passwords are salted &amp; hashed (PBKDF2) on the server — never stored as plain text.</div>
          </div>`;
        body.querySelectorAll('[data-m]').forEach(b => b.onclick = () => { mode = b.dataset.m; render(); });
        const err = body.querySelector('.acct-err');
        const val = f => { const el = body.querySelector(`[data-f="${f}"]`); return el ? el.value : ''; };
        async function submit() {
          err.textContent = '';
          const go = body.querySelector('[data-a="go"]'); go.disabled = true;
          try {
            if (mode === 'login') await Net.login(val('username'), val('password'));
            else await Net.signup(val('username'), val('password'), val('display'));
            OS.notify('👤', 'Signed in', 'Welcome, ' + Net.user().display + '!');
            render();
          } catch (e) { err.textContent = e.message; go.disabled = false; }
        }
        body.querySelector('[data-a="go"]').onclick = submit;
        body.querySelectorAll('.fld').forEach(i => i.addEventListener('keydown', e => { if (e.key === 'Enter') submit(); }));
        setTimeout(() => { const f = body.querySelector('[data-f="username"]'); if (f) f.focus(); }, 40);
      }
      render();
    }
  });

  /* ---------------------------------------------------------------
     WEB STUDIO — build & publish a .nim site (code + visual insert,
     live preview). Talks to the NimbusNet backend via Net.
  --------------------------------------------------------------- */
  const SITE_TEMPLATE =
`<!doctype html>
<html>
<head>
<meta charset="utf-8">
<title>My Page</title>
<style>
  body{ font-family:system-ui,-apple-system,sans-serif; max-width:640px; margin:48px auto;
        padding:0 22px; line-height:1.6; color:#1b1e2c; }
  h1{ color:#4263eb; }
  a{ color:#4263eb; }
</style>
</head>
<body>
  <h1>Welcome to my site</h1>
  <p>This page is published on NimbusNet. Edit me in Web Studio, then visit my domain in Nimbus Browser!</p>
</body>
</html>`;
  const INSERTS = {
    h1: '<h1>Heading</h1>\n',
    p: '<p>Some text goes here.</p>\n',
    img: '<img src="https://picsum.photos/480/240" alt="" style="max-width:100%;border-radius:10px">\n',
    button: '<button onclick="alert(\'Hi!\')">Click me</button>\n',
    list: '<ul>\n  <li>First item</li>\n  <li>Second item</li>\n</ul>\n',
    link: '<a href="https://example.com">a link</a>\n'
  };
  def({
    id: 'studio', title: 'Web Studio', icon: '🛠️', width: 780, height: 540, single: true,
    build(body, win) {
      let view = null;
      function mount() {
        if (!Net.isAuthed()) { if (view !== 'signin') renderSignin(); return; }
        if (view !== 'editor') renderEditor();
      }
      function renderSignin() {
        view = 'signin';
        body.innerHTML = `<div class="studio-signin">
          <div class="acct-logo">🛠️ Web Studio</div>
          <p class="muted">Sign in to build and publish your own sites on NimbusNet.</p>
          <button class="btn" data-a="signin">Sign in / Create account</button></div>`;
        body.querySelector('[data-a="signin"]').onclick = () => Apps.launch('account');
      }
      function renderEditor() {
        view = 'editor';
        const cur = { name: '', tld: 'nim', title: 'My Page', html: SITE_TEMPLATE };
        const splitDomain = d => { const i = d.lastIndexOf('.'); return { name: d.slice(0, i), tld: d.slice(i + 1) }; };
        body.innerHTML = `
          <div class="studio">
            <div class="studio-bar">
              <select class="studio-sites fld"><option value="">My sites…</option></select>
              <button class="fbtn" data-a="new" title="New page">＋</button>
              <span class="studio-dom"><input class="fld studio-name" placeholder="name" spellcheck="false"><span class="muted">.</span><select class="studio-tld">${Net.TLDS.map(t => `<option value="${t}">${t}</option>`).join('')}</select></span>
              <input class="fld studio-title" placeholder="Page title">
              <button class="btn" data-a="publish">Publish</button>
              <button class="btn ghost" data-a="open" title="Open in browser">↗</button>
            </div>
            <div class="studio-tools">
              ${Object.keys(INSERTS).map(k => `<button data-ins="${k}">+ ${k === 'h1' ? 'Heading' : k === 'p' ? 'Text' : k.charAt(0).toUpperCase() + k.slice(1)}</button>`).join('')}
              <span class="studio-status muted"></span>
            </div>
            <div class="studio-split">
              <textarea class="studio-code" spellcheck="false"></textarea>
              <iframe class="studio-prev" sandbox="allow-scripts allow-same-origin"></iframe>
            </div>
          </div>`;
        const nameEl = body.querySelector('.studio-name');
        const tldEl = body.querySelector('.studio-tld');
        const titleEl = body.querySelector('.studio-title');
        const codeEl = body.querySelector('.studio-code');
        const prev = body.querySelector('.studio-prev');
        const sel = body.querySelector('.studio-sites');
        const status = body.querySelector('.studio-status');
        let previewT = null;

        function load() { nameEl.value = cur.name; tldEl.value = cur.tld; titleEl.value = cur.title; codeEl.value = cur.html; updatePreview(); }
        function updatePreview() { prev.srcdoc = codeEl.value; }
        codeEl.addEventListener('input', () => { cur.html = codeEl.value; clearTimeout(previewT); previewT = setTimeout(updatePreview, 350); });
        nameEl.addEventListener('input', () => cur.name = nameEl.value);
        tldEl.addEventListener('change', () => cur.tld = tldEl.value);
        titleEl.addEventListener('input', () => cur.title = titleEl.value);

        body.querySelectorAll('[data-ins]').forEach(b => b.onclick = () => {
          const snip = INSERTS[b.dataset.ins];
          const s = codeEl.selectionStart, e = codeEl.selectionEnd;
          codeEl.value = codeEl.value.slice(0, s) + snip + codeEl.value.slice(e);
          codeEl.selectionStart = codeEl.selectionEnd = s + snip.length;
          cur.html = codeEl.value; updatePreview(); codeEl.focus();
        });
        body.querySelector('[data-a="new"]').onclick = () => { Object.assign(cur, { name: '', tld: 'nim', title: 'My Page', html: SITE_TEMPLATE }); sel.value = ''; load(); };
        body.querySelector('[data-a="open"]').onclick = () => { if (cur.name) Apps.launch('browser', cur.name + '.' + cur.tld); };
        body.querySelector('[data-a="publish"]').onclick = async () => {
          const name = (nameEl.value || '').trim();
          if (!name) { status.textContent = 'Pick a domain name first.'; return; }
          const domain = name + '.' + tldEl.value;
          status.textContent = 'Publishing…';
          try {
            const r = await Net.publish(domain, titleEl.value || 'Untitled', codeEl.value);
            const sp = splitDomain(r.domain); cur.name = sp.name; cur.tld = sp.tld;
            status.textContent = 'Published to ' + r.domain;
            OS.notify('🛠️', 'Published', r.domain + ' is live on NimbusNet');
            await refreshSites(); sel.value = r.domain;
          } catch (e) { status.textContent = ''; UI.alert({ title: 'Couldn’t publish', body: e.message }); }
        };
        sel.onchange = async () => {
          if (!sel.value) return;
          status.textContent = 'Loading…';
          try { const site = await Net.getSite(sel.value); const sp = splitDomain(site.domain); Object.assign(cur, { name: sp.name, tld: sp.tld, title: site.title, html: site.html }); load(); status.textContent = ''; }
          catch (e) { status.textContent = e.message; }
        };
        async function refreshSites() {
          try {
            const mine = await Net.mySites();
            sel.innerHTML = '<option value="">My sites…</option>' + mine.map(s => `<option value="${esc(s.domain)}">${esc(s.domain)}</option>`).join('');
          } catch (e) {}
        }
        load(); refreshSites();
      }
      const onAuth = () => mount();
      document.addEventListener('nimbus:auth', onAuth);
      win.onClose = () => document.removeEventListener('nimbus:auth', onAuth);
      mount();
    }
  });

  /* ===============================================================
     NIMBUS APP SDK — host runtime
     Third-party apps run in a sandboxed iframe (NO same-origin: they
     get an opaque origin and can't touch the OS) and talk to the host
     only through the postMessage bridge below.
     =============================================================== */
  const SDK_URL = (function () { try { return new URL('nimbus-sdk.js', location.href).href; } catch (e) { return 'nimbus-sdk.js'; } })();
  function wrapApp(html) { return '<!doctype html><script src="' + SDK_URL + '"></script>\n' + html; }
  // build the runnable document from an app's parts (html / css / js).
  // Apps published before multi-file support stored a full doc in `html`.
  function buildAppDoc(rec) {
    if (rec.css || rec.js) {
      return `<!doctype html><html><head><meta charset="utf-8"><style>\n${rec.css || ''}\n</style></head><body>\n${rec.html || ''}\n<script>\n${rec.js || ''}\n<\/script></body></html>`;
    }
    return rec.html || '';
  }

  function attachBridge(frame, ctx) {
    const pre = 'nimbus.app.' + ctx.id + '.';
    async function handle(type, p) {
      switch (type) {
        case 'ready': return { ok: true };
        case 'notify': OS.notify(ctx.icon || '📦', p.title || ctx.name || 'App', p.body || ''); return { ok: true };
        case 'setTitle': if (ctx.win) ctx.win.el.querySelector('.win-title').innerHTML = `<span class="win-ico">${ctx.icon || '📦'}</span> ${esc(p.title || '')}`; return { ok: true };
        case 'close': if (ctx.win) WM.close(ctx.win.id); return { ok: true };
        case 'user': return Net.isAuthed() ? { username: Net.user().username, display: Net.user().display, admin: Net.isAdmin() } : null;
        case 'storage.get': try { return JSON.parse(localStorage.getItem(pre + p.key)); } catch (e) { return null; }
        case 'storage.set': try { localStorage.setItem(pre + p.key, JSON.stringify(p.value)); } catch (e) {} return { ok: true };
        case 'storage.keys': return Object.keys(localStorage).filter(k => k.indexOf(pre) === 0).map(k => k.slice(pre.length));
        case 'net.directory': return await Net.directory();
        case 'net.getSite': return await Net.getSite(p.domain);
        case 'openSite': Apps.launch('browser', p.domain); return { ok: true };
        default: return { error: 'unknown command: ' + type };
      }
    }
    async function onMsg(e) {
      if (e.source !== frame.contentWindow) return;
      const d = e.data; if (!d || !d.__nimbus) return;
      let result = null;
      try { result = await handle(d.type, d.payload || {}); } catch (err) { result = { error: err.message }; }
      try { frame.contentWindow.postMessage({ __nimbusReply: 1, id: d.id, result }, '*'); } catch (e2) {}
    }
    window.addEventListener('message', onMsg);
    return () => window.removeEventListener('message', onMsg);
  }

  function runAppRecord(rec) {
    return WM.open({
      appId: 'user:' + rec.id, title: rec.name, appTitle: rec.name, icon: rec.icon || '📦', width: 520, height: 440,
      build: (b, w) => {
        b.style.background = '#fff';
        const frame = document.createElement('iframe');
        frame.className = 'userapp-frame';
        frame.setAttribute('sandbox', 'allow-scripts allow-modals');
        b.appendChild(frame);
        const detach = attachBridge(frame, { id: rec.id, name: rec.name, icon: rec.icon, win: w });
        frame.srcdoc = wrapApp(buildAppDoc(rec));
        w.onClose = detach;
      }
    });
  }
  // Opening an app requires it to be installed — if it isn't, install it first
  // (so an app can never run while uninstalled).
  async function launchUserApp(id) {
    let app;
    try { app = await Net.getApp(id); }
    catch (e) { UI.alert({ title: 'Couldn’t open app', body: e.message }); return; }
    if (!getInstalled().find(a => a.id === id)) {
      installApp({ id: app.id, name: app.name, icon: app.icon });
      OS.notify('🛍️', 'Installed', app.name + ' was added to your apps');
    }
    runAppRecord(app);
  }

  // installed apps (local)
  function getInstalled() { try { return JSON.parse(localStorage.getItem('nimbus.installed')) || []; } catch (e) { return []; } }
  function setInstalled(l) { localStorage.setItem('nimbus.installed', JSON.stringify(l)); document.dispatchEvent(new CustomEvent('nimbus:installed')); }
  function installApp(meta) { const l = getInstalled(); if (!l.find(a => a.id === meta.id)) { l.push({ id: meta.id, name: meta.name, icon: meta.icon }); setInstalled(l); } }
  function uninstallApp(id) { setInstalled(getInstalled().filter(a => a.id !== id)); }

  // Starter app, split into the three languages.
  const TPL = {
    html: `<h1 id="n">0</h1>
<button onclick="tick()">＋ Count</button>
<button id="notifyBtn">Notify me</button>`,
    css: `body{ font-family:system-ui,sans-serif; margin:0; padding:28px; color:#1b1e2c; text-align:center; }
h1{ font-size:52px; margin:8px 0 18px; }
button{ font:inherit; padding:10px 18px; border:none; border-radius:10px; background:#4263eb; color:#fff; cursor:pointer; margin:3px; }`,
    js: `// Every app gets a global "nimbus" object (the SDK). Try: nimbus.user(),
// nimbus.net.directory(), nimbus.openSite('cool.nim'). State persists per app.
let n = 0;
const el = document.getElementById('n');
nimbus.storage.get('count').then(v => { n = v || 0; el.textContent = n; });
function tick() { n++; el.textContent = n; nimbus.storage.set('count', n); }
document.getElementById('notifyBtn').onclick = () => nimbus.notify('Counter', 'You reached ' + n + '!');`
  };

  /* ---------------------------------------------------------------
     APP STORE — discover / install / build & publish Nimbus apps
  --------------------------------------------------------------- */
  def({
    id: 'appstore', title: 'App Store', icon: '🛍️', width: 660, height: 500, single: true,
    build(body) {
      let tab = 'discover';
      body.innerHTML = `
        <div class="store">
          <div class="store-tabs">
            <button data-t="discover" class="on">Discover</button>
            <button data-t="installed">Installed</button>
            <button data-t="develop">Build &amp; Publish</button>
          </div>
          <div class="store-body"></div>
        </div>`;
      const sb = body.querySelector('.store-body');
      body.querySelectorAll('.store-tabs button').forEach(b => b.onclick = () => {
        tab = b.dataset.t;
        body.querySelectorAll('.store-tabs button').forEach(x => x.classList.toggle('on', x === b));
        PANELS[tab]();
      });

      const PANELS = {
        async discover() {
          sb.innerHTML = '<div class="muted pad">Loading apps…</div>';
          let apps = [];
          try { apps = await Net.appsDirectory(); } catch (e) { sb.innerHTML = `<div class="muted pad">${esc(e.message)}</div>`; return; }
          if (!apps.length) { sb.innerHTML = '<div class="muted pad" style="text-align:center;padding-top:40px">No apps yet — build the first one in “Build &amp; Publish”!</div>'; return; }
          const inst = getInstalled().reduce((m, a) => (m[a.id] = 1, m), {});
          sb.innerHTML = `<div class="store-grid">${apps.map(a => `
            <div class="store-card">
              <div class="sc-icon">${esc(a.icon || '📦')}</div>
              <div class="sc-name">${esc(a.name)}</div>
              <div class="sc-meta muted">by ${esc(a.owner)} · ${a.installs || 0}↓</div>
              <div class="sc-actions">
                ${inst[a.id]
                  ? `<button class="btn" data-open="${esc(a.id)}">Open</button><button class="btn ghost" data-uninstall="${esc(a.id)}">Remove</button>`
                  : `<button class="btn" data-install="${esc(a.id)}" data-name="${esc(a.name)}" data-icon="${esc(a.icon || '📦')}">Install</button>`}
              </div>
            </div>`).join('')}</div>`;
          // open only works for installed apps; uninstalled show Install
          sb.querySelectorAll('[data-open]').forEach(b => b.onclick = () => launchUserApp(b.dataset.open));
          sb.querySelectorAll('[data-install]').forEach(b => b.onclick = () => {
            installApp({ id: b.dataset.install, name: b.dataset.name, icon: b.dataset.icon });
            OS.notify('🛍️', 'Installed', b.dataset.name + ' — open it from your dock, desktop, or Installed');
            PANELS.discover();
          });
          sb.querySelectorAll('[data-uninstall]').forEach(b => b.onclick = () => { uninstallApp(b.dataset.uninstall); PANELS.discover(); });
        },
        installed() {
          const apps = getInstalled();
          if (!apps.length) { sb.innerHTML = '<div class="muted pad" style="text-align:center;padding-top:40px">Nothing installed yet — grab something from Discover.</div>'; return; }
          sb.innerHTML = `<div class="store-grid">${apps.map(a => `
            <div class="store-card">
              <div class="sc-icon">${esc(a.icon || '📦')}</div>
              <div class="sc-name">${esc(a.name)}</div>
              <div class="sc-actions">
                <button class="btn" data-run="${esc(a.id)}">Open</button>
                <button class="btn ghost" data-uninstall="${esc(a.id)}">Remove</button>
              </div>
            </div>`).join('')}</div>`;
          sb.querySelectorAll('[data-run]').forEach(b => b.onclick = () => launchUserApp(b.dataset.run));
          sb.querySelectorAll('[data-uninstall]').forEach(b => b.onclick = () => { uninstallApp(b.dataset.uninstall); PANELS.installed(); });
        },
        develop() {
          if (!Net.isAuthed()) {
            sb.innerHTML = `<div class="store-signin"><p class="muted">Sign in to build and publish your own Nimbus apps.</p><button class="btn" data-a="signin">Sign in</button></div>`;
            sb.querySelector('[data-a="signin"]').onclick = () => Apps.launch('account');
            return;
          }
          const cur = { id: '', name: 'My App', icon: '📦', html: TPL.html, css: TPL.css, js: TPL.js };
          let lang = 'html';
          sb.innerHTML = `
            <div class="dev">
              <div class="dev-bar">
                <select class="dev-mine fld"><option value="">My apps…</option></select>
                <input class="fld dev-icon" maxlength="4" value="📦" title="Icon (emoji)">
                <input class="fld dev-id" placeholder="app-id" spellcheck="false">
                <input class="fld dev-name" placeholder="App name">
                <button class="btn dev-pub">Publish</button>
                <span class="dev-status muted"></span>
              </div>
              <div class="dev-split">
                <div class="dev-edit">
                  <div class="dev-langs">
                    <button data-l="html" class="on">HTML</button>
                    <button data-l="css">CSS</button>
                    <button data-l="js">JS</button>
                  </div>
                  <textarea class="dev-code" spellcheck="false"></textarea>
                </div>
                <iframe class="dev-prev" sandbox="allow-scripts allow-modals"></iframe>
              </div>
            </div>`;
          const idEl = sb.querySelector('.dev-id'), nameEl = sb.querySelector('.dev-name'), iconEl = sb.querySelector('.dev-icon');
          const codeEl = sb.querySelector('.dev-code'), prev = sb.querySelector('.dev-prev'), mine = sb.querySelector('.dev-mine'), status = sb.querySelector('.dev-status');
          let detach = null, t = null;
          function refreshPreview() {
            if (detach) detach();
            detach = attachBridge(prev, { id: idEl.value || 'preview', name: nameEl.value, icon: iconEl.value });
            prev.srcdoc = wrapApp(buildAppDoc(cur));
          }
          function showLang(l) {
            cur[lang] = codeEl.value;        // save current pane
            lang = l;
            sb.querySelectorAll('.dev-langs button').forEach(b => b.classList.toggle('on', b.dataset.l === l));
            codeEl.value = cur[lang] || '';
          }
          function load() { idEl.value = cur.id; nameEl.value = cur.name; iconEl.value = cur.icon; lang = 'html'; sb.querySelectorAll('.dev-langs button').forEach(b => b.classList.toggle('on', b.dataset.l === 'html')); codeEl.value = cur.html; refreshPreview(); }
          sb.querySelectorAll('.dev-langs button').forEach(b => b.onclick = () => showLang(b.dataset.l));
          codeEl.addEventListener('input', () => { cur[lang] = codeEl.value; clearTimeout(t); t = setTimeout(refreshPreview, 400); });
          iconEl.addEventListener('input', () => cur.icon = iconEl.value);
          nameEl.addEventListener('input', () => cur.name = nameEl.value);
          sb.querySelector('.dev-pub').onclick = async () => {
            cur[lang] = codeEl.value;
            const id = (idEl.value || '').trim().toLowerCase();
            if (!id) { status.textContent = 'Pick an app id.'; return; }
            status.textContent = 'Publishing…';
            try {
              await Net.publishApp({ id, name: nameEl.value || 'Untitled', icon: iconEl.value || '📦', html: cur.html, css: cur.css, js: cur.js });
              status.textContent = 'Published!';
              OS.notify('🛍️', 'App published', (nameEl.value || id) + ' is in the App Store');
              await refreshMine();
            } catch (e) { status.textContent = ''; UI.alert({ title: 'Couldn’t publish', body: e.message }); }
          };
          mine.onchange = async () => {
            if (!mine.value) return;
            try { const a = await Net.getApp(mine.value); Object.assign(cur, { id: a.id, name: a.name, icon: a.icon, html: a.html || '', css: a.css || '', js: a.js || '' }); load(); }
            catch (e) { status.textContent = e.message; }
          };
          async function refreshMine() {
            try { const m = await Net.myApps(); mine.innerHTML = '<option value="">My apps…</option>' + m.map(a => `<option value="${esc(a.id)}">${esc(a.icon)} ${esc(a.name)}</option>`).join(''); } catch (e) {}
          }
          load(); refreshMine();
        }
      };
      PANELS.discover();
    }
  });

  /* ---------------------------------------------------------------
     PEOPLE — the NimbusNet social layer: feed, profiles, follow, DMs
  --------------------------------------------------------------- */
  def({
    id: 'people', title: 'People', icon: '👥', width: 580, height: 540, single: true,
    build(body, win, arg) {
      let contentEl;
      function mount() {
        if (!Net.isAuthed()) {
          body.innerHTML = `<div class="store-signin"><div class="acct-logo">👥 People</div><p class="muted">Sign in to NimbusNet to follow people, see a feed, and send messages.</p><button class="btn" data-a="signin">Sign in</button></div>`;
          body.querySelector('[data-a="signin"]').onclick = () => Apps.launch('account');
          return;
        }
        shell();
        if (arg) openProfile(String(arg).replace(/^@/, ''));
        else show('feed');
      }
      function shell() {
        body.innerHTML = `
          <div class="ppl">
            <div class="ppl-top">
              <div class="ppl-tabs">
                <button data-v="feed" class="on">Feed</button>
                <button data-v="messages">Messages</button>
                <button data-v="me">My Profile</button>
              </div>
              <input class="fld ppl-find" placeholder="@username" spellcheck="false">
            </div>
            <div class="ppl-body"></div>
          </div>`;
        contentEl = body.querySelector('.ppl-body');
        body.querySelectorAll('.ppl-tabs button').forEach(b => b.onclick = () => { body.querySelectorAll('.ppl-tabs button').forEach(x => x.classList.toggle('on', x === b)); show(b.dataset.v); });
        const find = body.querySelector('.ppl-find');
        find.onkeydown = e => { if (e.key === 'Enter' && find.value.trim()) { openProfile(find.value.trim().replace(/^@/, '')); find.value = ''; } };
      }
      function show(v) {
        if (v === 'feed') renderFeed();
        else if (v === 'messages') renderConvos();
        else if (v === 'me') openProfile(Net.user().username);
      }

      async function renderFeed() {
        contentEl.innerHTML = '<div class="muted pad">Loading feed…</div>';
        let items;
        try { items = await Net.feed(); } catch (e) { contentEl.innerHTML = `<div class="muted pad">${esc(e.message)}</div>`; return; }
        if (!items.length) { contentEl.innerHTML = '<div class="muted pad" style="text-align:center;padding-top:36px">Your feed is quiet.<br>Search a <b>@username</b> above, follow people, and their new sites, apps &amp; drawings show up here.</div>'; return; }
        contentEl.innerHTML = items.map(it => {
          const verb = it.kind === 'site' ? 'published a site' : it.kind === 'app' ? 'published an app' : 'shared a drawing';
          const icon = it.kind === 'site' ? '🌐' : it.kind === 'app' ? (it.icon || '📦') : '🎨';
          return `<div class="feed-item" data-kind="${it.kind}" data-ref="${esc(it.ref)}">
            <div class="fi-ic">${icon}</div>
            <div class="fi-main"><div><b class="fi-user" data-user="${esc(it.handle)}">${esc(it.owner)}</b> <span class="muted">${verb}</span></div>
            <div class="fi-title">${esc(it.title)}${it.kind === 'site' ? ' · ' + esc(it.ref) : ''}</div></div></div>`;
        }).join('');
        contentEl.querySelectorAll('.feed-item').forEach(el => el.onclick = e => {
          if (e.target.dataset.user != null) { openProfile(e.target.dataset.user); return; }
          const k = el.dataset.kind, ref = el.dataset.ref;
          if (k === 'site') Apps.launch('browser', ref);
          else if (k === 'app') Apps.runUserApp(ref);
          else Apps.launch('browser', 'nimbuspaint.nim');
        });
        contentEl.querySelectorAll('.fi-user').forEach(u => u.onclick = e => { e.stopPropagation(); openProfile(u.dataset.user); });
      }

      async function openProfile(username) {
        contentEl.innerHTML = '<div class="muted pad">Loading…</div>';
        let p;
        try { p = await Net.getProfile(username); } catch (e) { contentEl.innerHTML = `<div class="muted pad">${esc(e.message)}</div>`; return; }
        const av = p.avatar || (p.display || p.username)[0].toUpperCase();
        contentEl.innerHTML = `
          <div class="prof">
            <div class="prof-head">
              <div class="prof-av">${esc(av)}</div>
              <div class="prof-id"><div class="prof-name">${esc(p.display)} ${p.admin ? '<span class="acct-badge">🛡️ ADMIN</span>' : ''}</div><div class="muted">@${esc(p.username)}</div></div>
              <div class="prof-actions"></div>
            </div>
            ${p.bio ? `<div class="prof-bio">${esc(p.bio)}</div>` : ''}
            <div class="prof-stats"><b>${p.followers}</b> followers · <b>${p.following}</b> following · <b>${p.sites.length + p.apps.length + p.drawings.length}</b> creations</div>
            <div class="prof-content"></div>
          </div>`;
        const actions = contentEl.querySelector('.prof-actions');
        if (p.isMe) {
          actions.innerHTML = '<button class="btn ghost" data-a="edit">Edit profile</button>';
          actions.querySelector('[data-a=edit]').onclick = () => editProfile(p);
        } else {
          actions.innerHTML = `<button class="btn" data-a="follow">${p.isFollowing ? 'Following ✓' : 'Follow'}</button><button class="btn ghost" data-a="msg">Message</button>`;
          actions.querySelector('[data-a=follow]').onclick = async e => {
            try { if (p.isFollowing) { await Net.unfollow(p.username); p.isFollowing = false; } else { await Net.follow(p.username); p.isFollowing = true; } e.target.textContent = p.isFollowing ? 'Following ✓' : 'Follow'; }
            catch (err) { UI.alert({ title: 'Error', body: err.message }); }
          };
          actions.querySelector('[data-a=msg]').onclick = () => renderThread(p.username);
        }
        const c = contentEl.querySelector('.prof-content');
        let h = '';
        if (p.sites.length) h += `<div class="prof-sec"><h4>🌐 Sites</h4>${p.sites.map(s => `<div class="prof-row" data-site="${esc(s.domain)}"><b>${esc(s.domain)}</b> <span class="muted">${esc(s.title)}</span></div>`).join('')}</div>`;
        if (p.apps.length) h += `<div class="prof-sec"><h4>🛍️ Apps</h4>${p.apps.map(a => `<div class="prof-row" data-app="${esc(a.id)}">${esc(a.icon)} <b>${esc(a.name)}</b></div>`).join('')}</div>`;
        if (p.drawings.length) h += `<div class="prof-sec"><h4>🎨 Drawings</h4><div class="prof-draws">${p.drawings.map(d => `<img src="${d.data}" title="${esc(d.title)}">`).join('')}</div></div>`;
        c.innerHTML = h || '<div class="muted" style="padding:10px 2px">Nothing published yet.</div>';
        c.querySelectorAll('[data-site]').forEach(el => el.onclick = () => Apps.launch('browser', el.dataset.site));
        c.querySelectorAll('[data-app]').forEach(el => el.onclick = () => Apps.runUserApp(el.dataset.app));
      }

      function editProfile(p) {
        contentEl.innerHTML = `<div class="prof-edit pad">
          <h3 class="app-h">Edit profile</h3>
          <label class="col" style="gap:4px">Avatar (one emoji)<input class="fld" data-f="avatar" maxlength="4" value="${esc(p.avatar || '')}" placeholder="🙂"></label>
          <label class="col" style="gap:4px;margin-top:8px">Display name<input class="fld" data-f="display" value="${esc(p.display)}"></label>
          <label class="col" style="gap:4px;margin-top:8px">Bio<textarea class="fld" data-f="bio" rows="3">${esc(p.bio || '')}</textarea></label>
          <div class="row" style="margin-top:12px"><button class="btn" data-a="save">Save</button><button class="btn ghost" data-a="cancel">Cancel</button></div>
        </div>`;
        const val = f => contentEl.querySelector(`[data-f="${f}"]`).value;
        contentEl.querySelector('[data-a=cancel]').onclick = () => openProfile(p.username);
        contentEl.querySelector('[data-a=save]').onclick = async () => {
          try { await Net.updateProfile({ display: val('display'), bio: val('bio'), avatar: val('avatar') }); OS.notify('👥', 'Profile saved', ''); openProfile(p.username); }
          catch (e) { UI.alert({ title: 'Couldn’t save', body: e.message }); }
        };
      }

      async function renderConvos() {
        contentEl.innerHTML = '<div class="muted pad">Loading…</div>';
        let convos;
        try { convos = await Net.conversations(); } catch (e) { contentEl.innerHTML = `<div class="muted pad">${esc(e.message)}</div>`; return; }
        if (!convos.length) { contentEl.innerHTML = '<div class="muted pad" style="text-align:center;padding-top:36px">No messages yet.<br>Open someone’s profile and hit <b>Message</b>.</div>'; return; }
        contentEl.innerHTML = convos.map(c => `
          <div class="convo" data-user="${esc(c.handle)}">
            <div class="convo-av">${esc((c.display || c.handle)[0].toUpperCase())}</div>
            <div class="convo-main"><div class="convo-name">${esc(c.display)} ${c.unread ? `<span class="convo-badge">${c.unread}</span>` : ''}</div><div class="muted convo-last">${esc(c.last)}</div></div>
          </div>`).join('');
        contentEl.querySelectorAll('.convo').forEach(el => el.onclick = () => renderThread(el.dataset.user));
      }

      async function renderThread(username) {
        contentEl.innerHTML = '<div class="muted pad">Loading…</div>';
        let t;
        try { t = await Net.thread(username); } catch (e) { contentEl.innerHTML = `<div class="muted pad">${esc(e.message)}</div>`; return; }
        contentEl.innerHTML = `
          <div class="thread">
            <div class="thread-head"><button class="fbtn" data-a="back">‹</button><b class="thread-name" data-user="${esc(t.with.username)}">${esc(t.with.display)}</b></div>
            <div class="thread-msgs"></div>
            <div class="thread-input"><input class="fld" placeholder="Message @${esc(t.with.username)}…" spellcheck="false"><button class="btn" data-a="send">Send</button></div>
          </div>`;
        const msgs = contentEl.querySelector('.thread-msgs');
        function paint(list) {
          msgs.innerHTML = list.map(m => `<div class="msg ${m.mine ? 'mine' : ''}">${esc(m.body)}</div>`).join('') || '<div class="muted" style="text-align:center;padding:20px">Say hi 👋</div>';
          msgs.scrollTop = msgs.scrollHeight;
        }
        paint(t.messages);
        contentEl.querySelector('[data-a=back]').onclick = () => renderConvos();
        contentEl.querySelector('.thread-name').onclick = () => openProfile(t.with.username);
        const input = contentEl.querySelector('.thread-input input');
        async function send() {
          const v = input.value.trim(); if (!v) return;
          input.value = '';
          t.messages.push({ mine: true, body: v }); paint(t.messages);
          try { await Net.sendMessage(username, v); } catch (e) { UI.alert({ title: 'Couldn’t send', body: e.message }); }
        }
        contentEl.querySelector('[data-a=send]').onclick = send;
        input.addEventListener('keydown', e => { if (e.key === 'Enter') send(); });
        setTimeout(() => input.focus(), 40);
      }

      const onAuth = () => mount();
      document.addEventListener('nimbus:auth', onAuth);
      win.onClose = () => document.removeEventListener('nimbus:auth', onAuth);
      mount();
    }
  });

  /* ---------------------------------------------------------------
     CODE — a real code editor: file tree, tabs, line numbers, syntax
     highlighting, FS-backed.
  --------------------------------------------------------------- */
  function highlight(code) {
    const pat = /(\/\/[^\n]*|\/\*[\s\S]*?\*\/|<!--[\s\S]*?-->)|("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|`(?:[^`\\]|\\.)*`)|(\b\d+(?:\.\d+)?\b)|(\b(?:function|return|const|let|var|if|else|for|while|class|new|await|async|import|export|from|of|in|true|false|null|undefined|this|do|switch|case|break|continue|typeof|extends|super|try|catch|throw)\b)/g;
    let out = '', last = 0, m;
    while ((m = pat.exec(code))) {
      out += esc(code.slice(last, m.index));
      const cls = m[1] ? 't-com' : m[2] ? 't-str' : m[3] ? 't-num' : 't-kw';
      out += '<span class="' + cls + '">' + esc(m[0]) + '</span>';
      last = m.index + m[0].length;
    }
    return out + esc(code.slice(last));
  }
  def({
    id: 'code', title: 'Code', icon: '💻', width: 720, height: 480,
    build(body, win, arg) {
      const tabs = []; let active = -1;
      body.innerHTML = `
        <div class="code-app">
          <div class="code-side">
            <div class="code-side-h">EXPLORER <button class="fbtn" data-a="open" title="Open file">📂</button></div>
            <div class="code-tree"></div>
          </div>
          <div class="code-main">
            <div class="code-tabs"></div>
            <div class="code-edit">
              <div class="code-gutter"></div>
              <div class="code-scroll"><pre class="code-hl"><code></code></pre><textarea class="code-input" spellcheck="false" wrap="off"></textarea></div>
            </div>
            <div class="code-status"><span class="cs-path muted">No file open</span><button class="btn ghost cs-save" style="display:none">Save</button></div>
          </div>
        </div>`;
      const treeEl = body.querySelector('.code-tree'), tabsEl = body.querySelector('.code-tabs');
      const gutter = body.querySelector('.code-gutter'), hlEl = body.querySelector('.code-hl code'), input = body.querySelector('.code-input');
      const statusEl = body.querySelector('.cs-path'), saveBtn = body.querySelector('.cs-save');

      function renderTree() {
        let html = '';
        (function walk(path, depth) {
          (FS.list(path) || []).forEach(it => {
            const full = (path === '/' ? '' : path) + '/' + it.name;
            const pad = depth * 12 + 6;
            if (it.type === 'dir') {
              html += `<div class="ct-row ct-dir" data-dir="${esc(full)}" style="padding-left:${pad}px">📂 ${esc(it.name)}</div>`;
              if (openDirs[full]) walk(full, depth + 1);
            } else {
              html += `<div class="ct-row" data-file="${esc(full)}" style="padding-left:${pad}px">📄 ${esc(it.name)}</div>`;
            }
          });
        })('/', 0);
        treeEl.innerHTML = html;
        treeEl.querySelectorAll('[data-dir]').forEach(r => r.onclick = () => { openDirs[r.dataset.dir] = !openDirs[r.dataset.dir]; renderTree(); });
        treeEl.querySelectorAll('[data-file]').forEach(r => r.onclick = () => openFile(r.dataset.file));
      }
      const openDirs = { '/Documents': true };

      function openFile(path) {
        let i = tabs.findIndex(t => t.path === path);
        if (i < 0) { tabs.push({ path, content: FS.read(path) || '', dirty: false }); i = tabs.length - 1; }
        active = i; sync();
      }
      function renderTabs() {
        tabsEl.innerHTML = tabs.map((t, i) => `<div class="code-tab ${i === active ? 'on' : ''}" data-i="${i}"><span>${esc(t.path.split('/').pop())}${t.dirty ? ' •' : ''}</span><span class="ctab-x" data-x="${i}">×</span></div>`).join('');
        tabsEl.querySelectorAll('.code-tab').forEach(el => {
          el.onclick = e => { if (e.target.dataset.x != null) return; active = +el.dataset.i; sync(); };
          el.querySelector('.ctab-x').onclick = e => { e.stopPropagation(); tabs.splice(+e.target.dataset.x, 1); if (active >= tabs.length) active = tabs.length - 1; sync(); };
        });
      }
      function paintCode() {
        hlEl.innerHTML = highlight(input.value);
        const lines = input.value.split('\n').length;
        gutter.innerHTML = Array.from({ length: lines }, (_, i) => i + 1).join('<br>');
      }
      function sync() {
        renderTabs();
        if (active < 0) { input.value = ''; statusEl.textContent = 'No file open'; saveBtn.style.display = 'none'; paintCode(); return; }
        const t = tabs[active];
        input.value = t.content;
        statusEl.textContent = t.path; statusEl.classList.toggle('muted', false);
        saveBtn.style.display = '';
        win.el.querySelector('.win-title').innerHTML = `<span class="win-ico">💻</span> ${esc(t.path.split('/').pop())}`;
        paintCode();
      }
      function save() {
        if (active < 0) return;
        const t = tabs[active]; FS.write(t.path, input.value); t.content = input.value; t.dirty = false;
        statusEl.textContent = 'Saved ' + t.path; setTimeout(() => { if (active >= 0) statusEl.textContent = tabs[active].path; }, 1000);
        renderTabs(); OS.refreshFiles();
      }
      input.addEventListener('input', () => { if (active >= 0) { tabs[active].content = input.value; tabs[active].dirty = true; } paintCode(); renderTabs(); });
      input.addEventListener('scroll', () => { hlEl.parentElement.scrollTop = input.scrollTop; hlEl.parentElement.scrollLeft = input.scrollLeft; gutter.scrollTop = input.scrollTop; });
      input.addEventListener('keydown', e => {
        if ((e.metaKey || e.ctrlKey) && e.key === 's') { e.preventDefault(); save(); }
        if (e.key === 'Tab') { e.preventDefault(); const s = input.selectionStart; input.value = input.value.slice(0, s) + '  ' + input.value.slice(input.selectionEnd); input.selectionStart = input.selectionEnd = s + 2; input.dispatchEvent(new Event('input')); }
      });
      saveBtn.onclick = save;
      body.querySelector('[data-a="open"]').onclick = async () => { const p = await UI.filePanel({ mode: 'open', startPath: '/Documents', title: 'Open in Code' }); if (p && FS.isFile(p)) openFile(p); };

      win.confirmClose = async () => tabs.some(t => t.dirty) ? UI.confirm({ title: 'Discard changes?', body: 'Some files have unsaved changes.', ok: 'Discard', danger: true }) : true;
      renderTree();
      if (arg && FS.isFile(arg)) openFile(arg); else sync();
    }
  });

  /* ---------------------------------------------------------------
     TUNES — a chiptune jukebox (built-in synthesized tracks)
  --------------------------------------------------------------- */
  function noteFreq(n) {
    if (n === '-') return 0;
    const m = n.match(/^([A-G])(#?)(\d)$/); if (!m) return 0;
    const base = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }[m[1]] + (m[2] ? 1 : 0);
    return 440 * Math.pow(2, (base + (+m[3] - 4) * 12 - 9) / 12);
  }
  const TRACKS = [
    { name: 'Sunrise', tempo: 150, wave: 'square', seq: 'C4 E4 G4 C5 B4 G4 E4 G4 A4 C5 E5 C5 G4 E4 G4 C5'.split(' ').map(n => [n, 1]) },
    { name: 'Drift', tempo: 96, wave: 'triangle', seq: 'A3 C4 E4 A4 - E4 C4 E4 F3 A3 C4 F4 - C4 A3 C4 G3 B3 D4 G4 - D4 B3 D4 E3 G3 B3 E4 - B3 G3 B3'.split(' ').map(n => [n, 1]) },
    { name: 'Bitrun', tempo: 220, wave: 'square', seq: 'C4 E4 G4 E4 C4 E4 G4 E4 D4 F4 A4 F4 D4 F4 A4 F4 E4 G4 B4 G4 E4 G4 B4 G4 F4 A4 C5 A4 G4 B4 D5 B4'.split(' ').map(n => [n, 1]) }
  ];
  def({
    id: 'tunes', title: 'Tunes', icon: '🎧', width: 340, height: 420, single: true,
    build(body, win) {
      let ac = null, cur = 0, playing = false, step = 0, timer = null;
      body.innerHTML = `
        <div class="tunes">
          <div class="tn-art"><div class="tn-disc">🎵</div></div>
          <div class="tn-now"><div class="tn-title"></div><div class="tn-sub muted">Nimbus Tunes</div></div>
          <div class="tn-bar"><div class="tn-fill"></div></div>
          <div class="tn-ctrls">
            <button class="tn-btn" data-a="prev">⏮</button>
            <button class="tn-btn tn-play" data-a="play">▶</button>
            <button class="tn-btn" data-a="next">⏭</button>
          </div>
          <div class="tn-list"></div>
        </div>`;
      const titleEl = body.querySelector('.tn-title'), fill = body.querySelector('.tn-fill'), playBtn = body.querySelector('.tn-play');
      const disc = body.querySelector('.tn-disc'), listEl = body.querySelector('.tn-list');
      function renderList() {
        listEl.innerHTML = TRACKS.map((t, i) => `<div class="tn-track ${i === cur ? 'on' : ''}" data-i="${i}">${i === cur && playing ? '🔊' : '🎵'} ${esc(t.name)}</div>`).join('');
        listEl.querySelectorAll('.tn-track').forEach(el => el.onclick = () => { cur = +el.dataset.i; step = 0; if (playing) { stop(); play(); } else load(); });
        titleEl.textContent = TRACKS[cur].name;
      }
      function load() { titleEl.textContent = TRACKS[cur].name; renderList(); }
      function beep(freq, dur, wave) {
        if (!freq) return;
        const o = ac.createOscillator(), g = ac.createGain();
        o.type = wave || 'square'; o.frequency.value = freq;
        g.gain.setValueAtTime(0.0001, ac.currentTime);
        g.gain.exponentialRampToValueAtTime(0.18, ac.currentTime + 0.01);
        g.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + dur);
        o.connect(g); g.connect(ac.destination); o.start(); o.stop(ac.currentTime + dur + 0.02);
      }
      function tick() {
        const t = TRACKS[cur]; const beatMs = 60000 / t.tempo;
        const [n, beats] = t.seq[step];
        beep(noteFreq(n), (beats * beatMs) / 1000 * 0.9, t.wave);
        fill.style.width = (step / t.seq.length * 100) + '%';
        step = (step + 1) % t.seq.length;
        timer = setTimeout(tick, beats * beatMs);
      }
      function play() {
        if (!ac) ac = new (window.AudioContext || window.webkitAudioContext)();
        if (ac.state === 'suspended') ac.resume();
        playing = true; playBtn.textContent = '⏸'; disc.classList.add('spin'); renderList(); tick();
      }
      function stop() { playing = false; playBtn.textContent = '▶'; disc.classList.remove('spin'); clearTimeout(timer); renderList(); }
      playBtn.onclick = () => playing ? stop() : play();
      body.querySelector('[data-a="prev"]').onclick = () => { cur = (cur - 1 + TRACKS.length) % TRACKS.length; step = 0; if (playing) { stop(); play(); } else load(); };
      body.querySelector('[data-a="next"]').onclick = () => { cur = (cur + 1) % TRACKS.length; step = 0; if (playing) { stop(); play(); } else load(); };
      win.onClose = () => { clearTimeout(timer); if (ac) ac.close(); };
      load();
    }
  });

  /* ---------------------------------------------------------------
     launcher
  --------------------------------------------------------------- */
  function launch(id, arg) {
    const d = reg[id];
    if (!d) return;
    if (d.single) {
      const ex = WM.windowsOf(id);
      if (ex.length) { ex[0].minimized ? WM.restore(ex[0].id) : WM.focus(ex[0].id); return ex[0]; }
    }
    const win = WM.open({
      appId: id, title: d.title, appTitle: d.title, icon: d.icon,
      width: d.width, height: d.height,
      build: (b, w) => d.build(b, w, arg)
    });
    win._launchArg = (typeof arg === 'string') ? arg : null;
    return win;
  }

  return {
    def, launch, reg, list: () => Object.values(reg),
    runUserApp: launchUserApp, installedApps: getInstalled, installApp, uninstallApp
  };
})();
