import { SceneMeta } from '../src/meta'
import { Model } from '../src/model'

describe('Scene', () => {
  test('basic', () => {
    class SomeMeta extends SceneMeta {
      static default = 1
      defineScenes() {
        return {
          Scene1: {
            default: 2,
          },
          Scene2: {
            default: 3,
          },
        }
      }
    }

    class SomeModel extends Model {
      static some = SomeMeta
    }

    const some = new SomeModel.Scene.Scene1()
    expect(some.some).toBe(2)

    const tank = new SomeModel.Scene.Scene2()
    expect(tank.some).toBe(3)
  })
})
