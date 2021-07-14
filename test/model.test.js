import Model from '../src/model.js'
import Meta from '../src/meta.js'
import Factory from '../src/factory.js'

describe('Model', () => {
  class PersonModel extends Model {
    static name = new Meta({
      default: '',
      type: String,
    })

    static age = new Meta({
      default: 0,
      type: Number,
    })

    static body = new Meta({
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
    })

    static height = new Meta({
      type: Number,
      default: 0,
      compute() {
        return this.body.feet ? 120 : 60
      },
    })

    static weight = new Meta({
      type: Number,
      default: 20,
    })
  }

  test('computed', () => {
    global.__debug = true
    const person = new PersonModel()
    expect(person.height).toBe(120)

    person.body.feet = false
    expect(person.height).toBe(60)
    global.__debug = false
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
      static some = new Meta({
        type: Number,
        default: 0,
        validators: [
          {
            determine: true,
            validate: v => v > 0,
            message: 'Should bigger than 0.',
          },
        ],
      })
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
      static num = new Meta({
        type: Number,
        default: 0,
      })
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

    let count = 0
    any.watch('*', () => count ++, true)
    any.listd[0].num ++
    expect(count).toBe(1)
  })

  test('getter and setter', () => {
    class PersonModel extends Model {
      static name = new Meta({
        type: String,
        default: '',
      })

      static age = new Meta({
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
      })
    }
    const person = new PersonModel()

    expect(person.age).toBe('')

    person.age = 12
    expect(person.age).toBe('12')

    person.age = '30'
    const data = person.toData()
    expect(data.age).toBe(30)
  })

  test('message when type checking fail', () => {
    let error = null
    class SomeModel extends Model {
      static some = new Meta({
        default: '',
        type: String,
        message: 'it should be a string',
      })

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
      static some = new Meta({
        default: null,
        required() {
          return !this.isFund // use state to check whether need to be required
        },
      })

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

  test('static state in Meta', () => {
    class Some extends Meta {
      static state() {
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
    expect(it.$views.some.state.some_name).toBe('aa')

    it.$views.some.state.some_name = 'bb'
    expect(it.some).toBe('bb')
    expect(it.some_name).toBe('bb')
    expect(it.$views.some.state.some_name).toBe('bb')
  })

  test('watch attribute', () => {
    let count = 0

    class SomeModel extends Model {
      static some = new Meta({
        default: '',
        watch() {
          count ++
        },
      })
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
          name: new Meta({ default: 'some' }),
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

  test('static extend', () => {
    class Some extends Model {
      static name = new Meta({
        default: 'some',
      })
    }

    const One = Some.extend({
      age: {
        default: 0,
      },
    })
    const one = new One()
    // extend static methods are not there
    expect(one.extend).toBeUndefined()
    expect(one.name).toBe('some')
    expect(one.age).toBe(0)

    const Two = Some.extend(class {
      static age = new Meta({
        default: 10,
      })
      // because a field should must be defined by Meta, so when we set it to be a Non-Meta value, it will not be filed
      static name = null

      say() {
        return 100
      }
    })
    const two = new Two()
    expect(two.name).toBeUndefined()
    expect(two.age).toBe(10)
    expect(two.say()).toBe(100)

    const Three = Some.extend((Some) => {
      return Some.extend({
        age: {
          default: 0,
        },
        name: null,
      })
    })
    const three = new Three()
    expect(two.name).toBeUndefined()
    expect(two.age).toBe(10)
  })

  test('extends class', () => {
    class Name extends Meta {
      static default = 'some'
    }
    class Age extends Meta {
      static default = 0
    }
    class Some extends Model {
      static name = Name
    }
    class One extends Some {
      static age = Age
    }

    const one = new One()
    expect(one.$schema.name).toBeTruthy()
    expect(one.age).toBe(0)
    expect(one.name).toBe('some')

    class DogName extends Name {
      static default = 'dog'
    }

    class DogAge extends Age {
      static required = true
    }

    class Dog extends Model {
      static name = DogName
      static age = DogAge
    }

    const dog = new Dog()
    expect(dog.name).toBe('dog')
    expect(dog.$views.age.required).toBe(true)
  })
  test('compute + $parent + map', () => {
    class Child extends Model {
      static age = new Meta({
        default: 0,
        compute() {
          return this.$parent.age - 26
        },
        map(age) {
          return age + ''
        }
      })
    }

    class Parent extends Model {
      static age = new Meta({
        default: 0,
      })
      static child = Child
    }

    const one = new Parent({
      age: 30,
    })

    const data = one.toData()
    expect(data.child.age).toBe('4')
  })

  test('toJSON/fromJSON', () => {
    class Child extends Model {
      static name = new Meta({ default: 'lily' })
    }
    class Parent extends Model {
      static name = new Meta({ default: 'tom' })
      static age = new Meta({ default: 10 })
      static sex = new Meta({ default: 'M' })
      static child = Child
    }

    const one = new Parent()
    expect(one.child.name).toBe('lily')
    const backup = one.toJSON()
    expect(backup.child.name).toBe('lily')

    one.name = 'tomy'
    expect(one.name).toBe('tomy')

    one.fromJSON(backup)
    expect(one.name).toBe('tom')
  })

  test('Editor', () => {
    class Child extends Model {
      static name = new Meta({ default: 'lily' })
    }
    class Some extends Model {
      static name = new Meta({ default: '' })
      static age = new Meta({ default: 10 })
      static sex = new Meta({ default: 'M' })
      static child = Child
    }

    const some = new Some({
      name: 'tomy',
    })
    expect(some.name).toBe('tomy')
    expect(some.age).toBe(10)
    expect(some.child.name).toBe('lily')

    // use static method of Model
    const editor = new Some.toEdit(some)

    editor.name = 'tomi'
    expect(some.name).toBe('tomy')
    expect(editor.name).toBe('tomi')
    expect(editor.child.$parent).toBe(editor)

    editor.child.name = 'lucy'
    expect(editor.child.name).toBe('lucy')

    editor.reset() // reset to original data which generated by `new`
    expect(editor.name).toBe('tomy')
    expect(editor.child.name).toBe('lily')

    editor.age ++
    expect(editor.age).toBe(11)

    editor.commit('age_changed')

    editor.undo()
    expect(editor.age).toBe(10)

    editor.redo()
    expect(editor.age).toBe(11)

    editor.age ++
    expect(editor.age).toBe(12)

    editor.reset('age_changed')
    expect(editor.age).toBe(11)

    editor.name = 'tomi'
    editor.submit(some)
    expect(some.name).toBe('tomi')
    expect(some.age).toBe(11)

    // use method directly
    const editor2 = some.toEdit()

    editor2.name = 'tomy'
    expect(some.name).toBe('tomi')
    expect(editor2.name).toBe('tomy')
    expect(editor2.child.$parent).toBe(editor2)

    editor2.child.name = 'lucy'
    expect(editor2.child.name).toBe('lucy')

    editor2.reset() // reset to original data which generated by `new`
    expect(editor2.name).toBe('tomi')
    expect(editor2.child.name).toBe('lily')

    editor2.age = 10
    editor2.age ++
    expect(editor2.age).toBe(11)

    editor2.commit('age_changed')

    editor2.undo()
    expect(editor2.age).toBe(10)

    editor2.redo()
    expect(editor2.age).toBe(11)

    editor2.age ++
    expect(editor2.age).toBe(12)

    editor2.reset('age_changed')
    expect(editor2.age).toBe(11)

    editor2.name = 'tomi'
    editor2.submit()
    expect(some.name).toBe('tomi')
    expect(some.age).toBe(11)
  })

  test('$parent compute', () => {
    class Child extends Model {
      static age = new Meta({
        default: 0,
        compute() {
          return this.$parent.age - 26
        },
        map(age) {
          return age + ''
        }
      })
    }

    class Parent extends Model {
      static age = new Meta({
        default: 0,
      })
      static child = Child
    }

    const one = new Parent({
      age: 30,
    })

    expect(one.child.age).toBe(4)

    one.age = 40
    expect(one.child.age).toBe(14)
  })

  test('children (list) depend on $parent', () => {
    class Count extends Meta {
      static default = 0
      static compute() {
        return this.$parent.items.length
      }
    }

    class Item extends Model {
      static count = Count
    }

    class List extends Model {
      static items = [Item]
    }

    const list = new List({
      items: [{}, {}],
    })

    expect(list.items[0].count).toBe(2)
  })

  test('validateAsync', (done) => {
    class SomeModel extends Model {
      static some = new Meta({
        default: 0,
        validators: [
          {
            determine: true,
            validate: v => v > 0,
            message: 'Some should bigger than 0.',
          },
        ],
      })
      static any = new Meta({
        default: 10,
        validators: [
          {
            determine() {
              return Promise.resolve(true)
            },
            validate(v) {
              return new Promise((r) => {
                setTimeout(() => r(v > 10), 500)
              })
            },
            message() {
              return Promise.resolve('Any should bigger than 10.')
            },
            async: true,
          }
        ],
      })
    }

    const some = new SomeModel()

    // validate will ignore async validators
    const errors = some.validate()
    expect(errors.length).toBe(1)

    some.validateAsync().then((errors) => {
      expect(errors.length).toBe(2)
      expect(errors.message).toBe('Some should bigger than 0.')
      expect(errors[1].message).toBe('Any should bigger than 10.')
      done()
    })
  })

  test('view.keyPath & $root', () => {
    class Child extends Model {
      static name = new Meta({
        type: String,
        default: '',
      })
      static age = new Meta({
        type: Number,
        default: 0,
      })
    }

    class One extends Model {
      static name = new Meta({
        type: String,
        default: '',
      })
      static age = new Meta({
        type: Number,
        default: 0,
      })
      static children = [Child]
    }

    const one = new One({
      name: 'tomy',
      age: 30,
      children: [
        {
          name: 'lily',
          age: 6,
        },
      ],
    })

    expect(one.children[0].$root).toBe(one)
    expect(one.children[0].$absKeyPath).toEqual(['children', 0])
    expect(one.children[0].$views.name.absKeyPath).toEqual(['children', 0, 'name'])
  })

  test('attrs()', () => {
    class SomeModel extends Model {
      static dot = new Meta({
        type: String,
        default: '',
      })
      attrs() {
        return {
          some: true,
        }
      }
    }

    const some = new SomeModel()
    expect(some.$views.dot.hidden).toBe(false)
    expect(some.$views.dot.some).toBe(true)

    class FnModel extends SomeModel {
      static dot = new Meta({
        type: String,
        default: '',
      })
      attrs() {
        const attrs = super.attrs()
        return {
          ...attrs,
          fn: (key) => key,
        }
      }
    }

    const fn = new FnModel()
    expect(fn.$views.dot.hidden).toBe(false)
    expect(fn.$views.dot.some).toBe(true)
    expect(fn.$views.dot.fn).toBe('dot')
  })

  test('change sub-model list directly', () => {
    class Child extends Model {
      static name = new Meta({
        default: '',
        type: String,
      })

      static age = new Meta({
        default: 0,
        type: Number,
      })
    }

    class Parent extends Model {
      static children = [Child]
    }

    const parent = new Parent()
    expect(parent.children).toEqual([])
    parent.children.push({
      name: 'tomy',
    })
    expect(parent.children[0]).toBeInstanceOf(Child)
    expect(parent.children[0].name).toBe('tomy')
    parent.children.unshift({
      name: 'holy',
    })
    expect(parent.children.length).toBe(2)
    expect(parent.children[0]).toBeInstanceOf(Child)
    expect(parent.children[1]).toBeInstanceOf(Child)
    expect(parent.children[0].name).toBe('holy')
  })

  test('splice for sub-models', () => {
    class Child extends Model {
      static name = new Meta({
        default: '',
        type: String,
      })

      static age = new Meta({
        default: 0,
        type: Number,
      })
    }

    class Parent extends Model {
      static children = [Child]
    }

    const some = new Parent({
      children: [{}, {}],
    })

    expect(some.children.length).toBe(2)
    expect(some.children[0]).toBeInstanceOf(Child)
    expect(some.children[1]).toBeInstanceOf(Child)

    const child2 = some.children[1]
    some.children.splice(1, 0, {}, {})
    expect(some.children.length).toBe(4)
    expect(some.children[1]).toBeInstanceOf(Child)
    expect(some.children[2]).toBeInstanceOf(Child)
    expect(some.children[3]).toBeInstanceOf(Child)

    expect(some.children[1]).not.toBe(child2)
    expect(some.children[3]).toBe(child2)
  })

  test('fill for sub-models', () => {
    class Child extends Model {
      static name = new Meta({
        default: '',
        type: String,
      })

      static age = new Meta({
        default: 0,
        type: Number,
      })
    }

    class Parent extends Model {
      static children = [Child]
    }

    const some = new Parent({
      children: [{}, {}],
    })

    expect(some.children.length).toBe(2)
    expect(some.children[0]).toBeInstanceOf(Child)
    expect(some.children[1]).toBeInstanceOf(Child)

    const [child1, child2] = some.children
    some.children.fill({})
    expect(some.children.length).toBe(2)
    expect(some.children[0]).toBeInstanceOf(Child)
    expect(some.children[1]).toBeInstanceOf(Child)
    expect(some.children[0]).not.toBe(child1)
    expect(some.children[1]).not.toBe(child2)

    some.children.fill({}, 1)
    expect(some.children[1]).toBeInstanceOf(Child)
    expect(some.children[1]).not.toBe(child2)

    const child3 = some.children[1]
    some.children.fill({}, 1, 3) // greater than length
    expect(some.children.length).toBe(2)
    expect(some.children[1]).toBeInstanceOf(Child)
    expect(some.children[1]).not.toBe(child3)
  })

  test('Factory list', () => {
    class Child extends Model {
      static name = new Meta({
        default: '',
        type: String,
      })
    }

    class Parent extends Model {
      static children = Factory.getMeta([Child], {
        default: () => [{}],
      })
    }

    const some = new Parent()
    expect(some.children.length).toBe(1)
    expect(some.children[0]).toBeInstanceOf(Child)
  })

  test('$absKeyPath in sub-models', () => {
    class Sun extends Model {
      static age = new Meta({
        default: 0,
        type: Number,
      })
    }

    class Child extends Model {
      static name = new Meta({
        default: '',
        type: String,
      })
      static sub = Factory.getMeta([Sun], {
        default: () => [{}],
      })
    }

    class Parent extends Model {
      static top = [Child]
    }

    const some = new Parent({
      top: [{}, {}],
    })

    const child2 = some.top[1]
    expect(child2.$absKeyPath).toEqual(['top', 1])

    expect(child2.sub[0].$absKeyPath).toEqual(['top', 1, 'sub', 0])
  })

  test('Meta.deps', () => {
    class Name extends Meta {
      static default = ''
      static type = String
    }

    class Age extends Meta {
      static default = 10
      static type = Number
    }

    class Birth extends Meta {
      static default = 0
      static deps() {
        return {
          age: Age,
        }
      }
      static compute() {
        return this.age + 1990
      }
    }

    class Some extends Model {
      static name = Name
      static birth = Birth
    }

    const some = new Some()
    expect(some.age).toBe(10)
  })

  test('collect', () => {
    class Sun extends Model {
      static age = new Meta({
        default: 0,
        type: Number,
      })
    }

    class Child extends Model {
      static name = new Meta({
        default: '',
        type: String,
      })
      static sub = Factory.getMeta([Sun], {
        default: () => [{}],
      })
    }

    class Parent extends Model {
      static top = [Child]
    }

    const some = new Parent({
      top: [{}],
    })

    const sun = some.top[0].sub[0]
    expect(sun).toBeInstanceOf(Sun)
    sun.collect()
    sun.age
    const deps = sun.collect(true)
    expect(deps).toEqual(['age'])

    some.collect()
    some.top[0].sub[0].age
    some.top[0]
    some.top
    const deps2 = some.collect(true)
    expect(deps2).toEqual(['top[0].sub[0].age', 'top[0]', 'top'])
    expect(some.$collection).toBeUndefined()

    some.collect()
    sun.age
    const deps3 = some.collect(true)
    expect(deps3).toEqual(['top[0].sub[0].age'])
    expect(sun.$collection).toBeUndefined()
  })

  test('init use create', () => {
    class Some extends Model {
      static some = new Meta({
        default: {},
        create(value, key, data) {
          const { name, age } = data
          return { name, age }
        },
        type: {
          name: String,
          age: Number,
        },
      })
    }

    const some = new Some({
      name: 'tomy',
      age: 10,
    })

    expect(some.toData()).toEqual({
      some: {
        name: 'tomy',
        age: 10,
      }
    })

    some.fromJSON({
      name: 'tim',
      age: 12,
    })

    expect(some.toData()).toEqual({
      some: {
        name: 'tim',
        age: 12,
      }
    })
  })

  test('compute trigger watch by deps', () => {
    class Some extends Model {
      static age = new Meta({
        default: 10,
      })
      static height = new Meta({
        default: 20,
        compute() {
          return this.age * 2
        },
      })
    }
    const some = new Some()

    let count = 0
    some.watch('height', () => count ++)

    some.age ++
    expect(some.height).toBe(22)
    expect(count).toBe(1)
  })
})
