/** The picker's harness rows track the names the harness actually registers. */
import { AGENT_LOOP_PROMPT_VARIABLES } from '@orochi-network/oh-agent-loop'
import { describe, expect, it } from 'vitest'
import { HARNESS_VARIABLES } from '../src/client/variable-catalog.ts'

describe('HARNESS_VARIABLES', () => {
  it('lists exactly the prompt variables the agent loop registers', () => {
    expect([...HARNESS_VARIABLES.map(variable => variable.name)].sort())
      .toEqual([...AGENT_LOOP_PROMPT_VARIABLES].sort())
  })

  it('gives every listed variable its own description key', () => {
    expect(new Set(HARNESS_VARIABLES.map(variable => variable.label)).size).toBe(HARNESS_VARIABLES.length)
    for (const variable of HARNESS_VARIABLES) expect(variable.label).toMatch(/^variable\./)
  })
})
