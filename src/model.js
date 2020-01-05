import {
  isObject,
  isBoolean,
  isEqual,
  isInheritedOf,
  isArray,
  isString,
  inArray,
  assign,
  parse,
  makeKeyChain,
  makeKeyPath,
  sortArray,
  map,
  each,
  iterate,
  clone,
  flatObject,
  getConstructor,
  createProxy,
  isInstanceOf,
} from 'ts-fns'

import Schema from './schema.js'

const PROXY_MODEL = /*#__PURE__*/Symbol.for('[[Model]]')

/**
 * class SomeModel extends Model {
 *   static some = {
 *     type: String,
 *     default: '',
 *   }
 * }
 *
 * @keywords: schema, data, data, view, init, getParent, use, get, set, del, update,
 *            watch, unwatch, serialize, jsondata, plaindata, formdata, validate, parse, restore
 */
export class Model {
  constructor(data = {}) {
    const Constructor = getConstructor(this)

    // check sub model
    if (!isInheritedOf(Constructor, Model)) {
      throw new Error('Model should be extended.')
    }

    // create schema by model's static properties
    const defs = map(Constructor, (def) => {
      /**
       * class SomeModel extends Model {
       *   static some = OtherModel
       * }
       */
      if (isInheritedOf(def, Model)) {
        return convertModelToSchemaDef(def, false)
      }

      /**
       * class SomeModel extends Model {
       *   static some = [OtherModel]
       * }
       */
      if (isArray(def) && isInheritedOf(def[0], Model)) {
        return convertModelToSchemaDef(def[0], true)
      }

      /**
       * class SomeModel extends Model {
       *   static some = {
       *     type: OtherModel,
       *     drop: true,
       *   }
       * }
       */
      if (isInheritedOf(def.type, Model)) {
        const { type, ...options } = def
        const modelSchemaDef = convertModelToSchemaDef(def.type, false)
        return {
          ...modelSchemaDef,
          ...options,
        }
      }

      /**
       * class SomeModel extends Model {
       *   static some = {
       *     type: [OtherModel],
       *     drop: true,
       *   }
       * }
       */
      if (isArray(def.type) && isInheritedOf(def.type[0], Model)) {
        const { type, ...options } = def
        const modelSchemaDef = convertModelToSchemaDef(def.type[0], true)
        return {
          ...modelSchemaDef,
          ...options,
        }
      }

      return def
    })
    this.schema = new Schema(defs)

    this.data = {}

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
    // create setup data to make it work at the beginning of all
    this.restore(data)

    // create a state object
    this.state = createProxy(this.data, {
      get: ({ target, key, keyPath, keyChain }) => {
        // when call Symbol.for([[Store]]), return the current store
        if (key === PROXY_MODEL) {
          return this
        }

        // array primitive operation
        if (isArray(target) && inArray(key, ['push', 'pop', 'unshift', 'shift', 'splice', 'sort', 'reverse', 'fill'])) {
          const chain = [...keyChain]
          chain.pop()
          const targetKeyPath = makeKeyPath(chain)
          // return a function which trigger change
          return (...args) => {
            const newValue = [...target]
            newValue[key](...args)
            this.set(targetKeyPath, newValue)
          }
        }

        // to collect dependencies
        const v = this.get(keyPath)
        return v
      },
      set: ({ target, key, keyPath, value }) => {
        // specail array.length
        if (isArray(target) && key === 'length') {
          const newValue = [...target]
          newValue.length = value
          this.set(keyPath, newValue)
          return false
        }

        this.set(keyPath, value)
        return false
      },
      del: ({ keyPath }) => {
        this.del(keyPath)
        return false
      },
    })

    // create a view object
    this.view = new Proxy({}, {
      get: (target, key) => {
        return this.use(key)
      },
      set() {
        return false
      },
      deleteProperty() {
        return false
      },
    })

    // patch properties on this
    const Constructor = getConstructor(this)
    each(Constructor, (def, key) => {
      Object.defineProperty(this, key, {
        get: () => this.state[key],
        set: (v) => this.state[key] = v,
      })
    })
  }

  /**
   * if current model is a submodel, use this method to find its parent model
   * @param {*} root
   */
  getParent(root) {
    const find = (parent, target) => {
      if (!isInstanceOf(parent, Model)) {
        return
      }

      const { data } = parent
      const keys = Object.keys(data)
      for (let i = 0, len = keys.length; i < len; i ++) {
        const key = keys[i]
        const node = data[key]
        if (node === target) {
          return parent
        }

        const next = find(node, target)
        if (next) {
          return next
        }
      }
    }
    return find(root, this)
  }

  use(key) {
    const { schema, state, data } = this
    const node = {}
    Object.defineProperties(node, {
      value: {
        get: () => state[key],
        set: v => state[key] = v,
      },
      required: {
        get: () => schema.required(key, this),
      },
      disabled: {
        get: () => schema.disabled(key, this),
      },
      readonly: {
        get: () => schema.readonly(key, this),
      },
      error: {
        get: () => this.validate(key),
      },
    })
    return node
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
    // can not change this value
    const view = this.view[key]
    if (view && (view.readonly || view.disabled)) {
      return this
    }

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
    // can not change this value
    const view = this.view[key]
    if (view && (view.readonly || view.disabled)) {
      return this
    }

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

  update(data, sync = false) {
    // invoke like this.update(true)
    if (isBoolean(data)) {
      sync = data
      data = undefined
    }

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
      return sync ? this.data : Promise.resolve(this.data)
    }

    // when pass sync=true
    // use this to update data
    if (sync) {
      const next = map(data, (value, key) => {
        // can not change this value
        const view = this.view[key]
        if (view && (view.readonly || view.disabled)) {
          // return original value
          return data[key]
        }
        else {
          return this.schema.set(key, value, this)
        }
      })

      // check data
      const error = iterate(next, (value, key) => this.schema.validate(key, value, this))
      if (error) {
        throw error
      }

      // update data
      const backup = clone(this.data)
      try {
        Object.assign(this.data, next)
        this._digest()
        return this.data
      }
      catch (e) {
        this.data = backup // recover
        throw e
      }
    }

    return new Promise((resolve, reject) => {
      Object.assign(this._updators, data)
      clearTimeout(this._isUpdating)
      this._isUpdating = setTimeout(() => {
        // format data first
        const next = map(this._updators, (value, key) => this.schema.set(key, value, this))

        // check data
        const error = iterate(next, (value, key) => this.schema.validate(key, value, this))
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

    let listeners = this._listeners.filter(({ key }) => key !== '*')
    listeners = sortArray(listeners, 'priority')

    const cache = this._cache

    let dirty = false
    let count = 0

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
      callbacks = sortArray(callbacks, 'priority')
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

  validate(key) {
    if (isArray(key)) {
      const keys = key
      const error = iterate(keys, key => this.validate(key))
      return error
    }
    else if (isString(key)) {
      const value = parse(this.data, key)
      const error = this.schema.validate(key, value, this)

      return error
    }
    else {
      const data = this.data
      const error = this.schema.validate(data, this)
      return error
    }
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

function convertModelToSchemaDef(SomeModel, isList) {
  if (isList) {
    return {
      default: [],
      type: [SomeModel],
      validators: [
        {
          validate: ms => iterate(ms, m => m.validate() || undefined) || true,
        },
      ],
      prepare: (data, key) => isArray(data[key]) ? data[key].map(v => isObject(v) ? new SomeModel(v) : new SomeModel()) : [],
      map: ms => ms.map(m => m.jsondata()),
    }
  }
  else {
    return {
      default: new SomeModel({}),
      type: SomeModel,
      validators: [
        {
          validate: m => m.validate(),
        },
      ],
      prepare: (data, key) => isObject(data[key]) ? new SomeModel(data[key]) : new SomeModel(),
      map: m => m.jsondata(),
    }
  }
}
