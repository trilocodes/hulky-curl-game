/* ============================================================
   POSE.JS — MediaPipe Pose Tracking + Angle Detection
   ============================================================ */

const PoseTracker = (() => {
  // ── State ──────────────────────────────────────────────────
  let pose = null;
  let camera = null;
  let isReady = false;
  let armMode = "single"; // 'single' | 'both'

  // Smoothing buffers
  const SMOOTH_FRAMES = 4;
  const angleBufferL = [];
  const angleBufferR = [];

  // Throw detection
  const THROW_ANGLE = 90; // degrees — curl triggers throw
  const REST_ANGLE = 155; // degrees — arm extended
  let leftState = "rest"; // 'rest' | 'curled' | 'thrown'
  let rightState = "rest";

  // Callbacks
  let onThrowLeft = null;
  let onThrowRight = null;
  let onAngleUpdate = null;

  // ── Elements ───────────────────────────────────────────────
  const videoEl = document.getElementById("webcam");
  const poseCanvas = document.getElementById("poseCanvas");
  const ctx = poseCanvas.getContext("2d");
  const armStatusL = document.getElementById("armStatusL");
  const armStatusR = document.getElementById("armStatusR");
  const angleDisplay = document.getElementById("angleDisplay");

  // ── Geometry ───────────────────────────────────────────────
  function angleBetween(A, B, C) {
    // Angle at vertex B given points A, B, C
    const ab = { x: A.x - B.x, y: A.y - B.y };
    const cb = { x: C.x - B.x, y: C.y - B.y };
    const dot = ab.x * cb.x + ab.y * cb.y;
    const magAB = Math.hypot(ab.x, ab.y);
    const magCB = Math.hypot(cb.x, cb.y);
    if (magAB === 0 || magCB === 0) return 180;
    const cos = Math.max(-1, Math.min(1, dot / (magAB * magCB)));
    return Math.round(Math.acos(cos) * (180 / Math.PI));
  }

  function smooth(buffer, value) {
    buffer.push(value);
    if (buffer.length > SMOOTH_FRAMES) buffer.shift();
    return Math.round(buffer.reduce((a, b) => a + b, 0) / buffer.length);
  }

  // ── Drawing ────────────────────────────────────────────────
  function drawSkeleton(landmarks, w, h) {
    if (!landmarks) return;

    const get = (i) => ({
      x: landmarks[i].x * w,
      y: landmarks[i].y * h,
      vis: landmarks[i].visibility,
    });

    ctx.clearRect(0, 0, w, h);

    // Connections to draw
    const pairs = [
      [11, 13],
      [13, 15], // left arm
      [12, 14],
      [14, 16], // right arm
      [11, 12], // shoulders
      [11, 23],
      [12, 24], // torso sides
    ];

    pairs.forEach(([a, b]) => {
      const pA = get(a);
      const pB = get(b);
      if (pA.vis < 0.3 || pB.vis < 0.3) return;
      ctx.beginPath();
      ctx.moveTo(pA.x, pA.y);
      ctx.lineTo(pB.x, pB.y);
      ctx.strokeStyle = "rgba(74,222,128,1)";
      ctx.lineWidth = 4;
      ctx.stroke();
    });

    // Keypoints
    [11, 12, 13, 14, 15, 16].forEach((i) => {
      const p = get(i);
      if (p.vis < 0.3) return;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 7, 0, Math.PI * 2);
      ctx.fillStyle = i % 2 === 0 ? "#60a5fa" : "#f472b6";
      ctx.fill();
    });
  }

  // ── Pose Result Handler ────────────────────────────────────
  function onResults(results) {
    if (!results.poseLandmarks) return;

    const lm = results.poseLandmarks;
    const w = poseCanvas.width;
    const h = poseCanvas.height;

    drawSkeleton(lm, w, h);

    // MediaPipe landmark indices:
    // 11 = left shoulder, 13 = left elbow, 15 = left wrist
    // 12 = right shoulder, 14 = right elbow, 16 = right wrist

    // Compute angles (mirrored — user's right = camera's left = index 12/14/16)
    const rawL = angleBetween(
      { x: lm[11].x, y: lm[11].y },
      { x: lm[13].x, y: lm[13].y },
      { x: lm[15].x, y: lm[15].y },
    );
    const rawR = angleBetween(
      { x: lm[12].x, y: lm[12].y },
      { x: lm[14].x, y: lm[14].y },
      { x: lm[16].x, y: lm[16].y },
    );

    const angleL = smooth(angleBufferL, rawL);
    const angleR = smooth(angleBufferR, rawR);

    if (onAngleUpdate) onAngleUpdate(angleL, angleR);

    // Export live joint data for game rendering
    PoseTracker.joints = {
      leftShoulder: { x: lm[11].x, y: lm[11].y, vis: lm[11].visibility },
      leftElbow: { x: lm[13].x, y: lm[13].y, vis: lm[13].visibility },
      leftWrist: { x: lm[15].x, y: lm[15].y, vis: lm[15].visibility },
      rightShoulder: { x: lm[12].x, y: lm[12].y, vis: lm[12].visibility },
      rightElbow: { x: lm[14].x, y: lm[14].y, vis: lm[14].visibility },
      rightWrist: { x: lm[16].x, y: lm[16].y, vis: lm[16].visibility },
    };

    // Update HUD
    if (armMode === "single") {
      angleDisplay.textContent = `${angleR}°`;
    } else {
      angleDisplay.textContent = `L${angleL}° R${angleR}°`;
    }

    // ── State machine per arm ──────────────────────────────
    // RIGHT arm — always active
    processArm("right", angleR);

    // LEFT arm — only triggers throw in both-arms mode
    if (armMode === "both") {
      processArm("left", angleL);
    }

    // Update status labels
    armStatusL.textContent = `L: ${angleL}°`;
    armStatusR.textContent = `R: ${angleR}°`;

    colorStatus(armStatusL, angleL);
    colorStatus(armStatusR, angleR);
  }

  function colorStatus(el, angle) {
    if (angle < THROW_ANGLE) {
      el.style.color = "#fbbf24"; // curled = yellow
    } else if (angle > REST_ANGLE) {
      el.style.color = "#6ee7b7"; // rest = green
    } else {
      el.style.color = "#fff";
    }
  }

  function processArm(side, angle) {
    const getState = () => (side === "left" ? leftState : rightState);
    const setState = (s) => {
      if (side === "left") leftState = s;
      else rightState = s;
    };

    const current = getState();

    if (current === "rest" && angle < THROW_ANGLE) {
      setState("curled");
    }
    if (current === "curled" && angle > REST_ANGLE) {
      // Arm went from curled back to extended = THROW!
      setState("rest");
      if (side === "left" && onThrowLeft) onThrowLeft();
      if (side === "right" && onThrowRight) onThrowRight();
    }
  }

  // ── Init ───────────────────────────────────────────────────
  async function init(config) {
    armMode = config.armMode || "single";
    onThrowLeft = config.onThrowLeft || null;
    onThrowRight = config.onThrowRight || null;
    onAngleUpdate = config.onAngleUpdate || null;

    // Reset states
    leftState = rightState = "rest";
    angleBufferL.length = angleBufferR.length = 0;

    // Size canvas to video
    poseCanvas.width = 200;
    poseCanvas.height = 150;

    pose = new Pose({
      locateFile: (file) =>
        `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}`,
    });

    pose.setOptions({
      modelComplexity: 1,
      smoothLandmarks: true,
      enableSegmentation: false,
      minDetectionConfidence: 0.5,
      minTrackingConfidence: 0.5,
    });

    pose.onResults(onResults);

    camera = new Camera(videoEl, {
      onFrame: async () => {
        if (pose) await pose.send({ image: videoEl });
      },
      width: 320,
      height: 240,
    });

    await camera.start();
    isReady = true;
    console.log("[PoseTracker] Ready. Arm mode:", armMode);
  }

  async function stop() {
    if (camera) {
      await camera.stop();
      camera = null;
    }
    if (pose) {
      await pose.close();
      pose = null;
    }
    isReady = false;
    ctx.clearRect(0, 0, poseCanvas.width, poseCanvas.height);
  }

  return {
    init,
    stop,
    joints: null,
    get isReady() {
      return isReady;
    },
  };
})();
