/* ═══════════════════════════════════════════════════════
   go2 cheatsheet — dashboards.js  (ダッシュボード保管)
   Data: data.dashboards[]
   dashboard { id,name,platform,format,description,certs[],content,size,meta,ts }
     platform: "kibana" | "splunk"
   Kibana/Splunk のダッシュボード定義ファイルを丸ごと保管し、
   必要な時に元の形式でダウンロードして使う。

   app.js の共通関数（openModal/toast/esc/uid/val）と
   定数（DASH_PLATFORMS）を再利用。
════════════════════════════════════════════════════════ */

function dashPlatMeta(p){ return DASH_PLATFORMS[p] || DASH_PLATFORMS.kibana; }
function dashFmtSize(bytes){
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024*1024) return (bytes/1024).toFixed(1) + " KB";
  return (bytes/1024/1024).toFixed(2) + " MB";
}

/* ファイル内容から統計を解析（Kibana ndjson / Splunk xml） */
function dashAnalyze(content, platform) {
  const meta = {};
  if (platform === "kibana") {
    // ndjson: 各行のtypeを集計
    const counts = {};
    content.split("\n").forEach(line => {
      line = line.trim(); if (!line) return;
      try { const o = JSON.parse(line); if (o.type) counts[o.type] = (counts[o.type]||0)+1; } catch(e){}
    });
    if (counts.dashboard) meta.dashboards = counts.dashboard;
    if (counts.search) meta.searches = counts.search;
    if (counts.visualization) meta.visualizations = counts.visualization;
    if (counts["index-pattern"]) meta.indexPatterns = counts["index-pattern"];
  } else if (platform === "splunk") {
    // Splunk XML: <dashboard> / <panel> / <search> の数をざっくり
    const dash = (content.match(/<dashboard/gi)||[]).length + (content.match(/<form/gi)||[]).length;
    const panels = (content.match(/<panel/gi)||[]).length;
    const searches = (content.match(/<search/gi)||[]).length;
    if (dash) meta.dashboards = dash;
    if (panels) meta.panels = panels;
    if (searches) meta.searches = searches;
  }
  return Object.keys(meta).length ? meta : null;
}

function renderDashNav() {
  const nav = document.getElementById("navList");
  if (!nav) return;
  nav.innerHTML = `
    <button class="nav-item active" onclick="setMode('dashboards')">
      <span class="material-symbols-rounded nav-icon">dashboard</span>
      <span class="nav-label">ダッシュボード</span>
      <span class="nav-count">${data.dashboards.length}</span>
    </button>`;
}

/* ═══════════════════════════════════════════════════
   一覧
════════════════════════════════════════════════════ */
function renderDashboards() {
  renderDashNav();
  const main = document.getElementById("main");

  let list = data.dashboards.slice();
  if (dashPlatFilter !== "all") list = list.filter(db => db.platform === dashPlatFilter);

  const plats = [...new Set(data.dashboards.map(db=>db.platform))];
  const platChip = (id, label) => {
    const n = id==="all" ? data.dashboards.length : data.dashboards.filter(db=>db.platform===id).length;
    return `<button class="th-chip ${dashPlatFilter===id?'on':''}" onclick="dSetPlat('${id}')">${esc(label)} <span style="opacity:.6">${n}</span></button>`;
  };
  const chips = platChip("all","すべて") + plats.map(p=>platChip(p, dashPlatMeta(p).label)).join("");

  const cards = list.map(renderDashCard).join("");

  main.innerHTML = `
    <div class="s-head">
      <h1>ダッシュボード</h1>
      <span class="th-count">${data.dashboards.length} 件</span>
      <button class="th-add" onclick="dAddDashboard()"><span class="material-symbols-rounded">upload_file</span>ダッシュボードを追加</button>
    </div>
    <div class="th-filters">${chips}</div>
    ${list.length ? `<div class="dash-grid">${cards}</div>`
      : emptyState("dashboard", data.dashboards.length?"該当するダッシュボードがありません":"ダッシュボードがまだありません",
          data.dashboards.length?"フィルタを変えてください":"「ダッシュボードを追加」でKibana/Splunkの定義ファイルを保管できます")}
  `;
}

function renderDashCard(db) {
  const pm = dashPlatMeta(db.platform);
  const certs = (db.certs||[]).map(c=>`<span class="tool-cert-mini">${esc(c)}</span>`).join("");
  const metaChips = db.meta ? Object.keys(db.meta).map(k=>{
    const labels={dashboards:"ダッシュボード",searches:"検索",visualizations:"可視化",indexPatterns:"index-pattern",panels:"パネル"};
    return `<span class="dash-meta-chip">${labels[k]||k}: ${db.meta[k]}</span>`;
  }).join("") : "";
  return `
    <div class="dash-card">
      <div class="dash-card-top">
        <span class="dash-plat" style="background:${pm.color}22;color:${pm.color}">${esc(pm.label)}</span>
        <span class="dash-fmt">.${esc(db.format)}</span>
        <span class="dash-size">${dashFmtSize(db.size)}</span>
      </div>
      <h3 class="dash-name">${esc(db.name)}</h3>
      ${db.description?`<div class="dash-desc">${esc(db.description)}</div>`:""}
      ${metaChips?`<div class="dash-meta-row">${metaChips}</div>`:""}
      <div class="dash-card-foot">
        ${certs}
        <span class="dash-actions">
          <button class="dash-preview-btn" onclick="dPreview('${db.id}')"><span class="material-symbols-rounded" style="font-size:14px">visibility</span>中身</button>
          <button class="dash-edit-btn" onclick="dEdit('${db.id}')"><span class="material-symbols-rounded" style="font-size:14px">edit</span></button>
          <button class="dash-dl-btn" onclick="dDownload('${db.id}')"><span class="material-symbols-rounded" style="font-size:14px">download</span>ダウンロード</button>
        </span>
      </div>
    </div>`;
}

function dSetPlat(p){ dashPlatFilter=p; renderDashboards(); }

/* ═══════════════════════════════════════════════════
   追加（ファイル選択 or 貼り付け）
════════════════════════════════════════════════════ */
function dAddDashboard() {
  const platOpts = Object.keys(DASH_PLATFORMS).map(k=>`<option value="${k}">${DASH_PLATFORMS[k].label}</option>`).join("");
  openModal("ダッシュボードを追加",
    `<label>プラットフォーム</label>
     <select id="dPlat" onchange="dSyncExt()">${platOpts}</select>
     <label>名前</label>
     <input id="dName" placeholder="例: OSDA Kibana Dashboard v5.3">
     <label>説明</label>
     <textarea id="dDesc" placeholder="何が入っているか（例: 攻撃シナリオ別29ダッシュボード）"></textarea>
     <label>対応資格（スペース区切り）</label>
     <input id="dCerts" placeholder="OSDA">
     <label>ファイルを選択</label>
     <input type="file" id="dFile" accept=".ndjson,.json,.xml" onchange="dLoadFile()">
     <div id="dFileInfo" class="dash-fileinfo"></div>
     <label>または内容を貼り付け</label>
     <textarea id="dContent" placeholder="ファイルの中身を貼り付け" style="min-height:100px;font-family:var(--font-mono);font-size:11px"></textarea>`,
    () => {
      const platform = val("dPlat") || "kibana";
      const content = val("dContent");
      if (!content.trim()) { toast("⚠ ファイルか内容が必要です"); return; }
      const pm = dashPlatMeta(platform);
      const meta = dashAnalyze(content, platform);
      data.dashboards.push({
        id: uid(),
        name: val("dName") || "無名ダッシュボード",
        platform,
        format: window.__dLoadedExt || pm.ext,
        description: val("dDesc"),
        certs: val("dCerts").split(/\s+/).filter(Boolean),
        content,
        size: content.length,
        meta,
        ts: Date.now(),
      });
      window.__dLoadedExt = null;
      renderDashboards();
      toast("✅ ダッシュボードを追加しました");
    },
    { okText: "保存" });
}

/* ファイル選択時に内容を読み込む */
function dLoadFile() {
  const input = document.getElementById("dFile");
  if (!input || !input.files || !input.files[0]) return;
  const file = input.files[0];
  const info = document.getElementById("dFileInfo");
  const reader = new FileReader();
  reader.onload = (e) => {
    const content = e.target.result;
    const ta = document.getElementById("dContent");
    if (ta) ta.value = content;
    // 名前が空ならファイル名から補完
    const nameEl = document.getElementById("dName");
    if (nameEl && !nameEl.value) nameEl.value = file.name.replace(/\.[^.]+$/,"");
    // 拡張子を記録
    const ext = (file.name.match(/\.([^.]+)$/)||[])[1] || "";
    window.__dLoadedExt = ext.toLowerCase();
    if (info) info.innerHTML = `<span class="material-symbols-rounded" style="font-size:14px;color:var(--md-success)">check_circle</span> ${esc(file.name)} (${dashFmtSize(content.length)}) 読み込み完了`;
  };
  reader.onerror = () => { if (info) info.textContent = "読み込みに失敗しました"; };
  reader.readAsText(file);
}
function dSyncExt(){ /* プラットフォーム変更時のフック（今は何もしない） */ }

/* ═══════════════════════════════════════════════════
   ダウンロード
════════════════════════════════════════════════════ */
function dDownload(id) {
  const db = data.dashboards.find(x=>x.id===id); if (!db) return;
  const safe = db.name.replace(/[^\w\u3040-\u30ff\u4e00-\u9fff.-]+/g,"_").slice(0,50);
  const fname = `${safe}.${db.format}`;
  const mime = db.format==="ndjson" ? "application/x-ndjson"
             : db.format==="xml" ? "application/xml" : "application/json";
  const a = Object.assign(document.createElement("a"), {
    href: URL.createObjectURL(new Blob([db.content],{type:mime})),
    download: fname,
  });
  document.body.appendChild(a); a.click(); a.remove();
  toast(`📥 ${fname} をダウンロードしました`);
}

/* ═══════════════════════════════════════════════════
   プレビュー（統計＋冒頭。全文は重いので出さない）
════════════════════════════════════════════════════ */
function dPreview(id) {
  const db = data.dashboards.find(x=>x.id===id); if (!db) return;
  const pm = dashPlatMeta(db.platform);

  // Kibanaならダッシュボード名一覧を抽出
  let titleList = "";
  if (db.platform === "kibana") {
    const titles = [];
    db.content.split("\n").forEach(line => {
      line=line.trim(); if(!line) return;
      try { const o=JSON.parse(line); if(o.type==="dashboard" && o.attributes?.title) titles.push(o.attributes.title); } catch(e){}
    });
    if (titles.length) {
      titleList = `<label style="margin-top:14px">収録ダッシュボード (${titles.length})</label>
        <div class="dash-title-list">${titles.map(t=>`<div class="dash-title-item">${esc(t)}</div>`).join("")}</div>`;
    }
  }

  const metaRows = db.meta ? Object.keys(db.meta).map(k=>{
    const labels={dashboards:"ダッシュボード",searches:"検索",visualizations:"可視化",indexPatterns:"index-pattern",panels:"パネル"};
    return `<div class="th-kv"><span class="k">${labels[k]||k}</span><span class="v">${db.meta[k]}</span></div>`;
  }).join("") : "";

  const head = esc(db.content.slice(0, 600)) + (db.content.length > 600 ? "\n..." : "");

  openModal(db.name,
    `<div class="th-detail">
       <div class="th-detail-row"><span class="th-dl">プラットフォーム</span><span class="dash-plat" style="background:${pm.color}22;color:${pm.color}">${esc(pm.label)}</span></div>
       <div class="th-detail-row"><span class="th-dl">形式</span><span>.${esc(db.format)}</span></div>
       <div class="th-detail-row"><span class="th-dl">サイズ</span><span>${dashFmtSize(db.size)}</span></div>
       ${db.description?`<div class="th-detail-row"><span class="th-dl">説明</span><span>${esc(db.description)}</span></div>`:""}
       ${metaRows}
       ${titleList}
       <label style="margin-top:14px">冒頭プレビュー（先頭600文字）</label>
       <pre class="th-qcode-full" style="max-height:200px">${head}</pre>
     </div>`,
    null,
    { okText: "ダウンロード", onOk: () => { closeModal(); dDownload(id); },
      extraBtns: [{ label: "閉じる", cls: "btn-text", fn: () => closeModal() }] });
}

/* ═══════════════════════════════════════════════════
   編集・削除
════════════════════════════════════════════════════ */
function dEdit(id) {
  const db = data.dashboards.find(x=>x.id===id); if (!db) return;
  const platOpts = Object.keys(DASH_PLATFORMS).map(k=>`<option value="${k}" ${db.platform===k?'selected':''}>${DASH_PLATFORMS[k].label}</option>`).join("");
  openModal("ダッシュボードを編集",
    `<label>プラットフォーム</label><select id="dPlat">${platOpts}</select>
     <label>名前</label><input id="dName" value="${esc(db.name)}">
     <label>説明</label><textarea id="dDesc">${esc(db.description)}</textarea>
     <label>対応資格（スペース区切り）</label><input id="dCerts" value="${esc((db.certs||[]).join(" "))}">
     <label>内容を差し替え（任意・空なら現状維持）</label>
     <input type="file" id="dFile" accept=".ndjson,.json,.xml" onchange="dLoadFile()">
     <div id="dFileInfo" class="dash-fileinfo"></div>
     <textarea id="dContent" placeholder="差し替える場合のみ" style="min-height:60px;font-family:var(--font-mono);font-size:11px"></textarea>`,
    () => {
      db.platform = val("dPlat");
      db.name = val("dName") || "無名ダッシュボード";
      db.description = val("dDesc");
      db.certs = val("dCerts").split(/\s+/).filter(Boolean);
      const newContent = val("dContent");
      if (newContent.trim()) {
        db.content = newContent;
        db.size = newContent.length;
        db.format = window.__dLoadedExt || dashPlatMeta(db.platform).ext;
        db.meta = dashAnalyze(newContent, db.platform);
        window.__dLoadedExt = null;
      }
      renderDashboards(); toast("✅ 更新しました");
    },
    { extraBtns: [{ label:"削除", cls:"btn-text btn-danger", fn:()=>{ closeModal(); dDelete(id); } }] });
}

function dDelete(id) {
  const db = data.dashboards.find(x=>x.id===id); if (!db) return;
  if (!confirm(`「${db.name}」を削除しますか？`)) return;
  data.dashboards = data.dashboards.filter(x=>x.id!==id);
  renderDashboards(); toast("🗑 削除しました");
}

/* 検索 */
function renderDashboardsSearch() {
  const main = document.getElementById("main");
  const q = document.getElementById("searchInput").value.trim().toLowerCase();
  if (!q) { searchMode=false; render(); return; }
  const hits = data.dashboards.filter(db =>
    (db.name||"").toLowerCase().includes(q) ||
    (db.description||"").toLowerCase().includes(q) ||
    (db.platform||"").toLowerCase().includes(q) ||
    (db.certs||[]).some(c=>c.toLowerCase().includes(q)));
  renderDashNav();
  main.innerHTML = `
    <div class="s-head"><h1>検索: ${esc(q)}</h1><span class="th-count">${hits.length} 件</span></div>
    ${hits.length ? `<div class="dash-grid">${hits.map(renderDashCard).join("")}</div>`
      : emptyState("search_off","一致するダッシュボードがありません","別のキーワードをお試しください")}
  `;
}
