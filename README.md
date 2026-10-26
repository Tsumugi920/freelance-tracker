# Freelance Tracker · 自由职业管理

一个前后端完整项目的自由职业管理工作台：管理**客户**、跟踪**项目**（状态 / 截止 / 报酬）、**开账单与收款**、记录**工时**，并自动生成**收入统计**。

- 后端：Node.js + Express，REST API，数据持久化在 `server/data.json`
- 前端：原生 HTML / CSS / JavaScript（无构建步骤），按模块拆分
- 端口：**3022**（可通过环境变量 `PORT` 覆盖）

## 快速开始

```bash
npm install
npm start
```

启动后打开 <http://localhost:3022> 即可使用（后端同时托管前端页面）。

> 首次运行自带示例数据：6 位客户、12 个项目、8 张账单、10 条工时记录，全部写在 `server/data.json`。删除该文件再重启会生成空数据。

## 目录结构

```
freelance-tracker/
├── package.json              # 启动脚本 npm start，端口 3022
├── README.md
├── client/                   # 前端
│   ├── index.html            # 页面骨架（客户 / 项目 / 账单 / 工时 / 统计 五个面板）
│   ├── style.css
│   ├── app.js                # 入口：标签页切换、模块初始化、全局刷新
│   └── js/
│       ├── api.js            # fetch 封装 + 公共工具（转义 / 金额格式化 / 日期）
│       ├── clients.js        # 客户列表与增删改
│       ├── projects.js       # 项目列表（状态 / 截止 / 报酬）与增删改、状态切换
│       ├── invoices.js       # 账单与收款：开账单、标记收款、筛选
│       └── stats.js          # 工时记录 + 收入统计
└── server/                   # 后端
    ├── index.js              # Express 入口：托管前端 + 挂载 API，端口 3022
    ├── store.js              # 数据存取层（读写 server/data.json）
    ├── data.json             # 全部业务数据（含内置示例数据）
    └── routes/
        ├── clients.js        # /api/clients        客户增删改查
        ├── projects.js       # /api/projects       项目增删改查 + 工时登记
        └── invoices.js       # /api/invoices       账单增删改查 + 收款标记 + 收入汇总
```

## API 一览

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/api/clients` | 客户列表 |
| POST | `/api/clients` | 新增客户（`name` 必填） |
| PUT | `/api/clients/:id` | 修改客户 |
| DELETE | `/api/clients/:id` | 删除客户（名下有项目时拒绝） |
| GET | `/api/projects` | 项目列表（附客户名、开票/收款金额、工时明细） |
| POST | `/api/projects` | 新增项目（`clientId`、`name` 必填） |
| PUT | `/api/projects/:id` | 修改项目（支持只改 `status` 等局部字段） |
| DELETE | `/api/projects/:id` | 删除项目（连同其账单与工时） |
| POST | `/api/projects/:id/time` | 登记工时（`hours` 必填，0–24） |
| DELETE | `/api/projects/:id/time/:entryId` | 删除一条工时记录 |
| GET | `/api/invoices` | 账单列表（支持 `?status=paid\|unpaid`、`?projectId=`） |
| POST | `/api/invoices` | 开账单（`projectId`、`amount` 必填，账单号自动生成） |
| PUT | `/api/invoices/:id` | 修改账单（金额 / 日期 / 备注） |
| PATCH | `/api/invoices/:id/pay` | 标记收款（可传 `paidDate`） |
| PATCH | `/api/invoices/:id/unpay` | 取消收款 |
| DELETE | `/api/invoices/:id` | 删除账单 |
| GET | `/api/invoices/summary` | 收入汇总：累计开票 / 已收 / 待收、近 6 个月曲线、客户排行、项目状态分布 |

接口出错时统一返回 `{ "error": "原因" }` 与对应的 4xx / 5xx 状态码。

## 数据持久化

所有数据保存在 `server/data.json`，每次增删改都会写盘，重启服务不丢数据。文件损坏时服务会自动备份为 `data.json.bak` 并以空数据启动。

## 冒烟测试示例

```bash
# 列出客户
curl -s http://localhost:3022/api/clients

# 新增项目
curl -s -X POST http://localhost:3022/api/projects \
  -H 'Content-Type: application/json' \
  -d '{"clientId":1,"name":"验收测试项目","status":"in_progress","deadline":"2026-12-31","fee":12345}'

# 开账单并标记收款
curl -s -X POST http://localhost:3022/api/invoices \
  -H 'Content-Type: application/json' \
  -d '{"projectId":13,"amount":5000,"dueDate":"2026-11-25"}'
curl -s -X PATCH http://localhost:3022/api/invoices/9/pay -H 'Content-Type: application/json' -d '{}'

# 收入汇总
curl -s http://localhost:3022/api/invoices/summary
```
