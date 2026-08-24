/* ═══════════════════════════════════════════════════════
   go2 cheatsheet — knowledge.js  (ナレッジ・リンク集)
   Data: data.knowledge[]
   link { id,title,url,certs[],category,kind,desc,ts }

   app.js の共通関数（openModal/toast/esc/uid/val）と
   定数（KNOW_KINDS/KNOW_CATEGORIES）を再利用。
════════════════════════════════════════════════════════ */

function knowKindMeta(k){ return KNOW_KINDS[k] || KNOW_KINDS.doc; }

/* 既存ナレッジ（detail無し）に、タイトル一致でKNOWLEDGE_DETAILSを補完 */
function knowBackfillDetails() {
  const KD = (typeof window !== "undefined" && window.KNOWLEDGE_DETAILS) ||
             (typeof KNOWLEDGE_DETAILS !== "undefined" ? KNOWLEDGE_DETAILS : null);
  if (!KD) return;
  data.knowledge.forEach(k => {
    if (!k.detail && KD[k.title]) k.detail = KD[k.title];
  });
}
function knowAllCerts(){
  const s = new Set();
  data.knowledge.forEach(k => (k.certs||[]).forEach(c => s.add(c)));
  return [...s];
}
function knowDomain(url){
  try { return new URL(url).hostname.replace(/^www\./,"") + new URL(url).pathname.replace(/\/$/,""); }
  catch(e){ return url; }
}

function renderKnowNav() {
  const nav = document.getElementById("navList");
  if (!nav) return;
  nav.innerHTML = `
    <button class="nav-item active" onclick="setMode('knowledge')">
      <span class="material-symbols-rounded nav-icon">menu_book</span>
      <span class="nav-label">ナレッジ</span>
      <span class="nav-count">${data.knowledge.length}</span>
    </button>`;
}

/* ═══════════════════════════════════════════════════
   一覧
════════════════════════════════════════════════════ */
function renderKnowledge() {
  knowledgeSeedIfEmpty();
  knowBackfillDetails();  // 既存データにdetailが無ければタイトル一致で補完
  if (knowView === "detail" && data.knowledge.find(k=>k.id===knowDetailId)) { renderKnowDetail(); return; }
  knowView = "list";
  renderKnowNav();
  const main = document.getElementById("main");

  const certs = knowAllCerts();

  let list = data.knowledge.slice();
  if (knowCertFilter !== "all") list = list.filter(k => (k.certs||[]).includes(knowCertFilter));
  if (knowCatFilter) list = list.filter(k => k.category === knowCatFilter);
  if (knowKindFilter) list = list.filter(k => k.kind === knowKindFilter);

  // 資格タブ
  const certTab = (id, label) => {
    const n = id==="all" ? data.knowledge.length : data.knowledge.filter(k=>(k.certs||[]).includes(id)).length;
    return `<button class="tool-cert-tab ${knowCertFilter===id?'on':''}" onclick="kSetCert('${id}')">${esc(label)} <span class="badge">${n}</span></button>`;
  };
  const certTabs = certs.map(c=>certTab(c,c)).join("") + certTab("all","すべて");

  // カテゴリ（スコープ内に存在するもの）
  const scope = knowCertFilter==="all" ? data.knowledge : data.knowledge.filter(k=>(k.certs||[]).includes(knowCertFilter));
  const catsInScope = [...new Set(scope.map(k=>k.category))];
  const catChips = KNOW_CATEGORIES.filter(c=>catsInScope.includes(c)).map(c =>
    `<button class="th-chip ${knowCatFilter===c?'on':''}" onclick="kSetCat('${c}')">${esc(c)}</button>`).join("");

  // kind絞り込み
  const kindsInScope = [...new Set(scope.map(k=>k.kind))];
  const kindChips = Object.keys(KNOW_KINDS).filter(k=>kindsInScope.includes(k)).map(k => {
    const m = KNOW_KINDS[k];
    return `<button class="th-chip ${knowKindFilter===k?'on':''}" onclick="kSetKind('${k}')" style="${knowKindFilter===k?`border-color:${m.color};color:${m.color}`:''}">${esc(m.label)}</button>`;
  }).join("");

  main.innerHTML = `
    <div class="s-head">
      <h1>ナレッジ</h1>
      <span class="th-count">${list.length} 件${knowCertFilter!=="all"?` · ${esc(knowCertFilter)}`:""}</span>
      <button class="th-add" onclick="kAddLink()"><span class="material-symbols-rounded">add</span>リンクを追加</button>
    </div>
    <div class="tool-cert-tabs">${certTabs}</div>
    <div class="th-filters tool-cat-filters">
      <button class="th-chip ${!knowCatFilter&&!knowKindFilter?'on':''}" onclick="kClearFilter()">すべて</button>
      ${catChips}
      ${kindChips?`<span class="th-sep"></span>${kindChips}`:""}
    </div>
    ${list.length ? `<div class="know-grid" data-dnd-group="know-list">${list.map(renderKnowCard).join("")}</div>`
      : emptyState("menu_book", data.knowledge.length?"該当するナレッジがありません":"ナレッジがまだありません",
          data.knowledge.length?"フィルタを変えてください":"「リンクを追加」で登録できます")}
  `;

  // カードの並び替え（資格/カテゴリ/種別で絞り込み中は表示分のみ入れ替え）
  registerSortable("know-list", ids => { reorderVisible(data.knowledge, ids); renderKnowledge(); });
}

function renderKnowCard(k) {
  const m = knowKindMeta(k.kind);
  const certs = (k.certs||[]).map(c=>`<span class="tool-cert-mini">${esc(c)}</span>`).join("");
  const hasDetail = !!k.detail;
  return `
    <div class="know-card" data-dnd-id="${k.id}">
      <div class="know-card-top">
        ${dndHandle('ドラッグでカードを並び替え')}<span class="know-kind" style="background:${m.color}22;color:${m.color}">${esc(m.label)}</span>
        ${hasDetail?`<span class="know-hasdetail" title="アプリ内に整理情報あり"><span class="material-symbols-rounded" style="font-size:13px">article</span>まとめ</span>`:""}
        <button class="know-edit" onclick="kEditLink('${k.id}')" title="編集"><span class="material-symbols-rounded" style="font-size:15px">edit</span></button>
      </div>
      <h3 class="know-title">${esc(k.title)}</h3>
      ${k.desc?`<div class="know-desc">${esc(k.desc)}</div>`:""}
      <div class="know-url">${esc(knowDomain(k.url))}</div>
      <div class="know-foot">
        <span class="tool-cat-tag">${esc(k.category)}</span>
        ${certs}
        <span class="know-actions">
          ${hasDetail?`<button class="know-detail-btn" onclick="kOpenDetail('${k.id}')"><span class="material-symbols-rounded" style="font-size:14px">menu_book</span>まとめを見る</button>`
            :`<button class="know-addsummary-btn" onclick="kEditDetail('${k.id}')"><span class="material-symbols-rounded" style="font-size:14px">note_add</span>まとめを追加</button>`}
          <a class="know-open-btn" href="${esc(k.url)}" target="_blank" rel="noopener"><span class="material-symbols-rounded" style="font-size:14px">open_in_new</span>開く</a>
        </span>
      </div>
    </div>`;
}

function kSetCert(id){ knowCertFilter=id; knowCatFilter=null; knowKindFilter=null; renderKnowledge(); }
function kSetCat(c){ knowCatFilter=(knowCatFilter===c?null:c); renderKnowledge(); }
function kSetKind(k){ knowKindFilter=(knowKindFilter===k?null:k); renderKnowledge(); }
function kClearFilter(){ knowCatFilter=null; knowKindFilter=null; renderKnowledge(); }

/* CRUD */
function kAddLink(preset) {
  const catOpts = KNOW_CATEGORIES.map(c=>`<option value="${c}" ${preset?.category===c?'selected':''}>${c}</option>`).join("");
  const kindOpts = Object.keys(KNOW_KINDS).map(k=>`<option value="${k}" ${preset?.kind===k?'selected':''}>${KNOW_KINDS[k].label}</option>`).join("");
  openModal("リンクを追加",
    `<label>タイトル</label><input id="kTitle" value="${esc(preset?.title||"")}" placeholder="例: HackTricks">
     <label>URL</label><input id="kUrl" value="${esc(preset?.url||"")}" placeholder="https://...">
     <label>説明</label><textarea id="kDesc" placeholder="どう使うか・何に役立つか">${esc(preset?.desc||"")}</textarea>
     <label>対応資格（スペース区切り）</label><input id="kCerts" value="${esc((preset?.certs||[]).join(" "))}" placeholder="OSWA OSCP">
     <label>カテゴリ</label><select id="kCat">${catOpts}</select>
     <label>種別</label><select id="kKind">${kindOpts}</select>`,
    () => {
      data.knowledge.push({
        id: uid(),
        title: val("kTitle")||"無題",
        url: val("kUrl"),
        desc: val("kDesc"),
        certs: val("kCerts").split(/\s+/).filter(Boolean),
        category: val("kCat")||"reference",
        kind: val("kKind")||"doc",
        ts: Date.now(),
      });
      renderKnowledge(); toast("✅ リンクを追加しました");
    });
}

function kEditLink(id) {
  const k = data.knowledge.find(x=>x.id===id); if (!k) return;
  const catOpts = KNOW_CATEGORIES.map(c=>`<option value="${c}" ${k.category===c?'selected':''}>${c}</option>`).join("");
  const kindOpts = Object.keys(KNOW_KINDS).map(kk=>`<option value="${kk}" ${k.kind===kk?'selected':''}>${KNOW_KINDS[kk].label}</option>`).join("");
  openModal("リンクを編集",
    `<label>タイトル</label><input id="kTitle" value="${esc(k.title)}">
     <label>URL</label><input id="kUrl" value="${esc(k.url)}">
     <label>説明</label><textarea id="kDesc">${esc(k.desc)}</textarea>
     <label>対応資格（スペース区切り）</label><input id="kCerts" value="${esc((k.certs||[]).join(" "))}">
     <label>カテゴリ</label><select id="kCat">${catOpts}</select>
     <label>種別</label><select id="kKind">${kindOpts}</select>`,
    () => {
      k.title=val("kTitle")||"無題"; k.url=val("kUrl"); k.desc=val("kDesc");
      k.certs=val("kCerts").split(/\s+/).filter(Boolean);
      k.category=val("kCat"); k.kind=val("kKind");
      renderKnowledge(); toast("✅ 更新しました");
    },
    { extraBtns: [
        { label:"まとめを編集", cls:"btn-text", fn:()=>{ closeModal(); kEditDetail(id); } },
        { label:"削除", cls:"btn-text btn-danger", fn:()=>{ closeModal(); kDelLink(id); } },
      ] });
}

function kDelLink(id) {
  const k = data.knowledge.find(x=>x.id===id); if (!k) return;
  if (!confirm(`「${k.title}」を削除しますか？`)) return;
  data.knowledge = data.knowledge.filter(x=>x.id!==id);
  renderKnowledge(); toast("🗑 削除しました");
}

/* 検索 */
function renderKnowledgeSearch() {
  knowBackfillDetails();
  const main = document.getElementById("main");
  const q = document.getElementById("searchInput").value.trim().toLowerCase();
  if (!q) { searchMode=false; render(); return; }
  const hits = data.knowledge.filter(k =>
    (k.title||"").toLowerCase().includes(q) ||
    (k.desc||"").toLowerCase().includes(q) ||
    (k.url||"").toLowerCase().includes(q) ||
    (k.category||"").toLowerCase().includes(q) ||
    (k.certs||[]).some(c=>c.toLowerCase().includes(q)));
  renderKnowNav();
  main.innerHTML = `
    <div class="s-head"><h1>検索: ${esc(q)}</h1><span class="th-count">${hits.length} 件</span></div>
    ${hits.length ? `<div class="know-grid">${hits.map(renderKnowCard).join("")}</div>`
      : emptyState("search_off","一致するナレッジがありません","別のキーワードをお試しください")}
  `;
}

/* ═══════════════════════════════════════════════════
   詳細画面（アプリ内でまとめを読む）
════════════════════════════════════════════════════ */
function kOpenDetail(id){ knowDetailId=id; knowView="detail"; render(); document.getElementById("main").scrollTop=0; }
function kBackList(){ knowView="list"; knowDetailId=null; renderKnowledge(); }

/* ═══════════════════════════════════════════════════
   まとめ（detail）の編集・貼り付け
   Claudeが作ったJSONを丸ごと貼るか、各項目を手で編集
════════════════════════════════════════════════════ */
/* ── まとめ(detail) 構造化エディタ ─────────────────────────
   各項目を個別欄で編集。要点・コマンドは行ごとに追加/削除/並び替え。
   コマンドの「内容」は独立したテキストエリアなので改行(\n)もそのまま保持される。
   JSON貼り付け欄はエディタへ“流し込む”ためのショートカット。
─────────────────────────────────────────────────────── */
function kEditDetail(id) {
  const k = data.knowledge.find(x=>x.id===id); if (!k) return;
  const d = k.detail || {};
  window.__kdId = id;
  window.__kd = {
    overview: d.overview || "",
    keyPoints: (d.keyPoints || []).slice(),
    usage: (d.usage || []).map(u => ({ label: u.label || "", content: u.content || "" })),
    oswaTips: d.oswaTips || "",
  };
  openModal("まとめを編集", kdBodyHtml(), () => kdCommit(), { okText: "保存" });
  kdWire();
}

/* エディタ本文HTML（__kd から生成） */
function kdBodyHtml() {
  const kd = window.__kd;
  const kpRows = kd.keyPoints.map((p, i) => `
    <div class="kd-row" data-dnd-id="kp${i}">
      ${dndHandle('ドラッグで並び替え')}
      <input class="kd-kp-input" value="${esc(p)}" placeholder="要点を1つ">
      <button class="kd-del" title="削除" onclick="kdKpDel(${i})"><span class="material-symbols-rounded" style="font-size:18px">delete</span></button>
    </div>`).join("");
  const usageRows = kd.usage.map((u, i) => `
    <div class="kd-usage-row" data-dnd-id="u${i}">
      ${dndHandle('ドラッグで並び替え')}
      <input class="kd-usage-label" value="${esc(u.label)}" placeholder="ラベル（例: DB列挙）">
      <textarea class="kd-usage-content" placeholder="内容・コマンド（改行OK）">${esc(u.content)}</textarea>
      <button class="kd-del" title="削除" onclick="kdUsageDel(${i})"><span class="material-symbols-rounded" style="font-size:18px">delete</span></button>
    </div>`).join("");
  return `
    <div class="know-paste-zone">
      <label style="display:flex;align-items:center;gap:8px">
        <span class="material-symbols-rounded" style="font-size:16px;color:var(--md-primary)">content_paste</span>
        JSONを貼り付けて各欄へ流し込む（任意）
      </label>
      <textarea id="kJson" placeholder='{"overview":"...","keyPoints":["..."],"usage":[{"label":"...","content":"..."}],"oswaTips":"..."}' style="min-height:70px;font-family:var(--font-mono);font-size:11px"></textarea>
      <button class="know-paste-apply" onclick="kApplyJson()"><span class="material-symbols-rounded" style="font-size:15px">auto_fix_high</span>JSONをエディタに反映</button>
    </div>
    <div class="know-paste-divider">各項目を直接編集</div>

    <label>概要（overview）</label>
    <textarea id="kOverview" placeholder="何のサイト/ツールか">${esc(kd.overview)}</textarea>

    <div class="kd-sec-label">要点（keyPoints）</div>
    <div class="kd-list" data-dnd-group="kd-kp">${kpRows}</div>
    <button class="kd-addbtn" onclick="kdKpAdd()"><span class="material-symbols-rounded" style="font-size:16px">add</span>要点を追加</button>

    <div class="kd-sec-label">使い方・コマンド（usage）</div>
    <div class="kd-list" data-dnd-group="kd-usage">${usageRows}</div>
    <button class="kd-addbtn" onclick="kdUsageAdd()"><span class="material-symbols-rounded" style="font-size:16px">add</span>コマンドを追加</button>

    <label style="margin-top:12px">使いどころ（oswaTips）</label>
    <textarea id="kOswaTips" placeholder="使いどころ・注意点">${esc(kd.oswaTips)}</textarea>`;
}

/* モーダル本文を __kd から再描画（並び替え登録も更新） */
function kdRender() {
  const mb = document.getElementById("modalBody");
  if (!mb) return;
  mb.innerHTML = kdBodyHtml();
  kdWire();
}
function kdWire() {
  registerSortable("kd-kp",    () => { kdHarvest(); kdRender(); });
  registerSortable("kd-usage", () => { kdHarvest(); kdRender(); });
}

/* 画面の現在値を __kd に取り込む（並び順もDOM順で確定） */
function kdHarvest() {
  const mb = document.getElementById("modalBody"); if (!mb) return;
  window.__kd.overview = mb.querySelector("#kOverview")?.value ?? window.__kd.overview;
  window.__kd.oswaTips = mb.querySelector("#kOswaTips")?.value ?? window.__kd.oswaTips;
  window.__kd.keyPoints = [...mb.querySelectorAll(".kd-kp-input")].map(el => el.value);
  window.__kd.usage = [...mb.querySelectorAll(".kd-usage-row")].map(r => ({
    label:   r.querySelector(".kd-usage-label")?.value || "",
    content: r.querySelector(".kd-usage-content")?.value || "",
  }));
}

function kdKpAdd()   { kdHarvest(); window.__kd.keyPoints.push(""); kdRender(); }
function kdKpDel(i)  { kdHarvest(); window.__kd.keyPoints.splice(i, 1); kdRender(); }
function kdUsageAdd(){ kdHarvest(); window.__kd.usage.push({ label:"", content:"" }); kdRender(); }
function kdUsageDel(i){ kdHarvest(); window.__kd.usage.splice(i, 1); kdRender(); }

/* JSON貼り付け → __kd に反映（改行はcontentにそのまま入る） */
function kApplyJson() {
  const raw = val("kJson").trim();
  if (!raw) { toast("JSONを貼り付けてください"); return; }
  let obj;
  try { obj = JSON.parse(raw); }
  catch (e) { toast("⚠ JSONの形式が正しくありません"); return; }
  kdHarvest();
  if (typeof obj.overview === "string") window.__kd.overview = obj.overview;
  if (typeof obj.oswaTips === "string") window.__kd.oswaTips = obj.oswaTips;
  if (Array.isArray(obj.keyPoints)) window.__kd.keyPoints = obj.keyPoints.map(String);
  if (Array.isArray(obj.usage)) window.__kd.usage = obj.usage.map(u => ({
    label: (u && u.label) ? String(u.label) : "",
    content: (u && u.content != null) ? String(u.content) : "",
  }));
  kdRender();
  toast("✅ エディタに反映しました（保存で確定）");
}

/* 保存 */
function kdCommit() {
  kdHarvest();
  const k = data.knowledge.find(x => x.id === window.__kdId); if (!k) return;
  const overview = (window.__kd.overview || "").trim();
  const oswaTips = (window.__kd.oswaTips || "").trim();
  const keyPoints = window.__kd.keyPoints.map(s => s.trim()).filter(Boolean);
  const usage = window.__kd.usage
    .map(u => ({ label: (u.label || "").trim(), content: u.content || "" }))
    .filter(u => u.label || (u.content || "").trim());
  if (!overview && !keyPoints.length && !usage.length && !oswaTips) {
    k.detail = null;
  } else {
    k.detail = {
      overview, keyPoints, usage, oswaTips,
      lastCurated: (k.detail && k.detail.lastCurated) || new Date().toISOString().slice(0, 10),
    };
  }
  if (knowView === "detail") renderKnowDetail(); else renderKnowledge();
  toast("✅ まとめを更新しました");
}

/* 詳細画面から usage を個別に編集・追加・削除 */
function kEditUsage(kid, uidv) {
  const k = data.knowledge.find(x => x.id === kid); if (!k || !k.detail) return;
  const u = (k.detail.usage || []).find(x => x.id === uidv); if (!u) return;
  openModal("コマンドを編集",
    `<label>ラベル</label><input id="kuLabel" value="${esc(u.label)}" placeholder="例: DB列挙">
     <label>内容・コマンド（改行OK）</label>
     <textarea id="kuContent" class="mono-input" style="min-height:140px;white-space:pre">${esc(u.content)}</textarea>`,
    () => { u.label = val("kuLabel"); u.content = val("kuContent"); renderKnowDetail(); toast("✅ 更新しました"); },
    { okText: "保存", extraBtns: [{ label: "削除", cls: "btn-text btn-danger", fn: () => { closeModal(); kDelUsage(kid, uidv); } }] });
}
function kDelUsage(kid, uidv) {
  const k = data.knowledge.find(x => x.id === kid); if (!k || !k.detail) return;
  const u = (k.detail.usage || []).find(x => x.id === uidv); if (!u) return;
  if (!confirm(`コマンド「${u.label || u.content.slice(0,20)}」を削除しますか？`)) return;
  k.detail.usage = k.detail.usage.filter(x => x.id !== uidv);
  renderKnowDetail(); toast("🗑 削除しました");
}
function kAddUsage(kid) {
  const k = data.knowledge.find(x => x.id === kid); if (!k) return;
  if (!k.detail) k.detail = { overview:"", keyPoints:[], usage:[], oswaTips:"", lastCurated:new Date().toISOString().slice(0,10) };
  openModal("コマンドを追加",
    `<label>ラベル</label><input id="kuLabel" placeholder="例: DB列挙">
     <label>内容・コマンド（改行OK）</label>
     <textarea id="kuContent" class="mono-input" style="min-height:140px;white-space:pre" placeholder="sudo find / -name login.php 2>/dev/null"></textarea>`,
    () => {
      k.detail.usage.push({ id: "u" + uid(), label: val("kuLabel"), content: val("kuContent") });
      renderKnowDetail(); toast("✅ 追加しました");
    },
    { okText: "追加" });
}

function renderKnowDetail() {
  renderKnowNav();
  const main = document.getElementById("main");
  const k = data.knowledge.find(x=>x.id===knowDetailId);
  if (!k || !k.detail) { kBackList(); return; }
  const d = k.detail;
  const m = knowKindMeta(k.kind);
  const certs = (k.certs||[]).map(c=>`<span class="tool-cert-mini">${esc(c)}</span>`).join("");

  // usage に安定IDを付与（並び替え・個別編集用）
  (d.usage||[]).forEach(u => { if (!u.id) u.id = "u" + uid(); });

  const keyPoints = (d.keyPoints||[]).length
    ? `<div class="know-d-sec"><h4>要点</h4><ul class="know-d-list">${d.keyPoints.map(p=>`<li>${esc(p)}</li>`).join("")}</ul></div>` : "";

  const usage = `<div class="know-d-sec">
      <h4>使い方・コマンド</h4>
      <div class="know-d-usages" data-dnd-group="know-usage:${k.id}">${(d.usage||[]).map(u=>`
        <div class="know-d-usage" data-dnd-id="${u.id}">
          <div class="know-d-usage-label">
            ${dndHandle('ドラッグで並び替え')}<span>${esc(u.label)}</span>
            <span class="know-d-usage-acts">
              <button class="know-d-usage-act" onclick="kEditUsage('${k.id}','${u.id}')" title="このコマンドを編集"><span class="material-symbols-rounded" style="font-size:14px">edit</span></button>
              <button class="know-d-usage-act danger" onclick="kDelUsage('${k.id}','${u.id}')" title="削除"><span class="material-symbols-rounded" style="font-size:14px">delete</span></button>
            </span>
          </div>
          <pre class="know-d-code">${esc(u.content)}<button class="tool-cmd-copy" onclick="event.stopPropagation();copyCell(event, ${escAttr(JSON.stringify(u.content))})" title="コピー"><span class="material-symbols-rounded" style="font-size:14px">content_copy</span></button></pre>
        </div>`).join("")}</div>
      <button class="tool-add-cmd" onclick="kAddUsage('${k.id}')"><span class="material-symbols-rounded" style="font-size:15px">add</span>コマンドを追加</button>
    </div>`;

  const oswaTips = d.oswaTips
    ? `<div class="know-d-sec"><h4>OSWAでの使いどころ</h4><div class="know-d-tips">${esc(d.oswaTips)}</div></div>` : "";

  main.innerHTML = `
    <div class="know-detail">
      <div class="th-crumb"><button onclick="kBackList()">ナレッジ</button> / <b>${esc(k.title)}</b></div>
      <div class="know-d-head">
        <span class="know-kind" style="background:${m.color}22;color:${m.color}">${esc(m.label)}</span>
        <h1>${esc(k.title)}</h1>
      </div>
      <div class="know-d-meta">
        <span class="tool-cat-tag">${esc(k.category)}</span>${certs}
        <button class="know-d-editbtn" onclick="kEditDetail('${k.id}')"><span class="material-symbols-rounded" style="font-size:14px">edit_note</span>まとめを編集</button>
        <a class="know-open-btn" href="${esc(k.url)}" target="_blank" rel="noopener"><span class="material-symbols-rounded" style="font-size:14px">open_in_new</span>元サイトを開く</a>
      </div>

      ${d.overview?`<div class="know-d-overview">${esc(d.overview)}</div>`:""}
      ${keyPoints}
      ${usage}
      ${oswaTips}

      <div class="know-d-foot">
        <span class="know-d-curated">${d.lastCurated?`整理日: ${esc(d.lastCurated)}（アプリ内にまとめた情報です。最新は元サイトを確認）`:"アプリ内にまとめた情報です"}</span>
      </div>
    </div>
  `;

  // 使い方・コマンドの並び替え
  registerSortable("know-usage:" + k.id, ids => {
    if (k.detail && Array.isArray(k.detail.usage)) reorderVisible(k.detail.usage, ids);
    renderKnowDetail();
  });
}

/* ═══════════════════════════════════════════════════
   初期データ（いただいた12リンク・コメントそのまま）
════════════════════════════════════════════════════ */
function knowledgeSeedIfEmpty() {
  if (data.knowledge.length || window.__knowSeeded) return;
  window.__knowSeeded = true;
  const seed = [
    { title: "machevalia / OSWA", url: "https://github.com/machevalia/OSWA/tree/main",
      certs: ["OSWA"], category: "reference", kind: "cheatsheet",
      desc: "OSWA攻略のまとめリポジトリ。" },
    { title: "bastyn / OSWA", url: "https://github.com/bastyn/OSWA/tree/main",
      certs: ["OSWA"], category: "reference", kind: "cheatsheet",
      desc: "OSWA攻略のまとめリポジトリ。" },
    { title: "HackTricks", url: "https://hacktricks.wiki/en/index.html",
      certs: ["OSWA","OSCP"], category: "reference", kind: "doc",
      desc: "攻撃手法の百科事典。ほぼ全カテゴリを網羅。困ったらまずここ。" },
    { title: "Template Injection Table", url: "https://cheatsheet.hackmanit.de/template-injection-table/",
      certs: ["OSWA"], category: "ssti", kind: "cheatsheet",
      desc: "SSTIで活用できるサイト。何のTemplate Engineか特定できない場合に使用。挙動を確認して絞り込み、特定が可能。" },
    { title: "CeWL", url: "https://github.com/digininja/CeWL",
      certs: ["OSWA"], category: "wordlist", kind: "tool",
      desc: "Webページからワードリストを作ってくれるツール。認証情報系のお供に。" },
    { title: "ffuf", url: "https://github.com/ffuf/ffuf",
      certs: ["OSWA","OSCP"], category: "fuzzing", kind: "tool",
      desc: "主にFuzzingで使用。Sizeの差異で認証情報の一致の有無、Statusの差異でError-based、Durationの差異でTime-basedのFuzzingができる。Burp Suiteのリクエストをファイルにし、FUZZ Pointを指定すればヘッダー等をオプション指定する手間も省ける。" },
    { title: "PayloadsAllTheThings / SQLi Intruder", url: "https://github.com/swisskyrepo/PayloadsAllTheThings/tree/master/SQL%20Injection/Intruder",
      certs: ["OSWA"], category: "sqli", kind: "wordlist",
      desc: "SQL Injection Pointの特定等に使用するワードリスト。Burp Suiteやffufと組み合わせて使う。SQLi以外にも使えるワードリストがたくさん載っていておすすめ。" },
    { title: "sqlmap", url: "https://sqlmap.org/",
      certs: ["OSWA","OSCP"], category: "sqli", kind: "tool",
      desc: "言わずと知れたSQL injectionのツール。ffufと同じくBurp Suiteのリクエストをファイル保存すればヘッダー等の指定の手間が省ける。個人的にはsqlmapに頼り切るのはおすすめしない。ある程度は手動でできるように練習したほうが良い。" },
    { title: "PayloadsAllTheThings", url: "https://github.com/swisskyrepo/PayloadsAllTheThings/tree/master",
      certs: ["OSWA","OSCP"], category: "reference", kind: "wordlist",
      desc: "攻撃ペイロード・ワードリストの総合リポジトリ。全脆弱性タイプを網羅。" },
    { title: "PortSwigger Web Security Academy", url: "https://portswigger.net/web-security",
      certs: ["OSWA"], category: "lab", kind: "lab",
      desc: "各脆弱性タイプの実践ラボ。XSS / CSRF / CORS / XXE / SSRF / OSコマンドインジェクション / SSTI / パストラバーサル / SQLi / IDOR / パラメータ制御によるユーザーID・パスワード漏洩。OSWA範囲を網羅。" },
    { title: "MDN Web Docs", url: "https://developer.mozilla.org/en-US/docs/Web/",
      certs: ["OSWA"], category: "reference", kind: "doc",
      desc: "Web技術の公式ドキュメント。HTTP/JS/DOMの挙動を正確に確認したい時に。" },
    { title: "AutoRecon-OSWA", url: "https://github.com/ZumiYumi/AutoRecon-OSWA",
      certs: ["OSWA"], category: "recon", kind: "tool",
      desc: "OSWA向けの自動偵察ツール。" },
  ];
  seed.forEach(s => {
    const detail = (typeof KNOWLEDGE_DETAILS !== "undefined" && KNOWLEDGE_DETAILS[s.title]) || null;
    data.knowledge.push({ id: uid(), ts: Date.now(), detail, ...s });
  });
}
