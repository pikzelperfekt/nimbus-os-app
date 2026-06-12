/* ===================================================================
   Nimbus App SDK — injected into every third-party app's sandboxed
   iframe. Exposes window.nimbus, which talks to the OS host over
   postMessage. Apps can't touch the real OS directly — only through
   these vetted calls.

   API (all return Promises):
     nimbus.notify(title, body)        – system notification
     nimbus.setTitle(text)             – set the window title
     nimbus.close()                    – close the app window
     nimbus.user()                     – { username, display, admin } | null
     nimbus.storage.get(key)           – per-app persistent storage
     nimbus.storage.set(key, value)
     nimbus.storage.keys()
     nimbus.net.directory()            – NimbusNet site directory
     nimbus.net.getSite(domain)        – fetch a published .nim site
     nimbus.openSite(domain)           – open a .nim site in the browser
   =================================================================== */
(function () {
  if (window.nimbus) return;
  var seq = 0, pending = {};
  function call(type, payload) {
    return new Promise(function (resolve) {
      var id = ++seq; pending[id] = resolve;
      parent.postMessage({ __nimbus: 1, id: id, type: type, payload: payload || {} }, '*');
    });
  }
  window.addEventListener('message', function (e) {
    var d = e.data;
    if (d && d.__nimbusReply && pending[d.id]) { var f = pending[d.id]; delete pending[d.id]; f(d.result); }
  });
  window.nimbus = {
    notify: function (title, body) { return call('notify', { title: title, body: body }); },
    setTitle: function (t) { return call('setTitle', { title: t }); },
    close: function () { return call('close'); },
    user: function () { return call('user'); },
    storage: {
      get: function (k) { return call('storage.get', { key: k }); },
      set: function (k, v) { return call('storage.set', { key: k, value: v }); },
      keys: function () { return call('storage.keys'); }
    },
    net: {
      directory: function () { return call('net.directory'); },
      getSite: function (d) { return call('net.getSite', { domain: d }); }
    },
    openSite: function (domain) { return call('openSite', { domain: domain }); }
  };
  call('ready');
})();
