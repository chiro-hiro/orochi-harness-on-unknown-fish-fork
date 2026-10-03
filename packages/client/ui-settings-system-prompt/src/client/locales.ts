/** Locale bundles for the System Prompt settings page. */

import type { SettingsFormLabels } from '@orochi-network/oh-client-ui-primitives'

/** Locale keys the page renders. */
export type SystemPromptSettingsKey =
  | 'nav' | 'promptTitle'
  | 'prefixLabel' | 'prefixHint' | 'suffixLabel' | 'suffixHint'
  | 'invalidReferences' | 'unknownReferences'
  | 'customVariablesTitle' | 'customVariablesHint'
  | 'rowName' | 'rowValue' | 'addVariable' | 'removeVariable'
  | 'rowNameInvalid' | 'rowNameDuplicate' | 'rowNameReserved'
  | 'variablesTitle' | 'paletteHint' | 'harnessGroup' | 'customGroup'
  | 'variable.cwd' | 'variable.model' | 'variable.provider'
  | 'overridden' | 'reset'
  | 'unavailable' | 'readOnly' | 'saveFailed' | 'save' | 'saving'

/** English copy. */
export const en: Record<SystemPromptSettingsKey, string> = {
  nav: 'System Prompt',
  promptTitle: 'Prompt text',
  prefixLabel: 'Prefix',
  prefixHint: 'System prompt text rendered before the built-in guidance.',
  suffixLabel: 'Suffix',
  suffixHint: 'System prompt text rendered after the built-in guidance.',
  invalidReferences: 'These are not valid variable references: {refs}.',
  unknownReferences: 'These variables are not defined in this deployment: {refs}.',
  customVariablesTitle: 'Custom variables',
  customVariablesHint: 'Values the prompt text can reference with {{name}}.',
  rowName: 'Variable name',
  rowValue: 'Value',
  addVariable: 'Add variable',
  removeVariable: 'Remove this variable',
  rowNameInvalid: 'Use lowercase letters, digits, and underscores, starting with a letter.',
  rowNameDuplicate: 'This name is used by another row.',
  rowNameReserved: '{name} is provided by the harness; pick another name.',
  variablesTitle: 'Variables',
  paletteHint: 'Click a variable to insert it at the cursor.',
  harnessGroup: 'Built in',
  customGroup: 'Custom',
  'variable.cwd': 'Working directory of the running session.',
  'variable.model': 'Model id of the running agent.',
  'variable.provider': 'Provider of the running agent.',
  overridden: 'Overridden',
  reset: 'Reset to default',
  unavailable: 'This plugin is not loaded, so it cannot be configured right now.',
  readOnly: 'This deployment stores settings read-only.',
  saveFailed: 'The deployment did not accept these values; they were left for you to correct.',
  save: 'Save',
  saving: 'Saving…',
}

/** Simplified Chinese copy. */
export const zh: Record<SystemPromptSettingsKey, string> = {
  nav: '系统提示词',
  promptTitle: '提示词文本',
  prefixLabel: '前缀',
  prefixHint: '渲染在内置指引之前的系统提示词文本。',
  suffixLabel: '后缀',
  suffixHint: '渲染在内置指引之后的系统提示词文本。',
  invalidReferences: '这些不是有效的变量引用：{refs}',
  unknownReferences: '本部署未定义这些变量：{refs}',
  customVariablesTitle: '自定义变量',
  customVariablesHint: '提示词文本可用 {{name}} 引用的取值。',
  rowName: '变量名',
  rowValue: '取值',
  addVariable: '添加变量',
  removeVariable: '移除该变量',
  rowNameInvalid: '只能使用小写字母、数字和下划线，且以字母开头。',
  rowNameDuplicate: '该名称已被其他行使用。',
  rowNameReserved: '{name} 由内置变量提供，请换一个名称。',
  variablesTitle: '变量',
  paletteHint: '点击变量即可插入到光标处。',
  harnessGroup: '内置',
  customGroup: '自定义',
  'variable.cwd': '运行中会话的工作目录。',
  'variable.model': '运行中智能体的模型 id。',
  'variable.provider': '运行中智能体的模型提供商。',
  overridden: '已覆盖',
  reset: '恢复默认',
  unavailable: '该插件当前未加载，暂时无法配置。',
  readOnly: '本部署的设置为只读。',
  saveFailed: '本部署没有接受这些值，已保留供你修改。',
  save: '保存',
  saving: '保存中…',
}

/**
 * The form frame's copy, read from this page's dictionary.
 * @param t - the page's locale reader.
 * @returns the labels the shared settings form renders.
 */
export function formLabels(t: (key: SystemPromptSettingsKey) => string): SettingsFormLabels {
  return { unavailable: t('unavailable'), readOnly: t('readOnly'), saveFailed: t('saveFailed'), save: t('save'), saving: t('saving') }
}
