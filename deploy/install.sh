#!/bin/sh
# KVideo 一键部署（官方镜像）
# 可调项：端口、源、访问密码。
#
#   sh install.sh                          # 3000 端口，自动选源，不设密码
#   sh install.sh 8080                     # 换端口
#   sh install.sh 8080 <源地址>             # 端口 + 源
#   sh install.sh --password 你的密码        # 设置登录密码（推荐）
#   sh install.sh --premium 你的密码         # 高级内容独立密码
#   sh install.sh --force                  # 已有同名容器时删掉重建
#
# 密码也可以走环境变量：ADMIN_PASSWORD=xxx sh install.sh
set -e

NAME=kvideo
IMAGE=kuekhaoyang/kvideo:latest   # 官方镜像，不做任何替换
PORT=3000
SUB=""
PASS=""
PREM=""
FORCE=0

say() { printf '%s\n' "$*"; }
die() { say "✗ $*"; exit 1; }

while [ $# -gt 0 ]; do
  case "$1" in
    --force) FORCE=1; shift ;;
    --password|--pass)
      [ $# -ge 2 ] || die "--password 后面要跟密码"
      PASS="$2"; shift 2 ;;
    --premium)
      [ $# -ge 2 ] || die "--premium 后面要跟密码"
      PREM="$2"; shift 2 ;;
    http*) SUB="$1"; shift ;;
    *[!0-9]*|'') shift ;;
    *) PORT="$1"; shift ;;
  esac
done
[ -n "$PASS" ] || PASS="${ADMIN_PASSWORD:-}"
[ -n "$PREM" ] || PREM="${PREMIUM_PASSWORD:-}"

# 密码走 -e 传，含引号/美元符会破坏参数，提前拦住
check_pw() {
  case "$1" in
    *[\"\$\`\\]*) die "密码里不要用双引号、$、反引号、反斜杠" ;;
  esac
}
if [ -n "$PASS" ]; then check_pw "$PASS"; fi
if [ -n "$PREM" ]; then check_pw "$PREM"; fi

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

# ---------- 4. 启动：端口 + 源 + 密码 ----------
say "▶ 启动容器（端口 $PORT）"
set -- -d --name "$NAME" --restart unless-stopped -p "$PORT:3000"
if [ -n "$SUB" ]; then
  set -- "$@" -e "SUBSCRIPTION_SOURCES=[{\"name\":\"汇总\",\"url\":\"$SUB\"}]"
fi
if [ -n "$PASS" ]; then
  set -- "$@" -e "ADMIN_PASSWORD=$PASS"
  say "  ✓ 已设置登录密码"
else
  say "  · 未设登录密码，同网段任何人都能直接打开"
fi
if [ -n "$PREM" ]; then
  set -- "$@" -e "PREMIUM_PASSWORD=$PREM"
  say "  ✓ 已设置高级内容独立密码"
fi
docker run "$@" "$IMAGE" >/dev/null

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
case "$AUTH" in
  *'"hasAuth":true'*) say "  ✓ 登录已启用" ;;
  *'"hasAuth":false'*) say "  · 登录未启用（访问无需密码）" ;;
esac
case "$AUTH" in
  *'"hasPremiumAuth":true'*) say "  ✓ 高级内容独立密码已启用" ;;
esac

IP=$(ip route get 1 2>/dev/null | awk '{print $NF; exit}')
[ -n "$IP" ] || IP=$(hostname -I 2>/dev/null | awk '{print $1}')
[ -n "$IP" ] || IP=$(ip -4 addr show 2>/dev/null | awk '/inet /{print $2}' | grep -v '^127' | cut -d/ -f1 | head -1)
[ -n "$IP" ] || IP="<本机IP>"

say ""
say "完成：http://$IP:$PORT"
say "设置页：http://$IP:$PORT/settings（订阅点「立即更新」，应为 101 条）"
if [ -n "$PASS" ]; then say "登录密码：安装时指定的那个；忘记就加 --force 重建并重设"; fi
