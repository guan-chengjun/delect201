// 渐开线直齿圆柱齿轮的程序化建模
// 采用标准渐开线齿廓 + 拉伸成型，无需外部建模软件
// 生成后将齿轮轴线对齐到世界 X 轴（与减速箱三根轴一致）
import * as THREE from 'three';

// 极坐标 -> Shape 平面坐标
// 世界角约定 = 变换后 YZ 平面角 atan2(y, z)：θ=0 为 +Y，θ 正向为 +Y→+Z。
// rotateY(-90°) 把 Shape 角 a 映射为世界角 a-π/2，故 a = π/2 + θ。
// 此时 rotation.x 取正值，世界角减小（右手定则），物理意义明确。
function polar(radius, worldAngle) {
  const a = Math.PI / 2 + worldAngle;
  return new THREE.Vector2(radius * Math.cos(a), radius * Math.sin(a));
}

// 构建标准直齿齿轮的齿廓 Shape
export function createGearShape({ teeth, module: m, pressureAngle: alpha, boreRadius }) {
  const pitchR = (m * teeth) / 2; // 分度圆
  const outerR = pitchR + m; // 齿顶圆（齿顶高 = m）
  const rootR = pitchR - 1.25 * m; // 齿根圆（齿根高 = 1.25m）
  const baseR = pitchR * Math.cos(alpha); // 基圆
  const pitch = (2 * Math.PI) / teeth; // 齿距角

  // 渐开线展开角函数 inv(t) = tan(t) - t，这里 t 用滚动角参数
  const inv = (t) => t - Math.atan(t);
  const invAlpha = Math.tan(alpha) - alpha; // 分度圆处展角
  const halfTooth = Math.PI / (2 * teeth); // 分度圆上半齿厚角
  const delta = halfTooth - invAlpha; // 齿侧在分度圆处相对齿心的偏角

  // 滚动角范围（滚动角 t 处压力角 = atan(t)，半径 = baseR·√(1+t²)）
  const tTip = Math.sqrt((outerR / baseR) ** 2 - 1);
  const flankStartsInsideBase = rootR <= baseR;
  const tRoot = flankStartsInsideBase ? 0 : Math.sqrt((rootR / baseR) ** 2 - 1);
  const phiRoot = flankStartsInsideBase ? delta - invAlpha : delta - invAlpha + inv(tRoot);
  const phiTip = delta - invAlpha + inv(tTip);

  const shape = new THREE.Shape();
  const flankSamples = 7; // 单侧渐开线采样数

  for (let k = 0; k < teeth; k++) {
    const c = k * pitch; // 本齿中心角
    const pts = [];

    // 1) 齿根 -> 渐开线起点（基圆大于齿根圆时为径向直线段）
    pts.push(polar(rootR, c + phiRoot));
    if (flankStartsInsideBase) pts.push(polar(baseR, c + phiRoot));

    // 2) 右侧渐开线（基圆 -> 齿顶）
    for (let i = 1; i <= flankSamples; i++) {
      const t = tRoot + ((tTip - tRoot) * i) / flankSamples;
      const ang = c + delta - invAlpha + inv(t);
      pts.push(polar(baseR * Math.sqrt(1 + t * t), ang));
    }

    // 3) 齿顶圆弧
    const tipA = c + phiTip;
    const tipB = c + pitch - phiTip;
    pts.push(polar(outerR, (tipA + tipB) / 2));
    pts.push(polar(outerR, tipB));

    // 4) 左侧渐开线（右侧关于齿心镜像，自齿顶收回齿根）
    for (let i = flankSamples; i >= 0; i--) {
      const t = tRoot + ((tTip - tRoot) * i) / flankSamples;
      const ang = c + pitch - (delta - invAlpha + inv(t));
      pts.push(polar(baseR * Math.sqrt(1 + t * t), ang));
    }
    if (flankStartsInsideBase) pts.push(polar(rootR, c + pitch - phiRoot));

    // 5) 齿根圆弧过渡到下一齿（2 个中间点保证圆滑）
    const gapA = c + pitch - phiRoot;
    const gapB = c + pitch + phiRoot;
    pts.push(polar(rootR, gapA + (gapB - gapA) / 3));
    pts.push(polar(rootR, gapA + (2 * (gapB - gapA)) / 3));
    pts.push(polar(rootR, gapB));

    if (k === 0) shape.moveTo(pts[0].x, pts[0].y);
    pts.forEach((p) => shape.lineTo(p.x, p.y));
  }
  shape.closePath();

  // 中心轴孔（顺时针方向，与外轮廓相反）
  const hole = new THREE.Path();
  hole.absarc(0, 0, boreRadius, 0, Math.PI * 2, true);
  shape.holes.push(hole);
  return shape;
}

// 创建一个完整齿轮组：轮齿 + 轮毂 + 转动标记（用于肉眼观察转速）
export function createGearGroup(def, material) {
  const group = new THREE.Group();

  const shape = createGearShape(def);
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: def.width,
    bevelEnabled: true,
    bevelThickness: 0.6,
    bevelSize: 0.5,
    bevelSegments: 2,
  });
  geo.translate(0, 0, -def.width / 2); // 拉伸方向居中
  geo.rotateY(-Math.PI / 2); // 拉伸轴（Z）对齐世界 X 轴
  geo.computeVertexNormals();

  const wheel = new THREE.Mesh(geo, material);
  wheel.castShadow = true;
  wheel.receiveShadow = true;
  group.add(wheel);

  // 轮毂（两侧凸出的圆柱台，增强写实感）
  const hubR = def.boreRadius * 1.9;
  const hubLen = def.width + 5;
  const hubGeo = new THREE.CylinderGeometry(hubR, hubR, hubLen, 32);
  hubGeo.rotateZ(Math.PI / 2); // 圆柱默认沿 Y，转到 X
  const hub = new THREE.Mesh(hubGeo, material);
  hub.castShadow = true;
  group.add(hub);

  // 橙色标记条：贴在轮毂圆柱面 +Y 处，与 0 号齿同方位，随齿轮转动便于观察啮合与转向
  const markGeo = new THREE.BoxGeometry(hubLen + 1, 1.6, 0.8);
  const markMat = new THREE.MeshStandardMaterial({ color: 0xf08a2e, roughness: 0.5, metalness: 0.3 });
  const mark = new THREE.Mesh(markGeo, markMat);
  mark.position.set(0, hubR + 0.3, 0); // 世界角 θ=0 处，与 0 号齿同方位
  group.add(mark);

  return group;
}

// 沿 X 轴的光轴
export function createShaft(length, radius, material) {
  const geo = new THREE.CylinderGeometry(radius, radius, length, 28);
  geo.rotateZ(Math.PI / 2);
  const mesh = new THREE.Mesh(geo, material);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}
