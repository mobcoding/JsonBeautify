const form = document.querySelector("#settingsForm");
const fields = {
  indentMode: document.querySelector("#indentMode"),
  expandLevel: document.querySelector("#expandLevel"),
  sortKeys: document.querySelector("#sortKeys"),
  syntaxHighlight: document.querySelector("#syntaxHighlight"),
  autoFormatOnView: document.querySelector("#autoFormatOnView")
};
const notice = document.querySelector("#notice");
const resetDefaults = document.querySelector("#resetDefaults");
const clearData = document.querySelector("#clearData");

const DEFAULT_INDENT_MODE = "space-2";

document.addEventListener("DOMContentLoaded", loadSettings);
form.addEventListener("submit", async (event) => {
  event.preventDefault();
  await saveSettings();
});
resetDefaults.addEventListener("click", restoreDefaults);
clearData.addEventListener("click", clearStorageData);

async function loadSettings() {
  try {
    const settings = await request({ type: "GET_SETTINGS" });
    applySettingsToForm(settings);
    showNotice("设置已读取。", "good");
  } catch (error) {
    showNotice(error.message, "bad");
  }
}

async function saveSettings() {
  setBusy(true);
  try {
    const payload = readFormPayload();
    await request({ type: "SAVE_SETTINGS", settings: payload });
    showNotice("设置已保存。下次打开面板时生效。", "good");
  } catch (error) {
    showNotice(error.message, "bad");
  } finally {
    setBusy(false);
  }
}

async function restoreDefaults() {
  if (!window.confirm("确定恢复所有设置为默认值吗？")) {
    return;
  }

  setBusy(true);
  try {
    const defaults = {
      indentSize: 2,
      useTabIndent: false,
      sortKeys: false,
      quoteKeys: true,
      autoFormatOnView: true,
      syntaxHighlight: true,
      expandLevel: 1,
      maxDepth: 100
    };
    await request({ type: "SAVE_SETTINGS", settings: defaults });
    applySettingsToForm(defaults);
    showNotice("已恢复默认设置。", "good");
  } catch (error) {
    showNotice(error.message, "bad");
  } finally {
    setBusy(false);
  }
}

async function clearStorageData() {
  if (!window.confirm("确定清除本机保存的设置吗？这不会影响扩展本身。")) {
    return;
  }

  setBusy(true);
  try {
    await new Promise((resolve, reject) => {
      chrome.storage.local.clear(() => {
        const err = chrome.runtime.lastError;
        if (err) reject(new Error(err.message));
        else resolve();
      });
    });
    const fresh = await request({ type: "GET_SETTINGS" });
    applySettingsToForm(fresh);
    showNotice("本机数据已清除。", "good");
  } catch (error) {
    showNotice(error.message, "bad");
  } finally {
    setBusy(false);
  }
}

function applySettingsToForm(settings) {
  const useTab = Boolean(settings.useTabIndent);
  const size = parseInt(settings.indentSize, 10) || 2;
  let mode;
  if (useTab) {
    mode = "tab";
  } else if (size >= 4) {
    mode = "space-4";
  } else {
    mode = "space-2";
  }
  fields.indentMode.value = mode;
  fields.expandLevel.value = String(parseInt(settings.expandLevel, 10) || 1);
  fields.sortKeys.checked = Boolean(settings.sortKeys);
  fields.syntaxHighlight.checked = Boolean(settings.syntaxHighlight ?? true);
  fields.autoFormatOnView.checked = Boolean(settings.autoFormatOnView ?? true);
}

function readFormPayload() {
  const mode = fields.indentMode.value;
  let indentSize = 2;
  let useTabIndent = false;

  if (mode === "tab") {
    indentSize = 4;
    useTabIndent = true;
  } else if (mode === "space-4") {
    indentSize = 4;
    useTabIndent = false;
  } else {
    indentSize = 2;
    useTabIndent = false;
  }

  return {
    indentSize,
    useTabIndent,
    sortKeys: fields.sortKeys.checked,
    syntaxHighlight: fields.syntaxHighlight.checked,
    autoFormatOnView: fields.autoFormatOnView.checked,
    expandLevel: parseInt(fields.expandLevel.value, 10) || 1
  };
}

function showNotice(message, mood) {
  notice.textContent = message;
  notice.classList.toggle("good", mood === "good");
  notice.classList.toggle("bad", mood === "bad");
}

function setBusy(isBusy) {
  for (const field of Object.values(fields)) {
    if (field && typeof field.disabled === "boolean") {
      field.disabled = isBusy;
    }
  }
  resetDefaults.disabled = isBusy;
  clearData.disabled = isBusy;
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
