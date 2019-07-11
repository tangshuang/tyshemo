import { isFunction, isBoolean, isInstanceOf } from './utils.js'

export class Rule {
  /**
   * define a rule
   * @param {string} name
   * @param {function} validate return 1.true/false 2.error/null
   * @param {function} prepare
   * @param {function} override
   * @param {function} complete
   * @param {string|function} message
   */
  constructor(options = {}) {
    var { name, validate, override, message, prepare, complete, pattern } = options

    this._prepare = prepare
    this._complete = complete
    this._validate = validate
    this._override = override
    this._message = message

    this.isStrict = false
    this.name = name || 'Rule'
    this.pattern = pattern
    this.options = options
  }

  /**
   * validate value
   * @param {*} value
   * @returns error/null
   */
  validate(value, key, data) {
    // use validate as validate2
    if (key && data) {
      return this.validate2(value, key, data)
    }

    if (isFunction(this._validate)) {
      const res = this._validate.call(this, value)
      if (isBoolean(res)) {
        if (!res) {
          const msg = this._message ? isFunction(this._message) ? this._message.call(this, value) : this._message : '{keyPath} not match rule ' + this.name
          const error = new Error(msg)
          return error
        }
      }
      else if (isInstanceOf(res, Error)) {
        const error = res
        return error
      }
    }

    return null
  }

  /**
   * validate value twice
   * @param {*} value
   * @param {*} key
   * @param {*} data
   */
  validate2(value, key, data) {
    if (isFunction(this._prepare)) {
      this._prepare.call(this, { value, key, data })
    }
    let error = this.validate(value)
    if (error && isFunction(this._override)) {
      this._override.call(this, { value, key, data })
      value = data[key]
      error = this.validate(value)
    }
    if (isFunction(this._complete)) {
      this._complete.call(this, { value, key, data })
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
