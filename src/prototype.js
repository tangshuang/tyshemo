import { isInstanceOf, isNaN, isNumber, isBoolean, isString, isFunction, isArray, isObject, isSymbol, isInterface, inArray } from './utils.js'

export class Prototype {
  constructor({ name, validate }) {
    this.name = name
    this._validate = validate
  }
  validate(value) {
    return this._validate.call(this, value)
  }
  toString() {
    return this.name
  }
}

export default Prototype

Prototype.can = arg => isInstanceOf(arg, Prototype) || isNaN(arg) || isInstanceOf(arg, RegExp) || inArray(arg, [
  Number,
  String,
  Boolean,
  Function,
  Array,
  Object,
  Symbol,
]) || isInterface(arg)

Prototype.is = arg => ({
  // Prototype.is(Number).typeof(10)
  typeof: (value) => {
    const prototype = arg
    if (isInstanceOf(prototype, Prototype)) {
      return prototype.validate(value)
    }
    if (isNaN(prototype)) {
      return isNaN(value)
    }
    if (prototype === Number) {
      return isNumber(value)
    }
    if (prototype === Boolean) {
      return isBoolean(value)
    }
    if (prototype === String) {
      return isString(value)
    }
    if (isInstanceOf(prototype, RegExp)) {
      return isString(value) && prototype.test(value)
    }
    if (prototype === Function) {
      return isFunction(value)
    }
    if (prototype === Array) {
      return isArray(value)
    }
    if (prototype === Object) {
      return isObject(value)
    }
    if (prototype === Symbol) {
      return isSymbol(value)
    }
    if (isInterface(prototype)) {
      return isInstanceOf(value, prototype)
    }
  },

  // Prototype.is(10).of(Number)
  of: (prototype) => Prototype.is(prototype).typeof(arg),
})
