import { each, isObject, map, iterate, isArray, isFunction, isBoolean, isEqual, getConstructor, isInstanceOf, inObject } from './utils.js'
import TyError from './ty-error.js'
import Ty from './ty.js'
import { ifexist } from './rules.js'

export class Schema {

  /**
   * schema definition, should be an object:
   * {
   *   property: {
   *     default: '', // required
   *
   *     type: String, // required, notice: `default` and result of `compute` should match type
   *     rule: ifexist, // optional, which rule to use, only `ifexist` `instance` and `equal` allowed
   *     message: '', // the message when type checking fail
   *     validators: [ // optional
   *       {
   *         determine: (value) => Boolean, // whether to run this validator, return true to run, false to forbid
   *         validate: (value) => Boolean, // whether to pass the validate, return true to pass, false to not pass and throw error
   *         message: '', // the message of error which throw when validate not pass
   *       },
   *     ],
   *     catch: (error) => {}, // when an error occurs caused by this property, what to do with the error, always by using `ensure`
   *
   *     // computed property, will compute at each time digest end
   *     compute: function() {
   *       const a = this.get('a')
   *       const b = this.get('b')
   *       return a + '' + b
   *     },
   *
   *     prepare: ({ value, key, data }) => !!data.on_market, // optional, used by `rebuild`, `data` is the parameter of `rebuild`
   *
   *     drop: ({ value, key, data }) => Boolean, // optional, whether to not use this property when invoke `jsondata` and `formdata`
   *     map: ({ value, key, data }) => newValue, // optional, to override the property value when using `jsondata` and `formdata`, not work when `drop` is false
   *
   *     getter: (value) => newValue, // format this property value when get
   *     setter: (value) => value, // format this property value when set
   *   },
   * }
   */

  constructor(definition) {
    each(definition, (def, key) => {
      if (!isObject(def)) {
        throw new Error(`[Schema]: definition '${key}' should be an object.`)
      }
    })

    this.definition = definition
  }

  has(key) {
    return !!this.definition[key]
  }

  get(key, value, context) {
    const definition = this.definition
    const def = definition[key]

    if (!def) {
      return value
    }

    const { getter } = def
    const next = isFunction(getter) ? getter.call(context, value) : value

    return next
  }

  set(key, value, context) {
    const definition = this.definition
    const def = definition[key]

    if (!def) {
      return value
    }

    const { setter } = def
    const next = isFunction(setter) ? setter.call(context, value) : value

    return next
  }

  /**
   * validate type and vaidators
   * @param {*} key
   * @param {*} value
   * @param {*} context
   */
  validate(key, value, context) {
    const definition = this.definition

    // validate the whole data
    if (isObject(key)) {
      context = value
      value = key

      const tyerr = new TyError()
      const data = value
      each(definition, (def, key) => {
        const { rule, type } = def
        const value = data[key]

        if (isFunction(rule)) {
          const TyRule = rule(type)
          const error = TyRule.validate(value, key, data)
          if (error) {
            tyerr.add(error)
          }
        }
        else {
          const error = this.validate(key, value, context)
          if (error) {
            tyerr.add(error)
          }
        }
      })

      tyerr.commit()
      return tyerr.error()
    }

    // validate single key
    const def = definition[key]
    const { type, rule, validators, message } = def
    const handle = def.catch

    const transform = (error, message, key, value, context) => {
      let msg = error.message
      if (message && isFunction(message)) {
        msg = message.call(context, value, key, error)
        error = new Error(msg)
      }
      else if (message) {
        msg = message
        error = new Error(msg)
      }
      return error
    }

    if (!def) {
      return new Error(`[Schema]: '${key}' is not defined in schema.`)
    }

    let error = Ty.catch(value).by(type)

    // ignore ifexist when have no value
    if (error && rule === ifexist && value === undefined) {
      error = null
    }

    if (error) {
      error = transform(error, message, key, value, context)
    }
    // validators
    else if (isArray(validators)) {
      error = iterate(validators, (validator) => {
        const { validate, determine, message } = validator
        if (isFunction(determine) && !determine.call(context, value, key)) {
          return
        }
        if (isBoolean(determine) && !determine) {
          return
        }

        const res = validate.call(context, value, key)
        if (isBoolean(res) && res) {
          return
        }

        let msg = message

        if (isInstanceOf(res, Error)) {
          msg = res.message
        }

        if (isFunction(message)) {
          msg = message.call(context, value, key, error)
        }

        const error = new Error(msg)
        return error
      })
    }

    if (error) {
      if (isFunction(handle)) {
        handle.call(context, error, key, value)
      }
      return error
    }

    return null
  }

  /**
   * make sure very property is fit type and validators
   * @param {*} key
   * @param {*} value
   * @param {*} context
   */
  ensure(key, value, context) {
    const definition = this.definition

    if (isObject(key)) {
      context = value
      value = key

      const data = value
      const output = map(definition, (def, key) => {
        const defaultValue = def.default
        const handle = def.catch
        const { rule, type } = def
        const value = data[key]

        if (isFunction(rule)) {
          const TyRule = rule(type)
          const error = TyRule.validate(value, key, data)
          if (error) {
            if (isFunction(handle)) {
              handle.call(context, error, key, value)
            }
            return defaultValue
          }
          else {
            return value
          }
        }

        try {
          const res = this.ensure(key, value, context)
          return res
        }
        catch (e) {
          if (isFunction(handle)) {
            handle.call(context, error, key, value)
          }
          return defaultValue
        }
      })

      return output
    }

    const def = definition[key]

    if (!def) {
      throw new Error(`[Schema]: '${key}' is not existing in schema.`)
    }

    const error = this.validate(key, value, context)
    if (error) {
      if (isFunction(handle)) {
        handle.call(context, error, key, value)
      }
      return defaultValue
    }

    return value
  }

  /**
   * get final computed properties.
   * @param {*} data
   * @param {*} context
   * @param {function} [fn]
   */
  digest(data, context, fn) {
    const definition = this.definition
    const getComputedValue = (def) => {
      const { compute, key } = def
      const handle = def.catch
      const defaultValue = def.default
      try {
        const res = compute.call(context)
        return res
      }
      catch (error) {
        if (isFunction(handle)) {
          handle.call(context, error, key)
        }
        return defaultValue
      }
    }
    const output = { ...data }

    var dirty = false
    var count = 0

    const digest = () => {
      dirty = false

      each(definition, (def, key) => {
        const { compute } = def
        if (!isFunction(compute)) {
          return
        }

        const computed = getComputedValue(def)
        const current = output[key]
        if (!isEqual(current, computed)) {
          dirty = true
          output[key] = computed
          if (isFunction(fn)) {
            fn.call(context, key, computed)
          }
        }
      })

      count ++
      if (count > 15) {
        throw new Error(`[Schema]: digest over 15 times.`)
      }

      if (dirty) {
        digest()
      }
    }

    digest()

    return output
  }

  /**
   * rebuild data by passed data
   * @param {*} data
   * @param {*} context
   */
  rebuild(data, context) {
    const definition = this.definition

    if (!isObject(data)) {
      throw new Error(`[Schema]: data should be an object when rebuild.`)
    }

    const output = map(definition, (def, key) => {
      const value = data[key]
      const { prepare } = def
      const handle = def.catch
      const defaultValue = def.default

      if (isFunction(prepare)) {
        try {
          const coming = prepare.call(context, { value, key, data })
          return coming
        }
        catch (error) {
          if (isFunction(handle)) {
            handle.call(context, error, key, value)
          }
          return defaultValue
        }
      }
      else {
        return value
      }
    })
    return output
  }

  /**
   * formulate to get output data
   * @param {*} data
   * @param {*} context
   */
  formulate(data, context) {
    const definition = this.definition

    if (!isObject(data)) {
      throw new Error(`[Schema]: data should be an object when rebuild.`)
    }

    const output = map(definition, (def, key) => {
      const value = data[key]
      const { drop, map } = def
      const handle = def.catch

      if (isFunction(drop) && drop.call(context, { value, key, data })) {
        return
      }
      if (isBoolean(drop) && drop) {
        return
      }

      if (isFunction(map)) {
        try {
          const res = map.call(context, { value, key, data })
          return res
        }
        catch (error) {
          if (isFunction(handle)) {
            handle.call(context, error, key, value)
          }
          return def.default
        }
      }

      return value
    })

    return output
  }

  extend(fields) {
    const current = this.definition
    const next = Object.assign({}, current, fields)
    const Constructor = getConstructor(this)
    const schema = new Constructor(next)
    return schema
  }
  extract(fields) {
    const current = this.definition
    const keys = Object.keys(fields)
    const next = {}

    keys.forEach((key) => {
      if (fields[key] === true) {
        next[key] = current[key]
      }
    })

    const Constructor = getConstructor(this)
    const schema = new Constructor(next)
    return schema
  }
}
export default Schema
