// 减速箱静态部件：底座、剖视箱体、轴承座、电机、联轴器
// 箱体采用剖视设计（缺前壁、无顶盖），内部两级齿轮全程可见
import * as THREE from 'three';

const STEEL = { roughness: 0.45, metalness: 0.75 };

function box(w, h, d, mat, x, y, z, parent) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

// 底座 + 箱体外壳
export function createHousing(materials) {
  const g = new THREE.Group();
  const { housing, base, dark } = materials;

  // —— 底座（左侧加宽以承托外置电机）——
  box(330, 10, 150, base, -35, -93, 0, g); // 范围 x∈[-200,130]
  // 底座上沿凸边
  box(320, 4, 8, housing, -35, -85.5, -70, g);
  box(320, 4, 8, housing, -35, -85.5, 70, g);
  // 四颗地脚螺栓（只做外形）
  for (const x of [-180, 110]) {
    for (const z of [-58, 58]) {
      const b = new THREE.Mesh(new THREE.CylinderGeometry(4.5, 4.5, 3, 6), dark);
      b.position.set(x, -86.5, z);
      b.castShadow = true;
      g.add(b);
    }
  }

  // —— 剖视箱体：内壁范围 x∈[-100,100]，y∈[-78,78]，z∈[-55,55] ——
  const t = 6; // 壁厚
  // 后壁
  box(206, 162, t, housing, 0, 0, -58, g);
  // 前壁上下两根边框（中间敞开，形成剖视窗口）
  box(206, 12, t, housing, 0, -75, 58, g);
  box(206, 12, t, housing, 0, 75, 58, g);
  // 左右端壁（三根轴从这里穿出，视觉上被轴承座盖住）
  box(t, 162, 116, housing, -103, 0, 0, g);
  box(t, 162, 116, housing, 103, 0, 0, g);
  // 顶部前后边框
  box(206, 8, 10, housing, 0, 82, -55, g);
  box(206, 8, 10, housing, 0, 82, 55, g);

  // —— 轴承座（三根轴两端共 6 处）——
  for (const y of [-52, 0, 48]) {
    for (const x of [-103, 103]) {
      const block = box(14, 20, 20, dark, x, y, 0, g);
      block.material = dark;
      const ringGeo = new THREE.CylinderGeometry(9, 9, 4, 24);
      ringGeo.rotateZ(Math.PI / 2);
      const ring = new THREE.Mesh(ringGeo, housing);
      ring.position.set(x + (x < 0 ? -7.5 : 7.5), y, 0);
      ring.castShadow = true;
      g.add(ring);
    }
  }
  return g;
}

// 电机（装在输入轴外侧、底座上方），带散热筋和接线盒
export function createMotor(materials) {
  const g = new THREE.Group();
  const { motor, dark } = materials;

  const bodyLen = 56;
  const bodyR = 20;
  const bodyGeo = new THREE.CylinderGeometry(bodyR, bodyR, bodyLen, 36);
  bodyGeo.rotateZ(Math.PI / 2);
  const body = new THREE.Mesh(bodyGeo, motor);
  body.castShadow = true;
  body.receiveShadow = true;
  g.add(body);

  // 后端盖
  const capGeo = new THREE.CylinderGeometry(bodyR + 2, bodyR + 2, 4, 36);
  capGeo.rotateZ(Math.PI / 2);
  const cap = new THREE.Mesh(capGeo, dark);
  cap.position.x = -bodyLen / 2 - 1;
  cap.castShadow = true;
  g.add(cap);

  // 散热筋（沿轴向均布 8 条）
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const rib = new THREE.Mesh(new THREE.BoxGeometry(bodyLen - 6, 2, 4), dark);
    rib.position.set(0, Math.cos(a) * (bodyR + 1), Math.sin(a) * (bodyR + 1));
    rib.rotation.x = a;
    rib.castShadow = true;
    g.add(rib);
  }

  // 顶部接线盒
  const term = new THREE.Mesh(new THREE.BoxGeometry(22, 8, 14), dark);
  term.position.set(-4, bodyR + 5, 0);
  term.castShadow = true;
  g.add(term);

  // 电机支座：实心垫台，从底座顶面（y=-88）托到电机底部（中心-半径=-72）
  box(54, 16, 30, dark, 0, -80, 0, g);
  // 垫台两侧加强筋
  box(8, 16, 30, dark, -27, -80, 0, g);
  box(8, 16, 30, dark, 27, -80, 0, g);

  // 定位到输入轴高度，法兰端朝箱体左端壁（留联轴器间隙）
  g.position.set(-140, -52, 0);
  return g;
}

// 输出轴末端的联轴器圆盘（带标记，低速转动肉眼可辨）
export function createCoupling(radius, material) {
  const g = new THREE.Group();
  const discGeo = new THREE.CylinderGeometry(radius, radius, 10, 32);
  discGeo.rotateZ(Math.PI / 2);
  const disc = new THREE.Mesh(discGeo, material);
  disc.castShadow = true;
  g.add(disc);

  const mark = new THREE.Mesh(
    new THREE.BoxGeometry(11, 2.4, radius * 0.9),
    new THREE.MeshStandardMaterial({ color: 0xf08a2e, roughness: 0.5, metalness: 0.3 })
  );
  mark.position.y = radius * 0.55;
  g.add(mark);
  return g;
}

export function staticMaterials() {
  return {
    housing: new THREE.MeshStandardMaterial({ color: 0x71808e, ...STEEL }),
    base: new THREE.MeshStandardMaterial({ color: 0x55616c, ...STEEL }),
    dark: new THREE.MeshStandardMaterial({ color: 0x333c44, roughness: 0.5, metalness: 0.7 }),
    motor: new THREE.MeshStandardMaterial({ color: 0x2f6f7d, roughness: 0.55, metalness: 0.55 }),
    shaft: new THREE.MeshStandardMaterial({ color: 0xd3dbe1, roughness: 0.3, metalness: 0.85 }),
    gear: new THREE.MeshStandardMaterial({ color: 0xb9c4cd, roughness: 0.35, metalness: 0.75 }),
    gearDark: new THREE.MeshStandardMaterial({ color: 0x728394, roughness: 0.4, metalness: 0.75 }),
    ground: new THREE.MeshStandardMaterial({ color: 0x3a4148, roughness: 0.95, metalness: 0.05 }),
  };
}
