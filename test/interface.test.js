import { createAsyncMeta } from '../src/interface.js'
import { Model } from '../src/model'
import { Loader } from '../src/complete/loader'

describe('Interface', () => {
  test('createAsyncMeta', (done) => {
    const SomeMeta = createAsyncMeta({
      default: 1,
    }, () => {
      return new Promise((resolve) => {
        setTimeout(() => {
          resolve({
            required: true,
            hidden() {
              return this.a > 10
            },
            disabled(v) {
              return v < 10
            },
          })
        }, 10)
      })
    })

    class Some extends Model {
      state() {
        return {
          a: 12,
        }
      }
      static some = SomeMeta
    }

    const some = new Some()

    setTimeout(() => {
      expect(some.some).toBe(1)
      expect(some.a).toBe(12)
      expect(some.use('some').required).toBe(true)
      expect(some.use('some').hidden).toBe(true)
      expect(some.use('some').disabled).toBe(true)
      done()
    }, 100)
  })

  test('createAsyncMeta with loader', (done) => {
    const SomeMeta = createAsyncMeta({
      default: 1,
    }, () => {
      return new Promise((resolve) => {
        setTimeout(() => {
          resolve(Loader.parseAttrs({
            required: true,
            hidden: '{ a > 10 }',
            'disabled(v)': '{ v < 10 }',
          }))
        }, 10)
      })
    })

    class Some extends Model {
      state() {
        return {
          a: 12,
        }
      }
      static some = SomeMeta
    }

    const some = new Some()

    setTimeout(() => {
      expect(some.some).toBe(1)
      expect(some.a).toBe(12)
      expect(some.use('some').required).toBe(true)
      expect(some.use('some').hidden).toBe(true)
      expect(some.use('some').disabled).toBe(true)
      done()
    }, 100)
  })
})
