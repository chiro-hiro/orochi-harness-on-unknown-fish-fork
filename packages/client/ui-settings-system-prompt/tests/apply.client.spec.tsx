// @vitest-environment jsdom
/** The System Prompt page's plugin mount: registration while served, the inject face, and disposal. */
import { describe, expect, it, onTestFinished } from 'vitest'
import { LocaleRuntime } from '@orochi-network/oh-client-locale/client'
import { resolveSlotLabel } from '@orochi-network/oh-client-ui-slots'
import {
  SlotTestRuntime, stubConfigForm, usePinnedBrowserLanguages,
} from '@orochi-network/oh-client-test-runtime'
import { apply, inject } from '../src/client/index.ts'
import { apply as applyHost } from '../src/index.ts'
import { SystemPromptSection } from '../src/client/SystemPromptSection.tsx'
import type { SystemPromptSettings } from '../src/client/system-prompt-editor-controller.ts'
import { en } from '../src/client/locales.ts'

usePinnedBrowserLanguages('en-US')

describe('ui-settings-system-prompt plugin', () => {
  it('owns no host-side behavior', () => {
    expect(() => { applyHost() }).not.toThrow()
  })

  it('registers its page while the Host serves the namespace and unregisters on disposal', async () => {
    const runtime = await SlotTestRuntime.create()
    onTestFinished(() => runtime.dispose())
    await runtime.root.declare({ 'settings.section': { kind: 'list', scope: 'root' } }, (_props: { renderSlot?: unknown }) => null)
    const locale = new LocaleRuntime(runtime.ctx)
    runtime.ctx.provide('locale', locale)
    runtime.slots.installLocale(locale)
    const host = stubConfigForm<SystemPromptSettings>()
    // The Host namespace state the page reads and writes; serving is immediate.
    runtime.ctx.provide('configForms', {
      get: () => host.scope,
      whileServed: (_names: readonly string[], run: () => unknown) => run(),
    } as never)

    const feature = await runtime.mount({ inject: [...inject], apply })

    const entries = runtime.slots.entries('settings.section')
    expect(entries).toHaveLength(1)
    const entry = entries[0]!
    expect(entry.options.id).toBe('system-prompt')
    expect(entry.options.order).toBe(25)
    expect(entry.locale).toBe('settings.systemPrompt')
    expect(entry.component).toBe(SystemPromptSection)
    expect(resolveSlotLabel(entry.options.label)).toBe(en.nav)

    const face = entry.inject!()
    expect(face['hooks']).toHaveProperty('systemPromptEditor')
    for (const action of ['edit', 'resetField', 'addRow', 'editRow', 'removeRow', 'resetVariables', 'save', 'discard']) {
      expect(face[action]).toBeTypeOf('function')
    }

    await feature.dispose()
    expect(runtime.slots.entries('settings.section')).toHaveLength(0)
  })
})
