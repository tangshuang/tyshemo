import { isObject, assign, parse, remove, isEqual, clone, makeKeyPath, isArray, each, map, isFunction } from './utils.js'

export class Store {
  constructor(data = {},) {
    this.data = {}

    this._listeners = []
    this._updators = {}

    this.init(data)
    this._mirror = clone(this.data)
  }
  init(data) {
    // computed properties
    const values = {}
    const descriptors = map(data, (value, key) => {
      const descriptor = Object.getOwnPropertyDescriptor(data, key)

      if (!descriptor) {
        return
      }

      const desc = {}
      let flag = false

      if (descriptor.get) {
        desc.get = descriptor.get
        flag = true
      }
      if (descriptor.set) {
        desc.set = descriptor.set
        flag = true
      }

      // add property to data
      if (descriptor.value) {
        values[key] = value
      }

      if (flag) {
        return desc
      }
    })
    this._descriptors = descriptors
    this.data = values

    // state
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
        set: (state, key, value) => {
          const chain = [ ...parents, key ]
          const path = makeKeyPath(chain)
          this.set(path, value)
          return true
        },
        deleteProperty: (state, key) => {
          const chain = [ ...parents, key ]
          const path = makeKeyPath(chain)
          this.del(path)
          return true
        },
      }
      return new Proxy(data, handler)
    }
    this.state = createProxy(this.data)
  }

  // define a computed property
  define(key, options) {
    if (isFunction(options)) {
      const get = options
      delete this.data[key]
      this._descriptors[key] = { get }
    }
    else if (isObject(options)) {
      const { get, set } = options
      const desc = {}
      let flag = false

      if (isFunction(get)) {
        desc.get = get
        flag = true
      }
      if (isFunction(set)) {
        desc.set = set
        flag = true
      }
      if (flag) {
        delete this.data[key]
        this._descriptors[key] = desc
      }
    }
    return this
  }

  set(keyPath, value) {
    const oldValue = this.get(keyPath)
    let newValue = value

    // computed property
    const descriptor = this._descriptors[keyPath]
    if (descriptor) {
      // do not allowed to set value when has no setter
      if (!descriptor.set) {
        return this
      }

      descriptor.set.call(this.state, value)

      // when there is no getter, the value will always be undefined, and no need to trigger dispatchers
      if (!descriptor.get) {
        return this
      }

      newValue = descriptor.get.call(this.state)
    }
    else {
      assign(this.data, keyPath, value)
    }

    this._dispatch(keyPath, newValue, oldValue)
    return this
  }
  get(keyPath) {
    // computed property
    const descriptor = this._descriptors[keyPath]
    if (descriptor) {
      // always return undefined when has no getter
      if (!descriptor.get) {
        return
      }
      return descriptor.get.call(this.state)
    }

    return parse(this.data, keyPath)
  }
  del(keyPath) {
    // remove computed property
    if (this._descriptors[keyPath]) {
      delete this._descriptors[keyPath]
    }

    const oldValue = parse(this.data, keyPath)
    remove(this.data, keyPath)
    this._dispatch(keyPath, undefined, oldValue)
    return this
  }
  update(data = {}) {
    return new Promise((resolve, reject) => {
      Object.assign(this._updators, data)
      clearTimeout(this._isUpdating)
      this._isUpdating = setTimeout(() => {
        // update data
        const backup = clone(this.data)
        try {
          each(this._updators, (value, key) => {
            this.set(key, value)
          })
          this._updators = {}
          resolve(this.data)
        }
        catch (e) {
          this.data = backup // recover
          reject(e)
        }
      })
    })
  }
  watch(keyPath, fn, deep = false) {
    if (isArray(keyPath)) {
      const keyPaths = keyPath
      keyPaths.forEach(keyPath => this.watch(keyPath, fn, deep))
      return this
    }

    const items = this._listeners
    items.push({ keyPath, fn, deep })
    return this
  }
  unwatch(keyPath, fn) {
    if (isArray(keyPath)) {
      const keyPaths = keyPath
      keyPaths.forEach(keyPath => this.unwatch(keyPath, fn))
      return this
    }

    const items = this._listeners
    items.forEach((item, i) => {
      if (item.keyPath === keyPath && (item.fn === fn || fn === undefined)) {
        items.splice(i, 1)
      }
    })
    return this
  }
  _dispatch(keyPath, newValue, oldValue) {
    if (isEqual(newValue, oldValue)) {
      return
    }

    const newData = this.data
    const oldData = clone(this._mirror)

    assign(this._mirror, keyPath, clone(newValue))

    const listeners = this._listeners

    const callbacks = listeners.filter((item) => {
      if (item.keyPath === keyPath) {
        return true
      }
      if (item.deep && keyPath.indexOf(item.keyPath + '.') === 0) {
        return true
      }
      return false
    })
    callbacks.forEach(({ fn }) => {
      fn.call(this, newValue, oldValue)
    })

    const emitters = listeners.filter(item => item.keyPath === '*')
    emitters.forEach(({ fn }) => {
      fn.call(this, newData, oldData, [keyPath, newValue, oldValue])
    })
  }
}

export default Store
