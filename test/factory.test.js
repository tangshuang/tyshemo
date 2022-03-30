import { Model } from '../src/model.js'
import { meta, state } from '../src/decorators.js'

describe('Factory', () => {
  test('transport', () => {
    class Child extends Model {
      @state({
        value: false,
      })
      is_ok;
    }

    class Parent extends Model {
      @state({
        value: true,
      })
      is_ok;

      @meta({
        default: 0,
      })
      count;

      @meta(
        [Child],
        {
          default: [{}],
        },
        {
          transport(child, parent) {
            child.is_ok = parent.is_ok
          },
        },
      )
      children;
    }

    /**
     * when initialize, sync to child
     */
    const ins = new Parent()
    expect(ins.is_ok).toBe(true)
    expect(ins.children[0].is_ok).toBe(true)

    /**
     * when change parent, sync to child
     */
    ins.is_ok = false
    expect(ins.children[0].is_ok).toBe(false)

    /**
     * when add new child, sync parent to child
     */
    ins.children.push({})
    expect(ins.children[1].is_ok).toBe(false)
  })
})
