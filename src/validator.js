import {
  getConstructorOf,
  inherit,
  isEmpty,
  isNumber,
  isNumeric,
  isString,
  isConstructor,
  isFunction,
  isInstanceOf,
  isBoolean,
} from 'ts-fns'

export class Validator {
  constructor(attrs = {}) {
    const Constructor = getConstructorOf(this)
    const finalAttrs = { ...Constructor, ...attrs }
    Object.assign(this, finalAttrs)
    this.onInit()
  }

  onInit() {}

  extend(attrs = {}) {
    const Constructor = getConstructorOf(this)
    const finalAttrs = { ...this, ...attrs }
    return new Constructor(finalAttrs)
  }

  // make each validator break true
  static breakEach(validators) {
    return validators.map(validator => new Validator({
      ...validator,
      break: true,
    }))
  }

  static extend(attrs = {}) {
    const Constructor = inherit(this, {}, attrs)
    return Constructor
  }

  static required = required
  static integer = integer
  static decimal = decimal
  static max = max
  static min = min
  static email = email
  static url = url
  static date = date
  static match = match
  static maxLen = maxLen
  static minLen = minLen
  static allOf = allOf
  static oneOf = oneOf
}
export default Validator

function required(message) {
  return match(value => !isEmpty(value), message)
}

function maxLen(len, message) {
  return match(value => isString(value) && value.length <= len, message)
}

function minLen(len, message) {
  return match(value => isString(value) && value.length >= len, message)
}

function integer(len, message) {
  const validate = (value) => {
    const max = Math.pow(10, len)

    if (!isNumber(value) && !isNumeric(value)) {
      return false
    }

    const num = +value
    if (num >= max) {
      return false
    }

    return true
  }
  return match(validate, message)
}

function decimal(len, message) {
  const validate = (value) => {
    const fix = Math.pow(10, len)

    if (!isNumber(value) && !isNumeric(value)) {
      return false
    }

    const num = +value
    if (num * fix % 1 !== 0) {
      return false
    }

    return true
  }
  return match(validate, message)
}

function max(num, message) {
  return match(value => (isNumber(value) || isNumeric(value)) && +value <= num, message)
}

function min(num, message) {
  return match(value => (isNumber(value) || isNumeric(value)) && +value >= num, message)
}

function email(message) {
  return match(/^[A-Za-z0-9]+[A-Za-z0-9\._]*[A-Za-z0-9]+@[A-Za-z0-9]+[A-Za-z0-9\.\-]*[A-Za-z0-9]+\.[A-Za-z]{2,8}$/, message)
}

function url(message) {
  return match(/http(s)?:\/\/([\w-]+\.)+[\w-]+(\/[\w- .\/?%&=]*)?/, message)
}

function date(message) {
  return match(/^[1-2][0-9]{3}\-[0-1][0-9]\-[0-3][0-9]/, message)
}

function match(validator, message) {
  return new Validator({
    validate(value) {
      if (isFunction(validator)) {
        return validator.call(this, value)
      }
      else if (isInstanceOf(validator, RegExp)) {
        return typeof value === 'string' && validator.test(value)
      }
      else if (validator === String) {
        return isString(value)
      }
      else if (validator === Number) {
        return isNumber(value)
      }
      else if (validator === Boolean) {
        return isBoolean(value)
      }
      else if (validator === Function) {
        return typeof value === 'function'
      }
      else if (isConstructor(validator)) {
        return isInstanceOf(value, validator)
      }
      else if (isNaN(validator)) {
        return isNaN(value)
      }
      else {
        return validator === value
      }
    },
    message,
    break: true,
  })
}

function allOf(validators, message) {
  return new Validator({
    validate(value) {
      for (const i = 0, len = validators.length; i < len; i ++) {
        const validate = validators[i]
        if (!validate.call(this, value)) {
          return false
        }
      }
      return true
    },
    message,
    break: true,
  })
}

function oneOf(validators, message) {
  return new Validator({
    validate(value) {
      for (const i = 0, len = validators.length; i < len; i ++) {
        let validate = validators[i]
        if (validate.call(this, value)) {
          return true
        }
      }
      return false
    },
    message,
    break: true,
  })
}
