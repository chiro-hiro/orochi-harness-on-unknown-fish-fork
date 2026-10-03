/** The System Prompt page's staged form over the `system-prompt` settings namespace. */

import type { SnapshotStore } from '@orochi-network/oh-client-store'
import { createSnapshotStore } from '@orochi-network/oh-client-store'
import type {
  SettingsFieldState, SettingsFormPathOp, SettingsFormScope, SettingsFormScopeSnapshot, SettingsFormShell,
} from '@orochi-network/oh-client-ui-primitives'
import { VARIABLE_NAME } from '@orochi-network/oh-util-prompt-template'
import { referenceIssues, type PromptReferenceIssue } from './references.ts'
import { HARNESS_VARIABLES } from './variable-catalog.ts'

/** The `system-prompt` namespace fields this page edits. */
export interface SystemPromptSettings {
  /** Deployment persona template before first-party guidance. */
  personaPrefix?: string
  /** Deployment persona template after first-party guidance. */
  personaSuffix?: string
  /** Deployment-defined `{{name}}` variable values. */
  variables?: Record<string, string>
}

/** The prompt text fields the page edits. */
export type PromptField = 'personaPrefix' | 'personaSuffix'

/** Why a custom variable row cannot save. */
export type VariableRowProblem =
  /** The name is not a valid `{{name}}` reference name. */
  | 'name'
  /** Another row uses the same name. */
  | 'duplicate'
  /** The harness already provides the name. */
  | 'reserved'

/** One custom `{{name}}` variable row as the editor shows it. */
export interface VariableRow {
  /** The reference name between the braces. */
  name: string
  /** The value substituted at render. */
  value: string
  /** Why this row cannot save, or undefined when it can. */
  problem?: VariableRowProblem
}

/** What the System Prompt page renders. */
export interface SystemPromptEditorState extends SettingsFormShell {
  /** The prefix draft, its override state, and its save validity. */
  prefix: SettingsFieldState
  /** The suffix draft, its override state, and its save validity. */
  suffix: SettingsFieldState
  /** Custom variable rows in edit order, each with its save problem. */
  rows: readonly VariableRow[]
  /** Whether a save would leave a user-layer `variables` entry. */
  variablesOverridden: boolean
  /** Reference problems in the prefix draft. */
  prefixIssues: readonly PromptReferenceIssue[]
  /** Reference problems in the suffix draft. */
  suffixIssues: readonly PromptReferenceIssue[]
}

/** The actions and snapshot the System Prompt page's slot entry injects. */
export interface SystemPromptEditorFace {
  hooks: {
    /** Page snapshot bound by the renderer as useSystemPromptEditor. */
    systemPromptEditor: SnapshotStore<SystemPromptEditorState>
  }
  /** Stage draft text for one prompt field. */
  edit: (field: PromptField, text: string) => void
  /** Stage a clear so the field re-inherits the composition layer. */
  resetField: (field: PromptField) => void
  /** Append one empty custom variable row. */
  addRow: () => void
  /** Stage one row's name or value text. */
  editRow: (index: number, field: 'name' | 'value', text: string) => void
  /** Stage the removal of one row. */
  removeRow: (index: number) => void
  /** Stage a clear of the whole custom-variable map. */
  resetVariables: () => void
  /** Write every staged edit. */
  save: () => void
  /** Drop every staged edit. */
  discard: () => void
}

/** The prompt fields, in save order. */
const PROMPT_FIELDS: readonly PromptField[] = ['personaPrefix', 'personaSuffix']

/** One staged prompt text: the draft, or a staged clear back to the composition layer. */
interface TextDraft {
  /** The draft text the control renders. */
  text: string
  /** True when this edit clears the field whatever text it shows. */
  clear: boolean
}

/** One staged edit a save would perform; `op` is absent for a draft the form refuses. */
interface PlanItem {
  /** The path edit to write, or undefined when the draft is not a value the form accepts. */
  op?: SettingsFormPathOp
}

/**
 * Compose each row's save problem, first rule wins: a name outside the
 * `{{name}}` grammar, then a harness-provided name, then a repeated name.
 * @param rows - the rows under edit.
 * @returns one problem per row, or undefined for a row that can save.
 */
function rowProblems(rows: readonly { name: string }[]): readonly (VariableRowProblem | undefined)[] {
  return rows.map((row, index) => {
    if (!VARIABLE_NAME.test(row.name)) return 'name'
    if (HARNESS_VARIABLES.some(variable => variable.name === row.name)) return 'reserved'
    return rows.some((other, otherIndex) => otherIndex !== index && other.name === row.name) ? 'duplicate' : undefined
  })
}

/** Project one stored variable map onto ordered rows. */
function toRows(variables: unknown): readonly { name: string; value: string }[] {
  if (typeof variables !== 'object' || variables === null || Array.isArray(variables)) return []
  return Object.entries(variables).map(([name, value]) => ({ name, value: typeof value === 'string' ? value : '' }))
}

/** Read one member of a stored layer; the layers cross the wire, so members arrive untyped. */
function layerMember(layer: unknown, key: string): unknown {
  return (layer as Record<string, unknown> | undefined)?.[key]
}

/** Rebuild a variable map from its rows; duplicate names cannot reach a save. */
function toMap(rows: readonly { name: string; value: string }[]): Record<string, string> {
  return Object.fromEntries(rows.map(row => [row.name, row.value]))
}

/** Whether two row lists name the same variables with the same values, in order. */
function sameRows(a: readonly { name: string; value: string }[], b: readonly { name: string; value: string }[]): boolean {
  return a.length === b.length && a.every((row, index) => row.name === b.at(index)?.name && row.value === b.at(index)?.value)
}

/** The staged form behind the System Prompt settings page. */
export class SystemPromptEditorController {
  private readonly drafts = new Map<PromptField, TextDraft>()
  private rows: readonly { name: string; value: string }[] | undefined
  private rowsClear = false
  private baseline: SettingsFormScopeSnapshot<SystemPromptSettings> | undefined
  private saving = false
  private failed = false
  private readonly store: SnapshotStore<SystemPromptEditorState>
  private readonly unsubscribe: () => void

  /** @param scope - the bound settings scope for the `system-prompt` namespace. */
  constructor(private readonly scope: SettingsFormScope<SystemPromptSettings>) {
    this.store = createSnapshotStore(this.project())
    this.unsubscribe = scope.subscribe(() => { this.publish() })
  }

  /**
   * Build the face the page's slot registration injects.
   * @returns the page's snapshot and its form actions.
   */
  inject(): SystemPromptEditorFace {
    return {
      hooks: { systemPromptEditor: this.store },
      edit: (field, text) => {
        this.stage()
        this.drafts.set(field, { text, clear: false })
        this.publish()
      },
      resetField: (field) => {
        this.stage()
        this.drafts.set(field, { text: this.baseText(field), clear: true })
        this.publish()
      },
      addRow: () => {
        this.stage()
        this.rows = [...this.draftRows(), { name: '', value: '' }]
        this.rowsClear = false
        this.publish()
      },
      editRow: (index, field, text) => {
        this.stage()
        this.rows = this.draftRows().map((row, rowIndex) => rowIndex !== index ? row
          : field === 'name' ? { ...row, name: text } : { ...row, value: text })
        this.rowsClear = false
        this.publish()
      },
      removeRow: (index) => {
        this.stage()
        this.rows = this.draftRows().filter((_row, rowIndex) => rowIndex !== index)
        this.rowsClear = false
        this.publish()
      },
      resetVariables: () => {
        this.stage()
        this.rows = this.baseRows()
        this.rowsClear = true
        this.publish()
      },
      save: () => { void this.save() },
      discard: () => { this.discard() },
    }
  }

  /**
   * Write every staged edit in one revision-fenced mutation, then re-seed from
   * what the Host accepted. A save that did not land keeps its drafts, so the
   * user can correct them instead of retyping.
   * @returns fulfillment after the write and the read-back.
   */
  async save(): Promise<void> {
    const plan = this.plan()
    const ops = plan.flatMap(item => item.op === undefined ? [] : [item.op])
    if (plan.length === 0 || this.saving || !this.scope.getSnapshot().writable || ops.length !== plan.length) return
    this.saving = true
    this.failed = false
    this.publish()
    try {
      const landed = await this.scope.mutate(ops, this.baseline?.revision)
      if (landed) {
        this.drafts.clear()
        this.rows = undefined
        this.rowsClear = false
        this.baseline = undefined
      }
      this.failed = !landed
    } catch (_error) {
      // The Host refusal is reported through the form's failed state.
      this.failed = true
    } finally {
      this.saving = false
      this.publish()
    }
  }

  /** Drop every staged edit. */
  discard(): void {
    if (this.drafts.size === 0 && this.rows === undefined && !this.failed) return
    this.drafts.clear()
    this.rows = undefined
    this.rowsClear = false
    this.baseline = undefined
    this.failed = false
    this.publish()
  }

  /** Release the form's accepted-value subscription. */
  dispose(): void { this.unsubscribe() }

  /** Capture the snapshot every staged edit is fenced against. */
  private stage(): void {
    this.baseline ??= this.scope.getSnapshot()
  }

  private publish(): void {
    this.store.set(this.project())
  }

  private sectionValue(field: PromptField): string {
    return this.scope.getSnapshot().value?.[field] ?? ''
  }

  private baseText(field: PromptField): string {
    const text = layerMember(this.scope.getSnapshot().base, field)
    return typeof text === 'string' ? text : ''
  }

  private userHas(field: PromptField | 'variables'): boolean {
    const user = this.scope.getSnapshot().user
    return typeof user === 'object' && user !== null && Object.hasOwn(user, field)
  }

  /** The stored rows, in document order. */
  private effectiveRows(): readonly { name: string; value: string }[] {
    return toRows(this.scope.getSnapshot().value?.variables)
  }

  private baseRows(): readonly { name: string; value: string }[] {
    return toRows(layerMember(this.scope.getSnapshot().base, 'variables'))
  }

  /** The rows under edit: the staged rows, or the stored ones. */
  private draftRows(): readonly { name: string; value: string }[] {
    return this.rows ?? this.effectiveRows()
  }

  /** The draft text one field shows: its staged text, or the stored value. */
  private textOf(field: PromptField): string {
    return this.drafts.get(field)?.text ?? this.sectionValue(field)
  }

  private knownNames(): ReadonlySet<string> {
    const custom = this.draftRows().filter(row => VARIABLE_NAME.test(row.name)).map(row => row.name)
    return new Set([...HARNESS_VARIABLES.map(variable => variable.name), ...custom])
  }

  private hasMalformed(text: string): boolean {
    return referenceIssues(text, this.knownNames()).some(issue => issue.kind === 'malformed')
  }

  /**
   * Every staged edit a save would write. An entry whose draft is not a value
   * the form accepts carries no write: the form stays dirty and the save
   * refuses rather than dropping the edit.
   * @returns the planned edits, in the order the fields were staged.
   */
  private plan(): PlanItem[] {
    const plan: PlanItem[] = []
    for (const field of PROMPT_FIELDS) {
      const staged = this.drafts.get(field)
      if (staged === undefined) continue
      if (staged.clear) {
        if (this.userHas(field)) plan.push({ op: { op: 'unset', path: [field] } })
        continue
      }
      if (staged.text === this.sectionValue(field)) continue
      if (this.hasMalformed(staged.text)) plan.push({})
      else if (staged.text === '') plan.push({ op: { op: 'unset', path: [field] } })
      else plan.push({ op: { op: 'set', path: [field], value: staged.text } })
    }
    const rows = this.rows
    if (this.rowsClear) {
      if (this.userHas('variables')) plan.push({ op: { op: 'unset', path: ['variables'] } })
    } else if (rows !== undefined && !sameRows(rows, this.effectiveRows())) {
      const problems = rowProblems(rows)
      if (problems.some(problem => problem !== undefined)) plan.push({})
      else if (rows.length === 0) plan.push({ op: { op: 'unset', path: ['variables'] } })
      else plan.push({ op: { op: 'set', path: ['variables'], value: toMap(rows) } })
    }
    return plan
  }

  private project(): SystemPromptEditorState {
    const snapshot = this.scope.getSnapshot()
    const rows = this.draftRows()
    const problems = rowProblems(rows)
    const prefixIssues = referenceIssues(this.textOf('personaPrefix'), this.knownNames())
    const suffixIssues = referenceIssues(this.textOf('personaSuffix'), this.knownNames())
    const plan = this.plan()
    return {
      available: snapshot.status === 'ready',
      writable: snapshot.writable,
      dirty: plan.length > 0,
      invalid: plan.some(item => item.op === undefined),
      saving: this.saving,
      failed: this.failed,
      prefix: this.fieldState('personaPrefix', prefixIssues),
      suffix: this.fieldState('personaSuffix', suffixIssues),
      rows: rows.map((row, index) => ({
        name: row.name,
        value: row.value,
        ...(problems[index] === undefined ? {} : { problem: problems[index] }),
      })),
      variablesOverridden: this.rowsClear ? false : this.rows === undefined
        ? this.userHas('variables')
        : this.rows.length > 0,
      prefixIssues,
      suffixIssues,
    }
  }

  private fieldState(field: PromptField, issues: readonly PromptReferenceIssue[]): SettingsFieldState {
    const invalid = issues.some(issue => issue.kind === 'malformed')
    const staged = this.drafts.get(field)
    if (staged === undefined) {
      return { text: this.sectionValue(field), overridden: this.userHas(field), invalid }
    }
    if (staged.clear) return { text: this.baseText(field), overridden: false, invalid }
    return { text: staged.text, overridden: staged.text !== '', invalid }
  }
}
