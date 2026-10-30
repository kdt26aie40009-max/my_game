'use strict';
// ============================================================
//  第四夢　逆夢 ― 「悪い夢ほど、朝はやさしい」
//
//  ステージ全体のルール：
//   ・画面の隅の砂時計が落ちきると、ひっくり返る。そのとき白抜きの弾はすべて逆走し、
//     中身の詰まった弾に変わる（逆走は一度だけ）
//     （返る直前に震える ＝ 第二夢と同じ「震えたら変わる」）
//   ・おみくじの「凶」が出た場所は安全。それ以外の場所に「吉」の星が一斉に咲く
//   ・大きくて怖い弾ほど偽物（第三夢と同じく揺らめき、低速で透ける）
//  → 見たものを信じるな。悪夢だから悪いとは限らない。
// ============================================================

// 白抜きの弾は一度だけ逆走し、裏返ると中身が詰まる（もう返らない）
function flipRevBullets() {
  for (const b of Bullets.list) {
    if (!b.rev || !b.alive) continue;
    b.ang += Math.PI; b.jit = 0; b.rev = false;
    b.retype(b.type === 'ring' ? 'orb' : 'rice');
  }
}
function trembleRev() { for (const b of Bullets.list) if (b.rev) b.jit = 1.2; }

// 砂時計（背景・ボス・情報表示で共通）
//   top: 上の部屋に残っている砂の割合（0〜1）
function drawHourglass(c, x, y, w, h, top, rot = 0, alpha = 1) {
  const hw = w / 2, hh = h / 2, bot = 1 - top;
  c.save(); c.translate(x, y); c.rotate(rot); c.globalAlpha *= alpha;
  c.fillStyle = '#ffd970';
  if (top > 0.01) {
    c.beginPath(); c.moveTo(0, -1); c.lineTo(-hw * top, -hh * top); c.lineTo(hw * top, -hh * top); c.closePath(); c.fill();
    c.fillRect(-0.5, 0, 1, hh * (1 - bot * 0.9)); // 落ちていく砂
  }
  if (bot > 0.01) {
    const k = 1 - bot;
    c.beginPath(); c.moveTo(-hw, hh); c.lineTo(hw, hh); c.lineTo(hw * k, hh * k); c.lineTo(-hw * k, hh * k); c.closePath(); c.fill();
  }
  c.strokeStyle = 'rgba(220,235,255,0.9)'; c.lineWidth = Math.max(1, w * 0.05);
  c.beginPath(); c.moveTo(-hw, -hh); c.lineTo(hw, -hh); c.lineTo(-hw, hh); c.lineTo(hw, hh); c.closePath(); c.stroke();
  c.lineWidth = Math.max(1.5, w * 0.1);
  c.beginPath(); c.moveTo(-hw * 1.2, -hh); c.lineTo(hw * 1.2, -hh); c.moveTo(-hw * 1.2, hh); c.lineTo(hw * 1.2, hh); c.stroke();
  c.restore();
}

// ------------------------------------------------------------
//  背景：水鏡の逆さ町
//   真ん中の水面を境に、上は夜、下は昼。上の町は幽霊のように淡く、
//   水に映った下の町の方がはっきりしている（映った方が本物）。
//   上半分のものは上へ、下半分のものは下へ流れる。
//   砂時計が返るたびに、世界ごと天地がひっくり返る。
// ------------------------------------------------------------
class BgStage4 {
  constructor() {
    this.t = 0; this.spell = 0;
    this.WL = FH * 0.5;   // 水面
    this.side = 0;        // 0：上が夜／1：上が昼
    this.anim = 0;        // 天地返しのアニメ（0 で静止）
    this.flips = 0;
    this.period = 210; this.flipT = 210;
    this.omens = [];      // 「凶」の印
    this.sil = Array.from({ length: 9 }, (_, i) => ({
      x: i * 48 + rand(-10, 10), kind: pick(['tree', 'tree', 'torii', 'pagoda', 'house']), h: rand(0.7, 1.2),
    }));
    this.stars = Array.from({ length: 50 }, () => ({ x: rand(0, FW), y: rand(0, this.WL - 20), tw: rand(0, TAU) }));
    this.motes = Array.from({ length: 40 }, () => ({ x: rand(0, FW), d: rand(0, this.WL), v: rand(0.2, 0.7), up: Math.random() < 0.5 }));
  }

  // 情報表示・ボスの砂時計用
  sand() { return this.anim > 0 ? 0 : clamp(this.flipT / this.period, 0, 1); }
  hgRot() { return Math.PI * easeInOutSine(this.anim); }

  flip() {
    flipRevBullets();
    this.flips++;
    this.anim = 0.001;
    Sound.play('flip');
  }

  update(spellOn) {
    this.t++;
    const bd = Game.boss && Game.boss.alive ? Game.boss.pd : {};
    this.spell = lerp(this.spell, spellOn ? 1 : 0, 0.04);
    const per = bd.flip || 210;
    if (per !== this.period) { this.period = per; this.flipT = Math.min(this.flipT, per); }
    if (!Game.dlg) {
      this.flipT--;
      if (this.flipT <= 24) trembleRev(); // 返る前触れ
      if (this.flipT <= 0) { this.flip(); this.flipT = this.period; }
    }
    if (this.anim > 0) {
      this.anim += 1 / 24;
      if (this.anim >= 1) { this.anim = 0; this.side ^= 1; }
    }
    for (const s of this.sil) { s.x -= 0.25; if (s.x < -40) s.x += 9 * 48; }
    for (const m of this.motes) { m.d += m.v; if (m.d > this.WL) { m.d = 0; m.x = rand(0, FW); } }
    for (const o of this.omens) o.life--;
    this.omens = this.omens.filter((o) => o.life > 0);
  }

  draw(c) {
    const WL = this.WL;
    c.save();
    if (this.anim > 0) { // 天地返し：水面を軸に裏返る
      c.translate(0, WL); c.scale(1, Math.cos(Math.PI * this.anim)); c.translate(0, -WL);
    }
    this.drawWorld(c, this.side);
    c.restore();

    // 水面
    glow(c, FW / 2, WL, 200, '#cfe8ff', 0.12);
    c.strokeStyle = 'rgba(220,240,255,0.55)'; c.lineWidth = 1;
    c.beginPath();
    for (let x = 0; x <= FW; x += 6) c.lineTo(x, WL + Math.sin(x * 0.05 + this.t * 0.05) * 1.2);
    c.stroke();

    c.fillStyle = 'rgba(8,6,28,0.32)'; c.fillRect(0, 0, FW, FH);

    if (this.spell > 0.01) {
      c.globalAlpha = this.spell;
      c.fillStyle = 'rgba(8,10,30,0.35)'; c.fillRect(0, 0, FW, FH);
      drawHourglass(c, FW / 2, WL, 220, 380, this.sand(), this.hgRot(), 0.18);
      c.save(); c.translate(FW / 2, WL); c.rotate(this.t * 0.002);
      c.strokeStyle = 'rgba(159,232,255,0.2)'; c.lineWidth = 1;
      c.beginPath(); c.arc(0, 0, 170, 0, TAU); c.stroke();
      starPath(c, 0, 0, 170, 85, 6, 0); c.stroke();
      c.rotate(Math.PI); starPath(c, 0, 0, 120, 60, 6, 0); c.stroke();
      c.restore();
      c.globalAlpha = 1;
    }
    this.drawOmens(c);
  }

  drawWorld(c, side) {
    const WL = this.WL;
    const night = (y0, y1) => { const g = c.createLinearGradient(0, y0, 0, y1); g.addColorStop(0, '#070a26'); g.addColorStop(1, '#232c66'); return g; };
    const day = (y0, y1) => { const g = c.createLinearGradient(0, y0, 0, y1); g.addColorStop(0, '#6070b0'); g.addColorStop(1, '#b49ac0'); return g; };
    // 上（水面から離れるほど濃い）と、下（その鏡写し）
    c.fillStyle = side ? day(0, WL) : night(0, WL); c.fillRect(0, 0, FW, WL);
    c.fillStyle = side ? night(FH, WL) : day(FH, WL); c.fillRect(0, WL, FW, FH - WL);

    // 夜側の星と月、昼側の太陽
    const nightUp = side === 0, my = (y) => (nightUp ? y : 2 * WL - y);
    c.fillStyle = '#e6ecff';
    for (const s of this.stars) {
      c.globalAlpha = 0.3 + 0.5 * (0.5 + 0.5 * Math.sin(this.t * 0.05 + s.tw));
      c.fillRect(s.x, my(s.y), 1.3, 1.3);
    }
    c.globalAlpha = 1;
    glow(c, FW * 0.75, my(70), 50, '#fff6e0', 0.35); circle(c, FW * 0.75, my(70), 14, '#fff6e0');
    glow(c, FW * 0.25, 2 * WL - my(70), 70, '#ffe0b0', 0.4);

    // 町：上は淡い幻、下（映った方）がはっきり
    for (const s of this.sil) {
      for (const up of [true, false]) {
        const solid = up === (side === 1);
        c.save(); c.translate(s.x, WL);
        if (!up) c.scale(1, -1);
        c.globalAlpha = solid ? 0.9 : 0.22;
        c.fillStyle = solid ? '#14122e' : '#cfd8ff';
        this.drawSil(c, s.kind, s.h);
        c.restore();
      }
    }
    // 上半分は上へ、下半分は下へ流れる光の粒
    c.fillStyle = '#cfe8ff';
    for (const m of this.motes) {
      c.globalAlpha = 0.5 * (1 - m.d / WL);
      c.fillRect(m.x, m.up ? WL - m.d : WL + m.d, 1.5, 1.5);
    }
    c.globalAlpha = 1;
  }

  // 水面に立つ建物（上向きに描く。y=0 が水面）
  drawSil(c, kind, k) {
    c.beginPath();
    switch (kind) {
      case 'tree':
        for (let i = 0; i < 3; i++) { const w = (16 - i * 4) * k, y = -(8 + i * 12) * k; c.moveTo(-w, y + 10 * k); c.lineTo(0, y - 14 * k); c.lineTo(w, y + 10 * k); }
        c.rect(-2 * k, -8 * k, 4 * k, 8 * k);
        break;
      case 'torii':
        c.rect(-14 * k, -40 * k, 3 * k, 40 * k); c.rect(11 * k, -40 * k, 3 * k, 40 * k);
        c.rect(-20 * k, -44 * k, 40 * k, 4 * k); c.rect(-16 * k, -34 * k, 32 * k, 3 * k);
        break;
      case 'pagoda':
        for (let i = 0; i < 4; i++) {
          const w = (20 - i * 3.5) * k, y = -(i * 16) * k;
          c.rect(-w * 0.55, y - 12 * k, w * 1.1, 12 * k);
          c.moveTo(-w, y - 12 * k); c.lineTo(w, y - 12 * k); c.lineTo(0, y - 18 * k);
        }
        c.rect(-1 * k, -78 * k, 2 * k, 14 * k);
        break;
      case 'house':
        c.rect(-14 * k, -16 * k, 28 * k, 16 * k);
        c.moveTo(-18 * k, -16 * k); c.lineTo(0, -30 * k); c.lineTo(18 * k, -16 * k);
        break;
    }
    c.fill();
  }

  // 「凶」の印：見た目は不吉、中は安全
  drawOmens(c) {
    for (const o of this.omens) {
      const a = Math.min(1, (o.max - o.life) / 15, o.life / 15);
      c.save(); c.translate(o.x, o.y); c.globalAlpha = a;
      c.fillStyle = 'rgba(70,0,20,0.45)'; c.beginPath(); c.arc(0, 0, o.r, 0, TAU); c.fill();
      c.rotate(this.t * 0.02);
      c.strokeStyle = '#ff3b5c'; c.lineWidth = 1.5;
      c.beginPath();
      for (let i = 0; i <= 24; i++) { // とげとげの縁
        const ang = (TAU * i) / 24, rr = o.r + (i % 2 ? 6 : 0);
        c.lineTo(Math.cos(ang) * rr, Math.sin(ang) * rr);
      }
      c.stroke();
      c.rotate(-this.t * 0.02);
      c.fillStyle = '#ff6a7a'; c.font = `bold ${o.label.length > 1 ? 18 : 24}px ${FONT_SERIF}`;
      c.textAlign = 'center'; c.textBaseline = 'middle';
      c.fillText(o.label, 0, 1);
      c.restore();
    }
  }

  // 弾の上に描く：砂時計（あと何秒で返るか）
  drawOver(c) {
    const x = 14, y = 50;
    glow(c, x, y, 16, '#9fe8ff', this.flipT <= 24 ? 0.6 : 0.2);
    drawHourglass(c, x, y, 11, 20, this.sand(), this.hgRot(), 0.95);
  }
}

// 「凶」の印を出し、それ以外の場所に「吉」の星を咲かせる。
// 一つは必ず自機から手の届く所に出る。
function* omenField(n, label = '凶') {
  const p = Game.player, R = D.pick(46, 40, 36, 32);
  const zones = [];
  for (let i = 0; i < n; i++) {
    let x, y, t = 0;
    do {
      if (i === 0) { const a = rand(0, TAU), d = rand(40, 110); x = p.x + Math.cos(a) * d; y = p.y + Math.sin(a) * d; }
      else { x = rand(40, FW - 40); y = rand(140, FH - 40); }
      x = clamp(x, 40, FW - 40); y = clamp(y, 130, FH - 40);
      t++;
    } while (t < 20 && zones.some((z) => dist(z.x, z.y, x, y) < R * 2.6));
    zones.push({ x, y, r: R, label, life: 175, max: 175 });
  }
  Game.bg.omens.push(...zones);
  Sound.play('warn');
  yield 30;
  // 吉の星が咲く予兆
  const step = D.pick(44, 38, 34, 30), pts = [];
  for (let y = 18, row = 0; y < FH; y += step, row++) {
    for (let x = 10 + (row % 2) * (step / 2); x < FW; x += step) {
      if (!zones.some((z) => dist(x, y, z.x, z.y) < z.r + 6)) pts.push({ x, y });
    }
  }
  for (const q of pts) Effects.twinkle(q.x, q.y, 50, 'gold');
  yield 50;
  for (const q of pts) Bullets.shoot(q.x, q.y, rand(0, TAU), 0, 'star', Math.random() < 0.5 ? 'gold' : 'pink', { delay: 10, life: 80 });
  Sound.play('bullet');
  yield 95;
}

// ------------------------------------------------------------
//  雑魚敵の見た目（仮グラフィック）
// ------------------------------------------------------------
function drawBat(c, e) {
  c.save(); c.translate(e.x, e.y);
  if (e.hang) c.scale(1, -1); // ぶら下がると逆さま
  glow(c, 0, 0, 18, '#3fe6ff', 0.25);
  const flap = e.hang ? 0.15 : Math.sin(e.frame * 0.4) * 0.7;
  for (const s of [-1, 1]) {
    c.save(); c.scale(s, 1); c.rotate(-flap);
    c.fillStyle = '#2e2e64';
    c.beginPath(); c.moveTo(3, 0); c.quadraticCurveTo(10, -10, 16, -4); c.quadraticCurveTo(12, -1, 13, 3);
    c.quadraticCurveTo(9, 1, 8, 5); c.quadraticCurveTo(5, 2, 3, 3); c.fill();
    c.restore();
  }
  ellipse(c, 0, 0, 4, 6, '#40407a');
  c.fillStyle = '#40407a';
  c.beginPath(); c.moveTo(-3.5, -4); c.lineTo(-2.5, -9); c.lineTo(-1, -5); c.moveTo(3.5, -4); c.lineTo(2.5, -9); c.lineTo(1, -5); c.fill();
  circle(c, -1.6, -2, 1, '#9ff8ff'); circle(c, 1.6, -2, 1, '#9ff8ff');
  c.restore();
}

function drawKoi(c, e) {
  c.save(); c.translate(e.x, e.y); c.rotate(e.h + Math.PI / 2);
  glow(c, 0, 0, 22, '#ff9330', 0.3);
  c.save(); c.translate(0, 10); c.rotate(Math.sin(e.frame * 0.2) * 0.35);
  c.fillStyle = '#ff7a50'; c.beginPath(); c.moveTo(0, 0); c.lineTo(-7, 10); c.lineTo(7, 10); c.closePath(); c.fill();
  c.restore();
  ellipse(c, -6, -1, 3.5, 1.6, '#ffb090', 0.6); ellipse(c, 6, -1, 3.5, 1.6, '#ffb090', -0.6);
  ellipse(c, 0, 0, 6, 12, '#fff4ec');
  ellipse(c, 0, -5, 4.5, 4, '#ff5030'); ellipse(c, 1.5, 4, 3, 3.5, '#ff5030');
  circle(c, -2.2, -9, 0.9, '#222'); circle(c, 2.2, -9, 0.9, '#222');
  c.restore();
}

function drawMikuji(c, e) {
  const bg = Game.bg;
  const face = mikujiFace(e);
  const sx = Math.max(0.08, Math.abs(Math.cos(Math.PI * bg.anim))); // 裏返る瞬間は細くなる
  const lucky = face === '吉';
  c.save(); c.translate(e.x, e.y + Math.sin(e.frame * 0.05) * 2);
  glow(c, 0, 0, 30, lucky ? '#ffd970' : '#a0a0c0', 0.35);
  if (lucky) { // 吉の面は守られていて、弾が効かない
    c.save(); c.rotate(e.frame * 0.03);
    c.strokeStyle = 'rgba(255,217,112,0.7)'; c.setLineDash([3, 4]);
    c.beginPath(); c.arc(0, 0, 24, 0, TAU); c.stroke(); c.setLineDash([]);
    c.restore();
  }
  c.scale(sx, 1);
  c.fillStyle = lucky ? '#fff3d0' : '#d8d8e8'; c.fillRect(-11, -18, 22, 36);
  c.strokeStyle = lucky ? '#e04050' : '#4a4a6a'; c.lineWidth = 1.5; c.strokeRect(-11, -18, 22, 36);
  c.fillStyle = lucky ? '#e04050' : '#2a2a40'; c.font = `bold 15px ${FONT_SERIF}`;
  c.textAlign = 'center'; c.textBaseline = 'middle';
  c.fillText(face, 0, 1);
  c.restore();
}
function mikujiFace(e) {
  const bg = Game.bg;
  const n = bg.flips - (bg.anim > 0 && bg.anim < 0.5 ? 1 : 0);
  return (n + e.off) % 2 === 0 ? '吉' : '凶';
}

function drawLantern(c, e) {
  c.save(); c.translate(e.x, e.y);
  c.strokeStyle = 'rgba(200,210,240,0.5)'; c.lineWidth = 1;
  c.beginPath(); c.moveTo(0, -e.y - 10); c.lineTo(0, -24); c.stroke(); // 天から吊られている
  c.scale(1, -1); // 逆さの灯籠
  glow(c, 0, 4, 44, '#ffd970', 0.3 + 0.1 * Math.sin(e.frame * 0.1));
  c.fillStyle = '#5a5a78';
  c.fillRect(-14, -24, 28, 5);  // 台
  c.fillRect(-4, -19, 8, 12);   // 竿
  c.fillRect(-11, -7, 22, 4);   // 中台
  c.fillStyle = '#ffe6a0'; c.fillRect(-7, -3, 14, 11); // 火袋
  c.fillStyle = '#5a5a78';
  c.beginPath(); c.moveTo(-16, 8); c.lineTo(16, 8); c.lineTo(0, 20); c.closePath(); c.fill(); // 笠
  circle(c, 0, 22, 3, '#5a5a78');
  c.restore();
}

// 逆夢の精霊（仮グラフィック）
function drawSakayume(c, b) {
  const t = b.frame, bg = Game.bg;
  c.save(); c.translate(b.x, b.y + Math.sin(t * 0.05) * 2);
  // 頭上にある逆さの魔法陣
  c.save(); c.translate(0, -36); c.scale(1, 0.35); c.rotate(-t * 0.02);
  c.strokeStyle = 'rgba(159,232,255,0.6)'; c.lineWidth = 1.5;
  c.beginPath(); c.arc(0, 0, 32, 0, TAU); c.stroke();
  c.beginPath(); c.arc(0, 0, 25, 0, TAU); c.stroke();
  starPath(c, 0, 0, 25, 12, 6); c.stroke();
  c.restore();
  drawHourglass(c, 0, 0, 46, 72, bg.sand(), bg.hgRot(), 0.3);

  const img = Art.get(b.def.art);
  if (img) {
    Art.draw(c, img, 0, 0, 64);
  } else {
    glow(c, 0, 0, 34, '#9fe8ff', 0.3);
    // 上へなびく髪（重力が逆さ）
    c.strokeStyle = '#cfe8ff'; c.lineWidth = 2; c.lineCap = 'round';
    for (let i = -3; i <= 3; i++) {
      c.beginPath(); c.moveTo(i * 2.2, -18);
      c.quadraticCurveTo(i * 5 + Math.sin(t * 0.07 + i) * 3, -28, i * 4 + Math.sin(t * 0.05 + i) * 2, -38 + Math.abs(i) * 2);
      c.stroke();
    }
    // 表と裏の衣（左が白、右が黒）
    const dress = () => { c.beginPath(); c.moveTo(0, -8); c.quadraticCurveTo(-18, 8, -15, 24); c.lineTo(15, 24); c.quadraticCurveTo(18, 8, 0, -8); };
    for (const [x0, col] of [[-30, '#f4f0ff'], [0, '#1a1630']]) {
      c.save(); c.beginPath(); c.rect(x0, -40, 30, 80); c.clip();
      dress(); c.fillStyle = col; c.fill();
      circle(c, 0, -14, 7, x0 < 0 ? '#fff4ec' : '#d8d0e8');
      c.restore();
    }
    dress(); c.strokeStyle = '#9fe8ff'; c.lineWidth = 1; c.stroke();
    // 片目は開き、片目は閉じている
    circle(c, -2.6, -14, 1.3, '#2a6a8a');
    c.strokeStyle = '#f4f0ff'; c.beginPath(); c.arc(2.6, -14, 1.4, Math.PI * 0.1, Math.PI * 0.9); c.stroke();
    drawHourglass(c, 13, 6, 7, 12, bg.sand(), bg.hgRot(), 1);
  }
  c.restore();
}

// ------------------------------------------------------------
//  雑魚敵
// ------------------------------------------------------------

// 逆さ蝙蝠：天井からぶら下がって眠る生き物の夢。
// 白抜きの矢を下へ撃つ。砂時計が返ると、矢は上へ戻っていく → 砂時計のルールを覚える敵。
function spawnBat(x, y) {
  return Enemies.add(new Enemy(x, -16, {
    hp: 8, r: 10, score: 1000, draw: drawBat, hang: false,
    drops: Math.random() < 0.5 ? { power: 1 } : { point: 1 },
  })).run(function* (e) {
    yield* moveTo(e, x, y, 40);
    e.hang = true;
    for (let k = 0; k < 3; k++) {
      yield D.pick(60, 50, 40, 34);
      Bullets.fan(e.x, e.y, D.pick(3, 5, 5, 7), Math.PI / 2, D.pick(0.6, 0.8, 0.9, 1), D.s(2.2), 'arrow', 'cyan', { rev: true });
    }
    yield 30;
    e.hang = false;
    e.vy = -2; e.vx = rand(-1, 1);
  });
}

// 昇り鯉：滝を登る鯉の夢。水の流れに逆らう ＝ 画面の下から現れる。
// 出てくる前に水面が光り、下から予告線が伸びる。
function spawnKoi(x) {
  Effects.warnLine(x, FH, -Math.PI / 2, FH * 0.6, 50, 'cyan');
  Effects.ring(x, FH - 4, '#9fe8ff', 30, 50);
  Sound.play('warn');
  Game.after(50, () => Enemies.add(new Enemy(x, FH + 20, {
    hp: 14, r: 11, score: 1500, draw: drawKoi, h: -Math.PI / 2, drops: { point: 1, power: 1 },
  })).run(function* (e) {
    const ph = rand(0, TAU);
    for (let f = 0; ; f++) {
      e.vy = -D.pick(2, 2.3, 2.6, 2.9); e.vx = Math.sin(f * 0.06 + ph) * 1.2;
      e.h = Math.atan2(e.vy, e.vx);
      if (f % D.pick(50, 40, 32, 26) === 30) Bullets.fan(e.x, e.y, D.pick(1, 3, 3, 5), aimAngle(e.x, e.y), 0.4, D.s(2.4), 'orb', 'orange');
      yield 1;
    }
  }));
}

// みくじ札：おみくじを引く夢。砂時計が返るたびに表と裏が入れ替わる。
// 「吉」の面は守られていて撃つ。「凶」の面は無防備 → 凶こそ好機。
function spawnMikuji(x, y, off) {
  return Enemies.add(new Enemy(x, -24, {
    hp: 36, r: 13, score: 3000, draw: drawMikuji, off, drops: { power: 2, point: 2 },
  })).run(function* (e) {
    yield* moveTo(e, x, y, 50);
    for (let f = 0; f < 720; f++) {
      if (mikujiFace(e) === '吉') {
        e.invuln = 2;
        if (f % D.pick(50, 40, 32, 28) === 0) {
          Bullets.ring(e.x, e.y, D.n(12), rand(0, TAU), D.s(1.6), 'star', 'gold');
          if (D.lv >= 1) Bullets.fan(e.x, e.y, 3, aimAngle(e.x, e.y), 0.3, D.s(2.6), 'star', 'red');
        }
      }
      yield 1;
    }
    e.vy = -1;
  });
}

// 逆さ灯籠：天から吊るされた石灯籠。光が上ではなく下へ落ちる夢。
// 白抜きの輪が広がり、砂時計が返ると吸い込まれて反対側へ抜ける ＝ 呼吸する輪。
function spawnLantern(x) {
  return Enemies.add(new Enemy(x, -30, {
    hp: 130, r: 18, score: 8000, draw: drawLantern, drops: { power: 3, point: 5 },
    onDeath: (e) => { // 逆さの噴水：上へ噴き上がって落ちる
      const n = D.pick(0, 10, 14, 18);
      for (let i = 0; i < n; i++) {
        const vx = rand(-1.6, 1.6), vy = -rand(2, 3.4);
        Bullets.shoot(e.x, e.y, Math.atan2(vy, vx), Math.hypot(vx, vy), 'orb', 'gold', { accel: 0, fn: (s) => {
          const ax = Math.cos(s.ang) * s.spd, ay = Math.sin(s.ang) * s.spd + 0.05;
          s.ang = Math.atan2(ay, ax); s.spd = Math.min(D.s(3), Math.hypot(ax, ay));
        } });
      }
    },
  })).run(function* (e) {
    yield* moveTo(e, x, 90, 60);
    for (let k = 0; k < 8; k++) {
      Bullets.ring(e.x, e.y, D.n(18), k * 0.2, D.s(1.4), 'ring', 'cyan', { rev: true });
      yield 40;
      Bullets.fan(e.x, e.y, D.pick(3, 3, 5, 5), aimAngle(e.x, e.y), 0.3, D.s(2.8), 'orb', 'blue');
      yield 40;
    }
    e.vy = -0.8;
  });
}

// ------------------------------------------------------------
//  ボス弾幕：逆夢の精霊
// ------------------------------------------------------------

// --- 中ボス 通常：返し波 ---
function* mid4Non(b) {
  b.pd.flip = 150;
  for (let k = 0; ; k++) {
    Bullets.ring(b.x, b.y, D.n(20), k * 0.17, D.s(1.8), 'arrow', 'cyan', { rev: true });
    yield 30;
    Bullets.fan(b.x, b.y, D.pick(3, 3, 5, 5), aimAngle(b.x, b.y), 0.4, D.s(2.6), 'orb', 'blue');
    yield 40;
    if (k % 2) yield* wander(b, 50);
  }
}

// --- 中ボス 夢札：逆兆「凶と出た場所へ逃げなさい」---
// 見るからに不吉な「凶」の印。それ以外の場所すべてに吉の星が咲く。
function* mid4Spell(b) {
  yield* moveTo(b, FW / 2, 80, 30);
  b.tasks.add((function* () {
    for (let k = 0; ; k++) {
      Bullets.ring(b.x, b.y, D.n(16), k * 0.3, D.s(1.4), 'ring', 'cyan', { rev: true });
      yield D.pick(90, 70, 60, 50);
    }
  })());
  for (;;) {
    yield* omenField(D.pick(3, 3, 2, 2));
    yield D.pick(40, 30, 20, 20);
  }
}

// --- ボス 通常1：返し波・二重 ---
// 広がった白抜きの矢が、砂時計で一斉に引き返し、ボスを通り抜けて反対側へ。
function* b4Non1(b) {
  b.pd.flip = 120;
  for (let k = 0; ; k++) {
    Bullets.ring(b.x, b.y, D.n(22), k * 0.13, D.s(1.9), 'arrow', 'cyan', { rev: true });
    Bullets.ring(b.x, b.y, D.n(22), -k * 0.13 + 0.1, D.s(1.4), 'arrow', 'white', { rev: true });
    yield 36;
    Bullets.fan(b.x, b.y, D.pick(3, 5, 5, 7), aimAngle(b.x, b.y), 0.5, D.s(2.8), 'gem', 'red');
    yield 36;
    if (k % 2) yield* wander(b, 50);
  }
}

// --- 夢札1：逆流「天へ降る雨」---
// 上からも下からも、白抜きの雨が降る。砂時計が返ると、すべての雨が向きを変える。
// → 落ちてくる雨をくぐった直後、返ってくる雨をもう一度くぐることになる。
function* b4Spell1(b) {
  yield* moveTo(b, FW / 2, 70, 40);
  b.pd.flip = D.pick(180, 160, 150, 140);
  for (let f = 0; ; f++) {
    if (f % D.pick(5, 3, 3, 2) === 0) {
      const down = f % 2 === 0;
      const x = rand(0, FW);
      Bullets.shoot(x, down ? -6 : FH + 6, (down ? 1 : -1) * Math.PI / 2 + rand(-0.08, 0.08),
        D.s(rand(1.5, 2.1) * (down ? 1 : 0.7)), 'arrow', down ? 'cyan' : 'blue', { rev: true, bound: 12 });
    }
    if (f % 100 === 50) Bullets.fan(b.x, b.y, D.pick(3, 5, 5, 7), aimAngle(b.x, b.y), 0.5, D.s(2.5), 'orb', 'white');
    yield 1;
  }
}

// --- 通常2：こわい見かけ ---
// 大きく赤黒い弾が迫ってくる。でもそれは偽物（揺らめく・低速で透ける）。
// 本当に危ないのは、小さくきれいな宝石の渦。
function* b4Non2(b) {
  yield* moveTo(b, FW / 2, 100, 30);
  let rot = 0;
  for (let f = 0; ; f++) {
    if (f % D.pick(6, 5, 4, 4) === 0) {
      rot += 0.21;
      const arms = D.pick(3, 4, 5, 5);
      for (let i = 0; i < arms; i++) Bullets.shoot(b.x, b.y, rot + (TAU * i) / arms, D.s(2), 'gem', 'pink');
    }
    if (f % 70 === 0) {
      Bullets.fan(b.x, b.y, D.pick(3, 5, 5, 7), aimAngle(b.x, b.y), 0.9, D.s(1.8), 'big', 'red', { fake: true });
      Sound.play('bullet');
    }
    yield 1;
  }
}

// --- 夢札2：逆兆「大凶こそ吉日」---
// 「大凶」の印はひとつ（低難度は二つ）だけ。白抜きの矢の輪が、砂時計で行き来する中を逃げ込む。
function* b4Spell2(b) {
  yield* moveTo(b, FW / 2, 80, 40);
  b.pd.flip = D.pick(150, 130, 120, 110);
  b.tasks.add((function* () {
    for (let k = 0; ; k++) {
      Bullets.ring(b.x, b.y, D.n(18), k * 0.25, D.s(1.6), 'arrow', k % 2 ? 'white' : 'cyan', { rev: true });
      yield D.pick(60, 50, 44, 40);
    }
  })());
  for (;;) {
    yield* omenField(D.pick(2, 2, 1, 1), '大凶');
    yield D.pick(60, 40, 30, 20);
  }
}

// --- 夢札3：反転「天地返しの砂時計」---
// 画面が砂時計になる（斜めの壁）。砂はくびれを通って下の部屋へ広がる。
// 砂時計が返ると、砂はくびれを通って上の部屋へ戻っていく。
function* b4Spell3(b) {
  yield* moveTo(b, FW / 2, 70, 40);
  b.pd.flip = D.pick(200, 180, 170, 160);
  const WL = Game.bg.WL, neck = 18;
  const segs = [
    [0, 0, FW / 2 - neck, WL], [FW, 0, FW / 2 + neck, WL],
    [FW / 2 - neck, WL, 0, FH], [FW / 2 + neck, WL, FW, FH],
  ];
  let walls = [];
  const build = function* () {
    for (const [x1, y1, x2, y2] of segs) Effects.warnSeg(x1, y1, x2, y2, 60, 'silver');
    Sound.play('warn');
    yield 60;
    walls = [];
    for (const [x1, y1, x2, y2] of segs) {
      const n = Math.floor(dist(x1, y1, x2, y2) / 13);
      for (let i = 0; i <= n; i++) walls.push(Bullets.shoot(lerp(x1, x2, i / n), lerp(y1, y2, i / n), 0, 0, 'orb', 'silver', { delay: 12 }));
    }
  };
  yield* build();
  // 砂：くびれを通るたびに少し散る
  const sand = (s) => {
    const side = s.y > WL ? 1 : -1;
    if (s.side !== undefined && side !== s.side && Math.abs(s.x - FW / 2) < 40) s.ang += rand(-0.7, 0.7);
    s.side = side;
  };
  for (let f = 0; ; f++) {
    if (walls.some((w) => !w.alive)) { // 被弾で消えたら建て直す
      for (const w of walls) w.alive = false;
      yield* build();
    }
    if (f % D.pick(7, 5, 4, 3) === 0) {
      const a = angleTo(b.x, b.y, FW / 2 + rand(-8, 8), WL);
      Bullets.shoot(b.x, b.y, a, D.s(2), 'ring', 'gold', { rev: true, fn: sand });
    }
    if (f % 120 === 60) Bullets.fan(b.x, b.y, D.pick(1, 3, 3, 5), aimAngle(b.x, b.y), 0.2, D.s(2.6), 'orb', 'red');
    yield 1;
  }
}

// --- 最終夢札：逆夢「悪い夢ほど、朝はやさしい」---
// 白抜きの矢の二重螺旋、怖い見かけの偽物、ときどき咲く「凶」と「吉」。
// 削るほど砂時計は速く返るようになる。これまでの逆夢のすべて。
function* b4Last(b) {
  yield* moveTo(b, FW / 2, 100, 40);
  let rot = 0;
  for (let f = 1; ; f++) {
    const grow = 1 - b.hp / b.maxHp;
    b.pd.flip = Math.round(lerp(D.pick(220, 200, 190, 180), D.pick(150, 130, 115, 100), grow));
    if (f % D.pick(12, 10, 9, 8) === 0) {
      rot += 0.23;
      const arms = D.pick(3, 4, 5, 5);
      for (let i = 0; i < arms; i++) {
        Bullets.shoot(b.x, b.y, rot + (TAU * i) / arms, D.s(1.7), 'arrow', 'cyan', { rev: true });
        Bullets.shoot(b.x, b.y, -rot + (TAU * i) / arms + Math.PI / arms, D.s(1.5), 'arrow', 'white', { rev: true });
      }
    }
    if (f % 160 === 80) Bullets.fan(b.x, b.y, D.pick(3, 3, 5, 5), aimAngle(b.x, b.y), 0.8, D.s(2), 'big', 'red', { fake: true });
    if (f % 160 === 0) Bullets.fan(b.x, b.y, D.pick(3, 5, 5, 7), aimAngle(b.x, b.y), 0.4, D.s(2.6), 'gem', 'pink');
    if (f % 420 === 0) b.tasks.add(omenField(D.pick(3, 2, 2, 2)));
    yield 1;
  }
}

// ------------------------------------------------------------
//  ボス定義
// ------------------------------------------------------------
const MIDBOSS4 = {
  name: '逆夢の精霊', art: 'boss4', isMid: true, draw: drawSakayume,
  phases: [
    { hp: 1100, time: 25, fn: mid4Non },
    { hp: 1400, time: 35, spell: true, name: '逆兆「凶と出た場所へ逃げなさい」', bonus: 1300000, fn: mid4Spell },
  ],
};

const BOSS4 = {
  name: '逆夢の精霊', art: 'boss4', draw: drawSakayume,
  phases: [
    { hp: 2200, time: 30, fn: b4Non1 },
    { hp: 2600, time: 45, spell: true, name: '逆流「天へ降る雨」', bonus: 2200000, fn: b4Spell1 },
    { hp: 2300, time: 30, fn: b4Non2 },
    { hp: 2800, time: 45, spell: true, name: '逆兆「大凶こそ吉日」', bonus: 2400000, fn: b4Spell2 },
    { hp: 3000, time: 50, spell: true, name: '反転「天地返しの砂時計」', bonus: 2800000, fn: b4Spell3 },
    { hp: 4000, time: 60, spell: true, name: '逆夢「悪い夢ほど、朝はやさしい」', bonus: 3600000, fn: b4Last },
  ],
};

// セリフはあとで入れる。空のままなら会話はスキップされる。
const DIALOG4 = {
  midboss: [],
  boss: [],
  after: [],
};

// ------------------------------------------------------------
//  道中
// ------------------------------------------------------------
function* stage4Script() {
  const G = Game;
  yield 40;
  G.showBanner('第四夢　逆夢', '～ 悪い夢ほど、朝はやさしい');
  G.showBgm('水鏡の逆さ町（仮）');
  yield 140;
  G.notice = { text: '砂時計が返ると、白抜きの弾は逆走する', t: 200, col: '#9fe8ff' };

  // A：逆さ蝙蝠 ― 砂時計のルールを覚える
  for (let i = 0; i < 6; i++) { spawnBat(50 + i * 57, rand(60, 120)); yield 30; }
  yield 200;

  // B：昇り鯉 ― 下から来る
  for (let i = 0; i < 4; i++) { spawnKoi(i % 2 ? rand(220, 340) : rand(44, 164)); yield 50; }
  yield 120;

  // C：みくじ札 ― 凶の面を狙う
  spawnMikuji(90, 100, 0); yield 30; spawnMikuji(FW / 2, 80, 1); yield 30; spawnMikuji(294, 100, 0);
  yield 200;
  for (let i = 0; i < 4; i++) { spawnBat(rand(40, FW - 40), rand(60, 110)); yield 40; }
  yield* waitUntil(() => Enemies.list.length === 0, 600);
  yield 40;

  // D：逆さ灯籠
  spawnLantern(FW / 2);
  yield 240;
  for (let i = 0; i < 3; i++) { spawnKoi(rand(40, FW - 40)); yield 60; }
  yield* waitUntil(() => Enemies.list.length === 0, 500);
  yield 60;

  // 中ボス
  yield* bossFight(MIDBOSS4, { dialog: DIALOG4.midboss });
  yield 90;

  // E：鯉の滝登りと、札の並び
  for (let i = 0; i < 6; i++) { spawnKoi(30 + i * 64); yield 24; }
  yield 60;
  spawnMikuji(70, 90, 1); spawnMikuji(314, 90, 0);
  yield 160;
  for (let i = 0; i < 5; i++) { spawnBat(rand(40, FW - 40), rand(50, 130)); yield 30; }
  yield* waitUntil(() => Enemies.list.length === 0, 600);
  yield 30;

  // F：二つの灯籠
  spawnLantern(110); yield 90; spawnLantern(274);
  yield 200;
  for (let i = 0; i < 8; i++) { spawnBat(rand(30, FW - 30), rand(50, 140)); if (i % 3 === 1) spawnKoi(rand(40, FW - 40)); yield 34; }
  yield* waitUntil(() => Enemies.list.length === 0, 700);
  yield 120;

  // ボス
  yield* bossFight(BOSS4, { dialog: DIALOG4.boss, bgm: '逆夢の精霊　～ Reverse Omen（仮）' });
  yield 90;
  yield* G.dialog(DIALOG4.after);
  yield 60;
  G.stageClear();
}

const STAGE4 = {
  no: 4, name: '第四夢', title: '逆夢',
  leftoverRate: 0.11,
  nextHint: '第五夢「残夢」へ続く……',
  makeBg: () => new BgStage4(),
  script: stage4Script,
};
