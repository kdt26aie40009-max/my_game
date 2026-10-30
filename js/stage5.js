'use strict';
// ============================================================
//  第五夢　残夢 ― 「目覚めても、消えない夢がある」
//
//  ステージ全体のルール：
//   ・薄れた弾は当たらない。でも消えたわけではない。しばらくして震え、また実体に戻る
//   ・巻き戻る弾：薄れて来た道を逆にたどり、同じ軌道をもう一度なぞる（同じ夢を二度見る）
//   ・予知夢は「これから行く場所」を狙った。残夢は「さっきまでいた場所」を狙う
//   ・獏喰で食べた夢の「食べ残し」がよく戻ってくる
//  → 夢を食べても、その夢を見た人の記憶や感情までは消えない。
//  ボス戦は「回想」。第一夢〜第四夢の仕組みが、残夢のひねりを加えて戻ってくる。
// ============================================================

// ------------------------------------------------------------
//  残夢の弾の性質
// ------------------------------------------------------------

// 薄れて、戻ってくる：at フレーム目に薄れ（当たらない）、ゆっくり止まり、
// dur フレーム後に震えて実体に戻る。戻るときの動きは onBack(b)（既定：自機を狙う）
function revive(at, dur, onBack) {
  return (b) => {
    const f = b.frame;
    if (f === at) { b.ghost = b.fake = true; }
    else if (f > at && f < at + dur) {
      b.spd *= 0.96;
      if (f >= at + dur - 24) b.jit = 1.2;
    } else if (f === at + dur) {
      b.ghost = b.fake = false; b.jit = 0; b.accel = 0;
      if (onBack) onBack(b);
      else { b.ang = aimAngle(b.x, b.y); b.spd = 0; b.accel = 0.04; b.maxSpd = D.s(2.4); }
    }
  };
}

// 巻き戻る：len フレーム飛んだら薄れて来た道を戻り、元の場所から同じ軌道をもう一度。
// （まっすぐ飛ぶ弾にだけ使う）
function replay(len, times = 1) {
  return (b) => {
    if (b.rp === undefined) { b.rp = 0; b.rt = 0; b.a0 = b.ang; }
    if (b.rp >= times * 2) return;
    b.rt++;
    if (b.rp % 2 === 0) {
      if (b.rt === len) { b.ghost = b.fake = true; b.ang += Math.PI; b.rt = 0; b.rp++; }
    } else {
      if (b.rt >= len - 24) b.jit = 1.2;
      if (b.rt === len) { b.ghost = b.fake = false; b.jit = 0; b.ang = b.a0; b.rt = 0; b.rp++; }
    }
  };
}

// 自機が back フレーム前にいた場所
function pastPos(back) {
  const tr = Game.player.trail;
  return tr[Math.max(0, tr.length - 1 - back)] || Game.player;
}

// 砂時計の記憶：wait フレーム後に白抜きの弾が返る（owner があれば左上に砂時計を出す）
function* sandFlip(owner, wait) {
  if (owner) owner.pd.hg = { t: wait, max: wait };
  for (let i = wait; i > 0; i--) {
    if (owner) owner.pd.hg.t = i;
    if (i <= 24) trembleRev();
    yield 1;
  }
  flipRevBullets();
  Sound.play('flip');
  if (owner) owner.pd.hg = null;
}

// ---- 回想：これまでの夢の短い記憶（抜け殻・最終夢札で使う）----
// 予知夢：さっきまでいた場所に予告線 → 流れ星
function* memYochi() {
  const xs = [];
  for (let i = 0; i < D.pick(2, 3, 3, 4); i++) xs.push(clamp(pastPos(20 + i * 25).x + rand(-20, 20), 12, FW - 12));
  for (const x of xs) Effects.warnLine(x, 0, Math.PI / 2, FH, 70, 'gold');
  Sound.play('warn');
  yield 70;
  for (const x of xs) meteor(x);
}
// 悪夢：蛾の輪が止まって震え、自機へ向き直る
function* memAkumu(x, y) {
  Bullets.ring(x, y, D.n(16), rand(0, TAU), D.s(1.8), 'moth', 'purple', {
    accel: -0.03, minSpd: 0,
    fn: morphing(50, (s) => {
      s.ang = aimAngle(s.x, s.y) + rand(-0.3, 0.3);
      s.spd = 0; s.accel = 0.04; s.maxSpd = D.s(2.2); s.minSpd = -99;
      s.fn = flutter(0.3, 0.1);
    }),
  });
  yield 1;
}
// 吉夢：紅白の花と、福の銭
function* memKichi(x, y) {
  const n = D.n(20), a0 = rand(0, TAU);
  for (let i = 0; i < n; i++) {
    const a = a0 + (TAU * i) / n;
    Bullets.shoot(x, y, a, D.s(1.6) * (1 + 0.3 * Math.abs(Math.cos(2.5 * (a - a0)))), 'petal', i % 2 ? 'red' : 'white');
  }
  for (let i = 0; i < 4; i++) bless(x, y, -Math.PI / 2 + rand(-1.2, 1.2), rand(1, 2.2));
  Sound.play('bullet');
  yield 1;
}
// 逆夢：白抜きの矢の輪が、砂時計で引き返す
function* memSaka(x, y, owner) {
  Bullets.ring(x, y, D.n(18), rand(0, TAU), D.s(1.8), 'arrow', 'cyan', { rev: true });
  Sound.play('bullet');
  yield* sandFlip(owner, D.pick(110, 100, 90, 80));
}

// ------------------------------------------------------------
//  背景：記憶の回廊
//   これまでの夢の欠片（星図・扉・富士・砂時計）が、色あせた写真のように漂う。
//   中央の大時計は、ゆっくり逆回りしている。
//   最後には、すべての欠片が一つの場所へ吸い込まれていく。
// ------------------------------------------------------------
class BgStage5 {
  constructor() {
    this.t = 0; this.spell = 0; this.conv = 0; this.memo = 0;
    this.marks = []; // 栞
    this.frags = Array.from({ length: 14 }, (_, i) => this.newFrag({}, rand(-40, FH), i % 4));
    this.dust = Array.from({ length: 50 }, () => ({ x: rand(0, FW), y: rand(0, FH), v: rand(0.2, 0.6), tw: rand(0, TAU) }));
  }
  newFrag(f, y, kind) {
    f.x = rand(20, FW - 20); f.y = y; f.s = rand(26, 58); f.rot = rand(-0.4, 0.4);
    f.vr = rand(-0.004, 0.004); f.vy = rand(0.25, 0.6); f.kind = kind; f.torn = Math.random() < 0.5; f.a = 1;
    return f;
  }
  // 第四夢のボス絵・道具が参照するもの
  sand() { const hg = this.hg(); return hg ? hg.t / hg.max : 0.5; }
  hgRot() { return 0; }
  hg() { return Game.boss && Game.boss.alive ? Game.boss.pd.hg : null; }

  update(spellOn) {
    this.t++;
    const bd = Game.boss && Game.boss.alive ? Game.boss.pd : {};
    this.spell = lerp(this.spell, spellOn ? 1 : 0, 0.04);
    this.memo = bd.memo || 0;
    const cx = FW / 2, cy = FH * 0.4;
    for (const f of this.frags) {
      if (this.conv > 0) { // 一つの場所へ流れていく
        const a = angleTo(f.x, f.y, cx, cy), d = dist(f.x, f.y, cx, cy);
        f.x += Math.cos(a) * Math.min(d, 1 + d * 0.03 * this.conv);
        f.y += Math.sin(a) * Math.min(d, 1 + d * 0.03 * this.conv);
        f.rot += 0.05; f.a = Math.max(0, f.a - 0.006);
      } else {
        f.y += f.vy; f.rot += f.vr;
        if (f.y > FH + 60) this.newFrag(f, -60, f.kind);
      }
    }
    for (const d of this.dust) { d.y -= d.v; if (d.y < -4) { d.y = FH + 4; d.x = rand(0, FW); } }
    for (const m of this.marks) m.life--;
    this.marks = this.marks.filter((m) => m.life > 0);
  }

  draw(c) {
    const g = c.createLinearGradient(0, 0, 0, FH);
    g.addColorStop(0, '#16121f'); g.addColorStop(0.55, '#33283a'); g.addColorStop(1, '#4a3a3c');
    c.fillStyle = g; c.fillRect(0, 0, FW, FH);
    glow(c, FW / 2, FH + 40, 260, '#e8c08a', 0.12); // 目覚めの直前の薄明かり

    // 回想中は、その夢の色が差す
    const tint = ['', '#ffc857', '#ff3b5c', '#ff9ab0', '#9fe8ff'][this.memo];
    if (tint) glow(c, FW / 2, FH * 0.4, 260, tint, 0.12 * this.spell);

    this.drawClock(c, FW / 2, FH * 0.4, 150);
    for (const f of this.frags) this.drawFrag(c, f);

    c.fillStyle = '#e8d0a0';
    for (const d of this.dust) {
      c.globalAlpha = 0.2 + 0.3 * (0.5 + 0.5 * Math.sin(this.t * 0.04 + d.tw));
      c.fillRect(d.x, d.y, 1.3, 1.3);
    }
    c.globalAlpha = 1;
    if (this.conv > 0) glow(c, FW / 2, FH * 0.4, 120 * this.conv, '#fff4e0', 0.5 * this.conv);

    if (this.spell > 0.01) {
      c.globalAlpha = this.spell;
      c.fillStyle = 'rgba(10,6,16,0.35)'; c.fillRect(0, 0, FW, FH);
      this.drawMemoryRing(c, FW / 2, FH * 0.4);
      c.globalAlpha = 1;
    }
    this.drawMarks(c);
  }

  // 逆回りの大時計
  drawClock(c, x, y, R) {
    c.save(); c.translate(x, y);
    c.strokeStyle = 'rgba(232,208,160,0.10)'; c.lineWidth = 1;
    c.beginPath(); c.arc(0, 0, R, 0, TAU); c.stroke();
    for (let i = 0; i < 12; i++) {
      const a = (TAU * i) / 12;
      c.beginPath(); c.moveTo(Math.cos(a) * (R - 10), Math.sin(a) * (R - 10)); c.lineTo(Math.cos(a) * R, Math.sin(a) * R); c.stroke();
    }
    c.strokeStyle = 'rgba(232,208,160,0.16)'; c.lineWidth = 2;
    const h1 = -this.t * 0.004, h2 = -this.t * 0.0004;
    c.beginPath(); c.moveTo(0, 0); c.lineTo(Math.cos(h1) * R * 0.85, Math.sin(h1) * R * 0.85); c.stroke();
    c.beginPath(); c.moveTo(0, 0); c.lineTo(Math.cos(h2) * R * 0.55, Math.sin(h2) * R * 0.55); c.stroke();
    c.restore();
  }

  // 色あせた写真のような夢の欠片
  drawFrag(c, f) {
    c.save(); c.translate(f.x, f.y); c.rotate(f.rot); c.globalAlpha = f.a;
    const s = f.s, h = s / 2;
    c.fillStyle = 'rgba(232,216,184,0.10)';
    c.beginPath();
    c.moveTo(-h, -h); c.lineTo(h, -h); c.lineTo(h, h);
    if (f.torn) for (let i = 1; i < 6; i++) c.lineTo(h - (s * i) / 6, h - (i % 2 ? 5 : 0)); // 破れた縁
    c.lineTo(-h, h); c.closePath(); c.fill();
    c.strokeStyle = 'rgba(232,208,160,0.3)'; c.lineWidth = 1; c.stroke();
    this.drawMotif(c, f.kind, s * 0.32, 'rgba(232,208,160,0.45)');
    c.restore();
  }
  // 0 予知夢：星と天球 / 1 悪夢：扉と目 / 2 吉夢：富士と朝日 / 3 逆夢：砂時計
  drawMotif(c, kind, r, col) {
    c.strokeStyle = col; c.fillStyle = col; c.lineWidth = 1;
    switch (kind) {
      case 0:
        c.beginPath(); c.arc(0, 0, r, 0, TAU); c.stroke();
        starPath(c, 0, 0, r * 0.6, r * 0.25); c.fill();
        break;
      case 1:
        c.strokeRect(-r * 0.5, -r, r, r * 2);
        c.beginPath(); c.ellipse(0, -r * 0.2, r * 0.35, r * 0.15, 0, 0, TAU); c.stroke();
        break;
      case 2:
        c.beginPath(); c.arc(0, -r * 0.4, r * 0.35, 0, TAU); c.fill();
        c.beginPath(); c.moveTo(-r, r * 0.8); c.lineTo(0, -r * 0.2); c.lineTo(r, r * 0.8); c.stroke();
        break;
      case 3:
        c.beginPath(); c.moveTo(-r * 0.6, -r); c.lineTo(r * 0.6, -r); c.lineTo(-r * 0.6, r); c.lineTo(r * 0.6, r); c.closePath(); c.stroke();
        break;
    }
  }
  // 夢札中：四つの夢が輪になって回る。回想中の夢だけ明るい
  drawMemoryRing(c, x, y) {
    c.save(); c.translate(x, y); c.rotate(this.t * 0.002);
    c.strokeStyle = 'rgba(232,208,160,0.18)'; c.lineWidth = 1;
    c.beginPath(); c.arc(0, 0, 165, 0, TAU); c.stroke();
    c.beginPath(); c.arc(0, 0, 120, 0, TAU); c.stroke();
    for (let k = 0; k < 4; k++) {
      const a = (TAU * k) / 4 - Math.PI / 2;
      c.save(); c.translate(Math.cos(a) * 142, Math.sin(a) * 142); c.rotate(-this.t * 0.002);
      const lit = this.memo === k + 1;
      if (lit) glow(c, 0, 0, 34, ['#ffc857', '#ff3b5c', '#ff9ab0', '#9fe8ff'][k], 0.4);
      this.drawMotif(c, k, 14, lit ? 'rgba(255,240,210,0.9)' : 'rgba(232,208,160,0.3)');
      c.restore();
    }
    c.restore();
  }

  // 栞：さっきまでいた場所に挟まれ、時間がたつと開く
  drawMarks(c) {
    for (const m of this.marks) {
      const k = 1 - m.life / m.max;
      c.save(); c.translate(m.x, m.y);
      c.globalAlpha = Math.min(1, (m.max - m.life) / 10);
      c.strokeStyle = hexA('#ff6a7a', 0.3 + 0.5 * k); c.lineWidth = 1;
      c.beginPath(); c.arc(0, 0, lerp(26, 6, k), 0, TAU); c.stroke();
      c.fillStyle = '#e04050';
      c.beginPath(); c.moveTo(-3, -8); c.lineTo(3, -8); c.lineTo(3, 6); c.lineTo(0, 3); c.lineTo(-3, 6); c.closePath(); c.fill();
      c.restore();
    }
  }

  // 第四夢の記憶：左上に砂時計
  drawOver(c) {
    const hg = this.hg();
    if (!hg) return;
    glow(c, 14, 50, 16, '#9fe8ff', hg.t <= 24 ? 0.6 : 0.2);
    drawHourglass(c, 14, 50, 11, 20, hg.t / hg.max, 0, 0.95);
  }
}

// 栞をはさむ：life フレーム後、その場所から輪が開く
function bookmark(x, y, life, n) {
  Game.bg.marks.push({ x, y, life, max: life });
  Game.after(life, () => {
    Bullets.ring(x, y, n, rand(0, TAU), D.s(1.3), 'small', 'sepia');
    Effects.ring(x, y, '#ff6a7a', 30, 20);
  });
}

// ------------------------------------------------------------
//  雑魚敵の見た目（仮グラフィック）
// ------------------------------------------------------------
function drawEmber(c, e) {
  c.save(); c.translate(e.x, e.y);
  const fl = Math.sin(e.frame * 0.3) * 1.5;
  glow(c, 0, 0, 22, '#e8a060', 0.4);
  c.fillStyle = 'rgba(255,200,140,0.75)';
  c.beginPath(); c.moveTo(0, -12 - fl); c.quadraticCurveTo(8, -2, 5, 6); c.quadraticCurveTo(0, 10, -5, 6); c.quadraticCurveTo(-8, -2, 0, -12 - fl); c.fill();
  c.fillStyle = 'rgba(255,244,220,0.9)';
  c.beginPath(); c.moveTo(0, -4 - fl * 0.5); c.quadraticCurveTo(3, 1, 2, 5); c.quadraticCurveTo(0, 7, -2, 5); c.quadraticCurveTo(-3, 1, 0, -4 - fl * 0.5); c.fill();
  c.restore();
}

function drawBell(c, e) {
  c.save(); c.translate(e.x, e.y + Math.sin(e.frame * 0.06) * 2);
  for (let i = 0; i < 3; i++) { // 鳴り響く余韻
    const k = ((e.frame + i * 20) % 60) / 60;
    c.strokeStyle = hexA('#bcd0ff', 0.4 * (1 - k)); c.lineWidth = 1;
    c.beginPath(); c.arc(0, 0, 12 + k * 20, 0, TAU); c.stroke();
  }
  c.rotate(Math.sin(e.frame * 0.15) * 0.25);
  glow(c, 0, 0, 20, '#bcd0ff', 0.35);
  c.fillStyle = '#c8b890';
  c.beginPath(); c.moveTo(-8, 6); c.quadraticCurveTo(-8, -10, 0, -11); c.quadraticCurveTo(8, -10, 8, 6); c.lineTo(10, 8); c.lineTo(-10, 8); c.closePath(); c.fill();
  circle(c, 0, 10, 2.5, '#a89870');
  c.restore();
}

function drawShiori(c, e) {
  c.save(); c.translate(e.x, e.y); c.rotate(Math.sin(e.frame * 0.04) * 0.2);
  glow(c, 0, 0, 24, '#e8c08a', 0.3);
  c.fillStyle = '#f0e4cc'; c.fillRect(-8, -16, 16, 30);
  c.strokeStyle = '#a08860'; c.lineWidth = 1; c.strokeRect(-8, -16, 16, 30);
  c.fillStyle = '#c0a0d0'; starPath(c, 0, -2, 5, 2.2, 5); c.fill(); // 押し花
  c.strokeStyle = '#e04050'; c.lineWidth = 2;
  c.beginPath(); c.moveTo(0, -16); c.quadraticCurveTo(4, -24, 0, -30); c.stroke(); // 房
  c.restore();
}

function drawHusk(c, e) {
  c.save(); c.translate(e.x, e.y + Math.sin(e.frame * 0.03) * 2);
  const col = ['#ffc857', '#a35bff', '#ff9ab0', '#9fe8ff'][e.mem || 0];
  glow(c, 0, 0, 46, col, 0.25 + 0.1 * Math.sin(e.frame * 0.08));
  c.fillStyle = 'rgba(232,216,184,0.28)';
  c.beginPath(); c.ellipse(0, 0, 18, 28, 0, 0, TAU); c.fill();
  c.strokeStyle = 'rgba(232,208,160,0.7)'; c.lineWidth = 1.2; c.stroke();
  for (let i = -2; i <= 2; i++) { c.beginPath(); c.ellipse(0, i * 9, 17 - Math.abs(i) * 3, 2, 0, 0, Math.PI); c.stroke(); }
  c.strokeStyle = 'rgba(255,255,255,0.6)'; // ひび
  c.beginPath(); c.moveTo(-4, -20); c.lineTo(2, -10); c.lineTo(-3, -2); c.lineTo(4, 8); c.stroke();
  glow(c, 0, 0, 10, col, 0.8);
  c.restore();
}

// 残夢の精霊（仮グラフィック）。回想中は、昔のボスの影がうしろに浮かぶ
const MEMORY_DRAW = [null, () => drawSeer, () => drawNightmare, () => drawKichimu, () => drawSakayume];
function drawZanmu(c, b) {
  const t = b.frame;
  const m = b.pd.memo || 0;
  if (m) { // 記憶の中のボス（セピア色）
    c.save();
    c.globalAlpha = 0.35; c.filter = 'sepia(0.85) brightness(1.1)';
    c.translate(b.x, b.y - 8); c.scale(1.35, 1.35); c.translate(-b.x, -(b.y - 8));
    MEMORY_DRAW[m]()(c, { x: b.x, y: b.y - 8, frame: t, def: { art: 'boss' + m }, pd: {} });
    c.restore();
  }
  // 残像：少し前の自分が、まだそこにいる
  if (!b.after) b.after = [];
  if (t % 4 === 0) { b.after.push({ x: b.x, y: b.y }); if (b.after.length > 5) b.after.shift(); }
  b.after.forEach((p, i) => {
    c.save(); c.globalAlpha = 0.08 + i * 0.03;
    ellipse(c, p.x, p.y + 6, 12, 18, '#e8d8f0');
    c.restore();
  });

  c.save(); c.translate(b.x, b.y + Math.sin(t * 0.04) * 2);
  // 押し花の輪
  c.save(); c.rotate(t * 0.008);
  c.strokeStyle = 'rgba(232,208,160,0.5)'; c.lineWidth = 1;
  c.beginPath(); c.arc(0, 0, 40, 0, TAU); c.stroke();
  for (let i = 0; i < 8; i++) {
    const a = (TAU * i) / 8;
    c.fillStyle = i % 2 ? 'rgba(200,160,208,0.7)' : 'rgba(232,192,138,0.7)';
    starPath(c, Math.cos(a) * 40, Math.sin(a) * 40, 4.5, 2, 5); c.fill();
  }
  c.restore();
  const img = Art.get(b.def.art);
  if (img) {
    Art.draw(c, img, 0, 0, 64);
  } else {
    glow(c, 0, 0, 34, '#e8c08a', 0.3);
    // 長い髪が、先から光の粒になってほどけていく
    c.fillStyle = 'rgba(220,210,240,0.85)';
    c.beginPath(); c.moveTo(-8, -18); c.quadraticCurveTo(-16, 4, -12, 26); c.lineTo(12, 26); c.quadraticCurveTo(16, 4, 8, -18); c.fill();
    for (let i = 0; i < 6; i++) {
      const k = ((t * 0.6 + i * 17) % 40) / 40;
      c.fillStyle = hexA('#e8d8f0', 0.7 * (1 - k));
      c.fillRect(-12 + i * 5, 26 + k * 18, 1.6, 1.6);
    }
    // 色あせた衣
    c.fillStyle = '#b8a8c8';
    c.beginPath(); c.moveTo(0, -8); c.quadraticCurveTo(-14, 8, -11, 22); c.lineTo(11, 22); c.quadraticCurveTo(14, 8, 0, -8); c.fill();
    c.strokeStyle = '#e8c08a'; c.lineWidth = 1; c.stroke();
    circle(c, 0, -14, 7, '#f4ece8');
    // 半分閉じた目
    c.strokeStyle = '#6a5a7a';
    for (const s of [-1, 1]) { c.beginPath(); c.moveTo(s * 1.4, -13.5); c.lineTo(s * 4, -13.5); c.stroke(); }
    // 押し花の冠
    for (let i = -2; i <= 2; i++) { c.fillStyle = i % 2 ? '#c8a0d0' : '#e8c08a'; starPath(c, i * 4, -21 - (2 - Math.abs(i)), 2.6, 1.2, 5); c.fill(); }
  }
  c.restore();
}

// ------------------------------------------------------------
//  雑魚敵
// ------------------------------------------------------------

// 名残り火：消えたはずの焚き火の、まぶたの裏に残る明かり。
// 撃った弾は途中で薄れ、しばらくして自機へ向かって戻ってくる → 残夢のルールを覚える敵。
function spawnEmber(x, y) {
  return Enemies.add(new Enemy(x, -16, {
    hp: 8, r: 10, score: 1000, draw: drawEmber,
    drops: Math.random() < 0.5 ? { power: 1 } : { point: 1 },
  })).run(function* (e) {
    yield* moveTo(e, x, y, 40);
    for (let k = 0; k < 3; k++) {
      Bullets.ring(e.x, e.y, D.pick(6, 10, 12, 14), rand(0, TAU), D.s(1.8), 'orb', 'sepia', { fn: revive(40, 70) });
      yield D.pick(70, 60, 50, 44);
    }
    e.vy = -1.5;
  });
}

// 残響の鈴：鳴り終わったはずの音が、耳に残り続ける夢。
// 輪が薄れて鈴へ巻き戻り、もう一度同じ輪を描く（二回）→ 一度よけた形を覚えておけばいい。
function spawnBell(x) {
  return Enemies.add(new Enemy(x, -20, {
    hp: 22, r: 11, score: 2000, draw: drawBell, drops: { power: 1, point: 2 },
  })).run(function* (e) {
    yield* moveTo(e, x, rand(70, 120), 50);
    for (let k = 0; k < 2; k++) {
      Bullets.ring(e.x, e.y, D.n(16), rand(0, TAU), D.s(1.8), 'small', 'silver', { fn: replay(50, 2) });
      if (D.lv >= 2) Bullets.ring(e.x, e.y, D.n(16), rand(0, TAU), D.s(1.3), 'small', 'ash', { fn: replay(60, 1) });
      yield 200;
    }
    e.vy = -1.2;
  });
}

// 栞：本のあいだに挟まれたまま忘れられた押し花。
// 「さっきまでいた場所」に栞を挟み、しばらくするとそこから輪が開く → 同じ場所に戻らない。
function spawnShiori(x, y) {
  return Enemies.add(new Enemy(x, -24, {
    hp: 30, r: 12, score: 3000, draw: drawShiori, drops: { power: 2, point: 2 },
  })).run(function* (e) {
    yield* moveTo(e, x, y, 50);
    for (let k = 0; k < 6; k++) {
      const q = pastPos(30);
      bookmark(q.x, q.y, D.pick(110, 100, 90, 80), D.pick(6, 8, 10, 12));
      Bullets.fan(e.x, e.y, D.pick(1, 3, 3, 5), angleTo(e.x, e.y, q.x, q.y), 0.25, D.s(2.6), 'rice', 'sepia');
      yield 50;
    }
    e.vy = -1;
  });
}

// 抜け殻：見終わった夢の、空っぽの殻。中には四つの夢の記憶が残っている。
// 予知夢 → 悪夢 → 吉夢 → 逆夢 の順に、記憶の攻撃をなぞる。
function spawnHusk(x) {
  return Enemies.add(new Enemy(x, -40, {
    hp: 240, r: 22, score: 15000, draw: drawHusk, mem: 0, drops: { power: 4, point: 8 },
  })).run(function* (e) {
    yield* moveTo(e, x, 100, 70);
    for (let loop = 0; loop < 2; loop++) {
      e.mem = 0; yield* memYochi(); yield 60;
      e.mem = 1; yield* memAkumu(e.x, e.y); yield 100;
      e.mem = 2; yield* memKichi(e.x, e.y); yield 100;
      e.mem = 3; yield* memSaka(e.x, e.y, null); yield 60;
    }
    e.vy = -0.8;
  });
}

// ------------------------------------------------------------
//  ボス弾幕：残夢の精霊
// ------------------------------------------------------------

// --- 中ボス 通常：名残の輪 ---
function* mid5Non(b) {
  for (let k = 0; ; k++) {
    Bullets.ring(b.x, b.y, D.n(18), k * 0.2, D.s(1.9), 'orb', 'sepia', { fn: revive(40, 60) });
    Bullets.ring(b.x, b.y, D.n(18), -k * 0.2 + 0.17, D.s(1.4), 'small', 'ash', { fn: revive(55, 60) });
    yield 30;
    Bullets.fan(b.x, b.y, D.pick(3, 5, 5, 7), aimAngle(b.x, b.y), 0.4, D.s(2.6), 'rice', 'ash');
    yield 30;
    if (k % 2) yield* wander(b, 50);
  }
}

// --- 中ボス 夢札：残夢「栞をはさんだ場所」---
// 少し前にいた場所に、次々と栞が挟まれる。時間がたつと、そこから輪が開く。
// ボスは栞めがけて針を撃つ ＝ 過去のあなたを狙っている。
function* mid5Spell(b) {
  yield* moveTo(b, FW / 2, 80, 30);
  for (let k = 0; ; k++) {
    const q = pastPos(20);
    bookmark(q.x, q.y, D.pick(100, 90, 80, 70), D.pick(8, 10, 12, 14));
    const a = angleTo(b.x, b.y, q.x, q.y);
    for (let j = 0; j < D.pick(4, 6, 7, 8); j++) Bullets.shoot(b.x, b.y, a, D.s(2.2 + j * 0.3), 'needle', 'sepia');
    if (k % 4 === 3) Bullets.ring(b.x, b.y, D.n(20), rand(0, TAU), D.s(1.5), 'orb', 'ash');
    Sound.play('bullet');
    yield D.pick(40, 30, 26, 22);
  }
}

// --- ボス 通常1：名残の花 ---
// 五弁の花が咲き、花びらはいったん薄れて止まり、また同じ向きへ咲き直す。
function* b5Non1(b) {
  for (let k = 0; ; k++) {
    const n = D.n(30), a0 = rand(0, TAU);
    for (let layer = 0; layer < 2; layer++) {
      for (let i = 0; i < n; i++) {
        const a = a0 + (TAU * i) / n + (layer * Math.PI) / 5;
        const sp = D.s(layer ? 1.3 : 1.8) * (1 + 0.35 * Math.abs(Math.cos(2.5 * (a - a0))));
        Bullets.shoot(b.x, b.y, a, sp, 'petal', (i + layer) % 2 ? 'sepia' : 'pink', {
          fn: revive(35 + layer * 15, 60, (s) => { s.spd = 0; s.accel = 0.03; s.maxSpd = D.s(2); }),
        });
      }
    }
    Sound.play('bullet');
    yield 45;
    Bullets.fan(b.x, b.y, D.pick(3, 5, 5, 7), aimAngle(b.x, b.y), 0.4, D.s(2.8), 'rice', 'ash');
    yield 35;
    if (k % 2) yield* wander(b, 50);
  }
}

// --- 回想1：予知夢「過ぎた未来の流れ星」---
// 予知夢は「これから行く場所」に流れ星を落とした。残夢は「さっきまでいた場所」に落とす。
// 降る星は薄れて空へ巻き戻り、同じ軌道でもう一度降る。
function* b5Spell1(b) {
  yield* moveTo(b, FW / 2, 80, 40);
  b.pd.memo = 1;
  b.tasks.add((function* () {
    for (;;) {
      Bullets.shoot(rand(0, FW), -6, Math.PI / 2 + rand(-0.15, 0.15), D.s(rand(1.4, 1.9)), 'star', pick(['gold', 'sepia']), { fn: replay(110) });
      yield D.pick(14, 9, 7, 6);
    }
  })());
  for (;;) {
    yield* memYochi();
    yield D.pick(50, 36, 30, 24);
  }
}

// --- 回想2：悪夢「消えない影」---
// 蛾は闇に溶けるように薄れ、しばらくして震え、自機へ向かって戻ってくる。
// 消えたからといって、いなくなったわけではない。
function* b5Spell2(b) {
  yield* moveTo(b, FW / 2, 90, 40);
  b.pd.memo = 2;
  for (let k = 0; ; k++) {
    const fl = flutter(0.4, 0.1);
    const rv = revive(50, 80, (s) => { s.a0 = aimAngle(s.x, s.y) + rand(-0.2, 0.2); s.spd = 0; s.accel = 0.04; s.maxSpd = D.s(2.2); });
    Bullets.ring(b.x, b.y, D.n(20), k * 0.31, D.s(1.8), 'moth', k % 2 ? 'purple' : 'pink', { fn: (s) => { fl(s); rv(s); } });
    Sound.play('bullet');
    yield 40;
    if (k % 2) Bullets.fan(b.x, b.y, D.pick(3, 3, 5, 5), aimAngle(b.x, b.y), 0.35, D.s(2.6), 'shade', 'red');
    yield 20;
    if (k % 3 === 2) yield* wander(b, 50);
  }
}

// --- 通常2：残響の輪 ---
// 広がった輪が薄れてボスへ巻き戻り、もう一度広がる。輪が重なって模様になる。
function* b5Non2(b) {
  for (let k = 0; ; k++) {
    Bullets.ring(b.x, b.y, D.n(24), k * 0.13, D.s(2), 'small', k % 2 ? 'silver' : 'sepia', { fn: replay(70) });
    Sound.play('bullet');
    yield 30;
    if (k % 3 === 2) { Bullets.fan(b.x, b.y, D.pick(3, 5, 5, 7), aimAngle(b.x, b.y), 0.5, D.s(2.8), 'orb', 'ash'); yield* wander(b, 40); }
  }
}

// --- 回想3：吉夢「思い出の福」---
// 福の銭は今も当たらないし、拾えばうれしい。でも拾った場所には「思い出」が残り、
// しばらくすると痛みになって戻ってくる。
function* b5Spell3(b) {
  yield* moveTo(b, FW / 2, 80, 40);
  b.pd.memo = 3;
  b.pd.blessEcho = true;
  b.tasks.add(blessRain(D.pick(24, 22, 20, 18)));
  for (let k = 0; ; k++) {
    yield* memKichi(b.x, b.y);
    yield 30;
    Bullets.fan(b.x, b.y, D.pick(3, 5, 5, 7), aimAngle(b.x, b.y), 0.5, D.s(2.6), 'gem', 'cyan');
    yield 20;
    yield* memKichi(b.x, b.y);
    yield 30;
    if (k % 2) yield* wander(b, 50);
  }
}

// --- 回想4：逆夢「砂の記憶」---
// 白抜きの矢の輪が、記憶の砂時計で引き返す。引き返した矢は薄れて、もう一度戻ってくる。
function* b5Spell4(b) {
  yield* moveTo(b, FW / 2, 90, 40);
  b.pd.memo = 4;
  for (let k = 0; ; k++) {
    Bullets.ring(b.x, b.y, D.n(20), k * 0.2, D.s(1.9), 'arrow', 'cyan', { rev: true });
    Bullets.ring(b.x, b.y, D.n(20), k * 0.2 + 0.15, D.s(1.4), 'arrow', 'white', { rev: true });
    Sound.play('bullet');
    yield* sandFlip(b, D.pick(100, 90, 80, 75));
    for (const s of Bullets.list) if (s.type === 'rice' && !s.fn) s.fn = revive(s.frame + 30, 60);
    yield 10;
  }
}

// --- 最終夢札：残夢「目覚めても消えない夢」---
// 名残の輪の中に、予知夢・悪夢・吉夢・逆夢の記憶が順にあらわれる。
// 削るほど記憶は重なりはじめ、最後には四つの夢が同時に混ざる ― 最終夢への予兆。
function* b5Last(b) {
  yield* moveTo(b, FW / 2, 100, 40);
  b.tasks.add((function* () {
    for (let k = 0; ; k++) {
      Bullets.ring(b.x, b.y, D.n(16), k * 0.23, D.s(1.6), 'orb', 'sepia', { fn: revive(45, 70) });
      yield D.pick(70, 55, 48, 42);
    }
  })());
  const mems = [
    () => memYochi(),
    () => memAkumu(b.x, b.y),
    () => memKichi(b.x, b.y),
    () => memSaka(b.x, b.y, b),
  ];
  for (let k = 0; ; k++) {
    const grow = 1 - b.hp / b.maxHp;
    const n = grow < 0.45 ? 1 : grow < 0.8 ? 2 : 4; // 重なっていく記憶
    for (let i = 0; i < n; i++) {
      const m = (k + i) % 4;
      if (n === 1) b.pd.memo = m + 1;
      else b.pd.memo = 0;
      b.tasks.add(mems[m]());
    }
    yield D.pick(170, 150, 140, 130);
  }
}

// ------------------------------------------------------------
//  ボス定義
// ------------------------------------------------------------
const MIDBOSS5 = {
  name: '残夢の精霊', art: 'boss5', isMid: true, draw: drawZanmu,
  phases: [
    { hp: 1200, time: 25, fn: mid5Non },
    { hp: 1500, time: 35, spell: true, name: '残夢「栞をはさんだ場所」', bonus: 1400000, fn: mid5Spell },
  ],
};

const BOSS5 = {
  name: '残夢の精霊', art: 'boss5', draw: drawZanmu,
  phases: [
    { hp: 2200, time: 30, fn: b5Non1 },
    { hp: 2400, time: 40, spell: true, name: '回想「過ぎた未来の流れ星」', bonus: 2200000, fn: b5Spell1 },
    { hp: 2400, time: 40, spell: true, name: '回想「消えない影」', bonus: 2300000, fn: b5Spell2 },
    { hp: 2200, time: 30, fn: b5Non2 },
    { hp: 2500, time: 40, spell: true, name: '回想「思い出の福」', bonus: 2400000, fn: b5Spell3 },
    { hp: 2600, time: 45, spell: true, name: '回想「砂の記憶」', bonus: 2600000, fn: b5Spell4 },
    { hp: 4200, time: 65, spell: true, name: '残夢「目覚めても消えない夢」', bonus: 4000000, fn: b5Last },
  ],
};

// セリフはあとで入れる。空のままなら会話はスキップされる。
const DIALOG5 = {
  midboss: [],
  boss: [],
  after: [],
};

// ------------------------------------------------------------
//  道中
// ------------------------------------------------------------
function* stage5Script() {
  const G = Game;
  yield 40;
  G.showBanner('第五夢　残夢', '～ 目覚めても、消えない夢がある');
  G.showBgm('記憶の回廊（仮）');
  yield 140;
  G.notice = { text: '薄れた弾は、また戻ってくる', t: 200, col: '#e8c08a' };

  // A：名残り火 ― 薄れて戻る弾を覚える
  for (let i = 0; i < 6; i++) { spawnEmber(50 + i * 57, rand(60, 120)); yield 34; }
  yield 200;

  // B：残響の鈴 ― 巻き戻って同じ輪をもう一度
  spawnBell(100); yield 60; spawnBell(284); yield 60; spawnBell(FW / 2);
  yield 120;
  for (let i = 0; i < 4; i++) { spawnEmber(rand(40, FW - 40), rand(60, 110)); yield 40; }
  yield* waitUntil(() => Enemies.list.length === 0, 600);
  yield 40;

  // C：栞 ― さっきまでいた場所に戻らない
  spawnShiori(110, 100); yield 50; spawnShiori(274, 100);
  yield* waitUntil(() => Enemies.list.length === 0, 600);
  yield 40;

  // D：抜け殻 ― 四つの夢の記憶
  spawnHusk(FW / 2);
  yield* waitUntil(() => Enemies.list.length === 0, 1100);
  yield 60;

  // 中ボス
  yield* bossFight(MIDBOSS5, { dialog: DIALOG5.midboss });
  yield 90;

  // E：鈴と栞
  spawnBell(80); spawnBell(304); yield 80;
  spawnShiori(FW / 2, 90);
  yield 160;
  for (let i = 0; i < 6; i++) { spawnEmber(rand(40, FW - 40), rand(50, 130)); yield 30; }
  yield* waitUntil(() => Enemies.list.length === 0, 700);
  yield 30;

  // F：抜け殻と名残り火
  spawnHusk(120);
  yield 200;
  for (let i = 0; i < 8; i++) { spawnEmber(rand(220, FW - 30), rand(50, 140)); yield 40; }
  yield* waitUntil(() => Enemies.list.length === 0, 900);
  yield 120;

  // ボス
  yield* bossFight(BOSS5, { dialog: DIALOG5.boss, bgm: '残夢の精霊　～ Still Dreaming After Dawn（仮）' });
  yield 60;
  // すべての夢が、一つの場所へ流れていく
  for (let i = 0; i < 120; i++) { G.bg.conv = i / 120; yield 1; }
  G.notice = { text: '夢が、ひとつの場所へ流れていく……', t: 240, col: '#fff4e0' };
  yield 200;
  yield* G.dialog(DIALOG5.after);
  yield 60;
  G.stageClear();
}

const STAGE5 = {
  no: 5, name: '第五夢', title: '残夢',
  leftoverRate: 0.18, // 食べても、夢は残る
  midBomb: true, // 中ボスを倒すと獏喰アイテム
  drowse: true,
  nextHint: '最終夢「夢そのもの」へ続く……',
  makeBg: () => new BgStage5(),
  script: stage5Script,
  // 回想「思い出の福」：拾った福の場所に思い出が残り、あとで戻ってくる
  onBless(b) {
    if (!(Game.boss && Game.boss.alive && Game.boss.pd.blessEcho)) return;
    Bullets.shoot(b.x, b.y, 0, 0, 'gem', 'gold', { ghost: true, fake: true, fn: revive(1, 90) });
  },
};
