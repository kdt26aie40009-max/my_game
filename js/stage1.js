'use strict';
// ============================================================
//  第一夢　予知夢 ― 「星は、まだ見ぬ朝を知っている」
//
//  ステージ全体のルール：
//   ・敵は出てくる前に「きらめき」で予告される
//   ・弾は「自機が今いる場所」ではなく「これから行く場所」を狙う
//   ・予告線は時間が近づくほど明るくなる
//  → 未来は見えている。だから「見えた未来にいない」ことが攻略になる。
// ============================================================

// ------------------------------------------------------------
//  背景：夜明け前の星空と、ゆっくり回る天球儀
// ------------------------------------------------------------
class BgStage1 {
  constructor() {
    this.t = 0; this.spell = 0;
    this.layers = [0.3, 0.7, 1.4].map((sp, li) => ({
      sp,
      stars: Array.from({ length: [70, 40, 18][li] }, () => ({
        x: rand(0, FW), y: rand(0, FH), s: rand(0.6, 1.2) + li * 0.5, tw: rand(0, TAU),
      })),
    }));
    this.shooting = [];
    this.mapStars = Array.from({ length: 14 }, (_, i) => {
      const a = (TAU * i) / 14 + rand(-0.2, 0.2), r = rand(60, 170);
      return { a, r };
    });
  }

  update(spellOn) {
    this.t++;
    this.spell = lerp(this.spell, spellOn ? 1 : 0, 0.04);
    for (const L of this.layers) for (const s of L.stars) {
      s.y += L.sp;
      if (s.y > FH + 2) { s.y = -2; s.x = rand(0, FW); }
    }
    if (Math.random() < 0.012) this.shooting.push({ x: rand(40, FW + 60), y: rand(-20, FH * 0.4), life: 36 });
    for (const s of this.shooting) { s.x -= 6; s.y += 3.5; s.life--; }
    this.shooting = this.shooting.filter((s) => s.life > 0);
  }

  draw(c) {
    const g = c.createLinearGradient(0, 0, 0, FH);
    g.addColorStop(0, '#070a24'); g.addColorStop(0.6, '#121a48'); g.addColorStop(1, '#2c2a60');
    c.fillStyle = g; c.fillRect(0, 0, FW, FH);
    glow(c, FW / 2, FH + 60, 300, '#ff9fb0', 0.13); // 地平線の向こうの朝の気配

    this.drawAstrolabe(c, FW / 2, FH * 0.42 + Math.sin(this.t * 0.003) * 10, 150);

    for (const L of this.layers) {
      c.fillStyle = '#dfe6ff';
      for (const s of L.stars) {
        c.globalAlpha = 0.35 + 0.55 * (0.5 + 0.5 * Math.sin(this.t * 0.05 + s.tw));
        c.fillRect(s.x, s.y, s.s, s.s);
      }
    }
    c.globalAlpha = 1;

    c.lineCap = 'round';
    for (const s of this.shooting) {
      const gr = c.createLinearGradient(s.x, s.y, s.x + 36, s.y - 21);
      gr.addColorStop(0, `rgba(255,240,210,${s.life / 36})`); gr.addColorStop(1, 'rgba(255,240,210,0)');
      c.strokeStyle = gr; c.lineWidth = 1.5;
      c.beginPath(); c.moveTo(s.x, s.y); c.lineTo(s.x + 36, s.y - 21); c.stroke();
    }

    // 雲海
    for (let i = 0; i < 5; i++) {
      const x = ((i * 120 + this.t * 0.35) % (FW + 240)) - 120;
      glow(c, x, FH - 10 + Math.sin(i * 2 + this.t * 0.01) * 8, 110, '#8b98d8', 0.11);
    }

    // 夢札中：星図の結界
    if (this.spell > 0.01) {
      c.globalAlpha = this.spell;
      c.fillStyle = 'rgba(4,6,22,0.55)'; c.fillRect(0, 0, FW, FH);
      this.drawStarMap(c);
      c.globalAlpha = 1;
    }
  }

  drawAstrolabe(c, x, y, R) {
    c.save();
    c.translate(x, y);
    c.strokeStyle = 'rgba(170,190,255,0.10)'; c.lineWidth = 1;
    for (const r of [R, R * 0.82, R * 0.5]) { c.beginPath(); c.arc(0, 0, r, 0, TAU); c.stroke(); }
    c.rotate(this.t * 0.0015);
    for (let i = 0; i < 72; i++) {
      const a = (TAU * i) / 72, l = i % 6 === 0 ? 12 : 5;
      c.beginPath(); c.moveTo(Math.cos(a) * R, Math.sin(a) * R);
      c.lineTo(Math.cos(a) * (R - l), Math.sin(a) * (R - l)); c.stroke();
    }
    c.rotate(-this.t * 0.004);
    c.beginPath(); c.ellipse(0, 0, R * 0.9, R * 0.35, 0, 0, TAU); c.stroke();
    c.beginPath(); c.ellipse(0, 0, R * 0.9, R * 0.35, 1.1, 0, TAU); c.stroke();
    const pa = this.t * 0.01;
    glow(c, Math.cos(pa) * R * 0.9, Math.sin(pa) * R * 0.35, 8, '#ffe6a0', 0.5);
    c.restore();
  }

  drawStarMap(c) {
    c.save();
    c.translate(FW / 2, FH * 0.4);
    c.rotate(this.t * 0.002);
    c.strokeStyle = 'rgba(255,214,140,0.18)'; c.lineWidth = 1;
    c.beginPath(); c.arc(0, 0, 175, 0, TAU); c.stroke();
    c.beginPath(); c.arc(0, 0, 160, 0, TAU); c.stroke();
    starPath(c, 0, 0, 160, 62, 6); c.stroke();
    c.beginPath();
    this.mapStars.forEach((s, i) => {
      const x = Math.cos(s.a) * s.r, y = Math.sin(s.a) * s.r;
      if (i) c.lineTo(x, y); else c.moveTo(x, y);
    });
    c.stroke();
    for (const s of this.mapStars) glow(c, Math.cos(s.a) * s.r, Math.sin(s.a) * s.r, 6, '#ffe6a0', 0.6);
    c.restore();
  }
}

// ------------------------------------------------------------
//  雑魚敵の見た目（仮グラフィック）
// ------------------------------------------------------------
function drawSakiboshi(c, e) {
  c.save(); c.translate(e.x, e.y);
  glow(c, 0, 0, 16, '#ffc857', 0.45);
  c.rotate(e.frame * 0.06);
  c.fillStyle = '#ffd36b'; starPath(c, 0, 0, 10, 4.5); c.fill();
  c.fillStyle = '#ffffff'; starPath(c, 0, 0, 5, 2.2); c.fill();
  c.restore();
}

function drawClock(c, e) {
  c.save(); c.translate(e.x, e.y);
  glow(c, 0, 0, 28, '#bcd0ff', 0.35);
  circle(c, 0, 0, 15, 'rgba(20,24,60,0.9)');
  c.strokeStyle = '#d8e2ff'; c.lineWidth = 1.5;
  c.beginPath(); c.arc(0, 0, 15, 0, TAU); c.stroke();
  c.lineWidth = 1;
  for (let i = 0; i < 12; i++) {
    const a = (TAU * i) / 12;
    c.beginPath(); c.moveTo(Math.cos(a) * 11, Math.sin(a) * 11); c.lineTo(Math.cos(a) * 14, Math.sin(a) * 14); c.stroke();
  }
  c.rotate(e.hand);
  c.strokeStyle = '#ff7a8a'; c.lineWidth = 2;
  c.beginPath(); c.moveTo(-3, 0); c.lineTo(13, 0); c.stroke();
  circle(c, 0, 0, 2, '#ffffff');
  c.restore();
}

function drawBird(c, e) {
  c.save(); c.translate(e.x, e.y);
  if (e.dir < 0) c.scale(-1, 1);
  const flap = Math.sin(e.frame * 0.3) * 0.6;
  glow(c, 0, 0, 22, '#a35bff', 0.3);
  ellipse(c, -3, -5, 10, 3.5, '#cfe6ff', -0.5 - flap);
  ellipse(c, -3, 5, 10, 3.5, '#cfe6ff', 0.5 + flap);
  ellipse(c, 0, 0, 8, 6, '#eef6ff');
  circle(c, 4, -2, 1.2, '#2a2050');
  glow(c, 11, 3, 9, '#c8a0ff', 0.6);
  circle(c, 11, 3, 4, '#d7b8ff');
  circle(c, 10, 2, 1.4, '#ffffff');
  c.restore();
}

function drawSeizu(c, e) {
  c.save(); c.translate(e.x, e.y);
  c.rotate(e.frame * 0.01);
  glow(c, 0, 0, 30, '#9fb6ff', 0.2);
  c.strokeStyle = 'rgba(200,215,255,0.7)'; c.lineWidth = 1;
  c.beginPath();
  e.pts.forEach((p, i) => (i ? c.lineTo(p.x, p.y) : c.moveTo(p.x, p.y)));
  c.closePath(); c.stroke();
  for (const p of e.pts) {
    glow(c, p.x, p.y, 7, '#e6ecff', 0.8);
    circle(c, p.x, p.y, 2, '#ffffff');
  }
  c.restore();
}

// 予知夢の精霊（仮グラフィック）
function drawSeer(c, b) {
  const t = b.frame;
  const y = b.y + Math.sin(t * 0.05) * 2;
  c.save(); c.translate(b.x, y);
  // 足元の魔法陣
  c.save();
  c.rotate(t * 0.012);
  c.globalAlpha = 0.55; c.strokeStyle = '#9fb6ff'; c.lineWidth = 1;
  c.beginPath(); c.arc(0, 0, 40, 0, TAU); c.stroke();
  c.beginPath(); c.arc(0, 0, 34, 0, TAU); c.stroke();
  starPath(c, 0, 0, 34, 17, 6); c.stroke();
  for (let i = 0; i < 24; i++) {
    const a = (TAU * i) / 24;
    c.beginPath(); c.moveTo(Math.cos(a) * 36, Math.sin(a) * 36); c.lineTo(Math.cos(a) * 39, Math.sin(a) * 39); c.stroke();
  }
  c.rotate(-t * 0.03);
  c.setLineDash([4, 6]); c.beginPath(); c.arc(0, 0, 48, 0, TAU); c.stroke(); c.setLineDash([]);
  c.restore();

  const img = Art.get(b.def.art);
  if (img) {
    Art.draw(c, img, 0, 0, 64);
  } else {
    glow(c, 0, 0, 36, '#ffe6a0', 0.35);
    // ローブ
    c.fillStyle = '#2a3570';
    c.beginPath(); c.moveTo(0, -8); c.quadraticCurveTo(-18, 10, -14, 24); c.lineTo(14, 24); c.quadraticCurveTo(18, 10, 0, -8); c.fill();
    c.strokeStyle = '#ffd27a'; c.lineWidth = 1; c.stroke();
    circle(c, 0, -14, 7, '#f4e9ff'); // 顔
    c.strokeStyle = '#ffd27a'; c.beginPath(); c.arc(0, -16, 11, Math.PI * 1.1, Math.PI * 1.9); c.stroke(); // 光輪
    for (let i = 0; i < 5; i++) { // 周りを回る星
      const a = t * 0.04 + (TAU * i) / 5;
      c.fillStyle = '#ffe6a0'; starPath(c, Math.cos(a) * 22, -6 + Math.sin(a) * 8, 3.5, 1.5); c.fill();
    }
  }
  c.restore();
}

// ------------------------------------------------------------
//  雑魚敵
// ------------------------------------------------------------

// さきぼし：「明日いいことが起きる」という淡い予感から生まれた星の妖精。
// 出てくる前に必ず「きらめき」で予告する → 予告→攻撃を体で覚える最初の敵。
function spawnSakiboshi(x, y) {
  const exit = x < FW / 2 ? -1 : 1;
  return Enemies.add(new Enemy(x, -20, {
    hp: 6, r: 10, score: 800, draw: drawSakiboshi,
    drops: Math.random() < 0.5 ? { power: 1 } : { point: 1 },
  })).run(function* (e) {
    yield* moveTo(e, x, y, 40);
    yield D.pick(14, 10, 8, 6);
    Bullets.fan(e.x, e.y, D.pick(1, 3, 3, 5), aimAngle(e.x, e.y), D.pick(0, 0.35, 0.3, 0.5), D.s(2.6), 'star', 'gold');
    if (D.lv >= 2) {
      yield 12;
      Bullets.fan(e.x, e.y, 3, aimAngle(e.x, e.y), 0.25, D.s(3.2), 'small', 'yellow');
    }
    yield 16;
    for (let i = 0; i < 150; i++) { e.x += exit * Math.min(4, i * 0.06); e.y -= Math.min(2, i * 0.03); yield 1; }
  });
}

// きらめきで予告 → 45フレーム後に出現
function* sakiWave(xs, ys, gap) {
  for (let i = 0; i < xs.length; i++) {
    const x = xs[i], y = ys[i % ys.length];
    Effects.twinkle(x, y, 45, 'gold');
    Sound.play('warn');
    Game.after(45, () => spawnSakiboshi(x, y));
    yield gap;
  }
}

// 針時計：遅刻する夢・時間に追われる夢から生まれた。
// 針は「自機が向かっている先」へ回り、その方向に針弾を撃つ。
function spawnClock(x, y) {
  return Enemies.add(new Enemy(x, -24, {
    hp: 45, r: 14, score: 3000, draw: drawClock, hand: Math.PI / 2,
    drops: { power: 2, point: 2 },
  })).run(function* (e) {
    e.tasks.add((function* () {
      for (;;) {
        let d = leadAngle(e.x, e.y, D.s(3)) - e.hand;
        d = Math.atan2(Math.sin(d), Math.cos(d));
        e.hand += d * 0.08;
        yield 1;
      }
    })());
    yield* moveTo(e, x, y, 60);
    for (let k = 0; k < 4; k++) {
      yield 50;
      Sound.play('tick');
      const n = D.pick(3, 5, 6, 7);
      for (let i = 0; i < n; i++) Bullets.shoot(e.x, e.y, e.hand, D.s(2.2 + i * 0.45), 'needle', 'red');
      if (D.lv >= 2) for (const s of [-0.3, 0.3]) for (let i = 0; i < 3; i++) Bullets.shoot(e.x, e.y, e.hand + s, D.s(2 + i * 0.4), 'needle', 'orange');
      Sound.play('bullet');
    }
    yield 30;
    e.vy = -1.2;
  });
}

// ゆめうらない：占いを夢に見た人の記憶から生まれた、水晶玉を抱く小鳥。
// 自機の「数瞬先」を占って撃つ → ずっと同じ方向に動くと当たる。
function spawnBird(fromLeft, y) {
  const dir = fromLeft ? 1 : -1;
  return Enemies.add(new Enemy(fromLeft ? -20 : FW + 20, y, {
    hp: 16, r: 11, score: 1500, draw: drawBird, dir,
    drops: { point: 1, power: 1 },
  })).run(function* (e) {
    e.vx = dir * D.pick(1.6, 1.8, 2, 2.2);
    let f = 0;
    for (;;) {
      e.y = y + Math.sin(f * 0.05) * 14;
      f++;
      if (f % D.pick(60, 40, 30, 24) === 20 && e.x > 10 && e.x < FW - 10) {
        const sp = D.s(2.8);
        Bullets.fan(e.x, e.y, D.pick(1, 1, 3, 3), leadAngle(e.x, e.y, sp), 0.2, sp, 'orb', 'purple');
      }
      yield 1;
    }
  });
}

// 星図の欠片：星占い・天体観測の夢のかけら。
// 倒すと星座の頂点が星弾になって散る（撃ち返し）→ 倒す「場所」まで考えさせる。
function spawnSeizu(x, y) {
  const pts = [];
  for (let i = 0; i < 5; i++) {
    const a = (TAU * i) / 5 + rand(-0.4, 0.4), r = rand(14, 26);
    pts.push({ x: Math.cos(a) * r, y: Math.sin(a) * r });
  }
  return Enemies.add(new Enemy(x, -30, {
    hp: 80, r: 18, score: 5000, draw: drawSeizu, pts,
    drops: { power: 3, point: 3 },
    onDeath: (e) => {
      const n = D.pick(0, 4, 6, 8);
      if (!n) return;
      const rot = e.frame * 0.01;
      for (const p of e.pts) {
        const px = e.x + p.x * Math.cos(rot) - p.y * Math.sin(rot);
        const py = e.y + p.x * Math.sin(rot) + p.y * Math.cos(rot);
        Bullets.ring(px, py, n, rand(0, TAU), D.s(1.4), 'star', 'silver');
      }
    },
  })).run(function* (e) {
    yield* moveTo(e, x, y, 80);
    for (let k = 0; k < 5; k++) {
      Bullets.ring(e.x, e.y, D.n(14), k * 0.2, D.s(1.7), 'small', 'silver');
      Bullets.ring(e.x, e.y, D.n(14), k * 0.2 + 0.1, D.s(1.3), 'small', 'blue');
      yield 70;
    }
    e.vy = -0.8;
  });
}

// ------------------------------------------------------------
//  ボス弾幕：予知夢の精霊
// ------------------------------------------------------------

// 画面上から降る星（背景を兼ねた弱い弾）
function* starDrizzle(interval, colors) {
  for (;;) {
    Bullets.shoot(rand(0, FW), -6, Math.PI / 2 + rand(-0.2, 0.2), D.s(rand(1, 1.6)), 'small', pick(colors));
    yield interval;
  }
}

// --- 中ボス 通常：星の輪 + 先読み弾 ---
function* mid1Non(b) {
  let k = 0;
  for (;;) {
    for (let i = 0; i < 3; i++) { Bullets.ring(b.x, b.y, D.n(16), k * 0.13 + i * 0.05, D.s(2), 'star', 'gold'); yield 10; }
    const sp = D.s(3);
    Bullets.fan(b.x, b.y, D.pick(3, 3, 5, 7), leadAngle(b.x, b.y, sp), 0.45, sp, 'orb', 'blue');
    k++;
    yield 40;
    if (k % 3 === 0) yield* wander(b, 50);
  }
}

// --- 中ボス 夢札：予兆「流れ星の予告状」---
// 自機の「〇フレーム後の位置」へ予告線 → その線を流れ星が走る。
// 予告は今の動きから作られるので、線を見てから進路を変えればいい。
function* mid1Spell(b) {
  yield* moveTo(b, FW / 2, 80, 30);
  b.tasks.add(starDrizzle(D.pick(12, 8, 6, 5), ['silver']));
  for (;;) {
    const p = Game.player, sp = D.s(4.5);
    const ks = D.pick([40], [30, 70], [25, 55, 85], [20, 45, 70, 95]);
    const lines = ks.map((k) => angleTo(b.x, b.y, clamp(p.x + p.vx * k, 8, FW - 8), clamp(p.y + p.vy * k, 16, FH - 8)));
    for (const a of lines) Effects.warnLine(b.x, b.y, a, 640, 50, 'gold');
    Sound.play('warn');
    yield 50;
    for (let t = 0; t < 14; t++) {
      for (const a of lines) Bullets.shoot(b.x, b.y, a, sp, 'rice', 'gold', { delay: 2 });
      if (t % 4 === 0) Sound.play('bullet');
      yield 2;
    }
    yield D.pick(70, 50, 40, 35);
  }
}

// --- ボス 通常1：回る星の輪 + 先読み弾 ---
function* b1Non1(b) {
  let k = 0;
  for (;;) {
    for (let i = 0; i < 4; i++) {
      Bullets.ring(b.x, b.y, D.n(18), k * 0.09, D.s(2.1), 'star', 'gold');
      Bullets.ring(b.x, b.y, D.n(18), -k * 0.09 + 0.17, D.s(1.6), 'star', 'silver');
      k++;
      yield 14;
    }
    const sp = D.s(3.4);
    for (let j = 0; j < 3; j++) { Bullets.fan(b.x, b.y, D.pick(3, 5, 5, 7), leadAngle(b.x, b.y, sp), 0.5, sp, 'orb', 'blue'); yield 6; }
    if (k % 8 === 0) yield* wander(b, 60); else yield 20;
  }
}

// --- 夢札1：予夢札「三秒後の流星」---
// 直近1秒の動きを3秒先まで延ばした場所に予告線。きっかり3秒後に流星が落ちる。
// 線は古いほど明るい → どの線から落ちるか読める。
function meteor(x) {
  Sound.play('bullet');
  Bullets.shoot(x, -20, Math.PI / 2, D.s(7.5), 'bigstar', 'gold', {
    delay: 0, bound: 40,
    fn: (m) => {
      if (m.frame % D.pick(5, 4, 3, 3) === 0) {
        const side = m.frame % 2 ? 1 : -1;
        Bullets.shoot(m.x, m.y, Math.PI / 2 + side * rand(1.2, 1.9), D.s(rand(0.4, 0.9)), 'star', 'yellow', { accel: 0.01, maxSpd: D.s(1.4) });
      }
    },
  });
}
function* b1Spell1(b) {
  yield* moveTo(b, FW / 2, 70, 40);
  b.tasks.add(starDrizzle(D.pick(14, 9, 6, 5), ['silver', 'blue']));
  for (;;) {
    const p = Game.player, tr = p.trail;
    const past = tr[Math.max(0, tr.length - 61)] || p;
    const vx = (p.x - past.x) / 60;
    const tx = clamp(p.x + vx * 180, 12, FW - 12);
    const xs = [tx];
    if (D.lv >= 1) xs.push(clamp(tx + rand(60, 110) * (Math.random() < 0.5 ? -1 : 1), 12, FW - 12));
    if (D.lv >= 3) xs.push(rand(12, FW - 12));
    for (const x of xs) Effects.warnLine(x, 0, Math.PI / 2, FH, 180, 'gold');
    Sound.play('warn');
    b.tasks.add((function* () { yield 180; for (const x of xs) meteor(x); })());
    yield D.pick(60, 45, 36, 30);
  }
}

// --- 通常2：星座線 ---
// 星が飛んで止まり、星座線で結ばれる。その線の上を後から弾が流れる。
// 線＝未来の弾道。
function* b1Non2(b) {
  for (;;) {
    yield* wander(b, 40);
    const n = D.pick(4, 5, 6, 7);
    const pts = [];
    for (let i = 0; i < n; i++) pts.push({ x: rand(30, FW - 30), y: rand(50, 230) });
    const anchors = pts.map((pt) => Bullets.shoot(b.x, b.y, 0, 0, 'bigstar', 'silver', {
      sx: b.x, sy: b.y, tx: pt.x, ty: pt.y,
      fn: (s) => {
        if (s.frame <= 40) { const t = easeOutCubic(s.frame / 40); s.x = lerp(s.sx, s.tx, t); s.y = lerp(s.sy, s.ty, t); }
      },
    }));
    Sound.play('bullet');
    yield 46;
    for (let i = 0; i < n - 1; i++) Effects.warnSeg(pts[i].x, pts[i].y, pts[i + 1].x, pts[i + 1].y, 50, 'silver');
    Sound.play('warn');
    yield 50;
    for (let i = 0; i < n - 1; i++) {
      const a = angleTo(pts[i].x, pts[i].y, pts[i + 1].x, pts[i + 1].y);
      const m = D.n(7);
      for (let j = 0; j < m; j++) Bullets.shoot(pts[i].x, pts[i].y, a, D.s(1.2 + j * 0.35), 'rice', 'cyan');
    }
    for (const s of anchors) {
      if (!s.alive) continue;
      Bullets.ring(s.x, s.y, D.pick(5, 6, 8, 10), rand(0, TAU), D.s(1.3), 'small', 'silver');
      s.alive = false;
    }
    const sp = D.s(3.2);
    Bullets.fan(b.x, b.y, D.pick(3, 5, 5, 7), leadAngle(b.x, b.y, sp), 0.4, sp, 'orb', 'blue');
    yield D.pick(60, 45, 40, 35);
  }
}

// --- 夢札2：星占「運命線の糸車」---
// 糸車の回転は自機の横移動に引っ張られる。動きすぎると運命線に巻き込まれる。
// 止まっていれば線はまっすぐ → 「動かない勇気」が攻略。ただし時々の輪で微調整は必要。
function* b1Spell2(b) {
  yield* moveTo(b, FW / 2, 110, 40);
  let ang = Math.PI / 2, w = 0, f = 0;
  const arms = D.pick(5, 6, 7, 8);
  for (;;) {
    w = lerp(w, -Game.player.vx * 0.006 + 0.002, 0.03);
    ang += w;
    if (f % D.pick(5, 4, 3, 3) === 0) {
      for (let i = 0; i < arms; i++) Bullets.shoot(b.x, b.y, ang + (TAU * i) / arms, D.s(2.6), 'rice', 'gold', { delay: 2 });
    }
    if (f % 120 === 60) Bullets.ring(b.x, b.y, D.n(24), rand(0, TAU), D.s(1.4), 'orb', 'pink');
    f++;
    yield 1;
  }
}

// --- 夢札3：時告「明日の時計盤」---
// 文字盤の数字が順番に光る。光った順番＝これから撃つ順番。
// 光った瞬間に狙いが決まり、予告線が引かれる → 順番を読んで安全な「時刻」へ。
function* b1Spell3(b) {
  const cx = FW / 2, cy = 170, R = 140;
  yield* moveTo(b, cx, cy, 40);
  const dial = (b.pd.dial = { cx, cy, R, lit: [], hand: -Math.PI / 2 });
  const hourPos = (h) => { const a = -Math.PI / 2 + (TAU * h) / 12; return { x: cx + Math.cos(a) * R, y: cy + Math.sin(a) * R }; };
  b.tasks.add((function* () { for (;;) { dial.hand += TAU / 600; yield 1; } })());
  for (;;) {
    const n = D.pick(4, 5, 6, 7);
    const pool = [...Array(12).keys()], shots = [];
    for (let i = 0; i < n; i++) {
      const h = pool.splice(randInt(0, pool.length - 1), 1)[0];
      const hp = hourPos(h);
      const a = angleTo(hp.x, hp.y, Game.player.x, Game.player.y);
      shots.push({ h, x: hp.x, y: hp.y, a });
      dial.lit.push({ h, order: i + 1 });
      Effects.warnLine(hp.x, hp.y, a, 640, n * 18 + 30, 'orange');
      Sound.play('tick');
      yield 18;
    }
    yield 30;
    for (const s of shots) {
      const m = D.pick(3, 5, 7, 9);
      for (let w2 = 0; w2 < 3; w2++) {
        for (let j = 0; j < m; j++) {
          Bullets.shoot(s.x, s.y, s.a + (j - (m - 1) / 2) * 0.04, D.s(3 - w2 * 0.4), 'needle', w2 ? 'orange' : 'red');
        }
      }
      dial.lit = dial.lit.filter((l) => l.h !== s.h);
      Sound.play('bullet');
      yield 18;
    }
    Bullets.ring(cx, cy, 12 * D.pick(1, 2, 2, 3), dial.hand, D.s(1.5), 'orb', 'gold');
    yield 30;
  }
}
function drawDial(c, b) {
  const d = b.pd.dial;
  if (!d) return;
  c.save(); c.translate(d.cx, d.cy);
  c.strokeStyle = 'rgba(200,215,255,0.3)'; c.lineWidth = 1;
  c.beginPath(); c.arc(0, 0, d.R + 14, 0, TAU); c.stroke();
  c.beginPath(); c.arc(0, 0, d.R - 14, 0, TAU); c.stroke();
  // 長針
  c.strokeStyle = 'rgba(255,214,140,0.4)'; c.lineWidth = 2;
  c.beginPath(); c.moveTo(0, 0); c.lineTo(Math.cos(d.hand) * (d.R - 24), Math.sin(d.hand) * (d.R - 24)); c.stroke();
  c.textAlign = 'center'; c.textBaseline = 'middle';
  for (let h = 0; h < 12; h++) {
    const a = -Math.PI / 2 + (TAU * h) / 12, x = Math.cos(a) * d.R, y = Math.sin(a) * d.R;
    const lit = d.lit.find((l) => l.h === h);
    if (lit) {
      glow(c, x, y, 22, '#ff9330', 0.6 + 0.2 * Math.sin(b.frame * 0.3));
      c.fillStyle = '#fff3c8'; c.font = `bold 18px ${FONT_SERIF}`;
      c.fillText(String(h || 12), x, y);
      c.fillStyle = '#ffb070'; c.font = `bold 10px ${FONT_SANS}`;
      c.fillText(lit.order, x + 12, y - 11); // 撃つ順番
    } else {
      c.fillStyle = 'rgba(200,215,255,0.45)'; c.font = `14px ${FONT_SERIF}`;
      c.fillText(String(h || 12), x, y);
    }
  }
  c.restore();
}

// --- 最終夢札：予知夢「まだ見ぬ朝の星図」---
// 自機の過去8秒の軌跡が星座になり、その星が弾になる。
// 「あなたの動きが未来の弾幕になる」→ 大きく動けば安全地帯を自分で描ける。
function* starRain() {
  for (;;) {
    Bullets.shoot(rand(0, FW), -8, Math.PI / 2 + rand(-0.15, 0.15), D.s(rand(1.1, 1.9)), 'star', pick(['gold', 'yellow', 'silver']));
    yield D.pick(16, 10, 7, 5);
  }
}
function* b1Last(b) {
  yield* moveTo(b, FW / 2, 80, 40);
  b.tasks.add(starRain());
  let cycle = 0;
  for (;;) {
    const tr = Game.player.trail;
    const N = D.pick(8, 10, 13, 16);
    const span = Math.min(tr.length - 1, 480);
    const pts = [];
    for (let i = 0; i < N; i++) {
      const back = Math.round(30 + Math.max(0, span - 30) * (N - 1 - i) / (N - 1));
      const q = tr[Math.max(0, tr.length - 1 - back)] || Game.player;
      pts.push({ x: q.x, y: q.y });
    }
    for (let i = 0; i < N; i++) {
      Effects.twinkle(pts[i].x, pts[i].y, 80 - i * 3, 'gold');
      if (i > 0) Effects.warnSeg(pts[i - 1].x, pts[i - 1].y, pts[i].x, pts[i].y, 80 - i * 3, 'gold');
      yield 3;
    }
    Sound.play('warn');
    yield 80 - N * 3;
    const cols = ['gold', 'yellow', 'orange', 'silver'];
    for (let i = 0; i < N; i++) {
      Bullets.ring(pts[i].x, pts[i].y, D.pick(6, 8, 10, 12), rand(0, TAU), D.s(1.5), 'star', cols[i % 4], { accel: 0.01, maxSpd: D.s(2.4) });
      Effects.ring(pts[i].x, pts[i].y, '#ffd27a', 30, 20);
      yield 4;
    }
    cycle++;
    if (cycle % 2 === 0) {
      const sp = D.s(2.6);
      Bullets.fan(b.x, b.y, D.pick(3, 5, 7, 9), leadAngle(b.x, b.y, sp), 0.7, sp, 'big', 'blue');
    }
    yield D.pick(50, 40, 30, 24);
  }
}

// ------------------------------------------------------------
//  ボス定義
// ------------------------------------------------------------
const MIDBOSS1 = {
  name: '予知夢の精霊', art: 'boss1', isMid: true, draw: drawSeer,
  phases: [
    { hp: 900, time: 25, fn: mid1Non },
    { hp: 1200, time: 30, spell: true, name: '予兆「流れ星の予告状」', bonus: 800000, fn: mid1Spell },
  ],
};

const BOSS1 = {
  name: '予知夢の精霊', art: 'boss1', draw: drawSeer,
  phases: [
    { hp: 1800, time: 30, fn: b1Non1 },
    { hp: 2200, time: 40, spell: true, name: '予夢札「三秒後の流星」', bonus: 1500000, fn: b1Spell1 },
    { hp: 1900, time: 30, fn: b1Non2 },
    { hp: 2600, time: 45, spell: true, name: '星占「運命線の糸車」', bonus: 1800000, fn: b1Spell2 },
    { hp: 2800, time: 50, spell: true, name: '時告「明日の時計盤」', bonus: 2200000, fn: b1Spell3, draw: drawDial },
    { hp: 3400, time: 60, spell: true, name: '予知夢「まだ見ぬ朝の星図」', bonus: 3000000, fn: b1Last },
  ],
};

// セリフはあとで入れる。空のままなら会話はスキップされる。
// 例： { side: 'left', name: '獏', text: '……' }, { side: 'right', name: '予知夢の精霊', text: '……' }
const DIALOG1 = {
  midboss: [],
  boss: [],
  after: [],
};

// ------------------------------------------------------------
//  道中
// ------------------------------------------------------------
function* stage1Script() {
  const G = Game;
  yield 40;
  G.showBanner('第一夢　予知夢', '～ 星は、まだ見ぬ朝を知っている');
  G.showBgm('星読みの夜明け（仮）');
  yield 140;

  // A：さきぼし ― 予告 → 攻撃 を覚える
  yield* sakiWave([60, 100, 140, 180, 220], [70, 90, 110], 16);
  yield 70;
  yield* sakiWave([324, 284, 244, 204, 164], [70, 90, 110], 16);
  yield 100;

  // B：ゆめうらない ― 先読み射撃
  for (let i = 0; i < 5; i++) { spawnBird(true, 60 + i * 10); yield 22; }
  yield 60;
  for (let i = 0; i < 5; i++) { spawnBird(false, 120 + i * 10); yield 22; }
  yield 120;

  // C：針時計 + さきぼし
  spawnClock(110, 110); yield 40; spawnClock(274, 110);
  yield 120;
  yield* sakiWave([40, 344, 80, 304, 120, 264], [60, 80], 20);
  yield* waitUntil(() => Enemies.list.length === 0, 300);
  yield 40;

  // D：星図の欠片
  spawnSeizu(FW / 2, 110);
  yield 90;
  for (let i = 0; i < 4; i++) { spawnBird(i % 2 === 0, 70 + i * 20); yield 30; }
  yield* waitUntil(() => Enemies.list.length === 0, 360);
  yield 60;

  // 中ボス
  yield* bossFight(MIDBOSS1, { dialog: DIALOG1.midboss });
  yield 90;

  // E：星図と時計の空
  spawnSeizu(100, 100); yield 50; spawnSeizu(284, 130);
  yield 120;
  spawnClock(FW / 2, 70);
  yield* sakiWave([50, 90, 130, 170], [150, 170], 18);
  yield* sakiWave([334, 294, 254, 214], [150, 170], 18);
  yield* waitUntil(() => Enemies.list.length === 0, 300);
  yield 30;

  // F：流星群のような最終ラッシュ
  for (let i = 0; i < 16; i++) {
    const x = i % 2 ? rand(200, 344) : rand(40, 184);
    yield* sakiWave([x], [rand(50, 140)], 12);
    if (i % 4 === 3) spawnBird(i % 8 === 3, rand(60, 120));
  }
  spawnClock(90, 90); spawnClock(294, 90);
  yield* waitUntil(() => Enemies.list.length === 0, 420);
  yield 120;

  // ボス
  yield* bossFight(BOSS1, { dialog: DIALOG1.boss, bgm: '予知夢の星図　～ Unseen Morning（仮）' });
  yield 90;
  yield* G.dialog(DIALOG1.after);
  yield 60;
  G.stageClear();
}

const STAGE1 = {
  no: 1, name: '第一夢', title: '予知夢',
  leftoverRate: 0.04, // 獏喰で食べた弾が「食べ残し」として戻る確率（面が進むほど上げる）
  makeBg: () => new BgStage1(),
  script: stage1Script,
};
