// 后端接口回归：注册 → 建项目 → 勾动作 → 邀请 → 队员加入 → 队员勾动作 → 队长看到
const B = 'http://127.0.0.1:8787';
let pass = 0, fail = 0;
function ok(name, cond, extra) {
  if (cond) { pass++; console.log('✓ ' + name); }
  else { fail++; console.log('✗ ' + name + (extra ? '  → ' + extra : '')); }
}
async function j(m, p, body, token) {
  const r = await fetch(B + p, {
    method: m,
    headers: Object.assign({ 'Content-Type': 'application/json' }, token ? { Authorization: 'Bearer ' + token } : {}),
    body: body ? JSON.stringify(body) : undefined,
  });
  const d = await r.json().catch(() => ({}));
  return { code: r.status, d };
}

(async () => {
  const stamp = Date.now();
  const A = await j('POST', '/api/auth/register', { email: 'lead' + stamp + '@t.com', name: '队长小王', password: '123456' });
  ok('注册队长', A.code === 200 && !!A.d.token, A.code + ' ' + JSON.stringify(A.d).slice(0, 80));
  const tokA = A.d.token;

  const dup = await j('POST', '/api/auth/register', { email: 'lead' + stamp + '@t.com', name: 'x', password: '123456' });
  ok('重复邮箱被拒', dup.code === 409, dup.code);

  const bad = await j('POST', '/api/auth/login', { email: 'lead' + stamp + '@t.com', password: 'wrong' });
  ok('错密码被拒', bad.code === 401, bad.code);

  const noAuth = await j('GET', '/api/projects');
  ok('未登录访问被拒', noAuth.code === 401, noAuth.code);

  const C = await j('POST', '/api/projects', {
    event: 'DT', query: '校园设备故障预测', school: '南京工业职业技术大学', major: '计算机',
    deadline: '2027-03-01',
  }, tokA);
  ok('建项目', C.code === 200 && !!C.d.project.id, C.code);
  const pid = C.d.project.id;

  const badEv = await j('POST', '/api/projects', { event: 'XXX' }, tokA);
  ok('非法赛事被拒', badEv.code === 400, badEv.code);

  // 勾动作
  const act1 = await j('POST', `/api/projects/${pid}/acts/A01`, { done: true }, tokA);
  ok('勾动作 A01', act1.code === 200 && act1.d.act.done === true);

  const actBad = await j('POST', `/api/projects/${pid}/acts/ZZZ`, { done: true }, tokA);
  ok('非法动作编号被拒', actBad.code === 400, actBad.code);

  // 成员
  const mem = await j('PUT', `/api/projects/${pid}/members`, {
    members: [
      { name: '李四', post: '技术', role: 'old' },
      { name: '王五', post: '数据', role: 'new' },
    ],
  }, tokA);
  ok('写成员', mem.code === 200);

  // 邀请
  const inv = await j('POST', `/api/projects/${pid}/invite`, {}, tokA);
  ok('生成邀请码', inv.code === 200 && inv.d.code.length === 6, inv.d.code);
  const code = inv.d.code;

  // 第二个用户加入
  const B1 = await j('POST', '/api/auth/register', { email: 'mem' + stamp + '@t.com', name: '队员李四', password: '123456' });
  ok('注册队员', B1.code === 200);
  const tokB = B1.d.token;

  const peek = await j('GET', `/api/projects/${pid}`, null, tokB);
  ok('未加入时看不到项目', peek.code === 403, peek.code);

  const join = await j('POST', '/api/join', { code: code }, tokB);
  ok('邀请码加入', join.code === 200 && join.d.project.id === pid, join.code);

  const detail = await j('GET', `/api/projects/${pid}`, null, tokB);
  ok('加入后能看项目', detail.code === 200);
  ok('队员看到队长勾过的动作', detail.d.project.coach.done.A01 === true);
  ok('队员看不到邀请码', detail.d.project.inviteCode === '');
  ok('队长能看到邀请码', (await j('GET', `/api/projects/${pid}`, null, tokA)).d.project.inviteCode === code);

  // 队员勾动作 → 队长看到
  const act2 = await j('POST', `/api/projects/${pid}/acts/A02`, { done: true }, tokB);
  ok('队员勾动作', act2.code === 200);
  const back = await j('GET', `/api/projects/${pid}`, null, tokA);
  ok('队长看到队员的勾选', back.d.project.coach.done.A02 === true);
  ok('动态里有两条完成记录',
    back.d.feed.filter((f) => f.kind === 'act_done').length >= 2,
    back.d.feed.map((f) => f.kind).join(','));

  // 指派
  const as = await j('POST', `/api/projects/${pid}/acts/A03`, { done: false, assignee: '1' }, tokA);
  ok('指派动作', as.code === 200 && as.d.act.assignee === '1');

  // 权限：队员不能改成员 / 不能删项目
  const memB = await j('PUT', `/api/projects/${pid}/members`, { members: [] }, tokB);
  ok('队员不能改成员', memB.code === 403, memB.code);
  const delB = await j('DELETE', `/api/projects/${pid}`, null, tokB);
  ok('队员不能删项目', delB.code === 403, delB.code);

  // 列表
  const listB = await j('GET', '/api/projects', null, tokB);
  ok('队员的项目列表有 1 个', listB.d.projects.length === 1, String(listB.d.projects.length));
  ok('列表带进度', typeof listB.d.projects[0].doneActs === 'number', String(listB.d.projects[0].doneActs));

  // 改项目
  const pat = await j('PATCH', `/api/projects/${pid}`, { title: '改过的标题', checks: { topic: { 0: true } } }, tokA);
  ok('改项目', pat.code === 200);
  const after = await j('GET', `/api/projects/${pid}`, null, tokA);
  ok('标题已更新', after.d.project.title === '改过的标题');
  ok('勾选已保存', !!after.d.project.checks.topic['0']);

  // 删项目
  const del = await j('DELETE', `/api/projects/${pid}`, null, tokA);
  ok('队长删项目', del.code === 200);
  const gone = await j('GET', `/api/projects/${pid}`, null, tokA);
  ok('删后查不到', gone.code === 404, gone.code);

  console.log('\n' + pass + '/' + (pass + fail) + ' 通过');
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('崩了:', e); process.exit(1); });
