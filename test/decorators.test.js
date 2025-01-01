import { meta, state } from '../es/decorators.js'
import { Model } from '../es/model.js'

class SomeModel extends Model {
  @meta({
    default: '',
  }) name

  @meta({
    default: 10,
  }) age

  @meta({
    default: 30,
    compute() {
      return this.age * 30
    },
  }) height

  @state({
    value: 40,
  }) weight
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
