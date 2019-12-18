import { each, isObject, map, iterate, isArray, isFunction, isBoolean, isEqual, getConstructor, isInstanceOf, isEmpty } from 'ts-fns'
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
   *     // optional, computed property, will compute at each time digest end
   *     // when it is a compute property, it is not able to use set to update value
   *     compute: function() {
   *       const a = this.get('a')
   *       const b = this.get('b')
   *       return a + '' + b
   *     },
   *
   *     type: String, // required, notice: `default` and result of `compute` should match type
   *     rule: ifexist, // optional, which rule to use, only `ifexist` `instance` and `equal` allowed
   *     message: '', // the message when type checking and required checking fail
   *     validators: [ // optional
   *       {
   *         determine: (value) => Boolean, // whether to run this validator, return true to run, false to forbid
   *         validate: (value) => Boolean, // whether to pass the validate, return true to pass, false to not pass and throw error
   *         message: '', // the message of error which throw when validate not pass
   *       },
   *     ],
   *     catch: (error) => {}, // when an error occurs caused by this property, what to do with the error, always by using `ensure`
   *
   *
   *     prepare: (value, key, data) => !!data.on_market, // optional, function, used by `rebuild`, `data` is the parameter of `rebuild`
   *
   *     drop: (value, key, data) => Boolean, // optional, function, whether to not use this property when invoke `jsondata` and `formdata`
   *     map: (value, key, data) => newValue, // optional, function, to override the property value when using `jsondata` and `formdata`, not work when `drop` is false
   *     flat: (value, key, data) => ({ newProp: newValue }), // optional, function, to assign this result to output data, don't forget to set `drop` to be true if you want to drop original data
   *
   *     getter: (value) => newValue, // optional, function, format this property value when get
   *     setter: (value) => value, // optional, function, format this property value when set
   *
   *     required: () => Boolean, // optional, function or boolean, use schema.required(field) to check, will be invoked by validate
   *     disabled: () => Boolean, // optional, function or boolean, use schema.disabled(field) to check, will disable set/validate, preload before drop in formulate
   *     readonly: () => Boolean, // optional, function or boolean, use schema.readonly(field) to check, will disable set
   *     // the difference between `disabled` and `readonly`: 
   *     // disabled is to disable this property, so that it should not be used(shown) in your application, could not be changed, validate will not work, and will be dropped when formulate,
   *     // readonly means the property can only be read/validate/formulate, but could not be changed.
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

  required(key, context) {
    const { definition } = this
    const def = definition[key]

    if (!def) {
      return false
    }

    const { required } = def

    if (!required) {
      return false
    }

    return isFunction(required) ? !!required.call(context) : !!required
  }

  disabled(key, context) {
    const { definition } = this
    const def = definition[key]

    if (!def) {
      return false
    }

    const { disabled } = def

    if (!disabled) {
      return false
    }

    return isFunction(disabled) ? !!disabled.call(context) : !!disabled
  }

  readonly(key, context) {
    const { definition } = this
    const def = definition[key]

    if (!def) {
      return false
    }

    const { readonly } = def

    if (!readonly) {
      return false
    }

    return isFunction(readonly) ? !!readonly.call(context) : !!readonly
  }

  get(key, value, context) {
    const { definition } = this
    const def = definition[key]

    if (!def) {
      return value
    }

    const { getter } = def
    const next = isFunction(getter) ? getter.call(context, value) : value

    return next
  }

  set(key, value, context) {
    const { definition } = this
    const def = definition[key]

    if (!def) {
      return value
    }

    if (this.disabled(key, context)) {
      throw new Error(`[Schema]: ${key} is disabled.`)
    }
    
    if (this.readonly(key, context)) {
      throw new Error(`[Schema]: ${key} is readonly`)
    }

    const { setter, compute } = def
    
    if (compute) {
      throw new Error(`[Schema]: ${key} is a computed property, is not allowed to set value.`)
    }
    
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
    const { definition } = this

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
    
    // if the property is disabled, there is no need to validate it
    if (this.disabled(key, context)) {
      return null
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
    
    // if required is set, it should check before validators
    if (!error && this.required(key, context) && isEmpty(value)) {
      error = new Error(`[Schema]: ${key} is required.`)
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
          return res
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
   * make sure each property is fit type and validators
   * @param {*} key
   * @param {*} value
   * @param {*} context
   */
  ensure(key, value, context) {
    const { definition } = this

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

    const handle = def.catch
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
    const { definition } = this
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

    let dirty = false
    let count = 0

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
   * rebuild data by passed data with `prepare` option, you'd better to call ensure to after rebuild to make sure your data is fix with type
   * @param {*} data
   * @param {*} context
   */
  rebuild(data, context) {
    const { definition } = this

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
          const coming = prepare.call(context, value, key data)
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
    const { definition } = this

    if (!isObject(data)) {
      throw new Error(`[Schema]: data should be an object when rebuild.`)
    }

    const patch = {}
    const output = map(definition, (def, key) => {
      const value = data[key]
      const { drop, map, flat } = def
      const handle = def.catch

      if (isFunction(flat)) {
        const res = flat.call(context, value, key, data) || {}
        Object.assign(patch, res)
      }

      // do not to post it to backend, so drop it before all
      if (this.disabled(key, context)) {
        return
      }

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
            handle.call(context, error, key, value)
          }
          return def.default
        }
      }

      return value
    })

    const result = Object.assign(output, patch)
    return result
  }

  define(key, def, force = false) {
    const { definition } = this
    
    if (force) {
      definition[key] = def
    }
    else {
      const exist = definition[key] || {}
      Object.assign(exist, def)
      definition[key] = exist
    }

    return this
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
