const INSTANCE_ID = Math.random().toString(36).substring(2);

chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === "ANOTHER_INSTANCE_OPENED" && msg.instanceId !== INSTANCE_ID) {
    window.close();
  }
});

const elements = {
  openOptions: document.querySelector("#openOptions"),
  workspaceTabs: Array.from(document.querySelectorAll(".mode-tab")),
  workspaces: Array.from(document.querySelectorAll(".workspace")),
  actionGroups: Array.from(document.querySelectorAll(".mode-actions")),
  formatOptions: document.querySelector("[data-format-options]"),

  indentSize: document.querySelector("#indentSize"),
  sortKeysToggle: document.querySelector("#sortKeysToggle"),
  sampleData: document.querySelector("#sampleData"),
  clearInput: document.querySelector("#clearInput"),
  inputText: document.querySelector("#inputText"),
  formatNow: document.querySelector("#formatNow"),
  validateNow: document.querySelector("#validateNow"),
  minifyNow: document.querySelector("#minifyNow"),

  outputWrap: document.querySelector("#outputWrap"),
  outputArea: document.querySelector("#outputArea"),
  outputText: document.querySelector("#outputText"),
  statsBlock: document.querySelector("#statsBlock"),
  statLines: document.querySelector("#statLines"),
  statBytes: document.querySelector("#statBytes"),
  statKeys: document.querySelector("#statKeys"),
  statDepth: document.querySelector("#statDepth"),
  copyOutput: document.querySelector("#copyOutput"),
  downloadOutput: document.querySelector("#downloadOutput"),
  swapToInput: document.querySelector("#swapToInput"),

  escapeInput: document.querySelector("#escapeInput"),
  escapeNow: document.querySelector("#escapeNow"),
  unescapeNow: document.querySelector("#unescapeNow"),
  escapeOutput: document.querySelector("#escapeOutput"),
  copyEscapeOutput: document.querySelector("#copyEscapeOutput"),

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
let lastAutoFilledCompare = "";
let lastAutoFilledEscape = "";

const SAMPLE_JSON = `{
  "name": "JSON Beautify",
  "version": "1.0.0",
  "enabled": true,
  "features": ["format", "minify", "escape", "compare"],
  "stats": {
    "lines": 128,
    "bytes": 4096
  },
  "author": null
}`;

document.addEventListener("DOMContentLoaded", init);

elements.openOptions.addEventListener("click", () => chrome.runtime.openOptionsPage());
elements.workspaceTabs.forEach((tab) => {
  tab.addEventListener("click", () => switchWorkspace(tab.dataset.workspace));
});

elements.sampleData.addEventListener("click", () => {
  elements.inputText.value = SAMPLE_JSON;
  showStatus("已载入示例", "你可以点击“美化格式化”查看效果。", "good");
});
elements.clearInput.addEventListener("click", () => {
  elements.inputText.value = "";
  hideOutput();
  showStatus("已清空输入", "粘贴或输入 JSON 后继续操作。", "");
});

elements.formatNow.addEventListener("click", () => runSubAction(elements.formatNow, formatCurrent));
elements.validateNow.addEventListener("click", () => runSubAction(elements.validateNow, validateCurrent));
elements.minifyNow.addEventListener("click", () => runSubAction(elements.minifyNow, minifyCurrent));
elements.copyOutput.addEventListener("click", () => copyText(currentFormatted, elements.copyOutput, elements.outputText));
elements.downloadOutput.addEventListener("click", downloadJson);
elements.swapToInput.addEventListener("click", swapOutputToInput);
elements.outputArea.addEventListener("click", toggleOutputFold);

elements.escapeNow.addEventListener("click", () => runSubAction(elements.escapeNow, () => runEscape(false)));
elements.unescapeNow.addEventListener("click", () => runSubAction(elements.unescapeNow, () => runEscape(true)));
elements.copyEscapeOutput.addEventListener("click", () => copyText(elements.escapeOutput.value || "", elements.copyEscapeOutput, elements.escapeOutput));

elements.compareNow.addEventListener("click", () => runSubAction(elements.compareNow, runCompare));

elements.inputText.addEventListener("input", () => {
  if (currentFormatted) {
    hideOutput();
    showStatus("输入已变更", "上一份结果已隐藏，请重新格式化或压缩。", "");
  }
});

async function init() {
  chrome.runtime.sendMessage({ type: "ANOTHER_INSTANCE_OPENED", instanceId: INSTANCE_ID });

  applyViewModeClass(await detectViewMode());

  try {
    currentSettings = await request({ type: "GET_SETTINGS" });
    applySettingsToUi(currentSettings);

    showStatus("准备就绪", "粘贴 JSON 后即可格式化、压缩、转义或比较。", "good");
  } catch (error) {
    showStatus("无法读取设置", error.message, "bad");
  }
}

function detectViewMode() {
  return new Promise((resolve) => {
    try {
      if (window.location.protocol !== "chrome-extension:" && window.location.protocol !== "extension:") {
        resolve("window");
        return;
      }
      chrome.windows.getCurrent((win) => {
        if (chrome.runtime.lastError) {
          try {
            chrome.runtime.sendMessage({ type: "PING_FOR_VIEW" }, (resp) => {
              if (chrome.runtime.lastError) { resolve("tab"); return; }
              resolve(resp?.mode || "tab");
            });
          } catch {
            resolve("tab");
          }
          return;
        }
        const type = win?.type;
        if (type === "popup" || type === "panel" || type === "detached_panel") {
          const w = Math.max(window.innerWidth || 0, document.documentElement?.clientWidth || 0);
          const h = Math.max(window.innerHeight || 0, document.documentElement?.clientHeight || 0);
          if (w >= 1000 || h >= 760) { resolve("window"); return; }
          resolve("popup");
          return;
        }
        resolve("tab");
      });
    } catch {
      resolve("tab");
    }
  });
}

function applyViewModeClass(mode) {
  document.body.dataset.viewMode = mode || "popup";
  if (mode === "tab" && document.title && !document.title.includes("（全屏")) {
    document.title = document.title + "（全屏编辑）";
  }
}

function applySettingsToUi(settings) {
  if (settings.useTabIndent) {
    elements.indentSize.value = "tab";
  } else {
    elements.indentSize.value = String(settings.indentSize);
  }
  elements.sortKeysToggle.checked = Boolean(settings.sortKeys);
}

function collectInlineSettings() {
  const indent = elements.indentSize.value;
  return {
    indentSize: indent === "tab" ? 4 : parseInt(indent, 10) || 2,
    useTabIndent: indent === "tab",
    sortKeys: elements.sortKeysToggle.checked
  };
}

function switchWorkspace(name) {
  elements.workspaceTabs.forEach((tab) => {
    const active = tab.dataset.workspace === name;
    tab.classList.toggle("active", active);
    tab.setAttribute("aria-selected", active ? "true" : "false");
  });
  elements.workspaces.forEach((workspace) => {
    workspace.hidden = workspace.dataset.workspace !== name;
    workspace.classList.toggle("active", workspace.dataset.workspace === name);
  });
  elements.actionGroups.forEach((group) => {
    group.hidden = group.dataset.actions !== name;
    group.classList.toggle("active", group.dataset.actions === name);
  });
  elements.formatOptions.hidden = name !== "format";
  populateWorkspaceInput(name);
}

function populateWorkspaceInput(name) {
  const source = elements.inputText.value;
  if (!source) return;

  if (name === "compare" && (!elements.compareA.value || elements.compareA.value === lastAutoFilledCompare)) {
    elements.compareA.value = source;
    lastAutoFilledCompare = source;
  }

  if (name === "escape" && (!elements.escapeInput.value || elements.escapeInput.value === lastAutoFilledEscape)) {
    elements.escapeInput.value = source;
    lastAutoFilledEscape = source;
  }
}

function runSubAction(button, action) {
  const group = button.closest(".mode-actions");
  group?.querySelectorAll(".primary-action, .sub-button").forEach((item) => {
    item.classList.toggle("active", item === button);
  });
  action();
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
      showValidationError(result.error);
      return;
    }

    currentFormatted = result.formatted;
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
      showValidationError(result.error);
      return;
    }

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
      showValidationError(result.error);
      return;
    }

    currentFormatted = result.minified;
    renderOutput(result.minified, result.stats, false);
    showStatus("压缩完成", "结果为单行紧凑 JSON，适合 API 传输。", "good");
  } catch (error) {
    showStatus("压缩失败", error.message, "bad");
  } finally {
    setBusy(false);
  }
}

function renderOutput(text, stats, pretty) {
  renderCodeOutput(text, pretty && currentSettings?.syntaxHighlight !== false);
  elements.outputText.classList.remove("empty");

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
  elements.outputText.textContent = "格式化结果会显示在这里";
  elements.outputText.classList.add("empty");
  elements.statsBlock.hidden = true;
  currentFormatted = "";
}

function renderCodeOutput(text, syntaxHighlight) {
  const lines = String(text).split("\n");
  const foldEnds = findFoldEnds(lines);
  elements.outputText.innerHTML = lines.map((line, index) => {
    const foldEnd = foldEnds.get(index);
    const toggle = foldEnd === undefined
      ? '<span class="fold-spacer" aria-hidden="true"></span>'
      : `<button class="fold-toggle" type="button" data-fold-end="${foldEnd}" aria-label="折叠第 ${index + 1} 行内容" aria-expanded="true"></button>`;
    const code = syntaxHighlight ? highlightJson(line) : escapeHtml(line);
    const summary = foldEnd === undefined ? "" : '<span class="fold-summary" aria-hidden="true">...</span>';
    return `<div class="code-line" data-line-index="${index}"><span class="line-number">${index + 1}</span>${toggle}<span class="line-code">${code || " "}</span>${summary}</div>`;
  }).join("");
}

function findFoldEnds(lines) {
  const stack = [];
  const foldEnds = new Map();
  let inString = false;
  let escaped = false;

  lines.forEach((line, lineIndex) => {
    for (const char of line) {
      if (inString) {
        if (escaped) escaped = false;
        else if (char === "\\") escaped = true;
        else if (char === '"') inString = false;
        continue;
      }
      if (char === '"') inString = true;
      else if (char === "{" || char === "[") stack.push({ char, lineIndex });
      else if (char === "}" || char === "]") {
        const open = stack.pop();
        if (open && open.lineIndex < lineIndex) foldEnds.set(open.lineIndex, lineIndex);
      }
    }
  });
  return foldEnds;
}

function toggleOutputFold(event) {
  const button = event.target.closest(".fold-toggle");
  if (!button) return;
  const start = parseInt(button.closest(".code-line")?.dataset.lineIndex, 10);
  const end = parseInt(button.dataset.foldEnd, 10);
  if (!Number.isFinite(start) || !Number.isFinite(end)) return;

  const isCollapsed = button.getAttribute("aria-expanded") === "false";
  button.setAttribute("aria-expanded", isCollapsed ? "true" : "false");
  button.setAttribute("aria-label", `${isCollapsed ? "折叠" : "展开"}第 ${start + 1} 行内容`);
  button.closest(".code-line")?.classList.toggle("is-collapsed", !isCollapsed);
  for (let index = start + 1; index < end; index += 1) {
    const line = elements.outputText.querySelector(`.code-line[data-line-index="${index}"]`);
    if (!line) continue;
    const owners = new Set((line.dataset.foldOwners || "").split(",").filter(Boolean));
    if (isCollapsed) owners.delete(String(start));
    else owners.add(String(start));
    line.dataset.foldOwners = Array.from(owners).join(",");
    line.classList.toggle("is-folded", owners.size > 0);
  }
}

function showValidationError(error) {
  hideOutput();
  highlightTextareaRange(elements.inputText, error.position, "error");
  const loc = error.line && error.column ? `（第 ${error.line} 行，第 ${error.column} 列）` : "";
  const snippet = error.snippet
    ? `\n\n附近内容：…${error.snippet.before || ""}【${error.snippet.at || ""}】${error.snippet.after || ""}…`
    : "";
  showStatus("JSON 无效 ✗", `${error.message || "解析失败"}${loc}${snippet}`, "bad");
}

async function swapOutputToInput() {
  const text = currentFormatted;
  if (!text) {
    showStatus("没有可移送内容", "请先得到格式化或压缩结果。", "bad");
    return;
  }
  elements.inputText.value = text;
  hideOutput();
  showStatus("已送到输入", "可以继续在输入框中编辑后重新格式化。", "good");
}

async function downloadJson() {
  const text = currentFormatted;
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

async function runEscape(unescape) {
  const input = elements.escapeInput.value;
  if (!input && !unescape) {
    elements.escapeOutput.value = "";
    showStatus("输入为空", "请先输入要转义的文本。", "bad");
    return;
  }
  try {
    const result = await request({
      type: unescape ? "UNESCAPE_JSON" : "ESCAPE_JSON",
      payload: { text: input }
    });
    elements.escapeOutput.value = unescape ? result.unescaped : result.escaped;
    showStatus(unescape ? "反转义完成" : "转义完成", "结果已显示在右侧，可点击“复制结果”。", "good");
  } catch (error) {
    elements.escapeOutput.value = "";
    showStatus((unescape ? "反转义" : "转义") + "失败", error.message, "bad");
  }
}

async function runCompare() {
  const aText = elements.compareA.value;
  const bText = elements.compareB.value;
  if (!aText.trim() || !bText.trim()) {
    elements.compareOutput.value = "";
    showStatus("请提供两份 JSON", "需要同时填写 JSON A 和 JSON B。", "bad");
    return;
  }

  setBusy(true);
  clearTextareaHighlight(elements.compareA);
  clearTextareaHighlight(elements.compareB);
  showStatus("比较中", "正在解析并比较两份 JSON...", "");
  try {
    const va = await request({ type: "VALIDATE_JSON", payload: { text: aText } });
    const vb = await request({ type: "VALIDATE_JSON", payload: { text: bText } });

    if (!va.isValid || !vb.isValid) {
      const errs = [];
      if (!va.isValid) {
        highlightTextareaRange(elements.compareA, va.error?.position, "error");
        errs.push(`JSON A: ${va.error?.message || "无效"}`);
      }
      if (!vb.isValid) {
        highlightTextareaRange(elements.compareB, vb.error?.position, "error");
        errs.push(`JSON B: ${vb.error?.message || "无效"}`);
      }
      elements.compareOutput.value = "";
      showStatus("有无效 JSON", errs.join("；"), "bad");
      return;
    }

    // 使用后台已经验证过的解析结果，确保比较与格式化都支持同一套松弛 JSON 规则。
    const a = va.parsed;
    const b = vb.parsed;
    const report = compareTwo(a, b, "$");
    elements.compareOutput.value = "";

    if (report.equal) {
      elements.compareOutput.value = report.text;
      clearTextareaHighlight(elements.compareA);
      clearTextareaHighlight(elements.compareB);
    } else {
      const header = `发现 ${report.diffs.length} 处差异：\n\n`;
      elements.compareOutput.value = header + report.text;
      highlightFirstDifference(report.diffs[0], aText, bText);
    }

    const statusMood = report.equal ? "good" : "warn";
    const statusTitle = report.equal ? "比较完成" : "发现差异";
    const statusDesc = report.equal
      ? "在忽略键顺序情况下结构与值完全一致。"
      : "发现差异，结果已显示在下方输出区。";
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
      addDiff(p, `类型不同：A 是 ${tx}，B 是 ${ty}`, `类型不同 [${tx}] vs [${ty}]`);
      return;
    }
    if (tx === "array") {
      if (x.length !== y.length) {
        addDiff(p, `数组长度不同：A=${x.length}, B=${y.length}`, `数组长度 ${x.length} vs ${y.length}`);
      }
      const n = Math.min(x.length, y.length);
      for (let i = 0; i < n; i += 1) walk(x[i], y[i], `${p}[${i}]`);
      for (let i = n; i < Math.max(x.length, y.length); i += 1) {
        const side = i < x.length ? "A" : "B";
        addDiff(`${p}[${i}]`, `仅存在于 ${side}`, `仅存在于 ${side}`);
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
          addDiff(sub, "仅存在于 A", "仅存在于 A");
        } else if (!inA && inB) {
          addDiff(sub, "仅存在于 B", "仅存在于 B");
        } else {
          walk(x[k], y[k], sub);
        }
      }
      return;
    }
    addDiff(p, "值不同", `${JSON.stringify(x)} vs ${JSON.stringify(y)}`);
  }

  function addDiff(pathValue, message, detail) {
    diffs.push({ path: pathValue, message });
    lines.push(`≠ ${pathValue}: ${detail}`);
  }

  walk(a, b, path);

  if (!lines.length) {
    return {
      equal: true,
      diffs: [],
      text: "✓ 两份 JSON 完全相等（忽略键名顺序）。"
    };
  }

  return { equal: false, diffs, text: lines.join("\n") };
}

function highlightFirstDifference(diff, aText, bText) {
  const aRange = findJsonPathRange(aText, diff.path);
  const bRange = findJsonPathRange(bText, diff.path);
  highlightTextareaRange(elements.compareA, aRange, "difference");
  highlightTextareaRange(elements.compareB, bRange, "difference", false);
}

function highlightTextareaRange(textarea, rangeOrPosition, mood, focus = true) {
  clearTextareaHighlight(textarea);
  const length = textarea.value.length;
  let start = typeof rangeOrPosition === "number" ? rangeOrPosition : rangeOrPosition?.start;
  let end = typeof rangeOrPosition === "number" ? rangeOrPosition + 1 : rangeOrPosition?.end;
  if (!Number.isFinite(start)) return;
  start = Math.max(0, Math.min(start, length));
  end = Math.min(length, Math.max(start + 1, Math.min(Number.isFinite(end) ? end : start + 1, length)));
  textarea.classList.add(mood === "error" ? "has-error" : "has-difference");
  textarea.setSelectionRange(start, end);
  if (focus) textarea.focus();
}

function clearTextareaHighlight(textarea) {
  textarea.classList.remove("has-error", "has-difference");
}

function findJsonPathRange(text, path) {
  const parts = parseJsonPath(path);
  if (!parts.length) return { start: 0, end: Math.min(1, text.length) };
  let cursor = 0;
  let matched = null;
  for (const part of parts) {
    const keyPattern = typeof part === "number"
      ? null
      : new RegExp(`(?:"${escapeRegExp(part)}"|${escapeRegExp(part)})\\s*:`, "g");
    if (keyPattern) {
      keyPattern.lastIndex = cursor;
      const match = keyPattern.exec(text);
      if (!match) return matched;
      matched = { start: match.index, end: match.index + match[0].length };
      cursor = match.index + match[0].length;
    }
  }
  return matched;
}

function parseJsonPath(path) {
  const parts = [];
  const matcher = /(?:\.([^.[\]]+)|\[(\d+)\])/g;
  let match;
  while ((match = matcher.exec(path))) {
    parts.push(match[1] ?? parseInt(match[2], 10));
  }
  return parts;
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

async function copyText(text, button, statusAnchor) {
  if (!text) {
    showStatus("无可复制内容", "请先生成结果再复制。", "bad");
    return;
  }
  try {
    await navigator.clipboard.writeText(text);
    showStatus("已复制", "内容已复制到剪贴板。", "good");
    flashCopyButton(button, "已复制");
    if (statusAnchor) pulseCopyOk(statusAnchor);
  } catch (error) {
    showStatus("复制失败", error.message, "bad");
    flashCopyButton(button, "复制失败", true);
  }
}

function flashCopyButton(button, text, bad = false) {
  if (!button) return;
  const original = button.textContent;
  button.textContent = text;
  button.disabled = true;
  if (bad) button.classList.add("copy-failed");
  setTimeout(() => {
    button.textContent = original;
    button.disabled = false;
    button.classList.remove("copy-failed");
  }, 1200);
}

function pulseCopyOk(el) {
  el.classList.add("copy-flash");
  setTimeout(() => el.classList.remove("copy-flash"), 350);
}

function showStatus(title, text, mood) {
  elements.statusTitle.textContent = title;
  elements.statusText.textContent = text;
  elements.statusDot.className = `dot ${mood || ""}`.trim();
}

function setBusy(isBusy) {
  elements.formatNow.disabled = isBusy;
  elements.validateNow.disabled = isBusy;
  elements.minifyNow.disabled = isBusy;
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
