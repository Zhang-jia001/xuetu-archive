// 竞赛指导台 V2 · jsdom 回归
// 用法: NODE_PATH=~/.workbuddy/binaries/node/workspace/node_modules node --max-old-space-size=6144 check_guide.js
// 单文件已近 500KB，内存不加大会被 SIGTERM（退出码 137）
const fs = require('fs');
const { JSDOM, VirtualConsole } = require('jsdom');

const FILE = '/Users/zhangjiaming/WorkBuddy/竞赛/竞赛指导台_学生版.html';
const html = fs.readFileSync(FILE, 'utf8');
const vc = new VirtualConsole();
const errs = [];
vc.on('jsdomError', (e) => { if (!/scrollTo/.test(e.message)) errs.push('jsdomError: ' + e.message); });
vc.on('error', (m) => errs.push('console.error: ' + m));

const dom = new JSDOM(html, {
  runScripts: 'dangerously', pretendToBeVisual: true,
  url: 'https://example.test/', virtualConsole: vc,
});
const w = dom.window, d = w.document;
w.addEventListener('error', (e) => errs.push('window.error: ' + (e.message || e)));

const results = [];
function t(name, cond, extra) { results.push({ name, ok: !!cond, extra: extra || '' }); }
const q = (s) => d.querySelector(s);
const qa = (s) => Array.from(d.querySelectorAll(s));
const ev = (el, type) => el.dispatchEvent(new w.Event(type, { bubbles: true }));
function navHome() { qa('.nav-item[data-go]').find((x) => x.dataset.go === 'home').click(); }

// ---------- 1 数据
t('数据：6 赛事', Object.keys(w.__DATA__.comps).length === 6);
t('数据：13 方向卡', Object.keys(w.__DATA__.cards).length === 13);
t('数据：120 选题', w.__DATA__.topics.length === 120);
t('数据：6 门禁', w.__DATA__.gates.length === 6);
t('数据：6 结项口径', Object.keys(w.__DATA__.closing).length === 6);
t('数据：答辩包 6 配色/16 页/10 图', w.__DATA__.defense.schemes.length === 6 &&
  w.__DATA__.defense.base.length === 16 && w.__DATA__.defense.charts.length === 10);
t('数据：论文 5 类型', w.__DATA__.paper.papers.length === 5);
t('数据：论文各类型占比合计 100%',
  w.__DATA__.paper.papers.every((p) => p.chapters.reduce((s, c) => s + c.pct, 0) === 100));
t('数据：论文自检 26 项',
  w.__DATA__.paper.check.reduce((s, g) => s + g.items.length, 0) === 26);
t('数据：论文答辩 8/11 页 + 10 追问',
  w.__DATA__.paper.pdef.opening.pages.length === 8 &&
  w.__DATA__.paper.pdef.final.pages.length === 11 &&
  w.__DATA__.paper.pdef.qa.length === 10);
t('数据：陪跑六赛事覆盖层', w.__DATA__.coachEv &&
  Object.keys(w.__DATA__.coachEv).length === 6 &&
  Object.keys(w.__DATA__.coachEv.ZDB.acts).length >= 10);

// ---------- 2 陪跑（默认首页）
t('默认进陪跑页', q('#view-coach').classList.contains('is-on'));
t('无项目时给 6 个赛事入口', qa('#coachBody [data-ev-start]').length === 6,
  qa('#coachBody [data-ev-start]').length + ' 个');
t('侧栏显示待办计数', /未开始|0\//.test(q('#navCoachDone').textContent), q('#navCoachDone').textContent);

// ---------- 3 首页（工作台）
navHome();
t('首页 6 个赛事 chip', qa('#miniEv button').length === 6);
t('未填方向时禁用', q('#btnGenerate').disabled === true);
t('无项目时项目区隐藏', q('#projSec').hidden === true);
t('首页三件事渲染', qa('#quickSec h4').length >= 3);
t('时间窗表 6 行', qa('#quickWindows tr').length === 6);

// ---------- 3 生成项目
q('#miniEv button[data-ev="ZDB"]').click();
q('#queryInput').value = '消费调研';
ev(q('#queryInput'), 'input');
t('填完方向后可生成', q('#btnGenerate').disabled === false);
q('#schoolSel').value = '南京财经大学';
q('#majorSel').value = '商科';
q('#btnGenerate').click();

t('生成后进入项目空间', q('#view-project').classList.contains('is-on'));
t('项目头有标题', q('#pdTitle').textContent.length > 6, q('#pdTitle').textContent);
t('阶段条 4 段', qa('#stepper .step').length === 4);
t('概览 4 个指标', qa('#ptab-overview .stat').length === 4);
t('概览有下一步', qa('#ptab-overview .next-item').length > 0);
t('侧栏出现项目子菜单', q('#navSub').classList.contains('is-open'));

// ---------- 4 选题 tab
qa('#stepper .step').find((x) => x.dataset.tab === 'topic').click();
t('选题 tab 可见', q('#ptab-topic').hidden === false);
t('匹配列表有结果', qa('#ptab-topic .match').length > 0, qa('#ptab-topic .match').length + ' 条');
t('七要素展示', qa('#ptab-topic .kv dt').length >= 5);
t('方向族步骤渲染', qa('#ptab-topic .tl-item').length > 3);
t('选题清单 8 项', qa('#ptab-topic .check-item').length === 8);

q('#ptab-topic .check-item').click();
t('勾选生效', q('#ptab-topic .check-item').classList.contains('is-done'));
t('阶段条计数更新', q('#stepper .step[data-tab="topic"] .step-sub').textContent === '1/8',
  q('#stepper .step[data-tab="topic"] .step-sub').textContent);
t('侧栏 pct 更新', q('.nav-item.sub[data-tab="topic"] .nav-pct').textContent === '1/8');

// 换选题
const second = qa('#ptab-topic .match')[1];
if (second) second.click();
t('可切换选题', q('#ptab-topic .match.is-on') !== q('#ptab-topic .match'));

// ---------- 4.5 陪跑按赛事定制（ZDB 覆盖层）
qa('.nav-item[data-go]').find((x) => x.dataset.go === 'coach').click();
t('陪跑显示赛事定制说明', q('#coachBody').textContent.indexOf('已按「正大杯') >= 0,
  q('#coachBody').textContent.slice(0, 80));
t('ZDB 覆盖层已换步骤内容', w.__DATA__.coachEv.ZDB.acts.A02.how.join('').indexOf('匿名版') >= 0);
t('侧栏待办计数仍为 33 步', /\/33/.test(q('#navCoachDone').textContent), q('#navCoachDone').textContent);
qa('.nav-item[data-go]').find((x) => x.dataset.go === 'project').click();

// ---------- 5 组队 tab
qa('#stepper .step').find((x) => x.dataset.tab === 'team').click();
t('人数结构表存在', qa('#ptab-team table').length >= 2);
t('岗位错位表 6 行', qa('#ptab-team table')[1].querySelectorAll('tbody tr').length === 6);
t('角色插槽 5 个', qa('#ptab-team .slot').length === 5);
t('成员默认 5 行', qa('#ptab-team .member-row').length === 5);
q('#addMember').click();
t('加成员后 6 行', qa('#ptab-team .member-row').length === 6);
t('组队清单 8 项', qa('#ptab-team .check-item').length === 8);

// ---------- 6 推进 tab
qa('#stepper .step').find((x) => x.dataset.tab === 'run').click();
t('时间轴 4 段', qa('#ptab-run .tl-item').length === 4);
const tblByHead = (kw) => qa('#ptab-run table').find((x) => (x.querySelector('thead') || {}).textContent && x.querySelector('thead').textContent.indexOf(kw) >= 0);
const gatesTbl = tblByHead('门禁');
t('门禁表存在', !!gatesTbl);
t('门禁 6 条', !!gatesTbl && gatesTbl.querySelectorAll('tbody tr').length === 6);
t('排期表存在', qa('#ptab-run table').length >= 3);
t('推进清单 12 项', qa('#ptab-run .check-item').length === 12);
t('推进页有保姆辅导桥', !!q('#ptab-run [data-go-coach]'));

// 选题级落地方案（第一周开工单 + 学习路线）
t('开工单区块存在', qa('#ptab-run .day').length === 7, qa('#ptab-run .day').length + ' 天');
t('每天有交付物', qa('#ptab-run .day-out').length === 7);
t('软件清单标必装', (q('#ptab-run').textContent.match(/必装/g) || []).length >= 3);
t('技术栈可切换', !!q('#planStackSel') && qa('#planStackSel option').length === 6);
t('学习路线三段', qa('#ptab-run .route').length === 3, qa('#ptab-run .route').length + ' 段');
t('路线带课程对位', qa('#ptab-run .cref').length > 10, qa('#ptab-run .cref').length + ' 条');

// 分组开发排期
t('泳道表存在', qa('#ptab-run .lane-tbl').length === 1);
t('泳道有成员行', qa('#ptab-run .lane-tbl tbody tr').length >= 3, qa('#ptab-run .lane-tbl tbody tr').length + ' 行');
t('泳道有周次列', qa('#ptab-run .lane-tbl th.lane-w').length >= 4, qa('#ptab-run .lane-tbl th.lane-w').length + ' 周');
t('关键路径有节点', qa('#ptab-run .chain-node').length >= 3, qa('#ptab-run .chain-node').length + ' 环');
t('流程红线 7 条', qa('#ptab-run .proc').length === 7, qa('#ptab-run .proc').length + ' 条');
t('手册骨架 10 节', (q('#ptab-run').textContent.match(/§10/g) || []).length >= 1);
{
  const tables = qa('#ptab-run table');
  const ledger = tables.find((x) => (x.querySelector('thead') || {}).textContent &&
    x.querySelector('thead').textContent.indexOf('完成定义') >= 0);
  t('任务台账存在', !!ledger);
  t('台账任务数 ≥ 20', !!ledger && ledger.querySelectorAll('tbody tr').length >= 20,
    ledger ? ledger.querySelectorAll('tbody tr').length + ' 条' : '无');
}
// 队员配置 → 角色下拉 → 重排
{
  const sels = qa('#ptab-run [data-role-for]');
  t('有队员时出角色下拉', sels.length > 0, sels.length + ' 个');
  if (sels.length) {
    const rowsBefore = qa('#ptab-run .lane-tbl tbody tr').length;
    const target = sels[0];
    const orig = target.value;
    target.value = orig === 'qa' ? 'arch' : 'qa';
    target.dispatchEvent(new w.Event('change'));
    t('改角色后泳道仍在', qa('#ptab-run .lane-tbl tbody tr').length === rowsBefore);
    const s2 = qa('#ptab-run [data-role-for]')[0];
    t('改角色被记住', !!s2 && s2.value !== orig);
    s2.value = orig;
    s2.dispatchEvent(new w.Event('change'));
  }
}
{
  const sel = q('#planStackSel');
  const firstBefore = (q('#ptab-run .day-t') || {}).textContent || '';
  const origVal = sel.value;
  const before = qa('#ptab-run .day-todo li').length;
  sel.value = origVal === 'sec' ? 'microsvc' : 'sec';
  sel.dispatchEvent(new w.Event('change'));
  const after = qa('#ptab-run .day-todo li').length;
  const firstAfter = (q('#ptab-run .day-t') || {}).textContent || '';
  t('切栈后内容刷新', !!firstAfter && firstAfter !== firstBefore && qa('#ptab-run .day').length === 7,
    'D1: ' + firstBefore + ' → ' + firstAfter);
  const sel2 = q('#planStackSel');
  t('切栈后选中态保留', sel2.value === (origVal === 'sec' ? 'microsvc' : 'sec'));
  sel2.value = origVal;
  sel2.dispatchEvent(new w.Event('change'));
  t('切回默认栈恢复', qa('#ptab-run .day').length === 7 && !!q('#planStackSel'));
}

// ---------- 7 结项 tab
qa('#stepper .step').find((x) => x.dataset.tab === 'close').click();
t('结项硬条件 5 条', qa('#ptab-close li').length === 5);
t('材料与红线表', qa('#ptab-close table').length >= 1);
t('结项清单含硬条件', qa('#ptab-close .check-item').length === 11, qa('#ptab-close .check-item').length + ' 项');
t('最后一页有导出按钮', !!q('#btnPrintTab'));

// 答辩工作台
{
  const tbl = (kw) => qa('#ptab-close table').find((x) => x.querySelector('thead') &&
    x.querySelector('thead').textContent.indexOf(kw) >= 0);
  t('答辩配色 6 款', qa('#ptab-close .scheme').length === 6, qa('#ptab-close .scheme').length + ' 款');
  const deck = tbl('这页讲什么');
  t('逐页大纲表存在', !!deck);
  t('逐页大纲 10–18 页', !!deck && (() => {
    const n = deck.querySelectorAll('tbody tr').length; return n >= 10 && n <= 18;
  })(), deck ? deck.querySelectorAll('tbody tr').length + ' 页' : '无');
  t('追问表 ≥8 条', (() => { const x = tbl('追问'); return !!x && x.querySelectorAll('tbody tr').length >= 8; })());
  t('自述稿 5 条 + 排版红线 7 条', qa('#ptab-close .proc').length === 12, qa('#ptab-close .proc').length + ' 条');
  // 切换配色
  const ink = qa('#ptab-close .scheme').find((x) => x.dataset.scheme === 'ink');
  if (ink) ink.click();
  const on = q('#ptab-close .scheme.is-on');
  t('切配色生效', !!on && on.dataset.scheme === 'ink', on && on.dataset.scheme);
  t('切配色后大纲仍在', qa('#ptab-close .scheme').length === 6 && !!tbl('这页讲什么'));
  t('配色已落盘', JSON.parse(w.localStorage.getItem('compGuide.v2')).projects
    .some((p) => p.defScheme === 'ink'));
}

// ---------- 7.5 论文写作台
qa('.nav-item[data-go]').find((x) => x.dataset.go === 'paper').click();
t('论文台可见', q('#view-paper').classList.contains('is-on'));
t('论文类型 5 类', qa('#paperSeg button').length === 5);
t('默认毕业论文', (q('#paperSeg button.is-on') || {}).dataset &&
  q('#paperSeg button.is-on').dataset.ptype === 'thesis');
t('论文区块 11 个', qa('#paperBody .sec').length === 11, qa('#paperBody .sec').length + ' 段');
{
  const tbl = (kw) => qa('#paperBody table').find((x) => x.querySelector('thead') &&
    x.querySelector('thead').textContent.indexOf(kw) >= 0);
  t('章节骨架表 7 章', (() => {
    const x = tbl('这一章要回答的问题'); return !!x && x.querySelectorAll('tbody tr').length === 7;
  })());
  t('章节带字数占比条', qa('#paperBody .pbar').length === 7, qa('#paperBody .pbar').length + ' 条');
  t('句式模板 9 条', qa('#paperBody .sent').length === 9, qa('#paperBody .sent').length + ' 条');
  t('参考文献 9 类', (() => {
    const x = tbl('著录格式'); return !!x && x.querySelectorAll('tbody tr').length === 9;
  })());
  t('学术翻译 18 条', (() => {
    const x = tbl('推荐译法'); return !!x && x.querySelectorAll('tbody tr').length === 18;
  })());
  t('论文图表 12 类', (() => {
    const x = tbl('什么时候必须画'); return !!x && x.querySelectorAll('tbody tr').length === 12;
  })());
  const defs = qa('#paperBody table').filter((x) => x.querySelector('thead') &&
    x.querySelector('thead').textContent.indexOf('讲什么') >= 0);
  t('答辩两张表 8 / 11 页', defs.length === 2 &&
    defs[0].querySelectorAll('tbody tr').length === 8 &&
    defs[1].querySelectorAll('tbody tr').length === 11, defs.length + ' 表');
  t('答辩追问 10 条', (() => {
    const x = tbl('追问'); return !!x && x.querySelectorAll('tbody tr').length === 10;
  })());
}
t('论文自检 26 项', qa('#paperBody .check-item').length === 26, qa('#paperBody .check-item').length + ' 项');
q('#paperBody .check-item').click();
t('论文自检可勾', q('#paperBody .check-item').classList.contains('is-done'));
t('论文自检已落盘', Object.keys(JSON.parse(w.localStorage.getItem('compGuide.v2')).paperChecks).length === 1);
// 换类型
qa('#paperSeg button').find((x) => x.dataset.ptype === 'review').click();
t('切到文献综述', q('#paperSeg button.is-on').dataset.ptype === 'review');
t('综述 6 章', (() => {
  const x = qa('#paperBody table').find((y) => y.querySelector('thead') &&
    y.querySelector('thead').textContent.indexOf('这一章要回答的问题') >= 0);
  return !!x && x.querySelectorAll('tbody tr').length === 6;
})(), '应为 6 章');
t('综述内容已换', /检索与筛选结果/.test(q('#paperBody').textContent));
t('切类型后自检保留', q('#paperBody .check-item.is-done') !== null);
qa('#paperSeg button').find((x) => x.dataset.ptype === 'thesis').click();
t('切回毕业论文', /理论基础与文献综述/.test(q('#paperBody').textContent));


// ---------- 8 返回首页 / 多项目
navHome();
t('首页出现项目卡', qa('#projGrid .proj-card').length === 1);
t('项目卡显示进度', /完成/.test(q('#projGrid .proj-card').textContent));

// 第二个项目：4C
q('#miniEv button[data-ev="C4"]').click();
q('#queryInput').value = '微课';
ev(q('#queryInput'), 'input');
q('#btnGenerate').click();
t('第二个项目生成', /4C/.test(q('#pdMeta').textContent), q('#pdMeta').textContent);
navHome();
t('项目卡 2 张', qa('#projGrid .proj-card').length === 2);

// 切回第一个项目
qa('#projGrid .proj-card')[1].click();
t('可切回旧项目', q('#view-project').classList.contains('is-on') && /正大杯/.test(q('#pdMeta').textContent),
  q('#pdMeta').textContent);

// ---------- 9 资源库
qa('.nav-item[data-go]').find((x) => x.dataset.go === 'library').click();
t('资源库默认赛事口径', qa('#libBody .lib-item').length === 6);
t('赛事详情渲染硬约束', qa('#libEvDetail table').length >= 2);
qa('#libSeg button').find((x) => x.dataset.lib === 'families').click();
t('方向族 13 条', qa('#libBody .lib-item').length === 13);
t('方向族详情有步骤', qa('#libFamDetail .tl-item').length > 3);
qa('#libSeg button').find((x) => x.dataset.lib === 'topics').click();
t('选题池分页 15 条', qa('#libBody [data-topic]').length === 15, qa('#libBody [data-topic]').length + ' 条');
t('分页控件存在', !!q('#nextPage'));
q('#nextPage').click();
t('翻页生效', /2 \/ /.test(q('.pager span').textContent), q('.pager span').textContent);
q('#tq').value = '老年';
ev(q('#tq'), 'input');
t('选题池可搜索', qa('#libBody [data-topic]').length > 0 && qa('#libBody [data-topic]').length < 15,
  qa('#libBody [data-topic]').length + ' 条');

// 用选题立项
q('#libBody [data-topic]').click();
t('选题详情有立项按钮', !!q('[data-adopt]'));
q('[data-adopt]').click();
t('从选题池立项成功', q('#view-project').classList.contains('is-on'));

// ---------- 10 评审
qa('.nav-item[data-go]').find((x) => x.dataset.go === 'mentor').click();
t('评审三节点', qa('#mentorRows tr').length === 3);
t('高频问答渲染', qa('#qaList .qa').length >= 4);
q('#qaList .qa-q').click();
t('问答可展开', q('#qaList .qa').classList.contains('is-open'));

// ---------- 11 持久化
const saved = JSON.parse(w.localStorage.getItem('compGuide.v2'));
t('状态落盘 v2', saved && saved.v === 2);
t('项目数 3', saved.projects.length === 3, saved.projects.length + ' 个');
t('勾选已存', saved.projects.some((p) => p.checks.topic && Object.keys(p.checks.topic).length >= 1));

// ---------- 12 结构
t('无重复 id', (() => { const ids = qa('[id]').map((x) => x.id); return new Set(ids).size === ids.length; })());
t('无脚本报错', errs.length === 0, errs.slice(0, 3).join(' | '));

let pass = 0;
for (const r of results) {
  console.log((r.ok ? '✓' : '✗') + ' ' + r.name + (r.extra ? '  → ' + r.extra : ''));
  if (r.ok) pass++;
}
console.log('\n' + pass + '/' + results.length + ' 通过');
if (errs.length) console.log('ERRORS:\n' + errs.slice(0, 8).join('\n'));
process.exit(pass === results.length ? 0 : 1);
