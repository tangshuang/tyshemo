import {
  isEqual,
  isArray,
  isFunction,
  parse,
  makeKeyChain,
  clone,
  each,
  createProxy,
  define,
  assign,
  remove,
} from 'ts-fns'

export class Store {
  constructor(params = {}) {
    this.data = null
    this.state = null

    this._computors = {}
    this._watchers = []

    this._updateData = {}
    this._updator = null

    this._deps = {}
    this._dep = []

    this.init(params)
  }

  init(params) {
    // data & state
    const data = clone(params)
    this.data = data
    this.state = createProxy(data, {
      get: (keyPath, value) => {
        this._dependOn(keyPath)
        return value
      },
      set: (keyPath, value) => {
        // computed property
        if (keyPath.length === 1 && this._computors[keyPath[0]]) {
          const key = keyPath[0]
          const computor = this._computors[key]

          // call setter
          if (computor.set) {
            computor.set.call(this.state, value)
          }

          // compute
          const next = computor.get ? computor.get.call(this.state) : undefined
          return next
        }
        else {
          return value
        }
      },
      del: (keyPath) => {
        // computed property
        if (keyPath.length === 1 && this._computors[keyPath[0]]) {
          const key = keyPath[0]

          // remove existing bounds
          const computor = this._computors[key]
          if (computor && computor.bounds) {
            computor.bounds.forEach((item) => {
              item.store.unwatch(item.on, item.fn)
            })
          }

          // remove computed property
          delete this._computors[key]

          // remove dependencies
          if (this._deps[key]) {
            each(this._deps[key], (observe, key) => {
              this.unwatch(key, observe)
            })
            delete this._deps[key]
          }
        }
      },
      dispatch: (keyPath, next, prev, force) => {
        this._dispatch(keyPath, next, prev, force)
      },
    })

    // computors
    const computors = this._computors
    each(params, (value, key) => {
      const computor = Object.getOwnPropertyDescriptor(params, key)
      if (computor.get || computor.set) {
        computors[key] = computor
      }
    })

    // collecting dependencies
    each(computors, (item, key) => {
      if (item.get) {
        this._collect(key)
      }
    })
  }

  get(keyPath) {
    return parse(this.state, keyPath)
  }

  set(keyPath, value) {
    return assign(this.state, keyPath, value)
  }

  del(keyPath) {
    remove(this.state, keyPath)
  }

  update(data = {}, async) {
    if (async) {
      Object.assign(this._updateData, data)

      if (this._updator) {
        return this._updator
      }

      const updator =  Promise.resolve().then(() => {
        this.update(this._updateData)
      }).then(() => {
        this._updateData = {}
        this._updator = null
        return this.data
      })

      this._updator = updator

      return updator
    }

    each(data, (value, key) => {
      this.set(key, value)
    })
    return this.data
  }

  // define a computed property
  define(key, options) {
    const computor = isFunction(options) ? { get: options } : options
    this.del(key)
    this._computors[key] = computor
    if (computor.get) {
      this._collect(key)
    }
    return this.state[key]
  }

  /**
   * bind a key to another store, when the store's certain key changed, re-compute key
   * @param {*} key
   * @example
   * store1.bind('age')(store2, 'age') // bind store1's age to store2's age, when store2's age changed, store1's age will re-compute
   */
  bind(key) {
    const bind = (store, on) => {
      const computor = this._computors[key]
      if (!computor) {
        return bind
      }

      const fn = () => {
        this._collect(key)
      }
      store.watch(on, fn, true)
      computor.bounds = computor.bounds = []
      computor.bounds.push({
        store,
        on,
        fn,
      })

      return bind
    }
    return bind
  }

  // watch change of dependencies
  _dependOn(keyPath) {
    const chain = isArray(keyPath) ? keyPath : makeKeyChain(keyPath)
    if (chain.length > 1) {
      return
    }

    const key = chain[0]
    const dep = this._dep
    const by = dep[dep.length - 1]

    // without begin
    if (!by) {
      return
    }

    // donot depend on self
    if (by === key) {
      return
    }

    const computor = this._computors[by]
    if (!computor || !computor.get) {
      return
    }

    const deps = this._deps
    const depsOfBy = deps[by] = deps[by] || {}
    const depInBy = depsOfBy[key]

    // has been collected
    if (depInBy) {
      return
    }

    const observe = () => {
      const prev = this.state[by]
      this._collect(by)
      const next = this.state[by]
      this._dispatch(by, next, prev)
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

  // collect dependencies, re-compute value
  _collect(key) {
    this._dep.push(key)

    const computor = this._computors[key]
    if (!computor || !computor.get) {
      this._dep.pop()
      return
    }

    const value = computor.get.call(this.state)
    this.state[key] = value

    this._dep.pop()
  }

  watch(keyPath, fn, deep = false) {
    const items = this._watchers
    const key = isArray(keyPath) ? keyPath : makeKeyChain(keyPath)
    items.push({ key, fn, deep })
    return this
  }

  unwatch(keyPath, fn) {
    const items = this._watchers
    const key = isArray(keyPath) ? keyPath : makeKeyChain(keyPath)
    items.forEach((item, i) => {
      if (isEqual(item.key, key) && (item.fn === fn || fn === undefined)) {
        items.splice(i, 1)
      }
    })
    return this
  }

  _dispatch(keyPath, next, prev, force) {
    if (!force && next === prev) {
      return
    }

    if (!force && isEqual(next, prev)) {
      return
    }

    const key = isArray(keyPath) ? keyPath : makeKeyChain(keyPath)
    const watchers = this._watchers
    const items = watchers.filter((item) => {
      if (isEqual(item.key, key)) {
        return true
      }
      else if (item.deep && isEqual(key, item.key.slice(0, key.length))) {
        return true
      }
      else {
        return false
      }
    })
    // watchers which watch any change
    items.push(...watchers.filter(item => isEqual(item.key, ['*'])))

    items.forEach((item) => {
      const target = item.key
      const key = keyPath
      item.fn.call(this.state, { target, key, next, prev })
    })
  }

}

export default Store
