'use strict';
// ============================================================
//  第三夢　吉夢 ― 「目覚めなくていいと、夢は言った」
//
//  ステージ全体のルール：
//   ・金色の「福」（穴あき銭）は当たっても死なない。触れると得点が入り、まどろむ（遅くなる）
//     → 幸せは本物。ただ、受け取りすぎると動けなくなる ＝ 夢から出られなくなる
//   ・弾幕は最初は穏やかで、後半になるほど華やかに、複雑になる
//   ・中ボスの夢魔は「偽物の幸福」。偽物の弾は揺らめき、低速移動（目を凝らす）で透ける
//  吉夢の精霊に敵意はない。「幸せなら、現実に戻る必要なんてないでしょう？」
// ============================================================

// 重力で落ちる（福の銭・投げた実）
function gravity(g, maxVy) {
  return (b) => {
    const vx = Math.cos(b.ang) * b.spd * 0.995;
    const vy = Math.min(maxVy, Math.sin(b.ang) * b.spd + g);
    b.ang = Math.atan2(vy, vx); b.spd = Math.hypot(vx, vy);
  };
}

// 福の銭
function bless(x, y, ang, spd, o) {
  return Bullets.shoot(x, y, ang, spd, 'fuku', 'gold', Object.assign({ bless: true, fn: gravity(0.03, 1.8) }, o));
}
function* blessRain(interval) {
  for (;;) {
    bless(rand(20, FW - 20), -8, Math.PI / 2, 0.6, { fn: gravity(0.015, 1.5) });
    yield interval;
  }
}

// ------------------------------------------------------------
//  背景：初夢の空
//   雲海の向こう、富士の山頂にちょうど朝日が重なる（ダイヤモンド富士）。
//   鶴が渡り、梅の花びらが舞う。夢札中は金の曼荼羅と紅白の光条。
// ------------------------------------------------------------
class BgStage3 {
  constructor() {
    this.t = 0; this.spell = 0; this.sun = 0;
    this.HOR = FH * 0.66;
    this.clouds = Array.from({ length: 16 }, () => this.newCloud({}, rand(0, 1)));
    this.cranes = Array.from({ length: 5 }, () => ({
      x: rand(0, FW), y: rand(30, 150), sp: rand(0.2, 0.45) * (Math.random() < 0.5 ? 1 : -1), ph: rand(0, TAU), s: rand(0.7, 1.2),
    }));
    this.petals = Array.from({ length: 34 }, () => ({
      x: rand(0, FW), y: rand(0, FH), vy: rand(0.4, 0.9), ph: rand(0, TAU), rot: rand(0, TAU), s: rand(1.6, 3),
    }));
    this.motes = Array.from({ length: 30 }, () => ({ x: rand(0, FW), y: rand(0, FH), vy: rand(0.2, 0.6), tw: rand(0, TAU) }));
  }
  // 雲は地平線から手前へ流れてくる（k=0 で地平線）
  newCloud(c, k) {
    c.k = k; c.x = rand(-40, FW + 40); c.r0 = rand(0.7, 1.3);
    return c;
  }

  update(spellOn) {
    this.t++;
    const bd = Game.boss && Game.boss.alive ? Game.boss.pd : {};
    this.spell = lerp(this.spell, spellOn ? 1 : 0, 0.04);
    this.sun = lerp(this.sun, bd.sun ? 1 : 0, 0.02);
    for (const c of this.clouds) {
      c.k += 0.0015 + c.k * 0.004;
      if (c.k > 1.15) this.newCloud(c, 0);
    }
    for (const r of this.cranes) {
      r.x += r.sp;
      if (r.x < -30) r.x = FW + 30; else if (r.x > FW + 30) r.x = -30;
    }
    for (const p of this.petals) {
      p.y += p.vy; p.x += Math.sin(this.t * 0.02 + p.ph) * 0.4; p.rot += 0.02;
      if (p.y > FH + 4) { p.y = -4; p.x = rand(0, FW); }
    }
    for (const m of this.motes) {
      m.y -= m.vy;
      if (m.y < -4) { m.y = FH + 4; m.x = rand(0, FW); }
    }
  }

  draw(c) {
    const g = c.createLinearGradient(0, 0, 0, FH);
    g.addColorStop(0, '#101a48'); g.addColorStop(0.35, '#3a2f70'); g.addColorStop(0.6, '#a2607a'); g.addColorStop(0.8, '#d89a70'); g.addColorStop(1, '#e8b890');
    c.fillStyle = g; c.fillRect(0, 0, FW, FH);

    const px = FW / 2, py = FH * 0.42;
    // 朝日の光条（紅白）
    c.save(); c.translate(px, py); c.rotate(this.t * 0.0015);
    const rayA = 0.05 + 0.08 * Math.max(this.spell, this.sun);
    for (let i = 0; i < 16; i++) {
      const a = (TAU * i) / 16;
      c.fillStyle = i % 2 ? `rgba(255,90,110,${rayA})` : `rgba(255,255,255,${rayA})`;
      c.beginPath(); c.moveTo(0, 0); c.arc(0, 0, 420, a, a + TAU / 32); c.closePath(); c.fill();
    }
    c.restore();
    glow(c, px, py, 170, '#ffb070', 0.35 + 0.2 * this.sun);
    glow(c, px, py, 60, '#fff0c0', 0.8);
    circle(c, px, py, 20, '#fff6dc');

    this.drawFuji(c, px, py);

    // 雲海：地平線は朝焼けに染まり、手前ほど夜の色が残る
    const cg = c.createLinearGradient(0, this.HOR - 6, 0, FH);
    cg.addColorStop(0, '#f0c0c0'); cg.addColorStop(0.35, '#a87aa8'); cg.addColorStop(1, '#3a2a62');
    c.fillStyle = cg; c.fillRect(0, this.HOR - 6, FW, FH - this.HOR + 6);
    for (let x = -20; x <= FW + 20; x += 50) glow(c, x, this.HOR - 4, 46, '#fff0e8', 0.35);
    const cls = this.clouds.slice().sort((a, b) => a.k - b.k);
    for (const cl of cls) { // 平たいやわらかな雲
      const k = cl.k, y = this.HOR + (FH - this.HOR + 60) * k * k;
      const r = (16 + 100 * k) * cl.r0, a = 0.5 * Math.min(1, k * 5);
      c.save(); c.translate(cl.x, y); c.scale(1.9, 0.42);
      glow(c, 0, 0, r, '#ffe8f0', a);
      glow(c, 0, -r * 0.35, r * 0.6, '#ffffff', a * 0.6);
      c.restore();
    }

    // 鶴（頭に赤い丹頂）
    c.lineWidth = 1.2; c.lineCap = 'round';
    for (const r of this.cranes) {
      const flap = Math.sin(this.t * 0.08 + r.ph) * 4 * r.s, w = 9 * r.s, d = Math.sign(r.sp);
      c.strokeStyle = 'rgba(255,250,245,0.55)';
      c.beginPath(); c.moveTo(r.x - w, r.y - flap); c.lineTo(r.x, r.y); c.lineTo(r.x + w, r.y - flap); c.stroke();
      c.beginPath(); c.moveTo(r.x - d * 5 * r.s, r.y + 1); c.lineTo(r.x + d * 7 * r.s, r.y); c.stroke();
      circle(c, r.x + d * 7 * r.s, r.y, 1.2, 'rgba(255,60,80,0.8)');
    }

    // 梅の花びら・金の粒
    c.fillStyle = 'rgba(255,190,215,0.5)';
    for (const p of this.petals) {
      c.save(); c.translate(p.x, p.y); c.rotate(p.rot);
      c.beginPath(); c.ellipse(0, 0, p.s, p.s * 0.6, 0, 0, TAU); c.fill();
      c.restore();
    }
    for (const m of this.motes) {
      c.globalAlpha = 0.3 + 0.4 * (0.5 + 0.5 * Math.sin(this.t * 0.06 + m.tw));
      c.fillStyle = '#ffe6a0'; c.fillRect(m.x, m.y, 1.5, 1.5);
    }
    c.globalAlpha = 1;

    // 弾を見やすくするための薄い夜のヴェール
    c.fillStyle = 'rgba(8,6,28,0.3)'; c.fillRect(0, 0, FW, FH);

    if (this.spell > 0.01) {
      c.globalAlpha = this.spell;
      c.fillStyle = 'rgba(14,6,30,0.35)'; c.fillRect(0, 0, FW, FH);
      this.drawMandala(c, FW / 2, FH * 0.4);
      c.globalAlpha = 1;
    }
  }

  drawFuji(c, px, py) {
    const base = this.HOR + 10;
    const g = c.createLinearGradient(0, py, 0, base);
    g.addColorStop(0, '#3a3270'); g.addColorStop(1, '#1e1a46');
    c.fillStyle = g;
    c.beginPath();
    c.moveTo(-40, base); c.lineTo(px - 26, py + 6); c.lineTo(px - 10, py + 2);
    c.lineTo(px + 10, py + 2); c.lineTo(px + 26, py + 6); c.lineTo(FW + 40, base);
    c.closePath(); c.fill();
    // 冠雪
    c.fillStyle = 'rgba(236,232,255,0.85)';
    c.beginPath();
    c.moveTo(px - 26, py + 6); c.lineTo(px - 10, py + 2); c.lineTo(px + 10, py + 2); c.lineTo(px + 26, py + 6);
    for (const [dx, dy] of [[62, 40], [44, 34], [30, 46], [12, 36], [-4, 48], [-20, 36], [-38, 44], [-60, 38]]) c.lineTo(px + dx, py + dy);
    c.closePath(); c.fill();
  }

  drawMandala(c, x, y) {
    c.save(); c.translate(x, y);
    c.strokeStyle = 'rgba(255,214,140,0.22)'; c.lineWidth = 1;
    c.rotate(this.t * 0.002);
    for (let i = 0; i < 12; i++) { // 十二枚の花弁
      c.save(); c.rotate((TAU * i) / 12);
      c.beginPath(); c.moveTo(0, 0); c.quadraticCurveTo(40, -36, 150, 0); c.quadraticCurveTo(40, 36, 0, 0); c.stroke();
      c.restore();
    }
    c.rotate(-this.t * 0.005);
    c.beginPath(); c.arc(0, 0, 165, 0, TAU); c.stroke();
    c.beginPath(); c.arc(0, 0, 100, 0, TAU); c.stroke();
    starPath(c, 0, 0, 100, 60, 8); c.stroke();
    for (let i = 0; i < 24; i++) {
      const a = (TAU * i) / 24;
      glow(c, Math.cos(a) * 165, Math.sin(a) * 165, 5, i % 2 ? '#ff6a7a' : '#ffffff', 0.5);
    }
    c.restore();
  }
}

// ------------------------------------------------------------
//  雑魚敵の見た目（仮グラフィック）
// ------------------------------------------------------------
function drawHawk(c, e) {
  c.save(); c.translate(e.x, e.y); c.rotate(e.h);
  const flap = Math.sin(e.frame * 0.35) * 0.5;
  glow(c, 0, 0, 20, '#ffc857', 0.35);
  for (const s of [-1, 1]) ellipse(c, -2, s * 7, 9, 3.2, '#b07a3a', s * (0.9 + flap));
  ellipse(c, -9, 0, 4, 2.5, '#6a4a2a');
  ellipse(c, 0, 0, 9, 4, '#8a5a2a');
  circle(c, 7, 0, 3.5, '#fff4e0');
  c.fillStyle = '#ffc857'; c.beginPath(); c.moveTo(10, -1); c.lineTo(13, 0); c.lineTo(10, 1); c.fill();
  c.restore();
}

function drawNasu(c, e) {
  c.save(); c.translate(e.x, e.y); c.rotate(Math.sin(e.frame * 0.08) * 0.3);
  glow(c, 0, 2, 18, '#a35bff', 0.35);
  ellipse(c, 0, 3, 7, 9, '#6a2aa0');
  ellipse(c, -2.5, 1, 2, 4, 'rgba(255,255,255,0.35)');
  c.fillStyle = '#4dcc7a'; starPath(c, 0, -5, 6, 2.5, 5); c.fill();
  circle(c, -2.2, 3, 1, '#fff'); circle(c, 2.2, 3, 1, '#fff');
  c.restore();
}

function drawOugi(c, e) {
  c.save(); c.translate(e.x, e.y - 10);
  const sp = lerp(0.3, 1.25, e.open), R = 24, ribs = 8;
  glow(c, 0, 12, 32, '#ffd970', 0.3);
  for (let i = 0; i < ribs; i++) { // 紅白の扇面
    const a0 = Math.PI / 2 - sp + (2 * sp * i) / ribs;
    c.fillStyle = i % 2 ? '#ff4a5e' : '#fff4f0';
    c.beginPath(); c.moveTo(0, 0); c.arc(0, 0, R, a0, a0 + (2 * sp) / ribs); c.closePath(); c.fill();
  }
  c.strokeStyle = '#ffc857'; c.lineWidth = 1.5;
  c.beginPath(); c.arc(0, 0, R, Math.PI / 2 - sp, Math.PI / 2 + sp); c.stroke();
  circle(c, 0, 0, 3, '#ffc857');
  c.restore();
}

function drawShip(c, e) {
  c.save(); c.translate(e.x, e.y + Math.sin(e.frame * 0.04) * 2);
  glow(c, 0, -4, 50, '#ffd970', 0.3);
  c.strokeStyle = '#7a4a20'; c.lineWidth = 2;
  c.beginPath(); c.moveTo(0, -36); c.lineTo(0, 0); c.stroke();
  c.fillStyle = '#fff4e0';
  c.beginPath(); c.moveTo(-15, -32); c.lineTo(15, -32); c.lineTo(17, -4); c.lineTo(-17, -4); c.closePath(); c.fill();
  c.strokeStyle = '#c08a20'; c.lineWidth = 1; c.stroke();
  c.fillStyle = '#d02040'; c.font = `bold 16px ${FONT_SERIF}`; c.textAlign = 'center'; c.textBaseline = 'middle';
  c.fillText('宝', 0, -18);
  for (let i = -2; i <= 2; i++) circle(c, i * 8, -1, 3.5, '#ffd970'); // 積み荷の宝
  c.fillStyle = '#c0303a';
  c.beginPath(); c.moveTo(-32, 0); c.lineTo(32, 0); c.quadraticCurveTo(28, 14, 18, 16); c.lineTo(-18, 16); c.quadraticCurveTo(-28, 14, -32, 0); c.fill();
  c.strokeStyle = '#ffd970'; c.lineWidth = 1.5;
  c.beginPath(); c.moveTo(-28, 5); c.lineTo(28, 5); c.stroke();
  c.restore();
}

// 夢魔（仮グラフィック）。分身にも使う
function drawMumaAt(c, x, y, t, alpha = 1) {
  if (alpha < 0.01) return;
  c.save(); c.globalAlpha *= alpha; c.translate(x, y + Math.sin(t * 0.06) * 3);
  const img = Art.get('muma');
  if (img) {
    Art.draw(c, img, 0, 0, 64);
  } else {
    const fl = 0.75 + 0.25 * Math.sin(t * 0.12);
    for (const s of [-1, 1]) { // ハート模様の蝶の翅
      c.save(); c.scale(s * fl, 1);
      ellipse(c, 18, -10, 18, 13, 'rgba(255,111,208,0.75)', -0.5);
      ellipse(c, 14, 10, 11, 9, 'rgba(163,91,255,0.75)', 0.6);
      c.fillStyle = 'rgba(255,240,250,0.9)'; heartPath(c, 20, -10, 5); c.fill();
      c.restore();
    }
    glow(c, 0, 0, 32, '#ff6fd0', 0.35);
    // しっぽ（先がハート）
    c.strokeStyle = '#5a1a4a'; c.lineWidth = 2;
    c.beginPath(); c.moveTo(4, 16); c.bezierCurveTo(16, 30, 26, 14, 24, 26); c.stroke();
    c.fillStyle = '#ff6fd0'; heartPath(c, 24, 28, 3.5); c.fill();
    // ドレス
    c.fillStyle = '#5a1a4a';
    c.beginPath(); c.moveTo(0, -8); c.quadraticCurveTo(-16, 8, -14, 22); c.quadraticCurveTo(0, 26, 14, 22); c.quadraticCurveTo(16, 8, 0, -8); c.fill();
    c.strokeStyle = '#ffb0e0'; c.lineWidth = 1; c.stroke();
    // 顔・角・ハートの瞳
    circle(c, 0, -14, 7, '#fde8f4');
    c.strokeStyle = '#2a0a2a'; c.lineWidth = 2;
    c.beginPath(); c.moveTo(-4, -20); c.quadraticCurveTo(-10, -24, -8, -29); c.stroke();
    c.beginPath(); c.moveTo(4, -20); c.quadraticCurveTo(10, -24, 8, -29); c.stroke();
    c.fillStyle = '#ff3b8c'; heartPath(c, -2.6, -14, 1.6); c.fill(); heartPath(c, 2.6, -14, 1.6); c.fill();
  }
  c.restore();
}
function drawMuma(c, b) {
  drawMumaAt(c, b.x, b.y, b.frame, b.pd.vis === undefined ? 1 : b.pd.vis);
}
// 夢札中の分身（偽物は低速移動で透ける）
function drawMumaClones(c, b) {
  if (!b.pd.clones) return;
  const a = b.pd.vis * (Game.player.focused ? 0.3 : 1);
  b.pd.clones.forEach((cl, i) => drawMumaAt(c, cl.x, cl.y, b.frame + i * 17, a));
}

// 吉夢の精霊（仮グラフィック）
function drawKichimu(c, b) {
  const t = b.frame;
  c.save(); c.translate(b.x, b.y + Math.sin(t * 0.04) * 2);
  // 背負った日輪
  c.save(); c.rotate(t * 0.01);
  glow(c, 0, -6, 46, '#ffd970', 0.4);
  c.strokeStyle = 'rgba(255,214,140,0.7)'; c.lineWidth = 1;
  c.beginPath(); c.arc(0, -6, 30, 0, TAU); c.stroke();
  for (let i = 0; i < 16; i++) {
    const a = (TAU * i) / 16, r1 = 32, r2 = i % 2 ? 38 : 44;
    c.strokeStyle = i % 2 ? 'rgba(255,90,110,0.7)' : 'rgba(255,255,255,0.7)';
    c.beginPath(); c.moveTo(Math.cos(a) * r1, -6 + Math.sin(a) * r1); c.lineTo(Math.cos(a) * r2, -6 + Math.sin(a) * r2); c.stroke();
  }
  c.restore();

  const img = Art.get(b.def.art);
  if (img) {
    Art.draw(c, img, 0, 0, 64);
  } else {
    // 羽衣
    c.lineCap = 'round';
    for (const s of [-1, 1]) {
      c.strokeStyle = 'rgba(255,208,224,0.75)'; c.lineWidth = 3;
      c.beginPath(); c.moveTo(s * 8, -4);
      for (let i = 1; i <= 6; i++) c.lineTo(s * (8 + i * 5), -4 + i * 5 + Math.sin(t * 0.08 + i * 0.9) * 4);
      c.stroke();
    }
    // 衣（白と金、紅の帯）
    c.fillStyle = '#fff8f0';
    c.beginPath(); c.moveTo(0, -8); c.quadraticCurveTo(-18, 8, -15, 24); c.lineTo(15, 24); c.quadraticCurveTo(18, 8, 0, -8); c.fill();
    c.strokeStyle = '#ffc857'; c.lineWidth = 1; c.stroke();
    c.fillStyle = '#e03048'; c.fillRect(-9, 4, 18, 4);
    // 顔・髪・梅の髪飾り
    circle(c, 0, -14, 7, '#fff0e6');
    c.fillStyle = '#2a1a3a'; c.beginPath(); c.arc(0, -15, 8, Math.PI, TAU); c.fill();
    c.fillStyle = '#ff9ab0'; starPath(c, 6, -20, 4, 2.4, 5); c.fill();
    circle(c, 6, -20, 1.2, '#ffd970');
    // 閉じた笑い目
    c.strokeStyle = '#2a1a3a'; c.lineWidth = 1;
    for (const s of [-1, 1]) { c.beginPath(); c.arc(s * 2.6, -13, 1.4, Math.PI * 1.1, Math.PI * 1.9); c.stroke(); }
  }
  c.restore();
}

// ------------------------------------------------------------
//  雑魚敵
// ------------------------------------------------------------

// 成す実（なすび）：初夢の「三茄子」。願いが「成る」夢から生まれた小さな実。
// 倒すと福の銭がこぼれる → 福を拾うと遅くなる、を最初に体験させる敵。
function spawnNasu(x) {
  return Enemies.add(new Enemy(x, -16, {
    hp: 6, r: 10, score: 800, draw: drawNasu, drops: { power: 1 },
    onDeath: (e) => { for (let i = 0; i < D.pick(3, 3, 4, 4); i++) bless(e.x, e.y, -Math.PI / 2 + rand(-0.9, 0.9), rand(1.2, 2.2)); },
  })).run(function* (e) {
    const ph = rand(0, TAU);
    for (let f = 0; ; f++) {
      e.vy = 0.9; e.vx = Math.sin(f * 0.05 + ph) * 0.8;
      if (f % D.pick(90, 70, 55, 45) === 40) Bullets.fan(e.x, e.y, D.pick(1, 1, 3, 3), aimAngle(e.x, e.y), 0.3, D.s(2.2), 'orb', 'purple');
      yield 1;
    }
  });
}

// 夢鷹：初夢の「二鷹」。高く飛ぶ夢、出世の夢から生まれた。
// 横から現れ、狙いを定めて（予告線）急降下し、舞い上がって去る。
function spawnHawk(fromLeft, y) {
  const dir = fromLeft ? 1 : -1;
  return Enemies.add(new Enemy(fromLeft ? -20 : FW + 20, y, {
    hp: 10, r: 11, score: 1200, draw: drawHawk, h: fromLeft ? 0 : Math.PI,
    drops: Math.random() < 0.5 ? { power: 1 } : { point: 1 },
  })).run(function* (e) {
    const sp = D.pick(2.6, 3, 3.3, 3.6);
    e.vx = dir * sp;
    yield 40;
    e.vx = dir * 0.5;
    const a = aimAngle(e.x, e.y);
    e.h = a;
    Effects.warnLine(e.x, e.y, a, 220, 24, 'gold');
    yield 24;
    e.vx = Math.cos(a) * sp * 1.6; e.vy = Math.sin(a) * sp * 1.6;
    Bullets.fan(e.x, e.y, D.pick(1, 3, 3, 5), a, 0.25, D.s(3.6), 'needle', 'orange');
    yield 28;
    for (;;) { // 舞い上がる
      e.vy -= 0.14; e.vx *= 0.99;
      e.h = Math.atan2(e.vy, e.vx);
      yield 1;
    }
  });
}

// 末広扇：初夢の「四扇」。末広がり ＝ 先へ行くほど広がる幸運。
// 撃つたびに扇が開き、弾の広がりも増える → 後になるほど避ける幅が要る。
function spawnOugi(x, y) {
  return Enemies.add(new Enemy(x, -24, {
    hp: 40, r: 14, score: 3000, draw: drawOugi, open: 0, drops: { power: 2, point: 2 },
  })).run(function* (e) {
    yield* moveTo(e, x, y, 50);
    for (let k = 0; k < 5; k++) {
      for (let i = 0; i < 12; i++) { e.open = lerp(k / 5, (k + 1) / 5, i / 12); yield 1; }
      const n = D.pick(3, 5, 5, 7) + k * D.pick(0, 1, 1, 2);
      Bullets.fan(e.x, e.y, n, aimAngle(e.x, e.y), 0.3 + k * 0.2, D.s(2.4), 'petal', k % 2 ? 'red' : 'white');
      if (D.lv >= 2) Bullets.fan(e.x, e.y, n, aimAngle(e.x, e.y), 0.3 + k * 0.2, D.s(1.8), 'petal', k % 2 ? 'white' : 'red');
      yield 40;
    }
    e.vy = -1;
  });
}

// 宝船：枕の下に敷くと良い夢を見られるという、宝船の絵から生まれた。
// 銭（福）をばらまきながら、その間に本物の宝石弾を撃つ → 欲張るほど危ない。
function spawnShip(fromLeft) {
  const dir = fromLeft ? 1 : -1;
  return Enemies.add(new Enemy(fromLeft ? -40 : FW + 40, 76, {
    hp: 220, r: 24, score: 12000, draw: drawShip, drops: { power: 4, point: 8 },
    onDeath: (e) => { for (let i = 0; i < 10; i++) bless(e.x, e.y, -Math.PI / 2 + rand(-1.4, 1.4), rand(1, 3)); },
  })).run(function* (e) {
    e.vx = dir * 0.45;
    for (let f = 0; ; f++) {
      if (f % 14 === 0) bless(e.x + rand(-20, 20), e.y + 10, Math.PI / 2 + rand(-0.6, 0.6), rand(0.6, 1.4));
      if (f % D.pick(60, 45, 36, 30) === 20) {
        const cols = ['red', 'cyan', 'green', 'blue'];
        Bullets.fan(e.x, e.y + 8, D.pick(3, 5, 7, 9), aimAngle(e.x, e.y), D.pick(0.6, 0.8, 1, 1.2), D.s(2.6), 'gem', cols[(f / 30 | 0) % 4]);
      }
      yield 1;
    }
  });
}

// ------------------------------------------------------------
//  中ボス：夢魔 ― 人を夢に引き留める誘惑者。偽物の幸福を見せる
// ------------------------------------------------------------

// ハート形に広がる輪
function heartRing(x, y, n, rot, spd, col, o) {
  const cs = Math.cos(rot), sn = Math.sin(rot);
  for (let i = 0; i < n; i++) {
    const t = (TAU * i) / n;
    const hx = 16 * Math.pow(Math.sin(t), 3);
    const hy = -(13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t));
    const vx = hx * cs - hy * sn, vy = hx * sn + hy * cs;
    Bullets.shoot(x, y, Math.atan2(vy, vx), (Math.hypot(vx, vy) * spd) / 16, 'heart', col, o);
  }
  Sound.play('bullet');
}

// --- 通常：魅了のハート ---
// 本物と偽物のハートが重なって広がる。偽物は揺らめき、低速で透ける。
function* mid3Non(b) {
  for (let k = 0; ; k++) {
    heartRing(b.x, b.y, D.n(28), rand(-0.3, 0.3), D.s(2), 'pink');
    yield 20;
    heartRing(b.x, b.y, D.n(28), rand(-0.3, 0.3), D.s(1.6), 'pink', { fake: true });
    yield 30;
    Bullets.fan(b.x, b.y, D.pick(3, 5, 5, 7), aimAngle(b.x, b.y), 0.5, D.s(2.6), 'heart', 'red');
    yield 40;
    if (k % 2) yield* wander(b, 50);
  }
}

// --- 夢札：幻惑「どれが本当のわたし？」---
// 夢魔が分身し、ときどき消えて入れ替わる。偽物の夢魔が撃つ弾はすべて偽物。
// 低速で目を凝らすと、偽物の夢魔も偽物の弾も透ける。
function* mid3Spell(b) {
  yield* moveTo(b, FW / 2, 90, 30);
  b.pd.hideMarker = true;
  b.pd.vis = 1;
  const n = D.pick(3, 3, 4, 4);
  const slots = Array.from({ length: n }, (_, i) => ({ x: lerp(70, FW - 70, i / (n - 1)), y: 80 + (i % 2) * 34 }));
  for (;;) {
    for (let f = 1; f <= 20; f++) { b.pd.vis = 1 - f / 20; yield 1; }
    const real = randInt(0, n - 1);
    b.x = slots[real].x; b.y = slots[real].y;
    b.pd.clones = slots.filter((_, i) => i !== real).map((s) => ({ x: s.x, y: s.y }));
    for (let f = 1; f <= 20; f++) { b.pd.vis = f / 20; yield 1; }
    for (let k = 0; k < 3; k++) {
      const srcs = [{ x: b.x, y: b.y, fake: false }, ...b.pd.clones.map((cl) => ({ x: cl.x, y: cl.y, fake: true }))];
      const rot = rand(0, TAU);
      for (const s of srcs) {
        Bullets.ring(s.x, s.y, D.n(12), rot, D.s(1.6), 'heart', 'pink', { fake: s.fake });
        Bullets.fan(s.x, s.y, D.pick(1, 3, 3, 3), aimAngle(s.x, s.y), 0.3, D.s(2.6), 'heart', 'red', { fake: s.fake });
      }
      yield D.pick(60, 50, 44, 40);
    }
  }
}

// ------------------------------------------------------------
//  ボス弾幕：吉夢の精霊
// ------------------------------------------------------------

// --- 通常1：紅白の花輪 ---
// 五弁の花の形に開く紅白の花びら。空からは福の銭が降る。最初は穏やか。
function* b3Non1(b) {
  b.tasks.add(blessRain(50));
  for (let k = 0; ; k++) {
    for (let w = 0; w < 3; w++) {
      const n = D.n(30), a0 = k * 0.2 + w * 0.05;
      for (let i = 0; i < n; i++) {
        const a = a0 + (TAU * i) / n;
        const sp = D.s(1.5 + w * 0.25) * (1 + 0.3 * Math.abs(Math.cos(2.5 * (a - a0))));
        Bullets.shoot(b.x, b.y, a, sp, 'petal', (i + w) % 2 ? 'red' : 'white');
      }
      yield 8;
    }
    Sound.play('bullet');
    yield 50;
    Bullets.fan(b.x, b.y, D.pick(3, 5, 5, 7), aimAngle(b.x, b.y), 0.4, D.s(2.8), 'gem', 'cyan');
    yield 30;
    if (k % 2) yield* wander(b, 50);
  }
}

// --- 夢札1：吉兆「一富士二鷹三茄子」---
// 一富士：山の形の弾が降りてくる。斜面には雪線のすきまがある。
// 二鷹　：左右の空から、二羽の鷹が予告線どおりに急降下。
// 三茄子：放り投げた三つの実が弾け、まわりに福の種をまく。
// → 初夢の縁起の順番どおりに来る。順番を覚えれば次が読める。
function* b3Spell1(b) {
  yield* moveTo(b, FW / 2, 80, 40);
  for (;;) {
    // 一富士
    const px = rand(FW * 0.3, FW * 0.7);
    Effects.twinkle(px, 14, 40, 'white');
    Sound.play('warn');
    yield 40;
    const step = D.pick(16, 13, 11, 10);
    for (const side of [-1, 1]) {
      const gap = rand(70, 220);
      for (let d = 0; d < 460; d += step) {
        if (Math.abs(d - gap) < 24) continue;
        Bullets.shoot(px + side * d * 0.8, 10 + d * 0.6, Math.PI / 2, D.s(1.1), 'orb', d < 70 ? 'white' : 'blue', { delay: 16 });
      }
    }
    Sound.play('bullet');
    yield 80;
    // 二鷹
    for (let k = 0; k < 2; k++) {
      const sx = k ? FW - 30 : 30, sy = 16;
      const a = aimAngle(sx, sy);
      Effects.warnLine(sx, sy, a, 640, 30, 'orange');
      Sound.play('warn');
      yield 30;
      for (let j = 0; j < D.pick(8, 12, 14, 16); j++) Bullets.shoot(sx, sy, a + rand(-0.02, 0.02), D.s(3 + j * 0.3), 'needle', 'orange');
      Effects.spark(sx, sy, '#ffc857', 8, 3, 20, 2);
      Sound.play('bullet');
      yield 20;
    }
    yield 30;
    // 三茄子
    for (let k = 0; k < 3; k++) {
      const vx = (k - 1) * 1.6 + rand(-0.3, 0.3), vy = -1;
      const grav = gravity(0.05, 3);
      Bullets.shoot(b.x, b.y, Math.atan2(vy, vx), Math.hypot(vx, vy), 'big', 'purple', {
        fn: (s) => {
          grav(s);
          if (s.frame > 70) s.jit = 1.2;
          if (s.frame === 90) {
            s.alive = false;
            Bullets.ring(s.x, s.y, D.n(14), rand(0, TAU), D.s(1.5), 'orb', 'purple');
            for (let i = 0; i < 2; i++) bless(s.x, s.y, -Math.PI / 2 + rand(-1, 1), rand(1, 2));
            Effects.ring(s.x, s.y, '#c08aff', 40, 20);
            Sound.play('bullet');
          }
        },
      });
    }
    yield 120;
  }
}

// --- 通常2：宝石の万華鏡 ---
// 六方向の鏡に映された宝石の流れ。色は少しずつ移り変わる。
function* b3Non2(b) {
  yield* moveTo(b, FW / 2, 110, 30);
  const cols = ['red', 'gold', 'cyan', 'green', 'pink', 'blue'];
  for (let f = 0; ; f++) {
    if (f % D.pick(8, 5, 4, 4) === 0) {
      const th = Math.sin(f * 0.013) * 0.5;
      const col = cols[Math.floor(f / 40) % cols.length];
      for (let i = 0; i < 6; i++) {
        const base = (TAU * i) / 6 + f * 0.004;
        for (const s of [1, -1]) Bullets.shoot(b.x, b.y, base + s * th, D.s(1.9), 'gem', col);
      }
      if (f % 24 === 0) Sound.play('bullet');
    }
    if (f % 120 === 60) Bullets.fan(b.x, b.y, D.pick(3, 5, 5, 7), aimAngle(b.x, b.y), 0.4, D.s(2.8), 'orb', 'white');
    yield 1;
  }
}

// --- 夢札2：福音「末広がりの紅白扇」---
// 巨大な扇がゆっくり開いては閉じる。骨は紅白の弾、骨と骨のすきまには福の銭。
// すきまは安全。でも福を拾いすぎると、扇が閉じるときに抜け出せない。
function* b3Spell2(b) {
  yield* moveTo(b, FW / 2, 70, 40);
  const ribs = D.pick(7, 9, 11, 13), period = D.pick(260, 240, 220, 200);
  const space = 2.6 / (ribs - 1);
  for (let f = 0; ; f++) {
    const open = 0.15 + 0.85 * (0.5 - 0.5 * Math.cos((f * TAU) / period));
    const rot = Math.sin((f * TAU) / (period * 2)) * 0.25;
    const ribAng = (i) => Math.PI / 2 + rot + (i - (ribs - 1) / 2) * space * open;
    if (f % 5 === 0) {
      for (let i = 0; i < ribs; i++) Bullets.shoot(b.x, b.y, ribAng(i), D.s(2.6), 'rice', i % 2 ? 'red' : 'white');
      if (f % 20 === 0) Sound.play('bullet');
    }
    if (f % 45 === 0) for (let i = 0; i < ribs - 1; i++) bless(b.x, b.y, ribAng(i + 0.5), D.s(2.6), { fn: null });
    yield 1;
  }
}

// --- 夢札3：至福「願いの咲く花園」---
// あちこちにつぼみが現れ、震えてから花開く。花の芯は福になって落ちてくる。
// 画面が花で埋まるほど美しく、福も増える。拾うか、避けるか。
function* b3Spell3(b) {
  yield* moveTo(b, FW / 2, 80, 40);
  b.tasks.add(blessRain(D.pick(30, 26, 22, 20)));
  for (;;) {
    let x, y, tries = 0;
    do { x = rand(30, FW - 30); y = rand(40, FH * 0.6); tries++; } while (tries < 20 && dist(x, y, Game.player.x, Game.player.y) < 110);
    const col = pick(['pink', 'red', 'purple']), ph = rand(0, TAU);
    Bullets.shoot(x, y, 0, 0, 'big', 'pink', {
      delay: 20,
      fn: (s) => {
        if (s.frame > 34 && s.frame < 50) s.jit = 0.8;
        if (s.frame !== 50) return;
        s.jit = 0;
        const n = D.pick(5, 6, 7, 8);
        for (let layer = 0; layer < 2; layer++) {
          for (let i = 0; i < n; i++) {
            const a = ph + (TAU * i) / n + (layer * Math.PI) / n;
            Bullets.shoot(s.x, s.y, a, D.s(layer ? 0.8 : 1.2), 'petal', layer ? 'white' : col, { accel: 0.004, maxSpd: D.s(1.8) });
          }
        }
        s.retype('fuku', 'gold'); s.bless = true; s.fn = gravity(0.02, 1.5);
        Effects.ring(s.x, s.y, '#ffd0e0', 30, 20);
        Sound.play('bullet');
      },
    });
    yield D.pick(34, 26, 20, 16);
  }
}

// --- 最終夢札：吉夢「目覚めなくていい朝」---
// 紅白の光が二重の渦を描く。削るほど光の筋が増え、朝がまぶしくなる。
// 福の銭は自機を追いかけてくる ＝ 幸福が引き留めにくる。
// → 最後は「幸せを断って」でも動き続けないと、目覚められない。
function* b3Last(b) {
  yield* moveTo(b, FW / 2, 100, 40);
  b.pd.sun = true;
  b.tasks.add((function* () {
    for (let k = 0; ; k++) {
      const n = D.pick(6, 8, 8, 10);
      for (let i = 0; i < n; i++) {
        bless(b.x, b.y, (TAU * i) / n + k * 0.3, 1.6, {
          fn: (s) => {
            if (s.frame < 30 || s.frame > 200) return;
            let d = aimAngle(s.x, s.y) - s.ang;
            d = Math.atan2(Math.sin(d), Math.cos(d));
            s.ang += d * 0.03;
          },
        });
      }
      Sound.play('bless');
      yield D.pick(110, 90, 80, 70);
    }
  })());
  let rot = 0;
  for (let f = 0; ; f++) {
    const grow = 1 - b.hp / b.maxHp;
    const rays = D.pick(5, 6, 7, 8) + Math.floor(grow * D.pick(2, 3, 4, 5));
    rot += 0.011;
    if (f % D.pick(10, 8, 7, 6) === 0) {
      for (let i = 0; i < rays; i++) {
        for (const s of [1, -1]) Bullets.shoot(b.x, b.y, s * rot + (TAU * i) / rays, D.s(2.1), 'rice', s > 0 ? 'red' : 'white');
      }
      if (f % 30 === 0) Sound.play('bullet');
    }
    if (grow > 0.4 && f % 150 === 75) Bullets.fan(b.x, b.y, D.pick(3, 5, 5, 7), aimAngle(b.x, b.y), 0.5, D.s(2.4), 'bigstar', 'orange');
    yield 1;
  }
}

// ------------------------------------------------------------
//  ボス定義
// ------------------------------------------------------------
const MIDBOSS3 = {
  name: '夢魔', art: 'muma', isMid: true, draw: drawMuma,
  phases: [
    { hp: 1100, time: 25, fn: mid3Non },
    { hp: 1400, time: 35, spell: true, name: '幻惑「どれが本当のわたし？」', bonus: 1200000, fn: mid3Spell, draw: drawMumaClones },
  ],
};

const BOSS3 = {
  name: '吉夢の精霊', art: 'boss3', draw: drawKichimu,
  phases: [
    { hp: 2100, time: 30, fn: b3Non1 },
    { hp: 2500, time: 45, spell: true, name: '吉兆「一富士二鷹三茄子」', bonus: 2000000, fn: b3Spell1 },
    { hp: 2200, time: 30, fn: b3Non2 },
    { hp: 2700, time: 45, spell: true, name: '福音「末広がりの紅白扇」', bonus: 2200000, fn: b3Spell2 },
    { hp: 2900, time: 50, spell: true, name: '至福「願いの咲く花園」', bonus: 2600000, fn: b3Spell3 },
    { hp: 3800, time: 60, spell: true, name: '吉夢「目覚めなくていい朝」', bonus: 3400000, fn: b3Last },
  ],
};

// セリフはあとで入れる。空のままなら会話はスキップされる。
const DIALOG3 = {
  midboss: [],
  boss: [],
  after: [],
};

// ------------------------------------------------------------
//  道中
// ------------------------------------------------------------
function* stage3Script() {
  const G = Game;
  yield 40;
  G.showBanner('第三夢　吉夢', '～ 目覚めなくていいと、夢は言った');
  G.showBgm('初夢の雲海（仮）');
  yield 140;
  G.notice = { text: '金の福は、取るとまどろむ', t: 180, col: '#ffe68a' };

  // A：成す実 ― 福を拾うと遅くなる、を体験する
  for (let i = 0; i < 8; i++) { spawnNasu(60 + i * 38); yield 20; }
  yield 160;

  // B：夢鷹 ― 左右から急降下
  for (let i = 0; i < 4; i++) { spawnHawk(true, 60 + i * 24); yield 30; }
  yield 40;
  for (let i = 0; i < 4; i++) { spawnHawk(false, 60 + i * 24); yield 30; }
  yield 100;

  // C：末広扇 + 成す実
  spawnOugi(100, 100); yield 40; spawnOugi(284, 100);
  yield 80;
  for (let i = 0; i < 6; i++) { spawnNasu(rand(40, FW - 40)); yield 30; }
  yield* waitUntil(() => Enemies.list.length === 0, 400);
  yield 40;

  // D：宝船
  spawnShip(true);
  yield 200;
  for (let i = 0; i < 4; i++) { spawnHawk(i % 2 === 0, 150 + i * 12); yield 40; }
  yield* waitUntil(() => Enemies.list.length === 0, 700);
  yield 60;

  // 中ボス：夢魔
  yield* bossFight(MIDBOSS3, { dialog: DIALOG3.midboss });
  yield 90;

  // E：扇の並木と鷹の群れ
  spawnOugi(70, 90); spawnOugi(314, 90); yield 60; spawnOugi(FW / 2, 130);
  yield 140;
  for (let i = 0; i < 8; i++) { spawnHawk(i % 2 === 0, 50 + (i % 4) * 20); yield 22; }
  yield* waitUntil(() => Enemies.list.length === 0, 500);
  yield 30;

  // F：宝船と、実りの雨
  spawnShip(false);
  yield 120;
  for (let i = 0; i < 12; i++) {
    spawnNasu(rand(30, FW - 30));
    if (i % 4 === 2) spawnHawk(i % 8 === 2, rand(160, 200));
    yield 28;
  }
  yield* waitUntil(() => Enemies.list.length === 0, 600);
  yield 120;

  // ボス
  yield* bossFight(BOSS3, { dialog: DIALOG3.boss, bgm: '吉夢の精霊　～ Happily Ever After（仮）' });
  yield 90;
  yield* G.dialog(DIALOG3.after);
  yield 60;
  G.stageClear();
}

const STAGE3 = {
  no: 3, name: '第三夢', title: '吉夢',
  leftoverRate: 0.09,
  drowse: true, // 情報欄に「まどろみ」を表示
  nextHint: '第四夢「逆夢」へ続く……',
  makeBg: () => new BgStage3(),
  script: stage3Script,
};
