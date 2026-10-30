'use strict';
// ============================================================
//  自機：夢から生まれた獏
//   夢かじり（グレイズ）→ 満腹ゲージ → 満腹（ショット強化）
//   獏喰（ボム）… 周囲の弾を夢ごと食べる
// ============================================================
const BOMB_TIME = 160;
const FULL_TIME = 600;     // 満腹の持続（10秒）
const DEATHBOMB_FRAMES = 9; // 被弾後この間に X で喰らいボム

class Player {
  constructor() {
    this.x = FW / 2; this.y = FH - 48; this.vx = 0; this.vy = 0;
    this.r = 2.4;        // 当たり判定
    this.grazeR = 20;    // 夢かじり判定
    this.power = 1; this.lives = 2; this.bombs = 3;
    this.state = 'alive'; // alive / dying / dead / respawn / gone
    this.invuln = 120; this.deathT = 0; this.respawnT = 0;
    this.shotT = 0; this.bombT = 0; this.bombR = 0;
    this.graze = 0; this.gauge = 0; this.fullT = 0;
    this.drowse = 0;     // まどろみ 0〜1（福を受け取ると増え、動きが遅くなる）
    this.trail = [];     // 過去の位置（予知夢・残夢の弾幕が使う）
    this.shots = [];
    this.focusT = 0; this.frame = 0;
  }

  get focused() { return Input.held('focus'); }
  get options() { return clamp(Math.floor(this.power), 1, 4); }
  get isFull() { return this.fullT > 0; }

  update() {
    this.frame++;
    if (this.invuln > 0) this.invuln--;
    if (this.drowse > 0) this.drowse = Math.max(0, this.drowse - 0.003);
    this.focusT = lerp(this.focusT, this.focused ? 1 : 0, 0.25);
    if (this.fullT > 0) {
      this.fullT--;
      this.gauge = (100 * this.fullT) / FULL_TIME;
    }

    switch (this.state) {
      case 'alive':
        this.move(); this.tryShoot(); this.tryBomb();
        break;
      case 'dying':
        this.vx = this.vy = 0;
        if (this.tryBomb()) this.state = 'alive';
        else if (--this.deathT <= 0) Game.playerDie();
        break;
      case 'dead':
        this.vx = this.vy = 0;
        if (--this.respawnT <= 0) { this.state = 'respawn'; this.x = FW / 2; this.y = FH + 24; this.respawnT = 40; }
        break;
      case 'respawn':
        this.vx = 0; this.vy = 0;
        this.y = lerp(this.y, FH - 48, 0.12);
        if (--this.respawnT <= 0) this.state = 'alive';
        break;
    }

    if (this.state !== 'dead' && this.state !== 'gone') {
      this.trail.push({ x: this.x, y: this.y });
      if (this.trail.length > 900) this.trail.shift();
    }

    if (this.bombT > 0) {
      this.bombT--;
      const t = 1 - this.bombT / BOMB_TIME;
      this.bombR = 300 * easeOutCubic(Math.min(1, t * 3)) * (this.bombT < 20 ? this.bombT / 20 : 1);
    } else this.bombR = 0;

    for (const s of this.shots) {
      s.x += s.vx; s.y += s.vy;
      if (s.y < -24 || s.x < -24 || s.x > FW + 24) s.dead = true;
    }
    this.shots = this.shots.filter((s) => !s.dead);
  }

  move() {
    let dx = 0, dy = 0;
    if (Input.held('left')) dx--;
    if (Input.held('right')) dx++;
    if (Input.held('up')) dy--;
    if (Input.held('down')) dy++;
    const sp = (this.focused ? 1.9 : 4.3) * (1 - this.drowse * 0.55);
    const k = dx && dy ? Math.SQRT1_2 : 1;
    const nx = clamp(this.x + dx * sp * k, 8, FW - 8);
    const ny = clamp(this.y + dy * sp * k, 16, FH - 14);
    this.vx = nx - this.x; this.vy = ny - this.y;
    this.x = nx; this.y = ny;
  }

  optionPos() {
    const n = this.options, out = [];
    for (let i = 0; i < n; i++) {
      const t = n === 1 ? 0 : (i / (n - 1)) * 2 - 1;
      const ux = t * 34, uy = n === 1 ? 14 : 8 - Math.abs(t) * 6;
      const fx = t * 14, fy = -20;
      const dx = lerp(ux, fx, this.focusT), dy = lerp(uy, fy, this.focusT);
      out.push({ x: this.x + dx, y: this.y + dy, dx });
    }
    return out;
  }

  tryShoot() {
    if (this.shotT > 0) { this.shotT--; return; }
    if (!Input.held('shot') || Game.dlg) return;
    this.shotT = 3;
    const mul = this.isFull ? 1.5 : 1;
    const main = this.isFull ? 'pfull' : 'pmain';
    this.shots.push({ x: this.x - 6, y: this.y - 10, vx: 0, vy: -20, dmg: 3 * mul, spr: main });
    this.shots.push({ x: this.x + 6, y: this.y - 10, vx: 0, vy: -20, dmg: 3 * mul, spr: main });
    const f = this.focused;
    for (const o of this.optionPos()) {
      const a = f ? -Math.PI / 2 : -Math.PI / 2 + o.dx * 0.008;
      this.shots.push({ x: o.x, y: o.y, vx: Math.cos(a) * 16, vy: Math.sin(a) * 16, dmg: (f ? 2.6 : 2) * mul, spr: 'popt' });
    }
    Sound.play('shot');
  }

  tryBomb() {
    if (!Input.pressed('bomb') || this.bombs <= 0 || this.bombT > 0 || Game.dlg) return false;
    this.bombs--;
    this.bombT = BOMB_TIME;
    this.drowse = 0;
    this.invuln = Math.max(this.invuln, BOMB_TIME + 40);
    Game.onBomb();
    Sound.play('bomb');
    return true;
  }

  hit() {
    if (this.invuln > 0 || this.state !== 'alive' || this.bombT > 0) return;
    this.state = 'dying';
    this.deathT = DEATHBOMB_FRAMES;
    Effects.flash(this.x, this.y, 30, '#ffffff', 12);
  }

  addGauge(v) {
    if (this.fullT > 0) return;
    this.gauge = Math.min(100, this.gauge + v);
    if (this.gauge >= 100) { this.fullT = FULL_TIME; Game.onFull(); }
  }

  // ---- 描画 ----
  draw(c) {
    if (this.state === 'dead' || this.state === 'gone') return;
    for (const o of this.optionPos()) {
      glow(c, o.x, o.y, 9, this.isFull ? '#ffd27a' : '#c9a8ff', 0.5);
      circle(c, o.x, o.y, 3, '#ffffff');
    }
    const blink = this.invuln > 0 && (this.frame >> 2) % 2 === 0;
    if (blink) return;
    c.save();
    c.translate(this.x, this.y);
    const img = Art.get('player');
    if (img) Art.draw(c, img, 0, 0, 40);
    else this.drawBaku(c);
    if (this.drowse > 0.05) { // まどろみ：金色のもやと「z」
      glow(c, 0, 0, 26, '#ffd970', this.drowse * 0.45);
      c.font = `bold 9px ${FONT_SANS}`; c.textAlign = 'center';
      for (let i = 0; i < 2; i++) {
        const t = ((this.frame + i * 40) % 80) / 80;
        c.fillStyle = hexA('#fff3c8', Math.min(1, this.drowse * 1.5) * (1 - t));
        c.fillText('z', 10 + t * 8, -12 - t * 16);
      }
    }
    c.restore();
  }

  // 仮グラフィック：白黒模様の獏（キャラデザが来たら art.js で差し替え）
  drawBaku(c) {
    const t = this.frame;
    c.save(); c.rotate(t * 0.03);
    c.strokeStyle = 'rgba(190,170,255,0.35)'; c.lineWidth = 1; c.setLineDash([3, 5]);
    c.beginPath(); c.arc(0, 0, 16, 0, TAU); c.stroke(); c.setLineDash([]);
    c.restore();
    glow(c, 0, 0, 20, this.isFull ? '#ffd27a' : '#b9a4ff', 0.35);
    ellipse(c, 0, 3, 8, 10, '#2e2850');   // 体
    ellipse(c, 0, 5, 7.2, 5, '#f3efff');  // 白い鞍模様
    circle(c, 0, -7, 6, '#2e2850');       // 頭
    c.strokeStyle = '#2e2850'; c.lineWidth = 3; c.lineCap = 'round';
    c.beginPath(); c.moveTo(0, -9); c.quadraticCurveTo(0, -15, 2 * Math.sin(t * 0.1), -16); c.stroke(); // 鼻
    circle(c, -4.5, -11, 2.2, '#2e2850'); circle(c, 4.5, -11, 2.2, '#2e2850');
    circle(c, -4.5, -11, 1, '#f3efff'); circle(c, 4.5, -11, 1, '#f3efff');
    circle(c, -2.3, -7, 1, '#ffffff'); circle(c, 2.3, -7, 1, '#ffffff');
  }

  drawBomb(c) {
    if (this.bombT <= 0 || this.bombR < 1) return;
    const r = this.bombR, t = this.frame;
    c.save();
    c.translate(this.x, this.y);
    c.globalCompositeOperation = 'lighter';
    const g = c.createRadialGradient(0, 0, r * 0.2, 0, 0, r);
    g.addColorStop(0, 'rgba(120,90,255,0)');
    g.addColorStop(0.85, 'rgba(150,110,255,0.12)');
    g.addColorStop(1, 'rgba(220,200,255,0.35)');
    c.fillStyle = g; c.beginPath(); c.arc(0, 0, r, 0, TAU); c.fill();
    c.strokeStyle = 'rgba(230,215,255,0.6)'; c.lineWidth = 2;
    c.beginPath();
    for (let i = 0; i <= 64; i++) {
      const a = (TAU * i) / 64, rr = r + Math.sin(a * 8 + t * 0.3) * 4;
      if (i) c.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); else c.moveTo(Math.cos(a) * rr, Math.sin(a) * rr);
    }
    c.stroke();
    c.globalCompositeOperation = 'source-over';
    c.globalAlpha = Math.min(1, this.bombT / 40) * 0.25;
    c.fillStyle = '#e8dcff'; c.font = `bold 90px ${FONT_SERIF}`;
    c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillText('獏', 0, 0);
    c.restore();
  }

  drawShots(c) {
    for (const s of this.shots) {
      const p = Sprites.pshot(s.spr);
      c.drawImage(p.img, s.x - p.w / 2, s.y - p.h / 2, p.w, p.h);
    }
  }

  drawHitbox(c) {
    if (this.state === 'dead' || this.state === 'gone' || this.focusT < 0.05) return;
    c.save();
    c.globalAlpha = this.focusT;
    c.translate(this.x, this.y);
    c.save(); c.rotate(this.frame * 0.05);
    c.strokeStyle = 'rgba(210,190,255,0.8)'; c.lineWidth = 1.2;
    for (let i = 0; i < 4; i++) { c.beginPath(); c.arc(0, 0, 20, (i * TAU) / 4, (i * TAU) / 4 + 0.9); c.stroke(); }
    c.restore();
    circle(c, 0, 0, this.r + 1.6, '#ff3060');
    circle(c, 0, 0, this.r + 0.4, '#ffffff');
    c.restore();
  }
}
