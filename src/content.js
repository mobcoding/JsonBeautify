(function () {
  "use strict";

  const HOST_ID = "__json_beautify_host__";
  const FLOAT_ID = "__json_beautify_float__";
  let floatingEl = null;
  let lastRawText = "";
  let runtimeSettings = {
    autoFormatOnView: true,
    indentSize: 2,
    useTabIndent: false,
    sortKeys: false
  };

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (!message) return;

    switch (message.type) {
      case "FORMAT_SELECTION":
        handleFormatSelection(message);
        break;
      case "FORMAT_PAGE":
        handleFormatPage(message);
        break;
      case "MINIFY_SELECTION":
        handleMinifySelection(message);
        break;
      case "VALIDATE_SELECTION":
        handleValidateSelection(message);
        break;
      default:
        break;
    }
  });

  init();

  async function init() {
    try {
      const settings = await requestBackground({ type: "GET_SETTINGS" });
      runtimeSettings = Object.assign(runtimeSettings, settings || {});
    } catch {
      // 使用默认值
    }

    maybeApplyAutoFormat();
  }

  async function maybeApplyAutoFormat() {
    if (!runtimeSettings.autoFormatOnView) return;

    const contentType = document.contentType || "";
    const url = location.href;
    const isJsonMime = /^application\/json/i.test(contentType) || /^text\/json/i.test(contentType);
    const isJsonUrl = /\.json(?:[?#]|$)/i.test(url);

    const pre = document.querySelector("pre");
    const onlyPre = pre && document.body && document.body.children.length === 1 && document.body.firstElementChild === pre;

    if (!(isJsonMime || isJsonUrl || onlyPre)) {
      return;
    }

    const rawText = pre?.innerText || document.body?.innerText || "";
    if (!looksLikeJson(rawText)) {
      ensureFloatingButton(rawText.trim());
      return;
    }

    lastRawText = rawText.trim();
    const formatted = await tryFormat(lastRawText);
    if (!formatted) {
      ensureFloatingButton(lastRawText);
      return;
    }
    renderPrettyInPage(formatted, lastRawText);
  }

  function looksLikeJson(text) {
    const t = String(text || "").trim();
    if (!t) return false;
    if ((t.startsWith("{") && t.endsWith("}")) || (t.startsWith("[") && t.endsWith("]"))) {
      return true;
    }
    if (t.length > 6 && (t.startsWith('"') || /^\d/.test(t) || t === "null" || t === "true" || t === "false")) {
      return true;
    }
    return false;
  }

  async function tryFormat(text) {
    try {
      const result = await requestBackground({
        type: "FORMAT_JSON",
        payload: {
          text,
          settings: {
            indentSize: runtimeSettings.indentSize,
            useTabIndent: runtimeSettings.useTabIndent,
            sortKeys: runtimeSettings.sortKeys
          }
        }
      });
      return result?.isValid ? result : null;
    } catch {
      return null;
    }
  }

  function renderPrettyInPage(formatted, raw) {
    if (!formatted?.formatted) return;

    let host = document.getElementById(HOST_ID);
    if (host) return;

    const body = document.body;
    if (!body) return;

    const styles = buildStyleTag();
    document.head.appendChild(styles);

    host = document.createElement("div");
    host.id = HOST_ID;
    host.innerHTML = `
      <div class="jb-banner">
        <div class="jb-banner-title">
          <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" fill="currentColor"><text x="1" y="18" font-size="16" font-family="monospace" font-weight="700">{}</text></svg>
          <strong>JSON Beautify</strong>
          <span class="jb-banner-meta">已自动格式化页面 JSON</span>
        </div>
        <div class="jb-banner-actions">
          <button type="button" class="jb-btn sm" id="jb-toggle-view">查看原始文本</button>
          <button type="button" class="jb-btn sm primary" id="jb-copy">复制美化版</button>
          <button type="button" class="jb-btn sm" id="jb-download">下载 .json</button>
        </div>
      </div>
      <div class="jb-card">
        <div class="jb-stats">
          <span class="jb-stat"><strong>${formatted.stats?.lineCount ?? 0}</strong><em>行</em></span>
          <span class="jb-stat"><strong>${formatBytes(formatted.stats?.byteLength ?? 0)}</strong><em>美化后</em></span>
          <span class="jb-stat"><strong>${formatted.stats?.keys ?? 0}</strong><em>键</em></span>
          <span class="jb-stat"><strong>${formatted.stats?.maxDepth ?? 0}</strong><em>最大深度</em></span>
        </div>
        <div class="jb-views">
          <pre class="jb-view jb-view-pretty active" id="jb-view-pretty"></pre>
          <pre class="jb-view jb-view-raw" id="jb-view-raw"></pre>
        </div>
      </div>
    `;

    while (body.firstChild) body.removeChild(body.firstChild);
    body.appendChild(host);

    const prettyEl = host.querySelector("#jb-view-pretty");
    const rawEl = host.querySelector("#jb-view-raw");
    prettyEl.textContent = formatted.formatted;
    rawEl.textContent = raw;

    prettyEl.innerHTML = highlightJson(formatted.formatted);

    let showingPretty = true;
    host.querySelector("#jb-toggle-view").addEventListener("click", () => {
      showingPretty = !showingPretty;
      prettyEl.classList.toggle("active", showingPretty);
      rawEl.classList.toggle("active", !showingPretty);
      host.querySelector("#jb-toggle-view").textContent = showingPretty ? "查看原始文本" : "查看美化版";
    });

    host.querySelector("#jb-copy").addEventListener("click", async () => {
      const text = showingPretty ? formatted.formatted : raw;
      try {
        await navigator.clipboard.writeText(text);
        flashButton(host.querySelector("#jb-copy"), "已复制");
      } catch {
        flashButton(host.querySelector("#jb-copy"), "复制失败", true);
      }
    });

    host.querySelector("#jb-download").addEventListener("click", () => {
      const text = showingPretty ? formatted.formatted : raw;
      const blob = new Blob([text], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const name = suggestFilename(location.href, showingPretty ? "pretty" : "raw");
      a.download = name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 0);
    });

    document.title = document.title.replace(/^(.{1,40}?)(\.json)?$/i, (_m, base) => `${base || "JSON"} · 已美化`);
  }

  function ensureFloatingButton(raw) {
    if (floatingEl || !raw) return;

    floatingEl = document.createElement("button");
    floatingEl.id = FLOAT_ID;
    floatingEl.type = "button";
    floatingEl.title = "JSON Beautify：美化当前页面 JSON";
    floatingEl.textContent = "{ }";

    const css = `#${FLOAT_ID}{position:fixed;z-index:2147483646;right:18px;bottom:18px;width:52px;height:52px;border:1px solid #a9d4ca;border-radius:12px;cursor:pointer;background:#087b68;color:#fff;font-family:"Cascadia Code",Consolas,monospace;font-size:18px;font-weight:700;box-shadow:0 8px 20px rgba(8,123,104,.25);transition:transform .12s ease,box-shadow .12s ease}#${FLOAT_ID}:hover{transform:translateY(-2px);background:#056554;box-shadow:0 12px 26px rgba(8,123,104,.32)}`;
    const style = document.createElement("style");
    style.textContent = css;
    (document.head || document.documentElement).appendChild(style);
    (document.body || document.documentElement).appendChild(floatingEl);

    floatingEl.addEventListener("click", async () => {
      const result = await tryFormat(raw);
      if (result?.isValid) {
        lastRawText = raw;
        renderPrettyInPage(result, raw);
        if (floatingEl) {
          floatingEl.remove();
          floatingEl = null;
        }
      } else {
        flashFloating(floatingEl, "无效 JSON");
      }
    });
  }

  function handleFormatSelection(message) {
    const result = message.data;
    const selection = window.getSelection();
    if (!selection?.rangeCount) return;

    if (result?.isValid && result?.formatted) {
      replaceSelectionWithText(selection, result.formatted);
      toast("选中内容已美化 ✓");
    } else {
      toast(`选中内容不是合法 JSON：${result?.error?.message || "解析失败"}`, true);
    }
  }

  function handleFormatPage(message) {
    const pre = document.querySelector("pre");
    const raw = pre?.innerText || document.body?.innerText || "";
    if (!raw.trim()) {
      toast("未在页面中找到可格式化文本。", true);
      return;
    }
    runtimeSettings = Object.assign(runtimeSettings, message.data?.settings || {});
    maybeApplyAutoFormat();
  }

  function handleMinifySelection(message) {
    const result = message.data;
    const selection = window.getSelection();
    if (!selection?.rangeCount) return;

    if (result?.isValid && result?.minified) {
      replaceSelectionWithText(selection, result.minified);
      toast("选中内容已压缩为单行。");
    } else {
      toast(`选中内容不是合法 JSON：${result?.error?.message || "解析失败"}`, true);
    }
  }

  function handleValidateSelection(message) {
    const result = message.data;
    if (!result) return;

    if (result.isValid) {
      const stats = result.stats || {};
      toast(`验证通过：${stats.lineCount || 0} 行，约 ${formatBytes(stats.byteLength || 0)}`);
    } else {
      const err = result.error || {};
      const loc = err.line && err.column ? `（第 ${err.line} 行，第 ${err.column} 列）` : "";
      toast(`验证失败：${err.message || "解析失败"}${loc}`, true, 5200);
    }
  }

  function replaceSelectionWithText(selection, text) {
    const range = selection.getRangeAt(0);
    const container = range.commonAncestorContainer;
    const target = container.nodeType === 1 ? container : container.parentElement;

    if (target && (target.tagName === "TEXTAREA" || target.tagName === "INPUT")) {
      const el = target;
      const start = el.selectionStart ?? 0;
      const end = el.selectionEnd ?? el.value.length;
      el.value = el.value.slice(0, start) + text + el.value.slice(end);
      const newPos = start + text.length;
      try { el.setSelectionRange(newPos, newPos); } catch {}
      el.dispatchEvent(new Event("input", { bubbles: true }));
      return;
    }

    if (target?.isContentEditable) {
      range.deleteContents();
      range.insertNode(document.createTextNode(text));
      return;
    }

    navigator.clipboard.writeText(text).then(
      () => toast("结果已复制到剪贴板（原选区不可编辑）。"),
      () => toast("结果已生成，但当前位置无法替换。请手动替换。", true)
    );
  }

  function flashButton(btn, text, bad) {
    const original = btn.textContent;
    btn.textContent = text;
    btn.dataset.was = original;
    if (bad) btn.style.background = "#dc2626";
    setTimeout(() => {
      btn.textContent = btn.dataset.was || original;
      btn.style.background = "";
    }, 1200);
  }

  function flashFloating(btn, text) {
    const original = btn.textContent;
    btn.textContent = "!";
    btn.title = text;
    setTimeout(() => {
      btn.textContent = original;
    }, 900);
  }

  function toast(message, bad, durationMs) {
    const id = "__json_beautify_toast__";
    let el = document.getElementById(id);
    if (!el) {
      el = document.createElement("div");
      el.id = id;
      const style = document.createElement("style");
      style.textContent = `#${id}{position:fixed;z-index:2147483647;left:50%;top:24px;transform:translateX(-50%) translateY(-12px);padding:10px 16px;border-radius:999px;background:#0f172a;color:#fff;font-size:13px;box-shadow:0 10px 28px rgba(15,23,42,.35);opacity:0;pointer-events:none;transition:opacity .18s ease,transform .18s ease;max-width:min(560px,calc(100% - 32px));text-align:center}#${id}.show{opacity:1;transform:translateX(-50%) translateY(0)}#${id}.bad{background:#7f1d1d}`;
      (document.head || document.documentElement).appendChild(style);
      (document.body || document.documentElement).appendChild(el);
    }
    el.className = "show" + (bad ? " bad" : "");
    el.textContent = message;
    const dur = durationMs || (bad ? 3800 : 2200);
    clearTimeout(toast._t);
    toast._t = setTimeout(() => {
      el.classList.remove("show");
    }, dur);
  }

  function buildStyleTag() {
    const s = document.createElement("style");
    s.textContent = `
      html,body,#${HOST_ID}{margin:0;padding:0;background:#f1f5f4;color:#253033;font-family:"Segoe UI",system-ui,"PingFang SC","Microsoft YaHei UI",sans-serif}
      body{min-width:320px}
      #${HOST_ID}{min-height:100vh;padding:24px 18px 42px;box-sizing:border-box;background:linear-gradient(180deg,#f7faf9 0%,#eef5f3 100%)}
      #${HOST_ID} *{box-sizing:border-box}
      .jb-banner{max-width:1180px;margin:0 auto 14px;padding:12px 14px;border-radius:10px;background:#fff;border:1px solid #d8e1de;display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;box-shadow:0 1px 2px rgba(30,53,49,.04)}
      .jb-banner-title{display:flex;align-items:center;gap:10px;min-width:0;color:#526164}
      .jb-banner-title svg{color:#087b68;flex:0 0 auto}
      .jb-banner-title strong{color:#253033;font-weight:800;font-size:16px}
      .jb-banner-meta{color:#718083;font-size:12px;padding-left:10px;border-left:1px solid #d8e1de}
      .jb-banner-actions{display:flex;gap:6px;flex-wrap:wrap}
      .jb-btn{cursor:pointer;border:1px solid #d8e1de;border-radius:7px;padding:6px 12px;font-weight:600;background:#f8faf9;color:#496066;transition:background .12s ease,transform .08s ease,border-color .12s ease}
      .jb-btn:hover{background:#eaf3f1;border-color:#9bbdb6;color:#056554}
      .jb-btn:active{transform:translateY(1px)}
      .jb-btn.sm{padding:5px 10px;font-size:12px;border-radius:6px}
      .jb-btn.primary{background:#087b68;border-color:#087b68;color:#fff;box-shadow:0 5px 12px rgba(8,123,104,.2)}
      .jb-btn.primary:hover{background:#056554;border-color:#056554;color:#fff}
      .jb-card{max-width:1180px;margin:0 auto;border-radius:10px;overflow:hidden;border:1px solid #bdcdca;background:#fff;box-shadow:0 2px 7px rgba(30,53,49,.06)}
      .jb-stats{display:flex;gap:18px;padding:10px 14px;border-bottom:1px solid #d8e1de;color:#718083;font-size:12px;flex-wrap:wrap;background:#f8faf9}
      .jb-stat strong{margin-right:4px;color:#087b68;font-weight:800}
      .jb-stat em{font-style:normal;opacity:.8}
      .jb-views{position:relative}
      .jb-view{margin:0;padding:18px 20px;white-space:pre;overflow:auto;min-height:calc(100vh - 220px);font-family:"Cascadia Code","JetBrains Mono","Fira Code",Consolas,Menlo,monospace;font-size:13px;line-height:1.65;color:#263538;display:none;background:#fbfcfc}
      .jb-view.active{display:block}
      .jb-view-pretty .j-key{color:#a33c74}
      .jb-view-pretty .j-str{color:#9a6210}
      .jb-view-pretty .j-num{color:#176eae}
      .jb-view-pretty .j-bool{color:#1d7b5c;font-weight:700}
      .jb-view-pretty .j-null{color:#ae4a4a;font-style:italic}
    `;
    return s;
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

  function suggestFilename(url, tag) {
    try {
      const u = new URL(url);
      const base = u.pathname.split("/").filter(Boolean).pop() || "data";
      const clean = base.replace(/\.json$/i, "").replace(/[^\w.\-]+/g, "_") || "response";
      return `${clean}.${tag}.json`;
    } catch {
      return `${tag}-${Date.now()}.json`;
    }
  }

  function requestBackground(message) {
    return new Promise((resolve, reject) => {
      try {
        chrome.runtime.sendMessage(message, (response) => {
          const error = chrome.runtime.lastError;
          if (error) {
            reject(new Error(error.message));
            return;
          }
          if (!response?.ok) {
            reject(new Error(response?.error || "后台未响应。"));
            return;
          }
          resolve(response.data);
        });
      } catch (err) {
        reject(err);
      }
    });
  }
})();
