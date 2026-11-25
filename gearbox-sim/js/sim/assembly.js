// 减速箱总装：静态部件 + 三根可转动轴组 + GLB 模型替换
import * as THREE from 'three';
import { GEARS, PHASES, SHAFTS } from './kinematics.js';
import { createGearGroup, createShaft } from '../geometry/gear.js';
import { createHousing, createMotor, createCoupling, staticMaterials } from '../geometry/housing.js';
import { swapIn, tryLoadGLB } from './modelLoader.js';

export async function buildGearbox(scene) {
  const mats = staticMaterials();
  const root = new THREE.Group();
  scene.add(root);

  // —— 静态部件（不参与旋转）——
  const staticGroup = new THREE.Group();
  root.add(staticGroup);

  const housing = createHousing(mats);
  staticGroup.add(housing);

  const motor = createMotor(mats);
  staticGroup.add(motor);

  // —— 旋转部件：每根轴一个 Group，绕自身 X 轴整体转动 ——
  // 轴网格单独放 mesh 子组，便于 GLB 替换时不影响挂在轴上的齿轮
  const shaftGroup = new THREE.Group();
  root.add(shaftGroup);

  const makeShaft = (length, radius, y) => {
    const g = new THREE.Group();
    g.position.set(0, y, 0);
    const mesh = new THREE.Group();
    mesh.add(createShaft(length, radius, mats.shaft));
    g.add(mesh);
    shaftGroup.add(g);
    return { group: g, mesh };
  };

  const input = makeShaft(168, SHAFTS.input.radius, SHAFTS.input.y);
  const mid = makeShaft(214, SHAFTS.intermediate.radius, SHAFTS.intermediate.y);
  const output = makeShaft(168, SHAFTS.output.radius, SHAFTS.output.y);

  // 电机-输入轴联轴器（在箱体外、电机法兰与端壁之间，随输入轴一起转动）
  const inputCoupling = createCoupling(8, mats.shaft);
  inputCoupling.scale.set(0.7, 1, 1);
  inputCoupling.position.set(-118, SHAFTS.input.y, 0);
  input.group.add(inputCoupling);

  // —— 四个齿轮：按轴系位置和啮合相位安放 ——
  const gearZ1 = createGearGroup(GEARS.Z1, mats.gear);
  gearZ1.position.set(SHAFTS.input.gearX, SHAFTS.input.y, 0);
  gearZ1.rotation.x = PHASES.Z1;

  const gearZ2 = createGearGroup(GEARS.Z2, mats.gearDark);
  gearZ2.position.set(SHAFTS.intermediate.gearX, SHAFTS.intermediate.y, 0);
  gearZ2.rotation.x = PHASES.Z2;

  const gearZ3 = createGearGroup(GEARS.Z3, mats.gear);
  gearZ3.position.set(SHAFTS.intermediate.gear2X, SHAFTS.intermediate.y, 0);
  gearZ3.rotation.x = PHASES.Z3;

  const gearZ4 = createGearGroup(GEARS.Z4, mats.gearDark);
  gearZ4.position.set(SHAFTS.output.gearX, SHAFTS.output.y, 0);
  gearZ4.rotation.x = PHASES.Z4;

  // 齿轮挂到对应轴组上（轴组转动时齿轮、轴、标记同步转动）
  input.group.attach(gearZ1);
  mid.group.attach(gearZ2);
  mid.group.attach(gearZ3);
  output.group.attach(gearZ4);

  // 输出端联轴器（随输出轴转动，橙色标记便于观察低速输出）
  const coupling = createCoupling(11, mats.shaft);
  coupling.position.set(118, SHAFTS.output.y, 0);
  output.group.attach(coupling);

  // —— 尝试用外部 GLB 替换程序化部件（失败则静默保留原模型）——
  const status = [];
  const replace = async (obj, file) => {
    const glb = await tryLoadGLB(`models/${file}`);
    if (glb) {
      swapIn(obj, glb);
      status.push(`GLB: ${file}`);
    } else {
      status.push(`程序化: ${file}`);
    }
  };

  await Promise.all([
    replace(housing, 'housing.glb'),
    replace(motor, 'motor.glb'),
    replace(gearZ1, 'gear_z1.glb'),
    replace(gearZ2, 'gear_z2.glb'),
    replace(gearZ3, 'gear_z3.glb'),
    replace(gearZ4, 'gear_z4.glb'),
    replace(input.mesh, 'shaft_input.glb'),
    replace(mid.mesh, 'shaft_intermediate.glb'),
    replace(output.mesh, 'shaft_output.glb'),
  ]);

  return {
    shafts: { inputShaft: input.group, midShaft: mid.group, outputShaft: output.group },
    gears: { gearZ1, gearZ2, gearZ3, gearZ4 },
    status,
  };
}
