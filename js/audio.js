'use strict';
// ============================================================
//  効果音（WebAudio で合成。音声ファイル不要）
//  BGM はあとで audio/ に曲を置いて差し替える想定
// ============================================================
const Sound = {
  ctx: null, out: null, noiseBuf: null, muted: false, last: {},
  gaps: { bullet: 0.07, graze: 0.04, hit: 0.05, item: 0.05, shot: 0.07, warn: 0.06, tick: 0.05, power: 0.05 },

  unlock() {
    if (!this.ctx) {
      try {
        const AC = window.AudioContext || window.webkitAudioContext;
        this.ctx = new AC();
        this.out = this.ctx.createGain();
        this.out.gain.value = 0.22;
        this.out.connect(this.ctx.destination);
        const n = this.ctx.sampleRate;
        this.noiseBuf = this.ctx.createBuffer(1, n, n);
        const d = this.noiseBuf.getChannelData(0);
        for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
      } catch (e) { this.ctx = null; return; }
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
  },

  tone(f, dur, type = 'sine', vol = 0.2, f2 = null, at = 0) {
    const c = this.ctx, t = c.currentTime + at;
    const o = c.createOscillator(), g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f, t);
    if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(this.out);
    o.start(t); o.stop(t + dur + 0.02);
  },

  noise(dur, vol = 0.2, freq = 2000, at = 0) {
    const c = this.ctx, t = c.currentTime + at;
    const s = c.createBufferSource(); s.buffer = this.noiseBuf;
    const fl = c.createBiquadFilter(); fl.type = 'lowpass';
    fl.frequency.setValueAtTime(freq, t);
    fl.frequency.exponentialRampToValueAtTime(Math.max(60, freq * 0.1), t + dur);
    const g = c.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(fl); fl.connect(g); g.connect(this.out);
    s.start(t); s.stop(t + dur + 0.02);
  },

  play(name) {
    if (!this.ctx || this.muted) return;
    const now = this.ctx.currentTime, gap = this.gaps[name] || 0.03;
    if (this.last[name] !== undefined && now - this.last[name] < gap) return;
    this.last[name] = now;
    switch (name) {
      case 'shot': this.tone(1100, 0.03, 'square', 0.02); break;
      case 'bullet': this.tone(520, 0.06, 'triangle', 0.05, 300); break;
      case 'graze': this.tone(2200, 0.04, 'sine', 0.06, 3000); break;
      case 'hit': this.tone(300, 0.03, 'square', 0.025); break;
      case 'kill': this.noise(0.15, 0.16, 3000); this.tone(420, 0.12, 'triangle', 0.1, 120); break;
      case 'death': this.tone(880, 0.7, 'sawtooth', 0.16, 60); this.noise(0.6, 0.22, 4000); break;
      case 'bomb':
        this.tone(110, 1.4, 'sine', 0.35, 40);
        [523, 659, 784].forEach((f, i) => this.tone(f, 0.9, 'triangle', 0.07, null, i * 0.06));
        this.noise(1.0, 0.1, 1200);
        break;
      case 'spell': [880, 1175, 1568].forEach((f, i) => this.tone(f, 0.5, 'sine', 0.1, null, i * 0.08)); break;
      case 'capture': [784, 988, 1175, 1568].forEach((f, i) => this.tone(f, 0.35, 'triangle', 0.08, null, i * 0.07)); break;
      case 'item': this.tone(1500, 0.04, 'square', 0.025); break;
      case 'power': this.tone(900, 0.06, 'triangle', 0.04, 1400); break;
      case 'extend': [523, 659, 784, 1047].forEach((f, i) => this.tone(f, 0.25, 'square', 0.05, null, i * 0.08)); break;
      case 'full': [659, 880, 1319].forEach((f, i) => this.tone(f, 0.3, 'sine', 0.08, null, i * 0.06)); break;
      case 'warn': this.tone(1760, 0.15, 'sine', 0.04); break;
      case 'tick': this.tone(2600, 0.03, 'square', 0.035); break;
      case 'bosskill': this.noise(1.5, 0.28, 5000); this.tone(220, 1.5, 'sawtooth', 0.12, 30); break;
      case 'select': this.tone(1200, 0.04, 'square', 0.035); break;
      case 'ok': this.tone(880, 0.08, 'triangle', 0.08, 1320); break;
      case 'cancel': this.tone(600, 0.08, 'triangle', 0.08, 300); break;
      case 'pause': this.tone(700, 0.1, 'sine', 0.08); break;
    }
  },
};
