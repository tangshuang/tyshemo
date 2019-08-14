import { Any, Numeric } from '../src/prototypes.js'
import {
  asynchronous, determine, match,
  shouldmatch, shouldnotmatch,
  ifexist, ifnotmatch, ifmatch,
  shouldexist, shouldnotexist,
  beof, equal, nullor,
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
  test('shouldmatch', () => {
    const msg1 = 'It should be a string.'
    const SomeType = new Dict({
      some: shouldmatch(String, msg1),
    })

    expect(() => SomeType.assert({ some: '123' })).not.toThrowError()
    expect(SomeType.catch({ some: 123 }).message).toBe(msg1)

    const msg2 = 'It should be a number string.'
    const Some2Type = new Dict({
      some: shouldmatch(Numeric, msg2),
    })

    expect(() => Some2Type.assert({ some: '123' })).not.toThrowError()
    expect(() => Some2Type.assert({ some: '12a' })).toThrowError()
    expect(Some2Type.catch({ some: 123 }).message).toBe(msg2)
  })
  test('shouldnotmatch', () => {
    const msg1 = 'It should not be a string.'
    const SomeType = new Dict({
      some: shouldnotmatch(String, msg1),
      it: shouldnotmatch(Number),
    })

    expect(() => SomeType.assert({
      some: 123,
      it: '123',
    })).not.toThrowError()
    expect(SomeType.catch({
      some: '123',
    }).message).toBe(msg1)
  })
  test('match + shouldmatch+shouldnotmatch', () => {
    const msg1 = 'It should be a string.'
    const msg2 = 'It should be a number string.'
    const msg3 = 'It should not begin will 123.'
    const SomeRule = match([
      shouldmatch(String, msg1),
      shouldmatch(Numeric, msg2),
      shouldnotmatch(value => value.indexOf('123') === 0, msg3),
    ])
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
    const SomeRule = shouldnotexist(({ data }) => data.shouldnotexist, String)
    const SomeType = new Dict({
      shouldnotexist: Boolean,
      name: SomeRule,
    })
    expect(() => SomeType.assert({ shouldnotexist: true, name: 'tomy' })).toThrowError()
    expect(() => SomeType.assert({ shouldnotexist: false, name: 'tomy' })).not.toThrowError()
  })

  test('beof', () => {
    const StringRule = beof(String)
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
  test('nullor', () => {
    const SomeRule = nullor(String)
    const SomeType = new Dict({
      some: SomeRule,
    })
    expect(() => SomeType.assert({
      some: 'lucy',
    })).not.toThrowError()
    expect(() => SomeType.assert({
      some: null,
    })).not.toThrowError()
    expect(() => SomeType.assert({
      some: 111,
    })).toThrowError()
  })

  test('ifexist + ifnotmatch', () => {
    const SomeRule = ifexist(ifnotmatch(String, ''))
    const SomeType = new Dict({
      some: SomeRule,
    })

    const data = {
      some: 10,
    }
    expect(() => SomeType.assert(data)).not.toThrowError()
    expect(data.some).toBe('')
    expect(() => SomeType.assert({})).not.toThrowError()
  })

  test('ifmatch', () => {
    const SomeRule = ifmatch(null, '')
    const SomeType = new Dict({
      some: SomeRule,
    })

    const data = {
      some: null,
    }
    expect(() => SomeType.assert(data)).not.toThrowError()
    expect(data.some).toBe('')
    expect(() => SomeType.assert({})).not.toThrowError()
  })
})
