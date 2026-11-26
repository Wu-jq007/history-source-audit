import { describe, it, expect } from 'vitest'
import { eraWeights, ERA_VALUES, CRITERIA } from '../src/rubric.js'

describe('eraWeights', () => {
  it('normalizes every era to 100', () => {
    for (const era of ERA_VALUES) {
      const weights = eraWeights(era)
      const sum = Object.values(weights).reduce((a, b) => a + b, 0)
      expect(sum).toBeCloseTo(100, 1)
    }
  })

  it('raises material evidence and lowers source authority for pre-Qin', () => {
    const weights = eraWeights('pre_qin')
    const base = Object.fromEntries(CRITERIA.map(criterion => [criterion.id, criterion.weight]))
    expect(weights.material_evidence).toBeGreaterThan(base.material_evidence)
    expect(weights.source_nature).toBeLessThan(base.source_nature)
  })
})
