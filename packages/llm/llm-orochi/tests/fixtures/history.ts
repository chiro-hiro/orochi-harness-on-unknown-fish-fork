/** Exercise Messages request conversion with recorded responses from another protocol. */
import assert from 'node:assert/strict'
import type { Context } from '@orochi-network/cordis'
import { resolveAdapterOptions } from '../../src/config.ts'
import { serialize } from '../../src/serialize.ts'
import type { WireRequest } from '../../src/wire-types.ts'

export const name = 'messages-history-snapshot'
export const inject = ['llm']

/** One serialized content block read as the wire fields this gate checks. */
interface CheckedBlock {
  type: string
  text?: string
  signature?: string
}

/** One serialized turn read as the wire fields this gate checks. */
interface CheckedTurn {
  role: string
  content: CheckedBlock[]
}

/**
 * Refuse the request forms this serializer's degrade must never emit: a
 * `thinking` block without its proof signature, an empty text block, a turn
 * left with no content, and — under manual-style `thinking.type: enabled`,
 * whose contract makes the final assistant turn begin with a thinking block —
 * a final assistant turn leading with something else. The degrade relies on
 * the request's `thinking.type: adaptive` contract, under which no assistant
 * turn needs such a lead, which is what lets a degraded tool turn carry text.
 * @param request - the serialized Messages body for one model call.
 */
function assertWireRequest(request: WireRequest): void {
  const turns = JSON.parse(JSON.stringify(request.messages)) as CheckedTurn[]
  assert.ok(turns.every(turn => turn.content.length > 0), `${name}: Messages turn has no content`)
  const blocks = turns.flatMap(turn => turn.content)
  assert.ok(blocks.every(block => block.type !== 'text' || (block.text ?? '').length > 0), `${name}: Messages text block is empty`)
  assert.ok(
    blocks.every(block => block.type !== 'thinking' || (block.signature ?? '').trim().length > 0),
    `${name}: Messages thinking block has no usable signature`,
  )
  const finalAssistant = turns.filter(turn => turn.role === 'assistant').at(-1)
  assert.ok(
    request.thinking.type !== 'enabled' || finalAssistant === undefined || finalAssistant.content[0]?.type === 'thinking',
    `${name}: manual thinking requires the final assistant turn to begin with a thinking block`,
  )
}

export function apply(ctx: Context): void {
  const connection = resolveAdapterOptions({})
  ctx.on('llm/stream', (options, next) => {
    assertWireRequest(serialize(options, connection, options.messages, new Map(), () => undefined))
    return next()
  })
}
