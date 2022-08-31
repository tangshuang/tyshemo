import { Model } from '../src/model.js'
import { Meta } from '../src/meta.js'
import { formatDate, createDate } from 'ts-fns'
import { Numeric } from '../src/ty/index.js'
import { createMetaGroup, createMeta, createAsyncMeta } from '../src/interface.js'

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

  test('createMetaGroup', () => {
    const [NameMeta, AgeMeta, HeightMeta] = createMetaGroup(3, (NameMeta, AgeMeta, HeightMeta) => [
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
})
