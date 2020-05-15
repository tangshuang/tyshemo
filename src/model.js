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
  extend,
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
 *            totoJson, toParams, toFormData,
 *            onInit, onParse, onExport,
 */
export class Model {
  constructor(data = {}) {

    // create schema
    class Schema extends _Schema {}
    Schema.prototype.onError = this.onError.bind(this)
    const schema = this.schema(Schema)
    define(this, '$schema', schema)

    // create store
    const $this = this
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

  schema(Schema) {
    const Constructor = getConstructorOf(this)
    // create schema by model's static properties
    const defs = map(Constructor, (def) => {
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

    const schema = new Schema(defs)
    return schema
  }

  init(data) {
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
      const { extra = {} } = this.$schema[key]
      const view = Object.defineProperties({}, {
        // patch extra
        ...map(extra, (value, key) => {
          return {
            get: () => {
              const descriptor = Object.getOwnPropertyDescriptor(extra, key)
              // support getter
              if (descriptor && descriptor.get) {
                const value = descriptor.get.call(this)
                return value
              }
              else if (descriptor && descriptor.value) {
                return descriptor.value
              }
              else {
                return value
              }
            },
          }
        }),
        value: {
          get: () => this.get(key),
          set: (value) => this.set(key, value),
        },
        required: {
          get: () => this.$schema.required(key, this),
        },
        disabled: {
          get: () => this.$schema.disabled(key, this),
        },
        readonly: {
          get: () => this.$schema.readonly(key, this),
        },
        hidden: {
          get: () => this.$schema.hidden(key, this),
        },
        errors: {
          get: () => this.$schema.$validate(key, this.$store.data[key], this)([]),
        },
      })
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

    // restore
    this.restore(data, false)
  }

  get(keyPath) {
    const chain = isArray(keyPath) ? keyPath : makeKeyChain(keyPath)
    const key = chain.shift()

    const value = this.$store.get(key)
    const transformed = this.$schema.get(key, value, this)

    const output = parse(transformed, chain)
    return output
  }

  set(keyPath, next) {
    const chain = isArray(keyPath) ? keyPath : makeKeyChain(keyPath)
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
    each(data, (value, key) => {
      this.set(key, value)
    })
    return this
  }

  define(key, value) {
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
   * @param {boolean} displace whether to use `create` option to create data from api data, default 'true'
   */
  restore(data = {}, shouldCreate = true) {
    const entry = this.onParse(data)
    const schema = this.$schema
    const created = schema.$restore(entry, this)(shouldCreate)

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
      else {
        const value = created[key]
        params[key] = value
      }
    })

    // those on data but not on schema
    // these should be patched on model, because we sometimes need them as original data
    each(data, (value, key) => {
      if (key in params) {
        return
      }

      define(this, key, {
        get: () => this.get(key),
        set: (value) => this.set(key, value),
        enumerable: true,
        configurable: true,
      })

      params[key] = value
    })

    // delete the outdate properties
    each(this.$store.data, (value, key) => {
      if (params[key]) {
        return
      }

      this.$store.del(key)
      delete this[key]
    })

    // reset into store
    this.$store.init(params)

    this._ensure()
    return this
  }

  toJson() {
    this._check()
    const data = this.$store.data // original data
    const output = this.$schema.formulate(data, this)
    const result = this.onExport(output)
    return result
  }

  toParams() {
    const data = this.toJson()
    const output = flat(data)
    return output
  }

  toFormData() {
    const data = this.plaindata()
    const formdata = new FormData()
    each(data, (value, key) => {
      formdata.append(key, value)
    })
    return formdata
  }

  // when initialized
  onInit() {}

  // parse data before restore, should be override
  onParse(data) {
    return data
  }

  // serialize data after formulate, should be override
  onExport(data) {
    return data
  }

  onError(e) {
    console.error(e)
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
            define(value, '$parent', this)
            define(value, '$keyPath', [key, i])
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
    const Constructor = getConstructorOf(this)
    const keys = key ? [key] : Object.keys(Constructor)

    let str = ''
    keys.forEach((key) => {
      const def = Constructor[key]
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

  static extend(schema = {}, replace = false) {
    const NewModel = extend(this)

    each(schema, (def, key) => {
      // replace key schema
      if (replace) {
        NewModel[key] = def
        return
      }

      const oldDef = NewModel[key] || {}

      // deep merge, not assign, validators override
      const newDef = merge(oldDef, def, false)
      NewModel[key] = newDef
    })

    return NewModel
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
      map: ms => ms.map(m => m.toJson()),
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
      map: m => m.toJson(),
      setter: v => create(v),
    }
  }
}
