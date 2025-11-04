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

// --- 棒人間関連 ---
let walker = null;      // 現在の棒人間（いない時はnull）
let nextWalkerTime = 0; // 次に出す時間（frameCount基準）

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
  const delaySec = random(0, 10);          // 0〜10秒
  nextWalkerTime = frameCount + delaySec * 60; // 60fps想定
}

function spawnWalker() {
  const fromLeft = random() < 0.5;
  walker = {
    x: fromLeft ? -40 : width + 40,
    dir: fromLeft ? 1 : -1,
    speed: 2.2,
    ampLeg: 12,
    ampArm: 14,
    phase: 0
  };
}

function spawnBall() {
  balls.push({
    x: random(width),
    y: 0,
    vx: 0,
    vy: SPEED,
    mode: "fall",
    theta: null,
    side: 0
  });
}

function draw() {
  background(0, 0, 0, 75);

  // --- 風 ---
  windT += WIND_NOISE_INC;
  const targetWind = map(noise(windT), 0, 1, -WIND_MAX, WIND_MAX);
  wind = lerp(wind, targetWind, WIND_RESP);

  // 傘位置
  const umbrellaCX = constrain(mouseX || width / 2, 0, width);
  const umbrellaCY = height - stemH;

  // 雨生成
  if (balls.length < MAX_BALLS && frameCount % SPAWN_INTERVAL === 0) spawnBall();

  noStroke();
  fill(255);

  // --- 雨の更新 ---
  for (let b of balls) {
    if (b.mode === "slide") {
      let dTheta = b.side * (SLIDE_SPEED / (canopyR + R));
      const s = wind * (-Math.sin(b.theta));
      dTheta += (s * SLIDE_WIND_GAIN) / (canopyR + R);
      b.theta += dTheta;
      b.x = umbrellaCX + (canopyR + R) * Math.cos(b.theta);
      b.y = umbrellaCY + (canopyR + R) * Math.sin(b.theta);

      if ((b.side === -1 && b.theta <= Math.PI + EDGE_EPS) ||
          (b.side === +1 && b.theta >= TWO_PI - EDGE_EPS)) {
        const tx = -Math.sin(b.theta);
        const ty =  Math.cos(b.theta);
        const v  = max(SLIDE_SPEED, SPEED * 0.8);
        const s0 = wind * tx;
        b.vx = tx * v + s0 * SLIDE_WIND_GAIN;
        b.vy = max(ty * v, SPEED * 0.8);
        b.mode = "fall";
        b.theta = null;
        b.side = 0;
      }
    } else {
      b.vx = lerp(b.vx, wind, WIND_PULL);
      b.x += b.vx;
      b.y += b.vy;

      const dx = b.x - umbrellaCX;
      const dy = b.y - umbrellaCY;
      const dist = Math.hypot(dx, dy);
      const target = canopyR + R;

      if (b.y <= umbrellaCY && dist <= target) {
        let theta = Math.atan2(dy, dx);
        if (theta < 0) theta += TWO_PI;
        if (theta >= Math.PI && theta <= TWO_PI) {
          b.mode = "slide";
          const nx = dx / (dist || 1), ny = dy / (dist || 1);
          b.x = umbrellaCX + (canopyR + R) * nx;
          b.y = umbrellaCY + (canopyR + R) * ny;
          b.theta = theta;
          b.side = (dx < 0) ? -1 : +1;
        } else {
          const nx = dx / (dist || 1), ny = dy / (dist || 1);
          const push = target - dist + 0.5;
          b.x += nx * push;
          b.y += ny * push;
        }
      }
    }

    if (b.y > height + R) {
      b.y = 0; b.x = random(width); b.vx = 0; b.vy = SPEED;
      b.mode = "fall"; b.theta = null; b.side = 0;
    }

    ellipse(b.x, b.y, SIZE, SIZE);
  }

  // --- 傘 ---
  drawUmbrella(umbrellaCX, height);

  // --- 棒人間 ---
  if (walker) {
    updateWalker();           // ← まず更新
    if (walker) drawWalker(); // ← ここで再チェックしてから描画（重要！）
  } else if (frameCount >= nextWalkerTime) {
    spawnWalker();
  }

  // --- 風インジケータ ---
  drawWindIndicator(wind);
}

// --- 傘 ---
function drawUmbrella(cx, bottomY) {
  stroke(255);
  strokeWeight(2);
  line(cx, bottomY - stemH, cx, bottomY - 5);
  noFill();
  arc(cx - hookR, bottomY - 5, hookR * 2, hookR * 2, PI, PI + HALF_PI);
  noStroke();
  fill(255);
  arc(cx, bottomY - stemH, canopyR * 2, canopyR * 2, PI, TWO_PI);
}

// --- 棒人間 ---
function updateWalker() {
  walker.x += walker.dir * walker.speed;
  walker.phase += 0.12;

  // 画面外に出たら削除して次の登場を予約
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

  const s = Math.sin(walker.phase);
  const strideLeg = 12 * s;
  const strideArm = 14 * -s;

  stroke(255);
  strokeWeight(2);
  noFill();

  line(hipX, hipY, hipX - strideLeg * walker.dir, groundY);
  line(hipX, hipY, hipX + strideLeg * walker.dir, groundY);
  line(shX, shY, hipX, hipY);
  line(shX, shY, shX - strideArm * 0.8 * walker.dir, shY + armLen);
  line(shX, shY, shX + strideArm * 0.8 * walker.dir, shY + armLen);
  ellipse(shX, shY - headR - 2, headR * 2, headR * 2);
}

// --- 風インジケータ ---
function drawWindIndicator(w) {
  push();
  const cx = 40, cy = 40;
  const len = 20 + 20 * abs(w) / WIND_MAX;
  stroke(255);
  strokeWeight(2);
  noFill();
  ellipse(cx, cy, 20, 20);
  line(cx, cy, cx + len * Math.sign(w || 1), cy);
  const dir = Math.sign(w || 1);
  const x2 = cx + len * dir;
  line(x2, cy, x2 - 6 * dir, cy - 4);
  line(x2, cy, x2 - 6 * dir, cy + 4);
  pop();
}
