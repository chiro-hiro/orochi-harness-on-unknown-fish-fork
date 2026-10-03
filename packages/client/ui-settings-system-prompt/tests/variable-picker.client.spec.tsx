// @vitest-environment jsdom
/** The variable picker beside the editors: harness rows, usable custom rows, one-click insert. */
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { makeTranslate } from '@orochi-network/oh-client-test-runtime'
import { VariablePicker } from '../src/client/VariablePicker.tsx'
import { en } from '../src/client/locales.ts'

afterEach(cleanup)

const t = makeTranslate(en)

describe('VariablePicker', () => {
  it('lists the harness variables with their descriptions', () => {
    const onInsert = vi.fn()
    render(<VariablePicker t={t} rows={[]} disabled={false} onInsert={onInsert} />)

    for (const name of ['cwd', 'model', 'provider']) {
      expect(screen.getByText(`{{${name}}}`)).toBeTruthy()
    }
    expect(screen.getByText(en['variable.cwd'])).toBeTruthy()
    expect(screen.getByRole('heading', { name: en.variablesTitle })).toBeTruthy()

    fireEvent.click(screen.getByText('{{model}}').closest('button')!)
    expect(onInsert).toHaveBeenCalledWith('{{model}}')
  })

  it('lists only custom rows with usable names and hides the group when none remain', () => {
    const onInsert = vi.fn()
    const { rerender } = render(
      <VariablePicker
        t={t}
        rows={[{ name: 'tone', value: 'calm' }, { name: 'Bad Name', value: 'x' }]}
        disabled={false}
        onInsert={onInsert}
      />,
    )

    expect(screen.getByText('{{tone}}')).toBeTruthy()
    expect(screen.queryByText('{{Bad Name}}')).toBeNull()
    expect(screen.getByText(en.customGroup)).toBeTruthy()
    fireEvent.click(screen.getByText('{{tone}}').closest('button')!)
    expect(onInsert).toHaveBeenCalledWith('{{tone}}')

    rerender(
      <VariablePicker t={t} rows={[{ name: 'Bad Name', value: 'x' }]} disabled={false} onInsert={onInsert} />,
    )
    expect(screen.queryByText(en.customGroup)).toBeNull()
  })

  it('disables every insert button while the form cannot stage edits', () => {
    const onInsert = vi.fn()
    render(<VariablePicker t={t} rows={[{ name: 'tone', value: 'calm' }]} disabled onInsert={onInsert} />)

    expect(screen.getByText('{{cwd}}').closest('button')).toHaveProperty('disabled', true)
    expect(screen.getByText('{{tone}}').closest('button')).toHaveProperty('disabled', true)
  })
})
