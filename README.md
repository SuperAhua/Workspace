# MyWorkspace · 本地工作台

> GitHub 仓库：<https://github.com/SuperAhua/Workspace>

一个左栏导航 + 右内容区的本地工作台，三个应用已经装好：

| 应用 | 说明 | 入口 |
| --- | --- | --- |
| 随手记 | 本地记账：一句话记账、日历、统计、账户与预算 | `apps/ledger/index.html` |
| 锻炼打卡 | AI 私教：训练计划、打卡、身体档案 | `apps/workout/index.html` |
| 日常 | 一件一件做：今日清单、SOP 步骤、记录 | `apps/daily/index.html` |

双击 `index.html` 即可打开，不用起服务。三个应用都是纯前端，断网也能用
（锻炼打卡的农历/节假日数据首次会尝试走 CDN，取不到自动降级；日常的农历库已放本地 `_vendor/`）。

## 加一个新应用（只有一步）

1. 把应用丢进 `apps/`，比如 `apps/timer.html` 或 `apps/timer/index.html`；
2. 打开 `index.html`，找到顶部的 `apps` 数组，加一行：

```js
{
  id: 'timer',                    // 唯一标识，也用于地址栏 #/timer
  name: '番茄钟',
  sub: '25 分钟专注',              // 可选，手机切换面板的副标题
  url: 'apps/timer.html',
  accent: '#c4694a',              // 可选，选中时的主题色
  icon: '<svg viewBox="0 0 24 24" ...>...</svg>'   // 可选，内联 SVG 或 emoji
}
```

刷新即可：左侧菜单、手机切换面板、⌘K 搜索、`Alt+数字` 快捷键、顶栏信息全部自动出现。
**不需要改任何其它代码。** 文件里对应位置也写着同样的注释。

> 图标建议用内联 SVG：它跟随文字颜色走（未选中是灰、选中染成该应用的 accent），
> 比 emoji 更"成套"。emoji 也支持，直接用字符串即可。

## 为什么用 iframe

`apps/` 下每个应用都是**独立完整页面**，各自带一整套全局样式（`:root` 变量、`body` 背景、
`#toast`、`.card` 这类通用类名/ID 大量重名）。用 iframe 隔开后样式和 JS 绝不互相污染，
应用本身也不用为"被集成"做任何改造。切换应用时不销毁 iframe，所以记账页翻到哪个月份、
健身页聊到哪一句，切回来都还在。

## 操作

| 操作 | 桌面 | 手机 |
| --- | --- | --- |
| 切应用 | 点左侧菜单 / `⌘K`（Windows `Ctrl+K`）搜索 / `Alt`+`1`~`9` | 点顶栏应用名，弹出切换面板 |
| 折叠侧栏 | 侧栏右上角 `‹`，或 `Alt+B`（折叠成 68px 图标轨，状态会记住） | — |
| 手机尺寸预览 | 顶栏手机图标，或 `Alt+P` | 本身就是手机尺寸 |
| 刷新当前应用 | `Alt+R` | 切换面板里的「刷新当前」 |
| 新窗口打开 | 顶栏 ↗ 图标 | 切换面板里的「新窗口」 |
| 直达某个应用 | 地址栏 `#/ledger`、`#/workout`、`#/daily` | 同 |

顶栏标题在桌面端点一下也能直接打开 ⌘K 搜索，手机会弹出切换面板 —— 同一个"切换"入口，
两种形态。上次打开的应用、侧栏折叠状态、手机预览开关都会记住。

## 关于数据

三个应用各用各的 localStorage 键前缀，互不冲突：

- 随手记 `shoujizhang.*`
- 锻炼打卡 `wt.*`
- 日常 `daily*`

localStorage 按**源**隔离：如果以后把整个工作台发到线上域名，本机 file:// 下的旧数据
不会自动跟过去。需要迁移时用各应用自带的「备份 / 导入」走一次。

> 锻炼打卡原本是线上地址，这里是完整离线副本，线上域名下的历史记录不会出现在本地这份里。
> 想直接用线上那份（数据在那边），把它的 `url` 改成
> `https://workout-checkin-38178.app.workbuddy.host/?sharecode=LESSFS3DXU` 即可，该站允许被 iframe 嵌入。
> 日常同理：`https://wbapp-ckkoddmsbrkw3qhwornkg1.app.workbuddy.host/?sharecode=6N4JQIAFCZ`。

## 抓取线上应用时的坑

这几个 WorkBuddy 托管的站点，`index.html` 带 `?sharecode=` 能直接拿到，但它的**子资源**
（`main.js`、`icon-*.png`、`manifest.webmanifest`）不带分享码会返回 403「链接不完整」。
下载时把同一个 `sharecode` 拼到子资源地址后面即可。

## 改动记录

- `apps/ledger/index.html` 去掉了 Service Worker 注册（原应用装桌面时用），避免子目录缓存和工作台打架。
- `apps/workout/index.html` 的农历库改为**本地优先**（`_vendor/lunar.min.js`），取不到才回退 CDN。
- 新增 `sync.sh`：把本地改动一键提交并推送到 GitHub（带代理重试）。

## 同步到 GitHub

本地仓库与 `https://github.com/SuperAhua/Workspace` 的 `main` 分支关联。改动任意文件后：

```bash
bash sync.sh "本次改动说明"
```

脚本会自动 `add` → `commit` → 带重试地 `push`。Git 凭证已存入系统凭证管理器，无需重复输入 token。
网络代理偶发 502，脚本内置重试；若全部失败，改动仍会保留在本地提交里，重新运行即可补推。
