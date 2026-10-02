/** Deterministic Messages image preparation for Files references and bounded inline fallback. */

import type { AttachmentStore, ImageAttachmentRef, RequestImageAttachment } from '@orochi-network/oh-attachment'
import { contentHasImage, IMAGE_OFFLOAD_REQUIRED_CODE, imageOccurrences, LlmError, offloadedImageText, projectOffloadedImages, requiredImageOffloadOccurrences } from '@orochi-network/oh-llm'
import type { ContentBlock, ImageAttachmentAccessResolver, ImageBlock, RequestMessage } from '@orochi-network/oh-llm'
import type { OrochiConnectionOptions as Connection } from './types.ts'
import { resolveRequestImageTarget } from './request-pricing.ts'
import type { OrochiFileId } from './file-id.ts'
import type { RequestFiles } from './request-files.ts'

export { orochiImageRequestPricing as imagePricing } from './request-pricing.ts'

function* imageRefs(blocks: readonly ContentBlock[]): Generator<ImageAttachmentRef> {
  for (const block of blocks) {
    if (block.type === 'image') yield block.attachment
  }
}

/** Normalize retained image references before converting Messages content.
 * @param history - durable history; never mutated.
 * @param connection - request-local image budgets.
 * @param modelId - target model id.
 * @param attachments - mounted attachment store, required only for image requests.
 * @param access - current execution-world path resolver.
 * @param signal - request cancellation.
 * @returns projected history and prepared image bytes keyed by attachment id.
 */
export async function prepareImages(
  history: readonly RequestMessage[], connection: Connection, modelId: string,
  attachments: AttachmentStore | undefined, access: ImageAttachmentAccessResolver, signal: AbortSignal,
): Promise<{ messages: readonly RequestMessage[]; versions: Map<ImageAttachmentRef['attachmentId'], RequestImageAttachment> }> {
  const versions = new Map<ImageAttachmentRef['attachmentId'], RequestImageAttachment>()
  const messages = projectOffloadedImages(history, ref => offloadedImageText(ref, access(ref)))
  if (!messages.some(message => contentHasImage(message.content))) return { messages, versions }
  const model = connection.models.find(entry => entry.id === modelId)
  if (model?.inputModalities?.includes('image') !== true || attachments === undefined) {
    throw new LlmError('Orochi Messages image input requires a vision model and attachment service', 'UNSUPPORTED_CONTENT')
  }
  if (messages.some(message => message.role !== 'user' && message.role !== 'tool' && contentHasImage(message.content))) {
    throw new LlmError('Orochi Messages supports images only in user messages and tool results', 'UNSUPPORTED_CONTENT')
  }
  for (const message of messages) {
    for (const ref of imageRefs(message.content)) {
      if (!versions.has(ref.attachmentId)) {
        versions.set(ref.attachmentId, await attachments.readImageRequest(ref, resolveRequestImageTarget(model, ref), signal))
      }
    }
  }
  assertImagesFit(messages, versions, connection, 'file-mode')
  return { messages, versions }
}

/** Require logged offload before retrying images that exceed the inline budget.
 * @param messages - history already within the Files budget.
 * @param versions - normalized versions prepared for retained references.
 * @param connection - resolved inline bounds.
 * @returns unchanged history within both byte and image-count limits.
 */
export function inlineImages(
  messages: readonly RequestMessage[], versions: ReadonlyMap<ImageAttachmentRef['attachmentId'], RequestImageAttachment>,
  connection: Connection,
): readonly RequestMessage[] {
  assertImagesFit(messages, versions, connection, 'inline-fallback')
  return messages
}

/** Count additional oldest occurrences requiring durable offload at their exact represented bytes.
 * A file-mode request keeps the oldest `maxRequestFileReferences` occurrences on
 * file references and sends the rest inline, so each bound removes its own
 * partition's oldest prefix while every occurrence counts toward the image-count
 * bound; the request fails with the largest count. A later attempt re-derives
 * the layout, so a window that slides into different bytes converges.
 */
function assertImagesFit(
  messages: readonly RequestMessage[], versions: ReadonlyMap<ImageAttachmentRef['attachmentId'], RequestImageAttachment>,
  connection: Connection, representation: 'file-mode' | 'inline-fallback',
): void {
  const occurrences = imageOccurrences(messages)
  const versionBytes = (block: ImageBlock) => (versions.get(block.attachment.attachmentId) as RequestImageAttachment).bytes
  const referenced = representation === 'file-mode' ? occurrences.slice(0, connection.maxRequestFileReferences) : []
  const inline = representation === 'file-mode' ? occurrences.slice(connection.maxRequestFileReferences) : occurrences
  const offloadImages = Math.max(
    requiredImageOffloadOccurrences(referenced, {
      representation: 'raw', maxBytes: connection.maxRequestFilesBytes, byteQuantum: connection.imageOffloadByteQuantum,
    }, versionBytes),
    requiredImageOffloadOccurrences(inline, {
      representation: 'base64', maxBytes: connection.maxInlineRequestImageBytes, byteQuantum: connection.inlineImageOffloadByteQuantum,
    }, versionBytes),
    requiredImageOffloadOccurrences(occurrences, {
      representation: 'raw', maxImages: connection.maxImagesPerRequest, countQuantum: connection.imageOffloadCountQuantum,
    }, versionBytes),
  )
  if (offloadImages > 0) {
    throw new LlmError(
      `Orochi Messages ${representation} request images exceed the route budget; ${offloadImages} more oldest occurrence(s) must be offloaded.`,
      IMAGE_OFFLOAD_REQUIRED_CODE,
      { offloadImages },
    )
  }
}

/** Resolve retained images inside the file-reference window to Files ids, recording every occurrence for failure diagnostics.
 * Occurrences past the window travel inline and are never uploaded.
 * @param messages - history within the Files byte/count budget.
 * @param versions - normalized versions for every retained reference.
 * @param files - request-owned Files resolution and recovery.
 * @param maxFileReferences - file references this request may carry.
 * @returns ids keyed by durable attachment identity.
 */
export async function prepareFileIds(
  messages: readonly RequestMessage[], versions: ReadonlyMap<ImageAttachmentRef['attachmentId'], RequestImageAttachment>,
  files: RequestFiles, maxFileReferences: number,
): Promise<Map<ImageAttachmentRef['attachmentId'], OrochiFileId>> {
  const ids = new Map<ImageAttachmentRef['attachmentId'], OrochiFileId>()
  let occurrence = 0
  for (const [index, message] of messages.entries()) {
    let image = 0
    for (const ref of imageRefs(message.content)) {
      const location = { message: index + 1, image: ++image }
      if (occurrence++ >= maxFileReferences) continue
      const version = versions.get(ref.attachmentId) as RequestImageAttachment
      ids.set(ref.attachmentId, await files.resolve(version, location))
    }
  }
  return ids
}
