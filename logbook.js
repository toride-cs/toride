/* ═══════════════════════════════════════════════════════
   go2 cheatsheet — logbook.js  (OffSec ハンズオン・ログブック)
   Data: data.machines[], data.phases[]
   machine { id,name,platform,ip,os,difficulty,tags[], attempts[] }
   attempt { id,label,status,started_at,rooted_at, steps[],creds[],loot[] }
   step    { id,phase,command,note,learning,ts }
   phase   { id,label,color }

   app.js の共通関数（openModal/toast/esc/uid/saveToGitHub 等）を再利用する。
════════════════════════════════════════════════════════ */

/* ── ヘルパ ── */
function lbMachine()  { return data.machines.find(m => m.id === lbMachineId); }
function lbAttempt()  { const m = lbMachine(); return m ? m.attempts.find(a => a.id === lbAttemptId) : null; }
function lbPhase(id)  { return data.phases.find(p => p.id === id); }
function lbPhaseColor(id){ const p = lbPhase(id); return p ? p.color : "#7d9186"; }
function lbPhaseLabel(id){ if(!id) return "未分類"; const p = lbPhase(id); return p ? p.label : id; }

/* 経過時間を "2h 40m" 形式に */
function lbFmtDur(ms) {
  if (!ms || ms < 0) return "—";
  const min = Math.round(ms / 60000);
  const h = Math.floor(min / 60), m = min % 60;
  return h ? `${h}h ${m}m` : `${m}m`;
}
function lbAttemptElapsed(a) {
  if (!a || !a.started_at) return null;
  const end = a.rooted_at || (a.status === "root" || a.status === "レポート済" ? a.rooted_at : Date.now());
  return (end || Date.now()) - a.started_at;
}
function lbHHMM(ts) {
  if (!ts) return "";
  const d = new Date(ts);
  return `${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}`;
}

/* status → クラス/ラベル */
const LB_STATUS = {
  "未着手":   { cls: "todo", label: "未着手" },
  "進行中":   { cls: "prog", label: "進行中" },
  "root":     { cls: "root", label: "root" },
  "レポート済":{ cls: "rep",  label: "レポート済" },
};
function lbStatusMeta(s) { return LB_STATUS[s] || { cls: "todo", label: s || "未着手" }; }

/* マシンの代表ステータス（最新試行） */
function lbMachineStatus(m) {
  const a = m.attempts[m.attempts.length - 1];
  return a ? a.status : "未着手";
}
function lbMachineLogCount(m) { return m.attempts.reduce((n,a)=>n+a.steps.length, 0); }

/* ═══════════════════════════════════════════════════
   RENDER 切替
════════════════════════════════════════════════════ */
function renderLogbook() {
  renderLbNav();
  if (searchMode) { renderLbSearch(); return; }
  if (lbView === "machine") renderLbMachine();
  else renderLbMachines();
}

/* ── サイドバー（ログブック用） ── */
function renderLbNav() {
  const nav = document.getElementById("navList");
  const counts = {
    all: data.machines.length,
    prog: data.machines.filter(m => lbMachineStatus(m) === "進行中").length,
    root: data.machines.filter(m => ["root","レポート済"].includes(lbMachineStatus(m))).length,
    multi: data.machines.filter(m => m.attempts.length > 1).length,
  };
  const item = (key, icon, label, n, active) => `
    <button class="nav-item ${active?'active':''}" onclick="lbSetFilter('${key}')">
      <span class="material-symbols-rounded nav-icon">${icon}</span>
      <span class="nav-label">${label}</span>
      <span class="nav-count">${n}</span>
    </button>`;
  nav.innerHTML = `
    ${item("all","dns","すべてのマシン",counts.all, lbView==="machines" && lbFilter==="all")}
    ${item("prog","pending","進行中",counts.prog, lbView==="machines" && lbFilter==="prog")}
    ${item("root","verified","root 済",counts.root, lbView==="machines" && lbFilter==="root")}
    ${item("multi","replay","複数回挑戦",counts.multi, lbView==="machines" && lbFilter==="multi")}
    <div style="height:1px;background:var(--md-outline-var);margin:12px 8px;"></div>
    <button class="nav-item" onclick="lbEditPhases()">
      <span class="material-symbols-rounded nav-icon">tune</span>
      <span class="nav-label">フェーズを編集</span>
    </button>`;
}

function lbSetFilter(key) {
  lbView = "machines"; lbFilter = key; lbMachineId = null; searchMode = false;
  clearSearchInput(); render(); closeSidebar();
}

/* ═══════════════════════════════════════════════════
   画面1: マシン一覧
════════════════════════════════════════════════════ */
function renderLbMachines() {
  const main = document.getElementById("main");
  let list = data.machines.slice();
  if (lbFilter === "prog") list = list.filter(m => lbMachineStatus(m) === "進行中");
  else if (lbFilter === "root") list = list.filter(m => ["root","レポート済"].includes(lbMachineStatus(m)));
  else if (lbFilter === "multi") list = list.filter(m => m.attempts.length > 1);

  const rootN = data.machines.filter(m => ["root","レポート済"].includes(lbMachineStatus(m))).length;
  const progN = data.machines.filter(m => lbMachineStatus(m) === "進行中").length;

  const cards = list.map(m => {
    const st = lbStatusMeta(lbMachineStatus(m));
    const logN = lbMachineLogCount(m);
    const lastA = m.attempts[m.attempts.length - 1];
    const elapsed = lbFmtDur(lbAttemptElapsed(lastA));
    const attemptBadge = m.attempts.length > 1
      ? `<span class="lb-attempt-badge">${m.attempts.length}回挑戦</span>` : "";
    const attemptPills = m.attempts.map((a,i) => {
      const s = lbStatusMeta(a.status);
      const done = ["root","レポート済"].includes(a.status);
      return `<span class="lb-pill ${done?'done':(a.status==='進行中'?'cur':'')}">${esc(a.label)}${done?' ✓':''}</span>`;
    }).join("");
    const diff = [0,1,2].map(i => `<i class="${i < (m.difficulty||0) ? 'on':''}"></i>`).join("");

    return `
      <button class="lb-mcard" onclick="lbOpenMachine('${m.id}')">
        <div class="lb-platform">${esc(m.platform||"—")}</div>
        <h3>${esc(m.name)} <span class="lb-status ${st.cls}">${st.label}</span> ${attemptBadge}</h3>
        <div class="lb-ip">${esc(m.ip||"")}</div>
        <div class="lb-os">${esc(m.os||"")}</div>
        <div class="lb-attempt-mini">挑戦: ${attemptPills}</div>
        <div class="lb-meta-row">
          <span class="lb-metric"><b>${logN}</b> ログ</span>
          <span class="lb-metric">難易度 <span class="lb-diff">${diff}</span></span>
          <span class="lb-metric" style="margin-left:auto">${elapsed}</span>
        </div>
      </button>`;
  }).join("");

  main.innerHTML = `
    <div class="lb-head">
      <h1>マシン</h1>
      <span class="lb-count">${data.machines.length} 台 · root ${rootN} · 進行中 ${progN}</span>
      <button class="btn btn-filled" onclick="lbAddMachine()"><span class="material-symbols-rounded">add</span>マシンを追加</button>
    </div>
    ${list.length ? `<div class="lb-grid">${cards}</div>`
      : emptyState("dns", data.machines.length ? "該当するマシンがありません" : "まだマシンがありません",
          data.machines.length ? "フィルタを変えてください" : "「マシンを追加」から攻略ログを始めましょう")}
  `;
}

/* ═══════════════════════════════════════════════════
   画面2: 攻略ログ（1マシン・試行切替）
════════════════════════════════════════════════════ */
function lbOpenMachine(id) {
  const m = data.machines.find(x => x.id === id);
  if (!m) return;
  lbMachineId = id;
  lbAttemptId = m.attempts[m.attempts.length - 1].id; // 最新の試行を開く
  lbPhaseFilter = null;
  lbView = "machine";
  searchMode = false; clearSearchInput();
  render();
  document.getElementById("main").scrollTop = 0;
}

function lbSwitchAttempt(aid) { lbAttemptId = aid; lbPhaseFilter = null; renderLbMachine(); }
function lbSetPhaseFilter(pid) { lbPhaseFilter = pid; renderLbMachine(); }

function renderLbMachine() {
  const main = document.getElementById("main");
  const m = lbMachine();
  if (!m) { lbSetFilter("all"); return; }
  let a = lbAttempt();
  if (!a) { a = m.attempts[m.attempts.length-1]; lbAttemptId = a.id; }

  // 試行タブ
  const attemptTabs = m.attempts.map(at => {
    const s = lbStatusMeta(at.status);
    const on = at.id === lbAttemptId;
    return `<button class="lb-attempt-tab ${on?'on':''}" onclick="lbSwitchAttempt('${at.id}')">
      <span>${esc(at.label)}</span><span class="st ${s.cls}">${s.label}</span>
    </button>`;
  }).join("");

  // フェーズフィルタ
  const phaseCounts = {};
  a.steps.forEach(s => { phaseCounts[s.phase||"__none"] = (phaseCounts[s.phase||"__none"]||0)+1; });
  const phaseTabs = data.phases.map(p => `
    <button class="lb-phase-tab ${lbPhaseFilter===p.id?'on':''}" onclick="lbSetPhaseFilter('${p.id}')">
      <span class="lb-dot" style="background:${p.color}"></span>${esc(p.label)}
      <span class="cnt">${phaseCounts[p.id]||0}</span>
    </button>`).join("");
  const noneCount = phaseCounts["__none"]||0;
  const noneTab = noneCount ? `<button class="lb-phase-tab ${lbPhaseFilter==='__none'?'on':''}" onclick="lbSetPhaseFilter('__none')">未分類 <span class="cnt">${noneCount}</span></button>` : "";

  // タイムライン
  let steps = a.steps.slice();
  if (lbPhaseFilter === "__none") steps = steps.filter(s => !s.phase);
  else if (lbPhaseFilter) steps = steps.filter(s => s.phase === lbPhaseFilter);

  const timeline = steps.length ? steps.map((s, idx) => {
    const realIdx = a.steps.indexOf(s);
    const color = lbPhaseColor(s.phase);
    const plabel = lbPhaseLabel(s.phase);
    const cmd = s.command ? `
      <div class="lb-cmd">
        <span class="lb-prompt">$ </span>${esc(s.command)}
        <button class="lb-copy" onclick="copyCell(event, this.dataset.copy)" data-copy="${esc(s.command)}"><span class="material-symbols-rounded">content_copy</span></button>
      </div>` : "";
    const note = s.note ? `<div class="lb-note"><span class="lb-arrow">→ </span>${esc(s.note)}</div>` : "";
    const learn = s.learning
      ? `<div class="lb-learn"><b>learn</b> ${esc(s.learning)}</div>`
      : `<button class="lb-add-learn" onclick="lbEditLearning('${realIdx}')"><span class="material-symbols-rounded">add</span>学びを追記</button>`;
    return `
      <div class="lb-entry" style="--pc:${color}">
        <div class="lb-entry-head">
          <span class="lb-ph-badge" style="background:${color}22;color:${color}">${esc(plabel)}</span>
          <button class="lb-step-edit" onclick="lbEditStep('${realIdx}')" title="編集"><span class="material-symbols-rounded">edit</span></button>
          <button class="lb-step-del" onclick="lbDelStep('${realIdx}')" title="削除"><span class="material-symbols-rounded">delete</span></button>
          <span class="lb-entry-time">${lbHHMM(s.ts)}</span>
        </div>
        ${cmd}${note}${learn}
      </div>`;
  }).join("") : `<div class="lb-empty-timeline">${esc(lbPhaseFilter?"このフェーズのログはありません":"まだログがありません。上の入力欄から記録を始めましょう。")}</div>`;

  // 現在のフェーズ選択（入力欄）
  const curPhase = window.__lbInputPhase || data.phases[0]?.id || "";
  const phaseOpts = data.phases.map(p => `<option value="${p.id}" ${p.id===curPhase?'selected':''}>[${esc(p.label)}]</option>`).join("");

  // 資格情報・フラグ
  const creds = (a.creds||[]).map(c => `
    <div class="lb-cred"><span class="u">${esc(c.user||"")}</span><span class="sep">:</span><span class="p">${esc(c.pass||"")}</span></div>`).join("")
    || `<div class="lb-side-empty">なし</div>`;

  const elapsed = lbFmtDur(lbAttemptElapsed(a));

  main.innerHTML = `
    <div class="lb-machine">
      <div class="lb-machine-main">
        <div class="crumb"><button onclick="lbSetFilter('all')">ログブック</button> / <b>${esc(m.name)}</b></div>
        <div class="lb-m-title">
          <h1>${esc(m.name)}</h1>
          ${m.ip?`<span class="lb-ip">${esc(m.ip)}</span>`:""}
          <button class="lb-m-edit" onclick="lbEditMachine('${m.id}')" title="マシン情報を編集"><span class="material-symbols-rounded">settings</span></button>
        </div>
        <div class="lb-m-sub">${esc([m.platform,m.os].filter(Boolean).join(" · "))}</div>

        <div class="lb-attempt-tabs">
          ${attemptTabs}
          <button class="lb-attempt-tab add" onclick="lbAddAttempt()"><span class="material-symbols-rounded">add</span>新しい挑戦</button>
        </div>

        <div class="lb-quick">
          <button class="lb-phase-pick" onclick="lbCyclePhase()" title="フェーズを選択" id="lbPhasePickBtn">[${esc(lbPhaseLabel(curPhase))}] ▾</button>
          <input id="lbQuickInput" placeholder="コマンドと結果を1行で…  例: rpcclient で匿名列挙 → svc-alfresco 発見" onkeydown="if(event.key==='Enter')lbQuickAdd()">
          <button class="lb-go" onclick="lbQuickAdd()">記録</button>
        </div>
        <div class="lb-quick-hint">先頭に <b>[フェーズ名]</b> を付けると分類。<b>→</b> の後ろが結果メモ。 例: <span class="lb-hint-mono">[enum] nmap -sV ... → ポート発見</span></div>

        <div class="lb-phase-tabs">
          <button class="lb-phase-tab ${!lbPhaseFilter?'on':''}" onclick="lbSetPhaseFilter(null)">すべて <span class="cnt">${a.steps.length}</span></button>
          ${phaseTabs}${noneTab}
          <button class="lb-phase-edit" onclick="lbEditPhases()"><span class="material-symbols-rounded">tune</span>編集</button>
        </div>

        <div class="lb-timeline">${timeline}</div>
      </div>

      <aside class="lb-side">
        <div class="lb-side-sec">
          <h4>この挑戦</h4>
          <div class="lb-kv"><span class="k">ラベル</span><span class="v">${esc(a.label)}</span></div>
          <div class="lb-kv"><span class="k">状態</span><span class="v">${lbStatusMeta(a.status).label}</span></div>
          <div class="lb-kv"><span class="k">経過</span><span class="v">${elapsed}</span></div>
          <button class="lb-status-btn" onclick="lbChangeStatus()"><span class="material-symbols-rounded">flag</span>状態を変更</button>
        </div>
        <div class="lb-side-sec">
          <h4>取得した資格情報 <button class="lb-mini-add" onclick="lbAddCred()">＋</button></h4>
          ${creds}
        </div>
        <div class="lb-side-sec">
          <h4>戦利品 / フラグ</h4>
          <label class="lb-flag"><input type="checkbox" ${a.loot.includes('user.txt')?'checked':''} onchange="lbToggleFlag('user.txt')"> 🚩 user.txt</label>
          <label class="lb-flag"><input type="checkbox" ${a.loot.includes('root.txt')?'checked':''} onchange="lbToggleFlag('root.txt')"> 🚩 root.txt</label>
        </div>
        <div class="lb-side-sec">
          <h4>出力</h4>
          <button class="lb-report-btn" onclick="lbOpenReport()"><span class="material-symbols-rounded">description</span>この挑戦のレポート</button>
        </div>
      </aside>
    </div>`;
}

/* ── ワンライン入力 ── */
function lbCyclePhase() {
  const cur = window.__lbInputPhase || data.phases[0]?.id;
  const idx = data.phases.findIndex(p => p.id === cur);
  const next = data.phases[(idx + 1) % data.phases.length];
  window.__lbInputPhase = next.id;
  const btn = document.getElementById("lbPhasePickBtn");
  if (btn) btn.textContent = `[${next.label}] ▾`;
}
function lbQuickAdd() {
  const input = document.getElementById("lbQuickInput");
  if (!input) return;
  const raw = input.value.trim();
  if (!raw) return;
  const a = lbAttempt(); if (!a) return;

  // 先頭 [phase] を解釈
  let phase = window.__lbInputPhase || data.phases[0]?.id || "";
  let text = raw;
  const m = raw.match(/^\[([^\]]+)\]\s*(.*)$/);
  if (m) {
    const found = data.phases.find(p => p.label.toLowerCase() === m[1].toLowerCase() || p.id.toLowerCase() === m[1].toLowerCase());
    if (found) { phase = found.id; text = m[2]; }
  }
  // "→" または "->" で command / note を分割
  let command = text, note = "";
  const arrow = text.split(/\s*(?:→|->)\s*/);
  if (arrow.length >= 2) { command = arrow[0].trim(); note = arrow.slice(1).join(" → ").trim(); }

  a.steps.push({ id: uid(), phase, command, note, learning: "", ts: Date.now() });
  input.value = "";
  renderLbMachine();
}

/* ── ステップ編集 ── */
function lbEditStep(idx) {
  const a = lbAttempt(); if (!a) return;
  const s = a.steps[idx]; if (!s) return;
  const phaseOpts = data.phases.map(p => `<option value="${p.id}" ${p.id===s.phase?'selected':''}>[${esc(p.label)}]</option>`).join("")
    + `<option value="" ${!s.phase?'selected':''}>（未分類）</option>`;
  openModal("ログを編集",
    `<label>フェーズ</label><select id="mPhase">${phaseOpts}</select>
     <label>コマンド</label><textarea id="mCmd" style="min-height:60px">${esc(s.command)}</textarea>
     <label>結果メモ</label><textarea id="mNote" style="min-height:50px">${esc(s.note)}</textarea>
     <label>学び</label><textarea id="mLearn" style="min-height:50px">${esc(s.learning)}</textarea>`,
    () => {
      s.phase = val("mPhase"); s.command = val("mCmd"); s.note = val("mNote"); s.learning = val("mLearn");
      renderLbMachine();
    });
}
function lbEditLearning(idx) {
  const a = lbAttempt(); if (!a) return;
  const s = a.steps[idx]; if (!s) return;
  openModal("学びを追記",
    `<label>このステップから得た学び</label><textarea id="mLearn" style="min-height:80px" placeholder="例: AD で匿名 enum できたら AS-REP roasting を反射的に試す">${esc(s.learning)}</textarea>`,
    () => { s.learning = val("mLearn"); renderLbMachine(); });
}
function lbDelStep(idx) {
  const a = lbAttempt(); if (!a) return;
  if (!confirm("このログを削除しますか？")) return;
  a.steps.splice(idx, 1);
  renderLbMachine();
}

/* ── 資格情報・フラグ・状態 ── */
function lbAddCred() {
  openModal("資格情報を追加",
    `<label>ユーザー名</label><input id="mUser" placeholder="svc-alfresco">
     <label>パスワード / ハッシュ</label><input id="mPass" placeholder="s3rvice">`,
    () => {
      const a = lbAttempt(); if (!a) return;
      const user = val("mUser").trim(); if (!user) return;
      a.creds.push({ user, pass: val("mPass").trim() });
      renderLbMachine();
    });
}
function lbToggleFlag(flag) {
  const a = lbAttempt(); if (!a) return;
  const i = a.loot.indexOf(flag);
  if (i >= 0) a.loot.splice(i, 1); else a.loot.push(flag);
  // root.txt を取ったら状態を root に
  if (flag === "root.txt" && a.loot.includes("root.txt") && a.status === "進行中") {
    a.status = "root"; a.rooted_at = Date.now();
  }
  renderLbMachine();
}
function lbChangeStatus() {
  const a = lbAttempt(); if (!a) return;
  const opts = ["未着手","進行中","root","レポート済"].map(s =>
    `<option value="${s}" ${s===a.status?'selected':''}>${s}</option>`).join("");
  openModal("状態を変更",
    `<label>この挑戦の状態</label><select id="mStatus">${opts}</select>`,
    () => {
      a.status = val("mStatus");
      if ((a.status === "root" || a.status === "レポート済") && !a.rooted_at) a.rooted_at = Date.now();
      renderLbMachine();
    });
}

/* ═══════════════════════════════════════════════════
   マシン CRUD
════════════════════════════════════════════════════ */
function lbAddMachine() {
  openModal("マシンを追加",
    `<label>マシン名</label><input id="mName" placeholder="Forest">
     <label>プラットフォーム</label><input id="mPlat" placeholder="Hack The Box / Proving Grounds / OSCP Lab">
     <label>IP アドレス</label><input id="mIp" placeholder="10.10.10.161">
     <label>OS / 種別</label><input id="mOs" placeholder="🪟 Windows · AD">
     <label>難易度（1〜3）</label><input id="mDiff" type="number" min="1" max="3" value="1">`,
    () => {
      const name = val("mName").trim(); if (!name) { toast("マシン名を入力してください"); return; }
      const machine = {
        id: uid(), name, platform: val("mPlat").trim(), ip: val("mIp").trim(),
        os: val("mOs").trim(), difficulty: Math.max(1,Math.min(3,+val("mDiff")||1)), tags: [],
        attempts: [{ id: uid(), label: "1回目", status: "進行中", started_at: Date.now(), rooted_at: null, steps: [], creds: [], loot: [] }],
      };
      data.machines.push(machine);
      lbOpenMachine(machine.id);
      toast("✅ マシンを追加しました");
    });
}
function lbEditMachine(id) {
  const m = data.machines.find(x => x.id === id); if (!m) return;
  openModal("マシン情報を編集",
    `<label>マシン名</label><input id="mName" value="${esc(m.name)}">
     <label>プラットフォーム</label><input id="mPlat" value="${esc(m.platform)}">
     <label>IP アドレス</label><input id="mIp" value="${esc(m.ip)}">
     <label>OS / 種別</label><input id="mOs" value="${esc(m.os)}">
     <label>難易度（1〜3）</label><input id="mDiff" type="number" min="1" max="3" value="${m.difficulty||1}">
     <div style="margin-top:16px;border-top:1px solid var(--md-outline-var);padding-top:12px">
       <button class="btn btn-text btn-danger" onclick="lbDelMachine('${m.id}')" style="padding-left:0"><span class="material-symbols-rounded">delete</span>このマシンを削除</button>
     </div>`,
    () => {
      m.name = val("mName").trim() || m.name; m.platform = val("mPlat").trim();
      m.ip = val("mIp").trim(); m.os = val("mOs").trim();
      m.difficulty = Math.max(1,Math.min(3,+val("mDiff")||1));
      renderLbMachine();
    });
}
function lbDelMachine(id) {
  const m = data.machines.find(x => x.id === id); if (!m) return;
  if (!confirm(`「${m.name}」を全ての挑戦ログごと削除しますか？`)) return;
  data.machines = data.machines.filter(x => x.id !== id);
  closeModal();
  lbSetFilter("all");
  toast("🗑 削除しました");
}

/* ── 試行（挑戦回数） ── */
function lbAddAttempt() {
  const m = lbMachine(); if (!m) return;
  const n = m.attempts.length + 1;
  openModal("新しい挑戦を追加",
    `<label>ラベル</label><input id="mLabel" value="${n}回目" placeholder="例: 復習・ノーヒント / 試験想定">
     <div class="modal-radio" style="margin-top:14px">
       <label><input type="radio" name="aBase" value="empty" checked> ゼロから始める</label>
       <label><input type="radio" name="aBase" value="clone"> 前回のログを下敷きにする（コマンドを引き継ぎ、メモは消す）</label>
     </div>`,
    () => {
      const label = val("mLabel").trim() || `${n}回目`;
      const base = document.querySelector('input[name="aBase"]:checked')?.value;
      let steps = [];
      if (base === "clone") {
        const prev = m.attempts[m.attempts.length - 1];
        steps = prev.steps.map(s => ({ id: uid(), phase: s.phase, command: s.command, note: "", learning: "", ts: Date.now() }));
      }
      const at = { id: uid(), label, status: "進行中", started_at: Date.now(), rooted_at: null, steps, creds: [], loot: [] };
      m.attempts.push(at);
      lbAttemptId = at.id;
      renderLbMachine();
      toast("✅ 新しい挑戦を開始しました");
    });
}

/* ═══════════════════════════════════════════════════
   フェーズ編集
════════════════════════════════════════════════════ */
const LB_PHASE_PALETTE = ["#5aa9e0","#b085e0","#e0a944","#45c8b0","#e05c5c","#3fd07f","#e084c8","#8ab0e0","#c8a45a"];

function lbEditPhases() {
  renderPhaseEditor();
}
function renderPhaseEditor() {
  const rows = data.phases.map((p, i) => {
    // 使用ログ数を集計
    let n = 0;
    data.machines.forEach(m => m.attempts.forEach(a => a.steps.forEach(s => { if (s.phase === p.id) n++; })));
    return `
      <div class="lb-phase-row" data-i="${i}">
        <span class="lb-drag">⠿</span>
        <span class="lb-swatch" style="background:${p.color}" onclick="lbCyclePhaseColor(${i})" title="色を変更"></span>
        <input class="lb-phase-name" value="${esc(p.label)}" onchange="lbRenamePhase(${i}, this.value)">
        <span class="lb-phase-count">${n} ログ</span>
        <button class="lb-phase-up" onclick="lbMovePhase(${i},-1)" ${i===0?'disabled':''}><span class="material-symbols-rounded">arrow_upward</span></button>
        <button class="lb-phase-down" onclick="lbMovePhase(${i},1)" ${i===data.phases.length-1?'disabled':''}><span class="material-symbols-rounded">arrow_downward</span></button>
        <button class="lb-phase-del" onclick="lbDelPhase(${i})"><span class="material-symbols-rounded">delete</span></button>
      </div>`;
  }).join("");

  document.getElementById("modalTitle").textContent = "フェーズを編集";
  document.getElementById("modalBody").innerHTML = `
    <div class="lb-phase-list">${rows}</div>
    <button class="lb-add-phase" onclick="lbAddPhase()"><span class="material-symbols-rounded">add</span>フェーズを追加</button>
    <div class="lb-del-note">🛈 フェーズを削除しても、そのフェーズのログは消えません。<b>「未分類」に移動して残る</b>ので、後で振り直せます。並び順はタイムラインとレポートの見出し順になります。</div>`;
  document.getElementById("modalOverlay").classList.add("open");
  // フェーズ編集はOKボタン不要（即時反映）なので、閉じるだけにする
  const actions = document.querySelector(".modal-actions");
  actions.innerHTML = `<button class="btn btn-filled" onclick="closeModal(); if(appMode==='logbook') render();">完了</button>`;
  modalCb = null;
}
function lbAddPhase() {
  const id = "ph_" + uid();
  const color = LB_PHASE_PALETTE[data.phases.length % LB_PHASE_PALETTE.length];
  data.phases.push({ id, label: "新フェーズ", color });
  renderPhaseEditor();
}
function lbRenamePhase(i, name) {
  if (data.phases[i]) { data.phases[i].label = name.trim() || data.phases[i].label; }
}
function lbCyclePhaseColor(i) {
  const p = data.phases[i]; if (!p) return;
  const idx = LB_PHASE_PALETTE.indexOf(p.color);
  p.color = LB_PHASE_PALETTE[(idx + 1) % LB_PHASE_PALETTE.length];
  renderPhaseEditor();
}
function lbMovePhase(i, dir) {
  const ni = i + dir;
  if (ni < 0 || ni >= data.phases.length) return;
  [data.phases[i], data.phases[ni]] = [data.phases[ni], data.phases[i]];
  renderPhaseEditor();
}
function lbDelPhase(i) {
  const p = data.phases[i]; if (!p) return;
  if (data.phases.length <= 1) { toast("最後のフェーズは削除できません"); return; }
  // このフェーズのログを「未分類」(phase="") に退避
  let moved = 0;
  data.machines.forEach(m => m.attempts.forEach(a => a.steps.forEach(s => {
    if (s.phase === p.id) { s.phase = ""; moved++; }
  })));
  data.phases.splice(i, 1);
  renderPhaseEditor();
  if (moved) toast(`${moved}件のログを未分類へ移動しました`);
}

/* ═══════════════════════════════════════════════════
   レポート出力（方式A・AIなし）
════════════════════════════════════════════════════ */
let lbReportOpts = { md:true, jp:true, en:true, learn:false, ts:true, fmt:"md" };

function lbOpenReport() {
  lbView = "report";
  renderLbReport();
}
function renderLbReport() {
  const main = document.getElementById("main");
  const m = lbMachine(); const a = lbAttempt();
  if (!m || !a) { lbSetFilter("all"); return; }

  // フェーズ順にグループ化
  const ordered = data.phases.map(p => ({ phase: p, steps: a.steps.filter(s => s.phase === p.id) }))
    .filter(g => g.steps.length);
  const noneSteps = a.steps.filter(s => !s.phase);
  if (noneSteps.length) ordered.push({ phase: { label: "Notes", color: "#7d9186" }, steps: noneSteps });

  // 英語見出し対応
  const EN_HEAD = { recon:"Reconnaissance", enum:"Enumeration", foothold:"Initial Foothold",
    lateral:"Lateral Movement", privesc:"Privilege Escalation", loot:"Loot / Post-Exploitation" };
  const enHead = (p) => EN_HEAD[p.id] || EN_HEAD[p.label?.toLowerCase()] || (p.label.charAt(0).toUpperCase()+p.label.slice(1));

  const elapsed = lbFmtDur(lbAttemptElapsed(a));
  let sectionN = 0;
  const sections = ordered.map(g => {
    sectionN++;
    const body = g.steps.map(s => {
      const jp = (lbReportOpts.jp && s.note) ? `<div class="lb-doc-jp"><span class="lbl">あなたのメモ</span>${esc(s.note)}</div>` : "";
      const en = lbReportOpts.en ? `<div class="lb-doc-en"><span class="lbl">English (自分で記入)</span><span class="ph">${s.note?'ここに英訳を書く…':'—'}</span></div>` : "";
      const learn = (lbReportOpts.learn && s.learning) ? `<div class="lb-doc-learn"><span class="lbl">learning</span>${esc(s.learning)}</div>` : "";
      const cmd = s.command ? `<div class="lb-doc-code">${lbReportOpts.ts?`<span class="c"># ${lbHHMM(s.ts)}</span>\n`:""}$ ${esc(s.command)}${s.note?`\n<span class="c"># → ${esc(s.note)}</span>`:""}</div>` : "";
      return jp + en + cmd + learn;
    }).join("");
    return `<div class="lb-doc-h">## ${sectionN}. ${esc(enHead(g.phase))}</div>${body}`;
  }).join("");

  const tog = (key, label) => `
    <div class="lb-side-toggle" onclick="lbToggleReport('${key}')">
      <span>${label}</span><span class="lb-sw ${lbReportOpts[key]?'':'off'}"></span>
    </div>`;
  const fmtOpt = (key, label) => `
    <div class="lb-fmt-opt ${lbReportOpts.fmt===key?'on':''}" onclick="lbSetReportFmt('${key}')">
      <span class="ic">${lbReportOpts.fmt===key?'▣':'▤'}</span>${label}
    </div>`;

  main.innerHTML = `
    <div class="lb-report">
      <div class="lb-report-doc">
        <div class="crumb"><button onclick="lbSetFilter('all')">ログブック</button> / <button onclick="lbOpenMachine('${m.id}')">${esc(m.name)}</button> / <b>レポート</b></div>
        <div class="lb-doc-title">${esc(m.name)} — Walkthrough (${esc(a.label)})</div>
        <div class="lb-doc-meta">
          ${m.ip?`<span>Target: ${esc(m.ip)}</span>`:""}
          ${m.os?`<span>OS: ${esc(m.os)}</span>`:""}
          ${m.platform?`<span>Platform: ${esc(m.platform)}</span>`:""}
          <span>Time: ${elapsed}</span>
        </div>
        ${sections || emptyState("description","ログがありません","攻略ログを記録するとレポートが生成されます")}
      </div>
      <aside class="lb-report-side">
        <div class="lb-side-sec"><h4>出力フォーマット</h4>
          ${fmtOpt("md","Markdown (.md)")}${fmtOpt("html","HTML")}
        </div>
        <div class="lb-side-sec"><h4>含める内容</h4>
          ${tog("jp","日本語メモを含める")}
          ${tog("en","英訳欄を作る")}
          ${tog("learn","学びメモを含める")}
          ${tog("ts","タイムスタンプ")}
        </div>
        <button class="lb-dl-btn" onclick="lbDownloadReport()"><span class="material-symbols-rounded">download</span>レポートを書き出す</button>
        <p class="lb-report-hint">AIは使いません。見出し・コマンド・タイムスタンプは自動。地の文（英語）は英訳欄に自分で記入します。日本語メモだけの「自分用」でも出力できます。</p>
      </aside>
    </div>`;
}
function lbToggleReport(key) { lbReportOpts[key] = !lbReportOpts[key]; renderLbReport(); }
function lbSetReportFmt(fmt) { lbReportOpts.fmt = fmt; renderLbReport(); }

function lbBuildReportMarkdown() {
  const m = lbMachine(); const a = lbAttempt();
  const ordered = data.phases.map(p => ({ phase: p, steps: a.steps.filter(s => s.phase === p.id) })).filter(g => g.steps.length);
  const noneSteps = a.steps.filter(s => !s.phase);
  if (noneSteps.length) ordered.push({ phase: { label: "Notes", id:"" }, steps: noneSteps });
  const EN_HEAD = { recon:"Reconnaissance", enum:"Enumeration", foothold:"Initial Foothold", lateral:"Lateral Movement", privesc:"Privilege Escalation", loot:"Loot / Post-Exploitation" };
  const enHead = (p) => EN_HEAD[p.id] || (p.label.charAt(0).toUpperCase()+p.label.slice(1));

  let out = `# ${m.name} — Walkthrough (${a.label})\n\n`;
  const meta = [];
  if (m.ip) meta.push(`- **Target:** ${m.ip}`);
  if (m.os) meta.push(`- **OS:** ${m.os}`);
  if (m.platform) meta.push(`- **Platform:** ${m.platform}`);
  meta.push(`- **Time:** ${lbFmtDur(lbAttemptElapsed(a))}`);
  out += meta.join("\n") + "\n\n";

  // 資格情報
  if (a.creds && a.creds.length) {
    out += `## Credentials\n\n`;
    a.creds.forEach(c => out += `- \`${c.user}${c.pass?":"+c.pass:""}\`\n`);
    out += "\n";
  }

  let n = 0;
  ordered.forEach(g => {
    n++;
    out += `## ${n}. ${enHead(g.phase)}\n\n`;
    g.steps.forEach(s => {
      if (lbReportOpts.jp && s.note) out += `> **メモ:** ${s.note}\n\n`;
      if (lbReportOpts.en) out += `_English:_ ${s.note ? "________________________" : ""}\n\n`;
      if (s.command) {
        out += "```bash\n";
        if (lbReportOpts.ts) out += `# ${lbHHMM(s.ts)}\n`;
        out += `${s.command}\n`;
        if (s.note) out += `# → ${s.note}\n`;
        out += "```\n\n";
      }
      if (lbReportOpts.learn && s.learning) out += `📝 _${s.learning}_\n\n`;
    });
  });
  // フラグ
  if (a.loot && a.loot.length) out += `## Flags\n\n${a.loot.map(f=>`- \`${f}\``).join("\n")}\n`;
  return out;
}
function lbDownloadReport() {
  const m = lbMachine(); const a = lbAttempt();
  const md = lbBuildReportMarkdown();
  const base = `${m.name}_${a.label}`.replace(/[^\w\-]+/g, "_");
  if (lbReportOpts.fmt === "html") {
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${esc(m.name)} Report</title>
<style>body{font-family:system-ui,sans-serif;max-width:820px;margin:40px auto;padding:0 20px;line-height:1.6;color:#1a1a1a}
pre{background:#0d1117;color:#e6edf3;padding:14px;border-radius:8px;overflow-x:auto}
code{font-family:ui-monospace,monospace}blockquote{border-left:3px solid #ccc;margin:0;padding-left:14px;color:#555}
h1{border-bottom:2px solid #3fd07f;padding-bottom:10px}h2{color:#146c2e;margin-top:28px}</style></head><body>
${lbMarkdownToHtml(md)}</body></html>`;
    downloadJSONRaw(html, `${base}.html`, "text/html");
  } else {
    downloadJSONRaw(md, `${base}.md`, "text/markdown");
  }
  toast("📄 レポートを書き出しました");
}
/* 最小限のMarkdown→HTML（レポート用） */
function lbMarkdownToHtml(md) {
  const escH = s => s.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
  const lines = md.split("\n");
  let html = "", inCode = false;
  for (let line of lines) {
    if (line.startsWith("```")) {
      if (!inCode) { html += "<pre><code>"; inCode = true; } else { html += "</code></pre>\n"; inCode = false; }
      continue;
    }
    if (inCode) { html += escH(line) + "\n"; continue; }
    if (line.startsWith("# ")) html += `<h1>${escH(line.slice(2))}</h1>\n`;
    else if (line.startsWith("## ")) html += `<h2>${escH(line.slice(3))}</h2>\n`;
    else if (line.startsWith("> ")) html += `<blockquote>${escH(line.slice(2)).replace(/\*\*(.+?)\*\*/g,"<b>$1</b>")}</blockquote>\n`;
    else if (line.startsWith("- ")) html += `<li>${escH(line.slice(2)).replace(/`(.+?)`/g,"<code>$1</code>")}</li>\n`;
    else if (line.trim()) html += `<p>${escH(line).replace(/\*\*(.+?)\*\*/g,"<b>$1</b>").replace(/`(.+?)`/g,"<code>$1</code>").replace(/_(.+?)_/g,"<i>$1</i>")}</p>\n`;
  }
  return html;
}
function downloadJSONRaw(text, name, mime) {
  const a = Object.assign(document.createElement("a"), {
    href: URL.createObjectURL(new Blob([text], { type: (mime||"text/plain") + ";charset=utf-8" })), download: name });
  document.body.appendChild(a); a.click(); a.remove();
}

/* ═══════════════════════════════════════════════════
   ログブック内 検索
════════════════════════════════════════════════════ */
function renderLbSearch() {
  const main = document.getElementById("main");
  const q = document.getElementById("searchInput").value.trim().toLowerCase();
  if (!q) { searchMode = false; render(); return; }

  const hits = [];
  data.machines.forEach(m => {
    m.attempts.forEach(a => {
      a.steps.forEach((s, idx) => {
        const hay = `${s.command} ${s.note} ${s.learning} ${lbPhaseLabel(s.phase)} ${m.name}`.toLowerCase();
        if (hay.includes(q)) hits.push({ m, a, s });
      });
    });
  });

  const rows = hits.map(({m,a,s}) => {
    const color = lbPhaseColor(s.phase);
    return `
      <div class="lb-search-hit" onclick="lbOpenMachine('${m.id}')">
        <div class="lb-hit-meta">
          <span class="lb-hit-machine">${esc(m.name)}</span>
          <span class="lb-hit-attempt">${esc(a.label)}</span>
          <span class="lb-ph-badge" style="background:${color}22;color:${color}">${esc(lbPhaseLabel(s.phase))}</span>
        </div>
        ${s.command?`<div class="lb-cmd" style="cursor:pointer"><span class="lb-prompt">$ </span>${lbHi(s.command,q)}</div>`:""}
        ${s.note?`<div class="lb-note">→ ${lbHi(s.note,q)}</div>`:""}
        ${s.learning?`<div class="lb-learn"><b>learn</b> ${lbHi(s.learning,q)}</div>`:""}
      </div>`;
  }).join("");

  main.innerHTML = `
    <div class="lb-head"><h1>検索結果</h1><span class="lb-count">「${esc(q)}」· ${hits.length} 件</span></div>
    ${hits.length ? `<div class="lb-search-list">${rows}</div>` : emptyState("search_off","一致するログがありません","別のキーワードをお試しください")}`;
}
function lbHi(text, q) {
  const e = esc(text); if (!q) return e;
  const lower = text.toLowerCase(); let out = "", i = 0;
  while (i < text.length) {
    const idx = lower.indexOf(q, i);
    if (idx < 0) { out += esc(text.slice(i)); break; }
    out += esc(text.slice(i, idx)) + `<mark>${esc(text.slice(idx, idx+q.length))}</mark>`;
    i = idx + q.length;
  }
  return out;
}