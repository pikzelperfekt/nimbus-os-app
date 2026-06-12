/* ===================================================================
   FS — in-memory filesystem shared by Terminal, Files, and Editor.
   Persists to localStorage so files survive reloads.
   A node is { type:'dir', children:{} } or { type:'file', content:'' }.
   =================================================================== */
window.FS = (function () {
  const KEY = 'nimbus.fs.v1';

  function seed() {
    return {
      type: 'dir',
      children: {
        Desktop: { type: 'dir', children: {} },
        Documents: {
          type: 'dir',
          children: {
            'welcome.txt': {
              type: 'file',
              content:
`Welcome to Nimbus OS.

This is a tiny operating system living in a browser tab.
Everything you see is fake — but the filesystem is real (in memory).

Try this:
  • Open the Terminal and type 'help'
  • Edit this file and save it — the Files app sees the change
  • Open Settings to change the wallpaper or theme

Files you create in the Terminal show up in Files, and vice-versa.
They all share one filesystem.

— Nimbus`
            },
            'todo.md': {
              type: 'file',
              content: '# Todo\n\n- [x] Boot the OS\n- [ ] Break the OS\n- [ ] Add another app\n'
            },
            Projects: { type: 'dir', children: {} }
          }
        },
        Pictures: { type: 'dir', children: {} },
        '.config': {
          type: 'dir',
          children: {
            'system.cfg': { type: 'file', content: 'theme=dark\nwallpaper=aurora\naccent=blue\n' }
          }
        }
      }
    };
  }

  let root;
  try {
    root = JSON.parse(localStorage.getItem(KEY)) || seed();
  } catch (e) {
    root = seed();
  }

  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(root)); } catch (e) {}
    try { document.dispatchEvent(new Event('nimbus:dirty')); } catch (e) {}
  }

  // --- path helpers -------------------------------------------------
  function normalize(cwd, p) {
    if (!p) p = '';
    let parts;
    if (p.startsWith('/')) parts = p.split('/');
    else parts = ('/' + cwd + '/' + p).split('/');
    const out = [];
    for (const seg of parts) {
      if (seg === '' || seg === '.') continue;
      if (seg === '..') out.pop();
      else out.push(seg);
    }
    return '/' + out.join('/');
  }

  function nodeAt(path) {
    if (path === '/' || path === '') return root;
    const parts = path.split('/').filter(Boolean);
    let cur = root;
    for (const seg of parts) {
      if (cur.type !== 'dir' || !cur.children[seg]) return null;
      cur = cur.children[seg];
    }
    return cur;
  }

  function parentOf(path) {
    const parts = path.split('/').filter(Boolean);
    const name = parts.pop();
    const parent = nodeAt('/' + parts.join('/'));
    return { parent, name };
  }

  // --- public ops ---------------------------------------------------
  return {
    root: () => root,
    save,
    normalize,
    nodeAt,
    parentOf,

    isDir: (path) => { const n = nodeAt(path); return n && n.type === 'dir'; },
    isFile: (path) => { const n = nodeAt(path); return n && n.type === 'file'; },
    exists: (path) => !!nodeAt(path),

    list(path) {
      const n = nodeAt(path);
      if (!n || n.type !== 'dir') return null;
      return Object.keys(n.children).sort((a, b) => {
        const ad = n.children[a].type === 'dir', bd = n.children[b].type === 'dir';
        if (ad !== bd) return ad ? -1 : 1;
        return a.localeCompare(b);
      }).map(name => ({ name, type: n.children[name].type }));
    },

    read(path) { const n = nodeAt(path); return n && n.type === 'file' ? n.content : null; },

    write(path, content) {
      const { parent, name } = parentOf(path);
      if (!parent || parent.type !== 'dir') return false;
      if (parent.children[name] && parent.children[name].type === 'dir') return false;
      parent.children[name] = { type: 'file', content: content == null ? '' : String(content) };
      save();
      return true;
    },

    mkdir(path) {
      const { parent, name } = parentOf(path);
      if (!parent || parent.type !== 'dir' || !name) return false;
      if (parent.children[name]) return false;
      parent.children[name] = { type: 'dir', children: {} };
      save();
      return true;
    },

    touch(path) {
      if (nodeAt(path)) return true;
      return this.write(path, '');
    },

    remove(path) {
      if (path === '/') return false;
      const { parent, name } = parentOf(path);
      if (!parent || !parent.children[name]) return false;
      delete parent.children[name];
      save();
      return true;
    },

    rename(path, newName) {
      const { parent, name } = parentOf(path);
      if (!parent || !parent.children[name] || parent.children[newName]) return false;
      parent.children[newName] = parent.children[name];
      delete parent.children[name];
      save();
      return true;
    },

    reset() { root = seed(); save(); },

    // replace the whole tree (used by cloud sync)
    replaceRoot(node) { if (node && node.type === 'dir') { root = node; save(); } },

    // a non-colliding path for `base` inside dir (adds " copy" / " (n)")
    freeName(dir, base) {
      const join = n => (dir === '/' ? '' : dir) + '/' + n;
      if (!this.exists(join(base))) return join(base);
      const m = base.match(/^(.*?)(\.[^.]+)?$/);
      const stem = m[1], ext = m[2] || '';
      let n = join(stem + ' copy' + ext), i = 2;
      while (this.exists(n)) n = join(stem + ' copy ' + (i++) + ext);
      return n;
    },

    // copy a node to a full destination path (deep clone)
    cp(src, dest) {
      const node = nodeAt(src); if (!node) return false;
      const { parent, name } = parentOf(dest);
      if (!parent || parent.type !== 'dir' || !name) return false;
      parent.children[name] = JSON.parse(JSON.stringify(node));
      save(); return true;
    },

    // move a node to a full destination path
    mv(src, dest) {
      if (src === dest) return false;
      const node = nodeAt(src); if (!node) return false;
      if (dest.indexOf(src + '/') === 0) return false; // can't move into self
      const { parent: dp, name: dn } = parentOf(dest);
      if (!dp || dp.type !== 'dir' || !dn) return false;
      const { parent: sp, name: sn } = parentOf(src);
      if (!sp) return false;
      delete sp.children[sn];
      dp.children[dn] = node;
      save(); return true;
    },

    // move a node into /Trash (collision-safe)
    trash(path) {
      if (path === '/' || path.indexOf('/Trash') === 0) return false;
      if (!this.isDir('/Trash')) this.mkdir('/Trash');
      const name = path.split('/').pop();
      let dest = '/Trash/' + name, i = 1;
      while (this.exists(dest)) dest = '/Trash/' + name + ' (' + (i++) + ')';
      return this.mv(path, dest);
    },
    emptyTrash() { const t = nodeAt('/Trash'); if (t && t.type === 'dir') { t.children = {}; save(); } }
  };
})();
