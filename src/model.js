import {
  isObject,
  isInheritedOf,
  isArray,
  map,
  each,
  flat,
  flatArray,
  define,
  makeKeyChain,
  parse,
  clone,
  isInstanceOf,
  isFunction,
  assign,
  isUndefined,
  inObject,
  isNull,
  inherit,
  inArray,
  getConstructorOf,
  isConstructor,
  mixin,
  createArray,
  makeKeyPath,
} from 'ts-fns'

import _Schema from './schema.js'
import _Store from './store.js'
import { ofChain, tryGet, makeMsg, isAsyncRef, isMemoRef } from './shared/utils.js'
import { edit } from './shared/edit.js'
import Meta from './meta.js'
import { Factory, FactoryMeta } from './factory.js'

const DEFAULT_ATTRIBUTES = {
  default: null,
  compute: null,
  type: null,
  message: null,
  force: null,
  validators: null,
  create: null,
  save: null,
  drop: null,
  map: null,
  flat: null,
  to: null,
  asset: null,
  getter: null,
  setter: null,
  formatter: null,
  readonly: false,
  disabled: false,
  hidden: false,
  required: false,
  empty: null,
  watch: null,
  catch: null,
  state: null,
  deps: null,
}

/**
 * class SomeModel extends Model {
 *   static some = {
 *     type: String,
 *     default: '',
 *   }
 * }
 *
 * @keywords: $schema, $store, $views, init,
 *            get, set, del, update, define,
 *            watch, unwatch, validate, restore,
 *            fromJSON, toJSON, toParams, toFormData,
 *            onInit, onParse, onExport,
 */
export class Model {
  constructor(data = {}, [parent, key] = []) {
    const $this = this

    /**
     * create schema
     */
    class Schema extends _Schema {
      constructor(metas) {
        const needs = []
        const gives = []

        const defs = map(metas, (def) => {
          if (!def) {
            return
          }

          if (isInstanceOf(def, Meta) || isInheritedOf(def, Meta)) {
            if (isFunction(def.needs)) {
              needs.push(...def.needs())
            }
            if (isInstanceOf(def, FactoryMeta)) {
              const entries = def.$entries
              gives.push(...[].concat(entries))
            }
            else {
              gives.push(def)
            }
            return def
          }

          if (isObject(def) && inObject('default', def)) {
            const meta = new Meta(def)
            if (isFunction(meta.needs)) {
              needs.push(...meta.needs())
            }
            return meta
          }

          /**
           * class SomeModel extends Model {
           *   static some = OtherModel
           * }
           */
          if (isInheritedOf(def, Model)) {
            gives.push(def)
            return Factory.getMeta(def)
          }

          /**
           * class SomeModel extends Model {
           *   static some = [OtherModel, AnyModel]
           * }
           */
          if (isArray(def) && !def.some(def => !isInheritedOf(def, Model))) {
            gives.push(...def)
            return Factory.getMeta(def)
          }

          return def
        })

        if (needs.length) {
          for (let i = 0, len = needs.length; i < len; i ++) {
            const need = needs[i]
            let flag = false
            for (let j = 0, leng = gives.length; j < leng; j ++) {
              const give = gives[j]
              if (give === need || isInstanceOf(give, need) || isInheritedOf(give, need)) {
                flag = true
                break
              }
            }
            if (!flag) {
              throw new Error(`${need} is needed, but not given in Model.`)
            }
          }
        }

        super(defs)
      }
      onError(e) {
        // dont throw error when generate data when initialize
        if ($this.$init && e.attr === 'create') {
          return
        }
        $this.onError(e)
        $this.emit('error', e)
      }
    }
    // create schema
    let schema = this.schema(Schema)
    // support schema instance or object
    if (!isInstanceOf(schema, _Schema)) {
      schema = new Schema(schema)
    }
    define(this, '$schema', schema)
    define(this, '$hooks', [])
    define(this, '$$attrs', { ...DEFAULT_ATTRIBUTES, ...this.attrs() })
    define(this, '$$state', this.state())
    define(this, '$$deps', {})
    define(this, '$$memories', [])

    // use passed parent
    if (parent && isInstanceOf(parent, Model) && key) {
      this.setParent([parent, key])
    }

    define(this, '$root', () => {
      let parent = this.$parent

      if (!parent) {
        return
      }

      while (parent.$parent) {
        parent = parent.$parent
      }

      return parent
    })

    define(this, '$absKeyPath', () => {
      let parent = this.$parent

      if (!parent) {
        return []
      }

      const path = [...this.$keyPath]

      while (parent && parent.$keyPath) {
        path.unshift(...parent.$keyPath)
        parent = parent.$parent
      }

      return path
    })

    /**
     * create store
     */
    class Store extends _Store {
      _traps(traps) {
        const isNotNeed = (keyPath) => {
          if (keyPath.length !== 1) {
            return true
          }

          const [key] = keyPath
          const meta = $this.$schema[key]
          if (!meta) {
            return true
          }

          if (!isInstanceOf(meta, FactoryMeta)) {
            return true
          }

          const { $entries } = meta
          if (!isArray($entries)) {
            return true
          }
        }

        const inserter = (keyPath, args) => {
          if (isNotNeed(keyPath)) {
            return args
          }

          const [key] = keyPath
          const meta = $this.$schema[key]
          const { $entries } = meta

          const nexts = args.filter((item) => {
            if ($entries.some(One => isInstanceOf(item, One))) {
              return true
            }
            if (isObject(item)) {
              return true
            }
            return false
          })
          const [Entry] = $entries
          const values = nexts.map((next) => {
            const model = $entries.some(One => isInstanceOf(next, One)) ? next.setParent([$this, key])
              : isObject(next) ? new Entry(next, [$this, key])
              : new Entry({}, [$this, key])
            return model
          })
          return values
        }
        traps.push = inserter
        traps.unshift = inserter

        traps.splice = (keyPath, args) => {
          if (isNotNeed(keyPath)) {
            return args
          }

          const [start, count, ...items] = args
          const values = items.length ? inserter(keyPath, items) : []
          return [start, count, ...values]
        }

        traps.fill = (keyPath, args) => {
          if (isNotNeed(keyPath)) {
            return args
          }

          const [value, start, end] = args
          const [key] = keyPath
          const current = $this[key]
          const len = current.length

          // without effects
          if (start && start >= len) {
            return false
          }

          const from = start || 0

          if (end && end <= from) {
            return false
          }

          const to = !end || end > len ? len : end
          const count = to - from

          const items = createArray(value, count)
          const values = inserter(keyPath, items)

          return {
            to: 'splice',
            args: [start, count, ...values],
          }
        }

        const trapGet = traps.get
        traps.get = (keyPath, active) => {
          trapGet(keyPath, active)

          if (!$this.$collection) {
            const deep = []
            let child = $this
            let parent = child.$parent
            let flag = null
            while (parent) {
              const keyPath = child.$keyPath
              deep.unshift(...keyPath)

              if (parent.$collection) {
                flag = parent
                break
              }

              child = parent
              parent = child.$parent
            }
            if (flag) {
              flag.$collection.items.push([deep, $this])
              $this.collect()
            }
          }

          if ($this.$collection && $this.$collection.enable && $this.$collection.fields) {
            $this.$collection.items.push([keyPath, active])
            if (isInstanceOf(active, Model)) {
              active.collect()
            }
          }

          return active
        }

        return traps
      }
      dispatch(keyPath, e, force) {
        const notified = super.dispatch(keyPath, e, force)
        // propagation
        if (notified && $this.$parent && $this.$keyPath) {
          $this.$parent.$store.dispatch([...$this.$keyPath, ...keyPath], e, true)
        }
        return notified
      }
    }
    const store = new Store()
    define(this, '$store', store)

    this.init(data)

    /**
     * support async onInit
     * i.e.
     *
     * async onInit() {
     *   const options = await this.$schema.some.getOptionsAsync()
     *   this.options = options
     * }
     *
     * async getOptions() {
     *   await this.$ready
     *   return this.options
     * }
     */
    define(this, '$ready', Promise.resolve(this.onInit()))
  }

  schema() {
    // create schema by model's static properties
    return ofChain(this, Model)
  }

  state() {
    return {}
  }

  attrs() {
    return {}
  }

  init(data = {}) {
    if (this.$ready) {
      return
    }

    const keys = Object.keys(this.$schema)

    // patch keys to this
    keys.forEach((key) => {
      define(this, key, {
        get: () => this.get(key),
        set: (value) => this.set(key, value),
        enumerable: true,
        configurable: true,
      })
    })

    // views
    const views = {}

    keys.forEach((key) => {
      // patch attributes from meta
      const meta = this.$schema[key]
      // default attributes which will be used by Model/Schema, can not be reset by userself
      const attrs = this.$$attrs
      // define a view
      const view = {
        changed: false, // whether the field has changed
      }
      // use defineProperties to define view properties
      const viewDef = {}

      each(attrs, (fallback, attr) => {
        if (isNull(fallback)) {
          return
        }
        viewDef[attr] = {
          get: () => this.$schema.$decide(key, attr, this)(fallback),
          enumerable: true,
        }
      })

      each(meta, (descriptor, attr) => {
        if (inArray(attr[0], ['$', '_'])) {
          return
        }

        if (inObject(attr, attrs)) {
          return
        }

        const { value, get, set } = descriptor
        if (get || set) {
          viewDef[attr] = {
            get: get && get.bind(this),
            set: set && set.bind(this),
            enumerable: true,
            configurable: true,
          }
        }
        else if (isAsyncRef(value)) {
          const { current, attach } = value
          let attrValue = current
          // async set attr value
          attach(key, attr).then((next) => {
            if (next === attrValue) {
              return
            }
            const prev = attrValue
            attrValue = next
            this.$store.forceDispatch(`!${key}.${attr}`, next, prev)
          })
          viewDef[attr] = {
            get: () => {
              if (this.$collection && this.$collection.enable && this.$collection.views) {
                this.$collection.items.push([`!${key}.${attr}`])
              }
              return attrValue
            },
            set: (value) => {
              const prev = attrValue
              attrValue = value
              this.$store.forceDispatch(`!${key}.${attr}`, value, prev)
            },
            enumerable: true,
            configurable: true,
          }
        }
        else if (isMemoRef(value)) {
          const { getter, compare, depend } = value
          viewDef[attr] = {
            get: () => {
              return this.memo(getter, compare, depend)
            },
            enumerable: true,
            configurable: true,
          }
        }
        // use as a getter
        else if (isFunction(value)) {
          viewDef[attr] = {
            get: value.bind(this),
            enumerable: true,
            configurable: true,
          }
        }
        // patch to view directly
        else {
          let attrValue = value
          viewDef[attr] = {
            get: () => {
              if (this.$collection && this.$collection.enable && this.$collection.views) {
                this.$collection.items.push([`!${key}.${attr}`])
              }
              return attrValue
            },
            set: (value) => {
              const prev = attrValue
              attrValue = value
              this.$store.forceDispatch(`!${key}.${attr}`, value, prev)
            },
            enumerable: true,
            configurable: true,
          }
        }
      }, true)

      // unwritable mandatory view properties
      const getData = () => this._getData(key)
      Object.assign(viewDef, {
        key: {
          get: () => key,
          enumerable: true,
        },
        value: {
          get: () => this.get(key),
          set: (value) => this.set(key, value),
          enumerable: true,
        },
        errors: {
          get: () => makeMsg(this.$schema.$validate(key, getData(), this)([])),
          enumerable: true,
        },
        empty: {
          get: () => this.$schema.empty(key, getData(), this),
          enumerable: true,
        },
        data: {
          get: () => getData(),
          enumerable: true,
        },
        text: {
          get: () => this.$schema.format(key, getData(), this),
          enumerable: true,
        },
        state: {
          get: () => {
            const state = meta.state ? meta.state() : {}
            const keys = Object.keys(state)
            const proxy = new Proxy(state, {
              get: (_, key) => inArray(key, keys) ? this.get(key) : undefined,
              set: (_, key, value) => inArray(key, keys) && this.set(key, value),
            })
            return proxy
          },
          enumerable: true,
        },
        absKeyPath: {
          get: () => {
            const absKeyPath = this.$absKeyPath
            return [...absKeyPath, key]
          },
          enumerable: true,
        },
      })

      Object.defineProperties(view, viewDef)

      define(views, key, {
        get: () => {
          if (this.$collection && this.$collection.enable && this.$collection.views) {
            this.$collection.items.push([`!${key}`])
          }
          return view
        },
        enumerable: true,
      })
    })

    define(this, '$views', views)

    // create errors, so that is's easy and quick to know the model's current status
    define(this.$views, '$errors', () => {
      const errors = []
      each(views, (view) => {
        errors.push(...view.errors)
      })
      return makeMsg(errors)
    })

    // create changed, so that it's easy to find out whether the data has changed
    define(this.$views, '$changed', {
      get: () => this.collect(() => keys.some((key) => this.$views[key].changed), true),
      set: (status) => this.collect(() => keys.forEach(key => this.$views[key].changed = !!status), true),
    })

    // create $state, so that it's easy to read state from $views
    define(this.$views, '$state', () => {
      const state = this._combineState()
      const keys = Object.keys(state)
      const output = {}
      keys.forEach((key) => {
        define(output, key, {
          enumerable: true,
          get: () => this[key],
          set: (value) => this[key] = value,
        })
      })
      return output
    })

    // invoke `init` attribute
    keys.forEach((key) => {
      const meta = this.$schema[key]
      if (meta.init) {
        meta.init.call(this, key)
      }
    })

    // init data
    this._initData(data)

    // register a listener
    this.watch('*', (e) => {
      const { key, compute } = e
      const root = key[0]
      const def = this.$schema[root]

      if (!def) {
        return
      }

      // disable for private properties
      if (inArray(key[key.length - 1][0], ['$', '_'])) {
        return
      }

      // response for def.watch attribute
      if (def.watch) {
        def.watch.call(this, e, key)
      }

      // check $parent
      this._ensure(root)

      // modify view.changed
      if (!compute) {
        this.collect(() => {
          this.$views[root].changed = true
        }, true)
      }

      if (this.$$deps[root]) {
        const { deps, fn } = this.$$deps[root]
        deps.forEach((dep) => {
          this.unwatch(dep, fn)
        })
      }

      this.onChange(root)
    }, true)

    this.emit('init')
  }

  _initData(data) {
    this.$initing = true
    this.fromJSON(data)
    delete this.$initing
  }

  _initState() {
    const output = {}
    const state = this.$$state
    const combine = (state) => {
      each(state, (descriptor, key) => {
        const { value } = descriptor
        if (isAsyncRef(value)) {
          const { current, attach } = value
          output[key] = current

          if (this.$ready) {
            return
          }

          // async set attr value
          attach(key).then((next) => {
            if (this[key] === next) {
              return
            }
            if (this[key] && typeof this[key] === 'object' && this[key][Symbol('ORIGIN')] === next) {
              return
            }
            this[key] = next // will trigger watcher
          })

          return
        }

        define(output, key, {
          ...descriptor,
          enumerable: true,
          configurable: true,
        })
      }, true)
    }

    combine(state)

    each(this.$schema, (meta) => {
      if (!meta.state) {
        return
      }

      const metaState = meta.state()
      if (metaState) {
        combine(metaState)
      }
    })

    return output
  }

  _combineState() {
    const basicState = this.$$state
    const metasState = {}

    each(this.$schema, (meta) => {
      if (!meta.state) {
        return
      }

      const metaState = meta.state()
      if (metaState) {
        Object.assign(metasState, metaState)
      }
    })

    const combinedState = {
      ...basicState,
      ...metasState,
    }

    const keys = Object.keys(combinedState)
    const state = {}

    keys.forEach((key) => {
      state[key] = this[key]
    })

    return state
  }

  /**
   * reset and cover all data, original model will be clear first, and will use new data to cover the whole model.
   * notice that, properties which are in original model be not in schema may be removed.
   * @param {*} data
   * @param {string[]} keysPatchToThis keys those not in schema but path to this
   */
  restore(data, keysPatchToThis = []) {
    if (!this.$store.editable) {
      return this
    }

    const schema = this.$schema
    const state = this._initState()
    const params = {}
    const input = {}

    const ensure = (value, key) => {
      if (isArray(value)) {
        value.forEach((item, i) => ensure(item, key))
      }
      else if (isInstanceOf(value, Model)) {
        value.setParent([this, key])
      }
    }
    const record = (key) => {
      if (inObject(key, data)) {
        const value = data[key]
        input[key] = value
        ensure(value, key)
      }
    }

    // patch state
    each(state, (descriptor, key) => {
      if (descriptor.get || descriptor.set) {
        define(params, key, descriptor)
        // use data property if exist, use data property directly
        record(key)
      }
      else if (inObject(key, data)) {
        params[key] = data[key]
      }
      else {
        params[key] = descriptor.value
      }
      // define state here so that we can invoke this.state() only once when initialize
      define(this, key, {
        get: () => this.get(key),
        set: (value) => this.set(key, value),
        enumerable: true,
        configurable: true,
      })
    }, true)

    // those on schema
    each(schema, (_, key) => {
      if (inObject(key, data)) {
        const value = data[key]
        params[key] = value
        ensure(value, key)
        return
      }

      // notice here, we call this in default(), we can get passed state properties
      const value = schema.getDefault(key, this)

      // default can be an AsyncGetter, so that we can set default value asyncly
      if (isAsyncRef(value)) {
        const { current, attach } = value
        params[key] = current
        ensure(current, key)

        attach(key, 'default').then((next) => {
          if (this[key] === next) {
            return
          }
          if (this[key] && typeof this[key] === 'object' && this[key][Symbol('ORIGIN')] === next) {
            return
          }
          this[key] = next // will trigger watcher
        })
      }
      else {
        params[key] = value
        ensure(value, key)
      }
    })

    // delete the outdate properties
    each(this.$store.state, (_, key) => {
      if (inObject(key, params)) {
        return
      }

      // disable for private properties
      if (inArray(key[0], ['$', '_'])) {
        return
      }

      this.$store.del(key)
      delete this[key]
    }, true)

    // reset into store
    const initParams = this.onSwitch(params)
    this.emit('switch', initParams)
    this.$store.init(initParams)

    // patch those which are not in store but on `this`
    each(data, (value, key) => {
      if (!inObject(key, params) && inObject(key, this)) {
        this[key] = value
      }
    })
    // patch keys to this, i.e. this.fromJSON(data, ['polices']) => this.polices
    keysPatchToThis.forEach((key) => {
      if (!inObject(key, this)) {
        this[key] = json[key]
      }
    })

    // reset changed
    this.$views.$changed = false

    this.onRestore()
    this.emit('restore')

    // dependencies collection
    // after onRestore, so that developers can do some thing before collection
    each(this.$schema, (meta, key) => {
      if (meta.compute) {
        this._getData(key)
      }
    })

    return this
  }

  /**
   * get field value, with formatting by `getter`
   * @param {array|string} keyPath
   */
  get(keyPath) {
    const chain = isArray(keyPath) ? [...keyPath] : makeKeyChain(keyPath)
    const key = chain.shift()

    const value = this._getData(key)
    const transformed = this.$schema.get(key, value, this)
    const output = parse(transformed, chain)

    return output
  }

  /**
   * @param {*} type 0: start, 1: end
   */
  collect(collector, inverse) {
    if (isFunction(collector)) {
      if (inverse) { // if true, do not collect deps, and return normal value of collector fn
        if (this.$collection) {
          this.$collection.enable = false
        }
        const res = collector()
        if (this.$collection) {
          this.$collection.enable = true
        }
        return res
      }

      // if false, do fn, return deps
      this.collect()
      collector()
      return this.collect(true)
    }

    const summarize = () => {
      const { items } = this.$collection

      const records = []
      items.forEach(([keyPath, value]) => {
        const key = isArray(keyPath) ? makeKeyPath(keyPath, true) : keyPath
        records.push({ key, value })

        if (isInstanceOf(value, Model)) {
          const deps = value.collect(true)
          const keys = deps.map((dep) => {
            const chain = makeKeyChain(dep)
            const key = makeKeyPath([...keyPath, ...chain], true)
            return key
          })
          keys.forEach((key) => {
            records.push({ key, subof: value })
          })
        }
      })

      const res = []
      const push = (key, value) => {
        if (!isFunction(value) && !res.includes(key) && key.split('.').pop() !== 'length') {
          res.push(key)
        }
      }
      let prev = null
      records.forEach((record, i) => {
        if (i === 0 && i !== records.length - 1) {
          prev = record
          return
        }

        const { key, value, subof } = record

        if (prev) {
          const { key: prevKey, value: prevValue } = prev
          if (subof && subof !== prevValue) {
            push(prevKey, prevValue)
          }
          else if (prevKey === key) {
            push(prevKey, prevValue)
          }
          else if (key.indexOf(prevKey) !== 0) {
            push(prevKey, prevValue)
          }
        }

        if (i === records.length - 1) {
          push(key, value)
        }

        prev = record
      })

      return res
    }

    // end, clear, and return deps
    if (collector === true) {
      const collection = this.$collection
      if (!collection) {
        return []
      }

      const keys = summarize()
      const { timer } = collection
      clearTimeout(timer)
      delete this.$collection
      return keys
    }

    // dont start collect again
    if (this.$collection) {
      return summarize
    }

    // start collecting
    const items = []
    const timer = setTimeout(() => this.collect(true), 32)
    define(this, '$collection', {
      value: {
        items,
        // clear automaticly to free memory
        timer,
        enable: true,
        views: collector && typeof collector === 'object' ? collector.views : false,
        fields: collector && typeof collector === 'object' && 'fields' in collector ? collector.fields : true
      },
      writable: false,
      configurable: true,
    })

    // end before timeout
    return summarize
  }

  /**
   * get a view of field by its keyPath
   * @param {*} keyPath
   */
  use(keyPath) {
    const chain = isArray(keyPath) ? [...keyPath] : makeKeyChain(keyPath)
    const key = chain.pop()

    if (!chain.length) {
      return this.$views[key]
    }

    const target = parse(this, chain)
    if (isInstanceOf(target, Model)) {
      return target.$views[key]
    }
  }

  /**
   * set field value, with `readonly`, `disabled`, `editable`, `type` checking, and formatting by `setter`
   * @param {array|string} keyPath
   * @param {*} next
   * @param {boolean} force force set, ignore `readonly` & `disabled`
   */
  set(keyPath, next, force) {
    if (!this.$store.editable) {
      return parse(this, keyPath)
    }

    const chain = isArray(keyPath) ? [...keyPath] : makeKeyChain(keyPath)
    const key = chain.shift()

    // deep set
    if (chain.length) {
      const current = this.$store.get(key)
      const cloned = clone(current)
      assign(cloned, chain, next)
      next = cloned
    }

    const def = this.$schema[key]
    if (!def) {
      return this.define(key, next)
    }

    this._check(key)

    const prev = this.$store.get(key)
    const value = force ? this.$schema.$set(key, next, this) : this.$schema.set(key, next, prev, this)
    const coming = this.$store.set(key, value)

    this.emit('set', keyPath, coming, prev)

    return coming
  }

  update(data) {
    if (!this.$store.editable) {
      return this
    }

    each(data, (value, key) => {
      // only update existing props, ignore those which are not on model
      // this shakes affects by over-given props
      if (inObject(key, this)) {
        this[key] = value
      }
    })

    return this
  }

  reset(key) {
    const value = this.$schema.getDefault(key, this)
    this.set(key, value, true)
    return this
  }

  define(key, value) {
    if (!this.$store.editable) {
      return parse(this, keyPath)
    }

    if (this.$schema[key]) {
      return this[key]
    }

    // delete this key
    if (isUndefined(value)) {
      delete this[key]
      this.$store.del(key)
      return
    }

    const def = {
      get: () => this.$store.get(key),
      configurable: true,
      enumerable: true,
    }
    if (!isFunction(value)) {
      def.set = value => this.$store.set(key, value)
    }
    Object.defineProperty(this, key, def)

    const coming = isFunction(value) ? this.$store.define(key, value) : this.$store.set(key, value)
    return coming
  }

  watch(key, fn) {
    this.$store.watch(key, fn, true, this)
    return this
  }

  unwatch(key, fn) {
    this.$store.unwatch(key, fn)
    return this
  }

  validate(key) {
    // validate all properties once together
    if (!key) {
      const errors = []

      const errs = this.onCheck() || []
      this.emit('check', errs)
      errors.push(...errs)

      const keys = Object.keys(this.$schema)
      keys.forEach((key) => {
        const errs = this.validate(key)
        errors.push(...errs)
      })

      return makeMsg(errors)
    }

    if (isArray(key)) {
      const errors = []
      key.forEach((key) => {
        const errs = this.validate(key)
        errors.push(...errs)
      })
      return makeMsg(errors)
    }

    this._check(key, true)
    const value = this._getData(key)
    const errors = this.$schema.validate(key, value, this)
    return makeMsg(errors)
  }

  validateAsync(key) {
    // validate all properties once together
    if (!key) {
      const errors = []

      const errs = this.onCheck() || []
      this.emit('check', errs)
      errors.push(...errs)

      const keys = Object.keys(this.$schema)
      return this.validateAsync(keys).then((errs) => {
        errors.push(...errs)
        return makeMsg(errors)
      })
    }

    if (isArray(key)) {
      return Promise.all(key.map(key => this.validateAsync(key))).then((groups) => {
        const errors = flatArray(groups.filter(group => !!group))
        return makeMsg(errors)
      })
    }

    this._check(key, true)
    const value = this._getData(key)
    const errors =  this.$schema.validateAsync(key, value, this)
    return makeMsg(errors)
  }

  _getData(key) {
    const value = this.$store.get(key)
    const meta = this.$schema[key]
    const view = this.collect(() => this.$views[key], true)

    // if value is changed manully, we will use changed value
    if (view && view.changed) {
      return value
    }
    // if value is not changed, we will use computed value
    else if (meta && meta.compute) {
      this.collect()
      const res = tryGet(() => meta.compute.call(this), value)
      const deps = this.collect(true)

      // clear previous watchers
      const depent = this.$$deps[key]
      if (depent && depent.deps && depent.deps.length) {
        const away = depent.deps.filter(item => !deps.includes(item))
        const { fn } = depent
        away.forEach((key) => {
          this.unwatch(key, fn)
        })
      }

      // // subscribe new watchers
      if (deps.length) {
        const fn = () => {
          const prev = res
          const value = this.$store.get(key)
          const next = tryGet(() => meta.compute.call(this), value)
          this.$store.dispatch(key, { value: next, next, prev, active: next, invalid: prev, compute: true })
        }
        deps.forEach((key) => {
          this.watch(key, fn, true)
        })
        this.$$deps[key] = { deps, fn }
      }

      return res
    }
    else {
      return value
    }
  }

  _bundleData() {
    const state = this.$store.state
    const schema = this.$schema
    const views = this.$views
    const computed = {}

    each(schema, (meta, key) => {
      if (this.collect(() => views[key] && views[key].changed, true)) {
        return
      }
      if (meta.compute) {
        const value = tryGet(() => meta.compute.call(this), state[key])
        computed[key] = value
      }
    })

    return { ...state, ...computed }
  }

  /**
   * use schema `create` option to generate and restore data
   * @param {*} json
   */
  fromJSON(json, keysPatchToThis) {
    if (!this.$store.editable) {
      return this
    }

    // prepare for sub models
    this.$children = []

    // patch state into this, so that we can get passed state in default()
    // dont be worried about reactive, the properties will be override by restore()
    const state = this._initState()
    const patches = map(state, (value, key) => {
      if (inObject(key, json)) {
        return json[key]
      }
      else {
        return value
      }
    })
    Object.assign(this, patches)

    // when new Model, onParse may throw error
    const entry = tryGet(() => this.onParse(json) || json, json)
    this.emit('parse', entry)
    const data = this.$schema.parse(entry, this)
    const next = { ...entry, ...data }
    this.restore(next, keysPatchToThis)

    // ask children to recompute computed properties
    this.$children.forEach(child => child.onRegress())
    // we do not need $children
    delete this.$children

    // reset changed, make sure changed=false after recompute
    this.$views.$changed = false

    return this
  }

  toJSON() {
    this._check()

    const data = clone(this._bundleData()) // original data
    const output = this.$schema.record(data, this)

    const state = this._combineState()
    const res = {
      ...state,
      ...output,
    }

    const result = this.onRecord(res) || res
    this.emit('record', result)
    return result
  }

  /**
   * update model by passing data, which will use schema `create` attribute to generate value
   * @param {*} data
   * @param {string[]} onlyKeys the keys outside of this array will not be set, if not set, all keys will be used
   */
  fromJSONPatch(data, onlyKeys) {
    const output = {}

    each(data, (value, key) => {
      if (onlyKeys && !inArray(key, onlyKeys)) {
        return
      }
      const coming = this.$schema.$parse(key, value, data, this)
      output[key] = coming
    })

    this.update(output)

    // reset changed, make sure changed=false after recompute
    this.collect(() => {
      const keys = Object.keys(output)
      keys.forEach((key) => {
        if (this.$views[key]) {
          this.$views[key].changed = false
        }
      })
    }, true)

    return this
  }

  toData() {
    this._check()
    const data = clone(this._bundleData()) // original data
    const output = this.$schema.export(data, this)
    const result = this.onExport(output) || output
    this.emit('export', result)
    return result
  }

  toParams(determine) {
    const data = this.toData()
    const output = flat(data, determine)
    return output
  }

  toFormData(determine) {
    const data = this.toParams(determine)
    const formdata = new FormData()
    each(data, (value, key) => {
      formdata.append(key, value)
    })
    return formdata
  }

  on(hook, fn) {
    this.$hooks.push({ hook, fn })
    return this
  }

  off(hook, fn) {
    this.$hooks.forEach((item, i) => {
      if (hook === item.hook && (isUndefined(fn) || fn === item.fn)) {
        this.$hooks.splice(i, 1)
      }
    })
    return this
  }

  emit(hook, ...args) {
    this.$hooks.forEach((item) => {
      if (hook !== item.hook) {
        return
      }
      item.fn.call(this, ...args)
    })
  }

  // when initialized
  onInit() {}
  // before restore model datas
  onSwitch(params) {
    return params
  }
  // parse data before parse, should be override
  onParse(data) {
    return data
  }
  // by toJSON
  onRecord(data) {
    return data
  }
  // serialize data after export, should be override
  onExport(data) {
    return data
  }
  onCheck() {}
  onError() {}
  onEnsure() {}
  onRestore() {}
  onRegress() {}
  onChange(key) {}

  lock() {
    this.$store.editable = true
  }

  unlock() {
    this.$store.editable = false
  }

  setParent([parent, key]) {
    if (this.$parent && this.$parent === parent && this.$keyPath && this.$keyPath[0] === key) {
      return this
    }

    define(this, '$parent', {
      value: parent,
      writable: false,
      configurable: true,
    })
    define(this, '$keyPath', {
      get: () => {
        const field = parent[key]
        const res = parent.collect(() => isArray(field) ? [key, field.indexOf(this)] : [key], true)
        return res
      },
      configurable: true,
    })

    // record sub models
    if (parent.$children) {
      parent.$children.push(this)
    }
    // recompute depend on $parent
    else {
      this.onRegress()
    }

    return this
  }

  setAttr(key) {
    return (attr, value) => {
      if (this.$views[key]) {
        this.$views[key][attr] = value
      }
    }
  }

  _ensure(key) {
    const add = (value, key) => {
      if (isInstanceOf(value, Model) && !value.$parent) {
        value.setParent([this, key])
        value.onEnsure(this)
        value.emit('ensure', this)
      }
    }
    const use = (value, key) => {
      if (isArray(value)) {
        value.forEach((item) => add(item, key))
      }
      else {
        add(value, key)
      }
    }

    const root = isArray(key) ? key[0] : key
    const value = this._getData(root)
    use(value, key)
  }

  _check(key, isValidate = false) {
    const schema = this.$schema
    const keys = key ? [key] : Object.keys(schema)

    keys.forEach((key) => {
      // dont check if disabled
      if (this.$schema.disabled(key, this)) {
        return
      }

      const def = schema[key]
      each(def, (value, attr) => {
        let str = ''
        if (attr === 'validators' && isValidate) {
          value.forEach((item) => {
            each(item, (value) => {
              str += isFunction(value) ? value + '' : ''
            })
          })
        }
        else {
          str += isFunction(value) ? value + '' : ''
        }
        if (str.indexOf('this.$parent') > -1 && !this.$parent) {
          const e = {
            key,
            attr,
            action: '_check $parent',
            message: `this.$parent is called in ${attr}, but current model has no $parent`,
          }
          this.onError(e)
          this.emit('error', e)
        }
      })
    })
  }

  static extend(next) {
    const Constructor = inherit(this)
    if (isObject(next)) {
      const metas = map(next, (value) => {
        // make it easy to extend, 'default' is required
        if (isObject(value) && inObject('default', value)) {
          return new Meta(value)
        }
        else {
          return value
        }
      })
      Object.assign(Constructor, metas)
    }
    // isConstructor should must come before isFunction
    else if (isConstructor(next, 2)) {
      mixin(Constructor, next)
    }
    else if (isFunction(next)) {
      return next(Constructor)
    }
    return Constructor
  }

  static get toEdit() {
    const Editor = edit(this)
    return Editor
  }

  toEdit(next) {
    const $this = this
    const Constructor = getConstructorOf(this)
    const _Editor = Constructor.toEdit.extend(next)
    class Editor extends _Editor {
      init(data) {
        // set parent before restore
        const { $parent, $keyPath } = $this
        if ($parent) {
          this.setParent([$parent, $keyPath[0]])
        }

        super.init(data)

        // override current metas to editable metas
        each($this.$views, (view, key) => {
          each(view, (descriptor, attr) => {
            if ('value' in descriptor) {
              const { value } = descriptor
              this.setAttr(key, attr, value)
            }
          }, true)
        })
      }
      submit() {
        return super.submit($this)
      }
    }
    const editor = new Editor(this)
    this.onEdit(editor)
    this.emit('edit', editor)
    return editor
  }

  onEdit() {}

  /**
   * use a meta definition to find out view
   * @param {Meta} Meta
   * @param {function} [fn] key => any
   * @returns {view}
   * @example
   * class Some extends Meta {
   *   ...
   * }
   * class Dog extends Meta {
   *   drop() {
   *     const some = this.reflect(Some) || {} // undefined if Some not used
   *     return some.value
   *   }
   * }
   */
  reflect(Meta, fn) {
    const keys = Object.keys(this.$schema)
    for (let i = 0, len = keys.length; i < len; i ++) {
      const key = keys[i]
      const meta = this.$schema[key]
      if (meta === Meta || (isConstructor(Meta) && isInstanceOf(meta, Meta))) {
        return isFunction(fn) ? fn.call(this, key) : this.$views[key]
      }
    }
  }

  /**
   * remember a value when using for getter in meta
   * @param {function} getter () => any
   * @param {function} [depend] (value: any) => any, value is the return value of `getter`
   * @param {function} compare (deps: any) => boolean, when `true` use memoried value, when `false` re-compute, deps is the return value of `depend`
   * @returns
   * @example
   * class SomeMeta extends Meta {
   *   static custom_value() {
   *     let count = 0
   *     return this.memo(
   *       () => this.reflect(SomeMeta).value + 12,
   *       (value) => {
   *         count ++
   *         return { value, count }
   *       },
   *       (deps) => deps.count < 10, // when count < 10, use memoried value for each time
   *     )
   *   }
   * }
   */
  memo(getter, compare, depend) {
    const memory = this.$$memories.find(item => item.getter === getter && item.compare === compare)

    if (!memory) {
      const value = getter.call(this)
      const deps = depend ? depend.call(this, value) : null
      this.$$memories.push({
        getter,
        compare,
        depend,
        value,
        deps,
      })
      return value
    }

    const prev = memory.value
    const deps = memory.deps
    const isEqual = compare.call(this, deps)

    if (isEqual) {
      return prev
    }

    const value = getter.call(this)
    memory.value = value
    memory.deps = depend ? depend.call(this, value) : null
    return value
  }
}

export default Model
