import {
  isEqual,
  isArray,
  isFunction,
  parse,
  makeKeyChain,
  clone,
  each,
  createProxy,
  assign,
  remove,
} from 'ts-fns'

export class Store {
  constructor(params = {}) {
    this.data = null
    this.state = null

    this._watchers = []

    this._updateData = {}
    this._updator = null

    this._computors = {}
    this._deps = {}
    this._dep = []

    this._observers = []

    this.init(params)
  }

  init(params) {
    // data & state
    const data = clone(params)
    this.data = data
    this.state = createProxy(data, {
      get: (keyPath, value) => {
        this._dependOn(keyPath)

        // auto observe at the first time
        this._observers.forEach((observer) => {
          const { nodes, trap } = observer
          const { match, register } = trap
          const existing = nodes.find(item => item.active === value && isEqual(item.key, keyPath))
          if (!existing && match(value)) {
            register(keyPath, value)
          }
        })

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
      dispatch: ({ keyPath, value, next, prev, active, invalid }, force) => {
        this.dispatch(keyPath, { value, next, prev, active, invalid }, force)
      },
    })

    // reset to empty object
    this._computors = {}
    this._deps = {}
    this._dep = []

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
    const fn = () => {
      this._collect(key)
    }

    const bind = (store, on) => {
      const computor = this._computors[key]
      if (!computor) {
        return bind
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

  /**
   *
   * @param {function|any} target if function return true to match
   * @param {function} subscribe dispatch: function({ key, next, prev }) => [unsubscribe]
   * @param {function} [unsubscribe] dispatch
   * @example
   * store.observe(model, (dispatch) => model.watch('*', dispatch, true), dispatch => model.unwatch('*', dispatch))
   * store.set(keyPath, model) // should must after observe
   */
  observe(target, subscribe, unsubscribe) {
    const match = (v) => {
      if (isFunction(target)) {
        return target(v)
      }
      else {
        return v === target
      }
    }

    const nodes = []

    const register = (key, active) => {
      const dispatch = ({ key: k, ...info }) => {
        this.dispatch([...key, ...k], info, true)
      }
      const unsubscribe = subscribe(dispatch, active)
      nodes.push({ key, active, dispatch, unsubscribe })
    }

    const watch = (info) => {
      const { key, next, prev, active, invalid } = info

      if (next === prev) {
        return
      }

      if (active === invalid) {
        return
      }

      // unsubscribe
      const index = nodes.findIndex(item => item.active === invalid && isEqual(item.key, key))
      if (index > -1) {
        const { dispatch, unsubscribe: _unsubscribe, active } = nodes[index]
        if (isFunction(_unsubscribe)) {
          _unsubscribe()
        }
        if (unsubscribe) {
          unsubscribe(dispatch, active)
        }
        nodes.splice(index, 1) // delete the item
      }

      // subscribe
      if (match(active)) {
        register(key, active)
      }
    }

    this.watch('*', watch, true)

    const trap = {
      match,
      register,
      watch,
    }

    const observer = {
      nodes,
      trap,
    }
    this._observers.push(observer)

    const disconnect = () => {
      this.unwatch('*', watch)
      const index = this._observers.indexOf(observer)
      if (index > -1) {
        this._observers.splice(index, 1)
      }
    }

    return disconnect
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
      const prev = this.data[by]
      const invalid = this.state[by]
      this._collect(by)
      const active = this.state[by]
      const next = this.data[by]
      const value = next
      this.dispatch(by, { value, next, active, prev, invalid })
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

  dispatch(keyPath, { value, next, prev, active, invalid }, force = false) {
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
    const anys = watchers.filter((item) => {
      if (!isEqual(item.key, ['*'])) {
        return false
      }
      // if watch('*', fn, false), only top level will be watched
      else if (!item.deep && key.length > 1) {
        return false
      }
      else {
        return true
      }
    })
    items.push(...anys)

    items.forEach((item) => {
      const target = item.key
      const key = keyPath
      item.fn.call(this.state, { target, key, value, next, prev, active, invalid })
    })
  }

}

export default Store
