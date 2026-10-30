'use strict';
// ============================================================
//  アイテム
//   power/bigpower … 霊力   point … 得点   bomb … 獏喰+1   life … 残機+1
//   eat … 食べた夢の欠片（弾消しで出る。自動で吸い寄せられる）
// ============================================================
const POC_LINE = 128; // アイテム回収ライン：これより上に行くと P・点などを全部吸い寄せる（点は最大得点）
const POC_SHOW = 300;  // 面の開始時に線を見せる長さ（5秒）

const Items = {
  list: [],

  spawn(type, x, y, o) {
    const it = { type, x, y, vx: rand(-0.6, 0.6), vy: -rand(1.5, 2.6), auto: false, frame: 0, dead: false };
    if (type === 'eat') { it.vx = rand(-1, 1); it.vy = -rand(0.5, 1.2); }
    if (o) Object.assign(it, o);
    this.list.push(it);
    return it;
  },
  scatter(type, n, x, y, spread = 24) {
    for (let i = 0; i < n; i++) this.spawn(type, x + rand(-spread, spread), y + rand(-spread, spread));
  },
  autoAll() { for (const it of this.list) it.auto = true; },

  update() {
    const p = Game.player;
    const alive = p.state === 'alive';
    const poc = alive && p.y < POC_LINE;
    for (const it of this.list) {
      it.frame++;
      if (poc) it.auto = true;
      if (alive && (it.auto || (it.type === 'eat' && it.frame > 12))) {
        const a = angleTo(it.x, it.y, p.x, p.y), sp = it.type === 'eat' ? 10 : 9;
        it.x += Math.cos(a) * sp; it.y += Math.sin(a) * sp;
      } else {
        it.vy = Math.min(it.vy + 0.06, 2.4);
        it.vx *= 0.96;
        it.x += it.vx; it.y += it.vy;
      }
      if (alive && dist(it.x, it.y, p.x, p.y) < (it.auto ? 16 : 22)) {
        it.dead = true;
        Game.collect(it);
      }
      if (it.y > FH + 20) it.dead = true;
    }
    this.list = this.list.filter((it) => !it.dead);
  },

  draw(c) {
    for (const it of this.list) {
      const s = ITEM_SIZE[it.type];
      const spr = Sprites.item(it.type);
      if (it.y < -s / 2) { // 画面上にはみ出した物は位置だけ表示
        c.globalAlpha = 0.6; c.drawImage(spr, it.x - s / 4, 2, s / 2, s / 2); c.globalAlpha = 1;
      } else {
        c.drawImage(spr, it.x - s / 2, it.y - s / 2, s, s);
      }
    }
  },
};
