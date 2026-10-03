---
description: "The System Prompt settings section on the oh web client: the deployment persona templates and their custom {{name}} variables over the system-prompt namespace, with a picker that inserts references at the editors' caret."
kind: "package-reference"
---

# @orochi-network/oh-client-ui-settings-system-prompt

English | [中文](README.zh.md)

## Summary

Open **Settings** in the web client and select **System Prompt** to author the deployment persona text rendered before and after the first-party guidance, and the custom `{{name}}` variables the text may reference. Edits are staged: what is on screen is exactly what one save writes, fenced by the revision the drafts read, and a save the Host refuses keeps the drafts for correction. The page exists only while the Host serves the `system-prompt` namespace.

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

**Prompt text** holds **Prefix** and **Suffix** as growing text areas. A reference the renderer would reject — `{{}}`, `{{na me}}`, a lone `{{` with a later `}}` — blocks the save and is named under the field; a reference no variable resolves warns without blocking, because a deployment may register variables this page cannot see. Clearing a field returns it to the composition layer, and a user-layer entry is badged **Overridden** with its reset control.

**Custom variables** holds ordered name/value rows. A row saves only with a name matching `{{name}}` grammar that neither duplicates another row nor takes a harness-provided name (`cwd`, `model`, `provider`); each refusal is named under its row. Removing every row clears the stored map, and **Reset to default** returns the map to the composition layer.

The **Variables** picker lists the harness variables and the custom rows with usable names; one click inserts its `{{name}}` reference at the focused editor's caret, or at the end of the prefix when no editor is focused. One **Save** writes every staged edit in one revision-fenced mutation, and **Discard** drops all of them.

-----

<a id="understand-the-implementation"></a>
## Understand the implementation

<details>
<summary>Implementation internals — click to expand</summary>

The Host half is an empty `apply`, present only so the package holds a Loader row the client module system serves the browser half for. The browser half binds the namespace through `ctx.configForms.get('system-prompt')`; `SystemPromptEditorController` stages field drafts and variable rows over the shared `SettingsFormScope` of `ui-primitives`, composes each row's first save problem (grammar, harness name, duplicate), and plans one atomic `mutate` whose revision fence is the snapshot the first draft read. The reference scan comes from `oh-util-prompt-template`, the same grammar the Host renderer enforces. The page registers into the `settings.section` slot through `ctx.configForms.whileServed`, and the system-prompt registry keeps schema-generated settings pages off while this page owns the entry.

### Source map

| File | Role |
|---|---|
| [`src/index.ts`](src/index.ts) | Host plugin entry: the Loader row for the browser half |
| [`src/client/index.ts`](src/client/index.ts) | Browser plugin entry: locale, controller, and the `settings.section` registration |
| [`src/client/system-prompt-editor-controller.ts`](src/client/system-prompt-editor-controller.ts) | The staged form: drafts, row problems, reference issues, and the fenced save |
| [`src/client/SystemPromptSection.tsx`](src/client/SystemPromptSection.tsx) | The rendered page inside the shared `SettingsForm` |
| [`src/client/VariablePicker.tsx`](src/client/VariablePicker.tsx) | The reference picker beside the editors |
| [`src/client/references.ts`](src/client/references.ts) | Draft reference problems over the shared scanner |
| [`src/client/variable-catalog.ts`](src/client/variable-catalog.ts) | The harness variables the picker lists |
| [`src/client/locales.ts`](src/client/locales.ts) | The English and Simplified Chinese dictionaries and the form frame labels |
| — | No runtime invariant companion is published because the page stages and writes settings values while the system-prompt registry owns assembly; the tests pin the staged writes. |

</details>

-----

<a id="further-exploration"></a>
## Further Exploration

- [ui-settings](../ui-settings/README.md) — the settings scope and the served-namespace watch the page rides.
- [ui-primitives](../ui-primitives/README.md) — the settings form model and fields the editors render.
- [oh-system-prompt](../../core/system-prompt/README.md) — the registry that assembles the persona templates into every request's system prompt.
- [oh-util-prompt-template](../../util/prompt-template/README.md) — the `{{name}}` grammar the editors and the renderer share.

-----

<a id="model-experience"></a>
## Model Experience

Indirectly, through the system-prompt registry, which assembles the stored persona templates into the system prompt of every later request.

#### KV Cache effect

The persona prefix renders before the first-party guidance, so a template edit changes the request prefix and ends provider prompt-cache reuse until the edited text is stable across turns.

## Known Limitations and Deferred Work

<a id="known-limitations-and-deferred-work"></a>

- **The page edits three fields of the namespace** — `personaPrefix`, `personaSuffix`, and `variables`. `toolOrder` and the identity toggles stay composition-owned in `cordis.yml`.
- **Variable names registered by other plugins are reported as unknown** — the checker knows the three harness variables and the rows on screen, so a deployment registering its own prompt variables sees a warning on references to them even though the renderer resolves them at assembly.

<a id="dev-note"></a>
### Dev Note

<details>
<summary>Working context for maintainers — click to expand</summary>

None.

</details>
