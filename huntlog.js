/* ═══════════════════════════════════════════════════════
   go2 cheatsheet — huntlog.js  (ハントログ = 旧 hunting を刷新)
   Data: data.huntLogs[], data.huntPhases[], data.queries[]

   OSTH / OSDA の2軸で過去のハント/調査ログを蓄積し、試験や実務で
   「兆候 → 次の一手」を引ける形にする（攻略ログと同じ思想）。

   huntLog { id, cert("OSTH"|"OSDA"), name, scope, tags[], status,
             summary, ts, steps[], drawers[] }
   step   { id, phase, lang, query, output, aim, learning, verdict, ts }
   drawer { id, signal, action, ref }   ← 観測(兆候) → 次の調査/対応
   phase  { id, label, color }          ← data.huntPhases を共有

   クエリ集(query) と カバレッジ(coverage) は旧 hunting.js から移植。
   app.js の共通関数（openModal/toast/esc/escAttr/uid/val/copyCell/
   copyToClipboard/emptyState/closeModal）と定数（QUERY_LANGS/
   HUNT_VERDICTS）を再利用。
════════════════════════════════════════════════════════ */

/* ── 定数 ── */
const HG_CERTS = ["OSTH", "OSDA"];
const HG_STATUS = {
  todo: { label: "未着手", color: "#7d9186", cls: "todo" },
  prog: { label: "進行中", color: "#e0a944", cls: "prog" },
  done: { label: "完了",   color: "#3fd07f", cls: "done" },
};

/* ── 移植ヘルパ（query/coverage が使用） ── */
function huntVerdictColor(v){ const m = HUNT_VERDICTS.find(x=>x.id===v); return m ? m.color : "#7d9186"; }
function huntLangClass(lang){ return String(lang).toLowerCase().replace(/[^a-z]/g,""); }
function huntHHMM(ts){ const d = new Date(ts||Date.now()); return `${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}`; }
function normTech(t){ return String(t||"").toUpperCase().replace(/\s+/g,""); }

/* ── ハントログ ヘルパ ── */
function hgLog()          { return data.huntLogs.find(l => l.id === hgLogId); }
function hgStatusMeta(s)  { return HG_STATUS[s] || HG_STATUS.todo; }
function hgPhase(id)      { return data.huntPhases.find(p => p.id === id); }
function hgPhaseColor(id) { const p = hgPhase(id); return p ? p.color : "#7d9186"; }
function hgPhaseLabel(id) { if (!id) return "未分類"; const p = hgPhase(id); return p ? p.label : id; }
function hgLogsForCert()  { return data.huntLogs.filter(l => l.cert === hgCert); }
function hgDrawerCount()  { return data.huntLogs.reduce((n, l) => n + (l.drawers || []).length, 0); }
function hgVerdictMeta(v) { return HUNT_VERDICTS.find(x => x.id === v); }

/* ═══════════════════════════════════════════════════
   共通サイドナビ（ハント / クエリ集 / カバレッジ）
════════════════════════════════════════════════════ */
function renderHuntNav() {
  const nav = document.getElementById("navList");
  if (!nav) return;
  const item = (onclick, icon, label, count, on) => `
    <button class="nav-item ${on ? 'active' : ''}" onclick="${onclick}">
      <span class="material-symbols-rounded nav-icon">${icon}</span>
      <span class="nav-label">${label}</span>
      ${count != null ? `<span class="nav-count">${count}</span>` : ""}
    </button>`;
  nav.innerHTML =
    item("hgGoLogs()",   "travel_explore", "ハントログ", data.huntLogs.length, appMode==="hunt" && hgView!=="drawer") +
    item("hgGoDrawer()", "bolt",           "引き出し",   hgDrawerCount(),       appMode==="hunt" && hgView==="drawer") +
    item("setMode('query')",    "manage_search", "クエリ集",   data.queries.length, appMode==="query") +
    item("setMode('coverage')", "map",           "カバレッジ", null,               appMode==="coverage");
}

function hgGoLogs()   { hgView = "list";  hgLogId = null; if (appMode !== "hunt") setMode("hunt"); else render(); }
function hgGoDrawer() { hgView = "drawer"; if (appMode !== "hunt") setMode("hunt"); else render(); }

/* ═══════════════════════════════════════════════════
   ルーター
════════════════════════════════════════════════════ */
function renderHunt() {
  if (hgView === "drawer") { hgRenderDrawer(); return; }
  if (hgView === "log" && hgLog()) { hgRenderDetail(); return; }
  hgView = "list";
  hgRenderList();
}

/* ═══════════════════════════════════════════════════
   ハントログ一覧（OSTH / OSDA タブ）
════════════════════════════════════════════════════ */
function hgSetCert(c) { hgCert = c; hgView = "list"; hgLogId = null; render(); }

function hgRenderList() {
  renderHuntNav();
  const main = document.getElementById("main");
  const logs = hgLogsForCert();

  const certTabs = HG_CERTS.map(c => {
    const n = data.huntLogs.filter(l => l.cert === c).length;
    return `<button class="tool-cert-tab ${hgCert===c?'on':''}" onclick="hgSetCert('${c}')">${c} <span class="badge">${n}</span></button>`;
  }).join("");

  const done = logs.filter(l => l.status === "done").length;
  const prog = logs.filter(l => l.status === "prog").length;

  const cards = logs.map(l => {
    const st = hgStatusMeta(l.status);
    const tags = (l.tags || []).slice(0, 5).map(t => `<span class="al-tag">${esc(t)}</span>`).join("") || `<span class="al-tag">—</span>`;
    return `
      <div class="al-card" onclick="hgOpen('${l.id}')">
        <div class="al-card-top">
          <span class="al-status ${st.cls}">${st.label}</span>
          <span class="al-card-cert">${esc(l.cert)}</span>
          <button class="al-card-del" onclick="event.stopPropagation();hgDelLog('${l.id}')" title="このログを削除"><span class="material-symbols-rounded">delete</span></button>
        </div>
        <h3 class="al-card-name">${esc(l.name)}</h3>
        ${l.scope ? `<div class="al-card-ip">${esc(l.scope)}</div>` : ""}
        ${l.summary ? `<div class="al-card-sum">${esc(l.summary)}</div>` : ""}
        <div class="al-card-tags">${tags}</div>
        <div class="al-card-foot">
          <span><b>${l.steps.length}</b> ステップ</span>
          <span><b>${(l.drawers||[]).length}</b> 引き出し</span>
        </div>
      </div>`;
  }).join("");

  main.innerHTML = `
    <div class="s-head">
      <h1>ハントログ</h1>
      <span class="th-count">${hgCert} · ${logs.length} 件 · 完了 ${done} · 進行中 ${prog}</span>
      <button class="th-import-btn" onclick="hgImport()"><span class="material-symbols-rounded">data_object</span>JSONで取り込み</button>
      <button class="th-add" onclick="hgAddLog()"><span class="material-symbols-rounded">add</span>ログを追加</button>
    </div>
    <div class="tool-cert-tabs">${certTabs}</div>
    ${logs.length ? `<div class="al-grid">${cards}</div>`
      : emptyState("travel_explore", `${hgCert} のハントログがまだありません`,
          "「ログを追加」または「JSONで取り込み」で登録できます")}
  `;
}

function hgOpen(id) { hgLogId = id; hgView = "log"; hgPhaseFilter = null; render(); document.getElementById("main").scrollTop = 0; }

/* ═══════════════════════════════════════════════════
   ハントログ詳細（logbook 式：クエリ + 所見の記録）
════════════════════════════════════════════════════ */
function hgRenderDetail() {
  renderHuntNav();
  const main = document.getElementById("main");
  const l = hgLog();
  if (!l) { hgView = "list"; hgRenderList(); return; }
  const st = hgStatusMeta(l.status);

  const curP = hgInputPhase || data.huntPhases[0]?.id || "";
  const curLang = hgInputLang || QUERY_LANGS[0];
  const curVerdict = hgInputVerdict || "";

  // フェーズ別カウント（フィルタ）
  const counts = {};
  l.steps.forEach(s => counts[s.phase || "__none"] = (counts[s.phase || "__none"] || 0) + 1);
  const phaseTabs = data.huntPhases.map(p => `
    <button class="th-vchip ${hgPhaseFilter===p.id?'on':''}" onclick="hgSetPhaseFilter('${p.id}')" style="${hgPhaseFilter===p.id?`border-color:${p.color};color:${p.color}`:''}">${esc(p.label)} <span class="cnt">${counts[p.id]||0}</span></button>`).join("");
  const noneCount = counts["__none"] || 0;
  const noneTab = noneCount ? `<button class="th-vchip ${hgPhaseFilter==='__none'?'on':''}" onclick="hgSetPhaseFilter('__none')">未分類 <span class="cnt">${noneCount}</span></button>` : "";

  // 記入フォーム用チップ
  const composerPhases = data.huntPhases.map(p =>
    `<button class="al-cphase ${curP===p.id?'on':''}" data-ph="${p.id}" onclick="hgPickPhase('${p.id}')" style="--pc:${p.color}">${esc(p.label)}</button>`).join("");
  const composerLangs = QUERY_LANGS.map(lg =>
    `<button class="hl-lchip ${curLang===lg?'on':''}" data-lg="${escAttr(lg)}" onclick="hgPickLang('${escAttr(lg)}')">${esc(lg)}</button>`).join("");
  const composerVerdicts = HUNT_VERDICTS.map(v =>
    `<button class="hl-vchip ${curVerdict===v.id?'on':''}" data-vd="${v.id}" onclick="hgPickVerdict('${v.id}')" style="--vc:${v.color}">${esc(v.label)}</button>`).join("");

  // ステップ一覧
  let items = l.steps.map((x, i) => ({ x, i }));
  if (hgPhaseFilter === "__none") items = items.filter(o => !o.x.phase);
  else if (hgPhaseFilter) items = items.filter(o => o.x.phase === hgPhaseFilter);

  const timeline = items.length ? items.map(({ x, i }) => {
    const c = hgPhaseColor(x.phase);
    const vm = hgVerdictMeta(x.verdict);
    return `
      <div class="al-step">
        <div class="al-step-side">
          <span class="al-phase-badge" style="background:${c}22;color:${c}">${esc(hgPhaseLabel(x.phase))}</span>
          <span class="al-step-idx">#${i+1}</span>
        </div>
        <div class="al-step-body">
          <div class="hl-badges">
            ${x.lang ? `<span class="hl-lang lang-${huntLangClass(x.lang)}">${esc(x.lang)}</span>` : ""}
            ${vm ? `<span class="hl-verdict" style="background:${vm.color}22;color:${vm.color}">${esc(vm.label)}</span>` : ""}
          </div>
          <div class="al-cmd">${esc(x.query) || "<span style='color:var(--md-on-surface-var)'>（クエリなし）</span>"}
            <button class="al-copy" onclick="copyToClipboard(${escAttr(JSON.stringify(x.query))});toast('📋 コピーしました')" title="コピー"><span class="material-symbols-rounded">content_copy</span></button>
          </div>
          ${x.output ? `<div class="al-output">${esc(x.output)}</div>` : ""}
          ${x.aim ? `<div class="al-line aim"><span class="material-symbols-rounded ic">flag</span><span>${esc(x.aim)}</span></div>` : ""}
          ${x.learning && x.learning !== "—" ? `<div class="al-line learn"><span class="material-symbols-rounded ic">lightbulb</span><span>${esc(x.learning)}</span></div>` : ""}
          <div class="al-step-acts">
            <button class="al-act-btn edit" onclick="hgEditStep(${i})"><span class="material-symbols-rounded">edit</span>編集</button>
            <button class="al-act-btn" onclick="hgStepToDrawer(${i})"><span class="material-symbols-rounded">bolt</span>引き出しに追加</button>
            <button class="al-act-btn" onclick="hgSaveToLib(${i})" title="クエリ集へ保存"><span class="material-symbols-rounded">bookmark_add</span>クエリ集へ</button>
            <button class="al-act-ico" onclick="hgMoveStep(${i},-1)" title="上へ" ${i===0?'disabled':''}><span class="material-symbols-rounded">arrow_upward</span></button>
            <button class="al-act-ico" onclick="hgMoveStep(${i},1)" title="下へ" ${i===l.steps.length-1?'disabled':''}><span class="material-symbols-rounded">arrow_downward</span></button>
            <button class="al-act-ico danger" onclick="hgDelStep(${i})" title="削除"><span class="material-symbols-rounded">delete</span></button>
          </div>
        </div>
      </div>`;
  }).join("") : `<div class="al-empty-steps"><span class="material-symbols-rounded">edit_note</span>まだステップがありません。<b>上の「ステップを記録」</b>から追加します。</div>`;

  main.innerHTML = `
    <div class="al-td">
      <div class="al-td-main">
        <div class="th-crumb"><button onclick="hgGoLogs()">ハントログ</button> / <b>${esc(l.name)}</b></div>
        <div class="al-td-title"><h1>${esc(l.name)}</h1>
          <span class="al-status ${st.cls}">${st.label}</span>
          <span class="al-card-cert">${esc(l.cert)}</span></div>
        <div class="al-td-meta">
          <span>対象: <b>${esc(l.scope)||"—"}</b></span>
        </div>

        <div class="al-summary">
          <span class="al-summary-lbl">概要 / 仮説 (TL;DR)</span>
          <button class="al-summary-edit" onclick="hgEditSummary()" title="概要を編集"><span class="material-symbols-rounded">edit</span></button>
          <div class="al-summary-text">${esc(l.summary) || "（未記入）右上の鉛筆から書けます"}</div>
        </div>

        <!-- ステップ記入フォーム -->
        <div class="al-composer">
          <div class="al-composer-head">
            <span class="al-composer-title"><span class="material-symbols-rounded">add_circle</span>ステップを記録</span>
            <span class="al-composer-sub">フェーズ・言語を選んで記入 → 追加</span>
          </div>
          <div class="al-composer-phases" id="hgComposerPhases">${composerPhases}</div>
          <div class="hl-chiprow" id="hgComposerLangs">${composerLangs}</div>
          <textarea id="hgCmpQuery" class="al-cmp-cmd" rows="2" placeholder="検知 / ハントクエリ（KQL, SPL, ES|QL, Sigma…）（Ctrl+Enter で追加）" onkeydown="if((event.ctrlKey||event.metaKey)&&event.key==='Enter')hgComposerAdd()"></textarea>
          <textarea id="hgCmpOut" class="al-cmp-out" rows="1" placeholder="所見・結果（ヒット件数、観測した挙動など）"></textarea>
          <div class="al-cmp-grid">
            <input id="hgCmpAim" class="al-cmp-in" placeholder="🚩 仮説・狙い（何を確かめるか）">
            <input id="hgCmpLearn" class="al-cmp-in" placeholder="💡 学び（次に活かす気づき）">
          </div>
          <div class="hl-verdict-row">
            <span class="hl-verdict-lbl">判定:</span>
            <div class="hl-chiprow" id="hgComposerVerdicts">
              <button class="hl-vchip ${!curVerdict?'on':''}" data-vd="" onclick="hgPickVerdict('')" style="--vc:#7d9186">なし</button>
              ${composerVerdicts}
            </div>
          </div>
          <div class="al-cmp-actions">
            <button class="al-cmp-add" onclick="hgComposerAdd()"><span class="material-symbols-rounded">add</span>ステップを追加</button>
          </div>
        </div>

        <div class="al-steps-head">
          <span class="al-steps-title">記録（${l.steps.length}）</span>
          <div class="th-vchips">
            <button class="th-vchip ${!hgPhaseFilter?'on':''}" onclick="hgSetPhaseFilter(null)">すべて</button>
            ${phaseTabs}${noneTab}
            <button class="al-phase-edit" onclick="hgEditPhases()"><span class="material-symbols-rounded" style="font-size:15px">tune</span>フェーズ編集</button>
          </div>
        </div>

        <div class="al-steps">${timeline}</div>
      </div>
      <div class="al-td-side">
        <div class="th-side-sec"><h4>ログ情報</h4>
          <div class="th-kv"><span class="k">資格</span><span class="v">${esc(l.cert)}</span></div>
          <div class="th-kv"><span class="k">対象</span><span class="v">${esc(l.scope)||"—"}</span></div>
          <div class="th-kv"><span class="k">状態</span><span class="v" style="color:${st.color}">${st.label}</span></div>
          <div class="th-kv"><span class="k">ステップ</span><span class="v">${l.steps.length}</span></div>
          <button class="al-side-btn" onclick="hgEditMeta()"><span class="material-symbols-rounded" style="font-size:15px">edit</span>情報を編集</button>
          <button class="al-side-btn danger" onclick="hgDelLog('${l.id}')"><span class="material-symbols-rounded" style="font-size:15px">delete</span>このログを削除</button>
        </div>
        <div class="th-side-sec"><h4>引き出し（このハント）</h4>
          <div class="al-side-drawers">${(l.drawers||[]).length ? (l.drawers||[]).map((d,di)=>`<div class="al-side-drawer"><span class="sig">${esc(d.signal)||"（兆候未記入）"}</span><button class="al-side-drawer-del" onclick="hgDelDrawer(${di})" title="削除"><span class="material-symbols-rounded" style="font-size:13px">close</span></button></div>`).join("") : "<span style='color:var(--md-on-surface-var);font-size:12px'>各ステップの「引き出しに追加」で登録</span>"}</div>
        </div>
      </div>
    </div>
  `;
}

/* ── フィルタ / 記入フォーム ── */
function hgSetPhaseFilter(id) { hgPhaseFilter = id; hgRenderDetail(); }
function hgPickPhase(id) {
  hgInputPhase = id;
  document.querySelectorAll("#hgComposerPhases .al-cphase").forEach(b => b.classList.toggle("on", b.dataset.ph === id));
}
function hgPickLang(lg) {
  hgInputLang = lg;
  document.querySelectorAll("#hgComposerLangs .hl-lchip").forEach(b => b.classList.toggle("on", b.dataset.lg === lg));
}
function hgPickVerdict(v) {
  hgInputVerdict = v;
  document.querySelectorAll("#hgComposerVerdicts .hl-vchip").forEach(b => b.classList.toggle("on", b.dataset.vd === v));
}

function hgComposerAdd() {
  const l = hgLog(); if (!l) return;
  const query = (document.getElementById("hgCmpQuery")?.value || "").trim();
  const out   = (document.getElementById("hgCmpOut")?.value   || "").trim();
  const aim   = (document.getElementById("hgCmpAim")?.value   || "").trim();
  const learn = (document.getElementById("hgCmpLearn")?.value || "").trim();
  if (!query && !out && !aim) { toast("クエリか所見を入力してください"); return; }
  const phase = hgInputPhase || data.huntPhases[0]?.id || "";
  const lang = hgInputLang || QUERY_LANGS[0];
  l.steps.push({ id: uid(), phase, lang, query, output: out, aim, learning: learn, verdict: hgInputVerdict || "", ts: Date.now() });
  if (l.status === "todo") l.status = "prog";
  hgRenderDetail();
  setTimeout(() => document.getElementById("hgCmpQuery")?.focus(), 30);
}

function hgEditSummary() {
  const l = hgLog(); if (!l) return;
  openModal("概要 / 仮説 (TL;DR) を編集",
    `<label>概要・仮説</label><textarea id="hgSumOnly" style="min-height:120px" placeholder="何を疑い、どう調べ、どう結論したか">${esc(l.summary)}</textarea>`,
    () => { l.summary = val("hgSumOnly"); hgRenderDetail(); toast("✅ 更新しました"); });
}

/* ── ステップ 編集/移動/削除 ── */
function hgEditStep(i) {
  const l = hgLog(); const x = l.steps[i]; if (!x) return;
  const pOpts = data.huntPhases.map(p => `<option value="${p.id}" ${x.phase===p.id?'selected':''}>${esc(p.label)}</option>`).join("") + `<option value="" ${!x.phase?'selected':''}>（未分類）</option>`;
  const lOpts = QUERY_LANGS.map(lg => `<option value="${escAttr(lg)}" ${x.lang===lg?'selected':''}>${esc(lg)}</option>`).join("");
  const vOpts = `<option value="" ${!x.verdict?'selected':''}>なし</option>` + HUNT_VERDICTS.map(v => `<option value="${v.id}" ${x.verdict===v.id?'selected':''}>${esc(v.label)}</option>`).join("");
  openModal("ステップを編集",
    `<label>フェーズ</label><select id="hgePhase">${pOpts}</select>
     <label>言語</label><select id="hgeLang">${lOpts}</select>
     <label>クエリ</label><textarea id="hgeQuery">${esc(x.query)}</textarea>
     <label>所見・結果</label><textarea id="hgeOut">${esc(x.output)}</textarea>
     <label>仮説・狙い</label><input id="hgeAim" value="${esc(x.aim)}">
     <label>学び</label><input id="hgeLearn" value="${esc(x.learning)}">
     <label>判定</label><select id="hgeVerdict">${vOpts}</select>`,
    () => {
      x.phase = val("hgePhase"); x.lang = val("hgeLang"); x.query = val("hgeQuery");
      x.output = val("hgeOut"); x.aim = val("hgeAim"); x.learning = val("hgeLearn"); x.verdict = val("hgeVerdict");
      hgRenderDetail(); toast("✅ 更新しました");
    });
}
function hgDelStep(i) { const l = hgLog(); if (!l.steps[i]) return; if (!confirm("このステップを削除しますか？")) return; l.steps.splice(i, 1); hgRenderDetail(); }
function hgMoveStep(i, d) { const l = hgLog(); const j = i + d; if (j < 0 || j >= l.steps.length) return; [l.steps[i], l.steps[j]] = [l.steps[j], l.steps[i]]; hgRenderDetail(); }

/* ── ステップのクエリをクエリ集へ保存 ── */
function hgSaveToLib(i) {
  const l = hgLog(); const x = l.steps[i]; if (!x || !x.query) { toast("クエリが空です"); return; }
  openModal("クエリ集へ保存",
    `<label>タイトル</label><input id="hgLibTitle" value="${esc(x.aim || l.name)}" placeholder="このクエリの名前">
     <label>言語</label><input id="hgLibLang" value="${esc(x.lang||'KQL')}">
     <label>データソース（任意）</label><input id="hgLibDs" placeholder="例: Microsoft Defender / Sysmon">
     <p class="al-modal-note">クエリ集（検知クエリ・ライブラリ）に登録します。</p>`,
    () => {
      data.queries.push({ id: uid(), title: val("hgLibTitle") || "無題のクエリ", lang: val("hgLibLang") || "KQL",
        body: x.query, techniques: [], dataSource: val("hgLibDs"), platform: "", falsePositives: "", reference: "", ts: Date.now() });
      toast("✅ クエリ集に保存しました");
    });
}

/* ── 引き出し（兆候 → 次の一手）へ昇格 ── */
function hgStepToDrawer(i) {
  const l = hgLog(); const x = l.steps[i]; if (!x) return;
  l.drawers = l.drawers || [];
  openModal("引き出しに追加（兆候 → 次の一手）",
    `<label>兆候 (signal) — 何を観測したら</label>
     <input id="hgSig" value="${esc(x.output || x.aim || "")}" placeholder="例: 短時間に4625が多発 / lsass への異常アクセス">
     <label>次の一手 (action) — 何を調べる/対応する</label>
     <textarea id="hgAct" placeholder="例: 送信元IPで絞り、成功4624と突合。横展開の有無を確認">${esc(x.query)}</textarea>
     <p class="al-modal-note">試験・実務で「見えている状況」を検索して次の手を引きます。</p>`,
    () => {
      const sig = val("hgSig").trim(), act = val("hgAct").trim();
      if (!sig && !act) { toast("兆候か一手を入力してください"); return; }
      l.drawers.push({ id: uid(), signal: sig, action: act, ref: l.name });
      hgRenderDetail(); toast("⚡ 引き出しに追加しました");
    });
}
function hgDelDrawer(di) { const l = hgLog(); if (!(l.drawers||[])[di]) return; l.drawers.splice(di, 1); hgRenderDetail(); }

/* ── メタ 編集/追加/削除 ── */
function hgEditMeta() {
  const l = hgLog(); if (!l) return;
  const certOpts = HG_CERTS.map(c => `<option value="${c}" ${l.cert===c?'selected':''}>${c}</option>`).join("");
  const statOpts = Object.keys(HG_STATUS).map(k => `<option value="${k}" ${l.status===k?'selected':''}>${HG_STATUS[k].label}</option>`).join("");
  openModal("ログ情報を編集",
    `<label>名前</label><input id="hgName" value="${esc(l.name)}">
     <label>資格</label><select id="hgCertSel">${certOpts}</select>
     <label>対象・範囲（環境 / データソース）</label><input id="hgScope" value="${esc(l.scope)}">
     <label>タグ（スペース区切り）</label><input id="hgTags" value="${esc((l.tags||[]).join(' '))}">
     <label>状態</label><select id="hgStat">${statOpts}</select>
     <label>概要 / 仮説 (TL;DR)</label><textarea id="hgSum">${esc(l.summary)}</textarea>`,
    () => {
      l.name = val("hgName") || "無題のハント"; l.cert = val("hgCertSel") || "OSTH";
      l.scope = val("hgScope"); l.tags = val("hgTags").split(/\s+/).filter(Boolean);
      l.status = val("hgStat"); l.summary = val("hgSum");
      hgRenderDetail(); toast("✅ 更新しました");
    });
}
function hgAddLog() {
  const certOpts = HG_CERTS.map(c => `<option value="${c}" ${hgCert===c?'selected':''}>${c}</option>`).join("");
  openModal("ログを追加",
    `<label>名前</label><input id="hgName" placeholder="例: 不審なPowerShell実行のハント">
     <label>資格</label><select id="hgCertSel">${certOpts}</select>
     <label>対象・範囲（任意）</label><input id="hgScope" placeholder="例: EDR / Windowsイベントログ">`,
    () => {
      const l = { id: uid(), cert: val("hgCertSel") || hgCert, name: val("hgName") || "無題のハント",
        scope: val("hgScope"), status: "prog", tags: [], summary: "", steps: [], drawers: [], ts: Date.now() };
      data.huntLogs.push(l);
      hgCert = l.cert; hgOpen(l.id);
      toast("✅ ログを追加しました");
    });
}
function hgDelLog(id) {
  const l = data.huntLogs.find(x => x.id === id); if (!l) return;
  if (!confirm(`「${l.name}」を削除しますか？`)) return;
  data.huntLogs = data.huntLogs.filter(x => x.id !== id);
  hgGoLogs(); toast("🗑 削除しました");
}

/* ═══════════════════════════════════════════════════
   フェーズ編集（data.huntPhases を共有）
════════════════════════════════════════════════════ */
function hgEditPhases() {
  const rows = data.huntPhases.map((p, i) => {
    const cnt = data.huntLogs.reduce((a, l) => a + l.steps.filter(s => s.phase === p.id).length, 0);
    return `<div class="web-vtedit-row">
      <span class="web-vt-swatch" style="background:${p.color}"></span>
      <span class="web-vt-name">${esc(p.label)}</span>
      <span class="web-vt-cnt">${cnt} 件</span>
      <button class="web-vt-act" onclick="hgPhaseRename('${p.id}')">名前</button>
      <button class="web-vt-act" onclick="hgPhaseColor('${p.id}')">色</button>
      <button class="web-vt-act" onclick="hgPhaseMove('${p.id}',-1)" ${i===0?'disabled':''}>↑</button>
      <button class="web-vt-act" onclick="hgPhaseMove('${p.id}',1)" ${i===data.huntPhases.length-1?'disabled':''}>↓</button>
      <button class="web-vt-act danger" onclick="hgPhaseDelete('${p.id}')">削除</button>
    </div>`;
  }).join("");
  openModal("フェーズを編集",
    `<div class="web-vtedit-list">${rows}</div>
     <button class="web-vt-add" onclick="hgPhaseAdd()"><span class="material-symbols-rounded" style="font-size:16px">add</span>フェーズを追加</button>
     <p class="web-vtedit-note">収集 / 仮説 / 調査 / 検知 / 対応 を基本にしています。削除してもステップは残ります（未分類になります）。</p>`,
    null, { okText: "閉じる", onOk: () => { closeModal(); if (appMode === "hunt") render(); } });
}
function hgPhaseAdd() { data.huntPhases.push({ id: uid(), label: "新フェーズ", color: VT_PALETTE[data.huntPhases.length % VT_PALETTE.length] }); hgEditPhases(); }
function hgPhaseRename(id) { const p = hgPhase(id); if (!p) return; const n = prompt("フェーズ名", p.label); if (n && n.trim()) { p.label = n.trim(); hgEditPhases(); } }
function hgPhaseColor(id) { const p = hgPhase(id); if (!p) return; const c = VT_PALETTE.indexOf(p.color); p.color = VT_PALETTE[(c+1)%VT_PALETTE.length]; hgEditPhases(); }
function hgPhaseMove(id, dir) { const i = data.huntPhases.findIndex(p=>p.id===id); const j=i+dir; if(i<0||j<0||j>=data.huntPhases.length)return; [data.huntPhases[i],data.huntPhases[j]]=[data.huntPhases[j],data.huntPhases[i]]; hgEditPhases(); }
function hgPhaseDelete(id) { const p = hgPhase(id); if (!p) return; if (!confirm(`フェーズ「${p.label}」を削除しますか？（ステップは残ります）`)) return; data.huntPhases = data.huntPhases.filter(x=>x.id!==id); hgEditPhases(); }

/* ═══════════════════════════════════════════════════
   引き出し（兆候 → 次の一手）— 全ハント横断・検索
════════════════════════════════════════════════════ */
function hgRenderDrawer() {
  renderHuntNav();
  const main = document.getElementById("main");
  const q = (hgDrawerQuery || "").toLowerCase();

  const all = [];
  data.huntLogs.forEach(l => (l.drawers || []).forEach((d) => all.push({ ...d, src: l.name, cert: l.cert, logId: l.id })));
  let list = all;
  if (q) list = all.filter(d => (d.signal + " " + d.action + " " + d.src).toLowerCase().includes(q));

  const cards = list.map(d => `
    <div class="al-drawer-card">
      <div class="al-dc-left">
        <div class="al-dc-signal"><span class="material-symbols-rounded">sensors</span><span>${esc(d.signal)||"（兆候未記入）"}</span></div>
        <span class="al-dc-src" onclick="hgOpen('${d.logId}')">from ${esc(d.src)} · ${esc(d.cert)}</span>
      </div>
      <div class="al-dc-arrow"><span class="material-symbols-rounded">arrow_forward</span></div>
      <div class="al-dc-action">${esc(d.action)}
        <button class="al-copy inline" onclick="copyToClipboard(${escAttr(JSON.stringify(d.action))});toast('📋 コピーしました')" title="コピー"><span class="material-symbols-rounded">content_copy</span></button>
      </div>
    </div>`).join("");

  main.innerHTML = `
    <div class="s-head">
      <h1>引き出し</h1>
      <span class="th-count">${list.length} / ${all.length} 件</span>
    </div>
    <div class="al-drawer-hero"><b>兆候 → 次の一手。</b>上の検索バー、または下の一覧から「観測している状況」を引いて次の調査・対応を確認します。各ハントログのステップの<b>「引き出しに追加」</b>で蓄積されます。</div>
    ${list.length ? `<div class="al-drawer-list">${cards}</div>`
      : emptyState("bolt", q ? "一致する引き出しがありません" : "まだ引き出しがありません",
          q ? "別のキーワードでお試しください" : "ハントログのステップから「引き出しに追加」で登録")}
  `;
}

function renderHuntSearch() {
  const q = document.getElementById("searchInput").value.trim();
  if (!q) { searchMode = false; render(); return; }
  hgDrawerQuery = q;
  hgView = "drawer";
  searchMode = false;
  render();
}

/* ═══════════════════════════════════════════════════
   JSON インポート（md を Claude に渡して JSON 化 → 取り込み）
   step   { phase, lang, query, output, aim, learning, verdict }
   drawer { signal, action }
════════════════════════════════════════════════════ */
function hgCoerceLog(o) {
  if (!o || typeof o !== "object") return null;
  const phaseIds = new Set(data.huntPhases.map(p => p.id));
  const langOk = new Set(QUERY_LANGS);
  const verdictOk = new Set(HUNT_VERDICTS.map(v => v.id));
  const cert = (o.cert === "OSDA") ? "OSDA" : "OSTH";
  const validStatus = { todo: 1, prog: 1, done: 1 };
  const steps = Array.isArray(o.steps) ? o.steps.map(s => ({
    id: uid(),
    phase: phaseIds.has(s && s.phase) ? s.phase : "",
    lang: langOk.has(s && s.lang) ? s.lang : "KQL",
    query: String((s && (s.query ?? s.command)) || ""),
    output: String((s && (s.output ?? s.finding)) || ""),
    aim: String((s && (s.aim ?? s.hypothesis)) || ""),
    learning: String((s && s.learning) || ""),
    verdict: verdictOk.has(s && s.verdict) ? s.verdict : "",
    ts: Date.now(),
  })) : [];
  const drawers = Array.isArray(o.drawers) ? o.drawers.map(d => ({
    id: uid(), signal: String((d && d.signal) || ""), action: String((d && d.action) || ""), ref: String(o.name || ""),
  })) : [];
  return {
    id: uid(), cert,
    name: String(o.name || "取り込んだハントログ"),
    scope: String(o.scope || ""),
    status: validStatus[o.status] ? o.status : "prog",
    tags: Array.isArray(o.tags) ? o.tags.map(String) : [],
    summary: String(o.summary || ""),
    steps, drawers, ts: Date.now(),
  };
}
function hgImport() {
  const certOpts = HG_CERTS.map(c => `<option value="${c}" ${hgCert===c?'selected':''}>${c}</option>`).join("");
  const sample = `{
  "cert": "OSTH",
  "name": "不審なPowerShellのハント",
  "scope": "EDR / Windowsイベント",
  "status": "done",
  "tags": ["T1059.001", "PowerShell"],
  "summary": "…",
  "steps": [
    { "phase": "hunt", "lang": "KQL", "query": "DeviceProcessEvents | where …", "output": "3件ヒット", "aim": "難読化された実行を探す", "learning": "…", "verdict": "suspicious" }
  ],
  "drawers": [
    { "signal": "エンコードされた -enc コマンド", "action": "デコードして親プロセスと突合、横展開を確認" }
  ]
}`;
  openModal("JSON で取り込み",
    `<label>資格</label><select id="hgImpCert">${certOpts}</select>
     <label>ハントログ JSON を貼り付け</label>
     <textarea id="hgImpJson" style="min-height:240px;font-family:var(--font-mono);font-size:12px" placeholder='${esc(sample)}'></textarea>
     <p class="al-modal-note">md を Claude に渡して JSON 化した内容を貼り付けます。単体 / 配列 / {"huntLogs":[…]} に対応。phase は <b>${esc(data.huntPhases.map(p=>p.id).join(" / "))}</b>、lang は ${esc(QUERY_LANGS.join(" / "))} のいずれか。</p>`,
    () => {
      let parsed;
      try { parsed = JSON.parse(val("hgImpJson").trim()); }
      catch (e) { toast("⚠ JSON を解析できません: " + e.message); return; }
      const arr = Array.isArray(parsed) ? parsed
                : (parsed && Array.isArray(parsed.huntLogs)) ? parsed.huntLogs
                : [parsed];
      const csel = val("hgImpCert");
      const logs = arr.map(o => { const c = hgCoerceLog(o); if (c && !o.cert) c.cert = csel; return c; }).filter(Boolean);
      if (!logs.length) { toast("取り込めるハントログがありません"); return; }
      data.huntLogs.push(...logs);
      hgCert = logs[0].cert;
      if (logs.length === 1) hgOpen(logs[0].id);
      else { hgView = "list"; render(); }
      toast(`✅ ${logs.length} 件のハントログを取り込みました`);
    },
    { okText: "取り込む" });
}

/* ═══════════════════════════════════════════════════════════════════
   ▼▼▼ 以下、旧 hunting.js から移植：クエリ集 & カバレッジ ▼▼▼
═══════════════════════════════════════════════════════════════════ */
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
