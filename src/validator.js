import { isEmpty, isNumber, isNumeric, isString, getConstructorOf, inherit } from 'ts-fns'

export class Validator {
  constructor(attrs = {}) {
    const Constructor = getConstructorOf(this)
    const finalAttrs = { ...Constructor, ...attrs }
    Object.assign(this, finalAttrs)
  }

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
  return new Validator({
    validate: value => !isEmpty(value),
    message,
    break: true,
  })
}

function maxLen(len, message) {
  return new Validator({
    validate: value => isString(value) && value.length <= len,
    message,
    break: true,
  })
}

function minLen(len, message) {
  return new Validator({
    validate: value => isString(value) && value.length >= len,
    message,
    break: true,
  })
}

function integer(len, message) {
  return new Validator({
    validate: (value) => {
      const max = Math.pow(10, len)

      if (!isNumber(value) && !isNumeric(value)) {
        return false
      }

      const num = +value
      if (num >= max) {
        return false
      }

      return true
    },
    message,
    break: true,
  })
}

function decimal(len, message) {
  return new Validator({
    validate: (value) => {
      const fix = Math.pow(10, len)

      if (!isNumber(value) && !isNumeric(value)) {
        return false
      }

      const num = +value
      if (num * fix % 1 !== 0) {
        return false
      }

      return true
    },
    message,
    break: true,
  })
}

function max(num, message) {
  return new Validator({
    validate: value => (isNumber(value) || isNumeric(value)) && +value <= num,
    message,
    break: true,
  })
}

function min(num, message) {
  return new Validator({
    validate: value => (isNumber(value) || isNumeric(value)) && +value >= num,
    message,
    break: true,
  })
}

function email(message) {
  return new Validator({
    validate: value => isString(value) && /^[A-Za-z0-9]+[A-Za-z0-9\._]*[A-Za-z0-9]+@[A-Za-z0-9]+[A-Za-z0-9\.\-]*[A-Za-z0-9]+\.[A-Za-z]{2,8}$/.test(value),
    message,
    break: true,
  })
}

function url(message) {
  return new Validator({
    validate: value => isString(value) && /(((^https?:(?:\/\/)?)(?:[-;:&=\+\$,\w]+@)?[A-Za-z0-9.-]+|(?:www.|[-;:&=\+\$,\w]+@)[A-Za-z0-9.-]+)((?:\/[\+~%\/.\w-_]*)?\??(?:[-\+=&;%@.\w_]*)#?(?:[\w]*))?)$/.test(value),
    message,
    break: true,
  })
}

function date(message) {
  return new Validator({
    validate: value => isString(value) && /^[1-2][0-9]{3}\-[0-1][0-9]\-[0-3][0-9]/.test(value),
    message,
    break: true,
  })
}

function match(reg, message) {
  return new Validator({
    validate: value => typeof value === 'string' && reg.test(value),
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
