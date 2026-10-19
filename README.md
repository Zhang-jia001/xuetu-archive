# 竞赛指导台（学途 · 竞赛与论文陪跑）

面向 **0 基础学生** 的竞赛全流程陪跑平台：把「选题 → 组队 → 推进 → 结项 → 答辩 → 论文」拆成 33 个能当天做完的动作，一次只推一件事，支持多人协同。

- **前端**：单文件 HTML（CSS/JS/数据全内联，零外部依赖，可离线双击打开）
- **后端**：Node 22 内置 `node:http` + `node:sqlite` + `node:crypto`，**零第三方依赖**，不需要 `npm install`
- **数据库**：SQLite 单文件（`data/app.db`），备份就是拷文件

---

## 1. 两种用法

### 1.1 离线版（一个人用）

直接双击 `竞赛指导台_学生版.html`。

- 数据存在浏览器 `localStorage`，换设备不同步
- 全部功能可用：33 步陪跑、选题池、排期、答辩大纲、论文写作台
- 不能协同：队友看不到你的进度

### 1.2 在线协同版（一个队用）

```bash
# 需要 Node 22 及以上
node server/index.js
# 打开 http://localhost:8787
```

打开后右上角出现「登录 / 注册」：

1. **队长**注册 → 点一个赛事建项目 → 到「协同」区点「生成邀请码」
2. **队员**注册 → 在「今天做什么」页输入 6 位邀请码 → 加入
3. 队长在动作卡右侧把某一步「派给」某个队员
4. 队员打开看到的就是派给自己的步骤；做完点「我做完了」，队长刷新（15 秒自动刷新）就能看到

进度、成员、勾选状态都存在服务端，多人看到的是同一份。

---

## 2. 目录结构

```
.
├── 竞赛指导台_学生版.html        # 构建产物（单文件前端，可直接分发）
├── server/                       # 后端（零依赖）
│   ├── index.js                  # HTTP 服务 + 路由 + 静态托管
│   ├── db.js                     # SQLite 连接与建表
│   ├── auth.js                   # 注册/登录、scrypt 密码、HS256 token
│   └── test_api.js               # 30 项接口回归（含权限与协同场景）
├── working/竞赛指导台/
│   ├── src/{index.html,style.css,app.js,api.js}
│   ├── build_guide.py            # 把 src + 数据层内联成一个 HTML
│   └── check_guide.js            # 120 项 jsdom 回归（离线模式）
├── working/执行方案/              # 内容数据层（纯 Python 数据，无第三方库）
│   ├── comps.py                  # 六赛事口径
│   ├── topic_guide.py            # 13 张方向族辅导卡
│   ├── exec_plan.py              # 选题级落地方案（6 技术栈）
│   ├── dev_schedule.py           # 7 角色 × 6 栈 131 个开发任务
│   ├── defense_kit.py            # 答辩：6 配色 / 16 页骨架 / 30 追问
│   ├── paper_kit.py              # 论文：5 类骨架 / 降重 / 排版 / GB-T 7714
│   └── coach_kit.py              # 33 步陪跑动作流（本轮新增）
└── working/选题生成/topics_all.json   # 120 条选题池
```

---

## 3. 构建前端

改动 `working/竞赛指导台/src/` 后：

```bash
python3 working/竞赛指导台/build_guide.py
# → 重新生成 竞赛指导台_学生版.html
```

验证（两个都要过）：

```bash
# 前端：120 项 jsdom 回归（需先 npm i jsdom，或用系统已装的）
NODE_PATH=~/.workbuddy/binaries/node/workspace/node_modules \
  node --max-old-space-size=6144 working/竞赛指导台/check_guide.js

# 后端：30 项接口回归（先启动 server）
node server/index.js &
node server/test_api.js
```

> 单文件超过 500KB，跑 jsdom 必须带 `--max-old-space-size=6144`，否则会被 SIGTERM（退出码 137）。

---

## 4. 部署到服务器

### 4.1 最小方式

```bash
scp -r server working 竞赛指导台_学生版.html user@your-server:/opt/comp-guide/
ssh user@your-server
cd /opt/comp-guide && PORT=8787 JWT_SECRET='换成随机长字符串' node server/index.js
```

### 4.2 systemd 常驻

```ini
# /etc/systemd/system/comp-guide.service
[Unit]
Description=Comp Guide
After=network.target

[Service]
Type=simple
WorkingDirectory=/opt/comp-guide
Environment=PORT=8787
Environment=JWT_SECRET=请换成随机长字符串
Environment=DATA_DIR=/var/lib/comp-guide
ExecStart=/usr/bin/node server/index.js
Restart=always

[Install]
WantedBy=multi-user.target
```

```bash
systemctl daemon-reload && systemctl enable --now comp-guide
```

### 4.3 Nginx 反代（可选，用于绑域名 + HTTPS）

```nginx
server {
  listen 80;
  server_name comp.example.com;
  location / {
    proxy_pass http://127.0.0.1:8787;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
  }
}
```

### 环境变量

| 变量 | 默认 | 说明 |
|---|---|---|
| `PORT` | 8787 | 监听端口 |
| `JWT_SECRET` | 内置开发值 | **上线必须改**，泄露等于任何人都能签发登录态 |
| `DATA_DIR` | `./data` | SQLite 存放目录 |
| `APP_HTML` | `../竞赛指导台_学生版.html` | 前端文件路径 |

### 备份

```bash
sqlite3 data/app.db ".backup 'backup-$(date +%F).db'"   # 或直接拷 data/app.db
```

---

## 5. 接口

所有接口前缀 `/api`，除 `health`、`register`、`login` 外都需要 `Authorization: Bearer <token>`。

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/api/health` | 探活（前端用它判断是否在线模式） |
| POST | `/api/auth/register` | 注册 `{email,name,password}` |
| POST | `/api/auth/login` | 登录 `{email,password}` |
| GET | `/api/me` | 当前用户 |
| GET | `/api/projects` | 我的项目列表（含进度） |
| POST | `/api/projects` | 建项目（可带前端生成的 `id`） |
| GET | `/api/projects/:id` | 详情：项目 + 成员 + 动作 + 动态 |
| PATCH | `/api/projects/:id` | 改元数据（标题/截止日/勾选等） |
| DELETE | `/api/projects/:id` | 删项目（仅队长） |
| POST | `/api/projects/:id/invite` | 生成/查看邀请码（仅队长） |
| POST | `/api/join` | 用邀请码加入 `{code}` |
| PUT | `/api/projects/:id/members` | 全量替换成员（仅队长） |
| POST | `/api/projects/:id/acts/:actId` | 完成/撤销/指派一个动作 |
| GET | `/api/projects/:id/feed` | 团队动态 |

权限模型：`project_users` 表决定谁能读写；`owner` 才能删项目、改成员、看邀请码。

---

## 6. 设计取舍

- **为什么不用 Express**：目标场景是学校内网或一台小服务器，零依赖意味着不会有 `npm install` 装不上、原生模块编译失败的问题；Node 22 内置的 http/sqlite/crypto 已经够用。
- **为什么保留离线单文件**：发给学生时最怕"装环境"。单文件双击就能用，后端只是把协同能力加上去，不是必需项。
- **为什么动作是 33 个不是 300 个**：0 基础学生需要的是"今天做什么"，任务粒度超过一天就会被拖死。每个动作 15–30 分钟，做完就打勾。
- **为什么项目 id 由前端生成**：本地先落地，再同步到服务端，避免"网络失败就丢项目"；服务端只校验格式和唯一性。

---

## 7. 已知边界

- 冲突策略：动作（完成/指派）细粒度合并，成员与勾选清单是整份覆盖，两个人同时改同一份清单时以后提交的为准
- 实时性：15 秒轮询，不是 WebSocket
- 没有找回密码、没有邮箱验证
- 单机 SQLite，暂不支持多实例水平扩展（要扩就把 `db.js` 换成 Postgres）
