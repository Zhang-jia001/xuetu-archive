# -*- coding: utf-8 -*-
"""分组开发排期 · 企业级开发流程 × 队员配置

与 exec_plan.py 的分工：
  exec_plan.py   → 第一周装什么、学什么（环境与能力）
  dev_schedule.py → W1–Wn 谁在第几周做什么（按人排期）

任务挂两套坐标系：
  1. 技术手册章节（HB，10 节标准骨架）—— 学生拿手册就能对上
  2. 工程角色（ROLES，7 个）—— 排期按角色并行，人少时自动兼岗
"""

# ---------------------------------------------------------------- 工程角色
ROLES = [
    dict(k='arch', n='架构 / 队长', d='架构、接口契约、代码评审、关键卡点兜底', merge=''),
    dict(k='beA', n='后端 A · 核心域', d='主数据与主链路，最重的后端活', merge='arch'),
    dict(k='beB', n='后端 B · 支撑域', d='权限、异步、集成、非功能', merge='beA'),
    dict(k='fe', n='前端 / 交互', d='页面、联调、演示效果', merge='arch'),
    dict(k='data', n='数据 / 算法', d='数据处理、模型或统计、指标口径', merge='beA'),
    dict(k='qa', n='测试 / 文档', d='用例、缺陷、联调回归、材料排版', merge='arch'),
    dict(k='ops', n='部署 / 运维', d='环境、CI、容器、部署脚本', merge='arch'),
]

# 组队 tab 里的岗位 → 工程角色（可被用户在排期页手动改）
POST2ROLE = {
    '技术': 'beA', '调研': 'data', '数据': 'data',
    '文档': 'qa', '运营': 'fe', '答辩': 'arch',
}

# ---------------------------------------------------------------- 企业级流程红线
PROCESS = [
    dict(t='分支模型', d='main 只放能跑的版本且受保护；develop 是集成分支；每人一条 '
                          '<code>feature/{任务号}</code>，做完发合并请求，不直接推 main。'),
    dict(t='接口先行', d='W1 结束前把 <code>openapi.yaml</code> 冻结，前后端照契约并行开发。'
                          '契约改了先改文件、再通知对方，不许口头改。'),
    dict(t='合并门槛', d='每个合并请求至少 1 人 review ＋ CI 通过才能合。'
                          '自己审自己的代码，等于没有评审。'),
    dict(t='每日构建', d='每天下班前 develop 分支必须能起来。起不来当天修，不带病过夜。'),
    dict(t='周五评审', d='每周五 15 分钟／人现场演示本周产出 ＋ 10 分钟复盘（哪卡住、下周怎么改），'
                          '不接受「快好了」。'),
    dict(t='版本打标', d='G2 方案冻结打 v0.1，主链路跑通打 v0.5，功能齐打 v0.9，材料定稿打 v1.0。'
                          '每次打标留一份可运行的包。'),
    dict(t='手册回写', d='代码与技术手册不一致时以代码为准，当天回写手册。'
                          '答辩被问「手册里写的和你演示的不一样」是最难圆的一种。'),
]

# ---------------------------------------------------------------- 技术手册标准骨架
# 任务里的 book 字段就引这里的小节号；没有选题手册时，按这份骨架自己产出
HB = [
    ['§1', '项目概述与范围', '一句话选题、边界（做什么 / 不做什么）、验收物'],
    ['§2', '系统架构', '架构图、模块划分、依赖方向、技术选型理由'],
    ['§3', '数据模型', 'ER 图、表结构、字段口径、索引、种子数据'],
    ['§4', '接口契约', 'OpenAPI、错误码、鉴权方式、分页与幂等'],
    ['§5', '核心模块', '主数据、主链路、异步、算法／统计，每块写清输入输出'],
    ['§6', '非功能', '性能目标、安全与权限、日志与可观测、容量估算'],
    ['§7', '前端与交互', '页面清单、状态流转、异常态、演示路径'],
    ['§8', '部署与运维', '环境清单、compose／脚本、一键启动、回滚'],
    ['§9', '测试与验收', '用例清单、覆盖范围、压测口径、验收标准'],
    ['§10', '风险与排障', '已知风险、常见故障与定位步骤、兜底方案'],
]

# ---------------------------------------------------------------- 任务库
# est=1 表示占该角色 1 周；dep 为前置任务 id；book 引 HB 小节

TASKS = {}

# ============================================================ 微服务后端
TASKS['microsvc'] = [
    dict(id='ms01', mod='M0 立项与设计', t='定架构与模块边界', role='arch', est=1, dep=[],
         out='架构图 ＋ 模块清单（ADR-01）', dod='模块之间无循环依赖，依赖方向单向，评审过一次',
         book='§2 系统架构'),
    dict(id='ms02', mod='M0 立项与设计', t='冻结 OpenAPI 接口契约', role='arch', est=1, dep=['ms01'],
         out='openapi.yaml ＋ 错误码表', dod='前后端都能按契约 mock 出数据，接口一个不少',
         book='§4 接口契约'),
    dict(id='ms03', mod='M0 立项与设计', t='建仓库、分支规范与 CI', role='ops', est=1, dep=[],
         out='仓库 ＋ main/develop/feature 分支 ＋ CI 跑通一次', dod='推一个分支能自动构建，main 已设保护',
         book='§8 部署与运维'),
    dict(id='ms04', mod='M0 立项与设计', t='数据库 DDL 与种子数据', role='beA', est=1, dep=['ms01'],
         out='建表脚本 ＋ 20 条以上种子数据', dod='一条命令能重建库，字符集 utf8mb4，外键关系正确',
         book='§3 数据模型'),
    dict(id='ms05', mod='M0 立项与设计', t='中间件环境编排', role='ops', est=1, dep=['ms03'],
         out='docker-compose.yml（MySQL/Redis/RocketMQ/Nacos）', dod='新机器上 compose up 一次起全，端口不冲突',
         book='§8 部署与运维'),
    dict(id='ms06', mod='M0 立项与设计', t='前端脚手架与路由骨架', role='fe', est=1, dep=['ms02'],
         out='Vue3 工程 ＋ 页面清单 ＋ 空路由', dod='所有页面能点到，接口用 mock 有数据',
         book='§7 前端与交互'),
    dict(id='ms07', mod='M0 立项与设计', t='测试骨架与接口集合', role='qa', est=1, dep=['ms02'],
         out='Postman／Apifox 集合 ＋ 用例清单', dod='每个接口至少 1 正例 1 反例，能一键跑',
         book='§9 测试与验收'),

    dict(id='ms08', mod='M1 主数据域', t='主数据 CRUD 后端', role='beA', est=1, dep=['ms04', 'ms05'],
         out='设备／台账模块的增删改查 ＋ 分页筛选', dod='Postman 全绿，异常有统一错误码',
         book='§5 核心模块'),
    dict(id='ms09', mod='M1 主数据域', t='主数据页面与联调', role='fe', est=1, dep=['ms08'],
         out='列表页 ＋ 表单页，接真实接口', dod='增删改查在页面上能走通，空态与错误态都有',
         book='§7 前端与交互'),
    dict(id='ms10', mod='M1 主数据域', t='认证与角色权限', role='beB', est=1, dep=['ms08'],
         out='JWT 登录 ＋ 角色权限拦截', dod='未登录访问被拦，越权操作返回 403 并留日志',
         book='§6 非功能'),
    dict(id='ms11', mod='M1 主数据域', t='主数据域自动化测试', role='qa', est=1, dep=['ms09'],
         out='接口用例集 ＋ 缺陷清单', dod='覆盖正常／边界／异常三类，缺陷有复现步骤',
         book='§9 测试与验收'),

    dict(id='ms12', mod='M2 业务主链路', t='主链路后端实现', role='beA', est=1, dep=['ms08'],
         out='核心业务接口（工单／派单／审批等）', dod='主流程一条链能跑通，事务边界清晰',
         book='§5 核心模块'),
    dict(id='ms13', mod='M2 业务主链路', t='状态机与超时补偿', role='beB', est=1, dep=['ms12'],
         out='状态流转表 ＋ 定时补偿任务', dod='非法状态跳转被拒，超时能自动回收',
         book='§5 核心模块'),
    dict(id='ms14', mod='M2 业务主链路', t='主链路前端流程页', role='fe', est=1, dep=['ms12'],
         out='流程页 ＋ 状态可视化', dod='从发起到结束全程可点，状态变化有反馈',
         book='§7 前端与交互'),
    dict(id='ms15', mod='M2 业务主链路', t='主链路联调与回归', role='qa', est=1, dep=['ms14', 'ms13'],
         out='联调记录 ＋ 回归用例', dod='主链路连续跑 10 次不失败',
         book='§9 测试与验收'),

    dict(id='ms16', mod='M3 异步与集成', t='消息队列生产与消费', role='beB', est=1, dep=['ms12'],
         out='RocketMQ 生产者／消费者 ＋ 重试与死信', dod='消息丢了能查到，重复消费幂等',
         book='§5 核心模块'),
    dict(id='ms17', mod='M3 异步与集成', t='统计／预测服务', role='data', est=1, dep=['ms08'],
         out='统计接口或预测模型 ＋ 结果表', dod='指标口径写进文档，结果可复现',
         book='§5 核心模块'),
    dict(id='ms18', mod='M3 异步与集成', t='统计看板前端', role='fe', est=1, dep=['ms17'],
         out='图表看板 ＋ 筛选联动', dod='每张图挂一句结论，数据能对上',
         book='§7 前端与交互'),
    dict(id='ms19', mod='M3 异步与集成', t='全链路打通（网关＋注册＋消息）', role='arch', est=1,
         dep=['ms15', 'ms16'],
         out='一条端到端演示路径', dod='重启全部服务后仍能一键复现这条路径',
         book='§2 系统架构'),
    dict(id='ms20', mod='M3 异步与集成', t='压测脚本与基线', role='qa', est=1, dep=['ms19'],
         out='压测脚本 ＋ QPS／P99／错误率三条曲线', dod='有基线数字，瓶颈定位到具体接口',
         book='§9 测试与验收'),

    dict(id='ms21', mod='M4 质量与交付', t='核心域单测补齐', role='beA', est=1, dep=['ms13'],
         out='单测覆盖核心域 ≥60%', dod='CI 里有覆盖率数字，不是口头说测过',
         book='§9 测试与验收'),
    dict(id='ms22', mod='M4 质量与交付', t='限流熔断与分布式事务验证', role='beB', est=1, dep=['ms16'],
         out='Sentinel 规则 ＋ 事务回滚验证记录', dod='故意让下游失败，能降级不雪崩',
         book='§6 非功能'),
    dict(id='ms23', mod='M4 质量与交付', t='一键部署与部署文档', role='ops', est=1, dep=['ms19'],
         out='compose 全栈 ＋ 部署手册', dod='换一台电脑照文档能起，含故障排查',
         book='§8 部署与运维'),
    dict(id='ms24', mod='M4 质量与交付', t='手册回写与演示脚本', role='arch', est=1, dep=['ms23', 'ms20'],
         out='技术手册终稿 ＋ 8 分钟演示脚本', dod='手册与实现逐条对照过，无对不上的地方',
         book='§1 §10'),
    dict(id='ms25', mod='M4 质量与交付', t='答辩材料与技术问答', role='qa', est=1, dep=['ms24'],
         out='技术部分 PPT ＋ 20 题问答', dod='每题能在 60 秒内答完并给出证据',
         book='§10 风险与排障'),
]

# ============================================================ AI 应用 / 智能体
TASKS['ai_agent'] = [
    dict(id='ag01', mod='M0 设计与底座', t='定边界与场景清单', role='arch', est=1, dep=[],
         out='场景清单（能做什么／不做什么）＋ 成功判定标准', dod='每个场景有可量化的判定，不写「效果好」',
         book='§1 项目概述与范围'),
    dict(id='ag02', mod='M0 设计与底座', t='冻结 Prompt 与工具契约', role='arch', est=1, dep=['ag01'],
         out='Prompt 版本库 ＋ 工具 JSON Schema', dod='同一输入跑 5 次结果稳定，工具参数有校验',
         book='§4 接口契约'),
    dict(id='ag03', mod='M0 设计与底座', t='仓库、分支与密钥管理', role='ops', est=1, dep=[],
         out='仓库 ＋ .env 模板 ＋ 密钥不进代码', dod='换个环境改 .env 就能跑，仓库无明文 key',
         book='§8 部署与运维'),
    dict(id='ag04', mod='M0 设计与底座', t='语料入库与切分方案', role='data', est=1, dep=['ag01'],
         out='原始语料 ＋ 切分规则 ＋ 元数据表', dod='每份文档可溯源到原始文件与页码',
         book='§3 数据模型'),
    dict(id='ag05', mod='M0 设计与底座', t='服务脚手架与最小链路', role='beA', est=1, dep=['ag02'],
         out='FastAPI 服务 ＋ /health ＋ /chat', dod='curl 能调通并返回结构化结果',
         book='§5 核心模块'),
    dict(id='ag06', mod='M0 设计与底座', t='前端对话界面骨架', role='fe', est=1, dep=['ag02'],
         out='对话页 ＋ 流式输出 ＋ 引用展示位', dod='能连续多轮，历史不丢',
         book='§7 前端与交互'),
    dict(id='ag07', mod='M0 设计与底座', t='评测集与判定标准', role='qa', est=1, dep=['ag01'],
         out='50 条评测集（问题／期望／判定）', dod='判定可复算，不靠人肉印象',
         book='§9 测试与验收'),

    dict(id='ag08', mod='M1 检索与生成', t='RAG 检索链落地', role='beA', est=1, dep=['ag04', 'ag05'],
         out='解析→切分→向量化→检索→生成＋引用', dod='每条回答能给出处，找不到时明确拒答',
         book='§5 核心模块'),
    dict(id='ag09', mod='M1 检索与生成', t='检索质量优化', role='data', est=1, dep=['ag08'],
         out='召回率对比表（改前／改后）', dod='至少两种切分或检索策略对比过，有数字',
         book='§5 核心模块'),
    dict(id='ag10', mod='M1 检索与生成', t='对话页联调与异常态', role='fe', est=1, dep=['ag08'],
         out='流式输出 ＋ 加载／超时／无结果三态', dod='断网、超时、空结果都有明确提示',
         book='§7 前端与交互'),
    dict(id='ag11', mod='M1 检索与生成', t='首轮评测与归因', role='qa', est=1, dep=['ag07', 'ag08'],
         out='评测报告：准确率 ＋ 错误归因', dod='错误能归到「没召回」还是「答偏了」',
         book='§9 测试与验收'),

    dict(id='ag12', mod='M2 工具与智能体', t='工具集开发', role='beB', est=1, dep=['ag05'],
         out='3–5 个可调用工具（查库／算数／读文件等）', dod='每个工具有描述、参数校验、失败兜底',
         book='§5 核心模块'),
    dict(id='ag13', mod='M2 工具与智能体', t='Agent 编排与状态管理', role='beA', est=1, dep=['ag12'],
         out='编排逻辑 ＋ 会话记忆 ＋ 中断恢复', dod='多步任务能跑完，中途失败能续',
         book='§5 核心模块'),
    dict(id='ag14', mod='M2 工具与智能体', t='MCP 服务接入', role='beB', est=1, dep=['ag12'],
         out='MCP Server ＋ 客户端接入', dod='工具通过 MCP 调通，日志能看到往返',
         book='§4 接口契约'),
    dict(id='ag15', mod='M2 工具与智能体', t='工具调用页与调试台', role='fe', est=1, dep=['ag13'],
         out='调用过程可视化（选了哪个工具、耗时）', dod='演示时能看出「它为什么这么答」',
         book='§7 前端与交互'),
    dict(id='ag16', mod='M2 工具与智能体', t='工具与编排的异常测试', role='qa', est=1, dep=['ag14'],
         out='异常用例集（参数错／超时／越权）', dod='每种异常都有明确的用户提示',
         book='§9 测试与验收'),

    dict(id='ag17', mod='M3 安全与成本', t='输入输出护栏', role='beB', est=1, dep=['ag13'],
         out='敏感词／越权／注入拦截规则', dod='攻击样本拦得住，正常样本不误杀',
         book='§6 非功能'),
    dict(id='ag18', mod='M3 安全与成本', t='成本与延迟统计', role='data', est=1, dep=['ag13'],
         out='每次调用 token 与耗时统计表', dod='能说清一次问答花多少钱、多少秒',
         book='§6 非功能'),
    dict(id='ag19', mod='M3 安全与成本', t='并发与限流', role='ops', est=1, dep=['ag17'],
         out='限流配置 ＋ 压测结果', dod='过载时不雪崩，有排队或降级',
         book='§6 非功能'),
    dict(id='ag20', mod='M3 安全与成本', t='全链路演练', role='arch', est=1, dep=['ag16', 'ag19'],
         out='一条端到端演示路径（含失败演示）', dod='断网也能用本地模型兜住',
         book='§2 系统架构'),

    dict(id='ag21', mod='M4 交付', t='评测集扩到 100 条并复测', role='qa', est=1, dep=['ag11'],
         out='两轮评测对比', dod='指标有提升且能解释提升来自哪次改动',
         book='§9 测试与验收'),
    dict(id='ag22', mod='M4 交付', t='部署与一键启动', role='ops', est=1, dep=['ag20'],
         out='部署脚本 ＋ 运行手册', dod='新机器 30 分钟内起来',
         book='§8 部署与运维'),
    dict(id='ag23', mod='M4 交付', t='手册回写与演示脚本', role='arch', est=1, dep=['ag21', 'ag22'],
         out='技术手册终稿 ＋ 8 分钟演示脚本', dod='手册与实现一致，演示脚本卡到秒',
         book='§1 §10'),
    dict(id='ag24', mod='M4 交付', t='答辩材料与技术问答', role='qa', est=1, dep=['ag23'],
         out='技术 PPT ＋ 20 题问答', dod='每题 60 秒内答完并给证据',
         book='§10 风险与排障'),
]

# ============================================================ 数据与检索
TASKS['data'] = [
    dict(id='dt01', mod='M0 口径与数据源', t='定指标口径与分析计划', role='arch', est=1, dep=[],
         out='指标字典 ＋ 分析计划（要回答哪几个问题）', dod='每个指标有定义、公式、数据来源',
         book='§1 项目概述与范围'),
    dict(id='dt02', mod='M0 口径与数据源', t='数据源盘点与授权', role='data', est=1, dep=['dt01'],
         out='数据源清单（来源／字段／频率／授权）', dod='每个源都能合法拿到，含采集许可说明',
         book='§3 数据模型'),
    dict(id='dt03', mod='M0 口径与数据源', t='库表与存储设计', role='beA', est=1, dep=['dt02'],
         out='表结构 ＋ 原始层／清洗层分层', dod='原始数据只读留档，清洗可重跑',
         book='§3 数据模型'),
    dict(id='dt04', mod='M0 口径与数据源', t='仓库、分支与可复现环境', role='ops', est=1, dep=[],
         out='仓库 ＋ requirements 锁版本 ＋ 一键跑通', dod='换机器一条命令能复现环境',
         book='§8 部署与运维'),
    dict(id='dt05', mod='M0 口径与数据源', t='接口与看板骨架', role='fe', est=1, dep=['dt01'],
         out='看板骨架 ＋ 图表占位', dod='筛选项与图表位置先定死，后面只换数据',
         book='§7 前端与交互'),
    dict(id='dt06', mod='M0 口径与数据源', t='质检规则与验收标准', role='qa', est=1, dep=['dt01'],
         out='质检清单（缺失／异常／重复／口径冲突）', dod='每条规则有判定方法和处理动作',
         book='§9 测试与验收'),

    dict(id='dt07', mod='M1 采集与清洗', t='采集脚本与调度', role='data', est=1, dep=['dt02', 'dt03'],
         out='采集脚本 ＋ 采集日志（时间／条数／失败）', dod='能重跑，失败有重试和告警',
         book='§5 核心模块'),
    dict(id='dt08', mod='M1 采集与清洗', t='清洗与标准化', role='beA', est=1, dep=['dt07'],
         out='清洗脚本 ＋ 清洗前后对照表', dod='删了多少条、为什么删都有记录',
         book='§5 核心模块'),
    dict(id='dt09', mod='M1 采集与清洗', t='采集接口与增量更新', role='beB', est=1, dep=['dt07'],
         out='增量同步接口', dod='重复跑不产生重复数据（幂等）',
         book='§4 接口契约'),
    dict(id='dt10', mod='M1 采集与清洗', t='数据概览页', role='fe', est=1, dep=['dt08'],
         out='总量、时间范围、缺失率三块概览', dod='数字与清洗结果一致',
         book='§7 前端与交互'),
    dict(id='dt11', mod='M1 采集与清洗', t='数据质检报告', role='qa', est=1, dep=['dt08'],
         out='质检报告（问题清单 ＋ 处理结果）', dod='报告能被第三方照着复核',
         book='§9 测试与验收'),

    dict(id='dt12', mod='M2 分析与建模', t='描述统计与分布', role='data', est=1, dep=['dt08'],
         out='描述统计表 ＋ 分布图', dod='异常值与极端值单独说明',
         book='§5 核心模块'),
    dict(id='dt13', mod='M2 分析与建模', t='推断／相关／分组对比', role='data', est=1, dep=['dt12'],
         out='检验结果 ＋ 前提假设检验', dod='方法选择有理由，前提不满足要说清改用什么',
         book='§5 核心模块'),
    dict(id='dt14', mod='M2 分析与建模', t='指标计算服务化', role='beA', est=1, dep=['dt12'],
         out='指标接口（按维度聚合）', dod='同一口径在页面和报告里数字一致',
         book='§4 接口契约'),
    dict(id='dt15', mod='M2 分析与建模', t='分析结论页', role='fe', est=1, dep=['dt14'],
         out='每图一结论 ＋ 口径说明悬浮', dod='不看文字也能看懂图在说什么',
         book='§7 前端与交互'),
    dict(id='dt16', mod='M2 分析与建模', t='结论复核', role='qa', est=1, dep=['dt13'],
         out='结论—数据—出处对照表', dod='每条结论都能追到具体图表和原始数据',
         book='§9 测试与验收'),

    dict(id='dt17', mod='M3 看板与交付', t='看板性能与交互优化', role='fe', est=1, dep=['dt15'],
         out='筛选联动 ＋ 加载优化', dod='1 万条数据下切换筛选 2 秒内响应',
         book='§7 前端与交互'),
    dict(id='dt18', mod='M3 看板与交付', t='数据服务部署', role='ops', est=1, dep=['dt14'],
         out='服务部署 ＋ 定时任务', dod='断网可离线演示，任务失败有通知',
         book='§8 部署与运维'),
    dict(id='dt19', mod='M3 看板与交付', t='可复现验证', role='arch', est=1, dep=['dt11', 'dt16'],
         out='从原始数据到结论的一键复现脚本', dod='换个人跑出同样结果',
         book='§2 系统架构'),
    dict(id='dt20', mod='M3 看板与交付', t='技术手册终稿', role='arch', est=1, dep=['dt19'],
         out='手册 ＋ 演示脚本', dod='数据字典、口径、局限三节齐全',
         book='§1 §10'),
    dict(id='dt21', mod='M3 看板与交付', t='答辩材料与问答', role='qa', est=1, dep=['dt20'],
         out='技术 PPT ＋ 问答', dod='被追问口径时能当场翻到出处',
         book='§10 风险与排障'),
]

# ============================================================ 物联网 / 嵌入式
TASKS['iot'] = [
    dict(id='io01', mod='M0 方案与硬件', t='定场景与硬件选型', role='arch', est=1, dep=[],
         out='BOM 表（型号／数量／单价）＋ 系统框图', dod='每个传感器有量程与精度，成本算到元',
         book='§2 系统架构'),
    dict(id='io02', mod='M0 方案与硬件', t='硬件到货与接线验证', role='beB', est=1, dep=['io01'],
         out='接线图 ＋ 每个传感器读数截图', dod='逐个标定过，数值方向与量级正确',
         book='§3 数据模型'),
    dict(id='io03', mod='M0 方案与硬件', t='通信协议与数据格式', role='arch', est=1, dep=['io01'],
         out='上报字段表（设备号／指标／值／时间戳）', dod='字段一次定死，后端和固件都照这个来',
         book='§4 接口契约'),
    dict(id='io04', mod='M0 方案与硬件', t='后端骨架与建表', role='beA', est=1, dep=['io03'],
         out='设备表／数据表／告警表 ＋ 接收接口', dod='模拟一条数据能落库',
         book='§3 数据模型'),
    dict(id='io05', mod='M0 方案与硬件', t='Broker 与本地网络', role='ops', est=1, dep=['io03'],
         out='EMQX 容器 ＋ 设备接入账号', dod='设备能连上并保持心跳 30 分钟不掉',
         book='§8 部署与运维'),
    dict(id='io06', mod='M0 方案与硬件', t='看板骨架', role='fe', est=1, dep=['io03'],
         out='实时值卡片 ＋ 曲线占位', dod='订阅通道打通，能收到假数据',
         book='§7 前端与交互'),
    dict(id='io07', mod='M0 方案与硬件', t='硬件复现文档', role='qa', est=1, dep=['io02'],
         out='接线图 ＋ 烧录步骤 ＋ 常见问题', dod='别人照文档能复现一台',
         book='§9 测试与验收'),

    dict(id='io08', mod='M1 采集与上云', t='固件采集与上报', role='beB', est=1, dep=['io02', 'io05'],
         out='固件（采集→打包→上报→重连）', dod='断网 1 分钟能自动重连并补传',
         book='§5 核心模块'),
    dict(id='io09', mod='M1 采集与上云', t='服务端订阅与落库', role='beA', est=1, dep=['io04', 'io08'],
         out='订阅端 ＋ 落库 ＋ 去重', dod='连续跑 30 分钟不丢数、不重复',
         book='§5 核心模块'),
    dict(id='io10', mod='M1 采集与上云', t='实时曲线与设备列表', role='fe', est=1, dep=['io09'],
         out='实时曲线 ＋ 设备状态列表', dod='数据延迟 3 秒内，断线变色',
         book='§7 前端与交互'),
    dict(id='io11', mod='M1 采集与上云', t='端到端联调', role='arch', est=1, dep=['io09'],
         out='一条「设备→库→页面」的演示路径', dod='重启后自动恢复，不需要人工干预',
         book='§2 系统架构'),
    dict(id='io12', mod='M1 采集与上云', t='采集稳定性测试', role='qa', est=1, dep=['io10'],
         out='24 小时运行记录（丢包率／掉线次数）', dod='有数字，异常有归因',
         book='§9 测试与验收'),

    dict(id='io13', mod='M2 告警与控制', t='告警规则引擎', role='beA', est=1, dep=['io09'],
         out='阈值／离线两类规则 ＋ 告警表', dod='规则可配置，不写死在代码里',
         book='§5 核心模块'),
    dict(id='io14', mod='M2 告警与控制', t='告警通知与升级', role='beB', est=1, dep=['io13'],
         out='通知渠道（站内／钉钉或邮件）＋ 升级策略', dod='超时未处理能升级，有记录',
         book='§5 核心模块'),
    dict(id='io15', mod='M2 告警与控制', t='告警页与处置闭环', role='fe', est=1, dep=['io13'],
         out='告警列表 ＋ 处置动作', dod='确认／忽略／转工单三态可走通',
         book='§7 前端与交互'),
    dict(id='io16', mod='M2 告警与控制', t='故障注入测试', role='qa', est=1, dep=['io14'],
         out='拔线／遮挡／断电三类故障记录', dod='每类故障 10 秒内页面有反应',
         book='§9 测试与验收'),
    dict(id='io17', mod='M2 告警与控制', t='数据补偿与离线缓存', role='data', est=1, dep=['io09'],
         out='断网期间本地缓存 ＋ 恢复后补传验证', dod='补传后数据完整无重复',
         book='§5 核心模块'),

    dict(id='io18', mod='M3 交付', t='部署与离线演示方案', role='ops', est=1, dep=['io11'],
         out='本地一键启动 ＋ 热点演示脚本', dod='现场无网也能完整演示',
         book='§8 部署与运维'),
    dict(id='io19', mod='M3 交付', t='功耗与成本核算', role='data', est=1, dep=['io12'],
         out='单节点日耗电与月度成本估算', dod='算法写清，评委问能当场算',
         book='§6 非功能'),
    dict(id='io20', mod='M3 交付', t='手册回写与演示', role='arch', est=1, dep=['io18'],
         out='技术手册终稿 ＋ 8 分钟演示脚本', dod='含现场故障注入环节',
         book='§1 §10'),
    dict(id='io21', mod='M3 交付', t='答辩材料与问答', role='qa', est=1, dep=['io20'],
         out='技术 PPT ＋ 问答', dod='硬件类追问（选型／成本／稳定性）都有数',
         book='§10 风险与排障'),
]

# ============================================================ 网络与安全
TASKS['sec'] = [
    dict(id='sc01', mod='M0 边界与靶场', t='定防护目标与合规边界', role='arch', est=1, dep=[],
         out='威胁模型 ＋ 合规声明（数据来源／授权范围）', dod='明确不碰的东西写进文档',
         book='§1 项目概述与范围'),
    dict(id='sc02', mod='M0 边界与靶场', t='靶场与测试环境', role='ops', est=1, dep=[],
         out='本地靶场 ＋ 抓包环境', dod='完全离线可控，不连外网',
         book='§8 部署与运维'),
    dict(id='sc03', mod='M0 边界与靶场', t='漏洞复现与 PoC', role='beB', est=1, dep=['sc02'],
         out='3 份 PoC（步骤／请求／响应／截图）', dod='每份能重复复现 3 次以上',
         book='§3 数据模型'),
    dict(id='sc04', mod='M0 边界与靶场', t='防护架构设计', role='arch', est=1, dep=['sc01'],
         out='防护架构图 ＋ 检测点清单', dod='入口／权限／脱敏／审计四层都有落点',
         book='§2 系统架构'),
    dict(id='sc05', mod='M0 边界与靶场', t='检测服务骨架', role='beA', est=1, dep=['sc04'],
         out='检测接口 ＋ 风险分输出', dod='每条判定有依据可解释',
         book='§5 核心模块'),
    dict(id='sc06', mod='M0 边界与靶场', t='指标定义与样本准备', role='qa', est=1, dep=['sc01'],
         out='检出率／误报率定义 ＋ 攻击与正常样本集', dod='样本标注有依据，双人交叉核对',
         book='§9 测试与验收'),

    dict(id='sc07', mod='M1 检测能力', t='核心检测逻辑', role='beA', est=1, dep=['sc05'],
         out='规则或模型 ＋ 判定日志', dod='规则与攻击类型一一对应',
         book='§5 核心模块'),
    dict(id='sc08', mod='M1 检测能力', t='特征与阈值调优', role='data', est=1, dep=['sc07'],
         out='阈值选择依据 ＋ 对比表', dod='阈值变动对指标的影响有数字',
         book='§5 核心模块'),
    dict(id='sc09', mod='M1 检测能力', t='审计与留痕', role='beB', est=1, dep=['sc07'],
         out='审计表 ＋ 查询接口', dod='每条判定可回溯到原始请求',
         book='§3 数据模型'),
    dict(id='sc10', mod='M1 检测能力', t='检测后台界面', role='fe', est=1, dep=['sc09'],
         out='告警列表 ＋ 判定详情页', dod='能从一个告警点回原始请求',
         book='§7 前端与交互'),
    dict(id='sc11', mod='M1 检测能力', t='攻防对照实验', role='qa', est=1, dep=['sc08'],
         out='混淆矩阵 ＋ 漏检归因', dod='检出率与误报率同时报，不只报一个',
         book='§9 测试与验收'),

    dict(id='sc12', mod='M2 加固与验证', t='接入真实链路', role='beA', est=1, dep=['sc09'],
         out='检测挂到登录或核心接口上', dod='不影响正常请求性能（有对比数字）',
         book='§4 接口契约'),
    dict(id='sc13', mod='M2 加固与验证', t='权限与脱敏', role='beB', est=1, dep=['sc12'],
         out='最小权限 ＋ 敏感字段脱敏', dod='越权访问被拦，脱敏后不可还原',
         book='§6 非功能'),
    dict(id='sc14', mod='M2 加固与验证', t='性能损耗测试', role='qa', est=1, dep=['sc12'],
         out='加检测前后的延迟／吞吐对比', dod='损耗控制在可接受范围并说明代价',
         book='§6 非功能'),
    dict(id='sc15', mod='M2 加固与验证', t='红队自测', role='data', est=1, dep=['sc13'],
         out='20 条攻击样本 ＋ 拦截结果', dod='漏掉的样本有改进动作',
         book='§9 测试与验收'),
    dict(id='sc16', mod='M2 加固与验证', t='监控面板', role='fe', est=1, dep=['sc14'],
         out='拦截量／误报量／耗时三块', dod='数字与日志一致',
         book='§7 前端与交互'),

    dict(id='sc17', mod='M3 交付', t='合规与伦理复核', role='arch', est=1, dep=['sc15'],
         out='合规说明 ＋ 数据留存策略', dod='有书面边界，不给自己留隐患',
         book='§6 非功能'),
    dict(id='sc18', mod='M3 交付', t='部署与离线演示', role='ops', est=1, dep=['sc12'],
         out='一键启动 ＋ 演示脚本', dod='现场完全离线可演示',
         book='§8 部署与运维'),
    dict(id='sc19', mod='M3 交付', t='测试报告与技术手册', role='qa', est=1, dep=['sc17'],
         out='测试报告 ＋ 手册终稿', dod='方法、样本、结果、局限四段齐全',
         book='§9 测试与验收'),
    dict(id='sc20', mod='M3 交付', t='答辩材料与问答', role='arch', est=1, dep=['sc19'],
         out='技术 PPT ＋ 问答（含伦理追问）', dod='「你凭什么说防住了」能给出实验数据',
         book='§10 风险与排障'),
]

# ============================================================ 数媒 / 可视化
TASKS['media'] = [
    dict(id='md01', mod='M0 方向与规范', t='对标与视觉方向', role='arch', est=1, dep=[],
         out='5 个对标拆解 ＋ 3 个关键词 ＋ 情绪板', dod='每个对标写清「学它哪一点」',
         book='§1 项目概述与范围'),
    dict(id='md02', mod='M0 方向与规范', t='视觉规范', role='arch', est=1, dep=['md01'],
         out='色板／字阶／栅格／组件库', dod='队友照规范能做出一致的页面',
         book='§7 前端与交互'),
    dict(id='md03', mod='M0 方向与规范', t='内容与数据准备', role='data', est=1, dep=['md01'],
         out='文案／数据／素材清单', dod='素材有版权来源说明',
         book='§3 数据模型'),
    dict(id='md04', mod='M0 方向与规范', t='工程与版本管理', role='ops', est=1, dep=[],
         out='设计文件版本 ＋ 导出规范', dod='命名与版本可追溯，不出现「最终版2」',
         book='§8 部署与运维'),
    dict(id='md05', mod='M0 方向与规范', t='核心三屏高保真', role='fe', est=1, dep=['md02'],
         out='3 个核心界面或分镜', dod='每屏一句「要让人看到什么」',
         book='§5 核心模块'),
    dict(id='md06', mod='M0 方向与规范', t='验收清单', role='qa', est=1, dep=['md01'],
         out='一致性／可读性／30 秒测试清单', dod='每条可判定，不写「好看」',
         book='§9 测试与验收'),

    dict(id='md07', mod='M1 主体设计', t='信息架构与流程', role='arch', est=1, dep=['md05'],
         out='流程图 ＋ 页面清单', dod='主路径不超过 4 步',
         book='§2 系统架构'),
    dict(id='md08', mod='M1 主体设计', t='主体界面与组件', role='fe', est=1, dep=['md07'],
         out='全部页面 ＋ 组件复用', dod='改一处规范，全站跟着变',
         book='§5 核心模块'),
    dict(id='md09', mod='M1 主体设计', t='数据可视化实现', role='data', est=1, dep=['md03'],
         out='图表 ＋ 图注 ＋ 数据源', dod='每张图不看文字也能懂结论',
         book='§5 核心模块'),
    dict(id='md10', mod='M1 主体设计', t='动效与交互', role='beA', est=1, dep=['md08'],
         out='3 处关键动效 ＋ 可点原型', dod='动效服务于状态变化，不抢戏',
         book='§7 前端与交互'),
    dict(id='md11', mod='M1 主体设计', t='一致性走查', role='qa', est=1, dep=['md08'],
         out='走查问题清单 ＋ 修复确认', dod='圆角／间距／字号全部统一',
         book='§9 测试与验收'),

    dict(id='md12', mod='M2 叙事与包装', t='叙事结构', role='arch', est=1, dep=['md08'],
         out='问题→发现→方案→验证 四段叙事', dod='30 秒能讲完主线',
         book='§1 项目概述与范围'),
    dict(id='md13', mod='M2 叙事与包装', t='作品说明页', role='fe', est=1, dep=['md12'],
         out='说明页（含过程稿对比）', dod='过程稿与终稿能看出迭代',
         book='§7 前端与交互'),
    dict(id='md14', mod='M2 叙事与包装', t='演示素材', role='data', est=1, dep=['md09'],
         out='演示视频或可点原型', dod='不依赖网络，本地能播',
         book='§6 非功能'),
    dict(id='md15', mod='M2 叙事与包装', t='盲测与修改', role='qa', est=1, dep=['md13'],
         out='3 人 30 秒盲测记录 ＋ 改动清单', dod='3 人中 2 人能说对这是什么',
         book='§9 测试与验收'),
    dict(id='md16', mod='M2 叙事与包装', t='答辩视觉', role='fe', est=1, dep=['md13'],
         out='答辩 PPT 视觉', dod='一页一个观点，投屏后排能看清',
         book='§7 前端与交互'),

    dict(id='md17', mod='M3 交付', t='导出与压缩', role='ops', est=1, dep=['md14'],
         out='PDF／视频／图片三套交付件', dod='体积与清晰度都在提交要求内',
         book='§8 部署与运维'),
    dict(id='md18', mod='M3 交付', t='设计说明与技术手册', role='arch', est=1, dep=['md15'],
         out='设计说明（规范／决策／取舍）', dod='每个设计决策有理由，不是「我觉得好看」',
         book='§1 §10'),
    dict(id='md19', mod='M3 交付', t='终版校对', role='qa', est=1, dep=['md17'],
         out='校对记录（错字／对齐／版权）', dod='错字为零，素材版权可追',
         book='§9 测试与验收'),
    dict(id='md20', mod='M3 交付', t='答辩演练', role='arch', est=1, dep=['md18'],
         out='3 次计时演练记录', dod='每次不超时，问答不卡壳',
         book='§10 风险与排障'),
]

# ============================================================ 商科 · 调研与数据分析
# 角色语义在报告轨的映射：arch=研究设计/队长，beA=问卷与执行，data=统计分析，
# fe=图表与可视化，qa=文档与材料，ops=工具环境
TASKS['survey'] = [
    dict(id='sv01', mod='M0 研究设计', t='研究问题与假设定稿', role='arch', est=1, dep=[],
         out='一页纸研究问题 ＋ 假设清单', dod='每条假设可被数据证实/证伪，外行能复述',
         book='§1 项目概述与范围'),
    dict(id='sv02', mod='M0 研究设计', t='问卷设计与定稿', role='beA', est=1, dep=['sv01'],
         out='问卷终稿（量表/行为/背景三段）', dod='每条假设至少 2 道题对应，无歧义题与诱导题',
         book='§5 核心模块'),
    dict(id='sv03', mod='M0 研究设计', t='预调研与废题替换', role='beA', est=1, dep=['sv02'],
         out='30 份预调研数据 ＋ 题项修订记录', dod='废题全部替换，逻辑跳转自测通过',
         book='§9 测试与验收'),
    dict(id='sv04', mod='M0 研究设计', t='数据环境与清洗规则', role='ops', est=1, dep=['sv03'],
         out='清洗脚本/规则文档 ＋ 原始数据只读归档', dod='清洗可复现：删多少、为什么有记录',
         book='§3 数据模型'),

    dict(id='sv05', mod='M1 正式调研', t='正式发放与回收监控', role='beA', est=1, dep=['sv03'],
         out='有效问卷 ≥200 份（或目标量）', dod='掉速两天内换了渠道，回收有日报',
         book='§5 核心模块'),
    dict(id='sv06', mod='M1 正式调研', t='数据清洗与样本构成', role='data', est=1, dep=['sv04', 'sv05'],
         out='清洗后数据集 ＋ 样本构成表', dod='无效样本剔除规则留档，样本构成图可追原始数据',
         book='§3 数据模型'),
    dict(id='sv07', mod='M1 正式调研', t='描述统计与交叉分析', role='data', est=1, dep=['sv06'],
         out='全部假设的交叉分析结果', dod='每个假设有「支持/不支持/部分支持」的判定',
         book='§5 核心模块'),
    dict(id='sv08', mod='M1 正式调研', t='信效度检验', role='data', est=1, dep=['sv06'],
         out='信效度检验表 ＋ 操作录屏', dod='Cronbach α ≥0.7、KMO ≥0.6，不达标有修订过程',
         book='§9 测试与验收'),
    dict(id='sv09', mod='M1 正式调研', t='图表墙制作', role='fe', est=1, dep=['sv07'],
         out='4 类图（构成/现状/交叉/检验）每张带结论', dod='每张图有结论句、图注、数据来源',
         book='§7 前端与交互'),

    dict(id='sv10', mod='M2 成稿', t='报告初稿（设计与分析章先行）', role='qa', est=1, dep=['sv07'],
         out='调查设计与数据分析两章成稿', dod='每个结论跟一个数字或一张图',
         book='§1 项目概述与范围'),
    dict(id='sv11', mod='M2 成稿', t='对策与建议章', role='arch', est=1, dep=['sv10'],
         out='对策章（每条对策对应一条发现）', dod='无「加强/重视」类空话，条条可落地',
         book='§5 核心模块'),
    dict(id='sv12', mod='M2 成稿', t='查重与匿名版', role='qa', est=1, dep=['sv11'],
         out='查重报告 ＋ 匿名版单独存档', dod='查重达标、材料无校名与导师信息',
         book='§9 测试与验收'),

    dict(id='sv13', mod='M3 交付与路演', t='路演 PPT 与自述稿', role='fe', est=1, dep=['sv09', 'sv11'],
         out='PPT ＋ 时长合规的自述稿', dod='每页标题是结论句，录音 ≤ 规定时长 90%',
         book='§7 前端与交互'),
    dict(id='sv14', mod='M3 交付与路演', t='问答准备与材料归档', role='qa', est=1, dep=['sv12', 'sv13'],
         out='20 条问答 ＋ 按命名规则归档的提交包', dod='样本量/信效度/结论对应三问脱口而出',
         book='§8 部署与运维'),
]

# ============================================================ 商科 · 轻应用上线
# 角色语义在产品轨的映射：arch=产品/队长，beA=主开发，fe=原型与页面，
# data=数据与 AI，qa=内测与文档，ops=部署
TASKS['lightapp'] = [
    dict(id='la01', mod='M0 验证与定义', t='六问验证与用户访谈', role='arch', est=1, dep=[],
         out='一页纸验证结论 ＋ 3 段访谈纪要', dod='痛点有原话佐证，不是自己猜的',
         book='§1 项目概述与范围'),
    dict(id='la02', mod='M0 验证与定义', t='MVP 定义与 PRD', role='arch', est=1, dep=['la01'],
         out='PRD 一页纸 ＋ 开发清单', dod='第一版 ≤5 个页面，范围外功能进「以后再说」',
         book='§1 项目概述与范围'),
    dict(id='la03', mod='M0 验证与定义', t='可点击原型', role='fe', est=1, dep=['la02'],
         out='MasterGo 可点击原型链接', dod='外人点一遍不迷路，卡点已改',
         book='§7 前端与交互'),
    dict(id='la04', mod='M0 验证与定义', t='数据表与环境', role='ops', est=1, dep=['la02'],
         out='3–5 张表结构 ＋ 开发环境就绪', dod='主链路字段冻结，环境换机能复现',
         book='§3 数据模型'),

    dict(id='la05', mod='M1 做出来', t='首个接口闭环', role='beA', est=1, dep=['la04'],
         out='提交→存储→列表可见 的闭环', dod='Postman 调通，截图留档',
         book='§4 接口契约'),
    dict(id='la06', mod='M1 做出来', t='核心页面与交互', role='fe', est=1, dep=['la03', 'la05'],
         out='全部 MVP 页面接真实数据', dod='空态/错误态都有，主流程不用键盘也能走通',
         book='§7 前端与交互'),
    dict(id='la07', mod='M1 做出来', t='AI 能力集成', role='data', est=1, dep=['la05'],
         out='主链路上 AI 步骤 ＋ 10 组测试记录', dod='坏例有兜底文案，失败不白屏',
         book='§5 核心模块'),
    dict(id='la08', mod='M1 做出来', t='登录与密钥管理', role='beA', est=1, dep=['la06'],
         out='基础登录 ＋ 密钥不进仓库', dod='.env 忽略提交，泄露密钥当天轮换',
         book='§6 非功能'),

    dict(id='la09', mod='M2 上线', t='部署上线', role='ops', est=1, dep=['la06', 'la07'],
         out='可访问的 https 链接', dod='手机能打开，部署步骤录屏留档',
         book='§8 部署与运维'),
    dict(id='la10', mod='M2 上线', t='内测与问题清单', role='qa', est=1, dep=['la09'],
         out='5 人内测记录 ＋ 分级问题清单', dod='阻塞类问题清零才进入下阶段',
         book='§9 测试与验收'),
    dict(id='la11', mod='M2 上线', t='迭代修复', role='beA', est=1, dep=['la10'],
         out='阻塞+应改类问题全部关闭', dod='每条修复有验证截图',
         book='§9 测试与验收'),

    dict(id='la12', mod='M3 交付与路演', t='使用数据与作品集', role='data', est=1, dep=['la09'],
         out='用户量/留存/核心操作数据截图 ＋ 作品集页', dod='数据能追到后台，作品集 3 分钟看完',
         book='§6 非功能'),
    dict(id='la13', mod='M3 交付与路演', t='路演视频与答辩', role='fe', est=1, dep=['la12'],
         out='3 分钟路演视频 ＋ 答辩材料', dod='现场断网也能演示（本地兜底）',
         book='§7 前端与交互'),
    dict(id='la14', mod='M3 交付与路演', t='材料归档提交', role='qa', est=1, dep=['la11', 'la13'],
         out='按命名规则归档的提交包 ＋ 回执', dod='文件名合规，编号连续，回执留档',
         book='§8 部署与运维'),
]


# ---------------------------------------------------------------- 队伍配置
# 标准建制（按人数）：给不填成员时用
STAFFING = {
    3: ['arch', 'beA', 'qa'],
    4: ['arch', 'beA', 'fe', 'qa'],
    5: ['arch', 'beA', 'beB', 'fe', 'qa'],
    6: ['arch', 'beA', 'beB', 'fe', 'data', 'qa'],
    7: ['arch', 'beA', 'beB', 'fe', 'data', 'qa', 'ops'],
    8: ['arch', 'beA', 'beB', 'fe', 'fe', 'data', 'qa', 'ops'],
    9: ['arch', 'beA', 'beB', 'fe', 'fe', 'data', 'qa', 'ops', 'beB'],
}


def build_all():
    role_map = {}
    for r in ROLES:
        role_map[r['k']] = dict(n=r['n'], d=r['d'], merge=r['merge'])
    return dict(
        roles=ROLES,
        post2role=POST2ROLE,
        process=PROCESS,
        hb=[list(x) for x in HB],
        tasks={k: [dict(x) for x in v] for k, v in TASKS.items()},
        staffing={str(k): v for k, v in STAFFING.items()},
    )


if __name__ == '__main__':
    out = build_all()
    print('角色 %d · 流程红线 %d · 手册节 %d' % (len(out['roles']), len(out['process']), len(out['hb'])))
    for k, v in out['tasks'].items():
        roles = set(x['role'] for x in v)
        print('  %-9s 任务 %2d  角色 %d  模块 %d' % (
            k, len(v), len(roles), len(set(x['mod'] for x in v))))
    # 依赖完整性
    for k, v in out['tasks'].items():
        ids = set(x['id'] for x in v)
        for x in v:
            for d in x['dep']:
                assert d in ids, '%s 的任务 %s 依赖不存在的 %s' % (k, x['id'], d)
    print('依赖检查：全部通过')
