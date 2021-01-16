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
})
