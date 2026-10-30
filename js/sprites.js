'use strict';
// ============================================================
//  弾・アイテム・自機ショットの見た目（起動時に生成してキャッシュ）
// ============================================================

const BULLET_COLORS = {
  red: '#ff3b5c', orange: '#ff9330', yellow: '#ffe24a', gold: '#ffc857',
  green: '#4dff9a', cyan: '#3fe6ff', blue: '#4f7dff', purple: '#a35bff',
  pink: '#ff6fd0', white: '#ffffff', silver: '#bcd0ff',
};

// r = 当たり判定半径, size = 描画サイズ
const BTYPES = {
  small:   { r: 2.4, size: 12 },
  orb:     { r: 4.2, size: 20 },
  big:     { r: 10.5, size: 44 },
  rice:    { r: 2.6, size: 20, oriented: true },
  needle:  { r: 2.0, size: 24, oriented: true },
  star:    { r: 3.6, size: 18, spin: 0.07 },
  bigstar: { r: 8, size: 38, spin: 0.04 },
  shade:   { r: 4.4, size: 22 },                 // 闇の弾（黒い芯）
  moth:    { r: 3.2, size: 22, oriented: true }, // 蛾
  shard:   { r: 2.4, size: 18, oriented: true }, // 鏡の破片
};

const ITEM_SIZE = { power: 12, bigpower: 18, point: 12, bomb: 16, life: 16, eat: 8 };

// ---- 描画ヘルパー ----
function circle(g, x, y, r, fill) {
  g.fillStyle = fill; g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill();
}
function ellipse(g, x, y, rx, ry, fill, rot = 0) {
  g.fillStyle = fill; g.beginPath(); g.ellipse(x, y, rx, ry, rot, 0, TAU); g.fill();
}
function glow(g, x, y, r, col, a = 0.55) {
  const gr = g.createRadialGradient(x, y, 0, x, y, r);
  gr.addColorStop(0, hexA(col, a));
  gr.addColorStop(1, hexA(col, 0));
  g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill();
}
function starPath(g, x, y, R, r, n = 5, rot = -Math.PI / 2) {
  g.beginPath();
  for (let i = 0; i < n * 2; i++) {
    const rr = i % 2 ? r : R, a = rot + (i * Math.PI) / n;
    g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
  }
  g.closePath();
}
function makeCanvas(w, h = w) {
  const c = document.createElement('canvas');
  c.width = Math.ceil(w * SCALE); c.height = Math.ceil(h * SCALE);
  const g = c.getContext('2d'); g.scale(SCALE, SCALE);
  return [c, g];
}

const Sprites = {
  cache: {},

  bullet(type, color) {
    const k = type + '|' + color;
    return this.cache[k] || (this.cache[k] = this.makeBullet(type, color));
  },

  makeBullet(type, color) {
    const def = BTYPES[type], s = def.size, h = s / 2;
    const col = BULLET_COLORS[color] || color;
    const [c, g] = makeCanvas(s);
    g.translate(h, h);
    switch (type) {
      case 'small':
        glow(g, 0, 0, h, col, 0.6); circle(g, 0, 0, 3.4, col); circle(g, 0, 0, 2, '#fff'); break;
      case 'orb':
        glow(g, 0, 0, h, col, 0.5); circle(g, 0, 0, 6.2, col); circle(g, 0, 0, 4, '#fff'); break;
      case 'big':
        glow(g, 0, 0, h, col, 0.45); circle(g, 0, 0, 14, col); circle(g, 0, 0, 10.5, '#fff');
        g.strokeStyle = hexA(col, 0.8); g.lineWidth = 1; g.beginPath(); g.arc(0, 0, 16, 0, TAU); g.stroke();
        break;
      case 'rice':
        glow(g, 0, 0, h * 0.8, col, 0.45); ellipse(g, 0, 0, 7, 3.6, col); ellipse(g, 0, 0, 4.6, 1.9, '#fff'); break;
      case 'needle':
        glow(g, 0, 0, h * 0.6, col, 0.4); ellipse(g, 0, 0, 10, 2.4, col); ellipse(g, 0, 0, 7.5, 1.1, '#fff'); break;
      case 'star':
        glow(g, 0, 0, h, col, 0.5);
        g.fillStyle = col; starPath(g, 0, 0, 7.5, 3.4); g.fill();
        g.fillStyle = '#fff'; starPath(g, 0, 0, 4, 1.8); g.fill();
        break;
      case 'bigstar':
        glow(g, 0, 0, h, col, 0.5);
        g.fillStyle = col; starPath(g, 0, 0, 15, 7); g.fill();
        g.fillStyle = '#fff'; starPath(g, 0, 0, 8.5, 3.8); g.fill();
        break;
      case 'shade': // 光る縁と、真っ黒な芯
        glow(g, 0, 0, h, col, 0.6); circle(g, 0, 0, 7, col); circle(g, 0, 0, 5, '#14061f');
        circle(g, -1.6, -1.6, 1.1, 'rgba(255,255,255,0.7)');
        break;
      case 'moth': // 頭が進行方向。後翅に目玉模様
        glow(g, 0, 0, h * 0.8, col, 0.4);
        ellipse(g, -1, -4.2, 5.5, 3.6, col, -0.5); ellipse(g, -1, 4.2, 5.5, 3.6, col, 0.5);
        ellipse(g, -4.5, -3.4, 3.4, 2.6, col, 0.4); ellipse(g, -4.5, 3.4, 3.4, 2.6, col, -0.4);
        circle(g, -4.8, -3.4, 1.3, '#fff'); circle(g, -4.8, 3.4, 1.3, '#fff');
        ellipse(g, 0.5, 0, 5, 1.4, '#fff');
        break;
      case 'shard':
        glow(g, 0, 0, h * 0.7, col, 0.4);
        g.fillStyle = col; g.beginPath(); g.moveTo(8, 0); g.lineTo(-6, -3.6); g.lineTo(-4, 0); g.lineTo(-6, 3.6); g.closePath(); g.fill();
        g.fillStyle = '#fff'; g.beginPath(); g.moveTo(6, 0); g.lineTo(-3, -1.4); g.lineTo(-3, 1.4); g.closePath(); g.fill();
        break;
    }
    return c;
  },

  item(type) {
    const k = 'item|' + type;
    if (this.cache[k]) return this.cache[k];
    const s = ITEM_SIZE[type], h = s / 2;
    const [c, g] = makeCanvas(s);
    g.translate(h, h);
    const box = (col, label) => {
      glow(g, 0, 0, h, col, 0.4);
      const r = h * 0.72;
      g.fillStyle = col; g.fillRect(-r, -r, r * 2, r * 2);
      g.strokeStyle = '#fff'; g.lineWidth = 0.8; g.strokeRect(-r + 0.5, -r + 0.5, r * 2 - 1, r * 2 - 1);
      g.fillStyle = '#fff'; g.font = `bold ${Math.round(r * 1.5)}px ${FONT_SANS}`;
      g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(label, 0, 0.5);
    };
    switch (type) {
      case 'power': case 'bigpower': box('#e8344a', 'P'); break;
      case 'point': box('#3d6bff', '点'); break;
      case 'bomb': box('#2fbf6a', '喰'); break;
      case 'life': box('#ff5fb8', '命'); break;
      case 'eat': // 食べた夢の欠片
        glow(g, 0, 0, h, '#ffd27a', 0.7);
        g.fillStyle = '#fff3c8'; starPath(g, 0, 0, 3.4, 1.5); g.fill();
        break;
    }
    return (this.cache[k] = c);
  },

  pshot(name) {
    const k = 'ps|' + name;
    if (this.cache[k]) return this.cache[k];
    const [w, h, col] = { pmain: [8, 24, '#9fe8ff'], pfull: [8, 24, '#ffd27a'], popt: [7, 16, '#c9a8ff'] }[name];
    const [c, g] = makeCanvas(w, h);
    const gr = g.createLinearGradient(0, 0, 0, h);
    gr.addColorStop(0, '#ffffff'); gr.addColorStop(0.4, hexA(col, 0.9)); gr.addColorStop(1, hexA(col, 0));
    g.fillStyle = gr; g.beginPath(); g.ellipse(w / 2, h / 2, w / 2, h / 2, 0, 0, TAU); g.fill();
    return (this.cache[k] = { img: c, w, h });
  },
};
