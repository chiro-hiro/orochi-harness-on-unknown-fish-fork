# Agent Note: 单次 Messages 请求的文件引用窗口

Status: implemented

[English](2026-10-02-file-reference-window-per-request.md) | 中文

## 问题

Orochi Messages 端点拒绝携带超过 16 个文件引用的请求，返回 HTTP 400 与 `INVALID_REQUEST`：`Too many file references: 17 exceed the 16-reference limit per request.`。适配器把每个保留的请求图片都作为 Files API 引用发送，因此一个累积了 17 张工具结果图片的会话之后每个轮次都失败，且没有任何恢复路径生效。该限制按引用出现位置计数，而不是按去重后的文件计数：17 个指向同一个 file id 的块会被同样拒绝。

适配器中没有任何代码知道这个上界。`maxImagesPerRequest`（600）与 `maxRequestFilesBytes`（128 MiB）描述端点的图片容量，而[请求图片投影](2026-09-10-deepseek-v41-request-image-projection.zh.md)把每张图片限制在单边 4096 像素以内，因为那是提供方「对包含 15 张及以上图片的请求」的限制——请求确实会携带超过 16 张图片——而 Files 通路另有小得多的引用限制。

## 决策

`maxRequestFileReferences`（默认 16）是经过校验的 Config 上界，限制单次请求可携带的文件引用数。最旧的保留图片出现位置在该上界内保留文件引用，更晚的出现位置在 `maxInlineRequestImageBytes` 内以内联 base64 发送，因此一次请求可以混用 file id 与内联图片，重复出现的附件每个出现位置消耗一个引用，文件解析失败仍会把全部图片以内联方式重建整份请求。此前「一次请求绝不混用 file id 与内联图片」的保证由这条窗口规则取代。

file 模式请求由三个预算计量：被引用窗口的原始字节对 `maxRequestFilesBytes`，内联溢出的 base64 载荷对 `maxInlineRequestImageBytes`，全部出现位置对 `maxImagesPerRequest`。每个预算按各自配置的字节或数量量子移除自己分区的最旧前缀，一次请求以其中最大的移除量作为 `IMAGE_OFFLOAD_REQUIRED` 的数量。`oh-llm` 的 `requiredImageOffloadOccurrences` 计量一个有序出现位置列表；`requiredImageOffload` 保留 pi-ai 路由调用的单预算形式，两种均匀模式（全部引用、全部内联）产生的数量与引入窗口之前完全一致。

窗口遵循请求顺序，只在省略移除最旧出现位置时滑动，因此增长中的请求里每个出现位置保持同一种表示，提供方提示词缓存保持有效：新图片以内联追加，而不会翻转较旧的块。

## 备选方案

**出现位置超过上界后把整份请求改为内联。** 只需一次模式切换，不需要混用请求。但它丢弃了端点本可用引用接受的图片的 Files 通路，并在每次请求重发全部图片的 base64，直到 `maxInlineRequestImageBytes` 迫使省略；按 2 MiB 字节目标，17 张请求图片的编码结果超过 20 MiB 预算，这个最简单的修法会永久丢掉提供方愿意保留的图片。

**把最旧出现位置省略到上界以内。** 把该限制当作又一个路由预算、以 `IMAGE_OFFLOAD_REQUIRED` 失败符合既有恢复机制，但会在提供方仍以内联方式接受这些图片时把可见图片替换为占位符：跨 17 张截图的比较会悄悄丢掉一张。省略仍然是字节与数量溢出时的恢复手段。

**把文件引用分给最新的出现位置。** 内联出现位置的数量两种做法相同，但每个新图片都会把一个较旧的块从文件引用翻转为内联 base64，并从该消息起改写请求，每来一张新图片都使提供方提示词缓存失效。

**按去重后的附件计数。** 重复出现的附件会让每次重复都留在一个引用上，请求依旧会超出限制：端点按引用计数，17 个指向同一 file id 的块构成的请求已经证明了这一点。

## 后果

会话可以再次携带任意数量的图片，模型始终看到每张图片，直到某个字节或数量预算指明一次最旧前缀移除，由 [oh-compaction-image-offload](../../../../packages/compaction/compaction-image-offload/README.zh.md) 记录并重试。超出窗口的请求每次重发内联溢出的 base64（比请求携带的图片数少 `maxRequestFileReferences` 张），端点接受更多引用的部署可以调高 `maxRequestFileReferences`。

引用限制现在是部署设置，其默认值取自观测到的端点值。包 README 此前声称公共端点不提供 Anthropic Files API；失败会话与真实探测显示该根地址的 `/v1/files` 返回 `or_file_...` id，因此限制条目现在描述任意不提供 Files 的端点及其多付出的一次往返。

验证方式：`llm-orochi` 单元测试钉住混用序列化与每个分区的省略数量，其 mock 服务器测试钉住协议上的引用数与上传次数，带 key 的 `adapter.e2e.ts` 用例把 18 个图片出现位置走一遍真实路由并保持在引用限制内。`llm-replay` 不投影图片，无 key 的录制会话快照无法记录发出的请求字节，因此没有为此新增快照场景。
