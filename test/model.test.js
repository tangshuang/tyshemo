import Model from '../src/model.js'
import Meta from '../src/meta.js'

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

    any.fromJSON({
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
    const data = person.toJSON()
    expect(data.age).toBe(30)
  })

  test('message when type checking fail', () => {
    let error = null
    class SomeModel extends Model {
      static some = {
        default: '',
        type: String,
        message: 'it should be a string',
      }

      onError(err) {
        error = err
      }
    }
    const some = new SomeModel()

    some.some = 12
    expect(some.some).toBe(12) // even though type checking fail, value will be set into model
    expect(error).not.toBeNull()
    expect(error.message).toBe('it should be a string')
  })

  test('$view descontruct', () => {
    class Name extends Meta {
      static default = ''
      static label = 'Name'
      static get copy() {
        return this.name
      }
    }
    class SomeModel extends Model {
      static name = Name
    }
    const some = new SomeModel()
    some.name = 'tomy'

    const view = some.$views.name
    const attrs = { ...view } // after this, when you change your model, properties of attrs will not change any more

    expect(attrs.required).toBe(false)
    expect(attrs.label).toBe('Name')

    expect(attrs.copy).toBe('tomy')
  })

  test('state', () => {
    class SomeModel extends Model {
      static some = {
        default: null,
        required() {
          return !this.isFund // use state to check whether need to be required
        },
      }

      state() {
        return {
          isFund: false,
          isInvested: false,
        }
      }
    }

    const model = new SomeModel({
      isFund: true,
    })

    expect(model.isFund).toBe(true)
    expect(model.isInvested).toBe(false)
    expect(model.$views.some.required).toBe(false)

    model.isFund = false

    expect(model.$views.some.required).toBe(true)
  })

  test('define state in Meta', () => {
    class Some extends Meta {
      state() {
        return {
          some_name: 'aa',
        }
      }

      static default = ''
      static compute() {
        return this.some_name
      }
    }

    class It extends Model {
      static some = Some
    }

    const it = new It()

    expect(it.some).toBe('aa')
    expect(it.some_name).toBe('aa')
  })

  test('watch schema', () => {
    let count = 0

    class SomeModel extends Model {
      static some = {
        default: '',
        watch() {
          count ++
        },
      }
    }

    const some = new SomeModel()

    some.some = 'a'
    expect(count).toBe(1)

    some.some = 'b'
    expect(count).toBe(2)
  })

  test('state computed', () => {
    class Name extends Meta {
      static default = ''
    }
    class Age extends Meta {
      static default = 10
    }
    class Some extends Model {
      static name = Name
      static age = Age

      state() {
        return {
          get weight() {
            return this.age * 5
          }
        }
      }
    }

    const some = new Some()

    expect(some.weight).toBe(50)

    some.age ++
    expect(some.weight).toBe(55)
  })

  test('model.$views.$state', () => {
    class Some extends Model {
      schema() {
        return {
          name: { default: 'some' },
        }
      }
      state() {
        return {
          isFund: true,
          isPaid: false,
        }
      }
    }

    const some = new Some()

    expect(some.name).toBe('some')
    expect(some.isFund).toBe(true)
    expect(some.isPaid).toBe(false)

    expect(some.$views.$state.isFund).toBe(true)
    expect(some.$views.$state.isPaid).toBe(false)

    some.$views.$state.isFund = false
    expect(some.$views.$state.isFund).toBe(false)

    some.$views.$state.isPaid = true
    expect(some.$views.$state.isPaid).toBe(true)
  })

  test('from/to', () => {
    class Some extends Model {
      static name = {
        default: 'some',
        from: 'some_key',
        to: 'one',
      }
    }

    const some = new Some()
    some.fromJSON({
      some_key: 'aaaa'
    })

    expect(some.name).toBe('aaaa')

    const data = some.toJSON()
    expect(data.one).toBe('aaaa')
  })

  test('static extend', () => {
    class Some extends Model {
      static name = {
        default: 'some',
      }
    }

    const One = Some.extend({
      age: {
        default: 0,
      },
    })

    const one = new One()

    // extend and extract static methods are deleted
    expect(one.extend).toBeUndefined()

    expect(one.name).toBe('some')
    expect(one.age).toBe(0)
  })

  test('static extract', () => {
    class Some extends Model {
      static name = {
        default: 'some',
      }
      static age = {
        default: 0,
      }

      say() {}

      sing() {}
    }

    const One = Some.extract({
      age: true,
    }, {
      sing: true,
    })

    const one = new One()

    expect(one.extract).toBeUndefined()
    expect(one.name).toBeUndefined()
    expect(one.age).toBe(0)
    expect(one.say).toBeUndefined()
    expect(one.sing).toBeTruthy()
  })
})
