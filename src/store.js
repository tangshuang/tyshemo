import {
  isObject,
  isEqual,
  isArray,
  isFunction,
  inArray,
  assign,
  parse,
  remove,
  makeKeyChain,
  makeKeyPath,
  clone,
  each,
  createProxy,
  getProxied,
} from 'ts-fns'

const PROXY_STORE = /*#__PURE__*/Symbol.for('[[Store]]')

export class Store {
  constructor(data = {},) {
    this.data = { ...data }

    this._listeners = []
    this._updators = {}

    this._dep = []
    this._deps = {}

    this.init(data)
    this._mirror = clone(this.data)
  }
  init(data) {
    // computed properties
    const descriptors = {}
    each(data, (value, key) => {
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
        descriptors[key] = desc
      }
    })
    this._descriptors = descriptors

    // state
    this.state = createProxy(this.data, {
      get: ({ target, key, keyPath, keyChain, rootTarget }) => {
        // when call Symbol.for([[Store]]), return the current store
        if (key === PROXY_STORE) {
          return this
        }

        if (isArray(target)) {
          const chain = [...keyChain]
          chain.pop()
          const targetKeyPath = makeKeyPath(chain)

          // array primitive operation
          if (isArray(target) && inArray(key, ['push', 'pop', 'unshift', 'shift', 'splice', 'sort', 'reverse', 'fill'])) {
            // return a function which trigger change
            return (...args) => {
              // notice this line
              // as we will use code like this:
              // const { items } = state
              // items.push(1)
              // items.push(2)
              // think more about this, the second time we use `items` it is the same as the first time, we should must use latest data
              const current = parse(rootTarget, targetKeyPath)
              const newValue = [...current]
              newValue[key](...args)
              this.set(targetKeyPath, newValue)
            }
          }
          // create a delete method
          else if (isArray(target) && key === 'delete') {
            return (i) => {
              const current = parse(rootTarget, targetKeyPath)
              if (i > -1 && i < current.length) {
                const newValue = [...current]
                newValue.splice(i, 1)
                this.set(targetKeyPath, newValue)
              }
            }
          }
          // create a remove method
          else if (isArray(target) && key === 'remove') {
            return (v, fn) => {
              const current = parse(rootTarget, targetKeyPath)
              const i = current.findIndex((item, i) => {
                const a = item && typeof item === 'object' ? getProxied(item) : item
                if (isFunction(v)) {
                  // i.e. items.remove((item, i) => item === some)
                  return v(a, i)
                }
                const b = v && typeof v === 'object' ? getProxied(v) : v
                if (isFunction(fn)) {
                  // i.e. items.remove(v, v => (item, i) => v === item)
                  return fn(b)(a, i)
                }
                return a === b
              })
              if (i > -1) {
                const newValue = [...current]
                newValue.splice(i, 1)
                this.set(targetKeyPath, newValue)
              }
            }
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

    // collecting dependencies
    each(descriptors, (item, key) => {
      if (item.get) {
        this._collect(key)
      }
    })
  }

  // define a computed property
  define(key, options) {
    if (isFunction(options)) {
      const get = options
      delete this.data[key]
      this._descriptors[key] = { get }
      this._collect(key)
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
        this._collect(key)
      }
    }

    return this
  }

  // watch change of dependencies
  _dependOn(keyPath) {
    const chain = makeKeyChain(keyPath)
    if (chain.length > 1) {
      return
    }

    const key = keyPath
    const dep = this._dep
    const by = dep[dep.length - 1]

    // without begin
    if (!by) {
      return
    }

    // not depend on self
    if (by === key) {
      return
    }

    const descriptors = this._descriptors
    const descriptor = descriptors[by]

    if (!descriptor || !descriptor.get) {
      return
    }

    const deps = this._deps
    const depsOfBy = deps[by] = deps[by] || {}
    const depInBy = depsOfBy[key]

    // registered
    if (depInBy) {
      return
    }

    const observe = () => {
      const oldValue = this.data[by]
      this._collect(by)
      const newValue = this.data[by]
      this._dispatch(by, newValue, oldValue)
    }
    this.watch(key, observe, true)
    depsOfBy[key] = observe

    // ignore nested dependencies, for example: a->b+c && b->c => a->b
    const depsOfKey = deps[key]
    if (depsOfKey) {
      const keys = Object.keys(depsOfBy)
      for (let i = 0, len = keys.length; i < len; i ++) {
        const k = keys[i]
        // if nested dependencies, remove existing dependency.
        // k is in depsOfBy and also in depsOfKey
        if (depsOfKey[k]) {
          this.unwatch(k, depsOfBy[k])
          delete depsOfBy[k]
        }
      }
    }

    this._collect(key)
  }

  // collect dependencies, assign value
  _collect(key) {
    this._dep.push(key)

    const descriptors = this._descriptors
    const descriptor = descriptors[key]

    if (!descriptor || !descriptor.get) {
      this._dep.pop()
      return
    }

    const value = descriptor.get.call(this.state)
    assign(this.data, key, value)

    this._dep.pop()
  }

  set(keyPath, value) {
    const oldValue = parse(this.data, keyPath)
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

    assign(this.data, keyPath, newValue)
    this._dispatch(keyPath, newValue, oldValue)
    return this
  }
  get(keyPath) {
    this._dependOn(keyPath)
    return parse(this.data, keyPath)
  }
  del(keyPath) {
    // remove computed property
    if (this._descriptors[keyPath]) {
      delete this._descriptors[keyPath]
    }

    // remove dependencies
    if (this._deps[keyPath]) {
      each(this._deps[keyPath], (observe, key) => {
        this.unwatch(key, observe)
      })
      delete this._deps[keyPath]
    }

    // remove data
    const oldValue = parse(this.data, keyPath)
    remove(this.data, keyPath)
    this._dispatch(keyPath, undefined, oldValue)

    return this
  }
  update(data = {}, sync = false) {
    if (sync) {
      // update data
      const backup = clone(this.data)
      try {
        each(data, (value, key) => {
          this.set(key, value)
        })
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
    if (newValue === oldValue) {
      return
    }
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
