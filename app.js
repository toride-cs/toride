/* ═══════════════════════════════════════════════════════
   TORIDE Cheat Sheet — app.js  (Material Design 3 rework)
   Data model: { tabs: [ { id, label, title, subtitle, category, blocks[] } ] }
   Block model: { id, label, tags[], headers[], rows[][] }

   View model (client-only, not persisted):
     view = 'home'   → category cards
     view = 'cat'    → sheet cards within a category  (activeCat)
     view = 'tab'    → blocks of a single sheet        (activeId)
     view = 'search' → cross-scope results
════════════════════════════════════════════════════════ */

/* ── STATE ─────────────────────────────────────────── */
let data       = { tabs: [], machines: [], phases: [], hunts: [], queries: [], targets: [], payloads: [], vulnTypes: [], tools: [], knowledge: [] };
let appMode    = "cheatsheet";  // ... | "tools" | "knowledge"
let activeId   = null;          // current sheet (tab) id
let activeCat  = null;          // current category
let view       = "home";        // home | cat | tab | search
let editMode   = false;
let modalCb    = null;
let activeTag  = null;          // tag filter within a sheet
let searchMode = false;

/* logbook state */
let lbView       = "machines";  // machines | machine
let lbMachineId  = null;        // 開いているマシン
let lbAttemptId  = null;        // 開いている試行
let lbPhaseFilter= null;        // フェーズ絞り込み (null=すべて)
let lbFilter     = "all";       // machines一覧のフィルタ

/* threat-hunting state */
let huntView     = "list";      // list | hunt
let huntId       = null;        // 開いているハント
let huntStageFilter = null;     // 所見フィルタ (null=すべて)
let huntFilter   = "all";       // ハント一覧のフィルタ
let queryFilter  = "all";       // クエリ一覧の言語/Techフィルタ
let queryLangFilter = null;     // クエリ言語フィルタ
let queryTechFilter = null;     // Technique フィルタ

/* web (OSWA) state */
let webView       = "targets";  // targets | target
let webTargetId   = null;       // 開いているターゲット
let webVtFilter   = null;       // ターゲット詳細の脆弱性タイプ絞り込み
let webFilter     = "all";      // ターゲット一覧のフィルタ
let payloadVtFilter = null;     // ペイロード一覧の脆弱性タイプ絞り込み
let webInputVt    = null;       // ワンライン入力の選択中タイプ

/* tools state */
let toolsView     = "list";     // list | tool
let toolId        = null;       // 開いているツール
let toolCertFilter = "all";     // 資格タブ（メイン軸）
let toolCatFilter = null;       // カテゴリ絞り込み

/* knowledge state */
let knowView      = "list";     // list | detail
let knowDetailId  = null;       // 詳細表示中のナレッジ
let knowCertFilter = "all";
let knowCatFilter = null;
let knowKindFilter = null;

/* category presentation metadata (order + icon + description) */
const CAT_META = {
  "GNFA":  { icon: "🌐", desc: "Network Forensic Analyst" },
  "GDAT":  { icon: "🛡️", desc: "Detection & Response Analyst" },
  "GCFA":  { icon: "🔬", desc: "Forensic Analyst" },
  "OSDA":  { icon: "🔴", desc: "Offensive Security Defense Analyst" },
  "汎用":  { icon: "🧰", desc: "共通リファレンス" },
  "未分類":{ icon: "📥", desc: "あとで振り分け" },
};
const CAT_ORDER = ["GNFA","GDAT","GCFA","OSDA","汎用","未分類"];

/* ── BOOT ───────────────────────────────────────────── */
let loadedSnapshot = null;   // 読み込んだ時点のdata.json文字列（保存前の競合検出用）
let dataSource = "unknown";  // "github" | "bundled" | "preloaded" | "empty"

const DEFAULT_PHASES = [
  { id: "recon",    label: "recon",    color: "#5aa9e0" },
  { id: "enum",     label: "enum",     color: "#b085e0" },
  { id: "foothold", label: "foothold", color: "#e0a944" },
  { id: "privesc",  label: "privesc",  color: "#e05c5c" },
  { id: "loot",     label: "loot",     color: "#3fd07f" },
];

/* threat-hunting constants */
const HUNT_STAGES = [
  { id: "prepare", label: "Prepare", jp: "準備" },
  { id: "execute", label: "Execute", jp: "実行" },
  { id: "act",     label: "Act",     jp: "対応" },
];
const QUERY_LANGS = ["KQL", "ES|QL", "SPL", "Sigma", "YARA", "VQL"];
const HUNT_VERDICTS = [
  { id: "malicious",    label: "malicious",    color: "#e05c5c" },
  { id: "suspicious",   label: "suspicious",   color: "#e0a944" },
  { id: "benign",       label: "benign",       color: "#3fd07f" },
  { id: "inconclusive", label: "inconclusive", color: "#7d9186" },
];
const HUNT_STATUS = {
  plan:     { label: "計画",       color: "#7d9186", cls: "plan" },
  running:  { label: "進行中",     color: "#e0a944", cls: "running" },
  detected: { label: "検知あり",   color: "#e05c5c", cls: "detected" },
  clear:    { label: "未検知",     color: "#3fd07f", cls: "clear" },
  followup: { label: "要追加調査", color: "#5aa9e0", cls: "followup" },
};

/* web (OSWA) constants */
const DEFAULT_VULN_TYPES = [
  { id: "xss",   label: "XSS",                    color: "#e08a4d" },
  { id: "sqli",  label: "SQLi",                   color: "#e05c5c" },
  { id: "ssrf",  label: "SSRF",                   color: "#5aa9e0" },
  { id: "lfi",   label: "LFI / Path Traversal",   color: "#b085e0" },
  { id: "rce",   label: "RCE / Command Injection",color: "#e06a9c" },
  { id: "ssti",  label: "SSTI",                   color: "#45c8b0" },
  { id: "xxe",   label: "XXE",                    color: "#e0a944" },
  { id: "idor",  label: "IDOR",                   color: "#3fd07f" },
  { id: "auth",  label: "認証バイパス",            color: "#7d9186" },
  { id: "upload",label: "ファイルアップロード",     color: "#c9a15a" },
];
const WEB_STATUS = {
  todo:      { label: "未着手",   color: "#7d9186", cls: "todo" },
  probing:   { label: "調査中",   color: "#5aa9e0", cls: "probing" },
  exploited: { label: "exploited",color: "#e0a944", cls: "exploited" },
  proof:     { label: "proof取得", color: "#3fd07f", cls: "proof" },
};
const WEB_VERDICTS = [
  { id: "confirmed", label: "confirmed", color: "#3fd07f" },
  { id: "testing",   label: "testing",   color: "#e0a944" },
];

/* tools constants */
const TOOL_PRIORITY = {
  must: { label: "必須",     color: "#e05c5c", cls: "must" },
  rec:  { label: "おすすめ", color: "#e0a944", cls: "rec" },
  opt:  { label: "便利",     color: "#7d9186", cls: "opt" },
};
const TOOL_CATEGORIES = ["recon", "web", "sqli", "fuzzing", "exploit", "enum", "privesc", "その他"];

/* knowledge constants */
const KNOW_KINDS = {
  cheatsheet: { label: "cheatsheet", color: "#45c8b0" },
  wordlist:   { label: "wordlist",   color: "#e0a944" },
  lab:        { label: "lab",        color: "#5aa9e0" },
  tool:       { label: "tool",       color: "#e08a4d" },
  doc:        { label: "doc",        color: "#7d9186" },
  writeup:    { label: "writeup",    color: "#b085e0" },
};
const KNOW_CATEGORIES = ["reference", "methodology", "recon", "web", "xss", "sqli", "ssti", "ssrf", "lfi", "xxe", "idor", "fuzzing", "wordlist", "lab", "その他"];

(async function init() {
  // theme
  const savedTheme = localStorage.getItem("cs-theme");
  if (savedTheme === "dark" || (!savedTheme && matchMedia("(prefers-color-scheme: dark)").matches)) {
    document.documentElement.setAttribute("data-theme", "dark");
  }
  syncThemeIcon();

  // exportHTML produces a standalone file that pre-loads data here
  if (window.__PRELOADED_DATA__) {
    data = window.__PRELOADED_DATA__;
    normalizeData();
    dataSource = "preloaded";
  } else {
    // ① まず GitHub の最新を試みる（/latest）。失敗したらバンドル版へフォールバック
    let loaded = false;
    try {
      const res = await fetch("/latest", { cache: "no-store" });
      if (res.ok) {
        data = await res.json();
        normalizeData();
        loadedSnapshot = JSON.stringify(data);
        dataSource = "github";
        loaded = true;
      }
    } catch (e) { /* fall through */ }

    if (!loaded) {
      try {
        const res = await fetch("data.json", { cache: "no-store" });
        if (!res.ok) throw new Error("fetch failed");
        data = await res.json();
        normalizeData();
        loadedSnapshot = JSON.stringify(data);
        dataSource = "bundled";
      } catch (e) {
        console.warn("data.json load failed, using empty data.", e);
        data = { tabs: [] };
        dataSource = "empty";
      }
    }
  }
  bindGlobalUI();
  goHome();
  if (dataSource === "bundled") {
    toast("⚠️ 最新データの取得に失敗。キャッシュ版を表示中です");
  }
})();

/* デフォルトのフェーズ定義（ユーザーが編集可能） */

function normalizeData() {
  // ── チートシート（既存・無変更） ──
  (data.tabs || []).forEach(t => {
    t.id = t.id || uid();
    t.category = t.category || "未分類";
    (t.blocks || []).forEach(b => { b.id = b.id || uid(); b.tags = b.tags || []; });
  });
  if (!Array.isArray(data.tabs)) data.tabs = [];

  // ── ログブック（新規・後方互換） ──
  if (!Array.isArray(data.phases) || !data.phases.length) {
    data.phases = JSON.parse(JSON.stringify(DEFAULT_PHASES));
  }
  data.phases.forEach(p => { p.id = p.id || uid(); p.color = p.color || "#7d9186"; p.label = p.label || p.id; });

  if (!Array.isArray(data.machines)) data.machines = [];
  data.machines.forEach(m => {
    m.id = m.id || uid();
    m.name = m.name || "無名マシン";
    m.platform = m.platform || "";
    m.ip = m.ip || "";
    m.os = m.os || "";
    m.difficulty = m.difficulty ?? 1;
    m.tags = m.tags || [];
    if (!Array.isArray(m.attempts) || !m.attempts.length) {
      // 旧形式（stepsを直接持つ）からの移行 or 新規
      m.attempts = [{
        id: uid(), label: "1回目", status: m.status || "進行中",
        started_at: m.started_at || Date.now(), rooted_at: null,
        steps: m.steps || [], creds: m.creds || [], loot: m.loot || [],
      }];
    }
    m.attempts.forEach(a => {
      a.id = a.id || uid();
      a.label = a.label || "挑戦";
      a.status = a.status || "進行中";
      a.steps = a.steps || [];
      a.creds = a.creds || [];
      a.loot = a.loot || [];
      a.steps.forEach(s => {
        s.id = s.id || uid();
        s.phase = s.phase || "";       // 空 = 未分類
        s.command = s.command || "";
        s.note = s.note || "";
        s.learning = s.learning || "";
        s.ts = s.ts || Date.now();
      });
    });
  });

  // ── スレットハンティング（新規・後方互換） ──
  if (!Array.isArray(data.hunts)) data.hunts = [];
  data.hunts.forEach(h => {
    h.id = h.id || uid();
    h.title = h.title || "無題のハント";
    h.hypothesis = h.hypothesis || "";
    h.techniques = Array.isArray(h.techniques) ? h.techniques : [];
    h.dataSources = Array.isArray(h.dataSources) ? h.dataSources : [];
    h.environment = h.environment || "";      // 実務 / ラボ
    h.status = h.status || "plan";            // plan|running|detected|clear|followup
    h.stage = h.stage || "prepare";           // prepare|execute|act
    h.conclusion = h.conclusion || "";
    h.followup = h.followup || "";
    h.started_at = h.started_at || Date.now();
    h.steps = Array.isArray(h.steps) ? h.steps : [];
    h.steps.forEach(s => {
      s.id = s.id || uid();
      s.query = s.query || "";
      s.lang = s.lang || "KQL";
      s.finding = s.finding || "";
      s.verdict = s.verdict || "inconclusive"; // malicious|suspicious|benign|inconclusive
      s.ts = s.ts || Date.now();
    });
  });

  if (!Array.isArray(data.queries)) data.queries = [];
  data.queries.forEach(q => {
    q.id = q.id || uid();
    q.title = q.title || "無題のクエリ";
    q.lang = q.lang || "KQL";                 // KQL|ES|QL|SPL|Sigma|YARA
    q.body = q.body || "";
    q.techniques = Array.isArray(q.techniques) ? q.techniques : [];
    q.dataSource = q.dataSource || "";
    q.platform = q.platform || "";
    q.falsePositives = q.falsePositives || "";
    q.reference = q.reference || "";
    q.ts = q.ts || Date.now();
  });

  // ── Web / OSWA（新規・後方互換） ──
  if (!Array.isArray(data.vulnTypes) || !data.vulnTypes.length) {
    data.vulnTypes = JSON.parse(JSON.stringify(DEFAULT_VULN_TYPES));
  }
  data.vulnTypes.forEach(v => { v.id = v.id || uid(); v.color = v.color || "#7d9186"; v.label = v.label || v.id; });

  if (!Array.isArray(data.targets)) data.targets = [];
  data.targets.forEach(t => {
    t.id = t.id || uid();
    t.name = t.name || "無名ターゲット";
    t.url = t.url || "";
    t.techStack = Array.isArray(t.techStack) ? t.techStack : [];
    t.status = t.status || "todo";        // todo|probing|exploited|proof
    t.category = t.category || "OSWA試験";  // OSWA試験 / 練習 など
    t.localTxt = t.localTxt || "";
    t.proofTxt = t.proofTxt || "";
    t.notes = t.notes || "";
    t.findings = Array.isArray(t.findings) ? t.findings : [];
    t.findings.forEach(f => {
      f.id = f.id || uid();
      f.vulnType = f.vulnType || "";       // vulnTypes の id
      f.endpoint = f.endpoint || "";
      f.request = f.request || "";         // 生HTTPリクエスト
      f.payload = f.payload || "";
      f.note = f.note || "";
      f.steps = Array.isArray(f.steps) ? f.steps : [];
      f.impact = f.impact || "";
      f.verdict = f.verdict || "testing";  // confirmed|testing
      f.ts = f.ts || Date.now();
    });
  });

  if (!Array.isArray(data.payloads)) data.payloads = [];
  data.payloads.forEach(p => {
    p.id = p.id || uid();
    p.title = p.title || "無題のペイロード";
    p.vulnType = p.vulnType || "";
    p.body = p.body || "";
    p.context = p.context || "";
    p.bypass = p.bypass || "";
    p.reference = p.reference || "";
    p.ts = p.ts || Date.now();
  });

  // ── ツール・リファレンス（新規・後方互換） ──
  if (!Array.isArray(data.tools)) data.tools = [];
  data.tools.forEach(t => {
    t.id = t.id || uid();
    t.name = t.name || "無名ツール";
    t.certs = Array.isArray(t.certs) ? t.certs : [];   // ["OSWA","OSCP"]
    t.category = t.category || "その他";
    t.priority = t.priority || "opt";                   // must|rec|opt
    t.summary = t.summary || "";
    t.commands = Array.isArray(t.commands) ? t.commands : [];
    t.commands.forEach(c => { c.id = c.id || uid(); c.label = c.label || ""; c.cmd = c.cmd || ""; c.note = c.note || ""; });
    t.tips = t.tips || "";
    t.reference = Array.isArray(t.reference) ? t.reference : [];
    t.reference.forEach(r => { r.label = r.label || r.url || ""; r.url = r.url || ""; });
    t.ts = t.ts || Date.now();
  });

  // ── ナレッジ・リンク集（新規・後方互換） ──
  if (!Array.isArray(data.knowledge)) data.knowledge = [];
  data.knowledge.forEach(k => {
    k.id = k.id || uid();
    k.title = k.title || "無題";
    k.url = k.url || "";
    k.certs = Array.isArray(k.certs) ? k.certs : [];
    k.category = k.category || "reference";
    k.kind = k.kind || "doc";
    k.desc = k.desc || "";
    k.detail = k.detail || null;   // { overview, keyPoints[], usage[{label,content}], oswaTips, lastCurated }
    k.ts = k.ts || Date.now();
  });
}

/* categories present in data, ordered */
function categories() {
  const set = new Set(data.tabs.map(t => t.category || "未分類"));
  const ordered = CAT_ORDER.filter(c => set.has(c));
  // any unknown categories appended
  [...set].forEach(c => { if (!ordered.includes(c)) ordered.push(c); });
  return ordered;
}
function tabsInCat(cat) { return data.tabs.filter(t => (t.category||"未分類") === cat); }
function catMeta(cat) { return CAT_META[cat] || { icon: "📁", desc: "" }; }

/* ═══════════════════════════════════════════════════
   NAVIGATION
════════════════════════════════════════════════════ */
function goHome() {
  view = "home"; activeCat = null; activeId = null;
  searchMode = false; activeTag = null;
  clearSearchInput();
  render();
}
function openCategory(cat) {
  view = "cat"; activeCat = cat; activeId = null;
  searchMode = false; activeTag = null;
  clearSearchInput();
  render();
}
function switchTab(id) {
  const tab = data.tabs.find(t => t.id === id);
  if (!tab) return;
  view = "tab"; activeId = id; activeCat = tab.category || "未分類";
  searchMode = false; activeTag = null;
  clearSearchInput();
  render();
  document.getElementById("main").scrollTop = 0;
}
/* used by search result "go to" */
function gotoTab(id) { closeSidebar(); switchTab(id); }

/* ═══════════════════════════════════════════════════
   RENDER — top level
════════════════════════════════════════════════════ */
function render() {
  syncModeUI();
  if (appMode === "logbook") { renderLogbook(); return; }
  if (appMode === "hunt")    { renderHunt(); return; }
  if (appMode === "query")   { renderQueryLib(); return; }
  if (appMode === "coverage"){ renderCoverage(); return; }
  if (appMode === "web")     { renderWeb(); return; }
  if (appMode === "payload") { renderPayloadLib(); return; }
  if (appMode === "tools")   { renderTools(); return; }
  if (appMode === "knowledge") { renderKnowledge(); return; }
  renderNav();
  if (searchMode)       renderSearch();
  else if (view === "home") renderHome();
  else if (view === "cat")  renderCategory();
  else                  renderSheet();
}

/* モード切替 */
function setMode(mode) {
  if (appMode === mode) return;
  appMode = mode;
  searchMode = false;
  clearSearchInput();
  document.body.classList.toggle("mode-logbook", mode === "logbook");
  document.body.classList.toggle("mode-hunt", mode === "hunt");
  document.body.classList.toggle("mode-query", mode === "query");
  document.body.classList.toggle("mode-coverage", mode === "coverage");
  document.body.classList.toggle("mode-web", mode === "web");
  document.body.classList.toggle("mode-payload", mode === "payload");
  document.body.classList.toggle("mode-tools", mode === "tools");
  document.body.classList.toggle("mode-knowledge", mode === "knowledge");
  render();
  document.getElementById("main").scrollTop = 0;
  try { window.scrollTo(0, 0); } catch(e){}
}
function syncModeUI() {
  document.querySelectorAll("[data-mode]").forEach(btn => {
    btn.classList.toggle("on", btn.dataset.mode === appMode);
  });
  const si = document.getElementById("searchInput");
  if (si) {
    const ph = {
      logbook: "マシン・コマンド・技を検索…",
      hunt: "ハント・仮説・Technique を検索…",
      query: "クエリ・Technique・データソースを検索…",
      coverage: "",
      web: "ターゲット・脆弱性・URLを検索…",
      payload: "ペイロード・タイプ・用途を検索…",
      tools: "ツール・コマンドを検索…",
      knowledge: "ナレッジ・URL・タグを検索…",
      cheatsheet: "コマンド・フィールド・コードを検索…"
    };
    si.placeholder = ph[appMode] ?? ph.cheatsheet;
  }
}

/* ── SIDEBAR NAV ── */
function renderNav() {
  const nav = document.getElementById("navList");
  let html = `
    <button class="nav-item ${view==='home'?'active':''}" onclick="goHome()">
      <span class="material-symbols-rounded nav-icon">home</span>
      <span class="nav-label">ホーム</span>
      <span class="nav-count">${data.tabs.length}</span>
    </button>`;
  categories().forEach(cat => {
    const m = catMeta(cat);
    const n = tabsInCat(cat).length;
    const on = (activeCat === cat) && !searchMode;
    html += `
      <button class="nav-item ${on?'active':''}" onclick="openCategory('${escAttr(cat)}')">
        <span class="nav-emoji">${m.icon}</span>
        <span class="nav-label">${esc(cat)}</span>
        <span class="nav-count">${n}</span>
      </button>`;
  });
  nav.innerHTML = html;
}

/* ── HOME: category cards ── */
function renderHome() {
  const main = document.getElementById("main");
  const cats = categories();
  let cards = cats.map(cat => {
    const m = catMeta(cat);
    const list = tabsInCat(cat);
    const blocks = list.reduce((s,t)=>s+(t.blocks?.length||0),0);
    return `
      <button class="cat-card" onclick="openCategory('${escAttr(cat)}')">
        <div class="cat-card-head">
          <div class="cat-badge">${m.icon}</div>
          <div>
            <div class="cat-card-title">${esc(cat)}</div>
            <div class="cat-card-desc">${esc(m.desc)}</div>
          </div>
        </div>
        <div class="cat-card-foot">
          <span>${list.length} シート · ${blocks} 表</span>
          <span class="material-symbols-rounded arrow">arrow_forward</span>
        </div>
      </button>`;
  }).join("");

  main.innerHTML = `
    ${editBanner()}
    <div class="page-head">
      <div class="page-title">チートシート</div>
      <div class="page-sub">資格・ジャンルごとに整理されたチートシート集。上部の検索は全体を横断します。</div>
    </div>
    <div class="card-grid">${cards}</div>
    ${editMode ? `<div style="margin-top:24px"><button class="btn btn-tonal" onclick="addTab()"><span class="material-symbols-rounded">add</span>新しいシートを追加</button></div>` : ""}
  `;
}

/* ── CATEGORY: sheet cards ── */
function renderCategory() {
  const main = document.getElementById("main");
  const m = catMeta(activeCat);
  const list = tabsInCat(activeCat);

  const cards = list.map(t => {
    const rows = (t.blocks||[]).reduce((s,b)=>s+(b.rows?.length||0),0);
    const tags = [...new Set((t.blocks||[]).flatMap(b=>b.tags||[]))].slice(0,4);
    const emoji = leadingEmoji(t.label) || m.icon;
    const name = stripEmoji(t.label);
    return `
      <button class="sheet-card" onclick="switchTab('${t.id}')">
        <div class="sheet-card-head">
          <span class="sheet-emoji">${emoji}</span>
          <div>
            <div class="sheet-card-title">${esc(name)}</div>
            <div class="sheet-card-meta">${t.blocks?.length||0} 表 · ${rows} 行</div>
          </div>
        </div>
        ${tags.length ? `<div class="sheet-card-tags">${tags.map(tg=>`<span class="mini-tag">#${esc(tg)}</span>`).join("")}</div>` : ""}
      </button>`;
  }).join("");

  main.innerHTML = `
    ${editBanner()}
    <div class="page-head">
      ${breadcrumb([{label:"ホーム",fn:"goHome()"}], activeCat)}
      <div class="page-title"><span>${m.icon}</span>${esc(activeCat)}</div>
      <div class="page-sub">${esc(m.desc)} · ${list.length} シート</div>
    </div>
    ${list.length ? `<div class="card-grid">${cards}</div>`
      : emptyState("folder_open","このカテゴリは空です","編集モードでシートを追加できます")}
    ${editMode ? `<div style="margin-top:24px"><button class="btn btn-tonal" onclick="addTab('${escAttr(activeCat)}')"><span class="material-symbols-rounded">add</span>このカテゴリにシートを追加</button></div>` : ""}
  `;
}

/* ── SHEET: blocks/tables ── */
function renderSheet() {
  const main = document.getElementById("main");
  const tab = data.tabs.find(t => t.id === activeId);
  if (!tab) { goHome(); return; }

  const m = catMeta(tab.category);
  const allTags = collectTags(tab);
  const tagBar = allTags.length ? `
    <div class="chip-row">
      ${allTags.map(t=>`
        <button class="chip ${activeTag===t?'active':''}" onclick="filterTag('${escAttr(t)}')">
          ${activeTag===t?'<span class="material-symbols-rounded">check</span>':''}#${esc(t)}
        </button>`).join("")}
      ${activeTag?`<button class="chip" onclick="filterTag(null)"><span class="material-symbols-rounded">close</span>クリア</button>`:""}
    </div>` : "";

  let blocksHtml = "";
  (tab.blocks||[]).forEach((blk, bi) => {
    if (activeTag && !(blk.tags||[]).includes(activeTag)) return;
    blocksHtml += renderBlock(tab, blk, bi);
  });
  if (!(tab.blocks||[]).length) {
    blocksHtml = emptyState("table_chart","表がありません","編集モードで「表を追加」してください");
  }

  main.innerHTML = `
    ${editBanner()}
    <div class="page-head">
      ${breadcrumb([{label:"ホーム",fn:"goHome()"},{label:tab.category,fn:`openCategory('${escAttr(tab.category)}')`}], stripEmoji(tab.label))}
      <div class="page-title">
        <span class="editable" data-field="title">${esc(tab.title||stripEmoji(tab.label))}</span>
      </div>
      <div class="page-sub editable" data-field="subtitle">${esc(tab.subtitle||"")}</div>
    </div>
    <div class="section-actions">
      <button class="btn btn-tonal" onclick="switchTab('${activeId}');" style="pointer-events:none;opacity:.0;width:0;padding:0;margin:0"></button>
      ${editMode ? `
        <button class="btn btn-outlined" onclick="openImport()"><span class="material-symbols-rounded">upload_file</span>インポート</button>
        <button class="btn btn-filled" onclick="addBlock()"><span class="material-symbols-rounded">add</span>表を追加</button>
        <button class="btn btn-text" onclick="changeTabCategory('${activeId}')"><span class="material-symbols-rounded">drive_file_move</span>カテゴリ変更</button>
      ` : ""}
    </div>
    ${tagBar}
    ${blocksHtml}
  `;
  bindEditableHandlers();
}

function renderBlock(tab, blk, bi) {
  const noWrap = (ci) => Array.isArray(blk.colWrap) && blk.colWrap[ci] === false;

  const thCols = blk.headers.map((h, hi) =>
    `<th class="editable ${noWrap(hi)?'nowrap-col':''}" data-bi="${bi}" data-hi="${hi}">${esc(h)}</th>`).join("");

  const tbRows = blk.rows.map((row, ri) => {
    const cells = blk.headers.map((_, ci) => {
      const raw = row[ci] ?? "";
      const copyBtn = String(raw).trim() ? `<button class="copy-btn" data-copy="${esc(raw)}" onclick="copyCell(event, this.dataset.copy)" title="コピー">
          <span class="material-symbols-rounded">content_copy</span>
        </button>` : "";
      return `<td class="editable md-cell ${noWrap(ci)?'nowrap-col':''}" data-bi="${bi}" data-ri="${ri}" data-ci="${ci}">
        <div class="md-content">${renderMd(raw)}</div>
        ${copyBtn}
      </td>`;
    }).join("");
    return `<tr data-bi="${bi}" data-ri="${ri}">
      ${cells}
      <td class="row-act edit-only">
        <div class="row-btns">
          <button class="rbtn" onclick="moveRow(${bi},${ri},-1)" title="上へ"><span class="material-symbols-rounded">arrow_upward</span></button>
          <button class="rbtn" onclick="moveRow(${bi},${ri},1)" title="下へ"><span class="material-symbols-rounded">arrow_downward</span></button>
          <button class="rbtn rbtn-del" onclick="delRow(${bi},${ri})" title="削除"><span class="material-symbols-rounded">delete</span></button>
        </div>
      </td>
    </tr>`;
  }).join("");

  const blkTags = (blk.tags||[]).map(t =>
    `<span class="blk-tag" onclick="filterTag('${escAttr(t)}')">#${esc(t)}</span>`).join("");

  return `
    <div class="block" data-bi="${bi}">
      <div class="block-head">
        <div class="block-label editable" data-bi="${bi}" data-field="label">${esc(blk.label)}</div>
        ${blkTags ? `<div class="blk-tags">${blkTags}</div>` : ""}
        <div class="block-actions">
          <button class="blk-menu-btn" onclick="toggleBlockMenu(event,${bi})" title="メニュー"><span class="material-symbols-rounded">more_vert</span></button>
          <div class="blk-menu" id="blkmenu-${bi}">
            <button onclick="exportBlock(${bi})"><span class="material-symbols-rounded">download</span>JSONエクスポート</button>
            <button onclick="duplicateBlock(${bi})"><span class="material-symbols-rounded">content_copy</span>複製</button>
            <button onclick="moveBlockToTab(${bi})"><span class="material-symbols-rounded">drive_file_move</span>別シートへ移動</button>
            <button onclick="editColWrap(${bi})"><span class="material-symbols-rounded">wrap_text</span>列の折り返し設定</button>
            <button class="edit-only-mi" onclick="moveBlock(${bi},-1)"><span class="material-symbols-rounded">arrow_upward</span>上へ移動</button>
            <button class="edit-only-mi" onclick="moveBlock(${bi},1)"><span class="material-symbols-rounded">arrow_downward</span>下へ移動</button>
            <button class="edit-only-mi" onclick="editBlockTags(${bi})"><span class="material-symbols-rounded">sell</span>タグ編集</button>
            <button class="edit-only-mi" onclick="addColumn(${bi})"><span class="material-symbols-rounded">add</span>列を追加</button>
            <button class="edit-only-mi" onclick="delColumn(${bi})"><span class="material-symbols-rounded">remove</span>列を削除</button>
            <button class="edit-only-mi danger-mi" onclick="delBlock(${bi})"><span class="material-symbols-rounded">delete</span>削除</button>
          </div>
        </div>
      </div>
      <div class="tbl-wrap">
        <table>
          <thead><tr>${thCols}<th class="edit-only" style="width:60px"></th></tr></thead>
          <tbody>${tbRows}</tbody>
        </table>
      </div>
      <button class="add-row-btn" onclick="addRow(${bi})"><span class="material-symbols-rounded">add</span>行を追加</button>
    </div>`;
}

/* ── EDITABLE HANDLERS ── */
function bindEditableHandlers() {
  const tab = data.tabs.find(t => t.id === activeId);
  if (!tab) return;
  document.querySelectorAll(".editable").forEach(node => {
    node.addEventListener("click", () => {
      if (!editMode) return;
      if (node.dataset.field === "title") {
        openModal("タイトルを編集", inputField("mVal", tab.title),
          () => { tab.title = val("mVal"); renderSheet(); }); return;
      }
      if (node.dataset.field === "subtitle") {
        openModal("サブタイトルを編集", inputField("mVal", tab.subtitle),
          () => { tab.subtitle = val("mVal"); renderSheet(); }); return;
      }
      if (node.dataset.field === "label") {
        const bi = +node.dataset.bi;
        openModal("表のタイトルを編集", inputField("mVal", tab.blocks[bi].label),
          () => { tab.blocks[bi].label = val("mVal"); renderSheet(); }); return;
      }
      if (node.dataset.hi !== undefined) {
        const bi = +node.dataset.bi, hi = +node.dataset.hi;
        openModal("見出しを編集", inputField("mVal", tab.blocks[bi].headers[hi]),
          () => { tab.blocks[bi].headers[hi] = val("mVal"); renderSheet(); }); return;
      }
      if (node.dataset.ci !== undefined) {
        const bi = +node.dataset.bi, ri = +node.dataset.ri, ci = +node.dataset.ci;
        const current = tab.blocks[bi].rows[ri][ci] ?? "";
        openModal(`セルを編集 — ${esc(tab.blocks[bi].headers[ci])}`,
          `<label>内容（Markdownが使えます）</label>
           <textarea id="mVal">${esc(current)}</textarea>
           <div class="modal-hint">\`code\` **bold** *italic* # 見出し [link](url) \`\`\`コードブロック\`\`\`</div>`,
          () => { tab.blocks[bi].rows[ri][ci] = val("mVal"); renderSheet(); });
      }
    });
  });
}

/* ═══════════════════════════════════════════════════
   SEARCH  (always global; results grouped by category→sheet)
════════════════════════════════════════════════════ */
function bindGlobalUI() {
  const si = document.getElementById("searchInput");
  si.addEventListener("input", function () {
    const q = this.value.trim();
    document.getElementById("searchClear").classList.toggle("show", q.length>0);
    if (!q) { searchMode = false; render(); return; }
    searchMode = true;
    if (appMode === "logbook") { renderLbSearch(); return; }
    if (appMode === "hunt")    { renderHuntSearch(); return; }
    if (appMode === "query")   { renderQuerySearch(); return; }
    if (appMode === "coverage"){ searchMode = false; return; }
    if (appMode === "web")     { renderWebSearch(); return; }
    if (appMode === "payload") { renderPayloadSearch(); return; }
    if (appMode === "tools")   { renderToolsSearch(); return; }
    if (appMode === "knowledge") { renderKnowledgeSearch(); return; }
    renderNav(); renderSearch();
  });
  document.getElementById("searchClear").onclick = () => { clearSearchInput(); searchMode=false; render(); si.focus(); };

  document.getElementById("brandHome").onclick = () => {
    if (appMode === "logbook") { lbView="machines"; lbMachineId=null; searchMode=false; clearSearchInput(); render(); }
    else if (appMode === "hunt") { huntView="list"; huntId=null; searchMode=false; clearSearchInput(); render(); }
    else if (appMode === "query") { searchMode=false; clearSearchInput(); render(); }
    else if (appMode === "coverage") { render(); }
    else if (appMode === "web") { webView="targets"; webTargetId=null; searchMode=false; clearSearchInput(); render(); }
    else if (appMode === "payload") { searchMode=false; clearSearchInput(); render(); }
    else if (appMode === "tools") { toolsView="list"; toolId=null; searchMode=false; clearSearchInput(); render(); }
    else if (appMode === "knowledge") { knowView="list"; knowDetailId=null; searchMode=false; clearSearchInput(); render(); }
    else goHome();
  };
  document.getElementById("brandHome").onkeydown = e => { if(e.key==="Enter"||e.key===" "){ e.preventDefault(); document.getElementById("brandHome").onclick(); } };

  document.getElementById("themeToggle").onclick = toggleTheme;
  document.getElementById("editToggle").onclick = toggleEdit;
  document.getElementById("saveBtn").onclick = saveToGitHub;

  document.getElementById("menuToggle").onclick = openSidebar;
  document.getElementById("sidebarScrim").onclick = closeSidebar;
  document.getElementById("importFile").addEventListener("change", onImportFile);

  // モード切替ボタン
  document.querySelectorAll("[data-mode]").forEach(btn => {
    btn.addEventListener("click", () => setMode(btn.dataset.mode));
  });

  // header shadow on scroll
  const main = document.getElementById("main");
  window.addEventListener("scroll", () => {
    document.getElementById("appHeader").classList.toggle("scrolled", window.scrollY>4);
  });
}

function renderSearch() {
  const main = document.getElementById("main");
  const q = document.getElementById("searchInput").value.trim().toLowerCase();
  if (!q) { searchMode = false; render(); return; }

  let groups = "";
  let totalHits = 0, sheetHits = 0;
  data.tabs.forEach(tab => {
    (tab.blocks||[]).forEach(blk => {
      const matchRows = blk.rows.filter(row =>
        row.some(c => (c||"").toLowerCase().includes(q)) ||
        (blk.label||"").toLowerCase().includes(q)
      );
      if (!matchRows.length) return;
      totalHits += matchRows.length; sheetHits++;

      const thCols = blk.headers.map(h => `<th>${esc(h)}</th>`).join("");
      const tbRows = matchRows.map(row => {
        const cells = blk.headers.map((_, ci) => {
          const raw = row[ci] ?? "";
          const copyBtn = String(raw).trim() ? `<button class="copy-btn" data-copy="${esc(raw)}" onclick="copyCell(event, this.dataset.copy)" title="コピー"><span class="material-symbols-rounded">content_copy</span></button>` : "";
          return `<td class="md-cell">
            <div class="md-content">${highlightMd(raw, q)}</div>
            ${copyBtn}
          </td>`;
        }).join("");
        return `<tr>${cells}</tr>`;
      }).join("");

      const m = catMeta(tab.category);
      groups += `
        <div class="result-group">
          <div class="result-meta">
            <span class="rm-cat">${m.icon} ${esc(tab.category)}</span>
            <span class="material-symbols-rounded">chevron_right</span>
            <span class="rm-tab">${esc(stripEmoji(tab.label))}</span>
            <span class="material-symbols-rounded">chevron_right</span>
            <span class="rm-block">${esc(blk.label)}</span>
            <button class="btn btn-text result-goto" onclick="gotoTab('${tab.id}')"><span class="material-symbols-rounded">open_in_new</span>開く</button>
          </div>
          <div class="tbl-wrap"><table><thead><tr>${thCols}</tr></thead><tbody>${tbRows}</tbody></table></div>
        </div>`;
    });
  });

  main.innerHTML = `
    <div class="page-head">
      <div class="page-title"><span class="material-symbols-rounded" style="font-size:26px">search</span>検索結果</div>
    </div>
    <div class="search-scope-bar">
      <span class="material-symbols-rounded">travel_explore</span>
      <span>「<span class="search-stat">${esc(q)}</span>」を全カテゴリから検索</span>
      <span style="margin-left:auto">${totalHits} 件 / ${sheetHits} 表</span>
    </div>
    ${totalHits ? groups : emptyState("search_off","一致する結果がありません","別のキーワードをお試しください")}
  `;
}

function clearSearchInput() {
  const si = document.getElementById("searchInput");
  if (si) si.value = "";
  const sc = document.getElementById("searchClear");
  if (sc) sc.classList.remove("show");
}

/* ═══════════════════════════════════════════════════
   TAG FILTER
════════════════════════════════════════════════════ */
function filterTag(tag) { activeTag = tag; searchMode = false; renderSheet(); renderNav(); }
function collectTags(tab) {
  const set = new Set();
  (tab.blocks||[]).forEach(b => (b.tags||[]).forEach(t => set.add(t)));
  return [...set];
}
function editBlockTags(bi) {
  const blk = curTab().blocks[bi];
  openModal("タグを編集",
    `<label>タグ（スペース区切り、# 不要）</label>
     <input id="mVal" value="${esc((blk.tags||[]).join(" "))}" placeholder="例: linux forensics">`,
    () => { blk.tags = val("mVal").split(/\s+/).map(s=>s.replace(/^#/,"").trim()).filter(Boolean); renderSheet(); });
}

function editColWrap(bi) {
  const blk = curTab().blocks[bi];
  // 既定は全列「折り返す」(true)
  if (!Array.isArray(blk.colWrap) || blk.colWrap.length !== blk.headers.length) {
    blk.colWrap = blk.headers.map((_, i) => (blk.colWrap && blk.colWrap[i] === false) ? false : true);
  }
  const rows = blk.headers.map((h, i) => `
    <label class="wrap-toggle">
      <span class="wrap-col-name">${esc(h)}</span>
      <span class="wrap-switch">
        <input type="checkbox" id="mW${i}" ${blk.colWrap[i] !== false ? "checked" : ""}>
        <span class="wrap-switch-label">折り返す</span>
      </span>
    </label>`).join("");
  openModal("列の折り返し設定",
    `<div class="modal-hint" style="margin-bottom:8px">オフにした列は改行されず、長い場合はセル内で横スクロールします（縦書き化を防ぎます）。</div>
     <div class="wrap-list">${rows}</div>`,
    () => {
      blk.colWrap = blk.headers.map((_, i) => document.getElementById(`mW${i}`)?.checked !== false);
      renderSheet(); toast("✅ 折り返し設定を更新しました");
    });
}

/* ═══════════════════════════════════════════════════
   MARKDOWN RENDER (code-safe: stash code before styling)
════════════════════════════════════════════════════ */
function renderMd(raw) {
  if (!raw) return "";
  let s = esc(raw);
  const stash = [];
  const keep = (html) => `\u0000${stash.push(html) - 1}\u0000`;
  s = s.replace(/```([^`]*?)```/gs, (_, code) =>
    keep(`<pre class="md-code">${code.replace(/&lt;/g,"<").replace(/&gt;/g,">").replace(/&amp;/g,"&")}</pre>`));
  s = s.replace(/`([^`]+)`/g, (_, c) => keep(`<code class="md-inline">${c}</code>`));
  s = s.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  s = s.replace(/\*(.+?)\*/g, "<em>$1</em>");
  s = s.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, t, h) => `<a href="${esc(h)}" target="_blank" rel="noopener">${t}</a>`);
  s = s.replace(/^#{1,3} (.+)$/gm, (_, t) => `<strong class="md-heading">${t}</strong>`);
  s = s.replace(/^[-*] (.+)$/gm, (_, t) => `<span class="md-li">• ${t}</span>`);
  s = s.replace(/\n/g, "<br>");
  s = s.replace(/\u0000(\d+)\u0000/g, (_, i) => stash[i]);
  s = s.replace(/<\/pre><br>/g, "</pre>");
  return s;
}
/* render markdown then highlight query occurrences in visible text */
function highlightMd(raw, q) {
  const rendered = renderMd(raw);
  if (!q) return rendered;
  // highlight only outside of tags
  return rendered.replace(/>([^<]+)</g, (m, text) => {
    const lower = text.toLowerCase(); let out = "", i = 0;
    while (i < text.length) {
      const idx = lower.indexOf(q, i);
      if (idx < 0) { out += text.slice(i); break; }
      out += text.slice(i, idx) + `<mark>${text.slice(idx, idx+q.length)}</mark>`;
      i = idx + q.length;
    }
    return ">" + out + "<";
  });
}

/* ═══════════════════════════════════════════════════
   COPY
════════════════════════════════════════════════════ */
function copyCell(e, text) {
  e.stopPropagation();
  const btn = e.currentTarget;           // 同期のうちに参照を確保
  const showOk = () => {
    if (!btn) return;
    btn.classList.add("copied");
    btn.innerHTML = `<span class="material-symbols-rounded">check</span>`;
    setTimeout(() => {
      btn.classList.remove("copied");
      btn.innerHTML = `<span class="material-symbols-rounded">content_copy</span>`;
    }, 1200);
  };
  const showFail = () => toast("❌ コピーに失敗しました");

  // ① モダンな Clipboard API（HTTPS / localhost で有効）
  if (navigator.clipboard && window.isSecureContext) {
    navigator.clipboard.writeText(text).then(showOk).catch(() => {
      if (!legacyCopy(text)) showFail(); else showOk();
    });
    return;
  }
  // ② フォールバック（HTTP など非セキュアコンテキスト）
  if (legacyCopy(text)) showOk(); else showFail();
}

/* execCommand によるレガシーコピー。成功で true */
function legacyCopy(text) {
  try {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.cssText = "position:fixed;top:0;left:0;width:1px;height:1px;opacity:0;pointer-events:none;";
    document.body.appendChild(ta);
    ta.select();
    ta.setSelectionRange(0, ta.value.length);
    const ok = document.execCommand("copy");
    document.body.removeChild(ta);
    return ok;
  } catch (err) {
    console.error("legacyCopy failed", err);
    return false;
  }
}

/* ═══════════════════════════════════════════════════
   BLOCK MENU
════════════════════════════════════════════════════ */
function toggleBlockMenu(e, bi) {
  e.stopPropagation();
  const menu = document.getElementById(`blkmenu-${bi}`);
  document.querySelectorAll(".blk-menu.open").forEach(m => { if (m !== menu) m.classList.remove("open"); });
  menu.classList.toggle("open");
}
document.addEventListener("click", (e) => {
  document.querySelectorAll(".blk-menu.open").forEach(m => {
    if (e.target.closest("#moreBtn") && m.id === "exportMenu") return;
    m.classList.remove("open");
  });
});

function exportBlock(bi) {
  const blk = curTab().blocks[bi];
  const json = JSON.stringify({ type: "block", label: blk.label, tags: blk.tags||[], headers: blk.headers, rows: blk.rows }, null, 2);
  downloadJSON(json, `block_${blk.label.replace(/\s+/g,"_")}_${yyyymmdd()}.json`);
  toast("📤 エクスポートしました");
}
function duplicateBlock(bi) {
  const tab = curTab();
  const copy = JSON.parse(JSON.stringify(tab.blocks[bi]));
  copy.id = uid(); copy.label += " (コピー)";
  tab.blocks.splice(bi+1, 0, copy);
  renderSheet(); toast("📋 複製しました");
}
function moveBlockToTab(bi) {
  const tab = curTab();
  const opts = data.tabs.filter(t=>t.id!==activeId)
    .map(t => `<option value="${t.id}">${esc(t.category)} / ${esc(stripEmoji(t.label))}</option>`).join("");
  openModal("別シートへ移動",
    `<label>移動先シート</label><select id="mDst">${opts}</select>`,
    () => {
      const dst = data.tabs.find(t=>t.id===val("mDst"));
      if (!dst) return;
      const [moved] = tab.blocks.splice(bi,1);
      dst.blocks.push(moved);
      renderSheet(); toast("↗ 移動しました");
    });
}

/* ═══════════════════════════════════════════════════
   TAB (SHEET) CRUD
════════════════════════════════════════════════════ */
function addTab(presetCat) {
  const cats = categories();
  const catOpts = cats.map(c=>`<option value="${escAttr(c)}" ${c===presetCat?'selected':''}>${esc(c)}</option>`).join("");
  openModal("新しいシートを追加",
    `<label>シート名（絵文字も使えます）</label>
     <input id="mLabel" placeholder="例: 🔥 攻撃手法">
     <label>カテゴリ</label>
     <select id="mCat">${catOpts}<option value="__new__">＋ 新しいカテゴリ…</option></select>
     <label>タイトル</label>
     <input id="mTitle" placeholder="例: // ATTACK">
     <label>サブタイトル</label>
     <input id="mSub" placeholder="例: 攻撃テクニック一覧">`,
    () => {
      let cat = val("mCat");
      if (cat === "__new__") { cat = prompt("新しいカテゴリ名")?.trim() || "未分類"; }
      const t = {
        id: uid(), label: val("mLabel") || "新しいシート",
        title: val("mTitle") || "// NEW", subtitle: val("mSub") || "",
        category: cat, blocks: []
      };
      data.tabs.push(t);
      switchTab(t.id);
      toast("✅ シートを追加しました");
    });
}
function deleteTab(id) {
  const tab = data.tabs.find(t => t.id === id);
  if (!confirm(`「${stripEmoji(tab.label)}」を削除しますか？`)) return;
  const cat = tab.category;
  data.tabs = data.tabs.filter(t => t.id !== id);
  if (activeId === id) { openCategory(cat); }
  else render();
  toast("🗑 削除しました");
}
function changeTabCategory(id) {
  const tab = data.tabs.find(t=>t.id===id);
  const cats = categories();
  const catOpts = cats.map(c=>`<option value="${escAttr(c)}" ${c===tab.category?'selected':''}>${esc(c)}</option>`).join("");
  openModal("カテゴリを変更",
    `<label>カテゴリ</label><select id="mCat">${catOpts}<option value="__new__">＋ 新しいカテゴリ…</option></select>`,
    () => {
      let cat = val("mCat");
      if (cat === "__new__") { cat = prompt("新しいカテゴリ名")?.trim() || tab.category; }
      tab.category = cat; activeCat = cat;
      renderSheet(); renderNav(); toast("✅ カテゴリを変更しました");
    });
}

/* ═══════════════════════════════════════════════════
   BLOCK CRUD
════════════════════════════════════════════════════ */
function addBlock() {
  openModal("新しい表を追加",
    `<label>表のタイトル</label>
     <input id="mLabel" placeholder="例: 便利コマンド">
     <label>列数</label>
     <input id="mCols" type="number" value="3" min="1" max="8">`,
    () => {
      const n = Math.max(1, Math.min(8, +val("mCols")||3));
      curTab().blocks.push({
        id: uid(), label: val("mLabel")||"新しい表", tags: [],
        headers: Array.from({length:n}, (_,i)=>`列${i+1}`), rows: []
      });
      renderSheet(); toast("✅ 表を追加しました");
    });
}
function delBlock(bi) {
  const tab = curTab();
  if (!confirm(`「${tab.blocks[bi].label}」を削除しますか？`)) return;
  tab.blocks.splice(bi,1); renderSheet(); toast("🗑 削除しました");
}
function moveBlock(bi, dir) {
  const blocks = curTab().blocks;
  const ni = bi+dir; if (ni<0||ni>=blocks.length) return;
  [blocks[bi], blocks[ni]] = [blocks[ni], blocks[bi]];
  renderSheet();
}
function addColumn(bi) {
  openModal("列を追加", inputField("mVal","", "新しい列名"),
    () => {
      const blk = curTab().blocks[bi];
      blk.headers.push(val("mVal")||"新しい列");
      blk.rows.forEach(r=>r.push(""));
      if (Array.isArray(blk.colWrap)) blk.colWrap.push(true);
      renderSheet();
    });
}
function delColumn(bi) {
  const blk = curTab().blocks[bi];
  if (blk.headers.length<=1) { toast("❌ 列が1つしかないため削除できません"); return; }
  const opts = blk.headers.map((h,i)=>`<option value="${i}">${esc(h)}</option>`).join("");
  openModal("削除する列を選択", `<label>列</label><select id="mCol">${opts}</select>`,
    () => {
      const ci = +val("mCol");
      blk.headers.splice(ci,1); blk.rows.forEach(r=>r.splice(ci,1));
      if (Array.isArray(blk.colWrap)) blk.colWrap.splice(ci,1);
      renderSheet();
    });
}
function addRow(bi) {
  const blk = curTab().blocks[bi];
  const fields = blk.headers.map((h,i)=>`<label>${esc(h)}</label><textarea id="mR${i}"></textarea>`).join("");
  openModal("行を追加", fields,
    () => { blk.rows.push(blk.headers.map((_,i)=>val(`mR${i}`))); renderSheet(); toast("✅ 追加しました"); });
}
function delRow(bi, ri) {
  if (!confirm("この行を削除しますか？")) return;
  curTab().blocks[bi].rows.splice(ri,1); renderSheet();
}
function moveRow(bi, ri, dir) {
  const rows = curTab().blocks[bi].rows;
  const ni = ri+dir; if (ni<0||ni>=rows.length) return;
  [rows[ri], rows[ni]] = [rows[ni], rows[ri]];
  renderSheet();
}

/* ═══════════════════════════════════════════════════
   IMPORT / EXPORT
════════════════════════════════════════════════════ */
function openImport() { document.getElementById("importFile").click(); }
function onImportFile(e) {
  const file = e.target.files[0]; if (!file) return;
  const reader = new FileReader();
  reader.onload = ev => { handleImportJSON(ev.target.result); e.target.value = ""; };
  reader.readAsText(file);
}
function handleImportJSON(raw) {
  let parsed;
  try { parsed = JSON.parse(raw); } catch { toast("❌ JSONパースエラー"); return; }

  // tab import
  if (parsed.tabs && Array.isArray(parsed.tabs)) {
    openModal("シートデータのインポート",
      `<div class="modal-radio">
         <label><input type="radio" name="iMode" value="add" checked> 新規シートとして追加</label>
         <label><input type="radio" name="iMode" value="overwrite"> 既存データを上書き</label>
       </div>`,
      () => {
        const mode = document.querySelector('input[name="iMode"]:checked')?.value;
        parsed.tabs.forEach(t => {
          t.id = t.id || uid(); t.category = t.category || "未分類";
          (t.blocks||[]).forEach(b => { b.id=b.id||uid(); b.tags=b.tags||[]; });
        });
        if (mode === "overwrite") { data = parsed; normalizeData(); goHome(); }
        else { parsed.tabs.forEach(t => data.tabs.push(t)); openCategory(parsed.tabs[0]?.category || "未分類"); }
        toast(`✅ ${parsed.tabs.length}シートをインポートしました`);
      });
    return;
  }
  // block import
  if (parsed.type === "block") {
    if (!Array.isArray(parsed.headers) || !Array.isArray(parsed.rows)) { toast("❌ ブロックJSONが不正です"); return; }
    const opts = data.tabs.map(t => `<option value="${t.id}">${esc(t.category)} / ${esc(stripEmoji(t.label))}</option>`).join("");
    const cur = curTab();
    openModal("表のインポート先を選択",
      `<label>追加先シート</label>
       <select id="mDst">
         ${cur?`<option value="${activeId}">（現在: ${esc(stripEmoji(cur.label))}）</option>`:""}
         ${opts}
       </select>`,
      () => {
        const dst = data.tabs.find(t => t.id === val("mDst"));
        if (!dst) { toast("❌ 追加先が見つかりません"); return; }
        dst.blocks.push({ id: uid(), label: parsed.label||"インポート表", tags: parsed.tags||[], headers: parsed.headers, rows: parsed.rows });
        switchTab(dst.id); toast(`✅ 表をインポートしました`);
      });
    return;
  }
  toast("❌ 対応していないJSON形式です（tabs / type:block）");
}

/* ═══════════════════════════════════════════════════
   SAVE TO GITHUB
════════════════════════════════════════════════════ */
async function saveToGitHub() {
  const btn = document.getElementById("saveBtn");
  const icon = btn.querySelector(".material-symbols-rounded");

  // ── ① 保存前の競合チェック：読み込み以降にGitHub側が更新されていないか ──
  if (loadedSnapshot !== null) {
    try {
      const chk = await fetch("/latest", { cache: "no-store" });
      if (chk.ok) {
        const remoteText = await chk.text();
        // 正規化して比較（キー順やインデントの差を無視）
        let remoteNorm, localNorm;
        try { remoteNorm = JSON.stringify(JSON.parse(remoteText)); } catch { remoteNorm = remoteText; }
        try { localNorm  = JSON.stringify(JSON.parse(loadedSnapshot)); } catch { localNorm = loadedSnapshot; }
        if (remoteNorm !== localNorm) {
          // 競合あり → ユーザーに選択させる
          const proceed = await confirmConflict();
          if (!proceed) { toast("保存を中止しました"); return; }
        }
      }
    } catch (e) { /* 取得失敗時は従来通り保存に進む */ }
  }

  btn.disabled = true; icon.textContent = "progress_activity"; icon.classList.add("spin");
  try {
    const body = JSON.stringify(data, null, 2);
    const res = await fetch("/save", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body,
    });
    if (!res.ok) { const err = await res.json().catch(()=>({error:res.statusText})); throw new Error(err.error||res.statusText); }
    const result = await res.json();
    loadedSnapshot = JSON.stringify(data);  // 保存成功 → スナップショット更新
    toast("✅ 保存しました (" + (result.commit?.slice(0,7) ?? "ok") + ")");
  } catch (e) { toast("❌ 保存失敗: " + e.message); console.error(e); }
  finally { btn.disabled = false; icon.classList.remove("spin"); icon.textContent = "cloud_upload"; }
}

/* 競合警告モーダル → Promise<boolean> */
function confirmConflict() {
  return new Promise(resolve => {
    document.getElementById("modalTitle").textContent = "⚠️ 保存の確認";
    document.getElementById("modalBody").innerHTML =
      `<div style="font-size:14px;line-height:1.7">
         このデータを読み込んだ後に、<strong>GitHub 側の data.json が別の場所から更新</strong>されています。<br><br>
         このまま保存すると、<strong style="color:var(--md-error)">相手の変更が上書きされ、失われます</strong>。<br><br>
         最新を取り込みたい場合は、いったん保存せずページを再読み込みしてください。
       </div>`;
    document.getElementById("modalOverlay").classList.add("open");
    // アクションボタンを一時的に差し替え
    const actions = document.querySelector(".modal-actions");
    const original = actions.innerHTML;
    actions.innerHTML =
      `<button class="btn btn-text" id="cfCancel">キャンセル</button>
       <button class="btn btn-text" id="cfReload"><span class="material-symbols-rounded">refresh</span>再読み込み</button>
       <button class="btn btn-filled" id="cfForce" style="background:var(--md-error)">上書き保存</button>`;
    const cleanup = () => { actions.innerHTML = original; closeModal(); };
    document.getElementById("cfCancel").onclick = () => { cleanup(); resolve(false); };
    document.getElementById("cfReload").onclick = () => { location.reload(); };
    document.getElementById("cfForce").onclick  = () => { cleanup(); resolve(true); };
  });
}

/* ── full-data export (JSON / standalone HTML) ── */
function exportJSON() {
  downloadJSON(JSON.stringify(data, null, 2), `toride_data_${yyyymmdd()}.json`);
  toast("📥 data.json をエクスポートしました");
}
function exportHTML() {
  fetch("index.html").then(r => r.text()).then(src => {
    const inject = `<script>window.__PRELOADED_DATA__ = ${JSON.stringify(data)};<\/script>\n`;
    const output = src.replace("</head>", inject + "</head>");
    const a = Object.assign(document.createElement("a"), {
      href: URL.createObjectURL(new Blob([output], { type: "text/html;charset=utf-8" })),
      download: `toride_cheatsheet_${yyyymmdd()}.html`
    });
    document.body.appendChild(a); a.click(); a.remove();
    toast("📥 HTMLを書き出しました");
  }).catch(() => { exportJSON(); toast("⚠️ HTML書き出し失敗。JSONを出力しました"); });
}
/* overflow menu in header */
function toggleExportMenu(e) {
  e?.stopPropagation();
  document.getElementById("exportMenu").classList.toggle("open");
}

/* ═══════════════════════════════════════════════════
   EDIT MODE / THEME / SIDEBAR
════════════════════════════════════════════════════ */
function toggleEdit() {
  editMode = !editMode;
  document.body.classList.toggle("edit", editMode);
  document.getElementById("editToggle").classList.toggle("active", editMode);
  render();
}
function toggleTheme() {
  const dark = document.documentElement.getAttribute("data-theme") === "dark";
  if (dark) { document.documentElement.removeAttribute("data-theme"); localStorage.setItem("cs-theme","light"); }
  else { document.documentElement.setAttribute("data-theme","dark"); localStorage.setItem("cs-theme","dark"); }
  syncThemeIcon();
}
function syncThemeIcon() {
  const dark = document.documentElement.getAttribute("data-theme") === "dark";
  const icon = document.querySelector("#themeToggle .material-symbols-rounded");
  if (icon) icon.textContent = dark ? "light_mode" : "dark_mode";
}
function openSidebar() { document.getElementById("sidebar").classList.add("open"); document.getElementById("sidebarScrim").classList.add("open"); }
function closeSidebar() { document.getElementById("sidebar").classList.remove("open"); document.getElementById("sidebarScrim").classList.remove("open"); }

/* ═══════════════════════════════════════════════════
   MODAL
════════════════════════════════════════════════════ */
function openModal(title, bodyHTML, cb, opts) {
  document.getElementById("modalTitle").textContent = title;
  document.getElementById("modalBody").innerHTML = bodyHTML;
  document.getElementById("modalOverlay").classList.add("open");
  modalCb = cb;

  // アクションボタンをオプションに応じて組み立てる
  const actions = document.querySelector(".modal-actions");
  if (actions) {
    opts = opts || {};
    const okText = opts.okText || "OK";
    const showOk = cb || opts.onOk;   // OKハンドラがある時だけOKボタンを出す
    let html = `<button class="btn btn-text" onclick="closeModal()">キャンセル</button>`;
    // 追加ボタン（編集・削除など）
    (opts.extraBtns || []).forEach((b, i) => {
      window.__modalExtra = window.__modalExtra || {};
      window.__modalExtra[i] = b.fn;
      html += `<button class="btn ${b.cls||'btn-text'}" onclick="window.__modalExtra[${i}]()">${esc(b.label)}</button>`;
    });
    if (showOk) {
      if (opts.onOk) { window.__modalOnOk = opts.onOk; html += `<button class="btn btn-filled" onclick="window.__modalOnOk()">${esc(okText)}</button>`; }
      else html += `<button class="btn btn-filled" onclick="confirmModal()">${esc(okText)}</button>`;
    }
    actions.innerHTML = html;
  }

  setTimeout(() => document.querySelector("#modalBody input:not([type=radio]):not([type=file]),#modalBody textarea,#modalBody select")?.focus(), 50);
}

/* HTMLは環境非依存でコピー（Clipboard API + フォールバック） */
function copyToClipboard(text) {
  if (navigator.clipboard && window.isSecureContext) {
    navigator.clipboard.writeText(text).catch(() => legacyCopy(text));
  } else {
    legacyCopy(text);
  }
}
function closeModal() {
  document.getElementById("modalOverlay").classList.remove("open");
  modalCb = null;
  window.__modalOnOk = null; window.__modalExtra = null;
  // アクションボタンを標準（キャンセル/OK）に戻す
  const actions = document.querySelector(".modal-actions");
  if (actions) actions.innerHTML = `<button class="btn btn-text" onclick="closeModal()">キャンセル</button><button class="btn btn-filled" onclick="confirmModal()">OK</button>`;
}
function confirmModal() { modalCb?.(); closeModal(); }
document.getElementById("modalOverlay").addEventListener("click", e => { if (e.target === e.currentTarget) closeModal(); });

/* ═══════════════════════════════════════════════════
   KEYBOARD
════════════════════════════════════════════════════ */
document.addEventListener("keydown", e => {
  const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement.tagName);
  const modalOpen = document.getElementById("modalOverlay").classList.contains("open");

  if ((e.ctrlKey || e.metaKey) && e.key === "k") { e.preventDefault(); document.getElementById("searchInput").focus(); return; }
  if (e.key === "/" && !typing && !modalOpen) { e.preventDefault(); document.getElementById("searchInput").focus(); return; }
  if (e.key === "Escape") {
    if (modalOpen) { closeModal(); return; }
    if (searchMode) { clearSearchInput(); searchMode = false; render(); return; }
    closeSidebar();
  }
  if (e.key === "Enter" && modalOpen) {
    if (document.activeElement.tagName !== "TEXTAREA" && document.activeElement.type !== "file") {
      e.preventDefault();
      if (window.__modalOnOk) window.__modalOnOk();
      else confirmModal();
    }
  }
  if (e.key.toLowerCase() === "e" && !typing && !modalOpen) { toggleEdit(); }
});

/* ═══════════════════════════════════════════════════
   HELPERS
════════════════════════════════════════════════════ */
function editBanner() {
  return `<div id="editBanner"><span class="material-symbols-rounded">edit</span>編集モード — 項目をクリックで編集 / メニューから追加・削除</div>`;
}
function breadcrumb(trail, current) {
  const parts = trail.map(t => `<button onclick="${t.fn}">${esc(t.label)}</button><span class="material-symbols-rounded">chevron_right</span>`).join("");
  return `<div class="breadcrumb">${parts}<span>${esc(current)}</span></div>`;
}
function emptyState(icon, title, sub) {
  return `<div class="empty-state">
    <div class="empty-icon"><span class="material-symbols-rounded">${icon}</span></div>
    <h3>${esc(title)}</h3><p>${esc(sub)}</p></div>`;
}
function inputField(id, value, placeholder) {
  return `<label>内容</label><input id="${id}" value="${esc(value??"")}" placeholder="${esc(placeholder??"")}">`;
}
function downloadJSON(json, name) {
  const a = Object.assign(document.createElement("a"), {
    href: URL.createObjectURL(new Blob([json],{type:"application/json"})), download: name });
  document.body.appendChild(a); a.click(); a.remove();
}
function leadingEmoji(s) {
  const m = (s||"").match(/^\s*(\p{Extended_Pictographic}(?:\u200d\p{Extended_Pictographic}|[\uFE0F\u20E3])*)/u);
  return m ? m[1] : "";
}
function stripEmoji(s) {
  return (s||"").replace(/^\s*(\p{Extended_Pictographic}(?:\u200d\p{Extended_Pictographic}|[\uFE0F\u20E3])*)\s*/u, "").trim() || (s||"");
}
function toast(msg) {
  const el = document.getElementById("toast");
  el.textContent = msg; el.classList.add("show");
  clearTimeout(el._t); el._t = setTimeout(()=>el.classList.remove("show"), 2400);
}
function uid()      { return Math.random().toString(36).slice(2, 9); }
function esc(s)     { return String(s ?? "").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;"); }
function escAttr(s) { return esc(s).replace(/'/g,"&#39;"); }
function val(id)    { return document.getElementById(id)?.value ?? ""; }
function curTab()   { return data.tabs.find(t => t.id === activeId); }
function yyyymmdd() { return new Date().toISOString().slice(0,10); }
