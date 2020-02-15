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
    const store = new Store({
      name: 'computed',
      age: 10,
      get weight() {
        return this.age * 5
      },
      set weight(value) {
        this.age = value / 5
      },
      get length() {
        return this.weight + 120
      },
    })

    const { state } = store
    expect(state.weight).toBe(50)

    // define a new computed property
    store.define('height', function() {
      return this.age * 8 + this.weight / 100 * 10
    })
    expect(state.height).toBe(85)

    // change the basic dependency
    state.age = 20
    expect(state.weight).toBe(100)
    expect(state.height).toBe(170)

    // change by setter
    state.weight = 200
    expect(state.age).toBe(40)
    expect(state.weight).toBe(200)
    expect(state.height).toBe(340)

    // delete computed property
    delete state.height
    expect(state.height).toBeUndefined()
  })

  test('spread', () => {
    const store = new Store({
      name: 'tomy',
      books: [1, 2, 3, 4],
    })
    store.state.books.push(5)
    store.state.books.push({
      age: 10,
    })

    const another = {
      ...store.state,
      books: [...store.state.books],
    }

    expect(another.name).toBe('tomy')
    expect(another.books[3]).toBe(4)
    expect(another.books[4]).toBe(5)
    expect(another.books[5].age).toBe(10)
  })

  test('push, shift', () => {
    const store = new Store({
      items: [1, 2],
    })
    let count = 0
    store.watch('*', () => count ++)
    const { state } = store
    const { items } = state

    items.push(3)
    expect(count).toBe(1)
    expect(items[2]).toBe(3)

    items.shift()
    expect(count).toBe(2)
    expect(items[0]).toBe(2)
  })

  test('proxied array', () => {
    const store = new Store({
      items: [1, 2, 3],
    })
    const { state } = store
    const { items } = state

    const item = {
      name: 'item',
    }

    items.push(item)
    expect(items.length).toBe(4)
    expect(items[3].name).toBe('item')

    items.delete(0)
    expect(items.length).toBe(3)
    expect(items[2].name).toBe('item')

    items.push(item)
    expect(items.length).toBe(4)
    items.remove(item)
    expect(items.length).toBe(3)
  })
})
