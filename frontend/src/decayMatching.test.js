import { describe, it, expect } from 'vitest'
import { decayContains, decaysMatch, normalizeParticleName, extractFinalStates } from './decayMatching'

// Shorthand: build a decay array from a simple notation
// ['B+', 'K+', 'pi-'] = B+ -> K+ pi-
// ['B+', ['D0', 'K-', 'pi+'], 'pi+'] = B+ -> (D0 -> K- pi+) pi+

describe('normalizeParticleName', () => {
  it('strips [cc] suffix', () => {
    expect(normalizeParticleName('B+[cc]cc')).toBe('B+')
  })
  it('leaves normal names alone', () => {
    expect(normalizeParticleName('K+')).toBe('K+')
  })
  it('handles non-strings', () => {
    expect(normalizeParticleName(42)).toBe(42)
  })
})

describe('decaysMatch', () => {
  it('matches identical flat decays', () => {
    expect(decaysMatch(['B+', 'K+', 'pi+'], ['B+', 'K+', 'pi+'])).toBe(true)
  })
  it('matches daughters in different order', () => {
    expect(decaysMatch(['B+', 'pi+', 'K+'], ['B+', 'K+', 'pi+'])).toBe(true)
  })
  it('does not match different mothers', () => {
    expect(decaysMatch(['B+', 'K+'], ['B-', 'K+'])).toBe(false)
  })
  it('does not match different daughters', () => {
    expect(decaysMatch(['B+', 'K+', 'pi+'], ['B+', 'K+', 'pi-'])).toBe(false)
  })
  it('does not match when one has more daughters', () => {
    expect(decaysMatch(['B+', 'K+', 'pi+'], ['B+', 'K+', 'pi+', 'pi0'])).toBe(false)
  })
  it('does not match when one has fewer daughters', () => {
    expect(decaysMatch(['B+', 'K+', 'pi+', 'pi0'], ['B+', 'K+', 'pi+'])).toBe(false)
  })
  it('treats duplicate daughters as a multiset', () => {
    expect(decaysMatch(['B+', 'pi+', 'pi+', 'pi-'], ['B+', 'pi-', 'pi+', 'pi+'])).toBe(true)
  })
  it('does not match when duplicate counts differ', () => {
    expect(decaysMatch(['B+', 'pi+', 'pi+', 'pi-'], ['B+', 'pi+', 'pi-', 'pi-'])).toBe(false)
  })
  it('matches nested decays order-independently', () => {
    expect(decaysMatch(
      ['B+', ['D0', 'pi+', 'K-'], 'pi+'],
      ['B+', 'pi+', ['D0', 'K-', 'pi+']]
    )).toBe(true)
  })
  it('does not match when nested sub-decay differs', () => {
    expect(decaysMatch(
      ['B+', ['D0', 'K+', 'K-'], 'pi+'],
      ['B+', ['D0', 'K-', 'pi+'], 'pi+']
    )).toBe(false)
  })
  it('matches a 3-level deep chain', () => {
    expect(decaysMatch(
      ['B+', ['D0', ['K*', 'K+', 'pi-'], 'pi+'], 'pi+'],
      ['B+', 'pi+', ['D0', 'pi+', ['K*', 'pi-', 'K+']]]
    )).toBe(true)
  })
  it('does not match when a deeply nested daughter differs', () => {
    expect(decaysMatch(
      ['B+', ['D0', ['K*', 'K+', 'pi-'], 'pi+'], 'pi+'],
      ['B+', ['D0', ['K*', 'K+', 'K-'], 'pi+'], 'pi+']
    )).toBe(false)
  })
  it('matches intermediate state folded into final state particles', () => {
    // file: B+ -> (D0 -> K+ pi-) K+   search: B+ -> K+ K+ pi-
    expect(decaysMatch(
      ['B+', ['D0', 'K+', 'pi-'], 'K+'],
      ['B+', 'K+', 'K+', 'pi-']
    )).toBe(false) // decaysMatch is structural, not final-state based
  })
})

describe('extractFinalStates', () => {
  it('returns direct daughters for flat decay', () => {
    expect(extractFinalStates(['B+', 'K+', 'pi-'])).toEqual(['K+', 'pi-'])
  })
  it('recurses into sub-decays', () => {
    expect(extractFinalStates(['B+', ['D0', 'K-', 'pi+'], 'pi+'])).toEqual(['K-', 'pi+', 'pi+'])
  })
})

describe('decayContains — basic', () => {
  it('finds an exact flat match', () => {
    expect(decayContains(['B+', 'K+', 'pi-'], ['B+', 'K+', 'pi-'])).toBe(true)
  })
  it('finds a flat match regardless of daughter order', () => {
    expect(decayContains(['B+', 'pi-', 'K+'], ['B+', 'K+', 'pi-'])).toBe(true)
  })
  it('does not match wrong mother', () => {
    expect(decayContains(['B-', 'K+', 'pi-'], ['B+', 'K+', 'pi-'])).toBe(false)
  })
  it('does not match wrong daughters', () => {
    expect(decayContains(['B+', 'K+', 'pi+'], ['B+', 'K+', 'pi-'])).toBe(false)
  })
  it('finds a sub-decay buried inside', () => {
    const file = ['B+', ['D0', 'K-', 'pi+'], 'pi+']
    expect(decayContains(file, ['D0', 'K-', 'pi+'])).toBe(true)
  })
  it('does not find a sub-decay that is not there', () => {
    const file = ['B+', ['D0', 'K-', 'pi+'], 'pi+']
    expect(decayContains(file, ['D0', 'K-', 'K+'])).toBe(false)
  })
  it('strips sig suffix when matching mothers', () => {
    expect(decayContains(['B+sig', 'K+', 'pi-'], ['B+', 'K+', 'pi-'])).toBe(true)
  })
  it('strips sig suffix on search mother too', () => {
    expect(decayContains(['B+', 'K+', 'pi-'], ['B+sig', 'K+', 'pi-'])).toBe(true)
  })
  it('finds decay with sub-decay daughter named in search', () => {
    // Search for B+ -> D0 pi+, where D0 decays further in the file
    const file = ['B+', ['D0', 'K-', 'pi+'], 'pi+']
    expect(decayContains(file, ['B+', 'D0', 'pi+'])).toBe(true)
  })
  it('does not match when extra daughters are present', () => {
    const file = ['B+', 'K+', 'pi-', 'pi0']
    expect(decayContains(file, ['B+', 'K+', 'pi-'])).toBe(false)
  })
  it('matches when search daughters are satisfied by folding in a sub-decay', () => {
    // file: B+ -> (D0 -> K+ pi-) K+   search: B+ -> K+ K+ pi-
    // D0's daughters K+ and pi- fold into B+'s search daughters
    const file = ['B+', ['D0', 'K+', 'pi-'], 'K+']
    expect(decayContains(file, ['B+', 'K+', 'K+', 'pi-'])).toBe(true)
  })
  it('does not fold in when daughters do not add up', () => {
    // file: B+ -> (D0 -> K+ pi-) K+   search: B+ -> K+ K+ K+
    const file = ['B+', ['D0', 'K+', 'pi-'], 'K+']
    expect(decayContains(file, ['B+', 'K+', 'K+', 'K+'])).toBe(false)
  })
})

describe('decayContains — topLevel', () => {
  const file = ['B+', ['D0', 'K-', 'pi+'], 'pi+']

  it('matches root decay with topLevel on', () => {
    expect(decayContains(file, ['B+', 'D0', 'pi+'], true)).toBe(true)
  })
  it('does not descend to find sub-decay when topLevel is on', () => {
    expect(decayContains(file, ['D0', 'K-', 'pi+'], true)).toBe(false)
  })
  it('without topLevel, finds the buried sub-decay', () => {
    expect(decayContains(file, ['D0', 'K-', 'pi+'], false)).toBe(true)
  })
  it('topLevel with wrong mother returns false', () => {
    expect(decayContains(file, ['B-', 'D0', 'pi+'], true)).toBe(false)
  })
})

describe('decayContains — direct', () => {
  const flat = ['B+', 'K+', 'pi-', 'pi+']
  const nested = ['B+', ['rho+', 'pi+', 'pi0'], 'K-']

  it('matches exact direct daughters', () => {
    expect(decayContains(flat, ['B+', 'K+', 'pi-', 'pi+'], false, true)).toBe(true)
  })
  it('rejects when file has extra daughters', () => {
    // file has 4 daughters, search has 3
    expect(decayContains(['B+', 'K+', 'pi-', 'pi+', 'pi0'], ['B+', 'K+', 'pi-', 'pi+'], false, true)).toBe(false)
  })
  it('rejects when search has more daughters than file', () => {
    expect(decayContains(flat, ['B+', 'K+', 'pi-', 'pi+', 'pi0'], false, true)).toBe(false)
  })
  it('matches sub-decay mother as direct daughter', () => {
    // file: B+ -> (rho+ -> ...) K-  search: B+ -> rho+ K-
    expect(decayContains(nested, ['B+', 'rho+', 'K-'], false, true)).toBe(true)
  })
  it('does not match final-state particles hidden inside a resonance', () => {
    // searching for pi+ directly, but pi+ is inside rho+ in the file
    expect(decayContains(nested, ['B+', 'pi+', 'K-'], false, true)).toBe(false)
  })
  it('is order-independent for direct daughters', () => {
    expect(decayContains(flat, ['B+', 'pi+', 'pi-', 'K+'], false, true)).toBe(true)
  })
  it('descends to find a direct match in a sub-decay', () => {
    // file: B+ -> (D0 -> K- pi+) pi+, search: D0 -> K- pi+ (direct)
    const file = ['B+', ['D0', 'K-', 'pi+'], 'pi+']
    expect(decayContains(file, ['D0', 'K-', 'pi+'], false, true)).toBe(true)
  })
  it('rejects duplicate daughters that exceed count', () => {
    // file: B+ -> K+ pi- pi+  search: B+ -> K+ pi- pi+ pi+
    expect(decayContains(['B+', 'K+', 'pi-', 'pi+'], ['B+', 'K+', 'pi-', 'pi+', 'pi+'], false, true)).toBe(false)
  })
})

describe('decayContains — deep chains', () => {
  // B+ -> (D0 -> (K* -> K+ pi-) pi+) pi+
  const deep = ['B+', ['D0', ['K*', 'K+', 'pi-'], 'pi+'], 'pi+']

  it('finds the deepest decay at level 3', () => {
    expect(decayContains(deep, ['K*', 'K+', 'pi-'])).toBe(true)
  })
  it('finds the middle decay at level 2', () => {
    expect(decayContains(deep, ['D0', 'K*', 'pi+'])).toBe(true)
  })
  it('finds the root decay at level 1', () => {
    expect(decayContains(deep, ['B+', 'D0', 'pi+'])).toBe(true)
  })
  it('does not find a decay that is not in the chain', () => {
    expect(decayContains(deep, ['K*', 'K+', 'K-'])).toBe(false)
  })
  it('topLevel blocks finding level 2 decay', () => {
    expect(decayContains(deep, ['D0', 'K*', 'pi+'], true)).toBe(false)
  })
  it('direct on level 2 decay matches K* as direct daughter', () => {
    expect(decayContains(deep, ['D0', 'K*', 'pi+'], false, true)).toBe(true)
  })
  it('direct on level 2 rejects expanded K* daughters', () => {
    // K+ and pi- are inside K*, not direct daughters of D0
    expect(decayContains(deep, ['D0', 'K+', 'pi-', 'pi+'], false, true)).toBe(false)
  })
})

describe('decayContains — B0sig -> (D- -> (K_S0 -> pi+ pi-) pi-) pi+', () => {
  // file: B0sig -> (D- -> (K_S0 -> pi+ pi-) pi-) pi+
  // search: B0 -> K_S0 pi- pi+
  const file = ['B0sig', ['D-', ['K_S0', 'pi+', 'pi-'], 'pi-'], 'pi+']
  const search = ['B0', 'K_S0', 'pi-', 'pi+']

  it('normal mode: matches by folding D- daughters into B0 and treating K_S0 as a resonance', () => {
    expect(decayContains(file, search)).toBe(true)
  })
  it('topLevel mode: matches at root level by folding sub-decays', () => {
    expect(decayContains(file, search, true)).toBe(true)
  })
  it('direct mode: does not match because K_S0 and pi- are inside D-, not direct daughters of B0', () => {
    expect(decayContains(file, search, false, true)).toBe(false)
  })
})

describe('decayContains — topLevel + direct combined', () => {
  const file = ['B+', ['D0', 'K-', 'pi+'], 'pi+']

  it('matches root with exact direct daughters', () => {
    expect(decayContains(file, ['B+', 'D0', 'pi+'], true, true)).toBe(true)
  })
  it('does not descend and does not match sub-decay', () => {
    expect(decayContains(file, ['K-', 'pi+', 'pi+'], true, true)).toBe(false)
  })
  it('rejects root match when extra daughter present', () => {
    expect(decayContains(file, ['B+', 'D0', 'pi+', 'pi0'], true, true)).toBe(false)
  })
})
