/* 后端接入层
 * 在线模式：同源 /api（node server/index.js 提供），数据存 SQLite，多人共享
 * 离线模式：file:// 直接打开，或后端不可达 → 全部退回 localStorage，功能照常
 * 约定：Api.mode === 'online' 时，关键写操作才调后端；读失败不影响本地使用
 */
window.Api = (function () {
  'use strict';

  var TKey = 'compGuide.token';
  var UKey = 'compGuide.user';
  var st = { mode: 'local', user: null, token: null, offlineReason: '' };
  var hooks = { auth: null, projects: null, feed: null };
  var timers = {};

  function jget(k, d) {
    try { var v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; }
  }
  function jset(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  function jdel(k) { try { localStorage.removeItem(k); } catch (e) {} }

  function req(method, path, body) {
    if (st.mode !== 'online') return Promise.reject(new Error('offline'));
    var opt = { method: method, headers: {} };
    if (body !== undefined) {
      opt.headers['Content-Type'] = 'application/json';
      opt.body = JSON.stringify(body);
    }
    if (st.token) opt.headers.Authorization = 'Bearer ' + st.token;
    return fetch(path, opt).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (d) {
        if (!r.ok) {
          var e = new Error(d && d.error ? d.error : ('HTTP ' + r.status));
          e.code = r.status;
          if (r.status === 401) { st.user = null; st.token = null; jdel(TKey); jdel(UKey); }
          throw e;
        }
        return d;
      });
    });
  }

  /* ---------------------------------------------------------- 启动探测 */
  function boot() {
    if (typeof fetch !== 'function') { st.offlineReason = '浏览器不支持'; return Promise.resolve(st); }
    if (location.protocol !== 'http:' && location.protocol !== 'https:') {
      st.offlineReason = '本地文件打开'; return Promise.resolve(st);
    }
    return fetch('/api/health')
      .then(function (r) { return r.json(); })
      .then(function (d) {
        if (!d || !d.ok) throw new Error('bad');
        st.mode = 'online';
        st.token = localStorage.getItem(TKey) || null;
        st.user = jget(UKey, null);
        if (!st.token) return st;
        return req('GET', '/api/me')
          .then(function (r) { st.user = r.user; jset(UKey, r.user); return st; })
          .catch(function () { st.token = null; st.user = null; return st; });
      })
      .catch(function () {
        st.mode = 'local';
        st.offlineReason = '后端未启动';
        return st;
      });
  }

  /* ---------------------------------------------------------- 登录注册 */
  function afterAuth(d) {
    st.mode = 'online';
    st.token = d.token;
    st.user = d.user;
    localStorage.setItem(TKey, d.token);
    jset(UKey, d.user);
    if (hooks.auth) hooks.auth(d.user);
    return d.user;
  }
  function login(email, pw) { return req('POST', '/api/auth/login', { email: email, password: pw }).then(afterAuth); }
  function register(email, name, pw) { return req('POST', '/api/auth/register', { email: email, name: name, password: pw }).then(afterAuth); }
  function logout() {
    st.user = null; st.token = null;
    jdel(TKey); jdel(UKey);
    if (hooks.auth) hooks.auth(null);
  }

  /* ---------------------------------------------------------- 登录浮层 */
  var authMode = 'login';
  function mountAuth() {
    if (document.getElementById('authMask')) return;
    var el = document.createElement('div');
    el.id = 'authMask';
    el.className = 'auth-mask';
    el.hidden = true;
    el.innerHTML =
      '<div class="auth-box">' +
      '<div class="auth-head"><b>竞赛指导台</b><span>登录后，队员和你看到同一份进度</span></div>' +
      '<div class="auth-tabs"><button data-am="login" class="is-on">登录</button><button data-am="reg">注册新账号</button></div>' +
      '<label class="auth-f"><span>邮箱</span><input class="input" id="auEmail" type="email" autocomplete="username" placeholder="you@example.com"></label>' +
      '<label class="auth-f" id="auNameWrap" hidden><span>你的名字</span><input class="input" id="auName" placeholder="真实姓名，队员看到的就是这个"></label>' +
      '<label class="auth-f"><span>密码</span><input class="input" id="auPw" type="password" autocomplete="current-password" placeholder="至少 6 位"></label>' +
      '<div class="auth-err" id="auErr"></div>' +
      '<button class="btn" id="auGo">登录</button>' +
      '<div class="auth-foot"><button class="auth-skip" id="auSkip">先不登录，离线用</button>' +
      '<span class="faint">离线也能做完全流程，只是队员看不到你的进度</span></div>' +
      '</div>';
    document.body.appendChild(el);

    var go = function () {
      var email = document.getElementById('auEmail').value.trim();
      var name = document.getElementById('auName').value.trim();
      var pw = document.getElementById('auPw').value;
      var err = document.getElementById('auErr');
      err.textContent = '';
      var btn = document.getElementById('auGo');
      btn.disabled = true; btn.textContent = authMode === 'login' ? '登录中…' : '注册中…';
      var f = authMode === 'login' ? login(email, pw) : register(email, name, pw);
      f.then(function () {
        el.hidden = true;
        btn.disabled = false; btn.textContent = authMode === 'login' ? '登录' : '注册';
      }).catch(function (e) {
        err.textContent = e.message || '出错了';
        btn.disabled = false; btn.textContent = authMode === 'login' ? '登录' : '注册';
      });
    };

    el.addEventListener('click', function (e) {
      var t = e.target.closest('[data-am]');
      if (t) {
        authMode = t.getAttribute('data-am');
        Array.prototype.forEach.call(el.querySelectorAll('[data-am]'), function (b) {
          b.classList.toggle('is-on', b === t);
        });
        document.getElementById('auNameWrap').hidden = authMode !== 'reg';
        document.getElementById('auGo').textContent = authMode === 'login' ? '登录' : '注册';
        document.getElementById('auErr').textContent = '';
      }
      if (e.target.id === 'auSkip') el.hidden = true;
      if (e.target.id === 'auGo') go();
    });
    el.addEventListener('keydown', function (e) { if (e.key === 'Enter') go(); });
  }

  function openAuth(mode) {
    mountAuth();
    authMode = mode || 'login';
    var el = document.getElementById('authMask');
    el.hidden = false;
    Array.prototype.forEach.call(el.querySelectorAll('[data-am]'), function (b) {
      b.classList.toggle('is-on', b.getAttribute('data-am') === authMode);
    });
    document.getElementById('auNameWrap').hidden = authMode !== 'reg';
    document.getElementById('auGo').textContent = authMode === 'login' ? '登录' : '注册';
    document.getElementById('auErr').textContent = '';
    setTimeout(function () { var i = document.getElementById('auEmail'); if (i) i.focus(); }, 50);
  }

  /* ---------------------------------------------------------- 数据接口 */
  function list() { return req('GET', '/api/projects').then(function (d) { return d.projects; }); }
  function create(p) {
    return req('POST', '/api/projects', {
      id: p.id, event: p.event, title: p.title || '', query: p.query || '',
      school: p.school || '', major: p.major || '', deadline: p.deadline || '',
      topicIdx: p.topicIdx, checks: p.checks || {},
    });
  }
  function get(id) { return req('GET', '/api/projects/' + id); }
  function patch(p) {
    return req('PATCH', '/api/projects/' + p.id, {
      title: p.title || '', query: p.query || '', school: p.school || '',
      major: p.major || '', deadline: p.deadline || '',
      topicIdx: p.topicIdx, planStack: p.planStack || '', defScheme: p.defScheme || '',
      checks: p.checks || {},
    });
  }
  function del(id) { return req('DELETE', '/api/projects/' + id); }
  function act(pid, aid, body) { return req('POST', '/api/projects/' + pid + '/acts/' + aid, body); }
  function members(pid, arr) { return req('PUT', '/api/projects/' + pid + '/members', { members: arr }); }
  function invite(pid) { return req('POST', '/api/projects/' + pid + '/invite', {}); }
  function join(code) { return req('POST', '/api/join', { code: code }); }
  function feed(pid) { return req('GET', '/api/projects/' + pid + '/feed').then(function (d) { return d.feed; }); }

  /* 元数据防抖同步：连续改（比如勾一串清单）只发最后一次 */
  function syncMeta(p) {
    if (st.mode !== 'online' || !p) return;
    clearTimeout(timers.meta);
    timers.meta = setTimeout(function () {
      patch(p).catch(function () {});
    }, 2200);
  }

  /* ---------------------------------------------------------- 顶栏用户条 */
  function renderChip() {
    var el = document.getElementById('authChip');
    if (!el) return;
    if (st.mode !== 'online') {
      el.className = 'auth-chip off';
      el.innerHTML = '<span class="dot"></span><span>离线模式</span>';
      el.title = '直接打开文件，数据只存在这台电脑。想多人协同就运行 server/index.js 后访问 http://localhost:8787';
      return;
    }
    if (!st.user) {
      el.className = 'auth-chip';
      el.innerHTML = '<button class="auth-login" id="btnLogin">登录 / 注册</button>';
      document.getElementById('btnLogin').addEventListener('click', function () { openAuth('login'); });
      return;
    }
    el.className = 'auth-chip on';
    el.innerHTML = '<span class="dot"></span><span>' + esc(st.user.name) + '</span>' +
      '<button class="auth-out" id="btnLogout" title="退出登录">退出</button>';
    document.getElementById('btnLogout').addEventListener('click', function () {
      if (!confirm('退出登录？本地已勾的进度不会丢。')) return;
      logout();
      location.reload();
    });
  }
  function esc(s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  return {
    get mode() { return st.mode; },
    get user() { return st.user; },
    get token() { return st.token; },
    get online() { return st.mode === 'online'; },
    get reason() { return st.offlineReason; },
    on: function (k, fn) { hooks[k] = fn; },
    boot: boot,
    openAuth: openAuth,
    logout: logout,
    list: list, create: create, get: get, patch: patch, del: del,
    act: act, members: members, invite: invite, join: join, feed: feed,
    syncMeta: syncMeta,
    renderChip: renderChip,
  };
})();
