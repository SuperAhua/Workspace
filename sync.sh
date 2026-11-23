#!/bin/bash
# MyWorkspace → GitHub 同步脚本
# 用法：bash sync.sh "本次改动说明"
# 自动 add 全部改动、commit、带重试 push 到 origin/main

set -u
cd "$(dirname "$0")" || exit 1

MSG="${1:-chore: 同步工作台改动}"

# 有改动才提交
if [ -z "$(git status --porcelain)" ]; then
  echo "没有需要同步的改动。"
  exit 0
fi

git add -A
git commit -m "$MSG" || exit 1

# 带重试推送（代理会间歇性 502）
for i in $(seq 1 30); do
  echo "推送尝试 $i/30 ..."
  if git -c http.sslBackend=openssl -c http.version=HTTP/1.1 push origin main 2>&1; then
    echo "同步完成：$MSG"
    exit 0
  fi
  sleep 3
done

echo "推送失败：网络代理不可用，改动已本地提交，稍后可重新运行 bash sync.sh"
exit 1
