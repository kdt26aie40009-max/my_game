'use strict';
// ============================================================
//  第二夢　悪夢 ― 「目を閉じても、暗闇は消えない」
//
//  ステージ全体のルール：
//   ・画面は少しずつ闇に呑まれていく（恐怖が育つ）
//   ・弾をかすめる＝悪夢をかじると、闇は押し返される
//     → 逃げ回るほど暗くなり、向き合うほど明るくなる。獏にとって悪夢は「食べ物」
//   ・悪夢の弾は不規則に「化ける」。ただし化ける前に必ず止まって震える
//     → 理不尽に見える恐怖にも、必ず前触れがある
//  第一夢（未来は全部見えている）と対になる面。
// ============================================================

// ------------------------------------------------------------
//  悪夢の弾の性質
// ------------------------------------------------------------

// 化ける弾：at フレーム目に change(b) で別物になる。
// 直前の warn フレームは減速して震える ＝ 悪夢の「前触れ」。
function morphing(at, change, warn = 24) {
  return (b) => {
    if (b.frame > at - warn && b.frame < at) { b.spd *= 0.9; b.jit = 1.4; }
    else if (b.frame === at) { b.jit = 0; b.fn = null; change(b); }
  };
}

// 羽ばたき：進む向きが左右にふらつく
function flutter(amp = 0.4, freq = 0.12) {
  return (b) => {
    if (b.a0 === undefined) { b.a0 = b.ang; b.ph = rand(0, TAU); }
    b.ang = b.a0 + Math.sin(b.frame * freq + b.ph) * amp;
  };
}

// 目（背景の大きな瞳・中ボス周りの目・最終夢札の目で共通）
//   open: 0=閉じている〜1=見開いている　lx, ly: 視線の向き（-1〜1）
function drawEyeShape(c, x, y, w, open, lx = 0, ly = 0, iris = '#ff3b5c') {
  const hw = w / 2, h = w * 0.2 * open, isOpen = open > 0.04;
  const lidY = isOpen ? -h * 2 : w * 0.12; // 上まぶたのベジェ制御点
  c.save(); c.translate(x, y);
  c.lineWidth = Math.max(1, w * 0.02);
  c.strokeStyle = 'rgba(230,200,255,0.85)';
  const almond = () => {
    c.beginPath(); c.moveTo(-hw, 0); c.quadraticCurveTo(0, -h * 2, hw, 0); c.quadraticCurveTo(0, h * 2, -hw, 0); c.closePath();
  };
  if (isOpen) {
    almond();
    c.save(); c.clip();
    c.fillStyle = '#eadcf2'; c.fillRect(-hw, -h - 2, w, h * 2 + 4);
    const ir = w * 0.17, ix = lx * w * 0.16, iy = ly * h * 0.4;
    const g = c.createRadialGradient(ix, iy, 0, ix, iy, ir);
    g.addColorStop(0, '#ffd0dc'); g.addColorStop(0.35, iris); g.addColorStop(1, '#3a0418');
    c.fillStyle = g; c.beginPath(); c.arc(ix, iy, ir, 0, TAU); c.fill();
    ellipse(c, ix, iy, ir * 0.2, ir * 0.8, '#0a0008');
    circle(c, ix - ir * 0.35, iy - ir * 0.35, ir * 0.18, 'rgba(255,255,255,0.8)');
    c.restore();
    almond(); c.stroke();
  } else {
    c.beginPath(); c.moveTo(-hw, 0); c.quadraticCurveTo(0, lidY, hw, 0); c.stroke();
  }
  // まつ毛（閉じていても見える）
  for (let i = 1; i < 6; i++) {
    const t = i / 6, px = lerp(-hw, hw, t), py = lidY * 2 * t * (1 - t);
    const a = isOpen ? -Math.PI / 2 + (px / hw) * 0.6 : Math.PI / 2 - (px / hw) * 0.6;
    const len = w * 0.09;
    c.beginPath(); c.moveTo(px, py); c.lineTo(px + Math.cos(a) * len, py + Math.sin(a) * len); c.stroke();
  }
  c.restore();
}

// ------------------------------------------------------------
//  背景：果てのない夜の廊下
//   いくら進んでも、奥の赤い灯は近づかない。扉の隙間から光が漏れている。
//   夢札中は天井（廊下の果て）に巨大な瞳が開き、ずっとこちらを見ている。
// ------------------------------------------------------------
class BgStage2 {
  constructor() {
    this.t = 0; this.spell = 0;
    this.fear = 0;     // 恐怖 0〜1：時間とともに育ち、夢かじりで減る
    this.light = 300;  // 自機まわりの明るい半径
    this.heavy = 0;    // 弾まで闇に沈む（夢札「灯りに群がる蛾」）
    this.eye = 0;      // 背景の瞳の開き具合
    this.blink = 0;    // まばたき（一瞬の暗転）
    this.speed = 1;    // 廊下を進む速さ（追いかけられると速くなる）
    this.VX = FW / 2; this.VY = FH * 0.34;
    this.frames = Array.from({ length: 10 }, (_, i) => this.newFrame({ d: 0.1 + i * 0.1 }));
    this.ash = Array.from({ length: 46 }, () => ({
      x: rand(0, FW), y: rand(0, FH), vx: rand(-0.3, 0.3), vy: rand(0.3, 1), rot: rand(0, TAU), vr: rand(-0.05, 0.05), s: rand(1.5, 3.5),
    }));
  }
  newFrame(f) {
    const r = Math.random();
    f.door = r < 0.35 ? -1 : r > 0.65 ? 1 : 0;
    f.lit = Math.random() < 0.4;
    return f;
  }

  // ---- 恐怖（獏が悪夢をかじると減る）----
  onGraze() { this.fear = Math.max(0, this.fear - 0.04); }
  onBomb() { this.fear = 0; }
  onMiss() { this.fear = 0; }
  veilA() { return D.pick(0.5, 0.62, 0.72, 0.8); }
  // 闇の中の敵の見えやすさ（0.25〜1）
  seen(x, y) {
    const p = Game.player, L = this.light;
    const t = clamp((dist(x, y, p.x, p.y) - L * 0.4) / (L * 0.6), 0, 1);
    return Math.max(0.25, 1 - this.veilA() * t);
  }

  update(spellOn) {
    this.t++;
    const bd = Game.boss && Game.boss.alive ? Game.boss.pd : {};
    this.spell = lerp(this.spell, spellOn ? 1 : 0, 0.04);
    this.speed = lerp(this.speed, bd.rush ? 4 : 1, 0.03);
    this.heavy = lerp(this.heavy, spellOn && bd.heavy ? 1 : 0, 0.03);
    this.eye = lerp(this.eye, spellOn && !bd.lidClosed ? 1 : 0, bd.lidClosed ? 0.06 : 0.04);
    if (this.blink > 0) this.blink--;

    if (Game.player.state === 'alive' && !Game.dlg) this.fear = Math.min(1, this.fear + D.pick(0.00035, 0.0005, 0.0006, 0.0007));
    // 夢札「灯りに群がる蛾」中は灯りそのものが小さくなる
    this.light = lerp(this.light, lerp(lerp(300, 90, this.fear), lerp(170, 80, this.fear), this.heavy), 0.06);
    // 闇が深いと鼓動が聞こえる
    if (this.fear > 0.5 && this.t % Math.round(lerp(80, 40, (this.fear - 0.5) * 2)) === 0) Sound.play('beat');

    for (const f of this.frames) {
      f.d -= 0.0016 * this.speed;
      if (f.d < 0.1) this.newFrame(f).d += 1;
    }
    for (const a of this.ash) {
      a.x += a.vx; a.y += a.vy * (0.6 + this.speed * 0.4); a.rot += a.vr;
      if (a.y > FH + 4) { a.y = -4; a.x = rand(0, FW); }
    }
  }

  // 奥行き d の枠（d が小さいほど手前）
  rect(d) {
    const s = 0.11 / d, hw = FW * 0.6 * s, hh = FH * 0.5 * s;
    return { x1: this.VX - hw, x2: this.VX + hw, y1: this.VY - hh, y2: this.VY + hh * 1.5 };
  }

  draw(c) {
    const g = c.createLinearGradient(0, 0, 0, FH);
    g.addColorStop(0, '#0b0614'); g.addColorStop(0.5, '#1a0b26'); g.addColorStop(1, '#0d0612');
    c.fillStyle = g; c.fillRect(0, 0, FW, FH);
    this.drawCorridor(c);

    c.fillStyle = '#4a2060';
    for (const a of this.ash) { // 黒い花びら
      c.save(); c.translate(a.x, a.y); c.rotate(a.rot);
      c.globalAlpha = 0.55; c.beginPath(); c.ellipse(0, 0, a.s, a.s * 0.45, 0, 0, TAU); c.fill();
      c.restore();
    }

    if (this.spell > 0.01) {
      c.globalAlpha = this.spell;
      c.fillStyle = 'rgba(5,0,10,0.45)'; c.fillRect(0, 0, FW, FH);
      const p = Game.player;
      glow(c, this.VX, this.VY, 150, '#ff3b5c', 0.12 * this.eye);
      c.globalAlpha = this.spell * 0.85;
      drawEyeShape(c, this.VX, this.VY, 190, this.eye,
        clamp((p.x - this.VX) / (FW / 2), -1, 1), clamp((p.y - this.VY) / (FH / 2), -1, 1));
      c.globalAlpha = 1;
    }

    // 闇：自機のまわりだけ明るい（弾はこの上に描かれるので見えなくならない）
    this.drawDark(c, this.veilA());
  }

  drawCorridor(c) {
    const VX = this.VX, VY = this.VY;
    // 廊下の果ての赤い灯（決して近づかない）
    glow(c, VX, VY, 140, '#ff3b5c', 0.16 + 0.04 * Math.sin(this.t * 0.03));
    glow(c, VX, VY, 26, '#ffc0d0', 0.35);
    const big = this.rect(0.04);
    c.strokeStyle = 'rgba(170,90,220,0.16)'; c.lineWidth = 1;
    c.beginPath();
    for (const [x, y] of [[big.x1, big.y1], [big.x2, big.y1], [big.x1, big.y2], [big.x2, big.y2]]) { c.moveTo(VX, VY); c.lineTo(x, y); }
    c.stroke();

    const fr = this.frames.slice().sort((a, b) => b.d - a.d);
    const vis = (d) => clamp((1.05 - d) / 0.9, 0, 1) * clamp((d - 0.1) / 0.08, 0, 1);
    c.lineWidth = 1.2;
    for (let i = 0; i < fr.length; i++) {
      const f = fr[i], R = this.rect(f.d), k = vis(f.d);
      if (f.door && i + 1 < fr.length) this.drawDoor(c, R, this.rect(fr[i + 1].d), f.door, k * vis(fr[i + 1].d), f.lit);
      c.strokeStyle = `rgba(190,110,255,${0.06 + 0.3 * k})`;
      c.strokeRect(R.x1, R.y1, R.x2 - R.x1, R.y2 - R.y1);
    }
  }

  // 壁の扉（F：奥の枠、N：手前の枠）
  drawDoor(c, F, N, side, a, lit) {
    if (a < 0.01) return;
    const ex = (R) => (side < 0 ? R.x1 : R.x2);
    const xa = lerp(ex(F), ex(N), 0.3), xb = lerp(ex(F), ex(N), 0.7);
    const ba = lerp(F.y2, N.y2, 0.3), bb = lerp(F.y2, N.y2, 0.7);
    const ta = lerp(ba, lerp(F.y1, N.y1, 0.3), 0.6), tb = lerp(bb, lerp(F.y1, N.y1, 0.7), 0.6);
    c.beginPath(); c.moveTo(xa, ba); c.lineTo(xb, bb); c.lineTo(xb, tb); c.lineTo(xa, ta); c.closePath();
    c.fillStyle = `rgba(4,1,8,${0.8 * a})`; c.fill();
    c.strokeStyle = `rgba(150,80,200,${0.4 * a})`; c.stroke();
    if (lit) { // 隙間から漏れる赤い光
      c.strokeStyle = `rgba(255,70,100,${0.7 * a})`; c.lineWidth = 2;
      c.beginPath(); c.moveTo(xa, ba); c.lineTo(xb, bb); c.stroke();
      c.lineWidth = 1.2;
    }
  }

  drawDark(c, a) {
    const p = Game.player, L = this.light;
    const g = c.createRadialGradient(p.x, p.y, L * 0.4, p.x, p.y, L);
    g.addColorStop(0, 'rgba(5,0,10,0)'); g.addColorStop(1, `rgba(5,0,10,${a})`);
    c.fillStyle = g; c.fillRect(0, 0, FW, FH);
  }

  // 弾より上に描く闇（Game から呼ばれる）
  drawOver(c) {
    if (this.heavy > 0.01) this.drawDark(c, this.heavy * D.pick(0.45, 0.58, 0.66, 0.72));
    if (this.blink > 0) {
      c.fillStyle = `rgba(4,0,8,${Math.sin((Math.PI * this.blink) / 16) * 0.85})`;
      c.fillRect(0, 0, FW, FH);
    }
  }
}

// ------------------------------------------------------------
//  雑魚敵の見た目（仮グラフィック）
//   闇の中では暗く見える（Game.bg.seen）
// ------------------------------------------------------------
function drawMoth(c, e) {
  c.save(); c.globalAlpha = Game.bg.seen(e.x, e.y);
  c.translate(e.x, e.y); c.rotate(e.h + Math.PI / 2);
  const flap = 0.55 + 0.45 * Math.abs(Math.sin(e.frame * 0.35));
  glow(c, 0, 0, 20, '#a35bff', 0.3);
  for (const s of [-1, 1]) {
    c.save(); c.scale(s * flap, 1);
    ellipse(c, 8, -3, 9, 6, '#4a2a6a', -0.4);
    ellipse(c, 7, 6, 6, 5, '#5a2a5a', 0.4);
    circle(c, 9, -3, 3, '#ffd0e0'); circle(c, 9, -3, 1.6, '#ff3b5c'); // 目玉模様
    c.restore();
  }
  ellipse(c, 0, 1, 2.2, 7, '#d8c8e8');
  c.restore();
}

function drawShadow(c, e) {
  c.save(); c.globalAlpha = e.fade * Math.max(0.6, Game.bg.seen(e.x, e.y));
  c.translate(e.x, e.y);
  glow(c, 0, 2, 30, '#a35bff', 0.25);
  c.fillStyle = 'rgba(8,2,14,0.92)';
  c.beginPath();
  c.moveTo(-5, -6); c.quadraticCurveTo(-14, 8, -11, 22);
  for (let i = 0; i <= 6; i++) c.lineTo(-11 + i * (22 / 6), 22 + (i % 2 ? 5 : 0) + Math.sin(e.frame * 0.1 + i) * 2);
  c.quadraticCurveTo(14, 8, 5, -6); c.closePath(); c.fill();
  circle(c, 0, -12, 7, 'rgba(8,2,14,0.92)');
  glow(c, -2.5, -13, 5, '#ffffff', 0.6); glow(c, 2.5, -13, 5, '#ffffff', 0.6);
  circle(c, -2.5, -13, 1.2, '#ffffff'); circle(c, 2.5, -13, 1.2, '#ffffff');
  c.restore();
}

function drawChaser(c, e) {
  const t = e.frame;
  c.save(); c.globalAlpha = Math.max(0.5, Game.bg.seen(e.x, e.y));
  c.translate(e.x, e.y);
  glow(c, 0, 0, 44, '#ff3b5c', 0.16);
  c.strokeStyle = 'rgba(12,3,20,0.95)'; c.lineCap = 'round';
  for (const s of [-1, 1]) { // 下へ伸びてくる長い腕
    const reach = 26 + Math.sin(t * 0.07 + s) * 6;
    c.lineWidth = 4;
    c.beginPath(); c.moveTo(s * 8, -4); c.quadraticCurveTo(s * 26, 10, s * 14, reach); c.stroke();
    c.lineWidth = 1.5;
    for (let f = -1; f <= 1; f++) { c.beginPath(); c.moveTo(s * 14, reach); c.lineTo(s * 14 + f * 4, reach + 7); c.stroke(); }
  }
  ellipse(c, 0, 0, 11, 16, 'rgba(12,3,20,0.95)');
  circle(c, 0, -16, 8, 'rgba(12,3,20,0.95)');
  glow(c, -3, -17, 6, '#ff3b5c', 0.9); glow(c, 3, -17, 6, '#ff3b5c', 0.9);
  circle(c, -3, -17, 1.4, '#ffffff'); circle(c, 3, -17, 1.4, '#ffffff');
  c.restore();
}

function drawMirror(c, e) {
  const p = Game.player;
  if (p.state === 'alive') { // 鏡に映ったあなた（ここを狙ってくる）
    c.save(); c.globalAlpha = 0.3 + 0.12 * Math.sin(e.frame * 0.12);
    c.translate(FW - p.x, p.y);
    glow(c, 0, 0, 18, '#bcd0ff', 0.5);
    ellipse(c, 0, 3, 7, 9, '#bcd0ff'); circle(c, 0, -7, 6, '#bcd0ff');
    c.restore();
  }
  c.save(); c.globalAlpha = Math.max(0.4, Game.bg.seen(e.x, e.y));
  c.translate(e.x, e.y);
  glow(c, 0, 0, 34, '#bcd0ff', 0.25);
  ellipse(c, 0, 0, 16, 22, '#6a5a8a');
  const g = c.createLinearGradient(-14, -20, 14, 20);
  g.addColorStop(0, '#dfe8ff'); g.addColorStop(0.5, '#3a3a6a'); g.addColorStop(1, '#9fb0e0');
  ellipse(c, 0, 0, 13, 19, g);
  c.strokeStyle = 'rgba(255,255,255,0.8)'; c.lineWidth = 0.8;
  c.beginPath();
  for (const [x, y] of [[-6, -14], [10, 6], [-4, 12], [11, -9]]) { c.moveTo(3, -4); c.lineTo(x, y); }
  c.stroke();
  c.restore();
}

function drawWatcher(c, e) {
  const p = Game.player, a = angleTo(e.x, e.y, p.x, p.y);
  const jx = e.jit ? rand(-e.jit, e.jit) : 0;
  c.save(); c.globalAlpha = Math.max(0.7, Game.bg.seen(e.x, e.y));
  if (e.open > 0.3) glow(c, e.x, e.y, 30, '#ff3b5c', 0.3 * e.open);
  drawEyeShape(c, e.x + jx, e.y, 34, e.open, Math.cos(a), Math.sin(a));
  c.restore();
}

// 悪夢の精霊（仮グラフィック）
function drawNightmare(c, b) {
  const t = b.frame;
  const y = b.y + Math.sin(t * 0.04) * 3;
  c.save(); c.translate(b.x, y);
  // ひびの入った魔法陣：回転がときどき引っかかる
  c.save();
  c.rotate(Math.floor(t / 40) * 0.4 + easeOutCubic((t % 40) / 40) * 0.4);
  c.globalAlpha = 0.5; c.strokeStyle = '#c070ff'; c.lineWidth = 1;
  c.beginPath(); c.arc(0, 0, 42, 0, TAU); c.stroke();
  for (let i = 0; i < 7; i++) { const a = (TAU * i) / 7; c.beginPath(); c.arc(0, 0, 48, a, a + 0.6); c.stroke(); }
  starPath(c, 0, 0, 36, 14, 7); c.stroke();
  c.restore();

  const img = Art.get(b.def.art);
  if (img) {
    Art.draw(c, img, 0, 0, 64);
  } else {
    // 蛾の翅（目玉模様）
    const fl = Math.sin(t * 0.08) * 0.12;
    for (const s of [-1, 1]) {
      c.save(); c.scale(s, 1); c.rotate(fl);
      ellipse(c, 20, -8, 22, 12, 'rgba(70,20,90,0.85)', -0.5);
      ellipse(c, 16, 10, 14, 9, 'rgba(90,25,80,0.85)', 0.5);
      circle(c, 24, -10, 5, '#ffd0e0'); circle(c, 24, -10, 3, '#ff3b5c'); circle(c, 24, -10, 1.2, '#14061f');
      c.restore();
    }
    glow(c, 0, 0, 34, '#a35bff', 0.35);
    // 黒いドレス（裾がほつれている）
    c.fillStyle = '#1a0a26';
    c.beginPath(); c.moveTo(0, -8); c.quadraticCurveTo(-20, 8, -16, 26);
    for (let i = 1; i <= 8; i++) c.lineTo(-16 + i * 4, 26 + (i % 2 ? 4 : 0));
    c.quadraticCurveTo(20, 8, 0, -8); c.fill();
    c.strokeStyle = '#ff6fd0'; c.lineWidth = 1; c.stroke();
    // 顔とヴェール。片目だけが赤く光る
    circle(c, 0, -14, 7, '#e8dcf0');
    c.fillStyle = 'rgba(20,6,30,0.88)';
    c.beginPath(); c.arc(0, -14, 8, Math.PI * 1.05, Math.PI * 1.95); c.lineTo(8, -12); c.lineTo(-8, -12); c.fill();
    glow(c, 2.5, -14.5, 5, '#ff3b5c', 0.9); circle(c, 2.5, -14.5, 1.3, '#ffffff');
    // 三日月の冠
    c.fillStyle = '#ffd0e0';
    c.beginPath(); c.arc(0, -25, 6, Math.PI * 0.15, Math.PI * 0.85, true); c.arc(0, -22, 5, Math.PI * 0.8, Math.PI * 0.2); c.fill();
    // 周りを回る小さな目
    for (let i = 0; i < 3; i++) {
      const a = t * 0.03 + (TAU * i) / 3;
      drawEyeShape(c, Math.cos(a) * 30, -4 + Math.sin(a) * 10, 10, 0.5 + 0.5 * Math.sin(t * 0.06 + i * 2), 0, 0);
    }
  }
  c.restore();
}

// ------------------------------------------------------------
//  雑魚敵
// ------------------------------------------------------------

// 灯喰い蛾（ひくいが）：暗闇で何かが顔に触れる夢、灯りに群がる虫への嫌悪から生まれた。
// 灯り（自機）に引き寄せられ、ふらふら飛ぶ → 不規則な動きに慣れる最初の敵。
function spawnMoth(x) {
  return Enemies.add(new Enemy(x, -16, {
    hp: 7, r: 10, score: 800, draw: drawMoth, h: Math.PI / 2, ph: rand(0, TAU),
    drops: Math.random() < 0.5 ? { power: 1 } : { point: 1 },
  })).run(function* (e) {
    const sp = D.pick(1.4, 1.6, 1.8, 2);
    const away = x < FW / 2 ? -1 : 1;
    for (let f = 0; ; f++) {
      const p = Game.player;
      // 灯りの少し上でふらつき、しばらくすると飛び去る
      const goal = f < 170 ? angleTo(e.x, e.y, p.x, clamp(p.y - 150, 50, 190)) : -Math.PI / 2 + away * 0.8;
      let d = goal - e.h; d = Math.atan2(Math.sin(d), Math.cos(d));
      e.h += d * 0.06 + Math.sin(f * 0.21 + e.ph) * 0.16;
      e.vx = Math.cos(e.h) * sp; e.vy = Math.sin(e.h) * sp;
      if (f > 30 && f < 170 && f % D.pick(70, 50, 40, 32) === 0) {
        Bullets.fan(e.x, e.y, D.pick(1, 2, 3, 3), aimAngle(e.x, e.y), 0.4, D.s(2.2), 'moth', 'purple', { fn: flutter(0.35, 0.12) });
      }
      yield 1;
    }
  });
}

// 影法師：「誰もいないはずの部屋に誰かいる」夢。闇から滲み出て、闇に還る。
// 撃つ輪は止まって震えたあと、自機へ向き直る → 「震えたら化ける」を覚える敵。
function spawnShadow(x, y) {
  return Enemies.add(new Enemy(x, y, {
    hp: 20, r: 12, score: 2000, draw: drawShadow, fade: 0, bodyHit: false, invuln: 40,
    drops: { power: 1, point: 1 },
  })).run(function* (e) {
    for (let i = 1; i <= 40; i++) { e.fade = i / 40; yield 1; }
    for (let k = 0; k < D.pick(1, 2, 2, 3); k++) {
      Bullets.ring(e.x, e.y, D.n(10), rand(0, TAU), D.s(1.6), 'shade', 'purple', {
        accel: -0.025, minSpd: 0.2,
        fn: morphing(50, (b) => {
          b.retype('shade', 'red');
          b.ang = aimAngle(b.x, b.y) + rand(-0.12, 0.12);
          b.spd = 0; b.accel = 0.06; b.maxSpd = D.s(2.8);
        }),
      });
      yield 60;
    }
    for (let i = 40; i > 0; i--) { e.fade = i / 40; yield 1; }
    e.alive = false; // 倒されなければ闇に還る
  });
}

function* shadowWave(pts, gap) {
  for (const [x, y] of pts) {
    Effects.twinkle(x, y, 45, 'purple');
    Sound.play('warn');
    Game.after(45, () => spawnShadow(x, y));
    yield gap;
  }
}

// 追い手：追いかけられる夢。どれだけ逃げても、だんだん距離が縮まる。
// 真上から影を落とし続ける → 逃げ続けるのではなく、振り向いて撃ち落とす敵。
function spawnChaser(x) {
  return Enemies.add(new Enemy(x, -30, {
    hp: 70, r: 16, score: 5000, draw: drawChaser, drops: { power: 2, point: 3 },
  })).run(function* (e) {
    yield* moveTo(e, x, 70, 50);
    let k = 0.008;
    for (let f = 0; f < 480; f++) {
      k = Math.min(D.pick(0.03, 0.04, 0.05, 0.06), k + 0.0001); // 追従がだんだん速くなる
      e.x = lerp(e.x, Game.player.x, k);
      if (f % D.pick(14, 10, 8, 6) === 0) {
        Bullets.shoot(e.x + rand(-14, 14), e.y + 14, Math.PI / 2, D.s(2.4), 'shade', 'red', { delay: 4 });
        if (f % 28 === 0) Sound.play('bullet');
      }
      if (D.lv >= 1 && f % 90 === 45) {
        Bullets.fan(e.x, e.y, D.pick(3, 5, 5, 7), aimAngle(e.x, e.y), 0.6, D.s(2), 'moth', 'purple', { fn: flutter(0.3, 0.1) });
      }
      yield 1;
    }
    e.vy = -1.5;
  });
}

// 割れ鏡：鏡に映った自分が、自分と違う動きをする夢。
// 狙うのは「鏡の中のあなた」（左右反転した位置）。倒すと破片が散る。
// → 画面中央にいると本物と鏡像が重なって撃たれる。端に寄れば鏡像は遠ざかる。
function spawnMirror(x) {
  return Enemies.add(new Enemy(x, -30, {
    hp: 90, r: 18, score: 5000, draw: drawMirror, drops: { power: 3, point: 3 },
    onDeath: (e) => {
      const n = D.pick(0, 10, 14, 18);
      if (n) Bullets.ring(e.x, e.y, n, rand(0, TAU), D.s(1.5), 'shard', 'silver');
    },
  })).run(function* (e) {
    yield* moveTo(e, x, 100, 70);
    for (let k = 0; k < 6; k++) {
      yield 50;
      const p = Game.player, mx = FW - p.x;
      const a = angleTo(e.x, e.y, mx, p.y);
      Effects.twinkle(mx, p.y, 20, 'silver');
      Bullets.fan(e.x, e.y, D.pick(3, 5, 5, 7), a, D.pick(0.3, 0.4, 0.35, 0.45), D.s(3), 'shard', 'silver');
      if (D.lv >= 2) Bullets.fan(e.x, e.y, 3, a, 0.15, D.s(3.8), 'shard', 'cyan');
    }
    yield 40;
    e.vy = -1;
  });
}

// ------------------------------------------------------------
//  ボス弾幕：悪夢の精霊
// ------------------------------------------------------------

// --- 中ボス 通常：黒い蛾の群れ ---
function* mid2Non(b) {
  let k = 0;
  for (;;) {
    const n = D.n(14);
    Bullets.ring(b.x, b.y, n, k * 0.21, D.s(1.8), 'moth', 'purple', { fn: flutter(0.5, 0.09) });
    yield 24;
    Bullets.ring(b.x, b.y, n, k * 0.21 + Math.PI / n, D.s(1.5), 'moth', 'pink', { fn: flutter(0.5, 0.09) });
    yield 24;
    Bullets.fan(b.x, b.y, D.pick(3, 3, 5, 5), aimAngle(b.x, b.y), 0.35, D.s(2.8), 'shade', 'red');
    k++;
    yield 36;
    if (k % 3 === 0) yield* wander(b, 50);
  }
}

// --- 中ボス 夢札：影踏「うしろに立つ影」---
// 足元（画面の下＝背後）から影が立ち上がり、蛾になって散る。
// 立つ場所は必ず予告線で示される。一本は必ず「今いる場所」。
function* mid2Spell(b) {
  yield* moveTo(b, FW / 2, 80, 30);
  b.tasks.add((function* () {
    for (let k = 0; ; k++) {
      Bullets.ring(b.x, b.y, D.n(12), k * 0.3, D.s(1.3), 'shade', 'purple');
      yield D.pick(90, 70, 55, 45);
    }
  })());
  for (;;) {
    const xs = [clamp(Game.player.x, 16, FW - 16)];
    for (let i = 1; i < D.pick(2, 3, 4, 5); i++) xs.push(rand(16, FW - 16));
    for (const x of xs) {
      Effects.warnLine(x, FH, -Math.PI / 2, FH, 50, 'purple');
      Effects.twinkle(x, FH - 6, 50, 'purple');
    }
    Sound.play('warn');
    yield 50;
    for (const x of xs) {
      for (let j = 0; j < D.pick(4, 6, 7, 8); j++) {
        Bullets.shoot(x, FH + 8, -Math.PI / 2 + rand(-0.04, 0.04), D.s(4.5 - j * 0.35), 'shade', 'red', {
          accel: -0.03, minSpd: D.s(0.6), bound: 40,
          fn: morphing(70, (s) => {
            s.retype('moth', 'purple');
            s.ang = rand(0, TAU); s.spd = 0; s.accel = 0.03; s.maxSpd = D.s(1.6); s.minSpd = -99;
            s.fn = flutter(0.4, 0.1);
          }),
        });
      }
    }
    Sound.play('bullet');
    yield D.pick(70, 55, 45, 38);
  }
}

// --- ボス 通常1：震える闇の花 ---
// 闇の花が咲き、止まって震え、蛾になる。内側の花びらは自機へ、外側はそのまま外へ。
function* b2Non1(b) {
  let k = 0;
  for (;;) {
    const n = D.n(24), a0 = rand(0, TAU);
    for (let layer = 0; layer < 2; layer++) {
      const col = layer ? 'pink' : 'purple';
      for (let i = 0; i < n; i++) {
        const a = a0 + (TAU * i) / n + (layer * Math.PI) / n;
        const sp = D.s(2.2) * (1 + 0.35 * Math.cos(5 * (a - a0))) * (layer ? 0.75 : 1);
        Bullets.shoot(b.x, b.y, a, sp, 'shade', col, {
          accel: -sp / 50, minSpd: 0,
          fn: morphing(60, (s) => {
            s.retype('moth', col);
            if (!layer) s.ang = aimAngle(s.x, s.y) + rand(-0.4, 0.4);
            s.spd = 0; s.accel = 0.04; s.maxSpd = D.s(2.2); s.minSpd = -99;
          }),
        });
      }
    }
    Sound.play('bullet');
    yield 50;
    Bullets.fan(b.x, b.y, D.pick(3, 5, 5, 7), aimAngle(b.x, b.y), 0.5, D.s(3), 'shade', 'red');
    k++;
    yield 40;
    if (k % 2 === 0) yield* wander(b, 50);
  }
}

// --- 夢札1：変貌「まばたきのあいだに」---
// 美しい二重螺旋。背景の瞳がゆっくり閉じ、弾が震えだしたら合図。
// まばたきの暗転の間に、螺旋は「自機を狙う破片」と「来た道を戻る破片」に化ける。
// → 瞳が閉じ始めたら、今いる場所から離れる準備をする。
function* b2Spell1(b) {
  yield* moveTo(b, FW / 2, 100, 40);
  for (let cyc = 0; ; cyc++) {
    const mine = [];
    const arms = D.pick(3, 4, 5, 5);
    for (let f = 0; f < 110; f++) {
      if (f % D.pick(5, 4, 3, 3) === 0) {
        for (const s of [1, -1]) {
          for (let i = 0; i < arms; i++) {
            const a = s * f * 0.045 + (TAU * i) / arms + cyc;
            mine.push(Bullets.shoot(b.x, b.y, a, D.s(1.5), 'rice', s > 0 ? 'red' : 'pink'));
          }
        }
        if (f % 12 === 0) Sound.play('bullet');
      }
      yield 1;
    }
    b.pd.lidClosed = true; // 瞳が閉じていく
    for (let f = 0; f < 40; f++) {
      for (const s of mine) if (s.alive) { s.jit = 1.4; s.spd *= 0.94; }
      yield 1;
    }
    Game.bg.blink = 16;
    Sound.play('blink');
    yield 8; // 真っ暗な瞬間に化ける
    mine.forEach((s, i) => {
      if (!s.alive) return;
      s.jit = 0;
      if (i % 2) { s.retype('shard', 'purple'); s.ang = aimAngle(s.x, s.y); }
      else { s.retype('shard', 'red'); s.ang += Math.PI; }
      s.spd = 0; s.accel = D.s(0.03); s.maxSpd = D.s(2.6);
    });
    yield 8;
    b.pd.lidClosed = false;
    yield D.pick(90, 70, 60, 50);
  }
}

// --- 通常2：茨の螺旋 ---
// 曲がりながら伸びる茨が、震えたあと逆向きに折れ曲がる。
function* b2Non2(b) {
  let k = 0;
  for (;;) {
    const arms = D.pick(4, 5, 6, 7), dir = k % 2 ? 1 : -1;
    for (let w = 0; w < 6; w++) {
      for (let i = 0; i < arms; i++) {
        const a = (TAU * i) / arms + k * 0.37 + w * 0.06 * dir;
        Bullets.shoot(b.x, b.y, a, D.s(2.4 - w * 0.12), 'rice', w % 2 ? 'purple' : 'red', {
          angVel: 0.022 * dir,
          fn: morphing(46, (s) => {
            s.angVel = -0.03 * dir; s.spd = D.s(2.2);
            s.fn = (q) => { if (q.frame > 100) q.angVel = 0; };
          }, 16),
        });
      }
      yield 4;
    }
    Sound.play('bullet');
    k++;
    yield 36;
    if (k % 2 === 0) {
      Bullets.fan(b.x, b.y, D.pick(3, 5, 5, 7), aimAngle(b.x, b.y), 0.5, D.s(3), 'shade', 'pink');
      yield* wander(b, 50);
    }
  }
}

// --- 夢札2：追夢「振り返れない廊下」---
// 影は「逃げる速さ」に反応して追ってくる（追ってくる影は赤く光る）。
// 高速で逃げ回るほど強く曲がり、低速なら弱く、止まればまっすぐ。
// → 恐怖は逃げるほど追ってくる。落ち着いて（Shift）少しずつ避ける。
function* b2Spell2(b) {
  yield* moveTo(b, FW / 2, 70, 40);
  b.pd.rush = true; // 廊下を走らされる
  b.tasks.add((function* () { // 天井から落ちる埃
    for (;;) { Bullets.shoot(rand(0, FW), -6, Math.PI / 2, D.s(rand(1.2, 1.8)), 'small', 'purple'); yield D.pick(14, 9, 6, 5); }
  })());
  b.tasks.add((function* () {
    for (let f = 0; ; f++) { b.x = FW / 2 + Math.sin(f * 0.012) * 110; yield 1; }
  })());
  const turn = D.pick(0.03, 0.04, 0.045, 0.05);
  const chase = (s) => {
    if (s.frame > 160) { s.color = 'purple'; return; }
    const p = Game.player;
    const run = clamp(Math.hypot(p.vx, p.vy) / 4.3, 0, 1);
    let d = angleTo(s.x, s.y, p.x, p.y) - s.ang;
    d = Math.atan2(Math.sin(d), Math.cos(d));
    s.ang += clamp(d, -1, 1) * turn * run;
    s.color = run > 0.5 ? 'red' : 'purple';
  };
  for (let k = 0; ; k++) {
    const n = D.pick(5, 7, 9, 11);
    const base = Math.PI / 2 + Math.sin(k * 0.7) * 0.5;
    for (let i = 0; i < n; i++) Bullets.shoot(b.x, b.y, base + (i - (n - 1) / 2) * 0.22, D.s(1.9), 'shade', 'purple', { fn: chase });
    Sound.play('bullet');
    yield D.pick(40, 30, 24, 20);
  }
}

// --- 夢札3：闇夜「灯りに群がる蛾」---
// 弾まで闇に沈む。画面のふちの闇から蛾が湧き、灯り＝自機へ集まってくる。
// 夢かじりで闇が晴れる → 怖くても蛾の近くをかすめるほど、周りがよく見える。
function* b2Spell3(b) {
  yield* moveTo(b, FW / 2, 90, 40);
  b.pd.heavy = true;
  const toLight = (s) => {
    if (s.a0 === undefined) { s.a0 = s.ang; s.ph = rand(0, TAU); }
    if (s.frame < 120) {
      let d = aimAngle(s.x, s.y) - s.a0;
      d = Math.atan2(Math.sin(d), Math.cos(d));
      s.a0 += d * 0.012;
    }
    s.ang = s.a0 + Math.sin(s.frame * 0.15 + s.ph) * 0.6;
  };
  b.tasks.add((function* () {
    for (let k = 0; ; k++) {
      yield 100;
      Bullets.ring(b.x, b.y, D.n(16), k * 0.4, D.s(1.4), 'shade', 'purple');
    }
  })());
  for (let f = 0; ; f++) {
    if (f % D.pick(10, 7, 5, 4) === 0) {
      const side = randInt(0, 2);
      const x = side === 0 ? -6 : side === 1 ? FW + 6 : rand(0, FW);
      const y = side === 2 ? -6 : rand(20, FH * 0.7);
      Bullets.shoot(x, y, aimAngle(x, y) + rand(-0.5, 0.5), D.s(rand(1.3, 1.8)), 'moth', pick(['gold', 'pink']), { fn: toLight });
      if (f % 20 === 0) Sound.play('bullet');
    }
    yield 1;
  }
}

// --- 最終夢札：悪夢「目醒めを拒む百の瞳」---
// 闇に目が開いていく。目は閉じている間は安全、まぶたが震えたら狙いが決まり（予告線）、
// 見開いた瞬間に撃つ。目は撃てば閉じさせられる。
// → 放っておくと目は増え続ける。ボスを撃つか、恐怖を一つずつ潰すかの判断。
function spawnWatcher(b, x, y) {
  const pi = b.pi;
  const gone = () => !b.alive || b.pi !== pi || b.trans > 0;
  function* hold(n) {
    for (let i = 0; i < n; i++) { if (gone()) return false; yield 1; }
    return true;
  }
  return Enemies.add(new Enemy(x, y, {
    hp: D.pick(16, 22, 28, 34), r: 13, score: 3000, draw: drawWatcher, watcher: true,
    open: 0, jit: 0, bodyHit: false, invuln: 20, drops: { point: 1 },
    onDeath: (e) => Effects.ring(e.x, e.y, '#ff3b5c', 40, 24),
  })).run(function* (e) {
    for (;;) {
      e.open = 0;
      if (!(yield* hold(D.pick(110, 90, 75, 65)))) break;
      const a = aimAngle(e.x, e.y);
      Effects.warnLine(e.x, e.y, a, 640, 36, 'red');
      Sound.play('warn');
      e.jit = 1.5; e.open = 0.12;
      if (!(yield* hold(36))) break;
      e.jit = 0;
      for (let i = 1; i <= 6; i++) { e.open = i / 6; yield 1; }
      const m = D.pick(5, 8, 10, 12);
      for (let j = 0; j < m; j++) Bullets.shoot(e.x, e.y, a, D.s(2.4 + j * 0.28), 'needle', 'red');
      if (D.lv >= 1) Bullets.ring(e.x, e.y, D.pick(0, 8, 10, 12), a, D.s(1.3), 'small', 'pink');
      Sound.play('bullet');
      if (!(yield* hold(40))) break;
    }
    e.alive = false;
    Effects.spark(e.x, e.y, '#ff6fd0', 8, 2, 20, 1.5);
  });
}
function* b2Last(b) {
  yield* moveTo(b, FW / 2, 90, 40);
  const maxEyes = D.pick(4, 5, 6, 7);
  b.tasks.add((function* () {
    for (;;) {
      if (Enemies.list.filter((e) => e.watcher && e.alive).length < maxEyes) {
        let x, y, tries = 0;
        do {
          x = rand(30, FW - 30); y = rand(40, FH * 0.62); tries++;
        } while (tries < 20 && (dist(x, y, Game.player.x, Game.player.y) < 140 || dist(x, y, b.x, b.y) < 60));
        Effects.twinkle(x, y, 40, 'red');
        yield 40;
        spawnWatcher(b, x, y);
      }
      yield D.pick(150, 120, 100, 85);
    }
  })());
  // 本体：咲いては震え、蛾になって渦を巻く闇の花
  for (let k = 0; ; k++) {
    const turn = (k % 2 ? 1 : -1) * 0.9;
    Bullets.ring(b.x, b.y, D.n(16), k * 0.29, D.s(2), 'shade', 'purple', {
      accel: -0.04, minSpd: 0,
      fn: morphing(56, (s) => {
        s.retype('moth', 'pink');
        s.ang += turn; s.spd = 0; s.accel = 0.03; s.maxSpd = D.s(1.8); s.minSpd = -99;
        s.fn = flutter(0.35, 0.1);
      }),
    });
    yield D.pick(80, 60, 50, 44);
  }
}

// ------------------------------------------------------------
//  ボス定義
// ------------------------------------------------------------
const MIDBOSS2 = {
  name: '悪夢の精霊', art: 'boss2', isMid: true, draw: drawNightmare,
  phases: [
    { hp: 1000, time: 25, fn: mid2Non },
    { hp: 1300, time: 30, spell: true, name: '影踏「うしろに立つ影」', bonus: 1000000, fn: mid2Spell },
  ],
};

const BOSS2 = {
  name: '悪夢の精霊', art: 'boss2', draw: drawNightmare,
  phases: [
    { hp: 2000, time: 30, fn: b2Non1 },
    { hp: 2400, time: 40, spell: true, name: '変貌「まばたきのあいだに」', bonus: 1800000, fn: b2Spell1 },
    { hp: 2100, time: 30, fn: b2Non2 },
    { hp: 2600, time: 45, spell: true, name: '追夢「振り返れない廊下」', bonus: 2000000, fn: b2Spell2 },
    { hp: 2800, time: 50, spell: true, name: '闇夜「灯りに群がる蛾」', bonus: 2400000, fn: b2Spell3 },
    { hp: 3600, time: 60, spell: true, name: '悪夢「目醒めを拒む百の瞳」', bonus: 3200000, fn: b2Last },
  ],
};

// セリフはあとで入れる。空のままなら会話はスキップされる。
const DIALOG2 = {
  midboss: [],
  boss: [],
  after: [],
};

// ------------------------------------------------------------
//  道中
// ------------------------------------------------------------
function* stage2Script() {
  const G = Game;
  yield 40;
  G.showBanner('第二夢　悪夢', '～ 目を閉じても、暗闇は消えない');
  G.showBgm('終わらない夜の廊下（仮）');
  yield 140;
  G.notice = { text: '悪夢をかじれば、闇は晴れる', t: 180, col: '#e0b0ff' };

  // A：灯喰い蛾 ― 不規則な動きに慣れる
  for (let i = 0; i < 8; i++) { spawnMoth(i % 2 ? rand(220, 340) : rand(44, 164)); yield 26; }
  yield 120;

  // B：影法師 ― 「震えたら化ける」を覚える
  yield* shadowWave([[80, 90], [304, 90], [140, 150], [244, 150]], 40);
  yield 50;
  yield* waitUntil(() => Enemies.list.length === 0, 300);
  yield 30;

  // C：追い手 ― 逃げ続けず、振り向いて撃ち落とす
  spawnChaser(FW / 2);
  yield 200;
  for (let i = 0; i < 6; i++) { spawnMoth(rand(40, FW - 40)); yield 30; }
  yield* waitUntil(() => Enemies.list.length === 0, 400);
  yield 40;

  // D：割れ鏡 ― 狙われるのは鏡の中の自分（倒すと獏喰アイテム）
  spawnMirror(FW / 2).drops.bomb = 1;
  yield 150;
  yield* shadowWave([[60, 200], [324, 200]], 60);
  yield 50;
  yield* waitUntil(() => Enemies.list.length === 0, 420);
  yield 60;

  // 中ボス
  yield* bossFight(MIDBOSS2, { dialog: DIALOG2.midboss });
  yield 90;

  // E：鏡の間
  spawnMirror(100); yield 60; spawnMirror(284);
  yield 160;
  spawnChaser(FW / 2);
  yield* waitUntil(() => Enemies.list.length === 0, 600);
  yield 30;

  // F：悪夢の群れ
  for (let i = 0; i < 14; i++) {
    spawnMoth(rand(30, FW - 30));
    if (i % 3 === 1) yield* shadowWave([[rand(50, FW - 50), rand(60, 180)]], 1);
    yield 20;
  }
  spawnMirror(FW / 2);
  yield 60;
  spawnChaser(FW / 2);
  yield* waitUntil(() => Enemies.list.length === 0, 480);
  yield 120;

  // ボス
  yield* bossFight(BOSS2, { dialog: DIALOG2.boss, bgm: '悪夢の精霊　～ Lullaby for the Unwanted（仮）' });
  yield 90;
  yield* G.dialog(DIALOG2.after);
  yield 60;
  G.stageClear();
}

const STAGE2 = {
  no: 2, name: '第二夢', title: '悪夢',
  leftoverRate: 0.07,
  midLife: true, // 中ボスを倒すと残機アイテム
  nextHint: '第三夢「吉夢」へ続く……',
  makeBg: () => new BgStage2(),
  script: stage2Script,
};
