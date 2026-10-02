/**
 * The System Prompt settings page, browser half: the deployment persona
 * templates and their custom `{{name}}` variables over the `system-prompt`
 * namespace the registry serves, with a picker that inserts references at the
 * editors' caret. The page registers into the settings shell's
 * `settings.section` while the Host serves that namespace, so a deployment
 * without the registry shows no trace of it.
 */

// Type-only: pulls the locale plugin's Context merge (ctx.locale).
import type {} from '@orochi-network/oh-client-locale/client'
// Type-only: the ctx.configForms Context merge and the settings shell's
// SlotMap merge (the 'settings.section' entry). Cross-plugin collaboration
// goes through the service, never a value import (client bundle purity gate).
import type {} from '@orochi-network/oh-client-ui-settings/client'
import type {} from '@orochi-network/oh-client-ui-renderer/client'
import type { Context as ClientContext } from '@orochi-network/cordis'
import { SystemPromptSection } from './SystemPromptSection.tsx'
import { SystemPromptEditorController } from './system-prompt-editor-controller.ts'
import { en, zh, type SystemPromptSettingsKey } from './locales.ts'

declare module '@orochi-network/oh-client-ui-slots' {
  interface LocaleNamespaceMap {
    /** System Prompt settings page copy. */
    'settings.systemPrompt': SystemPromptSettingsKey
  }
}

export type { SystemPromptSectionProps } from './SystemPromptSection.tsx'
export type { PromptReferenceIssue } from './references.ts'
export type {
  PromptField, SystemPromptEditorFace, SystemPromptEditorState, SystemPromptSettings, VariableRow, VariableRowProblem,
} from './system-prompt-editor-controller.ts'

/** Dictionary namespace owned by this plugin. */
const NS = 'settings.systemPrompt'

/**
 * Namespace of the system prompt's user-owned settings. Spelled here rather
 * than imported: a client package must not depend on a Host package.
 */
const SYSTEM_PROMPT_NS = 'system-prompt'

/** Required services (cordis fiber inject). */
export const inject = ['slots', 'locale', 'configForms']

/**
 * Mount the System Prompt settings page while the Host serves its namespace.
 * @param ctx - the browser plugin context.
 */
export function apply(ctx: ClientContext): void {
  const t = ctx.locale.bind(NS)
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'ui-settings-system-prompt: dictionaries')
  const editor = new SystemPromptEditorController(ctx.configForms.get(SYSTEM_PROMPT_NS))
  ctx.effect(() => () => { editor.dispose() }, 'ui-settings-system-prompt: form subscription')
  ctx.effect(() => ctx.configForms.whileServed([SYSTEM_PROMPT_NS], () => ctx.slots.inject('settings.section', () => ctx.slots.register({
    name: 'settings.section',
    id: 'system-prompt',
    order: 25,
    label: () => t('nav'),
    locale: NS,
    inject: () => editor.inject(),
  }, SystemPromptSection))), 'ui-settings-system-prompt: page')
}
