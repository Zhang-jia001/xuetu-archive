# -*- coding: utf-8 -*-
"""竞赛指导台 · 构建脚本

输入：comps.py（六赛事口径）、topic_guide.py（13 张方向族卡）、
      topics_all.json（120 条选题）、exec_plan.py（选题级落地方案）、
      dev_schedule.py（分组开发排期）、defense_kit.py（答辩工作台）、
      paper_kit.py（论文写作台）、L5 组队建制（本文件内固化）
输出：/Users/zhangjiaming/WorkBuddy/竞赛/竞赛指导台_学生版.html（单文件，离线可用）
"""
import json
import os
import re
import sys

ROOT = '/Users/zhangjiaming/WorkBuddy/竞赛'
EXEC = os.path.join(ROOT, 'working', '执行方案')
sys.path.append(EXEC)

import comps  # noqa: E402
import topic_guide as TG  # noqa: E402
import exec_plan as EP  # noqa: E402
import dev_schedule as DS  # noqa: E402
import defense_kit as DK  # noqa: E402
import paper_kit as PK  # noqa: E402
import coach_kit as CK  # noqa: E402

SRC = os.path.join(ROOT, 'working', '竞赛指导台', 'src')
OUT = os.path.join(ROOT, '竞赛指导台_学生版.html')

# ---------------------------------------------------------------- 元信息
META = {
    'DCH': dict(
        short='大创（创新创业训练计划）', size='A 1–5 / B 3–5 / C 3–7 人',
        cycle='每年 3 月申报—次年 5 月结题', weeks=20,
        one='一年期立项 + 经费 + 结题验收，天生的项目孵化器',
        entry='校级立项 → 省级 → 国家级（A 创新训练 / B 创业训练 / C 创业实践）',
        risk='立项时没倒推结题条件，结题时拿不出成果佐证',
        teamKey='大创 A 类（创新训练）', topicTag='大创',
        redline=dict(
            chong='结题材料同样要过学校查重，引用与综述部分最容易撞',
            blind='按学校要求匿名评审，报送前逐页删净校名与指导教师',
            size='申报书、中期报告、结题报告按模板页数与格式，不接受自拟排版'),
    ),
    'GCS': dict(
        short='国创赛（原「互联网+」）', size='3–15 人', cycle='8 月报名—10 月国赛', weeks=14,
        one='BP + 路演，看证据链是否完整，不看创意多新奇',
        entry='高教主赛道（创意组 / 创业组）× 五类项目，涉农或公益可转红旅',
        risk='财务假设经不起追问、用户验证只有桌面研究',
        teamKey='国创赛（高教主赛道）', topicTag='国创赛',
        redline=dict(
            chong='查重率 ≤15%，超线直接不予评审',
            blind='网评 PDF 按当年通知做匿名处理，别留院校痕迹',
            size='商业计划书 PDF ≤50MB，超限传不上去'),
    ),
    'DT': dict(
        short='大挑（课外学术科技作品竞赛）', size='学生 ≤8 人 / 指导教师 ≤3 人',
        cycle='奇数年，校赛 11 月—次年 3 月', weeks=18,
        one='学术科技作品，看研究做得深不深',
        entry='三类作品择一：自然科学学术论文 / 哲社调查报告 / 科技发明制作',
        risk='作品超出两年时间窗、哲社类拿不到落地证明',
        teamKey='大挑（挑战杯）', topicTag='挑战杯',
        redline=dict(
            chong='作品须原创，学校统一查重，毕设与课程论文不得申报',
            blind='多数省份匿名评审，按当年通知处理作者信息',
            size='哲社 ≤15000 字 / 自然学术论文 ≤8000 字，超字数直接降档'),
    ),
    'XT': dict(
        short='小挑（创业计划竞赛）', size='校赛 ≤8 人 / 总数 ≤10 人',
        cycle='偶数年，校赛 3—5 月', weeks=14,
        one='创业计划与商业落地，看事情做得实不实',
        entry='五个组别择一：科技创新 / 乡村振兴 / 社会治理 / 生态文明 / 文化创意',
        risk='拿大挑的材料改个标题就投、实践成效没有量化',
        teamKey='小挑（挑战杯）', topicTag='挑战杯（小挑）',
        redline=dict(
            chong='查重相似度 ≤15%，往届国金国银不得重复报名',
            blind='按省赛要求做匿名处理',
            size='项目介绍 PPT 转 PDF ≤20 页（含封面封底）'),
    ),
    'C4': dict(
        short='4C（计算机设计大赛）', size='2–9 人同校本科生',
        cycle='3—5 月省赛—7—8 月国赛', weeks=12,
        one='纯作品评审，评委看作品本身，不写长篇报告',
        entry='11 个大类择一，其中 6 个类目限定「中国古代建筑成就」主题',
        risk='一稿多投、作品完成时间窗不对、用了非指定 AI 工具',
        teamKey='4C', topicTag='4C',
        redline=dict(
            chong='不得一稿多投，作品须本届时间窗内原创，版权属作者',
            blind='按类目要求，作品内不得出现院校标识',
            size='演示视频、设计文档按类目模板，超时超页不予受理'),
    ),
    'ZDB': dict(
        short='正大杯（市场调查与分析大赛）', size='学生 3–5 人 / 指导教师 1–3 人',
        cycle='每年 9 月—次年 5 月', weeks=16,
        one='市场调查 + 统计分析 + 报告，纯材料与答辩评审',
        entry='正大杯·实践赛（先过个人知识赛，60 分合格）',
        risk='问卷题项没对应变量、样本不够、盲审忘了删校名',
        teamKey='正大杯', topicTag='正大杯',
        redline=dict(
            chong='查重 ≤20%，超 40% 按学术不端通报，提交前压到 15%',
            blind='报告与 PPT 均不得出现参赛校与指导教师信息',
            size='报告正文 ≤65 页，超页系统直接拒收'),
    ),
}

# ---------------------------------------------------------------- 组队建制（L5）
TEAM = dict(
    cols=['赛事', '人数硬约束（不可破）', '建议总人数', '老学员', '新同学', '新同学典型岗位', '组队范围'],
    rows=[
        ['正大杯', '学生 3–5 人 ＋ 指导教师 1–3 人', 5, 2, 3,
         '访谈执行 · 数据录入与清洗 · 图表制作', '同校'],
        ['大创 A 类（创新训练）', '1–5 人；须 1 名指导教师', 5, 2, 3,
         '文献与资料整理 · 实验或调研记录 · 数据整理', '同校'],
        ['国创赛（高教主赛道）', '3–15 人，含负责人；年龄 ≤35 岁；允许跨校', 7, 2, 5,
         '需求调研 · 前端或测试 · 材料与路演支持', '<b>允许跨校</b>（四校之间可混编）'],
        ['大挑（挑战杯）', '学生 ≤8 人；指导教师 ≤3 人', 6, 2, 4,
         '文献综述 · 问卷与访谈 · 数据清洗', '同校'],
        ['小挑（挑战杯）', '校赛 ≤8 人、总人数 ≤10 人；每生限 1 个项目', 6, 2, 4,
         '用户调研 · 内容与视觉 · 财务数据整理', '同校'],
        ['4C', '每队 2–9 名<b>同校</b>本科生', 5, 2, 3,
         '素材采集 · 界面或素材制作 · 文档与答辩稿', '<b>严格同校</b>（不得跨校）'],
    ],
    postCols=['岗位', '老学员做什么（不可替代，占关键路径）',
              '新同学做什么（独立、可见、可署名）', '产出落在哪里（能被谁看到）'],
    postRows=[
        ['技术', '架构与选型、核心链路、接口与数据模型设计',
         '<b>一个叶子功能的完整实现</b> ＋ 该功能的测试用例 ＋ 这一块的接口说明',
         'Git 提交记录（作者是他）／demo 里能点到的那个按钮'],
        ['调研', '抽样方案、访谈提纲定稿、与机构或商户对接',
         '<b>执行 N 场访谈</b> ＋ 录音转写 ＋ 一份访谈纪要（含自己的观察结论）',
         '带自己署名的访谈纪要／录音与转写清单／附录里的访谈照片'],
        ['数据', '方法选择（用什么模型、为什么）、建模与最终结论',
         '数据清洗脚本 ＋ 描述统计 ＋ 图（他做的图进报告）',
         '清洗后的数据集（他能讲清每一步）／报告里他做的那张图'],
        ['文档', 'BP 或报告主线逻辑与结构',
         '图表制作 ＋ 事实与数据核对 ＋ 排版（他负责的那一节）',
         '署名的那一节／核对记录表（挑出过几处错误）'],
        ['运营', '渠道策略、投放决策、与外部资源谈',
         '<b>内容生产 N 条</b> ＋ 发布执行 ＋ 数据回收',
         '平台后台的发布记录／周报里他填的那一列数据'],
        ['答辩', '主答与临场应变、应对追问',
         '<b>固定分给他一页主讲（约 60 秒）</b> ＋ 题库 20 题里 5 题的成型答案',
         '路演视频里他讲的那 60 秒／题库文档里他写的那 5 题'],
    ],
)

# ---------------------------------------------------------------- 门禁
GATES = [
    dict(name='G1 选题冻结', stage='topic', pos=0.15,
         desc='一句话选题写出来 ＋ 参赛资格核验通过 ＋ 指导教师确认'),
    dict(name='G2 方案冻结', stage='team', pos=0.28,
         desc='人数与岗位定死 ＋ 问卷终稿 / 技术方案 / 接口契约一次定死'),
    dict(name='G3 主链路跑通', stage='run', pos=0.50,
         desc='demo 现场能跑（不认录屏）或 预调研信效度 α ≥ 0.7'),
    dict(name='G4 主体完成', stage='run', pos=0.72,
         desc='数据齐 / 功能齐，每张图表挂一句结论、每条结论挂数据出处'),
    dict(name='G5 材料定稿', stage='close', pos=0.88,
         desc='报告 / BP / 作品说明定稿，查重与盲审自查通过'),
    dict(name='G6 模拟答辩通过', stage='close', pos=0.97,
         desc='3 次计时演练 ＋ 20–30 条 Q&A 成型'),
]

# ---------------------------------------------------------------- 结项口径
CLOSING = {
    'DCH': dict(hard=[
        '结题报告：A 类研究报告 / B 类商业计划书 + 创业报告 / C 类运营数据与财务法务材料',
        '结题硬条件满足其一：学生第一作者论文（标注本项目资助）／发明专利 1 项／校级二等奖及以上或省级以上竞赛获奖',
        '<b>中国国际大学生创新大赛参赛佐证</b>（报名截图或省赛获奖证书）—— 缺这项不予结题',
        '中期检查已通过，整改意见有书面回复',
        '经费使用与票据合规，设备材料有台账',
    ], note='立项第一天就把结题条件倒推成任务，别等结题才发现没有成果佐证。'),
    'GCS': dict(hard=[
        '商业计划书定稿：技术方案 + 商业模式 + 三年财务预测三模块齐全',
        '网评盲审 PDF ≤50MB，查重 ≤15%',
        '用户验证证据：≥30 份目标用户问卷 或 ≥10 场深访，附原始记录',
        '路演 8 分钟 + 答辩 4 分钟，至少 3 次全流程计时演练',
        '知识产权归属清晰，涉密内容已脱敏',
    ], note='评委最爱问「这个数字怎么来的」——每个财务假设都要能回链到调研或试点数据。'),
    'DT': dict(hard=[
        '作品申报书（当年模板，作者与指导教师信息完整）',
        '作品文本：哲社类 ≤15000 字；自然学术论文 ≤8000 字；科技发明附研究报告',
        '附加材料：问卷、调研实录、图片、程序说明、获奖与采用证明',
        '2 名高级职称教师推荐 + 学校学籍、教务、科研部门审核确认',
        '资格核验：决赛当年 6 月 1 日前两年内完成，且非毕设、课程论文、学位论文、已获国家级奖励成果',
    ], note='哲社类拿不到实务部门盖章的落地证明，走到省赛基本止步；科技发明没有实物或可运行系统同理。'),
    'XT': dict(hard=[
        '项目申报表 + 创业计划书',
        '项目介绍 PPT 转 PDF，≤20 页（含封面封底）',
        '佐证材料合并为一个 PDF：营业执照、专利证书、实践成效、社会经济效益、带动就业',
        '查重 ≤15%，知识产权授权文件齐全；已注册项目须附股权结构',
        '现场展示 + 综合面试，按五组别口径准备',
    ], note='拿大挑的材料改个标题投小挑，是最常见的翻车点 —— 小挑看的是「事情做得实不实」。'),
    'C4': dict(hard=[
        '可运行 / 可播放的作品本体（含源文件与工程）',
        '设计说明文档 + 演示视频（按类目模板）',
        'AI 工具清单：仅用组委会指定国产免费工具，或自主知识产权工具',
        '原创性：本届时间窗内完成，不得一稿多投，版权属参赛作者',
        '含地图的作品须注明地图来源与审图号',
    ], note='6 个类目限定「中国古代建筑成就」（民居 / 官府 / 皇宫 / 桥梁，1911 年前），主题报错直接出局。'),
    'ZDB': dict(hard=[
        '报告正文 ≤65 页，按组委会字体、字号、行距排版；正文与附录分开提交',
        '附录三件套：调查过程照片 + AI 工具使用情况说明 + 数据分析编码脚本',
        '盲审要求：报告与 PPT 均不得出现参赛校与指导教师信息',
        '查重 ≤20%（>40% 按学术不端通报），提交前自查压到 15%',
        '参赛承诺书 + 团队信息，按截止时间提交',
    ], note='决赛 = 报告 50% + 展示答辩 50%（陈述 8 分钟 + 答辩 7 分钟），材料定稿后必须练到 8 分钟内讲完。'),
}


def strip_tags(s):
    s = re.sub(r'<br\s*/?>', '\n', str(s))
    s = re.sub(r'</?b>', '', s)
    return (s.replace('&amp;', '&').replace('&lt;', '<').replace('&gt;', '>')
             .replace('&nbsp;', ' '))


def build_comps():
    out = {}
    for key in ['DCH', 'GCS', 'DT', 'XT', 'C4', 'ZDB']:
        d = getattr(comps, key)
        m = META[key]
        out[key] = dict(
            key=key,
            short=m['short'], size=m['size'], cycle=m['cycle'], weeks=m['weeks'],
            one=m['one'], entry=m['entry'], risk=m['risk'],
            teamKey=m['teamKey'], topicTag=m['topicTag'], redline=m['redline'],
            title=d['title'], intro=d['intro'],
            req=[[k, v] for k, v in d['req']],
            roles=d['roles'],
            schedHead=d['sched_head'],
            sched=d['sched'],
            note=d['note'],
        )
    return out


def build_cards():
    out = {}
    for k, v in TG.CARDS.items():
        out[k] = dict(
            name=v['name'], head=v['head'],
            steps=[[t, list(items)] for t, items in v['steps']],
            mats=[list(r) for r in v['mats']],
            sched=[list(r) for r in v['sched']],
            qa=[list(r) for r in v['qa']],
            tip=v.get('tip', ''),
        )
    return out


def build_topics():
    raw = json.load(open(os.path.join(ROOT, 'working', '选题生成', 'topics_all.json'), encoding='utf-8'))
    keep = ['序号', '赛事', '专业类别', '选题名称', '方向', '适配院校', '院校落点',
            '选题背景要点', '可行性要点', '技术选型与落地', '课程对位', '验收物']
    out = []
    for t in raw:
        out.append({k: t.get(k, '') for k in keep})
    return out


def build_plan():
    """选题级落地方案：6 个技术栈模板 + 选题→栈映射 + 选题级覆盖。"""
    raw = json.load(open(os.path.join(ROOT, 'working', '选题生成', 'topics_all.json'), encoding='utf-8'))
    return EP.build_all(raw)


QUICK = ['老年助餐', '非遗文创', '审计风控', '农业物联网', 'AI 学习工具',
         '乡村振兴', '双碳低碳', '校园服务', '消费调研', '智慧文旅']


def main():
    data = dict(
        comps=build_comps(),
        order=['DCH', 'GCS', 'DT', 'XT', 'C4', 'ZDB'],
        cards=build_cards(),
        topics=build_topics(),
        plan=build_plan(),
        dev=DS.build_all(),
        defense=DK.build_all(),
        paper=PK.build_all(),
        coach=CK.build_all(),
        coachEv=CK.EV,
        team=TEAM,
        gates=GATES,
        closing=CLOSING,
        meta=dict(quickTags=QUICK, schools=['南京财经大学', '南京审计大学',
                                            '南京林业大学', '南京工业职业技术大学']),
    )

    payload = json.dumps(data, ensure_ascii=False, separators=(',', ':'))
    payload = payload.replace('</', '<\\/')  # 防 </script> 截断

    html = open(os.path.join(SRC, 'index.html'), encoding='utf-8').read()
    css = open(os.path.join(SRC, 'style.css'), encoding='utf-8').read()
    js = open(os.path.join(SRC, 'app.js'), encoding='utf-8').read()
    api = open(os.path.join(SRC, 'api.js'), encoding='utf-8').read()

    html = html.replace('/*__CSS__*/', css)
    html = html.replace('/*__DATA__*/', payload)
    html = html.replace('/*__API__*/', api)
    html = html.replace('/*__APP__*/', js)

    assert '/*__CSS__*/' not in html and '/*__DATA__*/' not in html
    assert '/*__APP__*/' not in html and '/*__API__*/' not in html

    with open(OUT, 'w', encoding='utf-8') as f:
        f.write(html)

    kb = os.path.getsize(OUT) / 1024
    print('OUT %s  %.1f KB' % (OUT, kb))
    print('topics=%d cards=%d comps=%d' % (len(data['topics']), len(data['cards']), len(data['comps'])))
    print('gates=%d closing=%d' % (len(data['gates']), len(data['closing'])))


if __name__ == '__main__':
    main()
