---
description: "The {{name}} prompt-template variable grammar shared by the Host system-prompt renderer and the Client System Prompt editor."
kind: "package-library"
---

# @orochi-network/oh-util-prompt-template

English | [中文](README.zh.md)

## Summary

`oh-util-prompt-template` owns the one `{{name}}` prompt-variable grammar the harness shares: how a reference is written, which names are valid, and how template text tiles into prose, references, and malformed forms. The Host system-prompt renderer and the Client System Prompt editor both scan through `scanPromptTemplate()`, so an editor's complaints are exactly the renderer's rejections. The scanner is pure over caller-owned text and never resolves values.

## Table of Contents

- [Use this package](#use-this-package)
- [Understand the implementation](#understand-the-implementation)
- [Further Exploration](#further-exploration)
- [Model Experience](#model-experience)
- [Known Limitations and Deferred Work](#known-limitations-and-deferred-work)
- [Dev Note](#dev-note)

-----

<a id="use-this-package"></a>
## Use this package

### Scan a template

`scanPromptTemplate(text)` returns the tokens that tile `text` in order, each carrying its own extent with no gap or overlap, so a consumer can rebuild the text verbatim. A token is literal prose, a `reference` with its validated `name` and the opening brace's `at` index, a `malformed-name` group such as `{{na me}}`, or a `malformed-group` opening braces that a later `}}` marks as meant to be a reference. One pass reports every malformed form; a lone `{{` that no later `}}` completes is literal prose.

```ts
import { scanPromptTemplate } from '@orochi-network/oh-util-prompt-template'

const tokens = scanPromptTemplate('Run in {{cwd}}; see {{na me}}')
// literal "Run in ", reference cwd, literal "; see ", malformed-name "{{na me}}"
```

### Validate a reference name

`VARIABLE_NAME` is the `[a-z][a-z0-9_]*` rule between the braces. Validate a name at load and at every settings write so stored text never needs recovery scanning.

```ts
import { VARIABLE_NAME } from '@orochi-network/oh-util-prompt-template'

const name = 'model_small'
if (!VARIABLE_NAME.test(name)) throw new Error('malformed prompt variable name')
```

-----

<a id="understand-the-implementation"></a>
## Understand the implementation

<details>
<summary>Implementation internals — click to expand</summary>

The scanner is one left-to-right pass with a literal cursor: each token flushes the prose before it and advances the cursor past itself. A `{{` starts a malformed group only when a later `}}` marks the text as meant to be a reference; otherwise the braces stay ordinary prose, matching the renderer.

### Source map

| File | Role |
|---|---|
| [`src/index.ts`](src/index.ts) | The variable-name rule and the template scanner |
| — | No runtime invariant companion is published because the scanner is a pure function over caller-owned text with no shared state; unit tests cover its tiling and error forms. |

</details>

-----

<a id="further-exploration"></a>
## Further Exploration

- [Utility package map](../README.md) — adjacent stateless helpers.
- [oh-system-prompt](../../core/system-prompt/README.md) — the renderer that substitutes variables and rejects the malformed forms this scanner reports.
- [oh-client-ui-settings-system-prompt](../../client/ui-settings-system-prompt/README.md) — the settings editor that reports a draft's reference problems.

-----

<a id="model-experience"></a>
## Model Experience

None, as the package only scans template text into tokens; the system-prompt renderer owns substitution and every model-visible value.

#### KV Cache effect

None; this package neither assembles nor sends a provider request.

## Known Limitations and Deferred Work

<a id="known-limitations-and-deferred-work"></a>

- **The grammar accepts one reference form** — complete simple `{{name}}` groups. Nested braces, qualified names, and default-value syntax are out of scope and scan as literal prose or as malformed forms.
- **The scanner never resolves values** — substitution, unknown-name reporting, and rendering belong to the renderer.

<a id="dev-note"></a>
### Dev Note

<details>
<summary>Working context for maintainers — click to expand</summary>

None.

</details>
