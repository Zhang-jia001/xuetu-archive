/* 竞赛指导台 · 学生版 V2 —— 工作台 / 项目空间 / 资源库 / 评审答疑（无外部依赖） */
(function () {
  'use strict';

  var D = window.__DATA__;
  var LS = 'compGuide.v2';

  /* ============================================================ 状态 */
  var S = {
    v: 2,
    projects: [],
    active: null,
    view: 'coach',
    tab: 'overview',
    newEv: 'ZDB',
    lib: 'events',
    libEv: 'ZDB',
    libFam: 'survey',
    tQuery: '',
    tEvent: '全部',
    tPage: 0,
    paperType: 'thesis',
    paperChecks: {},
    feed: []
  };

  function save() {
    try { localStorage.setItem(LS, JSON.stringify(S)); } catch (e) {}
    // 在线模式下把项目元数据同步到后端（内部 2.2s 防抖，连续改只发最后一次）
    try {
      if (window.Api && Api.online) {
        var act = P();
        if (act) Api.syncMeta(act);
      }
    } catch (e) {}
  }
  function load() {
    try {
      var raw = localStorage.getItem(LS);
      if (!raw) return false;
      var o = JSON.parse(raw);
      if (o && o.v === 2 && Array.isArray(o.projects)) {
        S = Object.assign(S, o);
        return true;
      }
    } catch (e) {}
    return false;
  }

  /* ============================================================ 工具 */
  function $(s, r) { return (r || document).querySelector(s); }
  function $$(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }
  function esc(s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function pad(n) { return n < 10 ? '0' + n : '' + n; }
  function fmt(d) { return d.getFullYear() + '.' + pad(d.getMonth() + 1) + '.' + pad(d.getDate()); }
  function iso(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function addDays(d, n) { var x = new Date(d.getTime()); x.setDate(x.getDate() + n); return x; }
  var DAY = 86400000;
  function today() { var d = new Date(); d.setHours(0, 0, 0, 0); return d; }
  function short(s, n) { s = String(s || ''); return s.length > n ? s.slice(0, n) + '…' : s; }

  function P() { return S.projects.filter(function (p) { return p.id === S.active; })[0] || null; }
  function C(p) { return p ? D.comps[p.event] : null; }
  function T(p) { return p && p.topicIdx != null ? D.topics[p.topicIdx] : null; }

  var STAGES = [
    { id: 'topic', name: '选题', w: 0.20, pos: 0.15 },
    { id: 'team', name: '组队', w: 0.05, pos: 0.28 },
    { id: 'run', name: '推进', w: 0.50, pos: 0.72 },
    { id: 'close', name: '结项', w: 0.25, pos: 0.95 }
  ];

  /* ============================================================ 匹配 */
  var SYN = {
    '养老': ['老年', '适老', '银发', '老龄', '助餐'],
    '老年': ['养老', '适老', '银发', '老龄'],
    '乡村': ['乡村振兴', '助农', '农业', '农村', '县域'],
    '农业': ['乡村', '种植', '农户', '农技'],
    '非遗': ['文创', '文化', '传统', '技艺'],
    '文创': ['非遗', '文化', 'IP', '设计'],
    '审计': ['合规', '风控', '内控', '监督'],
    '合规': ['审计', '风控', '监管', '法律'],
    '林业': ['林草', '生态', '碳汇', '森林'],
    '双碳': ['低碳', '碳排放', '绿色', '节能'],
    '低碳': ['双碳', '绿色', '碳'],
    '教育': ['教学', '学习', '课程', '学生'],
    '学习': ['教育', '教学', '学生', '作业'],
    '就业': ['求职', '职业', '招聘', '实习'],
    '医疗': ['健康', '诊疗', '就医', '患者'],
    '物流': ['供应链', '配送', '仓储', '快递'],
    '金融': ['信贷', '风控', '支付', '理财'],
    '消费': ['购买', '用户', '定价', '需求'],
    '短视频': ['内容', '传播', '平台', '流量'],
    '大模型': ['LLM', 'RAG', '智能体', 'AI'],
    '智能体': ['Agent', '大模型', 'AI', '工作流'],
    '物联网': ['传感器', '嵌入式', '硬件', '采集'],
    '小程序': ['移动端', 'H5', '应用'],
    '微课': ['教学', '课程', '学习'],
    '景区': ['文旅', '旅游', '客流'],
    '粮食': ['粮价', '储粮', '农业'],
    '环境': ['生态', '污染', '监测']
  };

  function tokens(q) {
    q = (q || '').replace(/[，,。．；;、\/\s]+/g, ' ').trim();
    if (!q) return [];
    var out = {};
    function add(t) { if (t && t.length >= 2) out[t] = 1; }
    q.split(' ').forEach(function (w) {
      if (!w) return;
      add(w);
      if (/[\u4e00-\u9fa5]/.test(w)) {
        for (var i = 0; i < w.length - 1; i++) add(w.slice(i, i + 2));
      }
      Object.keys(SYN).forEach(function (k) {
        if (w.indexOf(k) >= 0 || k.indexOf(w) >= 0) SYN[k].forEach(add);
      });
    });
    return Object.keys(out);
  }

  function bodyOf(t) {
    return [t.选题名称, t.方向, t.选题背景要点, t.可行性要点, t.技术选型与落地, t.验收物, t.院校落点].join(' ');
  }

  function match(eq, school, major, eventKey, limit) {
    var tk = tokens(eq);
    var tag = D.comps[eventKey] ? D.comps[eventKey].topicTag : eventKey;
    var pool = D.topics.filter(function (t) { return t.赛事 === tag; });
    var scored = pool.map(function (t) {
      var body = bodyOf(t), hit = 0, nameHit = 0;
      tk.forEach(function (x) {
        if (body.indexOf(x) >= 0) hit++;
        if ((t.选题名称 || '').indexOf(x) >= 0) nameHit++;
      });
      var s = tk.length ? hit / tk.length : 0;
      if (nameHit) s += Math.min(0.22, nameHit * 0.06);
      if (eq && t.方向 && eq.indexOf(t.方向) >= 0) s += 0.12;
      if (school && (t.适配院校 || []).indexOf(school) >= 0) s += 0.10;
      if (major && t.专业类别 === major) s += 0.06;
      return { idx: D.topics.indexOf(t), pct: Math.min(98, Math.round(s * 100)) };
    });
    scored.sort(function (a, b) { return b.pct - a.pct || a.idx - b.idx; });
    var top = scored.filter(function (x) { return x.pct >= 32; }).slice(0, limit || 5);
    if (!top.length) top = scored.slice(0, 3).map(function (x) { return { idx: x.idx, pct: Math.max(x.pct, 18) }; });
    return top;
  }

  /* ============================================================ 方向族 */
  var C4MAP = {
    '微课与AI辅助教学': 'c4_micro', '大数据应用': 'c4_bigdata',
    '人工智能应用': 'c4_ai', '物联网应用与物联网创新转化': 'c4_iot',
    '软件应用与开发': 'c4_soft'
  };
  function famKey(p) {
    if (!p) return null;
    var t = T(p), dir = t ? t.方向 : '', maj = (t ? t.专业类别 : p.major) || '';
    if (p.event === 'ZDB') return 'survey';
    if (p.event === 'XT') return 'xt';
    if (p.event === 'GCS') return 'gcs';
    if (p.event === 'DCH') return (maj === '计算机' || dir === '政策社会调查') ? 'dch_research' : 'dch_startup';
    if (p.event === 'DT') return maj === '商科' ? 'dt_social' : 'dt_tech';
    if (p.event === 'C4') return C4MAP[dir] || 'c4_media';
    return null;
  }
  function cardOf(p) { var k = famKey(p); return k ? D.cards[k] : null; }

  /* ============================================================ 任务清单 */
  var GEN = {
    topic: [
      ['确认赛事、赛道与组别', '一条项目只能报一个赛道或组别，报错直接出局'],
      ['写出选题一句话', '调查谁 · 问什么 · 为谁的什么决策服务；写不出就是还没想清'],
      ['核验参赛资格', '年级、人数、作品完成时间窗、是否毕设或已获国家级奖励'],
      ['锁定指导教师', '参赛前就谈好，别等报完名再找人'],
      ['写 1 页研究或技术路线', '问题 → 方法 → 数据 → 产出，四行能说清'],
      ['提炼 3 条创新点', '新问题 / 新数据 / 新方法 / 新结论，别写「我们很努力」'],
      ['判断数据可得性', '样本、设备、场地、机构对接，本周内能不能落地；拿不到就换题'],
      ['选题冻结', '定稿写进组内文档，之后只允许微调，不再换方向']
    ],
    team: [
      ['按硬约束定人数', '人数是赛事规则，不是想招几个招几个'],
      ['配 2 名老学员', '一人主技术线、一人主流程与文档线，各自带 2 名左右新同学'],
      ['每人认领一个岗位', '认领要本人说出来，不要由队长指派'],
      ['写出每人一件本周可交付物', '「他到周末会交出 ___，放进 ___，并能在例会上讲 3 分钟」'],
      ['组规三条写进群公告', '例会必到 / 不代做 / 产出署名到人'],
      ['建共享文档库与代码仓库', '原始数据、脚本、版本统一管理，别散在微信里'],
      ['定例会与 1v1 时间', '每周同一时间 1.5 小时例会 + 每人 15 分钟 1 对 1，写进日历'],
      ['定对外接口人', '导师、机构、商户、受访者只找这一个人']
    ],
    run: [
      ['按门禁倒排进日历', '六个门禁日期全部落到具体某一天'],
      ['建周报模板', '本周产出 / 卡点 / 下周计划，每周固定时间填'],
      ['方案冻结', '问卷终稿、技术方案、接口契约一次定死，后面对齐这一版'],
      ['主链路跑通', 'demo 现场能跑，不认录屏；跑不通就砍功能，不砍链路'],
      ['数据采集完成并留证', '过程照片、录音、执行记录，附录要用'],
      ['清洗留日志', '删了多少条、依据是什么，必须可复现'],
      ['结果与结论对齐', '每张图表挂一句结论，每条结论挂数据出处'],
      ['中期自查', '对照门禁逐条核，缺什么补什么'],
      ['材料初稿完成', '报告 / BP / 作品说明，先出结构再填内容'],
      ['外部评审 1 次', '找没听过项目的人提问，他们的问题就是评委的问题'],
      ['查重与盲审自查', '查重压到红线一半以下，盲审信息逐页删干净'],
      ['提交前 2 周定稿', '最后两周只做修补与演练，不再加新内容']
    ]
  };

  function checksOf(p, stage) {
    if (stage !== 'close') return GEN[stage];
    var cl = D.closing[p.event] || { hard: [] };
    var c = D.comps[p.event];
    return cl.hard.map(function (h) { return [h, '']; }).concat([
      ['查重自查通过', c.redline.chong],
      ['盲审与匿名信息清干净', c.redline.blind],
      ['页数、时长、文件大小达标', c.redline.size],
      ['文件命名与提交格式对齐通知', '按「赛事-赛道-项目名-负责人」命名，PDF 与源文件各留一份'],
      ['三份备份', '本地 + 网盘 + 队长一份，提交前 24 小时不再改'],
      ['计时演练 ≥3 次', '每次全程录像，回看砍掉口头禅和超时段落']
    ]);
  }

  function stageStat(p, stage) {
    var items = checksOf(p, stage) || [];
    var box = (p.checks && p.checks[stage]) || {};
    var n = 0;
    items.forEach(function (_, i) { if (box[i]) n++; });
    return { done: n, total: items.length, pct: items.length ? n / items.length : 0 };
  }

  function projStat(p) {
    var d = 0, t = 0;
    STAGES.forEach(function (s) { var x = stageStat(p, s.id); d += x.done; t += x.total; });
    return { done: d, total: t, pct: t ? d / t : 0 };
  }

  function curStage(p) {
    for (var i = 0; i < STAGES.length; i++) {
      var s = stageStat(p, STAGES[i].id);
      if (s.total && s.done < s.total) return STAGES[i].id;
    }
    return 'close';
  }

  function weeksLeft(p) {
    if (!p.deadline) return C(p).weeks;
    var d = new Date(p.deadline + 'T23:59:59');
    if (isNaN(d.getTime())) return C(p).weeks;
    return Math.max(0, Math.ceil((d - today()) / (7 * DAY)));
  }

  function planOf(p) {
    var total = p.deadline ? weeksLeft(p) : C(p).weeks;
    total = Math.max(4, total);
    var days = total * 7, start = today();
    var stages = STAGES.map(function (s) {
      return { id: s.id, name: s.name, end: addDays(start, Math.round(days * s.pos)) };
    });
    var gates = D.gates.map(function (g) {
      var dt = addDays(start, Math.round(days * (g.pos)));
      var st = stageStat(p, g.stage);
      var done = st.total > 0 && st.done === st.total;
      return { name: g.name, desc: g.desc, stage: g.stage, date: dt, done: done, late: !done && dt < today() };
    });
    return { weeks: total, stages: stages, gates: gates };
  }

  /* ============================================================ 项目操作 */
  function newProject(ev, query, school, major, deadline, topicIdx) {
    var c = D.comps[ev];
    var p = {
      id: 'p' + Date.now().toString(36),
      event: ev,
      query: query || '',
      school: school || '',
      major: major || '',
      deadline: deadline || iso(addDays(today(), c.weeks * 7)),
      topicIdx: topicIdx != null ? topicIdx : null,
      checks: { topic: {}, team: {}, run: {}, close: {} },
      members: [],
      createdAt: Date.now()
    };
    if (p.topicIdx == null) {
      var m = match(p.query, p.school, p.major, ev, 5);
      p.topicIdx = m.length ? m[0].idx : null;
    }
    S.projects.unshift(p);
    S.active = p.id;
    save();
    if (window.Api && Api.online && Api.user) {
      Api.create(p).catch(function (e) { console.warn('[api] 建项目没同步上：' + e.message); });
    }
    return p;
  }

  /* ============================================================ 渲染：导航 */
  function renderNav() {
    var p = P();
    $('#navProjCount').textContent = S.projects.length || '';
    $('#navProjCount').style.display = S.projects.length ? '' : 'none';
    var cdEl = $('#navCoachDone');
    if (cdEl) {
      if (p) {
        var bn = actDoneCount(p);
        cdEl.textContent = bn + '/' + ck().total;
        cdEl.style.display = '';
        cdEl.classList.toggle('is-seen', bn === ck().total);
      } else {
        cdEl.textContent = '未开始';
        cdEl.style.display = '';
      }
    }
    $('#navProject').disabled = !p;
    $$('#navSub .nav-item').forEach(function (b) { b.disabled = !p; });
    $('#navSub').classList.toggle('is-open', !!p && S.view === 'project');

    $$('.nav-item[data-go]').forEach(function (b) {
      b.classList.toggle('is-on', b.getAttribute('data-go') === S.view);
    });
    $$('#navSub .nav-item').forEach(function (b) {
      var on = S.view === 'project' && b.getAttribute('data-tab') === S.tab;
      b.classList.toggle('is-on', on);
      var st = p && b.getAttribute('data-tab');
      if (p && st) {
        var s = stageStat(p, st);
        var el = $('.nav-pct', b);
        if (el) el.textContent = s.total ? s.done + '/' + s.total : '';
        b.classList.toggle('is-done', s.total > 0 && s.done === s.total);
      }
    });

    var ps = p ? projStat(p) : null;
    $('#miniPct').textContent = ps ? Math.round(ps.pct * 100) + '%' : '—';
    $('#miniBar').style.width = ps ? (ps.pct * 100) + '%' : '0%';
  }

  function renderCrumb() {
    var p = P();
    if (S.view === 'coach') {
      var cp = P();
      $('#crumb').innerHTML = '<b>今天做什么</b>' + (cp ? '<span class="sep">/</span><span class="ell">' +
        esc(short(T(cp) ? T(cp).选题名称 : (cp.query || '未定题'), 22)) + '</span>' : '');
    }
    else if (S.view === 'home') $('#crumb').innerHTML = '<b>我的工作台</b>';
    else if (S.view === 'library') {
      $('#crumb').innerHTML = '<b>资源库</b><span class="sep">/</span><span>' +
        ({ events: '赛事口径', families: '方向族打法', topics: '选题池' })[S.lib] + '</span>';
    } else if (S.view === 'mentor') {
      $('#crumb').innerHTML = '<b>评审与答疑</b>' + (p ? '<span class="sep">/</span><span class="ell">' + esc(C(p).short) + '</span>' : '');
    } else if (S.view === 'paper') {
      $('#crumb').innerHTML = '<b>论文写作台</b><span class="sep">/</span><span>' + esc(paperOf().name) + '</span>';
    } else if (p) {
      var stageName = ({ overview: '概览', topic: '选题', team: '组队', run: '推进', close: '结项' })[S.tab];
      $('#crumb').innerHTML = '<b>项目空间</b><span class="sep">/</span><span class="ell">' +
        esc(short(T(p) ? T(p).选题名称 : p.query, 28)) + '</span><span class="sep">/</span><span>' + stageName + '</span>';
    }

    if (p && p.deadline && (S.view === 'project' || S.view === 'mentor')) {
      $('#pillDeadline').hidden = false;
      $('#pillDeadlineText').textContent = '距截止 ' + weeksLeft(p) + ' 周';
    } else {
      $('#pillDeadline').hidden = true;
    }
  }

  /* ============================================================ 渲染：首页 */
  function renderHome() {
    $('#miniEv').innerHTML = D.order.map(function (k) {
      return '<button data-ev="' + k + '"' + (S.newEv === k ? ' class="is-on"' : '') + '>' + esc(D.comps[k].short.split('（')[0]) + '</button>';
    }).join('');
    $$('#miniEv button').forEach(function (b) {
      b.addEventListener('click', function () {
        S.newEv = b.getAttribute('data-ev');
        $$('#miniEv button').forEach(function (x) { x.classList.toggle('is-on', x === b); });
        updateGen();
      });
    });

    $('#quickWindows').innerHTML = D.order.map(function (k) {
      var c = D.comps[k];
      return '<tr><td><b>' + esc(c.short) + '</b></td><td class="muted">' + esc(c.cycle) + '</td></tr>';
    }).join('');

    renderProjGrid();
    updateGen();
  }

  function renderProjGrid() {
    var sec = $('#projSec');
    if (!S.projects.length) { sec.hidden = true; return; }
    sec.hidden = false;
    $('#projGrid').innerHTML = S.projects.map(function (p) {
      var c = C(p), t = T(p), st = projStat(p), w = weeksLeft(p);
      return '<button class="proj-card" data-pid="' + p.id + '">' +
        '<span class="proj-del" data-del="' + p.id + '" title="删除">×</span>' +
        '<div class="proj-card-top"><span class="proj-ev">' + esc(c.short.split('（')[0]) + '</span>' +
        '<span class="tag">' + esc(curStageName(p)) + '</span>' +
        (w <= 2 ? '<span class="tag warn">剩 ' + w + ' 周</span>' : '') + '</div>' +
        '<h3>' + esc(t ? t.选题名称 : (p.query || '未选题')) + '</h3>' +
        '<div class="proj-bar"><i style="width:' + Math.round(st.pct * 100) + '%"></i></div>' +
        '<div class="proj-meta"><span class="mono">' + st.done + '/' + st.total + '</span>' +
        '<span>完成 ' + Math.round(st.pct * 100) + '%</span><span>·</span><span>剩 ' + w + ' 周</span></div>' +
        '</button>';
    }).join('');

    $$('#projGrid .proj-card').forEach(function (el) {
      el.addEventListener('click', function (e) {
        if (e.target.hasAttribute('data-del')) return;
        S.active = el.getAttribute('data-pid');
        S.view = 'project'; S.tab = 'overview';
        save(); renderAll();
      });
    });
    $$('#projGrid [data-del]').forEach(function (el) {
      el.addEventListener('click', function (e) {
        e.stopPropagation();
        if (!confirm('删除这个项目及其全部勾选记录？')) return;
        var id = el.getAttribute('data-del');
        if (window.Api && Api.online && Api.user) {
          Api.del(id).catch(function () {});
        }
        S.projects = S.projects.filter(function (x) { return x.id !== id; });
        if (S.active === id) S.active = S.projects.length ? S.projects[0].id : null;
        save(); renderAll();
      });
    });
  }

  function curStageName(p) {
    var id = curStage(p);
    var m = { topic: '选题阶段', team: '组队阶段', run: '推进阶段', close: '结项阶段' };
    return m[id];
  }

  function updateGen() {
    var q = ($('#queryInput').value || '').trim();
    $('#btnGenerate').disabled = !(S.newEv && q.length >= 2);
  }

  /* ============================================================ 渲染：项目空间 */
  function renderProject() {
    var p = P();
    if (!p) { go('coach'); return; }
    var c = C(p), t = T(p);

    $('#pdTitle').textContent = t ? t.选题名称 : (p.query || '未命名项目');
    $('#pdMeta').innerHTML =
      '<span class="tag solid">' + esc(c.short) + '</span>' +
      (t ? '<span class="tag">' + esc(t.方向) + '</span><span class="tag">' + esc(t.专业类别) + '</span>' : '') +
      (p.school ? '<span class="tag">' + esc(p.school) + '</span>' : '') +
      (p.deadline ? '<span class="tag">截止 ' + esc(p.deadline) + '</span>' : '');
    var w = weeksLeft(p);
    $('#pdDays').innerHTML = w + '<small>周</small>';
    $('#pdDaysNote').textContent = p.deadline ? '距 ' + p.deadline + ' 截止' : '按标准周期';

    // 阶段条
    $('#stepper').innerHTML = STAGES.map(function (s, i) {
      var st = stageStat(p, s.id);
      var done = st.total > 0 && st.done === st.total;
      var on = S.tab === s.id || (S.tab === 'overview' && curStage(p) === s.id);
      return '<button class="step' + (done ? ' is-done' : '') + (on ? ' is-on' : '') + '" data-tab="' + s.id + '">' +
        '<span class="step-name">' + (i + 1) + ' · ' + s.name + '</span>' +
        '<span class="step-sub">' + (st.total ? st.done + '/' + st.total : '—') + '</span></button>';
    }).join('');
    $$('#stepper .step').forEach(function (b) {
      b.addEventListener('click', function () { setTab(b.getAttribute('data-tab')); });
    });

    $$('.ptab').forEach(function (x) { x.hidden = x.id !== 'ptab-' + S.tab; });
    if (S.tab === 'overview') renderOverview(p);
    if (S.tab === 'topic') renderTabTopic(p);
    if (S.tab === 'team') renderTabTeam(p);
    if (S.tab === 'run') renderTabRun(p);
    if (S.tab === 'close') renderTabClose(p);
    $('#footProj').textContent = c.short;
  }

  function renderOverview(p) {
    var c = C(p), t = T(p), st = projStat(p), pl = planOf(p);
    var cs = curStage(p);
    var csName = ({ topic: '选题', team: '组队', run: '推进', close: '结项' })[cs];
    var overdue = pl.gates.filter(function (g) { return g.late; });

    var html = '';
    html += '<div class="stat-row">' +
      '<div class="stat"><div class="stat-k">总进度</div><div class="stat-v">' + Math.round(st.pct * 100) + '<small>%</small></div></div>' +
      '<div class="stat"><div class="stat-k">当前阶段</div><div class="stat-v" style="font-size:15px">' + csName + '<small>' + stageStat(p, cs).done + '/' + stageStat(p, cs).total + '</small></div></div>' +
      '<div class="stat ' + (overdue.length ? 'rose' : 'mint') + '"><div class="stat-k">门禁逾期</div><div class="stat-v">' + overdue.length + '<small>个</small></div></div>' +
      '<div class="stat ' + (pl.weeks <= 3 ? 'amber' : '') + '"><div class="stat-k">剩余周期</div><div class="stat-v">' + pl.weeks + '<small>周</small></div></div>' +
      '</div>';

    html += '<div class="grid-2">';

    // 左：诊断 + 下一步
    html += '<div>';
    html += '<div class="sec"><div class="sec-head"><span class="sec-num">诊断</span>' +
      '<h2 class="sec-title">你现在的位置</h2><span class="sec-note">按已勾任务推算</span></div>' +
      '<p class="small muted">' + diag(p) + '</p>' +
      '<div class="callout ' + (overdue.length ? 'rose' : 'blue') + '"><span class="ct">' +
      (overdue.length ? '要先处理的事' : '当前主要风险') + '</span>' +
      (overdue.length
        ? overdue.map(function (g) { return g.name; }).join('、') + ' 已经过了建议日期但没完成 —— 先补这一项，再谈往下推。'
        : esc(c.risk) + '。') + '</div></div>';

    html += '<div class="sec"><div class="sec-head"><span class="sec-num">本周</span>' +
      '<h2 class="sec-title">这周就做这三件</h2><span class="sec-note">来自「' + csName + '」阶段</span></div>' +
      '<div class="next-list">' + nextActions(p, cs) + '</div>' +
      '<div class="btn-row"><button class="btn" data-tab-go="' + cs + '">进入' + csName + '阶段 →</button></div></div>';
    html += '</div>';

    // 右：阶段 + 门禁
    html += '<div>';
    html += '<div class="sec"><div class="sec-head"><span class="sec-num">阶段</span>' +
      '<h2 class="sec-title">四段任务</h2></div>' +
      STAGES.map(function (s) {
        var x = stageStat(p, s.id);
        return '<div class="check-item' + (x.total && x.done === x.total ? ' is-done' : '') + '" data-stage-go="' + s.id + '">' +
          '<span class="ci-body"><span class="ci-text"><b>' + s.name + '</b>　' +
          '<span class="faint mono">' + x.done + '/' + x.total + '</span></span>' +
          '<span class="ci-hint">' + stageDesc(s.id) + '</span></span></div>';
      }).join('') + '</div>';

    html += '<div class="sec"><div class="sec-head"><span class="sec-num">门禁</span>' +
      '<h2 class="sec-title">最近三个节点</h2></div>' +
      pl.gates.slice(0, 3).map(function (g) {
        var cls = g.done ? 'ok' : (g.late ? 'warn' : '');
        var txt = g.done ? '已过' : (g.late ? '逾期' : '未到');
        return '<div style="display:flex;justify-content:space-between;gap:8px;padding:6px 0;border-bottom:1px solid var(--line);font-size:12px">' +
          '<span>' + g.name + '</span><span class="mono faint">' + fmt(g.date) + '</span>' +
          '<span class="tag ' + cls + '">' + txt + '</span></div>';
      }).join('') + '</div>';
    html += '</div></div>';

    $('#ptab-overview').innerHTML = html;

    $$('#ptab-overview [data-tab-go], #ptab-overview [data-stage-go]').forEach(function (b) {
      b.addEventListener('click', function () {
        setTab(b.getAttribute('data-tab-go') || b.getAttribute('data-stage-go'));
      });
    });
  }

  function diag(p) {
    var c = C(p), t = T(p), st = projStat(p), out = [];
    out.push('你报的是 <b>' + esc(c.short) + '</b>，入口按「' + esc(c.entry) + '」走。');
    if (t) out.push('方向落在「' + esc(t.方向) + '」，核心交付是 <b>' + esc(short(t.验收物, 40)) + '</b>。');
    out.push('任务完成 <b>' + st.done + '/' + st.total + '</b>，剩余 <b>' + weeksLeft(p) + '</b> 周。');
    return out.join('');
  }

  function nextActions(p, stage) {
    var items = checksOf(p, stage), box = (p.checks && p.checks[stage]) || {};
    var list = [];
    items.forEach(function (it, i) {
      if (!box[i] && list.length < 3) list.push([it[0], it[1]]);
    });
    if (!list.length) {
      var nxt = { topic: 'team', team: 'run', run: 'close', close: '' }[stage];
      if (nxt) return '<div class="next-item"><span class="n">→</span><div><div class="t">这一阶段已全部完成，进入「' +
        ({ team: '组队', run: '推进', close: '结项' })[nxt] + '」</div><div class="h">不要停在原地反复打磨，往下走</div></div></div>';
      return '<div class="next-item"><span class="n">✓</span><div><div class="t">全部任务已完成，做最后的提交检查</div><div class="h">再跑一遍结项自查表，确认文件与备份</div></div></div>';
    }
    return list.map(function (x, i) {
      return '<div class="next-item"><span class="n">' + pad(i + 1) + '</span><div><div class="t">' +
        x[0] + '</div><div class="h">' + (x[1] || '') + '</div></div></div>';
    }).join('');
  }

  function stageDesc(id) {
    return {
      topic: '定题、写路线、核资格、冻结方向',
      team: '定人数、配岗位、定组规与例会',
      run: '方案冻结 → 主链路跑通 → 数据结果 → 初稿',
      close: '定稿、自查、盲审查重、计时演练'
    }[id];
  }

  /* ------------------------------------------------------------ 选题 tab */
  function renderTabTopic(p) {
    var c = C(p), t = T(p);
    var ms = match(p.query, p.school, p.major, p.event, 5);
    var cd = cardOf(p);
    var html = '';

    html += '<div class="sec"><div class="sec-head"><span class="sec-num">02.1</span>' +
      '<h2 class="sec-title">匹配到的选题</h2><span class="sec-note">' + c.topicTag + '池 · 命中 ' + ms.length + ' 条</span></div>' +
      '<div class="match-list">' + ms.map(function (m, i) {
        var x = D.topics[m.idx];
        var on = p.topicIdx === m.idx ? ' is-on' : '';
        return '<div class="match' + on + '" data-idx="' + m.idx + '">' +
          '<span class="match-idx">' + pad(i + 1) + '</span>' +
          '<div class="match-body"><div class="match-title">' + esc(x.选题名称) + '</div>' +
          '<div class="match-meta"><span class="tag solid">' + esc(x.方向) + '</span>' +
          '<span class="tag">' + esc(x.专业类别) + '</span>' +
          (p.school ? '<span class="tag ' + ((x.适配院校 || []).indexOf(p.school) >= 0 ? 'ok' : '') + '">' +
            ((x.适配院校 || []).indexOf(p.school) >= 0 ? '本校可做' : '需跨校协作') + '</span>' : '') +
          '</div></div><div class="match-score"><b>' + m.pct + '</b><span>相关度</span></div></div>';
      }).join('') + '</div>' +
      '<div class="callout"><span class="ct">相关度口径</span>关键词与方向命中加权，仅用于排序，不代表选题质量。分数低但你看得懂的题，比分数高但做不动的题更值得选。</div></div>';

    if (t) {
      html += '<div class="sec"><div class="sec-head"><span class="sec-num">02.2</span>' +
        '<h2 class="sec-title">选题七要素</h2><span class="sec-note">' + esc(t.赛事 + ' · ' + t.方向) + '</span></div>' +
        '<div class="callout blue"><span class="ct">一句话诊断</span>' + diagTopic(p, t) + '</div>' +
        '<dl class="kv">' +
        kvRow('选题背景', t.选题背景要点) + kvRow('可行性', t.可行性要点) +
        kvRow('技术选型', t.技术选型与落地) + kvRow('验收物', t.验收物) +
        kvRow('课程对位', t.课程对位) + kvRow('院校落点', t.院校落点) +
        '</dl></div>';
    }

    if (cd) {
      html += '<div class="sec"><div class="sec-head"><span class="sec-num">02.3</span>' +
        '<h2 class="sec-title">这类题怎么打</h2><span class="sec-note">' + cd.name + '</span></div>' +
        '<p class="small muted">' + cd.head + '</p>' +
        '<h3>落地步骤</h3><div class="tl">' + cd.steps.map(function (s) {
          return '<div class="tl-item"><div class="tl-head"><span class="tl-title">' + s[0] + '</span></div>' +
            '<div class="tl-body"><ul>' + s[1].map(function (li) { return '<li>' + li + '</li>'; }).join('') + '</ul></div></div>';
        }).join('') + '</div>' +
        '<h3>材料清单与常见扣分点</h3>' + tableOf(['材料', '要求', '常见问题'], cd.mats.map(function (r) {
          return ['<b>' + r[0] + '</b>', r[1], '<span class="muted">' + r[2] + '</span>'];
        })) +
        '<h3>周次排期</h3>' + tableOf(['阶段', '周次', '产出', '关卡'], cd.sched.map(function (r) {
          return ['<b>' + r[0] + '</b>', '<span class="mono nowrap">' + r[1] + '</span>', r[2], '<span class="muted">' + r[3] + '</span>'];
        })) + (cd.tip ? '<div class="callout">' + cd.tip + '</div>' : '') + '</div>';
    }

    html += checkBlock(p, 'topic', '02.4', '选题阶段任务') + tabFooter(p, 'topic');

    $('#ptab-topic').innerHTML = html;
    bindMatches(p);
    bindChecks(p, 'topic');
  }

  function diagTopic(p, t) {
    var c = C(p), parts = [];
    parts.push('入口按 <b>' + esc(c.entry) + '</b> 走。');
    parts.push('核心交付是 <b>' + esc(short(t.验收物, 46)) + '</b>。');
    if (p.school) {
      var fit = (t.适配院校 || []).indexOf(p.school) >= 0;
      parts.push(fit ? '这条题在 <b>' + esc(p.school) + '</b> 的适配名单里。'
        : '这条题不完全适配 <b>' + esc(p.school) + '</b>，落地要先解决样本或场景来源。');
    }
    parts.push('最容易卡住：' + esc(c.risk) + '。');
    return parts.join('');
  }

  /* ------------------------------------------------------------ 组队 tab */
  function renderTabTeam(p) {
    var c = C(p);
    var row = D.team.rows.filter(function (r) { return r[0] === c.teamKey; })[0];
    var html = '';

    if (row) {
      var slots = '';
      for (var i = 0; i < row[3]; i++) slots += '<div class="slot old">老学员</div>';
      for (var j = 0; j < row[4]; j++) slots += '<div class="slot new">新同学</div>';
      for (var k = row[3] + row[4]; k < row[2]; k++) slots += '<div class="slot">待定</div>';
      html += '<div class="sec"><div class="sec-head"><span class="sec-num">03.1</span>' +
        '<h2 class="sec-title">人数与结构</h2><span class="sec-note">' + esc(c.size) + '</span></div>' +
        tableOf(['人数硬约束', '建议总人数', '老学员', '新同学', '组队范围'],
          [[esc(row[1]), '<span class="mono">' + row[2] + ' 人</span>', '<span class="mono">' + row[3] + '</span>',
            '<span class="mono">' + row[4] + '</span>', row[6]]]) +
        '<div class="slot-grid">' + slots + '</div>' +
        '<p class="small muted">新同学典型岗位：' + esc(row[5]) + '</p>' +
        '<div class="callout amber"><span class="ct">为什么固定 2 名老学员</span>' +
        '1 名会被进度压垮，最后一定退回「我来做」；2 名能分工（一人主技术线、一人主流程与文档线），彼此也有对照，新同学才敢问问题。</div></div>';
    }

    html += '<div class="sec"><div class="sec-head"><span class="sec-num">03.2</span>' +
      '<h2 class="sec-title">岗位怎么切</h2><span class="sec-note">同岗位不同难度</span></div>' +
      tableOf(D.team.postCols, D.team.postRows.map(function (r) {
        return ['<b>' + r[0] + '</b>', r[1], r[2], '<span class="muted">' + r[3] + '</span>'];
      })) +
      '<div class="callout rose"><span class="ct">两条红线</span>' +
      '① 不让新同学打杂 —— 变成「我做技术、你贴发票」，他会得出「这里不需要我学」，反而加速流失。<br>' +
      '② 老学员不许代做 —— 代做一次，机制就退化成「一个人干、其他人看」。</div>' +
      '<div class="callout mint"><span class="ct">派活自检句式</span>' +
      '「他到周末会交出 <b>______</b>，这个东西会被放进 <b>______</b>，并且他能在例会上讲 3 分钟。」三个空格填不满，说明这条任务还是打杂，要重写。</div></div>';

    html += '<div class="sec"><div class="sec-head"><span class="sec-num">03.3</span>' +
      '<h2 class="sec-title">我的队伍</h2><span class="sec-note">只存在本机</span></div>' +
      '<div id="memberList"></div>' +
      '<button class="btn ghost sm" id="addMember" style="margin-top:10px">+ 添加成员</button></div>';

    html += checkBlock(p, 'team', '03.4', '组队阶段任务') + tabFooter(p, 'team');

    $('#ptab-team').innerHTML = html;
    renderMembers(p);
    bindChecks(p, 'team');
  }

  function renderMembers(p) {
    var c = C(p);
    var row = D.team.rows.filter(function (r) { return r[0] === c.teamKey; })[0];
    if (!p.members || !p.members.length) {
      p.members = [{ name: '', role: 'old', post: '技术' }, { name: '', role: 'old', post: '文档' }];
      var nn = row ? Math.min(3, row[4]) : 3;
      for (var i = 0; i < nn; i++) p.members.push({ name: '', role: 'new', post: ['调研', '数据', '答辩'][i] || '运营' });
      save();
    }
    var posts = ['技术', '调研', '数据', '文档', '运营', '答辩'];
    $('#memberList').innerHTML = p.members.map(function (m, i) {
      return '<div class="member-row">' +
        '<span class="role-badge ' + m.role + '">' + (m.role === 'old' ? '老学员' : '新同学') + '</span>' +
        '<input class="input sm" data-mi="' + i + '" data-f="name" value="' + esc(m.name) + '" placeholder="姓名">' +
        '<select class="input sm" data-mi="' + i + '" data-f="post">' +
        posts.map(function (x) { return '<option' + (m.post === x ? ' selected' : '') + '>' + x + '</option>'; }).join('') + '</select>' +
        '<select class="input sm" data-mi="' + i + '" data-f="role">' +
        '<option value="old"' + (m.role === 'old' ? ' selected' : '') + '>老学员</option>' +
        '<option value="new"' + (m.role === 'new' ? ' selected' : '') + '>新同学</option></select>' +
        '<button class="icon-btn" data-del="' + i + '">×</button></div>';
    }).join('');

    $$('#memberList input, #memberList select').forEach(function (el) {
      el.addEventListener('input', onEdit);
      el.addEventListener('change', onEdit);
    });
    function onEdit() {
      var i = +this.getAttribute('data-mi'), f = this.getAttribute('data-f');
      p.members[i][f] = this.value; save();
      syncMembers(p);
      if (f === 'role') renderMembers(p);
    }
    $$('#memberList [data-del]').forEach(function (el) {
      el.addEventListener('click', function () {
        p.members.splice(+el.getAttribute('data-del'), 1); save();
        syncMembers(p);
        renderMembers(p);
      });
    });
    $('#addMember').addEventListener('click', function () {
      p.members.push({ name: '', role: 'new', post: '运营' }); save();
      syncMembers(p);
      renderMembers(p);
    });
  }

  var syncMembersT = null;
  function syncMembers(p) {
    if (!(window.Api && Api.online && Api.user)) return;
    clearTimeout(syncMembersT);
    syncMembersT = setTimeout(function () {
      Api.members(p.id, p.members.map(function (m) {
        return { name: m.name || '', post: m.post || '技术', role: m.role || 'new', userId: m.userId || null };
      })).catch(function () {});
    }, 1200);
  }

  /* ------------------------------------------------------------ 推进 tab */
  // 选题级落地方案：技术栈模板 × 选题覆盖 × 赛事节奏
  function execPlan(p) {
    var t = T(p);
    if (!t || !D.plan) return null;
    var key = String(t.序号);
    var def = D.plan.of[key];
    var sk = p.planStack || def;
    if (!sk || !D.plan.stacks[sk]) return null;
    var useDefault = !p.planStack || p.planStack === def;
    return {
      key: sk,
      st: D.plan.stacks[sk],
      ov: useDefault ? D.plan.ov[key] : null,
      guessed: useDefault ? (D.plan.guess || []).indexOf(key) >= 0 : false,
      switched: !!p.planStack && p.planStack !== def,
      hasDefault: !!def
    };
  }

  function planToolTable(ep) {
    return tableOf(['组件', '版本', '干什么用', '装不上怎么办'], ep.st.tools.map(function (t) {
      return ['<b>' + esc(t.name) + '</b>' + (t.must ? ' <span class="k">必装</span>' : ''),
        '<span class="mono nowrap">' + esc(t.ver) + '</span>',
        esc(t.why), '<span class="muted">' + esc(t.fb) + '</span>'];
    }));
  }

  function planDayCards(ep) {
    return '<div class="day-list">' + ep.st.days.map(function (d) {
      return '<div class="day"><div class="day-d mono">' + d.d + '</div><div class="day-body">' +
        '<div class="day-t">' + esc(d.title) + '</div>' +
        '<ol class="day-todo">' + d.todo.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ol>' +
        '<div class="day-out"><span class="k">交这个</span>' + esc(d.out) + '</div>' +
        (d.ref && d.ref.length
          ? '<div class="day-ref"><span class="k">卡住看</span>' +
            d.ref.map(function (r) {
              return r.indexOf('·') >= 0
                ? '<span class="cref">' + esc(r) + '</span>'
                : '<span>' + esc(r) + '</span>';
            }).join('') + '</div>'
          : '') +
        (d.trap ? '<div class="day-trap"><span class="k">注意</span>' + esc(d.trap) + '</div>' : '') +
        '</div></div>';
    }).join('') + '</div>';
  }

  function planRoute(ep) {
    return '<div class="route-list">' + ep.st.route.map(function (r, i) {
      return '<div class="route"><div class="route-head">' +
        '<span class="route-idx mono">' + pad(i + 1) + '</span>' +
        '<span class="route-phase">' + esc(r.phase) + '</span>' +
        '<span class="cref">' + esc(r.weeks) + '</span></div>' +
        '<div class="route-goal">目标：' + esc(r.goal) + '</div>' +
        '<div class="route-must">' + r.must.map(function (m) {
          var p2 = m.split('｜');
          return '<div class="route-item"><span class="ri-a">' + esc(p2[0]) + '</span>' +
            (p2[1] ? '<span class="ri-b cref">' + esc(p2[1]) + '</span>' : '') + '</div>';
        }).join('') + '</div>' +
        '<div class="route-skip"><span class="k">可以跳过</span>' + esc(r.skip) + '</div>' +
        '<div class="route-out"><span class="k">学完能做什么</span>' + esc(r.out) + '</div>' +
        '</div>';
    }).join('') + '</div>';
  }

  /* ---- 分组开发排期：按队员配置排 ------------------------------------------ */
  function roleOf(k) {
    var r = (D.dev.roles || []).filter(function (x) { return x.k === k; })[0];
    return r || { k: k, n: k, d: '', merge: '' };
  }

  // holder 这个角色能不能接 need 这类任务（沿兼岗链上溯）
  function roleCan(holder, need) {
    if (holder === need) return true;
    var cur = need, g = 0, r;
    while (g++ < 6) {
      r = roleOf(cur);
      if (!r.merge) return false;
      cur = r.merge;
      if (cur === holder) return true;
    }
    return false;
  }

  function rosterOf(p) {
    var ds = D.dev, arr = [];
    var ms = (p.members || []).slice();
    if (!ms.length) {
      var keys = ds.staffing['5'] || [];
      keys.forEach(function (k, i) {
        arr.push({ i: i, name: '标配 ' + roleOf(k).n, role: k, post: '', virtual: true });
      });
      return arr;
    }
    ms.forEach(function (m, i) {
      var rk = (p.roles && p.roles[i]) || ds.post2role[m.post] || 'beA';
      arr.push({ i: i, name: m.name || ('成员 ' + (i + 1)), role: rk, post: m.post || '', old: m.role === 'old' });
    });
    return arr;
  }

  function buildSchedule(tasks, roster) {
    var done = {}, left = tasks.slice(), w = 1, guard = 0, lanes = {};
    roster.forEach(function (m) { lanes[m.i] = []; });
    while (left.length && w <= 40 && guard++ < 400) {
      var moved = false;
      roster.forEach(function (m) {
        for (var i = 0; i < left.length; i++) {
          var t = left[i];
          if (!roleCan(m.role, t.role)) continue;
          var ok = true;
          for (var j = 0; j < t.dep.length; j++) { if (!done[t.dep[j]]) { ok = false; break; } }
          if (!ok) continue;
          left.splice(i, 1);
          done[t.id] = { w: w, m: m, t: t };
          lanes[m.i].push({ w: w, t: t });
          moved = true;
          return;
        }
      });
      if (!moved && left.length) {
        // 依赖成环或角色全缺 → 强行解锁，保证有排期可看
        var t0 = left.shift();
        var host = roster.filter(function (m) { return roleCan(m.role, t0.role); })[0] || roster[0];
        done[t0.id] = { w: w, m: host, t: t0, forced: true };
        lanes[host.i].push({ w: w, t: t0, forced: true });
      }
      w++;
    }
    return { weeks: Math.max(1, w - 1), lanes: lanes, done: done, unscheduled: left.length };
  }

  function criticalChain(tasks) {
    var map = {}, memo = {};
    tasks.forEach(function (t) { map[t.id] = t; });
    function depth(t) {
      if (memo[t.id] != null) return memo[t.id];
      var d = 1;
      t.dep.forEach(function (x) { if (map[x]) d = Math.max(d, depth(map[x]) + 1); });
      memo[t.id] = d;
      return d;
    }
    var best = null, bd = 0;
    tasks.forEach(function (t) { var d = depth(t); if (d > bd) { bd = d; best = t; } });
    var chain = [], cur = best;
    while (cur) {
      chain.unshift(cur);
      var nxt = null, nd = 0;
      cur.dep.forEach(function (x) { if (map[x] && depth(map[x]) > nd) { nd = depth(map[x]); nxt = map[x]; } });
      cur = nxt;
    }
    return chain;
  }

  function roleGaps(tasks, roster) {
    var have = {};
    roster.forEach(function (m) { if (!have[m.role]) have[m.role] = m; });
    var out = [];
    (D.dev.roles || []).forEach(function (r) {
      var used = tasks.some(function (t) { return t.role === r.k; });
      if (!used) return;
      if (have[r.k]) { out.push({ k: r.k, n: r.n, has: true, by: null }); return; }
      var cover = roster.filter(function (m) { return roleCan(m.role, r.k); })[0];
      out.push({ k: r.k, n: r.n, has: false, by: cover || null });
    });
    return out;
  }

  function minWeeks(tasks, n) {
    var keys = D.dev.staffing[String(n)] || D.dev.staffing['7'] || [];
    var rs = keys.map(function (k, i) { return { i: 100 + i, name: 'v' + i, role: k }; });
    return buildSchedule(tasks, rs).weeks;
  }

  function shortName(s) { return s.length > 8 ? s.slice(0, 8) : s; }

  function renderSchedule(p, ep) {
    var tasks = (D.dev.tasks || {})[ep.key] || [];
    if (!tasks.length) return '';
    var roster = rosterOf(p);
    var sc = buildSchedule(tasks, roster);
    var full = buildSchedule(tasks, D.dev.roles.map(function (r, i) { return { i: 100 + i, name: r.n, role: r.k }; }));
    var chain = criticalChain(tasks);
    var gaps = roleGaps(tasks, roster);
    var vac = gaps.filter(function (g) { return !g.has; });          // 角色空缺
    var bare = vac.filter(function (g) { return !g.by; });            // 空缺且无人能兼
    var cover = vac.filter(function (g) { return !!g.by; });          // 空缺但有兼岗
    var html = '';

    html += '<div class="sec"><div class="sec-head"><span class="sec-num">04.3</span>' +
      '<h2 class="sec-title">分组开发排期</h2><span class="sec-note">按队员配置自动排 · ' +
      tasks.length + ' 个任务 · ' + sc.weeks + ' 周</span></div>';

    html += '<div class="stat-row">' +
      '<div class="stat"><div class="stat-k">排期长度</div><div class="stat-v">' + sc.weeks + '<small>周</small></div></div>' +
      '<div class="stat"><div class="stat-k">满员可压到</div><div class="stat-v">' + full.weeks + '<small>周</small></div></div>' +
      '<div class="stat ' + (bare.length ? 'rose' : (vac.length ? 'amber' : 'mint')) + '"><div class="stat-k">角色空缺</div><div class="stat-v">' + vac.length + '<small>个</small></div></div>' +
      '<div class="stat"><div class="stat-k">关键路径</div><div class="stat-v">' + chain.length + '<small>环</small></div></div>' +
      '</div>';

    if (vac.length) {
      html += '<div class="callout ' + (bare.length ? 'rose' : 'amber') + '"><span class="ct">按这套人马排出来的结果</span>' +
        '要 <b>' + sc.weeks + ' 周</b>；7 个角色都齐只要 <b>' + full.weeks + ' 周</b>。' +
        (cover.length ? '其中 ' + cover.map(function (g) { return esc(g.n) + ' 由 ' + esc(roleOf(g.by.role).n) + ' 兼'; }).join('、') + '，' : '') +
        (bare.length ? '<b>' + bare.map(function (g) { return esc(g.n); }).join('、') + ' 没人也无人可兼</b>，这部分任务只能压到最后。' : '') +
        '要么补人，要么把对应模块从验收范围里砍掉 —— 不要假设「到时候挤一挤就做完了」。</div>';
    }

    // 队伍配置
    html += '<h3>队伍配置</h3>';
    if ((p.members || []).length) {
      html += '<div class="tbl-wrap"><table><thead><tr><th>姓名</th><th>岗位</th><th>开发角色</th><th>职责</th></tr></thead><tbody>' +
        roster.map(function (m) {
          return '<tr><td><b>' + esc(m.name) + '</b>' + (m.old ? ' <span class="k">老</span>' : '') + '</td>' +
            '<td class="muted">' + esc(m.post || '—') + '</td>' +
            '<td><select class="mini-sel" data-role-for="' + m.i + '">' +
            D.dev.roles.map(function (r) {
              return '<option value="' + r.k + '"' + (r.k === m.role ? ' selected' : '') + '>' + esc(r.n) + '</option>';
            }).join('') + '</select></td>' +
            '<td class="muted small">' + esc(roleOf(m.role).d) + '</td></tr>';
        }).join('') + '</tbody></table></div>' +
        '<p class="small muted">改角色的下拉，下面的排期会立刻重排。角色决定「谁能接哪类任务」，兼岗链是 ' +
        '后端B→后端A→架构、测试/部署/前端→架构。</p>';
    } else {
      html += '<div class="callout blue"><span class="ct">还没填队员</span>' +
        '现在是按 5 人标准建制排的（架构／后端A／后端B／前端／测试）。去「组队」页把名字和岗位填上，' +
        '这里的排期会按真实人马重排。' +
        '<div class="btn-row"><button class="btn" data-tab-go="team">去填队员 →</button></div></div>';
    }

    // 泳道
    var maxW = sc.weeks;
    html += '<h3>谁在第几周做什么</h3><div class="tbl-wrap"><table class="lane-tbl"><thead><tr>' +
      '<th class="lane-h">成员 / 角色</th>';
    for (var i = 1; i <= maxW; i++) html += '<th class="lane-w">W' + i + '</th>';
    html += '</tr></thead><tbody>';
    roster.forEach(function (m) {
      html += '<tr><th class="lane-h"><b>' + esc(m.name) + '</b><span>' + esc(roleOf(m.role).n) + '</span></th>';
      for (var w = 1; w <= maxW; w++) {
        var hit = (sc.lanes[m.i] || []).filter(function (x) { return x.w === w; })[0];
        if (!hit) { html += '<td class="lane-c"></td>'; continue; }
        html += '<td class="lane-c is-on' + (hit.forced ? ' is-forced' : '') + '" title="' +
          esc(hit.t.t + '｜' + hit.t.out) + '"><span class="lane-code">' + esc(hit.t.id) + '</span>' +
          '<span class="lane-name">' + esc(shortName(hit.t.t)) + '</span></td>';
      }
      html += '</tr>';
    });
    html += '</tbody></table></div>' +
      '<p class="small muted">格子里的编号对应下面的台账。同一格里只有一个任务 —— 一个人一周做两件事，' +
      '通常两件都做不好。</p>';

    // 关键路径
    var critSet = {};
    chain.forEach(function (t) { critSet[t.id] = 1; });
    html += '<h3>关键路径</h3><div class="chain">' + chain.map(function (t, i) {
      return (i ? '<span class="chain-arrow">→</span>' : '') +
        '<span class="chain-node"><b>' + esc(t.id) + '</b>' + esc(shortName(t.t)) + '</span>';
    }).join('') + '</div>' +
      '<p class="small muted">这条链上任何一环晚一周，整个项目就晚一周。链上的人不要兼别的活，也不要去支援别人。</p>';

    // 台账（按周次排序，同周按编号）
    var ordered = tasks.slice().sort(function (a, b) {
      var wa = (sc.done[a.id] || {}).w || 99, wb = (sc.done[b.id] || {}).w || 99;
      return wa - wb || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
    });
    html += '<h3>任务台账</h3>' + tableOf(
      ['周', '任务', '模块', '负责人', '交付物', '完成定义', '手册'],
      ordered.map(function (t) {
        var d = sc.done[t.id] || {};
        var onChain = critSet[t.id];
        return ['<span class="mono nowrap">W' + (d.w || '-') + '</span>' +
          (onChain ? ' <span class="tag solid">关键</span>' : ''),
          '<b>' + esc(t.t) + '</b> <span class="faint mono">' + esc(t.id) + '</span>',
          '<span class="muted small">' + esc(t.mod) + '</span>',
          esc(d.m ? d.m.name : '—'),
          '<span class="muted small">' + esc(t.out) + '</span>',
          '<span class="muted small">' + esc(t.dod) + '</span>',
          '<span class="cref">' + esc(t.book) + '</span>'];
      }), 'ledger');

    // 手册骨架 + 流程红线
    html += '<h3>技术手册要对上的 10 节</h3>' +
      '<p class="small muted">任务栏里的「手册」就是引这里的小节。有选题手册就按它写，没有就照这份骨架自己产出 —— ' +
      '这 10 节齐了，技术手册才算写完。</p>' +
      tableOf(['节', '写什么', '判定标准'], D.dev.hb.map(function (r) {
        return ['<span class="mono nowrap">' + esc(r[0]) + '</span>', '<b>' + esc(r[1]) + '</b>', '<span class="muted">' + esc(r[2]) + '</span>'];
      }));

    html += '<h3>开发流程红线</h3><div class="proc-list">' + D.dev.process.map(function (x, i) {
      return '<div class="proc"><span class="proc-i mono">' + pad(i + 1) + '</span>' +
        '<div><div class="proc-t">' + esc(x.t) + '</div><div class="proc-d">' + x.d + '</div></div></div>';
    }).join('') + '</div></div>';

    return html;
  }

  function bindSchedule(p) {
    $$('#ptab-run [data-role-for]').forEach(function (el) {
      el.addEventListener('change', function () {
        p.roles = p.roles || [];
        p.roles[+this.getAttribute('data-role-for')] = this.value;
        save();
        renderTabRun(p);
      });
    });
    $$('#ptab-run [data-tab-go]').forEach(function (b) {
      b.addEventListener('click', function () { setTab(b.getAttribute('data-tab-go')); });
    });
  }

  function renderTabRun(p) {
    var c = C(p), cd = cardOf(p), pl = planOf(p), ep = execPlan(p);
    var html = '';

    if (ep) {
      var stSel = '<select id="planStackSel" class="mini-sel">' +
        Object.keys(D.plan.stacks).map(function (k) {
          return '<option value="' + k + '"' + (k === ep.key ? ' selected' : '') + '>' +
            esc(D.plan.stacks[k].name) + '</option>';
        }).join('') + '</select>';

      html += '<div class="sec"><div class="sec-head"><span class="sec-num">04.1</span>' +
        '<h2 class="sec-title">第一周开工单</h2><span class="sec-note">' + esc(ep.st.name) +
        '　' + esc(ep.st.hours) + '</span></div>' +
        '<div class="plan-bar"><span class="pb-k">技术栈</span>' + stSel +
        '<span class="pb-fit">' + esc(ep.st.fit) + '</span></div>';

      if (ep.guessed) {
        html += '<div class="callout blue"><span class="ct">技术栈是推断的</span>' +
          '这条选题的方向没有直接对应的技术栈，上面按选题关键词推断为「' + esc(ep.st.name) +
          '」。如果不对，直接在上面的下拉里改，改完这一页就跟着变。</div>';
      }
      if (ep.switched) {
        html += '<div class="callout"><span class="ct">已手动切换到「' + esc(ep.st.name) + '」</span>' +
          '下面这套清单和日计划按你选的技术栈给，选题特有的要求（如果有）只在默认栈下显示。</div>';
      }
      if (ep.ov && ep.ov.extra) {
        html += '<div class="callout amber"><span class="ct">这条选题特有的坑</span>' + esc(ep.ov.extra) + '</div>';
      }

      html += '<h3>装这些，别多装</h3>' + planToolTable(ep) +
        '<div class="callout"><span class="ct">为什么只装这些</span>每多装一个组件，就多一个装不上、起不来的机会。第一周的目标不是把工具装全，是让 D5 那条链路能跑通 —— 跑通了再按需加。</div>';

      html += '<h3>D1–D7 每天做什么</h3>' + planDayCards(ep) +
        '<div class="callout rose"><span class="ct">第一周的唯一验收标准</span>' +
        '周日例会上，每个人现场从启动服务开始，做到「看到自己那部分真实数据」。录屏不算，排练过的演示不算。做不到就说明这周没完成，不是「差一点」。</div></div>';

      html += '<div class="sec"><div class="sec-head"><span class="sec-num">04.2</span>' +
        '<h2 class="sec-title">学习路线</h2><span class="sec-note">按需补，不是系统课表</span></div>' +
        '<p class="small muted">下面每一段只列「这几周真正会用到的能力」，每一条都挂到平台课程的具体章节。' +
        '不按 6 个阶段顺序学 —— 比赛按周推进，等把基础课刷完，赛季已经结束了。</p>' +
        planRoute(ep) +
        '<div class="callout"><span class="ct">怎么用这份路线</span>' +
        '每段先看「目标」，再看「学完能做什么」。做不出来就回去补对应章节，做得出来就跳过 —— 不要为了「学完」而学完。标了「可以跳过」的，是真的不用学，不是客套。</div></div>';
    } else {
      html += '<div class="sec"><div class="sec-head"><span class="sec-num">04.1</span>' +
        '<h2 class="sec-title">第一周开工单</h2><span class="sec-note">该方向暂未覆盖</span></div>' +
        '<div class="callout amber"><span class="ct">这份方案还没铺到</span>' +
        '目前开工单覆盖计算机轨的 6 个技术栈（微服务 / AI 应用 / 数据 / 物联网 / 安全 / 数媒）。' +
        '商科方向的调研与创业计划类开工单正在补，先用下面 04.6 的方向族周次排期顶着。</div></div>';
    }

    if (ep) html += renderSchedule(p, ep);

    html += '<div class="sec"><div class="sec-head"><span class="sec-num">04.4</span>' +
      '<h2 class="sec-title">倒排时间轴</h2><span class="sec-note">剩 ' + pl.weeks + ' 周，按阶段权重倒排</span></div>' +
      '<div class="tl">' + pl.stages.map(function (s) {
        var st = stageStat(p, s.id);
        var done = st.total > 0 && st.done === st.total;
        var late = !done && s.end < today();
        return '<div class="tl-item' + (done ? ' is-done' : (late ? ' is-on' : '')) + '">' +
          '<div class="tl-head"><span class="tl-title">' + s.name + '</span>' +
          '<span class="tl-date">' + (done ? '已完成' : '建议 ' + fmt(s.end) + ' 前') + '</span>' +
          '<span class="tag ' + (done ? 'ok' : (late ? 'warn' : '')) + '">' + (done ? '完成' : (late ? '已滞后' : '进行中')) + '</span></div>' +
          '<div class="tl-body">' + stageDesc(s.id) + '　<b class="mono">' + st.done + '/' + st.total + '</b> 项</div></div>';
      }).join('') + '</div></div>';

    html += '<div class="sec"><div class="sec-head"><span class="sec-num">04.5</span>' +
      '<h2 class="sec-title">里程碑门禁</h2><span class="sec-note">过不了不进入下一段</span></div>' +
      tableOf(['门禁', '通过标准', '建议日期', '状态'], pl.gates.map(function (g) {
        return ['<b>' + g.name + '</b>', '<span class="muted">' + g.desc + '</span>',
          '<span class="mono nowrap">' + fmt(g.date) + '</span>',
          '<span class="tag ' + (g.done ? 'ok' : (g.late ? 'warn' : '')) + '">' + (g.done ? '已过' : (g.late ? '已逾期' : '未到')) + '</span>'];
      })) +
      '<div class="callout amber"><span class="ct">门禁怎么用</span>到日子过不了，就不要往下推 —— 带着没冻结的方案继续做，后面每一周都在返工。真过不了就砍范围不砍链路：功能可以少做，主链路必须现场能跑。</div></div>';

    if (cd) {
      html += '<div class="sec"><div class="sec-head"><span class="sec-num">04.6</span>' +
        '<h2 class="sec-title">周次排期</h2><span class="sec-note">' + cd.name + '</span></div>' +
        tableOf(['阶段', '周次', '产出', '关卡'], cd.sched.map(function (r) {
          return ['<b>' + r[0] + '</b>', '<span class="mono nowrap">' + r[1] + '</span>', r[2], '<span class="muted">' + r[3] + '</span>'];
        })) +
        '<h3>赛事赛程</h3>' +
        tableOf(c.schedHead, c.sched.map(function (r) {
          return r.map(function (x, i) { return i === 0 ? '<span class="mono nowrap">' + x + '</span>' : x; });
        })) + '</div>';
    }

    html += checkBlock(p, 'run', '04.7', '推进阶段任务') + tabFooter(p, 'run');
    $('#ptab-run').innerHTML = html;
    bindChecks(p, 'run');
    bindSchedule(p);

    var sel = $('#planStackSel');
    if (sel) sel.addEventListener('change', function () {
      var t = T(p), def = t ? D.plan.of[String(t.序号)] : null;
      p.planStack = sel.value === def ? '' : sel.value;
      save();
      renderTabRun(p);
    });
  }

  /* ---- 结项 · 答辩工作台 ---------------------------------------------------- */
  var DECK_MUST = ['封面', '问题', '目标与创新', '方案总览', '结果', '总结', '致谢 / 附件'];

  function deckOf(p) {
    var dv = D.defense;
    if (!dv) return null;
    var cfg = dv.events[p.event] || {
      speak: '以赛事通知为准', sec: 480, pages: '12–16 页',
      note: '', swap: [], must: []
    };
    var budget = cfg.sec || 480;
    var pages = dv.base.map(function (x) {
      return { p: x.p, t: x.t, say: x.say, chart: x.chart, sec: x.sec };
    });
    (cfg.swap || []).forEach(function (sw) {
      pages.forEach(function (x) { if (x.p === sw[0]) { x.t = sw[1]; } });
    });
    var target = Math.max(10, Math.min(18, Math.round(budget / 40)));
    var keep = [];
    pages.forEach(function (x, i) { if (DECK_MUST.indexOf(x.p) >= 0) keep.push(i); });
    for (var i = 0; i < pages.length && keep.length < target; i++) {
      if (keep.indexOf(i) < 0) keep.push(i);
    }
    keep.sort(function (a, b) { return a - b; });
    var sel = keep.map(function (i) { return pages[i]; });
    var baseSum = sel.reduce(function (s, x) { return s + x.sec; }, 0) || 1;
    sel.forEach(function (x) { x.sec2 = Math.max(10, Math.round(x.sec * budget / baseSum / 5) * 5); });
    var scheme = p.defScheme || 'academic';
    var fit = (D.plan && p.topicIdx != null) ? (function () {
      var t = D.topics[p.topicIdx];
      var sk = p.planStack || (D.plan.of || {})[String(t.序号)];
      return (dv.chartFit || {})[sk] || [];
    })() : [];
    return { cfg: cfg, pages: sel, budget: budget, scheme: scheme, fit: fit };
  }

  function renderDefense(p) {
    var dk = deckOf(p);
    if (!dk) return '';
    var dv = D.defense;
    var sc = dv.schemes.filter(function (x) { return x.id === dk.scheme; })[0] || dv.schemes[0];
    var html = '';

    html += '<div class="sec"><div class="sec-head"><span class="sec-num">05.3</span>' +
      '<h2 class="sec-title">答辩 PPT 大纲</h2><span class="sec-note">' + esc(dk.cfg.speak) + '</span></div>';

    html += '<div class="stat-row">' +
      '<div class="stat"><div class="stat-k">陈述时长</div><div class="stat-v">' + Math.round(dk.budget / 60) + '<small>分钟</small></div></div>' +
      '<div class="stat"><div class="stat-k">建议页数</div><div class="stat-v">' + dk.pages.length + '<small>页</small></div></div>' +
      '<div class="stat"><div class="stat-k">每页均时</div><div class="stat-v">' + Math.round(dk.budget / dk.pages.length) + '<small>秒</small></div></div>' +
      '<div class="stat"><div class="stat-k">配色</div><div class="stat-v" style="font-size:14px">' + esc(sc.name) + '</div></div>' +
      '</div>';

    html += '<div class="callout"><span class="ct">' + esc(dk.cfg.pages) + '　裁判口径</span>' +
      esc(dk.cfg.note || '以赛事通知为准。') +
      (dk.cfg.must && dk.cfg.must.length
        ? '<div style="margin-top:6px">这几页不能省：' + dk.cfg.must.map(function (m) {
            return '<span class="cref">' + esc(m) + '</span>';
          }).join(' ') + '</div>'
        : '') + '</div>';

    // 配色
    html += '<h3>视觉方案</h3><div class="scheme-row">' + dv.schemes.map(function (s) {
      return '<button class="scheme' + (s.id === dk.scheme ? ' is-on' : '') + '" data-scheme="' + s.id + '">' +
        '<span class="scheme-bars">' + s.colors.map(function (c) {
          return '<i style="background:' + c + '"></i>';
        }).join('') + '</span>' +
        '<span class="scheme-n">' + esc(s.name) + '</span>' +
        '<span class="scheme-g">' + esc(s.tag) + '</span></button>';
    }).join('') + '</div>' +
      '<p class="small muted">' + esc(sc.desc) + '　适用：' + esc(sc.fit) +
      '　色值：<span class="mono">' + sc.colors.join(' / ') + '</span></p>';

    // 页序
    html += '<h3>逐页大纲</h3>' + tableOf(['页', '这页讲什么', '配什么图', '建议秒'], dk.pages.map(function (x, i) {
      return ['<b>' + esc(x.p) + '</b><div class="faint mono">P' + pad(i + 1) + '</div>',
        '<span>' + esc(x.t) + '</span><div class="muted small">' + esc(x.say) + '</div>',
        x.chart === '无' ? '<span class="faint">—</span>' : '<span class="cref">' + esc(x.chart) + '</span>',
        '<span class="mono nowrap">' + x.sec2 + '″</span>'];
    })) +
      '<div class="callout amber"><span class="ct">页数是怎么算的</span>' +
      '按陈述 ' + Math.round(dk.budget / 60) + ' 分钟、每页约 40 秒倒推，必留页（封面／问题／创新／方案／结果／总结）先占位，' +
      '其余按顺序填到页数上限。要加页就先砍页 —— 讲不完的内容等于没讲。</div>';

    // 图表
    html += '<h3>该画的图</h3>' +
      '<p class="small muted">带「推荐」的是这个技术栈最该出现的图。图不是装饰，每张图都要能被追问出处。</p>' +
      tableOf(['图', '什么时候必须画', '怎么画', '常见画错'], dv.charts.map(function (c) {
        var rec = dk.fit.indexOf(c.n) >= 0;
        return ['<b>' + esc(c.n) + '</b>' + (rec ? ' <span class="k">推荐</span>' : ''),
          '<span class="muted small">' + esc(c.when) + '</span>',
          '<span class="small">' + esc(c.how) + '</span>',
          '<span class="muted small">' + esc(c.wrong) + '</span>'];
      })) + '</div>';

    // 自述稿 + 追问
    html += '<div class="sec"><div class="sec-head"><span class="sec-num">05.4</span>' +
      '<h2 class="sec-title">自述稿与追问</h2><span class="sec-note">' + esc(dv.speech.total) + '</span></div>' +
      '<h3>逐段句式模板</h3>' +
      tableOf(['环节', '照着填'], dv.speech.formula.map(function (r) {
        return ['<b>' + esc(r[0]) + '</b>', '<span class="small">' + esc(r[1]) + '</span>'];
      })) +
      '<div class="proc-list">' + dv.speech.tips.map(function (t, i) {
        return '<div class="proc"><span class="proc-i mono">' + pad(i + 1) + '</span>' +
          '<div><div class="proc-d">' + esc(t) + '</div></div></div>';
      }).join('') + '</div>';

    var qs = (dv.qa.common || []).concat(dv.qa[p.event] || []);
    html += '<h3>会被问到的问题</h3>' +
      tableOf(['追问', '怎么答'], qs.map(function (r) {
        return ['<b>' + esc(r[0]) + '</b>', '<span class="muted small">' + esc(r[1]) + '</span>'];
      })) +
      '<div class="callout rose"><span class="ct">不要这样答</span>' +
      '「这个我们后续会完善」「这个技术比较先进」「我们参考了很多文献」—— 这三句等于告诉评委你没做。' +
      '答不上就直说「这块我们没做到，原因是 ___」，比绕圈子得分高。</div>';

    html += '<h3>排版与提交红线</h3><div class="proc-list">' + dv.format.map(function (x, i) {
      return '<div class="proc"><span class="proc-i mono">' + pad(i + 1) + '</span>' +
        '<div><div class="proc-t">' + esc(x.t) + '</div><div class="proc-d">' + esc(x.d) + '</div></div></div>';
    }).join('') + '</div></div>';

    return html;
  }

  function bindDefense(p) {
    $$('#ptab-close [data-scheme]').forEach(function (b) {
      b.addEventListener('click', function () {
        p.defScheme = b.getAttribute('data-scheme');
        save();
        renderTabClose(p);
      });
    });
  }

  /* ------------------------------------------------------------ 结项 tab */
  function renderTabClose(p) {
    var c = C(p), cd = cardOf(p);
    var cl = D.closing[p.event] || { hard: [], note: '' };
    var html = '';

    html += '<div class="sec"><div class="sec-head"><span class="sec-num">05.1</span>' +
      '<h2 class="sec-title">结项硬条件</h2><span class="sec-note">缺一条就不算完成</span></div>' +
      '<ul>' + cl.hard.map(function (h) { return '<li>' + h + '</li>'; }).join('') + '</ul>' +
      (cl.note ? '<div class="callout rose"><span class="ct">最容易漏的一条</span>' + cl.note + '</div>' : '') + '</div>';

    if (cd && cd.mats) {
      html += '<div class="sec"><div class="sec-head"><span class="sec-num">05.2</span>' +
        '<h2 class="sec-title">材料清单与红线</h2><span class="sec-note">' + esc(c.short) + '</span></div>' +
        tableOf(['材料', '硬要求', '常见扣分'], cd.mats.map(function (r) {
          return ['<b>' + r[0] + '</b>', r[1], '<span class="muted">' + r[2] + '</span>'];
        })) +
        '<div class="callout"><span class="ct">三条红线（任一触发即出局）</span>' +
        c.redline.chong + '<br>' + c.redline.blind + '<br>' + c.redline.size + '</div></div>';
    }

    html += renderDefense(p) + checkBlock(p, 'close', '05.5', '提交前自查') + tabFooter(p, 'close');
    $('#ptab-close').innerHTML = html;
    bindChecks(p, 'close');
    bindDefense(p);
  }

  /* ------------------------------------------------------------ 公共块 */
  function kvRow(k, v) {
    if (!v) return '';
    return '<dt>' + k + '</dt><dd>' + esc(v) + '</dd>';
  }

  function tableOf(head, rows, cls) {
    if (!rows || !rows.length) return '<p class="muted small">暂无数据</p>';
    return '<div class="tbl-wrap"><table' + (cls ? ' class="' + cls + '"' : '') + '><thead><tr>' + head.map(function (h) { return '<th>' + h + '</th>'; }).join('') +
      '</tr></thead><tbody>' + rows.map(function (r) {
        return '<tr>' + r.map(function (x) { return '<td>' + x + '</td>'; }).join('') + '</tr>';
      }).join('') + '</tbody></table></div>';
  }

  function checkBlock(p, stage, num, title) {
    var items = checksOf(p, stage), box = (p.checks && p.checks[stage]) || {};
    var s = stageStat(p, stage);
    return '<div class="sec"><div class="sec-head"><span class="sec-num">' + num + '</span>' +
      '<h2 class="sec-title">' + title + '</h2><span class="sec-note">勾掉即存</span></div>' +
      '<div data-check="' + stage + '">' + items.map(function (it, i) {
        return '<div class="check-item' + (box[i] ? ' is-done' : '') + '" data-stage="' + stage + '" data-i="' + i + '">' +
          '<span class="ci-box"><svg width="9" height="9" viewBox="0 0 10 10" fill="none">' +
          '<path d="M1.5 5.2 3.9 7.6 8.5 2.6" stroke="#fff" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg></span>' +
          '<span class="ci-body"><span class="ci-text">' + it[0] + '</span>' +
          (it[1] ? '<span class="ci-hint">' + it[1] + '</span>' : '') + '</span></div>';
      }).join('') + '</div>' +
      '<div class="progress-row"><div class="bar"><i data-bar="' + stage + '" style="width:' + (s.pct * 100) + '%"></i></div>' +
      '<span class="progress-num">' + s.done + ' / ' + s.total + '</span></div></div>';
  }

  function tabFooter(p, stage) {
    var idx = ['topic', 'team', 'run', 'close'].indexOf(stage);
    var next = ['team', 'run', 'close', ''][idx];
    var prev = ['', 'topic', 'team', 'run'][idx];
    var name = { team: '组队', run: '推进', close: '结项' }[next];
    return '<div class="btn-row" style="margin:-4px 0 14px">' +
      (prev ? '<button class="btn ghost" data-tab-go="' + prev + '">← 返回' + ({ topic: '选题', team: '组队', run: '推进' })[prev] + '</button>' : '') +
      (next ? '<button class="btn" data-tab-go="' + next + '">进入' + name + ' →</button>'
        : '<button class="btn ghost" id="btnPrintTab">导出执行单</button>') + '</div>';
  }

  function bindChecks(p, stage) {
    var host = $('#ptab-' + stage);
    $$('.check-item[data-stage]', host).forEach(function (el) {
      el.addEventListener('click', function () {
        var st = el.getAttribute('data-stage'), i = +el.getAttribute('data-i');
        if (!p.checks[st]) p.checks[st] = {};
        if (p.checks[st][i]) delete p.checks[st][i]; else p.checks[st][i] = true;
        save();
        // 局部刷新：勾选态 + 进度条 + 导航
        el.classList.toggle('is-done');
        var s = stageStat(p, st);
        var bar = $('[data-bar="' + st + '"]', host);
        if (bar) bar.style.width = (s.pct * 100) + '%';
        var num = $('.progress-row .progress-num', host);
        if (num) num.textContent = s.done + ' / ' + s.total;
        var stepBtn = $('.step[data-tab="' + st + '"]');
        if (stepBtn) {
          stepBtn.classList.toggle('is-done', s.total > 0 && s.done === s.total);
          $('.step-sub', stepBtn).textContent = s.done + '/' + s.total;
        }
        renderNav();
      });
    });
    $$('#ptab-' + stage + ' [data-tab-go]').forEach(function (b) {
      if (b.dataset.bound) return;
      b.dataset.bound = '1';
      b.addEventListener('click', function () { setTab(b.getAttribute('data-tab-go')); });
    });
    var pb = $('#btnPrintTab');
    if (pb) pb.addEventListener('click', function () { window.print(); });
  }

  function bindMatches(p) {
    $$('#ptab-topic .match').forEach(function (el) {
      el.addEventListener('click', function () {
        p.topicIdx = +el.getAttribute('data-idx');
        save();
        renderProject(); renderNav(); renderCrumb();
      });
    });
  }

  /* ============================================================ 资源库 */
  function renderLibrary() {
    $$('#libSeg button').forEach(function (b) {
      b.classList.toggle('is-on', b.getAttribute('data-lib') === S.lib);
    });
    if (S.lib === 'events') renderLibEvents();
    if (S.lib === 'families') renderLibFamilies();
    if (S.lib === 'topics') renderLibTopics();
  }

  function renderLibEvents() {
    var html = '<div class="grid-2"><div><div class="lib-list">';
    html += D.order.map(function (k, i) {
      var c = D.comps[k];
      return '<button class="lib-item' + (S.libEv === k ? ' is-on' : '') + '" data-ev="' + k + '">' +
        '<span class="lib-idx">' + pad(i + 1) + '</span>' +
        '<span class="lib-main"><span class="lib-t">' + esc(c.short) + '</span>' +
        '<span class="lib-d">' + esc(c.one) + '</span></span>' +
        '<span class="lib-side">' + esc(c.size) + '</span></button>';
    }).join('') + '</div></div><div id="libEvDetail"></div></div>';
    $('#libBody').innerHTML = html;
    $$('#libBody [data-ev]').forEach(function (b) {
      b.addEventListener('click', function () {
        S.libEv = b.getAttribute('data-ev'); save(); renderLibEvents();
      });
    });

    var c = D.comps[S.libEv];
    $('#libEvDetail').innerHTML =
      '<div class="sec"><div class="sec-head"><span class="sec-num">口径</span>' +
      '<h2 class="sec-title">' + esc(c.title) + '</h2></div>' +
      '<p class="small muted">' + c.intro + '</p>' +
      '<div class="callout blue"><span class="ct">怎么进</span>' + esc(c.entry) + '</div>' +
      '<h3>硬约束</h3>' + tableOf(['项', '要求'], c.req.map(function (r) { return ['<b>' + r[0] + '</b>', r[1]]; })) +
      '<h3>岗位与产出</h3>' + tableOf(['岗位', '职责', '产出', '不做什么'], c.roles.map(function (r) {
        return ['<b>' + r[0] + '</b>', r[1], r[2], '<span class="muted">' + r[3] + '</span>'];
      })) +
      '<h3>赛程节奏</h3>' + tableOf(c.schedHead, c.sched.map(function (r) {
        return r.map(function (x, i) { return i === 0 ? '<span class="mono nowrap">' + x + '</span>' : x; });
      })) +
      (c.note ? '<div class="callout rose"><span class="ct">最容易踩的坑</span>' + c.note + '</div>' : '') +
      '<div class="btn-row"><button class="btn" data-useproj="' + S.libEv + '">用这个赛事建项目 →</button></div></div>';
    $$('#libEvDetail [data-useproj]').forEach(function (b) {
      b.addEventListener('click', function () {
        S.newEv = b.getAttribute('data-useproj');
        go('home');
        $('#queryInput').focus();
      });
    });
  }

  function renderLibFamilies() {
    var keys = Object.keys(D.cards);
    if (!S.libFam || keys.indexOf(S.libFam) < 0) S.libFam = keys[0];
    var html = '<div class="grid-2"><div><div class="lib-list">';
    html += keys.map(function (k, i) {
      var cd = D.cards[k];
      return '<button class="lib-item' + (S.libFam === k ? ' is-on' : '') + '" data-fam="' + k + '">' +
        '<span class="lib-idx">' + pad(i + 1) + '</span>' +
        '<span class="lib-main"><span class="lib-t">' + esc(cd.name) + '</span>' +
        '<span class="lib-d">' + cd.steps.length + ' 步 · ' + cd.mats.length + ' 项材料 · ' + cd.qa.length + ' 条高频问答</span></span></button>';
    }).join('') + '</div></div><div id="libFamDetail"></div></div>';
    $('#libBody').innerHTML = html;
    $$('#libBody [data-fam]').forEach(function (b) {
      b.addEventListener('click', function () {
        S.libFam = b.getAttribute('data-fam'); save(); renderLibFamilies();
      });
    });

    var cd = D.cards[S.libFam];
    $('#libFamDetail').innerHTML =
      '<div class="sec"><div class="sec-head"><span class="sec-num">打法</span>' +
      '<h2 class="sec-title">' + esc(cd.name) + '</h2></div>' +
      '<p class="small muted">' + cd.head + '</p>' +
      '<h3>落地步骤</h3><div class="tl">' + cd.steps.map(function (s) {
        return '<div class="tl-item"><div class="tl-head"><span class="tl-title">' + s[0] + '</span></div>' +
          '<div class="tl-body"><ul>' + s[1].map(function (li) { return '<li>' + li + '</li>'; }).join('') + '</ul></div></div>';
      }).join('') + '</div>' +
      '<h3>材料清单</h3>' + tableOf(['材料', '要求', '常见问题'], cd.mats.map(function (r) {
        return ['<b>' + r[0] + '</b>', r[1], '<span class="muted">' + r[2] + '</span>'];
      })) +
      '<h3>周次排期</h3>' + tableOf(['阶段', '周次', '产出', '关卡'], cd.sched.map(function (r) {
        return ['<b>' + r[0] + '</b>', '<span class="mono nowrap">' + r[1] + '</span>', r[2], '<span class="muted">' + r[3] + '</span>'];
      })) +
      '<h3>高频问答</h3>' + cd.qa.map(function (q, i) {
        return '<div style="padding:8px 0;border-bottom:1px solid var(--line)">' +
          '<div class="small" style="font-weight:600">Q' + pad(i + 1) + '　' + q[0] + '</div>' +
          '<div class="small muted" style="margin-top:2px">' + q[1] + '</div></div>';
      }).join('') + (cd.tip ? '<div class="callout">' + cd.tip + '</div>' : '') + '</div>';
  }

  var TPAGE = 15;
  function renderLibTopics() {
    var pool = D.topics.filter(function (t) {
      if (S.tEvent !== '全部' && t.赛事 !== S.tEvent) return false;
      if (!S.tQuery) return true;
      var tk = tokens(S.tQuery);
      var b = bodyOf(t);
      return tk.some(function (x) { return b.indexOf(x) >= 0; });
    });
    var pages = Math.max(1, Math.ceil(pool.length / TPAGE));
    if (S.tPage >= pages) S.tPage = 0;
    var slice = pool.slice(S.tPage * TPAGE, S.tPage * TPAGE + TPAGE);

    var html = '<div id="libTopicDetail"></div>' +
      '<div class="sec"><div class="sec-head"><span class="sec-num">选题池</span>' +
      '<h2 class="sec-title">共 ' + D.topics.length + ' 条，当前筛选 ' + pool.length + ' 条</h2>' +
      '<span class="sec-note">点开看七要素</span></div>' +
      '<div class="query-row" style="margin-bottom:10px">' +
      '<input class="input sm" id="tq" placeholder="搜选题关键词：养老、审计、非遗、物联网…" value="' + esc(S.tQuery) + '">' +
      '<select class="input sm" id="tev" style="max-width:180px">' +
      ['全部', '大创', '国创赛', '挑战杯', '挑战杯（小挑）', '4C', '正大杯'].map(function (x) {
        return '<option' + (S.tEvent === x ? ' selected' : '') + '>' + x + '</option>';
      }).join('') + '</select></div>' +
      '<div class="lib-list">' + slice.map(function (t, i) {
        var idx = D.topics.indexOf(t);
        return '<button class="lib-item" data-topic="' + idx + '">' +
          '<span class="lib-idx">' + pad(S.tPage * TPAGE + i + 1) + '</span>' +
          '<span class="lib-main"><span class="lib-t">' + esc(t.选题名称) + '</span>' +
          '<span class="lib-d">' + esc(t.赛事 + ' · ' + t.专业类别 + ' · ' + t.方向) + '</span></span>' +
          '<span class="lib-side">' + esc((t.适配院校 || []).length) + ' 校</span></button>';
      }).join('') + '</div>' +
      '<div class="pager"><button id="prevPage"' + (S.tPage === 0 ? ' disabled' : '') + '>上一页</button>' +
      '<span>' + (S.tPage + 1) + ' / ' + pages + '</span>' +
      '<button id="nextPage"' + (S.tPage >= pages - 1 ? ' disabled' : '') + '>下一页</button></div>' +
      '</div>';

    $('#libBody').innerHTML = html;

    $('#tq').addEventListener('input', function () {
      S.tQuery = this.value; S.tPage = 0; save(); renderLibTopics();
      var el = $('#tq'); if (el) { el.focus(); el.setSelectionRange(el.value.length, el.value.length); }
    });
    $('#tev').addEventListener('change', function () {
      S.tEvent = this.value; S.tPage = 0; save(); renderLibTopics();
    });
    var pp = $('#prevPage'), np = $('#nextPage');
    if (pp) pp.addEventListener('click', function () { S.tPage--; save(); renderLibTopics(); });
    if (np) np.addEventListener('click', function () { S.tPage++; save(); renderLibTopics(); });

    $$('#libBody [data-topic]').forEach(function (b) {
      b.addEventListener('click', function () { showTopic(+b.getAttribute('data-topic')); });
    });
  }

  function showTopic(idx) {
    var t = D.topics[idx];
    var host = $('#libTopicDetail');
    if (host) { try { host.scrollIntoView({ block: 'start' }); } catch (e) {} }
    $('#libTopicDetail').innerHTML =
      '<div class="sec"><div class="sec-head"><span class="sec-num">' + esc(t.赛事) + '</span>' +
      '<h2 class="sec-title">' + esc(t.选题名称) + '</h2><span class="sec-note">' + esc(t.方向) + '</span></div>' +
      '<div style="margin-bottom:8px">' + (t.适配院校 || []).map(function (s) { return '<span class="tag">' + esc(s) + '</span>'; }).join('') + '</div>' +
      '<dl class="kv">' + kvRow('选题背景', t.选题背景要点) + kvRow('可行性', t.可行性要点) +
      kvRow('技术选型', t.技术选型与落地) + kvRow('验收物', t.验收物) +
      kvRow('课程对位', t.课程对位) + kvRow('院校落点', t.院校落点) + '</dl>' +
      '<div class="btn-row"><button class="btn" data-adopt="' + idx + '">用这条立项 →</button></div></div>';
    $$('#libTopicDetail [data-adopt]').forEach(function (b) {
      b.addEventListener('click', function () {
        var i = +b.getAttribute('data-adopt');
        var tp = D.topics[i];
        var evKey = { '大创': 'DCH', '国创赛': 'GCS', '挑战杯': 'DT', '挑战杯（小挑）': 'XT', '4C': 'C4', '正大杯': 'ZDB' }[tp.赛事];
        newProject(evKey, tp.选题名称, '', tp.专业类别, '', i);
        S.view = 'project'; S.tab = 'overview';
        save(); renderAll();
        try { window.scrollTo(0, 0); } catch (e) {}
      });
    });
  }

  /* ============================================================ 评审与答疑 */
  function renderMentor() {
    var p = P();
    var c = p ? C(p) : D.comps.ZDB;
    var cd = p ? cardOf(p) : D.cards.survey;
    $('#mentorSrc').textContent = c.short;

    $('#mentorRows').innerHTML = [
      ['选题评审', '第 2 周', '指导教师 + 1 名没听过项目的老师', '选题能不能立住、数据拿不拿得到', '当天改题，不要拖到第 6 周'],
      ['中期评审', '进度 45%–55%', '指导教师 + 组外同学', '主链路有没有跑通、结论站不站得住', '砍功能不砍链路，两周内补齐'],
      ['模拟答辩', '提交前 1 周', '3 人以上，其中至少 1 人完全不了解项目', '8 分钟能不能讲完、20 条 Q&A 答不答得上', '只改讲法不改结论，练到不超时']
    ].map(function (r) {
      return '<tr><td><b>' + r[0] + '</b></td><td class="mono nowrap">' + r[1] + '</td><td>' + r[2] +
        '</td><td class="muted">' + r[3] + '</td><td class="muted">' + r[4] + '</td></tr>';
    }).join('');

    $('#qaSrc').textContent = cd ? cd.name : '';
    var qas = (cd && cd.qa) || [];
    $('#qaList').innerHTML = qas.map(function (q, i) {
      return '<div class="qa"><div class="qa-q"><span class="q">Q' + pad(i + 1) + '</span><span>' + q[0] + '</span></div>' +
        '<div class="qa-a">' + q[1] + '</div></div>';
    }).join('') + '<p class="faint small" style="margin-top:10px">这 ' + qas.length +
      ' 条是这一类的通用高频题。正式答辩前补到 20–30 条，每条写成 10 秒能说完的结构化答案：结论 → 依据 → 数据。</p>';

    $$('#qaList .qa-q').forEach(function (el) {
      el.addEventListener('click', function () { el.parentNode.classList.toggle('is-open'); });
    });
  }

  /* ============================================================ 陪跑：今天做什么 */
  function ck() { return D.coach; }

  function boxOf(p) {
    if (!p.coach) p.coach = {};
    if (!p.coach.done) p.coach.done = {};
    if (!p.coach.assign) p.coach.assign = {};
    if (!p.coach.log) p.coach.log = [];
    return p.coach;
  }
  function actById(id) {
    return ck().acts.filter(function (a) { return a.id === id; })[0] || null;
  }
  function actCur(p) {
    var b = boxOf(p);
    var left = ck().acts.filter(function (a) { return !b.done[a.id]; });
    return left[0] || null;
  }
  function actNext(p, n) {
    var b = boxOf(p);
    return ck().acts.filter(function (a) { return !b.done[a.id]; }).slice(1, 1 + n);
  }
  function actDoneCount(p) {
    var b = boxOf(p);
    return ck().acts.filter(function (a) { return b.done[a.id]; }).length;
  }
  function actPh(id) {
    return ck().phases.filter(function (x) { return x.id === id; })[0] || { name: '', days: '' };
  }
  function mName(p, i) {
    var m = (p.members || [])[i];
    if (!m) return '';
    return String(m.name || '').trim() || ('成员 ' + (i + 1));
  }
  // 按动作的建议角色，猜一个默认责任人
  function sugAssign(p, a) {
    if (!p.members || !p.members.length) return 'self';
    if (a.who === 'lead' || a.who === 'all') return 'self';
    var want = ({ tech: ['技术'], data: ['数据', '调研'], doc: ['文档'] })[a.who] || [];
    for (var i = 0; i < p.members.length; i++) {
      if (want.indexOf(p.members[i].post) >= 0) return String(i);
    }
    return 'self';
  }
  function whoOf(p, a) {
    var b = boxOf(p);
    return b.assign[a.id] || sugAssign(p, a);
  }
  function assignName(p, v) {
    return v === 'self' ? '我自己' : (mName(p, +v) || '我自己');
  }

  // 从动作卡跳到对应页面
  function goLink(link) {
    if (!link) return;
    var a = link.split('/');
    if (a[0] === 'library') {
      S.view = 'library';
      if (['events', 'families', 'topics'].indexOf(a[1]) >= 0) S.lib = a[1];
    } else if (a[0] === 'project') {
      S.view = 'project';
      if (['overview', 'topic', 'team', 'run', 'close'].indexOf(a[1]) >= 0) S.tab = a[1];
    } else if (a[0] === 'paper') {
      S.view = 'paper';
      var ids = D.paper.papers.map(function (x) { return x.id; });
      if (ids.indexOf(a[1]) >= 0) S.paperType = a[1];
    }
    save(); writeHash(); renderAll();
    try { window.scrollTo(0, 0); } catch (e) {}
  }

  function coachNoProj() {
    var html = '<div class="sec"><div class="sec-head"><span class="sec-num">第 1 步</span>' +
      '<h2 class="sec-title">先选一个你要参加的比赛</h2><span class="sec-note">选完就有 33 步流程</span></div>' +
      '<p class="small muted">不用先想选题，也不用填一堆表。点一个比赛，系统会直接把你带到第一步：' +
      '<b>找到今年的比赛通知</b>。选题、学校、截止日后面都能改。</p>' +
      '<div class="ev-start">' + D.order.map(function (k) {
        var c = D.comps[k];
        return '<button class="ev-start-card" data-ev-start="' + k + '">' +
          '<b>' + esc(c.short.split('（')[0]) + '</b>' +
          '<span>' + esc(c.size) + '</span>' +
          '<span class="faint">' + esc(c.cycle) + '</span></button>';
      }).join('') + '</div>' +
      '<div class="callout"><span class="ct">还不确定报哪个？</span>' +
      '先去<a href="#library/events" data-go-lib="events">资源库看六个赛事各自要交什么</a>，' +
      '重点看「最终交付物」那一行：交报告和交作品，做起来完全不一样。</div></div>';

    if (window.Api && Api.online) {
      if (Api.user) {
        html += '<div class="sec"><div class="sec-head"><span class="sec-num">或者</span>' +
          '<h2 class="sec-title">输入邀请码，加入队友的项目</h2></div>' +
          '<div class="join-row"><input class="input" id="joinCode" maxlength="6" ' +
          'placeholder="6 位邀请码，例如 K7M2QP" autocomplete="off">' +
          '<button class="btn" id="btnJoin">加入</button></div>' +
          '<p class="faint small" style="margin-top:8px">邀请码由队长在项目的「协同」区生成。' +
          '加入后你看到的是同一份进度，队长派给你的步骤会直接出现在这页。</p></div>';
      } else {
        html += '<div class="sec"><div class="sec-head"><span class="sec-num">或者</span>' +
          '<h2 class="sec-title">登录后加入队友的项目</h2></div>' +
          '<p class="small muted">队长建了项目，把邀请码发给你。登录并输入邀请码后，' +
          '你就能看到同一份进度，并接手派给你的步骤。</p>' +
          '<button class="btn sm" data-open-auth="1">登录 / 注册</button></div>';
      }
    }
    return html;
  }

  function renderCoach() {
    var p = P();
    var el = $('#coachBody');

    if (!p) {
      el.innerHTML = coachNoProj();
      $$('#coachBody [data-ev-start]').forEach(function (b) {
        b.addEventListener('click', function () {
          var ev = b.getAttribute('data-ev-start');
          newProject(ev, '', '', '', iso(addDays(today(), D.comps[ev].weeks * 7)));
          S.view = 'coach';
          save(); renderAll();
          try { window.scrollTo(0, 0); } catch (e) {}
        });
      });
      $$('#coachBody [data-go-lib]').forEach(function (a) {
        a.addEventListener('click', function (e) {
          e.preventDefault();
          goLink('library/' + a.getAttribute('data-go-lib'));
        });
      });
      $$('#coachBody [data-open-auth]').forEach(function (b) {
        b.addEventListener('click', function () { Api.openAuth('login'); });
      });
      var jb = $('#btnJoin');
      if (jb) {
        var doJoin = function () {
          var code = ($('#joinCode').value || '').trim().toUpperCase();
          if (code.length !== 6) { alert('邀请码是 6 位，检查一下'); return; }
          jb.disabled = true; jb.textContent = '加入中…';
          Api.join(code).then(function (d) {
            S.projects = [toLocal(d.project)];
            S.active = d.project.id;
            S.view = 'coach';
            saveQuiet(); renderAll(); loadActive();
          }).catch(function (e) {
            alert(e.message || '加入失败');
            jb.disabled = false; jb.textContent = '加入';
          });
        };
        jb.addEventListener('click', doJoin);
        $('#joinCode').addEventListener('keydown', function (e) { if (e.key === 'Enter') doJoin(); });
      }
      return;
    }

    var b = boxOf(p);
    var cur = actCur(p);
    var done = actDoneCount(p);
    var total = ck().total;
    var html = '';

    // 顶部：走到哪了
    html += '<div class="coach-strip">' +
      '<div class="cs-step mono">' + (cur ? '第 ' + (done + 1) + ' / ' + total + ' 步' : '全部完成') + '</div>' +
      '<div class="cs-bar"><i style="width:' + Math.round(done / total * 100) + '%"></i></div>' +
      '<div class="cs-num mono">' + done + '/' + total + '</div>' +
      '</div>' +
      '<div class="cs-sub">' + esc(T(p) ? T(p).选题名称 : (p.query || '还没定题')) +
      ' · ' + esc(C(p).short.split('（')[0]) +
      (p.deadline ? ' · 截止 ' + esc(p.deadline) : '') + '</div>';

    if (cur) {
      var ph = actPh(cur.ph);
      var asg = whoOf(p, cur);
      html += '<div class="sec act-live">' +
        '<div class="act-top"><span class="act-ph">' + esc(ph.name) + '</span>' +
        '<span class="act-time">' + esc(ph.days) + '</span></div>' +
        '<h2 class="act-title">' + esc(cur.t) + '</h2>' +
        '<div class="act-meta"><span class="mono">' + cur.id + '</span>' +
        '<span>约 ' + cur.min + ' 分钟</span><span>建议：' + esc(ck().who[cur.who].name) + '</span>' +
        '<span>指派给 <b>' + esc(assignName(p, asg)) + '</b></span></div>' +
        '<div class="act-why">' + cur.why + '</div>' +
        '<div class="act-h">怎么做</div>' +
        '<ol class="act-how">' + cur.how.map(function (s) { return '<li>' + s + '</li>'; }).join('') + '</ol>' +
        '<div class="act-done-box"><span class="adb-k">做完的样子</span><span class="adb-t">' + cur.done + '</span></div>' +
        (cur.help.length ? '<details class="act-help"><summary>卡住了怎么办（' + cur.help.length + ' 种常见情况）</summary>' +
          cur.help.map(function (h) {
            return '<div class="help-row"><b>' + h[0] + '</b><span>' + h[1] + '</span></div>';
          }).join('') + '</details>' : '') +
        '<div class="act-bar">' +
        '<button class="btn" data-act-done="' + cur.id + '">我做完了，下一步</button>' +
        (cur.link ? '<button class="btn ghost sm" data-act-go="' + cur.link + '">去对应页面 →</button>' : '') +
        '<label class="act-assign">派给 <select class="input sm" data-act-assign="' + cur.id + '">' +
        '<option value="self"' + (asg === 'self' ? ' selected' : '') + '>我自己</option>' +
        (p.members || []).map(function (m, i) {
          return '<option value="' + i + '"' + (asg === String(i) ? ' selected' : '') + '>' + esc(mName(p, i)) + '</option>';
        }).join('') + '</select></label>' +
        '</div></div>';
    } else {
      html += '<div class="sec act-live"><div class="act-top"><span class="act-ph">收尾</span></div>' +
        '<h2 class="act-title">33 步全部走完了</h2>' +
        '<div class="act-why">材料交完、回执留好，这个项目就算结束了。' +
        '接下来两件事：把这次的过程整理成一页复盘（哪一步最卡、下次怎么省时间），' +
        '以及把能复用的东西（模板、代码、问卷）存到一个「下次直接拿」的文件夹里。</div>' +
        '<div class="act-bar"><button class="btn ghost sm" data-act-reset="1">重新走一遍（清空勾选）</button></div></div>';
    }

    // 接下来 3 步（锁定态）
    var nx = actNext(p, 3);
    if (nx.length) {
      html += '<div class="sec"><div class="sec-head"><span class="sec-num">接下来</span>' +
        '<h2 class="sec-title">做完当前这步再往下</h2></div><div class="next-act">' +
        nx.map(function (a) {
          return '<div class="na-row"><span class="na-lock">待解锁</span>' +
            '<span class="na-t">' + esc(a.t) + '</span>' +
            '<span class="na-m mono">约 ' + a.min + ' 分钟</span></div>';
        }).join('') + '</div>' +
        '<p class="faint small" style="margin-top:8px">不用提前看后面的内容，一次只做一件事。</p></div>';
    }

    // 已完成（可回退）
    var log = b.log || [];
    if (log.length) {
      html += '<div class="sec"><div class="sec-head"><span class="sec-num">已完成</span>' +
        '<h2 class="sec-title">最近做完的 ' + Math.min(5, log.length) + ' 步</h2></div>' +
        '<div class="done-list">' + log.slice(-5).reverse().map(function (id) {
          var a = actById(id);
          if (!a) return '';
          return '<div class="dl-row"><span class="dl-ck">✓</span><span class="dl-t">' + esc(a.t) + '</span>' +
            '<button class="dl-undo" data-act-undo="' + id + '">撤销</button></div>';
        }).join('') + '</div></div>';
    }

    // 团队协同
    html += renderCoachCollab(p);
    html += renderCoachTeam(p);

    // 术语
    html += '<div class="sec"><div class="sec-head"><span class="sec-num">人话</span>' +
      '<h2 class="sec-title">看不懂的词，先查这里</h2></div>' +
      '<div class="word-grid">' + ck().words.map(function (w) {
        return '<div class="word"><b>' + esc(w[0]) + '</b><span>' + esc(w[1]) + '</span></div>';
      }).join('') + '</div></div>';

    el.innerHTML = html;

    // 事件
    $$('#coachBody [data-act-done]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var id = btn.getAttribute('data-act-done');
        b.done[id] = true;
        b.log = (b.log || []).filter(function (x) { return x !== id; });
        b.log.push(id);
        save();
        if (window.Api && Api.online && Api.user) {
          Api.act(p.id, id, { done: true }).catch(function (e) { console.warn('[api] 同步失败：' + e.message); });
        }
        renderAll();
        try { window.scrollTo(0, 0); } catch (e) {}
      });
    });
    $$('#coachBody [data-act-undo]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var id = btn.getAttribute('data-act-undo');
        delete b.done[id];
        b.log = (b.log || []).filter(function (x) { return x !== id; });
        save();
        if (window.Api && Api.online && Api.user) {
          Api.act(p.id, id, { done: false }).catch(function () {});
        }
        renderAll();
      });
    });
    $$('#coachBody [data-act-assign]').forEach(function (sel) {
      sel.addEventListener('change', function () {
        var aid = sel.getAttribute('data-act-assign');
        b.assign[aid] = sel.value;
        save();
        if (window.Api && Api.online && Api.user) {
          Api.act(p.id, aid, { assignee: sel.value }).catch(function () {});
        }
        renderCoach(); renderNav();
      });
    });
    $$('#coachBody [data-act-go]').forEach(function (btn) {
      btn.addEventListener('click', function () { goLink(btn.getAttribute('data-act-go')); });
    });
    var rs = $('#coachBody [data-act-reset]');
    if (rs) rs.addEventListener('click', function () {
      if (!confirm('清空这个项目的全部步骤勾选？')) return;
      p.coach = { done: {}, assign: {}, log: [] };
      save(); renderAll();
    });

    $$('#coachBody [data-open-auth]').forEach(function (b) {
      b.addEventListener('click', function () { Api.openAuth('login'); });
    });
    var inv = $('#coachBody [data-invite]');
    if (inv) inv.addEventListener('click', function () {
      inv.disabled = true;
      Api.invite(p.id).then(function (d) {
        p.inviteCode = d.code; saveQuiet(); renderCoach();
      }).catch(function (e) {
        alert(e.message || '生成失败'); inv.disabled = false;
      });
    });
    $$('#coachBody [data-copy]').forEach(function (b) {
      b.addEventListener('click', function () {
        var code = b.getAttribute('data-copy');
        var done = function () { b.textContent = '已复制'; setTimeout(function () { b.textContent = '复制'; }, 1500); };
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(code).then(done).catch(done);
        } else { done(); }
      });
    });
  }

  function relTime(ms) {
    var d = Date.now() - ms;
    if (d < 60000) return '刚刚';
    if (d < 3600000) return Math.floor(d / 60000) + ' 分钟前';
    if (d < 86400000) return Math.floor(d / 3600000) + ' 小时前';
    return Math.floor(d / 86400000) + ' 天前';
  }

  function feedText(p, f) {
    var t = f.text ? String(f.text).split('|')[0] : '';
    var a = t ? actById(t) : null;
    var title = a ? a.t : t;
    if (f.kind === 'project_create') return f.user + ' 建了这个项目';
    if (f.kind === 'join') return f.user + ' 加入了项目';
    if (f.kind === 'act_done') return f.user + ' 完成了「' + title + '」';
    if (f.kind === 'act_undo') return f.user + ' 撤销了「' + title + '」';
    if (f.kind === 'act_assign') {
      var who = String(f.text).split('|')[1];
      var nm = who === 'self' ? '自己' : (mName(p, +who) || '成员');
      return f.user + ' 把「' + title + '」派给了 ' + nm;
    }
    if (f.kind === 'member_change') return f.user + ' 更新了成员名单（' + f.text + ' 人）';
    return f.user + ' 做了更新';
  }

  function renderCoachCollab(p) {
    var on = window.Api && Api.online;
    var body = '';

    if (!on) {
      body = '<div class="callout amber"><span class="ct">现在是离线模式</span>' +
        '数据只存在这台电脑，队员看不到你的进度。要多人协同，在项目目录运行 ' +
        '<span class="mono">node server/index.js</span>，再用 <span class="mono">http://localhost:8787</span> 打开：' +
        '登录后建的项目，队友用邀请码就能加入，谁做完哪一步所有人刷新就能看到。</div>';
    } else if (!Api.user) {
      body = '<p class="small muted">登录之后就能邀请队员。队友用邀请码加入，你做完一步、他刷新就能看到，不用来回问。</p>' +
        '<button class="btn sm" data-open-auth="1">登录 / 注册</button>';
    } else {
      if (p.role === 'owner') {
        body += '<div class="invite-box"><div class="ib-k">项目邀请码</div>' +
          '<div class="ib-code mono">' + esc(p.inviteCode || '------') + '</div>' +
          '<div class="ib-hint">把这一串发给队友。他们登录后输入就能加入，看到的是同一份进度。</div>' +
          '<div class="ib-bar"><button class="btn ghost sm" data-invite="' + esc(p.id) + '">' +
          (p.inviteCode ? '换一个' : '生成邀请码') + '</button>' +
          (p.inviteCode ? '<button class="btn sm" data-copy="' + esc(p.inviteCode) + '">复制</button>' : '') +
          '</div></div>';
      } else {
        body += '<p class="small muted">你是这个项目的队员。队长派给你的步骤会出现在上面那张卡里，做完点「我做完了」，队长那边刷新就能看到。</p>';
      }
      var fs = S.feed || [];
      body += '<h3>最近动态</h3>' + (fs.length
        ? '<div class="feed">' + fs.slice(0, 12).map(function (f) {
            return '<div class="feed-row"><span class="fr-dot"></span>' +
              '<span class="fr-t">' + esc(feedText(p, f)) + '</span>' +
              '<span class="fr-time faint">' + relTime(f.at) + '</span></div>';
          }).join('') + '</div>'
        : '<p class="faint small">还没有动态。做完第一步就会出现在这里。</p>');
    }

    return '<div class="sec"><div class="sec-head"><span class="sec-num">协同</span>' +
      '<h2 class="sec-title">队员怎么跟上</h2><span class="sec-note">' +
      (on ? (Api.user ? '已连接 · ' + esc(Api.user.name) : '未登录') : '离线') +
      '</span></div>' + body + '</div>';
  }

  function renderCoachTeam(p) {
    var b = boxOf(p);
    var mem = p.members || [];
    var lanes = [{ key: 'self', name: '我自己', post: '队长' }];
    mem.forEach(function (m, i) {
      lanes.push({ key: String(i), name: mName(p, i), post: m.post || '' });
    });

    var html = '<div class="sec"><div class="sec-head"><span class="sec-num">团队</span>' +
      '<h2 class="sec-title">谁手上有什么</h2><span class="sec-note">派完就能各做各的</span></div>';

    if (!mem.length) {
      html += '<div class="callout amber"><span class="ct">还没有队员</span>' +
        '现在只有你一个人。第 10–13 步是组队，但你可以提前把队友名字加进来——' +
        '加了之后每一步就能派给他，他自己打开看到的就是自己的待办。</div>' +
        '<button class="btn ghost sm" data-act-go="project/team">现在去加队员 →</button>';
    }

    var unassigned = ck().acts.filter(function (a) {
      return !b.done[a.id] && a.who !== 'lead' && a.who !== 'all';
    }).length;

    html += '<div class="board">' + lanes.map(function (L) {
      var mine = ck().acts.filter(function (a) {
        return !b.done[a.id] && whoOf(p, a) === L.key;
      });
      var dn = ck().acts.filter(function (a) {
        return b.done[a.id] && whoOf(p, a) === L.key;
      }).length;
      var next = mine[0];
      return '<div class="lane">' +
        '<div class="lane-top"><b>' + esc(L.name) + '</b>' +
        '<span class="lane-post">' + esc(L.post) + '</span></div>' +
        '<div class="lane-num"><span class="mono">' + mine.length + '</span> 件在手' +
        '<span class="faint"> · 已完成 ' + dn + '</span></div>' +
        (next
          ? '<div class="lane-act">' + esc(next.t) + '</div>' +
            (mine.length > 1 ? '<div class="lane-more faint">还有 ' + (mine.length - 1) + ' 件排队</div>' : '')
          : '<div class="lane-act faint">手上没有派到的事</div>') +
        '</div>';
    }).join('') + '</div>';

    html += '<p class="faint small" style="margin-top:10px">共 ' + unassigned +
      ' 件技术/数据/文档类的活，会按岗位自动派给对的人；队长类的活默认归你自己。' +
      '派错了就在上面那步的下拉里改。</p></div>';
    return html;
  }

  /* ============================================================ 论文场景 */
  function paperOf() {
    var pk = D.paper;
    return pk.papers.filter(function (x) { return x.id === S.paperType; })[0] || pk.papers[0];
  }

  function pSec(num, title, note, body) {
    return '<div class="sec"><div class="sec-head"><span class="sec-num">' + num + '</span>' +
      '<h2 class="sec-title">' + title + '</h2>' +
      (note ? '<span class="sec-note">' + note + '</span>' : '') + '</div>' + body + '</div>';
  }

  function pbar(pct) {
    return '<span class="pbar-cell"><span class="pbar"><i style="width:' + pct + '%"></i></span>' +
      '<span class="mono">' + pct + '%</span></span>';
  }

  function renderPaper() {
    var pk = D.paper, pp = paperOf();

    $('#paperSeg').innerHTML = pk.papers.map(function (x) {
      return '<button data-ptype="' + x.id + '"' + (x.id === pp.id ? ' class="is-on"' : '') + '>' +
        esc(x.name) + '</button>';
    }).join('');
    $$('#paperSeg button').forEach(function (b) {
      b.addEventListener('click', function () {
        S.paperType = b.getAttribute('data-ptype');
        save();
        renderAll();
        try { window.scrollTo(0, 0); } catch (e) {}
      });
    });

    var html = '';

    // 06.1 流程
    html += pSec('06.1', '写作流程与节点', pp.span,
      '<p class="small muted">换论文类型，流程不变；变的是章节骨架与字数配比。每一步都要有一个能交出去的东西，' +
      '否则「写了三周」在评审眼里等于零。</p>' +
      tableOf(['步骤', '什么时候', '做什么', '这一步的产出', '卡住的信号'], pk.flow.map(function (f) {
        return ['<b class="mono">' + esc(f.step) + '</b> ' + esc(f.name),
          '<span class="mono nowrap">' + esc(f.when) + '</span>',
          '<span class="small">' + esc(f.do) + '</span>',
          '<span class="small">' + esc(f.out) + '</span>',
          '<span class="muted small">' + esc(f.warn) + '</span>'];
      }), 'ledger') +
      '<div class="callout amber"><span class="ct">写作顺序</span>' +
      '先写方法与结果（手上已有素材），再写讨论，最后写引言与摘要。从引言开始写的人，' +
      '通常写到第三章就停下 —— 因为还没有结果可写。</div>');

    // 06.2 章节骨架
    html += pSec('06.2', '章节骨架与字数配比', esc(pp.en),
      '<div class="stat-row">' +
      '<div class="stat"><div class="stat-k">目标字数</div><div class="stat-v">' +
        (pp.total / 1000).toFixed(pp.total % 1000 ? 1 : 0) + '<small>千字</small></div></div>' +
      '<div class="stat"><div class="stat-k">章节数</div><div class="stat-v">' + pp.chapters.length +
        '<small>章</small></div></div>' +
      '<div class="stat"><div class="stat-k">建议周期</div><div class="stat-v" style="font-size:15px">' +
        esc(pp.span) + '</div></div>' +
      '<div class="stat"><div class="stat-k">最重的一章</div><div class="stat-v" style="font-size:14px">' +
        esc(pp.chapters.reduce(function (a, b) { return b.pct > a.pct ? b : a; }).n.split(' ').pop()) +
        '</div></div>' +
      '</div>' +
      '<div class="callout"><span class="ct">' + esc(pp.head) + '</span>' + esc(pp.one) + '</div>' +
      tableOf(['章节', '字数占比', '目标字数', '这一章要回答的问题', '这一章的交付物', '常见扣分'], pp.chapters.map(function (c) {
        return ['<b>' + esc(c.n) + '</b>', pbar(c.pct),
          '<span class="mono nowrap">' + c.words + '</span>',
          '<span class="small">' + esc(c.ask) + '</span>',
          '<span class="small muted">' + esc(c.out) + '</span>',
          '<span class="muted small">' + esc(c.trap) + '</span>'];
      }), 'ledger') +
      '<div class="callout rose"><span class="ct">这一类型最容易出问题的地方</span>' + esc(pp.note) + '</div>');

    // 06.3 句式模板
    html += pSec('06.3', '句式模板', '照着填，别从零憋',
      '<p class="small muted">论文卡住往往不是没想法，是不知道这类句子该怎么组织。' +
      '下面每一条都给了填空模板、一个真实写法的例子、和一句「别这么写」的反例。</p>' +
      '<div class="sent-list">' + pk.sent.map(function (s) {
        return '<div class="sent"><div class="sent-k">' + esc(s.k) + '</div>' +
          '<div class="sent-t">' + esc(s.t) + '</div>' +
          '<div class="sent-eg"><span class="sent-lb">例</span>' + esc(s.eg) + '</div>' +
          '<div class="sent-bad"><span class="sent-lb">别</span>' + esc(s.bad) + '</div></div>';
      }).join('') + '</div>');

    // 06.4 降重与降 AIGC
    html += pSec('06.4', '降重与降 AIGC', '先查再改，别倒过来',
      '<h3>六种降重手段</h3>' +
      tableOf(['手段', '具体怎么做', '能降多少', '风险', '必须守住的'], pk.dedup.map(function (d) {
        return ['<b>' + esc(d.name) + '</b>',
          '<span class="small">' + esc(d.how) + '</span>',
          '<span class="small">' + esc(d.eff) + '</span>',
          '<span class="muted small">' + esc(d.risk) + '</span>',
          '<span class="small">' + esc(d.must) + '</span>'];
      }), 'ledger') +
      '<div class="callout rose"><span class="ct">四条不能碰的线</span>' +
      pk.dedupRed.map(function (x) { return '· ' + esc(x); }).join('<br>') + '</div>' +
      '<h3>AI 味的十个特征与改法</h3>' +
      '<p class="small muted">检测系统判的是「这段有没有具体信息」。被标红的段落通常不是写得差，是写得空。</p>' +
      tableOf(['特征', '典型写法', '怎么改'], pk.aigc.map(function (a) {
        return ['<b>' + esc(a.sign) + '</b>',
          '<span class="muted small">' + esc(a.bad) + '</span>',
          '<span class="small">' + esc(a.fix) + '</span>'];
      })) +
      '<div class="callout"><span class="ct">阈值与判断</span>' +
      pk.aigcLine.map(function (x) { return '· ' + esc(x); }).join('<br>') + '</div>');

    // 06.5 排版
    html += pSec('06.5', '排版规范', '本校模板优先',
      tableOf(['项目', '要求', '常见错误'], pk.format.map(function (f) {
        return ['<b>' + esc(f.item) + '</b>',
          '<span class="small">' + esc(f.req) + '</span>',
          '<span class="muted small">' + esc(f.err) + '</span>'];
      })) +
      '<div class="callout amber"><span class="ct">口径说明</span>' + esc(pk.meta.note) + '</div>');

    // 06.6 参考文献
    html += pSec('06.6', '参考文献规范', pk.meta.refStd,
      '<p class="small muted">格式错是评审最容易扣的「无技术含量失分」。逐条对，别凭印象。</p>' +
      tableOf(['文献类型', '著录格式', '示例', '最常错'], pk.ref.map(function (r) {
        return ['<b>' + esc(r.t) + '</b>',
          '<span class="small mono">' + esc(r.fmt) + '</span>',
          '<span class="small muted">' + esc(r.eg) + '</span>',
          '<span class="muted small">' + esc(r.err) + '</span>'];
      }), 'ledger') +
      '<h3>六条硬规则</h3><div class="proc-list">' + pk.refRule.map(function (x, i) {
        return '<div class="proc"><span class="proc-i mono">' + pad(i + 1) + '</span>' +
          '<div><div class="proc-d">' + esc(x) + '</div></div></div>';
      }).join('') + '</div>');

    // 06.7 学术翻译
    html += pSec('06.7', '学术翻译', '术语一致性优先',
      tableOf(['中文', '推荐译法', '别这么译', '说明'], pk.trans.map(function (t) {
        return ['<b>' + esc(t.cn) + '</b>',
          '<span class="mono small">' + esc(t.en) + '</span>',
          '<span class="muted small">' + esc(t.bad) + '</span>',
          '<span class="small">' + esc(t.note) + '</span>'];
      }), 'ledger') +
      '<h3>五条翻译规矩</h3><div class="proc-list">' + pk.transRule.map(function (x, i) {
        return '<div class="proc"><span class="proc-i mono">' + pad(i + 1) + '</span>' +
          '<div><div class="proc-d">' + esc(x) + '</div></div></div>';
      }).join('') + '</div>');

    // 06.8 图表
    html += pSec('06.8', '论文图表清单', '共 ' + pk.charts.length + ' 类',
      '<p class="small muted">论文里的图不是装饰：每一张都要能被正文引用、被评委追问出处。' +
      '下面按「什么时候必须画」列，不是按软件列。</p>' +
      tableOf(['图', '什么时候必须画', '怎么画', '常见画错'], pk.charts.map(function (c) {
        return ['<b>' + esc(c.n) + '</b>',
          '<span class="small muted">' + esc(c.when) + '</span>',
          '<span class="small">' + esc(c.how) + '</span>',
          '<span class="muted small">' + esc(c.wrong) + '</span>'];
      })));

    // 06.9 自检
    var box = S.paperChecks || {}, tot = 0, dn = 0;
    pk.check.forEach(function (g) { g.items.forEach(function (_, i) { tot++; if (box[g.g + '|' + i]) dn++; }); });
    html += pSec('06.9', '提交前自检', '勾掉即存',
      '<div class="progress-row"><div class="bar"><i style="width:' + (tot ? dn / tot * 100 : 0) + '%"></i></div>' +
      '<span class="progress-num">' + dn + ' / ' + tot + '</span></div>' +
      pk.check.map(function (g) {
        return '<h3>' + esc(g.g) + '　<span class="faint small">' + g.items.length + ' 项</span></h3>' +
          '<div>' + g.items.map(function (t, i) {
            var k = g.g + '|' + i, on = !!box[k];
            return '<div class="check-item' + (on ? ' is-done' : '') + '" data-pk="' + esc(k) + '">' +
              '<span class="ci-box"><svg width="9" height="9" viewBox="0 0 10 10" fill="none">' +
              '<path d="M1.5 5.2 3.9 7.6 8.5 2.6" stroke="#fff" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg></span>' +
              '<span class="ci-body"><span class="ci-text">' + esc(t) + '</span></span></div>';
          }).join('') + '</div>';
      }).join(''));

    // 06.10 论文答辩
    var pd = pk.pdef;
    html += pSec('06.10', '论文答辩', '开题 8–10 分钟 · 学位 15–20 分钟',
      '<p class="small muted">论文答辩和竞赛路演不是一回事：评委只关心「这个问题配不配这套方法、数据撑不撑得住结论」。' +
      '页标题写判断，不写栏目名。</p>' +
      '<h3>开题答辩　<span class="faint small">' + esc(pd.opening.speak) + '</span></h3>' +
      tableOf(['页', '讲什么', '注意'], pd.opening.pages.map(function (r) {
        return ['<b>' + esc(r[0]) + '</b>', '<span class="small">' + esc(r[1]) + '</span>',
          '<span class="muted small">' + esc(r[2] || '—') + '</span>'];
      })) +
      '<h3>学位答辩　<span class="faint small">' + esc(pd.final.speak) + '</span></h3>' +
      tableOf(['页', '讲什么', '注意'], pd.final.pages.map(function (r) {
        return ['<b>' + esc(r[0]) + '</b>', '<span class="small">' + esc(r[1]) + '</span>',
          '<span class="muted small">' + esc(r[2] || '—') + '</span>'];
      })) +
      '<h3>会被问到的问题</h3>' +
      tableOf(['追问', '怎么答'], pd.qa.map(function (r) {
        return ['<b>' + esc(r[0]) + '</b>', '<span class="muted small">' + esc(r[1]) + '</span>'];
      })) +
      '<div class="callout rose"><span class="ct">不要这样答</span>' +
      '「这一块我还没深入研究」「这是导师定的方向」「后续会进一步完善」—— 三句话把责任推给外部，' +
      '评委听到的是你没参与决策。答不上就说「这块没做，原因是 ___，影响是 ___」。</div>' +
      '<h3>答辩稿五条硬规矩</h3><div class="proc-list">' + pd.rule.map(function (x, i) {
        return '<div class="proc"><span class="proc-i mono">' + pad(i + 1) + '</span>' +
          '<div><div class="proc-d">' + esc(x) + '</div></div></div>';
      }).join('') + '</div>');

    // 06.11 评分
    html += pSec('06.11', '验收与评分', '按权重安排精力',
      tableOf(['维度', '权重', '看什么', '怎么拿分'], pk.eval.map(function (e) {
        return ['<b>' + esc(e.d) + '</b>',
          '<span class="mono">' + e.w + '%</span>',
          '<span class="small muted">' + esc(e.look) + '</span>',
          '<span class="small">' + esc(e.how) + '</span>'];
      })) +
      '<div class="callout"><span class="ct">精力分配</span>' +
      '结果与分析占 30%，是唯一能靠补数据挽回的部分；写作用 10%，改三遍就到位。' +
      '反过来，把力气花在润色上、结果只有一组数据，是最常见的错配。</div>');

    $('#paperBody').innerHTML = html;

    $$('#paperBody .check-item').forEach(function (el) {
      el.addEventListener('click', function () {
        var k = el.getAttribute('data-pk');
        if (S.paperChecks[k]) delete S.paperChecks[k]; else S.paperChecks[k] = true;
        save();
        renderPaper();
      });
    });
  }

  /* ============================================================ 在线模式：服务端数据 ←→ 本地结构 */
  function saveQuiet() { try { localStorage.setItem(LS, JSON.stringify(S)); } catch (e) {} }

  function toLocal(r) {
    var ck2 = r.checks && Object.keys(r.checks).length
      ? r.checks : { topic: {}, team: {}, run: {}, close: {} };
    return {
      id: r.id, event: r.event, title: r.title || '', query: r.query || '',
      school: r.school || '', major: r.major || '', deadline: r.deadline || '',
      topicIdx: r.topicIdx == null ? null : r.topicIdx,
      planStack: r.planStack || '', defScheme: r.defScheme || '',
      checks: ck2,
      members: r.members || [],
      coach: r.coach || { done: {}, assign: {}, log: [] },
      role: r.role || 'member', inviteCode: r.inviteCode || '',
      createdAt: r.createdAt || Date.now()
    };
  }

  function adoptList(list) {
    S.projects = (list || []).map(toLocal);
    if (!P() && S.projects.length) S.active = S.projects[0].id;
    saveQuiet();
  }

  function mergeDetail(d) {
    if (!d || !d.project) return;
    var p = P();
    if (!p) return;
    var l = toLocal(d.project);
    Object.keys(l).forEach(function (k) { p[k] = l[k]; });
    S.feed = d.feed || [];
    saveQuiet();
  }

  function loadActive() {
    var p = P();
    if (!p || !(window.Api && Api.online && Api.user)) return;
    Api.get(p.id).then(function (d) { mergeDetail(d); renderAll(); })
      .catch(function () {});
  }

  function pollRemote() {
    if (!(window.Api && Api.online && Api.user)) return;
    if (document.hidden) return;
    if (S.view !== 'coach' && S.view !== 'project') return;
    var ae = document.activeElement;
    if (ae && /INPUT|TEXTAREA|SELECT/.test(ae.tagName)) return; // 别打断正在输入的人
    var p = P();
    if (!p) return;
    Api.get(p.id).then(function (d) { mergeDetail(d); renderAll(); })
      .catch(function () {});
  }

  /* ============================================================ 路由与总渲染 */
  function go(view) {
    S.view = view;
    save();
    writeHash();
    renderAll();
    try { window.scrollTo(0, 0); } catch (e) {}
  }

  function setTab(tab) {
    S.tab = tab;
    S.view = 'project';
    save();
    writeHash();
    renderAll();
    try { window.scrollTo(0, 0); } catch (e) {}
  }

  function renderAll() {
    var p = P();
    if (S.view === 'project' && !p) S.view = 'coach';
    $$('.view').forEach(function (v) {
      v.classList.toggle('is-on', v.id === 'view-' + S.view);
    });
    $$('#navSub .nav-item').forEach(function (b) {
      var on = S.view === 'project' && b.getAttribute('data-tab') === S.tab;
      b.classList.toggle('is-on', on);
    });
    if (S.view === 'coach') { renderCoach(); }
    if (S.view === 'home') { renderHome(); }
    if (S.view === 'project') { renderProject(); }
    if (S.view === 'library') { renderLibrary(); }
    if (S.view === 'mentor') { renderMentor(); }
    if (S.view === 'paper') { renderPaper(); }
    renderNav();
    renderCrumb();
  }

  /* ============================================================ 深链接 */
  function writeHash() {
    var h = S.view;
    if (S.view === 'project') h += '/' + S.tab;
    if (S.view === 'library') h += '/' + S.lib;
    if (S.view === 'paper') h += '/' + S.paperType;
    if (S.view === 'home') h = 'home';
    if (S.view === 'coach') h = 'coach';
    try { history.replaceState(null, '', '#' + h); } catch (e) { location.hash = h; }
  }

  function readHash() {
    var h = (location.hash || '').replace(/^#/, '');
    if (!h) return false;
    var a = h.split('/'), v = a[0], sub = a[1];
    if (v === 'home') { S.view = 'home'; return true; }
    if (v === 'coach') { S.view = 'coach'; return true; }
    if (v === 'mentor') { S.view = 'mentor'; return true; }
    if (v === 'paper') {
      S.view = 'paper';
      var ids = D.paper.papers.map(function (x) { return x.id; });
      if (ids.indexOf(sub) >= 0) S.paperType = sub;
      return true;
    }
    if (v === 'project' && P()) {
      S.view = 'project';
      if (['overview', 'topic', 'team', 'run', 'close'].indexOf(sub) >= 0) S.tab = sub;
      return true;
    }
    if (v === 'library') {
      S.view = 'library';
      if (['events', 'families', 'topics'].indexOf(sub) >= 0) S.lib = sub;
      return true;
    }
    return false;
  }

  function seedDemo() {
    if (S.projects.length) return;
    var p = newProject('ZDB', '消费调研', '南京财经大学', '商科', iso(addDays(today(), 16 * 7)));
    S.active = p.id; S.view = 'project'; S.tab = 'overview';
    p.checks.topic[0] = true; p.checks.topic[1] = true; p.checks.topic[3] = true;
    p.checks.team[0] = true; p.checks.team[1] = true;
    // 第二个示例：计算机轨，用来演示选题级开工单与学习路线
    var p2 = newProject('DT', '校园设备故障预测与智能派单系统', '南京工业职业技术大学',
                        '计算机', iso(addDays(today(), 20 * 7)));
    p2.checks.topic[0] = true;
    p2.members = [
      { name: '示例·队长', role: 'old', post: '答辩' },
      { name: '示例·后端', role: 'old', post: '技术' },
      { name: '示例·前端', role: 'new', post: '运营' },
      { name: '示例·数据', role: 'new', post: '数据' },
      { name: '示例·测试', role: 'new', post: '文档' }
    ];
    p2.roles = ['arch', 'beA', 'fe', 'data', 'qa'];
    // 示例进度：前 17 步已走完，停在第 18 步「把主线拆成 3 步」
    p2.coach = { done: {}, assign: {}, log: [] };
    ['A01', 'A02', 'A03', 'A04', 'A05', 'A06', 'A07', 'A08', 'A09',
     'A10', 'A11', 'A12', 'A13', 'A14', 'A15', 'A16', 'A17'].forEach(function (k) {
      p2.coach.done[k] = true;
      p2.coach.log.push(k);
    });
    S.active = p2.id; S.tab = 'run'; S.view = 'coach';
    save();
  }

  /* ============================================================ 绑定 */
  function bind() {
    $$('.nav-item[data-go]').forEach(function (b) {
      b.addEventListener('click', function () { go(b.getAttribute('data-go')); });
    });
    $$('#navSub .nav-item').forEach(function (b) {
      b.addEventListener('click', function () { setTab(b.getAttribute('data-tab')); });
    });
    $$('#libSeg button').forEach(function (b) {
      b.addEventListener('click', function () { S.lib = b.getAttribute('data-lib'); save(); renderAll(); });
    });

    $('#queryInput').addEventListener('input', updateGen);
    $('#queryInput').addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && !$('#btnGenerate').disabled) makeFromForm();
    });
    $('#btnGenerate').addEventListener('click', makeFromForm);
    $('#btnLibraryHint').addEventListener('click', function () { go('library'); });
    $('#btnDemo').addEventListener('click', function () {
      S.newEv = 'ZDB';
      $$('#miniEv button').forEach(function (x) { x.classList.toggle('is-on', x.getAttribute('data-ev') === 'ZDB'); });
      $('#queryInput').value = '消费调研';
      $('#schoolSel').value = '南京财经大学';
      $('#majorSel').value = '商科';
      $('#deadlineInput').value = iso(addDays(today(), 16 * 7));
      makeFromForm();
    });

    $('#btnReset').addEventListener('click', function () {
      if (!confirm('清空全部项目与勾选记录？此操作不可撤销。')) return;
      localStorage.removeItem(LS);
      location.reload();
    });
    $('#btnPrint').addEventListener('click', function () {
      var proj = S.view === 'project';
      if (proj) document.body.classList.add('print-project');
      window.print();
      setTimeout(function () { document.body.classList.remove('print-project'); }, 500);
    });
  }

  function makeFromForm() {
    var q = ($('#queryInput').value || '').trim();
    if (!S.newEv || q.length < 2) return;
    newProject(S.newEv, q, $('#schoolSel').value, $('#majorSel').value, $('#deadlineInput').value);
    $('#queryInput').value = '';
    S.view = 'project'; S.tab = 'overview';
    save(); renderAll();
    try { window.scrollTo(0, 0); } catch (e) {}
  }

  /* ============================================================ 启动 */
  function init() {
    var restored = load();
    if (!restored && /(^|[?&])demo=1/.test(location.search)) seedDemo();
    if (!restored) {
      S.newEv = 'ZDB';
      $('#deadlineInput').value = iso(addDays(today(), 16 * 7));
    }
    if (!S.newEv) S.newEv = 'ZDB';
    if (!S.projects.length) $('#deadlineInput').value = iso(addDays(today(), 16 * 7));
    if (S.projects.length && !P()) S.active = S.projects[0].id;
    bind();
    readHash();
    if (!S.projects.length) S.view = 'coach';
    renderAll();
    if (/(^|[?&])print=1/.test(location.search)) document.body.classList.add('print-project');
    window.addEventListener('hashchange', function () { if (readHash()) renderAll(); });

    // ---- 接后端：有后端就用在线模式，没有就静默退回离线，界面不报错
    if (!window.Api) return;
    var isDemo = /(^|[?&])demo=1/.test(location.search);

    function pullFromServer() {
      var had = S.projects.slice();
      return Api.list().then(function (list) {
        if (!list.length && had.length && !isDemo) return migrateUp(had);
        adoptList(list);
        if (!P() && S.projects.length) S.active = S.projects[0].id;
        renderAll(); loadActive();
      }).catch(function () {});
    }

    Api.on('auth', function (user) {
      Api.renderChip();
      if (user) { pullFromServer(); }
      else { S.projects = []; S.feed = []; saveQuiet(); renderAll(); }
    });

    Api.boot().then(function () {
      Api.renderChip();
      if (Api.online && Api.user) pullFromServer();
      else if (Api.online) renderAll();
    });
    setInterval(pollRemote, 15000);
  }

  // 离线时建的项目，登录后一次性传上去，避免「登录就丢数据」
  function migrateUp(list) {
    if (isDemoNoop()) return Promise.resolve(null);
    var jobs = list.map(function (p) {
      return Api.create(p).then(function () { return p; }).catch(function () { return null; });
    });
    return Promise.all(jobs).then(function (ok) {
      if (!ok.filter(Boolean).length) return null;
      return Api.list().then(function (l) {
        adoptList(l);
        if (!P() && S.projects.length) S.active = S.projects[0].id;
        renderAll(); loadActive();
      });
    });
  }
  function isDemoNoop() { return /(^|[?&])demo=1/.test(location.search); }

  init();
})();
