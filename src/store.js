import { isObject, assign, parse, remove, isEqual, clone, makeKeyPath, isArray, each, map } from './utils.js'

export class Store {
  constructor(data = {},) {
    this.data = { ...data }

    this._listeners = []
    this._cache = clone(data)
    this._updators = {}

    this.init(data)
  }
  init(data) {
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

    // find out computed properties
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

      if (flag) {
        return desc
      }
    })

    this.descriptors = descriptors
  }
  set(keyPath, value) {
    const oldValue = this.get(keyPath)

    // use setter
    const descriptor = this.descriptors[keyPath]
    if (descriptor && descriptor.set) {
      descriptor.set.call(this.data, value)
    }

    // use getter to set new cache value
    const newValue = descriptor && descriptor.get ? descriptor.get.call(this.data) : value

    assign(this.data, keyPath, newValue)
    this._dispatch(keyPath, newValue, oldValue)
    return this
  }
  get(keyPath) {
    // will use computed value's cache on this.data
    return parse(this.data, keyPath)
  }
  del(keyPath) {
    const oldValue = parse(this.data, keyPath)

    // remove computed property
    if (this.descriptors[keyPath]) {
      delete this.descriptors[keyPath]
    }

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

    assign(this._cache, keyPath, clone(newValue))

    const items = this._listeners

    const callbacks = items.filter((item) => {
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

    const newData = this.data
    const oldData = this._cache

    const emitters = items.filter(item => item.keyPath === '*')
    emitters.forEach(({ fn }) => {
      fn.call(this, newData, oldData, [keyPath, newValue, oldValue])
    })
  }
}

export default Store
