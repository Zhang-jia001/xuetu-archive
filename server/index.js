// 竞赛指导台 · 后端服务（零依赖：node:http + node:sqlite + node:crypto）
// 启动：node server/index.js       默认 http://localhost:8787
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const { get, all, run } = require('./db');
const auth = require('./auth');

const PORT = Number(process.env.PORT || 8787);
const APP_HTML = process.env.APP_HTML || path.join(__dirname, '..', '竞赛指导台_学生版.html');
const EVENTS = ['DCH', 'GCS', 'DT', 'XT', 'C4', 'ZDB'];

/* ---------------------------------------------------------------- 工具 */
function json(res, code, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(code, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, POST, PATCH, PUT, DELETE, OPTIONS',
    'Cache-Control': 'no-store',
  });
  res.end(body);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (c) => {
      size += c.length;
      if (size > 1 << 20) { reject(auth.httpError(413, '请求体太大')); req.destroy(); return; }
      chunks.push(c);
    });
    req.on('end', () => {
      if (!chunks.length) return resolve({});
      try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8'))); }
      catch (e) { reject(auth.httpError(400, 'JSON 格式不对')); }
    });
    req.on('error', reject);
  });
}

function code6() {
  const A = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // 去掉易混的 I O 0 1
  let s = '';
  for (let i = 0; i < 6; i++) s += A[crypto.randomInt(A.length)];
  return s;
}

/* ---------------------------------------------------------------- 权限 */
function memberOf(pid, uid) {
  return get('SELECT role FROM project_users WHERE project_id = ? AND user_id = ?', pid, uid);
}
function needMember(pid, uid) {
  if (!get('SELECT id FROM projects WHERE id = ?', pid)) throw auth.httpError(404, '项目不存在');
  const m = memberOf(pid, uid);
  if (!m) throw auth.httpError(403, '你不在这个项目里');
  return m.role;
}
function needOwner(pid, uid) {
  const r = needMember(pid, uid);
  if (r !== 'owner') throw auth.httpError(403, '只有队长能做这个操作');
  return r;
}
function getProject(pid) {
  const p = get('SELECT * FROM projects WHERE id = ?', pid);
  if (!p) throw auth.httpError(404, '项目不存在');
  return p;
}

/* ---------------------------------------------------------------- 装配 */
function projectOut(p, uid) {
  const members = all('SELECT seq, user_id, name, post, role FROM members WHERE project_id = ? ORDER BY seq', p.id)
    .map((m) => ({ name: m.name, post: m.post, role: m.role, userId: m.user_id }));
  const acts = all('SELECT act_id, done, assignee, done_by, done_at FROM acts WHERE project_id = ?', p.id);
  const done = {}, assign = {}, log = [];
  acts.forEach((a) => {
    if (a.done) { done[a.act_id] = true; log.push(a.act_id); }
    if (a.assignee && a.assignee !== 'self') assign[a.act_id] = a.assignee;
  });
  let checks = {};
  try { checks = JSON.parse(p.checks || '{}'); } catch (e) { checks = {}; }
  return {
    id: p.id, event: p.event, title: p.title || '', query: p.query, school: p.school,
    major: p.major, deadline: p.deadline, topicIdx: p.topic_idx,
    planStack: p.plan_stack || '', defScheme: p.def_scheme || '',
    checks, coach: { done, assign, log },
    members, role: (memberOf(p.id, uid) || {}).role || 'member',
    inviteCode: p.owner_id === uid ? p.invite_code : '',
    ownerId: p.owner_id, createdAt: p.created_at, updatedAt: p.updated_at,
  };
}

function feedOut(pid, limit = 40) {
  return all(
    `SELECT f.id, f.kind, f.text, f.created_at, u.name AS user
       FROM feed f LEFT JOIN users u ON u.id = f.user_id
      WHERE f.project_id = ? ORDER BY f.id DESC LIMIT ?`, pid, limit
  ).map((r) => ({ id: r.id, kind: r.kind, text: r.text, at: r.created_at, user: r.user || '有人' }));
}

function addFeed(pid, uid, kind, text) {
  run('INSERT INTO feed (project_id, user_id, kind, text, created_at) VALUES (?,?,?,?,?)',
    pid, uid, kind, text, Date.now());
}

/* ---------------------------------------------------------------- 路由表 */
const routes = [];
function on(method, pattern, fn, opts) {
  const keys = [];
  const re = new RegExp('^' + pattern.replace(/:[A-Za-z]+/g, (m) => {
    keys.push(m.slice(1));
    return '([^/]+)';
  }) + '$');
  routes.push({ method, re, keys, fn, auth: !(opts && opts.open) });
}

// --- 健康检查（前端用它判断是否在线模式）
on('GET', '/api/health', () => ({ ok: true, service: 'comp-guide', time: Date.now() }), { open: true });

// --- 认证
on('POST', '/api/auth/register', (c) => auth.register(c.body.email, c.body.name, c.body.password), { open: true });
on('POST', '/api/auth/login', (c) => auth.login(c.body.email, c.body.password), { open: true });
on('GET', '/api/me', (c) => ({ user: c.user }));

// --- 项目列表
on('GET', '/api/projects', (c) => {
  const rows = all(
    `SELECT p.*, pu.role AS my_role FROM projects p
       JOIN project_users pu ON pu.project_id = p.id
      WHERE pu.user_id = ? ORDER BY p.updated_at DESC`, c.user.id);
  return {
    projects: rows.map((p) => {
      const n = get('SELECT COUNT(*) AS n FROM acts WHERE project_id = ? AND done = 1', p.id).n;
      return {
        id: p.id, event: p.event, title: p.title || p.query, query: p.query,
        school: p.school, major: p.major, deadline: p.deadline, topicIdx: p.topic_idx,
        role: p.my_role, doneActs: n, updatedAt: p.updated_at,
      };
    }),
  };
});

// --- 新建项目
on('POST', '/api/projects', (c) => {
  const ev = String(c.body.event || '');
  if (EVENTS.indexOf(ev) < 0) throw auth.httpError(400, '赛事不对');
  const now = Date.now();
  // 允许前端带 id（本地生成），前后端用同一个 id，避免同步时换 id
  const cid = String(c.body.id || '');
  const id = /^p[a-z0-9]{6,40}$/.test(cid) ? cid : 'p' + now.toString(36) + crypto.randomBytes(2).toString('hex');
  if (get('SELECT id FROM projects WHERE id = ?', id)) throw auth.httpError(409, '项目 id 已被占用');
  run(`INSERT INTO projects (id, owner_id, event, title, query, school, major, deadline,
        topic_idx, plan_stack, def_scheme, checks, invite_code, created_at, updated_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    id, c.user.id, ev, String(c.body.title || ''), String(c.body.query || ''),
    String(c.body.school || ''), String(c.body.major || ''), String(c.body.deadline || ''),
    c.body.topicIdx == null ? null : Number(c.body.topicIdx), '', '',
    JSON.stringify(c.body.checks || {}), code6(), now, now);
  run('INSERT INTO project_users (project_id, user_id, role, joined_at) VALUES (?,?,?,?)',
    id, c.user.id, 'owner', now);
  addFeed(id, c.user.id, 'project_create', ev);
  return { project: projectOut(getProject(id), c.user.id) };
});

// --- 项目详情
on('GET', '/api/projects/:id', (c) => {
  needMember(c.params.id, c.user.id);
  return { project: projectOut(getProject(c.params.id), c.user.id), feed: feedOut(c.params.id) };
});

// --- 改项目
on('PATCH', '/api/projects/:id', (c) => {
  needMember(c.params.id, c.user.id);
  const p = getProject(c.params.id);
  const b = c.body || {};
  const f = {
    title: b.title != null ? String(b.title) : p.title,
    query: b.query != null ? String(b.query) : p.query,
    school: b.school != null ? String(b.school) : p.school,
    major: b.major != null ? String(b.major) : p.major,
    deadline: b.deadline != null ? String(b.deadline) : p.deadline,
    topic_idx: b.topicIdx !== undefined ? (b.topicIdx == null ? null : Number(b.topicIdx)) : p.topic_idx,
    plan_stack: b.planStack != null ? String(b.planStack) : p.plan_stack,
    def_scheme: b.defScheme != null ? String(b.defScheme) : p.def_scheme,
    checks: b.checks != null ? JSON.stringify(b.checks) : p.checks,
  };
  run(`UPDATE projects SET title=?, query=?, school=?, major=?, deadline=?, topic_idx=?,
        plan_stack=?, def_scheme=?, checks=?, updated_at=? WHERE id=?`,
    f.title, f.query, f.school, f.major, f.deadline, f.topic_idx,
    f.plan_stack, f.def_scheme, f.checks, Date.now(), p.id);
  return { ok: true };
});

// --- 删项目（仅队长）
on('DELETE', '/api/projects/:id', (c) => {
  needOwner(c.params.id, c.user.id);
  ['acts', 'members', 'project_users', 'feed'].forEach((t) =>
    run(`DELETE FROM ${t} WHERE project_id = ?`, c.params.id));
  run('DELETE FROM projects WHERE id = ?', c.params.id);
  return { ok: true };
});

// --- 邀请码
on('POST', '/api/projects/:id/invite', (c) => {
  needOwner(c.params.id, c.user.id);
  let p = getProject(c.params.id);
  if (!p.invite_code) {
    let code = code6();
    while (get('SELECT id FROM projects WHERE invite_code = ?', code)) code = code6();
    run('UPDATE projects SET invite_code = ? WHERE id = ?', code, p.id);
    p = getProject(p.id);
  }
  return { code: p.invite_code };
});

// --- 用邀请码加入
on('POST', '/api/join', (c) => {
  const code = String(c.body.code || '').trim().toUpperCase();
  const p = get('SELECT * FROM projects WHERE invite_code = ?', code);
  if (!p) throw auth.httpError(404, '邀请码不对，或已经失效');
  if (memberOf(p.id, c.user.id)) return { project: projectOut(p, c.user.id) };
  const now = Date.now();
  run('INSERT INTO project_users (project_id, user_id, role, joined_at) VALUES (?,?,?,?)',
    p.id, c.user.id, 'member', now);
  const seq = (get('SELECT COUNT(*) AS n FROM members WHERE project_id = ?', p.id).n) || 0;
  run('INSERT INTO members (project_id, seq, user_id, name, post, role) VALUES (?,?,?,?,?,?)',
    p.id, seq, c.user.id, c.user.name, '文档', 'new');
  addFeed(p.id, c.user.id, 'join', c.user.name);
  return { project: projectOut(p, c.user.id) };
});

// --- 成员全量替换（仅队长）
on('PUT', '/api/projects/:id/members', (c) => {
  needOwner(c.params.id, c.user.id);
  const list = Array.isArray(c.body.members) ? c.body.members.slice(0, 20) : [];
  run('DELETE FROM members WHERE project_id = ?', c.params.id);
  list.forEach((m, i) => {
    run('INSERT INTO members (project_id, seq, user_id, name, post, role) VALUES (?,?,?,?,?,?)',
      c.params.id, i, m.userId || null, String(m.name || ''), String(m.post || '技术'),
      m.role === 'old' ? 'old' : 'new');
  });
  run('UPDATE projects SET updated_at = ? WHERE id = ?', Date.now(), c.params.id);
  addFeed(c.params.id, c.user.id, 'member_change', String(list.length));
  return { ok: true };
});

// --- 动作完成 / 撤销 / 指派
on('POST', '/api/projects/:id/acts/:actId', (c) => {
  needMember(c.params.id, c.user.id);
  const pid = c.params.id, aid = String(c.params.actId).slice(0, 12);
  if (!/^A\d{2}$/.test(aid)) throw auth.httpError(400, '动作编号不对');
  const row = get('SELECT * FROM acts WHERE project_id = ? AND act_id = ?', pid, aid);
  const done = c.body.done === undefined ? (row ? !!row.done : true) : !!c.body.done;
  const assignee = c.body.assignee !== undefined
    ? String(c.body.assignee)
    : (row ? row.assignee : 'self');
  if (row) {
    run('UPDATE acts SET done = ?, assignee = ?, done_by = ?, done_at = ? WHERE project_id = ? AND act_id = ?',
      done ? 1 : 0, assignee, done ? c.user.id : null, done ? Date.now() : null, pid, aid);
  } else {
    run('INSERT INTO acts (project_id, act_id, done, assignee, done_by, done_at) VALUES (?,?,?,?,?,?)',
      pid, aid, done ? 1 : 0, assignee, done ? c.user.id : null, done ? Date.now() : null);
  }
  if (c.body.done !== undefined) {
    addFeed(pid, c.user.id, done ? 'act_done' : 'act_undo', aid);
  }
  if (c.body.assignee !== undefined) {
    addFeed(pid, c.user.id, 'act_assign', aid + '|' + assignee);
  }
  run('UPDATE projects SET updated_at = ? WHERE id = ?', Date.now(), pid);
  return { ok: true, act: { id: aid, done, assignee } };
});

// --- 动态
on('GET', '/api/projects/:id/feed', (c) => {
  needMember(c.params.id, c.user.id);
  return { feed: feedOut(c.params.id) };
});

/* ---------------------------------------------------------------- 启动 */
const server = http.createServer(async (req, res) => {
  let url;
  try { url = new URL(req.url, 'http://' + (req.headers.host || 'localhost')); }
  catch (e) { return json(res, 400, { error: 'bad url' }); }

  if (req.method === 'OPTIONS') {
    return json(res, 204, {});
  }

  // 静态页
  if ((req.method === 'GET' || req.method === 'HEAD') && (url.pathname === '/' || url.pathname === '/index.html')) {
    if (!fs.existsSync(APP_HTML)) {
      res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
      return res.end('没找到前端文件：' + APP_HTML + '\n先跑 python working/竞赛指导台/build_guide.py');
    }
    const buf = fs.readFileSync(APP_HTML);
    res.writeHead(200, {
      'Content-Type': 'text/html; charset=utf-8',
      'Content-Length': buf.length,
      'Access-Control-Allow-Origin': '*',
    });
    return res.end(req.method === 'HEAD' ? undefined : buf);
  }

  // API
  if (url.pathname.startsWith('/api/')) {
    const hit = routes.filter((r) => r.method === req.method && r.re.test(url.pathname));
    if (!hit.length) return json(res, 404, { error: '没有这个接口' });
    const route = hit[0];
    const m = url.pathname.match(route.re);
    const params = {};
    route.keys.forEach((k, i) => { params[k] = decodeURIComponent(m[i + 1]); });

    try {
      let user = null;
      if (route.auth) {
        const h = req.headers.authorization || '';
        user = auth.verify(h.replace(/^Bearer\s+/i, ''));
        if (!user) return json(res, 401, { error: '请先登录' });
      }
      const body = ['POST', 'PATCH', 'PUT'].indexOf(req.method) >= 0 ? await readBody(req) : {};
      const out = await route.fn({ req, res, params, body, user, query: url.searchParams });
      return json(res, 200, out || { ok: true });
    } catch (e) {
      const code = e.code || 500;
      if (code >= 500) console.error('[500]', req.method, url.pathname, e);
      return json(res, code, { error: e.message || '服务器错误' });
    }
  }

  json(res, 404, { error: 'not found' });
});

server.listen(PORT, () => {
  console.log('竞赛指导台后端已启动  http://localhost:' + PORT);
  console.log('前端文件：' + APP_HTML);
  console.log('数据库：' + require('./db').DATA_DIR + '/app.db');
});
