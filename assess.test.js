import { describe, it, expect } from 'vitest'
import { buildReport, assess, render } from '../src/assess.js'
import { CRITERIA } from '../src/rubric.js'

const ids = CRITERIA.map(criterion => criterion.id)
const supportAll = ids.map(criterion => ({ criterion, verdict: 'support' }))

describe('scoring', () => {
  it('gives 100 when every criterion is supported and no edition bonus', () => {
    const report = buildReport({ source: 'x', criteria: supportAll })
    expect(report.score).toBe(100)
    expect(report.tier).toBe('高')
  })

  it('computes the documented mixed score 8 + 0 + 37 = 45', () => {
    const criteria = [
      { criterion: 'source_nature', verdict: 'support' },
      { criterion: 'corroboration', verdict: 'weaken' },
      ...ids
        .filter(id => id !== 'source_nature' && id !== 'corroboration')
        .map(id => ({ criterion: id, verdict: 'neutral' })),
    ]
    const report = buildReport({ source: 'x', criteria })
    expect(report.score).toBe(45)
    expect(report.scoreTier).toBe('较低')
    expect(report.tier).toBe('较低')
  })

  it('adds +2 for a peer-reviewed edition and nothing for none', () => {
    const criteria = [{ criterion: 'source_nature', verdict: 'neutral' }]
    const peer = buildReport({ source: 'x', edition: 'peer-reviewed', criteria })
    const none = buildReport({ source: 'x', edition: 'none', criteria })
    expect(peer.score - none.score).toBe(2)
    expect(peer.rules.some(rule => rule.id === 'edition' && rule.effect === '+2')).toBe(true)
    expect(none.rules.some(rule => rule.id === 'edition')).toBe(false)
  })
})

describe('exemptions', () => {
  const withOverride = reason => buildReport({
    source: 'x',
    criteria: [
      { criterion: 'corroboration', verdict: 'weaken', override: { rule: 'corroboration_cap', reason } },
      ...ids
        .filter(id => id !== 'corroboration')
        .map(id => ({ criterion: id, verdict: 'support' })),
    ],
  })

  it('exempts the uncorroborated-claim cap only with a reason', () => {
    const report = withOverride('出土汉简原件，物理载体已证其真')
    expect(report.tier).toBe('高')
    expect(report.overrides).toHaveLength(1)
    expect(report.rules.some(rule => rule.id === 'corroboration' && rule.effect === '豁免')).toBe(true)
  })

  it('throws when an exemption has no reason', () => {
    expect(() => withOverride('   ')).toThrow(/override\.reason/)
  })

  it('throws for an unknown rule', () => {
    expect(() => buildReport({
      source: 'x',
      criteria: [{ criterion: 'corroboration', verdict: 'weaken', override: { rule: 'nope', reason: 'r' } }],
    })).toThrow(/override\.rule/)
  })

  it('throws when the rule is attached to the wrong criterion', () => {
    expect(() => buildReport({
      source: 'x',
      criteria: [{ criterion: 'author_stance', verdict: 'weaken', override: { rule: 'corroboration_cap', reason: 'r' } }],
    })).toThrow(/corroboration/)
  })

  it('localizes the missing-reason error to English when lang is en', () => {
    expect(() => buildReport({
      source: 'x',
      lang: 'en',
      criteria: [{ criterion: 'corroboration', verdict: 'weaken', override: { rule: 'corroboration_cap', reason: '' } }],
    })).toThrow(/requires a non-empty override\.reason/)
  })
})

describe('lookup is warning-only', () => {
  it('does not change the score and adds no lookup rule', () => {
    const input = { source: 'x', criteria: [{ criterion: 'source_nature', verdict: 'neutral' }] }
    const base = buildReport(input)
    const enriched = render(assess(input, {
      lookup: {
        attempted: true,
        ok: true,
        phrase: 'x',
        query: 'q',
        hits: [{
          title: 't',
          url: 'https://example.com',
          domain: 'example.com',
          snippet: 's',
          phraseFound: true,
          fetched: true,
          contextBefore: '太史公曰',
          fetchError: '',
        }],
        phraseFound: true,
        warnings: ['warning'],
        note: 'note',
      },
    }))
    expect(enriched.score).toBe(base.score)
    expect(enriched.rules.some(rule => rule.id === 'lookup')).toBe(false)
  })
})

describe('diagnostics', () => {
  it('includes debug diagnostics in the rendered markdown', () => {
    const data = buildReport({ source: 'x', criteria: [{ criterion: 'source_nature', verdict: 'neutral' }] })
    data.diagnostics = ['lookup failed: timeout']
    const rendered = render(data)
    expect(rendered.diagnostics).toEqual(['lookup failed: timeout'])
    expect(rendered.markdown).toContain('## 调试信息')
  })
})
