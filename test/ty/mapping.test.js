import { Mapping, Numeric, Dict } from '../../src/ty/index.js'

describe('Mapping', () => {
  test('one level', () => {
    const SomeMapping = new Mapping({ key: Numeric, value: String })
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
  test('use Dict', () => {
    const SomeMapping = new Mapping({
      key: String,
      value: new Dict({
        name: String,
        age: Number,
      }),
    })

    expect(SomeMapping.test({
      std1: {
        name: 'tomy',
        age: 10,
      },
    })).toBe(true)
    expect(SomeMapping.test({
      std1: {
        name: 'tomy',
        age: null,
      },
    })).toBe(false)
  })
})
