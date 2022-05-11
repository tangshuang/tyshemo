import { Validator, Meta, Model } from '../src/index.js'

const { required } = Validator

describe('Validator', () => {
  test('required', () => {
    class Some extends Meta {
      static default = ''
      static required = true
      static validators = [
        required('Some is required'),
      ]
    }

    class One extends Model {
      static some = Some
    }

    const one = new One()

    const errors = one.validate()
    expect(errors.length).toBe(1)
    expect(errors[0].message).toBe('Some is required')
  })

  test('default return false in validate function', () => {
    const Some = new Meta({
      default: 'aaa',
      validators: [
        {
          validate: () => false,
          message: 'default return validate',
        },
      ],
    })

    class SomeModel extends Model {
      static some = Some
    }

    const some = new SomeModel()
    const errors = some.validate()

    expect(errors.length).toBe(1)
    expect(errors.message).toBe('default return validate')
  })
})
