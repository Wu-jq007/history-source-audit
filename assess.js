/**
 * Scoring, hard rules, exemptions, era weighting, critical-edition bonus, and
 * report rendering for history-source-audit v3.
 */

import {
  VERDICT_VALUE,
  VERDICT_LABEL,
  TIERS,
  CRITERIA,
  CRITERIA_BY_ID,
  UPGRADE_RULES,
  DOWNGRADE_RULES,
  OVERRIDE_RULES,
  COUNTERFACTUAL_HINTS,
  ERA_LABELS,
  ERA_VALUES,
  eraWeights,
  EDITION_LABELS,
  EDITION_BONUS,
  EDITION_VALUES,
  BASE_CAVEATS,
} from './rubric.js'
import { SCAN_LABELS, scanExcerpt } from './scan.js'
import { message } from './messages.js'

const VERDICT_VALUES = ['support', 'partial', 'neutral', 'weaken', 'unknown']

/* ------------------------------------------------------------------ */
/* Shape helpers                                                       */
/* ------------------------------------------------------------------ */

export function emptyScanReview() {
  return { available: false, model: '', checked: 0, falsePositives: [], kept: [], note: '' }
}

export function emptyLookup() {
  return {
    attempted: false,
    ok: false,
    phrase: '',
    query: '',
    hits: [],
    phraseFound: false,
    warnings: [],
    note: '',
  }
}

function emptyItem(criterion, weight) {
  return {
    id: criterion.id,
    index: criterion.index,
    label: criterion.label,
    baseWeight: criterion.weight,
    weight,
    verdict: 'unknown',
    verdictLabel: VERDICT_LABEL.unknown,
    points: 0,
    note: '',
  }
}

function round1(value) {
  return Math.round(value * 10) / 10
}

function tierForScore(score) {
  if (score >= 80) return '高'
  if (score >= 65) return '较高'
  if (score >= 50) return '中等'
  if (score >= 35) return '较低'
  return '低'
}

function cellText(value, max = 160) {
  const text = String(value ?? '').replace(/\r?\n/g, ' ').replace(/\|/g, '／').trim()
  return text.length > max ? `${text.slice(0, max)}…` : text
}

function lineText(value, max = 600) {
  const text = String(value ?? '').replace(/\s+/g, ' ').trim()
  return text.length > max ? `${text.slice(0, max)}…（已截断）` : text
}

function normalizeEra(value) {
  return ERA_VALUES.includes(value) ? value : 'unknown'
}

function normalizeEdition(value) {
  return EDITION_VALUES.includes(value) ? value : 'unknown'
}

/**
 * Normalize criteria and validate every exemption immediately. A missing
 * exemption reason, an unknown rule, a mismatched criterion, or more than
 * three exemptions throws so the caller must fix the request.
 * @param {object[]} raw criteria entries
 * @param {'zh'|'en'} lang error-message language
 */
function normalizeCriteria(raw, lang) {
  const byId = new Map()
  const notes = []
  let overrideCount = 0
  for (const entry of raw) {
    if (!entry || typeof entry !== 'object') {
      notes.push('忽略一个无效的 criteria 条目。')
      continue
    }
    const id = entry.criterion
    if (!CRITERIA_BY_ID.has(id)) {
      notes.push(`忽略未知准则：${String(id)}`)
      continue
    }
    if (byId.has(id)) notes.push(`准则 ${id} 重复，已保留最后一次判断。`)
    const verdict = VERDICT_VALUES.includes(entry.verdict) ? entry.verdict : 'unknown'
    const note = typeof entry.note === 'string' ? entry.note.trim() : ''
    let override
    if (entry.override && typeof entry.override === 'object') {
      const rule = String(entry.override.rule || '')
      const reason = typeof entry.override.reason === 'string' ? entry.override.reason.trim() : ''
      const spec = OVERRIDE_RULES[rule]
      if (!spec) {
        throw new Error(message(lang, 'overrideUnknownRule', rule, Object.keys(OVERRIDE_RULES).join(', ')))
      }
      if (!reason) {
        throw new Error(message(lang, 'overrideMissingReason', rule))
      }
      if (spec.criterion !== id) {
        throw new Error(message(lang, 'overrideWrongCriterion', rule, spec.criterion, id))
      }
      overrideCount += 1
      if (overrideCount > 3) throw new Error(message(lang, 'overrideLimit'))
      override = { rule, reason }
    }
    byId.set(id, { id, verdict, note, override })
  }
  const overrides = [...byId.values()]
    .filter(finding => finding.override)
    .map(finding => ({
      criterion: finding.id,
      rule: finding.override.rule,
      reason: finding.override.reason,
      verified: false,
    }))
  return { byId, notes, overrides }
}

/* ------------------------------------------------------------------ */
/* Assessment                                                          */
/* ------------------------------------------------------------------ */

/**
 * Assess one source. Pure and synchronous.
 * @param {{ source?: string, excerpt?: string, era_type?: string, edition?: string, lang?: 'zh'|'en', criteria?: object[] }} input
 * @param {{ scan?: object, scanReview?: object, lookup?: object }} [extras]
 */
export function assess(input, extras = {}) {
  const source = String((input && input.source) || '').trim() || '未命名史料'
  const excerpt = typeof (input && input.excerpt) === 'string' ? input.excerpt.trim() : ''
  const lang = input && input.lang === 'en' ? 'en' : 'zh'
  const eraType = normalizeEra(input && input.era_type)
  const weights = eraWeights(eraType)
  const normalized = normalizeCriteria(Array.isArray(input && input.criteria) ? input.criteria : [], lang)
  const scan = extras.scan || scanExcerpt(excerpt)
  const scanReview = extras.scanReview || emptyScanReview()
  const lookup = extras.lookup || emptyLookup()
  const edition = normalizeEdition(input && input.edition)
  const legacyNotes = []
  if (input && input.endorsement) {
    legacyNotes.push(message(lang, 'legacyEndorsement'))
  }

  const eraChanges = CRITERIA
    .filter(criterion => Math.abs(weights[criterion.id] - criterion.weight) > 0.05)
    .map(criterion => ({
      id: criterion.id,
      label: criterion.label,
      baseWeight: criterion.weight,
      weight: weights[criterion.id],
    }))

  const shared = {
    tool: 'history_source_audit',
    source,
    excerpt,
    eraType,
    eraLabel: ERA_LABELS[eraType],
    edition,
    editionLabel: EDITION_LABELS[edition],
    eraChanges,
    scan,
    scanReview,
    lookup,
  }

  if (normalized.byId.size === 0) {
    return {
      ...shared,
      mode: 'rubric',
      score: 0,
      scoreTier: '未评估',
      tier: '待核',
      provisional: true,
      assessed: 0,
      total: CRITERIA.length,
      items: CRITERIA.map(criterion => emptyItem(criterion, weights[criterion.id])),
      rules: [],
      overrides: [],
      strengths: [],
      risks: [],
      counterEvidence: ['尚未提供判断；本框架不预设结论。'],
      questions: [
        ...CRITERIA.map(criterion => criterion.question),
        '现有佐证是否彼此独立，还是同源转抄？',
        '是否有被忽略的反证？',
      ].slice(0, 12),
      counterfactuals: [],
      caveats: [...BASE_CAVEATS, ...legacyNotes],
    }
  }

  const { byId, notes, overrides } = normalized
  const items = CRITERIA.map(criterion => {
    const given = byId.get(criterion.id)
    const verdict = given ? given.verdict : 'unknown'
    const weight = weights[criterion.id]
    return {
      ...emptyItem(criterion, weight),
      verdict,
      verdictLabel: VERDICT_LABEL[verdict],
      points: round1(weight * VERDICT_VALUE[verdict]),
      note: given ? given.note : '',
    }
  })
  const itemById = id => items.find(item => item.id === id)
  const assessed = items.filter(item => item.verdict !== 'unknown').length
  const rules = []

  const editionBonus = EDITION_BONUS[edition] ?? 0
  if (editionBonus !== 0) {
    rules.push({
      id: 'edition',
      effect: `+${editionBonus}`,
      reason: `整理本：${EDITION_LABELS[edition]}（+${editionBonus} 基础信任；只反映整理质量，不保证所记史实为真）。`,
    })
  }

  const score = Math.max(0, Math.min(100, Math.round(
    items.reduce((sum, item) => sum + item.points, 0) + editionBonus,
  )))
  const rawScoreTier = tierForScore(score)
  let tierIdx = TIERS.indexOf(rawScoreTier)

  const overrideOf = ruleId => {
    for (const finding of byId.values()) {
      if (finding.override && finding.override.rule === ruleId) return finding.override.reason
    }
    return undefined
  }

  for (const rule of UPGRADE_RULES) {
    if (itemById(rule.id).verdict === 'support') {
      tierIdx = Math.min(TIERS.length - 1, tierIdx + 1)
      rules.push({ id: rule.id, effect: '升级 +1', reason: rule.reason })
    }
  }

  for (const rule of DOWNGRADE_RULES) {
    if (itemById(rule.id).verdict !== 'weaken') continue
    const exemption = overrideOf(rule.overrideId)
    if (exemption) {
      rules.push({
        id: rule.id,
        effect: '豁免',
        reason: `${rule.label}已豁免：${exemption}（调用者声明，未核验）`,
      })
    } else {
      tierIdx = Math.max(0, tierIdx - 1)
      rules.push({ id: rule.id, effect: '降级 -1', reason: rule.reason })
    }
  }

  const capAt = (id, ceiling, reason, overrideId) => {
    const exemption = overrideOf(overrideId)
    if (exemption) {
      rules.push({
        id,
        effect: '豁免',
        reason: `${OVERRIDE_RULES[overrideId].label}已豁免：${exemption}（调用者声明，未核验）`,
      })
      return
    }
    const binding = tierIdx > ceiling
    if (binding) tierIdx = ceiling
    rules.push({
      id,
      effect: binding ? `上限 → ${TIERS[ceiling]}` : `仍受「${TIERS[ceiling]}」上限约束`,
      reason,
    })
  }

  const corroboration = itemById('corroboration').verdict
  if (corroboration === 'weaken' || corroboration === 'neutral' || corroboration === 'unknown') {
    capAt('corroboration', 1, '孤证不立：缺少独立佐证时，等级不高于「较低」。', 'corroboration_cap')
  } else if (corroboration === 'partial') {
    capAt('corroboration', 2, '佐证有限或疑似同源转抄，等级不高于「中等」。', 'corroboration_cap')
  }

  if (itemById('counter_evidence').verdict === 'weaken') {
    capAt('counter_evidence', 1, '反证优先：存在反证或未检索反证，等级不高于「较低」。', 'counter_evidence_cap')
  }

  tierIdx = Math.max(0, Math.min(TIERS.length - 1, tierIdx))
  const tier = assessed === 0 ? '待核' : TIERS[tierIdx]
  const scoreTier = assessed === 0 ? '未评估' : rawScoreTier
  const provisional = assessed < 6

  const strengths = items
    .filter(item => item.verdict === 'support' || item.verdict === 'partial')
    .sort((a, b) => b.points - a.points)
    .slice(0, 5)
    .map(item => `${item.label}（${item.verdictLabel}）：${item.note || CRITERIA_BY_ID.get(item.id).supportHint}`)

  const risks = items
    .filter(item => item.verdict === 'weaken')
    .map(item => `${item.label}：${item.note || CRITERIA_BY_ID.get(item.id).weakenHint}`)

  const counterItem = itemById('counter_evidence')
  const counterEvidence = []
  if (counterItem.verdict === 'weaken') {
    counterEvidence.push('存在反证，或未检索反证：本条不应作为定论。')
  } else if (counterItem.verdict === 'support') {
    counterEvidence.push('已检索反证，未发现足以推翻本条的独立反证。')
  } else {
    counterEvidence.push('未确认是否检索过反证；补做之前不宜下确定性结论。')
  }
  if (counterItem.note) counterEvidence.push(counterItem.note)

  const specificQuestions = []
  for (const item of items) {
    if (item.verdict === 'weaken' || item.verdict === 'unknown') {
      specificQuestions.push(CRITERIA_BY_ID.get(item.id).question)
    }
  }
  const questions = [
    ...new Set(specificQuestions),
    '现有佐证是否彼此独立，还是同源转抄？',
    '是否有被忽略的反证？',
  ].slice(0, 12)

  const counterfactuals = []
  for (const item of items.filter(entry => entry.verdict === 'weaken').slice(0, 3)) {
    counterfactuals.push(`若${COUNTERFACTUAL_HINTS[item.id].raise}，等级可上调。`)
  }
  for (const item of items.filter(entry => entry.verdict === 'support').slice(0, 2)) {
    counterfactuals.push(`若${COUNTERFACTUAL_HINTS[item.id].lower}，等级需下调。`)
  }
  if (counterfactuals.length === 0) counterfactuals.push('补充任何一项未评估准则的证据，都可能改变当前等级。')

  const caveats = [...BASE_CAVEATS]
  if (provisional) caveats.push('超过一半的准则未评估，结论仅为暂定。')
  if (notes.length > 0) caveats.push(...notes)
  if (legacyNotes.length > 0) caveats.push(...legacyNotes)
  if (overrides.length > 0) caveats.push('豁免理由由调用者声明，工具不核验其真实性；请人工复核每项豁免。')
  if (eraType !== 'unknown') caveats.push('时代权重调整只改变各条相对重要性，不改变单条判断。')
  if (lookup.ok) caveats.push('网络校验只作警示，不计分：它只证明某网页有该表述，不证明网页权威或文本无误。')
  if (scanReview.available) caveats.push('LLM 语境复核也可能出错，仅用于排除明显误报。')

  return {
    ...shared,
    mode: 'report',
    score,
    scoreTier,
    tier,
    provisional,
    assessed,
    total: items.length,
    items,
    rules,
    overrides,
    strengths,
    risks,
    counterEvidence,
    questions,
    counterfactuals,
    caveats,
  }
}

/* ------------------------------------------------------------------ */
/* Rendering                                                           */
/* ------------------------------------------------------------------ */

function stanceLine(tier) {
  if (tier === '高' || tier === '较高') return '在现有证据下，本条可作为较强证据使用；但仍保留下列疑问，不作绝对断言。'
  if (tier === '中等') return '本条只能作为参考性证据，宜与其他独立材料并用，不宜单独支撑结论。'
  if (tier === '较低' || tier === '低') return '本条不宜单独作为定论依据；需要更多独立佐证或实物材料，但不排除其局部可信。'
  return '证据不足或尚未评估，暂不作可靠性判断。'
}

function renderEraChanges(data) {
  if (data.eraChanges.length === 0) return []
  const lines = ['## 时代权重调整', '']
  lines.push(`- 时代类型：${data.eraLabel}。权重合计仍为 100，只改变各条相对重要性。`)
  for (const change of data.eraChanges) {
    lines.push(`- ${change.label}：${change.baseWeight} → ${change.weight}`)
  }
  lines.push('')
  return lines
}

function renderOverrides(data) {
  if (data.overrides.length === 0) return []
  const lines = ['## 覆盖/豁免', '']
  for (const override of data.overrides) {
    lines.push(`- **${OVERRIDE_RULES[override.rule].label}**（准则 ${override.criterion}）：${override.reason}`)
  }
  lines.push('- 说明：豁免理由由调用者提供，工具不核验；请把它当作待核实的声明，而不是已证事实。')
  lines.push('')
  return lines
}

function renderScan(data) {
  const lines = ['## 文本自动扫描（仅供参考）', '']
  const scan = data.scan
  if (!scan.available) {
    lines.push('- 未提供原文，跳过字面扫描。')
    lines.push('')
    return lines
  }
  const falsePositiveByTerm = new Map()
  for (const entry of data.scanReview.falsePositives) falsePositiveByTerm.set(entry.term, entry.reason)

  let any = false
  for (const key of ['evaluation', 'hearsay', 'omen', 'hyperbole', 'numeric']) {
    const kept = (scan[key] || []).filter(entry => !falsePositiveByTerm.has(entry.term))
    if (kept.length === 0) continue
    any = true
    lines.push(`- ${SCAN_LABELS[key]}：${kept.map(entry => `${entry.term} ×${entry.count}`).join('、')}`)
  }
  if (!any) lines.push('- 未发现（或经语境复核后已排除）预设的字面标记。')

  if (falsePositiveByTerm.size > 0) {
    lines.push('- 语境复核排除：')
    for (const [term, reason] of falsePositiveByTerm) {
      lines.push(`  - ${term}：${reason || '语境误报'}`)
    }
    if (data.scanReview.model) lines.push(`  - 复核模型：${data.scanReview.model}`)
  } else if (data.scanReview.available) {
    lines.push(`- 语境复核：已检查 ${data.scanReview.checked} 项，未排除任何项。`)
  } else if (data.scanReview.note) {
    lines.push(`- 语境复核：${data.scanReview.note}`)
  }

  lines.push('- 说明：以上只统计字面出现，不判断语境，不能替代人工核定。')
  lines.push('')
  return lines
}

function renderLookup(data) {
  const lines = ['## 网络原文校验', '']
  const lookup = data.lookup
  if (!lookup.attempted) {
    lines.push('- 未启用（`lookup: off`）。')
    lines.push('')
    return lines
  }
  if (!lookup.ok) {
    lines.push(`- 检索未成功：${lookup.note || '未知原因'}`)
    lines.push('')
    return lines
  }
  lines.push(`- 检索短语：${lookup.phrase}`)
  lines.push(`- 是否命中原文：${lookup.phraseFound ? '是' : '否'}`)
  lines.push('- 本项只作警示，不计分。')
  if (lookup.hits.length > 0) {
    lines.push('')
    lines.push('| 标题 | 域名 | 命中 |')
    lines.push('|---|---|---|')
    for (const hit of lookup.hits) {
      lines.push(`| ${cellText(hit.title, 40) || '—'} | ${cellText(hit.domain, 40)} | ${hit.phraseFound ? '是' : '否'} |`)
    }
  }
  const contexts = lookup.hits.filter(hit => hit.phraseFound && hit.contextBefore).slice(0, 3)
  if (contexts.length > 0) {
    lines.push('')
    lines.push('- 命中上下文（短语前文，已去标点）：')
    for (const hit of contexts) {
      lines.push(`  - ${cellText(hit.domain || hit.url, 40)}：…${cellText(hit.contextBefore.slice(-60), 60)}`)
    }
  }
  if (lookup.warnings.length > 0) {
    lines.push('')
    for (const warning of lookup.warnings) lines.push(`- **警告**：${warning}`)
  }
  if (lookup.note) lines.push(`- ${lookup.note}`)
  lines.push('')
  return lines
}

function renderRubric(data) {
  const lines = []
  lines.push(`# 史料可靠性分析框架：${data.source}`, '')
  if (data.excerpt) lines.push(`> ${data.excerpt.split('\n').join('\n> ')}`, '')
  lines.push('本工具把可靠性评估拆成 **十二项计分准则** 与 **第十三条立场规则**。请先逐项核查，再把每项判断作为 `criteria` 传入后重新调用。', '')
  if (data.eraType !== 'unknown') {
    lines.push(`- 时代类型：${data.eraLabel}（权重已按时代调整）。`)
  }
  if (data.eraChanges.length > 0) {
    lines.push(`- 权重调整：${data.eraChanges.map(change => `${change.label} ${change.baseWeight}→${change.weight}`).join('；')}`)
  }
  if (data.edition !== 'unknown') {
    lines.push(`- 整理本：${EDITION_LABELS[data.edition]}（仅小幅调整 source_nature）。`)
  }
  lines.push('')
  lines.push('## 十二项计分准则', '')
  for (const criterion of CRITERIA) {
    lines.push(`${criterion.index}. **${criterion.label}**（权重 ${data.items.find(item => item.id === criterion.id).weight}）`)
    lines.push(`   - 支持：${criterion.supportHint}`)
    lines.push(`   - 削弱：${criterion.weakenHint}`)
    lines.push(`   - 追问：${criterion.question}`)
  }
  lines.push('', '## 第十三条：态度', '')
  lines.push('- 怀疑但不否认：存疑不等于伪造，证据不足不等于虚构。')
  lines.push('- 不自动认可权威：官修史书、名家名作、通行教科书同样可能出错。')
  lines.push('- 反证优先、孤证慎用、多源印证；指出可能的问题并提出疑问，而不是先下结论。', '')
  lines.push('## 判定口径', '')
  lines.push('| verdict | 含义 | 计分系数 |')
  lines.push('|---|---|---|')
  lines.push('| `support` | 该条显著提升可信度 | 1.0 |')
  lines.push('| `partial` | 有限提升 | 0.6 |')
  lines.push('| `neutral` | 本条不适用，或正反证据持平 | 0.5 |')
  lines.push('| `weaken` | 明显降低可信度 | 0 |')
  lines.push('| `unknown` | 尚未核查 | 0.5（并计入不确定性） |', '')
  lines.push('## 覆盖/豁免')
  lines.push('')
  lines.push('- 在对应 criteria 条目上加 `override: { rule, reason }` 可豁免一项硬规则；**reason 必填**，例如：')
  lines.push('  `{ "criterion": "corroboration", "verdict": "weaken", "override": { "rule": "corroboration_cap", "reason": "此为出土汉简原件，物理载体已证其真" } }`')
  lines.push(`- 可用 rule：${Object.keys(OVERRIDE_RULES).join('、')}；最多 3 项。`)
  lines.push('- 豁免理由由调用者提供，工具不核验。')
  lines.push('')
  lines.push('## 时代与整理本')
  lines.push('')
  lines.push('- `era_type` 可取 `pre_qin`（先秦）、`medieval`（中古）、`early_modern`（近代）、`contemporary`（当代）、`unknown`（不明）。')
  lines.push('- 先秦/考古相关会提高实物史料权重、降低传世文献公信力权重。')
  lines.push('- `edition` 可取 `peer-reviewed`（权威学术整理版，+2）、`none`（无学术整理，0）、`unknown`（不明，0）。')
  lines.push('- **政权或官方背书不作为标准**：无论古今政权是否“认可”，都不参与评分；可信度来自史料本身的内外考证。')
  lines.push('')
  lines.push('## 汇总与硬规则')
  lines.push('')
  lines.push('- 等级区间：高 ≥80；较高 65–79；中等 50–64；较低 35–49；低 <35。')
  lines.push('- **孤证不立**：`corroboration` 为 `weaken`/`neutral`/`unknown` 时，等级不高于「较低」；为 `partial` 时不高于「中等」。')
  lines.push('- **反证优先**：`counter_evidence` 为 `weaken` 时，等级不高于「较低」。')
  lines.push('- 敌对立场、时空远离、多层转述、胜利者/幸存者书写或统计口径变化、逻辑矛盾：各降一级。')
  lines.push('- 有实物史料、官修或获后世公认的私修：各升一级。')
  lines.push('- `context_review: "llm"` 可让模型复核扫描词的语境误报；`lookup: "auto"` 可联网查找原文并检测片段是否漏掉「太史公曰」等关键引语。')
  return lines.join('\n')
}

function renderReport(data) {
  const lines = []
  lines.push(`# 史料可靠性评估：${data.source}`)
  if (data.excerpt) lines.push('', `> ${lineText(data.excerpt, 700)}`)
  lines.push('')
  lines.push(`**综合等级：${data.tier}**｜启发式分值 ${data.score}/100｜计分层级 ${data.scoreTier}｜已评估 ${data.assessed}/${data.items.length}`)
  lines.push('')
  lines.push(`时代：${data.eraLabel}｜整理本：${data.editionLabel}｜模式：${data.mode === 'report' ? '评估' : '框架'}`)
  lines.push('')
  lines.push(stanceLine(data.tier))
  lines.push('')
  lines.push('## 分项判断')
  lines.push('')
  lines.push('| # | 准则 | 权重 | 判断 | 得分 | 备注 |')
  lines.push('|---|---|---|---|---|---|')
  for (const item of data.items) {
    lines.push(`| ${item.index} | ${item.label} | ${item.weight} | ${item.verdictLabel} | ${item.points} | ${cellText(item.note) || '—'} |`)
  }
  lines.push('')

  lines.push(...renderEraChanges(data))
  lines.push(...renderOverrides(data))

  lines.push('## 强项（现有支撑）')
  lines.push('')
  if (data.strengths.length === 0) lines.push('- 未发现明显支撑项。')
  for (const strength of data.strengths) lines.push(`- ${strength}`)
  lines.push('')

  lines.push('## 风险与硬规则')
  lines.push('')
  if (data.risks.length === 0) lines.push('- 未发现明显削弱项。')
  for (const risk of data.risks) lines.push(`- **削弱**：${risk}`)
  if (data.rules.length === 0) {
    lines.push('- 未触发额外硬规则。')
  } else {
    for (const rule of data.rules) lines.push(`- **硬规则**（${rule.effect}）：${rule.reason}`)
  }
  lines.push(`- **结论是否暂定**：${data.provisional ? '是（未评估过半）' : '否'}`)
  lines.push('')

  lines.push('## 反证优先')
  lines.push('')
  for (const line of data.counterEvidence) lines.push(`- ${line}`)
  lines.push('')

  lines.push(...renderScan(data))
  lines.push(...renderLookup(data))

  lines.push('## 待查疑问')
  lines.push('')
  data.questions.forEach((question, index) => lines.push(`${index + 1}. ${question}`))
  lines.push('')

  lines.push('## 反事实：什么会改变结论')
  lines.push('')
  for (const item of data.counterfactuals) lines.push(`- ${item}`)
  lines.push('')

  lines.push('## 第十三条：立场与方法')
  lines.push('')
  lines.push('- 怀疑但不否认：存疑不等于伪造，证据不足不等于虚构。')
  lines.push('- 不自动认可权威：官修史书、名家名作同样可能出错。')
  lines.push('- 反证优先、孤证慎用、多源印证；先指出可能的问题，再谈结论。')
  lines.push('')

  lines.push('## 使用限制')
  lines.push('')
  for (const caveat of data.caveats) lines.push(`- ${caveat}`)
  return lines.join('\n')
}

/**
 * Attach the rendered Markdown to an assessment.
 * @param {object} data result of {@link assess}
 */
export function render(data) {
  const diagnostics = Array.isArray(data.diagnostics) ? data.diagnostics : []
  let markdown = data.mode === 'rubric' ? renderRubric(data) : renderReport(data)
  if (diagnostics.length > 0) {
    markdown += '\n\n## 调试信息\n\n' + diagnostics.map(line => `- ${line}`).join('\n')
  }
  return { ...data, diagnostics, markdown }
}

/**
 * Convenience wrapper for tests and offline use.
 * @param {object} input same shape as the tool arguments
 */
export function buildReport(input) {
  return render(assess(input, {}))
}
