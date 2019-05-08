import Schema from '../src/schema.js'
import { dict } from '../src/dict.js'

describe('Schema', () => {
  const schema = new Schema({
    name: {
      default: '',
      type: String,
    },
    age: {
      default: 0,
      type: Number,
    },
    body: {
      default: {
        head: true,
        hands: true,
        feet: true,
      },
      type: dict({
        head: Boolean,
        hands: Boolean,
        feet: Boolean,
      }),
    },
  })
  test('ensure', () => {
    const o = {
      name: '',
      age: 0,
      body: {
        head: true,
        hands: true,
        feet: true,
      },
    }
    expect(schema.ensure()).toEqual(o)
  })
  test('validate', () => {
    const o = {
      name: '',
      age: 0,
      body: {
        head: true,
        hands: true,
        feet: true,
      },
    }
    expect(schema.validate(o)).toBeUndefined()

    o.body.head = null
    expect(schema.validate(o)).toBeInstanceOf(Error)
  })
})
