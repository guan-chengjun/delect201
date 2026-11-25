// 外部 GLB 模型加载
// 每个仿真部件先尝试加载 models/*.glb；文件缺失或解析失败时，
// 由调用方使用程序化几何兜底，保证项目在任何情况下都能直接运行
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const loader = new GLTFLoader();

export function loadGLB(path) {
  return new Promise((resolve, reject) => {
    loader.load(
      path,
      (gltf) => resolve(gltf.scene),
      undefined,
      (err) => reject(err)
    );
  });
}

// 统一替换：把程序化对象的子 Mesh 换成 GLB 根对象，保留外层 Group 的位姿
export function swapIn(root, glbScene) {
  root.clear();
  glbScene.traverse((obj) => {
    if (obj.isMesh) {
      obj.castShadow = true;
      obj.receiveShadow = true;
    }
  });
  root.add(glbScene);
}

// 尝试加载，失败则返回 null（不抛异常，由调用方保留程序化模型）
export async function tryLoadGLB(path) {
  try {
    return await loadGLB(path);
  } catch (err) {
    console.warn(`[GLB] ${path} 加载失败，使用程序化模型：`, err.message ?? err);
    return null;
  }
}
