# Iterative Development Harness

## 项目概述
本项目使用 Harness 驱动的迭代开发模式，通过 Planner-Builder-Evaluator 三角色协作，
从 0 开始构建高质量的应用。支持**前端**和**后端**两种项目类型。
所有变更通过 Git + Sprint 日志 + 设计决策日志三层追踪。

## 技术栈

### 前端
- React 19 + TypeScript
- Vite 8
- TailwindCSS v4（CSS-first 配置，@theme + @import "tailwindcss" + oklch 色彩空间）
- shadcn/ui（优先使用的组件库，基于 Radix UI 原语）
- Zustand（轻量级状态管理）

### 后端
- NestJS + TypeScript（严格模式）
- TypeORM（数据库 ORM）
- class-validator + class-transformer（DTO 验证）
- @nestjs/swagger（API 文档）
- @nestjs/config（配置管理）
- Jest（测试）

### 通用
- 根据项目需要可引入其他依赖

## ⚠️ 关键规则

### 开始任何工作前
1. **必读** `.tracking/product-spec.md` 了解当前产品状态
2. **必读** `.tracking/current-sprint.md` 了解当前 Sprint 合同
3. **必读** `.tracking/design-decisions.md` 了解已做决策

### 编码规范（通用）
1. 每完成一个**独立功能点**，必须 `git commit`，遵循 commit 规范
2. commit 格式: `<type>(<scope>): <description>`
   - type: feat/fix/hotfix/style/refactor/docs/chore/sprint/test/perf
   - scope: 组件名或模块名
3. 不允许使用 `any` 类型（TypeScript）

### 前端编码规范
4. 组件必须有清晰的 Props 类型定义
5. TailwindCSS v4 规范:
   - 使用 `@theme` 定义设计 Token（而非 tailwind.config.js）
   - 使用 `@import "tailwindcss"` 替代旧版 `@tailwind` 指令
   - 复杂样式使用 `@apply` 提取为语义化 class
   - 自定义主题变量通过 `@theme { }` 块定义

### 后端编码规范
4. 严格遵循 Module → Controller → Service 分层
5. DTO 必须使用 `class-validator` 装饰器验证
6. API 端点必须有 Swagger 文档（`@ApiOperation`, `@ApiResponse`）
7. 使用 NestJS `Logger` 而非 `console.log`
8. 异常使用 NestJS 内置异常类（`NotFoundException` 等）

### 设计标准（前端项目 — 极高标准 9/10）
1. 拒绝 "AI slop" 设计：零容忍紫色渐变+白色卡片等模板风格
2. 每个页面必须有**统一的设计语言**（oklch 自定义色彩、字体、间距）
3. 必须支持响应式布局（mobile-first + dark mode）
4. 交互元素必须有完整状态链（hover → active → focus-visible）
5. 使用系统字体栈（system-ui）或本地安装字体，禁止依赖 Google Fonts 等外部字体服务
6. **评审通过标准: 加权总分 >= 9/10，每维度 >= 8/10**
7. **设计必须达到博物馆级精致** — 平庸即不合格

### API 质量标准（后端项目 — 高标准 9/10）
1. RESTful 路由命名（复数名词、kebab-case）
2. 统一响应格式（`{ code, message, data }`）
3. 输入验证覆盖所有端点
4. 错误处理不泄露内部信息
5. Swagger 文档可直接供前端使用
6. **评审通过标准: 加权总分 >= 9/10，每维度 >= 8/10**

### 追踪要求
1. 所有设计决策必须记录到 `.tracking/design-decisions.md`
2. Sprint 完成后必须更新 `.tracking/sprint-log.md`
3. 产品规格变更必须更新 `.tracking/product-spec.md`
4. 线上 Bug 修复必须记录到 `.tracking/hotfix-log.md`

## 可用命令
- `/init` - 初始化前端项目（React + Vite 8 + TailwindCSS v4）
- `/init-backend` - 初始化后端项目（NestJS + TypeScript）
- `/plan` - 规划新功能，将需求拆分为 Sprint
- `/sprint` - 开始当前 Sprint，按合同逐个实现功能
- `/review` - 触发质量评审（含人工评审环节）
- `/hotfix` - 线上 Bug 紧急修复（独立于 Sprint 周期）
- `/checkpoint` - 保存当前进度快照
- `/status` - 查看项目当前状态和进度
- `/new-feature` - 完整的新功能开发流程（plan → sprint → review → checkpoint）
- `/iteration-cycle` - 单轮迭代循环，适用于连续开发
- `/design-review` - 前端设计评审流程

## 文件结构约定

### 前端项目
```
src/
├── components/     # 可复用组件（每个组件一个目录）
│   └── Button/
│       ├── Button.tsx
│       └── index.ts
├── components/ui/  # shadcn/ui 组件（CLI 自动生成，不手动创建）
├── pages/          # 页面组件
├── hooks/          # 自定义 Hooks
├── stores/         # Zustand Store（每个领域一个文件）
├── utils/          # 工具函数
├── lib/            # shadcn/ui 工具（cn 函数等）
├── types/          # TypeScript 类型定义
├── assets/         # 静态资源
├── app.css         # 全局样式 + TailwindCSS v4 @theme 配置
├── App.tsx
└── main.tsx
```

### 后端项目
```
src/
├── modules/           # 业务模块（每个领域一个模块）
│   └── user/
│       ├── user.module.ts
│       ├── user.controller.ts
│       ├── user.service.ts
│       ├── dto/
│       ├── entities/
│       └── *.spec.ts
├── common/            # 共享代码
│   ├── decorators/    # 自定义装饰器
│   ├── filters/       # 异常过滤器
│   ├── guards/        # 守卫
│   ├── interceptors/  # 拦截器
│   ├── pipes/         # 管道
│   ├── dto/           # 共享 DTO（分页等）
│   └── interfaces/    # 共享接口
├── config/            # 配置模块
├── database/          # 数据库（迁移、种子数据）
├── app.module.ts      # 根模块
└── main.ts            # 入口
```

## TailwindCSS v4 配置规范（前端项目）
```css
/* app.css — TailwindCSS v4 入口 */
@import "tailwindcss";

@theme {
  /* 色彩系统 — 必须自定义，禁止使用默认色板 */
  --color-primary-*: ...;
  --color-accent-*: ...;
  --color-surface-*: ...;

  /* 字体 — 使用系统字体栈，禁止外部字体服务 */
  --font-sans: system-ui, -apple-system, sans-serif;
  --font-mono: ui-monospace, 'SFMono-Regular', monospace;

  /* 间距、圆角等通过 @theme 扩展 */
}
```
