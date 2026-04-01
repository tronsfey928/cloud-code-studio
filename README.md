# Cloud Code Studio

Cloud Code Studio 是一个基于 Web 的云端 AI 编程工作台，将 React 19 前端、NestJS 后端与 [Claude Code](https://github.com/anthropics/claude-code) / [Codex](https://github.com/openai/codex) / [GitHub Copilot CLI](https://docs.github.com/en/copilot/github-copilot-in-the-cli) / [OpenCode](https://github.com/opencode-ai/opencode) CLI 深度集成，提供浏览器内的 AI 辅助编程体验。默认使用 Claude Code 作为编程引擎。本项目设计为与基础镜像打包后，由外部安全沙箱服务拉起运行，不包含容器编排逻辑。

---

## 目录

- [架构概览](#架构概览)
- [技术栈](#技术栈)
- [运行环境要求](#运行环境要求)
- [一键启动](#一键启动)
- [环境变量配置](#环境变量配置)
- [协议规范](#协议规范)
  - [统一响应格式](#统一响应格式)
  - [API 端点](#api-端点)
  - [WebSocket 协议](#websocket-协议)
- [MCP 服务注册](#mcp-服务注册)
- [预设命令（Setup Commands）](#预设命令setup-commands)
- [安全架构](#安全架构)
- [项目结构](#项目结构)
- [开发指南](#开发指南)
- [界面截图](#界面截图)

---

## 架构概览

```
┌──────────────────────────────────────────────────────────────────┐
│                         安全沙箱环境                              │
│                                                                  │
│  ┌─────────────┐     HTTP/WS      ┌──────────────────────┐      │
│  │  React 19   │◄────────────────►│  NestJS API          │      │
│  │  SPA (Vite) │   port 5173/3000  │  + Socket.IO Gateway │      │
│  │  shadcn/ui  │                   │  port 5000           │      │
│  └─────────────┘                   └──────────┬───────────┘      │
│                                               │                  │
│                          ┌────────────────────┼──────────────┐   │
│                          │                    │              │   │
│                          ▼                    ▼              ▼   │
│                    ┌──────────┐        ┌──────────┐  ┌──────────┐│
│                    │  MySQL   │        │  Redis   │  │  AI CLI  ││
│                    │  8.0+    │        │  7+      │  │ (可选缓存)││
│                    │ TypeORM  │        │ (可选)   │  │opencode/ ││
│                    └──────────┘        └──────────┘  │claude    ││
│                                                       └────┬─────┘│
│                                            ┌───────────────┤      │
│                                            │               │      │
│                                            ▼               ▼      │
│                                      ┌──────────┐  ┌──────────┐  │
│                                      │ LLM API  │  │  MCP     │  │
│                                      │ Provider │  │ Servers  │  │
│                                      └──────────┘  └──────────┘  │
│                                                                   │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │              /data/workspaces/{workspaceId}                 │  │
│  │         本地文件系统（Git 仓库克隆 + .opencode.json）        │  │
│  └────────────────────────────────────────────────────────────┘  │
└───────────────────────────────────────────────────────────────────┘
```

**核心流程：**

1. 用户通过 React 前端注册/登录，创建 Workspace 并填写 Git 仓库地址
2. 后端通过 `git clone` 将仓库克隆到本地 `/data/workspaces/{workspaceId}` 目录
3. 用户在 Chat 界面（Socket.IO）发送编程指令
4. 后端生成配置文件（`.claude.json` / `.codex.json` / `.opencode.json`），调用对应 AI CLI（Claude Code / Codex / GitHub Copilot CLI / OpenCode）在工作区目录内执行
5. AI CLI 的 JSON-line 输出实时解析后通过 Socket.IO 推送到前端（流式文本、工具调用、代码变更、执行计划等）
6. MCP 服务器为 AI CLI 提供扩展工具能力（代码搜索、文档检索等）

---

## 技术栈

| 层级 | 技术 | 说明 |
|------|------|------|
| **前端框架** | React 19 + TypeScript + Vite | 单页应用，懒加载路由 |
| **UI 组件** | shadcn/ui（Radix UI 原语）| 无障碍、可组合组件库 |
| **样式** | TailwindCSS v4（CSS-first）| `@theme` + oklch 色彩系统，无需配置文件 |
| **状态管理** | Zustand | 轻量级全局状态（auth、workspace、chat） |
| **实时通信** | Socket.IO | WebSocket 双向通信（含 polling 降级） |
| **后端框架** | NestJS + TypeScript（严格模式）| 模块化 DI 架构 |
| **ORM** | TypeORM | MySQL 8.0 数据库操作，实体类定义表结构 |
| **缓存** | ioredis（可选）| Redis 缓存；未配置时自动降级为内存缓存 |
| **认证** | JWT + bcryptjs + Refresh Token | Access/Refresh Token 双令牌轮换 |
| **API 文档** | @nestjs/swagger | 自动生成 OpenAPI 规范，可在 `/api/docs` 访问 |
| **AI 引擎** | Claude Code / Codex / GitHub Copilot CLI / OpenCode CLI | 四种 AI 编程引擎，默认 Claude Code，按工作区配置切换 |
| **Git 操作** | child_process (git CLI) | 仓库克隆、分支信息、状态查询 |

---

## 运行环境要求

本项目在基础镜像中直接运行（无 Docker 容器化），需要预装以下依赖：

| 依赖 | 最低版本 | 说明 |
|------|----------|------|
| **Node.js** | 20.x | 运行后端及构建前端 |
| **npm** | 9.x | 包管理器 |
| **MySQL** | 8.0 | 数据持久化（用户、工作区、聊天记录、配置） |
| **Redis** | 7.x | 会话缓存（可选，未配置则使用内存缓存） |
| **Git** | 2.x | 仓库克隆与工作区操作 |
| **Claude Code CLI** | latest | 默认 AI 编程引擎（需在 `PATH` 中可用） |
| **Codex CLI** | latest | OpenAI Codex 编程引擎（`npm install -g @openai/codex`）|
| **GitHub Copilot CLI** | latest | GitHub Copilot CLI（`gh extension install github/gh-copilot`）|
| **OpenCode CLI** | latest | 备选 AI 编程引擎（按需安装） |
| **bash** | 4.x+ | Shell 环境（用于执行 AI 命令） |

---

## 一键启动

```bash
# 克隆仓库
git clone <repo-url> cloud-code-studio
cd cloud-code-studio

# 配置环境变量（首次）
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
# 编辑 backend/.env，至少配置 MYSQL_* 和 JWT_SECRET

# 一键安装依赖、构建并启动
bash start.sh
```

启动后访问：
- **前端**：`http://localhost:5173`
- **后端 API**：`http://localhost:5000/api`
- **Swagger 文档**：`http://localhost:5000/api/docs`

---

## 环境变量配置

### 后端（`backend/.env`）

```dotenv
# ── 服务器 ────────────────────────────────────────────────
PORT=5000
NODE_ENV=development          # production 模式下 JWT_SECRET 不能为默认值

# ── 数据库（MySQL）────────────────────────────────────────
MYSQL_HOST=localhost
MYSQL_PORT=3306
MYSQL_USER=cloudcode
MYSQL_PASSWORD=cloudcode
MYSQL_DATABASE=cloudcode

# ── 缓存（Redis，可选）────────────────────────────────────
REDIS_URL=                    # 留空则使用内存缓存

# ── 认证 ─────────────────────────────────────────────────
JWT_SECRET=change-this-to-a-strong-random-secret
JWT_EXPIRY=24h

# ── CORS ─────────────────────────────────────────────────
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:5173

# ── 文件上传 ──────────────────────────────────────────────
MAX_FILE_SIZE=10485760        # 单文件上限，默认 10 MB

# ── 工作区存储目录 ────────────────────────────────────────
WORKSPACES_DIR=/data/workspaces

# ── AI CLI 默认 LLM 配置 ────────────────────────────────
OPENCODE_LLM_PROVIDER=anthropic
OPENCODE_LLM_MODEL=
OPENCODE_LLM_API_KEY=
OPENCODE_LLM_BASE_URL=
```

### 前端（`frontend/.env`）

```dotenv
VITE_API_URL=http://localhost:5000/api
VITE_WS_URL=http://localhost:5000
```

---

## 协议规范

### 统一响应格式

所有 HTTP API 响应均由 `ResponseInterceptor` 统一包装为如下格式：

```json
{
  "code": 200,
  "message": "success",
  "data": { ... }
}
```

错误响应（由 `AllExceptionsFilter` 处理）：

```json
{
  "code": 404,
  "message": "Workspace not found",
  "data": null
}
```

### API 端点

所有路径以 `/api` 为前缀。除登录/注册外，所有端点需在 `Authorization` 请求头携带 Bearer JWT。

#### 认证（`/api/auth`）

| 方法 | 路径 | 认证 | 说明 |
|------|------|------|------|
| `POST` | `/api/auth/register` | 无 | 注册新用户（用户名、邮箱、密码） |
| `POST` | `/api/auth/login` | 无 | 登录，返回 `{ accessToken, refreshToken, user }` |
| `POST` | `/api/auth/refresh-token` | 无 | 用 Refresh Token 换取新令牌对（Token 轮换） |
| `POST` | `/api/auth/logout` | ✅ | 撤销指定 Refresh Token |
| `GET` | `/api/auth/me` | ✅ | 获取当前用户信息 |
| `POST` | `/api/auth/change-password` | ✅ | 修改密码（同时撤销所有 Refresh Token） |

#### 工作区（`/api/workspaces`）

| 方法 | 路径 | 说明 |
|------|------|------|
| `POST` | `/api/workspaces` | 创建工作区（触发 `git clone`），状态初始为 `creating` |
| `GET` | `/api/workspaces` | 获取当前用户的所有工作区列表 |
| `GET` | `/api/workspaces/:id` | 获取单个工作区详情 |
| `DELETE` | `/api/workspaces/:id` | 删除工作区（清除本地文件） |

工作区状态枚举：`creating` | `ready` | `error`

#### 聊天（`/api/chat`）

| 方法 | 路径 | 说明 |
|------|------|------|
| `POST` | `/api/chat/sessions` | 创建聊天会话（关联到工作区） |
| `GET` | `/api/chat/sessions` | 获取会话列表（可按 `?workspaceId=` 过滤） |
| `GET` | `/api/chat/sessions/:id` | 获取单个会话及其消息列表 |
| `POST` | `/api/chat/sessions/:id/messages` | 发送消息（SSE 流式响应，`Content-Type: text/event-stream`） |
| `DELETE` | `/api/chat/sessions/:id` | 删除会话 |

#### 文件操作（`/api/files`）

| 方法 | 路径 | 说明 |
|------|------|------|
| `GET` | `/api/files/:workspaceId/tree` | 获取文件树（支持 `?path=` 和 `?depth=` 参数） |
| `GET` | `/api/files/:workspaceId/read` | 读取文件内容（`?path=` 相对路径） |
| `PUT` | `/api/files/:workspaceId/write` | 写入文件（`{ path, content }`） |
| `POST` | `/api/files/:workspaceId/upload` | 上传文件（`multipart/form-data`，最大 10 MB） |

#### AI 配置（`/api/opencode`）

| 方法 | 路径 | 说明 |
|------|------|------|
| `GET` | `/api/opencode/:workspaceId/config` | 获取工作区的 AI 配置（API Key 自动掩码） |
| `PUT` | `/api/opencode/:workspaceId/config` | 更新 AI 配置（LLM 提供商、模型、MCP 服务器、预设命令等） |

**`PUT /api/opencode/:workspaceId/config` 请求体示例：**

```json
{
  "codingProvider": "opencode",
  "llmProvider": "anthropic",
  "llmModel": "claude-3-7-sonnet-20250219",
  "llmApiKey": "sk-ant-...",
  "llmBaseUrl": "",
  "mcpServers": [
    { "name": "github-mcp", "url": "http://localhost:3001", "enabled": true, "transport": "sse" },
    { "name": "local-tool", "enabled": true, "transport": "stdio", "command": "node", "args": ["/path/to/server.js"] }
  ],
  "setupCommands": ["npm install", "npm run build"],
  "skills": []
}
```

---

### WebSocket 协议

使用 Socket.IO 连接到 `VITE_WS_URL`（默认 `http://localhost:5000`），支持 `websocket` 和 `polling` 传输。

**连接认证：**

```js
const socket = io('http://localhost:5000', {
  auth: { token: '<JWT accessToken>' }
});
```

认证失败时服务端发送 `error` 事件并断开连接。

#### 客户端发送事件

| 事件名 | 数据结构 | 说明 |
|--------|----------|------|
| `join_session` | `{ sessionId: string }` | 加入聊天会话房间；服务端回复 `session_joined` 和 `workspace_info` |
| `chat_message` | `{ sessionId, content, attachments?, planMode? }` | 发送编程指令（最大 100 KB），可携带图片/文件附件 |
| `plan_confirm` | `{ sessionId, planId, confirmed: boolean }` | 确认或拒绝 AI 生成的执行计划 |
| `code_execution` | `{ sessionId, workspaceId, command }` | 在工作区内执行 Shell 命令 |
| `start_dev_server` | `{ sessionId, workspaceId, command, port }` | 启动开发服务器（端口范围 1024–65535） |

`attachments` 数组元素结构：
```ts
{ path: string; name: string; mimeType: string; data?: string /* base64 */ }
```

#### 服务端推送事件

| 事件名 | 数据结构说明 | 说明 |
|--------|-------------|------|
| `session_joined` | `{ sessionId, messageCount }` | 成功加入会话 |
| `workspace_info` | `{ workspaceId, branch, fileCount, recentFiles, gitStatus }` | 工作区元信息 |
| `message` | 用户消息对象（含 `attachments`）| 用户消息已保存的广播 |
| `message_start` | `{ id, role: 'assistant', timestamp }` | AI 响应开始（流式） |
| `message_chunk` | `{ id, content, timestamp }` | AI 响应文本片段（逐块流式） |
| `message_complete` | 完整 assistant 消息对象 | AI 响应完成并已持久化 |
| `tool_call` | `{ id, toolName, input, output?, status, timestamp }` | AI 工具调用事件（file_write、bash、grep 等） |
| `code_change` | `{ id, filePath, changeType, diff?, timestamp }` | 代码文件变更通知（created/modified/deleted） |
| `plan_pending` | `{ id, steps, status: 'pending', timestamp }` | AI 生成执行计划，等待用户确认 |
| `plan_status` | `{ id, status: 'confirmed' \| 'rejected', timestamp }` | 计划确认/拒绝状态广播 |
| `dev_server_started` | `{ url, port, status: 'running', timestamp }` | 开发服务器已启动 |
| `execution_start` | `{ sessionId, command }` | Shell 命令开始执行 |
| `execution_complete` | `{ sessionId, result: { output, error, exitCode } }` | Shell 命令执行完毕 |
| `error` | `{ message: string }` | 错误通知 |

**房间模式：** 所有广播事件使用房间 `session:{sessionId}`，只有加入该会话的客户端可收到。

---

## MCP 服务注册

MCP（Model Context Protocol）服务器为 AI CLI 提供扩展工具能力，支持两种传输类型：

| 传输类型 | 字段 | 说明 |
|----------|------|------|
| `sse` | `url` | HTTP SSE 长连接，适用于远程/网络 MCP 服务 |
| `stdio` | `command` + `args` | 本地进程标准输入输出，适用于本地工具进程 |

### 通过 API 注册 MCP 服务

```bash
curl -X PUT \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  http://localhost:5000/api/opencode/<workspaceId>/config \
  -d '{
    "mcpServers": [
      {
        "name": "github-mcp",
        "url": "http://localhost:3001",
        "enabled": true,
        "transport": "sse"
      },
      {
        "name": "local-search",
        "enabled": true,
        "transport": "stdio",
        "command": "node",
        "args": ["/tools/search-server.js"]
      }
    ]
  }'
```

### 工作原理

每次用户发送编程指令时，后端将：

1. 从数据库加载该工作区的 AI 配置（含 MCP 服务器列表）
2. 在工作区目录生成 `.opencode.json` 配置文件
3. 调用 AI CLI，CLI 自动发现并连接已注册的 MCP 服务器
4. MCP 服务器提供的工具可被 LLM 自主调用

生成的 `.opencode.json` 示例：

```json
{
  "provider": "anthropic",
  "model": "claude-3-7-sonnet-20250219",
  "mcpServers": {
    "github-mcp": { "url": "http://localhost:3001" },
    "local-search": { "command": "node", "args": ["/tools/search-server.js"] }
  }
}
```

---

## 预设命令（Setup Commands）

支持为每个工作区配置最多 **20 条** Shell 命令，在每次 AI 编程会话启动前自动顺序执行，用于环境初始化。

**限制：** 每条命令最长 2048 字符，每条命令超时 60 秒；命令失败不会中断后续流程（仅记录警告日志）。

### 使用场景

```bash
npm install              # 安装项目依赖
pip install -r requirements.txt
export NODE_ENV=development
npx prisma migrate dev   # 数据库迁移
npm run build            # 预构建
```

### 通过 Web UI 配置

1. 打开任意工作区页面
2. 点击右上角 **⚙ 设置** 按钮
3. 在 **Setup Commands** 区域点击 **Add Command**
4. 输入要执行的 Shell 命令，点击 **Save Configuration** 保存

### 通过 API 配置

```bash
curl -X PUT \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  http://localhost:5000/api/opencode/<workspaceId>/config \
  -d '{
    "setupCommands": ["npm install", "npm run build"]
  }'
```

---

## 安全架构

### 认证机制

- **Access Token（JWT）**：有效期默认 24 小时，每次 API 请求在 `Authorization: Bearer` 头中携带
- **Refresh Token**：有效期 7 天，使用 `crypto.randomBytes` 生成不透明令牌，存储在 `refresh_tokens` 表
- **Token 轮换**：每次使用 Refresh Token 时，旧 Token 立即撤销并颁发新令牌对，防止 Token 重放攻击
- **密码修改撤销**：修改密码后撤销所有现有 Refresh Token，强制重新登录
- **密码强度校验**：8–128 字符，必须同时包含大写字母、小写字母和数字
- **生产模式保护**：`NODE_ENV=production` 时若 `JWT_SECRET` 为默认值 `your-secret-key`，服务拒绝启动

### 传输与访问安全

- **Helmet**：自动设置安全 HTTP 响应头（CSP、HSTS 等）
- **CORS**：仅允许 `ALLOWED_ORIGINS` 中配置的来源
- **速率限制**：全局 200 次/15分钟、认证端点 20 次/15分钟
- **密码哈希**：bcrypt（12 轮盐值）
- **输入验证**：所有 API DTO 通过 `class-validator` 严格校验，NestJS 全局 `ValidationPipe` 启用 `whitelist`（剥离未声明字段）
- **路径安全**：文件路径通过 `isValidRelativePath` 校验，防止路径遍历攻击
- **Shell 注入防护**：Shell 命令参数通过单引号转义（`'\''` 习语），包裹所有用户输入

### API Key 保护

`GET /api/opencode/:workspaceId/config` 返回配置时，`llmApiKey` 字段自动掩码（仅显示后 4 位），不在响应中泄露明文密钥。

---

## 项目结构

```
cloud-code-studio/
├── README.md                        # 本文档
├── start.sh                         # 一键构建 & 启动脚本
│
├── backend/                         # NestJS 后端
│   ├── package.json
│   ├── tsconfig.json
│   ├── nest-cli.json
│   ├── .env.example                 # 环境变量模板
│   └── src/
│       ├── main.ts                  # 入口：启动 HTTP + WebSocket，注册 Swagger
│       ├── app.module.ts            # 根模块（汇聚所有业务模块）
│       ├── config/                  # 配置模块（registerAs 分域注册）
│       │   ├── app.config.ts        # 端口、CORS、工作区目录等
│       │   ├── database.config.ts   # TypeORM MySQL 连接配置
│       │   ├── jwt.config.ts        # JWT 密钥与有效期
│       │   ├── opencode.config.ts   # 默认 LLM 配置
│       │   └── redis.config.ts      # Redis 连接配置
│       ├── common/                  # 共享代码
│       │   ├── constants.ts         # 全局常量（消息长度限制等）
│       │   ├── interfaces/          # TypeScript 接口与枚举定义
│       │   ├── validation.ts        # 路径/URL/端口校验工具函数
│       │   ├── decorators/          # @CurrentUser 等自定义装饰器
│       │   ├── filters/             # AllExceptionsFilter（统一错误响应）
│       │   ├── guards/              # JwtAuthGuard
│       │   ├── interceptors/        # ResponseInterceptor（{ code, message, data }）
│       │   └── dto/                 # 共享 DTO（分页等）
│       └── modules/                 # 业务模块
│           ├── auth/                # 认证（注册/登录/Token 轮换）
│           │   ├── auth.module.ts
│           │   ├── auth.controller.ts
│           │   ├── auth.service.ts
│           │   ├── dto/             # RegisterDto、LoginDto、ChangePasswordDto 等
│           │   └── entities/        # User、RefreshToken 实体
│           ├── workspace/           # 工作区管理（CRUD + git clone）
│           │   ├── workspace.module.ts
│           │   ├── workspace.controller.ts
│           │   ├── workspace.service.ts
│           │   ├── git.service.ts   # Git CLI 封装
│           │   ├── dto/
│           │   └── entities/        # Workspace 实体
│           ├── chat/                # 聊天（REST 会话管理 + Socket.IO 网关）
│           │   ├── chat.module.ts
│           │   ├── chat.controller.ts   # REST：会话 CRUD + SSE 消息流
│           │   ├── chat.gateway.ts      # Socket.IO：实时消息处理
│           │   ├── chat.service.ts
│           │   ├── dto/
│           │   └── entities/        # ChatSession、ChatMessage 实体
│           ├── file/                # 文件操作（树/读/写/上传）
│           │   ├── file.module.ts
│           │   ├── file.controller.ts
│           │   ├── file.service.ts
│           │   ├── dto/
│           │   └── entities/
│           └── opencode/            # AI 配置 + CLI 封装
│               ├── opencode.module.ts
│               ├── opencode.controller.ts    # AI 配置 CRUD
│               ├── opencode-config.service.ts
│               ├── opencode.service.ts       # OpenCode CLI 封装
│               ├── claude-code.service.ts    # Claude Code CLI 封装
│               ├── coding-service.factory.ts # 按配置路由到对应 CLI
│               ├── cache.service.ts          # Redis/内存缓存封装
│               ├── dto/
│               └── entities/        # OpenCodeConfig 实体
│
└── frontend/                        # React 19 前端
    ├── package.json
    ├── vite.config.ts               # Vite 8 + @tailwindcss/vite 插件
    ├── tsconfig.json
    ├── .env.example
    └── src/
        ├── main.tsx                 # React 入口
        ├── App.tsx                  # 路由 & 懒加载布局
        ├── app.css                  # TailwindCSS v4 @theme（oklch 色彩系统）
        ├── pages/
        │   ├── Login/               # 登录页
        │   ├── Register/            # 注册页
        │   ├── Dashboard/           # 工作区列表（创建/删除/跳转）
        │   └── Workspace/           # 主编程界面（Chat + 文件浏览器 + 设置）
        ├── components/
        │   ├── ui/                  # shadcn/ui 组件（Button、Card、Dialog 等）
        │   ├── Chat/                # 消息列表、工具调用、代码变更展示
        │   ├── FileExplorer/        # 文件树浏览器
        │   ├── OpenCodeSettings/    # LLM、MCP、Setup Commands 配置面板
        │   └── Common/              # ErrorBoundary、LoadingSpinner 等
        ├── hooks/
        │   ├── useWebSocket.ts      # Socket.IO 封装（refs 模式防内存泄漏）
        │   └── useAuth.ts           # 认证状态与操作
        ├── stores/                  # Zustand Store
        │   ├── authStore.ts         # 用户认证状态
        │   ├── workspaceStore.ts    # 工作区列表与当前工作区
        │   └── chatStore.ts         # 会话与消息状态
        ├── services/
        │   └── api.ts               # Axios 客户端（自动 Token 刷新、并发保护）
        ├── types/                   # 前端 TypeScript 类型
        └── utils/                   # 工具函数（时间格式化、颜色映射等）
```

---

## 开发指南

### 本地开发（热重载）

```bash
# 后端开发模式（文件变更自动重启）
cd backend
cp .env.example .env    # 首次需配置 MYSQL_* 和 JWT_SECRET
npm install
npm run dev             # 或 npm run dev:watch（nest build --watch）

# 前端开发模式（Vite HMR）
cd frontend
cp .env.example .env
npm install
npm run dev
```

### 构建生产版本

```bash
# 后端（输出到 backend/dist/）
cd backend && npm run build

# 前端（输出到 frontend/dist/）
cd frontend && npm run build
```

### 类型检查

```bash
cd backend  && npx tsc --noEmit
cd frontend && npx tsc --noEmit
```

### Swagger API 文档

开发模式启动后访问：`http://localhost:5000/api/docs`

所有端点均有完整的 `@ApiOperation`、`@ApiResponse` 和 DTO Schema 注解，可直接在 Swagger UI 中调试。

---

## 界面截图

> 📌 截图待补充。以下为各界面的文字说明。

### 工作区列表（Dashboard）

> 展示用户的所有工作区卡片，支持创建（填写 Git 仓库地址）、删除操作，以及工作区状态标签（creating / ready / error）。

<!-- 截图占位：部署运行后执行 npm run dev 访问 Dashboard 页面截图并保存至 docs/screenshots/dashboard.png -->

### AI 编程聊天界面

> 主工作区页面，左侧为文件浏览器，右侧为 AI 聊天面板。实时展示 AI 流式响应、工具调用过程、代码文件变更详情。

<!-- 截图占位：部署运行后访问 Workspace 页面截图并保存至 docs/screenshots/workspace-chat.png -->

### AI 配置面板

> 工作区设置弹窗，可配置 AI 引擎（Claude Code / Codex / GitHub Copilot CLI / OpenCode）、LLM 提供商与模型、API Key、MCP 服务器列表和预设命令。

<!-- 截图占位：部署运行后打开设置面板截图并保存至 docs/screenshots/opencode-settings.png -->

### 文件浏览器

> 内嵌文件树，支持展开/折叠目录、点击预览文件内容，与 AI 聊天联动展示最近变更文件。

<!-- 截图占位：部署运行后展开文件树截图并保存至 docs/screenshots/file-explorer.png -->

---

## 许可证

MIT
