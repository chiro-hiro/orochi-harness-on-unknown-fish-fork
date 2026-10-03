/** The reference problems the System Prompt editors report for one draft. */
import { describe, expect, it } from 'vitest'
import { referenceIssues } from '../src/client/references.ts'

describe('referenceIssues', () => {
  it('returns no issues for prose without references', () => {
    expect(referenceIssues('You are an agent. Run in {{cwd}}.', new Set(['cwd']))).toEqual([])
  })

  it('reports the groups the renderer would reject at request time', () => {
    expect(referenceIssues('see {{na me}} and {{{x}}}', new Set())).toEqual([
      { kind: 'malformed', text: '{{na me}}' },
      { kind: 'malformed', text: '{{{x}}}' },
    ])
  })

  it('reports references that no variable resolves, naming them as typed', () => {
    expect(referenceIssues('{{model}} needs {{model_small}} and {{model}}.', new Set(['model']))).toEqual([
      { kind: 'unknown', text: '{{model_small}}' },
    ])
  })
})
