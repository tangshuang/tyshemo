import Model from '../src/model.js'
import Schema from '../src/schema.js'
import { dict } from '../src/dict.js'

describe('Model', () => {
  class PersonModel extends Model {
    schema() {
      return new Schema({
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
        height: {
          type: Number,
          default: 0,
          compute() {
            return this.get('body.feet') ? 120 : 60
          },
        },
        weight: {
          type: Number,
          default: 20,
        },
      })
    }
  }

  test('computed', () => {
    const person = new PersonModel()
    const data = person.data

    expect(data.height).toBe(120)
    person.set('body.feet', false)

    expect(data.height).toBe(60)
    person.set('body.feet', true)
  })
  test('get', () => {
    const person = new PersonModel()
    expect(person.get('body.head')).toBe(true)
  })
  test('set', () => {
    const person = new PersonModel()

    person.set('body.feet', false)
    expect(person.get('body.feet')).toBe(false)
  })
  test('update', async () => {
    const person = new PersonModel()
    const data = person.data

    await person.update({
      name: 'tomy',
      age: 10,
    })
    expect(data.name).toBe('tomy')
    expect(data.age).toBe(10)
  })
  test('watch', () => {
    const person = new PersonModel()
    const data = person.data

    person.watch('age', function(age) {
      this.set('weight', age * 2 + 20)
    })
    person.set('age', 20)
    expect(data.weight).toBe(60)
  })

  test('sync update', () => {
    const person = new PersonModel()
    const data = person.data

    person.watch('age', function(age) {
      this.set('weight', age * 2 + 20)
    })

    data.age = 20
    person.update()

    expect(person.data.weight).toBe(60)
  })

  test('state', () => {
    const person = new PersonModel()
    const state = person.state

    // proxy with watcher
    person.watch('age', function(age) {
      state.weight = age * 2 + 20
    })
    expect(state.weight).toBe(20)
    state.age = 40
    expect(state.weight).toBe(100)

    // nested object with computed definition
    expect(state.height).toBe(120)
    state.body.feet = false
    expect(state.height).toBe(60)
  })

  test('delete', () => {
    const person = new PersonModel()
    const state = person.state

    // del method
    person.set('testkey', 'some')
    expect(state.testkey).toBe('some')
    expect(() => person.del('testkey')).not.toThrowError()
    expect(() => person.del('body.feet', true)).toThrowError()

    // delete state
    state.testkey = 'some'
    expect(state.testkey).toBe('some')
    expect(() => {
      delete state.testkey
    }).not.toThrowError()
    expect(() => {
      delete state.body.feet
    }).not.toThrowError()
  })
})
