import Schema from '../src/schema.js'

describe('Schema', () => {
  const SomeSchema = new Schema({
    string: {
      type: String,
      default: '',
    },
    number: {
      type: Number,
      default: 0,
      required: false,
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
  })

  test('validate key', () => {
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

    const some2 = { ...some, dict: {} }
    expect(SomeSchema.validate(some2)).toBeInstanceOf(Error)

    const some3 = { ...some }
    delete some3.number
    expect(SomeSchema.validate(some3)).not.toBeInstanceOf(Error)
  })

  test('ensure', () => {
    const defaultValue = {
      string: '',
      number: 0,
      dict: { name: '', age: 0 },
      list: [],
      validators: '',
    }
    expect(SomeSchema.ensure({})).toEqual(defaultValue)
    expect(SomeSchema.ensure({
      string: null,
      number: null,
    })).toEqual(defaultValue)
  })
})
