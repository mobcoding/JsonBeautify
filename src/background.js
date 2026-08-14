const DEFAULT_SETTINGS = Object.freeze({
  indentSize: 2,
  useTabIndent: false,
  sortKeys: false,
  quoteKeys: true,
  autoFormatOnView: true,
  syntaxHighlight: true,
  expandLevel: 0,
  maxDepth: 100
});

chrome.runtime.onInstalled.addListener(() => {
  setupSidePanelBehavior();
  setupContextMenus();
  initializeSettings();
});

chrome.runtime.onStartup.addListener(() => {
  setupSidePanelBehavior();
});

chrome.contextMenus.onClicked.addListener(handleContextMenuClick);

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  handleMessage(message, sender)
    .then((data) => sendResponse({ ok: true, data }))
    .catch((error) => sendResponse({ ok: false, error: safeError(error) }));

  return true;
});

async function handleMessage(message, sender) {
  switch (message?.type) {
    case "GET_SETTINGS":
      return getSettings();

    case "SAVE_SETTINGS":
      return saveSettings(message.settings || {});

    case "FORMAT_JSON":
      return formatJson(message.payload || {});

    case "MINIFY_JSON":
      return minifyJson(message.payload || {});

    case "VALIDATE_JSON":
      return validateJson(message.payload || {});

    case "ESCAPE_JSON":
      return escapeJson(message.payload || {});

    case "UNESCAPE_JSON":
      return unescapeJson(message.payload || {});

    case "SORT_KEYS":
      return sortJsonKeys(message.payload || {});

    case "JSON_TO_TREE":
      return jsonToTree(message.payload || {});

    case "GET_ACTIVE_TAB_JSON":
      return getActiveTabJson();

    default:
      throw new Error("未知请求。");
  }
}

function setupSidePanelBehavior() {
  if (!chrome.sidePanel?.setPanelBehavior) {
    return;
  }

  chrome.sidePanel
    .setPanelBehavior({ openPanelOnActionClick: true })
    .catch(() => {});
}

function setupContextMenus() {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: "format-selection",
      title: "格式化选中的 JSON",
      contexts: ["selection"]
    });

    chrome.contextMenus.create({
      id: "format-page",
      title: "美化当前页面 JSON",
      contexts: ["page"]
    });

    chrome.contextMenus.create({
      id: "minify-selection",
      title: "压缩选中的 JSON",
      contexts: ["selection"]
    });

    chrome.contextMenus.create({
      id: "validate-selection",
      title: "验证选中的 JSON",
      contexts: ["selection"]
    });

    chrome.contextMenus.create({
      id: "copy-pretty",
      title: "复制美化后的 JSON",
      contexts: ["selection"]
    });
  });
}

async function initializeSettings() {
  const current = await storageGet({});
  const merged = { ...DEFAULT_SETTINGS, ...current };
  await storageSet(merged);
}

async function getSettings() {
  const settings = await storageGet(DEFAULT_SETTINGS);
  return { ...DEFAULT_SETTINGS, ...settings };
}

async function saveSettings(nextSettings) {
  const current = await getSettings();
  const normalized = normalizeSettings(nextSettings, current);
  const merged = { ...current, ...normalized };
  await storageSet(merged);
  return merged;
}

function normalizeSettings(input, current) {
  const normalized = {};

  if (Object.prototype.hasOwnProperty.call(input, "indentSize")) {
    const n = parseInt(input.indentSize, 10);
    normalized.indentSize = Number.isFinite(n) ? Math.min(8, Math.max(1, n)) : current.indentSize;
  }

  if (Object.prototype.hasOwnProperty.call(input, "useTabIndent")) {
    normalized.useTabIndent = Boolean(input.useTabIndent);
  }

  if (Object.prototype.hasOwnProperty.call(input, "sortKeys")) {
    normalized.sortKeys = Boolean(input.sortKeys);
  }

  if (Object.prototype.hasOwnProperty.call(input, "quoteKeys")) {
    normalized.quoteKeys = Boolean(input.quoteKeys);
  }

  if (Object.prototype.hasOwnProperty.call(input, "autoFormatOnView")) {
    normalized.autoFormatOnView = Boolean(input.autoFormatOnView);
  }

  if (Object.prototype.hasOwnProperty.call(input, "syntaxHighlight")) {
    normalized.syntaxHighlight = Boolean(input.syntaxHighlight);
  }

  if (Object.prototype.hasOwnProperty.call(input, "expandLevel")) {
    const n = parseInt(input.expandLevel, 10);
    normalized.expandLevel = Number.isFinite(n) ? Math.min(20, Math.max(0, n)) : current.expandLevel;
  }

  return normalized;
}

function formatJson(payload) {
  const settings = normalizeInlineSettings(payload.settings);
  const text = String(payload.text || "");
  if (!text.trim()) {
    return { formatted: "", isValid: true };
  }

  let parsed;
  try {
    parsed = parseJsonRelaxed(text);
  } catch (error) {
    return {
      formatted: "",
      isValid: false,
      error: {
        message: error.message,
        position: error.position ?? null,
        line: error.line ?? null,
        column: error.column ?? null
      }
    };
  }

  if (settings.sortKeys && (typeof parsed === "object" && parsed !== null)) {
    parsed = deepSortKeys(parsed);
  }

  const indent = settings.useTabIndent ? "\t" : " ".repeat(settings.indentSize);
  const formatted = JSON.stringify(parsed, null, indent);

  return {
    formatted,
    isValid: true,
    stats: computeStats(parsed, formatted)
  };
}

function minifyJson(payload) {
  const text = String(payload.text || "");
  if (!text.trim()) {
    return { minified: "", isValid: true };
  }

  let parsed;
  try {
    parsed = parseJsonRelaxed(text);
  } catch (error) {
    return {
      minified: "",
      isValid: false,
      error: { message: error.message }
    };
  }

  const minified = JSON.stringify(parsed);
  return {
    minified,
    isValid: true,
    stats: computeStats(parsed, minified)
  };
}

function validateJson(payload) {
  const text = String(payload.text || "");
  if (!text.trim()) {
    return { isValid: true, error: null };
  }

  try {
    const parsed = parseJsonRelaxed(text);
    return {
      isValid: true,
      error: null,
      stats: computeStats(parsed, text)
    };
  } catch (error) {
    return {
      isValid: false,
      error: {
        message: error.message,
        position: error.position ?? null,
        line: error.line ?? null,
        column: error.column ?? null,
        snippet: buildErrorSnippet(text, error.position ?? -1)
      }
    };
  }
}

function escapeJson(payload) {
  const text = String(payload.text || "");
  const escaped = JSON.stringify(text).slice(1, -1);
  return { escaped };
}

function unescapeJson(payload) {
  const text = String(payload.text || "");
  try {
    const unescaped = JSON.parse(`"${text.replace(/"/g, '\\"')}"`);
    return { unescaped };
  } catch (error) {
    throw new Error("转义字符串解析失败：" + error.message);
  }
}

function sortJsonKeys(payload) {
  const text = String(payload.text || "");
  if (!text.trim()) {
    return { sorted: "", isValid: true };
  }

  let parsed;
  try {
    parsed = parseJsonRelaxed(text);
  } catch (error) {
    return { sorted: "", isValid: false, error: { message: error.message } };
  }

  const sorted = deepSortKeys(parsed);
  const settings = normalizeInlineSettings(payload.settings);
  const indent = settings.useTabIndent ? "\t" : " ".repeat(settings.indentSize);

  return {
    sorted: JSON.stringify(sorted, null, indent),
    isValid: true
  };
}

function jsonToTree(payload) {
  const text = String(payload.text || "");
  if (!text.trim()) {
    return { tree: null, isValid: true };
  }

  let parsed;
  try {
    parsed = parseJsonRelaxed(text);
  } catch (error) {
    return { tree: null, isValid: false, error: { message: error.message } };
  }

  const settings = normalizeInlineSettings(payload.settings);
  return {
    tree: buildTree(parsed, "root", 0, settings.expandLevel),
    isValid: true
  };
}

async function getActiveTabJson() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) {
    throw new Error("未找到当前活动标签页。");
  }

  try {
    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => {
        const bodyText = document.body?.innerText || document.body?.textContent || "";
        const preText = document.querySelector("pre")?.innerText || "";
        return { bodyText, preText, contentType: document.contentType, url: location.href };
      }
    });

    const data = results?.[0]?.result || {};
    const candidate = data.preText || data.bodyText || "";
    return {
      url: data.url,
      contentType: data.contentType,
      text: candidate.trim()
    };
  } catch (error) {
    throw new Error("无法读取页面内容：" + error.message);
  }
}

function normalizeInlineSettings(partial) {
  return {
    indentSize: parseInt(partial?.indentSize, 10) || DEFAULT_SETTINGS.indentSize,
    useTabIndent: Boolean(partial?.useTabIndent ?? DEFAULT_SETTINGS.useTabIndent),
    sortKeys: Boolean(partial?.sortKeys ?? DEFAULT_SETTINGS.sortKeys),
    quoteKeys: Boolean(partial?.quoteKeys ?? DEFAULT_SETTINGS.quoteKeys),
    expandLevel: parseInt(partial?.expandLevel, 10) || DEFAULT_SETTINGS.expandLevel
  };
}

function parseJsonRelaxed(text) {
  const trimmed = String(text).trim();
  try {
    return JSON.parse(trimmed);
  } catch (firstError) {
    try {
      const repaired = repairAndParse(trimmed);
      return repaired;
    } catch {
      const enhanced = enhanceError(trimmed, firstError);
      throw enhanced;
    }
  }
}

function repairAndParse(text) {
  let candidate = text;

  candidate = candidate
    .replace(/^\s*\/\/.*$/gm, "")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .trim();

  candidate = candidate.replace(/,\s*([\]}])/g, "$1");

  candidate = candidate.replace(
    /([{,]\s*)([A-Za-z_$][\w$]*)\s*:/g,
    (_, prefix, key) => `${prefix}"${key}":`
  );

  return JSON.parse(candidate);
}

function enhanceError(text, originalError) {
  const message = String(originalError.message || "");
  const match = message.match(/position\s+(\d+)/i);
  let position = match ? parseInt(match[1], 10) : -1;

  if (position < 0 || !Number.isFinite(position)) {
    const vmMatch = message.match(/line\s+(\d+)\s+column\s+(\d+)/i);
    if (vmMatch) {
      const line = parseInt(vmMatch[1], 10);
      const col = parseInt(vmMatch[2], 10);
      position = lineColumnToPosition(text, line, col);
    }
  }

  let line = null, column = null;
  if (position >= 0) {
    const lc = positionToLineColumn(text, position);
    line = lc.line;
    column = lc.column;
  }

  const error = new Error(formatErrorMessage(message, line, column));
  error.position = position;
  error.line = line;
  error.column = column;
  return error;
}

function formatErrorMessage(message, line, column) {
  const loc = (line && column) ? `（第 ${line} 行，第 ${column} 列）` : "";
  return `JSON 解析失败：${message}${loc}`;
}

function positionToLineColumn(text, position) {
  const until = text.slice(0, Math.max(0, Math.min(position, text.length)));
  const lines = until.split("\n");
  return { line: lines.length, column: (lines[lines.length - 1]?.length || 0) + 1 };
}

function lineColumnToPosition(text, line, column) {
  const lines = text.split("\n");
  const safeLine = Math.min(Math.max(1, line), lines.length);
  let pos = 0;
  for (let i = 0; i < safeLine - 1; i += 1) {
    pos += lines[i].length + 1;
  }
  pos += Math.min(Math.max(0, column - 1), lines[safeLine - 1]?.length || 0);
  return pos;
}

function buildErrorSnippet(text, position) {
  if (position < 0 || position > text.length) return null;
  const radius = 40;
  const start = Math.max(0, position - radius);
  const end = Math.min(text.length, position + radius);
  return {
    before: text.slice(start, position),
    at: position < text.length ? text[position] : "",
    after: text.slice(position + 1, end),
    truncatedBefore: start > 0,
    truncatedAfter: end < text.length
  };
}

function deepSortKeys(value) {
  if (Array.isArray(value)) {
    return value.map(deepSortKeys);
  }
  if (value && typeof value === "object") {
    const keys = Object.keys(value).sort();
    const result = {};
    for (const key of keys) {
      result[key] = deepSortKeys(value[key]);
    }
    return result;
  }
  return value;
}

function buildTree(value, key, depth, expandLevel) {
  const node = { key, depth, collapsed: depth >= expandLevel };

  if (value === null) {
    node.type = "null";
    node.value = null;
  } else if (Array.isArray(value)) {
    node.type = "array";
    node.length = value.length;
    node.children = value.map((item, index) =>
      buildTree(item, String(index), depth + 1, expandLevel)
    );
  } else if (typeof value === "object") {
    node.type = "object";
    node.keys = Object.keys(value);
    node.children = Object.keys(value).map((k) =>
      buildTree(value[k], k, depth + 1, expandLevel)
    );
  } else if (typeof value === "string") {
    node.type = "string";
    node.value = value;
  } else if (typeof value === "number") {
    node.type = "number";
    node.value = value;
  } else if (typeof value === "boolean") {
    node.type = "boolean";
    node.value = value;
  } else {
    node.type = "unknown";
    node.value = String(value);
  }

  return node;
}

function computeStats(parsed, formattedText) {
  let keys = 0;
  let values = 0;
  let maxDepth = 0;

  function walk(node, depth) {
    maxDepth = Math.max(maxDepth, depth);
    if (Array.isArray(node)) {
      values += 1;
      for (const item of node) walk(item, depth + 1);
    } else if (node && typeof node === "object") {
      values += 1;
      const ks = Object.keys(node);
      keys += ks.length;
      for (const k of ks) walk(node[k], depth + 1);
    } else {
      values += 1;
    }
  }

  walk(parsed, 0);

  return {
    byteLength: new Blob([formattedText]).size,
    charCount: formattedText.length,
    lineCount: formattedText.split("\n").length,
    keys,
    values,
    maxDepth
  };
}

async function handleContextMenuClick(info, tab) {
  if (!tab?.id) return;

  try {
    const settings = await getSettings();

    if (info.menuItemId === "format-selection" && info.selectionText) {
      const result = formatJson({ text: info.selectionText, settings });
      await sendResultToTab(tab.id, "FORMAT_SELECTION", result, info);
    } else if (info.menuItemId === "format-page") {
      await sendResultToTab(tab.id, "FORMAT_PAGE", { settings }, info);
    } else if (info.menuItemId === "minify-selection" && info.selectionText) {
      const result = minifyJson({ text: info.selectionText });
      await sendResultToTab(tab.id, "MINIFY_SELECTION", result, info);
    } else if (info.menuItemId === "validate-selection" && info.selectionText) {
      const result = validateJson({ text: info.selectionText });
      await sendResultToTab(tab.id, "VALIDATE_SELECTION", result, info);
    } else if (info.menuItemId === "copy-pretty" && info.selectionText) {
      const result = formatJson({ text: info.selectionText, settings });
      if (result.isValid && result.formatted) {
        await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          args: [result.formatted],
          func: (text) => {
            navigator.clipboard.writeText(text).catch(() => {});
          }
        });
      }
    }
  } catch (error) {
    console.error("右键菜单处理失败：", error);
  }
}

async function sendResultToTab(tabId, type, data, context) {
  try {
    await chrome.tabs.sendMessage(tabId, {
      type,
      data,
      context: { selectionText: context?.selectionText }
    });
  } catch {
    if (type === "FORMAT_SELECTION" && data?.isValid && data?.formatted) {
      await chrome.scripting.executeScript({
        target: { tabId },
        args: [data.formatted, context?.selectionText || ""],
        func: (formatted, original) => {
          const selection = window.getSelection();
          if (!selection?.rangeCount) return;
          const range = selection.getRangeAt(0);
          const container = range.commonAncestorContainer;
          const target = container.nodeType === 1 ? container : container.parentElement;
          if (target && target.tagName === "TEXTAREA" || target?.tagName === "INPUT") {
            const el = target;
            const start = el.selectionStart ?? 0;
            const end = el.selectionEnd ?? el.value.length;
            el.value = el.value.slice(0, start) + formatted + el.value.slice(end);
          } else if (target?.isContentEditable) {
            range.deleteContents();
            range.insertNode(document.createTextNode(formatted));
          }
        }
      });
    }
  }
}

function storageGet(defaults) {
  return new Promise((resolve) => {
    chrome.storage.local.get(defaults, (items) => resolve(items || {}));
  });
}

function storageSet(items) {
  return new Promise((resolve) => {
    chrome.storage.local.set(items, () => resolve());
  });
}

function safeError(error) {
  return error?.message || String(error || "未知错误");
}
