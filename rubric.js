/**
 * Fixed rubric for history-source-audit v3.
 *
 * Twelve scored criteria (points 1–12 of the requested method) plus the
 * thirteenth stance rule. The base weights sum to 100; per-era factors reshape
 * their relative importance and are normalized back to 100 before scoring.
 */

export const VERDICT_VALUE = Object.freeze({
  support: 1,
  partial: 0.6,
  neutral: 0.5,
  weaken: 0,
  unknown: 0.5,
})

export const VERDICT_LABEL = Object.freeze({
  support: '支持',
  partial: '部分支持',
  neutral: '中性/不适用',
  weaken: '削弱',
  unknown: '未评估',
})

export const TIERS = Object.freeze(['低', '较低', '中等', '较高', '高'])

export const CRITERIA = [
  {
    id: 'source_nature',
    index: 1,
    label: '史料性质与公信力',
    weight: 8,
    supportHint: '官修（正史、实录、官档、朝廷敕修），或私修但获后世长期公认（如《史记》）',
    weakenHint: '匿名、私修且无公信，或成书背景明显服务于特定政治目的',
    question: '该文本是否确为官修？署名、编纂机构、成书背景能否核实？私修者是否得到后世公认？',
  },
  {
    id: 'corroboration',
    index: 2,
    label: '多源佐证',
    weight: 18,
    supportHint: '有独立来源记载同一事（他书、档案、碑刻），或民间歌谣、谚语、习俗构成强佐证',
    weakenHint: '孤证；或所谓旁证只是同源转抄，并不独立',
    question: '除本条外，是否有独立来源记载同一事？它们是否同源转抄？民间有无歌谣、谚语、习俗等佐证？',
  },
  {
    id: 'material_evidence',
    index: 3,
    label: '实物史料',
    weight: 9,
    supportHint: '有出土或传世实物（简帛、碑刻、器物、档案）可对应',
    weakenHint: '实物与记载明确矛盾',
    question: '有无出土或传世实物可与之对应？实物能否确证此条而非他条？',
  },
  {
    id: 'author_stance',
    index: 4,
    label: '书写者立场',
    weight: 10,
    supportHint: '作者与所记对象无利害关系，或立场中立',
    weakenHint: '政敌、敌对、竞争、恩仇、利益相关',
    question: '作者与所记人物、家族、政权是否存在政敌、师承、恩仇或利益关系？',
  },
  {
    id: 'time_space_distance',
    index: 5,
    label: '时空距离',
    weight: 12,
    supportHint: '同时代、近距离记录',
    weakenHint: '成书距事件久远，且记载者与发生地相距遥远',
    question: '记载时间距事件发生多久？记录者与事件发生地相距多远？中间是否经手他人？',
  },
  {
    id: 'style_format',
    index: 6,
    label: '文体格式',
    weight: 5,
    supportHint: '称谓、纪年、行文格式与同期文献一致',
    weakenHint: '出现晚出词汇、体例或明显后世改笔',
    question: '行文格式、称谓、纪年方式是否与同期文献一致？是否出现晚出的词汇或体例？',
  },
  {
    id: 'provenance_layers',
    index: 7,
    label: '史料层数',
    weight: 10,
    supportHint: '作者亲历（零层转述）',
    weakenHint: '经多人多书转述，层数越多可信度越低',
    question: '作者是亲历、亲闻，还是转引自他人或他书？中间隔了几层？',
  },
  {
    id: 'logical_coherence',
    index: 8,
    label: '逻辑完整性',
    weight: 7,
    supportHint: '前后一致，无自相矛盾',
    weakenHint: '同一文本内前后矛盾，或与其他篇章冲突',
    question: '同一文本内前后是否矛盾？与其他篇章的叙述是否冲突？',
  },
  {
    id: 'fact_vs_evaluation',
    index: 9,
    label: '事实与评价',
    weight: 5,
    supportHint: '以可核的事实陈述为主',
    weakenHint: '论赞、评价、「太史公曰」式内容被当作事实',
    question: '哪些是事实陈述，哪些是评价（如「太史公曰」、论赞）？引者是否把评价当事实？',
  },
  {
    id: 'literary_embellishment',
    index: 10,
    label: '文学性修饰',
    weight: 5,
    supportHint: '行文平实',
    weakenHint: '拟作对话、夸张、对称排比等明显文学加工，可能改变事实',
    question: '是否有对话拟作、夸张、排比等文学加工？加工是否改变了事实核心？',
  },
  {
    id: 'bias_presentism',
    index: 11,
    label: '胜利者/幸存者/统计口径',
    weight: 8,
    supportHint: '已识别并校正胜利者书写、幸存者偏差、统计口径变化；未用现代观念倒推',
    weakenHint: '明显胜利者或幸存者书写，或统计口径前后改变',
    question: '是否为胜利者或幸存者书写？统计口径（人口、户数、战果）是否前后一致？是否用现代道德倒推古人？',
  },
  {
    id: 'counter_evidence',
    index: 12,
    label: '反证检索',
    weight: 3,
    supportHint: '已主动检索反证，且反证较弱或不存在',
    weakenHint: '存在反证，或根本没有检索反证',
    question: '是否主动检索过反证？反证来自哪里、强度如何？为何最终不采信或采信？',
  },
]

export const CRITERIA_BY_ID = new Map(CRITERIA.map(criterion => [criterion.id, criterion]))
export const BASE_TOTAL_WEIGHT = CRITERIA.reduce((sum, criterion) => sum + criterion.weight, 0)

/** How each criterion could be raised or lowered, for counterfactual prompts. */
export const COUNTERFACTUAL_HINTS = Object.freeze({
  source_nature: { raise: '确认其为官修或获后世公认', lower: '发现成书服务于特定政治目的' },
  corroboration: { raise: '找到独立来源或民间佐证', lower: '发现旁证只是同源转抄' },
  material_evidence: { raise: '出现可对应的出土或传世实物', lower: '发现实物与记载矛盾' },
  author_stance: { raise: '证明作者与所记对象无利害关系', lower: '发现作者与所记对象存在敌对或利益关系' },
  time_space_distance: { raise: '确认记录者与事件同时代、近距', lower: '确认成书远晚于事件且记载者远离发生地' },
  style_format: { raise: '确认文体格式与同期文献一致', lower: '发现晚出词汇或后世改笔' },
  provenance_layers: { raise: '确认作者亲历或仅隔一层', lower: '发现转述层数更多' },
  logical_coherence: { raise: '使前后矛盾得到合理解释', lower: '发现新的自相矛盾' },
  fact_vs_evaluation: { raise: '剥离评价、只保留可核事实', lower: '发现更多论赞被当作事实' },
  literary_embellishment: { raise: '确认加工不触及事实核心', lower: '确认加工改变了事实核心' },
  bias_presentism: { raise: '确认偏差已校正、统计口径可对齐', lower: '发现更明显的胜利者/幸存者书写或口径变化' },
  counter_evidence: { raise: '系统检索反证而未发现', lower: '检索到新的反证' },
})

export const UPGRADE_RULES = Object.freeze([
  { id: 'material_evidence', reason: '有可对应的实物史料，提高可信度。' },
  { id: 'source_nature', reason: '官修或获后世公认的私修，提高可信度。' },
])

/** Downgrade rules. `overrideId` names the exemption a caller may claim. */
export const DOWNGRADE_RULES = Object.freeze([
  { id: 'author_stance', overrideId: 'author_stance', label: '敌对立场降级', reason: '书写者与所记对象存在敌对、政敌或利益关系。' },
  { id: 'time_space_distance', overrideId: 'time_space_distance', label: '时空距离降级', reason: '记载与事件在时间或空间上相隔较远。' },
  { id: 'provenance_layers', overrideId: 'provenance_layers', label: '多层转述降级', reason: '史料经多层转述，每增一层可信度递减。' },
  { id: 'bias_presentism', overrideId: 'bias_presentism', label: '胜者/口径降级', reason: '存在胜利者/幸存者书写或统计口径变化。' },
  { id: 'logical_coherence', overrideId: 'logical_coherence', label: '逻辑矛盾降级', reason: '文本存在前后矛盾。' },
  { id: 'source_nature', overrideId: 'source_nature', label: '非官修降级', reason: '非官修且无公认公信力。' },
])

/**
 * Hard rules a caller may override, each tied to the criterion whose finding
 * must carry the exemption.
 */
export const OVERRIDE_RULES = Object.freeze({
  corroboration_cap: { criterion: 'corroboration', label: '孤证不立' },
  counter_evidence_cap: { criterion: 'counter_evidence', label: '反证优先' },
  author_stance: { criterion: 'author_stance', label: '敌对立场降级' },
  time_space_distance: { criterion: 'time_space_distance', label: '时空距离降级' },
  provenance_layers: { criterion: 'provenance_layers', label: '多层转述降级' },
  bias_presentism: { criterion: 'bias_presentism', label: '胜者/口径降级' },
  logical_coherence: { criterion: 'logical_coherence', label: '逻辑矛盾降级' },
  source_nature: { criterion: 'source_nature', label: '非官修降级' },
})

export const EDITION_LABELS = Object.freeze({
  'peer-reviewed': '权威学术整理版（点校/校注/同行评议）',
  none: '无学术整理',
  unknown: '整理本性质不明',
})

/**
 * Bounded bonus for a critical edition. Political or regime endorsement is
 * deliberately not a category: reliability comes from textual criticism, not
 * from modern official recognition.
 */
export const EDITION_BONUS = Object.freeze({
  'peer-reviewed': 2,
  none: 0,
  unknown: 0,
})

export const EDITION_VALUES = ['peer-reviewed', 'none', 'unknown']

export const ERA_LABELS = Object.freeze({
  pre_qin: '先秦',
  medieval: '中古',
  early_modern: '近代',
  contemporary: '当代',
  unknown: '不明',
})

/**
 * Per-era multipliers for the base weights. Pre-Qin and archaeology-heavy work
 * leans on material evidence and away from transmitted-text authority.
 */
export const ERA_FACTORS = Object.freeze({
  pre_qin: { material_evidence: 1.8, source_nature: 0.7, style_format: 1.2, corroboration: 1.1 },
  medieval: { material_evidence: 1.2, source_nature: 0.9 },
  early_modern: { source_nature: 1.2, material_evidence: 1.1 },
  contemporary: { source_nature: 1.1, bias_presentism: 1.4, corroboration: 1.1 },
  unknown: {},
})

export const ERA_VALUES = ['pre_qin', 'medieval', 'early_modern', 'contemporary', 'unknown']

/**
 * Normalize per-era weights back to a total of 100 with one-decimal precision.
 * @param {string} era one of {@link ERA_VALUES}
 * @returns {Record<string, number>} effective weight per criterion id
 */
export function eraWeights(era) {
  const factors = ERA_FACTORS[era] || {}
  const scaled = CRITERIA.map(criterion => {
    const weight = criterion.weight * (factors[criterion.id] ?? 1)
    return { id: criterion.id, weight }
  })
  const total = scaled.reduce((sum, entry) => sum + entry.weight, 0)
  const normalized = scaled.map(entry => ({
    id: entry.id,
    weight: Math.round((entry.weight / total) * 1000) / 10,
  }))
  const sum = normalized.reduce((acc, entry) => acc + entry.weight, 0)
  const drift = Math.round((100 - sum) * 10) / 10
  if (drift !== 0) {
    let largest = normalized[0]
    for (const entry of normalized) if (entry.weight > largest.weight) largest = entry
    largest.weight = Math.round((largest.weight + drift) * 10) / 10
  }
  return Object.fromEntries(normalized.map(entry => [entry.id, entry.weight]))
}

export const BASE_CAVEATS = Object.freeze([
  '分值是十二项判断的启发式汇总，不是客观真值；单条硬规则即可改变等级。',
  '不自动认可权威：官修史书、名家名作同样可能有误。',
  '怀疑但不否认：存疑不等于伪造，证据不足不等于虚构。',
  '不使用现代道德观念倒推古人；注意胜利者书写、幸存者书写与统计口径变化。',
  '孤证不立：没有独立佐证时，不作定论。',
  '政权或官方背书不作为可信度标准；可信度来自史料本身的内外考证与整理质量。',
])
