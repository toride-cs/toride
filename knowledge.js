/* ═══════════════════════════════════════════════════════
   go2 cheatsheet — knowledge.js  (ナレッジ・リンク集)
   Data: data.knowledge[]
   link { id,title,url,certs[],category,kind,desc,ts }

   app.js の共通関数（openModal/toast/esc/uid/val）と
   定数（KNOW_KINDS/KNOW_CATEGORIES）を再利用。
════════════════════════════════════════════════════════ */

function knowKindMeta(k){ return KNOW_KINDS[k] || KNOW_KINDS.doc; }
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
    ${list.length ? `<div class="know-grid">${list.map(renderKnowCard).join("")}</div>`
      : emptyState("menu_book", data.knowledge.length?"該当するナレッジがありません":"ナレッジがまだありません",
          data.knowledge.length?"フィルタを変えてください":"「リンクを追加」で登録できます")}
  `;
}

function renderKnowCard(k) {
  const m = knowKindMeta(k.kind);
  const certs = (k.certs||[]).map(c=>`<span class="tool-cert-mini">${esc(c)}</span>`).join("");
  return `
    <div class="know-card">
      <div class="know-card-top">
        <span class="know-kind" style="background:${m.color}22;color:${m.color}">${esc(m.label)}</span>
        <button class="know-edit" onclick="kEditLink('${k.id}')" title="編集"><span class="material-symbols-rounded" style="font-size:15px">edit</span></button>
      </div>
      <h3 class="know-title"><a href="${esc(k.url)}" target="_blank" rel="noopener">${esc(k.title)}<span class="material-symbols-rounded" style="font-size:14px;vertical-align:middle;margin-left:3px">open_in_new</span></a></h3>
      ${k.desc?`<div class="know-desc">${esc(k.desc)}</div>`:""}
      <div class="know-url">${esc(knowDomain(k.url))}</div>
      <div class="know-foot">
        <span class="tool-cat-tag">${esc(k.category)}</span>
        ${certs}
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
    { extraBtns: [{ label:"削除", cls:"btn-text btn-danger", fn:()=>{ closeModal(); kDelLink(id); } }] });
}

function kDelLink(id) {
  const k = data.knowledge.find(x=>x.id===id); if (!k) return;
  if (!confirm(`「${k.title}」を削除しますか？`)) return;
  data.knowledge = data.knowledge.filter(x=>x.id!==id);
  renderKnowledge(); toast("🗑 削除しました");
}

/* 検索 */
function renderKnowledgeSearch() {
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
  seed.forEach(s => data.knowledge.push({ id: uid(), ts: Date.now(), ...s }));
}
