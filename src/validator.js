import { isEmpty, isNumber, isNumeric, isString, createSafeExp } from 'ts-fns'

function required() {
  return value => !isEmpty(value)
}

function maxLen(len) {
  return value => isString(value) && value.length <= len
}

function minLen(len) {
  return value => isString(value) && value.length >= len
}

function numeral(integer, decimal) {
  return (value) => {
    const max = Math.pow(10, integer)
    const fix = Math.pow(10, decimal)

    if (!isNumber(value) && !isNumeric(value)) {
      return false
    }

    const num = +value
    if (num >= max) {
      return false
    }
    else if (num * fix % 1 !== 0) {
      return false
    }
    else {
      return true
    }
  }
}

function max(num) {
  return value => (isNumber(value) || isNumeric(value)) && +value <= num
}

function min(num) {
  return value => (isNumber(value) || isNumeric(value)) && +value >= num
}

function email() {
  return value => isString(value) && /^[A-Za-z0-9]+[A-Za-z0-9\._]*[A-Za-z0-9]+@[A-Za-z0-9]+[A-Za-z0-9\.\-]*[A-Za-z0-9]+\.[A-Za-z]{2,8}$/.test(value)
}

function url() {
  return value => isString(value) && /(((^https?:(?:\/\/)?)(?:[-;:&=\+\$,\w]+@)?[A-Za-z0-9.-]+|(?:www.|[-;:&=\+\$,\w]+@)[A-Za-z0-9.-]+)((?:\/[\+~%\/.\w-_]*)?\??(?:[-\+=&;%@.\w_]*)#?(?:[\w]*))?)$/.test(value)
}

function date(sep = '-') {
  return value => isString(value) && new RegExp(`^[1-2][0-9]{3}${createSafeExp(sep)}[0-1][0-9]${createSafeExp(sep)}[0-3][0-9]`).test(value)
}

function match(reg) {
  return value => typeof value === 'string' && reg.test(value)
}

function merge(...validators) {
	return function(value) {
		for (const i = 0, len = validators.length; i < len; i ++) {
			const validate = validators[i]
			if (!validate.call(this, value)) {
				return false
			}
		}
		return true
	}
}

function enume(...validators) {
	return function(value) {
		for (const i = 0, len = validators.length; i < len; i ++) {
			let validate = validators[i]
			if (validate.call(this, value)) {
				return true
			}
		}
		return false
	}
}

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

  static extend(attrs = {}) {
    const Constructor = inherit(this, {}, attrs)
    return Constructor
  }

  static required = required
  static numeral = numeral
  static max = max
  static min = min
  static email = email
  static url = url
  static date = date
  static match = match
  static maxLen = maxLen
  static minLen = minLen

  static merge = merge
  static enume = enume
}
export default Validator
