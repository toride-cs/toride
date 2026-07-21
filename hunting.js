/* ═══════════════════════════════════════════════════════
   go2 cheatsheet — hunting.js  (スレットハンティング)
   Data: data.hunts[], data.queries[]
   hunt  { id,title,hypothesis,techniques[],dataSources[],environment,
           status,stage,conclusion,followup,started_at, steps[] }
   step  { id,query,lang,finding,verdict,ts }
   query { id,title,lang,body,techniques[],dataSource,platform,
           falsePositives,reference,ts }

   app.js の共通関数（openModal/toast/esc/uid/copyCell/val 等）と
   定数（HUNT_STAGES/QUERY_LANGS/HUNT_VERDICTS/HUNT_STATUS）を再利用。
════════════════════════════════════════════════════════ */

/* ── ヘルパ ── */
function huntGet()      { return data.hunts.find(h => h.id === huntId); }
function huntVerdictColor(v){ const m = HUNT_VERDICTS.find(x=>x.id===v); return m ? m.color : "#7d9186"; }
function huntStatusMeta(s){ return HUNT_STATUS[s] || HUNT_STATUS.plan; }
function huntLangClass(lang){
  return String(lang).toLowerCase().replace(/[^a-z]/g,""); // "ES|QL" -> "esql"
}
function huntHHMM(ts){
  const d = new Date(ts||Date.now());
  return `${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}`;
}
/* ATT&CK ID を正規化（大文字化・空白除去） */
function normTech(t){ return String(t||"").toUpperCase().replace(/\s+/g,""); }

/* ═══════════════════════════════════════════════════
   共通ナビ（サイドバー）
════════════════════════════════════════════════════ */
function renderHuntNav(active) {
  // active: "hunt" | "query" | "coverage"
  const nav = document.getElementById("navList");
  if (!nav) return;
  const item = (mode, icon, label, count) => `
    <button class="nav-item ${appMode===mode?'active':''}" onclick="setMode('${mode}')">
      <span class="material-symbols-rounded nav-icon">${icon}</span>
      <span class="nav-label">${label}</span>
      ${count!=null?`<span class="nav-count">${count}</span>`:""}
    </button>`;
  nav.innerHTML =
    item("hunt", "travel_explore", "ハント", data.hunts.length) +
    item("query", "manage_search", "クエリ集", data.queries.length) +
    item("coverage", "map", "カバレッジ", null);
}

/* ═══════════════════════════════════════════════════
   検知クエリ・ライブラリ
════════════════════════════════════════════════════ */
function renderQueryLib() {
  renderHuntNav("query");
  const main = document.getElementById("main");

  // 言語別カウント
  const counts = {};
  QUERY_LANGS.forEach(l => counts[l] = data.queries.filter(q=>q.lang===l).length);
  const countStr = QUERY_LANGS.filter(l=>counts[l]).map(l=>`${l} ${counts[l]}`).join(" · ") || "まだありません";

  // Technique一覧（頻度順）
  const techFreq = {};
  data.queries.forEach(q => (q.techniques||[]).forEach(t => { const k=normTech(t); techFreq[k]=(techFreq[k]||0)+1; }));
  const topTechs = Object.keys(techFreq).sort((a,b)=>techFreq[b]-techFreq[a]).slice(0,8);

  // フィルタ適用
  let list = data.queries.slice();
  if (queryLangFilter) list = list.filter(q => q.lang === queryLangFilter);
  if (queryTechFilter) list = list.filter(q => (q.techniques||[]).some(t=>normTech(t)===queryTechFilter));

  const langChips = QUERY_LANGS.map(l =>
    `<button class="th-chip ${queryLangFilter===l?'on':''}" onclick="hqSetLang('${l}')">${esc(l)}</button>`).join("");
  const techChips = topTechs.map(t =>
    `<button class="th-chip att ${queryTechFilter===t?'on':''}" onclick="hqSetTech('${escAttr(t)}')">${esc(t)}</button>`).join("");

  const cards = list.map(q => renderQueryCard(q)).join("");

  main.innerHTML = `
    <div class="s-head">
      <h1>検知クエリ</h1>
      <span class="th-count">${data.queries.length} 件 · ${countStr}</span>
      <button class="th-import-btn" onclick="hqImportFromCheatsheet()"><span class="material-symbols-rounded">move_to_inbox</span>チートシートから取り込み</button>
      <button class="th-add" onclick="hqAddQuery()"><span class="material-symbols-rounded">add</span>クエリを追加</button>
    </div>
    <div class="th-filters">
      <button class="th-chip ${!queryLangFilter?'on':''}" onclick="hqSetLang(null)">すべて</button>
      ${langChips}
      ${topTechs.length?`<span class="th-sep"></span>${techChips}`:""}
      ${(queryLangFilter||queryTechFilter)?`<button class="th-chip" onclick="hqClearFilter()"><span class="material-symbols-rounded" style="font-size:16px">close</span>クリア</button>`:""}
    </div>
    ${list.length ? `<div class="th-qgrid">${cards}</div>`
      : emptyState("manage_search", data.queries.length?"該当するクエリがありません":"クエリがまだありません",
          data.queries.length?"フィルタを変えてください":"「クエリを追加」で登録、またはチートシートのKQLから取り込めます")}
  `;
}

function renderQueryCard(q) {
  const langCls = huntLangClass(q.lang);
  const techs = (q.techniques||[]).map(t=>`<span class="th-att-tag">${esc(t)}</span>`).join("");
  const ds = q.dataSource ? `<span class="th-ds-tag">${esc(q.dataSource)}</span>` : "";
  const plat = q.platform ? `<span style="font-size:11px;color:var(--md-on-surface-var);font-family:var(--font-mono)">${esc(q.platform)}</span>` : "";
  const fp = q.falsePositives ? `<div class="th-fp"><span class="material-symbols-rounded" style="font-size:14px">warning</span>${esc(q.falsePositives)}</div>` : "";
  const bodyPreview = esc(q.body).split("\n").slice(0,5).join("\n");
  return `
    <div class="th-qcard" onclick="hqOpenQuery('${q.id}')">
      <div class="th-qcard-top">
        <span class="th-lang th-lang-${langCls}">${esc(q.lang)}</span>
        ${plat}
        <button class="th-qcopy" onclick="event.stopPropagation();copyCell(event, ${escAttr(JSON.stringify(q.body))})" title="コピー"><span class="material-symbols-rounded">content_copy</span></button>
      </div>
      <h3 class="th-qtitle">${esc(q.title)}</h3>
      <pre class="th-qcode">${bodyPreview||"<span style='color:var(--md-on-surface-var)'>（クエリ本体なし）</span>"}</pre>
      <div class="th-qcard-foot">${techs}${ds}</div>
      ${fp}
    </div>`;
}

/* フィルタ操作 */
function hqSetLang(l){ queryLangFilter = l; renderQueryLib(); }
function hqSetTech(t){ queryTechFilter = (queryTechFilter===t?null:t); renderQueryLib(); }
function hqClearFilter(){ queryLangFilter=null; queryTechFilter=null; renderQueryLib(); }

/* クエリ CRUD */
function hqAddQuery(preset) {
  const langOpts = QUERY_LANGS.map(l=>`<option value="${l}" ${preset?.lang===l?'selected':''}>${l}</option>`).join("");
  openModal("クエリを追加",
    `<label>タイトル</label>
     <input id="qTitle" value="${esc(preset?.title||"")}" placeholder="例: 疑わしい親子プロセス (Office→cmd)">
     <label>言語</label>
     <select id="qLang">${langOpts}</select>
     <label>クエリ本体</label>
     <textarea id="qBody" placeholder="クエリを貼り付け">${esc(preset?.body||"")}</textarea>
     <label>ATT&CK Technique（スペース区切り、例: T1059.001 T1204）</label>
     <input id="qTech" value="${esc((preset?.techniques||[]).join(" "))}" placeholder="T1059.001">
     <label>データソース</label>
     <input id="qDs" value="${esc(preset?.dataSource||"")}" placeholder="例: Sysmon EID1 / system.security">
     <label>プラットフォーム</label>
     <input id="qPlat" value="${esc(preset?.platform||"")}" placeholder="例: Sentinel / Splunk / Elastic / Defender">
     <label>誤検知メモ（任意）</label>
     <input id="qFp" value="${esc(preset?.falsePositives||"")}" placeholder="例: マクロ有効文書で誤検知">
     <label>参照リンク（任意）</label>
     <input id="qRef" value="${esc(preset?.reference||"")}" placeholder="出典URL">`,
    () => {
      const q = {
        id: uid(),
        title: val("qTitle") || "無題のクエリ",
        lang: val("qLang") || "KQL",
        body: val("qBody"),
        techniques: val("qTech").split(/\s+/).map(normTech).filter(Boolean),
        dataSource: val("qDs"),
        platform: val("qPlat"),
        falsePositives: val("qFp"),
        reference: val("qRef"),
        ts: Date.now(),
      };
      data.queries.push(q);
      renderQueryLib();
      toast("✅ クエリを追加しました");
    });
}

function hqOpenQuery(id) {
  const q = data.queries.find(x=>x.id===id);
  if (!q) return;
  const techs = (q.techniques||[]).map(t=>`<span class="th-att-tag">${esc(t)}</span>`).join(" ") || "<span style='color:var(--md-on-surface-var)'>なし</span>";
  const ref = q.reference ? `<a href="${esc(q.reference)}" target="_blank" rel="noopener" style="color:var(--md-primary)">${esc(q.reference)}</a>` : "—";
  openModal(q.title,
    `<div class="th-detail">
       <div class="th-detail-row"><span class="th-dl">言語</span><span class="th-lang th-lang-${huntLangClass(q.lang)}">${esc(q.lang)}</span></div>
       <div class="th-detail-row"><span class="th-dl">Technique</span><span>${techs}</span></div>
       <div class="th-detail-row"><span class="th-dl">データソース</span><span>${esc(q.dataSource)||"—"}</span></div>
       <div class="th-detail-row"><span class="th-dl">プラットフォーム</span><span>${esc(q.platform)||"—"}</span></div>
       ${q.falsePositives?`<div class="th-detail-row"><span class="th-dl">誤検知</span><span style="color:var(--md-warn)">${esc(q.falsePositives)}</span></div>`:""}
       <div class="th-detail-row"><span class="th-dl">参照</span><span>${ref}</span></div>
       <label style="margin-top:16px">クエリ本体</label>
       <pre class="th-qcode-full">${esc(q.body)}</pre>
     </div>`,
    null,
    { okText: "コピー", onOk: () => { copyToClipboard(q.body); toast("📋 コピーしました"); },
      extraBtns: [
        { label: "編集", cls: "btn-text", fn: () => { closeModal(); hqEditQuery(id); } },
        { label: "削除", cls: "btn-text btn-danger", fn: () => { closeModal(); hqDelQuery(id); } },
      ] });
}

function hqEditQuery(id) {
  const q = data.queries.find(x=>x.id===id); if (!q) return;
  const langOpts = QUERY_LANGS.map(l=>`<option value="${l}" ${q.lang===l?'selected':''}>${l}</option>`).join("");
  openModal("クエリを編集",
    `<label>タイトル</label><input id="qTitle" value="${esc(q.title)}">
     <label>言語</label><select id="qLang">${langOpts}</select>
     <label>クエリ本体</label><textarea id="qBody">${esc(q.body)}</textarea>
     <label>ATT&CK Technique（スペース区切り）</label><input id="qTech" value="${esc((q.techniques||[]).join(" "))}">
     <label>データソース</label><input id="qDs" value="${esc(q.dataSource)}">
     <label>プラットフォーム</label><input id="qPlat" value="${esc(q.platform)}">
     <label>誤検知メモ</label><input id="qFp" value="${esc(q.falsePositives)}">
     <label>参照リンク</label><input id="qRef" value="${esc(q.reference)}">`,
    () => {
      q.title = val("qTitle") || "無題のクエリ";
      q.lang = val("qLang");
      q.body = val("qBody");
      q.techniques = val("qTech").split(/\s+/).map(normTech).filter(Boolean);
      q.dataSource = val("qDs"); q.platform = val("qPlat");
      q.falsePositives = val("qFp"); q.reference = val("qRef");
      renderQueryLib(); toast("✅ 更新しました");
    });
}

function hqDelQuery(id) {
  const q = data.queries.find(x=>x.id===id); if (!q) return;
  if (!confirm(`「${q.title}」を削除しますか？`)) return;
  data.queries = data.queries.filter(x=>x.id!==id);
  renderQueryLib(); toast("🗑 削除しました");
}

/* クエリ検索 */
function renderQuerySearch() {
  const main = document.getElementById("main");
  const q = document.getElementById("searchInput").value.trim().toLowerCase();
  if (!q) { searchMode = false; render(); return; }
  const hits = data.queries.filter(x =>
    (x.title||"").toLowerCase().includes(q) ||
    (x.body||"").toLowerCase().includes(q) ||
    (x.dataSource||"").toLowerCase().includes(q) ||
    (x.techniques||[]).some(t=>t.toLowerCase().includes(q))
  );
  renderHuntNav("query");
  main.innerHTML = `
    <div class="s-head"><h1>検索: ${esc(q)}</h1><span class="th-count">${hits.length} 件</span></div>
    ${hits.length ? `<div class="th-qgrid">${hits.map(renderQueryCard).join("")}</div>`
      : emptyState("search_off","一致するクエリがありません","別のキーワードをお試しください")}
  `;
}

/* ═══════════════════════════════════════════════════
   ハント・ログブック（一覧）
════════════════════════════════════════════════════ */
function renderHunt() {
  if (huntView === "hunt" && huntGet()) { renderHuntDetail(); return; }
  huntView = "list";
  renderHuntNav("hunt");
  const main = document.getElementById("main");

  const detected = data.hunts.filter(h=>h.status==="detected").length;
  const running  = data.hunts.filter(h=>h.status==="running").length;

  // フィルタ
  let list = data.hunts.slice();
  if (huntFilter === "running")  list = list.filter(h=>h.status==="running");
  if (huntFilter === "detected") list = list.filter(h=>h.status==="detected");
  if (huntFilter === "clear")    list = list.filter(h=>h.status==="clear");
  if (huntFilter === "followup") list = list.filter(h=>h.status==="followup");
  if (huntFilter === "実務")     list = list.filter(h=>h.environment==="実務");
  if (huntFilter === "ラボ")     list = list.filter(h=>h.environment==="ラボ");

  const fchip = (key,label) => `<button class="th-chip ${huntFilter===key?'on':''}" onclick="hSetFilter('${key}')">${label}</button>`;

  const cards = list.map(h => {
    const st = huntStatusMeta(h.status);
    const techs = (h.techniques||[]).slice(0,3).map(t=>`<span class="th-att-tag">${esc(t)}</span>`).join("");
    return `
      <div class="th-hcard" onclick="hOpen('${h.id}')">
        <div class="th-qcard-top">
          <span class="th-hstatus ${st.cls}">${st.label}</span>
          ${h.environment?`<span style="font-size:11px;color:var(--md-on-surface-var);font-family:var(--font-mono);margin-left:auto">${esc(h.environment)}</span>`:""}
        </div>
        <h3 class="th-qtitle">${esc(h.title)}</h3>
        ${h.hypothesis?`<div class="th-hypo">仮説: ${esc(h.hypothesis)}</div>`:""}
        <div class="th-hcard-foot">${techs}<span class="th-metric" style="margin-left:auto">${h.steps.length} クエリ</span></div>
      </div>`;
  }).join("");

  main.innerHTML = `
    <div class="s-head">
      <h1>ハント</h1>
      <span class="th-count">${data.hunts.length} 件 · 検知 ${detected} · 進行中 ${running}</span>
      <button class="th-add" onclick="hAddHunt()"><span class="material-symbols-rounded">add</span>ハントを開始</button>
    </div>
    <div class="th-filters">
      ${fchip("all","すべて")}${fchip("running","進行中")}${fchip("detected","検知あり")}${fchip("clear","未検知")}${fchip("followup","要追加調査")}
      <span class="th-sep"></span>${fchip("実務","実務")}${fchip("ラボ","ラボ")}
    </div>
    ${list.length ? `<div class="th-hgrid">${cards}</div>`
      : emptyState("travel_explore", data.hunts.length?"該当するハントがありません":"ハントがまだありません",
          data.hunts.length?"フィルタを変えてください":"「ハントを開始」で仮説を立てて記録を始めましょう")}
  `;
}
function hSetFilter(key){ huntFilter = key; renderHunt(); }

function hAddHunt() {
  openModal("ハントを開始",
    `<label>タイトル</label>
     <input id="hTitle" placeholder="例: PsExec によるラテラルムーブメントの痕跡">
     <label>仮説（何があると考えるか）</label>
     <textarea id="hHypo" placeholder="例: 侵害済みホストから内部の別ホストへ PsExec で横展開しているはず"></textarea>
     <label>ATT&CK Technique（スペース区切り）</label>
     <input id="hTech" placeholder="T1021.002 T1569.002">
     <label>データソース（スペース区切り）</label>
     <input id="hDs" placeholder="System.evtx Security.evtx Zeek">
     <label>環境</label>
     <select id="hEnv"><option value="実務">実務</option><option value="ラボ">ラボ</option></select>`,
    () => {
      const h = {
        id: uid(),
        title: val("hTitle") || "無題のハント",
        hypothesis: val("hHypo"),
        techniques: val("hTech").split(/\s+/).map(normTech).filter(Boolean),
        dataSources: val("hDs").split(/\s+/).filter(Boolean),
        environment: val("hEnv") || "実務",
        status: "running", stage: "prepare",
        conclusion: "", followup: "",
        started_at: Date.now(), steps: [],
      };
      data.hunts.push(h);
      hOpen(h.id);
      toast("✅ ハントを開始しました");
    });
}
function hOpen(id) { huntId = id; huntView = "hunt"; huntStageFilter = null; render(); document.getElementById("main").scrollTop = 0; }

/* ═══════════════════════════════════════════════════
   ハント詳細
════════════════════════════════════════════════════ */
function renderHuntDetail() {
  renderHuntNav("hunt");
  const main = document.getElementById("main");
  const h = huntGet();
  if (!h) { huntView = "list"; renderHunt(); return; }
  const st = huntStatusMeta(h.status);

  // PEAK ステージ
  const stageIdx = HUNT_STAGES.findIndex(s=>s.id===h.stage);
  const stageRow = HUNT_STAGES.map((s,i) => {
    const cls = i < stageIdx ? "done" : (i===stageIdx ? "cur" : "");
    return `<button class="th-stage ${cls}" onclick="hSetStage('${s.id}')">${i+1==1?'①':i+1==2?'②':'③'} ${s.label} <span style="opacity:.6">${s.jp}</span></button>`;
  }).join("");

  // 言語ピッカー現在値
  const curLang = window.__hInputLang || "KQL";
  const langOpts = QUERY_LANGS.map(l=>`<button class="th-lang-opt" onclick="hSetInputLang('${l}')">${l}</button>`).join("");

  // タイムライン（所見フィルタ）
  let steps = h.steps.slice();
  if (huntStageFilter) steps = steps.filter(s=>s.verdict===huntStageFilter);
  const timeline = steps.length ? steps.map((s, idx) => {
    const realIdx = h.steps.indexOf(s);
    return `
    <div class="th-hentry ${esc(s.verdict)}">
      <div class="th-hentry-head">
        <span class="th-verdict ${esc(s.verdict)}">${esc(s.verdict)}</span>
        <span class="th-lang th-lang-${huntLangClass(s.lang)}" style="font-size:9px">${esc(s.lang)}</span>
        <span class="th-hentry-time">${huntHHMM(s.ts)}</span>
        <button class="th-step-edit" onclick="hEditStep(${realIdx})" title="編集"><span class="material-symbols-rounded" style="font-size:14px">edit</span></button>
        <button class="th-step-del" onclick="hDelStep(${realIdx})" title="削除"><span class="material-symbols-rounded" style="font-size:14px">delete</span></button>
      </div>
      <pre class="th-hquery">${esc(s.query)}<button class="th-savebtn" onclick="hSaveToLib(${realIdx})" title="クエリ集に保存"><span class="material-symbols-rounded" style="font-size:14px">bookmark_add</span> クエリ集に保存</button></pre>
      ${s.finding?`<div class="th-hfinding"><span class="th-tag">→ </span>${esc(s.finding)}</div>`:""}
    </div>`;
  }).join("") : `<div class="th-empty-tl">まだ記録がありません。下の入力欄からクエリと所見を記録しましょう。</div>`;

  // 所見フィルタchips
  const vcount = {}; HUNT_VERDICTS.forEach(v=>vcount[v.id]=h.steps.filter(s=>s.verdict===v.id).length);
  const vchips = HUNT_VERDICTS.filter(v=>vcount[v.id]).map(v =>
    `<button class="th-vchip ${huntStageFilter===v.id?'on':''}" onclick="hSetVerdictFilter('${v.id}')" style="--vc:${v.color}">${v.label} <span class="cnt">${vcount[v.id]}</span></button>`).join("");

  const techChips = (h.techniques||[]).map(t=>`<span class="th-att-chip">${esc(t)}</span>`).join("") || "<span style='color:var(--md-on-surface-var)'>—</span>";
  const dsChips = (h.dataSources||[]).map(d=>`<span class="th-ds-chip">${esc(d)}</span>`).join("") || "<span style='color:var(--md-on-surface-var)'>—</span>";

  main.innerHTML = `
    <div class="th-hd">
      <div class="th-hd-main">
        <div class="th-crumb"><button onclick="hBackList()">ハント</button> / <b>${esc(h.title)}</b></div>
        <div class="th-hd-title">${esc(h.title)}</div>
        <div class="th-hd-hypo"><span class="lbl">Hypothesis / 仮説</span>${esc(h.hypothesis)||"（仮説未記入）"}</div>
        <div class="th-stage-row">${stageRow}</div>

        <div class="th-hquick">
          <button class="th-lang-pick" onclick="hToggleLangMenu(event)">${esc(curLang)} ▾
            <div class="th-lang-menu" id="hLangMenu">${langOpts}</div>
          </button>
          <input id="hQuickInput" placeholder="クエリを実行して所見を記録… 例: EID 7045 で PSEXESVC を検索 → WS03 で1件 [suspicious]" onkeydown="if(event.key==='Enter')hQuickAdd()">
          <button class="th-go" onclick="hQuickAdd()">記録</button>
        </div>
        <div class="th-hquick-hint">末尾に <b>[benign] [suspicious] [malicious] [inconclusive]</b> で所見の判定。「→」の後ろが所見メモ。</div>

        ${vchips?`<div class="th-vchips"><button class="th-vchip ${!huntStageFilter?'on':''}" onclick="hSetVerdictFilter(null)">すべて <span class="cnt">${h.steps.length}</span></button>${vchips}</div>`:""}

        <div class="th-htl">${timeline}</div>
      </div>
      <div class="th-hd-side">
        <div class="th-side-sec"><h4>ATT&CK Technique</h4><div>${techChips}</div>
          <button class="th-side-mini" onclick="hEditMeta()"><span class="material-symbols-rounded" style="font-size:14px">edit</span>編集</button>
        </div>
        <div class="th-side-sec"><h4>データソース</h4><div>${dsChips}</div></div>
        <div class="th-side-sec"><h4>ハント情報</h4>
          <div class="th-kv"><span class="k">環境</span><span class="v">${esc(h.environment)||"—"}</span></div>
          <div class="th-kv"><span class="k">状態</span><span class="v" style="color:${st.color}">${st.label}</span></div>
          <div class="th-kv"><span class="k">クエリ数</span><span class="v">${h.steps.length}</span></div>
          <div class="th-kv"><span class="k">開始</span><span class="v">${huntHHMM(h.started_at)}</span></div>
          <button class="th-side-mini" onclick="hChangeStatus()"><span class="material-symbols-rounded" style="font-size:14px">flag</span>状態を変更</button>
        </div>
        <div class="th-side-sec"><h4>結論</h4>
          ${h.conclusion?`<div class="th-concl">${esc(h.conclusion)}</div>`:`<div class="th-side-empty">未記入</div>`}
          <button class="th-side-mini" onclick="hEditConclusion()"><span class="material-symbols-rounded" style="font-size:14px">edit</span>結論を書く</button>
        </div>
        <div class="th-side-sec"><h4>出力</h4>
          <button class="th-report-btn" onclick="hOpenReport()"><span class="material-symbols-rounded" style="font-size:16px">description</span>ハントレポートを作成</button>
        </div>
      </div>
    </div>
  `;
}

function hBackList(){ huntView="list"; huntId=null; renderHunt(); }
function hSetStage(s){ const h=huntGet(); if(h){ h.stage=s; renderHuntDetail(); } }
function hSetVerdictFilter(v){ huntStageFilter = v; renderHuntDetail(); }
function hSetInputLang(l){ window.__hInputLang = l; document.getElementById("hLangMenu")?.classList.remove("open"); renderHuntDetail(); }
function hToggleLangMenu(e){ e.stopPropagation(); document.getElementById("hLangMenu")?.classList.toggle("open"); }

/* ワンライン入力 → ステップ記録 */
function hQuickAdd() {
  const input = document.getElementById("hQuickInput");
  if (!input) return;
  const raw = input.value.trim();
  if (!raw) return;
  const h = huntGet(); if (!h) return;

  // 末尾 [verdict] を解釈
  let verdict = "inconclusive";
  let text = raw;
  const m = raw.match(/^(.*?)\s*\[([^\]]+)\]\s*$/);
  if (m) {
    const found = HUNT_VERDICTS.find(v => v.id.toLowerCase() === m[2].toLowerCase());
    if (found) { verdict = found.id; text = m[1]; }
  }
  // 「→」で クエリ と 所見 を分割
  let query = text, finding = "";
  const arrow = text.split(/\s*(?:→|->)\s*/);
  if (arrow.length >= 2) { query = arrow[0]; finding = arrow.slice(1).join(" → "); }

  h.steps.push({
    id: uid(), query: query.trim(), lang: window.__hInputLang || "KQL",
    finding: finding.trim(), verdict, ts: Date.now(),
  });
  input.value = "";
  renderHuntDetail();
}

function hEditStep(idx) {
  const h = huntGet(); const s = h.steps[idx]; if (!s) return;
  const vOpts = HUNT_VERDICTS.map(v=>`<option value="${v.id}" ${s.verdict===v.id?'selected':''}>${v.label}</option>`).join("");
  const lOpts = QUERY_LANGS.map(l=>`<option value="${l}" ${s.lang===l?'selected':''}>${l}</option>`).join("");
  openModal("記録を編集",
    `<label>言語</label><select id="sLang">${lOpts}</select>
     <label>クエリ</label><textarea id="sQuery">${esc(s.query)}</textarea>
     <label>所見</label><textarea id="sFinding">${esc(s.finding)}</textarea>
     <label>判定</label><select id="sVerdict">${vOpts}</select>`,
    () => { s.lang=val("sLang"); s.query=val("sQuery"); s.finding=val("sFinding"); s.verdict=val("sVerdict"); renderHuntDetail(); });
}
function hDelStep(idx) {
  const h = huntGet(); if (!h.steps[idx]) return;
  if (!confirm("この記録を削除しますか？")) return;
  h.steps.splice(idx,1); renderHuntDetail();
}

/* クエリ集に保存 */
function hSaveToLib(idx) {
  const h = huntGet(); const s = h.steps[idx]; if (!s) return;
  hqAddQuery({
    title: s.finding ? s.finding.slice(0,40) : (h.title + " のクエリ"),
    lang: s.lang, body: s.query,
    techniques: h.techniques || [],
    dataSource: (h.dataSources||[]).join(" / "),
  });
}

function hEditMeta() {
  const h = huntGet(); if (!h) return;
  openModal("Technique・データソースを編集",
    `<label>ATT&CK Technique（スペース区切り）</label>
     <input id="hTech" value="${esc((h.techniques||[]).join(" "))}">
     <label>データソース（スペース区切り）</label>
     <input id="hDs" value="${esc((h.dataSources||[]).join(" "))}">
     <label>仮説</label><textarea id="hHypo">${esc(h.hypothesis)}</textarea>
     <label>環境</label><select id="hEnv"><option value="実務" ${h.environment==="実務"?"selected":""}>実務</option><option value="ラボ" ${h.environment==="ラボ"?"selected":""}>ラボ</option></select>`,
    () => {
      h.techniques = val("hTech").split(/\s+/).map(normTech).filter(Boolean);
      h.dataSources = val("hDs").split(/\s+/).filter(Boolean);
      h.hypothesis = val("hHypo"); h.environment = val("hEnv");
      renderHuntDetail();
    });
}
function hChangeStatus() {
  const h = huntGet(); if (!h) return;
  const opts = Object.keys(HUNT_STATUS).map(k=>`<option value="${k}" ${h.status===k?'selected':''}>${HUNT_STATUS[k].label}</option>`).join("");
  openModal("状態を変更", `<label>状態</label><select id="hStatus">${opts}</select>`,
    () => { h.status = val("hStatus"); renderHuntDetail(); });
}
function hEditConclusion() {
  const h = huntGet(); if (!h) return;
  openModal("結論を書く",
    `<label>結論</label><textarea id="hConcl" placeholder="ハントの結論">${esc(h.conclusion)}</textarea>
     <label>フォローアップ（任意）</label><textarea id="hFollow" placeholder="次のアクション">${esc(h.followup)}</textarea>`,
    () => { h.conclusion = val("hConcl"); h.followup = val("hFollow"); renderHuntDetail(); });
}
function hDelHunt(id) {
  const h = data.hunts.find(x=>x.id===id); if (!h) return;
  if (!confirm(`「${h.title}」を削除しますか？`)) return;
  data.hunts = data.hunts.filter(x=>x.id!==id);
  hBackList(); toast("🗑 削除しました");
}

/* ハント検索 */
function renderHuntSearch() {
  const main = document.getElementById("main");
  const q = document.getElementById("searchInput").value.trim().toLowerCase();
  if (!q) { searchMode = false; render(); return; }
  const hits = data.hunts.filter(h =>
    (h.title||"").toLowerCase().includes(q) ||
    (h.hypothesis||"").toLowerCase().includes(q) ||
    (h.techniques||[]).some(t=>t.toLowerCase().includes(q)) ||
    h.steps.some(s=>(s.query||"").toLowerCase().includes(q)||(s.finding||"").toLowerCase().includes(q))
  );
  renderHuntNav("hunt");
  const cards = hits.map(h => {
    const st = huntStatusMeta(h.status);
    const techs = (h.techniques||[]).slice(0,3).map(t=>`<span class="th-att-tag">${esc(t)}</span>`).join("");
    return `<div class="th-hcard" onclick="hOpen('${h.id}')">
      <div class="th-qcard-top"><span class="th-hstatus ${st.cls}">${st.label}</span></div>
      <h3 class="th-qtitle">${esc(h.title)}</h3>
      ${h.hypothesis?`<div class="th-hypo">仮説: ${esc(h.hypothesis)}</div>`:""}
      <div class="th-hcard-foot">${techs}<span class="th-metric" style="margin-left:auto">${h.steps.length} クエリ</span></div>
    </div>`;
  }).join("");
  main.innerHTML = `
    <div class="s-head"><h1>検索: ${esc(q)}</h1><span class="th-count">${hits.length} 件</span></div>
    ${hits.length ? `<div class="th-hgrid">${cards}</div>` : emptyState("search_off","一致するハントがありません","別のキーワードをお試しください")}
  `;
}

/* ═══════════════════════════════════════════════════
   ハントレポート（方式A: 英語骨組み＋日本語メモ）
════════════════════════════════════════════════════ */
function hOpenReport() {
  const h = huntGet(); if (!h) return;
  window.__hReportOpts = window.__hReportOpts || { jp:true, en:true, ts:true, concl:true };
  renderHuntReport();
}
function renderHuntReport() {
  const main = document.getElementById("main");
  const h = huntGet(); if (!h) { hBackList(); return; }
  const o = window.__hReportOpts;

  const body = h.steps.map(s => {
    let block = `<div class="th-doc-verdict th-verdict ${esc(s.verdict)}">${esc(s.verdict)}</div>`;
    if (o.jp && s.finding) block += `<div class="th-doc-jp"><span class="lbl">所見（日本語）</span>${esc(s.finding)}</div>`;
    if (o.en) block += `<div class="th-doc-en"><span class="lbl">English (自分で記入)</span>_____________________</div>`;
    block += `<pre class="th-doc-code">${o.ts?`<span class="c"># ${huntHHMM(s.ts)} · ${esc(s.lang)}</span>\n`:""}${esc(s.query)}</pre>`;
    return block;
  }).join("");

  const tg = (key,label) => `<div class="th-side-toggle" onclick="hToggleReport('${key}')"><span>${label}</span><span class="th-sw ${o[key]?'on':''}"></span></div>`;

  main.innerHTML = `
    <div class="th-report">
      <div class="th-report-doc">
        <div class="th-crumb"><button onclick="hOpen('${h.id}')">← ハントに戻る</button></div>
        <div class="th-doc-title">${esc(h.title)} — Hunt Report</div>
        <div class="th-doc-meta">
          <span>Techniques: ${(h.techniques||[]).join(", ")||"—"}</span>
          <span>Env: ${esc(h.environment)||"—"}</span>
          <span>Status: ${huntStatusMeta(h.status).label}</span>
        </div>
        <div class="th-doc-h">## Hypothesis</div>
        <div class="th-doc-jp">${esc(h.hypothesis)||"—"}</div>
        <div class="th-doc-h">## Investigation</div>
        ${body || "<div class='th-side-empty'>記録がありません</div>"}
        ${o.concl && h.conclusion ? `<div class="th-doc-h">## Conclusion</div><div class="th-doc-jp">${esc(h.conclusion)}</div>` : ""}
      </div>
      <div class="th-report-side">
        <div class="th-side-sec"><h4>出力フォーマット</h4>
          <div class="th-fmt-opt on"><span class="material-symbols-rounded" style="font-size:16px;color:var(--md-primary)">check_box</span>Markdown (.md)</div>
          <div class="th-fmt-opt"><span class="material-symbols-rounded" style="font-size:16px">check_box_outline_blank</span>HTML</div>
        </div>
        <div class="th-side-sec"><h4>含める内容</h4>
          ${tg("jp","所見メモ（日本語）")}
          ${tg("en","英訳欄を作る")}
          ${tg("concl","結論")}
          ${tg("ts","タイムスタンプ")}
        </div>
        <button class="th-dl-btn" onclick="hDownloadReport('md')"><span class="material-symbols-rounded" style="font-size:16px">download</span>レポートを書き出す</button>
        <p class="th-report-hint">AIは使いません。見出し・クエリ・タイムスタンプは自動。英語の地の文は英訳欄に自分で記入します。</p>
      </div>
    </div>
  `;
}
function hToggleReport(key){ window.__hReportOpts[key] = !window.__hReportOpts[key]; renderHuntReport(); }

function hBuildReportMarkdown() {
  const h = huntGet(); if (!h) return "";
  const o = window.__hReportOpts;
  let md = `# ${h.title} — Hunt Report\n\n`;
  md += `- **Techniques:** ${(h.techniques||[]).join(", ")||"—"}\n`;
  md += `- **Data Sources:** ${(h.dataSources||[]).join(", ")||"—"}\n`;
  md += `- **Environment:** ${h.environment||"—"}\n`;
  md += `- **Status:** ${huntStatusMeta(h.status).label}\n\n`;
  md += `## Hypothesis\n\n${h.hypothesis||"—"}\n\n`;
  md += `## Investigation\n\n`;
  h.steps.forEach(s => {
    md += `### [${s.verdict}]\n\n`;
    if (o.jp && s.finding) md += `> **所見:** ${s.finding}\n\n`;
    if (o.en) md += `_English:_ ________________________\n\n`;
    md += "```" + (s.lang||"") + "\n";
    if (o.ts) md += `# ${huntHHMM(s.ts)}\n`;
    md += `${s.query}\n\`\`\`\n\n`;
  });
  if (o.concl && h.conclusion) md += `## Conclusion\n\n${h.conclusion}\n\n`;
  if (o.concl && h.followup)   md += `## Follow-up\n\n${h.followup}\n\n`;
  return md;
}
function hDownloadReport(fmt) {
  const h = huntGet(); if (!h) return;
  const md = hBuildReportMarkdown();
  const name = `hunt_${h.title.replace(/\s+/g,"_").slice(0,30)}_${new Date().toISOString().slice(0,10)}`;
  if (fmt === "md") {
    const a = Object.assign(document.createElement("a"), {
      href: URL.createObjectURL(new Blob([md],{type:"text/markdown"})), download: name+".md" });
    document.body.appendChild(a); a.click(); a.remove();
    toast("📥 レポートを書き出しました");
  }
}

/* ═══════════════════════════════════════════════════
   ATT&CK カバレッジマップ
════════════════════════════════════════════════════ */
const ATTACK_TACTICS = [
  { id:"initial-access", name:"Initial Access", techs:["T1566 Phishing","T1190 Exploit Public App","T1133 External Remote"] },
  { id:"execution",      name:"Execution",      techs:["T1059 Cmd/Script","T1569 System Services","T1204 User Execution","T1053 Scheduled Task"] },
  { id:"persistence",    name:"Persistence",    techs:["T1547 Boot/Logon","T1053 Scheduled Task","T1136 Create Account","T1505 Server Software"] },
  { id:"priv-esc",       name:"Priv Escalation", techs:["T1055 Process Injection","T1068 Exploit PE","T1078 Valid Accounts"] },
  { id:"defense-evasion",name:"Defense Evasion", techs:["T1070 Indicator Removal","T1027 Obfuscation","T1562 Impair Defenses"] },
  { id:"cred-access",    name:"Cred Access",    techs:["T1003 OS Cred Dump","T1110 Brute Force","T1558 Kerberos","T1552 Unsecured Creds"] },
  { id:"discovery",      name:"Discovery",      techs:["T1046 Network Scan","T1087 Account Discovery","T1018 Remote Sys Discovery"] },
  { id:"lateral",        name:"Lateral Move",   techs:["T1021 Remote Services","T1550 Alt Auth Material","T1080 Taint Shared"] },
  { id:"collection",     name:"Collection",     techs:["T1005 Data Local Sys","T1114 Email Collection"] },
  { id:"c2",             name:"C2",             techs:["T1071 App Layer Proto","T1572 Protocol Tunnel","T1090 Proxy","T1105 Ingress Tool"] },
  { id:"exfil",          name:"Exfiltration",   techs:["T1041 Exfil over C2","T1048 Exfil Alt Proto"] },
  { id:"impact",         name:"Impact",         techs:["T1486 Data Encrypted","T1490 Inhibit Recovery"] },
];

function renderCoverage() {
  renderHuntNav("coverage");
  const main = document.getElementById("main");

  // ハント済み・クエリ所持のTechnique集合（サブテクニックは親IDに丸める）
  const parentId = (t) => normTech(t).split(".")[0];
  const hunted = new Set();
  data.hunts.forEach(h => (h.techniques||[]).forEach(t => hunted.add(parentId(t))));
  const queried = new Set();
  data.queries.forEach(q => (q.techniques||[]).forEach(t => queried.add(parentId(t))));

  const cols = ATTACK_TACTICS.map(tac => {
    const cells = tac.techs.map(tech => {
      const tid = tech.split(" ")[0];
      const pid = parentId(tid);
      const isH = hunted.has(pid), isQ = queried.has(pid);
      const cls = (isH && isQ) ? "both" : isH ? "hunted" : isQ ? "query" : "";
      const name = tech.slice(tid.length).trim();
      return `<div class="th-cov-cell ${cls}"><span class="tid">${esc(tid)}</span> ${esc(name)}</div>`;
    }).join("");
    return `<div class="th-cov-col"><h5>${esc(tac.name)}</h5>${cells}</div>`;
  }).join("");

  // 集計
  let total=0, covered=0;
  ATTACK_TACTICS.forEach(tac=>tac.techs.forEach(tech=>{
    total++; const pid=parentId(tech.split(" ")[0]);
    if (hunted.has(pid)||queried.has(pid)) covered++;
  }));

  main.innerHTML = `
    <div class="s-head"><h1>ATT&CK カバレッジ</h1><span class="th-count">${covered} / ${total} Technique をカバー</span></div>
    <div class="th-cov-wrap">
      <div class="th-cov-legend">
        <span><i class="both"></i>ハント＋クエリ両方</span>
        <span><i class="hunted"></i>ハント済み</span>
        <span><i class="query"></i>クエリのみ所持</span>
        <span><i class="none"></i>未対応</span>
      </div>
      <div class="th-cov-matrix">${cols}</div>
      <p class="th-cov-note">ハント（Technique）とクエリ集（Technique）のデータから自動集計。サブテクニック（.001等）は親Techniqueに丸めて表示。手薄な列＝学習の狙い目です。</p>
    </div>
  `;
}

/* ═══════════════════════════════════════════════════
   チートシートからクエリを一括取り込み
════════════════════════════════════════════════════ */

/* クエリ列を含むヘッダのヒント */
const HQ_QUERY_HDR = ["kql","クエリ","query","spl","sigma","yara","es|ql","eql","vql","カスタムクエリ"];
const HQ_PURPOSE_HDR = ["用途","手法","項目","操作","内容","ルールタイプ"];

/* 言語推定 */
function hqGuessLang(body, tabLabel) {
  const b = String(body).toLowerCase();
  const tl = String(tabLabel).toLowerCase();
  if (tl.includes("vql")) return "VQL";
  if (/^\s*get\s/i.test(body) || b.includes('"aggs"') || b.includes('"query"')) return "KQL"; // Elastic DSL
  if (b.includes("event.dataset") || b.includes("winlog.") || b.includes("user_agent.original")) return "KQL";
  if (/^\s*from\s/i.test(body) && body.includes("|")) return "ES|QL";
  if (b.includes("detection:") && b.includes("title:")) return "Sigma";
  if (/\brule\s/.test(b) && b.includes("condition:")) return "YARA";
  if (b.includes("index=") || b.includes("| stats")) return "SPL";
  return "KQL";
}

/* MITRE ATT&CK 対応表から「キーワード→Technique」マップを構築 */
function hqBuildTechMap() {
  const map = []; // { kw:[...], tech:"T1110.001" }
  for (const t of data.tabs) {
    for (const b of t.blocks || []) {
      const hdr = (b.headers||[]).map(h=>String(h).toLowerCase());
      const idIdx = hdr.findIndex(h => h.includes("mitre") || h.includes("id"));
      const nameIdx = hdr.findIndex(h => h.includes("手法") || h.includes("技術") || h.includes("name"));
      if (idIdx < 0) continue;
      for (const r of b.rows || []) {
        const tid = normTech(r[idIdx]);
        if (!/^T\d{4}/.test(tid)) continue;
        const kws = [];
        if (nameIdx >= 0 && r[nameIdx]) kws.push(String(r[nameIdx]).toLowerCase());
        if (kws.length) map.push({ kw: kws, tech: tid });
      }
    }
  }
  return map;
}

/* タイトル・本文からTechniqueを推定（誤爆を避けるためタイトル優先・厳格マッチ） */
function hqInferTech(title, body, techMap) {
  const titleL = String(title).toLowerCase();
  const hay = (title + " " + body).toLowerCase();
  const found = new Set();
  // 対応表マッチ（タイトルに手法名が含まれる場合のみ＝誤爆しにくい）
  for (const m of techMap) {
    for (const kw of m.kw) {
      const key = kw.split(/[\s(（/]/)[0];
      if (key && key.length >= 4 && titleL.includes(key)) { found.add(m.tech); break; }
    }
  }
  // 固定辞書：明確なシグネチャのみ（タイトルor本文）
  const FIX = [
    [/brute\s*force|ブルートフォース|パスワードスプレー|password spray/, "T1110"],
    [/mimikatz|sekurlsa|lsass|資格情報ダンプ|credential dump/, "T1003.001"],
    [/psexec|psexesvc/, "T1569.002"],
    [/pass the hash|\bpth\b/, "T1550.002"],
    [/pass the ticket|\bptt\b/, "T1550.003"],
    [/scheduled task|schtasks/, "T1053.005"],
    [/run\s*key|runkey/, "T1547.001"],
    [/\b7045\b/, "T1543.003"],
    [/sqlmap|sql injection|\bsqli\b/, "T1190"],
    [/shellshock/, "T1059.004"],
    [/\blfi\b|local file inclusion/, "T1083"],
    [/alternate data stream|:helper|\bads\b/, "T1564.004"],
    [/wmic .*process call|wmi lateral/, "T1047"],
    [/dcsync/, "T1003.006"],
    [/certutil/, "T1105"],
    [/rclone/, "T1048"],
    [/webshell|web shell|webシェル/, "T1505.003"],
    [/4624/, "T1078"],
    [/4625/, "T1110"],
  ];
  for (const [re, tech] of FIX) if (re.test(hay)) found.add(tech);
  return [...found];
}

/* インポート実行 */
function hqImportFromCheatsheet() {
  const techMap = hqBuildTechMap();

  // 既存の取り込み済み本文（重複防止）
  const existing = new Set(data.queries.map(q => (q.body||"").trim()));

  const candidates = [];
  for (const t of data.tabs) {
    const label = t.label || "";
    // OSINT Dork タブは検知クエリではないので除外
    if (/検索|search/i.test(label) && t.blocks?.some(b=>/google|shodan/i.test(b.label||""))) {
      // google/shodanブロックのみ除外、他は通す
    }
    for (const b of t.blocks || []) {
      if (/google|shodan/i.test(b.label||"")) continue; // Dork除外
      const hdr = (b.headers||[]).map(h=>String(h).toLowerCase());
      // クエリ列と用途列を特定
      let qcol = hdr.findIndex(h => HQ_QUERY_HDR.some(hint => h.includes(hint)));
      if (qcol < 0) continue;
      let pcol = hdr.findIndex(h => HQ_PURPOSE_HDR.some(hint => h.includes(hint)));
      if (pcol < 0) pcol = 0;
      let ncol = hdr.findIndex((h,i) => i!==qcol && i!==pcol && (h.includes("備考")||h.includes("意味")||h.includes("説明")));

      for (const r of b.rows || []) {
        const body = String(r[qcol] || "").trim();
        if (body.length < 10) continue;               // 短すぎるものは除外
        if (existing.has(body)) continue;              // 重複除外
        // タイトル生成：用途列 → 空なら他の説明列を組み合わせ → ブロック名
        let title = String(r[pcol] || "").trim();
        if (!title) {
          // pcol以外の非クエリ列を左から拾って組み立てる
          const parts = [];
          for (let i=0;i<r.length;i++){
            if (i===qcol) continue;
            const v=String(r[i]||"").trim();
            if (v && v.length<40) parts.push(v);
          }
          title = parts.join(" / ") || b.label || "無題";
        }
        title = title.slice(0, 80);
        const note = ncol >= 0 ? String(r[ncol]||"").trim() : "";
        const lang = hqGuessLang(body, label);
        const techs = hqInferTech(title, body, techMap);
        candidates.push({
          id: uid(), title, lang, body,
          techniques: techs,
          dataSource: "", platform: label.replace(/[🔴🔍🛡️📄\s]/g,"") || "",
          falsePositives: note && note.length < 60 ? note : "",
          reference: "取り込み元: " + label,
          ts: Date.now(),
        });
        existing.add(body);
      }
    }
  }

  if (!candidates.length) {
    toast("取り込める新規クエリはありませんでした");
    return;
  }

  // 確認モーダル（言語別内訳）
  const byLang = {};
  candidates.forEach(c => byLang[c.lang] = (byLang[c.lang]||0)+1);
  const withTech = candidates.filter(c=>c.techniques.length).length;
  const summary = Object.keys(byLang).map(l=>`${l} ${byLang[l]}`).join(" · ");

  openModal("チートシートから取り込み",
    `<p style="font-size:14px;margin-bottom:12px">チートシートのクエリを検知クエリ集に取り込みます。</p>
     <div class="th-import-sum">
       <div class="th-kv"><span class="k">取り込むクエリ</span><span class="v">${candidates.length} 件</span></div>
       <div class="th-kv"><span class="k">言語内訳</span><span class="v">${esc(summary)}</span></div>
       <div class="th-kv"><span class="k">Technique自動付与</span><span class="v">${withTech} 件</span></div>
       <div class="th-kv"><span class="k">既存クエリ</span><span class="v">${data.queries.length} 件（重複は除外済み）</span></div>
     </div>
     <p style="font-size:12px;color:var(--md-on-surface-var);margin-top:12px">取り込み後も個別に編集・削除できます。Technique が付かなかったものは後から手動で追加できます。</p>`,
    () => {
      data.queries.push(...candidates);
      renderQueryLib();
      toast(`✅ ${candidates.length} 件のクエリを取り込みました`);
    },
    { okText: `${candidates.length} 件を取り込む` });
}
