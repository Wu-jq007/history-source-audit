/**
 * @local/history-source-audit — Host half (v3).
 *
 * Registers the model-facing `history_source_audit` tool. v3 adds:
 * - hard-rule exemptions (`criteria[].override`) that require a written reason;
 * - era-aware weighting (`era_type`);
 * - a bounded critical-edition bonus (`edition`); political or regime
 *   endorsement is deliberately not a category;
 * - optional LLM context review of literal scan hits (`context_review`);
 * - optional, warning-only web full-text lookup (`lookup`) that can catch a
 *   dropped evaluative lead-in such as 「太史公曰：」 without changing the score.
 *
 * The score remains a heuristic summary, never a claim of objective truth.
 */

import { ERA_VALUES, EDITION_VALUES, OVERRIDE_RULES } from './src/rubric.js'
import { scanExcerpt } from './src/scan.js'
import { assess, render } from './src/assess.js'
import { reviewScanWithLlm, lookupText } from './src/enrich.js'

export const name = 'history-source-audit'
export const inject = ['tools']

/* ------------------------------------------------------------------ */
/* Tool schema                                                         */
/* ------------------------------------------------------------------ */

const CRITERION_IDS = [
  'source_nature', 'corroboration', 'material_evidence', 'author_stance',
  'time_space_distance', 'style_format', 'provenance_layers', 'logical_coherence',
  'fact_vs_evaluation', 'literary_embellishment', 'bias_presentism', 'counter_evidence',
]

const VERDICT_VALUES = ['support', 'partial', 'neutral', 'weaken', 'unknown']

const OVERRIDE_RULE_IDS = Object.keys(OVERRIDE_RULES)

const DESCRIPTION = [
  '按固定十三项准则审查一条文字史料（或其中一段记载）的可靠性，输出可复现的分级、风险、反证与待查疑问（v3）。',
  '十二项计分：史料性质、多源佐证、实物证据、书写者立场、时空距离、文体格式、史料层数、逻辑完整性、事实与评价、文学修饰、胜利者/幸存者/统计口径/现代观念、反证检索；第十三项为态度规则（怀疑但不否认、不自动认可权威）。',
  '新增：era_type 按时代调整权重（先秦提升实物史料、降低传世文献公信力）；edition 区分权威学术整理版（peer-reviewed，+2）、无整理（none，0）、不明（unknown，0），政权或官方背书不参与评分；criteria[].override 可豁免硬规则，但必须写 override.reason；context_review:"llm" 让当前模型复核字面扫描的语境误报；lookup:"auto" 联网查找原文、检测片段是否漏掉「太史公曰」等关键引语，只作警示、不计分。',
  '把每项判断作为 criteria 传入（support/partial/neutral/weaken/unknown）；不传 criteria 则返回待填框架。',
  '分值是启发式汇总；「孤证不立」「反证优先」等硬规则会直接压低等级，豁免理由不被工具核验。',
].join('')

const CRITERIA_PARAM_DESCRIPTION = [
  '逐条判断，每个准则最多一项；缺项按 unknown 处理。criterion 含义：',
  'source_nature 史料性质（官修或公认私修=支持，非官修且无公认=削弱）；',
  'corroboration 多源独立佐证（有独立佐证=支持，孤证或同源转抄=削弱）；',
  'material_evidence 实物史料（有实物=支持，实物矛盾=削弱，无实物记 neutral）；',
  'author_stance 书写者立场（中立=支持，敌对或利益相关=削弱）；',
  'time_space_distance 时空距离（同时代近距=支持，久远且遥远=削弱）；',
  'style_format 文体格式（与同期一致=支持，晚出词汇或体例=削弱）；',
  'provenance_layers 史料层数（亲历=支持，多层转述=削弱）；',
  'logical_coherence 逻辑完整性（一致=支持，矛盾=削弱）；',
  'fact_vs_evaluation 事实与评价（以事实为主=支持，论赞被当事实=削弱）；',
  'literary_embellishment 文学修饰（平实=支持，明显加工=削弱）；',
  'bias_presentism 胜利者/幸存者/统计口径/现代观念（已校正=支持，明显偏差=削弱）；',
  'counter_evidence 反证检索（已检索且反证弱=支持，有反证或未检索=削弱）。',
  'override 用于豁免硬规则：rule 取 corroboration_cap、counter_evidence_cap、author_stance、time_space_distance、provenance_layers、bias_presentism、logical_coherence、source_nature；reason 必填且要写明依据（如「此为出土汉简原件，物理载体已证其真」），最多 3 项，工具不核验理由。',
].join('')

const CRITERIA_ITEM_SCHEMA = {
  type: 'object',
  additionalProperties: true,
  required: ['criterion', 'verdict'],
  properties: {
    criterion: {
      type: 'string',
      enum: CRITERION_IDS,
      description: '准则 id。',
    },
    verdict: {
      type: 'string',
      enum: VERDICT_VALUES,
      description: '该条对可信度的影响：support=显著提升，partial=有限提升，neutral=不适用或持平，weaken=明显降低，unknown=未核查。',
    },
    note: {
      type: 'string',
      description: '该条的证据或理由，一两句话即可；会进入报告的备注列。',
    },
    override: {
      type: 'object',
      additionalProperties: false,
      required: ['rule', 'reason'],
      description: '豁免一项硬规则。reason 必填；工具不核验理由是否成立。',
      properties: {
        rule: {
          type: 'string',
          enum: OVERRIDE_RULE_IDS,
          description: '要豁免的硬规则。',
        },
        reason: {
          type: 'string',
          description: '豁免理由，例如「此为出土汉简原件，物理载体已证其真」。',
        },
      },
    },
  },
}

const TOOL_PARAMETERS = {
  type: 'object',
  properties: {
    source: {
      type: 'string',
      description: '史料名称，例如《史记·项羽本纪》、某份档案或方志；会显示在报告标题。',
    },
    excerpt: {
      type: 'string',
      description: '要审查的原文或关键段落；可省略。提供后会做字面标记扫描，并可供 context_review / lookup 使用。',
    },
    era_type: {
      type: 'string',
      enum: ERA_VALUES,
      description: '时代类型：pre_qin=先秦，medieval=中古，early_modern=近代，contemporary=当代，unknown=不明。会按时代调整各项权重（先秦/考古相关提高实物史料权重、降低传世文献公信力权重）。',
    },
    edition: {
      type: 'string',
      enum: EDITION_VALUES,
      description: '整理本性质：peer-reviewed=权威学术整理版（点校/校注/同行评议），none=无学术整理，unknown=不明。仅微调 source_nature（peer-reviewed +2）。政权或官方背书不是评分项。',
    },
    context_review: {
      type: 'string',
      enum: ['off', 'llm'],
      description: '字面扫描的语境复核：off=仅正则匹配（默认）；llm=让当前模型判断命中词是否为语境误报。可能增加一次模型调用与延迟。',
    },
    lookup: {
      type: 'string',
      enum: ['off', 'auto'],
      description: '网络原文校验：off=不联网（默认）；auto=检索原文、确认表述是否存在，并检测片段是否漏掉「太史公曰」等评价性引语。可能增加网络请求与延迟。',
    },
    debug: {
      type: 'boolean',
      description: '输出调试信息：在结果中附加 diagnostics，并把计时、网络、LLM 状态写到 Host 的 stderr 日志。默认 false。',
    },
    lang: {
      type: 'string',
      enum: ['zh', 'en'],
      description: '校验错误的语言（zh 中文，en English）。报告正文目前仍为中文。默认 zh。',
    },
    criteria: {
      type: 'array',
      description: `${CRITERIA_PARAM_DESCRIPTION}`,
      items: CRITERIA_ITEM_SCHEMA,
    },
  },
  required: ['source'],
}

/* ------------------------------------------------------------------ */
/* Output schema                                                       */
/* ------------------------------------------------------------------ */

const MARKER_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['term', 'count'],
  properties: {
    term: { type: 'string' },
    count: { type: 'integer' },
  },
}

const SCAN_KEYS = ['available', 'evaluation', 'hearsay', 'omen', 'hyperbole', 'numeric']

const SCAN_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: SCAN_KEYS,
  properties: {
    available: { type: 'boolean' },
    evaluation: { type: 'array', items: MARKER_SCHEMA },
    hearsay: { type: 'array', items: MARKER_SCHEMA },
    omen: { type: 'array', items: MARKER_SCHEMA },
    hyperbole: { type: 'array', items: MARKER_SCHEMA },
    numeric: { type: 'array', items: MARKER_SCHEMA },
  },
}

const SCAN_REVIEW_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['available', 'model', 'checked', 'falsePositives', 'kept', 'note'],
  properties: {
    available: { type: 'boolean' },
    model: { type: 'string' },
    checked: { type: 'integer' },
    falsePositives: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['term', 'reason'],
        properties: {
          term: { type: 'string' },
          reason: { type: 'string' },
        },
      },
    },
    kept: { type: 'array', items: { type: 'string' } },
    note: { type: 'string' },
  },
}

const LOOKUP_HIT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['title', 'url', 'domain', 'snippet', 'phraseFound', 'fetched', 'contextBefore', 'fetchError'],
  properties: {
    title: { type: 'string' },
    url: { type: 'string' },
    domain: { type: 'string' },
    snippet: { type: 'string' },
    phraseFound: { type: 'boolean' },
    fetched: { type: 'boolean' },
    contextBefore: { type: 'string' },
    fetchError: { type: 'string' },
  },
}

const LOOKUP_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['attempted', 'ok', 'phrase', 'query', 'hits', 'phraseFound', 'warnings', 'note'],
  properties: {
    attempted: { type: 'boolean' },
    ok: { type: 'boolean' },
    phrase: { type: 'string' },
    query: { type: 'string' },
    hits: { type: 'array', items: LOOKUP_HIT_SCHEMA },
    phraseFound: { type: 'boolean' },
    warnings: { type: 'array', items: { type: 'string' } },
    note: { type: 'string' },
  },
}

const OUTPUT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: [
    'tool', 'mode', 'source', 'excerpt', 'eraType', 'eraLabel', 'edition', 'editionLabel',
    'score', 'scoreTier', 'tier', 'provisional', 'assessed', 'total',
    'items', 'rules', 'overrides', 'eraChanges',
    'strengths', 'risks', 'counterEvidence', 'questions', 'counterfactuals',
    'scan', 'scanReview', 'lookup', 'caveats', 'diagnostics', 'markdown',
  ],
  properties: {
    tool: { type: 'string' },
    mode: { type: 'string', enum: ['rubric', 'report'] },
    source: { type: 'string' },
    excerpt: { type: 'string' },
    eraType: { type: 'string' },
    eraLabel: { type: 'string' },
    edition: { type: 'string' },
    editionLabel: { type: 'string' },
    score: { type: 'number' },
    scoreTier: { type: 'string' },
    tier: { type: 'string' },
    provisional: { type: 'boolean' },
    assessed: { type: 'integer' },
    total: { type: 'integer' },
    items: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['id', 'index', 'label', 'baseWeight', 'weight', 'verdict', 'verdictLabel', 'points', 'note'],
        properties: {
          id: { type: 'string' },
          index: { type: 'integer' },
          label: { type: 'string' },
          baseWeight: { type: 'number' },
          weight: { type: 'number' },
          verdict: { type: 'string' },
          verdictLabel: { type: 'string' },
          points: { type: 'number' },
          note: { type: 'string' },
        },
      },
    },
    rules: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['id', 'effect', 'reason'],
        properties: {
          id: { type: 'string' },
          effect: { type: 'string' },
          reason: { type: 'string' },
        },
      },
    },
    overrides: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['criterion', 'rule', 'reason', 'verified'],
        properties: {
          criterion: { type: 'string' },
          rule: { type: 'string' },
          reason: { type: 'string' },
          verified: { type: 'boolean' },
        },
      },
    },
    eraChanges: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['id', 'label', 'baseWeight', 'weight'],
        properties: {
          id: { type: 'string' },
          label: { type: 'string' },
          baseWeight: { type: 'number' },
          weight: { type: 'number' },
        },
      },
    },
    strengths: { type: 'array', items: { type: 'string' } },
    risks: { type: 'array', items: { type: 'string' } },
    counterEvidence: { type: 'array', items: { type: 'string' } },
    questions: { type: 'array', items: { type: 'string' } },
    counterfactuals: { type: 'array', items: { type: 'string' } },
    scan: SCAN_SCHEMA,
    scanReview: SCAN_REVIEW_SCHEMA,
    lookup: LOOKUP_SCHEMA,
    caveats: { type: 'array', items: { type: 'string' } },
    diagnostics: { type: 'array', items: { type: 'string' } },
    markdown: { type: 'string' },
  },
}

/* ------------------------------------------------------------------ */
/* Plugin entry                                                        */
/* ------------------------------------------------------------------ */

export function apply(ctx) {
  const TOOL = {
    name: 'history_source_audit',
    description: DESCRIPTION,
    parameters: TOOL_PARAMETERS,
    timeoutMs: 120000,
    output: {
      schema: OUTPUT_SCHEMA,
      render(_args, value) {
        return [{ type: 'text', text: String((value && value.markdown) || '') }]
      },
    },
    async execute(args, exec) {
      const debug = args.debug === true
      const diagnostics = []
      const log = line => {
        if (!debug) return
        diagnostics.push(line)
        console.error(`[history-source-audit] ${line}`)
      }
      const startedAt = Date.now()
      log(`start source=${String(args.source || '')} era=${args.era_type || 'unknown'} edition=${args.edition || 'unknown'}`)
      const scan = scanExcerpt(typeof args.excerpt === 'string' ? args.excerpt : '')
      const markerKinds = ['evaluation', 'hearsay', 'omen', 'hyperbole', 'numeric']
        .reduce((count, key) => count + (scan[key] ? scan[key].length : 0), 0)
      log(`scan available=${scan.available} markerKinds=${markerKinds}`)
      let scanReview
      let lookup
      if (args.context_review === 'llm') {
        const t0 = Date.now()
        const llm = ctx.get('llm')
        scanReview = await reviewScanWithLlm(scan, args.excerpt || '', exec, llm)
        log(`context_review available=${scanReview.available} checked=${scanReview.checked} elapsed=${Date.now() - t0}ms${scanReview.note ? ` note=${scanReview.note}` : ''}`)
      }
      if (args.lookup === 'auto') {
        const t0 = Date.now()
        const web = ctx.get('web')
        lookup = await lookupText(args, exec, web)
        log(`lookup attempted=${lookup.attempted} ok=${lookup.ok} phraseFound=${lookup.phraseFound} elapsed=${Date.now() - t0}ms${lookup.note ? ` note=${lookup.note}` : ''}`)
      }
      const data = assess(args, { scan, scanReview, lookup })
      data.diagnostics = diagnostics
      log(`assess mode=${data.mode} score=${data.score} tier=${data.tier} elapsed=${Date.now() - startedAt}ms`)
      return render(data)
    },
    presentCall(args) {
      if (!args || typeof args !== 'object') return undefined
      const source = typeof args.source === 'string' && args.source.trim() ? args.source.trim() : '未命名史料'
      const count = Array.isArray(args.criteria) ? args.criteria.length : 0
      const extras = [
        args.era_type && args.era_type !== 'unknown' ? '时代' : '',
        args.context_review === 'llm' ? '语境' : '',
        args.lookup === 'auto' ? '联网' : '',
      ].filter(Boolean).join('·')
      return {
        card: 'generic',
        title: `史料可靠性审查：${source}${extras ? `（${extras}）` : ''}`,
        kind: 'other',
        rawInput: { source, criteria: count, era_type: args.era_type, context_review: args.context_review, lookup: args.lookup },
      }
    },
  }

  ctx.effect(() => ctx.tools.register(TOOL))
}
