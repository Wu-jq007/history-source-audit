/**
 * Literal marker scan for history-source-audit v3. The scan is advisory only:
 * its hits never feed the score. `enrich.js` can ask an LLM to remove context
 * false positives after the fact.
 */

export const MARKERS = Object.freeze({
  evaluation: ['太史公曰', '論曰', '论曰', '赞曰', '贊曰', '评曰', '評曰', '史臣曰', '君子曰', '臣光曰', '呜呼', '烏呼'],
  hearsay: ['闻之', '聞之', '或曰', '或谓', '或謂', '相传', '相傳', '世传', '世傳', '传言', '傳言', '谚曰', '諺曰', '语曰', '語曰', '童谣', '童謠', '民歌', '里语', '里語', '故老相传', '故老相傳'],
  omen: ['梦', '夢', '神', '鬼', '龙', '龍', '祥', '灾', '災', '异', '異', '卜筮', '巫', '赤帝', '大蛇', '白帝', '符命', '图谶', '圖讖'],
  hyperbole: ['莫不', '百万', '百萬', '千里', '血流成河', '三日三夜', '一以当十', '一以當十', '所向披靡', '闻风丧胆', '聞風喪膽', '倾国', '傾國'],
})

export const SCAN_LABELS = Object.freeze({
  evaluation: '评价/论断标记',
  hearsay: '传闻/转述标记',
  omen: '神异/灾异语汇',
  hyperbole: '夸张/绝对化语汇',
  numeric: '数量/规模表述',
})

export const EVALUATION_MARKERS = Object.freeze([
  '太史公曰', '論曰', '论曰', '赞曰', '贊曰', '评曰', '評曰', '史臣曰', '臣光曰', '君子曰',
])

/**
 * Bigram/trigram exclusions for ambiguous single-character markers. An
 * occurrence inside one of these phrases is not counted, which raises
 * precision without waiting for an LLM context review.
 */
export const MARKER_EXCLUSIONS = Object.freeze({
  '神': ['神宗', '神农', '神禹', '神武', '神气', '神姿', '神色', '神道', '神交', '神会', '神明'],
  '龙': ['龙且', '龙椅', '龙颜', '龙床', '龙门', '龙城', '龙泉', '龙图'],
  '异': ['异姓', '异族', '异域', '异人', '异才', '异常'],
  '梦': ['梦想', '梦寐'],
  '鬼': ['鬼方'],
  '祥': ['吉祥'],
  '巫': ['巫医'],
})

/**
 * Count one term's occurrences, skipping occurrences covered by an exclusion
 * phrase (for example 「神」 inside 「神宗」).
 */
function countTerm(text, term, exclusions) {
  let count = 0
  let from = 0
  while (true) {
    const at = text.indexOf(term, from)
    if (at === -1) break
    from = at + term.length
    const excluded = exclusions.some(phrase => {
      const offset = phrase.indexOf(term)
      return offset >= 0 && at - offset >= 0 && text.startsWith(phrase, at - offset)
    })
    if (excluded) continue
    count += 1
  }
  return count
}

/**
 * Count literal term occurrences in order of frequency.
 * @param {string} text source text
 * @param {readonly string[]} terms literals to count
 * @param {number} limit maximum entries to return
 */
export function countTerms(text, terms, limit = 6) {
  const found = []
  for (const term of terms) {
    const count = countTerm(text, term, MARKER_EXCLUSIONS[term] || [])
    if (count > 0) found.push({ term, count })
  }
  found.sort((a, b) => b.count - a.count || a.term.localeCompare(b.term))
  return found.slice(0, limit)
}

/** Extract numeric / scale expressions as a soft statistical-scope hint. */
export function countNumeric(text, limit = 6) {
  const counts = new Map()
  const re = /[0-9０-９]+[万千百十]?|[一二三四五六七八九十百千万亿]+(?:万|千|百|亿)/g
  for (const match of text.matchAll(re)) {
    const term = match[0]
    counts.set(term, (counts.get(term) ?? 0) + 1)
  }
  return [...counts.entries()]
    .map(([term, count]) => ({ term, count }))
    .sort((a, b) => b.count - a.count || a.term.localeCompare(b.term))
    .slice(0, limit)
}

/** Scan the excerpt for literal hints. The scan never feeds the score. */
export function scanExcerpt(text) {
  if (!text) {
    return { available: false, evaluation: [], hearsay: [], omen: [], hyperbole: [], numeric: [] }
  }
  return {
    available: true,
    evaluation: countTerms(text, MARKERS.evaluation),
    hearsay: countTerms(text, MARKERS.hearsay),
    omen: countTerms(text, MARKERS.omen),
    hyperbole: countTerms(text, MARKERS.hyperbole),
    numeric: countNumeric(text),
  }
}

/** Flatten scan hits into reviewable entries. */
export function scanHits(scan) {
  const hits = []
  for (const category of ['evaluation', 'hearsay', 'omen', 'hyperbole', 'numeric']) {
    for (const hit of scan[category] || []) hits.push({ category, term: hit.term })
  }
  return hits
}
