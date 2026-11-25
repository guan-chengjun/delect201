// 啮合正确性校验（纯数学，不依赖浏览器）
// 正确的啮合判据：任意时刻，两轮在接触点处的「齿-槽相位分数」互补（和为整数），
// 即主动轮某齿心到达接触点的同一瞬间，从动轮齿槽中心也到达接触点。
//   齿 k 世界角 = C + k·pitch - rot（C=π/2，rotateX 使点角减小）
//   主动轮接触点(角0)相位分数 fA = mod(rotA - C, pa) / pa
//   从动轮接触点(角π)相位分数 fB = mod(rotB - (C + π/Zb - π), pb) / pb
//   啮合条件：mod(fA + fB, 1) = 0
import { TEETH, GEARS, PHASES, SHAFTS, shaftSpeeds, RATIO_TOTAL, MODULE } from '../js/sim/kinematics.js';

const TWO_PI = Math.PI * 2;
const mod = (a, n) => ((a % n) + n) % n;
const approx = (a, b, eps = 1e-9) => Math.abs(a - b) < eps;
const C = Math.PI / 2; // 0 号齿在 rot=0 时的世界角

let passed = 0;
const check = (name, cond, detail = '') => {
  if (cond) {
    passed++;
    console.log(`  ✓ ${name}`);
  } else {
    console.error(`  ✗ ${name} ${detail}`);
    process.exitCode = 1;
  }
};

const pairs = [
  ['Z1', 'Z2', Math.abs(SHAFTS.input.y - SHAFTS.intermediate.y)],
  ['Z3', 'Z4', Math.abs(SHAFTS.output.y - SHAFTS.intermediate.y)],
];

console.log('1) 中心距校验（= 分度圆半径之和，同模数才能啮合）');
for (const [a, b, dist] of pairs) {
  const sum = GEARS[a].pitchRadius + GEARS[b].pitchRadius;
  check(`${a}-${b} 中心距 ${dist} = ${sum}`, approx(dist, sum));
  check(`${a}-${b} 模数一致（m=${MODULE}）`, GEARS[a].module === GEARS[b].module);
}

console.log('2) 初始啮合校验（t=0：主动齿心与从动齿槽中心同时位于接触点）');
for (const [a, b] of pairs) {
  const toothA = C - PHASES[a]; // 主动轮 0 号齿世界角，应对准接触点 0
  const gapB = C + Math.PI / TEETH[b] - PHASES[b]; // 从动轮 0 号齿槽世界角，应对准 π
  check(`${a} 齿心对准接触点(+Y)`, approx(mod(toothA, TWO_PI), 0, 1e-12));
  check(`${b} 齿槽中心对准接触点(-Y)`, approx(mod(gapB, TWO_PI), Math.PI, 1e-12));
}

console.log('3) 动态啮合校验（5000 个时刻：相位分数互补 + 线速度不变量）');
const { wIn, wMid, wOut } = shaftSpeeds(120);
const shaftW = { Z1: wIn, Z2: wMid, Z3: wMid, Z4: wOut };
for (const [a, b] of pairs) {
  const pa = TWO_PI / TEETH[a];
  const pb = TWO_PI / TEETH[b];
  const baseA = C;
  const baseB = C + Math.PI / TEETH[b] - Math.PI;

  // 线速度不变量：接触点节圆线速度等大反向 → wA·Za + wB·Zb = 0
  const velResidual = Math.abs(shaftW[a] * TEETH[a] + shaftW[b] * TEETH[b]);
  check(`${a}-${b} 节圆线速度不变量（残差 ${velResidual.toExponential(2)}）`, velResidual < 1e-10);

  let maxPhaseErr = 0;
  for (let s = 0; s <= 5000; s++) {
    const t = s * 0.002;
    const fA = mod(PHASES[a] + shaftW[a] * t - baseA, pa) / pa;
    const fB = mod(PHASES[b] + shaftW[b] * t - baseB, pb) / pb;
    const sum = mod(fA + fB, 1);
    maxPhaseErr = Math.max(maxPhaseErr, Math.min(sum, 1 - sum));
  }
  check(`${a}-${b} 全程齿-槽相位互补（最大偏差 ${maxPhaseErr.toExponential(2)}）`, maxPhaseErr < 1e-9);
}

console.log('4) 传动比与转向校验');
const expectedTotal = (TEETH.Z2 / TEETH.Z1) * (TEETH.Z4 / TEETH.Z3);
check(`总减速比 ${expectedTotal.toFixed(2)}:1（计算值 ${RATIO_TOTAL.toFixed(4)}）`, approx(RATIO_TOTAL, expectedTotal, 1e-9));
check('一级外啮合反向 wMid/wIn = -Z1/Z2', approx(wMid / wIn, -TEETH.Z1 / TEETH.Z2, 1e-12));
check('二级外啮合反向 wOut/wMid = -Z3/Z4', approx(wOut / wMid, -TEETH.Z3 / TEETH.Z4, 1e-12));
check('输出轴与输入轴同向（两级反向叠加）', wIn * wOut > 0);
check('输出转速 = 输入转速 / 总减速比', approx(wOut, wIn / RATIO_TOTAL, 1e-12));

console.log(`\n结果：${passed} 项通过${process.exitCode ? '，存在失败项' : '，全部通过'}`);
