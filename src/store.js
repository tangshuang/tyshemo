import {
  isEqual,
  isArray,
  isFunction,
  parse,
  makeKeyChain,
  each,
  createProxy,
  getSymbolContent,
  assign,
  remove,
  isUndefined,
  isSymbol,
} from 'ts-fns'
import {
  isKeyPathEqual,
} from './shared/utils.js'

export class Store {
  constructor(params = {}) {
    this.data = null
    this.state = null
    this.editable = true
    this.silent = false
    this.context = this.getContext()

    this._watchers = []

    this._updateData = {}
    this._updator = null

    this._descriptors = {}
    this._deps = {}
    this._dep = []

    this._observers = []

    this.init(params)
  }

  runSilent(fn, ...args) {
    const latestSilent = this.silent
    this.silent = true
    const res = fn(...args)
    this.silent = latestSilent
    return res
  }

  getContext() {
    return null
  }

  init(params) {
    this.runSilent(() => {
      // remove binders if exist
      each(this._descriptors, (_, key) => this.del(key))
      // reset to empty object
      this._descriptors = {}
      this._deps = {}
      this._dep = []

      // data & state
      this.data = {}
      const traps = this._traps({
        get: (keyPath, active) => {
          const key = keyPath[0]

          // keep store in state
          if (isSymbol(key) && getSymbolContent(key) === 'STORE') {
            return this
          }

          // auto observe at the first time
          this._observers.forEach((observer) => {
            const value = parse(this.data, keyPath)
            const { nodes, trap } = observer
            const { match, register } = trap
            const existing = nodes.find(item => item.value === value && isKeyPathEqual(item.key, keyPath))
            if (!existing && (match(value) || match(active))) {
              register(keyPath, value, active)
            }
          })

          this._depend(keyPath)

          return active
        },
        set: (keyPath, value) => {
          // computed property
          const key = keyPath[0]
          const descriptor = this._descriptors[key]
          if (keyPath.length === 1 && descriptor) {
            // call setter
            if (descriptor.set) {
              descriptor.set.call(this.state, value)
            }
          }

          // support change computed property
          return value
        },
        del: (keyPath) => {
          // computed property
          if (keyPath.length === 1 && this._descriptors[keyPath[0]]) {
            const key = keyPath[0]

            // remove existing binders
            const descriptor = this._descriptors[key]
            if (descriptor && descriptor.binders) {
              descriptor.binders.forEach((item) => {
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
      this.state = createProxy(this.data, traps)

      // descriptors
      each(params, (descriptor, key) => {
        // make value patch to data, so that the data has initialized value which is needed in compute
        this.state[key] = params[key]

        // now all keys have been generated

        // collect descriptors
        if (descriptor.get || descriptor.set) {
          this._descriptors[key] = descriptor
        }
      }, true)

      // collecting dependencies
      // this should be executed after all values have been set to state, or computers will throw out errors
      each(this._descriptors, (item, key) => {
        if (item.get) {
          this._collect(key)
          this._refine(key, true)
        }
      })
    })
  }

  _traps(traps) {
    return traps
  }

  get(keyPath) {
    return parse(this.state, keyPath)
  }

  set(keyPath, value, silent) {
    if (silent) {
      this.runSilent(() => {
        assign(this.state, keyPath, value)
      })
    }
    else {
      assign(this.state, keyPath, value)
    }
    return value
  }

  del(keyPath) {
    remove(this.state, keyPath)
  }

  update(data = {}, async, silent) {
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
        return this.state
      })

      this._updator = updator

      return updator
    }

    each(data, (value, key) => {
      this.set(key, value, silent)
    })
    return Promise.resolve(this.state)
  }

  // define a computed property
  define(key, options) {
    const descriptor = isFunction(options) ? { get: options } : options
    this.del(key)
    this._descriptors[key] = descriptor
    if (descriptor.get) {
      this._collect(key)
      this._refine(key, true)
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
      this._refine(key)
    }

    const bind = (store, on) => {
      const descriptor = this._descriptors[key]
      if (!descriptor) {
        return bind
      }

      store.watch(on, fn, true)
      descriptor.binders = descriptor.binders = []
      descriptor.binders.push({
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
   * @param {function|any} target if function, return true to match
   * @param {function} subscribe target => dispatch => [unsubscribe]
   * @param {function} [unsubscribe] target => dispatch => !
   * @example
   * const disconnect = store.observe(
   *  model,
   *  model => dispatch => model.watch('*', dispatch, true),
   *  model => dispatch => model.unwatch('*', dispatch),
   * )
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
      const index = nodes.findIndex(item => item.value === prev && isKeyPathEqual(item.key, key))
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
  _depend(keyPath) {
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

    const reactive = () => {
      this._collect(by)
      this._refine(by)
    }
    this.watch(key, reactive, true)
    depsOfBy[key] = reactive

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

  _refine(key, silent) {
    const descriptor = this._descriptors[key]
    if (!descriptor || !descriptor.get) {
      return
    }

    const value = this._compute(key)
    this.set(key, value, silent)
  }

  // collect dependencies, re-compute value
  _collect(key) {
    this._dep.push(key)

    const descriptor = this._descriptors[key]
    if (!descriptor || !descriptor.get) {
      this._dep.pop()
      return
    }

    this._compute(key)
    this._dep.pop()
  }

  _compute(key) {
    const descriptor = this._descriptors[key]
    if (!descriptor || !descriptor.get) {
      return
    }

    const value = descriptor.get.call(this.state)
    return value
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
      if (isKeyPathEqual(item.key, key) && (item.fn === fn || isUndefined(fn))) {
        items.splice(i, 1)
      }
    })
    return this
  }

  dispatch(keyPath, { value, next, prev, active, invalid, compute }, force = false) {
    if (this.silent) {
      return false
    }

    if (!force && next === prev) {
      return false
    }

    if (!force && isEqual(next, prev)) {
      return false
    }

    const key = isArray(keyPath) ? [...keyPath] : makeKeyChain(keyPath)
    const watchers = this._watchers
    const items = watchers.filter((item) => {
      if (isKeyPathEqual(item.key, key)) {
        return true
      }
      if (item.deep && isKeyPathEqual(item.key, key.slice(0, item.key.length))) {
        return true
      }
      return false
    })
    // watchers which watch any change
    const anys = watchers.filter((item) => {
      if (item.key[0] && item.key[0][0] === '!') {
        return false
      }
      if (!isKeyPathEqual(item.key, ['*'])) {
        return false
      }
      // if watch('*', fn, false), only top level will be watched
      if (!item.deep && key.length > 1) {
        return false
      }
      return true
    })
    items.push(...anys)

    items.forEach((item) => {
      const target = item.key
      item.fn.call(this.context || this.state, { target, key, value, next, prev, active, invalid, compute })
    })

    return true
  }

  forceDispatch(keyPath = '!', ...args) {
    if (this.silent) {
      return false
    }

    const key = isArray(keyPath) ? [...keyPath] : makeKeyChain(keyPath)
    const watchers = this._watchers
    const items = watchers.filter((item) => {
      if (!(item.key[0] && item.key[0][0] === '!')) {
        return false
      }
      if (item.key[0] === '!') {
        return false
      }
      if (isKeyPathEqual(item.key, key)) {
        return true
      }
      if (item.deep && isKeyPathEqual(item.key, key.slice(0, item.key.length))) {
        return true
      }
      return false
    })
    // watchers which watch any change
    const anys = watchers.filter((item) => {
      if (!isKeyPathEqual(item.key, ['!'])) {
        return false
      }
      // if watch('!', fn, false), only top level will be watched
      if (!item.deep && key.length > 1) {
        return false
      }
      return true
    })
    items.push(...anys)

    items.forEach((item) => {
      item.fn.call(this.context || this.state, key, ...args)
    })

    return true
  }

}
