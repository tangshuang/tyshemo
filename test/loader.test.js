import Loader from '../src/loader.js'
import json from './model.json'

describe('Loader', () => {
  test('parse', () => {
    const loader = new Loader()
    const Model = loader.parse(json)

    let errorCount = 0
    class SomeModel extends Model {
      onError() {
        errorCount ++
      }
    }
    const model = new SomeModel()

    expect(model.name).toBe('tomy')
    expect(model.age).toBe(10)

    model.age = '0'
    expect(model.age).toBe('0')
    expect(errorCount).toBe(1)

    expect(model.$views.name.required).toBe(false)
    model.age = 11
    expect(model.$views.name.required).toBe(true)

    expect(model.getWeight()).toBe(55)
  })
  test('async fetch method', (done) => {
    class AsyncLoader extends Loader {
      fetch() {
        return Promise.resolve({ a: 2 })
      }
    }
    const loader = new AsyncLoader()
    const SomeModel = loader.parse({
      schema: {},
      state: {
        a: 0,
      },
      methods: {
        'fetchA()': 'a = await fetch("").a',
        'onInit()': 'a = 1',
      },
    })

    const some = new SomeModel()
    expect(some.a).toBe(1)

    some.fetchA().then(() => {
      expect(some.a).toBe(2)
      done()
    })
  })
})
