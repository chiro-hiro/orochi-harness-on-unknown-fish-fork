/** The harness-provided `{{name}}` variables the picker lists. */

import type { SystemPromptSettingsKey } from './locales.ts'

/** One harness prompt variable as the picker lists it. */
export interface HarnessVariable {
  /** The reference name between the braces. */
  name: string
  /** The dictionary key of its one-line description. */
  label: Extract<SystemPromptSettingsKey, `variable.${string}`>
}

/**
 * The `{{name}}` prompt variables the harness resolves for every session,
 * registered by the agent loop's driver. The picker lists exactly these names
 * alongside the deployment's custom variables.
 */
export const HARNESS_VARIABLES: readonly HarnessVariable[] = [
  { name: 'cwd', label: 'variable.cwd' },
  { name: 'model', label: 'variable.model' },
  { name: 'provider', label: 'variable.provider' },
]
