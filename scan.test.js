import { describe, it, expect } from 'vitest'
import { scanExcerpt } from '../src/scan.js'

describe('scanExcerpt exclusions', () => {
  it('does not count 神 inside 神宗 or 神农', () => {
    const scan = scanExcerpt('宋神宗即位。夫神农以前，吾不知已。有神降于莘。')
    expect(scan.omen).toEqual([{ term: '神', count: 1 }])
  })

  it('does not count 龙 inside 龙且', () => {
    const scan = scanExcerpt('龙且将兵。')
    expect(scan.omen).toEqual([])
  })

  it('does not count 祥 inside 吉祥 or 鬼 inside 鬼方', () => {
    const scan = scanExcerpt('吉祥止止，鬼方来朝。')
    expect(scan.omen).toEqual([])
  })

  it('still counts a real 灾异', () => {
    const scan = scanExcerpt('天见灾异。')
    const terms = scan.omen.map(entry => entry.term)
    expect(terms).toEqual(expect.arrayContaining(['灾', '异']))
  })
})
