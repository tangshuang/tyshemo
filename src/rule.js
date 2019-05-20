import { isFunction, isInstanceOf, isBoolean } from './utils.js'
import TyError, { makeError } from './error.js'

export class Rule {
  /**
   * define a rule
   * @param {*} name
   * @param {*} validate return 1.true/false 2.error/null
   * @param {*} override
   * @example
   * // example1:
   * const Null = new Rule(value => value === null)
   * // example2:
   * const ifnotmatch = (validate, override) => new Rule({ name: 'ifnotmatch', validate, override })
   * const SomePattern = {
   *   weight: ifnotmatch(value => typeof value === 'number', (value, key, target) => { target[key] = 0 }),
   * }
   */
  constructor(options = {}) {
    var { name, validate, override, message, prepare, complete } = options
    if (isFunction(options)) {
      validate = options
    }

    this._prepare = prepare
    this._complete = complete
    this._validate = validate
    this._override = override
    this._message = message
    this.name = name || 'Rule'
  }

  /**
   * validate value
   * @param {*} value
   * @returns error/null
   */
  validate(value) {
    if (isFunction(this._validate)) {
      const info = { value, rule: this, level: 'rule', action: 'validate' }
      let res = this._validate.call(this, value)
      if (isBoolean(res)) {
        if (!res) {
          let msg = this._message ? isFunction(this._message) ? this._message.call(this, value) : this._message : 'mistaken'
          let error = new TyError(msg, info)
          return error
        }
      }
      else if (isInstanceOf(res, Error)) {
        return makeError(res, info)
      }
    }
    return null
  }

  /**
   * validate value twice
   * @param {*} value
   * @param {*} key
   * @param {*} target
   */
  validate2(value, key, target) {
    const info = { value, rule: this, level: 'rule', action: 'validate2' }
    if (isFunction(this._prepare)) {
      this._prepare.call(this, value, key, target)
    }
    let error = this.validate(value)
    if (error && isFunction(this._override)) {
      this._override.call(this, value, key, target)
      value = target[key]
      error = this.validate(value)
    }
    if (isFunction(this._complete)) {
      this._complete.call(this, value, key, target)
    }
    return makeError(error, info)
  }

  toString() {
    return this.name
  }
}

export default Rule
