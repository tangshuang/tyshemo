import { meta, state } from '../src/decorators.js'
import { Model } from '../src/model.js'

class SomeModel extends Model {
  @meta()
  name = ''

  @meta()
  age = 10

  @meta({
    compute() {
      return this.age * 30
    },
  })
  height = 30

  @state()
  weight = 40
}

describe('Decorators', () => {
  const some = new SomeModel()

  test('normal', () => {
    let count = 0
    const fn = () => {
      count ++
    }

    some.watch('age', fn)
    some.age ++

    expect(count).toBe(1)
    some.unwatch('age', fn)

    some.watch('weight', fn)
    some.weight ++
    expect(some.weight).toBe(41)
    expect(count).toBe(2)
    some.unwatch('weight', fn)
  })
})
