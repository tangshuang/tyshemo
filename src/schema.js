import { each, isObject, map, iterate, isArray, isFunction, isBoolean, inObject, isEqual, getInterface } from './utils.js'
import TyError, { makeError } from './error.js'
import Ty from './ty.js'

export class Schema {

  /**
   * schema definition, should be an object:
   * {
   *   property: {
   *     default: '', // required
   *     type: String, // required, notice: `default` and result of `compute` should match type
   *     required: true, // optional, whether the property can be not existing, set to be `false` if you want it can be ignored
   *
   *     validators: [ // optional
   *       {
   *         determine: (value) => Boolean, // whether to run this validator, return true to run, false to forbid
   *         validate: (value) => Boolean, // whether to pass the validate, return true to pass, false to not pass and throw error
   *         message: '', // the message of error which throw when validate not pass
   *       },
   *     ],
   *
   *     // computed property, will compute at each time digest end
   *     compute: function() {
   *       const a = this.get('a')
   *       const b = this.get('b')
   *       return a + '' + b
   *     },
   *
   *     prepare: (value, key, data) => !!data.on_market, // optional, used by `rebuild`, `data` is the parameter of `rebuild`
   *
   *     drop: (value) => Boolean, // optional, whether to not use this property when invoke `jsondata` and `formdata`
   *     map: (value) => newValue, // optional, to override the property value when using `jsondata` and `formdata`, not work when `drop` is false

   *     catch: (error) => {}, // when an error occurs caused by this property, what to do with the error, always by using `ensure`
   *   },
   * }
   */

  constructor(definition) {
    each(definition, (def, key) => {
      if (!isObject(def)) {
        throw new TyError(`[Schema]: definition '${key}' should be an object.`)
      }
    })

    this.definition = definition
  }

  /**
   * validate type and vaidators
   * @param {*} key
   * @param {*} value
   * @param {*} context
   */
  validate(key, value, context) {
    const definition = this.definition

    if (isObject(key)) {
      context = value
      value = key

      const data = value
      const error = iterate(definition, (def, key) => {
        if (!inObject(key, data) && def.required === false) {
          return
        }
        if (!inObject(key, data) && def.required !== false) {
          return new TyError(`{keyPath} is required, but is not existing.`, { key, level: 'schema', schema: this, action: 'validate' })
        }

        const value = data[key]
        const error = this.validate(key, value, context)
        if (error) {
          return error
        }
      })
      return error
    }

    const def = definition[key]
    const info = { key, value, level: 'schema', schema: this, action: 'validate' }

    if (!def) {
      return new TyError(`{keyPath} is not existing in schema definition when validate.`, info)
    }

    const { type, validators } = def

    var error = Ty.catch(value).by(type)
    if (error) {
      error = makeError(error, { ...info, pattern: type })
      return error
    }

    if (isArray(validators)) {
      error = iterate(validators, (validator) => {
        const { validate, determine, message } = validator
        if (isFunction(determine) && !determine.call(context, value)) {
          return
        }
        if (isBoolean(determine) && !determine) {
          return
        }

        const passed = validate.call(context, value)
        if (passed) {
          return
        }

        let msg = message

        if (isFunction(message)) {
          msg = message.call(context, value)
        }

        let error = new TyError(msg, { ...info, pattern: validate })
        return error
      })

      if (error) {
        error = makeError(error, { ...info, pattern: validators })
        return error
      }
    }
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
        const { required } = def

        if (!inObject(key, data) && required === false) {
          return
        }

        if (!inObject(key, data) && required !== false) {
          let error = new TyError(`{keyPath} is required, but is not existing.`, { key, level: 'schema', schema: this, action: 'validate' })
          if (isFunction(handle)) {
            handle.call(context, error)
          }
          return defaultValue
        }

        try {
          const value = data[key]
          const res = this.ensure(key, value, context)
          return res
        }
        catch (e) {
          if (isFunction(handle)) {
            handle.call(context, error)
          }
          return defaultValue
        }
      })

      return output
    }

    const def = definition[key]
    const info = { key, value, level: 'schema', schema: this, action: 'ensure' }

    if (!def) {
      throw new TyError(`[Schema]: '${key}' is not existing in schema definition when ensure.`, info)
    }

    const error = this.validate(key, value, context)
    if (error) {
      if (isFunction(handle)) {
        handle.call(context, error)
      }
      return defaultValue
    }

    return value
  }

  /**
   * get final computed properties.
   * Notice: data will be changed.
   * @param {*} data
   * @param {*} context
   */
  digest(data, context) {
    const definition = this.definition
    const getComputedValue = (def, value) => {
      const { compute } = def
      const handle = def.catch
      const defaultValue = def.default
      if (isFunction(compute)) {
        try {
          const res = compute.call(context)
          return res
        }
        catch (error) {
          if (isFunction(handle)) {
            handle.call(context, error)
          }
          return defaultValue
        }
      }
      else {
        return value
      }
    }

    var dirty = false
    var count = 0

    const digest = () => {
      dirty = false

      each(definition, (def, key) => {
        const { compute } = def
        if (!isFunction(compute)) {
          return
        }

        const value = data[key]
        const computed = getComputedValue(def, value)
        const cache = data[key]
        if (!isEqual(cache, computed)) {
          dirty = true
          data[key] = computed
        }
      })

      count ++
      if (count > 15) {
        throw new TyError(`[Schema]: digest over 15 times.`)
      }

      if (dirty) {
        digest()
      }
    }

    digest()

    return data
  }

  /**
   * rebuild data by passed data
   * @param {*} data
   * @param {*} context
   */
  rebuild(data, context) {
    const definition = this.definition

    if (!isObject(data)) {
      throw new TyError(`[Schema]: data should be an object when rebuild.`)
    }

    const output = map(definition, (def, key) => {
      const value = data[key]
      const { prepare, required } = def
      const handle = def.catch
      const defaultValue = def.default

      var coming
      if (isFunction(prepare)) {
        try {
          coming = prepare.call(context, value, key, data)
        }
        catch (error) {
          if (isFunction(handle)) {
            handle.call(context, error)
          }
        }
      }

      if (!inObject(key, data) && required === false && coming === undefined) {
        return
      }

      if (!inObject(key, data) && required !== false && coming === undefined) {
        return defaultValue
      }

      if (coming === undefined) {
        return defaultValue
      }

      return coming
    })

    const computed = this.digest(output, context)
    const results = this.ensure(computed, context)
    return results
  }

  /**
   * formulate to get output data
   * @param {*} data
   * @param {*} context
   */
  formulate(data, context) {
    const definition = this.definition

    if (!isObject(data)) {
      throw new TyError(`[Schema]: data should be an object when rebuild.`)
    }

    const output = map(definition, (def, key) => {
      const value = data[key]
      const { drop, map } = def
      const handle = def.catch

      if (isFunction(drop) && drop.call(context, value, key, data)) {
        return
      }
      if (isBoolean(drop) && drop) {
        return
      }

      if (isFunction(map)) {
        try {
          const res = map.call(context, value, key, data)
          return res
        }
        catch (error) {
          if (isFunction(handle)) {
            handle.call(context, error)
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
    const Interface = getInterface(this)
    const schema = new Interface(next)
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

    const Interface = getInterface(this)
    const schema = new Interface(next)
    return schema
  }
  mix(fields) {
    const current = this.definition
    const keys = Object.keys(fields)
    const next = {}

    keys.forEach((key) => {
      if (fields[key] === true) {
        next[key] = current[key]
      }
      else if (isObject(fields[key]) || isInstanceOf(fields[key], Type)) {
        next[key] = fields[key]
      }
    })

    const Interface = getInterface(this)
    const schema = new Interface(next)
    return schema
  }
}
export default Schema
