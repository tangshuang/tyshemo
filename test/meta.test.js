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

  test('extend', () => {
    class Name extends Meta {
      static default = ''
    }

    class Age extends Meta {
      static default = 10
    }

    class Some extends Model {
      static name = Name.extend(class {
        static default = 'a'
      })

      static age = Age

      static weight = Name.extend(class {
        static label = 'Weight'
        static compute = function() {
          return this.age * 5
        }
      })

      attrs() {
        return ['label']
      }
    }

    const some = new Some()

    expect(some.name).toBe('a')
    expect(some.weight).toBe(50)
    expect(some.$views.weight.label).toBe('Weight')
  })
})
