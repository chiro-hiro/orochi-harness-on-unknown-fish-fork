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

/**
 * Refuse the request forms the Messages protocol rejects, which an endpoint
 * answers with `INVALID_REQUEST`: a `thinking` block without its proof
 * signature, an empty text block, and a turn left with no content.
 * @param request - the serialized Messages body for one model call.
 */
function assertWireRequest(request: WireRequest): void {
  const turns = JSON.parse(JSON.stringify(request.messages)) as { content: CheckedBlock[] }[]
  assert.ok(turns.every(turn => turn.content.length > 0), `${name}: Messages turn has no content`)
  const blocks = turns.flatMap(turn => turn.content)
  assert.ok(blocks.every(block => block.type !== 'text' || (block.text ?? '').length > 0), `${name}: Messages text block is empty`)
  assert.ok(
    blocks.every(block => block.type !== 'thinking' || (block.signature ?? '').trim().length > 0),
    `${name}: Messages thinking block has no usable signature`,
  )
}

export function apply(ctx: Context): void {
  const connection = resolveAdapterOptions({})
  ctx.on('llm/stream', (options, next) => {
    assertWireRequest(serialize(options, connection, options.messages, new Map(), () => undefined))
    return next()
  })
}
