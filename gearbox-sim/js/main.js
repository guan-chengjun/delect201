// 齿轮减速箱 3D 原理仿真 —— 主入口
// 仅做运动学仿真：按传动比驱动各轴旋转，不涉及应力/扭矩等力学计算
import * as THREE from 'three';
import { createWorld } from './scene/world.js';
import { buildGearbox } from './sim/assembly.js';
import { FlowParticles } from './sim/particles.js';
import { shaftSpeeds, RATIO_TOTAL, RATIO_1, RATIO_2 } from './sim/kinematics.js';

const DEFAULT_RPM = 120; // 默认输入转速（滑块范围 0–300 rpm 见 index.html）

// —— UI 元素 ——
const els = {
  play: document.getElementById('btn-play'),
  reset: document.getElementById('btn-reset'),
  particles: document.getElementById('btn-particles'),
  slider: document.getElementById('rpm-slider'),
  sliderValue: document.getElementById('rpm-value'),
  rpmIn: document.getElementById('rpm-in'),
  rpmOut: document.getElementById('rpm-out'),
  ratio: document.getElementById('ratio-text'),
  modelStatus: document.getElementById('model-status'),
};

els.ratio.textContent = `总减速比 ${RATIO_TOTAL.toFixed(2)} : 1（一级 ${RATIO_1.toFixed(2)} : 1 × 二级 ${RATIO_2.toFixed(2)} : 1）`;

// —— 仿真状态 ——
const state = {
  running: true,
  inputRpm: DEFAULT_RPM,
  angles: { in: 0, mid: 0, out: 0 }, // 三根轴累计转角（rad），暂停定格时保持不变
};

const { scene, camera, renderer, controls } = createWorld(document.getElementById('app'));
const assembly = await buildGearbox(scene);
const flow = new FlowParticles(scene);

// 模型来源提示（GLB / 程序化）
els.modelStatus.textContent = assembly.status
  .filter((s) => s.startsWith('GLB'))
  .map((s) => s.replace('GLB: ', ''))
  .join('、') || '程序化模型';

const { inputShaft, midShaft, outputShaft } = assembly.shafts;

// 把累计转角写回各轴组（齿轮初始相位已烘焙在子对象上，这里只叠加轴转动量）
function applyAngles() {
  inputShaft.rotation.x = state.angles.in;
  midShaft.rotation.x = state.angles.mid;
  outputShaft.rotation.x = state.angles.out;
}

function updateReadout() {
  els.rpmIn.textContent = state.running ? state.inputRpm.toFixed(0) : '0';
  els.rpmOut.textContent = state.running ? (state.inputRpm / RATIO_TOTAL).toFixed(1) : '0';
}

// —— 控制按钮 ——
els.play.addEventListener('click', () => {
  state.running = !state.running;
  els.play.textContent = state.running ? '暂停' : '启动';
  els.play.classList.toggle('is-paused', !state.running);
  updateReadout();
});

els.reset.addEventListener('click', () => {
  state.angles = { in: 0, mid: 0, out: 0 };
  applyAngles();
  flow.t = 0;
});

els.particles.addEventListener('click', () => {
  const on = flow.toggle();
  els.particles.classList.toggle('is-off', !on);
  els.particles.textContent = on ? '动力流：开' : '动力流：关';
});

els.slider.addEventListener('input', () => {
  state.inputRpm = Number(els.slider.value);
  els.sliderValue.textContent = state.inputRpm;
  updateReadout();
});

els.slider.value = DEFAULT_RPM;
updateReadout();

// —— 原生 requestAnimationFrame 动画循环 ——
const clock = new THREE.Clock();
function tick() {
  requestAnimationFrame(tick);
  const dt = Math.min(clock.getDelta(), 0.05); // 限制单帧步长，切后台回来不会跳变

  if (state.running) {
    const { wIn, wMid, wOut } = shaftSpeeds(state.inputRpm);
    // 积分各轴转角；转速比严格由齿数决定，保证啮合同步、不错齿
    state.angles.in += wIn * dt;
    state.angles.mid += wMid * dt;
    state.angles.out += wOut * dt;
    applyAngles();
  }

  flow.update(dt, state.inputRpm / DEFAULT_RPM);
  controls.update();
  renderer.render(scene, camera);
}
tick();

// 调试/自动化测试句柄（不影响正常使用），供 CDP 脚本读取运行状态
window.__gearbox = {
  state,
  shafts: { inputShaft, midShaft, outputShaft },
  gears: assembly.gears,
  flow,
  THREE,
  camera,
  controls,
};
