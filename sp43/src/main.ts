import { ClothSimulation } from './ClothSimulation';
import { MOUSE_MODE, type MouseMode } from './types';

let simulation: ClothSimulation;

const canvas = document.getElementById('canvas') as HTMLCanvasElement;
const fpsSpan = document.getElementById('fps') as HTMLSpanElement;
const springCountSpan = document.getElementById('springs') as HTMLSpanElement;
const particleCountSpan = document.getElementById('particles') as HTMLSpanElement;

async function init() {
  try {
    simulation = new ClothSimulation(canvas, (fps) => {
      fpsSpan.textContent = fps.toString();
    });

    await simulation.init();

    springCountSpan.textContent = simulation.getSpringCount().toLocaleString();
    particleCountSpan.textContent = simulation.getParticleCount().toLocaleString();

    setupControls();
    setupMouseHandlers();

    simulation.start();
  } catch (error) {
    console.error('Failed to initialize WebGPU:', error);
    document.body.innerHTML = `
      <div style="display: flex; align-items: center; justify-content: center; height: 100vh; color: #fff; flex-direction: column; padding: 20px;">
        <h2 style="color: #ff6b6b; margin-bottom: 16px;">WebGPU 不受支持</h2>
        <p style="text-align: center; max-width: 500px; line-height: 1.6; color: #aaa;">
          ${error instanceof Error ? error.message : '无法初始化 WebGPU。'}<br><br>
          请使用支持 WebGPU 的浏览器（如 Chrome 113+ 或 Edge），
          并确保已启用 WebGPU 标志。
        </p>
      </div>
    `;
  }
}

function setupControls() {
  const structK = document.getElementById('structK') as HTMLInputElement;
  const structKVal = document.getElementById('structK-val') as HTMLSpanElement;
  structK.addEventListener('input', () => {
    const val = parseFloat(structK.value);
    structKVal.textContent = val.toExponential(1);
    simulation.setStructCompliance(val);
  });

  const shearK = document.getElementById('shearK') as HTMLInputElement;
  const shearKVal = document.getElementById('shearK-val') as HTMLSpanElement;
  shearK.addEventListener('input', () => {
    const val = parseFloat(shearK.value);
    shearKVal.textContent = val.toExponential(1);
    simulation.setShearCompliance(val);
  });

  const bendK = document.getElementById('bendK') as HTMLInputElement;
  const bendKVal = document.getElementById('bendK-val') as HTMLSpanElement;
  bendK.addEventListener('input', () => {
    const val = parseFloat(bendK.value);
    bendKVal.textContent = val.toExponential(1);
    simulation.setBendCompliance(val);
  });

  const damping = document.getElementById('damping') as HTMLInputElement;
  const dampingVal = document.getElementById('damping-val') as HTMLSpanElement;
  damping.addEventListener('input', () => {
    const val = parseFloat(damping.value);
    dampingVal.textContent = val.toFixed(3);
    simulation.setDamping(val);
  });

  const wind = document.getElementById('wind') as HTMLInputElement;
  const windVal = document.getElementById('wind-val') as HTMLSpanElement;
  wind.addEventListener('input', () => {
    const val = parseFloat(wind.value);
    windVal.textContent = val.toFixed(1);
    simulation.setWindStrength(val);
  });

  const tearRadius = document.getElementById('tearRadius') as HTMLInputElement;
  const tearRadiusVal = document.getElementById('tearRadius-val') as HTMLSpanElement;
  tearRadius.addEventListener('input', () => {
    const val = parseInt(tearRadius.value);
    tearRadiusVal.textContent = val.toString();
    simulation.setTearRadius(val);
  });

  const breakThreshold = document.getElementById('breakThreshold') as HTMLInputElement;
  const breakThresholdVal = document.getElementById('breakThreshold-val') as HTMLSpanElement;
  breakThreshold.addEventListener('input', () => {
    const val = parseFloat(breakThreshold.value);
    breakThresholdVal.textContent = val.toFixed(1);
    simulation.setBreakThreshold(val);
  });

  const subSteps = document.getElementById('subSteps') as HTMLInputElement;
  const subStepsVal = document.getElementById('subSteps-val') as HTMLSpanElement;
  subSteps.addEventListener('input', () => {
    const val = parseInt(subSteps.value);
    subStepsVal.textContent = val.toString();
    simulation.setSubSteps(val);
  });

  const modeDrag = document.getElementById('modeDrag') as HTMLButtonElement;
  const modeTear = document.getElementById('modeTear') as HTMLButtonElement;
  const modeForce = document.getElementById('modeForce') as HTMLButtonElement;

  const setActiveMode = (mode: MouseMode, activeBtn: HTMLButtonElement) => {
    simulation.setMouseMode(mode);
    modeDrag.classList.toggle('active', activeBtn === modeDrag);
    modeTear.classList.toggle('active', activeBtn === modeTear);
    modeForce.classList.toggle('active', activeBtn === modeForce);
  };

  modeDrag.addEventListener('click', () => setActiveMode(MOUSE_MODE.DRAG, modeDrag));
  modeTear.addEventListener('click', () => setActiveMode(MOUSE_MODE.TEAR, modeTear));
  modeForce.addEventListener('click', () => setActiveMode(MOUSE_MODE.FORCE, modeForce));

  const resetBtn = document.getElementById('reset') as HTMLButtonElement;
  resetBtn.addEventListener('click', () => {
    simulation.reset();
  });

  const pinToggleBtn = document.getElementById('pinToggle') as HTMLButtonElement;
  pinToggleBtn.addEventListener('click', () => {
    simulation.togglePinnedCorners();
    pinToggleBtn.classList.toggle('active');
  });

  const sphereRadius = document.getElementById('sphereRadius') as HTMLInputElement;
  const sphereRadiusVal = document.getElementById('sphereRadius-val') as HTMLSpanElement;
  sphereRadius.addEventListener('input', () => {
    const val = parseFloat(sphereRadius.value);
    sphereRadiusVal.textContent = val.toFixed(1);
    simulation.setSphereRadius(0, val);
  });

  const selfCollisionToggle = document.getElementById('selfCollisionToggle') as HTMLButtonElement;
  let selfCollisionEnabled = false;
  selfCollisionToggle.addEventListener('click', () => {
    simulation.toggleSelfCollision();
    selfCollisionEnabled = !selfCollisionEnabled;
    selfCollisionToggle.textContent = selfCollisionEnabled ? '自碰撞: 开' : '自碰撞: 关';
    selfCollisionToggle.classList.toggle('active');
  });

  const selfCollisionThickness = document.getElementById('selfCollisionThickness') as HTMLInputElement;
  const selfCollisionThicknessVal = document.getElementById('selfCollisionThickness-val') as HTMLSpanElement;
  selfCollisionThickness.addEventListener('input', () => {
    const val = parseFloat(selfCollisionThickness.value);
    selfCollisionThicknessVal.textContent = val.toFixed(2);
    simulation.setSelfCollisionThickness(val);
  });

  const selfCollisionStiffness = document.getElementById('selfCollisionStiffness') as HTMLInputElement;
  const selfCollisionStiffnessVal = document.getElementById('selfCollisionStiffness-val') as HTMLSpanElement;
  selfCollisionStiffness.addEventListener('input', () => {
    const val = parseFloat(selfCollisionStiffness.value);
    selfCollisionStiffnessVal.textContent = val.toFixed(1);
    simulation.setSelfCollisionStiffness(val);
  });

  const exportBtn = document.getElementById('exportBtn') as HTMLButtonElement;
  const exportFrameCount = document.getElementById('exportFrameCount') as HTMLSpanElement;
  exportBtn.addEventListener('click', () => {
    if (!simulation.isExporting()) {
      simulation.startExport();
      exportBtn.textContent = '停止导出';
      exportBtn.classList.add('active');
    } else {
      const frames = simulation.stopExport();
      exportBtn.textContent = '开始导出 OBJ';
      exportBtn.classList.remove('active');
      downloadObjFrames(frames);
    }
  });

  setInterval(() => {
    if (simulation && simulation.isExporting()) {
      exportFrameCount.textContent = simulation.getExportFrameCount().toString();
    }
  }, 100);

  document.addEventListener('keydown', (e) => {
    if (e.key === '1') setActiveMode(MOUSE_MODE.DRAG, modeDrag);
    if (e.key === '2') setActiveMode(MOUSE_MODE.TEAR, modeTear);
    if (e.key === '3') setActiveMode(MOUSE_MODE.FORCE, modeForce);
    if (e.key === 'r' || e.key === 'R') simulation.reset();
    if (e.key === 'w' || e.key === 'W') {
      simulation.toggleWireframe();
    }
    if (e.key === 's' || e.key === 'S') {
      simulation.toggleStressView();
    }
  });
}

function downloadObjFrames(frames: string[]): void {
  if (frames.length === 0) return;

  const zip: string[] = [];
  frames.forEach((frame, idx) => {
    const filename = `cloth_${idx.toString().padStart(4, '0')}.obj`;
    zip.push(`# ${filename}\n${frame}`);
  });

  const blob = new Blob([frames.join('\n\n')], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `cloth_frames_${frames.length}.txt`;
  a.textContent = '下载 OBJ 帧';
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  frames.forEach((frame, idx) => {
    const blobSingle = new Blob([frame], { type: 'text/plain' });
    const urlSingle = URL.createObjectURL(blobSingle);
    const aSingle = document.createElement('a');
    aSingle.href = urlSingle;
    aSingle.download = `cloth_${idx.toString().padStart(4, '0')}.obj`;
    aSingle.style.display = 'none';
    document.body.appendChild(aSingle);
    setTimeout(() => {
      aSingle.click();
      document.body.removeChild(aSingle);
      URL.revokeObjectURL(urlSingle);
    }, idx * 100);
  });
}

function setupMouseHandlers() {
  let isMouseDown = false;

  canvas.addEventListener('mousedown', (e) => {
    if (e.button === 0) {
      isMouseDown = true;
      simulation.handleMouseDown(e.clientX, e.clientY);
    }
  });

  canvas.addEventListener('mousemove', (e) => {
    if (isMouseDown) {
      simulation.handleMouseMove(e.clientX, e.clientY);
    }
  });

  canvas.addEventListener('mouseup', () => {
    isMouseDown = false;
    simulation.handleMouseUp();
  });

  canvas.addEventListener('mouseleave', () => {
    if (isMouseDown) {
      isMouseDown = false;
      simulation.handleMouseUp();
    }
  });

  canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    simulation.handleWheel(e.deltaY);
  }, { passive: false });

  canvas.addEventListener('touchstart', (e) => {
    e.preventDefault();
    const touch = e.touches[0];
    isMouseDown = true;
    simulation.handleMouseDown(touch.clientX, touch.clientY);
  }, { passive: false });

  canvas.addEventListener('touchmove', (e) => {
    e.preventDefault();
    if (isMouseDown && e.touches.length > 0) {
      const touch = e.touches[0];
      simulation.handleMouseMove(touch.clientX, touch.clientY);
    }
  }, { passive: false });

  canvas.addEventListener('touchend', () => {
    isMouseDown = false;
    simulation.handleMouseUp();
  });
}

init();
