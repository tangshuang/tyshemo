import { isObject, isInstanceOf, assign, parse, flatObject, isEqual, isInheritedOf, clone, getConstructor, each, sortBy, iterate, makeKeyChain, makeKeyPath, isEmpty, isFunction } from './utils.js'
import TyError from './error.js'
import Schema from './schema.js'

export class Model {
  constructor(data = {}) {
    const Constructor = getConstructor(this)
    if (!isInheritedOf(Constructor, Model)) {
      throw new Error('Model should be extended.')
    }

    const schema = this.schema()
    if (!isInstanceOf(schema, Schema)) {
      throw new TyError('[Model]: schema method should return a Schema instance.')
    }

    this.schema = schema
    this.listeners = []

    this.isComputing = false
    this.isDigesting = false
    this.isCallbacking = false

    this.updators = {}
    this.isUpdating = null

    this.state = {}
    this.cache = {} // use for property watching
    this.latest = null // use for global watching

    this.init(data)
  }

  init(data) {
    const $this = this
    this.restore(data)

    function createProxy(data, parents = []) {
      const subproxies = {}
      const handler = {
        get(state, key) {
          const value = state[key]
          if (isObject(value)) {
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
          const root = chain[0]
          if ($this.schema.has(root)) {
            const path = makeKeyPath(chain)
            $this.set(path, value)
          }
          else {
            state[key] = value
          }
          return true
        },
        deleteProperty(state, key) {
          if (context && context.schema && context.schema.has(key)) {
            throw new TyError(`{keyPath} should not be deleted.`, { key, level: 'model', model: context, action: 'delete' })
          }
          delete state[key]
          delete subproxies[key]
        },
      }
      return new Proxy(data, handler)
    }

    this.data = createProxy(this.state)
  }

  schema() {
    throw new Error('[Model]: schema method should be override.')
  }

  get(key) {
    return parse(this.state, key)
  }

  set(key, value) {
    // you should not use `set` in `compute`
    if (this.isComputing || this.isCallbacking) {
      return
    }

    const chain = makeKeyChain(key)
    if (chain.length > 1) {
      const root = chain.shift()
      const current = this.get(root)

      if (!isObject(current)) {
        throw new TyError(`{keyPath} is not an object.`, { key: root, value: current, pattern: Object, level: 'model', model: this, action: 'set' })
      }

      const keyPath = makeKeyPath(chain)
      const next = clone(current)
      assign(next, keyPath, value)

      const error = this.schema.validate(root, next, this)
      if (error) {
        throw error
      }
    }
    else {
      const error = this.schema.validate(key, value, this)
      if (error) {
        throw error
      }
    }

    assign(this.state, key, value)

    // you should use `set` in `watch`
    if (this.isDigesting) {
      return
    }

    this.digest()
  }

  update(data) {
    // if do not pass any data
    // example:
    // data.a = 1
    // data.b = 2
    // model.update()
    if (!data || !isObject(data)) {
      const error = this.schema.validate(this.state)
      if (error) {
        throw error
      }
      this.digest()
      return
    }

    return new Promise((resolve, reject) => {
      Object.assign(this.updators, data)
      clearTimeout(this.isUpdating)
      this.isUpdating = setTimeout(() => {
        // check data first
        const error = iterate(this.updators, (value, key) => {
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
          Object.assign(this.state, this.updators)
          this.updators = {}
          this.digest()
          resolve(this.state)
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

    assign(this.cache, key, value)
    this.listeners.push({ key, fn, priority })
  }

  unwatch(key, fn) {
    const listeners = this.listeners
    listeners.forEach((item, i) => {
      if (key === item.key && (item.fn === fn || fn === undefined)) {
        callbacks.splice(i, 1)
      }
    })
  }

  compute() {
    this.__isComputing = true
    this.schema.digest(this.state, this, (key, value) => {
      this.state[key] = value
    })
    this.__isComputing = false
  }

  digest() {
    this.isDigesting = true

    var listeners = this.listeners.filter(({ key }) => key !== '*')
    listeners = sortBy(listeners, 'priority')

    const cache = this.cache

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
        throw new TyError(`[Model]: digest over 15 times.`)
      }

      if (dirty) {
        digest()
      }
    }

    digest()

    // if data changed, trigger global watchers
    if (!isEqual(this.latest, this.state)) {
      this.isCallbacking = true
      var callbacks = this.listeners.filter(({ key }) => key === '*')
      callbacks = sortBy(callbacks, 'priority')
      callbacks.forEach(({ fn }) => {
        fn.call(this, this.state, this.latest)
      })
      this.latest = clone(this.state)
      this.isCallbacking = false
    }

    this.isDigesting = false
  }

  // serialize data after formulate, should be override
  serialize(data) {
    return data
  }

  jsondata() {
    const data = this.state
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
    const data = this.state
    const error = this.schema.validate(data, this)
    return error
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
    Object.assign(this.state, making)
    this.compute()

    return this.state
  }

}

export default Model
