'use strict';
// ============================================================
//  敵・ボスの土台
// ============================================================
class Enemy {
  constructor(x, y, o = {}) {
    this.x = x; this.y = y; this.vx = 0; this.vy = 0;
    this.hp = 10; this.r = 12; this.alive = true; this.frame = 0;
    this.tasks = new Tasks();
    this.drops = { power: 1 }; this.score = 1000;
    this.draw = null; this.entered = false; this.hitT = 0; this.invuln = 0;
    this.onDeath = null; this.boss = false; this.bodyHit = true;
    Object.assign(this, o);
    this.maxHp = this.hp;
  }
  run(genFn) { this.tasks.add(genFn(this)); return this; }
  update() {
    this.frame++;
    if (this.hitT > 0) this.hitT--;
    if (this.invuln > 0) this.invuln--;
    this.tasks.update();
    this.x += this.vx; this.y += this.vy;
    const inside = this.x > -8 && this.x < FW + 8 && this.y > -8 && this.y < FH + 8;
    if (inside) this.entered = true;
    else if (this.entered && (this.x < -60 || this.x > FW + 60 || this.y < -60 || this.y > FH + 60)) this.alive = false;
    if (this.frame > 3600) this.alive = false;
  }
  damage(d) {
    if (this.invuln > 0 || !this.alive) return;
    this.hp -= d; this.hitT = 3;
    Game.addScore(10);
    Sound.play('hit');
    if (this.hp <= 0) this.kill();
  }
  kill() {
    if (!this.alive) return;
    this.alive = false;
    Game.addScore(this.score);
    if (this.drops) for (const [type, n] of Object.entries(this.drops)) Items.scatter(type, n, this.x, this.y, 12);
    Effects.spark(this.x, this.y, '#ffffff', 10, 3, 26, 2);
    Effects.ring(this.x, this.y, '#d8ccff', 36, 20);
    Sound.play('kill');
    Game.player.addGauge(0.6);
    if (this.onDeath) this.onDeath(this);
  }
}

// ---- ボス：フェーズ（通常弾幕 / 夢札）を順番にこなす ----
class Boss extends Enemy {
  constructor(def) {
    super(FW / 2, -48, { hp: 1, r: 16, score: 0, drops: null, draw: def.draw });
    this.def = def; this.name = def.name; this.phases = def.phases; this.isMid = !!def.isMid;
    this.boss = true; this.started = false;
    this.pi = -1; this.timer = 0; this.timerMax = 1; this.trans = 0;
    this.capture = true; // 被弾・ボム無しで夢札取得
    this.pd = {};        // フェーズ中の描画用データ（時計盤など）
    this.home = { x: FW / 2, y: 96 };
    this.fled = false;
  }
  get phase() { return this.phases[this.pi]; }
  begin() { this.started = true; this.nextPhase(); }
  nextPhase() {
    this.pi++;
    if (this.pi >= this.phases.length) { this.defeat(); return; }
    const p = this.phase;
    this.hp = this.maxHp = p.hp;
    this.timer = this.timerMax = p.time * 60;
    this.capture = true; this.pd = {};
    this.tasks.clear();
    this.invuln = p.spell ? 60 : 20;
    if (p.spell) Game.declareSpell(this, p);
    this.tasks.add(p.fn(this));
  }
  endPhase(timeout) {
    const p = this.phase;
    Game.endPhase(this, p, timeout);
    Bullets.clear(true);
    Effects.clearWarns();
    this.tasks.clear(); this.pd = {};
    if (!timeout || p.survival) {
      Items.scatter('power', p.spell ? 6 : 3, this.x, this.y, 30);
      Items.scatter('point', p.spell ? 6 : 3, this.x, this.y, 30);
    }
    Effects.ring(this.x, this.y, '#ffffff', 90, 30, 3);
    Sound.play('kill');
    const last = this.pi >= this.phases.length - 1;
    this.fled = last && timeout && !p.survival;
    this.trans = last ? 1 : 50;
  }
  damage(d) {
    if (!this.started || this.trans > 0 || this.pi < 0 || this.pi >= this.phases.length || this.invuln > 0) return;
    if (this.phase.survival) return; // 耐久夢札：時間まで耐える
    this.hp -= d; this.hitT = 3;
    Game.addScore(10);
    Sound.play('hit');
    if (this.hp <= 0) { this.hp = 0; this.endPhase(false); }
  }
  update() {
    this.frame++;
    if (this.hitT > 0) this.hitT--;
    if (this.invuln > 0) this.invuln--;
    if (this.trans > 0) {
      this.trans--;
      this.vx = this.vy = 0;
      this.x = lerp(this.x, this.home.x, 0.06); this.y = lerp(this.y, this.home.y, 0.06);
      if (this.trans === 0) this.nextPhase();
      return;
    }
    this.tasks.update();
    this.x += this.vx; this.y += this.vy;
    if (this.started && this.pi >= 0 && this.pi < this.phases.length) {
      this.timer--;
      if (this.timer <= 600 && this.timer % 60 === 0) Sound.play('tick');
      if (this.timer <= 0) this.endPhase(true);
    }
  }
  defeat() {
    this.alive = false;
    if (this.fled) {
      Effects.spark(this.x, this.y, '#d8ccff', 20, 3, 30, 2);
    } else {
      Effects.flash(this.x, this.y, 160, '#ffffff', 40);
      for (let i = 0; i < 4; i++) Effects.ring(this.x, this.y, '#ffe6a0', 80 + i * 60, 30 + i * 10, 3);
      Effects.spark(this.x, this.y, '#ffd27a', 60, 6, 60, 3);
      Sound.play('bosskill');
    }
    Bullets.clear(true);
    Game.onBossDefeated(this);
  }
}

const Enemies = {
  list: [],
  add(e) { this.list.push(e); return e; },
  update() {
    for (const e of this.list) if (e.alive) e.update();
    this.list = this.list.filter((e) => e.alive);
  },
  draw(c) {
    for (const e of this.list) {
      if (e.draw) e.draw(c, e);
      if (e.hitT > 0) {
        c.save(); c.globalCompositeOperation = 'lighter';
        glow(c, e.x, e.y, e.r * 1.4, '#ffffff', 0.3);
        c.restore();
      }
    }
  },
};

// ---- 動き・狙いのヘルパー ----
function* moveTo(e, x, y, frames, ease = easeOutCubic) {
  e.vx = e.vy = 0;
  const sx = e.x, sy = e.y;
  for (let i = 1; i <= frames; i++) {
    const t = ease(i / frames);
    e.x = lerp(sx, x, t); e.y = lerp(sy, y, t);
    yield 1;
  }
}

function* wander(b, frames = 60) {
  const p = Game.player;
  const tx = clamp(p.x + rand(-50, 50), 70, FW - 70);
  const ty = rand(64, 112);
  yield* moveTo(b, tx, ty, frames, easeInOutSine);
}

// 自機を直接狙う
function aimAngle(x, y) {
  return angleTo(x, y, Game.player.x, Game.player.y);
}

// 自機の「これから行く場所」を狙う（予知夢の基本）
function leadAngle(x, y, spd) {
  const p = Game.player;
  let tx = p.x, ty = p.y;
  for (let i = 0; i < 2; i++) {
    const t = dist(x, y, tx, ty) / Math.max(spd, 0.1);
    tx = clamp(p.x + p.vx * t, 0, FW);
    ty = clamp(p.y + p.vy * t, 0, FH);
  }
  return angleTo(x, y, tx, ty);
}

// ボス戦の流れ：登場 → 会話 → BGM表示 → 戦闘 → 撃破待ち
function* bossFight(def, opt = {}) {
  const b = Enemies.add(new Boss(def));
  Game.boss = b;
  yield* moveTo(b, b.home.x, b.home.y, 70);
  if (opt.dialog) yield* Game.dialog(opt.dialog);
  if (opt.bgm) Game.showBgm(opt.bgm);
  b.begin();
  yield* waitUntil(() => !b.alive);
}
