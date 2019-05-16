import { isObject, isArray, inObject, isInstanceOf, assign, parse, isEmpty, isFunction, isBoolean, flatObject, isEqual, isInheritedOf, clone, getInterface, map, each, extractObject, sortBy } from './utils.js'
import TyError, { makeError } from './error.js'
import Rule from './rule.js'
import Ty from './ty.js'

export class Model {
  constructor(data = {}) {
    const Interface = getInterface(this)
    if (!isInheritedOf(Interface, Model)) {
      throw new Error('Model should be extended.')
    }

    const schema = this.schema()
    if (!isObject(schema)) {
      throw new TyError('Model static property `schema` should be an object.')
    }

    each(schema, (def, key) => {
      if (isObject(def)) {
        if (!inObject('default', def)) {
          throw new TyError(`[Model]: '${key}' should have 'default' property.`)
        }
        if (!inObject('type', def)) {
          throw new TyError(`[Model]: '${key}' should have 'type' property.`)
        }
        if (def.type === Model || isInheritedOf(def.type, Model)) {
          throw new TyError(`[Model]: '${key}.type' should not be model, use model as a property value directly.`)
        }
      }
      else if (isArray(def)) {
        if (def.length !== 1) {
          throw new TyError(`[Model]: '${key}' should have only one item in array.`)
        }
        if (!isInstanceOf(def[0], Model)) {
          throw new TyError(`[Model]: '${key}' should be a model array.`)
        }
      }
      else if (!isInstanceOf(def, Model)) {
        throw new TyError(`[Model]: '${key}' should be a model, a model array or an model schema object.`)
      }
    })

    this.__listeners = []
    this.__updators = {}
    this.__isUpdating = null
    this.__schema = schema
    this.__isDigesting = false
    this.__isComputing = false
    this.__cache = {}

    this.data = {}
    this.init(data)
  }

  /**
   * schema definition, should be an object:
   * {
   *   property: {
   *     type: String, // required, notice: `default` and result of `compute` should match type
   *     default: '', // required
   *     required: true, // optional, default `true`
   *
   *     // computed property, will compute at each time digest end
   *     compute: function() {
   *       const a = this.get('a')
   *       const b = this.get('b')
   *       return a + '' + b
   *     },
   *
   *     validators: [ // optional
   *       {
   *         determine: (value) => Boolean, // whether to run this validator, return true to run, false to forbid
   *         validate: (value) => Boolean, // whether to pass the validate, return true to pass, false to not pass and throw error
   *         message: '', // the message of error which throw when validate not pass
   *       },
   *     ],
   *
   *     prepare: data => !!data.on_market, // optional, used by `reset`, `data` is the parameter of `reset`
   *
   *     drop: (value) => Boolean, // optional, whether to not use this property when invoke `jsondata` and `formdata`
   *     map: (value) => newValue, // optional, to override the property value when using `jsondata` and `formdata`, not work when `drop` is false
   *   },
   *   // 某个 Model
   *   key2: SomeModel,
   *   // 某个 Model 的数组
   *   key3: \[SomeModel\]
   * }
   */
  schema() {
    throw new Error('Model schema method should be override.')
  }

  init(data) {
    this.reset(data)
  }

  get(key) {
    return parse(this.data, key)
  }

  set(key, value) {
    // you should not use `set` in `compute`
    if (this.__isComputing) {
      return
    }

    assign(this.data, key, value)

    // you should use `set` in `watch`
    if (this.__isDigesting) {
      return
    }

    this.digest()
  }

  update(data = {}) {
    Object.assign(this.__updators, data)

    return new Promise((resolve, reject) => {
      clearTimeout(this.__isUpdating)
      this.__isUpdating = setTimeout(() => {
        try {
          Object.assign(this.data, this.__updators)
          this.__updators = {}
          this.digest()
          resolve(this.data)
        }
        catch (e) {
          reject(e)
        }
      })
    })
  }

  compute() {
    this.__isComputing = true

    const schema = this.__schema
    each(schema, (def, key) => {
      if (isObject(def) && isFunction(def.compute)) {
        const { compute } = def
        const value = compute.call(this)
        assign(this.data, key, value)
      }
    })

    this.__isComputing = false
  }

  digest() {
    this.__isDigesting = true

    const listeners = sortBy(this.__listeners, 'priority')

    var dirty = false
    var count = 0

    const digest = () => {
      dirty = false

      // run computing before all watchers run
      // because the properties which are watched may based on computed properties
      this.compute()

      listeners.forEach(({ key, fn }) => {
        const current = this.get(key)
        const previous = parse(this.__cache, key)

        if (!isEqual(current, previous)) {
          fn.call(this, current, previous)
          dirty = true
          const cache = clone(current)
          assign(this.__cache, key, cache)
        }
      })

      count ++
      if (count > 15) {
        throw new TyError(`[Model]: digest over 15 times.`)
      }

      if (dirty) {
        digest()
      }
    }

    digest()

    this.__isDigesting = false
  }

  watch(key, fn, priority = 10) {
    const value = this.get(key)
    const current = clone(value)

    assign(this.__cache, key, current)
    this.__listeners.push({ key, fn, priority })
  }

  unwatch(key, fn) {
    const listeners = this.__listeners
    listeners.forEach((item, i) => {
      if (key === item.key && (item.fn === fn || fn === undefined)) {
        callbacks.splice(i, 1)
      }
    })
  }

  jsondata() {
    const data = this.data
    const schema = this.__schema

    const extract = (data, schema) => {
      const output = {}

      each(schema, (def, key) => {
        const value = data[key]

        if (isObject(def)) {
          const { drop, map } = def

          if (isFunction(drop) && drop.call(this, value)) {
            return
          }
          else if (isBoolean(drop) && drop) {
            return
          }

          const v = isFunction(map) ? map.call(this, value) : value
          assign(output, key, v)
        }
        // if the value is an instance of Model, the formulated data will be used.
        // if the value is not an instance of `def`, an empty object will be returned.
        else if (isInheritedOf(def, Model)) {
          const v = isInstanceOf(value, def) ? value.jsondata() : {}
          assign(output, key, v)
        }
        else if (isArray(def)) {
          const [model] = def
          const v = isArray(value) ? value.map(item => isInstanceOf(item, model) ? item.jsondata() : {}) : []
          assign(output, key, v)
        }
      })

      return output
    }

    const output = extract(data, schema)
    return output
  }

  plaindata() {
    const data = this.jsondata()
    const output = flatObject(data)
    return output
  }

  formdata() {
    const data = this.plaindata()
    const formdata = new FormData()
    each(data, (value, key) => {
      formdata.append(key, value)
    })
    return formdata
  }


  /**
   * 对当前数据进行校验
   */
  validate() {
    const data = this.data
    const schema = this.__schema
    const keys = Object.keys(schema)

    for (let i = 0, len = keys.length; i < len; i ++) {
      const key = keys[i]
      const def = schema[key]
      const value = data[key]
      const info = { value, key, model: this, level: 'model', action: 'validate' }

      if (isObject(def)) {
        const { validators, type } = def

        let error = Ty.catch(value).by(type)
        if (error) {
          return makeError(error, info)
        }

        if (!isArray(validators)) {
          continue
        }

        for (let i = 0, len = validators.length; i < len; i ++) {
          const validator = validators[i]

          if (!isObject(validator)) {
            continue
          }

          const { determine, validate, message } = validator

          let shouldValidate = false
          if (isFunction(determine) && determine.call(this, value)) {
            shouldValidate = true
          }
          else if (isBoolean(determine) && determine) {
            shouldValidate = true
          }
          if (!shouldValidate) {
            continue
          }

          let res = validate.call(this, value)
          let info2 = { ...info, pattern: new Rule(validate.bind(this)) }
          let msg = isFunction(message) ? message.call(this, value) : message
          let error = isInstanceOf(res, Error) ? makeError(res, info2) : !res ? new TyError(msg, info2) : null
          if (error) {
            return error
          }
        }
      }
      else if (isInheritedOf(def, Model)) {
        let error = Ty.catch(value).by(def)
        if (error) {
          return makeError(error, { ...info, pattern: def })
        }

        error = value.validate()
        if (error) {
          return makeError(error, { ...info, pattern: def })
        }
      }
      else if (isArray(def)) {
        const [model] = def

        if (!isArray(value)) {
          return new TyError(`value should be an array.`, info)
        }

        for (let i = 0, len = value.length; i < len; i ++) {
          const item = value[i]
          const info = { index: i, value: item, pattern: model, model: this, level: 'model', action: 'validate' }

          let error = Ty.catch(item).by(model)
          if (error) {
            return makeError(error, info)
          }

          error = item.validate()
          if (error) {
            return makeError(error, info)
          }
        }
      }
    }
  }


  reset(data) {
    if (!isObject(data)) {
      data = {}
    }

    const schema = this.__schema
    const coming = {}

    each(schema, (def, key) => {
      const value = data[key]

      if (isObject(def)) {
        const { prepare, type } = def
        const defaultValue = def.default

        let v = null
        if (isFunction(prepare)) {
          try {
            v = prepare.call(this, data)
          }
          catch (e) {
            v = value
          }
        }
        else {
          v = value
        }

        let error = Ty.catch(v).by(type)
        if (error) {
          v = defaultValue
        }

        coming[key] = v
      }
      else if (isInheritedOf(def, Model)) {
        let v = new def(value)
        coming[key] = v
      }
      else if (isArray(def)) {
        if (!isArray(value)) {
          coming[key] = []
          return
        }

        const [model] = def
        let v = map(value, (item) => {
          let v = new model(item)
          return v
        })
        coming[key] = v
      }
    })

    this.data = coming
    this.compute()
  }

}

export default Model
