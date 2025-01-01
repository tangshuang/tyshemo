import { Model } from '../es/model.js'
import { Meta, StateMeta } from '../es/meta.js'
import { formatDate, createDate } from 'ts-fns'
import { Numeric } from '../es/ty/index.js'
import { createMetaRef, createMeta, createAsyncMeta } from '../es/interface.js'

describe('Meta', () => {
  test('extend', () => {
    class Name extends Meta {
      static default = ''
    }

    class Age extends Meta {
      static default = 10
    }

    class Some extends Model {
      static name = Name.extend(class {
        static default = 'some'
      })

      static age = Age

      static weight = Name.extend(class {
        static label = 'Weight'
        static compute = function() {
          return this.age * 5
        }
      })
    }

    const some = new Some()

    expect(some.name).toBe('some')
    expect(some.weight).toBe(50)
    expect(some.$views.weight.label).toBe('Weight')
  })
  test('asset', () => {
    class Time extends Meta {
      static default = ''
      static asset = 'time_at'
      static create(value) {
        return formatDate(value, 'YYYY/MM/DD')
      }
      static save(value) {
        const date = createDate(value, 'YYYY/MM/DD')
        const text = formatDate(date, 'YYYY-MM-DD')
        return text
      }
    }

    class Some extends Model {
      static time = Time
    }

    const some = new Some({
      time_at: new Date('2020-10-01'),
    })
    expect(some.time).toBe('2020/10/01')

    const json = some.toJSON()
    expect(json.time_at).toBe('2020-10-01')
  })

  test('force', () => {
    class Price extends Meta {
      static default = 0
      static type = Numeric
      static force = true
    }
    class Good extends Model {
      static price = Price
    }

    const good = new Good()
    expect(good.price).toBe(0)

    good.price = null
    expect(good.price).toBe(0)

    good.price = 10
    expect(good.price).toBe(10)
  })

  test('attribute getter', () => {
    class Price extends Meta {
      static default = 0
      static type = Numeric
      static force = true
    }
    class Discount extends Meta {
      static default = 0
      static will_cost() {
        return this.reflect(Price).value
      }
      static type = Numeric
    }

    class Good extends Model {
      static price = Price
      static discount = Discount
    }

    const good = new Good({
      price: 12,
    })
    expect(good.use('discount').will_cost).toBe(12)
  })

  test('without static', () => {
    class Price extends Meta {
      default = 0
      type = Numeric
      force = true
    }
    class Discount extends Meta {
      default = 0
      will_cost() {
        return this.reflect(Price).value
      }
      type = Numeric
    }

    class Good extends Model {
      static price = Price
      static discount = Discount
    }

    const good = new Good({
      price: 12,
    })
    expect(good.use('discount').will_cost).toBe(12)
  })

  test('createMetaRef', () => {
    const [NameMeta, AgeMeta, HeightMeta] = createMetaRef((NameMeta, AgeMeta, HeightMeta) => [
      createMeta({
        default: 'tom',
        total() {
          return this.use(NameMeta).value.length + this.use(AgeMeta).value + this.use(HeightMeta).value
        },
      }),
      createMeta({
        default: 10,
      }),
      createMeta({
        default: 80,
      }),
    ])

    class SomeModel extends Model {
      static $_name = NameMeta
      static age = AgeMeta
      static height = HeightMeta
    }

    const some = new SomeModel()

    expect(some.name).toBe('tom')
    expect(some.age).toBe(10)
    expect(some.height).toBe(80)

    expect(some.use('name').total).toBe(93)
  })

  test('meta.extend', () => {
    const SomeMeta = new Meta({
      default: '',
    })

    const SubMeta = SomeMeta.extend({
      default: '1',
    })

    class Any extends Model {
      static any = SubMeta
    }

    const it = new Any()

    const any = it.use(SomeMeta)

    expect(any?.value).toBe('1')
  })

  test('createAsyncMeta', (done) => {
    const AasyncMeta = createAsyncMeta({
      default: '',
    }, () => new Promise(r => setTimeout(() => {
      r({
        required: true,
      })
    }, 300)))

    class SomeModel extends Model {
      static a = AasyncMeta
    }

    const some = new SomeModel()
    expect(some.$views.a.required).toBe(false)

    setTimeout(() => {
      expect(some.$views.a.required).toBe(true)
      done()
    }, 310)
  })

  test('compute changed', () => {
    class Some extends Model {
      static weight = new Meta({
        default: 10,
      })
      static height = new Meta({
        default: 0,
        compute() {
          return this.weight + 2
        },
      })
    }

    const some = new Some()
    expect(some.height).toBe(12)
    some.weight ++
    expect(some.height).toBe(13)

    some.height = 1
    expect(some.height).toBe(1)
    some.weight ++
    expect(some.height).toBe(1) // has been changed, will use manully value
  })

  test('custom getter', () => {
    const someMeta = new Meta({
      default: 0,
      custom: (value) => {
        return value > 1
      },
    })

    class Some extends Model {
      static some = someMeta
    }

    const some = new Some()

    expect(some.use('some', view => view.custom)).toBe(false)
    some.some = 2
    expect(some.use('some', view => view.custom)).toBe(true)
  })

  test('StateMeta', () => {
    class SomeState extends StateMeta {
      static value = 1
    }

    class SomeModel extends Model {
      static some = SomeState
    }

    const some = new SomeModel()
    expect(some.some).toBe(1)

    some.some = 2
    expect(some.some).toBe(2)

    const data = some.toData()
    expect(data.some).toBeUndefined()
  })

  test('factors', () => {
    class A_Meta extends Meta {
      default = 'a'
    }

    class B_Meta extends Meta {
      factors() {
        return [A_Meta]
      }
      default = 'b'
    }

    class C_Meta extends Meta {
      factors() {
        return [A_Meta]
      }
      default = 'c'
    }

    class Child extends Model {
      static c = C_Meta
    }

    class Parent extends Model {
      static a = A_Meta
      static b = B_Meta
      static child = Child
    }

    const some = new Parent()

    let count = 0
    some.watch('!b', () => {
      count ++
    })
    some.a = 1
    expect(count).toBe(1)

    let flag = 0
    some.child.watch('!c', () => {
      count ++
      flag ++
    })
    some.a = 2
    expect(flag).toBe(1)
    expect(count).toBe(3)
  })

  test('change computed filed', () => {
    class CountMeta extends Meta {
      static default = 1
    }
    class SomeMeta extends Meta {
      static default = 0
      static compute() {
        const count = this.use(CountMeta, view => view.value)
        return count * 10
      }
    }
    class SomeModel extends Model {
      static count = CountMeta
      static some = SomeMeta
    }

    const some = new SomeModel()
    let count = 0
    some.watch(SomeMeta, () => {
      count ++
    })
    expect(some.some).toBe(10)

    some.count ++
    expect(some.some).toBe(20)
    expect(count).toBe(1)

    some.some = 21
    expect(some.some).toBe(21)
    expect(count).toBe(2)

    // after change manully, lose computed
    some.count ++ // no effects
    expect(some.some).toBe(21)
    expect(count).toBe(2)

    some.reset(SomeMeta) // trigger watcher
    expect(some.some).toBe(30)
    expect(count).toBe(3)

    // after reset, it recover to computed
    some.count ++
    expect(some.some).toBe(40)
    expect(count).toBe(4)

    some.fromJSON({
      count: 1,
    })
    expect(some.some).toBe(10)

    global.__debug = 1
    // make it non-computed when restore
    some.fromJSON({
      count: 1,
      some: 9,
    })
    expect(some.some).toBe(9)
    global.__debug = 0
  })
})
