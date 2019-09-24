import { isObject, isInstanceOf, assign, parse, flatObject, isEqual, isInheritedOf, clone, getConstructor, each, sortBy, iterate, makeKeyChain, makeKeyPath, isArray, map, inObject } from './utils.js'
import Schema from './schema.js'

export class Model {
  constructor(data = {}) {
    const Constructor = getConstructor(this)
    if (!isInheritedOf(Constructor, Model)) {
      throw new Error('Model should be extended.')
    }

    var schema = this.schema()

    if (isObject(schema)) {
      schema = new Schema(schema)
    }

    if (!isInstanceOf(schema, Schema)) {
      throw new Error('[Model]: schema should be an object or an instance of Schema.')
    }

    this.schema = schema
    this.data = {}

    this._errors = {}

    this._listeners = []

    this._isComputing = false
    this._isDigesting = false
    this._isCallbacking = false

    this._updators = {}
    this._isUpdating = null

    this._cache = {} // use for property watching
    this._latest = null // use for global watching

    this.init(data)
  }

  init(data) {
    this.restore(data)

    const createProxy = (data, parents = []) => {
      const handler = {
        get: (node, key) => {
          const chain = [ ...parents, key ]
          const path = makeKeyPath(chain)
          const value = this.get(path)
          if (isObject(value) || isArray(value)) {
            const proxy = createProxy(value, [ ...parents, key ])
            return proxy
          }
          else {
            return value
          }
        },
        set: (node, key, value) => {
          const chain = [ ...parents, key ]
          const path = makeKeyPath(chain)
          this.set(path, value)
          return true
        },
        deleteProperty: (node, key) => {
          const chain = [ ...parents, key ]
          const path = makeKeyPath(chain)
          this.del(path)
          return true
        },
      }
      return new Proxy(data, handler)
    }

    this.state = createProxy(this.data)
    Object.defineProperty(this.state, '__model__', { value: this })
  }

  schema() {
    throw new Error('[Model]: schema method should be override.')
  }

  get(key) {
    const value = parse(this.data, key)
    const output = this.schema.get(key, value, this)
    return output
  }

  /**
   * set key value
   * @param {*} key
   * @param {*} value
   * @param {*} ensure validate before set, throw an error when not pass
   */
  set(key, value, ensure = false) {
    // you should not use `set` in `compute`
    if (this._isComputing || this._isCallbacking) {
      return this
    }

    const chain = makeKeyChain(key)
    const root = chain.shift()
    if (this.schema.has(root)) {
      if (chain.length) {
        let current = parse(this.data, root)

        if (!isObject(current)) {
          current = {}
        }

        const keyPath = makeKeyPath(chain)
        const next = clone(current)
        assign(next, keyPath, value)

        const coming = this.schema.set(root, next, this)

        if (ensure) {
          const error = this.schema.validate(root, coming, this)
          if (error) {
            throw error
          }
        }

        assign(this.data, root, coming)
      }
      else {
        const coming = this.schema.set(root, value, this)

        if (ensure) {
          const error = this.schema.validate(root, coming, this)
          if (error) {
            throw error
          }
        }

        assign(this.data, root, coming)
      }
    }
    // assign directly
    else {
      assign(this.data, key, value)
    }

    // you should use `set` in `watch`
    if (this._isDigesting) {
      return this
    }

    // compute and trigger watchers
    this._digest()

    return this
  }

  del(key, ensure = false) {
    // you should not use `set` in `compute`
    if (this._isComputing || this._isCallbacking) {
      return this
    }

    const chain = makeKeyChain(key)
    const root = chain.shift()

    if (this.schema.has(root)) {
      if (!chain.length) {
        throw new Error(`[Model]: ${key} can not be deleted.`)
      }

      const current = this.get(root)

      // do nothing is the property is not an object
      if (!isObject(current)) {
        return this
      }

      const next = clone(current)
      const tailKey = chain.pop()
      const keyPath = makeKeyPath(chain)
      const target = parse(next, keyPath)

      if (!isObject(target)) {
        return this
      }

      delete target[tailKey]

      if (ensure) {
        const error = this.schema.validate(root, next, this)
        if (error) {
          throw error
        }
      }

      // assign new data which property deleted
      assign(this.data, root, next)
    }
    // not in schema
    else {
      delete this.data[root]
    }

    // you should use `set` in `watch`
    if (this._isDigesting) {
      return this
    }

    this._digest()

    return this
  }

  update(data) {
    // if do not pass any data
    // example:
    // data.a = 1
    // data.b = 2
    // model.update()
    if (!data || !isObject(data)) {
      const error = this.schema.validate(this.data)
      if (error) {
        throw error
      }
      this._digest()
      return Promise.resolve(this.data)
    }

    return new Promise((resolve, reject) => {
      Object.assign(this._updators, data)
      clearTimeout(this._isUpdating)
      this._isUpdating = setTimeout(() => {
        // format data first
        const next = map(this._updators, (value, key) => {
          return this.schema.set(key, value, this)
        })

        // check data
        const error = iterate(next, (value, key) => {
          const error = this.schema.validate(key, value, this)
          if (error) {
            return error
          }
        })
        if (error) {
          reject(error)
          return
        }

        // update data
        const backup = clone(this.data)
        try {
          Object.assign(this.data, next)
          this._updators = {}
          this._digest()
          resolve(this.data)
        }
        catch (e) {
          this.data = backup // recover
          reject(e)
        }
      })
    })
  }

  watch(key, fn, priority = 10) {
    if (isArray(key)) {
      const keys = key
      keys.forEach(key => this.watch(key, fn, priority))
      return this
    }

    const current = this.get(key)
    const value = clone(current)

    assign(this._cache, key, value)
    this._listeners.push({ key, fn, priority })

    return this
  }

  unwatch(key, fn) {
    if (isArray(key)) {
      const keys = key
      keys.forEach(key => this.unwatch(key, fn))
      return this
    }

    const listeners = this._listeners
    listeners.forEach((item, i) => {
      if (key === item.key && (item.fn === fn || fn === undefined)) {
        listeners.splice(i, 1)
      }
    })

    return this
  }

  _compute() {
    this._isComputing = true
    this.schema.digest(this.data, this, (key, value) => {
      this.data[key] = value
    })
    this._isComputing = false
  }

  _digest() {
    this._isDigesting = true

    var listeners = this._listeners.filter(({ key }) => key !== '*')
    listeners = sortBy(listeners, 'priority')

    const cache = this._cache

    var dirty = false
    var count = 0

    const digest = () => {
      dirty = false

      // run computing before all watchers run
      // because the properties which are watched may based on computed properties
      this._compute()

      listeners.forEach(({ key, fn }) => {
        const current = this.get(key)
        const previous = parse(cache, key)

        if (!isEqual(current, previous)) {
          fn.call(this, current, previous)
          dirty = true
          const value = clone(current)
          assign(cache, key, value)
        }
      })

      count ++
      if (count > 15) {
        throw new Error(`[Model]: digest over 15 times.`)
      }

      if (dirty) {
        digest()
      }
    }

    digest()

    // if data changed, trigger global watchers
    if (!isEqual(this._latest, this.data)) {
      this._isCallbacking = true
      var callbacks = this._listeners.filter(({ key }) => key === '*')
      callbacks = sortBy(callbacks, 'priority')
      callbacks.forEach(({ fn }) => {
        fn.call(this, this.data, this._latest)
      })
      this._latest = clone(this.data)
      this._isCallbacking = false
    }

    this._isDigesting = false
  }

  // serialize data after formulate, should be override
  serialize(data) {
    return data
  }

  jsondata() {
    const data = this.data
    const output = this.schema.formulate(data, this)
    const result = this.serialize(output)

    return result
  }

  plaindata() {
    const data = this.jsondata()
    const output = flatObject(data)
    return output
  }

  formdata() {
    const data = this.plaindata()
    const formdata = new FormData()
    each(data, (value, key) => {
      formdata.append(key, value)
    })
    return formdata
  }

  validate() {
    const data = this.data
    const error = this.schema.validate(data, this)
    return error
  }

  message(key) {
    if (inObject(key, this._errors)) {
      return this._errors[key]
    }

    const value = parse(this.data, key)
    const error = this.schema.validate(key, value, this)
    const message = error ? error.message : ''

    this._errors[key] = message
    setTimeout(() => {
      delete this._errors[key]
    })

    return message
  }

  // parse data before restore, should be override
  parse(data) {
    return data
  }

  restore(data = {}) {
    const entry = this.parse(data)
    const coming = this.schema.rebuild(entry, this)
    const making = this.schema.ensure(coming, this)

    // use assign to recover, because developer may append some non-defined property to state
    Object.assign(this.data, making)
    this._digest()

    return this
  }

}

export default Model
