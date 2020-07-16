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
})
