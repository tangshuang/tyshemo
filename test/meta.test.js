import Model from '../src/model.js'
import Meta from '../src/meta.js'

describe('Meta', () => {
  test('as', () => {
    class Name extends Meta {
      static default = ''
      static as = 'key'
    }

    class Age extends Meta {
      static default = 0
      static as = 'value'
    }

    class Person extends Model {
      static name = Name
      static age = Age
    }

    const person = new Person()
    const json = person.toJSON()

    expect(json).toEqual({
      key: '',
      value: 0,
    })
  })

  test('extends', () => {
    class Name extends Meta {
      static default = ''
    }

    class Age extends Meta {
      static default = 10
    }

    class Some extends Model {
      static name = Name.extends(class {
        static default = 'a'
      })

      static age = Age

      static weight = Meta.extends(class {
        static name = 'Weight'
        static compute = function() {
          return this.age * 5
        }
      })

      attrs() {
        return ['name']
      }
    }

    const some = new Some()

    expect(some.name).toBe('a')
    expect(some.weight).toBe(50)
    expect(some.$views.weight.name).toBe('Weight')
  })
})
