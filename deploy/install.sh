#!/bin/sh
# KVideo 一键部署
#   起一个 KVideo 容器，并把本仓库的汇总源挂成默认订阅。
# 用法：
#   sh install.sh               # 默认 3000 端口
#   sh install.sh 8080          # 指定端口
#   sh install.sh 3000 --force  # 已有同名容器时先删再建
set -e

NAME=kvideo
IMAGE=kuekhaoyang/kvideo:latest
PORT=${1:-3000}
FORCE=0
[ "$2" = "--force" ] && FORCE=1

# 订阅地址按「本机网络实际能通」的顺序挑，国内机器通常只有 gcore 通
SUB_GCORE="https://gcore.jsdelivr.net/gh/boderline7/kvideo-config@main/dist/kvideo-merged.json"
SUB_CDN="https://cdn.jsdelivr.net/gh/boderline7/kvideo-config@main/dist/kvideo-merged.json"
SUB_RAW="https://raw.githubusercontent.com/boderline7/kvideo-config/main/dist/kvideo-merged.json"

say() { printf '%s\n' "$*"; }
die() { say "✗ $*"; exit 1; }

# ---------- 1. 环境检查 ----------
command -v docker >/dev/null 2>&1 || die "没有找到 docker，请先安装 Docker"
docker info >/dev/null 2>&1 || die "Docker 服务未运行，请先启动"

# ---------- 2. 挑一个能取到列表的订阅地址 ----------
fetch() {
  if command -v curl >/dev/null 2>&1; then
    curl -fsSL -m 12 "$1" 2>/dev/null
  else
    wget -qO- -T 12 "$1" 2>/dev/null
  fi
}

say "▶ 测试订阅地址可通性"
SUB=""
for u in "$SUB_GCORE" "$SUB_CDN" "$SUB_RAW"; do
  body=$(fetch "$u" || true)
  case "$body" in
    *'"sources"'*) SUB="$u"; say "  ✓ 可用：$u"; break ;;
    *) say "  · 不通：$u" ;;
  esac
done
[ -n "$SUB" ] || say "  ! 三个地址都取不到，容器照建，订阅稍后手动添加"

# ---------- 3. 旧容器处理 ----------
if docker ps -a --format '{{.Names}}' 2>/dev/null | grep -qx "$NAME"; then
  if [ "$FORCE" = "1" ]; then
    say "▶ 删除旧容器 $NAME"
    docker rm -f "$NAME" >/dev/null
  else
    die "已存在容器 $NAME。加 --force 重建，或先执行 docker rm -f $NAME"
  fi
fi

# ---------- 4. 启动 ----------
say "▶ 启动容器（端口 $PORT）"
if [ -n "$SUB" ]; then
  docker run -d \
    --name "$NAME" \
    --restart unless-stopped \
    -p "$PORT:3000" \
    -e TZ=Asia/Shanghai \
    -e MERGE_SOURCES=true \
    -e ALLOW_LAN_ACCESS=true \
    -e "SUBSCRIPTION_SOURCES=[{\"name\":\"汇总\",\"url\":\"$SUB\"}]" \
    "$IMAGE" >/dev/null
else
  docker run -d \
    --name "$NAME" \
    --restart unless-stopped \
    -p "$PORT:3000" \
    -e TZ=Asia/Shanghai \
    -e MERGE_SOURCES=true \
    -e ALLOW_LAN_ACCESS=true \
    "$IMAGE" >/dev/null
fi

# ---------- 5. 等就绪 ----------
say "▶ 等待服务就绪"
i=0
while [ "$i" -lt 30 ]; do
  if fetch "http://127.0.0.1:$PORT/api/auth" >/dev/null 2>&1; then break; fi
  sleep 2
  i=$((i + 1))
done

# ---------- 6. 自检 ----------
AUTH=$(fetch "http://127.0.0.1:$PORT/api/auth" || true)
case "$AUTH" in
  *subscriptionSources*) say "  ✓ 接口已响应" ;;
  *) say "  ! 接口无响应，看日志：docker logs --tail 50 $NAME" ;;
esac
case "$AUTH" in
  *kvideo-merged.json*) say "  ✓ 订阅已挂载（汇总源）" ;;
  *) say "  · 订阅未挂载，进设置页手动添加" ;;
esac

IP=$(ip route get 1 2>/dev/null | awk '{print $NF; exit}')
[ -n "$IP" ] || IP=$(hostname -I 2>/dev/null | awk '{print $1}')
[ -n "$IP" ] || IP=$(ip -4 addr show 2>/dev/null | awk '/inet /{print $2}' | grep -v '^127' | cut -d/ -f1 | head -1)
[ -n "$IP" ] || IP="<本机IP>"

say ""
say "完成。访问：http://$IP:$PORT"
say "设置页：http://$IP:$PORT/settings"
say "高级入口：http://$IP:$PORT/premium"
say "全量应为 101 条（常规 61 + 受限 40）。"
