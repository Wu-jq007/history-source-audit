import { describe, it, expect } from 'vitest'
import { distinctivePhrase, lookupText, reviewScanWithLlm } from '../src/enrich.js'
import { scanExcerpt } from '../src/scan.js'

const mockExec = {
  agent: {
    model: {
      current: () => ({ provider: 'test', model: 'mock' }),
    },
  },
}

describe('distinctivePhrase', () => {
  it('extracts the longest CJK run without punctuation', () => {
    expect(distinctivePhrase('夫神农以前，吾不知已。')).toBe('夫神农以前吾不知已')
  })
})

describe('reviewScanWithLlm', () => {
  it('parses a fenced JSON response', async () => {
    const scan = scanExcerpt('有神降于莘。')
    const llm = {
      async *stream() {
        yield {
          type: 'text-delta',
          text: '```json\n{"results":[{"term":"神","category":"omen","falsePositive":true,"reason":"语境误报"}]}\n```',
        }
      },
    }
    const review = await reviewScanWithLlm(scan, '有神降于莘。', mockExec, llm)
    expect(review.available).toBe(true)
    expect(review.falsePositives).toEqual([{ term: '神', reason: '语境误报' }])
  })

  it('accepts a top-level JSON array', async () => {
    const scan = scanExcerpt('有神降于莘。')
    const llm = {
      async *stream() {
        yield { type: 'text-delta', text: '[{"term":"神","falsePositive":false,"reason":"确为神异"}]' }
      },
    }
    const review = await reviewScanWithLlm(scan, '有神降于莘。', mockExec, llm)
    expect(review.available).toBe(true)
    expect(review.kept).toContain('神')
  })
})

describe('lookupText', () => {
  it('detects an omitted 太史公曰 lead-in and returns no score field', async () => {
    const web = {
      async search() {
        return {
          sources: [{ url: 'https://example.com/text', title: 't', snippet: '太史公曰：夫神农以前' }],
        }
      },
      async fetch() {
        return {
          url: 'https://example.com/text',
          statusCode: 200,
          body: { kind: 'text', content: '太史公曰：夫神农以前，吾不知已。' },
          truncated: false,
        }
      },
    }
    const result = await lookupText({ source: '《史记》', excerpt: '夫神农以前，吾不知已。' }, mockExec, web)
    expect(result.ok).toBe(true)
    expect(result.phraseFound).toBe(true)
    expect(result.warnings.join('')).toContain('太史公曰')
    expect('adjustment' in result).toBe(false)
  })
})
