/* ═══════════════════════════════════════════════════════
   TORIDE Cheat Sheet — app.js
   Data model: { tabs: [ { id, label, title, subtitle, blocks[] } ] }
   Block model: { id, label, tags[], headers[], rows[][] }
════════════════════════════════════════════════════════ */

/* ── STATE ─────────────────────────────────────────── */
let data       = { tabs: [] };
let activeId   = null;
let editMode   = false;
let modalCb    = null;
let activeTag  = null;          // currently filtered tag
let searchMode = false;         // true = showing cross-tab results

/* ── BOOT ───────────────────────────────────────────── */
(async function init() {
  try {
    const res = await fetch("data.json");
    if (!res.ok) throw new Error("fetch failed");
    data = await res.json();
    // ensure ids exist on every item
    data.tabs.forEach(t => {
      t.id = t.id || uid();
      (t.blocks || []).forEach(b => { b.id = b.id || uid(); b.tags = b.tags || []; });
    });
  } catch (e) {
    console.warn("data.json load failed, using empty data.", e);
    data = { tabs: [] };
  }
  activeId = data.tabs[0]?.id ?? null;
  render();
})();

/* ═══════════════════════════════════════════════════
   RENDER — top level
════════════════════════════════════════════════════ */
function render() {
  renderTabs();
  renderContent();
}

/* ── TABS ── */
function renderTabs() {
  const bar    = document.getElementById("tabsBar");
  const addBtn = bar.querySelector(".tab-add");
  bar.querySelectorAll(".tab-btn").forEach(el => el.remove());

  data.tabs.forEach((tab, ti) => {
    const btn = document.createElement("button");
    btn.className = "tab-btn" + (tab.id === activeId ? " active" : "");
    btn.dataset.id  = tab.id;
    btn.dataset.ti  = ti;
    btn.draggable   = true;

    // drag-and-drop reorder
    btn.addEventListener("dragstart", e => {
      e.dataTransfer.setData("tabId", tab.id);
      btn.classList.add("dragging");
    });
    btn.addEventListener("dragend",   () => btn.classList.remove("dragging"));
    btn.addEventListener("dragover",  e => { e.preventDefault(); btn.classList.add("drag-over"); });
    btn.addEventListener("dragleave", () => btn.classList.remove("drag-over"));
    btn.addEventListener("drop", e => {
      e.preventDefault();
      btn.classList.remove("drag-over");
      const srcId  = e.dataTransfer.getData("tabId");
      const srcIdx = data.tabs.findIndex(t => t.id === srcId);
      const dstIdx = data.tabs.findIndex(t => t.id === tab.id);
      if (srcIdx === dstIdx) return;
      const [moved] = data.tabs.splice(srcIdx, 1);
      data.tabs.splice(dstIdx, 0, moved);
      render();
    });

    const span = document.createElement("span");
    span.textContent = tab.label;
    span.className   = "editable";
    span.onclick = e => {
      if (!editMode) { switchTab(tab.id); return; }
      e.stopPropagation();
      openModal("タブ名を編集",
        `<label>タブ名（絵文字も使えます）</label><input id="mVal" value="${esc(tab.label)}">`,
        () => { const v = val("mVal"); if (v) { tab.label = v; render(); } });
    };

    const x = document.createElement("button");
    x.className = "tab-close";
    x.textContent = "×";
    x.title = "タブを削除";
    x.onclick = e => { e.stopPropagation(); deleteTab(tab.id); };

    btn.append(span, x);
    btn.onclick = () => switchTab(tab.id);
    bar.insertBefore(btn, addBtn);
  });
}

/* ── CONTENT ── */
function renderContent() {
  const el = document.getElementById("content");

  // ── cross-tab search results view ──
  if (searchMode) { renderSearchResults(el); return; }

  const tab = data.tabs.find(t => t.id === activeId);
  if (!tab) {
    el.innerHTML = `<div class="empty-state"><span class="big">📂</span><p>タブがありません</p>
      <p style="color:var(--text3);font-size:11px">編集モードで「＋」からタブを追加してください</p></div>`;
    return;
  }

  // ── tag filter bar ──
  const allTags = collectTags(tab);
  const tagBar  = allTags.length
    ? `<div class="tag-bar">${allTags.map(t =>
        `<button class="tag-pill${activeTag===t?' active':''}" onclick="filterTag('${esc(t)}')">#${esc(t)}</button>`
      ).join("")}
      ${activeTag ? `<button class="tag-clear" onclick="filterTag(null)">× クリア</button>` : ""}
      </div>` : "";

  // build content
  let html = `
    <div class="sec-head">
      <div class="sec-title-wrap">
        <div class="sec-title editable" data-field="title">${esc(tab.title)}</div>
        <div class="sec-sub  editable" data-field="subtitle">${esc(tab.subtitle)}</div>
      </div>
      <div class="sec-actions edit-only">
        <button class="sbtn sbtn-import" onclick="openImport()">📂 インポート</button>
        <button class="sbtn sbtn-add"    onclick="addBlock()">＋ テーブル追加</button>
      </div>
    </div>
    ${tagBar}`;

  if (tab.blocks.length === 0) {
    html += `<div class="empty-state"><span class="big">📊</span><p>ブロックがありません</p>
      <p style="color:var(--text3);font-size:11px">「＋ テーブル追加」からブロックを追加してください</p></div>`;
  }

  tab.blocks.forEach((blk, bi) => {
    // tag filter: skip if block doesn't match
    if (activeTag && !(blk.tags||[]).includes(activeTag)) return;

    const thCols = blk.headers.map((h, hi) =>
      `<th class="editable" data-bi="${bi}" data-hi="${hi}">${esc(h)}</th>`
    ).join("");

    const tbRows = blk.rows.map((row, ri) => {
      const cells = blk.headers.map((_, ci) => {
        const raw   = row[ci] ?? "";
        const rendered = renderMd(raw);
        return `<td class="editable md-cell" data-bi="${bi}" data-ri="${ri}" data-ci="${ci}">
          <div class="md-content">${rendered}</div>
          <button class="copy-btn" data-copy="${esc(raw)}" onclick="copyCell(event, this.dataset.copy)" title="コピー">⧉</button>
        </td>`;
      }).join("");

      return `<tr data-bi="${bi}" data-ri="${ri}">
        ${cells}
        <td class="row-act edit-only">
          <div class="row-btns">
            <button class="rbtn rbtn-up"  onclick="moveRow(${bi},${ri},-1)" title="上へ">↑</button>
            <button class="rbtn rbtn-dn"  onclick="moveRow(${bi},${ri}, 1)" title="下へ">↓</button>
            <button class="rbtn rbtn-del" onclick="delRow(${bi},${ri})"     title="削除">✕</button>
          </div>
        </td>
      </tr>`;
    }).join("");

    // block tags display
    const blkTags = (blk.tags||[]).map(t =>
      `<span class="blk-tag" onclick="filterTag('${esc(t)}')">#${esc(t)}</span>`
    ).join("");

    html += `
      <div class="block" data-bi="${bi}">
        <div class="block-head">
          <div class="block-label editable" data-bi="${bi}" data-field="label">${esc(blk.label)}</div>
          ${blkTags ? `<div class="blk-tags">${blkTags}</div>` : ""}
          <div class="block-actions">
            <div class="blk-menu-wrap">
              <button class="blk-menu-btn" onclick="toggleBlockMenu(event,${bi})" title="ブロックメニュー">⋮</button>
              <div class="blk-menu" id="blkmenu-${bi}">
                <button onclick="exportBlock(${bi})">📤 JSONエクスポート</button>
                <button onclick="duplicateBlock(${bi})">📋 複製</button>
                <button onclick="moveBlockToTab(${bi})">↗ 別タブへ移動</button>
                <button class="edit-only-mi" onclick="moveBlock(${bi},-1)">⬆ 上へ移動</button>
                <button class="edit-only-mi" onclick="moveBlock(${bi}, 1)">⬇ 下へ移動</button>
                <button class="edit-only-mi" onclick="editBlockTags(${bi})">🏷 タグ編集</button>
                <button class="edit-only-mi" onclick="addColumn(${bi})">＋ 列追加</button>
                <button class="edit-only-mi" onclick="delColumn(${bi})">－ 列削除</button>
                <button class="edit-only-mi danger-mi" onclick="delBlock(${bi})">🗑 削除</button>
              </div>
            </div>
          </div>
        </div>
        <div class="tbl-wrap">
          <table>
            <thead><tr>${thCols}<th class="edit-only" style="width:80px"></th></tr></thead>
            <tbody>${tbRows}</tbody>
          </table>
        </div>
        <button class="add-row-btn edit-only" onclick="addRow(${bi})">＋ 行を追加</button>
      </div>`;
  });

  el.innerHTML = html;
  bindEditableHandlers();
}

/* ── SEARCH RESULTS VIEW ── */
function renderSearchResults(el) {
  const q = document.getElementById("searchInput").value.trim().toLowerCase();
  if (!q) { searchMode = false; renderContent(); return; }

  let resultHTML = `<div class="search-results-header">
    <span>🔍 「${esc(q)}」の検索結果</span>
    <button class="sbtn" onclick="clearSearch()">✕ 閉じる</button>
  </div>`;

  let totalHits = 0;
  data.tabs.forEach(tab => {
    tab.blocks.forEach(blk => {
      const matchRows = blk.rows.filter(row =>
        row.some(c => (c||"").toLowerCase().includes(q)) ||
        (blk.label||"").toLowerCase().includes(q)
      );
      if (!matchRows.length) return;
      totalHits += matchRows.length;

      const thCols = blk.headers.map(h => `<th>${esc(h)}</th>`).join("");
      const tbRows = matchRows.map(row => {
        const cells = blk.headers.map((_, ci) => {
          const raw = row[ci] ?? "";
          return `<td>${highlightStr(esc(raw), q)}</td>`;
        }).join("");
        return `<tr>${cells}</tr>`;
      }).join("");

      resultHTML += `
        <div class="search-result-group">
          <div class="search-result-meta">
            <span class="sr-tab">${esc(tab.label)}</span>
            <span class="sr-arrow">›</span>
            <span class="sr-block">${esc(blk.label)}</span>
            <button class="sbtn sr-goto" onclick="gotoTab('${tab.id}')">→ タブへ移動</button>
          </div>
          <div class="tbl-wrap">
            <table><thead><tr>${thCols}</tr></thead><tbody>${tbRows}</tbody></table>
          </div>
        </div>`;
    });
  });

  if (!totalHits) {
    resultHTML += `<div class="empty-state"><span class="big">🔍</span>
      <p>「${esc(q)}」に一致する結果が見つかりませんでした</p></div>`;
  }

  el.innerHTML = resultHTML;
}

/* ── EDITABLE HANDLERS ── */
function bindEditableHandlers() {
  const tab = data.tabs.find(t => t.id === activeId);
  if (!tab) return;
  document.querySelectorAll(".editable").forEach(node => {
    node.addEventListener("click", () => {
      if (!editMode) return;
      if (node.dataset.field === "title") {
        openModal("タイトルを編集",
          `<label>タイトル</label><input id="mVal" value="${esc(tab.title)}">`,
          () => { tab.title = val("mVal"); renderContent(); }); return;
      }
      if (node.dataset.field === "subtitle") {
        openModal("サブタイトルを編集",
          `<label>サブタイトル</label><input id="mVal" value="${esc(tab.subtitle)}">`,
          () => { tab.subtitle = val("mVal"); renderContent(); }); return;
      }
      if (node.dataset.field === "label") {
        const bi = +node.dataset.bi;
        openModal("カテゴリ名を編集",
          `<label>カテゴリ名</label><input id="mVal" value="${esc(tab.blocks[bi].label)}">`,
          () => { tab.blocks[bi].label = val("mVal"); renderContent(); }); return;
      }
      if (node.dataset.hi !== undefined) {
        const bi = +node.dataset.bi, hi = +node.dataset.hi;
        openModal("ヘッダーを編集",
          `<label>ヘッダー名</label><input id="mVal" value="${esc(tab.blocks[bi].headers[hi])}">`,
          () => { tab.blocks[bi].headers[hi] = val("mVal"); renderContent(); }); return;
      }
      if (node.dataset.ci !== undefined) {
        const bi = +node.dataset.bi, ri = +node.dataset.ri, ci = +node.dataset.ci;
        const current = tab.blocks[bi].rows[ri][ci] ?? "";
        openModal(`セルを編集 — ${esc(tab.blocks[bi].headers[ci])}`,
          `<label>内容（Markdownが使えます）</label>
           <textarea id="mVal" style="min-height:120px;font-family:'JetBrains Mono',monospace">${esc(current)}</textarea>
           <div style="font-size:10px;color:var(--text3);margin-top:-8px">
             \`code\` **bold** # 見出し [link](url) \`\`\`コードブロック\`\`\`
           </div>`,
          () => { tab.blocks[bi].rows[ri][ci] = val("mVal"); renderContent(); });
      }
    });
  });
}

/* ═══════════════════════════════════════════════════
   SEARCH
════════════════════════════════════════════════════ */
document.getElementById("searchInput").addEventListener("input", function () {
  const q = this.value.trim().toLowerCase();
  if (!q) { searchMode = false; activeTag = null; renderContent(); return; }
  searchMode = true;
  renderContent();
});

function clearSearch() {
  document.getElementById("searchInput").value = "";
  searchMode = false;
  activeTag  = null;
  renderContent();
}

function gotoTab(id) {
  searchMode = false;
  document.getElementById("searchInput").value = "";
  activeId = id;
  render();
}

/* ═══════════════════════════════════════════════════
   TAG FILTER
════════════════════════════════════════════════════ */
function filterTag(tag) {
  activeTag = tag;
  searchMode = false;
  renderContent();
}

function collectTags(tab) {
  const set = new Set();
  (tab.blocks||[]).forEach(b => (b.tags||[]).forEach(t => set.add(t)));
  return [...set];
}

function editBlockTags(bi) {
  const blk = curTab().blocks[bi];
  openModal("タグを編集",
    `<label>タグ（スペース区切り、# 不要）</label>
     <input id="mVal" value="${esc((blk.tags||[]).join(" "))}" placeholder="例: linux forensics privilege-escalation">`,
    () => {
      blk.tags = val("mVal").split(/\s+/).map(s => s.replace(/^#/,"").trim()).filter(Boolean);
      renderContent();
    });
}

/* ═══════════════════════════════════════════════════
   MARKDOWN RENDER (micro implementation)
════════════════════════════════════════════════════ */
function renderMd(raw) {
  if (!raw) return "";
  let s = esc(raw);
  // ── FIX: コード部分を一旦退避し、装飾(** * 等)の対象から外す ──
  //    これが無いと `zcat 2023-10-*/dns.*.gz` の * が斜体記法と誤認されコマンドが壊れる
  const __stash = [];
  const __keep  = (html) => `\u0000${__stash.push(html) - 1}\u0000`;
  // code block (``` ... ```)
  s = s.replace(/```([^`]*?)```/gs, (_, code) =>
    __keep(`<pre class="md-code">${code.replace(/&lt;/g,"<").replace(/&gt;/g,">").replace(/&amp;/g,"&")}</pre>`));
  // inline code
  s = s.replace(/`([^`]+)`/g, (_, c) => __keep(`<code class="md-inline">${c}</code>`));
  // bold
  s = s.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  // italic
  s = s.replace(/\*(.+?)\*/g, "<em>$1</em>");
  // link
  s = s.replace(/\[([^\]]+)\]\(([^)]+)\)/g,
    (_, text, href) => `<a href="${esc(href)}" target="_blank" rel="noopener">${text}</a>`);
  // heading
  s = s.replace(/^#{1,3} (.+)$/gm, (_, t) => `<strong class="md-heading">${t}</strong>`);
  // list items
  s = s.replace(/^[-*] (.+)$/gm, (_, t) => `<span class="md-li">• ${t}</span>`);
  // newlines → <br> (outside pre blocks)
  s = s.replace(/\n/g, "<br>");
  // ── FIX: 退避したコードを復元 ──
  s = s.replace(/\u0000(\d+)\u0000/g, (_, i) => __stash[i]);
  s = s.replace(/<\/pre><br>/g, "</pre>");
  return s;
}

function highlightStr(escaped, q) {
  const lower = escaped.toLowerCase();
  let result = "", i = 0;
  while (i < escaped.length) {
    const idx = lower.indexOf(q, i);
    if (idx < 0) { result += escaped.slice(i); break; }
    result += escaped.slice(i, idx) +
      `<mark>${escaped.slice(idx, idx + q.length)}</mark>`;
    i = idx + q.length;
  }
  return result;
}

/* ═══════════════════════════════════════════════════
   COPY
════════════════════════════════════════════════════ */
function copyCell(e, text) {
  e.stopPropagation();
  navigator.clipboard.writeText(text).then(() => {
    const btn = e.target;
    btn.textContent = "✓";
    setTimeout(() => { btn.textContent = "⧉"; }, 1200);
  });
}

/* ═══════════════════════════════════════════════════
   BLOCK MENU
════════════════════════════════════════════════════ */
function toggleBlockMenu(e, bi) {
  e.stopPropagation();
  const menu = document.getElementById(`blkmenu-${bi}`);
  // close all other menus first
  document.querySelectorAll(".blk-menu.open").forEach(m => {
    if (m !== menu) m.classList.remove("open");
  });
  menu.classList.toggle("open");
}
document.addEventListener("click", () => {
  document.querySelectorAll(".blk-menu.open").forEach(m => m.classList.remove("open"));
});

/* ── block export ── */
function exportBlock(bi) {
  const blk  = curTab().blocks[bi];
  const json  = JSON.stringify({ type: "block", label: blk.label, tags: blk.tags||[], headers: blk.headers, rows: blk.rows }, null, 2);
  const blob  = new Blob([json], { type: "application/json" });
  const a     = Object.assign(document.createElement("a"), {
    href: URL.createObjectURL(blob),
    download: `block_${blk.label.replace(/\s+/g,"_")}_${yyyymmdd()}.json`
  });
  a.click();
  toast("📤 ブロックをエクスポートしました");
}

/* ── block duplicate ── */
function duplicateBlock(bi) {
  const tab = curTab();
  const src  = tab.blocks[bi];
  const copy = JSON.parse(JSON.stringify(src));
  copy.id    = uid();
  copy.label = src.label + " (コピー)";
  tab.blocks.splice(bi + 1, 0, copy);
  renderContent();
  toast("📋 ブロックを複製しました");
}

/* ── move block to another tab ── */
function moveBlockToTab(bi) {
  const srcTab = curTab();
  const others = data.tabs.filter(t => t.id !== activeId);
  if (!others.length) { toast("移動先のタブがありません"); return; }
  const opts = others.map(t => `<option value="${t.id}">${esc(t.label)}</option>`).join("");
  openModal("別タブへ移動",
    `<label>移動先タブを選択</label><select id="mDst">${opts}</select>`,
    () => {
      const dstId  = document.getElementById("mDst").value;
      const dst    = data.tabs.find(t => t.id === dstId);
      const [blk]  = srcTab.blocks.splice(bi, 1);
      dst.blocks.push(blk);
      renderContent();
      toast(`↗ 「${blk.label}」を「${dst.label}」へ移動しました`);
    });
}

/* ═══════════════════════════════════════════════════
   IMPORT
════════════════════════════════════════════════════ */
function openImport() {
  openModal("JSONインポート",
    `<label>JSONファイルを選択</label>
     <input type="file" id="mFile" accept=".json" style="color:var(--text);padding:4px 0">`,
    () => {
      const file = document.getElementById("mFile")?.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = e => { handleImportJSON(e.target.result); };
      reader.readAsText(file);
    });
}

function handleImportJSON(raw) {
  let parsed;
  try { parsed = JSON.parse(raw); }
  catch { toast("❌ JSONパースエラー"); return; }

  // ── tab import ──
  if (parsed.tabs && Array.isArray(parsed.tabs)) {
    const opts = `<div id="mImportMode" style="display:flex;flex-direction:column;gap:6px">
      <label><input type="radio" name="iMode" value="overwrite" checked> 既存データを上書き</label>
      <label><input type="radio" name="iMode" value="add"> 新規タブとして追加</label>
    </div>`;
    openModal("タブデータのインポート", opts, () => {
      const mode = document.querySelector('input[name="iMode"]:checked')?.value;
      parsed.tabs.forEach(t => { t.id = t.id || uid(); (t.blocks||[]).forEach(b => { b.id=b.id||uid(); b.tags=b.tags||[]; }); });
      if (mode === "overwrite") {
        data = parsed;
        activeId = data.tabs[0]?.id ?? null;
      } else {
        parsed.tabs.forEach(t => data.tabs.push(t));
        activeId = parsed.tabs[0]?.id ?? activeId;
      }
      render();
      toast(`✅ タブをインポートしました（${parsed.tabs.length}タブ）`);
    });
    return;
  }

  // ── block import ──
  if (parsed.type === "block") {
    if (!Array.isArray(parsed.headers) || !Array.isArray(parsed.rows)) {
      toast("❌ ブロックJSONのフォーマットが不正です"); return;
    }
    const opts = data.tabs.map(t => `<option value="${t.id}">${esc(t.label)}</option>`).join("");
    openModal("ブロックのインポート先を選択",
      `<label>追加先タブ</label>
       <select id="mDst">
         <option value="__current__">現在のタブ（${esc(curTab()?.label||"")}）</option>
         ${opts}
       </select>`,
      () => {
        let dstId = document.getElementById("mDst").value;
        if (dstId === "__current__") dstId = activeId;
        const dst = data.tabs.find(t => t.id === dstId);
        if (!dst) { toast("❌ 追加先タブが見つかりません"); return; }
        const blk = { id: uid(), label: parsed.label || "インポートブロック", tags: parsed.tags||[], headers: parsed.headers, rows: parsed.rows };
        dst.blocks.push(blk);
        if (activeId !== dstId) { activeId = dstId; render(); }
        else renderContent();
        toast(`✅ ブロック「${blk.label}」をインポートしました`);
      });
    return;
  }

  toast("❌ 対応していないJSONフォーマットです（type: tab / block が必要）");
}


/* ═══════════════════════════════════════════════════
   SAVE TO GITHUB
════════════════════════════════════════════════════ */
async function saveToGitHub() {
  const btn = document.getElementById("saveBtn");
  if (btn) { btn.disabled = true; btn.textContent = "⏳ 保存中..."; }
  try {
    const json = JSON.stringify(data, null, 2);
    const res  = await fetch("/save", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: json,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: res.statusText }));
      throw new Error(err.error || res.statusText);
    }
    const result = await res.json();
    toast("✅ GitHubに保存しました (commit: " + (result.commit?.slice(0,7) ?? "ok") + ")");
  } catch (e) {
    toast("❌ 保存失敗: " + e.message);
    console.error(e);
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = "💾 保存"; }
  }
}

/* ═══════════════════════════════════════════════════
   EXPORT — JSON & HTML
════════════════════════════════════════════════════ */
function exportJSON() {
  const json = JSON.stringify(data, null, 2);
  const blob = new Blob([json], { type: "application/json" });
  const a    = Object.assign(document.createElement("a"), {
    href: URL.createObjectURL(blob),
    download: `toride_data_${yyyymmdd()}.json`
  });
  a.click();
  toast("📥 data.json をエクスポートしました");
}

function exportHTML() {
  // fetch the current HTML source and inject data
  fetch("index.html")
    .then(r => r.text())
    .then(src => {
      const json   = JSON.stringify(data);
      // inject a <script> that pre-loads data before app.js fetch
      const inject = `<script>window.__PRELOADED_DATA__ = ${json};<\/script>\n`;
      const output = src.replace("</head>", inject + "</head>");
      const blob   = new Blob([output], { type: "text/html;charset=utf-8" });
      const a      = Object.assign(document.createElement("a"), {
        href: URL.createObjectURL(blob),
        download: `toride_cheatsheet_${yyyymmdd()}.html`
      });
      a.click();
      toast("📥 HTMLを書き出しました");
    })
    .catch(() => {
      // fallback: just download JSON
      exportJSON();
      toast("⚠️ HTML書き出し失敗。JSONをエクスポートしました");
    });
}

/* ═══════════════════════════════════════════════════
   EDIT MODE
════════════════════════════════════════════════════ */
function toggleEdit() {
  editMode = !editMode;
  document.body.classList.toggle("edit", editMode);
  const btn = document.getElementById("editBtn");
  btn.classList.toggle("on", editMode);
  btn.innerHTML = editMode ? "✏️ <em>編集中</em>" : "✏️ <em>編集</em>";
  renderContent();
}

/* ═══════════════════════════════════════════════════
   TAB CRUD
════════════════════════════════════════════════════ */
function switchTab(id) {
  activeId   = id;
  activeTag  = null;
  searchMode = false;
  document.getElementById("searchInput").value = "";
  render();
}

function addTab() {
  openModal("新しいタブを追加",
    `<label>タブ名（絵文字も使えます）</label>
     <input id="mLabel" placeholder="例: 🔥 攻撃手法">
     <label>タイトル</label>
     <input id="mTitle" placeholder="例: // ATTACK TECHNIQUES">
     <label>サブタイトル（任意）</label>
     <input id="mSub"   placeholder="簡単な説明">`,
    () => {
      const label = val("mLabel") || "新しいタブ";
      const t = { id: uid(), label, title: val("mTitle") || `// ${label}`, subtitle: val("mSub"), blocks: [] };
      data.tabs.push(t);
      activeId = t.id;
      render();
    });
}

function deleteTab(id) {
  const tab = data.tabs.find(t => t.id === id);
  if (!confirm(`「${tab.label}」を削除しますか？`)) return;
  data.tabs = data.tabs.filter(t => t.id !== id);
  if (activeId === id) activeId = data.tabs[0]?.id ?? null;
  render();
}

/* ═══════════════════════════════════════════════════
   BLOCK CRUD
════════════════════════════════════════════════════ */
function addBlock() {
  openModal("テーブルブロックを追加",
    `<label>カテゴリ名</label>
     <input id="mLabel" placeholder="例: ログオン / 認証">
     <label>列数</label>
     <select id="mCols">
       <option value="2">2列</option>
       <option value="3" selected>3列</option>
       <option value="4">4列</option>
       <option value="5">5列</option>
       <option value="6">6列</option>
     </select>`,
    () => {
      const n   = parseInt(document.getElementById("mCols").value);
      const blk = {
        id: uid(),
        label: val("mLabel") || "新しいカテゴリ",
        tags:  [],
        headers: Array.from({ length: n }, (_, i) => `列${i + 1}`),
        rows: []
      };
      curTab().blocks.push(blk);
      renderContent();
    });
}

function delBlock(bi) {
  const tab = curTab();
  if (!confirm(`「${tab.blocks[bi].label}」を削除しますか？`)) return;
  tab.blocks.splice(bi, 1);
  renderContent();
}

function addColumn(bi) {
  openModal("列を追加",
    `<label>列ヘッダー名</label><input id="mVal" placeholder="新しい列">`,
    () => {
      const blk = curTab().blocks[bi];
      blk.headers.push(val("mVal") || "新しい列");
      blk.rows.forEach(r => r.push(""));
      renderContent();
    });
}

function delColumn(bi) {
  const blk = curTab().blocks[bi];
  if (blk.headers.length <= 1) { toast("❌ 列が1つしかないため削除できません"); return; }
  const opts = blk.headers.map((h, i) =>
    `<option value="${i}">${esc(h)}</option>`
  ).join("");
  openModal("列を削除",
    `<label>削除する列を選択</label><select id="mVal">${opts}</select>
     <p style="color:var(--red);font-family:'JetBrains Mono',monospace;font-size:11px;margin-top:4px">⚠ その列のデータもすべて削除されます</p>`,
    () => {
      const ci = parseInt(val("mVal"));
      blk.headers.splice(ci, 1);
      blk.rows.forEach(r => r.splice(ci, 1));
      renderContent();
    });
}

function moveBlock(bi, dir) {
  const blocks = curTab().blocks;
  const ni     = bi + dir;
  if (ni < 0 || ni >= blocks.length) return;
  [blocks[bi], blocks[ni]] = [blocks[ni], blocks[bi]];
  renderContent();
}

/* ═══════════════════════════════════════════════════
   ROW CRUD
════════════════════════════════════════════════════ */
function addRow(bi) {
  const blk    = curTab().blocks[bi];
  const fields = blk.headers.map((h, i) =>
    `<label>${esc(h)}</label><input class="mRowField" data-ci="${i}" placeholder="空欄も可">`
  ).join("");
  openModal("行を追加", fields, () => {
    const row = Array.from(document.querySelectorAll(".mRowField")).map(el => el.value);
    blk.rows.push(row);
    renderContent();
  });
}

function delRow(bi, ri) {
  if (!confirm("この行を削除しますか？")) return;
  curTab().blocks[bi].rows.splice(ri, 1);
  renderContent();
}

function moveRow(bi, ri, dir) {
  const rows = curTab().blocks[bi].rows;
  const ni   = ri + dir;
  if (ni < 0 || ni >= rows.length) return;
  [rows[ri], rows[ni]] = [rows[ni], rows[ri]];
  renderContent();
}

/* ═══════════════════════════════════════════════════
   MODAL
════════════════════════════════════════════════════ */
function openModal(title, bodyHTML, cb) {
  document.getElementById("modalTitle").textContent = title;
  document.getElementById("modalBody").innerHTML = bodyHTML;
  document.getElementById("modalOverlay").classList.add("open");
  modalCb = cb;
  setTimeout(() => document.querySelector("#modalBody input:not([type=radio]):not([type=file]),#modalBody textarea,#modalBody select")?.focus(), 40);
}
function closeModal() { document.getElementById("modalOverlay").classList.remove("open"); modalCb = null; }
function confirmModal() { modalCb?.(); closeModal(); }

document.getElementById("modalOverlay").addEventListener("click", e => { if (e.target === e.currentTarget) closeModal(); });

/* ═══════════════════════════════════════════════════
   KEYBOARD
════════════════════════════════════════════════════ */
document.addEventListener("keydown", e => {
  if ((e.ctrlKey || e.metaKey) && e.key === "k") { e.preventDefault(); document.getElementById("searchInput").focus(); }
  if (e.key === "Escape") {
    if (document.getElementById("modalOverlay").classList.contains("open")) { closeModal(); return; }
    clearSearch();
  }
  if (e.key === "Enter" && document.getElementById("modalOverlay").classList.contains("open")) {
    if (document.activeElement.tagName !== "TEXTAREA" && document.activeElement.type !== "file") {
      e.preventDefault(); confirmModal();
    }
  }
});

/* ═══════════════════════════════════════════════════
   UTILS
════════════════════════════════════════════════════ */
function uid()      { return Math.random().toString(36).slice(2, 9); }
function esc(s)     { return String(s ?? "").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;"); }
function val(id)    { return document.getElementById(id)?.value ?? ""; }
function curTab()   { return data.tabs.find(t => t.id === activeId); }
function yyyymmdd() { return new Date().toISOString().slice(0,10); }

function toast(msg) {
  const el = document.getElementById("toast");
  el.textContent = msg;
  el.classList.add("show");
  clearTimeout(toast._t);
  toast._t = setTimeout(() => el.classList.remove("show"), 2600);
}

/* preloaded data support (for exported single-file HTML) */
if (window.__PRELOADED_DATA__) {
  const d = window.__PRELOADED_DATA__;
  d.tabs.forEach(t => { t.id=t.id||uid(); (t.blocks||[]).forEach(b=>{ b.id=b.id||uid(); b.tags=b.tags||[]; }); });
  data    = d;
  activeId = d.tabs[0]?.id ?? null;
}
