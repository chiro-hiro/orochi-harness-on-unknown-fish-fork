/** The System Prompt settings page: the persona templates, the custom variable rows, and the variable picker. */

import { useEffect, useId, useRef, useState } from 'react'
import { Button, IconPlusOutlineRegular, IconTrashOutlineRegular, SettingsForm, SettingsValueField, Tag, Tooltip } from '@orochi-network/oh-client-ui-primitives'
// Type-only: the settings shell's SlotMap merge (the 'settings.section' entry).
import type {} from '@orochi-network/oh-client-ui-settings/client'
import type { InjectFace, PropsLocale, PropsRuntime, TranslateNS } from '@orochi-network/oh-client-ui-slots'
import type { PromptReferenceIssue } from './references.ts'
import type {
  PromptField, SystemPromptEditorFace, VariableRowProblem,
} from './system-prompt-editor-controller.ts'
import { formLabels } from './locales.ts'
import { VariablePicker } from './VariablePicker.tsx'
import css from './SystemPromptSection.module.css'

/** Props assembled by the settings renderer. */
export type SystemPromptSectionProps =
  PropsRuntime<'settings.section'>
  & PropsLocale<'settings.systemPrompt'>
  & InjectFace<SystemPromptEditorFace>

/** The dictionary key of each row problem's explanation. */
const ROW_PROBLEM_KEYS = {
  name: 'rowNameInvalid',
  duplicate: 'rowNameDuplicate',
  reserved: 'rowNameReserved',
} as const satisfies Record<VariableRowProblem, string>

/** The message one field shows under its control. */
function fieldMessage(
  t: TranslateNS<'settings.systemPrompt'>,
  issues: readonly PromptReferenceIssue[],
  hint: string,
): string {
  const malformed = issues.filter(issue => issue.kind === 'malformed').map(issue => issue.text)
  if (malformed.length > 0) return t('invalidReferences', { refs: malformed.join(', ') })
  const unknown = issues.filter(issue => issue.kind === 'unknown').map(issue => issue.text)
  return unknown.length > 0 ? t('unknownReferences', { refs: unknown.join(', ') }) : hint
}

/**
 * Render the System Prompt page with one save for every staged edit.
 * @param props - locale copy, the form snapshot, and the staged write actions.
 * @returns the settings form with its editors and the variable picker.
 */
export function SystemPromptSection(props: SystemPromptSectionProps) {
  const { t } = props
  const state = props.useSystemPromptEditor(snapshot => snapshot)
  const headingId = useId()
  const prefixRef = useRef<HTMLTextAreaElement>(null)
  const suffixRef = useRef<HTMLTextAreaElement>(null)
  const activeField = useRef<PromptField | null>(null)
  const [caret, setCaret] = useState<{ field: PromptField; at: number } | null>(null)
  // The controlled value arrives with the staged text, so the caret returns
  // only after that render lands.
  useEffect(() => {
    if (caret === null) return
    const control = caret.field === 'personaPrefix' ? prefixRef.current : suffixRef.current
    if (control === null) return
    control.focus()
    control.setSelectionRange(caret.at, caret.at)
    setCaret(null)
  }, [caret])
  const insert = (reference: string) => {
    const field = activeField.current ?? 'personaPrefix'
    const control = activeField.current === null
      ? null
      : field === 'personaPrefix' ? prefixRef.current : suffixRef.current
    const text = field === 'personaPrefix' ? state.prefix.text : state.suffix.text
    const start = control?.selectionStart ?? text.length
    const end = control?.selectionEnd ?? text.length
    props.edit(field, text.slice(0, start) + reference + text.slice(end))
    setCaret({ field, at: start + reference.length })
  }
  const disabled = !state.writable || state.saving
  return (
    <SettingsForm labels={formLabels(t)} state={state} onSave={props.save} onDiscard={props.discard}>
      <div className={css.layout}>
        <div className={css.main}>
          <section className={css.section} aria-labelledby={`${headingId}-prompt`}>
            <h3 className={css.heading} id={`${headingId}-prompt`}>{t('promptTitle')}</h3>
            <div onFocus={() => { activeField.current = 'personaPrefix' }}>
              <SettingsValueField
                id="system-prompt-prefix"
                multiline
                textRef={prefixRef}
                label={t('prefixLabel')}
                hint={fieldMessage(t, state.prefixIssues, t('prefixHint'))}
                invalidLabel={fieldMessage(t, state.prefixIssues, t('prefixHint'))}
                overriddenLabel={t('overridden')}
                resetLabel={t('reset')}
                disabled={disabled}
                {...state.prefix}
                onEdit={(text) => { props.edit('personaPrefix', text) }}
                onReset={() => { props.resetField('personaPrefix') }}
              />
            </div>
            <div onFocus={() => { activeField.current = 'personaSuffix' }}>
              <SettingsValueField
                id="system-prompt-suffix"
                multiline
                textRef={suffixRef}
                label={t('suffixLabel')}
                hint={fieldMessage(t, state.suffixIssues, t('suffixHint'))}
                invalidLabel={fieldMessage(t, state.suffixIssues, t('suffixHint'))}
                overriddenLabel={t('overridden')}
                resetLabel={t('reset')}
                disabled={disabled}
                {...state.suffix}
                onEdit={(text) => { props.edit('personaSuffix', text) }}
                onReset={() => { props.resetField('personaSuffix') }}
              />
            </div>
          </section>
          <section className={css.section} aria-labelledby={`${headingId}-variables`}>
            <h3 className={css.heading} id={`${headingId}-variables`}>{t('customVariablesTitle')}</h3>
            <p className={css.hint}>{t('customVariablesHint')}</p>
            {state.variablesOverridden
              ? (
                <div className={css.badges}>
                  <Tag tone="neutral">{t('overridden')}</Tag>
                  <button
                    type="button"
                    className={css.reset}
                    disabled={disabled}
                    onClick={props.resetVariables}
                  >
                    {t('reset')}
                  </button>
                </div>
              )
              : null}
            {state.rows.map((row, index) => {
              const problemId = `${headingId}-row-${index}`
              return (
                <div className={css.row} key={index}>
                  <input
                    className={css.rowInput}
                    value={row.name}
                    disabled={disabled}
                    aria-label={t('rowName')}
                    {...row.problem === undefined ? {} : { 'aria-invalid': true, 'aria-describedby': problemId }}
                    onChange={(event) => { props.editRow(index, 'name', event.target.value) }}
                  />
                  <input
                    className={css.rowInput}
                    value={row.value}
                    disabled={disabled}
                    aria-label={t('rowValue')}
                    onChange={(event) => { props.editRow(index, 'value', event.target.value) }}
                  />
                  <Tooltip label={t('removeVariable')}>
                    <button
                      type="button"
                      className={css.remove}
                      aria-label={t('removeVariable')}
                      disabled={disabled}
                      onClick={() => { props.removeRow(index) }}
                    >
                      <IconTrashOutlineRegular size={14} />
                    </button>
                  </Tooltip>
                  {row.problem === undefined
                    ? null
                    : <p id={problemId} className={css.rowProblem}>{t(ROW_PROBLEM_KEYS[row.problem], { name: row.name })}</p>}
                </div>
              )
            })}
            <Button
              variant="outline"
              icon={<IconPlusOutlineRegular size={14} />}
              className={css.add}
              disabled={disabled}
              onClick={props.addRow}
            >
              {t('addVariable')}
            </Button>
          </section>
        </div>
        <VariablePicker t={t} rows={state.rows} disabled={disabled} onInsert={insert} />
      </div>
    </SettingsForm>
  )
}
