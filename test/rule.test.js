import Type from '../src/type.js'
import Rule from '../src/rule.js'

describe('Rule', () => {
  test('pass a determine function', () => {
    const ObjectRule = new Rule(function(value) {
      if (typeof value !== 'object') {
        return new Error(value + ' is not an object')
      }
    })
    const ObjectType = new Type(ObjectRule)
    expect(() => { ObjectType.assert({}) }).not.toThrowError()
    expect(() => { ObjectType.assert(null) }).not.toThrowError()
    expect(() => { ObjectType.assert([]) }).not.toThrowError()
    expect(() => { ObjectType.assert('') }).toThrowError()
  })
  test('pass validate option', () => {
    const SomeRule = new Rule({
      validate(value) {
        if (typeof value !== 'object') {
          return new Error(value + ' is not an object')
        }
      },
    })
    const SomeType = new Type(SomeRule)
    expect(() => { SomeType.assert({}) }).not.toThrowError()
    expect(() => { SomeType.assert(null) }).not.toThrowError()
    expect(() => { SomeType.assert([]) }).not.toThrowError()
    expect(() => { SomeType.assert('') }).toThrowError()
  })
  test('pass override option', () => {
    const SomeRule = new Rule({
      validate(value) {
        if (typeof value !== 'object') {
          return new Error(value + ' is not an object')
        }
      },
      override(value, key, target) {
        target[key] = {}
      },
    })
    const SomeType = new Type({
      key: SomeRule
    })
    expect(() => {
      SomeType.assert({
        key: null
      })
    }).not.toThrowError()

    const obj = {
      key: ''
    }
    expect(() => {
      SomeType.assert(obj)
    }).not.toThrowError()
    expect(obj.key).toEqual({})
  })
})
