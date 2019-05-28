import { Any, Numeric } from '../src/prototypes.js'
import {
  asynchronous, determine, match,
  shouldmatch, shouldnotmatch,
  ifexist, ifnotmatch,
  shouldexist, shouldnotexist,
  instance, equal,
} from '../src/rules.js'
import Dict from '../src/dict.js'

describe('Rule Generators', () => {
  test('asynchronous', (done) => {
    const SomeRule = asynchronous(() => Number)
    const SomeType = new Dict({
      some: SomeRule,
    })
    expect(() => SomeType.assert({ some: '' })).not.toThrowError()
    setTimeout(() => {
      expect(() => SomeType.assert({ some: '' })).toThrowError()
      done()
    })
  })
  test('determine', () => {
    const SomeRule = determine(({ data }) => {
      if (data.should) {
        return Object
      }
      else {
        return Any
      }
    })
    const SomeType = new Dict({
      should: Boolean,
      body: SomeRule,
    })
    expect(() => SomeType.assert({ should: true, body: {} })).not.toThrowError()
    expect(() => SomeType.assert({ should: false, body: null })).not.toThrowError()
    expect(() => SomeType.assert({ should: true, body: null })).toThrowError()
  })
  test('match+shouldmatch+shouldnotmatch', () => {
    const msg1 = 'It should be a string.'
    const msg2 = 'It should be a number string.'
    const msg3 = 'It should not begin will 123.'
    const SomeRule = match(
      shouldmatch(String, msg1),
      shouldmatch(Numeric, msg2),
      shouldnotmatch(value => value.indexOf('123') === 0, msg3),
    )
    const SomeType = new Dict({
      some: SomeRule,
    })
    expect(() => SomeType.assert({ some: '100' })).not.toThrowError()
    expect(SomeType.catch({ some: 123 }).message).toBe(msg1)
    expect(SomeType.catch({ some: '123' }).message).toBe(msg3)
    expect(SomeType.catch({ some: '100a' }).message).toBe(msg2)
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
    const SomeRule = shouldexist(({ data }) => data.has, String)
    const SomeType = new Dict({
      has: Boolean,
      name: SomeRule,
    })
    expect(() => SomeType.assert({ has: true, name: 'tomy' })).not.toThrowError()
    expect(() => SomeType.assert({ has: true, name: null })).toThrowError()
    expect(() => SomeType.assert({ has: false })).not.toThrowError()
  })
  test('shouldnotexist', () => {
    const SomeRule = shouldnotexist(({ data }) => data.shouldnotexist)
    const SomeType = new Dict({
      shouldnotexist: Boolean,
      name: SomeRule,
    })
    expect(() => SomeType.assert({ shouldnotexist: true, name: 'tomy' })).toThrowError()
    expect(() => SomeType.assert({ shouldnotexist: false, name: 'tomy' })).not.toThrowError()
  })

  test('instance', () => {
    const StringRule = instance(String)
    const StringType = new Dict({
      some: StringRule,
    })
    expect(() => StringType.assert({
      some: new String(''),
    })).not.toThrowError()
    expect(() => StringType.assert({
      some: '',
    })).toThrowError()
  })
  test('equal', () => {
    const SomeRule = equal('lily')
    const SomeType = new Dict({
      some: SomeRule,
    })
    expect(() => SomeType.assert({
      some: 'lily',
    })).not.toThrowError()
    expect(() => SomeType.assert({
      some: 'lucy',
    })).toThrowError()
  })
})
