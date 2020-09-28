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
  isEmpty,
  getConstructorOf,
  isEqual,
  isConstructor,
  mixin,
} from 'ts-fns'

import _Schema from './schema.js'
import _Store, { COMPUTED_FAILURE } from './store.js'
import { ofChain, tryGet, makeMsg } from './shared/utils.js'
import { edit } from './shared/edit.js'

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
  constructor(data = {}) {
    const $this = this

    const convertModelToSchemaDef = (def) => {
      return Model.enter(def)
    }

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
            return convertModelToSchemaDef(def)
          }

          /**
           * class SomeModel extends Model {
           *   static some = [OtherModel, AnyModel]
           * }
           */
          if (isArray(def) && !def.some(def => !isInheritedOf(def, Model))) {
            return convertModelToSchemaDef(def)
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
      }
    }
    // create schema
    let schema = this.schema(Schema)
    // support schema instance or object
    if (!isInstanceOf(schema, _Schema)) {
      schema = new Schema(schema)
    }
    define(this, '$schema', schema)

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
    // default attributes on meta, `null` to disable patching to view
    return {
      default: null,
      compute: null,
      type: null,
      message: null,
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
      required: false,
      hidden: false,
      watch: null,
      catch: null,
      state: null,
    }
  }

  init(data = {}) {
    if (this.$ready) {
      return
    }

    const schema = this.$schema
    const keys = Object.keys(schema)

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
      const attrs = this.attrs()
      // define a view
      const view = {
        changed: false, // whether the field has changed
      }
      // use defineProperties to define view properties
      const viewDef = {}

      each(attrs, (value, attr) => {
        if (isNull(value)) {
          return
        }
        viewDef[attr] = {
          get: () => this.$schema.$decide(key, attr, this)(value),
          enumerable: true,
        }
      })

      each(meta, (descriptor, key) => {
        if (inObject(key, attrs)) {
          return
        }
        const { value, get, set } = descriptor
        if (get || set) {
          viewDef[key] = {
            get: get && get.bind(this),
            set: set && set.bind(this),
            enumerable: true,
            configurable: true,
          }
        }
        else {
          // patch to view directly
          view[key] = value
        }
      }, true)

      // unwritable mandatory view properties
      Object.assign(viewDef, {
        value: {
          get: () => this.get(key),
          set: (value) => this.set(key, value),
          enumerable: true,
        },
        errors: {
          get: () => makeMsg(this.$schema.$validate(key, this.$store.get(key), this)([])),
          enumerable: true,
        },
        data: {
          get: () => this.$store.get(key),
          enumerable: true,
        },
        text: {
          get: () => this.$schema.format(key, this.$store.get(key), this) + '',
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

    keys.forEach((key) => {
      const def = this.$schema[key]
      // watch
      if (def.watch) {
        this.watch(key, def.watch, true)
      }
    })

    // init data
    this._initData(data)

    // bind recompute
    define(this, '$recomputeByParent', {
      value: () => this.recompute(['$parent']),
    })

    // ensure top properties
    this.watch('*', ({ key }) => {
      this._ensure(key)
    })
  }

  _initData(data) {
    this.$init = true
    this.fromJSON(data)
    delete this.$init
  }

  _combineState() {
    const output = {}
    const state = this.state.call(null)
    const combine = (state) => {
      each(state, (descriptor, key) => {
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
   */
  restore(data) {
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
      value.setParent(this, keys)
    }
    const record = (key) => {
      if (inObject(key, data)) {
        const value = data[key]
        input[key] = value
        ensure(value, key)
      }
    }

    // those on schema
    each(schema, (def, key) => {
      const { compute } = def
      if (compute) {
        define(params, key, {
          enumerable: true,
          get: () => compute.call(this),
        })
        // may restore computed property
        record(key)
      }
      else if (inObject(key, data)) {
        const value = data[key]
        params[key] = value
        ensure(value, [key])
      }
      else {
        const value = schema.getDefault(key)
        params[key] = value
        ensure(value, [key])
      }
    })

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
    const initParams = this.onSwitch(params) || params
    this.$store.init(initParams)

    // patch those which are not in store but on `this`
    each(data, (value, key) => {
      if (!inObject(key, params) && inObject(key, this)) {
        this[key] = value
      }
    })

    // reset `input` to store
    if (!isEmpty(input)) {
      each(input, (value, key) => {
        // only reset those which are computing failure
        if (this.$store.get(key) === COMPUTED_FAILURE) {
          this.$store.set(key, value, true)
        }
      })
    }

    this.onRestore()

    return this
  }

  /**
   * get field value, with formatting by `getter`
   * @param {array|string} keyPath
   */
  get(keyPath) {
    const chain = isArray(keyPath) ? [...keyPath] : makeKeyChain(keyPath)
    const key = chain.shift()

    const value = this.$store.get(key)
    const transformed = this.$schema.get(key, value, this)

    const output = parse(transformed, chain)
    return output
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

    this.$views[key].changed = true

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
    const value = this.$store.get(key)
    const errors = this.$schema.validate(key, value, this)
    return makeMsg(errors)
  }

  validateAsync(key) {
    // validate all properties once together
    if (!key) {
      const errors = []

      const errs = this.onCheck() || []
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
    const value = this.$store.get(key)
    const errors =  this.$schema.validateAsync(key, value, this)
    return makeMsg(errors)
  }

  /**
   * use schema `create` option to generate and restore data
   * @param {*} json
   */
  fromJSON(json) {
    if (!this.$store.editable) {
      return this
    }

    // prepare for sub models
    this.$children = []

    // when new Model, onParse may throw error
    const entry = tryGet(() => this.onParse(json), json)
    const data = this.$schema.parse(entry, this)
    const next = { ...json, ...data }
    this.restore(next)

    // ask children to recompute computed properties
    this.$children.forEach(child => child.recompute(['$parent'], true))
    // we do not need $children
    delete this.$children

    return this
  }

  toJSON() {
    this._check()
    const data = clone(this.$store.state) // original data
    const output = this.$schema.record(data, this)
    const result = this.onRecord(output)
    return result
  }

  toData() {
    this._check()
    const data = clone(this.$store.state) // original data
    const output = this.$schema.export(data, this)
    const result = this.onExport(output)
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

  lock() {
    this.$store.editable = true
  }

  unlock() {
    this.$store.editable = false
  }

  setParent(parent, keyPath) {
    if (this.$parent && this.$parent === parent && this.$keyPath && isEqual(this.$keyPath, keyPath)) {
      return this
    }

    // unbind previous parent
    if (this.$parent) {
      this.$parent.unwatch('*', this.$recomputeByParent)
    }
    // recompute when parent change
    parent.watch('*', this.$recomputeByParent, true)

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
      this.recompute(['$parent'])
    }

    return this
  }

  recompute(matchers, silent) {
    each(this.$schema, (meta, key) => {
      const { compute } = meta
      if (!compute) {
        return
      }
      if (matchers && !matchers.some(matcher => (compute + '').indexOf(matcher) > -1)) {
        return
      }
      this.$store._refine(key, silent)
    })
  }

  _ensure(key) {
    const add = (value, keys) => {
      if (isInstanceOf(value, Model) && !value.$parent) {
        value.setParent(this, keys)
        value.onEnsure(this)
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
    const value = this.$store.get(root)
    use(value, key)
  }

  _check(key, isValidate = false) {
    const schema = this.$schema
    const keys = key ? [key] : Object.keys(schema)

    keys.forEach((key) => {
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
          this.onError({
            key,
            attr,
            action: '_check $parent',
            message: `this.$parent is called in ${attr}, but current model has no $parent`,
          })
        }
      })
    })
  }

  static extend(next) {
    const Constructor = inherit(this)
    if (isObject(next)) {
      Object.assign(Constructor, next)
    }
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
      onInit() {
        super.onInit()
        const { $parent, $keyPath } = $this
        if ($parent) {
          this.setParent($parent, $keyPath)
        }
      }
      submit() {
        return super.submit($this)
      }
    }
    return new Editor(this)
  }

  static enter(Model, fn) {
    if (isArray(Model)) {
      const SubModel = Model[0]
      const create = (items) => items.map((item) => {
        return isInstanceOf(item, SubModel) ? item
          : isObject(item) ? new SubModel(item)
          : null
      }).filter(item => !!item)
      return {
        default: () => [],
        type: Model,
        validators: [
          {
            validate: ms => flatArray(map(ms, m => m.validate())),
          },
        ],
        create: (value, key, data) => {
          const next = fn ? fn(value, key, data) || value : value
          return isArray(next) ? create(next) : []
        },
        save: (ms, key) => ({ [key]: ms.map(m => m.toJSON()) }),
        map: ms => ms.map(m => m.toData()),
        setter: value => isArray(value) ? create(value) : [],
      }
    }
    else {
      const create = (value) => {
        return isInstanceOf(value, Model) ? value
          : isObject(value) ? new Model(value)
          : new Model()
      }
      return {
        default: () => create(),
        type: Model,
        validators: [
          {
            validate: m => m.validate(),
          },
        ],
        create: (value, key, data) => {
          const next = fn ? fn(value, key, data) || value : value
          return create(next)
        },
        save: (m, key) => ({ [key]: m.toJSON() }),
        map: m => m.toData(),
        setter: value => create(value),
      }
    }
  }
}

export default Model
