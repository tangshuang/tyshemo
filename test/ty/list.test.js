import { List } from '../../src/ty/index.js'

describe('List', () => {
  describe('assert', () => {
    test('basic', () => {
      const ListType = new List([String, Number])
      expect(() => { ListType.assert(['tomy', 10]) }).not.toThrowError()
      expect(() => { ListType.assert([10, 10]) }).not.toThrowError()
      expect(() => { ListType.assert(['tomy', '10']) }).not.toThrowError()
      expect(() => { ListType.assert([null, 10]) }).toThrowError()
      expect(() => { ListType.assert(['tomy', 10, 10]) }).not.toThrowError()
      expect(() => { ListType.assert(['tomy', 10, null]) }).toThrowError()
    })
    test('empty array', () => {
      const ListType = new List([])
      expect(() => { ListType.assert([]) }).not.toThrowError()
      expect(() => { ListType.assert([1, 'String', null]) }).not.toThrowError()
    })
  })
  describe('test', () => {
    test('basic', () => {
      const ListType = new List([String, Number])
      expect(ListType.test(['tomy', 10])).toBeTruthy()
      expect(ListType.test(['tomy', 10, null])).toBeFalsy()
    })
  })
  describe('catch', () => {
    test('basic', () => {
      const ListType = new List([String, Number])
      expect(ListType.catch(['tomy', 10])).toBeNull()
      expect(ListType.catch(['tomy', null])).toBeInstanceOf(Error)
    })
  })
  describe('trace', () => {
    test('basic', (done) => {
      const ListType = new List([String, Number])
      ListType.trace(['tomy', null]).catch((error) => {
        expect(error).toBeInstanceOf(Error)
        done()
      })
    })
  })
})
