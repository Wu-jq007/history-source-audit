/**
 * Small message catalogue for user-facing errors. The rendered report is still
 * Chinese-only (see docs/ROADMAP.md); this file covers the validation errors
 * that a contributor or API caller sees first, and gives the community one
 * obvious place to extend.
 */

export const MESSAGES = Object.freeze({
  zh: Object.freeze({
    overrideMissingReason: rule => `override.rule=${rule} 必须提供 override.reason（豁免理由，例如「此为出土汉简原件，物理载体已证其真」）。`,
    overrideUnknownRule: (rule, allowed) => `无效的 override.rule：${rule || '(空)'}。可用值：${allowed}。`,
    overrideWrongCriterion: (rule, expected, actual) => `override.rule=${rule} 只能用于准则 ${expected}，当前条目准则为 ${actual}。`,
    overrideLimit: '最多允许 3 项硬规则豁免。',
    legacyEndorsement: 'endorsement（政权/制度背书）已移除，不再参与评分；请改用 edition。',
  }),
  en: Object.freeze({
    overrideMissingReason: rule => `override.rule=${rule} requires a non-empty override.reason (for example: "This is the original excavated bamboo slip; its physical carrier is authenticated").`,
    overrideUnknownRule: (rule, allowed) => `Unknown override.rule: ${rule || '(empty)'}. Allowed values: ${allowed}.`,
    overrideWrongCriterion: (rule, expected, actual) => `override.rule=${rule} belongs to criterion ${expected}, but the entry uses ${actual}.`,
    overrideLimit: 'At most 3 hard-rule exemptions are allowed.',
    legacyEndorsement: 'endorsement (regime/institutional backing) has been removed and no longer affects the score; use edition instead.',
  }),
})

/**
 * Translate one message key.
 * @param {'zh'|'en'} lang language code
 * @param {string} key message key
 * @param {...unknown} args interpolation arguments
 */
export function message(lang, key, ...args) {
  const table = MESSAGES[lang] || MESSAGES.zh
  const entry = table[key] || MESSAGES.zh[key]
  if (typeof entry === 'function') return entry(...args)
  return String(entry)
}
