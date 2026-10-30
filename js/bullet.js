'use strict';
// ============================================================
//  敵弾
// ============================================================
class Bullet {
  set(x, y, ang, spd, type, color, o) {
    const def = BTYPES[type];
    this.x = x; this.y = y; this.ang = ang; this.spd = spd;
    this.type = type; this.color = color; this.def = def; this.r = def.r;
    this.accel = 0; this.angVel = 0; this.maxSpd = 99; this.minSpd = -99;
    this.fn = null;        // 毎フレーム呼ばれる追加処理 fn(bullet)
    this.frame = 0;
    this.delay = 6;        // 出現フラッシュ中（当たり判定なし）
    this.alive = true; this.grazed = false;
    this.fake = false;     // 見た目だけの弾（当たらない）。揺らめき、低速移動中は透ける
    this.bless = false;    // 福の弾（当たらない。触れると得点＋まどろむ）
    this.rev = false;      // 砂時計が返ると逆走する（逆夢）
    this.noClear = false;  // フェーズ終了で消えない
    this.alpha = 1;
    this.jit = 0;          // 震え（悪夢の弾が化ける前触れ）
    this.rot = Math.random() * TAU; this.spin = def.spin || 0;
    this.bound = 32;       // 画面外に出て消えるまでの余白
    this.life = -1;
    if (o) Object.assign(this, o);
    return this;
  }
  update() {
    if (this.delay > 0) { this.delay--; return; }
    this.frame++;
    if (this.fn) { this.fn(this); if (!this.alive) return; }
    this.spd = clamp(this.spd + this.accel, this.minSpd, this.maxSpd);
    this.ang += this.angVel;
    this.x += Math.cos(this.ang) * this.spd;
    this.y += Math.sin(this.ang) * this.spd;
    this.rot += this.spin;
    if (this.life > 0 && this.frame >= this.life) this.alive = false;
    const b = this.bound;
    if (this.x < -b || this.x > FW + b || this.y < -b || this.y > FH + b) this.alive = false;
  }
  // 弾の種類・色を途中で変える
  retype(type, color) {
    this.type = type; this.def = BTYPES[type]; this.r = this.def.r;
    this.spin = this.def.spin || 0;
    if (color) this.color = color;
  }
}

const Bullets = {
  list: [],

  shoot(x, y, ang, spd, type = 'orb', color = 'red', o) {
    const b = new Bullet().set(x, y, ang, spd, type, color, o);
    this.list.push(b);
    return b;
  },
  ring(x, y, n, ang0, spd, type, color, o) {
    const out = [];
    for (let i = 0; i < n; i++) out.push(this.shoot(x, y, ang0 + (TAU * i) / n, spd, type, color, o));
    Sound.play('bullet');
    return out;
  },
  fan(x, y, n, ang, spread, spd, type, color, o) {
    const out = [];
    for (let i = 0; i < n; i++) {
      const a = n === 1 ? ang : ang - spread / 2 + (spread * i) / (n - 1);
      out.push(this.shoot(x, y, a, spd, type, color, o));
    }
    Sound.play('bullet');
    return out;
  },

  update() {
    for (const b of this.list) if (b.alive) b.update();
    this.list = this.list.filter((b) => b.alive);
  },

  // 全消去。toItems=true なら「夢の欠片」アイテムに変わる
  clear(toItems = true, force = true) {
    for (const b of this.list) {
      if (!b.alive || (b.noClear && !force)) continue;
      b.alive = false;
      if (toItems) Items.spawn('eat', b.x, b.y);
      else Effects.spark(b.x, b.y, b.color, 1, 0.6, 16, 1.5);
    }
    this.list = this.list.filter((b) => b.alive);
  },

  draw(c) {
    const ox = VIEW.ox * SCALE, oy = VIEW.oy * SCALE;
    for (const b of this.list) {
      const def = b.def, s = def.size, h = s / 2;
      const spr = Sprites.bullet(b.type, b.color);
      let sc = SCALE, alpha = b.alpha;
      if (b.delay > 0) { sc *= 1 + b.delay * 0.18; alpha *= 0.5; }
      if (b.fake) alpha *= Game.player.focused ? 0.22 : 0.75 + 0.2 * Math.sin(b.frame * 0.25);
      c.globalAlpha = alpha;
      let bx = b.x, by = b.y;
      if (b.jit) { bx += rand(-b.jit, b.jit); by += rand(-b.jit, b.jit); }
      if (def.oriented || def.spin) {
        const r = def.oriented ? b.ang : b.rot;
        const cs = Math.cos(r) * sc, sn = Math.sin(r) * sc;
        c.setTransform(cs, sn, -sn, cs, ox + bx * SCALE, oy + by * SCALE);
      } else {
        c.setTransform(sc, 0, 0, sc, ox + bx * SCALE, oy + by * SCALE);
      }
      c.drawImage(spr, -h, -h, s, s);
    }
    c.globalAlpha = 1;
    c.setTransform(SCALE, 0, 0, SCALE, ox, oy);
  },
};
