import Type from '../src/type.js'

describe('Type', () => {
  describe('assert', () => {
    test('Number', () => {
      const NumberType = new Type(Number)
      expect(() => NumberType.assert(1)).not.toThrowError()
      expect(() => NumberType.assert('123')).toThrowError()
      expect(() => NumberType.assert(NaN)).toThrowError()
      expect(() => NumberType.assert(Infinity)).toThrowError()
      expect(() => NumberType.assert(new Number(1))).toThrowError()
    })
    test('Array', () => {
      const ArrayType = new Type(Array)
      expect(() => ArrayType.assert([])).not.toThrowError()
      expect(() => ArrayType.assert(null)).toThrowError()
    })
    test('custom class', () => {
      class MyClass {}
      const MyType = new Type(MyClass)
      const instance = new MyClass()
      expect(() => MyType.assert(instance)).not.toThrowError()
      expect(() => MyType.assert(null)).toThrowError()
    })
    test('Object', () => {
      const MyType = new Type(Object)
      expect(() => MyType.assert(null)).toThrowError()
      expect(() => MyType.assert([])).toThrowError()
      expect(() => MyType.assert({})).not.toThrowError()
    })
    test('value equal', () => {
      const MyType = new Type('value')
      expect(() => MyType.assert('value')).not.toThrowError()
      expect(() => MyType.assert('not')).toThrowError()
    })
    test('NaN', () => {
      const MyType = new Type(NaN)
      expect(() => MyType.assert(+'fss')).not.toThrowError()
      expect(() => MyType.assert(10 + '12')).toThrowError()
    })
    test('Boolean', () => {
      const MyType = new Type(Boolean)
      expect(() => MyType.assert(true)).not.toThrowError()
      expect(() => MyType.assert(false)).not.toThrowError()
      expect(() => MyType.assert(1)).toThrowError()
      expect(() => MyType.assert(0)).toThrowError()
    })
    test('String', () => {
      const MyType = new Type(String)
      expect(() => MyType.assert('111')).not.toThrowError()
      expect(() => MyType.assert(111)).toThrowError()
      expect(() => MyType.assert(new String('...'))).toThrowError()
    })
    test('RegExp', () => {
      const MyType = new Type(RegExp)
      expect(() => MyType.assert(/ok/)).not.toThrowError()
      expect(() => MyType.assert('')).toThrowError()
    })
    test('Function', () => {
      const MyType = new Type(Function)
      expect(() => MyType.assert(() => {})).not.toThrowError()
      expect(() => MyType.assert(null)).toThrowError()
    })
    test('Symbol', () => {
      const MyType = new Type(Symbol)
      expect(() => MyType.assert(Symbol('xxx'))).not.toThrowError()
      expect(() => MyType.assert(null)).toThrowError()
    })
    test('Date (native class)', () => {
      const MyType = new Type(Date)
      expect(() => MyType.assert(new Date('2019-08-29'))).not.toThrowError()
      expect(() => MyType.assert(null)).toThrowError()
    })
    test('{}', () => {
      const SomeType = new Type({
        name: String,
        age: Number,
      })
      expect(() => SomeType.assert({ name: 'Tomy', age: 10 })).not.toThrowError()
      expect(() => SomeType.assert({ name: 'Tomy' })).toThrowError()
    })
    test('[]', () => {
      const SomeType = new Type([String, Number])
      expect(() => SomeType.assert([10, 'Tomy'])).not.toThrowError()
      expect(() => SomeType.assert(null)).toThrowError()
    })
  })
  describe('test', () => {
    test('true', () => {
      const MyType = new Type(Number)
      expect(MyType.test(10)).toBeTruthy()
    })
    test('false', () => {
      const MyType = new Type(Number)
      expect(MyType.test('10')).toBeFalsy()
    })
  })
  describe('catch', () => {
    test('null', () => {
      const NumberType = new Type(Number)
      expect(NumberType.catch(1)).toBeNull()
    })
    test('error', () => {
      const NumberType = new Type(Number)
      expect(NumberType.catch('1')).toBeInstanceOf(Error)
    })
  })
  describe('track', () => {
    test('then', (done) => {
      const MyType = new Type(Number)
      MyType.track(10).then(done)
    })
    test('catch', () => {
      const MyType = new Type(Number)
      return expect(MyType.track('10')).rejects.toBeInstanceOf(Error)
    })
  })
  describe('trace', () => {
    test('then', (done) => {
      const MyType = new Type(Number)
      MyType.trace(10).then(done)
    })
    test('catch', () => {
      const MyType = new Type(Number)
      return expect(MyType.trace('10')).rejects.toBeInstanceOf(Error)
    })
  })
})
