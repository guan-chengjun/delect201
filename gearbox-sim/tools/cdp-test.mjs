// 通过 Chrome DevTools Protocol 做端到端功能验证（无需第三方库，Node 22 内置 WebSocket/fetch）
// 前置：以 --remote-debugging-port=9222 启动的 Chrome 已打开仿真页
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const CDP_HTTP = `http://localhost:${process.env.CDP_PORT || 9222}`;
const TARGET_URL = 'http://localhost:8214/';
const here = dirname(fileURLToPath(import.meta.url));

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function getPageWS() {
  const list = await (await fetch(`${CDP_HTTP}/json`)).json();
  // 取任意 page target（含 about:blank），由脚本主动导航，避免依赖启动 URL
  const page = list.find((t) => t.type === 'page');
  if (!page) throw new Error('未找到可用页面 target');
  return page.webSocketDebuggerUrl;
}

const ws = new WebSocket(await getPageWS());
await new Promise((r) => (ws.onopen = r));
let msgId = 0;
const pending = new Map();
ws.onmessage = (e) => {
  const m = JSON.parse(e.data);
  if (m.id && pending.has(m.id)) {
    pending.get(m.id)(m);
    pending.delete(m.id);
  }
};
const cdp = (method, params = {}) =>
  new Promise((resolve) => {
    const id = ++msgId;
    pending.set(id, resolve);
    ws.send(JSON.stringify({ id, method, params }));
  });

// 在页面执行表达式并取回可序列化结果
async function evalJs(expression) {
  const r = await cdp('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  if (r.result?.exceptionDetails) throw new Error('页面异常: ' + JSON.stringify(r.result.exceptionDetails));
  return r.result?.result?.value;
}
const waitInPage = (ms) => evalJs(`new Promise(r=>setTimeout(r,${ms}))`);

// 主动导航到仿真页，并等待模块初始化（window.__gearbox 就绪）
await cdp('Page.enable');
await cdp('Page.navigate', { url: TARGET_URL });
for (let i = 0; i < 40; i++) {
  await sleep(250);
  const ready = await evalJs(`!!window.__gearbox`).catch(() => false);
  if (ready) break;
}

let pass = 0;
const ok = (name, cond, extra = '') => {
  if (cond) {
    pass++;
    console.log(`  ✓ ${name} ${extra}`);
  } else {
    console.error(`  ✗ ${name} ${extra}`);
    process.exitCode = 1;
  }
};
const approx = (a, b, eps) => Math.abs(a - b) <= eps;

console.log('A) 初始化与模型加载');
const init = await evalJs(`(() => ({
  ready: !!window.__gearbox,
  running: window.__gearbox.state.running,
  rpm: window.__gearbox.state.inputRpm,
  hasCanvas: !!document.querySelector('canvas'),
  modelText: document.getElementById('model-status').textContent,
}))()`);
ok('调试句柄与 canvas 就绪', init.ready && init.hasCanvas);
ok('默认自动运转，输入 120rpm', init.running === true && init.rpm === 120);
ok('9 个 GLB 全部加载', (init.modelText.match(/\.glb/g) || []).length === 9, init.modelText);

console.log('B) 动态转速与传动比（实测转角）');
const t0 = await evalJs(`(() => { const g=window.__gearbox; return {a:g.shafts.inputShaft.rotation.x, m:g.shafts.midShaft.rotation.x, o:g.shafts.outputShaft.rotation.x}; })()`);
await waitInPage(1500);
const t1 = await evalJs(`(() => { const g=window.__gearbox; return {a:g.shafts.inputShaft.rotation.x, m:g.shafts.midShaft.rotation.x, o:g.shafts.outputShaft.rotation.x}; })()`);
const dA = t1.a - t0.a, dM = t1.m - t0.m, dO = t1.o - t0.o;
ok('输入轴在转动', Math.abs(dA) > 0.1, `Δ=${dA.toFixed(3)}`);
ok('一级速比 |Δmid/Δin| ≈ Z1/Z2 = 0.3', approx(Math.abs(dM / dA), 12 / 40, 0.02), `实测 ${Math.abs(dM / dA).toFixed(4)}`);
ok('一级外啮合反向（符号相反）', dA * dM < 0);
ok('总速比 |Δout/Δin| ≈ 1/10 = 0.1', approx(Math.abs(dO / dA), 0.1, 0.02), `实测 ${Math.abs(dO / dA).toFixed(4)}`);
ok('输出与输入同向（两级反向叠加）', dA * dO > 0);

console.log('C) 暂停定格');
await evalJs(`document.getElementById('btn-play').click()`);
const p0 = await evalJs(`window.__gearbox.shafts.inputShaft.rotation.x`);
await waitInPage(1000);
const p1 = await evalJs(`window.__gearbox.shafts.inputShaft.rotation.x`);
ok('暂停后转角冻结', approx(p0, p1, 1e-9), `变化 ${Math.abs(p1 - p0)}`);
ok('按钮文案切换为“启动”', (await evalJs(`document.getElementById('btn-play').textContent`)) === '启动');
await evalJs(`document.getElementById('btn-play').click()`); // 恢复

console.log('D) 调速跟随（用确定性角速度断言，规避软件渲染帧间隔抖动）');
// 直接读取运动学函数在不同转速下的角速度，验证严格线性与传动比
const speeds = await evalJs(`(() => {
  const out = {};
  // 通过滑块驱动真实 UI，再读取内部角速度（由同一 inputRpm 计算）
  const s = document.getElementById('rpm-slider');
  for (const rpm of [0, 120, 300]) {
    s.value = rpm; s.dispatchEvent(new Event('input'));
    out[rpm] = window.__gearbox.state.inputRpm;
  }
  return out;
})()`);
ok('滑块可设 0/120/300 rpm', speeds[0] === 0 && speeds[120] === 120 && speeds[300] === 300, JSON.stringify(speeds));

const kin = await evalJs(`(async () => {
  const mod = await import('./js/sim/kinematics.js');
  return {
    s120: mod.shaftSpeeds(120),
    s300: mod.shaftSpeeds(300),
    total: mod.RATIO_TOTAL,
  };
})()`);
ok('300rpm 输入角速度 = 120rpm 的 2.5 倍', approx(kin.s300.wIn / kin.s120.wIn, 2.5, 1e-12));
ok('300rpm 各轴角速度均为 120rpm 的 2.5 倍（线性调速）',
  approx(kin.s300.wMid / kin.s120.wMid, 2.5, 1e-12) && approx(kin.s300.wOut / kin.s120.wOut, 2.5, 1e-12));
ok('输出转速跟随传动比（300→30.0）', (await evalJs(`document.getElementById('rpm-out').textContent`)) === '30.0');

// 真实运行验证：转速调 0 后齿轮停转
ok('转速调 0 后齿轮停转', await (async () => {
  await evalJs(`(() => { const s=document.getElementById('rpm-slider'); s.value=0; s.dispatchEvent(new Event('input')); })()`);
  const z0 = await evalJs(`window.__gearbox.state.angles.in`);
  await waitInPage(700);
  const z1 = await evalJs(`window.__gearbox.state.angles.in`);
  return approx(z0, z1, 1e-12);
})());
// 恢复默认转速
await evalJs(`(() => { const s=document.getElementById('rpm-slider'); s.value=120; s.dispatchEvent(new Event('input')); })()`);

console.log('E) 重置仿真（暂停状态下重置，可精确归零）');
await evalJs(`(() => { const s=document.getElementById('rpm-slider'); s.value=120; s.dispatchEvent(new Event('input')); })()`);
await evalJs(`document.getElementById('btn-reset').click()`);
const ang = await evalJs(`(() => { const g=window.__gearbox; return {a:g.state.angles.in, m:g.state.angles.mid, o:g.state.angles.out}; })()`);
ok('重置后累计转角归零', approx(ang.a, 0, 1e-12) && approx(ang.m, 0, 1e-12) && approx(ang.o, 0, 1e-12), JSON.stringify(ang));
await evalJs(`document.getElementById('btn-play').click()`); // 恢复运行

console.log('F) 动力流粒子开关');
const on0 = await evalJs(`window.__gearbox.flow.enabled`);
await evalJs(`document.getElementById('btn-particles').click()`);
const on1 = await evalJs(`window.__gearbox.flow.enabled`);
ok('粒子可关闭', on0 === true && on1 === false);
await evalJs(`document.getElementById('btn-particles').click()`);
ok('粒子可重新开启', (await evalJs(`window.__gearbox.flow.enabled`)) === true);

console.log('G) 啮合区特写（调整相机后截图）');
await evalJs(`(() => { const g=window.__gearbox; g.camera.position.set(0, 0, 200); g.controls.target.set(-30, -26, 0); g.controls.update(); })()`);
await waitInPage(600);
const shot = await cdp('Page.captureScreenshot', { format: 'png' });
writeFileSync(join(here, 'screenshots', 'mesh-closeup.png'), Buffer.from(shot.result.data, 'base64'));
console.log('  特写已保存 tools/screenshots/mesh-closeup.png');

ws.close();
console.log(`\n结果：${pass} 项通过${process.exitCode ? '，存在失败项' : '，全部通过'}`);
