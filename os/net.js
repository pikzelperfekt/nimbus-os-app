/* ===================================================================
   Net — Nimbus's client for the shared backend (Cloudflare Pages
   Functions + D1 on Lumistead). Handles accounts, sessions, and the
   NimbusNet site/domain registry. Token persists in localStorage.
   =================================================================== */
window.Net = (function () {
  // Same-origin when served from the Lumistead site; absolute otherwise
  // (file://, localhost dev, etc.).
  const onSite = (location.protocol === 'http:' || location.protocol === 'https:')
    && /(^|\.)lumistead\.pages\.dev$/.test(location.hostname);
  const BASE = onSite ? '' : 'https://lumistead.pages.dev';

  let token = null, user = null;
  try { token = localStorage.getItem('nimbus.token') || null; } catch (e) {}

  function setAuth(t, u) {
    token = t; user = u;
    try {
      if (t) localStorage.setItem('nimbus.token', t); else localStorage.removeItem('nimbus.token');
      if (u) localStorage.setItem('nimbus.user', JSON.stringify(u)); else localStorage.removeItem('nimbus.user');
    } catch (e) {}
    document.dispatchEvent(new CustomEvent('nimbus:auth', { detail: { user } }));
  }

  function offlineError() { const e = new Error('You’re offline — NimbusNet is unavailable.'); e.offline = true; return e; }

  async function api(path, opts) {
    opts = opts || {};
    // Acts like wi-fi is off: fail fast, no hanging, when there's no network.
    if (typeof navigator !== 'undefined' && navigator.onLine === false) throw offlineError();
    const headers = Object.assign({}, opts.headers);
    let body = opts.body;
    if (body && typeof body === 'object') { headers['Content-Type'] = 'application/json'; body = JSON.stringify(body); }
    const hadToken = !!token;
    if (token) headers['Authorization'] = 'Bearer ' + token;
    let res;
    const ctl = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const t = ctl ? setTimeout(() => ctl.abort(), 9000) : null;
    try { res = await fetch(BASE + '/api' + path, { method: opts.method || 'GET', headers, body, signal: ctl ? ctl.signal : undefined }); }
    catch (e) { throw offlineError(); }
    finally { if (t) clearTimeout(t); }
    let data; try { data = await res.json(); } catch (e) { data = {}; }
    if (!res.ok) {
      // A stale/expired token: drop the session so the UI returns to signed-out
      // instead of falsely showing you as logged in.
      if (res.status === 401 && hadToken) setAuth(null, null);
      throw new Error(data.error || ('Error ' + res.status));
    }
    return data;
  }

  return {
    base: BASE,
    // The custom TLDs of the Nimbus internet — .nim is the flagship.
    TLDS: ['nim', 'sky', 'cloud', 'nova', 'byte', 'zone'],
    user: () => user,
    isAuthed: () => !!user,
    isAdmin: () => !!(user && user.admin),

    async restore() {
      if (!token) { user = null; return null; }
      try {
        const d = await api('/auth/me');
        user = d.user || null;
        if (!user) setAuth(null, null);
        else document.dispatchEvent(new CustomEvent('nimbus:auth', { detail: { user } }));
        return user;
      } catch (e) {
        // Offline: stay signed in from the cached user so the local OS works.
        if (e.offline) { try { user = JSON.parse(localStorage.getItem('nimbus.user')) || null; } catch (x) { user = null; }
          if (user) document.dispatchEvent(new CustomEvent('nimbus:auth', { detail: { user } }));
          return user; }
        return null;
      }
    },
    async signup(username, password, display) { const d = await api('/auth/signup', { method: 'POST', body: { username, password, display } }); setAuth(d.token, d.user); return d.user; },
    async login(username, password) { const d = await api('/auth/login', { method: 'POST', body: { username, password } }); setAuth(d.token, d.user); return d.user; },
    async logout() { try { await api('/auth/logout', { method: 'POST' }); } catch (e) {} setAuth(null, null); },

    async directory() { return (await api('/sites')).sites || []; },
    async mySites() { return (await api('/sites?mine=1')).sites || []; },
    async getSite(domain) { return (await api('/sites/' + encodeURIComponent(domain))).site; },
    async publish(domain, title, html) { return await api('/sites', { method: 'POST', body: { domain, title, html } }); },
    async deleteSite(domain) { return await api('/sites/' + encodeURIComponent(domain), { method: 'DELETE' }); },

    // NimbusPaint — shared drawing gallery
    async shareDrawing(title, data) { return await api('/paint', { method: 'POST', body: { title, data } }); },
    async drawings() { return (await api('/paint')).drawings || []; },

    // Cloud account sync — per-user OS state
    async getState() { return await api('/state'); },
    async putState(data) { return await api('/state', { method: 'PUT', body: { data } }); },

    // Social — profiles, follow, feed, DMs
    async getProfile(username) { return (await api('/users/' + encodeURIComponent(username))).profile; },
    async follow(username) { return await api('/users/' + encodeURIComponent(username) + '/follow', { method: 'POST' }); },
    async unfollow(username) { return await api('/users/' + encodeURIComponent(username) + '/follow', { method: 'DELETE' }); },
    async feed() { return (await api('/feed')).items || []; },
    async conversations() { return (await api('/messages')).conversations || []; },
    async thread(username) { return await api('/messages/' + encodeURIComponent(username)); },
    async sendMessage(username, body) { return await api('/messages/' + encodeURIComponent(username), { method: 'POST', body: { body } }); },
    async updateProfile(p) { return await api('/profile', { method: 'PUT', body: p }); },

    // Nimbus App SDK — third-party apps
    async appsDirectory() { return (await api('/apps')).apps || []; },
    async myApps() { return (await api('/apps?mine=1')).apps || []; },
    async getApp(id) { return (await api('/apps/' + encodeURIComponent(id))).app; },
    async publishApp(rec) { return await api('/apps', { method: 'POST', body: rec }); },
    async deleteApp(id) { return await api('/apps/' + encodeURIComponent(id), { method: 'DELETE' }); }
  };
})();
