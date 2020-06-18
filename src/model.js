import {
  isObject,
  isInheritedOf,
  isArray,
  map,
  each,
  flat,
  flatArray,
  getConstructorOf,
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
} from 'ts-fns'

import _Schema from './schema.js'
import _Store from './store.js'

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

    /**
     * create schema
     */
    class Schema extends _Schema {
      constructor(defs) {
        defs = map(defs, (def) => {
          /**
           * class SomeModel extends Model {
           *   static some = OtherModel
           * }
           */
          if (isInheritedOf(def, Model)) {
            return convertModelToSchemaDef(def, false)
          }

          /**
           * class SomeModel extends Model {
           *   static some = [OtherModel]
           * }
           */
          if (isArray(def) && isInheritedOf(def[0], Model)) {
            return convertModelToSchemaDef(def[0], true)
          }

          return def
        })
        super(defs)
      }
      onError(...args) {
        $this.onError(...args)
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
    this.onInit()
  }

  schema() {
    // create schema by model's static properties
    const Constructor = getConstructorOf(this)
    return { ...Constructor }
  }

  state() {
    return {}
  }

  metas() {
    return {}
  }

  init(data) {
    if (this.__init) {
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
    let metas = this.metas()

    if (isArray(metas)) {
      const metaList = metas
      metas = {}
      metaList.forEach((meta) => {
        metas[meta] = null
      })
    }

    const defaultMetas = ['required', 'disabled', 'readonly', 'hidden']
    defaultMetas.forEach((meta) => {
      metas[meta] = false
    })

    keys.forEach((key) => {
      const viewDef = {
        value: {
          get: () => this.get(key),
          set: (value) => this.set(key, value),
          enumerable: true,
        },
        errors: {
          get: () => this.$schema.$validate(key, this.$store.data[key], this)([]),
          enumerable: true,
        },
      }

      const def = this.$schema[key]
      each(metas, (fallbackRes, meta) => {
        if (!inObject(meta, def) && isNull(fallbackRes)) {
          return
        }

        viewDef[meta] = {
          get: () => this.$schema.$determine(key, meta, this)(fallbackRes),
          enumerable: true,
        }
      })

      const view = Object.defineProperties({}, viewDef)
      define(views, key, {
        value: view,
        enumerable: true,
      })
    })
    define(this, '$views', views)

    // create errors on views, so that is's easy and quick to know the model's current status
    define(this.$views, '$errors', () => {
      const errors = []
      each(this.$schema, (def, key) => {
        const errs = this.$views[key].errors
        errors.push(...errs)
      })
      return errors
    })

    // $data
    define(this, '$data', () => clone(this.$store.data))

    // watch
    keys.forEach((key) => {
      const def = this.$schema[key]
      if (!def.watch) {
        return
      }

      this.watch(key, def.watch, true)
    })

    // init data
    this.restore(data)

    // inited
    define(this, '__init', true)
  }

  get(keyPath) {
    const chain = isArray(keyPath) ? [...keyPath] : makeKeyChain(keyPath)
    const key = chain.shift()

    const value = this.$store.get(key)
    const transformed = this.$schema.get(key, value, this)

    const output = parse(transformed, chain)
    return output
  }

  set(keyPath, next) {
    if (!this.$store.editable) {
      return parse(this, keyPath)
    }

    const chain = isArray(keyPath) ? [...keyPath] : makeKeyChain(keyPath)
    const key = chain.shift()

    // deep set
    if (chain.length) {
      const current = this.$store.data[key] // original data
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
    const value = this.$schema.set(key, next, prev, this)
    const coming = this.$store.set(key, value)

    this._ensure(key)

    return coming
  }

  update(data) {
    if (!this.$store.editable) {
      return this
    }

    each(data, (value, key) => {
      this.set(key, value)
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
    this.$store.watch(key, fn, true)
    return this
  }

  unwatch(key, fn) {
    this.$store.unwatch(key, fn)
    return this
  }

  validate(key) {
    // validate all properties once together
    if (!key) {
      this._check(null, true)
      const errors = []
      each(this.$schema, (def, key) => {
        const errs = this.validate(key)
        errors.push(...errs)
      })
      return errors
    }

    if (isArray(key)) {
      const errors = []
      key.forEach((key) => {
        const errs = this.validate(key)
        errors.push(...errs)
      })
      return errors
    }

    this._check(key, true)
    const value = this.$store.get(key)
    const errors = this.$schema.validate(key, value, this)
    return errors
  }

  /**
   * reset and cover all data, original model will be clear first, and will use new data to cover the whole model.
   * notice that, properties which are in original model be not in schema may be removed.
   * @param {*} data
   */
  restore(data = {}) {
    if (!this.$store.editable) {
      return this
    }

    const schema = this.$schema
    const state = this.state()
    const params = {}

    // those on schema
    each(schema, (def, key) => {
      const { compute } = def
      if (compute) {
        define(params, key, {
          get: compute,
          enumerable: true,
        })
      }
      else if (inObject(key, data)) {
        const value = data[key]
        params[key] = this.$schema.assign(key, value, this)
      }
      else {
        params[key] = schema.$default(key)()
      }
    })

    // patch state
    each(state, (value, key) => {
      if (inObject(key, params)) {
        return
      }

      // define state here so that we can invoke this.state() only once when initialize
      define(this, key, {
        get: () => this.get(key),
        set: (value) => this.set(key, value),
        enumerable: true,
        configurable: true,
      })

      // use data property if exist, use data property directly
      if (inObject(key, data)) {
        params[key] = data[key]
        return
      }

      const descriptor = Object.getOwnPropertyDescriptor(state, key)
      if (descriptor && (descriptor.get || descriptor.set)) {
        define(params, key, {
          get: descriptor.get,
          set: descriptor.set,
          enumerable: true,
        })
      }
      else {
        params[key] = value
      }
    })

    // delete the outdate properties
    each(this.$store.data, (value, key) => {
      if (key in params) {
        return
      }

      this.$store.del(key)
      delete this[key]
    })


    this.onSwitch(params)

    // reset into store
    this.$store.silent = true
    this.$store.init(params)
    this.$store.silent = false

    this._ensure()
    return this
  }

  /**
   * use schema `create` option to generate and restore data
   * @param {*} json
   */
  fromJSON(json) {
    if (!this.$store.editable) {
      return this
    }

    const entry = this.onParse(json)
    const schema = this.$schema
    const data = schema.parse(entry, this)
    this.restore(data)
    return this
  }

  toJSON() {
    this._check()
    const data = this.$store.data // original data
    const output = this.$schema.export(data, this)
    const result = this.onExport(output)
    return result
  }

  toParams(determine) {
    const data = this.toJSON()
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

  // serialize data after export, should be override
  onExport(data) {
    return data
  }

  onError(e) {
    console.error(e)
  }

  lock() {
    this.$store.editable = true
  }

  unlock() {
    this.$store.editable = false
  }

  _ensure(key) {
    const use = (value, key) => {
      if (isInstanceOf(value, Model)) {
        define(value, '$parent', this)
        define(value, '$keyPath', [key])
      }
      else if (isArray(value)) {
        value.forEach((item, i) => {
          if (isInstanceOf(item, Model)) {
            define(item, '$parent', this)
            define(item, '$keyPath', [key, i])
          }
        })
      }
    }
    const set = data => each(data, use)

    if (key) {
      const value = this.$store.data[key]
      use(value, key)
    }
    else {
      set(this.$store.data)
    }
  }

  _check(key, isValidate = false) {
    const schema = this.$schema
    const keys = key ? [key] : Object.keys(schema)

    let str = ''
    keys.forEach((key) => {
      const def = schema[key]
      each(def, (value, key) => {
        if (key === 'validators' && isValidate) {
          value.forEach((item) => {
            each(item, (value) => {
              str += isFunction(value) ? value + '' : ''
            })
          })
        }
        else {
          str += isFunction(value) ? value + '' : ''
        }
      })
    })

    if (str.indexOf('this.$parent') > -1 && !this.$parent) {
      this.onError({
        key,
        action: '$parent',
      })
    }
  }
}

export default Model

// ---------------------------------------------------

function convertModelToSchemaDef(SomeModel, isList) {
  const create = (data, nullable) => {
    return isInstanceOf(data, SomeModel) ? data : isObject(data) ? new SomeModel(data) : nullable ? null : new SomeModel()
  }
  if (isList) {
    return {
      default: () => [],
      type: [SomeModel],
      validators: [
        {
          validate: ms => flatArray(map(ms, m => m.validate())),
        },
      ],
      create: (data, key) => isArray(data[key]) ? data[key].map(v => create(v, true)).filter(item => !!item) : [],
      map: ms => ms.map(m => m.toJSON()),
      setter: v => isArray(v) ? v.map(v => create(v, true)).filter(item => !!item) : [],
    }
  }
  else {
    return {
      default: () => new SomeModel(),
      type: SomeModel,
      validators: [
        {
          validate: m => m.validate(),
        },
      ],
      create: (data, key) => create(data[key]),
      map: m => m.toJSON(),
      setter: v => create(v),
    }
  }
}
