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
