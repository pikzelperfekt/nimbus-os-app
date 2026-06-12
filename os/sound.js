/* ===================================================================
   Sound — a tiny Web-Audio SFX engine for system sounds. All sounds are
   synthesized (no files). Gated by the user's "sound effects" pref.
   =================================================================== */
window.Sound = (function () {
  let ac = null;
  let enabled = true;
  let volume = 0.5;

  function ctx() {
    if (!ac) {
      try { ac = new (window.AudioContext || window.webkitAudioContext)(); }
      catch (e) { return null; }
    }
    if (ac.state === 'suspended') ac.resume();
    return ac;
  }

  // one enveloped oscillator note
  function note(freq, start, dur, type, peak) {
    const a = ac;
    const o = a.createOscillator(), g = a.createGain();
    o.type = type || 'sine';
    o.frequency.setValueAtTime(freq, a.currentTime + start);
    const t = a.currentTime + start;
    const v = (peak == null ? 0.2 : peak) * volume;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0001, v), t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(a.destination);
    o.start(t); o.stop(t + dur + 0.02);
  }

  const sounds = {
    boot() { // gentle rising chime
      note(392.0, 0.00, 0.5, 'sine', 0.18);
      note(523.25, 0.12, 0.5, 'sine', 0.18);
      note(659.25, 0.24, 0.6, 'sine', 0.20);
      note(783.99, 0.36, 0.8, 'triangle', 0.16);
    },
    open() { note(587.33, 0, 0.12, 'triangle', 0.14); note(880, 0.05, 0.12, 'triangle', 0.12); },
    close() { note(440, 0, 0.12, 'triangle', 0.12); note(294, 0.05, 0.14, 'triangle', 0.12); },
    minimize() { note(660, 0, 0.10, 'sine', 0.1); note(440, 0.06, 0.12, 'sine', 0.1); },
    notify() { note(880, 0, 0.16, 'sine', 0.16); note(1174.66, 0.12, 0.22, 'sine', 0.16); },
    click() { note(1200, 0, 0.04, 'square', 0.05); },
    toggle() { note(700, 0, 0.06, 'square', 0.08); },
    error() { note(220, 0, 0.18, 'sawtooth', 0.14); note(207, 0.04, 0.22, 'sawtooth', 0.12); },
    trash() { note(300, 0, 0.18, 'sawtooth', 0.1); note(180, 0.08, 0.2, 'square', 0.1); }
  };

  return {
    play(name) {
      if (!enabled) return;
      if (!ctx()) return;
      try { (sounds[name] || function () {})(); } catch (e) {}
    },
    setEnabled(v) { enabled = !!v; },
    setVolume(v) { volume = Math.max(0, Math.min(1, v)); },
    unlock() { ctx(); } // resume the context on a user gesture
  };
})();
