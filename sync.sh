#!/bin/bash
# MyWorkspace → GitHub 同步脚本
#
# 用法：bash sync.sh "本次改动说明"
#
# 说明：本机网络访问不了 github.com（CONNECT 502 / TLS 中断），
#      所以不走 git push，改用 api.github.com 的 Git Data API 直写提交。
#      凭证从系统 Git 凭证管理器读取；也可用 GITHUB_TOKEN_FILE 指定文件。

set -u
cd "$(dirname "$0")" || exit 1

MSG="${1:-chore: 同步工作台改动}"

# 本地也保留一份 git 提交记录（即便推不上去，历史仍可追溯）
if [ -n "$(git status --porcelain 2>/dev/null)" ]; then
  git add -A >/dev/null 2>&1
  git commit -m "$MSG" >/dev/null 2>&1 && echo "本地提交完成"
fi

python "$(dirname "$0")/tools/sync_to_github.py" "$MSG"
