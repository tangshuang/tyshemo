import { Loader } from '../../src/complete/loader.js'
import json from '../model.json'

describe('Loader', () => {
  test('parse', () => {
    const loader = new Loader()
    const Model = loader.parse(json)

    let errorCount = 0
    class SomeModel extends Model {
      onError() {
        errorCount ++
      }
    }
    const model = new SomeModel()

    expect(model.name).toBe('tomy')
    expect(model.age).toBe(10)

    model.age = '0'
    expect(model.age).toBe('0')
    expect(errorCount).toBe(1)

    expect(model.$views.name.required).toBe(false)
    model.age = 11
    expect(model.$views.name.required).toBe(true)

    expect(model.getWeight()).toBe(55)
  })
  test('async fetch method', (done) => {
    class AsyncLoader extends Loader {
      fetch() {
        return Promise.resolve({ a: 2 })
      }
    }
    const loader = new AsyncLoader()
    const SomeModel = loader.parse({
      schema: {},
      state: {
        a: 0,
      },
      methods: {
        'fetchA()': 'a = await fetch("").a',
        'onInit()': 'a = 1',
      },
    })

    const some = new SomeModel()
    expect(some.a).toBe(1)

    some.fetchA().then(() => {
      expect(some.a).toBe(2)
      done()
    })
  })
  test('call $parent in compute()', () => {
    const loader = new Loader()
    const Some = loader.parse({
      schema: {
        age: {
          default: 0,
        },
        '<child>': {
          schema: {
            age: {
              default: 0,
              'compute()': '$parent.age - 24',
            },
          },
        },
      },
    })
    const one = new Some({
      age: 36,
    })
    expect(one.child.age).toBe(12)
  })
  test('.. syntax', () => {
    const loader = new Loader()
    const Some = loader.parse({
      "schema": {
        "name": {
          "default": "tomy",
          "type": "string",
          "required()": "age > 10",
        },
        "age": {
          "default": 11,
          "type": "number",
        },
        "height": {
          "default": 0,
          "isNeeded": "{ ..name.required }", // -> special syntax, use .. to instead of `$views.`, equal: "isNeeded": "$views.name.required"
        },
        "<child>": {
          "schema": {
            "ghost": {
              "default": "",
              "required": "{ $parent..height.isNeeded }", // -> read height field view from parent
            },
          },
        },
      },
    })

    const some = new Some()
    expect(some.$views.height.isNeeded).toBe(true)
    expect(some.child.$views.ghost.required).toBe(true)
  })

  test(':fetch', async () => {
    const loader = new Loader()
    const sleep = (i) => new Promise((r) => setTimeout(r, i))
    loader.fetch = async ({ type, data }) => {
      await sleep(100)
      if (type === 'options') {
        return [1, 2, 3]
      }
      else if (type === 'items') {
        return data.map(i => i + 1)
      }
    }
    const Some = loader.parse({
      "schema": {
        "options": {
          "default": "{ []:fetch({ type: 'options' }) }",
          "watch(e)": "{ debug(e.value) }",
        },
        "items": {
          // "default": "{ $(options): []:fetch({ type: 'items', data: options }) }",
          "default": "{ []:fetch({ type: 'items', data: options }) }",
        },
      },
    })

    const some = new Some()
    expect(some.options).toEqual([])
    expect(some.items).toEqual([])
    await sleep(300)
    expect(some.options).toEqual([1, 2, 3])
    await sleep(300)
    expect(some.items).toEqual([2, 3, 4])
  })
})
