#!/bin/sh
# KVideo 一键部署（官方镜像）
# 只做两件事：指定端口、指定源。
#
#   sh install.sh                    # 3000 端口，自动选一个能通的源
#   sh install.sh 8080               # 换端口
#   sh install.sh 8080 <源地址>       # 端口 + 源都指定
#   sh install.sh --force            # 已有同名容器时删掉重建
set -e

NAME=kvideo
IMAGE=kuekhaoyang/kvideo:latest   # 官方镜像，不做任何替换
PORT=3000
SUB=""
FORCE=0

for a in "$@"; do
  case "$a" in
    --force) FORCE=1 ;;
    http*) SUB="$a" ;;
    *[!0-9]*|'') : ;;
    *) PORT="$a" ;;
  esac
done

say() { printf '%s\n' "$*"; }
die() { say "✗ $*"; exit 1; }

fetch() {
  if command -v curl >/dev/null 2>&1; then
    curl -fsSL -m 12 "$1" 2>/dev/null
  else
    wget -qO- -T 12 "$1" 2>/dev/null
  fi
}

# ---------- 1. 环境 ----------
command -v docker >/dev/null 2>&1 || die "没有找到 docker，请先安装"
docker info >/dev/null 2>&1 || die "Docker 服务未运行"

# ---------- 2. 源：没指定就自动挑一个能通的 ----------
if [ -z "$SUB" ]; then
  say "▶ 未指定源，自动挑选"
  for u in \
    "https://gcore.jsdelivr.net/gh/boderline7/kvideo-config@main/dist/kvideo-merged.json" \
    "https://cdn.jsdelivr.net/gh/boderline7/kvideo-config@main/dist/kvideo-merged.json" \
    "https://raw.githubusercontent.com/boderline7/kvideo-config/main/dist/kvideo-merged.json"
  do
    case "$(fetch "$u" || true)" in
      *'"sources"'*) SUB="$u"; say "  ✓ $u"; break ;;
      *) say "  · 不通 $u" ;;
    esac
  done
  [ -n "$SUB" ] || say "  ! 都取不到，容器照建，订阅稍后再加"
else
  say "▶ 使用指定源：$SUB"
fi

# ---------- 3. 旧容器 ----------
if docker ps -a --format '{{.Names}}' 2>/dev/null | grep -qx "$NAME"; then
  [ "$FORCE" = "1" ] || die "已有容器 $NAME，加 --force 重建"
  say "▶ 删除旧容器"
  docker rm -f "$NAME" >/dev/null
fi

# ---------- 4. 启动：只有端口和源 ----------
say "▶ 启动容器（端口 $PORT）"
if [ -n "$SUB" ]; then
  docker run -d --name "$NAME" --restart unless-stopped -p "$PORT:3000" \
    -e "SUBSCRIPTION_SOURCES=[{\"name\":\"汇总\",\"url\":\"$SUB\"}]" \
    "$IMAGE" >/dev/null
else
  docker run -d --name "$NAME" --restart unless-stopped -p "$PORT:3000" \
    "$IMAGE" >/dev/null
fi

# ---------- 5. 自检 ----------
say "▶ 等待就绪"
i=0
while [ "$i" -lt 30 ]; do
  if fetch "http://127.0.0.1:$PORT/api/auth" >/dev/null 2>&1; then break; fi
  sleep 2
  i=$((i + 1))
done

AUTH=$(fetch "http://127.0.0.1:$PORT/api/auth" || true)
case "$AUTH" in
  *subscriptionSources*) say "  ✓ 接口已响应" ;;
  *) say "  ! 接口无响应，看日志：docker logs --tail 50 $NAME" ;;
esac
case "$AUTH" in
  *kvideo-merged.json*) say "  ✓ 源已挂载" ;;
  *) say "  · 源未挂载，进设置页手动添加" ;;
esac

IP=$(ip route get 1 2>/dev/null | awk '{print $NF; exit}')
[ -n "$IP" ] || IP=$(hostname -I 2>/dev/null | awk '{print $1}')
[ -n "$IP" ] || IP=$(ip -4 addr show 2>/dev/null | awk '/inet /{print $2}' | grep -v '^127' | cut -d/ -f1 | head -1)
[ -n "$IP" ] || IP="<本机IP>"

say ""
say "完成：http://$IP:$PORT"
say "设置页：http://$IP:$PORT/settings（订阅点「立即更新」，应为 101 条）"
