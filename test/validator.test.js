import { Validator, Meta, Model } from '../es/index.js'

const { required, max } = Validator

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

  test('valdiator with key', () => {
    const SomeMeta = new Meta({
      default: 0,
      max: 20,
      validators: {
        max: max('20 max'),
      },
    })

    class SomeModel extends Model {
      static some = SomeMeta
    }

    const some = new SomeModel()
    expect(some.validate()).toEqual([])

    some.some = 40
    expect(some.validate().length).toBe(1)

    class OtherModel extends Model {
      static some = SomeMeta.extend({
        validators: {
          max: null,
        },
      })
    }

    const other = new OtherModel()
    other.some = 40
    expect(other.validate()).toEqual([])
  })
})
