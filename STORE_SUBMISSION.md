# Edge 附加商店（Microsoft Edge Add-ons）上架清单

> 使用前先通读一遍 [PRIVACY.md](file:///e:/GitHub/JSON-Format-Plugin/PRIVACY.md) 与 [README.md](file:///e:/GitHub/JSON-Format-Plugin/README.md)，确保你理解扩展实际行为与提交声明一致。

## 一、提交前本地自检（Manifest & 功能）

- [ ] `manifest.json` 的 `version` 已从 `1.0.0` 升级（若为更新版本）；
- [ ] `name` / `short_name` / `description` 与 Partner Center 填写的条目保持一致，无夸大措辞；
- [ ] `permissions` / `host_permissions` 未引入不必要的新权限；
- [ ] 本地 `edge://extensions` 「加载解压缩」后，**首次安装**：
  - [ ] 弹出面板（`ui/panel.html`）无报错；
  - [ ] 点「示例」能载入 JSON 且点「美化格式化」有输出 + 统计信息；
  - [ ] 转义/反转义、两份 JSON 比较均可用；
  - [ ] 「扩展选项」设置页能保存/恢复默认/清除本机数据。
- [ ] 新建一个空白 Tab，访问任意 `.json` 结尾 URL（或本地 Mock 接口），检查自动美化的浮层 UI + 复制/下载按钮；
- [ ] 在任意网页 `<textarea>` 里粘贴一段 JSON，选中 → 右键「格式化选中的 JSON」，确认原地替换生效。
- [ ] 点击工具栏图标：以最大化独立窗口方式打开全屏编辑器（非 popup 小窗，非侧栏）。

## 二、打包（zip 上传）

推荐用 PowerShell（不要用 Windows 资源管理器右键「发送到 → 压缩文件夹」，它会额外嵌套一层）：

```powershell
cd e:\GitHub\JSON-Format-Plugin
$exclude = @('scripts', 'store-assets', '*.md', '.gitignore', '.gitattributes', '.git', '*.zip');
Compress-Archive -Path (Get-ChildItem . -Force | Where-Object { $exclude -notcontains $_.Name }) `
  -DestinationPath "JSON-Beautify-$((Get-Content manifest.json | ConvertFrom-Json).version).zip" -Force
```

解压 zip 后检查顶层应当直接有 `manifest.json`，而不是外层再套一层目录。

## 三、Partner Center 逐项填写

### 3.1 扩展元数据（Properties / 描述）

| 字段 | 建议填写 |
| --- | --- |
| 名称 Name（128 字符内） | `JSON Beautify - JSON 格式化与验证工具` |
| 简短描述 Short description（180 字符内） | `简洁高效的 JSON 格式化、美化、压缩、转义、对比与验证工具。自动识别原始 JSON 页面并美化。全部处理本地完成，零数据上传。` |
| 详细描述 Long description（10k 字符内） | 复制下方 §3.2 长描述 |
| 分类 Category | Developer Tools |
| 子分类 Sub-Category | Web Development |
| 搜索关键词 Search terms | `json formatter`、`json beautify`、`json validator`、`json compare`、`格式化`、`美化`、`压缩`、`开发者工具` |
| 目标设备 | 桌面（Desktop）即可 |
| 最低 Edge 版本 | 建议 `114.0`（MV3 + Side Panel 都稳定） |
| 网站 Website | 如有项目仓库则填写仓库 URL |
| 支持电子邮件 Support contact | 你的公开邮箱 |
| 隐私策略 URL Privacy policy URL | 必须。将 `PRIVACY.md` 渲染为公开网页（如 GitHub Pages）后粘贴链接 |
| 商户资料 | 首次提交流程时按提示完善 |

### 3.2 建议的长描述（可直接复制再按情况改）

```
JSON Beautify 是一款为开发者与数据分析同学打造的轻量级 JSON 工具。所有解析、格式化、比较等处理**全部在本机浏览器内完成**，不发起任何网络请求，不上传任何数据，不包含任何追踪 SDK 或广告。

核心功能：
● 编辑器：粘贴/输入 JSON，一键美化格式化 / 压缩单行 / 语法验证；支持 2/4 空格缩进或 Tab，支持带注释、尾逗号、无引号 Key 等「松弛 JSON」自动修复。
● 统计面板：格式化后展示行数、字节数、对象键数、最大嵌套深度。
● 编辑器结果支持行号显示与对象/数组折叠，折叠不影响复制和下载的完整内容。
● 一键复制 / 下载 .json / 把结果再次送到输入区，方便迭代编辑。
● 工具集：
  — 字符串转义（" → \"）与反转义；
  — 两份 JSON 结构与值比较（忽略键顺序）。
● 右键菜单：
  — 格式化选中的 JSON；
  — 美化当前页面 JSON；
  — 压缩选中的 JSON；
  — 验证选中的 JSON；
  — 复制美化后的 JSON。
● 自动识别原始 JSON 页面：访问以 .json 结尾的 URL、响应 Content-Type 为 application/json、或整页仅有 <pre> 的页面时，自动以浅色薄荷绿工具页 + 语法高亮渲染，并提供原始/美化切换、一键复制、下载文件等浮层控件。
● 点击工具栏图标：以最大化独立窗口方式打开全屏编辑器，获得与桌面 IDE 一致的大工作区；全局保持唯一实例，避免多窗口打扰。

权限使用说明：
● storage：仅在本机浏览器保存用户偏好（缩进方式、是否自动美化、是否启用语法高亮等），不会上传也不跨设备同步。
● contextMenus：提供右键快捷入口。
● activeTab / scripting：仅在用户主动点击右键菜单或「读取页面 JSON」按钮时，临时读取当前页文本或在可编辑元素中原地替换结果，从未在后台静默访问。
● <all_urls> host 权限：允许右键菜单与页面读取功能在 localhost、内网、私有 API 等任意站点生效，**扩展自身不会主动向这些地址发起任何请求**。
```

### 3.3 素材上传（Store Assets）

`store-assets/` 目录下已生成的文件用途对应：

| 本地文件 | 商店位置 | 尺寸要求 | 备注 |
| --- | --- | --- | --- |
| `logo-300.png` | Logo（图标） | 最小 300×300，正方形 | 若商店要求 440×280 等多规格，可再导出缩放版 |
| `screenshot-1-editor-1280x800.png` | 截图 1 | 最小 640×400，1280×800 最佳 | 编辑器美化 + 统计 + 语法高亮 |
| `screenshot-2-compare-1280x800.png` | 截图 2 | 1280×800 | 双 JSON 对比与差异定位 |
| `screenshot-3-auto-1280x800.png` | 截图 3 | 同上 | 访问原始 JSON 接口时自动美化 |
| `large-promo-1400x560.png` | 大型促销横幅 Large Promotional Tile | **必须** 1400×560 | 浅色薄荷绿品牌横幅 + JSON 代码预览 |
| `small-promo-440x280.png` | 小型促销横幅 Small Promotional Tile | 440×280 | — |

如果后续想换截图，直接重跑：

```powershell
.\scripts\generate-store-assets.ps1
```

### 3.4 年龄分级 / 敏感信息声明

- [ ] 年龄分级：一般（General）即可；面向普通开发者，无成人/医疗/金融/儿童相关内容；
- [ ] 收集个人信息：**否（Does not collect）**；
- [ ] 处理健康/金融/法律等敏感数据：否；
- [ ] 是否使用位置信息：否；
- [ ] 是否使用摄像头、麦克风、通知等硬件能力：否。

### 3.5 权限合理性说明（Permissions Justification，新版商店必写）

每个权限都要在 Partner Center 的权限栏里补充一句描述，建议直接复制：

#### `storage`
> 仅用于将用户的偏好设置（缩进方式、是否默认按键排序、是否启用自动美化、是否启用语法高亮等）保存在本机浏览器的 `chrome.storage.local`。格式化结果支持行号与折叠，但折叠状态不作为持久化数据保存。不与任何服务器同步，不上传任何数据。

#### `contextMenus`
> 在网页的右键菜单中提供开发人员常用的 JSON 快捷入口：格式化选中文本、美化当前页面、压缩、验证、复制美化结果。触发完全由用户点击决定，不在后台静默执行。

#### `activeTab`
> 用户通过右键菜单或面板中的「读取页面 JSON」按钮主动触发时，临时获得当前活动标签页的访问权限，用于读取页面 `<pre>` / `<body>` 文本或替换选区中的 JSON。用户不主动触发时不访问任何标签页。

#### `scripting`
> 配合 `activeTab` / `contextMenus`，在用户主动触发时于当前页面执行一次性脚本：读取选区文本、把格式化结果写回 `<textarea>` / `contentEditable` 元素、将内容写入剪贴板。不会用于页面 DOM 的长期注入或跟踪。

#### `tabs`
> 1) 用户点击工具栏图标时，使用 `chrome.windows.create` 打开最大化的独立编辑器窗口；2) 在多个已打开的编辑器实例之间做「唯一窗口」互斥管理，避免多开重复窗口；3) 查找用户的最后一个常规浏览器窗口，以便在需要时切换上下文。该权限仅用于窗口管理，不会读取或修改标签页实际内容，不会用于标签页跟踪。

#### `host_permissions: <all_urls>`
> 由于开发人员经常需要在内网环境、`localhost`、私有 API 网关等「任意来源」的页面中使用右键菜单或「读取当前页面 JSON」，因此需要较宽的 host 权限。扩展自身不包含任何 `fetch` / `XMLHttpRequest` 调用，不主动向 `host_permissions` 范围内的站点发起请求；该权限仅用于在用户触发时读取当前页。

## 四、隐私策略（Privacy Policy）

必须提供公开可访问的 URL。推荐做法之一：

1. 把本仓库推到 **Public GitHub 仓库**；
2. 开启 `Settings → Pages`，从 `main` 分支根目录托管；
3. 隐私页链接为 `https://<user>.github.io/<repo>/PRIVACY.md`（或渲染后的 HTML 页面）。

提交时若遇到「必须 HTTPS / 必须可访问」的报错：
- 检查仓库是否 Public；
- 单独用一个 HTML 渲染 PRIVACY.md 内容比纯 md 链接更稳妥。

## 五、审核中常见拒审原因 Checklist

- [ ] 功能描述与实际一致：没有使用「最快 / 最强 / 最佳」等无法证明的夸大词；
- [ ] 截图真实反映当前版本 UI（不要放 Photoshop 合成图）；
- [ ] 隐私声明与扩展实际行为一致：声明不收集 → 代码里就不要出现任何外发请求；
- [ ] `<all_urls>` 权限有明确、可信的理由（参考 3.5）；
- [ ] Manifest 中的 action / options_page 路径全部真实存在，不会 404；
- [ ] 没有包含任何远程执行代码（MV3 要求）：所有 `.js` 都在包里，没有 `eval` 下载执行的第三方脚本；
- [ ] Content Security Policy（`manifest.json` 的 `content_security_policy`）保持默认严格即可，不要放宽 `unsafe-eval`。

## 六、发布后

- 记录发布版本号与 Partner Center 的「扩展 ID」；
- 若审核方要求补充信息，优先把说明文档链接到本仓库的 README / PRIVACY / STORE_SUBMISSION，便于他们复核；
- 后续发版注意：
  - `manifest.json` 的 `version` 必须单调递增；
  - 不要把开发者测试数据（API Key、Cookie、临时文件）打包到 zip；
  - 更新 STORE_SUBMISSION 中新增功能对应的权限说明或截图。

祝上架顺利 🎉
