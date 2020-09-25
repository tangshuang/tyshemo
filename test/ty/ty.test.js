import { Ty } from '../../src/ty/index.js'

describe('Ty', () => {
  test('decorate', () => {
    // string
    expect(() => {
      const a = Ty.decorate('xx').with(String)
      expect(a).toBe('xx')
    }).not.toThrowError()
    // number
    expect(() => {
      const a = Ty.decorate(0).with(String)
    }).toThrowError()

    // function
    const fn = (a, b) => a + b
    const add = Ty.decorate(fn).with([Number, Number], Number)
    expect(() => {
      const r = add(1, 2)
      expect(r).toBe(3)
    }).not.toThrowError()
    expect(() => {
      const r = add('1', '2')
      expect(r).toBe('12')
    }).toThrowError()

    // object
    const obj = Ty.decorate({}).with({
      name: String,
      age: Number,
      height: Number,
    })
    expect(() => {
      obj.name = 'xxx'
      obj.age = 10
      obj.height = 50
    }).not.toThrowError()
    expect(() => {
      obj.name = null
    }).toThrowError()
    expect(() => {
      obj.age = null
    }).toThrowError()
    expect(() => {
      obj.height = null
    }).toThrowError()

    // array
    const arr = Ty.decorate([]).with([{
      name: String,
      age: Number,
      height: Number,
    }])
    expect(() => {
      arr.push(null)
    }).toThrowError()
    expect(() => {
      arr.push({
        name: 'xxx',
        age: 10,
        height: 50,
      })
    }).not.toThrowError()
    expect(() => {
      arr[0].name = 'aaa'
    }).not.toThrowError()
    expect(() => {
      arr[0].name = null
    }).toThrowError()

    // class
    @Ty.decorate.with([Number, Number])
    class Some {
      @Ty.decorate.with(String)
      name = 'xxx'

      @Ty.decorate.with([String])
      set family(v) {
        this.name = v + 'xxx'
      }

      constructor(a, b) {
        this.x = a + b
      }

      @Ty.decorate.with([Number, Number], Number)
      plus(a, b) {
        return a + b
      }
    }
    expect(() => {
      const some = new Some()
    }).toThrowError()
    expect(() => {
      const some = new Some(1, 2)
      expect(some.x).toBe(3)
      expect(some.name).toBe('xxx')
    }).not.toThrowError()
    const some = new Some(1, 2)
    expect(some.x).toBe(3)
    expect(() => {
      const sum = some.plus(1, '2')
    }).toThrowError()
    expect(() => {
      const sum = some.plus(1, 2)
    }).not.toThrowError()
    expect(() => {
      some.name = null
    }).toThrowError()
    expect(() => {
      some.name = 'null'
    }).not.toThrowError()
    expect(() => {
      some.family = null
    }).toThrowError()
    expect(() => {
      some.family = 'null'
    }).not.toThrowError()
  })
})