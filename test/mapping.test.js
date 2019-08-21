import { Mapping, Numeric } from '../src/index.js'

describe('Mapping', () => {
  test('one level', () => {
    const SomeMapping = new Mapping([Numeric, String])
    const a = {
      2019: '92103',
    }
    const b = {
      abc: 'aaa',
    }
    const c = {
      2019: null,
    }
    const d = {
      abc: null,
    }
    expect(SomeMapping.test(a)).toBe(true)
    expect(SomeMapping.test(b)).toBe(false)
    expect(SomeMapping.test(c)).toBe(false)
    expect(SomeMapping.test(d)).toBe(false)
  })
})
