import { describe, expect, it } from 'vitest'
import { scanPromptTemplate, VARIABLE_NAME, type PromptTemplateToken } from '../src/index.ts'

/** Rebuild the scanned text from its tokens, proving the tokens tile it exactly. */
function rebuild(tokens: readonly PromptTemplateToken[]): string {
  return tokens.map((token) => {
    if (token.kind === 'literal') return token.text
    if (token.kind === 'reference') return `{{${token.name}}}`
    if (token.kind === 'malformed-name') return token.text
    return '{{'
  }).join('')
}

describe('scanPromptTemplate', () => {
  it('returns no tokens for empty text and one literal for prose without references', () => {
    expect(scanPromptTemplate('')).toEqual([])
    expect(scanPromptTemplate('You are an agent.')).toEqual([{ kind: 'literal', text: 'You are an agent.' }])
  })

  it('separates prose, a reference, and trailing prose with exact positions', () => {
    expect(scanPromptTemplate('Model {{model}}.')).toEqual([
      { kind: 'literal', text: 'Model ' },
      { kind: 'reference', name: 'model', at: 6 },
      { kind: 'literal', text: '.' },
    ])
  })

  it('scans every reference in one pass, including at the text edges', () => {
    expect(scanPromptTemplate('{{cwd}} runs {{model}} on {{provider}}')).toEqual([
      { kind: 'reference', name: 'cwd', at: 0 },
      { kind: 'literal', text: ' runs ' },
      { kind: 'reference', name: 'model', at: 13 },
      { kind: 'literal', text: ' on ' },
      { kind: 'reference', name: 'provider', at: 26 },
    ])
    expect(scanPromptTemplate('{{a_1}}{{a2}}')).toEqual([
      { kind: 'reference', name: 'a_1', at: 0 },
      { kind: 'reference', name: 'a2', at: 7 },
    ])
    expect(scanPromptTemplate('tail}}')).toEqual([{ kind: 'literal', text: 'tail}}' }])
  })

  it('keeps a lone {{ and every brace pair with no closing }} as literal prose', () => {
    expect(scanPromptTemplate('Use {{ for prose')).toEqual([{ kind: 'literal', text: 'Use {{ for prose' }])
    expect(scanPromptTemplate('{{{{')).toEqual([{ kind: 'literal', text: '{{{{' }])
    expect(scanPromptTemplate('{{a}} {{')).toEqual([
      { kind: 'reference', name: 'a', at: 0 },
      { kind: 'literal', text: ' {{' },
    ])
    expect(scanPromptTemplate('x }} {{y')).toEqual([{ kind: 'literal', text: 'x }} {{y' }])
  })

  it('reports a {{ that starts no complete group while a later }} marks it as a reference', () => {
    expect(scanPromptTemplate('{{a{{b}}')).toEqual([
      { kind: 'malformed-group', at: 0 },
      { kind: 'literal', text: 'a' },
      { kind: 'reference', name: 'b', at: 3 },
    ])
    expect(scanPromptTemplate('{{{x}}}')).toEqual([
      { kind: 'malformed-group', at: 0 },
      { kind: 'literal', text: '{x}}}' },
    ])
    expect(scanPromptTemplate('{{a} }}')).toEqual([
      { kind: 'malformed-group', at: 0 },
      { kind: 'literal', text: 'a} }}' },
    ])
    expect(scanPromptTemplate('{{ a }} {{b}}')).toEqual([
      { kind: 'malformed-name', at: 0, text: '{{ a }}' },
      { kind: 'literal', text: ' ' },
      { kind: 'reference', name: 'b', at: 8 },
    ])
  })

  it('reports complete groups whose content is not a valid variable name', () => {
    expect(scanPromptTemplate('{{}}')).toEqual([{ kind: 'malformed-name', at: 0, text: '{{}}' }])
    expect(scanPromptTemplate('see {{na me}} here')).toEqual([
      { kind: 'literal', text: 'see ' },
      { kind: 'malformed-name', at: 4, text: '{{na me}}' },
      { kind: 'literal', text: ' here' },
    ])
    expect(scanPromptTemplate('{{1a}}{{Upper}}{{a-b}}{{_a}}').map(token => token.kind)).toEqual(
      ['malformed-name', 'malformed-name', 'malformed-name', 'malformed-name'],
    )
    expect(scanPromptTemplate('{{a\nb}}')).toEqual([{ kind: 'malformed-name', at: 0, text: '{{a\nb}}' }])
  })

  it('tiles mixed templates exactly', () => {
    for (const text of [
      'You run in {{cwd}} with {{model}}. Use {{ for prose; }} stays prose.',
      '{{a{{b}} {{}}{{na me}} tail {{',
      '{{{x}}}{{}}}} final',
    ]) {
      expect(rebuild(scanPromptTemplate(text))).toBe(text)
    }
  })
})

describe('VARIABLE_NAME', () => {
  it.each(['a', 'model', 'cwd', 'model_small', 'a1', 'a_1_b'])('accepts %s', (name) => {
    expect(VARIABLE_NAME.test(name)).toBe(true)
  })

  it.each(['', 'A', '1a', '_a', 'a-b', 'a b', 'a.b', '{{a}}'])('rejects %s', (name) => {
    expect(VARIABLE_NAME.test(name)).toBe(false)
  })
})
