# Cloud Code Studio

Cloud Code Studio 是一个基于 Web 的云端 AI 编程工作台，将 React 前端、Node.js 后端与 [OpenCode](https://github.com/opencode-ai/opencode) CLI 深度集成，提供浏览器内的 AI 辅助编程体验。本项目设计为与基础镜像打包后，由外部安全沙箱服务拉起运行，不包含容器编排逻辑。

---

## 目录

- [架构概览](#架构概览)
- [技术栈](#技术栈)
- [运行环境要求](#运行环境要求)
- [一键启动](#一键启动)
- [环境变量配置](#环境变量配置)
- [MCP 服务注册](#mcp-服务注册)
- [安全架构](#安全架构)
- [预设命令（Setup Commands）](#预设命令setup-commands)
- [项目结构](#项目结构)
- [API 概览](#api-概览)
- [WebSocket 事件](#websocket-事件)
- [开发指南](#开发指南)

---

## 架构概览

```
┌──────────────────────────────────────────────────────────────────┐
│                         安全沙箱环境                              │
│                                                                  │
│  ┌─────────────┐     HTTP/WS      ┌──────────────┐              │
│  │  React SPA  │◄────────────────►│  Express API  │              │
│  │  (Vite)     │   port 5173/3000  │  + Socket.IO │              │
│  │  Ant Design │                   │  port 5000   │              │
│  └─────────────┘                   └──────┬───────┘              │
│                                           │                      │
│                          ┌────────────────┼────────────────┐     │
│                          │                │                │     │
│                          ▼                ▼                ▼     │
│                    ┌──────────┐    ┌──────────┐    ┌──────────┐ │
│                    │  MySQL   │    │  Redis   │    │ OpenCode │ │
│                    │  8.0+    │    │  7+      │    │   CLI    │ │
│                    └──────────┘    └──────────┘    └─────┬────┘ │
│                                                         │       │
│                                            ┌────────────┤       │
│                                            │            │       │
│                                            ▼            ▼       │
│                                      ┌──────────┐  ┌────────┐  │
│                                      │ LLM API  │  │  MCP   │  │
│                                      │ Provider │  │Servers │  │
│                                      └──────────┘  └────────┘  │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │                   /data/workspaces/{id}                     │ │
│  │              本地文件系统 (Git 仓库克隆)                      │ │
│  └─────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────┘
```

**核心流程：**

1. 用户通过 React 前端创建 Workspace，指定 Git 仓库地址
2. 后端通过 `git clone` 将仓库克隆到本地 `/data/workspaces/{workspaceId}` 目录
3. 用户在 Chat 界面发送编程指令
4. 后端调用 OpenCode CLI 在对应工作区目录内执行 AI 编程任务
5. OpenCode 的 JSON-line 输出通过 WebSocket 实时推送到前端（包括代码变更、工具调用、计划步骤等）
6. MCP 服务器为 OpenCode 提供扩展能力（代码搜索、文档检索等）

---

## 技术栈

| 层级 | 技术 | 说明 |
|------|------|------|
| **前端** | React 18 + TypeScript + Vite | 单页应用 |
| **UI 组件** | Ant Design 5 + TailwindCSS | 组件库 + 工具类 |
| **状态管理** | Zustand | 轻量级状态管理 |
| **实时通信** | Socket.IO | WebSocket 双向通信 |
| **后端** | Express.js + TypeScript | RESTful API + WebSocket |
| **ORM** | Sequelize | MySQL 数据库操作 |
| **缓存** | ioredis | Redis 客户端 |
| **认证** | JWT + bcryptjs + Refresh Token | Access/Refresh Token 双令牌轮换 |
| **AI 引擎** | OpenCode CLI | LLM 驱动的编程助手 |
| **文件操作** | Node.js fs 模块 | 本地文件系统读写 |
| **Git 操作** | child_process (git) | Git CLI 封装 |

---

## 运行环境要求

本项目需要在以下环境中直接运行（已在基础镜像中预装）：

| 依赖 | 最低版本 | 说明 |
|------|----------|------|
| **Node.js** | 20.x | 运行后端及构建前端 |
| **npm** | 9.x | 包管理器 |
| **MySQL** | 8.0 | 数据持久化（用户、工作区、聊天记录） |
| **Redis** | 7.x | 会话缓存 |
| **Git** | 2.x | 仓库克隆与操作 |
| **OpenCode CLI** | latest | AI 编程引擎（需在 PATH 中可用） |
| **bash** | 4.x+ | Shell 环境 |

### 验证环境依赖

```bash
# 检查所有必要依赖
node --version        # >= 20.x
npm --version         # >= 9.x
mysql --version       # >= 8.0
redis-cli --version   # >= 7.x
git --version         # >= 2.x
which opencode        # 确认 opencode 已安装
```

---

## 一键启动

将以下脚本保存为 `start.sh` 并执行：

```bash
#!/bin/bash
set -e

# ─── 颜色输出 ─────────────────────────────────────────────
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

log()  { echo -e "${GREEN}[✓]${NC} $1"; }
warn() { echo -e "${YELLOW}[!]${NC} $1"; }
err()  { echo -e "${RED}[✗]${NC} $1"; exit 1; }

# ─── 环境检查 ─────────────────────────────────────────────
echo "========================================="
echo "  Cloud Code Studio - 环境检查 & 启动"
echo "========================================="

command -v node    >/dev/null 2>&1 || err "未找到 node，请安装 Node.js 20+"
command -v npm     >/dev/null 2>&1 || err "未找到 npm"
command -v git     >/dev/null 2>&1 || err "未找到 git，请安装 git"
command -v mysql   >/dev/null 2>&1 || warn "未找到 mysql 客户端（服务可能已运行）"
command -v redis-cli >/dev/null 2>&1 || warn "未找到 redis-cli（服务可能已运行）"

if command -v opencode >/dev/null 2>&1; then
  log "OpenCode CLI 已安装: $(which opencode)"
else
  warn "未找到 opencode CLI，AI 编程功能将受限"
fi

log "Node.js $(node --version)"
log "npm $(npm --version)"
log "Git $(git --version | awk '{print $3}')"

# ─── 项目根目录 ───────────────────────────────────────────
PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$PROJECT_DIR"

# ─── 配置环境变量 ─────────────────────────────────────────
if [ ! -f backend/.env ]; then
  if [ -f backend/.env.example ]; then
    cp backend/.env.example backend/.env
    log "已从 .env.example 创建 backend/.env（请根据需要修改）"
  fi
fi

if [ ! -f frontend/.env ]; then
  if [ -f frontend/.env.example ]; then
    cp frontend/.env.example frontend/.env
    log "已从 .env.example 创建 frontend/.env"
  fi
fi

# ─── 创建工作区目录 ───────────────────────────────────────
WORKSPACES_DIR="${WORKSPACES_DIR:-/data/workspaces}"
mkdir -p "$WORKSPACES_DIR" 2>/dev/null || warn "无法创建 $WORKSPACES_DIR，请手动创建"
log "工作区目录: $WORKSPACES_DIR"

# ─── 安装依赖 & 构建 ─────────────────────────────────────
log "安装后端依赖..."
cd "$PROJECT_DIR/backend"
npm install --production=false

log "构建后端..."
npm run build

log "安装前端依赖..."
cd "$PROJECT_DIR/frontend"
npm install --production=false

log "构建前端..."
npm run build

# ─── 启动服务 ─────────────────────────────────────────────
cd "$PROJECT_DIR"

log "启动后端服务 (port ${PORT:-5000})..."
cd backend && node dist/index.js &
BACKEND_PID=$!

log "启动前端开发服务 (port 5173)..."
cd "$PROJECT_DIR/frontend" && npx vite --host 0.0.0.0 &
FRONTEND_PID=$!

echo ""
echo "========================================="
log "Cloud Code Studio 已启动！"
echo ""
echo "  前端: http://localhost:5173"
echo "  后端: http://localhost:${PORT:-5000}"
echo "  API:  http://localhost:${PORT:-5000}/api"
echo "========================================="

# ─── 优雅退出 ─────────────────────────────────────────────
cleanup() {
  echo ""
  log "正在关闭服务..."
  kill $BACKEND_PID 2>/dev/null
  kill $FRONTEND_PID 2>/dev/null
  wait
  log "已关闭"
}
trap cleanup EXIT INT TERM

wait
```

### 快速启动

```bash
chmod +x start.sh
./start.sh
```

> **生产模式**：前端构建产物位于 `frontend/dist/`，可使用 Nginx 等 Web 服务器托管静态文件，并反向代理 API 请求到后端 5000 端口。

---

## 环境变量配置

### 后端 (`backend/.env`)

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `PORT` | `5000` | 后端服务端口 |
| `NODE_ENV` | `development` | 运行环境 |
| `MYSQL_HOST` | `localhost` | MySQL 主机 |
| `MYSQL_PORT` | `3306` | MySQL 端口 |
| `MYSQL_USER` | `cloudcode` | MySQL 用户名 |
| `MYSQL_PASSWORD` | `cloudcode` | MySQL 密码 |
| `MYSQL_DATABASE` | `cloudcode` | 数据库名 |
| `REDIS_URL` | `redis://localhost:6379` | Redis 连接地址 |
| `JWT_SECRET` | — | JWT 签名密钥 (**生产必改**) |
| `JWT_EXPIRY` | `24h` | Token 有效期 |
| `ALLOWED_ORIGINS` | `http://localhost:3000` | CORS 允许来源（逗号分隔） |
| `WORKSPACES_DIR` | `/data/workspaces` | 工作区文件存储目录 |
| `OPENCODE_LLM_PROVIDER` | `anthropic` | 全局默认 LLM 提供商 |
| `OPENCODE_LLM_MODEL` | — | 全局默认模型名称 |
| `OPENCODE_LLM_API_KEY` | — | 全局默认 API Key |
| `OPENCODE_LLM_BASE_URL` | — | 自定义 API 端点 |

### 前端 (`frontend/.env`)

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `VITE_API_URL` | `http://localhost:5000/api` | 后端 API 地址 |
| `VITE_WS_URL` | `http://localhost:5000` | WebSocket 服务地址 |

---

## MCP 服务注册

Cloud Code Studio 支持为每个工作区配置 [Model Context Protocol (MCP)](https://modelcontextprotocol.io/) 服务器，扩展 AI 编程能力。

### 通过 Web UI 配置

1. 打开任意工作区页面
2. 点击右上角 **⚙ 设置** 按钮
3. 在 **MCP Servers** 区域点击 **Add Server**
4. 填写 MCP 服务器名称和 URL
5. 启用/禁用切换开关控制是否生效
6. 点击 **Save Configuration** 保存

### 通过 API 配置

```bash
# 获取当前配置
curl -H "Authorization: Bearer <token>" \
  http://localhost:5000/api/opencode/<workspaceId>/config

# 更新 MCP 服务器列表
curl -X PUT -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  http://localhost:5000/api/opencode/<workspaceId>/config \
  -d '{
    "mcpServers": [
      { "name": "github-mcp", "url": "http://localhost:3001", "enabled": true },
      { "name": "docs-search", "url": "http://localhost:3002", "enabled": true }
    ]
  }'
```

### 工作原理

当用户发送编程指令时，后端会：

1. 从数据库加载该工作区的 OpenCode 配置（含 MCP 服务器列表）
2. 在工作区目录生成 `.opencode.json` 配置文件
3. 调用 OpenCode CLI 执行任务——OpenCode 自动发现并连接已注册的 MCP 服务器
4. MCP 服务器提供的工具（代码搜索、文档检索等）可被 LLM 自主调用

生成的 `.opencode.json` 示例：

```json
{
  "provider": "anthropic",
  "model": "claude-3-sonnet",
  "mcpServers": {
    "github-mcp": { "url": "http://localhost:3001" },
    "docs-search": { "url": "http://localhost:3002" }
  }
}
```

---

## 项目结构

```
cloud-code-studio/
├── README.md                      # 本文档
├── start.sh                       # 一键启动脚本
├── backend/                       # Node.js 后端
│   ├── package.json
│   ├── tsconfig.json
│   ├── .env.example               # 环境变量模板
│   └── src/
│       ├── index.ts               # 入口：启动 HTTP + WebSocket 服务
│       ├── app.ts                 # Express 应用配置（CORS、限流、路由）
│       ├── config/
│       │   ├── index.ts           # 环境变量读取
│       │   └── database.ts        # Sequelize MySQL 连接
│       ├── models/
│       │   ├── User.ts            # 用户模型
│       │   ├── RefreshToken.ts    # Refresh Token 模型
│       │   ├── Workspace.ts       # 工作区模型
│       │   ├── ChatSession.ts     # 聊天会话模型
│       │   ├── ChatMessage.ts     # 聊天消息模型
│       │   ├── OpenCodeConfig.ts  # OpenCode/MCP 配置模型
│       │   └── FileRecord.ts      # 文件上传记录
│       ├── services/
│       │   ├── opencodeService.ts # OpenCode CLI 封装 + MCP 配置写入
│       │   ├── fileService.ts     # 本地文件系统操作
│       │   └── gitService.ts      # Git CLI 封装
│       ├── controllers/           # 路由处理器
│       ├── routes/                # API 路由定义
│       ├── websocket/
│       │   └── handler.ts         # Socket.IO 事件处理
│       ├── middleware/            # 认证、错误处理、限流
│       ├── types/                 # TypeScript 类型定义
│       └── utils/                 # 日志等工具
│
└── frontend/                      # React 前端
    ├── package.json
    ├── vite.config.ts
    ├── tsconfig.json
    ├── .env.example
    └── src/
        ├── main.tsx               # React 入口
        ├── App.tsx                # 路由 & 布局
        ├── pages/
        │   ├── Login/             # 登录页
        │   ├── Register/          # 注册页
        │   ├── Dashboard/         # 工作区列表
        │   └── Workspace/         # 主编程界面（Chat + 文件浏览器）
        ├── components/
        │   ├── Chat/              # 聊天 UI（消息、工具调用、代码变更）
        │   ├── FileExplorer/      # 文件树浏览器
        │   ├── OpenCodeSettings/  # LLM & MCP 配置面板
        │   └── Common/            # 通用组件
        ├── services/
        │   ├── api.ts             # Axios HTTP 客户端
        │   └── websocket.ts       # Socket.IO 客户端
        ├── stores/                # Zustand 状态管理
        ├── hooks/                 # 自定义 React Hooks
        ├── types/                 # 前端类型定义
        └── utils/                 # 工具函数
```

---

## API 概览

所有 API 路径以 `/api` 为前缀，需要 JWT Bearer Token 认证（除登录注册外）。

### 认证

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/auth/register` | 注册新用户 |
| POST | `/api/auth/login` | 用户登录，返回 JWT + Refresh Token |
| POST | `/api/auth/refresh` | 使用 Refresh Token 获取新的 Access Token |
| POST | `/api/auth/logout` | 注销并撤销 Refresh Token |
| GET | `/api/auth/me` | 获取当前用户信息 |
| PUT | `/api/auth/me/password` | 修改密码（同时撤销所有 Refresh Token） |

### 工作区

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/workspaces` | 创建工作区（触发 Git 克隆） |
| GET | `/api/workspaces` | 获取用户的所有工作区 |
| GET | `/api/workspaces/:id` | 获取单个工作区详情 |
| DELETE | `/api/workspaces/:id` | 删除工作区（清除文件） |

### 聊天

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/chat/sessions` | 创建聊天会话 |
| GET | `/api/chat/sessions` | 获取会话列表 |
| GET | `/api/chat/sessions/:id` | 获取会话及消息 |
| POST | `/api/chat/sessions/:id/messages` | 发送消息（SSE 流式响应） |
| DELETE | `/api/chat/sessions/:id` | 删除会话 |

### 文件操作

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/files/:workspaceId/tree` | 获取文件树 |
| GET | `/api/files/:workspaceId/read` | 读取文件内容 |
| PUT | `/api/files/:workspaceId/write` | 写入文件 |
| POST | `/api/files/:workspaceId/upload` | 上传文件 |

### OpenCode 配置

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/opencode/:workspaceId/config` | 获取 OpenCode/MCP 配置 |
| PUT | `/api/opencode/:workspaceId/config` | 更新配置（含 MCP 服务器） |

---

## WebSocket 事件

通过 Socket.IO 连接到后端（`ws://localhost:5000`），使用 JWT Token 认证。

### 客户端发送

| 事件 | 数据 | 说明 |
|------|------|------|
| `join_session` | `{ sessionId }` | 加入聊天会话房间 |
| `chat_message` | `{ sessionId, content, attachments?, planMode? }` | 发送编程指令 |
| `plan_confirm` | `{ sessionId, planId, confirmed }` | 确认/拒绝执行计划 |
| `code_execution` | `{ sessionId, workspaceId, command }` | 执行 Shell 命令 |
| `start_dev_server` | `{ sessionId, workspaceId, command, port }` | 启动开发服务器 |

### 服务端推送

| 事件 | 说明 |
|------|------|
| `session_joined` | 成功加入会话 |
| `workspace_info` | 工作区信息（分支、文件数、Git 状态） |
| `message` | 用户消息广播 |
| `message_start` | AI 响应开始 |
| `message_chunk` | AI 响应文本片段（流式） |
| `message_complete` | AI 响应完成 |
| `tool_call` | OpenCode 调用工具（文件写入、bash、grep 等） |
| `code_change` | 代码文件变更通知 |
| `plan_pending` | AI 生成执行计划待确认 |
| `plan_status` | 计划确认/拒绝状态 |
| `dev_server_started` | 开发服务器已启动 |
| `error` | 错误通知 |

---

## 安全架构

Cloud Code Studio 采用多层安全防护：

### 认证机制

- **Access Token（JWT）**：短生命周期（默认 24 小时），用于 API 请求认证
- **Refresh Token**：长生命周期（7 天），用于无感刷新 Access Token
- **Token 轮换**：每次使用 Refresh Token 时，旧 Token 被撤销并发放新 Token 对，防止 Token 重放攻击
- **登出撤销**：登出时服务端撤销 Refresh Token
- **密码修改撤销**：修改密码后撤销所有现有 Refresh Token，强制重新登录
- **密码强度校验**：8–128 字符，必须包含大写字母、小写字母和数字

### 传输与访问安全

- **Helmet**：自动设置安全 HTTP 响应头（CSP、HSTS 等）
- **CORS**：仅允许配置的域名访问
- **速率限制**：全局 200 次/15分钟、认证端点 20 次/15分钟
- **密码哈希**：bcrypt（盐值 12 轮）

### 前端安全

- **自动刷新**：401 响应时前端自动尝试 Token 刷新，失败后才重定向到登录页
- **并发保护**：多个并发请求触发 401 时只发送一次 Token 刷新请求

---

## 预设命令（Setup Commands）

Cloud Code Studio 支持为每个工作区配置预设 Shell 命令，在每次启动 AI 编程会话前自动执行，用于环境初始化。

### 使用场景

- 安装项目依赖：`npm install`、`pip install -r requirements.txt`
- 设置环境变量：`export NODE_ENV=development`
- 构建项目：`npm run build`
- 数据库迁移：`npx prisma migrate dev`
- 启动辅助服务

### 通过 Web UI 配置

1. 打开任意工作区页面
2. 点击右上角 **⚙ 设置** 按钮
3. 在 **Setup Commands** 区域点击 **Add Command**
4. 输入要执行的 Shell 命令
5. 点击 **Save Configuration** 保存

### 通过 API 配置

```bash
curl -X PUT -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  http://localhost:5000/api/opencode/<workspaceId>/config \
  -d '{
    "setupCommands": [
      "npm install",
      "npm run build"
    ]
  }'
```

### 工作原理

当用户发送编程指令时，后端会在调用 OpenCode CLI 之前：

1. 从数据库加载该工作区的 OpenCode 配置
2. 按顺序执行所有配置的预设命令（每个命令超时限制 60 秒）
3. 命令失败不会阻断后续编程会话（仅记录警告日志）
4. 所有命令在工作区目录内执行

---

## 开发指南

### 本地开发

```bash
# 后端开发模式（自动重载）
cd backend
cp .env.example .env   # 首次需要配置
npm install
npm run dev:watch

# 前端开发模式（HMR）
cd frontend
cp .env.example .env   # 首次需要配置
npm install
npm run dev
```

### 构建

```bash
# 后端
cd backend && npm run build    # 输出到 dist/

# 前端
cd frontend && npm run build   # 输出到 dist/
```

### 类型检查

```bash
# 后端
cd backend && npx tsc --noEmit

# 前端
cd frontend && npx tsc --noEmit
```

---

## 许可证

MIT
