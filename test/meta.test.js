import Model from '../src/model.js'
import Meta from '../src/meta.js'
import { formatDate, createDate } from 'ts-fns'
import { Numeric } from '../src/ty/index.js'

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
})
