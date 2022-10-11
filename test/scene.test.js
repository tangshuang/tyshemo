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

    const some = new (SomeModel.Scene('Scene1'))()
    expect(some.some).toBe(2)

    const tank = new (SomeModel.Scene('Scene2'))()
    expect(tank.some).toBe(3)
  })

  test('Model#Scene', () => {
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

    class Some1Model extends Model.Scene('Scene1') {
      static some = SomeMeta
    }

    const some = new Some1Model()
    expect(some.some).toBe(2)


    class Some2Model extends Model.Scene('Scene2') {
      static some = SomeMeta
    }

    const tank = new Some2Model()
    expect(tank.some).toBe(3)
  })

  test('Meta#Scene', () => {
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

    class Some1Model extends Model {
      static some = SomeMeta.Scene('Scene1')
    }

    const some = new Some1Model()
    expect(some.some).toBe(2)

    class Some2Model extends Model {
      static some = SomeMeta.Scene('Scene2')
    }

    const tank = new Some2Model()
    expect(tank.some).toBe(3)
  })

  test('Meta.Scene', () => {
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

    const meta = new SomeMeta()

    class Some1Model extends Model {
      static some = meta.Scene('Scene1')
    }

    const some = new Some1Model()
    expect(some.some).toBe(2)

    class Some2Model extends Model {
      static some = meta.Scene('Scene2')
    }

    const tank = new Some2Model()
    expect(tank.some).toBe(3)
  })

  test('multiple scenes, priority of after is higher than before', () => {
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

    const MultiSceneModel = SomeModel.Scene(['Scene2', 'Scene1'])
    const some = new MultiSceneModel()
    expect(some.some).toBe(2)
  })
})
