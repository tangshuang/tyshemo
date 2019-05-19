import { isObject, isInstanceOf, assign, parse, flatObject, isEqual, isInheritedOf, clone, getInterface, each, sortBy, iterate, makeKeyChain, makeKeyPath } from './utils.js'
import TyError from './error.js'
import Schema from './schema.js'

export class Model {
  constructor(data = {}) {
    const Interface = getInterface(this)
    if (!isInheritedOf(Interface, Model)) {
      throw new Error('Model should be extended.')
    }

    const schema = this.schema(Schema)
    if (!isInstanceOf(schema, Schema)) {
      throw new TyError('[Model]: schema method should return a Schema instance.')
    }

    this.schema = schema
    this.listeners = []

    this.isComputing = false
    this.isDigesting = false

    this.updators = {}
    this.isUpdating = null

    this.cache = {}
    this.data = {}
    this.restore(data)
  }

  schema(Schema) {
    throw new Error('[Model]: schema method should be override.')
  }

  get(key) {
    return parse(this.data, key)
  }

  set(key, value) {
    // you should not use `set` in `compute`
    if (this.isComputing) {
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

    assign(this.data, key, value)

    // you should use `set` in `watch`
    if (this.isDigesting) {
      return
    }

    this.digest()
  }

  update(data = {}) {
    return new Promise((resolve, reject) => {
      Object.assign(this.updators, data)
      clearTimeout(this.isUpdating)
      this.isUpdating = setTimeout(() => {
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

        try {
          Object.assign(this.data, this.updators)
          this.updators = {}
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
    this.schema.digest(this.data, this, (key, value) => {
      this.data[key] = value
    })
    this.__isComputing = false
  }

  digest() {
    this.isDigesting = true

    const listeners = sortBy(this.listeners, 'priority')
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

    this.isDigesting = false
  }

  jsondata() {
    const data = this.data
    const output = this.schema.formulate(data, this)
    return output
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

  restore(data = {}) {
    const coming = this.schema.rebuild(data, this)
    this.data = coming
    
    this.compute()
    
    const output = this.schema.ensure(this.data, this)
    this.data = output
  }

}

export default Model
