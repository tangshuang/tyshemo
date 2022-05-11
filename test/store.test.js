import { Store } from '../src/store.js'
import { Model } from '../src/model.js'
import { Meta } from '../src/meta.js'

describe('Store', () => {
  const createData = () => ({
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
    const store = new Store(createData())
    expect(store.get('name')).toBe('tomy')
    expect(store.get('body.head')).toBe(true)
    expect(store.get('books[1]')).toBe('See Blue')
  })
  test('set', () => {
    const store = new Store(createData())
    store.set('body.feet', false)
    expect(store.get('body.feet')).toBe(false)
  })
  test('update', () => {
    const store = new Store(createData())
    const state = store.state

    store.update({
      name: 'tomi',
      age: 11,
    })

    expect(state.name).toBe('tomi')
    expect(state.age).toBe(11)
  })
  test('watch', () => {
    const store = new Store(createData())
    const state = store.state

    store.watch('age', function() {
      this.weight = this.age * 2 + 20
    })

    store.set('age', 20)

    expect(state.weight).toBe(60)
  })
  test('watch *', () => {
    const store = new Store(createData())
    const state = store.state

    let count = 0

    store.watch('*', () => count ++, true)

    state.age ++
    state.body.head = false
    delete state.name

    expect(count).toBe(3)
  })
  test('state', () => {
    const store = new Store(createData())
    const state = store.state

    store.watch('age', function(age) {
      state.weight = state.age * 2 + 20
    })

    state.age = 40
    expect(state.weight).toBe(100)
  })

  test('delete', () => {
    const store = new Store(createData())
    const state = store.state

    store.set('testkey', 'some')
    expect(state.testkey).toBe('some')

    delete state.testkey
    expect(state.testkey).toBeUndefined()
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

  test('deep computed', () => {
    const store = new Store({
      list: [
        {
          name: 'MyBook',
          price: 12,
        },
        {
          name: 'Book2',
          price: 10,
        }
      ],
      get cost() {
        return this.list.reduce((prev, curr) => prev + curr.price, 0)
      }
    })
    store.testing = true
    const { state } = store

    expect(state.cost).toBe(22)

    let count = 0
    store.watch('list', () => count ++, true)
    state.list[1].price = 20
    expect(count).toBe(1)
    expect(state.cost).toBe(32)
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

    items.splice(0, 1)
    expect(items.length).toBe(3)
    expect(items[2].name).toBe('item')
  })

  test('observe', () => {
    class SomeModel extends Model {
      static name = new Meta({
        default: '',
      })
    }
    const some = new SomeModel()
    const store = new Store({
      some,
    })

    store.observe(
      v => v instanceof SomeModel,
      v => dispatch => v.watch('*', dispatch, true),
      v => dispatch => v.unwatch('*', dispatch)
    )

    let count = 0
    store.watch('*', () => {
      count ++
    }, true)

    store.state.some.name = 'tomy'

    expect(count).toBe(1)
  })

  test('editable (private)', () => {
    const store = new Store({
      name: 'tomy',
    })

    store.editable = false

    // change will not work, but without any error thrown
    expect(() => store.set('name', 'lily')).not.toThrowError()
    expect(store.get('name')).toBe('tomy')
  })

  test('change computed manually', () => {
    const store = new Store({
      get age() {
        return
      }
    })

    // an error ocurs when compute,
    expect(store.state.age).toBeUndefined()

    // we can change computed property
    store.state.age = 10
    expect(store.state.age).toBe(10)
  })

  test('dynamic computed', () => {
    const store = new Store({
      sex: 'M',
      age: 20,
      height: 180,
      get weight() {
        return this.sex === 'M' ? this.age * 4 + this.height / 9 : this.age * 3
      },
    })

    let count = 0
    store.watch('weight', () => count ++)

    const { state } = store
    expect(state.weight).toBe(100)
    expect(store.data.weight).toBe(100) // computed cached

    state.height = 198
    expect(state.weight).toBe(102)
    expect(count).toBe(1)

    state.age ++
    expect(state.weight).toBe(106)
    expect(count).toBe(2)

    state.sex = 'F'
    expect(state.weight).toBe(63)
    expect(store.data.weight).toBe(63) // computed cached
    expect(count).toBe(3)
  })
})
