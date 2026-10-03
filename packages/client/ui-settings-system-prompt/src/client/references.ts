/** The `{{name}}` reference problems one prompt draft can carry. */

import { scanPromptTemplate } from '@orochi-network/oh-util-prompt-template'

/** One `{{name}}` reference problem in a draft. */
export interface PromptReferenceIssue {
  /** The offending reference text as typed. */
  text: string
  /** `malformed` blocks saving; `unknown` only warns. */
  kind: 'malformed' | 'unknown'
}

/**
 * Collect the `{{name}}` reference problems in one draft: the groups the
 * renderer would reject at request time, and the references that no harness or
 * custom variable resolves in this deployment.
 * @param text - the draft text to scan.
 * @param known - the variable names that resolve.
 * @returns the problems in text order.
 */
export function referenceIssues(text: string, known: ReadonlySet<string>): PromptReferenceIssue[] {
  const issues: PromptReferenceIssue[] = []
  for (const token of scanPromptTemplate(text)) {
    if (token.kind === 'malformed-name') issues.push({ kind: 'malformed', text: token.text })
    else if (token.kind === 'malformed-group') issues.push({ kind: 'malformed', text: text.slice(token.at, token.at + 16) })
    else if (token.kind === 'reference' && !known.has(token.name)) issues.push({ kind: 'unknown', text: `{{${token.name}}}` })
  }
  return issues
}
