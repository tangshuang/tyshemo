import { Parser } from '../../es/tools/parser.js'

describe('Parser', () => {
  test('parse', () => {
    const def = {
      __def__: [
        {
          name: 'book',
          def: { name: 'string', price: 'float' },
        },
      ],
      name: 'string',
      age: 'number',
      has_football: '?boolean', // ifexist
      sex: 'F|M',
      dot: '=xxxxx', // equal
      belong: '?=animal', // ifexist equal
      vioce: '!number', // should not match
      num: 'string,numeric', // match multiple
      parents: ['string', 'string'], // tuple
      books: 'book[]', // list, use defined 'book'
      body: {
        head: 'boolean',
        neck: 'boolean',
      },
    }
    const type = new Parser().parse(def)
    const target = {
      name: 'tomy',
      age: 10,
      // has_football: true,
      sex: 'F',
      dot: 'xxxxx',
      belong: 'animal',
      vioce: '123',
      num: '123',
      parents: ['Jhon', 'Lucy'],
      books: [
        { name: '3 ben', price: 10.2 },
      ],
      body: {
        head: true,
        neck: true,
      },
    }

    expect(() => type.assert(target)).not.toThrowError()
  })
  test('parse comments', () => {
    const def = {
      '#name': 'the name of someone',
      name: 'string',
      '#books[0].price': 'the price of this book',
      "books*": [
        {
          '#name': 'the name of this book',
          name: 'string',
          price: 'number',
        },
      ],
      '#son.age': 'the age of son',
      son: {
        '#name': 'the name of son',
        name: 'string',
        age: 'number',
      },
    }
    const type = new Parser().parse(def)
    const comments = type.__comments__
    const keys = Object.keys(comments)
    expect(keys.length).toBe(5)
  })
  test('parse a string', () => {
    const type = new Parser().parse('string')
    expect(() => type.assert('xxx')).not.toThrowError()
    expect(() => type.assert(111)).toThrowError()
  })
  test('selfref', () => {
    const type = new Parser().parse({
      __def__: [
        {
          name: 'Some',
          def: {
            name: 'string',
            children: '?__self__[]',
          },
        },
      ],
      some: 'Some',
    })

    expect(() => type.assert({
      some: {
        name: 'a',
        children: null,
      },
    })).toThrowError()
    expect(() => type.assert({
      some: {
        name: 'a',
        children: [
          { name: 'b' },
          { name: 'c', children: [] },
          {
            name: 'c',
            children: [
              { name: 'd' },
            ],
          },
        ],
      },
    })).not.toThrowError()
  })

  test('range', () => {
    const type = new Parser().parse({
      range: '-5-5',
    })
    expect(() => type.assert({ range: 0 })).not.toThrowError()
    expect(() => type.assert({ range: 10 })).toThrowError()
  })

  test('rules on property', () => {
    const type = new Parser().parse({
      "name&": "string",
      "age?": "number",
      "weight?&": "number",
      "some!": "string",
      "dog?": {
        "name": "string",
        "age": "number",
      },
    })

    const data = {
      name: 'a',
      age: 1,
      weight: 1,
      some: 0,
      dog: {
        name: 'dg',
        age: 1,
      },
    }
    expect(() => type.assert(data)).not.toThrowError()

    data.name = null
    expect(() => type.assert(data)).not.toThrowError()

    delete data.age
    expect(() => type.assert(data)).not.toThrowError()

    data.weight = null
    expect(() => type.assert(data)).not.toThrowError()

    delete data.weight
    expect(() => type.assert(data)).not.toThrowError()

    delete data.dog
    expect(() => type.assert(data)).not.toThrowError()

    data.some = 'a'
    expect(() => type.assert(data)).toThrowError()
  })

  test('guess', () => {
    const loader = new Parser()
    const data = {
      name: 'tomy',
      age: 10,
      books: [
        {
          title: 'Told Sad',
          price: 12.5,
        },
      ],
    }

    const description = loader.guess(data)

    expect(description.name).toBe('string')
    expect(description.age).toBe('number')
    expect(description.books).toBeInstanceOf(Array)
    expect(description.books[0].title).toBe('string')
    expect(description.books[0].price).toBe('number')
  })

  test('merge', () => {
    const loader = new Parser()
    const data = {
      name: 'tomy',
      age: 10,
      height: 60,
    }

    const desc1 = loader.guess(data)

    const next = {
      name: null,
      height: '60',
    }
    const desc2 = loader.merge(desc1, next)

    expect(desc2['name&']).toBe('string')
    expect(desc2['height|']).toEqual(['number', 'numeric'])
    expect(desc2['age?']).toBe('number')
  })
})
