# JSON Beautify — JSON 格式化 / 美化 / 压缩 / 验证 · Edge 扩展

> 面向开发者的轻量级 JSON 工具：格式化、压缩、验证、转义/反转义、双 JSON 对比、右键菜单、自动识别原始 JSON 页面。**所有处理在本机浏览器完成，零数据上传。**

本项目是一个基于 [Manifest V3](https://developer.chrome.com/docs/extensions/reference/manifest) 的 Edge（Chromium 内核）浏览器扩展。代码架构与 `src/manifest.json`、`src/background.js`、`ui/panel.html|js|css`、`ui/options.html|js|css` 的组织方式参考了同目录下的 LingoTrans 插件，便于后续维护与风格统一。

## ✨ 功能一览

- **编辑器（面板）**：粘贴或输入 JSON，一键美化（Format） / 压缩（Minify） / 验证（Validate）。
  - 支持 2 / 4 空格缩进或 Tab 字符；
  - 支持按键名（Key）递归排序；
  - 支持带注释、尾逗号、无引号 Key 等「松弛 JSON」的**自动修复后解析**；
  - 统计信息：行数、字节数、键数量、最大嵌套深度；
  - 格式化结果支持行号显示与对象/数组折叠，复制和下载始终保留完整 JSON；
  - 一键复制 / 下载 `.json` / 将输出送回输入区继续编辑。
- **工具集（Tools）**：
  - 字符串转义（`"` → `\"`） / 反转义；
  - 两份 JSON 结构与值比较（只看内容，不比较键顺序）。
- **右键菜单**：
  - 格式化选中的 JSON；
  - 美化当前页面 JSON；
  - 压缩选中的 JSON；
  - 验证选中的 JSON；
  - 复制美化后的 JSON 到剪贴板。
- **自动识别原始 JSON 页面**：
  - 当访问的 URL 以 `.json` 结尾或响应 `Content-Type: application/json` 时，自动以浅色薄荷绿工具页 + 语法高亮渲染，并提供原始/美化切换、一键复制、下载 `.json`。
  - 对于无法直接解析的 JSON 页面，右下角出现 `{ }` 浮动按钮，点击再尝试美化。
- **独立编辑器窗口**：点击工具栏图标打开最大化编辑器，适合处理长 JSON。
- **设置页**：默认缩进、是否默认排序、是否开启语法高亮、是否启用页面自动美化等偏好设置。

## 📁 目录结构

```
JSON-Format-Plugin/
├── assets/                       # 图标（16/32/48/128 PNG）
│   ├── icon-16.png
│   ├── icon-32.png
│   ├── icon-48.png
│   └── icon-128.png
├── scripts/                      # 资源生成脚本（PowerShell）
│   ├── generate-icons.ps1        # 生成 assets/icon-*.png 与 store-assets/logo-300.png
│   └── generate-store-assets.ps1 # 生成商店截图与大型横幅/促销图
├── src/                          # 扩展核心逻辑
│   ├── background.js             # Service Worker：消息路由、上下文菜单注册、JSON 解析核心
│   └── content.js                # 内容脚本：自动识别 JSON 页面、处理右键菜单消息、弹 Toast
├── ui/                           # 界面
│   ├── panel.html / .js / .css   # 独立编辑器窗口：格式化 / 对比 / 转义三种工作区
│   └── options.html / .js / .css # 设置页
├── store-assets/                 # 商店上架素材（由脚本生成）
│   ├── large-promo-1400x560.png
│   ├── small-promo-440x280.png
│   ├── logo-300.png
│   └── screenshot-{1..3}-*-1280x800.png
├── PRIVACY.md                    # 隐私政策（上架必须）
├── STORE_SUBMISSION.md           # Edge 附加商店提交检查清单
├── manifest.json                 # Manifest V3 清单（MV3）
└── README.md
```

## 🚀 本地加载 / 调试

1. 打开 Microsoft Edge，在地址栏输入 `edge://extensions` 并回车；
2. 打开左侧或底部的「开发人员模式」开关；
3. 点击「加载解压缩的扩展」，选择本项目根目录（`JSON-Format-Plugin/`，即 `manifest.json` 所在目录）；
4. 之后每改动代码，在 `edge://extensions` 页找到对应卡片，点击刷新按钮即可重新加载。

### 本地验证清单

- [ ] 工具栏图标点击后弹出面板，可以粘贴样例 JSON 并成功格式化；
- [ ] 右键菜单中的「格式化选中的 JSON」等项可用；
- [ ] 访问一个 `.json` 文件（例如本地测试接口）时自动美化；
- [ ] 选项页（扩展选项）可修改并保存设置；
- [ ] 点击工具栏图标后能打开最大化独立编辑器窗口。

## 🛠 脚本使用

所有脚本使用 Windows PowerShell 5+ 运行，不依赖 Node.js。

```powershell
# 生成图标（16/32/48/128 + 300 大 Logo）
.\scripts\generate-icons.ps1

# 生成 3 张截图 + 2 张促销横幅
.\scripts\generate-store-assets.ps1
```

## 🧩 架构说明

### 1. `background.js`（Service Worker, MV3）

- 消息路由：基于 `type` 字段分发 UI / content 发送过来的请求，统一使用 `{ ok, data | error }` 返回格式；
- JSON 工具函数：
  - `parseJsonRelaxed`：在标准 `JSON.parse` 失败后，尝试去除注释、尾逗号，并给未带引号的 Key 加引号，再做二次解析；
  - 错误位置计算：把 V8 默认的 `position` 转成「行+列」并给出前后 40 字符片段，便于定位；
  - `deepSortKeys`：对 Object 的 Key 做字典序递归排序（Array 顺序保持不变）；
- 右键菜单（`contextMenus`）：安装时注册；点击时构造消息发送到当前 Tab 的 content script 执行替换/复制/通知。

### 2. `content.js`

- 轻量 IIFE；只做两件事：
  - `maybeApplyAutoFormat`：在满足 JSON MIME / URL 后缀 / `<body>` 仅 `<pre>` 的条件下自动美化；
  - `chrome.runtime.onMessage.addListener`：处理 background 发来的「格式化 / 压缩 / 验证 选区」消息，尽量原地替换（textarea / contentEditable），否则退回到「复制+Toast 提示」。

### 3. `ui/panel.js`（独立编辑器窗口）

- `request()`：统一包装 `chrome.runtime.sendMessage`；
- 单页提供格式化、压缩、转义/反转义与 JSON 差异比较；
- 语法高亮：纯正则着色（key / string / number / boolean / null），不依赖第三方库。

### 4. `ui/options.js`（设置页）

- 所有字段映射到 `SAVE_SETTINGS` / `GET_SETTINGS` 消息；
- 提供「恢复默认」「清除本机数据」两个危险操作按钮，均有二次确认。

## 🔐 隐私与安全

**结论先行：本扩展 0 网络请求、0 数据上传。**

- 声明的 `<all_urls>` host 权限仅用于「右键菜单/读取页面 JSON」在任意站点（包括 `localhost` 与内网）生效；
- 没有埋点、没有第三方 SDK、没有远程配置拉取；
- 详细说明见 [PRIVACY.md](file:///e:/GitHub/JSON-Format-Plugin/PRIVACY.md)。

## 📦 打包发布（上架 Edge 附加商店）

1. 清理任何**开发者遗留凭据 / 个人 API Key**等（本扩展不需要任何凭据，但要确认仓库干净）；
2. 可选择执行 PowerShell `Compress-Archive` 打包 zip：

   ```powershell
   $exclude = @('scripts', 'store-assets', '*.md', '.git*');
   Compress-Archive -Path (Get-ChildItem . -Exclude $exclude) `
     -DestinationPath JSON-Beautify-1.0.0.zip -Force
   ```

3. 登录 [Microsoft Partner Center](https://partner.microsoft.com/dashboard) → Edge 附加组件 → 新建扩展 → 上传 zip；
4. 逐一填写：
   - 名称：`JSON Beautify - JSON 格式化与验证工具`（或中文/英文组合）；
   - 简短描述：与 `manifest.json.description` 保持一致；
   - 详细描述：可复制下文的上架长描述；
   - 分类：Developer Tools / Web Development；
   - 隐私策略 URL：将 `PRIVACY.md` 发布到公开页面后粘贴 URL；
   - 素材：上传 `store-assets/` 目录下的 PNG；
   - 权限声明：如实填写「仅在用户触发时访问页面」「不收集数据」。
5. 提交并等待审核。

完整上架检查清单见 [STORE_SUBMISSION.md](file:///e:/GitHub/JSON-Format-Plugin/STORE_SUBMISSION.md)。

## 📝 License & Credits

- 图标由本项目内置的 PowerShell GDI+ 脚本生成；
- 代码风格参考同仓库的 LingoTrans 项目（MV3 + Side Panel + Options 结构）。
