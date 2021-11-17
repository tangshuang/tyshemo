import { Shape } from '../../src/ty/shape.js'
import { SelfRef } from '../../src/ty/self-ref.js'
import { ifexist } from '../../src/ty/rules.js'

describe('Shape', () => {
  test('shape', () => {
    class B {
      x = 1
      y = 2
    }

    class A {
      x = 1
      y = 2

      a = new B()
    }

    const a = new A()

    const t = new SelfRef((t) => new Shape({
      x: Number,
      y: Number,
      a: ifexist(t),
    }))

    expect(t.test(a)).toBeTruthy()
  })
})
