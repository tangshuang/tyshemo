import Schema from '../src/schema.js'
import { ifexist } from '../src/rules.js'

describe('Schema', () => {
  const def = {
    string: {
      type: String,
      default: '',
    },
    number: {
      type: Number,
      rule: ifexist,
      default: 0,
    },
    dict: {
      type: { name: String, age: Number },
      default: { name: '', age: 0 },
    },
    list: {
      type: [String],
      default: [],
    },

    validators: {
      type: String,
      default: '',
      validators: [
        {
          determine: value => !!value,
          validate: value => /^[0-9]+$/.test(value),
          message: '{keyPath} should be a number string',
        },
      ],
    },
  }

  test('validate key', () => {
    const SomeSchema = new Schema(def)

    expect(SomeSchema.validate('string', '')).not.toBeInstanceOf(Error)
    expect(SomeSchema.validate('string', null)).toBeInstanceOf(Error)

    expect(SomeSchema.validate('number', 10)).not.toBeInstanceOf(Error)
    expect(SomeSchema.validate('number', null)).toBeInstanceOf(Error)

    expect(SomeSchema.validate('dict', { name: '', age: 0 })).not.toBeInstanceOf(Error)
    expect(SomeSchema.validate('dict', { name: '' })).toBeInstanceOf(Error)
    expect(SomeSchema.validate('dict', { age: 0 })).toBeInstanceOf(Error)
    expect(SomeSchema.validate('dict', null)).toBeInstanceOf(Error)
    expect(SomeSchema.validate('dict', 'null')).toBeInstanceOf(Error)

    expect(SomeSchema.validate('list', [])).not.toBeInstanceOf(Error)
    expect(SomeSchema.validate('list', ['aa'])).not.toBeInstanceOf(Error)
    expect(SomeSchema.validate('list', null)).toBeInstanceOf(Error)
    expect(SomeSchema.validate('list', 'aa')).toBeInstanceOf(Error)
    expect(SomeSchema.validate('list', ['aa', null])).toBeInstanceOf(Error)

    expect(SomeSchema.validate('validators', '123')).not.toBeInstanceOf(Error)
    expect(SomeSchema.validate('validators', 123)).toBeInstanceOf(Error)
    expect(SomeSchema.validate('validators', 'aa')).toBeInstanceOf(Error)
  })

  test('validate', () => {
    const SomeSchema = new Schema(def)
    const some = {
      string: 'ok',
      number: 10,
      dict: {
        name: 'tomy',
        age: 10,
      },
      list: ['ok'],
      validators: '123',
    }
    expect(SomeSchema.validate(some)).not.toBeInstanceOf(Error)

    // sub dict
    const some2 = { ...some, dict: {} }
    expect(SomeSchema.validate(some2)).toBeInstanceOf(Error)

    // rule = ifexist
    const some3 = { ...some }
    delete some3.number
    expect(SomeSchema.validate(some3)).not.toBeInstanceOf(Error)
  })

  test('ensure', () => {
    const SomeSchema = new Schema(def)
    const want = {
      string: '',
      dict: { name: '', age: 0 },
      list: [],
      validators: '',
    }
    expect(SomeSchema.ensure({})).toEqual(want)
    expect(SomeSchema.ensure({
      string: null,
      number: null,
    })).toEqual({
      ...want,
      number: 0,
    })
  })

  test('rebuild', () => {
    const SomeSchema = new Schema({
      key1: {
        type: String,
        default: '',
        prepare(data) {
          return data.prop1
        },
      },
    })
    const data = SomeSchema.rebuild({
      prop1: 'xxx',
    })
    expect(data.key1).toBe('xxx')
  })

  test('formulate', () => {
    const SomeSchema = new Schema({
      key2: {
        type: String,
        default: '',
        map(value, key, data) {
          return value + '!'
        },
      },
      key3: {
        type: String,
        default: '',
        drop: true,
      },
    })
    const data = SomeSchema.formulate({
      key2: 'a',
      key3: 'x',
    })
    expect(data.key2).toBe('a!')
    expect(data.key3).toBeUndefined()
  })
})
