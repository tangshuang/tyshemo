import Model from '../src/model.js'
import { dict } from '../src/dict.js'

describe('Model', () => {
  class PersonModel extends Model {
    schema() {
      return {
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
      }
    }
  }

  const person = new PersonModel()

  test('get', () => {
    expect(person.get('body.head')).toBe(true)
  })
  test('set', async () => {
    await person.set('body.feet', false)
    expect(person.get('body.feet')).toBe(false)
  })
  test('update', async () => {
    await person.update({
      name: 'tomy',
      age: 10,
    })
    const data = person.data
    expect(data.name).toBe('tomy')
    expect(data.age).toBe(10)
  })
})
