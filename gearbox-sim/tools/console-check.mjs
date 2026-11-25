// 收集页面加载期的 console 消息与未捕获异常，确认无运行时报错
const CDP_HTTP = 'http://localhost:9223';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const list = await (await fetch(`${CDP_HTTP}/json`)).json();
const page = list.find((t) => t.type === 'page' && t.url.includes('localhost:8214'));
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((r) => (ws.onopen = r));

let id = 0;
const pending = new Map();
const logs = [];
ws.onmessage = (e) => {
  const m = JSON.parse(e.data);
  if (m.id && pending.has(m.id)) {
    pending.get(m.id)(m);
    pending.delete(m.id);
  }
  if (m.method === 'Runtime.consoleAPICalled') {
    logs.push(`[console.${m.params.type}] ` + m.params.args.map((a) => a.value ?? a.description ?? '').join(' '));
  }
  if (m.method === 'Runtime.exceptionThrown') {
    logs.push('[UNCAUGHT] ' + (m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text));
  }
};
const cdp = (method, params = {}) =>
  new Promise((res) => {
    const mid = ++id;
    pending.set(mid, res);
    ws.send(JSON.stringify({ id: mid, method, params }));
  });
await cdp('Runtime.enable');
await cdp('Log.enable');
await sleep(5000); // 等待加载、GLB 解析、若干动画帧

const errCount = logs.filter((l) => /error|uncaught|warning/i.test(l)).length;
console.log(logs.length ? '页面 console 输出：' : '页面无任何 console 输出（无错误、无警告）');
logs.forEach((l) => console.log('  ' + l));
console.log(errCount === 0 ? '\n✓ 控制台零错误零警告' : `\n✗ 发现 ${errCount} 条问题`);
ws.close();
process.exitCode = errCount === 0 ? 0 : 1;
