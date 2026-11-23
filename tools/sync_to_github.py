#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""把本地工作台目录同步到 GitHub 仓库。

为什么不用 git push：本机网络无法访问 github.com（CONNECT 502 / TLS 中断），
但 api.github.com 可达，因此改用 GitHub Git Data API 直接写提交。

用法：
    python tools/sync_to_github.py "提交说明"

凭证获取顺序：
    1. 环境变量 GITHUB_TOKEN
    2. 环境变量 GITHUB_TOKEN_FILE 指向的文件
    3. 系统 Git 凭证管理器（GCM，Windows 凭据管理器）
"""
import base64
import hashlib
import json
import os
import subprocess
import sys
import urllib.error
import urllib.request

OWNER = "SuperAhua"
REPO = "Workspace"
BRANCH = "main"
API = "https://api.github.com"

REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

SKIP_DIRS = {".git", "node_modules", ".idea", ".vscode", "__pycache__"}
SKIP_FILES = {".DS_Store", "Thumbs.db"}
SKIP_EXT = {".swp", ".tmp", ".log"}


def get_token():
    t = os.environ.get("GITHUB_TOKEN", "").strip()
    if t:
        return t
    f = os.environ.get("GITHUB_TOKEN_FILE", "").strip()
    if f and os.path.exists(f):
        with open(f, "r", encoding="utf-8") as fh:
            return fh.read().strip()
    # 回退：从系统凭证管理器取
    try:
        p = subprocess.run(
            ["git", "credential", "fill"],
            input="protocol=https\nhost=github.com\n\n",
            capture_output=True, text=True, timeout=25,
        )
        for line in p.stdout.splitlines():
            if line.startswith("password="):
                return line[len("password="):].strip()
    except Exception:
        pass
    return ""


TOKEN = get_token()
if not TOKEN:
    sys.exit("错误：未取到 GitHub 凭证（可用环境变量 GITHUB_TOKEN 或 GITHUB_TOKEN_FILE 指定）")

HEADERS = {
    "Authorization": f"Bearer {TOKEN}",
    "Accept": "application/vnd.github+json",
    "User-Agent": "workspace-sync",
    "Content-Type": "application/json",
    "X-GitHub-Api-Version": "2022-11-28",
}


def api(method, path, payload=None, ok=(200, 201)):
    url = API + path
    data = json.dumps(payload).encode("utf-8") if payload is not None else None
    req = urllib.request.Request(url, data=data, headers=HEADERS, method=method)
    try:
        with urllib.request.urlopen(req, timeout=90) as r:
            return json.loads(r.read().decode("utf-8") or "{}")
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8", "replace")
        if e.code in ok:
            return {"_code": e.code, "_body": body}
        raise RuntimeError(f"{method} {path} -> {e.code}: {body[:300]}")


def git_blob_sha(data: bytes) -> str:
    h = hashlib.sha1()
    h.update(b"blob %d\x00" % len(data))
    h.update(data)
    return h.hexdigest()


def collect():
    out = []
    for dirpath, dirnames, filenames in os.walk(REPO_ROOT):
        dirnames[:] = [d for d in dirnames if d not in SKIP_DIRS]
        for fn in filenames:
            if fn in SKIP_FILES or os.path.splitext(fn)[1] in SKIP_EXT:
                continue
            full = os.path.join(dirpath, fn)
            rel = os.path.relpath(full, REPO_ROOT).replace("\\", "/")
            with open(full, "rb") as f:
                out.append((rel, f.read()))
    out.sort(key=lambda x: x[0])
    return out


def main():
    msg = sys.argv[1] if len(sys.argv) > 1 else "chore: 同步工作台更新"
    files = collect()
    print(f"本地文件 {len(files)} 个，共 {sum(len(c) for _, c in files)} 字节")

    # 远端当前状态
    head = None
    remote_shas = {}
    try:
        ref = api("GET", f"/repos/{OWNER}/{REPO}/git/ref/heads/{BRANCH}")
        head = ref["object"]["sha"]
        tree = api("GET", f"/repos/{OWNER}/{REPO}/git/trees/{head}?recursive=1")
        remote_shas = {t["path"]: t["sha"] for t in tree.get("tree", []) if t["type"] == "blob"}
        print(f"远端 HEAD: {head[:8]}（{len(remote_shas)} 个文件）")
    except RuntimeError:
        print("远端为空，将创建首个提交")

    entries = []
    new_count = 0
    for rel, data in files:
        sha = git_blob_sha(data)
        if remote_shas.get(rel) != sha:
            blob = api("POST", f"/repos/{OWNER}/{REPO}/git/blobs", {
                "content": base64.b64encode(data).decode("ascii"),
                "encoding": "base64",
            })
            sha = blob["sha"]
            new_count += 1
            print(f"  ↑ {rel}")
        entries.append({"path": rel, "mode": "100644", "type": "blob", "sha": sha})

    deleted = sorted(set(remote_shas) - {p for p, _ in files})
    for d in deleted:
        print(f"  ✗ 删除 {d}")

    if head is not None and new_count == 0 and not deleted:
        print("没有变化，无需提交")
        return

    tree = api("POST", f"/repos/{OWNER}/{REPO}/git/trees", {"tree": entries})
    payload = {"message": msg, "tree": tree["sha"]}
    if head:
        payload["parents"] = [head]
    commit = api("POST", f"/repos/{OWNER}/{REPO}/git/commits", payload)

    if head:
        api("PATCH", f"/repos/{OWNER}/{REPO}/git/refs/heads/{BRANCH}", {"sha": commit["sha"]})
    else:
        api("POST", f"/repos/{OWNER}/{REPO}/git/refs", {"ref": f"refs/heads/{BRANCH}", "sha": commit["sha"]})

    print(f"已同步：{new_count} 个文件更新，提交 {commit['sha'][:8]}")
    print(f"https://github.com/{OWNER}/{REPO}/commit/{commit['sha']}")


if __name__ == "__main__":
    main()
