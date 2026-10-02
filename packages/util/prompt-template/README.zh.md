---
description: "Host 系统提示词渲染器与 Client 系统提示词编辑器共享的 {{name}} 提示词模板变量语法。"
kind: "package-library"
---

# @orochi-network/oh-util-prompt-template

[English](README.md) | 中文

## 概述

`oh-util-prompt-template` 拥有 Harness 唯一共享的 `{{name}}` 提示词语法：引用的写法、合法的变量名，以及模板文本如何被切分为普通文本、变量引用和错误形式。Host 系统提示词渲染器与 Client 系统提示词编辑器都通过 `scanPromptTemplate()` 扫描模板，因此编辑器报出的问题与渲染器拒绝的形式完全一致。扫描器对调用方持有的文本是纯函数，从不解析取值。

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

### 扫描模板

`scanPromptTemplate(text)` 返回按序切分 `text` 的 token 列表，每个 token 自带范围，无重叠无遗漏，调用方可据此原样重建文本。token 分为普通文本、携带已校验 `name` 与左花括号位置 `at` 的 `reference`、类似 `{{na me}}` 的 `malformed-name` 分组，以及被后续 `}}` 标记为“本应是引用”的 `malformed-group` 起始花括号。一次扫描报告所有错误形式；无后续 `}}` 配对的孤立 `{{` 按普通文本处理。

```ts
import { scanPromptTemplate } from '@orochi-network/oh-util-prompt-template'

const tokens = scanPromptTemplate('Run in {{cwd}}; see {{na me}}')
// literal "Run in ", reference cwd, literal "; see ", malformed-name "{{na me}}"
```

### 校验变量名

`VARIABLE_NAME` 是花括号之间的 `[a-z][a-z0-9_]*` 规则。在加载时和每次设置写入时校验名称，使已存文本无需恢复式扫描。

```ts
import { VARIABLE_NAME } from '@orochi-network/oh-util-prompt-template'

const name = 'model_small'
if (!VARIABLE_NAME.test(name)) throw new Error('malformed prompt variable name')
```

-----

<a id="understand-the-implementation"></a>
## 理解实现

<details>
<summary>实现内部细节 — 点击展开</summary>

扫描器是带普通文本游标的单次从左到右遍历：每个 token 先写出其之前的文本，再把游标推进到自身之后。仅当后续 `}}` 标记文本“本应是引用”时，`{{` 才开启错误分组；否则花括号保持普通文本，与渲染器一致。

### 源码地图

| 文件 | 职责 |
|---|---|
| [`src/index.ts`](src/index.ts) | 变量名规则与模板扫描器 |
| — | 不发布运行时 invariant companion，因为扫描器是对调用方持有文本的纯函数，无共享状态；单测覆盖其切分与错误形式。 |

</details>

-----

<a id="further-exploration"></a>
## 进一步探索

- [util 包地图](../README.zh.md) — 相邻的无状态 helper。
- [oh-system-prompt](../../core/system-prompt/README.zh.md) — 替换变量取值并拒绝本扫描器所报告错误形式的渲染器。
- [oh-client-ui-settings-system-prompt](../../client/ui-settings-system-prompt/README.zh.md) — 报告草稿引用问题的设置编辑器。

-----

<a id="model-experience"></a>
## 模型体验

无。本包只把模板文本扫描为 token；系统提示词渲染器拥有取值替换与每个模型可见取值。

#### KV 缓存影响

无；本包既不组装也不发送模型请求。

## 已知限制与延期工作

<a id="known-limitations-and-deferred-work"></a>

- **语法只接受一种引用形式** — 完整的简单 `{{name}}` 分组。嵌套花括号、带限定的名称和默认值语法不在范围内，会被扫描为普通文本或错误形式。
- **扫描器从不解析取值** — 替换、未知名称报告与渲染都属于渲染器。

<a id="dev-note"></a>
### 开发备注

<details>
<summary>维护者工作语境 — 点击展开</summary>

无。

</details>
