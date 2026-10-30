'use strict';
// ============================================================
//  最終夢　夢そのもの ― 「人が夢を見るかぎり」
//
//  ここまでの五つの夢のルールが、すべて混ざりあう面。
//   ・道中は「夢の走馬灯」。背景が予知夢→悪夢→吉夢→逆夢→残夢と移り変わり、
//     その区間ではその夢のルール（悪夢の闇・逆夢の砂時計など）がそのまま生きている
//   ・ラスボスの弾は五色。色がそのまま夢の種類を表す
//       金＝予知夢　紫＝悪夢　桃＝吉夢　水色＝逆夢　セピア＝残夢
//   ・夢札は「二つの夢を混ぜたもの」。どの夢とどの夢かが分かれば、攻略も分かる
//   ・最後は耐久夢札「夢幻物語」。夜が明けるまで耐えれば、夢はほどけて朝が来る
//
//  主人公（夢から生まれた獏）とラスボス（夢という概念の精霊）は、どちらも
//  「人が夢を見るかぎり消えない」存在。中ボスの「獏の影」は、獏もまた夢の一部であることの象徴。
//  ラスボスのモチーフは胡蝶の夢 ―「どちらが、どちらの夢を見ているのか」。
// ============================================================

// 五つの夢の色と弾（ルールを持たない「見た目だけ」の組み合わせ）
const DREAM_COLS = ['#ffc857', '#a35bff', '#ff9ab0', '#3fe6ff', '#e8c08a'];
const DREAM5 = [
  { type: 'star', col: 'gold' },    // 予知夢
  { type: 'moth', col: 'purple' },  // 悪夢
  { type: 'petal', col: 'pink' },   // 吉夢
  { type: 'gem', col: 'cyan' },     // 逆夢
  { type: 'orb', col: 'sepia' },    // 残夢
];

function lerpColor(a, b, t) {
  const p = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const x = p(a), y = p(b);
  return `rgb(${x.map((v, i) => Math.round(lerp(v, y[i], t))).join(',')})`;
}

// 胡蝶の翅の形（中心から右側。左は scale(-1,1) で）
function wingPath(c, s) {
  c.beginPath();
  c.moveTo(0, -2);
  c.bezierCurveTo(s * 0.25, -s * 0.9, s * 1.05, -s * 0.8, s * 0.9, -s * 0.2);
  c.bezierCurveTo(s * 0.8, 0, s * 0.35, s * 0.02, 0, -2);
  c.moveTo(0, 2);
  c.bezierCurveTo(s * 0.45, s * 0.1, s * 0.8, s * 0.55, s * 0.5, s * 0.72);
  c.bezierCurveTo(s * 0.3, s * 0.82, s * 0.1, s * 0.4, 0, 2);
}

// ------------------------------------------------------------
//  背景：夢の核
//   五色の星雲が渦を巻いて中心へ流れこみ、これまでの夢の欠片も吸い込まれていく。
//   中心には胡蝶の影。最後の夢札では、空がゆっくり夜明けの色になる。
//   道中では、これまでの面の背景を「層」として重ね、移り変わらせる。
// ------------------------------------------------------------
class BgStage6 {
  constructor() {
    this.t = 0; this.spell = 0; this.dawn = 0; this.dawnHold = 0;
    this.layers = {}; this.cur = 0; this.prev = 0; this.mix = 1;
    this.omens = []; this.marks = []; this.blink = 0;
    [this.off, this.offG] = makeCanvas(FW, FH); // 層を重ねるときの下書き用
    this.motes = Array.from({ length: 150 }, () => this.newMote({}, rand(0, 1)));
    this.frags = Array.from({ length: 10 }, (_, i) => this.newFrag({}, i % 4, rand(0, 1)));
  }
  newMote(m, k) { m.arm = randInt(0, 4); m.r = lerp(16, 320, k); m.off = rand(-0.3, 0.3); m.v = rand(0.4, 1); return m; }
  newFrag(f, kind, k) { f.kind = kind; f.r = lerp(60, 330, k); f.a = rand(0, TAU); f.s = rand(22, 40); f.rot = rand(0, TAU); return f; }

  // ---- 層（これまでの面の背景）----
  layer(k) {
    if (!k) return null;
    if (!this.layers[k]) this.layers[k] = new [null, BgStage1, BgStage2, BgStage3, BgStage4, BgStage5][k]();
    return this.layers[k];
  }
  get L() { return this.layer(this.cur); }
  setLayer(k) {
    if (k === this.cur) return;
    this.prev = this.cur; this.cur = k; this.mix = 0;
    const L = this.layer(k);
    if (k === 2) L.fear = 0;                          // 悪夢の闇は、入るたびに最初から
    if (k === 4) { L.flipT = L.period; L.anim = 0; } // 砂時計も最初から
  }

  // ---- これまでの夢の道具が参照するもの（いまの層へ取り次ぐ）----
  seen(x, y) { const L = this.L; return L && L.seen ? L.seen(x, y) : 1; }
  get flips() { const L = this.L; return L instanceof BgStage4 ? L.flips : 0; }
  get anim() { const L = this.L; return L instanceof BgStage4 ? L.anim : 0; }
  hg() { return Game.boss && Game.boss.alive ? Game.boss.pd.hg : null; }
  sand() { const hg = this.hg(), L = this.L; return hg ? hg.t / hg.max : L && L.sand ? L.sand() : 0.5; }
  hgRot() { const L = this.L; return L && L.hgRot ? L.hgRot() : 0; }
  onGraze() { const L = this.L; if (L && L.onGraze) L.onGraze(); }
  onBomb() { const L = this.L; if (L && L.onBomb) L.onBomb(); }
  onMiss() { const L = this.L; if (L && L.onMiss) L.onMiss(); }

  update(spellOn) {
    this.t++;
    const bd = Game.boss && Game.boss.alive ? Game.boss.pd : {};
    this.spell = lerp(this.spell, spellOn ? 1 : 0, 0.04);
    this.dawn = lerp(this.dawn, Math.max(bd.dawn || 0, this.dawnHold), 0.02);
    if (this.mix < 1) this.mix = Math.min(1, this.mix + 1 / 50);
    const L = this.L;
    if (L) L.update(spellOn);
    for (const m of this.motes) { // 星雲の粒は中心へ流れこむ
      m.r -= m.v * (0.4 + m.r * 0.004);
      if (m.r < 8) this.newMote(m, 1);
    }
    for (const f of this.frags) {
      f.r -= 0.25 + f.r * 0.002; f.a += 0.004; f.rot += 0.01;
      if (f.r < 20) this.newFrag(f, f.kind, 1);
    }
    if (this.blink > 0) this.blink--;
    for (const o of this.omens) o.life--;
    this.omens = this.omens.filter((o) => o.life > 0);
    for (const m of this.marks) m.life--;
    this.marks = this.marks.filter((m) => m.life > 0);
  }

  draw(c) {
    if (this.mix < 1) { // 前の層の上に、次の層が溶けこんでくる
      this.drawLayer(c, this.prev);
      const g = this.offG;
      g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, this.off.width, this.off.height);
      g.setTransform(SCALE, 0, 0, SCALE, 0, 0); g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
      this.drawLayer(g, this.cur);
      c.save(); c.globalAlpha = easeInOutSine(this.mix); c.drawImage(this.off, 0, 0, FW, FH); c.restore();
    } else {
      this.drawLayer(c, this.cur);
    }
    BgStage4.prototype.drawOmens.call(this, c);
    BgStage5.prototype.drawMarks.call(this, c);
  }
  drawLayer(c, k) {
    if (k) this.layer(k).draw(c);
    else this.drawCore(c);
  }

  drawCore(c) {
    const d = this.dawn, cx = FW / 2, cy = FH * 0.38;
    const g = c.createLinearGradient(0, 0, 0, FH);
    g.addColorStop(0, lerpColor('#07061a', '#3a4a8a', d));
    g.addColorStop(0.55, lerpColor('#150f38', '#b88aa8', d));
    g.addColorStop(1, lerpColor('#24163f', '#ffd6a0', d));
    c.fillStyle = g; c.fillRect(0, 0, FW, FH);

    // 五色の星雲
    for (let k = 0; k < 5; k++) {
      const a = this.t * 0.003 + (TAU * k) / 5;
      glow(c, cx + Math.cos(a) * 110, cy + Math.sin(a) * 80, 130, DREAM_COLS[k], 0.09 * (1 - d * 0.6));
    }
    c.save(); c.globalCompositeOperation = 'lighter';
    for (const m of this.motes) {
      const a = (TAU * m.arm) / 5 + m.off + this.t * 0.004 + 1.8 * Math.log(m.r / 16);
      c.fillStyle = hexA(DREAM_COLS[m.arm], 0.55 * Math.min(1, m.r / 60));
      c.fillRect(cx + Math.cos(a) * m.r, cy + Math.sin(a) * m.r * 0.8, 1.6, 1.6);
    }
    c.restore();

    // 吸いこまれていく夢の欠片
    for (const f of this.frags) {
      c.save();
      c.translate(cx + Math.cos(f.a) * f.r, cy + Math.sin(f.a) * f.r * 0.8); c.rotate(f.rot);
      BgStage5.prototype.drawMotif.call(this, c, f.kind, f.s * 0.3, `rgba(255,240,220,${0.35 * Math.min(1, f.r / 120)})`);
      c.restore();
    }

    // 胡蝶の影
    c.save(); c.translate(cx, cy);
    c.strokeStyle = `rgba(255,240,255,${0.1 + 0.12 * this.spell})`; c.lineWidth = 1;
    for (const s of [-1, 1]) { c.save(); c.scale(s * (0.85 + 0.15 * Math.sin(this.t * 0.02)), 1); wingPath(c, 160); c.stroke(); c.restore(); }
    c.restore();
    glow(c, cx, cy, 70, '#ffffff', 0.22 + 0.25 * d);

    c.fillStyle = `rgba(6,4,20,${0.25 + 0.1 * d})`; c.fillRect(0, 0, FW, FH); // 弾を見やすく

    if (this.spell > 0.01) { // 五色の曼荼羅
      c.save(); c.globalAlpha = this.spell; c.translate(cx, cy); c.rotate(this.t * 0.002);
      for (let k = 0; k < 5; k++) {
        const a = (TAU * k) / 5;
        c.strokeStyle = hexA(DREAM_COLS[k], 0.35); c.lineWidth = 2;
        c.beginPath(); c.arc(0, 0, 170, a + 0.08, a + TAU / 5 - 0.08); c.stroke();
        c.save(); c.rotate(a); glow(c, 0, -170, 10, DREAM_COLS[k], 0.6); c.restore();
      }
      c.strokeStyle = 'rgba(255,240,255,0.18)'; c.lineWidth = 1;
      starPath(c, 0, 0, 150, 58, 5); c.stroke();
      c.rotate(-this.t * 0.005);
      c.beginPath(); c.arc(0, 0, 110, 0, TAU); c.stroke();
      c.restore();
    }
  }

  drawOver(c) {
    const L = this.L;
    if (L && L.drawOver && this.mix >= 1 && !(L instanceof BgStage5)) L.drawOver(c);
    const hg = this.hg();
    if (hg && !(L instanceof BgStage4)) {
      glow(c, 14, 50, 16, '#9fe8ff', hg.t <= 24 ? 0.6 : 0.2);
      drawHourglass(c, 14, 50, 11, 20, hg.t / hg.max, 0, 0.95);
    }
    if (this.blink > 0) {
      c.fillStyle = `rgba(4,0,8,${Math.sin((Math.PI * this.blink) / 16) * 0.85})`;
      c.fillRect(0, 0, FW, FH);
    }
  }
}

// ------------------------------------------------------------
//  中ボス：獏の影
//   夢から生まれた獏もまた、夢の一部。夢の核に映った、もう一匹の獏。
// ------------------------------------------------------------
function drawShadowBaku(c, b) {
  const t = b.frame;
  c.save(); c.translate(b.x, b.y + Math.sin(t * 0.05) * 2);
  glow(c, 0, 0, 48, '#a35bff', 0.45);
  c.save(); c.rotate(-t * 0.02);
  c.strokeStyle = 'rgba(200,120,255,0.5)'; c.setLineDash([5, 7]);
  c.beginPath(); c.arc(0, 0, 38, 0, TAU); c.stroke(); c.setLineDash([]);
  c.restore();
  const img = Art.get(b.def.art);
  if (img) {
    Art.draw(c, img, 0, 0, 64);
  } else {
    c.save(); c.scale(2, 2); c.filter = 'brightness(0.45) contrast(1.3)';
    Player.prototype.drawBaku.call({ frame: t, isFull: false }, c); // 自機と同じ姿の、影
    c.restore();
    glow(c, -9, -22, 7, '#ff3b5c', 0.9); glow(c, 9, -22, 7, '#ff3b5c', 0.9);
  }
  c.restore();
}

// 獏喰の輪（夢札中）
function drawShadowEat(c, b) {
  const e = b.pd.eat;
  if (!e) return;
  c.save(); c.translate(b.x, b.y);
  const g = c.createRadialGradient(0, 0, e.r * 0.3, 0, 0, e.r);
  g.addColorStop(0, 'rgba(40,10,60,0)'); g.addColorStop(1, 'rgba(60,20,90,0.35)');
  c.fillStyle = g; c.beginPath(); c.arc(0, 0, e.r, 0, TAU); c.fill();
  c.strokeStyle = 'rgba(220,180,255,0.7)'; c.lineWidth = 2;
  c.beginPath();
  for (let i = 0; i <= 64; i++) {
    const a = (TAU * i) / 64, rr = e.r + Math.sin(a * 8 - b.frame * 0.3) * 4;
    c.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
  }
  c.stroke();
  c.globalAlpha = 0.25; c.fillStyle = '#e8dcff'; c.font = `bold ${Math.round(40 + e.r * 0.3)}px ${FONT_SERIF}`;
  c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('獏', 0, 0);
  c.restore();
}

// --- 通常：鏡写しの獏 ---
// 影は自機と鏡写しの側へ動き、獏と同じようにショットを真下へ撃つ。
// → 影の真下に入らないこと。影を撃つには、真ん中寄りで影と向き合う必要がある。
function* mid6Non(b) {
  yield* moveTo(b, FW / 2, 90, 30);
  b.tasks.add((function* () {
    for (;;) {
      const tx = FW / 2 - (Game.player.x - FW / 2) * 0.5;
      b.x = lerp(b.x, clamp(tx, 40, FW - 40), 0.04);
      yield 1;
    }
  })());
  for (let f = 0; ; f++) {
    if (f % 6 === 0) for (const dx of [-6, 6]) Bullets.shoot(b.x + dx, b.y + 16, Math.PI / 2, D.s(4.2), 'needle', 'purple', { delay: 2 });
    if (f % D.pick(16, 12, 10, 8) === 0) {
      for (const s of [-1, 1]) Bullets.shoot(b.x + s * 30, b.y + 10, Math.PI / 2 + s * 0.25, D.s(3), 'rice', 'pink', { delay: 2 });
    }
    if (f % 90 === 45) Bullets.ring(b.x, b.y, D.n(20), rand(0, TAU), D.s(1.6), 'orb', 'ash');
    if (f % 6 === 0) Sound.play('shot');
    yield 1;
  }
}

// --- 夢札：獏喰「夢を喰らう夢」---
// 影は五色の夢をばらまき、ときどき獏喰で自分のまわりの弾を食べる（広がる輪が予告）。
// 食べられた弾は消える。……が、食べても夢は消えきらない。半分は薄れて残り、少しして震え、自機へ戻ってくる。
function* mid6Spell(b) {
  yield* moveTo(b, FW / 2, 110, 30);
  b.tasks.add((function* () {
    for (let k = 0; ; k++) {
      const d = DREAM5[k % 5];
      Bullets.ring(b.x, b.y, D.n(18), k * 0.37, D.s(1.6), d.type, d.col);
      yield D.pick(32, 26, 23, 21);
    }
  })());
  for (;;) {
    yield D.pick(150, 130, 110, 100);
    const max = D.pick(150, 170, 190, 210);
    b.pd.eat = { r: 0 };
    Sound.play('warn');
    for (let i = 1; i <= 40; i++) { b.pd.eat.r = max * easeOutCubic(i / 40); yield 1; }
    Sound.play('bomb');
    let n = 0;
    for (const s of Bullets.list) {
      if (!s.alive || s.ghost || dist(s.x, s.y, b.x, b.y) > max) continue;
      if (n++ % 2) { s.alive = false; Effects.spark(s.x, s.y, '#e8c08a', 1, 1, 14, 1.2); continue; } // 本当に食べられた夢
      s.ghost = s.fake = true; s.color = 'sepia'; s.accel = 0; s.angVel = 0;                          // 食べ残し：あとで戻る
      s.fn = revive(s.frame + 1, D.pick(90, 80, 70, 60));
    }
    for (let i = 0; i < 20; i++) { b.pd.eat.r *= 0.88; yield 1; }
    b.pd.eat = null;
  }
}

// ------------------------------------------------------------
//  ラスボス：夢の精霊
// ------------------------------------------------------------
const MEMORY_DRAW6 = [null, () => drawSeer, () => drawNightmare, () => drawKichimu, () => drawSakayume, () => drawZanmu];
function drawYume(c, b) {
  const t = b.frame, m = b.pd.memo || 0;
  if (m) { // 巡っている夢の、ボスの影
    c.save();
    c.globalAlpha = 0.3; c.filter = 'sepia(0.6) brightness(1.15)';
    c.translate(b.x, b.y - 10); c.scale(1.4, 1.4); c.translate(-b.x, -(b.y - 10));
    MEMORY_DRAW6[m]()(c, { x: b.x, y: b.y - 10, frame: t, def: { art: 'boss' + m }, pd: {} });
    c.restore();
  }
  c.save(); c.translate(b.x, b.y + Math.sin(t * 0.03) * 3);
  // 星空でできた胡蝶の翅
  const flap = 0.8 + 0.2 * Math.sin(t * 0.04);
  for (const s of [-1, 1]) {
    c.save(); c.scale(s * flap, 1);
    const g = c.createLinearGradient(0, -50, 60, 40);
    g.addColorStop(0, 'rgba(90,60,200,0.55)'); g.addColorStop(0.5, 'rgba(255,150,200,0.42)'); g.addColorStop(1, 'rgba(255,210,120,0.38)');
    c.fillStyle = g; wingPath(c, 62); c.fill();
    c.strokeStyle = 'rgba(255,240,255,0.6)'; c.lineWidth = 1; c.stroke();
    for (let i = 0; i < 7; i++) {
      const u = 12 + ((i * 37) % 40), v = -36 + ((i * 23) % 60);
      c.fillStyle = `rgba(255,255,255,${0.4 + 0.4 * Math.sin(t * 0.08 + i)})`;
      c.fillRect(u, v, 1.5, 1.5);
    }
    c.restore();
  }
  // 五つの夢の光
  for (let k = 0; k < 5; k++) {
    const a = t * 0.02 + (TAU * k) / 5;
    glow(c, Math.cos(a) * 36, -6 + Math.sin(a) * 12, 9, DREAM_COLS[k], 0.8);
    circle(c, Math.cos(a) * 36, -6 + Math.sin(a) * 12, 2.2, '#ffffff');
  }
  const img = Art.get(b.def.art);
  if (img) {
    Art.draw(c, img, 0, 0, 64);
  } else {
    glow(c, 0, 0, 36, '#ffffff', 0.25);
    // 夜空の髪
    c.fillStyle = '#1c1a52';
    c.beginPath(); c.moveTo(-9, -20); c.quadraticCurveTo(-21, 10, -15, 34); c.lineTo(15, 34); c.quadraticCurveTo(21, 10, 9, -20); c.fill();
    for (let i = 0; i < 8; i++) {
      c.fillStyle = `rgba(255,255,255,${0.5 + 0.5 * Math.sin(t * 0.1 + i * 1.7)})`;
      c.fillRect(-12 + ((i * 7) % 24), -10 + ((i * 11) % 40), 1.2, 1.2);
    }
    // 白い衣。裾に五色
    c.fillStyle = '#fbf8ff';
    c.beginPath(); c.moveTo(0, -8); c.quadraticCurveTo(-15, 8, -13, 24); c.lineTo(13, 24); c.quadraticCurveTo(15, 8, 0, -8); c.fill();
    for (let k = 0; k < 5; k++) { c.fillStyle = DREAM_COLS[k]; c.fillRect(-13 + k * 5.2, 21, 5.2, 3.5); }
    circle(c, 0, -14, 7, '#fff6f0');
    if (b.pd.eyesOpen) { // 最後の夢札でだけ、目を開く
      for (const s of [-1, 1]) {
        const gg = c.createRadialGradient(s * 2.6, -14, 0, s * 2.6, -14, 1.8);
        gg.addColorStop(0, '#ffffff'); gg.addColorStop(0.5, '#a35bff'); gg.addColorStop(1, '#1c1a52');
        c.fillStyle = gg; c.beginPath(); c.arc(s * 2.6, -14, 1.8, 0, TAU); c.fill();
      }
    } else {
      c.strokeStyle = '#4a3a6a'; c.lineWidth = 1;
      for (const s of [-1, 1]) { c.beginPath(); c.arc(s * 2.6, -14.5, 1.5, Math.PI * 0.15, Math.PI * 0.85); c.stroke(); }
    }
    c.strokeStyle = 'rgba(255,230,160,0.85)'; c.lineWidth = 1;
    c.beginPath(); c.ellipse(0, -26, 9, 2.5, 0, 0, TAU); c.stroke(); // 光輪
  }
  c.restore();
}

// --- 通常1：五色の渦 ---
// 五つの夢の色が、ひとつの渦になる。この面の「色＝夢の種類」を見せる最初の弾幕。
function* b6Non1(b) {
  Game.bg.setLayer(0);
  let rot = 0;
  for (let f = 0; ; f++) {
    if (f % D.pick(8, 6, 5, 4) === 0) {
      rot += 0.11;
      for (let k = 0; k < 5; k++) {
        const d = DREAM5[k], a = rot + (TAU * k) / 5;
        Bullets.shoot(b.x, b.y, a, D.s(2), d.type, d.col);
        Bullets.shoot(b.x, b.y, -a + 0.3, D.s(1.5), d.type, d.col);
      }
      if (f % 24 === 0) Sound.play('bullet');
    }
    if (f % 90 === 45) Bullets.fan(b.x, b.y, D.pick(3, 5, 5, 7), aimAngle(b.x, b.y), 0.45, D.s(2.8), 'orb', 'white');
    yield 1;
  }
}

// --- 夢札1：予知悪夢「逃れられない明日」（予知夢 × 悪夢）---
// 悪夢の闇の中で、予知夢の予告線が「これから行く場所」を指す。
// その線を蛾の群れが飛び、予告した場所に着くと震えて散る。
// → 予告線を見たら、進む向きを変える。闇は夢かじりで晴らす。
function* b6Spell1(b) {
  Game.bg.setLayer(2);
  yield* moveTo(b, FW / 2, 80, 40);
  for (;;) {
    const p = Game.player, targets = [];
    for (let i = 0; i < D.pick(2, 3, 3, 4); i++) {
      const k = 40 + i * 25;
      targets.push({ x: clamp(p.x + p.vx * k * 1.2, 10, FW - 10), y: clamp(p.y + p.vy * k * 1.2, 40, FH - 10) });
    }
    for (const q of targets) Effects.warnLine(b.x, b.y, angleTo(b.x, b.y, q.x, q.y), 640, 45, 'gold');
    Sound.play('warn');
    yield 45;
    for (const q of targets) {
      const a = angleTo(b.x, b.y, q.x, q.y), d = dist(b.x, b.y, q.x, q.y);
      for (let j = 0; j < D.pick(5, 7, 8, 9); j++) {
        const sp = D.s(3 + j * 0.25);
        Bullets.shoot(b.x, b.y, a, sp, 'moth', 'purple', {
          fn: morphing(Math.max(20, Math.round(d / sp)), (s) => {
            s.retype('moth', 'pink'); s.ang = rand(0, TAU);
            s.spd = 0; s.accel = 0.025; s.maxSpd = D.s(1.4);
            s.fn = flutter(0.4, 0.1);
          }, 14),
        });
      }
    }
    Sound.play('bullet');
    yield D.pick(70, 55, 45, 40);
  }
}

// --- 通常2：夢の万華鏡 ---
// 六枚の鏡に映った五色の夢。色（夢の種類）が少しずつ移り変わる。
function* b6Non2(b) {
  Game.bg.setLayer(0);
  yield* moveTo(b, FW / 2, 110, 30);
  for (let f = 0; ; f++) {
    if (f % D.pick(8, 6, 5, 4) === 0) {
      const th = Math.sin(f * 0.012) * 0.55;
      const d = DREAM5[Math.floor(f / 36) % 5];
      for (let i = 0; i < 6; i++) {
        const base = (TAU * i) / 6 - f * 0.003;
        for (const s of [1, -1]) Bullets.shoot(b.x, b.y, base + s * th, D.s(1.9), d.type, d.col);
      }
      if (f % 24 === 0) Sound.play('bullet');
    }
    if (f % 100 === 50) Bullets.fan(b.x, b.y, D.pick(3, 5, 5, 7), aimAngle(b.x, b.y), 0.4, D.s(2.8), 'orb', 'white');
    yield 1;
  }
}

// --- 夢札2：禍福「糾える縄」（吉夢 × 逆夢）---
// 禍福は糾える縄の如し。白抜きの赤い矢（禍）と福の銭が、縄のように編まれて降りてくる。
// 砂時計が返ると、禍の矢だけが引き返す。福は当たらないが、拾えばまどろむ。
// → 編み目のすきまを抜ける。引き返してくる矢に備えて、福は拾いすぎない。
function* b6Spell2(b) {
  Game.bg.setLayer(0);
  yield* moveTo(b, FW / 2, 70, 40);
  b.tasks.add((function* () { for (;;) yield* sandFlip(b, D.pick(200, 180, 170, 160)); })());
  const ropes = D.pick(3, 4, 5, 5);
  for (let f = 0; ; f++) {
    if (f % 4 === 0) {
      for (let r = 0; r < ropes; r++) {
        const base = Math.PI / 2 + (r - (ropes - 1) / 2) * 0.62 + Math.sin(f * 0.008) * 0.2;
        const w = Math.sin(f * 0.07) * 0.2;
        Bullets.shoot(b.x, b.y, base + w, D.s(2.2), 'arrow', 'red', { rev: true });
        if (f % 12 === 0) bless(b.x, b.y, base - w, D.s(2.2), { fn: null });
      }
      if (f % 20 === 0) Sound.play('bullet');
    }
    if (f % 120 === 60) Bullets.fan(b.x, b.y, D.pick(3, 3, 5, 5), aimAngle(b.x, b.y), 0.3, D.s(2.8), 'gem', 'cyan');
    yield 1;
  }
}

// --- 通常3：残響する五色 ---
// 五色の輪が薄れてボスへ巻き戻り、もう一度広がる。
function* b6Non3(b) {
  Game.bg.setLayer(0);
  for (let k = 0; ; k++) {
    const d = DREAM5[k % 5];
    Bullets.ring(b.x, b.y, D.n(24), k * 0.17, D.s(2), d.type, d.col, { fn: replay(65) });
    yield 26;
    if (k % 3 === 2) { Bullets.fan(b.x, b.y, D.pick(3, 5, 5, 7), aimAngle(b.x, b.y), 0.5, D.s(2.8), 'orb', 'white'); yield* wander(b, 40); }
  }
}

// --- 夢札3：夢境「五つの夢の巡り」---
// 予知夢 → 悪夢 → 吉夢 → 逆夢 → 残夢。背景ごと夢が切り替わり、その夢のルールで攻撃する。
// うしろには、その夢のボスの影が浮かぶ。いま何の夢かが分かれば、どう避けるかも分かる。
function* dreamSegment(b, m, frames) {
  Game.bg.setLayer(m);
  b.pd.memo = m;
  b.pd.flip = m === 4 ? D.pick(150, 130, 120, 110) : undefined;
  for (let f = 0; f < frames; f++) {
    switch (m) {
      case 1: // 予知夢：これから行く場所へ
        if (f % 50 === 10) {
          const sp = D.s(3);
          Bullets.fan(b.x, b.y, D.pick(3, 5, 5, 7), leadAngle(b.x, b.y, sp), 0.35, sp, 'star', 'gold');
        }
        if (f % 120 === 60) b.tasks.add(memYochi());
        if (f % 10 === 0) Bullets.shoot(rand(0, FW), -6, Math.PI / 2 + rand(-0.15, 0.15), D.s(rand(1.2, 1.8)), 'small', 'gold');
        break;
      case 2: // 悪夢：闇の中で、震えて化ける
        if (f % 60 === 0) b.tasks.add(memAkumu(b.x, b.y));
        if (f % 60 === 30) Bullets.fan(b.x, b.y, D.pick(3, 5, 5, 7), aimAngle(b.x, b.y), 0.4, D.s(2.6), 'shade', 'red');
        break;
      case 3: // 吉夢：福と花
        if (f % 18 === 0) bless(rand(20, FW - 20), -8, Math.PI / 2, 0.6, { fn: gravity(0.015, 1.5) });
        if (f % 50 === 0) b.tasks.add(memKichi(b.x, b.y));
        break;
      case 4: // 逆夢：白抜きの矢は、砂時計で引き返す
        if (f % 45 === 0) Bullets.ring(b.x, b.y, D.n(20), rand(0, TAU), D.s(1.8), 'arrow', f % 90 ? 'white' : 'cyan', { rev: true });
        if (f % 90 === 70) Bullets.fan(b.x, b.y, D.pick(3, 3, 5, 5), aimAngle(b.x, b.y), 0.3, D.s(2.6), 'orb', 'blue');
        break;
      case 5: // 残夢：薄れて戻る。さっきいた場所に栞
        if (f % 50 === 0) Bullets.ring(b.x, b.y, D.n(18), rand(0, TAU), D.s(1.8), 'orb', 'sepia', { fn: revive(40, 60) });
        if (f % 40 === 20) { const q = pastPos(25); bookmark(q.x, q.y, D.pick(100, 90, 80, 70), D.pick(6, 8, 10, 12)); }
        break;
    }
    if (f === 0 || f % 24 === 0) Sound.play('bullet');
    yield 1;
  }
}
function* b6Spell3(b) {
  yield* moveTo(b, FW / 2, 90, 40);
  for (let k = 0; ; k++) yield* dreamSegment(b, (k % 5) + 1, 300);
}

// --- 夢札4：今夢「昨日と明日のあいだ」（残夢 × 予知夢）---
// 金の針は「これから行く場所」へ（予告線つき）、セピアの針は「さっきまでいた場所」へ（栞つき）。
// 同じ向きに動き続ければ明日に撃たれ、戻れば昨日に撃たれる。
// → 安全なのは「今」だけ。止まる・向きを変える、を繰り返す。
function* b6Spell4(b) {
  Game.bg.setLayer(0);
  yield* moveTo(b, FW / 2, 80, 40);
  b.tasks.add((function* () {
    for (let k = 0; ; k++) {
      Bullets.ring(b.x, b.y, D.n(16), k * 0.3, D.s(1.3), 'small', 'white');
      yield D.pick(80, 64, 56, 50);
    }
  })());
  for (let k = 0; ; k++) {
    // 明日
    const sp = D.s(3.4), a = leadAngle(b.x, b.y, sp);
    Effects.warnLine(b.x, b.y, a, 640, 26, 'gold');
    Sound.play('warn');
    yield 26;
    for (let j = 0; j < D.pick(5, 7, 8, 9); j++) Bullets.shoot(b.x, b.y, a + rand(-0.015, 0.015), sp + j * 0.22, 'needle', 'gold');
    Sound.play('bullet');
    yield D.pick(20, 16, 14, 12);
    // 昨日
    const q = pastPos(35);
    bookmark(q.x, q.y, 50, D.pick(4, 6, 8, 8));
    const a2 = angleTo(b.x, b.y, q.x, q.y);
    for (let j = 0; j < D.pick(5, 7, 8, 9); j++) Bullets.shoot(b.x, b.y, a2, D.s(2.6 + j * 0.22), 'needle', 'sepia');
    Sound.play('bullet');
    yield D.pick(26, 20, 16, 14);
  }
}

// --- 夢札5：胡蝶「どちらが夢を見ているのか」---
// 画面の向こう側に、あなたを鏡に映した「夢の中の獏」があらわれ、胡蝶を放つ。
// あなたが右へ行けば夢の獏は左へ、下がれば上へ。夢を見ているのは、あなたか、夢か。
// → 夢の獏の位置は自分の動きで決まる。蝶の出どころを、自分で動かして避ける。
function refPos() {
  const p = Game.player;
  return { x: FW - p.x, y: 24 + ((FH - p.y) / FH) * 120 };
}
function drawDreamedBaku(c, b) {
  const r = b.pd.ref;
  if (!r) return;
  c.save(); c.translate(r.x, r.y);
  glow(c, 0, 0, 34, '#ffd970', 0.35);
  c.strokeStyle = 'rgba(255,230,180,0.6)'; c.lineWidth = 1;
  for (const s of [-1, 1]) {
    c.save(); c.scale(s * (0.8 + 0.2 * Math.sin(b.frame * 0.12)), 1);
    c.fillStyle = 'rgba(255,200,140,0.25)'; wingPath(c, 26); c.fill(); c.stroke();
    c.restore();
  }
  c.globalAlpha = 0.75; c.scale(1, -1); // 夢の中の獏は、逆さまに映る
  Player.prototype.drawBaku.call({ frame: b.frame, isFull: true }, c);
  c.restore();
}
function* b6Spell5(b) {
  Game.bg.setLayer(0);
  yield* moveTo(b, FW / 2, 70, 40);
  b.pd.ref = refPos();
  b.tasks.add((function* () { for (;;) { const r = refPos(); b.pd.ref.x = lerp(b.pd.ref.x, r.x, 0.1); b.pd.ref.y = lerp(b.pd.ref.y, r.y, 0.1); yield 1; } })());
  let rot = 0;
  for (let f = 0; ; f++) {
    if (f % D.pick(50, 40, 34, 30) === 0) {
      const r = b.pd.ref, n = D.n(12);
      Bullets.ring(r.x, r.y, n, rand(0, TAU), D.s(1.6), 'moth', 'gold', { fn: flutter(0.35, 0.1) });
      if (D.lv >= 1) Bullets.ring(r.x, r.y, n, rand(0, TAU), D.s(1.2), 'moth', 'pink', { fn: flutter(0.45, 0.08) });
      Effects.ring(r.x, r.y, '#ffd970', 30, 20);
      Sound.play('bullet');
    }
    if (f % D.pick(10, 8, 7, 6) === 0) { // ボス本体の、ゆるやかな渦
      rot += 0.19;
      for (let i = 0; i < 3; i++) Bullets.shoot(b.x, b.y, rot + (TAU * i) / 3, D.s(1.7), 'star', 'silver');
    }
    yield 1;
  }
}

// --- 最終夢札：「夢幻物語」（耐久）---
// 夜が明けるまで耐える。時間がたつほど、五つの夢がひとつずつ重なっていく。
//   最初：五色の渦 → 予知夢の流れ星 → 逆夢の砂時計 → 吉夢の福 → 悪夢と残夢
// 空はだんだん夜明けの色になり、最後には夢がほどけて、すべての弾が薄れて消える。
function* b6Last(b) {
  Game.bg.setLayer(0);
  yield* moveTo(b, FW / 2, 110, 40);
  b.pd.eyesOpen = true;
  const total = 50 * 60;
  let rot = 0;
  for (let f = 0; ; f++) {
    const T = Math.min(1, f / total);
    b.pd.dawn = T;
    if (T < 0.86) {
      if (f % D.pick(11, 9, 8, 7) === 0) { // 一：五色の渦（白抜きの矢は、砂時計で返る）
        rot += 0.13;
        for (let k = 0; k < 5; k++) {
          const d = DREAM5[k], a = rot + (TAU * k) / 5;
          if (k === 3) Bullets.shoot(b.x, b.y, a, D.s(1.8), 'arrow', 'cyan', { rev: true });
          else Bullets.shoot(b.x, b.y, a, D.s(1.8), d.type, d.col);
        }
      }
      if (T > 0.12 && T < 0.82 && f % 170 === 0) b.tasks.add(memYochi());      // 二：予知夢（夜明け前に落ちきるように）
      if (T > 0.3 && f % 210 === 100) b.tasks.add(sandFlip(b, 90));            // 三：逆夢
      if (T > 0.45 && f % 36 === 0) bless(rand(20, FW - 20), -8, Math.PI / 2, 0.6, { fn: gravity(0.015, 1.5) }); // 四：吉夢
      if (T > 0.6 && f % 150 === 75) b.tasks.add(memAkumu(b.x, b.y));         // 五：悪夢
      if (T > 0.6 && f % 150 === 0) Bullets.ring(b.x, b.y, D.n(18), rand(0, TAU), D.s(1.6), 'orb', 'sepia', { fn: revive(45, 60) }); // 残夢
      if (f % 24 === 0) Sound.play('bullet');
    } else if (!b.pd.dissolved) { // 夜明け：夢がほどけていく
      b.pd.dissolved = true;
      for (const s of Bullets.list) { s.ghost = s.fake = true; s.fn = null; s.jit = 0; s.life = s.frame + 90; }
      Effects.flash(b.x, b.y, 200, '#fff4e0', 60);
      Sound.play('capture');
    }
    yield 1;
  }
}

// ------------------------------------------------------------
//  ボス定義
// ------------------------------------------------------------
const MIDBOSS6 = {
  name: '獏の影', art: 'shadow', isMid: true, draw: drawShadowBaku,
  phases: [
    { hp: 1400, time: 30, fn: mid6Non },
    { hp: 1800, time: 40, spell: true, name: '獏喰「夢を喰らう夢」', bonus: 2000000, fn: mid6Spell, draw: drawShadowEat },
  ],
};

const BOSS6 = {
  name: '夢の精霊', art: 'boss6', draw: drawYume,
  phases: [
    { hp: 2400, time: 30, fn: b6Non1 },
    { hp: 2800, time: 45, spell: true, name: '予知悪夢「逃れられない明日」', bonus: 3000000, fn: b6Spell1 },
    { hp: 2400, time: 30, fn: b6Non2 },
    { hp: 2900, time: 45, spell: true, name: '禍福「糾える縄」', bonus: 3200000, fn: b6Spell2 },
    { hp: 2400, time: 30, fn: b6Non3 },
    { hp: 3600, time: 60, spell: true, name: '夢境「五つの夢の巡り」', bonus: 3600000, fn: b6Spell3 },
    { hp: 3000, time: 45, spell: true, name: '今夢「昨日と明日のあいだ」', bonus: 3600000, fn: b6Spell4 },
    { hp: 3200, time: 50, spell: true, name: '胡蝶「どちらが夢を見ているのか」', bonus: 4000000, fn: b6Spell5, draw: drawDreamedBaku },
    { hp: 1, time: 50, spell: true, survival: true, name: '「夢幻物語」', bonus: 6000000, fn: b6Last },
  ],
};

// セリフはあとで入れる。空のままなら会話はスキップされる。
const DIALOG6 = {
  midboss: [],
  boss: [],
  after: [],
};

// ------------------------------------------------------------
//  道中：夢の走馬灯
// ------------------------------------------------------------
function* dreamLayer(k, name, col) {
  Game.bg.setLayer(k);
  Game.notice = { text: name, t: 140, col };
  yield 60;
}

function* stage6Script() {
  const G = Game;
  yield 40;
  G.showBanner('最終夢　夢そのもの', '～ 人が夢を見るかぎり');
  G.showBgm('夢の走馬灯（仮）');
  yield 200;

  // 予知夢の層
  yield* dreamLayer(1, '― 予知夢 ―', '#ffe6a0');
  yield* sakiWave([60, 120, 180, 240, 300], [80, 100], 14);
  yield 40;
  for (let i = 0; i < 4; i++) { spawnBird(i % 2 === 0, 60 + i * 20); yield 24; }
  spawnClock(FW / 2, 100);
  yield* waitUntil(() => Enemies.list.length === 0, 420);

  // 悪夢の層
  yield* dreamLayer(2, '― 悪夢 ―', '#e0b0ff');
  for (let i = 0; i < 6; i++) { spawnMoth(i % 2 ? rand(220, 340) : rand(44, 164)); yield 22; }
  yield* shadowWave([[80, 100], [304, 100], [FW / 2, 160]], 30);
  yield 60;
  spawnChaser(FW / 2);
  yield* waitUntil(() => Enemies.list.length === 0, 480);

  // 吉夢の層
  yield* dreamLayer(3, '― 吉夢 ―', '#ffe68a');
  for (let i = 0; i < 6; i++) { spawnNasu(50 + i * 57); yield 18; }
  for (let i = 0; i < 4; i++) { spawnHawk(i % 2 === 0, 70 + i * 20); yield 26; }
  spawnOugi(FW / 2, 100);
  yield* waitUntil(() => Enemies.list.length === 0, 480);

  // 逆夢の層
  yield* dreamLayer(4, '― 逆夢 ―', '#9fe8ff');
  for (let i = 0; i < 5; i++) { spawnBat(50 + i * 71, rand(60, 110)); yield 26; }
  spawnKoi(100); yield 40; spawnKoi(284);
  yield 60;
  spawnMikuji(FW / 2, 90, 0);
  yield* waitUntil(() => Enemies.list.length === 0, 520);

  // 残夢の層
  yield* dreamLayer(5, '― 残夢 ―', '#e8c08a');
  for (let i = 0; i < 5; i++) { spawnEmber(50 + i * 71, rand(60, 110)); yield 30; }
  spawnBell(100); spawnBell(284);
  yield 60;
  spawnShiori(FW / 2, 100);
  yield* waitUntil(() => Enemies.list.length === 0, 520);

  // 夢の核へ
  G.bg.setLayer(0);
  G.notice = { text: '五つの夢が、ひとつに溶けあう', t: 160, col: '#ffffff' };
  yield 160;

  // 中ボス：獏の影
  yield* bossFight(MIDBOSS6, { dialog: DIALOG6.midboss });
  yield 90;

  // 混ざりあう夢：これまでの雑魚が入り乱れる
  const mixed = [
    () => sakiWave([rand(40, FW - 40)], [rand(60, 120)], 1),
    () => spawnMoth(rand(40, FW - 40)),
    () => spawnHawk(Math.random() < 0.5, rand(60, 120)),
    () => spawnBat(rand(40, FW - 40), rand(60, 110)),
    () => spawnEmber(rand(40, FW - 40), rand(60, 110)),
  ];
  for (let i = 0; i < 15; i++) {
    const r = mixed[i % 5]();
    if (r && r.next) G.stageTasks.add(r); // sakiWave は道中のタスクとして動かす
    yield 30;
  }
  spawnHusk(FW / 2);
  yield 120;
  spawnMirror(90);
  yield* waitUntil(() => Enemies.list.length === 0, 1000);
  yield 120;

  // ラスボス
  yield* bossFight(BOSS6, { dialog: DIALOG6.boss, bgm: '夢の精霊　～ The Butterfly Dreams of You（仮）' });
  yield 60;
  // 夜明け
  G.bg.dawnHold = 1;
  G.notice = { text: '夜が、明けていく', t: 240, col: '#fff4e0' };
  yield 220;
  yield* G.dialog(DIALOG6.after);
  yield 60;
  G.stageClear();
}

const STAGE6 = {
  no: 6, name: '最終夢', title: '夢そのもの',
  leftoverRate: 0.15,
  midLife: true, // 中ボスを倒すと残機アイテム
  drowse: true,
  clearTitle: '夢幻異変　解決',
  ending: [
    '夜が明けた。',
    '人々は、それぞれの夢から目を覚ました。',
    'けれど、夢はなくならない。',
    '人が夢を見るかぎり ―― 獏も、夢も。',
  ],
  makeBg: () => new BgStage6(),
  script: stage6Script,
};
