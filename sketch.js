// --- 設定 ---
let balls = [];
const MAX_BALLS = 150;     // 粒の数
const SPAWN_INTERVAL = 2;  // 生成間隔（フレーム）
const SPEED = 6;           // 基本落下速度
const SIZE = 2;            // 粒の直径
const R = SIZE / 2;

// 傘（描画＆衝突）
const canopyR = 70; // 天蓋の半径（大きめ）
const stemH  = 80;  // 柄の長さ
const hookR  = 20;  // フック半径

// スライド関連
const SLIDE_SPEED = SPEED * 0.9;
const EDGE_EPS = 0.02;

// --- 風パラメータ ---
let wind = 0;                 // 現在の風（+右向き、px/フレーム）
let windT = 0;                // ノイズ時間
const WIND_MAX = 3.0;         // 風の最大強度
const WIND_NOISE_INC = 0.005; // 風の時間変化の速さ
const WIND_RESP = 0.05;       // 目標風への追従（スムージング）
const WIND_PULL = 0.02;       // 粒が風へ寄る強さ（落下中）
const SLIDE_WIND_GAIN = 0.15; // 傘上の接線移動に加える風の寄与

function setup() {
  createCanvas(windowWidth, windowHeight);
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
  for (let b of balls) b.x = constrain(b.x, 0, width);
}

function spawnBall() {
  balls.push({
    x: random(width),
    y: 0,
    vx: 0,
    vy: SPEED,
    mode: "fall",  // "fall" or "slide"
    theta: null,   // スライド時の角度 [PI, TWO_PI]
    side: 0        // -1: 左側へ滑る, +1: 右側へ滑る
  });
}

function draw() {
  // 背景（残像）
  background(0, 0, 0, 75);

  // --- 風を更新（Perlin noiseでゆっくり変化） ---
  windT += WIND_NOISE_INC;
  const targetWind = map(noise(windT), 0, 1, -WIND_MAX, WIND_MAX);
  wind = lerp(wind, targetWind, WIND_RESP);

  // マウスのXに傘を追従（最下部固定）
  const umbrellaCX = constrain(mouseX || width / 2, 0, width);
  const umbrellaCY = height - stemH;

  // 時間差でスポーン
  if (balls.length < MAX_BALLS && frameCount % SPAWN_INTERVAL === 0) {
    spawnBall();
  }

  noStroke();
  fill(255);

  for (let b of balls) {
    if (b.mode === "slide") {
      // ---- 円弧上を滑走（角度で位置を更新）----
      // 基本の滑り
      let dTheta = b.side * (SLIDE_SPEED / (canopyR + R));
      // 風の接線成分を角速度に加える
      // 接線ベクトル t = (-sinθ, cosθ)、風ベクトル w = (wind, 0)
      // 接線方向への寄与 s = dot(w, t) = wind * (-sinθ)
      const s = wind * (-Math.sin(b.theta));
      dTheta += (s * SLIDE_WIND_GAIN) / (canopyR + R);

      b.theta += dTheta;

      // 位置：中心 + (半径+粒半径) * (cosθ, sinθ)
      b.x = umbrellaCX + (canopyR + R) * Math.cos(b.theta);
      b.y = umbrellaCY + (canopyR + R) * Math.sin(b.theta);

      // 端まで来たら落下へ解放（接線方向で発射）
      if ((b.side === -1 && b.theta <= Math.PI + EDGE_EPS) ||
          (b.side === +1 && b.theta >= TWO_PI - EDGE_EPS)) {
        const tx = -Math.sin(b.theta);
        const ty =  Math.cos(b.theta);
        const v   = max(SLIDE_SPEED, SPEED * 0.8);
        // 風の影響も初速に少し足す
        const s0 = wind * tx;
        b.vx = tx * v + s0 * SLIDE_WIND_GAIN;
        b.vy = max(ty * v, SPEED * 0.8);
        b.mode = "fall";
        b.theta = null;
        b.side = 0;
      }
    } else {
      // ---- 通常落下 ----
      // 横速度は風へ寄せる（なめらかに風に流される）
      b.vx = lerp(b.vx, wind, WIND_PULL);
      b.x += b.vx;
      b.y += b.vy;

      // 傘（上半円）との接触チェック
      const dx = b.x - umbrellaCX;
      const dy = b.y - umbrellaCY;
      const dist = Math.hypot(dx, dy);
      const target = canopyR + R;

      if (b.y <= umbrellaCY && dist <= target) {
        let theta = Math.atan2(dy, dx);
        if (theta < 0) theta += TWO_PI;

        if (theta >= Math.PI && theta <= TWO_PI) {
          // スライド開始：位置を円周に固定
          b.mode = "slide";
          const nx = dx / (dist || 1), ny = dy / (dist || 1);
          b.x = umbrellaCX + (canopyR + R) * nx;
          b.y = umbrellaCY + (canopyR + R) * ny;

          b.theta = theta;
          // どちら側へ“下り”か：中心より左なら左へ、右なら右へ
          b.side = (dx < 0) ? -1 : +1;
        } else {
          // 上半分以外は軽く押し戻すだけ（貫通防止）
          const nx = dx / (dist || 1), ny = dy / (dist || 1);
          const push = target - dist + 0.5;
          b.x += nx * push;
          b.y += ny * push;
        }
      }
    }

    // 画面外処理（下に出たら再スポーン）
    if (b.y > height + R) {
      b.y = 0;
      b.x = random(width);
      b.vx = 0;
      b.vy = SPEED;
      b.mode = "fall";
      b.theta = null;
      b.side = 0;
    }
    if (b.y < -R - 10) {
      b.y = 0;
      b.x = random(width);
      b.vx = 0;
      b.vy = SPEED;
      b.mode = "fall";
      b.theta = null;
      b.side = 0;
    }

    // 描画
    ellipse(b.x, b.y, SIZE, SIZE);
  }

  // 傘の描画（マウスXに追従）
  drawUmbrella(umbrellaCX, height);

  // 風インジケータ
  drawWindIndicator(wind);
}

// 傘の描画（中心x, 底辺y）
function drawUmbrella(cx, bottomY) {
  // 柄
  stroke(255);
  strokeWeight(2);
  line(cx, bottomY - stemH, cx, bottomY - 5);

  // フック
  noFill();
  arc(cx - hookR, bottomY - 5, hookR * 2, hookR * 2, PI, PI + HALF_PI);

  // 天蓋（半円）
  noStroke();
  fill(255);
  arc(cx, bottomY - stemH, canopyR * 2, canopyR * 2, PI, TWO_PI);

  // 任意のフリル
  const nFrills = 3;
  for (let i = 0; i < nFrills; i++) {
    const t0 = map(i, 0, nFrills, -PI, 0);
    const t1 = map(i + 1, 0, nFrills, -PI, 0);
    const mx = cx + canopyR * cos((t0 + t1) / 2);
    const my = bottomY - stemH + canopyR * sin((t0 + t1) / 2);
    triangle(
      cx + canopyR * cos(t0), bottomY - stemH + canopyR * sin(t0),
      cx + canopyR * cos(t1), bottomY - stemH + canopyR * sin(t1),
      mx, my + 8
    );
  }
}

// 左上に風向・強さインジケータ
function drawWindIndicator(w) {
  push();
  const cx = 40, cy = 40;
  const len = 20 + 20 * abs(w) / WIND_MAX; // 強いほど長く
  stroke(255);
  strokeWeight(2);
  // ベースの丸
  noFill();
  ellipse(cx, cy, 20, 20);
  // 風向（右=正）
  line(cx, cy, cx + len * Math.sign(w || 1), cy);
  // 矢羽
  const dir = Math.sign(w || 1);
  const x2 = cx + len * dir;
  line(x2, cy, x2 - 6 * dir, cy - 4);
  line(x2, cy, x2 - 6 * dir, cy + 4);
  pop();
}
