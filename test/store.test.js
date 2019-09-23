import { Store } from '../src/index.js'

describe('Model', () => {
  const store = new Store({
    name: 'tomy',
    age: 10,
    body: {
      head: true,
      hands: true,
      feet: true,
    },
    books: [
      'One Dog',
      'See Blue',
    ],
  })

  test('get', () => {
    expect(store.get('name')).toBe('tomy')
    expect(store.get('body.head')).toBe(true)
    expect(store.get('books[1]')).toBe('See Blue')
  })
  test('set', () => {
    store.set('body.feet', false)
    expect(store.get('body.feet')).toBe(false)
  })
  test('update', async () => {
    const data = store.data

    await store.update({
      name: 'tomi',
      age: 11,
    })

    expect(data.name).toBe('tomi')
    expect(data.age).toBe(11)
  })
  test('watch', () => {
    const data = store.data

    store.watch('age', function(age) {
      this.set('weight', age * 2 + 20)
    })
    store.set('age', 20)
    expect(data.weight).toBe(60)
    store.unwatch('age')
  })
  test('state', () => {
    const state = store.state

    store.watch('age', function(age) {
      state.weight = age * 2 + 20
    })

    state.age = 40
    expect(state.weight).toBe(100)
    store.unwatch('age')
  })

  test('delete', () => {
    const state = store.state

    // del method
    store.set('testkey', 'some')
    expect(state.testkey).toBe('some')

    delete state.testkey
    expect(store.data.testkey).toBeUndefined()
  })

  test('computed', () => {
    const computedStore = new Store({
      name: 'computed',
      age: 10,
      get weight() {
        return this.age * 5
      },
      set weight(value) {
        this.age = value / 5
      },
    })

    const { state } = computedStore
    expect(state.weight).toBe(50)

    state.weight = 100
    expect(state.age).toBe(20)
    expect(state.weight).toBe(100)

    delete state.weight
    expect(state.weight).toBeUndefined()
  })
})
