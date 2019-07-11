import { isObject, isInstanceOf, assign, parse, flatObject, isEqual, isInheritedOf, clone, getConstructor, each, sortBy, iterate, makeKeyChain, makeKeyPath, isArray, map } from './utils.js'
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

    this.__listeners = []

    this.__isComputing = false
    this.__isDigesting = false
    this.__isCallbacking = false

    this.__updators = {}
    this.__isUpdating = null

    this.__cache = {} // use for property watching
    this.__latest = null // use for global watching

    this.init(data)
  }

  init(data) {
    const $this = this
    this.restore(data)

    function createProxy(data, parents = []) {
      const subproxies = {}
      const handler = {
        get(state, key) {
          const chain = [ ...parents, key ]
          const path = makeKeyPath(chain)
          const value = $this.get(path)
          if (isObject(value) || isArray(value)) {
            if (subproxies[key]) {
              return subproxies[key]
            }
            const proxy = createProxy(value, [ ...parents, key ])
            subproxies[key] = proxy
            return proxy
          }
          else {
            return value
          }
        },
        set(state, key, value) {
          const chain = [ ...parents, key ]
          const path = makeKeyPath(chain)
          $this.set(path, value)

          delete subproxies[key]
          return true
        },
        deleteProperty(state, key) {
          const chain = [ ...parents, key ]
          const path = makeKeyPath(chain)
          $this.del(path)

          delete subproxies[key]
          return true
        },
      }
      return new Proxy(data, handler)
    }

    this.state = createProxy(this.data)
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
    if (this.__isComputing || this.__isCallbacking) {
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
    if (this.__isDigesting) {
      return this
    }

    // compute and trigger watchers
    this.digest()

    return this
  }

  del(key, ensure = false) {
    // you should not use `set` in `compute`
    if (this.__isComputing || this.__isCallbacking) {
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
    if (this.__isDigesting) {
      return this
    }

    this.digest()

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
      this.digest()
      return Promise.resolve(this.data)
    }

    return new Promise((resolve, reject) => {
      Object.assign(this.__updators, data)
      clearTimeout(this.__isUpdating)
      this.__isUpdating = setTimeout(() => {
        // format data first
        const next = map(this.__updators, (value, key) => {
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
        try {
          Object.assign(this.data, next)
          this.__updators = {}
          this.digest()
          resolve(this.data)
        }
        catch (e) {
          reject(e)
        }
      })
    })
  }

  watch(key, fn, priority = 10) {
    const current = this.get(key)
    const value = clone(current)

    assign(this.__cache, key, value)
    this.__listeners.push({ key, fn, priority })
  }

  unwatch(key, fn) {
    const listeners = this.__listeners
    listeners.forEach((item, i) => {
      if (key === item.key && (item.fn === fn || fn === undefined)) {
        callbacks.splice(i, 1)
      }
    })
  }

  compute() {
    this.__isComputing = true
    this.schema.digest(this.data, this, (key, value) => {
      this.data[key] = value
    })
    this.__isComputing = false
  }

  digest() {
    this.__isDigesting = true

    var listeners = this.__listeners.filter(({ key }) => key !== '*')
    listeners = sortBy(listeners, 'priority')

    const cache = this.__cache

    var dirty = false
    var count = 0

    const digest = () => {
      dirty = false

      // run computing before all watchers run
      // because the properties which are watched may based on computed properties
      this.compute()

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
    if (!isEqual(this.__latest, this.data)) {
      this.__isCallbacking = true
      var callbacks = this.__listeners.filter(({ key }) => key === '*')
      callbacks = sortBy(callbacks, 'priority')
      callbacks.forEach(({ fn }) => {
        fn.call(this, this.data, this.__latest)
      })
      this.__latest = clone(this.data)
      this.__isCallbacking = false
    }

    this.__isDigesting = false
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
    const value = parse(this.data, key)
    const error = this.schema.validate(key, value, this)
    return error ? error.message : ''
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
    this.compute()

    return this.data
  }

}

export default Model
