import Model from '../src/model.js'
import Meta from '../src/meta.js'
import { formatDate, createDate } from 'ts-fns'

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
})
