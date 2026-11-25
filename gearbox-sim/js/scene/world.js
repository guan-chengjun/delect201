// Three.js 基础场景：渲染器、相机、灯光、雾效、地面、轨道控制器
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

export function createWorld(container) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x20262c);
  scene.fog = new THREE.Fog(0x20262c, 320, 680); // 淡淡雾效，拉开空间层次

  const camera = new THREE.PerspectiveCamera(
    45,
    container.clientWidth / container.clientHeight,
    0.1,
    2000
  );
  camera.position.set(150, 95, 310);

  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(container.clientWidth, container.clientHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap; // 柔和阴影
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  container.appendChild(renderer.domElement);

  // 轨道控制器：左键旋转 / 滚轮缩放 / 右键平移
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.target.set(-8, -5, 0);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.minDistance = 120;
  controls.maxDistance = 700;

  // —— 灯光 ——
  scene.add(new THREE.AmbientLight(0xffffff, 0.6));

  const hemi = new THREE.HemisphereLight(0xbfd4e6, 0x2a2f34, 0.65);
  scene.add(hemi);

  const key = new THREE.DirectionalLight(0xffffff, 2.4);
  key.position.set(160, 240, 220);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.camera.left = -260;
  key.shadow.camera.right = 260;
  key.shadow.camera.top = 220;
  key.shadow.camera.bottom = -220;
  key.shadow.camera.near = 50;
  key.shadow.camera.far = 800;
  key.shadow.bias = -0.0004;
  scene.add(key);

  const fill = new THREE.DirectionalLight(0x9fc0e0, 0.8);
  fill.position.set(-200, 80, -160);
  scene.add(fill);

  // —— 地面（仅接收阴影，保持场景干净）——
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(1200, 900),
    new THREE.MeshStandardMaterial({ color: 0x3a4148, roughness: 0.95, metalness: 0.05 })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -99;
  ground.receiveShadow = true;
  scene.add(ground);

  // 窗口尺寸自适应
  window.addEventListener('resize', () => {
    camera.aspect = container.clientWidth / container.clientHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(container.clientWidth, container.clientHeight);
  });

  return { scene, camera, renderer, controls };
}
