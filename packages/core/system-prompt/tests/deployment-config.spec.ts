/** The deployment-authored persona templates and their `{{name}}` variables. */
import { Context } from '@orochi-network/cordis'
import { expect, it, onTestFinished } from 'vitest'
import SystemPrompt, { renderPrompt } from '../src/index.ts'
import { liveConfig, omitsGeneratedPage } from '../../../settings/settings/tests/live-config.ts'

it('resolves deployment variables into the persona templates', async () => {
  const ctx = new Context()
  onTestFinished(() => ctx.fiber.dispose())
  await ctx.plugin(SystemPrompt, {
    includeHarnessIdentity: false,
    personaPrefix: 'Run in {{workspace}}.',
    personaSuffix: 'Models: {{small}} and {{large}}.',
    variables: { workspace: '/work', small: 'flash', large: 'pro' },
  })
  expect(renderPrompt(await ctx.systemPrompt.assemble())).toBe('Run in /work.\n\nModels: flash and pro.')
})

it('a registered provider keeps its name over a deployment entry', async () => {
  const ctx = new Context()
  onTestFinished(() => ctx.fiber.dispose())
  await ctx.plugin(SystemPrompt, {
    includeHarnessIdentity: false,
    personaPrefix: '{{model}}',
    variables: { model: 'config-model' },
  })
  ctx.systemPrompt.variable('model', () => 'live-model')
  expect(renderPrompt(await ctx.systemPrompt.assemble())).toBe('live-model')
})

it('a registered name without a value fails rendering instead of reading its deployment entry', async () => {
  const ctx = new Context()
  onTestFinished(() => ctx.fiber.dispose())
  await ctx.plugin(SystemPrompt, {
    includeHarnessIdentity: false,
    personaPrefix: '{{model}}',
    variables: { model: 'config-model' },
  })
  ctx.systemPrompt.variable('model', () => undefined)
  await expect(ctx.systemPrompt.assemble().then(renderPrompt)).rejects.toThrow('has no value')
})

it('rejects deployment variable names outside the {{name}} grammar at load', async () => {
  const ctx = new Context()
  onTestFinished(() => ctx.fiber.dispose())
  await expect(ctx.plugin(SystemPrompt, { variables: { 'Bad Name': 'x' } }))
    .rejects.toThrow('expect string to match regexp')
})

it('a settings edit reaches later assemblies without a remount', async () => {
  const ctx = new Context()
  onTestFinished(() => ctx.fiber.dispose())
  const live = await liveConfig(ctx, SystemPrompt, {
    includeHarnessIdentity: false,
    personaPrefix: 'one {{id}}',
    variables: { id: '1' },
  })
  expect(renderPrompt(await ctx.systemPrompt.assemble())).toBe('one 1')
  await live.update({ personaPrefix: 'two {{id}}', variables: { id: '2' } })
  expect(renderPrompt(await ctx.systemPrompt.assemble())).toBe('two 2')
})

it('keeps its fiber off generated settings pages while Settings is mounted', async () => {
  await omitsGeneratedPage(async ctx => await ctx.plugin(SystemPrompt, {}))
})
