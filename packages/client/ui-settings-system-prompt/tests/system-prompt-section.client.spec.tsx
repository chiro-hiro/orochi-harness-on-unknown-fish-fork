// @vitest-environment jsdom
/** The System Prompt page as the settings shell renders it: editors, rows, and the picker. */
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { bindSnapshotSelector, makeTranslate } from '@orochi-network/oh-client-test-runtime'
import { createSnapshotStore } from '@orochi-network/oh-client-store'
import {
  SystemPromptSection,
  type SystemPromptSectionProps,
} from '../src/client/SystemPromptSection.tsx'
import type { SystemPromptEditorState } from '../src/client/system-prompt-editor-controller.ts'
import { en } from '../src/client/locales.ts'

afterEach(cleanup)

const t = makeTranslate(en)

/** The settled form shell every test starts from. */
function settled(overrides: Partial<SystemPromptEditorState> = {}): SystemPromptEditorState {
  return {
    available: true,
    writable: true,
    dirty: false,
    invalid: false,
    saving: false,
    failed: false,
    prefix: { text: 'abc', overridden: false, invalid: false },
    suffix: { text: '', overridden: false, invalid: false },
    rows: [],
    variablesOverridden: false,
    prefixIssues: [],
    suffixIssues: [],
    ...overrides,
  }
}

function renderSection(state: Partial<SystemPromptEditorState> = {}) {
  const store = createSnapshotStore<SystemPromptEditorState>(settled(state), { flush: 'sync' })
  const actions = {
    edit: vi.fn<(field: 'personaPrefix' | 'personaSuffix', text: string) => void>(),
    resetField: vi.fn<(field: 'personaPrefix' | 'personaSuffix') => void>(),
    addRow: vi.fn<() => void>(),
    editRow: vi.fn<(index: number, field: 'name' | 'value', text: string) => void>(),
    removeRow: vi.fn<(index: number) => void>(),
    resetVariables: vi.fn<() => void>(),
    save: vi.fn<() => void>(),
    discard: vi.fn<() => void>(),
  }
  const props = {
    ...actions,
    t,
    useSystemPromptEditor: bindSnapshotSelector(store),
  } as SystemPromptSectionProps
  render(<SystemPromptSection {...props} />)
  return { actions, store }
}

describe('SystemPromptSection', () => {
  it('renders both prompt editors as growing text areas with their hints', () => {
    renderSection()
    expect(screen.getByLabelText(en.prefixLabel).tagName).toBe('TEXTAREA')
    expect(screen.getByLabelText(en.suffixLabel).tagName).toBe('TEXTAREA')
    expect(screen.getByText(en.prefixHint)).toBeTruthy()
    expect(screen.getByText(en.suffixHint)).toBeTruthy()
    expect(screen.getByRole('heading', { name: en.promptTitle })).toBeTruthy()
    expect(screen.getByRole('heading', { name: en.customVariablesTitle })).toBeTruthy()
  })

  it('leads the field message with malformed references, then unknown ones', () => {
    renderSection({
      prefixIssues: [{ kind: 'malformed', text: '{{na me}}' }, { kind: 'unknown', text: '{{nope}}' }],
      suffixIssues: [{ kind: 'unknown', text: '{{nope}}' }],
    })
    expect(screen.getByText('These are not valid variable references: {{na me}}.')).toBeTruthy()
    expect(screen.getByText('These variables are not defined in this deployment: {{nope}}.')).toBeTruthy()
  })

  it('stages edits and resets from the field controls', () => {
    const { actions } = renderSection({
      prefix: { text: 'abc', overridden: true, invalid: false },
      suffix: { text: '', overridden: true, invalid: false },
    })

    fireEvent.change(screen.getByLabelText(en.prefixLabel), { target: { value: 'typed' } })
    expect(actions.edit).toHaveBeenCalledWith('personaPrefix', 'typed')
    fireEvent.change(screen.getByLabelText(en.suffixLabel), { target: { value: 'tail' } })
    expect(actions.edit).toHaveBeenCalledWith('personaSuffix', 'tail')

    const resets = screen.getAllByRole('button', { name: en.reset })
    fireEvent.click(resets[0]!)
    expect(actions.resetField).toHaveBeenCalledWith('personaPrefix')
    fireEvent.click(resets[1]!)
    expect(actions.resetField).toHaveBeenCalledWith('personaSuffix')
  })

  it('labels each row problem and keeps the row editable', () => {
    const { actions } = renderSection({
      rows: [
        { name: '', value: 'v0', problem: 'name' },
        { name: 'model', value: 'v1', problem: 'reserved' },
        { name: 'again', value: 'v2', problem: 'duplicate' },
      ],
    })

    expect(screen.getByText(en.rowNameInvalid)).toBeTruthy()
    expect(screen.getByText(en.rowNameReserved.replace('{name}', 'model'))).toBeTruthy()
    expect(screen.getByText(en.rowNameDuplicate)).toBeTruthy()

    const names = screen.getAllByLabelText(en.rowName)
    const values = screen.getAllByLabelText(en.rowValue)
    expect(names).toHaveLength(3)
    expect(names[0]!.getAttribute('aria-invalid')).toBe('true')
    fireEvent.change(names[1]!, { target: { value: 'renamed' } })
    expect(actions.editRow).toHaveBeenCalledWith(1, 'name', 'renamed')
    fireEvent.change(values[2]!, { target: { value: 'edited' } })
    expect(actions.editRow).toHaveBeenCalledWith(2, 'value', 'edited')

    const removes = screen.getAllByRole('button', { name: en.removeVariable })
    fireEvent.click(removes[1]!)
    expect(actions.removeRow).toHaveBeenCalledWith(1)
  })

  it('adds rows and warns about an unresolved save', () => {
    const { actions } = renderSection({ dirty: true, failed: true })

    fireEvent.click(screen.getByRole('button', { name: en.addVariable }))
    expect(actions.addRow).toHaveBeenCalledOnce()
    expect(screen.getByText(en.saveFailed)).toBeTruthy()
  })

  it('disables every control on a read-only document and while saving', () => {
    renderSection({ writable: false })
    expect(screen.getByLabelText(en.prefixLabel)).toHaveProperty('disabled', true)
    expect(screen.getByRole('button', { name: en.addVariable })).toHaveProperty('disabled', true)
    expect(screen.getByText('{{cwd}}').closest('button')).toHaveProperty('disabled', true)

    cleanup()
    renderSection({ saving: true })
    expect(screen.getByLabelText(en.suffixLabel)).toHaveProperty('disabled', true)
    expect(screen.getByRole('button', { name: en.addVariable })).toHaveProperty('disabled', true)
    expect(screen.getByText('{{cwd}}').closest('button')).toHaveProperty('disabled', true)
  })

  it('badges the overridden variable map and resets it to the composition layer', () => {
    const { actions } = renderSection({ variablesOverridden: true })

    expect(screen.getByText(en.overridden)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: en.reset }))
    expect(actions.resetVariables).toHaveBeenCalledOnce()
  })

  it('shows no variable-map override badge when the map is not overridden', () => {
    renderSection({ variablesOverridden: false })
    expect(screen.queryByText(en.overridden)).toBeNull()
    expect(screen.queryByRole('button', { name: en.reset })).toBeNull()
  })

  it('inserts a picked reference at the end of the prefix when no editor is active', () => {
    const { actions } = renderSection()

    fireEvent.click(screen.getByText('{{cwd}}').closest('button')!)
    expect(actions.edit).toHaveBeenCalledWith('personaPrefix', 'abc{{cwd}}')
  })

  it('inserts a picked reference over the selection of the focused editor', () => {
    const { actions } = renderSection({ suffix: { text: 'tail', overridden: false, invalid: false } })

    const prefix = screen.getByLabelText(en.prefixLabel) as HTMLTextAreaElement
    fireEvent.focus(prefix)
    prefix.setSelectionRange(1, 2)
    fireEvent.click(screen.getByText('{{model}}').closest('button')!)
    expect(actions.edit).toHaveBeenCalledWith('personaPrefix', 'a{{model}}c')

    const suffix = screen.getByLabelText(en.suffixLabel) as HTMLTextAreaElement
    fireEvent.focus(suffix)
    suffix.setSelectionRange(4, 4)
    fireEvent.click(screen.getByText('{{provider}}').closest('button')!)
    expect(actions.edit).toHaveBeenCalledWith('personaSuffix', 'tail{{provider}}')
  })

  it('inserts custom rows beside the harness variables', () => {
    const { actions } = renderSection({ rows: [{ name: 'tone', value: 'calm' }] })

    fireEvent.click(screen.getByText('{{tone}}').closest('button')!)
    expect(actions.edit).toHaveBeenCalledWith('personaPrefix', 'abc{{tone}}')
  })

  it('skips the caret restore when the editors unmount before it lands', () => {
    const { actions, store } = renderSection()
    actions.edit.mockImplementation(() => { store.set({ ...settled(), available: false }) })

    fireEvent.click(screen.getByText('{{cwd}}').closest('button')!)

    expect(screen.queryByLabelText(en.prefixLabel)).toBeNull()
  })
})
