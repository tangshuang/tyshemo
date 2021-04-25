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
  isEqual,
  isConstructor,
  mixin,
  makeKeyPath,
} from 'ts-fns'

import _Schema from './schema.js'
import _Store from './store.js'
import { ofChain, tryGet, makeMsg, isAsyncRef } from './shared/utils.js'
import { edit } from './shared/edit.js'
import Meta from './meta.js'
import Factory from './factory.js'

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
  from: null,
  to: null,
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
  constructor(data = {}, keyPath, parent) {
    const $this = this

    /**
     * create schema
     */
    class Schema extends _Schema {
      constructor(metas) {
        const defs = map(metas, (def) => {
          if (!def) {
            return
          }

          /**
           * class SomeModel extends Model {
           *   static some = OtherModel
           * }
           */
          if (isInheritedOf(def, Model)) {
            return Factory.getMeta(def)
          }

          /**
           * class SomeModel extends Model {
           *   static some = [OtherModel, AnyModel]
           * }
           */
          if (isArray(def) && !def.some(def => !isInheritedOf(def, Model))) {
            return Factory.getMeta(def)
          }

          return def
        })
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
      schema = map(schema, (value) => {
        if (!value) {
          return
        }
        if (isInstanceOf(value, Meta) || isInheritedOf(value, Meta)) {
          return value
        }
        // support use a object which contains a 'default' property to be a Meta
        if (isObject(value) && inObject('default', value)) {
          return new Meta(value)
        }
        // default, support Model
        return value
      })
      schema = new Schema(schema)
    }
    define(this, '$schema', schema)
    define(this, '$hooks', [])
    define(this, '$$attrs', { ...DEFAULT_ATTRIBUTES, ...this.attrs() })
    define(this, '$$state', this.state())

    // use passed parent
    if (keyPath && isInstanceOf(parent, Model)) {
      this.setParent(isArray(keyPath) ? keyPath : [keyPath], parent)
    }

    /**
     * create store
     */
    class Store extends _Store {
      dispatch(keyPath, next, prev, force) {
        const notify = super.dispatch(keyPath, next, prev, force)
        // propagation
        if ($this.$parent && $this.$keyPath) {
          $this.$parent.$store.dispatch([...$this.$keyPath, ...keyPath], next, prev, true)
        }
        return notify
      }
    }
    const store = new Store()
    define(this, '$store', store)


    define(this, '$root', () => {
      let parent = this.$parent

      if (!parent) {
        return this
      }

      while (parent.$parent) {
        parent = parent.$parent
      }

      return parent
    })

    define(this, '$absKeyPath', () => {
      let parent = this.$parent
      let keyPath = this.$keyPath
      const path = []

      if (!parent) {
        return path
      }

      while (parent) {
        path.unshift(...keyPath)
        parent = parent.$parent
      }

      return path
    })

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
          view[attr] = current
          // async set attr value
          attach(key, attr).then((next) => {
            if (next === view[attr]) {
              return
            }
            view[attr] = next
            this.$store.forceDispatch(key, attr, next)
          })
        }
        // use as a getter
        else if (isFunction(value)) {
          return value.call(this, key)
        }
        // patch to view directly
        else {
          view[attr] = value
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
          get: () => this.$schema.format(key, getData(), this) + '',
          enumerable: true,
        },
        state: {
          get: () => {
            const state = meta.state ? meta.state.call(null) : {}
            const keys = Object.keys(state)
            const proxy = new Proxy(state, {
              get: (target, key) => inArray(key, keys) ? this.get(key) : undefined,
              set: (target, key, value) => inArray(key, keys) && this.set(key, value),
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
        value: view,
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
      get: () => keys.some((key) => this.$views[key].changed),
      set: (status) => keys.forEach(key => this.$views[key].changed = !!status)
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
      const { key } = e
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
      this.$views[root].changed = true

      this.onChange(root)
    }, true)
  }

  _initData(data) {
    this.$initing = true
    this.fromJSON(data)
    delete this.$initing
  }

  _combineState() {
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
      const metaState = meta.state.call(null)
      combine(metaState)
    })
    return output
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
    const state = this._combineState()
    const params = {}
    const input = {}

    const ensure = (value, keys) => {
      if (isArray(value)) {
        value.forEach((item, i) => ensure(item, [...keys, i]))
        return
      }
      if (!isInstanceOf(value, Model)) {
        return
      }
      value.setParent(keys, this)
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
    each(schema, (def, key) => {
      if (inObject(key, data)) {
        const value = data[key]
        params[key] = value
        ensure(value, [key])
      }
      else {
        // notice here, we call this in default(), we can get passed state properties
        const value = schema.getDefault(key, this)

        // default can be an AsyncGetter, so that we can set default value asyncly
        if (isAsyncRef(value)) {
          const { current, attach } = value
          params[key] = current
          ensure(current, [key])

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
          ensure(value, [key])
        }
      }
    })

    // delete the outdate properties
    each(this.$store.state, (_, key) => {
      if (inObject(key, params)) {
        return
      }

      if (key.indexOf('$') === 0 || key.indexOf('_') === 0) {
        return
      }

      this.$store.del(key)
      delete this[key]
    }, true)

    // reset into store
    const initParams = this.emit('switch', this.onSwitch(params) || params) || params
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
    if (!isInstanceOf(target, Model)) {
      throw new Error(`${makeKeyPath(chain)} is not a model`)
    }

    return target.$views[key]
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

    this.emit('set', { key: keyPath, next: coming, prev })

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

      const errs = this.emit('check', this.onCheck()) || []
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

      const errs = this.emit('check', this.onCheck()) || []
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
    const view = this.$views[key]

    // if value is changed manully, we will use changed value
    if (view && view.changed) {
      return value
    }
    // if value is not changed, we will use computed value
    else if (meta && meta.compute) {
      return tryGet(() => meta.compute.call(this), value)
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
      if (views[key] && views[key].changed) {
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
    const state = this._combineState()
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
    const entry = tryGet(() => this.emit('parse', this.onParse(json) || json) || json, json)
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
    const result = this.emit('record', this.onRecord(output) || output) || output
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
    const keys = Object.keys(output)
    keys.forEach((key) => {
      if (this.$views[key]) {
        this.$views[key].changed = false
      }
    })

    return this
  }

  toData() {
    this._check()
    const data = clone(this._bundleData()) // original data
    const output = this.$schema.export(data, this)
    const result = this.emit('export', this.onExport(output) || output) || output
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

  emit(hook, arg) {
    let res = arg
    this.$hooks.forEach((item) => {
      if (hook !== item.hook) {
        return
      }
      const { fn } = item
      res = fn.call(this, res)
    })
    return res
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

  /**
   * @param {array} keyPath
   * @param {Model} parent
   */
  setParent(keyPath, parent) {
    if (this.$parent && this.$parent === parent && this.$keyPath && isEqual(this.$keyPath, keyPath)) {
      return this
    }

    define(this, '$parent', {
      value: parent,
      writable: false,
      configurable: true,
    })
    define(this, '$keyPath', {
      value: keyPath,
      writable: false,
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
    const add = (value, keys) => {
      if (isInstanceOf(value, Model) && !value.$parent) {
        value.setParent(keys, this)
        value.onEnsure(this)
        value.emit('ensure', this)
      }
    }
    const use = (value, key) => {
      if (isArray(value)) {
        value.forEach((item, i) => add(item, [key, i]))
      }
      else {
        add(value, [key])
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
          define(this, '$parent', {
            value: $parent,
            writable: false,
            configurable: true,
          })
          define(this, '$keyPath', {
            value: $keyPath,
            writable: false,
            configurable: true,
          })
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


}

export default Model
