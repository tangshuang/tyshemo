import {
  isInstanceOf,
  isNaN,
  isNumber,
  isBoolean,
  isString,
  isFunction,
  isArray,
  isObject,
  isSymbol,
  isConstructor,
  isInfinite,
  isInheritedOf,
} from 'ts-fns'

export class Prototype {
  constructor(options = {}) {
    this.name = options.name
    this.validate = options.validate
  }
  toString() {
    return this.name
  }
}

export default Prototype

const prototypes = []
Prototype.register = (proto, validate) => {
  const item = prototypes.find(item => item.proto === proto)
  if (item) {
    item.validate = validate
  }
  else {
    prototypes.push({ proto, validate })
  }
}
Prototype.unregister = (proto) => {
  if (arguments.length === 0) {
    prototypes.length = 0
    return
  }

  for (let i = 0, len = prototypes.length; i < len; i ++) {
    const item = prototypes[i]
    if (item.proto === proto) {
      prototypes.splice(i, 1)
      break
    }
  }
}
Prototype.find = proto => prototypes.find(item => item.proto === proto)
Prototype.is = (proto) => ({
  // Prototype.is(Number).existing()
  existing: () => isNaN(proto) || isInstanceOf(proto, RegExp) || !!Prototype.find(proto) || isInstanceOf(proto, Prototype) || isConstructor(proto) || isInheritedOf(proto, Prototype),

  // Prototype.is(Number).typeof(10)
  typeof: (value) => {
    if (isInstanceOf(proto, Prototype)) {
      return proto.validate(value)
    }

    if (isInheritedOf(proto, Prototype)) {
      return new proto().validate(value)
    }

    const item = Prototype.find(proto)
    if (item) {
      return item.validate(value)
    }

    if (isNaN(proto)) {
      return isNaN(value)
    }

    if (isInstanceOf(proto, RegExp)) {
      return isString(value) && proto.test(value)
    }

    if (isConstructor(proto)) {
      return isInstanceOf(value, proto)
    }

    return false
  },

  // Prototype.is(10).equal(10)
  equal: value => proto === value,
})

Prototype.register(Number, isNumber)
Prototype.register(String, isString)
Prototype.register(Boolean, isBoolean)
Prototype.register(Object, isObject)
Prototype.register(Array, isArray)
Prototype.register(Function, isFunction)
Prototype.register(Symbol, isSymbol)
Prototype.register(Infinity, isInfinite)
