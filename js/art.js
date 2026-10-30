'use strict';
// ============================================================
//  キャラ絵の差し替え口
//  assets/ に画像を置いて、下の ART_MANIFEST のコメントを外すと
//  仮グラフィックの代わりにその画像が表示される。
// ============================================================
const ART_MANIFEST = {
  // player: 'assets/player.png',          // 自機（高さ40pxくらいで表示）
  // boss1: 'assets/boss1.png',            // 予知夢の精霊（高さ64px）
  // boss1_cutin: 'assets/boss1_cutin.png', // 夢札宣言時のカットイン立ち絵
  // boss2: 'assets/boss2.png',            // 悪夢の精霊
  // boss2_cutin: 'assets/boss2_cutin.png',
  // muma: 'assets/muma.png',              // 夢魔（第三夢の中ボス）
  // muma_cutin: 'assets/muma_cutin.png',
  // boss3: 'assets/boss3.png',            // 吉夢の精霊
  // boss3_cutin: 'assets/boss3_cutin.png',
  // boss4: 'assets/boss4.png',            // 逆夢の精霊
  // boss4_cutin: 'assets/boss4_cutin.png',
};

const Art = {
  imgs: {},
  init() {
    for (const [k, src] of Object.entries(ART_MANIFEST)) {
      const im = new Image();
      im.src = src;
      this.imgs[k] = im;
    }
  },
  get(k) {
    const im = this.imgs[k];
    return im && im.complete && im.naturalWidth > 0 ? im : null;
  },
  // 中心 (x, y) に高さ h で描く
  draw(c, im, x, y, h) {
    const w = (im.naturalWidth / im.naturalHeight) * h;
    c.drawImage(im, x - w / 2, y - h / 2, w, h);
  },
};
