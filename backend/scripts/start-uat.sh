#!/usr/bin/env bash
# UAT 环境启动脚本
# 固化关键环境变量，避免手动配置遗漏或错误
# 用法: ./scripts/start-uat.sh [额外 node 参数]

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$PROJECT_DIR"

# 强制 UAT 关键配置，确保与 .env.uat 一致
export NODE_ENV=uat
export OPTIMIZATION_CONSENT_SKIP=false

# TUSHARE_TOKEN 默认空值：UAT 未接入真实行情源时，显式启用 mock fallback
# 若已配置真实 Token，可通过外部 env 注入覆盖
export TUSHARE_TOKEN="${TUSHARE_TOKEN:-}"

echo "[start-uat] NODE_ENV=$NODE_ENV"
echo "[start-uat] OPTIMIZATION_CONSENT_SKIP=$OPTIMIZATION_CONSENT_SKIP"

if [ -z "${TUSHARE_TOKEN:-}" ]; then
  echo "[start-uat] TUSHARE_TOKEN 未设置，将使用 mock 市场数据（UAT 测试环境适用）"
else
  echo "[start-uat] TUSHARE_TOKEN 已设置，使用真实行情源"
fi

if [ ! -d "$PROJECT_DIR/dist" ]; then
  echo "[start-uat] dist 目录不存在，先执行 npm run build"
  npm run build
fi

exec node "$PROJECT_DIR/dist/app.js" "$@"
