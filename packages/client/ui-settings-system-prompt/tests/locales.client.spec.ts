/** The System Prompt page's locale bundles and form-frame labels. */
import { describe, expect, it } from 'vitest'
import { en, formLabels, zh, type SystemPromptSettingsKey } from '../src/client/locales.ts'

describe('locales', () => {
  it('carries non-empty English and Chinese copy for every key', () => {
    for (const key of Object.keys(en) as SystemPromptSettingsKey[]) {
      expect(en[key].length, key).toBeGreaterThan(0)
      expect(zh[key].length, key).toBeGreaterThan(0)
    }
  })

  it('reads the shared form frame copy from the page dictionary', () => {
    const labels = formLabels(key => `«${key}»`)
    expect(labels).toEqual({
      unavailable: '«unavailable»',
      readOnly: '«readOnly»',
      saveFailed: '«saveFailed»',
      save: '«save»',
      saving: '«saving»',
    })
  })
})
