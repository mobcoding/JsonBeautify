const elements = {
  openOptions: document.querySelector("#openOptions"),
  openSidePanel: document.querySelector("#openSidePanel"),

  tabs: Array.from(document.querySelectorAll(".tab")),
  tabPanels: Array.from(document.querySelectorAll(".tab-panel")),

  indentSize: document.querySelector("#indentSize"),
  sortKeysToggle: document.querySelector("#sortKeysToggle"),
  sampleData: document.querySelector("#sampleData"),
  importFromPage: document.querySelector("#importFromPage"),
  clearInput: document.querySelector("#clearInput"),
  inputText: document.querySelector("#inputText"),
  formatNow: document.querySelector("#formatNow"),
  validateNow: document.querySelector("#validateNow"),
  minifyNow: document.querySelector("#minifyNow"),

  outputWrap: document.querySelector("#outputWrap"),
  outputText: document.querySelector("#outputText"),
  statsBlock: document.querySelector("#statsBlock"),
  statLines: document.querySelector("#statLines"),
  statBytes: document.querySelector("#statBytes"),
  statKeys: document.querySelector("#statKeys"),
  statDepth: document.querySelector("#statDepth"),
  copyOutput: document.querySelector("#copyOutput"),
  downloadOutput: document.querySelector("#downloadOutput"),
  swapToInput: document.querySelector("#swapToInput"),

  expandLevel: document.querySelector("#expandLevel"),
  refreshTree: document.querySelector("#refreshTree"),
  expandAllTree: document.querySelector("#expandAllTree"),
  collapseAllTree: document.querySelector("#collapseAllTree"),
  treeContainer: document.querySelector("#treeContainer"),

  escapeInput: document.querySelector("#escapeInput"),
  escapeNow: document.querySelector("#escapeNow"),
  unescapeNow: document.querySelector("#unescapeNow"),
  escapeOutput: document.querySelector("#escapeOutput"),
  copyEscapeOutput: document.querySelector("#copyEscapeOutput"),

  sortInput: document.querySelector("#sortInput"),
  sortNow: document.querySelector("#sortNow"),
  sortOutput: document.querySelector("#sortOutput"),
  copySortOutput: document.querySelector("#copySortOutput"),

  compareA: document.querySelector("#compareA"),
  compareB: document.querySelector("#compareB"),
  compareNow: document.querySelector("#compareNow"),
  compareOutput: document.querySelector("#compareOutput"),

  statusDot: document.querySelector("#statusDot"),
  statusTitle: document.querySelector("#statusTitle"),
  statusText: document.querySelector("#statusText")
};

let currentSettings = null;
let currentFormatted = "";
let currentTree = null;
let currentValid = true;

const SAMPLE_JSON = `{
  "name": "JSON Beautify",
  "version": "1.0.0",
  "enabled": true,
  "features": ["format", "minify", "validate", "tree-view"],
  "stats": {
    "lines": 128,
    "bytes": 4096
  },
  "author": null
}`;

document.addEventListener("DOMContentLoaded", init);

elements.openOptions.addEventListener("click", () => chrome.runtime.openOptionsPage());
elements.openSidePanel.addEventListener("click", async (e) => {
  e.preventDefault();
  try {
    if (chrome.sidePanel?.open) {
      await chrome.sidePanel.open({ windowId: chrome.windows.WINDOW_ID_CURRENT });
    }
  } catch (error) {
    showStatus("侧栏不可用", error.message, "bad");
  }
});

elements.tabs.forEach((tab) => {
  tab.addEventListener("click", () => switchTab(tab.dataset.view));
});

elements.sampleData.addEventListener("click", () => {
  elements.inputText.value = SAMPLE_JSON;
  showStatus("已载入示例", "你可以点击“美化格式化”查看效果。", "good");
});
elements.importFromPage.addEventListener("click", importFromPage);
elements.clearInput.addEventListener("click", () => {
  elements.inputText.value = "";
  hideOutput();
  showStatus("已清空输入", "粘贴或输入 JSON 后继续操作。", "");
});

elements.formatNow.addEventListener("click", formatCurrent);
elements.validateNow.addEventListener("click", validateCurrent);
elements.minifyNow.addEventListener("click", minifyCurrent);
elements.copyOutput.addEventListener("click", () => copyText(currentFormatted, elements.outputText));
elements.downloadOutput.addEventListener("click", downloadJson);
elements.swapToInput.addEventListener("click", swapOutputToInput);

elements.refreshTree.addEventListener("click", refreshTreeFromInput);
elements.expandAllTree.addEventListener("click", () => setTreeExpandAll(true));
elements.collapseAllTree.addEventListener("click", () => setTreeExpandAll(false));

elements.escapeNow.addEventListener("click", () => runEscape(false));
elements.unescapeNow.addEventListener("click", () => runEscape(true));
elements.copyEscapeOutput.addEventListener("click", () => copyText(elements.escapeOutput.textContent || "", elements.escapeOutput));

elements.sortNow.addEventListener("click", runSortKeys);
elements.copySortOutput.addEventListener("click", () => copyText(elements.sortOutput.textContent || "", elements.sortOutput));

elements.compareNow.addEventListener("click", runCompare);

elements.inputText.addEventListener("input", () => {
  currentValid = true;
  if (elements.outputWrap.hidden) return;
});

async function init() {
  try {
    currentSettings = await request({ type: "GET_SETTINGS" });
    applySettingsToUi(currentSettings);
    showStatus("准备就绪", "粘贴 JSON 文本后点击“美化格式化”。", "good");
    tryPrefillFromSelection();
  } catch (error) {
    showStatus("无法读取设置", error.message, "bad");
  }
}

function applySettingsToUi(settings) {
  if (settings.useTabIndent) {
    elements.indentSize.value = "tab";
  } else {
    elements.indentSize.value = String(settings.indentSize);
  }
  elements.sortKeysToggle.checked = Boolean(settings.sortKeys);
  elements.expandLevel.value = String(settings.expandLevel ?? 1);
}

function collectInlineSettings() {
  const indent = elements.indentSize.value;
  return {
    indentSize: indent === "tab" ? 4 : parseInt(indent, 10) || 2,
    useTabIndent: indent === "tab",
    sortKeys: elements.sortKeysToggle.checked,
    expandLevel: parseInt(elements.expandLevel.value, 10) || 1
  };
}

function switchTab(view) {
  elements.tabs.forEach((t) => {
    const active = t.dataset.view === view;
    t.classList.toggle("active", active);
    t.setAttribute("aria-selected", active ? "true" : "false");
  });
  elements.tabPanels.forEach((p) => {
    const show = p.dataset.view === view;
    p.classList.toggle("active", show);
    p.hidden = !show;
  });

  if (view === "tree" && !currentTree) {
    refreshTreeFromInput();
  }
}

async function tryPrefillFromSelection() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) return;
    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => (window.getSelection()?.toString() || "").trim()
    });
    const selection = results?.[0]?.result || "";
    if (looksLikeJson(selection)) {
      elements.inputText.value = selection;
      showStatus("已自动带入选中内容", "检测到选中文本类似 JSON，已填入输入框。", "good");
    }
  } catch {
    // 忽略，不影响主流程
  }
}

function looksLikeJson(text) {
  const t = String(text || "").trim();
  return (t.startsWith("{") && t.endsWith("}")) || (t.startsWith("[") && t.endsWith("]"));
}

async function formatCurrent() {
  const text = elements.inputText.value;
  if (!text.trim()) {
    showStatus("输入为空", "请先粘贴或输入 JSON 文本。", "bad");
    return;
  }

  setBusy(true);
  showStatus("正在格式化", "正在解析并美化 JSON...", "");

  try {
    const result = await request({
      type: "FORMAT_JSON",
      payload: { text, settings: collectInlineSettings() }
    });

    if (!result.isValid) {
      currentValid = false;
      showValidationError(result.error);
      return;
    }

    currentFormatted = result.formatted;
    currentValid = true;
    renderOutput(result.formatted, result.stats, true);
    showStatus("格式化完成", "结果已输出，可复制或下载为 .json 文件。", "good");
  } catch (error) {
    showStatus("格式化失败", error.message, "bad");
  } finally {
    setBusy(false);
  }
}

async function validateCurrent() {
  const text = elements.inputText.value;
  if (!text.trim()) {
    showStatus("输入为空", "请先粘贴或输入 JSON 文本。", "bad");
    return;
  }

  setBusy(true);
  showStatus("正在验证", "正在检查 JSON 语法...", "");

  try {
    const result = await request({ type: "VALIDATE_JSON", payload: { text } });

    if (!result.isValid) {
      currentValid = false;
      showValidationError(result.error);
      return;
    }

    currentValid = true;
    const stats = result.stats || {};
    showStatus(
      "验证通过 ✓",
      `该 JSON 语法正确。共 ${stats.lineCount ?? "?"} 行，约 ${stats.byteLength ?? "?"} 字节，深度 ${stats.maxDepth ?? "?"} 层。`,
      "good"
    );
  } catch (error) {
    showStatus("验证失败", error.message, "bad");
  } finally {
    setBusy(false);
  }
}

async function minifyCurrent() {
  const text = elements.inputText.value;
  if (!text.trim()) {
    showStatus("输入为空", "请先粘贴或输入 JSON 文本。", "bad");
    return;
  }

  setBusy(true);
  showStatus("正在压缩", "正在生成单行紧凑 JSON...", "");

  try {
    const result = await request({ type: "MINIFY_JSON", payload: { text } });

    if (!result.isValid) {
      currentValid = false;
      showValidationError(result.error);
      return;
    }

    currentFormatted = result.minified;
    currentValid = true;
    renderOutput(result.minified, result.stats, false);
    showStatus("压缩完成", "结果为单行紧凑 JSON，适合 API 传输。", "good");
  } catch (error) {
    showStatus("压缩失败", error.message, "bad");
  } finally {
    setBusy(false);
  }
}

function renderOutput(text, stats, pretty) {
  elements.outputWrap.hidden = false;
  elements.outputText.textContent = text;

  if (pretty && currentSettings?.syntaxHighlight !== false) {
    elements.outputText.innerHTML = highlightJson(text);
  }

  if (stats) {
    elements.statsBlock.hidden = false;
    elements.statLines.textContent = stats.lineCount ?? 0;
    elements.statBytes.textContent = formatBytes(stats.byteLength ?? 0);
    elements.statKeys.textContent = stats.keys ?? 0;
    elements.statDepth.textContent = stats.maxDepth ?? 0;
  } else {
    elements.statsBlock.hidden = true;
  }
}

function hideOutput() {
  elements.outputWrap.hidden = true;
  elements.outputText.textContent = "";
  currentFormatted = "";
}

function showValidationError(error) {
  elements.outputWrap.hidden = true;
  const loc = error.line && error.column ? `（第 ${error.line} 行，第 ${error.column} 列）` : "";
  const snippet = error.snippet
    ? `\n\n附近内容：…${escapeHtml(error.snippet.before || "")}【${escapeHtml(error.snippet.at || "")}】${escapeHtml(error.snippet.after || "")}…`
    : "";
  showStatus("JSON 无效 ✗", `${error.message || "解析失败"}${loc}${snippet}`, "bad");
}

async function importFromPage() {
  setBusy(true);
  showStatus("读取页面", "正在读取当前页面内容...", "");

  try {
    const result = await request({ type: "GET_ACTIVE_TAB_JSON" });
    const candidate = result.text || "";
    if (!candidate) {
      showStatus("无可读内容", "当前页面没有检测到可读文本。", "bad");
      return;
    }
    if (!looksLikeJson(candidate) && !candidate.includes(":") && !candidate.includes('"')) {
      elements.inputText.value = candidate;
      showStatus("已读取页面文本", "页面内容不像 JSON，但已填入输入框。", "");
      return;
    }
    elements.inputText.value = candidate;
    showStatus("已载入页面内容", `来源：${truncate(result.url || "当前页", 60)}`, "good");
  } catch (error) {
    showStatus("读取失败", error.message, "bad");
  } finally {
    setBusy(false);
  }
}

async function swapOutputToInput() {
  const text = currentFormatted || elements.outputText.textContent || "";
  if (!text) {
    showStatus("没有可移送内容", "请先得到格式化或压缩结果。", "bad");
    return;
  }
  elements.inputText.value = text;
  hideOutput();
  showStatus("已送到输入", "可以继续在输入框中编辑后重新格式化。", "good");
}

async function downloadJson() {
  const text = currentFormatted || elements.outputText.textContent || "";
  if (!text) {
    showStatus("没有内容可下载", "请先格式化或压缩。", "bad");
    return;
  }
  try {
    const blob = new Blob([text], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `formatted-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 0);
    showStatus("已开始下载", ".json 文件已通过浏览器保存。", "good");
  } catch (error) {
    showStatus("下载失败", error.message, "bad");
  }
}

async function refreshTreeFromInput() {
  const text = elements.inputText.value.trim();
  if (!text) {
    elements.treeContainer.innerHTML = `<p class="tree-placeholder">编辑器输入框为空，先粘贴 JSON 再刷新。</p>`;
    currentTree = null;
    return;
  }

  setBusy(true);
  showStatus("构建树状视图", "正在生成结构树...", "");

  try {
    const result = await request({
      type: "JSON_TO_TREE",
      payload: { text, settings: collectInlineSettings() }
    });

    if (!result.isValid) {
      currentTree = null;
      elements.treeContainer.innerHTML = `<div class="tree-error">${escapeHtml(result.error?.message || "解析失败")}</div>`;
      showStatus("构建树失败", result.error?.message || "JSON 无效，无法生成树。", "bad");
      return;
    }

    currentTree = result.tree;
    elements.treeContainer.innerHTML = renderTreeHtml(result.tree);
    bindTreeToggleEvents(elements.treeContainer);
    showStatus("树状视图已生成", "点击节点左侧箭头可展开或折叠子节点。", "good");
  } catch (error) {
    showStatus("构建树失败", error.message, "bad");
  } finally {
    setBusy(false);
  }
}

function setTreeExpandAll(expand) {
  elements.treeContainer.querySelectorAll(".tree-node").forEach((node) => {
    if (expand) {
      node.classList.add("expanded");
      node.classList.remove("collapsed");
    } else {
      const depth = parseInt(node.dataset.depth || "0", 10);
      if (depth >= 1) {
        node.classList.remove("expanded");
        node.classList.add("collapsed");
      } else {
        node.classList.add("expanded");
        node.classList.remove("collapsed");
      }
    }
  });
}

function bindTreeToggleEvents(container) {
  container.querySelectorAll(".tree-toggle").forEach((btn) => {
    btn.addEventListener("click", () => {
      const node = btn.closest(".tree-node");
      if (!node) return;
      const expanded = node.classList.toggle("expanded");
      node.classList.toggle("collapsed", !expanded);
    });
  });
  container.querySelectorAll(".tree-value").forEach((el) => {
    el.addEventListener("click", () => copyText(el.textContent || "", el));
    el.title = "点击复制该值";
  });
}

function renderTreeHtml(node) {
  const { key, type, depth } = node;
  const prefixKey = renderKeyLabel(key, type, depth);
  const valueHtml = renderValueInline(node);

  if ((type === "object" || type === "array") && node.children?.length) {
    const header = `<div class="tree-line" style="padding-left:${depth * 18 + 4}px;">
      <button class="tree-toggle" aria-label="展开/折叠">▸</button>
      <span class="tree-key">${prefixKey}</span>
      <span class="tree-type-badge">${type === "array" ? `Array(${node.length})` : `Object{${node.keys?.length ?? 0}}`}</span>
    </div>`;
    const childrenHtml = node.children.map(renderTreeHtml).join("");
    const collapsed = node.collapsed ? "collapsed" : "expanded";
    return `<div class="tree-node ${collapsed}" data-depth="${depth}">${header}<div class="tree-children">${childrenHtml}</div></div>`;
  }

  return `<div class="tree-node expanded leaf" data-depth="${depth}">
    <div class="tree-line" style="padding-left:${depth * 18 + 22}px;">
      <span class="tree-key">${prefixKey}</span>
      <span class="tree-value value-${type}">${escapeHtml(valueHtml)}</span>
    </div>
  </div>`;
}

function renderKeyLabel(key, type, depth) {
  if (depth === 0) return `<em>${type}</em>`;
  const isIndex = /^\d+$/.test(key);
  return isIndex ? `<b class="arr-idx">[${key}]</b>` : `<b>"${escapeHtml(key)}"</b>:`;
}

function renderValueInline(node) {
  switch (node.type) {
    case "string":
      return `"${node.value}"`;
    case "number":
    case "boolean":
      return String(node.value);
    case "null":
      return "null";
    case "array":
      return `[... ${node.length} items]`;
    case "object":
      return `{... ${node.keys?.length ?? 0} keys}`;
    default:
      return String(node.value ?? "");
  }
}

async function runEscape(unescape) {
  const input = elements.escapeInput.value;
  if (!input && !unescape) {
    elements.escapeOutput.textContent = "";
    showStatus("输入为空", "请先输入要转义的文本。", "bad");
    return;
  }
  try {
    const result = await request({
      type: unescape ? "UNESCAPE_JSON" : "ESCAPE_JSON",
      payload: { text: input }
    });
    elements.escapeOutput.textContent = unescape ? result.unescaped : result.escaped;
    showStatus(unescape ? "反转义完成" : "转义完成", "结果已显示在下方，可点击“复制结果”。", "good");
  } catch (error) {
    elements.escapeOutput.textContent = "";
    showStatus((unescape ? "反转义" : "转义") + "失败", error.message, "bad");
  }
}

async function runSortKeys() {
  const text = elements.sortInput.value;
  if (!text.trim()) {
    elements.sortOutput.textContent = "";
    showStatus("输入为空", "请先输入 JSON。", "bad");
    return;
  }
  setBusy(true);
  showStatus("正在排序", "按键名递归排序中...", "");
  try {
    const result = await request({
      type: "SORT_KEYS",
      payload: { text, settings: collectInlineSettings() }
    });
    if (!result.isValid) {
      elements.sortOutput.textContent = "";
      showStatus("排序失败", result.error?.message || "JSON 无效", "bad");
      return;
    }
    elements.sortOutput.textContent = result.sorted;
    elements.sortOutput.innerHTML = highlightJson(result.sorted);
    showStatus("排序完成", "对象 key 已按字典序递归排序。", "good");
  } catch (error) {
    showStatus("排序失败", error.message, "bad");
  } finally {
    setBusy(false);
  }
}

async function runCompare() {
  const aText = elements.compareA.value.trim();
  const bText = elements.compareB.value.trim();
  if (!aText || !bText) {
    elements.compareOutput.textContent = "";
    showStatus("请提供两份 JSON", "需要同时填写 JSON A 和 JSON B。", "bad");
    return;
  }

  setBusy(true);
  showStatus("比较中", "正在解析并比较两份 JSON...", "");
  try {
    const va = await request({ type: "VALIDATE_JSON", payload: { text: aText } });
    const vb = await request({ type: "VALIDATE_JSON", payload: { text: bText } });

    if (!va.isValid || !vb.isValid) {
      const errs = [];
      if (!va.isValid) errs.push(`JSON A: ${va.error?.message || "无效"}`);
      if (!vb.isValid) errs.push(`JSON B: ${vb.error?.message || "无效"}`);
      elements.compareOutput.textContent = "";
      showStatus("有无效 JSON", errs.join("；"), "bad");
      return;
    }

    const a = JSON.parse(aText);
    const b = JSON.parse(bText);
    const report = compareTwo(a, b, "$");
    elements.compareOutput.textContent = report.text;
    const statusMood = report.equal ? "good" : "";
    const statusTitle = report.equal ? "两份 JSON 相等 ✓" : `发现 ${report.diffs.length} 处差异`;
    const statusDesc = report.equal
      ? "在忽略键顺序情况下结构与值完全一致。"
      : "详情见下方输出；左侧字段路径来自根 $。";
    showStatus(statusTitle, statusDesc, statusMood);
  } catch (error) {
    showStatus("比较失败", error.message, "bad");
  } finally {
    setBusy(false);
  }
}

function compareTwo(a, b, path) {
  const diffs = [];
  const lines = [];

  function walk(x, y, p) {
    if (Object.is(x, y)) return;
    const tx = x === null ? "null" : Array.isArray(x) ? "array" : typeof x;
    const ty = y === null ? "null" : Array.isArray(y) ? "array" : typeof y;
    if (tx !== ty) {
      diffs.push({ path: p, message: `类型不同：A 是 ${tx}，B 是 ${ty}` });
      lines.push(`≠ ${p}: 类型不同 [${tx}] vs [${ty}]`);
      return;
    }
    if (tx === "array") {
      if (x.length !== y.length) {
        diffs.push({ path: p, message: `数组长度不同：A=${x.length}, B=${y.length}` });
        lines.push(`≠ ${p}: 数组长度 ${x.length} vs ${y.length}`);
      }
      const n = Math.min(x.length, y.length);
      for (let i = 0; i < n; i += 1) walk(x[i], y[i], `${p}[${i}]`);
      for (let i = n; i < Math.max(x.length, y.length); i += 1) {
        const side = i < x.length ? "A" : "B";
        lines.push(`+ ${p}[${i}]: 仅存在于 ${side}`);
      }
      return;
    }
    if (tx === "object") {
      const ka = Object.keys(x);
      const kb = Object.keys(y);
      const allKeys = Array.from(new Set(ka.concat(kb))).sort();
      for (const k of allKeys) {
        const inA = Object.prototype.hasOwnProperty.call(x, k);
        const inB = Object.prototype.hasOwnProperty.call(y, k);
        const sub = `${p}.${k}`;
        if (inA && !inB) {
          lines.push(`- ${sub}: 仅存在于 A`);
        } else if (!inA && inB) {
          lines.push(`+ ${sub}: 仅存在于 B`);
        } else {
          walk(x[k], y[k], sub);
        }
      }
      return;
    }
    lines.push(`≠ ${p}: ${JSON.stringify(x)} vs ${JSON.stringify(y)}`);
  }

  walk(a, b, path);

  if (!lines.length) {
    return {
      equal: true,
      diffs: [],
      text: "✓ 两份 JSON 相等（键顺序不影响相等判断）。"
    };
  }

  return { equal: false, diffs, text: lines.join("\n") };
}

async function copyText(text, statusAnchor) {
  if (!text) {
    showStatus("无可复制内容", "请先生成结果再复制。", "bad");
    return;
  }
  try {
    await navigator.clipboard.writeText(text);
    showStatus("已复制", "内容已复制到剪贴板。", "good");
    if (statusAnchor) pulseCopyOk(statusAnchor);
  } catch (error) {
    showStatus("复制失败", error.message, "bad");
  }
}

function pulseCopyOk(el) {
  el.classList.add("copy-flash");
  setTimeout(() => el.classList.remove("copy-flash"), 350);
}

function showStatus(title, text, mood) {
  elements.statusTitle.textContent = title;
  elements.statusText.textContent = text;
  elements.statusDot.classList.toggle("good", mood === "good");
  elements.statusDot.classList.toggle("bad", mood === "bad");
}

function setBusy(isBusy) {
  elements.formatNow.disabled = isBusy;
  elements.validateNow.disabled = isBusy;
  elements.minifyNow.disabled = isBusy;
  elements.importFromPage.disabled = isBusy;
  elements.sortNow.disabled = isBusy;
  elements.compareNow.disabled = isBusy;
  elements.escapeNow.disabled = isBusy;
  elements.unescapeNow.disabled = isBusy;
}

function request(message) {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(message, (response) => {
      const error = chrome.runtime.lastError;
      if (error) {
        reject(new Error(error.message));
        return;
      }
      if (!response?.ok) {
        reject(new Error(response?.error || "扩展后台没有响应。"));
        return;
      }
      resolve(response.data);
    });
  });
}

function highlightJson(text) {
  const escaped = escapeHtml(text);
  let html = escaped;
  html = html.replace(/"((?:\\.|[^"\\])*)"(?=\s*:)/g, `<span class="j-key">"$1"</span>`);
  html = html.replace(/"((?:\\.|[^"\\])*)"(?!\s*:)/g, `<span class="j-str">"$1"</span>`);
  html = html.replace(/\b(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)\b/g, `<span class="j-num">$1</span>`);
  html = html.replace(/\b(true|false)\b/g, `<span class="j-bool">$1</span>`);
  html = html.replace(/\b(null)\b/g, `<span class="j-null">$1</span>`);
  return html;
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatBytes(n) {
  if (!Number.isFinite(n)) return "0 B";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(2)} MB`;
}

function truncate(value, max) {
  const t = String(value || "");
  if (t.length <= max) return t;
  return `${t.slice(0, max)}…`;
}
