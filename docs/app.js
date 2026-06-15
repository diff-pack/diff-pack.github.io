// ── Dark mode toggle ──
(function() {
  const root = document.documentElement;
  const btn  = document.getElementById('theme-toggle');
  const stored = localStorage.getItem('theme');
  if (stored === 'dark') { root.setAttribute('data-theme', 'dark'); if (btn) btn.textContent = '☀'; }
  if (btn) btn.addEventListener('click', () => {
    const isDark = root.getAttribute('data-theme') === 'dark';
    root.setAttribute('data-theme', isDark ? 'light' : 'dark');
    btn.textContent = isDark ? '☽' : '☀';
    localStorage.setItem('theme', isDark ? 'light' : 'dark');
  });
})();

// ============================================================
// CHARTS
// ============================================================
const BLUE = '#185fa5', TEAL = '#0f6e56', AMBER = '#854f0b', RED = '#a32d2d', GRAY = '#8a8680';
const BLUE_L = '#b5d4f4', TEAL_L = '#9fe1cb';

const chartDefaults = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: { legend: { display: false } },
  scales: {
    y: { grid: { color: '#e8e4dd' }, ticks: { font: { size: 11, family: "'JetBrains Mono'" }, color: '#8a8680' } },
    x: { grid: { display: false }, ticks: { font: { size: 11, family: "'Inter'" }, color: '#4a4844' }, autoSkip: false }
  }
};

// CSD-32 UR
new Chart(document.getElementById('chart-ur-csd32'), {
  type: 'bar',
  data: {
    labels: ['First Fit','Best Fit','DBLF+GA','RCQL','GUROBI','GUROBI*','Diffusion\n(ours)'],
    datasets: [{
      data: [53.2, 72.4, 70.8, 62.6, 64.4, 77.6, 99.4],
      backgroundColor: ['#d3d1c7','#d3d1c7','#d3d1c7','#d3d1c7','#d3d1c7','#d3d1c7', TEAL],
      borderRadius: 4
    }]
  },
  options: { ...chartDefaults, scales: { ...chartDefaults.scales, y: { ...chartDefaults.scales.y, min: 0, max: 105, ticks: { ...chartDefaults.scales.y.ticks, callback: v => v+'%' } } } }
});

// RSD-32 UR
new Chart(document.getElementById('chart-ur-rsd32'), {
  type: 'bar',
  data: {
    labels: ['First Fit','Best Fit','DBLF+GA','RCQL','GUROBI','GUROBI*','Diffusion\n(ours)'],
    datasets: [{
      data: [67.5, 82.2, 67.5, 69.6, 64.9, 73.6, 85.7],
      backgroundColor: ['#d3d1c7','#d3d1c7','#d3d1c7','#d3d1c7','#d3d1c7','#d3d1c7', TEAL],
      borderRadius: 4
    }]
  },
  options: { ...chartDefaults, scales: { ...chartDefaults.scales, y: { ...chartDefaults.scales.y, min: 0, max: 100, ticks: { ...chartDefaults.scales.y.ticks, callback: v => v+'%' } } } }
});

// Success Rate Comparison
new Chart(document.getElementById('chart-sr'), {
  type: 'bar',
  data: {
    labels: ['5 Objects', '16 Objects', '32 Objects'],
    datasets: [
      { label: 'DiffusionCCSP', data: [52, 5, 0], backgroundColor: '#d3d1c7', borderRadius: 3 },
      { label: 'DiffusionPack', data: [71, 66, 62], backgroundColor: BLUE, borderRadius: 3 },
      { label: 'DiffusionPack-LLM', data: [66, 59, 53], backgroundColor: BLUE_L, borderRadius: 3 }
    ]
  },
  options: {
    ...chartDefaults,
    plugins: {
      legend: { display: false }
    },
    scales: { ...chartDefaults.scales, y: { ...chartDefaults.scales.y, min: 0, max: 100, ticks: { ...chartDefaults.scales.y.ticks, callback: v => v+'%' } } }
  }
});

// Scalability chart
new Chart(document.getElementById('chart-scale'), {
  type: 'line',
  data: {
    labels: ['16', '32', '33', '34', '35', '36'],
    datasets: [
      { label: 'CSD', data: [99.8, 99.4, 89.1, 98.3, 94.7, 99.6], borderColor: BLUE, backgroundColor: 'transparent', pointBackgroundColor: BLUE, tension: 0.3, borderWidth: 2, pointRadius: 4, borderDash: [] },
      { label: 'RSD', data: [75.8, 85.7, 84.1, 84.3, 84.5, 84.6], borderColor: TEAL, backgroundColor: 'transparent', pointBackgroundColor: TEAL, tension: 0.3, borderWidth: 2, pointRadius: 4, borderDash: [5,3] }
    ]
  },
  options: { ...chartDefaults, plugins: { legend: { display: false } }, scales: { ...chartDefaults.scales, y: { ...chartDefaults.scales.y, min: 60, max: 105, ticks: { ...chartDefaults.scales.y.ticks, callback: v => v+'%' } }, x: { ...chartDefaults.scales.x, title: { display: true, text: 'Cuboid count', font: { size: 11 }, color: '#8a8680' } } } }
});

// Ablation chart
new Chart(document.getElementById('chart-ablation'), {
  type: 'bar',
  data: {
    labels: ['No proj.','Each step','Last-10','Last-5','Last-2','Final step'],
    datasets: [
      { label: 'CSD-16', data: [48.9, 63.3, 93.6, 98.4, 99.3, 99.8], backgroundColor: BLUE, borderRadius: 3 },
      { label: 'CSD-32', data: [43.4, 58.8, 91.1, 97.7, 98.2, 99.4], backgroundColor: BLUE_L, borderRadius: 3 }
    ]
  },
  options: { ...chartDefaults, plugins: { legend: { display: false } }, scales: { ...chartDefaults.scales, y: { ...chartDefaults.scales.y, min: 0, max: 110, ticks: { ...chartDefaults.scales.y.ticks, callback: v => v+'%' } }, x: { ...chartDefaults.scales.x, ticks: { font: { size: 10 }, color: '#4a4844', maxRotation: 30 } } } }
});

// ============================================================
// REAL TRAJECTORY DEMO — Three.js + pre-computed JSON data
// ============================================================

// ── Embedded trajectory data ──────────────────────────────────
let TRAJ_DATA = null;
fetch('demo_trajectories.json')
  .then(r => r.json())
  .then(data => { TRAJ_DATA = data; initDemo(); })
  .catch(err => console.error('Failed to load trajectory data:', err));

// ── State ─────────────────────────────────────────────────────
let currentExample = null;   // the active example object from TRAJ_DATA
let isPlaying = false;
let animFrame = null;
let frameIdx = 0;            // which keyframe we are animating toward next

// Three.js globals
let threeScene, threeCamera, threeRenderer;
let boxMeshes = [];          // [{ mesh, edgeMesh, placedMask }]
let threeInited = false;

// ── Build example selector buttons (called after TRAJ_DATA loads) ──
function initDemo() {
  const list = document.getElementById('example-btn-list');
  TRAJ_DATA.examples.forEach((ex, i) => {
    const btn = document.createElement('button');
    btn.className = 'box-btn';
    btn.id = 'ex-btn-' + ex.id;
    const ur = (ex.metrics.utility_rate * 100).toFixed(1);
    const pd = (ex.metrics.packing_density * 100).toFixed(1);
    btn.innerHTML =
      `<span style="font-weight:600;font-size:12px;">${ex.label}</span><br>` +
      `<span style="color:var(--ink3);font-size:10px;">UR ${ur}% · PD ${pd}% · ${ex.metrics.items_placed}/${ex.n_items} placed</span>`;
    btn.onclick = () => selectExample(ex.id);
    list.appendChild(btn);
  });
}

// ── Select an example ─────────────────────────────────────────
function selectExample(id) {
  if (isPlaying) stopPlayback();

  currentExample = TRAJ_DATA.examples.find(e => e.id === id);
  if (!currentExample) return;

  // Highlight button
  document.querySelectorAll('.box-btn').forEach(b => b.classList.remove('active'));
  document.getElementById('ex-btn-' + id).classList.add('active');

  // Update info panel
  document.getElementById('info-dataset').textContent = currentExample.dataset;
  document.getElementById('info-items').textContent =
    `${currentExample.metrics.items_placed} / ${currentExample.n_items}`;

  // Update metrics (show final values)
  const m = currentExample.metrics;
  document.getElementById('m-ur').textContent  = (m.utility_rate * 100).toFixed(1) + '%';
  document.getElementById('m-pd').textContent  = (m.packing_density * 100).toFixed(1) + '%';
  document.getElementById('m-acp').textContent = m.items_placed;
  document.getElementById('m-seed').textContent = currentExample.seed;

  // Init Three.js if first time, then rebuild meshes
  initThree();
  buildBoxMeshes();

  // Show first keyframe (pure noise)
  frameIdx = 0;
  applyKeyframe(0);

  document.getElementById('status-text').textContent = 'Ready — press Play';
  document.getElementById('status-dot').className = 'status-dot';
  document.getElementById('step-label').textContent = 'Denoising step: 249 / 250';
  document.getElementById('step-pct').textContent = '0%';
  setScrubberPct(0);
}

// ── Three.js init ─────────────────────────────────────────────
function makeOrbit(camera, domEl) {
  let dragging = false, lastX = 0, lastY = 0;
  let theta = Math.PI / 5, phi = Math.PI / 3.5, radius = 2.6;
  const target = { x: 0.5, y: 0.3, z: 0.5 };

  function update() {
    const sinPhi = Math.sin(phi);
    camera.position.set(
      target.x + radius * sinPhi * Math.sin(theta),
      target.y + radius * Math.cos(phi),
      target.z + radius * sinPhi * Math.cos(theta)
    );
    camera.lookAt(target.x, target.y, target.z);
  }
  update();

  domEl.addEventListener('mousedown', e => {
    dragging = true; lastX = e.clientX; lastY = e.clientY;
    domEl.style.cursor = 'grabbing';
  });
  window.addEventListener('mouseup', () => { dragging = false; domEl.style.cursor = 'grab'; });
  window.addEventListener('mousemove', e => {
    if (!dragging) return;
    theta -= (e.clientX - lastX) * 0.008;
    phi = Math.max(0.15, Math.min(Math.PI / 2.1, phi + (e.clientY - lastY) * 0.006));
    lastX = e.clientX; lastY = e.clientY;
    update();
  });
  domEl.addEventListener('touchstart', e => {
    lastX = e.touches[0].clientX; lastY = e.touches[0].clientY;
  }, { passive: true });
  domEl.addEventListener('touchmove', e => {
    theta -= (e.touches[0].clientX - lastX) * 0.01;
    phi = Math.max(0.15, Math.min(Math.PI / 2.1, phi + (e.touches[0].clientY - lastY) * 0.008));
    lastX = e.touches[0].clientX; lastY = e.touches[0].clientY;
    update(); e.preventDefault();
  }, { passive: false });
  domEl.addEventListener('wheel', e => {
    radius = Math.max(1.0, Math.min(6, radius + e.deltaY * 0.003));
    update(); e.preventDefault();
  }, { passive: false });

  return { update };
}

function initThree() {
  if (threeInited) return;
  threeInited = true;

  const container = document.getElementById('three-container');
  const W = container.clientWidth, H = container.clientHeight;
  document.getElementById('three-placeholder').style.display = 'none';

  threeScene = new THREE.Scene();
  threeScene.background = new THREE.Color(0xf5f3f0);

  // Subtle fog helps depth perception
  threeScene.fog = new THREE.Fog(0xf5f3f0, 4, 12);

  threeCamera = new THREE.PerspectiveCamera(42, W / H, 0.01, 50);

  threeRenderer = new THREE.WebGLRenderer({ antialias: true });
  threeRenderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  threeRenderer.setSize(W, H);
  threeRenderer.shadowMap.enabled = true;
  threeRenderer.shadowMap.type = THREE.PCFSoftShadowMap;
  container.appendChild(threeRenderer.domElement);

  makeOrbit(threeCamera, threeRenderer.domElement);

  // Lights
  threeScene.add(new THREE.AmbientLight(0xffffff, 0.6));
  const sun = new THREE.DirectionalLight(0xfff8f0, 1.0);
  sun.position.set(2, 4, 2);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  sun.shadow.camera.near = 0.1; sun.shadow.camera.far = 12;
  sun.shadow.camera.left = -2; sun.shadow.camera.right = 2;
  sun.shadow.camera.top = 2; sun.shadow.camera.bottom = -2;
  threeScene.add(sun);
  const fill = new THREE.DirectionalLight(0xd8e8ff, 0.35);
  fill.position.set(-2, 1, -1);
  threeScene.add(fill);

  // Ground
  const gnd = new THREE.Mesh(
    new THREE.PlaneGeometry(8, 8),
    new THREE.ShadowMaterial({ opacity: 0.07 })
  );
  gnd.rotation.x = -Math.PI / 2;
  gnd.receiveShadow = true;
  threeScene.add(gnd);

  // Bin wireframe
  const binGeo = new THREE.BoxGeometry(1, 1, 1);
  const binEdges = new THREE.EdgesGeometry(binGeo);
  const binWire = new THREE.LineSegments(
    binEdges,
    new THREE.LineBasicMaterial({ color: 0x9a9590 })
  );
  binWire.position.set(0.5, 0.5, 0.5);
  threeScene.add(binWire);

  // Floor grid
  const grid = new THREE.GridHelper(1, 5, 0xc8c3bb, 0xdedad4);
  grid.position.set(0.5, 0.001, 0.5);
  threeScene.add(grid);

  // Axis labels (thin coloured lines on floor edges)
  const axMat = (c) => new THREE.LineBasicMaterial({ color: c, transparent: true, opacity: 0.4 });
  [[0,0,0,1,0,0,0xff4444],[0,0,0,0,0,1,0x4444ff]].forEach(([x1,y1,z1,x2,y2,z2,c]) => {
    const g = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(x1,y1,z1), new THREE.Vector3(x2,y2,z2)
    ]);
    threeScene.add(new THREE.Line(g, axMat(c)));
  });

  window.addEventListener('resize', () => {
    const W2 = container.clientWidth;
    threeCamera.aspect = W2 / H;
    threeCamera.updateProjectionMatrix();
    threeRenderer.setSize(W2, H);
  });

  (function renderLoop() {
    requestAnimationFrame(renderLoop);
    threeRenderer.render(threeScene, threeCamera);
  })();
}

// ── Build meshes from current example ─────────────────────────
function buildBoxMeshes() {
  // Dispose old
  for (const item of boxMeshes) {
    threeScene.remove(item.mesh); threeScene.remove(item.edgeMesh);
    item.mesh.geometry.dispose();
    item.edgeMesh.geometry.dispose();
  }
  boxMeshes = [];

  const ex = currentExample;
  const showUnplaced = document.getElementById('show-unplaced').checked;

  ex.dimensions.forEach((dim, i) => {
    // JSON dim order: [x-size, y-size=depth, z-size=height(up)]
    const xSize = dim[0], yDepth = dim[1], zHeight = dim[2];
    const placed = ex.placed_mask[i];
    const rgb = ex.colors[i];                            // [r,g,b] in [0,1]
    const hexColor = rgbToHex(rgb[0], rgb[1], rgb[2]);

    if (!placed && !showUnplaced) return; // skip unplaced entirely if ghost off

    // Three.js BoxGeometry(xSize, yUp, zDepth) — remap JSON z→ThreeY, JSON y→ThreeZ
    const geo = new THREE.BoxGeometry(xSize, zHeight, yDepth);

    // Placed: solid+lambert. Unplaced: ghost.
    const mat = placed
      ? new THREE.MeshLambertMaterial({ color: hexColor, transparent: true, opacity: 0.88 })
      : new THREE.MeshLambertMaterial({ color: hexColor, transparent: true, opacity: 0.15, depthWrite: false });

    const mesh = new THREE.Mesh(geo, mat);
    mesh.castShadow = placed;
    mesh.receiveShadow = placed;
    threeScene.add(mesh);

    const edgeGeo = new THREE.EdgesGeometry(geo);
    const edgeMat = new THREE.LineBasicMaterial({
      color: placed ? 0x000000 : 0x888888,
      transparent: true,
      opacity: placed ? 0.2 : 0.08
    });
    const edgeMesh = new THREE.LineSegments(edgeGeo, edgeMat);
    threeScene.add(edgeMesh);

    boxMeshes.push({ mesh, edgeMesh, placed, boxIdx: i });
  });
}

function rgbToHex(r, g, b) {
  const ri = Math.round(r * 255), gi = Math.round(g * 255), bi = Math.round(b * 255);
  return (ri << 16) | (gi << 8) | bi;
}

// ── Apply a specific keyframe index (with lerp to next) ────────
// centroid from the JSON is the box centre in [0,1]^3 (world coords)
// Three.js bin sits at x∈[0,1], y∈[0,1] (up), z∈[0,1]
// JSON axes: x=left-right, y=depth, z=up  →  Three: x=x, y=z, z=y
function centroidToThree(c) {
  return { x: c[0], y: c[2], z: c[1] };
}

function applyKeyframe(kfIdx, lerpT) {
  if (!currentExample) return;
  const kfs = currentExample.keyframes;
  const kf = kfs[Math.min(kfIdx, kfs.length - 1)];
  const nextKf = kfs[Math.min(kfIdx + 1, kfs.length - 1)];
  const t = (lerpT !== undefined) ? lerpT : 1.0;

  let meshPtr = 0;
  currentExample.dimensions.forEach((dim, i) => {
    const placed = currentExample.placed_mask[i];
    const showUnplaced = document.getElementById('show-unplaced').checked;
    if (!placed && !showUnplaced) return;

    const item = boxMeshes[meshPtr++];
    if (!item) return;

    const c0 = kf.centroids[i];
    const c1 = nextKf.centroids[i];

    // Lerp between keyframes in JSON space
    const cx = c0[0] + (c1[0] - c0[0]) * t;   // JSON x → Three x
    const cy = c0[1] + (c1[1] - c0[1]) * t;   // JSON y (depth) → Three z
    const cz = c0[2] + (c1[2] - c0[2]) * t;   // JSON z (height/up) → Three y

    // Sentinel guard: unplaced boxes use [-1,-1,-1] — hide them far away
    if (!placed && c1[0] === -1 && c1[1] === -1 && c1[2] === -1) {
      item.mesh.position.set(-5, -5, -5);
      item.edgeMesh.position.set(-5, -5, -5);
      return;
    }

    // Remap axes: JSON (x, y=depth, z=up) → Three (x, y=up, z=depth)
    item.mesh.position.set(cx, cz, cy);
    item.edgeMesh.position.copy(item.mesh.position);

    // Opacity: fade in as t_frac drops (noise → clean)
    const tFrac = kf.t_frac + (nextKf.t_frac - kf.t_frac) * t;
    if (placed) {
      const alpha = 0.25 + 0.63 * (1 - tFrac);
      item.mesh.material.opacity = alpha;
      item.edgeMesh.material.opacity = alpha * 0.25;
    }
  });
}

// ── Playback ───────────────────────────────────────────────────
// ── Scrubber ──────────────────────────────────────────────────
let scrubbing = false;

function setScrubberPct(pct) {
  const s = document.getElementById('scrubber');
  const f = document.getElementById('prog-fill');
  if (s) s.value = pct;
  if (f) f.style.width = pct + '%';
}

function onScrubStart() {
  scrubbing = true;
  cancelAnimationFrame(animFrame);
}

function onScrubEnd() {
  scrubbing = false;
  if (isPlaying) playTrajectory();
}

function onScrub(val) {
  if (!currentExample) return;
  const pct = parseFloat(val);
  const kfs = currentExample.keyframes;
  const totalKfs = kfs.length;
  const frac = (pct / 100) * (totalKfs - 1);
  const kfIdx = Math.floor(frac);
  const lerpT = frac - kfIdx;
  frameIdx = Math.min(kfIdx, totalKfs - 1);
  applyKeyframe(frameIdx, lerpT);
  const kf = kfs[Math.min(kfIdx, totalKfs - 1)];
  document.getElementById('step-pct').textContent = Math.round(pct) + '%';
  document.getElementById('step-label').textContent = kf.projected
    ? 'EMS Projection applied ✓'
    : 'Denoising step: ' + kf.step + ' / 250';
  document.getElementById('prog-fill').style.width = pct + '%';
  const tFrac = kf.t_frac;
  const statusMap = [
    [0.85, 'Sampling from Gaussian noise...'],
    [0.60, 'Coarse layout forming...'],
    [0.30, 'Refining positions...'],
    [0.10, 'Convergence — applying projection...'],
    [0.00, 'Final packed layout ✓'],
  ];
  const s = statusMap.find(([thresh]) => tFrac >= thresh);
  document.getElementById('status-text').textContent = s ? s[1] : 'Done ✓';
  if (frameIdx >= totalKfs - 1) {
    document.getElementById('run-btn').textContent = '↺ Replay';
    document.getElementById('status-dot').className = 'status-dot done';
  } else {
    document.getElementById('run-btn').textContent = isPlaying ? '⏸ Pause' : '▶ Resume';
    document.getElementById('status-dot').className = isPlaying ? 'status-dot running' : 'status-dot';
  }
}

function playTrajectory() {
  if (!currentExample) {
    alert('Select an example first.');
    return;
  }
  if (isPlaying) { stopPlayback(); return; }

  isPlaying = true;
  const btn = document.getElementById('run-btn');
  btn.textContent = '⏸ Pause';

  const dot = document.getElementById('status-dot');
  dot.className = 'status-dot running';

  const kfs = currentExample.keyframes;
  const totalKfs = kfs.length;
  const speed = parseFloat(document.getElementById('speed-select').value);

  // ms per keyframe interval (targeting ~30 fps display feel)
  // 30 keyframes over ~4 s at 1× speed → ~133 ms per keyframe
  const msPerKf = 130 / speed;

  let kf = (frameIdx >= totalKfs - 1) ? 0 : frameIdx;  // restart if at end
  frameIdx = kf;

  let lastTime = null;
  let elapsed = 0;

  function tick(now) {
    if (!isPlaying) return;

    if (lastTime !== null) elapsed += (now - lastTime) * speed;
    lastTime = now;

    // Sub-keyframe lerp
    const lerpT = Math.min(elapsed / msPerKf, 1.0);
    applyKeyframe(kf, lerpT);

    // Progress bar
    const pct = Math.round(((kf + lerpT) / (totalKfs - 1)) * 100);
    if (!scrubbing) setScrubberPct(pct);
    document.getElementById('step-pct').textContent = pct + '%';

    const step = kfs[kf].step;
    document.getElementById('step-label').textContent =
      kfs[kf].projected
        ? 'EMS Projection applied ✓'
        : `Denoising step: ${step} / 250`;

    const statusMap = [
      [0.85, 'Sampling from Gaussian noise...'],
      [0.60, 'Coarse layout forming...'],
      [0.30, 'Refining positions...'],
      [0.10, 'Convergence — applying projection...'],
      [0.00, 'Final packed layout ✓'],
    ];
    const tFrac = kfs[kf].t_frac;
    const s = statusMap.find(([thresh]) => tFrac >= thresh);
    document.getElementById('status-text').textContent = s ? s[1] : 'Done ✓';

    if (elapsed >= msPerKf) {
      elapsed -= msPerKf;
      kf++;
      frameIdx = kf;
      if (kf >= totalKfs - 1) {
        // Reached final frame
        applyKeyframe(totalKfs - 1, 1.0);
        stopPlayback(true);
        return;
      }
    }

    animFrame = requestAnimationFrame(tick);
  }

  animFrame = requestAnimationFrame(tick);
}

function stopPlayback(finished) {
  isPlaying = false;
  cancelAnimationFrame(animFrame);
  const btn = document.getElementById('run-btn');
  btn.textContent = frameIdx >= (currentExample ? currentExample.keyframes.length - 1 : 0)
    ? '↺ Replay'
    : '▶ Resume';
  if (finished) {
    document.getElementById('status-dot').className = 'status-dot done';
    document.getElementById('status-text').textContent = 'Done ✓';
    setScrubberPct(100);
    document.getElementById('step-pct').textContent = '100%';
    document.getElementById('step-label').textContent = 'EMS Projection applied ✓';
  }
}

function jumpToFinal() {
  if (!currentExample) return;
  stopPlayback(false);
  frameIdx = currentExample.keyframes.length - 1;
  applyKeyframe(frameIdx, 1.0);
  setScrubberPct(100);
  document.getElementById('step-pct').textContent = '100%';
  document.getElementById('step-label').textContent = 'EMS Projection applied ✓';
  document.getElementById('status-dot').className = 'status-dot done';
  document.getElementById('status-text').textContent = 'Final layout';
  document.getElementById('run-btn').textContent = '↺ Replay';
}

// Rebuild meshes if ghost toggle changes
document.getElementById('show-unplaced').addEventListener('change', () => {
  if (!currentExample) return;
  buildBoxMeshes();
  applyKeyframe(Math.min(frameIdx, currentExample.keyframes.length - 1), 1.0);
});

function copyBibtex() {
  const text = document.getElementById('bibtex-text').innerText;
  navigator.clipboard.writeText(text).then(() => {
    const btn = document.querySelector('.copy-btn');
    btn.textContent = 'Copied!';
    setTimeout(() => btn.textContent = 'Copy', 2000);
  });
}
