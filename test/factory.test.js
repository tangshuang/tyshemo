import { Model } from '../src/model.js'
import { meta, state } from '../src/decorators.js'
import { Factory } from '../src/factory.js'
import { isInstanceOf } from 'ts-fns'

describe('Factory', () => {
  test('linkage', () => {
    class Child extends Model {
      @state({
        value: false,
      }) is_ok
    }

    class Parent extends Model {
      @state({
        value: true,
      }) is_ok

      @meta({
        default: 0,
      }) count

      @meta(
        [Child],
        {
          default: [{}],
        },
        {
          linkage(child, parent) {
            child.is_ok = parent.is_ok
          },
        },
      ) children
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

  test('selectMeta', () => {
    class A extends Model {
      @meta({
        default: 'a',
      }) a
    }

    class B extends Model {
      @meta({ default: 'b' }) b
    }

    const m = Factory.selectMeta([A, B], (_, data) => {
      if (data?.a) {
        return A
      }
      else {
        return B
      }
    })

    class C extends Model {
      @meta(m) c
    }

    const c = new C({
      c: {
        a: '1',
      },
    })

    expect(c.c.a).toBe('1')
    expect(isInstanceOf(c.c, A)).toBe(true)

    c.c = {
      b: '2',
    }
    expect(c.c.b).toBe('2')
    expect(isInstanceOf(c.c, B)).toBe(true)
  })

  test('selectMeta List', () => {
    class A extends Model {
      @meta({
        default: 'a',
      }) a
    }

    class B extends Model {
      @meta({ default: 'b' }) b
    }

    const m = Factory.selectMeta([[A, B]], (_, data) => {
      if (data.a) {
        return A
      }
      else if (data.b) {
        return B
      }
    })

    class C extends Model {
      @meta(m) c
    }

    const c = new C()

    expect(c.c).toEqual([])

    c.c.push({ a: '1' })
    expect(c.c[0]?.a).toBe('1')
    expect(isInstanceOf(c.c[0], A)).toBe(true)

    c.c.push({ b: '2' })
    expect(c.c[1]?.b).toBe('2')
    expect(isInstanceOf(c.c[1], B)).toBe(true)
  })
})
