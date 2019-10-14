import Dict from '../src/dict.js'
import Rule from '../src/rule.js'

describe('Rule', () => {
  test('pass validate option', () => {
    const SomeRule = new Rule({
      validate(value) {
        if (typeof value !== 'object') {
          return new Error(value + ' is not an object')
        }
      },
    })
    const SomeType = new Dict({
      some: SomeRule,
    })
    expect(() => SomeType.assert({
      some: {},
    })).not.toThrowError()
    expect(() => SomeType.assert({
      some: null,
    })).not.toThrowError()
    expect(() => SomeType.assert({
      some: 'null',
    })).toThrowError()
  })
  test('pass override option', () => {
    const SomeRule = new Rule({
      validate(value) {
        if (typeof value !== 'object') {
          return new Error(value + ' is not an object')
        }
      },
      override(value, key, data) {
        data[key] = {}
      },
    })
    const SomeType = new Dict({
      some: SomeRule,
    })

    expect(() => SomeType.assert({
      some: null
    })).not.toThrowError()

    const obj = {
      some: ''
    }
    expect(() => SomeType.assert(obj)).not.toThrowError()
    expect(obj.some).toEqual({})
  })
})
