---
description: "oh Web 客户端的系统提示词设置分区：在 system-prompt 命名空间上编辑部署级人设模板及其自定义 {{name}} 变量，并在编辑器光标处插入引用的选择器。"
kind: "package-reference"
---

# @orochi-network/oh-client-ui-settings-system-prompt

[English](README.md) | 中文

## 概述

在 Web 客户端打开**设置**并选择**系统提示词**，即可编辑渲染在内置指引之前与之后的部署级人设文本，以及文本可引用的自定义 `{{name}}` 变量。所有修改都是暂存的：所见即一次保存写入的内容，以草稿读取时的修订号为围栏；Host 拒绝的保存会保留草稿供修改。仅当 Host 提供 `system-prompt` 命名空间时页面才存在。

## 目录

- [使用本包](#use-this-package)
- [理解实现](#understand-the-implementation)
- [进一步探索](#further-exploration)
- [模型体验](#model-experience)
- [已知限制与延期工作](#known-limitations-and-deferred-work)
- [开发备注](#dev-note)

-----

<a id="use-this-package"></a>
## 使用本包

**提示词文本**包含**前缀**与**后缀**两个自动增高的文本域。渲染器会拒绝的引用 — `{{}}`、`{{na me}}`、带后续 `}}` 的孤立 `{{` — 会阻止保存并在字段下方点名；未被任何变量解析的引用只警告不阻止，因为部署可能注册本页看不到的变量。清空字段即返回组合层取值，用户层条目会标记**已覆盖**并提供恢复默认控件。

**自定义变量**是有序的名称/取值行。仅当名称符合 `{{name}}` 语法、不与其他行重复、也不占用内置名称（`cwd`、`model`、`provider`）时该行才能保存；每种拒绝原因都会点名到对应行。删除所有行会清空已存映射，**恢复默认**则让映射回到组合层取值。

**变量**选择器列出内置变量与名称可用的自定义行；单击即把 `{{name}}` 引用插入到聚焦编辑器的光标处，无聚焦编辑器时插入到前缀末尾。一次**保存**以一次带修订围栏的原子写入提交全部暂存修改，**放弃**则全部丢弃。

-----

<a id="understand-the-implementation"></a>
## 理解实现

<details>
<summary>实现内部细节 — 点击展开</summary>

Host 侧是空的 `apply`，只为让包持有 Loader 行、由客户端模块系统据此服务浏览器侧。浏览器侧通过 `ctx.configForms.get('system-prompt')` 绑定命名空间；`SystemPromptEditorController` 在 `ui-primitives` 共享的 `SettingsFormScope` 上暂存字段草稿与变量行，合成每行的首个保存问题（语法、内置名称、重复），并规划一次原子 `mutate`，其修订围栏是首个草稿读取时的快照。引用扫描来自 `oh-util-prompt-template`，与 Host 渲染器执行同一套语法。页面经 `ctx.configForms.whileServed` 注册到 `settings.section` 插槽；本页持有该条目期间，system-prompt 注册表会关闭 schema 生成的设置页。

### 源码地图

| 文件 | 职责 |
|---|---|
| [`src/index.ts`](src/index.ts) | Host 插件入口：浏览器侧的 Loader 行 |
| [`src/client/index.ts`](src/client/index.ts) | 浏览器插件入口：locale、控制器与 `settings.section` 注册 |
| [`src/client/system-prompt-editor-controller.ts`](src/client/system-prompt-editor-controller.ts) | 暂存表单：草稿、行问题、引用问题与带围栏的保存 |
| [`src/client/SystemPromptSection.tsx`](src/client/SystemPromptSection.tsx) | 共享 `SettingsForm` 内渲染的页面 |
| [`src/client/VariablePicker.tsx`](src/client/VariablePicker.tsx) | 编辑器旁的引用选择器 |
| [`src/client/references.ts`](src/client/references.ts) | 基于共享扫描器的草稿引用问题 |
| [`src/client/variable-catalog.ts`](src/client/variable-catalog.ts) | 选择器列出的内置变量 |
| [`src/client/locales.ts`](src/client/locales.ts) | 英文与简体中文字典及表单框架文案 |
| — | 不发布运行时 invariant companion，因为本页只暂存并写入设置取值，组装由 system-prompt 注册表负责；单测固定这些暂存写入。 |

</details>

-----

<a id="further-exploration"></a>
## 进一步探索

- [ui-settings](../ui-settings/README.zh.md) — 页面所依托的设置作用域与命名空间服务监视。
- [ui-primitives](../ui-primitives/README.zh.md) — 编辑器渲染所用的设置表单模型与字段。
- [oh-system-prompt](../../core/system-prompt/README.zh.md) — 将人设模板组装进每个请求系统提示词的注册表。
- [oh-util-prompt-template](../../util/prompt-template/README.zh.md) — 编辑器与渲染器共享的 `{{name}}` 语法。

-----

<a id="model-experience"></a>
## 模型体验

间接生效：通过 system-prompt 注册表，把已存的人设模板组装进其后每个请求的系统提示词。

#### KV 缓存影响

人设前缀渲染在内置指引之前，因此模板修改会改变请求前缀，并在修改后的文本跨轮稳定之前终止提供方的提示词缓存复用。

## 已知限制与延期工作

<a id="known-limitations-and-deferred-work"></a>

- **页面只编辑命名空间的三个字段** — `personaPrefix`、`personaSuffix` 与 `variables`。`toolOrder` 与身份开关仍由 `cordis.yml` 组合层拥有。
- **其他插件注册的变量名会被报告为未知** — 检查器只知道三个内置变量与屏幕上可见的行，因此部署自注册的提示词变量在被引用时会出现警告，尽管渲染器在组装时能解析它们。

<a id="dev-note"></a>
### 开发备注

<details>
<summary>维护者工作语境 — 点击展开</summary>

无。

</details>
