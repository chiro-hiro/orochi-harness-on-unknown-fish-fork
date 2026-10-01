# Agent Note: Send unsigned history thinking as text through Messages

Status: implemented

English | [中文](2026-10-01-messages-unsigned-thinking-history.zh.md)

## Problem

A Messages request `thinking` block must present the signature that proves the thinking unmodified. The [Messages serializer](../../../../packages/llm/llm-orochi/src/serialize.ts) emitted `thinking` blocks without that signature whenever an assistant turn reached it with no usable replay metadata. A stopped turn always does: the terminal stream event carrying the thinking signatures never arrives, so the persisted prefix holds reasoning and no replay envelope. Every later request then carried a `thinking` block with no `signature` field, and a strict Anthropic-compatible endpoint rejected it as an invalid request (`INVALID_REQUEST`) on every turn after the stop. Cross-model history and degraded replay metadata reach the same state.

## Decision

A history `thinking` block travels only with a usable replay signature: a present, non-empty string, because a provider's empty signature states that the block was never signed. Reasoning that reaches serialization without one travels as assistant text, matching the pi-ai history conversion for signature-less thinking. Empty text blocks are omitted, and a turn left with no wire block is skipped, because a Messages turn requires non-empty content. Durable content is unchanged: the Session log keeps the reasoning and its replay metadata verbatim.

This corrects the signature degrade the [Messages adapter decision](../feature/2026-09-07-deepseek-messages-adapter.md) records: history without a usable signature no longer keeps the `thinking` block with its signature field omitted.

## Alternatives considered

**Keep the `thinking` block and omit its signature field.** The request protocol rejects the result, so every turn after a stop fails at the endpoint instead of continuing.

**Drop unsigned reasoning.** The model then loses the chain of thought the adapter otherwise passes back; assistant text keeps that context in the same request.

**Replay the empty signature.** Echoing `''` cannot make a block the provider never signed provable; endpoints that verify signatures reject it the same way they reject an absent field.

## Consequences

After a stop, the next request carries the partial reasoning as assistant text rather than hidden thinking, so the model reads its own earlier chain of thought as prior text. Signed thinking, including signature-only thinking, still travels verbatim; tool calls, tool results, and cache prefixes are unchanged. The pi-ai route already carried the same history's reasoning as text, so both adapters now send one model-visible form.

Verification covers stopped-turn history, cross-model and degraded replay metadata, and empty-block and empty-turn omission in the serializer unit tests; the [recorded Session replay](../../../../snapshots/session/orochi-messages-invalid-tool-history/snapshot.yml) whose history fixture refuses any request the protocol would reject, replaying assistant reasoning without replay state — the stopped-turn history shape; and the credential-gated live continuation that degrades unusable replay metadata.
