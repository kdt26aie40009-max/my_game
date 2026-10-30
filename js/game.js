'use strict';
// ============================================================
//  ゲーム本体：シーン管理・当たり判定・UI・メインループ
// ============================================================
const STAGES = [STAGE1, STAGE2, STAGE3, STAGE4, STAGE5, STAGE6];
const EXTENDS = [5000000, 12000000, 25000000, 40000000];

const Game = {
  canvas: null, ctx: null, scene: 'title', frame: 0, menu: 0, lastDiff: 1, practice: false,
  startIdx: 0, lastStage: 0,
  cheat: false, cheated: false, ctrlTaps: [], // 無敵（Ctrl を3回）
  player: null, score: 0, hiScore: 0,
  stage: null, stageIdx: 0, stageTasks: null, bg: null,
  boss: null, spellUI: null, result: null, banner: null, bgm: null, notice: null, cutin: null,
  dlg: null, overlay: null, leftovers: [], extendIdx: 0, continues: 0, eaten: 0,
  shake: 0, whiteFlash: 0, clearT: 0, clearInfo: null,
  fps: 60, fpsCount: 0, fpsTime: 0,

  // ---------------- 起動 ----------------
  init() {
    this.canvas = document.getElementById('game');
    this.canvas.width = W * SCALE; this.canvas.height = H * SCALE;
    this.ctx = this.canvas.getContext('2d');
    Input.init();
    Art.init();
    this.fit();
    addEventListener('resize', () => this.fit());
    this.titleStars = Array.from({ length: 160 }, () => ({ x: rand(0, W), y: rand(0, H), s: rand(0.5, 1.8), tw: rand(0, TAU) }));
    this.panelStars = Array.from({ length: 40 }, () => ({ x: rand(FX + FW + 8, W), y: rand(0, H), s: rand(0.5, 1.5) }));
    this.loop();
  },
  fit() {
    const s = Math.min(innerWidth / W, innerHeight / H);
    this.canvas.style.width = W * s + 'px';
    this.canvas.style.height = H * s + 'px';
  },
  loop() {
    let last = performance.now(), acc = 0;
    const step = 1000 / 60;
    const tick = (now) => {
      acc += Math.min(now - last, 100); last = now;
      let n = 0;
      while (acc >= step && n < 4) { this.update(); Input.endFrame(); acc -= step; n++; this.fpsCount++; }
      if (n === 4) acc = 0;
      if (now - this.fpsTime >= 1000) { this.fps = (this.fpsCount * 1000) / (now - this.fpsTime); this.fpsCount = 0; this.fpsTime = now; }
      this.draw();
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  },

  // ---------------- 保存 ----------------
  loadJSON(k, def) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : def; } catch (e) { return def; } },
  saveJSON(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* 保存できない環境は無視 */ } },
  loadHi(lv) { return this.loadJSON('mugen_hi_' + lv, 0); },
  saveHi() {
    if (this.practice || this.startIdx > 0 || this.cheated) return; // 途中の面から・無敵を使ったプレイは記録しない
    if (this.score > this.loadHi(D.lv)) this.saveJSON('mugen_hi_' + D.lv, Math.floor(this.score));
  },
  spellHist(name) {
    const all = this.loadJSON('mugen_spells', {});
    return all[D.lv + ':' + name] || { get: 0, tries: 0 };
  },
  saveSpellHist(name, h) {
    const all = this.loadJSON('mugen_spells', {});
    all[D.lv + ':' + name] = h;
    this.saveJSON('mugen_spells', all);
  },

  // ---------------- ゲーム開始 ----------------
  // si = 始める面（練習モードでは途中の面から）
  newGame(lv, si = 0) {
    D.lv = lv;
    this.startIdx = si; this.cheated = this.cheat;
    this.score = 0; this.hiScore = this.loadHi(lv);
    this.player = new Player();
    if (lv === 0) this.player.lives = 3;
    if (si > 0) this.player.power = Math.min(4, 1 + si * 1.5); // 途中の面から始めるときの霊力
    this.extendIdx = 0; this.continues = 0; this.eaten = 0;
    this.resetField();
    this.startStage(si);
    this.scene = 'game';
  },
  resetField() {
    Bullets.list = []; Enemies.list = []; Items.list = []; Effects.parts = []; Effects.warns = [];
    this.leftovers = []; this.boss = null; this.spellUI = null; this.result = null; this.banner = null;
    this.bgm = null; this.notice = null; this.cutin = null; this.dlg = null; this.overlay = null;
    this.shake = 0; this.whiteFlash = 0;
  },
  nextStage() {
    this.resetField();
    const p = this.player;
    p.x = FW / 2; p.y = FH - 48; p.vx = p.vy = 0; p.invuln = 120;
    p.shots = []; p.trail = []; p.bombT = 0; p.bombR = 0;
    this.startStage(this.stageIdx + 1);
  },
  startStage(i) {
    this.stageIdx = i;
    this.stage = STAGES[i];
    this.bg = this.stage.makeBg();
    this.stageTasks = new Tasks();
    this.stageTasks.add(this.stage.script());
  },
  toTitle() {
    this.saveHi();
    this.scene = 'title'; this.menu = 0; this.overlay = null;
  },
  after(frames, fn) {
    this.stageTasks.add((function* () { yield frames; fn(); })());
  },

  // ---------------- 更新 ----------------
  update() {
    this.frame++;
    if (Input.pressed('mute')) Sound.muted = !Sound.muted;
    if (Input.pressed('skip')) this.ctrlTap();
    switch (this.scene) {
      case 'title': this.updateTitle(); break;
      case 'diff': this.updateDiff(); break;
      case 'stagesel': this.updateStageSel(); break;
      case 'howto':
        if (Input.pressed('shot') || Input.pressed('bomb')) { this.scene = 'title'; Sound.play('cancel'); }
        break;
      case 'game': this.updateGame(); break;
    }
  },
  // Ctrl を 0.75 秒以内に3回押すと無敵の ON / OFF
  ctrlTap() {
    this.ctrlTaps = this.ctrlTaps.filter((f) => this.frame - f < 45);
    this.ctrlTaps.push(this.frame);
    if (this.ctrlTaps.length < 3) return;
    this.ctrlTaps = [];
    this.cheat = !this.cheat;
    if (this.cheat) this.cheated = true;
    Sound.play(this.cheat ? 'extend' : 'cancel');
    this.notice = { text: this.cheat ? '無敵モード ON' : '無敵モード OFF', t: 120, col: '#ff9ad9' };
  },
  nav(n) {
    if (Input.pressed('up')) { this.menu = (this.menu + n - 1) % n; Sound.play('select'); }
    if (Input.pressed('down')) { this.menu = (this.menu + 1) % n; Sound.play('select'); }
  },
  titleItems() { return ['はじめる', '練習（夢を選ぶ）', '操作方法', 'サウンド：' + (Sound.muted ? 'OFF' : 'ON')]; },
  updateTitle() {
    this.nav(4);
    if (Input.pressed('shot')) {
      Sound.play('ok');
      if (this.menu <= 1) { this.practice = this.menu === 1; this.scene = 'diff'; this.menu = this.lastDiff; }
      else if (this.menu === 2) this.scene = 'howto';
      else Sound.muted = !Sound.muted;
    }
  },
  updateDiff() {
    this.nav(4);
    if (Input.pressed('bomb')) { this.scene = 'title'; this.menu = this.practice ? 1 : 0; Sound.play('cancel'); return; }
    if (Input.pressed('shot')) {
      this.lastDiff = this.menu; Sound.play('ok');
      this.scene = 'stagesel'; this.menu = this.lastStage;
    }
  },
  updateStageSel() {
    this.nav(STAGES.length);
    if (Input.pressed('bomb')) { this.scene = 'diff'; this.menu = this.lastDiff; Sound.play('cancel'); return; }
    if (Input.pressed('shot')) { Sound.play('ok'); this.lastStage = this.menu; this.newGame(this.lastDiff, this.menu); }
  },

  updateGame() {
    if (this.overlay) { this.updateOverlay(); return; }
    if (Input.pressed('pause')) { this.overlay = 'pause'; this.menu = 0; Sound.play('pause'); return; }

    this.bg.update(!!this.spellUI);
    if (this.dlg) this.updateDialog();
    this.stageTasks.update();
    this.player.update();
    Enemies.update();
    Bullets.update();
    Items.update();
    Effects.update();
    this.updateLeftovers();
    this.collide();

    if (this.banner && ++this.banner.t > 260) this.banner = null;
    if (this.bgm && ++this.bgm.t > 360) this.bgm = null;
    if (this.result && --this.result.t <= 0) this.result = null;
    if (this.notice && --this.notice.t <= 0) this.notice = null;
    if (this.cutin && ++this.cutin.t > 90) this.cutin = null;
    if (this.spellUI) this.spellUI.t++;
    if (this.whiteFlash > 0) this.whiteFlash--;
    if (this.shake > 0) this.shake--;
    this.checkExtend();
  },

  updateOverlay() {
    const o = this.overlay;
    if (o === 'pause') {
      this.nav(3);
      if (Input.pressed('pause') || Input.pressed('bomb')) { this.overlay = null; Sound.play('cancel'); return; }
      if (Input.pressed('shot')) {
        Sound.play('ok');
        if (this.menu === 0) this.overlay = null;
        else if (this.menu === 1) { this.saveHi(); this.newGame(D.lv); }
        else this.toTitle();
      }
    } else if (o === 'gameover') {
      this.nav(2);
      if (Input.pressed('shot')) {
        Sound.play('ok');
        if (this.menu === 0) this.continueGame(); else this.toTitle();
      }
    } else if (o === 'clear') {
      this.clearT++;
      this.bg.update(false);
      Effects.update();
      if (this.clearT > 60 && Input.pressed('shot')) {
        Sound.play('ok');
        if (this.nextStageDef()) this.nextStage(); else this.toTitle();
      }
    }
  },

  continueGame() {
    this.saveHi();
    const p = this.player;
    this.continues++;
    this.score = this.continues; // 東方式：コンティニューすると得点の一の位が回数になる
    p.lives = 2; p.bombs = 3;
    p.state = 'dead'; p.respawnT = 1; p.invuln = 200;
    this.overlay = null;
  },

  updateDialog() {
    const d = this.dlg;
    d.t++;
    if ((Input.pressed('shot') && d.t > 8) || Input.held('skip')) {
      d.i++; d.t = 0;
      if (d.i >= d.lines.length) this.dlg = null;
    }
  },
  *dialog(lines) {
    if (!lines || !lines.length) return;
    this.dlg = { lines, i: 0, t: 0 };
    while (this.dlg) yield 1;
  },

  // ---------------- 当たり判定 ----------------
  collide() {
    const p = this.player;

    // 自機ショット → 敵
    for (const s of p.shots) {
      if (s.dead) continue;
      for (const e of Enemies.list) {
        if (!e.alive || e.y < -10) continue;
        const dx = s.x - e.x, dy = s.y - e.y, rr = e.r + 5;
        if (dx * dx + dy * dy < rr * rr) {
          e.damage(s.dmg);
          s.dead = true;
          Effects.spark(s.x, s.y, '#cfe8ff', 1, 1.5, 10, 1.5);
          break;
        }
      }
    }

    // 獏喰：範囲内の弾を食べる＆敵にダメージ
    if (p.bombT > 0 && p.bombR > 4) {
      const r2 = p.bombR * p.bombR;
      for (const b of Bullets.list) {
        if (!b.alive) continue;
        const dx = b.x - p.x, dy = b.y - p.y;
        if (dx * dx + dy * dy < r2) this.eatBullet(b);
      }
      for (const e of Enemies.list) {
        if (e.alive && dist(e.x, e.y, p.x, p.y) < p.bombR + e.r) e.damage(e.boss ? 1.6 : 3);
      }
    }

    if (p.state !== 'alive') return;

    // 敵弾 → 自機（被弾・夢かじり）
    const gr = p.grazeR;
    for (const b of Bullets.list) {
      if (!b.alive || b.delay > 0 || b.fake) continue;
      const dx = b.x - p.x, dy = b.y - p.y, d2 = dx * dx + dy * dy;
      if (b.bless) { // 福は当たらない。触れると受け取る
        const br = p.r + b.r + 4;
        if (d2 < br * br) this.onBless(b);
        continue;
      }
      const hr = p.r + b.r;
      if (d2 < hr * hr) {
        if (p.invuln <= 0 && p.bombT <= 0) { p.hit(); return; }
      } else if (!b.grazed && p.invuln <= 0 && d2 < (gr + b.r) * (gr + b.r)) {
        b.grazed = true;
        this.onGraze(b);
      }
    }
    // 敵本体 → 自機
    for (const e of Enemies.list) {
      if (e.alive && e.bodyHit && p.invuln <= 0 && p.bombT <= 0 && dist(e.x, e.y, p.x, p.y) < e.r * 0.55 + p.r) { p.hit(); return; }
    }
  },

  eatBullet(b) {
    b.alive = false;
    Items.spawn('eat', b.x, b.y);
    this.player.addGauge(0.12);
    this.eaten++;
    // 夢幻異変：食べた夢が消えずに戻ってくる
    if (!b.bless && Math.random() < this.stage.leftoverRate) this.leftovers.push({ x: b.x, y: b.y, type: b.type, color: b.color, t: 240 });
  },
  updateLeftovers() {
    for (const l of this.leftovers) {
      l.t--;
      if (l.t === 40) Effects.twinkle(l.x, l.y, 40, 'purple');
      if (l.t <= 0) {
        Bullets.shoot(l.x, l.y, aimAngle(l.x, l.y), D.s(1.3), l.type, l.color);
        Effects.ring(l.x, l.y, 'purple', 24, 18);
      }
    }
    this.leftovers = this.leftovers.filter((l) => l.t > 0);
  },

  onGraze(b) {
    const p = this.player;
    p.graze++;
    this.addScore(500);
    p.addGauge(1.4);
    if (this.bg.onGraze) this.bg.onGraze();
    Effects.spark((p.x + b.x) / 2, (p.y + b.y) / 2, '#ffffff', 2, 2, 12, 1.2);
    Sound.play('graze');
  },
  onBless(b) {
    const p = this.player;
    b.alive = false;
    const v = p.isFull ? 15000 : 10000;
    this.addScore(v);
    Effects.popup(b.x, b.y - 6, fmt(v), '#ffe68a');
    Effects.spark(b.x, b.y, '#ffd970', 4, 1.5, 16, 1.5);
    p.drowse = Math.min(1, p.drowse + 0.1);
    Sound.play('bless');
    if (this.stage.onBless) this.stage.onBless(b);
  },
  onFull() {
    this.notice = { text: '満腹！　ショット強化', t: 120, col: '#ffd27a' };
    Effects.ring(this.player.x, this.player.y, '#ffd27a', 70, 30, 3);
    Sound.play('full');
  },
  onBomb() {
    if (this.boss && this.spellUI) this.boss.capture = false;
    this.shake = 10;
    Items.autoAll();
    if (this.bg.onBomb) this.bg.onBomb();
  },

  playerDie() {
    const p = this.player;
    Sound.play('death');
    this.shake = 20;
    Effects.ring(p.x, p.y, '#ffffff', 120, 40, 3);
    Effects.spark(p.x, p.y, '#e0d0ff', 30, 5, 50, 3);
    if (this.boss && this.spellUI) this.boss.capture = false;
    if (this.bg.onMiss) this.bg.onMiss();
    p.drowse = 0;
    p.power = Math.max(1, p.power - 0.5);
    for (let i = 0; i < 6; i++) Items.spawn('power', p.x + rand(-30, 30), p.y - 10, { vy: -rand(3, 5), vx: rand(-1.5, 1.5) });
    Bullets.clear(false);
    p.gauge = p.fullT > 0 ? 0 : p.gauge * 0.5; p.fullT = 0;
    p.lives--;
    p.bombs = 3;
    p.state = 'dead'; p.respawnT = 30; p.invuln = 220;
    if (p.lives < 0) {
      p.state = 'gone';
      this.after(60, () => { this.overlay = 'gameover'; this.menu = 0; });
    }
  },

  collect(it) {
    const p = this.player;
    switch (it.type) {
      case 'power':
      case 'bigpower': {
        const before = Math.floor(p.power);
        if (p.power >= 4) this.addScore(5000);
        p.power = Math.min(4, Math.round((p.power + (it.type === 'bigpower' ? 1 : 0.05)) * 100) / 100);
        if (Math.floor(p.power) > before) Effects.popup(p.x, p.y - 20, p.power >= 4 ? 'Full Power!' : 'Power Up', '#ff9a8a');
        this.addScore(10);
        Sound.play('power');
        break;
      }
      case 'point': {
        let v = it.auto || it.y < POC_LINE ? 50000 : Math.floor(lerp(50000, 8000, clamp((it.y - POC_LINE) / (FH - POC_LINE), 0, 1)) / 10) * 10;
        if (p.isFull) v = Math.floor(v * 1.5);
        this.addScore(v);
        Effects.popup(it.x, it.y - 6, fmt(v), v >= 50000 ? '#ffe68a' : '#cfd8ff');
        Sound.play('item');
        break;
      }
      case 'eat': this.addScore(p.isFull ? 200 : 100); break;
      case 'bomb': p.bombs = Math.min(8, p.bombs + 1); Sound.play('extend'); break;
      case 'life': p.lives = Math.min(8, p.lives + 1); Sound.play('extend'); break;
    }
  },

  addScore(n) {
    this.score += n;
    if (this.score > this.hiScore) this.hiScore = this.score;
  },
  checkExtend() {
    while (this.extendIdx < EXTENDS.length && this.score >= EXTENDS[this.extendIdx]) {
      this.extendIdx++;
      this.player.lives = Math.min(8, this.player.lives + 1);
      this.notice = { text: 'Extend!!', t: 120, col: '#ff9ad9' };
      Sound.play('extend');
    }
  },

  // ---------------- ボス・夢札 ----------------
  declareSpell(boss, p) {
    const hist = this.spellHist(p.name);
    hist.tries++;
    this.saveSpellHist(p.name, hist);
    this.spellUI = { name: p.name, bonus: p.bonus * [0.5, 1, 1.5, 2][D.lv], t: 0, hist };
    this.cutin = { t: 0, boss };
    Effects.flash(boss.x, boss.y, 120, '#ffffff', 30);
    Sound.play('spell');
  },
  currentBonus() {
    const b = this.boss, s = this.spellUI;
    if (!b || !s) return 0;
    if (b.phase && b.phase.survival) return s.bonus;
    return Math.floor((s.bonus * (0.35 + (0.65 * b.timer) / b.timerMax)) / 10) * 10;
  },
  endPhase(boss, p, timeout) {
    if (!p.spell || !this.spellUI) return;
    const s = this.spellUI;
    if (boss.capture && (p.survival ? timeout : !timeout)) {
      const bonus = this.currentBonus();
      this.addScore(bonus);
      s.hist.get++;
      this.saveSpellHist(p.name, s.hist);
      this.result = { text: '夢札取得！', sub: 'Bonus ' + fmt(bonus), t: 150, good: true };
      Sound.play('capture');
    } else {
      this.result = { text: '取得失敗', sub: timeout && !p.survival ? '時間切れ' : '', t: 120, good: false };
    }
    this.spellUI = null;
    this.cutin = null;
  },
  onBossDefeated(b) {
    this.boss = null;
    this.spellUI = null;
    if (!b.fled) {
      this.shake = 30;
      this.whiteFlash = b.isMid ? 10 : 30;
      Items.spawn(b.isMid ? 'bigpower' : 'bomb', b.x, b.y);
      Items.scatter('point', b.isMid ? 8 : 16, b.x, b.y, 40);
    }
  },

  nextStageDef() { return this.practice ? null : STAGES[this.stageIdx + 1] || null; },
  stageClear() {
    const p = this.player;
    const clear = 1000000 * (D.lv + 1);
    const life = p.lives * 500000;
    const bomb = p.bombs * 100000;
    const total = clear + life + bomb;
    this.addScore(total);
    this.clearInfo = { clear, life, bomb, total };
    this.overlay = 'clear'; this.clearT = 0;
    this.saveHi();
  },

  showBanner(main, sub) { this.banner = { main, sub, t: 0 }; },
  showBgm(name) { this.bgm = { name, t: 0 }; },

  // ============================================================
  //  描画
  // ============================================================
  draw() {
    const c = this.ctx;
    c.setTransform(SCALE, 0, 0, SCALE, 0, 0);
    c.globalAlpha = 1; c.globalCompositeOperation = 'source-over';
    c.textBaseline = 'alphabetic';
    if (this.scene === 'game') this.drawGame(c);
    else this.drawTitle(c);
  },

  drawGame(c) {
    this.drawPanel(c);

    const sx = this.shake ? rand(-1, 1) * Math.min(4, this.shake * 0.3) : 0;
    const sy = this.shake ? rand(-1, 1) * Math.min(4, this.shake * 0.3) : 0;
    VIEW.ox = FX + sx; VIEW.oy = FY + sy;

    c.save();
    c.beginPath(); c.rect(FX, FY, FW, FH); c.clip();
    c.translate(VIEW.ox, VIEW.oy);

    this.bg.draw(c);
    const b = this.boss;
    if (b && b.alive && b.trans === 0 && b.phase && b.phase.draw) b.phase.draw(c, b);
    if (this.cutin) this.drawCutin(c);
    this.player.drawBomb(c);
    Enemies.draw(c);
    this.player.draw(c);
    this.player.drawShots(c);
    Effects.drawWarns(c);
    Bullets.draw(c);
    Items.draw(c);
    Effects.draw(c);
    if (this.bg.drawOver) this.bg.drawOver(c); // 弾より上にかかる演出（悪夢の暗転など）
    this.player.drawHitbox(c);

    this.drawBossUI(c);
    this.drawSpellUI(c);
    this.drawTexts(c);
    this.drawDialog(c);
    if (this.whiteFlash > 0) { c.fillStyle = `rgba(255,255,255,${this.whiteFlash / 40})`; c.fillRect(0, 0, FW, FH); }
    if (this.overlay) this.drawOverlay(c);
    c.restore();

    c.strokeStyle = 'rgba(200,180,255,0.55)'; c.lineWidth = 1;
    c.strokeRect(FX - 0.5, FY - 0.5, FW + 1, FH + 1);
    if (b && b.alive && !b.pd.hideMarker) { // フィールド下のボス位置マーカー
      c.fillStyle = '#ff7a9a'; c.font = `bold 9px ${FONT_SANS}`; c.textAlign = 'center';
      c.fillText('ENEMY', FX + clamp(b.x, 12, FW - 12), FY + FH + 11);
    }
  },

  drawPanel(c) {
    const g = c.createLinearGradient(0, 0, W, H);
    g.addColorStop(0, '#1a1036'); g.addColorStop(1, '#0a0a1e');
    c.fillStyle = g; c.fillRect(0, 0, W, H);
    c.fillStyle = '#cfc4ff';
    for (const s of this.panelStars) {
      c.globalAlpha = 0.25 + 0.25 * Math.sin(this.frame * 0.03 + s.x);
      c.fillRect(s.x, s.y, s.s, s.s);
    }
    c.globalAlpha = 1;

    const p = this.player, x = 440, xr = 628;
    const label = (t, y) => { c.textAlign = 'left'; c.font = `13px ${FONT_SERIF}`; c.fillStyle = '#bfb3e6'; c.fillText(t, x, y); };
    const value = (t, y, col) => { c.textAlign = 'right'; c.font = `bold 14px ${FONT_SANS}`; c.fillStyle = col || '#ffffff'; c.fillText(t, xr, y); };

    const df = DIFFS[D.lv];
    c.strokeStyle = df.color; c.lineWidth = 1; c.strokeRect(x + 0.5, 20.5, xr - x - 1, 22);
    c.fillStyle = df.color; c.textAlign = 'center'; c.font = `bold 13px ${FONT_SERIF}`;
    c.fillText(`${df.name}  ${df.en}`, (x + xr) / 2, 36);

    label('最高得点', 72); value(fmt(Math.max(this.hiScore, this.score)), 72, '#cfc4ff');
    label('得点', 94); value(fmt(this.score), 94);

    label('残機', 130);
    for (let i = 0; i < Math.min(8, p.lives); i++) {
      c.fillStyle = '#ff7ad9'; starPath(c, x + 66 + i * 15, 125, 6.5, 2.8); c.fill();
    }
    label('獏喰', 154);
    for (let i = 0; i < Math.min(8, p.bombs); i++) {
      c.fillStyle = '#5fe39a';
      c.beginPath(); const cx = x + 66 + i * 15, cy = 149;
      c.moveTo(cx, cy - 6); c.lineTo(cx + 5, cy); c.lineTo(cx, cy + 6); c.lineTo(cx - 5, cy); c.closePath(); c.fill();
    }

    label('霊力', 190); value(p.power.toFixed(2) + ' / 4.00', 190, '#ff9a8a');
    label('夢かじり', 212); value(String(p.graze), 212, '#9fe8ff');

    label(p.isFull ? '満腹！' : '満腹ゲージ', 236);
    const bx = x, by = 243, bw = xr - x;
    c.fillStyle = 'rgba(255,255,255,0.08)'; c.fillRect(bx, by, bw, 8);
    const gg = c.createLinearGradient(bx, 0, bx + bw, 0);
    gg.addColorStop(0, '#8a6bff'); gg.addColorStop(1, p.isFull ? '#ffd27a' : '#e0a8ff');
    c.fillStyle = gg; c.fillRect(bx, by, (bw * p.gauge) / 100, 8);
    if (p.isFull && (this.frame >> 3) % 2) { c.strokeStyle = '#ffd27a'; c.strokeRect(bx - 0.5, by - 0.5, bw + 1, 9); }
    if (this.cheat) {
      c.textAlign = 'left'; c.font = `bold 12px ${FONT_SANS}`; c.fillStyle = (this.frame >> 4) % 2 ? '#ff7a9a' : '#ffb0c8';
      c.fillText('無敵モード（Ctrl×3で解除）', x, 318);
    }
    if (this.stage.drowse) {
      label('まどろみ', 278);
      c.fillStyle = 'rgba(255,255,255,0.08)'; c.fillRect(bx, 285, bw, 6);
      c.fillStyle = '#ffd970'; c.fillRect(bx, 285, bw * p.drowse, 6);
    }

    // ロゴ
    c.save();
    c.textAlign = 'center';
    c.shadowColor = '#a080ff'; c.shadowBlur = 16;
    c.fillStyle = '#f4eeff'; c.font = `bold 44px ${FONT_SERIF}`;
    c.fillText('夢幻物語', 534, 362);
    c.restore();
    c.textAlign = 'center'; c.fillStyle = '#b9a8e8'; c.font = `italic 12px ${FONT_SERIF}`;
    c.fillText('～ Mugen Monogatari ～', 534, 386);
    c.fillStyle = '#8a7cc0'; c.font = `11px ${FONT_SERIF}`;
    c.fillText(`体験版　${this.stage.name}「${this.stage.title}」`, 534, 410);
    c.textAlign = 'right'; c.font = `10px ${FONT_SANS}`; c.fillStyle = '#6f66a0';
    c.fillText(this.fps.toFixed(1) + 'fps', 632, 474);
  },

  drawBossUI(c) {
    const b = this.boss;
    if (!b || !b.alive || !b.started) return;
    const x0 = 8, x1 = FW - 40, y = 8;
    c.fillStyle = 'rgba(0,0,0,0.45)'; c.fillRect(x0, y - 1, x1 - x0, 4);
    const ratio = b.trans > 0 ? 0 : Math.max(0, b.hp / b.maxHp);
    const g = c.createLinearGradient(x0, 0, x1, 0);
    g.addColorStop(0, '#ff7ad9'); g.addColorStop(1, '#ffe6a0');
    c.fillStyle = g; c.fillRect(x0, y - 1, (x1 - x0) * ratio, 4);

    c.save();
    c.shadowColor = '#000'; c.shadowBlur = 4;
    c.textAlign = 'left'; c.font = `12px ${FONT_SERIF}`; c.fillStyle = '#efe8ff';
    c.fillText(b.name, 8, 24);
    const nw = c.measureText(b.name).width;
    const remain = b.phases.length - 1 - b.pi;
    for (let i = 0; i < remain; i++) { c.fillStyle = '#ffd27a'; starPath(c, 8 + nw + 12 + i * 11, 20, 4.5, 2); c.fill(); }
    const sec = Math.max(0, Math.ceil(b.timer / 60));
    c.textAlign = 'right'; c.font = `bold 16px ${FONT_SANS}`;
    c.fillStyle = sec <= 10 ? '#ff7a8a' : '#ffffff';
    c.fillText(String(sec).padStart(2, '0'), FW - 8, 17);
    c.restore();
  },

  drawSpellUI(c) {
    const s = this.spellUI;
    if (!s) return;
    const k = easeOutCubic(Math.min(1, s.t / 50));
    const y = lerp(FH - 90, 44, k);
    c.save();
    c.font = `bold 14px ${FONT_SERIF}`;
    const w = c.measureText(s.name).width;
    const g = c.createLinearGradient(FW - w - 70, 0, FW, 0);
    g.addColorStop(0, 'rgba(40,10,70,0)'); g.addColorStop(1, 'rgba(40,10,70,0.75)');
    c.fillStyle = g; c.fillRect(FW - w - 70, y - 15, w + 70, 21);
    c.textAlign = 'right'; c.fillStyle = '#ffffff';
    c.shadowColor = '#ff6fd0'; c.shadowBlur = 8;
    c.fillText(s.name, FW - 8, y);
    c.shadowBlur = 0;
    if (s.t > 50) {
      const bonusText = this.boss && this.boss.capture ? 'Bonus ' + fmt(this.currentBonus()) : 'Bonus Failed';
      c.font = `11px ${FONT_SANS}`; c.fillStyle = '#ffe6a0';
      c.fillText(`${bonusText}　取得履歴 ${s.hist.get}/${s.hist.tries}`, FW - 8, y + 16);
    }
    c.restore();
  },

  drawCutin(c) {
    const ct = this.cutin, t = ct.t;
    const a = t < 15 ? t / 15 : t > 70 ? (90 - t) / 20 : 1;
    c.save();
    c.globalAlpha = a * 0.85;
    c.translate(FW / 2, FH * 0.42); c.rotate(-0.18);
    const g = c.createLinearGradient(-FW, 0, FW, 0);
    g.addColorStop(0, 'rgba(60,20,100,0)'); g.addColorStop(0.5, 'rgba(60,20,100,0.7)'); g.addColorStop(1, 'rgba(60,20,100,0)');
    c.fillStyle = g; c.fillRect(-FW, -34, FW * 2, 68);
    c.strokeStyle = 'rgba(255,214,140,0.6)'; c.lineWidth = 1;
    c.beginPath(); c.moveTo(-FW, -34); c.lineTo(FW, -34); c.moveTo(-FW, 34); c.lineTo(FW, 34); c.stroke();
    const img = Art.get(ct.boss.def.art + '_cutin');
    const slide = lerp(80, -20, easeOutCubic(Math.min(1, t / 60)));
    if (img) Art.draw(c, img, slide + 60, 0, 160);
    c.fillStyle = 'rgba(255,240,255,0.9)'; c.font = `bold 26px ${FONT_SERIF}`; c.textAlign = 'center';
    c.fillText(ct.boss.name, slide, 10);
    c.restore();
  },

  drawTexts(c) {
    c.save();
    c.textAlign = 'center';
    if (this.banner) {
      const t = this.banner.t;
      c.globalAlpha = t < 40 ? t / 40 : t > 200 ? Math.max(0, (260 - t) / 60) : 1;
      c.shadowColor = '#9a7bff'; c.shadowBlur = 14;
      c.fillStyle = '#ffffff'; c.font = `bold 30px ${FONT_SERIF}`;
      c.fillText(this.banner.main, FW / 2, FH * 0.38);
      c.shadowBlur = 6; c.fillStyle = '#d8ccff'; c.font = `14px ${FONT_SERIF}`;
      c.fillText(this.banner.sub, FW / 2, FH * 0.38 + 30);
      c.globalAlpha = 1; c.shadowBlur = 0;
    }
    if (this.bgm) {
      const t = this.bgm.t;
      c.globalAlpha = t < 30 ? t / 30 : t > 300 ? Math.max(0, (360 - t) / 60) : 1;
      c.textAlign = 'right'; c.fillStyle = '#e6dcff'; c.font = `12px ${FONT_SERIF}`;
      c.fillText('♪ ' + this.bgm.name, FW - 10, FH - 10);
      c.globalAlpha = 1; c.textAlign = 'center';
    }
    if (this.result) {
      const r = this.result;
      c.globalAlpha = Math.min(1, r.t / 30);
      c.shadowColor = r.good ? '#ffb000' : '#000'; c.shadowBlur = 12;
      c.fillStyle = r.good ? '#ffe6a0' : '#b0a8c8'; c.font = `bold 24px ${FONT_SERIF}`;
      c.fillText(r.text, FW / 2, 130);
      c.font = `bold 14px ${FONT_SANS}`; c.fillText(r.sub, FW / 2, 154);
      c.globalAlpha = 1; c.shadowBlur = 0;
    }
    if (this.notice) {
      const n = this.notice;
      c.globalAlpha = Math.min(1, n.t / 30);
      c.fillStyle = n.col; c.font = `bold 18px ${FONT_SERIF}`;
      c.shadowColor = '#000'; c.shadowBlur = 6;
      c.fillText(n.text, FW / 2, 200);
      c.globalAlpha = 1; c.shadowBlur = 0;
    }
    c.restore();
  },

  drawDialog(c) {
    const d = this.dlg;
    if (!d) return;
    const L = d.lines[d.i];
    const x = 16, y = FH - 104, w = FW - 32, h = 88;
    c.save();
    c.fillStyle = 'rgba(10,6,30,0.8)'; c.fillRect(x, y, w, h);
    c.strokeStyle = 'rgba(200,180,255,0.6)'; c.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
    const right = L.side === 'right';
    c.font = `bold 13px ${FONT_SERIF}`;
    c.textAlign = right ? 'right' : 'left';
    c.fillStyle = right ? '#ffd27a' : '#c9b8ff';
    c.fillText(L.name || '', right ? x + w - 12 : x + 12, y + 20);
    c.textAlign = 'left'; c.font = `13px ${FONT_SERIF}`; c.fillStyle = '#ffffff';
    wrapText(c, L.text || '', w - 24).forEach((ln, i) => c.fillText(ln, x + 12, y + 42 + i * 18));
    c.restore();
  },

  drawOverlay(c) {
    c.save();
    c.fillStyle = 'rgba(5,3,15,0.65)'; c.fillRect(0, 0, FW, FH);
    c.textAlign = 'center';
    const menu = (items, y0) => items.forEach((t, i) => {
      const sel = i === this.menu;
      c.font = `${sel ? 'bold ' : ''}16px ${FONT_SERIF}`;
      c.fillStyle = sel ? '#ffe6a0' : '#9a90c0';
      c.fillText((sel ? '◆ ' : '') + t, FW / 2, y0 + i * 30);
    });
    c.shadowColor = '#9a7bff'; c.shadowBlur = 12;
    if (this.overlay === 'pause') {
      c.fillStyle = '#fff'; c.font = `bold 26px ${FONT_SERIF}`; c.fillText('一時停止', FW / 2, 170);
      c.shadowBlur = 0;
      menu(['再開する', '最初からやり直す', 'タイトルへ戻る'], 220);
    } else if (this.overlay === 'gameover') {
      c.fillStyle = '#fff'; c.font = `bold 26px ${FONT_SERIF}`; c.fillText('夢から醒めてしまった……', FW / 2, 170);
      c.shadowBlur = 0;
      c.fillStyle = '#a89ed0'; c.font = `12px ${FONT_SANS}`; c.fillText('コンティニューすると得点はリセットされます', FW / 2, 196);
      menu(['コンティニュー', 'タイトルへ戻る'], 240);
    } else if (this.overlay === 'clear') {
      const ci = this.clearInfo;
      c.fillStyle = '#ffe6a0'; c.font = `bold 26px ${FONT_SERIF}`;
      c.fillText(this.stage.clearTitle || `${this.stage.name}　${this.stage.title}　踏破`, FW / 2, 120);
      c.shadowBlur = 0;
      c.font = `14px ${FONT_SANS}`; c.fillStyle = '#ffffff';
      const rows = [['クリアボーナス', ci.clear], ['残機ボーナス', ci.life], ['獏喰ボーナス', ci.bomb], ['合計', ci.total]];
      rows.forEach(([k, v], i) => {
        c.textAlign = 'left'; c.fillText(k, 80, 170 + i * 24);
        c.textAlign = 'right'; c.fillText(fmt(v), FW - 80, 170 + i * 24);
      });
      c.textAlign = 'center';
      c.fillStyle = '#c9b8ff'; c.font = `14px ${FONT_SERIF}`;
      const next = this.nextStageDef();
      if (next) c.fillText(`夢はさらに深く――　${next.name}「${next.title}」へ`, FW / 2, 310);
      else if (this.practice) c.fillText('― 練習おわり ―', FW / 2, 310);
      else if (this.stage.ending) this.stage.ending.forEach((ln, i) => c.fillText(ln, FW / 2, 282 + i * 21));
      else {
        c.fillText('― 体験版はここまで ―', FW / 2, 300);
        c.fillText(this.stage.nextHint || '', FW / 2, 322);
      }
      if (this.clearT > 60 && (this.frame >> 4) % 2) { c.fillStyle = '#fff'; c.fillText(next ? 'Z で次の夢へ' : 'Z でタイトルへ', FW / 2, 370); }
    }
    c.restore();
  },

  // ---------------- タイトル画面 ----------------
  drawTitle(c) {
    const t = this.frame;
    const g = c.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#05061a'); g.addColorStop(0.6, '#171440'); g.addColorStop(1, '#30214f');
    c.fillStyle = g; c.fillRect(0, 0, W, H);
    c.fillStyle = '#e6e8ff';
    for (const s of this.titleStars) {
      c.globalAlpha = 0.3 + 0.6 * (0.5 + 0.5 * Math.sin(t * 0.04 + s.tw));
      c.fillRect(s.x, s.y, s.s, s.s);
    }
    c.globalAlpha = 1;

    // 月と天球儀
    glow(c, W * 0.76, H * 0.25, 120, '#fff0d0', 0.25);
    circle(c, W * 0.76, H * 0.25, 34, '#fff6e2');
    c.save();
    c.translate(W * 0.7, H * 0.52);
    c.strokeStyle = 'rgba(190,180,255,0.16)'; c.lineWidth = 1;
    c.rotate(t * 0.002);
    for (const r of [190, 160, 100]) { c.beginPath(); c.arc(0, 0, r, 0, TAU); c.stroke(); }
    starPath(c, 0, 0, 160, 70, 6); c.stroke();
    c.rotate(-t * 0.005);
    c.beginPath(); c.ellipse(0, 0, 180, 60, 0.4, 0, TAU); c.stroke();
    c.beginPath(); c.ellipse(0, 0, 180, 60, -0.8, 0, TAU); c.stroke();
    c.restore();

    c.save();
    c.textAlign = 'left';
    c.shadowColor = '#9a7bff'; c.shadowBlur = 24;
    c.fillStyle = '#f6f0ff'; c.font = `bold 72px ${FONT_SERIF}`;
    c.fillText('夢幻物語', 48, 150);
    c.shadowBlur = 8;
    c.fillStyle = '#c8b8ff'; c.font = `italic 15px ${FONT_SERIF}`;
    c.fillText('～ Mugen Monogatari : The Dream-Eater\'s Night', 54, 182);
    c.restore();

    c.textAlign = 'left';
    if (this.scene === 'title') {
      this.titleItems().forEach((s, i) => {
        const sel = i === this.menu;
        c.font = `${sel ? 'bold ' : ''}20px ${FONT_SERIF}`;
        c.fillStyle = sel ? '#ffe6a0' : '#8f86b8';
        c.fillText((sel ? '◆ ' : '　') + s, 80, 280 + i * 36);
      });
    } else if (this.scene === 'diff') {
      c.fillStyle = '#d8ccff'; c.font = `14px ${FONT_SERIF}`;
      c.fillText('夢の深さを選んでください', 60, 236);
      DIFFS.forEach((d, i) => {
        const sel = i === this.menu, y = 272 + i * 46;
        c.globalAlpha = sel ? 1 : 0.5;
        c.fillStyle = d.color; c.font = `bold 20px ${FONT_SERIF}`;
        c.fillText((sel ? '◆ ' : '　') + d.name, 60, y);
        c.font = `12px ${FONT_SANS}`; c.fillStyle = '#ffffff';
        c.fillText(`${d.en}　${d.desc}`, 86, y + 18);
        c.textAlign = 'right'; c.fillStyle = '#cfc4ff';
        c.fillText('最高得点 ' + fmt(this.loadHi(i)), 430, y);
        c.textAlign = 'left';
      });
      c.globalAlpha = 1;
    } else if (this.scene === 'stagesel') {
      c.fillStyle = '#d8ccff'; c.font = `14px ${FONT_SERIF}`;
      c.fillText(this.practice ? `練習する夢を選んでください（${DIFFS[this.lastDiff].name}）`
        : `どの夢から始めますか（${DIFFS[this.lastDiff].name}・そのまま最後まで続きます）`, 60, 236);
      STAGES.forEach((st, i) => {
        const sel = i === this.menu;
        c.globalAlpha = sel ? 1 : 0.5;
        c.fillStyle = sel ? '#ffe6a0' : '#cfc4ff'; c.font = `bold 18px ${FONT_SERIF}`;
        c.fillText(`${sel ? '◆ ' : '　'}${st.name}　${st.title}`, 60, 272 + i * 30);
      });
      c.globalAlpha = 1;
      if (this.menu > 0 && !this.practice) {
        c.fillStyle = '#8f86b8'; c.font = `12px ${FONT_SANS}`;
        c.fillText('※ 途中の夢から始めたときは、ハイスコアに記録されません', 60, 446);
      }
      c.globalAlpha = 1;
    } else if (this.scene === 'howto') {
      c.fillStyle = 'rgba(10,6,30,0.75)'; c.fillRect(40, 210, 560, 236);
      c.strokeStyle = 'rgba(200,180,255,0.5)'; c.strokeRect(40.5, 210.5, 559, 235);
      const lines = [
        ['移動', '矢印キー　　　低速移動：Shift（当たり判定が見える）'],
        ['ショット', 'Z　　　獏喰（ボム）：X　　　ポーズ：Esc　　　ミュート：M'],
        ['夢かじり', '弾にかすると夢を少しかじる。満腹ゲージが溜まる'],
        ['満腹', 'ゲージ満タンで10秒間ショット強化・得点アップ'],
        ['獏喰', '周りの弾を夢ごと食べて消す。被弾直後に押すと喰らいボム'],
        ['食べ残し', 'この異変では、食べた夢の一部があとで戻ってくる……'],
        ['予告', '光の線・きらめきは「これから起きること」。明るいほど近い'],
        ['悪夢', '闇は少しずつ迫る。弾をかすめて悪夢をかじると押し返せる'],
        ['福', '金の銭は当たらない。取ると得点、ただし眠くなって遅くなる'],
        ['砂時計', '返ると白抜きの弾が逆走する。「凶」の印の中は安全'],
        ['回収', '画面上部へ行くとアイテムを自動回収'],
      ];
      lines.forEach(([k, v], i) => {
        c.font = `bold 14px ${FONT_SERIF}`; c.fillStyle = '#ffe6a0'; c.fillText(k, 60, 230 + i * 19.5);
        c.font = `13px ${FONT_SANS}`; c.fillStyle = '#ffffff'; c.fillText(v, 150, 230 + i * 19.5);
      });
    }

    c.textAlign = 'center'; c.fillStyle = '#8078a8'; c.font = `12px ${FONT_SANS}`;
    c.fillText('↑↓：選択　　Z：決定　　X：戻る　　M：ミュート', W / 2, H - 14);
    if (this.cheat) {
      c.textAlign = 'right'; c.fillStyle = '#ff7a9a'; c.font = `bold 12px ${FONT_SANS}`;
      c.fillText('無敵モード ON', W - 12, 20);
    }
  },
};

function wrapText(c, text, maxW) {
  const out = [];
  for (const para of text.split('\n')) {
    let line = '';
    for (const ch of para) {
      if (c.measureText(line + ch).width > maxW) { out.push(line); line = ch; }
      else line += ch;
    }
    out.push(line);
  }
  return out;
}

addEventListener('load', () => Game.init());
