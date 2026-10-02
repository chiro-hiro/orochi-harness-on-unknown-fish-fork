# Agent Note: File-reference window per Messages request

Status: implemented

English | [中文](2026-10-02-file-reference-window-per-request.zh.md)

## Problem

The Orochi Messages endpoint rejects a request carrying more than 16 file references with HTTP 400 and `INVALID_REQUEST`: `Too many file references: 17 exceed the 16-reference limit per request.` The adapter sent every retained request image as a Files API reference, so one session that accumulated 17 tool-result images failed every later turn and no recovery applied. The limit counts reference occurrences rather than distinct files: 17 blocks referencing one file id are rejected the same way.

Nothing in the adapter knew the bound. `maxImagesPerRequest` (600) and `maxRequestFilesBytes` (128 MiB) describe the endpoint's image capacity, and the [request-image projection](2026-09-10-deepseek-v41-request-image-projection.md) caps every image at 4096 pixels per side because that is the provider limit "for requests carrying 15 or more images" — requests do carry more than 16 images — while the Files path has its own, much smaller reference limit.

## Decision

`maxRequestFileReferences` (default 16) is the validated Config bound on the file references one request may carry. The oldest retained image occurrences keep file references up to that bound and later occurrences travel as inline base64 within `maxInlineRequestImageBytes`, so one request can mix file ids and inline images, a repeated attachment spends one reference per occurrence, and a Files resolution failure still rebuilds the whole request with every image inline. The previous "one request never mixes file ids and inline images" guarantee is replaced by this window rule.

Three budgets account one file-mode request: the referenced window's raw bytes against `maxRequestFilesBytes`, the inline overflow's base64 payload against `maxInlineRequestImageBytes`, and every occurrence against `maxImagesPerRequest`. Each bound removes its own partition's oldest prefix in its configured byte or count quantum, and the request reports the largest removal as its `IMAGE_OFFLOAD_REQUIRED` count. `requiredImageOffloadOccurrences` in `oh-llm` accounts one ordered occurrence list; `requiredImageOffload` keeps the single-budget form the pi-ai route calls, and both uniform modes (all-referenced, all-inline) produce the counts they produced before the window existed.

The window follows request order and slides only when an offload removes oldest occurrences, so a growing request keeps one representation per occurrence and provider prompt cache stays valid: a new image appends as inline instead of flipping an older block.

## Alternatives considered

**Send the whole request inline once occurrences exceed the bound.** One mode switch, no mixed requests. It drops the Files path for images the endpoint accepts as references and re-sends every image's base64 on every request until `maxInlineRequestImageBytes` forces offload; 17 request images at the 2 MiB byte target encode past that 20 MiB budget, so the simplest fix would permanently drop images the provider was willing to keep.

**Offload the oldest occurrences down to the bound.** Treating the limit as another route budget and failing with `IMAGE_OFFLOAD_REQUIRED` fits the existing recovery, but it replaces visible images with placeholders while the provider still accepts them inline: a comparison across 17 screenshots would silently lose one. Offload stays the recovery for byte and count overflow only.

**Give the file references to the newest occurrences.** The inline occurrence count is the same either way, but every new image would flip one older block from a file reference to inline base64 and rewrite the request from that message onward, invalidating provider prompt cache on each new image.

**Count distinct attachments instead of occurrences.** A repeated attachment would then keep every repeat on one reference and the request would still exceed the limit: the endpoint counts references, proven by a request with 17 blocks naming one file id.

## Consequences

A session carries any number of images again, and the model keeps each one visible until a byte or count budget names an oldest-prefix removal that [oh-compaction-image-offload](../../../../packages/compaction/compaction-image-offload/README.md) records and retries. Requests past the window re-send the inline overflow's base64 on every request (`maxRequestFileReferences` fewer images than the request carries), and a deployment whose endpoint accepts more references raises `maxRequestFileReferences`.

The reference limit is now a deployment setting with the observed endpoint value as its default. The package README previously stated that the public endpoint serves no Anthropic Files API; the failing session and a live probe show `/v1/files` serving `or_file_...` ids on that root, so the limitation now names any Files-less endpoint and the wasted round trip it costs.

Verification: `llm-orochi` unit tests pin the mixed serialization and each partition's offload count, its mock-server tests pin the wire counts and uploads, and the with-key `adapter.e2e.ts` case sends 18 image occurrences through the live route and stays inside the reference limit. `llm-replay` does not project images, so keyless recorded-session snapshots cannot show the sent request bytes and no new scenario records this path.