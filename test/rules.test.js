import Type from '../src/type.js'
import {
  Any, Null, Undefined, Numeric, Int, Float,
  asynchronous, determine, validate, match,
  shouldnotmatch,
  ifexist, ifnotmatch,
  shouldexist, shouldnotexist,
  implement, equal,
} from '../src/rules.js'
import Dict from '../src/dict.js'

describe('Internal Rules', () => {
  test('Null', () => {
    const NullType = new Type(Null)
    expect(() => { NullType.assert({}) }).toThrowError()
    expect(() => { NullType.assert(null) }).not.toThrowError()
  })
  test('Undefined', () => {
    const UndefinedType = new Type(Undefined)
    expect(() => { UndefinedType.assert({}) }).toThrowError()
    expect(() => { UndefinedType.assert(undefined) }).not.toThrowError()
  })
  test('Any', () => {
    const AnyType = new Type(Any)
    expect(() => { AnyType.assert({}) }).not.toThrowError()
    expect(() => { AnyType.assert('') }).not.toThrowError()
    expect(() => { AnyType.assert(1) }).not.toThrowError()
  })
  test('Numeric', () => {
    const SomeType = new Type({
      number: Numeric,
      numeral: Numeric,
    })
    const some = {
      number: 1234,
      numeral: '-23132.23423'
    }
    expect(() => SomeType.assert(some)).not.toThrowError()
  })
  test('Int', () => {
    const SomeType = new Type(Int)
    expect(SomeType.test(12)).toBeTruthy()
    expect(SomeType.test(12.3)).toBeFalsy()
  })
  test('Float', () => {
    const SomeType = new Type(Float)
    expect(SomeType.test(12.4)).toBeTruthy()
    expect(SomeType.test(12)).toBeFalsy()
  })
})

describe('Internal Rule Generators', () => {
  test('determine', () => {
    const SomeRule = determine((value, key, target) => {
      if (target.should) {
        return Object
      }
      else {
        return Any
      }
    })
    const SomeType = new Type({ should: Boolean, body: SomeRule })
    expect(() => SomeType.assert({ should: true, body: {} })).not.toThrowError()
    expect(() => SomeType.assert({ should: false, body: null })).not.toThrowError()
    expect(() => SomeType.assert({ should: true, body: null })).toThrowError()
  })
  test('validate', () => {
    const msg = 'it should be a string'
    const SomeRule = validate(value => typeof value === 'string', msg)
    const SomeType = new Type(SomeRule)
    expect(() => SomeType.assert('')).not.toThrowError()
    expect(() => SomeType.assert(null)).toThrowError()
    expect(SomeType.catch(null).message).toBe(msg)

    const SomeRule2 = validate(String, msg)
    const SomeType2 = new Type(SomeRule2)
    expect(() => SomeType2.assert('')).not.toThrowError()
    expect(() => SomeType2.assert(null)).toThrowError()
  })
  xtest('asynchronous', (done) => {
    const SomeRule = asynchronous(() => Number)
    const SomeType = new Type(SomeRule)
    expect(() => SomeType.assert('')).not.toThrowError()
    setTimeout(() => {
      expect(() => SomeType.assert('')).toThrowError()
      done()
    })
  })

  test('match', () => {
    const msg1 = 'It should be a string.'
    const msg2 = 'It should be a number string.'
    const SomeRule = match(
      validate(String, msg1),
      validate(Numeric, msg2),
    )
    const SomeType = new Type(SomeRule)
    expect(() => SomeType.assert('123')).not.toThrowError()
    expect(SomeType.catch(123).message).toBe(msg1)
    expect(SomeType.catch('123a').message).toBe(msg2)
  })
  test('shouldnotmatch', () => {
    const SomeRule = shouldnotmatch(String)
    const SomeType = new Type(SomeRule)
    expect(() => SomeType.assert('123')).toThrowError()
    expect(() => SomeType.assert(123)).not.toThrowError()
    expect(() => SomeType.assert(null)).not.toThrowError()
  })

  test('ifexist', () => {
    const SomeRule = ifexist(String)
    const SomeType = new Dict({
      name: SomeRule,
    })
    expect(() => SomeType.assert({})).not.toThrowError()
    expect(() => SomeType.assert({ name: 'tomy' })).not.toThrowError()
    expect(() => SomeType.assert({ name: null })).toThrowError()
  })
  test('ifnotmatch', () => {
    const SomeRule = ifnotmatch(String, '')
    const SomeType = new Dict({
      name: SomeRule,
    })
    const obj = { name: null }
    expect(() => SomeType.assert(obj)).not.toThrowError()
    expect(obj.name).toBe('')
  })

  test('shouldexist', () => {
    const SomeRule = shouldexist((value, key, target) => {
      return target.has
    }, String)
    const SomeType = new Dict({
      has: Boolean,
      name: SomeRule,
    })
    expect(() => SomeType.assert({ has: true, name: 'tomy' })).not.toThrowError()
    expect(() => SomeType.assert({ has: true, name: null })).toThrowError()
    expect(() => SomeType.assert({ has: false })).not.toThrowError()
  })
  test('shouldnotexist', () => {
    const SomeRule = shouldnotexist((value, key, target) => {
      return target.shouldnotexist
    })
    const SomeType = new Dict({
      shouldnotexist: Boolean,
      name: SomeRule,
    })
    expect(() => SomeType.assert({ shouldnotexist: true, name: 'tomy' })).toThrowError()
    expect(() => SomeType.assert({ shouldnotexist: false, name: 'tomy' })).not.toThrowError()
  })

  test('implement', () => {
    const StringRule = implement(String)
    const StringType = new Type(StringRule)
    expect(() => { StringType.assert(new String('')) }).not.toThrowError()
    expect(() => { StringType.assert('') }).toThrowError()
  })
  test('equal', () => {
    const SomeRule = equal({
      name: 'lily',
    })
    const SomeType = new Type(SomeRule)
    expect(() => SomeType.assert({
      name: 'lily'
    })).not.toThrowError()
    expect(() => SomeType.assert({
      age: 10
    })).toThrowError()
  })
})
