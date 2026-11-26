/**
 * Optional enrichment for history-source-audit v3:
 * - LLM context review of literal scan hits (removes obvious false positives),
 *   with a few-shot prompt and a tolerant JSON parser.
 * - Web full-text lookup that can catch a dropped evaluative lead-in such as
 *   「太史公曰：」. It is warning-only and never changes the score.
 *
 * Both steps are opt-in per call and degrade to a note when the service or a
 * model route is unavailable.
 */

import { EVALUATION_MARKERS, scanHits } from './scan.js'
import { emptyLookup, emptyScanReview } from './assess.js'

/** Resolve the session's current model route from the live Agent, when exposed. */
export function getRoute(exec) {
  const agent = exec && exec.agent
  try {
    if (agent && agent.model && typeof agent.model.current === 'function') {
      const selection = agent.model.current()
      if (selection && selection.provider && selection.model) {
        return { provider: selection.provider, model: selection.model }
      }
    }
    if (agent && agent.session && typeof agent.session.requestHeader === 'function') {
      const header = agent.session.requestHeader()
      const config = header && header.config
      if (config && config.provider && config.model) {
        return { provider: config.provider, model: config.model }
      }
    }
  } catch {
    // A slim Agent or an absent session simply disables enrichment.
  }
  return undefined
}

function lineText(value, max) {
  const text = String(value ?? '').replace(/\s+/g, ' ').trim()
  return text.length > max ? `${text.slice(0, max)}…` : text
}

function extractJson(text) {
  if (!text) return undefined
  let cleaned = String(text).trim()
  cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '').trim()
  const objectStart = cleaned.indexOf('{')
  const arrayStart = cleaned.indexOf('[')
  const candidates = []
  const pushObject = () => {
    const end = cleaned.lastIndexOf('}')
    if (objectStart >= 0 && end > objectStart) candidates.push(cleaned.slice(objectStart, end + 1))
  }
  const pushArray = () => {
    const end = cleaned.lastIndexOf(']')
    if (arrayStart >= 0 && end > arrayStart) candidates.push(cleaned.slice(arrayStart, end + 1))
  }
  if (arrayStart >= 0 && (objectStart < 0 || arrayStart < objectStart)) {
    pushArray()
    pushObject()
  } else {
    pushObject()
    pushArray()
  }
  for (const candidate of candidates) {
    try {
      return JSON.parse(candidate)
    } catch {
      // Try the next candidate.
    }
  }
  return undefined
}

/* ------------------------------------------------------------------ */
/* LLM context review                                                  */
/* ------------------------------------------------------------------ */

/**
 * Ask the current model whether each literal scan hit is a context false
 * positive. Never throws; a failure returns an unavailable review with a note.
 */
export async function reviewScanWithLlm(scan, excerpt, exec, llm) {
  const hits = scanHits(scan)
  if (hits.length === 0) {
    return { ...emptyScanReview(), available: true, note: '没有可复核的字面标记。' }
  }
  const route = getRoute(exec)
  if (!llm || !route) {
    return { ...emptyScanReview(), note: '无法确定当前模型路由，跳过 LLM 语境复核。' }
  }
  const limited = hits.slice(0, 12)
  const prompt = [
    '你是史料校勘助手。下面给出史料原文（可能截断）和从原文中按字面匹配到的标记词。',
    '请判断每个标记词在当前语境中是否真的属于它被归入的类别，还是语境误报。',
    '',
    '类别：',
    '- evaluation：评价/论断标记（如「太史公曰」「论曰」）',
    '- hearsay：传闻/转述标记（如「闻之」「或曰」「相传」）',
    '- omen：神异/灾异语汇（如「梦」「龙」「灾异」）',
    '- hyperbole：夸张/绝对化语汇（如「莫不」「百万」「血流成河」）',
    '- numeric：数量/规模表述',
    '',
    '原文：',
    lineText(excerpt, 1800),
    '',
    '待复核：',
    JSON.stringify(limited),
    '',
    '示例：',
    '原文：王戎云：“太尉神姿高彻。”或曰：“见之若神仙。”',
    '待复核：[{"term":"神","category":"omen"},{"term":"或曰","category":"hearsay"}]',
    '示例输出：{"results":[{"term":"神","category":"omen","falsePositive":true,"reason":"神姿/神仙指风姿与比喻，不是神异"},{"term":"或曰","category":"hearsay","falsePositive":false,"reason":"确为传闻引述"}]}',
    '',
    '只输出上面这种 JSON 对象，不要 Markdown 代码块，不要任何解释或前后缀。',
  ].join('\n')

  let text = ''
  let failure = ''
  try {
    for await (const chunk of llm.stream({
      provider: route.provider,
      model: route.model,
      system: '你是史料校勘助手，只输出 JSON。',
      messages: [{ role: 'user', content: [{ type: 'text', text: prompt }] }],
      maxTokens: 600,
      ...(exec && exec.signal ? { signal: exec.signal } : {}),
    })) {
      if (chunk.type === 'text-delta') text += chunk.text
      else if (chunk.type === 'finish' && chunk.reason && chunk.reason.kind === 'error') {
        failure = chunk.reason.failure && chunk.reason.failure.message
          ? chunk.reason.failure.message
          : '模型调用失败'
      }
    }
  } catch (error) {
    failure = String((error && error.message) || error)
  }
  const model = `${route.provider}/${route.model}`
  if (failure) return { ...emptyScanReview(), model, note: `LLM 语境复核失败：${failure}` }

  const parsed = extractJson(text)
  const results = Array.isArray(parsed) ? parsed : (parsed && Array.isArray(parsed.results) ? parsed.results : [])
  if (results.length === 0) {
    return { ...emptyScanReview(), model, note: `LLM 未返回可解析结果：${lineText(text, 120)}` }
  }
  const falsePositives = []
  const kept = []
  for (const result of results) {
    const term = String((result && result.term) || '')
    if (!term) continue
    if (result.falsePositive === true) falsePositives.push({ term, reason: String(result.reason || '') })
    else kept.push(term)
  }
  return { available: true, model, checked: limited.length, falsePositives, kept, note: '' }
}

/* ------------------------------------------------------------------ */
/* Web full-text lookup                                                */
/* ------------------------------------------------------------------ */

/**
 * Extract a distinctive CJK phrase from the excerpt for a quoted search.
 * @param {string} excerpt
 * @returns {string}
 */
export function distinctivePhrase(excerpt) {
  const text = String(excerpt || '').replace(/[\s\p{P}]/gu, '')
  const runs = text.match(/[\u4e00-\u9fa5]{6,}/g) || []
  if (runs.length === 0) return text.slice(0, 16)
  runs.sort((a, b) => b.length - a.length)
  return runs[0].slice(0, 16)
}

function domainOf(url) {
  try {
    return new URL(url).hostname
  } catch {
    return ''
  }
}

/** Strip whitespace and punctuation so a phrase can match across typesetting. */
function normalizeForMatch(text) {
  return String(text || '').replace(/[\s\p{P}]/gu, '')
}

function withTimeout(signal, ms) {
  const timeout = AbortSignal.timeout(ms)
  if (!signal) return timeout
  if (typeof AbortSignal.any === 'function') return AbortSignal.any([signal, timeout])
  return timeout
}

function stripHtml(html) {
  return String(html || '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, ' ')
}

/**
 * Search the web for the excerpt and try to confirm it in a full text.
 * Never throws; failures return `ok: false` with a note.
 */
export async function lookupText(args, exec, web) {
  const base = emptyLookup()
  base.attempted = true
  if (!web) {
    base.note = '当前 profile 没有可用的 web 服务，跳过网络校验。'
    return base
  }
  const phrase = distinctivePhrase(args.excerpt)
  base.phrase = phrase
  if (!phrase || phrase.length < 4) {
    base.note = '片段过短，无法提取检索短语。'
    return base
  }
  const query = `"${args.source}" "${phrase}"`
  base.query = query
  const route = getRoute(exec)
  const signal = withTimeout(exec && exec.signal, 15000)

  let search
  try {
    search = await web.search({
      query,
      maxResults: 5,
      ...(route ? { llmProvider: route.provider } : {}),
    }, signal)
  } catch (error) {
    base.note = `检索失败：${String((error && error.message) || error)}`
    return base
  }

  const hits = (search.sources || []).map(source => {
    const snippet = stripHtml([source.snippet, source.summary].filter(Boolean).join(' '))
    const normalizedSnippet = normalizeForMatch(snippet)
    const atSnippet = normalizedSnippet.indexOf(phrase)
    return {
      title: stripHtml(source.title || ''),
      url: source.url,
      domain: domainOf(source.url),
      snippet,
      phraseFound: atSnippet >= 0,
      fetched: false,
      contextBefore: atSnippet >= 0 ? normalizedSnippet.slice(Math.max(0, atSnippet - 120), atSnippet) : '',
      fetchError: '',
    }
  })

  await Promise.allSettled(hits.slice(0, 5).map(async hit => {
    try {
      const result = await web.fetch({ url: hit.url }, signal)
      const text = result.body.kind === 'text' ? result.body.content : stripHtml(result.body.content)
      hit.fetched = true
      const normalized = normalizeForMatch(text)
      const at = normalized.indexOf(phrase)
      if (at >= 0) {
        hit.phraseFound = true
        hit.contextBefore = normalized.slice(Math.max(0, at - 120), at)
      }
    } catch (error) {
      hit.fetchError = String((error && error.message) || error)
    }
  }))

  const foundHits = hits.filter(hit => hit.phraseFound)

  // The provider's synthesized answer may quote the phrase with more context
  // than a result snippet or a truncated page fetch.
  const answerText = normalizeForMatch(search.content || '')
  const answerAt = answerText.indexOf(phrase)
  const answerContext = answerAt >= 0 ? answerText.slice(Math.max(0, answerAt - 120), answerAt) : ''

  const warnings = []
  if (foundHits.length === 0) {
    warnings.push('未检索到该表述的原文；这只说明本次检索未命中，不能据此判为伪。')
  }
  const contexts = foundHits.map(hit => hit.contextBefore)
  if (answerContext) contexts.push(answerContext)
  for (const context of contexts) {
    for (const marker of EVALUATION_MARKERS) {
      if (context.includes(marker) && !String(args.excerpt || '').includes(marker)) {
        warnings.push(`网络原文在「${phrase}」前含评价性引语「${marker}」，你提供的片段未包含；这可能把论赞误作事实，建议复核 fact_vs_evaluation。`)
        break
      }
    }
  }

  return {
    attempted: true,
    ok: true,
    phrase,
    query,
    hits,
    phraseFound: foundHits.length > 0,
    warnings: [...new Set(warnings)],
    note: '网络校验只作警示，不计分：它只证明某表述在某个网页出现，不证明网页权威或文本无误。',
  }
}
