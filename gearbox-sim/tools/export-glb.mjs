// 离线生成各部件的 GLB 模型（运行一次即可，输出到 models/）
// 复用浏览器端同一套程序化几何，保证 GLB 与兜底模型外形一致
// 用法：node tools/export-glb.mjs
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

// Node 环境给 GLTFExporter 补齐 FileReader（仅需 readAsArrayBuffer + onloadend）
globalThis.FileReader = class {
  readAsArrayBuffer(blob) {
    blob.arrayBuffer().then((ab) => {
      this.result = ab;
      this.onloadend?.({ target: this });
    });
  }
};

import * as THREE from 'three';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';
import { createGearGroup, createShaft } from '../js/geometry/gear.js';
import { createHousing, createMotor, staticMaterials } from '../js/geometry/housing.js';
import { GEARS, SHAFTS } from '../js/sim/kinematics.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const outDir = join(__dirname, '..', 'models');
mkdirSync(outDir, { recursive: true });

const exporter = new GLTFExporter();
const saveGLB = (root, name) =>
  new Promise((resolve, reject) => {
    exporter.parse(
      root,
      (buffer) => {
        const file = join(outDir, name);
        writeFileSync(file, Buffer.from(buffer));
        console.log(`✓ ${name}  (${(buffer.byteLength / 1024).toFixed(1)} KB)`);
        resolve();
      },
      reject,
      { binary: true }
    );
  });

const mats = staticMaterials();
const jobs = [];

// —— 四个齿轮（含轮毂与标记，原点在轴心）——
jobs.push(() => saveGLB(createGearGroup(GEARS.Z1, mats.gear), 'gear_z1.glb'));
jobs.push(() => saveGLB(createGearGroup(GEARS.Z2, mats.gearDark), 'gear_z2.glb'));
jobs.push(() => saveGLB(createGearGroup(GEARS.Z3, mats.gear), 'gear_z3.glb'));
jobs.push(() => saveGLB(createGearGroup(GEARS.Z4, mats.gearDark), 'gear_z4.glb'));

// —— 三根轴（原点在各自轴心，沿 X 轴）——
jobs.push(() => saveGLB(createShaft(168, SHAFTS.input.radius, mats.shaft), 'shaft_input.glb'));
jobs.push(() => saveGLB(createShaft(214, SHAFTS.intermediate.radius, mats.shaft), 'shaft_intermediate.glb'));
jobs.push(() => saveGLB(createShaft(168, SHAFTS.output.radius, mats.shaft), 'shaft_output.glb'));

// —— 箱体（含底座）与电机 ——
jobs.push(() => saveGLB(createHousing(mats), 'housing.glb'));
jobs.push(() => saveGLB(createMotor(mats), 'motor.glb'));

for (const job of jobs) await job();
console.log(`\n全部 GLB 已输出到 models/，共 ${jobs.length} 个部件`);
