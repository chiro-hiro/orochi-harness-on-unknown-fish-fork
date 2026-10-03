/**
 * The `{{name}}` prompt-template variable grammar shared by the Host
 * system-prompt renderer and the Client System Prompt editor: one variable-name
 * rule and one scan that tiles template text into prose, references, and the
 * malformed forms the renderer rejects. The renderer owns substitution and its
 * diagnostics; the editor owns presentation. This package never resolves
 * values.
 * @module @orochi-network/oh-util-prompt-template
 */

/** Valid variable names: how they are written between the braces. */
export const VARIABLE_NAME = /^[a-z][a-z0-9_]*$/

/** A complete `{{...}}` reference group at the scan position (validated after). */
const GROUP_AT = /^\{\{([^{}]*)\}\}/

/**
 * One piece of a scanned prompt template. The tokens of one scan tile the
 * template text exactly, in order: each carries its own extent with no gap or
 * overlap, so a consumer can rebuild the text verbatim.
 */
export type PromptTemplateToken =
  /** Ordinary prose, including a lone `{{` that no later `}}` completes. Carries its text verbatim. */
  | { readonly kind: 'literal'; readonly text: string }
  /**
   * A complete `{{name}}` group whose name satisfies {@link VARIABLE_NAME}.
   * `at` is the opening brace's index; the group occupies `name.length + 4`
   * characters.
   */
  | { readonly kind: 'reference'; readonly name: string; readonly at: number }
  /**
   * A complete `{{…}}` group whose content is not a valid variable name —
   * `{{}}`, `{{na me}}`, `{{1a}}` and similar. `text` is the whole group.
   */
  | { readonly kind: 'malformed-name'; readonly at: number; readonly text: string }
  /**
   * A `{{` that starts no complete group while a later `}}` marks the text as
   * meant as a reference. The token's extent is the two opening braces;
   * whatever follows is ordinary prose.
   */
  | { readonly kind: 'malformed-group'; readonly at: number }

/**
 * Scan a prompt template into prose, `{{name}}` references, and the two
 * malformed forms the renderer rejects. Scanning continues past every malformed
 * form, so one pass reports all of them. A lone `{{` without any later `}}` is
 * literal prose, matching the renderer.
 * @param text - the template text to scan.
 * @returns the tokens that tile `text` in text order.
 */
export function scanPromptTemplate(text: string): PromptTemplateToken[] {
  const tokens: PromptTemplateToken[] = []
  let literal = 0
  let scan = 0
  const flush = (end: number): void => {
    if (end > literal) tokens.push({ kind: 'literal', text: text.slice(literal, end) })
    literal = end
  }
  for (let open = text.indexOf('{{', scan); open >= 0; open = text.indexOf('{{', scan)) {
    const group = GROUP_AT.exec(text.slice(open))
    if (group === null) {
      if (text.indexOf('}}', open + 2) >= 0) {
        flush(open)
        tokens.push({ kind: 'malformed-group', at: open })
        literal = open + 2
        scan = open + 2
      } else {
        scan = open + 2
      }
      continue
    }
    flush(open)
    const name = group[0].slice(2, -2)
    tokens.push(VARIABLE_NAME.test(name)
      ? { kind: 'reference', name, at: open }
      : { kind: 'malformed-name', at: open, text: group[0] })
    literal = open + group[0].length
    scan = literal
  }
  flush(text.length)
  return tokens
}
