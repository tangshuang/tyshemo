import { Shape } from '../../es/ty/shape.js'
import { SelfRef } from '../../es/ty/self-ref.js'
import { ifexist } from '../../es/ty/rules.js'

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
