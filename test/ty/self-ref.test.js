import { Dict, SelfRef } from '../../src/ty/index.js'

describe('Self including type', () => {
  test('self include dict', () => {
    const Some = new SelfRef((Some) => new Dict({
      name: String,
      age: Number,
      children: [
        Some
      ],
    }))

    expect(() => Some.assert({
      name: 'tomy',
      age: 35,
      children: [
        {
          name: null,
        }
      ]
    })).toThrowError()

    expect(() => Some.assert({
      name: 'tomy',
      age: 35,
      children: [
        {
          name: 'dido',
          age: 5,
          children: [],
        }
      ]
    })).not.toThrowError()
  })
})
