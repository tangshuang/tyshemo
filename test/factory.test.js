import { Factory } from '../src/factory.js'
import { Model } from '../src/model.js'
import { meta, state } from '../src/decorators.js'

describe('Factory', () => {
  test('transport', () => {
    class Child extends Model {
      @state()
      is_ok = false
    }

    class Parent extends Model {
      @state()
      is_ok = false

      @meta()
      count = 0

      @meta([Child], null, {
        transport(child, parent) {
          child.is_ok = parent.is_ok
        },
      })
      children = [{}]
    }

    const ins = new Parent()
    expect(ins.is_ok).toBe(false)
    expect(ins.children[0].is_ok).toBe(false)

    ins.is_ok = true
    expect(ins.children[0].is_ok).toBe(true)
  })
})
