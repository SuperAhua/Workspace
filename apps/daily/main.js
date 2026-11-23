/* ==========================================================
   日常 · 一件一件做   v5
   三页：今天 / 清单 / 记录（+ AI 教练）
   ========================================================== */
'use strict';

/* ---------------- 工具 ---------------- */
const $ = s => document.querySelector(s);
const pad = n => String(n).padStart(2, '0');
const ymd = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const WD = ['日', '一', '二', '三', '四', '五', '六'];
const KEY = 'daily_sop_v3';
const OLDKEY = 'my_sop_v2';
const uid = p => (p || 'k') + Date.now().toString(36) + Math.floor(Math.random() * 900 + 100);
const today = () => ymd(new Date());
const mins = hm => { const a = String(hm || '').split(':'); return (Number(a[0]) || 0) * 60 + (Number(a[1]) || 0); };
const curMin = () => { const d = new Date(); return d.getHours() * 60 + d.getMinutes(); };
const dateOf = k => new Date(k.replace(/-/g, '/'));

/* ---------------- 默认数据 ---------------- */
function mkSOP(id, name, remind, dur, freq, dow, dom, steps, min) {
  return { id, name, remind, dur, freq, dow: dow || [], dom: dom || 1, steps, min, off: false };
}
function starterSOPs() {
  return [
    mkSOP('s1', '起床', '07:30', 5, 'daily', [], 1,
      ['醒来先看一眼时间', '记一笔几点起的', '十分钟内离开床'], '只记时间'),
    mkSOP('s2', '记账', '21:30', 3, 'daily', [], 1,
      ['打开记账', '记当天支出一个数', '有收入补一条'], '只记当天总支出'),
    mkSOP('s3', '睡前手机离床', '22:30', 10, 'daily', [], 1,
      ['起身，不看「最后一条」', '手机放到充电处，不带上床', '洗澡 / 洗漱', '回房关灯'],
      '起身 → 手机放远 → 洗脸'),
    mkSOP('s4', '动一下', '20:00', 10, 'weekly', [2, 4], 1,
      ['换上运动衣（这就算开始）', '做 10 分钟，不设强度', '记一句最难的是哪一步'],
      '换衣服 + 做 1 组'),
    mkSOP('s5', '周复盘', '20:30', 25, 'weekly', [0], 1,
      ['这周时间主要花在哪', '哪件事做得好，为什么', '下周只改一件事'], '只写三行'),
    mkSOP('s6', '每月 1 号：转存 + 联系 3 个人', '20:00', 15, 'monthly', [], 1,
      ['转存固定一笔，多少都行', '看一眼信用卡 / 花呗账单', '给家人、朋友、前同事各发一条具体消息'],
      '只转存')
  ];
}
function defState() {
  return {
    v: 5,
    sops: starterSOPs(),
    records: {},
    chat: [],
    settings: {
      apiBase: 'https://api.deepseek.com/v1',
      model: 'deepseek-chat',
      key: '',
      theme: 'auto',
      remindOn: true,
      quietOn: false,
      quietStart: '23:30',
      quietEnd: '07:00',
      fired: {},
      iosTip: false,
      weakDismiss: null
    }
  };
}
/* 把旧数据里的「每周二、四」认成 weekly，并补齐入门事项 */
function migrate(s) {
  s.sops = Array.isArray(s.sops) ? s.sops : [];
  const old = Number(s.v) || 0;
  if (old >= 5) return s;

  const map = { 一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6, 日: 0, 天: 0 };
  s.sops.forEach(x => {
    const m = String(x.when || '').match(/每?周\s*([一二三四五六日天、,，\s]+)/);
    if (m) {
      const dow = [...new Set(m[1].replace(/[、,，\s]/g, '').split('').map(c => map[c]).filter(v => v !== undefined))];
      x.freq = 'weekly';
      x.dow = dow.length ? dow : [1];
    } else if (!x.freq) {
      x.freq = 'daily';
    }
    x.when = '';
    if (x.freq === 'weekly' && !(Array.isArray(x.dow) && x.dow.length)) x.dow = [1];
    if (x.freq === 'monthly' && !x.dom) x.dom = 1;
  });

  const names = s.sops.map(x => x.name || '');
  const has = re => names.some(n => re.test(n));
  const add = [];
  if (!has(/起床/)) add.push(mkSOP(uid(), '起床', '07:30', 5, 'daily', [], 1,
    ['醒来先看一眼时间', '记一笔几点起的', '十分钟内离开床'], '只记时间'));
  if (!has(/复盘/)) add.push(mkSOP(uid(), '周复盘', '20:30', 25, 'weekly', [0], 1,
    ['这周时间主要花在哪', '哪件事做得好，为什么', '下周只改一件事'], '只写三行'));
  if (!has(/转存|每月/)) add.push(mkSOP(uid(), '每月 1 号：转存 + 联系 3 个人', '20:00', 15, 'monthly', [], 1,
    ['转存固定一笔，多少都行', '看一眼信用卡 / 花呗账单', '给家人、朋友、前同事各发一条具体消息'], '只转存'));
  s.sops = s.sops.concat(add);
  s.v = 5;
  return s;
}
function mergeState(o) {
  const base = defState();
  const s = Object.assign({}, base, o, { settings: Object.assign({}, base.settings, (o && o.settings) || {}) });
  s.sops = Array.isArray(s.sops) ? s.sops.map(x => Object.assign(
    { remind: '', min: '', steps: [], off: false, dur: 0, freq: 'daily', dow: [], dom: 1 }, x)) : base.sops;
  s.records = s.records && typeof s.records === 'object' ? s.records : {};
  s.chat = Array.isArray(s.chat) ? s.chat : [];
  return migrate(s);
}
function loadState() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return mergeState(JSON.parse(raw));
    const old = localStorage.getItem(OLDKEY);
    if (old) {
      const o = JSON.parse(old);
      const st = defState();
      st.sops = (o.sops || []).map(x => mkSOP(x.id || uid(), x.name || '未命名', '', 0, 'daily', [], 1, x.steps || [], x.min || ''));
      st.records = o.records || {};
      st.chat = o.chat || [];
      if (o.settings) {
        st.settings.apiBase = o.settings.apiBase || st.settings.apiBase;
        st.settings.model = o.settings.model || st.settings.model;
        st.settings.key = o.settings.key || '';
      }
      localStorage.setItem(KEY, JSON.stringify(st));
      return st;
    }
  } catch (e) { console.warn(e); }
  return defState();
}
let S = loadState();
function save() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { toast('本地存储写入失败'); } }

/* ---------------- 派生 ---------------- */
function dueOn(s, d) {
  if (s.freq === 'weekly') return (s.dow || []).indexOf(d.getDay()) >= 0;
  if (s.freq === 'monthly') {
    const last = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
    return d.getDate() === Math.min(s.dom || 1, last);
  }
  return true;
}
function dueList(k) {
  const d = dateOf(k);
  return S.sops.filter(s => !s.off && dueOn(s, d));
}
const activeSOPs = () => S.sops.filter(s => !s.off);
const recOf = (k, id) => (S.records[k] || {})[id];

function dayStat(k) {
  const recs = S.records[k] || {};
  const items = dueList(k);
  let done = 0, min = 0, miss = 0, rec = 0;
  items.forEach(s => {
    const r = recs[s.id]; if (!r) return;
    rec++;
    if (r.st === 'done') done++;
    else if (r.st === 'min') min++;
    else miss++;
  });
  const total = items.length;
  return { done, min, miss, rec, total, pct: total ? (done + min) / total : 0 };
}
function streak() {
  let n = 0;
  for (let i = 0; i < 400; i++) {
    const has = Object.keys(S.records[ymd(new Date(Date.now() - i * 86400000))] || {}).length > 0;
    if (has) n++;
    else if (i > 0) break;
  }
  return n;
}
function bestStreak() {
  const days = Object.keys(S.records).filter(k => Object.keys(S.records[k] || {}).length).sort();
  let best = 0, run = 0, prev = null;
  days.forEach(k => {
    const t = dateOf(k).getTime();
    run = (prev !== null && t - prev === 86400000) ? run + 1 : 1;
    if (run > best) best = run;
    prev = t;
  });
  return best;
}
function freqLabel(s) {
  if (s.freq === 'weekly') return '每周' + (s.dow || []).map(d => WD[d]).join('、');
  if (s.freq === 'monthly') return '每月 ' + (s.dom || 1) + ' 号';
  return '每天';
}
function recentStat(s, days) {
  let due = 0, ok = 0;
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86400000);
    if (!dueOn(s, d)) continue;
    due++;
    const r = (S.records[ymd(d)] || {})[s.id];
    if (r && r.st !== 'miss') ok++;
  }
  return { due, ok };
}
function missStreak(id) {
  let n = 0;
  for (let i = 1; i <= 14; i++) {
    const r = (S.records[ymd(new Date(Date.now() - i * 86400000))] || {})[id];
    if (!r || r.st !== 'miss') break;
    n++;
  }
  return n;
}
function weakSpot() {
  const dis = S.settings.weakDismiss;
  let best = null;
  dueList(today()).forEach(s => {
    if (dis && dis.date === today() && dis.id === s.id) return;
    if (recOf(today(), s.id)) return;
    const n = missStreak(s.id);
    if (n >= 3 && (!best || n > best.n)) best = { s, n };
  });
  return best;
}
/* 位置调整：跳过停用项，与最近的在用事项交换 */
function moveSop(id, dir) {
  const i = S.sops.findIndex(x => x.id === id);
  if (i < 0) return false;
  let j = i + dir;
  while (j >= 0 && j < S.sops.length && S.sops[j].off) j += dir;
  if (j < 0 || j >= S.sops.length) return false;
  const t = S.sops[i]; S.sops[i] = S.sops[j]; S.sops[j] = t;
  save();
  return true;
}

/* ---------------- 主题 ---------------- */
const mqDark = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;
function applyTheme() {
  const t = S.settings.theme === 'auto' ? (mqDark && mqDark.matches ? 'dark' : 'light') : S.settings.theme;
  document.documentElement.dataset.theme = t;
  document.querySelectorAll('meta[name="theme-color"]').forEach(m => m.setAttribute('content', t === 'dark' ? '#111110' : '#f7f5f0'));
}
if (mqDark && mqDark.addEventListener) mqDark.addEventListener('change', () => { if (S.settings.theme === 'auto') applyTheme(); });

/* ---------------- Toast ---------------- */
let toastT = null, undoBuf = null;
function toast(msg, undoable) {
  const el = $('#toast'), act = $('#toastAct');
  $('#toastMsg').textContent = msg;
  if (undoable && undoBuf) { act.textContent = '撤销'; act.style.display = ''; }
  else { act.textContent = ''; act.style.display = 'none'; }
  el.classList.add('on');
  clearTimeout(toastT);
  toastT = setTimeout(() => { el.classList.remove('on'); undoBuf = null; }, undoable ? 4000 : 1800);
}
$('#toastAct').addEventListener('click', () => {
  if (!undoBuf) return;
  const { date, id, prev } = undoBuf;
  S.records[date] = S.records[date] || {};
  if (prev) S.records[date][id] = prev; else delete S.records[date][id];
  undoBuf = null; save();
  $('#toast').classList.remove('on');
  render();
});

/* ---------------- 图标 ---------------- */
const IC = {
  check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7"/></svg>',
  half: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 3a9 9 0 0 1 0 18V3z"/></svg>',
  cross: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"><path d="M7 7l10 10M17 7L7 17"/></svg>',
  chev: '<svg class="chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 6l6 6-6 6"/></svg>'
};

/* ---------------- 渲染外壳 ---------------- */
let TAB = 'today';
let openId = null;
let justMarked = null;
let chatScroll = false;

function render() {
  applyTheme();
  const d = new Date();
  const ds = dayStat(today());

  if (TAB === 'chat') {
    $('#hdDate').innerHTML = 'AI 教练';
    $('#hdSub').innerHTML = '它能看到你的清单和最近 7 天记录';
  } else {
    $('#hdDate').innerHTML = `${d.getMonth() + 1} 月 ${d.getDate()} 日<i>周${WD[d.getDay()]}</i>`;
    const left = Math.max(0, ds.total - ds.rec);
    $('#hdSub').innerHTML = !ds.total ? '今天没有安排'
      : left > 0 ? `还剩 <b>${left}</b> 件 · 已记 ${ds.rec}/${ds.total}`
        : `今天 <b>${ds.total}</b> 件事都记完了`;
  }

  $('#hdRight').innerHTML = `
    <button class="iconbtn" data-act="go-chat" aria-label="AI">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round">
        <path d="M12 4.2l1.7 4.4 4.4 1.7-4.4 1.7L12 16.4l-1.7-4.4L5.9 10.3l4.4-1.7z"/>
        <path d="M18.4 16l.8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8z"/>
      </svg>
    </button>
    <button class="iconbtn" data-act="open-settings" aria-label="设置">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round">
        <circle cx="12" cy="12" r="3.1"/>
        <path d="M19.4 15a1.7 1.7 0 0 0 .34 1.87l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.7 1.7 0 0 0-1.87-.34 1.7 1.7 0 0 0-1.03 1.56V21a2 2 0 1 1-4 0v-.11a1.7 1.7 0 0 0-1.11-1.56 1.7 1.7 0 0 0-1.87.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-1.56-1.03H3a2 2 0 1 1 0-4h.11A1.7 1.7 0 0 0 4.6 8.86a1.7 1.7 0 0 0-.34-1.87l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.7 1.7 0 0 0 1.87.34H9a1.7 1.7 0 0 0 1.03-1.56V3a2 2 0 1 1 4 0v.11a1.7 1.7 0 0 0 1.03 1.56 1.7 1.7 0 0 0 1.87-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.7 1.7 0 0 0-.34 1.87V9a1.7 1.7 0 0 0 1.56 1.03H21a2 2 0 1 1 0 4h-.11A1.7 1.7 0 0 0 19.4 15z"/>
      </svg>
    </button>`;

  const TABS = [['today', '今天', 'sun'], ['list', '清单', 'list'], ['history', '记录', 'cal']];
  const ICONS = {
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M18.4 5.6L17 7M7 17l-1.4 1.4"/>',
    list: '<path d="M9 6h11M9 12h11M9 18h11"/><circle cx="4.8" cy="6" r="1.3"/><circle cx="4.8" cy="12" r="1.3"/><circle cx="4.8" cy="18" r="1.3"/>',
    cal: '<rect x="3.5" y="5" width="17" height="15.5" rx="2.6"/><path d="M8 3v4M16 3v4M3.5 10h17"/>'
  };
  $('#tabs').innerHTML = TABS.map(([k, t, ic]) => `
    <button class="tab ${TAB === k ? 'on' : ''}" data-tab="${k}">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round">${ICONS[ic]}</svg>
      <span>${t}</span>
    </button>`).join('');

  const v = $('#view');
  v.innerHTML = TAB === 'list' ? viewList() : TAB === 'history' ? viewHistory() : TAB === 'chat' ? viewChat() : viewToday();

  if (TAB === 'chat' && chatScroll) {
    chatScroll = false;
    requestAnimationFrame(() => requestAnimationFrame(() => window.scrollTo({ top: document.body.scrollHeight })));
  }
}

/* ---------------- 今天 ---------------- */
function rowHTML(s, r, isNow) {
  const st = r ? r.st : '';
  const open = openId === s.id;
  const steps = s.steps || [];
  const sub = [];
  if (s.freq !== 'daily') sub.push(freqLabel(s));
  if (steps.length) sub.push(steps.length + ' 步');
  if (s.dur) sub.push('约 ' + s.dur + ' 分钟');
  const icon = st === 'done' ? IC.check : st === 'min' ? IC.half : st === 'miss' ? IC.cross : '';
  return `<div class="row ${st ? 'st-' + st : ''} ${open ? 'open' : ''}" data-act="toggle" data-id="${s.id}">
    <button class="ck ${st ? 'on ' + st : ''}${justMarked === s.id ? ' pop' : ''}" data-act="mark" data-id="${s.id}" data-st="done" aria-label="标记为做了">${icon}</button>
    <div class="rw">
      <div class="rw-top">${isNow ? '<span class="nowtag">现在</span>' : ''}<span class="nm">${esc(s.name)}</span>${s.remind ? `<span class="tm">${esc(s.remind)}</span>` : ''}</div>
      ${sub.length ? `<div class="rw-sub">${sub.join(' · ')}</div>` : ''}
    </div>
    ${IC.chev}
  </div>${open ? panelHTML(s, r) : ''}`;
}
function panelHTML(s, r) {
  const st = r ? r.st : '';
  const steps = s.steps || [];
  return `<div class="panel">
    ${steps.length ? `<ol class="ps">${steps.map(x => `<li>${esc(x)}</li>`).join('')}</ol>` : '<div class="pnone">还没写具体步骤。</div>'}
    ${s.min ? `<div class="pmin"><b>最小版</b>${esc(s.min)}</div>` : ''}
    <div class="pseg">
      <button data-act="mark" data-id="${s.id}" data-st="done" class="${st === 'done' ? 'on d' : ''}">做了</button>
      <button data-act="mark" data-id="${s.id}" data-st="min" class="${st === 'min' ? 'on m' : ''}">最小版</button>
      <button data-act="mark" data-id="${s.id}" data-st="miss" class="${st === 'miss' ? 'on x' : ''}">没做</button>
    </div>
    ${r ? `<input class="pnote" data-act="note" data-id="${s.id}" value="${esc(r.note || '')}" placeholder="记一句：为什么 / 卡在哪（可不填）" enterkeyhint="done">` : ''}
    <div class="pacts">
      <button data-act="edit-sop" data-id="${s.id}">编辑</button>
      <button data-act="move-sop" data-id="${s.id}" data-dir="-1">上移</button>
      <button data-act="move-sop" data-id="${s.id}" data-dir="1">下移</button>
    </div>
  </div>`;
}
function barHTML(ds) {
  if (!ds.total) return '';
  return `<div class="bar">
    ${ds.done ? `<i class="d" style="width:${ds.done / ds.total * 100}%"></i>` : ''}
    ${ds.min ? `<i class="m" style="width:${ds.min / ds.total * 100}%"></i>` : ''}
    ${ds.miss ? `<i class="x" style="width:${ds.miss / ds.total * 100}%"></i>` : ''}
  </div>`;
}
function tipHTML() {
  if (S.settings.iosTip || !isIOS || isStandalone()) return '';
  return `<div class="tipline"><span>在手机上：点分享 → 添加到主屏幕，提醒会更稳。</span>
    <button data-act="dismiss-tip" aria-label="不再提示">✕</button></div>`;
}
function viewToday() {
  const d = today();
  const items = dueList(d);
  const recs = S.records[d] || {};
  const ds = dayStat(d);
  const pend = items.filter(s => !recs[s.id]);
  const done = items.filter(s => recs[s.id]);
  const now = curMin();

  const weak = weakSpot();
  const weakHTML = weak ? `<div class="hintbar">
      <span>「${esc(weak.s.name)}」连着 ${weak.n} 天没做，可能是这条太大了。</span>
      <button data-act="edit-sop" data-id="${weak.s.id}">改小</button>
    </div>` : '';

  if (!items.length) {
    return `${barHTML(ds)}<div class="empty"><b>今天没有安排</b>
      <p>点下面加一件你每天都会做、<br>但常常没做的事。</p></div>
      <button class="addrow" data-act="new-sop">+ 添加一件事</button>${tipHTML()}`;
  }

  let body = '';
  if (pend.length) {
    body += `<div class="sec"><h2>要做</h2><span class="ln"></span><span class="n">${pend.length} 件</span></div>
      <div class="list">${pend.map((s, i) => rowHTML(s, null,
        i === 0 && s.remind && now - mins(s.remind) >= 0 && now - mins(s.remind) <= 150)).join('')}</div>`;
  } else {
    body += `<div class="hintbar" style="background:var(--accent-soft);border-color:var(--accent-line);color:var(--accent-ink)">
      <span>今天的都记完了，早点休息。</span></div>`;
  }
  if (done.length) {
    body += `<div class="sec"><h2>已记录</h2><span class="ln"></span><span class="n">${done.length} 件</span></div>
      <div class="list">${done.map(s => rowHTML(s, recs[s.id], false)).join('')}</div>`;
  }
  return `${barHTML(ds)}${weakHTML}${body}
    <button class="addrow" data-act="new-sop">+ 添加一件事</button>
    <div class="note" style="padding:2px 3px 0">${pend.length ? '做没做都点一下，不点就是留白。点一行能看步骤。' : '全部记完了。明天到点还会提醒你。'}</div>
    ${tipHTML()}`;
}

/* ---------------- 清单 ---------------- */
function listRow(s) {
  const open = openId === s.id;
  const rs = recentStat(s, 14);
  const meta = [freqLabel(s), s.remind ? s.remind : '不提醒', s.dur ? '约 ' + s.dur + ' 分钟' : ''].filter(Boolean).join(' · ');
  return `<div class="row ${open ? 'open' : ''}" data-act="toggle" data-id="${s.id}">
    <div class="rw">
      <div class="rw-top"><span class="nm">${esc(s.name)}</span>
        ${rs.due ? `<span class="tm" style="margin-left:auto">近 14 天 ${rs.ok}/${rs.due}</span>` : ''}</div>
      <div class="rw-sub">${meta}</div>
    </div>
    ${IC.chev}
  </div>${open ? listPanel(s) : ''}`;
}
function listPanel(s) {
  const steps = s.steps || [];
  return `<div class="panel" style="padding-left:14px">
    ${steps.length ? `<ol class="ps">${steps.map(x => `<li>${esc(x)}</li>`).join('')}</ol>` : '<div class="pnone">还没写具体步骤。</div>'}
    ${s.min ? `<div class="pmin"><b>最小版</b>${esc(s.min)}</div>` : ''}
    <div class="pacts">
      <button data-act="edit-sop" data-id="${s.id}">编辑</button>
      <button data-act="move-sop" data-id="${s.id}" data-dir="-1">上移</button>
      <button data-act="move-sop" data-id="${s.id}" data-dir="1">下移</button>
      <button data-act="toggle-sop" data-id="${s.id}">${s.off ? '启用' : '停用'}</button>
      <button class="dg" data-act="del-sop" data-id="${s.id}">删除</button>
    </div>
  </div>`;
}
function viewList() {
  const groups = [['daily', '每天'], ['weekly', '每周'], ['monthly', '每月']];
  let html = '';
  groups.forEach(([k, label]) => {
    const arr = S.sops.filter(s => !s.off && (s.freq || 'daily') === k);
    if (!arr.length) return;
    html += `<div class="sec"><h2>${label}</h2><span class="ln"></span><span class="n">${arr.length}</span></div>
      <div class="list">${arr.map(listRow).join('')}</div>`;
  });
  const off = S.sops.filter(s => s.off);
  if (off.length) {
    html += `<div class="sec"><h2>已停用</h2><span class="ln"></span><span class="n">${off.length}</span></div>
      <div class="list">${off.map(listRow).join('')}</div>`;
  }
  if (!S.sops.length) {
    html = `<div class="empty"><b>清单是空的</b><p>先加一件你每天都会做、<br>但常常没做的事。</p></div>`;
  }
  return `${html}
    <button class="addrow" data-act="new-sop">+ 添加一件事</button>
    <div class="note" style="padding:0 3px">点一行展开，可以改步骤、调顺序、停用或删除。<br>
    清单里排在前面的，就是今天最先看到的。</div>`;
}

/* ---------------- 记录 ---------------- */
let calDate = new Date();
let selDate = today();

function levelCls(st) {
  if (!st.rec) return '';
  if ((st.done + st.min) === 0) return 'lv0';
  if (st.pct >= 0.999) return 'l4';
  if (st.pct >= 0.6) return 'l3';
  if (st.pct >= 0.3) return 'l2';
  return 'l1';
}
function dayDetail(d) {
  const items = dueList(d);
  const recs = S.records[d] || {};
  const st = dayStat(d);
  const dt = dateOf(d);
  const rows = items.map(s => {
    const r = recs[s.id];
    const x = r ? r.st : '';
    return `<div class="dr">
      <div class="dname">${esc(s.name)}${r && r.note ? `<div class="dnote">${esc(r.note)}</div>` : ''}</div>
      <div class="mini">
        <button data-act="mark-date" data-date="${d}" data-id="${s.id}" data-st="done" class="${x === 'done' ? 'on done' : ''}">做了</button>
        <button data-act="mark-date" data-date="${d}" data-id="${s.id}" data-st="min" class="${x === 'min' ? 'on min' : ''}">最小</button>
        <button data-act="mark-date" data-date="${d}" data-id="${s.id}" data-st="miss" class="${x === 'miss' ? 'on miss' : ''}">没做</button>
      </div>
    </div>`;
  });
  return `<div class="sec" style="margin-top:18px"><h2>${dt.getMonth() + 1} 月 ${dt.getDate()} 日</h2><span class="ln"></span>
      <span class="n">${st.rec ? st.rec + '/' + st.total + ' 已记' : '无记录'}</span></div>
    ${items.length ? rows.join('') : '<div class="note" style="padding:0 3px">这天没有安排。</div>'}
    <div class="note" style="padding:0 3px">${d > today() ? '这天还没到。' : '忘了记？点一下就能补。留白和没做是两件事。'}</div>`;
}
function viewHistory() {
  const y = calDate.getFullYear(), m = calDate.getMonth();
  const isCur = y === new Date().getFullYear() && m === new Date().getMonth();
  if (selDate) {
    const sd = dateOf(selDate);
    if (sd.getFullYear() !== y || sd.getMonth() !== m) selDate = null;
  }
  if (!selDate && isCur) selDate = today();

  const first = new Date(y, m, 1);
  const lead = (first.getDay() + 6) % 7;
  const dim = new Date(y, m + 1, 0).getDate();
  const cells = [];
  for (let i = 0; i < lead; i++) cells.push('<div class="cell pad"></div>');
  let recDays = 0, sum = 0;
  for (let d = 1; d <= dim; d++) {
    const k = `${y}-${pad(m + 1)}-${pad(d)}`;
    const st = dayStat(k);
    if (st.rec) { recDays++; sum += st.pct; }
    cells.push(`<div class="cell ${levelCls(st)} ${k === selDate ? 'sel' : ''} ${k === today() ? 'today' : ''}"
      data-act="pick-day" data-date="${k}">${d}</div>`);
  }
  const avg = recDays ? Math.round(sum / recDays * 100) : 0;
  const best = bestStreak();
  const totalRec = Object.keys(S.records).reduce((a, k) => a + Object.keys(S.records[k] || {}).length, 0);

  return `<div class="mon">
    <div class="mon-h">
      <b>${y} 年 ${m + 1} 月</b>
      <div class="mon-nav">
        <button class="iconbtn" data-act="cal-prev" aria-label="上个月" style="width:32px;height:32px">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M15 5l-7 7 7 7"/></svg></button>
        <button class="iconbtn" data-act="cal-next" aria-label="下个月" style="width:32px;height:32px">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M9 5l7 7-7 7"/></svg></button>
      </div>
    </div>
    <div class="mon-grid">
      ${['一', '二', '三', '四', '五', '六', '日'].map(w => `<div class="mon-wd">${w}</div>`).join('')}
      ${cells.join('')}
    </div>
    <div class="legend">${recDays} 天有记录 · 平均 ${avg}%${best > 1 ? ' · 最长连续 ' + best + ' 天' : ''}</div>
  </div>
  ${selDate ? dayDetail(selDate) : ''}
  <div class="note" style="padding:6px 3px 0">总共 ${totalRec} 条记录。颜色越深，那天记完的越多。</div>`;
}

/* ---------------- AI ---------------- */
function viewChat() {
  const noKey = !S.settings.key;
  const body = S.chat.length ? S.chat.map(msgHTML).join('') : welcomeHTML();
  return `<button class="backlink" data-act="go" data-tab="today">← 回清单</button>
  ${noKey ? `<div class="notice"><b>还没配模型。</b>在设置里填一个 OpenAI 兼容的 Key 就能直接聊；不填也行，用「复制」带到任意大模型里问。</div>` : ''}
  <div class="chips">
    <button class="chip" data-act="quick" data-q="看我最近 7 天的记录，指出哪条 SOP 设计有问题，给三条具体改法，别讲道理。">记录有什么问题</button>
    <button class="chip" data-act="quick" data-q="给我这周的复盘：哪条在跑、哪条在空转，下周只改一件事，具体到动作。不要鼓励。">这周复盘</button>
    <button class="chip" data-act="quick" data-q="帮我把最难坚持的那条改简单，给出改后的版本。">改简单一点</button>
  </div>
  <div class="chat" id="chatBox">${body}${busy ? typingHTML() : ''}</div>
  <div class="composer">
    <textarea id="chatIn" rows="1" placeholder="问点什么，或让它帮你改 SOP…" enterkeyhint="send"></textarea>
    <div class="bar2">
      <button class="ctxbtn" data-act="copy-prompt">复制给 AI</button>
      <span class="hint">回车发送</span>
      <button class="send" id="sendBtn" ${busy ? 'disabled' : ''}>${busy ? '思考中' : '发送'}</button>
    </div>
  </div>`;
}
function typingHTML() {
  return `<div class="msg ai"><div class="who">助手</div><div class="bubble"><span class="typing"><i></i><i></i><i></i></span></div></div>`;
}
function welcomeHTML() {
  return `<div class="msg ai"><div class="who">助手</div><div class="bubble">
  我能看到你现在的 <strong>${activeSOPs().length}</strong> 条事项和最近 7 天的记录。<br><br>
  可以让我：<br>1. 看记录，指出哪条设计得有问题<br>2. 把某条改简单<br>3. 按你的一句话生成一条新 SOP<br><br>
  建议改的时候，我会给一张能点「应用」的卡片。</div></div>`;
}
function msgHTML(m) {
  if (m.role === 'user') return `<div class="msg user"><div class="who">我</div><div class="bubble">${esc(m.content)}</div></div>`;
  const { text, patches } = parseAI(m.content);
  return `<div class="msg ai" data-mid="${m.ts}"><div class="who">助手</div>
    <div class="bubble">${mdLite(text)}</div>${patches.map(patchHTML).join('')}</div>`;
}
function patchHTML(p) {
  const isNew = p.action === 'new' || !p.id;
  const cur = S.sops.find(x => x.id === p.id) || {};
  const name = p.name || cur.name || '新事项';
  const body = [];
  if (p.freq) body.push('频次：' + (p.freq === 'weekly' ? '每周' + (p.dow || []).map(d => WD[d]).join('、')
    : p.freq === 'monthly' ? '每月 ' + (p.dom || 1) + ' 号' : '每天'));
  if (p.remind) body.push('提醒：' + esc(p.remind));
  if (p.min) body.push('最小版：<b>' + esc(p.min) + '</b>');
  if ((p.steps || []).length) body.push('步骤：' + p.steps.map(esc).join(' → '));
  return `<div class="patch">
    <div class="ph">${isNew ? '新增事项' : '修改事项'}</div>
    <div class="pn">${esc(name)}</div>
    <div class="pd">${body.join('<br>') || '（无内容）'}</div>
    <button class="btn pri sm" data-act="apply-patch" data-p="${esc(JSON.stringify(p))}">应用这条</button>
  </div>`;
}
function parseAI(raw) {
  const patches = [];
  const text = String(raw || '')
    .replace(/```[a-zA-Z]*\n?/g, '')
    .replace(/<update>([\s\S]*?)<\/update>/g, (m, b) => {
      try { const o = JSON.parse(b.trim()); (Array.isArray(o) ? o : [o]).forEach(x => patches.push(x)); } catch (e) { }
      return '';
    }).trim();
  return { text, patches };
}
function mdLite(t) {
  return esc(t)
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/^###\s*(.+)$/gm, '<span class="h">$1</span>')
    .replace(/^##\s*(.+)$/gm, '<span class="h">$1</span>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\n/g, '<br>');
}

/* ---------------- 记录动作 ---------------- */
function rowPos(id) {
  const el = document.querySelector(`#view .row[data-id="${id}"]`);
  return el ? el.getBoundingClientRect().top : null;
}
function animateMove(id, before) {
  if (before == null) return;
  const el = document.querySelector(`#view .row[data-id="${id}"]`);
  if (!el || !el.animate) return;
  const dy = before - el.getBoundingClientRect().top;
  if (Math.abs(dy) < 4) return;
  try {
    el.animate([{ transform: `translateY(${dy}px)` }, { transform: 'translateY(0)' }],
      { duration: 300, easing: 'cubic-bezier(.22,.8,.24,1)' });
  } catch (e) { }
}
function vib(ms) { try { navigator.vibrate && navigator.vibrate(ms); } catch (e) { } }

function setRec(id, st, date) {
  const d = date || today();
  const before = date ? null : rowPos(id);
  S.records[d] = S.records[d] || {};
  const cur = S.records[d][id];
  const prev = cur ? Object.assign({}, cur) : null;
  const same = !!(cur && cur.st === st);
  if (same) delete S.records[d][id];
  else S.records[d][id] = { st, note: cur ? cur.note : '', ts: Date.now() };
  if (!Object.keys(S.records[d]).length) delete S.records[d];
  justMarked = same ? null : id;
  undoBuf = { date: d, id, prev };
  save();
  render();
  animateMove(id, before);
  vib(same ? 8 : 14);
  setTimeout(() => { justMarked = null; }, 800);
  const label = st === 'done' ? '做了' : st === 'min' ? '最小版' : '没做';
  const day = d === today() ? '' : (Number(d.slice(5, 7)) + '/' + Number(d.slice(8, 10))) + ' ';
  toast(same ? day + '已取消记录' : day + '记下了：' + label, true);
}

/* ---------------- 弹层 ---------------- */
const dlg = $('#dlg'), sheet = $('#sheet');
function openSheet(html) {
  sheet.innerHTML = html;
  if (!dlg.open) dlg.showModal();
  const f = sheet.querySelector('[autofocus]');
  if (f) setTimeout(() => f.focus({ preventScroll: true }), 90);
  else setTimeout(() => { try { sheet.focus({ preventScroll: true }); } catch (e) { } }, 10);
}
function closeSheet() { if (dlg.open) dlg.close(); }
dlg.addEventListener('click', e => { if (e.target === dlg) dlg.close(); });

/* ---- 编辑事项 ---- */
let editingId = null;
function openSOP(id) {
  const s = id ? S.sops.find(x => x.id === id)
    : { name: '', remind: '', dur: 0, freq: 'daily', dow: [new Date().getDay()], dom: 1, steps: [], min: '' };
  editingId = id || '';
  const f = s.freq || 'daily';
  const dow = (s.dow && s.dow.length) ? s.dow : [1];
  openSheet(`
    <div class="grab"></div>
    <div class="sh">${id ? '编辑' : '新增一件事'}</div>
    <div class="sb">
      <div class="field"><label class="f">叫什么</label>
        <input class="in" id="fName" value="${esc(s.name)}" placeholder="例：睡前手机离床" autofocus></div>
      <div class="field"><label class="f">多久一次</label>
        <div class="segline" id="segFreq">
          ${[['daily', '每天'], ['weekly', '每周'], ['monthly', '每月']].map(([k, t]) =>
    `<button data-act="set-freq" data-v="${k}" class="${f === k ? 'on' : ''}">${t}</button>`).join('')}
        </div>
        <div class="dow" id="dowRow" style="${f === 'weekly' ? '' : 'display:none'}">
          ${[1, 2, 3, 4, 5, 6, 0].map(d =>
      `<button data-act="pick-dow" data-v="${d}" class="${dow.indexOf(d) >= 0 ? 'on' : ''}">${WD[d]}</button>`).join('')}
        </div>
        <div class="inline" id="domRow" style="margin-top:9px;${f === 'monthly' ? '' : 'display:none'}">
          <span style="font-size:12.5px;color:var(--muted);white-space:nowrap">每月</span>
          <input class="in" id="fDom" type="number" inputmode="numeric" min="1" max="31" value="${s.dom || 1}" style="max-width:78px">
          <span style="font-size:12.5px;color:var(--muted)">号</span>
        </div>
      </div>
      <div class="field"><label class="f">几点提醒 · 大概多久</label>
        <div class="inline">
          <input class="in" id="fRemind" type="time" value="${esc(s.remind || '')}">
          <input class="in" id="fDur" type="number" inputmode="numeric" min="1" max="180" value="${s.dur || ''}" placeholder="分钟">
          <button class="btn sm" data-act="clear-remind">清空</button>
        </div>
        <div class="note">不填时间就不提醒。提醒会带上下面的步骤。</div>
      </div>
      <div class="field"><label class="f">具体做什么（一行一步）</label>
        <textarea class="in" id="fSteps" rows="4" placeholder="换下衣服&#10;手机放到客厅&#10;洗澡">${esc((s.steps || []).join('\n'))}</textarea>
        <div class="note">写动作，不写决心。这些步骤会显示在清单和到点提醒里。</div></div>
      <div class="field"><label class="f">最小版（今天实在不行时做什么）</label>
        <input class="in" id="fMin" value="${esc(s.min || '')}" placeholder="例：只把手机放远">
        <div class="note">做不到标准版、只做了最小版，也算完成，不算失败。</div>
      </div>
    </div>
    <div class="sf">
      <button class="btn" data-act="close-dlg">取消</button>
      <button class="btn pri" data-act="save-sop">保存</button>
    </div>`);
}
function saveSOP() {
  const name = $('#fName').value.trim();
  if (!name) { toast('先给它起个名字'); $('#fName').focus(); return; }
  const freqEl = $('#segFreq .on');
  const freq = freqEl ? freqEl.dataset.v : 'daily';
  const dow = [...document.querySelectorAll('#dowRow .on')].map(b => Number(b.dataset.v));
  const dom = Math.min(31, Math.max(1, Number($('#fDom').value) || 1));
  if (freq === 'weekly' && !dow.length) { toast('选一个星期几'); return; }
  const data = {
    name,
    remind: $('#fRemind').value || '',
    dur: Math.min(180, Math.max(0, Number($('#fDur').value) || 0)),
    freq, dow, dom,
    steps: $('#fSteps').value.split('\n').map(x => x.trim()).filter(Boolean),
    min: $('#fMin').value.trim()
  };
  if (editingId) {
    const t = S.sops.find(x => x.id === editingId);
    if (t) Object.assign(t, data);
  } else {
    S.sops.push(Object.assign({ id: uid(), off: false }, data));
  }
  save(); closeSheet(); render(); toast('已保存');
}

/* ---- 设置 ---- */
function permissionState() {
  if (!('Notification' in window)) return 'unsupported';
  return Notification.permission;
}
function openSettings() {
  const st = S.settings;
  const perm = permissionState();
  const permText = perm === 'granted' ? '已允许系统通知' : perm === 'denied' ? '已被拒绝，需到浏览器设置里改'
    : perm === 'unsupported' ? '这台设备不支持网页通知' : '还没允许';
  openSheet(`
    <div class="grab"></div>
    <div class="sh">设置</div>
    <div class="sb">
      <div class="sec" style="margin-top:2px"><h2>提醒</h2><span class="ln"></span></div>
      <div class="sw">
        <div><div class="lab">到点提醒</div><div class="sub">${permText}</div></div>
        <button class="tg ${st.remindOn ? 'on' : ''}" data-act="tg-remind" aria-label="提醒开关"></button>
      </div>
      <div class="sw">
        <div><div class="lab">免打扰时段</div><div class="sub">${st.quietStart} – ${st.quietEnd}</div></div>
        <button class="tg ${st.quietOn ? 'on' : ''}" data-act="tg-quiet" aria-label="免打扰开关"></button>
      </div>
      ${st.quietOn ? `<div class="inline" style="margin:8px 0 4px">
        <input class="in" type="time" id="qStart" value="${esc(st.quietStart)}">
        <span style="color:var(--faint);font-size:12px">到</span>
        <input class="in" type="time" id="qEnd" value="${esc(st.quietEnd)}">
      </div>` : ''}
      <div class="sw">
        <div><div class="lab">系统通知</div><div class="sub">页面在后台时也能收到</div></div>
        <button class="btn sm" data-act="ask-perm">${perm === 'granted' ? '已开启' : '去允许'}</button>
      </div>
      <div class="sw">
        <div><div class="lab">导进手机日历</div><div class="sub">由系统闹钟提醒，最可靠</div></div>
        <button class="btn sm" data-act="export-ics">导出</button>
      </div>

      <div class="sec" style="margin-top:20px"><h2>外观</h2><span class="ln"></span></div>
      <div class="segline" style="margin:10px 0 4px">
        ${[['auto', '跟随系统'], ['light', '浅色'], ['dark', '深色']].map(([k, t]) =>
    `<button class="${st.theme === k ? 'on' : ''}" data-act="theme" data-v="${k}">${t}</button>`).join('')}
      </div>

      <div class="sec" style="margin-top:20px"><h2>数据</h2><span class="ln"></span></div>
      <div class="row-btn" style="margin:10px 0 6px">
        <button class="btn sm" data-act="export">导出备份</button>
        <button class="btn sm" data-act="import">导入</button>
        <button class="btn sm" data-act="clear" style="color:var(--rose)">清空</button>
      </div>
      <div class="note" style="margin-bottom:8px">数据只存在当前浏览器。换设备前先导出备份。</div>

      <div class="sec" style="margin-top:20px"><h2>AI（可选）</h2><span class="ln"></span></div>
      <div class="field" style="margin-top:10px">
        <label class="f">接口地址</label>
        <input class="in" id="sBase" value="${esc(st.apiBase)}" placeholder="https://api.deepseek.com/v1">
      </div>
      <div class="field"><label class="f">模型</label>
        <input class="in" id="sModel" value="${esc(st.model)}" placeholder="deepseek-chat"></div>
      <div class="field"><label class="f">API Key</label>
        <input class="in" id="sKey" type="password" value="${esc(st.key)}" placeholder="sk-..." autocomplete="off">
        <div class="note">只存在这台设备里，不会上传。</div>
      </div>
    </div>
    <div class="sf">
      <button class="btn" data-act="close-dlg">关闭</button>
      <button class="btn pri" data-act="save-settings">保存</button>
    </div>`);
}
function saveSettings() {
  S.settings.apiBase = ($('#sBase').value.trim() || 'https://api.deepseek.com/v1').replace(/\/+$/, '');
  S.settings.model = $('#sModel').value.trim() || 'deepseek-chat';
  S.settings.key = $('#sKey').value.trim();
  if ($('#qStart')) S.settings.quietStart = $('#qStart').value || S.settings.quietStart;
  if ($('#qEnd')) S.settings.quietEnd = $('#qEnd').value || S.settings.quietEnd;
  save(); closeSheet(); render(); toast('已保存');
}

/* ---- 备份 ---- */
function exportJSON() {
  const blob = new Blob([JSON.stringify(S, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = '日常SOP-' + today() + '.json';
  document.body.appendChild(a); a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  toast('已导出');
}
function importJSON() {
  const inp = document.createElement('input');
  inp.type = 'file'; inp.accept = '.json,application/json';
  inp.onchange = () => {
    const f = inp.files[0]; if (!f) return;
    const r = new FileReader();
    r.onload = () => {
      try {
        const o = JSON.parse(r.result);
        if (!Array.isArray(o.sops)) throw 0;
        if (!confirm('导入会覆盖现在全部数据，继续？')) return;
        S = mergeState(o); save(); closeSheet(); render(); toast('已导入');
      } catch (e) { toast('文件格式不对'); }
    };
    r.readAsText(f);
  };
  inp.click();
}

/* ---------------- 日历导出 ---------------- */
function nextOccurrence(s) {
  const d = new Date();
  for (let i = 0; i < 60; i++) {
    const t = new Date(d.getFullYear(), d.getMonth(), d.getDate() + i);
    if (dueOn(s, t)) return t;
  }
  return d;
}
function icsText() {
  const list = S.sops.filter(s => !s.off && s.remind);
  if (!list.length) return '';
  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const L = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//daily-sop//zh', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH', 'X-WR-CALNAME:日常提醒'];
  const clean = t => String(t || '').replace(/[\\;,]/g, m => '\\' + m).replace(/\n/g, '\\n');
  const BYDAY = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];
  list.forEach(s => {
    const [h, m] = s.remind.split(':');
    const start = nextOccurrence(s);
    const base = ymd(start).replace(/-/g, '');
    let rule = 'RRULE:FREQ=DAILY';
    if (s.freq === 'weekly') rule = 'RRULE:FREQ=WEEKLY;BYDAY=' + (s.dow || [1]).map(d => BYDAY[d]).join(',');
    if (s.freq === 'monthly') rule = 'RRULE:FREQ=MONTHLY;BYMONTHDAY=' + (s.dom || 1);
    L.push('BEGIN:VEVENT',
      `UID:${s.id}-${base}@daily-sop`,
      `DTSTAMP:${stamp}`,
      `DTSTART:${base}T${pad(h)}${pad(m || 0)}00`,
      rule,
      `SUMMARY:${clean(s.name)}`,
      `DESCRIPTION:${clean((s.steps || []).join(' / ') + (s.min ? ' ｜最小版：' + s.min : ''))}`,
      'BEGIN:VALARM', 'TRIGGER:PT0M', 'ACTION:DISPLAY', `DESCRIPTION:${clean(s.name)}`, 'END:VALARM',
      'END:VEVENT');
  });
  L.push('END:VCALENDAR');
  return L.join('\r\n');
}
function exportICS() {
  const txt = icsText();
  if (!txt) { toast('先给事项设一个提醒时间'); return; }
  const blob = new Blob([txt], { type: 'text/calendar;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = '日常提醒.ics';
  document.body.appendChild(a); a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 800);
  toast('已导出，用手机打开并加入日历');
}

/* ---------------- 提醒 ---------------- */
let lastDay = today();
let alarmQ = [], alarmShowing = false;
let snooze = [];
let audioCtx = null;

function inQuiet(d) {
  if (!S.settings.quietOn) return false;
  if (!S.settings.quietStart || !S.settings.quietEnd) return false;
  const cur = d.getHours() * 60 + d.getMinutes();
  const a = mins(S.settings.quietStart), b = mins(S.settings.quietEnd);
  return a <= b ? (cur >= a && cur < b) : (cur >= a || cur < b);
}
function beep() {
  try {
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === 'suspended') audioCtx.resume();
    const t0 = audioCtx.currentTime;
    [880, 1170].forEach((f, i) => {
      const o = audioCtx.createOscillator(), g = audioCtx.createGain();
      o.type = 'sine'; o.frequency.value = f;
      g.gain.setValueAtTime(0, t0 + i * 0.16);
      g.gain.linearRampToValueAtTime(0.09, t0 + i * 0.16 + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + i * 0.16 + 0.22);
      o.connect(g); g.connect(audioCtx.destination);
      o.start(t0 + i * 0.16); o.stop(t0 + i * 0.16 + 0.24);
    });
  } catch (e) { }
}
async function systemNotify(title, body) {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  try {
    const reg = await navigator.serviceWorker.getRegistration();
    const opts = { body, icon: './icon-192.png', badge: './icon-192.png', tag: 'sop-' + title, renotify: true, vibrate: [90, 50, 90] };
    if (reg) await reg.showNotification(title, opts);
    else new Notification(title, opts);
  } catch (e) { }
}
function fireAlarm(s, why) {
  alarmQ.push({ id: s.id, name: s.name, min: s.min, steps: s.steps, remind: s.remind, why: why || '到点了' });
  if (!alarmShowing) showNextAlarm();
}
function showNextAlarm() {
  const a = alarmQ.shift();
  const box = $('#alarm');
  if (!a) { alarmShowing = false; box.classList.remove('on'); return; }
  alarmShowing = true;
  const steps = a.steps || [];
  box.innerHTML = `<div class="alarm-in">
    <div class="ak"><span class="pulse"></span>${esc(a.why)}${a.remind ? ' · ' + esc(a.remind) : ''}</div>
    <div class="an">${esc(a.name)}</div>
    ${steps.length
      ? `<div class="al-steps">${steps.slice(0, 4).map((x, i) => `<div><b>${i + 1}</b><span>${esc(x)}</span></div>`).join('')}</div>`
      : `<div class="ad">${a.min ? '做不到标准版就做：<b>' + esc(a.min) + '</b>' : '该做这件事了'}</div>`}
    ${steps.length && a.min ? `<div class="ad" style="margin-top:7px;font-size:11.5px">不行就做最小版：<b>${esc(a.min)}</b></div>` : ''}
    <div class="ab">
      <button class="btn pri" data-act="alarm-done" data-id="${a.id}">做了</button>
      <button class="btn" data-act="alarm-min" data-id="${a.id}">最小版</button>
      <button class="btn ghost" data-act="alarm-skip" data-id="${a.id}">稍后</button>
    </div>
  </div>`;
  box.classList.add('on');
  box.dataset.id = a.id;
  try { navigator.vibrate && navigator.vibrate([90, 60, 90]); } catch (e) { }
  beep();
  systemNotify(a.name, steps.length ? steps.slice(0, 2).join(' → ') : (a.min ? '最小版：' + a.min : '该做这件事了'));
  clearTimeout(showNextAlarm._t);
  showNextAlarm._t = setTimeout(() => {
    if (alarmShowing) {
      alarmShowing = false;
      $('#alarm').classList.remove('on');
      setTimeout(showNextAlarm, 700);
    }
  }, 60000);
}
function dismissAlarm() {
  alarmShowing = false;
  $('#alarm').classList.remove('on');
  setTimeout(showNextAlarm, 700);
}
function checkReminders(initial) {
  const now = new Date();
  const d = today();
  if (d !== lastDay) { lastDay = d; render(); }
  if (!S.settings.remindOn) return;
  if (inQuiet(now)) return;
  const cur = now.getHours() * 60 + now.getMinutes();
  const day = S.settings.fired[d] || (S.settings.fired[d] = {});
  let changed = false;
  dueList(d).forEach(s => {
    if (!s.remind) return;
    const k = s.id + '@' + s.remind;
    if (day[k]) return;
    const delta = cur - mins(s.remind);
    if (delta < 0 || delta > 40) return;
    if (recOf(d, s.id)) { day[k] = 1; changed = true; return; }
    if (initial && delta > 12) { day[k] = 1; changed = true; return; }
    day[k] = 1; changed = true;
    fireAlarm(s, '到点了');
  });
  if (snooze.length) {
    const keep = [];
    snooze.forEach(x => {
      const s = S.sops.find(y => y.id === x.id);
      if (!s || recOf(today(), s.id)) return;
      if (Date.now() < x.at) { keep.push(x); return; }
      fireAlarm(s, '再提醒一次');
    });
    snooze = keep;
  }
  if (changed) {
    const keys = Object.keys(S.settings.fired);
    if (keys.length > 20) keys.slice(0, keys.length - 20).forEach(k => delete S.settings.fired[k]);
    save();
  }
}

/* ---------------- AI 调用 ---------------- */
let busy = false;
function contextText() {
  const lines = ['【我的清单】'];
  activeSOPs().forEach((s, i) => {
    lines.push(`${i + 1}. ${s.name}｜id:${s.id}｜${freqLabel(s)}｜提醒:${s.remind || '无'}｜约:${s.dur || '未设'}分钟｜步骤:${(s.steps || []).join(' → ') || '未填'}｜最小版:${s.min || '未填'}`);
  });
  lines.push('', '【最近 7 天记录】');
  for (let i = 6; i >= 0; i--) {
    const k = ymd(new Date(Date.now() - i * 86400000));
    const recs = S.records[k] || {};
    const ids = Object.keys(recs);
    const due = dueList(k);
    if (!ids.length) { lines.push(k + `：无记录（当天安排 ${due.map(x => x.name).join('、') || '无'}）`); continue; }
    lines.push(k + '：' + ids.map(id => {
      const s = S.sops.find(x => x.id === id);
      const r = recs[id];
      const st = r.st === 'done' ? '做了' : r.st === 'min' ? '只做最小版' : '没做';
      return (s ? s.name : '已删事项') + ':' + st + (r.note ? '（' + r.note + '）' : '');
    }).join('；'));
  }
  const ds = dayStat(today());
  lines.push('', `今天：${ds.rec}/${ds.total} 已记录，完成 ${ds.done + ds.min}`);
  return lines.join('\n');
}
function systemPrompt() {
  return `你是一个日常 SOP 的教练与编辑。用户会给你他当前的清单和最近记录，你帮他改得更容易执行。

规则：
1. 不说教、不鼓劲、不写"你可以的"。只说具体动作和具体改动。
2. 中文，简洁，一般不超过 200 字，除非用户要求详细。
3. 批评指向具体哪条记录、哪一步，不要泛泛而谈。
4. 判断一条 SOP 好不好只看三件事：触发点是否明确、第一步是否小到能立刻做、有没有最小版。
5. 频次要现实：每天的事项不超过 3 条；需要长期做的事，优先给成每周 1-2 次，而不是每天。
6. 建议新增或修改时，在回答最后输出一个或多个块（块外不要重复块内内容）：
<update>
{"action":"update","id":"s1","name":"睡前手机离床","freq":"daily","dow":[],"dom":1,"remind":"22:30","dur":10,"steps":["起身","手机放远","洗脸"],"min":"起身 → 手机放远"}
</update>
修改时必须使用清单里给出的真实 id。新建用 {"action":"new", ...} 且不带 id。freq 只能是 daily / weekly / monthly；weekly 时 dow 用 0-6（0 是周日）；monthly 时 dom 用 1-31。steps 最多 5 条，每条不超过 20 字，必须是能直接执行的动作。remind 用 24 小时制 HH:MM，不确定就不要给。
7. 涉及医疗、用药、诊断、极端情绪，只给组织建议，并提醒需要专业人士确认。`;
}
async function send(text) {
  text = (text || '').trim();
  if (!text || busy) return;
  const box = $('#chatIn'); if (box) box.value = '';
  S.chat.push({ role: 'user', content: text, ts: Date.now() });
  save();
  chatScroll = true;

  if (!S.settings.key) {
    S.chat.push({
      role: 'assistant',
      content: '（还没配模型 Key，我没法直接回答。\n点「复制给 AI」，把清单和记录连同这句话带到任意大模型里去问。）',
      ts: Date.now()
    });
    save(); render(); return;
  }

  busy = true; render();
  const ts = Date.now();
  try {
    const url = S.settings.apiBase + '/chat/completions';
    const history = S.chat.slice(-10).map(m => ({ role: m.role, content: m.content }));
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + S.settings.key },
      body: JSON.stringify({
        model: S.settings.model,
        messages: [{ role: 'system', content: systemPrompt() + '\n\n' + contextText() }, ...history],
        temperature: 0.5, max_tokens: 1400, stream: true
      })
    });
    if (!res.ok) { const t = await res.text(); throw new Error('HTTP ' + res.status + ' ' + t.slice(0, 150)); }

    busy = false;
    S.chat.push({ role: 'assistant', content: '', ts });
    render();
    const holder = document.querySelector(`[data-mid="${ts}"] .bubble`);

    let acc = '';
    if (res.body && res.body.getReader) {
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let buf = '', lastPaint = 0;
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        const parts = buf.split('\n');
        buf = parts.pop();
        for (const line of parts) {
          const t = line.trim();
          if (!t.startsWith('data:')) continue;
          const payload = t.slice(5).trim();
          if (payload === '[DONE]') continue;
          try {
            const j = JSON.parse(payload);
            const delta = j.choices && j.choices[0] && j.choices[0].delta && j.choices[0].delta.content;
            if (delta) acc += delta;
          } catch (e) { }
        }
        const now = Date.now();
        if (holder && now - lastPaint > 70) {
          lastPaint = now;
          holder.innerHTML = mdLite(acc.split('<update>')[0]);
        }
      }
    } else {
      const j = await res.json();
      acc = (j.choices && j.choices[0] && j.choices[0].message.content) || '';
    }
    S.chat[S.chat.length - 1].content = acc || '（空回复）';
  } catch (err) {
    S.chat.push({
      role: 'assistant',
      content: '调用失败：' + err.message + '\n\n可能是 Key 不对、网络不通，或这个接口不允许浏览器直接调用。\n可以改用「复制给 AI」去网页版里问。',
      ts
    });
  } finally {
    busy = false; save(); render();
  }
}
function applyPatch(p) {
  if (p.action === 'new' || !p.id) {
    S.sops.push({
      id: uid(), off: false,
      name: p.name || '新事项',
      freq: (p.freq === 'weekly' || p.freq === 'monthly') ? p.freq : 'daily',
      dow: Array.isArray(p.dow) ? p.dow : [],
      dom: Number(p.dom) || 1,
      remind: p.remind || '', dur: Number(p.dur) || 0,
      steps: Array.isArray(p.steps) ? p.steps : [], min: p.min || ''
    });
    save(); TAB = 'list'; render(); toast('已新增一条');
    return;
  }
  const s = S.sops.find(x => x.id === p.id);
  if (!s) { toast('找不到这条，可能已被删掉'); return; }
  if (p.name) s.name = p.name;
  if (p.freq) s.freq = p.freq;
  if (Array.isArray(p.dow)) s.dow = p.dow;
  if (p.dom) s.dom = Number(p.dom) || 1;
  if (p.remind !== undefined) s.remind = p.remind;
  if (p.dur !== undefined) s.dur = Number(p.dur) || 0;
  if (Array.isArray(p.steps)) s.steps = p.steps;
  if (p.min !== undefined) s.min = p.min;
  save(); TAB = 'list'; render(); toast('已更新「' + s.name + '」');
}
function copyPrompt() {
  const inp = $('#chatIn');
  const q = (inp && inp.value.trim()) || '看看我的记录，给三条具体建议。';
  const full = '你是我的日常 SOP 教练。下面是我的清单和最近记录。\n\n' + contextText() + '\n\n我的问题：' + q;
  const fallback = () => {
    const ta = document.createElement('textarea');
    ta.value = full; document.body.appendChild(ta); ta.select();
    try { document.execCommand('copy'); toast('已复制'); } catch (e) { alert(full); }
    ta.remove();
  };
  if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(full).then(() => toast('已复制，去任意大模型粘贴'), fallback);
  else fallback();
}

/* ---------------- 环境 ---------------- */
const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const isStandalone = () => window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;

/* ---------------- 事件 ---------------- */
document.addEventListener('click', e => {
  const tabBtn = e.target.closest('[data-tab]');
  if (tabBtn) {
    TAB = tabBtn.dataset.tab;
    openId = null;
    render(); window.scrollTo({ top: 0 }); return;
  }

  const el = e.target.closest('[data-act]');
  if (!el) return;
  const act = el.dataset.act, id = el.dataset.id;

  switch (act) {
    case 'toggle': openId = (openId === id) ? null : id; render(); break;
    case 'mark': setRec(id, el.dataset.st); break;
    case 'mark-date': setRec(id, el.dataset.st, el.dataset.date); break;
    case 'move-sop': {
      const ok = moveSop(id, Number(el.dataset.dir));
      render();
      toast(ok ? '已调整顺序' : '到头了');
      break;
    }
    case 'new-sop': openSOP(null); break;
    case 'edit-sop': closeSheet(); setTimeout(() => openSOP(id), 40); break;
    case 'save-sop': saveSOP(); break;
    case 'close-dlg': closeSheet(); break;
    case 'toggle-sop': {
      const s = S.sops.find(x => x.id === id); if (!s) return;
      s.off = !s.off; save(); render(); toast(s.off ? '已停用' : '已重新启用');
      break;
    }
    case 'del-sop': {
      const s = S.sops.find(x => x.id === id); if (!s) return;
      if (!confirm('删除「' + s.name + '」？已有记录会保留。')) return;
      S.sops = S.sops.filter(x => x.id !== id); save(); openId = null; render(); toast('已删除');
      break;
    }
    case 'set-freq': {
      el.parentNode.querySelectorAll('button').forEach(b => b.classList.toggle('on', b === el));
      const v = el.dataset.v;
      $('#dowRow').style.display = v === 'weekly' ? '' : 'none';
      $('#domRow').style.display = v === 'monthly' ? '' : 'none';
      break;
    }
    case 'pick-dow': el.classList.toggle('on'); break;
    case 'clear-remind': { const i = $('#fRemind'); if (i) i.value = ''; break; }
    case 'open-settings': openSettings(); break;
    case 'save-settings': saveSettings(); break;
    case 'theme': S.settings.theme = el.dataset.v; save(); applyTheme(); openSettings(); break;
    case 'tg-remind': S.settings.remindOn = !S.settings.remindOn; save(); openSettings(); break;
    case 'tg-quiet': S.settings.quietOn = !S.settings.quietOn; save(); openSettings(); break;
    case 'ask-perm': askPermission(); break;
    case 'export-ics': exportICS(); break;
    case 'export': exportJSON(); break;
    case 'import': importJSON(); break;
    case 'clear': {
      if (!confirm('清空全部事项和记录？不可撤销。')) return;
      localStorage.removeItem(KEY); S = defState(); save(); closeSheet(); render(); toast('已清空');
      break;
    }
    case 'cal-prev': calDate = new Date(calDate.getFullYear(), calDate.getMonth() - 1, 1); selDate = null; render(); break;
    case 'cal-next': calDate = new Date(calDate.getFullYear(), calDate.getMonth() + 1, 1); selDate = null; render(); break;
    case 'pick-day': selDate = el.dataset.date; render(); break;
    case 'go-chat': TAB = 'chat'; openId = null; render(); window.scrollTo({ top: 0 }); break;
    case 'go': TAB = el.dataset.tab; openId = null; render(); window.scrollTo({ top: 0 }); break;
    case 'quick': {
      const q = el.dataset.q; TAB = 'chat'; render(); setTimeout(() => send(q), 40); break;
    }
    case 'copy-prompt': copyPrompt(); break;
    case 'apply-patch': applyPatch(JSON.parse(el.dataset.p)); break;
    case 'alarm-done': setRec(id, 'done'); dismissAlarm(); break;
    case 'alarm-min': setRec(id, 'min'); dismissAlarm(); break;
    case 'alarm-skip':
      if (id) { snooze.push({ id, at: Date.now() + 5 * 60000 }); toast('5 分钟后再提醒'); }
      dismissAlarm();
      break;
    case 'dismiss-tip': S.settings.iosTip = true; save(); render(); break;
  }
});

document.addEventListener('input', e => {
  const el = e.target;
  if (el.dataset && el.dataset.act === 'note') {
    const d = today();
    if (S.records[d] && S.records[d][el.dataset.id]) { S.records[d][el.dataset.id].note = el.value; save(); }
  }
  if (el.id === 'chatIn') {
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 120) + 'px';
  }
});

document.addEventListener('keydown', e => {
  if (e.target.id === 'chatIn' && e.key === 'Enter' && !e.shiftKey && !e.isComposing) {
    e.preventDefault(); send(e.target.value);
  }
});
document.addEventListener('click', e => {
  if (e.target.id === 'sendBtn') { const i = $('#chatIn'); if (i) send(i.value); }
}, true);

async function askPermission() {
  if (!('Notification' in window)) { toast('这台设备不支持网页通知'); return; }
  if (Notification.permission === 'denied') { toast('已被拒绝，请到浏览器设置里允许通知'); return; }
  try {
    const p = await Notification.requestPermission();
    toast(p === 'granted' ? '已允许，到点会通知你' : '你拒绝了通知');
    openSettings();
  } catch (e) { toast('请求通知权限失败'); }
}

/* ---------------- 启动 ---------------- */
applyTheme();
render();
setInterval(() => checkReminders(), 15000);
setTimeout(() => checkReminders(true), 1200);
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) { checkReminders(true); render(); }
});

if ('serviceWorker' in navigator && location.protocol === 'https:') {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => { });
  });
}
