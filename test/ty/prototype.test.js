import { Null, Undefined, Numeric, Int, Float, Any, Type } from '../../es/ty/index.js'

describe('Prototypes', () => {
  test('Null', () => {
    const SomeType = new Type(Null)
    expect(SomeType.test(null)).toBe(true)
    expect(SomeType.test('null')).toBe(false)
  })
  test('Undefined', () => {
    const SomeType = new Type(Undefined)
    expect(SomeType.test(undefined)).toBe(true)
    expect(SomeType.test('xxx')).toBe(false)
  })
  test('Numeric', () => {
    const SomeType = new Type(Numeric)
    expect(SomeType.test('10')).toBe(true)
    expect(SomeType.test(10)).toBe(true)
    expect(SomeType.test('10a')).toBe(false)

    const NumType = new Type(Numeric.Number)
    expect(NumType.test(10)).toBe(true)
    expect(NumType.test('10')).toBe(false)
  })
  test('Int', () => {
    const SomeType = new Type(Int)
    expect(SomeType.test(10)).toBe(true)
    expect(SomeType.test(10.1)).toBe(false)
    expect(SomeType.test('10')).toBe(true)

    const IntType = new Type(Int.String)
    expect(IntType.test('10')).toBe(true)
    expect(IntType.test(10)).toBe(false)
  })
  test('Float', () => {
    const SomeType = new Type(Float)
    expect(SomeType.test(10.1)).toBe(true)
    expect(SomeType.test(10)).toBe(false)
    expect(SomeType.test('10.1')).toBe(true)

    const NumType = new Type(Float.String)
    expect(NumType.test(10.1)).toBe(false)
    expect(NumType.test('10.1')).toBe(true)
  })
  test('Any', () => {
    const SomeType = new Type(Any)
    expect(SomeType.test(10.1)).toBe(true)
    expect(SomeType.test(10)).toBe(true)
    expect(SomeType.test('10')).toBe(true)
    expect(SomeType.test(null)).toBe(true)
    expect(SomeType.test(undefined)).toBe(true)
    expect(SomeType.test([])).toBe(true)
    expect(SomeType.test({})).toBe(true)
  })
})
