import { isInstanceOf, isNaN, isNumber, isBoolean, isString, isFunction, isArray, isObject, isSymbol, isInterface } from './utils.js'

export class Prototype {
  constructor({ name, validate }) {
    this.name = name
    this._validate = validate
  }
  validate(value) {
    return !!this._validate.call(this, value)
  }
  toString() {
    return this.name
  }
}

export default Prototype

const prototypes = []
Prototype.registry = (proto, validate) => {
  const item = prototypes.find(item => item.proto === proto)
  if (item) {
    item.validate = validate
  }
  else {
    prototypes.push({ proto, validate })
  }
}
Prototype.unregistry = (proto) => {
  for (let i = 0, len = prototypes.length; i < len; i ++) {
    const item = prototypes[i]
    if (item.proto === proto) {
      prototypes.splice(i, 1)
      break
    }
  }
}
Prototype.has = proto => isInstanceOf(proto, Prototype) || isNaN(proto) || isInstanceOf(proto, RegExp) || isInterface(proto) || prototypes.some(item => item.proto === proto)
Prototype.is = arg => ({
  // Prototype.is(Number).typeof(10)
  typeof: (value) => {
    const proto = arg
    if (isInstanceOf(proto, Prototype)) {
      return proto.validate(value)
    }

    const item = prototypes.find(item => item.proto === proto)
    if (item) {
      return item.validate(value)
    }

    if (isNaN(proto)) {
      return isNaN(value)
    }
    if (isInstanceOf(proto, RegExp)) {
      return isString(value) && proto.test(value)
    }
    if (isInterface(proto)) {
      return isInstanceOf(value, proto)
    }

    return false
  },

  // Prototype.is(10).of(Number)
  of: (proto) => Prototype.is(proto).typeof(arg),
})

Prototype.registry(Number, isNumber)
Prototype.registry(String, isString)
Prototype.registry(Boolean, isBoolean)
Prototype.registry(Object, isObject)
Prototype.registry(Array, isArray)
Prototype.registry(Function, isFunction)
Prototype.registry(Symbol, isSymbol)
