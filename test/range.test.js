import { Range } from '../src/index.js'

describe('Range', () => {
  test('range', () => {
    const RangeType = new Range({
      min: 0,
      max: 100,
      minBound: false,
      maxBound: true,
    })

    expect(() => RangeType.assert(10)).not.toThrowError()
    expect(() => RangeType.assert(100)).not.toThrowError()
    expect(() => RangeType.assert(0)).toThrowError()
    expect(() => RangeType.assert(-1)).toThrowError()
    expect(() => RangeType.assert(101)).toThrowError()
  })
})
