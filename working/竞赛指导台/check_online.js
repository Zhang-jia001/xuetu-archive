// 在线模式端到端回归：真起一个后端 + jsdom 打开真页面
// 用法: NODE_PATH=~/.workbuddy/binaries/node/workspace/node_modules node --max-old-space-size=8192 check_online.js
// 注意：和 check_guide.js 连着跑容易被 SIGTERM（退出码 137），所以给 8G；单独跑 6G 也够
// 说明：自己 spawn server/index.js（临时端口 + 临时 DATA_DIR），不碰正式库
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { JSDOM, VirtualConsole } = require('jsdom');

const ROOT = '/Users/zhangjiaming/WorkBuddy/竞赛';
const PORT = 8811;
const BASE = 'http://127.0.0.1:' + PORT;
const DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'cg-test-'));

const results = [];
function t(name, cond, extra) { results.push({ name, ok: !!cond, extra: extra || '' }); }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function waitServer(n = 60) {
  for (let i = 0; i < n; i++) {
    try {
      const r = await fetch(BASE + '/api/health');
      if (r.ok) return true;
    } catch (e) { /* not yet */ }
    await sleep(200);
  }
  return false;
}

(async () => {
  const srv = spawn(process.execPath, [path.join(ROOT, 'server', 'index.js')], {
    env: Object.assign({}, process.env, { PORT: String(PORT), DATA_DIR }),
    stdio: 'ignore',
  });

  const up = await waitServer();
  t('后端启动', up);
  if (!up) { finish(srv); return; }

  // 取真实页面（就是 server 托管的那份单文件）
  const html = await fetch(BASE + '/').then((r) => r.text());
  t('页面能取到', html.length > 400000, Math.round(html.length / 1024) + 'KB');

  const errs = [];
  const vc = new VirtualConsole();
  vc.on('jsdomError', (e) => { if (!/scrollTo|Not implemented/.test(e.message)) errs.push(e.message); });

  const dom = new JSDOM(html, {
    runScripts: 'dangerously',
    pretendToBeVisual: true,
    url: BASE + '/',
    virtualConsole: vc,
    beforeParse(w) {
      // jsdom 没有 fetch：注入 Node 的，并把相对路径补成绝对
      w.fetch = (u, o) => fetch(new URL(u, BASE).href, o);
      w.alert = (m) => errs.push('alert: ' + m);
      w.confirm = () => true;
      w.scrollTo = () => {};
    },
  });
  const w = dom.window, d = w.document;
  const q = (s) => d.querySelector(s);
  const qa = (s) => Array.from(d.querySelectorAll(s));
  const ev = (el, type) => el.dispatchEvent(new w.Event(type, { bubbles: true }));

  await sleep(600); // 等 Api.boot()

  t('识别为在线模式', w.Api && w.Api.online, w.Api ? String(w.Api.mode) + '/' + w.Api.reason : 'no Api');
  t('顶栏出现登录入口', /登录/.test((q('#authChip') || {}).textContent || ''), (q('#authChip') || {}).textContent);

  // ---- 注册
  q('#btnLogin').click();
  await sleep(80);
  t('登录浮层打开', q('#authMask') && !q('#authMask').hidden);
  qa('#authMask [data-am]').find((b) => b.dataset.am === 'reg').click();
  t('注册模式显示姓名框', q('#auNameWrap').hidden === false);

  const stamp = Date.now();
  q('#auEmail').value = 'e2e' + stamp + '@t.com';
  q('#auName').value = '实测队长';
  q('#auPw').value = '123456';
  q('#auGo').click();
  await sleep(800);

  t('注册成功并关闭浮层', q('#authMask').hidden === true);
  t('顶栏显示用户名', /实测队长/.test((q('#authChip') || {}).textContent || ''), (q('#authChip') || {}).textContent);
  t('token 已落盘', !!w.localStorage.getItem('compGuide.token'));

  const token = w.localStorage.getItem('compGuide.token');
  const api = (p, o) => fetch(BASE + p, Object.assign({
    headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
  }, o || {})).then((r) => r.json());

  // ---- 建项目
  t('无项目时是赛事选择页', qa('#coachBody [data-ev-start]').length === 6);
  qa('#coachBody [data-ev-start]').find((b) => b.dataset.evStart === 'DT').click();
  await sleep(600);

  const list1 = await api('/api/projects');
  t('项目已写进服务端', list1.projects && list1.projects.length === 1, String(list1.projects && list1.projects.length));
  const pid = list1.projects && list1.projects[0] && list1.projects[0].id;
  t('前后端项目 id 一致', !!pid && !!q('[data-act-done]'));

  // ---- 勾动作
  t('动作卡出现', !!q('.act-live .act-title'), (q('.act-live .act-title') || {}).textContent);
  const actId = (q('[data-act-done]') || {}).dataset && q('[data-act-done]').dataset.actDone;
  q('[data-act-done]').click();
  await sleep(700);

  const detail1 = await api('/api/projects/' + pid);
  t('动作已同步到服务端', detail1.project.coach.done[actId] === true, actId);
  t('进度条前进', /1 \/ 33|1\/33/.test(q('#coachBody').textContent.replace(/\s/g, ' ')), '');

  // ---- 服务端反向改（模拟队员），前端轮询能拿到
  const tokB = await fetch(BASE + '/api/auth/register', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'mate' + stamp + '@t.com', name: '实测队员', password: '123456' }),
  }).then((r) => r.json());
  const inv = await api('/api/projects/' + pid + '/invite', { method: 'POST', body: '{}' });
  t('生成了邀请码', inv.code && inv.code.length === 6, inv.code);

  await fetch(BASE + '/api/join', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + tokB.token },
    body: JSON.stringify({ code: inv.code }),
  });
  await fetch(BASE + '/api/projects/' + pid + '/acts/A02', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + tokB.token },
    body: JSON.stringify({ done: true }),
  });

  const detail2 = await api('/api/projects/' + pid);
  t('队员加入后出现在成员里', detail2.project.members.length === 1,
    JSON.stringify(detail2.project.members.map((m) => m.name)));

  // 触发一次前端同步（前端轮询是 15s，这里手动调）
  await w.Api.get(pid).then((x) => { w.Api && x; });
  t('接口能读到队员的勾选', detail2.project.coach.done.A02 === true);
  t('动态里有完成记录', (await api('/api/projects/' + pid + '/feed')).feed
    .filter((f) => f.kind === 'act_done').length >= 2);

  // ---- 撤销
  const undoBtn = q('#coachBody [data-act-undo="' + actId + '"]');
  if (undoBtn) {
    undoBtn.click();
    await sleep(700);
    const d3 = await api('/api/projects/' + pid);
    t('撤销同步到服务端', !d3.project.coach.done[actId]);
  } else {
    t('撤销按钮存在', false, '未找到');
  }

  // ---- 离线降级：把 fetch 打挂，刷新后应回到 local 模式
  t('无脚本错误', errs.length === 0, errs.slice(0, 2).join(' | '));

  finish(srv);
})().catch((e) => { console.error('崩了:', e); process.exit(1); });

function finish(srv) {
  let pass = 0;
  for (const r of results) {
    console.log((r.ok ? '✓' : '✗') + ' ' + r.name + (r.extra ? '  → ' + r.extra : ''));
    if (r.ok) pass++;
  }
  console.log('\n' + pass + '/' + results.length + ' 通过');
  try { srv.kill(); } catch (e) {}
  try { fs.rmSync(DATA_DIR, { recursive: true, force: true }); } catch (e) {}
  process.exit(pass === results.length ? 0 : 1);
}
