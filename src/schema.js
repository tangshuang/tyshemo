import { each, isObject, map, iterate, isArray, isFunction, isBoolean, inObject, isEqual } from './utils.js'
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
   *     prepare: (value, key, data) => !!data.on_market, // optional, used by `restore`, `data` is the parameter of `restore`
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

  ensure(key, value, context) {
    const definition = this.definition

    if (isObject(key)) {
      context = value
      value = key

      const data = value
      const output = map(definition, (def, key) => {
        const defaultValue = def.default
        const handle = def.catch

        if (def.required !== false && !inObject(key, data)) {
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
      const results = this.digest(output, context)
      return results
    }

    const def = definition[key]
    const info = { key, value, level: 'schema', schema: this, action: 'ensure' }

    if (!def) {
      throw new TyError(`[Schema]: '${key}' is not existing in schema definition when ensure.`, info)
    }

    // use computed value
    const { compute } = def
    const defaultValue = def.default
    const handle = def.catch
    if (isFunction(compute)) {
      try {
        const output = compute.call(context)
        return output
      }
      catch (error) {
        if (isFunction(handle)) {
          handle.call(context, error)
        }
        return defaultValue
      }
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

  restore(data, context) {
    const definition = this.definition

    if (!isObject(data)) {
      throw new TyError(`[Schema]: data should be an object when restore.`)
    }

    const output = map(definition, (def, key) => {
      const value = data[key]
      const { prepare } = def
      const handle = def.catch
      const defaultValue = def.default

      if (isFunction(prepare)) {
        try {
          const res = prepare.call(context, value, key, data)
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
    })

    const results = this.ensure(output, context)
    return results
  }

  formulate(data, context) {
    const definition = this.definition

    if (!isObject(data)) {
      throw new TyError(`[Schema]: data should be an object when restore.`)
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

    const caches = { ...data }
    var dirty = false
    var count = 0

    const digest = () => {
      dirty = false

      each(definition, (def, key) => {
        const value = data[key]
        const computed = getComputedValue(def, value)
        const cache = caches[key]
        if (!isEqual(cache, computed)) {
          dirty = true
          caches[key] = computed
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

    return caches
  }
}
export default Schema
