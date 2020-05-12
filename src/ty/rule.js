import {
  isFunction,
  isBoolean,
  isInstanceOf,
  isString,
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

  validate(data, key, pattern) {
    const { validate } = this.options
    const { message } = this
    const makeError = (arg) => {
      if (!arg) {
        return null
      }
      if (message) {
        const msg = isFunction(message) ? message(data, key) : message
        const err = new TypeError(msg)
        return err
      }
      if (isInstanceOf(arg, Error)) {
        return arg
      }
      if (isString(arg)) {
        return new TypeError(arg)
      }
    }

    let error = null

    if (isInstanceOf(pattern, Rule)) {
      const rule = this.isStrict && !pattern.isStrict ? pattern.strict : pattern
      const err = rule.catch(data, key)
      error = makeError(err)
    }
    else if (isInstanceOf(pattern, Type)) {
      const type = this.isStrict && !pattern.isStrict ? pattern.strict : pattern
      const err = type.catch(data[key])
      error = makeError(err)
    }
    else if (isFunction(validate)) {
      const res = validate.call(this, data, key)
      if (isBoolean(res)) {
        if (!res) {
          error = makeError('exception')
        }
      }
      else if (isInstanceOf(res, Error)) {
        error = makeError(res)
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
    let error = this.validate(data, key, pattern)

    // 4 decorate
    if (!error && isFunction(decorate)) {
      decorate.call(this, data, key)
    }

    // 5 override
    if (error && isFunction(override)) {
      override.call(this, data, key)
      error = this.validate(data, key, pattern)
    }

    // 6 complete
    if (isFunction(complete)) {
      const err = complete.call(this, data, key, error)
      error = err === null || err instanceof Error ? err : error
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
