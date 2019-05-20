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

  const person = new PersonModel()
  const data = person.data

  test('computed', () => {
    expect(data.height).toBe(120)
    person.set('body.feet', false)

    expect(data.height).toBe(60)
    person.set('body.feet', true)
  })
  test('get', () => {
    expect(person.get('body.head')).toBe(true)
  })
  test('set', () => {
    person.set('body.feet', false)
    expect(person.get('body.feet')).toBe(false)
  })
  test('update', async () => {
    await person.update({
      name: 'tomy',
      age: 10,
    })
    expect(data.name).toBe('tomy')
    expect(data.age).toBe(10)
  })
  test('watch', () => {
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
})
