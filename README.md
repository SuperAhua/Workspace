# MyWorkspace · 个人本地工作台

**把平时真正在用的几个小工具收进一个界面**：记账、健身打卡、日程待办。
左栏导航 + 右侧内容区，纯静态页面，没有后端、没有账号、没有数据库 —— 所有数据只存在你自己的浏览器里。

[**▶ 在线使用**](https://superahua.github.io/Workspace/) · [GitHub 仓库](https://github.com/SuperAhua/Workspace)

---

## 这是什么

一个"自己给自己用"的工作台外壳。每个应用都是**独立的完整页面**，被外壳用 iframe 挂在右侧内容区里，
所以三个应用各自带一整套全局样式、各自用 localStorage 存数据，互相完全隔离，谁也不会污染谁。

切换应用时 iframe 不销毁 —— 记账页翻到哪个月、健身页聊到哪一句，切回来都还在原地。

## 三个应用

| 应用 | 一句话 | 主要功能 |
| --- | --- | --- |
| **随手记** | 本地记账 | 一句话记账（输入「早饭 15」自动解析金额与分类）、日历视图、分类统计图表、账户与预算 |
| **锻炼打卡** | AI 私教 | 训练计划与每日打卡、身体档案、接入大模型出计划（DeepSeek / 通义 / Kimi / 智谱 / OpenAI / SiliconFlow 等） |
| **日常** | 一件一件做 | 今日清单、SOP 步骤流程、到点提醒（含桌面通知）、农历与节假日 |

> **AI 功能需要自备密钥**：锻炼打卡的模型调用由你在应用内「设置」里填写 API Key，
> 密钥只写进本机 localStorage，不会上传到任何服务器。不填也能用打卡、档案等基础功能。

## 在线使用

直接打开：**<https://superahua.github.io/Workspace/>**

由 GitHub Pages 从 `main` 分支根目录自动构建，仓库更新后一分钟左右生效。

## 本地使用

下载仓库后双击 `index.html` 即可，不需要起服务、不需要装依赖，断网也能用
（健身页的农历/节假日数据首次会尝试走 CDN，取不到就降级；日常的农历库已放本地 `apps/workout/_vendor/`）。

## 桌面端快捷键

| 操作 | 快捷键 |
| --- | --- |
| 切换应用 | 点左栏 / `Ctrl`(`⌘`)+`K` 搜索 / `Alt`+`1`~`9` |
| 折叠侧栏 | `Alt`+`B`（折叠成 68px 图标轨，状态会记住） |
| 手机尺寸预览 | `Alt`+`P` |
| 刷新当前应用 | `Alt`+`R` |
| 直接打开某个应用 | 地址栏 `#/ledger`、`#/workout`、`#/daily` |

手机上则是点顶栏应用名弹出切换面板，同一个"切换"入口的两种形态。
上次打开的应用、侧栏折叠状态、预览开关都会被记住。

## 目录结构

```
index.html                     工作台外壳：左栏、顶栏、iframe 容器、快捷键与路由
apps/
├─ ledger/                     随手记
│  ├─ index.html  app.js  parser.js  styles.css   ← parser.js 负责"一句话记账"的解析
│  ├─ manifest.json  icon-*.png
│  └─ vendor/echarts.min.js    统计图表（本地内置，不依赖 CDN）
├─ workout/                    锻炼打卡（单文件应用）
│  ├─ index.html               UI + 逻辑全部内联
│  └─ _vendor/lunar.min.js     农历库（本地优先，取不到才回退 CDN）
└─ daily/                      日常
   ├─ index.html  main.js  manifest.webmanifest  icon-192.png
tools/sync_to_github.py        同步脚本的推送实现（见下文）
sync.sh                        一键同步
```

## 加一个新应用

1. 把文件丢进 `apps/`，比如 `apps/timer/index.html`；
2. 打开 `index.html`，在 `apps` 数组里加一行：

```js
{
  id: 'timer',                     // 唯一标识，也是地址栏 #/timer
  name: '番茄钟',
  sub: '25 分钟专注',               // 可选，手机切换面板的副标题
  url: 'apps/timer/index.html',
  accent: '#c4694a',               // 可选，选中时的主题色
  width: 720,                      // 可选，桌面端 iframe 最大宽度
  icon: '<svg viewBox="0 0 24 24">…</svg>'  // 可选，内联 SVG 或 emoji
}
```

刷新即可 —— 左栏菜单、手机切换面板、搜索、快捷键、顶栏标题全部自动出现，**其它代码一行都不用改**。

> 图标建议用内联 SVG：它会跟随文字颜色（未选中为灰、选中染成该应用的 accent），比 emoji 更成套。

## 数据与隐私

- 三个应用各用各的 localStorage 前缀，互不冲突：随手记 `shoujizhang.*`、锻炼打卡 `wt.*`、日常 `daily*`。
- **没有任何数据离开你的浏览器**，仓库里也不含任何记录（截图/示例里也看不到你的账目）。
- localStorage 按**源**隔离：`file://` 打开的旧数据不会自动跟到 `https://superahua.github.io` 上。
  换设备或换地址时，用各应用自带的「备份 / 导入」走一次即可。
- 清空浏览器数据 = 数据消失，重要记录请定期导出备份。

## 部署

站点由 **GitHub Pages** 托管（`main` 分支根目录，`legacy` 构建，强制 HTTPS）：

> Settings → Pages → Source 选 `Deploy from a branch` → `main` / `/ (root)`

推送方式见下节。构建产物不需要提交，Pages 直接读源码。

## 同步到 GitHub

仓库：<https://github.com/SuperAhua/Workspace>（`main` 分支）。改动任意文件后：

```bash
bash sync.sh "本次改动说明"
```

**为什么不用 `git push`**：开发机访问 `github.com` 会 CONNECT 502 / TLS 中断，但 `api.github.com` 可达。
所以 `sync.sh` 调用 `tools/sync_to_github.py`，用 GitHub **Git Data API** 直接构造 blob → tree → commit → 移动分支引用，
效果与 push 等价，且能正确处理 PNG 等二进制文件。

- 用 git blob sha1 比对本地与远端，**只上传有变化的文件**；无改动时直接退出，不产生空提交。
- 本地仍会先 `git add` + `git commit`，保留一份可追溯的本地历史（与远端是两条独立 lineage，别手动 push）。
- 凭证从系统凭据管理器（`git credential fill`）读取，不落明文文件；可用 `GITHUB_TOKEN` 或 `GITHUB_TOKEN_FILE` 覆盖。

## 来源与改动

三个应用原本是 Workspace 上的独立站点，这里是从线上镜像下来的**完整离线副本**，并做了少量适配：

- 去掉「随手记」的 Service Worker 注册，避免子目录缓存与工作台打架。
- 「锻炼打卡」的农历库改为本地优先（`_vendor/lunar.min.js`），取不到才回退 CDN。
- 「日常」移除了指向不存在的 `sw.js` 的注册逻辑。

线上原站（数据在那边，本仓库是快照）：

- 锻炼打卡：`https://workout-checkin-38178.app.workbuddy.host/?sharecode=LESSFS3DXU`
- 日常：`https://wbapp-ckkoddmsbrkw3qhwornkg1.app.workbuddy.host/?sharecode=6N4JQIAFCZ`

> 抓取这类托管站时有个坑：`index.html` 带 `?sharecode=` 能直接拿，但**子资源**（`main.js`、`icon-*.png`、`manifest.webmanifest`）
> 不带分享码会 403「链接不完整」，需要把同一个 sharecode 拼到子资源地址后面。

## License

个人使用项目，未附开源许可证。
