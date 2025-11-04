// --- 設定 ---
let balls = [];
const MAX_BALLS = 150;
const SPAWN_INTERVAL = 2;
const SPEED = 6;
const SIZE = 2;
const R = SIZE / 2;

// 傘
let canopyR = 70;
let stemH = 80;
let hookR = 20;

// スライド関連
const SLIDE_SPEED = SPEED * 0.9;
const EDGE_EPS = 0.02;

// --- 風パラメータ ---
let wind = 0;
let windT = 0;
const WIND_MAX = 3.0;
const WIND_NOISE_INC = 0.005;
const WIND_RESP = 0.05;
const WIND_PULL = 0.02;
const SLIDE_WIND_GAIN = 0.15;

// --- 棒人間関連（1人ずつ出現、0〜10秒ランダム間隔） ---
let walker = null;      // 現在の棒人間（いない時は null）
let nextWalkerTime = 0; // 次に出す時間（frameCount 基準）

function setup() {
  createCanvas(windowWidth, windowHeight);
  scheduleNextWalker(); // 最初の登場予約
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
  for (let b of balls) b.x = constrain(b.x, 0, width);
}

// --- 棒人間出現スケジューリング ---
function scheduleNextWalker() {
  const delaySec = random(0, 10);               // 0〜10秒
  nextWalkerTime = frameCount + delaySec * 60;  // 60fps想定
}

function spawnWalker() {
  const fromLeft = random() < 0.5;
  walker = {
    x: fromLeft ? -40 : width + 40,
    dir: fromLeft ? 1 : -1,
    baseSpeed: 2.2,     // 傘下ではこの速度で歩く
    speed: 0,           // ← 初期は停止（傘の下だけ歩く仕様）
    ampLeg: 12,
    ampArm: 14,
    phase: 0,
    walking: false      // 傘の下にいる間だけ true
  };
}

function spawnBall() {
  balls.push({
    x: random(width),
    y: 0,
    vx: 0,
    vy: SPEED,
    mode: "fall",   // "fall" or "slide"
    theta: null,    // スライド時の角度 [PI, TWO_PI]
    side: 0         // -1: 左へ滑る, +1: 右へ滑る
  });
}

function draw() {
  background(0, 0, 0, 75);

  // --- 風（Perlin noise でゆっくり変化） ---
  windT += WIND_NOISE_INC;
  const targetWind = map(noise(windT), 0, 1, -WIND_MAX, WIND_MAX);
  wind = lerp(wind, targetWind, WIND_RESP);

  // 傘（マウスXに追従、最下部固定）
  const umbrellaCX = constrain(mouseX || width / 2, 0, width);
  const umbrellaCY = height - stemH;

  // 雨生成（時間差スポーン）
  if (balls.length < MAX_BALLS && frameCount % SPAWN_INTERVAL === 0) {
    spawnBall();
  }

  noStroke();
  fill(255);

  // --- 雨の更新 ---
  for (let b of balls) {
    if (b.mode === "slide") {
      // 円弧上を角度で移動（風の接線成分も加算）
      let dTheta = b.side * (SLIDE_SPEED / (canopyR + R));
      const s = wind * (-Math.sin(b.theta)); // 接線 t = (-sinθ, cosθ)
      dTheta += (s * SLIDE_WIND_GAIN) / (canopyR + R);
      b.theta += dTheta;

      b.x = umbrellaCX + (canopyR + R) * Math.cos(b.theta);
      b.y = umbrellaCY + (canopyR + R) * Math.sin(b.theta);

      // 端まで来たら落下へ解放
      if ((b.side === -1 && b.theta <= Math.PI + EDGE_EPS) ||
          (b.side === +1 && b.theta >= TWO_PI - EDGE_EPS)) {
        const tx = -Math.sin(b.theta);
        const ty =  Math.cos(b.theta);
        const v   = max(SLIDE_SPEED, SPEED * 0.8);
        const s0  = wind * tx;
        b.vx = tx * v + s0 * SLIDE_WIND_GAIN;
        b.vy = max(ty * v, SPEED * 0.8);
        b.mode = "fall";
        b.theta = null;
        b.side = 0;
      }
    } else {
      // 通常落下：横速度は風へ寄せる
      b.vx = lerp(b.vx, wind, WIND_PULL);
      b.x += b.vx;
      b.y += b.vy;

      // 傘（上半円）との接触チェック
      const dx = b.x - umbrellaCX;
      const dy = b.y - umbrellaCY;
      const distance = Math.hypot(dx, dy); // ← 予約語 dist は使わない
      const target = canopyR + R;

      if (b.y <= umbrellaCY && distance <= target) {
        let theta = Math.atan2(dy, dx);
        if (theta < 0) theta += TWO_PI;

        if (theta >= Math.PI && theta <= TWO_PI) {
          // スライド開始：円周上に固定
          b.mode = "slide";
          const nx = dx / (distance || 1), ny = dy / (distance || 1);
          b.x = umbrellaCX + (canopyR + R) * nx;
          b.y = umbrellaCY + (canopyR + R) * ny;
          b.theta = theta;
          b.side = (dx < 0) ? -1 : +1;
        } else {
          // 上半分以外は軽く押し戻す（貫通防止）
          const nx = dx / (distance || 1), ny = dy / (distance || 1);
          const pushOut = target - distance + 0.5; // ← 予約語 push は使わない
          b.x += nx * pushOut;
          b.y += ny * pushOut;
        }
      }
    }

    // 画面外に落ち切ったら再スポーン風に戻す
    if (b.y > height + R) {
      b.y = 0; b.x = random(width); b.vx = 0; b.vy = SPEED;
      b.mode = "fall"; b.theta = null; b.side = 0;
    }

    ellipse(b.x, b.y, SIZE, SIZE);
  }

  // --- 傘の描画 ---
  drawUmbrella(umbrellaCX, height);
  drawRoofs(); // 左右の屋根を描画

  // --- 棒人間（傘の下にいる時だけ歩く） ---
  if (walker) {
    updateWalker(umbrellaCX);   // 状態更新
    if (walker) drawWalker();   // null でないことを再確認して描画
  } else if (frameCount >= nextWalkerTime) {
    spawnWalker();
  }

  // --- 風インジケータ ---
  drawWindIndicator(wind);
}

// --- 傘 ---
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
}

// --- 棒人間（傘の下だけ歩くロジック） ---
function updateWalker(umbrellaCX) {
  const dx = walker.x - umbrellaCX;
  const ENTER = canopyR - 6;   // 入り閾値（少し狭め）
  const EXIT  = canopyR + 10;  // 出る閾値（少し広め）

  // 傘の下に「入ったら」歩き出す
  if (!walker.walking && Math.abs(dx) <= ENTER) {
    walker.walking = true;
    walker.speed = walker.baseSpeed;
  }
  // 傘の下から「出たら」止まる
  else if (walker.walking && Math.abs(dx) >= EXIT) {
    walker.walking = false;
    walker.speed = 0;
  }

  // 位置＆アニメ位相
  walker.x += walker.dir * walker.speed;
  if (walker.walking) {
    walker.phase += 0.12;   // 歩いている時だけスイング更新
  }

  // 画面外に出たら削除して次を予約
  if (walker.dir === 1 && walker.x > width + 40) {
    walker = null;
    scheduleNextWalker();
  } else if (walker.dir === -1 && walker.x < -40) {
    walker = null;
    scheduleNextWalker();
  }
}

function drawWalker() {
  const groundY = height - 6;
  const torsoLen = 24;
  const legLen   = 18;
  const armLen   = 16;
  const headR    = 8;

  const hipX = walker.x;
  const hipY = groundY - legLen;
  const shX  = hipX;
  const shY  = hipY - torsoLen;

  // 歩行中のみスイング、停止中は静止
  const s = walker.walking ? Math.sin(walker.phase) : 0;
  const strideLeg = walker.ampLeg * s;
  const strideArm = walker.ampArm * -s;

  stroke(255);
  strokeWeight(2);
  noFill();

  // 脚
  line(hipX, hipY, hipX - strideLeg * walker.dir, groundY);
  line(hipX, hipY, hipX + strideLeg * walker.dir, groundY);

  // 胴体
  line(shX, shY, hipX, hipY);

  // 腕
  line(shX, shY, shX - strideArm * 0.8 * walker.dir, shY + armLen);
  line(shX, shY, shX + strideArm * 0.8 * walker.dir, shY + armLen);

  // 頭
  ellipse(shX, shY - headR - 2, headR * 2, headR * 2);
}

// --- 風インジケータ ---
function drawWindIndicator(w) {
  push(); // p5.js の状態保存（予約済み関数）
  const cx = 40, cy = 40;
  const len = 20 + 20 * abs(w) / WIND_MAX; // 強いほど長く
  stroke(255);
  strokeWeight(2);
  noFill();
  ellipse(cx, cy, 20, 20);
  line(cx, cy, cx + len * Math.sign(w || 1), cy);
  const dir = Math.sign(w || 1);
  const x2 = cx + len * dir;
  line(x2, cy, x2 - 6 * dir, cy - 4);
  line(x2, cy, x2 - 6 * dir, cy + 4);
  pop();  // 復元
}
// --- 屋根の描画 ---
function drawRoofs() {
  noStroke();
  fill(255);

  // 左下の屋根（三角形）
  beginShape();
  vertex(0, height - 60);
  vertex(100, height - 60);
  vertex(0, height);
  endShape(CLOSE);

  // 右下の屋根（三角形）
  beginShape();
  vertex(width, height - 60);
  vertex(width - 100, height - 60);
  vertex(width, height);
  endShape(CLOSE);
}
