import { Model } from '../es/model.js'
import { meta, state } from '../es/decorators.js'
import { Factory } from '../es/factory.js'
import { isInstanceOf } from 'ts-fns'
import { Meta } from '../es/meta.js'

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

  test('override', () => {
    class SomeMeta extends Meta {
      static default = 1
      static required(v) {
        return v < 5
      }
    }

    class SomeModel extends Model {
      static some = SomeMeta
    }

    const SomesMeta = Factory.createMeta([SomeModel], {
      default: [{}],
    }, {
      override() {
        return [
          {
            meta: SomeMeta,
            attrs: {
              required(v) {
                return v < 10
              },
            },
          },
        ]
      },
    })

    class TopModel extends Model {
      static somes = SomesMeta
    }

    const top = new TopModel()
    expect(top.somes[0].$views.some.required).toBe(true)

    top.somes[0].some = 8
    expect(top.somes[0].$views.some.required).toBe(true)

    top.somes[0].some = 11
    expect(top.somes[0].$views.some.required).toBe(false)
  })
})
