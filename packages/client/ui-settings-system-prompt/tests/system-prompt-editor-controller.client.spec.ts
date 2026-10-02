/** The System Prompt page's staged form: edits, row problems, and the fenced save. */
import { describe, expect, it, vi } from 'vitest'
import type { SettingsPathOpView } from '@orochi-network/oh-api-remotes/client'
import { stubConfigForm, type StubConfigForm } from '@orochi-network/oh-client-test-runtime'
import {
  SystemPromptEditorController,
  type SystemPromptEditorState,
  type SystemPromptSettings,
} from '../src/client/system-prompt-editor-controller.ts'

/** Make the stub behave like a Host that accepts every write and applies it. */
function acceptWrites(host: StubConfigForm<SystemPromptSettings>): void {
  const section = (): Record<string, unknown> => ({ ...host.scope.getSnapshot().value })
  const layer = (): Record<string, unknown> => ({ ...host.scope.getSnapshot().user as object })
  host.mutate.mockImplementation((ops: readonly SettingsPathOpView[]) => {
    const value = section()
    const user = layer()
    for (const op of ops) {
      const field = op.path[0]!
      if (op.op === 'set') {
        value[field] = op.value
        user[field] = op.value
      } else {
        Reflect.deleteProperty(user, field)
        Reflect.deleteProperty(value, field)
      }
    }
    host.publish({ value, user })
    return Promise.resolve(true)
  })
}

/** A Host serving the `system-prompt` namespace over a composition layer. */
function servedHost(): StubConfigForm<SystemPromptSettings> {
  const host = stubConfigForm<SystemPromptSettings>()
  acceptWrites(host)
  host.publish({
    status: 'ready',
    writable: true,
    revision: 3,
    value: { personaPrefix: 'stored', variables: { keep: '1' } },
    base: { personaPrefix: 'composed', variables: { keep: '0', extra: '2' } },
    user: { personaPrefix: 'stored', variables: { keep: '1' } },
  })
  return host
}

function readyState(controller: SystemPromptEditorController): SystemPromptEditorState {
  return controller.inject().hooks.systemPromptEditor.getSnapshot()
}

describe('SystemPromptEditorController', () => {
  it('shows nothing while the Host is still loading', () => {
    const host = stubConfigForm<SystemPromptSettings>()
    const controller = new SystemPromptEditorController(host.scope)

    expect(readyState(controller)).toMatchObject({
      available: false,
      writable: false,
      dirty: false,
      invalid: false,
      rows: [],
      variablesOverridden: false,
    })
    expect(readyState(controller).prefix).toEqual({ text: '', overridden: false, invalid: false })
    expect(readyState(controller).suffix).toEqual({ text: '', overridden: false, invalid: false })
    controller.dispose()
  })

  it('projects the stored layers and marks the user-layer entries', () => {
    const controller = new SystemPromptEditorController(servedHost().scope)
    const state = readyState(controller)

    expect(state.available).toBe(true)
    expect(state.writable).toBe(true)
    expect(state.prefix).toEqual({ text: 'stored', overridden: true, invalid: false })
    expect(state.suffix).toEqual({ text: '', overridden: false, invalid: false })
    expect(state.rows).toEqual([{ name: 'keep', value: '1' }])
    expect(state.variablesOverridden).toBe(true)
    controller.dispose()
  })

  it('re-projects on Host snapshot changes', () => {
    const host = servedHost()
    const controller = new SystemPromptEditorController(host.scope)
    const face = controller.inject()

    host.publish({ value: { personaPrefix: 'changed' }, user: {} })

    expect(face.hooks.systemPromptEditor.getSnapshot().prefix).toEqual({
      text: 'changed', overridden: false, invalid: false,
    })
    controller.dispose()
  })

  it('skips a staged prompt text equal to the stored value', () => {
    const host = servedHost()
    const controller = new SystemPromptEditorController(host.scope)
    const face = controller.inject()

    face.edit('personaPrefix', 'stored')
    face.edit('personaSuffix', '')

    expect(face.hooks.systemPromptEditor.getSnapshot().dirty).toBe(false)
    face.save()
    expect(host.mutate).not.toHaveBeenCalled()
    controller.dispose()
  })

  it('saves staged prompt edits fenced against the revision their drafts started from', async () => {
    const host = servedHost()
    const controller = new SystemPromptEditorController(host.scope)
    const face = controller.inject()

    face.edit('personaPrefix', 'edited')
    expect(face.hooks.systemPromptEditor.getSnapshot()).toMatchObject({
      dirty: true,
      invalid: false,
      prefix: { text: 'edited', overridden: true, invalid: false },
    })
    face.save()
    await vi.waitFor(() => {
      expect(face.hooks.systemPromptEditor.getSnapshot().dirty).toBe(false)
    })

    expect(host.mutate).toHaveBeenCalledWith(
      [{ op: 'set', path: ['personaPrefix'], value: 'edited' }],
      3,
    )
    controller.dispose()
  })

  it('clears an empty prompt draft back to the composition layer', async () => {
    const host = servedHost()
    const controller = new SystemPromptEditorController(host.scope)
    const face = controller.inject()

    face.edit('personaPrefix', '')
    face.save()
    await vi.waitFor(() => {
      expect(face.hooks.systemPromptEditor.getSnapshot().dirty).toBe(false)
    })

    expect(host.mutate).toHaveBeenCalledWith([{ op: 'unset', path: ['personaPrefix'] }], 3)
    controller.dispose()
  })

  it('restores a cleared field to its composition text', () => {
    const host = servedHost()
    const controller = new SystemPromptEditorController(host.scope)
    const face = controller.inject()

    face.resetField('personaPrefix')

    expect(face.hooks.systemPromptEditor.getSnapshot().prefix).toEqual({
      text: 'composed', overridden: false, invalid: false,
    })
    expect(face.hooks.systemPromptEditor.getSnapshot().dirty).toBe(true)
    controller.dispose()
  })

  it('stages nothing when a reset target has no user-layer entry', () => {
    const host = servedHost()
    const controller = new SystemPromptEditorController(host.scope)
    const face = controller.inject()

    face.resetField('personaSuffix')

    expect(face.hooks.systemPromptEditor.getSnapshot()).toMatchObject({ dirty: false })
    expect(face.hooks.systemPromptEditor.getSnapshot().suffix).toEqual({
      text: '', overridden: false, invalid: false,
    })
    controller.dispose()
  })

  it('blocks a save over a malformed reference and keeps the draft', async () => {
    const host = servedHost()
    const controller = new SystemPromptEditorController(host.scope)
    const face = controller.inject()

    face.edit('personaPrefix', 'see {{na me}}')
    face.save()

    expect(host.mutate).not.toHaveBeenCalled()
    const state = face.hooks.systemPromptEditor.getSnapshot()
    expect(state).toMatchObject({ dirty: true, invalid: true })
    expect(state.prefixIssues).toEqual([{ kind: 'malformed', text: '{{na me}}' }])
    controller.dispose()
  })

  it('warns about unknown references without blocking the save', async () => {
    const host = servedHost()
    const controller = new SystemPromptEditorController(host.scope)
    const face = controller.inject()

    face.edit('personaPrefix', 'hello {{nobody}} and {{keep}}')
    const state = face.hooks.systemPromptEditor.getSnapshot()
    expect(state.invalid).toBe(false)
    expect(state.prefixIssues).toEqual([{ kind: 'unknown', text: '{{nobody}}' }])

    face.save()
    await vi.waitFor(() => {
      expect(face.hooks.systemPromptEditor.getSnapshot().dirty).toBe(false)
    })
    controller.dispose()
  })

  it('composes the first row problem a name meets', () => {
    const host = stubConfigForm<SystemPromptSettings>()
    acceptWrites(host)
    host.publish({ status: 'ready', writable: true, revision: 1, value: {}, base: {}, user: {} })
    const controller = new SystemPromptEditorController(host.scope)
    const face = controller.inject()

    face.addRow()
    expect(face.hooks.systemPromptEditor.getSnapshot().rows).toEqual([
      { name: '', value: '', problem: 'name' },
    ])
    face.editRow(0, 'name', 'model')
    expect(face.hooks.systemPromptEditor.getSnapshot().rows[0]).toEqual({
      name: 'model', value: '', problem: 'reserved',
    })
    face.editRow(0, 'name', 'ok')
    face.editRow(0, 'value', 'v')
    expect(face.hooks.systemPromptEditor.getSnapshot().rows[0]).toEqual({ name: 'ok', value: 'v' })
    face.addRow()
    face.editRow(1, 'name', 'ok')
    expect(face.hooks.systemPromptEditor.getSnapshot().rows[1]).toEqual({
      name: 'ok', value: '', problem: 'duplicate',
    })
    face.removeRow(1)
    expect(face.hooks.systemPromptEditor.getSnapshot().rows).toEqual([{ name: 'ok', value: 'v' }])
    controller.dispose()
  })

  it('saves edited rows as one variable map', async () => {
    const host = servedHost()
    const controller = new SystemPromptEditorController(host.scope)
    const face = controller.inject()

    face.editRow(0, 'name', 'renamed')
    face.editRow(0, 'value', '2')
    expect(face.hooks.systemPromptEditor.getSnapshot()).toMatchObject({ dirty: true, invalid: false })

    face.save()
    await vi.waitFor(() => {
      expect(face.hooks.systemPromptEditor.getSnapshot().dirty).toBe(false)
    })
    expect(host.mutate).toHaveBeenCalledWith(
      [{ op: 'set', path: ['variables'], value: { renamed: '2' } }],
      3,
    )
    controller.dispose()
  })

  it('clears the variables entry when the last row is removed', async () => {
    const host = servedHost()
    const controller = new SystemPromptEditorController(host.scope)
    const face = controller.inject()

    face.removeRow(0)
    expect(face.hooks.systemPromptEditor.getSnapshot()).toMatchObject({
      dirty: true, invalid: false, rows: [], variablesOverridden: false,
    })

    face.save()
    await vi.waitFor(() => {
      expect(face.hooks.systemPromptEditor.getSnapshot().dirty).toBe(false)
    })
    expect(host.mutate).toHaveBeenCalledWith([{ op: 'unset', path: ['variables'] }], 3)
    controller.dispose()
  })

  it('restores the composition variables and previews the clear', async () => {
    const host = servedHost()
    const controller = new SystemPromptEditorController(host.scope)
    const face = controller.inject()

    face.resetVariables()
    const state = face.hooks.systemPromptEditor.getSnapshot()
    expect(state).toMatchObject({ dirty: true, variablesOverridden: false })
    expect(state.rows).toEqual([{ name: 'keep', value: '0' }, { name: 'extra', value: '2' }])

    face.save()
    await vi.waitFor(() => {
      expect(face.hooks.systemPromptEditor.getSnapshot().dirty).toBe(false)
    })
    expect(host.mutate).toHaveBeenCalledWith([{ op: 'unset', path: ['variables'] }], 3)
    controller.dispose()
  })

  it('stages nothing when a variables reset meets no user-layer entry', () => {
    const host = stubConfigForm<SystemPromptSettings>()
    acceptWrites(host)
    host.publish({
      status: 'ready', writable: true, revision: 1,
      value: { variables: { keep: '0' } }, base: { variables: { keep: '0' } }, user: {},
    })
    const controller = new SystemPromptEditorController(host.scope)
    const face = controller.inject()

    face.resetVariables()

    expect(face.hooks.systemPromptEditor.getSnapshot()).toMatchObject({ dirty: false, variablesOverridden: false })
    controller.dispose()
  })

  it('keeps a refused save staged and reports the failure', async () => {
    const host = servedHost()
    host.mutate.mockResolvedValueOnce(false)
    const controller = new SystemPromptEditorController(host.scope)
    const face = controller.inject()

    face.edit('personaPrefix', 'edited')
    face.save()
    await vi.waitFor(() => {
      expect(face.hooks.systemPromptEditor.getSnapshot().failed).toBe(true)
    })

    expect(face.hooks.systemPromptEditor.getSnapshot()).toMatchObject({ dirty: true, prefix: { text: 'edited' } })
    controller.dispose()
  })

  it('reports a rejected save as failed without dropping the draft', async () => {
    const host = servedHost()
    host.mutate.mockRejectedValueOnce(new Error('gateway/internal'))
    const controller = new SystemPromptEditorController(host.scope)
    const face = controller.inject()

    face.edit('personaPrefix', 'edited')
    face.save()
    await vi.waitFor(() => {
      expect(face.hooks.systemPromptEditor.getSnapshot().failed).toBe(true)
    })

    expect(face.hooks.systemPromptEditor.getSnapshot().dirty).toBe(true)
    controller.dispose()
  })

  it('refuses a save on a read-only document and one already crossing the wire', async () => {
    const host = servedHost()
    host.publish({ writable: false })
    const controller = new SystemPromptEditorController(host.scope)
    const face = controller.inject()

    face.edit('personaPrefix', 'edited')
    face.save()
    expect(host.mutate).not.toHaveBeenCalled()

    host.publish({ writable: true })
    let release!: () => void
    host.mutate.mockImplementationOnce(() => new Promise<boolean>((resolve) => {
      release = () => { resolve(true) }
    }))
    face.save()
    face.save()
    expect(host.mutate).toHaveBeenCalledOnce()
    release()
    await vi.waitFor(() => {
      expect(face.hooks.systemPromptEditor.getSnapshot().saving).toBe(false)
    })
    controller.dispose()
  })

  it('discards every staged edit and reports nothing when there is none', async () => {
    const host = servedHost()
    const controller = new SystemPromptEditorController(host.scope)
    const face = controller.inject()

    face.edit('personaPrefix', 'edited')
    face.addRow()
    face.discard()

    const state = face.hooks.systemPromptEditor.getSnapshot()
    expect(state).toMatchObject({ dirty: false, failed: false, rows: [{ name: 'keep', value: '1' }] })

    face.discard()
    face.save()
    expect(host.mutate).not.toHaveBeenCalled()
    controller.dispose()
  })

  it('discards a failed save marker', async () => {
    const host = servedHost()
    host.mutate.mockRejectedValueOnce(new Error('gateway/internal'))
    const controller = new SystemPromptEditorController(host.scope)
    const face = controller.inject()

    face.edit('personaPrefix', 'edited')
    face.save()
    await vi.waitFor(() => {
      expect(face.hooks.systemPromptEditor.getSnapshot().failed).toBe(true)
    })
    face.discard()
    expect(face.hooks.systemPromptEditor.getSnapshot().failed).toBe(false)
    controller.dispose()
  })

  it('drops rows that arrive as something other than a string map', () => {
    const host = stubConfigForm<SystemPromptSettings>()
    const controller = new SystemPromptEditorController(host.scope)
    const face = controller.inject()

    host.publish({
      status: 'ready', writable: true, revision: 1,
      value: {}, base: { variables: [1, 2] }, user: null,
    })
    face.resetVariables()
    expect(face.hooks.systemPromptEditor.getSnapshot().rows).toEqual([])

    host.publish({ base: { variables: 7 } })
    face.resetVariables()
    expect(face.hooks.systemPromptEditor.getSnapshot().rows).toEqual([])

    host.publish({ base: { variables: { a: 5 } } })
    face.resetVariables()
    expect(face.hooks.systemPromptEditor.getSnapshot().rows).toEqual([{ name: 'a', value: '' }])
    controller.dispose()
  })

  it('releases its Host subscription on disposal', () => {
    const host = servedHost()
    const controller = new SystemPromptEditorController(host.scope)
    expect(host.listenerCount()).toBe(1)
    controller.dispose()
    expect(host.listenerCount()).toBe(0)
  })
})
