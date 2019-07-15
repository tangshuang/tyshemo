import { isObject, assign, parse, remove, isEqual, clone, makeKeyPath, isArray, each } from './utils.js'

export class Store {
  constructor(data = {}) {
    this.data = data

    this._listeners = []
    this._cache = clone(data)
    this._updators = {}

    this.init(data)
  }
  init(data) {
    const $this = this

    function createProxy(data, parents = []) {
      const handler = {
        get(state, key) {
          const chain = [ ...parents, key ]
          const path = makeKeyPath(chain)
          const value = $this.get(path)
          if (isObject(value) || isArray(value)) {
            const proxy = createProxy(value, [ ...parents, key ])
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
          return true
        },
        deleteProperty(state, key) {
          const chain = [ ...parents, key ]
          const path = makeKeyPath(chain)
          $this.del(path)
          return true
        },
      }
      return new Proxy(data, handler)
    }

    this.state = createProxy(this.data)
  }
  set(keyPath, value) {
    const oldValue = parse(this.data, keyPath)
    assign(this.data, keyPath, value)
    this._dispatch(keyPath, value, oldValue)
    return this
  }
  get(keyPath) {
    return parse(this.data, keyPath)
  }
  del(keyPath) {
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
        try {
          each(this._updators, (value, key) => {
            this.set(key, value)
          })
          this._updators = {}
          resolve(this.data)
        }
        catch (e) {
          reject(e)
        }
      })
    })
  }
  watch(keyPath, fn, deep = false) {
    const items = this._listeners
    items.push({ keyPath, fn, deep })
    return this
  }
  unwatch(keyPath, fn) {
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

  clone() {
    return clone(this.data)
  }
}

export default Store
