import Model from '../src/model.js'
import { dict } from '../src/ty/index.js'

describe('Model', () => {
  class PersonModel extends Model {
    static name = {
      default: '',
      type: String,
    }

    static age = {
      default: 0,
      type: Number,
    }

    static body = {
      default: {
        head: true,
        hands: true,
        feet: true,
      },
      type: {
        head: Boolean,
        hands: Boolean,
        feet: Boolean,
      },
    }

    static height = {
      type: Number,
      default: 0,
      compute() {
        return this.body.feet ? 120 : 60
      },
    }

    static weight = {
      type: Number,
      default: 20,
    }
  }

  test('computed', () => {
    const person = new PersonModel()
    expect(person.height).toBe(120)

    person.body.feet = false
    expect(person.height).toBe(60)
  })
  test('get', () => {
    const person = new PersonModel()
    expect(person.get('body.head')).toBe(true)
  })
  test('set', () => {
    const person = new PersonModel()
    person.set('body.feet', false)
    expect(person.body.feet).toBe(false)
  })
  test('update', () => {
    const person = new PersonModel()
    person.update({
      name: 'tomy',
      age: 10,
    })
    expect(person.name).toBe('tomy')
    expect(person.age).toBe(10)
  })
  test('watch', () => {
    const person = new PersonModel()
    person.watch('age', function() {
      this.weight = this.age * 2 + 20
    })

    person.age = 20
    expect(person.weight).toBe(60)
  })
  test('delete', () => {
    const person = new PersonModel()

    person.define('testkey', 'some')
    expect(person.testkey).toBe('some')

    person.define('testkey', undefined)
    expect(person.testkey).toBe(undefined)
  })

  test('validate', () => {
    class SomeModel extends Model {
      static some = {
        type: Number,
        default: 0,
        validators: [
          {
            determine: true,
            validate: v => v > 0,
            message: 'Should bigger than 0.',
          },
        ],
      }
    }
    const some = new SomeModel({
      some: 0,
    })
    const error = some.validate()
    expect(error).toBeInstanceOf(Array)
    expect(error[0].message).toBe('Should bigger than 0.')
  })

  test('use model as schema', () => {
    class SomeModel extends Model {
      static num = {
        type: Number,
        default: 0,
      }
    }
    class AnyModel extends Model {
      static some = SomeModel
      static listd = [SomeModel]
    }

    const any = new AnyModel()
    expect(any.some.num).toBe(0)
    expect(any.listd.length).toBe(0)

    any.restore({
      listd: [{ num: 10 }],
    })

    expect(any.some.num).toBe(0)
    expect(any.listd.length).toBe(1)
    expect(any.listd[0].num).toBe(10)
  })

  test('getter and setter', () => {
    class PersonModel extends Model {
      static name = {
        type: String,
        default: '',
      }

      static age = {
        type: Number,
        default: 0,
        getter(value) {
          // ensure string
          return value ? value + '' : ''
        },
        setter(value) {
          // ensure number
          return !isNaN(+value) ? +value : 0
        }
      }
    }
    const person = new PersonModel()

    expect(person.age).toBe('')

    person.age = 12
    expect(person.age).toBe('12')

    person.age = '30'
    const data = person.toJson()
    expect(data.age).toBe(30)
  })

  test('message when type checking fail', () => {
    let error = null
    class SomeModel extends Model {
      static some = {
        type: String,
        default: '',
        message: 'it should be a string',
      }

      onError(err) {
        error = err
      }
    }
    const some = new SomeModel()

    some.some = 12
    expect(some.some).toBe('')
    expect(error).not.toBeNull()
    expect(error.message).toBe('it should be a string')
  })
})
