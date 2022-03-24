import {
  isEmpty,
  isNumber,
  isNumeric,
  isString,
  isConstructor,
  isFunction,
  isInstanceOf,
  isBoolean,
  isNaN,
  numerify,
} from 'ts-fns'
import { ofChain } from './shared/utils.js'

export class Validator {
  constructor(attrs = {}) {
    const properties = ofChain(this, Validator)
    Object.assign(this, properties, attrs)
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
  static len = len
  static maxLen = maxLen
  static minLen = minLen
  static allOf = allOf
  static anyOf = anyOf
}
export default Validator

function required(message, emptyFn) {
  return new Validator({
    name: 'required',
    determine(_, key) {
      if (this && this.$views && this.$views[key]) {
        return this.$views[key].required
      }
      return true
    },
    validate(value, key) {
      // emptyFn has higher priority
      if (emptyFn) {
        return !emptyFn(value)
      }
      if (this && this.$views && this.$views[key]) {
        return !this.$views[key].empty
      }
      return !isEmpty(value)
    },
    message,
    break: true,
  })
}

function len(len, message) {
  return match(value => isString(value) && value.length === len, message, 'len')
}

function maxLen(len, message) {
  return match(value => isString(value) && value.length <= len, message, 'maxLen')
}

function minLen(len, message) {
  return match(value => isString(value) && value.length >= len, message, 'minLen')
}

function integer(len, message) {
  const validate = (value) => {
    if (!isNumber(value) && !isNumeric(value)) {
      return false
    }

    const num = numerify(value).replace('-', '')
    const [integ] = num.split('.')
    if (integ.length > len) {
      return false
    }

    return true
  }
  return match(validate, message, 'integer')
}

function decimal(len, message) {
  const validate = (value) => {
    if (!isNumber(value) && !isNumeric(value)) {
      return false
    }

    const num = numerify(value)
    const [_, decim = ''] = num.split('.')
    if (decim.length > len) {
      return false
    }

    return true
  }
  return match(validate, message, 'decimal')
}

function max(num, message) {
  return match(value => (isNumber(value) || isNumeric(value)) && +value <= num, message, 'max')
}

function min(num, message) {
  return match(value => (isNumber(value) || isNumeric(value)) && +value >= num, message, 'min')
}

function email(message) {
  return match(/^[A-Za-z0-9]+[A-Za-z0-9\._]*[A-Za-z0-9]+@[A-Za-z0-9]+[A-Za-z0-9\.\-]*[A-Za-z0-9]+\.[A-Za-z]{2,8}$/, message, 'email')
}

function url(message) {
  return match(/http(s)?:\/\/([\w-]+\.)+[\w-]+(\/[\w- .\/?%&=]*)?/, message, 'url')
}

function date(message) {
  return match(/^[1-2][0-9]{3}\-[0-1][0-9]\-[0-3][0-9]/, message, 'date')
}

function match(validator, message, name = 'match') {
  return new Validator({
    name,
    validate(value) {
      if (isInstanceOf(validator, RegExp)) {
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
      else if (isNaN(validator)) {
        return isNaN(value)
      }
      // isConstructor should must come before isFunction
      else if (isConstructor(validator, 2)) {
        return isInstanceOf(value, validator)
      }
      else if (isFunction(validator)) {
        return validator.call(this, value)
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
    name: 'allOf',
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

function anyOf(validators, message) {
  return new Validator({
    name: 'anyOf',
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
