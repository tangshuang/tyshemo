import Model from '../src/model.js'
import { dict } from '../src/dict.js'

describe('Model', () => {
  class PersonModel extends Model {
    define() {
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
    person.set('body.feet', false)
    await person.update()
    expect(person.get('body.feet')).toBe(false);
  })
  test('update', async () => {
    await person.update({
      name: 'tomy',
      age: 10,
    })
    const data = person.data()
    expect(data.name).toBe('tomy')
    expect(data.age).toBe(10)
  })
  test('set value which not fix type', async () => {
    expect.assertions(2)
    person.set('body.hands', 10)
    await expect(person.update()).rejects.toBeInstanceOf(Error)
    expect(person.get('body.hands')).not.toBe(10)
    expect(person.get('body.hands')).toBe(true)
  })
})
