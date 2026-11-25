// 动力流向标记粒子（可选功能）
// 一串沿动力传递路径缓慢移动的光点：电机 -> 一级啮合 -> 二级啮合 -> 输出端
import * as THREE from 'three';

export class FlowParticles {
  constructor(scene) {
    this.enabled = true;
    this.t = 0;
    this.count = 26;

    // 动力路径（与实际轴系位置对应）
    this.curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-168, -52, 26),
      new THREE.Vector3(-112, -52, 26),
      new THREE.Vector3(-30, -52, 26),
      new THREE.Vector3(-30, -26, 26), // 一级啮合区
      new THREE.Vector3(-30, 0, 26),
      new THREE.Vector3(0, 0, 26),
      new THREE.Vector3(30, 0, 26),
      new THREE.Vector3(30, 24, 26), // 二级啮合区
      new THREE.Vector3(30, 48, 26),
      new THREE.Vector3(135, 48, 26),
    ]);

    // 路径上叠一条很淡的引导管，帮助读出流向
    const tube = new THREE.Mesh(
      new THREE.TubeGeometry(this.curve, 120, 0.6, 8, false),
      new THREE.MeshStandardMaterial({
        color: 0xf0a04a,
        emissive: 0x8a4a10,
        transparent: true,
        opacity: 0.35,
        roughness: 0.6,
      })
    );
    scene.add(tube);
    this.tube = tube;

    // 粒子贴图（径向渐变软光点）
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const ctx = c.getContext('2d');
    const grad = ctx.createRadialGradient(32, 32, 2, 32, 32, 30);
    grad.addColorStop(0, 'rgba(255,190,100,1)');
    grad.addColorStop(1, 'rgba(255,150,60,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 64, 64);
    const sprite = new THREE.CanvasTexture(c);

    const positions = new Float32Array(this.count * 3);
    this.geo = new THREE.BufferGeometry();
    this.geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    this.points = new THREE.Points(
      this.geo,
      new THREE.PointsMaterial({
        size: 7,
        map: sprite,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        opacity: 0.9,
      })
    );
    scene.add(this.points);
    this.updatePositions();
  }

  updatePositions() {
    const attr = this.geo.attributes.position;
    for (let i = 0; i < this.count; i++) {
      const u = (this.t + i / this.count) % 1;
      const p = this.curve.getPointAt(u);
      attr.setXYZ(i, p.x, p.y, p.z);
    }
    attr.needsUpdate = true;
  }

  // dt: 秒；speedRatio: 当前输入转速相对默认转速的比例
  update(dt, speedRatio) {
    if (!this.enabled) return;
    this.t = (this.t + dt * 0.05 * Math.max(speedRatio, 0.08)) % 1;
    this.updatePositions();
  }

  toggle() {
    this.enabled = !this.enabled;
    this.points.visible = this.enabled;
    this.tube.visible = this.enabled;
    return this.enabled;
  }
}
