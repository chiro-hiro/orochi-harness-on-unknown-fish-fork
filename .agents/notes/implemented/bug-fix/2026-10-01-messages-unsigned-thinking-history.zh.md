# Agent Note: 通过 Messages 将无签名的历史思考以文本发送

Status: implemented

[English](2026-10-01-messages-unsigned-thinking-history.md) | 中文

## 问题

Messages 请求中的 `thinking` 块必须携带证明思考未被篡改的签名。[Messages 序列化器](../../../../packages/llm/llm-orochi/src/serialize.ts)在 assistant 轮次缺少可用回放元数据时，仍会发出没有该签名的 `thinking` 块。被中止的轮次必然如此：携带思考签名的终止流事件从未到达，因此持久化的前缀只有推理内容而没有回放信封。之后的每个请求都会带上缺少 `signature` 字段的 `thinking` 块，严格的 Anthropic 兼容端点会将它判为非法请求（`INVALID_REQUEST`），中止后的每一轮都会失败。跨模型历史和降级的回放元数据会达到同样的状态。

## 决策

历史 `thinking` 块只在具备可用回放签名时发送：签名必须存在且非空，因为提供方的空签名表示该块从未被签名。轮次的推理整体降级——协议拒绝被部分丢弃或编辑的思考序列，因此任一块缺少签名时，该轮次的所有推理块都转为文本。降级后的推理以 assistant 文本发送，与 pi-ai 对无签名思考的历史转换一致。省略空文本块，并跳过不剩任何 wire 块的轮次，因为 Messages 轮次要求内容非空。持久内容不变：Session 日志原样保留推理及其回放元数据。

文本形式是降级后的工具轮次在默认 `thinking.type: adaptive` 下的开头内容：[Thinking 文档](https://platform.claude.com/docs/en/build-with-claude/thinking)指出，adaptive 模式不要求任何 assistant 轮次以思考块开头，而 extended（manual）模式要求最终 assistant 轮次必须如此开头。录制 Session 的历史夹具断言同一依赖，会拒绝最终 assistant 轮次不以思考块开头的 `thinking.type: enabled` 请求。

这修正了 [Messages 适配器决策](../feature/2026-09-07-deepseek-messages-adapter.zh.md)记录的签名降级规则：缺少可用签名的历史不再保留 `thinking` 块并省略其签名字段。

## 考虑过的替代方案

**保留 `thinking` 块并省略其签名字段。** 请求协议会拒绝这种结果，于是中止后的每一轮都在端点处失败，无法继续。

**丢弃无签名的推理。** 模型会丢失适配器本会传回的思维链；assistant 文本可以在同一请求中保留这部分上下文。仅在含工具调用的轮次中省略它并无收益：adaptive 思考不要求以思考块开头，因此 `tool_use` 之前是文本与没有文本同样可接受。

**回放空签名。** 回显 `''` 无法证明一个提供方从未签名的块；验证签名的端点会像拒绝缺失字段一样拒绝它。

## 后果

中止之后，下一个请求把部分推理作为 assistant 文本传回，而不是隐藏思考，模型会把自己先前的思维链读作已说出的文本。带签名的思考（包括仅有签名的思考）仍原样发送；工具调用、工具结果与缓存前缀不变。pi-ai 路由本来就把同一段历史的推理作为文本发送，两个适配器现在给出一致的模型可见形式。在强制 manual 模式开头规则的端点上配置 `thinkingType: enabled` 的部署仍可能被拒绝降级后的工具轮次：该轮次没有可回放的思考来开头，而编造一个正是签名规则禁止的。具有会话绑定思考签名的端点会把删除更早的块视为前缀变更，其对不可验证块的官方补救是移除该块。

验证覆盖序列化器单元测试中的中止轮次历史、跨模型与降级回放元数据，以及空块与空轮次省略；[录制 Session 回放](../../../../snapshots/session/orochi-messages-invalid-tool-history/snapshot.yml)的历史夹具会拒绝协议不允许的任何请求，回放不带回放元数据的 assistant 推理——即中止轮次的历史形态；以及降级不可用回放元数据的需凭据真实续接。
