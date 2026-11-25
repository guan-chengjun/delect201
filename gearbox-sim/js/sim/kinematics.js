// 齿轮减速箱运动学参数
// 布局：三根平行轴（轴线沿世界 X 轴），齿轮在 ZY 平面内啮合
//   输入轴 -> 一级小齿轮 Z1 啮合大齿轮 Z2（中间轴）
//   中间轴 -> 二级小齿轮 Z3 啮合末级大齿轮 Z4（输出轴）

export const MODULE = 2; // 齿轮模数 m，所有齿轮同模数才能正确啮合
const ALPHA = (20 * Math.PI) / 180; // 压力角 20°

// 各级齿数
export const TEETH = { Z1: 12, Z2: 40, Z3: 12, Z4: 36 };

// 传动比（外啮合：从动轮转向相反，转速比 = -主动齿数/从动齿数）
export const RATIO_1 = TEETH.Z2 / TEETH.Z1; // 一级减速比 10/3
export const RATIO_2 = TEETH.Z4 / TEETH.Z3; // 二级减速比 3
export const RATIO_TOTAL = RATIO_1 * RATIO_2; // 总减速比 10

// 各轴轴心位置（x 为轴向位置，y 为高度，z 均为 0）
// 中心距 = 分度圆半径之和：一级 12+40=52，二级 12+36=48
export const SHAFTS = {
  input: { y: -52, z: 0, gearX: -30, radius: 4 },
  intermediate: { y: 0, z: 0, gearX: -30, gear2X: 30, radius: 5 },
  output: { y: 48, z: 0, gearX: 30, radius: 6 },
};

// 单个齿轮的完整几何/运动学描述
function gearDef(teeth, boreRadius, width, color) {
  const r = (MODULE * teeth) / 2; // 分度圆半径
  return {
    teeth,
    module: MODULE,
    pressureAngle: ALPHA,
    width,
    boreRadius,
    pitchRadius: r,
    outerRadius: r + MODULE, // 齿顶圆
    color,
  };
}

export const GEARS = {
  Z1: gearDef(TEETH.Z1, 4.4, 14, 0x9aa4af),
  Z2: gearDef(TEETH.Z2, 5.4, 16, 0x4f5d6b),
  Z3: gearDef(TEETH.Z3, 5.4, 14, 0x9aa4af),
  Z4: gearDef(TEETH.Z4, 6.4, 16, 0x46586a),
};

// 啮合初始相位（弧度），由 gear.js 的实际变换链数值标定（见 tools/verify-meshing.mjs）。
// 角度约定：世界角 θ = atan2(y, z)，θ=0 为 +Y；rotation.x=r 时点角按 θ=θ0-r 变化。
// rotateY(-90°) 后，0 号齿齿心在 rot=0 时位于 θ=+π/2；齿槽 k=0 中心位于 π/2+π/Z。
// 接触点世界角：主动轮 +Y 侧 θ=0，从动轮 -Y 侧 θ=π。
//   主动轮齿心对准接触点：π/2 - phaseA = 0            → phaseA = π/2
//   从动轮齿槽对准接触点：π/2 + π/Zb - phaseB = π     → phaseB = π/2 + π/Zb - π
// 动态啮合条件：两轮在接触点的齿-槽相位分数互补（和为整数）；
// 节圆线速度不变量 wA·Za + wB·Zb = 0，与外啮合速比 wB = -wA·Za/Zb 等价。
export const PHASES = {
  Z1: Math.PI / 2,
  Z2: Math.PI / 2 + Math.PI / TEETH.Z2 - Math.PI,
  Z3: Math.PI / 2,
  Z4: Math.PI / 2 + Math.PI / TEETH.Z4 - Math.PI,
};

// 由输入轴转速（rpm）计算三根轴的角速度（rad/s，rotation.x 取值）。
// 外啮合平行轴物理转向相反：接触点处两轮齿面速度方向必须相反，
// 故 rot 数值异号，速比大小严格等于主动齿数/从动齿数；两级后输出与输入同向。
export function shaftSpeeds(inputRpm) {
  const wIn = (inputRpm * 2 * Math.PI) / 60;
  const wMid = -wIn * (TEETH.Z1 / TEETH.Z2); // 一级外啮合：反向减速
  const wOut = -wMid * (TEETH.Z3 / TEETH.Z4); // 二级外啮合：再次反向
  return { wIn, wMid, wOut };
}
