'use strict';
// ============================================================
//  共通定数・数学・入力・タスク（コルーチン）
// ============================================================

// ---- 画面とプレイフィールド ----
const W = 640, H = 480;          // 論理解像度（東方と同じ 4:3）
const FX = 32, FY = 16;          // プレイフィールド左上
const FW = 384, FH = 448;        // プレイフィールドの大きさ
const SCALE = 2;                 // 内部描画倍率（文字や弾をくっきり描くため）
const VIEW = { ox: FX, oy: FY }; // 画面揺れ込みのフィールド原点

const TAU = Math.PI * 2;
const DEG = Math.PI / 180;

const FONT_SERIF = "'Yu Mincho','YuMincho','Hiragino Mincho ProN','Noto Serif JP','MS PMincho',serif";
const FONT_SANS = "'Yu Gothic UI','Yu Gothic','Hiragino Sans','Meiryo','Noto Sans JP',sans-serif";

// ---- 数学 ----
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const rand = (a, b) => a + Math.random() * (b - a);
const randInt = (a, b) => Math.floor(a + Math.random() * (b - a + 1));
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const angleTo = (x1, y1, x2, y2) => Math.atan2(y2 - y1, x2 - x1);
const dist = (x1, y1, x2, y2) => Math.hypot(x2 - x1, y2 - y1);
const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);
const easeInOutSine = (t) => -(Math.cos(Math.PI * t) - 1) / 2;

function fmt(n) {
  return Math.floor(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

// '#rrggbb' / '#rgb' → rgba()
function hexA(hex, a) {
  let h = hex.slice(1);
  if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
  const v = parseInt(h, 16);
  return `rgba(${(v >> 16) & 255},${(v >> 8) & 255},${v & 255},${a})`;
}

// ---- 難易度（夢の深さ） ----
const DIFFS = [
  { name: '浅い眠り', en: 'Easy', density: 0.55, speed: 0.82, color: '#7fe0a0', desc: '弾幕シューティングが初めての人に' },
  { name: '眠り', en: 'Normal', density: 1.0, speed: 1.0, color: '#7fb0ff', desc: '標準的な夢の深さ' },
  { name: '深い眠り', en: 'Hard', density: 1.4, speed: 1.12, color: '#ff9a60', desc: '弾幕に慣れた人に' },
  { name: '醒めない夢', en: 'Lunatic', density: 1.85, speed: 1.22, color: '#d070ff', desc: '夢に囚われた人に' },
];
const D = {
  lv: 1,
  n(v, min = 1) { return Math.max(min, Math.round(v * DIFFS[this.lv].density)); }, // 弾数
  s(v) { return v * DIFFS[this.lv].speed; },                                        // 弾速
  pick(a, b, c, d) { return [a, b, c, d][this.lv]; },                               // 難易度別に直接指定
};

// ---- 入力 ----
const Input = {
  down: {}, tap: {},
  map: {
    ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right',
    KeyZ: 'shot', Enter: 'shot', Space: 'shot',
    KeyX: 'bomb',
    ShiftLeft: 'focus', ShiftRight: 'focus',
    Escape: 'pause', KeyP: 'pause',
    KeyM: 'mute',
    ControlLeft: 'skip', ControlRight: 'skip',
  },
  init() {
    addEventListener('keydown', (e) => {
      const k = this.map[e.code];
      if (k) {
        if (!e.repeat) this.tap[k] = true;
        this.down[k] = true;
        e.preventDefault();
      }
      Sound.unlock();
    });
    addEventListener('keyup', (e) => {
      const k = this.map[e.code];
      if (k) { this.down[k] = false; e.preventDefault(); }
    });
    addEventListener('blur', () => { this.down = {}; });
  },
  held(k) { return !!this.down[k]; },
  pressed(k) { return !!this.tap[k]; },
  endFrame() { this.tap = {}; },
};

// ---- タスク（ジェネレータで弾幕を書くための仕組み）----
//   function* pattern() { 弾を撃つ; yield 30; ... }   ← yield n で n フレーム待つ
class Tasks {
  constructor() { this.list = []; }
  add(gen) { this.list.push({ gen, wait: 0, done: false }); return gen; }
  update() {
    const L = this.list;
    for (let i = 0; i < L.length; i++) {
      const t = L[i];
      if (t.done) continue;
      if (t.wait > 0) { t.wait--; continue; }
      const r = t.gen.next();
      if (r.done) t.done = true;
      else t.wait = Math.max(1, r.value | 0) - 1;
    }
    this.list = this.list.filter((t) => !t.done);
  }
  clear() { for (const t of this.list) t.done = true; this.list = []; }
}

function* waitUntil(cond, max = Infinity) {
  let f = 0;
  while (!cond() && f < max) { f++; yield 1; }
}
