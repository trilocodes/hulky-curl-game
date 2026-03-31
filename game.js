/* ============================================================
   GAME.JS — Hulk Curl Game Engine
   ============================================================ */

// ── Global config ─────────────────────────────────────────────
const Config = {
  armMode: "single",
  speed: "slow",
  carInterval: { slow: 4000, medium: 3000, fast: 2000 },
};

let score = 0;
let bestScore = parseInt(localStorage.getItem("hulkBest") || "0");
let gameRunning = false;
let gamePaused = false;
let animFrame = null;
let carSpawnTimer = null;

// ── Canvas ─────────────────────────────────────────────────────
const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

function resizeCanvas() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}
window.addEventListener("resize", resizeCanvas);
resizeCanvas();

// ── Road / world ───────────────────────────────────────────────
const Road = {
  laneY() {
    return canvas.height * 0.7;
  },
  groundY() {
    return canvas.height * 0.76;
  },
  horizY() {
    return canvas.height * 0.58;
  },
};

// ── Hulk ───────────────────────────────────────────────────────
const Hulk = {
  x: 0,
  y: 0,
  baseW: 120,
  heldCar: null,
  state: "idle", // 'idle' | 'grab' | 'hold' | 'throw'
  stateTimer: 0,
  throwCar: null,
  throwVx: 0,
  throwVy: 0,
  throwX: 0,
  throwY: 0,
  throwR: 0,

  get w() {
    return this.baseW * (canvas.width / 900);
  },
  get h() {
    return this.w * 1.8;
  },

  update(dt) {
    this.x = canvas.width * 0.22;
    this.y = Road.groundY() - this.h;

    if (this.state !== "idle" && this.state !== "hold") {
      this.stateTimer -= dt;
      if (this.stateTimer <= 0) {
        if (this.state === "grab") this.state = "hold";
        else if (this.state === "throw") this.state = "idle";
      }
    }

    // Animate thrown car arc
    if (this.state === "throw" && this.throwCar) {
      this.throwX += this.throwVx * dt;
      this.throwY += this.throwVy * dt;
      this.throwVy += 1200 * dt; // gravity
      this.throwR += 5 * dt;
    }
  },

  grab(car) {
    this.heldCar = car;
    this.state = "grab";
    this.stateTimer = 0.3;
  },

  doThrow() {
    if (!this.heldCar) return;
    this.throwCar = this.heldCar;
    this.heldCar = null;
    this.state = "throw";
    this.stateTimer = 1.2;
    // Launch up and behind (left)
    this.throwX = this.x + this.w * 0.5;
    this.throwY = this.y + this.h * 0.3;
    this.throwVx = -canvas.width * 0.35;
    this.throwVy = -canvas.height * 0.9;
    this.throwR = 0;
    score++;
    document.getElementById("scoreDisplay").textContent = score;
    showThrowFX();
  },

  draw() {
    const x = this.x,
      y = this.y,
      w = this.w,
      h = this.h;
    const cx = x + w / 2;
    const isGrabbing = this.state === "grab";
    const isThrowing = this.state === "throw";
    const armRaised = this.heldCar || isGrabbing;

    // ── Shadow ──
    ctx.save();
    ctx.fillStyle = "rgba(0,0,0,0.3)";
    ctx.beginPath();
    ctx.ellipse(cx, Road.groundY() + 4, w * 0.6, 8, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // ── Legs ──
    ctx.save();
    ctx.fillStyle = "#1e3a5f";
    // Left leg
    roundRect(
      ctx,
      cx - w * 0.33,
      y + h * 0.65,
      w * 0.28,
      h * 0.35,
      6,
      "#1e3a5f",
    );
    // Right leg
    roundRect(
      ctx,
      cx + w * 0.05,
      y + h * 0.65,
      w * 0.28,
      h * 0.35,
      6,
      "#1e3a5f",
    );
    ctx.restore();

    // ── Pants waistband ──
    roundRect(
      ctx,
      cx - w * 0.36,
      y + h * 0.62,
      w * 0.72,
      h * 0.08,
      4,
      "#2563eb",
    );

    // ── Body/torso ──
    const bodyGrad = ctx.createLinearGradient(
      cx - w * 0.4,
      y,
      cx + w * 0.4,
      y + h * 0.65,
    );
    bodyGrad.addColorStop(0, "#22c55e");
    bodyGrad.addColorStop(0.4, "#16a34a");
    bodyGrad.addColorStop(1, "#15803d");
    roundRect(
      ctx,
      cx - w * 0.38,
      y + h * 0.18,
      w * 0.76,
      h * 0.46,
      14,
      bodyGrad,
    );

    // Muscle highlights
    ctx.save();
    ctx.globalAlpha = 0.15;
    roundRect(ctx, cx - w * 0.22, y + h * 0.22, w * 0.18, h * 0.25, 8, "#fff");
    roundRect(ctx, cx + w * 0.04, y + h * 0.22, w * 0.18, h * 0.25, 8, "#fff");
    ctx.restore();

    // ── Neck ──
    roundRect(ctx, cx - w * 0.1, y + h * 0.14, w * 0.2, h * 0.08, 4, "#16a34a");

    // ── Head ──
    const headW = w * 0.52,
      headH = w * 0.46;
    const headX = cx - headW / 2,
      headY = y + h * 0.05 - headH * 0.5;
    const headGrad = ctx.createRadialGradient(
      cx,
      headY + headH * 0.4,
      0,
      cx,
      headY + headH * 0.4,
      headW * 0.6,
    );
    headGrad.addColorStop(0, "#4ade80");
    headGrad.addColorStop(1, "#15803d");
    roundRect(ctx, headX, headY, headW, headH, headW * 0.35, headGrad);

    // Brow ridge
    ctx.save();
    ctx.fillStyle = "#15803d";
    ctx.beginPath();
    ctx.rect(headX + 4, headY + headH * 0.28, headW - 8, headH * 0.12);
    ctx.fill();
    ctx.restore();

    // Eyes
    const eyeY = headY + headH * 0.38;
    // Left eye
    ctx.fillStyle = "#fff";
    ctx.beginPath();
    ctx.ellipse(
      cx - headW * 0.22,
      eyeY,
      headW * 0.1,
      headH * 0.1,
      0,
      0,
      Math.PI * 2,
    );
    ctx.fill();
    ctx.fillStyle = "#1e1b4b";
    ctx.beginPath();
    ctx.arc(cx - headW * 0.22, eyeY, headW * 0.055, 0, Math.PI * 2);
    ctx.fill();
    // Right eye
    ctx.fillStyle = "#fff";
    ctx.beginPath();
    ctx.ellipse(
      cx + headW * 0.22,
      eyeY,
      headW * 0.1,
      headH * 0.1,
      0,
      0,
      Math.PI * 2,
    );
    ctx.fill();
    ctx.fillStyle = "#1e1b4b";
    ctx.beginPath();
    ctx.arc(cx + headW * 0.22, eyeY, headW * 0.055, 0, Math.PI * 2);
    ctx.fill();

    // Angry brows
    ctx.strokeStyle = "#052e16";
    ctx.lineWidth = 3.5;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(cx - headW * 0.35, eyeY - headH * 0.14);
    ctx.lineTo(cx - headW * 0.1, eyeY - headH * 0.08);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cx + headW * 0.35, eyeY - headH * 0.14);
    ctx.lineTo(cx + headW * 0.1, eyeY - headH * 0.08);
    ctx.stroke();

    // Mouth (grimace)
    ctx.strokeStyle = "#052e16";
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(cx - headW * 0.18, eyeY + headH * 0.22);
    ctx.quadraticCurveTo(
      cx,
      eyeY + headH * 0.18,
      cx + headW * 0.18,
      eyeY + headH * 0.22,
    );
    ctx.stroke();

    // ── Arms ──
    const rightArmRaise = armRaised ? -0.6 : 0.1;
    const leftArmRaise =
      isThrowing || (Config.armMode === "both" && armRaised) ? -0.6 : 0.1;

    // Right arm — always active
    drawArm(
      ctx,
      cx + w * 0.36,
      y + h * 0.22,
      cx + w * 0.7,
      y + h * 0.22 + h * 0.35 * rightArmRaise + h * 0.35,
      w * 0.14,
      "#22c55e",
      "#16a34a",
    );

    // Left arm — raised only in both-arms mode
    drawArm(
      ctx,
      cx - w * 0.36,
      y + h * 0.22,
      cx - w * 0.7,
      y + h * 0.22 + h * 0.35 * leftArmRaise + h * 0.35,
      w * 0.14,
      "#22c55e",
      "#16a34a",
    );

    // Held car in right hand
    if (this.heldCar) {
      const handX = cx + w * 0.65;
      const handY = y + h * 0.22 + h * 0.35 * rightArmRaise + h * 0.35;
      drawMiniCar(ctx, this.heldCar, handX - 30, handY - 20, 0.55);
    }

    // ── Thrown car arc ──
    if (this.state === "throw" && this.throwCar) {
      ctx.save();
      ctx.translate(this.throwX, this.throwY);
      ctx.rotate(this.throwR);
      drawMiniCar(ctx, this.throwCar, -25, -14, 0.7);
      ctx.restore();
    }
  },
};

// ── Cars ───────────────────────────────────────────────────────
const CAR_COLORS = [
  ["#ef4444", "#dc2626"], // red
  ["#3b82f6", "#1d4ed8"], // blue
  ["#f59e0b", "#d97706"], // amber
  ["#8b5cf6", "#6d28d9"], // purple
  ["#ec4899", "#be185d"], // pink
  ["#06b6d4", "#0284c7"], // cyan
  ["#f97316", "#ea580c"], // orange
  ["#a3e635", "#65a30d"], // lime
];

let cars = [];
let lastCarId = 0;

function randomCarColor() {
  return CAR_COLORS[Math.floor(Math.random() * CAR_COLORS.length)];
}

function spawnCar() {
  if (!gameRunning || gamePaused) return;
  cars.push({
    id: ++lastCarId,
    x: canvas.width + 100,
    y: 0,
    colors: randomCarColor(),
    speed: canvas.width * (0.22 + Math.random() * 0.06),
    reachX: Hulk.x + Hulk.w * 1.1,
    state: "incoming", // 'incoming' | 'waiting'
    waitTimer: 0,
  });
}

function drawCar(car) {
  const x = car.x,
    laneY = Road.laneY();
  const scale = 1;
  drawFullCar(ctx, car, x, laneY, scale);
}

function drawFullCar(ctx, car, x, baseY, scale) {
  const W = 110 * scale,
    H = 55 * scale;
  const y = baseY - H;
  const [c1, c2] = car.colors;
  const grad = ctx.createLinearGradient(x, y, x + W, y + H);
  grad.addColorStop(0, c1);
  grad.addColorStop(1, c2);

  // Body
  roundRect(ctx, x, y + H * 0.2, W, H * 0.6, 8 * scale, grad);

  // Roof
  const roofGrad = ctx.createLinearGradient(
    x + W * 0.2,
    y,
    x + W * 0.8,
    y + H * 0.35,
  );
  roofGrad.addColorStop(0, lighten(c1, 20));
  roofGrad.addColorStop(1, c1);
  roundRect(ctx, x + W * 0.18, y, W * 0.64, H * 0.45, 10 * scale, roofGrad);

  // Windows
  ctx.save();
  ctx.fillStyle = "rgba(147,210,255,0.7)";
  roundRect(
    ctx,
    x + W * 0.22,
    y + H * 0.04,
    W * 0.24,
    H * 0.32,
    4 * scale,
    "rgba(147,210,255,0.7)",
  );
  roundRect(
    ctx,
    x + W * 0.52,
    y + H * 0.04,
    W * 0.24,
    H * 0.32,
    4 * scale,
    "rgba(147,210,255,0.7)",
  );
  ctx.restore();

  // Highlight stripe
  ctx.save();
  ctx.globalAlpha = 0.2;
  ctx.fillStyle = "#fff";
  roundRect(
    ctx,
    x + W * 0.05,
    y + H * 0.25,
    W * 0.9,
    H * 0.08,
    3 * scale,
    "#fff",
  );
  ctx.restore();

  // Wheels
  drawWheel(ctx, x + W * 0.18, y + H * 0.8, H * 0.22 * scale);
  drawWheel(ctx, x + W * 0.78, y + H * 0.8, H * 0.22 * scale);

  // Headlights
  ctx.fillStyle = "#fef3c7";
  ctx.shadowColor = "#fbbf24";
  ctx.shadowBlur = 8;
  roundRect(ctx, x, y + H * 0.32, W * 0.07, H * 0.14, 3, "#fef3c7");
  ctx.shadowBlur = 0;

  // Taillights
  ctx.fillStyle = "#fca5a5";
  roundRect(ctx, x + W * 0.93, y + H * 0.32, W * 0.07, H * 0.14, 3, "#fca5a5");
}

function drawMiniCar(ctx, car, offX, offY, scale) {
  drawFullCar(ctx, car, offX, offY + 55 * scale, scale);
}

function drawWheel(ctx, cx, cy, r) {
  ctx.save();
  ctx.fillStyle = "#1e1b4b";
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#475569";
  ctx.beginPath();
  ctx.arc(cx, cy, r * 0.55, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#94a3b8";
  ctx.beginPath();
  ctx.arc(cx, cy, r * 0.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

// ── Helpers ────────────────────────────────────────────────────
function roundRect(ctx, x, y, w, h, r, fillStyle) {
  if (typeof r === "number") r = { tl: r, tr: r, br: r, bl: r };
  ctx.beginPath();
  ctx.moveTo(x + r.tl, y);
  ctx.lineTo(x + w - r.tr, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r.tr);
  ctx.lineTo(x + w, y + h - r.br);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r.br, y + h);
  ctx.lineTo(x + r.bl, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r.bl);
  ctx.lineTo(x, y + r.tl);
  ctx.quadraticCurveTo(x, y, x + r.tl, y);
  ctx.closePath();
  if (fillStyle) {
    ctx.fillStyle = fillStyle;
    ctx.fill();
  }
}

function drawArm(ctx, x1, y1, x2, y2, thickness, c1, c2) {
  const grad = ctx.createLinearGradient(x1, y1, x2, y2);
  grad.addColorStop(0, c1);
  grad.addColorStop(1, c2);
  ctx.save();
  ctx.strokeStyle = grad;
  ctx.lineWidth = thickness;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.quadraticCurveTo((x1 + x2) / 2, y1 - thickness * 0.5, x2, y2);
  ctx.stroke();
  // Fist
  ctx.fillStyle = "#22c55e";
  ctx.beginPath();
  ctx.arc(x2, y2, thickness * 0.6, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function lighten(hex, amount) {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.min(255, (n >> 16) + amount);
  const g = Math.min(255, ((n >> 8) & 0xff) + amount);
  const b = Math.min(255, (n & 0xff) + amount);
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, "0")}`;
}

// ── Road background particles ──────────────────────────────────
const roadLines = [];
for (let i = 0; i < 8; i++) {
  roadLines.push({ x: Math.random() * 2000, speed: 300 + Math.random() * 200 });
}

const stars = [];
for (let i = 0; i < 60; i++) {
  stars.push({
    x: Math.random(),
    y: Math.random() * 0.42,
    r: Math.random() * 1.5 + 0.3,
    tw: Math.random() * Math.PI * 2,
  });
}

const clouds = [
  { x: 0.1, y: 0.12, w: 120, h: 40, speed: 15 },
  { x: 0.4, y: 0.08, w: 180, h: 55, speed: 10 },
  { x: 0.7, y: 0.15, w: 100, h: 35, speed: 20 },
];

// ── Scene render ───────────────────────────────────────────────
function drawBackground(dt, t) {
  const W = canvas.width,
    H = canvas.height;
  const hz = Road.horizY(),
    groundY = Road.groundY();

  // Sky gradient
  const sky = ctx.createLinearGradient(0, 0, 0, hz);
  sky.addColorStop(0, "#020617");
  sky.addColorStop(0.5, "#0c1a2e");
  sky.addColorStop(1, "#1e3a4f");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, hz);

  // Stars
  stars.forEach((s) => {
    s.tw += dt * 1.5;
    const alpha = 0.4 + 0.6 * Math.abs(Math.sin(s.tw));
    ctx.fillStyle = `rgba(255,255,255,${alpha})`;
    ctx.beginPath();
    ctx.arc(s.x * W, s.y * H, s.r, 0, Math.PI * 2);
    ctx.fill();
  });

  // Moon
  ctx.fillStyle = "#fef9c3";
  ctx.shadowColor = "#fef08a";
  ctx.shadowBlur = 20;
  ctx.beginPath();
  ctx.arc(W * 0.85, H * 0.1, 28, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;
  // Moon craters
  ctx.fillStyle = "#fef08a";
  ctx.beginPath();
  ctx.arc(W * 0.85 + 8, H * 0.1 - 8, 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(W * 0.85 - 6, H * 0.1 + 5, 3, 0, Math.PI * 2);
  ctx.fill();

  // City skyline silhouette
  drawSkyline(W, hz);

  // Clouds
  clouds.forEach((c) => {
    c.x -= (c.speed * dt) / W;
    if (c.x < -c.w / W) c.x = 1.1;
    drawCloud(c.x * W, c.y * H, c.w, c.h);
  });

  // Ground (road area)
  const ground = ctx.createLinearGradient(0, hz, 0, H);
  ground.addColorStop(0, "#1c1917");
  ground.addColorStop(0.3, "#292524");
  ground.addColorStop(1, "#1c1917");
  ctx.fillStyle = ground;
  ctx.fillRect(0, hz, W, H - hz);

  // Flat horizontal road
  const road = ctx.createLinearGradient(0, hz, 0, groundY + 20);
  road.addColorStop(0, "#374151");
  road.addColorStop(0.5, "#4b5563");
  road.addColorStop(1, "#374151");
  ctx.fillStyle = road;
  ctx.fillRect(0, hz, W, groundY - hz + 20);

  // Road center line dashes
  roadLines.forEach((rl) => {
    rl.x -= rl.speed * dt;
    if (rl.x < -80) rl.x = W + 80;
    const progress = rl.x / W;
    const lineY = hz + (groundY - hz) * 0.5;
    const lineW = 50;
    const lineH = 6;
    ctx.fillStyle = "rgba(255,255,255,0.35)";
    ctx.fillRect(rl.x - lineW / 2, lineY - lineH / 2, lineW, lineH);
  });

  // Sidewalk / ground
  ctx.fillStyle = "#292524";
  ctx.fillRect(0, groundY + 20, W, H - groundY - 20);
}

function drawSkyline(W, hz) {
  const buildings = [
    { x: 0.55, w: 0.04, h: 0.18 },
    { x: 0.6, w: 0.05, h: 0.25 },
    { x: 0.66, w: 0.03, h: 0.2 },
    { x: 0.7, w: 0.06, h: 0.3 },
    { x: 0.77, w: 0.04, h: 0.22 },
    { x: 0.82, w: 0.05, h: 0.18 },
    { x: 0.88, w: 0.03, h: 0.28 },
    { x: 0.92, w: 0.06, h: 0.15 },
  ];
  ctx.fillStyle = "#0f172a";
  buildings.forEach((b) => {
    const bx = b.x * W;
    const bw = b.w * W;
    const bh = b.h * canvas.height;
    ctx.fillRect(bx, hz - bh, bw, bh);
    // Windows
    ctx.fillStyle = "rgba(253,224,71,0.4)";
    for (let wy = hz - bh + 8; wy < hz - 8; wy += 10) {
      for (let wx = bx + 4; wx < bx + bw - 4; wx += 8) {
        if (Math.random() > 0.4) ctx.fillRect(wx, wy, 4, 5);
      }
    }
    ctx.fillStyle = "#0f172a";
  });
}

function drawCloud(x, y, w, h) {
  ctx.save();
  ctx.globalAlpha = 0.08;
  ctx.fillStyle = "#e0f2fe";
  for (let i = 0; i < 4; i++) {
    ctx.beginPath();
    ctx.ellipse(
      x + w * 0.15 * i,
      y + h * (0.2 + Math.sin(i * 1.2) * 0.15),
      w * 0.28,
      h * 0.5,
      0,
      0,
      Math.PI * 2,
    );
    ctx.fill();
  }
  ctx.restore();
}

// ── FX ─────────────────────────────────────────────────────────
let particles = [];

function showThrowFX() {
  const el = document.getElementById("throwIndicator");
  el.classList.remove("hidden");
  // Restart animation
  void el.offsetWidth;
  el.style.animation = "none";
  void el.offsetWidth;
  el.style.animation = "";
  setTimeout(() => el.classList.add("hidden"), 650);

  // Spawn particles
  for (let i = 0; i < 20; i++) {
    particles.push({
      x: Hulk.x + Hulk.w * 0.6,
      y: Hulk.y + Hulk.h * 0.3,
      vx: (Math.random() - 0.5) * 400,
      vy: (Math.random() - 1.2) * 400,
      r: 4 + Math.random() * 8,
      life: 1,
      color: ["#fbbf24", "#ef4444", "#4ade80", "#fff"][
        Math.floor(Math.random() * 4)
      ],
    });
  }
}

function updateParticles(dt) {
  particles = particles.filter((p) => p.life > 0);
  particles.forEach((p) => {
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vy += 600 * dt;
    p.life -= dt * 2;
  });
}

function drawParticles() {
  particles.forEach((p) => {
    ctx.save();
    ctx.globalAlpha = p.life;
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  });
}

// ── Game Over flash ────────────────────────────────────────────
let shakeTimer = 0;
let flashAlpha = 0;

function triggerGameOver() {
  shakeTimer = 0.4;
  flashAlpha = 1;
  setTimeout(() => endGame(), 600);
}

// ── Main loop ──────────────────────────────────────────────────
let lastTime = null;
let time = 0;

function loop(ts) {
  if (gamePaused) return;

  const dt = lastTime ? Math.min((ts - lastTime) / 1000, 0.05) : 0;
  lastTime = ts;
  time += dt;

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Screen shake
  if (shakeTimer > 0) {
    shakeTimer -= dt;
    const s = shakeTimer * 15;
    ctx.save();
    ctx.translate((Math.random() - 0.5) * s, (Math.random() - 0.5) * s);
  }

  drawBackground(dt, time);

  // Update + draw cars
  for (let i = cars.length - 1; i >= 0; i--) {
    const car = cars[i];
    if (car.state === "incoming") {
      car.x -= car.speed * dt;
      if (car.x <= car.reachX) {
        car.x = car.reachX;
        car.state = "waiting";

        // Is Hulk already holding a car?
        if (Hulk.heldCar) {
          triggerGameOver();
          return;
        } else {
          Hulk.grab(car);
          cars.splice(i, 1);
        }
      }
    }
  }

  cars.forEach((c) => drawCar(c));

  Hulk.update(dt);
  Hulk.draw();

  updateParticles(dt);
  drawParticles();

  // Flash overlay
  if (flashAlpha > 0) {
    flashAlpha -= dt * 3;
    ctx.save();
    ctx.fillStyle = `rgba(239,68,68,${Math.max(0, flashAlpha)})`;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.restore();
  }

  if (shakeTimer > 0) ctx.restore();

  animFrame = requestAnimationFrame(loop);
}

// ── Throw trigger ──────────────────────────────────────────────
function onThrow() {
  if (!gameRunning || gamePaused) return;
  if (Hulk.heldCar) {
    Hulk.doThrow();
  }
}

// ── Menu state ─────────────────────────────────────────────────
function selectArmMode(mode) {
  Config.armMode = mode;
  document
    .getElementById("btnSingle")
    .classList.toggle("active", mode === "single");
  document
    .getElementById("btnBoth")
    .classList.toggle("active", mode === "both");
}

function selectSpeed(speed) {
  Config.speed = speed;
  ["slow", "medium", "fast"].forEach((s) =>
    document
      .getElementById("btn" + s.charAt(0).toUpperCase() + s.slice(1))
      .classList.toggle("active", s === speed),
  );
}

function showScreen(id) {
  document
    .querySelectorAll(".screen")
    .forEach((s) => s.classList.remove("active"));
  document.getElementById(id).classList.add("active");
}

// ── Start ──────────────────────────────────────────────────────
async function startGame() {
  showScreen("gameScreen");

  // Update HUD tag
  const armLabel = Config.armMode === "both" ? "BOTH ARMS" : "SINGLE ARM";
  const speedLabel = Config.speed.toUpperCase();
  document.getElementById("modeTag").textContent =
    `${armLabel} · ${speedLabel}`;
  document.getElementById("bestDisplay").textContent = bestScore;

  score = 0;
  document.getElementById("scoreDisplay").textContent = "0";
  cars = [];
  particles = [];
  Hulk.heldCar = null;
  Hulk.state = "idle";
  gameRunning = true;
  gamePaused = false;
  shakeTimer = 0;
  flashAlpha = 0;
  lastTime = null;
  time = 0;

  // Init pose tracking
  await PoseTracker.init({
    armMode: Config.armMode,
    onThrowRight: onThrow,
    onThrowLeft: onThrow,
  });

  // Countdown before starting
  gameRunning = false;
  animFrame = requestAnimationFrame(loop);

  let count = 3;
  showCountdown(count);

  const countTimer = setInterval(() => {
    count--;
    if (count > 0) {
      showCountdown(count);
    } else {
      clearInterval(countTimer);
      showCountdown("GO!");
      setTimeout(() => {
        hideCountdown();
        gameRunning = true;
        const interval = Config.carInterval[Config.speed];
        spawnCar();
        carSpawnTimer = setInterval(() => {
          if (gameRunning && !gamePaused) spawnCar();
        }, interval);
      }, 700);
    }
  }, 1000);
}

function pauseGame() {
  if (!gameRunning) return;
  gamePaused = !gamePaused;
  if (!gamePaused) {
    lastTime = null;
    animFrame = requestAnimationFrame(loop);
  }
}

function showCountdown(value) {
  let el = document.getElementById("countdownDisplay");
  if (!el) {
    el = document.createElement("div");
    el.id = "countdownDisplay";
    document.getElementById("gameScreen").appendChild(el);
  }
  el.textContent = value;
  el.style.cssText = `
    position: absolute;
    top: 50%; left: 50%;
    transform: translate(-50%, -50%) scale(0.5);
    font-family: 'Bangers', cursive;
    font-size: 160px;
    color: ${value === "GO!" ? "#4ade80" : "#fbbf24"};
    text-shadow: 0 0 40px ${value === "GO!" ? "rgba(74,222,128,0.8)" : "rgba(251,191,36,0.8)"}, 6px 6px 0 rgba(0,0,0,0.5);
    z-index: 50;
    pointer-events: none;
    animation: countPop 0.4s cubic-bezier(0.175,0.885,0.32,1.275) forwards;
  `;
}

function hideCountdown() {
  const el = document.getElementById("countdownDisplay");
  if (el) el.remove();
}

function endGame() {
  gameRunning = false;
  gamePaused = false;
  cancelAnimationFrame(animFrame);
  clearInterval(carSpawnTimer);
  PoseTracker.stop();

  if (score > bestScore) {
    bestScore = score;
    localStorage.setItem("hulkBest", bestScore);
  }

  document.getElementById("finalScore").textContent = score;
  document.getElementById("finalBest").textContent = bestScore;
  showScreen("gameOverScreen");
}

function restartGame() {
  startGame();
}

function goMenu() {
  PoseTracker.stop();
  clearInterval(carSpawnTimer);
  cancelAnimationFrame(animFrame);
  gameRunning = false;
  showScreen("menuScreen");
}
