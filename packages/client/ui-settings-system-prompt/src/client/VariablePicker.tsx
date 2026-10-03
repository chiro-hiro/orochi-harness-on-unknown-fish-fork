/** The variable picker beside the System Prompt editors: one click inserts a `{{name}}` reference at the caret. */

import { useId } from 'react'
import type { TranslateNS } from '@orochi-network/oh-client-ui-slots'
import { VARIABLE_NAME } from '@orochi-network/oh-util-prompt-template'
import type { VariableRow } from './system-prompt-editor-controller.ts'
import { HARNESS_VARIABLES } from './variable-catalog.ts'
import css from './VariablePicker.module.css'

/** What the variable picker renders. */
export interface VariablePickerProps {
  /** The page's locale reader. */
  t: TranslateNS<'settings.systemPrompt'>
  /** Custom variable rows under edit; the picker lists the rows with usable names. */
  rows: readonly VariableRow[]
  /** Disable every insert button while the form cannot stage edits. */
  disabled: boolean
  /** Insert one `{{name}}` reference at the editors' caret. */
  onInsert: (reference: string) => void
}

/**
 * Render the variable picker: the harness variables and the usable custom rows,
 * each one click away from the editors.
 * @param props - the page's copy, the custom rows, and the insert action.
 * @returns the picker sidebar.
 */
export function VariablePicker(props: VariablePickerProps) {
  const headingId = useId()
  const custom = props.rows.filter(row => VARIABLE_NAME.test(row.name))
  return (
    <aside className={css.picker} aria-labelledby={headingId}>
      <h3 className={css.heading} id={headingId}>{props.t('variablesTitle')}</h3>
      <p className={css.hint}>{props.t('paletteHint')}</p>
      <p className={css.group}>{props.t('harnessGroup')}</p>
      {HARNESS_VARIABLES.map(variable => (
        <button
          key={variable.name}
          type="button"
          className={css.row}
          disabled={props.disabled}
          onClick={() => { props.onInsert(`{{${variable.name}}}`) }}
        >
          <code className={css.name}>{`{{${variable.name}}}`}</code>
          <span className={css.description}>{props.t(variable.label)}</span>
        </button>
      ))}
      {custom.length > 0
        ? (
          <>
            <p className={css.group}>{props.t('customGroup')}</p>
            {custom.map((row, index) => (
              <button
                key={`${row.name}-${index}`}
                type="button"
                className={css.row}
                disabled={props.disabled}
                onClick={() => { props.onInsert(`{{${row.name}}}`) }}
              >
                <code className={css.name}>{`{{${row.name}}}`}</code>
                <span className={css.description}>{row.value}</span>
              </button>
            ))}
          </>
        )
        : null}
    </aside>
  )
}
