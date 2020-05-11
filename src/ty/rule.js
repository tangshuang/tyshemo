import {
  isFunction,
  isBoolean,
  isInstanceOf,
} from 'ts-fns'

import Type from './type.js'

export class Rule {
  /**
   * define a rule
   * @param {string} name
   * @param {function} validate return 1.true/false 2.error/null
   * @param {function} override
   * @param {function} complete
   * @param {string|function} message
   */
  constructor(options = {}) {
    const {
      name,
      pattern,
      message,
    } = options

    this.name = name || 'Rule'
    this.pattern = pattern
    this.message = message
    this.isStrict = false
    this.options = options
  }

  validate(value, pattern) {
    const { validate } = this.options
    const { message } = this

    let error = null

    if (isInstanceOf(pattern, Rule)) {
      const rule = this.isStrict && !pattern.isStrict ? pattern.strict : pattern
      error = rule.validate(value)
    }
    else if (isInstanceOf(pattern, Type)) {
      const type = this.isStrict && !pattern.isStrict ? pattern.strict : pattern
      error = type.catch(value)
    }
    else if (isFunction(validate)) {
      const res = validate.call(this, value)
      if (isBoolean(res)) {
        if (!res) {
          const msg = message ? isFunction(message) ? message(value) : message : 'exception'
          error = new TypeError(msg)
        }
      }
      else if (isInstanceOf(res, Error)) {
        error = res
      }
    }

    return error
  }

  /**
   * validate value twice
   * @param {*} data
   * @param {*} key
   */
  catch(data, key) {
    const {
      shouldcheck,
      use,
      decorate,
      override,
      complete,
    } = this.options

    // 1 should check?
    if (isFunction(shouldcheck) && !shouldcheck.call(this, data, key)) {
      return null
    }

    // 2 use
    const pattern = isFunction(use) ? use.call(this, data, key) : null

    // 3 validate
    let error = this.validate(data[key], pattern)

    // 4 decorate
    if (!error && isFunction(decorate)) {
      decorate.call(this, data, key)
    }

    // 5 override
    if (error && isFunction(override)) {
      override.call(this, data, key)
      error = this.validate(data[key], pattern)
    }

    // 6 complete
    if (isFunction(complete)) {
      complete.call(this, error)
    }

    return error
  }

  clone() {
    const Constructor = getConstructor(this)
    const ins = new Constructor(this.options)
    return ins
  }

  toBeStrict(mode = true) {
    this.isStrict = !!mode
    return this
  }

  get strict() {
    const ins = this.clone()
    ins.toBeStrict()
    return ins
  }
  get Strict() {
    return this.strict
  }

  toString() {
    return this.name
  }
}

export default Rule
