'use strict';
// ============================================================
//  演出：火花・波紋・予告線・きらめき・得点表示
// ============================================================
const Effects = {
  parts: [],
  warns: [], // 予告線（これから弾が通る場所）

  col(c) { return BULLET_COLORS[c] || c; },

  spark(x, y, color = '#ffffff', n = 6, spd = 2, life = 24, size = 2) {
    const col = this.col(color);
    for (let i = 0; i < n; i++) {
      const a = rand(0, TAU), s = rand(0.3, 1) * spd;
      this.parts.push({ kind: 'spark', x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life, max: life, size, col });
    }
  },
  ring(x, y, color, maxR = 48, life = 24, width = 2) {
    this.parts.push({ kind: 'ring', x, y, col: this.col(color), maxR, life, max: life, width });
  },
  flash(x, y, r, color, life = 20) {
    this.parts.push({ kind: 'flash', x, y, r, col: this.col(color), life, max: life });
  },
  // 「ここに何かが現れる」予告のきらめき
  twinkle(x, y, life, color) {
    this.parts.push({ kind: 'twinkle', x, y, col: this.col(color), life, max: life });
  },
  popup(x, y, text, color = '#ffffff') {
    this.parts.push({ kind: 'text', x, y, vy: -0.5, text, col: color, life: 45, max: 45 });
  },
  warnLine(x, y, ang, len, life, color) {
    this.warns.push({ x1: x, y1: y, x2: x + Math.cos(ang) * len, y2: y + Math.sin(ang) * len, life, max: life, col: this.col(color) });
  },
  warnSeg(x1, y1, x2, y2, life, color) {
    this.warns.push({ x1, y1, x2, y2, life, max: life, col: this.col(color) });
  },
  clearWarns() { this.warns = []; },

  update() {
    for (const p of this.parts) {
      p.life--;
      if (p.kind === 'spark') { p.x += p.vx; p.y += p.vy; p.vx *= 0.93; p.vy *= 0.93; }
      else if (p.kind === 'text') p.y += p.vy;
    }
    this.parts = this.parts.filter((p) => p.life > 0);
    for (const w of this.warns) w.life--;
    this.warns = this.warns.filter((w) => w.life > 0);
  },

  // 予告線は「時間が近づくほど明るくなる」→ どの線が先に来るか読める
  drawWarns(c) {
    if (!this.warns.length) return;
    c.save();
    c.globalCompositeOperation = 'lighter';
    c.lineCap = 'round';
    for (const w of this.warns) {
      const t = 1 - w.life / w.max;
      const fade = Math.min(1, w.life / 8);
      const a = (0.15 + 0.75 * t * t) * fade * (0.8 + 0.2 * Math.sin(w.life * (0.3 + t * 0.5)));
      c.beginPath(); c.moveTo(w.x1, w.y1); c.lineTo(w.x2, w.y2);
      c.strokeStyle = hexA(w.col, a * 0.3); c.lineWidth = 5; c.stroke();
      c.strokeStyle = hexA(w.col, a); c.lineWidth = 1.2; c.stroke();
    }
    c.restore();
  },

  draw(c) {
    c.save();
    for (const p of this.parts) {
      const k = p.life / p.max;
      switch (p.kind) {
        case 'spark':
          c.globalCompositeOperation = 'lighter';
          c.fillStyle = hexA(p.col, k);
          c.beginPath(); c.arc(p.x, p.y, p.size * (0.5 + k * 0.5), 0, TAU); c.fill();
          break;
        case 'ring': {
          c.globalCompositeOperation = 'lighter';
          const r = p.maxR * easeOutCubic(1 - k);
          c.strokeStyle = hexA(p.col, k * 0.8); c.lineWidth = p.width;
          c.beginPath(); c.arc(p.x, p.y, r, 0, TAU); c.stroke();
          break;
        }
        case 'flash':
          c.globalCompositeOperation = 'lighter';
          glow(c, p.x, p.y, p.r * (1.2 - k * 0.4), p.col, k * 0.8);
          break;
        case 'twinkle': {
          c.globalCompositeOperation = 'lighter';
          const t = 1 - k;
          const rr = lerp(28, 5, easeOutCubic(t));
          c.strokeStyle = hexA(p.col, 0.25 + 0.5 * t); c.lineWidth = 1;
          c.beginPath(); c.arc(p.x, p.y, rr, 0, TAU); c.stroke();
          const s = 4 + 3 * Math.sin(p.life * 0.4);
          c.fillStyle = hexA(p.col, 0.5 + 0.5 * t);
          starPath(c, p.x, p.y, s * 1.6, s * 0.35, 4, 0); c.fill();
          break;
        }
        case 'text':
          c.globalCompositeOperation = 'source-over';
          c.globalAlpha = Math.min(1, k * 2);
          c.fillStyle = p.col; c.font = `bold 10px ${FONT_SANS}`; c.textAlign = 'center';
          c.fillText(p.text, p.x, p.y);
          c.globalAlpha = 1;
          break;
      }
    }
    c.restore();
  },
};
