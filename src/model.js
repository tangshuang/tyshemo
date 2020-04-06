import {
  isObject,
  isBoolean,
  isEqual,
  isInheritedOf,
  isArray,
  isString,
  inArray,
  assign,
  parse,
  makeKeyChain,
  makeKeyPath,
  sortArray,
  map,
  each,
  iterate,
  clone,
  flatObject,
  getConstructorOf,
  createProxy,
  define,
} from 'ts-fns'

import _Schema from './schema.js'
import Store from './store.js'

/**
 * class SomeModel extends Model {
 *   static some = {
 *     type: String,
 *     default: '',
 *   }
 * }
 *
 * @keywords: $schema, $data, $state, $view, init,
 *            get, set, del, update,
 *            watch, unwatch, validate, restore,
 *            toJsonData, toFlatData, toFormData,
 *            onInit, onParse, onExport,
 */
export class Model {
  constructor(data = {}) {
    define(this, '$schema', this.schema())

    this.init(data)
    this.onInit()
  }

  schema() {
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

    const model = this
    class Schema extends _Schema {
      onError(err) {
        model.onError(err)
      }
    }
    const schema = new Schema(defs)
    return schema
  }

  init(data) {
    const schema = this.$schema
    const keys = Object.keys(schema)

    // create a store
    const params = {}
    keys.forEach((key) => {
      const { compute } = schema[key]
      if (compute) {
        define(params, key, {
          get: compute,
          enumerable: true,
        })
      }
      else {
        params[key] = schema.default(key)
      }
    })
    const store = new Store(params)
    define(this, '$store', store)

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
      const view = Object.defineProperties({}, {
        value: {
          get: () => this.get(key),
          set: (value) => this.set(key, value),
        },
        requried: {
          get: () => this.$schema.requried(key, this),
        },
        disabled: {
          get: () => this.$schema.disabled(key, this),
        },
        readonly: {
          get: () => this.$schema.readonly(key, this),
        },
        errors: {
          get: () => this.validate(key),
        },
        model: {
          value: this,
        },
      })
      define(views, key, {
        value: view,
        enumerable: true,
      })
    })
    define(this, '$view', views)

    // restore
    this.restore(data)
  }

  get(key) {
    const value = this.$store.get(key)
    const next = this.$schema.get(key, value, this)
    return next
  }

  set(key, next) {
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

    Object.defineProperty(this, key, {
      get: () => this.$store.get(key),
      set: value => this.$store.set(key, value),
      configurable: true,
      enumerable: true,
    })

    const coming = this.$store.set(key, value)
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

    this._check(key, true)
    const value = this.$store.get(key)
    const errors = this.$schema.validate(key, value, this)
    return errors
  }

  restore(data = {}) {
    const entry = this.onParse(data)
    const created = this.$schema.restore(entry, this)

    const coming = {}

    each(this.$schema, (def, key) => {
      const value = created[key]
      coming[key] = value
    })

    each(data, (value, key) => {
      if (coming[key]) {
        return
      }

      define(this, key, {
        get: () => this.get(key),
        set: (value) => this.set(key, value),
        enumerable: true,
        configurable: true,
      })

      coming[key] = value
    })

    each(this, (value, key) => {
      if (coming[key]) {
        return
      }

      this.$store.del(key)
      delete this[key]
    })

    // TODO make it silent
    const next = this.$store.update(coming)
    this._ensure()
    return next
  }

  toJson() {
    this._check()
    const data = this.$data
    const output = this.$schema.formulate(data, this)
    const result = this.onExport(output)
    return result
  }

  toFlatData() {
    const data = this.jsondata()
    const output = flatObject(data)
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

  _ensure(key) {
    const use = (value, key) => {
      if (isInstanceOf(value, Model)) {
        define(value, '$parent', this)
        define(value, '$parentAt', key)
      }
      else if (isArray(value)) {
        value.forEach(set)
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
      each(def, (value) => {
        if (value.validators && isValidate) {
          value.validators.forEach((item) => {
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
        action: '$parent',
      })
    }
  }
}

export default Model

function convertModelToSchemaDef(SomeModel, isList) {
  if (isList) {
    return {
      default: () => [],
      type: [SomeModel],
      validators: [
        {
          validate: ms => iterate(ms, m => m.validate() || undefined) || true,
        },
      ],
      prepare: (data, key) => isArray(data[key]) ? data[key].map(v => isObject(v) ? new SomeModel(v) : new SomeModel()) : [],
      map: ms => ms.map(m => m.jsondata()),
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
      prepare: (data, key) => isObject(data[key]) ? new SomeModel(data[key]) : new SomeModel(),
      map: m => m.jsondata(),
    }
  }
}
