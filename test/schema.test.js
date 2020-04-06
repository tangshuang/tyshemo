import Schema from '../src/schema.js'
import { ifexist } from '../src/ty/index.js'
import { isString } from 'ts-fns'

describe('Schema', () => {
  const def = {
    string: {
      type: String,
      default: '',
    },
    number: {
      type: ifexist(Number),
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
          validate: isString,
          message: 'should be a string',
        },
        {
          determine: value => !!value,
          validate: value => /^[0-9]+$/.test(value),
          message: 'should be a number string',
        },
      ],
    },
  }

  test('validate', () => {
    const SomeSchema = new Schema(def)

    expect(SomeSchema.validate('string', '').length).toBe(0)
    expect(SomeSchema.validate('string', null).length).toBe(1)

    expect(SomeSchema.validate('number', 10).length).toBe(0)
    expect(SomeSchema.validate('number', null).length).toBe(1)

    expect(SomeSchema.validate('dict', { name: '', age: 0 }).length).toBe(0)
    expect(SomeSchema.validate('dict', { name: '' }).length).toBe(1)
    expect(SomeSchema.validate('dict', { age: 0 }).length).toBe(1)
    expect(SomeSchema.validate('dict', null).length).toBe(1)
    expect(SomeSchema.validate('dict', 'null').length).toBe(1)
    expect(SomeSchema.validate('dict', {}).length).toBe(1)

    expect(SomeSchema.validate('list', []).length).toBe(0)
    expect(SomeSchema.validate('list', ['aa']).length).toBe(0)
    expect(SomeSchema.validate('list', null).length).toBe(1)
    expect(SomeSchema.validate('list', 'aa').length).toBe(1)
    expect(SomeSchema.validate('list', ['aa', null]).length).toBe(1)

    expect(SomeSchema.validate('validators', '123').length).toBe(0)
    expect(SomeSchema.validate('validators', 'aa').length).toBe(1)
    expect(SomeSchema.validate('validators', 123).length).toBe(2)
  })

  test('type is a rule', () => {
    const SomeSchema = new Schema(def)
    expect(SomeSchema.validate('number', undefined).length).toBe(0)
  })

  test('restore', () => {
    const SomeSchema = new Schema({
      key1: {
        type: String,
        default: '',
        create(data) {
          return data.prop1
        },
      },
    })
    const data = SomeSchema.restore({
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
