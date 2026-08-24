/* ═══════════════════════════════════════════════════════
   go2 cheatsheet — tools.js  (ツール・リファレンス)
   Data: data.tools[]
   tool { id,name,certs[],category,priority,summary,
          commands[{id,label,cmd,note}], tips, reference[{label,url}], ts }

   app.js の共通関数（openModal/toast/esc/uid/copyCell/copyToClipboard/val）と
   定数（TOOL_PRIORITY/TOOL_CATEGORIES）を再利用。
════════════════════════════════════════════════════════ */

function toolGet()       { return data.tools.find(t => t.id === toolId); }
function toolPrioMeta(p) { return TOOL_PRIORITY[p] || TOOL_PRIORITY.opt; }
/* 全ツールから資格の一覧を集計 */
function toolAllCerts()  {
  const s = new Set();
  data.tools.forEach(t => (t.certs||[]).forEach(c => s.add(c)));
  return [...s];
}

function renderToolsNav() {
  const nav = document.getElementById("navList");
  if (!nav) return;
  const item = (mode, icon, label, count) => `
    <button class="nav-item ${appMode===mode?'active':''}" onclick="setMode('${mode}')">
      <span class="material-symbols-rounded nav-icon">${icon}</span>
      <span class="nav-label">${label}</span>
      ${count!=null?`<span class="nav-count">${count}</span>`:""}
    </button>`;
  nav.innerHTML = item("tools", "build", "ツール", data.tools.length);
}

/* ═══════════════════════════════════════════════════
   ツール一覧
════════════════════════════════════════════════════ */
function renderTools() {
  toolsSeedIfEmpty();
  if (toolsView === "tool" && toolGet()) { renderToolDetail(); return; }
  toolsView = "list";
  renderToolsNav();
  const main = document.getElementById("main");

  const certs = toolAllCerts();

  // 資格でフィルタ
  let list = data.tools.slice();
  if (toolCertFilter !== "all") list = list.filter(t => (t.certs||[]).includes(toolCertFilter));
  // カテゴリでフィルタ
  if (toolCatFilter) list = list.filter(t => t.category === toolCatFilter);

  // 優先度順（必須→おすすめ→便利）でソート
  const prioOrder = { must:0, rec:1, opt:2 };
  list.sort((a,b) => (prioOrder[a.priority]??9) - (prioOrder[b.priority]??9));

  // 資格タブ
  const certTab = (id, label) => {
    const n = id==="all" ? data.tools.length : data.tools.filter(t=>(t.certs||[]).includes(id)).length;
    return `<button class="tool-cert-tab ${toolCertFilter===id?'on':''}" onclick="tSetCert('${id}')">${esc(label)} <span class="badge">${n}</span></button>`;
  };
  const certTabs = certs.map(c => certTab(c, c)).join("") + certTab("all", "すべて");

  // カテゴリchips（現在の資格フィルタ内に存在するカテゴリだけ）
  const certScope = toolCertFilter==="all" ? data.tools : data.tools.filter(t=>(t.certs||[]).includes(toolCertFilter));
  const catsInScope = [...new Set(certScope.map(t=>t.category))];
  const catChips = TOOL_CATEGORIES.filter(c=>catsInScope.includes(c)).map(c =>
    `<button class="th-chip ${toolCatFilter===c?'on':''}" onclick="tSetCat('${c}')">${esc(c)}</button>`).join("");

  main.innerHTML = `
    <div class="s-head">
      <h1>ツール</h1>
      <span class="th-count">${list.length} 件${toolCertFilter!=="all"?` · ${esc(toolCertFilter)}`:""}</span>
      <button class="th-add" onclick="tAddTool()"><span class="material-symbols-rounded">add</span>ツールを追加</button>
    </div>
    <div class="tool-cert-tabs">${certTabs}</div>
    <div class="th-filters tool-cat-filters">
      <button class="th-chip ${!toolCatFilter?'on':''}" onclick="tSetCat(null)">すべて</button>
      ${catChips}
    </div>
    ${list.length ? `<div class="tool-grid">${list.map(renderToolCard).join("")}</div>`
      : emptyState("build", data.tools.length?"該当するツールがありません":"ツールがまだありません",
          data.tools.length?"フィルタを変えてください":"「ツールを追加」で登録できます")}
  `;
}

function renderToolCard(t) {
  const pr = toolPrioMeta(t.priority);
  const certs = (t.certs||[]).map(c=>`<span class="tool-cert-mini">${esc(c)}</span>`).join("");
  const firstCmd = (t.commands||[])[0];
  const cmdPreview = firstCmd
    ? `<pre class="tool-card-cmd">${esc(firstCmd.cmd)}</pre>`
    : (t.tips ? `<pre class="tool-card-cmd"><span style="color:var(--md-on-surface-var)"># ${esc(t.tips.slice(0,50))}</span></pre>` : "");
  const cmdCount = (t.commands||[]).length;
  const countLabel = cmdCount ? `${cmdCount} コマンド` : (t.reference?.length ? "リンク" : "");
  return `
    <div class="tool-card" onclick="tOpen('${t.id}')">
      <div class="tool-card-top">
        <h3>${esc(t.name)}</h3>
        <span class="tool-prio ${pr.cls}">${pr.label}</span>
      </div>
      ${t.summary?`<div class="tool-summary">${esc(t.summary)}</div>`:""}
      ${cmdPreview}
      <div class="tool-card-foot">
        <span class="tool-cat-tag">${esc(t.category)}</span>
        ${certs}
        ${countLabel?`<span class="tool-cmdcount">${countLabel}</span>`:""}
      </div>
    </div>`;
}

function tSetCert(id){ toolCertFilter=id; toolCatFilter=null; renderTools(); }
function tSetCat(c){ toolCatFilter = (toolCatFilter===c?null:c); renderTools(); }
function tOpen(id){ toolId=id; toolsView="tool"; render(); document.getElementById("main").scrollTop=0; }

/* ═══════════════════════════════════════════════════
   ツール詳細
════════════════════════════════════════════════════ */
function renderToolDetail() {
  renderToolsNav();
  const main = document.getElementById("main");
  const t = toolGet();
  if (!t) { toolsView="list"; renderTools(); return; }
  const pr = toolPrioMeta(t.priority);

  const cmds = (t.commands||[]).map((c,i,arr) => `
    <div class="tool-cmd-block" data-dnd-id="${c.id}">
      <div class="tool-cmd-label">
        ${dndHandle('ドラッグでコマンドを並び替え')}<span>${esc(c.label)||`コマンド ${i+1}`}</span>
        <span class="tool-cmd-acts">
          <button class="tool-cmd-act" onclick="tEditCommand('${t.id}','${c.id}')" title="編集"><span class="material-symbols-rounded" style="font-size:14px">edit</span></button>
          <button class="tool-cmd-act danger" onclick="tDelCommand('${t.id}','${c.id}')" title="削除"><span class="material-symbols-rounded" style="font-size:14px">delete</span></button>
        </span>
      </div>
      <pre class="tool-cmd-box">${esc(c.cmd)}<button class="tool-cmd-copy" onclick="event.stopPropagation();copyCell(event, ${escAttr(JSON.stringify(c.cmd))})" title="コピー"><span class="material-symbols-rounded" style="font-size:14px">content_copy</span></button></pre>
      ${c.note?`<div class="tool-cmd-note">${esc(c.note)}</div>`:""}
    </div>`).join("") || `<div class="th-side-empty">コマンドは登録されていません</div>`;

  const refs = (t.reference||[]).map(r => `
    <div class="tool-ref-item">
      <span class="material-symbols-rounded" style="font-size:16px;color:var(--md-primary)">link</span>
      <a href="${esc(r.url)}" target="_blank" rel="noopener">${esc(r.label)||esc(r.url)}</a>
    </div>`).join("") || `<div class="th-side-empty">参考リンクはありません</div>`;

  const certs = (t.certs||[]).map(c=>`<span class="tool-cert-mini">${esc(c)}</span>`).join("");

  main.innerHTML = `
    <div class="tool-detail">
      <div class="th-crumb"><button onclick="tBackList()">ツール</button> / <b>${esc(t.name)}</b></div>
      <div class="tool-detail-head">
        <h1>${esc(t.name)}</h1>
        <span class="tool-prio ${pr.cls}">${pr.label}</span>
        <button class="th-side-mini" style="margin-left:auto" onclick="tEditTool('${t.id}')"><span class="material-symbols-rounded" style="font-size:14px">edit</span>編集</button>
      </div>
      ${t.summary?`<div class="tool-detail-summary">${esc(t.summary)}</div>`:""}
      <div class="tool-detail-meta"><span class="tool-cat-tag">${esc(t.category)}</span>${certs}</div>

      <div class="tool-sec-h">コマンド</div>
      <div class="tool-cmds" data-dnd-group="tool-cmds:${t.id}">${cmds}</div>
      <button class="tool-add-cmd" onclick="tAddCommand('${t.id}')"><span class="material-symbols-rounded" style="font-size:15px">add</span>コマンドを追加</button>

      ${t.tips ? `<div class="tool-sec-h">Tips・注意点</div><div class="tool-tips-box">${renderMd(esc(t.tips))}</div>` : ""}

      <div class="tool-sec-h">参考リンク</div>
      <div class="tool-ref-list">${refs}</div>
    </div>
  `;

  registerSortable("tool-cmds:" + t.id, ids => {
    reorderVisible(t.commands, ids);
    renderToolDetail();
  });
}

function tBackList(){ toolsView="list"; toolId=null; renderTools(); }

/* ═══════════════════════════════════════════════════
   CRUD
════════════════════════════════════════════════════ */
function tAddTool() {
  const catOpts = TOOL_CATEGORIES.map(c=>`<option value="${c}">${c}</option>`).join("");
  const prioOpts = Object.keys(TOOL_PRIORITY).map(k=>`<option value="${k}">${TOOL_PRIORITY[k].label}</option>`).join("");
  openModal("ツールを追加",
    `<label>ツール名</label><input id="tlName" placeholder="例: sqlmap">
     <label>一言サマリ</label><input id="tlSummary" placeholder="例: SQL injection の自動化ツール">
     <label>対応資格（スペース区切り）</label><input id="tlCerts" placeholder="OSWA OSCP">
     <label>カテゴリ</label><select id="tlCat">${catOpts}</select>
     <label>優先度</label><select id="tlPrio">${prioOpts}</select>
     <label>最初のコマンド（任意・ラベル|コマンド）</label><input id="tlCmd" placeholder="DB列挙|sqlmap -r request.txt --dbs --batch">
     <label>Tips（任意）</label><textarea id="tlTips" placeholder="実戦での使い方・注意点"></textarea>
     <label>参考リンク（任意・ラベル|URL）</label><input id="tlRef" placeholder="公式|https://sqlmap.org/">`,
    () => {
      const cmds = [];
      const cmdRaw = val("tlCmd");
      if (cmdRaw) { const [l,c]=cmdRaw.split("|"); cmds.push({id:uid(),label:(c?l:"").trim(),cmd:(c||l).trim(),note:""}); }
      const refs = [];
      const refRaw = val("tlRef");
      if (refRaw) { const [l,u]=refRaw.split("|"); refs.push({label:(u?l:u||l).trim(),url:(u||l).trim()}); }
      data.tools.push({
        id: uid(),
        name: val("tlName")||"無名ツール",
        summary: val("tlSummary"),
        certs: val("tlCerts").split(/\s+/).filter(Boolean),
        category: val("tlCat")||"その他",
        priority: val("tlPrio")||"opt",
        commands: cmds, tips: val("tlTips"), reference: refs,
        ts: Date.now(),
      });
      renderTools(); toast("✅ ツールを追加しました");
    });
}

function tEditTool(id) {
  const t = data.tools.find(x=>x.id===id); if (!t) return;
  const catOpts = TOOL_CATEGORIES.map(c=>`<option value="${c}" ${t.category===c?'selected':''}>${c}</option>`).join("");
  const prioOpts = Object.keys(TOOL_PRIORITY).map(k=>`<option value="${k}" ${t.priority===k?'selected':''}>${TOOL_PRIORITY[k].label}</option>`).join("");
  openModal("ツールを編集",
    `<label>ツール名</label><input id="tlName" value="${esc(t.name)}">
     <label>一言サマリ</label><input id="tlSummary" value="${esc(t.summary)}">
     <label>対応資格（スペース区切り）</label><input id="tlCerts" value="${esc((t.certs||[]).join(" "))}">
     <label>カテゴリ</label><select id="tlCat">${catOpts}</select>
     <label>優先度</label><select id="tlPrio">${prioOpts}</select>
     <label>Tips</label><textarea id="tlTips">${esc(t.tips)}</textarea>
     <label>参考リンク（1行に「ラベル|URL」）</label><textarea id="tlRefs">${esc((t.reference||[]).map(r=>`${r.label}|${r.url}`).join("\n"))}</textarea>`,
    () => {
      t.name=val("tlName")||"無名ツール"; t.summary=val("tlSummary");
      t.certs=val("tlCerts").split(/\s+/).filter(Boolean);
      t.category=val("tlCat"); t.priority=val("tlPrio"); t.tips=val("tlTips");
      t.reference = val("tlRefs").split("\n").map(line=>{
        const [l,u]=line.split("|"); if(!l&&!u) return null;
        return { label:(u?l:u||l).trim(), url:(u||l).trim() };
      }).filter(Boolean);
      renderToolDetail(); toast("✅ 更新しました");
    },
    { extraBtns: [{ label:"削除", cls:"btn-text btn-danger", fn:()=>{ closeModal(); tDelTool(id); } }] });
}

function tDelTool(id) {
  const t = data.tools.find(x=>x.id===id); if (!t) return;
  if (!confirm(`「${t.name}」を削除しますか？`)) return;
  data.tools = data.tools.filter(x=>x.id!==id);
  tBackList(); toast("🗑 削除しました");
}

function tAddCommand(id) {
  const t = data.tools.find(x=>x.id===id); if (!t) return;
  openModal("コマンドを追加",
    `<label>ラベル</label><input id="cLabel" placeholder="例: DB列挙">
     <label>コマンド</label><textarea id="cCmd" class="mono-input" placeholder="sqlmap -r request.txt --dbs --batch"></textarea>
     <label>補足（任意・改行可）</label><textarea id="cNote" placeholder="まず存在するDB名を列挙"></textarea>`,
    () => {
      t.commands.push({ id:uid(), label:val("cLabel"), cmd:val("cCmd"), note:val("cNote") });
      renderToolDetail(); toast("✅ コマンドを追加しました");
    });
}

function tEditCommand(toolId, cmdId) {
  const t = data.tools.find(x=>x.id===toolId); if (!t) return;
  const c = (t.commands||[]).find(x=>x.id===cmdId); if (!c) return;
  openModal("コマンドを編集",
    `<label>ラベル</label><input id="cLabel" value="${esc(c.label)}">
     <label>コマンド</label><textarea id="cCmd" class="mono-input">${esc(c.cmd)}</textarea>
     <label>補足（任意・改行可）</label><textarea id="cNote">${esc(c.note)}</textarea>`,
    () => {
      c.label=val("cLabel"); c.cmd=val("cCmd"); c.note=val("cNote");
      renderToolDetail(); toast("✅ コマンドを更新しました");
    },
    { extraBtns: [{ label:"削除", cls:"btn-text btn-danger", fn:()=>{ closeModal(); tDelCommand(toolId, cmdId); } }] });
}

function tDelCommand(toolId, cmdId) {
  const t = data.tools.find(x=>x.id===toolId); if (!t) return;
  const c = (t.commands||[]).find(x=>x.id===cmdId); if (!c) return;
  if (!confirm(`コマンド「${c.label||c.cmd.slice(0,20)}」を削除しますか？`)) return;
  t.commands = t.commands.filter(x=>x.id!==cmdId);
  renderToolDetail(); toast("🗑 削除しました");
}

function tMoveCommand(toolId, cmdId, dir) {
  const t = data.tools.find(x=>x.id===toolId); if (!t) return;
  const i = t.commands.findIndex(x=>x.id===cmdId); if (i<0) return;
  const j = i + dir;
  if (j < 0 || j >= t.commands.length) return;
  [t.commands[i], t.commands[j]] = [t.commands[j], t.commands[i]];
  renderToolDetail();
}

/* 検索 */
function renderToolsSearch() {
  const main = document.getElementById("main");
  const q = document.getElementById("searchInput").value.trim().toLowerCase();
  if (!q) { searchMode=false; render(); return; }
  const hits = data.tools.filter(t =>
    (t.name||"").toLowerCase().includes(q) ||
    (t.summary||"").toLowerCase().includes(q) ||
    (t.tips||"").toLowerCase().includes(q) ||
    (t.commands||[]).some(c=>(c.cmd||"").toLowerCase().includes(q)||(c.label||"").toLowerCase().includes(q)) ||
    (t.certs||[]).some(c=>c.toLowerCase().includes(q)) ||
    (t.category||"").toLowerCase().includes(q));
  renderToolsNav();
  main.innerHTML = `
    <div class="s-head"><h1>検索: ${esc(q)}</h1><span class="th-count">${hits.length} 件</span></div>
    ${hits.length ? `<div class="tool-grid">${hits.map(renderToolCard).join("")}</div>`
      : emptyState("search_off","一致するツールがありません","別のキーワードをお試しください")}
  `;
}

/* ═══════════════════════════════════════════════════
   初期データ（いただいた6ツール）
════════════════════════════════════════════════════ */
function toolsSeedIfEmpty() {
  if (data.tools.length || window.__toolsSeeded) return;
  window.__toolsSeeded = true;
  const seed = [
    {
      name: "nmap", certs: ["OSWA","OSCP"], category: "recon", priority: "must",
      summary: "ポートスキャンの定番。開いているポートとサービスを特定する。",
      commands: [
        { label: "基本スキャン (デフォルトスクリプト+バージョン)", cmd: "nmap -sC -sV -p- <TARGET>", note: "全ポート対象。時間はかかるが取りこぼしが少ない。" },
        { label: "高速スキャン (上位ポート)", cmd: "nmap -sC -sV --top-ports 1000 <TARGET>", note: "まず素早く当たりを付けたい時。" },
        { label: "UDPスキャン", cmd: "sudo nmap -sU --top-ports 100 <TARGET>", note: "UDPサービスの見落とし防止。" },
      ],
      tips: "おすすめというよりポートスキャンで必須。`-p-` で全ポート、`-sC -sV` でスクリプト＋バージョン検出。",
      reference: [{ label: "nmap 公式", url: "https://nmap.org/" }],
    },
    {
      name: "burp", certs: ["OSWA"], category: "web", priority: "must",
      summary: "Webアプリテストの必須プロキシ。特に Repeater / Intruder。",
      commands: [
        { label: "Repeater", cmd: "# リクエストを Repeater に送って改変・再送", note: "手動でパラメータを1つずつ検証する時の主力。" },
        { label: "Intruder", cmd: "# パラメータに位置を設定してペイロード総当り", note: "認証情報・SQLi・Fuzzing に。Community版は速度制限あり。" },
      ],
      tips: "おすすめというより Webアプリに対するテストでは必須。特に **Repeater** と **Intruder** を使いこなせるかが鍵。リクエストをファイル保存すれば sqlmap や ffuf に流用できる。",
      reference: [{ label: "PortSwigger (Burp)", url: "https://portswigger.net/burp" }],
    },
    {
      name: "dirsearch", certs: ["OSWA","OSCP"], category: "recon", priority: "rec",
      summary: "ディレクトリ探索。見つけたディレクトリを再帰的に探索してくれる。",
      commands: [
        { label: "基本", cmd: "dirsearch -u http://<TARGET> -w /usr/share/seclists/web-content/common.txt", note: "見つけたディレクトリに対して再帰的に探索してくれるので便利。" },
        { label: "拡張子を絞る", cmd: "dirsearch -u http://<TARGET> -e php,html,txt", note: "対象の技術スタックに合わせる。" },
      ],
      tips: "個人的には gobuster よりおすすめ。もしかしたら gobuster の方が速い、のようなことはあるかも。再帰探索が効くのが利点。",
      reference: [{ label: "dirsearch (GitHub)", url: "https://github.com/maurosoria/dirsearch" }],
    },
    {
      name: "sqlmap", certs: ["OSWA","OSCP"], category: "sqli", priority: "rec",
      summary: "SQL injection の自動化ツール。Burp のリクエストを保存して -r で渡せば楽。",
      commands: [
        { label: "DB列挙", cmd: "sqlmap -r request.txt --dbs --batch", note: "まず存在するDB名を列挙する。" },
        { label: "テーブル列挙", cmd: "sqlmap -r request.txt --dbms=mysql -D dbname --tables --batch", note: "DBを絞ってテーブル一覧を取得。" },
        { label: "dump (データ抽出)", cmd: "sqlmap -r request.txt --dbms=mysql -D dbname -T tablename --dump --batch", note: "最初から dump するととんでもない時間がかかる場合あり。テーブルまで絞ってから。" },
        { label: "--batch の意味", cmd: "# ユーザーへの問いを自動で yes にして進めてくれる", note: "" },
      ],
      tips: "POST のリクエストフォームを丸ごと txt ファイルにして **-r** オプションで投げれば楽ちん。**dbs → tables → dump** の順で徐々に狭めていくのがおすすめ。\n\n個人的な意見としては、SQL Injection を sqlmap に頼り切るのはおすすめしない。ある程度は手動でできるように練習したほうが良いと思います。",
      reference: [
        { label: "sqlmap 公式", url: "https://sqlmap.org/" },
        { label: "StationX — sqlmap cheat sheet", url: "https://www.stationx.net/sqlmap-cheat-sheet/" },
      ],
    },
    {
      name: "feroxbuster", certs: ["OSWA","OSCP"], category: "recon", priority: "opt",
      summary: "Webの隠しディレクトリ発見。最大の利点は再帰探索に対応しているところ。",
      commands: [
        { label: "基本", cmd: "feroxbuster -u http://<TARGET>", note: "デフォルトで再帰探索。" },
        { label: "ワードリスト指定", cmd: "feroxbuster -u http://<TARGET> -w /usr/share/seclists/Discovery/Web-Content/raft-medium-directories.txt", note: "" },
      ],
      tips: "Webの隠しディレクトリ発見に使える。最大の利点は再帰探索に対応しているところ。",
      reference: [{ label: "feroxbuster (GitHub)", url: "https://github.com/epi052/feroxbuster" }],
    },
    {
      name: "WebDetective", certs: ["OSWA"], category: "web", priority: "opt",
      summary: "XSSチェック / Ffuf / すべてを Burp プロキシ経由でルーティングするスクリプト。",
      commands: [
        { label: "概要", cmd: "# XSSチェック・Ffuf を Burp プロキシ経由で実行", note: "すべてを Burp 経由にルーティングするよう更新されている。" },
      ],
      tips: "このスクリプトは、XSSチェック、Ffuf、そしてすべてを Burp プロキシ経由でルーティングするように更新されている。",
      reference: [{ label: "web-detective (GitHub)", url: "https://github.com/arunwebber/web-detective" }],
    },
  ];
  seed.forEach(s => {
    s.id = uid(); s.ts = Date.now();
    s.commands = s.commands.map(c => ({ id: uid(), ...c }));
    data.tools.push(s);
  });
}
