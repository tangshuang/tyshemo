import {
  isEqual,
  isArray,
  isFunction,
  parse,
  makeKeyChain,
  each,
  createProxy,
  assign,
  remove,
  isUndefined,
} from 'ts-fns'

export class Store {
  constructor(params = {}) {
    this.data = null
    this.state = null
    this.editable = true
    this.silent = false

    this._watchers = []

    this._updateData = {}
    this._updator = null

    this._descriptors = {}
    this._deps = {}
    this._dep = []

    this._observers = []

    this.init(params)
  }

  init(params) {
    // reset to empty object
    this._descriptors = {}
    this._deps = {}
    this._dep = []

    const data = {}
    // data & state
    this.data = {}
    this.state = createProxy(this.data, {
      get: (keyPath, active) => {
        // keep store in state
        if (keyPath[0] === '__store__') {
          return this
        }

        // auto observe at the first time
        this._observers.forEach((observer) => {
          const value = parse(this.data, keyPath)
          const { nodes, trap } = observer
          const { match, register } = trap
          const existing = nodes.find(item => item.value === value && isEqual(item.key, keyPath))
          if (!existing && (match(value) || match(active))) {
            register(keyPath, value, active)
          }
        })

        this._dependOn(keyPath)

        return active
      },
      set: (keyPath, value) => {
        // computed property
        if (keyPath.length === 1 && this._descriptors[keyPath[0]]) {
          const key = keyPath[0]
          const descriptor = this._descriptors[key]

          // call setter
          if (descriptor.set) {
            descriptor.set.call(this.state, value)
          }

          // compute
          const next = descriptor.get ? descriptor.get.call(this.state) : undefined
          return next
        }
        else {
          return value
        }
      },
      del: (keyPath) => {
        // computed property
        if (keyPath.length === 1 && this._descriptors[keyPath[0]]) {
          const key = keyPath[0]

          // remove existing bounds
          const descriptor = this._descriptors[key]
          if (descriptor && descriptor.bounds) {
            descriptor.bounds.forEach((item) => {
              item.store.unwatch(item.on, item.fn)
            })
          }

          // remove computed property
          delete this._descriptors[key]

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
      writable: () => {
        // chould not change the value any more
        return this.editable
      },
    })

    // descriptors
    const descriptors = this._descriptors
    each(params, (value, key) => {
      const descriptor = Object.getOwnPropertyDescriptor(params, key)
      if (descriptor.get || descriptor.set) {
        descriptors[key] = descriptor
      }
    })

    // init values
    // make value patch to data, so that the data has initialized value which is needed in compute
    each(params, (value, key) => {
      this.state[key] = value
    })
    // collecting dependencies
    each(descriptors, (item, key) => {
      if (item.get) {
        this._collect(key)
      }
    })
  }

  get(keyPath) {
    return parse(this.state, keyPath)
  }

  set(keyPath, value) {
    assign(this.state, keyPath, value)
    return value
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
    const descriptor = isFunction(options) ? { get: options } : options
    this.del(key)
    this._descriptors[key] = descriptor
    if (descriptor.get) {
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
      const descriptor = this._descriptors[key]
      if (!descriptor) {
        return bind
      }

      store.watch(on, fn, true)
      descriptor.bounds = descriptor.bounds = []
      descriptor.bounds.push({
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

    const register = (key, value, active) => {
      const dispatch = ({ key: k, ...info }) => {
        this.dispatch([...key, ...k], info, true)
      }
      const unsubscribe = subscribe(value)(dispatch)
      nodes.push({ key, value, active, dispatch, unsubscribe })
    }

    const watch = (info) => {
      const { key, value, next, prev, active, invalid } = info

      if (next === prev) {
        return
      }

      if (active === invalid) {
        return
      }

      // unsubscribe
      const index = nodes.findIndex(item => item.value === prev && isEqual(item.key, key))
      if (index > -1) {
        const { dispatch, unsubscribe: _unsubscribe, value } = nodes[index]
        if (isFunction(_unsubscribe)) {
          _unsubscribe()
        }
        if (unsubscribe) {
          unsubscribe(value)(dispatch)
        }
        nodes.splice(index, 1) // delete the item
      }

      // subscribe
      if (match(value) || match(active)) {
        register(key, value, active)
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

    const descriptor = this._descriptors[by]
    if (!descriptor || !descriptor.get) {
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

    const descriptor = this._descriptors[key]
    if (!descriptor || !descriptor.get) {
      this._dep.pop()
      return
    }

    const value = descriptor.get.call(this.state)
    this.state[key] = value

    this._dep.pop()
  }

  watch(keyPath, fn, deep = false, context) {
    const items = this._watchers
    const key = isArray(keyPath) ? keyPath : makeKeyChain(keyPath)
    items.push({ key, fn, deep, context })
    return this
  }

  unwatch(keyPath, fn) {
    const items = this._watchers
    const key = isArray(keyPath) ? keyPath : makeKeyChain(keyPath)
    items.forEach((item, i) => {
      if (isEqual(item.key, key) && (item.fn === fn || isUndefined(fn))) {
        items.splice(i, 1)
      }
    })
    return this
  }

  dispatch(keyPath, { value, next, prev, active, invalid }, force = false) {
    if (this.silent) {
      return
    }

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
      item.fn.call(item.context || this.state, { target, key, value, next, prev, active, invalid })
    })
  }

}

export default Store
